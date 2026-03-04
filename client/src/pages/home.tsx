import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Check, X, Minus, Camera, Footprints, UtensilsCrossed, ShoppingBag, Clock, TrendingUp, Droplets } from "lucide-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DINNER_LABEL_SHORT: Record<string, string> = {
  move_early: "Early",
  fiber_starter: "Fiber",
  dusk_prep: "Dusk",
  split_dinner: "Split",
  none: "",
};

const MITIGATION_OPTIONS = [
  { value: "fiber_starter", label: "Fiber Starter", desc: "Eat veggies first" },
  { value: "dusk_prep", label: "Dusk Prep", desc: "Light snack at 5 PM" },
  { value: "split_dinner", label: "Split Dinner", desc: "Split into two smaller meals" },
] as const;

export default function Home() {
  const { toast } = useToast();
  const { data: plan, isLoading: planLoading } = useQuery({ queryKey: ["/api/plan/current"] });
  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });

  const { data: devTime } = useQuery({ queryKey: ["/api/dev/time"] });
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [recorded, setRecorded] = useState(false);
  const [showTacticPicker, setShowTacticPicker] = useState(false);
  const [hydrationAdvice, setHydrationAdvice] = useState<string | null>(null);
  const userInteracted = useRef(false);

  const effectiveHour = devTime?.timeOverride !== null && devTime?.timeOverride !== undefined
    ? devTime.timeOverride
    : currentHour;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  const realDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const dayOfWeek = devTime?.dayOverride !== null && devTime?.dayOverride !== undefined
    ? devTime.dayOverride
    : realDayOfWeek;

  const todayStr = (() => {
    if (devTime?.dayOverride !== null && devTime?.dayOverride !== undefined && plan?.startDate) {
      const start = new Date(plan.startDate + "T00:00:00");
      start.setDate(start.getDate() + devTime.dayOverride);
      return start.toISOString().split("T")[0];
    }
    return today.toISOString().split("T")[0];
  })();

  const weekNumber = plan?.weekNumber || profile?.currentWeek || 1;

  const { data: calendarData } = useQuery({
    queryKey: ["/api/calendar", weekNumber],
    enabled: !!weekNumber,
  });

  const todayPlan = calendarData?.calendar?.find((d: any) => d.dayOfWeek === dayOfWeek);
  const todayLog = calendarData?.calendar?.find((d: any) => d.date === todayStr);
  const tomorrowDow = (dayOfWeek + 1) % 7;
  const tomorrowPlan = calendarData?.calendar?.find((d: any) => d.dayOfWeek === tomorrowDow);

  const isLateDinnerDay = todayPlan?.lateDinnerScheduled === true;
  const dinnerLabelSet = todayPlan?.dinnerLabel && todayPlan.dinnerLabel !== "none";

  const show2pmWindow = effectiveHour >= 14 && isLateDinnerDay;
  const show10pmWindow = effectiveHour >= 22;

  async function checkAllDoneAfterInteraction() {
    userInteracted.current = true;
    await queryClient.refetchQueries({ queryKey: ["/api/calendar", weekNumber] });
    const freshData = queryClient.getQueryData<any>(["/api/calendar", weekNumber]);
    if (!freshData) return;
    const tp = freshData.calendar?.find((d: any) => d.date === todayStr);
    if (!tp) return;

    const labelSet = tp.dinnerLabel && tp.dinnerLabel !== "none";
    const is2pmOnly = effectiveHour >= 14 && effectiveHour < 22 && tp.lateDinnerScheduled;

    if (is2pmOnly) {
      if (tp.lateDinnerScheduled && labelSet) {
        setRecorded(true);
        toast({ title: "Nice work!", description: "Here's what's coming up tomorrow" });
      }
      return;
    }

    if (effectiveHour >= 22) {
      let allDone = true;
      if (tp.lateDinnerScheduled) {
        if (!labelSet) allDone = false;
        if (labelSet && tp.dinnerSuccess === null) allDone = false;
      }
      if (tp.walkScheduled && tp.walkCompleted === null) allDone = false;
      if (plan?.dietTip && tp.dietResponse === null) allDone = false;

      if (allDone) {
        setRecorded(true);
        toast({ title: "Nice work!", description: "Here's what's coming up tomorrow" });
      }
    }
  }

  const logMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/log", { date: todayStr, ...data });
      return res.json();
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan/current"] });

      if (data?.nextDayAdjustment) {
        const adj = data.nextDayAdjustment;
        if (adj.walkCompleted) {
          setHydrationAdvice("Stay hydrated tomorrow! Drink extra water before your walk.");
        } else if (adj.reduced && adj.newDuration) {
          setHydrationAdvice(`We've reduced tomorrow's walk to ${adj.newDuration} min. Stay hydrated and rest well!`);
        } else if (!adj.tomorrowWalkScheduled) {
          setHydrationAdvice("Stay hydrated tomorrow! Rest well tonight.");
        } else {
          setHydrationAdvice("Stay hydrated tomorrow! Drink extra water before your walk.");
        }
      }

      await checkAllDoneAfterInteraction();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const dinnerLabelMutation = useMutation({
    mutationFn: async (data: { planDayId: number; label: string }) => {
      const res = await apiRequest("POST", "/api/plan/dinner-label", data);
      return res.json();
    },
    onSuccess: async () => {
      await checkAllDoneAfterInteraction();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function handleDinnerMoveEarly(canMove: boolean) {
    if (!todayPlan?.planDayId) return;
    if (canMove) {
      dinnerLabelMutation.mutate({ planDayId: todayPlan.planDayId, label: "move_early" });
    } else {
      setShowTacticPicker(true);
    }
  }

  function handleTacticPick(tactic: string) {
    if (!todayPlan?.planDayId) return;
    dinnerLabelMutation.mutate({ planDayId: todayPlan.planDayId, label: tactic });
    setShowTacticPicker(false);
  }


  const formatDate = (date?: Date) => {
    const d = date || today;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatWeekday = () => {
    return today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };

  const formatTomorrowDate = () => {
    const tmrw = new Date(today);
    tmrw.setDate(tmrw.getDate() + 1);
    return formatDate(tmrw);
  };

  if (planLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  function renderReadOnlyPlan(dayData: any, label: string, dateLabel: string) {
    if (!dayData) return null;

    const tasks: { icon: any; text: string; testId: string; color: string }[] = [];
    if (dayData.walkScheduled) {
      tasks.push({ icon: Footprints, text: `${dayData.walkDuration || plan?.walkDurationGoal} min walk after dinner`, testId: "text-plan-walk", color: "text-primary" });
    }
    if (dayData.lateDinnerScheduled) {
      tasks.push({ icon: UtensilsCrossed, text: "Late dinner — pick a tactic at 2pm", testId: "text-plan-late-dinner", color: "text-amber-500" });
    }
    if (dayData.eatOutScheduled) {
      tasks.push({ icon: ShoppingBag, text: "Eating out", testId: "text-plan-eat-out", color: "text-orange-500" });
    }
    if (plan?.dietTip) {
      tasks.push({ icon: TrendingUp, text: `"${plan.dietTip}"`, testId: "text-plan-diet", color: "text-primary" });
    }

    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-plan-date">
            <span className="font-semibold text-foreground">{label}</span> — {dateLabel}
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">It's your rest day — enjoy it!</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task, idx) => {
                const Icon = task.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                    data-testid={task.testId}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {idx + 1}
                    </div>
                    <Icon className={`w-4 h-4 ${task.color} shrink-0`} />
                    <p className="text-sm">{task.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDinnerCheckIn() {
    if (!isLateDinnerDay || !todayPlan) return null;

    if (dinnerLabelSet) {
      const label = todayPlan.dinnerLabel !== "none" ? todayPlan.dinnerLabel : "";
      return (
        <div className="space-y-2 bg-green-50 dark:bg-green-950/30 rounded-lg p-3" data-testid="section-dinner-confirmed">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {label === "move_early"
                ? "Plan: Move dinner before 9pm"
                : `Plan: ${DINNER_LABEL_SHORT[label] || label} tactic`
              }
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Follow-up at 10pm</p>
        </div>
      );
    }

    if (showTacticPicker) {
      return (
        <div className="space-y-3" data-testid="section-dinner-tactic">
          <p className="text-sm font-medium">Let's pick a game plan for dinner tonight:</p>
          {MITIGATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleTacticPick(opt.value)}
              className="w-full text-left p-3 rounded-lg text-sm transition-colors bg-muted hover:bg-primary/10"
              data-testid={`button-tactic-${opt.value}`}
              disabled={dinnerLabelMutation.isPending}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-muted-foreground"> — {opt.desc}</span>
            </button>
          ))}
        </div>
      );
    }

    const shouldPivot = plan?.lastWeekDinnerEarlyPct === 0 && plan?.currentWeek > 1;

    if (shouldPivot) {
      return (
        <div className="space-y-3" data-testid="section-dinner-pivot">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">Late dinner tactic</p>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-dinner-pivot-message">
            Moving dinner earlier is tough — no worries, let's try a different approach:
          </p>
          <p className="text-sm font-medium">Let's pick a game plan for dinner tonight:</p>
          {MITIGATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleTacticPick(opt.value)}
              className="w-full text-left p-3 rounded-lg text-sm transition-colors bg-muted hover:bg-primary/10"
              data-testid={`button-tactic-${opt.value}`}
              disabled={dinnerLabelMutation.isPending}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-muted-foreground"> — {opt.desc}</span>
            </button>
          ))}
          <button
            onClick={() => handleDinnerMoveEarly(true)}
            className="w-full text-left p-3 rounded-lg text-sm transition-colors bg-muted hover:bg-primary/10"
            data-testid="button-try-move-early-anyway"
            disabled={dinnerLabelMutation.isPending}
          >
            <span className="font-medium">No, I will try to move dinner earlier today</span>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2" data-testid="section-dinner-question">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium">Think you could try eating a bit earlier tonight — before 9pm?</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleDinnerMoveEarly(true)}
            disabled={dinnerLabelMutation.isPending}
            data-testid="button-dinner-move-yes"
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDinnerMoveEarly(false)}
            disabled={dinnerLabelMutation.isPending}
            data-testid="button-dinner-move-no"
          >
            No
          </Button>
        </div>
      </div>
    );
  }

  function renderDinnerFollowUp() {
    if (!isLateDinnerDay || !dinnerLabelSet) return null;
    if (todayLog?.dinnerSuccess !== null && todayLog?.dinnerSuccess !== undefined) {
      return (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 rounded-lg p-3" data-testid="section-dinner-followup-done">
          <Check className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Dinner check-in recorded: {todayLog.dinnerSuccess ? "Yes" : "No"}
          </p>
        </div>
      );
    }

    const label = todayPlan?.dinnerLabel;
    const question = label === "move_early"
      ? "Did you manage to eat before 9pm?"
      : `Did you follow the ${DINNER_LABEL_SHORT[label] || label} tip?`;

    return (
      <div className="space-y-2" data-testid="section-dinner-followup">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium">{question}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={todayLog?.dinnerSuccess === true ? "default" : "outline"}
            onClick={() => logMutation.mutate({ dinnerSuccess: true })}
            disabled={logMutation.isPending}
            data-testid="button-dinner-yes"
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={todayLog?.dinnerSuccess === false ? "destructive" : "outline"}
            onClick={() => logMutation.mutate({ dinnerSuccess: false })}
            disabled={logMutation.isPending}
            data-testid="button-dinner-no"
          >
            No
          </Button>
        </div>
      </div>
    );
  }

  function renderWalkCheckIn() {
    if (!todayPlan?.walkScheduled) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">{todayPlan?.walkDuration || plan?.walkDurationGoal} min walk after dinner</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={todayLog?.walkCompleted === true ? "default" : "outline"}
            onClick={() => logMutation.mutate({ walkCompleted: true })}
            disabled={logMutation.isPending}
            data-testid="button-walk-yes"
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={todayLog?.walkCompleted === false ? "destructive" : "outline"}
            onClick={() => logMutation.mutate({ walkCompleted: false })}
            disabled={logMutation.isPending}
            data-testid="button-walk-no"
          >
            No
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground">Feeling tired after?</p>
          <Button
            size="sm"
            variant={todayLog?.walkTired === true ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={() => logMutation.mutate({ walkTired: true })}
            disabled={logMutation.isPending}
            data-testid="button-tired-yes"
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={todayLog?.walkTired === false ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={() => logMutation.mutate({ walkTired: false })}
            disabled={logMutation.isPending}
            data-testid="button-tired-no"
          >
            No
          </Button>
        </div>

        {hydrationAdvice && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg mt-2" data-testid="section-hydration-advice">
            <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{hydrationAdvice}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs mt-1 text-blue-600"
                onClick={() => setHydrationAdvice(null)}
                data-testid="button-dismiss-hydration"
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDietCheckIn() {
    if (!plan?.dietTip) return null;

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Diet tactic:</p>
        <p className="text-sm text-primary font-medium" data-testid="text-diet-tip">"{plan.dietTip}"</p>
        <p className="text-xs text-muted-foreground">Did you get a chance to try this today?</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={todayLog?.dietResponse === "yes" ? "default" : "outline"}
            onClick={() => logMutation.mutate({ dietResponse: "yes" })}
            disabled={logMutation.isPending}
            data-testid="button-diet-yes"
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={todayLog?.dietResponse === "no" ? "destructive" : "outline"}
            onClick={() => logMutation.mutate({ dietResponse: "no" })}
            disabled={logMutation.isPending}
            data-testid="button-diet-no"
          >
            No
          </Button>
          <Button
            size="sm"
            variant={todayLog?.dietResponse === "no_chance" ? "secondary" : "outline"}
            onClick={() => logMutation.mutate({ dietResponse: "no_chance" })}
            disabled={logMutation.isPending}
            data-testid="button-diet-no-chance"
          >
            Didn't get the chance
          </Button>
        </div>
      </div>
    );
  }

  function renderCheckInCard() {
    const is2pmOnly = show2pmWindow && !show10pmWindow;
    const is10pm = show10pmWindow;

    const rawSections: any[] = [];

    if (is2pmOnly && isLateDinnerDay) {
      rawSections.push(renderDinnerCheckIn());
    }

    if (is10pm) {
      if (isLateDinnerDay && !dinnerLabelSet) {
        rawSections.push(renderDinnerCheckIn());
      }
      if (isLateDinnerDay && dinnerLabelSet) {
        rawSections.push(renderDinnerFollowUp());
      }
      if (todayPlan?.walkScheduled) {
        rawSections.push(renderWalkCheckIn());
      }
      if (plan?.dietTip) {
        rawSections.push(renderDietCheckIn());
      }
    }

    const sections = rawSections
      .filter(Boolean)
      .map((content, idx) => ({ num: idx + 1, content }));

    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
            <span className="font-semibold text-foreground">TODAY</span> — {formatDate()}
          </div>

          {sections.map(({ num, content }) => (
            <div key={num} className="rounded-lg bg-muted/50 p-3 space-y-2" data-testid={`section-checkin-task-${num}`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {num}
                </div>
              </div>
              {content}
            </div>
          ))}

          <div className="rounded-lg bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Diet Snap</p>
            </div>
            <p className="text-xs text-muted-foreground italic" data-testid="text-diet-snap">Coming soon...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const showCheckIn = show2pmWindow || show10pmWindow;

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center gap-2" data-testid="text-week-header">
        <Target className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">{formatWeekday()}</h1>
      </div>

      {recorded ? (
        renderReadOnlyPlan(tomorrowPlan, "TOMORROW", formatTomorrowDate())
      ) : showCheckIn ? (
        renderCheckInCard()
      ) : (
        renderReadOnlyPlan(todayPlan, "TODAY", formatDate())
      )}

      {plan?.isDinnerFocus && !plan?.dietStruggle && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2" data-testid="section-home-dinner-focus">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold">Focus: Late Dinner Management</p>
            </div>
            {(() => {
              const dinnerDaysData = calendarData?.calendar?.filter((d: any) => d.lateDinnerScheduled || (d.dinnerLabel && d.dinnerLabel !== "none")) || [];
              const dinnerSuccess = dinnerDaysData.filter((d: any) => d.dinnerSuccess === true).length;
              const dinnerAnswered = dinnerDaysData.filter((d: any) => d.dinnerSuccess !== null).length;
              return dinnerAnswered > 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-dinner-focus-stats">
                  This week: {dinnerSuccess}/{dinnerAnswered} dinner tactics followed
                </p>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-dinner-focus-hint">
                  Choose a tactic each late dinner day during your daily check-in
                </p>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {plan?.dietStruggle && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2" data-testid="section-home-diet-focus">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Focus: {plan.dietStruggle.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
            </div>
            {plan.dietTip && <p className="text-sm text-primary font-medium" data-testid="text-diet-focus-tip">"{plan.dietTip}"</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3" data-testid="text-calendar-title">Weekly Calendar</p>
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-1 text-center text-xs">
              <div />
              {DAY_NAMES.map(n => (
                <div key={n} className="font-medium text-muted-foreground">{n}</div>
              ))}
            </div>

            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Walk</div>
              {calendarData?.calendar?.map((d: any, i: number) => (
                <div key={i} className={`h-7 rounded flex items-center justify-center ${
                  d.walkCompleted === true ? "bg-green-100 text-green-600" :
                  d.walkCompleted === false ? "bg-red-50 text-red-400" :
                  d.walkScheduled ? "bg-primary/10 text-primary/50" : "bg-muted"
                }`}>
                  {d.walkCompleted === true ? <Check className="w-3 h-3" /> :
                   d.walkCompleted === false ? <X className="w-3 h-3" /> :
                   d.walkScheduled ? <Minus className="w-3 h-3" /> : null}
                </div>
              ))}
            </div>

            {calendarData?.calendar?.some((d: any) => d.lateDinnerScheduled) && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Dinner</div>
                {calendarData?.calendar?.map((d: any, i: number) => (
                  <div key={i} className={`h-7 rounded flex items-center justify-center text-[8px] font-medium ${
                    !d.lateDinnerScheduled ? "bg-muted" :
                    d.dinnerSuccess === true ? "bg-green-100 text-green-700" :
                    d.dinnerSuccess === false ? "bg-red-50 text-red-500" :
                    d.lateDinnerScheduled && d.dinnerLabel !== "none" ? "bg-amber-50 text-amber-700" :
                    d.lateDinnerScheduled ? "bg-amber-50/50 text-amber-400" :
                    "bg-muted"
                  }`}>
                    {d.lateDinnerScheduled && d.dinnerLabel !== "none" ? DINNER_LABEL_SHORT[d.dinnerLabel] || "" :
                     d.lateDinnerScheduled ? <Minus className="w-3 h-3" /> : null}
                  </div>
                ))}
              </div>
            )}

            {plan?.dietTip && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Diet</div>
                {calendarData?.calendar?.map((d: any, i: number) => (
                  <div key={i} className={`h-7 rounded flex items-center justify-center ${
                    d.dietResponse === "yes" ? "bg-green-100 text-green-600" :
                    d.dietResponse === "no" ? "bg-red-50 text-red-400" :
                    d.dietResponse === "no_chance" ? "bg-gray-100 text-gray-400" :
                    "bg-muted"
                  }`}>
                    {d.dietResponse === "yes" ? <Check className="w-3 h-3" /> :
                     d.dietResponse === "no" ? <X className="w-3 h-3" /> :
                     d.dietResponse === "no_chance" ? <Minus className="w-3 h-3" /> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
