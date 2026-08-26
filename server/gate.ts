import type { UserProfile } from "@shared/schema";

export type FeatureKey =
  | "homepage"
  | "food_snap_capture"
  | "food_snap_advice"
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
    return {
      allowed: false,
      showPaywall: true,
      lockApp: true,
    };
  }

  if (profile.hardLockedAfterAdviceDismiss) {
    return {
      allowed: false,
      showPaywall: true,
      lockApp: true,
    };
  }

  if (feature === "homepage") {
    return { allowed: true, isFreeAction: true };
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

  if (feature === "insights") {
    return { allowed: true };
  }

  return { allowed: true };
}

// Decides which fields the premium-refresh handler must write back
// when verifyEntitlement settles. Returns null when no write is
// needed. Exported so the decision can be unit-tested directly
// (server/routes.ts inlines the call, tests import this helper).
//
// Two cases trigger a write:
//   - premium status flipped (either direction)
//   - user is now verified-premium but the soft-paywall hard-lock
//     flag is still true from a prior dismissal — a paid unlock
//     must clear it, otherwise a later subscription lapse would
//     re-trip the hard lock with no dismissal in the new cycle.
export type PremiumRefreshUpdate = {
  isPremium?: boolean;
  hardLockedAfterAdviceDismiss?: boolean;
} | null;

export function computePremiumRefreshUpdate(
  existing: Pick<UserProfile, "isPremium" | "hardLockedAfterAdviceDismiss">,
  verifiedPremium: boolean,
): PremiumRefreshUpdate {
  const premiumChanged = existing.isPremium !== verifiedPremium;
  const lockFlagDirty =
    verifiedPremium && existing.hardLockedAfterAdviceDismiss === true;
  if (!premiumChanged && !lockFlagDirty) return null;
  const update: NonNullable<PremiumRefreshUpdate> = {};
  if (premiumChanged) update.isPremium = verifiedPremium;
  if (lockFlagDirty) update.hardLockedAfterAdviceDismiss = false;
  return update;
}

export function getGateStatus(profile: UserProfile) {
  const mode = getGateMode();
  return {
    gateMode: mode,
    isPremium: profile.isPremium,
    hasTriedFirstFoodSnap: profile.hasTriedFirstFoodSnap,
    hardLockedAfterAdviceDismiss: profile.hardLockedAfterAdviceDismiss,
    features: {
      homepage: canUseFeature(profile, "homepage"),
      food_snap_capture: canUseFeature(profile, "food_snap_capture"),
      food_snap_advice: canUseFeature(profile, "food_snap_advice"),
      insights: canUseFeature(profile, "insights"),
    },
  };
}
