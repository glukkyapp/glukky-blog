import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { TrendingUp, Lock, Gift, BarChart2, PiggyBank } from "lucide-react";
import { InfoCardPopup, useInfoCard } from "@/components/info-card-popup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PiggyBankSVG } from "@/components/piggy-bank-svg";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";

function translateDietTip(tip: string, t: (key: string, opts?: any) => string): string {
  const i18nKey = DIET_TIP_I18N_KEYS[tip];
  return i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
}

interface RoadmapData {
  currentStruggle: string;
  currentTip: string;
  isDinnerFocus: boolean;
  dinnerMastered: boolean;
  walkSuccessAvg: number;
  dinnerSuccessAvg: number;
  dietTipCompletionCount: number;
  struggles: string[];
  currentTipIndex: number;
  tipLadders: Record<string, string[]>;
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

function PiggyBankCard({ data, onClaim, onSetReward }: {
  data: PiggyBankData;
  onClaim: () => void;
  onSetReward: () => void;
}) {
  const { t } = useTranslation();
  const prevCoins = useRef(data.coins);
  const [animating, setAnimating] = useState(false);
  const [coinsGained, setCoinsGained] = useState(0);

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

      <Card data-testid="card-piggy-bank" className={isFull ? "border-amber-400 shadow-md" : ""}>
        <CardContent className="pt-4 pb-5">
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

            <PiggyBankSVG coins={data.coins} className="w-36 h-36" />

            <div className="w-full mt-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground font-medium" data-testid="text-piggy-coins">
                  {t("roadmap.coins_count", { coins: data.coins, capacity: data.capacity })}
                </span>
                {isFull && (
                  <span className="text-xs font-semibold text-amber-600">{t("roadmap.full")}</span>
                )}
              </div>
              <Progress value={fillPct} className={isFull ? "[&>div]:bg-amber-400" : ""} data-testid="progress-piggy-bank" />
            </div>

            <div className="w-full mt-2">
              {data.reward ? (
                <p className="text-xs text-muted-foreground" data-testid="text-piggy-reward">
                  {t("roadmap.reward_goal")} <span className="font-medium text-foreground">{data.reward}</span>
                </p>
              ) : (
                <button
                  className="text-xs text-primary underline underline-offset-2"
                  onClick={onSetReward}
                  data-testid="button-set-reward"
                >
                  {t("roadmap.tap_set_reward")}
                </button>
              )}
            </div>

            {isFull && (
              <Button
                onClick={onClaim}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="button-claim-reward"
              >
                <Gift className="h-4 w-4 mr-2" />
                {t("roadmap.claim_reward")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
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

  const [showRewardSetup, setShowRewardSetup] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [rewardInput, setRewardInput] = useState("");
  const [congratsShown, setCongratsShown] = useState(false);

  const cardRoadmapProgress = useInfoCard("roadmap_progress");
  const cardPiggyBank = useInfoCard("piggy_bank");

  useEffect(() => {
    if (piggy?.needsRewardSetup) {
      setShowRewardSetup(true);
    }
  }, [piggy?.needsRewardSetup]);

  useEffect(() => {
    if (piggy && piggy.coins >= piggy.capacity && !piggy.needsRewardSetup && !congratsShown) {
      setCongratsShown(true);
      setShowCongrats(true);
    }
  }, [piggy?.coins, piggy?.needsRewardSetup]);

  useEffect(() => { if (data) cardRoadmapProgress.trigger(); }, [!!data]);
  useEffect(() => { if (piggy) cardPiggyBank.trigger(); }, [!!piggy]);

  const rewardMutation = useMutation({
    mutationFn: (reward: string) =>
      apiRequest("POST", "/api/piggybank/reward", { reward }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      setShowRewardSetup(false);
      setRewardInput("");
    },
  });

  const claimMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/piggybank/claim", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      setShowCongrats(false);
      setCongratsShown(false);
      setTimeout(() => setShowRewardSetup(true), 400);
    },
  });

  if (isLoading || !data) {
    return <LoadingSkeleton />;
  }

  const {
    currentStruggle,
    currentTip,
    isDinnerFocus,
    dinnerMastered,
    walkSuccessAvg,
    dinnerSuccessAvg,
    dietTipCompletionCount,
    struggles,
    currentTipIndex,
    tipLadders,
  } = data;

  const STRUGGLE_LABELS: Record<string, string> = {
    sugary_food_drink: t("struggle.sugary_food_drink"),
    oily_fried_food: t("struggle.oily_fried_food"),
    eat_out: t("struggle.eat_out"),
    portions: t("struggle.portions"),
    snacks: t("struggle.snacks"),
  };

  const rawIndex = struggles.indexOf(currentStruggle);
  const currentStruggleIndex = rawIndex >= 0 ? rawIndex : 0;

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div data-testid="focus-area-header">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold" data-testid="text-focus-title">
            {t("roadmap.title")}
          </h1>
        </div>
      </div>

      {piggy && (
        <PiggyBankCard
          data={piggy}
          onClaim={() => setShowCongrats(true)}
          onSetReward={() => setShowRewardSetup(true)}
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

      <div className="pt-2">
        <h2 className="text-base font-semibold mb-3" data-testid="text-struggle-queue-title">
          {t("roadmap.struggle_queue_title")}
        </h2>
        <div className="space-y-2">
          {struggles.filter((_, index) => index >= currentStruggleIndex).map((struggle) => {
            const isCurrent = struggle === currentStruggle;
            const label = STRUGGLE_LABELS[struggle] || struggle;

            return (
              <div
                key={struggle}
                data-testid={`struggle-item-${struggle}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground opacity-60"
                }`}
              >
                {isCurrent ? (
                  <TrendingUp className="h-4 w-4 shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 shrink-0" />
                )}
                <span data-testid={`text-struggle-label-${struggle}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showRewardSetup} onOpenChange={setShowRewardSetup}>
        <DialogContent data-testid="modal-reward-setup">
          <DialogHeader>
            <DialogTitle>{t("roadmap.reward_setup_title")}</DialogTitle>
            <DialogDescription>
              {t("roadmap.reward_setup_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input
              value={rewardInput}
              onChange={(e) => setRewardInput(e.target.value)}
              placeholder={t("roadmap.reward_placeholder")}
              data-testid="input-reward"
              onKeyDown={(e) => {
                if (e.key === "Enter" && rewardInput.trim()) {
                  rewardMutation.mutate(rewardInput.trim());
                }
              }}
            />
            <Button
              className="w-full"
              onClick={() => rewardMutation.mutate(rewardInput.trim())}
              disabled={!rewardInput.trim() || rewardMutation.isPending}
              data-testid="button-save-reward"
            >
              {rewardMutation.isPending ? t("roadmap.saving") : t("roadmap.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCongrats} onOpenChange={setShowCongrats}>
        <DialogContent data-testid="modal-congrats">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("roadmap.congrats_title")}</DialogTitle>
            <DialogDescription>
              {t("roadmap.congrats_desc")}
            </DialogDescription>
          </DialogHeader>
          {piggy?.reward && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-2">
              <p className="text-xs text-muted-foreground mb-1">{t("roadmap.your_reward")}</p>
              <p className="font-semibold text-foreground text-base" data-testid="text-congrats-reward">
                {piggy.reward}
              </p>
            </div>
          )}
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            data-testid="button-confirm-claim"
          >
            {claimMutation.isPending ? t("roadmap.claiming") : t("roadmap.claim_reward")}
          </Button>
        </DialogContent>
      </Dialog>
    <InfoCardPopup visible={cardRoadmapProgress.visible} onDismiss={cardRoadmapProgress.dismiss} icon={BarChart2} titleKey="info_card.roadmap_progress.title" panelKeys={["info_card.roadmap_progress.p1","info_card.roadmap_progress.p2","info_card.roadmap_progress.p3"]} testId="dialog-card-roadmap-progress" />
    <InfoCardPopup visible={cardPiggyBank.visible} onDismiss={cardPiggyBank.dismiss} icon={PiggyBank} titleKey="info_card.piggy_bank.title" panelKeys={["info_card.piggy_bank.p1","info_card.piggy_bank.p2","info_card.piggy_bank.p3"]} testId="dialog-card-piggy-bank" />
    </div>
  );
}
