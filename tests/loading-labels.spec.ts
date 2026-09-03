import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("loading labels", () => {
  test("shows the localized cold-launch label and keeps it in the viewport", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("glukky_has_session");
      localStorage.setItem("glukky_preferred_lang", "zh-Hant");
    });

    await page.goto("/");

    const label = page.getByTestId("cube-loading-label");
    await expect(label).toBeVisible();
    await expect(label).toHaveText("載入中...");
    await expect(page.getByTestId("boot-loading-label")).toHaveCount(0);

    const bounds = await label.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  });

  test("shows the light localized label on the delayed returning-user overlay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      localStorage.setItem("glukky_has_session", "1");
      localStorage.setItem("glukky_preferred_lang", "yue");
    });

    let releaseAuthRequest: (() => void) | undefined;
    await page.route("**/api/auth/user", async (route) => {
      await new Promise<void>((resolve) => {
        releaseAuthRequest = resolve;
      });
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
    });
    await page.goto("/");

    const label = page.getByTestId("loading-screen-label");
    await expect(label).toBeVisible({ timeout: 6000 });
    await expect(label).toHaveText("載入中...");
    await expect(label).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(
      page.locator(
        '[data-testid="cube-loading-label"]:visible, ' +
        '[data-testid="loading-screen-label"]:visible, ' +
        '[data-testid="boot-loading-label"]:visible',
      ),
    ).toHaveCount(1);

    const bounds = await label.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    expect(releaseAuthRequest).toBeDefined();
    releaseAuthRequest!();
    await expect(label).toHaveCount(0);
  });

  test("keeps a localized static caption available when JavaScript is disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByTestId("boot-loading-label")).toBeVisible();
    await expect(page.getByTestId("boot-loading-label")).toHaveText("Loading");
    await context.close();
  });
});