import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { hapticTap } from "@/lib/haptics";

interface Props {
  snapId: number;
  hasFastingBaseline: boolean;
  onDone: () => void;
}

type Step = "ask" | "keypad" | "symptom" | "done";

const FASTING_OPTIONS = [4.5, 5.0, 5.5, 6.0, 6.5];
const INTEGER_OPTIONS = [5, 6, 7, 8, 9, 10];
const DECIMAL_OPTIONS = [0, 2, 4, 6, 8];
const SYMPTOM_OPTIONS = [
  { value: "normal",         labelKey: "glucose.symptom_normal"  },
  { value: "tired",          labelKey: "glucose.symptom_tired"   },
  { value: "blurred_vision", labelKey: "glucose.symptom_blurred" },
  { value: "thirsty",        labelKey: "glucose.symptom_thirsty" },
];

export default function PostMealCard({ snapId, hasFastingBaseline, onDone }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("ask");
  const [intPart, setIntPart] = useState<number | null>(null);
  const [decPart, setDecPart] = useState<number | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [selectedFasting, setSelectedFasting] = useState<number | null>(null);
  const [fastingUnknown, setFastingUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const glucoseValue = intPart !== null && decPart !== null
    ? parseFloat(`${intPart}.${decPart}`)
    : null;

  const fastingSelected = hasFastingBaseline || selectedFasting !== null || fastingUnknown;
  const canConfirmKeypad = glucoseValue !== null && fastingSelected;

  const submit = async (skip: boolean) => {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/snap/post-meal", {
        snapId,
        ...(skip ? { skip: true } : {
          glucoseMmol: glucoseValue,
          symptom,
          ...(!hasFastingBaseline && !fastingUnknown && selectedFasting !== null
            ? { fastingBaseline: selectedFasting, fastingBaselineEstimated: false }
            : {}),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/pending-post-meal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/meal-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snap/glucose-patterns"] });
      setStep("done");
      setTimeout(onDone, 1400);
    } catch (e) {
      console.error("[PostMealCard] submit error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center"
        style={{ background: "#fbfbf3", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}
        data-testid="card-post-meal-done"
      >
        <p className="text-3xl">✅</p>
        <p className="text-sm font-semibold text-foreground">
          {t("glucose.keypad_confirm")}
        </p>
      </div>
    );
  }

  if (step === "ask") {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "#fbfbf3", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}
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
            onClick={() => { hapticTap("SOFT"); void submit(true); }}
            disabled={submitting}
            data-testid="button-post-meal-no"
          >
            {t("glucose.post_meal_no")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "keypad") {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "#fbfbf3", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}
        data-testid="card-post-meal-keypad"
      >
        <p className="text-sm font-medium text-foreground">{t("glucose.keypad_title")}</p>

        <div className="text-center py-1">
          <span className="text-4xl font-bold tabular-nums text-foreground" data-testid="text-post-meal-reading">
            {intPart !== null ? intPart : "–"}.{decPart !== null ? decPart : "–"}
          </span>
          <span className="text-sm text-muted-foreground ml-1.5">{t("glucose.keypad_unit")}</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {INTEGER_OPTIONS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => { hapticTap("SOFT"); setIntPart(n); }}
              data-testid={`button-post-meal-int-${n}`}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                intPart === n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {DECIMAL_OPTIONS.map(n => (
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
              {FASTING_OPTIONS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { hapticTap("SOFT"); setSelectedFasting(f); setFastingUnknown(false); }}
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
                onClick={() => { hapticTap("SOFT"); setFastingUnknown(true); setSelectedFasting(null); }}
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
          onClick={() => { hapticTap("LIGHT"); setStep("symptom"); }}
          disabled={!canConfirmKeypad}
          data-testid="button-post-meal-confirm-keypad"
        >
          {t("glucose.keypad_confirm")}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "#fbfbf3", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}
      data-testid="card-post-meal-symptom"
    >
      <p className="text-sm font-medium text-foreground">{t("glucose.symptom_title")}</p>
      <div className="flex flex-col gap-2">
        {SYMPTOM_OPTIONS.map(opt => (
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
