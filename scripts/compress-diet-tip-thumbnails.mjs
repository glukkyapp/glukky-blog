// One-off reproducible compression for the 11 diet-tip thumbnails on
// the Health Info page. Originals are stored at full camera resolution
// (~13 MB each, ~145 MB total) but render as ~100 px circular thumbs
// in the UI (client/src/pages/health-info.tsx). This script resizes
// them to a small max dimension and re-encodes as palette PNGs to
// land each file under 200 KB and the total well under 2 MB.
//
// Tooling: `sharp` (devDependency). Usage:
//   node scripts/compress-diet-tip-thumbnails.mjs

import sharp from "sharp";
import { readdirSync, statSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const DIR = "attached_assets";
const MAX_DIM = 384;
const PALETTE_COLORS = 192;
const QUALITY = 85;
const TARGET_PER_FILE = 200 * 1024;
const TARGET_TOTAL = 2 * 1000 * 1000;

const files = readdirSync(DIR)
  .filter((n) => /^cropped_circle_image.*\.png$/i.test(n))
  .sort();

if (files.length !== 11) {
  console.error(`Expected 11 thumbnails, found ${files.length}`);
  process.exit(1);
}

let total = 0;
let anyOver = false;
console.log(`Processing ${files.length} thumbnails...\n`);

for (const name of files) {
  const path = join(DIR, name);
  const before = statSync(path).size;

  const buf = await sharp(path)
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .png({
      palette: true,
      colors: PALETTE_COLORS,
      quality: QUALITY,
      effort: 10,
      compressionLevel: 9,
    })
    .toBuffer();

  const tmp = `${path}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, path);

  const after = statSync(path).size;
  total += after;
  const over = after > TARGET_PER_FILE;
  if (over) anyOver = true;
  console.log(
    `${name.padEnd(55)} ${(before / 1024).toFixed(0).padStart(6)} KB -> ${(after / 1024).toFixed(0).padStart(4)} KB${over ? "  [OVER 200 KB]" : ""}`,
  );
}

console.log(`\nTotal: ${total} bytes (${(total / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Per-file <= 200 KB: ${anyOver ? "FAIL" : "OK"}`);
console.log(`Total <  2,000,000 bytes: ${total < TARGET_TOTAL ? "OK" : "FAIL"}`);

if (anyOver || total >= TARGET_TOTAL) process.exit(1);
