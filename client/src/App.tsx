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
import DevPanel from "@/pages/dev-panel";
import NotFound from "@/pages/not-found";
import { useEffect, useState, useRef } from "react";
import i18n from "./i18n";
import { useTranslation } from "react-i18next";
import { SplashScreen } from "@/components/splash-screen";
import { PiggyBankPreloader } from "@/components/piggy-bank-svg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
              onChange={(e: any) => setRewardInput(e.target.value)}
              placeholder={t("roadmap.reward_placeholder")}
              data-testid="input-reward-global"
              onKeyDown={(e: any) => {
                if (e.key === "Enter" && rewardInput.trim()) {
                  rewardMutation.mutate(rewardInput.trim());
                }
              }}
            />
            <Button
              className="w-full"
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

function AuthenticatedApp() {
  const [location] = useLocation();
  const { data: profile, isLoading: profileLoading } = useQuery({ queryKey: ["/api/profile"] });
  const { data: currentPlan, isLoading: planLoading } = useQuery({
    queryKey: ["/api/plan/current"],
    enabled: !!profile,
  });

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

  if (!profile || !(profile as any).onboardingComplete) {
    return <Onboarding />;
  }

  if (!currentPlan) {
    return (
      <div className="max-w-sm sm:max-w-none mx-auto bg-background sm:min-h-screen relative">
        <Switch>
          <Route path="/health-info" component={HealthInfo} />
          <Route component={WeeklyPlanner} />
        </Switch>
        <FloatingNavBar />
      </div>
    );
  }

  return (
    <div className="max-w-sm sm:max-w-none mx-auto bg-background sm:min-h-screen relative">
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
      <FloatingNavBar />
      <GlobalPiggyBankPopup />
    </div>
  );
}

const TEXT_SELECTABLE_EMAILS = ["yusycyn@gmail.com", "cynthiayuyu@hotmail.com"];

function Router() {
  const { user, isLoading } = useAuth();

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
  const { isLoading } = useAuth();
  const [timerDone, setTimerDone] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setTimerDone(true);
    }, 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timerDone && !isLoading) {
      setSplashVisible(false);
    }
  }, [timerDone, isLoading]);

  return (
    <TooltipProvider>
      <Toaster />
      <Router />
      <SplashScreen visible={splashVisible} />
      <PiggyBankPreloader />
    </TooltipProvider>
  );
}

function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

export default AppWithProviders;
