import type {
  DailyReportImpact,
  DailyReportMeal,
  DailyReportResponse,
  DailyReportVerdict,
} from "@shared/daily-report";

export function getDailyReportVerdict(impacts: readonly DailyReportImpact[]): DailyReportVerdict {
  if (impacts.length === 0) return "no_meals";
  if (impacts.some(impact => impact === "high")) return "high";
  if (impacts.some(impact => impact === "medium")) return "medium";
  if (impacts.every(impact => impact === "low")) return "stable";
  return "unavailable";
}

export function buildDailyReport(date: string, meals: DailyReportMeal[]): DailyReportResponse {
  return {
    date,
    verdict: getDailyReportVerdict(meals.map(meal => meal.finalGlucoseImpact)),
    meals,
  };
}