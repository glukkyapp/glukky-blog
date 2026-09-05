export function escapeUntrustedPromptData(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function wrapUntrustedPromptData(field: string, value: unknown): string {
  const safeField = field.replace(/[^a-z0-9_-]/gi, "_");
  return `<user_data field="${safeField}">\n${escapeUntrustedPromptData(value)}\n</user_data>`;
}

export type FoodNameTranslations = {
  en: string;
  zh: string;
  yue: string;
};

export function parseFoodNameTranslations(value: string): FoodNameTranslations | null {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed).sort();
    if (keys.length !== 3 || keys[0] !== "en" || keys[1] !== "yue" || keys[2] !== "zh") return null;
    if (typeof parsed.en !== "string" || typeof parsed.zh !== "string" || typeof parsed.yue !== "string") return null;
    return { en: parsed.en, zh: parsed.zh, yue: parsed.yue };
  } catch {
    return null;
  }
}