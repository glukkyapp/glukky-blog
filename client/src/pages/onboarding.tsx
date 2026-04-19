import { useState } from "react";
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
import { Bed, Moon, Clock } from "lucide-react";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useGlobalLoading } from "@/components/global-loading-overlay";
import {
  OnboardingCard,
  PillOption,
  RowOption,
  IconTileOption,
  PairedTile,
  DarkInsetTile,
} from "@/components/onboarding-ui";
import {
  HelloIllustration,
  WelcomeIllustration,
  PostMealIllustration,
  DinnerIllustration,
  SleepIllustration,
  EatingOutIllustration,
  StrugglesIllustration,
  HealthIllustration,
  ReferralIllustration,
  EmailIllustration,
  GoalIllustration,
  TransitionIllustration,
  StruggleIcons,
  HealthIcons,
} from "@/components/onboarding-illustrations";

const TOTAL_STEPS = 12;
const GREEN_DARK = "#214B36";

export default function Onboarding() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  useGlobalLoading(submitting);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const [userName, setUserName] = useState("");
  const [userGoal, setUserGoal] = useState("");
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
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const handleBack = () => {
    hapticTap("SOFT");
    setDirection("backward");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    hapticTap("MEDIUM");
    setSubmitting(true);
    const { walksPerWeek, walkDuration } = getWalkData();
    try {
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
      hapticNotify("SUCCESS");
      setLocation("/plan");
    } catch (error: unknown) {
      hapticNotify("ERROR");
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStruggle = (value: string) => {
    setSelectedStruggles((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const isNextDisabled = () => {
    if (step === 1) return !userName.trim();
    if (step === 3) return !userGoal.trim();
    if (step === 5) return !walkOption;
    if (step === 6) return !dinnerTime;
    if (step === 7) return !sleepPattern;
    if (step === 8) return !eatingOutFrequency;
    return false;
  };

  const struggles = [
    { value: "sugary_food_drink", label: t("struggle.sugary_food_drink") },
    { value: "oily_fried_food", label: t("struggle.oily_fried_food") },
    { value: "eat_out", label: t("struggle.eat_out") },
    { value: "portions", label: t("struggle.portions") },
    { value: "snacks", label: t("struggle.snacks") },
  ];

  const ctaButton = step < TOTAL_STEPS ? (
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

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <OnboardingCard
            testId="card-step-name"
            visual={<HelloIllustration />}
            title={t("onboarding.name_title")}
            footer={ctaButton}
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
            visual={<WelcomeIllustration />}
            title={t("onboarding.social_proof_title")}
            footer={ctaButton}
          >
            <p className="text-center text-sm" data-testid="text-social-proof" style={{ color: GREEN_DARK }}>
              {t("onboarding.social_proof_message")}
            </p>
          </OnboardingCard>
        );
      case 3:
        return (
          <OnboardingCard
            testId="card-step-why"
            visual={<GoalIllustration />}
            title={t("onboarding.why_title")}
            footer={ctaButton}
          >
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
            visual={<TransitionIllustration />}
            title={t("onboarding.questions_intro_title")}
            footer={ctaButton}
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
            footer={ctaButton}
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
      case 6:
        return (
          <OnboardingCard
            testId="card-step-2"
            visual={<DinnerIllustration />}
            title={t("onboarding.q2_title")}
            footer={ctaButton}
          >
            <div className="flex gap-3">
              <PairedTile
                topLabel="Before"
                bigLabel="< 9 pm"
                bottomLabel={t("onboarding.q2_before_9pm")}
                selected={dinnerTime === "before_9pm"}
                onClick={() => setDinnerTime("before_9pm")}
                testId="option-before-9pm"
              />
              <PairedTile
                topLabel="After"
                bigLabel="9 pm +"
                bottomLabel={t("onboarding.q2_after_9pm")}
                selected={dinnerTime === "after_9pm"}
                onClick={() => setDinnerTime("after_9pm")}
                testId="option-after-9pm"
              />
            </div>
          </OnboardingCard>
        );
      case 7:
        return (
          <OnboardingCard
            testId="card-step-3"
            variant="dark"
            visual={<SleepIllustration />}
            title={t("onboarding.q3_title")}
            footer={ctaButton}
          >
            <DarkInsetTile
              icon={<Bed size={20} style={{ color: "#cfe9b3" }} />}
              label={t("onboarding.q3_regular_10_6")}
              value="10pm"
              selected={sleepPattern === "regular_10_6"}
              onClick={() => setSleepPattern("regular_10_6")}
              testId="option-regular-10-6"
            />
            <DarkInsetTile
              icon={<Bed size={20} style={{ color: "#cfe9b3" }} />}
              label={t("onboarding.q3_other_regular")}
              selected={sleepPattern === "other_regular"}
              onClick={() => setSleepPattern("other_regular")}
              testId="option-other-regular"
            />
            <DarkInsetTile
              icon={<Clock size={20} style={{ color: "#cfe9b3" }} />}
              label={t("onboarding.q3_night_shifts")}
              selected={sleepPattern === "night_shifts"}
              onClick={() => setSleepPattern("night_shifts")}
              testId="option-night-shifts"
            />
            <DarkInsetTile
              icon={<Moon size={20} style={{ color: "#cfe9b3" }} />}
              label={t("onboarding.q3_irregular")}
              selected={sleepPattern === "irregular"}
              onClick={() => setSleepPattern("irregular")}
              testId="option-irregular"
            />
          </OnboardingCard>
        );
      case 8:
        return (
          <OnboardingCard
            testId="card-step-4"
            visual={<EatingOutIllustration />}
            title={t("onboarding.q4_title")}
            footer={ctaButton}
          >
            <div className="grid grid-cols-2 gap-2">
              <PillOption label={t("onboarding.q4_rarely")} selected={eatingOutFrequency === "0"} onClick={() => setEatingOutFrequency("0")} testId="option-rarely" />
              <PillOption label={t("onboarding.q4_1_2")} selected={eatingOutFrequency === "1-2"} onClick={() => setEatingOutFrequency("1-2")} testId="option-1-2" />
              <PillOption label={t("onboarding.q4_3_4")} selected={eatingOutFrequency === "3-4"} onClick={() => setEatingOutFrequency("3-4")} testId="option-3-4" />
              <PillOption label={t("onboarding.q4_5_plus")} selected={eatingOutFrequency === "5+"} onClick={() => setEatingOutFrequency("5+")} testId="option-5-plus" />
            </div>
          </OnboardingCard>
        );
      case 9:
        return (
          <OnboardingCard
            testId="card-step-5"
            visual={<StrugglesIllustration />}
            title={t("onboarding.q5_title")}
            footer={ctaButton}
          >
            {struggles.map((item) => (
              <RowOption
                key={item.value}
                icon={StruggleIcons[item.value as keyof typeof StruggleIcons]}
                label={item.label}
                selected={selectedStruggles.includes(item.value)}
                onClick={() => toggleStruggle(item.value)}
                testId={`checkbox-${item.value}`}
              />
            ))}
          </OnboardingCard>
        );
      case 10:
        return (
          <OnboardingCard
            testId="card-step-health"
            visual={<HealthIllustration />}
            title={t("onboarding.q6_health_title")}
            footer={ctaButton}
          >
            <div className="grid grid-cols-2 gap-2">
              <IconTileOption
                icon={HealthIcons.diabetes}
                label={t("onboarding.q6_diabetes")}
                selected={healthCondition === "diabetes"}
                onClick={() => setHealthCondition("diabetes")}
                testId="option-diabetes"
              />
              <IconTileOption
                icon={HealthIcons.prediabetes}
                label={t("onboarding.q6_prediabetes")}
                selected={healthCondition === "prediabetes"}
                onClick={() => setHealthCondition("prediabetes")}
                testId="option-prediabetes"
              />
              <IconTileOption
                icon={HealthIcons.no_but_health}
                label={t("onboarding.q6_no_but_health")}
                selected={healthCondition === "no_but_health"}
                onClick={() => setHealthCondition("no_but_health")}
                testId="option-no-but-health"
              />
              <IconTileOption
                icon={HealthIcons.prefer_not_tell}
                label={t("onboarding.q6_prefer_not_tell")}
                selected={healthCondition === "prefer_not_tell"}
                onClick={() => setHealthCondition("prefer_not_tell")}
                testId="option-prefer-not-tell"
              />
            </div>
          </OnboardingCard>
        );
      case 11:
        return (
          <OnboardingCard
            testId="card-step-referral"
            visual={<ReferralIllustration />}
            title={t("onboarding.q7_referral_title")}
            footer={ctaButton}
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
      case 12:
        return (
          <OnboardingCard
            testId="card-step-email"
            visual={<EmailIllustration />}
            title={t("onboarding.q8_title")}
            footer={ctaButton}
          >
            <Label htmlFor="email" className="sr-only">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              data-testid="input-email"
              style={{ borderRadius: 999, height: 48, background: "#fff" }}
            />
          </OnboardingCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-page-v2 min-h-screen pt-6 pb-8 px-4" data-testid="onboarding-container">
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

      <div className={direction === "forward" ? "slide-in-forward" : "slide-in-backward"} key={step}>
        {renderStep()}
      </div>

      {step > 1 && (
        <div className="mx-auto mt-4 flex justify-center" style={{ maxWidth: 380 }}>
          <Button
            variant="ghost"
            onClick={handleBack}
            data-testid="button-back"
            style={{ color: GREEN_DARK, borderRadius: 999 }}
          >
            {t("onboarding.back")}
          </Button>
        </div>
      )}
    </div>
  );
}
