import { ArrowRight, Clock3, Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DailyReportResponse, DailyReportVerdict } from "@shared/daily-report";
import {
  impactPresentation,
  isChineseLanguage,
  mealLabel,
} from "@/lib/meal-presentation";
import { previousCalendarDateInTimezone } from "@/lib/daily-report-query";

export function getYesterday(tz?: string, dateOverride?: string | null): string {
  if (dateOverride) {
    const [year, month, day] = dateOverride.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1, 12)).toISOString().slice(0, 10);
  }
  return previousCalendarDateInTimezone(new Date(), tz);
}

export function dailyVerdictTranslationKey(verdict: DailyReportVerdict): string {
  return verdict === "unavailable"
    ? "food_reports.timeline_error"
    : `two_month_report.daily_verdict.${verdict}`;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Builds the report card copy from the already-resolved Daily report.
 *
 * This deliberately does not use the mascot copy. The mascot is encouraging
 * and conversational; this card is a factual report with a separate
 * suggestion. Both still receive the same backend-authoritative verdict and
 * meal facts.
 */
export function buildSummary(report: DailyReportResponse, t: Translate) {
  const snaps = report.meals;
  const noMealDefaults = {
    primary: "昨日未見飲食記錄。",
    primarySuggestion: "定時進食有助穩定全日血糖。",
  };

  if (report.verdict === "no_meals" || snaps.length === 0) {
    return {
      primary: t("two_month_report.daily_summary.no_meals_primary", { defaultValue: noMealDefaults.primary }),
      primarySuggestion: t("two_month_report.daily_summary.no_meals_suggestion", { defaultValue: noMealDefaults.primarySuggestion }),
    };
  }

  if (report.verdict === "stable") {
    const namedMeal = snaps.find((meal) => meal.foodName)?.foodName;
    return {
      primary: namedMeal
        ? t("two_month_report.daily_summary.stable_meal_primary", { food: namedMeal })
        : t("two_month_report.daily_summary.stable_primary"),
      primarySuggestion: t("two_month_report.daily_summary.stable_suggestion"),
    };
  }

  if (report.verdict === "medium") {
    return {
      primary: t("two_month_report.daily_summary.medium_primary"),
      primarySuggestion: t("two_month_report.daily_summary.medium_suggestion"),
    };
  }

  if (report.verdict === "high") {
    const highMeal = snaps.find((meal) => meal.finalGlucoseImpact === "high");
    return {
      primary: highMeal?.foodName
        ? t("two_month_report.daily_summary.high_meal_primary", { food: highMeal.foodName })
        : t("two_month_report.daily_summary.high_primary"),
      primarySuggestion: t("two_month_report.daily_summary.high_suggestion"),
    };
  }

  return {
    primary: t("two_month_report.daily_summary.unavailable_primary"),
    primarySuggestion: t("two_month_report.daily_summary.unavailable_suggestion"),
  };
}

interface Props {
  report: DailyReportResponse;
  timezone?: string;
  onViewMeal?: () => void;
  viewMealLabel: string;
}

export function DailyFoodSummaryBanner({ report, timezone, onViewMeal, viewMealLabel }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "yue" ? "zh-HK" : i18n.language === "zh-Hant" ? "zh-TW" : "en-US";
  const isZh = isChineseLanguage(i18n.language);
  const snaps = report.meals;
  const summary = buildSummary(report, t);
  // Keep the mascot/card agreement inspectable without rendering mascot prose
  // inside the report card.
  const sharedVerdictKey = dailyVerdictTranslationKey(report.verdict);
  const reportDate = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${report.date}T12:00:00Z`));

  return (
    <section
      className="overflow-hidden rounded-[1.75rem] bg-white p-5 shadow-[0_3px_12px_rgba(28,58,63,.10)]"
      data-testid="card-daily-food-summary"
      data-verdict-key={sharedVerdictKey}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f2ed] px-3 py-1 text-sm font-bold text-[#075c49]">
          <Leaf className="h-4 w-4" aria-hidden="true" />
          {t("two_month_report.daily_finding")}
        </span>
        <time className="text-sm font-medium text-[#606967]" dateTime={report.date}>{reportDate}</time>
      </div>

      <div className="rounded-2xl bg-[#eef8f8] p-4">
        <p className="text-xl font-bold leading-snug text-[#173b55]" data-testid="text-daily-summary-primary">
          {summary.primary}
        </p>
        {summary.primarySuggestion && (
          <p className="mt-2 text-base leading-relaxed text-[#536467]" data-testid="text-daily-summary-suggestion">
            {summary.primarySuggestion}
          </p>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-base font-bold text-[#173b55]">
            <Clock3 className="h-4 w-4 text-[#075c49]" aria-hidden="true" />
            {t("food_reports.yesterday_timeline_title")}
          </h2>
          <span className="text-xs font-medium text-[#606967]">
            {t("food_frequency.meals", { count: snaps.length })}
          </span>
        </div>
        {snaps.length === 0 ? (
          <p className="rounded-2xl bg-[#f4f2ed] px-4 py-5 text-sm text-[#606967]" data-testid="meal-timeline-empty">
            {t("food_reports.yesterday_timeline_empty")}
          </p>
        ) : (
          snaps.length > 0 && (
            <div className="divide-y divide-[#d9ddd8] rounded-2xl bg-[#f4f2ed] px-4" data-testid="meal-timeline-list">
              {snaps.map((meal, index) => {
                const impact = impactPresentation(meal.finalGlucoseImpact, isZh);
                return (
                  <div className="flex min-w-0 items-center gap-3 py-3" key={meal.id} data-testid={`meal-timeline-item-${meal.id}`}>
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: impact.color }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-bold text-[#1b2825]">{mealLabel(meal.mealType, isZh)}</span>
                        <time className="text-xs text-[#606967]">
                          {new Intl.DateTimeFormat(locale, {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: timezone,
                          }).format(new Date(meal.snapTime))}
                        </time>
                      </div>
                      <p className="truncate text-xs text-[#606967]">{meal.foodName || t("food_reports.unnamed_meal")}</p>
                      {meal.postMealGlucoseMmol != null && (
                        <p className="text-xs font-medium text-[#075c49]" data-testid={`daily-meal-glucose-${meal.id}`}>
                          {meal.postMealGlucoseMmol.toFixed(1)} mmol/L
                        </p>
                      )}
                    </div>
                    <span
                      className="max-w-[7.5rem] shrink-0 rounded-full px-2 py-1 text-xs font-bold"
                      style={{ backgroundColor: `${impact.color}18`, color: impact.textColor }}
                    >
                      {impact.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {snaps.length > 0 && onViewMeal && (
        <button
          type="button"
          onClick={onViewMeal}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#086574] px-4 text-base font-bold text-white shadow-sm transition-transform active:scale-[.98]"
          data-testid="button-daily-view-meal"
        >
          {viewMealLabel}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}