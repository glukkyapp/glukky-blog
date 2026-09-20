import {
  test as baseTest,
  expect,
  request as playwrightRequest,
  type Page,
  type Route,
} from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = `test-reference-layouts-${Date.now()}@glukky.test`;
const TEST_PASS = "TestSpec123";
const AUTH_STATE = "/tmp/reference-layouts-auth.json";
const SCREENSHOTS = "screenshots/teal-refresh";
const PHOTO = "attached_assets/hargawmascot_1789835862050.png";

async function setupUser() {
  const api = await playwrightRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.78" },
  });
  expect((await api.post("/api/auth/register", {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  })).status()).toBe(200);
  expect((await api.post("/api/dev/reset-account")).status()).toBe(200);
  expect((await api.post("/api/profile", {
    data: {
      preferredLanguage: "en",
      healthCondition: "no_but_health",
      name: "Layout Test",
    },
  })).status()).toBe(200);
  expect((await api.patch("/api/profile/intro-seen")).status()).toBe(200);
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

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function useLanguage(page: Page, language: "en" | "zh-Hant" | "yue") {
  expect((await page.request.post("/api/profile", {
    data: { preferredLanguage: language },
  })).status()).toBe(200);
  await page.addInitScript((lang) => {
    localStorage.setItem("glukky_has_session", "1");
    localStorage.setItem("piggy_intro_skipped", "1");
    localStorage.setItem("glukky_snap_tooltip_dismissed", "1");
    localStorage.setItem("glukky_preferred_lang", lang);
  }, language);
}

function labelPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Vegetable rice bowl",
    canonicalName: "vegetable-rice-bowl",
    portion: "Medium",
    portionId: "medium",
    sauces: "Sesame dressing",
    sauceIds: [],
    extras: "Cucumber",
    toppingIds: [],
    comboSource: "claude",
    snapsUsedToday: 1,
    snapsLimit: 3,
    ...overrides,
  };
}

function advicePayload(language: "en" | "zh-Hant" = "en", overrides: Record<string, unknown> = {}) {
  const chinese = language === "zh-Hant";
  return {
    advice: chinese ? "這是一份均衡的餐點。" : "This is a balanced meal.",
    adviceUsedToday: 1,
    adviceLimit: 6,
    snapId: 9301,
    glucosePrediction: {
      avgPostMealMmol: null,
      pairedCount: 0,
      state: "A",
      glucoseGroup: "healthy",
    },
    structuredAdvice: {
      impactValue: "medium",
      impactDisplay: chinese ? "中等影響" : "Medium impact",
      opener: chinese ? "熟悉的餐點也可以更均衡。" : "A familiar meal can still be balanced.",
      watchOut: [{
        food: chinese ? "白飯" : "Rice",
        risk: chinese ? "份量較大時，血糖可能較快上升。" : "A large portion may raise glucose quickly.",
      }],
      positiveLine: chinese ? "蔬菜提供纖維。" : "Vegetables provide fibre.",
      rightNow: [chinese ? "先吃蔬菜。" : "Eat the vegetables first."],
      nextTime: chinese ? "下次可試少一點白飯。" : "Try a little less rice.",
    },
    ...overrides,
  };
}

async function choosePhotoAndContinue(page: Page) {
  await page.getByTestId("input-snap-album").setInputFiles(PHOTO);
  await expect(page.getByTestId("div-meal-select-chips")).toBeVisible();
  // File compression starts just before the label promise is assigned.
  // Avoid clicking inside that intentionally guarded sub-100ms window.
  await page.waitForTimeout(250);
  await page.getByTestId("button-meal-select-continue").click();
  await expect(page.getByTestId("input-snap-name")).toBeVisible();
}

async function openAdvicePopup(page: Page) {
  await page.goto("/snap");
  await choosePhotoAndContinue(page);
  await page.getByTestId("button-snap-get-advice").click();
  await expect(page.getByTestId("dialog-snap-advice-popup")).toBeVisible();
}

function expectNoHorizontalOverflow(page: Page) {
  return expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true);
}

async function installCjkScreenshotFont(page: Page) {
  await page.route("**/__test-fonts/NotoSansCJK-Regular.ttf", route => route.fulfill({
    contentType: "font/ttf",
    path: "server/assets/fonts/NotoSansCJK-Regular.ttf",
  }));
  await page.addStyleTag({
    content: `
      @font-face {
        font-family: "Screenshot Noto CJK";
        src: url("/__test-fonts/NotoSansCJK-Regular.ttf") format("truetype");
        font-display: block;
      }
      body, body * {
        font-family: "Screenshot Noto CJK", sans-serif !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.load('16px "Screenshot Noto CJK"', "繁體中文飲食報告血糖記錄");
    await document.fonts.ready;
  });
}

test.describe("reference layouts and interaction contracts", () => {
  test("captures every Traditional Chinese advice popup card and exact Skip control", async ({ page }) => {
    await useLanguage(page, "zh-Hant");
    await page.route("**/api/snap/label", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(labelPayload()),
    }));
    await page.route("**/api/snap/advice", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(advicePayload("zh-Hant")),
    }));

    await openAdvicePopup(page);
    await installCjkScreenshotFont(page);
    for (const [card, file] of [
      [0, "snap-popup-zh-Hant-card-1.png"],
      [1, "snap-popup-zh-Hant-card-2.png"],
      [2, "snap-popup-zh-Hant-card-3.png"],
    ] as const) {
      await page.getByTestId(`dot-snap-popup-${card}`).click();
      await expect(page.getByTestId(`card-snap-advice-${card}`)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOTS}/${file}`,
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.getByTestId("dot-snap-popup-0").click();
    const skip = page.getByTestId("button-snap-popup-skip");
    await expect(skip).toHaveText("略過");
    await skip.click();
    await expect(page.getByTestId("dialog-snap-advice-popup")).toHaveCount(0);
  });

  test("captures all six Traditional Chinese FoodSnap states with CJK glyphs", async ({ page }) => {
    await useLanguage(page, "zh-Hant");
    let releaseLabel!: () => void;
    const labelGate = new Promise<void>(resolve => { releaseLabel = resolve; });
    let releaseAdvice!: () => void;
    const adviceGate = new Promise<void>(resolve => { releaseAdvice = resolve; });
    await page.route("**/api/snap/label", async route => {
      await labelGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(labelPayload({
          name: "蔬菜飯",
          canonicalName: "vegetable-rice",
          portion: "中",
          sauces: "芝麻醬",
          extras: "青瓜",
        })),
      });
    });
    await page.route("**/api/snap/advice", async route => {
      await adviceGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(advicePayload("zh-Hant")),
      });
    });
    await page.route("**/api/snap/disambiguate", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ exact: false, matches: [] }),
    }));

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/snap");
    await installCjkScreenshotFont(page);
    await expect(page.getByTestId("button-snap-album")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-zh-Hant-1-upload.png`, fullPage: true });

    await page.getByTestId("input-snap-album").setInputFiles(PHOTO);
    await expect(page.getByTestId("div-meal-select-chips")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-zh-Hant-2-meal-select.png`, fullPage: true });

    await page.waitForTimeout(250);
    await page.getByTestId("button-meal-select-continue").click();
    await expect(page.getByTestId("status-snap-labeling")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-zh-Hant-3-labeling.png`, fullPage: true });
    releaseLabel();

    await expect(page.getByTestId("input-snap-name")).toHaveValue("蔬菜飯");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SCREENSHOTS}/snap-zh-Hant-4-review.png`, fullPage: true });

    await page.getByTestId("button-snap-get-advice").click();
    await expect(page.getByTestId("status-snap-advising")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-zh-Hant-5-advising.png`, fullPage: true });
    releaseAdvice();

    await expect(page.getByTestId("dialog-snap-advice-popup")).toBeVisible();
    await page.getByTestId("button-snap-popup-skip").click();
    await expect(page.getByTestId("button-snap-new-photo")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/snap-zh-Hant-6-advice.png`, fullPage: true });
  });

  test("keeps sauce and extras option selections in the advice request", async ({ page }) => {
    await useLanguage(page, "en");
    let adviceBody: Record<string, unknown> | undefined;
    await page.route("**/api/snap/label", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(labelPayload({
        comboSource: "database",
        sauceOptions: [
          { id: "sesame", label: "Sesame dressing" },
          { id: "soy", label: "Light soy" },
        ],
        toppingOptions: [
          { id: "cucumber", label: "Cucumber" },
          { id: "tofu", label: "Tofu" },
        ],
      })),
    }));
    await page.route("**/api/snap/advice", async route => {
      adviceBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(advicePayload()),
      });
    });

    await page.goto("/snap");
    await choosePhotoAndContinue(page);
    await page.getByTestId("chip-sauce-soy").click();
    await page.getByTestId("chip-topping-tofu").click();
    await page.getByTestId("button-snap-get-advice").click();
    await expect(page.getByTestId("dialog-snap-advice-popup")).toBeVisible();
    expect(adviceBody).toMatchObject({
      sauces: "Light soy",
      extras: "Tofu",
      sauceResolutions: [{ text: "Light soy", resolvedId: "soy" }],
      toppingResolutions: [{ text: "Tofu", resolvedId: "tofu" }],
    });
  });

  test("keeps manual sauce and extras text in the advice request", async ({ page }) => {
    await useLanguage(page, "en");
    let adviceBody: Record<string, unknown> | undefined;
    await page.route("**/api/snap/label", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(labelPayload({
        comboSource: "database",
        sauceOptions: [{ id: "soy", label: "Light soy" }],
        toppingOptions: [{ id: "tofu", label: "Tofu" }],
      })),
    }));
    await page.route("**/api/snap/disambiguate", async route => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        field?: string;
        text?: string;
      };
      const internalId = body.field === "sauce" ? "fixture_lemon" : "fixture_herbs";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          exact: true,
          matches: [{ internalId, label: body.text }],
        }),
      });
    });
    await page.route("**/api/snap/advice", async route => {
      adviceBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(advicePayload()),
      });
    });

    await page.goto("/snap");
    await choosePhotoAndContinue(page);
    await page.getByTestId("chip-sauce-other").click();
    await page.getByTestId("input-snap-sauces").fill("Lemon dressing");
    await page.getByTestId("chip-topping-other").click();
    await page.getByTestId("input-snap-extras").fill("Fresh herbs");
    await page.getByTestId("button-snap-get-advice").click();
    await expect(page.getByTestId("dialog-snap-advice-popup")).toBeVisible();
    expect(adviceBody).toMatchObject({
      sauces: "Lemon dressing",
      extras: "Fresh herbs",
      sauceResolutions: [{ text: "Lemon dressing", resolvedId: "fixture_lemon" }],
      toppingResolutions: [{ text: "Fresh herbs", resolvedId: "fixture_herbs" }],
    });
  });

  test("renders photo-analysis and advice quota exhaustion as distinct states", async ({ page }) => {
    await useLanguage(page, "en");
    let exhaustLabel = true;
    await page.route("**/api/snap/label", route => {
      if (exhaustLabel) {
        return route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ snapsLimit: 3 }),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(labelPayload({ snapsUsedToday: 3 })),
      });
    });
    await page.route("**/api/snap/advice", route => route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ adviceLimit: 6 }),
    }));

    await page.goto("/snap");
    await page.getByTestId("input-snap-album").setInputFiles(PHOTO);
    await expect(page.getByTestId("text-snap-error")).toContainText(
      "all 3 photo analyses",
    );
    await page.screenshot({
      path: `${SCREENSHOTS}/snap-quota-photo-exhausted.png`,
      fullPage: true,
    });

    exhaustLabel = false;
    await page.reload();
    await choosePhotoAndContinue(page);
    await expect(page.getByTestId("text-snap-counter")).toContainText(
      "all 3 photo analyses",
    );
    await page.getByTestId("button-snap-get-advice").click();
    await expect(page.getByTestId("text-snap-error")).toContainText(
      "all 6 advice requests",
    );
    await expect(page.getByTestId("text-snap-error")).not.toContainText(
      "photo analyses",
    );
    await page.screenshot({
      path: `${SCREENSHOTS}/snap-quota-advice-exhausted.png`,
      fullPage: true,
    });
  });

  for (const locale of [
    { code: "en", verdict: "Yesterday was pretty steady overall!" },
    { code: "zh-Hant", verdict: "昨天整體頗為穩定！" },
  ] as const) {
    test(`captures the final Daily report in ${locale.code}`, async ({ page }) => {
      await useLanguage(page, locale.code);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      await page.route("**/api/snap/daily-report**", route => route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          date: yesterday,
          verdict: "medium",
          meals: [
            {
              id: 9401,
              snapTime: `${yesterday}T08:30:00.000Z`,
              localDate: yesterday,
              mealType: "breakfast",
              foodName: locale.code === "en" ? "Oats and vegetables" : "燕麥配蔬菜",
              finalGlucoseImpact: "low",
              postMealGlucoseMmol: 5.8,
            },
            {
              id: 9402,
              snapTime: `${yesterday}T13:15:00.000Z`,
              localDate: yesterday,
              mealType: "lunch",
              foodName: locale.code === "en" ? "Vegetable rice bowl" : "蔬菜飯",
              finalGlucoseImpact: "medium",
              postMealGlucoseMmol: null,
            },
          ],
        }),
      }));
      await page.goto("/report");
      await expect(page.getByTestId("card-daily-food-summary")).toBeVisible();
      await expect(page.getByTestId("daily-report-mascot-message")).toContainText(locale.verdict);
      await expect(page.getByTestId("meal-timeline-item-9401")).toBeVisible();
      if (locale.code === "zh-Hant") await installCjkScreenshotFont(page);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOTS}/daily-report-${locale.code}.png`,
        fullPage: true,
      });
    });
  }

  for (const locale of [
    {
      code: "en",
      presets: [
        "After medication", "Feeling well", "Mild dizziness", "Just had a large meal",
        "Walked after meal", "Drank water", "Had vegetables", "Ate earlier",
      ],
    },
    {
      code: "zh-Hant",
      presets: [
        "服藥後", "感覺良好", "輕微頭暈", "剛吃完大餐",
        "飯後散步", "飲用清水", "有吃蔬菜", "提早用餐",
      ],
    },
    {
      code: "yue",
      presets: [
        "食藥後", "感覺幾好", "有少少頭暈", "啱啱食完大餐",
        "飯後散步", "飲咗水", "食咗菜", "早咗食飯",
      ],
    },
  ] as const) {
    test(`shows ${locale.code} HStix presets as localized text controls`, async ({ page }) => {
      await useLanguage(page, locale.code);
      await page.route("**/api/hstix/readings", route => route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ readings: [] }),
      }));
      await page.goto("/hstix");

      const presets = page.getByTestId("hstix-note-presets");
      await expect(presets).toBeVisible();
      const guidance = page.getByRole("dialog");
      if (await guidance.isVisible()) {
        await guidance.locator("button").first().click();
      }
      for (const text of locale.presets) {
        await expect(presets.getByRole("button", { name: text, exact: true })).toBeVisible();
      }
      await expect(presets.locator("img, svg")).toHaveCount(0);
      if (locale.code !== "en") await installCjkScreenshotFont(page);
      await page.screenshot({
        path: `${SCREENSHOTS}/hstix-presets-${locale.code}.png`,
        fullPage: true,
      });
    });
  }

  for (const width of [360, 390] as const) {
    test(`keeps Snap and HStix usable at ${width}px with large text`, async ({ page }) => {
      await useLanguage(page, "en");
      await page.setViewportSize({ width, height: 844 });
      await page.route("**/api/hstix/readings", route => route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ readings: [] }),
      }));
      await page.goto("/hstix");
      await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
      await expect(page.getByTestId("card-post-meal-keypad")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOTS}/hstix-large-text-${width}.png`,
        fullPage: true,
      });

      await page.goto("/snap");
      await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
      await expect(page.getByTestId("button-snap-album")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOTS}/snap-large-text-${width}.png`,
        fullPage: true,
      });
    });
  }

  test("HStix increase/decrease controls create and edit only mocked readings", async ({ page }) => {
    await useLanguage(page, "en");
    const writes: Array<{ method: string; body: Record<string, unknown> }> = [];
    const reading = {
      id: 501,
      glucoseMmol: 5.4,
      note: "Layout fixture",
      minutesSinceLastMeal: null,
      mealTimingConfidence: "unrelated",
      recordedAt: "2026-01-01T08:00:00.000Z",
      correctionExpiresAt: "2099-01-01T08:10:00.000Z",
    };
    await page.route("**/api/hstix/readings**", async (route: Route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ readings: [reading] }),
        });
      }
      writes.push({
        method,
        body: JSON.parse(route.request().postData() ?? "{}"),
      });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(reading),
      });
    });

    await page.goto("/hstix");
    const guidance = page.getByRole("dialog");
    if (await guidance.isVisible()) {
      await guidance.locator("button").first().click();
    }
    await page.getByTestId("button-post-meal-int-plus").click();
    await page.getByTestId("button-post-meal-dec-5").click();
    await expect(page.getByTestId("text-post-meal-reading")).toHaveText("11");
    await page.getByTestId("button-hstix-preset-walk").click();
    await page.getByTestId("button-post-meal-confirm-keypad").click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({
      method: "POST",
      body: { glucoseMmol: 11.5, note: "Walked after meal" },
    });

    await page.goto("/hstix?readingId=501");
    await expect(page.getByTestId("text-post-meal-reading")).toHaveText("5");
    await page.getByTestId("button-post-meal-int-minus").click();
    await page.getByTestId("button-post-meal-confirm-keypad").click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1]).toMatchObject({
      method: "PATCH",
      body: { glucoseMmol: 4.4, note: "Layout fixture" },
    });
  });
});