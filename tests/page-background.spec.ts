import { test, expect } from "@playwright/test";

const canvas = "rgb(252, 251, 242)";

for (const width of [390, 1280]) {
  test(`normal pre-login surfaces share the canvas at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      (window as any).NativelyAppleSignInService = class {};
    });
    await page.route("**/api/auth/user", route => route.fulfill({
      contentType: "application/json", body: "null",
    }));
    await page.goto("/");
    const language = page.getByTestId("landing-lang-screen");
    await expect(language).toHaveCSS("background-color", canvas);
    for (const selector of ["html", "body", "#root"]) {
      await expect(page.locator(selector)).toHaveCSS("background-color", canvas);
    }
    await page.getByTestId("button-lang-en").click();
    await expect(page.getByTestId("landing-slides-screen")).toHaveCSS("background-color", canvas);
    await page.getByTestId("button-get-started").click();
    await expect(page.getByTestId("button-apple-signin")).toBeVisible();
    await expect(page.getByTestId("landing-auth-screen")).toHaveCSS("background-color", canvas);
    await page.getByTestId("button-continue-email").click();
    await expect(page.getByTestId("input-email")).toBeVisible();
    await expect(page.getByTestId("landing-auth-screen")).toHaveCSS("background-color", canvas);
    await page.getByTestId("tab-register").click();
    await expect(page.getByTestId("input-confirm-password")).toBeVisible();
    await expect(page.getByTestId("landing-auth-screen")).toHaveCSS("background-color", canvas);
    await page.getByTestId("tab-login").click();
    await page.getByTestId("button-forgot-password").click();
    await expect(page.getByTestId("landing-auth-screen")).toHaveCSS("background-color", canvas);
    await page.goto("/#reset_token=palette-test");
    await page.reload();
    await expect(page.getByTestId("password-reset-page")).toHaveCSS("background-color", canvas);
  });
}