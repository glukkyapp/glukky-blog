import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Trans, useTranslation } from "react-i18next";
import { ChevronLeft, Lock, Search } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecurringFoodInsights } from "@/components/RecurringFoodInsights";
import { SwipeableFoodCard } from "@/components/SwipeableFoodCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IMPACT_LEVELS,
  rankMeasuredFoods,
  sampleFoods,
  type GlucoseImpactLevel,
} from "@/lib/glucose-pattern-ranking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ComponentType = "carb" | "sweet_food" | "sweet_drink";
type PatternMode = "general" | "hstix";

interface GeneralGlucosePatternEntry {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  carbCategory?: string | null;
  sweetCategory?: "sweet_food" | "sweet_drink" | null;
  componentType?: ComponentType;
  mealCount: number;
}

interface HstixFoodEntry {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  carbCategory: string | null;
  sweetCategory: "sweet_food" | "sweet_drink" | null;
  componentType: ComponentType;
  totalMeals: number;
  highMeals: number;
  mediumMeals: number;
  lowMeals: number;
  nonHighMeals: number;
  highProbability: number;
  overallHighProbability: number;
  lift: number;
  avgPostMealMmol: number;
  impactLevel: GlucoseImpactLevel;
  partnerInsight?: HstixPartnerInsight;
}

interface HstixPartnerFood {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
}

type HstixPartnerInsight =
  | { kind: "dominant"; partner: HstixPartnerFood }
  | { kind: "comparison"; higherPartner: HstixPartnerFood; lowerPartner: HstixPartnerFood };

interface HstixNeedsMoreReadingsEntry {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  totalMeals: number;
}

type ActualFood = HstixFoodEntry & { foodName: string; readingCount: number };

interface PatternsData {
  totalPaired: number;
  totalSnaps: number;
  topList: GeneralGlucosePatternEntry[];
  hstixList?: HstixFoodEntry[];
  hstixNeedsMoreReadings?: HstixNeedsMoreReadingsEntry[];
}

interface FoodSuggestion {
  foodKey: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
}

interface HstixFoodDetail {
  kind: "hstix";
  foodKey: string;
  foodName: string;
  foodNameEn: string;
  foodNameZhHant: string;
  foodNameYue: string;
  carbCategory: string | null;
  sweetCategory: "sweet_food" | "sweet_drink" | null;
  componentType: ComponentType;
  avgPostMealMmol: number | null;
  readingCount: number;
  impactLevel: GlucoseImpactLevel;
  readings: Array<{ recordedAt: string; postMealGlucoseMmol: number }>;
  lift?: number;
  highMeals?: number;
  nonHighMeals?: number;
}

interface GeneralFoodDetail extends GeneralGlucosePatternEntry {
  kind: "general";
}

interface HistoryFoodDetail extends FoodSuggestion {
  kind: "history";
  mealCount: number;
}

type FoodDetail = HstixFoodDetail | GeneralFoodDetail | HistoryFoodDetail;

interface GlucoseThresholdsData {
  glucoseGroup: string | null;
  readingCount: number;
  isPersonalised: boolean;
  glucosePersonalisedSeen: boolean;
}

const LOCKED_THRESHOLD = 10;
const PERSONALISED_THRESHOLD = 15;
function ImpactBadge({ impact, measured = false }: { impact: GlucoseImpactLevel; measured?: boolean }) {
  const { t } = useTranslation();
  const style = impact === "low"
    ? "border border-[#55B98A]/45 bg-[#DDF4E8] text-[#1F6B4B]"
    : impact === "medium"
      ? "border border-[#D49A22]/45 bg-[#FFF0C2] text-[#6B4A0F]"
      : "border border-[#E85A5A]/45 bg-[#FFE0DE] text-[#9D2F2F]";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`} data-testid={`glucose-impact-badge-${impact}`}>{t(measured ? `glucose.pattern_measured_impact_${impact}` : `glucose.impact_${impact}`)}</span>;
}

const IMPACT_BUTTON_COLORS: Record<string, { selected: string; unselected: string }> = {
  low:    { selected: "border-emerald-500 bg-emerald-500 text-white", unselected: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" },
  medium: { selected: "border-amber-500 bg-amber-500 text-white",     unselected: "border-amber-200 text-amber-700 hover:bg-amber-50" },
  high:   { selected: "border-red-500 bg-red-500 text-white",         unselected: "border-red-200 text-red-700 hover:bg-red-50" },
};

const IMPACT_CARD_STYLES: Record<GlucoseImpactLevel, string> = {
  low: "border-[#55B98A] border-l-4 bg-[#F2FBF6]",
  medium: "border-[#D49A22] border-l-4 bg-[#FFFBEA]",
  high: "border-[#E85A5A] border-l-4 bg-[#FFF4F3]",
};

export default function GlucosePatterns() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = i18n.language || "en";
  const [mode, setMode] = useState<PatternMode>("general");
  const [impact, setImpact] = useState<GlucoseImpactLevel>("low");
  const [cardIndex, setCardIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<string | null>(null);
  const [selectedNeedsMoreFood, setSelectedNeedsMoreFood] = useState<string | null>(null);

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
    queryKey: ["/api/snap/glucose-patterns", "search", mode, trimmedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/snap/glucose-patterns?mode=${mode}&query=${encodeURIComponent(trimmedSearch)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: trimmedSearch.length > 0,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<{ detail: FoodDetail }>({
    queryKey: ["/api/snap/glucose-patterns", "detail", mode, selectedFood],
    queryFn: async () => {
      const res = await fetch(`/api/snap/glucose-patterns?mode=${mode}&food=${encodeURIComponent(selectedFood!)}`, { credentials: "include" });
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

  const hasMeasuredList = (data?.hstixList?.length ?? 0) > 0 ||
    (data?.hstixNeedsMoreReadings?.length ?? 0) > 0;
  const isHstixMode = mode === "hstix";
  const actualFoods = useMemo<ActualFood[]>(() =>
    (data?.hstixList ?? []).map(food => ({
      ...food,
      foodName: locale === "zh-Hant" ? food.foodNameZhHant : locale === "yue" ? food.foodNameYue : food.foodNameEn,
      readingCount: food.totalMeals,
    })),
  [data?.hstixList, locale]);

  const actualByImpact = useMemo(() => Object.fromEntries(
    IMPACT_LEVELS.map(level => {
      const foods = actualFoods.filter(food => food.impactLevel === level);
      return [level, level === "medium"
        ? sampleFoods(foods)
        : rankMeasuredFoods(foods, level)];
    }),
  ) as Record<GlucoseImpactLevel, ActualFood[]>, [actualFoods]);
  const firstMeasuredImpact = useMemo(
    () => IMPACT_LEVELS.find(level => actualByImpact[level].length > 0),
    [actualByImpact],
  );
  const needsMoreReadings = useMemo(() => (data?.hstixNeedsMoreReadings ?? []).map(food => ({
    ...food,
    foodName: locale === "zh-Hant" ? food.foodNameZhHant : locale === "yue" ? food.foodNameYue : food.foodNameEn,
  })), [data?.hstixNeedsMoreReadings, locale]);
  const selectedNeedsMoreReading = needsMoreReadings.find(food => food.foodKey === selectedNeedsMoreFood) ?? null;

  const activeFoods = actualByImpact[impact];
  const matchingCount = activeFoods.length;
  const activeIndex = Math.min(cardIndex, Math.max(0, activeFoods.length - 1));
  const activeFood = activeFoods[activeIndex];
  const totalSnaps = data?.totalSnaps ?? 0;
  const isLocked = totalSnaps < LOCKED_THRESHOLD;
  const remaining = Math.max(0, LOCKED_THRESHOLD - totalSnaps);
  const readingCount = thresholdsData?.readingCount ?? 0;
  const isPersonalised = thresholdsData?.isPersonalised ?? false;
  const showPersonalisedPopup = !isHstixMode && isPersonalised && thresholdsData?.glucosePersonalisedSeen === false;
  const showPersonalisedProgress = !isHstixMode && !isPersonalised && readingCount < PERSONALISED_THRESHOLD;

  useEffect(() => {
    if (hasMeasuredList && firstMeasuredImpact) {
      setImpact(firstMeasuredImpact);
      setCardIndex(0);
    }
  }, [hasMeasuredList, firstMeasuredImpact]);

  useEffect(() => {
    if (needsMoreReadings.length === 0) {
      setSelectedNeedsMoreFood(null);
      return;
    }
    if (!selectedNeedsMoreFood || !needsMoreReadings.some(food => food.foodKey === selectedNeedsMoreFood)) {
      setSelectedNeedsMoreFood(needsMoreReadings[0].foodKey);
    }
  }, [needsMoreReadings, selectedNeedsMoreFood]);

  const setSelection = (nextImpact: GlucoseImpactLevel) => {
    setImpact(nextImpact);
    setCardIndex(0);
  };

  const localizedFoodName = (food: Pick<FoodSuggestion, "foodNameEn" | "foodNameZhHant" | "foodNameYue">) =>
    locale === "zh-Hant" ? food.foodNameZhHant : locale === "yue" ? food.foodNameYue : food.foodNameEn;

  const selectSuggestion = (suggestion: FoodSuggestion) => {
    setSelectedFood(suggestion.foodKey);
    setSearch("");
  };

  const moveCard = (direction: -1 | 1) => {
    setCardIndex(current => Math.max(0, Math.min(activeFoods.length - 1, current + direction)));
  };

  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  const localizedPartnerName = (partner: HstixPartnerFood) =>
    locale === "zh-Hant" ? partner.foodNameZhHant : locale === "yue" ? partner.foodNameYue : partner.foodNameEn;

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
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1" aria-label={t("glucose.pattern_mode_label")}>
              <button
                type="button"
                aria-pressed={mode === "general"}
                onClick={() => setMode("general")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${mode === "general" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="glucose-mode-general"
              >
                {t("glucose.pattern_mode_general")}
              </button>
              <button
                type="button"
                aria-pressed={mode === "hstix"}
                onClick={() => setMode("hstix")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${mode === "hstix" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="glucose-mode-hstix"
              >
                {t("glucose.pattern_mode_hstix")}
              </button>
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
                    <button key={suggestion.foodKey} type="button" className="block w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => selectSuggestion(suggestion)} data-testid={`glucose-search-suggestion-${suggestion.foodKey}`}>
                      {localizedFoodName(suggestion)}
                    </button>
                  ))}
                  {!suggestionsLoading && (suggestionData?.suggestions ?? []).length === 0 && <p className="px-3 py-2.5 text-sm text-muted-foreground">{t("glucose.pattern_search_empty")}</p>}
                </div>
              )}
            </div>

            {showPersonalisedProgress && <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground" data-testid="text-personalised-progress">{t("glucose.personalised_progress_label", { remaining: PERSONALISED_THRESHOLD - readingCount })}</p>}

            {isHstixMode ? (
              <>
                <div className="mb-5 grid grid-cols-3 gap-2" aria-label={t("glucose.pattern_impact_label")}>
                  {IMPACT_LEVELS.map(level => {
                    const count = actualByImpact[level].length;
                    return (
                      <button key={level} type="button" aria-pressed={impact === level} onClick={() => setSelection(level)} className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors ${impact === level ? (IMPACT_BUTTON_COLORS[level]?.selected ?? "") : (IMPACT_BUTTON_COLORS[level]?.unselected ?? "")}`} data-testid={`glucose-impact-${level}`}>
                        <span className="block">{t(`glucose.pattern_measured_impact_${level}`)}</span>
                        <span className="block text-[11px] opacity-80">{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div aria-live="polite" data-testid="glucose-ranking-panel">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{t("glucose.pattern_actual_heading")}</p>
                    <p className="text-xs text-muted-foreground">{t("glucose.pattern_matching_count", { count: matchingCount })}</p>
                  </div>
                  {activeFood ? (
                    <SwipeableFoodCard
                      index={activeIndex}
                      total={activeFoods.length}
                      onPrevious={() => moveCard(-1)}
                      onNext={() => moveCard(1)}
                      nextCard={activeIndex < activeFoods.length - 1 ? (
                        <article className={`glucose-pattern-card min-h-40 rounded-2xl border p-4 text-[#153126] ${IMPACT_CARD_STYLES[impact]}`}>
                          <h2 className="text-lg font-bold">{activeFoods[activeIndex + 1].foodName}</h2>
                        </article>
                      ) : undefined}
                    >
                      <article className={`glucose-pattern-card is-active min-h-40 rounded-2xl border p-4 text-[#153126] ${IMPACT_CARD_STYLES[impact]}`} data-testid={`glucose-ranking-card-${activeIndex}`}>
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            {impact !== "medium" && (
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#53685C]" data-testid="glucose-card-rank">
                                {t(`glucose.pattern_rank_${activeIndex + 1}`)}
                              </p>
                            )}
                            <h2 className="text-lg font-bold">{activeFood.foodName}</h2>
                            <p className="mt-1 text-sm text-[#53685C]">{t("glucose.pattern_hstix_reading")}</p>
                            <p className="mt-1 text-xs font-medium text-[#53685C]" data-testid="glucose-component-type">
                              {t(`glucose.pattern_component_type_${activeFood.componentType}`)}
                            </p>
                          </div>
                          <ImpactBadge impact={impact} measured />
                        </div>
                        <div>
                          <p className="mb-3 text-sm text-[#43594D]">{t(`glucose.pattern_hstix_description_${impact}`)}</p>
                          <p className="text-sm text-[#43594D]">{t("glucose.pattern_hstix_result", { high: activeFood.highMeals, total: activeFood.totalMeals })}</p>
                          {activeFood.partnerInsight?.kind === "dominant" && (
                            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-800" data-testid="glucose-partner-dominant">
                              <Trans
                                i18nKey="glucose.pattern_partner_dominant"
                                values={{
                                  indexFood: activeFood.foodName,
                                  partner: localizedPartnerName(activeFood.partnerInsight.partner),
                                }}
                                components={{ food: <strong className="font-bold text-amber-900" /> }}
                              />
                            </p>
                          )}
                          {activeFood.partnerInsight?.kind === "comparison" && (
                            <div className="mt-4 space-y-1.5" data-testid="glucose-partner-comparison">
                              <p className="text-sm leading-5 text-[#43594D]">
                                <Trans
                                  i18nKey="glucose.pattern_partner_comparison"
                                  values={{
                                    indexFood: activeFood.foodName,
                                    higherPartner: localizedPartnerName(activeFood.partnerInsight.higherPartner),
                                    lowerPartner: localizedPartnerName(activeFood.partnerInsight.lowerPartner),
                                  }}
                                  components={{ food: <strong className="font-semibold text-[#153126]" /> }}
                                />
                              </p>
                              <p className="text-xs leading-5 text-[#43594D]" data-testid="glucose-partner-disclaimer">
                                {t("glucose.pattern_partner_disclaimer")}
                              </p>
                            </div>
                          )}
                        </div>
                      </article>
                    </SwipeableFoodCard>
                  ) : <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground" data-testid="glucose-ranking-empty">{t("glucose.pattern_actual_empty")}</div>}
                </div>

                {needsMoreReadings.length > 0 && (
                  <section className="mt-6" data-testid="glucose-needs-more-readings">
                    <h2 className="text-sm font-semibold text-foreground">{t("glucose.pattern_needs_more_readings_heading")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("glucose.pattern_needs_more_readings_description")}</p>
                    <div className="mt-3 space-y-3">
                      <Select value={selectedNeedsMoreFood ?? undefined} onValueChange={setSelectedNeedsMoreFood}>
                        <SelectTrigger id="glucose-needs-more-readings-select" data-testid="glucose-needs-more-readings-select">
                          <SelectValue placeholder={t("glucose.pattern_needs_more_readings_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {needsMoreReadings.map(food => (
                            <SelectItem key={food.foodKey} value={food.foodKey}>{food.foodName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedNeedsMoreReading && (
                        <div className="rounded-xl border border-border bg-card px-3 py-2.5" data-testid="glucose-needs-more-readings-selected">
                          <p className="text-sm font-medium text-foreground">{selectedNeedsMoreReading.foodName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("glucose.pattern_needs_more_readings_count", {
                              total: selectedNeedsMoreReading.totalMeals,
                              remaining: Math.max(0, 25 - selectedNeedsMoreReading.totalMeals),
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <RecurringFoodInsights />
            )}
          </section>
        )}
      </div>

      <Dialog open={!!selectedFood} onOpenChange={open => !open && setSelectedFood(null)}>
        <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto rounded-2xl" data-testid="glucose-food-detail-dialog">
          {detailLoading && <div className="space-y-3"><div className="h-6 w-2/3 animate-pulse rounded bg-muted" /><div className="h-20 animate-pulse rounded-xl bg-muted" /></div>}
          {!detailLoading && detailData?.detail && (
            <>
              <DialogHeader>
                <DialogTitle>{localizedFoodName(detailData.detail)}</DialogTitle>
                <DialogDescription>{t(
                  detailData.detail.kind === "hstix"
                    ? "glucose.pattern_detail_description"
                    : detailData.detail.kind === "history"
                      ? "glucose.pattern_history_detail_description"
                      : "glucose.pattern_general_description",
                )}</DialogDescription>
              </DialogHeader>
              {detailData.detail.kind === "history" ? (
                <div className="space-y-3">
                  <p className="rounded-xl bg-muted/60 p-3 text-sm font-semibold text-foreground">
                    {t("glucose.pattern_history_recorded_label", { count: detailData.detail.mealCount })}
                  </p>
                  <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                    {t("glucose.pattern_history_no_glucose_data")}
                  </p>
                </div>
              ) : detailData.detail.kind === "general" ? (
                <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("glucose.pattern_component_type_label")}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{t(`glucose.pattern_component_type_${detailData.detail.componentType}`)}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t("glucose.pattern_frequency_count", { count: detailData.detail.mealCount })}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("glucose.pattern_aggregate_impact")}</p>
                      <div className="mt-1"><ImpactBadge impact={detailData.detail.impactLevel} measured /></div>
                    </div>
                    <div className="text-right"><p className="text-xs text-muted-foreground">{t("glucose.pattern_average")}</p><p className="text-lg font-bold text-foreground">{detailData.detail.avgPostMealMmol?.toFixed(1)} mmol/L</p></div>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}