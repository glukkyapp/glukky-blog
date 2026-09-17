import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const exportDir = path.resolve(sourceDir, "..");
const rawDir = path.join(exportDir, "raw");
const rawWebm = path.join(rawDir, "glukky-clip2-zh-hant-raw.webm");
const finalWebm = path.join(exportDir, "glukky-clip2-zh-hant.webm");
const finalMp4 = path.join(exportDir, "glukky-clip2-zh-hant.mp4");

mkdirSync(rawDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 720, height: 1280 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: rawDir,
    size: { width: 720, height: 1280 },
  },
});
const page = await context.newPage();

await page.goto(pathToFileURL(path.join(sourceDir, "index.html")).href);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

const video = page.video();
await page.evaluate(() => window.startClip());
await page.waitForTimeout(10_900);
await page.close();
await video.saveAs(rawWebm);
await context.close();
await browser.close();

for (const name of readdirSync(rawDir)) {
  if (name.endsWith(".webm") && name !== path.basename(rawWebm)) {
    unlinkSync(path.join(rawDir, name));
  }
}

execFileSync("ffmpeg", [
  "-y",
  "-i", rawWebm,
  "-vf", "scale=720:1280:flags=lanczos,format=yuv420p",
  "-r", "30",
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "18",
  "-movflags", "+faststart",
  "-an",
  finalMp4,
], { stdio: "inherit" });

execFileSync("ffmpeg", [
  "-y",
  "-i", rawWebm,
  "-vf", "scale=720:1280:flags=lanczos",
  "-r", "30",
  "-c:v", "libvpx-vp9",
  "-crf", "30",
  "-b:v", "0",
  "-an",
  finalWebm,
], { stdio: "inherit" });

console.log(`Created ${finalMp4}`);
console.log(`Created ${finalWebm}`);