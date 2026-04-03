import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, Lock, Gift, BarChart2, PiggyBank, Clock, CheckCircle2, SkipForward, EyeOff, UtensilsCrossed, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { InfoCardPopup, useInfoCard } from "@/components/info-card-popup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PiggyBankSVG } from "@/components/piggy-bank-svg";
import sproutBg from "@assets/pexels-kh-ali-li-17289465_1775200059674.jpg";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";

function translateDietTip(tip: string, t: (key: string, opts?: any) => string): string {
  const i18nKey = DIET_TIP_I18N_KEYS[tip];
  return i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
}

interface CycleHistoryEntry {
  id: number;
  cycleNumber: number;
  strugglesPicked: string[];
  mastered: string[];
  movedOn: string[];
}

interface RoadmapData {
  activeStruggle: string | null;
  inProgressStruggles: string[];
  masteredStruggles: string[];
  upcomingStruggles: string[];
  skippedStruggles: string[];
  difficultStruggles: string[];
  inactiveStruggles: string[];
  currentTip: string | null;
  isDinnerFocus: boolean;
  dinnerMastered: boolean;
  dinnerQueueStatus: string | null;
  walkSuccessAvg: number;
  dinnerSuccessAvg: number;
  dietTipCompletionCount: number;
  tipLadders: Record<string, string[]>;
  currentStruggleCycle: number;
  cycleHistory: CycleHistoryEntry[];
}

interface PiggyBankData {
  coins: number;
  capacity: number;
  reward: string | null;
  needsRewardSetup: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-6 w-36 mt-4" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

const DEV_STATES = [0, 10, 25, 40, 55] as const;

const STRUGGLE_KEY_MAP: Record<string, string> = {
  sugary_food_drink: "struggle.sugary_food_drink",
  oily_fried_food: "struggle.oily_fried_food",
  eat_out: "struggle.eat_out",
  portions: "struggle.portions",
  snacks: "struggle.snacks",
  late_dinner: "struggle.late_dinner",
};

function JourneySection({ cycleHistory, t }: {
  cycleHistory: CycleHistoryEntry[];
  t: (key: string, opts?: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set());

  function ts(key: string) {
    return STRUGGLE_KEY_MAP[key] ? t(STRUGGLE_KEY_MAP[key]) : key;
  }
  function toggleCycle(n: number) {
    setExpandedCycles(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-full text-left"
        data-testid="button-toggle-journey"
      >
        {t("roadmap.journey_title")}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="space-y-2">
          {cycleHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1" data-testid="text-journey-empty">
              {t("roadmap.journey_empty")}
            </p>
          ) : (
            cycleHistory.map(entry => (
              <div key={entry.id} data-testid={`card-journey-cycle-${entry.cycleNumber}`}>
                <button
                  className="flex items-center justify-between w-full text-left py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCycle(entry.cycleNumber)}
                  data-testid={`button-journey-cycle-${entry.cycleNumber}`}
                >
                  <span className="text-sm font-medium">
                    {t("roadmap.journey_cycle", { cycle: entry.cycleNumber })}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{entry.mastered.length} {t("roadmap.journey_mastered")}</span>
                    <span>·</span>
                    <span>{entry.movedOn.length} {t("roadmap.journey_moved_on")}</span>
                    {expandedCycles.has(entry.cycleNumber)
                      ? <ChevronUp className="h-3 w-3 ml-1" />
                      : <ChevronDown className="h-3 w-3 ml-1" />}
                  </span>
                </button>
                {expandedCycles.has(entry.cycleNumber) && (
                  <div className="px-3 pt-2 pb-1 space-y-2">
                    {entry.mastered.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t("roadmap.journey_mastered")}</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.mastered.map(s => (
                            <span key={s} className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded px-2 py-0.5 border border-green-200 dark:border-green-800">
                              {ts(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.movedOn.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t("roadmap.journey_moved_on")}</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.movedOn.map(s => (
                            <span key={s} className="text-xs bg-muted/50 text-muted-foreground rounded px-2 py-0.5 border border-border">
                              {ts(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AnimatedCoinCount({ target, capacity, t }: { target: number; capacity: number; t: (key: string, opts?: any) => string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    const controls = animate(count, target, {
      duration: 0.6,
      ease: "easeOut",
    });
    const unsubscribe = rounded.on("change", (v) => setDisplayVal(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [target]);

  return <span>{t("roadmap.coins_count", { coins: displayVal, capacity })}</span>;
}

function PiggyBankCard({ data, isDev }: {
  data: PiggyBankData;
  isDev?: boolean;
}) {
  const { t } = useTranslation();
  const prevCoins = useRef(data.coins);
  const [animating, setAnimating] = useState(false);
  const [coinsGained, setCoinsGained] = useState(0);

  const setDevCoinsMutation = useMutation({
    mutationFn: (coins: number | null) =>
      apiRequest("POST", "/api/dev/set-coins", { coins }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
    },
  });

  useEffect(() => {
    if (data.coins > prevCoins.current) {
      setCoinsGained(data.coins - prevCoins.current);
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 2200);
      prevCoins.current = data.coins;
      return () => clearTimeout(timer);
    }
    prevCoins.current = data.coins;
  }, [data.coins]);

  const isFull = data.coins >= data.capacity;
  const fillPct = Math.min((data.coins / data.capacity) * 100, 100);

  return (
    <>
      <style>{`
        @keyframes coin-drop {
          0% { transform: translateY(-56px); opacity: 1; }
          65% { transform: translateY(4px); opacity: 1; }
          80% { transform: translateY(0); opacity: 0.6; }
          100% { transform: translateY(0); opacity: 0; }
        }
        @keyframes saved-label {
          0% { opacity: 0; transform: translateY(6px); }
          30%, 75% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>

      <div data-testid="card-piggy-bank" className="px-6 pt-4 pb-5">
          <div className="flex flex-col items-center gap-1 relative">
            {animating && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
                style={{ width: 80 }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, #fde68a, #f59e0b)",
                    border: "2px solid #d97706",
                    boxShadow: "0 2px 6px rgba(217,119,6,0.4)",
                    animation: "coin-drop 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
                  }}
                />
                <p
                  style={{
                    animation: "saved-label 1.5s ease forwards",
                    animationDelay: "0.7s",
                    opacity: 0,
                    color: "#d97706",
                    fontWeight: 700,
                    fontSize: 12,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("roadmap.new_coin_saved", { count: coinsGained })}
                </p>
              </div>
            )}

            <PiggyBankSVG coins={data.coins} />

            {data.reward && (
              <p className="text-base font-bold text-foreground text-center mt-1" data-testid="text-piggy-reward">
                {data.reward}
              </p>
            )}

            {isDev && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground mr-1">preview:</span>
                {DEV_STATES.map((c) => (
                  <button
                    key={c}
                    disabled={setDevCoinsMutation.isPending}
                    onClick={() => setDevCoinsMutation.mutate(c)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-colors disabled:opacity-40 ${
                      data.coins === c
                        ? "bg-amber-100 border-amber-400 text-amber-700"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-amber-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  disabled={setDevCoinsMutation.isPending}
                  onClick={() => setDevCoinsMutation.mutate(null)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-muted-foreground/30 text-muted-foreground hover:text-foreground ml-1 disabled:opacity-40"
                  title="Clear dev override"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="w-full mt-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground font-medium" data-testid="text-piggy-coins">
                  <AnimatedCoinCount target={data.coins} capacity={data.capacity} t={t} />
                </span>
                {isFull && (
                  <span className="text-xs font-semibold text-amber-600">{t("roadmap.full")}</span>
                )}
              </div>
              <Progress value={fillPct} className={isFull ? "[&>div]:bg-amber-400" : ""} data-testid="progress-piggy-bank" />
            </div>

            {!data.reward && (
              <div className="w-full mt-2">
                <button
                  className="text-xs text-primary underline underline-offset-2"
                  onClick={() => window.dispatchEvent(new Event("piggy-open-reward"))}
                  data-testid="button-set-reward"
                >
                  {t("roadmap.tap_set_reward")}
                </button>
              </div>
            )}

            {isFull && (
              <Button
                onClick={() => window.dispatchEvent(new Event("piggy-open-congrats"))}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="button-claim-reward"
              >
                <Gift className="h-4 w-4 mr-2" />
                {t("roadmap.claim_reward")}
              </Button>
            )}
          </div>
      </div>
    </>
  );
}

export default function RoadmapPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<RoadmapData>({
    queryKey: ["/api/roadmap"],
  });

  const { data: piggy, refetch: refetchPiggy } = useQuery<PiggyBankData>({
    queryKey: ["/api/piggybank"],
  });

  const { data: devCheck } = useQuery<{ isDev: boolean }>({
    queryKey: ["/api/dev/check"],
  });

  const cardRoadmapProgress = useInfoCard("roadmap_progress");
  const cardPiggyBank = useInfoCard("piggy_bank");

  useEffect(() => { if (data) cardRoadmapProgress.trigger(); }, [!!data]);
  useEffect(() => { if (piggy) cardPiggyBank.trigger(); }, [!!piggy]);

  if (isLoading || !data) {
    return <LoadingSkeleton />;
  }

  const ContentFade = ({ children }: { children: React.ReactNode }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  );

  const {
    activeStruggle,
    inProgressStruggles,
    masteredStruggles,
    upcomingStruggles,
    skippedStruggles,
    difficultStruggles,
    inactiveStruggles,
    currentTip,
    isDinnerFocus,
    dinnerMastered,
    dinnerQueueStatus,
    walkSuccessAvg,
    dinnerSuccessAvg,
    dietTipCompletionCount,
    tipLadders,
    currentStruggleCycle,
    cycleHistory,
  } = data;

  const movedOnDisplay = [...new Set([...skippedStruggles, ...difficultStruggles])];

  const STRUGGLE_LABELS: Record<string, string> = {
    sugary_food_drink: t("struggle.sugary_food_drink"),
    oily_fried_food: t("struggle.oily_fried_food"),
    eat_out: t("struggle.eat_out"),
    portions: t("struggle.portions"),
    snacks: t("struggle.snacks"),
  };

  const dinnerCategoryKey =
    dinnerQueueStatus === "mastered" ? "mastered" :
    dinnerQueueStatus === "moved_on" || dinnerQueueStatus === "not_relevant" ? "skipped" :
    dinnerQueueStatus === "active" ? "active" :
    dinnerQueueStatus === "upcoming" ? "upcoming" :
    null;

  const movedOnHasDinner = dinnerCategoryKey === "skipped";

  const struggleCategories: { key: string; icon: LucideIcon; struggles: string[]; highlight?: boolean; hasDinner?: boolean }[] = [
    { key: "active", icon: TrendingUp, struggles: activeStruggle ? [activeStruggle] : [], highlight: true, hasDinner: dinnerCategoryKey === "active" },
    { key: "in_progress", icon: Clock, struggles: inProgressStruggles },
    { key: "mastered", icon: CheckCircle2, struggles: masteredStruggles, hasDinner: dinnerCategoryKey === "mastered" },
    { key: "upcoming", icon: Lock, struggles: upcomingStruggles, hasDinner: dinnerCategoryKey === "upcoming" },
    { key: "moved_on", icon: SkipForward, struggles: movedOnDisplay, hasDinner: movedOnHasDinner },
    { key: "inactive", icon: EyeOff, struggles: inactiveStruggles },
  ];

  return (
    <ContentFade>
    <div className="max-w-sm mx-auto px-4 pb-24 space-y-4">
      <div
        className="relative w-full overflow-hidden mb-2 -mx-4"
        style={{ height: "220px", width: "calc(100% + 2rem)" }}
        data-testid="hero-roadmap"
      >
        <div
          className="absolute left-1/2 bottom-0"
          style={{
            width: "105%",
            paddingBottom: "105%",
            transform: "translateX(-50%)",
            borderRadius: "50%",
            background: "linear-gradient(180deg, #a8b5a0 0%, #c2b9a7 60%, #d4cfc4 100%)",
          }}
        />
        <div
          className="absolute left-1/2 bottom-0 pointer-events-none"
          style={{
            width: "105%",
            paddingBottom: "105%",
            transform: "translateX(-50%)",
            borderRadius: "50%",
            overflow: "hidden",
            opacity: 0.8,
          }}
        >
          <img
            src={sproutBg}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        </div>
        <h1
          className="absolute inset-0 flex items-end justify-center pb-[100px] text-2xl font-bold text-white drop-shadow-md text-center px-6"
          data-testid="text-focus-title"
        >
          {t("roadmap.title")}
        </h1>
      </div>

      {piggy && (
        <PiggyBankCard
          data={piggy}
          isDev={devCheck?.isDev}
        />
      )}

      <Card data-testid="card-walk-progress">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("roadmap.walk_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm text-muted-foreground">{t("roadmap.how_youre_doing")}</span>
            <span className="text-sm font-medium" data-testid="text-walk-avg">
              {Math.round(walkSuccessAvg)}%
            </span>
          </div>
          <Progress value={walkSuccessAvg} data-testid="progress-walk" />
        </CardContent>
      </Card>

      {isDinnerFocus && (
        <Card data-testid="card-dinner-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("roadmap.dinner_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm text-muted-foreground">{t("roadmap.success_rate")}</span>
              <span className="text-sm font-medium" data-testid="text-dinner-avg">
                {Math.round(dinnerSuccessAvg)}%
              </span>
            </div>
            <Progress value={dinnerSuccessAvg} data-testid="progress-dinner" />
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-diet-tip-progress">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("roadmap.diet_tip_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentTip && (
            <p className="text-sm text-primary font-medium mb-3" data-testid="text-current-tip">
              "{translateDietTip(currentTip, t)}"
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm text-muted-foreground">{t("roadmap.diet_completion")}</span>
            <span className="text-sm font-medium" data-testid="text-diet-completion-count">
              {t("roadmap.diet_days", { count: dietTipCompletionCount })}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="pt-2 space-y-4">
        {struggleCategories.map(({ key, icon: Icon, struggles: list, highlight, hasDinner }) => {
          if (list.length === 0 && !hasDinner) return null;
          const itemClass = highlight
            ? "bg-primary text-primary-foreground font-medium"
            : key === "mastered"
            ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
            : key === "moved_on"
            ? "bg-muted/50 text-muted-foreground"
            : key === "inactive"
            ? "text-muted-foreground opacity-40"
            : "text-foreground/80";
          return (
            <div key={key} data-testid={`struggle-category-${key}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {t(`roadmap.category_${key}`)}
              </p>
              <div className="space-y-1">
                {list.map((struggle) => (
                  <div
                    key={struggle}
                    data-testid={`struggle-item-${struggle}`}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${itemClass}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span data-testid={`text-struggle-label-${struggle}`} className="flex-1">
                      {STRUGGLE_LABELS[struggle] || struggle}
                    </span>
                  </div>
                ))}
                {hasDinner && (
                  <div
                    data-testid="struggle-item-dinner"
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${itemClass}`}
                  >
                    <UtensilsCrossed className="h-4 w-4 shrink-0" />
                    <span data-testid="text-struggle-label-dinner" className="flex-1">
                      {t("roadmap.late_dinner_label")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2" data-testid="section-journey">
        <JourneySection cycleHistory={cycleHistory || []} t={t} />
      </div>

    <InfoCardPopup visible={cardRoadmapProgress.visible} onDismiss={cardRoadmapProgress.dismiss} icon={BarChart2} titleKey="info_card.roadmap_progress.title" panelKeys={["info_card.roadmap_progress.p1","info_card.roadmap_progress.p2","info_card.roadmap_progress.p3"]} testId="dialog-card-roadmap-progress" />
    <InfoCardPopup visible={cardPiggyBank.visible} onDismiss={cardPiggyBank.dismiss} icon={PiggyBank} titleKey="info_card.piggy_bank.title" panelKeys={["info_card.piggy_bank.p1","info_card.piggy_bank.p2","info_card.piggy_bank.p3"]} testId="dialog-card-piggy-bank" />
    </div>
    </ContentFade>
  );
}
