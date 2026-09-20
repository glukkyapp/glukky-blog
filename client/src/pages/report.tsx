import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { DailyFoodSummaryBanner, dailyVerdictTranslationKey, getYesterday } from "@/components/DailyFoodSummaryBanner";
import { LastTwoMonthsCard } from "@/pages/food-reports";
import { getReportPath, getReportView, type ReportView } from "@/lib/report-navigation";
import {
  DAILY_REPORT_STALE_TIME_MS,
  dailyReportQueryKey,
  fetchDailyReport,
} from "@/lib/daily-report-query";
import reportMascot from "@assets/hargawmascot_1789835862050.png";

export default function Report() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const tab = getReportView(search);
  const { data: profile, isPending: isProfilePending } = useQuery<{ deviceTimezone?: string | null }>({ queryKey: ["/api/profile"] });
  const tz = profile?.deviceTimezone ?? undefined;
  const yesterday = getYesterday(tz);
  const dailyReport = useQuery({
    queryKey: dailyReportQueryKey(yesterday),
    queryFn: () => fetchDailyReport(yesterday),
    enabled: tab === "daily" && !isProfilePending,
    staleTime: DAILY_REPORT_STALE_TIME_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const labels: Record<ReportView, string> = {
    daily: t("two_month_report.daily_tab"),
    "two-month": t("two_month_report.tab"),
  };
  const copy = {
    title: t("two_month_report.page_title"),
    intro: t("two_month_report.page_intro"),
    meal: t("two_month_report.see_meal"),
  };

  const selectTab = (nextTab: ReportView) => {
    setLocation(getReportPath(nextTab));
  };

  return (
    <main className="app-page-v2 min-h-[100dvh] bg-[#FCFBF2] px-4 pb-32 pt-6" data-testid="page-report">
      <div className="mx-auto max-w-sm">
        <header className="mb-6 pr-10">
           <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted)]">Glukky</p>
           <h1 className="text-[29px] font-bold tracking-tight text-[var(--brand-ink)]" data-testid="report-heading">{copy.title}</h1>
           <p className="mt-1 text-sm text-[var(--brand-muted)]">{copy.intro}</p>
        </header>

           <nav className="mb-5 grid min-h-14 grid-cols-2 rounded-full bg-[#d7eef0] p-1" aria-label="Report period">
          {(Object.keys(labels) as ReportView[]).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => selectTab(key)}
              className={`rounded-full px-3 py-2.5 text-sm font-semibold transition-all active:scale-[.97] ${
                 tab === key ? "bg-[var(--brand-teal)] text-[var(--brand-cream)] shadow-sm" : "text-[var(--brand-muted)]"
              }`}
              data-testid={`report-tab-${key}`}
            >{labels[key]}</button>
          ))}
        </nav>

        {tab === "daily" ? (
          <section className="animate-[slide-in-from-right_.28s_ease-out]" data-testid="report-panel-daily">
            {(isProfilePending || dailyReport.isLoading) && (
              <div className="space-y-4" data-testid="daily-report-loading">
                <div className="h-20 animate-pulse rounded-2xl bg-[#d7eef0]" />
                <div className="h-80 animate-pulse rounded-[1.75rem] bg-white" />
              </div>
            )}
            {dailyReport.isError && (
              <p className="rounded-2xl bg-white p-5 text-sm text-[var(--brand-muted)]" data-testid="daily-report-error">
                {t("food_reports.timeline_error")}
              </p>
            )}
            {dailyReport.data && (
              <>
                <div className="mb-4 flex items-center gap-3 px-1" data-testid="daily-report-mascot">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white p-1 shadow-md">
                    <img className="h-full w-full object-contain" src={reportMascot} alt="" aria-hidden="true" />
                  </div>
                  <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-[#d7eef0] p-3.5 text-sm font-bold leading-snug text-[#086574] shadow-sm">
                    <span className="absolute -left-2 top-4 border-y-[6px] border-r-[8px] border-y-transparent border-r-[#d7eef0]" aria-hidden="true" />
                    <p data-testid="daily-report-mascot-message">
                      {t(dailyVerdictTranslationKey(dailyReport.data.verdict))}
                    </p>
                  </div>
                </div>
                <DailyFoodSummaryBanner
                  report={dailyReport.data}
                  timezone={tz}
                  onViewMeal={() => setLocation("/food-log?from=report")}
                  viewMealLabel={copy.meal}
                />
              </>
            )}
          </section>
        ) : (
          <section className="animate-[slide-in-from-left_.28s_ease-out]" data-testid="report-panel-two-month">
            <LastTwoMonthsCard />
          </section>
        )}
      </div>
    </main>
  );
}