import assert from "node:assert/strict";
import {
  awardPiggyBankCoinWithTracking,
  createPiggyBankAward,
  type RewardAutoAssignmentTrackingDependencies,
} from "../server/achievements";
import type { PiggyBankAwardResult } from "../server/storage";

const events: Array<{ event: string; mode: unknown }> = [];
const tracking: RewardAutoAssignmentTrackingDependencies = {
  getConsent: async () => true,
  track: (_userId, event, properties) => {
    events.push({ event, mode: properties?.mode });
  },
};

let resolveAward!: (result: PiggyBankAwardResult) => void;
const pendingAward = new Promise<PiggyBankAwardResult>(resolve => {
  resolveAward = resolve;
});
const committed = awardPiggyBankCoinWithTracking(
  "test-user",
  createPiggyBankAward("food_snap", 1),
  {
    ...tracking,
    award: async () => pendingAward,
  },
);
await new Promise(resolve => setImmediate(resolve));
assert.equal(events.length, 0, "analytics must wait for the storage transaction promise");
resolveAward({
  awarded: true,
  autoAssignedNow: true,
  mode: "photo",
  profile: undefined,
});
assert.equal(await committed, 1);
assert.deepEqual(events, [{ event: "reward_auto_assigned", mode: "photo" }]);

for (const result of [
  { awarded: false, autoAssignedNow: false, mode: "photo", profile: undefined },
  { awarded: true, autoAssignedNow: false, mode: "garden", profile: undefined },
] satisfies PiggyBankAwardResult[]) {
  await awardPiggyBankCoinWithTracking(
    "test-user",
    createPiggyBankAward("food_snap", 2),
    { ...tracking, award: async () => result },
  );
}
assert.equal(events.length, 1, "duplicate, capped, and already-assigned awards must not track");

await assert.rejects(() => awardPiggyBankCoinWithTracking(
  "test-user",
  createPiggyBankAward("food_snap", 3),
  { ...tracking, award: async () => { throw new Error("transaction rolled back"); } },
));
assert.equal(events.length, 1, "rolled-back transactions must not track");

console.log("Reward auto-assignment analytics timing passed");