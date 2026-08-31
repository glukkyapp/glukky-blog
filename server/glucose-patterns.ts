import type { FoodItemMetadata, SweetCategory } from "@shared/schema";
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
  sweetCategory: SweetCategory;
  componentType: GlucosePatternComponentType;
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
  carbCategory: CarbCategory;
  sweetCategory: SweetCategory;
  componentType: GlucosePatternComponentType;
  totalMeals: number;
}

export type GlucosePatternComponentType = "carb" | "sweet_food" | "sweet_drink";

export interface GeneralGlucosePatternComponent {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  carbCategory: CarbCategory;
  sweetCategory: SweetCategory;
  componentType: GlucosePatternComponentType;
  mealCount: number;
}

export interface GeneralGlucosePatternMeal {
  foodItems: FoodItemMetadata[] | null;
  isDeleted?: boolean;
}

type FoodStats = {
  item: FoodItemMetadata;
  totalMeals: number;
  highMeals: number;
  mediumMeals: number;
  lowMeals: number;
  sumMmol: number;
  presentScores: number[];
};

export const MIN_HSTIX_FOOD_MEALS_FOR_CARD = 25;
// This stricter bar directly supports food-avoidance guidance and is
// achievable because each directional card already requires at least
// 25 food-present and 25 food-absent eligible meals.
const HSTIX_RELIABILITY_THRESHOLD = 1.96;

function impactScore(impact: "low" | "medium" | "high"): number {
  return impact === "high" ? 2 : impact === "medium" ? 1 : 0;
}

/**
 * Checks whether the score difference between mutually exclusive food-present
 * and food-absent meals is strong enough to support the card's direction.
 *
 * This is deliberately separate from the displayed lift calculation. It uses
 * the sample variance of the 0/1/2 impact scores in each group and is never
 * included in the card or API response.
 */
export function isReliableHstixFoodEvidence(
  presentScores: number[],
  absentScores: number[],
  direction: "low" | "high",
): boolean {
  if (
    presentScores.length < MIN_HSTIX_FOOD_MEALS_FOR_CARD ||
    absentScores.length < MIN_HSTIX_FOOD_MEALS_FOR_CARD
  ) {
    return false;
  }

  const mean = (scores: number[]) => scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const sampleVariance = (scores: number[], average: number) =>
    scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / (scores.length - 1);
  const presentMean = mean(presentScores);
  const absentMean = mean(absentScores);
  const difference = presentMean - absentMean;
  const directionMatches = direction === "high" ? difference > 0 : difference < 0;

  // A zero standard error still supports a directional result when both
  // groups are constant but have different means. Equal constant groups have
  // no directional evidence and must remain suppressed.
  if (!directionMatches) return false;

  const standardErrorSquared =
    sampleVariance(presentScores, presentMean) / presentScores.length +
    sampleVariance(absentScores, absentMean) / absentScores.length;
  if (!Number.isFinite(standardErrorSquared) || standardErrorSquared < 0) return false;
  if (standardErrorSquared === 0) return true;

  const reliability = difference / Math.sqrt(standardErrorSquared);
  return direction === "high"
    ? Number.isFinite(reliability) && reliability >= HSTIX_RELIABILITY_THRESHOLD
    : Number.isFinite(reliability) && reliability <= -HSTIX_RELIABILITY_THRESHOLD;
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
export function validatedGlucosePatternCarbCategory(item: FoodItemMetadata): CarbCategory {
  if (item.isCarb !== true) return null;
  return validCarbCategory(item.carbCategory);
}

function validatedSweetCategory(item: FoodItemMetadata): SweetCategory {
  return item.sweetCategory === "sweet_food" || item.sweetCategory === "sweet_drink"
    ? item.sweetCategory
    : null;
}

/**
 * Analysis-only component eligibility. FoodSnap identification owns the stored
 * metadata; Glucose Patterns only consumes authoritative, non-derived carb or
 * sweet classifications.
 */
export function isEligibleGlucosePatternComponent(item: FoodItemMetadata): boolean {
  return item.source !== "derived" && (
    validatedGlucosePatternCarbCategory(item) !== null ||
    validatedSweetCategory(item) !== null
  );
}

export function glucosePatternComponentType(item: FoodItemMetadata): GlucosePatternComponentType | null {
  if (validatedGlucosePatternCarbCategory(item) !== null) return "carb";
  return validatedSweetCategory(item);
}

export function buildGeneralGlucosePatternComponents(
  meals: GeneralGlucosePatternMeal[],
): GeneralGlucosePatternComponent[] {
  const components = new Map<string, { item: FoodItemMetadata; mealCount: number }>();

  for (const meal of meals) {
    if (meal.isDeleted === true) continue;
    const seenThisMeal = new Set<string>();
    for (const item of meal.foodItems ?? []) {
      if (!isEligibleGlucosePatternComponent(item)) continue;
      const foodKey = foodItemKey(item);
      if (seenThisMeal.has(foodKey)) continue;
      seenThisMeal.add(foodKey);
      const current = components.get(foodKey);
      if (current) {
        current.mealCount += 1;
      } else {
        components.set(foodKey, { item, mealCount: 1 });
      }
    }
  }

  return Array.from(components.entries())
    .map(([foodKey, { item, mealCount }]) => ({
      foodKey,
      foodNameEn: item.nameEn,
      foodNameZhHant: item.nameZhHant,
      foodNameYue: item.nameYue,
      carbCategory: validatedGlucosePatternCarbCategory(item),
      sweetCategory: validatedSweetCategory(item),
      componentType: glucosePatternComponentType(item)!,
      mealCount,
    }))
    .sort((a, b) => b.mealCount - a.mealCount || a.foodKey.localeCompare(b.foodKey));
}

/**
 * This is the evidence gate for measured-food analysis. It excludes legacy
 * meal-row values, delayed/unrelated readings and non-finite values, and
 * requires at least one authoritative component accepted by the shared
 * Glucose Patterns analysis gate.
 */
export function filterEligibleHstixMeals(snaps: HstixMealForCards[]): HstixMealForCards[] {
  return snaps.filter(s =>
    typeof s.postMealGlucoseMmol === "number" &&
    Number.isFinite(s.postMealGlucoseMmol) &&
    s.isCanonicalHstix === true &&
    s.mealTimingConfidence === "on_time" &&
    (s.foodItems ?? []).some(isEligibleGlucosePatternComponent),
  );
}

export function buildHstixFoodCards(
  snaps: HstixMealForCards[],
  glucoseGroup: GlucoseGroup,
  _thresholds?: PersonalisedThresholds,
): HstixFoodCard[] {
  const numericSnaps = filterEligibleHstixMeals(snaps);

  const classified = numericSnaps.map(snap => {
    // Food evidence uses the fixed phase-one bands so its comparisons stay
    // consistent as a user's personalised thresholds evolve.
    const impact = classifyPostMealMmol(snap.postMealGlucoseMmol!, glucoseGroup);
    return {
      snap,
      impact,
      score: impactScore(impact),
      foodKeys: new Set(
        (snap.foodItems ?? [])
          .filter(isEligibleGlucosePatternComponent)
          .map(item => foodItemKey(item)),
      ),
    };
  });
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
  for (const row of classified) {
    const { snap, impact } = row;
    const seenThisMeal = new Set<string>();
    for (const item of (snap.foodItems ?? []).filter(isEligibleGlucosePatternComponent)) {
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
        presentScores: [],
      };
      current.totalMeals += 1;
      current[`${impact}Meals`] += 1;
      current.sumMmol += snap.postMealGlucoseMmol!;
      current.presentScores.push(row.score);
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
      if (impactLevel !== "medium") {
        const foodKey = foodItemKey(food.item);
        const absentScores = classified
          .filter(row => !row.foodKeys.has(foodKey))
          .map(row => row.score);
        if (!isReliableHstixFoodEvidence(food.presentScores, absentScores, impactLevel)) {
          return null;
        }
      }
      return {
        foodKey: foodItemKey(food.item),
        foodNameEn: food.item.nameEn,
        foodNameZhHant: food.item.nameZhHant,
        foodNameYue: food.item.nameYue,
        carbCategory: validatedGlucosePatternCarbCategory(food.item),
        sweetCategory: validatedSweetCategory(food.item),
        componentType: glucosePatternComponentType(food.item)!,
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
    .filter((card): card is HstixFoodCard => card !== null)
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
      .filter(card => card.impactLevel === "high")
      .sort((a, b) => b.lift - a.lift || comparePartnerFood(a, b))
      .slice(0, 5),
    ...cards
      .filter(card => card.impactLevel === "low")
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
      const mealItems = (meal.foodItems ?? []).filter(isEligibleGlucosePatternComponent);
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
    for (const item of (snap.foodItems ?? []).filter(isEligibleGlucosePatternComponent)) {
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
      carbCategory: validatedGlucosePatternCarbCategory(food.item),
      sweetCategory: validatedSweetCategory(food.item),
      componentType: glucosePatternComponentType(food.item)!,
      totalMeals: food.totalMeals,
    }))
    .sort((a, b) => a.foodKey.localeCompare(b.foodKey));
}