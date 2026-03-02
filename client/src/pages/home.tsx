import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Check, X, Minus, Camera, Footprints } from "lucide-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DINNER_LABEL_SHORT: Record<string, string> = {
  move_early: "Early",
  fiber_starter: "Fiber",
  dusk_prep: "Dusk",
  split_dinner: "Split",
  none: "",
};

export default function Home() {
  const { toast } = useToast();
  const { data: plan, isLoading: planLoading } = useQuery({ queryKey: ["/api/plan/current"] });
  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });

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

  const totalTracked = calendarData?.calendar?.length || 0;
  const totalSuccess = calendarData?.calendar?.filter((d: any) =>
    d.walkCompleted === true || d.dinnerSuccess === true || d.dietResponse === "yes" || d.dietResponse === "no_chance"
  ).length || 0;
  const walkCompleted = calendarData?.calendar?.filter((d: any) => d.walkCompleted === true).length || 0;
  const walkScheduled = calendarData?.calendar?.filter((d: any) => d.walkScheduled).length || 0;
  const weightedPct = walkScheduled > 0 ? Math.round((walkCompleted / walkScheduled) * 100) : 0;

  const formatDate = () => {
    return today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center gap-2" data-testid="text-week-header">
        <Target className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">
          Week {weekNumber}: {weightedPct}% ({walkCompleted}/{walkScheduled})
        </h1>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
            <span className="font-semibold text-foreground">TODAY</span> — {formatDate()}
          </div>

          {plan?.isDinnerFocus && todayPlan?.dinnerLabel !== "none" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {todayPlan?.dinnerLabel === "move_early"
                  ? "Move dinner before 9pm"
                  : `Tip: ${DINNER_LABEL_SHORT[todayPlan?.dinnerLabel] || todayPlan?.dinnerLabel}`
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {todayPlan?.dinnerLabel === "move_early"
                  ? "Did you eat before 9pm?"
                  : `Did you follow the ${todayPlan?.dinnerLabel?.replace("_", " ")} tip?`
                }
              </p>
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
          )}

          {!plan?.isDinnerFocus && plan?.dietTip && (
            <div className="space-y-2">
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
          )}

          {todayPlan?.walkScheduled && (
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

            {plan?.isDinnerFocus && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Dinner</div>
                {calendarData?.calendar?.map((d: any, i: number) => (
                  <div key={i} className={`h-7 rounded flex items-center justify-center text-[8px] font-medium ${
                    d.dinnerLabel === "none" ? "bg-muted" :
                    d.dinnerSuccess === true ? "bg-green-100 text-green-700" :
                    d.dinnerSuccess === false ? "bg-red-50 text-red-500" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {DINNER_LABEL_SHORT[d.dinnerLabel] || ""}
                  </div>
                ))}
              </div>
            )}

            {!plan?.isDinnerFocus && plan?.dietTip && (
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
