import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import {
  sortStruggles, getFirstWeekPlan, createWeeklyPlan, getWeeklyReflection,
  generateWeeklyReportData, generateMonthlyReportData,
  processDinnerGraduation, getDinnerGraduationData, checkBiWeeklyTriggers, getStretchProgression,
  getWeekStartDate, evaluateDietStruggle, checkRepickCondition, checkCycle3RepickCondition, checkCurrentCycleRepickCondition,
} from "./engine";
import { DIET_TIP_LADDERS, DIET_TIP_I18N_KEYS, MITIGATION_TRIO_LABELS, STRUGGLE_PRIORITY, type InsertUserProfile } from "@shared/schema";
import {
  evaluateDailyAchievements,
  evaluateWeeklyAchievements,
  awardStruggleGraduationCoin,
} from "./achievements";

const SUGARY_DRINK_KW = [
  "juice", "tea", "milk tea", "bubble tea", "boba", "soda", "cola", "lemonade",
  "smoothie", "drink", "beverage", "yakult", "vitasoy", "horlicks", "milo",
  "ovaltine", "cocoa", "hot chocolate", "latte", "cappuccino", "coffee",
  "7up", "sprite", "fanta", "ribena", "coke", "pepsi", "iced coffee",
  "herbal tea", "chrysanthemum", "barley water", "sugar cane", "matcha",
  "condensed milk", "sweetened milk",
];
const SUGARY_FRUIT_KW = [
  "fruit", "mango", "orange", "apple", "banana", "grape", "melon", "watermelon",
  "lychee", "longan", "strawberry", "blueberry", "kiwi", "pear", "peach",
  "papaya", "pineapple", "guava", "durian", "jackfruit", "rambutan",
  "plum", "cherry", "fig", "pomelo", "tangerine", "mandarin",
];
const SUGARY_FOOD_KW = [
  "cake", "biscuit", "cookie", "dessert", "sweet", "candy", "chocolate",
  "pudding", "tart", "pastry", "bun", "pineapple bun", "egg tart",
  "wife cake", "walnut cookie", "sesame ball", "sago", "glutinous",
  "sweet soup", "tang yuan", "red bean", "tong yuen", "sugar", "sugary",
  "donut", "doughnut", "waffle", "brownie", "ice cream", "gelato",
  "custard", "caramel", "syrup", "mochi",
];
const OILY_KW = [
  "fried", "oily", "crispy", "deep-fried", "deep fried", "pan-fried", "pan fried",
  "stir-fried", "stir fried", "lard", "butter", "greasy", "tempura",
  "french fries", "spring roll", "doughnut", "sausage", "char siu",
  "roast", "roasted", "bbq", "pork belly", "bacon",
];
const LARGE_PORTION_KW = [
  "large", "big", "jumbo", "extra", "double", "xl", "full", "whole", "super",
  "king size", "oversized", "king-size",
];
const SNACK_KW = [
  "snack", "chips", "biscuit", "cookie", "cracker", "candy", "chocolate",
  "sweets", "cake", "pastry", "puff", "pudding", "wafer", "popcorn",
  "mochi", "gummy", "jelly", "toffee", "caramel", "fudge", "prawn crackers",
];

interface TipEntry { key: string; timing: "immediate" | "future"; }
interface FocusPanelData { struggleKey: string; tips: TipEntry[]; }

function computeFocusPanel(
  struggle: string,
  tipIndex: number,
  name: string,
  portion: string | null,
  sauces: string | null,
  extras: string | null
): FocusPanelData | null {
  const supported = ["sugary_food_drink", "oily_fried_food", "portions", "snacks"];
  if (!supported.includes(struggle)) return null;

  const txt = [name, portion, sauces, extras].filter(Boolean).join(" ").toLowerCase();

  if (struggle === "sugary_food_drink") {
    const isDrink = SUGARY_DRINK_KW.some(kw => txt.includes(kw));
    const isFruit = SUGARY_FRUIT_KW.some(kw => txt.includes(kw));
    const isFood  = SUGARY_FOOD_KW.some(kw => txt.includes(kw));
    if (!isDrink && !isFruit && !isFood) return null;

    const tips: TipEntry[] = [];
    if (isDrink) tips.push({ key: "diet_tip.dilute_juice", timing: "immediate" });
    if (!isDrink && (isFruit || isFood)) tips.push({ key: "diet_tip.swap_dessert", timing: "future" });
    return { struggleKey: struggle, tips };
  }

  if (struggle === "oily_fried_food") {
    if (!OILY_KW.some(kw => txt.includes(kw))) return null;
    const tipList = DIET_TIP_LADDERS[struggle] ?? [];
    const tip = tipList[tipIndex] ?? tipList[0];
    const tipKey = DIET_TIP_I18N_KEYS[tip];
    if (!tipKey) return null;
    return { struggleKey: struggle, tips: [{ key: tipKey, timing: "future" }] };
  }

  if (struggle === "portions") {
    if (!LARGE_PORTION_KW.some(kw => txt.includes(kw))) return null;
    if (SUGARY_FOOD_KW.some(kw => txt.includes(kw))) return null;
    return { struggleKey: struggle, tips: [{ key: "diet_tip.plate_method", timing: "immediate" }] };
  }

  if (struggle === "snacks") {
    if (!SNACK_KW.some(kw => txt.includes(kw))) return null;
    const tipList = DIET_TIP_LADDERS[struggle] ?? [];
    const tip = tipList[tipIndex] ?? tipList[0];
    const tipKey = DIET_TIP_I18N_KEYS[tip];
    if (!tipKey) return null;
    return { struggleKey: struggle, tips: [{ key: tipKey, timing: "future" }] };
  }

  return null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { walksPerWeek, walkDuration, dinnerTime, sleepPattern, eatingOutFrequency, struggles, notificationEmail, preferredLanguage, name, goal } = req.body;

      const sortedStruggles = sortStruggles(struggles || []);
      const hasLateDinner = dinnerTime === "after_9pm";

      const existingProfile = await storage.getProfile(userId);
      const profileData = {
        walksPerWeek: walksPerWeek || 0,
        walkDuration: walkDuration || 10,
        dinnerTime: dinnerTime || "before_9pm",
        sleepPattern: sleepPattern || "regular_10_6",
        eatingOutFrequency: eatingOutFrequency || "0",
        struggles: sortedStruggles,
        hasLateDinner,
        dinnerMastered: false,
        dinnerSuccessWeeks: 0,
        onboardingComplete: true,
        notificationEmail: notificationEmail || null,
        preferredLanguage: preferredLanguage || "en",
        restDay: null,
        currentWeek: 1,
        name: name || null,
        goal: goal || null,
      };

      let profile;
      if (existingProfile) {
        profile = await storage.updateProfile(userId, profileData);
      } else {
        profile = await storage.createProfile({ userId, ...profileData });
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Error creating profile:", error);
      res.status(500).json({ message: "Failed to create profile" });
    }
  });

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
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
      const mastered1Skip = (profile.masteredStruggles as string[]) || [];
      const mastered2Skip = (profile.masteredStruggles2 as string[]) || [];
      const skipped2Skip = (profile.skippedStruggles2 as string[]) || [];
      const difficult2Skip = (profile.difficultStruggles2 as string[]) || [];
      const isLateDinnerMasteredSkip = profile.dinnerMastered === true || mastered2Skip.includes("late_dinner");
      const isS2ValidSkip = (s: string) => (STRUGGLE_PRIORITY as readonly string[]).includes(s) || s === "late_dinner";
      // Bug 2 fix: only check mastered2 for struggles2 items — mastered1 must not block repicked struggles.
      const isS2MasteredSkip = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMasteredSkip;
        return mastered2Skip.includes(s);
      };
      const isS2MasteredSkipFallback = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMasteredSkip;
        return mastered1Skip.includes(s) || mastered2Skip.includes(s);
      };
      const untried2Skip = struggles2.filter(s => isS2ValidSkip(s) && !isS2MasteredSkip(s) && !skipped2Skip.includes(s) && !difficult2Skip.includes(s));
      const triedNotMastered2Skip = struggles2.filter(s => isS2ValidSkip(s) && !isS2MasteredSkip(s) && (skipped2Skip.includes(s) || difficult2Skip.includes(s)));
      const fallback2Skip = (STRUGGLE_PRIORITY as readonly string[]).find(s => !isS2MasteredSkipFallback(s) && !skipped2Skip.includes(s) && !difficult2Skip.includes(s)) || "sugary_food_drink";
      const currentFocus = [...untried2Skip, ...triedNotMastered2Skip][0] || fallback2Skip;
      if (currentFocus !== struggle) {
        return res.status(400).json({ message: "struggle is not the current cycle-2 focus" });
      }

      const idx = struggles2.indexOf(struggle);
      if (idx === -1 || idx >= struggles2.length - 1) {
        return res.json({ struggles2 });
      }
      const newStruggles2 = [...struggles2];
      [newStruggles2[idx], newStruggles2[idx + 1]] = [newStruggles2[idx + 1], newStruggles2[idx]];
      const updated = await storage.updateProfile(userId, { struggles2: newStruggles2 });
      res.json({ struggles2: (updated?.struggles2 as string[]) || newStruggles2 });
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
      const mastered1Skip = (profile.masteredStruggles as string[]) || [];
      const mastered2Skip = (profile.masteredStruggles2 as string[]) || [];
      const mastered3Skip = (profile.masteredStruggles3 as string[]) || [];
      const skipped3Skip = (profile.skippedStruggles3 as string[]) || [];
      const difficult3Skip = (profile.difficultStruggles3 as string[]) || [];
      const isLateDinnerMasteredSkip = profile.dinnerMastered === true || mastered3Skip.includes("late_dinner");
      const isS3ValidSkip = (s: string) => (STRUGGLE_PRIORITY as readonly string[]).includes(s) || s === "late_dinner";
      const isS3MasteredSkip = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMasteredSkip;
        return mastered3Skip.includes(s);
      };
      const isS3MasteredSkipFallback = (s: string) => {
        if (s === "late_dinner") return isLateDinnerMasteredSkip;
        return mastered1Skip.includes(s) || mastered2Skip.includes(s) || mastered3Skip.includes(s);
      };
      const untried3Skip = struggles3.filter(s => isS3ValidSkip(s) && !isS3MasteredSkip(s) && !skipped3Skip.includes(s) && !difficult3Skip.includes(s));
      const triedNotMastered3Skip = struggles3.filter(s => isS3ValidSkip(s) && !isS3MasteredSkip(s) && (skipped3Skip.includes(s) || difficult3Skip.includes(s)));
      const fallback3Skip = (STRUGGLE_PRIORITY as readonly string[]).find(s => !isS3MasteredSkipFallback(s) && !skipped3Skip.includes(s) && !difficult3Skip.includes(s)) || "sugary_food_drink";
      const currentFocus = [...untried3Skip, ...triedNotMastered3Skip][0] || fallback3Skip;
      if (currentFocus !== struggle) {
        return res.status(400).json({ message: "struggle is not the current cycle-3 focus" });
      }

      const idx = struggles3.indexOf(struggle);
      if (idx === -1 || idx >= struggles3.length - 1) {
        return res.json({ struggles3 });
      }
      const newStruggles3 = [...struggles3];
      [newStruggles3[idx], newStruggles3[idx + 1]] = [newStruggles3[idx + 1], newStruggles3[idx]];
      const updated = await storage.updateProfile(userId, { struggles3: newStruggles3 });
      res.json({ struggles3: (updated?.struggles3 as string[]) || newStruggles3 });
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

  app.get("/api/plan/current", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const plan = await storage.getCurrentWeeklyPlan(userId);
      if (!plan) return res.json(null);

      const days = await storage.getWeeklyPlanDays(plan.id);
      const profile = await storage.getProfile(userId);

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

          if (dietEvaluation.type === "mastered") {
            if (!mastered.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                masteredStruggles: [...mastered, currentStruggleForReflection],
                skippedStruggles: skipped.filter(s => s !== currentStruggleForReflection),
                difficultStruggles: difficult.filter(s => s !== currentStruggleForReflection),
              });
              try { await awardStruggleGraduationCoin(userId, currentStruggleForReflection, today); } catch {}
            }
            dietJustGraduated = true;
          } else if (dietEvaluation.type === "not_relevant") {
            if (!skipped.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                skippedStruggles: [...skipped, currentStruggleForReflection],
              });
            }
            dietJustSkipped = true;
          } else if (dietEvaluation.type === "moved_on") {
            if (!difficult.includes(currentStruggleForReflection)) {
              await storage.updateProfile(userId, {
                difficultStruggles: [...difficult, currentStruggleForReflection],
              });
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
              try { await awardStruggleGraduationCoin(userId, currentStruggleForReflection, today); } catch {}
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
              try { await awardStruggleGraduationCoin(userId, currentStruggleForReflection, today); } catch {}
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

      let repickPending = false;
      let eatOutPickedButNeverScheduled = false;
      if (currentCycle === 1 && !(profileBeforeMastery?.repickPending)) {
        const repickResult = await checkRepickCondition(userId);
        if (repickResult.conditionMet) {
          const latestProfileC1 = await storage.getProfile(userId);
          const skipped1H = (latestProfileC1?.skippedStruggles as string[]) || [];
          const difficult1H = (latestProfileC1?.difficultStruggles as string[]) || [];
          await storage.saveCycleHistory({
            userId,
            cycleNumber: 1,
            startWeek: 1,
            endWeek: latestProfileC1?.currentWeek ?? undefined,
            strugglesPicked: (latestProfileC1?.struggles as string[]) || [],
            mastered: (latestProfileC1?.masteredStruggles as string[]) || [],
            movedOn: [...new Set([...skipped1H, ...difficult1H])],
          });
          await storage.updateProfile(userId, { repickPending: true, currentStruggleCycle: 2, cycle2Active: false });
          repickPending = true;
        }
        eatOutPickedButNeverScheduled = repickResult.eatOutPickedButNeverScheduled;
      } else if (currentCycle === 2 && !(profileBeforeMastery?.repickPending)) {
        const cycle3Result = await checkCycle3RepickCondition(userId);
        if (cycle3Result.conditionMet) {
          const latestProfileC2 = await storage.getProfile(userId);
          const skipped2H = (latestProfileC2?.skippedStruggles2 as string[]) || [];
          const difficult2H = (latestProfileC2?.difficultStruggles2 as string[]) || [];
          const histForC2 = await storage.getCycleHistory(userId);
          const c1Entry = histForC2.find(h => h.cycleNumber === 1);
          const c2StartWeek = c1Entry?.endWeek != null ? (c1Entry.endWeek as number) + 1 : undefined;
          await storage.saveCycleHistory({
            userId,
            cycleNumber: 2,
            startWeek: c2StartWeek,
            endWeek: latestProfileC2?.currentWeek ?? undefined,
            strugglesPicked: (latestProfileC2?.struggles2 as string[]) || [],
            mastered: (latestProfileC2?.masteredStruggles2 as string[]) || [],
            movedOn: [...new Set([...skipped2H, ...difficult2H])],
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
          const skipped3H = (latestProfileForHistory?.skippedStruggles3 || []) as string[];
          const difficult3H = (latestProfileForHistory?.difficultStruggles3 || []) as string[];
          const movedOnH = [...new Set([...skipped3H, ...difficult3H])];
          const histForCN = await storage.getCycleHistory(userId);
          const prevCycleH = histForCN.find(h => h.cycleNumber === currentCycle - 1);
          const cNStartWeek = prevCycleH?.endWeek != null ? (prevCycleH.endWeek as number) + 1 : undefined;
          await storage.saveCycleHistory({
            userId,
            cycleNumber: currentCycle,
            startWeek: cNStartWeek,
            endWeek: profile?.currentWeek ?? undefined,
            strugglesPicked: (latestProfileForHistory?.struggles3 || []) as string[],
            mastered: (latestProfileForHistory?.masteredStruggles3 || []) as string[],
            movedOn: movedOnH,
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

  app.post("/api/plan/weekly", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { negotiationChoice, walkDays, eatOutDays, lateDinnerDays, stretchOnly, selectedTip, standingTapDay, walkDayDurations, clientDate } = req.body;

      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

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
          const mastered1 = (freshProfile?.masteredStruggles || []) as string[];
          const mastered2 = (freshProfile?.masteredStruggles2 || []) as string[];
          const mastered3 = (freshProfile?.masteredStruggles3 || []) as string[];
          const skipped3 = (freshProfile?.skippedStruggles3 || []) as string[];
          const difficult3 = (freshProfile?.difficultStruggles3 || []) as string[];

          if (hasEatOutDays && !struggles3.includes("eat_out") && !mastered3.includes("eat_out") && !skipped3.includes("eat_out") && !difficult3.includes("eat_out")) {
            struggles3 = [...struggles3, "eat_out"];
            profileUpdate.struggles3 = struggles3;
          }

          const isLateDinnerMastered3 = freshProfile?.dinnerMastered === true || mastered3.includes("late_dinner");
          const isS3Valid = (s: string) => STRUGGLE_PRIORITY.includes(s) || s === "late_dinner";
          // Only check mastered3 for struggles3 items — mastered1/mastered2 must not block repicked cycle-3 struggles.
          const isS3Mastered = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered3;
            return mastered3.includes(s);
          };
          // For the global fallback, also exclude mastered1 + mastered2.
          const isS3MasteredFallback = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered3;
            return mastered1.includes(s) || mastered2.includes(s) || mastered3.includes(s);
          };
          const untried3 = struggles3.filter(s => isS3Valid(s) && !isS3Mastered(s) && !skipped3.includes(s) && !difficult3.includes(s));
          const triedNotMastered3 = struggles3.filter(s => isS3Valid(s) && !isS3Mastered(s) && (skipped3.includes(s) || difficult3.includes(s)));
          const fallback3 = STRUGGLE_PRIORITY.find(s => !isS3MasteredFallback(s) && !skipped3.includes(s) && !difficult3.includes(s)) || "sugary_food_drink";
          currentStruggle = [...untried3, ...triedNotMastered3][0] || fallback3;

          isDinnerFocusComputed = currentStruggle === "late_dinner" && !freshProfile?.dinnerMastered;
        } else if (planCycle === 2) {
          if (!freshProfile?.cycle2Active) profileUpdate.cycle2Active = true;
          let struggles2 = (freshProfile?.struggles2 || []) as string[];
          const mastered1 = (freshProfile?.masteredStruggles || []) as string[];
          const mastered2 = (freshProfile?.masteredStruggles2 || []) as string[];
          const skipped2 = (freshProfile?.skippedStruggles2 || []) as string[];
          const difficult2 = (freshProfile?.difficultStruggles2 || []) as string[];

          if (hasEatOutDays && !struggles2.includes("eat_out") && !mastered2.includes("eat_out") && !skipped2.includes("eat_out") && !difficult2.includes("eat_out")) {
            struggles2 = [...struggles2, "eat_out"];
            profileUpdate.struggles2 = struggles2;
          }

          // Bug 2 fix: remove eat_out hasEatOutDays gate from cycle-2 picker.
          // eat_out's position in struggles2 is honoured regardless of this week's eat-out days.
          // Bug 3 fix: allow "late_dinner" through alongside STRUGGLE_PRIORITY items.
          const isLateDinnerMastered = freshProfile?.dinnerMastered === true || mastered2.includes("late_dinner");
          const isS2Valid = (s: string) => STRUGGLE_PRIORITY.includes(s) || s === "late_dinner";
          // Bug 1 fix: only check mastered2 (not mastered1) for struggles2 items —
          // cycle-1 mastery must not block an explicitly repicked cycle-2 struggle.
          const isS2Mastered = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered;
            return mastered2.includes(s);
          };
          // For the global fallback (items outside struggles2), also exclude mastered1
          // so we don't re-introduce things the user fully beat in cycle 1.
          const isS2MasteredFallback = (s: string) => {
            if (s === "late_dinner") return isLateDinnerMastered;
            return mastered1.includes(s) || mastered2.includes(s);
          };
          const untried2 = struggles2.filter(s => isS2Valid(s) && !isS2Mastered(s) && !skipped2.includes(s) && !difficult2.includes(s));
          const triedNotMastered2 = struggles2.filter(s => isS2Valid(s) && !isS2Mastered(s) && (skipped2.includes(s) || difficult2.includes(s)));
          const fallback2 = STRUGGLE_PRIORITY.find(s => !isS2MasteredFallback(s) && !skipped2.includes(s) && !difficult2.includes(s)) || "sugary_food_drink";
          currentStruggle = [...untried2, ...triedNotMastered2][0] || fallback2;

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

      if (effectiveStretchOnly) {
        await storage.updateWeeklyPlan(result.plan.id, { walkDurationGoal: 2, isStretchWeek: true });
        const days = await storage.getWeeklyPlanDays(result.plan.id);
        for (const day of days) {
          if (day.walkScheduled && !day.standingTap) {
            await storage.updateWeeklyPlanDay(day.id, { walkDuration: 2, isStretchDay: true });
          }
        }
        result.plan = { ...result.plan, walkDurationGoal: 2, isStretchWeek: true };
      }

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

      if (profile.currentWeek > 1) {
        const planWeekEventDate = new Date().toISOString().split("T")[0];
        const dinnerCheckData = await getDinnerGraduationData(userId);
        if (!profile.dinnerMastered && !profile.dinnerExitType && dinnerCheckData.dinnerWeeksFound > 0) {
          await processDinnerGraduation(userId, planWeekEventDate);
        }
      }

      res.json({ ...result, eatOutAutoAdded, sugaryAutoAdded, sugaryAlongsideEatOut });
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
          const logDate2 = new Date(date + "T00:00:00");
          const planStart2 = new Date(plan.startDate + "T00:00:00");
          const todayDow2 = Math.round((logDate2.getTime() - planStart2.getTime()) / (1000 * 60 * 60 * 24));
          const achieveTodayPlanDay = achievePlanDays.find(d => d.dayOfWeek === todayDow2);
          let prevWeekPlanDay: any = undefined;
          if (plan.weekNumber > 1) {
            const prevPlan = await storage.getWeeklyPlan(userId, plan.weekNumber - 1);
            if (prevPlan) {
              const prevPlanDays = await storage.getWeeklyPlanDays(prevPlan.id);
              prevWeekPlanDay = prevPlanDays.find(d => d.dayOfWeek === todayDow2);
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

  const DEV_EMAILS = ["yusycyn@gmail.com"];
  const TEST_EMAIL_PATTERN = /^test-.*@glukky\.test$/;
  const devTimeOverrides = new Map<string, number | null>();
  const devDateOverrides = new Map<string, string | null>();
  const devCoinOverrides = new Map<string, number | null>();

  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  const SNAP_LABEL_DAILY_LIMIT = 3;
  const SNAP_ADVICE_DAILY_LIMIT = 6;
  const snapLabelCount = new Map<string, { date: string; count: number }>();
  const snapAdviceCount = new Map<string, { date: string; count: number }>();

  function getDailyCount(map: Map<string, { date: string; count: number }>, userId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    const entry = map.get(userId);
    if (!entry || entry.date !== today) return 0;
    return entry.count;
  }

  function incrementDailyCount(map: Map<string, { date: string; count: number }>, userId: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const entry = map.get(userId);
    if (!entry || entry.date !== today) {
      map.set(userId, { date: today, count: 1 });
    } else {
      entry.count += 1;
    }
  }

  const isDevUser = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await authStorage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (DEV_EMAILS.includes(user.email) || TEST_EMAIL_PATTERN.test(user.email)) {
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
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json({ isDev: !!(user && DEV_EMAILS.includes(user.email)) });
    } catch {
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
        "dinnerMastered", "hasLateDinner", "dinnerSuccessWeeks", "restDay", "dinnerTime"];
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
        "walkDuration", "walksPerWeek", "dinnerMastered", "hasLateDinner", "dinnerSuccessWeeks",
        "restDay", "dinnerTime", "struggles", "currentStruggle", "currentTipIndex",
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

  app.post("/api/snap/label", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (getDailyCount(snapLabelCount, userId) >= SNAP_LABEL_DAILY_LIMIT) {
        return res.status(429).json({ message: `Daily limit of ${SNAP_LABEL_DAILY_LIMIT} photo analyses reached. Try again tomorrow.`, snapsLimit: SNAP_LABEL_DAILY_LIMIT, snapsUsedToday: SNAP_LABEL_DAILY_LIMIT });
      }

      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ message: "imageBase64 and mimeType are required" });
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ message: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." });
      }

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: `You are a food identification assistant. Analyse the food in the photo and return ONLY a valid JSON object with exactly these fields:
{
  "name": "primary food name in English",
  "portion": "estimated portion size (e.g. Medium bowl ~400ml, 1 slice, Small plate)",
  "sauces": "visible sauces or condiments as a short string, or null if none",
  "extras": "additional toppings or sides as a short string, or null if none"
}

Important context: Users are based in Hong Kong. Common foods include: congee, dim sum, rice noodles, wonton noodles, milk tea, pineapple buns, char siu, egg tarts, curry fish balls, roast meats, cha chaan teng dishes, claypot rice, hotpot.

If you cannot identify food in the image, return exactly: {"error":"No food detected"}

Return ONLY the JSON object. No explanation, no markdown, no extra text.`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: imageBase64,
                },
              },
              { type: "text", text: "Identify the food in this image." },
            ],
          },
        ],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(422).json({ message: "Could not parse food identification response." });
      }

      if (parsed.error) {
        return res.status(422).json({ message: parsed.error });
      }

      incrementDailyCount(snapLabelCount, userId);

      res.json({
        name: parsed.name ?? null,
        portion: parsed.portion ?? null,
        sauces: parsed.sauces ?? null,
        extras: parsed.extras ?? null,
        snapsUsedToday: getDailyCount(snapLabelCount, userId),
        snapsLimit: SNAP_LABEL_DAILY_LIMIT,
      });
    } catch (error: any) {
      console.error("Snap label error:", error);
      res.status(500).json({ message: "Food identification failed. Please try again." });
    }
  });

  app.post("/api/snap/advice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (getDailyCount(snapAdviceCount, userId) >= SNAP_ADVICE_DAILY_LIMIT) {
        return res.status(429).json({ message: `Daily limit of ${SNAP_ADVICE_DAILY_LIMIT} advice requests reached. Try again tomorrow.`, adviceLimit: SNAP_ADVICE_DAILY_LIMIT, adviceUsedToday: SNAP_ADVICE_DAILY_LIMIT });
      }

      const { name, portion, sauces, extras } = req.body;
      if (!name) {
        return res.status(400).json({ message: "name is required" });
      }

      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const currentPlanForAdvice = await storage.getCurrentWeeklyPlan(userId);
      const struggle = currentPlanForAdvice?.dietStruggle ?? "sugary_food_drink";
      const lang = profile.preferredLanguage ?? "en";

      const tip = currentPlanForAdvice?.dietTip ?? (DIET_TIP_LADDERS[struggle]?.[0] ?? "Choose lower-GI options where possible");

      const struggleLabel: Record<string, string> = {
        sugary_food_drink: "sugary food & drinks",
        oily_fried_food: "oily / fried food",
        eat_out: "eating out / takeaway",
        portions: "portion control",
        snacks: "snacking",
      };

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
      ]
        .filter(Boolean)
        .join("\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `You are a dietary advisor helping a person manage Type 2 diabetes through blood sugar and sugar control. Your sole focus is glycaemic impact and practical sugar reduction.

Users are based in Hong Kong. You are familiar with local foods: congee, dim sum, rice noodles, wonton noodles, Hong Kong milk tea (with condensed milk), pineapple buns, char siu, egg tarts, curry fish balls, roast meats, cha chaan teng dishes, claypot rice, hotpot, siu mai, har gow, cheung fun, lo mai gai, turnip cake.

Reply in ${langLabel[lang] ?? "English"}.

Important rules:
- All advice must be actionable with THIS meal, right now — not a general reminder for the future.
- If the food is genuinely low-risk and healthy, say so plainly. Do NOT manufacture warnings for healthy food.
- Your advice must not contradict the user's current weekly tip: "${tip}"

Always reply in EXACTLY this format — 3 lines, nothing else:
🩸 Blood sugar impact: [High / Medium / Low]
⚠️ Watch out for: [the single biggest GI or sugar risk right now — 1 concise sentence. If the food is genuinely healthy, say so instead.]
💡 One swap: [one specific change you can make to this meal right now — be concrete. If no swap is needed, say the food is a good choice.]`,
        messages: [
          {
            role: "user",
            content: foodDesc,
          },
        ],
      });

      const advice = response.content[0].type === "text" ? response.content[0].text.trim() : "";

      const tipIndexForPanel = currentPlanForAdvice?.dietTip ? (DIET_TIP_LADDERS[struggle]?.indexOf(currentPlanForAdvice.dietTip) ?? 0) : 0;
      const focusPanelData = computeFocusPanel(struggle, tipIndexForPanel, name, portion, sauces, extras);

      incrementDailyCount(snapAdviceCount, userId);

      res.json({
        advice,
        focusPanelData,
        adviceUsedToday: getDailyCount(snapAdviceCount, userId),
        adviceLimit: SNAP_ADVICE_DAILY_LIMIT,
      });
    } catch (error: any) {
      console.error("Snap advice error:", error);
      res.status(500).json({ message: "Diet advice generation failed. Please try again." });
    }
  });

  app.get("/api/health-info/diet-tips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const allPlans: any[] = [];
      for (let w = 1; w <= (profile.currentWeek || 1); w++) {
        const plan = await storage.getWeeklyPlan(userId, w);
        if (plan) allPlans.push(plan);
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

  return httpServer;
}
