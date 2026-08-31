import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import type { FoodItemMetadata } from "../shared/schema";
import {
  classifyCarbCategory,
  foodItemKey,
  normalize,
  prepareFoodItems,
} from "../server/carb-subtypes";
import { extractAdviceFoodItems, stripAdviceFoodItems } from "../server/food-items";
import {
  buildGeneralGlucosePatternComponents,
  buildHstixFoodCards,
  buildHstixFoodsNeedingMoreReadings,
  isEligibleGlucosePatternComponent,
  isReliableHstixFoodEvidence,
} from "../server/glucose-patterns";
import { classifyHstixTiming } from "../server/hstix-timing";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

const rice: FoodItemMetadata = {
  nameEn: "white rice",
  nameZhHant: "白飯",
  nameYue: "白飯",
  isCarb: true,
  carbCategory: "rice",
  carbSubtype: null,
  subtypeConfirmed: false,
  source: "claude",
};
const chicken: FoodItemMetadata = {
  nameEn: "Hainanese chicken",
  nameZhHant: "海南雞",
  nameYue: "海南雞",
  isCarb: false,
  carbCategory: null,
  carbSubtype: null,
  subtypeConfirmed: false,
  source: "claude",
};
const milkTea: FoodItemMetadata = {
  ...chicken,
  nameEn: "milk tea",
  nameZhHant: "奶茶",
  nameYue: "奶茶",
  sweetCategory: "sweet_drink",
  isSweet: true,
};
const cake: FoodItemMetadata = {
  ...chicken,
  nameEn: "cake",
  nameZhHant: "蛋糕",
  nameYue: "蛋糕",
  sweetCategory: "sweet_food",
  isSweet: true,
};

console.log("Carb category normalization");
check("normalization trims, NFKC-normalizes, and removes spaces", normalize("　白　飯　") === "白飯");
check("exact rice aliases win before substring matching", classifyCarbCategory({ nameEn: "red rice", nameZhHant: "紅米飯", nameYue: "紅米飯" }) === "rice");
check("multilingual noodle aliases are recognized", classifyCarbCategory({ nameEn: "rice noodles", nameZhHant: "米粉", nameYue: "米粉" }) === "noodles");
const structured = prepareFoodItems([
  { nameEn: "Hainanese chicken", nameZhHant: "海南雞", nameYue: "海南雞" },
  { nameEn: "rice", nameZhHant: "白飯", nameYue: "白飯" },
]);
check("structured dish components remain separate rather than splitting connector text", structured.length === 2 && structured[1].carbCategory === "rice");

console.log("\nAdvice food-item contract");
const adviceWithItems = `Blood sugar impact: High
Watch out: white rice --> fast glucose spike
Right now: 4
{"foodItems":[{"nameEn":"Hainanese chicken","nameZhHant":"海南雞","nameYue":"海南雞"},{"nameEn":"white rice","nameZhHant":"白飯","nameYue":"白飯"},{"nameEn":"milk tea","nameZhHant":"奶茶","nameYue":"奶茶"}]}`;
const adviceItems = extractAdviceFoodItems(adviceWithItems);
check("advice extracts Claude's multilingual individual foods and drinks", adviceItems?.length === 3 &&
  adviceItems[0].nameEn === "Hainanese chicken" &&
  adviceItems[2].nameZhHant === "奶茶");
check("advice item metadata is server-owned rather than subtype-confirmed", adviceItems?.every(item =>
  item.source === "claude" && item.subtypeConfirmed === false,
) === true);
check("machine-readable food items are removed before advice is stored or shown",
  !stripAdviceFoodItems(adviceWithItems).includes('"foodItems"'));

console.log("\nGlucose Patterns component eligibility");
const unsupportedCarb: FoodItemMetadata = {
  ...rice,
  nameEn: "unsupported carb",
  nameZhHant: "未支援碳水",
  nameYue: "未支援碳水",
  carbCategory: "unsupported",
};
check("supported carbs and stored sweet-only components share the analysis gate",
  isEligibleGlucosePatternComponent(rice) &&
  isEligibleGlucosePatternComponent(milkTea) &&
  isEligibleGlucosePatternComponent(cake));
check("ordinary foods, unsupported carb metadata, and derived components are excluded",
  !isEligibleGlucosePatternComponent(chicken) &&
  !isEligibleGlucosePatternComponent(unsupportedCarb) &&
  !isEligibleGlucosePatternComponent({ ...milkTea, source: "derived" }));
const generalComponents = buildGeneralGlucosePatternComponents([
  { foodItems: [rice, rice, milkTea, chicken] },
  { foodItems: [rice, cake] },
  { foodItems: [cake] },
  { foodItems: [{ ...milkTea, source: "derived" }] },
  { foodItems: [unsupportedCarb] },
  { foodItems: [rice], isDeleted: true },
]);
check("General counts each stable multilingual component once per active meal",
  generalComponents.find(component => component.foodKey === foodItemKey(rice))?.mealCount === 2 &&
  generalComponents.find(component => component.foodKey === foodItemKey(cake))?.mealCount === 2 &&
  generalComponents.find(component => component.foodKey === foodItemKey(milkTea))?.mealCount === 1);
check("General has no sample floor and orders frequency ties by stable component key",
  generalComponents.length === 3 &&
  generalComponents[0].mealCount === 2 &&
  generalComponents[1].mealCount === 2 &&
  generalComponents[0].foodKey.localeCompare(generalComponents[1].foodKey) < 0);
check("General retains sweet type labels without creating glucose classifications",
  generalComponents.find(component => component.foodKey === foodItemKey(milkTea))?.componentType === "sweet_drink" &&
  generalComponents.find(component => component.foodKey === foodItemKey(cake))?.sweetCategory === "sweet_food" &&
  !("impactLevel" in generalComponents[0]) &&
  !("avgPostMealMmol" in generalComponents[0]));

const onTimeMeal = (postMealGlucoseMmol: number, foodItems: FoodItemMetadata[]) => ({
  postMealGlucoseMmol,
  foodItems,
  mealTimingConfidence: "on_time" as const,
  isCanonicalHstix: true,
});

console.log("\nMeasured HStix lift");
const measuredMeals = Array.from({ length: 25 }, (_, index) => ({
  postMealGlucoseMmol: index < 5 ? 8.2 : 5.5,
  foodItems: [rice, chicken],
  mealTimingConfidence: "on_time" as const,
  isCanonicalHstix: true,
}));
const cards = buildHstixFoodCards(measuredMeals, "healthy");
const riceCard = cards.find(card => card.foodNameZhHant === "白飯");
check("each reading is classified before totals are calculated", riceCard?.highMeals === 5 && riceCard?.lowMeals === 20);
check("lift uses expected food rank divided by expected baseline rank", riceCard?.lift === 1);
const fixedBandCards = buildHstixFoodCards(measuredMeals, "healthy", {
  lowMedBoundary: 9,
  medHighBoundary: 12,
});
check("food reading bands use fixed phase-one thresholds, not personalised thresholds",
  fixedBandCards.find(card => card.foodNameZhHant === "白飯")?.highMeals === 5);
check("non-carb foods do not produce measured index cards even with 25 eligible meals",
  cards.some(card => card.foodNameEn === "white rice") && !cards.some(card => card.foodNameEn === "Hainanese chicken"));
const sweetCards = buildHstixFoodCards([
  ...Array.from({ length: 25 }, () => onTimeMeal(8.2, [milkTea])),
  ...Array.from({ length: 25 }, () => onTimeMeal(5.5, [rice])),
], "healthy");
check("sweet-only components receive measured cards with their stored type label",
  sweetCards.find(card => card.foodKey === foodItemKey(milkTea))?.componentType === "sweet_drink" &&
  sweetCards.find(card => card.foodKey === foodItemKey(milkTea))?.sweetCategory === "sweet_drink");
check("component-free extras never appear as evidence cards", !cards.some(card => card.foodNameEn === "gravy"));
const withDerivedRice = buildHstixFoodCards([
  ...measuredMeals,
  { postMealGlucoseMmol: 8.4, foodItems: [{ ...rice, source: "derived" as const }], mealTimingConfidence: "on_time" as const, isCanonicalHstix: true },
], "healthy");
check("derived historical records are excluded from measured evidence", withDerivedRice.find(card => card.foodNameZhHant === "白飯")?.totalMeals === 25);
check("each food requires 25 eligible on-time meals", buildHstixFoodCards(measuredMeals.slice(0, 24), "healthy").length === 0);
const mixedTimingMeals = [
  ...measuredMeals.slice(0, 24),
  { postMealGlucoseMmol: 8.2, foodItems: [rice], mealTimingConfidence: "delayed" as const, isCanonicalHstix: true },
  { postMealGlucoseMmol: 5.5, foodItems: [chicken], mealTimingConfidence: "unrelated" as const, isCanonicalHstix: true },
];
check(
  "delayed and unrelated readings cannot satisfy the on-time evidence gate",
  buildHstixFoodCards(mixedTimingMeals, "healthy").length === 0,
);
check(
  "below-threshold encouragement includes carbs and sweets but excludes ordinary foods",
  (() => {
    const needsMore = buildHstixFoodsNeedingMoreReadings([{
    postMealGlucoseMmol: 7,
    foodItems: [rice, chicken, milkTea, cake],
    mealTimingConfidence: "on_time" as const,
    isCanonicalHstix: true,
    }]);
    return needsMore.some(food => food.foodKey === foodItemKey(rice)) &&
      needsMore.some(food => food.foodKey === foodItemKey(milkTea) && food.componentType === "sweet_drink") &&
      needsMore.some(food => food.foodKey === foodItemKey(cake) && food.componentType === "sweet_food") &&
      !needsMore.some(food => food.foodNameEn === "Hainanese chicken");
  })(),
);

console.log("\nExpected-rank HStix impact");
const mediumStaple: FoodItemMetadata = {
  ...rice,
  nameEn: "medium staple",
  nameZhHant: "中等主食",
  nameYue: "中等主食",
};
const lowExtra: FoodItemMetadata = {
  ...rice,
  nameEn: "low extra",
  nameZhHant: "低額外食物",
  nameYue: "低額外食物",
};
const highExtra: FoodItemMetadata = {
  ...rice,
  nameEn: "high extra",
  nameZhHant: "高額外食物",
  nameYue: "高額外食物",
};
const expectedRankCard = (extraMeals: ReturnType<typeof onTimeMeal>[]) =>
  buildHstixFoodCards([
    ...Array.from({ length: 25 }, () => onTimeMeal(6.5, [mediumStaple])),
    ...extraMeals,
  ], "healthy").find(card => card.foodNameEn === "medium staple");
check(
  "expected rank can classify a majority-medium food as higher impact",
  expectedRankCard(Array.from({ length: 25 }, () => onTimeMeal(5.5, [lowExtra])))?.impactLevel === "high",
);
check(
  "an expected-rank ratio of exactly 1.2 is no significant difference",
  expectedRankCard(Array.from({ length: 5 }, () => onTimeMeal(5.5, [lowExtra])))?.impactLevel === "medium",
);
check(
  "an expected-rank ratio above 1.2 is higher impact",
  expectedRankCard([
    ...Array.from({ length: 16 }, () => onTimeMeal(6.5, [lowExtra])),
    ...Array.from({ length: 9 }, () => onTimeMeal(5.5, [lowExtra])),
  ])?.impactLevel === "high",
);
const lowerBoundaryCards = (highCount: number) => buildHstixFoodCards([
  ...Array.from({ length: 75 }, () => onTimeMeal(6.5, [mediumStaple])),
  ...Array.from({ length: highCount }, () => onTimeMeal(8.2, [highExtra])),
], "healthy");
check(
  "an expected-rank ratio of exactly 0.8 is no significant difference",
  lowerBoundaryCards(25).find(card => card.foodNameEn === "medium staple")?.impactLevel === "medium",
);
check(
  "an expected-rank ratio below 0.8 is lower impact",
  lowerBoundaryCards(26).find(card => card.foodNameEn === "medium staple")?.impactLevel === "low",
);
check(
  "a zero expected baseline rank produces no comparable cards",
  buildHstixFoodCards(Array.from({ length: 25 }, () => onTimeMeal(5.5, [rice])), "healthy").length === 0,
);

console.log("\nScore-based HStix reliability gate");
const scoreGroup = (high: number, medium: number, low: number) => [
  ...Array.from({ length: high }, () => 2),
  ...Array.from({ length: medium }, () => 1),
  ...Array.from({ length: low }, () => 0),
];
check(
  "weak directional evidence is suppressed even when the displayed ratio is directional",
  buildHstixFoodCards([
    ...Array.from({ length: 24 }, () => onTimeMeal(5.5, [lowExtra])),
    onTimeMeal(6.5, [lowExtra]),
    ...Array.from({ length: 25 }, () => onTimeMeal(5.5, [rice])),
  ], "healthy").length === 0,
);
const reliableHighCard = buildHstixFoodCards([
  ...Array.from({ length: 25 }, () => onTimeMeal(8.2, [highExtra])),
  ...Array.from({ length: 25 }, () => onTimeMeal(5.5, [rice])),
], "healthy").find(card => card.foodNameEn === "high extra");
check(
  "directional evidence that clears the internal threshold remains Higher",
  reliableHighCard?.impactLevel === "high",
);
check(
  "a score-based ratio-band card remains visible without a food-absent group",
  buildHstixFoodCards(Array.from({ length: 25 }, () => onTimeMeal(6.5, [mediumStaple])), "healthy")
    .find(card => card.foodNameEn === "medium staple")?.impactLevel === "medium",
);
check(
  "a direction mismatch fails even with a large score difference",
  !isReliableHstixFoodEvidence(Array.from({ length: 25 }, () => 2), Array.from({ length: 25 }, () => 0), "low"),
);
check(
  "food-absent evidence has the same 25-meal minimum",
  !isReliableHstixFoodEvidence(Array.from({ length: 25 }, () => 2), Array.from({ length: 24 }, () => 0), "high"),
);
check(
  "equal zero-variance groups do not create directional evidence",
  !isReliableHstixFoodEvidence(Array.from({ length: 25 }, () => 1), Array.from({ length: 25 }, () => 1), "high"),
);
check(
  "unequal zero-variance groups pass in the matching direction",
  isReliableHstixFoodEvidence(Array.from({ length: 25 }, () => 2), Array.from({ length: 25 }, () => 0), "high") &&
    isReliableHstixFoodEvidence(Array.from({ length: 25 }, () => 0), Array.from({ length: 25 }, () => 2), "low"),
);
check(
  "equal High rates still use the different Medium and Low scores",
  isReliableHstixFoodEvidence(
    scoreGroup(10, 0, 15),
    scoreGroup(10, 15, 0),
    "low",
  ),
);
check(
  "unequal group sizes and variances enforce the fixed 1.96 reliability boundary",
  !isReliableHstixFoodEvidence(scoreGroup(1, 21, 3), scoreGroup(11, 2, 27), "high") &&
    isReliableHstixFoodEvidence(scoreGroup(13, 1, 11), scoreGroup(2, 22, 16), "high"),
);
const duplicateFoodCard = buildHstixFoodCards([
  ...Array.from({ length: 25 }, () => onTimeMeal(8.2, [highExtra, highExtra])),
  ...Array.from({ length: 25 }, () => onTimeMeal(5.5, [rice])),
], "healthy").find(card => card.foodNameEn === "high extra");
check(
  "duplicate food components count once in the present group",
  duplicateFoodCard?.totalMeals === 25 && duplicateFoodCard.lift === 2 && duplicateFoodCard.impactLevel === "high",
);
check(
  "a staple with a small or empty food-absent group cannot make a directional card",
  buildHstixFoodCards([
    ...Array.from({ length: 25 }, () => onTimeMeal(5.5, [mediumStaple])),
    ...Array.from({ length: 10 }, () => onTimeMeal(8.2, [highExtra])),
  ], "healthy").length === 0 &&
    !isReliableHstixFoodEvidence(Array.from({ length: 25 }, () => 0), [], "low"),
);
const unchangedMathCard = buildHstixFoodCards([
  ...Array.from({ length: 25 }, () => onTimeMeal(8.2, [highExtra])),
  ...Array.from({ length: 25 }, () => onTimeMeal(5.5, [rice])),
], "healthy").find(card => card.foodNameEn === "high extra");
check(
  "the reliability gate leaves displayed lift and baseline-derived counts unchanged",
  unchangedMathCard?.lift === 2 &&
    unchangedMathCard.highMeals === 25 &&
    unchangedMathCard.mediumMeals === 0 &&
    unchangedMathCard.lowMeals === 0,
);
const highRankFoods = Array.from({ length: 6 }, (_, index): FoodItemMetadata => ({
  ...rice,
  nameEn: `high rank ${index}`,
  nameZhHant: `高排名${index}`,
  nameYue: `高排名${index}`,
}));
const highRankCards = buildHstixFoodCards([
  ...highRankFoods.flatMap(item => Array.from({ length: 25 }, () => onTimeMeal(8.2, [item]))),
  ...Array.from({ length: 100 }, () => onTimeMeal(5.5, [rice])),
], "healthy").filter(card => card.impactLevel === "high");
check(
  "backend limits tied Higher results to five with stable food-key ordering",
  highRankCards.length === 5 &&
    !highRankCards.some(card => card.foodKey === foodItemKey(highRankFoods[5])) &&
    highRankCards.every((card, index, cards) =>
      index === 0 ||
      cards[index - 1].lift > card.lift ||
      (cards[index - 1].lift === card.lift && cards[index - 1].foodKey.localeCompare(card.foodKey) < 0)),
);
const distinctHighFoods = Array.from({ length: 6 }, (_, index): FoodItemMetadata => ({
  ...rice,
  nameEn: `distinct high ${index}`,
  nameZhHant: `不同高排名${index}`,
  nameYue: `不同高排名${index}`,
}));
const distinctHighCards = buildHstixFoodCards([
  ...distinctHighFoods.flatMap((item, index) => [
    ...Array.from({ length: 25 - index }, () => onTimeMeal(8.2, [item])),
    ...Array.from({ length: index }, () => onTimeMeal(5.5, [item])),
  ]),
  ...Array.from({ length: 100 }, () => onTimeMeal(5.5, [rice])),
], "healthy").filter(card => card.impactLevel === "high");
check(
  "backend keeps the five highest distinct Higher lift ratios",
  distinctHighCards.length === 5 &&
    distinctHighCards.map(card => card.foodKey).join("|") === distinctHighFoods
      .slice(0, 5)
      .map(foodItemKey)
      .join("|") &&
    !distinctHighCards.some(card => card.foodKey === foodItemKey(distinctHighFoods[5])),
);
const lowRankFoods = Array.from({ length: 6 }, (_, index): FoodItemMetadata => ({
  ...rice,
  nameEn: `low rank ${index}`,
  nameZhHant: `低排名${index}`,
  nameYue: `低排名${index}`,
}));
const lowRankCards = buildHstixFoodCards([
  ...lowRankFoods.flatMap(item => Array.from({ length: 25 }, () => onTimeMeal(5.5, [item]))),
  ...Array.from({ length: 100 }, () => onTimeMeal(8.2, [rice])),
], "healthy").filter(card => card.impactLevel === "low");
check(
  "backend limits tied Lower results to five with stable food-key ordering",
  lowRankCards.length === 5 &&
    !lowRankCards.some(card => card.foodKey === foodItemKey(lowRankFoods[5])) &&
    lowRankCards.every((card, index, cards) =>
      index === 0 ||
      cards[index - 1].lift < card.lift ||
      (cards[index - 1].lift === card.lift && cards[index - 1].foodKey.localeCompare(card.foodKey) < 0)),
);
const distinctLowFoods = Array.from({ length: 6 }, (_, index): FoodItemMetadata => ({
  ...rice,
  nameEn: `distinct low ${index}`,
  nameZhHant: `不同低排名${index}`,
  nameYue: `不同低排名${index}`,
}));
const distinctLowCards = buildHstixFoodCards([
  ...distinctLowFoods.flatMap((item, index) => [
    ...Array.from({ length: index }, () => onTimeMeal(8.2, [item])),
    ...Array.from({ length: 25 - index }, () => onTimeMeal(5.5, [item])),
  ]),
  ...Array.from({ length: 100 }, () => onTimeMeal(8.2, [rice])),
], "healthy").filter(card => card.impactLevel === "low");
check(
  "backend keeps the five lowest distinct Lower lift ratios",
  distinctLowCards.length === 5 &&
    distinctLowCards.map(card => card.foodKey).join("|") === distinctLowFoods
      .slice(0, 5)
      .map(foodItemKey)
      .join("|") &&
    !distinctLowCards.some(card => card.foodKey === foodItemKey(distinctLowFoods[5])),
);
check(
  "reliability statistics never enter the measured-card response",
  !!unchangedMathCard &&
    Object.keys(unchangedMathCard).every(key => !/(reliab|variance|standardError|confidence|score)/i.test(key)),
);

console.log("\nHStix timing boundaries");
const timingMeal = new Date("2026-08-24T10:00:00.000Z");
check("120 minutes remains on-time",
  classifyHstixTiming(new Date("2026-08-24T12:00:00.000Z"), timingMeal).mealTimingConfidence === "on_time");
check("121 through 240 minutes are delayed and stay associated",
  (() => {
    const timing = classifyHstixTiming(new Date("2026-08-24T14:00:00.000Z"), timingMeal);
    return timing.mealTimingConfidence === "delayed" && timing.shouldAssociateMeal;
  })());
check("over 240 minutes is unrelated",
  classifyHstixTiming(new Date("2026-08-24T14:00:01.000Z"), timingMeal).mealTimingConfidence === "unrelated");

console.log("\nUI and localization contracts");
const snapPage = readFileSync("client/src/pages/snap.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");
const en = readFileSync("client/src/locales/en.json", "utf8");
const zhHant = readFileSync("client/src/locales/zh-Hant.json", "utf8");
const yue = readFileSync("client/src/locales/yue.json", "utf8");
const labelRoute = routes.slice(
  routes.indexOf('app.post("/api/snap/label"'),
  routes.indexOf('app.post("/api/snap/disambiguate"'),
);
const adviceRoute = routes.slice(
  routes.indexOf('app.post("/api/snap/advice"'),
  routes.indexOf('app.patch("/api/snap/:snapId/meal-type"'),
);
check("the label response no longer creates food items or subtype tokens",
  !labelRoute.includes("foodItems") && !labelRoute.includes("foodItemsToken"));
check("the snap screen has no carb-subtype picker or item/token payload",
  !snapPage.includes("carb-subtype-picker") &&
  !snapPage.includes("foodItemsToken") &&
  !snapPage.includes("CARB_SUBTYPE_OPTIONS"));
check("advice generates canonical items from confirmed labels and excludes sauces",
  adviceRoute.includes("Identify items only from the user-confirmed Food and Extras / toppings fields") &&
  adviceRoute.includes("Exclude sauces, condiments, spices, seasoning, herbs, and decorative garnishes"));
check("an exact combo logs its own stored items without client subtype input",
  adviceRoute.includes("prepareFoodItems(label?.foodItems)") &&
  adviceRoute.includes("foodItems: structuredFoodItems") &&
  !adviceRoute.includes("applyConfirmedCarbSubtypes"));
check("a legacy cached combo backfills canonical items before logging a meal",
  adviceRoute.includes("const needsFoodItemsBackfill = !!label && structuredFoodItems.length === 0") &&
  adviceRoute.includes("if (cachedAdvice && !needsFoodItemsBackfill)") &&
  adviceRoute.includes("needsFoodItemsBackfill && locale === backfillLocale") &&
  adviceRoute.includes("await storage.saveFoodLabel({ ...labelValues, foodItems: structuredFoodItems })"));
check("food items persist on the exact library combo, not a global meal name",
  schema.includes('foodItems: jsonb("food_items")') &&
  storage.includes("target: foodLabels.internalId") &&
  storage.includes("set: { foodItems }"));
check("the legacy directional explanation remains localized without changing result counts", en.includes("After eating {{food}}, your blood sugar tends to run higher than usual.") &&
  zhHant.includes("你吃{{food}}之後，血糖比平時容易偏高。") &&
  yue.includes("你食{{food}}之後，血糖比平時容易偏高。"));
check("daily summaries classify the canonical HStix value before legacy fallback",
  storage.includes("FROM hstix_readings hr") &&
  storage.includes("effective_mmol") &&
  storage.includes("PHASE1_THRESHOLDS"));
check("creating or correcting a linked HStix reading refreshes its daily summary",
  routes.includes('app.post("/api/hstix/readings"') &&
  routes.includes('app.patch("/api/hstix/readings/:id"') &&
  (routes.match(/reaggregateDailyGlucoseForDate/g) ?? []).length >= 3);

console.log(`\n${passed} passed`);