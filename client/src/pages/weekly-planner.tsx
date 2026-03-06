import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Check, ChevronLeft, ChevronRight, Footprints, UtensilsCrossed,
  Calendar, ShoppingBag, TrendingUp, Award, RotateCcw, Clock,
  Wine, Soup, Minus, Activity, Sparkles,
} from "lucide-react";
import { DIET_TIP_LADDERS, STRUGGLE_PRIORITY } from "@shared/schema";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STRUGGLE_NAMES: Record<string, string> = {
  sugary_food_drink: "Sugary Food & Drinks",
  oily_fried_food: "Oily/Fried Food",
  eat_out: "Eating Out",
  portions: "Portion Control",
  snacks: "Snacking",
};

export default function WeeklyPlanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });
  const { data: currentPlan } = useQuery({ queryKey: ["/api/plan/current"] });
  const { data: reflection } = useQuery({ queryKey: ["/api/plan/reflection"] });
  const { data: devTime } = useQuery({ queryKey: ["/api/dev/time"] });

  const isFirstWeek = !reflection;

  const firstActiveDay = (() => {
    if (!isFirstWeek) return 0;
    const now = new Date();
    let todayDow: number;
    if (devTime?.dateOverride) {
      const d = new Date(devTime.dateOverride + "T00:00:00");
      const jsDay = d.getDay();
      todayDow = jsDay === 0 ? 6 : jsDay - 1;
    } else {
      const jsDay = now.getDay();
      todayDow = jsDay === 0 ? 6 : jsDay - 1;
    }
    return todayDow === 0 ? 0 : Math.min(todayDow + 1, 6);
  })();

  const [stepIndex, setStepIndex] = useState(0);
  const [negotiationChoice, setNegotiationChoice] = useState<string>("keep_current");
  const [negotiationStep, setNegotiationStep] = useState<"ask_day" | "ask_minutes" | "done">("ask_day");
  const [walkDays, setWalkDays] = useState<number[]>([]);
  const [eatOutDays, setEatOutDays] = useState<number[]>([]);
  const [lateDinnerDays, setLateDinnerDays] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [stretchDays, setStretchDays] = useState<number[]>([]);
  const [stretchAccepted, setStretchAccepted] = useState(false);

  const isDinnerFocus = useMemo(() => {
    return lateDinnerDays.length > 0 && !profile?.dinnerMastered;
  }, [lateDinnerDays, profile?.dinnerMastered]);

  const isEmptyWeek = useMemo(() => {
    return walkDays.length === 0 && eatOutDays.length === 0 && lateDinnerDays.length === 0;
  }, [walkDays, eatOutDays, lateDinnerDays]);

  const isStretchMode = profile?.isStretchMode || reflection?.walkingBridge || false;
  const isEmptyWeekStretch = !isStretchMode && stretchAccepted && stretchDays.length > 0;
  const isStretchActive = isStretchMode || isEmptyWeekStretch;

  const steps = useMemo(() => {
    const s: string[] = [];
    if (!isFirstWeek) s.push("weeklyReport");
    s.push("walkDays", "eatOutDays", "lateDinnerDays");
    if (isEmptyWeek) s.push("stretchOffer");
    if (isDinnerFocus && !profile?.currentStruggle) s.push("dinnerFocusReview");
    if (!isDinnerFocus) s.push("dietReview");
    s.push("preview");
    return s;
  }, [isFirstWeek, isDinnerFocus, profile?.currentStruggle, isEmptyWeek]);

  const clampedStepIndex = Math.min(stepIndex, steps.length - 1);
  const currentStepId = steps[clampedStepIndex] || steps[0];

  useEffect(() => {
    if (initialized) return;
    if (!profile) return;

    if (reflection?.lastWeekSchedule && reflection.lastWeekSchedule.length > 0) {
      const schedule = reflection.lastWeekSchedule;
      setWalkDays(schedule.filter((d: any) => d.walkScheduled).map((d: any) => d.dayOfWeek));
      setEatOutDays(schedule.filter((d: any) => d.eatOutScheduled).map((d: any) => d.dayOfWeek));
      setLateDinnerDays(schedule.filter((d: any) => d.lateDinnerScheduled).map((d: any) => d.dayOfWeek));
      setInitialized(true);
    } else if (!reflection) {
      const pw = profile?.walksPerWeek || 3;
      const availableDays = Array.from({ length: 7 }, (_, i) => i).filter(d => d >= firstActiveDay);
      setWalkDays(availableDays.slice(0, pw));
      setInitialized(true);
    }
  }, [profile, reflection, initialized]);

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const effectiveWalkDays = isEmptyWeekStretch ? stretchDays : walkDays;
      const res = await apiRequest("POST", "/api/plan/weekly", {
        negotiationChoice,
        walkDays: effectiveWalkDays,
        eatOutDays,
        lateDinnerDays,
        stretchOnly: isStretchActive,
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

  function handleNegotiationAnswer(answer: "yes" | "no") {
    if (negotiationStep === "ask_day") {
      if (answer === "yes") {
        setNegotiationChoice("add_day");
        let days = [...walkDays];
        for (let i = 0; i < 7; i++) {
          if (!days.includes(i)) { days.push(i); break; }
        }
        setWalkDays(days);
        setNegotiationStep("done");
      } else {
        if (reflection && reflection.walkDuration < 20) {
          setNegotiationStep("ask_minutes");
        } else {
          setNegotiationStep("done");
        }
      }
    } else if (negotiationStep === "ask_minutes") {
      if (answer === "yes") {
        setNegotiationChoice("add_minutes");
      }
      setNegotiationStep("done");
    }
  }

  function handleStandingReset() {
    setNegotiationChoice("standing_reset");
    setNegotiationStep("done");
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

  function goBack() {
    if (clampedStepIndex - 1 >= 0) {
      setStepIndex(clampedStepIndex - 1);
    }
  }

  function renderWeeklyReport() {
    if (!reflection) return null;

    const dietTotalResponses = reflection.dietYesCount + reflection.dietNoCount + reflection.dietNoChanceCount;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-weekly-report-title">
            <Award className="w-5 h-5 text-primary" />
            Week {reflection.weekNumber} Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border p-4 space-y-1" data-testid="section-physical">
            <div className="flex items-center gap-2 mb-2">
              <Footprints className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Physical</p>
            </div>
            <p className="text-2xl font-bold text-center text-primary" data-testid="text-walk-report">
              {reflection.walkDaysCompleted}/{reflection.walkDaysScheduled} walk days
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {reflection.walkSuccessPct}% completion
            </p>
          </div>

          {(reflection.dinnerEarlyTotal > 0 || reflection.dinnerTacticTotal > 0) && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="section-late-dinner">
              <div className="flex items-center gap-2 mb-2">
                <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-sm">Late Dinner</p>
              </div>
              {reflection.dinnerEarlyTotal > 0 && (
                <p className="text-sm" data-testid="text-dinner-early-report">
                  You moved dinner early <span className="font-semibold">{reflection.dinnerEarlyCount}/{reflection.dinnerEarlyTotal}</span> days
                </p>
              )}
              {reflection.dinnerTacticTotal > 0 && (
                <p className="text-sm" data-testid="text-dinner-tactic-report">
                  You followed dinner tactic <span className="font-semibold">{reflection.dinnerTacticCount}/{reflection.dinnerTacticTotal}</span> days
                </p>
              )}
            </div>
          )}

          {reflection.dietStruggle && dietTotalResponses > 0 && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="section-diet-struggle">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <p className="font-semibold text-sm">Diet — {STRUGGLE_NAMES[reflection.dietStruggle] || reflection.dietStruggle}</p>
              </div>
              <p className="text-sm font-medium" data-testid="text-diet-tip-last">
                Tip: {reflection.dietTip}
              </p>
              <div className="text-sm space-y-1" data-testid="text-diet-report">
                {reflection.dietYesCount > 0 && (
                  <p className="text-green-600">Completed tip {reflection.dietYesCount} time{reflection.dietYesCount !== 1 ? "s" : ""}</p>
                )}
                {reflection.dietNoChanceCount > 0 && (
                  <p className="text-muted-foreground">No chance to practice {reflection.dietNoChanceCount} time{reflection.dietNoChanceCount !== 1 ? "s" : ""}</p>
                )}
                {reflection.dietNoCount > 0 && (
                  <p className="text-amber-600">Unable to complete {reflection.dietNoCount} time{reflection.dietNoCount !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderWalkDays() {
    const showNegotiation = !isFirstWeek && reflection && !isStretchMode;
    const showNegotiationQuestion = showNegotiation && reflection.suggestedActions && reflection.suggestedActions.length > 0;
    const walkFreq = reflection?.walkDaysScheduled || 0;
    const walkDur = reflection?.walkDuration || 10;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-walk-days-title">
            {isStretchMode ? <Activity className="w-5 h-5 text-primary" /> : <Calendar className="w-5 h-5 text-primary" />}
            {isStretchMode ? "Pick your stretch days" : "Which days work best for a walk?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNegotiationQuestion && negotiationStep !== "done" && (
            <div className="bg-primary/5 rounded-lg p-4 space-y-3 mb-2" data-testid="section-negotiation">
              {negotiationStep === "ask_day" && walkFreq < 5 && (
                <>
                  <p className="text-sm font-medium">Would you like to add 1 more walk day this week?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-add-day-yes">Yes</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-add-day-no">No</Button>
                  </div>
                </>
              )}
              {negotiationStep === "ask_day" && walkFreq >= 5 && walkDur < 20 && (
                <>
                  <p className="text-sm font-medium">Would you like to add 5 more minutes to your walks?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setNegotiationChoice("add_minutes"); setNegotiationStep("done"); }} data-testid="button-negotiation-add-minutes-yes">Yes</Button>
                    <Button size="sm" variant="outline" onClick={() => setNegotiationStep("done")} data-testid="button-negotiation-add-minutes-no">No</Button>
                  </div>
                </>
              )}
              {negotiationStep === "ask_day" && walkFreq >= 5 && walkDur >= 20 && (
                <>
                  <p className="text-sm font-medium">Amazing — you've hit the maximum! Keep it up</p>
                  <p className="text-xs text-muted-foreground">Consider a Standing Reset — add short 2-min standing breaks on rest days to cover the Glycemic Gap.</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleStandingReset} data-testid="button-negotiation-standing-reset">Try Standing Reset</Button>
                    <Button size="sm" variant="outline" onClick={() => setNegotiationStep("done")} data-testid="button-negotiation-keep">Keep Current</Button>
                  </div>
                </>
              )}
              {negotiationStep === "ask_minutes" && (
                <>
                  <p className="text-sm font-medium">Would you like to add 5 more minutes to your walks?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleNegotiationAnswer("yes")} data-testid="button-negotiation-add-minutes-yes">Yes</Button>
                    <Button size="sm" variant="outline" onClick={() => handleNegotiationAnswer("no")} data-testid="button-negotiation-add-minutes-no">No</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {isStretchMode && reflection?.autoEscalation && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-3" data-testid="section-auto-escalation">
              <div className="flex items-start gap-2">
                <Award className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">You've nailed stretching for 2 weeks!</p>
                  <p className="text-sm text-muted-foreground mt-1">Ready to try 5-minute walks?</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setNegotiationChoice("add_minutes")} data-testid="button-escalation-yes">Yes, let's do it</Button>
                <Button size="sm" variant="outline" onClick={() => setNegotiationChoice("keep_current")} data-testid="button-escalation-no">Not yet</Button>
              </div>
            </div>
          )}

          {isStretchMode && reflection?.stretchProgression?.allCompleted && !reflection?.autoEscalation && (
            <div className="bg-primary/5 rounded-lg p-3 flex items-start gap-2" data-testid="section-stretch-suggestion">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Great job last week! Want to add one more stretch day? (suggested: {(reflection.stretchProgression.lastWeekStretchCount || 1) + 1} days)
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {isStretchMode ? "Pick days for a 2-minute post-dinner stretch" : "Tap the days that feel doable this week"}
          </p>
          {isFirstWeek && firstActiveDay > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-mid-week-note">
              You're joining mid-week — days before {DAY_NAMES[firstActiveDay]} are inactive
            </p>
          )}
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const inactive = isFirstWeek && i < firstActiveDay;
              return (
                <button
                  key={i}
                  onClick={() => !inactive && toggleDay(i, walkDays, setWalkDays)}
                  disabled={inactive}
                  className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                    inactive
                      ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                      : walkDays.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`button-walk-day-${i}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">{walkDays.length} days selected</p>
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
            Eating Out Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Any days you'll be eating out?</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const inactive = isFirstWeek && i < firstActiveDay;
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
          <p className="text-center text-sm text-muted-foreground">{eatOutDays.length} days selected</p>
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
            Late Dinner Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Any nights where dinner will be late (after 9pm)?</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const inactive = isFirstWeek && i < firstActiveDay;
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
          <p className="text-center text-sm text-muted-foreground">{lateDinnerDays.length} days selected</p>
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
            One Small Step
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Would you like to do a 2-minute post-dinner stretch on one or more days this week?
          </p>

          {!stretchAccepted ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setStretchAccepted(true)}
                data-testid="button-stretch-yes"
              >
                Yes, let's try it
              </Button>
              <Button
                variant="outline"
                onClick={() => { setStretchAccepted(false); goNext(); }}
                data-testid="button-stretch-no"
              >
                No thanks
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Pick your stretch days:</p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((name, i) => {
                  const inactive = isFirstWeek && i < firstActiveDay;
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
              <p className="text-center text-sm text-muted-foreground">{stretchDays.length} days selected</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDinnerFocusReview() {
    const hasReflection = !!reflection;
    const dinnerSuccessPct = reflection?.dinnerSuccessPct || 0;
    const successWeeks = profile?.dinnerSuccessWeeks || 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-dinner-focus-title">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            This Week's Focus: Late Dinner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Current focus</p>
            <p className="font-semibold text-lg" data-testid="text-dinner-focus-label">Late Dinner Management</p>
          </div>

          {hasReflection && (
            <div className="rounded-lg border p-4 space-y-3" data-testid="section-dinner-graduation-progress">
              <p className="text-sm font-medium">Graduation progress</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Last week: {dinnerSuccessPct}% success</span>
                    <span>Goal: 95%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${dinnerSuccessPct >= 95 ? "bg-green-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(dinnerSuccessPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        i < successWeeks
                          ? "bg-green-100 text-green-600 border border-green-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`indicator-success-week-${i}`}
                    >
                      {i < successWeeks ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                  ))}
                </div>
                <span className="text-muted-foreground text-xs">
                  {successWeeks}/3 successful weeks (95%+ each)
                </span>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Available tactics</p>
            <div className="space-y-1">
              <p className="text-sm" data-testid="text-tactic-fiber">
                <span className="font-medium text-amber-600">Fiber Starter</span> — eat veggies first
              </p>
              <p className="text-sm" data-testid="text-tactic-dusk">
                <span className="font-medium text-amber-600">Dusk Prep</span> — light snack at 5 PM
              </p>
              <p className="text-sm" data-testid="text-tactic-split">
                <span className="font-medium text-amber-600">Split Dinner</span> — split into two smaller meals
              </p>
            </div>
          </div>

          {!hasReflection && (
            <p className="text-xs text-center text-muted-foreground" data-testid="text-dinner-focus-first-week">
              Each day you mark as "late dinner," you'll choose a tactic during your daily check-in.
              Reach 95% success for 3 weeks to graduate!
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDietReview() {
    const struggles = (profile?.struggles as string[]) || [];
    const excludedStruggles: string[] = [];
    if (eatOutDays.length === 0) excludedStruggles.push("eat_out");
    const sortedStruggles = STRUGGLE_PRIORITY.filter(s => struggles.includes(s) && !excludedStruggles.includes(s));
    const effectiveStruggle = profile?.currentStruggle && !excludedStruggles.includes(profile.currentStruggle)
      ? profile.currentStruggle
      : sortedStruggles[0] || "sugary_food_drink";
    const isFallback = !struggles.includes(effectiveStruggle);

    const tipLadder = (DIET_TIP_LADDERS as Record<string, string[]>)[effectiveStruggle] || [];
    const effectiveTipIndex = profile?.currentStruggle ? profile.currentTipIndex : 0;
    const currentTip = tipLadder[effectiveTipIndex] || "";
    const isCleanWeek = reflection?.dietCleanWeek;
    const hasReflection = !!reflection;

    let nextTipLabel = "";
    let statusType: "advance" | "repeat" | "mastered" = "repeat";

    if (hasReflection) {
      const totalResponses = reflection.dietYesCount + reflection.dietNoCount + reflection.dietNoChanceCount;
      if (totalResponses > 0 && isCleanWeek) {
        if (effectiveTipIndex + 1 < tipLadder.length) {
          statusType = "advance";
          nextTipLabel = tipLadder[effectiveTipIndex + 1];
        } else {
          const currentStruggleIdx = STRUGGLE_PRIORITY.indexOf(effectiveStruggle as any);
          let nextStruggle: string | null = null;
          if (currentStruggleIdx >= 0 && currentStruggleIdx < STRUGGLE_PRIORITY.length - 1) {
            nextStruggle = STRUGGLE_PRIORITY[currentStruggleIdx + 1];
          }
          if (nextStruggle) {
            statusType = "mastered";
            nextTipLabel = STRUGGLE_NAMES[nextStruggle] || nextStruggle;
          } else {
            statusType = "mastered";
            nextTipLabel = "";
          }
        }
      } else {
        statusType = "repeat";
      }
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-diet-review-title">This Week's Diet Focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFallback && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 flex items-start gap-2" data-testid="section-diet-fallback-message">
              <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Let's add a small focus this week!</p>
            </div>
          )}

          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Current struggle</p>
            <p className="font-semibold text-lg" data-testid="text-current-struggle">
              {STRUGGLE_NAMES[effectiveStruggle] || effectiveStruggle}
            </p>
          </div>

          {hasReflection && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="section-diet-progression">
              {statusType === "advance" && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-600">Clean week! Moving to next tip</p>
                    <p className="text-sm text-muted-foreground mt-1">{nextTipLabel}</p>
                  </div>
                </div>
              )}
              {statusType === "repeat" && (
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-600">Repeating same tip this week</p>
                    <p className="text-sm text-muted-foreground mt-1">{currentTip}</p>
                  </div>
                </div>
              )}
              {statusType === "mastered" && (
                <div className="flex items-start gap-2">
                  <Award className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      Mastered {STRUGGLE_NAMES[effectiveStruggle] || effectiveStruggle}!
                    </p>
                    {nextTipLabel && (
                      <p className="text-sm text-muted-foreground mt-1">Moving to: {nextTipLabel}</p>
                    )}
                    {!nextTipLabel && (
                      <p className="text-sm text-muted-foreground mt-1">All diet struggles completed!</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">This week's tip</p>
            <p className="font-medium text-primary" data-testid="text-current-tip">
              {statusType === "advance" ? nextTipLabel : currentTip}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderPreview() {
    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-preview-title">Your Week at a Glance</CardTitle>
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
              {isStretchActive ? "Stretch" : "Walk"}
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
                   previewWalkDays.includes(i) ? (isStretchActive ? <Activity className="w-3 h-3" /> : <Footprints className="w-3 h-3" />) : null}
                </div>
              );
            })}
          </div>

          {lateDinnerDays.length > 0 && (
            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">Late Dinner</div>
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
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">Eat Out</div>
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
              {isStretchActive ? <Activity className="w-3 h-3" /> : <Footprints className="w-3 h-3" />}
              {isStretchActive ? "Stretch" : "Walk"}
            </div>
            {lateDinnerDays.length > 0 && (
              <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> Late dinner</div>
            )}
            {eatOutDays.length > 0 && (
              <div className="flex items-center gap-1"><Wine className="w-3 h-3" /> Eat out</div>
            )}
          </div>

          {lateDinnerDays.length > 0 && !profile?.dinnerMastered && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-1" data-testid="section-preview-dinner-focus">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" /> Focus: Late Dinner Management
              </p>
              <p className="text-xs text-muted-foreground">
                Choose a tactic each late dinner day during your daily check-in
              </p>
            </div>
          )}

          {!isDinnerFocus && (() => {
            const struggles = (profile?.struggles as string[]) || [];
            const excludedStruggles: string[] = [];
            if (eatOutDays.length === 0) excludedStruggles.push("eat_out");
            const sorted = STRUGGLE_PRIORITY.filter(s => struggles.includes(s) && !excludedStruggles.includes(s));
            const struggle = (profile?.currentStruggle && !excludedStruggles.includes(profile.currentStruggle))
              ? profile.currentStruggle
              : sorted[0] || "sugary_food_drink";
            const tipIndex = profile?.currentStruggle === struggle ? profile.currentTipIndex : 0;
            const tip = (DIET_TIP_LADDERS as Record<string, string[]>)[struggle]?.[tipIndex] || "";
            return (
              <div className="bg-primary/5 rounded-lg p-3 space-y-1" data-testid="section-preview-diet-focus">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Focus: {STRUGGLE_NAMES[struggle] || struggle}
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
            {createPlanMutation.isPending ? "Creating plan..." : "Confirm & Start Week"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderStep() {
    switch (currentStepId) {
      case "weeklyReport": return renderWeeklyReport();
      case "walkDays": return renderWalkDays();
      case "eatOutDays": return renderEatOutDays();
      case "lateDinnerDays": return renderLateDinnerDays();
      case "stretchOffer": return renderStretchOffer();
      case "dinnerFocusReview": return renderDinnerFocusReview();
      case "dietReview": return renderDietReview();
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
  const isAfter6pm = effectiveHour >= 18;
  const isSundayNight = isSunday && isAfter6pm;

  const isWeek1 = profile?.currentWeek === 1;

  function renderMonthlyReportMessage() {
    const now = (() => {
      if (devTime?.dateOverride) {
        return new Date(devTime.dateOverride + "T00:00:00");
      }
      return new Date();
    })();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastDayOfMonth = now.getDate() === lastDay;
    const lastDayDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthName = lastDayDate.toLocaleDateString("en-US", { month: "long" });

    return (
      <Card className="mt-4" data-testid="card-monthly-report-status">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Monthly Report</p>
          </div>
          {isLastDayOfMonth ? (
            <p className="text-sm text-primary font-medium" data-testid="text-monthly-available">
              Your monthly report is available today!
            </p>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-monthly-pending">
              Your monthly report will be available on {monthName} {lastDay}
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
                Your first week's report is pending!
              </h2>
              <p className="text-sm text-muted-foreground">
                Complete your week and check back on Sunday to see your report and plan the next week.
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
          Your statistics last week
        </h1>
        {renderWeeklyReport()}
        {renderMonthlyReportMessage()}
      </div>
    );
  }

  const alreadyPlanned = currentPlan && currentPlan.currentWeek && currentPlan.weekNumber === currentPlan.currentWeek - 1;

  if (isWeek1 && currentPlan) {
    return renderPendingView();
  }

  if (!isWeek1 && !isSundayNight) {
    return renderLastWeekReport();
  }

  if (isSundayNight && alreadyPlanned) {
    return renderLastWeekReport();
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold" data-testid="text-planner-title">
            {isFirstWeek ? "Plan Your First Week" : `Plan Week ${profile?.currentWeek || ""}`}
          </h1>
          <span className="text-sm text-muted-foreground">
            Step {clampedStepIndex + 1}/{steps.length}
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
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        {!isLastStep && (
          <Button
            size="sm"
            onClick={goNext}
            data-testid="button-next"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {renderMonthlyReportMessage()}
    </div>
  );
}
