import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, date, real, jsonb, timestamp, pgEnum, serial, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { users, sessions } from "./models/auth";
export type { User, UpsertUser } from "./models/auth";

export const dinnerTimeEnum = pgEnum("dinner_time", ["before_9pm", "after_9pm"]);
export const sleepPatternEnum = pgEnum("sleep_pattern", ["regular_10_6", "other_regular", "night_shifts", "irregular"]);
export const dinnerLabelEnum = pgEnum("dinner_label", ["none", "move_early", "fiber_starter", "dusk_prep", "split_dinner"]);
export const dietResponseEnum = pgEnum("diet_response", ["yes", "no", "no_chance"]);

export const userProfiles = pgTable("user_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  name: text("name"),
  goal: text("goal"),
  walksPerWeek: integer("walks_per_week").notNull().default(0),
  walkDuration: integer("walk_duration").notNull().default(10),
  dinnerTime: dinnerTimeEnum("dinner_time").notNull().default("before_9pm"),
  sleepPattern: sleepPatternEnum("sleep_pattern").notNull().default("regular_10_6"),
  eatingOutFrequency: text("eating_out_frequency").notNull().default("0"),
  struggles: text("struggles").array().notNull().default(sql`'{}'::text[]`),
  hasLateDinner: boolean("has_late_dinner").notNull().default(false),
  dinnerMastered: boolean("dinner_mastered").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  notificationEmail: text("notification_email"),
  restDay: integer("rest_day"),
  currentWeek: integer("current_week").notNull().default(1),
  isStretchMode: boolean("is_stretch_mode").notNull().default(false),
  stretchSuccessWeeks: integer("stretch_success_weeks").notNull().default(0),
  tipCycleStartWeek: integer("tip_cycle_start_week").notNull().default(0),
  tipStayCycles: integer("tip_stay_cycles").notNull().default(0),
  masteredStruggles: text("mastered_struggles").array().notNull().default(sql`'{}'::text[]`),
  triedBeforeStruggles: text("tried_before_struggles").array().notNull().default(sql`'{}'::text[]`),
  skippedStruggles: text("skipped_struggles").array().notNull().default(sql`'{}'::text[]`),
  difficultStruggles: text("difficult_struggles").array().notNull().default(sql`'{}'::text[]`),
  hba1cLevel: real("hba1c_level"),
  bloodTestDate: date("blood_test_date"),
  piggyBankCoins: integer("piggy_bank_coins").notNull().default(0),
  piggyBankReward: text("piggy_bank_reward"),
  piggyBankNeedsRewardSetup: boolean("piggy_bank_needs_reward_setup").notNull().default(true),
  preferredLanguage: varchar("preferred_language").notNull().default("en"),
  dinnerExitType: varchar("dinner_exit_type"),
  repickPending: boolean("repick_pending").notNull().default(false),
  currentStruggleCycle: integer("current_struggle_cycle").notNull().default(1),
  struggles2: text("struggles2").array().notNull().default(sql`'{}'::text[]`),
  masteredStruggles2: text("mastered_struggles2").array().notNull().default(sql`'{}'::text[]`),
  skippedStruggles2: text("skipped_struggles2").array().notNull().default(sql`'{}'::text[]`),
  difficultStruggles2: text("difficult_struggles2").array().notNull().default(sql`'{}'::text[]`),
  cycle2Active: boolean("cycle2_active"),
  struggles3: text("struggles3").array().notNull().default(sql`'{}'::text[]`),
  masteredStruggles3: text("mastered_struggles3").array().notNull().default(sql`'{}'::text[]`),
  skippedStruggles3: text("skipped_struggles3").array().notNull().default(sql`'{}'::text[]`),
  difficultStruggles3: text("difficult_struggles3").array().notNull().default(sql`'{}'::text[]`),
  cycle3Active: boolean("cycle3_active"),
  healthCondition: text("health_condition"),
  referralSource: text("referral_source"),
  eatOutExtendedCommitment: boolean("eat_out_extended_commitment").notNull().default(false),
  fontSizePreference: varchar("font_size_preference").notNull().default("small"),
  introSeen: boolean("intro_seen").notNull().default(false),
  onesignalPlayerId: text("onesignal_player_id"),
  onesignalRegisteredAt: timestamp("onesignal_registered_at"),
  // External ID sent to OneSignal for push targeting.
  onesignalExternalId: text("onesignal_external_id"),
  deviceTimezone: text("device_timezone"),
  lastReengagementNotification: timestamp("last_reengagement_notification"),
  hstixReminderNotificationId: varchar("hstix_reminder_notification_id"),
  hasCreatedFirstWeeklyPlan: boolean("has_created_first_weekly_plan").notNull().default(false),
  hasTriedFirstFoodSnap: boolean("has_tried_first_food_snap").notNull().default(false),
  hasReachedPaywall: boolean("has_reached_paywall").notNull().default(false),
  hardLockedAfterAdviceDismiss: boolean("hard_locked_after_advice_dismiss").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  // RevenueCat customer id for the App Store subscription this Glukky
  // account is currently signed in to. One Apple subscription → one
  // rcCustomerId, shared across every Glukky account that signs in on
  // the same device, so the daily snap quota can be enforced per Apple
  // sub instead of per Glukky user. Nullable: web/dev users with no
  // bridge stay null and fall through to the userId-keyed quota.
  rcCustomerId: text("rc_customer_id"),
  fastingBaselineMmol: real("fasting_baseline_mmol"),
  fastingBaselineEstimated: boolean("fasting_baseline_estimated").notNull().default(false),
  fastingQuestionSeen: boolean("fasting_question_seen").notNull().default(false),
  glucometerNudgeShown: boolean("glucometer_nudge_shown").notNull().default(false),
  consecutiveSkippedMeals: integer("consecutive_skipped_meals").notNull().default(0),
  glucoseGroup: text("glucose_group"),
  glucosePersonalisedSeen: boolean("glucose_personalised_seen").notNull().default(true),
  diabetesMedication: text("diabetes_medication"),
  // Clinical pilot fields — set manually by a clinician after face-to-face enrollment.
  // Never touched by onboarding or any user-facing flow.
  isPilotParticipant: boolean("is_pilot_participant").notNull().default(false),
  pilotEnrolledAt: timestamp("pilot_enrolled_at", { withTimezone: true }),
});

export const weeklyPlans = pgTable("weekly_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  weekNumber: integer("week_number").notNull(),
  startDate: date("start_date").notNull(),
  walkFrequencyGoal: integer("walk_frequency_goal").notNull(),
  walkDurationGoal: integer("walk_duration_goal").notNull(),
  dietStruggle: text("diet_struggle"),
  dietTip: text("diet_tip"),
  isDinnerFocus: boolean("is_dinner_focus").notNull().default(false),
  firstActiveDay: integer("first_active_day").notNull().default(0),
  isStretchWeek: boolean("is_stretch_week").notNull().default(false),
  planStruggleCycle: integer("plan_struggle_cycle").notNull().default(1),
});

export const weeklyPlanDays = pgTable("weekly_plan_days", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  weeklyPlanId: integer("weekly_plan_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  walkScheduled: boolean("walk_scheduled").notNull().default(false),
  eatOutScheduled: boolean("eat_out_scheduled").notNull().default(false),
  lateDinnerScheduled: boolean("late_dinner_scheduled").notNull().default(false),
  dinnerLabel: dinnerLabelEnum("dinner_label").notNull().default("none"),
  walkDuration: integer("walk_duration").notNull().default(10),
  isStretchDay: boolean("is_stretch_day").notNull().default(false),
  standingTap: boolean("standing_tap").notNull().default(false),
});

export const dailyLogs = pgTable("daily_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  date: date("date").notNull(),
  walkCompleted: boolean("walk_completed"),
  walkTired: boolean("walk_tired"),
  dietResponse: dietResponseEnum("diet_response"),
  dinnerSuccess: boolean("dinner_success"),
  isBackfill: boolean("is_backfill").notNull().default(false),
});

export const weeklyReports = pgTable("weekly_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  weekNumber: integer("week_number").notNull(),
  walkSuccessPct: real("walk_success_pct"),
  dietSuccessPct: real("diet_success_pct"),
  dinnerSuccessPct: real("dinner_success_pct"),
  weightedAvg: real("weighted_avg"),
  negotiationResponse: jsonb("negotiation_response"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const monthlyReports = pgTable("monthly_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  month: integer("month").notNull(),
  totalMinutes: integer("total_minutes"),
  dietStruggleStatus: jsonb("diet_struggle_status"),
  dietTipPerformance: jsonb("diet_tip_performance"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const piggyBankEvents = pgTable("piggy_bank_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  achievementType: text("achievement_type").notNull(),
  coinsAwarded: integer("coins_awarded").notNull(),
  description: text("description").notNull(),
  weekNumber: integer("week_number"),
  eventDate: date("event_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cycleHistory = pgTable("cycle_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  startWeek: integer("start_week"),
  endWeek: integer("end_week"),
  strugglesPicked: text("struggles_picked").array().notNull().default(sql`'{}'::text[]`),
  mastered: text("mastered").array().notNull().default(sql`'{}'::text[]`),
  movedOn: text("moved_on").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userCycleUniq: uniqueIndex("cycle_history_user_cycle_uniq").on(table.userId, table.cycleNumber),
}));

export const insertCycleHistorySchema = createInsertSchema(cycleHistory).omit({ id: true, createdAt: true });
export type InsertCycleHistory = z.infer<typeof insertCycleHistorySchema>;
export type CycleHistoryRow = typeof cycleHistory.$inferSelect;

// Pre-scheduling dedup table for OneSignal sends. One row per
// (user, notification type, local-trigger calendar date in the
// user's tz). The unique index is the on-disk guarantee that the
// hourly scheduler pass never double-schedules the same trigger,
// even across restarts and concurrent passes. We also persist the
// OneSignal notification id returned by the POST so a follow-up
// task can cancel a scheduled send when the user becomes
// ineligible (e.g. logs glucose at 9 PM and the 10 PM check-in
// should no longer fire).
export const scheduledNotifications = pgTable("scheduled_notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  notificationType: varchar("notification_type").notNull(),
  localTriggerDate: varchar("local_trigger_date").notNull(),
  sendAtUtc: timestamp("send_at_utc").notNull(),
  onesignalNotificationId: varchar("onesignal_notification_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userTypeDateUniq: uniqueIndex("scheduled_notifications_user_type_date_uniq").on(
    table.userId,
    table.notificationType,
    table.localTriggerDate,
  ),
}));

export const insertScheduledNotificationSchema = createInsertSchema(scheduledNotifications).omit({ id: true, createdAt: true });
export type InsertScheduledNotification = z.infer<typeof insertScheduledNotificationSchema>;
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlans).omit({ id: true });
export const insertWeeklyPlanDaySchema = createInsertSchema(weeklyPlanDays).omit({ id: true });
export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({ id: true });
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true });
export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({ id: true });
export const insertPiggyBankEventSchema = createInsertSchema(piggyBankEvents).omit({ id: true, createdAt: true });

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type WeeklyPlan = typeof weeklyPlans.$inferSelect;
export type InsertWeeklyPlanDay = z.infer<typeof insertWeeklyPlanDaySchema>;
export type WeeklyPlanDay = typeof weeklyPlanDays.$inferSelect;
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertPiggyBankEvent = z.infer<typeof insertPiggyBankEventSchema>;
export type PiggyBankEvent = typeof piggyBankEvents.$inferSelect;

export const STRUGGLE_PRIORITY = [
  "sugary_food_drink",
  "oily_fried_food",
  "eat_out",
  "portions",
  "snacks",
] as const;

export const DIET_TIP_LADDERS: Record<string, string[]> = {
  sugary_food_drink: ["Choose sugar-free drink / Dilute juice 1:1 with water", "Swap dessert for plain yogurt + berries"],
  oily_fried_food: ["Steam your food first, then sear briefly", "Choose grilled over fried"],
  eat_out: ["Decouple (eat at home first, socialize out)", "Share main dishes", "Swap sides for vegetables"],
  portions: ["Use the plate method (½ veggies, ¼ protein, ¼ carbs)", "Food Switch"],
  snacks: ["Kitchen Closure after dinner", "Switch to edamame or nuts"],
};

export const DIET_TIP_I18N_KEYS: Record<string, string> = {
  "Choose sugar-free drink / Dilute juice 1:1 with water": "diet_tip.dilute_juice",
  "Swap dessert for plain yogurt + berries": "diet_tip.swap_dessert",
  "Steam your food first, then sear briefly": "diet_tip.steam_then_sear",
  "Choose grilled over fried": "diet_tip.grilled_over_fried",
  "Decouple (eat at home first, socialize out)": "diet_tip.decouple",
  "Share main dishes": "diet_tip.share_mains",
  "Swap sides for vegetables": "diet_tip.swap_sides_veggies",
  "Use the plate method (½ veggies, ¼ protein, ¼ carbs)": "diet_tip.plate_method",
  "Kitchen Closure after dinner": "diet_tip.kitchen_closure",
  "Switch to edamame or nuts": "diet_tip.switch_edamame_nuts",
  "Food Switch": "diet_tip.food_switch",
};

export const MITIGATION_TRIO = ["fiber_starter", "dusk_prep", "split_dinner"] as const;

export const MITIGATION_TRIO_LABELS: Record<string, string> = {
  fiber_starter: "Fiber Starter — eat veggies first",
  dusk_prep: "Dusk Prep — light snack at 5 PM",
  split_dinner: "Split Dinner — split into two smaller meals",
};

export const ingredientVocabulary = pgTable("ingredient_vocabulary", {
  id: serial("id").primaryKey(),
  internalId: varchar("internal_id").unique().notNull(),
  category: varchar("category").notNull(),
  labelEn: text("label_en").notNull(),
  labelZh: text("label_zh").notNull(),
  labelYue: text("label_yue").notNull(),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
});

export const foodLabels = pgTable("food_labels", {
  id: serial("id").primaryKey(),
  internalId: varchar("internal_id").unique().notNull(),
  foodNameEn: text("food_name_en").notNull(),
  foodNameZhHant: text("food_name_zh_hant").notNull(),
  foodNameYue: text("food_name_yue").notNull(),
  defaultPortionId: varchar("default_portion_id").notNull().default("medium"),
  defaultSauces: text("default_sauces").array().notNull().default(sql`'{}'::text[]`),
  defaultToppings: text("default_toppings").array().notNull().default(sql`'{}'::text[]`),
  foodItems: jsonb("food_items").$type<FoodItemMetadata[] | null>(),
  isSugaryFood: boolean("is_sugary_food").notNull().default(false),
  isSugaryDrink: boolean("is_sugary_drink").notNull().default(false),
  isOily: boolean("is_oily").notNull().default(false),
  isSnack: boolean("is_snack").notNull().default(false),
  useCount: integer("use_count").notNull().default(0),
});

export const foodAdviceCache = pgTable("food_advice_cache", {
  id: serial("id").primaryKey(),
  foodName: text("food_name").notNull(),
  comboKey: varchar("combo_key").notNull(),
  locale: varchar("locale").notNull(),
  adviceText: text("advice_text").notNull(),
  adviceSource: varchar("advice_source").notNull().default("claude"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  comboLocaleUniq: uniqueIndex("food_advice_cache_combo_locale_idx").on(table.comboKey, table.locale),
}));

export const insertIngredientVocabularySchema = createInsertSchema(ingredientVocabulary).omit({ id: true });
export const insertFoodLabelSchema = createInsertSchema(foodLabels).omit({ id: true });
export const insertFoodAdviceCacheSchema = createInsertSchema(foodAdviceCache).omit({ id: true, createdAt: true });

export type IngredientVocabulary = typeof ingredientVocabulary.$inferSelect;
export type InsertIngredientVocabulary = z.infer<typeof insertIngredientVocabularySchema>;
export type FoodLabel = typeof foodLabels.$inferSelect;
export type InsertFoodLabel = z.infer<typeof insertFoodLabelSchema>;
export type FoodAdviceCache = typeof foodAdviceCache.$inferSelect;
export type InsertFoodAdviceCache = z.infer<typeof insertFoodAdviceCacheSchema>;

export type FoodItemMetadata = {
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
  isCarb: boolean;
  carbCategory: string | null;
  carbSubtype: string | null;
  suggestedSubtype?: string | null;
  subtypeConfirmed: boolean;
  source: "claude" | "derived";
};

export const mealSnaps = pgTable("meal_snaps", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  snapTime: timestamp("snap_time", { withTimezone: true }).defaultNow().notNull(),
  localDate: date("local_date", { mode: "string" }).notNull(),
  mealType: text("meal_type"),
  foodName: text("food_name"),
  portion: text("portion"),
  sauces: text("sauces"),
  extras: text("extras"),
  glucoseImpact: text("glucose_impact"),
  missedMealFlag: boolean("missed_meal_flag").notNull().default(false),
  comboKey: text("combo_key"),
  foodItems: jsonb("food_items").$type<FoodItemMetadata[] | null>(),
  postMealGlucoseMmol: real("post_meal_glucose_mmol"),
  postMealSymptom: text("post_meal_symptom"),
  postMealRecordedAt: timestamp("post_meal_recorded_at", { withTimezone: true }),
  postMealSkipped: boolean("post_meal_skipped").notNull().default(false),
  previousMealOverlap: boolean("previous_meal_overlap").notNull().default(false),
  overlapDismissed: boolean("overlap_dismissed").notNull().default(false),
  postMealWalked: boolean("post_meal_walked"),
  isDeleted: boolean("is_deleted").notNull().default(false),
}, (table) => ({
  userDateIdx: index("meal_snaps_user_date_idx").on(table.userId, table.localDate),
}));

export const insertMealSnapSchema = createInsertSchema(mealSnaps).omit({ id: true, snapTime: true });
export type MealSnap = typeof mealSnaps.$inferSelect;
export type InsertMealSnap = z.infer<typeof insertMealSnapSchema>;

export type MealTimingConfidence = "on_time" | "delayed" | "unrelated";

export const hstixReadings = pgTable("hstix_readings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  mealSnapId: integer("meal_snap_id"),
  glucoseMmol: real("glucose_mmol").notNull(),
  note: text("note"),
  minutesSinceLastMeal: integer("minutes_since_last_meal"),
  mealTimingConfidence: varchar("meal_timing_confidence", { length: 16 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userRecordedIdx: index("hstix_readings_user_recorded_idx").on(table.userId, table.recordedAt),
  mealIdx: index("hstix_readings_meal_idx").on(table.mealSnapId),
}));

export const insertHstixReadingSchema = createInsertSchema(hstixReadings).omit({ id: true, recordedAt: true });
export type HstixReading = typeof hstixReadings.$inferSelect;
export type InsertHstixReading = z.infer<typeof insertHstixReadingSchema>;

export const userCarbSubtypePreferences = pgTable("user_carb_subtype_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  foodKey: text("food_key").notNull(),
  carbCategory: varchar("carb_category").notNull(),
  carbSubtype: varchar("carb_subtype").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userFoodCategoryUniq: uniqueIndex("user_carb_subtype_preferences_unique_idx").on(
    table.userId,
    table.foodKey,
    table.carbCategory,
  ),
}));

export const insertUserCarbSubtypePreferenceSchema = createInsertSchema(userCarbSubtypePreferences).omit({ id: true, createdAt: true });
export type UserCarbSubtypePreference = typeof userCarbSubtypePreferences.$inferSelect;
export type InsertUserCarbSubtypePreference = z.infer<typeof insertUserCarbSubtypePreferenceSchema>;

export const snapDailyGlucose = pgTable("snap_daily_glucose", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  localDate: date("local_date", { mode: "string" }).notNull(),
  lowCount: integer("low_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mealCount: integer("meal_count").notNull().default(0),
  hasLateMeal: boolean("has_late_meal").notNull().default(false),
}, (table) => ({
  userDateUniq: uniqueIndex("snap_daily_glucose_user_date_idx").on(table.userId, table.localDate),
}));

export type SnapDailyGlucose = typeof snapDailyGlucose.$inferSelect;
export type InsertSnapDailyGlucose = typeof snapDailyGlucose.$inferInsert;

export const snapMonthlyArchive = pgTable("snap_monthly_archive", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  score: integer("score"),
  signalQuality: integer("signal_quality"),
  timingRegularity: integer("timing_regularity"),
  freqConsistency: integer("freq_consistency"),
  missedMealDays: integer("missed_meal_days"),
  irregularMealDays: integer("irregular_meal_days"),
  stableDays: integer("stable_days"),
  mediumDays: integer("medium_days"),
  highDays: integer("high_days"),
  topHighFood: varchar("top_high_food"),
  topHighFoodCount: integer("top_high_food_count"),
  topLowFood: varchar("top_low_food"),
  topLowFoodCount: integer("top_low_food_count"),
  archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userMonthUniq: uniqueIndex("snap_monthly_archive_user_month_idx").on(table.userId, table.month),
}));

export type SnapMonthlyArchive = typeof snapMonthlyArchive.$inferSelect;
export type InsertSnapMonthlyArchive = typeof snapMonthlyArchive.$inferInsert;

export const userGlucoseThresholds = pgTable("user_glucose_thresholds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  lowMedBoundary: real("low_med_boundary").notNull(),
  medHighBoundary: real("med_high_boundary").notNull(),
  readingCount: integer("reading_count").notNull().default(0),
  isPersonalised: boolean("is_personalised").notNull().default(false),
  firstActivatedAt: timestamp("first_activated_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const insertUserGlucoseThresholdsSchema = createInsertSchema(userGlucoseThresholds).omit({ id: true, updatedAt: true });
export type InsertUserGlucoseThresholds = z.infer<typeof insertUserGlucoseThresholdsSchema>;
export type UserGlucoseThresholds = typeof userGlucoseThresholds.$inferSelect;

const healthHistoryColumns = {
  id: serial("id").primaryKey(),
  originalRecordId: integer("original_record_id").notNull(),
  userId: varchar("user_id").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changeReason: text("change_reason"),
  changedBy: varchar("changed_by").notNull(),
};

export const userProfileHealthHistory = pgTable("user_profile_health_history", healthHistoryColumns);
export const mealSnapHealthHistory = pgTable("meal_snap_health_history", healthHistoryColumns);
export const userGlucoseThresholdsHistory = pgTable("user_glucose_thresholds_history", healthHistoryColumns);

export const insertUserProfileHealthHistorySchema = createInsertSchema(userProfileHealthHistory).omit({ id: true, changedAt: true });
export type InsertUserProfileHealthHistory = z.infer<typeof insertUserProfileHealthHistorySchema>;
export type UserProfileHealthHistory = typeof userProfileHealthHistory.$inferSelect;

export const insertMealSnapHealthHistorySchema = createInsertSchema(mealSnapHealthHistory).omit({ id: true, changedAt: true });
export type InsertMealSnapHealthHistory = z.infer<typeof insertMealSnapHealthHistorySchema>;
export type MealSnapHealthHistory = typeof mealSnapHealthHistory.$inferSelect;

export const insertUserGlucoseThresholdsHistorySchema = createInsertSchema(userGlucoseThresholdsHistory).omit({ id: true, changedAt: true });
export type InsertUserGlucoseThresholdsHistory = z.infer<typeof insertUserGlucoseThresholdsHistorySchema>;
export type UserGlucoseThresholdsHistory = typeof userGlucoseThresholdsHistory.$inferSelect;

// Insert-only audit log for MCHK §5 granular consent.
// Never UPDATE rows — each consent change is a new row.
export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  serviceName: text("service_name").notNull(),
  consented: boolean("consented").notNull(),
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  appVersion: text("app_version"),
});
export type UserConsent = typeof userConsents.$inferSelect;

export const userDataActions = pgTable("user_data_actions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
});

export type UserDataAction = typeof userDataActions.$inferSelect;

export const correctionRequests = pgTable("correction_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  recordType: text("record_type").notNull(),
  approximateDate: date("approximate_date"),
  incorrectValue: text("incorrect_value"),
  correctValue: text("correct_value"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertCorrectionRequestSchema = createInsertSchema(correctionRequests).omit({ id: true, createdAt: true, resolvedAt: true, status: true });
export type InsertCorrectionRequest = z.infer<typeof insertCorrectionRequestSchema>;
export type CorrectionRequest = typeof correctionRequests.$inferSelect;

export const deletionRequests = pgTable("deletion_requests", {
  userId: varchar("user_id").primaryKey(),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  scheduledDeletionAt: timestamp("scheduled_deletion_at").notNull(),
  cancelledAt: timestamp("cancelled_at"),
  immediateDelete: boolean("immediate_delete").notNull().default(false),
});

export type DeletionRequest = typeof deletionRequests.$inferSelect;
