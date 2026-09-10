export const DAILY_TASK_IDS = [
  "post_meal_walk",
  "unsweetened_drink",
  "vegetable_dish",
  "regular_mealtime",
] as const;

export type DailyTaskId = typeof DAILY_TASK_IDS[number];

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDailyTaskRotation(userId: string, localDate: string): DailyTaskId[] {
  const omittedIndex = hashSeed(`${userId}:${localDate}`) % DAILY_TASK_IDS.length;
  return DAILY_TASK_IDS.filter((_, index) => index !== omittedIndex);
}

export function isDailyTaskId(value: unknown): value is DailyTaskId {
  return typeof value === "string" && (DAILY_TASK_IDS as readonly string[]).includes(value);
}