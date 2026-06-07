import { useState } from "react";
import glukkyLogo from "@assets/Screenshot_2026-05-14_at_21.10.36_1778764249014.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User, Target, LogOut, Settings, Heart, Pencil, Globe, Smile, Type, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";
import { hapticNotify } from "@/lib/haptics";
import { syncOneSignalLanguage } from "@/lib/onesignal-language";
import { isNativelyAvailable, restorePurchases, getCachedLoginState } from "@/lib/natively-purchases";
import { Crown, RotateCcw, Loader2 } from "lucide-react";
import { getInstallId, recordRestoreTrace } from "@/lib/restore-trace";
import { useAuth } from "@/hooks/use-auth";

interface ProfileData {
  name: string | null;
  goal: string | null;
  walksPerWeek: number;
  walkDuration: number;
  dinnerTime: string;
  sleepPattern: string;
  eatingOutFrequency: string;
  struggles: string[];
  hasLateDinner: boolean;
  dinnerMastered: boolean;
  notificationEmail: string;
  hba1cLevel: number | null;
  bloodTestDate: string | null;
  preferredLanguage: string;
}

interface RoadmapData {
  activeStruggle: string | null;
  currentTip: string | null;
  isDinnerFocus: boolean;
  tipLadders: Record<string, unknown>;
}

function ProfileSkeleton() {
  return (
    <div className="app-page-v2 max-w-sm mx-auto px-4 pt-6 pb-24 space-y-2" data-testid="profile-skeleton">
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}

function translateDietTip(tip: string, t: (key: string, opts?: any) => string): string {
  const i18nKey = DIET_TIP_I18N_KEYS[tip];
  return i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
}

function HealthMarkersCard({ profile }: { profile: ProfileData }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingHba1c, setEditingHba1c] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [hba1cValue, setHba1cValue] = useState(profile.hba1cLevel?.toString() ?? "");
  const [dateValue, setDateValue] = useState(profile.bloodTestDate ?? "");

  const mutation = useMutation({
    mutationFn: async (data: { hba1cLevel?: number | null; bloodTestDate?: string | null }) => {
      const res = await apiRequest("PATCH", "/api/profile/health-markers", data);
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Health markers saved" });
    },
    onError: () => {
      hapticNotify("ERROR");
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const saveHba1c = () => {
    if (!editingHba1c) return;
    setEditingHba1c(false);
    const parsed = parseFloat(hba1cValue);
    const value = isNaN(parsed) ? null : parsed;
    mutation.mutate({ hba1cLevel: value });
  };

  const saveDate = () => {
    if (!editingDate) return;
    setEditingDate(false);
    const value = dateValue || null;
    mutation.mutate({ bloodTestDate: value });
  };

  return (
    <Card data-testid="card-health-markers">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Heart className="w-5 h-5 text-muted-foreground" />
        <CardTitle className="text-base">{t("profile.health_markers")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("profile.hba1c_level")}</span>
          {editingHba1c ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.1"
                className="w-20 h-7 text-sm"
                value={hba1cValue}
                onChange={(e) => setHba1cValue(e.target.value)}
                onBlur={saveHba1c}
                onKeyDown={(e) => e.key === "Enter" && saveHba1c()}
                autoFocus
                data-testid="input-hba1c"
              />
              <span className="text-xs">%</span>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
              onClick={() => { setEditingHba1c(true); setHba1cValue(profile.hba1cLevel?.toString() ?? ""); }}
              data-testid="button-edit-hba1c"
            >
              {profile.hba1cLevel != null ? `${profile.hba1cLevel}%` : t("profile.tap_to_add")}
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("profile.last_blood_test")}</span>
          {editingDate ? (
            <Input
              type="date"
              className="w-36 h-7 text-sm"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              onBlur={saveDate}
              autoFocus
              data-testid="input-blood-test-date"
            />
          ) : (
            <button
              className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
              onClick={() => { setEditingDate(true); setDateValue(profile.bloodTestDate ?? ""); }}
              data-testid="button-edit-blood-test-date"
            >
              {profile.bloodTestDate ?? t("profile.tap_to_add")}
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "zh-Hant", label: "繁中" },
  { code: "yue", label: "粵語" },
];

function LanguageCard({ currentLang }: { currentLang: string }) {
  const { t } = useTranslation();

  const langMutation = useMutation({
    mutationFn: async (lang: string) => {
      const res = await apiRequest("PATCH", "/api/profile/language", { preferredLanguage: lang });
      return res.json();
    },
    onSuccess: (_data, lang) => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      syncOneSignalLanguage(lang);
    },
    onError: () => {
      hapticNotify("ERROR");
    },
  });

  const handleLangChange = (lang: string) => {
    i18n.changeLanguage(lang);
    langMutation.mutate(lang);
  };

  return (
    <Card data-testid="card-language">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Globe className="w-5 h-5 text-muted-foreground" />
        <CardTitle className="text-base">{t("profile.language")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {LANG_OPTIONS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => handleLangChange(code)}
              data-testid={`button-lang-${code}`}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                currentLang === code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-[#F4EBE4] text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FontSizeCard({ currentSize }: { currentSize: string }) {
  const { t } = useTranslation();

  const fontSizeMutation = useMutation({
    mutationFn: async (size: string) => {
      const res = await apiRequest("PATCH", "/api/profile/font-size", { fontSizePreference: size });
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: () => {
      hapticNotify("ERROR");
    },
  });

  return (
    <Card data-testid="card-font-size">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Type className="w-5 h-5 text-muted-foreground" />
        <CardTitle className="text-base">{t("profile.font_size")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <button
            onClick={() => { fontSizeMutation.mutate("small"); }}
            data-testid="button-font-small"
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
              currentSize === "small"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-[#F4EBE4] text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {t("profile.font_small")}
          </button>
          <button
            onClick={() => { fontSizeMutation.mutate("large"); }}
            data-testid="button-font-large"
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
              currentSize === "large"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-[#F4EBE4] text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {t("profile.font_large")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function NameGoalCard({ profile }: { profile: ProfileData }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [nameValue, setNameValue] = useState(profile.name ?? "");
  const [goalValue, setGoalValue] = useState(profile.goal ?? "");

  const mutation = useMutation({
    mutationFn: async (data: { name?: string | null; goal?: string | null }) => {
      const res = await apiRequest("PATCH", "/api/profile/name-goal", data);
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: () => {
      hapticNotify("ERROR");
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const saveName = () => {
    if (!editingName) return;
    setEditingName(false);
    mutation.mutate({ name: nameValue.trim() || null });
  };

  const saveGoal = () => {
    if (!editingGoal) return;
    setEditingGoal(false);
    mutation.mutate({ goal: goalValue.trim() || null });
  };

  return (
    <Card data-testid="card-name-goal">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Smile className="w-5 h-5 text-muted-foreground" />
        <CardTitle className="text-base">{t("profile.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("profile.your_name")}</span>
          {editingName ? (
            <Input
              type="text"
              className="w-36 h-7 text-sm"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
              data-testid="input-profile-name"
            />
          ) : (
            <button
              className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
              onClick={() => { setEditingName(true); setNameValue(profile.name ?? ""); }}
              data-testid="button-edit-name"
            >
              {profile.name ?? t("profile.tap_to_add_name")}
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground shrink-0">{t("profile.your_goal")}</span>
          {editingGoal ? (
            <Textarea
              className="w-44 text-sm min-h-[60px]"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              onBlur={saveGoal}
              autoFocus
              data-testid="input-profile-goal"
            />
          ) : (
            <button
              className="flex items-center gap-1 text-sm hover:text-primary transition-colors text-right"
              onClick={() => { setEditingGoal(true); setGoalValue(profile.goal ?? ""); }}
              data-testid="button-edit-goal"
            >
              <span className="text-right">{profile.goal ?? t("profile.tap_to_add_goal")}</span>
              <Pencil className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
  });

  const { data: roadmap, isLoading: roadmapLoading } = useQuery<RoadmapData>({
    queryKey: ["/api/roadmap"],
  });

  const { data: devCheck } = useQuery<{ isDev: boolean }>({
    queryKey: ["/api/dev/check"],
  });

  const isLoading = profileLoading || roadmapLoading;

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const STRUGGLE_NAMES: Record<string, string> = {
    sugary_food_drink: t("struggle.sugary_food_drink"),
    oily_fried_food: t("struggle.oily_fried_food"),
    eat_out: t("struggle.eat_out"),
    portions: t("struggle.portions"),
    snacks: t("struggle.snacks"),
  };

  const dinnerLabel = profile?.hasLateDinner ? t("profile.dinner_after_9pm") : t("profile.dinner_before_9pm");
  const walkDuration = profile?.walkDuration ?? 0;
  const walkDurationDisplay = walkDuration < 5 ? t("profile.walk_not_set") : t("profile.walk_min_each", { duration: walkDuration });
  const walksPerWeek = profile?.walksPerWeek ?? 0;
  const currentLang = profile?.preferredLanguage || "en";

  return (
    <div className="app-page-v2 max-w-sm mx-auto px-4 pt-6 pb-24 space-y-2" data-testid="profile-page">
      <h1 className="text-[26px] font-bold uppercase tracking-wide" data-testid="text-profile-heading">{t("profile.title")}</h1>

      {profile && <NameGoalCard profile={profile} />}

      <Card data-testid="card-diabetes-profile" className="hidden">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">{t("profile.diabetes_profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-walks">
            <span className="text-muted-foreground">{t("profile.post_meal_walks")}</span>{" "}
            {walksPerWeek > 0
              ? t("profile.walks_per_week", { count: walksPerWeek, duration: walkDurationDisplay })
              : t("profile.no_walks")}
          </p>
          <p data-testid="text-dinner-time">
            <span className="text-muted-foreground">{t("profile.dinner_time")}</span> {dinnerLabel}
          </p>
          <p data-testid="text-sleep-pattern">
            <span className="text-muted-foreground">{t("profile.sleep_pattern")}</span>{" "}
            {t(`profile.sleep_${profile?.sleepPattern ?? ""}`, { defaultValue: profile?.sleepPattern ?? "N/A" })}
          </p>
          <p data-testid="text-eating-out">
            <span className="text-muted-foreground">{t("profile.eating_out")}</span>{" "}
            {(() => {
              const num = parseInt(profile?.eatingOutFrequency ?? "0", 10);
              if (isNaN(num) || num === 0) return t("profile.eating_out_rarely");
              if (num === 1) return t("profile.eating_out_once");
              return t("profile.eating_out_times", { count: num });
            })()}
          </p>
        </CardContent>
      </Card>

      {profile && <HealthMarkersCard profile={profile} />}

      <LanguageCard currentLang={currentLang} />

      <FontSizeCard currentSize={(profile as any)?.fontSizePreference || "large"} />

      <Card data-testid="card-current-focus">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Target className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">{t("profile.current_focus")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-focus-area" className="font-medium">
            {roadmap?.isDinnerFocus
              ? t("profile.late_dinner_timing")
              : STRUGGLE_NAMES[roadmap?.activeStruggle ?? ""] ?? roadmap?.activeStruggle ?? "N/A"}
          </p>
          {roadmap?.currentTip && (
            <p data-testid="text-current-tip" className="text-muted-foreground">
              {translateDietTip(roadmap.currentTip, t)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-1 py-5">
        <img src={glukkyLogo} alt="Glukky" className="w-1/3 object-contain" />
        <p className="text-[11px] text-muted-foreground text-center">
          Copyright © 2026 Glukky. All rights reserved.
        </p>
      </div>

      {devCheck?.isDev && (
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
            data-testid="button-dev-panel"
            onClick={() => setLocation("/dev")}
          >
            <Settings className="w-4 h-4" />
            Dev Panel
          </Button>
        </div>
      )}

      {isNativelyAvailable() && (
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full"
            data-testid="button-restore-purchases"
            disabled={restoreBusy}
            onClick={async () => {
              if (restoreBusy) return;
              setRestoreBusy(true);
              hapticNotify("SUCCESS");
              const replitUserId = user?.id ?? null;
              const replitEmail = user?.email ?? null;
              recordRestoreTrace("button_tap", { replitUserId });
              // Snapshot the RC login gate BEFORE we touch the bridge
              // so a server-side trace can tell whether the restore
              // ran against an already-settled RC subscriber, an
              // in-flight login, or no login at all (the
              // `NO_LOGIN_PENDING` race we just closed below).
              const preLoginState = getCachedLoginState();
              recordRestoreTrace("pre_restore_login_state", {
                rcUserId: preLoginState.userId,
                pending: preLoginState.pending,
                lastLoginStatus: preLoginState.result?.status ?? null,
                lastLoginCustomerId: preLoginState.result?.customerId ?? null,
                replitUserId,
              });
              try {
                // Bridge wrapper enforces a stricter login gate (8s
                // bounded wait for `loginToRevenueCat` to actually
                // return SUCCESS) for the restore path only — paywall
                // present calls keep the looser best-effort gate so a
                // transient login hiccup doesn't break new purchases.
                // Pass the Replit identity so the wrapper can
                // self-initiate `loginToRevenueCat` if the App.tsx
                // identity effect hasn't run yet (closes the
                // `NO_LOGIN_PENDING` race when Restore is tapped in
                // the same tick as a fresh sign-in).
                const result = await restorePurchases({
                  userId: replitUserId ?? undefined,
                  email: replitEmail ?? undefined,
                });
                recordRestoreTrace("bridge_result", {
                  success: result.success,
                  reason: result.reason ?? null,
                  customerId: result.customerId ?? null,
                  error: result.error ?? null,
                });

                // Identity / login problems must surface a different
                // toast than App Store / bridge problems — otherwise
                // "Restore does nothing" gets misattributed every time.
                if (!result.success) {
                  hapticNotify("ERROR");
                  if (
                    result.reason === "LOGIN_FAILED" ||
                    result.reason === "LOGIN_TIMEOUT" ||
                    result.reason === "NO_LOGIN_PENDING"
                  ) {
                    toast({
                      title: t("paywall.restore_identity_title"),
                      description: t("paywall.restore_identity_desc"),
                      variant: "destructive",
                    });
                  } else if (
                    result.reason === "BRIDGE_MISSING" ||
                    result.reason === "BRIDGE_TIMEOUT" ||
                    result.reason === "BRIDGE_ERROR"
                  ) {
                    toast({
                      title: t("paywall.restore_bridge_title"),
                      description: t("paywall.restore_bridge_desc"),
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: t("paywall.restore_none_title"),
                      description: t("paywall.restore_none_desc"),
                      variant: "destructive",
                    });
                  }
                  return;
                }

                // Bridge said SUCCESS — verify against the server with
                // the bridge-reported customerId, which lets the server
                // self-heal a delete-and-reinstall when the RC dashboard
                // Restore Behavior knob is misconfigured.
                let verified = false;
                let selfHealOutcome: string | undefined;
                let verificationSource: string | undefined;
                try {
                  const body: Record<string, unknown> = { force: true };
                  if (result.customerId) body.customerId = result.customerId;
                  const resp = await fetch("/api/refresh-premium-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(body),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    verified = Boolean(data?.verifiedPremium ?? data?.isPremium);
                    selfHealOutcome = data?.selfHealOutcome;
                    verificationSource = data?.verificationSource;
                  }
                } catch (e) {
                  console.warn("[restore] verify error:", e);
                }
                recordRestoreTrace("verify_result", {
                  verified,
                  verificationSource: verificationSource ?? null,
                  selfHealOutcome: selfHealOutcome ?? null,
                });

                if (verified) {
                  queryClient.refetchQueries({ queryKey: ["/api/profile"] });
                  queryClient.refetchQueries({ queryKey: ["/api/gate-status"] });
                  hapticNotify("SUCCESS");
                  toast({
                    title: t("paywall.restore_success_title"),
                  });
                } else {
                  hapticNotify("ERROR");
                  toast({
                    title: t("paywall.restore_none_title"),
                    description: t("paywall.restore_none_desc"),
                    variant: "destructive",
                  });
                }
              } finally {
                setRestoreBusy(false);
              }
            }}
          >
            {restoreBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("paywall.restore_in_progress")}
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                {t("paywall.restore")}
              </>
            )}
          </Button>
        </div>
      )}

      <div className="pt-4">
        <Button
          variant="outline"
          className="w-full"
          data-testid="button-logout"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.href = "/";
          }}
        >
          <LogOut className="w-4 h-4" />
          {t("profile.log_out")}
        </Button>
      </div>

      <div className="pt-2 pb-6">
        <Button
          variant="outline"
          className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
          data-testid="button-delete-account"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          {t("profile.delete_account.button")}
        </Button>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-account" className="max-h-[85vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="text-delete-account-title">
                {t("profile.delete_account.title")}
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="text-delete-account-intro">
                {t("profile.delete_account.intro")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">
                  {t("profile.delete_account.wiped_heading")}
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>{t("profile.delete_account.wiped_profile")}</li>
                  <li>{t("profile.delete_account.wiped_reports")}</li>
                  <li>{t("profile.delete_account.wiped_history")}</li>
                  <li>{t("profile.delete_account.wiped_glucose")}</li>
                  <li>{t("profile.delete_account.wiped_push")}</li>
                </ul>
              </div>
              <p>{t("profile.delete_account.no_restore")}</p>
              <p>{t("profile.delete_account.timing")}</p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-delete-account-cancel">
                {t("profile.delete_account.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid="button-delete-account-confirm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/auth/delete-account", {
                      method: "POST",
                      credentials: "include",
                    });
                    if (!res.ok) throw new Error("Failed");
                    // Atomic client-side cleanup: drop every cached query
                    // result, then wipe every glukky_* key from local and
                    // session storage, BEFORE the redirect. This stops a
                    // briefly-rendered authenticated UI on the new page
                    // and prevents stale flags (session hint, OneSignal
                    // player id, language pref, info-card-seen markers)
                    // from leaking across to the next account that signs
                    // in on this same browser/device.
                    try { queryClient.clear(); } catch {}
                    const wipeStorage = (store: Storage) => {
                      try {
                        const keys: string[] = [];
                        for (let i = 0; i < store.length; i++) {
                          const k = store.key(i);
                          if (k && k.startsWith("glukky_")) keys.push(k);
                        }
                        for (const k of keys) store.removeItem(k);
                      } catch {}
                    };
                    wipeStorage(localStorage);
                    wipeStorage(sessionStorage);
                    toast({ title: t("profile.delete_account.toast_success") });
                    setTimeout(() => {
                      window.location.assign("/");
                    }, 150);
                  } catch {
                    toast({
                      title: t("profile.delete_account.toast_error"),
                      variant: "destructive",
                    });
                  }
                }}
              >
                {t("profile.delete_account.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="mt-3 text-center text-xs text-muted-foreground">
          <p>{t("profile.delete_account.fallback_label")}</p>
          <a
            href="https://support-url-generator.com/account-deletion/0_5Am9FfYJ7e"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-primary hover:text-primary/80"
            data-testid="link-delete-account-fallback"
          >
            {t("profile.delete_account.fallback_link_text")}
          </a>
        </div>
      </div>
    </div>
  );
}
