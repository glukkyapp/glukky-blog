import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Droplet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearch } from "wouter";
import PostMealCard from "@/components/PostMealCard";
import { useToast } from "@/hooks/use-toast";

type HstixReading = {
  id: number;
  glucoseMmol: number;
  note: string | null;
  minutesSinceLastMeal: number | null;
  mealTimingConfidence: "on_time" | "delayed" | "unrelated";
  recordedAt: string;
  correctionExpiresAt: string;
};

const timingKey: Record<HstixReading["mealTimingConfidence"], string> = {
  on_time: "glucose.hstix_on_time",
  delayed: "glucose.hstix_delayed",
  unrelated: "glucose.hstix_unrelated",
};

export default function Hstix() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const mealSnapId = Number(params.get("mealSnapId"));
  const readingId = Number(params.get("readingId"));
  const validMealSnapId = Number.isInteger(mealSnapId) && mealSnapId > 0 ? mealSnapId : undefined;
  const validReadingId = Number.isInteger(readingId) && readingId > 0 ? readingId : undefined;
  const { data, refetch } = useQuery<{ readings: HstixReading[] }>({
    queryKey: ["/api/hstix/readings"],
    queryFn: async () => {
      const response = await fetch("/api/hstix/readings", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to fetch HStix readings");
      return response.json();
    },
  });
  const editingReading = validReadingId ? data?.readings.find(reading => reading.id === validReadingId) ?? null : null;
  const [correctionExpired, setCorrectionExpired] = useState(false);
  const handledExpiredReadingId = useRef<number | null>(null);
  const closeExpiredCorrection = useCallback((expiredReadingId?: number) => {
    const id = expiredReadingId ?? validReadingId;
    if (id !== undefined && handledExpiredReadingId.current === id) return;
    if (id !== undefined) handledExpiredReadingId.current = id;

    setCorrectionExpired(true);
    setLocation("/hstix");
    toast({
      title: t("common.error"),
      description: t("glucose.hstix_correction_expired"),
      variant: "destructive",
    });
    void refetch();
  }, [refetch, setLocation, t, toast, validReadingId]);
  // The URL is the correction-session boundary. Once expiry redirects to
  // /hstix, keep the same mounted page ready for a brand-new reading.
  const showEntryForm = !correctionExpired || !validReadingId;
  useEffect(() => {
    if (!editingReading) return;
    const expiresAt = new Date(editingReading.correctionExpiresAt).getTime();
    const expire = () => {
      closeExpiredCorrection(editingReading.id);
    };
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, delay + 10);
    return () => window.clearTimeout(timer);
  }, [closeExpiredCorrection, editingReading?.id, editingReading?.correctionExpiresAt]);
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

      {showEntryForm && (
        <PostMealCard
          standalone
          mealSnapId={validMealSnapId}
          hstixReadingId={validReadingId}
          initialValue={editingReading?.glucoseMmol ?? null}
          initialNote={editingReading?.note ?? null}
          onDone={() => {
            void refetch();
            if (validMealSnapId) setLocation("/food-log");
          }}
          onHstixCorrectionExpired={closeExpiredCorrection}
        />
      )}

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