import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Clock, Calendar, Database, ChevronLeft, Trash2, Eye } from "lucide-react";
import { useLocation } from "wouter";
import {
  getMonthlyPriceDetails,
  type NativelyPurchasesInstance,
  getCurrentAppUserId,
  getCustomerInfo,
  ensureIdentified,
  isIdentityReadyFor,
  subscribeIdentity,
  isNativelyAvailable,
} from "@/lib/natively-purchases";

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

      <BuildInfoCard />

      <RevenueCatDiagnosticsCard />

      <NativelyPurchasesProbeCard />

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

function NativelyPurchasesProbeCard() {
  const [status, setStatus] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);

  const probe = async () => {
    setProbing(true);
    const lines: string[] = [];

    const hasClass = typeof window.NativelyPurchases === "function";
    lines.push(`NativelyPurchases: ${hasClass ? "YES" : "NO"}`);

    if (!hasClass || !window.NativelyPurchases) {
      lines.push("⛔ NativelyPurchases not found (not in mobile wrapper or RevenueCat not configured)");
    } else {
      let p: NativelyPurchasesInstance | null = null;
      try {
        p = new window.NativelyPurchases();
        lines.push("✅ NativelyPurchases instantiated");

        const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(p)).filter((k: string) => k !== "constructor");
        lines.push(`Methods: ${proto.join(", ") || "none"}`);
        lines.push(`getOfferings present: ${typeof p.getOfferings === "function" ? "YES" : "NO"}`);

        try {
          const info = await new Promise<Record<string, unknown> | null>((resolve) => {
            const timeout = setTimeout(() => resolve({ _timeout: true }), 8000);
            p!.getCustomerInfo((res) => { clearTimeout(timeout); resolve(res as Record<string, unknown> | null); });
          });
          lines.push(`getCustomerInfo: ${JSON.stringify(info)?.slice(0, 200)}`);
          const subs = (info as Record<string, unknown>)?.activeSubscriptions as string[] || [];
          const entActive = ((info as Record<string, unknown>)?.entitlements as Record<string, unknown>)?.active as Record<string, unknown> | undefined;
          const ent = entActive ? Object.keys(entActive) : [];
          lines.push(`Active subs: ${subs.length > 0 ? subs.join(", ") : "none"}`);
          lines.push(`Active entitlements: ${ent.length > 0 ? ent.join(", ") : "none"}`);
          lines.push(subs.length > 0 || ent.length > 0 ? "✅ PREMIUM" : "⛔ NOT PREMIUM");
        } catch (e: unknown) {
          lines.push(`⛔ getCustomerInfo error: ${e instanceof Error ? e.message : "unknown"}`);
        }
      } catch (e: unknown) {
        lines.push(`⛔ Instantiation error: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    // ----- Pricing probe -----
    lines.push("— Pricing —");
    try {
      const result = await getMonthlyPriceDetails();
      lines.push(`source: ${result.source}`);
      lines.push(`priceString: ${result.priceString === null ? "null" : JSON.stringify(result.priceString)}`);
      lines.push(`duration: ${result.durationMs}ms`);
      if (result.errorMessage) {
        lines.push(`error: ${result.errorMessage}`);
      }
      if (result.rawOfferings !== undefined) {
        const cur = result.rawOfferings?.current ?? null;
        const monthlyDirect = cur?.monthly?.product?.priceString;
        const pkgs = cur?.availablePackages || [];
        lines.push(`current: ${cur ? "present" : "null"}`);
        lines.push(`current.monthly.priceString: ${monthlyDirect === undefined ? "(missing)" : JSON.stringify(monthlyDirect)}`);
        lines.push(`availablePackages: ${pkgs.length}`);
        for (const pkg of pkgs.slice(0, 6)) {
          const id = pkg?.identifier ?? "?";
          const type = pkg?.packageType ?? "?";
          const ps = pkg?.product?.priceString;
          lines.push(`  • [${type}] ${id} → ${ps === undefined ? "(no priceString)" : JSON.stringify(ps)}`);
        }
        const raw = JSON.stringify(result.rawOfferings);
        lines.push(`raw: ${raw.length > 240 ? raw.slice(0, 240) + "…" : raw}`);
      }
    } catch (e: unknown) {
      lines.push(`⛔ price probe error: ${e instanceof Error ? e.message : "unknown"}`);
    }

    setStatus(lines);
    setProbing(false);
  };

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">NativelyPurchases Debug</p>
        {status.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 space-y-1">
            {status.map((line, i) => (
              <p key={i} className="text-xs font-mono select-text break-all" style={{ userSelect: "text", WebkitUserSelect: "text" }} data-testid={`text-purchases-debug-${i}`}>{line}</p>
            ))}
          </div>
        )}
        <Button
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          onClick={probe}
          disabled={probing}
          data-testid="button-purchases-probe"
        >
          {probing ? "Probing..." : "Probe NativelyPurchases"}
        </Button>
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

interface AuthUserResp { id?: string; email?: string }
interface RcConfigResp { keyPresent?: boolean }
interface RefreshResp {
  verifiedPremium?: boolean;
  isPremium?: boolean;
  verificationSource?: string;
  transient?: boolean;
}

function RevenueCatDiagnosticsCard() {
  const { data: authUser } = useQuery<AuthUserResp | null>({ queryKey: ["/api/auth/user"] });
  const { data: rcConfig } = useQuery<RcConfigResp>({ queryKey: ["/api/dev/revenuecat-config"] });

  const replitUserId = authUser?.id ?? null;
  const bridgePresent = isNativelyAvailable();
  const [bridgeAppUserId, setBridgeAppUserId] = useState<string | null>(null);
  const [bridgeAppUserIdProbed, setBridgeAppUserIdProbed] = useState(false);
  const [identityReady, setIdentityReady] = useState<boolean>(() => isIdentityReadyFor(replitUserId || undefined));
  const [activeEntitlements, setActiveEntitlements] = useState<string[] | null>(null);
  const [activeSubs, setActiveSubs] = useState<string[] | null>(null);
  const [lastRefresh, setLastRefresh] = useState<RefreshResp | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reprobing, setReprobing] = useState(false);

  // Subscribe to identity readiness changes so the panel reflects the
  // exact state used by the paywall's subscribe gate.
  useEffect(() => {
    const update = () => setIdentityReady(isIdentityReadyFor(replitUserId || undefined));
    update();
    return subscribeIdentity(update);
  }, [replitUserId]);

  const probeBridge = async () => {
    setReprobing(true);
    try {
      const id = await getCurrentAppUserId();
      setBridgeAppUserId(id);
      setBridgeAppUserIdProbed(true);
      const info = await getCustomerInfo();
      const subs = info?.activeSubscriptions || [];
      const ent = info?.entitlements?.active ? Object.keys(info.entitlements.active) : [];
      setActiveSubs(subs);
      setActiveEntitlements(ent);
    } finally {
      setReprobing(false);
    }
  };

  useEffect(() => { probeBridge(); }, []);

  const callRefresh = async () => {
    setRefreshing(true);
    try {
      const resp = await fetch("/api/refresh-premium-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force: true }),
      });
      const data = (await resp.json()) as RefreshResp;
      setLastRefresh(data);
    } catch (e: any) {
      setLastRefresh({ verificationSource: `error: ${e?.message ?? "unknown"}` });
    } finally {
      setRefreshing(false);
    }
  };

  const triggerLogIn = async () => {
    if (!replitUserId) return;
    await ensureIdentified(replitUserId);
    await probeBridge();
  };

  const idMatch =
    bridgeAppUserId !== null && replitUserId !== null && bridgeAppUserId === replitUserId;

  return (
    <Card className="border-cyan-200 dark:border-cyan-900">
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">RevenueCat Diagnostics</p>
        <div className="bg-cyan-50 dark:bg-cyan-950 rounded-lg p-3 space-y-1">
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-bridge-present">
            Bridge present: {bridgePresent ? "YES" : "NO (web preview)"}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-replit-user-id">
            Replit user id: {replitUserId ?? "(not signed in)"}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-bridge-user-id">
            RC app-user-id (bridge): {bridgeAppUserIdProbed
              ? (bridgeAppUserId ?? (bridgePresent ? "(bridge does not expose)" : "(no bridge)"))
              : "(probing…)"}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-id-match">
            Match: {bridgeAppUserId === null ? "(unknown)" : idMatch ? "✅ YES" : "⛔ NO"}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-identity-ready">
            logIn ready: {identityReady ? "YES" : "NO"}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-environment">
            RC environment: (unknown — bridge does not expose sandbox/prod)
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-active-entitlements">
            Active entitlements: {activeEntitlements === null ? "(probing…)" : activeEntitlements.length === 0 ? "none" : activeEntitlements.join(", ")}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-active-subs">
            Active subscriptions: {activeSubs === null ? "(probing…)" : activeSubs.length === 0 ? "none" : activeSubs.join(", ")}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-server-key-present">
            Server RC API key: {rcConfig?.keyPresent === undefined ? "(loading…)" : rcConfig.keyPresent ? "✅ present" : "⛔ missing"}
          </p>
          <p className="text-xs font-mono select-text break-all" data-testid="text-rc-last-refresh">
            Last /refresh-premium-status: {lastRefresh
              ? `verifiedPremium=${String(lastRefresh.verifiedPremium ?? lastRefresh.isPremium)} source=${lastRefresh.verificationSource ?? "?"} transient=${String(lastRefresh.transient ?? false)}`
              : "(not called yet)"}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            onClick={probeBridge}
            disabled={reprobing}
            data-testid="button-rc-reprobe"
          >
            {reprobing ? "Probing…" : "Re-probe bridge"}
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={triggerLogIn}
            disabled={!replitUserId}
            data-testid="button-rc-login"
          >
            Force RC logIn
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={callRefresh}
            disabled={refreshing}
            data-testid="button-rc-refresh"
          >
            {refreshing ? "Calling…" : "Call /refresh-premium-status (force)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
