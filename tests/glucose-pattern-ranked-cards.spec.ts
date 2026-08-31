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
    },
  })).status()).toBe(200);
  await api.patch(`${BASE}/api/profile/intro-seen`);
  await page.addInitScript(() => localStorage.setItem("glukky_has_session", "1"));
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("Swipe tutorial reset rejects every other account without changing its state", async ({ context, page }) => {
  await setupUser(context, page);
  const api = context.request;

  const markSeen = await api.post(`${BASE}/api/user/glucose-patterns/swipe-tutorial/seen`);
  expect(markSeen.status()).toBe(200);
  expect(await markSeen.json()).toEqual({ seen: true });

  const rejectedReset = await api.post(`${BASE}/api/dev/glucose-patterns/swipe-tutorial/reset`);
  expect(rejectedReset.status()).toBe(403);

  const unchanged = await api.get(`${BASE}/api/user/glucose-patterns/swipe-tutorial`);
  expect(unchanged.status()).toBe(200);
  expect(await unchanged.json()).toEqual({ seen: true });
});

test("Swipe tutorial waits for a multi-card group, respects reduced motion, and persists across groups", async ({ context, page }) => {
  await setupUser(context, page);
  let tutorialSeen = false;
  await page.route("**/api/user/glucose-patterns/swipe-tutorial**", route => {
    if (route.request().method() === "POST") tutorialSeen = true;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ seen: tutorialSeen }),
    });
  });

  let foods = [
    { nameEn: "Rice", nameZhHant: "白飯", nameYue: "白飯", mealCount: 5 },
  ];
  const lowHstixFoods = ["Oats", "Potato"].map((name, index) => ({
    foodKey: name.toLowerCase(),
    foodNameEn: name,
    foodNameZhHant: index === 0 ? "燕麥" : "薯仔",
    foodNameYue: index === 0 ? "燕麥" : "薯仔",
    totalMeals: 25,
    highMeals: 2,
    mediumMeals: 4,
    lowMeals: 19,
    nonHighMeals: 23,
    highProbability: 0.08,
    overallHighProbability: 0.5,
    lift: 0.5 + index * 0.1,
    avgPostMealMmol: 5.8,
    impactLevel: "low",
    componentType: "carb",
  }));

  await page.route("**/api/snap/glucose-patterns**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      totalPaired: 50,
      totalSnaps: 50,
      topList: [],
      hstixList: lowHstixFoods,
      hstixNeedsMoreReadings: [],
    }),
  }));
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 50, isPersonalised: true, glucosePersonalisedSeen: true }),
  }));
  await page.route("**/api/snap/food-frequency", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ totalMeals: 10, eligible: true, foods, sweetSubtypes: [], carbCategories: [] }),
  }));

  await page.goto("/glucose-patterns");
  await expect(page.getByTestId("recurring-food-card")).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByTestId("pattern-swipe-cue")).toHaveCount(0);
  await expect(page.getByTestId("pattern-swipe-tutorial")).toHaveCount(0);
  await expect(page.getByTestId("pattern-next-card-sliver")).toHaveCount(0);
  await expect(page.getByTestId("pattern-next")).toHaveCount(0);
  await expect(page.getByTestId("pattern-card-viewport")).not.toHaveAttribute("tabindex", "0");
  expect(tutorialSeen).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("glukky_glucose_patterns_swipe_tutorial_seen"))).toBeNull();

  foods = [
    ...foods,
    { nameEn: "Noodles", nameZhHant: "麵條", nameYue: "麵條", mealCount: 4 },
  ];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.getByTestId("pattern-swipe-cue")).toBeVisible();
  await page.waitForTimeout(450);
  await expect(page.getByTestId("pattern-swipe-tutorial")).toHaveCount(0);
  await expect(page.getByTestId("pattern-swipe-tutorial")).toBeVisible({ timeout: 600 });
  await expect(page.getByTestId("pattern-next-card-sliver")).toBeVisible();
  expect(await page.locator(".swipe-tutorial-nudge").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  expect(tutorialSeen).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("glukky_glucose_patterns_swipe_tutorial_seen"))).toBeNull();

  await page.getByTestId("pattern-next").click();
  await expect(page.getByTestId("pattern-swipe-tutorial")).toHaveCount(0);
  await expect(page.getByTestId("pattern-position")).toHaveText("2 / 2");

  await page.reload();
  await expect(page.getByTestId("recurring-food-card")).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByTestId("pattern-swipe-tutorial")).toHaveCount(0);

  await page.getByTestId("glucose-mode-hstix").click();
  await expect(page.getByTestId("glucose-ranking-card-0")).toBeVisible();
  await expect(page.getByTestId("pattern-swipe-cue")).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByTestId("pattern-swipe-tutorial")).toHaveCount(0);
});

test("Glucose Patterns opens on recorded cards and lets users browse food details", async ({ context, page }) => {
  await setupUser(context, page);

  await page.route("**/api/snap/glucose-patterns**", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("query")) {
      const mode = url.searchParams.get("mode");
      const query = url.searchParams.get("query")?.toLowerCase() ?? "";
      if (query.includes("chicken")) {
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({
          suggestions: mode === "hstix" ? [] : [{
            foodKey: "history:chicken breast",
            foodNameEn: "Chicken Breast",
            foodNameZhHant: "雞胸肉",
            foodNameYue: "雞胸肉",
          }],
        }) });
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        suggestions: [{
          foodKey: "apple|蘋果|蘋果",
          foodNameEn: mode === "hstix" ? "Apple HStix" : "Apple",
          foodNameZhHant: "蘋果",
          foodNameYue: "蘋果",
        }],
      }) });
    }
    if (url.searchParams.has("food")) {
      if (url.searchParams.get("food") === "history:chicken breast") {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            detail: {
              kind: "history",
              foodKey: "history:chicken breast",
              foodNameEn: "Chicken Breast",
              foodNameZhHant: "雞胸肉",
              foodNameYue: "雞胸肉",
              mealCount: 2,
            },
          }),
        });
      }
      if (url.searchParams.get("mode") === "hstix") {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            detail: {
              kind: "hstix",
              foodKey: "apple|蘋果|蘋果",
              foodName: "Apple",
              foodNameEn: "Apple",
              foodNameZhHant: "蘋果",
              foodNameYue: "蘋果",
              carbCategory: "other",
              sweetCategory: null,
              componentType: "carb",
              avgPostMealMmol: 7.1,
              readingCount: 25,
              impactLevel: "medium",
              lift: 1,
              highMeals: 8,
              nonHighMeals: 17,
              readings: [{ recordedAt: "2026-08-30T12:00:00.000Z", postMealGlucoseMmol: 7.1 }],
            },
          }),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            kind: "general",
            foodKey: "apple|蘋果|蘋果",
            foodNameEn: "Apple",
            foodNameZhHant: "蘋果",
            foodNameYue: "蘋果",
            carbCategory: "other",
            sweetCategory: null,
            componentType: "carb",
            mealCount: 2,
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
          { foodKey: "apple|蘋果|蘋果", foodNameEn: "Apple", foodNameZhHant: "蘋果", foodNameYue: "蘋果", carbCategory: "other", sweetCategory: null, componentType: "carb", mealCount: 2 },
          { foodKey: "cake|蛋糕|蛋糕", foodNameEn: "Cake", foodNameZhHant: "蛋糕", foodNameYue: "蛋糕", carbCategory: null, sweetCategory: "sweet_food", componentType: "sweet_food", mealCount: 1 },
        ],
        hstixList: [],
        hstixNeedsMoreReadings: [],
      }),
    });
  });
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 2, isPersonalised: false, glucosePersonalisedSeen: true }),
  }));
  const foodFrequencyResponse = {
    totalMeals: 25,
    eligible: true,
    foods: [
      { nameEn: "Chicken breast", nameZhHant: "雞胸肉", nameYue: "雞胸肉", mealCount: 6 },
      { nameEn: "Rice", nameZhHant: "白飯", nameYue: "白飯", mealCount: 5 },
      { nameEn: "Vegetables", nameZhHant: "蔬菜", nameYue: "菜", mealCount: 4 },
      { nameEn: "Cake", nameZhHant: "蛋糕", nameYue: "蛋糕", mealCount: 3 },
      { nameEn: "Noodles", nameZhHant: "麵條", nameYue: "麵條", mealCount: 2 },
      { nameEn: "Oats", nameZhHant: "燕麥", nameYue: "燕麥", mealCount: 1 },
    ],
    sweetSubtypes: [{ sweetCategory: "sweet_drink", mealCount: 3 }],
    carbCategories: [
      { carbCategory: "rice", mealCount: 4 },
      { carbCategory: "other", mealCount: 2 },
    ],
  };
  await page.route("**/api/snap/food-frequency", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(foodFrequencyResponse),
  }));

  await page.goto("/glucose-patterns");
  await expect(page.getByTestId("glucose-mode-ai")).toHaveCount(0);
  await expect(page.getByTestId("glucose-mode-actual")).toHaveCount(0);
  await expect(page.getByTestId("glucose-mode-general")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("glucose-mode-hstix")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("glucose-impact-low")).toHaveCount(0);
  await expect(page.getByTestId("glucose-general-component-list")).toHaveCount(0);
  await expect(page.getByTestId("card-recurring-foods")).toContainText("Your favourite foods");
  await expect(page.getByTestId("recurring-food-card")).toHaveCount(1);
  await expect(page.getByTestId("recurring-food-card")).toContainText("Chicken breast");
  await expect(page.getByTestId("pattern-swipe-cue")).toContainText("Swipe left to see the next food");
  await expect(page.getByTestId("pattern-next-card-sliver")).toBeVisible();
  await expect(page.getByTestId("pattern-position")).toHaveText("1 / 5");
  await page.getByTestId("pattern-next").click();
  await expect(page.getByTestId("recurring-food-card")).toContainText("Rice");
  await expect(page.getByTestId("pattern-position")).toHaveText("2 / 5");
  await page.getByTestId("pattern-card-viewport").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("recurring-food-card")).toContainText("Vegetables");
  await expect(page.getByTestId("pattern-position")).toHaveText("3 / 5");
  const viewportBox = await page.getByTestId("pattern-card-viewport").boundingBox();
  expect(viewportBox).not.toBeNull();
  const touchX = viewportBox!.x + viewportBox!.width - 35;
  const touchY = viewportBox!.y + viewportBox!.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchX, y: touchY, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: touchX - 45, y: touchY, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: touchX - 90, y: touchY, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByTestId("recurring-food-card")).toContainText("Cake");
  await expect(page.getByTestId("pattern-position")).toHaveText("4 / 5");
  await expect(page.getByTestId("card-favourite-category")).toBeVisible();
  await expect(page.getByTestId("card-favourite-category")).toContainText("Your favourite category");
  await expect(page.getByTestId("food-frequency-favourite-category")).toHaveText("Rice");
  await expect(page.getByTestId("card-recurring-foods")).not.toContainText("Your favourite category");

  foodFrequencyResponse.sweetSubtypes = [];
  foodFrequencyResponse.carbCategories = [];
  await page.reload();
  await expect(page.getByTestId("recurring-food-card")).toHaveCount(1);
  await expect(page.getByTestId("recurring-food-card")).toContainText("Chicken breast");
  await expect(page.getByTestId("pattern-position")).toHaveText("1 / 5");
  await expect(page.getByTestId("card-favourite-category")).toHaveCount(0);

  await page.getByTestId("input-glucose-food-search").fill("app");
  await page.getByTestId("glucose-search-suggestion-apple|蘋果|蘋果").click();
  await expect(page.getByTestId("glucose-food-detail-dialog")).toBeVisible();
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("Carbohydrate");
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("2 meals");
  await expect(page.getByTestId("glucose-food-detail-dialog")).not.toContainText("mmol/L");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("glucose-food-detail-dialog")).toHaveCount(0);

  await page.getByTestId("input-glucose-food-search").fill("chicken");
  await page.getByTestId("glucose-search-suggestion-history:chicken breast").click();
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("Chicken Breast");
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("Recorded in 2 meals");
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("No glucose pattern data is available for this food yet.");
  await expect(page.getByTestId("glucose-food-detail-dialog")).not.toContainText("mmol/L");
  await page.keyboard.press("Escape");

  await page.getByTestId("glucose-mode-hstix").click();
  await expect(page.getByTestId("glucose-impact-low")).toBeVisible();
  await expect(page.getByTestId("glucose-general-component-list")).toHaveCount(0);
  await expect(page.getByTestId("card-recurring-foods")).toHaveCount(0);
  await expect(page.getByTestId("card-favourite-category")).toHaveCount(0);

  await page.getByTestId("input-glucose-food-search").fill("chicken");
  await expect(page.getByTestId("glucose-search-suggestions")).toContainText("No matching foods in your history.");
  await page.getByTestId("input-glucose-food-search").fill("app");
  await expect(page.getByTestId("glucose-search-suggestion-apple|蘋果|蘋果")).toContainText("Apple HStix");
  await page.getByTestId("glucose-search-suggestion-apple|蘋果|蘋果").click();
  await expect(page.getByTestId("glucose-food-detail-dialog")).toContainText("7.1 mmol/L");
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
        componentType: "carb",
      }],
      hstixNeedsMoreReadings: [
        { foodKey: "toast", foodNameEn: "Toast", foodNameZhHant: "多士", foodNameYue: "多士", componentType: "carb", totalMeals: 12 },
        { foodKey: "milk-tea", foodNameEn: "Milk tea", foodNameZhHant: "奶茶", foodNameYue: "奶茶", componentType: "sweet_drink", totalMeals: 18 },
      ],
    }),
  }));
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 2, isPersonalised: false, glucosePersonalisedSeen: true }),
  }));

  await page.goto("/glucose-patterns");
  await page.getByTestId("glucose-mode-hstix").click();
  await expect(page.getByTestId("glucose-ranking-card-0")).toBeVisible();
  await expect(page.getByTestId("glucose-card-rank")).toHaveText("1st place");
  await expect(page.getByTestId("glucose-ranking-card-0")).toContainText("20 high readings from 25 meals");
  await expect(page.getByTestId("pattern-swipe-cue")).toHaveCount(0);
  await expect(page.getByTestId("pattern-swipe-tutorial")).toHaveCount(0);
  await expect(page.getByTestId("pattern-next-card-sliver")).toHaveCount(0);
  await expect(page.getByTestId("pattern-next")).toHaveCount(0);
  await expect(page.getByTestId("pattern-card-viewport")).not.toHaveAttribute("tabindex", "0");
  await expect(page.getByTestId("glucose-needs-more-readings-select")).toBeVisible();
  await expect(page.getByTestId("glucose-needs-more-readings-selected")).toContainText("12 eligible readings");

  await page.getByTestId("glucose-needs-more-readings-select").click();
  await page.getByRole("option", { name: "Milk tea" }).click();
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
          componentType: "carb",
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
          componentType: "carb",
          partnerInsight: {
            kind: "comparison",
            higherPartner: { foodKey: "milk", foodNameEn: "Milk", foodNameZhHant: "牛奶", foodNameYue: "牛奶" },
            lowerPartner: { foodKey: "berries", foodNameEn: "Berries", foodNameZhHant: "莓果", foodNameYue: "莓果" },
          },
        },
      ],
      hstixNeedsMoreReadings: [],
    }),
  }));
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 50, isPersonalised: true, glucosePersonalisedSeen: true }),
  }));

  await page.goto("/glucose-patterns");
  await page.getByTestId("glucose-mode-hstix").click();
  await expect(page.getByTestId("glucose-partner-comparison")).toContainText("higher with Milk and lower with Berries");
  await expect(page.getByTestId("glucose-ranking-card-0")).toHaveCSS("background-color", "rgb(242, 251, 246)");
  await expect(page.getByTestId("glucose-ranking-card-0")).toHaveCSS("border-left-color", "rgb(85, 185, 138)");
  await expect(page.getByTestId("glucose-partner-comparison").locator("strong")).toHaveText(["Milk", "Berries"]);
  await expect(page.getByTestId("glucose-partner-disclaimer")).toContainText("does not prove");
  await expect(page.getByTestId("glucose-partner-dominant")).toHaveCount(0);

  await page.getByTestId("glucose-impact-high").click();
  await expect(page.getByTestId("glucose-ranking-card-0")).toHaveCSS("background-color", "rgb(255, 244, 243)");
  await expect(page.getByTestId("glucose-ranking-card-0")).toHaveCSS("border-left-color", "rgb(232, 90, 90)");
  await expect(page.getByTestId("glucose-partner-dominant")).toContainText("Most times you eat Rice, you also eat Roast pork");
  await expect(page.getByTestId("glucose-partner-dominant").locator("strong")).toHaveText("Roast pork");
  await expect(page.getByTestId("glucose-partner-comparison")).toHaveCount(0);
});

test("Medium HStix keeps five sampled cards without ordinal text", async ({ context, page }) => {
  await setupUser(context, page);

  await page.route("**/api/snap/glucose-patterns**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      totalPaired: 60,
      totalSnaps: 60,
      topList: [],
      hstixList: Array.from({ length: 6 }, (_, index) => ({
        foodKey: `medium-${index}`,
        foodNameEn: `Medium food ${index + 1}`,
        foodNameZhHant: `中等食物 ${index + 1}`,
        foodNameYue: `中等食物 ${index + 1}`,
        totalMeals: 25,
        highMeals: 8,
        mediumMeals: 9,
        lowMeals: 8,
        nonHighMeals: 17,
        highProbability: 0.32,
        overallHighProbability: 0.32,
        lift: 1,
        avgPostMealMmol: 6.8,
        impactLevel: "medium",
        componentType: "carb",
      })),
      hstixNeedsMoreReadings: [],
    }),
  }));
  await page.route("**/api/user/glucose-thresholds", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ glucoseGroup: "healthy", readingCount: 60, isPersonalised: true, glucosePersonalisedSeen: true }),
  }));

  await page.goto("/glucose-patterns");
  await page.getByTestId("glucose-mode-hstix").click();
  await page.getByTestId("glucose-impact-medium").click();

  await expect(page.getByTestId("glucose-ranking-card-0")).toBeVisible();
  await expect(page.getByTestId("glucose-card-rank")).toHaveCount(0);
  await expect(page.getByText("1 / 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("pattern-swipe-cue")).toBeVisible();
  await expect(page.getByTestId("pattern-next-card-sliver")).toBeVisible();

  const mediumCardStyle = await page.getByTestId("glucose-ranking-card-0").evaluate(element => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderLeftColor: style.borderLeftColor,
      borderLeftWidth: style.borderLeftWidth,
    };
  });
  expect(mediumCardStyle).toEqual({
    backgroundColor: "rgb(255, 251, 234)",
    borderLeftColor: "rgb(212, 154, 34)",
    borderLeftWidth: "4px",
  });

  const badgeStyle = await page.getByTestId("glucose-impact-badge-medium").evaluate(element => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, color: style.color };
  });
  expect(badgeStyle).toEqual({
    backgroundColor: "rgb(255, 240, 194)",
    color: "rgb(107, 74, 15)",
  });

  for (const testId of ["pattern-previous", "pattern-next"]) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByTestId("pattern-card-viewport").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("pattern-position")).toHaveText("2 / 5");
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