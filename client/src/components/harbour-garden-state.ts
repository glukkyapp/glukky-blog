export type GardenTree = "seedling" | "small-tree" | "young-tree" | "complete-tree";
export type GardenLayer =
  | "background" | "tree" | "flower1" | "flower2" | "bird"
  | "bench" | "lamp" | "flower3" | "ferry" | "flower4";

export const renderOrder: readonly GardenLayer[] = [
  "background", "tree", "flower1", "flower2", "bird",
  "bench", "lamp", "flower3", "ferry", "flower4",
] as const;

const decorationThresholds: Partial<Record<GardenLayer, number>> = {
  flower1: 5,
  flower2: 11,
  bird: 20,
  bench: 25,
  lamp: 35,
  flower3: 40,
  ferry: 46,
  flower4: 55,
};

export function clampGardenPoints(points: number): number {
  return Math.max(0, Math.min(60, points));
}

export function isGardenComplete(points: number): boolean {
  return points >= 60;
}

export function getGardenTree(points: number): GardenTree | null {
  const clamped = clampGardenPoints(points);
  if (clamped >= 31) return "complete-tree";
  if (clamped >= 16) return "young-tree";
  if (clamped >= 7) return "small-tree";
  if (clamped >= 1) return "seedling";
  return null;
}

export function getGardenLayerKeys(points: number): GardenLayer[] {
  const clamped = clampGardenPoints(points);
  const selectedTree = getGardenTree(clamped);

  return renderOrder.filter((key) => {
    if (key === "tree") return selectedTree !== null;
    const threshold = decorationThresholds[key];
    return threshold === undefined || clamped >= threshold;
  });
}

export function getGardenVisualLayerKeys(points: number): string[] {
  const tree = getGardenTree(points);
  return getGardenLayerKeys(points).map((key) =>
    key === "tree" && tree ? `tree:${tree}` : key
  );
}

export function getNewGardenVisualLayerKeys(previousPoints: number, currentPoints: number): string[] {
  const previous = clampGardenPoints(previousPoints);
  const current = clampGardenPoints(currentPoints);
  if (current <= previous) return [];
  const previousKeys = new Set(getGardenVisualLayerKeys(previous));
  return getGardenVisualLayerKeys(current).filter((key) => !previousKeys.has(key));
}