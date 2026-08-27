import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, date, real, jsonb, timestamp, serial, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { users, sessions } from "./models/auth";
export type { User, UpsertUser } from "./models/auth";

export const userProfiles = pgTable("user_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  name: text("name"),
  goal: text("goal"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  notificationEmail: text("notification_email"),
  hba1cLevel: real("hba1c_level"),
  bloodTestDate: date("blood_test_date"),
  preferredLanguage: varchar("preferred_language").notNull().default("en"),
  healthCondition: text("health_condition"),
  referralSource: text("referral_source"),
  eatOutExtendedCommitment: boolean("eat_out_extended_commitment").notNull().default(false),
  fontSizePreference: varchar("font_size_preference").notNull().default("small"),
  introSeen: boolean("intro_seen").notNull().default(false),
  // The piggy bank rewards FoodSnap meal logs and HStix readings. It is
  // deliberately independent of the retired weekly-planner progression.
  piggyBankCoins: integer("piggy_bank_coins").notNull().default(0),
  piggyBankReward: text("piggy_bank_reward"),
  piggyBankNeedsRewardSetup: boolean("piggy_bank_needs_reward_setup").notNull().default(true),
  onesignalPlayerId: text("onesignal_player_id"),
  onesignalRegisteredAt: timestamp("onesignal_registered_at"),
  // External ID sent to OneSignal for push targeting.
  onesignalExternalId: text("onesignal_external_id"),
  deviceTimezone: text("device_timezone"),
  lastReengagementNotification: timestamp("last_reengagement_notification"),
  hstixReminderNotificationId: varchar("hstix_reminder_notification_id"),
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

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// Idempotency ledger for active, event-based piggy-bank awards. The
// achievement type includes the source record id (for example snap_42 or
// hstix_17), so a retry cannot award a second coin.
export const piggyBankEvents = pgTable("piggy_bank_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  achievementType: text("achievement_type").notNull(),
  coinsAwarded: integer("coins_awarded").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertPiggyBankEvent = typeof piggyBankEvents.$inferInsert;
export type PiggyBankEvent = typeof piggyBankEvents.$inferSelect;
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
  // Optional so rows written before sweet classification remain readable.
  // Missing values mean unknown; they must not be treated as "not sweet".
  sweetCategory?: SweetCategory;
  isSweet?: boolean;
  suggestedSubtype?: string | null;
  subtypeConfirmed: boolean;
  source: "claude" | "derived";
};

export type SweetCategory = "sweet_drink" | "sweet_food" | null;

export const mealSnaps = pgTable("meal_snaps", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  source: varchar("source"),
  seedBatchId: varchar("seed_batch_id"),
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
  source: varchar("source"),
  seedBatchId: varchar("seed_batch_id"),
  mealSnapId: integer("meal_snap_id"),
  glucoseMmol: real("glucose_mmol").notNull(),
  note: text("note"),
  minutesSinceLastMeal: integer("minutes_since_last_meal"),
  mealTimingConfidence: varchar("meal_timing_confidence", { length: 16 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userRecordedIdx: index("hstix_readings_user_recorded_idx").on(table.userId, table.recordedAt),
  mealIdx: index("hstix_readings_meal_idx").on(table.mealSnapId),
  // PostgreSQL permits multiple NULLs in a unique index, so independent
  // readings stay valid while a meal can own only one canonical reading.
  mealUnique: uniqueIndex("hstix_readings_meal_unique_idx").on(table.mealSnapId),
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

// Retains only the dimensions needed for the rolling report after the
// corresponding meal_snap (and its food/photo data) reaches its 30-day purge.
export const snapReportMealFacts = pgTable("snap_report_meal_facts", {
  snapId: integer("snap_id").primaryKey(),
  userId: varchar("user_id").notNull(),
  localDate: date("local_date", { mode: "string" }).notNull(),
  mealType: text("meal_type"),
  finalImpact: text("final_impact"),
}, (table) => ({
  userDateIdx: index("snap_report_meal_facts_user_date_idx").on(table.userId, table.localDate),
}));

export const snapReportUserMetadata = pgTable("snap_report_user_metadata", {
  userId: varchar("user_id").primaryKey(),
  firstMealLocalDate: date("first_meal_local_date", { mode: "string" }).notNull(),
});

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
