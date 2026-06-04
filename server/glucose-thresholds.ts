export type GlucoseGroup = "healthy" | "t2dm";

export interface PersonalisedThresholds {
  lowMedBoundary: number;
  medHighBoundary: number;
}

export const PHASE1_THRESHOLDS: Record<GlucoseGroup, PersonalisedThresholds> = {
  healthy: { lowMedBoundary: 5.9, medHighBoundary: 7.8 },
  t2dm: { lowMedBoundary: 7.5, medHighBoundary: 10.0 },
};

const PERSONALISED_THRESHOLD = 15;

export function classifyPostMealMmol(
  mmol: number,
  group: GlucoseGroup,
  personalised?: PersonalisedThresholds,
): "low" | "medium" | "high" {
  const lowMax = personalised?.lowMedBoundary ?? PHASE1_THRESHOLDS[group].lowMedBoundary;
  const highMin = personalised
    ? Math.min(personalised.medHighBoundary, PHASE1_THRESHOLDS[group].medHighBoundary)
    : PHASE1_THRESHOLDS[group].medHighBoundary;

  if (mmol <= lowMax) return "low";
  if (mmol >= highMin) return "high";
  return "medium";
}

export function deriveGlucoseGroupFromCondition(
  healthCondition: string | null | undefined,
): GlucoseGroup | null {
  if (healthCondition === "diabetes") return "t2dm";
  if (healthCondition === "prediabetes" || healthCondition === "no_but_health") return "healthy";
  return null;
}

export function computePersonalisedThresholds(
  readings: number[],
  group: GlucoseGroup,
): PersonalisedThresholds {
  const p1 = PHASE1_THRESHOLDS[group];
  if (readings.length < PERSONALISED_THRESHOLD) return p1;

  const sorted = [...readings].sort((a, b) => a - b);
  const p30 = sorted[Math.floor(sorted.length * 0.3)];
  const p70 = sorted[Math.floor(sorted.length * 0.7)];

  const lowMedBoundary = Math.min(Math.max(p30, p1.lowMedBoundary * 0.8), p1.lowMedBoundary * 1.2);
  const medHighBoundary = Math.min(
    Math.max(p70, p1.medHighBoundary * 0.8),
    p1.medHighBoundary,
  );

  return {
    lowMedBoundary: Math.round(lowMedBoundary * 10) / 10,
    medHighBoundary: Math.round(medHighBoundary * 10) / 10,
  };
}

export { PERSONALISED_THRESHOLD };
