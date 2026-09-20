import {
  test as baseTest,
  expect,
  request as playwrightRequest,
  type Page,
  type Route,
} from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = `test-teal-refresh-${Date.now()}@glukky.test`;
const TEST_PASS = "TestSpec123";
const SCREENSHOTS = "screenshots/teal-refresh";
const AUTH_STATE = "/tmp/teal-refresh-auth.json";

async function setupUser() {
  const api = await playwrightRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.77" },
  });
  const registration = await api.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  expect(registration.status()).toBe(200);
  expect((await api.post(`${BASE}/api/dev/reset-account`)).status()).toBe(200);
  expect((await api.post(`${BASE}/api/profile`, {
    data: {
      preferredLanguage: "en",
      healthCondition: "no_but_health",
      name: "May",
    },
  })).status()).toBe(200);
  expect((await api.patch(`${BASE}/api/profile/intro-seen`)).status()).toBe(200);
  await api.storageState({ path: AUTH_STATE });
  await api.dispose();
}

const test = baseTest.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [async ({}, use) => {
    await setupUser();
    await use(AUTH_STATE);
  }, { scope: "worker" }],
});

function utcLocalDate(offsetDays = 0) {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + offsetDays,
    12,
  )).toISOString().slice(0, 10);
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

test.describe("teal refresh regression evidence", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("glukky_has_session", "1");
      localStorage.setItem("piggy_intro_skipped", "1");
      localStorage.setItem("glukky_snap_tooltip_dismissed", "1");
    });
  });

  test("home has one localized mascot heading", async ({ page }) => {
    await page.route("**/api/daily-task", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        localDate: utcLocalDate(),
        tasks: ["post_meal_walk", "unsweetened_drink", "vegetable_dish"],
        completedTaskId: null,
      }),
    }));

    await page.goto("/");

    const habit = page.getByTestId("section-daily-habit");
    await expect(habit).toBeVisible();
    await expect(habit.getByTestId("img-daily-habit-mascot")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "What healthy habit did you achieve today?",
      }),
    ).toHaveCount(1);
    await expect(page.getByTestId("daily-task-card").getByRole("heading")).toHaveCount(0);
    await habit.screenshot({ path: `${SCREENSHOTS}/home-habit-mascot.png` });
  });

  test("captures all six FoodSnap states and its advice popup", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    let releaseLabel!: () => void;
    const labelGate = new Promise<void>(resolve => { releaseLabel = resolve; });
    let releaseAdvice!: () => void;
    const adviceGate = new Promise<void>(resolve => { releaseAdvice = resolve; });

    await page.route("**/api/snap/label", async route => {
      await labelGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          name: "Chicken rice",
          canonicalName: "chicken-rice",
          portion: "Medium",
          portionId: "medium",
          sauces: "Ginger sauce",
          sauceIds: [],
          extras: "Cucumber",
          toppingIds: [],
          comboSource: "claude",
          snapsUsedToday: 1,
          snapsLimit: 3,
        }),
      });
    });
    await page.route("**/api/snap/advice", async route => {
      await adviceGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          advice: "A balanced plate.",
          adviceUsedToday: 1,
          adviceLimit: 6,
          snapId: 9001,
          glucosePrediction: {
            avgPostMealMmol: 6.4,
            pairedCount: 4,
            state: "B",
            glucoseGroup: "healthy",
          },
          structuredAdvice: {
            impactValue: "medium",
            impactDisplay: "Medium impact",
            opener: "A familiar meal can still be balanced.",
            watchOut: [{ food: "Rice", risk: "A large portion may raise glucose quickly." }],
            positiveLine: "Chicken provides protein.",
            rightNow: ["Eat the cucumber first."],
            nextTime: "Try a little less rice.",
          },
        }),
      });
    });

    await page.goto("/snap");
    await expect(page.getByTestId("button-snap-album")).toBeVisible();
    for (const id of ["button-snap-camera", "button-snap-album"]) {
      const button = page.getByTestId(id);
      const bounds = await button.boundingBox();
      const card = await button.locator("xpath=ancestor::*[contains(@class,'snap-state-card')]").boundingBox();
      expect(bounds).not.toBeNull();
      expect(card).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(card!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(card!.x + card!.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${SCREENSHOTS}/snap-1-upload.png`, fullPage: true });

    await page.getByTestId("input-snap-album").setInputFiles(
      "attached_assets/hargawmascot_1789835862050.png",
    );
    await expect(page.getByTestId("div-meal-select-chips")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-2-meal-select.png`, fullPage: true });

    await page.getByTestId("button-meal-select-continue").click();
    await expect(page.getByTestId("status-snap-labeling")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-3-labeling.png`, fullPage: true });
    releaseLabel();

    await expect(page.getByTestId("input-snap-name")).toHaveValue("Chicken rice");
    await page.screenshot({ path: `${SCREENSHOTS}/snap-4-review.png`, fullPage: true });

    await page.getByTestId("button-snap-get-advice").click();
    await expect(page.getByTestId("status-snap-advising")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-5-advising.png`, fullPage: true });
    releaseAdvice();

    await expect(page.getByTestId("dialog-snap-advice-popup")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-advice-popup.png`, fullPage: true, animations: "disabled" });
    await page.getByTestId("button-snap-popup-skip").click();
    await expect(page.getByTestId("dialog-snap-advice-popup")).toHaveCount(0);
    await expect(page.getByTestId("button-snap-new-photo")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-6-advice.png`, fullPage: true });
  });

  test("Daily and Food Log share opted-in final impact while raw mmol stays unchanged", async ({ page }) => {
    const yesterday = utcLocalDate(-1);
    const requestedFlags = { daily: [] as string[], foodLog: [] as string[] };
    const items = [
      {
        id: 7101,
        localDate: yesterday,
        snapTime: `${yesterday}T08:00:00.000Z`,
        mealType: "breakfast",
        foodName: "Measured oats",
        glucoseImpact: "high",
        finalGlucoseImpact: "low",
        postMealGlucoseMmol: 5.5,
        hstixReadingId: 8101,
        postMealSymptom: null,
        previousMealOverlap: false,
        overlapDismissed: false,
      },
      {
        id: 7102,
        localDate: yesterday,
        snapTime: `${yesterday}T13:00:00.000Z`,
        mealType: "lunch",
        foodName: "Delayed noodles",
        glucoseImpact: "medium",
        finalGlucoseImpact: "medium",
        postMealGlucoseMmol: 12.3,
        hstixReadingId: 8102,
        postMealSymptom: null,
        previousMealOverlap: false,
        overlapDismissed: false,
      },
      {
        id: 7103,
        localDate: yesterday,
        snapTime: `${yesterday}T19:00:00.000Z`,
        mealType: "dinner",
        foodName: "Unassessed soup",
        glucoseImpact: null,
        finalGlucoseImpact: null,
        postMealGlucoseMmol: null,
        hstixReadingId: null,
        postMealSymptom: null,
        previousMealOverlap: false,
        overlapDismissed: false,
      },
    ];
    await page.route("**/api/snap/daily-summary**", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        snaps: items.map(({ glucoseImpact, mealType, snapTime, foodName }) => ({
          glucoseImpact,
          mealType,
          snapTime,
          foodName,
        })),
        irregularMealCount: 0,
      }),
    }));
    const fulfillMealLog = (surface: keyof typeof requestedFlags) => (route: Route) => {
      const url = new URL(route.request().url());
      requestedFlags[surface].push(url.searchParams.get("includeFinalImpact") ?? "");
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          month: url.searchParams.get("month"),
          items,
        }),
      });
    };
    await page.route("**/api/snap/meal-log**", fulfillMealLog("daily"));

    await page.goto("/report");
    await expect(page.getByText("Yesterday’s meals", { exact: true })).toBeVisible();
    await expect(page.getByTestId("meal-timeline-item-7101")).toContainText("Low");
    await expect(page.getByTestId("meal-timeline-item-7102")).toContainText("Med");
    await expect(page.getByTestId("meal-timeline-item-7103")).toContainText("Impact not available");
    await page.screenshot({ path: `${SCREENSHOTS}/daily-yesterday-meals.png`, fullPage: true });

    const foodLogPage = await page.context().newPage();
    await foodLogPage.addInitScript(() => {
      localStorage.setItem("glukky_has_session", "1");
      localStorage.setItem("piggy_intro_skipped", "1");
    });
    await foodLogPage.route("**/api/snap/meal-log**", fulfillMealLog("foodLog"));
    await foodLogPage.goto("/food-log");
    const measured = foodLogPage.getByTestId("food-log-item-7101");
    const delayed = foodLogPage.getByTestId("food-log-item-7102");
    const unavailable = foodLogPage.getByTestId("food-log-item-7103");
    await expect(measured.getByLabel("Low")).toBeVisible();
    await expect(measured).toContainText("5.5");
    await expect(delayed.getByLabel("Med")).toBeVisible();
    await expect(delayed).toContainText("12.3");
    await expect(unavailable.locator('[data-testid^="food-log-glucose-"]')).toHaveCount(0);
    expect(requestedFlags.daily.length).toBeGreaterThan(0);
    expect(requestedFlags.foodLog.length).toBeGreaterThan(0);
    expect(requestedFlags.daily.every(flag => flag === "true")).toBe(true);
    expect(requestedFlags.foodLog.every(flag => flag === "true")).toBe(true);
    await foodLogPage.screenshot({ path: `${SCREENSHOTS}/food-log-final-impact.png`, fullPage: true });
    await foodLogPage.close();
  });

  test("malformed final impact is an error, never an empty meal state", async ({ page }) => {
    const yesterday = utcLocalDate(-1);
    await page.route("**/api/snap/daily-summary**", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ snaps: [], irregularMealCount: 0 }),
    }));
    await page.route("**/api/snap/meal-log**", route => {
      const url = new URL(route.request().url());
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          month: url.searchParams.get("month"),
          items: [{
            id: 7201,
            localDate: yesterday,
            snapTime: `${yesterday}T08:00:00.000Z`,
            mealType: "breakfast",
            foodName: "Malformed impact",
            glucoseImpact: "low",
          }],
        }),
      });
    });

    await page.goto("/food-log");
    await expect(page.getByTestId("food-log-error")).toBeVisible();
    await expect(page.getByTestId("food-log-empty")).toHaveCount(0);

    await page.goto("/report");
    await expect(page.getByTestId("meal-timeline-error")).toBeVisible();
    await expect(page.getByTestId("meal-timeline-empty")).toHaveCount(0);
  });

  test("Glucose Patterns keeps its established card appearance", async ({ page }) => {
    await page.route("**/api/user/glucose-patterns/swipe-tutorial**", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ seen: true }),
    }));
    await page.route("**/api/snap/glucose-patterns**", route => {
      const params = new URL(route.request().url()).searchParams;
      const food = { foodKey: "oats", foodNameEn: "Oats", foodNameZhHant: "燕麥", foodNameYue: "燕麥" };
      if (params.has("query") || params.has("food")) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(params.has("query")
            ? { suggestions: [food] }
            : { detail: { ...food, kind: "history", mealCount: 25 } }),
        });
      }
      return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        totalPaired: 50,
        totalSnaps: 50,
        topList: [],
        hstixList: [{
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
          lift: 0.5,
          avgPostMealMmol: 5.8,
          impactLevel: "low",
          componentType: "carb",
        }],
        hstixNeedsMoreReadings: [],
      }),
      });
    });
    await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        glucoseGroup: "healthy",
        readingCount: 50,
        isPersonalised: true,
        glucosePersonalisedSeen: true,
      }),
    }));
    await page.route("**/api/snap/food-frequency", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        totalMeals: 10,
        eligible: true,
        foods: [{ nameEn: "Rice", nameZhHant: "白飯", nameYue: "白飯", mealCount: 5 }],
        topFoods: [{ nameEn: "Rice", nameZhHant: "白飯", nameYue: "白飯", mealCount: 5 }],
        sweetSubtypes: [],
        carbCategories: [{ carbCategory: "rice", mealCount: 5 }],
      }),
    }));

    await page.goto("/glucose-patterns");
    const recurring = page.getByTestId("recurring-food-card");
    await expect(recurring).toBeVisible();
    await expect(recurring).toHaveCSS("background-color", "rgb(255, 248, 236)");
    await expect(recurring).toHaveCSS("border-width", "0px");
    await expect(recurring).toHaveCSS("border-radius", "28px");
    await expect(recurring).toHaveCSS(
      "box-shadow",
      "rgba(13, 126, 143, 0.08) 0px 4px 14px 0px",
    );
    await page.screenshot({ path: `${SCREENSHOTS}/glucose-patterns-unchanged.png`, fullPage: true });
    await page.getByTestId("input-glucose-food-search").fill("Oats");
    await page.getByTestId("glucose-search-suggestion-oats").click();
    const detail = page.getByTestId("glucose-food-detail-dialog");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveCSS("background-color", "rgb(254, 242, 224)");
    await page.screenshot({ path: `${SCREENSHOTS}/glucose-patterns-dialog-unchanged.png`, fullPage: true });
  });
});