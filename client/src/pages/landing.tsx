import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="max-w-sm mx-auto px-4 pt-20">
      <Card>
        <CardContent className="flex flex-col items-center text-center p-8 gap-6">
          <div className="flex items-center gap-2" data-testid="text-app-title">
            <Activity className="w-7 h-7" style={{ color: "#14A085" }} />
            <h1 className="text-3xl font-bold" style={{ color: "#14A085" }}>
              GlucoPlanner
            </h1>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed" data-testid="text-description">
            Manage your diabetes with daily walks and healthy diet habits.
            Plan your week, track your progress, and stay on top of your health.
          </p>

          <Button asChild data-testid="button-login" style={{ backgroundColor: "#14A085", borderColor: "#14A085" }}>
            <a href="/api/login">Log in with Replit</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
