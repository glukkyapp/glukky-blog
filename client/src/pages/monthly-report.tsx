import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Footprints, TrendingUp, Check, Lock, ChevronLeft, ChevronRight,
  Sparkles, Activity, CircleMinus, Zap,
} from "lucide-react";
import { hapticTap, hapticPattern } from "@/lib/haptics";

interface DietDetail {
  struggle: string;
  status: "mastered" | "in_progress" | "moved_on" | "skipped";
  successCount: number;
  tipCompletions: { tip: string; yesCount: number }[];
}

export interface MonthlyReportData {
  walksCompleted: number;
  walksScheduled: number;
  totalActiveMinutes: number;
  stretchesCompleted: number;
  stretchesScheduled: number;
  hasStretchWeeks: boolean;
  tiredDays: number;
  reducedWalksGiven: number;
  dietDetails: DietDetail[];
  encouragingMessage: string;
  encourageArea: "walk" | "diet";
  piggyBankReward: string | null;
  dateRange: string;
  weeksAnalyzed: number;
}

const TABS = ["overview", "walking", "diet", "encouragement"] as const;

function formatDateRange(raw: string, lang: string): string {
  if (!raw || !raw.includes("|")) return raw;
  const [startStr, endStr] = raw.split("|");
  const locale = lang === "zh-Hant" || lang === "yue" ? "zh-TW" : lang;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  return `${start.toLocaleDateString(locale, opts)} – ${end.toLocaleDateString(locale, opts)}`;
}

function StatusBadge({ status, t }: { status: DietDetail["status"]; t: (key: string) => string }) {
  const config: Record<string, { color: string; icon: typeof Check }> = {
    mastered: { color: "text-green-600", icon: Check },
    in_progress: { color: "text-amber-600", icon: Zap },
    moved_on: { color: "text-muted-foreground", icon: CircleMinus },
    skipped: { color: "text-muted-foreground", icon: Lock },
  };
  const c = config[status] || config.in_progress;
  const Icon = c.icon;
  return (
    <span className={`text-sm font-semibold ${c.color} flex items-center gap-1`} data-testid={`badge-status-${status}`}>
      <Icon className="w-3.5 h-3.5" />
      {t(`monthlyReport.status.${status}`)}
    </span>
  );
}

function StatRow({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0" data-testid={testId}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export function MonthlyReportContent({ data, monthLabel }: { data: MonthlyReportData; monthLabel: string }) {
  const { t, i18n } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  function goNext() {
    hapticTap("SOFT");
    if (tabIndex < TABS.length - 1) {
      setDirection(1);
      setTabIndex(tabIndex + 1);
    }
  }
  function goBack() {
    hapticTap("SOFT");
    if (tabIndex > 0) {
      setDirection(-1);
      setTabIndex(tabIndex - 1);
    }
  }

  function getStruggleName(key: string): string {
    const translated = t(`monthlyReport.struggleName.${key}`, { defaultValue: "" });
    return translated || key;
  }

  function getTipDisplayName(tip: string): string {
    const translated = t(`monthlyReport.tipName.${tip}`, { defaultValue: "" });
    return translated || tip;
  }

  const encourageText = t(`monthlyReport.encourage.${data.encouragingMessage}`, { defaultValue: "" }) || data.encouragingMessage;

  function renderTab() {
    const currentTab = TABS[tabIndex];

    if (currentTab === "overview") {
      return (
        <div className="space-y-4" data-testid="tab-overview">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(152 73% 17%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
            <h1 className="text-lg font-bold" data-testid="text-monthly-title">
              {t("monthlyReport.title", { month: monthLabel })}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground -mt-2" data-testid="text-date-range">
            {t("monthlyReport.dateRange", { range: formatDateRange(data.dateRange, i18n.language) })}
          </p>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2" data-testid="card-highlights">
            {data.piggyBankReward ? (
              <p className="text-sm text-muted-foreground" data-testid="text-piggy-reward">
                {t("monthlyReport.piggyBankGoal", { reward: data.piggyBankReward })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-no-piggy">
                {t("monthlyReport.noPiggyBank")}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (currentTab === "walking") {
      return (
        <Card data-testid="card-walking">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Footprints className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold" data-testid="text-walking-header">
                {t("monthlyReport.walking.cardHeader")}
              </p>
            </div>

            <div className="flex flex-col">
              <StatRow
                label={t("monthlyReport.walking.walksCompleted")}
                value={t("monthlyReport.walking.walksValue", { done: data.walksCompleted, total: data.walksScheduled })}
                testId="stat-walks-completed"
              />
              <StatRow
                label={t("monthlyReport.walking.activeMinutes")}
                value={t("monthlyReport.walking.activeMinutesValue", { count: data.totalActiveMinutes })}
                testId="stat-active-minutes"
              />
              {data.hasStretchWeeks && (
                <StatRow
                  label={t("monthlyReport.walking.stretchesCompleted")}
                  value={t("monthlyReport.walking.stretchesValue", { done: data.stretchesCompleted, total: data.stretchesScheduled })}
                  testId="stat-stretches"
                />
              )}
              <StatRow
                label={t("monthlyReport.walking.tiredDays")}
                value={data.tiredDays}
                testId="stat-tired-days"
              />
              <StatRow
                label={t("monthlyReport.walking.reducedWalks")}
                value={data.reducedWalksGiven}
                testId="stat-reduced-walks"
              />
            </div>

            {data.encourageArea === "walk" && (
              <p className="text-sm text-primary italic" data-testid="text-walk-encourage">
                "{encourageText}"
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    if (currentTab === "diet") {
      return (
        <Card data-testid="card-diet">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold" data-testid="text-diet-header">
                {t("monthlyReport.diet.cardHeader")}
              </p>
            </div>

            {data.dietDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-diet">{t("monthlyReport.diet.noData")}</p>
            ) : (
              <div className="flex flex-col">
                {data.dietDetails.map((detail, idx) => (
                  <div
                    key={detail.struggle}
                    className={`py-3 ${idx < data.dietDetails.length - 1 ? "border-b border-border" : ""}`}
                    data-testid={`diet-detail-${detail.struggle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{getStruggleName(detail.struggle)}</span>
                      <StatusBadge status={detail.status} t={t} />
                    </div>
                    <p className="text-xs text-primary font-medium mt-1" data-testid={`diet-success-${detail.struggle}`}>
                      {t("monthlyReport.diet.successCount", { count: detail.successCount })}
                    </p>
                    {detail.tipCompletions.length > 0 && (
                      <div className="mt-2 space-y-1 ml-1">
                        {detail.tipCompletions.map(tc => (
                          <div key={tc.tip} className="flex items-center justify-between text-xs text-muted-foreground" data-testid={`tip-${tc.tip}`}>
                            <span className="flex-1 truncate">{getTipDisplayName(tc.tip)}</span>
                            <span className="text-primary font-medium ml-2 shrink-0">
                              {t("monthlyReport.diet.tipFollowed", { count: tc.yesCount })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data.encourageArea === "diet" && (
              <p className="text-sm text-primary italic" data-testid="text-diet-encourage">
                "{encourageText}"
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    if (currentTab === "encouragement") {
      return (
        <div className="space-y-4" data-testid="tab-encouragement">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-semibold" data-testid="text-encourage-header">
                  {data.encourageArea === "walk"
                    ? t("monthlyReport.walking.cardHeader")
                    : t("monthlyReport.diet.cardHeader")}
                </p>
              </div>
              <p className="text-sm text-primary italic leading-relaxed" data-testid="text-encourage-message">
                "{encourageText}"
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return null;
  }

  const isLastTab = tabIndex === TABS.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-xs text-muted-foreground" data-testid="tab-labels">
        {TABS.map((tab, idx) => (
          <span
            key={tab}
            className={idx === tabIndex ? "text-primary font-semibold" : ""}
            data-testid={`tab-label-${tab}`}
          >
            {t(`monthlyReport.tabs.${tab}`)}
          </span>
        ))}
      </div>
      <div data-testid="progress-tabs">
        <Progress value={((tabIndex + 1) / TABS.length) * 100} className="h-2" />
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={TABS[tabIndex]}
          custom={direction}
          initial={{ opacity: 0, x: direction * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -30 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {renderTab()}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goBack}
          disabled={tabIndex === 0}
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> {t("monthlyReport.back")}
        </Button>

        {!isLastTab && (
          <Button
            size="sm"
            className="btn-pop"
            onClick={goNext}
            data-testid="button-next"
          >
            {t("monthlyReport.next")} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MonthlyReportPage() {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const patternFiredRef = useRef(false);

  let monthLabel: string;
  const lang = i18n.language;
  if (lang === "zh-Hant" || lang === "yue") {
    const chineseNumerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
    monthLabel = chineseNumerals[now.getMonth()];
  } else {
    monthLabel = now.toLocaleDateString(lang, { month: "long" });
  }

  const { data, isLoading, error } = useQuery<MonthlyReportData>({
    queryKey: ["/api/report/monthly", "0"],
  });

  useEffect(() => {
    if (data && data.weeksAnalyzed >= 4 && !patternFiredRef.current) {
      patternFiredRef.current = true;
      hapticPattern("..oO-Oo..", 80);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4" data-testid="loading-monthly-report">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="error-monthly-report">
        <p className="text-muted-foreground text-center">{t("monthlyReport.loadError")}</p>
      </div>
    );
  }

  if (data.weeksAnalyzed < 4) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="no-data-monthly-report">
        <p className="text-muted-foreground text-center text-lg">
          {t("monthlyReport.notEnoughWeeks")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="monthly-report-page">
      <MonthlyReportContent data={data} monthLabel={monthLabel} />
    </div>
  );
}
