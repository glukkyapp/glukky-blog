import { strict as assert } from "node:assert";
import type { MealSnap } from "../shared/schema";
import { runMealRetentionJob, MEAL_RETENTION_BATCH_SIZE } from "../server/meal-retention";
import { buildTwoMonthReport, getLatestTwoCompletedMonths } from "../server/two-month-report";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-01T00:00:00.000Z");

type Fact = { localDate: string; mealType: string | null; finalImpact: string | null };
type FixtureMeal = MealSnap & { retainedFinalImpact: string | null };

function meal(id: number, ageMs: number, overrides: Partial<FixtureMeal> = {}): FixtureMeal {
  const snapTime = new Date(NOW.getTime() - ageMs);
  return {
    id,
    userId: "fixture-user",
    source: null,
    seedBatchId: null,
    snapTime,
    localDate: snapTime.toISOString().slice(0, 10),
    mealType: "lunch",
    foodName: "fixture food",
    portion: null,
    sauces: null,
    extras: null,
    glucoseImpact: "low",
    missedMealFlag: false,
    comboKey: null,
    foodItems: null,
    postMealGlucoseMmol: null,
    postMealSymptom: null,
    postMealRecordedAt: null,
    postMealSkipped: false,
    previousMealOverlap: false,
    overlapDismissed: false,
    postMealWalked: null,
    isDeleted: false,
    retainedFinalImpact: "low",
    ...overrides,
  };
}

class MemoryRetentionStorage {
  meals: FixtureMeal[];
  facts = new Map<number, Fact>();
  daily = new Map<string, { low: number; medium: number; high: number; mealCount: number; hasLateMeal: boolean }>();
  fetchSizes: number[] = [];
  purgeCalls: number[][] = [];
  factWrite?: (meal: FixtureMeal) => Promise<void>;

  constructor(meals: FixtureMeal[]) {
    this.meals = meals;
  }

  async fetchMealSnapsBeforeDate(cutoff: Date, batchSize: number): Promise<MealSnap[]> {
    this.fetchSizes.push(batchSize);
    return this.meals
      .filter(item => item.snapTime < cutoff)
      .sort((a, b) => a.snapTime.getTime() - b.snapTime.getTime())
      .slice(0, batchSize);
  }

  async getProfile() {
    return null;
  }

  async upsertDailyGlucose(
    userId: string,
    localDate: string,
    counts: { low: number; medium: number; high: number; mealCount: number; hasLateMeal: boolean },
  ) {
    void userId;
    const prior = this.daily.get(localDate) ?? { low: 0, medium: 0, high: 0, mealCount: 0, hasLateMeal: false };
    this.daily.set(localDate, {
      low: prior.low + counts.low,
      medium: prior.medium + counts.medium,
      high: prior.high + counts.high,
      mealCount: prior.mealCount + counts.mealCount,
      hasLateMeal: prior.hasLateMeal || counts.hasLateMeal,
    });
  }

  async upsertReportMealFactForSnap(userId: string, snapId: number) {
    const item = this.meals.find(candidate => candidate.id === snapId && candidate.userId === userId);
    assert.ok(item);
    if (this.factWrite) await this.factWrite(item);
    this.facts.set(snapId, {
      localDate: item.localDate,
      mealType: item.mealType,
      finalImpact: item.retainedFinalImpact,
    });
  }

  async purgeMealSnapsByIds(ids: number[]) {
    this.purgeCalls.push(ids);
    const purged = new Set(ids);
    this.meals = this.meals.filter(item => !purged.has(item.id));
  }
}

async function run(fixture: MemoryRetentionStorage) {
  return runMealRetentionJob(fixture as Parameters<typeof runMealRetentionJob>[0], NOW);
}

console.log("Meal retention boundaries");
{
  const fixture = new MemoryRetentionStorage([
    meal(1, 179 * DAY_MS),
    meal(2, 180 * DAY_MS),
    meal(3, 180 * DAY_MS + 1),
    meal(4, 181 * DAY_MS),
  ]);
  assert.equal(await run(fixture), 2);
  assert.deepEqual(fixture.meals.map(item => item.id), [1, 2]);
  assert.deepEqual([...fixture.facts.keys()], [4, 3], "one millisecond beyond 180 days is eligible");
}

console.log("Fact write gates purge");
{
  const fixture = new MemoryRetentionStorage([meal(1, 181 * DAY_MS)]);
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  fixture.factWrite = async () => blocked;
  const pending = run(fixture);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.purgeCalls.length, 0, "a delayed fact write must prevent purge");
  release();
  assert.equal(await pending, 1);
  assert.equal(fixture.purgeCalls.length, 1);
}
{
  const fixture = new MemoryRetentionStorage([meal(1, 181 * DAY_MS)]);
  fixture.factWrite = async () => { throw new Error("fact write rejected"); };
  await assert.rejects(run(fixture), /fact write rejected/);
  assert.equal(fixture.purgeCalls.length, 0, "a rejected fact write must prevent batch purge");
  assert.equal(fixture.meals.length, 1);
}

console.log("Retained report behavior");
{
  const oldMonthMeals = [
    ...Array.from({ length: 10 }, (_, index) => meal(index + 1, 181 * DAY_MS + index, {
      snapTime: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T12:00:00Z`),
      localDate: `2026-01-${String(index + 1).padStart(2, "0")}`,
      mealType: "breakfast",
      glucoseImpact: "low",
      retainedFinalImpact: "high",
    })),
    ...Array.from({ length: 10 }, (_, index) => meal(index + 101, 181 * DAY_MS + 100 + index, {
      snapTime: new Date(`2026-01-${String(index + 11).padStart(2, "0")}T12:00:00Z`),
      localDate: `2026-01-${String(index + 11).padStart(2, "0")}`,
      mealType: "lunch",
      glucoseImpact: "high",
      retainedFinalImpact: "low",
    })),
  ];
  const fixture = new MemoryRetentionStorage(oldMonthMeals);
  await run(fixture);
  assert.equal(fixture.meals.length, 0);
  assert.equal(fixture.facts.get(1)?.finalImpact, "high");
  assert.equal(fixture.facts.get(101)?.finalImpact, "low");
  const facts = [...fixture.facts.values()];
  const reportNow = new Date("2026-03-01T00:00:00Z");
  const report = buildTwoMonthReport({
    now: reportNow,
    timezone: "UTC",
    firstMealLocalDate: "2025-12-01",
    glucoseGroup: "healthy",
    meals: facts.map((fact, index) => ({
      id: index + 1,
      localDate: fact.localDate,
      mealType: fact.mealType,
      glucoseImpact: fact.finalImpact,
      hstix: null,
    })),
  });
  assert.equal(getLatestTwoCompletedMonths(reportNow, "UTC").startDate, "2026-01-01");
  assert.equal(report.totalMeals, 20);
  assert.equal(report.status, "ready");
  const mealtime = report.cards.find(card => card.cardType === "mealtime");
  assert.equal(mealtime?.state, "named");
  if (mealtime?.state === "named") assert.equal(mealtime.leadingBucket, "breakfast");
}

console.log("Multiple batches");
{
  const count = MEAL_RETENTION_BATCH_SIZE * 2 + 17;
  const fixture = new MemoryRetentionStorage(
    Array.from({ length: count }, (_, index) => meal(index + 1, 181 * DAY_MS + index)),
  );
  assert.equal(await run(fixture), count);
  assert.deepEqual(fixture.purgeCalls.map(ids => ids.length), [500, 500, 17]);
  assert.ok(fixture.fetchSizes.every(size => size === 500));
  assert.equal(fixture.facts.size, count);
  assert.equal(fixture.meals.length, 0);
}

console.log("Meal retention tests passed.");