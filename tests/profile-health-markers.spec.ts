import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-profile-health-markers@glukky.test";
const TEST_PASS = "TestSpec123";

async function setupUser(context: BrowserContext, page: Page) {
  const api = context.request;
  let login = await api.post(`${BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (login.status() === 401) {
    login = await api.post(`${BASE}/api/auth/register`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
  }
  expect(login.status()).toBe(200);

  expect((await api.post(`${BASE}/api/dev/reset-account`)).status()).toBe(200);
  expect((await api.post(`${BASE}/api/profile`, {
    data: {
      preferredLanguage: "en",
      healthCondition: "diabetes",
    },
  })).status()).toBe(200);
  expect((await api.patch(`${BASE}/api/profile/intro-seen`)).status()).toBe(200);

  await page.addInitScript(() => {
    localStorage.setItem("glukky_has_session", "1");
    localStorage.setItem("piggy_intro_skipped", "1");
    localStorage.setItem("glukky_preferred_lang", "en");
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Profile Health Markers", () => {
  test.beforeEach(async ({ context, page }) => {
    await setupUser(context, page);
  });

  test("does not expose an HbA1c entry point in any supported locale", async ({ page }) => {
    const locales = [
      { code: "en", healthMarkers: "Health Markers", lastBloodTest: "Last blood test", diabetesStatus: "Diabetes status" },
      { code: "zh-Hant", healthMarkers: "健康指標", lastBloodTest: "上次驗血", diabetesStatus: "糖尿病狀況" },
      { code: "yue", healthMarkers: "健康指標", lastBloodTest: "上次驗血", diabetesStatus: "糖尿病狀況" },
    ];

    await page.goto("/profile");
    await expect(page.getByTestId("profile-page")).toBeVisible();

    for (const locale of locales) {
      if (locale.code !== "en") {
        await page.getByTestId(`button-lang-${locale.code}`).click();
      }
      const healthCard = page.getByTestId("card-health-markers");
      await expect(healthCard).toContainText(locale.healthMarkers);
      await expect(healthCard).toContainText(locale.lastBloodTest);
      await expect(healthCard).toContainText(locale.diabetesStatus);
      await expect(healthCard).not.toContainText(/HbA1c|糖化血色素/);
      await expect(healthCard.getByTestId("input-hba1c")).toHaveCount(0);
      await expect(healthCard.getByTestId("button-edit-hba1c")).toHaveCount(0);
      await expect(healthCard.locator('input[type="number"]')).toHaveCount(0);
    }
  });

  test("keeps blood-test-date save and clear interactions working", async ({ page }) => {
    const requestBodies: unknown[] = [];
    await page.route("**/api/profile/health-markers", async (route) => {
      if (route.request().method() === "PATCH") {
        requestBodies.push(JSON.parse(route.request().postData() ?? "null"));
      }
      await route.continue();
    });

    await page.goto("/profile");
    const healthCard = page.getByTestId("card-health-markers");
    await expect(healthCard).toBeVisible();

    await healthCard.getByTestId("button-edit-blood-test-date").click();
    await healthCard.getByTestId("input-blood-test-date").fill("2026-09-02");
    await page.getByTestId("text-profile-heading").click();
    await expect.poll(() => requestBodies).toHaveLength(1);
    expect(requestBodies[0]).toEqual({ bloodTestDate: "2026-09-02" });

    await healthCard.getByTestId("button-edit-blood-test-date").click();
    await healthCard.getByTestId("input-blood-test-date").fill("");
    await page.getByTestId("text-profile-heading").click();
    await expect.poll(() => requestBodies).toHaveLength(2);
    expect(requestBodies[1]).toEqual({ bloodTestDate: null });
  });

  test("keeps legacy HbA1c values intact when updating only the blood-test date", async ({ context }) => {
    const api = context.request;
    const legacyValue = await api.patch(`${BASE}/api/profile/health-markers`, {
      data: { hba1cLevel: 6.5 },
    });
    expect(legacyValue.status()).toBe(200);
    expect((await legacyValue.json()).hba1cLevel).toBe(6.5);

    const dateUpdate = await api.patch(`${BASE}/api/profile/health-markers`, {
      data: { bloodTestDate: "2026-09-02" },
    });
    expect(dateUpdate.status()).toBe(200);
    const dateUpdateBody = await dateUpdate.json();
    expect(dateUpdateBody.hba1cLevel).toBe(6.5);
    expect(dateUpdateBody.bloodTestDate).toBe("2026-09-02");

    const invalidDate = await api.patch(`${BASE}/api/profile/health-markers`, {
      data: { bloodTestDate: "09/02/2026" },
    });
    expect(invalidDate.status()).toBe(400);
  });
});