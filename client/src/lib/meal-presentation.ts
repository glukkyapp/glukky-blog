export interface MealLogItem {
  id: number;
  snapTime: string;
  localDate: string;
  mealType: string | null;
  foodName: string | null;
  glucoseImpact: string | null;
  postMealGlucoseMmol?: number | null;
  hstixReadingId?: number | null;
  postMealSymptom?: string | null;
  previousMealOverlap?: boolean;
  overlapDismissed?: boolean;
}

const MEALS = {
  breakfast: ["Breakfast", "早餐"],
  lunch: ["Lunch", "午餐"],
  dinner: ["Dinner", "晚餐"],
  snack: ["Snack", "小食"],
} as const;

export type KnownImpact = "low" | "medium" | "high";
export const GLUCOSE_BADGE: Record<KnownImpact, {
  bg: string;
  text: string;
  label: string;
  labelZh: string;
  color: string;
  textColor: string;
}> = {
  low: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Low",
    labelZh: "低影響",
    color: "#22c55e",
    textColor: "#166534",
  },
  medium: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Med",
    labelZh: "中影響",
    color: "#f59e0b",
    textColor: "#92400e",
  },
  high: {
    bg: "bg-red-100",
    text: "text-red-700",
    label: "High",
    labelZh: "高影響",
    color: "#ef4444",
    textColor: "#991b1b",
  },
};

export const MEAL_PILL_COLOR: Record<string, string> = {
  breakfast: "bg-sky-100 text-sky-700",
  lunch: "bg-lime-100 text-lime-700",
  dinner: "bg-violet-100 text-violet-700",
  snack: "bg-orange-100 text-orange-700",
};

export function isChineseLanguage(language: string): boolean {
  return language.startsWith("zh") || language === "yue";
}

export function mealLabel(type: string | null | undefined, isZh: boolean): string {
  if (type && type in MEALS) return MEALS[type as keyof typeof MEALS][isZh ? 1 : 0];
  return isZh ? "其他餐點" : "Other meal";
}

export function impactPresentation(impact: string | null | undefined, isZh: boolean) {
  const known = impact === "low" || impact === "medium" || impact === "high";
  if (!known) return {
    key: "unknown" as const,
    label: isZh ? "影響未能評估" : "Impact not available",
    color: "#87958a",
    textColor: "#4b5563",
  };
  const badge = GLUCOSE_BADGE[impact];
  return {
    key: impact,
    label: isZh ? badge.labelZh : badge.label,
    color: badge.color,
    textColor: badge.textColor,
  };
}

export function mealTimeLabel(value: string, locale = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}