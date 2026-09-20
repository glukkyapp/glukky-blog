import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const [card, page] = await Promise.all([
  readFile("client/src/components/PostMealCard.tsx", "utf8"),
  readFile("client/src/pages/hstix.tsx", "utf8"),
]);

assert.doesNotMatch(card, /function IntegerWheel/, "the integer wheel is removed");
assert.match(card, /const MIN_INTEGER = 2/, "integer selection keeps its lower bound");
assert.match(card, /const MAX_INTEGER = 20/, "integer selection keeps its upper bound");
assert.match(card, /data-testid="button-post-meal-int-minus"/, "minus control is reachable");
assert.match(card, /data-testid="button-post-meal-int-plus"/, "plus control is reachable");
assert.match(card, /value === null \? "–" : value/, "an unselected integer is never presented as a real reading");
assert.match(card, /intPart === null\) setIntPart\(DEFAULT_INTEGER\)/, "decimal-first input selects the displayed default integer in state");
assert.match(card, /const NOTE_PRESETS = \[[\s\S]*"glucose\.preset_after_medication"[\s\S]*"glucose\.preset_feeling_well"[\s\S]*"glucose\.preset_mild_dizziness"[\s\S]*"glucose\.preset_large_meal"[\s\S]*"glucose\.preset_walk"[\s\S]*"glucose\.preset_early"[\s\S]*\] as const/, "reference and existing presets are a text-key-only list");
assert.doesNotMatch(card, /hstix\.preset_/, "presets use the locale's glucose namespace");
assert.doesNotMatch(card, /NOTE_PRESET_FALLBACKS/, "integrated locale entries do not retain duplicated preset copy");
assert.match(card, /const preset = t\(key\)/, "preset chips resolve their text directly from i18n");
assert.match(card, /nextNote\.length <= 500/, "preset append preserves the note length cap");
assert.match(card, /noteContainsPreset\(note, preset\)/, "preset append preserves deduplication");
assert.match(card, /note: note\.trim\(\) \|\| null/, "editing an empty note explicitly clears the stored note");
assert.match(card, /queryKey: \["\/api\/snap\/daily-summary"\]/, "HStix saves invalidate the Daily summary");
assert.match(card, /disabled=\{!canConfirmKeypad \|\| submitting\}/, "save stays disabled until the displayed reading is complete");
assert.match(page, /bg-\[#FCFBF2\]/, "the HStix surface uses the reference cream palette");
assert.match(page, /correctionExpiresAt/, "correction expiry remains wired");
assert.match(page, /mealSnapId=\{validMealSnapId\}/, "meal linking remains wired");
assert.match(page, /reading\.glucoseMmol\.toFixed\(1\)/, "history keeps raw glucose values");
assert.match(page, /editingReading \? new Date\(editingReading\.recordedAt\) : new Date\(\)/, "edit header uses the reading timestamp while new entries use the current time");

console.log("21 HStix reference UI contracts passed");