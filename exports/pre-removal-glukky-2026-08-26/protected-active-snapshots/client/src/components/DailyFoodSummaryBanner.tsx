import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SnapEntry {
  glucoseImpact: string | null;
  mealType: string | null;
  snapTime: string;
  foodName: string | null;
}

const IMPACT_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const MEAL_ZH: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "小食",
};

const HOUR_START = 6;
const HOUR_END = 24;

const SUGGESTION_LOOKUP: Record<string, string[]> = {
  lunch: ["烚蛋蔬菜飯", "清湯米線配時蔬", "蒸魚配糙米飯", "雞胸肉沙律", "豆腐配蔬菜粥", "清湯河粉配菜心", "冬菇蒸雞配少量白飯"],
  dinner: ["烚蛋蔬菜飯", "清湯米線配時蔬", "蒸魚配糙米飯", "雞胸肉沙律", "豆腐配蔬菜粥", "清湯河粉配菜心", "冬菇蒸雞配少量白飯"],
  breakfast: ["白煮蛋配全麥多士", "無糖燕麥粥", "豆漿配無糖麵包", "雞蛋配蔬菜"],
  snack: ["少量無糖豆漿", "清淡湯水或熱茶", "少量合桃", "藍莓配無糖乳酪"],
};

function pickSuggestion(mealType: string | null): string {
  const options = SUGGESTION_LOOKUP[mealType ?? "lunch"] ?? SUGGESTION_LOOKUP.lunch;
  const dow = new Date().getDay();
  return options[dow % options.length];
}

function getLocalHour(snapTime: string, tz?: string): number {
  try {
    const effectiveTz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: effectiveTz,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(snapTime));
    const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "12", 10);
    const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
    return h + m / 60;
  } catch {
    return new Date(snapTime).getHours();
  }
}

function formatLocalTime(snapTime: string, tz?: string): string {
  try {
    const effectiveTz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: effectiveTz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(snapTime));
    const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "12", 10);
    const min = parts.find(p => p.type === "minute")?.value ?? "00";
    const period = h < 12 ? "上午" : "下午";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${period}${String(displayH).padStart(2, "0")}:${min}`;
  } catch {
    return "";
  }
}

function toXPct(hourFloat: number): number {
  const clamped = Math.max(HOUR_START, Math.min(HOUR_END, hourFloat));
  return ((clamped - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
}

function getYesterday(tz?: string, dateOverride?: string | null): string {
  if (dateOverride) {
    const [y, m, d] = dateOverride.split("-").map(Number);
    const dObj = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
    return dObj.toISOString().split("T")[0];
  }
  try {
    const effectiveTz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const yesterday = new Date(Date.now() - 86400000);
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: effectiveTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23",
    }).formatToParts(yesterday);
    const y = parts.find(p => p.type === "year")?.value;
    const mo = parts.find(p => p.type === "month")?.value;
    const dy = parts.find(p => p.type === "day")?.value;
    return `${y}-${mo}-${dy}`;
  } catch {
    return new Date(Date.now() - 86400000).toISOString().split("T")[0];
  }
}

function isIrregularEntry(mealType: string | null, snapTime: string, tz?: string): boolean {
  if (!mealType || mealType === "snack") return false;
  const hour = getLocalHour(snapTime, tz);
  if (mealType === "breakfast") return hour < 7 || hour >= 11;
  if (mealType === "lunch") return hour < 12 || hour >= 14;
  if (mealType === "dinner") return hour < 18 || hour >= 21;
  return false;
}

function buildSummary(snaps: SnapEntry[], irregularMealCount: number, tz?: string): {
  primary: string;
  primarySuggestion?: string;
  secondary: { insight: string; suggestion?: string }[];
} {
  if (snaps.length === 0) {
    return {
      primary: "昨日未見飲食記錄。",
      primarySuggestion: "定時進食有助穩定全日血糖。",
      secondary: [],
    };
  }

  const lowMealPrefix = snaps.length < 2 ? `昨日只記錄了${snaps.length}餐。` : "";
  const highSnaps = snaps.filter(s => s.glucoseImpact === "high" && s.mealType && s.mealType !== "snack");
  const highCount = snaps.filter(s => s.glucoseImpact === "high").length;
  const mediumCount = snaps.filter(s => s.glucoseImpact === "medium").length;
  const hasSnack = snaps.some(s => s.mealType === "snack");

  let primary: string;
  let primarySuggestion: string | undefined;

  if (highCount > 0) {
    if (highSnaps.length > 0) {
      const snap = highSnaps[0];
      const mealName = MEAL_ZH[snap.mealType!] ?? "";
      const foodPart = snap.foodName ? `（${snap.foodName}）` : "";
      primary = lowMealPrefix + `昨日${mealName}${foodPart}血糖影響偏高。`;
      const suggestion = pickSuggestion(snap.mealType);
      primarySuggestion = `今天可試試${MEAL_ZH[snap.mealType!] ?? "正餐"}選：${suggestion}。`;
    } else {
      primary = lowMealPrefix + `昨日有${highCount}餐血糖影響偏高。`;
      primarySuggestion = "建議今天多選擇低升糖食物。";
    }
  } else if (mediumCount > 0) {
    primary = lowMealPrefix + "昨日飲食整體穩定，部分餐點血糖影響中等。";
    primarySuggestion = "留意是否可進一步選擇低升糖食物。";
  } else {
    const lowSnaps = snaps.filter(s => s.glucoseImpact === "low" && s.mealType && s.mealType !== "snack");
    if (lowSnaps.length > 0) {
      const mealCounts: Record<string, number> = {};
      for (const s of lowSnaps) {
        if (s.mealType) mealCounts[s.mealType] = (mealCounts[s.mealType] ?? 0) + 1;
      }
      const bestMeal = Object.entries(mealCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const mealName = bestMeal ? (MEAL_ZH[bestMeal] ?? "") : "";
      primary = lowMealPrefix + (mealName
        ? `繼續保持昨日${mealName}的良好選擇！`
        : "昨日飲食整體穩定，血糖影響輕微。");
    } else {
      primary = lowMealPrefix + "昨日飲食整體穩定，血糖影響輕微。";
    }
  }

  const secondary: { insight: string; suggestion?: string }[] = [];

  if (hasSnack) {
    secondary.push({
      insight: "昨日有宵夜記錄。",
      suggestion: "建議睡前3小時避免進食，有助穩定血糖。",
    });
  }

  if (irregularMealCount > 0) {
    const irregularSnaps = snaps.filter(s => isIrregularEntry(s.mealType, s.snapTime, tz));
    const irregNames = Array.from(new Set(irregularSnaps.map(s => MEAL_ZH[s.mealType!] ?? "").filter(Boolean))).join("、");
    const timeStr = irregularSnaps.length > 0 ? formatLocalTime(irregularSnaps[0].snapTime, tz) : "";
    const timePart = timeStr ? `（${timeStr}進食）` : "";
    secondary.push({
      insight: irregNames
        ? `昨日${irregNames}進食時間不規律${timePart}。`
        : `昨日有${irregularMealCount}餐在非預期時段進食。`,
      suggestion: "規律進食時間有助穩定全日血糖。",
    });
  }

  return { primary, primarySuggestion, secondary };
}

interface TooltipState {
  clientX: number;
  clientY: number;
  snap: SnapEntry;
}

interface Props {
  tz?: string;
  timeOverride?: number | null;
  dateOverride?: string | null;
  onViewMeal?: () => void;
  viewMealLabel?: string;
}

export function DailyFoodSummaryBanner({
  tz,
  dateOverride,
  onViewMeal,
  viewMealLabel = "了解這餐",
}: Props) {
  const { t } = useTranslation();
  const yesterday = getYesterday(tz, dateOverride);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { data, isLoading } = useQuery<{ snaps: SnapEntry[]; irregularMealCount?: number }>({
    queryKey: ["/api/snap/daily-summary", yesterday],
    queryFn: async () => {
      const res = await fetch(`/api/snap/daily-summary?date=${yesterday}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch daily summary");
      return res.json();
    },
  });

  if (isLoading) return null;

  const snaps = data?.snaps ?? [];
  const irregularMealCount = data?.irregularMealCount ?? 0;
  const { primary, primarySuggestion, secondary } = buildSummary(snaps, irregularMealCount, tz);

  const handleDotClick = (e: React.MouseEvent, snap: SnapEntry, active: boolean) => {
    e.stopPropagation();
    if (active) { setTooltip(null); return; }
    setTooltip({ clientX: e.clientX, clientY: e.clientY, snap });
  };

  return (
    <Card
      className="border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40"
      data-testid="card-daily-food-summary"
      onClick={() => setTooltip(null)}
    >
      <CardContent className="pt-3 pb-3">
        <div className="rounded-lg bg-background/60 px-3 py-2.5 flex flex-col gap-1">
          <p className="text-lg font-semibold leading-relaxed text-foreground" data-testid="text-daily-summary-primary">
            {primary}
          </p>
          {primarySuggestion && (
            <p className="text-base text-muted-foreground leading-relaxed">{primarySuggestion}</p>
          )}
          {snaps.length > 0 && onViewMeal && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewMeal();
              }}
              className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.97]"
              data-testid="button-daily-view-meal"
            >
              {viewMealLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {snaps.length > 0 && (
          <div ref={containerRef} className="mt-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1.5 font-medium tracking-wide uppercase">
              昨日飲食時間軸
            </p>
            <div className="relative h-7 mx-1" data-testid="strip-meal-timeline">
              <div className="absolute inset-0 bg-muted/30 rounded-full" />
              {[9, 12, 15, 18, 21].map(h => (
                <div
                  key={h}
                  style={{ left: `${toXPct(h)}%` }}
                  className="absolute top-0 bottom-0 w-px bg-border/50"
                />
              ))}
              {snaps.map((snap, i) => {
                const hourFloat = getLocalHour(snap.snapTime, tz);
                const xPct = toXPct(hourFloat);
                const color = IMPACT_COLOR[snap.glucoseImpact ?? "low"] ?? IMPACT_COLOR.low;
                const isActive = tooltip?.snap === snap;
                return (
                  <button
                    key={i}
                    data-testid={`dot-snap-${i}`}
                    onClick={e => handleDotClick(e, snap, isActive)}
                    style={{
                      position: "absolute",
                      left: `${xPct}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: color,
                      border: `2px solid ${isActive ? "#fff" : "transparent"}`,
                      boxShadow: isActive ? `0 0 0 2px ${color}` : "none",
                      cursor: "pointer",
                      zIndex: 1,
                    }}
                    aria-label={`${MEAL_ZH[snap.mealType ?? ""] ?? snap.mealType}${snap.foodName ? ": " + snap.foodName : ""}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5 mx-1">
              <span>6時</span>
              <span>12時</span>
              <span>18時</span>
              <span>24時</span>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {secondary.map((s, i) => (
            <div key={i} className="rounded-lg bg-background/60 px-3 py-2.5 flex flex-col gap-1">
              <p className="text-lg font-semibold leading-relaxed text-foreground" data-testid={`text-daily-summary-secondary-${i}`}>
                {s.insight}
              </p>
              {s.suggestion && (
                <p className="text-base text-muted-foreground leading-relaxed">{s.suggestion}</p>
              )}
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground/40 leading-relaxed mt-1 px-1" data-testid="text-daily-summary-disclaimer">
            {t("snap.advice_disclaimer")}
          </p>
        </div>
      </CardContent>

      {tooltip && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setTooltip(null)}
          />
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: tooltip.clientX,
              top: tooltip.clientY - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
            }}
            className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs min-w-28 max-w-44"
            onClick={e => e.stopPropagation()}
          >
            {tooltip.snap.foodName && (
              <p className="font-medium text-foreground truncate">{tooltip.snap.foodName}</p>
            )}
            <p className="text-muted-foreground">
              {MEAL_ZH[tooltip.snap.mealType ?? ""] ?? tooltip.snap.mealType}
            </p>
            {tooltip.snap.glucoseImpact && (
              <p style={{ color: IMPACT_COLOR[tooltip.snap.glucoseImpact] ?? undefined }} className="font-medium mt-0.5">
                {tooltip.snap.glucoseImpact === "low" ? "血糖友善" :
                 tooltip.snap.glucoseImpact === "medium" ? "影響中等" : "影響偏高"}
              </p>
            )}
          </div>
        </>,
        document.body,
      )}
    </Card>
  );
}
