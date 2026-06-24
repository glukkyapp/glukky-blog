import { useState } from "react";
import glukkyLogo from "@assets/Screenshot_2026-05-14_at_21.10.36_1778764249014.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User, Target, LogOut, Settings, Heart, Pencil, Globe, Smile, Type, Trash2, Shield, Download, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";
import { hapticNotify } from "@/lib/haptics";
import { syncOneSignalLanguage } from "@/lib/onesignal-language";
import { isNativelyAvailable } from "@/lib/natively-purchases";
import { useAuth } from "@/hooks/use-auth";
import { useConsent, type ConsentService } from "@/contexts/consent-context";

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
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("profile.diabetes_status")}</span>
          <span data-testid="text-diabetes-status" className="text-sm text-right">
            {profile.healthCondition
              ? t(`profile.condition_${profile.healthCondition}`, { defaultValue: profile.healthCondition })
              : t("profile.condition_unknown")}
          </span>
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

const CONSENT_SERVICE_KEYS_PROFILE: ConsentService[] = ["posthog", "onesignal", "claude"];

function PrivacyCard() {
  const { consentState, updateConsent, isConsentLoaded } = useConsent();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: consentData } = useQuery<{
    consents: Record<string, boolean>;
    consentDetails: Record<string, { consented: boolean; consentedAt: string }>;
    hasSubmitted: boolean;
  }>({ queryKey: ["/api/user/consent"] });

  const handleToggle = async (service: ConsentService, currentValue: boolean) => {
    try {
      await updateConsent(service, !currentValue);
      queryClient.invalidateQueries({ queryKey: ["/api/user/consent"] });
      hapticNotify("SUCCESS");
    } catch {
      hapticNotify("ERROR");
      toast({ title: t("consent.failed_update"), variant: "destructive" });
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return null;
    }
  };

  if (!isConsentLoaded) {
    return (
      <Card data-testid="card-privacy">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">{t("consent.profile_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-privacy">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Shield className="w-5 h-5 text-muted-foreground" />
        <CardTitle className="text-base">{t("consent.profile_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-xs text-muted-foreground -mt-1">
          {t("consent.profile_intro")}
        </p>
        {CONSENT_SERVICE_KEYS_PROFILE.map((key) => {
          const value = consentState[key] ?? false;
          const detail = consentData?.consentDetails?.[key];
          const dateStr = value ? formatDate(detail?.consentedAt) : null;
          return (
            <div key={key} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-tight">{t(`consent.${key}_label`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t(`consent.${key}_desc`)}</p>
                {dateStr && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{t("consent.on_since", { date: dateStr })}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => handleToggle(key, value)}
                data-testid={`toggle-consent-${key}`}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5 ${
                  value ? "bg-[#214B36]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          );
        })}
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

interface CorrectionRequest {
  id: number;
  recordType: string;
  approximateDate: string | null;
  incorrectValue: string | null;
  correctValue: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
}

interface DeletionStatus {
  userId: string;
  requestedAt: string;
  scheduledDeletionAt: string;
  cancelledAt: string | null;
}

function MyDataCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [recordType, setRecordType] = useState("");
  const [approxDate, setApproxDate] = useState("");
  const [incorrectValue, setIncorrectValue] = useState("");
  const [correctValue, setCorrectValue] = useState("");
  const [reason, setReason] = useState("");

  const { data: corrections, refetch: refetchCorrections } = useQuery<CorrectionRequest[]>({
    queryKey: ["/api/user/correction-requests"],
  });

  const correctionMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await apiRequest("POST", "/api/user/correction-request", payload);
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      toast({ title: t("profile.my_data.report_error_toast") });
      setRecordType("");
      setApproxDate("");
      setIncorrectValue("");
      setCorrectValue("");
      setReason("");
      setCorrectionOpen(false);
      refetchCorrections();
    },
    onError: () => {
      hapticNotify("ERROR");
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/user/pdf-export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json() as any;
      const today = new Date().toISOString().split("T")[0];

      const fmt = (v: unknown) => (v == null ? "—" : String(v));
      const fmtDate = (v: unknown) => {
        if (!v) return "—";
        try { return new Date(v as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
        catch { return String(v); }
      };
      const diabetesLabel = (g: string | null) => {
        if (!g) return "—";
        if (g === "t2dm") return "Type 2 Diabetes";
        if (g === "prediabetes") return "Pre-diabetes";
        if (g === "healthy") return "Healthy";
        return g;
      };
      const impactLabel = (v: string | null) => {
        if (!v) return "—";
        return v.charAt(0).toUpperCase() + v.slice(1);
      };

      const foodRows = (data.foodLog ?? [])
        .map((item: any) => `<tr><td>${fmt(item.foodName)}</td><td>${impactLabel(item.glucoseImpact)}</td></tr>`)
        .join("");

      const patternSection = data.foodPattern?.unlocked
        ? `<div class="section"><h2>Food Pattern</h2><table class="info">
            <tr><td class="lbl">Highest Impact Food</td><td>${fmt(data.foodPattern.highestImpactFood)}</td></tr>
            <tr><td class="lbl">Lowest Impact Food</td><td>${fmt(data.foodPattern.lowestImpactFood)}</td></tr>
          </table></div>`
        : "";

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Glukky Health Report – ${today}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:40px}
  h1{font-size:22px;color:#1a5c38;margin-bottom:4px}
  .sub{color:#888;font-size:12px;margin-bottom:28px}
  h2{font-size:14px;font-weight:bold;color:#1a5c38;border-bottom:1.5px solid #1a5c38;padding-bottom:3px;margin:20px 0 10px}
  .section{margin-bottom:24px}
  table.info{width:100%;border-collapse:collapse}
  table.info td{padding:4px 6px;font-size:13px;vertical-align:top}
  table.info td.lbl{width:45%;font-weight:bold;color:#444}
  table.food{width:100%;border-collapse:collapse;font-size:12px}
  table.food th{text-align:left;padding:5px 6px;background:#f0f7f4;color:#1a5c38;font-size:12px}
  table.food td{padding:4px 6px;border-bottom:1px solid #f0f0f0}
  @media print{body{margin:20px}}
</style></head><body>
<h1>Glukky Health Report</h1>
<p class="sub">Generated ${today}</p>

<div class="section"><h2>Personal Information</h2>
<table class="info">
  <tr><td class="lbl">Name</td><td>${fmt(data.name)}</td></tr>
  <tr><td class="lbl">Date of Registration</td><td>${fmtDate(data.registrationDate)}</td></tr>
  <tr><td class="lbl">Diabetes Status</td><td>${diabetesLabel(data.diabetesStatus)}</td></tr>
  <tr><td class="lbl">Latest HbA1c</td><td>${data.hba1cLevel != null ? `${data.hba1cLevel}% (tested ${fmtDate(data.bloodTestDate)})` : "—"}</td></tr>
</table></div>

<div class="section"><h2>Food Log</h2>
<table class="food">
  <thead><tr><th>Food</th><th>Glucose Impact</th></tr></thead>
  <tbody>${foodRows || '<tr><td colspan="2" style="color:#888;font-style:italic">No entries yet.</td></tr>'}</tbody>
</table></div>

${patternSection}
</body></html>`;

      const win = window.open("", "_blank");
      if (!win) throw new Error("Popup blocked");
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 600);
      toast({ title: t("profile.my_data.download_toast") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleCorrectionSubmit = () => {
    if (!recordType || !incorrectValue || !correctValue) return;
    correctionMutation.mutate({
      recordType,
      approximateDate: approxDate || null,
      incorrectValue,
      correctValue,
      reason: reason || null,
    });
  };

  return (
    <Card data-testid="card-my-data">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Download className="w-5 h-5 text-muted-foreground" />
        <CardTitle className="text-base">{t("profile.my_data.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          data-testid="button-download-my-data"
          onClick={handleDownload}
          disabled={downloading}
        >
          <Download className="w-4 h-4" />
          {downloading ? t("profile.my_data.downloading") : t("profile.my_data.download_button")}
        </Button>

        <div className="border rounded-md">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
            data-testid="button-toggle-correction-form"
            onClick={() => setCorrectionOpen(prev => !prev)}
          >
            <span>{t("profile.my_data.report_error_title")}</span>
            {correctionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {correctionOpen && (
            <div className="px-3 pb-3 space-y-2 border-t pt-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("profile.my_data.report_error_label")}</label>
                <Select value={recordType} onValueChange={setRecordType}>
                  <SelectTrigger data-testid="select-record-type" className="text-sm">
                    <SelectValue placeholder={t("profile.my_data.report_error_label")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meal">{t("profile.my_data.record_meal")}</SelectItem>
                    <SelectItem value="walk">{t("profile.my_data.record_walk")}</SelectItem>
                    <SelectItem value="report">{t("profile.my_data.record_report")}</SelectItem>
                    <SelectItem value="profile">{t("profile.my_data.record_profile")}</SelectItem>
                    <SelectItem value="other">{t("profile.my_data.record_other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("profile.my_data.approx_date_label")}</label>
                <Input
                  type="date"
                  value={approxDate}
                  onChange={e => setApproxDate(e.target.value)}
                  className="text-sm"
                  data-testid="input-correction-date"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("profile.my_data.incorrect_label")}</label>
                <Textarea
                  value={incorrectValue}
                  onChange={e => setIncorrectValue(e.target.value)}
                  className="text-sm min-h-[60px]"
                  data-testid="input-correction-incorrect"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("profile.my_data.correct_label")}</label>
                <Textarea
                  value={correctValue}
                  onChange={e => setCorrectValue(e.target.value)}
                  className="text-sm min-h-[60px]"
                  data-testid="input-correction-correct"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("profile.my_data.reason_label")}</label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="text-sm min-h-[50px]"
                  data-testid="input-correction-reason"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                data-testid="button-submit-correction"
                onClick={handleCorrectionSubmit}
                disabled={correctionMutation.isPending || !recordType || !incorrectValue || !correctValue}
              >
                {correctionMutation.isPending ? t("profile.my_data.report_error_submitting") : t("profile.my_data.report_error_submit")}
              </Button>

              {corrections && corrections.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("profile.my_data.past_submissions")}</p>
                  {corrections.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs border rounded px-2 py-1" data-testid={`correction-item-${c.id}`}>
                      <span className="text-muted-foreground">{c.recordType} · {new Date(c.createdAt).toLocaleDateString()}</span>
                      <Badge variant={c.status === "resolved" ? "default" : "secondary"} className="text-[10px]">
                        {c.status === "resolved" ? t("profile.my_data.status_resolved") : t("profile.my_data.status_pending")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

  const { data: deletionStatus } = useQuery<DeletionStatus | null>({
    queryKey: ["/api/user/deletion-status"],
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/account/cancel");
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/user/deletion-status"] });
      toast({ title: t("profile.delete_account.cancel_toast_success") });
    },
    onError: () => {
      hapticNotify("ERROR");
      toast({ title: t("profile.delete_account.cancel_toast_error"), variant: "destructive" });
    },
  });

  const [showImmediateDeleteDialog, setShowImmediateDeleteDialog] = useState(false);

  const immediateDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/account/delete-immediately");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to delete account");
      }
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      window.location.href = "/?tab=register";
    },
    onError: () => {
      hapticNotify("ERROR");
      toast({ title: t("profile.delete_account.immediate_toast_error"), variant: "destructive" });
    },
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

      {deletionStatus && (
        <div
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mt-2 mb-4"
          data-testid="banner-deletion-pending"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            {t("profile.delete_account.pending_banner", {
              date: new Date(deletionStatus.scheduledDeletionAt).toLocaleDateString(),
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100 h-7 text-xs"
            data-testid="button-cancel-deletion"
            disabled={cancelDeletionMutation.isPending}
            onClick={() => cancelDeletionMutation.mutate()}
          >
            {t("profile.delete_account.cancel_deletion")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700 hover:bg-red-100 hover:text-red-800 h-7 text-xs px-2"
            data-testid="button-delete-immediately"
            disabled={immediateDeleteMutation.isPending}
            onClick={() => setShowImmediateDeleteDialog(true)}
          >
            {t("profile.delete_account.immediate_button")}
          </Button>
        </div>
      )}

      <AlertDialog open={showImmediateDeleteDialog} onOpenChange={setShowImmediateDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-immediate-delete-title">
              {t("profile.delete_account.immediate_title")}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-immediate-delete-description">
              {t("profile.delete_account.immediate_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-immediate-delete-cancel">
              {t("profile.delete_account.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-immediate-delete-confirm"
              disabled={immediateDeleteMutation.isPending}
              onClick={() => immediateDeleteMutation.mutate()}
            >
              {immediateDeleteMutation.isPending
                ? "…"
                : t("profile.delete_account.immediate_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <PrivacyCard />

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


      <MyDataCard />

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
        {!deletionStatus && (
          <Button
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            data-testid="button-delete-account"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            {t("profile.delete_account.button")}
          </Button>
        )}
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
                    queryClient.invalidateQueries({ queryKey: ["/api/user/deletion-status"] });
                    toast({ title: t("profile.delete_account.toast_success") });
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
