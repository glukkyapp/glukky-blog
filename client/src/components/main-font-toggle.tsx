import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { hapticTap, hapticNotify } from "@/lib/haptics";

interface FontProfile {
  fontSizePreference?: "small" | "large";
  [key: string]: unknown;
}

function applyFontSize(size: "small" | "large") {
  document.documentElement.classList.toggle("font-small", size === "small");
}

export default function MainFontToggle() {
  const { i18n } = useTranslation();
  const [location] = useLocation();
  const { data: profile } = useQuery<FontProfile>({ queryKey: ["/api/profile"] });
  const mutation = useMutation({
    mutationFn: (fontSizePreference: "small" | "large") =>
      apiRequest("PATCH", "/api/profile/font-size", { fontSizePreference }),
    onMutate: (fontSizePreference) => {
      const previous = queryClient.getQueryData<FontProfile>(["/api/profile"]);
      const previousSize: "small" | "large" =
        previous?.fontSizePreference === "small" || document.documentElement.classList.contains("font-small")
          ? "small"
          : "large";
      queryClient.setQueryData<FontProfile>(["/api/profile"], old =>
        old ? { ...old, fontSizePreference } : old
      );
      applyFontSize(fontSizePreference);
      return { previous, previousSize };
    },
    onError: (_error, _fontSizePreference, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/profile"], context.previous);
      }
      if (context) applyFontSize(context.previousSize);
      hapticNotify("ERROR");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });
  const current = profile?.fontSizePreference === "small" ? "small" : "large";
  const next = current === "small" ? "large" : "small";
  const glyph = current === "large" ? "AA" : "Aa";
  const labels: Record<string, string> = {
    en: "Change text size", "zh-Hant": "切換文字大小", yue: "轉換文字大小",
  };
  const label = labels[i18n.language] ?? labels.en;
  const toggle = () => {
    hapticTap("LIGHT");
    mutation.mutate(next);
  };

  const isMainTab =
    location === "/" ||
    location.startsWith("/report") ||
    location.startsWith("/food-reports") ||
    location.startsWith("/food-log") ||
    location.startsWith("/snap") ||
    location.startsWith("/glucose-patterns") ||
    location.startsWith("/health-info") ||
    location.startsWith("/profile");

  if (!isMainTab) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="button-main-font-toggle"
      data-font-size={current}
      aria-pressed={current === "large"}
      disabled={mutation.isPending}
      className="fixed right-4 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#28634F] bg-[#FDFBED]/95 text-[#174E43] shadow-sm backdrop-blur transition-transform active:scale-90 disabled:opacity-60"
    >
      <span className="font-toggle-glyph font-bold leading-none" aria-hidden="true">{glyph}</span>
    </button>
  );
}