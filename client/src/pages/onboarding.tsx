import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { preloadStage3RestOfApp, getStage2Promise } from "@/lib/preload-assets";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Moon, Sunset, Check, Eye, X } from "lucide-react";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useGlobalLoading, usePromiseLoading } from "@/components/global-loading-overlay";
import { track, trackException, setUserProperties } from "@/lib/posthog";
import { syncOneSignalLanguage } from "@/lib/onesignal-language";
import { useConsent, type ConsentService } from "@/contexts/consent-context";
import {
  OnboardingCard,
  PillOption,
  IconTileOption,
} from "@/components/onboarding-ui";
import {
  PostMealIllustration,
  DinnerTableIllustration,
  ReferralIllustration,
  HealthIcons,
} from "@/components/onboarding-illustrations";
import welcomeImg from "@assets/generated-image_(13)_1776599161992.png";
import whyImg from "@assets/generated-image_(18)_1776601559534.png";

// To re-enable a hidden step, add its number back to VISIBLE_STEPS.
// Hidden: 3 (goal/why), 4 (questions intro), 5 (after-dinner walk), 6 (dinner time), 8 (referral)
const VISIBLE_STEPS = [1, 2, 7] as const;
const TOTAL_STEPS = VISIBLE_STEPS.length; // 3
const GREEN_DARK = "#214B36";

const CONSENT_SERVICE_KEYS: ConsentService[] = ["posthog", "onesignal", "claude"];

export default function Onboarding() {
  useEffect(() => {
    preloadStage3RestOfApp();
  }, []);

  usePromiseLoading(getStage2Promise);

  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";

  const exitPreview = () => {
    setLocation("/dev");
  };

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  useGlobalLoading(submitting);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const [consentChoices, setConsentChoices] = useState<Record<ConsentService, boolean>>({
    posthog: false,
    onesignal: false,
    revenuecat: false,
    claude: false,
  });
  const { bulkUpdateConsent } = useConsent();

  useEffect(() => {
    track("onboarding_step_viewed", { step });
  }, [step]);

  const [userName, setUserName] = useState("");
  const [userGoal, setUserGoal] = useState("");

  // Fetch the profile to detect whether Apple already wrote a name during sign-in.
  // This replaces the old sessionStorage bridge, which only worked on Apple's very
  // first auth ever. Reading from the DB works on every subsequent sign-in too.
  const { data: existingProfile, isLoading: profileLoading } = useQuery<{ name: string | null } | null>({
    queryKey: ["/api/profile"],
  });
  const hasAppleName = !!(existingProfile?.name?.trim());

  useEffect(() => {
    if (existingProfile?.name?.trim()) {
      setUserName(existingProfile.name.trim());
    }
  }, [existingProfile?.name]);
  const [walkOption, setWalkOption] = useState<string>("");
  const [dinnerTime, setDinnerTime] = useState<string>("");
  const [sleepPattern, setSleepPattern] = useState<string>("");
  const [eatingOutFrequency, setEatingOutFrequency] = useState<string>("");
  const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);
  const [healthCondition, setHealthCondition] = useState<string>("");
  const [referralSource, setReferralSource] = useState<string>("");
  const [referralOther, setReferralOther] = useState<string>("");
  const [notificationEmail, setNotificationEmail] = useState("");

  const getWalkData = () => {
    if (walkOption === "sit_rest") return { walksPerWeek: 0, walkDuration: 0 };
    if (walkOption === "walk_10") return { walksPerWeek: 3, walkDuration: 10 };
    if (walkOption === "walk_longer") return { walksPerWeek: 3, walkDuration: 15 };
    return { walksPerWeek: 0, walkDuration: 0 };
  };

  const handleNext = () => {
    hapticTap("SOFT");
    setDirection("forward");
    setStep((s) => Math.min(s + 1, TOTAL_STEPS + 1));
  };
  const handleBack = () => {
    hapticTap("SOFT");
    setDirection("backward");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    hapticTap("MEDIUM");
    if (isPreview) {
      hapticNotify("SUCCESS");
      toast({
        title: "Preview only",
        description: "Nothing was saved.",
      });
      setLocation("/dev");
      return;
    }
    setSubmitting(true);
    const { walksPerWeek, walkDuration } = getWalkData();
    try {
      await bulkUpdateConsent(consentChoices);
      await apiRequest("POST", "/api/profile", {
        walksPerWeek,
        walkDuration,
        dinnerTime,
        sleepPattern,
        eatingOutFrequency,
        struggles: selectedStruggles,
        notificationEmail,
        preferredLanguage: i18n.language || "en",
        name: userName.trim() || null,
        goal: userGoal.trim() || null,
        healthCondition: healthCondition || null,
        referralSource: referralSource === "others" ? (referralOther.trim() || "others") : (referralSource || null),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      syncOneSignalLanguage(i18n.language || "en");
      hapticNotify("SUCCESS");
      const onboardingProperties = {
        struggles: selectedStruggles,
        sleepPattern,
        eatingOutFrequency,
        walkOption,
        dinnerTime: dinnerTime || null,
        healthCondition: healthCondition || null,
        preferredLanguage: i18n.language || "en",
        hasName: !!userName.trim(),
        hasGoal: !!userGoal.trim(),
        hasNotificationEmail: !!notificationEmail.trim(),
        referralSource: referralSource || null,
      };
      track("onboarding_completed", onboardingProperties);
      setUserProperties(onboardingProperties);
      setLocation("/snap");
    } catch (error: unknown) {
      hapticNotify("ERROR");
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
      track("onboarding_submit_failed");
      trackException(error, { phase: "onboarding_submit" });
    } finally {
      setSubmitting(false);
    }
  };

  const isNextDisabled = () => {
    const actualStep = step <= TOTAL_STEPS ? VISIBLE_STEPS[step - 1] : step;
    if (actualStep === 1) return !userName.trim();
    if (actualStep === 3) return !userGoal.trim();
    if (actualStep === 5) return !walkOption;
    if (actualStep === 6) return !dinnerTime;
    if (actualStep === 7) return !healthCondition;
    return false;
  };

  const backButton = step > 1 ? (
    <Button
      variant="ghost"
      onClick={handleBack}
      data-testid="button-back"
      className="w-full"
      style={{ color: "inherit", borderRadius: 999, height: 40, opacity: 0.85 }}
    >
      {t("onboarding.back")}
    </Button>
  ) : null;

  const ctaButton = step <= TOTAL_STEPS ? (
    <Button
      onClick={handleNext}
      disabled={isNextDisabled()}
      className="btn-pop w-full"
      style={{ background: GREEN_DARK, color: "#fff", borderRadius: 999, height: 48 }}
      data-testid="button-next"
    >
      {t("onboarding.next")}
    </Button>
  ) : (
    <Button
      onClick={handleSubmit}
      disabled={submitting}
      className="btn-pop w-full"
      style={{ background: GREEN_DARK, color: "#fff", borderRadius: 999, height: 48 }}
      data-testid="button-get-started"
    >
      {submitting ? t("onboarding.saving") : t("onboarding.get_started")}
    </Button>
  );

  const cardFooter = (
    <div className="flex flex-col gap-1">
      {ctaButton}
      {backButton}
    </div>
  );

  const renderStep = () => {
    const actualStep = step <= TOTAL_STEPS ? VISIBLE_STEPS[step - 1] : step;
    switch (actualStep) {
      case 1:
        if (profileLoading) {
          return (
            <div className="animate-pulse space-y-3 px-1 pt-2">
              <div className="h-6 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-12 bg-muted rounded-full" />
            </div>
          );
        }
        if (hasAppleName) {
          return (
            <OnboardingCard
              testId="card-step-apple-greeting"
              title={t("onboarding.apple_greeting_title", { name: userName })}
              footer={cardFooter}
              minHeight="auto"
            />
          );
        }
        return (
          <OnboardingCard
            testId="card-step-name"
            title={t("onboarding.name_title")}
            footer={cardFooter}
            minHeight="auto"
          >
            <Label htmlFor="user-name" className="sr-only">{t("onboarding.name_placeholder")}</Label>
            <Input
              id="user-name"
              type="text"
              placeholder={t("onboarding.name_placeholder")}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              data-testid="input-name"
              style={{ borderRadius: 999, height: 48, background: "#fff" }}
            />
          </OnboardingCard>
        );
      case 2:
        return (
          <OnboardingCard
            testId="card-step-social-proof"
            title={t("onboarding.social_proof_title")}
            footer={cardFooter}
            background="#f8f9eb"
          >
            <div
              style={{
                marginLeft: -22,
                marginRight: -22,
                marginTop: 8,
                marginBottom: 8,
                overflow: "hidden",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
              }}
            >
              <img
                src={welcomeImg}
                alt="Six people waving from green phone screens"
                draggable={false}
                data-testid="img-welcome"
                style={{
                  display: "block",
                  width: "80%",
                  height: "auto",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              />
            </div>
            <p className="text-center text-sm" data-testid="text-social-proof" style={{ color: GREEN_DARK }}>
              {t("onboarding.social_proof_message")}
            </p>
          </OnboardingCard>
        );
      case 3:
        return (
          <OnboardingCard
            testId="card-step-why"
            title={t("onboarding.why_title")}
            footer={cardFooter}
            background="#e7f6df"
            minHeight="auto"
          >
            <div
              style={{
                marginLeft: -22,
                marginRight: -22,
                marginTop: 8,
                marginBottom: 21,
                overflow: "hidden",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
              }}
            >
              <img
                src={whyImg}
                alt="Smiling man giving a thumbs up surrounded by family, heart, and mirror illustrations"
                draggable={false}
                data-testid="img-why"
                style={{
                  display: "block",
                  width: "80%",
                  height: "auto",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              />
            </div>
            <Label htmlFor="user-goal" className="sr-only">{t("onboarding.why_placeholder")}</Label>
            <Textarea
              id="user-goal"
              placeholder={t("onboarding.why_placeholder")}
              value={userGoal}
              onChange={(e) => setUserGoal(e.target.value)}
              className="min-h-[100px]"
              data-testid="input-goal"
              style={{ borderRadius: 18, background: "#fff" }}
            />
          </OnboardingCard>
        );
      case 4:
        return (
          <OnboardingCard
            testId="card-step-questions-intro"
            title={t("onboarding.questions_intro_title")}
            footer={cardFooter}
            minHeight="auto"
          >
            <p className="text-center text-sm" data-testid="text-questions-intro" style={{ color: GREEN_DARK }}>
              {t("onboarding.questions_intro_body")}
            </p>
          </OnboardingCard>
        );
      case 5:
        return (
          <OnboardingCard
            testId="card-step-1"
            visual={<PostMealIllustration choice={walkOption} />}
            title={t("onboarding.q1_title")}
            footer={cardFooter}
          >
            <PillOption
              label={t("onboarding.q1_sit_rest")}
              selected={walkOption === "sit_rest"}
              onClick={() => setWalkOption("sit_rest")}
              testId="option-sit-rest"
            />
            <PillOption
              label={t("onboarding.q1_walk_10")}
              selected={walkOption === "walk_10"}
              onClick={() => setWalkOption("walk_10")}
              testId="option-walk-10"
            />
            <PillOption
              label={t("onboarding.q1_walk_longer")}
              selected={walkOption === "walk_longer"}
              onClick={() => setWalkOption("walk_longer")}
              testId="option-walk-longer"
            />
          </OnboardingCard>
        );
      case 6: {
        const renderDinnerTile = (
          selected: boolean,
          icon: React.ReactNode,
          smallLabel: string,
          bigLabel: string,
          onClick: () => void,
          testId: string,
        ) => (
          <button
            type="button"
            onClick={onClick}
            data-testid={testId}
            className="flex-1 flex flex-col items-center gap-3 transition-all"
            style={{
              background: selected ? "#efe6d4" : "transparent",
              borderRadius: 16,
              color: selected ? "#7a5a2c" : GREEN_DARK,
              paddingTop: 12,
              paddingBottom: 220,
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            <div style={{ height: 40, display: "flex", alignItems: "center" }}>
              {selected ? <Check size={32} style={{ color: "#7a5a2c" }} /> : icon}
            </div>
            <div
              className="rounded-xl px-4 py-2 text-center"
              style={{
                background: selected ? "rgba(255,255,255,0.6)" : "#fff",
                border: `1.5px solid ${selected ? "#c9b48a" : GREEN_DARK}`,
                minWidth: 110,
                color: selected ? "#7a5a2c" : GREEN_DARK,
              }}
            >
              <div
                className="font-bold leading-tight"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: 16 }}
              >
                {smallLabel}
              </div>
              <div
                className="font-bold leading-tight"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: 22 }}
              >
                {bigLabel}
              </div>
            </div>
          </button>
        );
        return (
          <OnboardingCard
            testId="card-step-2"
            title={t("onboarding.q2_title")}
            footer={cardFooter}
          >
            <div className="relative">
              <div className="flex items-stretch">
                {renderDinnerTile(
                  dinnerTime === "before_9pm",
                  <Sunset size={36} style={{ color: "#e0a458" }} />,
                  t("onboarding.q2_before_line1"),
                  t("onboarding.q2_before_line2"),
                  () => setDinnerTime("before_9pm"),
                  "option-before-9pm",
                )}
                <div style={{ width: 1, background: "rgba(33,75,54,0.18)", margin: "12px 0" }} />
                {renderDinnerTile(
                  dinnerTime === "after_9pm",
                  <Moon size={32} style={{ color: "#5b7a8a" }} />,
                  t("onboarding.q2_after_line1"),
                  t("onboarding.q2_after_line2"),
                  () => setDinnerTime("after_9pm"),
                  "option-after-9pm",
                )}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: -22,
                  right: -22,
                  bottom: 0,
                  pointerEvents: "none",
                }}
              >
                <DinnerTableIllustration />
              </div>
            </div>
          </OnboardingCard>
        );
      }
      case 7:
        return (
          <OnboardingCard
            testId="card-step-health"
            title={t("onboarding.q6_health_title")}
            footer={cardFooter}
          >
            <div className="grid grid-cols-2 gap-2 auto-rows-fr">
              <IconTileOption
                image={HealthIcons.diabetes.image}
                label={t("onboarding.q6_diabetes")}
                selected={healthCondition === "diabetes"}
                onClick={() => setHealthCondition("diabetes")}
                testId="option-diabetes"
              />
              <IconTileOption
                image={HealthIcons.prediabetes.image}
                label={t("onboarding.q6_prediabetes")}
                selected={healthCondition === "prediabetes"}
                onClick={() => setHealthCondition("prediabetes")}
                testId="option-prediabetes"
              />
              <IconTileOption
                image={HealthIcons.no_but_health.image}
                label={t("onboarding.q6_no_but_health")}
                selected={healthCondition === "no_but_health"}
                onClick={() => setHealthCondition("no_but_health")}
                testId="option-no-but-health"
              />
            </div>
          </OnboardingCard>
        );
      case 8:
        return (
          <OnboardingCard
            testId="card-step-referral"
            visual={<ReferralIllustration />}
            title={t("onboarding.q7_referral_title")}
            footer={cardFooter}
          >
            <div className="grid grid-cols-2 gap-2">
              <PillOption label={t("onboarding.q7_facebook")} selected={referralSource === "facebook"} onClick={() => setReferralSource("facebook")} testId="option-facebook" />
              <PillOption label={t("onboarding.q7_instagram")} selected={referralSource === "instagram"} onClick={() => setReferralSource("instagram")} testId="option-instagram" />
              <PillOption label={t("onboarding.q7_friends_relatives")} selected={referralSource === "friends_relatives"} onClick={() => setReferralSource("friends_relatives")} testId="option-friends-relatives" />
              <PillOption label={t("onboarding.q7_others")} selected={referralSource === "others"} onClick={() => setReferralSource("others")} testId="option-others" />
            </div>
            {referralSource === "others" && (
              <Input
                type="text"
                placeholder={t("onboarding.q7_others_placeholder")}
                value={referralOther}
                onChange={(e) => setReferralOther(e.target.value)}
                className="mt-1"
                data-testid="input-referral-other"
                style={{ borderRadius: 999, height: 44, background: "#fff" }}
              />
            )}
          </OnboardingCard>
        );
      case TOTAL_STEPS + 1:
        return (
          <OnboardingCard
            testId="card-step-consent"
            title={t("consent.onboarding_title")}
            footer={cardFooter}
          >
            <p className="text-sm text-muted-foreground mb-2">
              {t("consent.onboarding_intro")}
            </p>
            <p className="text-sm font-medium mb-4" style={{ color: GREEN_DARK }}>
              {t("consent.recommend_all")}
            </p>
            <div className="space-y-4">
              {CONSENT_SERVICE_KEYS.map((key) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{t(`consent.${key}_label`)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t(`consent.${key}_desc`)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={consentChoices[key]}
                    onClick={() => setConsentChoices((prev) => ({ ...prev, [key]: !prev[key] }))}
                    data-testid={`toggle-consent-${key}`}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5 ${
                      consentChoices[key] ? "bg-[#214B36]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        consentChoices[key] ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-4">
              {t("consent.onboarding_footer")}
            </p>
          </OnboardingCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-page-v2 min-h-screen pt-6 pb-8 px-4" data-testid="onboarding-container">
      {isPreview && (
        <div
          className="mx-auto mb-3 flex items-center gap-2 px-3 py-2"
          data-testid="banner-preview-mode"
          style={{
            maxWidth: 380,
            background: "#fff7d6",
            border: "1.5px solid #d4a72c",
            color: "#7a5a14",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Eye size={14} />
          <span className="flex-1">Preview mode — nothing will be saved</span>
          <button
            type="button"
            onClick={exitPreview}
            data-testid="button-exit-preview"
            aria-label="Exit preview"
            style={{ display: "flex", alignItems: "center" }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {step > 0 && step <= TOTAL_STEPS && (
        <div className="mx-auto" style={{ maxWidth: 380 }}>
          <Progress
            value={(step / TOTAL_STEPS) * 100}
            className="mb-3 h-2"
            data-testid="progress-bar"
          />
          <p className="text-xs mb-4 text-center" style={{ color: GREEN_DARK, opacity: 0.7 }} data-testid="text-step-indicator">
            {t("onboarding.step_of", { step, total: TOTAL_STEPS })}
          </p>
        </div>
      )}

      <div className={direction === "forward" ? "slide-in-forward" : "slide-in-backward"} key={step}>
        {renderStep()}
      </div>
    </div>
  );
}
