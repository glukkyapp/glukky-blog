import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Images, Loader2, RotateCcw, ChevronRight, UtensilsCrossed, Scale, Droplets, Cherry } from "lucide-react";
import cameraHeadingIcon from "@assets/4af4faa5-cdea-44a0-b7b9-b2ce91b8d499_removalai_preview_1776612731555.png";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compressImage } from "@/lib/compress-image";
import phoneBg from "@assets/cyucyu_a_smartphone_next_to_a_plate_of_food_as_if_it_is_takin__1775312483622.png";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useGate } from "@/App";
import { useGlobalLoading } from "@/components/global-loading-overlay";
import { track, trackException } from "@/lib/posthog";
import { timedFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const SNAP_TIMEOUT_MS = 45000;

type Step = "upload" | "labeling" | "review" | "advising" | "advice";

interface LabelResult {
  name: string | null;
  portion: string | null;
  portionId?: string | null;
  sauces: string | null;
  sauceIds?: string[];
  extras: string | null;
  toppingIds?: string[];
  canonicalName?: string;
  comboSource?: "database" | "claude";
  portionOptions?: string[];
  portionIdMap?: Record<string, string>;
  sauceOptions?: { id: string; label: string }[];
  toppingOptions?: { id: string; label: string }[];
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

interface TokenResolution {
  text: string;
  resolvedId: string | null;
}

interface LabelForm {
  name: string;
  portion: string;
  portionId: string | null;
  sauces: string;
  sauceIds: string[];
  sauceResolutions: TokenResolution[];
  extras: string;
  toppingIds: string[];
  toppingResolutions: TokenResolution[];
}

function parseAdvicePanels(advice: string): string[] {
  const lines = advice
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const bloodSugar = lines.find((l) => l.startsWith("🩸"));
  const watchOut = lines.find((l) => l.startsWith("⚠️"));
  const rightNow = lines.find((l) => l.startsWith("⚡"));
  const nextTime = lines.find((l) => l.startsWith("📝"));

  const panels: string[] = [];

  if (bloodSugar) panels.push(bloodSugar);

  if (watchOut) panels.push(watchOut);

  const adviceParts: string[] = [];
  if (rightNow) adviceParts.push(rightNow);
  if (nextTime) adviceParts.push(nextTime);
  if (adviceParts.length > 0) {
    panels.push(adviceParts.join("\n"));
  }

  if (panels.length >= 2) return panels;

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

function PointerLine({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const isTop = position.startsWith("top");
  const isLeft = position === "top-left" || position === "bottom-left";
  const r = 3.5;

  const w = 48;
  const gap = 28;
  const bendInset = 8;
  const totalH = gap + bendInset;
  const svgW = w + r * 2;
  const svgH = totalH + r * 2;

  const style: React.CSSProperties = {
    position: "absolute",
    width: svgW,
    height: svgH,
    pointerEvents: "none",
    zIndex: 10,
    ...(isTop ? { top: -(gap + r) } : { bottom: -(gap + r) }),
    ...(isLeft ? { left: -w + 20 } : { right: -w + 20 }),
  };

  const fieldX = isLeft ? r : svgW - r;
  const fieldY = isTop ? r : svgH - r;

  const bendX = fieldX;
  const bendY = isTop ? totalH + r : r;

  const circleX = isLeft ? svgW - r : r;
  const circleY = bendY;

  return (
    <svg style={style} viewBox={`0 0 ${svgW} ${svgH}`} fill="none">
      <polyline points={`${fieldX},${fieldY} ${bendX},${bendY} ${circleX},${circleY}`} stroke="hsl(30 25% 75%)" strokeWidth="1" fill="none" strokeLinejoin="round" />
      <circle cx={circleX} cy={circleY} r={r} fill="hsl(30 25% 75%)" />
      <circle cx={fieldX} cy={fieldY} r={r} fill="hsl(30 25% 75%)" />
    </svg>
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

interface DisambigItem {
  field: "sauce" | "topping";
  text: string;
  matches: { internalId: string; label: string }[];
}

export default function Snap() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const { showPaywall, refetchGate } = useGate();

  function handleSnapCompleted() {
    if (!user?.id) return;

    const key = `glukky_snap_completed_count_${user.id}`;
    const prev = Number(localStorage.getItem(key) ?? "0");
    const next = Number.isFinite(prev) ? prev + 1 : 1;
    localStorage.setItem(key, String(next));

    if (next === 2) {
      const lang = i18n.language;
      if (lang === "en") {
        track("snap_completed_2_en");
      } else if (lang === "zh-Hant" || lang === "yue") {
        track("snap_completed_2_zh");
      }
    }
  }

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [labelResult, setLabelResult] = useState<LabelResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState<LabelForm>({ name: "", portion: "", portionId: null, sauces: "", sauceIds: [], sauceResolutions: [], extras: "", toppingIds: [], toppingResolutions: [] });
  const [adviceResult, setAdviceResult] = useState<AdviceResult | null>(null);
  const [advicePanel, setAdvicePanel] = useState(0);
  const [disambigQueue, setDisambigQueue] = useState<DisambigItem[]>([]);
  const [disambigIndex, setDisambigIndex] = useState(0);
  const [sauceManual, setSauceManual] = useState(false);
  const [toppingManual, setToppingManual] = useState(false);

  useGlobalLoading(step === "labeling" || step === "advising");

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
    setForm({ name: "", portion: "", portionId: null, sauces: "", sauceIds: [], sauceResolutions: [], extras: "", toppingIds: [], toppingResolutions: [] });
    setAdviceResult(null);
    setAdvicePanel(0);
    setDisambigQueue([]);
    setDisambigIndex(0);
    setSauceManual(false);
    setToppingManual(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setStep("labeling");
    track("snap_started", { language: i18n.language });

    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await timedFetch("/api/snap/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: base64, mimeType, language: i18n.language }),
        timeoutMs: SNAP_TIMEOUT_MS,
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const limit = data.snapsLimit ?? 3;
        hapticNotify("ERROR");
        setError(t("snap.error_limit_label", { limit }));
        setStep("upload");
        track("snap_label_failed", { reason: "rate_limited", limit });
        return;
      }

      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        hapticNotify("ERROR");
        const code = (data as { code?: string }).code;
        if (code === "PARSE_FAILED") {
          setError(t("snap.error_parse_failed"));
        } else if (code === "NO_FOOD") {
          setError(t("snap.error_no_food"));
        } else {
          setError((data as { message?: string }).message ?? t("snap.error_no_food"));
        }
        setStep("upload");
        track("snap_label_failed", { reason: code || "unprocessable" });
        return;
      }

      if (!res.ok) {
        hapticNotify("ERROR");
        setError(t("snap.error_generic"));
        setStep("upload");
        track("snap_label_failed", { reason: "http_error", status: res.status });
        return;
      }

      const rawData = await res.json();
      if (rawData.showPaywall) {
        setStep("upload");
        refetchGate();
        track("snap_label_blocked", { feature: rawData.feature });
        showPaywall();
        return;
      }

      hapticNotify("SUCCESS");
      const data: LabelResult = rawData;
      setLabelResult(data);
      const sIds = data.sauceIds ?? [];
      const tIds = data.toppingIds ?? [];
      const sauceParts = (data.sauces ?? "").split(/[,、，]/).map(s => s.trim()).filter(Boolean);
      const extraParts = (data.extras ?? "").split(/[,、，]/).map(s => s.trim()).filter(Boolean);
      setForm({
        name: data.name ?? "",
        portion: data.portion ?? "",
        portionId: data.portionId ?? null,
        sauces: data.sauces ?? "",
        sauceIds: sIds,
        sauceResolutions: sauceParts.map((text, i) => ({ text, resolvedId: sIds[i] ?? null })),
        extras: data.extras ?? "",
        toppingIds: tIds,
        toppingResolutions: extraParts.map((text, i) => ({ text, resolvedId: tIds[i] ?? null })),
      });
      setStep("review");
      track("snap_label_succeeded", {
        comboSource: data.comboSource,
        hasName: !!data.name,
      });
    } catch (err) {
      hapticNotify("ERROR");
      setError(t("snap.error_generic"));
      setStep("upload");
      track("snap_label_failed", { reason: "exception" });
      trackException(err, { phase: "snap_label" });
    }
  }

  interface DisambigResult {
    resolved: TokenResolution[];
    ambiguous: DisambigItem[];
  }

  async function disambiguateField(text: string, field: "sauce" | "topping"): Promise<DisambigResult> {
    if (!text.trim()) return { resolved: [], ambiguous: [] };
    const parts = text.split(/[,、，]/).map(s => s.trim()).filter(Boolean);
    const resolved: TokenResolution[] = [];
    const ambiguous: DisambigItem[] = [];
    for (const part of parts) {
      try {
        const res = await timedFetch("/api/snap/disambiguate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: part, field, locale: i18n.language }),
          timeoutMs: SNAP_TIMEOUT_MS,
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.exact && data.matches.length > 0) {
            ambiguous.push({ field, text: part, matches: data.matches });
          } else if (data.exact && data.matches.length === 1) {
            resolved.push({ text: part, resolvedId: data.matches[0].internalId });
          } else {
            resolved.push({ text: part, resolvedId: null });
          }
        } else {
          resolved.push({ text: part, resolvedId: null });
        }
      } catch {
        resolved.push({ text: part, resolvedId: null });
      }
    }
    return { resolved, ambiguous };
  }

  const pendingResolutionsRef = useRef<{
    sauceResolutions: TokenResolution[];
    toppingResolutions: TokenResolution[];
  }>({ sauceResolutions: [], toppingResolutions: [] });

  async function handleGetAdvice() {
    if (!form.name.trim()) return;
    setError(null);

    const hasUnresolvedSauces = form.sauces.trim() && (
      form.sauceResolutions.length === 0 ||
      form.sauceResolutions.some(r => r.resolvedId === null)
    );
    const hasUnresolvedToppings = form.extras.trim() && (
      form.toppingResolutions.length === 0 ||
      form.toppingResolutions.some(r => r.resolvedId === null)
    );

    let finalSauceResolutions = form.sauceResolutions;
    let finalToppingResolutions = form.toppingResolutions;
    const queue: DisambigItem[] = [];

    if (hasUnresolvedSauces) {
      const result = await disambiguateField(form.sauces, "sauce");
      finalSauceResolutions = result.resolved;
      queue.push(...result.ambiguous);
    }
    if (hasUnresolvedToppings) {
      const result = await disambiguateField(form.extras, "topping");
      finalToppingResolutions = result.resolved;
      queue.push(...result.ambiguous);
    }

    setForm(f => ({
      ...f,
      sauceResolutions: finalSauceResolutions,
      sauceIds: finalSauceResolutions.filter(r => r.resolvedId).map(r => r.resolvedId!),
      toppingResolutions: finalToppingResolutions,
      toppingIds: finalToppingResolutions.filter(r => r.resolvedId).map(r => r.resolvedId!),
    }));

    if (queue.length > 0) {
      pendingResolutionsRef.current = {
        sauceResolutions: finalSauceResolutions,
        toppingResolutions: finalToppingResolutions,
      };
      setDisambigQueue(queue);
      setDisambigIndex(0);
      return;
    }

    await callAdviceApi(finalSauceResolutions, finalToppingResolutions);
  }

  function handleDisambigSelect(internalId: string | null) {
    const current = disambigQueue[disambigIndex];
    if (current) {
      const resolution: TokenResolution = { text: current.text, resolvedId: internalId };
      if (current.field === "sauce") {
        pendingResolutionsRef.current.sauceResolutions = [
          ...pendingResolutionsRef.current.sauceResolutions,
          resolution,
        ];
      } else {
        pendingResolutionsRef.current.toppingResolutions = [
          ...pendingResolutionsRef.current.toppingResolutions,
          resolution,
        ];
      }
    }
    hapticTap("LIGHT");
    if (disambigIndex < disambigQueue.length - 1) {
      setDisambigIndex(i => i + 1);
    } else {
      const finalSauce = pendingResolutionsRef.current.sauceResolutions;
      const finalTopping = pendingResolutionsRef.current.toppingResolutions;
      setForm(f => ({
        ...f,
        sauceResolutions: finalSauce,
        sauceIds: finalSauce.filter(r => r.resolvedId).map(r => r.resolvedId!),
        toppingResolutions: finalTopping,
        toppingIds: finalTopping.filter(r => r.resolvedId).map(r => r.resolvedId!),
      }));
      setDisambigQueue([]);
      setDisambigIndex(0);
      callAdviceApi(finalSauce, finalTopping);
    }
  }

  async function callAdviceApi(
    sauceRes?: TokenResolution[],
    toppingRes?: TokenResolution[],
    isRetryAfterUnlock = false,
  ) {
    setStep("advising");
    setAdvicePanel(0);
    track("snap_advice_started", { foodName: form.name || null });

    const finalSauceResolutions = sauceRes || form.sauceResolutions;
    const finalToppingResolutions = toppingRes || form.toppingResolutions;

    try {
      const res = await timedFetch("/api/snap/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          canonicalName: labelResult?.canonicalName || undefined,
          portion: form.portion || null,
          sauces: form.sauces || null,
          extras: form.extras || null,
          portionId: form.portionId || null,
          sauceResolutions: finalSauceResolutions.length > 0 ? finalSauceResolutions : undefined,
          toppingResolutions: finalToppingResolutions.length > 0 ? finalToppingResolutions : undefined,
          locale: i18n.language,
        }),
        timeoutMs: SNAP_TIMEOUT_MS,
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const limit = data.adviceLimit ?? 6;
        hapticNotify("ERROR");
        setError(t("snap.error_limit_advice", { limit }));
        setStep("review");
        track("snap_advice_failed", { reason: "rate_limited", limit });
        return;
      }

      if (!res.ok) {
        hapticNotify("ERROR");
        setError(t("snap.error_generic"));
        setStep("review");
        track("snap_advice_failed", { reason: "http_error", status: res.status });
        return;
      }

      const data = await res.json();

      if (data.showPaywall) {
        if (isRetryAfterUnlock) {
          // Post-unlock auto-retry came back still gated (rare server
          // gate lag). Don't re-open the paywall — that would loop.
          // Surface the standard error/retry surface on the review
          // screen and emit an event so we can see how often this
          // edge case actually happens.
          hapticNotify("ERROR");
          setError(t("snap.error_generic"));
          setStep("review");
          track("snap_advice_resume_still_blocked", { feature: data.feature });
          return;
        }
        setStep("review");
        refetchGate();
        track("snap_advice_blocked", { feature: data.feature });
        showPaywall(() => {
          callAdviceApi(sauceRes, toppingRes, true);
        });
        return;
      }

      hapticNotify("SUCCESS");
      setAdviceResult(data as AdviceResult);
      setStep("advice");
      track("snap_advice_succeeded", { adviceSource: data.adviceSource });
      handleSnapCompleted();
    } catch (err) {
      hapticNotify("ERROR");
      setError(t("snap.error_generic"));
      setStep("review");
      track("snap_advice_failed", { reason: "exception" });
      trackException(err, { phase: "snap_advice" });
    }
  }

  const panels = adviceResult ? parseAdvicePanels(adviceResult.advice) : [];
  const focusPanelData = adviceResult?.focusPanelData ?? null;
  const totalPanels = panels.length + (focusPanelData ? 1 : 0);
  const isFocusPanel = focusPanelData !== null && advicePanel === panels.length;

  return (
    <div className="app-page-v2 flex flex-col min-h-[70vh] px-5 pt-6 gap-5 max-w-sm mx-auto w-full pb-28">
      <div className="flex items-center gap-3">
        <img src={cameraHeadingIcon} alt="" className="w-14 h-14 shrink-0" data-testid="img-snap-heading-icon" />
        <h1
          className="text-[26px] font-bold uppercase tracking-wide text-left"
          data-testid="text-snap-heading"
        >
          {t("snap.heading")}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground text-center">
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
              onClick={() => { hapticTap("MEDIUM"); cameraInputRef.current?.click(); }}
              className="flex flex-col items-center justify-center gap-3 w-36 h-36 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors cursor-pointer btn-pop"
              data-testid="button-snap-camera"
            >
              <Camera className="w-9 h-9 text-primary/70" strokeWidth={1.5} />
              <span className="text-xs font-medium text-primary/80 text-center leading-tight px-2">
                {t("snap.take_photo_camera")}
              </span>
            </button>

            <button
              onClick={() => { hapticTap("MEDIUM"); albumInputRef.current?.click(); }}
              className="flex flex-col items-center justify-center gap-3 w-36 h-36 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors cursor-pointer btn-pop"
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

          <div className="relative px-1">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="snap-name" className="text-xs font-bold text-foreground tracking-wide flex items-center gap-1">
                  <UtensilsCrossed className="w-3 h-3" strokeWidth={2.5} />
                  {t("snap.field_name")}
                </Label>
                <textarea
                  id="snap-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("snap.field_placeholder_name")}
                  rows={2}
                  style={{ backgroundColor: "#fbfbf3" }}
                  className="flex w-full rounded-xl border border-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow duration-150 h-[4.5rem] resize-none leading-snug"
                  data-testid="input-snap-name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="snap-portion" className="text-xs font-bold text-foreground tracking-wide flex items-center gap-1 justify-end">
                  {t("snap.field_portion")}
                  <Scale className="w-3 h-3" strokeWidth={2.5} />
                </Label>
                <div className="flex flex-wrap gap-1.5 justify-end h-[4.5rem] items-start pt-1" data-testid="input-snap-portion">
                  {[
                    { key: "small", label: t("snap.portion_small") },
                    { key: "medium", label: t("snap.portion_medium") },
                    { key: "large", label: t("snap.portion_large") },
                  ].map((opt) => {
                    const isActive = form.portion.toLowerCase() === opt.key || form.portion === opt.label;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          hapticTap("LIGHT");
                          setForm((f) => ({
                            ...f,
                            portion: opt.label,
                            portionId: opt.key,
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-[#F4EBE4] text-muted-foreground border-input hover:bg-muted"
                        }`}
                        data-testid={`chip-portion-${opt.key}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {previewUrl && (
              <div className="relative mx-4 my-1" style={{ overflow: "visible" }}>
                <PointerLine position="top-left" />
                <PointerLine position="top-right" />
                <PointerLine position="bottom-left" />
                <PointerLine position="bottom-right" />
                <img
                  src={previewUrl}
                  alt="Food photo"
                  className="w-full rounded-2xl object-cover max-h-56"
                  data-testid="img-snap-preview"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="snap-sauces" className="text-xs font-bold text-foreground tracking-wide flex items-center gap-1">
                  <Droplets className="w-3 h-3" strokeWidth={2.5} />
                  {t("snap.field_sauces")}
                </Label>
                {labelResult?.comboSource === "database" && labelResult?.sauceOptions?.length && !sauceManual ? (
                  <div className="flex flex-wrap gap-1.5 h-[4.5rem] items-start pt-1 overflow-y-auto" data-testid="dropdown-snap-sauces">
                    {labelResult.sauceOptions.map((opt) => {
                      const selected = form.sauceIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            hapticTap("LIGHT");
                            setForm((f) => {
                              const ids = selected ? f.sauceIds.filter(id => id !== opt.id) : [...f.sauceIds, opt.id];
                              const labels = ids.map(id => labelResult.sauceOptions!.find(o => o.id === id)?.label).filter(Boolean);
                              return { ...f, sauceIds: ids, sauces: labels.join(", "), sauceResolutions: ids.map(id => ({ text: labelResult.sauceOptions!.find(o => o.id === id)?.label ?? id, resolvedId: id })) };
                            });
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-[#F4EBE4] text-muted-foreground border-input hover:bg-muted"
                          }`}
                          data-testid={`chip-sauce-${opt.id}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        hapticTap("LIGHT");
                        setSauceManual(true);
                        setForm((f) => ({ ...f, sauces: "", sauceIds: [], sauceResolutions: [] }));
                      }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                      data-testid="chip-sauce-other"
                    >
                      {t("snap.something_else")}
                    </button>
                  </div>
                ) : (
                  <textarea
                    id="snap-sauces"
                    value={form.sauces}
                    onChange={(e) => setForm((f) => ({ ...f, sauces: e.target.value, sauceIds: [], sauceResolutions: [] }))}
                    placeholder={t("snap.field_placeholder_sauces")}
                    rows={2}
                    style={{ backgroundColor: "#fbfbf3" }}
                    className="flex w-full rounded-xl border border-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow duration-150 h-[4.5rem] resize-none leading-snug"
                    data-testid="input-snap-sauces"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="snap-extras" className="text-xs font-bold text-foreground tracking-wide flex items-center gap-1 justify-end">
                  {t("snap.field_extras")}
                  <Cherry className="w-3 h-3" strokeWidth={2.5} />
                </Label>
                {labelResult?.comboSource === "database" && labelResult?.toppingOptions?.length && !toppingManual ? (
                  <div className="flex flex-wrap gap-1.5 justify-end h-[4.5rem] items-start pt-1 overflow-y-auto" data-testid="dropdown-snap-extras">
                    {labelResult.toppingOptions.map((opt) => {
                      const selected = form.toppingIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            hapticTap("LIGHT");
                            setForm((f) => {
                              const ids = selected ? f.toppingIds.filter(id => id !== opt.id) : [...f.toppingIds, opt.id];
                              const labels = ids.map(id => labelResult.toppingOptions!.find(o => o.id === id)?.label).filter(Boolean);
                              return { ...f, toppingIds: ids, extras: labels.join(", "), toppingResolutions: ids.map(id => ({ text: labelResult.toppingOptions!.find(o => o.id === id)?.label ?? id, resolvedId: id })) };
                            });
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-[#F4EBE4] text-muted-foreground border-input hover:bg-muted"
                          }`}
                          data-testid={`chip-topping-${opt.id}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        hapticTap("LIGHT");
                        setToppingManual(true);
                        setForm((f) => ({ ...f, extras: "", toppingIds: [], toppingResolutions: [] }));
                      }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                      data-testid="chip-topping-other"
                    >
                      {t("snap.something_else")}
                    </button>
                  </div>
                ) : (
                  <textarea
                    id="snap-extras"
                    value={form.extras}
                    onChange={(e) => setForm((f) => ({ ...f, extras: e.target.value, toppingIds: [], toppingResolutions: [] }))}
                    placeholder={t("snap.field_placeholder_extras")}
                    rows={2}
                    style={{ backgroundColor: "#fbfbf3" }}
                    className="flex w-full rounded-xl border border-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow duration-150 h-[4.5rem] resize-none text-right leading-snug"
                    data-testid="input-snap-extras"
                  />
                )}
              </div>
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

          {disambigQueue.length > 0 && disambigQueue[disambigIndex] && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3" data-testid="dialog-disambiguate">
              <p className="text-sm font-medium text-center">
                {t("snap.did_you_mean", { text: disambigQueue[disambigIndex].text })}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {disambigQueue[disambigIndex].matches.map((m) => (
                  <button
                    key={m.internalId}
                    onClick={() => handleDisambigSelect(m.internalId)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#F4EBE4] border border-input hover:bg-primary hover:text-primary-foreground transition-colors"
                    data-testid={`chip-disambig-${m.internalId}`}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  onClick={() => handleDisambigSelect(null)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-input hover:bg-muted/80 transition-colors"
                  data-testid="button-disambig-keep"
                >
                  {t("snap.keep_as_typed")}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={() => { hapticTap("MEDIUM"); handleGetAdvice(); }}
              disabled={!form.name.trim() || disambigQueue.length > 0}
              className="w-full btn-pop h-14 text-base font-semibold rounded-2xl shadow-md text-white hover:brightness-105"
              style={{ backgroundColor: "#F08A3E" }}
              data-testid="button-snap-get-advice"
            >
              {t("snap.get_advice")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { hapticTap("SOFT"); reset(); }}
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
            className="rounded-2xl p-5 flex flex-col gap-5"
            style={{ background: "#fbfbf3", boxShadow: "0 4px 14px rgba(44, 72, 56, 0.06)" }}
            data-testid="card-snap-advice"
          >
            <div
              data-testid={`text-snap-advice-panel-${advicePanel}`}
            >
              {isFocusPanel && focusPanelData ? (
                <FocusPanelContent data={focusPanelData} />
              ) : (
                <div className="text-sm leading-relaxed min-h-[64px] text-left flex flex-col gap-3">
                  {(panels[advicePanel] ?? "").split("\n").map((line, i) => {
                    const colonIdx = line.indexOf(": ");
                    if (colonIdx === -1) {
                      return <p key={i}>{line}</p>;
                    }
                    const heading = line.slice(0, colonIdx + 1);
                    const body = line.slice(colonIdx + 2);
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <p className="text-[21px] font-bold leading-snug">{heading}</p>
                        <p>{body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {totalPanels > 1 && (
              <div className="flex items-center justify-center gap-2" data-testid="nav-snap-advice-dots">
                {Array.from({ length: totalPanels }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { hapticTap("SOFT"); setAdvicePanel(i); }}
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
                  onClick={() => { hapticTap("SOFT"); setAdvicePanel((p) => p + 1); }}
                  data-testid="button-snap-advice-next"
                >
                  {t("snap.next")}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : null}
              <Button
                className="flex-1"
                onClick={() => { hapticTap("SOFT"); reset(); }}
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
            onClick={() => { hapticTap("SOFT"); reset(); }}
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
