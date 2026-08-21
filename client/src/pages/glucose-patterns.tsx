import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Lock, Search } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IMPACT_LEVELS,
  rankActualFoods,
  sampleFoods,
  type GlucoseImpactLevel,
} from "@/lib/glucose-pattern-ranking";

interface GlucosePatternEntry {
  foodName: string;
  avgPostMealMmol: number;
  readingCount: number;
  impactLevel: GlucoseImpactLevel;
}

interface AiFoodEntry {
  foodName: string;
  impactLevel: GlucoseImpactLevel;
  snapCount: number;
}

interface PatternsData {
  totalPaired: number;
  totalSnaps: number;
  topList: GlucosePatternEntry[];
  aiOnlyList?: AiFoodEntry[];
}

interface FoodSuggestion {
  foodName: string;
}

interface FoodDetail {
  foodName: string;
  avgPostMealMmol: number | null;
  readingCount: number;
  impactLevel: GlucoseImpactLevel | null;
  readings: Array<{ recordedAt: string; postMealGlucoseMmol: number }>;
}

interface GlucoseThresholdsData {
  glucoseGroup: string | null;
  readingCount: number;
  isPersonalised: boolean;
  glucosePersonalisedSeen: boolean;
}

const LOCKED_THRESHOLD = 10;
const PERSONALISED_THRESHOLD = 15;
const SWIPE_MIN_PX = 40;

function ImpactBadge({ impact }: { impact: GlucoseImpactLevel }) {
  const { t } = useTranslation();
  const style = impact === "low"
    ? "bg-emerald-100 text-emerald-800"
    : impact === "medium"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{t(`glucose.impact_${impact}`)}</span>;
}

const IMPACT_BUTTON_COLORS: Record<string, { selected: string; unselected: string }> = {
  low:    { selected: "border-emerald-500 bg-emerald-500 text-white", unselected: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" },
  medium: { selected: "border-amber-500 bg-amber-500 text-white",     unselected: "border-amber-200 text-amber-700 hover:bg-amber-50" },
  high:   { selected: "border-red-500 bg-red-500 text-white",         unselected: "border-red-200 text-red-700 hover:bg-red-50" },
};

export default function GlucosePatterns() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = i18n.language || "en";
  const [mode, setMode] = useState<"ai" | "actual">("ai");
  const [impact, setImpact] = useState<GlucoseImpactLevel>("low");
  const [cardIndex, setCardIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const { data, isLoading } = useQuery<PatternsData>({
    queryKey: ["/api/snap/glucose-patterns"],
    queryFn: async () => {
      const res = await fetch("/api/snap/glucose-patterns", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchOnMount: "always",
  });

  const trimmedSearch = search.trim();
  const { data: suggestionData, isFetching: suggestionsLoading } = useQuery<{ suggestions: FoodSuggestion[] }>({
    queryKey: ["/api/snap/glucose-patterns", "search", trimmedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/snap/glucose-patterns?query=${encodeURIComponent(trimmedSearch)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: trimmedSearch.length > 0,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<{ detail: FoodDetail }>({
    queryKey: ["/api/snap/glucose-patterns", "detail", selectedFood],
    queryFn: async () => {
      const res = await fetch(`/api/snap/glucose-patterns?food=${encodeURIComponent(selectedFood!)}`, { credentials: "include" });
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
      queryClient.setQueryData<GlucoseThresholdsData>(["/api/user/glucose-thresholds"], old =>
        old ? { ...old, glucosePersonalisedSeen: true } : old,
      );
    },
  });

  const aiSamples = useMemo(() => {
    const foods = data?.aiOnlyList ?? [];
    return Object.fromEntries(
      IMPACT_LEVELS.map(level => [level, sampleFoods(foods.filter(food => food.impactLevel === level))]),
    ) as Record<GlucoseImpactLevel, AiFoodEntry[]>;
  }, [data?.aiOnlyList]);

  const actualByImpact = useMemo(() => Object.fromEntries(
    IMPACT_LEVELS.map(level => [
      level,
      rankActualFoods((data?.topList ?? []).filter(food => food.impactLevel === level), level),
    ]),
  ) as Record<GlucoseImpactLevel, GlucosePatternEntry[]>, [data?.topList]);

  const activeFoods = mode === "ai" ? aiSamples[impact] : actualByImpact[impact];
  const matchingCount = mode === "ai"
    ? (data?.aiOnlyList ?? []).filter(food => food.impactLevel === impact).length
    : (data?.topList ?? []).filter(food => food.impactLevel === impact).length;
  const activeIndex = Math.min(cardIndex, Math.max(0, activeFoods.length - 1));
  const activeFood = activeFoods[activeIndex];
  const totalSnaps = data?.totalSnaps ?? 0;
  const isLocked = totalSnaps < LOCKED_THRESHOLD;
  const remaining = Math.max(0, LOCKED_THRESHOLD - totalSnaps);
  const readingCount = thresholdsData?.readingCount ?? 0;
  const isPersonalised = thresholdsData?.isPersonalised ?? false;
  const showPersonalisedPopup = isPersonalised && thresholdsData?.glucosePersonalisedSeen === false;
  const showPersonalisedProgress = !isPersonalised && readingCount < PERSONALISED_THRESHOLD;

  const setSelection = (nextMode: "ai" | "actual", nextImpact: GlucoseImpactLevel) => {
    setMode(nextMode);
    setImpact(nextImpact);
    setCardIndex(0);
  };

  const selectSuggestion = (foodName: string) => {
    setSelectedFood(foodName);
    setSearch("");
  };

  const moveCard = (direction: -1 | 1) => {
    setCardIndex(current => Math.max(0, Math.min(activeFoods.length - 1, current + direction)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current == null) return;
    const distance = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (distance <= -SWIPE_MIN_PX) moveCard(1);
    if (distance >= SWIPE_MIN_PX) moveCard(-1);
  };

  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));

  return (
    <main className="min-h-screen bg-background pb-28 pt-4" data-testid="page-glucose-patterns">
      <div className="mx-auto max-w-sm px-4">
        {showPersonalisedPopup && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-testid="div-personalised-popup">
            <p className="mb-1 text-base font-semibold text-emerald-800">{t("glucose.personalised_popup_title")}</p>
            <p className="mb-3 text-sm text-emerald-700">{t("glucose.personalised_popup_body", { count: readingCount })}</p>
            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100" data-testid="button-personalised-dismiss" onClick={() => markSeenMutation.mutate()}>
              {t("glucose.personalised_popup_dismiss")}
            </Button>
          </div>
        )}

        <button data-testid="glucose-patterns-back" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")} className="mb-4 -ml-1 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground" aria-label={t("glucose.pattern_back")}>
          <ChevronLeft size={16} />
          {t("glucose.pattern_back")}
        </button>

        <header className="mb-5">
          <h1 className="text-xl font-bold text-foreground" data-testid="glucose-patterns-heading">{t("glucose.patterns_heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("glucose.patterns_intro")}</p>
        </header>

        {isLoading && <div className="space-y-3" data-testid="glucose-patterns-loading">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>}

        {!isLoading && isLocked && (
          <section className="flex flex-col items-center gap-4 py-16 text-center" data-testid="glucose-patterns-locked">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Lock className="h-8 w-8 text-muted-foreground" /></div>
            <p className="text-base font-semibold text-foreground">{t("glucose.patterns_heading")}</p>
            <p className="text-base text-muted-foreground">{t("glucose.patterns_locked_desc", { remaining })}</p>
            <div className="h-2 w-full max-w-[200px] rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (totalSnaps / LOCKED_THRESHOLD) * 100)}%` }} data-testid="glucose-patterns-progress" /></div>
            <p className="text-sm text-muted-foreground">{totalSnaps} / {LOCKED_THRESHOLD}</p>
          </section>
        )}

        {!isLoading && !isLocked && (
          <section data-testid="glucose-patterns-list">
            <div className="mb-4 grid grid-cols-2 rounded-2xl bg-muted p-1" aria-label={t("glucose.pattern_mode_label")}>
              {(["ai", "actual"] as const).map(item => (
                <button key={item} type="button" aria-pressed={mode === item} onClick={() => setSelection(item, impact)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${mode === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} data-testid={`glucose-mode-${item}`}>
                  {t(`glucose.pattern_mode_${item}`)}
                </button>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2" aria-label={t("glucose.pattern_impact_label")}>
              {IMPACT_LEVELS.map(level => {
                const count = mode === "ai"
                  ? (data?.aiOnlyList ?? []).filter(food => food.impactLevel === level).length
                  : (data?.topList ?? []).filter(food => food.impactLevel === level).length;
                return (
                  <button key={level} type="button" aria-pressed={impact === level} onClick={() => setSelection(mode, level)} className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors ${impact === level ? (IMPACT_BUTTON_COLORS[level]?.selected ?? "") : (IMPACT_BUTTON_COLORS[level]?.unselected ?? "")}`} data-testid={`glucose-impact-${level}`}>
                    <span className="block">{t(`glucose.impact_${level}`)}</span>
                    <span className="block text-[11px] opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="glucose-food-search">{t("glucose.pattern_search_label")}</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="glucose-food-search" data-testid="input-glucose-food-search" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder={t("glucose.pattern_search_placeholder")} autoComplete="off" />
              </div>
              {trimmedSearch && (
                <div className="mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-testid="glucose-search-suggestions">
                  {suggestionsLoading && <p className="px-3 py-2.5 text-sm text-muted-foreground">{t("glucose.pattern_loading")}</p>}
                  {!suggestionsLoading && (suggestionData?.suggestions ?? []).map(suggestion => (
                    <button key={suggestion.foodName} type="button" className="block w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => selectSuggestion(suggestion.foodName)} data-testid={`glucose-search-suggestion-${suggestion.foodName}`}>
                      {suggestion.foodName}
                    </button>
                  ))}
                  {!suggestionsLoading && (suggestionData?.suggestions ?? []).length === 0 && <p className="px-3 py-2.5 text-sm text-muted-foreground">{t("glucose.pattern_search_empty")}</p>}
                </div>
              )}
            </div>

            {showPersonalisedProgress && <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground" data-testid="text-personalised-progress">{t("glucose.personalised_progress_label", { remaining: PERSONALISED_THRESHOLD - readingCount })}</p>}
            {isPersonalised && !showPersonalisedPopup && <p className="mb-3 text-sm italic text-muted-foreground" data-testid="text-personalised-disclaimer">{t("glucose.personalised_disclaimer", { count: readingCount })}</p>}

            <div aria-live="polite" data-testid="glucose-ranking-panel">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{mode === "ai" ? t("glucose.pattern_ai_heading") : t("glucose.pattern_actual_heading")}</p>
                <p className="text-xs text-muted-foreground">{t("glucose.pattern_matching_count", { count: matchingCount })}</p>
              </div>
              {activeFood ? (
                <div className="overflow-hidden" onPointerDown={event => { swipeStartX.current = event.clientX; }} onPointerUp={handlePointerUp} onPointerCancel={() => { swipeStartX.current = null; }}>
                  <article className="min-h-40 rounded-2xl border border-border bg-card p-4 shadow-sm touch-pan-y" data-testid={`glucose-ranking-card-${activeIndex}`}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div>
                        {mode === "actual" && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t(`glucose.pattern_rank_${activeIndex + 1}`)}</p>}
                        <h2 className="text-lg font-bold text-foreground">{activeFood.foodName}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{mode === "ai" ? t("glucose.pattern_ai_estimate") : t("glucose.pattern_actual_reading")}</p>
                      </div>
                      <ImpactBadge impact={impact} />
                    </div>
                    {mode === "actual" ? (
                      <div className="flex items-end justify-between">
                        <div><p className="text-xs text-muted-foreground">{t("glucose.pattern_average")}</p><p className="text-2xl font-bold text-foreground">{(activeFood as GlucosePatternEntry).avgPostMealMmol.toFixed(1)} <span className="text-sm font-medium">mmol/L</span></p></div>
                        <p className="text-sm text-muted-foreground">{t("glucose.patterns_count", { n: (activeFood as GlucosePatternEntry).readingCount })}</p>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">{t("glucose.pattern_ai_snap_count", { count: (activeFood as AiFoodEntry).snapCount })}</p>}
                  </article>
                  {activeFoods.length > 1 && (
                    <div className="mt-3 flex items-center justify-between">
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveCard(-1)} disabled={activeIndex === 0} aria-label={t("glucose.pattern_previous")}><ChevronLeft size={18} /></Button>
                      <p className="text-xs text-muted-foreground">{activeIndex + 1} / {activeFoods.length}</p>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveCard(1)} disabled={activeIndex === activeFoods.length - 1} aria-label={t("glucose.pattern_next")}><ChevronRight size={18} /></Button>
                    </div>
                  )}
                </div>
              ) : <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground" data-testid="glucose-ranking-empty">{mode === "ai" ? t("glucose.pattern_ai_empty") : t("glucose.pattern_actual_empty")}</div>}
            </div>
          </section>
        )}
      </div>

      <Dialog open={!!selectedFood} onOpenChange={open => !open && setSelectedFood(null)}>
        <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto rounded-2xl" data-testid="glucose-food-detail-dialog">
          {detailLoading && <div className="space-y-3"><div className="h-6 w-2/3 animate-pulse rounded bg-muted" /><div className="h-20 animate-pulse rounded-xl bg-muted" /></div>}
          {!detailLoading && detailData?.detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detailData.detail.foodName}</DialogTitle>
                <DialogDescription>{t("glucose.pattern_detail_description")}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t("glucose.pattern_aggregate_impact")}</p>
                  <div className="mt-1">
                    {detailData.detail.impactLevel
                      ? <ImpactBadge impact={detailData.detail.impactLevel} />
                      : <span className="text-sm text-muted-foreground">{t("glucose.pattern_impact_unassessed")}</span>}
                  </div>
                </div>
                {detailData.detail.avgPostMealMmol != null && <div className="text-right"><p className="text-xs text-muted-foreground">{t("glucose.pattern_average")}</p><p className="text-lg font-bold text-foreground">{detailData.detail.avgPostMealMmol.toFixed(1)} mmol/L</p></div>}
              </div>
              {detailData.detail.readings.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">{t("glucose.pattern_reading_history")}</p>
                  <ul className="space-y-2">
                    {detailData.detail.readings.map(reading => <li key={`${reading.recordedAt}-${reading.postMealGlucoseMmol}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"><span className="text-sm text-muted-foreground">{formatDate(reading.recordedAt)}</span><span className="text-sm font-bold text-foreground">{reading.postMealGlucoseMmol.toFixed(1)} mmol/L</span></li>)}
                  </ul>
                </div>
              ) : <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{t("glucose.pattern_no_readings")}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}