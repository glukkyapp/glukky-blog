import type {
  DailyReportImpact,
  DailyReportResponse,
  DailyReportVerdict,
} from "@shared/daily-report";

export const DAILY_REPORT_STALE_TIME_MS = 15 * 60 * 1000;

export function previousCalendarDateInTimezone(instant: Date, timezone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const year = Number(parts.find(part => part.type === "year")?.value);
    const month = Number(parts.find(part => part.type === "month")?.value);
    const day = Number(parts.find(part => part.type === "day")?.value);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new Error("Unable to resolve local calendar date.");
    }
    return new Date(Date.UTC(year, month - 1, day - 1, 12)).toISOString().slice(0, 10);
  } catch {
    const local = new Date(instant);
    local.setDate(local.getDate() - 1);
    return [
      local.getFullYear(),
      String(local.getMonth() + 1).padStart(2, "0"),
      String(local.getDate()).padStart(2, "0"),
    ].join("-");
  }
}

export function dailyReportQueryKey(date: string) {
  return ["/api/snap/daily-report", date] as const;
}

export function dailyReportUrl(date: string): string {
  return `/api/snap/daily-report?${new URLSearchParams({ date }).toString()}`;
}

function isImpact(value: unknown): value is DailyReportImpact {
  return value === null || value === "low" || value === "medium" || value === "high";
}

function isVerdict(value: unknown): value is DailyReportVerdict {
  return value === "no_meals"
    || value === "stable"
    || value === "medium"
    || value === "high"
    || value === "unavailable";
}

export function validateDailyReport(value: unknown): asserts value is DailyReportResponse {
  if (!value || typeof value !== "object") throw new Error("Daily report returned an invalid response.");
  const response = value as Partial<DailyReportResponse>;
  if (typeof response.date !== "string" || !isVerdict(response.verdict) || !Array.isArray(response.meals)) {
    throw new Error("Daily report returned an invalid response.");
  }
  for (const meal of response.meals) {
    if (!meal || typeof meal !== "object" || !Object.prototype.hasOwnProperty.call(meal, "finalGlucoseImpact")) {
      throw new Error("Daily report is missing its final impact assessment.");
    }
    if (!isImpact((meal as { finalGlucoseImpact?: unknown }).finalGlucoseImpact)) {
      throw new Error("Daily report returned an invalid final impact assessment.");
    }
  }
}

export async function fetchDailyReport(date: string): Promise<DailyReportResponse> {
  const response = await fetch(dailyReportUrl(date), { credentials: "include" });
  if (!response.ok) throw new Error("Daily report is temporarily unavailable.");
  const payload: unknown = await response.json();
  validateDailyReport(payload);
  return payload;
}