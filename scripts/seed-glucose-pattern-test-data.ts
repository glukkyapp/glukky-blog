import { pool } from "../server/db";
import { prepareFoodItems } from "../server/carb-subtypes";
import {
  PHASE1_THRESHOLDS,
  classifyPostMealMmol,
  type GlucoseGroup,
} from "../server/glucose-thresholds";

const TARGET_EMAIL = "glucosetest@gmail.com";
const SEED_SOURCE = "seed_test_data";
const BATCH_ID = "glucosetest-glucose-patterns-v1";
const CARD_MINIMUM = 25;
const NO_SIGNAL_LIFT_MIN = 0.8;
const NO_SIGNAL_LIFT_MAX = 1.2;

type Timing = "on_time" | "delayed" | "unrelated";
type Impact = "low" | "medium" | "high";

type FoodDefinition = {
  slug: string;
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
};

type SeedMeal = {
  category: "baseline" | "clear_signal" | "no_signal" | "below_threshold" | "mixed_timing";
  food: FoodDefinition;
  impact: Impact;
  timing: Timing;
  mealType: "breakfast" | "lunch" | "dinner";
  dayOffset: number;
  timeHour: number;
  value: number;
};

const FOODS: Record<string, FoodDefinition> = {
  whiteRice: { slug: "white-rice", nameEn: "white rice", nameZhHant: "白飯", nameYue: "白飯" },
  chicken: { slug: "chicken-breast", nameEn: "chicken breast", nameZhHant: "雞胸肉", nameYue: "雞胸肉" },
  wholegrainBread: { slug: "wholegrain-bread", nameEn: "wholegrain bread", nameZhHant: "全麥麵包", nameYue: "全麥麵包" },
  oatmeal: { slug: "oatmeal", nameEn: "oatmeal", nameZhHant: "燕麥", nameYue: "燕麥" },
  eggNoodles: { slug: "egg-noodles", nameEn: "egg noodles", nameZhHant: "蛋麵", nameYue: "蛋麵" },
  sweetPotato: { slug: "sweet-potato", nameEn: "sweet potato", nameZhHant: "番薯", nameYue: "番薯" },
  fish: { slug: "fish", nameEn: "fish", nameZhHant: "魚", nameYue: "魚" },
  vegetables: { slug: "vegetables", nameEn: "mixed vegetables", nameZhHant: "雜菜", nameYue: "雜菜" },
  tofu: { slug: "tofu", nameEn: "tofu", nameZhHant: "豆腐", nameYue: "豆腐" },
  beef: { slug: "beef", nameEn: "beef", nameZhHant: "牛肉", nameYue: "牛肉" },
  corn: { slug: "corn", nameEn: "corn", nameZhHant: "粟米", nameYue: "粟米" },
  dumplings: { slug: "dumplings", nameEn: "dumplings", nameZhHant: "餃子", nameYue: "餃子" },
};

const BASELINE_FOODS = [
  FOODS.eggNoodles,
  FOODS.sweetPotato,
  FOODS.fish,
  FOODS.vegetables,
  FOODS.tofu,
  FOODS.beef,
  FOODS.corn,
  FOODS.dumplings,
];

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
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the development seed against NODE_ENV=production");
  }
}

function canonicalItems(food: FoodDefinition) {
  const [item] = prepareFoodItems([{
    nameEn: food.nameEn,
    nameZhHant: food.nameZhHant,
    nameYue: food.nameYue,
  }]);
  if (!item || item.carbSubtype !== null || item.subtypeConfirmed !== false) {
    throw new Error(`Invalid canonical item for ${food.slug}`);
  }
  return [item];
}

function comboKey(food: FoodDefinition): string {
  return `seed-glucose-${food.slug}`;
}

function stableFloat(value: number): number {
  return Math.round(value * 10) / 10;
}

function valueFor(group: GlucoseGroup, impact: Impact, index: number): number {
  const values = IMPACT_VALUES[group][impact];
  return values[index % values.length];
}

function dateForOffset(offset: number, hour: number): Date {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - offset);
  date.setUTCHours(hour, (offset * 13) % 60, 0, 0);
  return date;
}

function mealTypeFor(index: number): "breakfast" | "lunch" | "dinner" {
  return (["breakfast", "lunch", "dinner"] as const)[index % 3];
}

function makeSeedMeals(group: GlucoseGroup): SeedMeal[] {
  const meals: SeedMeal[] = [];
  const add = (
    category: SeedMeal["category"],
    food: FoodDefinition,
    impacts: Impact[],
    timing: Timing = "on_time",
    startOffset = 1,
  ) => {
    impacts.forEach((impact, index) => {
      const mealType = mealTypeFor(meals.length);
      const hour = mealType === "breakfast" ? 8 : mealType === "lunch" ? 13 : 19;
      meals.push({
        category,
        food,
        impact,
        timing,
        mealType,
        dayOffset: startOffset + index * 2,
        timeHour: hour,
        value: valueFor(group, impact, meals.length),
      });
    });
  };

  // Phase 1: 50 baseline meals, deliberately 8 high / 42 non-high.
  BASELINE_FOODS.forEach(food => {
    add("baseline", food, ["high", "medium", "low", "medium", "low", "medium"]);
  });
  add("baseline", BASELINE_FOODS[0], ["medium", "low"]);

  // Phase 2: below threshold and mixed timing.
  add("below_threshold", FOODS.wholegrainBread, [
    "high", "medium", "low", "medium", "low", "medium", "low", "high", "low", "medium", "low",
    "medium", "low", "medium", "high", "medium", "low", "medium", "low", "medium", "low", "medium",
  ], "on_time", 3);
  add("mixed_timing", FOODS.oatmeal, ["high", "medium", "low", "medium", "low", "medium", "low", "medium"], "on_time", 5);
  add("mixed_timing", FOODS.oatmeal, Array.from({ length: 10 }, (_, i) => i % 4 === 0 ? "high" : i % 2 === 0 ? "medium" : "low"), "delayed", 7);
  add("mixed_timing", FOODS.oatmeal, Array.from({ length: 12 }, (_, i) => i % 5 === 0 ? "high" : i % 2 === 0 ? "medium" : "low"), "unrelated", 9);

  // Phase 3: no real signal, matching the 30% baseline target.
  add("no_signal", FOODS.chicken, [
    "high", "high", "high", "medium", "low", "medium", "low", "medium", "low", "medium",
    "high", "high", "high", "medium", "low", "medium", "low", "medium", "low", "medium",
    "high", "high", "high", "medium", "low", "medium", "low", "medium", "low", "medium",
  ], "on_time", 11);

  // Phase 4: clear signal, 22 high and 8 non-high.
  add("clear_signal", FOODS.whiteRice, [
    ...Array.from({ length: 22 }, () => "high" as const),
    "medium", "low", "medium", "low", "medium", "low", "medium", "low",
  ], "on_time", 13);

  if (meals.length !== 162) throw new Error(`Unexpected seed meal count: ${meals.length}`);
  return meals;
}

function validateShape(meals: SeedMeal[]): void {
  const count = (category: SeedMeal["category"]) => meals.filter(m => m.category === category).length;
  const onTimeMixed = meals.filter(m => m.category === "mixed_timing" && m.timing === "on_time").length;
  if (count("baseline") !== 50 || count("below_threshold") !== 22 || count("mixed_timing") !== 30 ||
      count("no_signal") !== 30 || count("clear_signal") !== 30 || onTimeMixed !== 8) {
    throw new Error("Seed category counts do not match the requested scenarios");
  }
  const clearHigh = meals.filter(m => m.category === "clear_signal" && m.impact === "high").length;
  if (clearHigh !== 22) throw new Error("Clear-signal high count must be 22");
}

async function findTarget(client: any): Promise<{ userId: string; group: GlucoseGroup }> {
  const result = await client.query(
    `SELECT u.id AS user_id, up.glucose_group, up.health_condition
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE lower(u.email) = lower($1)`,
    [TARGET_EMAIL],
  );
  if (result.rows.length !== 1) throw new Error(`Expected exactly one development account for ${TARGET_EMAIL}`);
  const row = result.rows[0];
  const group: GlucoseGroup = row.glucose_group === "t2dm" ? "t2dm" : "healthy";
  return { userId: row.user_id, group };
}

async function insertFoodLabels(client: any, meals: SeedMeal[]): Promise<string[]> {
  const foods = [...new Map(meals.map(meal => [meal.food.slug, meal.food])).values()];
  const created: string[] = [];
  for (const food of foods) {
    const key = comboKey(food);
    const items = canonicalItems(food);
    const result = await client.query(
      `INSERT INTO food_labels
         (internal_id, food_name_en, food_name_zh_hant, food_name_yue, default_portion_id,
          default_sauces, default_toppings, food_items)
       VALUES ($1, $2, $3, $4, 'medium', '{}', '{}', $5::jsonb)
       ON CONFLICT (internal_id) DO NOTHING
       RETURNING internal_id`,
      [key, food.nameEn, food.nameZhHant, food.nameYue, JSON.stringify(items)],
    );
    if (result.rows.length === 1) created.push(key);
  }
  return created;
}

async function seed(): Promise<void> {
  assertDevelopmentOnly();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await findTarget(client);
    const existing = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM meal_snaps
       WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    if (Number(existing.rows[0].count) > 0) {
      throw new Error(`Seed batch ${BATCH_ID} already exists; run --cleanup before reseeding`);
    }
    const meals = makeSeedMeals(target.group);
    validateShape(meals);
    const createdLabels = await insertFoodLabels(client, meals);
    const impactCounts: Record<Impact, number> = { low: 0, medium: 0, high: 0 };
    const timingCounts: Record<Timing, number> = { on_time: 0, delayed: 0, unrelated: 0 };

    for (const [index, meal] of meals.entries()) {
      const snapTime = dateForOffset(meal.dayOffset, meal.timeHour);
      const localDate = snapTime.toISOString().slice(0, 10);
      const foodItems = canonicalItems(meal.food);
      const impact = classifyPostMealMmol(meal.value, target.group, PHASE1_THRESHOLDS[target.group]);
      if (impact !== meal.impact) throw new Error(`Value ${meal.value} was classified as ${impact}, expected ${meal.impact}`);
      const snapResult = await client.query(
        `INSERT INTO meal_snaps
          (user_id, snap_time, local_date, meal_type, food_name, portion, glucose_impact,
           missed_meal_flag, combo_key, food_items, source, seed_batch_id)
         VALUES ($1, $2, $3, $4, $5, 'medium', $6, false, $7, $8::jsonb, $9, $10)
         RETURNING id`,
        [
          target.userId, snapTime, localDate, meal.mealType, meal.food.nameEn, impact,
          comboKey(meal.food), JSON.stringify(foodItems), SEED_SOURCE, BATCH_ID,
        ],
      );
      const snapId = snapResult.rows[0].id as number;
      const minutes = meal.timing === "on_time" ? 60 : meal.timing === "delayed" ? 130 : 300;
      const recordedAt = new Date(snapTime.getTime() + minutes * 60_000);
      await client.query(
        `INSERT INTO hstix_readings
          (user_id, source, seed_batch_id, meal_snap_id, glucose_mmol, note,
           minutes_since_last_meal, meal_timing_confidence, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          target.userId, SEED_SOURCE, BATCH_ID, snapId, stableFloat(meal.value),
          `Synthetic ${meal.category} fixture`, minutes, meal.timing, recordedAt,
        ],
      );
      impactCounts[impact]++;
      timingCounts[meal.timing]++;
      if (index % 25 === 0) console.log(`[seed] inserted ${index + 1}/${meals.length}`);
    }

    await client.query("COMMIT");
    console.log(JSON.stringify({
      targetEmail: TARGET_EMAIL,
      glucoseGroup: target.group,
      source: SEED_SOURCE,
      batchId: BATCH_ID,
      createdFoodLabelInternalIds: createdLabels,
      counts: { meals: meals.length, impact: impactCounts, timing: timingCounts },
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
    const seedMeals = await client.query(
      `SELECT id, combo_key
       FROM meal_snaps
       WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    const comboKeys = [...new Set(seedMeals.rows.map((row: { combo_key: string | null }) => row.combo_key).filter(Boolean))];
    const readings = await client.query(
      `DELETE FROM hstix_readings WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3 RETURNING id`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    const meals = await client.query(
      `DELETE FROM meal_snaps WHERE user_id = $1 AND source = $2 AND seed_batch_id = $3 RETURNING id`,
      [target.userId, SEED_SOURCE, BATCH_ID],
    );
    const removedLabels: string[] = [];
    for (const key of comboKeys) {
      const refs = await client.query(
        `SELECT 1 FROM meal_snaps WHERE combo_key = $1 LIMIT 1`,
        [key],
      );
      if (refs.rows.length > 0) continue;
      const deleted = await client.query(
        `DELETE FROM food_labels WHERE internal_id = $1 RETURNING internal_id`,
        [key],
      );
      if (deleted.rows.length === 1) removedLabels.push(key);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      targetEmail: TARGET_EMAIL,
      batchId: BATCH_ID,
      deletedMealSnaps: meals.rowCount ?? 0,
      deletedHstixReadings: readings.rowCount ?? 0,
      deletedFoodLabels: removedLabels,
      retainedFoodLabels: comboKeys.filter(key => !removedLabels.includes(key)),
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
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exitCode = 1;
  });