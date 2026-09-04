import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type GuidanceKind = "hstix" | "meal-pattern" | "food-pattern";

export type GuidanceCandidate = {
  kind: GuidanceKind;
  eligible: boolean;
  element: HTMLElement | null;
};

const KIND_TO_PROFILE_FIELD: Record<GuidanceKind, string> = {
  hstix: "hstixMonitoringGuidanceSeen",
  "meal-pattern": "mealPatternGuidanceSeen",
  "food-pattern": "foodPatternGuidanceSeen",
};

function isMeaningfullyVisible(element: HTMLElement | null) {
  if (!element || document.visibilityState !== "visible") return false;
  if (element.closest('[aria-hidden="true"], [inert]')) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 &&
    rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

export function GlucoseMonitoringGuidance({
  candidates,
  onActiveChange,
}: {
  candidates: GuidanceCandidate[];
  onActiveChange?: (kind: GuidanceKind | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<GuidanceKind | null>(null);
  const [visibilityRevision, setVisibilityRevision] = useState(0);
  const shownThisVisit = useRef(false);
  const acknowledging = useRef(false);

  const statusQueries = {
    hstix: useQuery<{ seen: boolean }>({ queryKey: ["/api/user/glucose-guidance/hstix"], queryFn: () => fetch("/api/user/glucose-guidance/hstix", { credentials: "include" }).then(async r => { if (!r.ok) throw new Error("Unable to load glucose guidance"); return r.json(); }) }),
    "meal-pattern": useQuery<{ seen: boolean }>({ queryKey: ["/api/user/glucose-guidance/meal-pattern"], queryFn: () => fetch("/api/user/glucose-guidance/meal-pattern", { credentials: "include" }).then(async r => { if (!r.ok) throw new Error("Unable to load glucose guidance"); return r.json(); }) }),
    "food-pattern": useQuery<{ seen: boolean }>({ queryKey: ["/api/user/glucose-guidance/food-pattern"], queryFn: () => fetch("/api/user/glucose-guidance/food-pattern", { credentials: "include" }).then(async r => { if (!r.ok) throw new Error("Unable to load glucose guidance"); return r.json(); }) }),
  };

  useEffect(() => {
    const reevaluate = () => setVisibilityRevision(value => value + 1);
    window.addEventListener("scroll", reevaluate, true);
    window.addEventListener("resize", reevaluate);
    document.addEventListener("visibilitychange", reevaluate);
    return () => {
      window.removeEventListener("scroll", reevaluate, true);
      window.removeEventListener("resize", reevaluate);
      document.removeEventListener("visibilitychange", reevaluate);
    };
  }, []);

  // Priority is intentionally fixed: a voluntary HStix entry takes precedence,
  // then the overall meal context, then an individual food detail.
  const memoizedCandidates = useMemo(
    () => candidates.map(candidate => {
      const status = statusQueries[candidate.kind];
      return {
        ...candidate,
        // Do not decide eligibility from a pending (or failed) request: the
        // resolved server state is the durable source of truth.
        ready: !status.isLoading && !status.isError,
        seen: status.data?.seen === true,
      };
    }),
    // Locale is included because a language switch is a real eligibility context
    // change; candidate identity alone must not cause this effect to churn.
    [
      candidates,
      i18n.language,
      statusQueries.hstix.data?.seen,
      statusQueries.hstix.isLoading,
      statusQueries.hstix.isError,
      statusQueries["meal-pattern"].data?.seen,
      statusQueries["meal-pattern"].isLoading,
      statusQueries["meal-pattern"].isError,
      statusQueries["food-pattern"].data?.seen,
      statusQueries["food-pattern"].isLoading,
      statusQueries["food-pattern"].isError,
    ],
  );

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (shownThisVisit.current || active || document.visibilityState !== "visible") return;
    const priority: GuidanceKind[] = ["hstix", "meal-pattern", "food-pattern"];
    const next = priority.find(kind => {
      const candidate = memoizedCandidates.find(item => item.kind === kind);
      return candidate?.eligible && candidate.ready && !candidate.seen && isMeaningfullyVisible(candidate.element);
    });
    if (next) {
      shownThisVisit.current = true;
      setActive(next);
    }
  }, [active, memoizedCandidates, visibilityRevision]);

  const acknowledgeGuidance = async (kind: GuidanceKind) => {
    if (acknowledging.current) return;
    acknowledging.current = true;
    try {
      await apiRequest("POST", `/api/user/glucose-guidance/${kind}/seen`, {});
      queryClient.setQueryData<Record<string, unknown>>(["/api/profile"], profile =>
        profile ? { ...profile, [KIND_TO_PROFILE_FIELD[kind]]: true } : profile,
      );
      queryClient.setQueryData(["/api/user/glucose-guidance/" + kind], { seen: true });
    } catch (error) {
      // Do not optimistically mark the item seen. A later visit may retry,
      // while this visit remains closed so a failed acknowledgement never traps
      // or repeatedly interrupts the person.
      console.warn("[glucose-guidance] acknowledgement failed", error);
    } finally {
      acknowledging.current = false;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open || !active) return;
    const kind = active;
    // The dialog is controlled, so clear it before starting network work.
    // A slow, failed, or offline acknowledgement must never trap the user.
    setActive(null);
    void acknowledgeGuidance(kind);
  };

  return (
    <Dialog open={active !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl" data-testid={`dialog-glucose-guidance-${active ?? "none"}`}>
        <DialogHeader>
          <DialogTitle>{t("glucose.guidance_title")}</DialogTitle>
          <DialogDescription className="whitespace-pre-line leading-relaxed">
            {active ? t(`glucose.guidance_${active}_body`) : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button type="button" data-testid="button-glucose-guidance-got-it">
            {t("glucose.guidance_got_it")}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export function GlucoseGuidanceInline({ kind, hidden = false }: { kind: GuidanceKind; hidden?: boolean }) {
  const { t } = useTranslation();
  if (hidden) return null;
  return (
    <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground" data-testid={`text-glucose-guidance-inline-${kind}`}>
      {t(`glucose.guidance_${kind}_body`)}
    </p>
  );
}