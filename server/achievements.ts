import { storage } from "./storage";

const PIGGY_BANK_CAPACITY = 60;

export type PiggyBankAwardSource = "food_snap" | "hstix_reading" | "daily_win";

interface PiggyBankAwardInput {
  userId: string;
  source: PiggyBankAwardSource;
  eventKey: string;
  description: string;
}

async function awardCoins(input: PiggyBankAwardInput): Promise<number> {
  const { userId, eventKey, description } = input;
  const profile = await storage.getProfile(userId);
  if (!profile || profile.piggyBankCoins >= PIGGY_BANK_CAPACITY) return 0;
  return (await storage.awardPiggyBankCoin(userId, eventKey, description)) ? 1 : 0;
}

/** Award once for a completed FoodSnap meal record. */
export function awardSnapCoin(userId: string, snapId: number): Promise<number> {
  return awardCoins({
    userId,
    source: "food_snap",
    eventKey: `snap_${snapId}`,
    description: "Meal snap completed",
  });
}

/** Award once for a saved HStix reading, whether or not it is meal-linked. */
export function awardHstixCoin(userId: string, readingId: number): Promise<number> {
  return awardCoins({
    userId,
    source: "hstix_reading",
    eventKey: `hstix_${readingId}`,
    description: "HStix reading logged",
  });
}