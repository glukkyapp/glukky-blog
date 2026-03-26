import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dumbbell, Apple, Leaf, Check, LucideIcon,
  CupSoda, Cherry, ChefHat, Beef, House, Handshake,
  LeafyGreen, HandPlatter, CookingPot, Nut,
} from "lucide-react";

interface TipPerformance {
  yes: number;
  no: number;
  noChance: number;
}

interface StruggleStatus {
  tips: string[];
  completed: boolean;
}

export interface MonthlyReportData {
  totalMinutes: number;
  tipPerformance: Record<string, TipPerformance>;
  struggleStatus: Record<string, StruggleStatus>;
  weeksAnalyzed: number;
}

const TIP_ICON_MAP: Record<string, LucideIcon> = {
  "Dilute juice 1:1 with water": CupSoda,
  "Swap dessert for yogurt + berries": Cherry,
  "Limit fruit to 1x per week": Apple,
  "Steam your food first, then sear briefly": ChefHat,
  "Choose grilled over fried": Beef,
  "Decouple (eat at home first, socialize out)": House,
  "Share main dishes": Handshake,
  "Swap sides for vegetables": LeafyGreen,
  "Use the plate method (½ veggies, ¼ protein, ¼ carbs)": HandPlatter,
  "Kitchen Closure after dinner": CookingPot,
  "Switch to edamame or nuts": Nut,
};

function getTipIcon(tip: string): LucideIcon {
  return TIP_ICON_MAP[tip] ?? Leaf;
}

const BUBBLE_COLORS = ["#14A085", "#22c55e", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#ec4899"];

const MIN_BUBBLE = 36;
const MAX_BUBBLE = 72;

export function MonthlyReportContent({ data, monthLabel }: { data: MonthlyReportData; monthLabel: string }) {
  const { t } = useTranslation();
  const sortedTips = Object.entries(data.tipPerformance).sort(([, a], [, b]) => b.yes - a.yes);
  const maxYes = sortedTips.length > 0 ? Math.max(...sortedTips.map(([, p]) => p.yes)) : 0;

  function getBubbleSize(yes: number): number {
    if (maxYes === 0) return MIN_BUBBLE;
    return MIN_BUBBLE + (yes / maxYes) * (MAX_BUBBLE - MIN_BUBBLE);
  }

  function getTipDisplayName(tip: string): string {
    const translated = t(`monthlyReport.tipName.${tip}`, { defaultValue: "" });
    return translated || tip;
  }

  function getStruggleName(key: string): string {
    const translated = t(`monthlyReport.struggleName.${key}`, { defaultValue: "" });
    return translated || key;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold" data-testid="text-monthly-title">
        {t("monthlyReport.title", { month: monthLabel })}
      </h1>

      <Card data-testid="card-diet-tips">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("monthlyReport.dietTips.cardHeader")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("monthlyReport.dietTips.noData")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-center gap-3 mb-5" data-testid="bubble-row-tips">
                {sortedTips.map(([tip, perf], i) => {
                  const Icon = getTipIcon(tip);
                  const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
                  const size = getBubbleSize(perf.yes);
                  const iconSize = Math.round(size * 0.45);

                  return (
                    <div key={tip} className="flex flex-col items-center" data-testid={`bubble-${tip}`}>
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: size,
                          height: size,
                          backgroundColor: color + "20",
                          border: `2px solid ${color}`,
                        }}
                      >
                        <Icon style={{ width: iconSize, height: iconSize, color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                {sortedTips.map(([tip, perf], i) => {
                  const Icon = getTipIcon(tip);
                  const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
                  const displayName = getTipDisplayName(tip);

                  const followedStr = perf.yes > 0
                    ? t("monthlyReport.dietTips.followed", { count: perf.yes })
                    : "";
                  const skippedStr = perf.no > 0
                    ? t("monthlyReport.dietTips.skipped", { count: perf.no })
                    : "";
                  const notPossibleStr = perf.noChance > 0
                    ? t("monthlyReport.dietTips.notPossible", { count: perf.noChance })
                    : "";
                  const notTrackedStr =
                    perf.yes === 0 && perf.no === 0 && perf.noChance === 0
                      ? t("monthlyReport.dietTips.notTracked")
                      : "";

                  const parts = [followedStr, skippedStr, notPossibleStr].filter(Boolean);
                  const statsStr = notTrackedStr || parts.join(" · ");

                  return (
                    <div key={tip} className="flex items-start gap-2.5" data-testid={`tip-item-${tip}`}>
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: color + "25" }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{ color }}
                          data-testid={`tip-icon-${tip}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{displayName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5" data-testid={`tip-stats-${tip}`}>
                          {statsStr}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-diet-struggles">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("monthlyReport.dietStruggles.cardHeader")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(data.struggleStatus).map(([struggle, info]) => {
            const name = getStruggleName(struggle);
            const sortedStruggleTips = [...info.tips].sort((a, b) => {
              const aPerf = data.tipPerformance[a];
              const bPerf = data.tipPerformance[b];
              return (bPerf?.yes ?? 0) - (aPerf?.yes ?? 0);
            });

            return (
              <div key={struggle} data-testid={`struggle-${struggle}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {info.completed ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600" data-testid={`struggle-mastered-${struggle}`}>
                      <Check className="w-4 h-4" />
                      {name} {t("monthlyReport.dietStruggles.mastered")}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                  )}
                </div>
                {sortedStruggleTips.length > 0 && (
                  <ul className="space-y-1.5 ml-1">
                    {sortedStruggleTips.map((tip) => {
                      const perf = data.tipPerformance[tip];
                      const Icon = getTipIcon(tip);
                      return (
                        <li key={tip} className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`struggle-tip-${tip}`}>
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1">{getTipDisplayName(tip)}</span>
                          {perf && perf.yes > 0 && (
                            <span className="text-xs text-primary font-medium" data-testid={`struggle-tip-yes-${tip}`}>
                              {t("monthlyReport.dietStruggles.followedCount", { count: perf.yes })}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-testid="card-physical-tank">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            {t("monthlyReport.physicalTank.cardHeader")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold" data-testid="text-total-minutes">
            {t("monthlyReport.physicalTank.minutes", { count: data.totalMinutes })}
          </p>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-avg-per-week">
            {t("monthlyReport.physicalTank.avgPerWeek", {
              count: Math.round(data.totalMinutes / data.weeksAnalyzed),
              n: data.weeksAnalyzed,
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MonthlyReportPage() {
  const { t, i18n } = useTranslation();
  const now = new Date();

  let monthLabel: string;
  const lang = i18n.language;
  if (lang === "zh-Hant" || lang === "yue") {
    monthLabel = String(now.getMonth() + 1);
  } else {
    monthLabel = now.toLocaleDateString(lang, { month: "long" });
  }

  const { data, isLoading, error } = useQuery<MonthlyReportData>({
    queryKey: ["/api/report/monthly", "0"],
  });

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
