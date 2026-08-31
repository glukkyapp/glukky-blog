import assert from "node:assert/strict";
import { extractAdviceFoodItems } from "../server/food-items";
import {
  classifySweetCategory,
  prepareFoodItems,
} from "../server/carb-subtypes";
import {
  buildFoodFrequencySummary,
  FOOD_FREQUENCY_MEAL_THRESHOLD,
} from "../server/food-frequency";
import type { FoodItemMetadata, MealSnap } from "../shared/schema";

const rawItem = (names: Partial<Pick<FoodItemMetadata, "nameEn" | "nameZhHant" | "nameYue">>) => ({
  nameEn: names.nameEn ?? "Food",
  nameZhHant: names.nameZhHant ?? "食物",
  nameYue: names.nameYue ?? "食物",
});

const meal = (foodItems: FoodItemMetadata[], isDeleted = false) =>
  ({ foodItems, isDeleted } as Pick<MealSnap, "foodItems" | "isDeleted">);

function item(names: Parameters<typeof rawItem>[0], source: "claude" | "derived" = "claude") {
  return prepareFoodItems([{ ...rawItem(names), source }])[0];
}

const milkTea = item({ nameEn: "Hong Kong milk tea", nameZhHant: "港式奶茶", nameYue: "奶茶" });
const soda = item({ nameEn: "Soda", nameZhHant: "汽水", nameYue: "汽水" });
const rice = item({ nameEn: "White rice", nameZhHant: "白飯", nameYue: "白飯" });
const noodles = item({ nameEn: "Rice noodles", nameZhHant: "米粉", nameYue: "米粉" });
const bread = item({ nameEn: "Toast", nameZhHant: "多士", nameYue: "多士" });
const potatoes = item({ nameEn: "Sweet potato", nameZhHant: "番薯", nameYue: "番薯" });
const otherCarb = item({ nameEn: "Oatmeal", nameZhHant: "燕麥", nameYue: "燕麥" });
assert(milkTea && soda && rice && noodles && bread && potatoes && otherCarb);

assert.equal(classifySweetCategory(rawItem({ nameEn: "milk tea", nameZhHant: "奶茶", nameYue: "奶茶" })), "sweet_drink");
assert.equal(classifySweetCategory(rawItem({ nameEn: "soda", nameZhHant: "汽水", nameYue: "汽水" })), "sweet_drink");
assert.equal(classifySweetCategory(rawItem({ nameEn: "no sugar milk tea", nameZhHant: "無糖奶茶", nameYue: "走糖奶茶" })), null);
assert.equal(classifySweetCategory(rawItem({ nameEn: "unsweetened soda", nameZhHant: "無糖汽水", nameYue: "走甜汽水" })), null);
assert.equal(classifySweetCategory(rawItem({ nameEn: "Zero-Sugar Milk Tea", nameZhHant: "零糖奶茶", nameYue: "零糖奶茶" })), null);
assert.equal(classifySweetCategory(rawItem({ nameEn: "0 sugar soda", nameZhHant: "零糖汽水", nameYue: "零糖汽水" })), null);

const parsedAdvice = extractAdviceFoodItems(
  'Advice text\n{"foodItems":[{"nameEn":"milk tea","nameZhHant":"奶茶","nameYue":"奶茶"},{"nameEn":"soda","nameZhHant":"汽水","nameYue":"汽水"}]}',
);
assert.deepEqual(parsedAdvice?.map(food => food.sweetCategory), ["sweet_drink", "sweet_drink"]);
assert.deepEqual(parsedAdvice?.map(food => food.isSweet), [true, true]);

const duplicatedMealSummary = buildFoodFrequencySummary([
  meal([milkTea, milkTea, soda, rice]),
  meal([milkTea, soda]),
  meal([milkTea]),
  meal([soda]),
]);
assert.equal(duplicatedMealSummary.totalMeals, 4);
assert.equal(duplicatedMealSummary.foods.find(food => food.nameEn === milkTea.nameEn)?.mealCount, 3);
assert.equal(duplicatedMealSummary.foods.find(food => food.nameEn === soda.nameEn)?.mealCount, 3);
assert.equal(duplicatedMealSummary.foods.find(food => food.nameEn === rice.nameEn)?.mealCount, 1);
assert.deepEqual(duplicatedMealSummary.sweetSubtypes, [{ sweetCategory: "sweet_drink", mealCount: 4 }]);
assert.deepEqual(duplicatedMealSummary.carbCategories, [{ carbCategory: "rice", mealCount: 1 }]);

const carbCategorySummary = buildFoodFrequencySummary([
  meal([rice, rice, noodles, bread, potatoes, otherCarb]),
  meal([rice, noodles]),
]);
assert.deepEqual(carbCategorySummary.carbCategories, [
  { carbCategory: "noodles", mealCount: 2 },
  { carbCategory: "rice", mealCount: 2 },
  { carbCategory: "bread", mealCount: 1 },
  { carbCategory: "other", mealCount: 1 },
  { carbCategory: "potatoes", mealCount: 1 },
]);

const dualClassified = item({ nameEn: "sweet bun", nameZhHant: "甜包", nameYue: "甜包" });
assert(dualClassified);
assert.equal(dualClassified.isCarb, true);
assert.equal(dualClassified.isSweet, true);
const dualSummary = buildFoodFrequencySummary([meal([dualClassified, dualClassified])]);
assert.equal(dualSummary.foods.length, 1);
assert.equal(dualSummary.foods[0].mealCount, 1);
assert.deepEqual(dualSummary.sweetSubtypes, [{ sweetCategory: "sweet_food", mealCount: 1 }]);
assert.deepEqual(dualSummary.carbCategories, [{ carbCategory: "bread", mealCount: 1 }]);

const legacyItem = {
  ...rawItem({ nameEn: "Legacy dish", nameZhHant: "舊菜式", nameYue: "舊菜式" }),
  isCarb: false,
  carbCategory: null,
  carbSubtype: null,
  subtypeConfirmed: false,
  source: "claude" as const,
};
const legacySummary = buildFoodFrequencySummary([meal([legacyItem])]);
assert.equal(legacySummary.foods[0].sweetCategory, undefined);
assert.equal(legacySummary.sweetSubtypes.length, 0);
assert.equal(legacySummary.carbCategories.length, 0);

const derivedSummary = buildFoodFrequencySummary([
  meal([milkTea, { ...soda, source: "derived" }]),
]);
assert.equal(derivedSummary.foods.some(food => food.nameEn === soda.nameEn), false);

const twentyFourMeals = buildFoodFrequencySummary(
  Array.from({ length: FOOD_FREQUENCY_MEAL_THRESHOLD - 1 }, () => meal([milkTea])),
);
const twentyFiveMeals = buildFoodFrequencySummary(
  Array.from({ length: FOOD_FREQUENCY_MEAL_THRESHOLD }, () => meal([milkTea])),
);
assert.equal(twentyFourMeals.eligible, false);
assert.equal(twentyFiveMeals.eligible, true);

const deletedMealSummary = buildFoodFrequencySummary([
  meal([milkTea]),
  meal([milkTea], true),
]);
assert.equal(deletedMealSummary.totalMeals, 1);
assert.equal(deletedMealSummary.foods[0].mealCount, 1);

console.log("food-frequency tests passed");