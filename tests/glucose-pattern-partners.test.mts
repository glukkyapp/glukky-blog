import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import type { FoodItemMetadata } from "../shared/schema";
import { foodItemKey } from "../server/carb-subtypes";
import {
  buildHstixFoodCards,
  buildHstixPartnerInsights,
  filterEligibleHstixMeals,
  type HstixFoodCard,
  type HstixMealForCards,
} from "../server/glucose-patterns";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

function food(name: string): FoodItemMetadata {
  return {
    nameEn: name,
    nameZhHant: name,
    nameYue: name,
    isCarb: false,
    carbCategory: null,
    carbSubtype: null,
    sweetCategory: "sweet_food",
    isSweet: true,
    subtypeConfirmed: false,
    source: "claude",
  };
}

function carbFood(name: string): FoodItemMetadata {
  return {
    ...food(name),
    isCarb: true,
    carbCategory: "rice",
  };
}

function ordinaryFood(name: string): FoodItemMetadata {
  return {
    ...food(name),
    sweetCategory: null,
    isSweet: false,
  };
}

function meal(mmol: number, foodItems: FoodItemMetadata[], timing: HstixMealForCards["mealTimingConfidence"] = "on_time"): HstixMealForCards {
  return { postMealGlucoseMmol: mmol, foodItems, mealTimingConfidence: timing, isCanonicalHstix: true };
}

function card(item: FoodItemMetadata, impactLevel: HstixFoodCard["impactLevel"] = "high", lift = 1.5): HstixFoodCard {
  return {
    foodKey: foodItemKey(item),
    foodNameEn: item.nameEn,
    foodNameZhHant: item.nameZhHant,
    foodNameYue: item.nameYue,
    carbCategory: item.carbCategory === "rice" ? "rice" : null,
    sweetCategory: item.sweetCategory ?? null,
    componentType: item.isCarb ? "carb" : item.sweetCategory === "sweet_drink" ? "sweet_drink" : "sweet_food",
    totalMeals: 25,
    highMeals: 15,
    mediumMeals: 5,
    lowMeals: 5,
    nonHighMeals: 10,
    highProbability: 0.6,
    overallHighProbability: 0.4,
    lift,
    avgPostMealMmol: 7,
    impactLevel,
  };
}

function insightFor(index: FoodItemMetadata, meals: HstixMealForCards[], impactLevel: HstixFoodCard["impactLevel"] = "high") {
  return buildHstixPartnerInsights(meals, [card(index, impactLevel)]).get(foodItemKey(index));
}

const rice = carbFood("rice");
const roastPork = ordinaryFood("roast pork");
const chicken = ordinaryFood("chicken");
const greens = ordinaryFood("greens");

console.log("Eligible measured-food evidence");
const derivedRice = { ...rice, source: "derived" as const };
const eligible = filterEligibleHstixMeals([
  meal(7, [rice]),
  meal(8, [rice], "delayed"),
  meal(8, [rice], "unrelated"),
  meal(8, [derivedRice]),
  { postMealGlucoseMmol: 8, foodItems: [rice], mealTimingConfidence: "on_time", isCanonicalHstix: false },
  { postMealGlucoseMmol: Number.NaN, foodItems: [rice], mealTimingConfidence: "on_time", isCanonicalHstix: true },
]);
check("only canonical, finite, on-time, non-derived meals enter partner analysis", eligible.length === 1 && eligible[0].postMealGlucoseMmol === 7);
check(
  "legacy meal-row measurements cannot create measured cards or partner advice",
  buildHstixFoodCards(
    Array.from({ length: 25 }, () => ({ postMealGlucoseMmol: 8, foodItems: [rice, roastPork], mealTimingConfidence: "on_time" as const, isCanonicalHstix: false })),
    "healthy",
  ).length === 0,
);
const storageSource = readFileSync("server/storage.ts", "utf8");
const hstixCardStorage = storageSource.slice(
  storageSource.indexOf("async getMealSnapsForHstixCards"),
  storageSource.indexOf("async getLatestMealSnap"),
);
check(
  "measured-food storage supplies canonical HStix rows without a legacy fallback",
  !hstixCardStorage.includes("legacyRows") &&
    hstixCardStorage.includes("isCanonicalHstix: true") &&
    hstixCardStorage.includes(".innerJoin(mealSnaps") &&
    hstixCardStorage.includes("eq(mealSnaps.isDeleted, false)"),
);

console.log("\nJoint meal means");
const riceCombinationMeals = [
  ...Array.from({ length: 8 }, () => meal(8.2, [rice, roastPork])),
  ...Array.from({ length: 8 }, () => meal(6.4, [rice, chicken])),
  ...Array.from({ length: 9 }, () => meal(7.0, [rice, greens])),
  ...Array.from({ length: 8 }, () => meal(5.5, [food("other meal")])),
];
const riceCombinationInsight = insightFor(rice, riceCombinationMeals);
check(
  "rice + roast-pork means use only their joint meals, not all roast-pork meals",
  riceCombinationInsight?.kind === "comparison" &&
    riceCombinationInsight.higherPartner.foodKey === foodItemKey(roastPork) &&
    riceCombinationInsight.lowerPartner.foodKey === foodItemKey(chicken),
);
check(
  "ordinary partners remain explanations without becoming measured index cards",
  !buildHstixFoodCards([
    ...Array.from({ length: 25 }, () => meal(8.2, [rice, roastPork])),
    ...Array.from({ length: 25 }, () => meal(5.5, [carbFood("baseline")])),
  ], "healthy").some(result => result.foodKey === foodItemKey(roastPork)),
);

console.log("\nDominant partner rules");
const alpha = food("alpha");
const beta = food("beta");
const dominantInsight = insightFor(rice, [
  ...Array.from({ length: 18 }, () => meal(7.2, [rice, alpha, beta])),
  ...Array.from({ length: 7 }, () => meal(6.2, [rice])),
]);
check(
  "multiple simultaneous dominant partners select the stable highest-count/key warning and suppress comparison",
  dominantInsight?.kind === "dominant" && dominantInsight.partner.foodKey === foodItemKey(alpha),
);
const seventyBoundary = insightFor(rice, [
  ...Array.from({ length: 35 }, () => meal(8, [rice, alpha])),
  ...Array.from({ length: 8 }, () => meal(6, [rice, beta])),
  ...Array.from({ length: 7 }, () => meal(7, [rice, greens])),
]);
check(
  "a partner at exactly 70% is not dominant and can still participate in comparison",
  seventyBoundary?.kind === "comparison" &&
    seventyBoundary.higherPartner.foodKey === foodItemKey(alpha) &&
    seventyBoundary.lowerPartner.foodKey === foodItemKey(beta),
);

console.log("\nPartner eligibility gates");
const belowShare = insightFor(rice, [
  ...Array.from({ length: 35 }, () => meal(8, [rice, alpha])),
  ...Array.from({ length: 8 }, () => meal(6, [rice, beta])),
  ...Array.from({ length: 8 }, () => meal(7, [rice])),
]);
check("a partner below 16% is excluded even with eight joint meals", belowShare === undefined);
const lowerCountStillEligible = insightFor(rice, [
  ...Array.from({ length: 8 }, () => meal(8, [rice, alpha])),
  ...Array.from({ length: 7 }, () => meal(6, [rice, beta])),
  ...Array.from({ length: 10 }, () => meal(7, [rice])),
]);
check(
  "partners at or above 16% remain eligible even with fewer than eight joint meals",
  lowerCountStillEligible?.kind === "comparison" &&
    lowerCountStillEligible.higherPartner.foodKey === foodItemKey(alpha) &&
    lowerCountStillEligible.lowerPartner.foodKey === foodItemKey(beta),
);
const noPartner = insightFor(rice, Array.from({ length: 25 }, () => meal(7, [rice])));
const onePartner = insightFor(rice, [
  ...Array.from({ length: 8 }, () => meal(8, [rice, alpha])),
  ...Array.from({ length: 17 }, () => meal(7, [rice])),
]);
check("zero and one qualified partners produce no comparison advice", noPartner === undefined && onePartner === undefined);

console.log("\nMean and occurrence boundaries");
const exactDifference = insightFor(rice, [
  ...Array.from({ length: 8 }, () => meal(7.5, [rice, alpha])),
  ...Array.from({ length: 8 }, () => meal(6, [rice, beta])),
  ...Array.from({ length: 9 }, () => meal(6.8, [rice, greens])),
]);
const aboveDifference = insightFor(rice, [
  ...Array.from({ length: 8 }, () => meal(7.5001, [rice, alpha])),
  ...Array.from({ length: 8 }, () => meal(6, [rice, beta])),
  ...Array.from({ length: 9 }, () => meal(6.8, [rice, greens])),
]);
check("a raw mean difference of exactly 1.5 mmol/L does not show advice", exactDifference === undefined);
check("a raw mean difference strictly above 1.5 mmol/L shows advice", aboveDifference?.kind === "comparison");
const delta = food("delta");
const gamma = food("gamma");
const tiedPartners = insightFor(rice, [
  ...Array.from({ length: 8 }, () => meal(8, [rice, alpha])),
  ...Array.from({ length: 8 }, () => meal(8, [rice, beta])),
  ...Array.from({ length: 8 }, () => meal(6, [rice, delta])),
  ...Array.from({ length: 8 }, () => meal(6, [rice, gamma])),
]);
check(
  "occurrence and mean ties use ascending food keys for stable selected partners",
  tiedPartners?.kind === "comparison" &&
    tiedPartners.higherPartner.foodKey === foodItemKey(alpha) &&
    tiedPartners.lowerPartner.foodKey === foodItemKey(delta),
);

const duplicatePartner = food("duplicate partner");
const duplicateMeals = [
  ...Array.from({ length: 8 }, () => meal(8, [rice, duplicatePartner, duplicatePartner])),
  ...Array.from({ length: 9 }, () => meal(7, [rice, alpha])),
  ...Array.from({ length: 9 }, () => meal(6, [rice, beta])),
  ...Array.from({ length: 9 }, () => meal(7, [rice, greens])),
];
check(
  "duplicate components and overlapping co-foods count once per joint meal",
  insightFor(rice, duplicateMeals) === undefined,
);

console.log("\nCandidate limits and returned-card contract");
const highCandidates = Array.from({ length: 6 }, (_, index) => card(carbFood(`high ${index}`), "high", 2 - index / 100));
const sixthHigh = carbFood("high 5");
const sixthHighMeals = [
  ...Array.from({ length: 20 }, () => meal(8, [sixthHigh, alpha])),
  ...Array.from({ length: 5 }, () => meal(6, [sixthHigh])),
];
check(
  "only the five highest-lift Higher cards enter partner analysis",
  !buildHstixPartnerInsights(sixthHighMeals, highCandidates).has(foodItemKey(sixthHigh)),
);
const lowCandidates = Array.from({ length: 6 }, (_, index) => card(carbFood(`low ${index}`), "low", 0.5 + index / 100));
const sixthLow = carbFood("low 5");
const sixthLowMeals = [
  ...Array.from({ length: 20 }, () => meal(6, [sixthLow, alpha])),
  ...Array.from({ length: 5 }, () => meal(8, [sixthLow])),
];
check(
  "only the five smallest-lift Lower cards enter partner analysis",
  !buildHstixPartnerInsights(sixthLowMeals, lowCandidates).has(foodItemKey(sixthLow)),
);
const sweetIndex = food("sweet index");
const sweetIndexInsight = insightFor(
  sweetIndex,
  Array.from({ length: 25 }, () => meal(8, [sweetIndex, rice])),
);
check(
  "sweet-only cards enter index candidate analysis under the shared component gate",
  sweetIndexInsight?.kind === "dominant" &&
    sweetIndexInsight.partner.foodKey === foodItemKey(rice),
);
const measuredCards = buildHstixFoodCards([
  ...Array.from({ length: 25 }, () => meal(8.2, [rice, roastPork])),
  ...Array.from({ length: 25 }, () => meal(5.5, [food("baseline")])),
], "healthy");
check(
  "qualified insights are returned on the measured card itself",
  measuredCards.find(result => result.foodKey === foodItemKey(rice))?.partnerInsight?.kind === "dominant",
);
const unreliableCards = buildHstixFoodCards([
  ...Array.from({ length: 24 }, () => meal(5.5, [rice, roastPork])),
  meal(6.5, [rice, roastPork]),
  ...Array.from({ length: 25 }, () => meal(5.5, [food("baseline")])),
], "healthy");
check(
  "partner analysis cannot restore a directional card rejected by the reliability gate",
  !unreliableCards.some(result => result.foodKey === foodItemKey(rice)),
);
const mediumOnlyInsight = buildHstixPartnerInsights(
  Array.from({ length: 25 }, () => meal(8, [rice, alpha])),
  [card(rice, "medium", 1)],
);
check("No-significant-difference cards never receive partner insights", mediumOnlyInsight.size === 0);

console.log(`\n${passed} passed`);