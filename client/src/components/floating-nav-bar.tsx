import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
import { Home, TrendingUp, CalendarDays, User, Camera, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function FloatingNavBar() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [activePath, setActivePath] = useState(location || "/");

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

  const handleNavClick = (path: string) => {
    setActivePath(path);
    setLocation(path);
  };

  return (
    <nav
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50"
      style={{ width: "calc(100vw - 32px)", maxWidth: "500px", height: "80px" }}
      data-testid="nav-floating-bar"
    >
      <div
        className="flex items-center w-full h-full px-2 scrollbar-hidden"
        style={{
          backgroundColor: "rgba(187,222,214,0.85)",
          borderRadius: "160px",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {navItems.map(({ key, label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={key}
              onClick={() => handleNavClick(path)}
              className="relative z-10 flex flex-col items-center justify-center flex-shrink-0"
              style={{
                width: "25%",
                minWidth: "25%",
                height: "100%",
                color: "#0D5E4F",
                background: "transparent",
                border: "none",
              }}
              data-testid={`nav-tab-${key}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <motion.span
                animate={{ opacity: active ? 1 : 0, height: active ? "auto" : 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-medium overflow-hidden"
                style={{ color: "#0D5E4F" }}
              >
                {label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
