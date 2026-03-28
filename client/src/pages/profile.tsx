import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LogOut, Pencil, Smile } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface ProfileData {
  name: string | null;
  goal: string | null;
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
        </CardContent>
      </Card>
    </div>
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
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: () => {
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

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4" data-testid="profile-page">
      <h1 className="text-xl font-bold" data-testid="text-profile-heading">{t("profile.title")}</h1>

      {profile && <NameGoalCard profile={profile} />}

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
    </div>
  );
}
