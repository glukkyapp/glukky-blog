import {
  type UserProfile, type InsertUserProfile,
  type WeeklyPlan, type InsertWeeklyPlan,
  type WeeklyPlanDay, type InsertWeeklyPlanDay,
  type DailyLog, type InsertDailyLog,
  type WeeklyReport, type InsertWeeklyReport,
  type MonthlyReport, type InsertMonthlyReport,
  type PiggyBankEvent, type InsertPiggyBankEvent,
  type CycleHistoryRow, type InsertCycleHistory,
  type IngredientVocabulary, type InsertIngredientVocabulary,
  type FoodCombo, type InsertFoodCombo,
  type FoodLabel, type InsertFoodLabel,
  type FoodAdviceCache,
  type ScheduledNotification,
  userProfiles, weeklyPlans, weeklyPlanDays, dailyLogs, weeklyReports, monthlyReports, piggyBankEvents, cycleHistory,
  ingredientVocabulary, foodCombos, foodLabels, foodAdviceCache,
  scheduledNotifications,
  users, sessions,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, inArray, gt, or } from "drizzle-orm";
import { normalizeFoodNameForMatch, foodNamesMatch } from "./snap-parse";
import { deleteOneSignalUser } from "./onesignal";
import { deleteSubscriber as deleteRevenueCatSubscriber } from "./revenuecat";

export interface IStorage {
  getProfile(userId: string): Promise<UserProfile | undefined>;
  createProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;
  setRcCustomerId(userId: string, rcCustomerId: string): Promise<void>;

  getWeeklyPlan(userId: string, weekNumber: number): Promise<WeeklyPlan | undefined>;
  getWeeklyPlanById(planId: number): Promise<WeeklyPlan | undefined>;
  getWeeklyPlanForDate(userId: string, date: string): Promise<WeeklyPlan | undefined>;
  getCurrentWeeklyPlan(userId: string): Promise<WeeklyPlan | undefined>;
  createWeeklyPlan(plan: InsertWeeklyPlan): Promise<WeeklyPlan>;
  updateWeeklyPlan(planId: number, data: Partial<InsertWeeklyPlan>): Promise<WeeklyPlan | undefined>;

  getWeeklyPlanDay(planDayId: number): Promise<WeeklyPlanDay | undefined>;
  getWeeklyPlanDays(weeklyPlanId: number): Promise<WeeklyPlanDay[]>;
  createWeeklyPlanDay(day: InsertWeeklyPlanDay): Promise<WeeklyPlanDay>;
  createWeeklyPlanDays(days: InsertWeeklyPlanDay[]): Promise<WeeklyPlanDay[]>;
  updateWeeklyPlanDay(id: number, data: Partial<InsertWeeklyPlanDay>): Promise<WeeklyPlanDay | undefined>;

  getDailyLog(userId: string, date: string): Promise<DailyLog | undefined>;
  getDailyLogsByWeek(userId: string, weekNumber: number, startDate: string): Promise<DailyLog[]>;
  getDailyLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyLog[]>;
  createDailyLog(log: InsertDailyLog): Promise<DailyLog>;
  updateDailyLog(id: number, data: Partial<InsertDailyLog>): Promise<DailyLog | undefined>;

  getWeeklyReport(userId: string, weekNumber: number): Promise<WeeklyReport | undefined>;
  createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport>;

  getMonthlyReport(userId: string, month: number): Promise<MonthlyReport | undefined>;
  createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport>;

  getRecentWeeklyPlans(userId: string, limit: number): Promise<WeeklyPlan[]>;
  getAllWeeklyPlans(userId: string): Promise<WeeklyPlan[]>;
  hasAnyEatOutScheduled(userId: string): Promise<boolean>;
  countEatOutFocusWeeks(userId: string): Promise<number>;
  hasAnyLateDinnerScheduled(userId: string): Promise<boolean>;
  hasEatOutScheduledSince(userId: string, afterWeekNumber: number): Promise<boolean>;
  hasLateDinnerScheduledSince(userId: string, afterWeekNumber: number): Promise<boolean>;
  countHistoricalEatOutDays(userId: string): Promise<number>;

  getPiggyBankEvent(userId: string, achievementType: string, weekNumber?: number | null, eventDate?: string | null): Promise<PiggyBankEvent | undefined>;
  createPiggyBankEvent(event: InsertPiggyBankEvent): Promise<PiggyBankEvent>;
  addPiggyBankCoins(userId: string, coins: number): Promise<UserProfile | undefined>;
  setPiggyBankReward(userId: string, reward: string): Promise<UserProfile | undefined>;
  claimPiggyBank(userId: string): Promise<UserProfile | undefined>;
  resetUser(userId: string): Promise<void>;
  deleteUserCompletely(userId: string): Promise<Record<string, number>>;

  saveCycleHistory(entry: InsertCycleHistory): Promise<CycleHistoryRow>;
  getCycleHistory(userId: string): Promise<CycleHistoryRow[]>;

  getFoodCombos(foodName: string): Promise<FoodCombo[]>;
  saveFoodCombo(combo: InsertFoodCombo): Promise<FoodCombo>;
  getFoodComboByFullCombo(foodName: string, portionId: string, sauceIds: string[], toppingIds: string[]): Promise<FoodCombo | null>;
  bumpFoodComboUseCount(comboId: number): Promise<void>;
  getIngredientsByAlias(text: string, category: string): Promise<IngredientVocabulary[]>;
  getIngredientByInternalId(internalId: string): Promise<IngredientVocabulary | null>;
  saveIngredient(item: InsertIngredientVocabulary): Promise<IngredientVocabulary>;
  getCachedAdvice(comboKey: string, locale: string): Promise<string | null>;
  saveCachedAdvice(foodName: string, comboKey: string, locale: string, advice: string, adviceSource?: string): Promise<void>;
  getFoodLabelByName(name: string): Promise<FoodLabel | null>;
  getFoodLabelByCombo(name: string, portionId: string, sauceIds: string[], toppingIds: string[]): Promise<FoodLabel | null>;
  saveFoodLabel(label: InsertFoodLabel): Promise<void>;

  // Pre-scheduling dedup (task #500). Used by the OneSignal
  // pre-scheduler to record (and check) whether a given
  // (user, type, local-trigger date) has already been queued.
  // The unique index on those three columns is what guarantees
  // the hourly pass never double-schedules.
  getScheduledNotification(
    userId: string,
    notificationType: string,
    localTriggerDate: string,
  ): Promise<ScheduledNotification | undefined>;
  recordScheduledNotification(
    userId: string,
    notificationType: string,
    localTriggerDate: string,
    sendAtUtc: Date,
    onesignalNotificationId: string | null,
  ): Promise<{ inserted: boolean; row: ScheduledNotification | undefined }>;
  // Reserve-then-send pattern (race-safety): the pre-scheduler
  // first reserves the dedup row with NULL notification id, then
  // sends to OneSignal, then either finalises with the returned id
  // (`setScheduledNotificationId`) or rolls back the reservation
  // (`deleteScheduledNotificationById`) so the next hourly pass
  // gets a fresh attempt.
  setScheduledNotificationId(id: number, onesignalNotificationId: string | null): Promise<void>;
  deleteScheduledNotificationById(id: number): Promise<void>;
  // Boot-time reconciliation (task #507). Returns every
  // scheduled_notifications row whose send_at_utc is still in the
  // future, joined with the user's CURRENT device_timezone so the
  // reconciler can decide whether to cancel-and-requeue (real tz)
  // or leave alone (tz still missing).
  listFutureScheduledForReconciliation(now: Date): Promise<Array<ScheduledNotification & { deviceTimezone: string | null }>>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [created] = await db.insert(userProfiles).values(profile).returning();
    return created;
  }

  async updateProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const [updated] = await db.update(userProfiles).set(data).where(eq(userProfiles.userId, userId)).returning();
    return updated;
  }

  // Idempotent setter for the bridge-reported RevenueCat customerId.
  // Reads first and skips the write when the value is unchanged so we
  // don't churn user_profiles on every login refresh. Trims and rejects
  // empty strings — caller is expected to pass a non-empty value.
  async setRcCustomerId(userId: string, rcCustomerId: string): Promise<void> {
    const trimmed = rcCustomerId.trim();
    if (!trimmed) return;
    const existing = await this.getProfile(userId);
    if (!existing || existing.rcCustomerId === trimmed) return;
    await db.update(userProfiles).set({ rcCustomerId: trimmed }).where(eq(userProfiles.userId, userId));
  }

  async getWeeklyPlan(userId: string, weekNumber: number): Promise<WeeklyPlan | undefined> {
    const [plan] = await db.select().from(weeklyPlans)
      .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.weekNumber, weekNumber)));
    return plan;
  }

  async getWeeklyPlanById(planId: number): Promise<WeeklyPlan | undefined> {
    const [plan] = await db.select().from(weeklyPlans).where(eq(weeklyPlans.id, planId));
    return plan;
  }

  async getWeeklyPlanForDate(userId: string, date: string): Promise<WeeklyPlan | undefined> {
    const [plan] = await db.select().from(weeklyPlans)
      .where(and(
        eq(weeklyPlans.userId, userId),
        lte(weeklyPlans.startDate, date),
      ))
      .orderBy(desc(weeklyPlans.startDate))
      .limit(1);
    return plan;
  }

  async getCurrentWeeklyPlan(userId: string): Promise<WeeklyPlan | undefined> {
    const [plan] = await db.select().from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId))
      .orderBy(desc(weeklyPlans.weekNumber))
      .limit(1);
    return plan;
  }

  async createWeeklyPlan(plan: InsertWeeklyPlan): Promise<WeeklyPlan> {
    const [created] = await db.insert(weeklyPlans).values(plan).returning();
    return created;
  }

  async updateWeeklyPlan(planId: number, data: Partial<InsertWeeklyPlan>): Promise<WeeklyPlan | undefined> {
    const [updated] = await db.update(weeklyPlans).set(data).where(eq(weeklyPlans.id, planId)).returning();
    return updated;
  }

  async getWeeklyPlanDay(planDayId: number): Promise<WeeklyPlanDay | undefined> {
    const [day] = await db.select().from(weeklyPlanDays).where(eq(weeklyPlanDays.id, planDayId));
    return day;
  }

  async getWeeklyPlanDays(weeklyPlanId: number): Promise<WeeklyPlanDay[]> {
    return db.select().from(weeklyPlanDays).where(eq(weeklyPlanDays.weeklyPlanId, weeklyPlanId)).orderBy(weeklyPlanDays.dayOfWeek);
  }

  async createWeeklyPlanDay(day: InsertWeeklyPlanDay): Promise<WeeklyPlanDay> {
    const [created] = await db.insert(weeklyPlanDays).values(day).returning();
    return created;
  }

  async createWeeklyPlanDays(days: InsertWeeklyPlanDay[]): Promise<WeeklyPlanDay[]> {
    if (days.length === 0) return [];
    return db.insert(weeklyPlanDays).values(days).returning();
  }

  async updateWeeklyPlanDay(id: number, data: Partial<InsertWeeklyPlanDay>): Promise<WeeklyPlanDay | undefined> {
    const [updated] = await db.update(weeklyPlanDays).set(data).where(eq(weeklyPlanDays.id, id)).returning();
    return updated;
  }

  async getDailyLog(userId: string, date: string): Promise<DailyLog | undefined> {
    const [log] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
    return log;
  }

  async getDailyLogsByWeek(userId: string, weekNumber: number, startDate: string): Promise<DailyLog[]> {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return this.getDailyLogsByDateRange(userId, startDate, end.toISOString().split("T")[0]);
  }

  async getDailyLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyLog[]> {
    return db.select().from(dailyLogs)
      .where(and(
        eq(dailyLogs.userId, userId),
        gte(dailyLogs.date, startDate),
        lte(dailyLogs.date, endDate),
      ));
  }

  async createDailyLog(log: InsertDailyLog): Promise<DailyLog> {
    const [created] = await db.insert(dailyLogs).values(log).returning();
    return created;
  }

  async updateDailyLog(id: number, data: Partial<InsertDailyLog>): Promise<DailyLog | undefined> {
    const [updated] = await db.update(dailyLogs).set(data).where(eq(dailyLogs.id, id)).returning();
    return updated;
  }

  async getWeeklyReport(userId: string, weekNumber: number): Promise<WeeklyReport | undefined> {
    const [report] = await db.select().from(weeklyReports)
      .where(and(eq(weeklyReports.userId, userId), eq(weeklyReports.weekNumber, weekNumber)));
    return report;
  }

  async createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport> {
    const [created] = await db.insert(weeklyReports).values(report).returning();
    return created;
  }

  async getMonthlyReport(userId: string, month: number): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports)
      .where(and(eq(monthlyReports.userId, userId), eq(monthlyReports.month, month)));
    return report;
  }

  async createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport> {
    const [created] = await db.insert(monthlyReports).values(report).returning();
    return created;
  }

  async getRecentWeeklyPlans(userId: string, limit: number): Promise<WeeklyPlan[]> {
    return db.select().from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId))
      .orderBy(desc(weeklyPlans.weekNumber))
      .limit(limit);
  }

  async getAllWeeklyPlans(userId: string): Promise<WeeklyPlan[]> {
    return db.select().from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId))
      .orderBy(weeklyPlans.weekNumber);
  }

  async hasAnyEatOutScheduled(userId: string): Promise<boolean> {
    const allPlans = await db.select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId));
    if (allPlans.length === 0) return false;
    const planIds = allPlans.map(p => p.id);
    const [row] = await db.select({ id: weeklyPlanDays.id })
      .from(weeklyPlanDays)
      .where(and(
        inArray(weeklyPlanDays.weeklyPlanId, planIds),
        eq(weeklyPlanDays.eatOutScheduled, true),
      ))
      .limit(1);
    return !!row;
  }

  async countEatOutFocusWeeks(userId: string): Promise<number> {
    const plans = await db.select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.dietStruggle, "eat_out"), eq(weeklyPlans.planStruggleCycle, 1)));
    return plans.length;
  }

  async hasAnyLateDinnerScheduled(userId: string): Promise<boolean> {
    const allPlans = await db.select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId));
    if (allPlans.length === 0) return false;
    const planIds = allPlans.map(p => p.id);
    const [row] = await db.select({ id: weeklyPlanDays.id })
      .from(weeklyPlanDays)
      .where(and(
        inArray(weeklyPlanDays.weeklyPlanId, planIds),
        eq(weeklyPlanDays.lateDinnerScheduled, true),
      ))
      .limit(1);
    return !!row;
  }

  async hasEatOutScheduledSince(userId: string, afterWeekNumber: number): Promise<boolean> {
    const plans = await db.select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(and(
        eq(weeklyPlans.userId, userId),
        gt(weeklyPlans.weekNumber, afterWeekNumber),
      ));
    if (plans.length === 0) return false;
    const planIds = plans.map(p => p.id);
    const [row] = await db.select({ id: weeklyPlanDays.id })
      .from(weeklyPlanDays)
      .where(and(
        inArray(weeklyPlanDays.weeklyPlanId, planIds),
        eq(weeklyPlanDays.eatOutScheduled, true),
      ))
      .limit(1);
    return !!row;
  }

  async countHistoricalEatOutDays(userId: string): Promise<number> {
    const allPlans = await db.select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId));
    if (allPlans.length === 0) return 0;
    const planIds = allPlans.map(p => p.id);
    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(weeklyPlanDays)
      .where(and(
        inArray(weeklyPlanDays.weeklyPlanId, planIds),
        eq(weeklyPlanDays.eatOutScheduled, true),
      ));
    return Number(rows[0]?.count ?? 0);
  }

  async hasLateDinnerScheduledSince(userId: string, afterWeekNumber: number): Promise<boolean> {
    const plans = await db.select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(and(
        eq(weeklyPlans.userId, userId),
        gt(weeklyPlans.weekNumber, afterWeekNumber),
      ));
    if (plans.length === 0) return false;
    const planIds = plans.map(p => p.id);
    const [row] = await db.select({ id: weeklyPlanDays.id })
      .from(weeklyPlanDays)
      .where(and(
        inArray(weeklyPlanDays.weeklyPlanId, planIds),
        eq(weeklyPlanDays.lateDinnerScheduled, true),
      ))
      .limit(1);
    return !!row;
  }

  async getPiggyBankEvent(userId: string, achievementType: string, weekNumber?: number | null, eventDate?: string | null): Promise<PiggyBankEvent | undefined> {
    const conditions = [
      eq(piggyBankEvents.userId, userId),
      eq(piggyBankEvents.achievementType, achievementType),
    ];
    if (weekNumber != null) {
      conditions.push(eq(piggyBankEvents.weekNumber, weekNumber));
    }
    if (eventDate != null) {
      conditions.push(eq(piggyBankEvents.eventDate, eventDate));
    }
    const [event] = await db.select().from(piggyBankEvents).where(and(...conditions)).limit(1);
    return event;
  }

  async createPiggyBankEvent(event: InsertPiggyBankEvent): Promise<PiggyBankEvent> {
    const [created] = await db.insert(piggyBankEvents).values(event).returning();
    return created;
  }

  async addPiggyBankCoins(userId: string, coins: number): Promise<UserProfile | undefined> {
    const [updated] = await db.update(userProfiles)
      .set({ piggyBankCoins: sql`LEAST(piggy_bank_coins + ${coins}, 60)` })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async setPiggyBankReward(userId: string, reward: string): Promise<UserProfile | undefined> {
    const [updated] = await db.update(userProfiles)
      .set({ piggyBankReward: reward, piggyBankNeedsRewardSetup: false })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async claimPiggyBank(userId: string): Promise<UserProfile | undefined> {
    const [updated] = await db.update(userProfiles)
      .set({ piggyBankCoins: 0, piggyBankNeedsRewardSetup: true })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async saveCycleHistory(entry: InsertCycleHistory): Promise<CycleHistoryRow> {
    const [created] = await db.insert(cycleHistory)
      .values(entry)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [existing] = await db.select().from(cycleHistory)
      .where(and(eq(cycleHistory.userId, entry.userId), eq(cycleHistory.cycleNumber, entry.cycleNumber)))
      .limit(1);
    return existing;
  }

  async getCycleHistory(userId: string): Promise<CycleHistoryRow[]> {
    return db.select().from(cycleHistory)
      .where(eq(cycleHistory.userId, userId))
      .orderBy(cycleHistory.cycleNumber);
  }

  async resetUser(userId: string): Promise<void> {
    const plans = await db.select({ id: weeklyPlans.id }).from(weeklyPlans).where(eq(weeklyPlans.userId, userId));
    if (plans.length > 0) {
      const planIds = plans.map(p => p.id);
      await db.delete(weeklyPlanDays).where(inArray(weeklyPlanDays.weeklyPlanId, planIds));
    }
    await db.delete(dailyLogs).where(eq(dailyLogs.userId, userId));
    await db.delete(weeklyPlans).where(eq(weeklyPlans.userId, userId));
    await db.delete(weeklyReports).where(eq(weeklyReports.userId, userId));
    await db.delete(monthlyReports).where(eq(monthlyReports.userId, userId));
    await db.delete(piggyBankEvents).where(eq(piggyBankEvents.userId, userId));
    await db.delete(cycleHistory).where(eq(cycleHistory.userId, userId));
    await db.update(userProfiles).set({
      name: null,
      goal: null,
      hba1cLevel: null,
      bloodTestDate: null,
      walksPerWeek: 0,
      walkDuration: 10,
      dinnerTime: "before_9pm",
      sleepPattern: "regular_10_6",
      eatingOutFrequency: "0",
      struggles: [],
      currentStruggle: null,
      hasLateDinner: false,
      restDay: null,
      onboardingComplete: false,
      currentWeek: 1,
      isStretchMode: false,
      stretchSuccessWeeks: 0,
      dinnerMastered: false,
      dinnerSuccessWeeks: 0,
      dinnerExitType: null,
      tipCycleStartWeek: 0,
      tipStayCycles: 0,
      currentTipIndex: 0,
      masteredStruggles: [],
      triedBeforeStruggles: [],
      skippedStruggles: [],
      difficultStruggles: [],
      piggyBankCoins: 0,
      piggyBankReward: null,
      piggyBankNeedsRewardSetup: true,
      repickPending: false,
      eatOutExtendedCommitment: false,
      currentStruggleCycle: 1,
      struggles2: [],
      masteredStruggles2: [],
      skippedStruggles2: [],
      difficultStruggles2: [],
      cycle2Active: null,
      struggles3: [],
      masteredStruggles3: [],
      skippedStruggles3: [],
      difficultStruggles3: [],
      cycle3Active: null,
      hasCreatedFirstWeeklyPlan: false,
      hasTriedFirstFoodSnap: false,
      hasReachedPaywall: false,
      hardLockedAfterAdviceDismiss: false,
      isPremium: false,
    }).where(eq(userProfiles.userId, userId));
  }

  async deleteUserCompletely(userId: string): Promise<Record<string, number>> {
    // Step 1: capture external service IDs BEFORE the delete transaction
    // runs. The transaction below deletes user_profiles, so by the time
    // we try to call OneSignal/RevenueCat the rows would already be gone.
    // If the profile lookup fails, we still proceed with the local delete:
    // external cleanup is best-effort and must not block deletion.
    let onesignalPlayerId: string | null = null;
    let onesignalExternalId: string | null = null;
    try {
      const [p] = await db
        .select({
          playerId: userProfiles.onesignalPlayerId,
          externalId: userProfiles.onesignalExternalId,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      if (p) {
        onesignalPlayerId = p.playerId ?? null;
        onesignalExternalId = p.externalId ?? null;
      }
    } catch (e: any) {
      console.warn(`[deleteUserCompletely] external-id lookup failed for ${userId}: ${e?.message ?? e}`);
    }

    // Step 2: best-effort external cleanup (OneSignal + RevenueCat). Both
    // calls swallow their own errors and never throw. The RC app_user_id
    // is the Replit user id (purchases.login(userId, ...) is called at
    // auth resolve), so we pass userId directly.
    //
    // Ordering note: external cleanup races any immediate re-registration
    // with the same email. That is acceptable - external services are
    // best-effort and registration/login creates fresh subscriber and
    // OneSignal records from scratch, so a re-register would not inherit
    // any deleted state.
    let onesignalResult: { ok: boolean; via: string; status: number | null } = {
      ok: false,
      via: "skipped",
      status: null,
    };
    if (onesignalPlayerId || onesignalExternalId) {
      try {
        onesignalResult = await deleteOneSignalUser({
          externalId: onesignalExternalId,
          playerId: onesignalPlayerId,
        });
      } catch (e: any) {
        console.warn(`[deleteUserCompletely] OneSignal delete threw for ${userId}: ${e?.message ?? e}`);
      }
    }
    let rcResult: { ok: boolean; status: number | null } = { ok: false, status: null };
    try {
      rcResult = await deleteRevenueCatSubscriber(userId);
    } catch (e: any) {
      console.warn(`[deleteUserCompletely] RevenueCat delete threw for ${userId}: ${e?.message ?? e}`);
    }
    console.log(
      `[deleteUserCompletely] external cleanup user=${userId} ` +
        `onesignal={ok=${onesignalResult.ok},via=${onesignalResult.via},status=${onesignalResult.status}} ` +
        `revenuecat={ok=${rcResult.ok},status=${rcResult.status}}`,
    );

    // Step 3: atomic local delete. Every user-scoped table is wiped
    // inside a single transaction so the row in `users` only disappears
    // once everything tied to it (including the live session row) is
    // gone. Sessions are deleted INSIDE this transaction so that, the
    // moment the transaction commits, any cached session cookie on
    // another browser/device is dead server-side.
    return await db.transaction(async (tx) => {
      const counts: Record<string, number> = {};

      const piggy = await tx.delete(piggyBankEvents).where(eq(piggyBankEvents.userId, userId)).returning({ id: piggyBankEvents.id });
      counts.piggy_bank_events = piggy.length;

      const monthly = await tx.delete(monthlyReports).where(eq(monthlyReports.userId, userId)).returning({ id: monthlyReports.id });
      counts.monthly_reports = monthly.length;

      const weekly = await tx.delete(weeklyReports).where(eq(weeklyReports.userId, userId)).returning({ id: weeklyReports.id });
      counts.weekly_reports = weekly.length;

      const logs = await tx.delete(dailyLogs).where(eq(dailyLogs.userId, userId)).returning({ id: dailyLogs.id });
      counts.daily_logs = logs.length;

      const cycles = await tx.delete(cycleHistory).where(eq(cycleHistory.userId, userId)).returning({ id: cycleHistory.id });
      counts.cycle_history = cycles.length;

      // Cancel any pre-scheduled push notifications. Without this,
      // ghost notifications keep firing after the user is gone.
      const scheduled = await tx
        .delete(scheduledNotifications)
        .where(eq(scheduledNotifications.userId, userId))
        .returning({ id: scheduledNotifications.id });
      counts.scheduled_notifications = scheduled.length;

      const planRows = await tx.select({ id: weeklyPlans.id }).from(weeklyPlans).where(eq(weeklyPlans.userId, userId));
      const planIds = planRows.map(p => p.id);
      if (planIds.length > 0) {
        const days = await tx.delete(weeklyPlanDays).where(inArray(weeklyPlanDays.weeklyPlanId, planIds)).returning({ id: weeklyPlanDays.id });
        counts.weekly_plan_days = days.length;
      } else {
        counts.weekly_plan_days = 0;
      }

      const plans = await tx.delete(weeklyPlans).where(eq(weeklyPlans.userId, userId)).returning({ id: weeklyPlans.id });
      counts.weekly_plans = plans.length;

      const profiles = await tx.delete(userProfiles).where(eq(userProfiles.userId, userId)).returning({ id: userProfiles.id });
      counts.user_profiles = profiles.length;

      // Atomic session invalidation. connect-pg-simple stores the
      // session payload as JSON in `sess`; the userId is embedded
      // there as `{"userId":"<uuid>"}`. The LIKE over the JSON text
      // catches every live session row for this user, and runs in
      // the same transaction as the `users` delete, so a token
      // cached on another device cannot make authenticated requests
      // the instant the commit lands.
      const sess = await tx.delete(sessions).where(sql`${sessions.sess}::text LIKE ${'%' + userId + '%'}`).returning({ sid: sessions.sid });
      counts.sessions = sess.length;

      const userDel = await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
      counts.users = userDel.length;

      return counts;
    });
  }


  async getFoodCombos(foodName: string): Promise<FoodCombo[]> {
    const normalised = foodName.trim().toLowerCase();
    return await db.select().from(foodCombos)
      .where(
        or(
          sql`lower(${foodCombos.foodName}) = ${normalised}`,
          sql`lower(${foodCombos.foodNameEn}) = ${normalised}`,
          sql`${normalised} = ANY(SELECT lower(unnest(${foodCombos.foodNameAliases})))`
        )
      )
      .orderBy(desc(foodCombos.useCount), desc(foodCombos.id));
  }

  async saveFoodCombo(combo: InsertFoodCombo): Promise<FoodCombo> {
    const [row] = await db.insert(foodCombos).values(combo).returning();
    return row;
  }

  async getFoodComboByFullCombo(
    foodName: string,
    portionId: string,
    sauceIds: string[],
    toppingIds: string[],
  ): Promise<FoodCombo | null> {
    const candidates = await this.getFoodCombos(foodName);
    if (candidates.length === 0) return null;

    const sortedSauces = [...sauceIds].sort();
    const sortedToppings = [...toppingIds].sort();

    const match = candidates.find(c => {
      if ((c.defaultPortion ?? "") !== (portionId ?? "")) return false;
      const cSauces = [...(c.defaultSauces ?? [])].sort();
      const cToppings = [...(c.defaultToppings ?? [])].sort();
      if (cSauces.length !== sortedSauces.length) return false;
      if (cToppings.length !== sortedToppings.length) return false;
      return cSauces.every((s, i) => s === sortedSauces[i]) &&
        cToppings.every((t, i) => t === sortedToppings[i]);
    });

    return match ?? null;
  }

  async bumpFoodComboUseCount(comboId: number): Promise<void> {
    await db.update(foodCombos)
      .set({ useCount: sql`${foodCombos.useCount} + 1` })
      .where(eq(foodCombos.id, comboId));
  }

  async getIngredientsByAlias(text: string, category: string): Promise<IngredientVocabulary[]> {
    const normalised = text.trim().toLowerCase();
    if (!normalised) return [];
    const all = await db.select().from(ingredientVocabulary)
      .where(eq(ingredientVocabulary.category, category));

    const exact = all.filter(v =>
      v.internalId.toLowerCase() === normalised ||
      v.labelEn.toLowerCase() === normalised ||
      v.labelZh.toLowerCase() === normalised ||
      v.labelYue.toLowerCase() === normalised ||
      (v.aliases ?? []).some(a => a.toLowerCase() === normalised)
    );
    if (exact.length > 0) return exact;

    const fuzzy = all.filter(v => {
      const fields = [v.internalId, v.labelEn, v.labelZh, v.labelYue, ...(v.aliases ?? [])];
      return fields.some(f => {
        const fl = f.toLowerCase();
        return fl.includes(normalised) || normalised.includes(fl);
      });
    });
    return fuzzy;
  }

  async getIngredientByInternalId(internalId: string): Promise<IngredientVocabulary | null> {
    const [row] = await db.select().from(ingredientVocabulary)
      .where(eq(ingredientVocabulary.internalId, internalId));
    return row ?? null;
  }

  async saveIngredient(item: InsertIngredientVocabulary): Promise<IngredientVocabulary> {
    const [row] = await db.insert(ingredientVocabulary).values(item).onConflictDoNothing().returning();
    if (row) return row;
    const [existing] = await db.select().from(ingredientVocabulary)
      .where(eq(ingredientVocabulary.internalId, item.internalId));
    return existing;
  }

  async getCachedAdvice(comboKey: string, locale: string): Promise<string | null> {
    const [row] = await db.select().from(foodAdviceCache)
      .where(and(
        eq(foodAdviceCache.comboKey, comboKey),
        eq(foodAdviceCache.locale, locale)
      ));
    return row?.adviceText ?? null;
  }

  async saveCachedAdvice(foodName: string, comboKey: string, locale: string, advice: string, adviceSource?: string): Promise<void> {
    await db.insert(foodAdviceCache)
      .values({ foodName, comboKey, locale, adviceText: advice, adviceSource: adviceSource ?? "claude" })
      .onConflictDoNothing();
  }

  async getFoodLabelByName(name: string): Promise<FoodLabel | null> {
    const normalised = name.trim().toLowerCase();
    if (!normalised) return null;

    let rows = await db.select().from(foodLabels).where(
      or(
        sql`lower(${foodLabels.foodNameEn}) = ${normalised}`,
        sql`lower(${foodLabels.foodNameZhHant}) = ${normalised}`,
        sql`lower(${foodLabels.foodNameYue}) = ${normalised}`,
      )
    );

    if (rows.length === 0) {
      const normalisedInput = normalizeFoodNameForMatch(name);
      const minLen = /[\u4e00-\u9fff]/.test(normalisedInput) ? 2 : 3;
      if (normalisedInput && normalisedInput.length >= minLen) {
        const all = await db.select().from(foodLabels);
        rows = all.filter((c) =>
          foodNamesMatch(name, c.foodNameEn) ||
          foodNamesMatch(name, c.foodNameZhHant) ||
          foodNamesMatch(name, c.foodNameYue)
        );
      }
    }

    if (rows.length === 0) return null;

    const maxCount = Math.max(...rows.map(r => r.useCount));
    if (maxCount === 0) return rows[Math.floor(Math.random() * rows.length)];
    return rows.reduce((best, r) => r.useCount > best.useCount ? r : best);
  }

  async getFoodLabelByCombo(name: string, portionId: string, sauceIds: string[], toppingIds: string[]): Promise<FoodLabel | null> {
    const normalised = name.trim().toLowerCase();
    if (!normalised) return null;

    const sortedSauces = [...sauceIds].sort();
    const sortedToppings = [...toppingIds].sort();

    const rows = await db.select().from(foodLabels).where(
      or(
        sql`lower(${foodLabels.foodNameEn}) = ${normalised}`,
        sql`lower(${foodLabels.foodNameZhHant}) = ${normalised}`,
        sql`lower(${foodLabels.foodNameYue}) = ${normalised}`,
      )
    );

    const match = rows.find(r => {
      if (r.defaultPortionId !== portionId) return false;
      const rSauces = [...(r.defaultSauces ?? [])].sort();
      const rToppings = [...(r.defaultToppings ?? [])].sort();
      if (rSauces.length !== sortedSauces.length) return false;
      if (rToppings.length !== sortedToppings.length) return false;
      return rSauces.every((s, i) => s === sortedSauces[i]) &&
        rToppings.every((t, i) => t === sortedToppings[i]);
    });

    if (!match) return null;

    await db.update(foodLabels)
      .set({ useCount: sql`${foodLabels.useCount} + 1` })
      .where(eq(foodLabels.internalId, match.internalId));

    return { ...match, useCount: match.useCount + 1 };
  }

  async saveFoodLabel(label: InsertFoodLabel): Promise<void> {
    await db.insert(foodLabels).values(label).onConflictDoNothing();
  }

  async getScheduledNotification(
    userId: string,
    notificationType: string,
    localTriggerDate: string,
  ): Promise<ScheduledNotification | undefined> {
    const [row] = await db.select().from(scheduledNotifications)
      .where(and(
        eq(scheduledNotifications.userId, userId),
        eq(scheduledNotifications.notificationType, notificationType),
        eq(scheduledNotifications.localTriggerDate, localTriggerDate),
      ))
      .limit(1);
    return row;
  }

  async recordScheduledNotification(
    userId: string,
    notificationType: string,
    localTriggerDate: string,
    sendAtUtc: Date,
    onesignalNotificationId: string | null,
  ): Promise<{ inserted: boolean; row: ScheduledNotification | undefined }> {
    // Race-safe: the unique index on
    // (user_id, notification_type, local_trigger_date) guarantees
    // that a concurrent second pass for the same trigger gets a
    // no-op DO NOTHING and the existing row is returned.
    const inserted = await db.insert(scheduledNotifications)
      .values({
        userId,
        notificationType,
        localTriggerDate,
        sendAtUtc,
        onesignalNotificationId,
      })
      .onConflictDoNothing({
        target: [
          scheduledNotifications.userId,
          scheduledNotifications.notificationType,
          scheduledNotifications.localTriggerDate,
        ],
      })
      .returning();
    if (inserted.length > 0) {
      return { inserted: true, row: inserted[0] };
    }
    const existing = await this.getScheduledNotification(userId, notificationType, localTriggerDate);
    return { inserted: false, row: existing };
  }

  async setScheduledNotificationId(id: number, onesignalNotificationId: string | null): Promise<void> {
    await db.update(scheduledNotifications)
      .set({ onesignalNotificationId })
      .where(eq(scheduledNotifications.id, id));
  }

  async deleteScheduledNotificationById(id: number): Promise<void> {
    await db.delete(scheduledNotifications)
      .where(eq(scheduledNotifications.id, id));
  }

  async listFutureScheduledForReconciliation(now: Date): Promise<Array<ScheduledNotification & { deviceTimezone: string | null }>> {
    // LEFT JOIN: a row whose user_profile has been deleted is
    // still surfaced (with deviceTimezone=null), and the
    // reconciler can decide what to do with it. We only return
    // rows whose send_at_utc is strictly future — past rows have
    // either fired already or expired in OneSignal and there's
    // nothing useful to do with them.
    const rows = await db.select({
      id: scheduledNotifications.id,
      userId: scheduledNotifications.userId,
      notificationType: scheduledNotifications.notificationType,
      localTriggerDate: scheduledNotifications.localTriggerDate,
      sendAtUtc: scheduledNotifications.sendAtUtc,
      onesignalNotificationId: scheduledNotifications.onesignalNotificationId,
      createdAt: scheduledNotifications.createdAt,
      deviceTimezone: userProfiles.deviceTimezone,
    })
      .from(scheduledNotifications)
      .leftJoin(userProfiles, eq(scheduledNotifications.userId, userProfiles.userId))
      .where(gt(scheduledNotifications.sendAtUtc, now))
      .orderBy(scheduledNotifications.id);
    return rows.map((r) => ({
      ...r,
      deviceTimezone: r.deviceTimezone ?? null,
    }));
  }
}

export const storage = new DatabaseStorage();
