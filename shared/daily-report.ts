export type DailyReportVerdict =
  | "no_meals"
  | "stable"
  | "medium"
  | "high"
  | "unavailable";

export type DailyReportImpact = "low" | "medium" | "high" | null;

export interface DailyReportMeal {
  id: number;
  snapTime: string;
  localDate: string;
  mealType: string | null;
  foodName: string | null;
  finalGlucoseImpact: DailyReportImpact;
  postMealGlucoseMmol: number | null;
}

export interface DailyReportResponse {
  date: string;
  verdict: DailyReportVerdict;
  meals: DailyReportMeal[];
}