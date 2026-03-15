import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User, Target, Download, LogOut, Settings, Heart, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STRUGGLE_NAMES: Record<string, string> = {
  sugary_food_drink: "Sugary Food & Drinks",
  oily_fried_food: "Oily/Fried Food",
  eat_out: "Eating Out",
  portions: "Portion Control",
  snacks: "Snacking",
};

const SLEEP_LABELS: Record<string, string> = {
  regular_10_6: "Regular (10pm–6am)",
  other_regular: "Other regular schedule",
  night_shifts: "Night shifts",
  irregular: "Irregular",
};

interface ProfileData {
  walksPerWeek: number;
  walkDuration: number;
  dinnerTime: string;
  sleepPattern: string;
  eatingOutFrequency: string;
  struggles: string[];
  currentStruggle: string;
  hasLateDinner: boolean;
  dinnerMastered: boolean;
  notificationEmail: string;
  hba1cLevel: number | null;
  bloodTestDate: string | null;
}

interface RoadmapData {
  currentStruggle: string;
  currentTip: string;
  isDinnerFocus: boolean;
  struggles: string[];
  tipLadders: Record<string, unknown>;
}

function ProfileSkeleton() {
  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4" data-testid="profile-skeleton">
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

function formatEatingOut(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num) || num === 0) return "Rarely / never";
  if (num === 1) return "About once a week";
  return `About ${num} times a week`;
}

function formatWalkDuration(duration: number): string {
  if (duration < 5) return "Not set";
  return `${duration} min each`;
}

function HealthMarkersCard({ profile }: { profile: ProfileData }) {
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
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Health markers saved" });
    },
    onError: () => {
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
        <CardTitle className="text-base">Health Markers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">HbA1c level</span>
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
              {profile.hba1cLevel != null ? `${profile.hba1cLevel}%` : "Tap to add"}
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last blood test</span>
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
              {profile.bloodTestDate ?? "Tap to add"}
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();

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

  const dinnerLabel = profile?.hasLateDinner ? "After 9pm (working on it!)" : "Before 9pm";
  const walkDurationDisplay = formatWalkDuration(profile?.walkDuration ?? 0);
  const walksPerWeek = profile?.walksPerWeek ?? 0;

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4" data-testid="profile-page">
      <h1 className="text-xl font-bold" data-testid="text-profile-heading">Your Profile</h1>

      <Card data-testid="card-diabetes-profile">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Your Diabetes Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-walks">
            <span className="text-muted-foreground">Post-meal walks:</span>{" "}
            {walksPerWeek > 0
              ? `${walksPerWeek}× per week, ${walkDurationDisplay}`
              : "None yet"}
          </p>
          <p data-testid="text-dinner-time">
            <span className="text-muted-foreground">Usual dinner time:</span> {dinnerLabel}
          </p>
          <p data-testid="text-sleep-pattern">
            <span className="text-muted-foreground">Sleep pattern:</span>{" "}
            {SLEEP_LABELS[profile?.sleepPattern ?? ""] ?? profile?.sleepPattern ?? "N/A"}
          </p>
          <p data-testid="text-eating-out">
            <span className="text-muted-foreground">Eating out:</span>{" "}
            {formatEatingOut(profile?.eatingOutFrequency ?? "0")}
          </p>
        </CardContent>
      </Card>

      {profile && <HealthMarkersCard profile={profile} />}

      <Card data-testid="card-current-focus">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Target className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Current Focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-focus-area" className="font-medium">
            {roadmap?.isDinnerFocus
              ? "Late Dinner Timing"
              : STRUGGLE_NAMES[roadmap?.currentStruggle ?? ""] ?? roadmap?.currentStruggle ?? "N/A"}
          </p>
          {roadmap?.currentTip && (
            <p data-testid="text-current-tip" className="text-muted-foreground">
              {roadmap.currentTip}
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-export-data">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Download className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Export Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-testid="text-export-coming-soon" className="text-sm text-muted-foreground">
            Coming Soon...
          </p>
        </CardContent>
      </Card>

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
          Log Out
        </Button>
      </div>
    </div>
  );
}
