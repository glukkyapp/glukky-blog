import {
  classifyPostMealMmol,
  isHigherImpactGlucoseImpact,
  type GlucoseGroup,
  type PersonalisedThresholds,
} from "./glucose-thresholds";

export const RATE_EQUALITY_TOLERANCE = 1e-12;
// These cards surface exploratory lifestyle observations. Their calendar
// buckets can have only 4-10 eligible meals, so a stricter statistical bar
// would make the completed two-month report impractical at its intended floor.
export const Z_SCORE_GUARDRAIL = 1.4;

// A meal period needs enough repeated observations to avoid conclusions from
// a handful of meals. A weekday has fewer chances to occur in two months, so
// it uses the smaller, calendar-aware minimum.
export const MIN_MEALS_PER_MEALTIME_BUCKET = 10;
export const MIN_MEALS_PER_WEEKDAY_BUCKET = 5;
export const MIN_MEALS_PER_WEEKDAY_PART_BUCKET = 10;
export const MIN_MEALS_PER_WEEKEND_BUCKET = 4;

const MEALTIME_BUCKETS = ["breakfast", "lunch", "dinner", "snack"] as const;
const WEEKDAY_BUCKETS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export type ImpactLabel = "low" | "medium" | "high" | null;
export type PatternCardKind = "mealtime" | "weekday" | "weekday-weekend";
export type PatternBucketKey = typeof MEALTIME_BUCKETS[number] | typeof WEEKDAY_BUCKETS[number] | "weekday" | "weekend";

export type TwoMonthMeal = {
  id: number;
  localDate: string;
  mealType: string | null;
  glucoseImpact: string | null;
  hstix: {
    glucoseMmol: number;
    mealTimingConfidence: string;
  } | null;
};

export type PatternBucket = {
  key: PatternBucketKey;
  totalMeals: number;
  higherImpactMeals: number;
  higherImpactRate: number;
  eligible: boolean;
};

export type PatternCard =
  | {
      cardType: PatternCardKind;
      state: "named";
      leadingBucket: PatternBucketKey;
      runnerUpBucket: PatternBucketKey;
      leadingRate: number;
      runnerUpRate: number;
      zScore: number;
      buckets: PatternBucket[];
    }
  | {
      cardType: PatternCardKind;
      state: "neutral";
      neutralReason: "equal-rate" | "below-z-threshold";
      leadingBucket: PatternBucketKey;
      runnerUpBucket: PatternBucketKey;
      leadingRate: number;
      runnerUpRate: number;
      zScore: number | null;
      buckets: PatternBucket[];
    }
  | {
      cardType: PatternCardKind;
      state: "unavailable";
      minimumMealsPerBucket: number;
      buckets: PatternBucket[];
    };

export type TwoMonthWindow = {
  months: [string, string];
  startDate: string;
  endDate: string;
};

export type TwoMonthReport = {
  status: "progress" | "insufficient" | "ready";
  progressState?: "first-incomplete-month" | "one-completed-month";
  window: TwoMonthWindow;
  totalMeals: number;
  cards: PatternCard[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function datePartsInTimezone(now: Date, timezone: string | null | undefined): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    return {
      year: Number(parts.find(part => part.type === "year")?.value),
      month: Number(parts.find(part => part.type === "month")?.value),
    };
  } catch {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
}

function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + offset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getLatestTwoCompletedMonths(
  now: Date,
  timezone: string | null | undefined,
): TwoMonthWindow {
  const current = datePartsInTimezone(now, timezone);
  const older = shiftMonth(current.year, current.month, -2);
  const newer = shiftMonth(current.year, current.month, -1);
  return {
    months: [monthKey(older.year, older.month), monthKey(newer.year, newer.month)],
    startDate: `${monthKey(older.year, older.month)}-01`,
    endDate: `${monthKey(newer.year, newer.month)}-${pad(lastDayOfMonth(newer.year, newer.month))}`,
  };
}

export function getMonthlyReportFinalLabel(
  meal: TwoMonthMeal,
  glucoseGroup: GlucoseGroup | null,
  personalisedThresholds?: PersonalisedThresholds,
): ImpactLabel {
  const reading = meal.hstix;
  if (
    reading &&
    reading.mealTimingConfidence === "on_time" &&
    Number.isFinite(reading.glucoseMmol)
  ) {
    // HStix handling elsewhere uses Healthy as the safe phase-one default
    // until a profile selects T2DM. Do the same here so valid measured data
    // never silently loses precedence to an AI label.
    return classifyPostMealMmol(reading.glucoseMmol, glucoseGroup === "t2dm" ? "t2dm" : "healthy", personalisedThresholds);
  }
  return meal.glucoseImpact === "low" || meal.glucoseImpact === "medium" || meal.glucoseImpact === "high"
    ? meal.glucoseImpact
    : null;
}

function weekdayFromLocalDate(localDate: string): typeof WEEKDAY_BUCKETS[number] {
  const day = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  return WEEKDAY_BUCKETS[day === 0 ? 6 : day - 1];
}

function initialCounts(keys: readonly PatternBucketKey[]): Map<PatternBucketKey, { totalMeals: number; higherImpactMeals: number }> {
  return new Map(keys.map(key => [key, { totalMeals: 0, higherImpactMeals: 0 }]));
}

function toBuckets(
  keys: readonly PatternBucketKey[],
  counts: Map<PatternBucketKey, { totalMeals: number; higherImpactMeals: number }>,
  minimumMeals: number,
): PatternBucket[] {
  return keys.map(key => {
    const count = counts.get(key) ?? { totalMeals: 0, higherImpactMeals: 0 };
    return {
      key,
      totalMeals: count.totalMeals,
      higherImpactMeals: count.higherImpactMeals,
      higherImpactRate: count.totalMeals === 0 ? 0 : count.higherImpactMeals / count.totalMeals,
      eligible: count.totalMeals >= minimumMeals,
    };
  });
}

function displayOrder(key: PatternBucketKey): number {
  return [...MEALTIME_BUCKETS, ...WEEKDAY_BUCKETS, "weekday", "weekend"].indexOf(key);
}

function selectLeadingBuckets(buckets: PatternBucket[]): [PatternBucket, PatternBucket] | null {
  const eligible = buckets.filter(bucket => bucket.eligible);
  if (eligible.length < 2) return null;
  eligible.sort((a, b) =>
    b.higherImpactRate - a.higherImpactRate ||
    b.totalMeals - a.totalMeals ||
    displayOrder(a.key) - displayOrder(b.key),
  );
  return [eligible[0], eligible[1]];
}

export function evaluatePatternComparison(
  cardType: PatternCardKind,
  buckets: PatternBucket[],
  minimumMealsPerBucket: number,
  pair?: [PatternBucket, PatternBucket],
): PatternCard {
  const selected = pair ?? selectLeadingBuckets(buckets);
  if (!selected) {
    return { cardType, state: "unavailable", minimumMealsPerBucket, buckets };
  }

  let [leading, runnerUp] = selected;
  // The direct weekday/weekend comparison does not rank buckets; only orient
  // the pair for its observed, higher-rate result after eligibility is known.
  if (pair && runnerUp.higherImpactRate > leading.higherImpactRate) {
    [leading, runnerUp] = [runnerUp, leading];
  }
  const difference = leading.higherImpactRate - runnerUp.higherImpactRate;
  if (Math.abs(difference) < RATE_EQUALITY_TOLERANCE) {
    return {
      cardType,
      state: "neutral",
      neutralReason: "equal-rate",
      leadingBucket: leading.key,
      runnerUpBucket: runnerUp.key,
      leadingRate: leading.higherImpactRate,
      runnerUpRate: runnerUp.higherImpactRate,
      zScore: null,
      buckets,
    };
  }

  const pooledRate = (leading.higherImpactMeals + runnerUp.higherImpactMeals) /
    (leading.totalMeals + runnerUp.totalMeals);
  const standardError = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / leading.totalMeals + 1 / runnerUp.totalMeals),
  );
  if (!Number.isFinite(standardError) || standardError <= 0 || !(leading.higherImpactRate > runnerUp.higherImpactRate)) {
    return {
      cardType,
      state: "neutral",
      neutralReason: "below-z-threshold",
      leadingBucket: leading.key,
      runnerUpBucket: runnerUp.key,
      leadingRate: leading.higherImpactRate,
      runnerUpRate: runnerUp.higherImpactRate,
      zScore: null,
      buckets,
    };
  }
  const zScore = difference / standardError;
  if (!Number.isFinite(zScore) || zScore < Z_SCORE_GUARDRAIL) {
    return {
      cardType,
      state: "neutral",
      neutralReason: "below-z-threshold",
      leadingBucket: leading.key,
      runnerUpBucket: runnerUp.key,
      leadingRate: leading.higherImpactRate,
      runnerUpRate: runnerUp.higherImpactRate,
      zScore: Number.isFinite(zScore) ? zScore : null,
      buckets,
    };
  }
  return {
    cardType,
    state: "named",
    leadingBucket: leading.key,
    runnerUpBucket: runnerUp.key,
    leadingRate: leading.higherImpactRate,
    runnerUpRate: runnerUp.higherImpactRate,
    zScore,
    buckets,
  };
}

export function buildTwoMonthReport(input: {
  now: Date;
  timezone: string | null | undefined;
  firstMealLocalDate: string | null;
  meals: TwoMonthMeal[];
  glucoseGroup: GlucoseGroup | null;
  personalisedThresholds?: PersonalisedThresholds;
}): TwoMonthReport {
  const window = getLatestTwoCompletedMonths(input.now, input.timezone);
  const firstMealMonth = input.firstMealLocalDate?.slice(0, 7) ?? null;
  const [olderMonth, newerMonth] = window.months;
  if (!firstMealMonth || firstMealMonth > newerMonth) {
    return {
      status: "progress",
      progressState: "first-incomplete-month",
      window,
      totalMeals: input.meals.length,
      cards: [],
    };
  }
  if (firstMealMonth === newerMonth) {
    return {
      status: "progress",
      progressState: "one-completed-month",
      window,
      totalMeals: input.meals.length,
      cards: [],
    };
  }

  const mealCounts = initialCounts(MEALTIME_BUCKETS);
  const weekdayCounts = initialCounts(WEEKDAY_BUCKETS);
  const weekPartCounts = initialCounts(["weekday", "weekend"]);

  for (const meal of input.meals) {
    const finalLabel = getMonthlyReportFinalLabel(meal, input.glucoseGroup, input.personalisedThresholds);
    const higherImpact = isHigherImpactGlucoseImpact(finalLabel);
    const mealBucket = MEALTIME_BUCKETS.find(key => key === meal.mealType);
    if (mealBucket) {
      const current = mealCounts.get(mealBucket)!;
      current.totalMeals += 1;
      if (higherImpact) current.higherImpactMeals += 1;
    }

    const weekday = weekdayFromLocalDate(meal.localDate);
    const weekdayCurrent = weekdayCounts.get(weekday)!;
    weekdayCurrent.totalMeals += 1;
    if (higherImpact) weekdayCurrent.higherImpactMeals += 1;

    const part = weekday === "saturday" || weekday === "sunday" ? "weekend" : "weekday";
    const weekPartCurrent = weekPartCounts.get(part)!;
    weekPartCurrent.totalMeals += 1;
    if (higherImpact) weekPartCurrent.higherImpactMeals += 1;
  }

  const mealtimeBuckets = toBuckets(MEALTIME_BUCKETS, mealCounts, MIN_MEALS_PER_MEALTIME_BUCKET);
  const weekdayBuckets = toBuckets(WEEKDAY_BUCKETS, weekdayCounts, MIN_MEALS_PER_WEEKDAY_BUCKET);
  const weekPartBuckets = [
    ...toBuckets(["weekday"], weekPartCounts, MIN_MEALS_PER_WEEKDAY_PART_BUCKET),
    ...toBuckets(["weekend"], weekPartCounts, MIN_MEALS_PER_WEEKEND_BUCKET),
  ];
  const cards: PatternCard[] = [
    evaluatePatternComparison("mealtime", mealtimeBuckets, MIN_MEALS_PER_MEALTIME_BUCKET),
    evaluatePatternComparison("weekday", weekdayBuckets, MIN_MEALS_PER_WEEKDAY_BUCKET),
    evaluatePatternComparison(
      "weekday-weekend",
      weekPartBuckets,
      MIN_MEALS_PER_WEEKEND_BUCKET,
      weekPartBuckets[0].eligible && weekPartBuckets[1].eligible ? [weekPartBuckets[0], weekPartBuckets[1]] : undefined,
    ),
  ];
  return {
    status: cards.some(card => card.state !== "unavailable") ? "ready" : "insufficient",
    window,
    totalMeals: input.meals.length,
    cards,
  };
}