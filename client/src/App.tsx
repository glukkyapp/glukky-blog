import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedPageWrapper } from "@/components/page-transition";
import { useAuth } from "@/hooks/use-auth";
import FloatingNavBar from "@/components/floating-nav-bar";
import Landing from "@/pages/landing";
import Onboarding from "@/pages/onboarding";
import WeeklyPlanner from "@/pages/weekly-planner";
import Home from "@/pages/home";
import Roadmap from "@/pages/roadmap";
import Profile from "@/pages/profile";
import MonthlyReport from "@/pages/monthly-report";
import Snap from "@/pages/snap";
import HealthInfo from "@/pages/health-info";
import AppIntro from "@/pages/app-intro";
import DevPanel from "@/pages/dev-panel";
import NotFound from "@/pages/not-found";
import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import i18n from "./i18n";
import { useTranslation } from "react-i18next";
import { PiggyBankPreloader } from "@/components/piggy-bank-svg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hapticPattern, hapticNotify } from "@/lib/haptics";
import { useBounceScroll, BOUNCE_WRAPPER_ID } from "@/hooks/use-bounce-scroll";
import PaywallModal from "@/components/paywall-modal";
import { ensureIdentified } from "@/lib/natively-purchases";
import { LoadingOverlayProvider } from "@/components/global-loading-overlay";
import { preloadStage1Launch, getStage1Promise } from "@/lib/preload-assets";
import { prefetchUserData, resetPrefetchUserData } from "@/lib/prefetch-user-data";
import CubeLoadingScreen from "@/components/cube-loading-screen";
import { SESSION_HINT_KEY } from "@/hooks/use-auth";
import BuildDiagnosticBadge from "@/components/build-diagnostic-badge";

preloadStage1Launch();

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

  useEffect(() => {
    if (piggy?.needsRewardSetup) {
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
    const handleOpenReward = () => setShowRewardSetup(true);
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
          </div>
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

interface GateStatus {
  gateMode: string;
  isPremium: boolean;
  hasCreatedFirstWeeklyPlan: boolean;
  hasTriedFirstFoodSnap: boolean;
  hasReachedPaywall: boolean;
  features: Record<string, { allowed: boolean; showPaywall?: boolean; lockApp?: boolean; isFreeAction?: boolean }>;
}

interface GateContextType {
  gate: GateStatus | null;
  isLocked: boolean;
  showPaywall: (onSuccess?: () => void) => void;
  refetchGate: () => void;
}

const GateContext = createContext<GateContextType>({
  gate: null,
  isLocked: false,
  showPaywall: () => {},
  refetchGate: () => {},
});

export function useGate() {
  return useContext(GateContext);
}

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
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

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallLockApp, setPaywallLockApp] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const isLocked = !!(gateStatus && !gateStatus.isPremium && Object.values(gateStatus.features).some((f) => f.lockApp));

  useEffect(() => {
    setPaywallLockApp(isLocked);
    if (isLocked && location !== "/profile") {
      setLocation("/profile");
      setPaywallOpen(true);
    }
  }, [isLocked, location, setLocation]);

  const showPaywall = useCallback((onSuccess?: () => void) => {
    pendingActionRef.current = onSuccess || null;
    setPaywallOpen(true);
  }, []);

  const handlePurchaseSuccess = useCallback(async () => {
    setPaywallOpen(false);
    await refetchGate();
    await queryClient.refetchQueries({ queryKey: ["/api/profile"] });
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      setTimeout(action, 100);
    }
  }, [refetchGate]);

  useEffect(() => {
    // Identify the user to RevenueCat as soon as we know their Replit
    // user id. Without this, every purchase on iOS is recorded against
    // an anonymous "$RCAnonymousID:…" record and the server's
    // verifyEntitlement(replitUserId) always 404s. Safe + idempotent
    // when the bridge is missing (web preview).
    const userId = (profile as any)?.userId;
    if (userId) ensureIdentified(userId);
  }, [(profile as any)?.userId]);

  useEffect(() => {
    if (!(profile as any)?.onboardingComplete) return;

    // Ask the server to verify premium with RevenueCat. The server is the
    // only source of truth — it may flip is_premium true OR false based on
    // the verified entitlement (handles expired subs, account switches,
    // etc.). We never send a client-side premium flag.
    const refreshPremium = async () => {
      try {
        const resp = await fetch("/api/refresh-premium-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const verified = Boolean(data?.verifiedPremium ?? data?.isPremium);
        if (verified !== Boolean((profile as any)?.isPremium)) {
          refetchGate();
          queryClient.refetchQueries({ queryKey: ["/api/profile"] });
        }
      } catch (e) {
        console.warn("[premium] refresh error:", e);
      }
    };

    // On boot.
    refreshPremium();

    // On app foreground (catches expired subs without a tap).
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPremium();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [(profile as any)?.onboardingComplete, (profile as any)?.userId]);

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
    let cancelled = false;
    let registeredViaMessage = false;

    const registerPlayerId = async (playerId: string): Promise<boolean> => {
      const cached = localStorage.getItem(cacheKey);
      if (cached === playerId) {
        console.log("[onesignal] already cached, skipping registration");
        return true;
      }
      const resp = await fetch("/api/onesignal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerId }),
      });
      if (resp.ok) {
        localStorage.setItem(cacheKey, playerId);
        console.log("[onesignal] registered successfully:", playerId);
        return true;
      }
      console.warn("[onesignal] registration failed:", resp.status);
      return false;
    };

    const onMessage = async (event: MessageEvent) => {
      if (registeredViaMessage || cancelled) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const id = data?.oneSignalId || data?.playerId || data?.onesignal_player_id || data?.id;
        if (id && typeof id === "string" && id.length > 10) {
          console.log("[onesignal] received player ID via message event:", id);
          const success = await registerPlayerId(id);
          if (success) registeredViaMessage = true;
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);

    const tryGetPlayerId = async (): Promise<string | null> => {
      const w = window as any;

      if (w.NativelyNotifications) {
        try {
          const notif = new w.NativelyNotifications();
          const result: any = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 10000);
            notif.getOneSignalId((res: any) => {
              clearTimeout(timeout);
              resolve(res);
            });
          });
          console.log("[onesignal] NativelyNotifications.getOneSignalId callback:", JSON.stringify(result));
          const id = result?.playerId || result?.oneSignalId || result?.id;
          if (id) return id;
        } catch (e: any) {
          console.warn("[onesignal] NativelyNotifications error:", e.message);
        }
      }

      if (w.NativelyPush) {
        try {
          const push = new w.NativelyPush();
          const result = await push.getOneSignalId();
          console.log("[onesignal] NativelyPush.getOneSignalId:", JSON.stringify(result));
          const id = result?.oneSignalId || result?.playerId || result?.id;
          if (id) return id;
        } catch (e: any) {
          console.warn("[onesignal] NativelyPush error:", e.message);
        }
      }

      if (w.OneSignal) {
        try {
          if (typeof w.OneSignal.getUserId === "function") {
            const id = await w.OneSignal.getUserId();
            console.log("[onesignal] OneSignal.getUserId:", id);
            if (id) return id;
          }
        } catch (e: any) {
          console.warn("[onesignal] OneSignal global error:", e.message);
        }
      }

      return null;
    };

    const attemptRegister = async (attempt: number): Promise<boolean> => {
      if (registeredViaMessage) return true;
      console.log(`[onesignal] attempt ${attempt}`);
      const playerId = await tryGetPlayerId();
      console.log("[onesignal] extracted playerId:", playerId);
      if (!playerId) return false;
      return registerPlayerId(playerId);
    };

    const run = async () => {
      for (let attempt = 0; attempt < 15; attempt++) {
        if (cancelled) return;
        try {
          const done = await attemptRegister(attempt);
          if (done) return;
        } catch (e) {
          console.warn("[onesignal] registration attempt error:", e);
        }
        const delay = Math.min(1000 + attempt * 1000, 5000);
        await new Promise(r => setTimeout(r, delay));
      }
      console.warn("[onesignal] all 15 attempts exhausted, player ID not registered");
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
    return <Onboarding />;
  }

  if (!profile || !(profile as any).onboardingComplete) {
    return <Onboarding />;
  }

  if (!(profile as any).introSeen && (profile as any).currentWeek <= 1) {
    return <AppIntro />;
  }

  const gateCtx: GateContextType = {
    gate: gateStatus || null,
    isLocked,
    showPaywall,
    refetchGate: () => { refetchGate(); },
  };

  if (!currentPlan) {
    return (
      <GateContext.Provider value={gateCtx}>
        <div className="max-w-sm sm:max-w-none mx-auto bg-background sm:min-h-screen relative">
          <div id={BOUNCE_WRAPPER_ID}>
            <Switch>
              <Route path="/profile" component={Profile} />
              <Route path="/health-info" component={HealthInfo} />
              <Route component={WeeklyPlanner} />
            </Switch>
          </div>
          <FloatingNavBar />
          <GlobalPiggyBankPopup />
          <PaywallModal
            open={paywallOpen}
            onClose={() => { setPaywallOpen(false); pendingActionRef.current = null; }}
            onPurchaseSuccess={handlePurchaseSuccess}
            lockApp={paywallLockApp}
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
          </AnimatedPageWrapper>
        </div>
        <FloatingNavBar />
        <GlobalPiggyBankPopup />
        <PaywallModal
          open={paywallOpen}
          onClose={() => { setPaywallOpen(false); pendingActionRef.current = null; }}
          onPurchaseSuccess={handlePurchaseSuccess}
          lockApp={paywallLockApp}
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
    return <Landing />;
  }

  return <AuthenticatedApp />;
}

function App() {
  // Cube cold-launch overlay. Only shown when no session hint exists in
  // localStorage at boot — i.e. the user is logged out. Captured once at
  // mount so login mid-screen doesn't dismiss it early; logout doesn't
  // re-trigger it (no remount). Three gates: Stage 1 preload done +
  // auth check resolved + minimum 14s elapsed.
  const [showCube] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SESSION_HINT_KEY) == null;
  });
  const [cubeDismissed, setCubeDismissed] = useState(false);
  const [stage1Ready, setStage1Ready] = useState(false);
  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!showCube) return;
    let alive = true;
    getStage1Promise().then(() => {
      if (alive) setStage1Ready(true);
    });
    return () => {
      alive = false;
    };
  }, [showCube]);

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
      <BuildDiagnosticBadge />
      <PiggyBankPreloader />
      {showCube && !cubeDismissed && (
        stage1Ready ? (
          <CubeLoadingScreen
            authReady={!authLoading}
            preloadReady={stage1Ready}
            onDismiss={() => setCubeDismissed(true)}
          />
        ) : (
          <div
            data-testid="cube-loading-placeholder"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "#F3EAE5",
              zIndex: 9999,
            }}
          />
        )
      )}
    </TooltipProvider>
  );
}

function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingOverlayProvider>
        <App />
      </LoadingOverlayProvider>
    </QueryClientProvider>
  );
}

export default AppWithProviders;
