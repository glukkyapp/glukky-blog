import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { db, pool } from "./db";
import { userProfiles, mealSnaps } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { sendPushNotification, cancelOneSignalNotification } from "./onesignal";
import { CONTENTS, DEV_TEST_TEMPLATES } from "./notifications";
import {
  sortStruggles, getFirstWeekPlan, createWeeklyPlan, getWeeklyReflection,
  generateWeeklyReportData, generateMonthlyReportData,
  processDinnerGraduation, getDinnerGraduationData, checkBiWeeklyTriggers, getStretchProgression,
  getWeekStartDate, evaluateDietStruggle, checkRepickCondition, checkCycle3RepickCondition, checkCurrentCycleRepickCondition,
} from "./engine";
import { DIET_TIP_LADDERS, DIET_TIP_I18N_KEYS, MITIGATION_TRIO_LABELS, STRUGGLE_PRIORITY, type InsertUserProfile } from "@shared/schema";
import type { FoodLabel } from "@shared/schema";
import { pickSources } from "./advice-sources";
import {
  evaluateDailyAchievements,
  evaluateWeeklyAchievements,
  awardStruggleGraduationCoin,
} from "./achievements";
import { canUseFeature, getGateStatus, computePremiumRefreshUpdate } from "./gate";
import { BUILD_INFO } from "./build-info";
import { ensureCompPremium, isCompUserId } from "./comp-emails";
import {
  verifyEntitlement,
  invalidateEntitlementCache,
  applyWebhookEvent,
  fetchSubscriberRaw,
  evaluatePayload,
  getSubscriberEmail,
  aliasSubscriber,
  type RevenueCatWebhookBody,
} from "./revenuecat";
import { sanitizeFoodName, extractJsonObject, stripExtrasContainedInName } from "./snap-parse";
import { trackServer, captureException } from "./posthog";

interface TipEntry { key: string; timing: "immediate" | "future"; }
interface FocusPanelData { struggleKey: string; tips: TipEntry[]; }
interface FoodTags { isSugaryFood: boolean; isSugaryDrink: boolean; isOily: boolean; isSnack: boolean; }

function computeFocusPanel(
  struggle: string,
  tipIndex: number,
  label: FoodLabel | null,
  userPortion: string,
  claudeTags?: FoodTags | null,
): FocusPanelData | null {
  const supported = ["sugary_food_drink", "oily_fried_food", "portions", "snacks"];
  if (!supported.includes(struggle)) return null;

  const tags: FoodTags = label
    ? { isSugaryFood: label.isSugaryFood, isSugaryDrink: label.isSugaryDrink, isOily: label.isOily, isSnack: label.isSnack }
    : claudeTags ?? { isSugaryFood: false, isSugaryDrink: false, isOily: false, isSnack: false };

  if (struggle === "sugary_food_drink") {
    if (!tags.isSugaryFood && !tags.isSugaryDrink) return null;
    const tips: TipEntry[] = [];
    if (tags.isSugaryDrink) tips.push({ key: "diet_tip.dilute_juice", timing: "immediate" });
    if (!tags.isSugaryDrink && tags.isSugaryFood) tips.push({ key: "diet_tip.swap_dessert", timing: "future" });
    return { struggleKey: struggle, tips };
  }

  if (struggle === "oily_fried_food") {
    if (!tags.isOily) return null;
    const tipList = DIET_TIP_LADDERS[struggle] ?? [];
    const tip = tipList[tipIndex] ?? tipList[0];
    const tipKey = DIET_TIP_I18N_KEYS[tip];
    if (!tipKey) return null;
    return { struggleKey: struggle, tips: [{ key: tipKey, timing: "future" }] };
  }

  if (struggle === "portions") {
    if (userPortion !== "large") return null;
    if (tags.isSugaryFood) return null;
    return { struggleKey: struggle, tips: [{ key: "diet_tip.plate_method", timing: "immediate" }] };
  }

  if (struggle === "snacks") {
    if (!tags.isSnack) return null;
    const tipList = DIET_TIP_LADDERS[struggle] ?? [];
    const tip = tipList[tipIndex] ?? tipList[0];
    const tipKey = DIET_TIP_I18N_KEYS[tip];
    if (!tipKey) return null;
    return { struggleKey: struggle, tips: [{ key: tipKey, timing: "future" }] };
  }

  return null;
}

type SnapRow = {
  mealType: string | null;
  snapTime: Date;
  glucoseImpact: string | null;
  localDate: string;
  foodName: string | null;
};

function isIrregularSnap(snap: { mealType: string | null; snapTime: Date | string }, tz?: string | null): boolean {
  if (!snap.mealType || snap.mealType === "snack") return false;
  const snapDate = snap.snapTime instanceof Date ? snap.snapTime : new Date(snap.snapTime as string);
  const hour = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: tz || "UTC",
      hour: "numeric",
      hourCycle: "h23",
    }).format(snapDate),
    10,
  );
  if (snap.mealType === "breakfast") return hour < 7 || hour >= 11;
  if (snap.mealType === "lunch") return hour < 12 || hour >= 14;
  if (snap.mealType === "dinner") return hour < 18 || hour >= 21;
  return false;
}

const HEALTHY_FOOD_LIST: Record<"breakfast" | "lunch" | "dinner" | "snack", string[]> = {
  breakfast: [
    "吞拿魚低脂芝士麥包三文治",
    "番茄肉絲湯通粉",
    "生菜雞絲湯意粉",
    "番茄雞蛋麥包三文治",
    "全麥穀物片（低糖）配脫脂奶",
    "麥皮脫脂奶配紅莓乾及原味果仁",
    "全麥饅頭加鈣無糖豆漿",
  ],
  lunch: [
    "雲吞湯米粉焯菜",
    "白切雞飯焯菜",
    "番茄牛肉飯焯菜",
    "冬瓜海鮮湯飯",
    "野菜豚肉拉麵",
    "蝦餃燒賣牛肉腸粉雞包點心焯菜",
  ],
  dinner: [
    "番茄香茅鮮蝦", "雜菜雞湯", "雪耳雞湯", "豆腐蔬菜湯",
    "西蘭花炒帶子", "蘑菇焗雞", "四蔬炆豬肉", "松子馬蹄碎肉",
    "蘑菇粟米魚柳", "彩蔬拌魚柳", "翡翠蝦餅", "煎釀燈籠椒",
    "果香肉丁", "菇菌炒雜菜", "肉崧蒜茸茄子", "肉崧香葉炒四季豆",
  ],
  snack: [
    "蘋果", "梨", "橙", "奇異果", "提子", "木瓜", "草莓", "蜜柑",
    "低脂低糖果味乳酪", "乾焗原味果仁", "原味餅乾",
  ],
};

const HEALTHY_FOOD_FLAT = new Set(
  (Object.values(HEALTHY_FOOD_LIST) as string[][]).flat()
);

function isHealthyFood(foodName: string | null): boolean {
  if (!foodName) return false;
  const name = foodName.trim();
  for (const h of HEALTHY_FOOD_FLAT) {
    if (name.includes(h) || h.includes(name)) return true;
  }
  return false;
}

function foodWordMatch(a: string, b: string): number {
  const setA = new Set([...a]);
  let score = 0;
  for (const ch of b) {
    if (setA.has(ch) && /\p{Script=Han}/u.test(ch)) score++;
  }
  return score;
}

function pickRecommendation(mealType: string, worstFoodName: string | null): string | null {
  const key = mealType as keyof typeof HEALTHY_FOOD_LIST;
  const list = HEALTHY_FOOD_LIST[key];
  if (!list || list.length === 0) return null;
  if (!worstFoodName) return null;
  const scored = list.map(f => ({ f, score: foodWordMatch(worstFoodName, f) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].f : null;
}

function computeMonthlyFromSnaps(snaps: SnapRow[], lastDay: number, tz: string | null) {
  const signalQuality = snaps.filter(s =>
    s.glucoseImpact === "low" || s.glucoseImpact === "medium" || isHealthyFood(s.foodName)
  ).length / snaps.length;

  const dayMealTypes = new Map<string, Set<string>>();
  const dayHasIrregular = new Set<string>();
  for (const snap of snaps) {
    if (!dayMealTypes.has(snap.localDate)) dayMealTypes.set(snap.localDate, new Set());
    if (snap.mealType === "breakfast" || snap.mealType === "lunch" || snap.mealType === "dinner") {
      dayMealTypes.get(snap.localDate)!.add(snap.mealType);
      if (isIrregularSnap(snap, tz)) dayHasIrregular.add(snap.localDate);
    }
  }
  const snappedDays = dayMealTypes.size;
  const timingRegularity = snappedDays > 0
    ? [...dayMealTypes.values()].filter(s => s.size >= 2).length / snappedDays
    : 0;
  const freqConsistency = new Set(snaps.map(s => s.localDate)).size / lastDay;
  const missedMealDays = [...dayMealTypes.values()].filter(s => s.size < 2).length;
  const irregularMealDays = dayHasIrregular.size;

  const score = Math.round(signalQuality * 50 + timingRegularity * 25 + freqConsistency * 25);

  const highFoodCounts = new Map<string, number>();
  const lowFoodCounts = new Map<string, number>();
  for (const snap of snaps) {
    if (!snap.foodName) continue;
    if (snap.glucoseImpact === "high") highFoodCounts.set(snap.foodName, (highFoodCounts.get(snap.foodName) ?? 0) + 1);
    if (snap.glucoseImpact === "low") lowFoodCounts.set(snap.foodName, (lowFoodCounts.get(snap.foodName) ?? 0) + 1);
  }
  const topFood = (map: Map<string, number>) => {
    if (map.size < 2) return { name: null, count: null };
    const [name, count] = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    return { name, count };
  };
  const topHigh = topFood(highFoodCounts);
  const topLow = topFood(lowFoodCounts);

  return {
    score,
    signalQuality: Math.round(signalQuality * 100),
    timingRegularity: Math.round(timingRegularity * 100),
    freqConsistency: Math.round(freqConsistency * 100),
    missedMealDays,
    irregularMealDays,
    topHighFood: topHigh.name,
    topHighFoodCount: topHigh.count,
    topLowFood: topLow.name,
    topLowFoodCount: topLow.count,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/build-info", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(BUILD_INFO);
  });

  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  app.get("/api/meal-suggestions", isAuthenticated, async (req: any, res) => {
    const mealType = req.query.mealType as string;
    if (!["breakfast", "lunch", "dinner"].includes(mealType)) {
      return res.status(400).json({ error: "Invalid mealType" });
    }
    const userId: string = req.user.claims.sub;
    const userMealsRaw = await db
      .select({ foodName: mealSnaps.foodName })
      .from(mealSnaps)
      .where(
        and(
          eq(mealSnaps.userId, userId),
          eq(mealSnaps.mealType, mealType),
          eq(mealSnaps.glucoseImpact, "low"),
          sql`${mealSnaps.postMealGlucoseMmol} IS NOT NULL`,
          sql`${mealSnaps.foodName} IS NOT NULL`
        )
      );
    const deduped = [...new Set(userMealsRaw.map(m => m.foodName!).filter(Boolean))];
    if (deduped.length > 0) {
      const name = deduped[Math.floor(Math.random() * deduped.length)];
      return res.json({ name, source: "user" });
    }
    const list = HEALTHY_FOOD_LIST[mealType as keyof typeof HEALTHY_FOOD_LIST] ?? [];
    if (list.length === 0) {
      return res.status(404).json({ error: "No suggestions available" });
    }
    const name = list[Math.floor(Math.random() * list.length)];
    res.json({ name, source: "list" });
  });

  // Admin-only wipe endpoint. ALL account-deletion paths (this admin
  // wipe AND the user-facing /api/auth/delete-account below) MUST go
  // through storage.deleteUserCompletely(). That function is the single
  // source of truth for cleanup, including external-service teardown
  // (OneSignal player + RevenueCat subscriber) and atomic session
  // invalidation. Do not add raw delete logic here or push notifications
  // and RC records will silently survive.
  app.post("/api/admin/wipe-user", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_WIPE_SECRET;
      if (!adminSecret) {
        return res.status(503).json({ message: "Admin wipe not configured" });
      }
      const provided = req.header("x-admin-secret");
      if (provided !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const schema = z.object({
        email: z.string().email().optional(),
        userId: z.string().optional(),
      }).refine((d) => d.email || d.userId, { message: "Provide email or userId" });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      let user: { id: string; email: string | null | undefined } | undefined;
      if (parsed.data.email) {
        const email = parsed.data.email.toLowerCase();
        user = await authStorage.getUserByEmail(email) ?? undefined;
        if (!user) return res.status(404).json({ message: "User not found", email });
      } else {
        user = await authStorage.getUser(parsed.data.userId!) ?? undefined;
        if (!user) return res.status(404).json({ message: "User not found", userId: parsed.data.userId });
      }
      const deleted = await storage.deleteUserCompletely(user.id);
      const label = user.email ?? parsed.data.userId ?? user.id;
      console.log(`[admin/wipe-user] Wiped ${label} (id=${user.id})`, deleted);
      res.json({ ok: true, email: user.email ?? null, userId: user.id, deleted });
    } catch (error: any) {
      console.error("Error wiping user:", error);
      res.status(500).json({ message: error?.message || "Failed to wipe user" });
    }
  });

  app.post("/api/auth/delete-account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteUserCompletely(userId);
      console.log(`[auth/delete-account] User ${userId} deleted self`, deleted);
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error after account deletion:", err);
          return res.status(500).json({ message: "Account deleted but session cleanup failed" });
        }
        res.clearCookie("connect.sid");
        return res.json({ success: true, deleted });
      });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: error?.message || "Failed to delete account" });
    }
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { walksPerWeek, walkDuration, dinnerTime, sleepPattern, eatingOutFrequency, struggles, notificationEmail, preferredLanguage, name, goal, healthCondition, referralSource } = req.body;

      const sortedStruggles = sortStruggles(struggles || []);
      const hasLateDinner = dinnerTime === "after_9pm";

      const { deriveGlucoseGroupFromCondition } = await import("./glucose-thresholds");
      const glucoseGroup = deriveGlucoseGroupFromCondition(healthCondition) ?? undefined;

      const existingProfile = await storage.getProfile(userId);
      const profileData: any = {
        walksPerWeek: walksPerWeek || 0,
        walkDuration: walkDuration || 10,
        dinnerTime: dinnerTime || "before_9pm",
        sleepPattern: sleepPattern || "regular_10_6",
        eatingOutFrequency: eatingOutFrequency || "0",
        struggles: sortedStruggles,
        hasLateDinner,
        dinnerMastered: false,
        onboardingComplete: true,
        notificationEmail: notificationEmail || null,
        preferredLanguage: preferredLanguage || "en",
        restDay: null,
        currentWeek: 1,
        name: name || null,
        goal: goal || null,
        healthCondition: healthCondition || null,
        referralSource: referralSource || null,
        glucoseGroup: glucoseGroup ?? null,
      };

      let profile;
      if (existingProfile) {
        profile = await storage.updateProfile(userId, profileData);
      } else {
        profile = await storage.createProfile({ userId, ...profileData });
      }

      profile = await ensureCompPremium(userId, profile);

      res.json(profile);
    } catch (error: any) {
      console.error("Error creating profile:", error);
      res.status(500).json({ message: "Failed to create profile" });
    }
  });

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      profile = await ensureCompPremium(userId, profile);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/profile/repick", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { struggles2 } = req.body;
      if (!Array.isArray(struggles2) || struggles2.length === 0) {
        return res.status(400).json({ message: "struggles2 must be a non-empty array" });
      }
      const filtered = (struggles2 as string[]).filter(s => typeof s === "string" && ((STRUGGLE_PRIORITY as readonly string[]).includes(s) || s === "late_dinner"));
      if (filtered.length === 0) {
        return res.status(400).json({ message: "No valid struggles provided" });
      }
      const updated = await storage.updateProfile(userId, {
        struggles2: filtered,
        repickPending: false,
      });
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json({ ok: true, struggles2: updated.struggles2, repickPending: updated.repickPending });
    } catch (error: any) {
      console.error("Error saving repick:", error);
      res.status(500).json({ message: error.message || "Failed to save repick" });
    }
  });

  app.post("/api/profile/repick3", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      if ((profile.currentStruggleCycle as number) < 3) {
        return res.status(400).json({ message: "repick3 is only allowed in cycle 3+" });
      }
      const { struggles3 } = req.body;
      if (!Array.isArray(struggles3) || struggles3.length === 0) {
        return res.status(400).json({ message: "struggles3 must be a non-empty array" });
      }
      const filtered = (struggles3 as string[]).filter(s => typeof s === "string" && ((STRUGGLE_PRIORITY as readonly string[]).includes(s) || s === "late_dinner"));
      if (filtered.length === 0) {
        return res.status(400).json({ message: "No valid struggles provided" });
      }
      const updated = await storage.updateProfile(userId, {
        struggles3: filtered,
        masteredStruggles3: [],
        skippedStruggles3: [],
        difficultStruggles3: [],
        cycle3Active: null,
        repickPending: false,
      });
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json({ ok: true, struggles3: updated.struggles3, repickPending: updated.repickPending });
    } catch (error: any) {
      console.error("Error saving repick3:", error);
      res.status(500).json({ message: error.message || "Failed to save repick3" });
    }
  });

  app.post("/api/profile/cycle2-skip", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { struggle } = req.body;
      if (!struggle || typeof struggle !== "string") {
        return res.status(400).json({ message: "struggle is required" });
      }
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      if ((profile.currentStruggleCycle as number) !== 2) {
        return res.status(400).json({ message: "cycle2-skip is only allowed in cycle 2" });
      }
      const struggles2 = (profile.struggles2 as string[]) || [];
      // Verify the requested struggle is the current effective focus, using the same
      // algorithm as the cycle-2 plan picker (untried first, then tried-not-mastered).
      const c1Mastered = (profile.masteredStruggles as string[]) || [];
      const c2Mastered = (profile.masteredStruggles2 as string[]) || [];
      const c2Skipped = (profile.skippedStruggles2 as string[]) || [];
      const c2Difficult = (profile.difficultStruggles2 as string[]) || [];
      const isLateDinnerMastered = profile.dinnerMastered === true || c2Mastered.includes("late_dinner");
      const isValidStruggle = (s: string) => (STRUGGLE_PRIORITY as readonly string[]).includes(s) || s === "late_dinner";
      // Bug 2 fix: only check mastered2 for struggles2 items — mastered1 must not block repicked struggles.
      const isMastered = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMastered;
        return c2Mastered.includes(s);
      };
      const isMasteredFallback = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMastered;
        return c1Mastered.includes(s) || c2Mastered.includes(s);
      };
      const untried = struggles2.filter(s => isValidStruggle(s) && !isMastered(s) && !c2Skipped.includes(s) && !c2Difficult.includes(s));
      const triedNotMastered = struggles2.filter(s => isValidStruggle(s) && !isMastered(s) && (c2Skipped.includes(s) || c2Difficult.includes(s)));
      const fallback = (STRUGGLE_PRIORITY as readonly string[]).find(s => !isMasteredFallback(s) && !c2Skipped.includes(s) && !c2Difficult.includes(s)) || "sugary_food_drink";
      const currentFocus = [...untried, ...triedNotMastered][0] || fallback;
      if (currentFocus !== struggle) {
        return res.status(400).json({ message: "struggle is not the current cycle-2 focus" });
      }

      const idx = struggles2.indexOf(struggle);
      if (idx === -1 || idx >= struggles2.length - 1) {
        return res.json({ struggles2 });
      }
      const reorderedStruggles = [...struggles2];
      [reorderedStruggles[idx], reorderedStruggles[idx + 1]] = [reorderedStruggles[idx + 1], reorderedStruggles[idx]];
      const updated = await storage.updateProfile(userId, { struggles2: reorderedStruggles });
      res.json({ struggles2: (updated?.struggles2 as string[]) || reorderedStruggles });
    } catch (error: any) {
      console.error("Error in cycle2-skip:", error);
      res.status(500).json({ message: error.message || "Failed to swap struggle" });
    }
  });

  app.post("/api/profile/cycle3-skip", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { struggle } = req.body;
      if (!struggle || typeof struggle !== "string") {
        return res.status(400).json({ message: "struggle is required" });
      }
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      if ((profile.currentStruggleCycle as number) < 3) {
        return res.status(400).json({ message: "cycle3-skip is only allowed in cycle 3+" });
      }
      const struggles3 = (profile.struggles3 as string[]) || [];
      const c1Mastered = (profile.masteredStruggles as string[]) || [];
      const c2Mastered = (profile.masteredStruggles2 as string[]) || [];
      const c3Mastered = (profile.masteredStruggles3 as string[]) || [];
      const c3Skipped = (profile.skippedStruggles3 as string[]) || [];
      const c3Difficult = (profile.difficultStruggles3 as string[]) || [];
      const isLateDinnerMastered = profile.dinnerMastered === true || c3Mastered.includes("late_dinner");
      const isValidStruggle = (s: string) => (STRUGGLE_PRIORITY as readonly string[]).includes(s) || s === "late_dinner";
      const isMastered = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMastered;
        return c3Mastered.includes(s);
      };
      const isMasteredFallback = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMastered;
        return c1Mastered.includes(s) || c2Mastered.includes(s) || c3Mastered.includes(s);
      };
      const untried = struggles3.filter(s => isValidStruggle(s) && !isMastered(s) && !c3Skipped.includes(s) && !c3Difficult.includes(s));
      const triedNotMastered = struggles3.filter(s => isValidStruggle(s) && !isMastered(s) && (c3Skipped.includes(s) || c3Difficult.includes(s)));
      const fallback = (STRUGGLE_PRIORITY as readonly string[]).find(s => !isMasteredFallback(s) && !c3Skipped.includes(s) && !c3Difficult.includes(s)) || "sugary_food_drink";
      const currentFocus = [...untried, ...triedNotMastered][0] || fallback;
      if (currentFocus !== struggle) {
        return res.status(400).json({ message: "struggle is not the current cycle-3 focus" });
      }

      const idx = struggles3.indexOf(struggle);
      if (idx === -1 || idx >= struggles3.length - 1) {
        return res.json({ struggles3 });
      }
      const reorderedStruggles = [...struggles3];
      [reorderedStruggles[idx], reorderedStruggles[idx + 1]] = [reorderedStruggles[idx + 1], reorderedStruggles[idx]];
      const updated = await storage.updateProfile(userId, { struggles3: reorderedStruggles });
      res.json({ struggles3: (updated?.struggles3 as string[]) || reorderedStruggles });
    } catch (error: any) {
      console.error("Error in cycle3-skip:", error);
      res.status(500).json({ message: error.message || "Failed to swap struggle" });
    }
  });

  app.patch("/api/profile/health-markers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { hba1cLevel, bloodTestDate } = req.body;

      const updateData: Partial<InsertUserProfile> = {};
      if (hba1cLevel !== undefined) {
        if (hba1cLevel === null) {
          updateData.hba1cLevel = null;
        } else {
          const parsed = parseFloat(hba1cLevel);
          if (isNaN(parsed) || parsed < 0 || parsed > 20) {
            return res.status(400).json({ message: "Invalid HbA1c level. Must be a number between 0 and 20." });
          }
          updateData.hba1cLevel = parsed;
        }
      }
      if (bloodTestDate !== undefined) {
        if (bloodTestDate === null) {
          updateData.bloodTestDate = null;
        } else {
          if (typeof bloodTestDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bloodTestDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
          }
          const dateObj = new Date(bloodTestDate + "T00:00:00Z");
          if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ message: "Invalid date." });
          }
          updateData.bloodTestDate = bloodTestDate;
        }
      }

      const profile = await storage.updateProfile(userId, updateData);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
    } catch (error) {
      console.error("Error updating health markers:", error);
      res.status(500).json({ message: "Failed to update health markers" });
    }
  });

  app.patch("/api/profile/name-goal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const schema = z.object({
        name: z.string().max(100).nullable().optional(),
        goal: z.string().max(500).nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      const { name, goal } = parsed.data;
      const updateData: Partial<InsertUserProfile> = {};
      if (name !== undefined) updateData.name = name || null;
      if (goal !== undefined) updateData.goal = goal || null;
      const profile = await storage.updateProfile(userId, updateData);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json({ name: profile.name, goal: profile.goal });
    } catch (error) {
      console.error("Error updating name/goal:", error);
      res.status(500).json({ message: "Failed to update name/goal" });
    }
  });

  app.patch("/api/profile/language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { preferredLanguage } = req.body;
      const validLanguages = ["en", "zh-Hant", "yue"];
      if (!preferredLanguage || !validLanguages.includes(preferredLanguage)) {
        return res.status(400).json({ message: "Invalid language. Must be one of: en, zh-Hant, yue" });
      }
      const profile = await storage.updateProfile(userId, { preferredLanguage });
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json({ preferredLanguage: profile.preferredLanguage });
    } catch (error) {
      console.error("Error updating language:", error);
      res.status(500).json({ message: "Failed to update language" });
    }
  });

  app.patch("/api/profile/font-size", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fontSizePreference } = req.body;
      const validSizes = ["small", "large"];
      if (!fontSizePreference || !validSizes.includes(fontSizePreference)) {
        return res.status(400).json({ message: "Invalid font size. Must be one of: small, large" });
      }
      const profile = await storage.updateProfile(userId, { fontSizePreference });
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json({ fontSizePreference: profile.fontSizePreference });
    } catch (error) {
      console.error("Error updating font size:", error);
      res.status(500).json({ message: "Failed to update font size" });
    }
  });

  app.patch("/api/profile/intro-seen", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.updateProfile(userId, { introSeen: true });
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json({ introSeen: profile.introSeen });
    } catch (error) {
      console.error("Error updating intro seen:", error);
      res.status(500).json({ message: "Failed to update intro seen" });
    }
  });

  const hardLockBodySchema = z.object({ optedOut: z.boolean() });
  app.post("/api/profile/hard-lock", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = hardLockBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid body. Expected { optedOut: boolean }" });
      }
      const profile = await storage.updateProfile(userId, {
        hardLockedAfterAdviceDismiss: parsed.data.optedOut,
      });
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json({ hardLockedAfterAdviceDismiss: profile.hardLockedAfterAdviceDismiss });
    } catch (error) {
      console.error("Error updating hard-lock:", error);
      res.status(500).json({ message: "Failed to update hard-lock" });
    }
  });

  // OneSignal subscription IDs are UUIDv4-shaped (with dashes). We
  // accept the canonical form only — anything else is "garbage" we
  // do not want silently stored, because a stored-but-unreachable
  // player_id looks identical to a real registration in the DB and
  // mid-leads diagnosis for days. Trim first so trailing whitespace
  // from copy/paste doesn't slip through.
  const ONESIGNAL_PLAYER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  app.post("/api/onesignal/register", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rawPlayerId = req.body?.playerId;
      const rawSource = req.body?.source;
      const rawTimezone = req.body?.timezone;

      // Strict validation. Empty / non-string / wrong-shape values
      // are explicitly rejected with a structured log line so we
      // can grep `onesignal/register REJECTED` and know exactly
      // which device/email tried to store garbage.
      const playerId =
        typeof rawPlayerId === "string" ? rawPlayerId.trim() : null;
      const looksValid =
        playerId !== null &&
        playerId.length > 0 &&
        ONESIGNAL_PLAYER_ID_RE.test(playerId);

      const user = await authStorage.getUser(userId);
      const email = user?.email ?? "?";
      const source =
        typeof rawSource === "string" && rawSource.length > 0 && rawSource.length <= 64
          ? rawSource
          : "unknown";
      const timezone =
        typeof rawTimezone === "string" && rawTimezone.length > 0 && rawTimezone.length <= 64
          ? rawTimezone
          : null;

      if (!looksValid) {
        const shown = playerId === null ? "(missing)" : playerId.length === 0 ? "(empty)" : playerId;
        console.warn(
          `onesignal/register REJECTED email=${email} player_id=${shown} source=${source} reason=${
            playerId === null
              ? "missing-or-non-string"
              : playerId.length === 0
                ? "empty-after-trim"
                : "not-uuid-shape"
          }`,
        );
        return res.status(400).json({
          message:
            playerId === null
              ? "playerId is required"
              : playerId.length === 0
                ? "playerId must not be empty"
                : "playerId must be a OneSignal subscription UUID",
        });
      }

      const previousProfile = await storage.getProfile(userId);
      const previousPlayerId = previousProfile?.onesignalPlayerId ?? null;

      // Defend the unique invariant: if any other user_profiles row
      // currently holds this player_id, null it on that row first.
      // (Schema invariant: one user → one active subscription id.)
      await db
        .update(userProfiles)
        .set({ onesignalPlayerId: null })
        .where(and(
          eq(userProfiles.onesignalPlayerId, playerId),
          sql`${userProfiles.userId} != ${userId}`,
        ));

      const profile = await storage.updateProfile(userId, {
        onesignalPlayerId: playerId,
        onesignalRegisteredAt: new Date(),
        // Fall back to UTC when the client could not resolve a
        // timezone — the scheduler treats UTC as "may have passed"
        // so the user still gets the send instead of silently
        // rolling to tomorrow.
        deviceTimezone: timezone ?? "UTC",
      });
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      console.log(
        `onesignal/register email=${email} player_id=${playerId} previous=${previousPlayerId ?? "none"} source=${source} tz=${timezone ?? "UTC(fallback)"}`,
      );

      res.json({
        success: true,
        playerId,
        previousPlayerId,
        timezone: timezone ?? "UTC",
        registeredAt: profile.onesignalRegisteredAt?.toISOString?.() ?? null,
      });
    } catch (error) {
      console.error("Error registering OneSignal player ID:", error);
      res.status(500).json({ message: "Failed to register player ID" });
    }
  });

  // Lightweight always-on uptime endpoint. Configure an external
  // uptime monitor (UptimeRobot / cron-job.org / etc.) to GET this
  // periodically (e.g. every 30 minutes) so the hourly OneSignal
  // pre-scheduling pass actually runs on autoscale deployments.
  // After task #500 the path is no longer load-bearing for on-time
  // delivery — OneSignal owns the actual trigger time via
  // send_after — but the wakeup is still needed so the hourly
  // pass can pre-schedule new triggers ~1× per UTC day. Public on
  // purpose: nothing to protect, only a 200 acknowledgement.
  app.get("/api/uptime/ping", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, at: new Date().toISOString() });
  });

  // Persists the wrapper-confirmed OneSignal external_id (= app
  // user id) onto the user profile. The pre-scheduler prefers the
  // alias path when this is non-null so OneSignal can deliver
  // sends even after a subscription (player) id rotation. Strict
  // validation: the submitted external_id MUST equal the
  // authenticated user's own id (no setting external_id for some
  // other user). Idempotent: writing the same value is a no-op.
  app.post("/api/onesignal/external-id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rawExternalId = req.body?.externalId;
      const rawSource = req.body?.source;

      const externalId =
        typeof rawExternalId === "string" ? rawExternalId.trim() : null;
      const user = await authStorage.getUser(userId);
      const email = user?.email ?? "?";
      const source =
        typeof rawSource === "string" && rawSource.length > 0 && rawSource.length <= 64
          ? rawSource
          : "unknown";

      if (!externalId) {
        console.warn(
          `onesignal/external-id REJECTED email=${email} reason=missing-or-empty source=${source}`,
        );
        return res.status(400).json({ message: "externalId is required" });
      }
      // Hijack guard: must equal the signed-in user id.
      if (externalId !== userId) {
        console.warn(
          `onesignal/external-id REJECTED email=${email} reason=user-mismatch submitted=${externalId.slice(0, 12)}… source=${source}`,
        );
        return res.status(400).json({ message: "externalId must match authenticated user id" });
      }

      const previousProfile = await storage.getProfile(userId);
      const previous = previousProfile?.onesignalExternalId ?? null;

      const profile = await storage.updateProfile(userId, {
        onesignalExternalId: externalId,
      });
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      console.log(
        `onesignal/external-id email=${email} external_id=${externalId} previous=${previous ?? "none"} source=${source}`,
      );

      res.json({
        success: true,
        externalId,
        previousExternalId: previous,
      });
    } catch (error) {
      console.error("Error registering OneSignal external ID:", error);
      res.status(500).json({ message: "Failed to register external ID" });
    }
  });

  app.get("/api/plan/current", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const plan = await storage.getCurrentWeeklyPlan(userId);
      if (!plan) return res.json(null);

      const days = await storage.getWeeklyPlanDays(plan.id);
      const profile = await storage.getProfile(userId);

      if (profile) {
        const homeGate = canUseFeature(profile, "homepage");
        if (!homeGate.allowed) {
          return res.json({
            success: false,
            showPaywall: true,
            lockApp: homeGate.lockApp || false,
            feature: "homepage",
          });
        }
      }

      let lastWeekDinnerEarlyPct: number | null = null;
      let prevPrevWeekDinnerEarlyPct: number | null = null;

      async function computeEarlyPct(weekNum: number): Promise<number | null> {
        const wPlan = await storage.getWeeklyPlan(userId, weekNum);
        if (!wPlan) return null;
        const wDays = await storage.getWeeklyPlanDays(wPlan.id);
        const earlyDays = wDays.filter(d => d.dinnerLabel === "move_early");
        if (earlyDays.length === 0) return null;
        const wLogs = await storage.getDailyLogsByWeek(userId, weekNum, wPlan.startDate);
        let earlySuccess = 0;
        for (const day of earlyDays) {
          const dayDate = new Date(wPlan.startDate);
          dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
          const dateStr = dayDate.toISOString().split("T")[0];
          const log = wLogs.find(l => l.date === dateStr);
          if (log?.dinnerSuccess === true) earlySuccess++;
        }
        return Math.round((earlySuccess / earlyDays.length) * 100);
      }

      if (profile && profile.currentWeek > 1) {
        lastWeekDinnerEarlyPct = await computeEarlyPct(plan.weekNumber - 1);
      }
      if (profile && profile.currentWeek > 2) {
        prevPrevWeekDinnerEarlyPct = await computeEarlyPct(plan.weekNumber - 2);
      }

      res.json({
        ...plan,
        days,
        isDinnerFocus: plan.isDinnerFocus,
        mitigationLabels: MITIGATION_TRIO_LABELS,
        currentWeek: profile?.currentWeek,
        lastWeekDinnerEarlyPct,
        prevPrevWeekDinnerEarlyPct,
      });
    } catch (error) {
      console.error("Error fetching plan:", error);
      res.status(500).json({ message: "Failed to fetch plan" });
    }
  });

  app.get("/api/plan/reflection", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reflection = await getWeeklyReflection(userId);
      if (!reflection) return res.json(null);

      const profile = await storage.getProfile(userId);
      const biWeekly = await checkBiWeeklyTriggers(userId);
      const stretchProgression = await getStretchProgression(userId);

      const reflectionPlan = await storage.getWeeklyPlan(userId, reflection.weekNumber);
      let stretchAdjustedDays = 0;
      let isStretchModeWeek = false;
      if (reflectionPlan) {
        isStretchModeWeek = !!reflectionPlan.isStretchWeek;
        const reflectionPlanDays = await storage.getWeeklyPlanDays(reflectionPlan.id);
        const walkDays = reflectionPlanDays.filter(d => d.walkScheduled && !d.standingTap);
        if (isStretchModeWeek) {
          stretchAdjustedDays = walkDays.filter(d => d.isStretchDay).length;
        } else {
          stretchAdjustedDays = walkDays.filter(d => d.isStretchDay).length;
        }
      }

      let adjustedWalkDaysScheduled = reflection.walkDaysScheduled - stretchAdjustedDays;
      if (adjustedWalkDaysScheduled < 0) adjustedWalkDaysScheduled = 0;
      let adjustedWalkDaysCompleted = reflection.walkDaysCompleted;
      let stretchSuccessPct: number | null = null;
      if (reflectionPlan && stretchAdjustedDays > 0) {
        const reflectionPlanDays = await storage.getWeeklyPlanDays(reflectionPlan.id);
        const stretchDows = isStretchModeWeek
          ? reflectionPlanDays.filter(d => d.walkScheduled && !d.standingTap).map(d => d.dayOfWeek)
          : reflectionPlanDays.filter(d => d.isStretchDay).map(d => d.dayOfWeek);
        const logs = await storage.getDailyLogsByWeek(userId, reflection.weekNumber, reflectionPlan.startDate);
        let stretchCompleted = 0;
        for (const dow of stretchDows) {
          const dayDate = new Date(reflectionPlan.startDate + "T00:00:00");
          dayDate.setDate(dayDate.getDate() + dow);
          const dateStr = dayDate.toISOString().split("T")[0];
          const log = logs.find(l => l.date === dateStr);
          if (log?.walkCompleted === true) {
            stretchCompleted++;
          }
        }
        adjustedWalkDaysCompleted = reflection.walkDaysCompleted - stretchCompleted;
        if (adjustedWalkDaysCompleted < 0) adjustedWalkDaysCompleted = 0;
        stretchSuccessPct = Math.round((stretchCompleted / stretchAdjustedDays) * 100);
      }
      const adjustedWalkSuccessPct = adjustedWalkDaysScheduled > 0
        ? Math.round((adjustedWalkDaysCompleted / adjustedWalkDaysScheduled) * 100)
        : 0;

      const lastWeekPlanForReflection = await storage.getWeeklyPlan(userId, (profile?.currentWeek || 1) - 1);
      const currentStruggleForReflection = lastWeekPlanForReflection?.dietStruggle;

      const today = new Date().toISOString().split("T")[0];
      const dinnerGraduationResult = await processDinnerGraduation(userId, today);

      const dietEvaluation = currentStruggleForReflection
        ? await evaluateDietStruggle(userId, currentStruggleForReflection, profile?.currentWeek)
        : { type: "in_cycle", struggle: null };
      const dinnerGraduation = await getDinnerGraduationData(userId);

      let dietJustGraduated = false;
      let dietJustSkipped = false;
      let dietJustMovedOn = false;

      const profileBeforeMastery = await storage.getProfile(userId);
      const currentCycle = (profileBeforeMastery?.currentStruggleCycle as number) || 1;

      if (currentStruggleForReflection && dietEvaluation.type !== "in_cycle") {
        if (currentCycle === 1) {
          const mastered = (profileBeforeMastery?.masteredStruggles || []) as string[];
          const skipped = (profileBeforeMastery?.skippedStruggles || []) as string[];
          const difficult = (profileBeforeMastery?.difficultStruggles || []) as string[];
          // One-time-ever guard: only emit struggle_completed for the user's
          // very first Cycle-1 resolution. After that, at least one of the
          // three arrays will be non-empty and we go silent for subsequent
          // resolutions.
          const isFirstEverResolution = mastered.length === 0 && skipped.length === 0 && difficult.length === 0;

          if (dietEvaluation.type === "mastered") {
            if (!mastered.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                masteredStruggles: [...mastered, currentStruggleForReflection],
                skippedStruggles: skipped.filter(s => s !== currentStruggleForReflection),
                difficultStruggles: difficult.filter(s => s !== currentStruggleForReflection),
              });
              try { await awardStruggleGraduationCoin(userId, currentStruggleForReflection, today); } catch (e) { console.error("Struggle graduation coin error (cycle 1):", e); }
              if (isFirstEverResolution) {
                trackServer(userId, "struggle_completed", { struggle_category: currentStruggleForReflection, status: "mastered" });
              }
            }
            dietJustGraduated = true;
          } else if (dietEvaluation.type === "not_relevant") {
            if (!skipped.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                skippedStruggles: [...skipped, currentStruggleForReflection],
              });
              if (isFirstEverResolution) {
                trackServer(userId, "struggle_completed", { struggle_category: currentStruggleForReflection, status: "skipped" });
              }
            }
            dietJustSkipped = true;
          } else if (dietEvaluation.type === "moved_on") {
            if (!difficult.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                difficultStruggles: [...difficult, currentStruggleForReflection],
              });
              if (isFirstEverResolution) {
                trackServer(userId, "struggle_completed", { struggle_category: currentStruggleForReflection, status: "moved_on" });
              }
            }
            dietJustMovedOn = true;
          }
        } else if (currentCycle === 2) {
          const mastered2 = (profileBeforeMastery?.masteredStruggles2 || []) as string[];
          const skipped2 = (profileBeforeMastery?.skippedStruggles2 || []) as string[];
          const difficult2 = (profileBeforeMastery?.difficultStruggles2 || []) as string[];
          const cycle2Active = profileBeforeMastery?.cycle2Active;

          if (dietEvaluation.type === "mastered") {
            if (cycle2Active !== false && !mastered2.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                masteredStruggles2: [...mastered2, currentStruggleForReflection],
                skippedStruggles2: skipped2.filter(s => s !== currentStruggleForReflection),
                difficultStruggles2: difficult2.filter(s => s !== currentStruggleForReflection),
              });
              try { await awardStruggleGraduationCoin(userId, currentStruggleForReflection, today); } catch (e) { console.error("Struggle graduation coin error (cycle 2):", e); }
            }
            dietJustGraduated = true;
          } else if (dietEvaluation.type === "not_relevant") {
            if (cycle2Active !== false && !skipped2.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                skippedStruggles2: [...skipped2, currentStruggleForReflection],
              });
            }
            dietJustSkipped = true;
          } else if (dietEvaluation.type === "moved_on") {
            if (cycle2Active !== false && !difficult2.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                difficultStruggles2: [...difficult2, currentStruggleForReflection],
              });
            }
            dietJustMovedOn = true;
          }
        } else if (currentCycle >= 3) {
          const mastered3 = (profileBeforeMastery?.masteredStruggles3 || []) as string[];
          const skipped3 = (profileBeforeMastery?.skippedStruggles3 || []) as string[];
          const difficult3 = (profileBeforeMastery?.difficultStruggles3 || []) as string[];
          const cycle3Active = profileBeforeMastery?.cycle3Active;

          if (dietEvaluation.type === "mastered") {
            if (cycle3Active !== false && !mastered3.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                masteredStruggles3: [...mastered3, currentStruggleForReflection],
                skippedStruggles3: skipped3.filter(s => s !== currentStruggleForReflection),
                difficultStruggles3: difficult3.filter(s => s !== currentStruggleForReflection),
              });
              try { await awardStruggleGraduationCoin(userId, currentStruggleForReflection, today); } catch (e) { console.error("Struggle graduation coin error (cycle 3+):", e); }
            }
            dietJustGraduated = true;
          } else if (dietEvaluation.type === "not_relevant") {
            if (cycle3Active !== false && !skipped3.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                skippedStruggles3: [...skipped3, currentStruggleForReflection],
              });
            }
            dietJustSkipped = true;
          } else if (dietEvaluation.type === "moved_on") {
            if (cycle3Active !== false && !difficult3.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                difficultStruggles3: [...difficult3, currentStruggleForReflection],
              });
            }
            dietJustMovedOn = true;
          }
        }
      }

      // Bug 4 fix: when dinner just graduated in cycle 2 and late_dinner is in struggles2,
      // write "late_dinner" to masteredStruggles2 so the cycle-2 picker skips it.
      if (dinnerGraduationResult.dinnerOutcomeType === "mastered" && currentCycle === 2) {
        const latestProfileForDinner = await storage.getProfile(userId);
        const struggles2ForDinner = (latestProfileForDinner?.struggles2 as string[]) || [];
        const mastered2ForDinner = (latestProfileForDinner?.masteredStruggles2 as string[]) || [];
        if (struggles2ForDinner.includes("late_dinner") && !mastered2ForDinner.includes("late_dinner")) {
          await storage.updateProfile(userId, {
            masteredStruggles2: [...mastered2ForDinner, "late_dinner"],
          });
        }
      }

      // When dinner graduates in cycle 3+ and late_dinner is in struggles3, mark it mastered there too.
      if (dinnerGraduationResult.dinnerOutcomeType === "mastered" && currentCycle >= 3) {
        const latestProfileForDinner = await storage.getProfile(userId);
        const struggles3ForDinner = (latestProfileForDinner?.struggles3 as string[]) || [];
        const mastered3ForDinner = (latestProfileForDinner?.masteredStruggles3 as string[]) || [];
        if (struggles3ForDinner.includes("late_dinner") && !mastered3ForDinner.includes("late_dinner")) {
          await storage.updateProfile(userId, {
            masteredStruggles3: [...mastered3ForDinner, "late_dinner"],
          });
        }
      }

      // Task 4: at week 6 of eat_out focus with no resolution, force moved_on directly.
      // Task 4 (#577): also at week 3 if eat_out is the sole unresolved struggle and
      // mastery/skip evaluation didn't already resolve it — prevents users getting stuck.
      if (
        currentCycle === 1 &&
        currentStruggleForReflection === "eat_out" &&
        dietEvaluation.type === "in_cycle" &&
        !dietJustGraduated && !dietJustSkipped && !dietJustMovedOn
      ) {
        const eatOutMastered = (profileBeforeMastery?.masteredStruggles || []) as string[];
        const eatOutSkipped = (profileBeforeMastery?.skippedStruggles || []) as string[];
        const eatOutDifficult = (profileBeforeMastery?.difficultStruggles || []) as string[];
        const eatOutStruggles = (profileBeforeMastery?.struggles || []) as string[];
        const nonEatOutStruggles = eatOutStruggles.filter(s => s !== "eat_out");
        const isEatOutResolved = eatOutMastered.includes("eat_out") || eatOutSkipped.includes("eat_out") || eatOutDifficult.includes("eat_out");
        if (!isEatOutResolved && nonEatOutStruggles.length > 0) {
          const allOthersResolved = nonEatOutStruggles.every(s => eatOutMastered.includes(s) || eatOutSkipped.includes(s) || eatOutDifficult.includes(s));
          if (allOthersResolved) {
            const eatOutFocusWeekCount = await storage.countEatOutFocusWeeks(userId);
            if (eatOutFocusWeekCount === 6 || eatOutFocusWeekCount === 3) {
              await storage.updateProfile(userId, {
                difficultStruggles: [...eatOutDifficult, "eat_out"],
              });
              dietJustMovedOn = true;
            }
          }
        }
      }

      let repickPending = false;
      let eatOutPickedButNeverScheduled = false;
      let eatOutNeedsCommitment = false;
      let eatOutFocusWeeksResult = 0;
      let eatOutLastStruggleNeedsActivation = false;
      if (currentCycle === 1 && !(profileBeforeMastery?.repickPending)) {
        const repickResult = await checkRepickCondition(userId);
        if (repickResult.conditionMet) {
          // Bug 4 A1 fix (#577): if eat_out was picked but never scheduled in cycle 1,
          // write it to skippedStruggles before saving cycle history so it lands in the
          // moved-on bucket instead of being silently dropped at the cycle transition.
          if (repickResult.eatOutPickedButNeverScheduled) {
            const latestProfileForSkip = await storage.getProfile(userId);
            const skippedForA1 = (latestProfileForSkip?.skippedStruggles as string[]) || [];
            if (!skippedForA1.includes("eat_out")) {
              await storage.updateProfile(userId, {
                skippedStruggles: [...skippedForA1, "eat_out"],
              });
            }
          }

          const latestProfileForHistory = await storage.getProfile(userId);
          const cycle1Skipped = (latestProfileForHistory?.skippedStruggles as string[]) || [];
          const cycle1Difficult = (latestProfileForHistory?.difficultStruggles as string[]) || [];
          await storage.saveCycleHistory({
            userId,
            cycleNumber: 1,
            startWeek: 1,
            endWeek: latestProfileForHistory?.currentWeek ?? undefined,
            strugglesPicked: (latestProfileForHistory?.struggles as string[]) || [],
            mastered: (latestProfileForHistory?.masteredStruggles as string[]) || [],
            movedOn: [...new Set([...cycle1Skipped, ...cycle1Difficult])],
          });
          await storage.updateProfile(userId, { repickPending: true, currentStruggleCycle: 2, cycle2Active: false, eatOutExtendedCommitment: false });
          repickPending = true;
        }
        eatOutPickedButNeverScheduled = repickResult.eatOutPickedButNeverScheduled;
        eatOutNeedsCommitment = repickResult.eatOutNeedsCommitment;
        eatOutFocusWeeksResult = repickResult.eatOutFocusWeeks;
        eatOutLastStruggleNeedsActivation = repickResult.eatOutLastStruggleNeedsActivation;
      } else if (currentCycle === 1 && profileBeforeMastery?.repickPending) {
        repickPending = true;
      } else if (currentCycle === 2 && !(profileBeforeMastery?.repickPending)) {
        const cycle3Result = await checkCycle3RepickCondition(userId);
        if (cycle3Result.conditionMet) {
          const latestProfileForHistory = await storage.getProfile(userId);
          const cycle2Skipped = (latestProfileForHistory?.skippedStruggles2 as string[]) || [];
          const cycle2Difficult = (latestProfileForHistory?.difficultStruggles2 as string[]) || [];
          const cycleHistory = await storage.getCycleHistory(userId);
          const cycle1HistoryEntry = cycleHistory.find(h => h.cycleNumber === 1);
          const c2StartWeek = cycle1HistoryEntry?.endWeek != null ? (cycle1HistoryEntry.endWeek as number) + 1 : undefined;
          await storage.saveCycleHistory({
            userId,
            cycleNumber: 2,
            startWeek: c2StartWeek,
            endWeek: latestProfileForHistory?.currentWeek ?? undefined,
            strugglesPicked: (latestProfileForHistory?.struggles2 as string[]) || [],
            mastered: (latestProfileForHistory?.masteredStruggles2 as string[]) || [],
            movedOn: [...new Set([...cycle2Skipped, ...cycle2Difficult])],
          });
          await storage.updateProfile(userId, { repickPending: true, currentStruggleCycle: 3, cycle3Active: false });
          repickPending = true;
        } else {
          repickPending = false;
        }
      } else if (currentCycle >= 3 && !(profileBeforeMastery?.repickPending)) {
        const cycleNResult = await checkCurrentCycleRepickCondition(userId);
        if (cycleNResult.conditionMet) {
          const latestProfileForHistory = await storage.getProfile(userId);
          const cycle3Skipped = (latestProfileForHistory?.skippedStruggles3 || []) as string[];
          const cycle3Difficult = (latestProfileForHistory?.difficultStruggles3 || []) as string[];
          const movedOn = [...new Set([...cycle3Skipped, ...cycle3Difficult])];
          const cycleHistory = await storage.getCycleHistory(userId);
          const prevCycleEntry = cycleHistory.find(h => h.cycleNumber === currentCycle - 1);
          const cycleStartWeek = prevCycleEntry?.endWeek != null ? (prevCycleEntry.endWeek as number) + 1 : undefined;
          await storage.saveCycleHistory({
            userId,
            cycleNumber: currentCycle,
            startWeek: cycleStartWeek,
            endWeek: profile?.currentWeek ?? undefined,
            strugglesPicked: (latestProfileForHistory?.struggles3 || []) as string[],
            mastered: (latestProfileForHistory?.masteredStruggles3 || []) as string[],
            movedOn: movedOn,
          });
          await storage.updateProfile(userId, {
            repickPending: true,
            currentStruggleCycle: currentCycle + 1,
            cycle3Active: false,
          });
          repickPending = true;
        } else {
          repickPending = false;
        }
      } else {
        repickPending = !!(profileBeforeMastery?.repickPending);
      }

      const allPlansForAppeared = await storage.getAllWeeklyPlans(userId);
      const dietStruggleValues = allPlansForAppeared.map(p => p.dietStruggle).filter((s): s is string => !!s);
      const appearedDietStruggles = Array.from(new Set(dietStruggleValues));

      // Fetch the truly-final profile after all mutations (including repick/cycle transitions)
      // so that currentStruggleCycle reflects the updated value, not the stale pre-mutation value.
      const finalProfile = await storage.getProfile(userId);

      res.json({
        ...reflection,
        walkDaysScheduled: adjustedWalkDaysScheduled,
        walkDaysCompleted: adjustedWalkDaysCompleted,
        walkSuccessPct: adjustedWalkSuccessPct,
        stretchAdjustedDays,
        stretchSuccessPct,
        walkingBridge: biWeekly.walkingBridge,
        autoEscalation: biWeekly.autoEscalation,
        isStretchMode: profile?.isStretchMode || false,
        stretchProgression,
        stretchSuccessWeeks: biWeekly.consecutiveStretchWeeks,
        activeDays: (dietEvaluation as any).activeDays ?? 0,
        activeDaysYes: (dietEvaluation as any).yesDays ?? 0,
        eatOutDaysScheduled: (dietEvaluation as any).eatOutDaysScheduled ?? 0,
        dietEvaluation,
        dinnerGraduation,
        dinnerMastered: finalProfile?.dinnerMastered || false,
        dinnerExitType: finalProfile?.dinnerExitType ?? null,
        dinnerJustGraduated: dinnerGraduationResult.dinnerOutcomeType === "mastered",
        dinnerJustExited: dinnerGraduationResult.dinnerOutcomeType === "moved_on"
          || dinnerGraduationResult.dinnerOutcomeType === "not_relevant",
        dinnerGraduationSuccessPct: dinnerGraduationResult.dinnerSuccessPct,
        dinnerOutcomeType: finalProfile?.dinnerMastered ? "mastered"
          : finalProfile?.dinnerExitType ?? null,
        dietJustGraduated,
        dietJustSkipped,
        dietJustMovedOn,
        dietOutcomeType: dietEvaluation.type !== "in_cycle" ? dietEvaluation.type : null,
        repickPending,
        currentStruggleCycle: finalProfile?.currentStruggleCycle ?? profile?.currentStruggleCycle,
        eatOutPickedButNeverScheduled,
        eatOutNeedsCommitment,
        eatOutFocusWeeks: eatOutFocusWeeksResult,
        eatOutExtendedCommitment: finalProfile?.eatOutExtendedCommitment ?? false,
        eatOutLastStruggleNeedsActivation,
        appearedDietStruggles,
      });
    } catch (error) {
      console.error("Error fetching reflection:", error);
      res.status(500).json({ message: "Failed to fetch reflection" });
    }
  });

  app.post("/api/plan/weekly/report-seen", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      let coinsAwarded = 0;
      const completedWeekNum = profile.currentWeek - 1;
      if (completedWeekNum > 0) {
        const completedPlan = await storage.getWeeklyPlan(userId, completedWeekNum);
        if (completedPlan) {
          const completedPlanDays = await storage.getWeeklyPlanDays(completedPlan.id);
          const completedPlanStart = typeof completedPlan.startDate === "string"
            ? completedPlan.startDate
            : (completedPlan.startDate as any).toISOString().split("T")[0];
          const completedLogs = await storage.getDailyLogsByWeek(userId, completedWeekNum, completedPlanStart);
          coinsAwarded = await evaluateWeeklyAchievements(userId, completedWeekNum, completedPlan, completedPlanDays, completedLogs);
        }
      }

      res.json({ coinsAwarded });
    } catch (error) {
      console.error("Error in report-seen:", error);
      res.status(500).json({ message: "Failed to evaluate weekly achievements" });
    }
  });

  app.post("/api/eat-out/commit-extended", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const struggles = (profile.struggles || []) as string[];
      const hasEatOut = struggles.includes("eat_out");
      const hasOtherStruggles = struggles.filter(s => s !== "eat_out").length > 0;
      const eatOutResolved = ((profile.masteredStruggles || []) as string[]).includes("eat_out")
        || ((profile.skippedStruggles || []) as string[]).includes("eat_out")
        || ((profile.difficultStruggles || []) as string[]).includes("eat_out");

      if (profile.currentStruggleCycle !== 1) {
        return res.status(400).json({ message: "Extended commitment only applies in Cycle 1" });
      }
      if (!hasEatOut) {
        return res.status(400).json({ message: "eat_out not in struggle list" });
      }
      if (!hasOtherStruggles) {
        return res.status(400).json({ message: "Extended commitment not applicable for sole eat_out struggle" });
      }
      if (eatOutResolved) {
        return res.status(400).json({ message: "eat_out is already resolved" });
      }
      const mastered = (profile.masteredStruggles || []) as string[];
      const skipped = (profile.skippedStruggles || []) as string[];
      const difficult = (profile.difficultStruggles || []) as string[];
      const allOtherResolved = struggles
        .filter(s => s !== "eat_out")
        .every(s => mastered.includes(s) || skipped.includes(s) || difficult.includes(s));
      if (!allOtherResolved) {
        return res.status(400).json({ message: "Extended commitment requires all other Cycle 1 struggles to be resolved first" });
      }
      const focusWeeks = await storage.countEatOutFocusWeeks(userId);
      if (focusWeeks !== 1 && focusWeeks !== 2 && focusWeeks !== 4 && focusWeeks !== 5) {
        return res.status(400).json({ message: "Extended commitment only allowed at 1, 2, 4, or 5 eat_out focus weeks" });
      }

      const updated = await storage.updateProfile(userId, { eatOutExtendedCommitment: true });
      res.json(updated);
    } catch (error) {
      console.error("Error in eat-out/commit-extended:", error);
      res.status(500).json({ message: "Failed to commit extended eat-out" });
    }
  });

  app.post("/api/eat-out/skip-cycle1", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const struggles = (profile.struggles || []) as string[];
      const hasEatOut = struggles.includes("eat_out");
      const hasOtherStruggles = struggles.filter(s => s !== "eat_out").length > 0;

      if (profile.currentStruggleCycle !== 1) {
        return res.status(400).json({ message: "skip-cycle1 only applies in Cycle 1" });
      }
      if (!hasEatOut) {
        return res.status(400).json({ message: "eat_out not in struggle list" });
      }
      if (!hasOtherStruggles) {
        return res.status(400).json({ message: "Cannot skip eat_out when it is the only struggle (Rule C)" });
      }

      const skipped = (profile.skippedStruggles || []) as string[];
      if (!skipped.includes("eat_out")) {
        await storage.updateProfile(userId, {
          skippedStruggles: [...skipped, "eat_out"],
          eatOutExtendedCommitment: false,
        });
      } else {
        await storage.updateProfile(userId, { eatOutExtendedCommitment: false });
      }

      const repickResult = await checkRepickCondition(userId);
      if (repickResult.conditionMet) {
        const latestProfile = await storage.getProfile(userId);
        const cycle1Skipped = (latestProfile?.skippedStruggles as string[]) || [];
        const cycle1Difficult = (latestProfile?.difficultStruggles as string[]) || [];
        await storage.saveCycleHistory({
          userId,
          cycleNumber: 1,
          startWeek: 1,
          endWeek: latestProfile?.currentWeek ?? undefined,
          strugglesPicked: (latestProfile?.struggles as string[]) || [],
          mastered: (latestProfile?.masteredStruggles as string[]) || [],
          movedOn: [...new Set([...cycle1Skipped, ...cycle1Difficult])],
        });
        await storage.updateProfile(userId, { repickPending: true, currentStruggleCycle: 2, cycle2Active: false });
      }

      const finalProfile = await storage.getProfile(userId);
      res.json(finalProfile);
    } catch (error) {
      console.error("Error in eat-out/skip-cycle1:", error);
      res.status(500).json({ message: "Failed to skip eat-out cycle 1" });
    }
  });

  app.post("/api/plan/weekly", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { negotiationChoice, walkDays, eatOutDays, lateDinnerDays, stretchOnly, selectedTip, standingTapDay, walkDayDurations, clientDate } = req.body;

      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      // #576: server-side repick gate. A stale client (e.g. a planner page
      // open from before a cycle transition) can submit a plan POST while
      // the user still owes a repick; without this gate the plan would be
      // created using the pre-transition struggle list, baking the wrong
      // diet focus into the new week. The repick endpoints
      // (/api/profile/repick, /repick3) clear this flag on success.
      if (profile.repickPending === true) {
        return res.status(409).json({
          message: "Repick is pending — choose your struggles before planning.",
          code: "repick_pending",
        });
      }

      const wasFirstPlan = !profile.hasCreatedFirstWeeklyPlan;

      const planGate = canUseFeature(profile, "weekly_plan_create");
      if (!planGate.allowed) {
        return res.json({
          success: false,
          showPaywall: true,
          lockApp: planGate.lockApp || false,
          feature: "weekly_plan_create",
        });
      }

      const existingPlan = await storage.getWeeklyPlan(userId, profile.currentWeek);
      if (existingPlan) {
        return res.status(409).json({ message: "You've already planned this week" });
      }

      if (!Array.isArray(walkDays) || walkDays.length > 7) {
        return res.status(400).json({ message: "Invalid walk days" });
      }
      const validChoices = ["keep_current", "add_day", "add_minutes", "set_rest_day", "standing_tap", "stretch_escalation"];
      if (negotiationChoice && !validChoices.includes(negotiationChoice)) {
        return res.status(400).json({ message: "Invalid negotiation choice" });
      }

      if (profile.currentWeek > 1) {
        let updatedStretchSuccessWeeks = profile.stretchSuccessWeeks;
        if (profile.isStretchMode) {
          const stretchProg = await getStretchProgression(userId);
          if (stretchProg) {
            if (stretchProg.allCompleted) {
              updatedStretchSuccessWeeks = profile.stretchSuccessWeeks + 1;
              await storage.updateProfile(userId, { stretchSuccessWeeks: updatedStretchSuccessWeeks });
            } else {
              updatedStretchSuccessWeeks = 0;
              await storage.updateProfile(userId, { stretchSuccessWeeks: 0 });
            }
          }
        }

        if (profile.currentWeek >= 3) {
          const biWeekly = await checkBiWeeklyTriggers(userId);
          if (biWeekly.walkingBridge && !profile.isStretchMode) {
            await storage.updateProfile(userId, { isStretchMode: true, stretchSuccessWeeks: 0 });
          }
          if (biWeekly.autoEscalation && profile.isStretchMode && negotiationChoice === "stretch_escalation") {
            await storage.updateProfile(userId, { isStretchMode: false, walkDuration: 10, stretchSuccessWeeks: 0 });
          }
        }

      }

      const freshProfileForStretch = await storage.getProfile(userId);
      const effectiveStretchOnly = stretchOnly || freshProfileForStretch?.isStretchMode;

      const dateOverride = devDateOverrides.get(userId);
      const clientDateStr = !dateOverride && typeof clientDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientDate) ? clientDate : null;
      const effectiveDate = dateOverride ? new Date(dateOverride + "T00:00:00") : clientDateStr ? new Date(clientDateStr + "T00:00:00") : new Date();
      effectiveDate.setHours(0, 0, 0, 0);

      const result = await createWeeklyPlan({
        userId,
        negotiationChoice: negotiationChoice || "keep_current",
        walkDays: walkDays || [],
        eatOutDays: eatOutDays || [],
        lateDinnerDays: lateDinnerDays || [],
        standingTapDay: standingTapDay !== undefined ? standingTapDay : undefined,
        walkDayDurations: walkDayDurations || undefined,
        isStretchMode: !!effectiveStretchOnly,
        baseDate: effectiveDate,
      });

      let eatOutAutoAdded = false;
      let sugaryAutoAdded = false;
      let sugaryAlongsideEatOut = false;

      {
        const freshProfile = await storage.getProfile(userId);
        const planCycle = (freshProfile?.currentStruggleCycle as number) || 1;
        const hasEatOutDays = (eatOutDays || []).length > 0;
        const planUpdate: any = {};
        const profileUpdate: any = {};

        // Bug 1 fix: determine cycle first, then decide isDinnerFocus based on picked struggle.
        // In cycle 2, isDinnerFocus is true only when "late_dinner" is the pre-determined focus.
        // In cycle 1, isDinnerFocus is true when lateDinnerDays > 0 (original behaviour).
        let currentStruggle: string = "sugary_food_drink";
        let isDinnerFocusComputed = false;

        if (planCycle >= 3) {
          if (!freshProfile?.cycle3Active) profileUpdate.cycle3Active = true;
          let struggles3 = (freshProfile?.struggles3 || []) as string[];
          const cycle1Mastered = (freshProfile?.masteredStruggles || []) as string[];
          const cycle2Mastered = (freshProfile?.masteredStruggles2 || []) as string[];
          const cycle3Mastered = (freshProfile?.masteredStruggles3 || []) as string[];
          const skipped = (freshProfile?.skippedStruggles3 || []) as string[];
          const difficult = (freshProfile?.difficultStruggles3 || []) as string[];

          if (hasEatOutDays && !struggles3.includes("eat_out") && !cycle3Mastered.includes("eat_out") && !skipped.includes("eat_out") && !difficult.includes("eat_out")) {
            struggles3 = [...struggles3, "eat_out"];
            profileUpdate.struggles3 = struggles3;
          }

          const isLateDinnerMastered = freshProfile?.dinnerMastered === true || cycle3Mastered.includes("late_dinner");
          const isValidStruggle = (s: string) => STRUGGLE_PRIORITY.includes(s) || s === "late_dinner";
          // Only check mastered3 for struggles3 items — mastered1/mastered2 must not block repicked cycle-3 struggles.
          const isMastered = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered;
            return cycle3Mastered.includes(s);
          };
          // For the global fallback, also exclude mastered1 + mastered2.
          const isMasteredFallback = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered;
            return cycle1Mastered.includes(s) || cycle2Mastered.includes(s) || cycle3Mastered.includes(s);
          };
          const untried = struggles3.filter(s => isValidStruggle(s) && !isMastered(s) && !skipped.includes(s) && !difficult.includes(s));
          const triedNotMastered = struggles3.filter(s => isValidStruggle(s) && !isMastered(s) && (skipped.includes(s) || difficult.includes(s)));
          const fallback = STRUGGLE_PRIORITY.find(s => !isMasteredFallback(s) && !skipped.includes(s) && !difficult.includes(s)) || "sugary_food_drink";
          currentStruggle = [...untried, ...triedNotMastered][0] || fallback;

          isDinnerFocusComputed = currentStruggle === "late_dinner" && !freshProfile?.dinnerMastered;
        } else if (planCycle === 2) {
          if (!freshProfile?.cycle2Active) profileUpdate.cycle2Active = true;
          let struggles2 = (freshProfile?.struggles2 || []) as string[];
          const cycle1Mastered = (freshProfile?.masteredStruggles || []) as string[];
          const cycle2Mastered = (freshProfile?.masteredStruggles2 || []) as string[];
          const skipped = (freshProfile?.skippedStruggles2 || []) as string[];
          const difficult = (freshProfile?.difficultStruggles2 || []) as string[];

          if (hasEatOutDays && !struggles2.includes("eat_out") && !cycle2Mastered.includes("eat_out") && !skipped.includes("eat_out") && !difficult.includes("eat_out")) {
            struggles2 = [...struggles2, "eat_out"];
            profileUpdate.struggles2 = struggles2;
          }

          // Bug 2 fix: remove eat_out hasEatOutDays gate from cycle-2 picker.
          // eat_out's position in struggles2 is honoured regardless of this week's eat-out days.
          // Bug 3 fix: allow "late_dinner" through alongside STRUGGLE_PRIORITY items.
          const isLateDinnerMastered = freshProfile?.dinnerMastered === true || cycle2Mastered.includes("late_dinner");
          const isValidStruggle = (s: string) => STRUGGLE_PRIORITY.includes(s) || s === "late_dinner";
          // Bug 1 fix: only check mastered2 (not mastered1) for struggles2 items —
          // cycle-1 mastery must not block an explicitly repicked cycle-2 struggle.
          const isMastered = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered;
            return cycle2Mastered.includes(s);
          };
          // For the global fallback (items outside struggles2), also exclude mastered1
          // so we don't re-introduce things the user fully beat in cycle 1.
          const isMasteredFallback = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered;
            return cycle1Mastered.includes(s) || cycle2Mastered.includes(s);
          };
          const untried = struggles2.filter(s => isValidStruggle(s) && !isMastered(s) && !skipped.includes(s) && !difficult.includes(s));
          const triedNotMastered = struggles2.filter(s => isValidStruggle(s) && !isMastered(s) && (skipped.includes(s) || difficult.includes(s)));
          const fallback = STRUGGLE_PRIORITY.find(s => !isMasteredFallback(s) && !skipped.includes(s) && !difficult.includes(s)) || "sugary_food_drink";
          currentStruggle = [...untried, ...triedNotMastered][0] || fallback;

          // Bug 1 fix: set isDinnerFocus based on the picked struggle, not lateDinnerDays.
          isDinnerFocusComputed = currentStruggle === "late_dinner" && !freshProfile?.dinnerMastered;
        } else {
          // Cycle 1
          let struggles = (freshProfile?.struggles || []) as string[];
          const masteredS = (freshProfile?.masteredStruggles || []) as string[];
          const skippedS = (freshProfile?.skippedStruggles || []) as string[];
          const difficultS = (freshProfile?.difficultStruggles || []) as string[];
          const legacyTriedS = (freshProfile?.triedBeforeStruggles || []) as string[];

          // Step 1: eat_out guard — runs FIRST so the sugary guard below sees it already in the list.
          if (hasEatOutDays && !struggles.includes("eat_out") && !masteredS.includes("eat_out") && !skippedS.includes("eat_out") && !difficultS.includes("eat_out")) {
            struggles = sortStruggles([...struggles, "eat_out"]);
            profileUpdate.struggles = struggles;
            eatOutAutoAdded = true;
          }

          // Step 2: sugary guard — fires under exactly two structural cases (only once; gate closes once sugary is in list):
          // Case A: struggles is still empty (no eat_out days and nothing from onboarding).
          // Case B: eat_out is the only item in struggles AND no eat_out days this week.
          const isCaseA = struggles.length === 0;
          const isCaseB = struggles.length === 1 && struggles[0] === "eat_out" && !hasEatOutDays;
          if ((isCaseA || isCaseB) && !struggles.includes("sugary_food_drink") && !masteredS.includes("sugary_food_drink") && !skippedS.includes("sugary_food_drink") && !difficultS.includes("sugary_food_drink")) {
            struggles = sortStruggles([...struggles, "sugary_food_drink"]);
            profileUpdate.struggles = struggles;
            sugaryAutoAdded = true;
            sugaryAlongsideEatOut = isCaseB;
          }

          const effectiveStruggles = hasEatOutDays && !masteredS.includes("eat_out") && !skippedS.includes("eat_out") && !difficultS.includes("eat_out") && !legacyTriedS.includes("eat_out") && !struggles.includes("eat_out")
            ? [...struggles, "eat_out"]
            : struggles;
          const untried = STRUGGLE_PRIORITY.filter(s => effectiveStruggles.includes(s) && !masteredS.includes(s) && !skippedS.includes(s) && !difficultS.includes(s) && !legacyTriedS.includes(s) && !(s === "eat_out" && !hasEatOutDays));
          const triedNotMastered = STRUGGLE_PRIORITY.filter(s => effectiveStruggles.includes(s) && (difficultS.includes(s) || legacyTriedS.includes(s)) && !(s === "eat_out" && !hasEatOutDays));
          const fallbackStruggle = STRUGGLE_PRIORITY.find(s => {
            if (s === "eat_out" && !hasEatOutDays) return false;
            return !masteredS.includes(s) && !skippedS.includes(s) && !difficultS.includes(s);
          }) || "sugary_food_drink";
          currentStruggle = [...untried, ...triedNotMastered][0] || fallbackStruggle;

          // Task 9: force eat_out as focus during extended commitment weeks
          if (freshProfile?.eatOutExtendedCommitment && struggles.includes("eat_out") && !masteredS.includes("eat_out") && !skippedS.includes("eat_out") && !difficultS.includes("eat_out")) {
            currentStruggle = "eat_out";
          }

          if (currentStruggle === "eat_out" && !freshProfile?.eatOutExtendedCommitment) {
            const nonEatOutStruggles = struggles.filter(s => s !== "eat_out");
            if (nonEatOutStruggles.length > 0) {
              const allOthersResolved = nonEatOutStruggles.every(s =>
                masteredS.includes(s) || skippedS.includes(s) || difficultS.includes(s)
              );
              if (allOthersResolved) {
                const eatOutFocusWeekCount = await storage.countEatOutFocusWeeks(userId);
                const historicalEatOutDays = await storage.countHistoricalEatOutDays(userId);
                if ((eatOutFocusWeekCount === 0 || eatOutFocusWeekCount === 3) && historicalEatOutDays >= 1) {
                  profileUpdate.eatOutExtendedCommitment = true;
                }
              }
            }
          }

          isDinnerFocusComputed = (lateDinnerDays || []).length > 0 && !freshProfile?.dinnerMastered;
        }

        planUpdate.isDinnerFocus = isDinnerFocusComputed;
        if (isDinnerFocusComputed) {
          planUpdate.dietStruggle = null;
          planUpdate.dietTip = null;
        } else {
          planUpdate.dietStruggle = currentStruggle;
          const ladder = DIET_TIP_LADDERS[currentStruggle] || [];
          if (selectedTip && ladder.includes(selectedTip)) {
            planUpdate.dietTip = selectedTip;
          } else {
            planUpdate.dietTip = ladder[0] || null;
          }
        }

        await storage.updateWeeklyPlan(result.plan.id, planUpdate);
        if (Object.keys(profileUpdate).length > 0) {
          await storage.updateProfile(userId, profileUpdate);
        }
        result.plan = { ...result.plan, ...planUpdate };
      }

      // Stretch-mode walk-duration cap is now applied inside createWeeklyPlan
      // (see engine.ts) so the per-day walkDuration and walkDurationGoal are
      // already 2 in the result returned above.

      {
        const jsDay = effectiveDate.getDay();
        const todayDow = jsDay === 0 ? 6 : jsDay - 1;

        let firstActiveDay = 0;
        if (profile.currentWeek === 1) {
          if (todayDow === 6) {
            const nextMonday = new Date(effectiveDate);
            nextMonday.setDate(nextMonday.getDate() + 1);
            const nextMondayStr = nextMonday.toISOString().split('T')[0];
            await storage.updateWeeklyPlan(result.plan.id, { startDate: nextMondayStr });
            result.plan = { ...result.plan, startDate: nextMondayStr };
            firstActiveDay = 0;
          } else {
            firstActiveDay = todayDow === 0 ? 0 : Math.min(todayDow + 1, 6);
          }
        } else {
          const startDateStr = typeof result.plan.startDate === 'string'
            ? result.plan.startDate
            : result.plan.startDate.toISOString().split('T')[0];
          const planStart = new Date(startDateStr + "T00:00:00");
          planStart.setHours(0, 0, 0, 0);
          if (effectiveDate.getTime() >= planStart.getTime()) {
            firstActiveDay = Math.min(todayDow + 1, 6);
          }
        }

        if (firstActiveDay > 0) {
          await storage.updateWeeklyPlan(result.plan.id, { firstActiveDay });

          const days = await storage.getWeeklyPlanDays(result.plan.id);
          for (const day of days) {
            if (day.dayOfWeek < firstActiveDay) {
              await storage.updateWeeklyPlanDay(day.id, {
                walkScheduled: false,
                eatOutScheduled: false,
                lateDinnerScheduled: false,
                walkDuration: 0,
              });
            }
          }

          result.plan = { ...result.plan, firstActiveDay };
        }
      }

      await storage.updateProfile(userId, { currentWeek: profile.currentWeek + 1 });

      if (!profile.hasCreatedFirstWeeklyPlan) {
        await storage.updateProfile(userId, { hasCreatedFirstWeeklyPlan: true });
      }

      if (profile.currentWeek > 1) {
        const planWeekEventDate = new Date().toISOString().split("T")[0];
        const dinnerCheckData = await getDinnerGraduationData(userId);
        if (!profile.dinnerMastered && !profile.dinnerExitType && dinnerCheckData.dinnerWeeksFound > 0) {
          await processDinnerGraduation(userId, planWeekEventDate);
        }
      }

      res.json({ ...result, eatOutAutoAdded, sugaryAutoAdded, sugaryAlongsideEatOut, wasFirstPlan });
    } catch (error: any) {
      console.error("Error creating weekly plan:", error);
      res.status(500).json({ message: error.message || "Failed to create plan" });
    }
  });

  app.post("/api/plan/dinner-label", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planDayId, label } = req.body;

      const validLabels = ["move_early", "fiber_starter", "dusk_prep", "split_dinner"];
      if (!validLabels.includes(label)) {
        return res.status(400).json({ message: "Invalid dinner label" });
      }
      const id = Number(planDayId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "planDayId required" });
      }

      const targetDay = await storage.getWeeklyPlanDay(id);
      if (!targetDay) return res.status(404).json({ message: "Plan day not found" });
      const parentPlan = await storage.getWeeklyPlanById(targetDay.weeklyPlanId);
      if (!parentPlan || parentPlan.userId !== userId) {
        return res.status(403).json({ message: "Plan day does not belong to user" });
      }

      const updated = await storage.updateWeeklyPlanDay(id, { dinnerLabel: label });
      if (!updated) return res.status(404).json({ message: "Plan day not found" });

      res.json(updated);
    } catch (error) {
      console.error("Error setting dinner label:", error);
      captureException(error, req.user?.claims?.sub, { route: "/api/plan/dinner-label", method: "POST" });
      res.status(500).json({ message: "Failed to set dinner label" });
    }
  });

  app.post("/api/log", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, walkCompleted, walkTired, dietResponse, dinnerSuccess } = req.body;

      const now = new Date();
      const todayStrForLog = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const logIsBackfill = date < todayStrForLog;

      let result;
      const existing = await storage.getDailyLog(userId, date);
      if (existing) {
        const updateData: any = {};
        if (walkCompleted !== undefined) updateData.walkCompleted = walkCompleted;
        if (walkTired !== undefined) updateData.walkTired = walkTired;
        if (dietResponse !== undefined) updateData.dietResponse = dietResponse;
        if (dinnerSuccess !== undefined) updateData.dinnerSuccess = dinnerSuccess;
        result = await storage.updateDailyLog(existing.id, updateData);
      } else {
        result = await storage.createDailyLog({
          userId,
          date,
          walkCompleted: walkCompleted !== undefined ? walkCompleted : null,
          walkTired: walkTired !== undefined ? walkTired : null,
          dietResponse: dietResponse || null,
          dinnerSuccess: dinnerSuccess !== undefined ? dinnerSuccess : null,
          isBackfill: logIsBackfill,
        });
      }

      let nextDayAdjustment: { reduced: boolean; newDuration?: number; tomorrowWalkScheduled: boolean; walkCompleted: boolean; convertedToStretch?: boolean } | null = null;
      const isWalkRelatedUpdate = walkCompleted !== undefined || walkTired !== undefined;
      const finalLog = await storage.getDailyLog(userId, date);
      const plan = await storage.getWeeklyPlanForDate(userId, date);
      if (plan && finalLog && isWalkRelatedUpdate) {
        const planDays = await storage.getWeeklyPlanDays(plan.id);
        const logDate = new Date(date + "T00:00:00");
        const planStart = new Date(plan.startDate + "T00:00:00");
        const todayDow = Math.round((logDate.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
        const tomorrowDow = todayDow + 1;
        const todayPlanDay = planDays.find(d => d.dayOfWeek === todayDow);
        const walkDone = finalLog.walkCompleted === true;
        const isTired = finalLog.walkTired === true;
        const todayIsStretch = !!todayPlanDay?.isStretchDay;
        const todayIsStandingTap = !!todayPlanDay?.standingTap;

        if (tomorrowDow < 7 && !todayIsStandingTap) {
          const tomorrowDay = planDays.find(d => d.dayOfWeek === tomorrowDow);
          if (tomorrowDay && tomorrowDay.walkScheduled && !tomorrowDay.standingTap) {
            if (plan.isStretchWeek) {
              nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: true, walkCompleted: walkDone };
            } else if (todayIsStretch && walkDone) {
              await storage.updateWeeklyPlanDay(tomorrowDay.id, { isStretchDay: false });
              nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: true, walkCompleted: true };
            } else if (todayIsStretch && !walkDone && !isTired) {
              await storage.updateWeeklyPlanDay(tomorrowDay.id, { isStretchDay: false });
              nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: true, walkCompleted: false };
            } else if (todayIsStretch && !walkDone && isTired) {
              await storage.updateWeeklyPlanDay(tomorrowDay.id, { isStretchDay: true });
              nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: true, walkCompleted: false, convertedToStretch: true };
            } else if (!walkDone && isTired) {
              let shouldStretchAdjust = false;
              if (todayDow > 0) {
                const yesterdayDow = todayDow - 1;
                const yesterdayPlanDay = planDays.find(d => d.dayOfWeek === yesterdayDow);
                if (yesterdayPlanDay && yesterdayPlanDay.walkScheduled) {
                  const yesterdayDate = new Date(planStart);
                  yesterdayDate.setDate(yesterdayDate.getDate() + yesterdayDow);
                  const yesterdayDateStr = yesterdayDate.toISOString().split("T")[0];
                  const yesterdayLog = await storage.getDailyLog(userId, yesterdayDateStr);
                  if (yesterdayLog && yesterdayLog.walkCompleted === false && yesterdayLog.walkTired === true) {
                    shouldStretchAdjust = true;
                  }
                }
              }

              if (shouldStretchAdjust) {
                await storage.updateWeeklyPlanDay(tomorrowDay.id, { isStretchDay: true });
                nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: true, walkCompleted: false, convertedToStretch: true };
              } else {
                const newDuration = Math.max(tomorrowDay.walkDuration - 5, 5);
                await storage.updateWeeklyPlanDay(tomorrowDay.id, { walkDuration: newDuration });
                nextDayAdjustment = { reduced: true, newDuration, tomorrowWalkScheduled: true, walkCompleted: false };
              }
            } else {
              nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: true, walkCompleted: walkDone };
            }
          } else {
            nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: false, walkCompleted: walkDone };
          }
        } else {
          nextDayAdjustment = { reduced: false, tomorrowWalkScheduled: false, walkCompleted: walkDone };
        }
      }

      let coinsAwarded = 0;
      try {
        if (plan && finalLog) {
          const achievePlanDays = await storage.getWeeklyPlanDays(plan.id);
          const logDateObj = new Date(date + "T00:00:00");
          const planStartObj = new Date(plan.startDate + "T00:00:00");
          const dayOffset = Math.round((logDateObj.getTime() - planStartObj.getTime()) / (1000 * 60 * 60 * 24));
          const achieveTodayPlanDay = achievePlanDays.find(d => d.dayOfWeek === dayOffset);
          let prevWeekPlanDay: any = undefined;
          if (plan.weekNumber > 1) {
            const prevPlan = await storage.getWeeklyPlan(userId, plan.weekNumber - 1);
            if (prevPlan) {
              const prevPlanDays = await storage.getWeeklyPlanDays(prevPlan.id);
              prevWeekPlanDay = prevPlanDays.find(d => d.dayOfWeek === dayOffset);
            }
          }
          coinsAwarded = await evaluateDailyAchievements(userId, date, finalLog, plan, achieveTodayPlanDay, prevWeekPlanDay);
        }
      } catch (achErr) {
        console.error("Daily achievement evaluation error:", achErr);
      }

      res.json({ ...result, nextDayAdjustment, isBackfill: logIsBackfill, coinsAwarded });
    } catch (error) {
      console.error("Error creating log:", error);
      captureException(error, req.user?.claims?.sub, { route: "/api/log", method: "POST" });
      res.status(500).json({ message: "Failed to create log" });
    }
  });

  app.get("/api/log/:date", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const log = await storage.getDailyLog(userId, req.params.date);
      res.json(log || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch log" });
    }
  });

  app.get("/api/logs/:weekNumber", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const weekNumber = parseInt(req.params.weekNumber);
      const plan = await storage.getWeeklyPlan(userId, weekNumber);
      if (!plan) return res.json([]);
      const logs = await storage.getDailyLogsByWeek(userId, weekNumber, plan.startDate);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get("/api/calendar/:weekNumber", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const weekNumber = parseInt(req.params.weekNumber);
      const plan = await storage.getWeeklyPlan(userId, weekNumber);
      if (!plan) return res.json(null);

      const days = await storage.getWeeklyPlanDays(plan.id);
      const logs = await storage.getDailyLogsByWeek(userId, weekNumber, plan.startDate);

      const calendar = days.map(day => {
        const dayDate = new Date(plan.startDate);
        dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
        const dateStr = dayDate.toISOString().split("T")[0];
        const log = logs.find(l => l.date === dateStr);

        return {
          dayOfWeek: day.dayOfWeek,
          date: dateStr,
          walkScheduled: day.walkScheduled,
          eatOutScheduled: day.eatOutScheduled,
          lateDinnerScheduled: day.lateDinnerScheduled,
          walkCompleted: log?.walkCompleted ?? null,
          walkDuration: day.walkDuration,
          isStretchDay: day.isStretchDay,
          standingTap: day.standingTap,
          dinnerLabel: day.dinnerLabel,
          dinnerSuccess: log?.dinnerSuccess ?? null,
          dietResponse: log?.dietResponse ?? null,
          walkTired: log?.walkTired ?? null,
          planDayId: day.id,
        };
      });

      res.json({ plan, calendar });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar" });
    }
  });

  app.get("/api/report/monthly/:month", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = await generateMonthlyReportData(userId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate monthly report" });
    }
  });

  app.post("/api/fatigue/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { accept, dayOfWeek } = req.body;

      if (accept) {
        await storage.updateProfile(userId, { restDay: dayOfWeek });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update rest day" });
    }
  });

  app.get("/api/roadmap", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const roadmapGate = canUseFeature(profile, "roadmap");
      if (!roadmapGate.allowed) {
        return res.json({
          success: false,
          showPaywall: true,
          lockApp: roadmapGate.lockApp || false,
          feature: "roadmap",
        });
      }

      const plan = await storage.getCurrentWeeklyPlan(userId);
      const weekNumber = plan?.weekNumber || 0;

      let walkSuccessAvg = 0;
      let dinnerSuccessAvg = 0;
      let dietTipAttempts = 0;
      let dietTipCompletionCount = 0;

      if (weekNumber > 0) {
        const reportData = await generateWeeklyReportData(userId, weekNumber);
        if (reportData) {
          walkSuccessAvg = reportData.walkSuccessPct;
          dinnerSuccessAvg = reportData.dinnerSuccessPct || 0;
        }

        if (plan) {
          const startDate = plan.startDate instanceof Date
            ? plan.startDate.toISOString().split("T")[0]
            : String(plan.startDate);
          const logs = await storage.getDailyLogsByWeek(userId, weekNumber, startDate);
          dietTipCompletionCount = logs.filter(l => l.dietResponse === "yes").length;
        }
      }

      const allPlans = await storage.getAllWeeklyPlans(userId);
      const currentPlan = allPlans.find(p => p.weekNumber === profile.currentWeek) || plan;
      const pastPlans = allPlans.filter(p => p.weekNumber < profile.currentWeek);

      const lastNonNullPlan = allPlans.slice().reverse().find(p => p.dietStruggle) || null;
      const currentTip = lastNonNullPlan?.dietTip || null;

      const activeStruggle = currentPlan?.dietStruggle || null;
      const pastDietStruggles = [...new Set(pastPlans.map(p => p.dietStruggle).filter(Boolean))] as string[];
      const eatOutEver = await storage.hasAnyEatOutScheduled(userId);

      const currentCycle = (profile.currentStruggleCycle as number) || 1;

      let profileStruggles: string[];
      let masteredS: string[];
      let skippedS: string[];
      let difficultS: string[];
      let legacyTriedS: string[] = [];
      let cycle1MasteredS: string[] = [];

      if (currentCycle >= 3) {
        profileStruggles = (profile.struggles3 || []) as string[];
        masteredS = (profile.masteredStruggles3 || []) as string[];
        skippedS = (profile.skippedStruggles3 || []) as string[];
        difficultS = (profile.difficultStruggles3 || []) as string[];
      } else if (currentCycle === 2) {
        profileStruggles = (profile.struggles2 || []) as string[];
        masteredS = (profile.masteredStruggles2 || []) as string[];
        skippedS = (profile.skippedStruggles2 || []) as string[];
        difficultS = (profile.difficultStruggles2 || []) as string[];
        cycle1MasteredS = (profile.masteredStruggles || []) as string[];
      } else {
        profileStruggles = (profile.struggles || []) as string[];
        masteredS = (profile.masteredStruggles || []) as string[];
        skippedS = (profile.skippedStruggles || []) as string[];
        difficultS = (profile.difficultStruggles || []) as string[];
        legacyTriedS = (profile.triedBeforeStruggles || []) as string[];
      }

      const resolvedDifficult = currentCycle === 1
        ? [...new Set([...difficultS, ...legacyTriedS.filter(s => !skippedS.includes(s))])]
        : [...difficultS];

      const visibleStruggles = new Set([
        ...profileStruggles,
        ...(eatOutEver && !profileStruggles.includes("eat_out") ? ["eat_out"] : []),
      ]);

      const terminalSet = new Set([...masteredS, ...skippedS, ...resolvedDifficult]);

      const inProgressStruggles = STRUGGLE_PRIORITY.filter(s =>
        pastDietStruggles.includes(s) &&
        s !== activeStruggle &&
        !terminalSet.has(s) &&
        visibleStruggles.has(s)
      );

      const everActive = new Set([...pastDietStruggles, ...(activeStruggle ? [activeStruggle] : [])]);

      const upcomingStruggles = STRUGGLE_PRIORITY.filter(s =>
        visibleStruggles.has(s) &&
        !everActive.has(s) &&
        !terminalSet.has(s)
      );

      // Inactive = strictly "not in current cycle's pool".
      // Cycle 1: uses visibleStruggles (includes eatOutEver override).
      // Cycle 2: uses profileStruggles (struggles2) directly; hides cycle 1 mastered items.
      // Cycle 3: uses profileStruggles (struggles3) directly; no filtering.
      const profileStrugglesSet = new Set(profileStruggles);
      const inactiveStruggles = currentCycle >= 3
        ? STRUGGLE_PRIORITY.filter(s => !profileStrugglesSet.has(s))
        : currentCycle === 2
          ? STRUGGLE_PRIORITY.filter(s => !profileStrugglesSet.has(s) && !cycle1MasteredS.includes(s))
          : STRUGGLE_PRIORITY.filter(s => !visibleStruggles.has(s));

      let dinnerQueueStatus: string | null = null;
      if (profile.hasLateDinner) {
        if (profile.dinnerMastered) dinnerQueueStatus = "mastered";
        else if (profile.dinnerExitType === "moved_on") dinnerQueueStatus = "moved_on";
        else if (profile.dinnerExitType === "not_relevant") dinnerQueueStatus = "not_relevant";
        else if (plan?.isDinnerFocus) dinnerQueueStatus = "active";
        else dinnerQueueStatus = "upcoming";
      }

      res.json({
        activeStruggle,
        inProgressStruggles,
        masteredStruggles: masteredS,
        upcomingStruggles,
        skippedStruggles: skippedS,
        difficultStruggles: resolvedDifficult,
        inactiveStruggles,
        currentTip,
        isDinnerFocus: plan?.isDinnerFocus ?? (profile.hasLateDinner && !profile.dinnerMastered),
        dinnerMastered: profile.dinnerMastered,
        dinnerQueueStatus,
        walkSuccessAvg,
        dinnerSuccessAvg,
        dietTipCompletionCount,
        tipLadders: DIET_TIP_LADDERS,
        currentStruggleCycle: currentCycle,
        cycleHistory: await storage.getCycleHistory(userId),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roadmap" });
    }
  });

  app.get("/api/piggybank", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      const devOverride = devCoinOverrides.get(userId);
      res.json({
        coins: devOverride != null ? devOverride : profile.piggyBankCoins,
        capacity: 60,
        reward: profile.piggyBankReward ?? null,
        needsRewardSetup: profile.piggyBankNeedsRewardSetup,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch piggy bank" });
    }
  });

  app.post("/api/piggybank/reward", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reward } = req.body;
      if (!reward || typeof reward !== "string" || reward.trim().length === 0) {
        return res.status(400).json({ message: "Reward text is required" });
      }
      const profile = await storage.setPiggyBankReward(userId, reward.trim());
      res.json({ reward: profile?.piggyBankReward, needsRewardSetup: false });
    } catch (error) {
      res.status(500).json({ message: "Failed to set reward" });
    }
  });

  app.post("/api/piggybank/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      if (profile.piggyBankCoins < 60) {
        return res.status(400).json({ message: "Piggy bank is not full yet" });
      }
      await storage.claimPiggyBank(userId);
      res.json({ claimed: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });

  const DEV_EMAILS = ["yusycyn@gmail.com", "cynthiayuyu@hotmail.com", "glukkysugarapp@gmail.com"];
  const TEST_EMAIL_PATTERN = /^test-.*@glukky\.test$/;
  const devTimeOverrides = new Map<string, number | null>();
  const devDateOverrides = new Map<string, string | null>();
  const devCoinOverrides = new Map<string, number | null>();

  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  // One single daily snap cap per App Store subscription. The advice
  // endpoint no longer keeps its own counter — advice is always
  // downstream of a successful snap, so the snap counter is the single
  // source of truth. The advice endpoint reads the snap counter to
  // populate its existing adviceUsedToday/adviceLimit response fields
  // for backward client compatibility.
  const SNAP_LABEL_DAILY_LIMIT = 2;
  const snapLabelCount = new Map<string, { date: string; count: number }>();
  // Backstop counter for /api/snap/advice. The label cap above
  // already bounds normal-flow advice (advice runs after an admitted
  // label, and label is capped at SNAP_LABEL_DAILY_LIMIT/day per
  // shared quota key). This counter exists ONLY to bound the cost
  // of direct /api/snap/advice spam that bypasses /label — it
  // increments once per advice request that actually hit Claude
  // (i.e. at least one locale was a cache miss). Cache-hit advice
  // does NOT increment, so a normal user re-viewing previously
  // generated advice is unaffected. Capped at the same daily limit
  // as label, keyed by the same shared quota key.
  const snapAdviceClaudeCount = new Map<string, { date: string; count: number }>();
  // Internal/test allowlist: these user IDs bypass the snap/label and snap/advice daily caps.
  const UNLIMITED_SNAP_USER_IDS = new Set<string>([
    "cee83e6f-0ae6-402d-a973-bc46c64a19b4", // yusycyn@gmail.com (correct production user id; old 352049ea-… was stale and never matched)
    "770c837e-10bc-4ec1-b891-0683cdc07a96", // cynthiayuyu@hotmail.com
    "e6a689aa-3092-488b-adcc-ef9d68315cbd", // bbb@gmail.com
    "f9396538-ff03-49f9-a6f7-8dab8039ebfb", // iva_40@yahoo.com.hk
  ]);

  // Daily window resets at midnight Hong Kong time so the cap aligns
  // with the user's local "new day" rather than UTC. en-CA yields
  // YYYY-MM-DD, which sorts correctly as a date string.
  function todayHKT(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  }

  function getDailyCount(map: Map<string, { date: string; count: number }>, key: string): number {
    const today = todayHKT();
    const entry = map.get(key);
    if (!entry || entry.date !== today) return 0;
    return entry.count;
  }

  function incrementDailyCount(map: Map<string, { date: string; count: number }>, key: string): void {
    const today = todayHKT();
    const entry = map.get(key);
    if (!entry || entry.date !== today) {
      map.set(key, { date: today, count: 1 });
    } else {
      entry.count += 1;
    }
  }

  // Resolve the daily-quota key for snap requests. When the user has a
  // RevenueCat customerId on file (set on /api/refresh-premium-status
  // by the native bridge), every Glukky account on the same App Store
  // subscription shares one quota — that closes the multi-account abuse
  // vector where one paying device could spawn N free accounts. When
  // no rcCustomerId is on file (web, dev, bridge offline) we fall back
  // to the Glukky userId, preserving today's per-account behavior.
  function resolveSnapQuotaKey(
    userId: string,
    profile: { rcCustomerId?: string | null } | null | undefined,
  ): { key: string; source: "rc" | "user" } {
    const rcId = (profile?.rcCustomerId || "").trim();
    if (rcId) return { key: rcId, source: "rc" };
    return { key: userId, source: "user" };
  }

  const isDevUser = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await authStorage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const email = user.email?.toLowerCase()?.trim();
    if (DEV_EMAILS.some(d => d.toLowerCase().trim() === email) || (email && TEST_EMAIL_PATTERN.test(email))) {
      return next();
    }
    return res.status(403).json({ message: "Forbidden" });
  };

  app.post("/api/dev/set-coins", isAuthenticated, isDevUser, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { coins } = req.body;
    if (coins === null || coins === undefined) {
      devCoinOverrides.delete(userId);
    } else {
      const n = Number(coins);
      if (!isFinite(n) || n < 0 || n > 60) {
        return res.status(400).json({ message: "coins must be 0–60 or null" });
      }
      devCoinOverrides.set(userId, n);
    }
    res.json({ coinsOverride: devCoinOverrides.get(userId) ?? null });
  });

  app.post("/api/dev/test-notification", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type } = req.body;
      if (!["late_dinner", "sunday_planning", "reengagement", "daily_checkin"].includes(type)) {
        return res.status(400).json({ message: "type must be late_dinner, sunday_planning, reengagement, or daily_checkin" });
      }
      const profile = await storage.getProfile(userId);
      if (!profile?.onesignalPlayerId) {
        return res.status(400).json({ message: "No OneSignal player ID registered. Open the app in the mobile wrapper first." });
      }
      const tmpl = DEV_TEST_TEMPLATES[type];
      const result = await sendPushNotification({
        title:    { en: tmpl.en.title,    "zh-Hant": tmpl.zhHant.title },
        subtitle: { en: tmpl.en.subtitle, "zh-Hant": tmpl.zhHant.subtitle },
        message:  { en: tmpl.en.message,  "zh-Hant": tmpl.zhHant.message },
        deepLink: tmpl.deepLink,
        playerIds: [profile.onesignalPlayerId],
      });
      res.json({ success: result.success, type, notificationId: result.notificationId });
    } catch (error: any) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // ---- OneSignal probe + status (dev-gated) ----
  // Surface registration state to the dev panel so we can answer
  // "is yusycyn's device actually registered?" without a DB query.
  // The probe endpoint also persists the most recent client-side
  // bridge attempt in memory, indexed by user id, so the panel can
  // render the last lookup result alongside the stored player_id.
  type OneSignalBridgeProbe = {
    receivedAt: string;
    paths: Array<{
      name: string;
      methodPresent: boolean | null;
      promiseShaped: boolean | null;
      raw: unknown;
      extractedId: string | null;
      error: string | null;
    }>;
    permission: {
      state: string | null;        // granted / denied / not-yet-asked / unknown
      raw: unknown;
      source: string | null;       // which bridge reported it
    };
    chosenSource: string | null;
    chosenPlayerId: string | null;
    timezone: string | null;
    userAgent: string | null;
  };
  const lastOneSignalProbe = new Map<string, OneSignalBridgeProbe>();

  app.post(
    "/api/dev/onesignal-bridge-probe",
    isAuthenticated,
    isDevUser,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const user = await authStorage.getUser(userId);
        const email = user?.email ?? "?";
        const body = (req.body ?? {}) as Partial<OneSignalBridgeProbe>;

        // Accept whatever shape the client sends, but truncate /
        // sanitize before holding it in memory or logging it.
        const safe: OneSignalBridgeProbe = {
          receivedAt: new Date().toISOString(),
          paths: Array.isArray(body.paths)
            ? body.paths.slice(0, 12).map((p: any) => ({
                name: typeof p?.name === "string" ? p.name.slice(0, 64) : "?",
                methodPresent: typeof p?.methodPresent === "boolean" ? p.methodPresent : null,
                promiseShaped: typeof p?.promiseShaped === "boolean" ? p.promiseShaped : null,
                raw: typeof p?.raw === "string" ? p.raw.slice(0, 400) : p?.raw ?? null,
                extractedId: typeof p?.extractedId === "string" ? p.extractedId.slice(0, 80) : null,
                error: typeof p?.error === "string" ? p.error.slice(0, 200) : null,
              }))
            : [],
          permission: {
            state:
              typeof body?.permission?.state === "string"
                ? body.permission.state.slice(0, 32)
                : null,
            raw:
              typeof body?.permission?.raw === "string"
                ? (body.permission.raw as string).slice(0, 200)
                : body?.permission?.raw ?? null,
            source:
              typeof body?.permission?.source === "string"
                ? body.permission.source.slice(0, 64)
                : null,
          },
          chosenSource:
            typeof body?.chosenSource === "string" ? body.chosenSource.slice(0, 64) : null,
          chosenPlayerId:
            typeof body?.chosenPlayerId === "string" ? body.chosenPlayerId.slice(0, 80) : null,
          timezone:
            typeof body?.timezone === "string" ? body.timezone.slice(0, 64) : null,
          userAgent:
            typeof body?.userAgent === "string" ? body.userAgent.slice(0, 200) : null,
        };

        lastOneSignalProbe.set(userId, safe);

        // Log a single, scannable summary so the actual problem
        // device's bridge state shows up in `npm run dev` / deploy
        // logs without a follow-up DB query.
        const pathSummary = safe.paths
          .map(
            (p) =>
              `${p.name}=${p.methodPresent === false ? "missing" : p.extractedId ? `id(${p.extractedId.slice(0, 8)}…)` : p.error ? `err` : p.promiseShaped === false ? "callback-no-result" : "no-id"}`,
          )
          .join(",");
        console.log(
          `onesignal/probe email=${email} permission=${safe.permission.state ?? "?"} chosen=${safe.chosenSource ?? "none"} chosen_id=${safe.chosenPlayerId ?? "none"} tz=${safe.timezone ?? "?"} paths=[${pathSummary}]`,
        );

        res.json({ ok: true });
      } catch (error: any) {
        console.error("onesignal-bridge-probe error:", error);
        res.status(500).json({ message: "probe failed", error: error?.message ?? "unknown" });
      }
    },
  );

  app.get(
    "/api/dev/onesignal-status",
    isAuthenticated,
    isDevUser,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const [user, profile] = await Promise.all([
          authStorage.getUser(userId),
          storage.getProfile(userId),
        ]);
        res.json({
          email: user?.email ?? null,
          userId,
          onesignalPlayerId: profile?.onesignalPlayerId ?? null,
          onesignalRegisteredAt: profile?.onesignalRegisteredAt
            ? new Date(profile.onesignalRegisteredAt).toISOString()
            : null,
          deviceTimezone: profile?.deviceTimezone ?? null,
          lastBridgeProbe: lastOneSignalProbe.get(userId) ?? null,
        });
      } catch (error: any) {
        console.error("onesignal-status error:", error);
        res.status(500).json({ message: "status failed" });
      }
    },
  );

  app.get("/api/dev/state", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      const plan = await storage.getCurrentWeeklyPlan(userId);
      let days: any = null;
      let logs: any = null;
      if (plan) {
        days = await storage.getWeeklyPlanDays(plan.id);
        logs = await storage.getDailyLogsByWeek(userId, plan.weekNumber, plan.startDate);
      }
      const timeOverride = devTimeOverrides.get(userId) ?? null;
      const dateOverride = devDateOverrides.get(userId) ?? null;
      res.json({ profile, plan, days, logs, timeOverride, dateOverride });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dev state" });
    }
  });

  app.get("/api/dev/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        console.error("Dev check: no userId in session");
        return res.json({ isDev: false });
      }
      const user = await authStorage.getUser(userId);
      if (!user) {
        console.error("Dev check: user not found for id", userId);
        return res.json({ isDev: false });
      }
      const email = user.email?.toLowerCase()?.trim();
      const isDev = DEV_EMAILS.some(d => d.toLowerCase().trim() === email);
      res.json({ isDev });
    } catch (error) {
      console.error("Dev check error:", error);
      res.json({ isDev: false });
    }
  });

  app.post("/api/dev/set-week", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { weekNumber } = req.body;
      await storage.updateProfile(userId, { currentWeek: weekNumber });
      res.json({ success: true, weekNumber });
    } catch (error) {
      res.status(500).json({ message: "Failed to set week" });
    }
  });

  app.post("/api/dev/set-profile", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fields = req.body;
      const allowed = ["walkDuration", "walksPerWeek",
        "dinnerMastered", "hasLateDinner", "restDay", "dinnerTime"];
      const update: any = {};
      for (const key of allowed) {
        if (fields[key] !== undefined) update[key] = fields[key];
      }
      await storage.updateProfile(userId, update);
      const profile = await storage.getProfile(userId);
      res.json({ success: true, profile });
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/dev/set-time", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { hour, date } = req.body;
      if (hour !== undefined) {
        if (hour === null) {
          devTimeOverrides.delete(userId);
        } else {
          devTimeOverrides.set(userId, hour);
        }
      }
      if (date !== undefined) {
        if (date === null) {
          devDateOverrides.delete(userId);
        } else {
          devDateOverrides.set(userId, date);
        }
      }
      res.json({
        success: true,
        timeOverride: devTimeOverrides.get(userId) ?? null,
        dateOverride: devDateOverrides.get(userId) ?? null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to set time override" });
    }
  });

  app.post("/api/dev/reset-account", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.resetUser(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset account" });
    }
  });

  app.get("/api/dev/time", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json({
      timeOverride: devTimeOverrides.get(userId) ?? null,
      dateOverride: devDateOverrides.get(userId) ?? null,
    });
  });

  app.post("/api/dev/generate-history", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { weeks, walkSuccessRate = 70, dietSuccessRate = 60 } = req.body;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(400).json({ message: "No profile" });

      const startWeek = profile.currentWeek;
      const results: any[] = [];

      for (let w = startWeek; w < startWeek + weeks; w++) {
        await storage.updateProfile(userId, { currentWeek: w });

        const walkDays = [0, 1, 2];
        const planInput = {
          userId,
          walkDays,
          eatOutDays: [] as number[],
          lateDinnerDays: profile.hasLateDinner ? [1, 3, 5] : [],
          negotiationChoice: "keep_current",
        };

        const { plan, days } = await createWeeklyPlan(planInput);

        for (let d = 0; d < 7; d++) {
          const dayDate = new Date(plan.startDate);
          dayDate.setDate(dayDate.getDate() + d);
          const dateStr = dayDate.toISOString().split("T")[0];

          const day = days.find(dd => dd.dayOfWeek === d);
          const doWalk = day?.walkScheduled && Math.random() * 100 < walkSuccessRate;
          const dietOk = Math.random() * 100 < dietSuccessRate;
          const dinnerOk = day?.lateDinnerScheduled && Math.random() * 100 < 50;

          await storage.createDailyLog({
            userId,
            date: dateStr,
            walkCompleted: day?.walkScheduled ? (doWalk || false) : null,
            walkTired: day?.walkScheduled ? Math.random() < 0.2 : false,
            dietResponse: dietOk ? "yes" : (Math.random() < 0.3 ? "no_chance" : "no"),
            dinnerSuccess: day?.lateDinnerScheduled ? (dinnerOk || false) : null,
          });
        }

        results.push({ week: w, planId: plan.id });
      }

      const finalWeek = startWeek + weeks;
      await storage.updateProfile(userId, { currentWeek: finalWeek });

      res.json({ success: true, generatedWeeks: results, currentWeek: finalWeek });
    } catch (error) {
      console.error("Error generating history:", error);
      res.status(500).json({ message: "Failed to generate history" });
    }
  });

  app.post("/api/dev/patch-profile", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allowed = [
        "walkDuration", "walksPerWeek", "dinnerMastered", "hasLateDinner",
        "restDay", "dinnerTime", "struggles",
        "masteredStruggles", "skippedStruggles", "difficultStruggles", "triedBeforeStruggles",
        "currentWeek", "tipCycleStartWeek", "tipStayCycles", "isStretchMode", "stretchSuccessWeeks",
        "currentStruggleCycle", "repickPending", "struggles2", "masteredStruggles2",
        "skippedStruggles2", "difficultStruggles2", "dinnerExitType", "cycle2Active",
      ];
      const update: any = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) update[key] = req.body[key];
      }
      await storage.updateProfile(userId, update);
      const profile = await storage.getProfile(userId);
      res.json({ success: true, profile });
    } catch (error) {
      res.status(500).json({ message: "Failed to patch profile" });
    }
  });

  app.post("/api/dev/setup-repick-scenario", isAuthenticated, isDevUser, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Reset everything
      await storage.resetUser(userId);

      // Week 6 ends on this Sunday; set all 6 week start dates accordingly
      const week6Sunday = "2026-03-22";
      const week6Start = new Date("2026-03-16"); // Monday of week 6

      // Overwrite profile fields with scenario values (resetUser already cleared cycle/mastery fields)
      await storage.updateProfile(userId, {
        walksPerWeek: 3,
        walkDuration: 20,
        dinnerTime: "before_9pm",
        sleepPattern: "regular_10_6",
        eatingOutFrequency: "1_2",
        struggles: ["sugary_food_drink", "eat_out", "portions"],
        hasLateDinner: false,
        onboardingComplete: true,
        currentWeek: 1,
      } as any);

      // Week config: weeks 1-3 = sugary (high success), weeks 4-6 = portions (high no_chance)
      const weekConfig = [
        { struggle: "sugary_food_drink" },
        { struggle: "sugary_food_drink" },
        { struggle: "sugary_food_drink" },
        { struggle: "portions" },
        { struggle: "portions" },
        { struggle: "portions" },
      ];

      for (let wi = 0; wi < 6; wi++) {
        const weekNumber = wi + 1;
        const startDate = new Date(week6Start);
        startDate.setDate(week6Start.getDate() - (5 - wi) * 7);
        const startDateStr = startDate.toISOString().split("T")[0];
        const { struggle } = weekConfig[wi];

        // Create plan directly via storage (bypass engine struggle selection)
        const plan = await storage.createWeeklyPlan({
          userId,
          weekNumber,
          startDate: startDateStr,
          walkFrequencyGoal: 3,
          walkDurationGoal: 20,
          dietStruggle: struggle,
          dietTip: (DIET_TIP_LADDERS[struggle] || [])[0] || null,
          isDinnerFocus: false,
          firstActiveDay: 0,
          isStretchWeek: false,
          planStruggleCycle: 1,
        });

        // Create plan days (Mon/Wed/Fri walk, no eat-out)
        const planDays = Array.from({ length: 7 }, (_, d) => ({
          weeklyPlanId: plan.id,
          dayOfWeek: d,
          walkScheduled: [0, 2, 4].includes(d),
          eatOutScheduled: false,
          lateDinnerScheduled: false,
          dinnerLabel: "none" as const,
          walkDuration: [0, 2, 4].includes(d) ? 20 : 0,
          isStretchDay: false,
          standingTap: false,
        }));
        await storage.createWeeklyPlanDays(planDays);

        // Create daily logs with deterministic diet responses
        // Weeks 1-3 (sugary): 6 "yes" + 1 "no" → yesRate 6/7 = 0.857 ≥ 0.762 → mastered
        // Weeks 4-6 (portions): 6 "no_chance" + 1 "no" → noChanceRate 0.857 ≥ 0.762 → not_relevant
        for (let d = 0; d < 7; d++) {
          const logDate = new Date(startDate);
          logDate.setDate(startDate.getDate() + d);
          const dateStr = logDate.toISOString().split("T")[0];
          let dietResponse: "yes" | "no" | "no_chance";
          if (wi < 3) {
            dietResponse = d === 6 ? "no" : "yes";
          } else {
            dietResponse = d === 6 ? "no" : "no_chance";
          }
          await storage.createDailyLog({
            userId,
            date: dateStr,
            walkCompleted: [0, 2, 4].includes(d) ? true : null,
            walkTired: false,
            dietResponse,
            dinnerSuccess: null,
          });
        }

        // Advance currentWeek after each plan is created
        await storage.updateProfile(userId, { currentWeek: weekNumber + 1 });
      }

      // Set mastery state: sugary mastered after week 3 reflection (portions still unevaluated)
      await storage.updateProfile(userId, {
        masteredStruggles: ["sugary_food_drink"],
        currentWeek: 7,
      });

      // Set date + time override: Sunday 2026-03-22 at 22:00 (planning window open)
      devDateOverrides.set(userId, week6Sunday);
      devTimeOverrides.set(userId, 22);

      res.json({
        success: true,
        message: "Repick scenario ready",
        dateOverride: week6Sunday,
        timeOverride: 22,
        weeks: weekConfig.map((wc, i) => ({
          week: i + 1,
          struggle: wc.struggle,
          dietOutcome: i < 3 ? "→ mastered" : "→ not_relevant (skipped)",
        })),
        expectedRepickTrigger: "yes — all mustGoThrough (sugary ✓ appeared + mastered, portions ✓ appeared) satisfied; eat_out never scheduled so exempted",
      });
    } catch (error: any) {
      console.error("Error setting up repick scenario:", error);
      res.status(500).json({ message: error.message || "Failed to set up scenario" });
    }
  });

  function getIngredientLabel(vocab: { labelEn: string; labelZh: string; labelYue: string }, locale: string): string {
    if (locale === "zh-Hant") return vocab.labelZh;
    if (locale === "yue") return vocab.labelYue;
    return vocab.labelEn;
  }

  function buildInternalId(name: string, portionId: string, sauceIds: string[], toppingIds: string[]): string {
    const namePart = name.trim().toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return [
      namePart,
      portionId,
      ...[...sauceIds].sort(),
      ...[...toppingIds].sort(),
    ].filter(Boolean).join("__");
  }

  async function resolveToInternalIds(rawText: string | null, category: string): Promise<string[]> {
    if (!rawText) return [];
    const parts = rawText.split(/[,、，]/).map(s => s.trim()).filter(Boolean);
    const ids: string[] = [];
    for (const part of parts) {
      const matches = await storage.getIngredientsByAlias(part, category);
      if (matches.length === 1) {
        ids.push(matches[0].internalId);
      } else {
        ids.push(part.toLowerCase());
      }
    }
    return ids;
  }

  async function resolveFromTokenResolutions(resolutions: Array<{ text: string; resolvedId: string | null }>, category: string): Promise<string[]> {
    const ids: string[] = [];
    for (const token of resolutions) {
      if (token.resolvedId) {
        ids.push(token.resolvedId);
      } else {
        const matches = await storage.getIngredientsByAlias(token.text, category);
        if (matches.length === 1) {
          ids.push(matches[0].internalId);
        } else {
          ids.push(token.text.trim().toLowerCase());
        }
      }
    }
    return ids;
  }

  // MCHK §5 — Granular named consent management
  app.get("/api/user/consent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rows } = await pool.query<{ service_name: string; consented: boolean; consented_at: string }>(
        `SELECT DISTINCT ON (service_name) service_name, consented, consented_at
         FROM user_consents
         WHERE user_id = $1
         ORDER BY service_name, consented_at DESC`,
        [userId]
      );
      const consents: Record<string, boolean> = {};
      const consentDetails: Record<string, { consented: boolean; consentedAt: string }> = {};
      for (const row of rows) {
        consents[row.service_name] = row.consented;
        consentDetails[row.service_name] = { consented: row.consented, consentedAt: row.consented_at };
      }
      res.json({ consents, consentDetails, hasSubmitted: rows.length > 0 });
    } catch (error: any) {
      console.error("Error fetching consent:", error);
      res.status(500).json({ message: "Failed to fetch consent" });
    }
  });

  app.post("/api/user/consent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const decisions = z.array(z.object({ service: z.string().min(1), consented: z.boolean() })).parse(req.body);
      const appVersion = BUILD_INFO.sha ?? null;
      const ipAddress = (req.ip ?? null) as string | null;
      await Promise.all(
        decisions.map(({ service, consented }) =>
          pool.query(
            `INSERT INTO user_consents (user_id, service_name, consented, consented_at, ip_address, app_version)
             VALUES ($1, $2, $3, NOW(), $4, $5)`,
            [userId, service, consented, ipAddress, appVersion]
          )
        )
      );
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Error saving consent:", error);
      res.status(500).json({ message: "Failed to save consent" });
    }
  });

  app.post("/api/snap/label", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // MCHK §5 — Claude consent gate
      const { rows: _labelConsent } = await pool.query<{ consented: boolean }>(
        `SELECT consented FROM user_consents WHERE user_id = $1 AND service_name = 'claude' ORDER BY consented_at DESC LIMIT 1`,
        [userId]
      );
      if (_labelConsent.length === 0 || !_labelConsent[0].consented) {
        return res.status(403).json({ success: false, message: "AI processing consent not given", consentRequired: "claude" });
      }

      const snapProfile = await storage.getProfile(userId);
      if (snapProfile) {
        const snapGate = canUseFeature(snapProfile, "food_snap_capture");
        if (!snapGate.allowed) {
          return res.json({
            success: false,
            showPaywall: true,
            lockApp: snapGate.lockApp || false,
            feature: "food_snap_capture",
          });
        }
      }

      const labelQuotaKey = resolveSnapQuotaKey(userId, snapProfile);
      if (!UNLIMITED_SNAP_USER_IDS.has(userId) && getDailyCount(snapLabelCount, labelQuotaKey.key) >= SNAP_LABEL_DAILY_LIMIT) {
        console.log(`[snap/label] user=${userId} quotaKey=${labelQuotaKey.key} source=${labelQuotaKey.source} usedToday=${SNAP_LABEL_DAILY_LIMIT}/${SNAP_LABEL_DAILY_LIMIT} -> 429 daily cap`);
        return res.status(429).json({ message: `Daily limit of ${SNAP_LABEL_DAILY_LIMIT} photo analyses reached. Try again tomorrow.`, snapsLimit: SNAP_LABEL_DAILY_LIMIT, snapsUsedToday: SNAP_LABEL_DAILY_LIMIT });
      }

      const { imageBase64, mimeType, language } = req.body;
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ message: "imageBase64 and mimeType are required" });
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ message: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." });
      }

      const nameLangLabel: Record<string, string> = {
        en: "English",
        "zh-Hant": "Traditional Chinese (繁體中文)",
        yue: "Written Cantonese (廣東話書面語)",
      };
      const nameLocale = language || "en";
      const responseLang = nameLangLabel[nameLocale] ?? "English";

      const isFirstSnap = !snapProfile?.hasTriedFirstFoodSnap;

      const nameOnlyBaseSystem = `You are a food identification assistant for Hong Kong cuisine.

════════════════════════════════════
STEP 1 — SPATIAL ANALYSIS (do this before anything else)
════════════════════════════════════
Mentally divide the image into regions. Each bowl, plate, cup, or
distinct food area is one region. Number them: Region 1, Region 2, etc.

For EACH region, describe before naming:
• Colour and surface texture
• Cooking method visible (steamed / fried / soupy / raw)
• Solid, liquid, or mixed
• Approximate share of the total photo (largest, second, small side)

Only after describing all regions, assign a food name to each.
List all visible dishes first, describe each, then name each individually.
Do not let one region's content or colour influence another's label.
When a dish could belong to HK, Mainland Chinese, or Taiwanese cuisine,
default to the HK variant and HK naming convention.
Example: use 魚蛋粉 not 魚丸米粉.
Never substitute a Western name for a recognisable HK dish.
Write your spatial analysis in the "_reasoning" field. This field is
for internal reasoning only and will be stripped before the response
is used — but you MUST complete it fully before producing the name.

════════════════════════════════════
STEP 2 — NAME THE DISH
════════════════════════════════════
Pick the 1–2 regions with the largest visible portion as the main
components. Name them using this format:

English: "[Main] with [accompaniment]"
Chinese: 「配」= served with (e.g. 雲吞麵配菜心)
         「加」= added on top (e.g. 炒飯加蛋)

ALWAYS use with/配/加 when an accompaniment is visible.
"Wonton noodles" alone is WRONG if choi sum is visible.
A visible accompaniment that is one of the top 2 components belongs
in the name via with/配/加 — NOT in the extras field. Only smaller
garnishes, toppings, or 3rd-and-beyond items go into extras.
Example: wonton noodles (largest) + choi sum (second) + peanuts →
  name = "Wonton noodles with choi sum", extras = "peanuts"

Prefer the standard, commonly used Hong Kong dish name — the name a
local would use on a cha chaan teng / 茶記 / noodle shop menu.
Use the most common spelling and singular/plural form
(e.g. "Wonton noodles", "雲吞麵", "叉燒飯", "牛腩米線").
Do NOT invent poetic phrasings or rare variations.

Fixed compound terms — do not split these even though they contain
和/加/配 as part of the word. These are exceptions to the 配/加
connector rule above, not replacements for it:
  • 和牛 = Wagyu beef (NOT "and + beef")
  • 加州卷 = California roll
  • 配料 = a fixed term meaning "ingredients/toppings"
When in doubt, prefer keeping the term whole over splitting it.

════════════════════════════════════
STEP 3 — APPLY WRAPPER RULE (critical)
════════════════════════════════════
NEVER return a meal-occasion or format word as the name alone:
✗ Forbidden standalone names (in any language): set, combo, breakfast,
  lunch, dinner, afternoon tea, 套餐, 常餐, 快餐, 茶餐, 茶餐廳早餐,
  飯盒, 便當, 弁当, plate, box, board, bento, mezze, platter.
  So "Hong Kong style breakfast set", "香港茶餐廳早餐套餐", "Bento box",
  "Mezze plate", "Afternoon tea set" are NOT allowed.

✓ Allowed when a food-category noun precedes the wrapper:
  燒味拼盤, Seafood platter, Dim sum platter, Charcuterie board,
  Sashimi platter — the wrapper is anchored on a real food noun.

Instead: identify the 1–2 largest actual food items and name those.
Strip the wrapper, name the actual items:
- EN: toast + fried egg → name = "Toast with fried egg", sides = "sausage, milk tea"
- 繁中: 同樣的早餐 → name = "多士配煎蛋", sides = "煎腸仔，奶茶"
- EN: bento of wagyu + rice → name = "Wagyu with rice", sides = "pickled radish, miso soup"

Keep the wrapper (real food category precedes it):
- 繁中: name = "燒味拼盤", sides = "叉燒，燒鴨，油雞" ✓
- EN: name = "Seafood platter", sides = "shrimp, scallop, oyster" ✓

Bottom line: the entry as a whole (name + sides) MUST contain at least
one actual food item. Format-only output is never acceptable.

════════════════════════════════════
SPECIFIC DISTINCTIONS (refer if unsure)
════════════════════════════════════

Noodles
• 米粉 — thin, white, round rice threads; thinner than 米線; straight (not wavy).
• 米線 — white, round, slightly thicker than 米粉; smooth surface; always in soup.
• 河粉 — wide, flat, opaque white strips; silky surface; often stir-fried or in soup.
• 幼麵 — thin yellow egg noodles; wiry and springy; in soup or tossed.
• 粗麵 — thick yellow egg noodles; chewy; wider than 幼麵.
• 公仔麵 — yellow, wavy/crimped instant noodles.
• 腸粉 — rolled rice noodle sheets; soft, shiny, tube-like; often with filling.

Rice and Congee
• 白飯 — plain white, loose steamed grains; bright white colour.
• 紅米飯 — reddish-brown rice; visibly darker than white rice.
• 白粥 — plain pale congee; smooth and watery; no visible solid toppings.
• 皮蛋瘦肉粥 — congee with visible dark translucent egg pieces.

Cha Chaan Teng Drinks
For drinks, prefer container shape + liquid colour + garnish cues over shade alone.
• 凍檸茶 — cold amber tea in a glass or plastic cup with ice; lemon slice on rim or inside.
• 熱檸茶 — same amber tea served hot in a ceramic cup or glass; lemon slice visible; no ice.
• 凍奶茶 — cold milky yellowish-brown tea in a glass with ice; opaque from milk.
• 熱奶茶 — hot milky yellowish-brown tea; often in a ceramic tea cup. Sometimes served with sugar cube or packed sugar packet.
• 好立克 — milk-white, creamy drink; paler than milk tea.
• 阿華田 — similar to milk tea but more reddish-brown; milk tea is more yellowish-brown.
• If still uncertain between 奶茶 and 阿華田, default to 奶茶.

Cha Chaan Teng Food
• 炒滑蛋 — soft, pale-yellow scrambled egg; glossy surface; no browning. NOT salmon.
• 煎蛋 — fried egg with a set white and a visible yolk; edges may be crispy.
• 奶油豬 — thick white bun or bread with butter and condensed milk on top.
• 蒜蓉包 — bun with a visible garlic topping; golden-brown surface.
• 多士 — thin bread, toasted only; NOT deep-fried.
• 西多士 — deep-fried French toast; golden-brown and thick; served with butter and syrup.

Meat
• 牛扒 — thick slab or thinly sliced beef with clear grill marks or seared brown surface;
  served on a plate or over noodles.
• 牛肉 — thinner beef slices; less dense than 牛扒; no grill marks.
• 叉燒 — reddish-brown glazed pork; sliced or in chunks; caramelised shiny surface.
  Never a whole slab.
• 腩肉 — thick pork-belly slices with visible fat bands. Commonly pairs with 米線.
• 豬潤 — dark sliced liver in soup; smoother and less meaty-looking than beef slices.
• 豬紅 — firm, dark reddish-brown cubes in soup or noodles. NOT tofu.
• 豆腐花 — smooth, white, soft; served in a bowl with syrup. NOT savoury.
• 竹笙 — pale white, hollow, latticed tube, soft; always in soup/braised.
  NOT flat/golden/crispy (炸魚皮), NOT solid (魚蛋).
• 牛丸 — darker, slightly textured beef ball.
• 魚蛋 — pale yellow/white, smooth fish ball.

════════════════════════════════════
OUTPUT RULES (strict)
════════════════════════════════════
Return ONLY this JSON — no prose, no markdown fences, no explanation:
{ "_reasoning": "<your full spatial analysis from Step 1>", "name": "<food name in ${responseLang}>" }
The "_reasoning" field will be stripped server-side and is never shown to users.
The "name" value MUST be in ${responseLang}.
Side-dish separator: comma only "," (EN) or "，" (ZH).
Never use 、or with/配/加 as separators in the sides field.
No ingredient may appear in both name AND sides.
If no food visible: {"error":"no_food"}`;

      const labelsOnlySystem = (foodName: string) => `You are a food assistant for Hong Kong cuisine. The dish in the photo has already been identified as: "${foodName}".

Look at the same photo and return ONLY a single JSON object with this exact shape:
{ "portion": "<小/中/大>", "sauces": "<visible sauces/condiments or null>", "extras": "<additional toppings/sides not already in the dish name, or null>" }

All field values MUST be in ${responseLang}.

Rules for "extras":
- Do NOT list any ingredient that is already part of the dish name "${foodName}". If an ingredient is in the name, it does NOT belong in extras.
- Only list small accompaniments, side toppings, or garnishes that you can actually see in the photo.
- If a drink is visible anywhere in the photo and it is NOT already part of the dish name "${foodName}", include it in the extras field.
- If there are no additional toppings/sides or drinks, return null.
- When there are 2+ items, separate them with commas ONLY: "," for English, "，" for Chinese. Do NOT use the ideographic comma "、".
  Do NOT use with / 配 / 加 / 和 / and / 及 as separators — those are connector words reserved for the dish name.
  Example (correct): "煎腸仔，奶茶" or "sausage, milk tea"
  Example (WRONG): "菜心配雞蛋", "sausage and milk tea"

════════════════════════════════════
SPECIFIC DISTINCTIONS (refer if unsure)
════════════════════════════════════

Cha Chaan Teng Drinks
For drinks, prefer container shape + liquid colour + garnish cues over shade alone.
• 凍檸茶 — cold amber tea in a glass or plastic cup with ice; lemon slice on rim or inside.
• 熱檸茶 — same amber tea served hot in a ceramic cup or glass; lemon slice visible; no ice.
• 凍奶茶 — cold milky yellowish-brown tea in a glass with ice; opaque from milk.
• 熱奶茶 — hot milky yellowish-brown tea; often in a ceramic tea cup. Sometimes served with sugar cube or packed sugar packet.
• 好立克 — milk-white, creamy drink; paler than milk tea.
• 阿華田 — similar to milk tea but more reddish-brown; milk tea is more yellowish-brown.

Cha Chaan Teng Food
• 炒滑蛋 — soft, pale-yellow scrambled egg; glossy surface; no browning. NOT salmon.
• 煎蛋 — fried egg with a set white and a visible yolk; edges may be crispy.
• 奶油豬 — thick white bun or bread with butter and condensed milk on top.
• 蒜蓉包 — bun with a visible garlic topping; golden-brown surface.
• 多士 — thin bread, toasted only; NOT deep-fried.
• 西多士 — deep-fried French toast; golden-brown and thick; served with butter and syrup.

Meat
• 牛扒 — thick slab or thinly sliced beef with clear grill marks or seared brown surface;
  served on a plate or over noodles.
• 牛肉 — thinner beef slices; less dense than 牛扒; no grill marks.
• 叉燒 — reddish-brown glazed pork; sliced or in chunks; caramelised shiny surface.
  Never a whole slab.
• 腩肉 — thick pork-belly slices with visible fat bands. Commonly pairs with 米線.
• 豬潤 — dark sliced liver in soup; smoother and less meaty-looking than beef slices.
• 豬紅 — firm, dark reddish-brown cubes in soup or noodles. NOT tofu.
• 豆腐花 — smooth, white, soft; served in a bowl with syrup. NOT savoury.
• 竹笙 — pale white, hollow, latticed tube, soft; always in soup/braised.
  NOT flat/golden/crispy (炸魚皮), NOT solid (魚蛋).
• 牛丸 — darker, slightly textured beef ball.
• 魚蛋 — pale yellow/white, smooth fish ball.
• 竹笙 vs 豆卜 — 竹笙 is ivory-white, hollow, and cylindrical with a lacy net-like surface;
  豆卜 is golden-white, cube-shaped, and spongy.
• 牛展 vs 牛腩 — 牛展 shows thin slices of dark lean meat; 牛腩 has thick layers of fat
  marbled between softer, paler meat.

DRINK AMBIGUITY RULE (奶茶 vs 阿華田)
• If you can confidently identify the drink, write its name normally.
• If you CANNOT confidently distinguish 奶茶 from 阿華田, write the
  ambiguous drink as {{奶茶|阿華田}} in whichever field (sauces or
  extras) it would normally appear in.
• All other items in that same field stay as normal text. Only the
  uncertain drink uses the {{A|B}} notation.
  Example: extras contains 洋蔥 and an uncertain drink →
    "extras": "洋蔥，{{奶茶|阿華田}}"
• Only use {{A|B}} for this specific 奶茶/阿華田 pair. For every other
  item, give your single best guess.

Return ONLY the JSON object. No prose, no markdown fences, no explanation.`;

      const activeNameSystem = nameOnlyBaseSystem;

      const callClaude = async (system: string, maxTokens: number, userText: string) =>
        anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          temperature: 0,
          system,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: imageBase64 } },
              { type: "text", text: userText }
            ]
          }]
        });

      const readText = (resp: any): string => {
        const blocks = resp?.content;
        if (!Array.isArray(blocks) || blocks.length === 0) return "";
        const first = blocks[0];
        if (!first || first.type !== "text" || typeof first.text !== "string") return "";
        return first.text.trim();
      };

      // Step 1: name-only AI call.
      const nameResponse = await callClaude(activeNameSystem, 1200, "Identify this food and return the JSON object.");
      const nameRaw = readText(nameResponse);
      const nameParsed = extractJsonObject(nameRaw);

      if (!nameParsed) {
        return res.status(422).json({ code: "PARSE_FAILED", message: "Could not parse label response." });
      }

      if (nameParsed.error) {
        const errStr = String(nameParsed.error).toLowerCase();
        if (errStr.includes("no_food") || errStr.includes("no food")) {
          return res.status(422).json({ code: "NO_FOOD", message: "No food detected" });
        }
        return res.status(422).json({ code: "NO_FOOD", message: String(nameParsed.error) });
      }

      const foodName = sanitizeFoodName(nameParsed.name);
      if (!foodName) {
        return res.status(422).json({ code: "NO_FOOD", message: "No food detected" });
      }

      incrementDailyCount(snapLabelCount, labelQuotaKey.key);
      console.log(`[snap/label] user=${userId} quotaKey=${labelQuotaKey.key} source=${labelQuotaKey.source} usedToday=${getDailyCount(snapLabelCount, labelQuotaKey.key)}/${SNAP_LABEL_DAILY_LIMIT}`);

      {
        const snapProfile = await storage.getProfile(userId);
        if (snapProfile && !snapProfile.hasTriedFirstFoodSnap) {
          await storage.updateProfile(userId, { hasTriedFirstFoodSnap: true });
        }
      }

      const locale = language || "en";

      const foodLabel = isFirstSnap ? null : await storage.getFoodLabelByName(foodName);
      if (foodLabel) {
        const portionVocab = await storage.getIngredientByInternalId(foodLabel.defaultPortionId);
        const sauceVocabs = await Promise.all(
          (foodLabel.defaultSauces ?? []).map(id => storage.getIngredientByInternalId(id))
        );
        const toppingVocabs = await Promise.all(
          (foodLabel.defaultToppings ?? []).map(id => storage.getIngredientByInternalId(id))
        );

        const sauceOptions = sauceVocabs.filter(Boolean).map(v => ({ id: v!.internalId, label: getIngredientLabel(v!, locale) }));
        const toppingOptions = toppingVocabs.filter(Boolean).map(v => ({ id: v!.internalId, label: getIngredientLabel(v!, locale) }));

        trackServer(userId, "snap_label_succeeded_server", { source: "food_label", isFirstSnap });

        return res.json({
          name: foodName,
          canonicalName: foodLabel.internalId,
          portion: portionVocab ? getIngredientLabel(portionVocab, locale) : null,
          portionId: foodLabel.defaultPortionId,
          sauces: sauceOptions.map(s => s.label).join(", ") || null,
          sauceIds: sauceOptions.map(s => s.id),
          extras: toppingOptions.map(t => t.label).join(", ") || null,
          toppingIds: toppingOptions.map(t => t.id),
          comboSource: "database",
          sauceOptions: sauceOptions.length > 0 ? sauceOptions : undefined,
          toppingOptions: toppingOptions.length > 0 ? toppingOptions : undefined,
          snapsUsedToday: getDailyCount(snapLabelCount, labelQuotaKey.key),
          snapsLimit: SNAP_LABEL_DAILY_LIMIT,
        });
      }

      // #578: food lookup now reads from food_labels only (food_combos table dropped).
      const combos = isFirstSnap ? [] : await storage.getFoodLabelsByName(foodName);

      if (combos.length > 0) {
        const resolvedCombos = await Promise.all(combos.map(async (label) => {
          const portionVocab = label.defaultPortionId
            ? await storage.getIngredientByInternalId(label.defaultPortionId) : null;
          const sauceVocabs = await Promise.all(
            (label.defaultSauces ?? []).map(id => storage.getIngredientByInternalId(id))
          );
          const toppingVocabs = await Promise.all(
            (label.defaultToppings ?? []).map(id => storage.getIngredientByInternalId(id))
          );
          return {
            portion: portionVocab ? getIngredientLabel(portionVocab, locale) : null,
            portionId: label.defaultPortionId,
            sauces: sauceVocabs.filter(Boolean).map(v => ({ id: v!.internalId, label: getIngredientLabel(v!, locale) })),
            toppings: toppingVocabs.filter(Boolean).map(v => ({ id: v!.internalId, label: getIngredientLabel(v!, locale) })),
          };
        }));

        const portionOptions = [...new Set(resolvedCombos.map(c => c.portion).filter(Boolean))] as string[];
        const portionIdMap: Record<string, string> = {};
        resolvedCombos.forEach(c => { if (c.portion && c.portionId) portionIdMap[c.portion] = c.portionId; });

        const sauceMap = new Map<string, { id: string; label: string }>();
        resolvedCombos.forEach(c => c.sauces.forEach(s => sauceMap.set(s.id, s)));
        const sauceOptions = [...sauceMap.values()];

        const toppingMap = new Map<string, { id: string; label: string }>();
        resolvedCombos.forEach(c => c.toppings.forEach(t => toppingMap.set(t.id, t)));
        const toppingOptions = [...toppingMap.values()];

        const first = resolvedCombos[0];

        trackServer(userId, "snap_label_succeeded_server", { source: "combos", isFirstSnap });

        return res.json({
          name: foodName,
          canonicalName: combos[0].foodNameEn,
          portion: first.portion,
          portionId: first.portionId,
          sauces: first.sauces.map(s => s.label).join(", ") || null,
          sauceIds: first.sauces.map(s => s.id),
          extras: first.toppings.map(t => t.label).join(", ") || null,
          toppingIds: first.toppings.map(t => t.id),
          comboSource: "database",
          portionOptions: portionOptions.length > 1 ? portionOptions : undefined,
          portionIdMap: Object.keys(portionIdMap).length > 1 ? portionIdMap : undefined,
          sauceOptions: sauceOptions.length > 0 ? sauceOptions : undefined,
          toppingOptions: toppingOptions.length > 0 ? toppingOptions : undefined,
          snapsUsedToday: getDailyCount(snapLabelCount, labelQuotaKey.key),
          snapsLimit: SNAP_LABEL_DAILY_LIMIT,
        });
      }

      // Step 4: no library match → second AI call to fill in the 4 labels
      // (portion, sauces, toppings) for this dish. The food library is NOT
      // written here — that only happens at the end of the advice flow.
      const labelsSystemFinal = labelsOnlySystem(foodName);
      const strictLabelsSystem = `${labelsSystemFinal}

CRITICAL: Respond with the JSON object only. No surrounding text. No code fences. No commentary.`;

      let labelsResponse = await callClaude(labelsSystemFinal, 600, `The food has been identified as "${foodName}". Return the JSON with portion, sauces, and extras.`);
      let labelsRaw = readText(labelsResponse);
      let labelsParsed = extractJsonObject(labelsRaw);
      const labelsTruncated = labelsResponse?.stop_reason === "max_tokens";
      if (!labelsParsed || labelsTruncated) {
        try {
          labelsResponse = await callClaude(strictLabelsSystem, 1000, `The food has been identified as "${foodName}". Return the JSON with portion, sauces, and extras.`);
          labelsRaw = readText(labelsResponse);
          labelsParsed = extractJsonObject(labelsRaw);
        } catch (retryErr) {
          console.error("Snap labels retry error:", retryErr);
        }
      }

      if (!labelsParsed) {
        return res.status(422).json({ code: "PARSE_FAILED", message: "Could not parse label response." });
      }

      const claudePortion = typeof labelsParsed.portion === "string" ? labelsParsed.portion.trim() || null : null;
      const claudeSauces = typeof labelsParsed.sauces === "string" ? labelsParsed.sauces.trim() || null : null;
      const rawExtras = typeof labelsParsed.extras === "string" ? labelsParsed.extras.trim() || null : null;
      const claudeExtras = stripExtrasContainedInName(foodName, rawExtras);

      trackServer(userId, "snap_label_succeeded_server", { source: "claude", isFirstSnap });

      res.json({
        name: foodName,
        portion: claudePortion,
        sauces: claudeSauces,
        extras: claudeExtras,
        comboSource: "claude",
        snapsUsedToday: getDailyCount(snapLabelCount, labelQuotaKey.key),
        snapsLimit: SNAP_LABEL_DAILY_LIMIT,
      });
    } catch (error: any) {
      console.error("Snap label error:", error);
      captureException(error, req.user?.claims?.sub, { route: "/api/snap/label", method: "POST" });
      res.status(500).json({ message: "Food identification failed. Please try again." });
    }
  });

  app.post("/api/snap/disambiguate", isAuthenticated, async (req: any, res) => {
    try {
      const { text, field, locale } = req.body;
      if (!text || !field) return res.status(400).json({ message: "text and field required" });

      const userLocale = locale || "en";
      const matches = await storage.getIngredientsByAlias(text.trim(), field);

      if (matches.length === 0) {
        return res.json({ matches: [], exact: false });
      }
      if (matches.length === 1) {
        return res.json({
          matches: [{ internalId: matches[0].internalId, label: getIngredientLabel(matches[0], userLocale) }],
          exact: true
        });
      }

      return res.json({
        matches: matches.map(m => ({ internalId: m.internalId, label: getIngredientLabel(m, userLocale) })),
        exact: false
      });
    } catch (error: any) {
      console.error("Disambiguate error:", error);
      res.status(500).json({ message: "Disambiguation failed." });
    }
  });

  function inferMealType(tz?: string | null): string {
    const hour = parseInt(
      new Intl.DateTimeFormat("en", {
        timeZone: tz || "UTC",
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date()),
      10,
    );
    if (hour >= 7 && hour < 11) return "breakfast";
    if (hour >= 12 && hour < 14) return "lunch";
    if (hour >= 18 && hour < 21) return "dinner";
    return "snack";
  }

  function getLocalDate(tz?: string | null): string {
    try {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: tz || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const y = parts.find(p => p.type === "year")?.value;
      const m = parts.find(p => p.type === "month")?.value;
      const d = parts.find(p => p.type === "day")?.value;
      return `${y}-${m}-${d}`;
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }

  function deriveGlucoseImpact(adviceText: string): "low" | "medium" | "high" | null {
    for (const line of adviceText.split("\n")) {
      if (line.toLowerCase().startsWith("blood sugar impact")) {
        const val = line.split(":")[1]?.trim().toLowerCase();
        if (val === "low" || val === "medium" || val === "high") return val as "low" | "medium" | "high";
      }
      if (line.startsWith("血糖影響")) {
        const val = line.split(":")[1]?.trim();
        if (val === "高") return "high";
        if (val === "中") return "medium";
        if (val === "低") return "low";
      }
    }
    return null;
  }

  app.post("/api/snap/advice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // MCHK §5 — Claude consent gate
      const { rows: _adviceConsent } = await pool.query<{ consented: boolean }>(
        `SELECT consented FROM user_consents WHERE user_id = $1 AND service_name = 'claude' ORDER BY consented_at DESC LIMIT 1`,
        [userId]
      );
      if (_adviceConsent.length === 0 || !_adviceConsent[0].consented) {
        return res.status(403).json({ success: false, message: "AI processing consent not given", consentRequired: "claude" });
      }

      const { name, portion, sauces: rawSauces, extras: rawExtras, portionId, sauceResolutions, toppingResolutions, locale: requestLocale, mealType: clientMealType } = req.body;
      if (!name) return res.status(400).json({ message: "name is required" });
      const stripAmbigToken = (s?: string | null): string | null =>
        s?.replace(/\{\{[^}]+\}\}/g, "").replace(/，\s*，/g, "，").replace(/^，|，$/g, "").trim() || null;
      const sauces = stripAmbigToken(rawSauces);
      const extras = stripAmbigToken(rawExtras);

      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      const adviceQuotaKey = resolveSnapQuotaKey(userId, profile);

      // No daily cap is enforced here. Advice is downstream of a
      // successful /api/snap/label that already enforced the cap and
      // incremented snapLabelCount. Re-checking >= cap here would 429
      // the advice for the user's last admitted snap of the day (e.g.
      // snap #2 of 2), since label has already incremented the
      // counter to the cap by the time advice runs. We deliberately
      // accept that a determined authenticated client could call
      // /api/snap/advice directly without going through label — the
      // bound on that abuse is the per-call Claude spend and the
      // foodName/combo cache lookup, not a per-day counter. If direct
      // advice spam ever becomes a real problem, the right fix is a
      // signed one-shot token from label → advice, not a counter
      // (which can never tell the two flows apart).

      const gateCheck = canUseFeature(profile, "food_snap_advice");
      if (!gateCheck.allowed) {
        return res.json({
          success: false,
          showPaywall: true,
          lockApp: gateCheck.lockApp || false,
          feature: "food_snap_advice",
        });
      }

      const currentPlanForAdvice = await storage.getCurrentWeeklyPlan(userId);
      const struggle = currentPlanForAdvice?.dietStruggle ?? "sugary_food_drink";
      const lang = requestLocale || profile.preferredLanguage || "en";
      const tip = currentPlanForAdvice?.dietTip ?? (DIET_TIP_LADDERS[struggle]?.[0] ?? "Choose lower-GI options where possible");

      const resolvedSauceIds = (sauceResolutions && Array.isArray(sauceResolutions) && sauceResolutions.length > 0)
        ? await resolveFromTokenResolutions(sauceResolutions, "sauce")
        : await resolveToInternalIds(sauces, "sauce");
      const resolvedToppingIds = (toppingResolutions && Array.isArray(toppingResolutions) && toppingResolutions.length > 0)
        ? await resolveFromTokenResolutions(toppingResolutions, "topping")
        : await resolveToInternalIds(extras, "topping");
      const resolvedPortionId = portionId || (portion ? (await resolveToInternalIds(portion, "portion"))[0] || portion.toLowerCase() : "medium");

      const tipIndexForPanel = currentPlanForAdvice?.dietTip ? (DIET_TIP_LADDERS[struggle]?.indexOf(currentPlanForAdvice.dietTip) ?? 0) : 0;

      const label = await storage.getFoodLabelByCombo(name, resolvedPortionId, resolvedSauceIds, resolvedToppingIds);
      const activeComboKey = label ? label.internalId : buildInternalId(name, resolvedPortionId, resolvedSauceIds, resolvedToppingIds);

      const rawGlucosePrediction = await storage.getGlucosePrediction(userId, activeComboKey);
      const glucosePredictionBase = (() => {
        const { avgPostMeal, entryCount } = rawGlucosePrediction;
        if (entryCount === 0 || avgPostMeal === null) {
          return { avgPostMealMmol: null, pairedCount: entryCount, state: "C" as const, glucoseGroup: profile.glucoseGroup ?? null };
        }
        return {
          avgPostMealMmol: avgPostMeal,
          pairedCount:     entryCount,
          state:           entryCount >= 10 ? "A" as const : "B" as const,
          glucoseGroup:    profile.glucoseGroup ?? null,
        };
      })();
      const spikeHistory = name ? await storage.getGlucoseSpikeHistoryByFoodName(userId, name, 6) : [];
      const glucosePrediction = { ...glucosePredictionBase, spikeHistory };

      async function insertSnapRecord(adviceText: string): Promise<number | null> {
        try {
          const snap = await storage.insertMealSnap({
            userId,
            localDate: getLocalDate(profile!.deviceTimezone),
            mealType: (["breakfast","lunch","dinner","snack"].includes(clientMealType) ? clientMealType : null) ?? inferMealType(profile!.deviceTimezone),
            foodName: name,
            portion: portion ?? null,
            sauces: sauces ?? null,
            extras: extras ?? null,
            glucoseImpact: deriveGlucoseImpact(adviceText),
            missedMealFlag: false,
            comboKey: activeComboKey,
          });

          // Fire-and-forget: schedule HStix reminder 60 min from now.
          // Cancels any pending reminder from a previous snap first.
          void (async () => {
            try {
              const p = await storage.getProfile(userId);
              if (p?.hstixReminderNotificationId) {
                await cancelOneSignalNotification(p.hstixReminderNotificationId);
              }
              const useAlias = !!p?.onesignalExternalId;
              if (!useAlias && !p?.onesignalPlayerId) return;
              const hstixContent = CONTENTS["hstix_reminder"];
              const result = await sendPushNotification({
                title:    { en: hstixContent.en.title,    "zh-Hant": hstixContent.zhHant.title },
                subtitle: { en: hstixContent.en.subtitle, "zh-Hant": hstixContent.zhHant.subtitle },
                message:  { en: hstixContent.en.message,  "zh-Hant": hstixContent.zhHant.message },
                deepLink: hstixContent.deepLink,
                send_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                externalIds: useAlias ? [p!.onesignalExternalId as string] : undefined,
                playerIds: useAlias ? undefined : [p!.onesignalPlayerId as string],
              });
              if (result.notificationId) {
                await storage.updateProfile(userId, { hstixReminderNotificationId: result.notificationId });
              }
            } catch (e: any) {
              console.warn("[snap/hstix-reminder] scheduling failed:", e?.message ?? e);
            }
          })();

          return snap.id;
        } catch (e: any) {
          console.warn("[snap/advice] insertSnapRecord failed:", e?.message ?? e);
          return null;
        }
      }

      if (label) {
        // Step 6 of the FoodSnap flow: exact combo match in library check 2.
        // food_labels.useCount is already bumped inside getFoodLabelByCombo above
        // (#578: previous parallel food_combos bump removed with the table).
        const focusPanelData = computeFocusPanel(struggle, tipIndexForPanel, label, resolvedPortionId);
        const cachedAdvice = await storage.getCachedAdvice(activeComboKey, lang);
        if (cachedAdvice) {
          const snapId = await insertSnapRecord(cachedAdvice);
          try {
            const _cnt = await storage.getTotalSnaps(userId);
            if (_cnt === 10) trackServer(userId, "glucose_pattern_unlocked", { totalSnaps: _cnt });
          } catch {}
          return res.json({
            advice: cachedAdvice,
            focusPanelData,
            sources: pickSources(cachedAdvice),
            adviceUsedToday: getDailyCount(snapLabelCount, adviceQuotaKey.key),
            adviceLimit: SNAP_LABEL_DAILY_LIMIT,
            adviceSource: "cache",
            snapId,
            glucosePrediction,
          });
        }
      }

      const existingCachedAdvice = !label ? await storage.getCachedAdvice(activeComboKey, lang) : null;
      if (existingCachedAdvice) {
        const focusPanelData = computeFocusPanel(struggle, tipIndexForPanel, null, resolvedPortionId);
        const snapId = await insertSnapRecord(existingCachedAdvice);
        try {
          const _cnt = await storage.getTotalSnaps(userId);
          if (_cnt === 10) trackServer(userId, "glucose_pattern_unlocked", { totalSnaps: _cnt });
        } catch {}
        return res.json({
          advice: existingCachedAdvice,
          focusPanelData,
          sources: pickSources(existingCachedAdvice),
          adviceUsedToday: getDailyCount(snapLabelCount, adviceQuotaKey.key),
          adviceLimit: SNAP_LABEL_DAILY_LIMIT,
          adviceSource: "cache",
          snapId,
          glucosePrediction,
        });
      }

      const allLocales = ["en", "zh-Hant", "yue"] as const;
      const langLabel: Record<string, string> = {
        en: "English",
        "zh-Hant": "Traditional Chinese (繁體中文)",
        yue: "Written Cantonese (廣東話書面語)",
      };

      const foodDesc = [
        `Food: ${name}`,
        portion ? `Portion: ${portion}` : null,
        sauces ? `Sauces / condiments: ${sauces}` : null,
        extras ? `Extras / toppings: ${extras}` : null,
      ].filter(Boolean).join("\n");

      const needTags = !label;

      const tagInstruction = `\n\nAfter your advice, on a NEW line output ONLY a JSON object with these keys (no other text on that line):\n{"is_sugary_food":true/false,"is_sugary_drink":true/false,"is_oily":true/false,"is_snack":true/false}`;

      const advicePromptSystem = (locale: string, includeTagLine: boolean) => `You are a dietary advisor helping a person manage blood sugar levels and glycaemic impact through practical food choices. Your sole focus is glycaemic impact and practical sugar reduction.

Users are based in Hong Kong. You are familiar with local foods: congee, dim sum, rice noodles, wonton noodles, Hong Kong milk tea (with condensed milk), pineapple buns, char siu, egg tarts, curry fish balls, roast meats, cha chaan teng dishes, claypot rice, hotpot, siu mai, har gow, cheung fun, lo mai gai, turnip cake.

Reply in ${langLabel[locale] ?? "English"}.

Important rules:
- If the food is genuinely low-risk and healthy, say so plainly. Do NOT manufacture warnings or unnecessary advice for healthy food.
- Never use the word "diabetes" in any form.

Cultural opener (optional first line, in ${langLabel[locale] ?? "English"}):
- If the food items together suggest a recognizable cultural meal-type — Hong Kong 常餐 / 茶餐廳早餐 / 套餐, dim sum brunch, afternoon tea, English breakfast, Japanese bento, Korean BBQ set, mezze spread, charcuterie board, etc. — open the advice with ONE single-sentence cultural note in the user's locale, then continue with the normal health/dietary advice on the next line.
- If the photo shows a single dish (e.g. just wonton noodles, just a pineapple bun) or the items don't clearly fit a known meal-type, SKIP this opening line entirely and start directly with the blood sugar impact line.
- The cultural opener is plain prose (no emoji prefix, no label) and stays to ONE sentence.
- Worked examples (use whichever locale matches your reply language):
  - en → "This looks like a classic Hong Kong cha chaan teng breakfast set."
  - zh-Hant → "這看起來是茶餐廳常餐。"
  - yue → "呢個望落係茶餐廳常餐。"

Always reply in this format (the optional cultural opener, if any, comes first on its own line, followed by a blank line, then the Blood sugar impact line):

${locale === "zh-Hant" || locale === "yue" ? "血糖影響: [高 / 中 / 低]" : "Blood sugar impact: [High / Medium / Low]"}
${locale === "zh-Hant" || locale === "yue" ? "⚠️ 注意：" : "⚠️ Watch out:"} [the single biggest GI or sugar risk — 1 concise sentence]
${locale === "zh-Hant" ? "⚡ 現在：" : locale === "yue" ? "⚡ 依家：" : "⚡ Right now:"} [1–2 specific things to do with THIS meal right now]
${locale === "zh-Hant" || locale === "yue" ? "📝 下次：" : "📝 Next time:"} [1–2 changes for the next time this dish is prepared or ordered]

If the food is genuinely healthy and low-risk, OMIT the ⚠️ line entirely and affirm the good choice in the ⚡ and 📝 lines instead. In that case output only 3 lines (Blood sugar impact, ⚡, 📝).
If there is a genuine concern, output all 4 lines.

Evidence-based principles from Diabetes Care 2019 Consensus & WHO/ADA guidance.
Stay strictly within these lists. Do NOT invent principles outside them.

For ⚡ Right now, draw ONLY from these actions (pick 1–2 most relevant to this specific meal):
1. Eat vegetables/protein first, carbs last.
2. Drink a glass of water gradually after finishing the meal, not during eating.
3. Eat slowly.
4. Go for a 10-minute walk after the meal.
5. Reduce the portion of carbs in this meal.

You have identified the meal as Blood sugar impact: [High / Medium / Low]. Principle 2 and 4 are only for meals identified as high blood sugar impact. If Blood sugar impact is high, include at least one of them in the ⚡ Right now section. Other principles may be included alongside.

For 📝 Next time, draw ONLY from these changes (pick 1–2 most relevant to this specific meal):
1. Emphasize non-starchy vegetables.
2. Minimize added sugars and refined grains.
3. Prefer whole, minimally processed foods over highly processed foods.
4. Eat most carbs earlier in the day.
5. Add protein to the meal (e.g. fish, tofu, egg, lean meat).
6. Choose high-fibre carbs (e.g. brown rice over white, wholegrain noodles).
7. Include healthy fats (e.g. nuts, avocado, oily fish).
8. Don't drink sugary drinks with meals.
9. Limit added salt and sodium.

Hard constraints on your advice:
- Where the food's actual ingredients make a principle directly relevant, refer to them by name. If the food doesn't naturally connect to a principle, express the principle in a natural, conversational tone.
- Do NOT give medical diagnoses, medication changes, or individual treatment targets (e.g. specific HbA1c, glucose, blood pressure or weight numbers to hit).${includeTagLine ? tagInstruction : ""}`;

      // Pre-check cache for all locales BEFORE any Claude call so we
      // know whether this advice request would actually hit Claude.
      // The advice-Claude backstop counter is only checked/incremented
      // when there is at least one miss. This keeps cache-hit advice
      // (e.g. re-viewing previous advice for the same combo) free of
      // any cap impact while still bounding direct-call cost abuse.
      const cachedAdvicePerLocale = await Promise.all(
        allLocales.map(async (locale) => ({
          locale,
          existing: await storage.getCachedAdvice(activeComboKey, locale),
        }))
      );
      const anyAdviceCacheMiss = cachedAdvicePerLocale.some(c => !c.existing);
      if (anyAdviceCacheMiss && !UNLIMITED_SNAP_USER_IDS.has(userId)) {
        const adviceClaudeUsed = getDailyCount(snapAdviceClaudeCount, adviceQuotaKey.key);
        if (adviceClaudeUsed >= SNAP_LABEL_DAILY_LIMIT) {
          console.log(`[snap/advice] Claude cap hit user=${userId} quotaKey=${adviceQuotaKey.key} source=${adviceQuotaKey.source} usedToday=${adviceClaudeUsed}/${SNAP_LABEL_DAILY_LIMIT}`);
          return res.status(429).json({
            error: "Daily snap limit reached",
            adviceUsedToday: getDailyCount(snapLabelCount, adviceQuotaKey.key),
            adviceLimit: SNAP_LABEL_DAILY_LIMIT,
            snapsUsedToday: getDailyCount(snapLabelCount, adviceQuotaKey.key),
            snapsLimit: SNAP_LABEL_DAILY_LIMIT,
          });
        }
        incrementDailyCount(snapAdviceClaudeCount, adviceQuotaKey.key);
      }

      const adviceResults = await Promise.all(
        cachedAdvicePerLocale.map(async ({ locale, existing }) => {
          if (existing) return { locale, advice: existing, fromCache: true };
          const includeTagLine = needTags && locale === "en";
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 400,
            system: advicePromptSystem(locale, includeTagLine),
            messages: [{ role: "user", content: foodDesc }],
          });
          const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
          return { locale, advice: text, fromCache: false };
        })
      );

      let claudeTags: FoodTags | null = null;
      if (needTags) {
        const enResult = adviceResults.find(r => r.locale === "en" && !r.fromCache);
        if (enResult) {
          const tagMatch = enResult.advice.match(/\{[^}]*"is_sugary_food"[^}]*\}/);
          if (tagMatch) {
            try {
              claudeTags = JSON.parse(tagMatch[0]);
            } catch { /* ignore parse errors */ }
          }
        }
      }

      const cleanedResults = adviceResults.map(r => ({
        ...r,
        advice: r.advice.replace(/\{[^}]*"is_sugary_food"[^}]*\}/g, "").trim(),
      }));

      const foodName = name;

      await Promise.all(
        cleanedResults
          .filter(r => !r.fromCache && r.advice)
          .map(r => storage.saveCachedAdvice(foodName, activeComboKey, r.locale, r.advice, "claude"))
      );

      if (needTags) {
        try {
          const translationResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 200,
            system: `You translate food dish names between English, Traditional Chinese, and Cantonese. Return ONLY a JSON object with these exact keys:
{ "en": "English name", "zh": "繁體中文名", "yue": "廣東話名" }
No explanation, just JSON.`,
            messages: [{ role: "user", content: `Translate this food name into all three languages: "${foodName}"` }],
          });
          const translationText = translationResponse.content[0].type === "text" ? translationResponse.content[0].text.trim() : "{}";
          let translations: { en?: string; zh?: string; yue?: string } = {};
          try { translations = JSON.parse(translationText); } catch { /* ignore parse errors */ }

          const foodNameEn = translations.en || (/^[a-zA-Z\s,'-]+$/.test(foodName.trim()) ? foodName : null);

          await storage.saveFoodLabel({
            internalId: activeComboKey,
            foodNameEn: foodNameEn || foodName,
            foodNameZhHant: translations.zh || foodName,
            foodNameYue: translations.yue || translations.zh || foodName,
            defaultPortionId: resolvedPortionId,
            defaultSauces: resolvedSauceIds,
            defaultToppings: resolvedToppingIds,
            isSugaryFood: claudeTags?.isSugaryFood ?? false,
            isSugaryDrink: claudeTags?.isSugaryDrink ?? false,
            isOily: claudeTags?.isOily ?? false,
            isSnack: claudeTags?.isSnack ?? false,
            useCount: 0,
          });
          // #578: food_combos table dropped — saveFoodLabel above is the only
          // place during a snap where the food library is written.
        } catch (saveErr) {
          console.error("Food label save error (non-blocking):", saveErr);
        }
      }

      const focusPanelData = label
        ? computeFocusPanel(struggle, tipIndexForPanel, label, resolvedPortionId)
        : computeFocusPanel(struggle, tipIndexForPanel, null, resolvedPortionId, claudeTags);

      const userAdvice = cleanedResults.find(r => r.locale === lang)?.advice ?? cleanedResults[0].advice;
      const userAdviceSources = pickSources(userAdvice);

      console.log(`[snap/advice] user=${userId} quotaKey=${adviceQuotaKey.key} source=${adviceQuotaKey.source} usedToday=${getDailyCount(snapLabelCount, adviceQuotaKey.key)}/${SNAP_LABEL_DAILY_LIMIT}`);

      trackServer(userId, "snap_advice_succeeded_server", {
        adviceSource: cleanedResults.find(r => r.locale === lang)?.fromCache ? "cache" : "claude",
        adviceUsedToday: getDailyCount(snapLabelCount, adviceQuotaKey.key),
      });

      const snapId = await insertSnapRecord(userAdvice);
      try {
        const _cnt = await storage.getTotalSnaps(userId);
        if (_cnt === 10) trackServer(userId, "glucose_pattern_unlocked", { totalSnaps: _cnt });
      } catch {}
      res.json({
        advice: userAdvice,
        focusPanelData,
        sources: userAdviceSources,
        adviceUsedToday: getDailyCount(snapLabelCount, adviceQuotaKey.key),
        adviceLimit: SNAP_LABEL_DAILY_LIMIT,
        adviceSource: cleanedResults.find(r => r.locale === lang)?.fromCache ? "cache" : "claude",
        snapId,
        glucosePrediction,
      });
    } catch (error: any) {
      console.error("Snap advice error:", error);
      captureException(error, req.user?.claims?.sub, { route: "/api/snap/advice", method: "POST" });
      res.status(500).json({ message: "Diet advice generation failed. Please try again." });
    }
  });

  app.patch("/api/snap/:snapId/meal-type", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const snapId = parseInt(req.params.snapId, 10);
      if (isNaN(snapId)) return res.status(400).json({ message: "Invalid snapId" });
      const { mealType } = req.body;
      const allowed = ["breakfast", "lunch", "dinner", "snack"];
      if (!mealType || !allowed.includes(mealType)) {
        return res.status(400).json({ message: "mealType must be one of: breakfast, lunch, dinner, snack" });
      }
      await storage.updateMealSnapType(snapId, userId, mealType);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Snap meal-type PATCH error:", error);
      res.status(500).json({ message: "Failed to update meal type." });
    }
  });

  app.get("/api/snap/daily-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date } = req.query;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });
      }
      const [snaps, profile] = await Promise.all([
        storage.getMealSnapsByLocalDate(userId, date),
        storage.getProfile(userId),
      ]);
      const irregularMealCount = snaps.filter(s => isIrregularSnap(s, profile?.deviceTimezone)).length;
      return res.json({
        snaps: snaps.map(s => ({
          glucoseImpact: s.glucoseImpact,
          mealType: s.mealType,
          snapTime: s.snapTime,
          foodName: s.foodName ?? null,
        })),
        irregularMealCount,
      });
    } catch (error: any) {
      console.error("Snap daily-summary error:", error);
      res.status(500).json({ message: "Failed to fetch daily summary." });
    }
  });

  app.get("/api/snap/weekly-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { weekStart } = req.query;
      if (!weekStart || typeof weekStart !== "string") {
        return res.status(400).json({ message: "weekStart query param required (YYYY-MM-DD)" });
      }
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const weekStartDate = new Date(weekStart + "T00:00:00Z");
      const weekEndDate = new Date(weekStartDate.getTime() + 6 * 86400000);
      const weekEnd = weekEndDate.toISOString().split("T")[0];

      const snaps = await storage.getMealSnapsByDateRange(userId, weekStart, weekEnd);
      const snapCount = snaps.length;
      if (snapCount < 3) {
        return res.json({ snapCount, insufficient: true });
      }

      const impactScore = (impact: string | null) =>
        impact === "low" ? 1 : impact === "medium" ? 2 : impact === "high" ? 3 : null;

      const lateMealCount = snaps.filter(s => {
        if (s.mealType !== "snack") return false;
        const hour = parseInt(
          new Intl.DateTimeFormat("en", {
            timeZone: profile.deviceTimezone || "UTC",
            hour: "numeric",
            hourCycle: "h23",
          }).format(new Date(s.snapTime)),
          10,
        );
        return hour >= 21;
      }).length;

      const dayMealTypes = new Map<string, Set<string>>();
      for (const snap of snaps) {
        if (!dayMealTypes.has(snap.localDate)) dayMealTypes.set(snap.localDate, new Set());
        if (snap.mealType === "breakfast" || snap.mealType === "lunch" || snap.mealType === "dinner") {
          dayMealTypes.get(snap.localDate)!.add(snap.mealType);
        }
      }
      const missedMealDays = [...dayMealTypes.values()].filter(t => t.size < 2).length;

      const mealTypeGroups: Record<string, number[]> = { breakfast: [], lunch: [], dinner: [] };
      for (const snap of snaps) {
        if (snap.mealType === "breakfast" || snap.mealType === "lunch" || snap.mealType === "dinner") {
          const score = impactScore(snap.glucoseImpact);
          if (score !== null) mealTypeGroups[snap.mealType].push(score);
        }
      }
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const mealTypeAvgs = {
        breakfast: avg(mealTypeGroups.breakfast),
        lunch: avg(mealTypeGroups.lunch),
        dinner: avg(mealTypeGroups.dinner),
      };

      const dowGroups = new Map<number, number[]>();
      for (const snap of snaps) {
        const jsDay = new Date(snap.localDate + "T12:00:00Z").getUTCDay();
        const monAnchored = jsDay === 0 ? 6 : jsDay - 1;
        const score = impactScore(snap.glucoseImpact);
        if (score !== null) {
          if (!dowGroups.has(monAnchored)) dowGroups.set(monAnchored, []);
          dowGroups.get(monAnchored)!.push(score);
        }
      }
      let worstDay: number | null = null;
      let worstAvg = -Infinity;
      for (const [day, scores] of dowGroups) {
        const a = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (a > worstAvg) { worstAvg = a; worstDay = day; }
      }

      // Worst meal type(s) + food on the worst day; collect ties
      let worstMeal: string | null = null;
      let worstFood: string | null = null;
      let worstMeals: string[] = [];
      let worstFoods: (string | null)[] = [];
      if (worstDay !== null) {
        const worstDaySnaps = snaps.filter(s => {
          const jsDay = new Date(s.localDate + "T12:00:00Z").getUTCDay();
          return (jsDay === 0 ? 6 : jsDay - 1) === worstDay;
        });
        const mealBuckets: Record<string, { total: number; count: number; topScore: number; topFood: string | null }> = {};
        for (const snap of worstDaySnaps) {
          if (!snap.mealType || snap.mealType === "snack") continue;
          const score = impactScore(snap.glucoseImpact);
          if (score === null) continue;
          if (!mealBuckets[snap.mealType]) mealBuckets[snap.mealType] = { total: 0, count: 0, topScore: -Infinity, topFood: null };
          mealBuckets[snap.mealType].total += score;
          mealBuckets[snap.mealType].count++;
          if (score > mealBuckets[snap.mealType].topScore) {
            mealBuckets[snap.mealType].topScore = score;
            mealBuckets[snap.mealType].topFood = snap.foodName ?? null;
          }
        }
        let worstMealAvg = -Infinity;
        for (const [mt, b] of Object.entries(mealBuckets)) {
          const avg = b.total / b.count;
          if (avg > worstMealAvg) {
            worstMealAvg = avg;
            worstMeals = [mt];
            worstFoods = [b.topFood];
          } else if (avg === worstMealAvg) {
            worstMeals.push(mt);
            worstFoods.push(b.topFood);
          }
        }
        worstMeal = worstMeals[0] ?? null;
        worstFood = worstFoods[0] ?? null;
      }

      // Recommendation: pick worst non-healthy high-impact food + suggest a healthier swap
      let recFood: string | null = null;
      let recommendedFood: string | null = null;
      {
        const candidates = snaps.filter(s =>
          s.glucoseImpact === "high" && s.foodName && s.mealType && !isHealthyFood(s.foodName)
        );
        if (candidates.length >= 2) {
          const hasHstix = candidates.some(s => s.postMealGlucoseMmol != null);
          let pick: typeof candidates[0] | undefined;
          if (hasHstix) {
            pick = [...candidates]
              .filter(s => s.postMealGlucoseMmol != null)
              .sort((a, b) => (b.postMealGlucoseMmol ?? 0) - (a.postMealGlucoseMmol ?? 0))[0]
              ?? candidates[Math.floor(Math.random() * candidates.length)];
          } else {
            pick = candidates[Math.floor(Math.random() * candidates.length)];
          }
          if (pick?.foodName && pick.mealType) {
            recFood = pick.foodName;
            recommendedFood = pickRecommendation(pick.mealType, pick.foodName);
          }
        }
      }

      // Most common irregular meal type this week (for frontend naming)
      const irregularTypeCounts: Record<string, number> = {};
      for (const snap of snaps) {
        if (isIrregularSnap(snap, profile.deviceTimezone) && snap.mealType) {
          irregularTypeCounts[snap.mealType] = (irregularTypeCounts[snap.mealType] ?? 0) + 1;
        }
      }
      let irregularMealType: string | null = null;
      let maxIrregCount = 0;
      for (const [mt, cnt] of Object.entries(irregularTypeCounts)) {
        if (cnt > maxIrregCount) { maxIrregCount = cnt; irregularMealType = mt; }
      }

      const irregularDaySet = new Set<string>();
      for (const snap of snaps) {
        if (isIrregularSnap(snap, profile.deviceTimezone)) irregularDaySet.add(snap.localDate);
      }
      const irregularMealDays = irregularDaySet.size;

      // Per-day grid for Charts 1 & 6
      const todayStr = getLocalDate(profile.deviceTimezone);
      const snapsByDay = new Map<string, typeof snaps>();
      for (const snap of snaps) {
        if (!snapsByDay.has(snap.localDate)) snapsByDay.set(snap.localDate, []);
        snapsByDay.get(snap.localDate)!.push(snap);
      }

      let gridStable = 0, gridMedium = 0, gridHigh = 0;
      const dailyGrid = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStartDate.getTime() + i * 86400000);
        const date = d.toISOString().split("T")[0];
        const jsDay = d.getUTCDay();
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
        const isFuture = date > todayStr;
        const daySnaps = snapsByDay.get(date) ?? [];

        const breakfast = daySnaps.find(s => s.mealType === "breakfast")?.glucoseImpact ?? null;
        const lunch     = daySnaps.find(s => s.mealType === "lunch")?.glucoseImpact ?? null;
        const dinner    = daySnaps.find(s => s.mealType === "dinner")?.glucoseImpact ?? null;
        const snackImpacts = daySnaps.filter(s => s.mealType === "snack").map(s => s.glucoseImpact ?? "low");

        if (!isFuture) {
          const mainMeals = daySnaps.filter(s => s.mealType !== "snack");
          if (mainMeals.length > 0) {
            const hasHigh = mainMeals.some(s => s.glucoseImpact === "high" && !isHealthyFood(s.foodName));
            const hasMed  = mainMeals.some(s => s.glucoseImpact === "medium");
            const hasLow  = mainMeals.some(s => s.glucoseImpact === "low");
            if (hasHigh) gridHigh++;
            else if (hasMed) gridMedium++;
            else if (hasLow) gridStable++;
          }
        }

        return { date, dayOfWeek, breakfast, lunch, dinner, snackImpacts, isFuture };
      });

      const dayBreakdown = { stable: gridStable, medium: gridMedium, high: gridHigh, total: gridStable + gridMedium + gridHigh };
      const hasAiDays = dayBreakdown.total > 0;

      // Weekly score (same 50/25/25 formula as monthly)
      const daysElapsed = (() => {
        const todayDateStr = getLocalDate(profile.deviceTimezone);
        const today = new Date(todayDateStr + "T12:00:00Z");
        const diffMs = today.getTime() - weekStartDate.getTime();
        return Math.min(7, Math.max(1, Math.floor(diffMs / 86400000) + 1));
      })();
      const wkSnapsWithImpact = snaps.filter(s => s.glucoseImpact);
      const wkSignalQuality = wkSnapsWithImpact.length > 0
        ? wkSnapsWithImpact.filter(s =>
            s.glucoseImpact === "low" || s.glucoseImpact === "medium" || isHealthyFood(s.foodName)
          ).length / wkSnapsWithImpact.length
        : 0;
      const wkTimingRegularity = dayMealTypes.size > 0
        ? [...dayMealTypes.values()].filter(s => s.size >= 2).length / dayMealTypes.size
        : 0;
      const wkFreqConsistency = new Set(snaps.map(s => s.localDate)).size / daysElapsed;
      const weeklyScore = Math.round(wkSignalQuality * 50 + wkTimingRegularity * 25 + wkFreqConsistency * 25);
      const weeklyComponents = {
        signalQuality: Math.round(wkSignalQuality * 100),
        timingRegularity: Math.round(wkTimingRegularity * 100),
        freqConsistency: Math.round(wkFreqConsistency * 100),
      };

      return res.json({ snapCount, insufficient: false, lateMealCount, missedMealDays, irregularMealDays, mealTypeAvgs, worstDay, worstMeal, worstFood, worstMeals, worstFoods, irregularMealType, dayBreakdown, dailyGrid, hasAiDays, score: weeklyScore, components: weeklyComponents, recFood, recommendedFood });
    } catch (error: any) {
      console.error("Snap weekly-summary error:", error);
      res.status(500).json({ message: "Failed to fetch weekly summary." });
    }
  });

  app.get("/api/snap/monthly-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { month } = req.query;
      if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month query param required (YYYY-MM)" });
      }

      const [yStr, mStr] = month.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

      const priorM = m === 1 ? 12 : m - 1;
      const priorY = m === 1 ? y - 1 : y;
      const priorMonth = `${priorY}-${String(priorM).padStart(2, "0")}`;

      // 1. Archive-first: serve from snap_monthly_archive when available
      const archived = await storage.getMonthlyArchive(userId, month);
      if (archived) {
        if (archived.score === null) {
          return res.json({ snapCount: 0, insufficient: true, month });
        }
        const [priorArchive, dailyRows] = await Promise.all([
          storage.getMonthlyArchive(userId, priorMonth),
          storage.getDailyGlucoseForMonth(userId, month),
        ]);
        const priorScore = priorArchive?.score ?? null;
        let archStable: number | null = null, archMedium: number | null = null, archHigh: number | null = null, archLogged: number | null = null;
        if (dailyRows.length > 0) {
          archStable = 0; archMedium = 0; archHigh = 0;
          archLogged = dailyRows.filter(r => r.lowCount + r.mediumCount + r.highCount > 0).length;
          for (const r of dailyRows) {
            if (r.highCount > 0) archHigh++;
            else if (r.mediumCount > 0) archMedium++;
            else if (r.lowCount > 0) archStable++;
          }
        }
        return res.json({
          snapCount: 0,
          insufficient: false,
          month,
          score: archived.score,
          components: {
            signalQuality: archived.signalQuality,
            timingRegularity: archived.timingRegularity,
            freqConsistency: archived.freqConsistency,
          },
          topHighFood: archived.topHighFood,
          topLowFood: archived.topLowFood,
          irregularMealDays: archived.irregularMealDays,
          priorScore,
          isFirstMonth: priorScore === null,
          stableDays: archStable,
          mediumDays: archMedium,
          highDays: archHigh,
          loggedDays: archLogged,
          hasAiDays: archLogged !== null && archLogged > 0,
        });
      }

      // 2. Safety net: compute from raw snaps (archive job may not have run yet)
      const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const priorLastDay = new Date(Date.UTC(priorY, priorM, 0)).getUTCDate();
      const priorStart = `${priorY}-${String(priorM).padStart(2, "0")}-01`;
      const priorEnd = `${priorY}-${String(priorM).padStart(2, "0")}-${String(priorLastDay).padStart(2, "0")}`;

      const [snaps, priorSnaps, profile] = await Promise.all([
        storage.getMealSnapsByDateRange(userId, monthStart, monthEnd),
        storage.getMealSnapsByDateRange(userId, priorStart, priorEnd),
        storage.getProfile(userId),
      ]);

      const snapCount = snaps.length;
      if (snapCount < 5) {
        storage.upsertMonthlyArchive({ userId, month }).catch(e =>
          console.error("[snap/monthly-summary] Insufficient marker upsert failed:", e?.message),
        );
        return res.json({ snapCount, insufficient: true, month });
      }

      const tz = profile?.deviceTimezone ?? null;
      const metrics = computeMonthlyFromSnaps(snaps, lastDay, tz);

      storage.upsertMonthlyArchive({ userId, month, ...metrics }).catch(e =>
        console.error("[snap/monthly-summary] Safety net archive upsert failed:", e?.message),
      );

      const priorScore = priorSnaps.length >= 5
        ? computeMonthlyFromSnaps(priorSnaps, priorLastDay, tz).score
        : null;

      // Day breakdown for Chart 7 donut
      const snDayImpact = new Map<string, { hasHigh: boolean; hasMed: boolean; hasLow: boolean }>();
      for (const snap of snaps) {
        if (snap.mealType === "snack") continue;
        if (!snDayImpact.has(snap.localDate)) snDayImpact.set(snap.localDate, { hasHigh: false, hasMed: false, hasLow: false });
        const di = snDayImpact.get(snap.localDate)!;
        if (snap.glucoseImpact === "high")   di.hasHigh = true;
        if (snap.glucoseImpact === "medium") di.hasMed  = true;
        if (snap.glucoseImpact === "low")    di.hasLow  = true;
      }
      let snStable = 0, snMedium = 0, snHigh = 0;
      for (const di of snDayImpact.values()) {
        if (di.hasHigh) snHigh++;
        else if (di.hasMed) snMedium++;
        else if (di.hasLow) snStable++;
      }
      const snLogged = snDayImpact.size;

      return res.json({
        snapCount,
        insufficient: false,
        month,
        score: metrics.score,
        components: {
          signalQuality: metrics.signalQuality,
          timingRegularity: metrics.timingRegularity,
          freqConsistency: metrics.freqConsistency,
        },
        topHighFood: metrics.topHighFood,
        topLowFood: metrics.topLowFood,
        irregularMealDays: metrics.irregularMealDays,
        priorScore,
        isFirstMonth: priorScore === null,
        stableDays: snStable,
        mediumDays: snMedium,
        highDays: snHigh,
        loggedDays: snLogged,
        hasAiDays: snLogged > 0,
      });
    } catch (error: any) {
      console.error("Snap monthly-summary error:", error);
      res.status(500).json({ message: "Failed to fetch monthly summary." });
    }
  });

  app.get("/api/snap/meal-log", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { month } = req.query as { month?: string };
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month param required (YYYY-MM)" });
      }
      const [y, m] = month.split("-").map(Number);
      const startDate = `${month}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
      const [snaps, profile] = await Promise.all([
        storage.getMealSnapsByDateRange(userId, startDate, endDate),
        storage.getProfile(userId),
      ]);
      const baseline = profile?.fastingBaselineMmol ?? null;
      const items = snaps
        .sort((a, b) => {
          if (b.localDate !== a.localDate) return b.localDate.localeCompare(a.localDate);
          return new Date(b.snapTime).getTime() - new Date(a.snapTime).getTime();
        })
        .map(s => ({
          id: s.id,
          snapTime: s.snapTime,
          localDate: s.localDate,
          mealType: s.mealType,
          foodName: s.foodName,
          glucoseImpact: s.glucoseImpact,
          postMealGlucoseMmol: s.postMealGlucoseMmol ?? null,
          postMealSymptom: s.postMealSymptom ?? null,
          postMealSkipped: s.postMealSkipped,
        }));
      res.json({ month, items });
    } catch (error: any) {
      console.error("Snap meal-log error:", error);
      res.status(500).json({ message: "Failed to fetch meal log." });
    }
  });

  app.post("/api/snap/post-meal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { snapId, glucoseMmol, symptom, skip, fastingBaseline, fastingBaselineEstimated } = req.body;
      if (!snapId || typeof snapId !== "number") return res.status(400).json({ message: "snapId required" });
      if (glucoseMmol !== undefined && (typeof glucoseMmol !== "number" || glucoseMmol < 2.0 || glucoseMmol > 30.0)) {
        return res.status(400).json({ message: "glucoseMmol must be a number between 2.0 and 30.0" });
      }
      const VALID_SYMPTOMS = ["normal", "tired", "blurred_vision", "thirsty"];
      if (symptom !== undefined && !VALID_SYMPTOMS.includes(symptom)) {
        return res.status(400).json({ message: "invalid symptom value" });
      }
      // Resolve glucoseImpact before the atomic write so both the snap update
      // and the impact reclassification land in the same transaction.
      let glucoseImpact: string | undefined;
      if (glucoseMmol !== undefined) {
        try {
          const { classifyPostMealMmol, PHASE1_THRESHOLDS, deriveGlucoseGroupFromCondition } = await import("./glucose-thresholds");
          const profile2 = await storage.getProfile(userId);
          const glucoseGroup = (profile2?.glucoseGroup ?? deriveGlucoseGroupFromCondition(profile2?.healthCondition ?? null)) as "healthy" | "t2dm" | undefined;
          if (glucoseGroup && PHASE1_THRESHOLDS[glucoseGroup]) {
            const thresholdRow = await storage.getUserGlucoseThresholds(userId);
            glucoseImpact = classifyPostMealMmol(
              glucoseMmol,
              glucoseGroup,
              thresholdRow?.isPersonalised ? { lowMedBoundary: thresholdRow.lowMedBoundary, medHighBoundary: thresholdRow.medHighBoundary } : undefined,
            );
          }
        } catch (reclassErr: any) {
          console.error("[post-meal/reclassify] Error resolving impact:", reclassErr?.message);
        }
      }

      const { updated, localDate } = await storage.updateMealSnapPostMealWithHistory(snapId, userId, {
        glucoseMmol,
        symptom,
        skipped: skip === true,
        recordedAt: new Date(),
        glucoseImpact,
      });
      if (!updated) return res.status(404).json({ message: "Snap not found" });

      if (localDate) {
        await storage.reaggregateDailyGlucoseForDate(userId, localDate);
      }
      if (!skip) {
        await storage.updateProfile(userId, { consecutiveSkippedMeals: 0 });
      }
      if (glucoseMmol !== undefined) {
        const profile = await storage.getProfile(userId);
        if (profile && profile.fastingBaselineMmol === null) {
          if (fastingBaseline !== undefined) {
            await storage.updateProfile(userId, {
              fastingBaselineMmol: fastingBaseline,
              fastingBaselineEstimated: fastingBaselineEstimated === true,
              fastingQuestionSeen: true,
            });
          } else if (!profile.fastingQuestionSeen) {
            await storage.updateProfile(userId, { fastingQuestionSeen: true });
          }
        }
      }
      res.json({ ok: true });
    } catch (error: any) {
      console.error("post-meal error:", error);
      res.status(500).json({ message: "Failed to save post-meal record." });
    }
  });

  app.get("/api/user/glucose-thresholds", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      const { PHASE1_THRESHOLDS } = await import("./glucose-thresholds");
      const glucoseGroup = profile?.glucoseGroup ?? null;
      const row = await storage.getUserGlucoseThresholds(userId);
      const liveCount = await storage.getHStixReadingCount(userId);
      if (!row && !glucoseGroup) {
        return res.json({ glucoseGroup: null, lowMedBoundary: null, medHighBoundary: null, readingCount: liveCount, isPersonalised: false, glucosePersonalisedSeen: true });
      }
      const phase1 = glucoseGroup ? PHASE1_THRESHOLDS[glucoseGroup as "healthy" | "t2dm"] : null;
      return res.json({
        glucoseGroup,
        lowMedBoundary:           row?.lowMedBoundary  ?? phase1?.lowMedBoundary  ?? null,
        medHighBoundary:          row?.medHighBoundary ?? phase1?.medHighBoundary ?? null,
        readingCount:             liveCount,
        isPersonalised:           row?.isPersonalised  ?? false,
        glucosePersonalisedSeen:  profile?.glucosePersonalisedSeen ?? true,
      });
    } catch (error: any) {
      console.error("glucose-thresholds error:", error);
      res.status(500).json({ message: "Failed to fetch glucose thresholds." });
    }
  });

  app.post("/api/user/glucose-personalised-seen", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateProfile(userId, { glucosePersonalisedSeen: true });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("glucose-personalised-seen error:", error);
      res.status(500).json({ message: "Failed to update." });
    }
  });

  app.get("/api/snap/pending-post-meal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const snap = await storage.getPendingPostMealSnap(userId);
      res.json({ snap });
    } catch (error: any) {
      console.error("pending-post-meal error:", error);
      res.status(500).json({ message: "Failed to fetch pending snap." });
    }
  });

  app.get("/api/snap/glucose-patterns", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { food } = req.query as { food?: string };
      if (food) {
        const drilldown = await storage.getGlucosePatternDrilldown(userId, food);
        return res.json({ drilldown });
      }
      const [totalPaired, totalSnaps, patterns, aiOnlyList] = await Promise.all([
        storage.getTotalPairedEntries(userId),
        storage.getTotalSnaps(userId),
        storage.getGlucosePatterns(userId),
        storage.getAiOnlyFoodRanking(userId),
      ]);
      res.json({ totalPaired, totalSnaps, topList: patterns.topList, aiOnlyList });
    } catch (error: any) {
      console.error("glucose-patterns error:", error);
      res.status(500).json({ message: "Failed to fetch glucose patterns." });
    }
  });

  app.get("/api/snap/monthly-symptoms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { month } = req.query as { month?: string };
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month required (YYYY-MM)" });
      }
      const result = await storage.getMonthlySymptomCounts(userId, month);
      res.json(result);
    } catch (error: any) {
      console.error("monthly-symptoms error:", error);
      res.status(500).json({ message: "Failed to fetch monthly symptoms." });
    }
  });

  app.get("/api/snap/nudge-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.json({ showNudge: false });
      const shouldShow = (profile.consecutiveSkippedMeals ?? 0) >= 5 && !profile.glucometerNudgeShown;
      if (shouldShow) {
        await storage.updateProfile(userId, { glucometerNudgeShown: true });
      }
      res.json({ showNudge: shouldShow });
    } catch (error: any) {
      console.error("nudge-status error:", error);
      res.status(500).json({ message: "Failed to fetch nudge status." });
    }
  });

  app.get("/api/health-info/diet-tips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const insightsGate = canUseFeature(profile, "insights");
      const dietGate = canUseFeature(profile, "diet_advice");
      if (!insightsGate.allowed || !dietGate.allowed) {
        const gate = !insightsGate.allowed ? insightsGate : dietGate;
        return res.json({
          success: false,
          showPaywall: true,
          lockApp: gate.lockApp || false,
          feature: !insightsGate.allowed ? "insights" : "diet_advice",
        });
      }

      const allPlans: any[] = [];
      for (let w = 1; w <= (profile.currentWeek || 1); w++) {
        const plan = await storage.getWeeklyPlan(userId, w);
        if (plan) allPlans.push(plan);
      }

      const user = await authStorage.getUser(userId);
      const email = user?.email?.toLowerCase()?.trim();
      const isDev = DEV_EMAILS.some(d => d.toLowerCase().trim() === email);

      if (isDev) {
        const allTips = Object.values(DIET_TIP_LADDERS).flat();
        return res.json({ activeTips: allTips });
      }

      const seenTips = new Set<string>();
      for (const plan of allPlans) {
        if (plan.dietTip) seenTips.add(plan.dietTip);
      }

      res.json({ activeTips: Array.from(seenTips) });
    } catch (error) {
      console.error("Error fetching diet tips:", error);
      res.status(500).json({ message: "Failed to fetch diet tips" });
    }
  });

  app.get("/api/gate-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      profile = await ensureCompPremium(userId, profile);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(getGateStatus(profile));
    } catch (error: any) {
      console.error("Error fetching gate status:", error);
      res.status(500).json({ message: "Failed to fetch gate status" });
    }
  });

  // Refresh premium status. The backend is the only source of truth.
  // Any client-supplied `isPremium` value in the body is IGNORED — the
  // server asks RevenueCat directly via verifyEntitlement() and writes
  // the verified result (true OR false) to profiles.is_premium.
  // Comp-list users always remain premium regardless of RC.
  const refreshPremiumHandler = async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getProfile(userId);
      if (!existing) return res.status(404).json({ message: "Profile not found" });

      // Comp users (e.g. App Store reviewer, internal accounts) are always premium.
      const isComp = await isCompUserId(userId);
      let verifiedPremium: boolean;
      let source: string;
      let transient = false;
      let selfHealAttempted = false;
      let selfHealOutcome: string | undefined;
      // Server-trusted RC subscriber id, surfaced from verifyEntitlement.
      // We do NOT trust req.body.customerId for this — that path was
      // spoofable: any authenticated client could rotate fake ids to
      // reset their snap counter. By deriving it from the RC fetch we
      // guarantee the customerId is the one RC actually has on file
      // for this Replit userId.
      let trustedCustomerId: string | null = null;
      if (isComp) {
        verifiedPremium = true;
        source = "comp";
      } else {
        // Honor the 30s cache for routine refreshes (boot, foreground,
        // homepage gate checks). Only force-bypass when the caller asks
        // for it (e.g. post-purchase callback from the hosted paywall).
        if (req.body?.force === true) {
          invalidateEntitlementCache(userId);
        }
        // RC identity is established via purchases.login(userId, …) at
        // auth resolve, so the receipt is recorded against the Replit
        // user id directly — a single direct verify is the source of
        // truth. No anon-id walks, no alias machinery.
        let result = await verifyEntitlement(userId);
        // #581: post-purchase propagation retry. RC's CDN occasionally
        // lags StoreKit by a couple of seconds after a successful
        // purchase, so the first verify can return "not premium" and
        // bounce the user back to the paywall. When the caller flags
        // the request as a post-purchase verification, wait briefly
        // and re-verify once with cache bypass; the second call sees
        // the propagated entitlement. Non-purchase refreshes (boot,
        // foreground, gate checks) do NOT retry — flag is opt-in.
        if (!result.hasPremium && req.body?.recentPurchase === true) {
          await new Promise((r) => setTimeout(r, 1500));
          result = await verifyEntitlement(userId, { bypassCache: true });
        }
        verifiedPremium = result.hasPremium;
        source = result.source;
        transient = result.transient;
        if (result.originalAppUserId) {
          trustedCustomerId = result.originalAppUserId;
        }

        // Delete-and-reinstall self-heal. When verify comes back
        // `not_found` for the new Replit user id but the device's BN
        // bridge just reported a `customerId` from a restore call that
        // belongs to a real RC subscriber with an active receipt AND a
        // matching email, transfer the subscriber over so the next
        // verify unlocks the user. This is a defensive fallback for
        // when the RC dashboard's "Restore Behavior" knob is not set
        // to "Transfer to new App User ID" — the dashboard knob is the
        // primary mechanism, this server-side path catches misconfig.
        // Fail-closed: only proceed when both the active-sub AND
        // matching-email checks pass; weak / ambiguous matches abort.
        const force = req.body?.force === true;
        const bridgeCustomerId =
          typeof req.body?.customerId === "string" ? req.body.customerId.trim() : "";
        if (result.source === "not_found") {
          console.warn(
            `[premium/refresh] not_found user=${userId} bridgeCustomerId=${bridgeCustomerId || "(none)"} ` +
              `force=${force} — RC dashboard Restore Behavior may be misconfigured`,
          );
        }
        if (
          force &&
          !verifiedPremium &&
          result.source === "not_found" &&
          bridgeCustomerId &&
          bridgeCustomerId !== userId
        ) {
          selfHealAttempted = true;
          try {
            const authUser = await authStorage.getUser(userId);
            const userEmail = (authUser?.email || "").toLowerCase().trim();
            const sourcePayload = await fetchSubscriberRaw(bridgeCustomerId);
            if (!sourcePayload) {
              selfHealOutcome = "source_not_found";
              console.warn(
                `[premium/refresh] self-heal aborted user=${userId} from=${bridgeCustomerId} reason=${selfHealOutcome}`,
              );
            } else {
              const isPremiumOnSource = evaluatePayload(sourcePayload);
              const subEmail = getSubscriberEmail(sourcePayload);
              const emailMatches = !!userEmail && !!subEmail && subEmail === userEmail;
              if (!isPremiumOnSource || !emailMatches) {
                selfHealOutcome = `weak_match isPremium=${isPremiumOnSource} emailMatches=${emailMatches}`;
                console.warn(
                  `[premium/refresh] self-heal aborted user=${userId} from=${bridgeCustomerId} ${selfHealOutcome}`,
                );
              } else {
                console.log(
                  `[premium/refresh] self-heal transfer attempt user=${userId} from=${bridgeCustomerId} email=${userEmail}`,
                );
                const aliasResult = await aliasSubscriber(bridgeCustomerId, userId);
                if (!aliasResult.ok) {
                  selfHealOutcome = `transfer_failed status=${aliasResult.status} error=${aliasResult.error ?? ""}`;
                  console.warn(
                    `[premium/refresh] self-heal transfer failed user=${userId} ${selfHealOutcome}`,
                  );
                } else {
                  invalidateEntitlementCache(userId);
                  const reverify = await verifyEntitlement(userId, { bypassCache: true });
                  verifiedPremium = reverify.hasPremium;
                  source = reverify.hasPremium ? "self_heal_transfer" : reverify.source;
                  transient = reverify.transient;
                  // After a successful self-heal transfer the new
                  // RC subscriber for this userId carries the
                  // bridge customerId we just verified above. Pick
                  // it up so the trusted-customerId persist below
                  // catches it in the same request, instead of
                  // waiting for the next refresh.
                  if (reverify.originalAppUserId) {
                    trustedCustomerId = reverify.originalAppUserId;
                  }
                  selfHealOutcome = `transfer_ok verifiedAfter=${verifiedPremium}`;
                  console.log(
                    `[premium/refresh] self-heal ${selfHealOutcome} user=${userId} from=${bridgeCustomerId}`,
                  );
                }
              }
            }
          } catch (e: any) {
            selfHealOutcome = `error ${e?.message ?? String(e)}`;
            console.warn(`[premium/refresh] self-heal error user=${userId}:`, e);
          }
        }
      }

      let profile = existing;
      const update = computePremiumRefreshUpdate(existing, verifiedPremium);
      if (update) {
        const updated = await storage.updateProfile(
          userId,
          update as Partial<InsertUserProfile>,
        );
        if (updated) profile = updated;
        if (update.isPremium !== undefined) {
        }
        if (update.hardLockedAfterAdviceDismiss === false) {
        }
      }

      // Persist the SERVER-TRUSTED RC subscriber id (from the verify
      // response above) so the daily snap quota can be enforced per
      // App Store subscription instead of per Glukky account. This
      // closes the multi-account abuse vector (Task #522). We
      // intentionally ignore req.body.customerId here — that value is
      // unauthenticated client input and a malicious user could
      // rotate fake ids to reset their counter. setRcCustomerId is
      // idempotent and best-effort — never fail the refresh.
      if (trustedCustomerId) {
        try {
          await storage.setRcCustomerId(userId, trustedCustomerId);
          if (profile.rcCustomerId !== trustedCustomerId) {
            const refreshed = await storage.getProfile(userId);
            if (refreshed) profile = refreshed;
          }
        } catch (e: any) {
          console.warn(
            `[premium/refresh] setRcCustomerId failed user=${userId}: ${e?.message ?? e}`,
          );
        }
      }

      console.log(
        `[premium/refresh] user=${userId} verified=${verifiedPremium} source=${source} stored=${profile.isPremium}` +
          ` rcCustomerId=${profile.rcCustomerId ? "set" : "(none)"}` +
          (selfHealAttempted ? ` selfHeal=${selfHealOutcome ?? "?"}` : ""),
      );

      res.json({
        ...getGateStatus(profile),
        verifiedPremium,
        verificationSource: source,
        transient,
        selfHealAttempted,
        selfHealOutcome,
      });
    } catch (error: any) {
      console.error("Error refreshing premium status:", error);
      captureException(error, req.user?.claims?.sub, { route: "/api/refresh-premium-status", method: "POST" });
      res.status(500).json({ message: "Failed to refresh premium status" });
    }
  };

  // Lightweight client-mirrored trace endpoint. Posts from the restore
  // flow land here so the entire restore path (button tap → bridge →
  // verify → outcome) is reconstructable from deployment logs alone,
  // not just from a developer with the dev panel open. Body shape is
  // intentionally loose; we just stamp it with userId and console.log.
  app.post("/api/diag/restore-trace", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const body = req.body || {};
      const event = typeof body.event === "string" ? body.event : "unknown";
      const installId = typeof body.installId === "string" ? body.installId.slice(0, 64) : "";
      // Strip anything heavy / sensitive before logging.
      const { event: _evt, installId: _iid, ...data } = body;
      let payload = "";
      try {
        payload = JSON.stringify(data).slice(0, 800);
      } catch {
        payload = "(unserializable)";
      }
      console.log(
        `[restore-trace] user=${userId} install=${installId || "(none)"} event=${event} ${payload}`,
      );
      res.json({ ok: true });
    } catch (error: any) {
      console.warn("[restore-trace] error:", error?.message || error);
      res.status(200).json({ ok: false });
    }
  });

  app.post("/api/update-premium-status", isAuthenticated, refreshPremiumHandler);
  app.post("/api/refresh-premium-status", isAuthenticated, refreshPremiumHandler);

  // RevenueCat → server webhook. Configured in the RC dashboard with a shared
  // secret in the Authorization header so we can flip is_premium the moment
  // RC observes a billing / refund / expiration event, even if the user never
  // re-opens the app. RC identity is established via purchases.login(userId)
  // in the BN bridge, so webhook payloads carry the real Replit user id
  // directly — no anonymous-id alias resolution is needed here.
  app.post("/api/revenuecat/webhook", async (req, res) => {
    try {
      const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
      if (!expected) {
        console.warn("[revenuecat/webhook] REVENUECAT_WEBHOOK_AUTH_HEADER not set; rejecting.");
        return res.status(503).json({ message: "Webhook not configured" });
      }
      const provided = req.header("authorization") || req.header("Authorization");
      if (provided !== expected) {
        console.warn("[revenuecat/webhook] auth header mismatch");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const body = (req.body || {}) as RevenueCatWebhookBody;
      const event = body.event;
      if (!event || typeof event !== "object") {
        return res.status(200).json({ ok: true, outcome: "ignored", reason: "no_event" });
      }

      const result = await applyWebhookEvent(event, {
        setPremium: async (userId, value) => {
          const existing = await storage.getProfile(userId);
          if (!existing) return false;
          if (existing.isPremium === value) return true;
          const updated = await storage.updateProfile(userId, { isPremium: value });
          return !!updated;
        },
        reverify: async (userId) => {
          invalidateEntitlementCache(userId);
          const r = await verifyEntitlement(userId);
          return r.hasPremium;
        },
      });

      console.log(
        `[revenuecat/webhook] type=${result.type ?? event.type ?? "?"} outcome=${result.outcome}` +
          (result.userId ? ` user=${result.userId}` : ""),
      );

      trackServer(result.userId ?? null, "revenuecat_webhook_processed", {
        type: result.type ?? event.type ?? null,
        outcome: result.outcome,
      });
      if (result.outcome === "granted" && result.userId) {
        trackServer(result.userId, "subscription_started");
      }

      return res.status(200).json({ ok: true, ...result });
    } catch (error: any) {
      console.error("[revenuecat/webhook] error:", error?.message || error);
      captureException(error, null, { route: "/api/revenuecat/webhook", method: "POST" });
      // Return 500 so RevenueCat retries the delivery. Transient DB / network
      // issues should not silently drop entitlement-changing events.
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // ── Snap scheduled jobs ──────────────────────────────────────────────────

  async function runMonthlyArchiveJob() {
    console.log("[snap/archive] Monthly archive job started.");
    const pairs = await storage.getAllUnarchivedMonths();
    console.log(`[snap/archive] ${pairs.length} (userId, month) pair(s) to archive.`);
    for (const { userId, month } of pairs) {
      try {
        const [yStr, mStr] = month.split("-");
        const yy = parseInt(yStr, 10);
        const mm = parseInt(mStr, 10);
        const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
        const monthStart = `${yy}-${String(mm).padStart(2, "0")}-01`;
        const monthEnd = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const [snaps, profile] = await Promise.all([
          storage.getMealSnapsByDateRange(userId, monthStart, monthEnd),
          storage.getProfile(userId),
        ]);
        if (snaps.length < 5) {
          await storage.upsertMonthlyArchive({ userId, month });
        } else {
          const metrics = computeMonthlyFromSnaps(snaps, lastDay, profile?.deviceTimezone ?? null);
          await storage.upsertMonthlyArchive({ userId, month, ...metrics });
        }
        const dayMap = new Map<string, { low: number; medium: number; high: number; mealCount: number; hasLateMeal: boolean }>();
        const tz = profile?.deviceTimezone || "UTC";
        for (const snap of snaps) {
          if (!dayMap.has(snap.localDate)) dayMap.set(snap.localDate, { low: 0, medium: 0, high: 0, mealCount: 0, hasLateMeal: false });
          const entry = dayMap.get(snap.localDate)!;
          entry.mealCount++;
          if (snap.glucoseImpact === "low") entry.low++;
          else if (snap.glucoseImpact === "medium") entry.medium++;
          else if (snap.glucoseImpact === "high") entry.high++;
          if (!entry.hasLateMeal && (snap.mealType === "dinner" || snap.mealType === "snack")) {
            const snapDate = snap.snapTime instanceof Date ? snap.snapTime : new Date(snap.snapTime as any);
            const hour = parseInt(new Intl.DateTimeFormat("en", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(snapDate), 10);
            if (hour >= 21) entry.hasLateMeal = true;
          }
        }
        for (const [localDate, counts] of dayMap) {
          await storage.upsertDailyGlucose(userId, localDate, counts);
        }
      } catch (innerErr: any) {
        console.error(`[snap/archive] Failed for ${userId}/${month}:`, innerErr?.message);
      }
    }
    console.log("[snap/archive] Monthly archive job completed.");
  }

  async function runDailyDeleteJob() {
    console.log("[snap/delete] Daily delete job started.");
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    const tzCache = new Map<string, string>();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await storage.fetchMealSnapsBeforeDate(cutoff, 500);
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
            const p = await storage.getProfile(snap.userId);
            tz = p?.deviceTimezone || "UTC";
            tzCache.set(snap.userId, tz);
          }
          const snapDate = snap.snapTime instanceof Date ? snap.snapTime : new Date(snap.snapTime as any);
          const hour = parseInt(new Intl.DateTimeFormat("en", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(snapDate), 10);
          if (hour >= 21) entry.hasLateMeal = true;
        }
      }
      for (const [userId, dayMap] of userDayMap) {
        for (const [localDate, counts] of dayMap) {
          await storage.upsertDailyGlucose(userId, localDate, counts);
        }
      }
      // snap_daily_glucose is PERMANENT — only meal_snaps rows are purged here,
      // after their glucose counts have been aggregated into snap_daily_glucose.
      // Never add snap_daily_glucose purge logic to this job.
      await storage.purgeMealSnapsByIds(batch.map(s => s.id));
      totalDeleted += batch.length;
    }
    console.log(`[snap/delete] Completed. Deleted ${totalDeleted} snap rows.`);
  }

  setInterval(() => {
    storage.expireStalePostMealWindows().catch(e =>
      console.error("[post-meal/expire] Error:", e?.message)
    );
  }, 5 * 60 * 1000);

  async function runNightlyThresholdJob() {
    const { computePersonalisedThresholds, PHASE1_THRESHOLDS, PERSONALISED_THRESHOLD } = await import("./glucose-thresholds");
    const usersWithGroup = await storage.getUsersWithGlucoseGroup();
    for (const { userId, glucoseGroup } of usersWithGroup) {
      try {
        const phase1 = PHASE1_THRESHOLDS[glucoseGroup as "healthy" | "t2dm"];
        if (!phase1) continue;
        const readingCount = await storage.getHStixReadingCount(userId);
        const thresholdRow = await storage.getUserGlucoseThresholds(userId);
        if (readingCount >= PERSONALISED_THRESHOLD) {
          const readings = await storage.getRecentHStixReadings(userId);
          const personalised = computePersonalisedThresholds(readings, glucoseGroup as "healthy" | "t2dm");
          const wasPersonalised = thresholdRow?.isPersonalised ?? false;
          await storage.upsertUserGlucoseThresholds({
            userId,
            lowMedBoundary:  personalised.lowMedBoundary,
            medHighBoundary: personalised.medHighBoundary,
            readingCount,
            isPersonalised:  true,
            firstActivatedAt: wasPersonalised ? thresholdRow!.firstActivatedAt : new Date(),
          });
          if (!wasPersonalised) {
            await storage.updateProfile(userId, { glucosePersonalisedSeen: false });
            trackServer(userId, "glucose_pattern_personalized_unlocked", { readingCount });
          }
        } else {
          await storage.upsertUserGlucoseThresholds({
            userId,
            lowMedBoundary:  phase1.lowMedBoundary,
            medHighBoundary: phase1.medHighBoundary,
            readingCount,
            isPersonalised:  false,
            firstActivatedAt: null,
          });
        }
      } catch (e: any) {
        console.error(`[glucose/thresholds] Error for user ${userId}:`, e?.message);
      }
    }
    console.log(`[glucose/thresholds] Nightly job complete. Processed ${usersWithGroup.length} users.`);
  }

  app.get("/api/health-data/:recordType/:recordId/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recordType, recordId } = req.params;
      const id = parseInt(recordId, 10);
      if (isNaN(id) || id <= 0) return res.status(400).json({ message: "Invalid recordId" });
      // Accept both underscore and hyphen separators for convenience.
      const kindMap: Record<string, "profile" | "meal_snap" | "glucose_thresholds"> = {
        "profile": "profile",
        "meal_snap": "meal_snap",
        "meal-snap": "meal_snap",
        "glucose_thresholds": "glucose_thresholds",
        "glucose-thresholds": "glucose_thresholds",
      };
      const kind = kindMap[recordType];
      if (!kind) return res.status(400).json({ message: "Invalid recordType. Use: profile, meal_snap, glucose_thresholds" });
      // null → base record not found or owned by a different user.
      // Both cases return 404 (indistinguishable by design for privacy).
      // [] → owned record with no history rows yet — valid for legacy data with no
      // retroactive backfill; return 200 with an empty array, not 404.
      const history = await storage.getHealthHistory(kind, id, userId);
      if (history === null) return res.status(404).json({ message: "Record not found" });
      res.json({ history });
    } catch (e: any) {
      console.error("[health-data/history] error:", e?.message);
      res.status(500).json({ message: "Failed to fetch health history" });
    }
  });

  let _lastMonthlyArchiveRun: string | null = null;
  let _lastDailyDeleteRun: string | null = null;
  let _lastThresholdRun: string | null = null;

  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDate = now.getUTCDate();
    const utcMonth = now.getUTCMonth() + 1;
    const utcYear = now.getUTCFullYear();
    const monthKey = `${utcYear}-${String(utcMonth).padStart(2, "0")}`;
    const dateKey = `${utcYear}-${String(utcMonth).padStart(2, "0")}-${String(utcDate).padStart(2, "0")}`;
    if (utcDate === 1 && utcHour === 0 && _lastMonthlyArchiveRun !== monthKey) {
      _lastMonthlyArchiveRun = monthKey;
      runMonthlyArchiveJob().catch(e => console.error("[snap/archive] Scheduler:", e?.message));
    }
    if (utcHour === 3 && _lastDailyDeleteRun !== dateKey) {
      _lastDailyDeleteRun = dateKey;
      runDailyDeleteJob().catch(e => console.error("[snap/delete] Scheduler:", e?.message));
    }
    if (utcHour === 2 && _lastThresholdRun !== dateKey) {
      _lastThresholdRun = dateKey;
      runNightlyThresholdJob().catch(e => console.error("[glucose/thresholds] Scheduler:", e?.message));
    }
  }, 60 * 60 * 1000);

  // ─────────────────────────────────────────────────────────────────────────

  return httpServer;
}
