import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearch } from "wouter";
import PostMealCard from "@/components/PostMealCard";
import { GlucoseGuidanceInline, GlucoseMonitoringGuidance } from "@/components/glucose-monitoring-guidance";
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
  const [entryElement, setEntryElement] = useState<HTMLElement | null>(null);
  const [activeGuidance, setActiveGuidance] = useState<"hstix" | "meal-pattern" | "food-pattern" | null>(null);
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
  const headerDate = editingReading ? new Date(editingReading.recordedAt) : new Date();
  const nowLabel = new Intl.DateTimeFormat(dateLocale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(headerDate);
  const backLabel = t("glucose.hstix_back");
  const guidanceCandidates = useMemo(() => [{
    kind: "hstix" as const,
    // A meal-log link is contextual editing, not a voluntarily opened manual
    // monitoring screen. Home and direct HStix visits remain eligible.
    eligible: showEntryForm && !validMealSnapId,
    element: entryElement,
  }], [entryElement, i18n.language, showEntryForm, validMealSnapId]);

  return (
    <main className="min-h-screen bg-[#FCFBF2] pb-28">
      <div className="mx-auto w-full max-w-md space-y-5 px-4 pt-3">
        <header className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
            aria-label={backLabel}
            className="flex min-h-12 items-center gap-1 rounded-xl bg-[#F0EFEB] px-2 text-sm font-bold text-[#00583A]"
            data-testid="button-hstix-back"
          >
            <ArrowLeft className="h-6 w-6" />
            <span>{backLabel}</span>
          </button>
          <div className="min-w-0 text-center">
            <h1 className="text-xl font-bold text-foreground">{t("glucose.hstix_heading", "HStix")}</h1>
            <time className="mt-0.5 block text-xs font-medium text-muted-foreground">{nowLabel}</time>
          </div>
          <div aria-hidden="true" />
        </header>

        {validMealSnapId && (
          <p className="rounded-xl bg-[#F5F3EE] px-3 py-2 text-center text-xs text-muted-foreground">
            {t("glucose.hstix_subheading", "Record a glucose reading any time. A meal is optional.")}
          </p>
        )}

        {showEntryForm && (
          <section ref={setEntryElement}>
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
            {!validMealSnapId && <GlucoseGuidanceInline kind="hstix" hidden={activeGuidance === "hstix"} />}
          </section>
        )}

        <section aria-labelledby="hstix-history-heading" className="space-y-3 pt-1">
          <h2 id="hstix-history-heading" className="text-base font-semibold text-foreground">
            {t("glucose.hstix_history", "Reading history")}
          </h2>
          {data?.readings?.length ? (
            <ul className="space-y-2">
              {data.readings.map((reading) => (
                <li key={reading.id} className="rounded-2xl bg-white px-4 py-3 shadow-[0_4px_16px_rgba(30,58,95,0.05)]">
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
                  {reading.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{reading.note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-[#F5F3EE] px-4 py-5 text-sm text-muted-foreground">
              {t("glucose.hstix_empty", "Your saved readings will appear here.")}
            </p>
          )}
        </section>
        <GlucoseMonitoringGuidance candidates={guidanceCandidates} onActiveChange={setActiveGuidance} />
      </div>
    </main>
  );
}