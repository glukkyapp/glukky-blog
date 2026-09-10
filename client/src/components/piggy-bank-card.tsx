import { useState, useRef, useEffect } from "react";
import { useMotionValue, useTransform, animate } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PiggyBankSVG } from "@/components/piggy-bank-svg";
import { isGardenComplete } from "@/components/harbour-garden-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { hapticNotify } from "@/lib/haptics";

export interface PiggyBankData {
  coins: number;
  capacity: number;
  gardensCompleted: number;
  visualSetId: string;
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<"success" | "error" | null>(null);

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

  const startNewGardenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/piggybank/start-new-garden", {
      visualSetId: data.visualSetId,
    }),
    onMutate: () => setResetMessage(null),
    onSuccess: async () => {
      setResetDialogOpen(false);
      setResetMessage("success");
      hapticNotify("SUCCESS");
      await queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
    },
    onError: async () => {
      setResetMessage("error");
      hapticNotify("ERROR");
      await queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
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

          <h2 className="w-full py-2 text-left font-bold" style={{ color: "var(--brand-ink)", fontSize: "17px" }}>
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
            <>
              <p className="mt-3 w-full text-center font-semibold text-emerald-800" role="status" data-testid="garden-complete-message">
                {t("roadmap.garden_complete")}
              </p>
              <AlertDialog
                open={resetDialogOpen}
                onOpenChange={(open) => {
                  if (!startNewGardenMutation.isPending) setResetDialogOpen(open);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    disabled={startNewGardenMutation.isPending}
                    data-testid="button-start-new-garden"
                  >
                    {t("roadmap.start_new_garden")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="dialog-start-new-garden">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("roadmap.start_new_garden_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("roadmap.start_new_garden_description")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={startNewGardenMutation.isPending}>
                      {t("roadmap.start_new_garden_cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={startNewGardenMutation.isPending}
                      onClick={(event) => {
                        event.preventDefault();
                        startNewGardenMutation.mutate();
                      }}
                      data-testid="button-confirm-start-new-garden"
                    >
                      {startNewGardenMutation.isPending
                        ? t("roadmap.starting_new_garden")
                        : t("roadmap.start_new_garden_confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {resetMessage && (
            <p
              className={`mt-2 w-full text-center text-sm font-semibold ${
                resetMessage === "success" ? "text-emerald-700" : "text-destructive"
              }`}
              role={resetMessage === "success" ? "status" : "alert"}
              data-testid={`garden-reset-${resetMessage}`}
            >
              {t(resetMessage === "success"
                ? "roadmap.start_new_garden_success"
                : "roadmap.start_new_garden_error")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}