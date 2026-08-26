import { storage } from "./storage";

const PIGGY_BANK_CAPACITY = 60;

async function awardCoins(
  userId: string,
  achievementType: string,
  description: string,
): Promise<number> {
  const profile = await storage.getProfile(userId);
  if (!profile || profile.piggyBankCoins >= PIGGY_BANK_CAPACITY) return 0;
  if (await storage.getPiggyBankEvent(userId, achievementType)) return 0;

  await storage.createPiggyBankEvent({
    userId,
    achievementType,
    coinsAwarded: 1,
    description,
  });
  await storage.addPiggyBankCoins(userId, 1);
  return 1;
}

/** Award once for a completed FoodSnap meal record. */
export function awardSnapCoin(userId: string, snapId: number): Promise<number> {
  return awardCoins(userId, `snap_${snapId}`, "Meal snap completed");
}

/** Award once for a saved HStix reading, whether or not it is meal-linked. */
export function awardHstixCoin(userId: string, readingId: number): Promise<number> {
  return awardCoins(userId, `hstix_${readingId}`, "HStix reading logged");
}