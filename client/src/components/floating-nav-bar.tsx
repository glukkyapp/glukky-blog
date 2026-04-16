import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
import { Home, TrendingUp, CalendarDays, User, Camera, Lightbulb, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useGate } from "@/App";

const NAV_TAP = { scale: 0.82 };
const NAV_TAP_TRANSITION = { type: "spring" as const, stiffness: 600, damping: 20, mass: 0.5 };

const NAV_FEATURE_MAP: Record<string, string> = {
  roadmap: "roadmap",
  snap: "food_snap_capture",
  planner: "weekly_plan_create",
  health_info: "insights",
};

export default function FloatingNavBar() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [activePath, setActivePath] = useState(location || "/");
  const isMobile = useIsMobile();
  const { gate, showPaywall } = useGate();

  const navItems = [
    { key: "home", label: t("nav.home"), path: "/", icon: Home },
    { key: "roadmap", label: t("nav.roadmap"), path: "/roadmap", icon: TrendingUp },
    { key: "snap", label: t("nav.snap"), path: "/snap", icon: Camera },
    { key: "planner", label: t("nav.planner"), path: "/plan", icon: CalendarDays },
    { key: "health_info", label: t("nav.health_info"), path: "/health-info", icon: Lightbulb },
    { key: "profile", label: t("nav.profile"), path: "/profile", icon: User },
  ];

  const isActive = (path: string) =>
    path === "/" ? activePath === "/" || activePath === "" : activePath.startsWith(path);

  const isAppLocked = gate?.hasReachedPaywall && !gate?.isPremium;

  const isNavLocked = (key: string): boolean => {
    if (key === "home" || key === "profile") return false;
    if (isAppLocked) return true;
    if (!gate) return false;
    const featureKey = NAV_FEATURE_MAP[key];
    if (!featureKey) return false;
    const feature = gate.features[featureKey];
    if (!feature) return false;
    return !feature.allowed && !!feature.showPaywall;
  };

  const handleNavClick = (path: string, key: string) => {
    if (isNavLocked(key)) {
      hapticNotify("WARNING");
      showPaywall();
      return;
    }
    hapticTap("SOFT");
    setActivePath(path);
    setLocation(path);
  };

  return (
    <nav
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50"
      style={{ width: "calc(100vw - 32px)", maxWidth: "500px", height: "58px" }}
      data-testid="nav-floating-bar"
    >
      <div
        className={`flex items-center w-full h-full px-2${isMobile ? " scrollbar-hidden" : ""}`}
        style={{
          backgroundColor: "rgba(187,222,214,0.85)",
          borderRadius: "160px",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
          ...(isMobile ? {
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } : {}),
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
              className={`relative z-10 flex flex-col items-center justify-center select-none${isMobile ? " flex-shrink-0" : " flex-1"}`}
              style={{
                ...(isMobile ? { width: "25%", minWidth: "25%" } : {}),
                height: "100%",
                color: locked ? "#9CA3AF" : "#0D5E4F",
                opacity: locked ? 0.6 : 1,
                background: "transparent",
                border: "none",
              }}
              data-testid={`nav-tab-${key}`}
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
