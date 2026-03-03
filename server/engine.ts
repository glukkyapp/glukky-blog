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
}

export interface SuggestedAction {
  type: "add_day" | "add_minutes" | "keep_current" | "standing_reset" | "set_rest_day";
  label: string;
  description: string;
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

  const walkDaysScheduled = planDays.filter(d => d.walkScheduled).length;
  const walkDaysCompleted = logs.filter(l => l.walkCompleted === true).length;
  const walkSuccessPct = walkDaysScheduled > 0 ? Math.round((walkDaysCompleted / walkDaysScheduled) * 100) : 0;

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

  const fatigueDetected = await checkFatiguePattern(userId, profile.currentWeek);

  const suggestedActions = buildSuggestedActions(profile, walkDaysScheduled, plan.walkDurationGoal, fatigueDetected);

  const lastWeekSchedule: LastWeekDaySchedule[] = planDays.map(d => ({
    dayOfWeek: d.dayOfWeek,
    walkScheduled: d.walkScheduled,
    eatOutScheduled: d.eatOutScheduled,
    lateDinnerScheduled: d.lateDinnerScheduled,
    dinnerLabel: d.dinnerLabel,
  }));

  return {
    weekNumber: lastWeek,
    walkDaysScheduled,
    walkDaysCompleted,
    walkSuccessPct,
    walkDuration: plan.walkDurationGoal,
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
    isDinnerFocus: plan.isDinnerFocus,
    fatigueDetected,
    suggestedActions,
    lastWeekSchedule,
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
    label: "Keep current schedule",
    description: `Stay at ${currentWalkDays} days, ${currentDuration} min`,
  });

  if (currentWalkDays < 5) {
    actions.push({
      type: "add_day",
      label: "Add 1 more walk day",
      description: `Go from ${currentWalkDays} to ${currentWalkDays + 1} days this week`,
    });
  }

  if (currentDuration < 20) {
    actions.push({
      type: "add_minutes",
      label: "Add 5 more minutes",
      description: `Go from ${currentDuration} to ${currentDuration + 5} min walks`,
    });
  }

  if (currentDuration >= 20 && currentWalkDays < 7) {
    actions.push({
      type: "standing_reset",
      label: "Add a 2-min Standing Reset",
      description: "A short 2-min stand on an off-day helps break sedentary patterns",
    });
  }

  if (fatigueDetected) {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    actions.push({
      type: "set_rest_day",
      label: `Set ${dayNames[fatigueDetected.dayOfWeek]} as rest day`,
      description: `You've been tired on ${dayNames[fatigueDetected.dayOfWeek]} for 3 weeks straight`,
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
  negotiationChoice: "keep_current" | "add_day" | "add_minutes" | "standing_reset" | "set_rest_day";
  walkDays: number[];
  eatOutDays: number[];
  lateDinnerDays: number[];
}

export async function createWeeklyPlan(input: CreatePlanInput): Promise<{ plan: WeeklyPlan; days: WeeklyPlanDay[] }> {
  const profile = await storage.getProfile(input.userId);
  if (!profile) throw new Error("Profile not found");

  const weekNumber = profile.currentWeek;
  const startDate = getWeekStartDate(weekNumber);

  let walkDuration = profile.walkDuration;
  let walkFrequency = input.walkDays.length;

  if (input.negotiationChoice === "add_minutes") {
    walkDuration = Math.min(walkDuration + 5, 20);
  } else if (input.negotiationChoice === "standing_reset") {
    walkDuration = profile.walkDuration;
  }

  if (input.negotiationChoice === "set_rest_day") {
    const restDayIdx = input.walkDays.length > 0 ? undefined : undefined;
    await storage.updateProfile(input.userId, { restDay: input.walkDays[0] });
  }

  const isDinnerFocus = profile.hasLateDinner && !profile.dinnerMastered;
  let dietStruggle: string | null = null;
  let dietTip: string | null = null;

  if (!isDinnerFocus && profile.currentStruggle) {
    dietStruggle = profile.currentStruggle;
    const ladder = DIET_TIP_LADDERS[profile.currentStruggle];
    if (ladder && profile.currentTipIndex < ladder.length) {
      dietTip = ladder[profile.currentTipIndex];
    }
  }

  const plan = await storage.createWeeklyPlan({
    userId: input.userId,
    weekNumber,
    startDate,
    walkFrequencyGoal: walkFrequency,
    walkDurationGoal: walkDuration,
    dietStruggle,
    dietTip,
    isDinnerFocus,
  });

  const dayEntries: any[] = [];
  for (let d = 0; d < 7; d++) {
    const walkScheduled = input.walkDays.includes(d);
    const eatOutScheduled = input.eatOutDays.includes(d);
    const lateDinnerScheduled = input.lateDinnerDays.includes(d);

    dayEntries.push({
      weeklyPlanId: plan.id,
      dayOfWeek: d,
      walkScheduled: walkScheduled || (input.negotiationChoice === "standing_reset" && !walkScheduled),
      eatOutScheduled,
      lateDinnerScheduled,
      dinnerLabel: "none" as const,
      walkDuration: walkScheduled ? walkDuration : (input.negotiationChoice === "standing_reset" ? 2 : 0),
    });
  }

  const days = await storage.createWeeklyPlanDays(dayEntries);

  await storage.updateProfile(input.userId, {
    walkDuration,
    walksPerWeek: walkFrequency,
  });

  return { plan, days };
}

export async function processDietProgression(userId: string): Promise<{ advanced: boolean; graduated: boolean; nextStruggle?: string }> {
  const profile = await storage.getProfile(userId);
  if (!profile || !profile.currentStruggle) return { advanced: false, graduated: false };

  const lastWeek = profile.currentWeek - 1;
  const plan = await storage.getWeeklyPlan(userId, lastWeek);
  if (!plan) return { advanced: false, graduated: false };

  const logs = await storage.getDailyLogsByWeek(userId, lastWeek, plan.startDate);

  const hasNo = logs.some(l => l.dietResponse === "no");
  const hasAnyResponse = logs.some(l => l.dietResponse !== null);

  if (!hasAnyResponse) return { advanced: false, graduated: false };

  if (hasNo) {
    return { advanced: false, graduated: false };
  }

  const ladder = DIET_TIP_LADDERS[profile.currentStruggle];
  if (!ladder) return { advanced: false, graduated: false };

  const nextTipIndex = profile.currentTipIndex + 1;

  if (nextTipIndex >= ladder.length) {
    const struggles = profile.struggles || [];
    const currentIdx = struggles.indexOf(profile.currentStruggle);
    const nextStruggle = currentIdx < struggles.length - 1 ? struggles[currentIdx + 1] : null;

    await storage.updateProfile(userId, {
      currentStruggle: nextStruggle,
      currentTipIndex: 0,
    });

    return { advanced: true, graduated: true, nextStruggle: nextStruggle || undefined };
  }

  await storage.updateProfile(userId, { currentTipIndex: nextTipIndex });
  return { advanced: true, graduated: false };
}

export async function processDinnerGraduation(userId: string): Promise<{ graduated: boolean; successPct: number }> {
  const profile = await storage.getProfile(userId);
  if (!profile || !profile.hasLateDinner || profile.dinnerMastered) {
    return { graduated: false, successPct: 0 };
  }

  const lastWeek = profile.currentWeek - 1;
  const plan = await storage.getWeeklyPlan(userId, lastWeek);
  if (!plan) return { graduated: false, successPct: 0 };

  const planDays = await storage.getWeeklyPlanDays(plan.id);
  const dinnerDays = planDays.filter(d => d.dinnerLabel !== "none");

  if (dinnerDays.length === 0) return { graduated: false, successPct: 0 };

  const logs = await storage.getDailyLogsByWeek(userId, lastWeek, plan.startDate);
  const dinnerLogs = logs.filter(l => l.dinnerSuccess !== null);
  const successCount = dinnerLogs.filter(l => l.dinnerSuccess === true).length;
  const successPct = Math.round((successCount / dinnerDays.length) * 100);

  if (successPct >= 95) {
    const newSuccessWeeks = profile.dinnerSuccessWeeks + 1;
    if (newSuccessWeeks >= 3) {
      const firstStruggle = profile.struggles.length > 0 ? profile.struggles[0] : null;
      await storage.updateProfile(userId, {
        dinnerMastered: true,
        dinnerSuccessWeeks: newSuccessWeeks,
        currentStruggle: firstStruggle,
        currentTipIndex: 0,
      });
      return { graduated: true, successPct };
    } else {
      await storage.updateProfile(userId, { dinnerSuccessWeeks: newSuccessWeeks });
    }
  } else {
    await storage.updateProfile(userId, { dinnerSuccessWeeks: 0 });
  }

  return { graduated: false, successPct };
}

export async function checkBiWeeklyTriggers(userId: string): Promise<{
  walkingBridge: boolean;
  autoEscalation: boolean;
  stagnationPivot: boolean;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.currentWeek < 3) {
    return { walkingBridge: false, autoEscalation: false, stagnationPivot: false };
  }

  const result = { walkingBridge: false, autoEscalation: false, stagnationPivot: false };
  const recentPlans = await storage.getRecentWeeklyPlans(userId, 2);
  if (recentPlans.length < 2) return result;

  let totalWalks = 0;
  let totalStandingDays = 0;
  let standingSuccessDays = 0;

  for (const plan of recentPlans) {
    const logs = await storage.getDailyLogsByWeek(userId, plan.weekNumber, plan.startDate);
    const planDays = await storage.getWeeklyPlanDays(plan.id);
    totalWalks += logs.filter(l => l.walkCompleted === true).length;

    for (const day of planDays) {
      if (day.walkDuration === 2) {
        totalStandingDays++;
        const dayDate = new Date(plan.startDate);
        dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
        const dateStr = dayDate.toISOString().split("T")[0];
        const log = logs.find(l => l.date === dateStr);
        if (log?.walkCompleted) standingSuccessDays++;
      }
    }
  }

  if (totalWalks === 0) {
    result.walkingBridge = true;
  }

  if (totalStandingDays > 0 && standingSuccessDays === totalStandingDays) {
    result.autoEscalation = true;
  }

  return result;
}

export async function generateWeeklyReportData(userId: string, weekNumber: number) {
  const plan = await storage.getWeeklyPlan(userId, weekNumber);
  if (!plan) return null;

  const planDays = await storage.getWeeklyPlanDays(plan.id);
  const logs = await storage.getDailyLogsByWeek(userId, weekNumber, plan.startDate);

  const walkDaysScheduled = planDays.filter(d => d.walkScheduled).length;
  const walkDaysCompleted = logs.filter(l => l.walkCompleted === true).length;
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

  if (profile.currentStruggle) {
    const completedStruggles = profile.struggles.slice(0, profile.struggles.indexOf(profile.currentStruggle));
    for (const s of completedStruggles) {
      if (struggleStatus[s]) struggleStatus[s].completed = true;
    }
  }

  return {
    totalMinutes,
    tipPerformance,
    struggleStatus,
    weeksAnalyzed: weeksToAnalyze,
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
