import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { normalizeFoodTerm } from "../server/food-catalog";
import { buildGeneralGlucosePatternComponents, buildHstixFoodCards } from "../server/glucose-patterns";
import { buildFoodFrequencySummary } from "../server/food-frequency";

const TARGET_EMAIL = "glucosetest@gmail.com";
const PLACEHOLDER_USER_ID = "test_user_929";
const SOURCE = "seed_test_data";
const BATCH = "glucosetest-csv-929";
const LEGACY_LABEL_PREFIX = "seed_test_data-glucosetest-glucose-patterns-v2-";
const paths = {
  components: "attached_assets/test_food_components_seed_1788781723095.csv",
  gi: "attached_assets/test_gi_lookup_seed_1788781723096.csv",
  readings: "attached_assets/test_hstix_readings_1788781723096.csv",
  meals: "attached_assets/test_meal_snaps_1788781723096.csv",
};

type Row = Record<string, string>;

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); records.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error(`${path}: unterminated quoted field`);
  if (field || row.length) { row.push(field.replace(/\r$/, "")); records.push(row); }
  const header = records.shift();
  if (!header?.length) throw new Error(`${path}: missing header`);
  return records.filter(values => values.some(Boolean)).map((values, index) => {
    if (values.length !== header.length) throw new Error(`${path}:${index + 2}: expected ${header.length} columns, got ${values.length}`);
    return Object.fromEntries(header.map((key, i) => [key, values[i]]));
  });
}

function exactHeaders(rows: Row[], expected: string[], path: string): void {
  const actual = rows[0] ? Object.keys(rows[0]) : [];
  if (actual.join("\0") !== expected.join("\0")) throw new Error(`${path}: unexpected headers`);
}

function bool(value: string, field: string): boolean {
  if (value === "True") return true;
  if (value === "False") return false;
  throw new Error(`Invalid ${field} boolean`);
}

function nullable(value: string): string | null { return value.trim() || null; }
function quoteIdent(value: string): string { return `"${value.replaceAll('"', '""')}"`; }

const components = parseCsv(paths.components);
const giRows = parseCsv(paths.gi);
const readings = parseCsv(paths.readings);
const meals = parseCsv(paths.meals);

exactHeaders(components, ["internal_id","name_en","name_zh_hant","name_yue","aliases","is_carb","carb_category","carb_subtype","sweet_category","sugar_status","default_sugar_status","verified","active","gi_not_applicable","notes"], paths.components);
exactHeaders(giRows, ["name_zh_hant","component_id_ref","gi_status","gi_value","source","notes"], paths.gi);
exactHeaders(readings, ["reading_id","meal_snap_id","user_id","recorded_at","glucose_mmol","meal_timing_confidence"], paths.readings);
exactHeaders(meals, ["meal_snap_id","user_id","local_date","meal_type","food_name","food_items_json","post_meal_glucose_mmol","is_deleted"], paths.meals);
if (components.length !== 6 || giRows.length !== 6 || readings.length !== 108 || meals.length !== 110) {
  throw new Error("Fixture row counts must be components=6, GI=6, readings=108, meals=110");
}

const unique = (rows: Row[], key: string) => {
  const values = rows.map(row => row[key]);
  if (new Set(values).size !== values.length) throw new Error(`Duplicate fixture ${key}`);
};
unique(components, "internal_id"); unique(giRows, "name_zh_hant"); unique(readings, "reading_id"); unique(meals, "meal_snap_id");
const mealIds = new Set(meals.map(row => row.meal_snap_id));
if ([...meals, ...readings].some(row => row.user_id !== PLACEHOLDER_USER_ID)) throw new Error("Unexpected fixture user_id");
if (readings.some(row => !mealIds.has(row.meal_snap_id))) throw new Error("HStix fixture references an unknown meal");

const parsedItems = new Map<string, any[]>();
for (const meal of meals) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meal.local_date) || Number.isNaN(Date.parse(`${meal.local_date}T00:00:00Z`))) throw new Error("Invalid meal local_date");
  bool(meal.is_deleted, "is_deleted");
  const items = JSON.parse(meal.food_items_json);
  if (!Array.isArray(items) || items.length === 0) throw new Error("Every fixture meal needs at least one food observation");
  parsedItems.set(meal.meal_snap_id, items);
}
for (const reading of readings) {
  if (!Number.isFinite(Number(reading.glucose_mmol)) || Number.isNaN(Date.parse(reading.recorded_at))) throw new Error("Invalid HStix fixture");
  if (!["on_time", "delayed", "unrelated"].includes(reading.meal_timing_confidence)) throw new Error("Invalid meal_timing_confidence");
}

const confirmation = process.argv.find(arg => arg.startsWith("--confirm-development-database="))?.split("=", 2)[1];
if (process.env.NODE_ENV !== "development") throw new Error("Refusing to run unless the caller explicitly sets NODE_ENV=development");
if (process.env.REPLIT_DEPLOYMENT) throw new Error("Refusing to run inside a Replit deployment");
if (confirmation !== TARGET_EMAIL) {
  throw new Error(`Refusing destructive replacement without --confirm-development-database=${TARGET_EMAIL}`);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const deleteInventory = [
  "correction_requests", "cycle_history", "daily_logs", "deletion_requests", "doctor_info",
  "hstix_readings", "meal_snap_health_history", "meal_snaps", "monthly_reports",
  "password_reset_tokens", "piggy_bank_events", "scheduled_notifications", "snap_daily_glucose",
  "snap_monthly_archive", "snap_report_meal_facts", "snap_report_user_metadata",
  "user_carb_subtype_preferences", "user_consents", "user_data_actions", "user_glucose_thresholds",
  "user_glucose_thresholds_history", "user_profile_health_history", "weekly_plans", "weekly_reports",
] as const;

async function main() {
  const client = await pool.connect();
  let stage = "begin";
  try {
    await client.query("BEGIN");
    stage = "preconditions";
    const precondition = await client.query(`
      SELECT
        to_regclass('public.food_components') IS NOT NULL AS has_components,
        to_regclass('public.food_component_terms') IS NOT NULL AS has_terms,
        to_regclass('public.food_gi_entries') IS NOT NULL AS has_gi,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='food_components' AND column_name='label_zh_hant'
        ) AS has_canonical_chinese
    `);
    if (!Object.values(precondition.rows[0]).every(Boolean)) throw new Error("Task #929 schema precondition is absent");

    const target = await client.query(
      `SELECT u.id, u.email, up.id AS profile_id, up.glucose_group
         FROM users u JOIN user_profiles up ON up.user_id=u.id
        WHERE lower(u.email)=lower($1) FOR UPDATE OF u, up`,
      [TARGET_EMAIL],
    );
    if (target.rows.length !== 1) throw new Error(`Expected exactly one target account; found ${target.rows.length}`);
    const userId = target.rows[0].id as string;
    const profileId = target.rows[0].profile_id;
    const glucoseGroup = target.rows[0].glucose_group === "t2dm" ? "t2dm" : "healthy";

    const actualInventory = await client.query(`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema='public' AND column_name='user_id' AND table_name <> 'user_profiles'
      ORDER BY table_name
    `);
    const actual = actualInventory.rows.map(row => row.table_name);
    const approved = [...deleteInventory].sort();
    if (actual.join("\0") !== approved.join("\0")) throw new Error(`User-table inventory changed; aborting (${actual.join(",")})`);

    const otherBefore = new Map<string, number>();
    for (const table of deleteInventory) {
      const count = await client.query(`SELECT COUNT(*)::int count FROM ${quoteIdent(table)} WHERE user_id <> $1`, [userId]);
      otherBefore.set(table, count.rows[0].count);
    }
    const suppliedIds = components.map(row => row.internal_id);
    const suppliedGiNames = giRows.map(row => row.name_zh_hant);
    const unrelatedGlobalBefore = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM food_labels WHERE internal_id NOT LIKE $3) unrelated_food_labels,
        (SELECT COUNT(*)::int FROM ingredient_vocabulary) ingredient_vocabulary,
        (SELECT COUNT(*)::int FROM food_components WHERE id <> ALL($1::text[])) unrelated_components,
        (SELECT COUNT(*)::int FROM food_gi_entries WHERE normalized_food_name <> ALL($2::text[])) unrelated_gi
    `, [suppliedIds, suppliedGiNames, `${LEGACY_LABEL_PREFIX}%`]);

    for (const row of components) {
      stage = "component-upsert";
      for (const [locale, term] of [["en", row.name_en], ["zh-Hant", row.name_zh_hant], ["yue", row.name_yue]]) {
        const conflict = await client.query(`
          SELECT food_component_id FROM food_component_terms
          WHERE locale=$1 AND normalized_term=$2 AND term_type='official' AND food_component_id<>$3
          LIMIT 1
        `, [locale, normalizeFoodTerm(term), row.internal_id]);
        if (conflict.rows.length > 0) throw new Error(`Refusing conflicting official term for ${row.internal_id}`);
      }
      const existing = await client.query(`SELECT * FROM food_components WHERE id=$1 OR internal_id=$1`, [row.internal_id]);
      if (existing.rows.length > 1) throw new Error(`Conflicting component identity ${row.internal_id}`);
      if (existing.rows.length === 1) {
        const value = existing.rows[0];
        if (value.id !== row.internal_id || value.internal_id !== row.internal_id ||
            normalizeFoodTerm(value.label_en) !== normalizeFoodTerm(row.name_en) ||
            normalizeFoodTerm(value.label_zh_hant) !== normalizeFoodTerm(row.name_zh_hant) ||
            normalizeFoodTerm(value.label_yue) !== normalizeFoodTerm(row.name_yue)) {
          throw new Error(`Refusing conflicting remap for ${row.internal_id}`);
        }
        await client.query(`
          UPDATE food_components SET
            label_en=$2,label_zh_hant=$3,label_yue=$4,carb_category=$5,carb_subtype=$6,
            is_carb=$7,sweet_category=$8,sugar_status=$9,default_sugar_status=$10,
            verified=$11,active=$12,notes=$13,updated_at=NOW()
          WHERE id=$1
        `, [
          row.internal_id, row.name_en, row.name_zh_hant, row.name_yue, nullable(row.carb_category),
          nullable(row.carb_subtype), bool(row.is_carb, "is_carb"), nullable(row.sweet_category),
          row.sugar_status, nullable(row.default_sugar_status), bool(row.verified, "verified"),
          bool(row.active, "active"), row.notes,
        ]);
      } else {
        await client.query(`
          INSERT INTO food_components
            (id,internal_id,label_en,label_zh_hant,label_yue,carb_category,carb_subtype,is_carb,
             sweet_category,sugar_status,default_sugar_status,verified,active,notes)
          VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [
          row.internal_id, row.name_en, row.name_zh_hant, row.name_yue, nullable(row.carb_category),
          nullable(row.carb_subtype), bool(row.is_carb, "is_carb"), nullable(row.sweet_category),
          row.sugar_status, nullable(row.default_sugar_status), bool(row.verified, "verified"),
          bool(row.active, "active"), row.notes,
        ]);
      }
      await client.query(`DELETE FROM food_component_terms WHERE food_component_id=$1`, [row.internal_id]);
      for (const [locale, term, type] of [
        ["en", row.name_en, "official"], ["zh-Hant", row.name_zh_hant, "official"], ["yue", row.name_yue, "official"],
        ...row.aliases.split(";").map(alias => ["und", alias.trim(), "alias"]),
      ]) {
        await client.query(`
          INSERT INTO food_component_terms (id,food_component_id,locale,term,normalized_term,term_type)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (food_component_id,locale,normalized_term) DO UPDATE SET term=EXCLUDED.term,term_type=EXCLUDED.term_type
        `, [randomUUID(), row.internal_id, locale, term, normalizeFoodTerm(term), type]);
      }
    }

    for (const row of giRows) {
      stage = "gi-upsert";
      const component = await client.query(`SELECT label_zh_hant FROM food_components WHERE id=$1 AND active=true`, [row.component_id_ref]);
      if (component.rows.length !== 1 || component.rows[0].label_zh_hant !== row.name_zh_hant) {
        throw new Error(`GI canonical Chinese mismatch for ${row.component_id_ref}`);
      }
      if (!["resolved", "pending", "unavailable"].includes(row.gi_status)) throw new Error("Invalid GI fixture status");
      const value = nullable(row.gi_value);
      if ((row.gi_status === "resolved") !== (value !== null) || (value !== null && !Number.isFinite(Number(value)))) {
        throw new Error(`Invalid GI value/state for ${row.component_id_ref}`);
      }
      await client.query(`
        INSERT INTO food_gi_entries (normalized_food_name,status,reference_id,gi_value,source,resolved_at,claim_expires_at,claim_token)
        VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7)
        ON CONFLICT (normalized_food_name) DO UPDATE SET
          status=EXCLUDED.status,reference_id=EXCLUDED.reference_id,gi_value=EXCLUDED.gi_value,
          source=EXCLUDED.source,resolved_at=EXCLUDED.resolved_at,
          claim_expires_at=EXCLUDED.claim_expires_at,claim_token=EXCLUDED.claim_token
      `, [
        row.name_zh_hant,
        row.gi_status,
        row.gi_status === "resolved" ? row.component_id_ref : null,
        value === null ? null : Number(value),
        row.source || "fixture_pending",
        row.gi_status === "pending" ? new Date("2099-01-01T00:00:00Z") : null,
        row.gi_status === "pending" ? `fixture:${row.component_id_ref}` : null,
      ]);
    }

    const referencedIds = new Set<string>();
    stage = "meal-reference-validation";
    for (const items of parsedItems.values()) for (const item of items) if (typeof item.id === "string") referencedIds.add(item.id);
    const refs = await client.query(`SELECT id FROM food_components WHERE id=ANY($1::text[]) AND active=true`, [[...referencedIds]]);
    if (refs.rows.length !== referencedIds.size) throw new Error("A meal references an absent/inactive canonical component");

    const deleted: Record<string, number> = {};
    stage = "target-deletion";
    for (const table of deleteInventory) {
      const result = await client.query(`DELETE FROM ${quoteIdent(table)} WHERE user_id=$1`, [userId]);
      deleted[table] = result.rowCount ?? 0;
    }
    stage = "legacy-label-cleanup";
    const deletedLegacyLabels = await client.query(`
      DELETE FROM food_labels fl
      WHERE fl.internal_id LIKE $1
        AND NOT EXISTS (SELECT 1 FROM meal_snaps ms WHERE ms.combo_key=fl.internal_id)
    `, [`${LEGACY_LABEL_PREFIX}%`]);

    const readingByMeal = new Map(readings.map(row => [row.meal_snap_id, row]));
    const insertedMealIds = new Map<string, number>();
    const threshold = glucoseGroup === "t2dm" ? { low: 7.5, high: 10 } : { low: 5.9, high: 7.8 };
    const impact = (value: number | null) => value === null ? null : value <= threshold.low ? "low" : value >= threshold.high ? "high" : "medium";
    for (const row of meals) {
      stage = "meal-insert";
      const fixtureItems = parsedItems.get(row.meal_snap_id)!;
      const compact = fixtureItems.map(item => typeof item.id === "string"
        ? { id: item.id, source: item.source === "catalog_created" ? "catalog_created" : "catalog_match" }
        : { history: { rawText: item.nameZhHant, normalizedText: normalizeFoodTerm(item.nameZhHant), reason: "no_match" } });
      const reading = readingByMeal.get(row.meal_snap_id);
      const glucose = nullable(row.post_meal_glucose_mmol);
      const recordedAt = reading ? new Date(reading.recorded_at) : null;
      const snapTime = recordedAt ? new Date(recordedAt.getTime() - 60 * 60_000) : new Date(`${row.local_date}T12:00:00Z`);
      const inserted = await client.query(`
        INSERT INTO meal_snaps
          (user_id,source,seed_batch_id,snap_time,local_date,meal_type,food_name,portion,glucose_impact,
           missed_meal_flag,combo_key,food_items,post_meal_glucose_mmol,post_meal_recorded_at,is_deleted)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,false,$9,$10::jsonb,$11,$12,$13)
        RETURNING id
      `, [
        userId, SOURCE, BATCH, snapTime, row.local_date, row.meal_type, row.food_name,
        impact(glucose === null ? null : Number(glucose)), `${BATCH}:${row.meal_snap_id}`,
        JSON.stringify(compact), glucose === null ? null : Number(glucose), recordedAt,
        bool(row.is_deleted, "is_deleted"),
      ]);
      const databaseId = Number(inserted.rows[0].id);
      insertedMealIds.set(row.meal_snap_id, databaseId);
      await client.query(`
        INSERT INTO snap_report_meal_facts (snap_id,user_id,local_date,meal_type,final_impact)
        VALUES ($1,$2,$3,$4,$5)
      `, [databaseId, userId, row.local_date, row.meal_type, impact(glucose === null ? null : Number(glucose))]);
    }
    for (const row of readings) {
      stage = "reading-insert";
      await client.query(`
        INSERT INTO hstix_readings
          (user_id,source,seed_batch_id,meal_snap_id,glucose_mmol,note,minutes_since_last_meal,meal_timing_confidence,recorded_at)
        VALUES ($1,$2,$3,$4,$5,NULL,60,$6,$7)
      `, [userId, SOURCE, BATCH, insertedMealIds.get(row.meal_snap_id), Number(row.glucose_mmol), row.meal_timing_confidence, new Date(row.recorded_at)]);
    }
    stage = "derived-metadata";
    await client.query(`
      INSERT INTO snap_report_user_metadata (user_id,first_meal_local_date)
      SELECT $1::varchar,MIN(local_date) FROM meal_snaps WHERE user_id=$1::varchar
    `, [userId]);
    await client.query(`
      INSERT INTO snap_daily_glucose (user_id,local_date,low_count,medium_count,high_count,meal_count,has_late_meal)
      SELECT user_id,local_date,
        COUNT(*) FILTER (WHERE glucose_impact='low'),
        COUNT(*) FILTER (WHERE glucose_impact='medium'),
        COUNT(*) FILTER (WHERE glucose_impact='high'),
        COUNT(*),BOOL_OR(meal_type='snack')
      FROM meal_snaps WHERE user_id=$1 GROUP BY user_id,local_date
    `, [userId]);

    stage = "count-verification";
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM meal_snaps WHERE user_id=$1) meals,
        (SELECT COUNT(*)::int FROM hstix_readings WHERE user_id=$1) readings,
        (SELECT COUNT(*)::int FROM hstix_readings h JOIN meal_snaps m ON m.id=h.meal_snap_id WHERE h.user_id=$1 AND m.user_id=$1) linked,
        (SELECT COUNT(*)::int FROM meal_snaps WHERE user_id=$2) placeholder_meals,
        (SELECT COUNT(*)::int FROM hstix_readings WHERE user_id=$2) placeholder_readings,
        (SELECT COUNT(*)::int FROM meal_snaps WHERE user_id=$1 AND food_items @? '$[*].history') unresolved
    `, [userId, PLACEHOLDER_USER_ID]);
    if (counts.rows[0].meals !== 110 || counts.rows[0].readings !== 108 || counts.rows[0].linked !== 108 ||
        counts.rows[0].placeholder_meals !== 0 || counts.rows[0].placeholder_readings !== 0 || counts.rows[0].unresolved !== 2) {
      throw new Error("Post-import ownership/count verification failed");
    }
    const profile = await client.query(`SELECT id FROM user_profiles WHERE user_id=$1`, [userId]);
    if (profile.rows.length !== 1 || profile.rows[0].id !== profileId) throw new Error("Target profile was not preserved");
    for (const table of deleteInventory) {
      const count = await client.query(`SELECT COUNT(*)::int count FROM ${quoteIdent(table)} WHERE user_id <> $1`, [userId]);
      if (count.rows[0].count !== otherBefore.get(table)) throw new Error(`Other-user data changed in ${table}`);
    }
    const unrelatedGlobalAfter = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM food_labels WHERE internal_id NOT LIKE $3) unrelated_food_labels,
        (SELECT COUNT(*)::int FROM ingredient_vocabulary) ingredient_vocabulary,
        (SELECT COUNT(*)::int FROM food_components WHERE id <> ALL($1::text[])) unrelated_components,
        (SELECT COUNT(*)::int FROM food_gi_entries WHERE normalized_food_name <> ALL($2::text[])) unrelated_gi
    `, [suppliedIds, suppliedGiNames, `${LEGACY_LABEL_PREFIX}%`]);
    if (JSON.stringify(unrelatedGlobalAfter.rows[0]) !== JSON.stringify(unrelatedGlobalBefore.rows[0])) {
      throw new Error("Unrelated global/shared data changed");
    }
    const staleLegacyLabels = await client.query(`
      SELECT COUNT(*)::int count FROM food_labels fl
      WHERE fl.internal_id LIKE $1
        AND NOT EXISTS (SELECT 1 FROM meal_snaps ms WHERE ms.combo_key=fl.internal_id)
    `, [`${LEGACY_LABEL_PREFIX}%`]);
    if (staleLegacyLabels.rows[0].count !== 0) throw new Error("Unreferenced legacy fixture labels remain");
    for (const row of components) {
      const expectedTerms = [
        ["en", row.name_en, "official"], ["zh-Hant", row.name_zh_hant, "official"], ["yue", row.name_yue, "official"],
        ...row.aliases.split(";").map(alias => ["und", alias.trim(), "alias"]),
      ].map(([locale, term, type]) => `${locale}\0${normalizeFoodTerm(term)}\0${type}`).sort();
      const actualTerms = await client.query(`
        SELECT locale,normalized_term,term_type FROM food_component_terms
        WHERE food_component_id=$1 ORDER BY locale,normalized_term,term_type
      `, [row.internal_id]);
      const actualKeys = actualTerms.rows.map(term => `${term.locale}\0${term.normalized_term}\0${term.term_type}`).sort();
      if (actualKeys.join("\n") !== expectedTerms.join("\n")) throw new Error(`Fixture terms did not reconcile for ${row.internal_id}`);
    }

    stage = "aggregate-verification";
    const hydratedRows = await client.query(`
      SELECT m.id AS meal_id, m.food_items, m.post_meal_glucose_mmol, h.recorded_at, h.meal_timing_confidence,
             c.id AS component_id,c.label_en,c.label_zh_hant,c.label_yue,c.is_carb,c.carb_category,c.carb_subtype,c.sweet_category,c.verified
      FROM meal_snaps m
      LEFT JOIN hstix_readings h ON h.meal_snap_id=m.id
      LEFT JOIN LATERAL jsonb_array_elements(m.food_items) item ON item ? 'id'
      LEFT JOIN food_components c ON c.id=item->>'id'
      WHERE m.user_id=$1 ORDER BY m.id
    `, [userId]);
    const grouped = new Map<number, any>();
    for (const row of hydratedRows.rows) {
      const current = grouped.get(row.meal_id) ?? { postMealGlucoseMmol: row.post_meal_glucose_mmol, mealTimingConfidence: row.meal_timing_confidence, isCanonicalHstix: !!row.recorded_at, foodItems: [] };
      if (row.label_en) current.foodItems.push({ id: row.component_id, nameEn: row.label_en, nameZhHant: row.label_zh_hant, nameYue: row.label_yue, isCarb: row.is_carb, carbCategory: row.carb_category, carbSubtype: row.carb_subtype, sweetCategory: row.sweet_category, subtypeConfirmed: row.verified, source: "catalog_match" });
      grouped.set(row.meal_id, current);
    }
    const aggregateMeals = [...grouped.values()];
    const general = buildGeneralGlucosePatternComponents(aggregateMeals);
    const hstix = buildHstixFoodCards(aggregateMeals.filter(row => row.isCanonicalHstix), glucoseGroup);
    const frequency = buildFoodFrequencySummary(aggregateMeals.map(row => ({ foodItems: row.foodItems, isDeleted: false } as any)));
    const unresolvedLeaked = [
      ...general.map(row => row.foodKey),
      ...hstix.flatMap(row => [
        row.foodKey,
        row.partnerInsight?.kind === "dominant" ? row.partnerInsight.partner.foodKey : null,
        row.partnerInsight?.kind === "comparison" ? row.partnerInsight.higherPartner.foodKey : null,
        row.partnerInsight?.kind === "comparison" ? row.partnerInsight.lowerPartner.foodKey : null,
      ]),
      ...frequency.foods.map(row => row.foodKey),
    ].some(key => typeof key === "string" && !key.startsWith("component:"));
    if (unresolvedLeaked) throw new Error("Unresolved observations entered canonical aggregates");

    await client.query("COMMIT");
    console.log(JSON.stringify({
      action: "replace-complete", targetEmail: TARGET_EMAIL, preservedProfile: true,
      imported: { mealSnaps: 110, hstixReadings: 108, unresolvedHistoryOnly: 2, components: 6, giRows: 6 },
      deleted,
      deletedLegacyFixtureLabels: deletedLegacyLabels.rowCount ?? 0,
      verification: { linkedReadings: 108, placeholderReferences: 0, otherUsersUnchanged: true, unrelatedGlobalDataUnchanged: true, unresolvedExcludedFromCanonicalAggregates: true },
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error(`${stage}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});