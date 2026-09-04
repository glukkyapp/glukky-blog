import { expect, test } from "@playwright/test";

const NEW_MARK_PATH = "generated-image_(5)_copy_1788506043742.png";

async function expectNewBrandMark(page: import("@playwright/test").Page) {
  const mark = page.getByAltText("Glukky").first();
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("src", new RegExp(NEW_MARK_PATH.replace(/[()]/g, "\\$&")));
  const bounds = await mark.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBe(bounds!.height);
  expect(bounds!.width).toBeGreaterThanOrEqual(64);
  expect(bounds!.width).toBeLessThanOrEqual(112);
}

test.describe("pre-login branding", () => {
  test("uses the dumpling mark through language, onboarding, and email login", async ({
    page,
  }) => {
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        imageRequests.push(decodeURIComponent(new URL(request.url()).pathname));
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem("glukky_has_session", "1");
      localStorage.removeItem("glukky_preferred_lang");
    });
    await page.goto("/");

    await expect(page.getByTestId("landing-lang-screen")).toBeVisible();
    await expectNewBrandMark(page);

    await page.getByTestId("button-lang-en").click();
    await expect(page.getByTestId("landing-slides-screen")).toBeVisible();
    await expectNewBrandMark(page);

    await page.getByTestId("button-slide-login").click();
    await expect(page.getByTestId("landing-auth-screen")).toBeVisible();
    await expectNewBrandMark(page);
    await expect(page.getByTestId("text-description")).toHaveCount(0);
    expect(imageRequests.some((path) => path.includes(NEW_MARK_PATH))).toBe(true);
    expect(
      imageRequests.some((path) =>
        path.includes("high-resolution-color-logo_1776593969022.png"),
      ),
    ).toBe(false);
  });

  test("uses the dumpling mark without a slogan on Apple sign-in", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("glukky_has_session", "1");
      localStorage.setItem("glukky_preferred_lang", "zh-Hant");
      class MockAppleSignInService {
        signin() {}
      }
      Object.defineProperty(window, "NativelyAppleSignInService", {
        value: MockAppleSignInService,
        configurable: true,
      });
    });
    await page.goto("/");

    await expect(page.getByTestId("button-apple-signin")).toBeVisible();
    await expectNewBrandMark(page);
    await expect(page.getByTestId("text-description")).toHaveCount(0);
  });
});