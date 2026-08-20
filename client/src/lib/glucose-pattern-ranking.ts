export type GlucoseImpactLevel = "low" | "medium" | "high";

export interface RankableGlucoseFood {
  avgPostMealMmol: number;
  readingCount: number;
}

export const IMPACT_LEVELS: GlucoseImpactLevel[] = ["low", "medium", "high"];

export function rankActualFoods<T extends RankableGlucoseFood>(
  foods: T[],
  impact: GlucoseImpactLevel,
): T[] {
  return [...foods]
    .sort((a, b) => {
      const mmolOrder = impact === "high"
        ? b.avgPostMealMmol - a.avgPostMealMmol
        : a.avgPostMealMmol - b.avgPostMealMmol;
      return mmolOrder || b.readingCount - a.readingCount;
    })
    .slice(0, 5);
}

export function sampleFoods<T>(foods: T[], limit = 5): T[] {
  const shuffled = [...foods];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}