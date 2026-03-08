import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Check, X, Minus, Camera, Footprints, UtensilsCrossed, ShoppingBag, Clock, TrendingUp, Droplets, CalendarDays, Battery, CheckCircle2, Soup, Wine, Activity, Lightbulb } from "lucide-react";

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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: plan, isLoading: planLoading } = useQuery({ queryKey: ["/api/plan/current"] });
  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });

  const { data: devTime } = useQuery({ queryKey: ["/api/dev/time"] });
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [recorded, setRecorded] = useState(false);
  const [showTacticPicker, setShowTacticPicker] = useState(false);
  const [hydrationAdvice, setHydrationAdvice] = useState<string | null>(null);
  const [showTickAnimation, setShowTickAnimation] = useState(false);
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

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = (() => {
    if (devTime?.dateOverride) {
      return devTime.dateOverride;
    }
    return formatLocalDate(today);
  })();

  const dayOfWeek = (() => {
    if (devTime?.dateOverride) {
      const d = new Date(devTime.dateOverride + "T00:00:00");
      const jsDay = d.getDay();
      return jsDay === 0 ? 6 : jsDay - 1;
    }
    return realDayOfWeek;
  })();

  const planSundayStr = (() => {
    if (!plan?.startDate) return null;
    const s = typeof plan.startDate === 'string' ? plan.startDate : plan.startDate;
    const d = new Date(s + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return formatLocalDate(d);
  })();

  const lastSundayStr = (() => {
    const d = new Date(todayStr + "T00:00:00");
    const daysBack = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    d.setDate(d.getDate() - daysBack);
    return formatLocalDate(d);
  })();

  const isPastPlanWeek = !!planSundayStr && todayStr > planSundayStr;
  const isCatchUp = isPastPlanWeek && dayOfWeek !== 6;

  const { data: sundayLogData } = useQuery({
    queryKey: ["/api/log", isCatchUp ? planSundayStr : lastSundayStr],
    enabled: isCatchUp,
  });

  const weekNumber = (() => {
    const baseWeek = plan?.weekNumber || profile?.currentWeek || 1;
    if (plan?.startDate && todayStr < plan.startDate && baseWeek > 1) {
      return baseWeek - 1;
    }
    return baseWeek;
  })();
  const { data: calendarData } = useQuery({
    queryKey: ["/api/calendar", weekNumber],
    enabled: !!weekNumber,
  });
  const calendarPlan = calendarData?.plan;
  const planFirstActiveDay = calendarPlan?.firstActiveDay ?? 0;

  const sundayCheckInDone = (() => {
    if (!isCatchUp) return false;
    if (!sundayLogData) return false;
    const sunDate = isCatchUp ? planSundayStr : lastSundayStr;
    const sunPlanDay = calendarData?.calendar?.find((d: any) => d.dayOfWeek === 6);
    const sunLog = calendarData?.calendar?.find((d: any) => d.date === sunDate);
    if (!sunLog) return false;
    if (sunPlanDay?.walkScheduled) {
      if (sunLog.walkCompleted === null || sunLog.walkCompleted === undefined) return false;
    }
    if (sunPlanDay?.lateDinnerScheduled && sunPlanDay?.dinnerLabel && sunPlanDay.dinnerLabel !== "none") {
      if (sunLog.dinnerSuccess === null || sunLog.dinnerSuccess === undefined) return false;
    }
    if (calendarPlan?.dietTip) {
      if (sunLog.dietResponse === null || sunLog.dietResponse === undefined) return false;
    }
    return true;
  })();

  const checkInDate = isCatchUp && !sundayCheckInDone ? (planSundayStr || todayStr) : todayStr;
  const checkInDayOfWeek = isCatchUp && !sundayCheckInDone ? 6 : dayOfWeek;

  const todayPlan = calendarData?.calendar?.find((d: any) => d.dayOfWeek === checkInDayOfWeek);
  const todayLog = calendarData?.calendar?.find((d: any) => d.date === checkInDate);
  const tomorrowDow = (dayOfWeek + 1) % 7;
  const tomorrowPlan = calendarData?.calendar?.find((d: any) => d.dayOfWeek === tomorrowDow);
  const tomorrowInPlanWeek = planSundayStr ? todayStr < planSundayStr : false;

  const isLateDinnerDay = todayPlan?.lateDinnerScheduled === true;
  const dinnerLabelSet = todayPlan?.dinnerLabel && todayPlan.dinnerLabel !== "none";

  const show2pmWindow = !isCatchUp && effectiveHour >= 14 && isLateDinnerDay;
  const show10pmWindow = (isCatchUp && !sundayCheckInDone) || effectiveHour >= 22;

  async function checkAllDoneAfterInteraction() {
    userInteracted.current = true;
    await queryClient.refetchQueries({ queryKey: ["/api/calendar", weekNumber] });
    if (isCatchUp) {
      await queryClient.refetchQueries({ queryKey: ["/api/log", isCatchUp ? planSundayStr : lastSundayStr] });
    }
    const freshData = queryClient.getQueryData<any>(["/api/calendar", weekNumber]);
    if (!freshData) return;
    const tp = freshData.calendar?.find((d: any) => d.date === checkInDate);
    if (!tp) return;

    const labelSet = tp.dinnerLabel && tp.dinnerLabel !== "none";
    const isCatchUpCheck = isCatchUp && !sundayCheckInDone;
    const is2pmOnly = !isCatchUpCheck && effectiveHour >= 14 && effectiveHour < 22 && tp.lateDinnerScheduled;

    if (is2pmOnly) {
      return;
    }

    if (isCatchUpCheck || effectiveHour >= 22) {
      let allDone = true;
      if (tp.lateDinnerScheduled) {
        if (!labelSet) allDone = false;
        if (labelSet && tp.dinnerSuccess === null) allDone = false;
      }
      if (tp.walkScheduled) {
        if (tp.walkCompleted === null) allDone = false;
        if (tp.walkTired === null || tp.walkTired === undefined) allDone = false;
      }
      if (calendarPlan?.dietTip && tp.dietResponse === null) allDone = false;

      if (allDone) {
        setShowTickAnimation(true);
        setTimeout(() => {
          setShowTickAnimation(false);
          setRecorded(true);
          toast({ title: "Nice work!", description: isCatchUpCheck ? "Sunday check-in done!" : "Here's what's coming up tomorrow" });
        }, 1200);
      }
    }
  }

  const logMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/log", { date: checkInDate, ...data });
      return res.json();
    },
    onSuccess: async (data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan/current"] });

      if (data?.nextDayAdjustment && (variables.walkTired !== undefined || variables.walkCompleted !== undefined)) {
        await queryClient.refetchQueries({ queryKey: ["/api/calendar", weekNumber] });
        const freshData = queryClient.getQueryData<any>(["/api/calendar", weekNumber]);
        const freshLog = freshData?.calendar?.find((d: any) => d.date === checkInDate);
        const walkDone = freshLog?.walkCompleted !== null && freshLog?.walkCompleted !== undefined;
        const tiredDone = freshLog?.walkTired !== null && freshLog?.walkTired !== undefined;

        if (walkDone && tiredDone) {
          const adj = data.nextDayAdjustment;
          if (adj.adjustedToStretch) {
            setHydrationAdvice("We've switched tomorrow to a 2 min stretch instead. Rest well tonight!");
          } else if (adj.walkCompleted) {
            setHydrationAdvice("Stay hydrated tomorrow! Drink extra water before your walk.");
          } else if (adj.reduced && adj.newDuration) {
            setHydrationAdvice(`We've reduced tomorrow's walk to ${adj.newDuration} min. Stay hydrated and rest well!`);
          } else if (!adj.tomorrowWalkScheduled) {
            setHydrationAdvice("Stay hydrated tomorrow! Rest well tonight.");
          } else {
            setHydrationAdvice("Stay hydrated tomorrow! Drink extra water before your walk.");
          }
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


  const effectiveDate = (() => {
    if (devTime?.dateOverride) {
      return new Date(devTime.dateOverride + "T00:00:00");
    }
    return today;
  })();

  const formatDate = (date?: Date) => {
    const d = date || effectiveDate;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatWeekday = () => {
    return effectiveDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };

  const formatTomorrowDate = () => {
    const tmrw = new Date(effectiveDate);
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
      const dur = dayData.adjustedToStretch ? 2 : (dayData.walkDuration || calendarPlan?.walkDurationGoal);
      const isStretch = !!dayData.adjustedToStretch || !!profile?.isStretchMode;
      tasks.push({ icon: isStretch ? Activity : Footprints, text: `${dur} min ${isStretch ? "stretch" : "walk"} after dinner`, testId: "text-plan-walk", color: "text-primary" });
    }
    if (dayData.lateDinnerScheduled) {
      tasks.push({ icon: UtensilsCrossed, text: "Late dinner — pick a tactic at 2pm", testId: "text-plan-late-dinner", color: "text-amber-500" });
    }
    if (dayData.eatOutScheduled) {
      tasks.push({ icon: ShoppingBag, text: "Eating out", testId: "text-plan-eat-out", color: "text-orange-500" });
    }
    if (calendarPlan?.dietTip) {
      tasks.push({ icon: TrendingUp, text: `"${calendarPlan.dietTip}"`, testId: "text-plan-diet", color: "text-primary" });
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

    const shouldPivot = plan?.lastWeekDinnerEarlyPct === 0 && plan?.prevPrevWeekDinnerEarlyPct === 0 && plan?.currentWeek > 2;

    if (shouldPivot) {
      const firstLateDinnerDow = calendarData?.calendar
        ?.filter((d: any) => d.lateDinnerScheduled)
        ?.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek)?.[0]?.dayOfWeek;
      const isFirstLateDinnerDay = checkInDayOfWeek === firstLateDinnerDow;

      const firstLateDinnerDayData = calendarData?.calendar?.find((d: any) => d.dayOfWeek === firstLateDinnerDow);
      const firstDayLabel = firstLateDinnerDayData?.dinnerLabel;
      const firstDayChoseEarly = firstDayLabel === "move_early";
      const firstDayChoseTactic = firstDayLabel && firstDayLabel !== "none" && firstDayLabel !== "move_early";

      if (!isFirstLateDinnerDay && firstDayChoseEarly) {
        return (
          <div className="space-y-2" data-testid="section-dinner-question">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium">Think you could try eating a bit earlier tonight — before 9pm?</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
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

      if (!isFirstLateDinnerDay && (firstDayChoseTactic || !firstDayLabel || firstDayLabel === "none")) {
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

      return (
        <div className="space-y-3" data-testid="section-dinner-pivot">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">Late dinner tactic</p>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-dinner-pivot-message">
            I've noticed you found it difficult to move dinner earlier over the past 2 weeks. That's okay — let's try a different approach instead:
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
            variant="outline"
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
            className={todayLog?.dinnerSuccess === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            onClick={() => logMutation.mutate({ dinnerSuccess: true })}
            disabled={logMutation.isPending}
            data-testid="button-dinner-yes"
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={todayLog?.dinnerSuccess === false ? "default" : "outline"}
            className={todayLog?.dinnerSuccess === false ? "bg-red-500 hover:bg-red-600 text-white" : ""}
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

    const walkAnswered = todayLog?.walkCompleted !== null && todayLog?.walkCompleted !== undefined;
    const tiredAnswered = todayLog?.walkTired !== null && todayLog?.walkTired !== undefined;
    const bothAnswered = walkAnswered && tiredAnswered;

    const walkDur = todayPlan?.adjustedToStretch ? 2 : (todayPlan?.walkDuration || calendarPlan?.walkDurationGoal);
    const isStretch = !!todayPlan?.adjustedToStretch || !!profile?.isStretchMode;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {isStretch ? <Activity className="w-4 h-4 text-primary" /> : <Footprints className="w-4 h-4 text-primary" />}
          <p className="text-sm font-medium">{walkDur} min {isStretch ? "stretch" : "walk"} after dinner</p>
        </div>
        {bothAnswered ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="section-walk-answered">
            <div className="flex items-center gap-1.5">
              {todayLog.walkCompleted ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )}
              <span>{todayLog.walkCompleted ? "Completed" : "Skipped"}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-amber-500" />
              <span>{todayLog.walkTired ? "Felt tired" : "Feeling good"}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={todayLog?.walkCompleted === true ? "default" : "outline"}
                className={todayLog?.walkCompleted === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ walkCompleted: true })}
                disabled={logMutation.isPending}
                data-testid="button-walk-yes"
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant={todayLog?.walkCompleted === false ? "default" : "outline"}
                className={todayLog?.walkCompleted === false ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                onClick={() => logMutation.mutate({ walkCompleted: false })}
                disabled={logMutation.isPending}
                data-testid="button-walk-no"
              >
                No
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-medium">Feeling tired today?</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={todayLog?.walkTired === true ? "default" : "outline"}
                  className={todayLog?.walkTired === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  onClick={() => logMutation.mutate({ walkTired: true })}
                  disabled={logMutation.isPending}
                  data-testid="button-tired-yes"
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant={todayLog?.walkTired === false ? "default" : "outline"}
                  className={todayLog?.walkTired === false ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  onClick={() => logMutation.mutate({ walkTired: false })}
                  disabled={logMutation.isPending}
                  data-testid="button-tired-no"
                >
                  No
                </Button>
              </div>
            </div>
          </>
        )}

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
    if (!calendarPlan?.dietTip) return null;

    const dietAnswered = todayLog?.dietResponse !== null && todayLog?.dietResponse !== undefined;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Diet tactic</p>
        </div>
        <p className="text-sm text-primary font-medium" data-testid="text-diet-tip">"{calendarPlan.dietTip}"</p>
        {dietAnswered ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="section-diet-answered">
            {todayLog.dietResponse === "yes" ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : todayLog.dietResponse === "no" ? (
              <X className="w-4 h-4 text-red-400" />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            )}
            <span>
              {todayLog.dietResponse === "yes" ? "Tried it today" :
               todayLog.dietResponse === "no" ? "Didn't try today" : "Didn't get the chance"}
            </span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Did you get a chance to try this today?</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={todayLog?.dietResponse === "yes" ? "default" : "outline"}
                className={todayLog?.dietResponse === "yes" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ dietResponse: "yes" })}
                disabled={logMutation.isPending}
                data-testid="button-diet-yes"
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant={todayLog?.dietResponse === "no" ? "default" : "outline"}
                className={todayLog?.dietResponse === "no" ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                onClick={() => logMutation.mutate({ dietResponse: "no" })}
                disabled={logMutation.isPending}
                data-testid="button-diet-no"
              >
                No
              </Button>
              <Button
                size="sm"
                variant={todayLog?.dietResponse === "no_chance" ? "default" : "outline"}
                className={todayLog?.dietResponse === "no_chance" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ dietResponse: "no_chance" })}
                disabled={logMutation.isPending}
                data-testid="button-diet-no-chance"
              >
                Didn't get the chance
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  function isAllCheckInDone() {
    if (!todayLog) return false;
    if (todayPlan?.walkScheduled) {
      if (todayLog.walkCompleted === null || todayLog.walkCompleted === undefined) return false;
      if (todayLog.walkTired === null || todayLog.walkTired === undefined) return false;
    }
    if (isLateDinnerDay) {
      if (!dinnerLabelSet) return false;
      if (todayLog.dinnerSuccess === null || todayLog.dinnerSuccess === undefined) return false;
    }
    if (calendarPlan?.dietTip) {
      if (todayLog.dietResponse === null || todayLog.dietResponse === undefined) return false;
    }
    return true;
  }

  function renderCheckInSummary() {
    const items: { label: string; value: string; positive: boolean }[] = [];

    if (todayPlan?.walkScheduled) {
      const chkDur = todayPlan?.adjustedToStretch ? 2 : (todayPlan?.walkDuration || calendarPlan?.walkDurationGoal);
      const chkStretch = !!todayPlan?.adjustedToStretch || !!profile?.isStretchMode;
      items.push({
        label: chkStretch ? "Stretch after dinner" : "Walk after dinner",
        value: todayLog?.walkCompleted ? "Completed" : "Skipped",
        positive: !!todayLog?.walkCompleted,
      });
      items.push({
        label: "Duration",
        value: `${chkDur} min`,
        positive: true,
      });
      items.push({
        label: "Feeling tired",
        value: todayLog?.walkTired ? "Yes" : "No",
        positive: !todayLog?.walkTired,
      });
    }

    if (isLateDinnerDay && dinnerLabelSet) {
      const tacticName = todayPlan?.dinnerLabel === "move_early"
        ? "Early dinner"
        : (DINNER_LABEL_SHORT[todayPlan?.dinnerLabel] || todayPlan?.dinnerLabel);
      items.push({
        label: `Late dinner tactic (${tacticName})`,
        value: todayLog?.dinnerSuccess ? "Followed" : "Not followed",
        positive: !!todayLog?.dinnerSuccess,
      });
    }

    if (calendarPlan?.dietTip) {
      const struggle = calendarPlan.dietStruggle?.replace(/_/g, " ") || "diet";
      const dietVal = todayLog?.dietResponse === "yes" ? "Yes" :
                      todayLog?.dietResponse === "no" ? "No" : "Didn't get the chance";
      items.push({
        label: `Diet tactic for ${struggle}`,
        value: dietVal,
        positive: todayLog?.dietResponse === "yes",
      });
    }

    return (
      <div className="space-y-2" data-testid="section-checkin-summary">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">Today's check-in complete</p>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className={`text-sm font-medium ${item.positive ? "text-green-600" : "text-red-500"}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function renderCheckInCard() {
    const is2pmOnly = show2pmWindow && !show10pmWindow;
    const is10pm = show10pmWindow;
    const allDone = is10pm && isAllCheckInDone();

    if (showTickAnimation) {
      return (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
              <span className="font-semibold text-foreground">TODAY</span> — {formatDate()}
            </div>
            <div className="flex items-center justify-center py-10" data-testid="section-tick-animation">
              <CheckCircle2 className="w-20 h-20 text-green-500 animate-bounce" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (allDone) {
      return (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
              <span className="font-semibold text-foreground">TODAY</span> — {formatDate()}
            </div>

            {hydrationAdvice && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="section-hydration-advice-summary">
                <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{hydrationAdvice}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs mt-1 text-blue-600"
                    onClick={() => setHydrationAdvice(null)}
                    data-testid="button-dismiss-hydration-summary"
                  >
                    Got it
                  </Button>
                </div>
              </div>
            )}

            {renderCheckInSummary()}
          </CardContent>
        </Card>
      );
    }

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
      if (calendarPlan?.dietTip) {
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
            <span className="font-semibold text-foreground">
              {isCatchUp ? "SUNDAY CHECK-IN" : "TODAY"}
            </span> — {isCatchUp ? formatCatchUpDate() : formatDate()}
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
  const checkInDone = recorded
    || (show10pmWindow && isAllCheckInDone());
  const isSundayEvening = dayOfWeek === 6 && effectiveHour >= 22;
  const nextWeekPlanned = !!(plan?.startDate && todayStr < plan.startDate);
  const showReviewCard = !nextWeekPlanned && (
    (isSundayEvening && checkInDone)
    || (isCatchUp && (sundayCheckInDone || recorded))
  );

  const formatCatchUpDate = () => {
    if (!planSundayStr) return "";
    const d = new Date(planSundayStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center gap-2" data-testid="text-week-header">
        <Target className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">{formatWeekday()}</h1>
      </div>

      {isCatchUp && !sundayCheckInDone && !recorded && (
        <Card className="border-amber-300/50 bg-amber-50 dark:bg-amber-950/20" data-testid="card-catchup-banner">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Let's catch up — complete your Sunday check-in
              </p>
            </div>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">
              Finish Sunday's check-in ({formatCatchUpDate()}) before viewing your weekly report.
            </p>
          </CardContent>
        </Card>
      )}

      {nextWeekPlanned && (
        <>
          <Card className="border-primary/30 bg-primary/5" data-testid="card-all-set">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm font-semibold" data-testid="text-all-set">You're all set for next week!</p>
              </div>
              <p className="text-sm text-muted-foreground">Your plan is ready. Get some rest tonight.</p>
            </CardContent>
          </Card>
          {(() => {
            const tmrwDow = (dayOfWeek + 1) % 7;
            const tmrwDay = plan?.days?.find((d: any) => d.dayOfWeek === tmrwDow);
            if (!tmrwDay) return null;
            const dayData = {
              walkScheduled: tmrwDay.walkScheduled,
              walkDuration: tmrwDay.walkDuration,
              adjustedToStretch: tmrwDay.adjustedToStretch,
              lateDinnerScheduled: tmrwDay.lateDinnerScheduled,
              eatOutScheduled: tmrwDay.eatOutScheduled,
            };
            const tasks: { icon: any; text: string; testId: string; color: string }[] = [];
            if (dayData.walkScheduled) {
              const dur = dayData.adjustedToStretch ? 2 : (dayData.walkDuration || plan?.walkDurationGoal);
              const isStretch = !!dayData.adjustedToStretch || !!profile?.isStretchMode;
              tasks.push({ icon: isStretch ? Activity : Footprints, text: `${dur} min ${isStretch ? "stretch" : "walk"} after dinner`, testId: "text-plan-walk", color: "text-primary" });
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
                    <span className="font-semibold text-foreground">TOMORROW</span> — {formatTomorrowDate()}
                  </div>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">It's your rest day — enjoy it!</p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task, idx) => {
                        const Icon = task.icon;
                        return (
                          <div key={idx} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3" data-testid={task.testId}>
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{idx + 1}</div>
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
          })()}
        </>
      )}

      {!nextWeekPlanned && showReviewCard && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-weekly-report-ready">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              <p className="text-sm font-semibold">
                {isCatchUp
                  ? "You still haven't viewed your weekly report!"
                  : "Your weekly report is ready!"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {isCatchUp
                ? "Review how last week went and plan ahead."
                : "Time to review how your week went and plan ahead for next week."}
            </p>
            <Button
              size="sm"
              onClick={() => setLocation("/plan")}
              data-testid="button-go-to-planner"
            >
              Review & Plan Next Week
            </Button>
          </CardContent>
        </Card>
      )}

      {!nextWeekPlanned && (
        checkInDone ? (
          <>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date-summary">
                  <span className="font-semibold text-foreground">
                    {isCatchUp ? "SUNDAY" : "TODAY"}
                  </span> — {isCatchUp ? formatCatchUpDate() : formatDate()}
                </div>

                {hydrationAdvice && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="section-hydration-advice-recorded">
                    <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{hydrationAdvice}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs mt-1 text-blue-600"
                        onClick={() => setHydrationAdvice(null)}
                        data-testid="button-dismiss-hydration-recorded"
                      >
                        Got it
                      </Button>
                    </div>
                  </div>
                )}

                {renderCheckInSummary()}
              </CardContent>
            </Card>
            {tomorrowInPlanWeek && renderReadOnlyPlan(tomorrowPlan, "TOMORROW", formatTomorrowDate())}
          </>
        ) : showCheckIn ? (
          renderCheckInCard()
        ) : (
          renderReadOnlyPlan(todayPlan, "TODAY", formatDate())
        )
      )}

      {!nextWeekPlanned && calendarPlan?.isDinnerFocus && !calendarPlan?.dietStruggle && (
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

      {!nextWeekPlanned && calendarPlan?.dietStruggle && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2" data-testid="section-home-diet-focus">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Focus: {calendarPlan.dietStruggle.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
            </div>
            {calendarPlan.dietTip && <p className="text-sm text-primary font-medium" data-testid="text-diet-focus-tip">"{calendarPlan.dietTip}"</p>}
          </CardContent>
        </Card>
      )}

      {!nextWeekPlanned && (<Card>
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
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">{profile?.isStretchMode ? "Stretch" : "Walk"}</div>
              {calendarData?.calendar?.map((d: any, i: number) => {
                const inactive = d.dayOfWeek < planFirstActiveDay;
                const isFuture = d.date > todayStr;
                const answered = !isFuture && !inactive && d.walkCompleted !== null && d.walkCompleted !== undefined;
                return (
                  <div key={i} className={`h-7 rounded flex items-center justify-center ${
                    inactive ? "bg-muted/30" :
                    answered && d.walkCompleted ? "bg-green-100 text-green-600" :
                    answered && !d.walkCompleted ? "bg-red-50 text-red-400" :
                    "bg-muted"
                  }`}>
                    {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                     answered && d.walkCompleted ? <Check className="w-3 h-3" /> :
                     answered && !d.walkCompleted ? <X className="w-3 h-3" /> :
                     d.walkScheduled ? ((d.adjustedToStretch || profile?.isStretchMode) ? <Activity className="w-3 h-3 text-muted-foreground" /> : <Footprints className="w-3 h-3 text-muted-foreground" />) : null}
                  </div>
                );
              })}
            </div>

            {calendarData?.calendar?.some((d: any) => d.lateDinnerScheduled) && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">Late Dinner</div>
                {calendarData?.calendar?.map((d: any, i: number) => {
                  const inactive = d.dayOfWeek < planFirstActiveDay;
                  const isFuture = d.date > todayStr;
                  const answered = !isFuture && !inactive && d.dinnerSuccess !== null && d.dinnerSuccess !== undefined;
                  const isMitigation = d.dinnerLabel && ["fiber_starter", "dusk_prep", "split_dinner"].includes(d.dinnerLabel);
                  return (
                    <div key={i} className={`h-7 rounded flex flex-col items-center justify-center ${
                      inactive ? "bg-muted/30" :
                      !d.lateDinnerScheduled ? "bg-muted" :
                      answered && d.dinnerSuccess ? "bg-green-100 text-green-600" :
                      answered && !d.dinnerSuccess ? "bg-red-50 text-red-400" :
                      isMitigation ? "bg-amber-50 text-amber-600" :
                      "bg-muted"
                    }`}>
                      {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                       !d.lateDinnerScheduled ? null :
                       answered && d.dinnerSuccess ? <Check className="w-3 h-3" /> :
                       answered && !d.dinnerSuccess ? <X className="w-3 h-3" /> :
                       isMitigation ? <Lightbulb className="w-3 h-3" /> :
                       <Soup className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
            )}

            {calendarData?.calendar?.some((d: any) => d.eatOutScheduled) && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">Eat Out</div>
                {calendarData?.calendar?.map((d: any, i: number) => {
                  const inactive = d.dayOfWeek < planFirstActiveDay;
                  const isFuture = d.date > todayStr;
                  const answered = !isFuture && !inactive && d.dietResponse !== null && d.dietResponse !== undefined;
                  return (
                    <div key={i} className={`h-7 rounded flex items-center justify-center ${
                      inactive ? "bg-muted/30" :
                      !d.eatOutScheduled ? "bg-muted" :
                      answered && d.dietResponse === "yes" ? "bg-green-100 text-green-600" :
                      answered && d.dietResponse === "no" ? "bg-red-50 text-red-400" :
                      "bg-muted"
                    }`}>
                      {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                       !d.eatOutScheduled ? null :
                       answered && d.dietResponse === "yes" ? <Check className="w-3 h-3" /> :
                       answered && d.dietResponse === "no" ? <X className="w-3 h-3" /> :
                       <Wine className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
            )}

            {calendarPlan?.dietTip && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Diet</div>
                {calendarData?.calendar?.map((d: any, i: number) => {
                  const inactive = d.dayOfWeek < planFirstActiveDay;
                  const isFuture = d.date > todayStr;
                  const resp = (isFuture || inactive) ? null : d.dietResponse;
                  return (
                    <div key={i} className={`h-7 rounded flex items-center justify-center ${
                      inactive ? "bg-muted/30" :
                      resp === "yes" ? "bg-green-100 text-green-600" :
                      resp === "no" ? "bg-red-50 text-red-400" :
                      resp === "no_chance" ? "bg-gray-100 text-gray-400" :
                      "bg-muted"
                    }`}>
                      {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                       resp === "yes" ? <Check className="w-3 h-3" /> :
                       resp === "no" ? <X className="w-3 h-3" /> :
                       resp === "no_chance" ? <Minus className="w-3 h-3" /> : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2 text-[10px] text-muted-foreground" data-testid="calendar-legend">
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> Done</div>
              <div className="flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> Missed</div>
              <div className="flex items-center gap-1">
                {profile?.isStretchMode ? <Activity className="w-3 h-3" /> : <Footprints className="w-3 h-3" />}
                {profile?.isStretchMode ? " Planned stretch" : " Planned walk"}
              </div>
              <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> Late dinner</div>
              <div className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Tactic set</div>
              {calendarData?.calendar?.some((d: any) => d.eatOutScheduled) && (
                <div className="flex items-center gap-1"><Wine className="w-3 h-3" /> Planned eat out</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>)}
    </div>
  );
}
