import { storage } from "./storage";

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

export async function awardSnapCoin(userId: string, snapId: number): Promise<number> {
  return awardCoins(
    userId,
    `snap_${snapId}`,
    1,
    "Meal snap completed"
  );
}

export async function awardGlucoseCoin(userId: string, snapId: number): Promise<number> {
  return awardCoins(
    userId,
    `glucose_${snapId}`,
    1,
    "Post-meal glucose logged"
  );
}

export async function awardWeeklyMealScoreCoin(
  userId: string,
  weekNumber: number,
  score: number
): Promise<number> {
  if (score < 80) return 0;
  return awardCoins(
    userId,
    "weekly_meal_score_80",
    5,
    "Weekly meal score ≥ 80",
    { weekNumber }
  );
}

export async function awardWeeklyTripleMealCoin(
  userId: string,
  weekNumber: number,
  weekStart: string
): Promise<number> {
  const weekStartDate = new Date(weekStart + "T00:00:00Z");
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 86400000);
  const weekEnd = weekEndDate.toISOString().split("T")[0];

  const allSnaps = await storage.getMealSnapsByDateRange(userId, weekStart, weekEnd);
  const snaps = allSnaps.filter(s => !s.isDeleted);

  const mealTypesByDay = new Map<string, Set<string>>();
  for (const snap of snaps) {
    if (!snap.mealType) continue;
    if (!mealTypesByDay.has(snap.localDate)) {
      mealTypesByDay.set(snap.localDate, new Set());
    }
    mealTypesByDay.get(snap.localDate)!.add(snap.mealType);
  }

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStartDate.getTime() + i * 86400000)
      .toISOString().split("T")[0];
    const types = mealTypesByDay.get(dayDate);
    if (
      !types ||
      !types.has("breakfast") ||
      !types.has("lunch") ||
      !types.has("dinner")
    ) {
      return 0;
    }
  }

  return awardCoins(
    userId,
    "weekly_triple_meal",
    10,
    "Logged breakfast, lunch & dinner every day for a week",
    { weekNumber }
  );
}
