import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CoinSavedPopup } from "@/components/coin-saved-popup";
import { InfoCardPopup, useInfoCard } from "@/components/info-card-popup";
import { FoodSwitchPopup, useFoodSwitchPopup } from "@/components/food-switch-popup";
import { Target, Check, X, Minus, Footprints, UtensilsCrossed, ShoppingBag, Clock, TrendingUp, Droplets, CalendarDays, Battery, CheckCircle2, Soup, Wine, Activity, Lightbulb, Timer, Info, ChevronDown, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DIET_TIP_I18N_KEYS, type UserProfile } from "@shared/schema";
import giftImg from "@assets/generated-image_(17)_1776599869514.png";
import { InfoSheet, useInfoSheet } from "@/components/info-sheet";
import { hapticTap, hapticNotify } from "@/lib/haptics";

function translateDietTip(tip: string, t: (key: string, opts?: any) => string): string {
  const i18nKey = DIET_TIP_I18N_KEYS[tip];
  return i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
}

function isDayStretch(day: any, profile: any): boolean {
  if (day?.isStretchDay) return true;
  if (profile?.isStretchMode && day?.walkScheduled && !day?.standingTap && day?.walkDuration === 2) return true;
  return false;
}

const STRUGGLE_ICON_MAP: Record<string, LucideIcon> = {
  sugary_food_drink: Wine,
  oily_fried_food: UtensilsCrossed,
  eat_out: Wine,
  portions: Soup,
  snacks: ShoppingBag,
};

function getStruggleIcon(struggle?: string): LucideIcon {
  return (struggle && STRUGGLE_ICON_MAP[struggle]) || TrendingUp;
}

const MITIGATION_OPTION_KEYS = [
  { value: "fiber_starter", labelKey: "mitigation.fiber_starter_label", descKey: "mitigation.fiber_starter_desc" },
  { value: "dusk_prep", labelKey: "mitigation.dusk_prep_label", descKey: "mitigation.dusk_prep_desc" },
  { value: "split_dinner", labelKey: "mitigation.split_dinner_label", descKey: "mitigation.split_dinner_desc" },
] as const;

export default function Home() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const dateLocale = i18n.language === "yue" ? "zh-HK" : i18n.language === "zh-Hant" ? "zh-TW" : "en-US";
  const DAY_NAMES = [t("day_short.mon"), t("day_short.tue"), t("day_short.wed"), t("day_short.thu"), t("day_short.fri"), t("day_short.sat"), t("day_short.sun")];
  const FULL_DAY_NAMES = [t("negotiation.day.monday"), t("negotiation.day.tuesday"), t("negotiation.day.wednesday"), t("negotiation.day.thursday"), t("negotiation.day.friday"), t("negotiation.day.saturday"), t("negotiation.day.sunday")];
  const DINNER_LABEL_SHORT: Record<string, string> = {
    move_early: t("mitigation.early_short"),
    fiber_starter: t("mitigation.fiber_short"),
    dusk_prep: t("mitigation.dusk_short"),
    split_dinner: t("mitigation.split_short"),
    none: "",
  };
  const { data: plan, isLoading: planLoading } = useQuery({ queryKey: ["/api/plan/current"] });
  const { data: profile } = useQuery<UserProfile>({ queryKey: ["/api/profile"] });

  const { data: devTime } = useQuery({ queryKey: ["/api/dev/time"] });
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [recorded, setRecorded] = useState(false);
  const [showTacticPicker, setShowTacticPicker] = useState(false);
  const [pivotStep, setPivotStep] = useState<"ask" | "ask_move_early" | "show_tactics" | null>(null);
  const [hydrationAdvice, setHydrationAdvice] = useState<string | null>(null);
  const [showTickAnimation, setShowTickAnimation] = useState(false);
  const userInteracted = useRef(false);
  const [catchupCompleted, setCatchupCompleted] = useState(false);
  const [catchupWalkDone, setCatchupWalkDone] = useState<boolean | null>(null);
  const [catchupWalkTired, setCatchupWalkTired] = useState<boolean | null>(null);
  const [catchupDinnerDone, setCatchupDinnerDone] = useState<boolean | null>(null);
  const [catchupDinnerChoice, setCatchupDinnerChoice] = useState<"early" | "tactic" | "none" | null>(null);
  const [catchupTacticPick, setCatchupTacticPick] = useState<string | null>(null);
  const [catchupDietResponse, setCatchupDietResponse] = useState<"yes" | "no" | "no_chance" | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [allSetDismissed, setAllSetDismissed] = useState(false);
  const [allSetFading, setAllSetFading] = useState(false);
  const [catchupAdjMsg, setCatchupAdjMsg] = useState<string | null>(null);
  const [coinPopupCoins, setCoinPopupCoins] = useState(0);
  const dismissCoinPopup = useCallback(() => setCoinPopupCoins(0), []);

  const cardFirstWalkDay = useInfoCard("first_walk_day");
  const cardStretchSwitch = useInfoCard("stretch_switch");
  const cardDinnerTiming = useInfoCard("dinner_timing");
  const cardDinnerTactics = useInfoCard("dinner_tactics");
  const foodSwitchPopup = useFoodSwitchPopup();
  const tacticInfoSheet = useInfoSheet();

  const effectiveHour = devTime?.timeOverride !== null && devTime?.timeOverride !== undefined
    ? devTime.timeOverride
    : currentHour;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  const realDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = (() => {
    if (devTime?.dateOverride) {
      return devTime.dateOverride;
    }
    return formatLocalDate(today);
  })();

  const dayOfWeek = (() => {
    if (devTime?.dateOverride) {
      const d = new Date(devTime.dateOverride + "T00:00:00");
      const jsDay = d.getDay();
      return jsDay === 0 ? 6 : jsDay - 1;
    }
    return realDayOfWeek;
  })();

  const planSundayStr = (() => {
    if (!plan?.startDate) return null;
    const s = typeof plan.startDate === 'string' ? plan.startDate : plan.startDate;
    const d = new Date(s + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return formatLocalDate(d);
  })();

  const lastSundayStr = (() => {
    const d = new Date(todayStr + "T00:00:00");
    const daysBack = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    d.setDate(d.getDate() - daysBack);
    return formatLocalDate(d);
  })();

  const isPastPlanWeek = !!planSundayStr && todayStr > planSundayStr;
  const isCatchUp = isPastPlanWeek && dayOfWeek !== 6;

  const { data: sundayLogData } = useQuery({
    queryKey: ["/api/log", isCatchUp ? planSundayStr : lastSundayStr],
    enabled: isCatchUp,
  });

  const weekNumber = (() => {
    const baseWeek = plan?.weekNumber || profile?.currentWeek || 1;
    if (plan?.startDate && todayStr < plan.startDate && baseWeek > 1) {
      return baseWeek - 1;
    }
    return baseWeek;
  })();
  const { data: calendarData } = useQuery({
    queryKey: ["/api/calendar", weekNumber],
    enabled: !!weekNumber,
  });
  const calendarPlan = calendarData?.plan;
  const planFirstActiveDay = calendarPlan?.firstActiveDay ?? 0;

  const cycle = (profile?.currentStruggleCycle as number) || 1;

  useEffect(() => { if (profile?.isStretchMode) cardStretchSwitch.trigger(); }, [profile?.isStretchMode]);
  useEffect(() => { if (cycle < 2 && calendarPlan?.isDinnerFocus) cardDinnerTiming.trigger(); }, [calendarPlan?.isDinnerFocus, cycle]);
  useEffect(() => { if (cycle < 2 && pivotStep === "show_tactics") cardDinnerTactics.trigger(); }, [pivotStep, cycle]);
  useEffect(() => { if (cycle < 2 && calendarPlan?.dietTip === "Food Switch") foodSwitchPopup.trigger(); }, [calendarPlan?.dietTip, cycle]);

  const sundayCheckInDone = (() => {
    if (!isCatchUp) return false;
    if (!sundayLogData) return false;
    const sunDate = isCatchUp ? planSundayStr : lastSundayStr;
    const sunPlanDay = calendarData?.calendar?.find((d: any) => d.dayOfWeek === 6);
    const sunLog = calendarData?.calendar?.find((d: any) => d.date === sunDate);
    if (!sunLog) return false;
    if (sunPlanDay?.walkScheduled) {
      if (sunLog.walkCompleted === null || sunLog.walkCompleted === undefined) return false;
      if (!sunPlanDay.standingTap && sunLog.walkCompleted === false && (sunLog.walkTired === null || sunLog.walkTired === undefined)) return false;
    }
    if (sunPlanDay?.lateDinnerScheduled) {
      if (sunLog.dinnerSuccess === null || sunLog.dinnerSuccess === undefined) return false;
    }
    if (calendarPlan?.dietTip) {
      const sunEatOutOk = calendarPlan?.dietStruggle !== "eat_out" || sunPlanDay?.eatOutScheduled === true;
      if (sunEatOutOk && (sunLog.dietResponse === null || sunLog.dietResponse === undefined)) return false;
    }
    return true;
  })();

  const checkInDate = isCatchUp && !sundayCheckInDone ? (planSundayStr || todayStr) : todayStr;
  const checkInDayOfWeek = isCatchUp && !sundayCheckInDone ? 6 : dayOfWeek;
  const isCatchUpCheckIn = isCatchUp && !sundayCheckInDone;
  const catchUpDayName = isCatchUpCheckIn ? FULL_DAY_NAMES[checkInDayOfWeek] : null;

  const missedScheduledDays = useMemo(() => {
    if (!calendarData?.calendar || isCatchUp) return [];
    const planHasDietTip = !!calendarData?.plan?.dietTip;
    return calendarData.calendar.filter((d: any) => {
      if (!d.date || d.date >= todayStr) return false;
      if (d.dayOfWeek < planFirstActiveDay) return false;
      if (d.walkScheduled && (d.walkCompleted === null || d.walkCompleted === undefined)) return true;
      if (d.lateDinnerScheduled && (d.dinnerSuccess === null || d.dinnerSuccess === undefined)) return true;
      if (planHasDietTip) {
        const isEatOutDay = calendarData?.plan?.dietStruggle !== "eat_out" || d.eatOutScheduled === true;
        if (isEatOutDay && (d.dietResponse === null || d.dietResponse === undefined)) return true;
      }
      return false;
    });
  }, [calendarData, todayStr, isCatchUp]);
  const missedDayCount = missedScheduledDays.length;
  const singleMissedDay = !catchupCompleted && missedDayCount === 1 ? missedScheduledDays[0] : null;

  const todayPlan = calendarData?.calendar?.find((d: any) => d.dayOfWeek === checkInDayOfWeek);
  const todayLog = calendarData?.calendar?.find((d: any) => d.date === checkInDate);

  useEffect(() => { if (cycle < 2 && todayPlan?.walkScheduled && effectiveHour >= 8) cardFirstWalkDay.trigger(); }, [todayPlan?.walkScheduled, effectiveHour, cycle]);
  const tomorrowDow = (dayOfWeek + 1) % 7;
  const tomorrowPlan = calendarData?.calendar?.find((d: any) => d.dayOfWeek === tomorrowDow);
  const tomorrowInPlanWeek = planSundayStr ? todayStr < planSundayStr : false;

  const isLateDinnerDay = todayPlan?.lateDinnerScheduled === true;
  const dinnerLabelSet = todayPlan?.dinnerLabel && todayPlan.dinnerLabel !== "none";

  const show2pmWindow = !isCatchUp && effectiveHour >= 14 && isLateDinnerDay;
  const isPlanFirstDayNoLog = planFirstActiveDay > 0 && planFirstActiveDay === dayOfWeek && !todayLog;
  const show10pmWindow = ((isCatchUp && !sundayCheckInDone) || effectiveHour >= 22) && !isPlanFirstDayNoLog;

  async function checkAllDoneAfterInteraction() {
    userInteracted.current = true;
    await queryClient.refetchQueries({ queryKey: ["/api/calendar", weekNumber] });
    if (isCatchUp) {
      await queryClient.refetchQueries({ queryKey: ["/api/log", isCatchUp ? planSundayStr : lastSundayStr] });
    }
    const freshData = queryClient.getQueryData<any>(["/api/calendar", weekNumber]);
    if (!freshData) return;
    const tp = freshData.calendar?.find((d: any) => d.date === checkInDate);
    if (!tp) return;

    const labelSet = tp.dinnerLabel && tp.dinnerLabel !== "none";
    const isCatchUpCheck = isCatchUp && !sundayCheckInDone;
    const is2pmOnly = !isCatchUpCheck && effectiveHour >= 14 && effectiveHour < 22 && tp.lateDinnerScheduled;

    if (is2pmOnly) {
      return;
    }

    if (isCatchUpCheck || effectiveHour >= 22) {
      let allDone = true;
      if (tp.lateDinnerScheduled) {
        if (isCatchUpCheck) {
          if (tp.dinnerSuccess === null || tp.dinnerSuccess === undefined) allDone = false;
        } else {
          if (tp.dinnerSuccess === false) {
            // Recorded as failed — complete without requiring a label
          } else if (!labelSet) {
            allDone = false;
          } else if (tp.dinnerSuccess === null) {
            allDone = false;
          }
        }
      }
      if (tp.walkScheduled) {
        if (tp.walkCompleted === null) allDone = false;
        if (!tp.standingTap && (tp.walkTired === null || tp.walkTired === undefined)) allDone = false;
      }
      if (calendarPlan?.dietTip) {
        const isEatOutDay = calendarPlan?.dietStruggle !== "eat_out" || tp.eatOutScheduled === true;
        if (isEatOutDay && tp.dietResponse === null) allDone = false;
      }

      if (allDone) {
        setShowTickAnimation(true);
        setTimeout(() => {
          setShowTickAnimation(false);
          setRecorded(true);
          toast({ title: t("home.nice_work"), description: isCatchUpCheck ? t("home.sunday_done") : t("home.coming_up") });
          if (isCatchUpCheck) {
            queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
            queryClient.invalidateQueries({ queryKey: ["/api/log"] });
            queryClient.invalidateQueries({ queryKey: ["/api/plan/current"] });
          }
        }, 1200);
      }
    }
  }

  const logMutation = useMutation({
    mutationFn: async (data: any) => {
      hapticTap("LIGHT");
      const res = await apiRequest("POST", "/api/log", { date: checkInDate, ...data });
      return res.json();
    },
    onSuccess: async (data: any, variables: any) => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/plan/current"] });

      if (variables.dietResponse !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      }

      if (data?.coinsAwarded > 0) {
        setCoinPopupCoins(data.coinsAwarded);
        queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      }

      if (data?.nextDayAdjustment && (variables.walkTired !== undefined || variables.walkCompleted !== undefined)) {
        await queryClient.refetchQueries({ queryKey: ["/api/calendar", weekNumber] });
        const freshData = queryClient.getQueryData<any>(["/api/calendar", weekNumber]);
        const freshLog = freshData?.calendar?.find((d: any) => d.date === checkInDate);
        const walkDone = freshLog?.walkCompleted !== null && freshLog?.walkCompleted !== undefined;
        const tiredDone = freshLog?.walkTired !== null && freshLog?.walkTired !== undefined;

        if (walkDone && tiredDone) {
          const adj = data.nextDayAdjustment;
          if (adj.convertedToStretch) {
            const isConsecutiveStretch = todayPlan?.isStretchDay;
            setHydrationAdvice(isConsecutiveStretch
              ? t("home.hydration_stretch_keep")
              : t("home.hydration_stretch_switch"));
          } else if (!adj.tomorrowWalkScheduled) {
            setHydrationAdvice(t("home.hydration_rest"));
          } else if (adj.reduced && adj.newDuration) {
            setHydrationAdvice(t("home.hydration_reduced", { duration: adj.newDuration }));
          } else if (adj.walkCompleted) {
            setHydrationAdvice(t("home.hydration_walk"));
          } else {
            setHydrationAdvice(t("home.hydration_walk"));
          }
        }
      }

      await checkAllDoneAfterInteraction();
    },
    onError: (error: Error) => {
      hapticNotify("ERROR");
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const catchupMutation = useMutation({
    mutationFn: async (data: { date: string; walkCompleted?: boolean | null; walkTired?: boolean | null; dinnerSuccess?: boolean | null; dietResponse?: string | null }) => {
      hapticTap("LIGHT");
      const res = await apiRequest("POST", "/api/log", data);
      return res.json();
    },
    onSuccess: async (data: any, variables: any) => {
      hapticNotify("SUCCESS");
      if (variables.dietResponse !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      }
      await queryClient.refetchQueries({ queryKey: ["/api/calendar", weekNumber] });

      if (data?.coinsAwarded > 0) {
        setCoinPopupCoins(data.coinsAwarded);
        queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] });
      }

      const wasTiredMiss = variables.walkCompleted === false && variables.walkTired === true;
      if (data?.nextDayAdjustment) {
        const adj = data.nextDayAdjustment;
        if (adj.convertedToStretch) {
          setCatchupAdjMsg(t("home.catchup_stretch"));
        } else if (adj.reduced && adj.newDuration) {
          setCatchupAdjMsg(t("home.catchup_reduced", { duration: adj.newDuration }));
        } else if (wasTiredMiss) {
          setCatchupAdjMsg(t("home.catchup_tired_ease"));
        } else if (adj.tomorrowWalkScheduled) {
          setCatchupAdjMsg(t("home.catchup_all_set"));
        }
      } else if (wasTiredMiss) {
        setCatchupAdjMsg(t("home.catchup_tired_ease"));
      }
      setCatchupCompleted(true);
    },
    onError: (error: Error) => {
      hapticNotify("ERROR");
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const dinnerLabelMutation = useMutation({
    mutationFn: async (data: { planDayId: number; label: string }) => {
      hapticTap("LIGHT");
      const res = await apiRequest("POST", "/api/plan/dinner-label", data);
      return res.json();
    },
    onSuccess: async () => {
      hapticNotify("SUCCESS");
      await checkAllDoneAfterInteraction();
    },
    onError: (error: Error) => {
      hapticNotify("ERROR");
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  function handleDinnerMoveEarly(canMove: boolean) {
    if (!todayPlan?.planDayId) return;
    if (canMove) {
      dinnerLabelMutation.mutate({ planDayId: todayPlan.planDayId, label: "move_early" });
    } else {
      setShowTacticPicker(true);
    }
  }

  function handleTacticPick(tactic: string) {
    if (!todayPlan?.planDayId) return;
    dinnerLabelMutation.mutate({ planDayId: todayPlan.planDayId, label: tactic });
    setShowTacticPicker(false);
    if (show10pmWindow) {
      logMutation.mutate({ dinnerSuccess: true });
    }
  }


  const effectiveDate = (() => {
    if (devTime?.dateOverride) {
      return new Date(devTime.dateOverride + "T00:00:00");
    }
    return today;
  })();

  const formatDate = (date?: Date) => {
    const d = date || effectiveDate;
    return d.toLocaleDateString(dateLocale, { weekday: "short", month: "short", day: "numeric" });
  };

  const formatWeekday = () => {
    return effectiveDate.toLocaleDateString(dateLocale, { weekday: "long", month: "short", day: "numeric" });
  };

  const formatTomorrowDate = () => {
    const tmrw = new Date(effectiveDate);
    tmrw.setDate(tmrw.getDate() + 1);
    return formatDate(tmrw);
  };

  if (planLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  function renderTomorrowPlan(dayData: any, dateLabel: string, overrideDietTip?: string, overrideDietStruggle?: string) {
    if (!dayData) return null;

    const dietTip = overrideDietTip ?? calendarPlan?.dietTip;
    const dietStruggle = overrideDietStruggle ?? calendarPlan?.dietStruggle;

    const tasks: { icon: any; text: string; testId: string; color: string; bgColor: string }[] = [];
    if (dayData.walkScheduled) {
      if (dayData.standingTap) {
        tasks.push({ icon: Timer, text: t("home.standing_tap_task"), testId: "text-plan-standing-tap", color: "#5F9D7A", bgColor: "#EEF5EF" });
      } else {
        const isStretch = isDayStretch(dayData, profile);
        const dur = isStretch ? 2 : dayData.walkDuration;
        tasks.push({ icon: isStretch ? Activity : Footprints, text: isStretch ? t("home.stretch_task", { duration: dur }) : t("home.walk_task", { duration: dur }), testId: "text-plan-walk", color: "#5F9D7A", bgColor: "#EEF5EF" });
      }
    }
    if (dayData.lateDinnerScheduled) {
      tasks.push({ icon: UtensilsCrossed, text: t("home.late_dinner_task"), testId: "text-plan-late-dinner", color: "#5F9D7A", bgColor: "#EEF5EF" });
    }
    if (dietTip) {
      const showDietTask = dietStruggle !== "eat_out" || dayData.eatOutScheduled === true;
      if (showDietTask) tasks.push({ icon: getStruggleIcon(dietStruggle), text: `"${translateDietTip(dietTip, t)}"`, testId: "text-plan-diet", color: "#5F9D7A", bgColor: "#EEF5EF" });
    }

    return (
      <div
        className="space-y-3"
        style={{ background: "#fbfbf3", borderRadius: 28, padding: 22, boxShadow: "0 4px 14px rgba(44, 72, 56, 0.06)" }}
      >
        <div className="flex items-center gap-2 text-[14px] tracking-wider uppercase" style={{ color: "#6E8477" }} data-testid="text-plan-date">
          <span className="font-semibold text-[21px] uppercase" style={{ color: "#214B36" }}>{t("home.tomorrow")}</span>
          <span>— {dateLabel}</span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-[18px]" style={{ color: "#6E8477" }}>{t("home.rest_day")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-1">
            {tasks.map((task, idx) => {
              const Icon = task.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-2 py-2"
                  data-testid={task.testId}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 60, height: 60, borderRadius: 20, background: "#ffffff", border: "none" }}
                  >
                    <Icon className="w-7 h-7" style={{ color: task.color }} />
                  </div>
                  <p className="text-[16px] text-center leading-tight" style={{ color: "#214B36" }}>{task.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderReadOnlyPlan(dayData: any, label: string, dateLabel: string) {
    if (!dayData) return null;

    const tasks: { icon: any; text: string; testId: string; color: string; bgColor: string }[] = [];
    if (dayData.walkScheduled) {
      if (dayData.standingTap) {
        tasks.push({ icon: Timer, text: t("home.standing_tap_task"), testId: "text-plan-standing-tap", color: "#5F9D7A", bgColor: "#EEF5EF" });
      } else {
        const isStretch = isDayStretch(dayData, profile);
        const dur = isStretch ? 2 : dayData.walkDuration;
        tasks.push({ icon: isStretch ? Activity : Footprints, text: isStretch ? t("home.stretch_task", { duration: dur }) : t("home.walk_task", { duration: dur }), testId: "text-plan-walk", color: "#5F9D7A", bgColor: "#EEF5EF" });
      }
    }
    if (dayData.lateDinnerScheduled) {
      tasks.push({ icon: UtensilsCrossed, text: t("home.late_dinner_task"), testId: "text-plan-late-dinner", color: "#5F9D7A", bgColor: "#EEF5EF" });
    }
    if (calendarPlan?.dietTip) {
      const showDietTask = calendarPlan?.dietStruggle !== "eat_out" || dayData.eatOutScheduled === true;
      if (showDietTask) tasks.push({ icon: getStruggleIcon(calendarPlan?.dietStruggle), text: `"${translateDietTip(calendarPlan.dietTip, t)}"`, testId: "text-plan-diet", color: "#5F9D7A", bgColor: "#EEF5EF" });
    }

    return (
      <div
        className="space-y-3"
        style={{ background: "#fbfbf3", borderRadius: 28, padding: 22, boxShadow: "0 4px 14px rgba(44, 72, 56, 0.06)" }}
      >
        <div className="flex items-center gap-2 text-[14px] tracking-wider uppercase" style={{ color: "#6E8477" }} data-testid="text-plan-date">
          <span className="font-semibold" style={{ color: "#214B36" }}>{label}</span>
          <span>— {dateLabel}</span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-[18px]" style={{ color: "#6E8477" }}>{t("home.rest_day")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-1">
            {tasks.map((task, idx) => {
              const Icon = task.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-2 py-2"
                  data-testid={task.testId}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 60, height: 60, borderRadius: 20, background: "#ffffff", border: "none" }}
                  >
                    <Icon className="w-7 h-7" style={{ color: task.color }} />
                  </div>
                  <p className="text-[16px] text-center leading-tight" style={{ color: "#214B36" }}>{task.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderDinnerCheckIn() {
    if (!isLateDinnerDay || !todayPlan) return null;

    if (dinnerLabelSet) {
      const label = todayPlan.dinnerLabel !== "none" ? todayPlan.dinnerLabel : "";
      return (
        <div className="space-y-2 bg-green-50 dark:bg-green-950/30 rounded-lg p-3" data-testid="section-dinner-confirmed">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {label === "move_early"
                ? t("home.plan_move_dinner")
                : t("home.plan_tactic", { tactic: DINNER_LABEL_SHORT[label] || label })
              }
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{t("home.follow_up_10pm")}</p>
        </div>
      );
    }

    if (showTacticPicker) {
      return (
        <div className="space-y-3" data-testid="section-dinner-tactic">
          <p className="text-sm font-medium">{catchUpDayName ? t("home.dinner_catchup_tactic", { day: catchUpDayName }) : t("home.dinner_pick_plan")}</p>
          {MITIGATION_OPTION_KEYS.map(opt => (
            <div
              key={opt.value}
              className="w-full flex items-center rounded-lg text-sm bg-muted overflow-hidden"
              data-testid={`row-tactic-${opt.value}`}
            >
              <button
                onClick={() => handleTacticPick(opt.value)}
                className="flex-1 text-left p-3 hover:bg-primary/10 transition-colors"
                data-testid={`button-tactic-${opt.value}`}
                disabled={dinnerLabelMutation.isPending}
              >
                <span className="font-medium">{t(opt.labelKey)}</span>
                <span className="text-muted-foreground"> — {t(opt.descKey)}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); tacticInfoSheet.openSheet({ title: t(opt.labelKey), body: <p className="text-sm text-muted-foreground">{t(`mitigation.${opt.value}_detail`)}</p> }); }}
                className="shrink-0 px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid={`button-info-tactic-${opt.value}`}
                aria-label={t(opt.labelKey)}
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      );
    }

    if (isCatchUpCheckIn) {
      return (
        <div className="space-y-3" data-testid="section-dinner-catchup">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">{t("home.dinner_question_day", { day: catchUpDayName })}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (todayPlan?.planDayId) {
                  dinnerLabelMutation.mutate({ planDayId: todayPlan.planDayId, label: "move_early" });
                }
                logMutation.mutate({ dinnerSuccess: true });
              }}
              disabled={dinnerLabelMutation.isPending || logMutation.isPending}
              data-testid="button-catchup-dinner-early"
            >
              {t("home.moved_early")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowTacticPicker(true); }}
              disabled={dinnerLabelMutation.isPending || logMutation.isPending}
              data-testid="button-catchup-dinner-tactic"
            >
              {t("home.used_tactic")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                logMutation.mutate({ dinnerSuccess: false });
              }}
              disabled={dinnerLabelMutation.isPending || logMutation.isPending}
              data-testid="button-catchup-dinner-no"
            >
              {t("home.didnt_manage")}
            </Button>
          </div>
        </div>
      );
    }

    if (!isCatchUpCheckIn && effectiveHour >= 22 && !dinnerLabelSet) {
      return (
        <div className="space-y-3" data-testid="section-dinner-late-checkin">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">{t("home.dinner_tonight_question")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (todayPlan?.planDayId) {
                  dinnerLabelMutation.mutate({ planDayId: todayPlan.planDayId, label: "move_early" });
                }
                logMutation.mutate({ dinnerSuccess: true });
              }}
              disabled={dinnerLabelMutation.isPending || logMutation.isPending}
              data-testid="button-dinner-late-early"
            >
              {t("home.moved_early")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowTacticPicker(true);
              }}
              disabled={dinnerLabelMutation.isPending || logMutation.isPending}
              data-testid="button-dinner-late-tactic"
            >
              {t("home.used_tactic")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                logMutation.mutate({ dinnerSuccess: false });
              }}
              disabled={dinnerLabelMutation.isPending || logMutation.isPending}
              data-testid="button-dinner-late-no"
            >
              {t("home.didnt_manage")}
            </Button>
          </div>
        </div>
      );
    }

    const shouldPivot = plan?.lastWeekDinnerEarlyPct === 0 && plan?.prevPrevWeekDinnerEarlyPct === 0 && plan?.currentWeek > 2;

    if (shouldPivot) {
      const firstLateDinnerDow = calendarData?.calendar
        ?.filter((d: any) => d.lateDinnerScheduled)
        ?.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek)?.[0]?.dayOfWeek;
      const isFirstLateDinnerDay = checkInDayOfWeek === firstLateDinnerDow;

      const firstLateDinnerDayData = calendarData?.calendar?.find((d: any) => d.dayOfWeek === firstLateDinnerDow);
      const firstDayLabel = firstLateDinnerDayData?.dinnerLabel;
      const firstDayChoseEarly = firstDayLabel === "move_early";
      const firstDayChoseTactic = firstDayLabel && firstDayLabel !== "none" && firstDayLabel !== "move_early";

      if (!isFirstLateDinnerDay && firstDayChoseEarly) {
        return (
          <div className="space-y-2" data-testid="section-dinner-question">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium">{t("home.try_eating_earlier")}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDinnerMoveEarly(true)}
                disabled={dinnerLabelMutation.isPending}
                data-testid="button-dinner-move-yes"
              >
                {t("common.yes")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDinnerMoveEarly(false)}
                disabled={dinnerLabelMutation.isPending}
                data-testid="button-dinner-move-no"
              >
                {t("common.no")}
              </Button>
            </div>
          </div>
        );
      }

      if (!isFirstLateDinnerDay && (firstDayChoseTactic || !firstDayLabel || firstDayLabel === "none")) {
        return (
          <div className="space-y-3" data-testid="section-dinner-tactic">
            <p className="text-sm font-medium">{t("home.dinner_pick_plan")}</p>
            {MITIGATION_OPTION_KEYS.map(opt => (
              <div
                key={opt.value}
                className="w-full flex items-center rounded-lg text-sm bg-muted overflow-hidden"
                data-testid={`row-tactic-${opt.value}`}
              >
                <button
                  onClick={() => handleTacticPick(opt.value)}
                  className="flex-1 text-left p-3 hover:bg-primary/10 transition-colors"
                  data-testid={`button-tactic-${opt.value}`}
                  disabled={dinnerLabelMutation.isPending}
                >
                  <span className="font-medium">{t(opt.labelKey)}</span>
                  <span className="text-muted-foreground"> — {t(opt.descKey)}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); tacticInfoSheet.openSheet({ title: t(opt.labelKey), body: <p className="text-sm text-muted-foreground">{t(`mitigation.${opt.value}_detail`)}</p> }); }}
                  className="shrink-0 px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  data-testid={`button-info-tactic-${opt.value}`}
                  aria-label={t(opt.labelKey)}
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        );
      }

      const effectivePivotStep = pivotStep || "ask";

      if (effectivePivotStep === "ask") {
        return (
          <div className="space-y-3" data-testid="section-dinner-pivot">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium">{t("home.late_dinner_row")}</p>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-dinner-pivot-message">
              {t("home.dinner_pivot_message")}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setPivotStep("show_tactics"); }} data-testid="button-pivot-tactic-yes">{t("common.yes")}</Button>
              <Button size="sm" variant="outline" onClick={() => { setPivotStep("ask_move_early"); }} data-testid="button-pivot-tactic-no">{t("common.no")}</Button>
            </div>
          </div>
        );
      }

      if (effectivePivotStep === "ask_move_early") {
        return (
          <div className="space-y-3" data-testid="section-dinner-pivot-move-early">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium">{t("home.late_dinner_row")}</p>
            </div>
            <p className="text-sm text-muted-foreground">{t("home.try_moving_dinner")}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleDinnerMoveEarly(true)} disabled={dinnerLabelMutation.isPending} data-testid="button-pivot-move-early-yes">{t("common.yes")}</Button>
              <Button size="sm" variant="outline" onClick={() => { setPivotStep("show_tactics"); }} data-testid="button-pivot-move-early-no">{t("common.no")}</Button>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3" data-testid="section-dinner-pivot-tactics">
          <p className="text-sm font-medium">{t("home.dinner_pick_plan")}</p>
          {MITIGATION_OPTION_KEYS.map(opt => (
            <div
              key={opt.value}
              className="w-full flex items-center rounded-lg text-sm bg-muted overflow-hidden"
              data-testid={`row-tactic-${opt.value}`}
            >
              <button
                onClick={() => handleTacticPick(opt.value)}
                className="flex-1 text-left p-3 hover:bg-primary/10 transition-colors"
                data-testid={`button-tactic-${opt.value}`}
                disabled={dinnerLabelMutation.isPending}
              >
                <span className="font-medium">{t(opt.labelKey)}</span>
                <span className="text-muted-foreground"> — {t(opt.descKey)}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); tacticInfoSheet.openSheet({ title: t(opt.labelKey), body: <p className="text-sm text-muted-foreground">{t(`mitigation.${opt.value}_detail`)}</p> }); }}
                className="shrink-0 px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid={`button-info-tactic-${opt.value}`}
                aria-label={t(opt.labelKey)}
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2" data-testid="section-dinner-question">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium">{t("home.try_eating_earlier")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDinnerMoveEarly(true)}
            disabled={dinnerLabelMutation.isPending}
            data-testid="button-dinner-move-yes"
          >
            {t("common.yes")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDinnerMoveEarly(false)}
            disabled={dinnerLabelMutation.isPending}
            data-testid="button-dinner-move-no"
          >
            {t("common.no")}
          </Button>
        </div>
      </div>
    );
  }

  function renderDinnerFollowUp() {
    if (!isLateDinnerDay || !dinnerLabelSet) return null;
    if (todayLog?.dinnerSuccess !== null && todayLog?.dinnerSuccess !== undefined) {
      return (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 rounded-lg p-3" data-testid="section-dinner-followup-done">
          <Check className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700 dark:text-green-400">
            {t("home.dinner_checkin_recorded")}: {todayLog.dinnerSuccess ? t("common.yes") : t("common.no")}
          </p>
        </div>
      );
    }

    const label = todayPlan?.dinnerLabel;
    const tacticShort = t(`mitigation.${label}_short`, { defaultValue: DINNER_LABEL_SHORT[label] || label });
    const question = label === "move_early"
      ? (catchUpDayName ? t("home.eat_before_9pm", { day: catchUpDayName }) : t("home.eat_before_9pm_today"))
      : (catchUpDayName ? t("home.follow_tip_on", { tip: tacticShort, day: catchUpDayName }) : t("home.follow_tip_today", { tip: tacticShort }));

    return (
      <div className="space-y-2" data-testid="section-dinner-followup">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium">{question}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={todayLog?.dinnerSuccess === true ? "default" : "outline"}
            className={todayLog?.dinnerSuccess === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            onClick={() => logMutation.mutate({ dinnerSuccess: true })}
            disabled={logMutation.isPending}
            data-testid="button-dinner-yes"
          >
            {t("home.dinner_yes")}
          </Button>
          <Button
            size="sm"
            variant={todayLog?.dinnerSuccess === false ? "default" : "outline"}
            className={todayLog?.dinnerSuccess === false ? "bg-red-500 hover:bg-red-600 text-white" : ""}
            onClick={() => logMutation.mutate({ dinnerSuccess: false })}
            disabled={logMutation.isPending}
            data-testid="button-dinner-no"
          >
            {t("home.dinner_no")}
          </Button>
        </div>
      </div>
    );
  }

  function renderStandingTapCheckIn() {
    if (!todayPlan?.standingTap) return null;

    const tapAnswered = todayLog?.walkCompleted !== null && todayLog?.walkCompleted !== undefined;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium">{t("home.standing_tap_task")}</p>
        </div>
        {tapAnswered ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="section-standing-tap-answered">
            {todayLog.walkCompleted ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
            <span>{todayLog.walkCompleted ? t("home.completed") : t("home.skipped")}</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{catchUpDayName ? t("home.standing_tap_question_day", { day: catchUpDayName }) : t("home.standing_tap_question")}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={todayLog?.walkCompleted === true ? "default" : "outline"}
                className={todayLog?.walkCompleted === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ walkCompleted: true, walkTired: false })}
                disabled={logMutation.isPending}
                data-testid="button-standing-tap-yes"
              >
                {t("common.yes")}
              </Button>
              <Button
                size="sm"
                variant={todayLog?.walkCompleted === false ? "default" : "outline"}
                className={todayLog?.walkCompleted === false ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                onClick={() => logMutation.mutate({ walkCompleted: false, walkTired: false })}
                disabled={logMutation.isPending}
                data-testid="button-standing-tap-no"
              >
                {t("common.no")}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderWalkCheckIn() {
    if (!todayPlan?.walkScheduled) return null;
    if (todayPlan?.standingTap) return renderStandingTapCheckIn();

    const walkAnswered = todayLog?.walkCompleted !== null && todayLog?.walkCompleted !== undefined;
    const tiredAnswered = todayLog?.walkTired !== null && todayLog?.walkTired !== undefined;
    const bothAnswered = walkAnswered && tiredAnswered;

    const isStretch = isDayStretch(todayPlan, profile);
    const walkDur = isStretch ? 2 : todayPlan?.walkDuration;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {isStretch ? <Activity className="w-4 h-4 text-primary" /> : <Footprints className="w-4 h-4 text-primary" />}
          <p className="text-sm font-medium">{isStretch ? t("home.stretch_task", { duration: walkDur }) : t("home.walk_task", { duration: walkDur })}</p>
        </div>
        {bothAnswered ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="section-walk-answered">
            <div className="flex items-center gap-1.5">
              {todayLog.walkCompleted ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )}
              <span>{todayLog.walkCompleted ? t("home.completed") : t("home.skipped")}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-amber-500" />
              <span>{todayLog.walkTired ? t("home.feeling_tired_label") : t("home.feeling_good")}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={todayLog?.walkCompleted === true ? "default" : "outline"}
                className={todayLog?.walkCompleted === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ walkCompleted: true })}
                disabled={logMutation.isPending}
                data-testid="button-walk-yes"
              >
                {t("common.yes")}
              </Button>
              <Button
                size="sm"
                variant={todayLog?.walkCompleted === false ? "default" : "outline"}
                className={todayLog?.walkCompleted === false ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                onClick={() => logMutation.mutate({ walkCompleted: false })}
                disabled={logMutation.isPending}
                data-testid="button-walk-no"
              >
                {t("common.no")}
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-medium">{catchUpDayName ? t("home.feeling_tired_day", { day: catchUpDayName }) : t("home.feeling_tired_today")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={todayLog?.walkTired === true ? "default" : "outline"}
                  className={todayLog?.walkTired === true ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  onClick={() => logMutation.mutate({ walkTired: true })}
                  disabled={logMutation.isPending}
                  data-testid="button-tired-yes"
                >
                  {t("common.tired_yes")}
                </Button>
                <Button
                  size="sm"
                  variant={todayLog?.walkTired === false ? "default" : "outline"}
                  className={todayLog?.walkTired === false ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  onClick={() => logMutation.mutate({ walkTired: false })}
                  disabled={logMutation.isPending}
                  data-testid="button-tired-no"
                >
                  {t("common.tired_no")}
                </Button>
              </div>
            </div>
          </>
        )}

        {hydrationAdvice && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg mt-2" data-testid="section-hydration-advice">
            <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{hydrationAdvice}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs mt-1 text-blue-600"
                onClick={() => { setHydrationAdvice(null); }}
                data-testid="button-dismiss-hydration"
              >
                {t("home.got_it")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDietCheckIn() {
    if (!calendarPlan?.dietTip) return null;
    if (calendarPlan?.dietStruggle === "eat_out" && !todayPlan?.eatOutScheduled) return null;

    const dietAnswered = todayLog?.dietResponse !== null && todayLog?.dietResponse !== undefined;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {(() => { const DietIcon = getStruggleIcon(calendarPlan?.dietStruggle); return <DietIcon className="w-4 h-4 text-primary" />; })()}
          <p className="text-sm font-medium">{t("home.diet_tactic_label")}</p>
        </div>
        <p className="text-sm text-primary font-medium" data-testid="text-diet-tip">"{translateDietTip(calendarPlan.dietTip, t)}"</p>
        {dietAnswered ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="section-diet-answered">
            {todayLog.dietResponse === "yes" ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : todayLog.dietResponse === "no" ? (
              <X className="w-4 h-4 text-red-400" />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            )}
            <span>
              {todayLog.dietResponse === "yes" ? (catchUpDayName ? t("home.tried_on_day", { day: catchUpDayName }) : t("home.tried_today")) :
               todayLog.dietResponse === "no" ? (catchUpDayName ? t("home.didnt_try_day", { day: catchUpDayName }) : t("home.didnt_try_today")) : t("home.didnt_get_chance")}
            </span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{catchUpDayName ? t("home.diet_chance_day", { day: catchUpDayName }) : t("home.diet_chance_today")}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={todayLog?.dietResponse === "yes" ? "default" : "outline"}
                className={todayLog?.dietResponse === "yes" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ dietResponse: "yes" })}
                disabled={logMutation.isPending}
                data-testid="button-diet-yes"
              >
                {t("common.yes")}
              </Button>
              <Button
                size="sm"
                variant={todayLog?.dietResponse === "no" ? "default" : "outline"}
                className={todayLog?.dietResponse === "no" ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                onClick={() => logMutation.mutate({ dietResponse: "no" })}
                disabled={logMutation.isPending}
                data-testid="button-diet-no"
              >
                {t("common.no")}
              </Button>
              <Button
                size="sm"
                variant={todayLog?.dietResponse === "no_chance" ? "default" : "outline"}
                className={todayLog?.dietResponse === "no_chance" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => logMutation.mutate({ dietResponse: "no_chance" })}
                disabled={logMutation.isPending}
                data-testid="button-diet-no-chance"
              >
                {t("home.didnt_get_chance")}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  function isAllCheckInDone() {
    if (!todayLog) return false;
    if (todayPlan?.walkScheduled) {
      if (todayLog.walkCompleted === null || todayLog.walkCompleted === undefined) return false;
      if (!todayPlan?.standingTap) {
        if (todayLog.walkTired === null || todayLog.walkTired === undefined) return false;
      }
    }
    if (isLateDinnerDay) {
      if (isCatchUpCheckIn) {
        if (todayLog.dinnerSuccess === null || todayLog.dinnerSuccess === undefined) return false;
      } else {
        if (!dinnerLabelSet) return false;
        if (todayLog.dinnerSuccess === null || todayLog.dinnerSuccess === undefined) return false;
      }
    }
    if (calendarPlan?.dietTip) {
      const isEatOutDay = calendarPlan?.dietStruggle !== "eat_out" || todayPlan?.eatOutScheduled === true;
      if (isEatOutDay && (todayLog.dietResponse === null || todayLog.dietResponse === undefined)) return false;
    }
    return true;
  }

  function renderCheckInCard() {
    const is2pmOnly = show2pmWindow && !show10pmWindow;
    const is10pm = show10pmWindow;
    const allDone = is10pm && isAllCheckInDone();

    if (showTickAnimation) {
      return (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
              <span className="font-semibold text-foreground">{t("home.today")}</span> — {formatDate()}
            </div>
            <div className="flex items-center justify-center py-10" data-testid="section-tick-animation">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <CheckCircle2 className="w-20 h-20 text-green-500" />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (allDone) {
      return (
        <>
          {hydrationAdvice && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="section-hydration-advice-summary">
              <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{hydrationAdvice}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs mt-1 text-blue-600"
                  onClick={() => setHydrationAdvice(null)}
                  data-testid="button-dismiss-hydration-summary"
                >
                  {t("home.got_it")}
                </Button>
              </div>
            </div>
          )}
        </>
      );
    }

    const rawSections: any[] = [];

    if (is2pmOnly && isLateDinnerDay) {
      rawSections.push(renderDinnerCheckIn());
    }

    if (is10pm) {
      const dinnerAnswered = todayLog?.dinnerSuccess !== null && todayLog?.dinnerSuccess !== undefined;
      if (isLateDinnerDay && !dinnerLabelSet && !dinnerAnswered) {
        rawSections.push(renderDinnerCheckIn());
      }
      if (isLateDinnerDay && dinnerLabelSet && !dinnerAnswered) {
        rawSections.push(renderDinnerFollowUp());
      }
      if (todayPlan?.walkScheduled) {
        const walkAnswered = todayLog?.walkCompleted !== null && todayLog?.walkCompleted !== undefined;
        const walkFullyAnswered = walkAnswered && (todayPlan?.standingTap || (todayLog?.walkTired !== null && todayLog?.walkTired !== undefined));
        if (!isCatchUpCheckIn || !walkFullyAnswered) {
          rawSections.push(renderWalkCheckIn());
        }
      }
      if (calendarPlan?.dietTip) {
        const dietAnswered = todayLog?.dietResponse !== null && todayLog?.dietResponse !== undefined;
        if (!isCatchUpCheckIn || !dietAnswered) {
          rawSections.push(renderDietCheckIn());
        }
      }
    }

    const sections = rawSections
      .filter(Boolean)
      .map((content, idx) => ({ num: idx + 1, content }));

    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-today-date">
            <span className="font-semibold text-foreground">
              {isCatchUp ? t("home.sunday_checkin") : t("home.today")}
            </span> — {isCatchUp ? formatCatchUpDate() : formatDate()}
          </div>

          {sections.map(({ num, content }) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: (num - 1) * 0.08, ease: "easeOut" }}
              className="rounded-lg bg-muted/50 p-3 space-y-2"
              data-testid={`section-checkin-task-${num}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {num}
                </div>
              </div>
              {content}
            </motion.div>
          ))}

        </CardContent>
      </Card>
    );
  }

  const showCheckIn = show2pmWindow || show10pmWindow;
  const checkInDone = recorded
    || (show10pmWindow && isAllCheckInDone());
  const isSundayEvening = dayOfWeek === 6 && effectiveHour >= 22;
  const nextWeekPlanned = !!(plan?.startDate && todayStr < plan.startDate);
  const showReviewCard = !nextWeekPlanned && (
    (isSundayEvening && checkInDone)
    || (isCatchUp && (sundayCheckInDone || recorded))
  );

  useEffect(() => {
    if (!nextWeekPlanned || !plan?.startDate) return;
    const storageKey = "allSetDismissedPlan";
    const dismissed = sessionStorage.getItem(storageKey);
    if (dismissed === plan.startDate) {
      if (!allSetDismissed) setAllSetDismissed(true);
      return;
    }
    setAllSetDismissed(false);
    setAllSetFading(false);
    let innerTimer: ReturnType<typeof setTimeout>;
    const fadeTimer = setTimeout(() => {
      setAllSetFading(true);
      innerTimer = setTimeout(() => {
        setAllSetDismissed(true);
        sessionStorage.setItem(storageKey, plan.startDate);
      }, 500);
    }, 5000);
    return () => { clearTimeout(fadeTimer); clearTimeout(innerTimer); };
  }, [nextWeekPlanned, plan?.startDate]);

  const formatCatchUpDate = () => {
    if (!planSundayStr) return "";
    const d = new Date(planSundayStr + "T00:00:00");
    return d.toLocaleDateString(dateLocale, { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <>
    <motion.div
      className="app-page-v2 home-page-v2 max-w-sm mx-auto px-6 pt-7 pb-28 space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="space-y-0.5">
        <div data-testid="text-week-header">
          <h1 className="text-[26px] font-normal" style={{ color: "#214B36" }}>{formatWeekday()}</h1>
        </div>
        <div className="flex items-center justify-between gap-3 -mt-2">
          <p className="text-[50px] font-bold leading-none flex-1 min-w-0" style={{ color: "#214B36" }} data-testid="text-greeting">
            {profile?.name
              ? t("home.greeting_with_name", { name: profile.name })
              : t("home.greeting_no_name")}
          </p>
          <img src={giftImg} alt="" className="w-16 h-16 shrink-0" data-testid="img-gift-greeting" />
        </div>
      </div>

      {profile?.goal && (
        <div className="goal-bubble-wrap">
          <div
            className="min-w-0 goal-bubble"
            data-testid="text-goal-reminder"
          >
            <p className="text-[18px] leading-snug" style={{ color: "#214B36" }}>
              {(() => {
                const full = t("home.goal_reminder", { goal: "{{GOAL}}" });
                const parts = full.split("{{GOAL}}");
                return <>{parts[0]}<strong style={{ color: "#214B36" }}>{profile.goal}</strong>{parts[1]}</>;
              })()}
            </p>
          </div>
        </div>
      )}

      {isCatchUp && !sundayCheckInDone && !recorded && (
        <Card className="is-alert border-amber-300/50 bg-amber-50 dark:bg-amber-950/20" data-testid="card-catchup-banner">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {t("home.catchup_banner")}
              </p>
            </div>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">
              {t("home.catchup_desc", { date: formatCatchUpDate() })}
            </p>
          </CardContent>
        </Card>
      )}

      {singleMissedDay && !isCatchUp && (
        <Card className="is-alert border-amber-300/50 bg-amber-50 dark:bg-amber-950/20" data-testid="card-missed-day-catchup">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {t("home.log_checkin")}
              </p>
            </div>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              {t("home.missed_checkin_desc", { day: FULL_DAY_NAMES[singleMissedDay.dayOfWeek] })}
            </p>
            {singleMissedDay.walkScheduled && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{singleMissedDay.standingTap ? t("home.standing_tap_question_day", { day: FULL_DAY_NAMES[singleMissedDay.dayOfWeek] }) : isDayStretch(singleMissedDay, profile) ? t("home.stretch_question_day", { day: FULL_DAY_NAMES[singleMissedDay.dayOfWeek] }) : t("home.walk_question_day", { day: FULL_DAY_NAMES[singleMissedDay.dayOfWeek] })}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant={catchupWalkDone === true ? "default" : "outline"} onClick={() => { setCatchupWalkDone(true); }} data-testid="button-catchup-walk-yes">{t("common.yes")}</Button>
                  <Button size="sm" variant={catchupWalkDone === false ? "default" : "outline"} onClick={() => { setCatchupWalkDone(false); }} data-testid="button-catchup-walk-no">{t("common.no")}</Button>
                </div>
                {!singleMissedDay.standingTap && catchupWalkDone === false && (
                  <div className="space-y-2 pl-1">
                    <p className="text-sm text-muted-foreground">{t("home.tired_question_day", { day: FULL_DAY_NAMES[singleMissedDay.dayOfWeek] })}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant={catchupWalkTired === true ? "default" : "outline"} onClick={() => { setCatchupWalkTired(true); }} data-testid="button-catchup-tired-yes">{t("common.tired_yes")}</Button>
                      <Button size="sm" variant={catchupWalkTired === false ? "default" : "outline"} onClick={() => { setCatchupWalkTired(false); }} data-testid="button-catchup-tired-no">{t("common.tired_no")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {singleMissedDay.lateDinnerScheduled && (() => {
              const missedDayName = FULL_DAY_NAMES[singleMissedDay.dayOfWeek];
              const label = singleMissedDay.dinnerLabel;
              const hasLabel = label && label !== "none";
              if (hasLabel && label === "move_early") {
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t("home.eat_before_9pm", { day: missedDayName })}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant={catchupDinnerDone === true ? "default" : "outline"} onClick={() => { setCatchupDinnerDone(true); }} data-testid="button-catchup-dinner-yes">{t("common.yes")}</Button>
                      <Button size="sm" variant={catchupDinnerDone === false ? "default" : "outline"} onClick={() => { setCatchupDinnerDone(false); }} data-testid="button-catchup-dinner-no">{t("common.no")}</Button>
                    </div>
                  </div>
                );
              }
              if (hasLabel) {
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t("home.follow_tip_on", { tip: DINNER_LABEL_SHORT[label] || label, day: missedDayName })}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant={catchupDinnerDone === true ? "default" : "outline"} onClick={() => { setCatchupDinnerDone(true); }} data-testid="button-catchup-dinner-yes">{t("common.yes")}</Button>
                      <Button size="sm" variant={catchupDinnerDone === false ? "default" : "outline"} onClick={() => { setCatchupDinnerDone(false); }} data-testid="button-catchup-dinner-no">{t("common.no")}</Button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("home.dinner_question_day", { day: missedDayName })}</p>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant={catchupDinnerChoice === "early" ? "default" : "outline"} onClick={() => { setCatchupDinnerChoice("early"); setCatchupDinnerDone(true); }} data-testid="button-catchup-dinner-early">{t("home.moved_early")}</Button>
                    <Button size="sm" variant={catchupDinnerChoice === "tactic" ? "default" : "outline"} onClick={() => { setCatchupDinnerChoice("tactic"); }} data-testid="button-catchup-dinner-tactic">{t("home.used_tactic")}</Button>
                    <Button size="sm" variant={catchupDinnerChoice === "none" ? "default" : "outline"} onClick={() => { setCatchupDinnerChoice("none"); setCatchupDinnerDone(false); setCatchupTacticPick(null); }} data-testid="button-catchup-dinner-none">{t("home.didnt_manage")}</Button>
                  </div>
                  {catchupDinnerChoice === "tactic" && (
                    <div className="space-y-2 pl-1">
                      <p className="text-xs text-muted-foreground">{t("home.which_tactic")}</p>
                      <div className="flex flex-col gap-1">
                        {MITIGATION_OPTION_KEYS.map(opt => (
                          <div key={opt.value} className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={catchupTacticPick === opt.value ? "default" : "outline"}
                              onClick={() => { setCatchupTacticPick(opt.value); setCatchupDinnerDone(true); }}
                              data-testid={`button-catchup-tactic-${opt.value}`}
                              className="flex-1"
                            >
                              {t(opt.labelKey)}
                            </Button>
                            <button
                              onClick={(e) => { e.stopPropagation(); tacticInfoSheet.openSheet({ title: t(opt.labelKey), body: <p className="text-sm text-muted-foreground">{t(`mitigation.${opt.value}_detail`)}</p> }); }}
                              className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors"
                              data-testid={`button-info-catchup-tactic-${opt.value}`}
                              aria-label={t(opt.labelKey)}
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {calendarPlan?.dietTip && (calendarPlan?.dietStruggle !== "eat_out" || singleMissedDay.eatOutScheduled) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("home.diet_tip_question_day", { day: FULL_DAY_NAMES[singleMissedDay.dayOfWeek] })}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant={catchupDietResponse === "yes" ? "default" : "outline"} onClick={() => { setCatchupDietResponse("yes"); }} data-testid="button-catchup-diet-yes">{t("common.yes")}</Button>
                  <Button size="sm" variant={catchupDietResponse === "no" ? "default" : "outline"} onClick={() => { setCatchupDietResponse("no"); }} data-testid="button-catchup-diet-no">{t("common.no")}</Button>
                  <Button size="sm" variant={catchupDietResponse === "no_chance" ? "default" : "outline"} onClick={() => { setCatchupDietResponse("no_chance"); }} data-testid="button-catchup-diet-no-chance">{t("home.didnt_get_chance")}</Button>
                </div>
              </div>
            )}
            <Button
              size="sm"
              className="w-full btn-pop"
              onClick={async () => {
                if (singleMissedDay.lateDinnerScheduled && (!singleMissedDay.dinnerLabel || singleMissedDay.dinnerLabel === "none")) {
                  if (catchupDinnerChoice === "early" && singleMissedDay.planDayId) {
                    await dinnerLabelMutation.mutateAsync({ planDayId: singleMissedDay.planDayId, label: "move_early" });
                  } else if (catchupDinnerChoice === "tactic" && catchupTacticPick && singleMissedDay.planDayId) {
                    await dinnerLabelMutation.mutateAsync({ planDayId: singleMissedDay.planDayId, label: catchupTacticPick });
                  }
                }
                catchupMutation.mutate({
                  date: singleMissedDay.date,
                  walkCompleted: singleMissedDay.walkScheduled ? catchupWalkDone : undefined,
                  walkTired: singleMissedDay.walkScheduled && !singleMissedDay.standingTap && catchupWalkDone === false ? catchupWalkTired : undefined,
                  dinnerSuccess: singleMissedDay.lateDinnerScheduled ? catchupDinnerDone : undefined,
                  dietResponse: calendarPlan?.dietTip && (calendarPlan?.dietStruggle !== "eat_out" || singleMissedDay.eatOutScheduled) ? catchupDietResponse : undefined,
                });
              }}
              disabled={
                catchupMutation.isPending || dinnerLabelMutation.isPending ||
                (singleMissedDay.walkScheduled && catchupWalkDone === null) ||
                (!singleMissedDay.standingTap && singleMissedDay.walkScheduled && catchupWalkDone === false && catchupWalkTired === null) ||
                (singleMissedDay.lateDinnerScheduled && catchupDinnerDone === null && catchupDinnerChoice === null) ||
                (singleMissedDay.lateDinnerScheduled && (!singleMissedDay.dinnerLabel || singleMissedDay.dinnerLabel === "none") && catchupDinnerChoice === "tactic" && !catchupTacticPick) ||
                (calendarPlan?.dietTip && (calendarPlan?.dietStruggle !== "eat_out" || singleMissedDay.eatOutScheduled) && catchupDietResponse === null)
              }
              data-testid="button-catchup-submit"
            >
              {catchupMutation.isPending || dinnerLabelMutation.isPending ? t("home.saving") : t("home.log_day")}
            </Button>
          </CardContent>
        </Card>
      )}

      {catchupAdjMsg && !singleMissedDay && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 flex items-start gap-2" data-testid="section-catchup-adj-msg">
          <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">{catchupAdjMsg}</p>
        </div>
      )}

      {nextWeekPlanned && (
        <>
          {!allSetDismissed && (
            <div className={`transition-opacity duration-500 ${allSetFading ? "opacity-0" : "opacity-100"}`}>
              <Card className="is-emphasis border-primary/30 bg-primary/5" data-testid="card-all-set">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6" style={{ color: "#5F9D7A" }} />
                    <p className="text-[22px] font-semibold" style={{ color: "#214B36" }} data-testid="text-all-set">{t("home.all_set")}</p>
                  </div>
                  <p className="text-[18px] leading-snug" style={{ color: "#3F6B52" }}>{t("home.all_set_desc")}</p>
                </CardContent>
              </Card>
            </div>
          )}
          {(() => {
            const tmrwDow = (dayOfWeek + 1) % 7;
            const tmrwDay = plan?.days?.find((d: any) => d.dayOfWeek === tmrwDow);
            if (!tmrwDay) return null;
            return renderTomorrowPlan(tmrwDay, formatTomorrowDate(), plan?.dietTip, plan?.dietStruggle);
          })()}
        </>
      )}

      {!nextWeekPlanned && showReviewCard && (
        <Card className="is-emphasis border-primary/30 bg-primary/5" data-testid="card-weekly-report-ready">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              <p className="text-sm font-semibold">
                {isCatchUp
                  ? t("home.report_not_viewed")
                  : t("home.report_ready")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {isCatchUp
                ? t("home.report_not_viewed_desc")
                : t("home.report_ready_desc")}
            </p>
            <Button
              size="sm"
              onClick={() => { hapticTap("LIGHT"); setLocation("/plan"); }}
              data-testid="button-go-to-planner"
            >
              {t("home.review_plan")}
            </Button>
          </CardContent>
        </Card>
      )}

      {!nextWeekPlanned && (
        checkInDone ? (
          <>
            {hydrationAdvice && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="section-hydration-advice-recorded">
                <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{hydrationAdvice}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs mt-1 text-blue-600"
                    onClick={() => setHydrationAdvice(null)}
                    data-testid="button-dismiss-hydration-recorded"
                  >
                    {t("home.got_it")}
                  </Button>
                </div>
              </div>
            )}
            {tomorrowInPlanWeek && renderTomorrowPlan(tomorrowPlan, formatTomorrowDate())}
          </>
        ) : showCheckIn ? (
          renderCheckInCard()
        ) : (
          renderReadOnlyPlan(todayPlan, t("home.today"), formatDate())
        )
      )}

      {!nextWeekPlanned && calendarPlan?.isDinnerFocus && !calendarPlan?.dietStruggle && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2" data-testid="section-home-dinner-focus">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold">{t("home.focus_dinner")}</p>
            </div>
            {(() => {
              const dinnerDaysData = calendarData?.calendar?.filter((d: any) => d.lateDinnerScheduled || (d.dinnerLabel && d.dinnerLabel !== "none")) || [];
              const dinnerSuccess = dinnerDaysData.filter((d: any) => d.dinnerSuccess === true).length;
              const dinnerAnswered = dinnerDaysData.filter((d: any) => d.dinnerSuccess !== null).length;
              return dinnerAnswered > 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-dinner-focus-stats">
                  {t("home.dinner_tactics_followed", { success: dinnerSuccess, total: dinnerAnswered })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-dinner-focus-hint">
                  {t("home.choose_tactic_hint")}</p>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {!nextWeekPlanned && calendarPlan?.dietStruggle && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2" data-testid="section-home-diet-focus">
              {(() => { const FocusIcon = getStruggleIcon(calendarPlan.dietStruggle); return <FocusIcon className="w-4 h-4 text-primary" />; })()}
              <p className="text-sm font-semibold">{t("home.focus_label", { name: t(`struggle.${calendarPlan.dietStruggle}`, { defaultValue: calendarPlan.dietStruggle.replace(/_/g, " ") }) })}</p>
            </div>
            {calendarPlan.dietTip && <p className="text-sm text-primary font-medium" data-testid="text-diet-focus-tip">"{translateDietTip(calendarPlan.dietTip, t)}"</p>}
          </CardContent>
        </Card>
      )}

      {(<Card className="is-calendar bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setCalendarExpanded(prev => !prev)}
            aria-expanded={calendarExpanded}
            data-testid="button-toggle-calendar"
          >
            <p className="text-[21px] font-semibold uppercase" data-testid="text-calendar-title">{t("home.weekly_calendar")}</p>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${calendarExpanded ? "rotate-180" : ""}`} />
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${calendarExpanded ? "max-h-[500px] opacity-100 mt-3" : "max-h-0 opacity-0"}`}
          >
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-1 text-center text-xs">
              <div />
              {DAY_NAMES.map(n => (
                <div key={n} className="font-medium text-muted-foreground">{n}</div>
              ))}
            </div>

            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[12px] text-muted-foreground font-medium text-right pr-1">{profile?.isStretchMode ? t("home.stretch_row") : t("home.walk_row")}</div>
              {calendarData?.calendar?.map((d: any, i: number) => {
                const inactive = d.dayOfWeek < planFirstActiveDay;
                const isFuture = d.date > todayStr;
                const answered = !isFuture && !inactive && d.walkCompleted !== null && d.walkCompleted !== undefined;
                const isStandingTap = !!d.standingTap;
                const calStretch = isDayStretch(d, profile);
                const dur = isStandingTap ? 1 : (calStretch ? 2 : d.walkDuration);
                return (
                  <div key={i} className={`rounded flex flex-col items-center justify-center ${
                    inactive ? "bg-muted/30 h-7" :
                    isStandingTap && answered && d.walkCompleted ? "bg-amber-100 text-amber-600 h-10" :
                    isStandingTap && answered && !d.walkCompleted ? "bg-red-50 text-red-400 h-10" :
                    isStandingTap ? "bg-amber-50 text-amber-500 h-10" :
                    answered && d.walkCompleted ? "bg-green-100 text-green-600 h-10" :
                    answered && !d.walkCompleted ? "bg-red-50 text-red-400 h-10" :
                    d.walkScheduled ? "bg-muted h-10" : "bg-muted h-7"
                  }`}>
                    {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                     isStandingTap ? (
                       <>
                         {answered ? (d.walkCompleted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />) : <Timer className="w-3 h-3" />}
                         <span className="text-[11px] leading-none mt-0.5">{t("home.duration_min_short", { duration: 1 })}</span>
                       </>
                     ) :
                     answered && d.walkCompleted ? (
                       <>
                         <Check className="w-3 h-3" />
                         {dur && <span className="text-[11px] leading-none mt-0.5">{t("home.duration_min_short", { duration: dur })}</span>}
                       </>
                     ) :
                     answered && !d.walkCompleted ? (
                       <>
                         <X className="w-3 h-3" />
                         {dur && <span className="text-[11px] leading-none mt-0.5">{t("home.duration_min_short", { duration: dur })}</span>}
                       </>
                     ) :
                     d.walkScheduled ? (
                       <>
                         {isDayStretch(d, profile) ? <Activity className="w-3 h-3 text-muted-foreground" /> : <Footprints className="w-3 h-3 text-muted-foreground" />}
                         {dur && <span className="text-[11px] leading-none mt-0.5 text-muted-foreground">{t("home.duration_min_short", { duration: dur })}</span>}
                       </>
                     ) : null}
                  </div>
                );
              })}
            </div>

            {calendarData?.calendar?.some((d: any) => d.lateDinnerScheduled) && (cycle < 2 || calendarPlan?.isDinnerFocus) && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[12px] text-muted-foreground font-medium text-right pr-1 leading-tight">{t("home.late_dinner_row")}</div>
                {calendarData?.calendar?.map((d: any, i: number) => {
                  const inactive = d.dayOfWeek < planFirstActiveDay;
                  const isFuture = d.date > todayStr;
                  const answered = !isFuture && !inactive && d.dinnerSuccess !== null && d.dinnerSuccess !== undefined;
                  const isMitigation = d.dinnerLabel && ["fiber_starter", "dusk_prep", "split_dinner"].includes(d.dinnerLabel);
                  return (
                    <div key={i} className={`h-7 rounded flex flex-col items-center justify-center ${
                      inactive ? "bg-muted/30" :
                      !d.lateDinnerScheduled ? "bg-muted" :
                      answered && d.dinnerSuccess ? "bg-green-100 text-green-600" :
                      answered && !d.dinnerSuccess ? "bg-red-50 text-red-400" :
                      isMitigation ? "bg-amber-50 text-amber-600" :
                      "bg-muted"
                    }`}>
                      {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                       !d.lateDinnerScheduled ? null :
                       answered && d.dinnerSuccess ? <Check className="w-3 h-3" /> :
                       answered && !d.dinnerSuccess ? <X className="w-3 h-3" /> :
                       isMitigation ? <Lightbulb className="w-3 h-3" /> :
                       <Soup className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
            )}

            {calendarData?.calendar?.some((d: any) => d.eatOutScheduled) && !calendarPlan?.isDinnerFocus && (!calendarPlan?.dietStruggle || calendarPlan?.dietStruggle === 'eat_out') && (cycle < 2 || calendarPlan?.dietStruggle === 'eat_out') && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[12px] text-muted-foreground font-medium text-right pr-1 leading-tight">{t("home.eat_out_row")}</div>
                {calendarData?.calendar?.map((d: any, i: number) => {
                  const inactive = d.dayOfWeek < planFirstActiveDay;
                  const isFuture = d.date > todayStr;
                  const answered = !isFuture && !inactive && d.dietResponse !== null && d.dietResponse !== undefined;
                  return (
                    <div key={i} className={`h-7 rounded flex items-center justify-center ${
                      inactive ? "bg-muted/30" :
                      !d.eatOutScheduled ? "bg-muted" :
                      answered && d.dietResponse === "yes" ? "bg-green-100 text-green-600" :
                      answered && d.dietResponse === "no" ? "bg-red-50 text-red-400" :
                      answered && d.dietResponse === "no_chance" ? "bg-gray-100 text-gray-400" :
                      "bg-muted"
                    }`}>
                      {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                       !d.eatOutScheduled ? null :
                       answered && d.dietResponse === "yes" ? <Check className="w-3 h-3" /> :
                       answered && d.dietResponse === "no" ? <X className="w-3 h-3" /> :
                       answered && d.dietResponse === "no_chance" ? <Minus className="w-3 h-3" /> :
                       <Wine className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
            )}

            {calendarPlan?.dietTip && calendarPlan?.dietStruggle !== 'eat_out' && (
              <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
                <div className="text-[12px] text-muted-foreground font-medium text-right pr-1">{t("home.diet_row")}</div>
                {calendarData?.calendar?.map((d: any, i: number) => {
                  const inactive = d.dayOfWeek < planFirstActiveDay;
                  const isFuture = d.date > todayStr;
                  const resp = (isFuture || inactive) ? null : d.dietResponse;
                  return (
                    <div key={i} className={`h-7 rounded flex items-center justify-center ${
                      inactive ? "bg-muted/30" :
                      resp === "yes" ? "bg-green-100 text-green-600" :
                      resp === "no" ? "bg-red-50 text-red-400" :
                      resp === "no_chance" ? "bg-gray-100 text-gray-400" :
                      "bg-muted"
                    }`}>
                      {inactive ? <Minus className="w-3 h-3 text-muted-foreground/30" /> :
                       resp === "yes" ? <Check className="w-3 h-3" /> :
                       resp === "no" ? <X className="w-3 h-3" /> :
                       resp === "no_chance" ? <Minus className="w-3 h-3" /> : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2 text-[12px] text-muted-foreground flex-wrap" data-testid="calendar-legend">
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> {t("home.done")}</div>
              <div className="flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> {t("home.missed")}</div>
              <div className="flex items-center gap-1">
                {profile?.isStretchMode ? <Activity className="w-3 h-3" /> : <Footprints className="w-3 h-3" />}
                {profile?.isStretchMode ? ` ${t("home.planned_stretch")}` : ` ${t("home.planned_walk")}`}
              </div>
              {calendarData?.calendar?.some((d: any) => d.standingTap) && (
                <div className="flex items-center gap-1"><Timer className="w-3 h-3 text-amber-500" /> {t("home.standing_tap_legend")}</div>
              )}
              {calendarData?.calendar?.some((d: any) => d.lateDinnerScheduled) && (cycle < 2 || calendarPlan?.isDinnerFocus) && (
                <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> {t("home.late_dinner_legend")}</div>
              )}
              {calendarData?.calendar?.some((d: any) => d.lateDinnerScheduled) && (cycle < 2 || calendarPlan?.isDinnerFocus) && (
                <div className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> {t("home.tactic_set")}</div>
              )}
              {calendarData?.calendar?.some((d: any) => d.eatOutScheduled) && !calendarPlan?.isDinnerFocus && (!calendarPlan?.dietStruggle || calendarPlan?.dietStruggle === 'eat_out') && (cycle < 2 || calendarPlan?.dietStruggle === 'eat_out') && (
                <div className="flex items-center gap-1"><Wine className="w-3 h-3" /> {t("home.planned_eat_out")}</div>
              )}
            </div>
          </div>
          </div>
        </CardContent>
      </Card>)}
    </motion.div>
    <CoinSavedPopup coins={coinPopupCoins} visible={coinPopupCoins > 0} onDismiss={dismissCoinPopup} />
    <InfoCardPopup visible={cardFirstWalkDay.visible} onDismiss={cardFirstWalkDay.dismiss} icon={Footprints} titleKey="info_card.first_walk_day.title" panelKeys={["info_card.first_walk_day.p1","info_card.first_walk_day.p2","info_card.first_walk_day.p3"]} testId="dialog-card-first-walk-day" />
    <InfoCardPopup visible={cardStretchSwitch.visible} onDismiss={cardStretchSwitch.dismiss} icon={Footprints} titleKey="info_card.stretch_switch.title" panelKeys={["info_card.stretch_switch.p1","info_card.stretch_switch.p2","info_card.stretch_switch.p3"]} testId="dialog-card-stretch-switch" />
    <InfoCardPopup visible={cardDinnerTiming.visible} onDismiss={cardDinnerTiming.dismiss} icon={Clock} titleKey="info_card.dinner_timing.title" panelKeys={["info_card.dinner_timing.p1","info_card.dinner_timing.p2","info_card.dinner_timing.p3","info_card.dinner_timing.p4"]} testId="dialog-card-dinner-timing" />
    <InfoCardPopup visible={cardDinnerTactics.visible} onDismiss={cardDinnerTactics.dismiss} icon={UtensilsCrossed} titleKey="info_card.dinner_tactics.title" panelKeys={["info_card.dinner_tactics.p1","info_card.dinner_tactics.p2","info_card.dinner_tactics.p3"]} testId="dialog-card-dinner-tactics" />
    <FoodSwitchPopup visible={foodSwitchPopup.visible} onDismiss={foodSwitchPopup.dismiss} />
    <InfoSheet open={tacticInfoSheet.open} onClose={tacticInfoSheet.closeSheet} config={tacticInfoSheet.config} />
    {((profile?.currentWeek as number) || 1) >= 2 && (
      <div data-tf-live="01KMT9YTNXX0J1QWCN07GQRTNZ" />
    )}
    </>
  );
}
