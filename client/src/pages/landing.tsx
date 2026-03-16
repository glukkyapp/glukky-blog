import { useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Landing() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function switchTab(t: "login" | "register") {
    setTab(t);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    if (tab === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (tab === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Something went wrong");
        return;
      }

      const user = await res.json();
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: tab === "login" ? "Welcome back!" : "Account created!",
        description: "Redirecting...",
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-20">
      <Card>
        <CardContent className="flex flex-col items-center text-center p-8 gap-6">
          <div className="flex items-center gap-2" data-testid="text-app-title">
            <Activity className="w-7 h-7" style={{ color: "#14A085" }} />
            <h1 className="text-3xl font-bold" style={{ color: "#14A085" }}>
              Glukky
            </h1>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed" data-testid="text-description">
            Manage your diabetes with daily walks and healthy diet habits.
            Plan your week, track your progress, and stay on top of your health.
          </p>

          <div className="flex w-full rounded-lg overflow-hidden border" data-testid="auth-tabs">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "login"
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "login" ? { backgroundColor: "#14A085" } : undefined}
              data-testid="tab-login"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => switchTab("register")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "register"
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "register" ? { backgroundColor: "#14A085" } : undefined}
              data-testid="tab-register"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            </div>

            {tab === "register" && (
              <div className="flex flex-col gap-1.5 text-left">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500" data-testid="text-error">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full text-white"
              style={{ backgroundColor: "#14A085", borderColor: "#14A085" }}
              data-testid="button-submit"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : tab === "login" ? (
                "Log In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
