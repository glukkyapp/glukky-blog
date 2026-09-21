import assert from "node:assert/strict";
import {
  buildFoodFrequencySummary,
  FOOD_FREQUENCY_MEAL_THRESHOLD,
} from "../server/food-frequency";
import {
  buildGeneralGlucosePatternComponents,
  buildHstixFoodCards,
  filterEligibleHstixMeals,
  isReliableHstixFoodEvidence,
  MIN_HSTIX_FOOD_MEALS_FOR_CARD,
  type HstixMealForCards,
} from "../server/glucose-patterns";
import type { FoodItemMetadata, MealSnap } from "../shared/schema";

const anchor = new Date("2026-09-01T12:00:00.000Z");
const dateAtAge = (ageInDays: number) =>
  new Date(anchor.getTime() - ageInDays * 24 * 60 * 60 * 1000);

const rice: FoodItemMetadata = {
  id: "retention-white-rice",
  nameEn: "White rice",
  nameZhHant: "白飯",
  nameYue: "白飯",
  isCarb: true,
  carbCategory: "rice",
  carbSubtype: null,
  subtypeConfirmed: false,
  source: "catalog_match",
};

const oats: FoodItemMetadata = {
  id: "retention-oats",
  nameEn: "Oats",
  nameZhHant: "燕麥",
  nameYue: "燕麥",
  isCarb: true,
  carbCategory: "other",
  carbSubtype: null,
  subtypeConfirmed: false,
  source: "catalog_match",
};

type DatedGeneralMeal = Pick<MealSnap, "foodItems" | "isDeleted"> & {
  localDate: string;
};

type DatedHstixMeal = HstixMealForCards & {
  recordedAt: Date;
};

const generalMeal = (
  ageInDays: number,
  foodItems: FoodItemMetadata[],
  isDeleted = false,
): DatedGeneralMeal => ({
  localDate: dateAtAge(ageInDays).toISOString().slice(0, 10),
  foodItems,
  isDeleted,
});

const hstixMeal = (
  ageInDays: number,
  postMealGlucoseMmol: number | null,
  foodItems: FoodItemMetadata[],
  overrides: Partial<HstixMealForCards> = {},
): DatedHstixMeal => ({
  recordedAt: dateAtAge(ageInDays),
  postMealGlucoseMmol,
  foodItems,
  mealTimingConfidence: "on_time",
  isCanonicalHstix: true,
  ...overrides,
});

console.log("Retention-age Glucose Pattern evidence");

const retainedGeneralMeals = Array.from(
  { length: FOOD_FREQUENCY_MEAL_THRESHOLD },
  (_, index) => generalMeal(31 + index * (149 / (FOOD_FREQUENCY_MEAL_THRESHOLD - 1)), [rice]),
);
const retainedGeneralSummary = buildFoodFrequencySummary(retainedGeneralMeals);
assert.equal(retainedGeneralSummary.totalMeals, 25);
assert.equal(retainedGeneralSummary.eligible, true);
assert.equal(retainedGeneralSummary.foods[0]?.mealCount, 25);
assert.equal(
  buildGeneralGlucosePatternComponents(retainedGeneralMeals)[0]?.mealCount,
  25,
);
console.log("  ✓ active canonical General evidence remains eligible from 31 through 180 days");

const oneDeletedOldMeal = generalMeal(180, [rice], true);
const generalBelowGate = buildFoodFrequencySummary([
  ...retainedGeneralMeals.slice(0, FOOD_FREQUENCY_MEAL_THRESHOLD - 1),
  oneDeletedOldMeal,
]);
assert.equal(generalBelowGate.totalMeals, 24);
assert.equal(generalBelowGate.eligible, false);
assert.equal(
  buildGeneralGlucosePatternComponents([...retainedGeneralMeals, oneDeletedOldMeal])[0]?.mealCount,
  25,
);
console.log("  ✓ the General gate is still 25 active meals and deleted meals stay excluded");

const presentMeals = Array.from(
  { length: MIN_HSTIX_FOOD_MEALS_FOR_CARD },
  (_, index) => hstixMeal(31 + index, 8.2, [rice]),
);
const absentMeals = Array.from(
  { length: MIN_HSTIX_FOOD_MEALS_FOR_CARD },
  (_, index) => hstixMeal(156 + index, 5.5, [oats]),
);
const retainedHstixMeals = [...presentMeals, ...absentMeals];
const retainedCards = buildHstixFoodCards(retainedHstixMeals, "healthy");
const riceCard = retainedCards.find(card => card.foodKey === `component:${rice.id}`);
assert.equal(riceCard?.impactLevel, "high");
assert.equal(riceCard?.totalMeals, 25);
assert.equal(riceCard?.highMeals, 25);
assert.equal(
  isReliableHstixFoodEvidence(
    Array.from({ length: 25 }, () => 2),
    Array.from({ length: 25 }, () => 0),
    "high",
  ),
  true,
);
console.log("  ✓ 25 present and 25 absent canonical HStix meals pass the reliability gates");

const only24Absent = buildHstixFoodCards(
  [...presentMeals, ...absentMeals.slice(0, MIN_HSTIX_FOOD_MEALS_FOR_CARD - 1)],
  "healthy",
);
assert.equal(
  only24Absent.some(card =>
    card.foodKey === `component:${rice.id}` && card.impactLevel === "high"),
  false,
);
assert.equal(
  isReliableHstixFoodEvidence(
    Array.from({ length: 25 }, () => 2),
    Array.from({ length: 24 }, () => 0),
    "high",
  ),
  false,
);
console.log("  ✓ 24 absent meals still cannot support a directional HStix card");

const invalidHstixMeals: DatedHstixMeal[] = [
  hstixMeal(90, 8.2, [rice], { isCanonicalHstix: false }),
  hstixMeal(100, 8.2, [rice], { mealTimingConfidence: "delayed" }),
  hstixMeal(110, 8.2, [rice], { mealTimingConfidence: "unrelated" }),
  hstixMeal(120, null, [rice]),
  hstixMeal(130, Number.NaN, [rice]),
  hstixMeal(140, 8.2, [{ ...rice, source: "derived" }]),
  hstixMeal(150, 8.2, [{ ...rice, id: undefined }]),
];
assert.equal(filterEligibleHstixMeals(invalidHstixMeals).length, 0);
assert.deepEqual(
  buildHstixFoodCards([...retainedHstixMeals, ...invalidHstixMeals], "healthy"),
  retainedCards,
);
console.log("  ✓ legacy, mistimed, non-finite, derived, and unresolved HStix evidence stays ineligible");

const undatedEquivalent = retainedHstixMeals.map(({ recordedAt: _recordedAt, ...meal }) => meal);
assert.deepEqual(
  buildHstixFoodCards(retainedHstixMeals, "healthy"),
  buildHstixFoodCards(undatedEquivalent, "healthy"),
);
console.log("  ✓ evidence age does not change existing HStix card output");

console.log("retention-pattern evidence tests passed");