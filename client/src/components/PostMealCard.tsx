import { useState, useRef } from "react";
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
  snapId: number;
  hasFastingBaseline: boolean;
  onDone: () => void;
  initialStep?: "ask" | "keypad";
}

type Step = "ask" | "keypad" | "symptom" | "walked";

const INTEGER_RANGE = Array.from({ length: 19 }, (_, i) => i + 2);
const DEFAULT_INT_IDX = 8;
const DECIMAL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const FASTING_OPTIONS = [4.5, 5.0, 5.5, 6.0, 6.5];
const SYMPTOM_OPTIONS = [
  { value: "normal",         labelKey: "glucose.symptom_normal"  },
  { value: "tired",          labelKey: "glucose.symptom_tired"   },
  { value: "blurred_vision", labelKey: "glucose.symptom_blurred" },
  { value: "thirsty",        labelKey: "glucose.symptom_thirsty" },
];

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

export default function PostMealCard({ snapId, hasFastingBaseline, onDone, initialStep }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(initialStep ?? "ask");
  const [intPart, setIntPart] = useState<number | null>(null);
  const [decPart, setDecPart] = useState<number | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [selectedFasting, setSelectedFasting] = useState<number | null>(null);
  const [fastingUnknown, setFastingUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alertType, setAlertType] = useState<"low" | "high" | null>(null);
  const [walkedAnswer, setWalkedAnswer] = useState<boolean | null>(null);
  const [submitError, setSubmitError] = useState(false);

  const glucoseValue =
    intPart !== null && decPart !== null
      ? parseFloat(`${intPart}.${decPart}`)
      : null;

  const fastingSelected = hasFastingBaseline || selectedFasting !== null || fastingUnknown;
  const canConfirmKeypad = glucoseValue !== null && fastingSelected;

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
    if (glucoseValue === null) return;
    if (glucoseValue < 4.0) {
      setAlertType("low");
      return;
    }
    if (glucoseValue > 13.0) {
      setAlertType("high");
      return;
    }
    setStep("walked");
  };

  const handleAlertConfirm = () => {
    hapticTap("LIGHT");
    setAlertType(null);
    setStep("walked");
  };

  const handleAlertCancel = () => {
    hapticTap("SOFT");
    setAlertType(null);
  };

  const submit = async (skip: boolean, walked: boolean | null = null) => {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const isSymptomOnly = !skip && glucoseValue === null;
      await apiRequest("POST", "/api/snap/post-meal", {
        snapId,
        ...(skip
          ? { skip: true }
          : isSymptomOnly
          ? { symptom }
          : {
              glucoseMmol: glucoseValue,
              ...(!hasFastingBaseline && !fastingUnknown && selectedFasting !== null
                ? { fastingBaseline: selectedFasting, fastingBaselineEstimated: false }
                : {}),
              ...(walked !== null ? { postMealWalked: walked } : {}),
            }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/pending-post-meal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/meal-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/glucose-patterns"] });
      if (!skip && !isSymptomOnly && glucoseValue !== null) {
        track("glucose_completed", { recorded: true });
      }
      if (isSymptomOnly && symptom !== null) {
        track("symptoms_checked", { recorded: true });
      }
      onDone();
    } catch (e) {
      console.error("[PostMealCard] submit error:", e);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "#fbfbf3",
    boxShadow: "0 4px 14px rgba(44,72,56,0.06)",
  };

  if (step === "ask") {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={cardStyle}
        data-testid="card-post-meal-ask"
      >
        <p className="text-sm font-medium text-foreground">{t("glucose.post_meal_question")}</p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => { hapticTap("LIGHT"); setStep("keypad"); }}
            data-testid="button-post-meal-yes"
          >
            {t("glucose.post_meal_yes")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { hapticTap("SOFT"); setStep("symptom"); }}
            disabled={submitting}
            data-testid="button-post-meal-no"
          >
            {t("glucose.post_meal_no")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "walked") {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={cardStyle}
        data-testid="card-post-meal-walked"
      >
        <p className="text-sm font-medium text-foreground">{t("glucose.walked_title")}</p>
        {submitError && (
          <p className="text-xs text-destructive text-center">
            Something went wrong.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => { void submit(false, walkedAnswer); }}
            >
              Try again
            </button>
          </p>
        )}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={submitting}
            onClick={() => { hapticTap("LIGHT"); setWalkedAnswer(true); void submit(false, true); }}
            data-testid="button-post-meal-walked-yes"
          >
            {t("glucose.walked_yes")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => { hapticTap("SOFT"); setWalkedAnswer(false); void submit(false, false); }}
            data-testid="button-post-meal-walked-no"
          >
            {t("glucose.walked_no")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "keypad") {
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

          {!hasFastingBaseline && (
            <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
              <p className="text-xs text-muted-foreground">{t("glucose.fasting_question")}</p>
              <div className="flex gap-1.5 flex-wrap">
                {FASTING_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      hapticTap("SOFT");
                      setSelectedFasting(f);
                      setFastingUnknown(false);
                    }}
                    data-testid={`button-post-meal-fasting-${f}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedFasting === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-muted/70"
                    }`}
                  >
                    {f.toFixed(1)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    hapticTap("SOFT");
                    setFastingUnknown(true);
                    setSelectedFasting(null);
                  }}
                  data-testid="button-post-meal-fasting-unknown"
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    fastingUnknown
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {t("glucose.fasting_dont_know")}
                </button>
              </div>
            </div>
          )}

          <Button
            onClick={handleConfirmKeypad}
            disabled={!canConfirmKeypad}
            data-testid="button-post-meal-confirm-keypad"
          >
            {t("glucose.keypad_confirm")}
          </Button>
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
              <Button
                onClick={handleAlertConfirm}
                data-testid="button-glucose-alert-confirm"
              >
                {t("glucose.alert_confirm")}
              </Button>
              <Button
                variant="outline"
                onClick={handleAlertCancel}
                data-testid="button-glucose-alert-cancel"
              >
                {alertType === "low"
                  ? t("glucose.alert_cancel_record")
                  : t("glucose.alert_cancel")}
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

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={cardStyle}
      data-testid="card-post-meal-symptom"
    >
      <p className="text-sm font-medium text-foreground">{t("glucose.symptom_title")}</p>
      <div className="flex flex-col gap-2">
        {SYMPTOM_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { hapticTap("SOFT"); setSymptom(opt.value); }}
            data-testid={`button-post-meal-symptom-${opt.value}`}
            className={`text-left px-4 py-3 rounded-xl text-sm transition-colors ${
              symptom === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
      <Button
        onClick={() => { hapticTap("MEDIUM"); void submit(false); }}
        disabled={!symptom || submitting}
        data-testid="button-post-meal-confirm-symptom"
      >
        {t("glucose.keypad_confirm")}
      </Button>
    </div>
  );
}
