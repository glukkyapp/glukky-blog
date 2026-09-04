import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const SWIPE_TUTORIAL_QUERY_PATH = "/api/user/glucose-patterns/swipe-tutorial";
const SWIPE_TUTORIAL_SEEN_PATH = `${SWIPE_TUTORIAL_QUERY_PATH}/seen`;
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

export function SwipeableFoodCard({
  index,
  total,
  children,
  nextCard,
  onPrevious,
  onNext,
}: SwipeableFoodCardProps) {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const swipeStartX = useRef<number | null>(null);
  const tutorialTimer = useRef<number | null>(null);
  const displayedForAccount = useRef<string | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const isMultiCard = total > 1;
  const hasNextCard = Boolean(nextCard) && index < total - 1;
  const accountId = user?.id ?? null;
  const tutorialQueryKey = [SWIPE_TUTORIAL_QUERY_PATH, accountId] as const;
  const { data: tutorialState } = useQuery<{ seen: boolean }>({
    queryKey: tutorialQueryKey,
    queryFn: async () => {
      const response = await fetch(SWIPE_TUTORIAL_QUERY_PATH, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load swipe tutorial state");
      return response.json();
    },
    enabled: Boolean(accountId) && !authLoading,
    staleTime: Infinity,
  });
  const markTutorialSeenMutation = useMutation({
    mutationFn: () => apiRequest("POST", SWIPE_TUTORIAL_SEEN_PATH, {}),
  });

  const rememberSwipeTutorial = () => {
    if (!accountId) return;
    queryClient.setQueryData(tutorialQueryKey, { seen: true });
    markTutorialSeenMutation.mutate();
  };

  const dismissTutorial = () => {
    if (tutorialTimer.current !== null) {
      window.clearTimeout(tutorialTimer.current);
      tutorialTimer.current = null;
    }
    rememberSwipeTutorial();
    setTutorialVisible(false);
  };

  useEffect(() => {
    if (displayedForAccount.current !== accountId) {
      displayedForAccount.current = null;
      setTutorialVisible(false);
    }
    if (!isMultiCard || !accountId || tutorialState?.seen !== false || displayedForAccount.current === accountId) return;

    tutorialTimer.current = window.setTimeout(() => {
      displayedForAccount.current = accountId;
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
  }, [accountId, authLoading, isMultiCard, tutorialState?.seen]);

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
        className="touch-pan-y overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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