import { storage, type PiggyBankAwardResult } from "./storage";
import { getPosthogConsent, trackServer } from "./posthog";

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

export interface RewardAutoAssignmentTrackingDependencies {
  getConsent: typeof getPosthogConsent;
  track: typeof trackServer;
}

const defaultTrackingDependencies: RewardAutoAssignmentTrackingDependencies = {
  getConsent: getPosthogConsent,
  track: trackServer,
};

export async function trackRewardAutoAssignmentAfterCommit(
  userId: string,
  result: Pick<PiggyBankAwardResult, "autoAssignedNow" | "mode">,
  dependencies: RewardAutoAssignmentTrackingDependencies = defaultTrackingDependencies,
): Promise<void> {
  if (result.autoAssignedNow && result.mode) {
    const consented = await dependencies.getConsent(userId);
    dependencies.track(userId, "reward_auto_assigned", { mode: result.mode }, consented);
  }
}

export async function awardPiggyBankCoinWithTracking(
  userId: string,
  award: PiggyBankAwardDescriptor,
  dependencies: RewardAutoAssignmentTrackingDependencies & {
    award: typeof storage.awardPiggyBankCoinWithMode;
  } = {
    ...defaultTrackingDependencies,
    award: storage.awardPiggyBankCoinWithMode.bind(storage),
  },
): Promise<number> {
  // The storage promise resolves only after its transaction commits. No
  // outbound analytics call can occur before that point.
  const result = await dependencies.award(userId, award.eventKey, award.description);
  await trackRewardAutoAssignmentAfterCommit(userId, result, dependencies);
  return result.awarded ? 1 : 0;
}

/** Award once for a completed FoodSnap meal record. */
export function awardSnapCoin(userId: string, snapId: number): Promise<number> {
  return awardPiggyBankCoinWithTracking(userId, createPiggyBankAward("food_snap", snapId));
}

/** Award once for a saved HStix reading, whether or not it is meal-linked. */
export function awardHstixCoin(userId: string, readingId: number): Promise<number> {
  return awardPiggyBankCoinWithTracking(userId, createPiggyBankAward("hstix_reading", readingId));
}

export function completeDailyWin(userId: string, localDate: string, taskId: string) {
  const award = createPiggyBankAward("daily_win", localDate);
  return storage.completeDailyTaskAndAward({
    userId,
    localDate,
    taskId,
    award,
  }).then(async result => {
    await trackRewardAutoAssignmentAfterCommit(userId, result);
    return result;
  });
}