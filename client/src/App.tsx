import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
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
import { SplashScreen } from "@/components/splash-screen";
import { PiggyBankPreloader } from "@/components/piggy-bank-svg";

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
