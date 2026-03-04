import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STRUGGLE_PRIORITY } from "@shared/schema";
import { Settings, Clock, Calendar, User, Database, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

const TIME_OPTIONS = [
  { label: "Real time", value: null },
  { label: "8 AM", value: 8 },
  { label: "2 PM", value: 14 },
  { label: "6 PM (Sun planner)", value: 18 },
  { label: "10 PM", value: 22 },
  { label: "11 PM", value: 23 },
];

export default function DevPanel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: devCheck, isLoading: devCheckLoading } = useQuery({ queryKey: ["/api/dev/check"] });
  const { data: devState, isLoading } = useQuery({ queryKey: ["/api/dev/state"], enabled: devCheck?.isDev === true });

  const setWeekMutation = useMutation({
    mutationFn: async (weekNumber: number) => {
      const res = await apiRequest("POST", "/api/dev/set-week", { weekNumber });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Week updated" });
    },
  });

  const setProfileMutation = useMutation({
    mutationFn: async (fields: any) => {
      const res = await apiRequest("POST", "/api/dev/set-profile", fields);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Profile updated" });
    },
  });

  const setTimeMutation = useMutation({
    mutationFn: async (params: { hour?: number | null; day?: number | null }) => {
      const res = await apiRequest("POST", "/api/dev/set-time", params);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Override updated" });
    },
  });

  const generateHistoryMutation = useMutation({
    mutationFn: async (params: { weeks: number; walkSuccessRate: number; dietSuccessRate: number }) => {
      const res = await apiRequest("POST", "/api/dev/generate-history", params);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries();
      toast({ title: `Generated ${data.generatedWeeks?.length} weeks`, description: `Now at week ${data.currentWeek}` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [historyWeeks, setHistoryWeeks] = useState(4);
  const [walkRate, setWalkRate] = useState(70);
  const [dietRate, setDietRate] = useState(60);

  if (devCheckLoading || isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!devCheck?.isDev) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 text-center">
        <p className="text-sm text-muted-foreground mt-10">Not authorized</p>
      </div>
    );
  }

  const profile = devState?.profile;
  const plan = devState?.plan;
  const currentWeek = profile?.currentWeek || 1;

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-dev-back">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Settings className="w-5 h-5 text-red-500" />
        <h1 className="text-lg font-bold text-red-600">Dev Panel</h1>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold">Time Override</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Current: {devState?.timeOverride !== null ? `${devState?.timeOverride}:00 (simulated)` : "Real time"}
          </p>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map(opt => (
              <Button
                key={opt.label}
                size="sm"
                variant={devState?.timeOverride === opt.value ? "default" : "outline"}
                onClick={() => setTimeMutation.mutate({ hour: opt.value })}
                disabled={setTimeMutation.isPending}
                data-testid={`button-time-${opt.value ?? "real"}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold">Day Override</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Current: {devState?.dayOverride !== null && devState?.dayOverride !== undefined ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][devState.dayOverride] + " (simulated)" : "Real day"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={devState?.dayOverride === null || devState?.dayOverride === undefined ? "default" : "outline"}
              onClick={() => setTimeMutation.mutate({ day: null })}
              disabled={setTimeMutation.isPending}
              data-testid="button-day-real"
            >
              Real day
            </Button>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => (
              <Button
                key={name}
                size="sm"
                variant={devState?.dayOverride === i ? "default" : "outline"}
                onClick={() => setTimeMutation.mutate({ day: i })}
                disabled={setTimeMutation.isPending}
                data-testid={`button-day-${i}`}
              >
                {name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <p className="text-sm font-semibold">Week Control</p>
          </div>
          <p className="text-xs text-muted-foreground">Current week: {currentWeek}</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(w => (
              <Button
                key={w}
                size="sm"
                variant={currentWeek === w ? "default" : "outline"}
                onClick={() => setWeekMutation.mutate(w)}
                disabled={setWeekMutation.isPending}
                data-testid={`button-week-${w}`}
              >
                W{w}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-purple-500" />
            <p className="text-sm font-semibold">Profile State</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs">hasLateDinner</p>
              <Button
                size="sm"
                variant={profile?.hasLateDinner ? "default" : "outline"}
                onClick={() => setProfileMutation.mutate({ hasLateDinner: !profile?.hasLateDinner })}
                disabled={setProfileMutation.isPending}
                data-testid="button-toggle-late-dinner"
              >
                {profile?.hasLateDinner ? "ON" : "OFF"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">dinnerMastered</p>
              <Button
                size="sm"
                variant={profile?.dinnerMastered ? "default" : "outline"}
                onClick={() => setProfileMutation.mutate({ dinnerMastered: !profile?.dinnerMastered })}
                disabled={setProfileMutation.isPending}
                data-testid="button-toggle-dinner-mastered"
              >
                {profile?.dinnerMastered ? "ON" : "OFF"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">walkDuration</p>
              <div className="flex gap-1">
                {[2, 5, 10, 15, 20].map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={profile?.walkDuration === d ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setProfileMutation.mutate({ walkDuration: d })}
                    disabled={setProfileMutation.isPending}
                    data-testid={`button-walk-dur-${d}`}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">walksPerWeek</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={profile?.walksPerWeek === n ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setProfileMutation.mutate({ walksPerWeek: n })}
                    disabled={setProfileMutation.isPending}
                    data-testid={`button-walks-per-${n}`}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs">currentStruggle: {profile?.currentStruggle || "none"}</p>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={!profile?.currentStruggle ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setProfileMutation.mutate({ currentStruggle: null })}
                  disabled={setProfileMutation.isPending}
                  data-testid="button-struggle-none"
                >
                  None
                </Button>
                {STRUGGLE_PRIORITY.map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={profile?.currentStruggle === s ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setProfileMutation.mutate({ currentStruggle: s })}
                    disabled={setProfileMutation.isPending}
                    data-testid={`button-struggle-${s}`}
                  >
                    {s.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">currentTipIndex: {profile?.currentTipIndex}</p>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <Button
                    key={i}
                    size="sm"
                    variant={profile?.currentTipIndex === i ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setProfileMutation.mutate({ currentTipIndex: i })}
                    disabled={setProfileMutation.isPending}
                    data-testid={`button-tip-${i}`}
                  >
                    {i}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">dinnerSuccessWeeks: {profile?.dinnerSuccessWeeks}</p>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(w => (
                  <Button
                    key={w}
                    size="sm"
                    variant={profile?.dinnerSuccessWeeks === w ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setProfileMutation.mutate({ dinnerSuccessWeeks: w })}
                    disabled={setProfileMutation.isPending}
                    data-testid={`button-dinner-weeks-${w}`}
                  >
                    {w}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold">Generate History</p>
          </div>
          <p className="text-xs text-muted-foreground">Create past weeks of simulated data from current week forward</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs">Weeks to generate</p>
              <div className="flex gap-1">
                {[1, 2, 4, 8].map(w => (
                  <Button
                    key={w}
                    size="sm"
                    variant={historyWeeks === w ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setHistoryWeeks(w)}
                    data-testid={`button-hist-weeks-${w}`}
                  >
                    {w}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">Walk success %</p>
              <div className="flex gap-1">
                {[0, 30, 50, 70, 100].map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={walkRate === r ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setWalkRate(r)}
                    data-testid={`button-walk-rate-${r}`}
                  >
                    {r}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs">Diet success %</p>
              <div className="flex gap-1">
                {[0, 30, 50, 70, 100].map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={dietRate === r ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => setDietRate(r)}
                    data-testid={`button-diet-rate-${r}`}
                  >
                    {r}%
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => generateHistoryMutation.mutate({ weeks: historyWeeks, walkSuccessRate: walkRate, dietSuccessRate: dietRate })}
              disabled={generateHistoryMutation.isPending}
              data-testid="button-generate-history"
            >
              {generateHistoryMutation.isPending ? "Generating..." : `Generate ${historyWeeks} weeks`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-semibold">Current State (JSON)</p>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-60 select-text" style={{ userSelect: "text", WebkitUserSelect: "text" }} data-testid="text-dev-state">
            {JSON.stringify({ profile, plan: plan ? { id: plan.id, weekNumber: plan.weekNumber, walkDurationGoal: plan.walkDurationGoal, dietStruggle: plan.dietStruggle, dietTip: plan.dietTip, isDinnerFocus: plan.isDinnerFocus } : null }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
