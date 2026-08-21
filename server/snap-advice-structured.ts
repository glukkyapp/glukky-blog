/**
 * Structured snap-advice contract (#802).
 *
 * Claude returns a small selection payload (impact, optional watch-out
 * food-->risk rows, right-now selector numbers). This module validates
 * and converts it into presentation-ready structured advice text so the
 * client never parses free-form Claude output. Legacy cached advice
 * strings are normalized here too.
 */

export type Locale = "en" | "zh-Hant" | "yue";
export type Impact = "low" | "medium" | "high";

export interface WatchOutRow {
  food: string | null;
  risk: string;
}

export interface StructuredAdvice {
  impactValue: Impact | null;
  impactDisplay: string;
  opener: string | null;
  watchOut: WatchOutRow[];
  /** Static positive line shown when there is no watch-out section. */
  positiveLine: string | null;
  rightNow: string[];
  nextTime: string;
}

const KNOWN_LOCALES: Locale[] = ["en", "zh-Hant", "yue"];

export function normalizeLocale(locale: string | undefined | null): Locale {
  return (KNOWN_LOCALES as string[]).includes(locale ?? "") ? (locale as Locale) : "en";
}

/** Strip emoji / pictographic characters from Claude-derived text. */
export function sanitizeEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u20E3\u2B50\u2757\u26A0\u26A1]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Fixed right-now actions (selectors 1–5)                             */
/* ------------------------------------------------------------------ */

export const RIGHT_NOW_ACTIONS: Record<Locale, Record<number, string>> = {
  en: {
    1: "Eat vegetables/protein first, carbs last.",
    2: "Drink a glass of water gradually after finishing the meal, not during eating.",
    3: "Eat slowly.",
    4: "Go for a 10-minute walk after the meal.",
    5: "Reduce the portion of carbs in this meal.",
  },
  "zh-Hant": {
    1: "先吃菜和肉，最後才吃飯或麵",
    2: "飯後慢慢喝一杯水",
    3: "吃慢一點",
    4: "飯後步行10分鐘",
    5: "這餐可減少飯或麵的分量",
  },
  yue: {
    1: "先食菜同肉，最後先食飯或麵",
    2: "食完飯後慢慢飲一杯水",
    3: "食慢啲",
    4: "飯後行10分鐘",
    5: "呢餐可以減少飯或麵嘅份量",
  },
};

export const POSITIVE_LINE: Record<Locale, string> = {
  en: "This is a good choice.",
  "zh-Hant": "這餐選擇不錯。",
  yue: "呢餐揀得唔錯。",
};

/** Selectors 2 and 4 are high-impact-only. */
const HIGH_ONLY = new Set([2, 4]);
const ALL_SELECTORS = new Set([1, 2, 3, 4, 5]);

/**
 * Validate Claude selector output against the impact rules.
 * - low/medium: exactly one of {1,3,5}; fallback 1.
 * - high: exactly two, at least one of {2,4}; fallback [4,1].
 */
export function normalizeSelectors(impact: Impact | null, selectors: number[]): number[] {
  const valid = selectors.filter((s) => ALL_SELECTORS.has(s));
  if (impact === "high") {
    let picks = Array.from(new Set(valid)).slice(0, 2);
    if (!picks.some((s) => HIGH_ONLY.has(s))) {
      picks = [4, ...picks.filter((s) => s !== 4)].slice(0, 2);
    }
    if (picks.length < 2) {
      const filler = [4, 1, 3, 5].filter((s) => !picks.includes(s));
      picks = [...picks, ...filler].slice(0, 2);
    }
    return picks;
  }
  // low / medium / unknown → one action, never 2 or 4
  const first = valid.find((s) => !HIGH_ONLY.has(s));
  return [first ?? 1];
}

export function mapRightNow(locale: Locale, impact: Impact | null, selectors: number[]): string[] {
  return normalizeSelectors(impact, selectors).map((s) => RIGHT_NOW_ACTIONS[locale][s]);
}

/**
 * Legacy cache rows predate the selector-only contract and contain free-form
 * action text. Recognize the five approved action meanings so cached advice
 * can use the current fixed copy just like freshly generated advice.
 */
const LEGACY_ACTION_MATCHERS: Record<number, RegExp[]> = {
  1: [
    /\bvegetables?\b.*\b(protein|meat)\b.*\bcarbs?\b/i,
    /先[吃食].*(菜|蔬菜).*(肉|蛋白質).*(最後|後).*(飯|麵|碳水)/,
  ],
  2: [
    /\bwater\b.*\b(after|following|finish)/i,
    /\b(after|following|finish).*?\bwater\b/i,
    /(飯後|食完|吃完).*(慢慢)?.*[喝飲].*水/,
  ],
  3: [
    /\beat\s+slowly\b/i,
    /\bslow\s*down\b/i,
    /(吃慢一點|吃慢點|食慢啲|慢慢吃|慢慢食|放慢速度|細嚼慢嚥)/,
  ],
  4: [
    /\bwalk\b.*\b10[- ]?minute/i,
    /\b10[- ]?minute.*\bwalk\b/i,
    /(飯後|食完|吃完).*(散步|步行|行).*(10|十).*分鐘/,
  ],
  5: [
    /\breduce\b.*\bcarbs?\b/i,
    /(減少|減).*(碳水|飯|麵).*(份量|分量)?/,
  ],
};

function legacyActionSelectors(body: string): number[] {
  return [1, 2, 3, 4, 5].filter((selector) =>
    LEGACY_ACTION_MATCHERS[selector].some((matcher) => matcher.test(body)),
  );
}

/* ------------------------------------------------------------------ */
/* Next-time selection (server-only; Claude never generates this)      */
/* ------------------------------------------------------------------ */

interface VegEntry { en: string; "zh-Hant": string; yue: string; aliases: string[]; }

/** Approved 13-item vegetable pool. */
export const NEXT_TIME_VEGETABLES: VegEntry[] = [
  { en: "choy sum", "zh-Hant": "菜心", yue: "菜心", aliases: ["choy sum", "choi sum", "菜心"] },
  { en: "gai lan (Chinese broccoli)", "zh-Hant": "芥蘭", yue: "芥蘭", aliases: ["gai lan", "kai lan", "chinese broccoli", "芥蘭", "芥兰"] },
  { en: "bok choy", "zh-Hant": "白菜", yue: "白菜", aliases: ["bok choy", "pak choi", "白菜"] },
  { en: "spinach", "zh-Hant": "菠菜", yue: "菠菜", aliases: ["spinach", "菠菜"] },
  { en: "watercress", "zh-Hant": "西洋菜", yue: "西洋菜", aliases: ["watercress", "西洋菜"] },
  { en: "broccoli", "zh-Hant": "西蘭花", yue: "西蘭花", aliases: ["broccoli", "西蘭花", "西兰花"] },
  { en: "eggplant", "zh-Hant": "茄子", yue: "茄子", aliases: ["eggplant", "aubergine", "茄子"] },
  { en: "bitter melon", "zh-Hant": "苦瓜", yue: "苦瓜", aliases: ["bitter melon", "bitter gourd", "苦瓜"] },
  { en: "winter melon", "zh-Hant": "冬瓜", yue: "冬瓜", aliases: ["winter melon", "冬瓜"] },
  { en: "tomato", "zh-Hant": "番茄", yue: "番茄", aliases: ["tomato", "番茄", "西紅柿"] },
  { en: "cucumber", "zh-Hant": "青瓜", yue: "青瓜", aliases: ["cucumber", "青瓜", "黃瓜"] },
  { en: "mushrooms", "zh-Hant": "冬菇", yue: "冬菇", aliases: ["mushroom", "冬菇", "蘑菇"] },
  { en: "bean sprouts", "zh-Hant": "芽菜", yue: "芽菜", aliases: ["bean sprout", "芽菜", "豆芽"] },
];

/** Approved carb swaps. */
export const NEXT_TIME_CARB_SWAPS: Record<Locale, string[]> = {
  en: ["brown rice", "wholegrain noodles", "oats", "sweet potato"],
  "zh-Hant": ["糙米", "全麥麵", "燕麥", "番薯"],
  yue: ["糙米", "全麥麵", "燕麥", "番薯"],
};

/** The six remaining approved fixed tips. */
export const NEXT_TIME_FIXED_TIPS: Record<Locale, string[]> = {
  en: [
    "Cut back on added sugars and refined grains.",
    "Choose whole, less-processed ingredients where you can.",
    "Eat your carbs earlier in the day rather than later.",
    "Add a protein source — fish, tofu, egg, or lean meat all work well.",
    "Include some healthy fats — a handful of nuts, some avocado, or oily fish.",
    "Avoid sugary drinks alongside your meal.",
  ],
  "zh-Hant": [
    "減少攝取添加糖和精製穀物。",
    "盡量選擇天然、少加工的食材。",
    "把碳水化合物留在一天較早的時候吃。",
    "加點蛋白質——魚、豆腐、雞蛋或瘦肉都是好選擇。",
    "加入一些健康脂肪——少量堅果、牛油果或油性魚類。",
    "用餐時避免含糖飲料。",
  ],
  yue: [
    "少食添加糖同精製穀物。",
    "盡量揀天然、少加工嘅食材。",
    "碳水化合物盡量留喺一日較早嘅時候食。",
    "加啲蛋白質——魚、豆腐、雞蛋或瘦肉都係好選擇。",
    "加入少少健康脂肪——少量堅果、牛油果或油性魚類。",
    "食飯時唔好飲含糖飲料。",
  ],
};

const VEG_TEMPLATE: Record<Locale, (veg: string) => string> = {
  en: (v) => `Try adding some ${v} to your meal — vegetables help slow glucose absorption.`,
  "zh-Hant": (v) => `可以加些${v}——蔬菜有助減緩血糖上升。`,
  yue: (v) => `可以加啲${v}——蔬菜有助減慢血糖上升。`,
};

const SWAP_TEMPLATE: Record<Locale, (swap: string) => string> = {
  en: (s) => `Swap to a higher-fibre carb like ${s}.`,
  "zh-Hant": (s) => `可以換成高纖維碳水化合物，例如${s}。`,
  yue: (s) => `可以換成高纖碳水，例如${s}。`,
};

/**
 * Select exactly one next-time item:
 * (a) random vegetable from the 13-item pool, excluding vegetables already
 *     in the meal description, (b) random approved carb swap, or
 * (c) one of the six fixed tips.
 */
export function selectNextTime(
  locale: string,
  mealDescription: string,
  rand: () => number = Math.random,
): string {
  const loc = normalizeLocale(locale);
  const roll = rand();
  if (roll < 1 / 3) {
    const desc = (mealDescription || "").toLowerCase();
    const candidates = NEXT_TIME_VEGETABLES.filter(
      (v) => !v.aliases.some((a) => desc.includes(a.toLowerCase())),
    );
    if (candidates.length > 0) {
      const veg = candidates[Math.floor(rand() * candidates.length)];
      return VEG_TEMPLATE[loc](veg[loc]);
    }
    // Every vegetable already in the meal — fall through to fixed tips.
  } else if (roll < 2 / 3) {
    const swaps = NEXT_TIME_CARB_SWAPS[loc];
    return SWAP_TEMPLATE[loc](swaps[Math.floor(rand() * swaps.length)]);
  }
  const tips = NEXT_TIME_FIXED_TIPS[loc];
  return tips[Math.floor(rand() * tips.length)];
}

/* ------------------------------------------------------------------ */
/* Parsing / normalization of Claude output & legacy cached advice     */
/* ------------------------------------------------------------------ */

const IMPACT_DISPLAY: Record<Locale, Record<Impact, string>> = {
  en: { low: "Low", medium: "Medium", high: "High" },
  "zh-Hant": { low: "低", medium: "中", high: "高" },
  yue: { low: "低", medium: "中", high: "高" },
};

export function parseImpact(adviceText: string): Impact | null {
  for (const rawLine of adviceText.split("\n")) {
    const line = sanitizeEmoji(rawLine);
    let val: string | null = null;
    if (line.toLowerCase().startsWith("blood sugar impact")) {
      val = line.split(/[:：]/)[1]?.trim().toLowerCase() ?? null;
    } else if (line.startsWith("血糖影響")) {
      val = line.split(/[:：]/)[1]?.trim() ?? null;
    }
    if (!val) continue;
    val = val.replace(/[\[\]]/g, "").trim();
    if (val === "low" || val === "低") return "low";
    if (val === "medium" || val === "中" || val === "中等") return "medium";
    if (val === "high" || val === "高") return "high";
  }
  return null;
}

const WATCH_OUT_MARKERS = [/^watch out[:：]/i, /^注意[:：]/];
const RIGHT_NOW_MARKERS = [/^right now[:：]/i, /^現在[:：]/, /^依家[:：]/];
const FOOD_ORDER_MARKERS = [/^food order[:：]/i];
const NEXT_TIME_MARKERS = [/^next time[:：]/i, /^下次(可試)?[:：]/];
const IMPACT_MARKERS = [/^blood sugar impact/i, /^血糖影響/];

function matchMarker(line: string, markers: RegExp[]): boolean {
  return markers.some((m) => m.test(line));
}

function stripMarker(line: string, markers: RegExp[]): string {
  for (const m of markers) {
    if (m.test(line)) return line.replace(m, "").trim();
  }
  return line.trim();
}

/**
 * Parse a watch-out body into 1–3 food/risk rows. Accepts `-->`, `->`
 * and `→` arrows; rows separated by `;` / `；` / newline. Malformed
 * segments fall back to a food-less risk row so nothing is lost and no
 * raw arrows ever reach the client.
 */
export function parseWatchOutRows(body: string): WatchOutRow[] {
  const segments = body
    .split(/[;；\n]/)
    .map((s) => sanitizeEmoji(s))
    .filter(Boolean);
  const rows: WatchOutRow[] = [];
  for (const seg of segments) {
    const parts = seg.split(/-->|->|→/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      rows.push({ food: parts[0], risk: parts.slice(1).join(" ") });
    } else if (parts.length === 1) {
      rows.push({ food: null, risk: parts[0] });
    }
    if (rows.length >= 3) break;
  }
  return rows;
}

/**
 * Build the full structured advice payload from raw Claude output or a
 * legacy cached advice string.
 *
 * `nextTime` is always server-selected (never Claude, never cached).
 */
export function buildStructuredAdvice(
  rawAdvice: string,
  locale: string,
  nextTime: string,
): StructuredAdvice {
  const loc = normalizeLocale(locale);
  const impact = parseImpact(rawAdvice);

  const lines = rawAdvice
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let opener: string | null = null;
  const watchOut: WatchOutRow[] = [];
  let rightNow: string[] = [];
  let foodOrderPhrase: string | null = null;

  let sawImpact = false;
  for (const rawLine of lines) {
    const line = sanitizeEmoji(rawLine);
    if (!line) continue;
    // Legacy cached advice used emoji prefixes; sanitizeEmoji already removed them.
    if (matchMarker(line, IMPACT_MARKERS)) { sawImpact = true; continue; }
    if (matchMarker(line, NEXT_TIME_MARKERS)) continue;
    if (matchMarker(line, FOOD_ORDER_MARKERS)) {
      const phrase = stripMarker(line, FOOD_ORDER_MARKERS);
      if (phrase) foodOrderPhrase = phrase;
      continue;
    }
    if (matchMarker(line, WATCH_OUT_MARKERS)) {
      watchOut.push(...parseWatchOutRows(stripMarker(line, WATCH_OUT_MARKERS)));
      continue;
    }
    if (matchMarker(line, RIGHT_NOW_MARKERS)) {
      const body = stripMarker(line, RIGHT_NOW_MARKERS);
      // New contract: selector numbers only (e.g. "1" or "2,4").
      const numbersOnly = body.replace(/[\d,、\s和and&+]/gi, "") === "";
      const digits = (body.match(/[1-5]/g) ?? []).map(Number);
      if (numbersOnly && digits.length > 0) {
        rightNow = mapRightNow(loc, impact, digits);
      } else if (body) {
        // Legacy cached advice used full phrases. Map recognized actions back
        // to their selector so cache and fresh advice share the approved copy.
        rightNow = mapRightNow(loc, impact, legacyActionSelectors(body));
      }
      continue;
    }
    // Anything before the impact line that isn't a marker is the cultural opener.
    if (!sawImpact && opener === null && !matchMarker(line, WATCH_OUT_MARKERS)) {
      opener = line;
    }
  }

  if (rightNow.length === 0) {
    rightNow = mapRightNow(loc, impact, []);
  }

  // Substitute food-specific phrase (from "Food order:" line) for any
  // action-1 static slot in rightNow. Works for both single-action (low/medium)
  // and two-action (high) cases without changing normalisation logic.
  if (foodOrderPhrase) {
    const cleanPhrase = sanitizeEmoji(foodOrderPhrase);
    if (cleanPhrase) {
      rightNow = rightNow.map((action) =>
        action === RIGHT_NOW_ACTIONS[loc][1] ? cleanPhrase : action,
      );
    }
  }

  const watchOutClamped = watchOut.slice(0, 3);
  return {
    impactValue: impact,
    impactDisplay: impact ? IMPACT_DISPLAY[loc][impact] : "",
    opener,
    watchOut: watchOutClamped,
    positiveLine: watchOutClamped.length === 0 ? POSITIVE_LINE[loc] : null,
    rightNow: rightNow.map(sanitizeEmoji).filter(Boolean),
    nextTime: sanitizeEmoji(nextTime),
  };
}

/** Locale label used when appending the persisted next-time line to raw advice. */
export function nextTimeLabel(locale: string): string {
  const loc = normalizeLocale(locale);
  return loc === "en" ? "Next time:" : "下次可試：";
}
