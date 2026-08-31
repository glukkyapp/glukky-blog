import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-report-tab@glukky.test";
const TEST_PASS = "TestSpec123";

async function setupUser(context: BrowserContext, page: Page) {
  const api = context.request;
  let login = await api.post(`${BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (login.status() === 401) {
    const registration = await api.post(`${BASE}/api/auth/register`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(registration.status()).toBe(200);
    login = registration;
  }
  expect(login.status()).toBe(200);

  expect((await api.post(`${BASE}/api/dev/reset-account`)).status()).toBe(200);
  expect((await api.post(`${BASE}/api/profile`, {
    data: {
    },
  })).status()).toBe(200);
  expect((await api.patch(`${BASE}/api/profile/intro-seen`)).status()).toBe(200);

  await page.addInitScript(() => {
    localStorage.setItem("glukky_has_session", "1");
    localStorage.setItem("piggy_intro_skipped", "1");
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Report tab", () => {
  test.beforeEach(async ({ context, page }) => {
    await setupUser(context, page);
  });

  test("defaults to Daily, handles no yesterday data, and opens Last 2 months", async ({ page }) => {
    await page.goto("/report");

    await expect(page).toHaveURL(/\/report$/);
    await expect(page.getByTestId("report-tab-daily")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("report-panel-daily")).toBeVisible();
    await expect(page.getByText("昨日未見飲食記錄。", { exact: true })).toBeVisible();
    await expect(page.getByText("定時進食有助穩定全日血糖。", { exact: true })).toBeVisible();
    await expect(page.getByTestId("strip-meal-timeline")).toHaveCount(0);
    await expect(page.getByTestId("button-daily-view-meal")).toHaveCount(0);
    await expect(page.getByTestId("card-two-month-report")).toHaveCount(0);
    await expect(page.getByTestId("nav-tab-report")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("report-tab-two-month").click();

    await expect(page).toHaveURL(/\/report\?view=two-month$/);
    await expect(page.getByTestId("report-tab-two-month")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("report-panel-two-month")).toBeVisible();
    await expect(page.getByTestId("card-two-month-report")).toBeVisible();
  });

  test("emphasizes all three two-month report dimensions", async ({ page }) => {
    await page.route("**/api/snap/two-month-summary", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        window: {
          months: ["2026-06", "2026-07"],
          startDate: "2026-06-01",
          endDate: "2026-07-31",
        },
        totalMeals: 60,
        cards: [
          {
            cardType: "mealtime",
            state: "named",
            leadingBucket: "breakfast",
            runnerUpBucket: "lunch",
            leadingRate: 0.8,
            runnerUpRate: 0.2,
            zScore: 2.1,
          },
          {
            cardType: "weekday",
            state: "named",
            leadingBucket: "monday",
            runnerUpBucket: "tuesday",
            leadingRate: 0.8,
            runnerUpRate: 0.2,
            zScore: 2.1,
          },
          {
            cardType: "weekday-weekend",
            state: "named",
            leadingBucket: "weekday",
            runnerUpBucket: "weekend",
            leadingRate: 0.8,
            runnerUpRate: 0.2,
            zScore: 2.1,
          },
        ],
      }),
    }));

    await page.goto("/report?view=two-month");

    const dimensions = [
      ["mealtime", "Mealtime"],
      ["weekday", "Day of week"],
      ["weekday-weekend", "Weekday and weekend"],
    ] as const;
    for (const [cardType, label] of dimensions) {
      const dimension = page.getByTestId(`two-month-dimension-${cardType}`);
      await expect(dimension).toHaveText(label);
      await expect(dimension).toHaveClass(/font-bold/);
      await expect(dimension).toHaveClass(/text-primary/);
    }
  });

  test("keeps Report ownership only for food history entered from Report", async ({ page }) => {
    await page.goto("/food-log?from=report");
    await expect(page.getByTestId("nav-tab-report")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("food-log-back").click();
    await expect(page).toHaveURL(/\/report$/);

    await page.goto("/food-log?snap=missing");
    await expect(page.getByTestId("nav-tab-report")).not.toHaveAttribute("aria-current", "page");
  });

  test("Aa persists successful changes and rolls back failed changes", async ({ context, page }) => {
    await page.goto("/report");
    const toggle = page.getByTestId("button-main-font-toggle");
    await expect(toggle).toBeVisible();

    const original = await toggle.getAttribute("data-font-size");
    const expectedNext = original === "small" ? "large" : "small";
    const glyph = toggle.locator(".font-toggle-glyph");
    const glyphSizeBefore = await glyph.evaluate(element => getComputedStyle(element).fontSize);
    const heading = page.getByTestId("report-heading");
    const headingSizeBefore = await heading.evaluate(element => getComputedStyle(element).fontSize);
    await expect(glyph).toHaveText(original === "large" ? "AA" : "Aa");
    const saved = page.waitForResponse(response =>
      response.url().includes("/api/profile/font-size") &&
      response.request().method() === "PATCH"
    );
    await toggle.click();
    expect((await saved).status()).toBe(200);
    await expect(toggle).toHaveAttribute("data-font-size", expectedNext);
    await expect(glyph).toHaveText(expectedNext === "large" ? "AA" : "Aa");
    expect(await glyph.evaluate(element => getComputedStyle(element).fontSize)).toBe(glyphSizeBefore);
    expect(await heading.evaluate(element => getComputedStyle(element).fontSize)).not.toBe(headingSizeBefore);

    const profile = await context.request.get(`${BASE}/api/profile`);
    expect(profile.status()).toBe(200);
    expect((await profile.json()).fontSizePreference).toBe(expectedNext);

    await page.route("**/api/profile/font-size", route =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "forced test failure" }),
      })
    );
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-font-size", expectedNext);
    await expect(page.locator("html")).toHaveClass(
      expectedNext === "small" ? /font-small/ : /^(?!.*font-small)/,
    );
  });

  test("home keeps HStix and meal suggestions without redundant actions or artwork", async ({ page }) => {
    await page.route("**/api/dev/time", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ timeOverride: 18, dateOverride: null }),
    }));
    await page.route("**/api/meal-suggestions**", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ name: "Steamed fish with vegetables", source: "list" }),
    }));

    await page.goto("/");

    await expect(page.getByTestId("text-greeting")).toBeVisible();
    await expect(page.getByTestId("section-home-hstix")).toBeVisible();
    await expect(
      page.getByTestId("button-home-hstix-record").or(page.getByTestId("button-home-hstix-change")),
    ).toBeVisible();
    await expect(page.getByTestId("button-home-snap")).toHaveCount(0);
    await expect(page.getByTestId("button-home-report")).toHaveCount(0);
    await expect(page.getByTestId("img-gift-greeting")).toHaveCount(0);

    await page.getByTestId("button-meal-suggestion").click();
    await expect(page.getByTestId("card-meal-suggestion-result")).toContainText("Steamed fish with vegetables");
  });
});