import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import type { FoodItemMetadata } from "../shared/schema";
import {
  addSuggestedCarbSubtype,
  applyConfirmedCarbSubtypes,
  classifyCarbCategory,
  foodItemKey,
  getCarbSubtypeOptions,
  normalize,
  prepareFoodItems,
} from "../server/carb-subtypes";
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
  carbSubtype: "white_rice",
  subtypeConfirmed: true,
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
check("the other carb category intentionally has no picker options", getCarbSubtypeOptions("other").length === 0);
const structured = prepareFoodItems([
  { nameEn: "Hainanese chicken", nameZhHant: "海南雞", nameYue: "海南雞" },
  { nameEn: "rice", nameZhHant: "白飯", nameYue: "白飯" },
]);
check("structured dish components remain separate rather than splitting connector text", structured.length === 2 && structured[1].carbCategory === "rice");
const serverRice = { ...rice, carbSubtype: null, subtypeConfirmed: false };
const submittedComponents = [
  { ...serverRice, carbSubtype: "white_rice", subtypeConfirmed: true },
  { nameEn: "gravy", nameZhHant: "肉汁", nameYue: "肉汁", carbSubtype: "white_rice", subtypeConfirmed: true },
];
const serverOwnedComponents = applyConfirmedCarbSubtypes([serverRice], submittedComponents);
check("only signed server components can receive a subtype confirmation", serverOwnedComponents.length === 1 &&
  serverOwnedComponents[0].subtypeConfirmed &&
  serverOwnedComponents[0].carbSubtype === "white_rice");
const suggestedComponents = addSuggestedCarbSubtype([serverRice], new Map([
  [`${foodItemKey(serverRice)}|rice`, "brown_rice"],
]));
check("a confirmed carb component becomes the later default", suggestedComponents[0].suggestedSubtype === "brown_rice" &&
  suggestedComponents[0].subtypeConfirmed === false);

console.log("\nMeasured HStix lift");
const measuredMeals = Array.from({ length: 25 }, (_, index) => ({
  postMealGlucoseMmol: index < 5 ? 8.2 : 5.5,
  foodItems: [index < 5 ? rice : chicken],
}));
const cards = buildHstixFoodCards(measuredMeals, "healthy");
const riceCard = cards.find(card => card.foodNameZhHant === "白飯");
check("each reading is classified before totals are calculated", riceCard?.highMeals === 5 && riceCard?.lowMeals === 0);
check("lift uses P(high | food) divided by P(high overall)", riceCard?.lift === 5);
check("component-free extras never appear as evidence cards", !cards.some(card => card.foodNameEn === "gravy"));
const withDerivedRice = buildHstixFoodCards([
  ...measuredMeals,
  { postMealGlucoseMmol: 8.4, foodItems: [{ ...rice, source: "derived" as const }] },
], "healthy");
check("derived historical records are excluded from measured evidence", withDerivedRice.find(card => card.foodNameZhHant === "白飯")?.totalMeals === 5);
check("the shared evidence gate requires 25 eligible meals", buildHstixFoodCards(measuredMeals.slice(0, 24), "healthy").length === 0);

console.log("\nUI and localization contracts");
const snapPage = readFileSync("client/src/pages/snap.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const en = readFileSync("client/src/locales/en.json", "utf8");
const zhHant = readFileSync("client/src/locales/zh-Hant.json", "utf8");
const yue = readFileSync("client/src/locales/yue.json", "utf8");
check("the carb picker explicitly skips categories with no subtype options", snapPage.includes("item.isCarb && options.length > 0"));
check("a user click records active subtype confirmation", snapPage.includes("subtypeConfirmed: true"));
check("advice accepts only a signed label-time component list", routes.includes("verifyFoodItemsToken(foodItemsToken, userId)") &&
  routes.includes("applyConfirmedCarbSubtypes"));
check("measured card explanation is localized without a numeric count sentence", en.includes("After eating {{food}}, your blood sugar tends to run higher than usual.") &&
  zhHant.includes("你吃{{food}}之後，血糖比平時容易偏高。") &&
  yue.includes("你食{{food}}之後，血糖比平時容易偏高。"));

console.log(`\n${passed} passed`);