import type { FoodItemMetadata } from "@shared/schema";
import type { SweetCategory } from "@shared/schema";

export type CarbCategory = "rice" | "noodles" | "bread" | "potatoes" | "other" | null;
export type CarbMatchType = "exact" | "substring_fallback" | "no_match";

export const SWEET_CATEGORY_ALIASES: Record<Exclude<SweetCategory, null>, string[]> = {
  sweet_drink: [
    "milk tea", "hong kong milk tea", "bubble tea", "boba", "soda", "soft drink",
    "cola", "lemonade", "sweetened tea", "sweetened coffee",
    "奶茶", "珍珠奶茶", "波霸奶茶", "汽水", "可樂", "可乐", "檸檬茶", "柠檬茶",
  ],
  sweet_food: [
    "cake", "dessert", "cookie", "biscuit", "ice cream", "chocolate", "candy",
    "egg tart", "pineapple bun", "sweet bun",
    "蛋糕", "甜品", "曲奇", "餅乾", "饼干", "雪糕", "朱古力", "巧克力", "糖果",
    "蛋撻", "蛋挞", "菠蘿包", "菠萝包",
  ],
};

const NO_SUGAR_MARKERS = [
  "無糖", "无糖", "走糖", "走甜", "no sugar", "sugar-free", "sugar free",
  "unsweetened", "without sugar", "zero sugar", "zero-sugar", "0 sugar",
  "零糖",
];

function normalizeSweet(text: string): string {
  return text
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑‒–—-]/g, "")
    .replace(/\s+/g, "");
}

function isExplicitlyNoSugar(names: string[]): boolean {
  return names.some(name => {
    const normalized = normalizeSweet(name);
    return NO_SUGAR_MARKERS.some(marker => normalized.includes(normalizeSweet(marker)));
  });
}

/**
 * Classifies only deterministic, name-based sweet categories. This is
 * intentionally not a quantity, GI/GL, or glucose-impact judgement.
 */
export function classifySweetCategory(item: {
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
}): SweetCategory {
  const names = [item.nameEn, item.nameZhHant, item.nameYue].filter(Boolean);
  if (isExplicitlyNoSugar(names)) return null;

  for (const [category, aliases] of Object.entries(SWEET_CATEGORY_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeSweet);
    if (names.some(name => normalizedAliases.includes(normalizeSweet(name)))) {
      return category as Exclude<SweetCategory, null>;
    }
  }

  let best: { category: Exclude<SweetCategory, null>; aliasLength: number } | null = null;
  for (const [category, aliases] of Object.entries(SWEET_CATEGORY_ALIASES)) {
    for (const alias of aliases.map(normalizeSweet)) {
      if (!alias) continue;
      if (names.some(name => normalizeSweet(name).includes(alias))) {
        if (!best || alias.length > best.aliasLength) {
          best = { category: category as Exclude<SweetCategory, null>, aliasLength: alias.length };
        }
      }
    }
  }
  return best?.category ?? null;
}

export const CARB_CATEGORY_ALIASES: Record<Exclude<CarbCategory, null>, string[]> = {
  rice: [
    "rice", "white rice", "brown rice", "mixed grain rice", "sticky rice",
    "飯", "白飯", "白米", "白米飯", "米飯", "紅米飯", "糙米", "五穀飯", "糯米飯", "糯米",
  ],
  noodles: [
    "noodles", "rice noodles", "wheat noodles", "egg noodles", "wonton noodles",
    "米粉", "米線", "河粉", "粉麵", "麵", "面", "粉", "幼麵", "粗麵", "公仔麵", "腸粉",
  ],
  bread: [
    "bread", "toast", "bun", "roll", "sandwich", "white bread", "whole wheat bread",
    "麵包", "面包", "多士", "包", "三文治", "三明治", "饅頭", "饅頭", "饼", "餅",
  ],
  potatoes: [
    "potato", "potatoes", "sweet potato", "yam", "taro",
    "薯仔", "土豆", "番薯", "地瓜", "蕃薯", "芋頭", "芋头",
  ],
  other: [
    "congee", "porridge", "oats", "oatmeal", "corn", "polenta",
    "粥", "白粥", "皮蛋瘦肉粥", "燕麥", "燕麦", "麥皮", "麦皮", "粟米", "玉米",
  ],
};

export const CARB_SUBTYPE_OPTIONS: Record<Exclude<CarbCategory, null>, string[]> = {
  rice: ["white_rice", "brown_rice", "mixed_grain_rice", "sticky_rice"],
  noodles: ["rice_noodles", "wheat_noodles", "egg_noodles", "other_noodles"],
  bread: ["white_bread", "wholegrain_bread", "sourdough", "other_bread"],
  potatoes: ["potato", "sweet_potato", "taro", "other_potato"],
  other: [],
};

export function normalize(text: string): string {
  return text
    .trim()
    .normalize("NFKC")
    .replace(/\s+/g, "");
}

function logCarbMatch(
  item: { nameEn: string; nameZhHant: string; nameYue: string },
  matchedCategory: CarbCategory,
  matchType: CarbMatchType,
) {
  if (matchType === "no_match") {
    console.warn("[carb-classify-miss]", {
      nameEn: item.nameEn,
      nameZhHant: item.nameZhHant,
      nameYue: item.nameYue,
    });
  } else if (matchType === "substring_fallback") {
    console.info("[carb-classify-fallback]", {
      item,
      matchedCategory,
    });
  }
}

export function classifyCarbCategory(item: {
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
}): CarbCategory {
  const names = [item.nameEn, item.nameZhHant, item.nameYue].map(normalize).filter(Boolean);

  for (const [category, aliases] of Object.entries(CARB_CATEGORY_ALIASES)) {
    const normalizedAliases = aliases.map(normalize);
    if (names.some(name => normalizedAliases.includes(name))) {
      return category as Exclude<CarbCategory, null>;
    }
  }

  let best: { category: Exclude<CarbCategory, null>; aliasLength: number } | null = null;
  for (const [category, aliases] of Object.entries(CARB_CATEGORY_ALIASES)) {
    for (const alias of aliases.map(normalize)) {
      if (!alias) continue;
      if (names.some(name => name.includes(alias))) {
        if (!best || alias.length > best.aliasLength) {
          best = { category: category as Exclude<CarbCategory, null>, aliasLength: alias.length };
        }
      }
    }
  }
  if (best) {
    logCarbMatch(item, best.category, "substring_fallback");
    return best.category;
  }

  logCarbMatch(item, null, "no_match");
  return null;
}

export function getCarbSubtypeOptions(category: CarbCategory): string[] {
  return category ? CARB_SUBTYPE_OPTIONS[category] : [];
}

export function getDefaultCarbSubtype(category: CarbCategory): string | null {
  return getCarbSubtypeOptions(category)[0] ?? null;
}

export function isValidCarbSubtype(category: CarbCategory, subtype: unknown): subtype is string {
  return typeof subtype === "string" && getCarbSubtypeOptions(category).includes(subtype);
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

/**
 * Converts the structured response from the label call into a bounded,
 * server-owned component list. Extras are never passed to this function.
 */
export function prepareFoodItems(
  rawItems: unknown,
  source: "claude" | "derived" = "claude",
): FoodItemMetadata[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .slice(0, 8)
    .map((raw): FoodItemMetadata | null => {
      if (!raw || typeof raw !== "object") return null;
      const candidate = raw as Record<string, unknown>;
      const nameEn = cleanName(candidate.nameEn ?? candidate.en ?? candidate.name);
      const nameZhHant = cleanName(candidate.nameZhHant ?? candidate.zhHant ?? candidate.zh ?? candidate.name);
      const nameYue = cleanName(candidate.nameYue ?? candidate.yue ?? candidate.nameZhHant ?? candidate.name);
      if (!nameEn && !nameZhHant && !nameYue) return null;

      const names = {
        nameEn: nameEn || nameZhHant || nameYue,
        nameZhHant: nameZhHant || nameEn || nameYue,
        nameYue: nameYue || nameZhHant || nameEn,
      };
      const carbCategory = classifyCarbCategory(names);
      const requestedSubtype = candidate.carbSubtype;
      const carbSubtype = isValidCarbSubtype(carbCategory, requestedSubtype) ? requestedSubtype : null;
      const sweetCategory = classifySweetCategory(names);

      return {
        ...names,
        isCarb: carbCategory !== null,
        carbCategory,
        carbSubtype,
        sweetCategory,
        isSweet: sweetCategory !== null,
        suggestedSubtype: isValidCarbSubtype(carbCategory, candidate.suggestedSubtype)
          ? candidate.suggestedSubtype
          : getDefaultCarbSubtype(carbCategory),
        subtypeConfirmed: candidate.subtypeConfirmed === true && carbSubtype !== null,
        source,
      };
    })
    .filter((item): item is FoodItemMetadata => item !== null);
}

export function addSuggestedCarbSubtype(
  items: FoodItemMetadata[],
  preferences: Map<string, string>,
): FoodItemMetadata[] {
  return items.map(item => {
    const category = item.carbCategory as CarbCategory;
    if (!category || getCarbSubtypeOptions(category).length === 0) return item;
    const preference = preferences.get(`${foodItemKey(item)}|${category}`);
    return {
      ...item,
      suggestedSubtype: isValidCarbSubtype(category, preference)
        ? preference
        : item.suggestedSubtype ?? getDefaultCarbSubtype(category),
      carbSubtype: null,
      subtypeConfirmed: false,
    };
  });
}

/**
 * Applies only valid subtype selections to the component list that was
 * generated by Claude and signed by the server. Client-added foods cannot
 * become measured evidence because they never occur in this list.
 */
export function applyConfirmedCarbSubtypes(
  serverItems: FoodItemMetadata[],
  submittedItems: unknown,
): FoodItemMetadata[] {
  const submitted = Array.isArray(submittedItems) ? submittedItems : [];
  const selections = new Map<string, Record<string, unknown>>();
  for (const raw of submitted) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const names = {
      nameEn: cleanName(item.nameEn),
      nameZhHant: cleanName(item.nameZhHant),
      nameYue: cleanName(item.nameYue),
    };
    if (!names.nameEn || !names.nameZhHant || !names.nameYue) continue;
    selections.set(foodItemKey(names), item);
  }

  return serverItems.map(item => {
    const selection = selections.get(foodItemKey(item));
    if (!selection || !item.carbCategory || selection.subtypeConfirmed !== true) return item;
    const category = item.carbCategory as CarbCategory;
    if (!isValidCarbSubtype(category, selection.carbSubtype)) return item;
    return { ...item, carbSubtype: selection.carbSubtype, subtypeConfirmed: true };
  });
}

export function foodItemKey(item: Pick<FoodItemMetadata, "nameEn" | "nameZhHant" | "nameYue">): string {
  return normalize(`${item.nameEn}|${item.nameZhHant}|${item.nameYue}`);
}