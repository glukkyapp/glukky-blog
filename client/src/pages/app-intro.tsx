import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { preloadStage3RestOfApp, getStage2Promise } from "@/lib/preload-assets";
import { usePromiseLoading } from "@/components/global-loading-overlay";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Footprints,
  UtensilsCrossed,
  CalendarDays,
  MessageSquare,
  Camera,
  BarChart3,
  Trophy,
  Heart,
  Sparkles,
  Loader2,
  ChevronRight,
} from "lucide-react";

type IntroItem = {
  type: "header" | "item";
  textKey: string;
  icon: typeof Sparkles;
  color: string;
  bg: string;
};

export default function AppIntro() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    preloadStage3RestOfApp();
  }, []);

  usePromiseLoading(getStage2Promise);

  const markSeen = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/profile/intro-seen"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });

  const pages: IntroItem[][] = [
    [
      { type: "header", textKey: "intro.section1_title", icon: Sparkles, color: "text-primary", bg: "bg-primary/10" },
      { type: "item", textKey: "intro.walk", icon: Footprints, color: "text-primary", bg: "bg-primary/10" },
      { type: "item", textKey: "intro.diet", icon: UtensilsCrossed, color: "text-amber-500", bg: "bg-amber-500/10" },
    ],
    [
      { type: "header", textKey: "intro.section2_title", icon: Sparkles, color: "text-emerald-600", bg: "bg-emerald-600/10" },
      { type: "item", textKey: "intro.plan", icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
      { type: "item", textKey: "intro.checkin", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    ],
    [
      { type: "item", textKey: "intro.snap", icon: Camera, color: "text-violet-500", bg: "bg-violet-500/10" },
      { type: "item", textKey: "intro.review", icon: BarChart3, color: "text-blue-500", bg: "bg-blue-500/10" },
    ],
    [
      { type: "item", textKey: "intro.master", icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
      { type: "item", textKey: "intro.wellbeing", icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
    ],
  ];

  const isLastPage = page === pages.length - 1;

  const goNext = () => {
    if (isLastPage) return;
    setDirection(1);
    setPage(page + 1);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  const currentItems = pages[page];

  return (
    <div className="app-page-v2 max-w-sm mx-auto px-4 pt-8 pb-28 flex flex-col items-center" data-testid="page-app-intro">
      <div className="w-full min-h-[260px] flex items-start">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="w-full rounded-[28px] p-5 space-y-3"
            style={{ backgroundColor: "#fbfbf3", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}
          >
            {currentItems.map((item, idx) => {
              const Icon = item.icon;
              if (item.type === "header") {
                return (
                  <div key={idx} className="flex items-center gap-3" data-testid={`text-intro-header-${page}`}>
                    <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <p className="text-[21px] font-bold" style={{ color: "#214B36" }}>{t(item.textKey)}</p>
                  </div>
                );
              }
              return (
                <div key={idx} className="flex items-center gap-3" data-testid={`text-intro-item-${page}-${idx}`}>
                  <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <p className="text-sm text-foreground">{t(item.textKey)}</p>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {isLastPage && (
        <p
          className="text-xs text-muted-foreground text-center mt-3 px-2"
          data-testid="text-intro-disclaimer"
        >
          {t("intro.disclaimer")}
        </p>
      )}

      <div className="flex items-center gap-2 mt-6 mb-4">
        {pages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => { setDirection(idx > page ? 1 : -1); setPage(idx); }}
            className={`rounded-full transition-all duration-300 ${
              idx === page
                ? "w-6 h-2.5 bg-primary"
                : "w-2.5 h-2.5 bg-primary/30"
            }`}
            data-testid={`dot-intro-page-${idx}`}
          />
        ))}
      </div>

      {isLastPage ? (
        <Button
          onClick={() => markSeen.mutate()}
          disabled={markSeen.isPending}
          className="w-full btn-pop"
          data-testid="button-intro-continue"
        >
          {markSeen.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("intro.button")
          )}
        </Button>
      ) : (
        <Button
          onClick={goNext}
          className="w-full btn-pop"
          data-testid="button-intro-next"
        >
          {t("intro.next")}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
