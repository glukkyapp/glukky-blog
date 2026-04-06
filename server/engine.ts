import { storage } from "./storage";
import { awardDinnerGraduationCoin } from "./achievements";
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
  dinnerTacticBreakdown: { label: string; success: number; total: number }[];
  dietTip: string | null;
  dietStruggle: string | null;
  dietNoCount: number;
  dietYesCount: number;
  dietNoChanceCount: number;
  dietCleanWeek: boolean;
  isDinnerFocus: boolean;
  missedWalkCheckInDays: number;
  missedDietCheckInDays: number;
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

export async function getWeekStartDate(weekNumber: number, baseDate?: Date, userId?: string): Promise<string> {
  if (weekNumber > 1 && userId) {
    const week1Plan = await storage.getWeeklyPlan(userId, 1);
    if (week1Plan) {
      // Anchor every week to the stored week 1 start date so that the schedule
      // is fixed regardless of when the planner is opened. Without this, using
      // the current Monday as the base causes the offset to compound by 7 days
      // each cycle (week 3 is 7 days off, week 4 is 14 days off, etc.).
      const week1Start = new Date(week1Plan.startDate + "T00:00:00");
      const weekOffset = (weekNumber - 1) * 7;
      const startDate = new Date(week1Start);
      startDate.setDate(week1Start.getDate() + weekOffset);
      return startDate.toISOString().split("T")[0];
    }
    // Edge case: userId provided and weekNumber > 1 but no week 1 plan found
    // (e.g. data was deleted). Fall through to the current-Monday fallback so
    // plan creation does not hard-error; the resulting date may be slightly off
    // but is still a valid Monday.
  }
  const base = baseDate || new Date();
  const dayOfWeek = base.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(base);
  thisMonday.setDate(base.getDate() + mondayOffset);
  return thisMonday.toISOString().split("T")[0];
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

  const allDinnerLabels = ["move_early", "fiber_starter", "dusk_prep", "split_dinner"];
  const dinnerTacticBreakdown: { label: string; success: number; total: number }[] = [];
  for (const lbl of allDinnerLabels) {
    const daysWithLabel = planDays.filter(d => d.dinnerLabel === lbl);
    if (daysWithLabel.length === 0) continue;
    let successCount = 0;
    for (const day of daysWithLabel) {
      const dayDate = new Date(plan.startDate + "T00:00:00");
      dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
      const dateStr = dayDate.toISOString().split("T")[0];
      const log = logs.find(l => l.date === dateStr);
      if (log?.dinnerSuccess === true) successCount++;
    }
    dinnerTacticBreakdown.push({ label: lbl, success: successCount, total: daysWithLabel.length });
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

  const missedWalkCheckInDays = planDays.filter(d => {
    if (!d.walkScheduled && !d.lateDinnerScheduled) return false;
    const dayDate = new Date(plan.startDate + "T00:00:00");
    dayDate.setDate(dayDate.getDate() + d.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    if (!log) return true;
    if (d.walkScheduled && (log.walkCompleted === null || log.walkCompleted === undefined)) return true;
    return false;
  }).length;

  const dietEligibleDays = !plan.dietStruggle
    ? []
    : plan.dietStruggle === "eat_out"
      ? planDays.filter(d => d.eatOutScheduled)
      : planDays;
  const missedDietCheckInDays = dietEligibleDays.filter(d => {
    const dayDate = new Date(plan.startDate + "T00:00:00");
    dayDate.setDate(dayDate.getDate() + d.dayOfWeek);
    const dateStr = dayDate.toISOString().split("T")[0];
    const log = logs.find(l => l.date === dateStr);
    if (!log) return true;
    return log.dietResponse === null || log.dietResponse === undefined;
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
    dinnerTacticBreakdown,
    dietTip: plan.dietTip,
    dietStruggle: plan.dietStruggle,
    dietNoCount,
    dietYesCount,
    dietNoChanceCount,
    dietCleanWeek,
    dietDaysTotal,
    missedWalkCheckInDays,
    missedDietCheckInDays,
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
  negotiationChoice: "keep_current" | "add_day" | "add_minutes" | "set_rest_day" | "standing_tap" | "stretch_escalation";
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
  const startDate = await getWeekStartDate(weekNumber, input.baseDate, input.userId);

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
    planStruggleCycle: profile.currentStruggleCycle,
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

export async function evaluateDietStruggle(userId: string, struggle: string, upToWeek?: number): Promise<{
  type: string;
  struggle: string;
  yesDays?: number;
  noDays?: number;
  noChanceDays?: number;
  activeDays?: number;
  eatOutDaysScheduled?: number;
  bestTip?: string;
  bestTipYes?: number;
  weeksFound?: number;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile) return { type: "in_cycle", struggle, weeksFound: 0 };

  const week1Plan = await storage.getWeeklyPlan(userId, 1);
  const isPartialFirstWeek = !!(week1Plan && week1Plan.firstActiveDay > 0);

  const activePlans: { weekNumber: number; plan: WeeklyPlan }[] = [];
  for (let w = 1; w <= (upToWeek ?? profile.currentWeek - 1); w++) {
    const wp = await storage.getWeeklyPlan(userId, w);
    if (wp && wp.dietStruggle === struggle && wp.planStruggleCycle === profile.currentStruggleCycle) {
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

  const weeksFound = uniqueActivePlans.length;
  const activeDays = weeksFound * 7;
  if (activeDays === 0) return { type: "in_cycle", struggle, activeDays: 0, weeksFound: 0 };

  if (struggle === "eat_out") {
    let eatOutDaysScheduled = 0;
    let yesDays = 0;
    let noDays = 0;
    let noChanceDays = 0;
    const tipYesCounts: Record<string, number> = {};

    for (const { weekNumber: wn, plan: wp } of uniqueActivePlans) {
      const startDate = typeof wp.startDate === "string" ? wp.startDate : (wp.startDate as any).toISOString().split("T")[0];
      const planDays = await storage.getWeeklyPlanDays(wp.id);
      const eatOutDayIndices = new Set(planDays.filter(d => d.eatOutScheduled).map(d => d.dayOfWeek));
      eatOutDaysScheduled += eatOutDayIndices.size;

      const startMs = new Date(startDate).getTime();
      const logs = await storage.getDailyLogsByWeek(userId, wn, startDate);
      for (const log of logs) {
        const dayIndex = Math.round((new Date(log.date).getTime() - startMs) / 86400000);
        if (!eatOutDayIndices.has(dayIndex)) continue;
        if (log.dietResponse === "yes") yesDays++;
        else if (log.dietResponse === "no") noDays++;
        else if (log.dietResponse === "no_chance") noChanceDays++;
      }
      if (wp.dietTip) {
        const yesCount = logs.filter(l => {
          const dayIndex = Math.round((new Date(l.date).getTime() - startMs) / 86400000);
          return eatOutDayIndices.has(dayIndex) && l.dietResponse === "yes";
        }).length;
        tipYesCounts[wp.dietTip] = (tipYesCounts[wp.dietTip] || 0) + yesCount;
      }
    }

    let bestTip: string | undefined;
    let bestTipYes = 0;
    for (const [tip, count] of Object.entries(tipYesCounts)) {
      if (count > bestTipYes) { bestTip = tip; bestTipYes = count; }
    }

    const yesRate = eatOutDaysScheduled > 0 ? yesDays / eatOutDaysScheduled : 0;
    const noChanceRate = eatOutDaysScheduled > 0 ? noChanceDays / eatOutDaysScheduled : 0;

    // No mastery/skip before 21 active eat_out days
    if (activeDays < 21) return { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, weeksFound };

    // Phase gate helper: mastery if >= minDays && yesRate >= 75%; skip if < minDays or noChanceRate >= 75%
    const evalPhase = (minDays: number) => {
      if (eatOutDaysScheduled >= minDays && yesRate >= 0.75)
        return { type: "mastered", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, bestTip, bestTipYes, weeksFound };
      if (eatOutDaysScheduled < minDays || noChanceRate >= 0.75)
        return { type: "not_relevant", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, bestTip, bestTipYes, weeksFound };
      return null;
    };

    if (activeDays >= 21 && activeDays < 28) {
      const phase3Result = evalPhase(3);
      if (phase3Result) return phase3Result;
      if (profile?.eatOutExtendedCommitment && profile?.currentStruggleCycle === 1) return { type: "moved_on", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, weeksFound };
      return { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, weeksFound };
    }
    if (activeDays === 28) return evalPhase(4) ?? { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, weeksFound };
    if (activeDays === 35) return evalPhase(5) ?? { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, weeksFound };
    if (activeDays >= 42) {
      if (eatOutDaysScheduled >= 6 && yesRate >= 0.75)
        return { type: "mastered", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, bestTip, bestTipYes, weeksFound };
      if (eatOutDaysScheduled >= 6)
        return { type: "moved_on", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, bestTip, bestTipYes, weeksFound };
      return { type: "not_relevant", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, bestTip, bestTipYes, weeksFound };
    }

    if (weeksFound >= 8) return { type: "moved_on", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, bestTip, bestTipYes, weeksFound };
    return { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays, eatOutDaysScheduled, weeksFound };
  }

  let yesDays = 0;
  let noDays = 0;
  let noChanceDays = 0;
  let actualActiveDays = 0;
  const tipYesCounts: Record<string, number> = {};

  for (const { weekNumber: wn, plan: wp } of uniqueActivePlans) {
    const startDate = typeof wp.startDate === "string" ? wp.startDate : (wp.startDate as any).toISOString().split("T")[0];
    const logs = await storage.getDailyLogsByWeek(userId, wn, startDate);
    for (const log of logs) {
      if (log.dietResponse === "yes") { yesDays++; actualActiveDays++; }
      else if (log.dietResponse === "no") { noDays++; actualActiveDays++; }
      else if (log.dietResponse === "no_chance") { noChanceDays++; actualActiveDays++; }
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
    if (yesDays / actualActiveDays >= 0.762) return { type: "mastered", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
    return { type: "moved_on", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
  }
  if (activeDays >= 35) {
    if (yesDays / actualActiveDays >= 0.762) return { type: "mastered", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
    if (noChanceDays / actualActiveDays >= 0.762) return { type: "not_relevant", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
    return { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, weeksFound };
  }
  if (activeDays >= 28) {
    if (yesDays / actualActiveDays >= 0.762) return { type: "mastered", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
    if (noChanceDays / actualActiveDays >= 0.762) return { type: "not_relevant", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
    return { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, weeksFound };
  }
  if (activeDays >= 21 && activeDays < 28) {
    if (yesDays / actualActiveDays >= 0.762) return { type: "mastered", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
    if (noChanceDays / actualActiveDays >= 0.762) return { type: "not_relevant", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
  }
  if (weeksFound >= 8) return { type: "moved_on", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, bestTip, bestTipYes, weeksFound };
  return { type: "in_cycle", struggle, yesDays, noDays, noChanceDays, activeDays: actualActiveDays, weeksFound };
}

export async function getDinnerGraduationData(userId: string): Promise<{
  ready: boolean;
  dinnerSuccessPct: number;
  dinnerDaysScheduled: number;
  dinnerSuccessCount: number;
  dinnerWeeksFound: number;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile) {
    return { ready: false, dinnerSuccessPct: 0, dinnerDaysScheduled: 0, dinnerSuccessCount: 0, dinnerWeeksFound: 0 };
  }

  const week1Plan = await storage.getWeeklyPlan(userId, 1);
  const isPartialFirstWeek = !!(week1Plan && week1Plan.firstActiveDay > 0);

  const dinnerWeeks: { weekNumber: number; plan: any }[] = [];
  for (let w = 1; w <= profile.currentWeek - 1; w++) {
    if (isPartialFirstWeek && w === 1) continue;
    const wp = await storage.getWeeklyPlan(userId, w);
    if (!wp) continue;
    const days = await storage.getWeeklyPlanDays(wp.id);
    const hasDinnerDays = days.some(d => d.dinnerLabel !== "none");
    if (hasDinnerDays) {
      dinnerWeeks.push({ weekNumber: w, plan: wp });
    }
  }

  if (profile.dinnerMastered || profile.dinnerExitType) {
    return { ready: false, dinnerSuccessPct: 0, dinnerDaysScheduled: 0, dinnerSuccessCount: 0, dinnerWeeksFound: dinnerWeeks.length };
  }

  if (dinnerWeeks.length < 3) {
    return { ready: false, dinnerSuccessPct: 0, dinnerDaysScheduled: 0, dinnerSuccessCount: 0, dinnerWeeksFound: dinnerWeeks.length };
  }

  let dinnerDaysScheduled = 0;
  let dinnerSuccessCount = 0;

  for (const { weekNumber: wn, plan: wp } of dinnerWeeks) {
    const days = await storage.getWeeklyPlanDays(wp.id);
    const dinnerDays = days.filter(d => d.dinnerLabel !== "none");
    dinnerDaysScheduled += dinnerDays.length;

    const logs = await storage.getDailyLogsByWeek(userId, wn, wp.startDate);
    for (const dd of dinnerDays) {
      const dayDate = new Date(wp.startDate + "T00:00:00");
      dayDate.setDate(dayDate.getDate() + dd.dayOfWeek);
      const dateStr = dayDate.toISOString().split("T")[0];
      const log = logs.find(l => l.date === dateStr);
      if (log?.dinnerSuccess === true) dinnerSuccessCount++;
    }
  }

  const dinnerSuccessPct = dinnerDaysScheduled > 0
    ? Math.round((dinnerSuccessCount / dinnerDaysScheduled) * 100)
    : 0;

  return { ready: true, dinnerSuccessPct, dinnerDaysScheduled, dinnerSuccessCount, dinnerWeeksFound: dinnerWeeks.length };
}

export async function processDinnerGraduation(userId: string, eventDate: string): Promise<{
  dinnerOutcomeType: "mastered" | "not_relevant" | "moved_on" | "in_cycle";
  dinnerSuccessPct: number;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.dinnerMastered || profile.dinnerExitType) {
    return { dinnerOutcomeType: "in_cycle", dinnerSuccessPct: 0 };
  }

  const dinnerGradData = await getDinnerGraduationData(userId);
  if (!dinnerGradData.ready) {
    return { dinnerOutcomeType: "in_cycle", dinnerSuccessPct: dinnerGradData.dinnerSuccessPct };
  }

  const { dinnerWeeksFound, dinnerDaysScheduled, dinnerSuccessCount, dinnerSuccessPct } = dinnerGradData;
  const dinnerSuccessRate = dinnerDaysScheduled > 0 ? dinnerSuccessCount / dinnerDaysScheduled : 0;

  // Phase gate helper — dinner-specific (NOT evalPhase from eat_out)
  // Mastery:      dinnerDaysScheduled >= minDays AND dinnerSuccessRate >= 75%
  // Not relevant: dinnerDaysScheduled < minDays (no no_chance equivalent for dinner)
  // Continue:     null
  const dinnerEvalPhase = (minDays: number): "mastered" | "not_relevant" | null => {
    if (dinnerDaysScheduled >= minDays && dinnerSuccessRate >= 0.75) return "mastered";
    if (dinnerDaysScheduled < minDays) return "not_relevant";
    return null;
  };

  // Phase gates fire on dinnerWeeksFound milestones (analogous to eat_out's activeDays gates)
  let dinnerOutcomeType: "mastered" | "not_relevant" | "moved_on" | "in_cycle" = "in_cycle";

  if (dinnerWeeksFound < 3) {
    dinnerOutcomeType = "in_cycle";
  } else if (dinnerWeeksFound === 3) {
    dinnerOutcomeType = dinnerEvalPhase(3) ?? "in_cycle";
  } else if (dinnerWeeksFound === 4) {
    dinnerOutcomeType = dinnerEvalPhase(4) ?? "in_cycle";
  } else if (dinnerWeeksFound === 5) {
    dinnerOutcomeType = dinnerEvalPhase(5) ?? "in_cycle";
  } else {
    // >= 6 qualifying dinner weeks
    if (dinnerDaysScheduled >= 6 && dinnerSuccessRate >= 0.75) dinnerOutcomeType = "mastered";
    else if (dinnerDaysScheduled >= 6) dinnerOutcomeType = "moved_on";
    else dinnerOutcomeType = "not_relevant";
  }

  if (dinnerOutcomeType === "mastered") {
    await storage.updateProfile(userId, { dinnerMastered: true });
    try { await awardDinnerGraduationCoin(userId, eventDate); } catch {}
  } else if (dinnerOutcomeType === "moved_on" || dinnerOutcomeType === "not_relevant") {
    await storage.updateProfile(userId, { dinnerExitType: dinnerOutcomeType });
  }

  return { dinnerOutcomeType, dinnerSuccessPct };
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
  }

  if (totalWalks === 0) {
    result.walkingBridge = true;
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

  if (result.consecutiveStretchWeeks >= 2) {
    result.autoEscalation = true;
  }

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

  let totalActiveMinutes = 0;
  let walksCompleted = 0;
  let walksScheduled = 0;
  let stretchesCompleted = 0;
  let stretchesScheduled = 0;
  let hasStretchWeeks = false;
  let tiredDays = 0;
  let reducedWalksGiven = 0;

  const dietDetailMap: Record<string, {
    struggle: string;
    successCount: number;
    tipCompletions: Record<string, number>;
  }> = {};

  let earliestStart = "";
  let latestEnd = "";

  for (let w = currentWeek - weeksToAnalyze; w < currentWeek; w++) {
    const plan = await storage.getWeeklyPlan(userId, w);
    if (!plan) continue;

    const planDays = await storage.getWeeklyPlanDays(plan.id);
    const logs = await storage.getDailyLogsByWeek(userId, w, plan.startDate);
    const startDate = typeof plan.startDate === "string" ? plan.startDate : (plan.startDate as any).toISOString().split("T")[0];

    if (!earliestStart || startDate < earliestStart) earliestStart = startDate;
    const endD = new Date(startDate);
    endD.setDate(endD.getDate() + 6);
    const endStr = endD.toISOString().split("T")[0];
    if (!latestEnd || endStr > latestEnd) latestEnd = endStr;

    const walkDays = planDays.filter(d => d.walkScheduled && !d.standingTap);
    walksScheduled += walkDays.length;

    if (plan.isStretchWeek) {
      hasStretchWeeks = true;
      const stretchDaysInWeek = planDays.filter(d => d.walkScheduled && d.isStretchDay && !d.standingTap);
      stretchesScheduled += stretchDaysInWeek.length;
    }

    for (const day of walkDays) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + day.dayOfWeek);
      const dateStr = dayDate.toISOString().split("T")[0];
      const log = logs.find(l => l.date === dateStr);

      if (log?.walkCompleted) {
        walksCompleted++;
        totalActiveMinutes += day.walkDuration;

        if (day.walkDuration < plan.walkDurationGoal) {
          reducedWalksGiven++;
        }

        if (plan.isStretchWeek && day.isStretchDay) {
          stretchesCompleted++;
        }
      }

      if (log?.walkTired) {
        tiredDays++;
      }
    }

    const struggleKey = plan.isDinnerFocus ? "late_dinner" : plan.dietStruggle;
    if (struggleKey) {
      if (!dietDetailMap[struggleKey]) {
        dietDetailMap[struggleKey] = { struggle: struggleKey, successCount: 0, tipCompletions: {} };
      }
      const detail = dietDetailMap[struggleKey];

      if (plan.isDinnerFocus) {
        const lateDinnerDays = planDays.filter(d => d.lateDinnerScheduled);
        for (const dd of lateDinnerDays) {
          const dayDate = new Date(startDate);
          dayDate.setDate(dayDate.getDate() + dd.dayOfWeek);
          const dateStr = dayDate.toISOString().split("T")[0];
          const log = logs.find(l => l.date === dateStr);
          if (log?.dinnerSuccess === true) detail.successCount++;
        }
      } else if (struggleKey === "eat_out") {
        const eatOutDayIndices = new Set(planDays.filter(d => d.eatOutScheduled).map(d => d.dayOfWeek));
        const startMs = new Date(startDate).getTime();
        for (const log of logs) {
          const dayIndex = Math.round((new Date(log.date).getTime() - startMs) / 86400000);
          if (eatOutDayIndices.has(dayIndex) && log.dietResponse === "yes") {
            detail.successCount++;
          }
        }
      } else {
        for (const log of logs) {
          if (log.dietResponse === "yes") detail.successCount++;
        }
      }

      if (plan.dietTip) {
        const tipKey = plan.dietTip;
        if (!detail.tipCompletions[tipKey]) detail.tipCompletions[tipKey] = 0;

        if (plan.isDinnerFocus) {
          // no per-tip counting for late dinner
        } else if (struggleKey === "eat_out") {
          const eatOutDayIndices = new Set(planDays.filter(d => d.eatOutScheduled).map(d => d.dayOfWeek));
          const startMs = new Date(startDate).getTime();
          for (const log of logs) {
            const dayIndex = Math.round((new Date(log.date).getTime() - startMs) / 86400000);
            if (eatOutDayIndices.has(dayIndex) && log.dietResponse === "yes") {
              detail.tipCompletions[tipKey]++;
            }
          }
        } else {
          for (const log of logs) {
            if (log.dietResponse === "yes") detail.tipCompletions[tipKey]++;
          }
        }
      }
    }
  }

  const allMastered = [
    ...((profile.masteredStruggles || []) as string[]),
    ...((profile.masteredStruggles2 || []) as string[]),
    ...((profile.masteredStruggles3 || []) as string[]),
  ];
  const allSkipped = [
    ...((profile.skippedStruggles || []) as string[]),
    ...((profile.skippedStruggles2 || []) as string[]),
    ...((profile.skippedStruggles3 || []) as string[]),
  ];
  const allDifficult = [
    ...((profile.difficultStruggles || []) as string[]),
    ...((profile.difficultStruggles2 || []) as string[]),
    ...((profile.difficultStruggles3 || []) as string[]),
  ];

  function getStruggleStatus(key: string): "mastered" | "in_progress" | "moved_on" | "skipped" {
    if (key === "late_dinner") {
      if (profile!.dinnerMastered) return "mastered";
      if (profile!.dinnerExitType === "moved_on") return "moved_on";
      return "in_progress";
    }
    if (allMastered.includes(key)) return "mastered";
    if (allSkipped.includes(key)) return "skipped";
    if (allDifficult.includes(key)) return "moved_on";
    return "in_progress";
  }

  const dietDetails = Object.values(dietDetailMap).map(d => ({
    struggle: d.struggle,
    status: getStruggleStatus(d.struggle),
    successCount: d.successCount,
    tipCompletions: Object.entries(d.tipCompletions)
      .filter(([, count]) => count > 0)
      .map(([tip, yesCount]) => ({ tip, yesCount })),
  }));

  const walkCompletionRate = walksScheduled > 0 ? walksCompleted / walksScheduled : 0;
  const totalDietSuccess = dietDetails.reduce((sum, d) => sum + d.successCount, 0);
  const hasMasteredStruggle = dietDetails.some(d => d.status === "mastered");

  let encourageArea: "walk" | "diet" = "walk";
  let encouragingMessage = "";

  if (hasMasteredStruggle) {
    encourageArea = "diet";
  } else if (walkCompletionRate >= 0.8 && totalDietSuccess < 5) {
    encourageArea = "walk";
  } else if (totalDietSuccess > walksCompleted) {
    encourageArea = "diet";
  }

  if (encourageArea === "walk") {
    if (tiredDays > 0 && walksCompleted > 0) {
      encouragingMessage = "encourage_showed_up_tired";
    } else if (walkCompletionRate >= 0.8) {
      encouragingMessage = "encourage_walk_strong";
    } else if (walksCompleted > 0) {
      encouragingMessage = "encourage_walk_started";
    } else {
      encouragingMessage = "encourage_walk_next_month";
    }
  } else {
    if (hasMasteredStruggle) {
      encouragingMessage = "encourage_diet_mastered";
    } else if (totalDietSuccess >= 10) {
      encouragingMessage = "encourage_diet_consistent";
    } else if (totalDietSuccess > 0) {
      encouragingMessage = "encourage_diet_started";
    } else {
      encouragingMessage = "encourage_diet_next_month";
    }
  }

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const dateRange = earliestStart && latestEnd ? `${fmtDate(earliestStart)} – ${fmtDate(latestEnd)}` : "";

  return {
    walksCompleted,
    walksScheduled,
    totalActiveMinutes,
    stretchesCompleted,
    stretchesScheduled,
    hasStretchWeeks,
    tiredDays,
    reducedWalksGiven,
    dietDetails,
    encouragingMessage,
    encourageArea,
    piggyBankReward: profile.piggyBankReward || null,
    dateRange,
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

export async function checkCurrentCycleRepickCondition(userId: string): Promise<{
  conditionMet: boolean;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile) return { conditionMet: false };

  const struggles3 = (profile.struggles3 || []) as string[];
  if (struggles3.length === 0) return { conditionMet: false };

  const currentCycle = (profile.currentStruggleCycle as number) || 1;
  const mastered3 = (profile.masteredStruggles3 || []) as string[];
  const skipped3 = (profile.skippedStruggles3 || []) as string[];
  const difficult3 = (profile.difficultStruggles3 || []) as string[];
  const resolved = new Set([...mastered3, ...skipped3, ...difficult3]);

  // Determine cycle start from previous cycle's history entry.
  // If no prior history row, fall back to checking all-time scheduling (conservative for legacy users).
  const historyEntries = await storage.getCycleHistory(userId);
  const prevCycleEntry = historyEntries.find(h => h.cycleNumber === currentCycle - 1);
  const cycleStartWeek = prevCycleEntry?.endWeek != null ? (prevCycleEntry.endWeek as number) : null;

  // Build appearedSet only when we have a reliable cycle boundary.
  // dietStruggle column is null during dinner-focus weeks, so late_dinner never appears here.
  // appearedSet is only used for non-dinner non-eat_out struggles.
  const appearedSet = new Set<string>();
  if (cycleStartWeek !== null) {
    const allPlans = await storage.getAllWeeklyPlans(userId);
    const currentCyclePlans = allPlans.filter(p => ((p.weekNumber as number) || 0) > cycleStartWeek);
    for (const plan of currentCyclePlans) {
      if (plan.dietStruggle) appearedSet.add(plan.dietStruggle);
    }
  }

  // eat_out / late_dinner exemption: use weeklyPlanDays scheduling (not dietStruggle column),
  // scoped to current cycle when a boundary is available.
  const eatOutPickedInList = struggles3.includes("eat_out");
  const lateDinnerPickedInList = struggles3.includes("late_dinner");

  let eatOutScheduledThisCycle = false;
  let lateDinnerScheduledThisCycle = false;

  if (eatOutPickedInList) {
    eatOutScheduledThisCycle = cycleStartWeek !== null
      ? await storage.hasEatOutScheduledSince(userId, cycleStartWeek)
      : await storage.hasAnyEatOutScheduled(userId);
  }
  if (lateDinnerPickedInList) {
    lateDinnerScheduledThisCycle = cycleStartWeek !== null
      ? await storage.hasLateDinnerScheduledSince(userId, cycleStartWeek)
      : await storage.hasAnyLateDinnerScheduled(userId);
  }

  const eatOutPickedButNeverScheduled = eatOutPickedInList && !eatOutScheduledThisCycle;
  const lateDinnerPickedButNeverScheduled = lateDinnerPickedInList && !lateDinnerScheduledThisCycle;

  const mustGoThrough = struggles3.filter(s => {
    if (s === "eat_out" && eatOutPickedButNeverScheduled) return false;
    if (s === "late_dinner" && lateDinnerPickedButNeverScheduled) return false;
    return true;
  });

  if (mustGoThrough.length === 0) return { conditionMet: true };

  // With a known cycle boundary: allow completion when struggle is resolved OR appeared as diet focus this cycle.
  // Without a boundary (legacy/no-history users): only allow completion when resolved (prevents cross-cycle false positives).
  const conditionMet = mustGoThrough.every(s => {
    if (resolved.has(s)) return true;
    if (cycleStartWeek !== null && appearedSet.has(s)) return true;
    return false;
  });

  return { conditionMet };
}

export async function checkCycle3RepickCondition(userId: string): Promise<{
  conditionMet: boolean;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile) return { conditionMet: false };

  const struggles2 = (profile.struggles2 || []) as string[];
  if (struggles2.length === 0) return { conditionMet: false };

  const mastered2 = (profile.masteredStruggles2 || []) as string[];
  const skipped2 = (profile.skippedStruggles2 || []) as string[];
  const difficult2 = (profile.difficultStruggles2 || []) as string[];

  const hasOutcome = (s: string) =>
    mastered2.includes(s) || skipped2.includes(s) || difficult2.includes(s);

  // If eat_out is in struggles2 but has no outcome yet, Cycle 2 must not end.
  if (struggles2.includes("eat_out") && !hasOutcome("eat_out")) {
    return { conditionMet: false };
  }

  const allPlans = await storage.getAllWeeklyPlans(userId);

  const appearedSet = new Set<string>();
  for (const plan of allPlans) {
    if (plan.dietStruggle) appearedSet.add(plan.dietStruggle);
  }

  const lateDinnerPickedInList = struggles2.includes("late_dinner");
  const lateDinnerEverScheduled = lateDinnerPickedInList ? await storage.hasAnyLateDinnerScheduled(userId) : false;
  const lateDinnerPickedButNeverScheduled = lateDinnerPickedInList && !lateDinnerEverScheduled;

  const mustGoThrough = struggles2.filter(s => {
    if (s === "late_dinner" && lateDinnerPickedButNeverScheduled) return false;
    return true;
  });

  if (mustGoThrough.length === 0) return { conditionMet: true };

  const conditionMet = mustGoThrough.every(s => hasOutcome(s) || appearedSet.has(s));

  return { conditionMet };
}

export async function checkRepickCondition(userId: string): Promise<{
  conditionMet: boolean;
  eatOutPickedButNeverScheduled: boolean;
  eatOutNeedsCommitment: boolean;
  eatOutFocusWeeks: number;
  eatOutLastStruggleNeedsActivation: boolean;
}> {
  const profile = await storage.getProfile(userId);
  if (!profile) return { conditionMet: false, eatOutPickedButNeverScheduled: false, eatOutNeedsCommitment: false, eatOutFocusWeeks: 0, eatOutLastStruggleNeedsActivation: false };

  const struggles = (profile.struggles || []) as string[];
  if (struggles.length === 0) return { conditionMet: !!(profile.dinnerMastered) || !profile.hasLateDinner, eatOutPickedButNeverScheduled: false, eatOutNeedsCommitment: false, eatOutFocusWeeks: 0, eatOutLastStruggleNeedsActivation: false };

  const eatOutPickedInList = struggles.includes("eat_out");
  const hasOtherStruggles = struggles.filter(s => s !== "eat_out").length > 0;
  const eatOutFocusWeeks = eatOutPickedInList ? await storage.countEatOutFocusWeeks(userId) : 0;

  const mastered = (profile.masteredStruggles || []) as string[];
  const skipped = (profile.skippedStruggles || []) as string[];
  const difficult = (profile.difficultStruggles || []) as string[];
  const eatOutResolved = mastered.includes("eat_out") || skipped.includes("eat_out") || difficult.includes("eat_out");

  const allOtherResolved = struggles
    .filter(s => s !== "eat_out")
    .every(s => mastered.includes(s) || skipped.includes(s) || difficult.includes(s));

  // eatOutLastStruggleNeedsActivation: all other struggles resolved, eat_out has 0 focus weeks,
  // but there is at least 1 historically scheduled eat-out day → must give it a proper week
  const historicalEatOutDays = (eatOutPickedInList && hasOtherStruggles && (eatOutFocusWeeks === 0 || eatOutFocusWeeks === 3) && allOtherResolved)
    ? await storage.countHistoricalEatOutDays(userId)
    : 0;
  const eatOutLastStruggleNeedsActivation = eatOutPickedInList && hasOtherStruggles
    && (eatOutFocusWeeks === 0 || eatOutFocusWeeks === 3)
    && allOtherResolved
    && historicalEatOutDays >= 1
    && !eatOutResolved;

  // Rule A: eat_out exempted if 0 focus weeks AND there are other struggles,
  // BUT NOT when eatOutLastStruggleNeedsActivation (must go through eat_out first)
  const eatOutPickedButNeverScheduled = eatOutPickedInList && hasOtherStruggles && eatOutFocusWeeks === 0 && !eatOutLastStruggleNeedsActivation;

  // Rule B: commitment needed when eat_out has 1-2 or 4-5 focus weeks with no outcome, other struggles exist AND all other struggles resolved
  const eatOutNeedsCommitment = eatOutPickedInList && hasOtherStruggles
    && allOtherResolved
    && (eatOutFocusWeeks === 1 || eatOutFocusWeeks === 2 || eatOutFocusWeeks === 4 || eatOutFocusWeeks === 5)
    && !eatOutResolved
    && !(profile?.eatOutExtendedCommitment);

  const mustGoThrough = struggles.filter(s => {
    if (s === "eat_out" && eatOutPickedButNeverScheduled) return false;
    return true;
  });

  if (mustGoThrough.length === 0) return { conditionMet: true, eatOutPickedButNeverScheduled, eatOutNeedsCommitment, eatOutFocusWeeks, eatOutLastStruggleNeedsActivation };

  const conditionMet = mustGoThrough.every(s => mastered.includes(s) || skipped.includes(s) || difficult.includes(s));

  return { conditionMet, eatOutPickedButNeverScheduled, eatOutNeedsCommitment, eatOutFocusWeeks, eatOutLastStruggleNeedsActivation };
}
