/**
 * Imports the checked-in 49-row Hong Kong carbohydrate catalogue. This is
 * intentionally an explicit operator command; startup never writes catalogue
 * records. Run after applying the schema migration, not with drizzle-kit push.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { foodComponentTerms, foodComponents } from "../shared/schema";
import { db, pool } from "../server/db";
import { normalizeFoodTerm, parseFoodCatalogCsv, type FoodTermLocale } from "../server/food-catalog";

const SOURCE = resolve("attached_assets/hk_carb_catalog_49_no_gi_reference_1788772727567.csv");
const rows = parseFoodCatalogCsv(readFileSync(SOURCE, "utf8"));
if (rows.length !== 49) throw new Error(`Expected exactly 49 food catalogue rows; received ${rows.length}`);

function fixedId(prefix: "term", number: number): string {
  return `${prefix}_${String(number).padStart(26, "0")}`;
}

let nextTerm = 1;
const terms: Array<typeof foodComponentTerms.$inferInsert> = [];
for (const [index, row] of rows.entries()) {
  const foodComponentId = row.internalId;
  const add = (term: string, locale: FoodTermLocale, termType: "official" | "alias") => {
    const normalizedTerm = normalizeFoodTerm(term);
    if (!normalizedTerm) return;
    terms.push({ id: fixedId("term", nextTerm++), foodComponentId, locale, term, normalizedTerm, termType });
  };
  add(row.nameEn, "en", "official");
  add(row.nameZhHant, "zh-Hant", "official");
  add(row.nameYue, "yue", "official");
  for (const alias of row.aliases) add(alias, "und", "alias");
}

try {
  for (const [index, row] of rows.entries()) {
    await db.insert(foodComponents).values({
      id: row.internalId,
      internalId: row.internalId,
      labelEn: row.nameEn, labelZhHant: row.nameZhHant, labelYue: row.nameYue,
      carbCategory: row.carbCategory, carbSubtype: row.carbSubtype, isCarb: row.isCarb,
      sweetCategory: row.sweetCategory, sugarStatus: row.sugarStatus,
      defaultSugarStatus: row.defaultSugarStatus, verified: row.verified, active: row.active,
      region: row.region, notes: row.notes,
    }).onConflictDoUpdate({
      target: foodComponents.internalId,
      // Deliberately excludes `id`: catalog identity is immutable after creation.
      set: {
        labelEn: row.nameEn, labelZhHant: row.nameZhHant, labelYue: row.nameYue,
        carbCategory: row.carbCategory, carbSubtype: row.carbSubtype, isCarb: row.isCarb,
        sweetCategory: row.sweetCategory, sugarStatus: row.sugarStatus,
        defaultSugarStatus: row.defaultSugarStatus, verified: row.verified, active: row.active,
        region: row.region, notes: row.notes,
      },
    });
  }
  for (const term of terms) {
    await db.insert(foodComponentTerms).values(term).onConflictDoUpdate({
      target: [foodComponentTerms.foodComponentId, foodComponentTerms.locale, foodComponentTerms.normalizedTerm],
      set: { term: term.term, termType: term.termType },
    });
  }
  console.info(`Seeded ${rows.length} food components and ${terms.length} identity terms.`);
} finally {
  await pool.end();
}