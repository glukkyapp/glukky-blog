import { storage } from "./storage";

const PIGGY_BANK_CAPACITY = 60;

export type PiggyBankAwardSource = "food_snap" | "hstix_reading" | "daily_win";

export interface PiggyBankAwardDescriptor {
  source: PiggyBankAwardSource;
  eventKey: string;
  description: string;
}

export function createPiggyBankAward(
  source: "food_snap",
  identity: number,
): PiggyBankAwardDescriptor;
export function createPiggyBankAward(
  source: "hstix_reading",
  identity: number,
): PiggyBankAwardDescriptor;
export function createPiggyBankAward(
  source: "daily_win",
  identity: string,
): PiggyBankAwardDescriptor;
export function createPiggyBankAward(
  source: PiggyBankAwardSource,
  identity: number | string,
): PiggyBankAwardDescriptor {
  if (source === "food_snap") {
    return { source, eventKey: `snap_${identity}`, description: "Meal snap completed" };
  }
  if (source === "hstix_reading") {
    return { source, eventKey: `hstix_${identity}`, description: "HStix reading logged" };
  }
  return { source, eventKey: `daily_win_${identity}`, description: "Daily wellbeing task completed" };
}

async function awardCoins(userId: string, award: PiggyBankAwardDescriptor): Promise<number> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.piggyBankCoins >= PIGGY_BANK_CAPACITY) return 0;
  return (await storage.awardPiggyBankCoin(userId, award.eventKey, award.description)) ? 1 : 0;
}

/** Award once for a completed FoodSnap meal record. */
export function awardSnapCoin(userId: string, snapId: number): Promise<number> {
  return awardCoins(userId, createPiggyBankAward("food_snap", snapId));
}

/** Award once for a saved HStix reading, whether or not it is meal-linked. */
export function awardHstixCoin(userId: string, readingId: number): Promise<number> {
  return awardCoins(userId, createPiggyBankAward("hstix_reading", readingId));
}

export function completeDailyWin(userId: string, localDate: string, taskId: string) {
  const award = createPiggyBankAward("daily_win", localDate);
  return storage.completeDailyTaskAndAward({
    userId,
    localDate,
    taskId,
    award,
  });
}