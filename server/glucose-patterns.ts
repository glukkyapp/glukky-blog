import type { FoodItemMetadata } from "@shared/schema";
import {
  classifyCarbCategory,
  foodItemKey,
  type CarbCategory,
} from "./carb-subtypes";
import {
  classifyPostMealMmol,
  type GlucoseGroup,
  type PersonalisedThresholds,
} from "./glucose-thresholds";

export interface HstixMealForCards {
  postMealGlucoseMmol: number | null;
  foodItems: FoodItemMetadata[] | null;
  mealTimingConfidence: "on_time" | "delayed" | "unrelated";
}

export interface HstixFoodCard {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  carbCategory: CarbCategory;
  totalMeals: number;
  highMeals: number;
  mediumMeals: number;
  lowMeals: number;
  nonHighMeals: number;
  highProbability: number;
  overallHighProbability: number;
  lift: number;
  avgPostMealMmol: number;
  impactLevel: "low" | "medium" | "high";
}

export interface HstixFoodNeedsMoreReadings {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  totalMeals: number;
}

type FoodStats = {
  item: FoodItemMetadata;
  totalMeals: number;
  highMeals: number;
  mediumMeals: number;
  lowMeals: number;
  sumMmol: number;
};

export const MIN_HSTIX_FOOD_MEALS_FOR_CARD = 25;

function validCarbCategory(value: string | null): CarbCategory {
  return value === "rice" || value === "noodles" || value === "bread" || value === "potatoes" || value === "other"
    ? value
    : null;
}

export function buildHstixFoodCards(
  snaps: HstixMealForCards[],
  glucoseGroup: GlucoseGroup,
  _thresholds?: PersonalisedThresholds,
): HstixFoodCard[] {
  const numericSnaps = snaps.filter(s =>
    typeof s.postMealGlucoseMmol === "number" &&
    Number.isFinite(s.postMealGlucoseMmol) &&
    // Food attribution is only valid for readings in the post-meal window.
    s.mealTimingConfidence === "on_time" &&
    // A display-time-derived record must not contribute to either the
    // measured food evidence or its baseline.
    !(s.foodItems ?? []).some(item => item.source === "derived"),
  );

  const classified = numericSnaps.map(snap => ({
    snap,
    // Food evidence uses the fixed phase-one bands so its comparisons stay
    // consistent as a user's personalised thresholds evolve.
    impact: classifyPostMealMmol(snap.postMealGlucoseMmol!, glucoseGroup),
  }));
  const allHighMeals = classified.filter(row => row.impact === "high").length;
  const totalMeals = classified.length;
  const expectedBaselineRank = classified.reduce(
    (sum, row) => sum + (row.impact === "high" ? 2 : row.impact === "medium" ? 1 : 0),
    0,
  ) / totalMeals;

  // There is no meaningful food-to-baseline comparison when all eligible
  // baseline readings are low.
  if (expectedBaselineRank === 0) return [];

  const stats = new Map<string, FoodStats>();
  for (const { snap, impact } of classified) {
    const seenThisMeal = new Set<string>();
    for (const item of (snap.foodItems ?? []).filter(candidate => candidate.source !== "derived")) {
      const key = foodItemKey(item);
      if (seenThisMeal.has(key)) continue;
      seenThisMeal.add(key);
      const current = stats.get(key) ?? {
        item,
        totalMeals: 0,
        highMeals: 0,
        mediumMeals: 0,
        lowMeals: 0,
        sumMmol: 0,
      };
      current.totalMeals += 1;
      current[`${impact}Meals`] += 1;
      current.sumMmol += snap.postMealGlucoseMmol!;
      stats.set(key, current);
    }
  }

  const overallHighProbability = allHighMeals / totalMeals;
  return Array.from(stats.values())
    .filter(food => food.totalMeals >= MIN_HSTIX_FOOD_MEALS_FOR_CARD)
    .map(food => {
      const highProbability = food.highMeals / food.totalMeals;
      const expectedFoodRank = (food.mediumMeals + 2 * food.highMeals) / food.totalMeals;
      const lift = expectedFoodRank / expectedBaselineRank;
      const impactLevel: HstixFoodCard["impactLevel"] = lift > 1.2 ? "high" : lift < 0.8 ? "low" : "medium";
      return {
        foodKey: foodItemKey(food.item),
        foodNameEn: food.item.nameEn,
        foodNameZhHant: food.item.nameZhHant,
        foodNameYue: food.item.nameYue,
        carbCategory: validCarbCategory(food.item.carbCategory) ?? classifyCarbCategory(food.item),
        totalMeals: food.totalMeals,
        highMeals: food.highMeals,
        mediumMeals: food.mediumMeals,
        lowMeals: food.lowMeals,
        nonHighMeals: food.totalMeals - food.highMeals,
        highProbability,
        overallHighProbability,
        lift,
        avgPostMealMmol: food.sumMmol / food.totalMeals,
        impactLevel,
      };
    })
    .sort((a, b) => a.foodKey.localeCompare(b.foodKey));
}

export function buildHstixFoodsNeedingMoreReadings(
  snaps: HstixMealForCards[],
): HstixFoodNeedsMoreReadings[] {
  const foods = new Map<string, { item: FoodItemMetadata; totalMeals: number }>();
  for (const snap of snaps) {
    if (
      typeof snap.postMealGlucoseMmol !== "number" ||
      !Number.isFinite(snap.postMealGlucoseMmol) ||
      snap.mealTimingConfidence !== "on_time" ||
      (snap.foodItems ?? []).some(item => item.source === "derived")
    ) continue;

    const seenThisMeal = new Set<string>();
    for (const item of (snap.foodItems ?? []).filter(item => item.source !== "derived")) {
      const key = foodItemKey(item);
      if (seenThisMeal.has(key)) continue;
      seenThisMeal.add(key);
      const current = foods.get(key) ?? { item, totalMeals: 0 };
      current.totalMeals += 1;
      foods.set(key, current);
    }
  }

  return Array.from(foods.values())
    .filter(food => food.totalMeals < MIN_HSTIX_FOOD_MEALS_FOR_CARD)
    .map(food => ({
      foodKey: foodItemKey(food.item),
      foodNameEn: food.item.nameEn,
      foodNameZhHant: food.item.nameZhHant,
      foodNameYue: food.item.nameYue,
      totalMeals: food.totalMeals,
    }))
    .sort((a, b) => a.foodKey.localeCompare(b.foodKey));
}