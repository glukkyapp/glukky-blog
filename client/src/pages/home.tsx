import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Droplets } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PiggyBankCard, type PiggyBankData } from "@/components/piggy-bank-card";
import type { UserProfile } from "@shared/schema";

type CorrectableHstixReading = {
  id: number;
  glucoseMmol: number;
  note: string | null;
  recordedAt: string;
  correctionExpiresAt: string;
};

type HstixReadingsResponse = {
  latestCorrectableReading: CorrectableHstixReading | null;
};

type MealSuggestion = {
  name: string;
  source: "user" | "list";
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const dateLocale = i18n.language === "yue"
    ? "zh-HK"
    : i18n.language === "zh-Hant"
      ? "zh-TW"
      : "en-US";

  const { data: profile } = useQuery<UserProfile>({ queryKey: ["/api/profile"] });
  const { data: piggy } = useQuery<PiggyBankData>({ queryKey: ["/api/piggybank"] });
  const { data: devCheck } = useQuery<{ isDev: boolean }>({ queryKey: ["/api/dev/check"] });
  const { data: devTime } = useQuery<{ timeOverride?: number | null; dateOverride?: string | null }>({
    queryKey: ["/api/dev/time"],
  });
  const { data: hstixReadings } = useQuery<HstixReadingsResponse>({
    queryKey: ["/api/hstix/readings"],
    queryFn: async () => {
      const response = await fetch("/api/hstix/readings", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to fetch HStix readings");
      return response.json();
    },
  });
  const correctableHstixReading = hstixReadings?.latestCorrectableReading ?? null;

  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [currentMinute, setCurrentMinute] = useState(() => new Date().getMinutes());
  const [mealSuggestion, setMealSuggestion] = useState<MealSuggestion | null>(null);
  const [mealSuggestionLoading, setMealSuggestionLoading] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      setCurrentHour(now.getHours());
      setCurrentMinute(now.getMinutes());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const effectiveHour = devTime?.timeOverride !== null && devTime?.timeOverride !== undefined
    ? devTime.timeOverride
    : currentHour;
  const effectiveMinute = devTime?.timeOverride !== null && devTime?.timeOverride !== undefined
    ? 0
    : currentMinute;

  const mealWindow = useMemo((): "breakfast" | "lunch" | "dinner" | null => {
    if (effectiveHour >= 6 && effectiveHour <= 10) return "breakfast";
    if (effectiveHour >= 11 && (effectiveHour < 14 || (effectiveHour === 14 && effectiveMinute < 30))) return "lunch";
    if ((effectiveHour === 14 && effectiveMinute >= 30) || (effectiveHour >= 15 && effectiveHour <= 20)) return "dinner";
    return null;
  }, [effectiveHour, effectiveMinute]);

  useEffect(() => {
    if (!mealWindow) {
      setMealSuggestion(null);
      return;
    }
    const d = new Date();
    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const stored = localStorage.getItem(`mealSuggestion_${mealWindow}_${localDateStr}`);
    if (!stored) {
      setMealSuggestion(null);
      return;
    }
    try {
      setMealSuggestion(JSON.parse(stored) as MealSuggestion);
    } catch {
      setMealSuggestion(null);
    }
  }, [mealWindow]);

  const handleMealSuggestionTap = async () => {
    if (!mealWindow || mealSuggestion || mealSuggestionLoading) return;

    const d = new Date();
    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const key = `mealSuggestion_${mealWindow}_${localDateStr}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setMealSuggestion(JSON.parse(stored) as MealSuggestion);
        return;
      } catch {
        localStorage.removeItem(key);
      }
    }

    setMealSuggestionLoading(true);
    try {
      const response = await fetch(`/api/meal-suggestions?mealType=${mealWindow}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load meal suggestion");
      const suggestion = await response.json() as MealSuggestion;
      localStorage.setItem(key, JSON.stringify(suggestion));
      setMealSuggestion(suggestion);
    } catch {
      // The card remains available so the user can try again.
    } finally {
      setMealSuggestionLoading(false);
    }
  };

  const effectiveDate = devTime?.dateOverride
    ? new Date(`${devTime.dateOverride}T00:00:00`)
    : new Date();
  const weekdayLabel = effectiveDate.toLocaleDateString(dateLocale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const openHstixSheet = () => {
    const params = new URLSearchParams();
    if (correctableHstixReading) params.set("readingId", String(correctableHstixReading.id));
    setLocation(`/hstix${params.size ? `?${params.toString()}` : ""}`);
  };

  return (
    <motion.main
      className="app-page-v2 home-page-v2 max-w-sm mx-auto px-6 pt-7 pb-28 space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <header className="space-y-0.5">
        <h1 className="text-[26px] font-normal" style={{ color: "#214B36" }} data-testid="text-week-header">
          {weekdayLabel}
        </h1>
        <div className="-mt-2">
          <p
            className="text-[50px] font-bold leading-none min-w-0"
            style={{ color: "#214B36" }}
            data-testid="text-greeting"
          >
            {profile?.name
              ? t("home.greeting_with_name", { name: profile.name })
              : t("home.greeting_no_name")}
          </p>
        </div>
      </header>

      {profile?.goal && (
        <div className="goal-bubble-wrap">
          <div className="min-w-0 goal-bubble" data-testid="text-goal-reminder">
            <p className="text-[18px] leading-snug" style={{ color: "#214B36" }}>
              {(() => {
                const full = t("home.goal_reminder", { goal: "{{GOAL}}" });
                const parts = full.split("{{GOAL}}");
                return (
                  <>
                    {parts[0]}
                    <strong style={{ color: "#214B36" }}>{profile.goal}</strong>
                    {parts[1]}
                  </>
                );
              })()}
            </p>
          </div>
        </div>
      )}

      {piggy && <PiggyBankCard data={piggy} isDev={devCheck?.isDev} />}

      <section aria-label={t("glucose.hstix_heading")} data-testid="section-home-hstix">
        {correctableHstixReading ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="font-semibold tabular-nums text-emerald-950" data-testid="text-home-hstix-saved">
              {t("glucose.hstix_home_saved", { value: correctableHstixReading.glucoseMmol.toFixed(1) })}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={openHstixSheet} data-testid="button-home-hstix-change">
              {t("glucose.hstix_home_change")}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full h-14" onClick={openHstixSheet} data-testid="button-home-hstix-record">
            <Droplets className="w-5 h-5 mr-2" />
            {t("glucose.hstix_home_record")}
          </Button>
        )}
      </section>

      {mealWindow && (
        <section data-testid="section-meal-suggestion">
          <button
            type="button"
            onClick={handleMealSuggestionTap}
            disabled={!!mealSuggestion || mealSuggestionLoading}
            data-testid="button-meal-suggestion"
            className="w-full text-left font-semibold text-[17px] px-5 py-4 rounded-2xl transition-colors active:opacity-80"
            style={{
              background: "#EEF5EF",
              color: "#214B36",
              opacity: mealSuggestion ? 0.7 : 1,
              boxShadow: "0 2px 8px rgba(44, 72, 56, 0.13)",
            }}
          >
            {mealSuggestionLoading ? "…" : t(`home.meal_suggestion_button_${mealWindow}`)}
          </button>
          {mealSuggestion && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-2 rounded-2xl px-5 py-4 space-y-1"
              style={{ background: "#F5FAF6" }}
              data-testid="card-meal-suggestion-result"
            >
              <p className="text-[18px] font-semibold leading-snug" style={{ color: "#214B36" }} data-testid="text-meal-suggestion-name">
                {mealSuggestion.name}
              </p>
              <p className="text-[14px] leading-snug" style={{ color: "#6E8477" }} data-testid="text-meal-suggestion-reason">
                {mealSuggestion.source === "user"
                  ? t("home.meal_suggestion_your_pick")
                  : t(`home.meal_suggestion_list_${mealWindow}`)}
              </p>
            </motion.div>
          )}
        </section>
      )}

    </motion.main>
  );
}