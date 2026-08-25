import type { FoodItemMetadata } from "@shared/schema";
import {
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
  // Historical meal-row values are deliberately marked false by storage and
  // cannot become measured-food evidence.
  isCanonicalHstix: boolean;
}

export interface HstixPartnerFood {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
}

export type HstixFoodPartnerInsight =
  | {
      kind: "dominant";
      partner: HstixPartnerFood;
    }
  | {
      kind: "comparison";
      higherPartner: HstixPartnerFood;
      lowerPartner: HstixPartnerFood;
    };

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
  partnerInsight?: HstixFoodPartnerInsight;
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

/**
 * This is the single evidence gate for measured-food analysis. It deliberately
 * excludes legacy meal-row values, delayed/unrelated readings, non-finite
 * values, and any meal whose food list contains a display-time-derived
 * component.
 */
export function filterEligibleHstixMeals(snaps: HstixMealForCards[]): HstixMealForCards[] {
  return snaps.filter(s =>
    typeof s.postMealGlucoseMmol === "number" &&
    Number.isFinite(s.postMealGlucoseMmol) &&
    s.isCanonicalHstix === true &&
    s.mealTimingConfidence === "on_time" &&
    !(s.foodItems ?? []).some(item => item.source === "derived"),
  );
}

function validCarbCategory(value: string | null): CarbCategory {
  return value === "rice" || value === "noodles" || value === "bread" || value === "potatoes" || value === "other"
    ? value
    : null;
}

/**
 * The label pipeline owns both carb fields. Require the positive carb flag and
 * a supported category before a food can become a measured index card.
 * Partners intentionally do not use this helper: any non-derived food may be
 * paired with a carb index food.
 */
function validatedCarbCategory(item: FoodItemMetadata): CarbCategory {
  if (item.isCarb !== true) return null;
  return validCarbCategory(item.carbCategory);
}

export function buildHstixFoodCards(
  snaps: HstixMealForCards[],
  glucoseGroup: GlucoseGroup,
  _thresholds?: PersonalisedThresholds,
): HstixFoodCard[] {
  const numericSnaps = filterEligibleHstixMeals(snaps);

  const classified = numericSnaps.map(snap => ({
    snap,
    // Food evidence uses the fixed phase-one bands so its comparisons stay
    // consistent as a user's personalised thresholds evolve.
    impact: classifyPostMealMmol(snap.postMealGlucoseMmol!, glucoseGroup),
  }));
  const allHighMeals = classified.filter(row => row.impact === "high").length;
  const totalMeals = classified.length;
  if (totalMeals === 0) return [];
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
    for (const item of (snap.foodItems ?? []).filter(candidate =>
      candidate.source !== "derived" && validatedCarbCategory(candidate) !== null,
    )) {
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
  const cards = Array.from(stats.values())
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
        carbCategory: validatedCarbCategory(food.item),
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
  const partnerInsights = buildHstixPartnerInsights(numericSnaps, cards);
  return cards.map(card => {
    const partnerInsight = partnerInsights.get(card.foodKey);
    return partnerInsight ? { ...card, partnerInsight } : card;
  });
}

function partnerFromItem(item: FoodItemMetadata): HstixPartnerFood {
  return {
    foodKey: foodItemKey(item),
    foodNameEn: item.nameEn,
    foodNameZhHant: item.nameZhHant,
    foodNameYue: item.nameYue,
  };
}

function comparePartnerFood(a: HstixPartnerFood, b: HstixPartnerFood): number {
  return a.foodKey.localeCompare(b.foodKey);
}

/**
 * Finds association-only insights for the at-most-ten strongest measured
 * Higher/Lower cards. The random Medium display sample is intentionally not
 * passed here.
 */
export function buildHstixPartnerInsights(
  snaps: HstixMealForCards[],
  cards: HstixFoodCard[],
): Map<string, HstixFoodPartnerInsight> {
  const eligibleMeals = filterEligibleHstixMeals(snaps);
  const candidates = [
    ...cards
      .filter(card => card.impactLevel === "high" && card.carbCategory !== null)
      .sort((a, b) => b.lift - a.lift || comparePartnerFood(a, b))
      .slice(0, 5),
    ...cards
      .filter(card => card.impactLevel === "low" && card.carbCategory !== null)
      .sort((a, b) => a.lift - b.lift || comparePartnerFood(a, b))
      .slice(0, 5),
  ];
  const insights = new Map<string, HstixFoodPartnerInsight>();

  for (const candidate of candidates) {
    type PartnerStats = {
      item: FoodItemMetadata;
      count: number;
      sumMmol: number;
    };
    const partnerStats = new Map<string, PartnerStats>();
    let indexMealCount = 0;

    for (const meal of eligibleMeals) {
      const mealItems = (meal.foodItems ?? []).filter(item => item.source !== "derived");
      const uniqueItems = new Map<string, FoodItemMetadata>();
      for (const item of mealItems) uniqueItems.set(foodItemKey(item), item);
      if (!uniqueItems.has(candidate.foodKey)) continue;
      indexMealCount += 1;

      for (const [partnerKey, item] of Array.from(uniqueItems.entries())) {
        if (partnerKey === candidate.foodKey) continue;
        const current = partnerStats.get(partnerKey) ?? {
          item,
          count: 0,
          sumMmol: 0,
        };
        current.count += 1;
        current.sumMmol += meal.postMealGlucoseMmol!;
        partnerStats.set(partnerKey, current);
      }
    }

    if (indexMealCount === 0) continue;
    const partners = Array.from(partnerStats.entries()).map(([foodKey, stats]) => ({
      foodKey,
      ...stats,
      share: stats.count / indexMealCount,
      partner: partnerFromItem(stats.item),
      meanMmol: stats.sumMmol / stats.count,
    }));
    const dominant = partners
      .filter(partner => partner.share > 0.7)
      .sort((a, b) => b.count - a.count || a.foodKey.localeCompare(b.foodKey))[0];
    if (dominant) {
      insights.set(candidate.foodKey, {
        kind: "dominant",
        partner: dominant.partner,
      });
      continue;
    }

    const selectedPartners = partners
      .filter(partner => partner.share >= 0.16)
      .sort((a, b) => b.count - a.count || a.foodKey.localeCompare(b.foodKey))
      .slice(0, 3);
    if (selectedPartners.length < 2) continue;

    const highest = selectedPartners.reduce((best, partner) =>
      partner.meanMmol > best.meanMmol ||
      (partner.meanMmol === best.meanMmol && partner.foodKey.localeCompare(best.foodKey) < 0)
        ? partner
        : best,
    );
    const lowest = selectedPartners.reduce((best, partner) =>
      partner.meanMmol < best.meanMmol ||
      (partner.meanMmol === best.meanMmol && partner.foodKey.localeCompare(best.foodKey) < 0)
        ? partner
        : best,
    );
    if (highest.meanMmol - lowest.meanMmol <= 1.5) continue;

    insights.set(candidate.foodKey, {
      kind: "comparison",
      higherPartner: highest.partner,
      lowerPartner: lowest.partner,
    });
  }

  return insights;
}

export function buildHstixFoodsNeedingMoreReadings(
  snaps: HstixMealForCards[],
): HstixFoodNeedsMoreReadings[] {
  const foods = new Map<string, { item: FoodItemMetadata; totalMeals: number }>();
  for (const snap of filterEligibleHstixMeals(snaps)) {

    const seenThisMeal = new Set<string>();
    for (const item of (snap.foodItems ?? []).filter(item =>
      item.source !== "derived" && validatedCarbCategory(item) !== null,
    )) {
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