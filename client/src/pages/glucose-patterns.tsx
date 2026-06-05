import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

interface GlucosePatternEntry {
  foodName: string;
  avgPostMealMmol: number;
  readingCount: number;
  hasMultipleCombos: boolean;
}

interface GlucoseDrilldownEntry {
  portion: string | null;
  sauces: string | null;
  avgPostMealMmol: number;
  readingCount: number;
}

interface AiFoodEntry {
  foodName: string;
  impactLevel: "low" | "medium" | "high";
  snapCount: number;
}

interface PatternsData {
  totalPaired: number;
  totalSnaps: number;
  topList: GlucosePatternEntry[];
  aiOnlyList?: AiFoodEntry[];
}

interface DrilldownData {
  drilldown: GlucoseDrilldownEntry[];
}

interface GlucoseThresholdsData {
  glucoseGroup: string | null;
  lowMedBoundary: number | null;
  medHighBoundary: number | null;
  readingCount: number;
  isPersonalised: boolean;
  glucosePersonalisedSeen: boolean;
}

const LOCKED_THRESHOLD = 10;
const PERSONALISED_THRESHOLD = 15;

function SpikeChip({ mmol, glucoseGroup }: { mmol: number; glucoseGroup: string | null }) {
  let color: string;
  if (glucoseGroup === "t2dm") {
    color = mmol >= 10.0 ? "bg-red-100 text-red-700" : mmol >= 7.5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  } else {
    color = mmol >= 7.8 ? "bg-red-100 text-red-700" : mmol >= 5.9 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  }
  return (
    <span className={`text-base font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${color}`} data-testid="chip-spike-mmol">
      {mmol.toFixed(1)}
    </span>
  );
}

export default function GlucosePatterns() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = i18n.language || "en";
  const isZh = locale.startsWith("zh") || locale === "yue";

  const [selectedFood, setSelectedFood] = useState<string | null>(null);
  const [expandedAiFoods, setExpandedAiFoods] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<PatternsData>({
    queryKey: ["/api/snap/glucose-patterns"],
    queryFn: async () => {
      const res = await fetch("/api/snap/glucose-patterns", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchOnMount: "always",
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

  const { data: thresholdsData } = useQuery<GlucoseThresholdsData>({
    queryKey: ["/api/user/glucose-thresholds"],
    queryFn: async () => {
      const res = await fetch("/api/user/glucose-thresholds", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const markSeenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/glucose-personalised-seen", {}),
    onSuccess: () => {
      queryClient.setQueryData<GlucoseThresholdsData>(["/api/user/glucose-thresholds"], (old) =>
        old ? { ...old, glucosePersonalisedSeen: true } : old
      );
    },
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
  const totalSnaps = data?.totalSnaps ?? 0;
  const isLocked = totalSnaps < LOCKED_THRESHOLD;
  const remaining = Math.max(0, LOCKED_THRESHOLD - totalSnaps);
  const glucoseGroup = thresholdsData?.glucoseGroup ?? null;
  const readingCount = thresholdsData?.readingCount ?? 0;
  const isPersonalised = thresholdsData?.isPersonalised ?? false;
  const showPersonalisedPopup = isPersonalised && thresholdsData?.glucosePersonalisedSeen === false;
  const showPersonalisedProgress = !isPersonalised && readingCount < PERSONALISED_THRESHOLD;

  return (
    <div className="min-h-screen bg-background pb-28 pt-4">
      <div className="max-w-sm mx-auto px-4">

        {showPersonalisedPopup && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4" data-testid="div-personalised-popup">
            <p className="text-sm font-semibold text-emerald-800 mb-1">
              {t("glucose.personalised_popup_title")}
            </p>
            <p className="text-xs text-emerald-700 mb-3">
              {t("glucose.personalised_popup_body", { count: readingCount })}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              data-testid="button-personalised-dismiss"
              onClick={() => markSeenMutation.mutate()}
            >
              {t("glucose.personalised_popup_dismiss")}
            </Button>
          </div>
        )}

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
                style={{ width: `${Math.min(100, (totalSnaps / LOCKED_THRESHOLD) * 100)}%` }}
                data-testid="glucose-patterns-progress"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {totalSnaps} / {LOCKED_THRESHOLD}
            </p>
          </div>
        )}

        {!isLoading && !isLocked && !selectedFood && (
          <div data-testid="glucose-patterns-list">
            {(data?.aiOnlyList ?? []).length > 0 && (() => {
              const highList = (data!.aiOnlyList ?? []).filter(f => f.impactLevel === "high");
              const medList = (data!.aiOnlyList ?? []).filter(f => f.impactLevel === "medium");
              const lowList = (data!.aiOnlyList ?? []).filter(f => f.impactLevel === "low");
              const cols = [
                { list: highList, bg: "bg-red-50", labelCls: "text-red-600", label: t("glucose.impact_high") },
                { list: medList, bg: "bg-amber-50", labelCls: "text-amber-600", label: t("glucose.impact_medium") },
                { list: lowList, bg: "bg-emerald-50", labelCls: "text-emerald-600", label: t("glucose.impact_low") },
              ];
              return (
                <div className="mb-4" data-testid="div-ai-food-ranking">
                  <p className="text-sm text-muted-foreground mb-2 font-medium">近30日 AI 評估食物</p>
                  <div className="grid grid-cols-3 gap-2">
                    {cols.map(({ list, bg, labelCls, label }, colIdx) => (
                      <div key={colIdx} className={`rounded-lg p-2 ${bg}`}>
                        <p className={`text-xs font-semibold mb-1.5 ${labelCls}`}>{label}</p>
                        <div className="space-y-1">
                          {list.map((item, i) => {
                            const key = `col${colIdx}-${i}`;
                            const isExpanded = expandedAiFoods.has(key);
                            return (
                              <p
                                key={i}
                                className={`text-xs leading-snug cursor-pointer ${isExpanded ? "" : "line-clamp-2"}`}
                                onClick={() => setExpandedAiFoods(prev => {
                                  const next = new Set(prev);
                                  if (isExpanded) next.delete(key); else next.add(key);
                                  return next;
                                })}
                                data-testid={`ai-food-col${colIdx}-item-${i}`}
                              >
                                {item.foodName}
                              </p>
                            );
                          })}
                          {list.length === 0 && <p className="text-xs opacity-30">—</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <p className="text-base text-muted-foreground mb-3">
              {t("glucose.patterns_unlocked_heading")}
            </p>

            {showPersonalisedProgress && (
              <p className="text-sm text-muted-foreground mb-3 bg-muted/60 rounded-xl px-3 py-2.5" data-testid="text-personalised-progress">
                {t("glucose.personalised_progress_label", { remaining: PERSONALISED_THRESHOLD - readingCount })}
              </p>
            )}

            {isPersonalised && !showPersonalisedPopup && (
              <p className="text-sm text-muted-foreground mb-3 italic" data-testid="text-personalised-disclaimer">
                {t("glucose.personalised_disclaimer", { count: readingCount })}
              </p>
            )}

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
                    <p className="text-base font-medium text-foreground truncate">{item.foodName}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("glucose.patterns_count", { n: item.readingCount })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <SpikeChip mmol={item.avgPostMealMmol} glucoseGroup={glucoseGroup} />
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
                <SpikeChip mmol={item.avgPostMealMmol} glucoseGroup={glucoseGroup} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
