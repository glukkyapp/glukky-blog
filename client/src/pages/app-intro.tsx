import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

export default function AppIntro() {
  const { t } = useTranslation();

  const markSeen = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/profile/intro-seen"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });

  const items = [
    { type: "header" as const, textKey: "intro.section1_title", icon: Sparkles, color: "text-primary", bg: "bg-primary/10" },
    { type: "item" as const, textKey: "intro.walk", icon: Footprints, color: "text-primary", bg: "bg-primary/10" },
    { type: "item" as const, textKey: "intro.diet", icon: UtensilsCrossed, color: "text-amber-500", bg: "bg-amber-500/10" },
    { type: "header" as const, textKey: "intro.section2_title", icon: Sparkles, color: "text-emerald-600", bg: "bg-emerald-600/10" },
    { type: "item" as const, textKey: "intro.plan", icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
    { type: "item" as const, textKey: "intro.checkin", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { type: "item" as const, textKey: "intro.snap", icon: Camera, color: "text-violet-500", bg: "bg-violet-500/10" },
    { type: "item" as const, textKey: "intro.review", icon: BarChart3, color: "text-blue-500", bg: "bg-blue-500/10" },
    { type: "item" as const, textKey: "intro.master", icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
    { type: "item" as const, textKey: "intro.wellbeing", icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  const section1Items = items.slice(0, 3);
  const section2Items = items.slice(3);

  return (
    <div className="max-w-sm mx-auto px-4 pt-8 pb-28 space-y-6" data-testid="page-app-intro">
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
        {section1Items.map((item, idx) => {
          const Icon = item.icon;
          if (item.type === "header") {
            return (
              <div key={idx} className="flex items-center gap-3" data-testid="text-intro-section1-title">
                <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="text-base font-bold text-foreground">{t(item.textKey)}</p>
              </div>
            );
          }
          return (
            <div key={idx} className="flex items-center gap-3" data-testid={`text-intro-item-${idx}`}>
              <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-sm text-foreground">{t(item.textKey)}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {section2Items.map((item, idx) => {
          const Icon = item.icon;
          if (item.type === "header") {
            return (
              <div key={idx} className="flex items-center gap-3 pt-2" data-testid="text-intro-section2-title">
                <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="text-base font-bold text-foreground">{t(item.textKey)}</p>
              </div>
            );
          }
          return (
            <div key={idx} className="flex items-center gap-3" data-testid={`text-intro-item-${idx + 3}`}>
              <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-sm text-foreground">{t(item.textKey)}</p>
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => markSeen.mutate()}
        disabled={markSeen.isPending}
        className="w-full"
        data-testid="button-intro-continue"
      >
        {markSeen.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          t("intro.button")
        )}
      </Button>
    </div>
  );
}
