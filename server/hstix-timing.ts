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

  const minutesSinceLastMeal = Math.floor((recordedAt.getTime() - lastMealAt.getTime()) / 60_000);
  if (minutesSinceLastMeal < 0 || minutesSinceLastMeal > 240) {
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