import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronLeft, ChevronRight, Footprints, UtensilsCrossed, Calendar } from "lucide-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MITIGATION_OPTIONS = [
  { value: "fiber_starter", label: "Fiber Starter", desc: "Eat veggies first" },
  { value: "dusk_prep", label: "Dusk Prep", desc: "Light snack at 5 PM" },
  { value: "split_dinner", label: "Split Dinner", desc: "Split into two smaller meals" },
] as const;

export default function WeeklyPlanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });
  const { data: reflection } = useQuery({ queryKey: ["/api/plan/reflection"] });

  const isFirstWeek = !reflection;
  const isDinnerFocus = profile?.hasLateDinner && !profile?.dinnerMastered;

  const steps: string[] = [];
  if (!isFirstWeek) steps.push("reflection");
  steps.push("walkDays");
  if (isDinnerFocus) { steps.push("dinnerDays"); steps.push("dinnerPlan"); }
  else if (profile?.currentStruggle) steps.push("dietReview");
  steps.push("preview");

  const [stepIndex, setStepIndex] = useState(0);
  const currentStepId = steps[stepIndex] || steps[0];

  const [negotiationChoice, setNegotiationChoice] = useState<string>("keep_current");
  const [walkDays, setWalkDays] = useState<number[]>(getDefaultWalkDays());
  const [lateDinnerDays, setLateDinnerDays] = useState<number[]>([]);
  const [dinnerPlan, setDinnerPlan] = useState<{ dayOfWeek: number; label: string; canMoveEarly: boolean }[]>([]);
  const [selectedTip, setSelectedTip] = useState<string>("fiber_starter");

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const dinnerPlanData = dinnerPlan
        .filter(d => !d.canMoveEarly || d.label === "move_early")
        .map(d => ({
          dayOfWeek: d.dayOfWeek,
          label: d.canMoveEarly ? "move_early" : d.label,
        }));

      const res = await apiRequest("POST", "/api/plan/weekly", {
        negotiationChoice,
        walkDays,
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

  function getDefaultWalkDays(): number[] {
    if (reflection) {
      const count = reflection.walkDaysScheduled || 3;
      return Array.from({ length: count }, (_, i) => i);
    }
    const pw = profile?.walksPerWeek || 3;
    return Array.from({ length: pw }, (_, i) => i);
  }

  function handleNegotiation(choice: string) {
    setNegotiationChoice(choice);
    let days = [...walkDays];
    if (choice === "add_day" && days.length < 5) {
      for (let i = 0; i < 7; i++) {
        if (!days.includes(i)) { days.push(i); break; }
      }
    }
    setWalkDays(days);
    setStepIndex(stepIndex + 1);
  }

  function toggleWalkDay(day: number) {
    setWalkDays(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      if (prev.length >= 7) return prev;
      return [...prev, day];
    });
  }

  function toggleLateDinnerDay(day: number) {
    setLateDinnerDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      setDinnerPlan(next.map(d => {
        const existing = dinnerPlan.find(dp => dp.dayOfWeek === d);
        return existing || { dayOfWeek: d, label: "move_early", canMoveEarly: true };
      }));
      return next;
    });
  }

  function setDinnerDayCanMoveEarly(dayOfWeek: number, canMove: boolean) {
    setDinnerPlan(prev =>
      prev.map(d =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, canMoveEarly: canMove, label: canMove ? "move_early" : selectedTip }
          : d
      )
    );
  }

  function setDinnerDayTip(dayOfWeek: number, tip: string) {
    setDinnerPlan(prev =>
      prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, label: tip } : d)
    );
  }

  function renderStep() {
    if (currentStepId === "reflection") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-reflection-title">
              <Footprints className="w-5 h-5 text-primary" />
              Last Week's Walks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center" data-testid="text-walk-stats">
              <p className="text-3xl font-bold text-primary">{reflection?.walkDaysCompleted}/{reflection?.walkDaysScheduled}</p>
              <p className="text-muted-foreground text-sm">walk days completed ({reflection?.walkSuccessPct}%)</p>
            </div>

            {reflection?.isDinnerFocus && reflection?.dinnerSuccessPct !== null && (
              <div className="text-center border-t pt-3" data-testid="text-dinner-stats">
                <p className="text-xl font-semibold">{reflection.dinnerSuccessPct}%</p>
                <p className="text-muted-foreground text-sm">dinner goals met</p>
              </div>
            )}

            {reflection?.dietTip && !reflection?.isDinnerFocus && (
              <div className="text-center border-t pt-3" data-testid="text-diet-stats">
                <p className="text-sm text-muted-foreground">Diet tip: {reflection.dietTip}</p>
                <p className="text-sm">
                  {reflection.dietCleanWeek
                    ? <span className="text-green-600 font-medium">Clean week! Moving to next tip</span>
                    : <span className="text-amber-600 font-medium">{reflection.dietNoCount} "No" — repeating same tip</span>
                  }
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-center">What would you like to do this week?</p>
              {reflection?.suggestedActions?.map((action: any) => (
                <Button
                  key={action.type}
                  variant={action.type === "keep_current" ? "outline" : "default"}
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleNegotiation(action.type)}
                  data-testid={`button-negotiation-${action.type}`}
                >
                  <div>
                    <p className="font-medium">{action.label}</p>
                    <p className="text-xs opacity-80">{action.description}</p>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (currentStepId === "walkDays") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-walk-days-title">
              <Calendar className="w-5 h-5 text-primary" />
              Select Walk Days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Tap days you'll walk this week</p>
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleWalkDay(i)}
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

    if (currentStepId === "dinnerDays") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-dinner-days-title">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
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
                  data-testid={`button-dinner-day-${i}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (currentStepId === "dinnerPlan") {
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

    if (currentStepId === "dietReview" && profile?.currentStruggle) {
      const tipLadder = profile.currentStruggle
        ? (DIET_TIP_LADDERS as Record<string, string[]>)[profile.currentStruggle] || []
        : [];
      const currentTip = tipLadder[profile.currentTipIndex] || "";
      const struggleNames: Record<string, string> = {
        sugary_food_drink: "Sugary Food & Drinks",
        oily_fried_food: "Oily/Fried Food",
        eat_out: "Eating Out",
        portions: "Portion Control",
        snacks: "Snacking",
      };

      return (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-diet-review-title">This Week's Diet Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-primary/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Current struggle</p>
              <p className="font-semibold text-lg" data-testid="text-current-struggle">
                {struggleNames[profile.currentStruggle] || profile.currentStruggle}
              </p>
            </div>
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">This week's tip</p>
              <p className="font-medium text-primary" data-testid="text-current-tip">{currentTip}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

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
            <p className="text-xs font-medium text-muted-foreground">Walk</p>
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

          {isDinnerFocus && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Dinner</p>
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

      {currentStepId !== "reflection" && (
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
            disabled={stepIndex === 0}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {!isLastStep && (
            <Button
              size="sm"
              onClick={() => setStepIndex(stepIndex + 1)}
              data-testid="button-next"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const DIET_TIP_LADDERS: Record<string, string[]> = {
  sugary_food_drink: ["Dilute juice 1:1 with water", "Swap dessert for yogurt + berries", "Limit fruit to 1x per week"],
  oily_fried_food: ["Try Steam Burst Hack (steam then quick sear)", "Choose grilled over fried"],
  eat_out: ["Decouple (eat at home first, socialize out)", "Share main dishes", "Swap sides for vegetables"],
  portions: ["Use the plate method (½ veggies, ¼ protein, ¼ carbs)"],
  snacks: ["Kitchen Closure after dinner", "Switch to edamame or nuts"],
};
