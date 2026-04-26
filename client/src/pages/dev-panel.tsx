import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Clock, Calendar, Database, ChevronLeft, Trash2, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { presentPaywall } from "@/lib/natively-purchases";

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

      <PushRegistrationCard />

      <OneSignalDebugCard />

      <BuildInfoCard />

      <TriggerPaywallTestCard />

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
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => testNotificationMutation.mutate("daily_checkin")}
              disabled={testNotificationMutation.isPending}
              data-testid="button-test-notif-daily-checkin"
            >
              {testNotificationMutation.isPending ? "Sending..." : "Test Daily Check-in"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Preview Onboarding</p>
          </div>
          <p className="text-xs text-muted-foreground">Walk through every onboarding question for review. Nothing is saved — your profile, plans, and premium status stay untouched.</p>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setLocation("/onboarding?preview=1")}
            data-testid="button-preview-onboarding"
          >
            Preview Onboarding
          </Button>
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

function TriggerPaywallTestCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">Trigger Paywall (test)</p>
        <p className="text-xs text-muted-foreground">
          Calls <code>presentPaywall()</code> directly. On the web preview the BN bridge is
          missing, so you should see a "bridge missing" toast — that's expected. On TestFlight
          this opens RC's hosted paywall.
        </p>
        <Button
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await presentPaywall();
              toast({
                title: `status=${result.status}`,
                description: `message=${result.message ?? "(none)"} error=${result.error ?? "(none)"}`,
              });
            } finally {
              setBusy(false);
            }
          }}
          data-testid="button-trigger-paywall-test"
        >
          {busy ? "Presenting…" : "Present Paywall"}
        </Button>
      </CardContent>
    </Card>
  );
}

function BuildInfoCard() {
  const { data, isLoading } = useQuery<{ sha: string | null; startedAt: string; nodeEnv: string | null }>({
    queryKey: ["/api/build-info"],
  });
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="pt-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Running Build</p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-1">
            <p className="text-xs font-mono select-text break-all" style={{ userSelect: "text", WebkitUserSelect: "text" }} data-testid="text-build-sha">
              sha: {data?.sha ?? "(none)"}
            </p>
            <p className="text-xs font-mono select-text break-all" style={{ userSelect: "text", WebkitUserSelect: "text" }} data-testid="text-build-started">
              server started: {data?.startedAt ?? "?"}
            </p>
            <p className="text-xs font-mono select-text break-all" style={{ userSelect: "text", WebkitUserSelect: "text" }} data-testid="text-build-env">
              NODE_ENV: {data?.nodeEnv ?? "?"}
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">If sha changes after a TestFlight update but the bug repeats, the webview is using a stale cached bundle.</p>
      </CardContent>
    </Card>
  );
}


function OneSignalDebugCard() {
  const [status, setStatus] = useState<string[]>(["Checking..."]);
  const [probing, setProbing] = useState(false);
  const [messageLog, setMessageLog] = useState<string[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && typeof data === "object") {
          const keys = Object.keys(data);
          const relevant = keys.some(k => /onesignal|player|push|natively/i.test(k));
          if (relevant || data.oneSignalId || data.playerId || data.onesignal_player_id) {
            setMessageLog(prev => [...prev, `MSG: ${JSON.stringify(data)}`]);
          }
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const probe = async () => {
    setProbing(true);
    const lines: string[] = [];
    const w = window as any;

    const nativelyGlobals = Object.keys(w).filter(k =>
      /natively|onesignal|OneSignal/i.test(k)
    );
    lines.push(`Related globals: ${nativelyGlobals.join(", ") || "none"}`);

    const hasNatively = !!w.natively;
    const hasNativelyPush = !!w.NativelyPush;
    const hasOneSignal = !!w.OneSignal;
    lines.push(`window.natively: ${hasNatively ? "YES" : "NO"}`);
    lines.push(`window.NativelyPush: ${hasNativelyPush ? "YES" : "NO"}`);
    lines.push(`window.OneSignal: ${hasOneSignal ? "YES" : "NO"}`);

    if (!hasNatively && !hasNativelyPush && !hasOneSignal) {
      lines.push("⛔ No native SDK globals found (not in mobile wrapper)");
      setStatus(lines);
      setProbing(false);
      return;
    }

    let foundId: string | null = null;

    if (hasNativelyPush) {
      try {
        const push = new w.NativelyPush();
        lines.push("✅ NativelyPush instantiated");
        const result = await push.getOneSignalId();
        lines.push(`NativelyPush result: ${JSON.stringify(result)}`);
        const id = result?.oneSignalId || result?.playerId || result?.id;
        if (id) { foundId = id; lines.push(`✅ Player ID via NativelyPush: ${id}`); }
        else { lines.push(`Keys: ${result ? Object.keys(result).join(", ") : "null"}`); }
      } catch (e: any) {
        lines.push(`⛔ NativelyPush error: ${e.message}`);
      }
    }

    if (!foundId && hasNatively) {
      lines.push(`natively keys: ${Object.keys(w.natively).join(", ")}`);
      if (typeof w.natively.getOneSignalId === "function") {
        try {
          const result = await w.natively.getOneSignalId();
          lines.push(`natively.getOneSignalId: ${JSON.stringify(result)}`);
          const id = result?.oneSignalId || result?.playerId || result?.id;
          if (id) { foundId = id; lines.push(`✅ Player ID via natively: ${id}`); }
        } catch (e: any) {
          lines.push(`⛔ natively.getOneSignalId error: ${e.message}`);
        }
      }
      if (!foundId && w.natively.oneSignalId) { foundId = w.natively.oneSignalId; lines.push(`✅ natively.oneSignalId: ${foundId}`); }
      if (!foundId && w.natively.playerId) { foundId = w.natively.playerId; lines.push(`✅ natively.playerId: ${foundId}`); }
    }

    if (!foundId && hasOneSignal) {
      lines.push(`OneSignal keys: ${Object.keys(w.OneSignal).join(", ")}`);
      try {
        if (typeof w.OneSignal.getUserId === "function") {
          const id = await w.OneSignal.getUserId();
          lines.push(`OneSignal.getUserId: ${id}`);
          if (id) { foundId = id; }
        }
        if (!foundId && typeof w.OneSignal.getDeviceState === "function") {
          const state = await w.OneSignal.getDeviceState();
          lines.push(`OneSignal.getDeviceState: ${JSON.stringify(state)}`);
          if (state?.userId) { foundId = state.userId; }
        }
      } catch (e: any) {
        lines.push(`⛔ OneSignal error: ${e.message}`);
      }
    }

    if (w.NativelyFirebaseNotifications) {
      try {
        const fb = new w.NativelyFirebaseNotifications();
        const fbProto = Object.getOwnPropertyNames(Object.getPrototypeOf(fb));
        const fbOwn = Object.keys(fb);
        lines.push(`NativelyFirebaseNotifications methods: ${fbProto.filter((k: string) => k !== "constructor").join(", ") || "none"}`);
        if (fbOwn.length) lines.push(`NativelyFirebaseNotifications props: ${fbOwn.join(", ")}`);
        for (const method of fbProto.filter((k: string) => k !== "constructor")) {
          if (/token|id|device|player|register|subscribe/i.test(method)) {
            try {
              const res = await (fb as any)[method]();
              lines.push(`fb.${method}() => ${JSON.stringify(res)}`);
              const tid = res?.token || res?.deviceToken || res?.id || res?.playerId || res?.oneSignalId;
              if (tid && !foundId) { foundId = tid; lines.push(`✅ Token via fb.${method}: ${tid}`); }
            } catch (e: any) {
              lines.push(`fb.${method}() error: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        lines.push(`⛔ NativelyFirebaseNotifications error: ${e.message}`);
      }
    } else {
      lines.push("NativelyFirebaseNotifications: NOT FOUND");
    }

    if (w.natively?.observers) {
      const obs = w.natively.observers;
      const obsType = typeof obs;
      lines.push(`natively.observers type: ${obsType}`);
      if (obsType === "object" && obs !== null) {
        const obsKeys = Object.keys(obs);
        lines.push(`natively.observers keys: ${obsKeys.join(", ") || "empty"}`);
        for (const k of obsKeys) {
          const v = obs[k];
          let vStr: string;
          try { vStr = typeof v === "function" ? "[fn]" : JSON.stringify(v)?.slice(0, 120) ?? "undefined"; } catch { vStr = "[non-serializable]"; }
          lines.push(`  observers.${k}: ${typeof v} = ${vStr}`);
        }
      }
    } else {
      lines.push("natively.observers: NOT FOUND");
    }

    if (w.nativelyOnLoad !== undefined) {
      lines.push(`nativelyOnLoad type: ${typeof w.nativelyOnLoad}`);
      if (typeof w.nativelyOnLoad === "function") {
        lines.push("nativelyOnLoad is already a function — wrapping to also probe");
        const origOnLoad = w.nativelyOnLoad;
        try {
          const onLoadPromise = new Promise<string>((resolve) => {
            const timeout = setTimeout(() => resolve("__timeout__"), 5000);
            w.nativelyOnLoad = () => {
              try { origOnLoad(); } catch {}
              clearTimeout(timeout);
              if (w.NativelyNotifications) {
                const n2 = new w.NativelyNotifications();
                n2.getOneSignalId((res: any) => {
                  resolve(typeof res === "string" ? res : JSON.stringify(res));
                });
                setTimeout(() => { resolve(n2.id || "__no_id_after_onload__"); }, 3000);
              } else {
                resolve("__no_NativelyNotifications__");
              }
            };
          });
          const onLoadResult = await onLoadPromise;
          if (onLoadResult === "__timeout__") {
            lines.push("nativelyOnLoad: not triggered within 5s (SDK already loaded?)");
          } else {
            lines.push(`nativelyOnLoad probe result: ${onLoadResult}`);
          }
          w.nativelyOnLoad = origOnLoad;
        } catch (e: any) {
          lines.push(`nativelyOnLoad probe error: ${e.message}`);
          w.nativelyOnLoad = origOnLoad;
        }
      } else {
        lines.push(`nativelyOnLoad value: ${typeof w.nativelyOnLoad}`);
      }
    } else {
      lines.push("nativelyOnLoad: NOT FOUND — registering temp handler");
      try {
        const onLoadPromise = new Promise<string>((resolve) => {
          const timeout = setTimeout(() => resolve("__timeout__"), 5000);
          w.nativelyOnLoad = () => {
            clearTimeout(timeout);
            if (w.NativelyNotifications) {
              const n2 = new w.NativelyNotifications();
              n2.getOneSignalId((res: any) => {
                resolve(typeof res === "string" ? res : JSON.stringify(res));
              });
              setTimeout(() => { resolve(n2.id || "__no_id_after_onload__"); }, 3000);
            } else {
              resolve("__no_NativelyNotifications__");
            }
          };
        });
        const onLoadResult = await onLoadPromise;
        if (onLoadResult === "__timeout__") {
          lines.push("nativelyOnLoad handler: not triggered within 5s (SDK already loaded)");
        } else {
          lines.push(`nativelyOnLoad handler result: ${onLoadResult}`);
        }
        delete w.nativelyOnLoad;
      } catch (e: any) {
        lines.push(`nativelyOnLoad handler error: ${e.message}`);
        delete w.nativelyOnLoad;
      }
    }

    if (w.NativelyNotifications) {
      try {
        const notif = new w.NativelyNotifications();
        const notifProto = Object.getOwnPropertyNames(Object.getPrototypeOf(notif));
        const notifOwn = Object.keys(notif);
        lines.push(`NativelyNotifications methods: ${notifProto.filter((k: string) => k !== "constructor").join(", ") || "none"}`);
        if (notifOwn.length) lines.push(`NativelyNotifications props: ${notifOwn.join(", ")}`);

        lines.push(`notif.id BEFORE call: ${JSON.stringify(notif.id)}`);

        const directResult = notif.getOneSignalId();
        lines.push(`getOneSignalId() direct return: ${JSON.stringify(directResult)}`);
        lines.push(`getOneSignalId() return type: ${typeof directResult}`);
        if (directResult && typeof directResult === "object" && typeof directResult.then === "function") {
          lines.push("Return is a Promise — awaiting...");
          try {
            const resolved = await directResult;
            lines.push(`Promise resolved: ${JSON.stringify(resolved)}`);
          } catch (e: any) {
            lines.push(`Promise rejected: ${e.message}`);
          }
        }

        let callbackResult: any = null;
        try {
          const cbPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve("__timeout__"), 5000);
            notif.getOneSignalId((result: any) => {
              clearTimeout(timeout);
              resolve(result);
            });
          });
          callbackResult = await cbPromise;
          if (callbackResult === "__timeout__") {
            lines.push("getOneSignalId(fn callback): not called within 5s");
          } else {
            lines.push(`getOneSignalId(fn callback) result: ${JSON.stringify(callbackResult)}`);
            const cid = callbackResult?.oneSignalId || callbackResult?.playerId || callbackResult?.id || (typeof callbackResult === "string" ? callbackResult : null);
            if (cid) { foundId = cid; lines.push(`✅ Player ID via fn callback: ${cid}`); }
          }
        } catch (e: any) {
          lines.push(`getOneSignalId(fn callback) error: ${e.message}`);
        }

        try {
          const objCbPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve("__timeout__"), 5000);
            notif.getOneSignalId({ callback: (result: any) => {
              clearTimeout(timeout);
              resolve(result);
            }});
          });
          const objCbResult = await objCbPromise;
          if (objCbResult === "__timeout__") {
            lines.push("getOneSignalId({callback}): not called within 5s");
          } else {
            lines.push(`getOneSignalId({callback}) result: ${JSON.stringify(objCbResult)}`);
            const cid2 = (objCbResult as any)?.oneSignalId || (objCbResult as any)?.playerId || (objCbResult as any)?.id || (typeof objCbResult === "string" ? objCbResult : null);
            if (cid2 && !foundId) { foundId = cid2; lines.push(`✅ Player ID via {callback}: ${cid2}`); }
          }
        } catch (e: any) {
          lines.push(`getOneSignalId({callback}) error: ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 3000));
        lines.push(`notif.id AFTER 3s delay: ${JSON.stringify(notif.id)}`);
        const afterKeys = Object.keys(notif);
        const afterVals: Record<string, any> = {};
        for (const k of afterKeys) { try { afterVals[k] = notif[k]; } catch { afterVals[k] = "[error]"; } }
        try { lines.push(`notif props after delay: ${JSON.stringify(afterVals)}`); } catch { lines.push("notif props after delay: [non-serializable]"); }
        if (notif.id && typeof notif.id === "string" && notif.id.length > 10 && !foundId) {
          foundId = notif.id;
          lines.push(`✅ Player ID via notif.id after delay: ${foundId}`);
        }

        if (w.natively?.observers) {
          const obsAfter = Object.keys(w.natively.observers);
          lines.push(`observers keys after calls: ${obsAfter.join(", ") || "empty"}`);
          for (const k of obsAfter) {
            const v = w.natively.observers[k];
            let vStr: string;
            try { vStr = typeof v === "function" ? "[fn]" : typeof v === "string" ? v : JSON.stringify(v)?.slice(0, 120) ?? "undefined"; } catch { vStr = "[non-serializable]"; }
            lines.push(`  observers.${k} = ${vStr}`);
          }
        }

      } catch (e: any) {
        lines.push(`⛔ NativelyNotifications error: ${e.message}`);
      }
    } else {
      lines.push("NativelyNotifications: NOT FOUND");
    }

    if (!foundId) {
      lines.push("⛔ Could not extract player ID from any source");
      lines.push("ℹ️ Also listening for message events (bridge postMessage)...");
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
        {messageLog.length > 0 && (
          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">Bridge Messages Received:</p>
            {messageLog.map((line, i) => (
              <p key={i} className="text-xs font-mono select-text break-all" style={{ userSelect: "text", WebkitUserSelect: "text" }}>{line}</p>
            ))}
          </div>
        )}
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


interface OneSignalStatus {
  email: string | null;
  userId: string;
  onesignalPlayerId: string | null;
  onesignalRegisteredAt: string | null;
  deviceTimezone: string | null;
  lastBridgeProbe: {
    receivedAt: string;
    paths: Array<{
      name: string;
      methodPresent: boolean | null;
      promiseShaped: boolean | null;
      raw: unknown;
      extractedId: string | null;
      error: string | null;
    }>;
    permission: { state: string | null; raw: unknown; source: string | null };
    chosenSource: string | null;
    chosenPlayerId: string | null;
    timezone: string | null;
    userAgent: string | null;
  } | null;
}

function PushRegistrationCard() {
  const { toast } = useToast();
  const { data: status, isLoading, refetch } = useQuery<OneSignalStatus>({
    queryKey: ["/api/dev/onesignal-status"],
  });
  const [reregistering, setReregistering] = useState(false);
  const [reregisterLog, setReregisterLog] = useState<string[]>([]);

  const copy = (value: string) => {
    try {
      navigator.clipboard?.writeText(value);
      toast({ title: "Copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const reregister = async () => {
    setReregistering(true);
    const lines: string[] = [];
    const w = window as any;

    const resolveTimezone = () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return tz && tz.length > 0 ? tz : "UTC";
      } catch { return "UTC"; }
    };

    let chosenId: string | null = null;
    let chosenSource: string | null = null;

    // (0) capture OS push-permission state up front so the inline
    // log explicitly says "granted / denied / not-yet-asked" for
    // this click — not whatever the boot probe last reported. This
    // matters for diagnosing case (c) (OS-level denial) without
    // refetching status from the server.
    try {
      let permLine = "permission: unknown (no detection path)";
      if (w.NativelyNotifications) {
        const n = new w.NativelyNotifications();
        for (const m of [
          "getNotificationPermissionStatus",
          "getPermissionStatus",
          "getPermission",
          "hasPermission",
        ]) {
          if (typeof n?.[m] === "function") {
            try {
              const res: any = await new Promise((resolve) => {
                const t = setTimeout(() => resolve("__timeout__"), 4000);
                let returned: any;
                try {
                  returned = n[m]((cb: any) => { clearTimeout(t); resolve(cb); });
                } catch (e: any) { clearTimeout(t); resolve({ __throw: e?.message ?? String(e) }); return; }
                if (returned && typeof returned.then === "function") {
                  returned.then((v: any) => { clearTimeout(t); resolve(v); }).catch((e: any) => { clearTimeout(t); resolve({ __throw: e?.message ?? String(e) }); });
                }
              });
              const text = typeof res === "string" ? res : JSON.stringify(res);
              permLine = `permission: ${text} (NativelyNotifications.${m})`;
              break;
            } catch (e: any) {
              permLine = `permission: error ${e?.message ?? e} (NativelyNotifications.${m})`;
              break;
            }
          }
        }
      } else if (w.NativelyPush) {
        const p = new w.NativelyPush();
        for (const m of ["getNotificationPermissionStatus", "getPermissionStatus", "hasPermission"]) {
          if (typeof p?.[m] === "function") {
            try {
              const res = await p[m]();
              const text = typeof res === "string" ? res : JSON.stringify(res);
              permLine = `permission: ${text} (NativelyPush.${m})`;
              break;
            } catch (e: any) {
              permLine = `permission: error ${e?.message ?? e} (NativelyPush.${m})`;
              break;
            }
          }
        }
      } else if (w.OneSignal && typeof w.OneSignal.getDeviceState === "function") {
        try {
          const ds = await w.OneSignal.getDeviceState();
          permLine = `permission: ${JSON.stringify(ds)} (OneSignal.getDeviceState)`;
        } catch (e: any) {
          permLine = `permission: error ${e?.message ?? e} (OneSignal.getDeviceState)`;
        }
      }
      lines.push(permLine);
    } catch (e: any) {
      lines.push(`permission: outer error ${e?.message ?? e}`);
    }

    // (a) NativelyNotifications callback
    if (w.NativelyNotifications) {
      try {
        const n = new w.NativelyNotifications();
        if (typeof n.getOneSignalId === "function") {
          const r: any = await new Promise((resolve) => {
            const t = setTimeout(() => resolve("__timeout__"), 6000);
            try { n.getOneSignalId((res: any) => { clearTimeout(t); resolve(res); }); }
            catch (e: any) { clearTimeout(t); resolve({ __throw: e?.message }); }
          });
          lines.push(`NativelyNotifications.getOneSignalId → ${typeof r === "string" ? r : JSON.stringify(r)}`);
          const id = (typeof r === "string" && r) || r?.playerId || r?.oneSignalId || r?.id;
          if (id && typeof id === "string" && id.length > 10) { chosenId = id; chosenSource = "NativelyNotifications"; }
        } else {
          lines.push("NativelyNotifications.getOneSignalId: method missing");
        }
      } catch (e: any) {
        lines.push(`NativelyNotifications error: ${e?.message ?? e}`);
      }
    } else {
      lines.push("NativelyNotifications: not present");
    }

    // (b) NativelyPush promise
    if (!chosenId && w.NativelyPush) {
      try {
        const p = new w.NativelyPush();
        if (typeof p.getOneSignalId === "function") {
          const r: any = await Promise.race([
            p.getOneSignalId(),
            new Promise((res) => setTimeout(() => res("__timeout__"), 6000)),
          ]);
          lines.push(`NativelyPush.getOneSignalId → ${typeof r === "string" ? r : JSON.stringify(r)}`);
          const id = r?.oneSignalId || r?.playerId || r?.id || (typeof r === "string" ? r : null);
          if (id && typeof id === "string" && id.length > 10) { chosenId = id; chosenSource = "NativelyPush"; }
        } else {
          lines.push("NativelyPush.getOneSignalId: method missing");
        }
      } catch (e: any) {
        lines.push(`NativelyPush error: ${e?.message ?? e}`);
      }
    } else if (!chosenId) {
      lines.push("NativelyPush: not present");
    }

    // (c) global OneSignal promise
    if (!chosenId && w.OneSignal && typeof w.OneSignal.getUserId === "function") {
      try {
        const r: any = await Promise.race([
          w.OneSignal.getUserId(),
          new Promise((res) => setTimeout(() => res("__timeout__"), 6000)),
        ]);
        lines.push(`OneSignal.getUserId → ${typeof r === "string" ? r : JSON.stringify(r)}`);
        if (typeof r === "string" && r.length > 10) { chosenId = r; chosenSource = "OneSignal.getUserId"; }
      } catch (e: any) {
        lines.push(`OneSignal.getUserId error: ${e?.message ?? e}`);
      }
    }

    if (!chosenId || !chosenSource) {
      lines.push("⛔ no player id from any bridge path");
      setReregisterLog(lines);
      setReregistering(false);
      // still refetch status so the dev panel reflects the latest state
      try {
        await fetch("/api/dev/onesignal-bridge-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            paths: [],
            permission: { state: null, raw: null, source: null },
            chosenSource: null,
            chosenPlayerId: null,
            timezone: resolveTimezone(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }),
        });
      } catch {}
      refetch();
      return;
    }

    try {
      const resp = await fetch("/api/onesignal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playerId: chosenId,
          source: chosenSource,
          timezone: resolveTimezone(),
        }),
      });
      const body = await resp.text();
      lines.push(`POST /api/onesignal/register → ${resp.status} ${body}`);
      if (resp.ok) {
        // bust the local cache so the boot effect doesn't short-circuit later
        try { localStorage.removeItem(`glukky_onesignal_pid_${status?.userId ?? ""}`); } catch {}
        toast({ title: "Re-registered", description: chosenId.slice(0, 12) + "…" });
      } else {
        toast({ title: "Register failed", description: `${resp.status}`, variant: "destructive" });
      }
    } catch (e: any) {
      lines.push(`register fetch error: ${e?.message ?? e}`);
      toast({ title: "Register error", description: e?.message ?? "unknown", variant: "destructive" });
    }

    setReregisterLog(lines);
    setReregistering(false);
    refetch();
  };

  const playerId = status?.onesignalPlayerId ?? null;
  const probe = status?.lastBridgeProbe ?? null;
  const permissionState = probe?.permission?.state ?? null;
  const permissionPretty =
    permissionState === "granted" ? "granted ✅" :
    permissionState === "denied" || permissionState === "denied-or-not-asked" ? `${permissionState} ⛔` :
    permissionState === "not-yet-asked" ? "not yet asked" :
    permissionState ?? "(no probe yet)";

  return (
    <Card className="border-indigo-200 dark:border-indigo-900">
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Push registration</p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3 space-y-1">
            <p className="text-xs font-mono select-text break-all" data-testid="text-pushreg-email">
              email: {status?.email ?? "(unknown)"}
            </p>
            <div className="flex items-start gap-2">
              <p className="text-xs font-mono select-text break-all flex-1" data-testid="text-pushreg-player-id">
                player_id: {playerId ?? "⛔ NOT REGISTERED"}
              </p>
              {playerId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={() => copy(playerId)}
                  data-testid="button-pushreg-copy-id"
                >
                  Copy
                </Button>
              )}
            </div>
            <p className="text-xs font-mono select-text break-all" data-testid="text-pushreg-registered-at">
              registered_at: {status?.onesignalRegisteredAt ?? "(never)"}
            </p>
            <p className="text-xs font-mono select-text break-all" data-testid="text-pushreg-timezone">
              device_tz: {status?.deviceTimezone ?? "(none)"}
            </p>
            <p className="text-xs font-mono select-text break-all" data-testid="text-pushreg-permission">
              os_push_permission: {permissionPretty}
              {probe?.permission?.source ? ` (${probe.permission.source})` : ""}
            </p>
            <p className="text-xs font-mono select-text break-all" data-testid="text-pushreg-probe-chosen">
              last_probe_chosen: {probe?.chosenSource ?? "(none)"} {probe?.chosenPlayerId ? `→ ${probe.chosenPlayerId.slice(0, 16)}…` : ""}
            </p>
            <p className="text-xs font-mono select-text break-all" data-testid="text-pushreg-probe-at">
              last_probe_at: {probe?.receivedAt ?? "(no probe yet)"}
            </p>
            {probe?.paths?.length ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs font-mono text-indigo-600 dark:text-indigo-300">paths:</p>
                {probe.paths.map((p, i) => (
                  <p key={i} className="text-[10px] font-mono select-text break-all pl-2" data-testid={`text-pushreg-probe-path-${i}`}>
                    • {p.name}: {p.methodPresent === false ? "missing" :
                      p.extractedId ? `id=${p.extractedId.slice(0, 12)}…` :
                      p.error ? `err=${p.error}` :
                      p.promiseShaped === false ? "callback no result" : "no id"}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {reregisterLog.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-1">
            {reregisterLog.map((line, i) => (
              <p key={i} className="text-[10px] font-mono select-text break-all" data-testid={`text-pushreg-relog-${i}`}>{line}</p>
            ))}
          </div>
        )}
        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={reregister}
          disabled={reregistering}
          data-testid="button-pushreg-reregister"
        >
          {reregistering ? "Re-registering…" : "Re-register OneSignal now"}
        </Button>
      </CardContent>
    </Card>
  );
}
