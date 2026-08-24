import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import type { FoodItemMetadata } from "../shared/schema";
import {
  classifyCarbCategory,
  normalize,
  prepareFoodItems,
} from "../server/carb-subtypes";
import { extractAdviceFoodItems, stripAdviceFoodItems } from "../server/food-items";
import { buildHstixFoodCards } from "../server/glucose-patterns";

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

console.log("\nMeasured HStix lift");
const measuredMeals = Array.from({ length: 25 }, (_, index) => ({
  postMealGlucoseMmol: index < 5 ? 8.2 : 5.5,
  foodItems: index < 24 ? [rice, chicken] : [rice],
  mealTimingConfidence: "on_time" as const,
}));
const cards = buildHstixFoodCards(measuredMeals, "healthy");
const riceCard = cards.find(card => card.foodNameZhHant === "白飯");
check("each reading is classified before totals are calculated", riceCard?.highMeals === 5 && riceCard?.lowMeals === 20);
check("lift uses P(high | food) divided by P(high overall)", riceCard?.lift === 1);
check("foods below 25 eligible on-time meals do not produce cards", !cards.some(card => card.foodNameEn === "Hainanese chicken"));
check("component-free extras never appear as evidence cards", !cards.some(card => card.foodNameEn === "gravy"));
const withDerivedRice = buildHstixFoodCards([
  ...measuredMeals,
  { postMealGlucoseMmol: 8.4, foodItems: [{ ...rice, source: "derived" as const }], mealTimingConfidence: "on_time" as const },
], "healthy");
check("derived historical records are excluded from measured evidence", withDerivedRice.find(card => card.foodNameZhHant === "白飯")?.totalMeals === 25);
check("the shared evidence gate requires 25 eligible meals", buildHstixFoodCards(measuredMeals.slice(0, 24), "healthy").length === 0);
const mixedTimingMeals = [
  ...measuredMeals.slice(0, 24),
  { postMealGlucoseMmol: 8.2, foodItems: [rice], mealTimingConfidence: "delayed" as const },
  { postMealGlucoseMmol: 5.5, foodItems: [chicken], mealTimingConfidence: "unrelated" as const },
];
check(
  "delayed and unrelated readings cannot satisfy the on-time evidence gate",
  buildHstixFoodCards(mixedTimingMeals, "healthy").length === 0,
);

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
check("measured card explanation is localized without a numeric count sentence", en.includes("After eating {{food}}, your blood sugar tends to run higher than usual.") &&
  zhHant.includes("你吃{{food}}之後，血糖比平時容易偏高。") &&
  yue.includes("你食{{food}}之後，血糖比平時容易偏高。"));

console.log(`\n${passed} passed`);