import { useState, useCallback, useEffect, useRef } from "react";
import { preloadStage2Onboarding } from "@/lib/preload-assets";
import { isAppleSignInAvailable, triggerAppleSignIn } from "@/lib/natively-apple";
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
  // Landing is the actual cold-launch surface for unauth'd users.
  // Warm the onboarding-question illustrations now so they're cached
  // by the time the user finishes signing in.
  useEffect(() => {
    preloadStage2Onboarding();
  }, []);

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
  const [authView, setAuthView] = useState<"apple" | "email">(() =>
    isAppleSignInAvailable() ? "apple" : "email"
  );
  const touchStartX = useRef<number | null>(null);

  const slides = [
    { image: slide1Img, headline: t("slides.s1_headline"), body: t("slides.s1_body"), objectPosition: "center 30%" },
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
      setAuthView(isAppleSignInAvailable() ? "apple" : "email");
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

  async function handleAppleSignIn() {
    hapticTap("MEDIUM");
    setError("");
    setIsLoading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        triggerAppleSignIn(
          async (resp) => {
            try {
              const res = await fetch("/api/auth/apple-signin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ subject: resp.subject, email: resp.email }),
              });
              if (!res.ok) {
                const data = await res.json();
                reject(new Error(data.message || t("landing.error_generic")));
                return;
              }
              // Invalidate so the full canonical shape is fetched from /api/auth/user
              await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              hapticNotify("SUCCESS");
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          (msg) => reject(new Error(msg)),
        );
      });
    } catch (err: unknown) {
      hapticNotify("ERROR");
      setError(err instanceof Error ? err.message : t("landing.error_generic"));
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
    const ACCENT = "#127843";
    const HEADLINE = "#214B36";
    return (
      <div
        className="relative h-dvh w-full overflow-hidden flex flex-col"
        style={{ background: "#fdfbee", fontFamily: "'Inter', system-ui, sans-serif" }}
        data-testid="landing-slides-screen"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (dx < -40) {
            handleSlideNext();
          } else if (dx > 40) {
            hapticTap("SOFT");
            setSlideIndex((i) => Math.max(0, i - 1));
          }
        }}
      >

        {/* Hero image */}
        <div
          className="relative"
          style={{
            height: "46%",
            borderBottomLeftRadius: 34,
            borderBottomRightRadius: 34,
            overflow: "hidden",
          }}
        >
          <img
            key={slideIndex}
            src={slide.image}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: slide.objectPosition ?? "center", display: "block" }}
          />
        </div>

        {/* Content */}
        <div
          className="flex-1 flex flex-col"
          style={{ padding: "28px 30px 24px" }}
        >
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: HEADLINE,
                lineHeight: 1.25,
                whiteSpace: "pre-line",
              }}
              data-testid="text-slide-headline"
            >
              {slide.headline}
            </h2>
            <p
              style={{
                margin: "16px auto 0",
                maxWidth: "26ch",
                fontSize: 14,
                lineHeight: 1.5,
                color: "#6b7280",
              }}
              data-testid="text-slide-body"
            >
              {slide.body}
            </p>
          </div>

          {/* Bottom section: Get Started button + dots/next row */}
          <div className="flex flex-col mt-auto" style={{ gap: 14 }}>
            {/* Get Started — full-width pill, jumps directly to auth */}
            <button
              type="button"
              onClick={() => {
                hapticTap("SOFT");
                setAuthView(isAppleSignInAvailable() ? "apple" : "email");
                setStep("auth");
              }}
              data-testid="button-slide-skip-to-auth"
              className="w-full btn-pop"
              style={{
                background: ACCENT,
                color: "white",
                border: 0,
                borderRadius: 999,
                padding: "14px 0",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 14px rgba(18,120,67,0.35)",
              }}
            >
              {t("landing.get_started")}
            </button>

            {/* Dots · Next */}
            <div className="flex items-center justify-between">
              <span aria-hidden style={{ width: 36, height: 36 }} />

              <div className="flex items-center" style={{ gap: 8 }} data-testid="slide-dots">
                {slides.map((_, i) => {
                  const active = i === slideIndex;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { hapticTap("SOFT"); setSlideIndex(i); }}
                      data-testid={`slide-dot-${i}`}
                      aria-label={`Slide ${i + 1}`}
                      className="flex items-center justify-center"
                      style={{
                        padding: 6,
                        margin: -6,
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: active ? 26 : 8,
                          height: 8,
                          borderRadius: 999,
                          background: active ? ACCENT : "#e5e7eb",
                          transition: "width 0.25s ease, background 0.25s ease",
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSlideNext}
                data-testid={slideIndex === slides.length - 1 ? "button-get-started" : "button-next-slide"}
                aria-label={slideIndex === slides.length - 1 ? t("landing.get_started") : t("landing.next")}
                className="btn-pop"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: 0,
                  background: ACCENT,
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 6px 14px rgba(18,120,67,0.35)",
                }}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div
          className="absolute"
          style={{
            left: "50%",
            bottom: 10,
            transform: "translateX(-50%)",
            width: 120,
            height: 5,
            borderRadius: 999,
            background: "#111",
            opacity: 0.9,
          }}
        />
      </div>
    );
  }

  // Apple-first view — shown on iOS as the initial auth screen
  if (authView === "apple") {
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

        {/* Logo + slogan — centred in the upper portion */}
        <div className="flex flex-col items-center gap-1 flex-1 justify-center">
          <img src={glukkyLogo} alt="Glukky" style={{ width: 280 }} data-testid="text-app-title" />
          <p className="text-xs text-muted-foreground" data-testid="text-description">
            {t("landing.slogan")}
          </p>
        </div>

        {/* CTA stack at bottom */}
        <div className="flex flex-col gap-3 pb-2">
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={isLoading}
            data-testid="button-apple-signin"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold transition-opacity disabled:opacity-50 btn-pop"
            style={{ backgroundColor: "#000", color: "#fff", border: "none" }}
          >
            <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.1 8 279.5 8 160.1c0-114.2 74.1-174.8 146.6-174.8 74.1 0 125.4 44.2 170.8 44.2 43.3 0 101.6-47.6 184.1-47.6 28.6 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
            </svg>
            {t("landing.apple_signin")}
          </button>

          <button
            type="button"
            onClick={() => { hapticTap("SOFT"); setAuthView("email"); }}
            className="text-sm text-muted-foreground text-center hover:text-foreground transition-colors py-1"
            data-testid="button-continue-email"
          >
            {t("landing.continue_with_email")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            hapticTap("SOFT");
            localStorage.removeItem("glukky_preferred_lang");
            setIsChangingLang(true);
            setStep("lang");
          }}
          className="mt-2 pt-3 text-xs text-muted-foreground text-center hover:text-foreground transition-colors"
          data-testid="button-change-language"
        >
          {t("landing.change_language")}
        </button>
      </div>
    );
  }

  // Email view — default on web; shown on iOS after tapping "Continue with email instead"
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

      {/* Back to Apple — only on iOS */}
      {isAppleSignInAvailable() && (
        <button
          type="button"
          onClick={() => { hapticTap("SOFT"); setAuthView("apple"); }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors self-start mb-2"
          data-testid="button-back-to-apple"
        >
          ‹ {t("onboarding.back")}
        </button>
      )}

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
