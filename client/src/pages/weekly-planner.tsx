import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Check, ChevronLeft, ChevronRight, Footprints, UtensilsCrossed,
  Calendar, ShoppingBag, TrendingUp, Award, RotateCcw,
} from "lucide-react";
import { DIET_TIP_LADDERS, STRUGGLE_PRIORITY } from "@shared/schema";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MITIGATION_OPTIONS = [
  { value: "fiber_starter", label: "Fiber Starter", desc: "Eat veggies first" },
  { value: "dusk_prep", label: "Dusk Prep", desc: "Light snack at 5 PM" },
  { value: "split_dinner", label: "Split Dinner", desc: "Split into two smaller meals" },
] as const;

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
  const { data: reflection } = useQuery({ queryKey: ["/api/plan/reflection"] });

  const isFirstWeek = !reflection;

  const steps: string[] = [];
  if (!isFirstWeek) steps.push("weeklyReport");
  steps.push("walkDays", "eatOutDays", "lateDinnerDays");
  steps.push("dinnerPlan");
  if (profile?.currentStruggle) steps.push("dietReview");
  steps.push("preview");

  const [stepIndex, setStepIndex] = useState(0);
  const currentStepId = steps[stepIndex] || steps[0];

  const [negotiationChoice, setNegotiationChoice] = useState<string>("keep_current");
  const [negotiationStep, setNegotiationStep] = useState<"ask_day" | "ask_minutes" | "done">("ask_day");
  const [walkDays, setWalkDays] = useState<number[]>([]);
  const [eatOutDays, setEatOutDays] = useState<number[]>([]);
  const [lateDinnerDays, setLateDinnerDays] = useState<number[]>([]);
  const [dinnerPlan, setDinnerPlan] = useState<{ dayOfWeek: number; label: string; canMoveEarly: boolean }[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (!profile) return;

    if (reflection?.lastWeekSchedule && reflection.lastWeekSchedule.length > 0) {
      const schedule = reflection.lastWeekSchedule;
      setWalkDays(schedule.filter((d: any) => d.walkScheduled).map((d: any) => d.dayOfWeek));
      setEatOutDays(schedule.filter((d: any) => d.eatOutScheduled).map((d: any) => d.dayOfWeek));
      const lateD = schedule.filter((d: any) => d.dinnerLabel !== "none").map((d: any) => d.dayOfWeek);
      setLateDinnerDays(lateD);
      setDinnerPlan(lateD.map((dow: number) => {
        const s = schedule.find((d: any) => d.dayOfWeek === dow);
        const label = s?.dinnerLabel || "move_early";
        return { dayOfWeek: dow, label, canMoveEarly: label === "move_early" };
      }));
      setInitialized(true);
    } else if (!reflection) {
      const pw = profile?.walksPerWeek || 3;
      setWalkDays(Array.from({ length: pw }, (_, i) => i));
      setInitialized(true);
    }
  }, [profile, reflection, initialized]);

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const dinnerPlanData = dinnerPlan.map(d => ({
        dayOfWeek: d.dayOfWeek,
        label: d.canMoveEarly ? "move_early" : d.label,
      }));

      const res = await apiRequest("POST", "/api/plan/weekly", {
        negotiationChoice,
        walkDays,
        eatOutDays,
        dinnerPlan: dinnerPlanData,
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

  function toggleLateDinnerDay(day: number) {
    const next = lateDinnerDays.includes(day)
      ? lateDinnerDays.filter(d => d !== day)
      : [...lateDinnerDays, day];
    setLateDinnerDays(next);
    setDinnerPlan(next.map(d => {
      const existing = dinnerPlan.find(dp => dp.dayOfWeek === d);
      return existing || { dayOfWeek: d, label: "move_early", canMoveEarly: true };
    }));
  }

  function setDinnerDayCanMoveEarly(dayOfWeek: number, canMove: boolean) {
    setDinnerPlan(prev =>
      prev.map(d =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, canMoveEarly: canMove, label: canMove ? "move_early" : "fiber_starter" }
          : d
      )
    );
  }

  function setDinnerDayTip(dayOfWeek: number, tip: string) {
    setDinnerPlan(prev =>
      prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, label: tip } : d)
    );
  }

  function goNext() {
    let nextIdx = stepIndex + 1;
    if (steps[nextIdx] === "dinnerPlan" && lateDinnerDays.length === 0) {
      nextIdx++;
    }
    if (nextIdx < steps.length) {
      setStepIndex(nextIdx);
    }
  }

  function goBack() {
    let prevIdx = stepIndex - 1;
    if (steps[prevIdx] === "dinnerPlan" && lateDinnerDays.length === 0) {
      prevIdx--;
    }
    if (prevIdx >= 0) {
      setStepIndex(prevIdx);
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
    const showNegotiation = !isFirstWeek && reflection;
    const showNegotiationQuestion = showNegotiation && reflection.suggestedActions && reflection.suggestedActions.length > 0;
    const walkFreq = reflection?.walkDaysScheduled || 0;
    const walkDur = reflection?.walkDuration || 10;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-walk-days-title">
            <Calendar className="w-5 h-5 text-primary" />
            Select Walk Days
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
                  <p className="text-sm font-medium">Great progress! You've maxed out walk days and duration.</p>
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

          <p className="text-sm text-muted-foreground">Tap days you'll walk this week</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i, walkDays, setWalkDays)}
                className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                  walkDays.includes(i)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`button-walk-day-${i}`}
              >
                {name}
              </button>
            ))}
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
          <p className="text-sm text-muted-foreground">Which days will you eat out this week?</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i, eatOutDays, setEatOutDays)}
                className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                  eatOutDays.includes(i)
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`button-eat-out-day-${i}`}
              >
                {name}
              </button>
            ))}
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
          <p className="text-sm text-muted-foreground">Which days will you have dinner after 9pm?</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => toggleLateDinnerDay(i)}
                className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                  lateDinnerDays.includes(i)
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`button-late-dinner-day-${i}`}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">{lateDinnerDays.length} days selected</p>
        </CardContent>
      </Card>
    );
  }

  function renderDinnerPlan() {
    return (
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-dinner-plan-title">Plan Each Late Dinner Day</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dinnerPlan.map(dp => (
            <div key={dp.dayOfWeek} className="border rounded-lg p-3 space-y-2">
              <p className="font-medium">{DAY_NAMES[dp.dayOfWeek]}</p>
              <p className="text-sm text-muted-foreground">Can you move dinner earlier?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={dp.canMoveEarly ? "default" : "outline"}
                  onClick={() => setDinnerDayCanMoveEarly(dp.dayOfWeek, true)}
                  data-testid={`button-move-early-yes-${dp.dayOfWeek}`}
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant={!dp.canMoveEarly ? "default" : "outline"}
                  onClick={() => setDinnerDayCanMoveEarly(dp.dayOfWeek, false)}
                  data-testid={`button-move-early-no-${dp.dayOfWeek}`}
                >
                  No
                </Button>
              </div>
              {!dp.canMoveEarly && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs text-muted-foreground">Which tip feels easiest?</p>
                  {MITIGATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDinnerDayTip(dp.dayOfWeek, opt.value)}
                      className={`w-full text-left p-2 rounded text-sm transition-colors ${
                        dp.label === opt.value ? "bg-primary/10 border border-primary" : "bg-muted"
                      }`}
                      data-testid={`button-tip-${opt.value}-${dp.dayOfWeek}`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground"> — {opt.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {dinnerPlan.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No late dinner days selected</p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDietReview() {
    if (!profile?.currentStruggle) return null;

    const tipLadder = (DIET_TIP_LADDERS as Record<string, string[]>)[profile.currentStruggle] || [];
    const currentTip = tipLadder[profile.currentTipIndex] || "";
    const isCleanWeek = reflection?.dietCleanWeek;
    const hasReflection = !!reflection;

    let nextTipLabel = "";
    let statusType: "advance" | "repeat" | "mastered" = "repeat";

    if (hasReflection) {
      const totalResponses = reflection.dietYesCount + reflection.dietNoCount + reflection.dietNoChanceCount;
      if (totalResponses > 0 && isCleanWeek) {
        if (profile.currentTipIndex + 1 < tipLadder.length) {
          statusType = "advance";
          nextTipLabel = tipLadder[profile.currentTipIndex + 1];
        } else {
          const currentStruggleIdx = STRUGGLE_PRIORITY.indexOf(profile.currentStruggle as any);
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
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Current struggle</p>
            <p className="font-semibold text-lg" data-testid="text-current-struggle">
              {STRUGGLE_NAMES[profile.currentStruggle] || profile.currentStruggle}
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
                      Mastered {STRUGGLE_NAMES[profile.currentStruggle] || profile.currentStruggle}!
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
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {DAY_NAMES.map((name, i) => (
              <div key={i} className="font-medium text-muted-foreground">{name}</div>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Footprints className="w-3 h-3" /> Walk
            </p>
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map((_, i) => (
                <div key={i} className={`h-8 rounded flex items-center justify-center text-xs ${
                  walkDays.includes(i) ? "bg-primary/20 text-primary" : "bg-muted"
                }`}>
                  {walkDays.includes(i) && <Check className="w-3 h-3" />}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" /> Eat Out
            </p>
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map((_, i) => (
                <div key={i} className={`h-8 rounded flex items-center justify-center text-xs ${
                  eatOutDays.includes(i) ? "bg-orange-100 text-orange-600" : "bg-muted"
                }`}>
                  {eatOutDays.includes(i) && <Check className="w-3 h-3" />}
                </div>
              ))}
            </div>
          </div>

          {lateDinnerDays.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" /> Late Dinner
              </p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((_, i) => {
                  const dp = dinnerPlan.find(d => d.dayOfWeek === i);
                  const label = dp ? (dp.canMoveEarly ? "Early" : dp.label.replace("_", " ").slice(0, 5)) : "";
                  return (
                    <div key={i} className={`h-8 rounded flex items-center justify-center text-[9px] font-medium ${
                      dp ? (dp.canMoveEarly ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700") : "bg-muted"
                    }`}>
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
      case "dinnerPlan": return renderDinnerPlan();
      case "dietReview": return renderDietReview();
      case "preview": return renderPreview();
      default: return null;
    }
  }

  const isLastStep = currentStepId === "preview";

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-8 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold" data-testid="text-planner-title">
            {isFirstWeek ? "Plan Your First Week" : `Plan Week ${profile?.currentWeek || ""}`}
          </h1>
          <span className="text-sm text-muted-foreground">
            Step {stepIndex + 1}/{steps.length}
          </span>
        </div>
        <Progress value={((stepIndex + 1) / steps.length) * 100} className="h-2" />
      </div>

      {renderStep()}

      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goBack}
          disabled={stepIndex === 0}
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
    </div>
  );
}
