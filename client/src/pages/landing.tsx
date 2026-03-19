import { useState, useCallback } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n";
import slide1Img from "@assets/generated_images/slide1_walk.png";
import slide2Img from "@assets/generated_images/slide2_meal.png";
import slide3Img from "@assets/generated_images/slide3_track.png";

const LANGUAGES = [
  { code: "en", label: "English", sub: "English" },
  { code: "zh-Hant", label: "繁體中文", sub: "Traditional Chinese" },
  { code: "yue", label: "粵語", sub: "Cantonese" },
];

const SLIDES = [
  {
    image: slide1Img,
    headline: "Your blood sugar,\nin your hands",
    body: "A short walk after dinner is one of the most effective ways to keep blood sugar in check.",
  },
  {
    image: slide2Img,
    headline: "One small change\na week",
    body: "We focus on one diet habit at a time — sustainable progress you can actually keep.",
  },
  {
    image: slide3Img,
    headline: "The app adapts\nto you",
    body: "Based on how you're doing each week, Glukky quietly adjusts your plan.",
  },
];

type LandingStep = "lang" | "slides" | "auth";

function getInitialStep(): LandingStep {
  const saved = localStorage.getItem("glukky_preferred_lang");
  const valid = ["en", "zh-Hant", "yue"];
  return saved && valid.includes(saved) ? "auth" : "lang";
}

export default function Landing() {
  const [step, setStep] = useState<LandingStep>(getInitialStep);
  const [slideIndex, setSlideIndex] = useState(0);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSelectLanguage = useCallback((code: string) => {
    localStorage.setItem("glukky_preferred_lang", code);
    i18n.changeLanguage(code);
    setSlideIndex(0);
    setStep("slides");
  }, []);

  const handleSlideNext = useCallback(() => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex((i) => i + 1);
    } else {
      setStep("auth");
    }
  }, [slideIndex]);

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

  if (step === "lang") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-8 gap-10 bg-white"
        data-testid="landing-lang-screen"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8" style={{ color: "#14A085" }} />
            <h1 className="text-3xl font-bold" style={{ color: "#14A085" }}>
              Glukky
            </h1>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Choose your language / 選擇語言
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              data-testid={`button-lang-${lang.code}`}
              onClick={() => handleSelectLanguage(lang.code)}
              className="w-full text-left px-5 py-4 rounded-2xl border border-border hover:border-[#14A085] hover:bg-[#14A085]/5 transition-colors flex flex-col gap-0.5"
            >
              <span className="font-semibold text-base text-foreground">{lang.label}</span>
              <span className="text-xs text-muted-foreground">{lang.sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "slides") {
    const slide = SLIDES[slideIndex];
    return (
      <div
        className="flex flex-col min-h-screen bg-white"
        data-testid="landing-slides-screen"
      >
        <div className="flex items-center gap-1.5 px-5 pt-5 pb-2 z-10">
          <Activity className="w-5 h-5" style={{ color: "#14A085" }} />
          <span className="font-bold text-base" style={{ color: "#14A085" }}>
            Glukky
          </span>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <img
            key={slideIndex}
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
            style={{ display: "block" }}
          />
        </div>

        <div className="bg-white rounded-t-3xl px-6 pt-6 pb-8 flex flex-col gap-5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-foreground leading-tight whitespace-pre-line">
              {slide.headline}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {slide.body}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5" data-testid="slide-dots">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  data-testid={`slide-dot-${i}`}
                  className={`rounded-full transition-all ${
                    i === slideIndex
                      ? "w-5 h-2"
                      : "w-2 h-2 bg-muted"
                  }`}
                  style={i === slideIndex ? { backgroundColor: "#14A085" } : undefined}
                />
              ))}
            </div>

            <Button
              onClick={handleSlideNext}
              className="rounded-full px-7 text-white text-sm font-semibold"
              style={{ backgroundColor: "#14A085", borderColor: "#14A085" }}
              data-testid={slideIndex === SLIDES.length - 1 ? "button-get-started" : "button-next-slide"}
            >
              {slideIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen bg-white px-6 pt-16 pb-8"
      data-testid="landing-auth-screen"
    >
      <div className="flex flex-col items-center gap-1 mb-8">
        <div className="flex items-center gap-2" data-testid="text-app-title">
          <Activity className="w-7 h-7" style={{ color: "#14A085" }} />
          <h1 className="text-3xl font-bold" style={{ color: "#14A085" }}>
            Glukky
          </h1>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="text-description">
          Manage your diabetes with daily habits.
        </p>
      </div>

      <div className="flex w-full rounded-xl overflow-hidden border mb-6" data-testid="auth-tabs">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "login" ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          style={tab === "login" ? { backgroundColor: "#14A085" } : undefined}
          data-testid="tab-login"
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "register" ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          style={tab === "register" ? { backgroundColor: "#14A085" } : undefined}
          data-testid="tab-register"
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-1.5">
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
          className="w-full text-white mt-1"
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

      <button
        type="button"
        onClick={() => {
          localStorage.removeItem("glukky_preferred_lang");
          setStep("lang");
        }}
        className="mt-auto pt-8 text-xs text-muted-foreground text-center hover:text-foreground transition-colors"
        data-testid="button-change-language"
      >
        Change language / 更改語言
      </button>
    </div>
  );
}
