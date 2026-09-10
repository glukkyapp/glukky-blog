import assert from "node:assert/strict";
import { getDailyTaskRotation } from "../server/daily-tasks";
import { createPiggyBankAward } from "../server/achievements";

const today = getDailyTaskRotation("user-a", "2026-09-10");
assert.equal(today.length, 3);
assert.equal(new Set(today).size, 3);
assert.deepEqual(getDailyTaskRotation("user-a", "2026-09-10"), today);

const dates = Array.from({ length: 12 }, (_, index) =>
  getDailyTaskRotation("user-a", `2026-09-${String(index + 10).padStart(2, "0")}`).join(",")
);
assert.ok(new Set(dates).size > 1, "rotation changes across local days");

assert.deepEqual(createPiggyBankAward("food_snap", 42), {
  source: "food_snap", eventKey: "snap_42", description: "Meal snap completed",
});
assert.deepEqual(createPiggyBankAward("hstix_reading", 17), {
  source: "hstix_reading", eventKey: "hstix_17", description: "HStix reading logged",
});
assert.deepEqual(createPiggyBankAward("daily_win", "2026-09-10"), {
  source: "daily_win",
  eventKey: "daily_win_2026-09-10",
  description: "Daily wellbeing task completed",
});

console.log("Daily task rotation and award identities passed");