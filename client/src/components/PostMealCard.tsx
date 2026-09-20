import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Minus, Plus, ShieldCheck } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
import { track } from "@/lib/posthog";

interface Props {
  onDone: (result?: { reading?: { id: number }; correctionExpiresAt?: string }) => void;
  standalone?: boolean;
  initialValue?: number | null;
  initialNote?: string | null;
  hstixReadingId?: number;
  mealSnapId?: number;
  onHstixCorrectionExpired?: (readingId?: number) => void;
}

const MIN_INTEGER = 2;
const MAX_INTEGER = 20;
const DEFAULT_INTEGER = 5;
const DECIMAL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const NOTE_PRESETS = [
  "glucose.preset_after_medication",
  "glucose.preset_feeling_well",
  "glucose.preset_mild_dizziness",
  "glucose.preset_large_meal",
  "glucose.preset_walk",
  "glucose.preset_water",
  "glucose.preset_veg",
  "glucose.preset_early",
] as const;
const NOTE_PRESET_SEPARATOR = /[\n\r,，、;；。!?！？]+/;

function normalizeNoteSegment(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-HK")
    .replace(/\s+/g, " ")
    .trim();
}

function noteContainsPreset(note: string, preset: string): boolean {
  const normalizedPreset = normalizeNoteSegment(preset);
  return note
    .split(NOTE_PRESET_SEPARATOR)
    .map(normalizeNoteSegment)
    .some((segment) => segment === normalizedPreset);
}

function appendNotePreset(note: string, preset: string): string {
  if (noteContainsPreset(note, preset)) return note;
  const separator = note.length > 0 && !/\s$/.test(note) ? "\n" : "";
  const nextNote = `${note}${separator}${preset}`;
  return nextNote.length <= 500 ? nextNote : note;
}

function IntegerStepper({
  value,
  decimal,
  unit,
  onChange,
  decreaseLabel,
  increaseLabel,
}: {
  value: number | null;
  decimal: number | null;
  unit: string;
  onChange: (n: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const go = (delta: number) => {
    const current = value ?? DEFAULT_INTEGER;
    const next = Math.max(MIN_INTEGER, Math.min(MAX_INTEGER, current + delta));
    hapticTap("SOFT");
    onChange(next);
  };

  return (
    <div className="flex w-full items-center justify-between gap-3" data-testid="int-stepper">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={value === MIN_INTEGER}
        data-testid="button-post-meal-int-minus"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F0EFEB] text-[#00583A] shadow-sm transition-transform active:scale-90 disabled:opacity-30"
        aria-label={decreaseLabel}
      >
        <Minus className="h-8 w-8 stroke-[3]" />
      </button>
      <div className="flex min-w-0 flex-1 justify-center overflow-hidden">
        <div className="flex min-w-0 items-baseline whitespace-nowrap">
          <span
            className={`text-[2.5rem] font-extrabold tabular-nums tracking-tight ${
              value === null ? "text-[#00583A]/35" : "text-[#00583A]"
            }`}
            data-testid="text-post-meal-reading"
          >
            {value === null ? "–" : value}
          </span>
          <span
            className={`text-[2.5rem] font-extrabold tabular-nums tracking-tight ${
              decimal === null ? "text-[#00583A]/35" : "text-[#00583A]"
            }`}
            data-testid="text-post-meal-decimal"
          >
            .{decimal === null ? "–" : decimal}
          </span>
          <span className="ml-2 text-xs font-bold text-foreground/65">{unit}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={value === MAX_INTEGER}
        data-testid="button-post-meal-int-plus"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F0EFEB] text-[#00583A] shadow-sm transition-transform active:scale-90 disabled:opacity-30"
        aria-label={increaseLabel}
      >
        <Plus className="h-8 w-8 stroke-[3]" />
      </button>
    </div>
  );
}

export default function PostMealCard({
  onDone,
  standalone = false,
  initialValue = null,
  initialNote = null,
  hstixReadingId,
  mealSnapId,
  onHstixCorrectionExpired,
}: Props) {
  const { t } = useTranslation();
  const [intPart, setIntPart] = useState<number | null>(null);
  const [decPart, setDecPart] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertType, setAlertType] = useState<"low" | "high" | null>(null);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    if (!standalone) return;
    if (initialValue !== null) {
      const tenths = Math.round(initialValue * 10);
      setIntPart(Math.floor(tenths / 10));
      setDecPart(Math.abs(tenths % 10));
    }
    setNote(initialNote ?? "");
  }, [initialNote, initialValue, standalone]);

  const glucoseValue =
    intPart !== null && decPart !== null
      ? parseFloat(`${intPart}.${decPart}`)
      : null;

  const canConfirmKeypad = glucoseValue !== null;

  const handleConfirmKeypad = () => {
    hapticTap("LIGHT");
    if (submitting) return;
    if (glucoseValue === null) return;
    if (glucoseValue < 4.0) {
      setAlertType("low");
      return;
    }
    if (glucoseValue > 13.0) {
      setAlertType("high");
      return;
    }
    void submit();
  };

  const handleAlertConfirm = () => {
    hapticTap("LIGHT");
    setAlertType(null);
    void submit();
  };

  const handleAlertCancel = () => {
    hapticTap("SOFT");
    setAlertType(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(false);
    try {
      if (glucoseValue === null) return;
      const response = await apiRequest(hstixReadingId ? "PATCH" : "POST", hstixReadingId ? `/api/hstix/readings/${hstixReadingId}` : "/api/hstix/readings", {
        glucoseMmol: glucoseValue,
        ...(mealSnapId != null ? { mealSnapId } : {}),
        note: note.trim() || null,
      });
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hstix/readings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/meal-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/glucose-patterns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/daily-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/daily-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/glucose-thresholds"] });
      if (!hstixReadingId) {
        queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      }
      track("glucose_completed", { recorded: true });
      onDone(result);
    } catch (e) {
      console.error("[PostMealCard] submit error:", e);
      if (standalone && hstixReadingId && String(e).includes("HSTIX_CORRECTION_EXPIRED")) {
        onHstixCorrectionExpired?.(hstixReadingId);
        return;
      }
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const alertTitleKey =
    alertType === "low" ? "glucose.alert_low_title" : "glucose.alert_high_title";
  const alertBodyKey =
    alertType === "low" ? "glucose.alert_low_body" : "glucose.alert_high_body";
  const alertBodyLines = alertType ? t(alertBodyKey).split("\n") : [];
  const copy = {
    entryTitle: t("glucose.hstix_entry_title"),
    decimalHint: t("glucose.hstix_decimal_hint"),
    decimalAction: t("glucose.hstix_decimal_action"),
    remarksTitle: t("glucose.hstix_remarks_title"),
    decrease: t("glucose.hstix_decrease_integer"),
    increase: t("glucose.hstix_increase_integer"),
  };

  return (
    <>
      <div className="flex flex-col gap-5" data-testid="card-post-meal-keypad">
        <section className="rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(30,58,95,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold tracking-wide text-foreground/75">{copy.entryTitle}</p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAE9E5] px-3 py-1 text-xs font-semibold text-[#00583A]">
              <ShieldCheck className="h-4 w-4" />
              {t("glucose.keypad_unit")}
            </span>
          </div>
          <div className="relative">
            <IntegerStepper
              value={intPart}
              decimal={decPart}
              unit={t("glucose.keypad_unit")}
              onChange={setIntPart}
              decreaseLabel={copy.decrease}
              increaseLabel={copy.increase}
            />
          </div>
          <div className="mb-2 mt-5 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{copy.decimalHint}</span>
            <span className="shrink-0 font-semibold text-[#00583A]">{copy.decimalAction}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DECIMAL_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  hapticTap("SOFT");
                  if (intPart === null) setIntPart(DEFAULT_INTEGER);
                  setDecPart(n);
                }}
                aria-pressed={decPart === n}
                data-testid={`button-post-meal-dec-${n}`}
                className={`min-h-12 rounded-xl text-sm font-bold transition-colors ${
                  decPart === n
                    ? "bg-[#00583A] text-white shadow-sm"
                    : "bg-[#F0EFEB] text-foreground hover:bg-[#E7E6E2]"
                }`}
              >
                .{n}
              </button>
            ))}
          </div>
        </section>

        {standalone && (
          <section className="rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(30,58,95,0.06)]">
            <h2 className="mb-3 text-sm font-bold text-foreground">{copy.remarksTitle}</h2>
            <div className="mb-3 flex flex-wrap gap-2" data-testid="hstix-note-presets">
              {NOTE_PRESETS.map((key) => {
                const preset = t(key);
                const hasPreset = noteContainsPreset(note, preset);
                const separatorLength = note.length > 0 && !/\s$/.test(note) ? 1 : 0;
                const hasRoom = note.length + separatorLength + preset.length <= 500;
                return <button type="button" key={key} disabled={hasPreset || !hasRoom}
                  aria-pressed={hasPreset}
                  onClick={() => {
                    hapticTap("SOFT");
                    setNote((current) => appendNotePreset(current, preset));
                  }}
                  className={`min-h-12 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                    hasPreset ? "bg-[#00583A] text-white" : "bg-[#F0EFEB] text-foreground/75"
                  } disabled:opacity-70`}
                  data-testid={`button-hstix-preset-${key.split("_").pop()}`}>{preset}</button>;
              })}
            </div>
            <label className="block">
              <span className="sr-only">{t("glucose.hstix_note_label", "Note (optional)")}</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={2}
                className="w-full resize-none rounded-xl border-0 bg-[#F5F3EE] px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-[#00583A]/25"
                placeholder={t("glucose.hstix_note_placeholder", "Add a note")}
                data-testid="input-hstix-note"
              />
            </label>
          </section>
        )}

        {submitError && (
          <p className="text-xs text-destructive text-center">
            {t("common.error")}{" "}
            <button type="button" className="underline" onClick={() => void submit()}>
              {t("common.retry", "Try again")}
            </button>
          </p>
        )}
        <Button
          onClick={handleConfirmKeypad}
          disabled={!canConfirmKeypad || submitting}
          data-testid="button-post-meal-confirm-keypad"
          className="min-h-14 rounded-2xl bg-[#00583A] text-base font-bold text-white shadow-lg hover:bg-[#00472F]"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          {t("glucose.keypad_confirm")}
        </Button>
        <p className="flex items-start gap-2 rounded-xl bg-[#F5F3EE] p-3 text-center text-xs leading-relaxed text-muted-foreground" data-testid="text-disclaimer-hstix">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00583A]" />
          {t("disclaimer.hstix")}
        </p>
      </div>

      <Dialog open={alertType !== null} onOpenChange={(open) => { if (!open) setAlertType(null); }}>
        <DialogContent data-testid={`dialog-glucose-alert-${alertType ?? "none"}`}>
          <DialogHeader>
            <DialogTitle className="text-base">
              {alertType ? t(alertTitleKey) : ""}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-1.5 mt-1">
                {alertBodyLines.map((line, i) => (
                  <p key={i} className="text-sm text-foreground/80 leading-snug">
                    {line}
                  </p>
                ))}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={handleAlertConfirm} data-testid="button-glucose-alert-confirm">
              {t("glucose.alert_confirm")}
            </Button>
            <Button variant="outline" onClick={handleAlertCancel} data-testid="button-glucose-alert-cancel">
              {alertType === "low" ? t("glucose.alert_cancel_record") : t("glucose.alert_cancel")}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1 leading-relaxed">
            {t("glucose.alert_disclaimer")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
