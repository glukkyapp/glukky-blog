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
import { useEffect, useState, useRef } from "react";
import i18n from "./i18n";
import { useTranslation } from "react-i18next";
import { PiggyBankPreloader } from "@/components/piggy-bank-svg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hapticPattern, hapticNotify } from "@/lib/haptics";
import { useBounceScroll } from "@/hooks/use-bounce-scroll";

import mountainBg from "@assets/cyucyu_a_stylized_mountain_peak_with_a_path_or_steps_leading___1775312483622.png";
import phoneBg from "@assets/cyucyu_a_smartphone_next_to_a_plate_of_food_as_if_it_is_takin__1775312483622.png";
import booksBg from "@assets/cyucyu_light_bulb_next_to_a_pile_of_books_indicating_knowledg__1775312483622.png";
import calendarBg from "@assets/cyucyu_a_clean_calendar_page_with_an_upward_progress_arrow_in__1775311745838.png";
import giftImg from "@assets/cyucyu_a_presentgift._background_color_f5f1e7_--sref_httpss.m__1775313676920.png";
import imgYogurt from "@assets/cropped_circle_image_(1)_1775372471299.png";
import imgJuice from "@assets/cropped_circle_image_(5)_1775372471299.png";
import imgSteam from "@assets/cropped_circle_image_(4)_1775372471300.png";
import imgEdamame from "@assets/cropped_circle_image_(3)_1775372471300.png";
import imgBroccoli from "@assets/cropped_circle_image_(2)_1775372471300.png";
import imgSharePlate from "@assets/cropped_circle_image_(6)_1775372471300.png";
import imgNoodle from "@assets/cropped_circle_image_(7)_1775372471300.png";
import imgPlateMethod from "@assets/cropped_circle_image_(8)_1775372471301.png";
import imgBowlLid from "@assets/cropped_circle_image_1775372471301.png";
import imgGrill from "@assets/cropped_circle_image_(9)_1775374577700.png";
import imgFoodSwap from "@assets/cropped_circle_image_(10)_1775374584626.png";
import pigImg0 from "@assets/IMG_2062_1773846070998.PNG";
import pigImg1 from "@assets/IMG_0610_1773846070999.PNG";
import pigImg2 from "@assets/IMG_0611_1773846070999.PNG";
import pigImg3 from "@assets/IMG_0612_1773846070999.PNG";
import pigImg4 from "@assets/IMG_0613_1773846070999.PNG";
import pigImg5 from "@assets/IMG_0614_1773846070999.PNG";
import landingLogo from "@assets/high-resolution-color-logo_1775378624892.png";
import slide1Img from "@assets/generated_images/slide1_walk.png";
import slide2Img from "@assets/generated_images/slide2_meal.png";
import slide3Img from "@assets/cyucyu_A_subtly_smiling_Asian_person_holding_a_smartphone_loo__1773936364915.png";

const PRELOAD_IMAGES = [
  mountainBg, phoneBg, booksBg, calendarBg, giftImg,
  imgYogurt, imgJuice, imgSteam, imgEdamame, imgBroccoli,
  imgSharePlate, imgNoodle, imgPlateMethod, imgBowlLid, imgGrill, imgFoodSwap,
  pigImg0, pigImg1, pigImg2, pigImg3, pigImg4, pigImg5,
  landingLogo, slide1Img, slide2Img, slide3Img,
];

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

function AuthenticatedApp() {
  const [location] = useLocation();
  const { data: profile, isLoading: profileLoading } = useQuery({ queryKey: ["/api/profile"] });
  const { data: currentPlan, isLoading: planLoading } = useQuery({
    queryKey: ["/api/plan/current"],
    enabled: !!profile,
  });

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

  if (!profile || !(profile as any).onboardingComplete) {
    return <Onboarding />;
  }

  if (!(profile as any).introSeen && (profile as any).currentWeek <= 1) {
    return <AppIntro />;
  }

  if (!currentPlan) {
    return (
      <div className="max-w-sm sm:max-w-none mx-auto bg-background sm:min-h-screen relative">
        <Switch>
          <Route path="/health-info" component={HealthInfo} />
          <Route component={WeeklyPlanner} />
        </Switch>
        <FloatingNavBar />
        <GlobalPiggyBankPopup />
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
  useEffect(() => {
    PRELOAD_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
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
