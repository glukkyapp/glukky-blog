import { useQuery } from "@tanstack/react-query";
import { Clock3, Droplet } from "lucide-react";
import { useTranslation } from "react-i18next";
import PostMealCard from "@/components/PostMealCard";

type HstixReading = {
  id: number;
  glucoseMmol: number;
  note: string | null;
  minutesSinceLastMeal: number | null;
  mealTimingConfidence: "on_time" | "delayed" | "unrelated";
  recordedAt: string;
};

const timingKey: Record<HstixReading["mealTimingConfidence"], string> = {
  on_time: "glucose.hstix_on_time",
  delayed: "glucose.hstix_delayed",
  unrelated: "glucose.hstix_unrelated",
};

export default function Hstix() {
  const { t, i18n } = useTranslation();
  const { data, refetch } = useQuery<{ readings: HstixReading[] }>({
    queryKey: ["/api/hstix/readings"],
    queryFn: async () => {
      const response = await fetch("/api/hstix/readings", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to fetch HStix readings");
      return response.json();
    },
  });
  const dateLocale = i18n.language === "yue" ? "zh-HK" : i18n.language === "zh-Hant" ? "zh-TW" : "en-US";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 pb-28 pt-6">
      <header className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700">
          <Droplet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("glucose.hstix_heading", "HStix")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("glucose.hstix_subheading", "Record a glucose reading any time. A meal is optional.")}
          </p>
        </div>
      </header>

      <PostMealCard standalone onDone={() => void refetch()} />

      <section aria-labelledby="hstix-history-heading" className="space-y-3">
        <h2 id="hstix-history-heading" className="text-base font-semibold text-foreground">
          {t("glucose.hstix_history", "Reading history")}
        </h2>
        {data?.readings?.length ? (
          <ul className="space-y-2">
            {data.readings.map((reading) => (
              <li key={reading.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {reading.glucoseMmol.toFixed(1)} <span className="text-xs font-medium text-muted-foreground">mmol/L</span>
                  </span>
                  <time className="text-xs text-muted-foreground" dateTime={reading.recordedAt}>
                    {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(reading.recordedAt))}
                  </time>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>
                    {reading.minutesSinceLastMeal === null
                      ? t(timingKey[reading.mealTimingConfidence])
                      : t("glucose.hstix_minutes_after_meal", {
                          minutes: reading.minutesSinceLastMeal,
                          timing: t(timingKey[reading.mealTimingConfidence]),
                        })}
                  </span>
                </div>
                {reading.note && <p className="mt-2 text-sm text-muted-foreground">{reading.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted/60 px-4 py-5 text-sm text-muted-foreground">
            {t("glucose.hstix_empty", "Your saved readings will appear here.")}
          </p>
        )}
      </section>
    </main>
  );
}