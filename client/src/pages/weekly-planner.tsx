import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CoinSavedPopup } from "@/components/coin-saved-popup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Check, ChevronLeft, ChevronRight, Footprints, UtensilsCrossed,
  Calendar, CalendarDays, ShoppingBag, TrendingUp, Award, RotateCcw, Clock,
  Wine, Soup, Minus, Activity, Sparkles, Timer,
} from "lucide-react";
import { DIET_TIP_LADDERS, STRUGGLE_PRIORITY } from "@shared/schema";
import { MonthlyReportContent, type MonthlyReportData } from "./monthly-report";
import { useTranslation } from "react-i18next";

export default function WeeklyPlanner() {
  const { t } = useTranslation();
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
  const [walkDayDurations, setWalkDayDurations] = useState<Record<number, number>>({});
  const [negotiationAgreedMinutes, setNegotiationAgreedMinutes] = useState(false);
  const [negotiationInitialized, setNegotiationInitialized] = useState(false);

  const isDinnerFocus = useMemo(() => {
    const effectiveDinnerMastered = reflection?.dinnerMastered ?? profile?.dinnerMastered;
    return lateDinnerDays.length > 0 && !effectiveDinnerMastered;
  }, [lateDinnerDays, profile?.dinnerMastered, reflection?.dinnerMastered]);

  const noWalkDays = walkDays.length === 0;

  const isStretchMode = profile?.isStretchMode || reflection?.walkingBridge || false;
  const isEmptyWeekStretch = !isStretchMode && stretchAccepted && stretchDays.length > 0;
  const isStretchActive = isStretchMode || isEmptyWeekStretch;

  const isDietTransition = reflection?.dietEvaluation?.type === "mastered" || reflection?.dietEvaluation?.type === "skipped" || reflection?.dietEvaluation?.type === "moved_on";

  const steps = useMemo(() => {
    const s: string[] = [];
    if (!isFirstWeek) {
      s.push("weeklyReport");
      if (reflection?.dinnerJustGraduated) s.push("dinnerGraduationCelebration");
      s.push("planTransition");
    }
    s.push("walkDays", "eatOutDays", "lateDinnerDays");
    if (noWalkDays) s.push("stretchOffer");
    if (isDinnerFocus && !profile?.currentStruggle) s.push("dinnerFocusReview");
    if (!isDinnerFocus) {
      s.push("dietReview");
      if (isDietTransition) s.push("dietGraduationCelebration");
      s.push("dietTipSelection");
    }
    s.push("preview");
    return s;
  }, [isFirstWeek, isDinnerFocus, profile?.currentStruggle, noWalkDays, reflection?.dinnerJustGraduated, isDietTransition]);

  const clampedStepIndex = Math.min(stepIndex, steps.length - 1);
  const currentStepId = steps[clampedStepIndex] || steps[0];

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
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
        } else if (walkFreq >= 5) {
          setNegotiationStep("ask_day_again");
        } else {
          setNegotiationStep("glycemic_gap");
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
                {t("planner.tip_label", { tip: reflection.dietTip })}
              </p>
              {reflection.weekInCycle > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="text-diet-cycle-info">
                  {t("planner.week_of_cycle", { week: reflection.weekInCycle })}
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
            </div>
          )}
          {reflection.missedCheckInDays >= 2 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4" data-testid="section-missed-checkins">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("planner.missed_checkins")}
              </p>
            </div>
          )}
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
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-add-day-yes">{t("common.yes")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-add-day-no">{t("common.no")}</Button>
                  </div>
                </>
              )}
              {negotiationStep === "ask_minutes" && (
                <>
                  <p className="text-sm font-medium" data-testid="text-negotiation-ask-minutes">{t("negotiation.ask_minutes")}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-add-minutes-yes">{t("common.yes")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-add-minutes-no">{t("common.no")}</Button>
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
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-reconsider-no">{t("common.no")}</Button>
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
                <Button size="sm" onClick={() => { setAcceptedEscalation(true); setNegotiationChoice("add_minutes"); }} data-testid="button-escalation-yes">{t("planner.yes_lets_do_it")}</Button>
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
          {firstActiveDay > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-mid-week-note">
              {isFirstWeek
                ? t("planner.joining_mid_week", { day: DAY_NAMES[firstActiveDay] })
                : t("planner.planning_late", { day: DAY_NAMES[firstActiveDay] })}
            </p>
          )}
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
                            {dur}m
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

  function renderStretchOffer() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-stretch-offer-title">
            <Activity className="w-5 h-5 text-primary" />
            {t("planner.one_small_step")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("planner.stretch_offer_desc")}
          </p>

          {!stretchAccepted ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setStretchAccepted(true)}
                data-testid="button-stretch-yes"
              >
                {t("planner.yes_lets_try")}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setStretchAccepted(false); goNext(); }}
                data-testid="button-stretch-no"
              >
                {t("planner.no_thanks")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t("planner.pick_stretch_label")}</p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((name, i) => {
                  const inactive = (isFirstWeek || isLatePlanningEarly) && i < firstActiveDay;
                  return (
                    <button
                      key={i}
                      onClick={() => !inactive && toggleDay(i, stretchDays, setStretchDays)}
                      disabled={inactive}
                      className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                        inactive
                          ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                          : stretchDays.includes(i)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`button-stretch-day-${i}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-sm text-muted-foreground">{t("planner.days_selected", { count: stretchDays.length })}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDinnerFocusReview() {
    const hasReflection = !!reflection;
    const dinnerGrad = reflection?.dinnerGraduation;
    const aggPct = dinnerGrad?.successPct || 0;
    const weeksFound = dinnerGrad?.weeksFound || 0;
    const totalDays = dinnerGrad?.totalDays || 0;
    const totalSuccess = dinnerGrad?.totalSuccess || 0;

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

          {hasReflection && dinnerGrad && (
            <div className="rounded-lg border p-4 space-y-3" data-testid="section-dinner-graduation-progress">
              <p className="text-sm font-medium">{t("planner.graduation_progress")}</p>
              {dinnerGrad.ready ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t("planner.days_across_weeks", { success: totalSuccess, total: totalDays })}</span>
                        <span>{t("planner.goal_80")}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${aggPct >= 80 ? "bg-green-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(aggPct, 100)}%` }}
                          data-testid="bar-dinner-graduation"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-dinner-agg-pct">
                    {aggPct >= 80 ? t("planner.ready_to_graduate", { pct: aggPct }) : t("planner.need_80_to_graduate", { pct: aggPct })}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          i < weeksFound
                            ? "bg-green-100 text-green-600 border border-green-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                        data-testid={`indicator-dinner-week-${i}`}
                      >
                        {i < weeksFound ? <Check className="w-3 h-3" /> : i + 1}
                      </div>
                    ))}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {t("planner.weeks_tracked", { count: weeksFound })}
                  </span>
                </div>
              )}
            </div>
          )}

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
    const struggles = (profile?.struggles as string[]) || [];
    const excludedStruggles: string[] = [];
    if (eatOutDays.length === 0) excludedStruggles.push("eat_out");
    const sortedStruggles = STRUGGLE_PRIORITY.filter(s => struggles.includes(s) && !excludedStruggles.includes(s));

    const serverEval = reflection?.dietEvaluation;
    const isTransition = serverEval?.type === "mastered" || serverEval?.type === "skipped" || serverEval?.type === "moved_on";
    if (isTransition && serverEval?.nextStruggle && !excludedStruggles.includes(serverEval.nextStruggle)) {
      return { effectiveStruggle: serverEval.nextStruggle, isFallback: !struggles.includes(serverEval.nextStruggle), isTransition: true, previousStruggle: profile?.currentStruggle || null };
    }

    const effectiveStruggle = profile?.currentStruggle && !excludedStruggles.includes(profile.currentStruggle)
      ? profile.currentStruggle
      : sortedStruggles[0] || "sugary_food_drink";
    return { effectiveStruggle, isFallback: !struggles.includes(effectiveStruggle), isTransition: false, previousStruggle: null };
  }

  function renderDietReview() {
    const { effectiveStruggle, isFallback, isTransition, previousStruggle } = getEffectiveStruggle();

    const hasReflection = !!reflection;
    const weekInCycle = reflection?.weekInCycle || 0;

    const serverEval = reflection?.dietEvaluation;
    const evalType: "mastered" | "skipped" | "stay" | "moved_on" | "in_cycle" = serverEval?.type || "in_cycle";
    const nextStruggleLabel = serverEval?.nextStruggle ? (STRUGGLE_NAMES[serverEval.nextStruggle] || serverEval.nextStruggle) : "";
    const bestTip = serverEval?.bestTip;
    const bestTipYes = serverEval?.bestTipYes || 0;
    const isTransitionType = evalType === "mastered" || evalType === "skipped" || evalType === "moved_on";

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
            {hasReflection && weekInCycle > 0 && weekInCycle < 3 && (
              <p className="text-xs text-muted-foreground mt-1">{t("planner.week_of_cycle", { week: weekInCycle })}</p>
            )}
          </div>

          {hasReflection && evalType !== "in_cycle" && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="section-diet-progression">
              {evalType === "mastered" && (
                <div className="flex items-start gap-2">
                  <Award className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {t("planner.mastered_struggle", { name: previousStruggle ? (STRUGGLE_NAMES[previousStruggle] || previousStruggle) : (STRUGGLE_NAMES[effectiveStruggle] || effectiveStruggle) })}
                    </p>
                    {nextStruggleLabel ? (
                      <p className="text-sm text-muted-foreground mt-1">{t("planner.moving_to", { name: nextStruggleLabel })}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{t("planner.all_struggles_done")}</p>
                    )}
                  </div>
                </div>
              )}
              {evalType === "skipped" && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      {t("planner.skipped_struggle")}
                    </p>
                    {nextStruggleLabel && (
                      <p className="text-sm text-muted-foreground mt-1">{t("planner.next_focus", { name: nextStruggleLabel })}</p>
                    )}
                  </div>
                </div>
              )}
              {evalType === "stay" && (
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-600">
                      {t("planner.stay_struggle", { pct: Math.round(((serverEval?.yesDays || 0) / 21) * 100) })}
                    </p>
                  </div>
                </div>
              )}
              {evalType === "moved_on" && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      {t("planner.moved_on_struggle")}
                    </p>
                    {nextStruggleLabel && (
                      <p className="text-sm text-muted-foreground mt-1">{t("planner.next_focus", { name: nextStruggleLabel })}</p>
                    )}
                  </div>
                </div>
              )}
              {isTransitionType && bestTip && bestTipYes > 0 && (
                <div className="bg-primary/5 rounded-lg p-3 mt-2" data-testid="section-best-tip">
                  <p className="text-xs text-muted-foreground mb-1">{t("planner.most_successful_tip")}</p>
                  <p className="text-sm font-medium" data-testid="text-best-tip">"{bestTip}"</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("planner.days_followed", { count: bestTipYes })}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDinnerGraduationCelebration() {
    const pct = reflection?.dinnerGraduationSuccessPct || 0;
    return (
      <Card>
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center gap-4">
            <Award className="w-12 h-12 text-amber-500" />
            <h2 className="text-xl font-bold" data-testid="text-dinner-graduation-title">{t("planner.dinner_mastered_title")}</h2>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg px-6 py-3">
              <p className="text-3xl font-bold text-green-600" data-testid="text-dinner-grad-pct">{pct}%</p>
              <p className="text-sm text-muted-foreground">{t("planner.dinner_success_3weeks")}</p>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("planner.dinner_mastered_desc")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderDietGraduationCelebration() {
    const serverEval = reflection?.dietEvaluation;
    const evalType = serverEval?.type;
    const bestTip = serverEval?.bestTip;
    const bestTipYes = serverEval?.bestTipYes || 0;
    const { effectiveStruggle, previousStruggle } = getEffectiveStruggle();
    const nextStruggleLabel = serverEval?.nextStruggle ? (STRUGGLE_NAMES[serverEval.nextStruggle] || serverEval.nextStruggle) : "";
    const struggleName = previousStruggle ? (STRUGGLE_NAMES[previousStruggle] || previousStruggle) : (STRUGGLE_NAMES[effectiveStruggle] || effectiveStruggle);
    return (
      <Card>
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center gap-4">
            {evalType === "mastered" && <Award className="w-12 h-12 text-primary" />}
            {(evalType === "skipped" || evalType === "moved_on") && <TrendingUp className="w-12 h-12 text-green-500" />}
            <h2 className="text-xl font-bold" data-testid="text-diet-graduation-title">
              {evalType === "mastered" ? t("planner.struggle_mastered", { name: struggleName }) : t("planner.moving_on_from", { name: struggleName })}
            </h2>
            {evalType === "mastered" && <p className="text-sm text-muted-foreground">{t("planner.great_job_sticking")}</p>}
            {evalType === "skipped" && <p className="text-sm text-muted-foreground">{t("planner.skipped_struggle")}</p>}
            {evalType === "moved_on" && <p className="text-sm text-muted-foreground">{t("planner.moved_on_struggle")}</p>}
            {bestTip && bestTipYes > 0 && (
              <div className="bg-primary/5 rounded-lg p-4 w-full max-w-sm" data-testid="section-diet-grad-best-tip">
                <p className="text-xs text-muted-foreground mb-1">{t("planner.most_successful_tip")}</p>
                <p className="text-sm font-medium">"{bestTip}"</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("planner.days_followed", { count: bestTipYes })}</p>
              </div>
            )}
            {nextStruggleLabel && (
              <p className="text-sm text-muted-foreground">
                {evalType === "mastered" ? t("planner.next_focus", { name: "" }) : t("planner.moving_to", { name: "" })} <span className="font-medium">{nextStruggleLabel}</span>
              </p>
            )}
          </div>
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
              <p className="font-medium text-primary" data-testid="text-auto-tip">{tipLadder[0]}</p>
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
              <p className="font-medium text-primary text-sm">{lastWeekTip}</p>
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
              <p className={`text-sm font-medium ${selectedTip === tip ? "text-primary" : ""}`}>{tip}</p>
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
                <p className="text-xs text-primary font-medium">{tip}</p>
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
      case "stretchOffer": return renderStretchOffer();
      case "dinnerFocusReview": return renderDinnerFocusReview();
      case "dinnerGraduationCelebration": return renderDinnerGraduationCelebration();
      case "dietReview": return renderDietReview();
      case "dietGraduationCelebration": return renderDietGraduationCelebration();
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
    const monthName = now.toLocaleDateString("en-US", { month: "long" });

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

  function renderPendingView() {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
        <Card data-testid="card-report-pending">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-3">
              <Clock className="w-10 h-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold" data-testid="text-report-pending-title">
                {t("planner.first_week_pending")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("planner.first_week_pending_desc")}
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

  if (isWeek1 && currentPlan) {
    return renderPendingView();
  }

  const nextWeekPlanned = !!(currentPlan?.startDate && effectiveDateStr < currentPlan.startDate);

  if (nextWeekPlanned) {
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

  if (isPastPlanWeek && !canPlan) {
    return renderLastWeekReport();
  }

  if (!isWeek1 && canPlan && isLatePlanning && !sundayCheckInDone) {
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
            const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
            disabled={currentStepId === "dietTipSelection" && !selectedTip}
            data-testid="button-next"
          >
            {t("planner.next")} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {renderMonthlyReportMessage()}
    </div>
    <CoinSavedPopup coins={coinPopupCoins} visible={coinPopupCoins > 0} onDismiss={dismissCoinPopup} />
    </>
  );
}
