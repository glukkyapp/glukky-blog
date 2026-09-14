import { useState, useRef, useEffect } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
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
  presentationScope: string;
  canForceMode: boolean;
}

const DEV_STATES = [0, 1, 5, 7, 11, 16, 20, 25, 31, 35, 40, 46, 55, 60] as const;
const PHOTO_SLOT_COUNT = 12;

export const PHOTO_SET_MANIFEST: Record<number, {
  id: string;
  name: string;
  photos: ReadonlyArray<{ id: string; assetUrl: string }>;
}> = {
  0: {
    id: "1970s-1",
    name: "1970s 1",
    photos: [
      "15_92_71_1789395231871.jpg", "15A_38A_74_1789395557149.jpg",
      "19_75B_76_1789395574056.jpg", "1A_210_72_1789395241767.jpg",
      "20_62D_74_1789395557150.jpg", "3_104_76_1789395574055.jpg",
      "31A_1_74_1789395557150.jpg", "31A_38C_74_1789395557151.jpg",
      "33_103_78_1789395673734.jpg", "7_23_76_1789395574055.jpg",
      "7A_279_72_1789395241768.jpg", "9_99_73_1789395251195.jpg",
    ].map((file, index) => ({
      id: `1970s-1-${index + 1}`,
      assetUrl: `/reward-photos/1970s-1/${file}`,
    })),
  },
  1: {
    id: "1970s-2",
    name: "1970s 2",
    photos: [
      "0_62D_74_1789395257632.jpg", "0A_141_71_1789395231868.jpg",
      "15_66_75_1789395563724.jpg", "1A_130A_71_1789395231870.jpg",
      "1A_32_72_1789395241765.jpg", "2_10_76_1789395574052.jpg",
      "26_58_70_1789395225019.jpg", "33_69_78_1789395644047.jpg",
      "5_10_72_1789395241768.jpg", "5_15_75_1789395563724.jpg",
      "6_96_73_1789395251194.jpg", "9A_38D_74_1789395557148.jpg",
    ].map((file, index) => ({
      id: `1970s-2-${index + 1}`,
      assetUrl: `/reward-photos/1970s-2/${file}`,
    })),
  },
  2: {
    id: "1970s-3",
    name: "1970s 3",
    photos: [
      "15_74A_71_1789395231870.jpg", "17_19_76_1789395574056.jpg",
      "17A_32_72_1789395241768.jpg", "2A_279_72_1789395241767.jpg",
      "30A_38_74_1789395557150.jpg", "4_11_75_1789395563722.jpg",
      "4A_83_73_1789395251192.jpg", "6A_76A_70_1789395225017.jpg",
      "7_25_78_1789395681530.jpg", "8_104_76_1789395574056.jpg",
      "8_19_76_1789395574056.jpg", "9_98B_70_1789395225019.jpg",
    ].map((file, index) => ({
      id: `1970s-3-${index + 1}`,
      assetUrl: `/reward-photos/1970s-3/${file}`,
    })),
  },
};

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
  const reduceMotion = useReducedMotion();
  const unlockedCount = Math.max(0, Math.min(PHOTO_SLOT_COUNT, data.unlockedPhotoCount));
  const photoSet = PHOTO_SET_MANIFEST[data.photoSetIndex] ?? PHOTO_SET_MANIFEST[0];
  const activePhoto = unlockedCount > 0 ? photoSet.photos[unlockedCount - 1] : null;
  const previousProgressRef = useRef<{
    cycleId: number;
    photoSetIndex: number;
    unlockedCount: number;
  } | null>(null);
  const [lightTransition, setLightTransition] = useState(0);

  // Download the complete active set at cycle start so threshold transitions
  // never wait for the next archival image to load.
  useEffect(() => {
    const preloaders = photoSet.photos.map(({ assetUrl }) => {
      const image = new window.Image();
      image.src = assetUrl;
      return image;
    });
    return () => {
      preloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [data.cycleId, data.photoSetIndex, photoSet.photos]);

  useEffect(() => {
    const storageKey = `piggy-photo-presented:${data.presentationScope}:${data.cycleId}:${data.photoSetIndex}`;
    const previous = previousProgressRef.current;
    const samePresentation = previous?.cycleId === data.cycleId &&
      previous.photoSetIndex === data.photoSetIndex;
    const storedCount = Number.parseInt(window.sessionStorage.getItem(storageKey) ?? "0", 10);
    const previousCount = samePresentation
      ? previous.unlockedCount
      : Number.isFinite(storedCount) ? storedCount : 0;

    if (unlockedCount > previousCount) {
      setLightTransition((value) => value + 1);
    }
    window.sessionStorage.setItem(storageKey, String(unlockedCount));
    previousProgressRef.current = {
      cycleId: data.cycleId,
      photoSetIndex: data.photoSetIndex,
      unlockedCount,
    };
  }, [data.cycleId, data.photoSetIndex, data.presentationScope, unlockedCount]);

  return (
    <section className="w-full" aria-labelledby="photo-mode-heading" data-testid="photo-mode-panel">
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-slate-900"
        style={{ aspectRatio: "1376 / 768", boxShadow: "0 8px 24px rgba(36, 74, 47, 0.16)" }}
        role="img"
        aria-label={activePhoto
          ? t("roadmap.photo_display_aria", { current: unlockedCount, total: PHOTO_SLOT_COUNT })
          : t("roadmap.photo_placeholder_aria")}
        data-testid="photo-display"
      >
        <AnimatePresence mode="wait">
          {activePhoto ? (
            <motion.img
              key={activePhoto.id}
              src={activePhoto.assetUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.025 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.7, ease: "easeOut" }}
            />
          ) : (
            <motion.div
              key="photo-starting-state"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <img
                src={photoSet.photos[0].assetUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-20 blur-[2px] grayscale"
              />
              <div className="absolute inset-0 bg-slate-950/45" />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                <p className="text-base font-semibold">{t("roadmap.photo_placeholder_title")}</p>
                <p className="mt-1 max-w-xs text-sm text-white/80">
                  {t("roadmap.photo_placeholder_description")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {lightTransition > 0 && !reduceMotion && (
          <motion.div
            key={lightTransition}
            className="pointer-events-none absolute inset-0"
            style={{
              background: "linear-gradient(110deg, transparent 15%, rgba(255,255,255,0.15) 35%, rgba(255,247,205,0.85) 50%, rgba(255,255,255,0.18) 65%, transparent 85%)",
            }}
            initial={{ opacity: 0, x: "-110%" }}
            animate={{ opacity: [0, 1, 0], x: ["-110%", "0%", "110%"] }}
            transition={{ duration: 1.05, ease: "easeInOut" }}
            aria-hidden="true"
            data-testid="photo-light-transition"
          />
        )}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground" data-testid="photo-copyright-disclaimer">
        {t("roadmap.photo_copyright_disclaimer")}
      </p>

      <h2 id="photo-mode-heading" className="w-full py-2 text-left font-bold" style={{ color: "var(--brand-ink)", fontSize: "17px" }}>
        {t("roadmap.photo_mode_title")}
      </h2>
      <p className="text-sm leading-snug mb-3" style={{ color: "var(--brand-muted)" }}>
        {t("roadmap.photo_mode_description")}
      </p>
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
            {unlockedCount === 0
              ? t("roadmap.photo_first_unlock_progress", { coins: data.coins })
              : t("roadmap.photo_current_number", { current: unlockedCount, total: PHOTO_SLOT_COUNT })}
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