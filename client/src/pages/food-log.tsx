import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import PostMealCard from "@/components/PostMealCard";
import { queryClient } from "@/lib/queryClient";

interface MealLogItem {
  id: number;
  snapTime: string;
  localDate: string;
  mealType: string | null;
  foodName: string | null;
  glucoseImpact: string | null;
  postMealGlucoseMmol: number | null;
  postMealSymptom: string | null;
  postMealSkipped: boolean | null;
  postMealSpikeFromBaseline: number | null;
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

function isWithin2h(snapTime: string): boolean {
  const diff = Date.now() - new Date(snapTime).getTime();
  return diff >= 0 && diff < 2 * 60 * 60 * 1000;
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

const GLUCOSE_BADGE_ZH: Record<string, string> = {
  low:    "血糖影響：低",
  medium: "血糖影響：中",
  high:   "血糖影響：高",
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
  fastingBaselineMmol: number | null;
}

export default function FoodLog() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = i18n.language || "en";
  const isZh = locale.startsWith("zh") || locale === "yue";

  const [month, setMonth] = useState(getCurrentMonth);
  const currentMonth = getCurrentMonth();
  const [glucoseSheetSnapId, setGlucoseSheetSnapId] = useState<number | null>(null);

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

  const glucoseLabel = (impact: string) => {
    return isZh ? (GLUCOSE_BADGE_ZH[impact] ?? impact) : (GLUCOSE_BADGE[impact]?.label ?? impact);
  };

  const symptomLabel = (sym: string | null) => {
    if (!sym) return null;
    return isZh ? (SYMPTOM_LABEL_ZH[sym] ?? sym) : (SYMPTOM_LABEL_EN[sym] ?? sym);
  };

  const handleBack = () => {
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
                    const badge = item.glucoseImpact ? GLUCOSE_BADGE[item.glucoseImpact] : null;
                    const pillColor = item.mealType
                      ? (MEAL_PILL_COLOR[item.mealType] ?? "bg-gray-100 text-gray-600")
                      : null;
                    const hasPostMeal = item.postMealGlucoseMmol !== null && item.postMealGlucoseMmol !== undefined;
                    const withinWindow = isWithin2h(item.snapTime);
                    const needsGlucoseLog = withinWindow && !hasPostMeal && !item.postMealSkipped;
                    const spike = item.postMealSpikeFromBaseline;

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
                            {badge && (
                              <span
                                data-testid={`food-log-glucose-${item.id}`}
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                              >
                                {glucoseLabel(item.glucoseImpact!)}
                              </span>
                            )}
                          </div>
                        </div>

                        {hasPostMeal && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              data-testid={`food-log-post-meal-glucose-${item.id}`}
                              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700"
                            >
                              {spike !== null
                                ? t("glucose.spike_label", {
                                    mmol: item.postMealGlucoseMmol!.toFixed(1),
                                    spike: (spike >= 0 ? "+" : "") + spike.toFixed(1),
                                  })
                                : `🔴 ${item.postMealGlucoseMmol!.toFixed(1)} mmol/L`}
                            </span>
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

                        {needsGlucoseLog && (
                          <button
                            type="button"
                            data-testid={`button-food-log-record-glucose-${item.id}`}
                            onClick={() => setGlucoseSheetSnapId(item.id)}
                            className="self-start text-xs font-medium text-primary hover:underline transition-colors"
                          >
                            {t("glucose.log_button")}
                          </button>
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

      <Sheet
        open={glucoseSheetSnapId !== null}
        onOpenChange={(open) => { if (!open) setGlucoseSheetSnapId(null); }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-4">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">{t("glucose.log_button")}</SheetTitle>
          </SheetHeader>
          {glucoseSheetSnapId !== null && (
            <PostMealCard
              snapId={glucoseSheetSnapId}
              hasFastingBaseline={profile?.fastingBaselineMmol !== null && profile?.fastingBaselineMmol !== undefined}
              onDone={() => setGlucoseSheetSnapId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
