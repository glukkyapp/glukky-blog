import { randomBytes } from "node:crypto";
import { z } from "zod";
import type {
  FoodComponent,
  FoodComponentTerm,
  ResolvedFoodComponentRef,
  UnresolvedFoodComponentHistory,
} from "@shared/schema";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_CANDIDATES = 8;
const MAX_TERM_LENGTH = 160;

export type FoodTermLocale = "en" | "zh-Hant" | "yue" | "und";
export type CatalogTerm = Pick<FoodComponentTerm,
  "id" | "foodComponentId" | "locale" | "term" | "normalizedTerm" | "termType">;
export type CatalogCandidate = Pick<FoodComponent, "id" | "active" | "verified"> & {
  term: CatalogTerm;
};

export const foodComponentCandidateSchema = z.object({
  id: z.string().min(1).max(96),
  active: z.boolean(),
  verified: z.boolean(),
  term: z.object({
    id: z.string().min(1).max(36),
    foodComponentId: z.string().min(1).max(96),
    locale: z.enum(["en", "zh-Hant", "yue", "und"]),
    term: z.string().min(1).max(MAX_TERM_LENGTH),
    normalizedTerm: z.string().min(1).max(MAX_TERM_LENGTH),
    termType: z.enum(["official", "alias"]),
  }),
});

/** Locale-independent, deterministic matching key. It intentionally has no substring behaviour. */
export function normalizeFoodTerm(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\s!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~_-]+/g, "");
}

function encode(value: number, length: number): string {
  let remaining = value;
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output = CROCKFORD[remaining % 32] + output;
    remaining = Math.floor(remaining / 32);
  }
  return output;
}

/** Generates an immutable application identifier without adding a ULID dependency. */
export function createFoodComponentId(now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Food component id requires a valid timestamp");
  const time = encode(now, 10);
  const bytes = randomBytes(16);
  let random = "";
  for (let i = 0; i < 16; i += 1) random += CROCKFORD[bytes[i] & 31];
  return `food_${time}${random}`;
}

export function unresolvedFoodComponent(
  rawText: string,
  reason: UnresolvedFoodComponentHistory["reason"],
  candidateComponentIds?: string[],
): UnresolvedFoodComponentHistory {
  return {
    rawText: rawText.slice(0, MAX_TERM_LENGTH),
    normalizedText: normalizeFoodTerm(rawText).slice(0, MAX_TERM_LENGTH),
    reason,
    ...(candidateComponentIds?.length ? { candidateComponentIds: Array.from(new Set(candidateComponentIds)).slice(0, MAX_CANDIDATES) } : {}),
  };
}

/**
 * Resolves only one active exact normalized term. Unverified rows are
 * intentionally live with provisional classification from their creation.
 * query on locale + normalizedTerm; this function also validates that a
 * database/query bug cannot turn a broad result into an arbitrary choice.
 */
export function resolveExactFoodComponent(
  rawText: string,
  locale: FoodTermLocale,
  candidates: unknown,
): { resolved: ResolvedFoodComponentRef } | { unresolved: UnresolvedFoodComponentHistory } {
  const normalized = normalizeFoodTerm(rawText);
  if (!normalized || rawText.length > MAX_TERM_LENGTH || !Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) {
    return { unresolved: unresolvedFoodComponent(rawText, "invalid_candidate") };
  }

  const parsed = candidates.map(candidate => foodComponentCandidateSchema.safeParse(candidate));
  if (parsed.some(result => !result.success)) return { unresolved: unresolvedFoodComponent(rawText, "invalid_candidate") };
  const exact = parsed
    .map(result => result.data!)
    .filter(candidate =>
      candidate.active &&
      candidate.term.foodComponentId === candidate.id &&
      candidate.term.locale === locale &&
      candidate.term.normalizedTerm === normalized,
    );
  const ids = Array.from(new Set(exact.map(candidate => candidate.id)));
  if (ids.length === 0) return { unresolved: unresolvedFoodComponent(rawText, "no_match") };
  if (ids.length !== 1) return { unresolved: unresolvedFoodComponent(rawText, "ambiguous", ids) };
  const candidate = exact[0];
  return { resolved: { id: candidate.id, source: "catalog_match" } };
}

export type ParsedCatalogCsvRow = {
  internalId: string; nameEn: string; nameZhHant: string; nameYue: string; aliases: string[];
  carbCategory: string | null; carbSubtype: string | null; isCarb: boolean; sweetCategory: string | null;
  sugarStatus: string; defaultSugarStatus: string | null; verified: boolean; active: boolean;
  region: string | null; notes: string | null;
};

const CSV_HEADER = ["internal_id", "name_en", "name_zh_hant", "name_yue", "aliases", "carb_category", "carb_subtype", "is_carb", "sweet_category", "sugar_status", "default_sugar_status", "verified", "active", "region", "notes"];

function csvCells(line: string): string[] {
  const cells: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (line[i] === "," && !quoted) { cells.push(cell); cell = ""; } else cell += line[i];
  }
  if (quoted) throw new Error("Malformed food catalog CSV: unclosed quote");
  cells.push(cell);
  return cells;
}

/** Strictly parses the published 15-column source; malformed imports fail closed. */
export function parseFoodCatalogCsv(csv: string): ParsedCatalogCsvRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2 || csvCells(lines[0]).join("|") !== CSV_HEADER.join("|")) throw new Error("Unexpected food catalog CSV header");
  const seen = new Set<string>();
  return lines.slice(1).map((line, index) => {
    const row = csvCells(line);
    if (row.length !== CSV_HEADER.length) throw new Error(`Malformed food catalog CSV row ${index + 2}`);
    const get = (name: string) => row[CSV_HEADER.indexOf(name)].trim();
    const internalId = get("internal_id");
    if (!/^[a-z0-9_]+$/.test(internalId) || seen.has(internalId)) throw new Error(`Invalid or duplicate internal_id: ${internalId}`);
    seen.add(internalId);
    const bool = (name: string) => {
      const value = get(name);
      if (value !== "True" && value !== "False") throw new Error(`Invalid ${name} at row ${index + 2}`);
      return value === "True";
    };
    const required = ["name_en", "name_zh_hant", "name_yue", "sugar_status"];
    if (required.some(name => !get(name))) throw new Error(`Missing required catalog value at row ${index + 2}`);
    const nullable = (name: string) => get(name) || null;
    return { internalId, nameEn: get("name_en"), nameZhHant: get("name_zh_hant"), nameYue: get("name_yue"),
      aliases: get("aliases").split(";").map(alias => alias.trim()).filter(Boolean), carbCategory: nullable("carb_category"),
      carbSubtype: nullable("carb_subtype"), isCarb: bool("is_carb"), sweetCategory: nullable("sweet_category"),
      sugarStatus: get("sugar_status"), defaultSugarStatus: nullable("default_sugar_status"),
      verified: bool("verified"), active: bool("active"), region: nullable("region"), notes: nullable("notes") };
  });
}