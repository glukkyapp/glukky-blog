import type { FoodItemMetadata, MealSnap, SweetCategory } from "@shared/schema";
import { foodItemKey, type CarbCategory } from "./carb-subtypes";

export const FOOD_FREQUENCY_MEAL_THRESHOLD = 25;

export type FoodFrequencyFood = Pick<FoodItemMetadata, "nameEn" | "nameZhHant" | "nameYue"> & {
  mealCount: number;
  carbCategory: CarbCategory;
  // Undefined is preserved for legacy items whose sweet fields predate this
  // feature. It is distinct from a newly classified non-sweet null.
  sweetCategory?: SweetCategory;
};

export type FoodFrequencySubtype = {
  sweetCategory: Exclude<SweetCategory, null>;
  mealCount: number;
};

export type FoodFrequencyCarbCategory = {
  carbCategory: Exclude<CarbCategory, null>;
  mealCount: number;
};

export type FoodFrequencySummary = {
  totalMeals: number;
  eligible: boolean;
  foods: FoodFrequencyFood[];
  sweetSubtypes: FoodFrequencySubtype[];
  carbCategories: FoodFrequencyCarbCategory[];
};

/**
 * This is the single selector used by both the General card response and the
 * background GI resolver. Keep the existing display rule here so enrichment
 * cannot drift from the cards it annotates.
 */
export function selectGeneralTopFoods(foods: FoodFrequencyFood[]): FoodFrequencyFood[] {
  return foods.filter(food => food.mealCount > 1).slice(0, 5);
}

type FrequencySnap = Pick<MealSnap, "foodItems" | "isDeleted">;

/**
 * Counts a component once per meal. Food identity uses all three canonical
 * names, while sweet subtype and carb-category identity are counted
 * independently, so one component can contribute to both without appearing
 * twice as a food.
 * Legacy items without sweet metadata stay unclassified.
 */
export function buildFoodFrequencySummary(snaps: FrequencySnap[]): FoodFrequencySummary {
  const activeSnaps = snaps.filter(snap => snap.isDeleted !== true);
  const foods = new Map<string, FoodFrequencyFood>();
  const sweetSubtypes = new Map<Exclude<SweetCategory, null>, number>();
  const carbCategories = new Map<Exclude<CarbCategory, null>, number>();

  for (const snap of activeSnaps) {
    const seenFoodsThisMeal = new Set<string>();
    const seenSweetSubtypesThisMeal = new Set<Exclude<SweetCategory, null>>();
    const seenCarbCategoriesThisMeal = new Set<Exclude<CarbCategory, null>>();

    for (const item of (snap.foodItems ?? [])) {
      if (item.source === "derived") continue;

      const key = foodItemKey(item);
      if (!seenFoodsThisMeal.has(key)) {
        seenFoodsThisMeal.add(key);
        const existing = foods.get(key);
        if (existing) {
          existing.mealCount += 1;
        } else {
          foods.set(key, {
            nameEn: item.nameEn,
            nameZhHant: item.nameZhHant,
            nameYue: item.nameYue,
            mealCount: 1,
            carbCategory: item.isCarb === true ? (item.carbCategory as CarbCategory) : null,
            sweetCategory: item.sweetCategory,
          });
        }
      }

      // A missing legacy field is unknown, not false. A known null is the
      // explicit result of classifying a newly prepared non-sweet item.
      if (item.sweetCategory != null) {
        const category = item.sweetCategory as Exclude<SweetCategory, null>;
        if (!seenSweetSubtypesThisMeal.has(category)) {
          seenSweetSubtypesThisMeal.add(category);
          sweetSubtypes.set(category, (sweetSubtypes.get(category) ?? 0) + 1);
        }
      }

      const carbCategory = item.isCarb === true ? item.carbCategory : null;
      if (
        carbCategory === "rice" ||
        carbCategory === "noodles" ||
        carbCategory === "bread" ||
        carbCategory === "potatoes" ||
        carbCategory === "other"
      ) {
        if (!seenCarbCategoriesThisMeal.has(carbCategory)) {
          seenCarbCategoriesThisMeal.add(carbCategory);
          carbCategories.set(carbCategory, (carbCategories.get(carbCategory) ?? 0) + 1);
        }
      }
    }
  }

  return {
    totalMeals: activeSnaps.length,
    eligible: activeSnaps.length >= FOOD_FREQUENCY_MEAL_THRESHOLD,
    foods: Array.from(foods.values()).sort((a, b) => b.mealCount - a.mealCount || a.nameEn.localeCompare(b.nameEn)),
    sweetSubtypes: Array.from(sweetSubtypes.entries())
      .map(([sweetCategory, mealCount]) => ({ sweetCategory, mealCount }))
      .sort((a, b) => b.mealCount - a.mealCount || a.sweetCategory.localeCompare(b.sweetCategory)),
    carbCategories: Array.from(carbCategories.entries())
      .map(([carbCategory, mealCount]) => ({ carbCategory, mealCount }))
      .sort((a, b) => b.mealCount - a.mealCount || a.carbCategory.localeCompare(b.carbCategory)),
  };
}