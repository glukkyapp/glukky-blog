import { pool } from "../server/db";
import { prepareFoodItems } from "../server/carb-subtypes";
import {
  PHASE1_THRESHOLDS,
  classifyPostMealMmol,
  type GlucoseGroup,
  type PersonalisedThresholds,
} from "../server/glucose-thresholds";
import {
  buildGeneralGlucosePatternComponents,
  buildHstixFoodCards,
  buildHstixFoodsNeedingMoreReadings,
  filterEligibleHstixMeals,
  isReliableHstixFoodEvidence,
  type HstixMealForCards,
} from "../server/glucose-patterns";
import {
  buildTwoMonthReport,
  getLatestTwoCompletedMonths,
  getMonthlyReportFinalLabel,
  type TwoMonthWindow,
} from "../server/two-month-report";

const TARGET_EMAIL = "glucosetest@gmail.com";
const TARGET_PROFILE_NAME = "gtest";
const SEED_SOURCE = "seed_test_data";
const BATCH_ID = "glucosetest-glucose-patterns-v2";
const LABEL_PREFIX = `${SEED_SOURCE}-${BATCH_ID}-`;
const GENERAL_MINIMUMS: Record<string, number> = {
  "白飯": 10,
  "米粉": 5,
  "多士": 3,
  "蕃薯": 2,
  "奶茶": 6,
};
const GENERAL_NEGATIVE_CONTROLS = ["牛肉", "西蘭花"] as const;

type Timing = "on_time" | "delayed" | "unrelated";
type Impact = "low" | "medium" | "high";
type Phase =
  | "daily"
  | "bimonthly"
  | "general"
  | "white-rice"
  | "white-rice-absent"
  | "noisy-rice-noodles"
  | "medium-lift"
  | "partner-index"
  | "milk-tea"
  | "milk-tea-absent";

type FoodDefinition = {
  slug: string;
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
};

type SeedMeal = {
  phase: Phase;
  foods: FoodDefinition[];
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  impact: Impact;
  timing: Timing;
  localDate: string;
  snapTime: Date;
  includeHstix: boolean;
  glucoseMmol: number | null;
  note?: string;
};

type Target = {
  userId: string;
  email: string;
  profileName: string | null;
  group: GlucoseGroup;
  timezone: string;
  thresholds: PersonalisedThresholds | undefined;
};

type Plan = {
  meals: SeedMeal[];
  runtimeNow: Date;
  window: TwoMonthWindow;
  dailyDates: string[];
  reportMeals: SeedMeal[];
};

const FOODS: Record<string, FoodDefinition> = {
  whiteRice: { slug: "white-rice", nameEn: "white rice", nameZhHant: "白飯", nameYue: "白飯" },
  riceNoodles: { slug: "rice-noodles", nameEn: "rice noodles", nameZhHant: "米粉", nameYue: "米粉" },
  riceVermicelli: { slug: "rice-vermicelli", nameEn: "rice vermicelli", nameZhHant: "米線", nameYue: "米線" },
  toast: { slug: "toast", nameEn: "toast", nameZhHant: "多士", nameYue: "多士" },
  sweetPotato: { slug: "sweet-potato", nameEn: "sweet potato", nameZhHant: "蕃薯", nameYue: "蕃薯" },
  milkTea: { slug: "milk-tea", nameEn: "milk tea", nameZhHant: "奶茶", nameYue: "奶茶" },
  beef: { slug: "beef", nameEn: "beef", nameZhHant: "牛肉", nameYue: "牛肉" },
  broccoli: { slug: "broccoli", nameEn: "broccoli", nameZhHant: "西蘭花", nameYue: "西蘭花" },
  chicken: { slug: "chicken-breast", nameEn: "chicken breast", nameZhHant: "雞胸肉", nameYue: "雞胸肉" },
  vegetables: { slug: "vegetable-bun", nameEn: "vegetable bun", nameZhHant: "菜", nameYue: "菜" },
  charSiu: { slug: "char-siu-bun", nameEn: "char siu bun", nameZhHant: "叉燒", nameYue: "叉燒" },
  roastPork: { slug: "roast-pork-bun", nameEn: "roast pork bun", nameZhHant: "燒肉", nameYue: "燒肉" },
  friedRice: { slug: "fried-rice", nameEn: "fried rice", nameZhHant: "炒飯", nameYue: "炒飯" },
  cheungFun: { slug: "cheung-fun", nameEn: "cheung fun", nameZhHant: "腸粉", nameYue: "腸粉" },
  steamedFish: { slug: "steamed-fish", nameEn: "steamed fish", nameZhHant: "蒸魚", nameYue: "蒸魚" },
  steamedRibs: { slug: "steamed-ribs", nameEn: "steamed ribs", nameZhHant: "蒸排骨", nameYue: "蒸排骨" },
  oatmeal: { slug: "oatmeal", nameEn: "oatmeal", nameZhHant: "燕麥", nameYue: "燕麥" },
  tofu: { slug: "tofu", nameEn: "tofu", nameZhHant: "豆腐", nameYue: "豆腐" },
};

const IMPACT_VALUES: Record<GlucoseGroup, Record<Impact, number[]>> = {
  healthy: {
    low: [4.6, 5.0, 5.4, 5.7],
    medium: [6.2, 6.6, 7.0, 7.4],
    high: [8.0, 8.4, 8.8, 9.2],
  },
  t2dm: {
    low: [5.2, 6.0, 6.8, 7.2],
    medium: [7.8, 8.4, 9.0, 9.6],
    high: [10.2, 10.8, 11.6, 12.4],
  },
};

function usage(): never {
  console.error("Usage: tsx scripts/seed-glucose-pattern-test-data.ts --seed|--cleanup");
  process.exit(2);
}

function parseMode(): "seed" | "cleanup" {
  const mode = process.argv[2];
  if (mode === "--seed") return "seed";
  if (mode === "--cleanup") return "cleanup";
  return usage();
}

function assertDevelopmentOnly(): void {
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
    throw new Error("Refusing to run unless NODE_ENV is explicitly development or test");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the development seed");
  }
}

function datePartsInTimezone(now: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateFromNow(now: Date, timezone: string, dayOffset: number): string {
  const parts = datePartsInTimezone(now, timezone);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - dayOffset);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function localHour(date: Date, timezone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
}

function localDateAtTime(localDate: string, timezone: string, hour: number, minute = 0): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  // Start with the desired wall-clock value as if it were UTC, then correct by
  // the timezone's displayed wall-clock value. This handles DST transitions
  // without hardcoding Hong Kong or any other offset.
  let result = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  for (let i = 0; i < 3; i++) {
    const displayed = datePartsInTimezone(result, timezone);
    const displayedDate = new Date(Date.UTC(
      displayed.year,
      displayed.month - 1,
      displayed.day,
      Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(result)),
      Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, minute: "2-digit" }).format(result)),
    ));
    const desired = new Date(Date.UTC(year, month - 1, day, hour, minute));
    result = new Date(result.getTime() + desired.getTime() - displayedDate.getTime());
  }
  return result;
}

function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    if (cursor === endDate) break;
    cursor = shiftLocalDate(cursor, 1);
  }
  return dates;
}

function weekday(localDate: string): number {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const canonicalItemCache = new Map<string, ReturnType<typeof prepareFoodItems>>();

function canonicalItems(foods: FoodDefinition[]) {
  const cacheKey = foods.map(food => food.slug).join("+");
  const cached = canonicalItemCache.get(cacheKey);
  if (cached) return cached;
  const items = prepareFoodItems(foods.map(food => ({
    nameEn: food.nameEn,
    nameZhHant: food.nameZhHant,
    nameYue: food.nameYue,
  })));
  if (items.length !== foods.length || items.some(item => item.carbSubtype !== null || item.subtypeConfirmed !== false)) {
    throw new Error(`Invalid canonical food metadata for ${foods.map(food => food.slug).join(",")}`);
  }
  canonicalItemCache.set(cacheKey, items);
  return items;
}

function comboKey(foods: FoodDefinition[]): string {
  return `${LABEL_PREFIX}${foods.map(food => food.slug).join("+")}`;
}

function stableFloat(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeDatabaseDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  throw new Error(`Invalid database date value: ${String(value)}`);
}

function valueFor(group: GlucoseGroup, impact: Impact, index: number): number {
  const values = IMPACT_VALUES[group][impact];
  return values[index % values.length];
}

function impactForValue(group: GlucoseGroup, value: number, thresholds?: PersonalisedThresholds): Impact {
  return classifyPostMealMmol(value, group, thresholds ?? PHASE1_THRESHOLDS[group]);
}

function reportLabelForMeal(
  meal: SeedMeal,
  target: Target,
): "low" | "medium" | "high" | null {
  return getMonthlyReportFinalLabel({
    id: 0,
    localDate: meal.localDate,
    mealType: meal.mealType,
    glucoseImpact: meal.impact,
    hstix: meal.includeHstix && meal.glucoseMmol !== null
      ? { glucoseMmol: meal.glucoseMmol, mealTimingConfidence: meal.timing }
      : null,
  }, target.group, target.thresholds);
}

function addMeal(
  meals: SeedMeal[],
  target: Target,
  args: {
    phase: Phase;
    foods: FoodDefinition[];
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    impact: Impact;
    timing?: Timing;
    localDate: string;
    hour: number;
    minute?: number;
    includeHstix?: boolean;
    note?: string;
  },
): void {
  const includeHstix = args.includeHstix === true;
  const glucoseMmol = includeHstix ? stableFloat(valueFor(target.group, args.impact, meals.length)) : null;
  if (includeHstix && impactForValue(target.group, glucoseMmol!, PHASE1_THRESHOLDS[target.group]) !== args.impact) {
    throw new Error(`Fixture value for ${args.phase} did not classify as ${args.impact}`);
  }
  meals.push({
    phase: args.phase,
    foods: args.foods,
    mealType: args.mealType,
    impact: args.impact,
    timing: args.timing ?? "on_time",
    localDate: args.localDate,
    snapTime: localDateAtTime(args.localDate, target.timezone, args.hour, args.minute ?? 0),
    includeHstix,
    glucoseMmol,
    note: args.note,
  });
}

function selectDates(
  dates: string[],
  predicate: (date: string) => boolean,
  count: number,
  startIndex: number,
): string[] {
  const eligible = dates.filter(predicate);
  if (eligible.length === 0) throw new Error("No eligible calendar dates in the runtime two-month window");
  return Array.from({ length: count }, (_, index) => eligible[(startIndex + index * 3) % eligible.length]);
}

function makeBimonthlyMeals(target: Target, window: TwoMonthWindow): SeedMeal[] {
  const dates = enumerateDates(window.startDate, window.endDate);
  const meals: SeedMeal[] = [];
  const addSeries = (
    phase: Phase,
    food: FoodDefinition,
    predicate: (date: string) => boolean,
    count: number,
    impacts: Impact[],
    hour: number,
    startIndex: number,
    mealType: "breakfast" | "lunch" | "dinner",
    note: string,
  ) => {
    selectDates(dates, predicate, count, startIndex).forEach((date, index) => {
      addMeal(meals, target, {
        phase,
        foods: [food],
        mealType,
        impact: impacts[index % impacts.length],
        localDate: date,
        hour,
        minute: (index * 7) % 50,
        note,
      });
    });
  };
  const weekdayDate = (date: string) => weekday(date) >= 1 && weekday(date) <= 5;
  const weekendDate = (date: string) => weekday(date) === 0 || weekday(date) === 6;

  // The report cohort is intentionally separate from the current-month HStix
  // cohort, so measured card volume cannot alter the bimonthly percentages.
  addSeries(
    "bimonthly",
    FOODS.friedRice,
    date => weekendDate(date),
    30,
    [...Array.from({ length: 23 }, () => "high" as Impact), ...Array.from({ length: 7 }, () => "low" as Impact)],
    19,
    0,
    "dinner",
    "30 weekend dinners: 23 high, 7 non-high",
  );
  addSeries(
    "bimonthly",
    FOODS.steamedFish,
    date => weekdayDate(date),
    30,
    [...Array.from({ length: 7 }, () => "high" as Impact), ...Array.from({ length: 23 }, () => "low" as Impact)],
    19,
    1,
    "dinner",
    "30 weekday dinners: 7 high, 23 non-high",
  );
  addSeries(
    "bimonthly",
    FOODS.cheungFun,
    date => weekdayDate(date),
    15,
    [...Array.from({ length: 6 }, () => "high" as Impact), ...Array.from({ length: 9 }, () => "medium" as Impact)],
    13,
    2,
    "lunch",
    "15 weekday lunches: 6 high",
  );
  addSeries(
    "bimonthly",
    FOODS.steamedRibs,
    date => weekendDate(date),
    15,
    [...Array.from({ length: 6 }, () => "high" as Impact), ...Array.from({ length: 9 }, () => "medium" as Impact)],
    13,
    3,
    "lunch",
    "15 weekend lunches: 6 high",
  );
  addSeries(
    "bimonthly",
    FOODS.oatmeal,
    date => weekdayDate(date),
    12,
    Array.from({ length: 12 }, (_, index) => index % 4 === 0 ? "medium" : "low"),
    8,
    4,
    "breakfast",
    "Exactly 12 weekday breakfasts above the mealtime floor",
  );
  addSeries(
    "bimonthly",
    FOODS.toast,
    date => weekdayDate(date),
    12,
    Array.from({ length: 12 }, (_, index) => index % 3 === 0 ? "medium" : "low"),
    12,
    5,
    "lunch",
    "Exactly 12 additional weekday lunches above the mealtime floor",
  );
  addSeries(
    "bimonthly",
    FOODS.riceNoodles,
    date => weekendDate(date),
    12,
    Array.from({ length: 12 }, (_, index) => index % 3 === 0 ? "medium" : "low"),
    13,
    6,
    "lunch",
    "Exactly 12 additional weekend lunches above the weekday-part floor",
  );
  addSeries(
    "bimonthly",
    FOODS.sweetPotato,
    date => weekendDate(date),
    3,
    ["low", "low", "medium"],
    8,
    7,
    "breakfast",
    "Exactly three weekend breakfasts for insufficient-data coverage",
  );
  return meals;
}

function makeDailyMeals(target: Target, now: Date): { meals: SeedMeal[]; dates: string[] } {
  const dates = Array.from({ length: 7 }, (_, index) => localDateFromNow(now, target.timezone, 6 - index));
  const meals: SeedMeal[] = [];
  const addDaily = (
    dayIndex: number,
    foods: FoodDefinition[],
    impact: Impact,
    mealType: "breakfast" | "lunch" | "dinner" | "snack",
    hour: number,
    minute = 0,
  ) => addMeal(meals, target, {
    phase: "daily",
    foods,
    mealType,
    impact,
    localDate: dates[dayIndex],
    hour,
    minute,
    note: `Daily report day ${dayIndex + 1} ${mealType}`,
  });

  addDaily(0, [FOODS.chicken], "low", "breakfast", 8);
  addDaily(0, [FOODS.beef], "low", "lunch", 13);
  addDaily(0, [FOODS.broccoli], "low", "dinner", 19);
  addDaily(1, [FOODS.chicken], "low", "breakfast", 8);
  addDaily(1, [FOODS.beef], "low", "lunch", 13);
  addDaily(1, [FOODS.friedRice], "high", "dinner", 19);
  addDaily(2, [FOODS.chicken], "low", "breakfast", 8);
  addDaily(2, [FOODS.friedRice], "high", "lunch", 13);
  addDaily(2, [FOODS.charSiu], "high", "dinner", 19);
  addDaily(3, [FOODS.chicken], "low", "breakfast", 8);
  addDaily(3, [FOODS.beef], "low", "lunch", 13);
  addDaily(3, [FOODS.broccoli], "low", "dinner", 19);
  addDaily(3, [FOODS.milkTea], "medium", "snack", 22, 30);
  addDaily(4, [FOODS.chicken], "low", "breakfast", 11, 30);
  addDaily(4, [FOODS.beef], "low", "lunch", 13);
  addDaily(4, [FOODS.broccoli], "low", "dinner", 19);
  // Day 6 intentionally has zero rows.
  addDaily(6, [FOODS.chicken], "low", "dinner", 19);
  return { meals, dates };
}

function currentMonthFixtureDate(target: Target, now: Date, index: number): string {
  const today = datePartsInTimezone(now, target.timezone);
  // Keep measured card fixtures in the current month and away from the seven
  // daily-report dates whenever the calendar provides enough days.
  const earliestDay = 1;
  const latestDay = Math.max(earliestDay, today.day - 8);
  const day = earliestDay + (index % (latestDay - earliestDay + 1));
  return formatDate(today.year, today.month, day);
}

function makeHstixMeals(target: Target, now: Date): SeedMeal[] {
  const meals: SeedMeal[] = [];
  const addMeasuredSeries = (
    phase: Phase,
    foodsForIndex: (index: number) => FoodDefinition[],
    count: number,
    impacts: Impact[],
    note: string,
  ) => {
    for (let index = 0; index < count; index++) {
      const localDate = currentMonthFixtureDate(target, now, meals.length);
      addMeal(meals, target, {
        phase,
        foods: foodsForIndex(index),
        mealType: (["breakfast", "lunch", "dinner"] as const)[index % 3],
        impact: impacts[index % impacts.length],
        localDate,
        hour: 7 + (index % 13),
        minute: (index * 11) % 60,
        includeHstix: true,
        note,
      });
    }
  };

  addMeasuredSeries(
    "white-rice",
    index => index < 22 ? [FOODS.whiteRice, FOODS.charSiu] : [FOODS.whiteRice],
    30,
    [...Array.from({ length: 23 }, () => "high" as Impact), ...Array.from({ length: 7 }, () => "low" as Impact)],
    "30 on-time white-rice meals; char siu paired in 22",
  );
  addMeasuredSeries(
    "white-rice-absent",
    index => index % 2 === 0 ? [FOODS.toast] : [FOODS.sweetPotato],
    38,
    [...Array.from({ length: 8 }, () => "high" as Impact), ...Array.from({ length: 30 }, () => "low" as Impact)],
    "38 meals without white rice; 8 high",
  );
  addMeasuredSeries(
    "noisy-rice-noodles",
    () => [FOODS.riceVermicelli],
    26,
    [...Array.from({ length: 16 }, () => "high" as Impact), ...Array.from({ length: 10 }, () => "low" as Impact)],
    "26 noisy rice-vermicelli readings; reliability must fail",
  );
  addMeasuredSeries(
    "medium-lift",
    () => [FOODS.oatmeal],
    25,
    [
      ...Array.from({ length: 6 }, () => "high" as Impact),
      ...Array.from({ length: 10 }, () => "medium" as Impact),
      ...Array.from({ length: 9 }, () => "low" as Impact),
    ],
    "25 medium-lift oatmeal readings",
  );
  addMeasuredSeries(
    "partner-index",
    index => index < 10
      ? [FOODS.riceNoodles, FOODS.roastPork]
      : index < 19
        ? [FOODS.riceNoodles, FOODS.vegetables]
        : [FOODS.riceNoodles],
    30,
    [
      ...Array.from({ length: 10 }, () => "high" as Impact),
      ...Array.from({ length: 9 }, () => "low" as Impact),
      ...Array.from({ length: 11 }, () => "high" as Impact),
    ],
    "Rice-noodle partner comparison: roast pork 10, vegetables 9",
  );
  addMeasuredSeries(
    "milk-tea",
    () => [FOODS.milkTea],
    26,
    [...Array.from({ length: 13 }, () => "high" as Impact), ...Array.from({ length: 13 }, () => "low" as Impact)],
    "26 milk-tea readings",
  );
  addMeasuredSeries(
    "milk-tea-absent",
    () => [FOODS.friedRice],
    26,
    [...Array.from({ length: 6 }, () => "high" as Impact), ...Array.from({ length: 20 }, () => "low" as Impact)],
    "26 eligible meals without milk tea",
  );
  return meals;
}

function makeGeneralOnlyMeals(target: Target, now: Date): SeedMeal[] {
  const meals: SeedMeal[] = [];
  const definitions: Array<[FoodDefinition, number]> = [
    [FOODS.whiteRice, 10],
    [FOODS.riceNoodles, 5],
    [FOODS.toast, 3],
    [FOODS.sweetPotato, 2],
    [FOODS.milkTea, 6],
    [FOODS.beef, 4],
    [FOODS.broccoli, 4],
  ];
  for (const [food, count] of definitions) {
    for (let index = 0; index < count; index++) {
      addMeal(meals, target, {
        phase: "general",
        // One duplicated 白飯 item proves General frequency counts components
        // once per meal rather than once per array entry.
        foods: food === FOODS.whiteRice && index === 0 ? [food, food] : [food],
        mealType: (["breakfast", "lunch", "dinner"] as const)[index % 3],
        impact: "low",
        localDate: currentMonthFixtureDate(target, now, meals.length + 100),
        hour: 9 + (index % 8),
        minute: (index * 5) % 60,
        note: `General frequency minimum for ${food.nameZhHant}`,
      });
    }
  }
  return meals;
}

function buildPlan(target: Target, now: Date): Plan {
  // This is intentionally the same helper and argument shape as the live
  // /api/snap/two-month-summary route. Never replace this with fixed months.
  const window = getLatestTwoCompletedMonths(now, target.timezone);
  const daily = makeDailyMeals(target, now);
  const reportMeals = makeBimonthlyMeals(target, window);
  const measured = makeHstixMeals(target, now);
  const generalOnly = makeGeneralOnlyMeals(target, now);
  const meals = [...daily.meals, ...reportMeals, ...measured, ...generalOnly];
  if (meals.length !== 381) {
    throw new Error(`Unexpected planned meal count: ${meals.length}; expected 381`);
  }
  return { meals, runtimeNow: now, window, dailyDates: daily.dates, reportMeals };
}

async function findTarget(client: any): Promise<Target> {
  const result = await client.query(
    `SELECT u.id AS user_id, u.email, up.name, up.glucose_group, up.health_condition,
            up.device_timezone, ugt.low_med_boundary, ugt.med_high_boundary
       FROM users u
       JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN user_glucose_thresholds ugt ON ugt.user_id = u.id AND ugt.is_deleted = false
      WHERE lower(u.email) = lower($1)`,
    [TARGET_EMAIL],
  );
  if (result.rows.length !== 1) {
    throw new Error(`Expected exactly one development account for ${TARGET_EMAIL}; found ${result.rows.length}`);
  }
  const row = result.rows[0];
  if (String(row.email).toLowerCase() !== TARGET_EMAIL || row.name !== TARGET_PROFILE_NAME) {
    throw new Error(`Resolved account did not match ${TARGET_PROFILE_NAME} <${TARGET_EMAIL}>`);
  }
  const thresholds = Number.isFinite(Number(row.low_med_boundary)) && Number.isFinite(Number(row.med_high_boundary))
    && row.low_med_boundary !== null && row.med_high_boundary !== null
    ? {
        lowMedBoundary: Number(row.low_med_boundary),
        medHighBoundary: Number(row.med_high_boundary),
      }
    : undefined;
  return {
    userId: row.user_id,
    email: row.email,
    profileName: row.name,
    group: row.glucose_group === "t2dm" ? "t2dm" : "healthy",
    timezone: row.device_timezone || "UTC",
    thresholds,
  };
}

async function countRows(client: any, table: string, userId: string): Promise<number> {
  const allowed = new Set([
    "meal_snaps",
    "hstix_readings",
    "snap_report_meal_facts",
    "snap_report_user_metadata",
    "snap_daily_glucose",
    "snap_monthly_archive",
    "meal_snap_health_history",
    "piggy_bank_events",
  ]);
  if (!allowed.has(table)) throw new Error(`Refusing count on unapproved table ${table}`);
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id = $1`, [userId]);
  return Number(result.rows[0].count);
}

async function printCounts(client: any, target: Target, label: string): Promise<Record<string, number>> {
  const tables = [
    "meal_snaps",
    "hstix_readings",
    "snap_report_meal_facts",
    "snap_report_user_metadata",
    "snap_daily_glucose",
    "snap_monthly_archive",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) counts[table] = await countRows(client, table, target.userId);
  console.log(JSON.stringify({ label, environment: process.env.NODE_ENV ?? "unset", target, counts }, null, 2));
  return counts;
}

async function resetTargetRows(client: any, target: Target): Promise<void> {
  // HStix has a meal_snap_id association, so its rows are deliberately removed
  // before meal_snaps. All predicates remain account-scoped.
  await client.query(`DELETE FROM hstix_readings WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM snap_report_meal_facts WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM snap_report_user_metadata WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM snap_daily_glucose WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM snap_monthly_archive WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM meal_snap_health_history WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM meal_snaps WHERE user_id = $1`, [target.userId]);
  await client.query(`DELETE FROM piggy_bank_events WHERE user_id = $1`, [target.userId]);
}

async function insertFoodLabels(client: any, meals: SeedMeal[]): Promise<string[]> {
  const combos = new Map<string, FoodDefinition[]>();
  for (const meal of meals) combos.set(comboKey(meal.foods), meal.foods);
  const created: string[] = [];
  for (const [key, foods] of combos) {
    const items = canonicalItems(foods);
    const result = await client.query(
      `INSERT INTO food_labels
        (internal_id, food_name_en, food_name_zh_hant, food_name_yue, default_portion_id,
         default_sauces, default_toppings, food_items)
       VALUES ($1, $2, $3, $4, 'medium', '{}', '{}', $5::jsonb)
       ON CONFLICT (internal_id) DO NOTHING
       RETURNING internal_id`,
      [
        key,
        foods.map(food => food.nameEn).join(" + "),
        foods.map(food => food.nameZhHant).join(" + "),
        foods.map(food => food.nameYue).join(" + "),
        JSON.stringify(items),
      ],
    );
    if (result.rows.length === 1) created.push(key);
  }
  return created;
}

async function insertDerivedRows(
  client: any,
  target: Target,
  plan: Plan,
  insertedIds: Array<{ meal: SeedMeal; id: number }>,
): Promise<void> {
  let firstDate: string | null = null;
  for (const { meal, id } of insertedIds) {
    const finalImpact = reportLabelForMeal(meal, target);
    await client.query(
      `INSERT INTO snap_report_meal_facts
        (snap_id, user_id, local_date, meal_type, final_impact)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, target.userId, meal.localDate, meal.mealType, finalImpact],
    );
    if (!firstDate || meal.localDate < firstDate) firstDate = meal.localDate;
  }
  if (firstDate) {
    await client.query(
      `INSERT INTO snap_report_user_metadata (user_id, first_meal_local_date)
       VALUES ($1, $2)`,
      [target.userId, firstDate],
    );
  }

  const dailyCounts = new Map<string, { low: number; medium: number; high: number; mealCount: number; late: boolean }>();
  for (const meal of insertedIds.map(row => row.meal).filter(meal => meal.phase === "daily")) {
    const current = dailyCounts.get(meal.localDate) ?? { low: 0, medium: 0, high: 0, mealCount: 0, late: false };
    current[meal.impact]++;
    current.mealCount++;
    current.late ||= meal.mealType === "snack";
    dailyCounts.set(meal.localDate, current);
  }
  for (const date of plan.dailyDates) {
    const counts = dailyCounts.get(date) ?? { low: 0, medium: 0, high: 0, mealCount: 0, late: false };
    await client.query(
      `INSERT INTO snap_daily_glucose
        (user_id, local_date, low_count, medium_count, high_count, meal_count, has_late_meal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [target.userId, date, counts.low, counts.medium, counts.high, counts.mealCount, counts.late],
    );
  }
}

async function insertMeals(
  client: any,
  target: Target,
  plan: Plan,
): Promise<{ createdLabels: string[]; insertedIds: Array<{ meal: SeedMeal; id: number }> }> {
  const createdLabels = await insertFoodLabels(client, plan.meals);
  const insertedIds: Array<{ meal: SeedMeal; id: number }> = [];
  for (const [index, meal] of plan.meals.entries()) {
    const items = canonicalItems(meal.foods);
    const combo = comboKey(meal.foods);
    const snapResult = await client.query(
      `INSERT INTO meal_snaps
        (user_id, snap_time, local_date, meal_type, food_name, portion, glucose_impact,
         missed_meal_flag, combo_key, food_items, source, seed_batch_id)
       VALUES ($1, $2, $3, $4, $5, 'medium', $6, false, $7, $8::jsonb, $9, $10)
       RETURNING id`,
      [
        target.userId,
        meal.snapTime,
        meal.localDate,
        meal.mealType,
        meal.foods.map(food => food.nameEn).join(" + "),
        meal.impact,
        combo,
        JSON.stringify(items),
        SEED_SOURCE,
        BATCH_ID,
      ],
    );
    const id = Number(snapResult.rows[0].id);
    insertedIds.push({ meal, id });
    if (meal.includeHstix) {
      const minutes = meal.timing === "on_time" ? 60 : meal.timing === "delayed" ? 130 : 300;
      await client.query(
        `INSERT INTO hstix_readings
          (user_id, source, seed_batch_id, meal_snap_id, glucose_mmol, note,
           minutes_since_last_meal, meal_timing_confidence, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          target.userId,
          SEED_SOURCE,
          BATCH_ID,
          id,
          meal.glucoseMmol,
          meal.note ?? `Synthetic ${meal.phase} fixture`,
          minutes,
          meal.timing,
          new Date(meal.snapTime.getTime() + minutes * 60_000),
        ],
      );
    }
    if (index > 0 && index % 100 === 0) console.log(`[seed] inserted ${index}/${plan.meals.length}`);
  }
  await insertDerivedRows(client, target, plan, insertedIds);
  return { createdLabels, insertedIds };
}

async function loadHstixMeals(client: any, userId: string): Promise<HstixMealForCards[]> {
  const result = await client.query(
    `SELECT hr.glucose_mmol, hr.recorded_at, hr.meal_timing_confidence, ms.food_items
       FROM hstix_readings hr
       JOIN meal_snaps ms ON ms.id = hr.meal_snap_id AND ms.user_id = hr.user_id
      WHERE hr.user_id = $1 AND ms.is_deleted = false
      ORDER BY hr.id`,
    [userId],
  );
  return result.rows.map((row: any) => ({
    postMealGlucoseMmol: Number(row.glucose_mmol),
    foodItems: row.food_items ?? null,
    recordedAt: new Date(row.recorded_at),
    mealTimingConfidence: row.meal_timing_confidence,
    isCanonicalHstix: true,
  }));
}

async function verifySeed(
  client: any,
  target: Target,
  plan: Plan,
  insertedIds: Array<{ meal: SeedMeal; id: number }>,
): Promise<Record<string, unknown>> {
  const ids = insertedIds.map(row => row.id);
  const reportIds = insertedIds
    .filter(row => row.meal.phase === "bimonthly")
    .map(row => row.id);
  const outOfWindow = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM meal_snaps
      WHERE user_id = $1 AND seed_batch_id = $2
        AND id = ANY($3::int[])
        AND (local_date < $4 OR local_date > $5)`,
    [target.userId, BATCH_ID, reportIds, plan.window.startDate, plan.window.endDate],
  );
  if (Number(outOfWindow.rows[0].count) !== 0) {
    throw new Error("Seeded bimonthly boundary validation failed");
  }
  const reportCount = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM snap_report_meal_facts
      WHERE user_id = $1 AND snap_id = ANY($2::int[])`,
    [target.userId, ids],
  );
  if (Number(reportCount.rows[0].count) !== plan.meals.length) {
    throw new Error("Not every seeded meal received a report fact");
  }

  const generalRows = await client.query(
    `SELECT food_items FROM meal_snaps WHERE user_id = $1 AND is_deleted = false`,
    [target.userId],
  );
  const general = buildGeneralGlucosePatternComponents(generalRows.rows.map((row: any) => ({
    foodItems: row.food_items ?? null,
  })));
  const generalActual: Record<string, number> = {};
  for (const name of Object.keys(GENERAL_MINIMUMS)) {
    generalActual[name] = general.find(component => component.foodNameZhHant === name)?.mealCount ?? 0;
    if (generalActual[name] < GENERAL_MINIMUMS[name]) {
      throw new Error(`General component ${name} has ${generalActual[name]}, expected at least ${GENERAL_MINIMUMS[name]}`);
    }
  }
  const negativeControlCounts: Record<string, number> = {};
  for (const name of GENERAL_NEGATIVE_CONTROLS) {
    negativeControlCounts[name] = general.find(component => component.foodNameZhHant === name)?.mealCount ?? 0;
    if (negativeControlCounts[name] !== 0) {
      throw new Error(`General negative control ${name} unexpectedly appeared with ${negativeControlCounts[name]} meals`);
    }
  }

  const hstixMeals = await loadHstixMeals(client, target.userId);
  const eligibleHstix = filterEligibleHstixMeals(hstixMeals);
  if (eligibleHstix.length !== 201) {
    throw new Error(`Expected all 201 measured fixtures to be eligible; found ${eligibleHstix.length}`);
  }
  if (eligibleHstix.some(meal =>
    meal.mealTimingConfidence !== "on_time" ||
    meal.foodItems?.some(item => item.source === "derived")
  )) {
    throw new Error("HStix fixtures must be on-time and use non-derived canonical food items");
  }
  const cards = buildHstixFoodCards(hstixMeals, target.group);
  const needsMore = buildHstixFoodsNeedingMoreReadings(hstixMeals);
  const findCard = (name: string) => cards.find(card => card.foodNameZhHant === name);
  const whiteRice = findCard("白飯");
  const milkTea = findCard("奶茶");
  const riceNoodles = findCard("米線");
  const oatmeal = findCard("燕麥");
  const partnerIndex = findCard("米粉");
  if (!whiteRice || whiteRice.totalMeals !== 30 || whiteRice.highMeals !== 23) {
    throw new Error(`White-rice card shape failed: ${JSON.stringify(whiteRice)}`);
  }
  if (
    whiteRice.partnerInsight?.kind !== "dominant" ||
    whiteRice.partnerInsight.partner.foodNameZhHant !== "叉燒"
  ) {
    throw new Error(`White-rice dominant partner failed: ${JSON.stringify(whiteRice.partnerInsight)}`);
  }
  if (!milkTea || milkTea.totalMeals < 25) {
    throw new Error(`Milk-tea card shape failed: ${JSON.stringify(milkTea)}`);
  }
  if (!oatmeal || oatmeal.impactLevel !== "medium") {
    throw new Error(`Medium-lift oatmeal card failed: ${JSON.stringify(oatmeal)}`);
  }
  if (!partnerIndex || partnerIndex.partnerInsight?.kind !== "comparison") {
    throw new Error(`Partner comparison card failed: ${JSON.stringify(partnerIndex)}`);
  }
  if (
    partnerIndex.partnerInsight.higherPartner.foodNameZhHant !== "燒肉" ||
    partnerIndex.partnerInsight.lowerPartner.foodNameZhHant !== "菜"
  ) {
    throw new Error(`Partner comparison direction failed: ${JSON.stringify(partnerIndex.partnerInsight)}`);
  }

  const scoreFor = (meal: HstixMealForCards): number => {
    const impact = classifyPostMealMmol(meal.postMealGlucoseMmol!, target.group);
    return impact === "high" ? 2 : impact === "medium" ? 1 : 0;
  };
  const noisyPresent = eligibleHstix
    .filter(meal => meal.foodItems?.some(item => item.nameZhHant === "米線"))
    .map(scoreFor);
  const noisyAbsent = eligibleHstix
    .filter(meal => !meal.foodItems?.some(item => item.nameZhHant === "米線"))
    .map(scoreFor);
  const noisyReliability = {
    high: isReliableHstixFoodEvidence(noisyPresent, noisyAbsent, "high"),
    low: isReliableHstixFoodEvidence(noisyPresent, noisyAbsent, "low"),
  };
  if (noisyReliability.high || noisyReliability.low) {
    throw new Error(`Noisy 米線 evidence unexpectedly passed reliability: ${JSON.stringify(noisyReliability)}`);
  }
  if (
    noisyPresent.length !== 26 ||
    riceNoodles !== undefined ||
    needsMore.some(food => food.foodNameZhHant === "米線")
  ) {
    throw new Error(
      `Noisy 米線 suppression failed: ${JSON.stringify({
        readings: noisyPresent.length,
        card: riceNoodles,
        needsMore: needsMore.find(food => food.foodNameZhHant === "米線"),
      })}`,
    );
  }

  const facts = await client.query(
    `SELECT snap_id AS id, local_date, meal_type, final_impact AS glucose_impact
       FROM snap_report_meal_facts
      WHERE user_id = $1 AND local_date >= $2 AND local_date <= $3
      ORDER BY local_date, snap_id`,
    [target.userId, plan.window.startDate, plan.window.endDate],
  );
  const report = buildTwoMonthReport({
    now: plan.runtimeNow,
    timezone: target.timezone,
    firstMealLocalDate: plan.window.startDate,
    glucoseGroup: target.group,
    meals: facts.rows.map((row: any) => ({
      id: Number(row.id),
      localDate: normalizeDatabaseDate(row.local_date),
      mealType: row.meal_type,
      glucoseImpact: row.glucose_impact,
      hstix: null,
    })),
  });

  const reportShape = {
    status: report.status,
    window: report.window,
    totalMeals: report.totalMeals,
    cards: report.cards.map(card => ({
      cardType: card.cardType,
      state: card.state,
      buckets: card.buckets.map(bucket => ({
        key: bucket.key,
        totalMeals: bucket.totalMeals,
        higherImpactMeals: bucket.higherImpactMeals,
        eligible: bucket.eligible,
      })),
    })),
  };
  const expectedDailyCounts = [3, 3, 3, 4, 3, 0, 1];
  const dailySummary = plan.dailyDates.map((date, index) => {
    const meals = plan.meals.filter(meal => meal.phase === "daily" && meal.localDate === date);
    const summary = {
      day: index + 1,
      date,
      mealCount: meals.length,
      low: meals.filter(meal => meal.impact === "low").length,
      medium: meals.filter(meal => meal.impact === "medium").length,
      high: meals.filter(meal => meal.impact === "high").length,
      mealTypes: meals.map(meal => meal.mealType),
      localHours: meals.map(meal => localHour(meal.snapTime, target.timezone)),
    };
    if (summary.mealCount !== expectedDailyCounts[index]) {
      throw new Error(`Daily day ${index + 1} has ${summary.mealCount} meals, expected ${expectedDailyCounts[index]}`);
    }
    return summary;
  });
  if (
    dailySummary[0].low !== 3 ||
    dailySummary[1].high !== 1 ||
    dailySummary[2].high !== 2 ||
    !dailySummary[3].mealTypes.includes("snack") ||
    !dailySummary[3].localHours.includes(22) ||
    dailySummary[4].localHours[dailySummary[4].mealTypes.indexOf("breakfast")] !== 11 ||
    dailySummary[5].mealCount !== 0
  ) {
    throw new Error(`Daily scenario validation failed: ${JSON.stringify(dailySummary)}`);
  }

  const reportCohorts = {
    weekendDinners: plan.reportMeals.filter(meal =>
      meal.mealType === "dinner" && (weekday(meal.localDate) === 0 || weekday(meal.localDate) === 6)
    ),
    weekdayDinners: plan.reportMeals.filter(meal =>
      meal.mealType === "dinner" && weekday(meal.localDate) >= 1 && weekday(meal.localDate) <= 5
    ),
    coreWeekdayLunches: plan.reportMeals.filter(meal => meal.note?.startsWith("15 weekday lunches")),
    coreWeekendLunches: plan.reportMeals.filter(meal => meal.note?.startsWith("15 weekend lunches")),
    supplementalWeekdayBreakfasts: plan.reportMeals.filter(meal => meal.note?.startsWith("Exactly 12 weekday breakfasts")),
    supplementalWeekdayLunches: plan.reportMeals.filter(meal => meal.note?.startsWith("Exactly 12 additional weekday lunches")),
    supplementalWeekendLunches: plan.reportMeals.filter(meal => meal.note?.startsWith("Exactly 12 additional weekend lunches")),
    weekendBreakfasts: plan.reportMeals.filter(meal =>
      meal.mealType === "breakfast" && (weekday(meal.localDate) === 0 || weekday(meal.localDate) === 6)
    ),
  };
  const cohortSummary = Object.fromEntries(Object.entries(reportCohorts).map(([name, meals]) => [
    name,
    { total: meals.length, high: meals.filter(meal => meal.impact === "high").length },
  ]));
  if (
    cohortSummary.weekendDinners.total !== 30 || cohortSummary.weekendDinners.high !== 23 ||
    cohortSummary.weekdayDinners.total !== 30 || cohortSummary.weekdayDinners.high !== 7 ||
    cohortSummary.coreWeekdayLunches.total !== 15 || cohortSummary.coreWeekdayLunches.high !== 6 ||
    cohortSummary.coreWeekendLunches.total !== 15 || cohortSummary.coreWeekendLunches.high !== 6 ||
    cohortSummary.supplementalWeekdayBreakfasts.total !== 12 ||
    cohortSummary.supplementalWeekdayLunches.total !== 12 ||
    cohortSummary.supplementalWeekendLunches.total !== 12 ||
    cohortSummary.weekendBreakfasts.total !== 3
  ) {
    throw new Error(`Bimonthly cohort validation failed: ${JSON.stringify(cohortSummary)}`);
  }
  if (
    report.status !== "ready" ||
    report.cards.find(card => card.cardType === "weekday")?.state !== "neutral" ||
    report.cards.find(card => card.cardType === "mealtime")?.buckets.find(bucket => bucket.key === "snack")?.eligible !== false
  ) {
    throw new Error(`Two-month report state validation failed: ${JSON.stringify(reportShape)}`);
  }

  const phaseCounts = Object.fromEntries(
    Array.from(new Set(plan.meals.map(meal => meal.phase))).map(phase => [
      phase,
      plan.meals.filter(meal => meal.phase === phase).length,
    ]),
  );
  const timingCounts = {
    on_time: plan.meals.filter(meal => meal.includeHstix && meal.timing === "on_time").length,
    delayed: plan.meals.filter(meal => meal.includeHstix && meal.timing === "delayed").length,
    unrelated: plan.meals.filter(meal => meal.includeHstix && meal.timing === "unrelated").length,
  };
  const counts = await printCounts(client, target, "after-seed");
  return {
    runtimeWindow: plan.window,
    dailyDates: plan.dailyDates,
    totalPlannedMeals: plan.meals.length,
    reportMealCount: plan.reportMeals.length,
    phaseCounts,
    timingCounts,
    dailySummary,
    bimonthlyCohorts: cohortSummary,
    eligibleHstixMeals: eligibleHstix.length,
    generalMinimums: GENERAL_MINIMUMS,
    generalActual,
    generalCountNote: "Account-wide totals exceed the minimum fixture counts where the same components are required by HStix/report scenarios.",
    generalNegativeControls: negativeControlCounts,
    hstixCards: cards.map(card => ({
      food: card.foodNameZhHant,
      totalMeals: card.totalMeals,
      highMeals: card.highMeals,
      impactLevel: card.impactLevel,
      lift: Number(card.lift.toFixed(3)),
      partnerInsight: card.partnerInsight?.kind ?? null,
    })),
    noisyRiceVermicelliReliability: noisyReliability,
    twoMonthReport: reportShape,
    counts,
  };
}

async function seed(): Promise<void> {
  assertDevelopmentOnly();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await findTarget(client);
    console.log(JSON.stringify({
      action: "seed",
      environment: process.env.NODE_ENV ?? "unset",
      targetEmail: target.email,
      targetProfileName: target.profileName,
      userId: target.userId,
      timezone: target.timezone,
      warning: "This development-only reset deletes this account's existing meal/HStix and derived report rows.",
    }, null, 2));
    await printCounts(client, target, "before-reset");
    await resetTargetRows(client, target);
    const now = new Date();
    const plan = buildPlan(target, now);
    console.log(JSON.stringify({
      runtimeNow: now.toISOString(),
      runtimeTwoMonthWindow: plan.window,
      dailyDates: plan.dailyDates,
      plannedMeals: plan.meals.length,
      plannedHstix: plan.meals.filter(meal => meal.includeHstix).length,
      plannedBimonthlyMeals: plan.reportMeals.length,
    }, null, 2));
    const { createdLabels, insertedIds } = await insertMeals(client, target, plan);
    const verification = await verifySeed(client, target, plan, insertedIds);
    await client.query("COMMIT");
    console.log(JSON.stringify({
      action: "seed-complete",
      targetEmail: target.email,
      batchId: BATCH_ID,
      createdFoodLabelInternalIds: createdLabels,
      verification,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cleanup(): Promise<void> {
  assertDevelopmentOnly();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await findTarget(client);
    console.log(JSON.stringify({
      action: "cleanup",
      environment: process.env.NODE_ENV ?? "unset",
      targetEmail: target.email,
      targetProfileName: target.profileName,
      userId: target.userId,
    }, null, 2));
    const seedMeals = await client.query(
      `SELECT id, combo_key
         FROM meal_snaps
        WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    const ids = seedMeals.rows.map((row: any) => Number(row.id));
    const comboKeys = [...new Set(seedMeals.rows.map((row: any) => row.combo_key).filter(Boolean))] as string[];
    const readings = await client.query(
      `DELETE FROM hstix_readings
        WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    const facts = ids.length === 0
      ? { rowCount: 0 }
      : await client.query(
        `DELETE FROM snap_report_meal_facts WHERE user_id = $1 AND snap_id = ANY($2::int[])`,
        [target.userId, ids],
      );
    const meals = await client.query(
      `DELETE FROM meal_snaps
        WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    const remainingMeals = await countRows(client, "meal_snaps", target.userId);
    const removedLabels: string[] = [];
    for (const key of comboKeys) {
      if (!key.startsWith(LABEL_PREFIX)) continue;
      const refs = await client.query(`SELECT 1 FROM meal_snaps WHERE combo_key = $1 LIMIT 1`, [key]);
      if (refs.rows.length > 0) continue;
      const deleted = await client.query(`DELETE FROM food_labels WHERE internal_id = $1 RETURNING internal_id`, [key]);
      if (deleted.rows.length === 1) removedLabels.push(key);
    }
    if (remainingMeals === 0) {
      await client.query(`DELETE FROM snap_report_user_metadata WHERE user_id = $1`, [target.userId]);
      await client.query(`DELETE FROM snap_daily_glucose WHERE user_id = $1`, [target.userId]);
      await client.query(`DELETE FROM snap_monthly_archive WHERE user_id = $1`, [target.userId]);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      action: "cleanup-complete",
      targetEmail: target.email,
      batchId: BATCH_ID,
      deletedMealSnaps: meals.rowCount ?? 0,
      deletedHstixReadings: readings.rowCount ?? 0,
      deletedReportFacts: facts.rowCount ?? 0,
      deletedFoodLabels: removedLabels,
      retainedFoodLabels: comboKeys.filter(key => !removedLabels.includes(key)),
      remainingMeals,
      derivedCachesCleared: remainingMeals === 0,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const mode = parseMode();
(mode === "seed" ? seed() : cleanup())
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    await pool.end();
    process.exitCode = 1;
  });