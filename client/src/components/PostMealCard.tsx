import { useEffect, useState, useRef } from "react";
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
import { ChevronUp, ChevronDown, Delete } from "lucide-react";
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

const INTEGER_RANGE = Array.from({ length: 19 }, (_, i) => i + 2);
const DEFAULT_INT_IDX = 8;
const DECIMAL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function IntegerWheel({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  const [wheelIdx, setWheelIdx] = useState(DEFAULT_INT_IDX);
  const displayIdx = value !== null ? INTEGER_RANGE.indexOf(value) : wheelIdx;
  const touchLastY = useRef<number | null>(null);
  const touchAccum = useRef(0);
  const STEP_PX = 20;

  const go = (delta: number) => {
    const newIdx = Math.max(0, Math.min(INTEGER_RANGE.length - 1, displayIdx + delta));
    setWheelIdx(newIdx);
    hapticTap("SOFT");
    onChange(INTEGER_RANGE[newIdx]);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchLastY.current = e.touches[0].clientY;
    touchAccum.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchLastY.current === null) return;
    const dy = touchLastY.current - e.touches[0].clientY;
    touchLastY.current = e.touches[0].clientY;
    touchAccum.current += dy;
    const steps = Math.trunc(touchAccum.current / STEP_PX);
    if (steps !== 0) {
      go(steps);
      touchAccum.current -= steps * STEP_PX;
    }
  };
  const onTouchEnd = () => {
    touchLastY.current = null;
    touchAccum.current = 0;
  };

  const prevVal = displayIdx > 0 ? INTEGER_RANGE[displayIdx - 1] : null;
  const currVal = INTEGER_RANGE[displayIdx];
  const nextVal = displayIdx < INTEGER_RANGE.length - 1 ? INTEGER_RANGE[displayIdx + 1] : null;
  const isSelected = value !== null;

  return (
    <div className="flex flex-col items-center select-none" data-testid="int-wheel">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={displayIdx <= 0}
        data-testid="button-int-wheel-up"
        className="p-2 text-muted-foreground disabled:opacity-20 transition-opacity active:scale-95"
        aria-label="decrease"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      <div
        className="relative flex flex-col items-center overflow-hidden w-24"
        style={{ height: 116 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        data-testid="int-wheel-body"
      >
        <div
          className="absolute left-0 right-0 border-t border-foreground/10"
          style={{ top: 36 }}
        />
        <div
          className="absolute left-0 right-0 border-b border-foreground/10"
          style={{ top: 80 }}
        />

        <div
          className="flex items-center justify-center"
          style={{ height: 36, opacity: prevVal !== null ? 0.25 : 0 }}
        >
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {prevVal ?? ""}
          </span>
        </div>

        <div className="flex items-center justify-center" style={{ height: 44 }}>
          <span
            className={`text-5xl font-bold tabular-nums transition-colors ${
              isSelected ? "text-foreground" : "text-muted-foreground/40"
            }`}
            data-testid="text-int-wheel-current"
          >
            {currVal}
          </span>
        </div>

        <div
          className="flex items-center justify-center"
          style={{ height: 36, opacity: nextVal !== null ? 0.25 : 0 }}
        >
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {nextVal ?? ""}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        disabled={displayIdx >= INTEGER_RANGE.length - 1}
        data-testid="button-int-wheel-down"
        className="p-2 text-muted-foreground disabled:opacity-20 transition-opacity active:scale-95"
        aria-label="increase"
      >
        <ChevronDown className="w-5 h-5" />
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

  const handleBackspace = () => {
    hapticTap("SOFT");
    if (decPart !== null) {
      setDecPart(null);
    } else {
      setIntPart(null);
    }
  };

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
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hstix/readings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/meal-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/glucose-patterns"] });
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

  const cardStyle: React.CSSProperties = {
    background: "#fbfbf3",
    boxShadow: "0 4px 14px rgba(44,72,56,0.06)",
  };

  const alertTitleKey =
    alertType === "low" ? "glucose.alert_low_title" : "glucose.alert_high_title";
  const alertBodyKey =
    alertType === "low" ? "glucose.alert_low_body" : "glucose.alert_high_body";
  const alertBodyLines = alertType ? t(alertBodyKey).split("\n") : [];

  return (
    <>
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={cardStyle}
        data-testid="card-post-meal-keypad"
      >
          <p className="text-sm font-medium text-foreground">{t("glucose.keypad_title")}</p>

          <div className="flex items-center justify-center gap-2">
            <span
              className="text-4xl font-bold tabular-nums text-foreground"
              data-testid="text-post-meal-reading"
            >
              {intPart !== null ? intPart : "–"}.{decPart !== null ? decPart : "–"}
            </span>
            <span className="text-sm text-muted-foreground">{t("glucose.keypad_unit")}</span>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={intPart === null && decPart === null}
              data-testid="button-post-meal-backspace"
              className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors active:scale-95"
              aria-label="backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <p className="text-xs text-muted-foreground/70 mb-0.5">
              {t("glucose.alert_scroll_hint")}
            </p>
            <IntegerWheel value={intPart} onChange={setIntPart} />
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {DECIMAL_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { hapticTap("SOFT"); setDecPart(n); }}
                data-testid={`button-post-meal-dec-${n}`}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  decPart === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                .{n}
              </button>
            ))}
          </div>

          {standalone && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("glucose.hstix_note_label", "Note (optional)")}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("glucose.hstix_note_placeholder", "Add a note")}
                data-testid="input-hstix-note"
              />
            </label>
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
        >
          {t("glucose.keypad_confirm")}
        </Button>
        <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-disclaimer-hstix">
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
