import type { MealTimingConfidence } from "@shared/schema";

export type HstixTiming = {
  minutesSinceLastMeal: number | null;
  mealTimingConfidence: MealTimingConfidence;
  shouldAssociateMeal: boolean;
};

export function classifyHstixTiming(recordedAt: Date, lastMealAt: Date | null): HstixTiming {
  if (!lastMealAt) {
    return {
      minutesSinceLastMeal: null,
      mealTimingConfidence: "unrelated",
      shouldAssociateMeal: false,
    };
  }

  const elapsedMs = recordedAt.getTime() - lastMealAt.getTime();
  const minutesSinceLastMeal = Math.floor(elapsedMs / 60_000);
  // Classify against the actual elapsed timestamp, not the rounded display
  // value: 240:00 is delayed, while 240:00.001 is unrelated.
  if (elapsedMs < 0 || elapsedMs > 240 * 60_000) {
    return {
      minutesSinceLastMeal: minutesSinceLastMeal < 0 ? null : minutesSinceLastMeal,
      mealTimingConfidence: "unrelated",
      shouldAssociateMeal: false,
    };
  }

  return {
    minutesSinceLastMeal,
    mealTimingConfidence: minutesSinceLastMeal <= 120 ? "on_time" : "delayed",
    shouldAssociateMeal: true,
  };
}