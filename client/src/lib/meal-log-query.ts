import type {
  FinalImpactMealLogResponse,
  MealLogResponse,
  KnownImpact,
} from "@/lib/meal-presentation";

export const FINAL_IMPACT_STALE_TIME_MS = 15 * 60 * 1000;

export function mealLogQueryKey(month: string, includeFinalImpact: boolean) {
  return ["/api/snap/meal-log", month, { includeFinalImpact }] as const;
}

export function mealLogUrl(month: string, includeFinalImpact: boolean): string {
  const params = new URLSearchParams({ month });
  if (includeFinalImpact) params.set("includeFinalImpact", "true");
  return `/api/snap/meal-log?${params.toString()}`;
}

function isKnownImpact(value: unknown): value is KnownImpact {
  return value === "low" || value === "medium" || value === "high";
}

function validateFinalImpactResponse(value: unknown): asserts value is FinalImpactMealLogResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Meal history returned an invalid response.");
  }
  const response = value as { month?: unknown; items?: unknown };
  if (typeof response.month !== "string" || !Array.isArray(response.items)) {
    throw new Error("Meal history returned an invalid response.");
  }
  for (const item of response.items) {
    if (!item || typeof item !== "object" || !Object.prototype.hasOwnProperty.call(item, "finalGlucoseImpact")) {
      throw new Error("Meal history is missing its final impact assessment.");
    }
    const impact = (item as { finalGlucoseImpact?: unknown }).finalGlucoseImpact;
    if (impact !== null && !isKnownImpact(impact)) {
      throw new Error("Meal history returned an invalid final impact assessment.");
    }
  }
}

export async function fetchMealLog(month: string, includeFinalImpact: true): Promise<FinalImpactMealLogResponse>;
export async function fetchMealLog(month: string, includeFinalImpact: false): Promise<MealLogResponse>;
export async function fetchMealLog(
  month: string,
  includeFinalImpact: boolean,
): Promise<MealLogResponse | FinalImpactMealLogResponse>;
export async function fetchMealLog(
  month: string,
  includeFinalImpact: boolean,
): Promise<MealLogResponse | FinalImpactMealLogResponse> {
  const response = await fetch(mealLogUrl(month, includeFinalImpact), { credentials: "include" });
  if (!response.ok) throw new Error("Meals are temporarily unavailable.");
  const payload: unknown = await response.json();
  if (includeFinalImpact) validateFinalImpactResponse(payload);
  return payload as MealLogResponse | FinalImpactMealLogResponse;
}