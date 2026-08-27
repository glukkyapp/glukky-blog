/**
 * Focused two-month report calculation tests.
 *
 * Run with: npx tsx tests/two-month-report.test.mts
 */
import { strict as assert } from "node:assert";
import {
  MIN_MEALS_PER_MEALTIME_BUCKET,
  MIN_MEALS_PER_WEEKDAY_BUCKET,
  MIN_MEALS_PER_WEEKDAY_PART_BUCKET,
  MIN_MEALS_PER_WEEKEND_BUCKET,
  RATE_EQUALITY_TOLERANCE,
  buildTwoMonthReport,
  evaluatePatternComparison,
  getLatestTwoCompletedMonths,
  type PatternBucket,
  type TwoMonthMeal,
} from "../server/two-month-report";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

const now = new Date("2026-08-15T12:00:00.000Z");
function meal(overrides: Partial<TwoMonthMeal> = {}): TwoMonthMeal {
  return {
    id: 1,
    localDate: "2026-06-01",
    mealType: "breakfast",
    glucoseImpact: "low",
    hstix: null,
    ...overrides,
  };
}
function bucket(
  key: PatternBucket["key"],
  totalMeals: number,
  higherImpactMeals: number,
  rate = totalMeals === 0 ? 0 : higherImpactMeals / totalMeals,
): PatternBucket {
  return {
    key,
    totalMeals,
    higherImpactMeals,
    higherImpactRate: rate,
    eligible: true,
  };
}

console.log("Two completed calendar months");
const hongKong = getLatestTwoCompletedMonths(new Date("2026-02-01T02:00:00.000Z"), "Asia/Hong_Kong");
const losAngeles = getLatestTwoCompletedMonths(new Date("2026-02-01T02:00:00.000Z"), "America/Los_Angeles");
check("uses the local calendar month in Asia/Hong_Kong", hongKong.months.join(",") === "2025-12,2026-01");
check("uses the prior local calendar month in America/Los_Angeles", losAngeles.months.join(",") === "2025-11,2025-12");
check("returns a full inclusive end date", hongKong.startDate === "2025-12-01" && hongKong.endDate === "2026-01-31");

console.log("\nFinal-label precedence and denominators");
const hstixOverride = buildTwoMonthReport({
  now,
  timezone: "Asia/Hong_Kong",
  firstMealLocalDate: "2026-05-20",
  glucoseGroup: "healthy",
  meals: Array.from({ length: 10 }, (_, index) => meal({
    id: index + 1,
    glucoseImpact: "high",
    hstix: index === 0 ? { glucoseMmol: 6.5, mealTimingConfidence: "on_time" } : null,
  })),
});
const hstixBreakfast = hstixOverride.cards[0].buckets.find(item => item.key === "breakfast")!;
check("on-time HStix medium replaces an AI-high label once", hstixBreakfast.higherImpactMeals === 9);
const hstixDefaultGroup = buildTwoMonthReport({
  now,
  timezone: "Asia/Hong_Kong",
  firstMealLocalDate: "2026-05-20",
  glucoseGroup: null,
  meals: Array.from({ length: 10 }, (_, index) => meal({
    id: index + 1,
    glucoseImpact: "high",
    hstix: index === 0 ? { glucoseMmol: 6.5, mealTimingConfidence: "on_time" } : null,
  })),
});
check(
  "on-time HStix retains precedence when the profile has no glucose group",
  hstixDefaultGroup.cards[0].buckets.find(item => item.key === "breakfast")?.higherImpactMeals === 9,
);
const nullLabels = buildTwoMonthReport({
  now,
  timezone: "Asia/Hong_Kong",
  firstMealLocalDate: "2026-05-20",
  glucoseGroup: "healthy",
  meals: Array.from({ length: 10 }, (_, index) => meal({
    id: index + 1,
    glucoseImpact: index < 5 ? "high" : null,
  })),
});
const nullBreakfast = nullLabels.cards[0].buckets.find(item => item.key === "breakfast")!;
check("null final labels remain in the logged-meal denominator", nullBreakfast.totalMeals === 10 && nullBreakfast.higherImpactRate === 0.5);

console.log("\nEligibility, neutral states, and z-score guardrail");
check(
  "mealtime minimum excludes undersized buckets",
  evaluatePatternComparison("mealtime", [
    { ...bucket("breakfast", MIN_MEALS_PER_MEALTIME_BUCKET, 7), eligible: true },
    { ...bucket("lunch", MIN_MEALS_PER_MEALTIME_BUCKET - 1, 0), eligible: false },
  ], MIN_MEALS_PER_MEALTIME_BUCKET).state === "unavailable",
);
check(
  "weekday minimum excludes undersized buckets",
  evaluatePatternComparison("weekday", [
    { ...bucket("monday", MIN_MEALS_PER_WEEKDAY_BUCKET, 4), eligible: true },
    { ...bucket("tuesday", MIN_MEALS_PER_WEEKDAY_BUCKET - 1, 0), eligible: false },
  ], MIN_MEALS_PER_WEEKDAY_BUCKET).state === "unavailable",
);
check(
  "weekday/weekend minimum applies independently",
  evaluatePatternComparison("weekday-weekend", [
    { ...bucket("weekday", MIN_MEALS_PER_WEEKDAY_PART_BUCKET, 7), eligible: true },
    { ...bucket("weekend", MIN_MEALS_PER_WEEKEND_BUCKET - 1, 0), eligible: false },
  ], MIN_MEALS_PER_WEEKEND_BUCKET).state === "unavailable",
);
const asymmetricWeekParts = buildTwoMonthReport({
  now,
  timezone: "UTC",
  firstMealLocalDate: "2026-05-20",
  glucoseGroup: "healthy",
  meals: [
    ...Array.from({ length: 10 }, (_, index) => meal({ id: index + 1, localDate: "2026-06-01", glucoseImpact: "high" })),
    ...Array.from({ length: 4 }, (_, index) => meal({ id: index + 11, localDate: "2026-06-06", glucoseImpact: "low" })),
  ],
});
const asymmetricCard = asymmetricWeekParts.cards.find(card => card.cardType === "weekday-weekend")!;
check(
  "four weekend meals are eligible alongside ten weekday meals",
  asymmetricCard.buckets.find(item => item.key === "weekday")?.eligible === true &&
    asymmetricCard.buckets.find(item => item.key === "weekend")?.eligible === true &&
    asymmetricCard.state !== "unavailable",
);
const almostEqual = evaluatePatternComparison("mealtime", [
  bucket("breakfast", 10, 5, 0.5 + RATE_EQUALITY_TOLERANCE / 2),
  bucket("lunch", 10, 5, 0.5),
], 1);
check("rates inside equality tolerance stay neutral", almostEqual.state === "neutral" && almostEqual.neutralReason === "equal-rate");
const zeroSe = evaluatePatternComparison("mealtime", [
  bucket("breakfast", 10, 10, 1),
  bucket("lunch", 10, 10, 0.9),
], 1);
check("zero standard error returns a finite neutral diagnostic", zeroSe.state === "neutral" && zeroSe.neutralReason === "below-z-threshold" && zeroSe.zScore === null);
const belowGuardrail = evaluatePatternComparison("mealtime", [
  bucket("breakfast", 10, 6),
  bucket("lunch", 10, 4),
], 1);
check("z-score below 1.4 is neutral", belowGuardrail.state === "neutral" && belowGuardrail.neutralReason === "below-z-threshold");
const named = evaluatePatternComparison("mealtime", [
  bucket("breakfast", 10, 10),
  bucket("lunch", 10, 0),
], 1);
check("z-score at or above the guardrail produces a named result", named.state === "named" && named.leadingBucket === "breakfast");

console.log("\nResponse ordering and progress");
const progress = buildTwoMonthReport({
  now,
  timezone: "UTC",
  firstMealLocalDate: "2026-08-01",
  glucoseGroup: "healthy",
  meals: [],
});
check("first incomplete month has a dedicated progress state", progress.status === "progress" && progress.progressState === "first-incomplete-month");
const oneMonth = buildTwoMonthReport({
  now,
  timezone: "UTC",
  firstMealLocalDate: "2026-07-01",
  glucoseGroup: "healthy",
  meals: [],
});
check("one completed month has a dedicated progress state", oneMonth.status === "progress" && oneMonth.progressState === "one-completed-month");
const ordered = buildTwoMonthReport({
  now,
  timezone: "UTC",
  firstMealLocalDate: "2026-06-01",
  glucoseGroup: "healthy",
  meals: [],
});
check("diagnostic cards retain fixed API order", ordered.cards.map(card => card.cardType).join(",") === "mealtime,weekday,weekday-weekend");

console.log(`\n${passed} passed`);