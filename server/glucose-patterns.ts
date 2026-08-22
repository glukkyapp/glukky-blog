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

type FoodStats = {
  item: FoodItemMetadata;
  totalMeals: number;
  highMeals: number;
  mediumMeals: number;
  lowMeals: number;
  sumMmol: number;
};

function validCarbCategory(value: string | null): CarbCategory {
  return value === "rice" || value === "noodles" || value === "bread" || value === "potatoes" || value === "other"
    ? value
    : null;
}

export function buildHstixFoodCards(
  snaps: HstixMealForCards[],
  glucoseGroup: GlucoseGroup,
  thresholds?: PersonalisedThresholds,
): HstixFoodCard[] {
  const numericSnaps = snaps.filter(s =>
    typeof s.postMealGlucoseMmol === "number" &&
    Number.isFinite(s.postMealGlucoseMmol) &&
    // A display-time-derived record must not contribute to either the
    // measured food evidence or its baseline.
    !(s.foodItems ?? []).some(item => item.source === "derived"),
  );

  const classified = numericSnaps.map(snap => ({
    snap,
    impact: classifyPostMealMmol(snap.postMealGlucoseMmol!, glucoseGroup, thresholds),
  }));
  const allHighMeals = classified.filter(row => row.impact === "high").length;
  const totalMeals = classified.length;
  const nonHighMeals = totalMeals - allHighMeals;

  // A lift is not meaningful until the shared evidence pool has both
  // outcomes and enough total measured meals.
  if (totalMeals < 25 || allHighMeals < 5 || nonHighMeals < 5) return [];

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
    .filter(food => food.totalMeals >= 5)
    .map(food => {
      const highProbability = food.highMeals / food.totalMeals;
      const scoreCounts: Array<["low" | "medium" | "high", number]> = [
        ["high", food.highMeals],
        ["medium", food.mediumMeals],
        ["low", food.lowMeals],
      ];
      const impactLevel = scoreCounts.sort((a, b) => b[1] - a[1])[0][0] as "low" | "medium" | "high";
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
        lift: highProbability / overallHighProbability,
        avgPostMealMmol: food.sumMmol / food.totalMeals,
        impactLevel,
      };
    })
    .sort((a, b) => b.lift - a.lift || b.totalMeals - a.totalMeals || a.foodNameEn.localeCompare(b.foodNameEn));
}