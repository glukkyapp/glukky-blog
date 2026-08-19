import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { ClipboardList, Leaf } from "lucide-react";
import { DailyFoodSummaryBanner } from "@/components/DailyFoodSummaryBanner";
import { WeeklyCard, getWeekStart } from "@/pages/food-reports";
import { getReportPath, getReportView, type ReportView } from "@/lib/report-navigation";

export default function Report() {
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const tab = getReportView(search);
  const { data: profile } = useQuery<{ deviceTimezone?: string | null }>({ queryKey: ["/api/profile"] });
  const tz = profile?.deviceTimezone ?? undefined;
  const language = i18n.language;
  const isChinese = language === "yue" || language.startsWith("zh");
  const labels = isChinese
    ? { daily: "昨日", weekly: "本週" }
    : { daily: "Yesterday", weekly: "This week" };
  const copy = language === "yue"
    ? { title: "飲食報告", intro: "昨日重點同本週趨勢，一目了然。", finding: "昨日重點", meal: "了解這餐", preview: "本週摘要", openWeekly: "查看本週報告" }
    : language.startsWith("zh")
      ? { title: "飲食報告", intro: "昨日重點與本週趨勢，一目了然。", finding: "昨日重點", meal: "了解這餐", preview: "本週摘要", openWeekly: "查看本週報告" }
      : { title: "Food report", intro: "Yesterday's highlights and this week's trends at a glance.", finding: "Yesterday's highlight", meal: "See this meal", preview: "This week", openWeekly: "View this week's report" };

  const selectTab = (nextTab: ReportView) => {
    setLocation(getReportPath(nextTab));
  };

  return (
    <main className="app-page-v2 min-h-[100dvh] px-4 pb-32 pt-6" data-testid="page-report">
      <div className="mx-auto max-w-sm">
        <header className="mb-6 pr-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#6E8477]">Glukky</p>
          <h1 className="text-[29px] font-bold tracking-tight text-[#214B36]">{copy.title}</h1>
          <p className="mt-1 text-sm text-[#6E8477]">{copy.intro}</p>
        </header>

        <nav className="mb-5 grid grid-cols-2 rounded-2xl bg-[#EAF2E7] p-1" aria-label="Report period">
          {(Object.keys(labels) as ReportView[]).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => selectTab(key)}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-[.97] ${
                tab === key ? "bg-[#214B36] text-[#FDFBED] shadow-sm" : "text-[#6E8477]"
              }`}
              data-testid={`report-tab-${key}`}
            >{labels[key]}</button>
          ))}
        </nav>

        {tab === "daily" ? (
          <section className="space-y-4 animate-[slide-in-from-right_.28s_ease-out]" data-testid="report-panel-daily">
            <div>
              <div className="mb-2 flex items-center gap-2 px-1 text-[#2F6B43]">
                <Leaf size={17} />
                <span className="text-xs font-bold uppercase tracking-[.14em]">{copy.finding}</span>
              </div>
              <DailyFoodSummaryBanner
                tz={tz}
                onViewMeal={() => setLocation("/food-log?from=report")}
                viewMealLabel={copy.meal}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 px-1 text-[#6E8477]"><ClipboardList size={15} /><span className="text-xs font-bold uppercase tracking-[.14em]">{copy.preview}</span></div>
              <WeeklyCard
                weekStart={getWeekStart(tz)}
                variant="preview"
                onOpenWeekly={() => selectTab("weekly")}
                openWeeklyLabel={copy.openWeekly}
              />
            </div>
          </section>
        ) : (
          <section className="animate-[slide-in-from-left_.28s_ease-out]" data-testid="report-panel-weekly">
            <WeeklyCard weekStart={getWeekStart(tz)} variant="reports" />
          </section>
        )}
      </div>
    </main>
  );
}