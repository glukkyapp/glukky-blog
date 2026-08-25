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

test("Navigation fits five equal slots and Profile exposes the moved tools", async ({ context, page }) => {
  await setupUser(context, page);

  await page.goto("/");
  const nav = page.getByTestId("nav-floating-bar");
  await expect(nav).toBeVisible();
  await expect(nav.locator('button[data-testid^="nav-tab-"]')).toHaveCount(5);
  await expect(page.getByTestId("nav-tab-hstix")).toHaveCount(0);
  await expect(page.getByTestId("nav-tab-health_info")).toHaveCount(0);
  const mobileGeometry = await nav.locator(":scope > div").evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    buttonWidths: Array.from(element.querySelectorAll("button")).map(button => button.getBoundingClientRect().width),
  }));
  expect(mobileGeometry.scrollWidth).toBe(mobileGeometry.clientWidth);
  expect(Math.max(...mobileGeometry.buttonWidths) - Math.min(...mobileGeometry.buttonWidths)).toBeLessThan(1);

  await page.goto("/profile");
  await expect(page.getByTestId("profile-personal-shortcuts")).toBeVisible();
  await expect(page.getByTestId("profile-shortcut-glucose")).toContainText("Glucose record");
  await expect(page.getByTestId("profile-shortcut-food")).toContainText("Food Log");
  await expect(page.getByTestId("profile-shortcut-health")).toContainText("Health Info");
  await page.getByTestId("profile-shortcut-glucose").click();
  await expect(page).toHaveURL(/\/hstix$/);
  await page.goto("/profile");
  await page.getByTestId("profile-shortcut-food").click();
  await expect(page).toHaveURL(/\/food-log$/);
  await page.goto("/profile");
  await page.getByTestId("profile-shortcut-health").click();
  await expect(page).toHaveURL(/\/health-info$/);
});

test("Needs more readings is a selector and keeps the measured card visible", async ({ context, page }) => {
  await setupUser(context, page);

  await page.route("**/api/snap/glucose-patterns**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      totalPaired: 30,
      totalSnaps: 30,
      topList: [],
      hstixList: [{
        foodKey: "white-rice",
        foodNameEn: "White rice",
        foodNameZhHant: "白飯",
        foodNameYue: "白飯",
        totalMeals: 25,
        highMeals: 20,
        mediumMeals: 3,
        lowMeals: 2,
        nonHighMeals: 5,
        highProbability: 0.8,
        overallHighProbability: 0.5,
        lift: 1.5,
        avgPostMealMmol: 7.9,
        impactLevel: "high",
      }],
      hstixNeedsMoreReadings: [
        { foodKey: "chicken", foodNameEn: "Chicken", foodNameZhHant: "雞肉", foodNameYue: "雞肉", totalMeals: 12 },
        { foodKey: "tofu", foodNameEn: "Tofu", foodNameZhHant: "豆腐", foodNameYue: "豆腐", totalMeals: 18 },
      ],
      aiOnlyList: [],
    }),
  }));
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 2, isPersonalised: false, glucosePersonalisedSeen: true }),
  }));

  await page.goto("/glucose-patterns");
  await page.getByTestId("glucose-mode-actual").click();
  await expect(page.getByTestId("glucose-ranking-card-0")).toBeVisible();
  await expect(page.getByTestId("glucose-needs-more-readings-select")).toBeVisible();
  await expect(page.getByTestId("glucose-needs-more-readings-selected")).toContainText("12 eligible readings");

  await page.getByTestId("glucose-needs-more-readings-select").click();
  await page.getByRole("option", { name: "Tofu" }).click();
  await expect(page.getByTestId("glucose-needs-more-readings-selected")).toContainText("18 eligible readings");
  await expect(page.getByTestId("glucose-needs-more-readings-selected")).toContainText("7 more needed");
});

test("Partner messages appear only on qualified measured cards", async ({ context, page }) => {
  await setupUser(context, page);

  await page.route("**/api/snap/glucose-patterns**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      totalPaired: 50,
      totalSnaps: 50,
      topList: [],
      hstixList: [
        {
          foodKey: "rice",
          foodNameEn: "Rice",
          foodNameZhHant: "白飯",
          foodNameYue: "白飯",
          totalMeals: 25,
          highMeals: 19,
          mediumMeals: 4,
          lowMeals: 2,
          nonHighMeals: 6,
          highProbability: 0.76,
          overallHighProbability: 0.5,
          lift: 1.5,
          avgPostMealMmol: 7.9,
          impactLevel: "high",
          partnerInsight: {
            kind: "dominant",
            partner: { foodKey: "pork", foodNameEn: "Roast pork", foodNameZhHant: "燒肉", foodNameYue: "燒肉" },
          },
        },
        {
          foodKey: "oats",
          foodNameEn: "Oats",
          foodNameZhHant: "燕麥",
          foodNameYue: "燕麥",
          totalMeals: 25,
          highMeals: 2,
          mediumMeals: 4,
          lowMeals: 19,
          nonHighMeals: 23,
          highProbability: 0.08,
          overallHighProbability: 0.5,
          lift: 0.6,
          avgPostMealMmol: 5.8,
          impactLevel: "low",
          partnerInsight: {
            kind: "comparison",
            higherPartner: { foodKey: "milk", foodNameEn: "Milk", foodNameZhHant: "牛奶", foodNameYue: "牛奶" },
            lowerPartner: { foodKey: "berries", foodNameEn: "Berries", foodNameZhHant: "莓果", foodNameYue: "莓果" },
          },
        },
      ],
      hstixNeedsMoreReadings: [],
      aiOnlyList: [{ foodName: "AI-only food", impactLevel: "low", snapCount: 3 }],
    }),
  }));
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 50, isPersonalised: true, glucosePersonalisedSeen: true }),
  }));

  await page.goto("/glucose-patterns");
  await expect(page.getByTestId("glucose-partner-dominant")).toHaveCount(0);
  await expect(page.getByTestId("glucose-partner-comparison")).toHaveCount(0);

  await page.getByTestId("glucose-mode-actual").click();
  await expect(page.getByTestId("glucose-partner-comparison")).toContainText("higher with Milk and lower with Berries");
  await expect(page.getByTestId("glucose-partner-disclaimer")).toContainText("does not prove");
  await expect(page.getByTestId("glucose-partner-dominant")).toHaveCount(0);

  await page.getByTestId("glucose-impact-high").click();
  await expect(page.getByTestId("glucose-partner-dominant")).toContainText("Most times you eat Rice, you also eat Roast pork");
  await expect(page.getByTestId("glucose-partner-comparison")).toHaveCount(0);
});

test.describe("desktop navigation layout", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("keeps the fixed bar width and five equal slots on desktop", async ({ context, page }) => {
    await setupUser(context, page);
    await page.goto("/");
    const nav = page.getByTestId("nav-floating-bar");
    await expect(nav).toBeVisible();
    await expect(nav.locator('button[data-testid^="nav-tab-"]')).toHaveCount(5);
    const barWidth = await nav.evaluate(element => element.getBoundingClientRect().width);
    expect(barWidth).toBe(384);
    const geometry = await nav.locator(":scope > div").evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      buttonWidths: Array.from(element.querySelectorAll("button")).map(button => button.getBoundingClientRect().width),
    }));
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    expect(Math.max(...geometry.buttonWidths) - Math.min(...geometry.buttonWidths)).toBeLessThan(1);
  });
});