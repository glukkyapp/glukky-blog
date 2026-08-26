import { useLocation } from "wouter";
import { Camera, ChartNoAxesCombined, Droplets } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

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

export default function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: hstixReadings } = useQuery<HstixReadingsResponse>({
    queryKey: ["/api/hstix/readings"],
    queryFn: async () => {
      const response = await fetch("/api/hstix/readings", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to fetch HStix readings");
      return response.json();
    },
  });
  const correctableHstixReading = hstixReadings?.latestCorrectableReading ?? null;

  const openHstixSheet = () => {
    const params = new URLSearchParams();
    if (correctableHstixReading) params.set("readingId", String(correctableHstixReading.id));
    setLocation(`/hstix${params.size ? `?${params.toString()}` : ""}`);
  };

  return (
    <main className="app-page-v2 max-w-sm mx-auto px-4 pt-8 pb-24 space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">Glukky</h1>
        <p className="text-muted-foreground">{t("home.welcome", { defaultValue: "Build food insights from your own readings." })}</p>
      </header>
      <Button className="w-full h-16 text-base btn-pop" onClick={() => setLocation("/snap")} data-testid="button-home-snap">
        <Camera className="w-5 h-5 mr-2" />
        {t("nav.snap")}
      </Button>
      <Button variant="outline" className="w-full h-14" onClick={() => setLocation("/report")} data-testid="button-home-report">
        <ChartNoAxesCombined className="w-5 h-5 mr-2" />
        {t("nav.report", { defaultValue: "Reports" })}
      </Button>
      <section aria-label={t("glucose.hstix_heading")} data-testid="section-home-hstix">
        {correctableHstixReading ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="font-semibold tabular-nums text-emerald-950" data-testid="text-home-hstix-saved">
              {t("glucose.hstix_home_saved", { value: correctableHstixReading.glucoseMmol.toFixed(1) })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openHstixSheet}
              data-testid="button-home-hstix-change"
            >
              {t("glucose.hstix_home_change")}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full h-14"
            onClick={openHstixSheet}
            data-testid="button-home-hstix-record"
          >
            <Droplets className="w-5 h-5 mr-2" />
            {t("glucose.hstix_home_record")}
          </Button>
        )}
      </section>
    </main>
  );
}