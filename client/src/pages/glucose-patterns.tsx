import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

interface GlucosePatternEntry {
  foodName: string;
  avgSpikeMmol: number;
  readingCount: number;
  hasMultipleCombos: boolean;
}

interface GlucoseDrilldownEntry {
  portion: string | null;
  sauces: string | null;
  avgSpikeMmol: number;
  readingCount: number;
}

interface PatternsData {
  totalPaired: number;
  topList: GlucosePatternEntry[];
}

interface DrilldownData {
  drilldown: GlucoseDrilldownEntry[];
}

const LOCKED_THRESHOLD = 10;

function SpikeChip({ mmol }: { mmol: number }) {
  const color =
    mmol >= 3.0 ? "bg-red-100 text-red-700" :
    mmol >= 1.5 ? "bg-amber-100 text-amber-700" :
                  "bg-emerald-100 text-emerald-700";
  const sign = mmol >= 0 ? "+" : "";
  return (
    <span className={`text-sm font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${color}`}>
      {sign}{mmol.toFixed(1)}
    </span>
  );
}

export default function GlucosePatterns() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = i18n.language || "en";
  const isZh = locale.startsWith("zh") || locale === "yue";

  const [selectedFood, setSelectedFood] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PatternsData>({
    queryKey: ["/api/snap/glucose-patterns"],
    queryFn: async () => {
      const res = await fetch("/api/snap/glucose-patterns", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: drilldownData, isLoading: drilldownLoading } = useQuery<DrilldownData>({
    queryKey: ["/api/snap/glucose-patterns", selectedFood],
    queryFn: async () => {
      const res = await fetch(
        `/api/snap/glucose-patterns?food=${encodeURIComponent(selectedFood!)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedFood,
  });

  const handleBack = () => {
    if (selectedFood) {
      setSelectedFood(null);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  const totalPaired = data?.totalPaired ?? 0;
  const isLocked = totalPaired < LOCKED_THRESHOLD;
  const remaining = Math.max(0, LOCKED_THRESHOLD - totalPaired);

  return (
    <div className="min-h-screen bg-background pb-28 pt-4">
      <div className="max-w-sm mx-auto px-4">
        <button
          data-testid="glucose-patterns-back"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1 hover:text-foreground transition-colors"
          aria-label={isZh ? "返回" : "Back"}
        >
          <ChevronLeft size={16} />
          {selectedFood ? t("glucose.patterns_drilldown_back") : (isZh ? "返回" : "Back")}
        </button>

        <h1 className="text-xl font-bold text-foreground mb-5" data-testid="glucose-patterns-heading">
          {selectedFood ?? t("glucose.patterns_heading")}
        </h1>

        {isLoading && (
          <div className="space-y-3" data-testid="glucose-patterns-loading">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && isLocked && (
          <div
            className="flex flex-col items-center gap-4 py-16 text-center"
            data-testid="glucose-patterns-locked"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {t("glucose.patterns_heading")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("glucose.patterns_locked_desc", { remaining })}
            </p>
            <div className="w-full max-w-[200px] bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, (totalPaired / LOCKED_THRESHOLD) * 100)}%` }}
                data-testid="glucose-patterns-progress"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {totalPaired} / {LOCKED_THRESHOLD}
            </p>
          </div>
        )}

        {!isLoading && !isLocked && !selectedFood && (
          <div data-testid="glucose-patterns-list">
            <p className="text-sm text-muted-foreground mb-3">
              {t("glucose.patterns_unlocked_heading")}
            </p>
            <div className="space-y-2">
              {(data?.topList ?? []).map((item, i) => (
                <div
                  key={i}
                  data-testid={`glucose-pattern-item-${i}`}
                  onClick={() => item.hasMultipleCombos && setSelectedFood(item.foodName)}
                  className={`flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-3 ${
                    item.hasMultipleCombos ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.foodName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("glucose.patterns_count", { n: item.readingCount })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <SpikeChip mmol={item.avgSpikeMmol} />
                    {item.hasMultipleCombos && (
                      <ChevronRight size={16} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !isLocked && selectedFood && (
          <div data-testid="glucose-drilldown-list">
            {drilldownLoading && (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            )}
            {!drilldownLoading && (drilldownData?.drilldown ?? []).map((item, i) => (
              <div
                key={i}
                data-testid={`glucose-drilldown-item-${i}`}
                className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-3 mb-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {[item.portion, item.sauces].filter(Boolean).join(", ") ||
                      (isZh ? "原味" : "Plain")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("glucose.patterns_count", { n: item.readingCount })}
                  </p>
                </div>
                <SpikeChip mmol={item.avgSpikeMmol} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
