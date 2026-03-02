import { useQuery } from "@tanstack/react-query";
import { User, Lock, Target, List, Download, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STRUGGLE_NAMES: Record<string, string> = {
  sugary_food_drink: "Sugary Food & Drinks",
  oily_fried_food: "Oily/Fried Food",
  eat_out: "Eating Out",
  portions: "Portion Control",
  snacks: "Snacking",
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

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
  });

  const { data: roadmap, isLoading: roadmapLoading } = useQuery<RoadmapData>({
    queryKey: ["/api/roadmap"],
  });

  const isLoading = profileLoading || roadmapLoading;

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const upNextStruggles: string[] = [];
  if (roadmap?.struggles && roadmap.currentStruggle) {
    const currentIndex = roadmap.struggles.indexOf(roadmap.currentStruggle);
    if (currentIndex >= 0 && currentIndex < roadmap.struggles.length - 1) {
      upNextStruggles.push(...roadmap.struggles.slice(currentIndex + 1));
    }
  }

  const dinnerLabel = profile?.hasLateDinner ? "After 9pm" : "Before 9pm";

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4" data-testid="profile-page">
      <h1 className="text-xl font-bold" data-testid="text-profile-heading">Profile & Insights</h1>

      <Card data-testid="card-diabetes-profile">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Your Diabetes Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-walks">
            <span className="text-muted-foreground">Activity:</span>{" "}
            Walks {profile?.walksPerWeek ?? 0}x/week at {profile?.walkDuration ?? 0} min
          </p>
          <p data-testid="text-dinner-time">
            <span className="text-muted-foreground">Dinner time:</span> {dinnerLabel}
          </p>
          <p data-testid="text-sleep-pattern">
            <span className="text-muted-foreground">Sleep:</span> {profile?.sleepPattern ?? "N/A"}
          </p>
          <p data-testid="text-eating-out">
            <span className="text-muted-foreground">Eating out:</span> {profile?.eatingOutFrequency ?? "N/A"}
          </p>
        </CardContent>
      </Card>

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

      <Card data-testid="card-up-next">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <List className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Up Next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {upNextStruggles.length > 0 ? (
            upNextStruggles.map((struggle, index) => (
              <div
                key={struggle}
                className="flex items-center gap-2 text-muted-foreground"
                data-testid={`text-up-next-${index}`}
              >
                <Lock className="w-4 h-4" />
                <span>{STRUGGLE_NAMES[struggle] ?? struggle}</span>
              </div>
            ))
          ) : (
            <p data-testid="text-all-covered" className="text-muted-foreground">
              All areas covered!
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

      <div className="pt-4">
        <a href="/api/logout" data-testid="link-logout">
          <Button variant="outline" className="w-full">
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </a>
      </div>
    </div>
  );
}
