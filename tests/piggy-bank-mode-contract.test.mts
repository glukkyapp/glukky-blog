import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("client/src/components/piggy-bank-card.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");

assert.match(card, /POST", "\/api\/piggybank\/mode"/);
assert.match(card, /selectedNow === true/);
assert.match(card, /result\.mode === requestedMode/);
assert.match(card, /track\(requestedMode === "garden" \? "garden_choice" : "photo_choice"\)/);
assert.match(card, /role="grid"/);
assert.match(card, /PHOTO_SLOT_COUNT = 12/);
assert.match(card, /unlockedPhotoCount/);
assert.match(card, /assetUrl: null/);
assert.match(card, /\/api\/piggybank\/force-mode/);
assert.match(card, /\/api\/piggybank\/start-new-cycle/);
assert.match(card, /data\.canForceMode/);
assert.doesNotMatch(card, /reward_auto_assigned/);
assert.match(app, /modeAutoAssigned: boolean/);

for (const locale of ["en", "zh-Hant", "yue"]) {
  const strings = JSON.parse(readFileSync(`client/src/locales/${locale}.json`, "utf8")) as {
    roadmap: Record<string, string>;
  };
  for (const key of [
    "choose_garden",
    "choose_photo",
    "photo_mode_title",
    "photo_slot_pending",
    "start_next_cycle",
    "force_mode_title",
  ]) {
    assert.equal(typeof strings.roadmap[key], "string", `${locale} is missing roadmap.${key}`);
  }
}

const traditional = JSON.parse(readFileSync("client/src/locales/zh-Hant.json", "utf8")) as {
  roadmap: Record<string, string>;
};
assert.equal(traditional.roadmap.choose_garden, "我想建造我的海港花園");
assert.equal(traditional.roadmap.choose_photo, "我想看香港舊照片");

console.log("Piggy-bank mode frontend contract passed");