import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildStructuredAdvice,
  sanitizeAdviceAttribution,
} from "../server/snap-advice-structured.ts";
import { prepareFoodItems } from "../server/carb-subtypes.ts";

const confirmedItems = prepareFoodItems([
  { nameEn: "udon noodles", nameZhHant: "烏冬", nameYue: "烏冬" },
  { nameEn: "Chinese yam", nameZhHant: "山藥", nameYue: "山藥" },
  { nameEn: "egg", nameZhHant: "雞蛋", nameYue: "雞蛋" },
  { nameEn: "white rice", nameZhHant: "白飯", nameYue: "白飯" },
  { nameEn: "plain yogurt", nameZhHant: "原味乳酪", nameYue: "原味乳酪" },
  { nameEn: "sweetened yogurt", nameZhHant: "加糖乳酪", nameYue: "加糖乳酪" },
  { nameEn: "tofu", nameZhHant: "豆腐", nameYue: "豆腐" },
]);
const attributionContext = { foodItems: confirmedItems, sauces: "soy sauce" };
assert.equal(confirmedItems.find(item => item.nameEn === "egg")?.isCarb, false);

const english = [
  "Blood sugar impact: High",
  "Watch out: egg --> overall meal starch burden；udon noodles --> refined carbohydrate",
  "Right now: 2 + 5",
  '{"foodItems":[{"nameEn":"udon noodles","nameZhHant":"烏冬","nameYue":"烏冬"},{"nameEn":"Chinese yam","nameZhHant":"山藥","nameYue":"山藥"},{"nameEn":"egg","nameZhHant":"雞蛋","nameYue":"雞蛋"}]}',
].join("\n");

const englishResult = sanitizeAdviceAttribution(english, attributionContext);
assert.equal(englishResult.removedRows, 1);
assert.doesNotMatch(englishResult.advice, /egg -->/i);
assert.match(englishResult.advice, /udon noodles --> refined carbohydrate/i);
assert.match(englishResult.advice, /"foodItems"/);

const traditionalChinese = [
  "血糖影響: 高",
  "注意：雞蛋 --> 整餐澱粉負擔；烏冬 --> 精製碳水",
  "現在: 2 + 5",
].join("\n");
const traditionalResult = sanitizeAdviceAttribution(traditionalChinese, attributionContext);
assert.equal(traditionalResult.removedRows, 1);
assert.doesNotMatch(traditionalResult.advice, /雞蛋 -->/);
assert.match(traditionalResult.advice, /烏冬 --> 精製碳水/);

const cantonese = [
  "血糖影響: 高",
  "注意：雞蛋 --> 呢餐總碳水高；山藥 --> 碳水來源",
  "依家: 2 + 5",
].join("\n");
const cantoneseResult = sanitizeAdviceAttribution(cantonese, attributionContext);
assert.equal(cantoneseResult.removedRows, 1);
assert.doesNotMatch(cantoneseResult.advice, /雞蛋 -->/);
assert.match(cantoneseResult.advice, /山藥 --> 碳水來源/);

const validIngredientWarnings = [
  "Blood sugar impact: Medium",
  "Watch out: plain yogurt --> portion still matters；tofu --> protein may delay digestion；white rice --> concentrated starch",
  "Right now: 3",
].join("\n");
const validResult = sanitizeAdviceAttribution(validIngredientWarnings, attributionContext);
assert.equal(validResult.removedRows, 0);
assert.equal(validResult.advice, validIngredientWarnings);

const crossIngredientEnglish = sanitizeAdviceAttribution(
  "Blood sugar impact: High\nWatch out: egg --> refined rice starch；tofu --> soy sauce sugar\nRight now: 2 + 5",
  attributionContext,
);
assert.equal(crossIngredientEnglish.removedRows, 2);
assert.doesNotMatch(crossIngredientEnglish.advice, /Watch out:/);

const crossIngredientTraditional = sanitizeAdviceAttribution(
  "血糖影響: 高\n注意：雞蛋 --> 烏冬精製碳水；豆腐 --> 醬汁糖分\n現在: 2 + 5",
  attributionContext,
);
assert.equal(crossIngredientTraditional.removedRows, 2);
assert.doesNotMatch(crossIngredientTraditional.advice, /注意：/);

const crossIngredientCantonese = sanitizeAdviceAttribution(
  "血糖影響: 高\n注意：山藥 --> 烏冬澱粉；雞蛋 --> 白飯碳水\n依家: 2 + 5",
  attributionContext,
);
assert.equal(crossIngredientCantonese.removedRows, 2);
assert.doesNotMatch(crossIngredientCantonese.advice, /注意：/);

const directFalseEnglish = sanitizeAdviceAttribution(
  "Blood sugar impact: Medium\nWatch out: egg --> concentrated starch；tofu --> high GI\nRight now: 3",
  attributionContext,
);
assert.equal(directFalseEnglish.removedRows, 2);
assert.doesNotMatch(directFalseEnglish.advice, /Watch out:/);

const directFalseTraditional = sanitizeAdviceAttribution(
  "血糖影響: 中\n注意：雞蛋 --> 澱粉集中；豆腐 --> 高升糖指數\n現在: 3",
  attributionContext,
);
assert.equal(directFalseTraditional.removedRows, 2);
assert.doesNotMatch(directFalseTraditional.advice, /注意：/);

const directFalseCantonese = sanitizeAdviceAttribution(
  "血糖影響: 中\n注意：雞蛋 --> 高碳水；豆腐 --> 血糖急升\n依家: 3",
  attributionContext,
);
assert.equal(directFalseCantonese.removedRows, 2);
assert.doesNotMatch(directFalseCantonese.advice, /注意：/);

const supportedDirectClaims = sanitizeAdviceAttribution(
  "Blood sugar impact: Medium\nWatch out: white rice --> concentrated starch；sweetened yogurt --> added sugar\nRight now: 3",
  attributionContext,
);
assert.equal(supportedDirectClaims.removedRows, 0);
assert.match(supportedDirectClaims.advice, /white rice --> concentrated starch/);
assert.match(supportedDirectClaims.advice, /sweetened yogurt --> added sugar/);

const aggregateOnCarb = [
  "Blood sugar impact: High",
  "Watch out: white rice --> total meal carbohydrate；egg --> protein source",
  "Right now: 2 + 5",
].join("\n");
const aggregateResult = sanitizeAdviceAttribution(aggregateOnCarb, attributionContext);
assert.equal(aggregateResult.removedRows, 1);
assert.doesNotMatch(aggregateResult.advice, /white rice -->/);
assert.match(aggregateResult.advice, /egg --> protein source/);

const allUnsafe = sanitizeAdviceAttribution(
  "Blood sugar impact: High\nWatch out: egg --> total meal starch\nRight now: 2 + 5",
  attributionContext,
);
assert.equal(allUnsafe.removedRows, 1);
assert.doesNotMatch(allUnsafe.advice, /Watch out:/);
const repairedHigh = buildStructuredAdvice(allUnsafe.advice, "en", "");
assert.equal(repairedHigh.impactValue, "high");
assert.equal(repairedHigh.positiveLine, null);
assert.equal(repairedHigh.rightNow.length, 2);

const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
const promptStart = routes.indexOf("const foodItemsInstruction");
const promptEnd = routes.indexOf("// Pre-check cache", promptStart);
assert.ok(promptStart >= 0 && promptEnd > promptStart, "advice prompt section should be present");
const prompt = routes.slice(promptStart, promptEnd);

assert.match(prompt, /Assess Blood sugar impact at MEAL LEVEL/);
assert.match(prompt, /Every Watch out row is INGREDIENT LEVEL/);
assert.match(prompt, /GI\/rate evidence separate from carbohydrate quantity and glycaemic load/);
assert.match(prompt, /food identity, species or variety, and preparation state distinct/);
assert.match(prompt, /texture and preparation descriptors as modifiers/);
assert.match(prompt, /If food identity, preparation, evidence, or portion is uncertain/);
assert.match(prompt, /Do not state an estimated carbohydrate amount, total carbohydrate burden, or glycaemic-load value without sufficient portion and composition information/);
assert.match(prompt, /Mixed-meal effects may be considered conservatively/);
assert.match(prompt, /select EXACTLY ONE action from 1, 3, or 5/);
assert.match(prompt, /select EXACTLY TWO actions/);
assert.match(prompt, /At least one selected High-impact action must be 2 or 4/);
assert.doesNotMatch(prompt, /\bglycemic\b/i);

assert.match(
  prompt,
  /\{"foodItems":\[\{"nameEn":"\.\.\.","nameZhHant":"\.\.\.","nameYue":"\.\.\."\}\]\}/,
);
assert.match(prompt, /Exclude sauces, condiments, spices, seasoning, herbs, and decorative garnishes/);
assert.match(prompt, /Do NOT output a Next time section/);

assert.match(routes, /const adviceCacheKey = `\$\{activeComboKey\}::advice-v2`/);
assert.match(routes, /getCachedAdvice\(adviceCacheKey, lang\)/);
assert.match(routes, /saveCachedAdvice\(foodName, adviceCacheKey, r\.locale/);
assert.match(routes, /comboKey: activeComboKey/);

console.log("food advice attribution tests passed");