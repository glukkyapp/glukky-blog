import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Check, X, Minus, Camera, Footprints, UtensilsCrossed, ShoppingBag, Clock } from "lucide-react";

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

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [recorded, setRecorded] = useState(false);
  const [showTacticPicker, setShowTacticPicker] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;

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

  const show2pmWindow = currentHour >= 14 && isLateDinnerDay;
  const show10pmWindow = currentHour >= 22;

  const logMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/log", { date: todayStr, ...data });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", weekNumber] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/current"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", weekNumber] });
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

  useEffect(() => {
    if (!calendarData || recorded) return;

    const tp = calendarData?.calendar?.find((d: any) => d.date === todayStr);
    if (!tp) return;

    const labelSet = tp.dinnerLabel && tp.dinnerLabel !== "none";

    if (show2pmWindow && !show10pmWindow) {
      if (isLateDinnerDay && labelSet) {
        setRecorded(true);
        toast({ title: "Recorded!", description: "Let's look forward to tomorrow's plan" });
      }
    }

    if (show10pmWindow) {
      let allDone = true;

      if (isLateDinnerDay) {
        if (!labelSet) allDone = false;
        if (labelSet && tp.dinnerSuccess === null) allDone = false;
      }

      if (tp.walkScheduled && tp.walkCompleted === null) allDone = false;

      if (plan?.dietTip) {
        if (tp.dietResponse === null) allDone = false;
      }

      if (allDone) {
        const hasAnyAnswer = tp.walkCompleted !== null || tp.dietResponse !== null || tp.dinnerSuccess !== null || labelSet;
        if (hasAnyAnswer) {
          setRecorded(true);
          toast({ title: "Recorded!", description: "Let's look forward to tomorrow's plan" });
        }
      }
    }
  }, [calendarData, show2pmWindow, show10pmWindow]);

  const walkCompleted = calendarData?.calendar?.filter((d: any) => d.walkCompleted === true).length || 0;
  const walkScheduled = calendarData?.calendar?.filter((d: any) => d.walkScheduled).length || 0;
  const weightedPct = walkScheduled > 0 ? Math.round((walkCompleted / walkScheduled) * 100) : 0;

  const formatDate = (date?: Date) => {
    const d = date || today;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-plan-date">
            <span className="font-semibold text-foreground">{label}</span> — {dateLabel}
          </div>

          {dayData.walkScheduled && (
            <div className="flex items-center gap-2" data-testid="text-plan-walk">
              <Footprints className="w-4 h-4 text-primary" />
              <p className="text-sm">{dayData.walkDuration || plan?.walkDurationGoal} min walk after dinner</p>
            </div>
          )}

          {dayData.lateDinnerScheduled && (
            <div className="flex items-center gap-2" data-testid="text-plan-late-dinner">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm">Late dinner today</p>
            </div>
          )}

          {dayData.eatOutScheduled && (
            <div className="flex items-center gap-2" data-testid="text-plan-eat-out">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <p className="text-sm">Eating out</p>
            </div>
          )}

          {plan?.dietTip && (
            <div className="space-y-1" data-testid="text-plan-diet">
              <p className="text-sm text-muted-foreground">Diet tip:</p>
              <p className="text-sm text-primary font-medium">"{plan.dietTip}"</p>
            </div>
          )}

          {!dayData.walkScheduled && !dayData.lateDinnerScheduled && !dayData.eatOutScheduled && !plan?.dietTip && (
            <p className="text-sm text-muted-foreground">Rest day — no tasks scheduled</p>
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
          <p className="text-sm font-medium">Pick a dinner tactic for tonight:</p>
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

    return (
      <div className="space-y-2" data-testid="section-dinner-question">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium">Can you move dinner time earlier than 9pm today?</p>
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
      <div className="space-y-2 border-t pt-3">
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
          <p className="text-xs text-muted-foreground">Tired?</p>
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
      </div>
    );
  }

  function renderDietCheckIn() {
    if (!plan?.dietTip) return null;

    return (
      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">Diet tactic:</p>
        <p className="text-sm text-primary font-medium" data-testid="text-diet-tip">"{plan.dietTip}"</p>
        <p className="text-xs text-muted-foreground">Completed?</p>
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
            No chance to try
          </Button>
        </div>
      </div>
    );
  }

  function renderCheckInCard() {
    const is2pmOnly = show2pmWindow && !show10pmWindow;
    const is10pm = show10pmWindow;

    return (
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
            <span className="font-semibold text-foreground">TODAY</span> — {formatDate()}
          </div>

          {is2pmOnly && renderDinnerCheckIn()}

          {is10pm && (
            <>
              {isLateDinnerDay && !dinnerLabelSet && renderDinnerCheckIn()}
              {isLateDinnerDay && dinnerLabelSet && renderDinnerFollowUp()}
              {renderWalkCheckIn()}
              {renderDietCheckIn()}
            </>
          )}

          <div className="border-t pt-3 space-y-1">
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
        <h1 className="text-lg font-bold">
          Week {weekNumber}: {weightedPct}% ({walkCompleted}/{walkScheduled})
        </h1>
      </div>

      {recorded ? (
        renderReadOnlyPlan(tomorrowPlan, "TOMORROW", formatTomorrowDate())
      ) : showCheckIn ? (
        renderCheckInCard()
      ) : (
        renderReadOnlyPlan(todayPlan, "TODAY", formatDate())
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

            {calendarData?.calendar?.some((d: any) => d.lateDinnerScheduled || (d.dinnerLabel && d.dinnerLabel !== "none")) && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Dinner</div>
                {calendarData?.calendar?.map((d: any, i: number) => (
                  <div key={i} className={`h-7 rounded flex items-center justify-center text-[8px] font-medium ${
                    !d.lateDinnerScheduled && d.dinnerLabel === "none" ? "bg-muted" :
                    d.dinnerSuccess === true ? "bg-green-100 text-green-700" :
                    d.dinnerSuccess === false ? "bg-red-50 text-red-500" :
                    d.dinnerLabel !== "none" ? "bg-amber-50 text-amber-700" :
                    "bg-amber-50/50 text-amber-400"
                  }`}>
                    {d.dinnerLabel !== "none" ? DINNER_LABEL_SHORT[d.dinnerLabel] || "" :
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
