import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
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
import { track } from "@/lib/posthog";

export type PiggyBankMode = "garden" | "photo";

export interface PiggyBankData {
  coins: number;
  capacity: number;
  gardensCompleted: number;
  visualSetId: string;
  reward: string | null;
  needsRewardSetup: boolean;
  mode: PiggyBankMode | null;
  modeAutoAssigned: boolean;
  photoSetIndex: number;
  unlockedPhotoCount: number;
  cycleId: number;
  canForceMode: boolean;
}

const DEV_STATES = [0, 1, 5, 7, 11, 16, 20, 25, 31, 35, 40, 46, 55, 60] as const;
const PHOTO_SLOT_COUNT = 12;

/**
 * The manifest deliberately contains no URLs yet. Later supplied archival
 * assets can be added per slot without changing the progress or rendering
 * contract. A null asset is rendered as an explicit pending state, never as
 * an image with a guessed or broken URL.
 */
export const PHOTO_SET_MANIFEST: Record<number, {
  id: string;
  photos: ReadonlyArray<{ id: string; assetUrl: string | null }>;
}> = Object.fromEntries(
  [0, 1, 2, 3].map((setIndex) => [
    setIndex,
    {
      id: `hong-kong-archive-set-${setIndex}`,
      photos: Array.from({ length: PHOTO_SLOT_COUNT }, (_, index) => ({
        id: `set-${setIndex}-photo-${index + 1}`,
        assetUrl: null,
      })),
    },
  ]),
) as Record<number, {
  id: string;
  photos: ReadonlyArray<{ id: string; assetUrl: string | null }>;
}>;

function AnimatedCoinCount({
  target,
  capacity,
  t,
  translationKey = "roadmap.garden_points_count",
}: {
  target: number;
  capacity: number;
  t: (key: string, opts?: any) => string;
  translationKey?: string;
}) {
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
  }, [count, rounded, target]);

  return <span>{t(translationKey, { points: displayVal, capacity })}</span>;
}

function PhotoModePanel({
  data,
  t,
}: {
  data: PiggyBankData;
  t: (key: string, opts?: any) => string;
}) {
  const previousUnlockedRef = useRef<number | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<ReadonlySet<number>>(new Set());
  const unlockedCount = Math.max(0, Math.min(PHOTO_SLOT_COUNT, data.unlockedPhotoCount));
  const photoSet = PHOTO_SET_MANIFEST[data.photoSetIndex] ?? PHOTO_SET_MANIFEST[0];

  useEffect(() => {
    const previous = previousUnlockedRef.current;
    if (previous !== null && unlockedCount > previous) {
      setNewlyUnlocked(new Set(
        Array.from({ length: unlockedCount - previous }, (_, offset) => previous + offset),
      ));
      previousUnlockedRef.current = unlockedCount;
      const timer = window.setTimeout(() => setNewlyUnlocked(new Set()), 2200);
      return () => window.clearTimeout(timer);
    }
    setNewlyUnlocked(new Set());
    previousUnlockedRef.current = unlockedCount;
  }, [data.cycleId, unlockedCount]);

  // A new cycle starts at zero, even if the previous cycle had all twelve slots.
  useEffect(() => {
    previousUnlockedRef.current = unlockedCount;
    setNewlyUnlocked(new Set());
  }, [data.cycleId, data.photoSetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="w-full" aria-labelledby="photo-mode-heading" data-testid="photo-mode-panel">
      <h2 id="photo-mode-heading" className="w-full py-2 text-left font-bold" style={{ color: "var(--brand-ink)", fontSize: "17px" }}>
        {t("roadmap.photo_mode_title")}
      </h2>
      <p className="text-sm leading-snug mb-3" style={{ color: "var(--brand-muted)" }}>
        {t("roadmap.photo_mode_description")}
      </p>
      <div
        role="grid"
        aria-label={t("roadmap.photo_grid_label")}
        className="grid grid-cols-3 gap-2"
        data-testid="photo-grid"
      >
        {photoSet.photos.map((photo, index) => {
          const unlocked = index < unlockedCount;
          const slotLabel = unlocked
            ? photo.assetUrl
              ? t("roadmap.photo_slot_available", { number: index + 1 })
              : t("roadmap.photo_slot_pending", { number: index + 1 })
            : t("roadmap.photo_slot_locked", { number: index + 1, coins: (index + 1) * 5 });
          const slot = (
            <div
              role="gridcell"
              aria-label={slotLabel}
              aria-disabled={!unlocked}
              tabIndex={0}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-center px-1 ${
                unlocked
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-muted-foreground/20 bg-muted/30 text-muted-foreground"
              }`}
              data-testid={`photo-slot-${index + 1}`}
              data-unlocked={unlocked ? "true" : "false"}
            >
              {unlocked && photo.assetUrl ? (
                <img
                  src={photo.assetUrl}
                  alt={t("roadmap.photo_slot_available", { number: index + 1 })}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <span className="text-lg" aria-hidden="true">{unlocked ? "▧" : "•"}</span>
              )}
              <span className="text-[11px] leading-tight">
                {unlocked ? (photo.assetUrl ? t("roadmap.photo_slot_available_short") : t("roadmap.photo_asset_pending")) : t("roadmap.photo_locked")}
              </span>
            </div>
          );
          return newlyUnlocked.has(index) ? (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.82, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              {slot}
            </motion.div>
          ) : (
            <div key={photo.id}>{slot}</div>
          );
        })}
      </div>
      <div className="w-full mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-muted-foreground font-medium" data-testid="text-piggy-coins">
            <AnimatedCoinCount
              target={data.coins}
              capacity={data.capacity}
              t={t}
              translationKey="roadmap.photo_points_count"
            />
          </span>
          <span className="text-xs text-muted-foreground">
            {t("roadmap.photo_unlocked_count", { unlocked: unlockedCount, total: PHOTO_SLOT_COUNT })}
          </span>
        </div>
        <Progress value={Math.min((data.coins / data.capacity) * 100, 100)} data-testid="progress-harbour-photo" />
      </div>
    </section>
  );
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

  const chooseModeMutation = useMutation({
    mutationFn: async (mode: PiggyBankMode) => {
      const response = await apiRequest("POST", "/api/piggybank/mode", { mode });
      return response.json() as Promise<{ selectedNow?: boolean; mode?: PiggyBankMode | null }>;
    },
    onSuccess: async (result, requestedMode) => {
      // The server's conditional write is authoritative. A tap that loses
      // the first-coin race must not produce a misleading choice event.
      if (result.selectedNow === true && result.mode === requestedMode) {
        track(requestedMode === "garden" ? "garden_choice" : "photo_choice");
      }
      hapticNotify("SUCCESS");
      await queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
    },
    onError: () => hapticNotify("ERROR"),
  });

  const forceModeMutation = useMutation({
    mutationFn: (mode: PiggyBankMode) =>
      apiRequest("POST", "/api/piggybank/force-mode", { mode }),
    onSuccess: async () => {
      hapticNotify("SUCCESS");
      await queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
    },
    onError: () => hapticNotify("ERROR"),
  });

  const startNewGardenMutation = useMutation({
    // The server keeps /api/piggybank/start-new-garden as a legacy alias;
    // this mode-neutral endpoint is strict and works for garden or photo.
    mutationFn: () => apiRequest("POST", "/api/piggybank/start-new-cycle", {}),
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
  const forceSwitch = data.canForceMode ? (
    <aside className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2" data-testid="reward-card-mode-switch">
      <p className="text-xs font-semibold text-amber-900 mb-2">{t("roadmap.force_mode_title")}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={data.mode === "garden" ? "default" : "outline"}
          className="flex-1"
          disabled={forceModeMutation.isPending}
          onClick={() => forceModeMutation.mutate("garden")}
          data-testid="button-force-garden-mode"
        >
          {t("roadmap.force_garden_mode")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={data.mode === "photo" ? "default" : "outline"}
          className="flex-1"
          disabled={forceModeMutation.isPending}
          onClick={() => forceModeMutation.mutate("photo")}
          data-testid="button-force-photo-mode"
        >
          {t("roadmap.force_photo_mode")}
        </Button>
      </div>
    </aside>
  ) : null;

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
          {data.mode === null ? (
            <section className="w-full" aria-labelledby="piggy-mode-choice-heading" data-testid="piggy-mode-choice">
              <h2 id="piggy-mode-choice-heading" className="w-full py-2 text-left font-bold" style={{ color: "var(--brand-ink)", fontSize: "17px" }}>
                {t("roadmap.choose_mode_title")}
              </h2>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-12 whitespace-normal text-left justify-start"
                  disabled={chooseModeMutation.isPending}
                  onClick={() => chooseModeMutation.mutate("garden")}
                  data-testid="button-choose-garden"
                >
                  {t("roadmap.choose_garden")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-12 whitespace-normal text-left justify-start"
                  disabled={chooseModeMutation.isPending}
                  onClick={() => chooseModeMutation.mutate("photo")}
                  data-testid="button-choose-photo"
                >
                  {t("roadmap.choose_photo")}
                </Button>
              </div>
            </section>
          ) : data.mode === "photo" ? (
            <PhotoModePanel data={data} t={t} />
          ) : (
            <>
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

            </>
          )}

          {isFull && (
            data.mode !== null ? (
            <>
              <p className="mt-3 w-full text-center font-semibold text-emerald-800" role="status" data-testid="garden-complete-message">
                {data.mode === "garden" ? t("roadmap.garden_complete") : t("roadmap.cycle_complete")}
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
                    {t("roadmap.start_next_cycle")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="dialog-start-new-garden">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("roadmap.start_next_cycle_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("roadmap.start_next_cycle_description")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={startNewGardenMutation.isPending}>
                      {t("roadmap.start_next_cycle_cancel")}
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
                        ? t("roadmap.starting_next_cycle")
                        : t("roadmap.start_next_cycle_confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {resetMessage && (
                <p
                  className={`mt-2 w-full text-center text-sm font-semibold ${
                    resetMessage === "success" ? "text-emerald-700" : "text-destructive"
                  }`}
                  role={resetMessage === "success" ? "status" : "alert"}
                  data-testid={`garden-reset-${resetMessage}`}
                >
                  {t(resetMessage === "success"
                    ? "roadmap.start_next_cycle_success"
                    : "roadmap.start_next_cycle_error")}
                </p>
              )}
            </>
            ) : null
          )}

          {forceSwitch}
        </div>
      </div>
    </>
  );
}