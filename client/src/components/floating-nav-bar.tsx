import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Home, ClipboardList, User, Camera, Lock, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useGate } from "@/App";
import { isReportLocation } from "@/lib/report-navigation";

const NAV_TAP = { scale: 0.82 };
const NAV_TAP_TRANSITION = { type: "spring" as const, stiffness: 600, damping: 20, mass: 0.5 };

const NAV_FEATURE_MAP: Record<string, string> = {
  snap: "food_snap_capture",
  health_info: "insights",
};

export default function FloatingNavBar() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { gate, isLocked, showPaywall } = useGate();

  const navItems = [
    { key: "home", label: t("nav.home"), path: "/", icon: Home },
    { key: "report", label: t("nav.report", "Report"), path: "/report", icon: ClipboardList },
    { key: "snap", label: t("nav.snap"), path: "/snap", icon: Camera },
    { key: "glucose", label: t("glucose.patterns_nav"), path: "/glucose-patterns", icon: TrendingUp },
    { key: "profile", label: t("nav.profile"), path: "/profile", icon: User },
  ];

  const isActive = (path: string) =>
    path === "/" ? location === "/" || location === "" :
    path === "/report"
      ? isReportLocation(search ? `${location}?${search.replace(/^\?/, "")}` : location)
      : location.startsWith(path);

  const isNavLocked = (key: string): boolean => {
    // Profile is always reachable so the user can access settings,
    // restore purchases, sign out, and (in hard lock B) see the
    // hosted no-close paywall presented by the lock-app effect.
    if (key === "profile" || key === "hstix") return false;
    if (isLocked) return true;
    if (!gate) return false;
    if (gate.gateMode === "off") return false;

    // Premium → fall through to per-feature gating below.
    if (gate.isPremium) {
      const featureKey = NAV_FEATURE_MAP[key];
      if (!featureKey) return false;
      const feature = gate.features[featureKey];
      if (!feature) return false;
      return !feature.allowed && !!feature.showPaywall;
    }

    // Hard lock B — both milestones done AND user opted out of the
    // snap-advice paywall via the exit-warning popup. Lock everything
    // except profile until they subscribe.
    if (gate.hardLockedAfterAdviceDismiss) return true;

    // Soft lock — no first snap yet. Only the snap tab is reachable
    // so the user takes their first snap and sees the conversion moment.
    if (!gate.hasTriedFirstFoodSnap) {
      return key !== "snap";
    }

    // First snap done, not premium, not hard-locked.
    // Nav is fully unlocked — paywalls now fire from API actions
    // (snap-advice on the second snap, etc.), not from nav taps.
    const featureKey = NAV_FEATURE_MAP[key];
    if (!featureKey) return false;
    const feature = gate.features[featureKey];
    if (!feature) return false;
    return !feature.allowed && !!feature.showPaywall;
  };

  const handleNavClick = (path: string, key: string) => {
    if (isNavLocked(key)) {
      hapticNotify("WARNING");
      // No `onSuccess` callback is intentional — nav-tapped paywalls
      // have no per-action resume to perform. After purchase the gate
      // refresh unlocks the tab and the user retaps it normally. If
      // you ever wire a callback here, also handle the exit-warning
      // popup's Stay → re-present path so it doesn't drop the resume.
      showPaywall();
      return;
    }
    hapticTap("LIGHT");
    setLocation(key === "report" ? "/report" : path);
  };

  return (
    <nav
      className="fixed bottom-7 left-1/2 transform -translate-x-1/2 z-50"
      style={{ width: "calc(100vw - 32px)", maxWidth: "384px", height: "58px" }}
      data-testid="nav-floating-bar"
    >
      <div
        className="flex items-center w-full h-full px-2"
        style={{
          backgroundColor: "rgba(187,222,214,0.85)",
          borderRadius: "160px",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
        }}
      >
        {navItems.map(({ key, label, path, icon: Icon }) => {
          const active = isActive(path);
          const locked = isNavLocked(key);
          return (
            <motion.button
              key={key}
              onClick={() => handleNavClick(path, key)}
              whileTap={NAV_TAP}
              transition={NAV_TAP_TRANSITION}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center select-none"
              style={{
                height: "100%",
                color: locked ? "#9CA3AF" : "#0D5E4F",
                opacity: locked ? 0.6 : 1,
                background: "transparent",
                border: "none",
              }}
              data-testid={`nav-tab-${key}`}
              aria-current={active ? "page" : undefined}
            >
              {locked ? <Lock size={18} /> : <Icon size={22} strokeWidth={active ? 2.5 : 2} />}
              <motion.span
                animate={{ opacity: active ? 1 : 0, height: active ? "auto" : 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-medium overflow-hidden leading-tight"
                style={{ color: locked ? "#9CA3AF" : "#0D5E4F" }}
              >
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
