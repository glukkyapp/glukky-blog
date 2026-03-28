import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const TOTAL_STEPS = 10;

export default function Onboarding() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [userName, setUserName] = useState("");
  const [userGoal, setUserGoal] = useState("");
  const [walkOption, setWalkOption] = useState<string>("");
  const [dinnerTime, setDinnerTime] = useState<string>("");
  const [sleepPattern, setSleepPattern] = useState<string>("");
  const [eatingOutFrequency, setEatingOutFrequency] = useState<string>("");
  const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);
  const [notificationEmail, setNotificationEmail] = useState("");

  const getWalkData = () => {
    if (walkOption === "sit_rest") return { walksPerWeek: 0, walkDuration: 0 };
    if (walkOption === "walk_10") return { walksPerWeek: 3, walkDuration: 10 };
    if (walkOption === "walk_longer") return { walksPerWeek: 3, walkDuration: 15 };
    return { walksPerWeek: 0, walkDuration: 0 };
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    const { walksPerWeek, walkDuration } = getWalkData();
    let struggles = selectedStruggles;
    if (struggles.length === 0) {
      struggles = ["sugary_food_drink"];
      toast({
        title: t("onboarding.get_started"),
        description: t("onboarding.saving"),
      });
    }
    try {
      await apiRequest("POST", "/api/profile", {
        walksPerWeek,
        walkDuration,
        dinnerTime,
        sleepPattern,
        eatingOutFrequency,
        struggles,
        notificationEmail,
        preferredLanguage: i18n.language || "en",
        name: userName.trim() || null,
        goal: userGoal.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocation("/plan");
    } catch (error: unknown) {
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

  const renderRadioOption = (
    value: string,
    label: string,
    selected: string,
    onSelect: (v: string) => void,
    testId: string
  ) => (
    <button
      key={value}
      type="button"
      data-testid={testId}
      onClick={() => onSelect(value)}
      className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
        selected === value
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-sm mx-auto px-4 pt-8" data-testid="onboarding-container">
      <Progress
        value={(step / TOTAL_STEPS) * 100}
        className="mb-6 h-2"
        data-testid="progress-bar"
      />
      <p className="text-sm text-muted-foreground mb-4" data-testid="text-step-indicator">
        {t("onboarding.step_of", { step, total: TOTAL_STEPS })}
      </p>

      {step === 1 && (
        <Card data-testid="card-step-name">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.name_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="user-name" className="sr-only">{t("onboarding.name_placeholder")}</Label>
            <Input
              id="user-name"
              type="text"
              placeholder={t("onboarding.name_placeholder")}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              data-testid="input-name"
            />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card data-testid="card-step-social-proof">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.social_proof_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm" data-testid="text-social-proof">
              {t("onboarding.social_proof_message")}
            </p>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card data-testid="card-step-why">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.why_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="user-goal" className="sr-only">{t("onboarding.why_placeholder")}</Label>
            <Textarea
              id="user-goal"
              placeholder={t("onboarding.why_placeholder")}
              value={userGoal}
              onChange={(e) => setUserGoal(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-goal"
            />
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card data-testid="card-step-questions-intro">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.questions_intro_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm" data-testid="text-questions-intro">
              {t("onboarding.questions_intro_body")}
            </p>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card data-testid="card-step-1">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.q1_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("sit_rest", t("onboarding.q1_sit_rest"), walkOption, setWalkOption, "option-sit-rest")}
            {renderRadioOption("walk_10", t("onboarding.q1_walk_10"), walkOption, setWalkOption, "option-walk-10")}
            {renderRadioOption("walk_longer", t("onboarding.q1_walk_longer"), walkOption, setWalkOption, "option-walk-longer")}
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card data-testid="card-step-2">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.q2_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("before_9pm", t("onboarding.q2_before_9pm"), dinnerTime, setDinnerTime, "option-before-9pm")}
            {renderRadioOption("after_9pm", t("onboarding.q2_after_9pm"), dinnerTime, setDinnerTime, "option-after-9pm")}
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card data-testid="card-step-3">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.q3_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("regular_10_6", t("onboarding.q3_regular_10_6"), sleepPattern, setSleepPattern, "option-regular-10-6")}
            {renderRadioOption("other_regular", t("onboarding.q3_other_regular"), sleepPattern, setSleepPattern, "option-other-regular")}
            {renderRadioOption("night_shifts", t("onboarding.q3_night_shifts"), sleepPattern, setSleepPattern, "option-night-shifts")}
            {renderRadioOption("irregular", t("onboarding.q3_irregular"), sleepPattern, setSleepPattern, "option-irregular")}
          </CardContent>
        </Card>
      )}

      {step === 8 && (
        <Card data-testid="card-step-4">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.q4_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("0", t("onboarding.q4_rarely"), eatingOutFrequency, setEatingOutFrequency, "option-rarely")}
            {renderRadioOption("1-2", t("onboarding.q4_1_2"), eatingOutFrequency, setEatingOutFrequency, "option-1-2")}
            {renderRadioOption("3-4", t("onboarding.q4_3_4"), eatingOutFrequency, setEatingOutFrequency, "option-3-4")}
            {renderRadioOption("5+", t("onboarding.q4_5_plus"), eatingOutFrequency, setEatingOutFrequency, "option-5-plus")}
          </CardContent>
        </Card>
      )}

      {step === 9 && (
        <Card data-testid="card-step-5">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.q5_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {struggles.map((item) => (
              <label
                key={item.value}
                className="flex items-center gap-3 cursor-pointer"
                data-testid={`checkbox-label-${item.value}`}
              >
                <Checkbox
                  checked={selectedStruggles.includes(item.value)}
                  onCheckedChange={() => toggleStruggle(item.value)}
                  data-testid={`checkbox-${item.value}`}
                />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 10 && (
        <Card data-testid="card-step-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("onboarding.q6_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="email" className="sr-only">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              data-testid="input-email"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-3 mt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={handleBack} data-testid="button-back">
            {t("onboarding.back")}
          </Button>
        ) : (
          <div />
        )}

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} disabled={isNextDisabled()} data-testid="button-next">
            {t("onboarding.next")}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} data-testid="button-get-started">
            {submitting ? t("onboarding.saving") : t("onboarding.get_started")}
          </Button>
        )}
      </div>
    </div>
  );
}
