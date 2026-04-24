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
  type SubscriptionAlias,
  userProfiles, weeklyPlans, weeklyPlanDays, dailyLogs, weeklyReports, monthlyReports, piggyBankEvents, cycleHistory,
  ingredientVocabulary, foodCombos, foodLabels, foodAdviceCache,
  subscriptionAlias,
  users, sessions,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, inArray, gt, or } from "drizzle-orm";

export interface IStorage {
  getProfile(userId: string): Promise<UserProfile | undefined>;
  createProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;

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
  getIngredientsByAlias(text: string, category: string): Promise<IngredientVocabulary[]>;
  getIngredientByInternalId(internalId: string): Promise<IngredientVocabulary | null>;
  saveIngredient(item: InsertIngredientVocabulary): Promise<IngredientVocabulary>;
  getCachedAdvice(comboKey: string, locale: string): Promise<string | null>;
  saveCachedAdvice(foodName: string, comboKey: string, locale: string, advice: string, adviceSource?: string): Promise<void>;
  getFoodLabelByName(name: string): Promise<FoodLabel | null>;
  getFoodLabelByCombo(name: string, portionId: string, sauceIds: string[], toppingIds: string[]): Promise<FoodLabel | null>;
  saveFoodLabel(label: InsertFoodLabel): Promise<void>;

  // Anonymous-RC-subscriber → Replit-user mapping. Persisted backstop for the
  // self-healing entitlement verifier. Records start as
  // `verified=false` (optimistic, client-supplied anon id) and are
  // promoted to `verified=true` once RevenueCat confirms the alias
  // (REST 2xx, or matching webhook). Self-healing reads ONLY
  // verified rows; unverified rows are kept for diagnostics.
  upsertSubscriptionAlias(
    anonymousAppUserId: string,
    replitUserId: string,
    opts?: { verified?: boolean },
  ): Promise<{ stored: boolean; reason: "ok_new" | "ok_same_owner" | "owner_mismatch" }>;
  markSubscriptionAliasVerified(
    anonymousAppUserId: string,
    replitUserId: string,
  ): Promise<{ updated: boolean }>;
  getSubscriptionAliasIdsForUser(replitUserId: string): Promise<string[]>;
  getReplitUserIdForAnonymous(anonymousAppUserId: string): Promise<string | null>;
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
      isPremium: false,
    }).where(eq(userProfiles.userId, userId));
  }

  async deleteUserCompletely(userId: string): Promise<Record<string, number>> {
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
      );
  }

  async saveFoodCombo(combo: InsertFoodCombo): Promise<FoodCombo> {
    const [row] = await db.insert(foodCombos).values(combo).returning();
    return row;
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

  // Anonymous-RC-subscriber → Replit-user mapping. SECURITY: ownership
  // is enforced atomically in a single SQL statement, race-safe even
  // when two requests for the same anonymous id arrive concurrently.
  //
  // The statement:
  //   - INSERTs when the row does not exist (ok_new)
  //   - UPDATEs `updated_at` when the existing owner matches the
  //     requested owner (ok_same_owner)
  //   - SKIPs the UPDATE when the existing owner differs (the
  //     `WHERE` predicate filters the conflict-resolution row)
  //
  // We then RETURN the stored `replit_user_id`. If that value equals
  // the requested owner, the row was inserted or refreshed — `stored`
  // is true. If RETURNING is empty, the conflict-resolution UPDATE
  // was skipped because the existing owner differed — that's a
  // rejected reassignment, `stored` is false. Either way, no stale
  // ownership is recorded and no claim races the row.
  async upsertSubscriptionAlias(
    anonymousAppUserId: string,
    replitUserId: string,
    opts?: { verified?: boolean },
  ): Promise<{ stored: boolean; reason: "ok_new" | "ok_same_owner" | "owner_mismatch" }> {
    const verified = opts?.verified === true;
    // Snapshot ownership BEFORE the upsert so we can distinguish
    // "ok_new" from "ok_same_owner" in the returned reason. The
    // snapshot is advisory only — the atomic upsert below is the
    // sole source of truth for whether anything was actually written.
    const [pre] = await db
      .select({ replitUserId: subscriptionAlias.replitUserId })
      .from(subscriptionAlias)
      .where(eq(subscriptionAlias.anonymousAppUserId, anonymousAppUserId));

    // For same-owner upserts we want to monotonically promote
    // verified false→true (a successful RC alias confirms an
    // earlier optimistic insert) but never demote true→false
    // (a stale unverified-write must not unverify a row that has
    // already been confirmed).
    const setOnSameOwner = verified
      ? { updatedAt: sql`now()`, verified: sql`true` }
      : { updatedAt: sql`now()` };

    const written = await db.insert(subscriptionAlias)
      .values({ anonymousAppUserId, replitUserId, verified })
      .onConflictDoUpdate({
        target: subscriptionAlias.anonymousAppUserId,
        set: setOnSameOwner,
        // Race-safe ownership guard: the conflict-resolution UPDATE
        // only fires when the existing owner matches the requested
        // owner. A concurrent INSERT by a different owner cannot
        // win this without us seeing a no-rows return.
        setWhere: sql`${subscriptionAlias.replitUserId} = ${replitUserId}`,
      })
      .returning({ replitUserId: subscriptionAlias.replitUserId });

    if (written.length > 0 && written[0].replitUserId === replitUserId) {
      // INSERT succeeded OR the same-owner UPDATE fired. Distinguish
      // the two using the pre-snapshot for accurate telemetry.
      return {
        stored: true,
        reason: pre ? "ok_same_owner" : "ok_new",
      };
    }

    // RETURNING empty (or — defence in depth — returned a row that
    // does NOT belong to us). The atomic guard rejected the write,
    // either because another owner already holds the row or because
    // a concurrent same-owner write raced and kept the old owner.
    const existingOwner = pre?.replitUserId ?? "(unknown)";
    console.warn(
      `[storage.upsertSubscriptionAlias] REJECTED reassignment anon=${anonymousAppUserId} existingOwner=${existingOwner} requestedOwner=${replitUserId}`,
    );
    return { stored: false, reason: "owner_mismatch" };
  }

  // Promotes an existing (anon, replit) row to verified=true after
  // RevenueCat has confirmed the alias. The owner-equality guard is
  // critical: it prevents promoting a row whose owner has been
  // legitimately reassigned (or never existed) just because RC
  // returned 2xx for a different user's call.
  async markSubscriptionAliasVerified(
    anonymousAppUserId: string,
    replitUserId: string,
  ): Promise<{ updated: boolean }> {
    const updated = await db.update(subscriptionAlias)
      .set({ verified: true, updatedAt: sql`now()` })
      .where(
        and(
          eq(subscriptionAlias.anonymousAppUserId, anonymousAppUserId),
          eq(subscriptionAlias.replitUserId, replitUserId),
        ),
      )
      .returning({ anon: subscriptionAlias.anonymousAppUserId });
    return { updated: updated.length > 0 };
  }

  async getSubscriptionAliasIdsForUser(replitUserId: string): Promise<string[]> {
    // Self-healing entitlement reads MUST only return verified
    // mappings. Unverified rows exist purely for diagnostics and
    // could otherwise let a leaked anon id unlock the wrong user.
    const rows = await db.select({ anon: subscriptionAlias.anonymousAppUserId })
      .from(subscriptionAlias)
      .where(
        and(
          eq(subscriptionAlias.replitUserId, replitUserId),
          eq(subscriptionAlias.verified, true),
        ),
      )
      .orderBy(desc(subscriptionAlias.updatedAt));
    return rows.map((r) => r.anon);
  }

  async getReplitUserIdForAnonymous(anonymousAppUserId: string): Promise<string | null> {
    // Same constraint as getSubscriptionAliasIdsForUser: only
    // verified rows count as ownership for entitlement purposes.
    const [row] = await db.select({ replitUserId: subscriptionAlias.replitUserId })
      .from(subscriptionAlias)
      .where(
        and(
          eq(subscriptionAlias.anonymousAppUserId, anonymousAppUserId),
          eq(subscriptionAlias.verified, true),
        ),
      );
    return row?.replitUserId ?? null;
  }
}

export const storage = new DatabaseStorage();
