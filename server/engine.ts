import { storage } from "./storage";
import {
  STRUGGLE_PRIORITY, DIET_TIP_LADDERS, MITIGATION_TRIO_LABELS,
  type UserProfile, type WeeklyPlan, type WeeklyPlanDay, type DailyLog,
} from "@shared/schema";

export interface LastWeekDaySchedule {
  dayOfWeek: number;
  walkScheduled: boolean;
  eatOutScheduled: boolean;
  lateDinnerScheduled: boolean;
  dinnerLabel: string;
  standingTap: boolean;
  walkDuration: number;
}

export interface WeeklyReflection {
  weekNumber: number;
  walkDaysScheduled: number;
  walkDaysCompleted: number;
  walkSuccessPct: number;
  walkDuration: number;
  dinnerDaysTracked: number;
  dinnerDaysSuccessful: number;
  dinnerSuccessPct: number | null;
  dinnerEarlyCount: number;
  dinnerEarlyTotal: number;
  dinnerTacticCount: number;
  dinnerTacticTotal: number;
  dietTip: string | null;
  dietStruggle: string | null;
  dietNoCount: number;
  dietYesCount: number;
  dietNoChanceCount: number;
  dietCleanWeek: boolean;
  isDinnerFocus: boolean;
  fatigueDetected: { dayOfWeek: number; count: number } | null;
  suggestedActions: SuggestedAction[];
  lastWeekSchedule: LastWeekDaySchedule[];
  standingTapDaysScheduled: number;
  standingTapDaysCompleted: number;
}

export interface SuggestedAction {
  type: "add_day" | "add_minutes" | "keep_current" | "set_rest_day" | "standing_tap";
  labelKey: string;
  descKey: string;
  descParams?: Record<string, string | number>;
}

export function getWeekStartDate(weekNumber: number, baseDate?: Date): string {
  const base = baseDate || new Date();
  const dayOfWeek = base.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(base);
  thisMonday.setDate(base.getDate() + mondayOffset);
  const weekOffset = (weekNumber - 1) * 7;
  const startDate = new Date(thisMonday);
  startDate.setDate(thisMonday.getDate() + weekOffset);
  return startDate.toISOString().split("T")[0];
}

export function getCurrentWeekNumber(profile: UserProfile): number {
  return profile.currentWeek;
}

export async function getWeeklyReflection(userId: string): Promise<WeeklyReflection | null> {
  const profile = await storage.getProfile(userId);
  if (!profile) return null;

  const lastWeek = profile.currentWeek - 1;
  if (lastWeek < 1) return null;

  const plan = await storage.getWeeklyPlan(userId, lastWeek);
  if (!plan) return null;

  const planDays = await storage.getWeeklyPlanDays(plan.id);
  const logs = await storage.getDailyLogsByWeek(userId, lastWeek, plan.startDate);

  const walkDaysScheduled = planDays.filter(d => d.walkScheduled && !d.standingTap).length;
  const walkDaysCompleted = planDays.filter(d => {
    if (!d.walkScheduled || d.standingTap) return false;
    const dayDate = new Date(plan.startDate);
    dayDate.setDate(dayDate.getDate() + d.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    return log?.walkCompleted === true;
  }).length;
  const walkSuccessPct = walkDaysScheduled > 0 ? Math.round((walkDaysCompleted / walkDaysScheduled) * 100) : 0;

  const standingTapDays = planDays.filter(d => d.standingTap);
  const standingTapDaysScheduled = standingTapDays.length;
  const standingTapDaysCompleted = standingTapDays.filter(d => {
    const dayDate = new Date(plan.startDate);
    dayDate.setDate(dayDate.getDate() + d.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    return log?.walkCompleted === true;
  }).length;

  const dinnerDays = planDays.filter(d => d.dinnerLabel !== "none");
  const dinnerDaysTracked = dinnerDays.length;
  let dinnerDaysSuccessful = 0;
  if (dinnerDaysTracked > 0) {
    dinnerDaysSuccessful = logs.filter(l => l.dinnerSuccess === true).length;
  }
  const dinnerSuccessPct = dinnerDaysTracked > 0 ? Math.round((dinnerDaysSuccessful / dinnerDaysTracked) * 100) : null;

  const earlyDays = planDays.filter(d => d.dinnerLabel === "move_early");
  const tacticDays = planDays.filter(d => d.dinnerLabel !== "none" && d.dinnerLabel !== "move_early");
  let dinnerEarlyCount = 0;
  let dinnerTacticCount = 0;
  for (const day of earlyDays) {
    const dayDate = new Date(plan.startDate);
    dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    if (log?.dinnerSuccess === true) dinnerEarlyCount++;
  }
  for (const day of tacticDays) {
    const dayDate = new Date(plan.startDate);
    dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    if (log?.dinnerSuccess === true) dinnerTacticCount++;
  }

  let dietNoCount = 0;
  let dietYesCount = 0;
  let dietNoChanceCount = 0;
  for (const log of logs) {
    if (log.dietResponse === "yes") dietYesCount++;
    else if (log.dietResponse === "no") dietNoCount++;
    else if (log.dietResponse === "no_chance") dietNoChanceCount++;
  }
  const dietCleanWeek = dietNoCount === 0 && (dietYesCount + dietNoChanceCount) > 0;
  const dietDaysTotal = planDays.length;

  const missedCheckInDays = planDays.filter(d => {
    if (!d.walkScheduled && !d.lateDinnerScheduled) return false;
    const dayDate = new Date(plan.startDate + "T00:00:00");
    dayDate.setDate(dayDate.getDate() + d.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    if (!log) return true;
    if (d.walkScheduled && (log.walkCompleted === null || log.walkCompleted === undefined)) return true;
    return false;
  }).length;

  const fatigueDetected = await checkFatiguePattern(userId, profile.currentWeek);

  const walkDayDurationsForActions = planDays.filter(d => d.walkScheduled && !d.standingTap).map(d => d.walkDuration);
  const maxDurationForActions = walkDayDurationsForActions.length > 0 ? Math.max(...walkDayDurationsForActions) : plan.walkDurationGoal;
  const suggestedActions = buildSuggestedActions(profile, walkDaysScheduled, maxDurationForActions, fatigueDetected);

  const lastWeekSchedule: LastWeekDaySchedule[] = planDays.map(d => ({
    dayOfWeek: d.dayOfWeek,
    walkScheduled: d.walkScheduled,
    eatOutScheduled: d.eatOutScheduled,
    lateDinnerScheduled: d.lateDinnerScheduled,
    dinnerLabel: d.dinnerLabel,
    standingTap: d.standingTap,
    walkDuration: d.walkDuration,
  }));

  const walkDayDurations = planDays.filter(d => d.walkScheduled && !d.standingTap).map(d => d.walkDuration);
  const maxWalkDuration = walkDayDurations.length > 0 ? Math.max(...walkDayDurations) : plan.walkDurationGoal;

  return {
    weekNumber: lastWeek,
    walkDaysScheduled,
    walkDaysCompleted,
    walkSuccessPct,
    walkDuration: maxWalkDuration,
    dinnerDaysTracked,
    dinnerDaysSuccessful,
    dinnerSuccessPct,
    dinnerEarlyCount,
    dinnerEarlyTotal: earlyDays.length,
    dinnerTacticCount,
    dinnerTacticTotal: tacticDays.length,
    dietTip: plan.dietTip,
    dietStruggle: plan.dietStruggle,
    dietNoCount,
    dietYesCount,
    dietNoChanceCount,
    dietCleanWeek,
    dietDaysTotal,
    missedCheckInDays,
    isDinnerFocus: plan.isDinnerFocus,
    fatigueDetected,
    suggestedActions,
    lastWeekSchedule,
    standingTapDaysScheduled,
    standingTapDaysCompleted,
  };
}

function buildSuggestedActions(
  profile: UserProfile,
  currentWalkDays: number,
  currentDuration: number,
  fatigueDetected: { dayOfWeek: number; count: number } | null,
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  actions.push({
    type: "keep_current",
    labelKey: "negotiation.option.keep_current",
    descKey: "negotiation.option.keep_current_desc",
    descParams: { days: currentWalkDays, duration: currentDuration },
  });

  if (currentWalkDays < 5) {
    actions.push({
      type: "add_day",
      labelKey: "negotiation.option.add_walk_day",
      descKey: "negotiation.option.add_walk_day_desc",
      descParams: { from: currentWalkDays, to: currentWalkDays + 1 },
    });
  }

  if (currentDuration < 20) {
    actions.push({
      type: "add_minutes",
      labelKey: "negotiation.option.add_minutes",
      descKey: "negotiation.option.add_minutes_desc",
      descParams: { from: currentDuration, to: currentDuration + 5 },
    });
  }

  if (fatigueDetected) {
    const dowKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    actions.push({
      type: "set_rest_day",
      labelKey: "negotiation.option.set_rest_day",
      descKey: "negotiation.option.set_rest_day_desc",
      descParams: { dow: fatigueDetected.dayOfWeek, dayKey: `negotiation.day.${dowKeys[fatigueDetected.dayOfWeek]}` },
    });
  }

  return actions;
}

async function checkFatiguePattern(userId: string, currentWeek: number): Promise<{ dayOfWeek: number; count: number } | null> {
  if (currentWeek < 4) return null;

  const plans: WeeklyPlan[] = [];
  const allLogs: DailyLog[] = [];

  for (let w = currentWeek - 3; w < currentWeek; w++) {
    const plan = await storage.getWeeklyPlan(userId, w);
    if (plan) {
      plans.push(plan);
      const logs = await storage.getDailyLogsByWeek(userId, w, plan.startDate);
      allLogs.push(...logs);
    }
  }

  const tiredByDay: Record<number, number> = {};
  for (const log of allLogs) {
    if (log.walkTired) {
      const d = new Date(log.date);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      tiredByDay[dow] = (tiredByDay[dow] || 0) + 1;
    }
  }

  for (const [day, count] of Object.entries(tiredByDay)) {
    if (count >= 3) {
      return { dayOfWeek: parseInt(day), count };
    }
  }

  return null;
}

export interface CreatePlanInput {
  userId: string;
  negotiationChoice: "keep_current" | "add_day" | "add_minutes" | "set_rest_day" | "standing_tap";
  walkDays: number[];
  eatOutDays: number[];
  lateDinnerDays: number[];
  standingTapDay?: number;
  walkDayDurations?: Record<string, number>;
  baseDate?: Date;
}

export async function createWeeklyPlan(input: CreatePlanInput & { isStretchMode?: boolean }): Promise<{ plan: WeeklyPlan; days: WeeklyPlanDay[] }> {
  const profile = await storage.getProfile(input.userId);
  if (!profile) throw new Error("Profile not found");

  const weekNumber = profile.currentWeek;
  const startDate = getWeekStartDate(weekNumber, input.baseDate);

  let walkDuration = profile.walkDuration;
  let walkFrequency = input.walkDays.length;

  const biWeeklyTriggers = await checkBiWeeklyTriggers(input.userId);
  const autoEscalatedFromStretch = biWeeklyTriggers.autoEscalation && profile.isStretchMode;
  if (autoEscalatedFromStretch) {
    walkDuration = 10;
  }

  if (!autoEscalatedFromStretch && input.negotiationChoice === "add_minutes" && !input.walkDayDurations) {
    walkDuration = Math.min(walkDuration + 5, 20);
  }

  if (input.negotiationChoice === "set_rest_day") {
    const restDayIdx = input.walkDays.length > 0 ? undefined : undefined;
    await storage.updateProfile(input.userId, { restDay: input.walkDays[0] });
  }

  const isDinnerFocus = profile.hasLateDinner && !profile.dinnerMastered;
  let dietStruggle: string | null = null;
  let dietTip: string | null = null;
  // dietStruggle and dietTip are computed and set by routes.ts after plan creation

  const dayEntries: any[] = [];
  for (let d = 0; d < 7; d++) {
    const walkScheduled = input.walkDays.includes(d);
    const eatOutScheduled = input.eatOutDays.includes(d);
    const lateDinnerScheduled = input.lateDinnerDays.includes(d);
    const isStandingTapDay = input.standingTapDay === d;

    let dayDuration = 0;
    if (walkScheduled) {
      if (input.walkDayDurations && input.walkDayDurations[String(d)] !== undefined) {
        dayDuration = input.walkDayDurations[String(d)];
      } else {
        dayDuration = walkDuration;
      }
    } else if (isStandingTapDay) {
      dayDuration = 1;
    }

    const effectiveWalkScheduled = walkScheduled || isStandingTapDay;
    dayEntries.push({
      dayOfWeek: d,
      walkScheduled: effectiveWalkScheduled,
      eatOutScheduled,
      lateDinnerScheduled,
      dinnerLabel: "none" as const,
      walkDuration: dayDuration,
      isStretchDay: input.isStretchMode && effectiveWalkScheduled && !isStandingTapDay,
      standingTap: isStandingTapDay,
    });
  }

  const walkDayDurationsForGoal = dayEntries.filter(d => d.walkScheduled && !d.standingTap && d.walkDuration > 0).map(d => d.walkDuration);
  const walkDayMaxDuration = walkDayDurationsForGoal.length > 0 ? Math.max(...walkDayDurationsForGoal) : walkDuration;

  const plan = await storage.createWeeklyPlan({
    userId: input.userId,
    weekNumber,
    startDate,
    walkFrequencyGoal: walkFrequency,
    walkDurationGoal: walkDayMaxDuration,
    dietStruggle,
    dietTip,
    isDinnerFocus,
    isStretchWeek: !!input.isStretchMode,
  });

  for (const entry of dayEntries) {
    entry.weeklyPlanId = plan.id;
  }

  const days = await storage.createWeeklyPlanDays(dayEntries);

  await storage.updateProfile(input.userId, {
    walkDuration: walkDayMaxDuration,
  });

  return { plan, days };
}

export async function evaluateDietStruggle(userId: string, struggle: string): Promise<{
  type: string;
  struggle: string;
  yesDays?: number;
  noChanceDays?: number;
  activeDays?: number;
  bestTip?: string;
  bestTipYes?: number;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile) return { type: "in_cycle", struggle };

  const week1Plan = await storage.getWeeklyPlan(userId, 1);
  const isPartialFirstWeek = !!(week1Plan && week1Plan.firstActiveDay > 0);

  const activePlans: { weekNumber: number; plan: WeeklyPlan }[] = [];
  for (let w = 1; w <= profile.currentWeek - 1; w++) {
    const wp = await storage.getWeeklyPlan(userId, w);
    if (wp && wp.dietStruggle === struggle) {
      if (isPartialFirstWeek && w === 1) continue;
      activePlans.push({ weekNumber: w, plan: wp });
    }
  }

  const seenStartDates = new Set<string>();
  const uniqueActivePlans = activePlans.filter(({ plan }) => {
    if (seenStartDates.has(plan.startDate)) return false;
    seenStartDates.add(plan.startDate);
    return true;
  });

  const activeDays = uniqueActivePlans.length * 7;
  if (activeDays === 0) return { type: "in_cycle", struggle, activeDays: 0 };

  let yesDays = 0;
  let noChanceDays = 0;
  const tipYesCounts: Record<string, number> = {};

  for (const { weekNumber: wn, plan: wp } of uniqueActivePlans) {
    const startDate = typeof wp.startDate === "string" ? wp.startDate : (wp.startDate as any).toISOString().split("T")[0];
    const logs = await storage.getDailyLogsByWeek(userId, wn, startDate);
    for (const log of logs) {
      if (log.dietResponse === "yes") yesDays++;
      else if (log.dietResponse === "no_chance") noChanceDays++;
    }
    if (wp.dietTip) {
      const yesCount = logs.filter(l => l.dietResponse === "yes").length;
      tipYesCounts[wp.dietTip] = (tipYesCounts[wp.dietTip] || 0) + yesCount;
    }
  }

  let bestTip: string | undefined;
  let bestTipYes = 0;
  for (const [tip, count] of Object.entries(tipYesCounts)) {
    if (count > bestTipYes) { bestTip = tip; bestTipYes = count; }
  }

  if (activeDays >= 42) {
    if (yesDays >= 32) return { type: "mastered", struggle, yesDays, noChanceDays, activeDays, bestTip, bestTipYes };
    return { type: "moved_on", struggle, yesDays, noChanceDays, activeDays, bestTip, bestTipYes };
  }
  if (activeDays >= 35) {
    if (yesDays >= 27) return { type: "mastered", struggle, yesDays, noChanceDays, activeDays, bestTip, bestTipYes };
    return { type: "in_cycle", struggle, yesDays, noChanceDays, activeDays };
  }
  if (activeDays >= 28) {
    if (yesDays >= 22) return { type: "mastered", struggle, yesDays, noChanceDays, activeDays, bestTip, bestTipYes };
    return { type: "in_cycle", struggle, yesDays, noChanceDays, activeDays };
  }
  if (activeDays === 21) {
    if (yesDays >= 16) return { type: "mastered", struggle, yesDays, noChanceDays, activeDays, bestTip, bestTipYes };
    if (noChanceDays >= 16) return { type: "not_relevant", struggle, yesDays, noChanceDays, activeDays, bestTip, bestTipYes };
  }
  return { type: "in_cycle", struggle, yesDays, noChanceDays, activeDays };
}

export async function getDinnerGraduationData(userId: string): Promise<{
  ready: boolean;
  successPct: number;
  totalDays: number;
  totalSuccess: number;
  weeksFound: number;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.dinnerMastered) {
    return { ready: false, successPct: 0, totalDays: 0, totalSuccess: 0, weeksFound: 0 };
  }

  const dinnerWeeks: { weekNumber: number; plan: any }[] = [];
  for (let w = 1; w <= profile.currentWeek - 1; w++) {
    const wp = await storage.getWeeklyPlan(userId, w);
    if (!wp) continue;
    const days = await storage.getWeeklyPlanDays(wp.id);
    const hasDinnerDays = days.some(d => d.dinnerLabel !== "none");
    if (hasDinnerDays) {
      dinnerWeeks.push({ weekNumber: w, plan: wp });
    }
  }

  if (dinnerWeeks.length < 3) {
    return { ready: false, successPct: 0, totalDays: 0, totalSuccess: 0, weeksFound: dinnerWeeks.length };
  }

  const evalWeeks = dinnerWeeks.slice(-3);
  let totalDays = 0;
  let totalSuccess = 0;

  for (const { weekNumber: wn, plan: wp } of evalWeeks) {
    const days = await storage.getWeeklyPlanDays(wp.id);
    const dinnerDays = days.filter(d => d.dinnerLabel !== "none");
    totalDays += dinnerDays.length;

    const logs = await storage.getDailyLogsByWeek(userId, wn, wp.startDate);
    for (const dd of dinnerDays) {
      const dayDate = new Date(wp.startDate + "T00:00:00");
      dayDate.setDate(dayDate.getDate() + dd.dayOfWeek);
      const dateStr = dayDate.toISOString().split("T")[0];
      const log = logs.find(l => l.date === dateStr);
      if (log?.dinnerSuccess === true) totalSuccess++;
    }
  }

  const successPct = totalDays > 0 ? Math.round((totalSuccess / totalDays) * 100) : 0;

  return { ready: true, successPct, totalDays, totalSuccess, weeksFound: dinnerWeeks.length };
}

export async function processDinnerGraduation(userId: string): Promise<{ graduated: boolean; successPct: number }> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.dinnerMastered) {
    return { graduated: false, successPct: 0 };
  }

  const gradData = await getDinnerGraduationData(userId);
  if (!gradData.ready) {
    return { graduated: false, successPct: gradData.successPct };
  }

  if (gradData.successPct >= 80) {
    await storage.updateProfile(userId, {
      dinnerMastered: true,
    });
    return { graduated: true, successPct: gradData.successPct };
  }

  return { graduated: false, successPct: gradData.successPct };
}

export async function checkBiWeeklyTriggers(userId: string): Promise<{
  walkingBridge: boolean;
  autoEscalation: boolean;
  stagnationPivot: boolean;
  consecutiveStretchWeeks: number;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.currentWeek < 3) {
    return { walkingBridge: false, autoEscalation: false, stagnationPivot: false, consecutiveStretchWeeks: 0 };
  }

  const result = { walkingBridge: false, autoEscalation: false, stagnationPivot: false, consecutiveStretchWeeks: 0 };
  const allRecentPlans = await storage.getRecentWeeklyPlans(userId, 20);
  const recentPlans = allRecentPlans.slice(0, 2);
  if (recentPlans.length < 2) return result;

  let totalWalks = 0;
  let totalStretchDays = 0;
  let stretchDaysCompleted = 0;

  for (const plan of recentPlans) {
    const logs = await storage.getDailyLogsByWeek(userId, plan.weekNumber, plan.startDate);
    const planDays = await storage.getWeeklyPlanDays(plan.id);

    const fatigueStretchDows = new Set<number>();
    if (!plan.isStretchWeek) {
      for (const day of planDays) {
        if (day.isStretchDay) {
          fatigueStretchDows.add(day.dayOfWeek);
        }
      }
    }

    for (const log of logs) {
      if (log.walkCompleted === true) {
        const logDate = new Date(log.date + "T00:00:00");
        const planStart = new Date(plan.startDate + "T00:00:00");
        const dow = Math.round((logDate.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
        if (!fatigueStretchDows.has(dow)) {
          totalWalks++;
        }
      }
    }

    for (const day of planDays) {
      if (plan.isStretchWeek && day.isStretchDay) {
        totalStretchDays++;
        const dayDate = new Date(plan.startDate);
        dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
        const dateStr = dayDate.toISOString().split("T")[0];
        const log = logs.find(l => l.date === dateStr);
        if (log?.walkCompleted) stretchDaysCompleted++;
      }
    }
  }

  if (totalWalks === 0) {
    result.walkingBridge = true;
  }

  if (totalStretchDays > 0 && stretchDaysCompleted === totalStretchDays) {
    result.autoEscalation = true;
  }

  let consecutiveCount = 0;
  for (const plan of allRecentPlans) {
    if (!plan.isStretchWeek) break;
    const planDays = await storage.getWeeklyPlanDays(plan.id);
    const stretchDays = planDays.filter(d => d.isStretchDay);
    if (stretchDays.length === 0) break;
    const logs = await storage.getDailyLogsByWeek(userId, plan.weekNumber, plan.startDate);
    let allCompleted = true;
    for (const day of stretchDays) {
      const dayDate = new Date(plan.startDate + "T00:00:00");
      dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
      const dateStr = dayDate.toISOString().split("T")[0];
      const log = logs.find(l => l.date === dateStr);
      if (log?.walkCompleted !== true) { allCompleted = false; break; }
    }
    if (!allCompleted) break;
    consecutiveCount++;
  }
  result.consecutiveStretchWeeks = consecutiveCount;

  return result;
}

export async function generateWeeklyReportData(userId: string, weekNumber: number) {
  const plan = await storage.getWeeklyPlan(userId, weekNumber);
  if (!plan) return null;

  const planDays = await storage.getWeeklyPlanDays(plan.id);
  const logs = await storage.getDailyLogsByWeek(userId, weekNumber, plan.startDate);

  const walkDaysScheduled = planDays.filter(d => d.walkScheduled && !d.standingTap).length;
  const walkDaysCompleted = planDays.filter(d => {
    if (!d.walkScheduled || d.standingTap) return false;
    const dayDate = new Date(plan.startDate);
    dayDate.setDate(dayDate.getDate() + d.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    return log?.walkCompleted === true;
  }).length;
  const walkPct = walkDaysScheduled > 0 ? Math.round((walkDaysCompleted / walkDaysScheduled) * 100) : 0;

  const dinnerDays = planDays.filter(d => d.dinnerLabel !== "none");
  const dinnerSuccessful = logs.filter(l => l.dinnerSuccess === true).length;
  const dinnerPct = dinnerDays.length > 0 ? Math.round((dinnerSuccessful / dinnerDays.length) * 100) : null;

  let dietPct: number | null = null;
  if (plan.dietTip) {
    const dietResponses = logs.filter(l => l.dietResponse !== null);
    const dietSuccess = dietResponses.filter(l => l.dietResponse === "yes" || l.dietResponse === "no_chance").length;
    dietPct = dietResponses.length > 0 ? Math.round((dietSuccess / dietResponses.length) * 100) : null;
  }

  const totalTracked = walkDaysScheduled + dinnerDays.length + (plan.dietTip ? 7 : 0);
  const totalSuccess = walkDaysCompleted + dinnerSuccessful + (dietPct !== null ? logs.filter(l => l.dietResponse === "yes" || l.dietResponse === "no_chance").length : 0);
  const weightedAvg = totalTracked > 0 ? Math.round((totalSuccess / totalTracked) * 100) : 0;

  return {
    weekNumber,
    walkSuccessPct: walkPct,
    walkDaysCompleted,
    walkDaysScheduled,
    dinnerSuccessPct: dinnerPct,
    dietSuccessPct: dietPct,
    weightedAvg,
    totalSuccess,
    totalTracked,
    plan,
    planDays,
    logs,
  };
}

export async function generateMonthlyReportData(userId: string) {
  const profile = await storage.getProfile(userId);
  if (!profile) return null;

  const currentWeek = profile.currentWeek;
  const weeksToAnalyze = Math.min(currentWeek - 1, 4);
  if (weeksToAnalyze < 1) return null;

  let totalMinutes = 0;
  const tipPerformance: Record<string, { yes: number; no: number; noChance: number }> = {};
  const struggleStatus: Record<string, { tips: string[]; completed: boolean }> = {};

  for (let w = currentWeek - weeksToAnalyze; w < currentWeek; w++) {
    const plan = await storage.getWeeklyPlan(userId, w);
    if (!plan) continue;

    const planDays = await storage.getWeeklyPlanDays(plan.id);
    const logs = await storage.getDailyLogsByWeek(userId, w, plan.startDate);

    for (const log of logs) {
      if (log.walkCompleted) {
        const day = planDays.find(d => {
          const logDate = new Date(log.date);
          const dow = logDate.getDay() === 0 ? 6 : logDate.getDay() - 1;
          return d.dayOfWeek === dow;
        });
        if (day) totalMinutes += day.walkDuration;
      }
    }

    if (plan.dietTip) {
      if (!tipPerformance[plan.dietTip]) {
        tipPerformance[plan.dietTip] = { yes: 0, no: 0, noChance: 0 };
      }
      for (const log of logs) {
        if (log.dietResponse === "yes") tipPerformance[plan.dietTip].yes++;
        else if (log.dietResponse === "no") tipPerformance[plan.dietTip].no++;
        else if (log.dietResponse === "no_chance") tipPerformance[plan.dietTip].noChance++;
      }
    }

    if (plan.dietStruggle) {
      if (!struggleStatus[plan.dietStruggle]) {
        const ladder = DIET_TIP_LADDERS[plan.dietStruggle] || [];
        struggleStatus[plan.dietStruggle] = { tips: ladder, completed: false };
      }
    }
  }

  const mastered = (profile.masteredStruggles || []) as string[];
  for (const s of mastered) {
    if (struggleStatus[s]) struggleStatus[s].completed = true;
  }

  return {
    totalMinutes,
    tipPerformance,
    struggleStatus,
    weeksAnalyzed: weeksToAnalyze,
  };
}

export async function getStretchProgression(userId: string): Promise<{
  allCompleted: boolean;
  lastWeekStretchCount: number;
} | null> {
  const profile = await storage.getProfile(userId);
  if (!profile) return null;

  const lastWeek = profile.currentWeek - 1;
  if (lastWeek < 1) return null;

  const plan = await storage.getWeeklyPlan(userId, lastWeek);
  if (!plan) return null;

  const planDays = await storage.getWeeklyPlanDays(plan.id);
  const stretchDays = planDays.filter(d => d.walkScheduled && d.isStretchDay);
  if (stretchDays.length === 0) return null;

  const logs = await storage.getDailyLogsByWeek(userId, lastWeek, plan.startDate);
  let completedCount = 0;
  for (const day of stretchDays) {
    const dayDate = new Date(plan.startDate);
    dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    if (log?.walkCompleted) completedCount++;
  }

  return {
    allCompleted: completedCount === stretchDays.length,
    lastWeekStretchCount: stretchDays.length,
  };
}

export function sortStruggles(selected: string[]): string[] {
  return STRUGGLE_PRIORITY.filter(s => selected.includes(s));
}

export function getFirstWeekPlan(profile: {
  walksPerWeek: number;
  walkDuration: number;
  hasLateDinner: boolean;
  struggles: string[];
}): { walkFrequency: number; walkDuration: number; isDinnerFocus: boolean; dietStruggle: string | null; dietTip: string | null } {
  const isDinnerFocus = profile.hasLateDinner;
  let dietStruggle: string | null = null;
  let dietTip: string | null = null;

  if (!isDinnerFocus && profile.struggles.length > 0) {
    dietStruggle = profile.struggles[0];
    const ladder = DIET_TIP_LADDERS[dietStruggle];
    if (ladder && ladder.length > 0) {
      dietTip = ladder[0];
    }
  }

  return {
    walkFrequency: profile.walksPerWeek || 3,
    walkDuration: profile.walkDuration || 10,
    isDinnerFocus,
    dietStruggle,
    dietTip,
  };
}
