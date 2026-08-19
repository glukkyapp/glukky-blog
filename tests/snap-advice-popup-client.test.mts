/**
 * Client-side snap-advice popup logic tests (#802): swipe rule and
 * TTS guards in a speech-less environment (Node has no Web Speech API).
 *
 * Run with: npx tsx tests/snap-advice-popup-client.test.mts
 */

import { strict as assert } from "assert";
import { isLeftSwipe, SWIPE_MIN_PX, SWIPE_MAX_MS } from "../client/src/lib/swipe";
import { isSpeechSupported, startSpeech, cancelSpeech, splitForTTS } from "../client/src/lib/tts";

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

console.log("Swipe rule: left swipe ≥40px within 600ms advances");
{
  check("constants match spec", SWIPE_MIN_PX === 40 && SWIPE_MAX_MS === 600);
  check("-40px in 600ms advances", isLeftSwipe(-40, 600) === true);
  check("-100px in 100ms advances", isLeftSwipe(-100, 100) === true);
  check("-39px is too short", isLeftSwipe(-39, 100) === false);
  check("601ms is too slow", isLeftSwipe(-100, 601) === false);
  check("right swipe never advances", isLeftSwipe(80, 100) === false);
  check("negative elapsed rejected", isLeftSwipe(-100, -5) === false);
}

console.log("\nTTS guards without Web Speech support");
{
  check("speech reported unsupported in Node", isSpeechSupported() === false);
  let threw = false;
  let handle: unknown = undefined;
  try {
    handle = startSpeech("hello world", () => {});
  } catch {
    threw = true;
  }
  check("startSpeech does not throw", threw === false);
  check("startSpeech returns null (no-op)", handle === null);
  let threw2 = false;
  try {
    cancelSpeech();
  } catch {
    threw2 = true;
  }
  check("cancelSpeech does not throw", threw2 === false);
}

console.log("\nsplitForTTS chunking");
{
  check("short text single chunk", splitForTTS("hi").length === 1);
  const long = "這是一句話。".repeat(60);
  const chunks = splitForTTS(long);
  check("long text split into chunks", chunks.length > 1);
  check("chunks reassemble content", chunks.join("").replace(/\s/g, "").length === long.length);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
