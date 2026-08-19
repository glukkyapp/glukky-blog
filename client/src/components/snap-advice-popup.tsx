import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { hapticTap } from "@/lib/haptics";
import { startSpeech, isSpeechSupported, type SpeechHandle } from "@/lib/tts";
import { isLeftSwipe } from "@/lib/swipe";
import glucoseLowImg from "@assets/glucose_low.png";
import glucoseMediumImg from "@assets/glucose_medium.png";
import glucoseHighImg from "@assets/glucose_high.png";

export interface StructuredAdvice {
  impactValue: "low" | "medium" | "high" | null;
  impactDisplay: string;
  opener: string | null;
  watchOut: { food: string | null; risk: string }[];
  positiveLine: string | null;
  rightNow: string[];
  nextTime: string;
}

interface SnapAdvicePopupProps {
  open: boolean;
  advice: StructuredAdvice;
  avgPostMealMmol: number | null;
  /** Full dismissal (skip / got-it / final swipe). */
  onDismiss: () => void;
  /** Close only the popup — used by 了解更多 before navigation, no snap reset. */
  onCloseOnly: () => void;
}

const HEALTH_INFO_ROUTE = "/health-info";

const IMPACT_IMG: Record<string, string> = {
  low: glucoseLowImg,
  medium: glucoseMediumImg,
  high: glucoseHighImg,
};

export function SnapAdvicePopup({
  open,
  advice,
  avgPostMealMmol,
  onDismiss,
  onCloseOnly,
}: SnapAdvicePopupProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [card, setCard] = useState(0);
  const [checked, setChecked] = useState(false);
  const speechRef = useRef<SpeechHandle | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const touchRef = useRef<{ x: number; t: number } | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopSpeech = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    if (open) {
      setCard(0);
      setChecked(false);
    }
    return () => {
      speechRef.current?.stop();
      speechRef.current = null;
    };
  }, [open]);

  // Stop narration whenever the card changes.
  useEffect(() => {
    stopSpeech();
  }, [card, stopSpeech]);

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);

  const personalSentence =
    avgPostMealMmol != null
      ? t("snap_popup.personal_response", { mmol: avgPostMealMmol.toFixed(1) })
      : t("snap_popup.no_personal_record");

  const impactLabel = advice.impactValue
    ? `${t("snap_popup.impact_label")}: ${advice.impactDisplay || t(`snap_popup.impact_${advice.impactValue}`)}`
    : t("snap_popup.impact_unknown");

  const cardNarration = (i: number): string => {
    if (i === 0) return `${impactLabel}. ${personalSentence}`;
    if (i === 1) {
      const rows = advice.watchOut.map((r) => (r.food ? `${r.food}：${r.risk}` : r.risk));
      const lead = rows.length > 0 ? rows.join("。") : advice.positiveLine ?? "";
      return `${lead}。${t("snap_popup.now_label")} ${advice.rightNow.join(" ")}`;
    }
    return `${t("snap_popup.next_label")} ${advice.nextTime}`;
  };

  const handleListen = () => {
    if (!isSpeechSupported()) return;
    if (speaking) {
      stopSpeech();
      return;
    }
    hapticTap("SOFT");
    const handle = startSpeech(cardNarration(card), () => setSpeaking(false));
    if (handle) {
      speechRef.current = handle;
      setSpeaking(true);
    }
  };

  const dismiss = useCallback(() => {
    stopSpeech();
    onDismiss();
  }, [onDismiss, stopSpeech]);

  const advance = useCallback(() => {
    if (card >= 2) {
      dismiss();
    } else {
      setCard((c) => c + 1);
    }
  }, [card, dismiss]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, t: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (isLeftSwipe(touch.clientX - start.x, Date.now() - start.t)) {
      hapticTap("SOFT");
      advance();
    }
  };

  const handleGotIt = () => {
    if (checked) return;
    hapticTap("SOFT");
    stopSpeech();
    setChecked(true);
    checkTimerRef.current = setTimeout(() => {
      dismiss();
    }, 700);
  };

  const handleLearnMore = () => {
    hapticTap("SOFT");
    stopSpeech();
    // Close only the popup (no snap reset), then navigate.
    onCloseOnly();
    setLocation(HEALTH_INFO_ROUTE);
  };

  const listenButton = isSpeechSupported() ? (
    <button
      type="button"
      onClick={handleListen}
      className={`text-xs font-medium underline underline-offset-2 ${speaking ? "text-primary" : "text-muted-foreground"}`}
      data-testid="button-snap-popup-listen"
    >
      {t("snap_popup.listen")}
    </button>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl p-0 overflow-hidden"
        aria-describedby={undefined}
        data-testid="dialog-snap-advice-popup"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <DialogTitle className="sr-only">{t("snap.advice_title")}</DialogTitle>
        <div className="flex flex-col items-center gap-4 p-6 pb-5" data-testid={`card-snap-advice-${card}`}>
          {card === 0 && (
            <>
              {advice.impactValue ? (
                <img
                  src={IMPACT_IMG[advice.impactValue]}
                  alt=""
                  aria-hidden="true"
                  className="w-28 h-28 mx-auto"
                  data-testid="img-snap-popup-impact"
                />
              ) : (
                <div
                  className="w-28 h-28 mx-auto rounded-full bg-muted/50"
                  aria-hidden="true"
                  data-testid="img-snap-popup-impact-none"
                />
              )}
              <p className="text-base font-bold text-center" data-testid="text-snap-popup-impact">
                {impactLabel}
              </p>
              <p className="text-sm text-center text-muted-foreground leading-relaxed" data-testid="text-snap-popup-personal">
                {personalSentence}
              </p>
            </>
          )}

          {card === 1 && (
            <div className="w-full flex flex-col gap-3">
              {advice.watchOut.length > 0 ? (
                <div className="flex flex-col" data-testid="list-snap-popup-watchout">
                  {advice.watchOut.map((row, i) => (
                    <div key={i}>
                      {i > 0 && <div className="border-t border-border my-2" />}
                      <p className="text-sm leading-relaxed" data-testid={`row-snap-watchout-${i}`}>
                        {row.food ? `${row.food}：${row.risk}` : row.risk}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-center" data-testid="text-snap-popup-positive">
                  {advice.positiveLine}
                </p>
              )}
              <div className="border-t border-border" />
              <p className="text-xs font-semibold text-muted-foreground" data-testid="text-snap-popup-now-label">
                {t("snap_popup.now_label")}
              </p>
              <div className="flex flex-col gap-2" data-testid="text-snap-popup-rightnow">
                {advice.rightNow.map((action, i) => (
                  <p key={i} className="text-sm leading-relaxed font-medium">
                    {action}
                  </p>
                ))}
              </div>
            </div>
          )}

          {card === 2 && (
            <div className="w-full flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground" data-testid="text-snap-popup-next-label">
                {t("snap_popup.next_label")}
              </p>
              <p className="text-sm leading-relaxed font-medium" data-testid="text-snap-popup-nexttime">
                {advice.nextTime}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2" data-testid="nav-snap-popup-dots" role="tablist" aria-label={t("snap.advice_title")}>
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => { hapticTap("SOFT"); setCard(i); }}
                data-testid={`dot-snap-popup-${i}`}
                role="tab"
                aria-selected={i === card}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === card ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={t("snap_popup.card_of", { current: i + 1, total: 3 })}
              />
            ))}
          </div>

          {card < 2 ? (
            <div className="flex flex-col items-center gap-2 w-full pt-1">
              <p className="text-[11px] text-muted-foreground" data-testid="text-snap-popup-swipe-hint">
                {t("snap_popup.swipe_hint")}
              </p>
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={() => { hapticTap("SOFT"); dismiss(); }}
                  className="text-sm text-muted-foreground py-2 px-1"
                  data-testid="button-snap-popup-skip"
                >
                  {t("snap_popup.skip")}
                </button>
                {listenButton}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { hapticTap("SOFT"); advance(); }}
                  data-testid="button-snap-popup-next"
                >
                  {t("snap.next")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full pt-1">
              <div className="flex items-center justify-center gap-4 w-full">
                {listenButton}
                <Button
                  className="flex-1"
                  onClick={handleGotIt}
                  data-testid="button-snap-popup-got-it"
                  aria-label={t("snap_popup.got_it")}
                >
                  {checked ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      data-testid="icon-snap-popup-check"
                    >
                      <path d="M4 12.5 L10 18.5 L20 6.5">
                        <animate attributeName="stroke-dasharray" from="0 32" to="32 0" dur="0.35s" fill="freeze" />
                      </path>
                    </svg>
                  ) : (
                    t("snap_popup.got_it")
                  )}
                </Button>
              </div>
              <button
                type="button"
                onClick={handleLearnMore}
                className="text-sm text-primary underline underline-offset-2"
                data-testid="link-snap-popup-learn-more"
              >
                {t("snap_popup.learn_more")}
              </button>
              <p className="text-[10px] leading-snug text-muted-foreground text-center" data-testid="text-snap-popup-disclaimer">
                {t("snap.advice_disclaimer")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
