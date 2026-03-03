import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Check, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface RoadmapData {
  currentStruggle: string;
  currentTip: string;
  isDinnerFocus: boolean;
  dinnerMastered: boolean;
  walkSuccessAvg: number;
  dinnerSuccessAvg: number;
  dietTipCompletionCount: number;
  struggles: string[];
  currentTipIndex: number;
  tipLadders: Record<string, string[]>;
}

const STRUGGLE_LABELS: Record<string, string> = {
  sugary_food_drink: "Sugary Food & Drinks",
  oily_fried_food: "Oily/Fried Food",
  eat_out: "Eating Out",
  portions: "Portion Control",
  snacks: "Snacking",
};

function LoadingSkeleton() {
  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-6 w-36 mt-4" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default function RoadmapPage() {
  const { data, isLoading } = useQuery<RoadmapData>({
    queryKey: ["/api/roadmap"],
  });

  if (isLoading || !data) {
    return <LoadingSkeleton />;
  }

  const {
    currentStruggle,
    currentTip,
    isDinnerFocus,
    dinnerMastered,
    walkSuccessAvg,
    dinnerSuccessAvg,
    dietTipCompletionCount,
    struggles,
    currentTipIndex,
    tipLadders,
  } = data;

  const currentStruggleIndex = struggles.indexOf(currentStruggle);

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div data-testid="focus-area-header">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold" data-testid="text-focus-title">
            Weekly Progress
          </h1>
        </div>
      </div>

      <Card data-testid="card-walk-progress">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Post-meal Walk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Completion rate</span>
            <span className="text-sm font-medium" data-testid="text-walk-avg">
              {Math.round(walkSuccessAvg)}%
            </span>
          </div>
          <Progress value={walkSuccessAvg} data-testid="progress-walk" />
        </CardContent>
      </Card>

      {(isDinnerFocus || dinnerMastered) && (
        <Card data-testid="card-dinner-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Early Dinner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Success rate</span>
              <span className="text-sm font-medium" data-testid="text-dinner-avg">
                {Math.round(dinnerSuccessAvg)}%
              </span>
            </div>
            <Progress value={dinnerSuccessAvg} data-testid="progress-dinner" />
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-diet-tip-progress">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Diet Tip</CardTitle>
        </CardHeader>
        <CardContent>
          {currentTip && (
            <p className="text-sm text-primary font-medium mb-3" data-testid="text-current-tip">
              "{currentTip}"
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Completion of diet tip per week</span>
            <span className="text-sm font-medium" data-testid="text-diet-completion-count">
              {dietTipCompletionCount} {dietTipCompletionCount === 1 ? "day" : "days"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="pt-2">
        <h2 className="text-base font-semibold mb-3" data-testid="text-struggle-queue-title">
          Struggle Queue
        </h2>
        <div className="space-y-2">
          {struggles.map((struggle, index) => {
            const isCompleted = index < currentStruggleIndex;
            const isCurrent = struggle === currentStruggle;
            const label = STRUGGLE_LABELS[struggle] || struggle;

            return (
              <div
                key={struggle}
                data-testid={`struggle-item-${struggle}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-medium"
                    : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground opacity-60"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : isCurrent ? (
                  <TrendingUp className="h-4 w-4 shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 shrink-0" />
                )}
                <span data-testid={`text-struggle-label-${struggle}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
