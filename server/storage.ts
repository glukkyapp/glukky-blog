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
  type FoodLabel, type InsertFoodLabel,
  type FoodAdviceCache,
  type ScheduledNotification,
  type MealSnap, type InsertMealSnap, type FoodItemMetadata,
  type UserGlucoseThresholds,
  type CorrectionRequest, type InsertCorrectionRequest,
  type DeletionRequest,
  userProfiles, weeklyPlans, weeklyPlanDays, dailyLogs, weeklyReports, monthlyReports, piggyBankEvents, cycleHistory,
  ingredientVocabulary, foodLabels, foodAdviceCache,
  scheduledNotifications,
  mealSnaps,
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
  }>>;
  getCarbSubtypePreferences(userId: string, foodKey: string): Promise<Array<{ carbCategory: string; carbSubtype: string }>>;
  saveCarbSubtypePreference(userId: string, foodKey: string, carbCategory: string, carbSubtype: string): Promise<void>;
  updateMealSnapType(snapId: number, userId: string, mealType: string): Promise<void>;
  getMealSnapsByLocalDate(userId: string, localDate: string): Promise<MealSnap[]>;
  getMealSnapsByDateRange(userId: string, startDate: string, endDate: string): Promise<MealSnap[]>;
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
  getGlucosePatterns(userId: string): Promise<{ topList: GlucosePatternEntry[] }>;
  getGlucosePatternDrilldown(userId: string, foodName: string): Promise<GlucoseDrilldownEntry[]>;
  searchGlucosePatternFoods(userId: string, query: string): Promise<GlucosePatternFoodSuggestion[]>;
  getGlucosePatternFoodDetail(userId: string, foodName: string): Promise<GlucosePatternFoodDetail | null>;
  expireStalePostMealWindows(): Promise<{ expired: number }>;
  getGlucoseSpikeHistoryByFoodName(userId: string, foodName: string, limit: number): Promise<number[]>;
  getAiOnlyFoodRanking(userId: string): Promise<AiFoodEntry[]>;
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

export interface AiFoodEntry {
  foodName: string;
  impactLevel: "low" | "medium" | "high";
  snapCount: number;
}

export interface GlucosePatternEntry {
  foodName: string;
  avgPostMealMmol: number;
  readingCount: number;
  hasMultipleCombos: boolean;
}

export interface GlucoseDrilldownEntry {
  comboKey: string | null;
  portion: string | null;
  sauces: string | null;
  extras: string | null;
  avgPostMealMmol: number;
  readingCount: number;
}

export interface GlucosePatternFoodSuggestion {
  foodName: string;
}

export interface GlucosePatternFoodDetail {
  foodName: string;
  avgPostMealMmol: number | null;
  readingCount: number;
  aiImpactLevel: "low" | "medium" | "high" | null;
  readings: Array<{ recordedAt: string; postMealGlucoseMmol: number }>;
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
      hasLateDinner: false,
      restDay: null,
      onboardingComplete: false,
      currentWeek: 1,
      isStretchMode: false,
      stretchSuccessWeeks: 0,
      dinnerMastered: false,
      dinnerExitType: null,
      tipCycleStartWeek: 0,
      tipStayCycles: 0,
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

      const snaps = await tx.delete(mealSnaps).where(eq(mealSnaps.userId, userId)).returning({ id: mealSnaps.id });
      counts.meal_snaps = snaps.length;

      await tx.delete(userCarbSubtypePreferences).where(eq(userCarbSubtypePreferences.userId, userId));

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
    return { ...inserted, missedMealFlag: missed };
  }

  async getMealSnapsForHstixCards(userId: string): Promise<Array<{
    postMealGlucoseMmol: number | null;
    foodItems: FoodItemMetadata[] | null;
    recordedAt: Date;
  }>> {
    return db.select({
      postMealGlucoseMmol: mealSnaps.postMealGlucoseMmol,
      foodItems: mealSnaps.foodItems,
      recordedAt: mealSnaps.postMealRecordedAt,
    }).from(mealSnaps).where(and(
      eq(mealSnaps.userId, userId),
      eq(mealSnaps.isDeleted, false),
    )).then(rows => rows.map(row => ({
      postMealGlucoseMmol: row.postMealGlucoseMmol,
      foodItems: row.foodItems,
      recordedAt: row.recordedAt ?? new Date(0),
    })));
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

    return await db.transaction(async (tx) => {
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
        AVG(ms.post_meal_glucose_mmol) AS avg_post_meal,
        COUNT(*)::int AS entry_count
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.combo_key = ${comboKey}
        AND ms.post_meal_glucose_mmol IS NOT NULL
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
      FROM meal_snaps
      WHERE user_id = ${userId}
        AND (post_meal_glucose_mmol IS NOT NULL OR post_meal_symptom IS NOT NULL)
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

  async getGlucosePatterns(userId: string): Promise<{ topList: GlucosePatternEntry[] }> {
    const result = await db.execute(sql`
      SELECT
        ms.food_name,
        AVG(ms.post_meal_glucose_mmol) AS avg_post_meal,
        COUNT(*)::int AS entry_count,
        COUNT(DISTINCT ms.combo_key)::int AS combo_count
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.post_meal_glucose_mmol IS NOT NULL
        AND ms.food_name IS NOT NULL
      GROUP BY ms.food_name
      ORDER BY avg_post_meal DESC
    `);
    return {
      topList: (result.rows as any[]).map(row => ({
        foodName: row.food_name,
        avgPostMealMmol: parseFloat(row.avg_post_meal),
        readingCount: parseInt(row.entry_count, 10),
        hasMultipleCombos: parseInt(row.combo_count, 10) > 1,
      })),
    };
  }

  async getGlucosePatternDrilldown(userId: string, foodName: string): Promise<GlucoseDrilldownEntry[]> {
    const result = await db.execute(sql`
      SELECT
        ms.combo_key,
        ms.portion,
        ms.sauces,
        ms.extras,
        AVG(ms.post_meal_glucose_mmol) AS avg_post_meal,
        COUNT(*)::int AS entry_count
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.food_name = ${foodName}
        AND ms.post_meal_glucose_mmol IS NOT NULL
      GROUP BY ms.combo_key, ms.portion, ms.sauces, ms.extras
      ORDER BY avg_post_meal DESC
    `);
    return (result.rows as any[]).map(row => ({
      comboKey: row.combo_key ?? null,
      portion: row.portion ?? null,
      sauces: row.sauces ?? null,
      extras: row.extras ?? null,
      avgPostMealMmol: parseFloat(row.avg_post_meal),
      readingCount: parseInt(row.entry_count, 10),
    }));
  }

  async searchGlucosePatternFoods(userId: string, query: string): Promise<GlucosePatternFoodSuggestion[]> {
    const result = await db.execute(sql`
      SELECT ms.food_name, MAX(ms.snap_time) AS latest_snap
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.food_name IS NOT NULL
        AND ms.food_name ILIKE ${`%${query}%`}
      GROUP BY ms.food_name
      ORDER BY latest_snap DESC, ms.food_name ASC
      LIMIT 8
    `);
    return (result.rows as any[]).map(row => ({ foodName: row.food_name }));
  }

  async getGlucosePatternFoodDetail(userId: string, foodName: string): Promise<GlucosePatternFoodDetail | null> {
    const result = await db.execute(sql`
      SELECT
        ms.post_meal_glucose_mmol,
        COALESCE(ms.post_meal_recorded_at, ms.snap_time) AS recorded_at,
        ms.glucose_impact
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.food_name = ${foodName}
      ORDER BY COALESCE(ms.post_meal_recorded_at, ms.snap_time) DESC
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) return null;

    const readings = rows
      .filter(row => row.post_meal_glucose_mmol != null)
      .map(row => ({
        recordedAt: new Date(row.recorded_at).toISOString(),
        postMealGlucoseMmol: parseFloat(row.post_meal_glucose_mmol),
      }));
    const avgPostMealMmol = readings.length > 0
      ? readings.reduce((sum, reading) => sum + reading.postMealGlucoseMmol, 0) / readings.length
      : null;
    const impactScores: number[] = rows
      .map(row => row.glucose_impact === "low" ? 1 : row.glucose_impact === "medium" ? 2 : row.glucose_impact === "high" ? 3 : null)
      .filter((score): score is 1 | 2 | 3 => score != null);
    const avgImpact = impactScores.length > 0
      ? impactScores.reduce((sum, score) => sum + score, 0) / impactScores.length
      : null;

    return {
      foodName,
      avgPostMealMmol,
      readingCount: readings.length,
      aiImpactLevel: avgImpact == null ? null : avgImpact >= 2.5 ? "high" : avgImpact >= 1.5 ? "medium" : "low",
      readings,
    };
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
      SELECT ms.post_meal_glucose_mmol AS post_meal
      FROM meal_snaps ms
      WHERE ms.user_id = ${userId}
        AND ms.food_name = ${foodName}
        AND ms.post_meal_glucose_mmol IS NOT NULL
        AND ms.snap_time >= NOW() - INTERVAL '30 days'
      ORDER BY ms.snap_time ASC
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map(row => parseFloat(row.post_meal));
  }

  async getAiOnlyFoodRanking(userId: string): Promise<AiFoodEntry[]> {
    const result = await db.execute(sql`
      WITH hstix_foods AS (
        SELECT DISTINCT ms2.food_name
        FROM meal_snaps ms2
        WHERE ms2.user_id = ${userId}
          AND ms2.post_meal_glucose_mmol IS NOT NULL
          AND ms2.food_name IS NOT NULL
      )
      SELECT
        ms.food_name,
        AVG(CASE
          WHEN ms.glucose_impact = 'low'    THEN 1
          WHEN ms.glucose_impact = 'medium' THEN 2
          WHEN ms.glucose_impact = 'high'   THEN 3
          ELSE 2
        END)::float AS avg_score,
        COUNT(*)::int AS snap_count
      FROM meal_snaps ms
      LEFT JOIN hstix_foods hf ON ms.food_name = hf.food_name
      WHERE ms.user_id = ${userId}
        AND ms.food_name IS NOT NULL
        AND ms.glucose_impact IS NOT NULL
        AND hf.food_name IS NULL
        AND ms.snap_time >= NOW() - INTERVAL '30 days'
      GROUP BY ms.food_name
      ORDER BY avg_score DESC
    `);
    return (result.rows as any[]).map(row => {
      const score = parseFloat(row.avg_score);
      return {
        foodName: row.food_name,
        snapCount: parseInt(row.snap_count, 10),
        impactLevel: score >= 2.5 ? "high" : score >= 1.5 ? "medium" : "low",
      } as AiFoodEntry;
    });
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
      SELECT COUNT(*)::int AS cnt
      FROM meal_snaps
      WHERE user_id = ${userId}
        AND post_meal_glucose_mmol IS NOT NULL
        AND snap_time >= NOW() - INTERVAL '30 days'
    `);
    return parseInt((result.rows[0] as any)?.cnt ?? "0", 10);
  }

  async getRecentHStixReadings(userId: string): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT post_meal_glucose_mmol AS mmol
      FROM meal_snaps
      WHERE user_id = ${userId}
        AND post_meal_glucose_mmol IS NOT NULL
        AND snap_time >= NOW() - INTERVAL '30 days'
      ORDER BY snap_time ASC
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
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS meal_count,
        SUM(CASE WHEN glucose_impact = 'low' THEN 1 ELSE 0 END)::int AS low_count,
        SUM(CASE WHEN glucose_impact = 'medium' THEN 1 ELSE 0 END)::int AS medium_count,
        SUM(CASE WHEN glucose_impact = 'high' THEN 1 ELSE 0 END)::int AS high_count
      FROM meal_snaps
      WHERE user_id = ${userId}
        AND local_date = ${localDate}
        AND missed_meal_flag = false
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
      dailyLogRows, weeklyPlanRows, weeklyReportRows, monthlyReportRows, cycleHistoryRows,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)),
      db.select().from(userProfiles).where(eq(userProfiles.userId, userId)),
      db.select().from(mealSnaps).where(eq(mealSnaps.userId, userId)),
      db.select().from(userGlucoseThresholds).where(eq(userGlucoseThresholds.userId, userId)),
      db.select().from(snapDailyGlucose).where(eq(snapDailyGlucose.userId, userId)),
      db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId)),
      db.select().from(weeklyPlans).where(eq(weeklyPlans.userId, userId)),
      db.select().from(weeklyReports).where(eq(weeklyReports.userId, userId)),
      db.select().from(monthlyReports).where(eq(monthlyReports.userId, userId)),
      db.select().from(cycleHistory).where(eq(cycleHistory.userId, userId)),
    ]);
    const planIds = weeklyPlanRows.map(p => p.id);
    const [weeklyPlanDayRows, sessionRows] = await Promise.all([
      planIds.length > 0
        ? db.select().from(weeklyPlanDays).where(inArray(weeklyPlanDays.weeklyPlanId, planIds))
        : Promise.resolve([]),
      db.execute(sql`SELECT sid, expire FROM sessions WHERE sess::text LIKE ${'%' + userId + '%'}`).then(r => r.rows),
    ]);
    return {
      users: userRows,
      user_profiles: profileRows,
      meal_snaps: mealSnapRows,
      user_glucose_thresholds: glucoseThreshRows,
      snap_daily_glucose: dailyGlucoseRows,
      daily_logs: dailyLogRows,
      weekly_plans: weeklyPlanRows,
      weekly_plan_days: weeklyPlanDayRows,
      weekly_reports: weeklyReportRows,
      monthly_reports: monthlyReportRows,
      cycle_history: cycleHistoryRows,
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
