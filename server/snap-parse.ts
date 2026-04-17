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
