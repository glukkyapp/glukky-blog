import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-glucose-patterns@glukky.test";
const TEST_PASS = "TestSpec123";

async function setupUser(context: BrowserContext, page: Page) {
  const api = context.request;
  let login = await api.post(`${BASE}/api/auth/login`, { data: { email: TEST_EMAIL, password: TEST_PASS } });
  if (login.status() === 401) {
    login = await api.post(`${BASE}/api/auth/register`, { data: { email: TEST_EMAIL, password: TEST_PASS } });
  }
  expect(login.status()).toBe(200);
  expect((await api.post(`${BASE}/api/profile`, {
    data: {
      walksPerWeek: 3,
      walkDuration: 20,
      dinnerTime: "before_9pm",
      sleepPattern: "regular_10_6",
      eatingOutFrequency: "1_2",
      struggles: ["sugary_food_drink"],
    },
  })).status()).toBe(200);
  await api.patch(`${BASE}/api/profile/intro-seen`);
  await page.addInitScript(() => localStorage.setItem("glukky_has_session", "1"));
}

test.use({ viewport: { width: 390, height: 844 } });

test("Glucose Patterns opens on AI and lets users browse actual cards and food details", async ({ context, page }) => {
  await setupUser(context, page);

  await page.route("**/api/snap/glucose-patterns**", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("query")) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ suggestions: [{ foodName: "Apple" }] }) });
    }
    if (url.searchParams.has("food")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            foodName: "Apple",
            avgPostMealMmol: 5.4,
            readingCount: 2,
            impactLevel: "low",
            readings: [
              { recordedAt: "2026-08-15T12:00:00.000Z", postMealGlucoseMmol: 5.2 },
              { recordedAt: "2026-08-14T12:00:00.000Z", postMealGlucoseMmol: 5.6 },
            ],
          },
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        totalPaired: 7,
        totalSnaps: 10,
        topList: [
          { foodName: "Apple", avgPostMealMmol: 5.4, readingCount: 2, impactLevel: "low" },
          { foodName: "Yogurt", avgPostMealMmol: 5.7, readingCount: 4, impactLevel: "low" },
        ],
        aiOnlyList: [
          { foodName: "Tofu", impactLevel: "low", snapCount: 2 },
          { foodName: "Berries", impactLevel: "low", snapCount: 1 },
        ],
      }),
    });
  });
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 2, isPersonalised: false, glucosePersonalisedSeen: true }),
  }));

  await page.goto("/glucose-patterns");
  await expect(page.getByTestId("glucose-mode-ai")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("glucose-impact-low")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("glucose-ranking-card-0")).toBeVisible();

  await page.getByTestId("glucose-mode-actual").click();
  await expect(page.getByTestId("glucose-mode-actual")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("glucose-ranking-card-0")).toContainText("Apple");
  await expect(page.getByTestId("glucose-ranking-card-0")).toContainText(/1st place|第一名/);
  await expect(page.getByTestId("glucose-ranking-card-0")).toContainText("5.4");

  await page.getByTestId("input-glucose-food-search").fill("app");
  await page.getByTestId("glucose-search-suggestion-Apple").click();
  await expect(page.getByTestId("glucose-food-detail-dialog")).toBeVisible();
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("5.2 mmol/L");
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("5.6 mmol/L");
});