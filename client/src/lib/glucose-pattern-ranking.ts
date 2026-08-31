export type GlucoseImpactLevel = "low" | "medium" | "high";

export const IMPACT_LEVELS: GlucoseImpactLevel[] = ["low", "medium", "high"];

export interface RankableMeasuredFood {
  foodKey: string;
  lift: number;
}

export function rankMeasuredFoods<T extends RankableMeasuredFood>(
  foods: T[],
  impact: GlucoseImpactLevel,
): T[] {
  return [...foods]
    .sort((a, b) => {
      const liftOrder = impact === "high" ? b.lift - a.lift : a.lift - b.lift;
      return liftOrder || a.foodKey.localeCompare(b.foodKey);
    });
}

export function sampleFoods<T>(foods: T[], limit = 5): T[] {
  const shuffled = [...foods];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}