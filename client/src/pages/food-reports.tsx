import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeeklySummary {
  snapCount: number;
  insufficient: boolean;
  lateMealCount?: number;
  missedMealDays?: number;
  irregularMealDays?: number;
  mealTypeAvgs?: { breakfast: number | null; lunch: number | null; dinner: number | null };
  worstDay?: number | null;
}

interface MonthlySummary {
  snapCount: number;
  insufficient: boolean;
  month?: string;
  score?: number;
  components?: { signalQuality: number; timingRegularity: number; freqConsistency: number };
  topHighFood?: string | null;
  topLowFood?: string | null;
  irregularMealDays?: number | null;
  priorScore?: number | null;
  isFirstMonth?: boolean;
}

const DOW_ZH = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const MEAL_TYPE_ZH: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };

function localDateString(date: Date, tz?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().split("T")[0];
  }
}

function getWeekStart(tz?: string): string {
  const today = new Date();
  const localStr = localDateString(today, tz);
  const [y, m, d] = localStr.split("-").map(Number);
  const localDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = localDate.getUTCDay();
  const daysToThisMonday = dow === 0 ? -6 : 1 - dow;
  const prevMondayTime = Date.UTC(y, m - 1, d + daysToThisMonday, 12, 0, 0) - 7 * 86400000;
  return new Date(prevMondayTime).toISOString().split("T")[0];
}

function getPrevMonth(): string {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const y = today.getFullYear();
  if (currentMonth === 1) return `${y - 1}-12`;
  return `${y}-${String(currentMonth - 1).padStart(2, "0")}`;
}

function WeeklyCard({ weekStart }: { weekStart: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<WeeklySummary>({
    queryKey: ["/api/snap/weekly-summary", weekStart],
    queryFn: async () => {
      const res = await fetch(`/api/snap/weekly-summary?weekStart=${weekStart}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground text-center">載入中…</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (data.insufficient) {
    return (
      <Card data-testid="card-weekly-report">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">本週飲食摘要</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground">
            繼續使用 Food Snap 記錄飲食，下週將生成完整報告。（已記錄{data.snapCount}餐）
          </p>
        </CardContent>
      </Card>
    );
  }

  const lines: string[] = [];

  if ((data.lateMealCount ?? 0) > 2) {
    lines.push(`本週有${data.lateMealCount}餐宵夜 — 夜晚進食會影響隔日空腹血糖。`);
  }
  if ((data.missedMealDays ?? 0) > 0) {
    lines.push(`本週有${data.missedMealDays}日進餐時間不規律 — 建議固定每日用餐時間。`);
  }
  if ((data.irregularMealDays ?? 0) > 0) {
    lines.push(`本週有${data.irregularMealDays}日進餐時間不規律（正餐在非預期時段進食）。`);
  }

  const avgs = data.mealTypeAvgs;
  if (avgs) {
    const withData = (["breakfast", "lunch", "dinner"] as const).filter(k => avgs[k] !== null) as ("breakfast" | "lunch" | "dinner")[];
    if (withData.length >= 2) {
      const best = withData.reduce((a, b) => (avgs[a]! < avgs[b]! ? a : b));
      const worst = withData.reduce((a, b) => (avgs[a]! > avgs[b]! ? a : b));
      if (best !== worst) {
        lines.push(`${MEAL_TYPE_ZH[best]}是本週血糖影響最低的一餐。${MEAL_TYPE_ZH[worst]}影響最高。`);
      }
    }
  }

  if (data.worstDay !== null && data.worstDay !== undefined) {
    lines.push(`${DOW_ZH[data.worstDay]}的飲食血糖影響最大 — 留意當日的飲食模式。`);
  }

  return (
    <Card data-testid="card-weekly-report">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base">本週飲食摘要</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 flex flex-col gap-2">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-weekly-no-issues">本週飲食模式良好，繼續保持！</p>
        ) : (
          lines.map((line, i) => (
            <p key={i} className="text-sm text-foreground" data-testid={`text-weekly-insight-${i}`}>{line}</p>
          ))
        )}
        <p className="text-xs text-muted-foreground/60 mt-2 leading-relaxed" data-testid="text-weekly-disclaimer">
          {t("snap.advice_disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}

function MonthlyCard() {
  const { t } = useTranslation();
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const month = getPrevMonth();
  const [y, m] = month.split("-").map(Number);
  const monthTitle = `${y}年${m}月報告`;

  const { data, isLoading } = useQuery<MonthlySummary>({
    queryKey: ["/api/snap/monthly-summary", month],
    queryFn: async () => {
      const res = await fetch(`/api/snap/monthly-summary?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground text-center">載入中…</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (data.insufficient) {
    return (
      <Card data-testid="card-monthly-report">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">{monthTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground">
            繼續記錄飲食，下個月將生成完整報告。（已記錄{data.snapCount}餐）
          </p>
        </CardContent>
      </Card>
    );
  }

  const score = data.score ?? 0;
  const verdict =
    score >= 80 ? "飲食控制良好，繼續保持。"
    : score >= 60 ? "飲食表現尚可，仍有進步空間。"
    : "本月飲食有待改善，繼續記錄有助了解規律。";

  const priorDelta = !data.isFirstMonth && data.priorScore !== null && data.priorScore !== undefined
    ? score - data.priorScore
    : null;

  return (
    <Card data-testid="card-monthly-report">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base">{monthTitle}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-foreground" data-testid="text-monthly-score">{score}</span>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{verdict}</p>
            {priorDelta !== null && (
              <p className="text-xs text-muted-foreground/70 mt-0.5" data-testid="text-monthly-delta">
                {priorDelta > 0
                  ? `↑ 比上月高 ${priorDelta} 分`
                  : priorDelta < 0
                    ? `↓ 比上月低 ${Math.abs(priorDelta)} 分`
                    : "與上月持平"}
              </p>
            )}
          </div>
          <button
            onClick={() => setScoreExpanded(e => !e)}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            data-testid="button-score-expand"
            aria-label="展開分數明細"
          >
            {scoreExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {scoreExpanded && data.components && (
          <div className="bg-muted/40 rounded-lg p-3 flex flex-col gap-1.5 text-xs" data-testid="div-score-breakdown">
            <div className="flex justify-between">
              <span className="text-muted-foreground">血糖友善比率</span>
              <span className="font-medium" data-testid="text-signal-quality">{data.components.signalQuality}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">用餐規律性</span>
              <span className="font-medium" data-testid="text-timing-regularity">{data.components.timingRegularity}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">記錄頻率</span>
              <span className="font-medium" data-testid="text-freq-consistency">{data.components.freqConsistency}%</span>
            </div>
          </div>
        )}

        {data.isFirstMonth && (
          <p className="text-sm text-muted-foreground" data-testid="text-first-month">
            這是你的第一份報告。下個月我們將比較你的進步。繼續保持！
          </p>
        )}

        {(data.topHighFood || data.topLowFood) && (
          <div className="flex flex-col gap-1" data-testid="div-favourite-foods">
            {data.topHighFood && (
              <p className="text-xs text-muted-foreground" data-testid="text-top-high-food">
                血糖影響較高的常見食物：{data.topHighFood}
              </p>
            )}
            {data.topLowFood && (
              <p className="text-xs text-muted-foreground" data-testid="text-top-low-food">
                血糖友善的常見食物：{data.topLowFood}
              </p>
            )}
          </div>
        )}

        {(data.irregularMealDays ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="text-irregular-meal-days">
            本月有{data.irregularMealDays}日進餐時間不規律。
          </p>
        )}

        <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed" data-testid="text-monthly-disclaimer">
          {t("snap.advice_disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}

export default function FoodReports() {
  const [, setLocation] = useLocation();
  const { data: profile } = useQuery<{ deviceTimezone?: string | null }>({
    queryKey: ["/api/profile"],
  });

  const weekStart = getWeekStart(profile?.deviceTimezone ?? undefined);

  return (
    <div className="min-h-screen bg-background pb-8" data-testid="page-food-reports">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => setLocation("/snap")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-food-reports-back"
            aria-label="返回"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">飲食報告</h1>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <WeeklyCard weekStart={weekStart} />
        <MonthlyCard />
      </div>
    </div>
  );
}
