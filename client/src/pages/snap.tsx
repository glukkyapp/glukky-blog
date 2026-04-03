import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Images, Loader2, RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImage } from "@/lib/compress-image";

type Step = "upload" | "labeling" | "review" | "advising" | "advice";

interface LabelResult {
  name: string | null;
  portion: string | null;
  sauces: string | null;
  extras: string | null;
  snapsUsedToday: number;
  snapsLimit: number;
}

interface TipEntry { key: string; timing: "immediate" | "future"; }
interface FocusPanelData { struggleKey: string; tips: TipEntry[]; }

interface AdviceResult {
  advice: string;
  focusPanelData?: FocusPanelData | null;
  adviceUsedToday: number;
  adviceLimit: number;
}

interface LabelForm {
  name: string;
  portion: string;
  sauces: string;
  extras: string;
}

const ADVICE_PREFIXES = ["🩸", "⚠️", "💡"] as const;

function parseAdvicePanels(advice: string): string[] {
  const lines = advice
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const ordered: string[] = [];
  for (const prefix of ADVICE_PREFIXES) {
    const match = lines.find((l) => l.startsWith(prefix));
    if (match) ordered.push(match);
  }

  if (ordered.length === 3) return ordered;

  return lines.slice(0, 3);
}

function FocusPanelContent({ data }: { data: FocusPanelData }) {
  const { t } = useTranslation();
  const struggleName = data.struggleKey === "portions"
    ? t("snap.focus_struggle_portions")
    : t(`struggle.${data.struggleKey}`);
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-center min-h-[64px] justify-center">
      <p>{t("snap.focus_heading", { struggle: struggleName })}</p>
      <div className="flex flex-col gap-2">
        {data.tips.map((tip, i) => (
          <p key={i}>
            {tip.timing === "immediate" ? (
              <>
                {t("snap.focus_immediate_prefix")}
                <em><strong>{t(tip.key)}</strong></em>
                {t("snap.focus_immediate_suffix")}
              </>
            ) : (
              <>
                {t("snap.focus_future_prefix")}
                <em><strong>{t(tip.key)}</strong></em>
              </>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

function CounterBadge({ used, limit, exhaustedKey, remainingKey }: {
  used: number;
  limit: number;
  exhaustedKey: string;
  remainingKey: string;
}) {
  const { t } = useTranslation();
  const remaining = limit - used;
  const exhausted = remaining <= 0;
  return (
    <p
      className={`text-xs text-center ${exhausted ? "text-destructive" : "text-muted-foreground"}`}
      data-testid="text-snap-counter"
    >
      {exhausted
        ? t(exhaustedKey, { limit })
        : t(remainingKey, { remaining, limit })}
    </p>
  );
}

export default function Snap() {
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [labelResult, setLabelResult] = useState<LabelResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState<LabelForm>({ name: "", portion: "", sauces: "", extras: "" });
  const [adviceResult, setAdviceResult] = useState<AdviceResult | null>(null);
  const [advicePanel, setAdvicePanel] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    setStep("upload");
    setError(null);
    setLabelResult(null);
    setPreviewUrl(null);
    setForm({ name: "", portion: "", sauces: "", extras: "" });
    setAdviceResult(null);
    setAdvicePanel(0);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setStep("labeling");

    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch("/api/snap/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const limit = data.snapsLimit ?? 3;
        setError(t("snap.error_limit_label", { limit }));
        setStep("upload");
        return;
      }

      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? t("snap.error_no_food"));
        setStep("upload");
        return;
      }

      if (!res.ok) {
        setError(t("snap.error_generic"));
        setStep("upload");
        return;
      }

      const data: LabelResult = await res.json();
      setLabelResult(data);
      setForm({
        name: data.name ?? "",
        portion: data.portion ?? "",
        sauces: data.sauces ?? "",
        extras: data.extras ?? "",
      });
      setStep("review");
    } catch {
      setError(t("snap.error_generic"));
      setStep("upload");
    }
  }

  async function handleGetAdvice() {
    if (!form.name.trim()) return;
    setError(null);
    setStep("advising");
    setAdvicePanel(0);

    try {
      const res = await fetch("/api/snap/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          portion: form.portion || null,
          sauces: form.sauces || null,
          extras: form.extras || null,
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const limit = data.adviceLimit ?? 6;
        setError(t("snap.error_limit_advice", { limit }));
        setStep("review");
        return;
      }

      if (!res.ok) {
        setError(t("snap.error_generic"));
        setStep("review");
        return;
      }

      const data: AdviceResult = await res.json();
      setAdviceResult(data);
      setStep("advice");
    } catch {
      setError(t("snap.error_generic"));
      setStep("review");
    }
  }

  const panels = adviceResult ? parseAdvicePanels(adviceResult.advice) : [];
  const focusPanelData = adviceResult?.focusPanelData ?? null;
  const totalPanels = panels.length + (focusPanelData ? 1 : 0);
  const isFocusPanel = focusPanelData !== null && advicePanel === panels.length;

  return (
    <div className="flex flex-col min-h-[70vh] px-5 gap-5 max-w-sm mx-auto w-full">
      <div
        className="relative w-full overflow-hidden -mx-5 -mt-0"
        style={{ height: "220px", width: "calc(100% + 2.5rem)" }}
        data-testid="hero-snap"
      >
        <div
          className="absolute left-1/2 bottom-0"
          style={{
            width: "140%",
            paddingBottom: "140%",
            transform: "translateX(-50%)",
            borderRadius: "50%",
            background: "linear-gradient(180deg, #a8b5a0 0%, #c2b9a7 60%, #d4cfc4 100%)",
          }}
        />
        <h1
          className="absolute inset-0 flex items-end justify-center pb-10 text-2xl font-bold text-white drop-shadow-md text-center px-6"
          data-testid="text-snap-title"
        >
          {t("snap.title")}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("snap.subtitle")}
      </p>

      {step === "upload" && (
        <div className="flex flex-col items-center gap-5 pt-6">
          {error && (
            <div
              className="w-full rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center"
              data-testid="text-snap-error"
            >
              {error}
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="input-snap-camera"
            onChange={handleFileSelect}
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="input-snap-album"
            onChange={handleFileSelect}
          />

          <div className="flex gap-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 w-36 h-36 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors cursor-pointer"
              data-testid="button-snap-camera"
            >
              <Camera className="w-9 h-9 text-primary/70" strokeWidth={1.5} />
              <span className="text-xs font-medium text-primary/80 text-center leading-tight px-2">
                {t("snap.take_photo_camera")}
              </span>
            </button>

            <button
              onClick={() => albumInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 w-36 h-36 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors cursor-pointer"
              data-testid="button-snap-album"
            >
              <Images className="w-9 h-9 text-primary/70" strokeWidth={1.5} />
              <span className="text-xs font-medium text-primary/80 text-center leading-tight px-2">
                {t("snap.upload_from_album")}
              </span>
            </button>
          </div>

          {labelResult && (
            <CounterBadge
              used={labelResult.snapsUsedToday}
              limit={labelResult.snapsLimit}
              exhaustedKey="snap.photos_exhausted"
              remainingKey="snap.photos_remaining"
            />
          )}
        </div>
      )}

      {step === "labeling" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16" data-testid="status-snap-labeling">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t("snap.analysing")}</p>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Food photo"
              className="w-full rounded-2xl object-cover max-h-52"
              data-testid="img-snap-preview"
            />
          )}

          <div>
            <p className="text-sm font-semibold">{t("snap.label_title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("snap.label_subtitle")}</p>
          </div>

          {error && (
            <div
              className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center"
              data-testid="text-snap-error"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="snap-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("snap.field_name")}
              </Label>
              <Input
                id="snap-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("snap.field_placeholder_name")}
                data-testid="input-snap-name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="snap-portion" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("snap.field_portion")}
              </Label>
              <Input
                id="snap-portion"
                value={form.portion}
                onChange={(e) => setForm((f) => ({ ...f, portion: e.target.value }))}
                placeholder={t("snap.field_placeholder_portion")}
                data-testid="input-snap-portion"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="snap-sauces" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("snap.field_sauces")}
              </Label>
              <Input
                id="snap-sauces"
                value={form.sauces}
                onChange={(e) => setForm((f) => ({ ...f, sauces: e.target.value }))}
                placeholder={t("snap.field_placeholder_sauces")}
                data-testid="input-snap-sauces"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="snap-extras" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("snap.field_extras")}
              </Label>
              <Input
                id="snap-extras"
                value={form.extras}
                onChange={(e) => setForm((f) => ({ ...f, extras: e.target.value }))}
                placeholder={t("snap.field_placeholder_extras")}
                data-testid="input-snap-extras"
              />
            </div>
          </div>

          {labelResult && (
            <CounterBadge
              used={labelResult.snapsUsedToday}
              limit={labelResult.snapsLimit}
              exhaustedKey="snap.photos_exhausted"
              remainingKey="snap.photos_remaining"
            />
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={handleGetAdvice}
              disabled={!form.name.trim()}
              className="w-full"
              data-testid="button-snap-get-advice"
            >
              {t("snap.get_advice")}
            </Button>
            <Button
              variant="ghost"
              onClick={reset}
              className="w-full text-muted-foreground gap-1.5"
              data-testid="button-snap-try-again"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("snap.try_again")}
            </Button>
          </div>
        </div>
      )}

      {step === "advising" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16" data-testid="status-snap-advising">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t("snap.getting_advice")}</p>
        </div>
      )}

      {step === "advice" && adviceResult && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold">{t("snap.advice_title")}</p>

          <div
            className="rounded-2xl border bg-card p-5 flex flex-col gap-5"
            data-testid="card-snap-advice"
          >
            <div
              data-testid={`text-snap-advice-panel-${advicePanel}`}
            >
              {isFocusPanel && focusPanelData ? (
                <FocusPanelContent data={focusPanelData} />
              ) : (
                <p className="text-sm leading-relaxed min-h-[64px] text-center">
                  {panels[advicePanel] ?? ""}
                </p>
              )}
            </div>

            {totalPanels > 1 && (
              <div className="flex items-center justify-center gap-2" data-testid="nav-snap-advice-dots">
                {Array.from({ length: totalPanels }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAdvicePanel(i)}
                    data-testid={`dot-snap-advice-${i}`}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === advicePanel
                        ? "bg-primary"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Panel ${i + 1}`}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {advicePanel < totalPanels - 1 ? (
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => setAdvicePanel((p) => p + 1)}
                  data-testid="button-snap-advice-next"
                >
                  {t("snap.next")}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : null}
              <Button
                className="flex-1"
                onClick={reset}
                data-testid="button-snap-advice-done"
              >
                {t("snap.done")}
              </Button>
            </div>
          </div>

          {adviceResult && (
            <CounterBadge
              used={adviceResult.adviceUsedToday}
              limit={adviceResult.adviceLimit}
              exhaustedKey="snap.advice_exhausted"
              remainingKey="snap.advice_remaining"
            />
          )}

          <Button
            variant="ghost"
            onClick={reset}
            className="w-full text-muted-foreground gap-1.5"
            data-testid="button-snap-new-photo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("snap.try_again")}
          </Button>
        </div>
      )}
    </div>
  );
}
