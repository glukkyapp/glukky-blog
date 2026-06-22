import { useState, useCallback, useEffect, useRef } from "react";
import { preloadStage2Onboarding } from "@/lib/preload-assets";
import { isAppleSignInAvailable, triggerAppleSignIn } from "@/lib/natively-apple";
import { Loader2 } from "lucide-react";
import { SiApple } from "react-icons/si";
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
    { image: slide3Img, headline: t("slides.s3_headline"), body: t("slides.s3_body"), objectPosition: "center 20%" },
  ];

  const handleSelectLanguage = useCallback((code: string) => {
    hapticTap("SOFT");
    localStorage.setItem("glukky_preferred_lang", code);
    i18n.changeLanguage(code);
    if (isChangingLang) {
      setIsChangingLang(false);
      setAuthView(isAppleSignInAvailable() ? "apple" : "email");
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
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => reject("__apple_timeout__"), 30000);
      });
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          triggerAppleSignIn(
            async (resp) => {
              clearTimeout(timeoutId);
              try {
                const res = await fetch("/api/auth/apple-signin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ subject: resp.subject, email: resp.email, authorizationCode: resp.authorizationCode }),
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
            (msg) => { clearTimeout(timeoutId); reject(new Error(msg)); },
          );
        }),
        timeoutPromise,
      ]);
    } catch (err: unknown) {
      if (err === "__apple_timeout__") {
        setError("");
      } else {
        hapticNotify("ERROR");
        setError(err instanceof Error ? err.message : t("landing.error_generic"));
      }
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
        </div>
      </div>
    );
  }

  if (step === "slides") {
    const ACCENT = "#127843";
    const HEADLINE = "#214B36";
    // Peek layout math:
    //   left margin = 20px, gap between cards = 12px, right peek = 20px
    //   cardWidth = calc(100vw - 52px)   (20 + 12 + 20 = 52)
    //   stride    = calc(100vw - 40px)   (cardWidth + gap = 100vw - 52 + 12)
    //   trackX    = calc(20px - N * (100vw - 40px))
    return (
      <div
        className="relative h-dvh w-full flex flex-col"
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
        {/* Logo */}
        <div style={{ paddingTop: 28, paddingBottom: 20, textAlign: "center", flexShrink: 0 }}>
          <img src={glukkyLogo} alt="Glukky" style={{ width: 140, display: "inline-block" }} />
        </div>

        {/* Photo card strip — overflow hidden clips the track, second card peeks from right */}
        <div style={{ overflow: "hidden", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              transform: `translateX(calc(20px - ${slideIndex} * (100vw - 40px)))`,
              transition: "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {slides.map((s, i) => (
              <div
                key={i}
                style={{
                  width: "calc(100vw - 52px)",
                  flexShrink: 0,
                  height: "calc(100vw - 52px)",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.13)",
                }}
              >
                <img
                  src={s.image}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.objectPosition ?? "center", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Copy block */}
        <div style={{ textAlign: "center", padding: "24px 28px 0", flexShrink: 0 }}>
          <h2
            data-testid="text-slide-headline"
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: HEADLINE,
              lineHeight: 1.3,
              whiteSpace: "pre-line",
            }}
          >
            {slides[slideIndex].headline}
          </h2>
          <p
            data-testid="text-slide-body"
            style={{
              margin: "12px auto 0",
              maxWidth: "26ch",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#6b7280",
            }}
          >
            {slides[slideIndex].body}
          </p>
        </div>

        {/* Bottom navigation */}
        <div style={{ marginTop: "auto", paddingBottom: 28, flexShrink: 0 }}>
          {/* Pagination dots — centered, close to copy above */}
          <div
            style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}
            data-testid="slide-dots"
          >
            {slides.map((_, i) => {
              const active = i === slideIndex;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { hapticTap("SOFT"); setSlideIndex(i); }}
                  data-testid={`slide-dot-${i}`}
                  aria-label={`Slide ${i + 1}`}
                  style={{ padding: 6, margin: -6, background: "transparent", border: 0, cursor: "pointer" }}
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

          {/* Primary CTA — full-width pill */}
          <button
            type="button"
            onClick={() => {
              hapticTap("SOFT");
              setAuthView(isAppleSignInAvailable() ? "apple" : "email");
              setStep("auth");
            }}
            data-testid="button-get-started"
            className="btn-pop"
            style={{
              display: "block",
              width: "calc(100% - 48px)",
              margin: "0 24px",
              height: 52,
              borderRadius: 9999,
              background: ACCENT,
              color: "white",
              border: 0,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(18,120,67,0.35)",
            }}
          >
            {t("landing.get_started")}
          </button>

          {/* Secondary: Log In */}
          <button
            type="button"
            onClick={() => {
              hapticTap("SOFT");
              setTab("login");
              setAuthView("email");
              setStep("auth");
            }}
            data-testid="button-slide-login"
            style={{
              display: "block",
              width: "100%",
              marginTop: 14,
              textAlign: "center",
              color: ACCENT,
              fontSize: 15,
              fontWeight: 600,
              background: "transparent",
              border: 0,
              cursor: "pointer",
            }}
          >
            {t("landing.log_in")}
          </button>

          {/* Version number */}
          <p
            style={{
              textAlign: "center",
              color: "#d1d5db",
              fontSize: 11,
              margin: "10px 0 0",
              userSelect: "none",
            }}
          >
            Version 1.0.0
          </p>
        </div>
      </div>
    );
  }

  // Apple-first view — shown on iOS as the initial auth screen
  if (authView === "apple") {
    return (
      <div
        className="flex flex-col h-dvh px-6"
        style={{ backgroundColor: "#fdfbee" }}
        data-testid="landing-auth-screen"
      >
        <div aria-hidden className="absolute w-0 h-0 overflow-hidden pointer-events-none">
          <img src={slide1Img} alt="" />
          <img src={slide2Img} alt="" />
        </div>

        {/* Top spacer — pushes centre block to vertical midpoint */}
        <div className="flex-1" />

        {/* Logo + subtitle + Apple button — centred block */}
        <div className="flex flex-col items-center w-full" style={{ gap: 12 }}>
          <img src={glukkyLogo} alt="Glukky" style={{ width: 280 }} data-testid="text-app-title" />
          <p className="text-xs text-muted-foreground" style={{ margin: 0 }} data-testid="text-description">
            {t("landing.slogan")}
          </p>
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={isLoading}
            data-testid="button-apple-signin"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold transition-opacity disabled:opacity-50 btn-pop"
            style={{ backgroundColor: "#000", color: "#fff", border: "none", marginTop: 8 }}
          >
            <SiApple size={18} aria-hidden="true" />
            {t("landing.apple_signin")}
          </button>
        </div>

        {/* Bottom spacer */}
        <div className="flex-1" />

        {/* Bottom anchored: Continue with email + Change language */}
        <div className="flex flex-col items-center" style={{ paddingBottom: 48 }}>
          <button
            type="button"
            onClick={() => { hapticTap("SOFT"); setAuthView("email"); }}
            className="text-sm text-muted-foreground text-center hover:text-foreground transition-colors py-2"
            data-testid="button-continue-email"
          >
            {t("landing.continue_with_email")}
          </button>
          <button
            type="button"
            onClick={() => {
              hapticTap("SOFT");
              localStorage.removeItem("glukky_preferred_lang");
              setIsChangingLang(true);
              setStep("lang");
            }}
            className="text-xs text-muted-foreground text-center hover:text-foreground transition-colors py-2"
            data-testid="button-change-language"
          >
            {t("landing.change_language")}
          </button>
        </div>
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
