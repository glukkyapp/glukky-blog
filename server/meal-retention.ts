import type { IStorage } from "./storage";

export const MEAL_RETENTION_DAYS = 180;
export const MEAL_RETENTION_BATCH_SIZE = 500;

type MealRetentionStorage = Pick<
  IStorage,
  | "fetchMealSnapsBeforeDate"
  | "getProfile"
  | "upsertDailyGlucose"
  | "upsertReportMealFactForSnap"
  | "purgeMealSnapsByIds"
>;

export async function runMealRetentionJob(
  storage: MealRetentionStorage,
  now: Date = new Date(),
): Promise<number> {
  console.log("[snap/delete] Daily delete job started.");
  const cutoff = new Date(now.getTime() - MEAL_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let totalDeleted = 0;
  const tzCache = new Map<string, string>();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await storage.fetchMealSnapsBeforeDate(cutoff, MEAL_RETENTION_BATCH_SIZE);
    if (batch.length === 0) break;
    const userDayMap = new Map<string, Map<string, { low: number; medium: number; high: number; mealCount: number; hasLateMeal: boolean }>>();
    for (const snap of batch) {
      if (!userDayMap.has(snap.userId)) userDayMap.set(snap.userId, new Map());
      const dayMap = userDayMap.get(snap.userId)!;
      if (!dayMap.has(snap.localDate)) dayMap.set(snap.localDate, { low: 0, medium: 0, high: 0, mealCount: 0, hasLateMeal: false });
      const entry = dayMap.get(snap.localDate)!;
      entry.mealCount++;
      if (snap.glucoseImpact === "low") entry.low++;
      else if (snap.glucoseImpact === "medium") entry.medium++;
      else if (snap.glucoseImpact === "high") entry.high++;
      if (!entry.hasLateMeal && (snap.mealType === "dinner" || snap.mealType === "snack")) {
        let tz = tzCache.get(snap.userId);
        if (tz === undefined) {
          const profile = await storage.getProfile(snap.userId);
          tz = profile?.deviceTimezone || "UTC";
          tzCache.set(snap.userId, tz);
        }
        const snapDate = snap.snapTime instanceof Date ? snap.snapTime : new Date(snap.snapTime as any);
        const hour = parseInt(new Intl.DateTimeFormat("en", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(snapDate), 10);
        if (hour >= 21) entry.hasLateMeal = true;
      }
    }
    for (const [userId, dayMap] of Array.from(userDayMap.entries())) {
      for (const [localDate, counts] of Array.from(dayMap.entries())) {
        await storage.upsertDailyGlucose(userId, localDate, counts);
      }
    }
    // Preserve the final HStix-over-AI result and only the dimensions used
    // for reporting before deleting the raw meal/photo record.
    for (const snap of batch) {
      await storage.upsertReportMealFactForSnap(snap.userId, snap.id);
    }
    // snap_daily_glucose is PERMANENT — only meal_snaps rows are purged here,
    // after their glucose counts have been aggregated into snap_daily_glucose.
    // Never add snap_daily_glucose purge logic to this job.
    await storage.purgeMealSnapsByIds(batch.map(snap => snap.id));
    totalDeleted += batch.length;
  }
  console.log(`[snap/delete] Completed. Deleted ${totalDeleted} snap rows.`);
  return totalDeleted;
}