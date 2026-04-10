import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Clock, Calendar, Database, ChevronLeft, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

const TIME_OPTIONS = [
  { label: "Real time", value: null },
  { label: "8 AM", value: 8 },
  { label: "2 PM", value: 14 },
  { label: "6 PM", value: 18 },
  { label: "10 PM", value: 22 },
  { label: "11 PM", value: 23 },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jsDay = d.getDay();
  const diff = jsDay === 0 ? 6 : jsDay - 1;
  d.setDate(d.getDate() - diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

  const setTimeMutation = useMutation({
    mutationFn: async (params: { hour?: number | null; date?: string | null }) => {
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

  const setupRepickMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/dev/setup-repick-scenario", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.clear();
      localStorage.clear();
      toast({ title: "Repick scenario ready", description: data.message });
      window.location.href = "/plan";
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/dev/reset-account", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      localStorage.clear();
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await fetch("/api/dev/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send");
      }
      if (!data.success) {
        throw new Error("OneSignal delivery failed — check server logs");
      }
      return data;
    },
    onSuccess: (_data: any, type: string) => {
      toast({ title: "Notification sent", description: `Sent "${type}" test notification` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const [historyWeeks, setHistoryWeeks] = useState(2);
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

  const currentDateOverride = devState?.dateOverride || null;
  const dateInfo = currentDateOverride ? (() => {
    const d = new Date(currentDateOverride + "T00:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    const monday = getMondayOfWeek(currentDateOverride);
    return { dayName, monday };
  })() : null;

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
            Current: {devState?.timeOverride !== null && devState?.timeOverride !== undefined ? `${devState?.timeOverride}:00 (simulated)` : "Real time"}
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
            <p className="text-sm font-semibold">Date Override</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentDateOverride
              ? `Simulating: ${currentDateOverride} (${dateInfo?.dayName}) · Plan week starts ${dateInfo?.monday}`
              : "Using real date"}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm bg-background"
              value={currentDateOverride || ""}
              onChange={(e) => setTimeMutation.mutate({ date: e.target.value || null })}
              data-testid="input-date-override"
            />
            <Button
              size="sm"
              variant={!currentDateOverride ? "default" : "outline"}
              onClick={() => setTimeMutation.mutate({ date: null })}
              disabled={setTimeMutation.isPending}
              data-testid="button-date-real"
            >
              Real date
            </Button>
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
            <Database className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold">Generate History</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentDateOverride
              ? `Generates ${historyWeeks} weeks of history before ${dateInfo?.monday} (Monday of selected week)`
              : "Set a date override first to anchor history generation"}
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs">Weeks to generate</p>
              <div className="flex gap-1">
                {[2, 3, 4].map(w => (
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
              disabled={generateHistoryMutation.isPending || !currentDateOverride}
              data-testid="button-generate-history"
            >
              {generateHistoryMutation.isPending ? "Generating..." : `Generate ${historyWeeks} weeks`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 dark:border-amber-900">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Repick Scenario (6-week seed)</p>
          </div>
          <p className="text-xs text-muted-foreground">Resets account then seeds 6 weeks: sugary×3 (mastered) + portions×3 (skipped). Sets date to Sun 2026-03-22 22:00 and opens the weekly planner.</p>
          <Button
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => { if (confirm("Reset account and seed repick scenario?")) setupRepickMutation.mutate(); }}
            disabled={setupRepickMutation.isPending}
            data-testid="button-setup-repick-scenario"
          >
            {setupRepickMutation.isPending ? "Setting up..." : "Setup Repick Scenario"}
          </Button>
        </CardContent>
      </Card>

      <OneSignalDebugCard />

      <Card className="border-blue-200 dark:border-blue-900">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Test Push Notifications</p>
          </div>
          <p className="text-xs text-muted-foreground">Send a test push notification to your device. You must have the app open in the mobile wrapper first to register your device.</p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => testNotificationMutation.mutate("late_dinner")}
              disabled={testNotificationMutation.isPending}
              data-testid="button-test-notif-late-dinner"
            >
              {testNotificationMutation.isPending ? "Sending..." : "Test Late Dinner"}
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => testNotificationMutation.mutate("sunday_planning")}
              disabled={testNotificationMutation.isPending}
              data-testid="button-test-notif-sunday-planning"
            >
              {testNotificationMutation.isPending ? "Sending..." : "Test Sunday Planning"}
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => testNotificationMutation.mutate("reengagement")}
              disabled={testNotificationMutation.isPending}
              data-testid="button-test-notif-reengagement"
            >
              {testNotificationMutation.isPending ? "Sending..." : "Test Re-engagement"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-600">Reset Account</p>
          </div>
          <p className="text-xs text-muted-foreground">Deletes all data and profile. You will be sent back to onboarding.</p>
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { if (confirm("Delete ALL data and reset? This cannot be undone.")) resetAccountMutation.mutate(); }}
            disabled={resetAccountMutation.isPending}
            data-testid="button-reset-account"
          >
            {resetAccountMutation.isPending ? "Resetting..." : "Reset Account"}
          </Button>
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

function OneSignalDebugCard() {
  const [status, setStatus] = useState<string[]>(["Checking..."]);
  const [probing, setProbing] = useState(false);

  const probe = async () => {
    setProbing(true);
    const lines: string[] = [];

    const hasNatively = !!(window as any).natively;
    const hasNativelyPush = !!(window as any).NativelyPush;
    lines.push(`window.natively: ${hasNatively ? "YES" : "NO"}`);
    lines.push(`window.NativelyPush: ${hasNativelyPush ? "YES" : "NO"}`);

    if (!hasNatively && !hasNativelyPush) {
      lines.push("⛔ Native SDK not available (not in mobile wrapper)");
      setStatus(lines);
      setProbing(false);
      return;
    }

    if (!hasNativelyPush) {
      lines.push("⛔ NativelyPush class not found");
      setStatus(lines);
      setProbing(false);
      return;
    }

    try {
      const push = new (window as any).NativelyPush();
      lines.push("✅ NativelyPush instantiated");

      const result = await push.getOneSignalId();
      lines.push(`Raw result: ${JSON.stringify(result)}`);

      const playerId = result?.oneSignalId || result?.playerId || result?.id;
      if (playerId) {
        lines.push(`✅ Player ID: ${playerId}`);
      } else {
        lines.push("⛔ No player ID found in result");
        lines.push(`Keys available: ${result ? Object.keys(result).join(", ") : "null"}`);
      }
    } catch (e: any) {
      lines.push(`⛔ Error: ${e.message}`);
    }

    try {
      const resp = await fetch("/api/dev/state", { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        const dbPlayerId = data?.profile?.onesignalPlayerId;
        lines.push(`DB stored player ID: ${dbPlayerId || "NULL"}`);
      }
    } catch {}

    setStatus(lines);
    setProbing(false);
  };

  useEffect(() => { probe(); }, []);

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">OneSignal Debug</p>
        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 space-y-1">
          {status.map((line, i) => (
            <p key={i} className="text-xs font-mono select-text break-all" style={{ userSelect: "text", WebkitUserSelect: "text" }} data-testid={`text-onesignal-debug-${i}`}>{line}</p>
          ))}
        </div>
        <Button
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          onClick={probe}
          disabled={probing}
          data-testid="button-onesignal-probe"
        >
          {probing ? "Probing..." : "Re-probe OneSignal"}
        </Button>
      </CardContent>
    </Card>
  );
}
