import { db } from "../server/db";
import { ingredientVocabulary, foodLabels, foodAdviceCache } from "../shared/schema";
import { eq } from "drizzle-orm";
import XLSX from "xlsx";
import { fileURLToPath } from "url";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORTION_MAP: Record<string, string> = {
  "Small": "small",
  "Medium": "medium",
  "Large": "large",
};

function toInternalId(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseEnglishIds(raw: string | null): string[] {
  if (!raw || raw === "nil") return [];
  const noParens = raw.replace(/\([^)]*\)/g, "");
  const englishOnly = noParens.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef、，].*/u, "");
  return englishOnly.split(",").map(s => toInternalId(s)).filter(Boolean);
}

function buildFullComboId(foodId: string, portionId: string, sauceIds: string[], toppingIds: string[]): string {
  return [
    foodId,
    portionId,
    ...[...sauceIds].sort(),
    ...[...toppingIds].sort(),
  ].filter(Boolean).join("__");
}

function buildAdviceText(impact: string, watchOut: string, rightNow: string, nextTime: string): string {
  const lines = [
    `🩸 Blood sugar impact: ${impact}`,
    watchOut ? `⚠️ Watch out: ${watchOut}` : null,
    `⚡ Right now: ${rightNow}`,
    `📝 Next time: ${nextTime}`,
  ];
  return lines.filter(Boolean).join("\n");
}

const localeMap = [
  { suffix: "eng", locale: "en" },
  { suffix: "zh_hant", locale: "zh-Hant" },
  { suffix: "yue", locale: "yue" },
];

async function seedOneFile(label: string, xlsxPath: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${label}`);
  console.log(`${"=".repeat(60)}`);

  const workbook = XLSX.readFile(xlsxPath);
  const sheet1 = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[workbook.SheetNames[0]], { range: 1 });
  const sheet2 = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[workbook.SheetNames[1]], { range: 1 });

  console.log(`Parsed ${sheet1.length} rows from Sheet 1 (labels), ${sheet2.length} rows from Sheet 2 (advice)`);

  const sauceLabels = new Map<string, { en: string; zh: string; yue: string }>();
  const toppingLabels = new Map<string, { en: string; zh: string; yue: string }>();

  for (const row of sheet1) {
    const saucesEn = parseEnglishIds(row.sauces_en);
    const toppingsEn = parseEnglishIds(row.toppings_en);
    saucesEn.forEach(id => {
      if (!sauceLabels.has(id)) {
        const rawEn = (row.sauces_en || "").replace(/\([^)]*\)/g, "").replace(/[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef、，].*/u, "");
        const parts = rawEn.split(",").map((s: string) => s.trim()).filter(Boolean);
        const idx = saucesEn.indexOf(id);
        const label = parts[idx] || id.replace(/_/g, " ");
        sauceLabels.set(id, {
          en: label.charAt(0).toUpperCase() + label.slice(1),
          zh: row.sauces_zh_hant || label,
          yue: row.sauces_yue || label,
        });
      }
    });
    toppingsEn.forEach(id => {
      if (!toppingLabels.has(id)) {
        const rawEn = (row.toppings_en || "").replace(/\([^)]*\)/g, "").replace(/[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef、，].*/u, "");
        const parts = rawEn.split(",").map((s: string) => s.trim()).filter(Boolean);
        const idx = toppingsEn.indexOf(id);
        const label = parts[idx] || id.replace(/_/g, " ");
        toppingLabels.set(id, {
          en: label.charAt(0).toUpperCase() + label.slice(1),
          zh: row.toppings_zh_hant || label,
          yue: row.toppings_yue || label,
        });
      }
    });
  }

  console.log("\nSeeding ingredient vocabulary...");
  for (const [id, labels] of sauceLabels) {
    const [existing] = await db.select().from(ingredientVocabulary)
      .where(eq(ingredientVocabulary.internalId, id));
    if (!existing) {
      await db.insert(ingredientVocabulary).values({
        internalId: id,
        category: "sauce",
        labelEn: labels.en,
        labelZh: labels.zh,
        labelYue: labels.yue,
        aliases: [id, labels.en.toLowerCase()],
      });
      console.log(`  + sauce: ${id}`);
    } else {
      console.log(`  = sauce: ${id} (exists)`);
    }
  }
  for (const [id, labels] of toppingLabels) {
    const [existing] = await db.select().from(ingredientVocabulary)
      .where(eq(ingredientVocabulary.internalId, id));
    if (!existing) {
      await db.insert(ingredientVocabulary).values({
        internalId: id,
        category: "topping",
        labelEn: labels.en,
        labelZh: labels.zh,
        labelYue: labels.yue,
        aliases: [id, labels.en.toLowerCase()],
      });
      console.log(`  + topping: ${id}`);
    } else {
      console.log(`  = topping: ${id} (exists)`);
    }
  }

  console.log("\nSeeding food_labels from Sheet 1...");
  const foodIdToComboId = new Map<string, string>();

  for (const row of sheet1) {
    const foodId = row.internal_id;
    const portionId = PORTION_MAP[row.portion_en] || "medium";
    const sauceIds = parseEnglishIds(row.sauces_en);
    const toppingIds = parseEnglishIds(row.toppings_en);
    const internalId = buildFullComboId(foodId, portionId, sauceIds, toppingIds);

    foodIdToComboId.set(foodId, internalId);

    const [existing] = await db.select().from(foodLabels)
      .where(eq(foodLabels.internalId, internalId));
    if (!existing) {
      await db.insert(foodLabels).values({
        internalId,
        foodNameEn: row.food_name_en,
        foodNameZhHant: row.food_name_zh_hant,
        foodNameYue: row.food_name_yue,
        defaultPortionId: portionId,
        defaultSauces: sauceIds,
        defaultToppings: toppingIds,
        isSugaryFood: row.is_sugary_food === "✔",
        isSugaryDrink: row.is_sugary_drink === "✔",
        isOily: row.is_oily === "✔",
        isSnack: row.is_snack === "✔",
        useCount: 0,
      });
      console.log(`  + ${internalId}`);
    } else {
      console.log(`  = ${internalId} (exists)`);
    }
  }

  console.log("\nSeeding food_advice_cache from Sheet 2...");

  for (const row of sheet2) {
    const foodId = row.internal_id;
    const comboId = foodIdToComboId.get(foodId);
    if (!comboId) {
      console.log(`  ! Skipping ${foodId} — no matching food_labels entry`);
      continue;
    }

    for (const { suffix, locale } of localeMap) {
      const impact = row[`blood_sugar_impact_${suffix}`] || "";
      const watchOut = row[`watch_out_${suffix}`] || "";
      const rightNow = row[`right_now_${suffix}`] || "";
      const nextTime = row[`next_time_${suffix}`] || "";

      const adviceText = buildAdviceText(impact, watchOut, rightNow, nextTime);
      const foodName = locale === "en"
        ? (sheet1.find(s => s.internal_id === foodId)?.food_name_en || foodId)
        : locale === "zh-Hant"
          ? (sheet1.find(s => s.internal_id === foodId)?.food_name_zh_hant || foodId)
          : (sheet1.find(s => s.internal_id === foodId)?.food_name_yue || foodId);

      await db.insert(foodAdviceCache)
        .values({
          foodName,
          comboKey: comboId,
          locale,
          adviceText,
          adviceSource: "seed",
        })
        .onConflictDoNothing();
    }
    console.log(`  + ${foodId} → ${comboId} (3 locales)`);
  }

  // #578: food_combos backfill removed with the table. food_labels (seeded
  // above) is now the single source of food-name lookup defaults.

  console.log(`\nDone with ${label}!`);
}

const SEED_FILES = [
  { label: "HK foods", file: "hk_food_seed_1776185792306.xlsx" },
  { label: "JP foods", file: "jp_food_seed_(1)_1776244914411.xlsx" },
  { label: "Western foods", file: "western_food_seed_(1)_1776244914413.xlsx" },
];

async function seed() {
  for (const { label, file } of SEED_FILES) {
    const xlsxPath = path.resolve(__dirname, "../attached_assets", file);
    await seedOneFile(label, xlsxPath);
  }

  console.log("\n" + "=".repeat(60));
  console.log("All files seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
