import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, date, real, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
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
  walksPerWeek: integer("walks_per_week").notNull().default(0),
  walkDuration: integer("walk_duration").notNull().default(10),
  dinnerTime: dinnerTimeEnum("dinner_time").notNull().default("before_9pm"),
  sleepPattern: sleepPatternEnum("sleep_pattern").notNull().default("regular_10_6"),
  eatingOutFrequency: text("eating_out_frequency").notNull().default("0"),
  struggles: text("struggles").array().notNull().default(sql`'{}'::text[]`),
  currentStruggle: text("current_struggle"),
  currentTipIndex: integer("current_tip_index").notNull().default(0),
  hasLateDinner: boolean("has_late_dinner").notNull().default(false),
  dinnerMastered: boolean("dinner_mastered").notNull().default(false),
  dinnerSuccessWeeks: integer("dinner_success_weeks").notNull().default(0),
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
  sugary_food_drink: ["Dilute juice 1:1 with water", "Swap dessert for plain yogurt + berries"],
  oily_fried_food: ["Steam your food first, then sear briefly", "Choose grilled over fried"],
  eat_out: ["Decouple (eat at home first, socialize out)", "Share main dishes", "Swap sides for vegetables"],
  portions: ["Use the plate method (½ veggies, ¼ protein, ¼ carbs)", "Food Switch"],
  snacks: ["Kitchen Closure after dinner", "Switch to edamame or nuts"],
};

export const DIET_TIP_I18N_KEYS: Record<string, string> = {
  "Dilute juice 1:1 with water": "diet_tip.dilute_juice",
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
