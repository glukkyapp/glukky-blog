import { normalize } from "./carb-subtypes";
import { selectGeneralTopFoods, type FoodFrequencyFood } from "./food-frequency";

export type GiRank = "low" | "medium" | "high";
export type GiEntryStatus = "resolved" | "no_match" | "pending";

export const GI_REFERENCE_SOURCE =
  "International tables of glycemic index and glycemic load values 2008";
export const GI_NO_MATCH_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
export const GI_AI_TIMEOUT_MS = 45_000;
export const GI_CLAIM_LEASE_MS = 15 * 60 * 1000;
export const GI_AI_MODEL_ENV = "GI_AI_MODEL";

export function getGiAiModel(
  env: Record<string, string | undefined> = process.env,
): string {
  const model = env[GI_AI_MODEL_ENV]?.trim();
  if (!model) {
    throw new Error(`${GI_AI_MODEL_ENV} must be configured with a non-empty supported model ID`);
  }
  return model;
}

export function addGiAiModelErrorContext(error: unknown, model: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const unsupportedModel =
    /(?:unsupported|not supported|unknown|invalid)[^\n]*model|model[^\n]*(?:unsupported|not supported|unknown|invalid)/i;
  if (!unsupportedModel.test(message)) {
    return error instanceof Error ? error : new Error(message);
  }
  return new Error(
    `GI AI model "${model}" is not supported by the configured gateway. ` +
      `Set ${GI_AI_MODEL_ENV} to a supported Anthropic model. Provider error: ${message}`,
  );
}

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createGuardedJob(job: () => Promise<void>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } finally {
      running = false;
    }
  };
}

export function startObservedBackgroundJob(
  job: () => Promise<void>,
  onError: (error: unknown) => void,
): void {
  void job().catch(onError);
}

export function startGiResolutionSchedule(
  job: () => Promise<void>,
  onError: (source: "startup" | "scheduler", error: unknown) => void,
  schedule: (callback: () => void, intervalMs: number) => unknown = setInterval,
): unknown {
  startObservedBackgroundJob(job, error => onError("startup", error));
  return schedule(
    () => startObservedBackgroundJob(job, error => onError("scheduler", error)),
    60 * 60 * 1000,
  );
}

export type GiReferenceCandidate = {
  referenceId: string;
  canonicalName: string;
  aliases: string[];
  giValue: number;
  category: "rice" | "noodles" | "bread" | "potatoes" | "other" | "sweet_food" | "sweet_drink";
};

/**
 * Server-owned candidates from the International Tables of GI/GL Values
 * (Atkinson, Foster-Powell and Brand-Miller, Diabetes Care 2008).
 * Claude may select a candidate, but it may not invent a value or bucket.
 *
 * The aliases are deliberately compact: they are candidate labels, not a
 * fuzzy nutrition database. A food is only eligible for candidates from its
 * own generated list below.
 */
export const GI_REFERENCE_CANDIDATES: GiReferenceCandidate[] = [
  { referenceId: "rice-white", canonicalName: "White rice", aliases: ["rice", "white rice", "白飯", "白米", "白米飯", "米飯"], giValue: 73, category: "rice" },
  { referenceId: "rice-basmati", canonicalName: "Basmati rice", aliases: ["basmati rice", "印度香米", "巴斯馬蒂米"], giValue: 50, category: "rice" },
  { referenceId: "rice-brown", canonicalName: "Brown rice", aliases: ["brown rice", "糙米", "紅米飯"], giValue: 50, category: "rice" },
  { referenceId: "rice-sticky", canonicalName: "Sticky rice", aliases: ["sticky rice", "glutinous rice", "糯米", "糯米飯"], giValue: 87, category: "rice" },
  { referenceId: "noodles-rice", canonicalName: "Rice noodles", aliases: ["rice noodles", "米粉", "米線", "河粉"], giValue: 53, category: "noodles" },
  { referenceId: "noodles-egg", canonicalName: "Egg noodles", aliases: ["egg noodles", "蛋麵", "雞蛋麵"], giValue: 40, category: "noodles" },
  { referenceId: "noodles-wheat", canonicalName: "Wheat noodles", aliases: ["wheat noodles", "麵條", "麵", "面"], giValue: 48, category: "noodles" },
  { referenceId: "bread-white", canonicalName: "White bread", aliases: ["white bread", "bread", "toast", "白麵包", "白面包", "多士"], giValue: 75, category: "bread" },
  { referenceId: "bread-wholegrain", canonicalName: "Wholegrain bread", aliases: ["wholegrain bread", "whole grain bread", "whole wheat bread", "全麥麵包", "全麦面包"], giValue: 69, category: "bread" },
  { referenceId: "bread-sourdough", canonicalName: "Sourdough bread", aliases: ["sourdough", "sourdough bread", "酸種麵包", "酸种面包"], giValue: 54, category: "bread" },
  { referenceId: "potato-boiled", canonicalName: "Boiled potato", aliases: ["potato", "potatoes", "boiled potato", "薯仔", "土豆"], giValue: 78, category: "potatoes" },
  { referenceId: "potato-sweet", canonicalName: "Sweet potato", aliases: ["sweet potato", "番薯", "地瓜", "蕃薯"], giValue: 61, category: "potatoes" },
  { referenceId: "potato-taro", canonicalName: "Taro", aliases: ["taro", "芋頭", "芋头"], giValue: 53, category: "potatoes" },
  { referenceId: "other-oats", canonicalName: "Rolled oats", aliases: ["oats", "oatmeal", "rolled oats", "燕麥", "燕麦", "麥皮", "麦皮"], giValue: 55, category: "other" },
  { referenceId: "other-corn", canonicalName: "Sweet corn", aliases: ["corn", "sweet corn", "粟米", "玉米"], giValue: 52, category: "other" },
  { referenceId: "other-porridge", canonicalName: "Porridge", aliases: ["porridge", "congee", "粥", "白粥"], giValue: 58, category: "other" },
  { referenceId: "sweet-food-cake", canonicalName: "Cake", aliases: ["cake", "蛋糕"], giValue: 67, category: "sweet_food" },
  { referenceId: "sweet-food-ice-cream", canonicalName: "Ice cream", aliases: ["ice cream", "雪糕"], giValue: 51, category: "sweet_food" },
  { referenceId: "sweet-food-cookie", canonicalName: "Cookie", aliases: ["cookie", "biscuit", "曲奇", "餅乾", "饼干"], giValue: 55, category: "sweet_food" },
  { referenceId: "sweet-drink-milk-tea", canonicalName: "Milk tea", aliases: ["milk tea", "hong kong milk tea", "奶茶", "港式奶茶"], giValue: 45, category: "sweet_drink" },
  { referenceId: "sweet-drink-soda", canonicalName: "Soda", aliases: ["soda", "soft drink", "cola", "汽水", "可樂", "可乐"], giValue: 63, category: "sweet_drink" },
];

export type GiFoodForLookup = Pick<FoodFrequencyFood, "nameEn" | "nameZhHant" | "nameYue"> & {
  carbCategory?: string | null;
  sweetCategory?: string | null;
};

export type GiEntryLike = {
  status: GiEntryStatus;
  giValue: number | null;
  resolvedAt: Date | string;
};

export type GiCandidateRequest = {
  inputIndex: number;
  candidates: Pick<GiReferenceCandidate, "referenceId">[];
};

export function normalizeGiFoodIdentity(value: string): string {
  return normalize(value).toLocaleLowerCase();
}

export function giFoodKey(food: Pick<GiFoodForLookup, "nameEn" | "nameZhHant" | "nameYue">): string {
  return normalizeGiFoodIdentity(`${food.nameEn}|${food.nameZhHant}|${food.nameYue}`);
}

export function deriveGiRank(giValue: number): GiRank | null {
  if (!Number.isFinite(giValue)) return null;
  if (giValue <= 55) return "low";
  if (giValue <= 69) return "medium";
  return "high";
}

/**
 * Candidate generation is deterministic and server-owned. Claude receives
 * only this food's candidates, and the validator checks referenceId against
 * this exact list.
 */
export function getGiCandidatesForFood(food: GiFoodForLookup): GiReferenceCandidate[] {
  const names = [food.nameEn, food.nameZhHant, food.nameYue]
    .map(normalizeGiFoodIdentity)
    .filter(Boolean);
  const categories = new Set(
    [food.carbCategory, food.sweetCategory].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
  );
  const lexical = GI_REFERENCE_CANDIDATES.filter(candidate =>
    candidate.aliases.some(alias => names.includes(normalizeGiFoodIdentity(alias))) ||
    names.some(name => candidate.aliases.some(alias => {
      const normalizedAlias = normalizeGiFoodIdentity(alias);
      return name.includes(normalizedAlias) || normalizedAlias.includes(name);
    })),
  );
  const categoryMatches = GI_REFERENCE_CANDIDATES.filter(candidate => categories.has(candidate.category));
  const combined = new Map<string, GiReferenceCandidate>();
  for (const candidate of [...lexical, ...categoryMatches]) combined.set(candidate.referenceId, candidate);
  return Array.from(combined.values());
}

export function getPublicGiState(
  entry: GiEntryLike | undefined,
): { giRank: GiRank | null; giStatus: "resolved" | "pending" | "unavailable" } {
  if (!entry) return { giRank: null, giStatus: "pending" };
  if (entry.status === "pending") return { giRank: null, giStatus: "pending" };
  if (entry.status !== "resolved" || entry.giValue == null) {
    return { giRank: null, giStatus: "unavailable" };
  }
  const giRank = deriveGiRank(entry.giValue);
  return giRank
    ? { giRank, giStatus: "resolved" }
    : { giRank: null, giStatus: "unavailable" };
}

export function isRecentNoMatch(entry: GiEntryLike | undefined, now = new Date()): boolean {
  if (!entry || entry.status !== "no_match") return false;
  const resolvedAt = new Date(entry.resolvedAt).getTime();
  return Number.isFinite(resolvedAt) && now.getTime() - resolvedAt < GI_NO_MATCH_RETRY_MS;
}

export function validateGiMatches(
  rawMatches: unknown,
  requests: GiCandidateRequest[],
): Map<number, string> {
  const candidateIdsByIndex = new Map(
    requests.map(request => [
      request.inputIndex,
      new Set(request.candidates.map(candidate => candidate.referenceId)),
    ]),
  );
  const matchesByIndex = new Map<number, string>();
  if (!Array.isArray(rawMatches)) return matchesByIndex;
  for (const raw of rawMatches) {
    if (!raw || typeof raw !== "object") continue;
    const inputIndex = (raw as any).inputIndex;
    const referenceId = (raw as any).referenceId;
    if (!Number.isInteger(inputIndex) || typeof referenceId !== "string") continue;
    if (!candidateIdsByIndex.get(inputIndex)?.has(referenceId)) continue;
    if (!matchesByIndex.has(inputIndex)) matchesByIndex.set(inputIndex, referenceId);
  }
  return matchesByIndex;
}

export { selectGeneralTopFoods };