import { useState, useRef, useEffect } from "react";
import { useMotionValue, useTransform, animate } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { PiggyBankSVG } from "@/components/piggy-bank-svg";
import { isGardenComplete } from "@/components/harbour-garden-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { hapticNotify } from "@/lib/haptics";

export interface PiggyBankData {
  coins: number;
  capacity: number;
  reward: string | null;
  needsRewardSetup: boolean;
}

const DEV_STATES = [0, 1, 5, 7, 11, 16, 20, 25, 31, 35, 40, 46, 55, 60] as const;

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

  return <span>{t("roadmap.garden_points_count", { points: displayVal, capacity })}</span>;
}

export function PiggyBankCard({ data, isDev }: {
  data: PiggyBankData;
  isDev?: boolean;
}) {
  const { t } = useTranslation();
  const prevCoins = useRef(data.coins);
  const [animating, setAnimating] = useState(false);

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
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 2200);
      prevCoins.current = data.coins;
      return () => clearTimeout(timer);
    }
    prevCoins.current = data.coins;
  }, [data.coins]);

  const isFull = isGardenComplete(data.coins);
  const fillPct = Math.min((data.coins / data.capacity) * 100, 100);

  return (
    <>
      <style>{`
        @keyframes saved-label {
          0% { opacity: 0; transform: translateY(6px); }
          30%, 75% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>

      <div data-testid="card-harbour-garden" className="px-0 pt-2 pb-5">
        <div className="flex flex-col items-center gap-1 relative">
          {animating && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
               style={{ width: 160 }}
            >
              <p
                style={{
                  animation: "saved-label 1.5s ease forwards",
                  animationDelay: "0.15s",
                  opacity: 0,
                  color: "#477349",
                  fontWeight: 700,
                  fontSize: 12,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                 {t("roadmap.garden_grew")}
              </p>
            </div>
          )}

          <PiggyBankSVG
            coins={data.coins}
            previousCoins={prevCoins.current}
            ariaLabel={t("roadmap.garden_aria", { points: Math.max(0, Math.min(60, data.coins)), capacity: 60 })}
          />

          <h2 className="w-full text-left text-lg font-bold" style={{ color: "var(--brand-ink)" }}>
            {t("roadmap.harbour_garden")}
          </h2>

          {isDev && (
            <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
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
            </div>
          )}

          <div className="w-full mt-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground font-medium" data-testid="text-piggy-coins">
                <AnimatedCoinCount target={data.coins} capacity={data.capacity} t={t} />
              </span>
              {isFull && <span className="text-xs font-semibold text-emerald-700">{t("roadmap.garden_complete")}</span>}
            </div>
            <Progress value={fillPct} className={isFull ? "[&>div]:bg-emerald-500" : ""} data-testid="progress-harbour-garden" />
          </div>

          {isFull && (
            <p className="mt-3 w-full text-center font-semibold text-emerald-800" role="status" data-testid="garden-complete-message">
              {t("roadmap.garden_complete")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}