import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const card = readFileSync("client/src/components/piggy-bank-card.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");

assert.match(card, /POST", "\/api\/piggybank\/mode"/);
assert.match(card, /selectedNow === true/);
assert.match(card, /result\.mode === requestedMode/);
assert.match(card, /track\(requestedMode === "garden" \? "garden_choice" : "photo_choice"\)/);
assert.match(card, /data-testid="photo-display"/);
assert.match(card, /data-testid="photo-expanded-dialog"/);
assert.match(card, /data-testid="photo-expanded-image"/);
assert.match(card, /object-contain/);
assert.match(card, /photoDecade = photoSet\.name\.match/);
assert.match(card, /PHOTO_SLOT_COUNT = 12/);
assert.match(card, /unlockedPhotoCount/);
assert.match(card, /new window\.Image\(\)/);
assert.match(card, /photo-light-transition/);
assert.match(card, /photo-copyright-disclaimer/);
assert.match(card, /window\.sessionStorage\.getItem/);
assert.match(card, /window\.sessionStorage\.setItem/);
assert.doesNotMatch(card, /role="grid"/);
assert.match(card, /\/api\/piggybank\/force-mode/);
assert.match(card, /\/api\/piggybank\/start-new-cycle/);
assert.match(card, /data\.canForceMode/);
assert.doesNotMatch(card, /reward_auto_assigned/);
assert.match(app, /modeAutoAssigned: boolean/);
assert.match(app, /if \(piggy\.mode === null\) return/);
assert.match(app, /\[piggy\?\.coins, piggy\?\.mode\]/);
assert.match(app, /mode=\{piggy\?\.mode \?\? null\}/);

const activePhotoFiles: string[] = [];
for (const setNumber of [1, 2, 3]) {
  const directory = `client/public/reward-photos/1970s-${setNumber}`;
  const files = readdirSync(directory).filter(file => file.endsWith(".jpg")).sort();
  const nextSetBoundary = setNumber < 3 ? `\\n  ${setNumber}:` : "\\n};";
  const manifestBlock = card.match(
    new RegExp(`id: "1970s-${setNumber}"[\\s\\S]*?(?=${nextSetBoundary})`),
  )?.[0];
  assert.ok(manifestBlock, `1970s ${setNumber} manifest block is missing`);
  assert.equal(files.length, 12, `1970s ${setNumber} must contain exactly 12 photos`);
  for (const file of files) {
    assert.ok(existsSync(`${directory}/${file}`));
    assert.ok(manifestBlock.includes(`"${file}"`), `${file} is missing from the photo manifest`);
  }
  activePhotoFiles.push(...files.map(file => file.replace(/_[0-9]{13}\.jpg$/, "")));
}
assert.equal(new Set(activePhotoFiles).size, 36, "active photo sets must not repeat archival references");
assert.equal(
  readdirSync("client/public/reward-photos/reserve").filter(file => file.endsWith(".jpg")).length,
  4,
  "four supplied photos must remain in reserve",
);

for (const locale of ["en", "zh-Hant", "yue"]) {
  const strings = JSON.parse(readFileSync(`client/src/locales/${locale}.json`, "utf8")) as {
    roadmap: Record<string, string>;
  };
  for (const key of [
    "choose_garden",
    "choose_photo",
    "photo_mode_title",
    "photo_placeholder_title",
    "photo_dialog_title",
    "photo_expand_aria",
    "photo_copyright_disclaimer",
    "start_next_cycle",
    "force_mode_title",
  ]) {
    assert.equal(typeof strings.roadmap[key], "string", `${locale} is missing roadmap.${key}`);
    assert.ok(strings.roadmap[key].length > 0, `${locale} has an empty roadmap.${key}`);
  }
  for (const deadKey of [
    "choose_mode_title",
    "photo_unlocked_count",
    "photo_slot_pending",
    "photo_slot_available",
    "photo_slot_locked",
    "photo_slot_available_short",
    "photo_asset_pending",
    "photo_locked",
  ]) {
    assert.equal(strings.roadmap[deadKey], undefined, `${locale} still defines dead roadmap.${deadKey}`);
  }

  const renderedPhotoCopy = Object.entries(strings.roadmap)
    .filter(([key]) => key.startsWith("photo_"))
    .map(([, value]) => value)
    .join("\n");
  if (locale === "en") {
    assert.doesNotMatch(renderedPhotoCopy, /\bcoins?\b/i, "English photo copy must use points");
  } else {
    assert.doesNotMatch(renderedPhotoCopy, /硬幣|個點/, `${locale} photo copy must use 點 without a classifier`);
  }
}

const traditional = JSON.parse(readFileSync("client/src/locales/zh-Hant.json", "utf8")) as {
  roadmap: Record<string, string>;
};
assert.equal(traditional.roadmap.choose_garden, "我想建造我的海港花園");
assert.equal(traditional.roadmap.choose_photo, "我想看香港舊照片");
assert.equal(traditional.roadmap.photo_mode_title, "香港舊照片（{{decade}}年代）");
assert.equal(traditional.roadmap.cycle_complete, "這系列的香港照片已展示完成。");
assert.equal(
  traditional.roadmap.photo_copyright_disclaimer,
  "歷史照片由地政總署提供，經香港特別行政區政府「資料一線通」（DATA.GOV.HK）發布。有關圖片版權歸香港特別行政區政府所有。",
);

const english = JSON.parse(readFileSync("client/src/locales/en.json", "utf8")) as {
  roadmap: Record<string, string>;
  popup: Record<string, string>;
};
assert.equal(
  english.roadmap.photo_copyright_disclaimer,
  "Historical photographs courtesy of the Lands Department, provided via DATA.GOV.HK by the Government of the Hong Kong Special Administrative Region. Copyright in these images remains with the Government of the HKSAR.",
);
assert.equal(english.popup.photo_collection_grew, "Your Old Hong Kong photo collection grew");

console.log("Piggy-bank mode frontend contract passed");