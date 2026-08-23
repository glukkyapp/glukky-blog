import { strict as assert } from "node:assert";
import { classifyHstixTiming } from "../server/hstix-timing";

const recordedAt = new Date("2026-08-23T12:00:00.000Z");
const mealAt = (minutesBefore: number) => new Date(recordedAt.getTime() - minutesBefore * 60_000);

const onTime = classifyHstixTiming(recordedAt, mealAt(55));
assert.deepEqual(onTime, {
  minutesSinceLastMeal: 55,
  mealTimingConfidence: "on_time",
  shouldAssociateMeal: true,
});

const delayed = classifyHstixTiming(recordedAt, mealAt(180));
assert.deepEqual(delayed, {
  minutesSinceLastMeal: 180,
  mealTimingConfidence: "delayed",
  shouldAssociateMeal: true,
});

const unrelated = classifyHstixTiming(recordedAt, mealAt(241));
assert.deepEqual(unrelated, {
  minutesSinceLastMeal: 241,
  mealTimingConfidence: "unrelated",
  shouldAssociateMeal: false,
});

const noMeal = classifyHstixTiming(recordedAt, null);
assert.deepEqual(noMeal, {
  minutesSinceLastMeal: null,
  mealTimingConfidence: "unrelated",
  shouldAssociateMeal: false,
});

console.log("4 HStix timing classifications passed");