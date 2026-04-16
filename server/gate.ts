import type { UserProfile } from "@shared/schema";

export type FeatureKey =
  | "homepage"
  | "weekly_plan_create"
  | "food_snap_capture"
  | "food_snap_advice"
  | "roadmap"
  | "diet_advice"
  | "insights";

export interface GateResult {
  allowed: boolean;
  showPaywall?: boolean;
  lockApp?: boolean;
  isFreeAction?: boolean;
}

type GateMode = "off" | "soft" | "hard";

function getGateMode(): GateMode {
  const mode = (process.env.GATE_MODE || "soft").toLowerCase().trim();
  if (mode === "off" || mode === "hard") return mode;
  return "soft";
}

export function canUseFeature(profile: UserProfile, feature: FeatureKey): GateResult {
  const mode = getGateMode();

  if (mode === "off") {
    return { allowed: true };
  }

  if (profile.isPremium) {
    return { allowed: true };
  }

  if (mode === "hard") {
    if (feature === "homepage") {
      return { allowed: true, isFreeAction: true };
    }
    return {
      allowed: false,
      showPaywall: true,
      lockApp: true,
    };
  }

  if (feature === "homepage") {
    return { allowed: true, isFreeAction: true };
  }

  if (feature === "weekly_plan_create") {
    return { allowed: true, isFreeAction: !profile.hasCreatedFirstWeeklyPlan };
  }

  if (feature === "food_snap_capture") {
    return { allowed: true, isFreeAction: !profile.hasTriedFirstFoodSnap };
  }

  if (feature === "food_snap_advice") {
    if (!profile.hasTriedFirstFoodSnap) {
      return { allowed: true, isFreeAction: true };
    }
    return {
      allowed: false,
      showPaywall: true,
      lockApp: false,
    };
  }

  if (feature === "roadmap" || feature === "diet_advice" || feature === "insights") {
    if (!profile.hasReachedPaywall) {
      return { allowed: true };
    }
    return {
      allowed: false,
      showPaywall: true,
      lockApp: false,
    };
  }

  return { allowed: true };
}

export function getGateStatus(profile: UserProfile) {
  const mode = getGateMode();
  return {
    gateMode: mode,
    isPremium: profile.isPremium,
    hasCreatedFirstWeeklyPlan: profile.hasCreatedFirstWeeklyPlan,
    hasTriedFirstFoodSnap: profile.hasTriedFirstFoodSnap,
    hasReachedPaywall: profile.hasReachedPaywall,
    features: {
      homepage: canUseFeature(profile, "homepage"),
      weekly_plan_create: canUseFeature(profile, "weekly_plan_create"),
      food_snap_capture: canUseFeature(profile, "food_snap_capture"),
      food_snap_advice: canUseFeature(profile, "food_snap_advice"),
      roadmap: canUseFeature(profile, "roadmap"),
      diet_advice: canUseFeature(profile, "diet_advice"),
      insights: canUseFeature(profile, "insights"),
    },
  };
}
