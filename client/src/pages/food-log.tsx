import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Pencil, AlertTriangle, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface MealLogItem {
  id: number;
  snapTime: string;
  localDate: string;
  mealType: string | null;
  foodName: string | null;
  glucoseImpact: string | null;
  postMealGlucoseMmol: number | null;
  hstixReadingId: number | null;
  postMealSymptom: string | null;
  previousMealOverlap: boolean;
  overlapDismissed: boolean;
}

interface MealLogResponse {
  month: string;
  items: MealLogItem[];
}

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
  } catch {
    return ym;
  }
}

function formatDateHeading(localDate: string, locale: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "short" }).format(date);
  } catch {
    return localDate;
  }
}

function formatTime(snapTime: string): string {
  try {
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(snapTime));
  } catch {
    return "";
  }
}

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MEAL_TYPE_LABEL_ZH: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "小食",
};

const GLUCOSE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  low:    { bg: "bg-emerald-100", text: "text-emerald-700", label: "Low"  },
  medium: { bg: "bg-amber-100",   text: "text-amber-700",   label: "Med"  },
  high:   { bg: "bg-red-100",     text: "text-red-700",     label: "High" },
};

const GLUCOSE_PILL_SOLID: Record<string, string> = {
  low:    "#22c55e",
  medium: "#f59e0b",
  high:   "#ef4444",
};

const MEAL_PILL_COLOR: Record<string, string> = {
  breakfast: "bg-sky-100 text-sky-700",
  lunch:     "bg-lime-100 text-lime-700",
  dinner:    "bg-violet-100 text-violet-700",
  snack:     "bg-orange-100 text-orange-700",
};

const SYMPTOM_LABEL_EN: Record<string, string> = {
  normal:        "😊 Normal",
  tired:         "😴 Tired",
  blurred_vision:"👁 Blurred vision",
  thirsty:       "😟 Thirsty",
};

const SYMPTOM_LABEL_ZH: Record<string, string> = {
  normal:        "😊 正常",
  tired:         "😴 疲倦",
  blurred_vision:"👁 視力模糊",
  thirsty:       "😟 口渴",
};

interface ProfileData {
  glucoseGroup?: string | null;
}

function classifyMmol(mmol: number, glucoseGroup?: string | null): "low" | "medium" | "high" {
  const isT2dm = glucoseGroup === "t2dm";
  if (isT2dm) {
    if (mmol >= 10.0) return "high";
    if (mmol >= 7.5) return "medium";
    return "low";
  }
  if (mmol >= 7.8) return "high";
  if (mmol >= 5.9) return "medium";
  return "low";
}

export default function FoodLog() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = i18n.language || "en";
  const isZh = locale.startsWith("zh") || locale === "yue";

  const [month, setMonth] = useState(getCurrentMonth);
  const currentMonth = getCurrentMonth();
  const [expandedOverlap, setExpandedOverlap] = useState<Set<number>>(new Set());

  const search = useSearch();
  const hstixPathFor = (item: MealLogItem) => {
    const params = new URLSearchParams({ mealSnapId: String(item.id) });
    if (item.hstixReadingId) params.set("readingId", String(item.hstixReadingId));
    return `/hstix?${params.toString()}`;
  };
  useEffect(() => {
    const snapId = Number(new URLSearchParams(search).get("snap"));
    if (Number.isInteger(snapId) && snapId > 0) {
      setLocation(`/hstix?mealSnapId=${snapId}`);
    }
  }, [search, setLocation]);

  const { data: profile } = useQuery<ProfileData>({ queryKey: ["/api/profile"] });

  const { data, isLoading } = useQuery<MealLogResponse>({
    queryKey: ["/api/snap/meal-log", month],
    queryFn: async () => {
      const res = await fetch(`/api/snap/meal-log?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const grouped = new Map<string, MealLogItem[]>();
  for (const item of data?.items ?? []) {
    if (!grouped.has(item.localDate)) grouped.set(item.localDate, []);
    grouped.get(item.localDate)!.push(item);
  }

  const mealLabel = (type: string | null) => {
    if (!type) return null;
    return isZh ? (MEAL_TYPE_LABEL_ZH[type] ?? type) : (MEAL_TYPE_LABEL[type] ?? type);
  };

  const glucoseLabel = (impact: string) => GLUCOSE_BADGE[impact]?.label ?? impact;

  const symptomLabel = (sym: string | null) => {
    if (!sym) return null;
    return isZh ? (SYMPTOM_LABEL_ZH[sym] ?? sym) : (SYMPTOM_LABEL_EN[sym] ?? sym);
  };

  const handleBack = () => {
    if (new URLSearchParams(search).get("from") === "report") {
      setLocation("/report");
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 pt-4">
      <div className="max-w-sm mx-auto px-4">
        <button
          data-testid="food-log-back"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1 hover:text-foreground transition-colors"
          aria-label={isZh ? "返回" : "Back"}
        >
          <ChevronLeft size={16} />
          {isZh ? "返回" : "Back"}
        </button>

        <div className="flex items-center justify-between mb-5">
          <button
            data-testid="food-log-prev-month"
            onClick={() => setMonth(m => addMonths(m, -1))}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>

          <h1
            data-testid="food-log-month-label"
            className="text-base font-semibold text-foreground"
          >
            {formatMonthLabel(month, locale)}
          </h1>

          <button
            data-testid="food-log-next-month"
            onClick={() => setMonth(m => addMonths(m, 1))}
            disabled={month >= currentMonth}
            className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight size={20} className="text-foreground" />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && grouped.size === 0 && (
          <div
            data-testid="food-log-empty"
            className="text-center text-muted-foreground text-sm py-16"
          >
            {isZh ? "本月沒有食物記錄" : "No food snaps this month"}
          </div>
        )}

        {!isLoading && grouped.size > 0 && (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([date, items]) => (
              <div key={date} data-testid={`food-log-day-${date}`}>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {formatDateHeading(date, locale)}
                </p>
                <div className="space-y-2">
                  {items.map(item => {
                    const effectiveImpact: "low" | "medium" | "high" | null =
                      item.postMealGlucoseMmol != null
                        ? classifyMmol(item.postMealGlucoseMmol, profile?.glucoseGroup)
                        : (item.glucoseImpact as "low" | "medium" | "high" | null);
                    const badge = effectiveImpact ? GLUCOSE_BADGE[effectiveImpact] : null;
                    const pillColor = item.mealType
                      ? (MEAL_PILL_COLOR[item.mealType] ?? "bg-gray-100 text-gray-600")
                      : null;
                    const hasPostMeal = item.postMealGlucoseMmol !== null && item.postMealGlucoseMmol !== undefined;
                    const showOverlapWarning = item.previousMealOverlap && !item.overlapDismissed;
                    const overlapExpanded = expandedOverlap.has(item.id);

                    const handleDismissOverlap = () => {
                      queryClient.setQueryData(["/api/snap/meal-log", month], (old: any) => {
                        if (!old) return old;
                        return { ...old, items: old.items.map((i: MealLogItem) => i.id === item.id ? { ...i, overlapDismissed: true } : i) };
                      });
                      setExpandedOverlap(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                      void apiRequest("PATCH", `/api/snap/${item.id}/dismiss-overlap`, {}).catch(() => {});
                    };

                    return (
                      <div
                        key={item.id}
                        data-testid={`food-log-item-${item.id}`}
                        className="bg-card border border-border rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.foodName ?? (isZh ? "食物" : "Food")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(item.snapTime)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.mealType && pillColor && (
                              <span
                                data-testid={`food-log-meal-type-${item.id}`}
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${pillColor}`}
                              >
                                {mealLabel(item.mealType)}
                              </span>
                            )}
                            {effectiveImpact && GLUCOSE_PILL_SOLID[effectiveImpact] && (
                              <span
                                data-testid={`food-log-glucose-${item.id}`}
                                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: GLUCOSE_PILL_SOLID[effectiveImpact] }}
                                aria-label={glucoseLabel(effectiveImpact)}
                              />
                            )}
                            {showOverlapWarning && (
                              <button
                                type="button"
                                data-testid={`button-food-log-overlap-${item.id}`}
                                onClick={() => setExpandedOverlap(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                  return next;
                                })}
                                className="text-amber-500 hover:text-amber-600 transition-colors"
                                aria-label="Meal gap warning"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {showOverlapWarning && overlapExpanded && (
                          <div
                            data-testid={`food-log-overlap-tooltip-${item.id}`}
                            className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2"
                          >
                            <p className="text-xs text-amber-800 leading-relaxed flex-1">
                              {t("food_log.overlap_tooltip")}
                            </p>
                            <button
                              type="button"
                              data-testid={`button-food-log-dismiss-overlap-${item.id}`}
                              onClick={handleDismissOverlap}
                              className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors mt-0.5"
                              aria-label="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {hasPostMeal && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              data-testid={`food-log-post-meal-glucose-${item.id}`}
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                badge
                                  ? `${badge.bg} ${badge.text}`
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {t("glucose.spike_label", { mmol: item.postMealGlucoseMmol!.toFixed(1) })}
                            </span>
                            <button
                              type="button"
                              data-testid={`button-food-log-edit-glucose-${item.id}`}
                              onClick={() => setLocation(hstixPathFor(item))}
                              className="p-2 touch-manipulation text-muted-foreground hover:text-foreground transition-colors active:scale-95 -my-1.5"
                              aria-label="Edit glucose reading"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {item.postMealSymptom && (
                              <span
                                data-testid={`food-log-symptom-${item.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                {symptomLabel(item.postMealSymptom)}
                              </span>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
