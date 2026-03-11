import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import {
  sortStruggles, getFirstWeekPlan, createWeeklyPlan, getWeeklyReflection,
  generateWeeklyReportData, generateMonthlyReportData, processDietProgression,
  processDinnerGraduation, checkBiWeeklyTriggers, getStretchProgression,
  getWeekStartDate, evaluateDietStruggle,
} from "./engine";
import { DIET_TIP_LADDERS, MITIGATION_TRIO_LABELS } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { walksPerWeek, walkDuration, dinnerTime, sleepPattern, eatingOutFrequency, struggles, notificationEmail } = req.body;

      let sortedStruggles = sortStruggles(struggles || []);
      if (sortedStruggles.length === 0) {
        sortedStruggles = ["sugary_food_drink"];
      }
      const hasLateDinner = dinnerTime === "after_9pm";
      const firstStruggle = !hasLateDinner && sortedStruggles.length > 0 ? sortedStruggles[0] : null;

      const profile = await storage.createProfile({
        userId,
        walksPerWeek: walksPerWeek || 0,
        walkDuration: walkDuration || 10,
        dinnerTime: dinnerTime || "before_9pm",
        sleepPattern: sleepPattern || "regular_10_6",
        eatingOutFrequency: eatingOutFrequency || "0",
        struggles: sortedStruggles,
        currentStruggle: firstStruggle,
        currentTipIndex: 0,
        hasLateDinner,
        dinnerMastered: false,
        dinnerSuccessWeeks: 0,
        onboardingComplete: true,
        notificationEmail: notificationEmail || null,
        restDay: null,
        currentWeek: 1,
      });

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
      }
      const adjustedWalkSuccessPct = adjustedWalkDaysScheduled > 0
        ? Math.round((adjustedWalkDaysCompleted / adjustedWalkDaysScheduled) * 100)
        : 0;

      const weeksOnStruggle = profile ? (profile.currentWeek - 1) - profile.tipCycleStartWeek : 0;
      const weekInCycle = weeksOnStruggle > 0 ? Math.min(weeksOnStruggle, 3) : 0;

      const dietEvaluation = await evaluateDietStruggle(userId);

      res.json({
        ...reflection,
        walkDaysScheduled: adjustedWalkDaysScheduled,
        walkDaysCompleted: adjustedWalkDaysCompleted,
        walkSuccessPct: adjustedWalkSuccessPct,
        stretchAdjustedDays,
        walkingBridge: biWeekly.walkingBridge,
        autoEscalation: biWeekly.autoEscalation && (profile?.stretchSuccessWeeks || 0) >= 2,
        isStretchMode: profile?.isStretchMode || false,
        stretchProgression,
        weekInCycle,
        tipStayCycles: profile?.tipStayCycles || 0,
        dietEvaluation,
      });
    } catch (error) {
      console.error("Error fetching reflection:", error);
      res.status(500).json({ message: "Failed to fetch reflection" });
    }
  });

  app.post("/api/plan/weekly", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { negotiationChoice, walkDays, eatOutDays, lateDinnerDays, stretchOnly, selectedTip, standingTapDay, walkDayDurations } = req.body;

      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const existingPlan = await storage.getWeeklyPlan(userId, profile.currentWeek);
      if (existingPlan) {
        return res.status(409).json({ message: "You've already planned this week" });
      }

      if (!Array.isArray(walkDays) || walkDays.length > 7) {
        return res.status(400).json({ message: "Invalid walk days" });
      }
      const validChoices = ["keep_current", "add_day", "add_minutes", "standing_reset", "set_rest_day", "standing_tap"];
      if (negotiationChoice && !validChoices.includes(negotiationChoice)) {
        return res.status(400).json({ message: "Invalid negotiation choice" });
      }

      let dietEvaluation: { type: string; nextStruggle?: string } = { type: "in_cycle" };

      if (profile.currentWeek > 1) {
        if (profile.hasLateDinner && !profile.dinnerMastered) {
          await processDinnerGraduation(userId);
        } else if (profile.currentStruggle) {
          dietEvaluation = await evaluateDietStruggle(userId);

          if (dietEvaluation.type === "mastered") {
            await storage.updateProfile(userId, {
              currentStruggle: dietEvaluation.nextStruggle || null,
              currentTipIndex: 0,
              tipCycleStartWeek: profile.currentWeek - 1,
              tipStayCycles: 0,
            });
          } else if (dietEvaluation.type === "skipped" || dietEvaluation.type === "moved_on") {
            const struggles = [...(profile.struggles || [])] as string[];
            const currentIdx = struggles.indexOf(profile.currentStruggle);
            if (currentIdx >= 0) {
              struggles.splice(currentIdx, 1);
              struggles.push(profile.currentStruggle);
            }
            const nextStruggle = dietEvaluation.nextStruggle || profile.currentStruggle;
            await storage.updateProfile(userId, {
              struggles,
              currentStruggle: nextStruggle,
              currentTipIndex: 0,
              tipCycleStartWeek: profile.currentWeek - 1,
              tipStayCycles: 0,
            });
          } else if (dietEvaluation.type === "stay") {
            await storage.updateProfile(userId, {
              tipCycleStartWeek: profile.currentWeek - 1,
              tipStayCycles: profile.tipStayCycles + 1,
            });
          }
        }

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
          if (biWeekly.autoEscalation && profile.isStretchMode && updatedStretchSuccessWeeks >= 2 && negotiationChoice === "add_minutes") {
            await storage.updateProfile(userId, { isStretchMode: false, walkDuration: 10, stretchSuccessWeeks: 0 });
          }
        }
      }

      const freshProfileForStretch = await storage.getProfile(userId);
      const effectiveStretchOnly = stretchOnly || freshProfileForStretch?.isStretchMode;

      const result = await createWeeklyPlan({
        userId,
        negotiationChoice: negotiationChoice || "keep_current",
        walkDays: walkDays || [],
        eatOutDays: eatOutDays || [],
        lateDinnerDays: lateDinnerDays || [],
        standingTapDay: standingTapDay !== undefined ? standingTapDay : undefined,
        walkDayDurations: walkDayDurations || undefined,
        isStretchMode: !!effectiveStretchOnly,
      });

      {
        const freshProfile = await storage.getProfile(userId);
        const actualDinnerFocus = (lateDinnerDays || []).length > 0 && !freshProfile?.dinnerMastered;
        const planUpdate: any = { isDinnerFocus: actualDinnerFocus };
        const profileUpdate: any = {};

        if (actualDinnerFocus) {
          planUpdate.dietStruggle = null;
          planUpdate.dietTip = null;
        } else {
          const struggles = freshProfile?.struggles || [];
          if (freshProfile?.currentStruggle) {
            planUpdate.dietStruggle = freshProfile.currentStruggle;
            const ladder = DIET_TIP_LADDERS[freshProfile.currentStruggle] || [];
            if (selectedTip && ladder.includes(selectedTip)) {
              planUpdate.dietTip = selectedTip;
              const tipIdx = ladder.indexOf(selectedTip);
              if (tipIdx >= 0) {
                profileUpdate.currentTipIndex = tipIdx;
              }
            } else {
              planUpdate.dietTip = ladder.length > 0 ? ladder[Math.min(freshProfile.currentTipIndex, ladder.length - 1)] : null;
            }
          } else if (struggles.length > 0) {
            const sorted = sortStruggles(struggles as string[]);
            const firstStruggle = sorted[0];
            profileUpdate.currentStruggle = firstStruggle;
            profileUpdate.currentTipIndex = 0;
            profileUpdate.tipCycleStartWeek = (freshProfile?.currentWeek || 1) - 1;
            profileUpdate.tipStayCycles = 0;
            const ladder = DIET_TIP_LADDERS[firstStruggle];
            planUpdate.dietStruggle = firstStruggle;
            if (selectedTip && ladder?.includes(selectedTip)) {
              planUpdate.dietTip = selectedTip;
              profileUpdate.currentTipIndex = ladder.indexOf(selectedTip);
            } else {
              planUpdate.dietTip = ladder && ladder.length > 0 ? ladder[0] : null;
            }
          } else {
            profileUpdate.struggles = ["sugary_food_drink"];
            profileUpdate.currentStruggle = "sugary_food_drink";
            profileUpdate.currentTipIndex = 0;
            profileUpdate.tipCycleStartWeek = (freshProfile?.currentWeek || 1) - 1;
            profileUpdate.tipStayCycles = 0;
            const ladder = DIET_TIP_LADDERS["sugary_food_drink"];
            planUpdate.dietStruggle = "sugary_food_drink";
            planUpdate.dietTip = ladder && ladder.length > 0 ? ladder[0] : null;
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
        const dateOverride = devDateOverrides.get(userId);
        const effectiveDate = dateOverride ? new Date(dateOverride + "T00:00:00") : new Date();
        effectiveDate.setHours(0, 0, 0, 0);
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

      res.json({ ...result, dietEvaluation });
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

      res.json({ ...result, nextDayAdjustment });
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

      const currentTip = profile.currentStruggle && DIET_TIP_LADDERS[profile.currentStruggle]
        ? DIET_TIP_LADDERS[profile.currentStruggle][profile.currentTipIndex] || null
        : null;

      res.json({
        currentStruggle: profile.currentStruggle,
        currentTip,
        isDinnerFocus: profile.hasLateDinner && !profile.dinnerMastered,
        dinnerMastered: profile.dinnerMastered,
        walkSuccessAvg,
        dinnerSuccessAvg,
        dietTipAttempts,
        dietTipCompletionCount,
        struggles: profile.struggles,
        currentTipIndex: profile.currentTipIndex,
        tipLadders: DIET_TIP_LADDERS,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roadmap" });
    }
  });

  const DEV_EMAILS = ["yusycyn@gmail.com"];
  const devTimeOverrides = new Map<string, number | null>();
  const devDateOverrides = new Map<string, string | null>();

  const isDevUser = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await authStorage.getUser(userId);
    if (!user || !DEV_EMAILS.includes(user.email)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

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
      const allowed = ["currentStruggle", "currentTipIndex", "walkDuration", "walksPerWeek",
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

  return httpServer;
}
