import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
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

function isIrregularEntry(mealType: string | null, snapTime: string): boolean {
  if (!mealType || mealType === "snack") return false;
  const hour = getLocalHour(snapTime);
  if (mealType === "breakfast") return hour < 7 || hour >= 11;
  if (mealType === "lunch") return hour < 12 || hour >= 14;
  if (mealType === "dinner") return hour < 18 || hour >= 21;
  return false;
}

const IRREGULAR_EXAMPLE: Record<string, string> = {
  breakfast: "（如早上11時後才食早餐）",
  lunch: "（如下午2時後才食午餐）",
  dinner: "（如晚上9時後才食晚餐）",
};

function buildSummary(snaps: SnapEntry[], irregularMealCount: number): {
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
    const highMealNames = Array.from(new Set(highSnaps.map(s => MEAL_ZH[s.mealType!] ?? "").filter(Boolean))).join("、");
    primary = lowMealPrefix + (highMealNames
      ? `昨日${highMealNames}血糖影響偏高。`
      : `昨日有${highCount}餐血糖影響偏高。`);
    primarySuggestion = "建議今天多選擇低升糖食物。";
  } else if (mediumCount > 0) {
    primary = lowMealPrefix + "昨日飲食整體穩定，部分餐點血糖影響中等。";
    primarySuggestion = "留意是否可進一步選擇低升糖食物。";
  } else {
    primary = lowMealPrefix + "昨日飲食整體穩定，血糖影響輕微。";
  }

  const secondary: { insight: string; suggestion?: string }[] = [];
  if (hasSnack) {
    secondary.push({
      insight: "昨日有宵夜記錄。",
      suggestion: "建議睡前3小時避免進食，有助穩定血糖。",
    });
  }
  if (irregularMealCount > 0) {
    const irregularSnaps = snaps.filter(s => isIrregularEntry(s.mealType, s.snapTime));
    const irregNames = Array.from(new Set(irregularSnaps.map(s => MEAL_ZH[s.mealType!] ?? "").filter(Boolean))).join("、");
    const example = irregularSnaps.length > 0 ? (IRREGULAR_EXAMPLE[irregularSnaps[0].mealType!] ?? "") : "";
    secondary.push({
      insight: irregNames
        ? `昨日${irregNames}進食時間不規律${example}。`
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
}

export function DailyFoodSummaryBanner({ tz, timeOverride, dateOverride }: Props) {
  const { t } = useTranslation();
  const hour = timeOverride ?? new Date().getHours();
  const yesterday = getYesterday(tz, dateOverride);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const { data, isLoading } = useQuery<{ snaps: SnapEntry[]; irregularMealCount?: number }>({
    queryKey: ["/api/snap/daily-summary", yesterday],
    queryFn: async () => {
      const res = await fetch(`/api/snap/daily-summary?date=${yesterday}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch daily summary");
      return res.json();
    },
    enabled: hour >= 8,
  });

  if (hour < 8 || isLoading) return null;

  const snaps = data?.snaps ?? [];
  const irregularMealCount = data?.irregularMealCount ?? 0;
  const { primary, primarySuggestion, secondary } = buildSummary(snaps, irregularMealCount);

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
        {snaps.length > 0 && (
          <div ref={containerRef} className="mb-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1.5 font-medium tracking-wide uppercase">
              昨日飲食時間軸
            </p>
            <div className="relative h-5 mx-1" data-testid="strip-meal-timeline">
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

        <div className="flex flex-col">
          <p className="text-sm font-medium text-foreground" data-testid="text-daily-summary-primary">
            {primary}
          </p>
          {primarySuggestion && (
            <p className="text-xs text-muted-foreground mt-0.5">{primarySuggestion}</p>
          )}
          {secondary.map((s, i) => (
            <div key={i} className="mt-1">
              <p className="text-xs text-muted-foreground" data-testid={`text-daily-summary-secondary-${i}`}>
                {s.insight}
              </p>
              {s.suggestion && (
                <p className="text-xs text-muted-foreground/60 mt-0.5">{s.suggestion}</p>
              )}
            </div>
          ))}
          <div className="mt-2">
            <button
              data-testid="button-daily-disclaimer-toggle"
              onClick={() => setDisclaimerOpen(v => !v)}
              className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              aria-label="免責聲明"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {disclaimerOpen && (
              <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed" data-testid="text-daily-summary-disclaimer">
                {t("snap.advice_disclaimer")}
              </p>
            )}
          </div>
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
