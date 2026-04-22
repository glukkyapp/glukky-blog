import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import glukkyLogo from "@assets/high-resolution-color-logo_1776593969022.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useGlobalLoading } from "@/components/global-loading-overlay";
import slide1Img from "@assets/generated_images/slide1_walk.png";
import slide2Img from "@assets/generated_images/slide2_meal.png";
import slide3Img from "@assets/cyucyu_A_subtly_smiling_Asian_person_holding_a_smartphone_loo__1773936364915.png";

const LANGUAGES = [
  { code: "en", label: "English", sub: "English" },
  { code: "zh-Hant", label: "繁體中文", sub: "Traditional Chinese" },
  { code: "yue", label: "粵語", sub: "Cantonese" },
];

type LandingStep = "lang" | "slides" | "auth";

function getInitialStep(): LandingStep {
  const saved = localStorage.getItem("glukky_preferred_lang");
  const valid = ["en", "zh-Hant", "yue"];
  return saved && valid.includes(saved) ? "auth" : "lang";
}

export default function Landing() {
  const { t } = useTranslation();
  const [step, setStep] = useState<LandingStep>(getInitialStep);
  const [slideIndex, setSlideIndex] = useState(0);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isChangingLang, setIsChangingLang] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useGlobalLoading(isLoading);

  const slides = [
    { image: slide1Img, headline: t("slides.s1_headline"), body: t("slides.s1_body") },
    { image: slide2Img, headline: t("slides.s2_headline"), body: t("slides.s2_body") },
    { image: slide3Img, headline: t("slides.s3_headline"), body: t("slides.s3_body") },
  ];

  const handleSelectLanguage = useCallback((code: string) => {
    hapticTap("SOFT");
    localStorage.setItem("glukky_preferred_lang", code);
    i18n.changeLanguage(code);
    if (isChangingLang) {
      setIsChangingLang(false);
      setStep("auth");
    } else {
      setSlideIndex(0);
      setStep("slides");
    }
  }, [isChangingLang]);

  const handleSlideNext = useCallback(() => {
    hapticTap("SOFT");
    if (slideIndex < slides.length - 1) {
      setSlideIndex((i) => i + 1);
    } else {
      setStep("auth");
    }
  }, [slideIndex, slides.length]);

  function switchTab(t: "login" | "register") {
    hapticTap("SOFT");
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
      hapticNotify("ERROR");
      setError(t("landing.error_required"));
      return;
    }
    if (tab === "register" && password !== confirmPassword) {
      hapticNotify("ERROR");
      setError(t("landing.error_mismatch"));
      return;
    }
    if (tab === "register" && password.length < 6) {
      hapticNotify("ERROR");
      setError(t("landing.error_short_password"));
      return;
    }

    hapticTap("MEDIUM");
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
        hapticNotify("ERROR");
        setError(data.message || t("landing.error_generic"));
        return;
      }

      const user = await res.json();
      queryClient.setQueryData(["/api/auth/user"], user);
      hapticNotify("SUCCESS");
      toast({
        title: tab === "login" ? t("landing.welcome_back") : t("landing.account_created"),
        description: t("landing.redirecting"),
      });
    } catch {
      hapticNotify("ERROR");
      setError(t("landing.error_network"));
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "lang") {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh overflow-hidden px-8 gap-6"
        style={{ backgroundColor: "#fdfbee" }}
        data-testid="landing-lang-screen"
      >
        <div className="flex flex-col items-center gap-3">
          <img src={glukkyLogo} alt="Glukky" style={{ width: "min(200px, 55vw)" }} />
          <p className="text-sm text-muted-foreground text-center">
            {t("landing.choose_language")}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              data-testid={`button-lang-${lang.code}`}
              onClick={() => handleSelectLanguage(lang.code)}
              className="w-full text-left px-5 py-4 rounded-2xl border border-border hover:border-[#127843] hover:bg-[#127843]/5 transition-colors flex flex-col gap-0.5"
            >
              <span className="font-semibold text-base text-foreground">{lang.label}</span>
              <span className="text-xs text-muted-foreground">{lang.sub}</span>
            </button>
          ))}
        </div>

        <div aria-hidden className="absolute w-0 h-0 overflow-hidden pointer-events-none">
          <img src={slide1Img} alt="" />
          <img src={slide2Img} alt="" />
          <img src={slide3Img} alt="" />
        </div>
      </div>
    );
  }

  if (step === "slides") {
    const slide = slides[slideIndex];
    return (
      <div
        className="relative h-dvh overflow-hidden"
        data-testid="landing-slides-screen"
      >
        <img
          key={slideIndex}
          src={slide.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 78%, rgba(0,0,0,0.72) 100%)" }}
        />

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex flex-col gap-2 max-w-sm mx-auto max-h-[70dvh] overflow-hidden">
          <div className="flex flex-col gap-1">
            <h2 className="text-[2.625rem] font-bold text-white leading-tight whitespace-pre-line">
              {slide.headline}
            </h2>
            <p className="text-[1.875rem] text-white/85 leading-snug">
              {slide.body}
            </p>
          </div>

          <div className="flex justify-center items-center gap-2" data-testid="slide-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { hapticTap("SOFT"); setSlideIndex(i); }}
                data-testid={`slide-dot-${i}`}
                aria-label={`Slide ${i + 1}`}
                className="flex items-center justify-center w-5 h-5 -m-1.5"
              >
                <span
                  className={`block rounded-full transition-all ${
                    i === slideIndex ? "w-1.5 h-0.5 bg-white" : "w-0.5 h-0.5 bg-white/40"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleSlideNext}
              className="rounded-full px-8 py-3 h-auto min-h-0 text-white text-[1.25rem] font-semibold btn-pop"
              style={{ backgroundColor: "#127843", borderColor: "#127843" }}
              data-testid={slideIndex === slides.length - 1 ? "button-get-started" : "button-next-slide"}
            >
              {slideIndex === slides.length - 1 ? t("landing.get_started") : t("landing.next")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen px-6 pt-3 pb-3"
      style={{ backgroundColor: "#fdfbee" }}
      data-testid="landing-auth-screen"
    >
      <div aria-hidden className="absolute w-0 h-0 overflow-hidden pointer-events-none">
        <img src={slide1Img} alt="" />
        <img src={slide2Img} alt="" />
        <img src={slide3Img} alt="" />
      </div>
      <div className="flex flex-col items-center gap-1 mb-2">
        <div className="flex items-center gap-2" data-testid="text-app-title">
          <img src={glukkyLogo} alt="Glukky" style={{ width: 320 }} />
        </div>
        <p className="text-xs text-muted-foreground" data-testid="text-description">
          {t("landing.slogan")}
        </p>
      </div>

      <div className="flex w-full rounded-xl overflow-hidden border mb-4" data-testid="auth-tabs">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "login" ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          style={tab === "login" ? { backgroundColor: "#214B36" } : undefined}
          data-testid="tab-login"
        >
          {t("landing.log_in")}
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "register" ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          style={tab === "register" ? { backgroundColor: "#214B36" } : undefined}
          data-testid="tab-register"
        >
          {t("landing.register")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("landing.email")}</Label>
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
          <Label htmlFor="password">{t("landing.password")}</Label>
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
            <Label htmlFor="confirmPassword">{t("landing.confirm_password")}</Label>
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
          className="w-full text-white mt-1 btn-pop"
          style={{ backgroundColor: "#214B36", borderColor: "#214B36" }}
          data-testid="button-submit"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : tab === "login" ? (
            t("landing.log_in")
          ) : (
            t("landing.create_account")
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          hapticTap("SOFT");
          localStorage.removeItem("glukky_preferred_lang");
          setIsChangingLang(true);
          setStep("lang");
        }}
        className="mt-auto pt-4 text-xs text-muted-foreground text-center hover:text-foreground transition-colors"
        data-testid="button-change-language"
      >
        {t("landing.change_language")}
      </button>
    </div>
  );
}
