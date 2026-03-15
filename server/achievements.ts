import { storage } from "./storage";
import type { DailyLog, WeeklyPlan, WeeklyPlanDay } from "@shared/schema";

const PIGGY_BANK_CAPACITY = 60;

async function awardCoins(
  userId: string,
  achievementType: string,
  coins: number,
  description: string,
  opts?: { weekNumber?: number; eventDate?: string }
): Promise<number> {
  const profile = await storage.getProfile(userId);
  if (!profile) return 0;
  if (profile.piggyBankCoins >= PIGGY_BANK_CAPACITY) return 0;

  const existing = await storage.getPiggyBankEvent(
    userId,
    achievementType,
    opts?.weekNumber ?? null,
    opts?.eventDate ?? null
  );
  if (existing) return 0;

  await storage.createPiggyBankEvent({
    userId,
    achievementType,
    coinsAwarded: coins,
    description,
    weekNumber: opts?.weekNumber ?? null,
    eventDate: opts?.eventDate ?? null,
  });
  await storage.addPiggyBankCoins(userId, coins);
  return coins;
}

export async function evaluateDailyAchievements(
  userId: string,
  date: string,
  log: DailyLog,
  plan: WeeklyPlan,
  planDay: WeeklyPlanDay | undefined,
  prevWeekPlanDay: WeeklyPlanDay | undefined
): Promise<number> {
  let totalAwarded = 0;

  if (planDay?.walkScheduled && log.walkCompleted === true) {
    totalAwarded += await awardCoins(
      userId,
      "walk_complete",
      2,
      "Completed a scheduled walk",
      { eventDate: date }
    );
  }

  if (plan.dietTip && log.dietResponse === "yes") {
    totalAwarded += await awardCoins(
      userId,
      "diet_yes",
      2,
      "Followed diet tip",
      { eventDate: date }
    );
  }

  if (planDay?.lateDinnerScheduled && log.dinnerSuccess === true) {
    totalAwarded += await awardCoins(
      userId,
      "dinner_success",
      2,
      "Early dinner / dinner tactic success",
      { eventDate: date }
    );
  }

  if (planDay?.standingTap && log.walkCompleted === true) {
    totalAwarded += await awardCoins(
      userId,
      "standing_tap",
      1,
      "Completed a standing tap",
      { eventDate: date }
    );
  }

  if (
    planDay?.walkScheduled &&
    log.walkCompleted === true &&
    prevWeekPlanDay &&
    planDay.walkDuration > prevWeekPlanDay.walkDuration
  ) {
    totalAwarded += await awardCoins(
      userId,
      "walk_longer",
      1,
      "Walked longer than last week",
      { eventDate: date }
    );
  }

  return totalAwarded;
}

export async function evaluateWeeklyAchievements(
  userId: string,
  completedWeekNumber: number,
  plan: WeeklyPlan,
  planDays: WeeklyPlanDay[],
  logs: DailyLog[]
): Promise<number> {
  let totalAwarded = 0;

  const logsByDate = new Map(logs.map(l => [l.date, l]));

  const planStart = new Date(plan.startDate + "T00:00:00");
  const getDateForDow = (dow: number) => {
    const d = new Date(planStart);
    d.setDate(d.getDate() + dow);
    return d.toISOString().split("T")[0];
  };

  const scheduledWalkDays = planDays.filter(d => d.walkScheduled && !d.standingTap);
  const allWalksCompleted =
    scheduledWalkDays.length > 0 &&
    scheduledWalkDays.every(d => {
      const dateStr = getDateForDow(d.dayOfWeek);
      const log = logsByDate.get(dateStr);
      return log?.walkCompleted === true;
    });

  if (allWalksCompleted) {
    totalAwarded += await awardCoins(
      userId,
      "perfect_walk_week",
      2,
      "Perfect walk week — all scheduled walks completed",
      { weekNumber: completedWeekNumber }
    );
  }

  if (plan.isDinnerFocus) {
    const dinnerDays = planDays.filter(d => d.lateDinnerScheduled);
    const allDinnerSuccess =
      dinnerDays.length > 0 &&
      dinnerDays.every(d => {
        const dateStr = getDateForDow(d.dayOfWeek);
        const log = logsByDate.get(dateStr);
        return log?.dinnerSuccess === true;
      });
    if (allDinnerSuccess) {
      totalAwarded += await awardCoins(
        userId,
        "diet_clean_week",
        2,
        "Dinner focus week fully completed",
        { weekNumber: completedWeekNumber }
      );
    }
  } else if (plan.dietTip) {
    const daysWithLogs = logs.filter(l => l.dietResponse != null);
    const allDietYes =
      daysWithLogs.length > 0 &&
      daysWithLogs.every(l => l.dietResponse === "yes");
    if (allDietYes) {
      totalAwarded += await awardCoins(
        userId,
        "diet_clean_week",
        2,
        "Diet clean week — followed tip every tracked day",
        { weekNumber: completedWeekNumber }
      );
    }
  }

  const activeFirstDay = plan.firstActiveDay ?? 0;
  const activeDays = planDays.filter(d => d.dayOfWeek >= activeFirstDay);
  const allCheckedInSameDay =
    activeDays.length > 0 &&
    activeDays.every(d => {
      const dateStr = getDateForDow(d.dayOfWeek);
      const log = logsByDate.get(dateStr);
      return log != null && log.isBackfill === false;
    });

  if (allCheckedInSameDay) {
    totalAwarded += await awardCoins(
      userId,
      "no_missed_checkins",
      1,
      "No missed check-ins — checked in every day on time",
      { weekNumber: completedWeekNumber }
    );
  }

  if (plan.isStretchWeek) {
    const stretchDays = planDays.filter(d => d.isStretchDay);
    const allStretchDone =
      stretchDays.length > 0 &&
      stretchDays.every(d => {
        const dateStr = getDateForDow(d.dayOfWeek);
        const log = logsByDate.get(dateStr);
        return log?.walkCompleted === true;
      });
    if (allStretchDone) {
      totalAwarded += await awardCoins(
        userId,
        "all_stretching_done",
        1,
        "Completed all scheduled stretching in a stretch week",
        { weekNumber: completedWeekNumber }
      );
    }
  }

  return totalAwarded;
}

export async function awardDinnerGraduationCoin(userId: string, eventDate: string): Promise<number> {
  return awardCoins(
    userId,
    "dinner_graduated",
    5,
    "Graduated from late dinner improvement",
    { eventDate }
  );
}

export async function awardStruggleGraduationCoin(userId: string, struggle: string, eventDate: string): Promise<number> {
  return awardCoins(
    userId,
    `struggle_graduated_${struggle}`,
    5,
    `Graduated from diet struggle: ${struggle}`,
    { eventDate }
  );
}
