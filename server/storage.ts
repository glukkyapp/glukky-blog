import {
  type UserProfile, type InsertUserProfile,
  type PiggyBankEvent, type InsertPiggyBankEvent,
  type IngredientVocabulary, type InsertIngredientVocabulary,
  type FoodLabel, type InsertFoodLabel,
  type FoodAdviceCache,
  type ScheduledNotification,
  type MealSnap, type InsertMealSnap, type FoodItemMetadata,
  type HstixReading, type InsertHstixReading, type MealTimingConfidence,
  type UserGlucoseThresholds,
  type CorrectionRequest, type InsertCorrectionRequest,
  type DeletionRequest,
  userProfiles,
  piggyBankEvents,
  ingredientVocabulary, foodLabels, foodAdviceCache,
  scheduledNotifications,
  mealSnaps, hstixReadings, snapReportMealFacts, snapReportUserMetadata,
  snapDailyGlucose, snapMonthlyArchive,
  userGlucoseThresholds, userCarbSubtypePreferences,
  userProfileHealthHistory, mealSnapHealthHistory, userGlucoseThresholdsHistory,
  userDataActions, correctionRequests, deletionRequests,
  type SnapMonthlyArchive, type InsertSnapMonthlyArchive,
  users, sessions,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, inArray, gt, or, lt, isNull } from "drizzle-orm";
import { deleteOneSignalUser } from "./onesignal";
import { deleteSubscriber as deleteRevenueCatSubscriber } from "./revenuecat";
import { revokeAppleRefreshToken } from "./apple-auth";
import { HSTIX_CORRECTION_WINDOW_MS } from "./hstix-correction";
import { PHASE1_THRESHOLDS } from "./glucose-thresholds";
import { getMonthlyReportFinalLabel } from "./two-month-report";

export interface IStorage {
  getProfile(userId: string): Promise<UserProfile | undefined>;
  createProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;
  setRcCustomerId(userId: string, rcCustomerId: string): Promise<void>;
  getPiggyBankEvent(userId: string, achievementType: string): Promise<PiggyBankEvent | undefined>;
  createPiggyBankEvent(event: InsertPiggyBankEvent): Promise<PiggyBankEvent>;
  addPiggyBankCoins(userId: string, coins: number): Promise<UserProfile | undefined>;
  setPiggyBankReward(userId: string, reward: string): Promise<UserProfile | undefined>;
  claimPiggyBank(userId: string): Promise<UserProfile | undefined>;

  resetUser(userId: string): Promise<void>;
  deleteUserCompletely(userId: string): Promise<Record<string, number>>;

  getFoodLabelsByName(foodName: string): Promise<FoodLabel[]>;
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
  insertMealSnap(snap: InsertMealSnap): Promise<MealSnap>;
  getMealSnapsForHstixCards(userId: string): Promise<Array<{
    postMealGlucoseMmol: number | null;
    foodItems: FoodItemMetadata[] | null;
    recordedAt: Date;
    mealTimingConfidence: MealTimingConfidence;
    isCanonicalHstix: true;
  }>>;
  getLatestMealSnap(userId: string, before: Date): Promise<{ id: number; snapTime: Date } | null>;
  getMealSnapForHstix(userId: string, snapId: number): Promise<{ id: number; snapTime: Date; localDate: string } | null>;
  insertHstixReading(reading: InsertHstixReading): Promise<HstixReading>;
  getHstixReadingForMealSnap(userId: string, snapId: number): Promise<HstixReading | null>;
  getHstixReadingById(userId: string, readingId: number): Promise<HstixReading | null>;
  getHstixReadingsForMealSnaps(userId: string, snapIds: number[]): Promise<HstixReading[]>;
  listHstixReadings(userId: string, limit?: number): Promise<HstixReading[]>;
  getLatestCorrectableHstixReading(userId: string, now: Date): Promise<HstixReading | null>;
  updateHstixReadingWithinCorrectionWindow(
    id: number,
    userId: string,
    data: { glucoseMmol: number; note: string | null },
    now: Date,
  ): Promise<HstixReading | null>;
  getCarbSubtypePreferences(userId: string, foodKey: string): Promise<Array<{ carbCategory: string; carbSubtype: string }>>;
  saveCarbSubtypePreference(userId: string, foodKey: string, carbCategory: string, carbSubtype: string): Promise<void>;
  updateMealSnapType(snapId: number, userId: string, mealType: string): Promise<void>;
  getMealSnapsByLocalDate(userId: string, localDate: string): Promise<MealSnap[]>;
  getMealSnapsByDateRange(userId: string, startDate: string, endDate: string): Promise<MealSnap[]>;
  getActiveMealSnapsByDateRange(userId: string, startDate: string, endDate: string): Promise<MealSnap[]>;
  getEarliestActiveMealLocalDate(userId: string): Promise<string | null>;
  upsertReportMealFactForSnap(userId: string, snapId: number): Promise<void>;
  backfillReportMealFacts(userId: string): Promise<void>;
  getReportMealFacts(userId: string, startDate: string, endDate: string): Promise<Array<{ localDate: string; mealType: string | null; finalImpact: string | null }>>;
  getReportFirstMealLocalDate(userId: string): Promise<string | null>;
  getMealSnapsForFoodFrequency(userId: string): Promise<MealSnap[]>;
  upsertDailyGlucose(userId: string, localDate: string, counts: { low: number; medium: number; high: number; mealCount: number; hasLateMeal: boolean }): Promise<void>;
  upsertMonthlyArchive(record: InsertSnapMonthlyArchive): Promise<void>;
  getMonthlyArchive(userId: string, month: string): Promise<SnapMonthlyArchive | null>;
  getAllUnarchivedMonths(): Promise<Array<{ userId: string; month: string }>>;
  fetchMealSnapsBeforeDate(cutoff: Date, batchSize: number): Promise<MealSnap[]>;
  purgeMealSnapsByIds(ids: number[]): Promise<void>;

  // Post-meal glucose tracking
  updateMealSnapPostMeal(snapId: number, userId: string, data: { glucoseMmol?: number; symptom?: string; skipped?: boolean; recordedAt?: Date }): Promise<boolean>;
  updateMealSnapPostMealWithHistory(snapId: number, userId: string, data: { glucoseMmol?: number; symptom?: string; skipped?: boolean; recordedAt?: Date; glucoseImpact?: string }): Promise<{ updated: boolean; localDate: string | null }>;
  getPendingPostMealSnap(userId: string): Promise<MealSnap | null>;
  setMealSnapOverlap(snapId: number, userId: string): Promise<void>;
  dismissMealSnapOverlap(snapId: number, userId: string): Promise<boolean>;
  setPostMealWalked(snapId: number, userId: string, walked: boolean): Promise<void>;
  getGlucosePrediction(userId: string, comboKey: string): Promise<{ avgPostMeal: number | null; entryCount: number }>;
  getTotalPairedEntries(userId: string): Promise<number>;
  getTotalSnaps(userId: string): Promise<number>;
  getMealSnapsForGlucosePatterns(userId: string): Promise<Array<{
    foodItems: FoodItemMetadata[] | null;
    isDeleted: boolean;
  }>>;
  expireStalePostMealWindows(): Promise<{ expired: number }>;
  getGlucoseSpikeHistoryByFoodName(userId: string, foodName: string, limit: number): Promise<number[]>;
  getDailyGlucoseForMonth(userId: string, month: string): Promise<Array<{ localDate: string; lowCount: number; mediumCount: number; highCount: number }>>;
  getMonthlySymptomCounts(userId: string, month: string): Promise<{ symptoms: Record<string, number>; totalWithSymptom: number; snackCount: number }>;

  // Glucose threshold system
  getUserGlucoseThresholds(userId: string): Promise<UserGlucoseThresholds | null>;
  upsertUserGlucoseThresholds(data: {
    userId: string;
    lowMedBoundary: number;
    medHighBoundary: number;
    readingCount: number;
    isPersonalised: boolean;
    firstActivatedAt?: Date | null;
  }): Promise<void>;
  getHStixReadingCount(userId: string): Promise<number>;
  getRecentHStixReadings(userId: string): Promise<number[]>;
  reclassifySnapGlucoseImpact(snapId: number, glucoseImpact: string): Promise<string | null>;
  getUsersWithGlucoseGroup(): Promise<Array<{ userId: string; glucoseGroup: string }>>;
  reaggregateDailyGlucoseForDate(userId: string, localDate: string): Promise<void>;
  getHealthHistory(
    kind: "profile" | "meal_snap" | "glucose_thresholds",
    recordId: number,
    userId: string,
  ): Promise<HealthHistoryEntry[] | null>;

  logUserDataAction(userId: string, action: string, ip?: string | null): Promise<void>;
  exportUserData(userId: string): Promise<Record<string, unknown[]>>;
  createCorrectionRequest(userId: string, payload: Omit<InsertCorrectionRequest, "userId">): Promise<CorrectionRequest>;
  getUserCorrectionRequests(userId: string): Promise<CorrectionRequest[]>;
  createDeletionRequest(userId: string): Promise<DeletionRequest>;
  cancelDeletionRequest(userId: string): Promise<void>;
  getDeletionRequest(userId: string): Promise<DeletionRequest | null>;
}

export interface HealthHistoryEntry {
  id: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
  changeReason: string | null;
  changedBy: string;
}

export class DatabaseStorage implements IStorage {
  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [created] = await db.insert(userProfiles).values(profile).returning();
    // Emit initial history rows for any non-null health fields so the audit trail
    // starts from creation, not the first edit.
    const healthEntries = DatabaseStorage.PROFILE_HEALTH_FIELDS
      .filter(f => (created as any)[f] != null)
      .map(f => ({
        originalRecordId: created.id,
        userId: created.userId,
        fieldName: f,
        oldValue: null,
        newValue: String((created as any)[f]),
        changedBy: created.userId,
        changeReason: "initial_value",
      }));
    if (healthEntries.length > 0) {
      await this.writeHealthHistory("profile", healthEntries);
    }
    return created;
  }

  private static readonly PROFILE_HEALTH_FIELDS = [
    "hba1cLevel", "bloodTestDate", "fastingBaselineMmol", "fastingBaselineEstimated", "glucoseGroup",
  ] as const;

  private static readonly HISTORY_TABLE: Record<"profile" | "meal_snap" | "glucose_thresholds", string> = {
    profile: "user_profile_health_history",
    meal_snap: "meal_snap_health_history",
    glucose_thresholds: "user_glucose_thresholds_history",
  };

  private async writeHealthHistory(
    kind: "profile" | "meal_snap" | "glucose_thresholds",
    entries: Array<{
      originalRecordId: number;
      userId: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: string;
      changeReason?: string | null;
    }>,
    executor?: { execute: (query: any) => Promise<any> },
  ): Promise<void> {
    if (entries.length === 0) return;
    const exec = executor ?? db;
    const tableName = DatabaseStorage.HISTORY_TABLE[kind];
    for (const e of entries) {
      await exec.execute(sql`
        INSERT INTO ${sql.raw(tableName)}
          (original_record_id, user_id, field_name, old_value, new_value, changed_at, change_reason, changed_by)
        VALUES
          (${e.originalRecordId}, ${e.userId}, ${e.fieldName},
           ${e.oldValue ?? null}, ${e.newValue ?? null},
           NOW(), ${e.changeReason ?? null}, ${e.changedBy})
      `);
    }
  }

  async updateProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const touchedHealth = DatabaseStorage.PROFILE_HEALTH_FIELDS.filter(f => f in data);
    if (touchedHealth.length === 0) {
      const [updated] = await db.update(userProfiles).set(data).where(eq(userProfiles.userId, userId)).returning();
      return updated;
    }
    // Transaction-couples the history write with the profile update so both
    // succeed or both fail — no orphaned history or silent history gaps.
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      const [updated] = await tx.update(userProfiles).set(data).where(eq(userProfiles.userId, userId)).returning();
      if (current && updated) {
        const entries = touchedHealth
          .filter(f => String((current as any)[f] ?? "") !== String((data as any)[f] ?? ""))
          .map(f => ({
            originalRecordId: current.id,
            userId,
            fieldName: f,
            oldValue: (current as any)[f] != null ? String((current as any)[f]) : null,
            newValue: (data as any)[f] != null ? String((data as any)[f]) : null,
            changedBy: userId,
          }));
        if (entries.length > 0) {
          await this.writeHealthHistory("profile", entries, tx);
        }
      }
      return updated;
    });
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

  async getPiggyBankEvent(userId: string, achievementType: string): Promise<PiggyBankEvent | undefined> {
    const [event] = await db.select().from(piggyBankEvents)
      .where(and(
        eq(piggyBankEvents.userId, userId),
        eq(piggyBankEvents.achievementType, achievementType),
      ))
      .limit(1);
    return event;
  }

  async createPiggyBankEvent(event: InsertPiggyBankEvent): Promise<PiggyBankEvent> {
    const [created] = await db.insert(piggyBankEvents)
      .values(event as typeof piggyBankEvents.$inferInsert)
      .returning();
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

  async resetUser(userId: string): Promise<void> {
    // Write history for ALL health fields being reset before the update.
    // Not wrapped in try/catch — history write failures propagate so the caller
    // knows the audit trail was not written before any data was changed.
    const current = await this.getProfile(userId);
    if (current) {
      // All five fields always get a history row (old may be null) so reset
      // history is exhaustive — one entry per scoped field regardless of value.
      const entries = DatabaseStorage.PROFILE_HEALTH_FIELDS.map(f => ({
        originalRecordId: current.id,
        userId,
        fieldName: f,
        oldValue: (current as any)[f] != null ? String((current as any)[f]) : null,
        newValue: null,
        changedBy: userId,
        changeReason: "user_reset",
      }));
      await this.writeHealthHistory("profile", entries);
    }
    await db.update(userProfiles).set({
      name: null,
      goal: null,
      hba1cLevel: null,
      bloodTestDate: null,
      onboardingComplete: false,
      hasTriedFirstFoodSnap: false,
      hasReachedPaywall: false,
      hardLockedAfterAdviceDismiss: false,
      isPremium: false,
      piggyBankCoins: 0,
      piggyBankReward: null,
      piggyBankNeedsRewardSetup: true,
    }).where(eq(userProfiles.userId, userId));
    await db.delete(piggyBankEvents).where(eq(piggyBankEvents.userId, userId));
  }

  async deleteUserCompletely(userId: string): Promise<Record<string, number>> {
    // Step 1: capture external service IDs BEFORE the delete transaction
    // runs. The transaction below deletes user_profiles (and users), so by
    // the time we try to call OneSignal/RevenueCat/Apple the rows would
    // already be gone. If a lookup fails we still proceed with the local
    // delete: external cleanup is best-effort and must not block deletion.
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

    let appleRefreshToken: string | null = null;
    try {
      const [u] = await db
        .select({ appleRefreshToken: users.appleRefreshToken })
        .from(users)
        .where(eq(users.id, userId));
      if (u) appleRefreshToken = u.appleRefreshToken ?? null;
    } catch (e: any) {
      console.warn(`[deleteUserCompletely] apple-token lookup failed for ${userId}: ${e?.message ?? e}`);
    }

    // Step 2: best-effort external cleanup (OneSignal + RevenueCat + Apple).
    // All calls swallow their own errors and never throw. The RC app_user_id
    // is the Replit user id (purchases.login(userId, ...) is called at auth
    // resolve), so we pass userId directly.
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
    // Apple token revocation — required by Apple guidelines §5.1.1.
    // Silently skipped for email-based accounts or Apple accounts that
    // signed up before refresh-token storage was introduced.
    let appleResult: { ok: boolean; status: number | null } = { ok: false, status: null };
    if (appleRefreshToken) {
      appleResult = await revokeAppleRefreshToken(appleRefreshToken);
    }
    console.log(
      `[deleteUserCompletely] external cleanup user=${userId} ` +
        `onesignal={ok=${onesignalResult.ok},via=${onesignalResult.via},status=${onesignalResult.status}} ` +
        `revenuecat={ok=${rcResult.ok},status=${rcResult.status}} ` +
        `apple={ok=${appleResult.ok},status=${appleResult.status},hadToken=${!!appleRefreshToken}}`,
    );

    // Step 2.5 / Step 3: Soft-delete + terminal history + hard delete, all in one
    // atomic transaction. History and data writes are coupled: if history fails,
    // the deletion rolls back — ensuring the audit trail is never missing entries.
    return await db.transaction(async (tx) => {
      const counts: Record<string, number> = {};

      // --- Terminal history writes (before hard delete so rows still exist) ---

      const [profileRow] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      if (profileRow) {
        // All five fields always get a terminal row regardless of null old values
        // so the deletion trail is exhaustive for medico-legal purposes.
        const profileEntries = DatabaseStorage.PROFILE_HEALTH_FIELDS.map(f => ({
          originalRecordId: profileRow.id,
          userId,
          fieldName: f,
          oldValue: (profileRow as any)[f] != null ? String((profileRow as any)[f]) : null,
          newValue: "DELETED",
          changedBy: userId,
          changeReason: "account_deleted",
        }));
        await this.writeHealthHistory("profile", profileEntries, tx);
      }

      const [threshRow] = await tx.select().from(userGlucoseThresholds).where(eq(userGlucoseThresholds.userId, userId));
      if (threshRow) {
        const threshFields = ["lowMedBoundary", "medHighBoundary", "readingCount", "isPersonalised"] as const;
        const threshEntries = threshFields.map(f => ({
          originalRecordId: threshRow.id,
          userId,
          fieldName: f,
          oldValue: (threshRow as any)[f] != null ? String((threshRow as any)[f]) : null,
          newValue: "DELETED",
          changedBy: userId,
          changeReason: "account_deleted",
        }));
        await this.writeHealthHistory("glucose_thresholds", threshEntries, tx);
      }

      // Bulk-insert terminal history for ALL meal_snaps rows × all 5 health fields.
      // Uses UNION ALL so every row gets a terminal entry for every field, including
      // null/false values — exhaustive coverage required for medico-legal defensibility.
      await tx.execute(sql`
        INSERT INTO meal_snap_health_history
          (original_record_id, user_id, field_name, old_value, new_value, changed_at, change_reason, changed_by)
        SELECT id, user_id, 'postMealGlucoseMmol', post_meal_glucose_mmol::text, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId}
        UNION ALL
        SELECT id, user_id, 'postMealSymptom', post_meal_symptom, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId}
        UNION ALL
        SELECT id, user_id, 'glucoseImpact', glucose_impact, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId}
        UNION ALL
        SELECT id, user_id, 'postMealSkipped', post_meal_skipped::text, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId}
        UNION ALL
        SELECT id, user_id, 'postMealRecordedAt', post_meal_recorded_at::text, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId}
      `);

      // --- Soft-delete before hard delete ---
      await tx.execute(sql`UPDATE meal_snaps SET is_deleted = TRUE WHERE user_id = ${userId}`);
      await tx.execute(sql`UPDATE user_glucose_thresholds SET is_deleted = TRUE WHERE user_id = ${userId}`);

      // These retired planner tables intentionally remain physical database
      // tables until a separately approved migration. They are not part of
      // the runtime schema or exports, but account deletion must still erase
      // a user's legacy planner data.
      await tx.execute(sql`DELETE FROM weekly_plan_days WHERE weekly_plan_id IN (SELECT id FROM weekly_plans WHERE user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM weekly_plans WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM daily_logs WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM weekly_reports WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM monthly_reports WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM cycle_history WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM piggy_bank_events WHERE user_id = ${userId}`);

      // Cancel any pre-scheduled push notifications. Without this,
      // ghost notifications keep firing after the user is gone.
      const scheduled = await tx
        .delete(scheduledNotifications)
        .where(eq(scheduledNotifications.userId, userId))
        .returning({ id: scheduledNotifications.id });
      counts.scheduled_notifications = scheduled.length;

      const snaps = await tx.delete(mealSnaps).where(eq(mealSnaps.userId, userId)).returning({ id: mealSnaps.id });
      counts.meal_snaps = snaps.length;

      await tx.delete(userCarbSubtypePreferences).where(eq(userCarbSubtypePreferences.userId, userId));
      await tx.delete(snapReportMealFacts).where(eq(snapReportMealFacts.userId, userId));
      await tx.delete(snapReportUserMetadata).where(eq(snapReportUserMetadata.userId, userId));

      const dailyGlucose = await tx.delete(snapDailyGlucose).where(eq(snapDailyGlucose.userId, userId)).returning({ id: snapDailyGlucose.id });
      counts.snap_daily_glucose = dailyGlucose.length;

      const thresholds = await tx.delete(userGlucoseThresholds).where(eq(userGlucoseThresholds.userId, userId)).returning({ id: userGlucoseThresholds.id });
      counts.user_glucose_thresholds = thresholds.length;

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


  async getFoodLabelsByName(foodName: string): Promise<FoodLabel[]> {
    const normalised = foodName.trim().toLowerCase();
    if (!normalised) return [];
    return await db.select().from(foodLabels)
      .where(
        or(
          sql`lower(${foodLabels.foodNameEn}) = ${normalised}`,
          sql`lower(${foodLabels.foodNameZhHant}) = ${normalised}`,
          sql`lower(${foodLabels.foodNameYue}) = ${normalised}`,
        )
      )
      .orderBy(desc(foodLabels.useCount), desc(foodLabels.id));
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

    // STRICT exact-match-only lookup (case-insensitive on the three
    // name columns). The previous fuzzy fallback was removed because
    // it conflated materially different dishes:
    // e.g. "Wonton noodles with shrimp" vs "Wonton noodles with choi
    // sum" both stripped to "wonton noodles" and silently swapped one
    // library row's portion / sauces / advice onto the other dish's
    // photo. Product rule: exact name match → most popular combo;
    // anything else → no library hit, fall through to the per-snap
    // labels-only Claude call.
    const rows = await db.select().from(foodLabels).where(
      or(
        sql`lower(${foodLabels.foodNameEn}) = ${normalised}`,
        sql`lower(${foodLabels.foodNameZhHant}) = ${normalised}`,
        sql`lower(${foodLabels.foodNameYue}) = ${normalised}`,
      )
    );

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
    const foodItems = Array.isArray(label.foodItems)
      ? label.foodItems as FoodItemMetadata[]
      : null;
    await db.insert(foodLabels).values({
      ...label,
      foodItems,
    } as typeof foodLabels.$inferInsert).onConflictDoUpdate({
      target: foodLabels.internalId,
      set: { foodItems },
    });
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

  async insertMealSnap(snap: InsertMealSnap): Promise<MealSnap> {
    const [inserted] = await db.insert(mealSnaps).values(snap as typeof mealSnaps.$inferInsert).returning();
    const daySnaps = await db.select({ mealType: mealSnaps.mealType })
      .from(mealSnaps)
      .where(and(eq(mealSnaps.userId, snap.userId), eq(mealSnaps.localDate, snap.localDate)));
    const mainTypes = new Set(
      daySnaps.map(s => s.mealType).filter(t => t === "breakfast" || t === "lunch" || t === "dinner")
    );
    const missed = mainTypes.size < 2;
    await db.update(mealSnaps)
      .set({ missedMealFlag: missed })
      .where(and(eq(mealSnaps.userId, snap.userId), eq(mealSnaps.localDate, snap.localDate)));
    await this.upsertReportMealFactForSnap(snap.userId, inserted.id);
    return { ...inserted, missedMealFlag: missed };
  }

  async getMealSnapsForHstixCards(userId: string): Promise<Array<{
    postMealGlucoseMmol: number | null;
    foodItems: FoodItemMetadata[] | null;
    recordedAt: Date;
    mealTimingConfidence: MealTimingConfidence;
    isCanonicalHstix: true;
  }>> {
    const canonicalRows = await db.select({
      postMealGlucoseMmol: hstixReadings.glucoseMmol,
      foodItems: mealSnaps.foodItems,
      recordedAt: hstixReadings.recordedAt,
      mealTimingConfidence: hstixReadings.mealTimingConfidence,
    }).from(hstixReadings)
      .innerJoin(mealSnaps, and(
        eq(hstixReadings.mealSnapId, mealSnaps.id),
        eq(hstixReadings.userId, mealSnaps.userId),
      ))
      .where(and(
        eq(hstixReadings.userId, userId),
        eq(hstixReadings.mealTimingConfidence, "on_time"),
        eq(mealSnaps.isDeleted, false),
      ));
    return canonicalRows.map(row => ({
      postMealGlucoseMmol: row.postMealGlucoseMmol,
      foodItems: row.foodItems ?? null,
      recordedAt: row.recordedAt,
      mealTimingConfidence: "on_time" as const,
      isCanonicalHstix: true,
    }));
  }

  async getLatestMealSnap(userId: string, before: Date): Promise<{ id: number; snapTime: Date } | null> {
    const [snap] = await db.select({ id: mealSnaps.id, snapTime: mealSnaps.snapTime })
      .from(mealSnaps)
      .where(and(
        eq(mealSnaps.userId, userId),
        eq(mealSnaps.isDeleted, false),
        lte(mealSnaps.snapTime, before),
      ))
      .orderBy(desc(mealSnaps.snapTime))
      .limit(1);
    return snap ?? null;
  }

  async getMealSnapForHstix(userId: string, snapId: number): Promise<{ id: number; snapTime: Date; localDate: string } | null> {
    const [snap] = await db.select({
      id: mealSnaps.id,
      snapTime: mealSnaps.snapTime,
      localDate: mealSnaps.localDate,
    }).from(mealSnaps).where(and(
      eq(mealSnaps.id, snapId),
      eq(mealSnaps.userId, userId),
      eq(mealSnaps.isDeleted, false),
    ));
    return snap ?? null;
  }

  async insertHstixReading(reading: InsertHstixReading): Promise<HstixReading> {
    const [inserted] = await db.insert(hstixReadings)
      .values(reading as typeof hstixReadings.$inferInsert)
      .returning();
    if (inserted.mealSnapId != null) {
      await this.upsertReportMealFactForSnap(inserted.userId, inserted.mealSnapId);
    }
    return inserted;
  }

  async getHstixReadingForMealSnap(userId: string, snapId: number): Promise<HstixReading | null> {
    const [reading] = await db.select().from(hstixReadings).where(and(
      eq(hstixReadings.userId, userId),
      eq(hstixReadings.mealSnapId, snapId),
    )).orderBy(desc(hstixReadings.recordedAt)).limit(1);
    return reading ?? null;
  }

  async getHstixReadingById(userId: string, readingId: number): Promise<HstixReading | null> {
    const [reading] = await db.select().from(hstixReadings).where(and(
      eq(hstixReadings.id, readingId),
      eq(hstixReadings.userId, userId),
    ));
    return reading ?? null;
  }

  async getHstixReadingsForMealSnaps(userId: string, snapIds: number[]): Promise<HstixReading[]> {
    if (snapIds.length === 0) return [];
    return db.select().from(hstixReadings).where(and(
      eq(hstixReadings.userId, userId),
      inArray(hstixReadings.mealSnapId, snapIds),
    )).orderBy(desc(hstixReadings.recordedAt));
  }

  async listHstixReadings(userId: string, limit = 100): Promise<HstixReading[]> {
    return db.select().from(hstixReadings)
      .where(eq(hstixReadings.userId, userId))
      .orderBy(desc(hstixReadings.recordedAt))
      .limit(limit);
  }

  async getLatestCorrectableHstixReading(userId: string, now: Date): Promise<HstixReading | null> {
    const cutoff = new Date(now.getTime() - HSTIX_CORRECTION_WINDOW_MS);
    const [reading] = await db.select().from(hstixReadings)
      .where(and(
        eq(hstixReadings.userId, userId),
        gt(hstixReadings.recordedAt, cutoff),
      ))
      .orderBy(desc(hstixReadings.recordedAt))
      .limit(1);
    return reading ?? null;
  }

  async updateHstixReadingWithinCorrectionWindow(
    id: number,
    userId: string,
    data: { glucoseMmol: number; note: string | null },
    now: Date,
  ): Promise<HstixReading | null> {
    // Keep the expiry condition in the update itself so a request at the exact
    // boundary cannot succeed after a separate eligibility read.
    const cutoff = new Date(now.getTime() - HSTIX_CORRECTION_WINDOW_MS);
    const [reading] = await db.update(hstixReadings)
      .set({ glucoseMmol: data.glucoseMmol, note: data.note })
      .where(and(
        eq(hstixReadings.id, id),
        eq(hstixReadings.userId, userId),
        gt(hstixReadings.recordedAt, cutoff),
      ))
      .returning();
    if (reading?.mealSnapId != null) {
      await this.upsertReportMealFactForSnap(reading.userId, reading.mealSnapId);
    }
    return reading ?? null;
  }

  async getCarbSubtypePreferences(userId: string, foodKey: string): Promise<Array<{ carbCategory: string; carbSubtype: string }>> {
    return db.select({
      carbCategory: userCarbSubtypePreferences.carbCategory,
      carbSubtype: userCarbSubtypePreferences.carbSubtype,
    }).from(userCarbSubtypePreferences).where(and(
      eq(userCarbSubtypePreferences.userId, userId),
      eq(userCarbSubtypePreferences.foodKey, foodKey),
    ));
  }

  async saveCarbSubtypePreference(userId: string, foodKey: string, carbCategory: string, carbSubtype: string): Promise<void> {
    await db.insert(userCarbSubtypePreferences).values({
      userId,
      foodKey,
      carbCategory,
      carbSubtype,
    }).onConflictDoUpdate({
      target: [
        userCarbSubtypePreferences.userId,
        userCarbSubtypePreferences.foodKey,
        userCarbSubtypePreferences.carbCategory,
      ],
      set: { carbSubtype },
    });
  }

  async updateMealSnapType(snapId: number, userId: string, mealType: string): Promise<void> {
    await db.update(mealSnaps)
      .set({ mealType })
      .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)));
    const [snap] = await db.select({ localDate: mealSnaps.localDate })
      .from(mealSnaps)
      .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)))
      .limit(1);
    if (snap) {
      const daySnaps = await db.select({ mealType: mealSnaps.mealType })
        .from(mealSnaps)
        .where(and(eq(mealSnaps.userId, userId), eq(mealSnaps.localDate, snap.localDate)));
      const mainTypes = new Set(
        daySnaps.map(s => s.mealType).filter(t => t === "breakfast" || t === "lunch" || t === "dinner")
      );
      const missed = mainTypes.size < 2;
      await db.update(mealSnaps)
        .set({ missedMealFlag: missed })
        .where(and(eq(mealSnaps.userId, userId), eq(mealSnaps.localDate, snap.localDate)));
    }
    await this.upsertReportMealFactForSnap(userId, snapId);
  }

  async getMealSnapsByLocalDate(userId: string, localDate: string): Promise<MealSnap[]> {
    return db.select().from(mealSnaps)
      .where(and(eq(mealSnaps.userId, userId), eq(mealSnaps.localDate, localDate)))
      .orderBy(mealSnaps.snapTime);
  }

  async getMealSnapsByDateRange(userId: string, startDate: string, endDate: string): Promise<MealSnap[]> {
    return db.select().from(mealSnaps)
      .where(and(
        eq(mealSnaps.userId, userId),
        gte(mealSnaps.localDate, startDate),
        lte(mealSnaps.localDate, endDate),
      ))
      .orderBy(mealSnaps.snapTime);
  }

  async getActiveMealSnapsByDateRange(userId: string, startDate: string, endDate: string): Promise<MealSnap[]> {
    return db.select().from(mealSnaps)
      .where(and(
        eq(mealSnaps.userId, userId),
        eq(mealSnaps.isDeleted, false),
        gte(mealSnaps.localDate, startDate),
        lte(mealSnaps.localDate, endDate),
      ))
      .orderBy(mealSnaps.snapTime);
  }

  async getEarliestActiveMealLocalDate(userId: string): Promise<string | null> {
    const [row] = await db.select({
      localDate: sql<string | null>`MIN(${mealSnaps.localDate})`,
    }).from(mealSnaps).where(and(
      eq(mealSnaps.userId, userId),
      eq(mealSnaps.isDeleted, false),
    ));
    return row?.localDate ?? null;
  }

  async upsertReportMealFactForSnap(userId: string, snapId: number): Promise<void> {
    const [snap] = await db.select().from(mealSnaps).where(and(
      eq(mealSnaps.id, snapId),
      eq(mealSnaps.userId, userId),
      eq(mealSnaps.isDeleted, false),
    )).limit(1);
    if (!snap) return;
    const [profile, thresholds, reading] = await Promise.all([
      this.getProfile(userId),
      this.getUserGlucoseThresholds(userId),
      this.getHstixReadingForMealSnap(userId, snapId),
    ]);
    const finalImpact = getMonthlyReportFinalLabel({
      id: snap.id,
      localDate: snap.localDate,
      mealType: snap.mealType,
      glucoseImpact: snap.glucoseImpact,
      hstix: reading ? {
        glucoseMmol: reading.glucoseMmol,
        mealTimingConfidence: reading.mealTimingConfidence,
      } : null,
    }, profile?.glucoseGroup === "t2dm" ? "t2dm" : "healthy", thresholds
      ? { lowMedBoundary: thresholds.lowMedBoundary, medHighBoundary: thresholds.medHighBoundary }
      : undefined);
    await db.execute(sql`
      INSERT INTO snap_report_meal_facts (snap_id, user_id, local_date, meal_type, final_impact)
      VALUES (${snap.id}, ${userId}, ${snap.localDate}, ${snap.mealType}, ${finalImpact})
      ON CONFLICT (snap_id) DO UPDATE SET
        local_date = EXCLUDED.local_date,
        meal_type = EXCLUDED.meal_type,
        final_impact = EXCLUDED.final_impact
    `);
    await db.execute(sql`
      INSERT INTO snap_report_user_metadata (user_id, first_meal_local_date)
      VALUES (${userId}, ${snap.localDate})
      ON CONFLICT (user_id) DO UPDATE SET
        first_meal_local_date = LEAST(
          snap_report_user_metadata.first_meal_local_date,
          EXCLUDED.first_meal_local_date
        )
    `);
  }

  async backfillReportMealFacts(userId: string): Promise<void> {
    const snaps = await db.select({ id: mealSnaps.id }).from(mealSnaps).where(and(
      eq(mealSnaps.userId, userId),
      eq(mealSnaps.isDeleted, false),
    ));
    for (const snap of snaps) {
      await this.upsertReportMealFactForSnap(userId, snap.id);
    }
  }

  async getReportMealFacts(userId: string, startDate: string, endDate: string): Promise<Array<{ localDate: string; mealType: string | null; finalImpact: string | null }>> {
    return db.select({
      localDate: snapReportMealFacts.localDate,
      mealType: snapReportMealFacts.mealType,
      finalImpact: snapReportMealFacts.finalImpact,
    }).from(snapReportMealFacts).where(and(
      eq(snapReportMealFacts.userId, userId),
      gte(snapReportMealFacts.localDate, startDate),
      lte(snapReportMealFacts.localDate, endDate),
    ));
  }

  async getReportFirstMealLocalDate(userId: string): Promise<string | null> {
    const [row] = await db.select({ localDate: snapReportUserMetadata.firstMealLocalDate })
      .from(snapReportUserMetadata)
      .where(eq(snapReportUserMetadata.userId, userId))
      .limit(1);
    return row?.localDate ?? null;
  }

  async getMealSnapsForFoodFrequency(userId: string): Promise<MealSnap[]> {
    return db.select().from(mealSnaps)
      .where(and(eq(mealSnaps.userId, userId), eq(mealSnaps.isDeleted, false)))
      .orderBy(desc(mealSnaps.snapTime));
  }

  async upsertDailyGlucose(userId: string, localDate: string, counts: { low: number; medium: number; high: number; mealCount: number; hasLateMeal: boolean }): Promise<void> {
    await db.execute(sql`
      INSERT INTO snap_daily_glucose (user_id, local_date, low_count, medium_count, high_count, meal_count, has_late_meal)
      VALUES (${userId}, ${localDate}, ${counts.low}, ${counts.medium}, ${counts.high}, ${counts.mealCount}, ${counts.hasLateMeal})
      ON CONFLICT (user_id, local_date) DO UPDATE SET
        low_count = snap_daily_glucose.low_count + EXCLUDED.low_count,
        medium_count = snap_daily_glucose.medium_count + EXCLUDED.medium_count,
        high_count = snap_daily_glucose.high_count + EXCLUDED.high_count,
        meal_count = snap_daily_glucose.meal_count + EXCLUDED.meal_count,
        has_late_meal = snap_daily_glucose.has_late_meal OR EXCLUDED.has_late_meal
    `);
  }

  async upsertMonthlyArchive(record: InsertSnapMonthlyArchive): Promise<void> {
    await db.execute(sql`
      INSERT INTO snap_monthly_archive (
        user_id, month, score, signal_quality, timing_regularity, freq_consistency,
        missed_meal_days, irregular_meal_days, top_high_food, top_high_food_count,
        top_low_food, top_low_food_count, archived_at
      ) VALUES (
        ${record.userId}, ${record.month}, ${record.score ?? null}, ${record.signalQuality ?? null},
        ${record.timingRegularity ?? null}, ${record.freqConsistency ?? null},
        ${record.missedMealDays ?? null}, ${record.irregularMealDays ?? null},
        ${record.topHighFood ?? null}, ${record.topHighFoodCount ?? null},
        ${record.topLowFood ?? null}, ${record.topLowFoodCount ?? null}, NOW()
      )
      ON CONFLICT (user_id, month) DO UPDATE SET
        score = EXCLUDED.score,
        signal_quality = EXCLUDED.signal_quality,
        timing_regularity = EXCLUDED.timing_regularity,
        freq_consistency = EXCLUDED.freq_consistency,
        missed_meal_days = EXCLUDED.missed_meal_days,
        irregular_meal_days = EXCLUDED.irregular_meal_days,
        top_high_food = EXCLUDED.top_high_food,
        top_high_food_count = EXCLUDED.top_high_food_count,
        top_low_food = EXCLUDED.top_low_food,
        top_low_food_count = EXCLUDED.top_low_food_count,
        archived_at = NOW()
    `);
  }

  async getMonthlyArchive(userId: string, month: string): Promise<SnapMonthlyArchive | null> {
    const [row] = await db.select().from(snapMonthlyArchive)
      .where(and(eq(snapMonthlyArchive.userId, userId), eq(snapMonthlyArchive.month, month)));
    return row ?? null;
  }

  async getAllUnarchivedMonths(): Promise<Array<{ userId: string; month: string }>> {
    const result = await db.execute(sql`
      WITH snap_months AS (
        SELECT DISTINCT user_id, TO_CHAR(local_date::date, 'YYYY-MM') AS month
        FROM meal_snaps
      )
      SELECT sm.user_id AS "userId", sm.month
      FROM snap_months sm
      WHERE NOT EXISTS (
        SELECT 1 FROM snap_monthly_archive sma
        WHERE sma.user_id = sm.user_id AND sma.month = sm.month
      )
      ORDER BY sm.user_id, sm.month ASC
    `);
    return (result.rows as { userId: string; month: string }[]);
  }

  async fetchMealSnapsBeforeDate(cutoff: Date, batchSize: number): Promise<MealSnap[]> {
    return db.select().from(mealSnaps)
      .where(lt(mealSnaps.snapTime, cutoff))
      .orderBy(mealSnaps.snapTime)
      .limit(batchSize);
  }

  async purgeMealSnapsByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(mealSnaps).where(inArray(mealSnaps.id, ids));
  }

  async updateMealSnapPostMeal(snapId: number, userId: string, data: { glucoseMmol?: number; symptom?: string; skipped?: boolean; recordedAt?: Date }): Promise<boolean> {
    const updateData: Record<string, unknown> = {};
    if (data.glucoseMmol !== undefined) updateData.postMealGlucoseMmol = data.glucoseMmol;
    if (data.symptom !== undefined) updateData.postMealSymptom = data.symptom;
    if (data.skipped !== undefined) updateData.postMealSkipped = data.skipped;
    if (data.recordedAt !== undefined) updateData.postMealRecordedAt = data.recordedAt;
    if (Object.keys(updateData).length === 0) return false;

    // Read current snap for history before writing.
    let current: MealSnap | undefined;
    try {
      const [row] = await db.select().from(mealSnaps)
        .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)));
      current = row;
    } catch (_) { /* history pre-read failure is non-fatal */ }

    const result = await db.update(mealSnaps)
      .set(updateData as any)
      .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)))
      .returning({ id: mealSnaps.id });

    if (result.length > 0 && current) {
      try {
        const histEntries: Array<Parameters<typeof this.writeHealthHistory>[1][number]> = [];
        if (data.glucoseMmol !== undefined && current.postMealGlucoseMmol !== data.glucoseMmol) {
          histEntries.push({
            originalRecordId: snapId, userId, fieldName: "postMealGlucoseMmol",
            oldValue: current.postMealGlucoseMmol != null ? String(current.postMealGlucoseMmol) : null,
            newValue: data.glucoseMmol != null ? String(data.glucoseMmol) : null,
            changedBy: userId,
          });
        }
        if (data.symptom !== undefined && current.postMealSymptom !== data.symptom) {
          histEntries.push({
            originalRecordId: snapId, userId, fieldName: "postMealSymptom",
            oldValue: current.postMealSymptom ?? null,
            newValue: data.symptom ?? null,
            changedBy: userId,
          });
        }
        if (data.skipped !== undefined && current.postMealSkipped !== data.skipped) {
          histEntries.push({
            originalRecordId: snapId, userId, fieldName: "postMealSkipped",
            oldValue: String(current.postMealSkipped),
            newValue: String(data.skipped),
            changedBy: userId,
          });
        }
        if (histEntries.length > 0) {
          await this.writeHealthHistory("meal_snap", histEntries);
        }
      } catch (e: any) {
        console.warn("[health-history] updateMealSnapPostMeal write failed:", e?.message ?? e);
      }
    }
    return result.length > 0;
  }

  async updateMealSnapPostMealWithHistory(
    snapId: number,
    userId: string,
    data: { glucoseMmol?: number; symptom?: string; skipped?: boolean; recordedAt?: Date; glucoseImpact?: string },
  ): Promise<{ updated: boolean; localDate: string | null }> {
    const { glucoseImpact, ...snapData } = data;
    const updateData: Record<string, unknown> = {};
    if (snapData.glucoseMmol !== undefined) updateData.postMealGlucoseMmol = snapData.glucoseMmol;
    if (snapData.symptom !== undefined) updateData.postMealSymptom = snapData.symptom;
    if (snapData.skipped !== undefined) updateData.postMealSkipped = snapData.skipped;
    if (snapData.recordedAt !== undefined) updateData.postMealRecordedAt = snapData.recordedAt;
    if (glucoseImpact !== undefined) updateData.glucoseImpact = glucoseImpact;
    if (Object.keys(updateData).length === 0) return { updated: false, localDate: null };

    const outcome = await db.transaction(async (tx) => {
      // Read current state for history.
      const [current] = await tx.select().from(mealSnaps)
        .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)));
      if (!current) return { updated: false, localDate: null };

      const [result] = await tx.update(mealSnaps)
        .set(updateData as any)
        .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)))
        .returning({ localDate: mealSnaps.localDate });
      if (!result) return { updated: false, localDate: null };

      // Build history entries for changed health fields.
      const histEntries: Array<{ originalRecordId: number; userId: string; fieldName: string; oldValue: string | null; newValue: string | null; changedBy: string }> = [];
      const SNAP_HEALTH_FIELDS: Array<[string, keyof typeof current, unknown]> = [
        ["postMealGlucoseMmol", "postMealGlucoseMmol", snapData.glucoseMmol],
        ["postMealSymptom", "postMealSymptom", snapData.symptom],
        ["postMealSkipped", "postMealSkipped", snapData.skipped],
        ["postMealRecordedAt", "postMealRecordedAt", snapData.recordedAt],
        ["glucoseImpact", "glucoseImpact", glucoseImpact],
      ];
      for (const [fieldName, currentKey, newVal] of SNAP_HEALTH_FIELDS) {
        if (newVal === undefined) continue;
        const oldVal = current[currentKey];
        if (String(oldVal ?? "") === String(newVal ?? "")) continue;
        histEntries.push({
          originalRecordId: snapId, userId, fieldName,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          changedBy: userId,
        });
      }
      if (histEntries.length > 0) {
        await this.writeHealthHistory("meal_snap", histEntries, tx);
      }
      return { updated: true, localDate: result.localDate };
    });
    if (outcome.updated && glucoseImpact !== undefined) {
      await this.upsertReportMealFactForSnap(userId, snapId);
    }
    return outcome;
  }

  async getPendingPostMealSnap(userId: string): Promise<MealSnap | null> {
    // HsTix recordable window: 90 min post-meal (separate from the 2-hr meal-gap lookback)
    const cutoff = new Date(Date.now() - 90 * 60 * 1000);
    const [snap] = await db.select()
      .from(mealSnaps)
      .where(and(
        eq(mealSnaps.userId, userId),
        eq(mealSnaps.missedMealFlag, false),
        eq(mealSnaps.postMealSkipped, false),
        isNull(mealSnaps.postMealGlucoseMmol),
        isNull(mealSnaps.postMealSymptom),
        sql`NOT EXISTS (
          SELECT 1 FROM hstix_readings hr
          WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ${mealSnaps.id}
        )`,
        gte(mealSnaps.snapTime, cutoff),
      ))
      .orderBy(desc(mealSnaps.snapTime))
      .limit(1);
    return snap ?? null;
  }

  async setMealSnapOverlap(snapId: number, userId: string): Promise<void> {
    // Idempotent: only updates if not already flagged, safe for retries.
    await db.update(mealSnaps)
      .set({ previousMealOverlap: true })
      .where(and(
        eq(mealSnaps.id, snapId),
        eq(mealSnaps.userId, userId),
        eq(mealSnaps.previousMealOverlap, false),
      ));
  }

  async dismissMealSnapOverlap(snapId: number, userId: string): Promise<boolean> {
    const result = await db.update(mealSnaps)
      .set({ overlapDismissed: true })
      .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)))
      .returning({ id: mealSnaps.id });
    return result.length > 0;
  }

  async setPostMealWalked(snapId: number, userId: string, walked: boolean): Promise<void> {
    await db.update(mealSnaps)
      .set({ postMealWalked: walked })
      .where(and(eq(mealSnaps.id, snapId), eq(mealSnaps.userId, userId)));
  }

  async getGlucosePrediction(userId: string, comboKey: string): Promise<{ avgPostMeal: number | null; entryCount: number }> {
    const result = await db.execute(sql`
      SELECT
        AVG(COALESCE((
          SELECT hr.glucose_mmol FROM hstix_readings hr
          WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
          ORDER BY hr.recorded_at DESC LIMIT 1
        ), ms.post_meal_glucose_mmol)) AS avg_post_meal,
        COUNT(*)::int AS entry_count
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.combo_key = ${comboKey}
        AND COALESCE((
          SELECT hr.glucose_mmol FROM hstix_readings hr
          WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
          ORDER BY hr.recorded_at DESC LIMIT 1
        ), ms.post_meal_glucose_mmol) IS NOT NULL
    `);
    const row = result.rows[0] as any;
    return {
      avgPostMeal: row?.avg_post_meal != null ? parseFloat(row.avg_post_meal) : null,
      entryCount: parseInt(row?.entry_count ?? "0", 10),
    };
  }

  async getTotalPairedEntries(userId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND (
          EXISTS (
            SELECT 1 FROM hstix_readings hr
            WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
          )
          OR ms.post_meal_glucose_mmol IS NOT NULL
          OR ms.post_meal_symptom IS NOT NULL
        )
    `);
    return parseInt((result.rows[0] as any)?.cnt ?? "0", 10);
  }

  async getTotalSnaps(userId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM meal_snaps
      WHERE user_id = ${userId}
    `);
    return parseInt((result.rows[0] as any)?.cnt ?? "0", 10);
  }

  async getMealSnapsForGlucosePatterns(userId: string): Promise<Array<{
    foodItems: FoodItemMetadata[] | null;
    isDeleted: boolean;
  }>> {
    return db.select({
      foodItems: mealSnaps.foodItems,
      isDeleted: mealSnaps.isDeleted,
    }).from(mealSnaps)
      .where(and(eq(mealSnaps.userId, userId), eq(mealSnaps.isDeleted, false)));
  }

  async expireStalePostMealWindows(): Promise<{ expired: number }> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const staleSnaps = await db.select({ userId: mealSnaps.userId, id: mealSnaps.id })
      .from(mealSnaps)
      .where(and(
        eq(mealSnaps.postMealSkipped, false),
        eq(mealSnaps.missedMealFlag, false),
        isNull(mealSnaps.postMealGlucoseMmol),
        isNull(mealSnaps.postMealSymptom),
        sql`NOT EXISTS (
          SELECT 1 FROM hstix_readings hr
          WHERE hr.user_id = ${mealSnaps.userId} AND hr.meal_snap_id = ${mealSnaps.id}
        )`,
        lt(mealSnaps.snapTime, cutoff),
      ));
    if (staleSnaps.length === 0) return { expired: 0 };
    await db.update(mealSnaps)
      .set({ postMealSkipped: true })
      .where(and(
        eq(mealSnaps.postMealSkipped, false),
        eq(mealSnaps.missedMealFlag, false),
        isNull(mealSnaps.postMealGlucoseMmol),
        isNull(mealSnaps.postMealSymptom),
        sql`NOT EXISTS (
          SELECT 1 FROM hstix_readings hr
          WHERE hr.user_id = ${mealSnaps.userId} AND hr.meal_snap_id = ${mealSnaps.id}
        )`,
        lt(mealSnaps.snapTime, cutoff),
      ));
    const userGroups = new Map<string, number>();
    for (const snap of staleSnaps) {
      userGroups.set(snap.userId, (userGroups.get(snap.userId) ?? 0) + 1);
    }
    for (const [uid, count] of userGroups) {
      await db.execute(sql`
        UPDATE user_profiles
        SET consecutive_skipped_meals = consecutive_skipped_meals + ${count}
        WHERE user_id = ${uid}
      `);
    }
    return { expired: staleSnaps.length };
  }

  async getGlucoseSpikeHistoryByFoodName(userId: string, foodName: string, limit: number = 6): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT COALESCE((
        SELECT hr.glucose_mmol FROM hstix_readings hr
        WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
        ORDER BY hr.recorded_at DESC LIMIT 1
      ), ms.post_meal_glucose_mmol) AS post_meal
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.food_name = ${foodName}
        AND COALESCE((
          SELECT hr.glucose_mmol FROM hstix_readings hr
          WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
          ORDER BY hr.recorded_at DESC LIMIT 1
        ), ms.post_meal_glucose_mmol) IS NOT NULL
        AND ms.snap_time >= NOW() - INTERVAL '30 days'
      ORDER BY ms.snap_time ASC
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map(row => parseFloat(row.post_meal));
  }

  async getUserGlucoseThresholds(userId: string): Promise<UserGlucoseThresholds | null> {
    const rows = await db.select().from(userGlucoseThresholds).where(eq(userGlucoseThresholds.userId, userId)).limit(1);
    return rows[0] ?? null;
  }

  async upsertUserGlucoseThresholds(data: {
    userId: string;
    lowMedBoundary: number;
    medHighBoundary: number;
    readingCount: number;
    isPersonalised: boolean;
    firstActivatedAt?: Date | null;
  }): Promise<void> {
    const threshFields = ["lowMedBoundary", "medHighBoundary", "readingCount", "isPersonalised"] as const;
    // Transaction-coupled: history write + upsert in one atomic block.
    await db.transaction(async (tx) => {
      const current = await this.getUserGlucoseThresholds(data.userId);
      await tx.execute(sql`
        INSERT INTO user_glucose_thresholds
          (user_id, low_med_boundary, med_high_boundary, reading_count, is_personalised, first_activated_at, updated_at)
        VALUES
          (${data.userId}, ${data.lowMedBoundary}, ${data.medHighBoundary}, ${data.readingCount}, ${data.isPersonalised}, ${data.firstActivatedAt ?? null}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          low_med_boundary   = EXCLUDED.low_med_boundary,
          med_high_boundary  = EXCLUDED.med_high_boundary,
          reading_count      = EXCLUDED.reading_count,
          is_personalised    = EXCLUDED.is_personalised,
          first_activated_at = COALESCE(user_glucose_thresholds.first_activated_at, EXCLUDED.first_activated_at),
          updated_at         = NOW()
      `);
      // After upsert, read back id for history (on first insert, current.id would be unknown).
      const [after] = await tx.select().from(userGlucoseThresholds).where(eq(userGlucoseThresholds.userId, data.userId));
      if (after) {
        let entries: Array<{ originalRecordId: number; userId: string; fieldName: string; oldValue: string | null; newValue: string | null; changedBy: string; changeReason?: string }>;
        if (!current) {
          // First insert — emit initial_value history for all fields.
          entries = threshFields.map(f => ({
            originalRecordId: after.id,
            userId: data.userId,
            fieldName: f,
            oldValue: null,
            newValue: (data as any)[f] != null ? String((data as any)[f]) : null,
            changedBy: data.userId,
            changeReason: "initial_value",
          }));
        } else {
          // Update — only emit rows where the value changed.
          entries = threshFields
            .filter(f => String((current as any)[f] ?? "") !== String((data as any)[f] ?? ""))
            .map(f => ({
              originalRecordId: after.id,
              userId: data.userId,
              fieldName: f,
              oldValue: (current as any)[f] != null ? String((current as any)[f]) : null,
              newValue: (data as any)[f] != null ? String((data as any)[f]) : null,
              changedBy: data.userId,
            }));
        }
        if (entries.length > 0) {
          await this.writeHealthHistory("glucose_thresholds", entries, tx);
        }
      }
    });
  }

  async getHStixReadingCount(userId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT (
        (SELECT COUNT(*)::int FROM meal_snaps
          WHERE user_id = ${userId}
            AND post_meal_glucose_mmol IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM hstix_readings hr
              WHERE hr.user_id = ${userId} AND hr.meal_snap_id = meal_snaps.id
            )
            AND snap_time >= NOW() - INTERVAL '30 days')
        +
        (SELECT COUNT(*)::int FROM hstix_readings
          WHERE user_id = ${userId}
            AND recorded_at >= NOW() - INTERVAL '30 days')
      )::int AS cnt
    `);
    return parseInt((result.rows[0] as any)?.cnt ?? "0", 10);
  }

  async getRecentHStixReadings(userId: string): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT mmol FROM (
        SELECT post_meal_glucose_mmol AS mmol, COALESCE(post_meal_recorded_at, snap_time) AS recorded_at
        FROM meal_snaps ms
        WHERE ms.user_id = ${userId}
          AND ms.post_meal_glucose_mmol IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM hstix_readings hr
            WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
          )
          AND ms.snap_time >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT glucose_mmol AS mmol, recorded_at
        FROM hstix_readings
        WHERE user_id = ${userId}
          AND recorded_at >= NOW() - INTERVAL '30 days'
      ) all_readings
      ORDER BY recorded_at ASC
    `);
    return (result.rows as any[]).map(row => parseFloat(row.mmol));
  }

  async reclassifySnapGlucoseImpact(snapId: number, glucoseImpact: string): Promise<string | null> {
    // Read current for history before updating.
    let currentSnap: { userId: string; glucoseImpact: string | null } | undefined;
    try {
      const [row] = await db.select({
        userId: mealSnaps.userId,
        glucoseImpact: mealSnaps.glucoseImpact,
      }).from(mealSnaps).where(eq(mealSnaps.id, snapId));
      currentSnap = row;
    } catch (_) { /* non-fatal */ }

    const rows = await db.update(mealSnaps)
      .set({ glucoseImpact })
      .where(eq(mealSnaps.id, snapId))
      .returning({ localDate: mealSnaps.localDate });

    if (rows[0] && currentSnap && currentSnap.glucoseImpact !== glucoseImpact) {
      this.writeHealthHistory("meal_snap", [{
        originalRecordId: snapId,
        userId: currentSnap.userId,
        fieldName: "glucoseImpact",
        oldValue: currentSnap.glucoseImpact ?? null,
        newValue: glucoseImpact,
        changedBy: currentSnap.userId,
      }]).catch(e => console.warn("[health-history] reclassify write failed:", e?.message ?? e));
    }
    if (rows[0] && currentSnap) {
      await this.upsertReportMealFactForSnap(currentSnap.userId, snapId);
    }
    return rows[0]?.localDate ?? null;
  }

  async getHealthHistory(
    kind: "profile" | "meal_snap" | "glucose_thresholds",
    recordId: number,
    userId: string,
  ): Promise<HealthHistoryEntry[] | null> {
    // Verify base-record ownership before returning any history.
    // Returns null when the record does not exist or belongs to a different user
    // (indistinguishable by design for privacy — caller should return 404 for both).
    const ownerCheck = kind === "profile"
      ? await db.execute(sql`SELECT id FROM user_profiles WHERE id = ${recordId} AND user_id = ${userId} LIMIT 1`)
      : kind === "meal_snap"
      ? await db.execute(sql`SELECT id FROM meal_snaps WHERE id = ${recordId} AND user_id = ${userId} LIMIT 1`)
      : await db.execute(sql`SELECT id FROM user_glucose_thresholds WHERE id = ${recordId} AND user_id = ${userId} LIMIT 1`);
    if ((ownerCheck.rows as any[]).length === 0) return null;

    const tableName = DatabaseStorage.HISTORY_TABLE[kind];
    const result = await db.execute(sql`
      SELECT id, field_name, old_value, new_value, changed_at, change_reason, changed_by
      FROM ${sql.raw(tableName)}
      WHERE original_record_id = ${recordId}
        AND user_id = ${userId}
      ORDER BY changed_at DESC
    `);
    return (result.rows as any[]).map(r => ({
      id: r.id,
      fieldName: r.field_name,
      oldValue: r.old_value ?? null,
      newValue: r.new_value ?? null,
      changedAt: new Date(r.changed_at),
      changeReason: r.change_reason ?? null,
      changedBy: r.changed_by,
    }));
  }

  async getUsersWithGlucoseGroup(): Promise<Array<{ userId: string; glucoseGroup: string }>> {
    const result = await db.execute(sql`
      SELECT user_id, glucose_group
      FROM user_profiles
      WHERE glucose_group IS NOT NULL
    `);
    return (result.rows as any[]).map(row => ({
      userId: row.user_id,
      glucoseGroup: row.glucose_group,
    }));
  }

  async reaggregateDailyGlucoseForDate(userId: string, localDate: string): Promise<void> {
    const profile = await this.getProfile(userId);
    const thresholds = PHASE1_THRESHOLDS[profile?.glucoseGroup === "t2dm" ? "t2dm" : "healthy"];
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS meal_count,
        SUM(CASE WHEN effective_mmol <= ${thresholds.lowMedBoundary} THEN 1 ELSE 0 END)::int AS low_count,
        SUM(CASE WHEN effective_mmol > ${thresholds.lowMedBoundary}
                   AND effective_mmol < ${thresholds.medHighBoundary} THEN 1 ELSE 0 END)::int AS medium_count,
        SUM(CASE WHEN effective_mmol >= ${thresholds.medHighBoundary} THEN 1 ELSE 0 END)::int AS high_count
      FROM (
        SELECT COALESCE((
          SELECT hr.glucose_mmol FROM hstix_readings hr
          WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id
          ORDER BY hr.recorded_at DESC LIMIT 1
        ), ms.post_meal_glucose_mmol) AS effective_mmol
        FROM meal_snaps ms
        WHERE ms.user_id = ${userId}
          AND ms.local_date = ${localDate}
          AND ms.missed_meal_flag = false
      ) effective
      WHERE effective_mmol IS NOT NULL
    `);
    const row = result.rows[0] as any;
    if (!row) return;
    const existing = await db.execute(sql`
      SELECT has_late_meal FROM snap_daily_glucose
      WHERE user_id = ${userId} AND local_date = ${localDate}
    `);
    const hasLateMeal = (existing.rows[0] as any)?.has_late_meal ?? false;
    await this.upsertDailyGlucose(userId, localDate, {
      low:       parseInt(row.low_count ?? "0", 10),
      medium:    parseInt(row.medium_count ?? "0", 10),
      high:      parseInt(row.high_count ?? "0", 10),
      mealCount: parseInt(row.meal_count ?? "0", 10),
      hasLateMeal,
    });
  }

  async getDailyGlucoseForMonth(userId: string, month: string): Promise<Array<{ localDate: string; lowCount: number; mediumCount: number; highCount: number }>> {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    const result = await db.execute(sql`
      SELECT local_date, low_count, medium_count, high_count
      FROM snap_daily_glucose
      WHERE user_id = ${userId}
        AND local_date >= ${monthStart}
        AND local_date <= ${monthEnd}
      ORDER BY local_date
    `);
    return (result.rows as any[]).map(row => ({
      localDate: row.local_date,
      lowCount: parseInt(row.low_count, 10),
      mediumCount: parseInt(row.medium_count, 10),
      highCount: parseInt(row.high_count, 10),
    }));
  }

  async getMonthlySymptomCounts(userId: string, month: string): Promise<{ symptoms: Record<string, number>; totalWithSymptom: number; snackCount: number }> {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    const [symptomsResult, snackResult] = await Promise.all([
      db.execute(sql`
        SELECT post_meal_symptom, COUNT(*)::int AS cnt
        FROM meal_snaps
        WHERE user_id = ${userId}
          AND local_date >= ${monthStart}
          AND local_date <= ${monthEnd}
          AND post_meal_symptom IS NOT NULL
        GROUP BY post_meal_symptom
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM meal_snaps
        WHERE user_id = ${userId}
          AND local_date >= ${monthStart}
          AND local_date <= ${monthEnd}
          AND meal_type = 'snack'
      `),
    ]);
    const symptoms: Record<string, number> = {};
    let totalWithSymptom = 0;
    for (const row of symptomsResult.rows as any[]) {
      symptoms[row.post_meal_symptom] = parseInt(row.cnt, 10);
      totalWithSymptom += parseInt(row.cnt, 10);
    }
    const snackCount = parseInt((snackResult.rows[0] as any)?.cnt ?? "0", 10);
    return { symptoms, totalWithSymptom, snackCount };
  }

  async logUserDataAction(userId: string, action: string, ip?: string | null): Promise<void> {
    await db.insert(userDataActions).values({ userId, action, ipAddress: ip ?? null });
  }

  async exportUserData(userId: string): Promise<Record<string, unknown[]>> {
    const [
      userRows, profileRows, mealSnapRows, glucoseThreshRows, dailyGlucoseRows,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)),
      db.select().from(userProfiles).where(eq(userProfiles.userId, userId)),
      db.select().from(mealSnaps).where(eq(mealSnaps.userId, userId)),
      db.select().from(userGlucoseThresholds).where(eq(userGlucoseThresholds.userId, userId)),
      db.select().from(snapDailyGlucose).where(eq(snapDailyGlucose.userId, userId)),
    ]);
    const sessionRows = await db.execute(sql`SELECT sid, expire FROM sessions WHERE sess::text LIKE ${'%' + userId + '%'}`).then(r => r.rows);
    return {
      users: userRows,
      user_profiles: profileRows,
      meal_snaps: mealSnapRows,
      user_glucose_thresholds: glucoseThreshRows,
      snap_daily_glucose: dailyGlucoseRows,
      sessions: sessionRows,
    };
  }

  async createCorrectionRequest(userId: string, payload: Omit<InsertCorrectionRequest, "userId">): Promise<CorrectionRequest> {
    const [created] = await db.insert(correctionRequests).values({ userId, ...payload }).returning();
    return created;
  }

  async getUserCorrectionRequests(userId: string): Promise<CorrectionRequest[]> {
    return db.select().from(correctionRequests)
      .where(eq(correctionRequests.userId, userId))
      .orderBy(desc(correctionRequests.createdAt));
  }

  async createDeletionRequest(userId: string): Promise<DeletionRequest> {
    const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.transaction(async (tx) => {
      await tx.insert(deletionRequests)
        .values({ userId, scheduledDeletionAt })
        .onConflictDoUpdate({
          target: deletionRequests.userId,
          set: { requestedAt: new Date(), scheduledDeletionAt, cancelledAt: null },
        });
      await tx.execute(sql`UPDATE users SET deletion_pending = TRUE WHERE id = ${userId}`);
    });
    const [row] = await db.select().from(deletionRequests).where(eq(deletionRequests.userId, userId));
    return row;
  }

  async cancelDeletionRequest(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(deletionRequests)
        .set({ cancelledAt: new Date() })
        .where(and(eq(deletionRequests.userId, userId), isNull(deletionRequests.cancelledAt)));
      await tx.execute(sql`UPDATE users SET deletion_pending = FALSE WHERE id = ${userId}`);
    });
  }

  async getDeletionRequest(userId: string): Promise<DeletionRequest | null> {
    const [row] = await db.select().from(deletionRequests)
      .where(and(eq(deletionRequests.userId, userId), isNull(deletionRequests.cancelledAt)));
    return row ?? null;
  }
}

export const storage = new DatabaseStorage();
