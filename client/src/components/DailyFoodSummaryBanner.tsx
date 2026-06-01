import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface SnapSummaryItem {
  glucoseImpact: string | null;
  mealType: string | null;
  snapTime: string;
}

function getYesterday(tz?: string): string {
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
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  } catch {
    return new Date(Date.now() - 86400000).toISOString().split("T")[0];
  }
}

function buildSummary(snaps: SnapSummaryItem[], irregularMealCount: number): { primary: string; secondary: string[] } {
  if (snaps.length === 0) {
    return {
      primary: "昨日未見飲食記錄。定時進食有助穩定全日血糖。",
      secondary: [],
    };
  }
  const highCount = snaps.filter(s => s.glucoseImpact === "high").length;
  const mediumCount = snaps.filter(s => s.glucoseImpact === "medium").length;
  const hasSnack = snaps.some(s => s.mealType === "snack");

  let primary: string;
  if (highCount > 0) {
    primary = `昨日有${highCount}餐血糖影響偏高。`;
  } else if (mediumCount > 0) {
    primary = "昨日飲食整體穩定，部分餐點血糖影響中等。";
  } else {
    primary = "昨日飲食整體穩定，血糖影響輕微。";
  }

  const secondary: string[] = [];
  if (highCount >= 2) {
    secondary.push("昨日血糖波幅可能較高，建議今天選擇血糖友善食物。");
  }
  if (hasSnack) {
    secondary.push("留意宵夜對血糖穩定的影響。");
  }
  if (irregularMealCount > 0) {
    secondary.push(`昨日有${irregularMealCount}餐在非預期時段進食。`);
  }

  return { primary, secondary };
}

interface Props {
  tz?: string;
}

export function DailyFoodSummaryBanner({ tz }: Props) {
  const { t } = useTranslation();
  const yesterday = getYesterday(tz);
  const hour = new Date().getHours();

  const { data, isLoading } = useQuery<{ snaps: SnapSummaryItem[]; irregularMealCount?: number }>({
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
  const { primary, secondary } = buildSummary(snaps, irregularMealCount);

  return (
    <Card
      className="border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40"
      data-testid="card-daily-food-summary"
    >
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground" data-testid="text-daily-summary-primary">
              {primary}
            </p>
            {secondary.map((s, i) => (
              <p
                key={i}
                className="text-xs text-muted-foreground mt-1"
                data-testid={`text-daily-summary-secondary-${i}`}
              >
                {s}
              </p>
            ))}
            <p
              className="text-xs text-muted-foreground/60 mt-2 leading-relaxed"
              data-testid="text-daily-summary-disclaimer"
            >
              {t("snap.advice_disclaimer")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
