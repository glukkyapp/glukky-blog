import { chromium } from "playwright";

const URL =
  "http://localhost:23636/__mockup/preview/paywall/PaywallScreen";
const OUT = "attached_assets/screenshots/paywall_en.png";

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const ctx = await browser.newContext({
  viewport: { width: 400, height: 780 },
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="paywall-modal"]', { timeout: 10000 });
await page.waitForTimeout(800);
await page.screenshot({ path: OUT, fullPage: false, omitBackground: false });
await browser.close();
console.log("saved:", OUT);
