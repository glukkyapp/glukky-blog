import type { FoodItemMetadata } from "@shared/schema";
import { prepareFoodItems } from "./carb-subtypes";

const FOOD_ITEMS_JSON = /\{\s*"foodItems"\s*:\s*\[[\s\S]*?\]\s*\}/;

/**
 * Reads the final, names-only item object appended to an advice response.
 * Claude owns food identity; this function adds only server-derived metadata
 * used by existing individual-food glucose analysis.
 */
export function extractAdviceFoodItems(text: string): FoodItemMetadata[] | null {
  const match = text.match(FOOD_ITEMS_JSON);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { foodItems?: unknown };
    if (!Array.isArray(parsed.foodItems)) return null;
    return prepareFoodItems(parsed.foodItems);
  } catch {
    return null;
  }
}

/** Removes the machine-readable item object before advice is cached or shown. */
export function stripAdviceFoodItems(text: string): string {
  return text.replace(FOOD_ITEMS_JSON, "").trim();
}