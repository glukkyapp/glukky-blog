/**
 * Server-side structured snap-advice contract tests (#802).
 *
 * Run with: npx tsx tests/snap-advice-structured.test.mts
 */

import { strict as assert } from "assert";
import {
  sanitizeEmoji,
  normalizeSelectors,
  mapRightNow,
  selectNextTime,
  parseImpact,
  parseWatchOutRows,
  buildStructuredAdvice,
  RIGHT_NOW_ACTIONS,
  POSITIVE_LINE,
  NEXT_TIME_VEGETABLES,
  NEXT_TIME_CARB_SWAPS,
  NEXT_TIME_FIXED_TIPS,
  nextTimeLabel,
} from "../server/snap-advice-structured";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} ${detail}`);
    failed++;
  }
}

console.log("Emoji sanitizer");
{
  check("strips warning/zap/memo emoji", sanitizeEmoji("⚠️ 注意：奶茶 ⚡📝🩸") === "注意：奶茶");
  check("keeps plain Chinese and English", sanitizeEmoji("血糖影響: 高 High") === "血糖影響: 高 High");
  check("strips checkmark emoji", !sanitizeEmoji("done ✅✔️").includes("✅"));
}

console.log("\nImpact parsing");
{
  check("en high", parseImpact("Blood sugar impact: High") === "high");
  check("zh 中", parseImpact("血糖影響: 中") === "medium");
  check("zh 中等 legacy", parseImpact("血糖影響: 中等") === "medium");
  check("full-width colon", parseImpact("血糖影響：低") === "low");
  check("unknown returns null", parseImpact("hello world") === null);
}

console.log("\nSelector validation");
{
  check("low: keeps a valid single pick", normalizeSelectors("low", [3]).join() === "3");
  check("low: rejects 2 (high-only), falls back", normalizeSelectors("low", [2]).join() === "1");
  check("medium: rejects 4, picks valid alternative", normalizeSelectors("medium", [4, 5]).join() === "5");
  check("low: exactly one even when Claude sends two", normalizeSelectors("low", [1, 3]).length === 1);
  check("low: empty falls back to 1", normalizeSelectors("low", []).join() === "1");
  const high = normalizeSelectors("high", [2, 4]);
  check("high: keeps 2,4", high.join() === "2,4");
  const highBad = normalizeSelectors("high", [1, 3]);
  check("high: forces at least one of 2/4", highBad.some((s) => s === 2 || s === 4));
  check("high: always exactly two", normalizeSelectors("high", [4]).length === 2);
  check("high: invalid numbers dropped", normalizeSelectors("high", [9, 4, 1]).join() === "4,1");
  check("unknown impact treated as one action, no 2/4", normalizeSelectors(null, [2, 4]).join() === "1");
}

console.log("\nRight-now mapping per locale");
{
  check("en text", mapRightNow("en", "low", [3])[0] === RIGHT_NOW_ACTIONS.en[3]);
  check("zh-Hant text", mapRightNow("zh-Hant", "low", [3])[0] === RIGHT_NOW_ACTIONS["zh-Hant"][3]);
  check("yue text", mapRightNow("yue", "low", [3])[0] === RIGHT_NOW_ACTIONS.yue[3]);
  check("no selector numbers leak", mapRightNow("en", "high", [2, 4]).every((t) => !/^\d/.test(t)));
}

console.log("\nApproved Chinese action copy");
{
  const zhHantExpected = [
    "先吃菜和肉，最後才吃飯或麵",
    "飯後慢慢喝一杯水",
    "吃慢一點",
    "飯後步行10分鐘",
    "這餐可減少飯或麵的分量",
  ];
  const yueExpected = [
    "先食菜同肉，最後先食飯或麵",
    "食完飯後慢慢飲一杯水",
    "食慢啲",
    "飯後行10分鐘",
    "呢餐可以減少飯或麵嘅份量",
  ];
  check(
    "zh-Hant uses all approved strings exactly",
    JSON.stringify(Object.values(RIGHT_NOW_ACTIONS["zh-Hant"])) === JSON.stringify(zhHantExpected),
  );
  check(
    "yue uses all approved strings exactly",
    JSON.stringify(Object.values(RIGHT_NOW_ACTIONS.yue)) === JSON.stringify(yueExpected),
  );
}

console.log("\nNext-time selection");
{
  // rand sequence: first < 1/3 → vegetable branch
  const veg = selectNextTime("zh-Hant", "白飯 叉燒", () => 0.1);
  check("vegetable branch returns a phrase", veg.length > 0);
  // Vegetable exclusion: meal containing 菜心 never suggests 菜心
  for (let i = 0; i < 30; i++) {
    const r = selectNextTime("zh-Hant", "菜心炒牛肉", Math.random);
    if (r.includes("菜心")) {
      check("excludes vegetables already in the meal", false, r);
      break;
    }
    if (i === 29) check("excludes vegetables already in the meal", true);
  }
  const swap = selectNextTime("en", "rice", () => 0.5);
  check("carb-swap branch mentions an approved swap", NEXT_TIME_CARB_SWAPS.en.some((s) => swap.includes(s)));
  const tip = selectNextTime("yue", "rice", () => 0.9);
  check("fixed-tip branch returns approved tip", NEXT_TIME_FIXED_TIPS.yue.includes(tip));
  // All vegetables in meal → falls back to fixed tips
  const allVeg = NEXT_TIME_VEGETABLES.map((v) => v.aliases[0]).join(" ");
  const fallback = selectNextTime("en", allVeg, () => 0.1);
  check("all-vegetables-present falls back to fixed tip", NEXT_TIME_FIXED_TIPS.en.includes(fallback));
  check("13 vegetables in pool", NEXT_TIME_VEGETABLES.length === 13);
  check("6 fixed tips per locale", NEXT_TIME_FIXED_TIPS.en.length === 6 && NEXT_TIME_FIXED_TIPS.yue.length === 6);
  check("unknown locale falls back to en", NEXT_TIME_FIXED_TIPS.en.includes(selectNextTime("fr", "x", () => 0.9)));
}

console.log("\nWatch-out row parsing");
{
  const rows = parseWatchOutRows("milk tea --> condensed milk sugar；white rice -> fast spike；noodles → refined carbs");
  check("parses three rows", rows.length === 3);
  check("normalizes --> arrow", rows[0].food === "milk tea" && rows[0].risk === "condensed milk sugar");
  check("normalizes -> arrow", rows[1].food === "white rice");
  check("normalizes → arrow", rows[2].food === "noodles");
  check("no raw arrows in output", rows.every((r) => !`${r.food}${r.risk}`.includes("->")));
  const malformed = parseWatchOutRows("very sugary drink");
  check("malformed (no arrow) falls back to food-less risk", malformed.length === 1 && malformed[0].food === null);
  const four = parseWatchOutRows("a-->1；b-->2；c-->3；d-->4");
  check("clamps to 3 rows", four.length === 3);
}

console.log("\nbuildStructuredAdvice — new contract");
{
  const raw = "好嘢！\n\n血糖影響: 高\n注意：奶茶 --> 煉奶糖分；白飯 --> 血糖快速上升\n現在：2,4";
  const s = buildStructuredAdvice(raw, "yue", "test-next-time");
  check("impact high", s.impactValue === "high");
  check("impact display 高", s.impactDisplay === "高");
  check("opener captured", s.opener === "好嘢！");
  check("two watch-out rows", s.watchOut.length === 2);
  check("no positive line when watch-out present", s.positiveLine === null);
  check("two right-now phrases (high)", s.rightNow.length === 2);
  check("selectors mapped to yue text", s.rightNow.includes(RIGHT_NOW_ACTIONS.yue[2]) && s.rightNow.includes(RIGHT_NOW_ACTIONS.yue[4]));
  check("nextTime passed through", s.nextTime === "test-next-time");
  check("no digits-only right-now leaks", s.rightNow.every((t) => t.length > 2));
}

console.log("\nbuildStructuredAdvice — healthy meal (no watch-out)");
{
  const raw = "Blood sugar impact: Low\nRight now: 1";
  const s = buildStructuredAdvice(raw, "en", "next");
  check("impact low", s.impactValue === "low");
  check("no watch-out rows", s.watchOut.length === 0);
  check("positive line shown", s.positiveLine === POSITIVE_LINE.en);
  check("one right-now action", s.rightNow.length === 1 && s.rightNow[0] === RIGHT_NOW_ACTIONS.en[1]);
}

console.log("\nbuildStructuredAdvice — food-specific action-1 phrase via Food order line");
{
  // en: Food order line substitutes into the action-1 slot
  const enPhrase = buildStructuredAdvice(
    "Blood sugar impact: Medium\nWatch out: white rice --> fast glucose spike\nRight now: 1\nFood order: cabbage first, plain rice later",
    "en",
    "next",
  );
  check(
    "en: food-specific phrase replaces static action-1 text",
    enPhrase.rightNow.length === 1 && enPhrase.rightNow[0] === "cabbage first, plain rice later",
  );

  // yue: Food order content in yue, Right now still numeric
  const yuePhrase = buildStructuredAdvice(
    "血糖影響: 中\n依家：1\nFood order: 椰菜先，白飯最後",
    "yue",
    "next",
  );
  check(
    "yue: food-specific phrase replaces static action-1 text",
    yuePhrase.rightNow.length === 1 && yuePhrase.rightNow[0] === "椰菜先，白飯最後",
  );

  // zh-Hant locale
  const zhPhrase = buildStructuredAdvice(
    "血糖影響: 低\n現在：1\nFood order: 椰菜先食，白飯最後先食",
    "zh-Hant",
    "next",
  );
  check(
    "zh-Hant: food-specific phrase replaces static action-1 text",
    zhPhrase.rightNow.length === 1 && zhPhrase.rightNow[0] === "椰菜先食，白飯最後先食",
  );

  // High impact + action 1 + action 4: phrase replaces only the action-1 slot; action 4 preserved
  const highWithPhrase = buildStructuredAdvice(
    "Blood sugar impact: High\nWatch out: white rice --> fast spike\nRight now: 4,1\nFood order: cabbage first, plain rice later",
    "en",
    "next",
  );
  check(
    "high impact: food-specific phrase replaces action-1 slot, action-4 preserved",
    highWithPhrase.rightNow.length === 2 &&
      highWithPhrase.rightNow.includes("cabbage first, plain rice later") &&
      highWithPhrase.rightNow.includes(RIGHT_NOW_ACTIONS.en[4]),
  );

  // Food phrase containing digits (e.g. "2 eggs first, rice later") passes through correctly
  const phraseWithDigit = buildStructuredAdvice(
    "Blood sugar impact: Low\nRight now: 1\nFood order: 2 eggs first, rice later",
    "en",
    "next",
  );
  check(
    "food phrase with digits passes through correctly",
    phraseWithDigit.rightNow.length === 1 && phraseWithDigit.rightNow[0] === "2 eggs first, rice later",
  );

  // No Food order line → static copy used (meals without qualifying carb+veg/protein)
  const noPhrase = buildStructuredAdvice("Blood sugar impact: Low\nRight now: 1", "en", "next");
  check(
    "no Food order line → static copy unchanged",
    noPhrase.rightNow.length === 1 && noPhrase.rightNow[0] === RIGHT_NOW_ACTIONS.en[1],
  );

  // Food order line present but action 1 not selected → phrase ignored
  const phraseIgnored = buildStructuredAdvice(
    "Blood sugar impact: Low\nRight now: 3\nFood order: cabbage first, plain rice later",
    "en",
    "next",
  );
  check(
    "Food order line ignored when action 1 not selected",
    phraseIgnored.rightNow.length === 1 && phraseIgnored.rightNow[0] === RIGHT_NOW_ACTIONS.en[3],
  );

  // Food-specific phrase must not contain emoji
  check(
    "food-specific phrase has no emoji",
    enPhrase.rightNow.every((t) => !/\p{Extended_Pictographic}/u.test(t)),
  );
}

console.log("\nbuildStructuredAdvice — invalid selectors normalized");
{
  const s = buildStructuredAdvice("Blood sugar impact: Low\nRight now: 2", "en", "next");
  check("selector 2 rejected for low impact", s.rightNow[0] === RIGHT_NOW_ACTIONS.en[1]);
  const s2 = buildStructuredAdvice("Blood sugar impact: High\nRight now: 3", "en", "next");
  check("high gets two actions incl 2 or 4", s2.rightNow.length === 2);
}

console.log("\nbuildStructuredAdvice — legacy cached advice (emoji format)");
{
  const legacy = "唔錯呀！\n\n血糖影響: 中\n⚠️ 注意：呢碗麵好多精製碳水。\n⚡ 依家：食慢啲，先食菜。";
  const s = buildStructuredAdvice(legacy, "yue", "next");
  check("impact medium", s.impactValue === "medium");
  check("legacy watch-out becomes food-less row", s.watchOut.length === 1 && s.watchOut[0].food === null);
  check(
    "legacy right-now action uses fixed yue copy",
    s.rightNow.length === 1 && s.rightNow[0] === RIGHT_NOW_ACTIONS.yue[3],
  );
  const zhLegacy = buildStructuredAdvice(
    "血糖影響: 中\n現在：先吃蔬菜和蛋白質，最後才吃碳水化合物。",
    "zh-Hant",
    "next",
  );
  check(
    "legacy zh-Hant action uses fixed approved copy",
    zhLegacy.rightNow.length === 1 && zhLegacy.rightNow[0] === RIGHT_NOW_ACTIONS["zh-Hant"][1],
  );
  const englishLegacyInYue = buildStructuredAdvice(
    "Blood sugar impact: High\nRight now: Go for a 10-minute walk after the meal.",
    "yue",
    "next",
  );
  check(
    "legacy English action never leaks into yue",
    englishLegacyInYue.rightNow.includes(RIGHT_NOW_ACTIONS.yue[4]) &&
      englishLegacyInYue.rightNow.every((action) => !/[a-z]/i.test(action)),
  );
  const all = JSON.stringify(s);
  check("no emoji anywhere in payload", !/[\u26A0\u26A1\uFE0F]|⚠|⚡|📝/u.test(all));
}

console.log("\nbuildStructuredAdvice — malformed/unknown impact");
{
  const s = buildStructuredAdvice("total nonsense from claude", "en", "next");
  check("impact null (never shows high image for unknown)", s.impactValue === null);
  check("impactDisplay empty for unknown", s.impactDisplay === "");
  check("safe fallback right-now provided", s.rightNow.length === 1);
}

console.log("\nNext-time label");
{
  check("en label", nextTimeLabel("en") === "Next time:");
  check("zh label", nextTimeLabel("zh-Hant") === "下次可試：");
  check("no emoji in label", !nextTimeLabel("yue").includes("📝"));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
