import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/DonutChart";

interface WeeklySummary {
  snapCount: number;
  insufficient: boolean;
  lateMealCount?: number;
  missedMealDays?: number;
  irregularMealDays?: number;
  irregularMealType?: string | null;
  mealTypeAvgs?: { breakfast: number | null; lunch: number | null; dinner: number | null };
  worstDay?: number | null;
  worstMeal?: string | null;
  worstFood?: string | null;
  worstMeals?: string[];
  worstFoods?: (string | null)[];
  dayBreakdown?: { stable: number; medium: number; high: number; total: number };
  dailyGrid?: DayGrid[];
  hasAiDays?: boolean;
  score?: number;
  components?: { signalQuality: number; timingRegularity: number; freqConsistency: number };
  recFood?: string | null;
  recommendedFood?: string | null;
}

interface DayGrid {
  date: string;
  dayOfWeek: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  snackImpacts: string[];
  isFuture: boolean;
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
  stableDays?: number | null;
  mediumDays?: number | null;
  highDays?: number | null;
  loggedDays?: number | null;
  hasAiDays?: boolean;
}

interface SymptomData {
  symptoms: Record<string, number>;
  totalWithSymptom: number;
  snackCount: number;
}

type PatternBucketKey =
  | "breakfast" | "lunch" | "dinner" | "snack"
  | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
  | "weekday" | "weekend";

type TwoMonthPatternCard =
  | {
      cardType: "mealtime" | "weekday" | "weekday-weekend";
      state: "named";
      leadingBucket: PatternBucketKey;
      runnerUpBucket: PatternBucketKey;
      leadingRate: number;
      runnerUpRate: number;
      zScore: number;
    }
  | {
      cardType: "mealtime" | "weekday" | "weekday-weekend";
      state: "neutral";
      neutralReason: "equal-rate" | "below-z-threshold";
      leadingBucket: PatternBucketKey;
      runnerUpBucket: PatternBucketKey;
      leadingRate: number;
      runnerUpRate: number;
      zScore: number | null;
    }
  | {
      cardType: "mealtime" | "weekday" | "weekday-weekend";
      state: "unavailable";
      minimumMealsPerBucket: number;
    };

interface TwoMonthReportSummary {
  status: "progress" | "insufficient" | "ready";
  progressState?: "first-incomplete-month" | "one-completed-month";
  window: { months: [string, string]; startDate: string; endDate: string };
  totalMeals: number;
  cards: TwoMonthPatternCard[];
}

const IMPACT_COLOR: Record<string, string> = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };
const DOW_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const DOW_ZH = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const MEAL_TYPE_ZH: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
const SYMPTOM_ZH: Record<string, string> = { tired: "疲倦", blurred_vision: "視力模糊", thirsty: "口渴" };
const SYMPTOM_COLOR: Record<string, string> = { tired: "#f59e0b", blurred_vision: "#ef4444", thirsty: "#3b82f6" };

function localDateString(date: Date, tz?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().split("T")[0];
  }
}

export function getWeekStart(tz?: string): string {
  const today = new Date();
  const localStr = localDateString(today, tz);
  const [y, m, d] = localStr.split("-").map(Number);
  const localDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = localDate.getUTCDay();
  const daysToThisMonday = dow === 0 ? -6 : 1 - dow;
  const prevMondayTime = Date.UTC(y, m - 1, d + daysToThisMonday, 12, 0, 0);
  return new Date(prevMondayTime).toISOString().split("T")[0];
}

function getPrevMonth(): string {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const y = today.getFullYear();
  if (currentMonth === 1) return `${y - 1}-12`;
  return `${y}-${String(currentMonth - 1).padStart(2, "0")}`;
}

function WeeklyDonut({ breakdown }: { breakdown: NonNullable<WeeklySummary["dayBreakdown"]> }) {
  const segments = [
    { value: breakdown.stable, color: IMPACT_COLOR.low },
    { value: breakdown.medium, color: IMPACT_COLOR.medium },
    { value: breakdown.high, color: IMPACT_COLOR.high },
  ];
  const labels = ["穩定", "中等", "偏高"];
  return (
    <div className="flex items-center gap-4 py-4" data-testid="div-weekly-donut">
      <DonutChart segments={segments} size={101} strokeWidth={15}>
        <div className="flex flex-col items-center leading-none">
          <span className="text-xl font-bold text-foreground">{breakdown.total}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">天</span>
        </div>
      </DonutChart>
      <div className="flex flex-col gap-0.5 flex-1">
        {segments.map((s, i) => s.value > 0 && (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-muted-foreground flex-1">{labels[i]}</span>
            <span className="text-[11px] font-medium text-foreground">{s.value}天</span>
          </div>
        ))}
        {breakdown.total === 0 && <p className="text-xs text-muted-foreground">本週暫無血糖數據</p>}
      </div>
    </div>
  );
}

function WeeklyGrid({ grid }: { grid: DayGrid[] }) {
  const meals: (keyof Pick<DayGrid, "breakfast" | "lunch" | "dinner">)[] = ["breakfast", "lunch", "dinner"];
  const mealLabels = ["早", "午", "晚"];
  return (
    <div className="w-full" data-testid="table-weekly-grid">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <td className="w-5 pr-0.5" />
            {grid.map((d, i) => (
              <th key={i} className="text-center font-medium text-muted-foreground pb-1">
                {DOW_LABELS[d.dayOfWeek]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meals.map((meal, ri) => (
            <tr key={meal}>
              <td className="text-muted-foreground/70 font-medium text-right align-middle pr-0.5">
                {mealLabels[ri]}
              </td>
              {grid.map((d, ci) => {
                const impact = d[meal];
                const color = impact ? IMPACT_COLOR[impact] : null;
                return (
                  <td key={ci} className="text-center align-middle py-0.5">
                    <div
                      className="mx-auto rounded-full"
                      style={{
                        width: 10, height: 10,
                        backgroundColor: color ?? (d.isFuture ? "transparent" : "hsl(var(--muted)/0.4)"),
                        border: d.isFuture ? "1px dashed hsl(var(--muted-foreground)/0.25)" : "none",
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HIGHLIGHT_KEYWORDS = [
  "早餐", "午餐", "晚餐", "宵夜",
  "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日",
];
const HIGHLIGHT_RE = new RegExp(
  `(${HIGHLIGHT_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}|「[^」]*」)`,
  "g"
);

function HighlightedText({ text }: { text: string }) {
  const segments = text.split(HIGHLIGHT_RE);
  return (
    <>
      {segments.map((seg, i) =>
        HIGHLIGHT_KEYWORDS.some(k => k === seg) || /^「[^」]*」$/.test(seg)
          ? <span key={i} className="text-primary font-bold">{seg}</span>
          : <span key={i}>{seg}</span>
      )}
    </>
  );
}

interface WeeklyCardProps {
  weekStart: string;
  variant?: "home" | "reports" | "preview";
  onOpenWeekly?: () => void;
  openWeeklyLabel?: string;
}

export function WeeklyCard({
  weekStart,
  variant = "home",
  onOpenWeekly,
  openWeeklyLabel = "查看本週報告",
}: WeeklyCardProps) {
  const { t } = useTranslation();
  const [scoreExpanded, setScoreExpanded] = useState(false);
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
      <Card data-testid={variant === "preview" ? "card-weekly-preview" : "card-weekly-report"}>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">本週飲食摘要</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground">
            繼續使用 Food Snap 記錄飲食，下週將生成完整報告。（已記錄{data.snapCount}餐）
          </p>
          {variant === "preview" && onOpenWeekly && (
            <button
              type="button"
              onClick={onOpenWeekly}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.98]"
              data-testid="button-open-weekly-report"
            >
              {openWeeklyLabel}
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  const loggedDays = data.dailyGrid
    ? data.dailyGrid.filter(d => !d.isFuture && (d.breakfast || d.lunch || d.dinner || (d.snackImpacts?.length ?? 0) > 0)).length
    : null;

  let bestDayLabel: string | null = null;
  let worstDayFromGrid: string | null = null;
  if (data.dailyGrid) {
    const daySnaps = data.dailyGrid
      .filter(d => !d.isFuture && (d.breakfast || d.lunch || d.dinner || (d.snackImpacts?.length ?? 0) > 0))
      .map(d => {
        const all = [d.breakfast, d.lunch, d.dinner, ...(d.snackImpacts ?? [])].filter(Boolean) as string[];
        return {
          dow: d.dayOfWeek,
          highCount: all.filter(x => x === "high").length,
          lowCount: all.filter(x => x === "low").length,
        };
      });
    if (daySnaps.length >= 2) {
      const best = daySnaps.reduce((a, b) =>
        a.highCount < b.highCount || (a.highCount === b.highCount && a.lowCount > b.lowCount) ? a : b
      );
      const worst = daySnaps.reduce((a, b) => a.highCount > b.highCount ? a : b);
      if (best.dow !== worst.dow && worst.highCount > 0) {
        bestDayLabel = DOW_ZH[best.dow];
        worstDayFromGrid = DOW_ZH[worst.dow];
      }
    }
  }

  const noHighMealsThisWeek = (data.dayBreakdown?.high ?? 0) === 0 && (data.dayBreakdown?.total ?? 0) > 0;

  const bullets: { insight: string; suggestion?: string }[] = [];

  if (loggedDays !== null) {
    bullets.push({ insight: `本週已記錄${loggedDays}日的飲食` });
  }

  if (bestDayLabel && worstDayFromGrid) {
    bullets.push({
      insight: `${bestDayLabel}飲食最好，${worstDayFromGrid}飲食要多加留意。`,
      suggestion: `可在下週${worstDayFromGrid}選擇升糖指數較低的食物。`,
    });
  } else if (data.worstDay !== null && data.worstDay !== undefined) {
    const dayLabel = DOW_ZH[data.worstDay];
    const meals = data.worstMeals?.length ? data.worstMeals : (data.worstMeal ? [data.worstMeal] : []);
    if (meals.length === 0) {
      bullets.push({
        insight: `${dayLabel}血糖影響最高`,
        suggestion: "留意當日的飲食模式，嘗試選擇升糖指數較低的食物。",
      });
    } else if (meals.length === 1) {
      const mealLabel = MEAL_TYPE_ZH[meals[0]] ?? meals[0];
      if (data.recFood && data.recommendedFood) {
        bullets.push({
          insight: `本週${mealLabel}影響最高的是「${data.recFood}」`,
          suggestion: `下週可嘗試換成「${data.recommendedFood}」。`,
        });
      } else {
        bullets.push({
          insight: `${dayLabel}${mealLabel}血糖影響最高`,
          suggestion: `可在下週${mealLabel}選擇升糖指數較低的食物。`,
        });
      }
    } else {
      const parts = meals.map(m => MEAL_TYPE_ZH[m] ?? m).join("及");
      bullets.push({
        insight: `${dayLabel}${parts}血糖影響同樣最高`,
        suggestion: "可在下週這兩餐選擇升糖指數較低的食物。",
      });
    }
  }

  if (data.score !== undefined && data.score > 85) {
    bullets.push({ insight: "你這星期的飲食選擇做得極好！繼續保持！" });
  }

  if ((data.missedMealDays ?? 0) > 0) {
    bullets.push({
      insight: `${data.missedMealDays}日的飲食記錄不完整`,
      suggestion: "建議每天記錄至少2餐，有助分析血糖趨勢。",
    });
  }
  if ((data.lateMealCount ?? 0) > 2) {
    bullets.push({
      insight: `本週有${data.lateMealCount}餐宵夜`,
      suggestion: "夜晚進食會影響隔日空腹血糖，建議睡前3小時避免進食。",
    });
  }
  if ((data.irregularMealDays ?? 0) > 0) {
    const mealName = data.irregularMealType ? (MEAL_TYPE_ZH[data.irregularMealType] ?? "正餐") : "正餐";
    bullets.push({
      insight: `本週${mealName}有進食時間不規律的情況`,
      suggestion: "規律進食時間有助穩定全日血糖。",
    });
  }
  const avgs = data.mealTypeAvgs;
  if (avgs) {
    const withData = (["breakfast", "lunch", "dinner"] as const).filter(k => avgs[k] !== null) as ("breakfast" | "lunch" | "dinner")[];
    if (withData.length >= 2) {
      const best = withData.reduce((a, b) => (avgs[a]! < avgs[b]! ? a : b));
      const worst = withData.reduce((a, b) => (avgs[a]! > avgs[b]! ? a : b));
      if (best !== worst) {
        bullets.push({
          insight: `${MEAL_TYPE_ZH[worst]}是本週血糖影響最高的一餐，${MEAL_TYPE_ZH[best]}最低`,
          suggestion: `可嘗試減少${MEAL_TYPE_ZH[worst]}的高糖、高精製碳水食物。`,
        });
      }
    }
  }

  const scoreVerdict = data.score !== undefined
    ? data.score >= 80
      ? "本週飲食控制良好，繼續保持。"
      : data.score >= 60
        ? "本週飲食表現尚可，仍有進步空間。"
        : "本週飲食有待改善，繼續記錄有助了解規律。"
    : null;

  if (variant === "preview") {
    return (
      <Card data-testid="card-weekly-preview">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">本週飲食摘要</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 flex flex-col gap-3">
          {data.score !== undefined && (
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">本週分數</p>
                <span className="text-4xl font-bold text-foreground" data-testid="text-weekly-preview-score">{data.score}</span>
              </div>
              {scoreVerdict && <p className="flex-1 text-sm text-muted-foreground">{scoreVerdict}</p>}
            </div>
          )}
          {data.hasAiDays && data.dayBreakdown && (
            <WeeklyDonut breakdown={data.dayBreakdown} />
          )}
          {onOpenWeekly && (
            <button
              type="button"
              onClick={onOpenWeekly}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.98]"
              data-testid="button-open-weekly-report"
            >
              {openWeeklyLabel}
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-weekly-report">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base">本週飲食摘要</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 flex flex-col gap-3">
        {data.score !== undefined && (
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-foreground" data-testid="text-weekly-score">{data.score}</span>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {scoreVerdict}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">截至今日</p>
            </div>
            <button
              onClick={() => setScoreExpanded(e => !e)}
              className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              data-testid="button-weekly-score-expand"
              aria-label="展開分數明細"
            >
              {scoreExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
        {scoreExpanded && data.components && (
          <div className="bg-muted/40 rounded-lg p-3 flex flex-col gap-1.5 text-xs" data-testid="div-weekly-score-breakdown">
            <div className="flex justify-between">
              <span className="text-muted-foreground">血糖友善比率</span>
              <span className="font-medium">{data.components.signalQuality}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">用餐規律性</span>
              <span className="font-medium">{data.components.timingRegularity}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">記錄頻率</span>
              <span className="font-medium">{data.components.freqConsistency}%</span>
            </div>
          </div>
        )}
        {(variant === "home" || variant === "reports") && data.hasAiDays && data.dayBreakdown && (
          <WeeklyDonut breakdown={data.dayBreakdown} />
        )}
        {variant === "reports" && data.dailyGrid && data.dailyGrid.length > 0 && (
          <WeeklyGrid grid={data.dailyGrid} />
        )}
        {bullets.length === 0 ? (
          <div className="rounded-lg bg-muted/30 px-3 py-2.5" data-testid="text-weekly-no-issues">
            <p className="text-lg font-semibold leading-relaxed text-foreground">本週飲食模式良好，繼續保持！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5" data-testid="list-weekly-insights">
            {bullets.map((b, i) => (
              <div key={i} className="rounded-lg bg-muted/30 px-3 py-2.5 flex flex-col gap-1" data-testid={`text-weekly-insight-${i}`}>
                <p className="text-lg font-semibold leading-relaxed text-foreground"><HighlightedText text={b.insight} /></p>
                {b.suggestion && <p className="text-base text-muted-foreground leading-relaxed"><HighlightedText text={b.suggestion} /></p>}
              </div>
            ))}
          </div>
        )}
        <p className="text-[9px] text-muted-foreground/40 leading-relaxed px-1" data-testid="text-weekly-disclaimer">
          {t("snap.advice_disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}

function MonthlyDonut({ data, totalDays }: { data: MonthlySummary; totalDays: number }) {
  const segments = [
    { value: data.stableDays ?? 0, color: IMPACT_COLOR.low },
    { value: data.mediumDays ?? 0, color: IMPACT_COLOR.medium },
    { value: data.highDays ?? 0, color: IMPACT_COLOR.high },
  ];
  const labels = ["穩定", "中等", "偏高"];
  const loggedDays = data.loggedDays ?? 0;
  return (
    <div className="flex items-center gap-4 py-4" data-testid="div-monthly-donut">
      <DonutChart segments={segments} size={101} strokeWidth={15}>
        <div className="flex flex-col items-center leading-none">
          <span className="text-xl font-bold text-foreground">{loggedDays}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">/{totalDays}天</span>
        </div>
      </DonutChart>
      <div className="flex flex-col gap-0.5 flex-1">
        {segments.map((s, i) => s.value > 0 && (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-muted-foreground flex-1">{labels[i]}</span>
            <span className="text-[11px] font-medium text-foreground">{s.value}天</span>
          </div>
        ))}
        {loggedDays === 0 && <p className="text-xs text-muted-foreground">暫無血糖日數據</p>}
      </div>
    </div>
  );
}

function SymptomBars({ symptomsData }: { symptomsData: SymptomData }) {
  const entries = Object.entries(symptomsData.symptoms)
    .filter(([k]) => k !== "normal")
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const maxCount = Math.max(...entries.map(([, c]) => c));
  return (
    <div className="flex flex-col gap-1.5" data-testid="div-symptom-bars">
      <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">餐後症狀</p>
      {entries.map(([key, count]) => {
        const barPct = Math.max(4, (count / maxCount) * 100);
        const color = SYMPTOM_COLOR[key] ?? "#6b7280";
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">{SYMPTOM_ZH[key] ?? key}</span>
            <div className="flex-1 bg-muted/30 rounded-full overflow-hidden" style={{ height: 8, padding: "2px" }}>
              <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-medium text-foreground w-4 text-right flex-shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyCard() {
  const { t } = useTranslation();
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const month = getPrevMonth();
  const [y, m] = month.split("-").map(Number);
  const monthTitle = `${y}年${m}月報告`;
  const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const { data, isLoading } = useQuery<MonthlySummary>({
    queryKey: ["/api/snap/monthly-summary", month],
    queryFn: async () => {
      const res = await fetch(`/api/snap/monthly-summary?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: symptomsData } = useQuery<SymptomData>({
    queryKey: ["/api/snap/monthly-symptoms", month],
    queryFn: async () => {
      const res = await fetch(`/api/snap/monthly-symptoms?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isLoading && !(data?.insufficient),
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
    ? score - data.priorScore : null;

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
                {priorDelta > 0 ? `↑ 比上月高 ${priorDelta} 分`
                  : priorDelta < 0 ? `↓ 比上月低 ${Math.abs(priorDelta)} 分`
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

        {data.hasAiDays && <MonthlyDonut data={data} totalDays={totalDays} />}

        {symptomsData && symptomsData.totalWithSymptom > 0 && (
          <SymptomBars symptomsData={symptomsData} />
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

        <p className="text-[9px] text-muted-foreground/40 leading-relaxed px-1" data-testid="text-monthly-disclaimer">
          {t("snap.advice_disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}

const PATTERN_CARD_TITLES: Record<TwoMonthPatternCard["cardType"], string> = {
  mealtime: "two_month_report.cards.mealtime",
  weekday: "two_month_report.cards.weekday",
  "weekday-weekend": "two_month_report.cards.weekday_weekend",
};

export function LastTwoMonthsCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<TwoMonthReportSummary>({
    queryKey: ["/api/snap/two-month-summary"],
    queryFn: async () => {
      const res = await fetch("/api/snap/two-month-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load two-month summary");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-two-month-report">
        <CardContent className="py-5">
          <p className="text-sm text-center text-muted-foreground">{t("two_month_report.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  if (data.status === "progress") {
    return (
      <Card data-testid="card-two-month-report">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">{t("two_month_report.heading")}</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground" data-testid={`two-month-progress-${data.progressState}`}>
            {t(`two_month_report.progress.${data.progressState}`)}
          </p>
        </CardContent>
      </Card>
    );
  }

  const visibleCards = data.cards.filter(card => card.state !== "unavailable");
  if (data.status === "insufficient" || visibleCards.length === 0) {
    return (
      <Card data-testid="card-two-month-report">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">{t("two_month_report.heading")}</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground" data-testid="two-month-insufficient">
            {t("two_month_report.not_enough_records")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-two-month-report">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base">{t("two_month_report.heading")}</CardTitle>
        <p className="text-xs text-muted-foreground">{data.window.startDate} – {data.window.endDate}</p>
      </CardHeader>
      <CardContent className="pb-4 flex flex-col gap-3">
        {visibleCards.map(card => (
          <div
            key={card.cardType}
            className="rounded-xl bg-muted/40 px-3 py-3"
            data-testid={`two-month-card-${card.cardType}`}
          >
            <p className="mb-1 text-xs text-foreground">
              <strong
                className="font-bold text-primary"
                data-testid={`two-month-dimension-${card.cardType}`}
              >
                {t(PATTERN_CARD_TITLES[card.cardType])}
              </strong>
            </p>
            {card.state === "named" ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("two_month_report.named_observation", {
                  bucket: t(`two_month_report.buckets.${card.leadingBucket}`),
                })}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground" data-testid={`two-month-neutral-${card.cardType}`}>
                {t("two_month_report.no_clear_difference")}
              </p>
            )}
          </div>
        ))}
        <p className="text-[9px] text-muted-foreground/50 leading-relaxed px-1">{t("snap.advice_disclaimer")}</p>
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
        <WeeklyCard weekStart={weekStart} variant="reports" />
        <MonthlyCard />
      </div>
    </div>
  );
}
