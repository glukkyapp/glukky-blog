import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const TOTAL_STEPS = 6;

const struggles = [
  { value: "sugary_food_drink", label: "Sugary Food & Drinks" },
  { value: "oily_fried_food", label: "Oily/Fried Food" },
  { value: "eat_out", label: "Eating Out / Takeaway" },
  { value: "portions", label: "Portion Control" },
  { value: "snacks", label: "Snacking" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

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
        title: "Your lifestyle is very healthy!",
        description: "Let's add a small improvement to keep you on track.",
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
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocation("/plan");
    } catch (error: unknown) {
      toast({
        title: "Error",
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
    if (step === 1) return !walkOption;
    if (step === 2) return !dinnerTime;
    if (step === 3) return !sleepPattern;
    if (step === 4) return !eatingOutFrequency;
    return false;
  };

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
        Step {step} of {TOTAL_STEPS}
      </p>

      {step === 1 && (
        <Card data-testid="card-step-1">
          <CardHeader>
            <CardTitle className="text-lg">After meals, what do you usually do?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("sit_rest", "Sit/rest", walkOption, setWalkOption, "option-sit-rest")}
            {renderRadioOption("walk_10", "Walk about 10 min", walkOption, setWalkOption, "option-walk-10")}
            {renderRadioOption("walk_longer", "Walk longer than 10 min", walkOption, setWalkOption, "option-walk-longer")}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card data-testid="card-step-2">
          <CardHeader>
            <CardTitle className="text-lg">What time do you usually have dinner?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("before_9pm", "Before 9pm", dinnerTime, setDinnerTime, "option-before-9pm")}
            {renderRadioOption("after_9pm", "After 9pm", dinnerTime, setDinnerTime, "option-after-9pm")}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card data-testid="card-step-3">
          <CardHeader>
            <CardTitle className="text-lg">What is your sleep pattern?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("regular_10_6", "10pm-6am regular", sleepPattern, setSleepPattern, "option-regular-10-6")}
            {renderRadioOption("other_regular", "Other regular schedule", sleepPattern, setSleepPattern, "option-other-regular")}
            {renderRadioOption("night_shifts", "Night shifts", sleepPattern, setSleepPattern, "option-night-shifts")}
            {renderRadioOption("irregular", "Irregular", sleepPattern, setSleepPattern, "option-irregular")}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card data-testid="card-step-4">
          <CardHeader>
            <CardTitle className="text-lg">How often do you eat out per week?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {renderRadioOption("0", "Rarely (0)", eatingOutFrequency, setEatingOutFrequency, "option-rarely")}
            {renderRadioOption("1-2", "1-2 times", eatingOutFrequency, setEatingOutFrequency, "option-1-2")}
            {renderRadioOption("3-4", "3-4 times", eatingOutFrequency, setEatingOutFrequency, "option-3-4")}
            {renderRadioOption("5+", "5+ times", eatingOutFrequency, setEatingOutFrequency, "option-5-plus")}
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card data-testid="card-step-5">
          <CardHeader>
            <CardTitle className="text-lg">Which diet areas do you struggle with?</CardTitle>
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

      {step === 6 && (
        <Card data-testid="card-step-6">
          <CardHeader>
            <CardTitle className="text-lg">Enter your email for daily reminders (optional)</CardTitle>
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
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} disabled={isNextDisabled()} data-testid="button-next">
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} data-testid="button-get-started">
            {submitting ? "Saving..." : "Get Started"}
          </Button>
        )}
      </div>
    </div>
  );
}
