import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export const SWIPE_TUTORIAL_STORAGE_KEY = "glukky_glucose_patterns_swipe_tutorial_seen";
const SWIPE_MIN_PX = 40;
const SWIPE_TUTORIAL_DELAY_MS = 650;

interface SwipeableFoodCardProps {
  index: number;
  total: number;
  children: ReactNode;
  nextCard?: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
}

function hasSeenSwipeTutorial() {
  try {
    return window.localStorage.getItem(SWIPE_TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSwipeTutorial() {
  try {
    window.localStorage.setItem(SWIPE_TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // A blocked local-storage implementation should not stop card navigation.
  }
}

export function SwipeableFoodCard({
  index,
  total,
  children,
  nextCard,
  onPrevious,
  onNext,
}: SwipeableFoodCardProps) {
  const { t } = useTranslation();
  const swipeStartX = useRef<number | null>(null);
  const tutorialTimer = useRef<number | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const isMultiCard = total > 1;
  const hasNextCard = Boolean(nextCard) && index < total - 1;

  const dismissTutorial = () => {
    if (tutorialTimer.current !== null) {
      window.clearTimeout(tutorialTimer.current);
      tutorialTimer.current = null;
    }
    rememberSwipeTutorial();
    setTutorialVisible(false);
  };

  useEffect(() => {
    if (!isMultiCard || hasSeenSwipeTutorial()) {
      setTutorialVisible(false);
      return;
    }

    tutorialTimer.current = window.setTimeout(() => {
      rememberSwipeTutorial();
      setTutorialVisible(true);
      tutorialTimer.current = null;
    }, SWIPE_TUTORIAL_DELAY_MS);

    return () => {
      if (tutorialTimer.current !== null) {
        window.clearTimeout(tutorialTimer.current);
        tutorialTimer.current = null;
      }
    };
  }, [isMultiCard]);

  const movePrevious = () => {
    dismissTutorial();
    onPrevious();
  };

  const moveNext = () => {
    dismissTutorial();
    onNext();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;
    const distance = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (distance <= -SWIPE_MIN_PX && index < total - 1) moveNext();
    if (distance >= SWIPE_MIN_PX && index > 0) movePrevious();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      movePrevious();
    }
    if (event.key === "ArrowRight" && index < total - 1) {
      event.preventDefault();
      moveNext();
    }
  };

  if (total === 0) return null;

  return (
    <div
      className="space-y-2"
      role="region"
      aria-roledescription="carousel"
      aria-label={t("glucose.pattern_carousel_label")}
    >
      {isMultiCard && (
        <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground" data-testid="pattern-swipe-cue">
          <ArrowLeft size={15} aria-hidden="true" />
          {t("glucose.pattern_swipe_cue")}
        </p>
      )}
      {tutorialVisible && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground" data-testid="pattern-swipe-tutorial">
          <p>{t("glucose.pattern_swipe_tutorial")}</p>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" onClick={dismissTutorial}>
            {t("glucose.pattern_swipe_tutorial_acknowledge")}
          </Button>
        </div>
      )}
      <div
        className="touch-pan-y overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        tabIndex={isMultiCard ? 0 : undefined}
        onKeyDown={isMultiCard ? handleKeyDown : undefined}
        onPointerDown={isMultiCard ? handlePointerDown : undefined}
        onPointerUp={isMultiCard ? handlePointerUp : undefined}
        onPointerCancel={isMultiCard ? () => { swipeStartX.current = null; } : undefined}
        data-testid="pattern-card-viewport"
      >
        <div className="flex items-stretch gap-2">
          <div className={`${hasNextCard ? "w-[calc(100%-28px)]" : "w-full"} shrink-0 ${tutorialVisible ? "swipe-tutorial-nudge" : ""}`}>
            {children}
          </div>
          {hasNextCard && (
            <div className="w-[calc(100%-28px)] shrink-0" aria-hidden="true" data-testid="pattern-next-card-sliver">
              {nextCard}
            </div>
          )}
        </div>
      </div>
      {isMultiCard && (
        <div className="flex items-center justify-between px-1">
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-11 p-0"
            onClick={movePrevious}
            disabled={index === 0}
            aria-label={t("glucose.pattern_previous")}
            data-testid="pattern-previous"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            <span className="sr-only">{t("glucose.pattern_previous")}</span>
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="pattern-position">
            {index + 1} / {total}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-11 p-0"
            onClick={moveNext}
            disabled={index === total - 1}
            aria-label={t("glucose.pattern_next")}
            data-testid="pattern-next"
          >
            <ChevronRight size={18} aria-hidden="true" />
            <span className="sr-only">{t("glucose.pattern_next")}</span>
          </Button>
        </div>
      )}
    </div>
  );
}