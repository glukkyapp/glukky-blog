import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CoinSavedPopup } from "@/components/coin-saved-popup";
import { InfoCardPopup, useInfoCard } from "@/components/info-card-popup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Footprints, UtensilsCrossed,
  Calendar, CalendarDays, ShoppingBag, TrendingUp, Award, RotateCcw, Clock,
  Wine, Soup, Minus, Activity, Sparkles, Timer, Utensils, X,
} from "lucide-react";
import { DIET_TIP_LADDERS, DIET_TIP_I18N_KEYS, STRUGGLE_PRIORITY } from "@shared/schema";

function translateDietTip(tip: string, t: (key: string, opts?: any) => string): string {
  const i18nKey = DIET_TIP_I18N_KEYS[tip];
  return i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
}
import { MonthlyReportContent, type MonthlyReportData } from "./monthly-report";
import { useTranslation } from "react-i18next";

export default function WeeklyPlanner() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const DAY_NAMES = [t("day_short.mon"), t("day_short.tue"), t("day_short.wed"), t("day_short.thu"), t("day_short.fri"), t("day_short.sat"), t("day_short.sun")];
  const STRUGGLE_NAMES: Record<string, string> = {
    sugary_food_drink: t("struggle.sugary_food_drink"),
    oily_fried_food: t("struggle.oily_fried_food"),
    eat_out: t("struggle.eat_out"),
    portions: t("struggle.portions"),
    snacks: t("struggle.snacks"),
  };

  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });
  const { data: currentPlan } = useQuery({ queryKey: ["/api/plan/current"] });
  const { data: reflection } = useQuery({ queryKey: ["/api/plan/reflection"] });
  const { data: devTime } = useQuery({ queryKey: ["/api/dev/time"] });
  const { data: monthlyReport, isLoading: monthlyReportLoading } = useQuery<MonthlyReportData>({
    queryKey: ["/api/report/monthly", "0"],
    enabled: (() => {
      const now = devTime?.dateOverride ? new Date(devTime.dateOverride + "T00:00:00") : new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return now.getDate() === lastDay;
    })(),
  });

  const isFirstWeek = !reflection;

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const effectiveDateStr = devTime?.dateOverride || formatLocalDate(new Date());
  const effectiveTodayDow = (() => {
    const d = new Date(effectiveDateStr + "T00:00:00");
    const jsDay = d.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  })();

  const planSundayStr = (() => {
    if (!currentPlan?.startDate) return null;
    const d = new Date(currentPlan.startDate + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return formatLocalDate(d);
  })();

  const lastSundayStr = (() => {
    const d = new Date(effectiveDateStr + "T00:00:00");
    const daysBack = effectiveTodayDow === 6 ? 0 : effectiveTodayDow + 1;
    d.setDate(d.getDate() - daysBack);
    return formatLocalDate(d);
  })();

  const { data: sundayLogData } = useQuery({
    queryKey: ["/api/log", planSundayStr || lastSundayStr],
    enabled: !isFirstWeek,
  });

  const prevWeekNumber = (profile?.currentWeek || 1) - 1;
  const { data: prevCalendarData } = useQuery({
    queryKey: ["/api/calendar", prevWeekNumber],
    enabled: !isFirstWeek && prevWeekNumber >= 1,
  });

  const sundayCheckInDone = (() => {
    if (isFirstWeek) return true;
    if (!sundayLogData) return false;
    const sunDate = planSundayStr || lastSundayStr;
    const sunPlanDay = prevCalendarData?.calendar?.find((d: any) => d.dayOfWeek === 6);
    const sunLog = prevCalendarData?.calendar?.find((d: any) => d.date === sunDate);
    if (!sunLog) return false;
    if (sunPlanDay?.walkScheduled) {
      if (sunLog.walkCompleted === null || sunLog.walkCompleted === undefined) return false;
      if (!sunPlanDay.standingTap && sunLog.walkCompleted === false && (sunLog.walkTired === null || sunLog.walkTired === undefined)) return false;
    }
    if (sunPlanDay?.lateDinnerScheduled) {
      if (sunLog.dinnerSuccess === null || sunLog.dinnerSuccess === undefined) return false;
    }
    if (currentPlan?.dietTip) {
      if (sunLog.dietResponse === null || sunLog.dietResponse === undefined) return false;
    }
    return true;
  })();

  const isSundayEarly = (() => {
    const d = new Date(effectiveDateStr + "T00:00:00");
    return d.getDay() === 0;
  })();
  const isPastPlanWeekEarly = !!planSundayStr && effectiveDateStr > planSundayStr;
  const isLatePlanningEarly = isPastPlanWeekEarly && !isSundayEarly;

  const firstActiveDay = (() => {
    if (isFirstWeek) {
      if (effectiveTodayDow === 6) return 0;
      return effectiveTodayDow === 0 ? 0 : Math.min(effectiveTodayDow + 1, 6);
    }
    if (isLatePlanningEarly) {
      return Math.min(effectiveTodayDow + 1, 6);
    }
    return 0;
  })();

  const [stepIndex, setStepIndex] = useState(0);
  const [coinPopupCoins, setCoinPopupCoins] = useState(0);
  const dismissCoinPopup = useCallback(() => setCoinPopupCoins(0), []);
  const [negotiationChoice, setNegotiationChoice] = useState<string>("keep_current");
  const [acceptedEscalation, setAcceptedEscalation] = useState<boolean | null>(null);
  const [negotiationStep, setNegotiationStep] = useState<"ask_day" | "ask_minutes" | "glycemic_gap" | "ask_day_again" | "ask_standing_tap" | "pick_standing_tap_day" | "done">("ask_day");
  const [walkDays, setWalkDays] = useState<number[]>([]);
  const [eatOutDays, setEatOutDays] = useState<number[]>([]);
  const [lateDinnerDays, setLateDinnerDays] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [stretchDays, setStretchDays] = useState<number[]>([]);
  const [stretchAccepted, setStretchAccepted] = useState(false);
  const [selectedTip, setSelectedTip] = useState<string | null>(null);
  const [keepSameTip, setKeepSameTip] = useState<boolean | null>(null);
  const [standingTapDay, setStandingTapDay] = useState<number | null>(null);
  const [standingTapSuggestAccepted, setStandingTapSuggestAccepted] = useState<boolean | null>(null);
  const [walkDayDurations, setWalkDayDurations] = useState<Record<number, number>>({});
  const [negotiationAgreedMinutes, setNegotiationAgreedMinutes] = useState(false);
  const [negotiationInitialized, setNegotiationInitialized] = useState(false);
  const [graduationPopupOpen, setGraduationPopupOpen] = useState(false);
  const [graduationPopupShownThisSession, setGraduationPopupShownThisSession] = useState(false);
  const [selectedStruggles2, setSelectedStruggles2] = useState<string[]>([]);
  const [repickStepNeeded, setRepickStepNeeded] = useState(false);

  const cardDietFocus = useInfoCard("diet_focus");
  const cardWalkEscalation = useInfoCard("walk_escalation");
  const cardGlycemicGap = useInfoCard("glycemic_gap");
  const cardStruggleIntroSugary = useInfoCard("struggle_intro_sugary");
  const cardStruggleIntroOily = useInfoCard("struggle_intro_oily");
  const cardStruggleIntroPortions = useInfoCard("struggle_intro_portions");
  const cardStruggleIntroSnacks = useInfoCard("struggle_intro_snacks");
  const cardStruggleIntroEatOut = useInfoCard("struggle_intro_eat_out");

  const isDinnerFocus = useMemo(() => {
    const effectiveDinnerMastered = reflection?.dinnerMastered ?? profile?.dinnerMastered;
    const effectiveDinnerExited = reflection?.dinnerExitType ?? profile?.dinnerExitType;
    return lateDinnerDays.length > 0 && !effectiveDinnerMastered && !effectiveDinnerExited;
  }, [lateDinnerDays, profile?.dinnerMastered, reflection?.dinnerMastered,
      profile?.dinnerExitType, reflection?.dinnerExitType]);

  const noWalkDays = walkDays.length === 0;

  const isStretchMode = profile?.isStretchMode || reflection?.walkingBridge || false;
  const isEmptyWeekStretch = !isStretchMode && stretchAccepted && stretchDays.length > 0;
  const isStretchActive = isStretchMode || isEmptyWeekStretch;

  const steps = useMemo(() => {
    const s: string[] = [];
    if (!isFirstWeek) {
      s.push("weeklyReport");
      s.push("planTransition");
    }
    s.push("walkDays", "eatOutDays", "lateDinnerDays");
    if (noWalkDays) s.push("standingTapSuggest");
    if (isDinnerFocus) s.push("dinnerFocusReview");
    if (!isDinnerFocus) {
      if (repickStepNeeded) s.push("repick");
      s.push("dietReview");
      s.push("dietTipSelection");
    }
    s.push("preview");
    return s;
  }, [isFirstWeek, isDinnerFocus, noWalkDays, repickStepNeeded]);

  const clampedStepIndex = Math.min(stepIndex, steps.length - 1);
  const currentStepId = steps[clampedStepIndex] || steps[0];

  useEffect(() => {
    if (currentStepId === "dietTipSelection") {
      cardDietFocus.trigger();
      const dietFocusSeen = !!localStorage.getItem("glukky_card_diet_focus_seen");
      if (dietFocusSeen) {
        const { effectiveStruggle } = getEffectiveStruggle();
        if (effectiveStruggle === "sugary_food_drink") cardStruggleIntroSugary.trigger();
        else if (effectiveStruggle === "oily_fried_food") cardStruggleIntroOily.trigger();
        else if (effectiveStruggle === "portions") cardStruggleIntroPortions.trigger();
        else if (effectiveStruggle === "snacks") cardStruggleIntroSnacks.trigger();
        else if (effectiveStruggle === "eat_out") cardStruggleIntroEatOut.trigger();
      }
    }
  }, [currentStepId]);
  useEffect(() => { if (isStretchMode && reflection?.autoEscalation && acceptedEscalation === null) cardWalkEscalation.trigger(); }, [isStretchMode, reflection?.autoEscalation, acceptedEscalation]);
  useEffect(() => { if (negotiationStep === "glycemic_gap") cardGlycemicGap.trigger(); }, [negotiationStep]);

  useEffect(() => {
    if (
      currentStepId === "weeklyReport" &&
      !graduationPopupShownThisSession &&
      reflection &&
      (reflection.dietJustGraduated || reflection.dinnerJustGraduated)
    ) {
      setGraduationPopupOpen(true);
      setGraduationPopupShownThisSession(true);
    }
  }, [currentStepId, reflection, graduationPopupShownThisSession]);

  useEffect(() => {
    if (reflection?.repickPending && !repickStepNeeded) {
      setRepickStepNeeded(true);
    }
  }, [reflection?.repickPending]);

  const repickMutation = useMutation({
    mutationFn: async (struggles2: string[]) => {
      const res = await apiRequest("POST", "/api/profile/repick", { struggles2 });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/profile"] });
      goNext();
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const effectiveStruggleForReset = getEffectiveStruggle().effectiveStruggle;
  useEffect(() => {
    setSelectedTip(null);
  }, [effectiveStruggleForReset]);

  useEffect(() => {
    if (initialized) return;
    if (!profile) return;

    if (reflection?.lastWeekSchedule && reflection.lastWeekSchedule.length > 0) {
      const schedule = reflection.lastWeekSchedule;
      const filterActive = (days: number[]) => firstActiveDay > 0 ? days.filter(d => d >= firstActiveDay) : days;
      const lastWeekWalkDays = schedule.filter((d: any) => d.walkScheduled && !d.standingTap).map((d: any) => d.dayOfWeek);
      setWalkDays(filterActive(lastWeekWalkDays));
      setEatOutDays(filterActive(schedule.filter((d: any) => d.eatOutScheduled).map((d: any) => d.dayOfWeek)));
      setLateDinnerDays(filterActive(schedule.filter((d: any) => d.lateDinnerScheduled).map((d: any) => d.dayOfWeek)));

      const durations: Record<number, number> = {};
      for (const d of schedule) {
        if (d.walkScheduled && !d.standingTap && d.walkDuration > 0) {
          durations[d.dayOfWeek] = d.walkDuration;
        }
      }
      setWalkDayDurations(durations);

      const lastWeekStandingTapDay = schedule.find((d: any) => d.standingTap);
      if (lastWeekStandingTapDay) {
        setStandingTapDay(lastWeekStandingTapDay.dayOfWeek);
      }

      setInitialized(true);
    } else if (reflection === null) {
      const pw = profile?.walksPerWeek || 3;
      const availableDays = Array.from({ length: 7 }, (_, i) => i).filter(d => d >= firstActiveDay);
      const initialWalkDays = availableDays.slice(0, pw);
      setWalkDays(initialWalkDays);
      const durations: Record<number, number> = {};
      for (const d of initialWalkDays) {
        durations[d] = profile.walkDuration || 10;
      }
      setWalkDayDurations(durations);
      setInitialized(true);
    }
  }, [profile, reflection, initialized]);

  useEffect(() => {
    if (negotiationInitialized || !reflection || isStretchMode || isFirstWeek) return;
    const walkFreq = reflection.walkDaysScheduled || 0;
    const walkDur = reflection.walkDuration || 10;
    if (walkFreq >= 5 && walkDur < 20) {
      setNegotiationStep("ask_minutes");
    } else if (walkFreq >= 5 && walkDur >= 20) {
      setNegotiationStep("done");
    }
    setNegotiationInitialized(true);
  }, [reflection, isStretchMode, isFirstWeek, negotiationInitialized]);

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const effectiveWalkDays = isEmptyWeekStretch ? stretchDays : walkDays;
      const durationsPayload: Record<string, number> = {};
      for (const d of effectiveWalkDays) {
        if (walkDayDurations[d]) {
          durationsPayload[String(d)] = walkDayDurations[d];
        }
      }
      const res = await apiRequest("POST", "/api/plan/weekly", {
        negotiationChoice,
        walkDays: effectiveWalkDays,
        eatOutDays,
        lateDinnerDays,
        stretchOnly: acceptedEscalation === true ? false : isStretchActive,
        selectedTip: selectedTip || undefined,
        standingTapDay: standingTapDay !== null ? standingTapDay : undefined,
        walkDayDurations: Object.keys(durationsPayload).length > 0 ? durationsPayload : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/reflection"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  function addOneWalkDay() {
    const days = [...walkDays];
    for (let i = 0; i < 7; i++) {
      if (!days.includes(i) && i >= firstActiveDay) { 
        days.push(i);
        setWalkDayDurations(prev => ({ ...prev, [i]: profile?.walkDuration || 10 }));
        break; 
      }
    }
    setWalkDays(days);
  }

  function handleNegotiationAnswer(answer: "yes" | "no") {
    const walkFreq = reflection?.walkDaysScheduled || 0;
    const walkDur = reflection?.walkDuration || 10;

    if (negotiationStep === "ask_day") {
      if (answer === "yes") {
        setNegotiationChoice("add_day");
        addOneWalkDay();
        setNegotiationStep("done");
      } else {
        if (walkDur < 20) {
          setNegotiationStep("ask_minutes");
        } else {
          const glycemicGapSeen = localStorage.getItem("glukky_card_glycemic_gap_seen");
          if (glycemicGapSeen) {
            setNegotiationStep("ask_standing_tap");
          } else {
            setNegotiationStep("glycemic_gap");
          }
        }
      }
    } else if (negotiationStep === "ask_minutes") {
      if (answer === "yes") {
        setNegotiationChoice("add_minutes");
        setNegotiationAgreedMinutes(true);
      }
      setNegotiationStep("done");
    } else if (negotiationStep === "ask_day_again") {
      if (answer === "yes") {
        setNegotiationChoice("add_day");
        addOneWalkDay();
        setNegotiationStep("done");
      } else {
        setNegotiationStep("ask_standing_tap");
      }
    } else if (negotiationStep === "ask_standing_tap") {
      if (answer === "yes") {
        setNegotiationChoice("standing_tap");
        setNegotiationStep("pick_standing_tap_day");
      } else {
        setNegotiationStep("done");
      }
    }
  }

  function toggleDay(day: number, list: number[], setList: (v: number[]) => void) {
    if (list.includes(day)) {
      setList(list.filter(d => d !== day));
    } else {
      setList([...list, day]);
    }
  }

  function goNext() {
    if (clampedStepIndex + 1 < steps.length) {
      setStepIndex(clampedStepIndex + 1);
    }
  }

  async function handleWeeklyReportNext() {
    try {
      const res = await apiRequest("POST", "/api/plan/weekly/report-seen", {});
      const data = await res.json();
      if (data?.coinsAwarded > 0) {
        setCoinPopupCoins(data.coinsAwarded);
      }
    } catch {
    }
    goNext();
  }

  function goBack() {
    if (clampedStepIndex - 1 >= 0) {
      setStepIndex(clampedStepIndex - 1);
    }
  }

  function renderWeeklyReport() {
    if (!reflection) return null;

    const dietTotalResponses = reflection.dietYesCount + reflection.dietNoCount + reflection.dietNoChanceCount;
    const dietDenominator = reflection.dietDaysTotal || dietTotalResponses;
    const dietSuccessPct = dietDenominator > 0 ? Math.round(((reflection.dietYesCount + reflection.dietNoChanceCount) / dietDenominator) * 100) : null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-weekly-report-title">
            <Award className="w-5 h-5 text-primary" />
            {t("planner.week_report", { week: reflection.weekNumber })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border p-4 space-y-1" data-testid="section-physical">
            <div className="flex items-center gap-2 mb-2">
              <Footprints className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">{t("planner.physical")}</p>
            </div>
            <p className="text-2xl font-bold text-center text-primary" data-testid="text-walk-report">
              {reflection.walkDaysScheduled > 0
                ? t("planner.walk_days_report", { completed: reflection.walkDaysCompleted, scheduled: reflection.walkDaysScheduled })
                : reflection.stretchAdjustedDays > 0
                  ? t("planner.stretch_days", { count: reflection.stretchAdjustedDays })
                  : t("planner.no_walk_days")}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {(reflection.walkDaysScheduled === 0 && reflection.stretchAdjustedDays > 0)
                ? t("planner.stretch_completion", { pct: reflection.stretchSuccessPct ?? 0 })
                : t("planner.walk_completion", { pct: reflection.walkSuccessPct })}
            </p>
            {reflection.stretchAdjustedDays > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-2" data-testid="text-stretch-remark">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("planner.stretching_days", { count: reflection.stretchAdjustedDays })}
                </p>
              </div>
            )}
            {reflection.standingTapDaysScheduled > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-2" data-testid="text-standing-tap-report">
                <Timer className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  {t("planner.standing_tap_report", { completed: reflection.standingTapDaysCompleted, scheduled: reflection.standingTapDaysScheduled })}
                </p>
              </div>
            )}
          </div>

          {(reflection.dinnerEarlyTotal > 0 || reflection.dinnerTacticTotal > 0) && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="section-late-dinner">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                  <p className="font-semibold text-sm">{t("planner.late_dinner")}</p>
                </div>
                {reflection.dinnerJustGraduated && (
                  <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full" data-testid="badge-dinner-mastered">{t("planner.mastered_badge")}</span>
                )}
              </div>
              {reflection.dinnerSuccessPct !== null && reflection.dinnerSuccessPct !== undefined && (
                <p className="text-2xl font-bold text-center text-amber-500" data-testid="text-dinner-success-pct">
                  {t("planner.dinner_success_pct", { pct: reflection.dinnerSuccessPct })}
                </p>
              )}
              {reflection.dinnerEarlyTotal > 0 && (
                <p className="text-sm" data-testid="text-dinner-early-report">
                  {t("planner.dinner_early_report", { count: reflection.dinnerEarlyCount, total: reflection.dinnerEarlyTotal })}
                </p>
              )}
              {reflection.dinnerTacticTotal > 0 && (
                <p className="text-sm" data-testid="text-dinner-tactic-report">
                  {t("planner.dinner_tactic_report", { count: reflection.dinnerTacticCount, total: reflection.dinnerTacticTotal })}
                </p>
              )}
              {(reflection.dinnerTacticBreakdown || []).length > 0 && (
                <div className="space-y-1 mt-1" data-testid="section-dinner-tactic-breakdown">
                  {(reflection.dinnerTacticBreakdown || []).map((item) => {
                    const nameKey =
                      item.label === "move_early" ? "planner.move_early_label" :
                      item.label === "fiber_starter" ? "planner.fiber_starter_label" :
                      item.label === "dusk_prep" ? "planner.dusk_prep_label" :
                      item.label === "split_dinner" ? "planner.split_dinner_label" : item.label;
                    return (
                      <p key={item.label} className="text-sm text-muted-foreground" data-testid={`text-tactic-breakdown-${item.label}`}>
                        {t("planner.dinner_tactic_by_name", { name: t(nameKey, { defaultValue: item.label }), success: item.success, total: item.total })}
                      </p>
                    );
                  })}
                </div>
              )}
              {reflection.dinnerGraduation && (() => {
                const dinnerGrad = reflection.dinnerGraduation;
                const dinnerWeeksFound = dinnerGrad.dinnerWeeksFound || 0;
                const dinnerScheduledDays = dinnerGrad.dinnerDaysScheduled || 0;
                const dinnerSuccessCount = dinnerGrad.dinnerSuccessCount || 0;
                const dinnerSuccessPct = dinnerGrad.dinnerSuccessPct || 0;
                return (
                  <div className="rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 p-3 space-y-2 mt-1" data-testid="section-dinner-graduation-report">
                    <p className="text-xs font-medium text-muted-foreground">{t("planner.graduation_progress")}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => {
                          const circleProgress = dinnerWeeksFound > 3 ? dinnerWeeksFound - 3 : dinnerWeeksFound;
                          const filled = i < circleProgress;
                          return (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                filled
                                  ? "bg-green-100 text-green-600 border border-green-300"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              data-testid={`indicator-dinner-week-report-${i}`}
                            >
                              {filled ? <Check className="w-3 h-3" /> : i + 1}
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {t("planner.weeks_tracked", { count: dinnerWeeksFound })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{t("planner.days_across_weeks", { success: dinnerSuccessCount, total: dinnerScheduledDays })}</span>
                          <span>{t("planner.goal_75")}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${dinnerSuccessPct >= 75 ? "bg-green-500" : "bg-amber-500"}`}
                            style={{ width: `${dinnerGrad.ready ? Math.min(dinnerSuccessPct, 100) : 0}%` }}
                            data-testid="bar-dinner-graduation-report"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center" data-testid="text-dinner-agg-pct-report">
                      {dinnerGrad.ready
                        ? (dinnerSuccessPct >= 75 ? t("planner.ready_to_graduate", { pct: dinnerSuccessPct }) : t("planner.need_75_to_graduate", { pct: dinnerSuccessPct }))
                        : t("planner.weeks_tracked", { count: dinnerWeeksFound })}
                    </p>
                    {(reflection.dinnerJustGraduated || reflection.dinnerJustExited) && (
                      <div className={`flex items-start gap-2 pt-1 border-t ${reflection.dinnerJustGraduated ? "border-green-200 dark:border-green-800" : "border-blue-200 dark:border-blue-800"}`} data-testid="section-dinner-outcome-report">
                        {reflection.dinnerJustGraduated && <Award className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />}
                        {reflection.dinnerJustExited && !reflection.dinnerJustGraduated && <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                        <p className="text-sm font-medium" data-testid="text-dinner-outcome-report">
                          {reflection.dinnerJustGraduated
                            ? t("planner.dinner_mastered_title")
                            : reflection.dinnerExitType === "moved_on"
                              ? t("planner.dinner_moved_on_title")
                              : t("planner.dinner_not_relevant_title")}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {reflection.dietStruggle && dietTotalResponses > 0 && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="section-diet-struggle">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <p className="font-semibold text-sm">{t("planner.diet_label", { name: STRUGGLE_NAMES[reflection.dietStruggle] || reflection.dietStruggle })}</p>
              </div>
              {dietSuccessPct !== null && (
                <p className="text-2xl font-bold text-center text-green-600" data-testid="text-diet-success-pct">
                  {t("planner.diet_success_pct", { pct: dietSuccessPct })}
                </p>
              )}
              <p className="text-sm font-medium" data-testid="text-diet-tip-last">
                {t("planner.tip_label", { tip: translateDietTip(reflection.dietTip, t) })}
              </p>
              {(reflection.activeDays || 0) > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="text-diet-cycle-info">
                  {t("planner.diet_days_progress", { yesDays: reflection.activeDaysYes || 0, activeDays: reflection.activeDays || 0 })}
                </p>
              )}
              <div className="text-sm space-y-1" data-testid="text-diet-report">
                {reflection.dietYesCount > 0 && (
                  <p className="text-green-600">{t("planner.followed_tip", { count: reflection.dietYesCount })}</p>
                )}
                {reflection.dietNoChanceCount > 0 && (
                  <p className="text-muted-foreground">{t("planner.no_chance", { count: reflection.dietNoChanceCount })}</p>
                )}
                {reflection.dietNoCount > 0 && (
                  <p className="text-amber-600">{t("planner.didnt_follow", { count: reflection.dietNoCount })}</p>
                )}
              </div>
              {currentPlan?.firstActiveDay > 0 && reflection.weekNumber === 1
                ? (
                  <div className="rounded-lg border border-muted bg-muted/30 p-3 mt-1" data-testid="section-diet-graduation-partial">
                    <p className="text-xs text-muted-foreground">{t("planner.graduation_starts_next_week")}</p>
                  </div>
                )
                : (reflection.activeDays || 0) > 0 && (() => {
                const activeDays = reflection.activeDays || 0;
                const weeksCompleted = Math.floor(activeDays / 7);
                const displayWeeks = Math.min(weeksCompleted > 3 ? weeksCompleted - 3 : weeksCompleted, 3);
                return (
                  <div className="rounded-lg border border-green-100 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/10 p-3 space-y-2 mt-1" data-testid="section-diet-graduation-report">
                    <p className="text-xs font-medium text-muted-foreground">{t("planner.graduation_progress")}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              i < displayWeeks
                                ? "bg-green-100 text-green-600 border border-green-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                            data-testid={`indicator-diet-week-report-${i}`}
                          >
                            {i < displayWeeks ? <Check className="w-3 h-3" /> : i + 1}
                          </div>
                        ))}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {t("planner.weeks_tracked", { count: displayWeeks })}
                      </span>
                    </div>
                    {(reflection.dietJustGraduated || reflection.dietJustSkipped || reflection.dietJustMovedOn) && (
                      <div className={`flex items-start gap-2 pt-1 border-t ${reflection.dietJustGraduated ? "border-green-200 dark:border-green-800" : "border-blue-200 dark:border-blue-800"}`} data-testid="section-diet-outcome-report">
                        {reflection.dietJustGraduated && <Award className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                        {(reflection.dietJustSkipped || reflection.dietJustMovedOn) && <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                        <p className="text-sm font-medium" data-testid="text-diet-outcome-report">
                          {reflection.dietJustGraduated
                            ? t("planner.mastered_struggle", { name: STRUGGLE_NAMES[reflection.dietStruggle] || reflection.dietStruggle })
                            : reflection.dietJustSkipped
                              ? t("planner.not_relevant_struggle")
                              : t("planner.moved_on_struggle")}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          {reflection.missedWalkCheckInDays >= 2 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4" data-testid="section-missed-checkins">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("planner.missed_checkins")}
              </p>
            </div>
          )}
          {reflection.missedDietCheckInDays >= 2 && reflection.missedWalkCheckInDays < 2 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4" data-testid="section-missed-diet-checkins">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("planner.missed_diet_checkins")}
              </p>
            </div>
          )}
          {reflection.repickPending && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4" data-testid="section-repick-message">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary">{t("planner.repick_message")}</p>
                  {reflection.eatOutPickedButNeverScheduled && (
                    <p className="text-xs text-muted-foreground">{t("planner.repick_eatout_note")}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderRepick() {
    const struggles1 = (profile?.struggles as string[]) || [];
    const mastered1 = (profile?.masteredStruggles as string[]) || [];
    const appeared = (reflection?.appearedDietStruggles as string[]) || [];

    // Profile cache may be stale — the reflection already wrote the final evaluation
    // for the cycle-1 active struggle. Supplement from reflection data directly.
    const reflStruggle = reflection?.dietStruggle as string | null;
    const baseSkipped1 = (profile?.skippedStruggles as string[]) || [];
    const baseDifficult1 = (profile?.difficultStruggles as string[]) || [];
    const effectiveSkipped1 = (reflStruggle && reflection?.dietJustSkipped && !baseSkipped1.includes(reflStruggle))
      ? [...baseSkipped1, reflStruggle] : baseSkipped1;
    const effectiveDifficult1 = (reflStruggle && reflection?.dietJustMovedOn && !baseDifficult1.includes(reflStruggle))
      ? [...baseDifficult1, reflStruggle] : baseDifficult1;
    const effectiveMastered1 = (reflStruggle && reflection?.dietJustGraduated && !mastered1.includes(reflStruggle))
      ? [...mastered1, reflStruggle] : mastered1;

    const currentActive = profile?.currentStruggle as string | null;
    const pickingPool = (STRUGGLE_PRIORITY as readonly string[]).filter(s => {
      if (s === "eat_out" && eatOutDays.length === 0) return false;
      return !effectiveMastered1.includes(s);
    });

    const currentGroup = pickingPool.filter(s => s === currentActive);
    // Any struggle that appeared and wasn't mastered (whether skipped or difficult) → "moved on"
    const movedOn = pickingPool.filter(s =>
      s !== currentActive && appeared.includes(s) &&
      (effectiveSkipped1.includes(s) || effectiveDifficult1.includes(s))
    );
    const inProgress = pickingPool.filter(s =>
      s !== currentActive && struggles1.includes(s) && appeared.includes(s) &&
      !effectiveSkipped1.includes(s) && !effectiveDifficult1.includes(s)
    );
    const upcoming = pickingPool.filter(s => s !== currentActive && struggles1.includes(s) && !appeared.includes(s));
    const inactive = pickingPool.filter(s => !struggles1.includes(s));

    const groups = [
      { key: "current", labelKey: "planner.repick_group_current", items: currentGroup },
      { key: "inprogress", labelKey: "planner.repick_group_inprogress", items: inProgress },
      { key: "moved_on", labelKey: "planner.repick_group_moved_on", items: movedOn },
      { key: "upcoming", labelKey: "planner.repick_group_upcoming", items: upcoming },
      { key: "inactive", labelKey: "planner.repick_group_inactive", items: inactive },
    ].filter(g => g.items.length > 0);

    const toggleStruggle2 = (s: string) => {
      setSelectedStruggles2(prev =>
        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
      );
    };

    const moveUp = (index: number) => {
      setSelectedStruggles2(prev => {
        if (index === 0) return prev;
        const next = [...prev];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        return next;
      });
    };

    const moveDown = (index: number) => {
      setSelectedStruggles2(prev => {
        if (index === prev.length - 1) return prev;
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-repick-title">{t("planner.repick_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("planner.repick_subtitle")}</p>

          {selectedStruggles2.length > 0 && (
            <div className="rounded-lg border bg-primary/5 p-3 space-y-2" data-testid="section-repick-picks">
              <p className="text-xs font-medium text-muted-foreground">{t("planner.repick_your_picks")}</p>
              {selectedStruggles2.map((s, i) => (
                <div key={s} className="flex items-center gap-2" data-testid={`item-repick-pick-${s}`}>
                  <span className="text-xs font-bold text-primary w-4 text-center">{i + 1}</span>
                  <span className="text-sm flex-1">{STRUGGLE_NAMES[s] || s}</span>
                  <div className="flex gap-0.5">
                    <button
                      disabled={i === 0}
                      onClick={() => moveUp(i)}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      data-testid={`button-repick-up-${s}`}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={i === selectedStruggles2.length - 1}
                      onClick={() => moveDown(i)}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      data-testid={`button-repick-down-${s}`}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => toggleStruggle2(s)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      data-testid={`button-repick-remove-${s}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groups.map(({ key, labelKey, items }) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t(labelKey)}</p>
              {items.map(s => {
                const isSelected = selectedStruggles2.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStruggle2(s)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                    data-testid={`button-repick-struggle-${s}`}
                  >
                    <span className="text-sm">{STRUGGLE_NAMES[s] || s}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}

          <Button
            className="w-full"
            disabled={selectedStruggles2.length === 0 || repickMutation.isPending}
            onClick={() => repickMutation.mutate(selectedStruggles2)}
            data-testid="button-repick-confirm"
          >
            {repickMutation.isPending ? "…" : t("planner.repick_confirm")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderPlanTransition() {
    return (
      <Card>
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center gap-3">
            <Calendar className="w-10 h-10 text-primary" />
            <h2 className="text-lg font-semibold" data-testid="text-plan-transition-title">
              {t("planner.plan_transition_title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("planner.plan_transition_desc")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function getLastWeekDuration(dayOfWeek: number): number | null {
    if (!reflection?.lastWeekSchedule) return null;
    const dayEntry = reflection.lastWeekSchedule.find((d: any) => d.dayOfWeek === dayOfWeek && d.walkScheduled && !d.standingTap);
    return dayEntry ? dayEntry.walkDuration : null;
  }

  function getMinDuration(dayOfWeek: number): number {
    if (negotiationAgreedMinutes) {
      const lastWeekDur = getLastWeekDuration(dayOfWeek);
      if (lastWeekDur && lastWeekDur >= 10) return lastWeekDur;
    }
    return 10;
  }

  function getDurationOptions(dayOfWeek: number): number[] {
    const min = getMinDuration(dayOfWeek);
    return [10, 15, 20].filter(v => v >= min);
  }

  function handleToggleWalkDay(day: number) {
    if (walkDays.includes(day)) {
      setWalkDays(walkDays.filter(d => d !== day));
      if (standingTapDay === day) {
        setStandingTapDay(null);
      }
    } else {
      setWalkDays([...walkDays, day]);
      if (!(day in walkDayDurations)) {
        const lastWeekDur = getLastWeekDuration(day);
        const defaultDur = acceptedEscalation === true ? 10 : (profile?.walkDuration || 10);
        setWalkDayDurations(prev => ({ ...prev, [day]: lastWeekDur && lastWeekDur >= 10 ? lastWeekDur : defaultDur }));
      }
      if (standingTapDay === day) {
        setStandingTapDay(null);
      }
    }
  }

  function renderWalkDays() {
    const showNegotiation = !isFirstWeek && reflection && !isStretchMode;
    const walkFreq = reflection?.walkDaysScheduled || 0;
    const walkDur = reflection?.walkDuration || 10;

    const isScenarioD = walkFreq >= 5 && walkDur >= 20;
    const isScenarioB = walkFreq >= 5 && walkDur < 20;
    const isScenarioC = walkFreq < 5 && walkDur >= 20;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-walk-days-title">
            {isStretchMode && acceptedEscalation !== true ? <Activity className="w-5 h-5 text-primary" /> : <Calendar className="w-5 h-5 text-primary" />}
            {isStretchMode && acceptedEscalation !== true ? t("planner.pick_stretch_days") : t("planner.pick_walk_days")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNegotiation && isScenarioD && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-2" data-testid="section-negotiation-congrats">
              <div className="flex items-start gap-2">
                <Award className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {walkFreq === 7
                    ? t("planner.congrats_every_day")
                    : t("planner.congrats_good_target")}
                </p>
              </div>
            </div>
          )}

          {showNegotiation && !isScenarioD && negotiationStep !== "done" && (
            <div className="bg-primary/5 rounded-lg p-4 space-y-3 mb-2" data-testid="section-negotiation">
              {negotiationStep === "ask_day" && (
                <>
                  <p className="text-sm font-medium" data-testid="text-negotiation-ask-day">{t("negotiation.ask_day")}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-add-day-yes">{t("negotiation.ask_day_yes")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-add-day-no">{t("negotiation.ask_day_no")}</Button>
                  </div>
                </>
              )}
              {negotiationStep === "ask_minutes" && (
                <>
                  <p className="text-sm font-medium" data-testid="text-negotiation-ask-minutes">{t("negotiation.ask_minutes")}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-add-minutes-yes">{t("common.want_yes")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-add-minutes-no">{t("common.want_no")}</Button>
                  </div>
                </>
              )}
              {negotiationStep === "glycemic_gap" && (
                <div className="space-y-3" data-testid="section-glycemic-gap">
                  <p className="text-sm text-muted-foreground italic">
                    {t("negotiation.glycemic_gap")}
                  </p>
                  <Button size="sm" onClick={() => setNegotiationStep("ask_day_again")} data-testid="button-glycemic-gap-continue">{t("negotiation.i_understand")}</Button>
                </div>
              )}
              {negotiationStep === "ask_day_again" && (
                <>
                  <p className="text-sm font-medium" data-testid="text-negotiation-ask-day-again">{t("negotiation.ask_day_again")}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-reconsider-yes">{t("common.yes")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-reconsider-no">{t("negotiation.ask_day_again_no")}</Button>
                  </div>
                </>
              )}
              {negotiationStep === "ask_standing_tap" && (
                <>
                  <div className="flex items-start gap-2">
                    <Timer className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-medium" data-testid="text-negotiation-standing-tap">
                      {t("negotiation.standing_tap_ask")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-standing-tap-yes">{t("common.yes")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-standing-tap-no">{t("common.no")}</Button>
                  </div>
                </>
              )}
              {negotiationStep === "pick_standing_tap_day" && (
                <div className="space-y-3" data-testid="section-pick-standing-tap-day">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium">{t("negotiation.pick_standing_tap_day")}</p>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_NAMES.map((name, i) => {
                      const isWalkDay = walkDays.includes(i);
                      const inactive = isWalkDay || ((isFirstWeek || isLatePlanningEarly) && i < firstActiveDay);
                      const isSelected = standingTapDay === i;
                      return (
                        <button
                          key={i}
                          onClick={() => !inactive && setStandingTapDay(isSelected ? null : i)}
                          disabled={inactive}
                          className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                            inactive
                              ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                              : isSelected
                                ? "bg-amber-500 text-white"
                                : "bg-muted text-muted-foreground"
                          }`}
                          data-testid={`button-standing-tap-day-${i}`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  {standingTapDay !== null && (
                    <Button size="sm" onClick={() => setNegotiationStep("done")} data-testid="button-standing-tap-confirm">
                      {t("negotiation.confirm_standing_tap", { day: DAY_NAMES[standingTapDay] })}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {isStretchMode && reflection?.autoEscalation && acceptedEscalation === null && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-3" data-testid="section-auto-escalation">
              <div className="flex items-start gap-2">
                <Award className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">{t("planner.stretch_nailed", { weeks: reflection?.stretchSuccessWeeks || 2 })}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("planner.ready_walks")}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setAcceptedEscalation(true); setNegotiationChoice("stretch_escalation"); }} data-testid="button-escalation-yes">{t("planner.yes_lets_do_it")}</Button>
                <Button size="sm" variant="outline" onClick={() => { setAcceptedEscalation(false); setNegotiationChoice("keep_current"); }} data-testid="button-escalation-no">{t("planner.not_yet")}</Button>
              </div>
            </div>
          )}

          {acceptedEscalation === true && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 flex items-start gap-2" data-testid="section-escalation-confirmed">
              <Award className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-400">{t("planner.escalation_confirmed")}</p>
            </div>
          )}

          {isStretchMode && reflection?.stretchProgression?.allCompleted && !reflection?.autoEscalation && (
            <div className="bg-primary/5 rounded-lg p-3 flex items-start gap-2" data-testid="section-stretch-suggestion">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t("planner.stretch_add_day", { count: (reflection.stretchProgression.lastWeekStretchCount || 1) + 1 })}
              </p>
            </div>
          )}

          {isStretchMode && reflection?.walkingBridge && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 flex items-start gap-2" data-testid="section-stretch-week-explanation">
              <Activity className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                {profile?.isStretchMode
                  ? t("planner.stretch_comfort")
                  : t("planner.walking_bridge")}
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {isStretchMode && acceptedEscalation !== true ? t("planner.pick_stretch_hint") : t("planner.tap_doable_days")}
          </p>

          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const inactive = (isFirstWeek || isLatePlanningEarly) && i < firstActiveDay;
              const isStandingTap = standingTapDay === i;
              return (
                <button
                  key={i}
                  onClick={() => !inactive && handleToggleWalkDay(i)}
                  disabled={inactive}
                  className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                    inactive
                      ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                      : walkDays.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : isStandingTap
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-amber-300"
                          : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`button-walk-day-${i}`}
                >
                  <span>{name}</span>
                  {isStandingTap && !walkDays.includes(i) && (
                    <Timer className="w-3 h-3 mx-auto mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {isStretchMode && acceptedEscalation !== true
              ? t("planner.stretch_days_selected", { count: walkDays.length })
              : t("planner.walk_days_selected", { count: walkDays.length })}
            {standingTapDay !== null && !walkDays.includes(standingTapDay) && ` + ${t("planner.one_standing_tap")}`}
          </p>

          {(!isStretchMode || acceptedEscalation === true) && walkDays.length > 0 && (
            <div className="space-y-2 pt-2 border-t" data-testid="section-walk-durations">
              <p className="text-xs font-medium text-muted-foreground">{t("planner.walk_duration_per_day")}</p>
              <div className="space-y-1.5">
                {walkDays.sort((a, b) => a - b).map(day => {
                  const options = getDurationOptions(day);
                  const currentDur = walkDayDurations[day] || options[0] || 10;
                  return (
                    <div key={day} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2" data-testid={`duration-row-${day}`}>
                      <span className="text-sm font-medium">{DAY_NAMES[day]}</span>
                      <div className="flex gap-1">
                        {options.map(dur => (
                          <button
                            key={dur}
                            onClick={() => setWalkDayDurations(prev => ({ ...prev, [day]: dur }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              currentDur === dur
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-primary/10"
                            }`}
                            data-testid={`button-duration-${day}-${dur}`}
                          >
                            {t("planner.duration_min_short", { duration: dur })}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {standingTapDay !== null && !walkDays.includes(standingTapDay) && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3" data-testid="section-standing-tap-summary">
              <Timer className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("planner.standing_tap_on", { day: DAY_NAMES[standingTapDay] })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderEatOutDays() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-eat-out-days-title">
            <ShoppingBag className="w-5 h-5 text-primary" />
            {t("planner.eat_out_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("planner.eat_out_desc")}</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const inactive = (isFirstWeek || isLatePlanningEarly) && i < firstActiveDay;
              return (
                <button
                  key={i}
                  onClick={() => !inactive && toggleDay(i, eatOutDays, setEatOutDays)}
                  disabled={inactive}
                  className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                    inactive
                      ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                      : eatOutDays.includes(i)
                        ? "bg-orange-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`button-eat-out-day-${i}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">{t("planner.days_selected", { count: eatOutDays.length })}</p>
        </CardContent>
      </Card>
    );
  }

  function renderLateDinnerDays() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-late-dinner-days-title">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            {t("planner.late_dinner_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("planner.late_dinner_desc")}</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const inactive = (isFirstWeek || isLatePlanningEarly) && i < firstActiveDay;
              return (
                <button
                  key={i}
                  onClick={() => !inactive && toggleDay(i, lateDinnerDays, setLateDinnerDays)}
                  disabled={inactive}
                  className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                    inactive
                      ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                      : lateDinnerDays.includes(i)
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`button-late-dinner-day-${i}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">{t("planner.days_selected", { count: lateDinnerDays.length })}</p>
        </CardContent>
      </Card>
    );
  }

  function renderStandingTapSuggest() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-standing-tap-suggest-title">
            <Activity className="w-5 h-5 text-primary" />
            {t("planner.standing_tap_suggest_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("planner.standing_tap_suggest_desc")}
          </p>

          {standingTapSuggestAccepted !== true ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setStandingTapSuggestAccepted(true)}
                data-testid="button-standing-tap-suggest-yes"
              >
                {t("planner.standing_tap_suggest_yes")}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setStandingTapSuggestAccepted(false); setStandingTapDay(null); goNext(); }}
                data-testid="button-standing-tap-suggest-no"
              >
                {t("planner.standing_tap_suggest_no")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t("planner.standing_tap_suggest_pick")}</p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((name, i) => {
                  const inactive = (isFirstWeek || isLatePlanningEarly) && i < firstActiveDay;
                  const selected = standingTapDay === i;
                  return (
                    <button
                      key={i}
                      onClick={() => { if (!inactive) setStandingTapDay(selected ? null : i); }}
                      disabled={inactive}
                      className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                        inactive
                          ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                          : selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`button-standing-tap-suggest-day-${i}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {standingTapDay !== null && (
                <Button size="sm" onClick={goNext} data-testid="button-standing-tap-suggest-confirm">
                  {t("negotiation.confirm_standing_tap", { day: DAY_NAMES[standingTapDay] })}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDinnerFocusReview() {
    const hasReflection = !!reflection;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-dinner-focus-title">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            {t("planner.this_week_focus_dinner")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("planner.current_focus")}</p>
            <p className="font-semibold text-lg" data-testid="text-dinner-focus-label">{t("planner.late_dinner_management")}</p>
          </div>

          <div className="bg-card border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{t("planner.available_tactics")}</p>
            <div className="space-y-1">
              <p className="text-sm" data-testid="text-tactic-fiber">
                <span className="font-medium text-amber-600">{t("mitigation.fiber_starter_label")}</span> — {t("mitigation.fiber_starter_short")}
              </p>
              <p className="text-sm" data-testid="text-tactic-dusk">
                <span className="font-medium text-amber-600">{t("mitigation.dusk_prep_label")}</span> — {t("mitigation.dusk_prep_short")}
              </p>
              <p className="text-sm" data-testid="text-tactic-split">
                <span className="font-medium text-amber-600">{t("mitigation.split_dinner_label")}</span> — {t("mitigation.split_dinner_short")}
              </p>
            </div>
          </div>

          {!hasReflection && (
            <p className="text-xs text-center text-muted-foreground" data-testid="text-dinner-focus-first-week">
              {t("planner.dinner_focus_first_week")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function getEffectiveStruggle() {
    const cycle = (profile?.currentStruggleCycle as number) || 1;
    const serverEval = reflection?.dietEvaluation;
    const isTransition = serverEval?.type === "mastered" || serverEval?.type === "not_relevant" || serverEval?.type === "moved_on";
    const previousStruggle = isTransition ? (serverEval?.struggle || null) : null;
    const hasEatOutDays = eatOutDays.length > 0;

    if (cycle === 2) {
      const struggles2 = (profile?.struggles2 as string[]) || [];
      const mastered1 = (profile?.masteredStruggles as string[]) || [];
      const mastered2 = (profile?.masteredStruggles2 as string[]) || [];
      const skipped2 = (profile?.skippedStruggles2 as string[]) || [];
      const difficult2 = (profile?.difficultStruggles2 as string[]) || [];

      // Only apply the hypothetical transition to cycle-2 state when the previous
      // struggle is actually a cycle-2 struggle (normal within-cycle-2 week transition).
      // If the previous struggle is a cycle-1 relic (not in struggles2), the cycle-1
      // evaluation must NOT pollute cycle-2 untried/triedNotMastered computation.
      const isTransitionWithinCycle2 = isTransition && !!previousStruggle && struggles2.includes(previousStruggle);

      const hypMastered2 = (isTransitionWithinCycle2 && serverEval?.type === "mastered" && previousStruggle)
        ? [...mastered2, previousStruggle] : mastered2;
      const hypSkipped2 = (isTransitionWithinCycle2 && serverEval?.type === "not_relevant" && previousStruggle)
        ? [...skipped2, previousStruggle] : skipped2;
      const hypDifficult2 = (isTransitionWithinCycle2 && serverEval?.type === "moved_on" && previousStruggle)
        ? [...difficult2, previousStruggle] : difficult2;
      const hypTriedBefore2 = [...new Set([...hypSkipped2, ...hypDifficult2])];

      const activeStruggles2 = struggles2.filter(s => !(s === "eat_out" && !hasEatOutDays));
      const untried2 = STRUGGLE_PRIORITY.filter(s => activeStruggles2.includes(s) && !hypMastered2.includes(s) && !mastered1.includes(s) && !hypTriedBefore2.includes(s));
      const triedNotMastered2 = STRUGGLE_PRIORITY.filter(s => activeStruggles2.includes(s) && hypTriedBefore2.includes(s));
      const fallback2 = STRUGGLE_PRIORITY.find(s => {
        if (s === "eat_out" && !hasEatOutDays) return false;
        return !mastered1.includes(s) && !hypMastered2.includes(s) && !hypTriedBefore2.includes(s);
      }) || "sugary_food_drink";
      const effectiveStruggle = [...untried2, ...triedNotMastered2][0] || fallback2;
      return { effectiveStruggle, isFallback: !activeStruggles2.includes(effectiveStruggle), isTransition, previousStruggle };
    }

    const struggles = (profile?.struggles as string[]) || [];
    const mastered = (profile?.masteredStruggles as string[]) || [];
    const skippedArr = (profile?.skippedStruggles as string[]) || [];
    const difficultArr = (profile?.difficultStruggles as string[]) || [];
    const legacyTried = (profile?.triedBeforeStruggles as string[]) || [];
    const triedBefore = [...new Set([...skippedArr, ...difficultArr, ...legacyTried])];

    const hypMastered = (isTransition && serverEval?.type === "mastered" && previousStruggle)
      ? [...mastered, previousStruggle] : mastered;
    const hypTriedBefore = (isTransition && (serverEval?.type === "not_relevant" || serverEval?.type === "moved_on") && previousStruggle)
      ? [...triedBefore, previousStruggle] : triedBefore;

    const effectiveStruggles = hasEatOutDays && !hypMastered.includes("eat_out") && !hypTriedBefore.includes("eat_out") && !struggles.includes("eat_out")
      ? [...struggles, "eat_out"]
      : struggles;

    const untried = STRUGGLE_PRIORITY.filter(s => effectiveStruggles.includes(s) && !hypMastered.includes(s) && !hypTriedBefore.includes(s));
    const triedNotMastered = STRUGGLE_PRIORITY.filter(s => effectiveStruggles.includes(s) && hypTriedBefore.includes(s));
    const fallbackStruggle = STRUGGLE_PRIORITY.find(s => {
      if (s === "eat_out" && !hasEatOutDays) return false;
      return !hypMastered.includes(s) && !hypTriedBefore.includes(s);
    }) || "sugary_food_drink";
    const effectiveStruggle = [...untried, ...triedNotMastered][0] || fallbackStruggle;

    return { effectiveStruggle, isFallback: !effectiveStruggles.includes(effectiveStruggle), isTransition, previousStruggle };
  }

  function renderDietReview() {
    const { effectiveStruggle, isFallback, isTransition, previousStruggle } = getEffectiveStruggle();

    const hasReflection = !!reflection;

    const serverEval = reflection?.dietEvaluation;
    const evalType: "mastered" | "not_relevant" | "moved_on" | "in_cycle" = serverEval?.type || "in_cycle";
    const nextStruggleLabel = isTransition ? (STRUGGLE_NAMES[effectiveStruggle] || effectiveStruggle) : "";
    const isTransitionType = evalType === "mastered" || evalType === "not_relevant" || evalType === "moved_on";

    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-diet-review-title">{t("planner.diet_focus_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFallback && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 flex items-start gap-2" data-testid="section-diet-fallback-message">
              <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">{t("planner.diet_fallback")}</p>
            </div>
          )}

          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("planner.current_struggle")}</p>
            <p className="font-semibold text-lg" data-testid="text-current-struggle">
              {isTransition && previousStruggle ? (STRUGGLE_NAMES[previousStruggle] || previousStruggle) : (STRUGGLE_NAMES[effectiveStruggle] || effectiveStruggle)}
            </p>
            {isFirstWeek && firstActiveDay > 0 && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-diet-mid-week-notice">{t("planner.diet_mid_week_notice")}</p>
            )}
          </div>

          {hasReflection && isTransitionType && nextStruggleLabel && (
            <div className="rounded-lg border p-4" data-testid="section-diet-next-struggle">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("planner.next_focus", { name: nextStruggleLabel })}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDietTipSelection() {
    const { effectiveStruggle, isTransition } = getEffectiveStruggle();
    const tipLadder = (DIET_TIP_LADDERS as Record<string, string[]>)[effectiveStruggle] || [];
    const lastWeekTip = reflection?.dietTip || null;
    const hasLastWeekTip = !isTransition && !!lastWeekTip && tipLadder.includes(lastWeekTip);

    if (tipLadder.length === 1) {
      if (!selectedTip) setTimeout(() => setSelectedTip(tipLadder[0]), 0);
      return (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-tip-selection-title">{t("planner.your_tip_this_week")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/5 rounded-lg p-4 text-center">
              <p className="font-medium text-primary" data-testid="text-auto-tip">{translateDietTip(tipLadder[0], t)}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (hasLastWeekTip && keepSameTip === null) {
      return (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-tip-selection-title">{t("planner.choose_your_tip")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("planner.last_week_practiced")}
            </p>
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="font-medium text-primary text-sm">{translateDietTip(lastWeekTip!, t)}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("planner.keep_practicing_tip")}
            </p>
            <div className="flex gap-3">
              <Button
                variant="default"
                className="flex-1"
                data-testid="button-keep-tip"
                onClick={() => {
                  setKeepSameTip(true);
                  setSelectedTip(lastWeekTip);
                  goNext();
                }}
              >
                {t("planner.yes_keep_it")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                data-testid="button-change-tip"
                onClick={() => setKeepSameTip(false)}
              >
                {t("planner.try_different")}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-tip-selection-title">{t("planner.pick_tip_to_practice")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("planner.choose_tip_desc")}
          </p>
          {tipLadder.map((tip, i) => (
            <button
              key={i}
              data-testid={`button-tip-${i}`}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                selectedTip === tip
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setSelectedTip(tip)}
            >
              <p className={`text-sm font-medium ${selectedTip === tip ? "text-primary" : ""}`}>{translateDietTip(tip, t)}</p>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  function renderPreview() {
    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-preview-title">{t("planner.week_at_glance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-8 gap-1 text-center text-xs">
            <div />
            {DAY_NAMES.map((name, i) => (
              <div key={i} className="font-medium text-muted-foreground">{name}</div>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
            <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">
              {isStretchActive && acceptedEscalation !== true ? t("home.stretch_row") : t("home.walk_row")}
            </div>
            {DAY_NAMES.map((_, i) => {
              const inactive = i < firstActiveDay;
              const previewWalkDays = isEmptyWeekStretch ? stretchDays : walkDays;
              return (
                <div key={i} className={`h-7 rounded flex items-center justify-center ${
                  inactive ? "bg-muted/30" :
                  previewWalkDays.includes(i) ? "bg-primary/20 text-primary" : "bg-muted"
                }`}>
                  {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                   previewWalkDays.includes(i) ? (isStretchActive && acceptedEscalation !== true ? <Activity className="w-3 h-3" /> : <Footprints className="w-3 h-3" />) : null}
                </div>
              );
            })}
          </div>

          {lateDinnerDays.length > 0 && (
            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">{t("home.late_dinner_row")}</div>
              {DAY_NAMES.map((_, i) => {
                const inactive = i < firstActiveDay;
                return (
                  <div key={i} className={`h-7 rounded flex items-center justify-center ${
                    inactive ? "bg-muted/30" :
                    lateDinnerDays.includes(i) ? "bg-amber-100 text-amber-700" : "bg-muted"
                  }`}>
                    {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                     lateDinnerDays.includes(i) ? <Soup className="w-3 h-3" /> : null}
                  </div>
                );
              })}
            </div>
          )}

          {eatOutDays.length > 0 && (
            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">{t("home.eat_out_row")}</div>
              {DAY_NAMES.map((_, i) => {
                const inactive = i < firstActiveDay;
                return (
                  <div key={i} className={`h-7 rounded flex items-center justify-center ${
                    inactive ? "bg-muted/30" :
                    eatOutDays.includes(i) ? "bg-orange-100 text-orange-600" : "bg-muted"
                  }`}>
                    {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                     eatOutDays.includes(i) ? <Wine className="w-3 h-3" /> : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground" data-testid="preview-legend">
            <div className="flex items-center gap-1">
              {isStretchActive && acceptedEscalation !== true ? <Activity className="w-3 h-3" /> : <Footprints className="w-3 h-3" />}
              {isStretchActive && acceptedEscalation !== true ? t("home.stretch_row") : t("home.walk_row")}
            </div>
            {lateDinnerDays.length > 0 && (
              <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> {t("home.late_dinner_legend")}</div>
            )}
            {eatOutDays.length > 0 && (
              <div className="flex items-center gap-1"><Wine className="w-3 h-3" /> {t("home.planned_eat_out")}</div>
            )}
          </div>

          {lateDinnerDays.length > 0 && !profile?.dinnerMastered && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-1" data-testid="section-preview-dinner-focus">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" /> {t("home.focus_dinner")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("home.choose_tactic_hint")}
              </p>
            </div>
          )}

          {!isDinnerFocus && (() => {
            const { effectiveStruggle: struggle } = getEffectiveStruggle();
            const tip = selectedTip || (DIET_TIP_LADDERS as Record<string, string[]>)[struggle]?.[0] || "";
            return (
              <div className="bg-primary/5 rounded-lg p-3 space-y-1" data-testid="section-preview-diet-focus">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {t("home.focus_label", { name: STRUGGLE_NAMES[struggle] || struggle })}
                </p>
                <p className="text-xs text-primary font-medium">{translateDietTip(tip, t)}</p>
              </div>
            );
          })()}

          <Button
            className="w-full mt-4"
            onClick={() => createPlanMutation.mutate()}
            disabled={createPlanMutation.isPending}
            data-testid="button-confirm-plan"
          >
            {createPlanMutation.isPending ? t("planner.creating_plan") : t("planner.confirm_start_week")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderStep() {
    switch (currentStepId) {
      case "weeklyReport": return renderWeeklyReport();
      case "planTransition": return renderPlanTransition();
      case "walkDays": return renderWalkDays();
      case "eatOutDays": return renderEatOutDays();
      case "lateDinnerDays": return renderLateDinnerDays();
      case "standingTapSuggest": return renderStandingTapSuggest();
      case "dinnerFocusReview": return renderDinnerFocusReview();
      case "repick": return renderRepick();
      case "dietReview": return renderDietReview();
      case "dietTipSelection": return renderDietTipSelection();
      case "preview": return renderPreview();
      default: return null;
    }
  }

  const isLastStep = currentStepId === "preview";

  const today = new Date();
  const effectiveDayJS = (() => {
    if (devTime?.dateOverride) {
      const d = new Date(devTime.dateOverride + "T00:00:00");
      return d.getDay();
    }
    return today.getDay();
  })();
  const effectiveHour = devTime?.timeOverride !== null && devTime?.timeOverride !== undefined
    ? devTime.timeOverride
    : today.getHours();
  const isSunday = effectiveDayJS === 0;
  const isAfter10pm = effectiveHour >= 22;
  const isSundayNight = isSunday && isAfter10pm;

  const isPastPlanWeek = !!planSundayStr && effectiveDateStr > planSundayStr;
  const isLatePlanning = isPastPlanWeek && !isSunday;
  const canPlan = isSundayNight || isLatePlanning;

  const isWeek1 = !isPastPlanWeek && (profile?.currentWeek === 1 || currentPlan?.weekNumber === 1);

  function renderMonthlyReportMessage() {
    const now = (() => {
      if (devTime?.dateOverride) {
        return new Date(devTime.dateOverride + "T00:00:00");
      }
      return new Date();
    })();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastDayOfMonth = now.getDate() === lastDay;
    const dateLocale = i18n.language === "yue" ? "zh-HK" : i18n.language === "zh-Hant" ? "zh-TW" : "en-US";
    const monthName = now.toLocaleDateString(dateLocale, { month: "long" });

    if (isLastDayOfMonth && monthlyReportLoading) {
      return (
        <Card className="mt-4" data-testid="card-monthly-report-status">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold">{t("planner.monthly_report")}</p>
            </div>
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (isLastDayOfMonth && monthlyReport && monthlyReport.weeksAnalyzed >= 4) {
      return (
        <div className="mt-4" data-testid="card-monthly-report-status">
          <MonthlyReportContent data={monthlyReport} monthName={monthName} />
        </div>
      );
    }

    return (
      <Card className="mt-4" data-testid="card-monthly-report-status">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{t("planner.monthly_report")}</p>
          </div>
          {isLastDayOfMonth ? (
            <p className="text-sm text-muted-foreground" data-testid="text-monthly-not-enough-data">
              {t("planner.monthly_not_enough")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-monthly-pending">
              {t("planner.monthly_pending", { month: monthName, day: lastDay })}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderPendingView(variant: "first_week" | "mid_week" = "first_week") {
    const titleKey = variant === "mid_week" ? "planner.pending_sunday" : "planner.first_week_pending";
    const descKey  = variant === "mid_week" ? "planner.pending_sunday_desc" : "planner.first_week_pending_desc";
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
        <Card data-testid="card-report-pending">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-3">
              <Clock className="w-10 h-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold" data-testid="text-report-pending-title">
                {t(titleKey)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(descKey)}
              </p>
            </div>
          </CardContent>
        </Card>
        {renderMonthlyReportMessage()}
      </div>
    );
  }

  function renderLastWeekReport() {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
        <h1 className="text-lg font-bold" data-testid="text-last-week-title">
          {t("planner.stats_last_week")}
        </h1>
        {renderWeeklyReport()}
        {renderMonthlyReportMessage()}
      </div>
    );
  }

  const nextWeekPlanned = !!(currentPlan?.startDate && effectiveDateStr < currentPlan.startDate);

  function renderPlanReady() {
    const planWeekNum = currentPlan?.weekNumber || (profile?.currentWeek ? profile.currentWeek - 1 : 1);
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
        <Card data-testid="card-plan-ready">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-3">
              <CalendarDays className="w-10 h-10 text-primary" />
              <h2 className="text-lg font-semibold" data-testid="text-plan-ready-title">
                {t("planner.week_plan_set", { week: planWeekNum })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSundayNight
                  ? t("planner.plan_set_sunday")
                  : t("planner.plan_set_other")}
              </p>
            </div>
          </CardContent>
        </Card>
        {renderMonthlyReportMessage()}
      </div>
    );
  }

  function renderCatchupGate() {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
        <Card className="border-amber-300/50 bg-amber-50 dark:bg-amber-950/20" data-testid="card-sunday-checkin-gate">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {t("planner.sunday_checkin_first")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("planner.sunday_checkin_desc")}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-go-home-checkin"
            >
              {t("planner.go_home")}
            </Button>
          </CardContent>
        </Card>
        {renderMonthlyReportMessage()}
      </div>
    );
  }

  // ── Single view-mode decision ─────────────────────────────────────────────
  // All time/week conditions (including canPlan) are resolved here in one
  // place. To add a new screen, extend this block — never stack another
  // early-return above it that ignores canPlan.
  const viewMode =
    isWeek1 && currentPlan && !canPlan                             ? "pending"
    : !isWeek1 && !canPlan && !isPastPlanWeek                      ? "mid_week_pending"
    : nextWeekPlanned                                              ? "plan_ready"
    : isPastPlanWeek && !canPlan                                   ? "last_week_report"
    : !isWeek1 && canPlan && isLatePlanning && !sundayCheckInDone  ? "catchup_gate"
    :                                                                "planner";
  // ─────────────────────────────────────────────────────────────────────────

  if (viewMode === "pending")          return renderPendingView();
  if (viewMode === "mid_week_pending") return renderPendingView("mid_week");
  if (viewMode === "plan_ready")       return renderPlanReady();
  if (viewMode === "last_week_report") return renderLastWeekReport();
  if (viewMode === "catchup_gate")     return renderCatchupGate();

  return (
    <>
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold" data-testid="text-planner-title">
            {isFirstWeek ? t("planner.plan_first_week") : t("planner.plan_week", { week: profile?.currentWeek || "" })}
          </h1>
          {!isFirstWeek && (() => {
            const weekNum = profile?.currentWeek || 1;
            const baseDate = new Date(effectiveDateStr + "T00:00:00");
            const jsDay = baseDate.getDay();
            const daysToMonday = jsDay === 0 ? 1 : (8 - jsDay) % 7 || 7;
            const nextMon = new Date(baseDate);
            if (isSunday) {
              nextMon.setDate(baseDate.getDate() + 1);
            } else {
              nextMon.setDate(baseDate.getDate() + daysToMonday);
            }
            const nextSun = new Date(nextMon);
            nextSun.setDate(nextMon.getDate() + 6);
            const fmtLocale = i18n.language === "yue" ? "zh-HK" : i18n.language === "zh-Hant" ? "zh-TW" : "en-US";
            const fmt = (d: Date) => d.toLocaleDateString(fmtLocale, { month: "short", day: "numeric" });
            return (
              <p className="text-xs text-muted-foreground" data-testid="text-planner-date-range">
                {fmt(nextMon)} – {fmt(nextSun)}
              </p>
            );
          })()}
          <span className="text-sm text-muted-foreground">
            {t("planner.step_of", { current: clampedStepIndex + 1, total: steps.length })}
          </span>
        </div>
        <Progress value={((clampedStepIndex + 1) / steps.length) * 100} className="h-2" />
      </div>

      {renderStep()}

      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goBack}
          disabled={clampedStepIndex === 0}
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> {t("planner.back")}
        </Button>

        {!isLastStep && (
          <Button
            size="sm"
            onClick={currentStepId === "weeklyReport" ? handleWeeklyReportNext : goNext}
            disabled={
              currentStepId === "repick" ||
              (currentStepId === "dietTipSelection" && !selectedTip) ||
              (currentStepId === "standingTapSuggest" && standingTapSuggestAccepted !== true) ||
              (currentStepId === "standingTapSuggest" && standingTapSuggestAccepted === true && standingTapDay === null)
            }
            data-testid="button-next"
          >
            {t("planner.next")} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {renderMonthlyReportMessage()}
    </div>
    <CoinSavedPopup coins={coinPopupCoins} visible={coinPopupCoins > 0} onDismiss={dismissCoinPopup} />
    <InfoCardPopup visible={cardDietFocus.visible} onDismiss={cardDietFocus.dismiss} icon={TrendingUp} titleKey="info_card.diet_focus.title" panelKeys={["info_card.diet_focus.p1","info_card.diet_focus.p2","info_card.diet_focus.p3"]} testId="dialog-card-diet-focus" />
    <InfoCardPopup visible={cardWalkEscalation.visible} onDismiss={cardWalkEscalation.dismiss} icon={Footprints} titleKey="info_card.walk_escalation.title" panelKeys={["info_card.walk_escalation.p1","info_card.walk_escalation.p2","info_card.walk_escalation.p3"]} testId="dialog-card-walk-escalation" />
    <InfoCardPopup visible={cardGlycemicGap.visible} onDismiss={cardGlycemicGap.dismiss} icon={Activity} titleKey="info_card.glycemic_gap.title" panelKeys={["info_card.glycemic_gap.p1","info_card.glycemic_gap.p2"]} testId="dialog-card-glycemic-gap" />
    <InfoCardPopup visible={cardStruggleIntroSugary.visible} onDismiss={cardStruggleIntroSugary.dismiss} icon={Wine} titleKey="info_card.struggle_intro_sugary.title" panelKeys={["info_card.struggle_intro_sugary.body"]} testId="dialog-card-struggle-intro-sugary" />
    <InfoCardPopup visible={cardStruggleIntroOily.visible} onDismiss={cardStruggleIntroOily.dismiss} icon={UtensilsCrossed} titleKey="info_card.struggle_intro_oily.title" panelKeys={["info_card.struggle_intro_oily.body"]} testId="dialog-card-struggle-intro-oily" />
    <InfoCardPopup visible={cardStruggleIntroPortions.visible} onDismiss={cardStruggleIntroPortions.dismiss} icon={Soup} titleKey="info_card.struggle_intro_portions.title" panelKeys={["info_card.struggle_intro_portions.body"]} testId="dialog-card-struggle-intro-portions" />
    <InfoCardPopup visible={cardStruggleIntroSnacks.visible} onDismiss={cardStruggleIntroSnacks.dismiss} icon={ShoppingBag} titleKey="info_card.struggle_intro_snacks.title" panelKeys={["info_card.struggle_intro_snacks.body"]} testId="dialog-card-struggle-intro-snacks" />
    <InfoCardPopup visible={cardStruggleIntroEatOut.visible} onDismiss={cardStruggleIntroEatOut.dismiss} icon={Utensils} titleKey="info_card.struggle_intro_eat_out.title" panelKeys={["info_card.struggle_intro_eat_out.body"]} testId="dialog-card-struggle-intro-eat-out" />
    {graduationPopupOpen && (() => {
      const struggledName = reflection?.dinnerJustGraduated
        ? t("planner.late_dinner")
        : (reflection?.dietStruggle ? (STRUGGLE_NAMES[reflection.dietStruggle] || reflection.dietStruggle) : "");
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          data-testid="dialog-graduation-popup"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl mx-4 p-8 flex flex-col items-center text-center gap-4 max-w-sm w-full">
            <Award className="w-16 h-16 text-primary" data-testid="icon-graduation-trophy" />
            <h2 className="text-2xl font-bold" data-testid="text-graduation-heading">
              {t("planner.graduation_popup_heading")}
            </h2>
            <p className="text-base text-muted-foreground" data-testid="text-graduation-body">
              {t("planner.graduation_popup_body", { name: struggledName })}
            </p>
            <Button
              onClick={() => setGraduationPopupOpen(false)}
              data-testid="button-graduation-dismiss"
              className="mt-2 w-full"
            >
              {t("planner.got_it")}
            </Button>
          </div>
        </div>
      );
    })()}
    </>
  );
}
