import { useState, useRef, useEffect } from "react";
import { useMotionValue, useTransform, animate } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PiggyBankSVG } from "@/components/piggy-bank-svg";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { hapticTap, hapticNotify } from "@/lib/haptics";

export interface PiggyBankData {
  coins: number;
  capacity: number;
  reward: string | null;
  needsRewardSetup: boolean;
}

const DEV_STATES = [0, 10, 25, 40, 55] as const;

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

export function PiggyBankCard({ data, isDev }: {
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
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
    },
    onError: () => {
      hapticNotify("ERROR");
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
                onClick={() => { hapticTap("SOFT"); window.dispatchEvent(new Event("piggy-open-reward")); }}
                data-testid="button-set-reward"
              >
                {t("roadmap.tap_set_reward")}
              </button>
            </div>
          )}

          {isFull && (
            <Button
              onClick={() => { hapticTap("MEDIUM"); window.dispatchEvent(new Event("piggy-open-congrats")); }}
              className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white btn-pop"
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