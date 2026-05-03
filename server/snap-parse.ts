export function sanitizeFoodName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let s = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[`"\\]/g, " ")
    .replace(/\$\{/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 80) s = s.slice(0, 80).trim();
  return s;
}

export function extractJsonObject(raw: string): any | null {
  if (!raw) return null;
  let s = raw.trim();

  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  s = s
    .replace(/[\u201C\u201D\u301D\u301E\u300C\u300D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\uFF1A/g, ":")
    .replace(/\uFF0C/g, ",")
    .replace(/\u3001/g, ",")
    .replace(/\uFF5B/g, "{")
    .replace(/\uFF5D/g, "}");

  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Normalise a food name so two slightly-different wordings of the same dish
 * have a chance of matching (e.g. "Wonton noodles" vs "Wonton noodle").
 *
 * Steps:
 * - lowercase, trim
 * - strip punctuation (keep CJK characters and word characters)
 * - collapse whitespace
 *
 * NOTE: The previous trailing-modifier strippers (English `with …`,
 * Chinese `配 …` / `加 …` / `和 …`) were removed when the food-library
 * lookup switched to strict exact-match-only. They were the source of
 * silent cross-variant matches (e.g. "Wonton noodles with shrimp" vs
 * "Wonton noodles with choi sum" both collapsing to "wonton noodles"
 * and swapping one row's combo onto the other dish's photo). If a
 * future caller needs trailing-modifier stripping, do it at the call
 * site instead of re-introducing it here.
 */
export function normalizeFoodNameForMatch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim().toLowerCase();
  if (!s) return "";

  s = s.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, " ");
  s = s.replace(/[\u3000-\u303F\uFF00-\uFFEF]/g, (ch) => {
    if (/[\u4e00-\u9fff\uF900-\uFAFF]/.test(ch)) return ch;
    return " ";
  });

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Two food names match if their normalised forms are identical, or if one
 * fully contains the other. Conservative: requires a minimum length on both
 * sides so very short strings don't false-match.
 */
export function foodNamesMatch(a: string, b: string): boolean {
  const na = normalizeFoodNameForMatch(a);
  const nb = normalizeFoodNameForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = (s: string) => /[\u4e00-\u9fff]/.test(s) ? 2 : 3;
  if (na.length < minLen(na) || nb.length < minLen(nb)) return false;
  if (!(na.includes(nb) || nb.includes(na))) return false;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length / longer.length < 0.6) return false;
  return true;
}

/**
 * Strip from the `extras` (toppings) string any token that already appears
 * in `name` (case-insensitive, both English and Chinese). Pure in-memory
 * string operation — no DB / API calls. Returns null when nothing remains.
 */
export function stripExtrasContainedInName(name: string, extras: unknown): string | null {
  if (typeof extras !== "string") return null;
  const trimmed = extras.trim();
  if (!trimmed) return null;
  if (typeof name !== "string" || !name.trim()) return trimmed || null;

  const haystack = name.toLowerCase();

  // Split ONLY on comma-family separators. The naming convention uses
  // with / 配 / 加 / 和 as connectors INSIDE food names (and as parts of
  // compound terms like 和牛 / 加州卷 / 配料), so splitting on them here
  // would either chop those compounds or fail silently when Claude
  // omits whitespace around them. The prompt mandates commas as the
  // only separator in the side-dishes / extras field. `、` is retained
  // here as a defensive fallback only — the prompt itself never uses it.
  const tokens = trimmed
    .split(/[,，、/／&]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const seen = new Set<string>();
  const remaining: string[] = [];
  for (const token of tokens) {
    const tl = token.toLowerCase();
    if (seen.has(tl)) continue;
    seen.add(tl);
    if (haystack.includes(tl)) continue;
    remaining.push(token);
  }

  if (remaining.length === 0) return null;
  return remaining.join(", ");
}
