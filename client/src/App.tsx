import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedPageWrapper } from "@/components/page-transition";
import { useAuth } from "@/hooks/use-auth";
import FloatingNavBar from "@/components/floating-nav-bar";
import { lazy, Suspense, useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import i18n from "./i18n";
import { useTranslation } from "react-i18next";
import { PiggyBankPreloader } from "@/components/piggy-bank-svg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { hapticPattern, hapticNotify } from "@/lib/haptics";
import { useBounceScroll, BOUNCE_WRAPPER_ID } from "@/hooks/use-bounce-scroll";
import {
  loginToRevenueCat,
  logoutFromRevenueCat,
  presentPaywall,
  presentPaywallIfNeeded,
} from "@/lib/natively-purchases";
import { LoadingOverlayProvider } from "@/components/global-loading-overlay";
import { OfflineProvider } from "@/contexts/offline-context";
import { getStage1Promise } from "@/lib/preload-assets";
import { prefetchUserData, resetPrefetchUserData } from "@/lib/prefetch-user-data";
import CubeLoadingScreen from "@/components/cube-loading-screen";
import UnlockingOverlay from "@/components/unlocking-overlay";
import PaywallExitWarning from "@/components/paywall-exit-warning";
import { identifyUser, resetUser, track, initPostHog } from "@/lib/posthog";
import { SESSION_HINT_KEY } from "@/hooks/use-auth";

declare global {
  interface Window {
    __bnLoadedAt?: number;
    __cubeMountedAt?: number;
    __stage1ReadyAt?: number;
  }
}

// Routes are React.lazy so the cold-launch bundle stays small; the cube overlay or #FDFBED background covers the Suspense fallback.
const Landing = lazy(() => import("@/pages/landing"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const WeeklyPlanner = lazy(() => import("@/pages/weekly-planner"));
const Home = lazy(() => import("@/pages/home"));
const Roadmap = lazy(() => import("@/pages/roadmap"));
const Profile = lazy(() => import("@/pages/profile"));
const MonthlyReport = lazy(() => import("@/pages/monthly-report"));
const Snap = lazy(() => import("@/pages/snap"));
const HealthInfo = lazy(() => import("@/pages/health-info"));
const AppIntro = lazy(() => import("@/pages/app-intro"));
const DevPanel = lazy(() => import("@/pages/dev-panel"));
const NotFound = lazy(() => import("@/pages/not-found"));

const RouteFallback = () => (
  <div
    aria-hidden="true"
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "#FDFBED",
      pointerEvents: "none",
    }}
  />
);

interface PiggyBankData {
  coins: number;
  capacity: number;
  reward: string | null;
  needsRewardSetup: boolean;
}

function GlobalPiggyBankPopup() {
  const { t } = useTranslation();
  const { data: piggy } = useQuery<PiggyBankData>({
    queryKey: ["/api/piggybank"],
  });

  const [showRewardSetup, setShowRewardSetup] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [rewardInput, setRewardInput] = useState("");
  const [congratsShown, setCongratsShown] = useState(false);
  const [dialogStep, setDialogStep] = useState<"intro" | "goal">("intro");
  const [dialogMode, setDialogMode] = useState<"first_time" | "edit">("first_time");

  useEffect(() => {
    if (piggy?.needsRewardSetup) {
      setDialogMode("first_time");
      setDialogStep("intro");
      setShowRewardSetup(true);
    }
  }, [piggy?.needsRewardSetup]);

  useEffect(() => {
    if (piggy && piggy.coins >= piggy.capacity && !piggy.needsRewardSetup && !congratsShown) {
      setCongratsShown(true);
      setShowCongrats(true);
      hapticPattern("..oO-Oo..", 80);
    }
  }, [piggy?.coins, piggy?.needsRewardSetup]);

  useEffect(() => {
    const handleOpenReward = () => {
      setDialogMode("edit");
      setDialogStep("goal");
      setShowRewardSetup(true);
    };
    const handleOpenCongrats = () => setShowCongrats(true);
    window.addEventListener("piggy-open-reward", handleOpenReward);
    window.addEventListener("piggy-open-congrats", handleOpenCongrats);
    return () => {
      window.removeEventListener("piggy-open-reward", handleOpenReward);
      window.removeEventListener("piggy-open-congrats", handleOpenCongrats);
    };
  }, []);

  const rewardMutation = useMutation({
    mutationFn: (reward: string) =>
      apiRequest("POST", "/api/piggybank/reward", { reward }),
    onSuccess: () => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      setShowRewardSetup(false);
      setRewardInput("");
    },
    onError: () => {
      hapticNotify("ERROR");
    },
  });

  const claimMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/piggybank/claim", {}),
    onSuccess: () => {
      hapticNotify("SUCCESS");
      hapticPattern("..oO-Oo..", 80);
      queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      setShowCongrats(false);
      setCongratsShown(false);
      setTimeout(() => setShowRewardSetup(true), 400);
    },
    onError: () => {
      hapticNotify("ERROR");
    },
  });

  return (
    <>
      <Dialog open={showRewardSetup} onOpenChange={setShowRewardSetup}>
        <DialogContent data-testid="modal-reward-setup-global">
          {dialogMode === "first_time" && dialogStep === "intro" ? (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">{t("roadmap.reward_setup_title")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <span className="text-5xl">🐷</span>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-piggy-intro-body">
                  {t("roadmap.piggy_intro_body")}
                </p>
                <Button
                  className="w-full btn-pop"
                  onClick={() => setDialogStep("goal")}
                  data-testid="button-piggy-intro-next"
                >
                  {t("intro.next")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("roadmap.reward_setup_title")}</DialogTitle>
                <DialogDescription>
                  {t("roadmap.piggy_intro_body")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                <Input
                  value={rewardInput}
                  onChange={(e) => setRewardInput(e.target.value)}
                  placeholder={t("roadmap.reward_placeholder")}
                  data-testid="input-reward-global"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && rewardInput.trim()) {
                      rewardMutation.mutate(rewardInput.trim());
                    }
                  }}
                />
                <Button
                  className="w-full btn-pop"
                  onClick={() => rewardMutation.mutate(rewardInput.trim())}
                  disabled={!rewardInput.trim() || rewardMutation.isPending}
                  data-testid="button-save-reward-global"
                >
                  {rewardMutation.isPending ? t("roadmap.saving") : t("roadmap.save")}
                </Button>
                {dialogMode === "first_time" && (
                  <button
                    className="w-full text-sm text-muted-foreground underline underline-offset-2 py-1"
                    onClick={() => setShowRewardSetup(false)}
                    data-testid="button-skip-reward-global"
                  >
                    {t("roadmap.skip_for_now")}
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCongrats} onOpenChange={setShowCongrats}>
        <DialogContent data-testid="modal-congrats-global">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("roadmap.congrats_title")}</DialogTitle>
            <DialogDescription>
              {t("roadmap.congrats_desc")}
            </DialogDescription>
          </DialogHeader>
          {piggy?.reward && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-2">
              <p className="text-xs text-muted-foreground mb-1">{t("roadmap.your_reward")}</p>
              <p className="font-semibold text-foreground text-base" data-testid="text-congrats-reward-global">
                {piggy.reward}
              </p>
            </div>
          )}
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            data-testid="button-confirm-claim-global"
          >
            {claimMutation.isPending ? t("roadmap.claiming") : t("roadmap.claim_reward")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Single source of truth for the planner route — used by the lock-app
// effect, the dismiss-routing helper, and any other call site that
// needs to redirect the user back to onboarding. Reusing this constant
// means a future route rename can't silently 404 the dismiss redirect.
const PLANNER_ROUTE = "/plan";

interface GateStatus {
  gateMode: string;
  isPremium: boolean;
  hasCreatedFirstWeeklyPlan: boolean;
  hasTriedFirstFoodSnap: boolean;
  hardLockedAfterAdviceDismiss: boolean;
  features: Record<string, { allowed: boolean; showPaywall?: boolean; lockApp?: boolean; isFreeAction?: boolean }>;
}

interface GateContextType {
  gate: GateStatus | null;
  isLocked: boolean;
  showPaywall: (onSuccess?: () => void) => void;
  // Returns the underlying TanStack Query refetch promise. Consumers
  // can `await` it (handleAutoFocusSheetDismiss does), attach `.catch`
  // for fire-and-forget telemetry (first-plan immediate path does), or
  // ignore the return value entirely (snap.tsx call sites).
  refetchGate: () => Promise<unknown>;
  // Returns the current value of App-level `paywallInFlightRef`. We
  // expose this as a getter (not a value) because the underlying
  // signal is a ref — components that need to read it from inside an
  // effect or timer body should call this on demand. It is NOT
  // reactive: don't put it in a dep array.
  isPaywallInFlight: () => boolean;
}

const GateContext = createContext<GateContextType>({
  gate: null,
  isLocked: false,
  showPaywall: () => {},
  refetchGate: () => Promise.resolve(),
  isPaywallInFlight: () => false,
});

export function useGate() {
  return useContext(GateContext);
}

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } = useQuery({ queryKey: ["/api/profile"] });
  const { data: currentPlan, isLoading: planLoading } = useQuery({
    queryKey: ["/api/plan/current"],
    enabled: !!profile,
  });

  const { data: gateStatus, refetch: refetchGate } = useQuery<GateStatus>({
    queryKey: ["/api/gate-status"],
    enabled: !!(profile as any)?.onboardingComplete,
  });

  const { data: devCheck } = useQuery<{ isDev: boolean }>({
    queryKey: ["/api/dev/check"],
  });

  const pendingActionRef = useRef<(() => void) | null>(null);

  // Latest RevenueCat customerId reported by the native bridge after
  // login/restore. We attach this to every refreshPremiumThenRefetch
  // call so the server can persist it on the user profile and key the
  // shared daily snap quota by App Store subscription instead of by
  // Glukky userId. Lives in a ref because it's not used for rendering.
  const bridgeCustomerIdRef = useRef<string | null>(null);

  // Branded overlay shown immediately after the paywall returns purchased/restored, until the server-side verify resolves.
  const [unlockingOverlay, setUnlockingOverlay] = useState(false);
  // Background re-verify poller for the "Apple sheet says success, RC propagation is slow" case.
  // After the fast 3-retry burst (~4.5s) gives up, this keeps polling every 3s for up to 60s
  // so the user reliably unlocks without having to close and reopen the app.
  const verifyPollerRef = useRef<{ cancel: () => void } | null>(null);

  // Defense-in-depth freeze flag: while the RC paywall sheet is on
  // screen we don't want the lock-app redirect or the route-change-
  // cancel effect to fire. We MUST use a ref (not useState) because
  // both gating effects read this flag in their bodies and adding it
  // to their dep arrays would re-fire the effect on the true → false
  // transition — at that exact moment a fire-and-forget background
  // poller may have just taken over, and pendingActionRef.current
  // still holds the snap-advice resume callback. The route-change-
  // cancel effect would then nuke the callback (the ggg regression
  // we are fixing). A ref bypasses the dep array entirely.
  const paywallInFlightRef = useRef(false);

  // Exit-warning popup state — shown after the snap-advice paywall is
  // dismissed by a user with both activation milestones already done.
  const [exitWarningOpen, setExitWarningOpen] = useState(false);
  const exitWarningOnSuccessRef = useRef<(() => void) | null>(null);

  // Visual continuity scrim shown the instant the RC native paywall
  // closes (in the both-milestones-done branch) so the user does not
  // see a flash of the underlying app screen between the native
  // sheet's close animation and the AlertDialog mounting on top.
  // Rendered at z-40 (the AlertDialog overlay+content live at z-50
  // per alert-dialog.tsx — one tier above the scrim). True
  // "popup on top of the native paywall" is infeasible with the
  // BuildNatively bridge (RC paywall is a native iOS modal sheet
  // outside the WebView; BN exposes no native dialog primitive),
  // so this perceptual masking is the user-approved next-best.
  const [exitWarningBackdropOpen, setExitWarningBackdropOpen] = useState(false);

  const isLocked = !!(gateStatus && !gateStatus.isPremium && Object.values(gateStatus.features).some((f) => f.lockApp));

  // Server is the source of truth via verifyEntitlement(replitUserId); we never send a client-side premium flag.
  // Post-purchase callers pass retries (RC entitlement propagation can lag StoreKit by a few seconds).
  const refreshPremiumThenRefetch = useCallback(async (
    force = false,
    opts: { retries?: number; backoffMs?: number; customerId?: string; recentPurchase?: boolean } = {},
  ): Promise<boolean> => {
    const retries = Math.max(0, opts.retries ?? 0);
    const backoffMs = Math.max(0, opts.backoffMs ?? 1500);
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    let verified = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const body: Record<string, unknown> = {};
        if (force) body.force = true;
        // #581: post-purchase verifies opt into a server-side single
        // retry that handles RC entitlement propagation lag. Routine
        // refreshes (boot, foreground, gate checks) leave it off so
        // they never pay the 1.5s wait.
        if (opts.recentPurchase) body.recentPurchase = true;
        // Default the customerId from the most recent bridge login result
        // when the caller didn't explicitly pass one. This makes EVERY
        // refresh (boot, foreground, gate check) participate in the
        // shared-quota mechanism, not just the post-purchase path.
        const effectiveCustomerId = opts.customerId ?? bridgeCustomerIdRef.current ?? undefined;
        if (effectiveCustomerId) body.customerId = effectiveCustomerId;
        const resp = await fetch("/api/refresh-premium-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (resp.ok) {
          const data = await resp.json();
          verified = Boolean(data?.verifiedPremium ?? data?.isPremium);
          if (verified) break;
        }
      } catch (e) {
        console.warn(`[premium] refresh error (attempt ${attempt + 1}/${retries + 1}):`, e);
      }
      if (attempt < retries) await wait(backoffMs);
    }

    // Always refetch local caches even when verified=false (gate/profile may have changed for other reasons).
    // Awaited so the overlay stays up through full cache propagation, not just the verify call.
    // currentPlan is refetched so the gated tree has fresh plan data
    // the instant `isLocked` flips false.
    await Promise.all([
      refetchGate(),
      queryClient.refetchQueries({ queryKey: ["/api/profile"] }),
      queryClient.refetchQueries({ queryKey: ["/api/plan/current"] }),
    ]);
    return verified;
  }, [refetchGate]);

  // Cancel any in-flight background verify poll. Safe to call repeatedly.
  // When `clearPending` is true and a poller was actually running, also
  // drop any pending resume action so it can't fire later (used by the
  // terminal cancellations: logout, visibility-hidden, supersession,
  // and route change). The default (false) preserves pendingActionRef
  // so that verifyWithOverlay's preparatory cancel — which happens in
  // the middle of a live showPaywall flow — doesn't lose the resume
  // we just queued.
  const cancelBackgroundVerifyPoller = useCallback(
    (opts: { clearPending?: boolean } = {}) => {
      const wasRunning = verifyPollerRef.current !== null;
      verifyPollerRef.current?.cancel();
      verifyPollerRef.current = null;
      if (wasRunning && opts.clearPending) {
        pendingActionRef.current = null;
      }
    },
    [],
  );

  // Long-tail background poller. Used after the fast 3-retry burst gives
  // up — RC sandbox propagation can take 30-60s longer than the 4.5s
  // burst window and historically the only thing that rescued the user
  // was the next foreground refresh ("close the app and reopen"). This
  // keeps the unlocking overlay up and polls verify every few seconds
  // for up to 60s so the user reliably unlocks without manual recovery.
  // Single-flight: any prior poller is cancelled when a new one starts.
  const startBackgroundVerifyPoller = useCallback(() => {
    // Supersession: if a previous poller is still running, treat this
    // as a hard cancel and drop its pending resume so the prior flow
    // can't fire into a newer/unrelated session. In normal showPaywall
    // flows this is a no-op (verifyWithOverlay's preparatory cancel
    // already cleared the poller); this is defense-in-depth.
    cancelBackgroundVerifyPoller({ clearPending: true });
    let cancelled = false;
    const handle = { cancel: () => { cancelled = true; } };
    verifyPollerRef.current = handle;

    const POLL_INTERVAL_MS = 3_000;
    const MAX_DURATION_MS = 60_000;
    const startedAt = Date.now();
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    setUnlockingOverlay(true);
    (async () => {
      try {
        while (!cancelled && Date.now() - startedAt < MAX_DURATION_MS) {
          await wait(POLL_INTERVAL_MS);
          if (cancelled) return;
          const verified = await refreshPremiumThenRefetch(true);
          if (verified) {
            console.log(`[premium] background poller verified after ${Date.now() - startedAt}ms`);
            // Fire the resume action carried over from the showPaywall
            // flow (e.g. retry the snap-advice call that originally
            // tripped the gate). Single-shot: clear the ref before
            // scheduling so a later run can't double-fire it. The
            // ~100ms delay matches the fast-burst path so the
            // unlocking overlay clears first.
            const action = pendingActionRef.current;
            if (action) {
              pendingActionRef.current = null;
              track("snap_advice_resumed_via_background_poller", {
                elapsedMs: Date.now() - startedAt,
              });
              track("paywall_advice_resume_fired", {
                source: "background_poller",
                elapsedMs: Date.now() - startedAt,
              });
              setTimeout(action, 100);
            } else {
              track("paywall_advice_resume_skipped", {
                source: "background_poller",
                reason: "no_pending_action",
              });
            }
            return;
          }
        }
        if (!cancelled) {
          console.warn(`[premium] background poller hit ${MAX_DURATION_MS}ms cap without verify`);
          // 60s timeout — no verify, so the resume must not fire.
          if (pendingActionRef.current) {
            track("paywall_advice_resume_skipped", {
              source: "background_poller",
              reason: "timeout",
              elapsedMs: Date.now() - startedAt,
            });
          }
          pendingActionRef.current = null;
        }
      } finally {
        // Skip clearing the overlay ONLY if a newer poller has
        // taken ownership (ref is a different non-null handle) —
        // that newer run will manage the overlay itself, and
        // clearing here would hide its in-flight unlocking UI.
        // If the ref is this handle (still current) OR null
        // (cancelled by logout / visibility-hidden / verifyWithOverlay
        // takeover), clear so the overlay doesn't get stuck up.
        const current = verifyPollerRef.current;
        if (current === handle || current === null) {
          if (current === handle) verifyPollerRef.current = null;
          setUnlockingOverlay(false);
        }
      }
    })();
  }, [cancelBackgroundVerifyPoller, refreshPremiumThenRefetch]);

  // Cancel the background poller on logout/page-hide/route-change so
  // we don't poll indefinitely against a backgrounded app, a signed-out
  // session, or a page the user has moved on from. Each of these also
  // drops any pending resume action (e.g. snap-advice retry) via
  // `clearPending: true` so it can't fire later into a stale context.
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === "hidden") {
        cancelBackgroundVerifyPoller({ clearPending: true });
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [cancelBackgroundVerifyPoller]);
  useEffect(() => {
    if (!user?.id) cancelBackgroundVerifyPoller({ clearPending: true });
  }, [user?.id, cancelBackgroundVerifyPoller]);
  // Defense-in-depth: the unlocking overlay normally blocks navigation,
  // but if the route changes while a poller/resume is in flight (e.g.
  // programmatic navigation, deep link), drop them so the resume can't
  // fire into a different page than where the user originally hit the
  // gate.
  //
  // Freeze guard: while the RC paywall sheet is in flight, skip this
  // entire body. Read the flag via REF (not state, not in deps) so a
  // true → false transition in showPaywall's finally block can't cause
  // this effect to re-fire and clear pendingActionRef just as the
  // background poller is taking over (the ggg regression).
  useEffect(() => {
    if (paywallInFlightRef.current) return;
    if (verifyPollerRef.current || pendingActionRef.current) {
      if (pendingActionRef.current) {
        track("paywall_advice_resume_skipped", {
          source: "route_change_cancel",
          reason: "route_changed",
        });
      }
      cancelBackgroundVerifyPoller({ clearPending: true });
      pendingActionRef.current = null;
    }
  }, [location, cancelBackgroundVerifyPoller]);

  // Wraps the verify+refetch in the branded overlay. After the fast
  // 3-retry burst gives up, optionally hands off to the background
  // poller (`backgroundPollOnFail`) so a slow RC propagation still
  // self-heals within ~60s instead of leaving the user stuck. The
  // toast fallback is reserved for callers that DON'T background-poll
  // (manual retry surface).
  const verifyWithOverlay = useCallback(async (
    opts: { backgroundPollOnFail?: boolean; customerId?: string } = {},
  ): Promise<boolean> => {
    cancelBackgroundVerifyPoller();
    setUnlockingOverlay(true);
    let verified = false;
    let pollerStarted = false;
    try {
      verified = await refreshPremiumThenRefetch(true, {
        retries: 2,
        backoffMs: 1500,
        customerId: opts.customerId,
        // #581: this is the explicit post-purchase verify. Flag the
        // server so the first attempt also gets a single propagation
        // retry, on top of the client-side retries here.
        recentPurchase: true,
      });
      if (!verified) {
        if (opts.backgroundPollOnFail) {
          // Hand off to the background poller — it manages the overlay
          // and will keep polling for up to 60s. Don't show the stalled
          // toast in this branch; the overlay communicates progress.
          startBackgroundVerifyPoller();
          pollerStarted = true;
        } else {
          toast({
            title: t("paywall.unlocking_stalled_title"),
            description: t("paywall.unlocking_stalled_desc"),
            duration: 8000,
            action: (
              <ToastAction
                altText={t("paywall.unlocking_stalled_action")}
                onClick={() => { void verifyWithOverlay(opts); }}
                data-testid="button-unlocking-retry"
              >
                {t("paywall.unlocking_stalled_action")}
              </ToastAction>
            ),
          });
        }
      }
      return verified;
    } finally {
      // Only clear overlay when we're not handing off to the poller —
      // the poller takes ownership of the overlay state.
      if (!pollerStarted) setUnlockingOverlay(false);
    }
  }, [
    refreshPremiumThenRefetch,
    toast,
    t,
    cancelBackgroundVerifyPoller,
    startBackgroundVerifyPoller,
  ]);

  // Centralised dismiss-routing for the soft paywall. Decides where
  // the user should land based on activation milestones:
  //   • premium                       → no-op
  //   • hardLockedAfterAdviceDismiss  → /profile (lock-app re-presents)
  //   • !hasCreatedFirstWeeklyPlan    → /plan (so they finish onboarding)
  //   • !hasTriedFirstFoodSnap        → /snap (so they finish activation)
  //   • both done                     → POST hard-lock {optedOut:true}
  //                                     and surface our exit-warning
  //                                     AlertDialog. If the POST fails
  //                                     we fall back to /profile so the
  //                                     lock-app effect can still surface
  //                                     the hard RC paywall, instead of
  //                                     stranding the user on /snap.
  //
  // We AWAIT a fresh refetchGate() at the top so milestone flips that
  // happened while the RC sheet was on screen (e.g. the second
  // snap-advice attempt that just set hasTriedFirstFoodSnap=true on
  // the server) are visible here. The closed-over `gateStatus` is the
  // graceful fallback if the refetch errors — we degrade to the last
  // known state instead of throwing past the user.
  const handlePaywallDismiss = useCallback(async (originalOnSuccess?: () => void) => {
    let g: GateStatus | undefined = gateStatus;
    let gateStatusSource: "fresh" | "stale_fallback" = "stale_fallback";
    try {
      const refreshed = await refetchGate();
      if (refreshed.data) {
        g = refreshed.data;
        gateStatusSource = "fresh";
      }
    } catch {
      // Fall through with the closed-over gateStatus.
    }

    if (g?.isPremium) return;

    // Hard lock B: user already opted out once. They cannot de-escalate
    // back through the popup — every dismiss anchors them on /profile so
    // the lock-app effect re-presents the (closable, profile-only) hard
    // paywall via the existing path. Do NOT show the exit-warning popup
    // here, do NOT POST {optedOut:false}.
    if (g?.hardLockedAfterAdviceDismiss) {
      track("paywall_dismiss_route", {
        destination: "/profile",
        reason: "hard_lock",
        gateStatusSource,
        hasCreatedFirstWeeklyPlan: g.hasCreatedFirstWeeklyPlan,
        hasTriedFirstFoodSnap: g.hasTriedFirstFoodSnap,
        hardLockedAfterAdviceDismiss: true,
        isPremium: g.isPremium,
      });
      pendingActionRef.current = null;
      if (location !== "/profile") setLocation("/profile");
      return;
    }

    if (!g?.hasCreatedFirstWeeklyPlan) {
      track("paywall_dismiss_route", {
        destination: PLANNER_ROUTE,
        gateStatusSource,
        hasCreatedFirstWeeklyPlan: g?.hasCreatedFirstWeeklyPlan ?? false,
        hasTriedFirstFoodSnap: g?.hasTriedFirstFoodSnap ?? false,
        hardLockedAfterAdviceDismiss: g?.hardLockedAfterAdviceDismiss ?? false,
        isPremium: g?.isPremium ?? false,
      });
      pendingActionRef.current = null;
      if (location !== PLANNER_ROUTE) setLocation(PLANNER_ROUTE);
      return;
    }

    if (!g.hasTriedFirstFoodSnap) {
      track("paywall_dismiss_route", {
        destination: "/snap",
        gateStatusSource,
        hasCreatedFirstWeeklyPlan: g.hasCreatedFirstWeeklyPlan,
        hasTriedFirstFoodSnap: g.hasTriedFirstFoodSnap,
        hardLockedAfterAdviceDismiss: g.hardLockedAfterAdviceDismiss,
        isPremium: g.isPremium,
      });
      pendingActionRef.current = null;
      if (location !== "/snap") setLocation("/snap");
      return;
    }

    track("paywall_dismiss_route", {
      destination: "exit_warning",
      gateStatusSource,
      hasCreatedFirstWeeklyPlan: g.hasCreatedFirstWeeklyPlan,
      hasTriedFirstFoodSnap: g.hasTriedFirstFoodSnap,
      hardLockedAfterAdviceDismiss: g.hardLockedAfterAdviceDismiss,
      isPremium: g.isPremium,
    });

    // Drop the visual continuity scrim immediately — BEFORE the
    // awaited hard-lock POST — so the bare app screen is never
    // visible between the native paywall close and the AlertDialog
    // mount. The POST below takes ~50-300ms and used to be the
    // primary source of the flash the user complained about.
    setExitWarningBackdropOpen(true);
    track("paywall_exit_warning_backdrop_shown");

    try {
      // Persist hard-lock BEFORE showing the popup so closing the app
      // or losing connection mid-popup still ends up in hard lock B.
      await apiRequest("POST", "/api/profile/hard-lock", { optedOut: true });
      exitWarningOnSuccessRef.current = originalOnSuccess || null;
      setExitWarningOpen(true);
      track("paywall_exit_warning_shown", {
        hadStashedOnSuccess: !!originalOnSuccess,
      });
    } catch (e) {
      // apiRequest throws Error(`${status}: ${text}`) — parse the
      // leading status so the dashboard can distinguish 4xx (bad
      // body) from 5xx (server crash) from network errors (NaN).
      const message = e instanceof Error ? e.message : String(e);
      const statusMatch = /^(\d{3}):/.exec(message);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      track("paywall_exit_warning_post_failed", {
        status,
        message,
        hadStashedOnSuccess: !!originalOnSuccess,
      });
      // Spec'd fallback: clear pending resume and route to /profile so
      // the existing hard-paywall path takes over (avoids ambiguous
      // soft-A state with no popup surfaced).
      pendingActionRef.current = null;
      // Hide the scrim — the dialog will never mount on this branch,
      // and /profile's hard paywall takes over the screen on its own.
      setExitWarningBackdropOpen(false);
      track("paywall_exit_warning_backdrop_hidden", { reason: "post_failed" });
      if (location !== "/profile") setLocation("/profile");
    }
  }, [gateStatus, refetchGate, location, setLocation]);

  // The BN bridge owns the StoreKit transaction; the purchased/restored callback is a hint — server verify is proof.
  // Sets `paywallInFlightRef` for the duration of the RC sheet so the
  // lock-app and route-change-cancel effects don't fire mid-paywall.
  const showPaywall = useCallback((onSuccess?: () => void) => {
    pendingActionRef.current = onSuccess || null;
    paywallInFlightRef.current = true;
    track("paywall_shown");
    presentPaywall()
      .then(async (result) => {
        if (result.status === "BRIDGE_MISSING") {
          console.warn(
            "[paywall] BN bridge missing — web preview cannot present the hosted paywall.",
          );
          track("paywall_dismissed", { reason: "bridge_missing" });
          pendingActionRef.current = null;
          return;
        }
        if (
          result.status === "SUCCESS" &&
          (result.message === "purchased" || result.message === "restored")
        ) {
          track("paywall_purchase_attempt", { outcome: result.message });
          // Bridge confirmed purchase/restore — keep polling in the
          // background past the fast burst so a slow RC propagation
          // still unlocks the user without a force-quit.
          const verified = await verifyWithOverlay({ backgroundPollOnFail: true });
          track(verified ? "paywall_purchase_verified" : "paywall_purchase_unverified", {
            outcome: result.message,
          });
          if (verified) {
            // Fast-burst happy path — fire resume immediately (single-shot).
            if (pendingActionRef.current) {
              const action = pendingActionRef.current;
              pendingActionRef.current = null;
              track("paywall_advice_resume_fired", { source: "fast_burst" });
              setTimeout(action, 100);
            } else {
              track("paywall_advice_resume_skipped", {
                source: "fast_burst",
                reason: "no_pending_action",
              });
            }
          } else if (verifyPollerRef.current) {
            // Fast burst gave up but the background poller has taken
            // over. Keep pendingActionRef alive — the poller will fire
            // it on success, or clear it on its terminal states (60s
            // timeout, logout, visibility-hidden).
          } else {
            // Verify failed and no poller is running (shouldn't happen
            // on this branch since backgroundPollOnFail is true, but
            // keep the safe default so we don't leak a stale resume).
            if (pendingActionRef.current) {
              track("paywall_advice_resume_skipped", {
                source: "fast_burst",
                reason: "verify_failed_no_poller",
              });
            }
            pendingActionRef.current = null;
          }
        } else {
          track("paywall_dismissed", { status: result.status, message: result.message });
          // Stash the resume callback BEFORE we clear pendingActionRef
          // so the dismiss-routing helper can hand it to the exit-
          // warning popup (the user may click Stay → re-present → buy).
          const stashedOnSuccess = pendingActionRef.current;
          pendingActionRef.current = null;
          await handlePaywallDismiss(stashedOnSuccess || undefined);
        }
      })
      .catch((e) => {
        console.warn("[paywall] present error:", e);
        track("paywall_error", { message: e instanceof Error ? e.message : String(e) });
        pendingActionRef.current = null;
      })
      .finally(() => {
        paywallInFlightRef.current = false;
      });
  }, [verifyWithOverlay, handlePaywallDismiss]);

  // Stay → re-POST {optedOut:false}, refetch gate, close the dialog,
  // then re-present the RC paywall after a short delay so the Radix
  // exit animation has time to clear (avoids RC sheet appearing behind
  // the still-animating dialog on some iOS versions).
  const handleExitWarningStay = useCallback(async () => {
    track("paywall_exit_warning_stay");
    try {
      await apiRequest("POST", "/api/profile/hard-lock", { optedOut: false });
    } catch (e) {
      track("paywall_exit_warning_stay_error", { message: String(e) });
    }
    try { await refetchGate(); } catch {}
    setExitWarningOpen(false);
    const onSuccess = exitWarningOnSuccessRef.current;
    exitWarningOnSuccessRef.current = null;
    setTimeout(() => showPaywall(onSuccess || undefined), 250);
    // Keep the scrim up across the dialog→paywall handoff so the bare
    // app screen never reappears between the AlertDialog close and
    // the native RC sheet taking over (~250ms re-present + a buffer
    // for the sheet's open animation). 600ms covers both comfortably.
    setTimeout(() => {
      setExitWarningBackdropOpen(false);
      track("paywall_exit_warning_backdrop_hidden", { reason: "stay" });
    }, 600);
  }, [refetchGate, showPaywall]);

  // Leave (or backdrop tap) → keep hard-lock flag set, drop any
  // pending resume, refetch gate (so isLocked becomes true), and
  // route to /profile where the lock-app effect re-presents the
  // hard RC paywall.
  const handleExitWarningLeave = useCallback(async () => {
    track("paywall_exit_warning_leave");
    pendingActionRef.current = null;
    exitWarningOnSuccessRef.current = null;
    setExitWarningOpen(false);
    // Drop the scrim immediately — the user is being routed to
    // /profile and the lock-app effect will re-present the hard
    // paywall there. Holding the scrim would only delay the visual
    // handoff to /profile.
    setExitWarningBackdropOpen(false);
    track("paywall_exit_warning_backdrop_hidden", { reason: "leave" });
    try { await refetchGate(); } catch {}
    if (location !== "/profile") setLocation("/profile");
  }, [refetchGate, location, setLocation]);

  // Defensive cleanup: if the dialog ever closes via a path that
  // doesn't go through Stay/Leave (future programmatic close, Radix
  // edge case, etc.), make sure the scrim can never get stuck on
  // screen. The Stay handler intentionally keeps the scrim up for
  // 600ms after closing the dialog, so this watchdog uses a 1s grace
  // period to avoid racing it.
  useEffect(() => {
    if (exitWarningOpen || !exitWarningBackdropOpen) return;
    const t = setTimeout(() => {
      setExitWarningBackdropOpen(false);
      track("paywall_exit_warning_backdrop_hidden", { reason: "cleanup" });
    }, 1000);
    return () => clearTimeout(t);
  }, [exitWarningOpen, exitWarningBackdropOpen]);

  // Identify the user to RC once Replit auth resolves; flips to logout on auth-away so the next user's purchase isn't merged.
  // Declared before the lock/paywall effect so login starts before any paywall presentation.
  const lastRcUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = user?.id ?? null;
    const previousId = lastRcUserIdRef.current;

    if (previousId && previousId !== currentId) {
      resetUser();
      logoutFromRevenueCat().catch((e) => console.warn("[rc] logout failed:", e));
      // Drop the previous user's customerId immediately so the brief
      // gap before the new login completes can't accidentally attach
      // the old subscription's id to the new account's refresh.
      bridgeCustomerIdRef.current = null;
    }

    if (currentId) {
      identifyUser(currentId, {
        email: user?.email ?? undefined,
        is_premium: gateStatus?.isPremium ?? undefined,
      });
      loginToRevenueCat(currentId, user?.email ?? "").then((result) => {
        // Capture the bridge-reported customerId so every subsequent
        // refreshPremiumThenRefetch attaches it. Stable across the
        // session — RC re-aliases anon → userId after login but the
        // customerId returned here is already the post-login one.
        if (result.customerId) {
          bridgeCustomerIdRef.current = result.customerId;
          // Force a refresh now to push the customerId to the server in
          // this session. Without this, the boot-time refresh that
          // fires on onboardingComplete can race ahead of bridge login
          // and the first session's snaps would be keyed by userId
          // until the next foreground refresh. force=true bypasses
          // the 30s entitlement cache server-side so the verify
          // actually re-fetches RC and surfaces the authoritative
          // originalAppUserId for persistence — without it, an earlier
          // cached `not_found` would short-circuit the persist.
          // Fire-and-forget; treated as best-effort by the handler.
          void refreshPremiumThenRefetch(true, { customerId: result.customerId });
        }
        if (result.status !== "SUCCESS" && result.status !== "BRIDGE_MISSING") {
          console.warn(
            `[rc] login result: status=${result.status}` +
              (result.error ? ` error=${result.error}` : ""),
          );
        }
      });
    } else {
      // Full logout — clear the ref so the next user starts fresh.
      bridgeCustomerIdRef.current = null;
    }

    lastRcUserIdRef.current = currentId;
  }, [user?.id, user?.email]);

  // Lock-app gate: present the hosted paywall (no close button) and anchor /profile as a fallback when presentation fails.
  // The ref is a one-shot guard so route changes don't re-present; reset on isLocked=false.
  //
  // Freeze guard: while the RC paywall sheet is in flight, skip the
  // entire body so we don't redirect mid-purchase. Read via REF (not
  // state, not deps) — adding the flag to deps would re-fire on the
  // true → false transition and could double-present the hard paywall
  // if isLocked flipped during the in-flight window.
  const lockedPaywallShownRef = useRef(false);
  useEffect(() => {
    if (paywallInFlightRef.current) return;
    if (!isLocked) {
      lockedPaywallShownRef.current = false;
      return;
    }
    if (location !== "/profile") {
      setLocation("/profile");
    }
    if (lockedPaywallShownRef.current) return;
    lockedPaywallShownRef.current = true;
    // Own the in-flight window like `showPaywall` does so the
    // route-change-cancel effect and this effect itself can't re-fire
    // mid-verify. Cleared in `finally` once verify settles. The hard
    // paywall has no pre-paywall stash to return to — the user is
    // already on /profile and stays there after unlock.
    paywallInFlightRef.current = true;
    track("paywall_lockapp_present");
    presentPaywallIfNeeded("Premium", { showCloseButton: false })
      .then(async (result) => {
        if (result.status !== "SUCCESS") {
          track("paywall_lockapp_dismissed", {
            status: result.status,
            message: result.message,
          });
          return;
        }
        if (result.message === "purchased" || result.message === "restored") {
          track("paywall_lockapp_purchase_attempt", { outcome: result.message });
          const verified = await verifyWithOverlay({ backgroundPollOnFail: true });
          track(
            verified
              ? "paywall_lockapp_purchase_verified"
              : "paywall_lockapp_purchase_unverified",
            { outcome: result.message },
          );
          // Reset the one-shot guard so a later re-lock cycle in the
          // same session can re-present.
          if (verified) lockedPaywallShownRef.current = false;
        } else if (result.message === "not_presented") {
          track("paywall_lockapp_not_presented");
          const verified = await verifyWithOverlay();
          track(
            verified
              ? "paywall_lockapp_not_presented_verified"
              : "paywall_lockapp_not_presented_unverified",
          );
          if (verified) lockedPaywallShownRef.current = false;
        }
      })
      .catch((e) => {
        track("paywall_lockapp_error", {
          message: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => {
        paywallInFlightRef.current = false;
      });
  }, [isLocked, location, setLocation, verifyWithOverlay]);

  useEffect(() => {
    if (!(profile as any)?.onboardingComplete) return;
    refreshPremiumThenRefetch();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPremiumThenRefetch();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [(profile as any)?.onboardingComplete, refreshPremiumThenRefetch]);

  useBounceScroll();

  useEffect(() => {
    if ((profile as any)?.preferredLanguage) {
      i18n.changeLanguage((profile as any).preferredLanguage);
    }
  }, [(profile as any)?.preferredLanguage]);

  useEffect(() => {
    const pref = (profile as any)?.fontSizePreference;
    if (pref === "small") {
      document.documentElement.classList.add("font-small");
    } else {
      document.documentElement.classList.remove("font-small");
    }
  }, [(profile as any)?.fontSizePreference]);

  useEffect(() => {
    if (!profile || !(profile as any).onboardingComplete) return;

    const userId = (profile as any).userId;
    const cacheKey = `glukky_onesignal_pid_${userId}`;
    const externalIdCacheKey = `glukky_onesignal_external_id_${userId}`;
    let cancelled = false;
    let registeredViaMessage = false;
    let externalIdAttempted = false;

    const resolveTimezone = (): string => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return tz && tz.length > 0 ? tz : "UTC";
      } catch {
        return "UTC";
      }
    };

    const registerPlayerId = async (
      playerId: string,
      source: string,
    ): Promise<boolean> => {
      const cached = localStorage.getItem(cacheKey);
      if (cached === playerId) {
        console.log("[onesignal] already cached, skipping registration");
        return true;
      }
      const resp = await fetch("/api/onesignal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playerId,
          source,
          timezone: resolveTimezone(),
        }),
      });
      if (resp.ok) {
        localStorage.setItem(cacheKey, playerId);
        console.log("[onesignal] registered successfully:", playerId, "source:", source);
        return true;
      }
      const text = await resp.text().catch(() => "");
      console.warn("[onesignal] registration failed:", resp.status, text);
      return false;
    };

    const onMessage = async (event: MessageEvent) => {
      if (registeredViaMessage || cancelled) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const id = data?.oneSignalId || data?.playerId || data?.onesignal_player_id || data?.id;
        if (id && typeof id === "string" && id.length > 10) {
          console.log("[onesignal] received player ID via message event:", id);
          const success = await registerPlayerId(id, "bridge_message");
          if (success) registeredViaMessage = true;
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);

    // Persist the wrapper-confirmed external_id (= app user id) on
    // the server profile. The pre-scheduler prefers the alias path
    // over the player_id path so OneSignal can deliver sends even
    // after a subscription id rotation. Local cache prevents a
    // second POST for the same value across reloads.
    const persistExternalId = async (source: string): Promise<boolean> => {
      const cached = localStorage.getItem(externalIdCacheKey);
      if (cached === userId) return true;
      try {
        const resp = await fetch("/api/onesignal/external-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ externalId: userId, source }),
        });
        if (resp.ok) {
          localStorage.setItem(externalIdCacheKey, userId);
          console.log("[onesignal] external_id persisted source:", source);
          return true;
        }
        const text = await resp.text().catch(() => "");
        console.warn("[onesignal] external_id persist failed:", resp.status, text);
      } catch (e) {
        console.warn("[onesignal] external_id persist error:", e);
      }
      return false;
    };

    // Probe both common shapes of setExternalId on the wrapper
    // (callback-shaped on NativelyNotifications, promise-shaped
    // fallback). On either success we persist the id server-side.
    // This runs once per session — successive attempts are no-ops
    // because the cached check above short-circuits.
    const trySetExternalIdOnBridge = async (): Promise<boolean> => {
      if (externalIdAttempted) return false;
      externalIdAttempted = true;
      const w = window as any;
      let bridgeOk = false;

      if (w.NativelyNotifications) {
        try {
          const notif = new w.NativelyNotifications();
          if (typeof notif.setExternalId === "function") {
            const result: any = await new Promise((resolve) => {
              const t = setTimeout(() => resolve("__timeout__"), 6000);
              try {
                let directReturn: any;
                try {
                  directReturn = notif.setExternalId(
                    { externalId: userId },
                    (res: any) => { clearTimeout(t); resolve(res); },
                  );
                } catch {
                  // Some implementations take just the object.
                  directReturn = notif.setExternalId({ externalId: userId });
                }
                if (directReturn && typeof directReturn.then === "function") {
                  directReturn
                    .then((v: any) => { clearTimeout(t); resolve(v); })
                    .catch((e: any) => { clearTimeout(t); resolve({ __throw: e?.message ?? String(e) }); });
                }
              } catch (e: any) {
                clearTimeout(t);
                resolve({ __throw: e?.message ?? String(e) });
              }
            });
            console.log("[onesignal] setExternalId via NativelyNotifications:", typeof result === "string" ? result : JSON.stringify(result));
            if (result !== "__timeout__" && !(result && (result as any).__throw)) {
              bridgeOk = true;
            }
          }
        } catch (e: any) {
          console.warn("[onesignal] NativelyNotifications.setExternalId error:", e?.message ?? e);
        }
      }

      if (!bridgeOk && w.NativelyPush) {
        try {
          const push = new w.NativelyPush();
          if (typeof push.setExternalId === "function") {
            let directReturn: any;
            try { directReturn = push.setExternalId({ externalId: userId }); } catch {}
            const result: any =
              directReturn && typeof directReturn.then === "function"
                ? await Promise.race([
                    directReturn,
                    new Promise((r) => setTimeout(() => r("__timeout__"), 6000)),
                  ])
                : directReturn;
            console.log("[onesignal] setExternalId via NativelyPush:", typeof result === "string" ? result : JSON.stringify(result));
            if (result !== "__timeout__") bridgeOk = true;
          }
        } catch (e: any) {
          console.warn("[onesignal] NativelyPush.setExternalId error:", e?.message ?? e);
        }
      }

      // Only persist server-side when the bridge actually
      // confirmed the alias-subscription association. Persisting
      // on bridge failure would route the pre-scheduler to the
      // alias path (it prefers external_id over player_id) before
      // OneSignal knows about the alias, silently dropping
      // notifications. On bridge failure we leave the server
      // unconfigured for alias and the player_id fallback path
      // continues to handle delivery.
      if (bridgeOk) {
        await persistExternalId("bridge_set");
      } else {
        console.log("[onesignal] external_id NOT persisted: bridge did not confirm setExternalId");
      }
      return bridgeOk;
    };

    // Per task #493 step 1: structured probe of every bridge path
    // we know about. Tracks (per path) whether the method exists,
    // whether it returned a Promise (so we don't `await` a callback
    // and silently get undefined), the raw result, and the
    // extracted id. Also captures the OS push-permission state so
    // "denied by user" is visually distinct from "bridge returned
    // nothing." The whole result is POSTed to the dev-gated probe
    // endpoint so the server logs show the actual problem device's
    // bridge state without requiring the dev panel to be open.
    type ProbePath = {
      name: string;
      methodPresent: boolean | null;
      promiseShaped: boolean | null;
      raw: unknown;
      extractedId: string | null;
      error: string | null;
    };
    type ProbePermission = { state: string | null; raw: unknown; source: string | null };

    const detectPushPermission = async (): Promise<ProbePermission> => {
      const w = window as any;
      try {
        if (w.NativelyNotifications) {
          const n = new w.NativelyNotifications();
          for (const m of [
            "getNotificationPermissionStatus",
            "getPermissionStatus",
            "getPermission",
            "hasPermission",
          ]) {
            if (typeof n?.[m] === "function") {
              try {
                const res: any = await new Promise((resolve) => {
                  const t = setTimeout(() => resolve("__timeout__"), 4000);
                  let returned: any;
                  try {
                    returned = n[m]((cb: any) => {
                      clearTimeout(t);
                      resolve(cb);
                    });
                  } catch (e: any) {
                    clearTimeout(t);
                    resolve({ __throw: e?.message ?? String(e) });
                    return;
                  }
                  if (returned && typeof returned.then === "function") {
                    returned.then((v: any) => { clearTimeout(t); resolve(v); }).catch((e: any) => { clearTimeout(t); resolve({ __throw: e?.message ?? String(e) }); });
                  }
                });
                const text = typeof res === "string" ? res : JSON.stringify(res);
                let state: string | null = null;
                if (typeof res === "string") state = res;
                else if (res && typeof res === "object") {
                  state = res.state ?? res.status ?? res.permission ?? res.value ?? null;
                  if (typeof state !== "string") state = null;
                }
                return { state, raw: text, source: `NativelyNotifications.${m}` };
              } catch (e: any) {
                return { state: "error", raw: e?.message ?? String(e), source: `NativelyNotifications.${m}` };
              }
            }
          }
        }
        if (w.NativelyPush) {
          const p = new w.NativelyPush();
          for (const m of ["getNotificationPermissionStatus", "getPermissionStatus", "hasPermission"]) {
            if (typeof p?.[m] === "function") {
              try {
                const res = await p[m]();
                const text = typeof res === "string" ? res : JSON.stringify(res);
                const state = typeof res === "string" ? res : (res?.state ?? res?.status ?? null);
                return { state: typeof state === "string" ? state : null, raw: text, source: `NativelyPush.${m}` };
              } catch (e: any) {
                return { state: "error", raw: e?.message ?? String(e), source: `NativelyPush.${m}` };
              }
            }
          }
        }
        if (w.OneSignal && typeof w.OneSignal.getDeviceState === "function") {
          try {
            const ds = await w.OneSignal.getDeviceState();
            return {
              state: ds?.hasNotificationPermission === true
                ? "granted"
                : ds?.hasNotificationPermission === false
                  ? "denied-or-not-asked"
                  : null,
              raw: JSON.stringify(ds),
              source: "OneSignal.getDeviceState",
            };
          } catch (e: any) {
            return { state: "error", raw: e?.message ?? String(e), source: "OneSignal.getDeviceState" };
          }
        }
      } catch (e: any) {
        return { state: "error", raw: e?.message ?? String(e), source: "outer" };
      }
      return { state: "no-bridge", raw: null, source: null };
    };

    const probeBridge = async (): Promise<{
      paths: ProbePath[];
      permission: ProbePermission;
      chosenSource: string | null;
      chosenPlayerId: string | null;
    }> => {
      const w = window as any;
      const paths: ProbePath[] = [];
      let chosenSource: string | null = null;
      let chosenPlayerId: string | null = null;

      // (a) NativelyNotifications.getOneSignalId — known to be
      // CALLBACK-shaped on the current Build Natively wrapper.
      // Awaiting the direct return value silently resolves to
      // undefined, so we MUST go through the callback shape.
      if (w.NativelyNotifications) {
        const path: ProbePath = {
          name: "NativelyNotifications.getOneSignalId",
          methodPresent: null,
          promiseShaped: null,
          raw: null,
          extractedId: null,
          error: null,
        };
        try {
          const notif = new w.NativelyNotifications();
          const present = typeof notif.getOneSignalId === "function";
          path.methodPresent = present;
          if (present) {
            // Detect shape: peek at the direct return without
            // awaiting it for callback-shaped APIs.
            let directReturn: any;
            try { directReturn = notif.getOneSignalId(); } catch {}
            path.promiseShaped =
              !!directReturn && typeof directReturn === "object" && typeof directReturn.then === "function";

            const result: any = await new Promise((resolve) => {
              const t = setTimeout(() => resolve("__timeout__"), 8000);
              try {
                notif.getOneSignalId((res: any) => { clearTimeout(t); resolve(res); });
              } catch (e: any) {
                clearTimeout(t);
                resolve({ __throw: e?.message ?? String(e) });
              }
            });
            path.raw = typeof result === "string" ? result : JSON.stringify(result);
            const id =
              (typeof result === "string" && result) ||
              result?.playerId || result?.oneSignalId || result?.id || null;
            if (id && typeof id === "string" && id.length > 10) {
              path.extractedId = id;
              if (!chosenSource) { chosenSource = "NativelyNotifications"; chosenPlayerId = id; }
            }
          }
        } catch (e: any) {
          path.error = e?.message ?? String(e);
        }
        paths.push(path);
      } else {
        paths.push({
          name: "NativelyNotifications.getOneSignalId",
          methodPresent: false,
          promiseShaped: null,
          raw: null,
          extractedId: null,
          error: null,
        });
      }

      // (b) NativelyPush.getOneSignalId — Promise-shaped.
      if (w.NativelyPush) {
        const path: ProbePath = {
          name: "NativelyPush.getOneSignalId",
          methodPresent: null,
          promiseShaped: null,
          raw: null,
          extractedId: null,
          error: null,
        };
        try {
          const push = new w.NativelyPush();
          const present = typeof push.getOneSignalId === "function";
          path.methodPresent = present;
          if (present) {
            let directReturn: any;
            try { directReturn = push.getOneSignalId(); } catch {}
            path.promiseShaped =
              !!directReturn && typeof directReturn === "object" && typeof directReturn.then === "function";
            const result: any = path.promiseShaped
              ? await Promise.race([
                  directReturn,
                  new Promise((r) => setTimeout(() => r("__timeout__"), 8000)),
                ])
              : directReturn;
            path.raw = typeof result === "string" ? result : JSON.stringify(result);
            const id = result?.oneSignalId || result?.playerId || result?.id || (typeof result === "string" ? result : null);
            if (id && typeof id === "string" && id.length > 10) {
              path.extractedId = id;
              if (!chosenSource) { chosenSource = "NativelyPush"; chosenPlayerId = id; }
            }
          }
        } catch (e: any) {
          path.error = e?.message ?? String(e);
        }
        paths.push(path);
      } else {
        paths.push({
          name: "NativelyPush.getOneSignalId",
          methodPresent: false,
          promiseShaped: null,
          raw: null,
          extractedId: null,
          error: null,
        });
      }

      // (c) global OneSignal.getUserId — Promise-shaped.
      if (w.OneSignal) {
        const path: ProbePath = {
          name: "OneSignal.getUserId",
          methodPresent: null,
          promiseShaped: null,
          raw: null,
          extractedId: null,
          error: null,
        };
        try {
          const present = typeof w.OneSignal.getUserId === "function";
          path.methodPresent = present;
          if (present) {
            let directReturn: any;
            try { directReturn = w.OneSignal.getUserId(); } catch {}
            path.promiseShaped =
              !!directReturn && typeof directReturn === "object" && typeof directReturn.then === "function";
            const result: any = path.promiseShaped
              ? await Promise.race([
                  directReturn,
                  new Promise((r) => setTimeout(() => r("__timeout__"), 8000)),
                ])
              : directReturn;
            path.raw = typeof result === "string" ? result : JSON.stringify(result);
            if (typeof result === "string" && result.length > 10) {
              path.extractedId = result;
              if (!chosenSource) { chosenSource = "OneSignal.getUserId"; chosenPlayerId = result; }
            }
          }
        } catch (e: any) {
          path.error = e?.message ?? String(e);
        }
        paths.push(path);
      } else {
        paths.push({
          name: "OneSignal.getUserId",
          methodPresent: false,
          promiseShaped: null,
          raw: null,
          extractedId: null,
          error: null,
        });
      }

      const permission = await detectPushPermission();
      return { paths, permission, chosenSource, chosenPlayerId };
    };

    const reportProbe = async (
      probeResult: Awaited<ReturnType<typeof probeBridge>>,
    ): Promise<void> => {
      try {
        await fetch("/api/dev/onesignal-bridge-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            paths: probeResult.paths,
            permission: probeResult.permission,
            chosenSource: probeResult.chosenSource,
            chosenPlayerId: probeResult.chosenPlayerId,
            timezone: resolveTimezone(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }),
        });
      } catch {
        // Best-effort. Non-dev users get 403 here, which is expected.
      }
    };

    // Registration fix selection (task #493 step 4):
    // Without device-side probe output yet, we keep a capped retry
    // loop (case (a) bridge-init race) as the default — that is the
    // most common failure mode on cold-launch in BuildNatively. The
    // probe block above also reports cases (b), (c), and (d) so the
    // next deploy can pick the targeted fix from server logs:
    //   • methodPresent=false on every path → case (b) wrong bridge
    //   • permission.state=denied             → case (c) OS denial
    //   • extractedId present but register 400 → case (d) drop in
    //     transit (the strict server log shows what we tried to send)
    const run = async () => {
      // Fire-and-forget: associate the external_id (= user id)
      // with the OneSignal subscription on the wrapper, then
      // persist server-side. Independent of the player_id loop
      // below — both paths can succeed; the server prefers the
      // alias when present.
      void trySetExternalIdOnBridge();

      let probeResultForReport: Awaited<ReturnType<typeof probeBridge>> | null = null;
      for (let attempt = 0; attempt < 15; attempt++) {
        if (cancelled) return;
        if (registeredViaMessage) return;
        try {
          console.log(`[onesignal] attempt ${attempt}`);
          const probeResult = await probeBridge();
          probeResultForReport = probeResult;
          console.log(
            "[onesignal] probe result:",
            JSON.stringify({
              chosen: probeResult.chosenSource,
              chosenId: probeResult.chosenPlayerId,
              permission: probeResult.permission.state,
              paths: probeResult.paths.map((p) => ({
                name: p.name,
                methodPresent: p.methodPresent,
                promiseShaped: p.promiseShaped,
                extractedId: p.extractedId,
                error: p.error,
              })),
            }),
          );
          if (probeResult.chosenPlayerId && probeResult.chosenSource) {
            await reportProbe(probeResult);
            const ok = await registerPlayerId(probeResult.chosenPlayerId, probeResult.chosenSource);
            if (ok) return;
          }
        } catch (e) {
          console.warn("[onesignal] registration attempt error:", e);
        }
        const delay = Math.min(1000 + attempt * 1000, 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
      console.warn("[onesignal] all 15 attempts exhausted, player ID not registered");
      if (probeResultForReport) {
        // Best-effort one more report so the server records the
        // final state for diagnosis.
        await reportProbe(probeResultForReport);
      }
    };

    run();
    return () => { cancelled = true; window.removeEventListener("message", onMessage); };
  }, [profile && (profile as any).onboardingComplete, (profile as any)?.userId]);

  if (profileLoading || (profile && planLoading)) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-20 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-8 bg-muted rounded w-48 mx-auto" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const isOnboardingPreview =
    location === "/onboarding" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";

  if (isOnboardingPreview && devCheck?.isDev) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Onboarding />
      </Suspense>
    );
  }

  if (!profile || !(profile as any).onboardingComplete) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Onboarding />
      </Suspense>
    );
  }

  if (!(profile as any).introSeen && (profile as any).currentWeek <= 1) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <AppIntro />
      </Suspense>
    );
  }

  const gateCtx: GateContextType = {
    gate: gateStatus || null,
    isLocked,
    showPaywall,
    refetchGate,
    isPaywallInFlight: () => paywallInFlightRef.current,
  };

  if (!currentPlan && gateStatus?.gateMode !== "off") {
    return (
      <GateContext.Provider value={gateCtx}>
        <div className="max-w-sm sm:max-w-none mx-auto bg-background sm:min-h-screen relative">
          <div id={BOUNCE_WRAPPER_ID}>
            <Suspense fallback={<RouteFallback />}>
              <Switch>
                <Route path="/profile" component={Profile} />
                <Route path="/health-info" component={HealthInfo} />
                <Route component={WeeklyPlanner} />
              </Switch>
            </Suspense>
          </div>
          <FloatingNavBar />
          <GlobalPiggyBankPopup />
          {unlockingOverlay && <UnlockingOverlay />}
          {exitWarningBackdropOpen && createPortal(
            <div
              data-testid="overlay-paywall-exit-warning-backdrop"
              aria-hidden="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 40,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            />,
            document.body,
          )}
          <PaywallExitWarning
            open={exitWarningOpen}
            onStay={handleExitWarningStay}
            onLeave={handleExitWarningLeave}
          />
        </div>
      </GateContext.Provider>
    );
  }

  return (
    <GateContext.Provider value={gateCtx}>
      <div className="max-w-sm sm:max-w-none mx-auto bg-background sm:min-h-screen relative">
        <div id={BOUNCE_WRAPPER_ID}>
          <AnimatedPageWrapper>
            <Suspense fallback={<RouteFallback />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/roadmap" component={Roadmap} />
                <Route path="/plan" component={WeeklyPlanner} />
                <Route path="/snap" component={Snap} />
                <Route path="/health-info" component={HealthInfo} />
                <Route path="/profile" component={Profile} />
                <Route path="/monthly" component={MonthlyReport} />
                <Route path="/dev" component={DevPanel} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </AnimatedPageWrapper>
        </div>
        <FloatingNavBar />
        <GlobalPiggyBankPopup />
        {unlockingOverlay && <UnlockingOverlay />}
        {exitWarningBackdropOpen && createPortal(
          <div
            data-testid="overlay-paywall-exit-warning-backdrop"
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          />,
          document.body,
        )}
        <PaywallExitWarning
          open={exitWarningOpen}
          onStay={handleExitWarningStay}
          onLeave={handleExitWarningLeave}
        />
      </div>
    </GateContext.Provider>
  );
}

const TEXT_SELECTABLE_EMAILS = ["yusycyn@gmail.com", "cynthiayuyu@hotmail.com"];

function Router() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      prefetchUserData(user.id);
    } else {
      resetPrefetchUserData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && TEXT_SELECTABLE_EMAILS.includes(user.email)) {
      document.documentElement.classList.add("text-selectable");
    } else {
      document.documentElement.classList.remove("text-selectable");
    }
  }, [user]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Landing />
      </Suspense>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  // Cube cold-launch overlay shown only on logged-out boot; captured once at mount and gated by stage1+auth+min 14s.
  // Rendered immediately so first paint is the cube (not a #FDFBED placeholder); Stage 1 preload fires from its mount effect.
  const [showCube] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SESSION_HINT_KEY) == null;
  });
  const [cubeDismissed, setCubeDismissed] = useState(false);
  const [stage1Ready, setStage1Ready] = useState(false);
  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!showCube) return;
    if (typeof window !== "undefined") {
      window.__cubeMountedAt = Date.now();
    }
    let alive = true;
    getStage1Promise().then(() => {
      if (alive) setStage1Ready(true);
      if (typeof window !== "undefined") {
        window.__stage1ReadyAt = Date.now();
      }
    });
    return () => {
      alive = false;
    };
  }, [showCube]);

  // Defer PostHog init until the WebView is idle so /decide + recorder.js
  // stay off the BN-splash critical path on first install. Nothing is
  // tracked or identified before the cube screen dismisses, so this loses
  // no events.
  useEffect(() => {
    let cancelled = false;
    const start = () => { if (!cancelled) initPostHog(); };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    if (typeof w.requestIdleCallback === "function") {
      idleHandle = w.requestIdleCallback(start, { timeout: 4000 });
    } else {
      timeoutHandle = window.setTimeout(start, 1500);
    }
    return () => {
      cancelled = true;
      if (idleHandle != null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle);
    };
  }, []);

  useEffect(() => {
    const updateFontClass = (lang: string) => {
      if (lang === "zh-Hant" || lang === "yue") {
        document.documentElement.classList.add("lang-zh");
      } else {
        document.documentElement.classList.remove("lang-zh");
      }
    };
    updateFontClass(i18n.language);
    i18n.on("languageChanged", updateFontClass);
    return () => {
      i18n.off("languageChanged", updateFontClass);
    };
  }, []);

  return (
    <TooltipProvider>
      <Toaster />
      <Router />
      <PiggyBankPreloader />
      {showCube && !cubeDismissed && (
        <CubeLoadingScreen
          authReady={!authLoading}
          preloadReady={stage1Ready}
          onDismiss={() => setCubeDismissed(true)}
        />
      )}
    </TooltipProvider>
  );
}

function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        <LoadingOverlayProvider>
          <App />
        </LoadingOverlayProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
}

export default AppWithProviders;
