import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-doctor-info@glukky.test";
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

  expect((await api.post(`${BASE}/api/profile`, {
    data: { preferredLanguage: "en", healthCondition: "diabetes" },
  })).status()).toBe(200);
  expect((await api.patch(`${BASE}/api/profile/intro-seen`)).status()).toBe(200);

  await page.addInitScript(() => {
    localStorage.setItem("glukky_has_session", "1");
    localStorage.setItem("piggy_intro_skipped", "1");
    localStorage.setItem("glukky_preferred_lang", "en");
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe("My Doctor", () => {
  test.beforeEach(async ({ context, page }) => {
    await setupUser(context, page);
  });

  test("saves, reloads, and clears every optional field", async ({ context }) => {
    const api = context.request;
    const populated = {
      doctorName: "Dr Chan",
      clinicName: "Central Family Clinic",
      specialty: "Family medicine",
      officePhone: "2123 4567",
      address: "1 Queen's Road Central",
      lastVisitDate: "2026-08-20",
      notes: "Weekday appointments",
    };

    const save = await api.patch(`${BASE}/api/profile/doctor-info`, { data: populated });
    expect(save.status()).toBe(200);

    const read = await api.get(`${BASE}/api/profile/doctor-info`);
    expect(read.status()).toBe(200);
    expect(await read.json()).toMatchObject(populated);

    const clear = await api.patch(`${BASE}/api/profile/doctor-info`, {
      data: Object.fromEntries(Object.keys(populated).map((key) => [key, null])),
    });
    expect(clear.status()).toBe(200);
    expect(await clear.json()).toMatchObject(
      Object.fromEntries(Object.keys(populated).map((key) => [key, null])),
    );

    const invalidDate = await api.patch(`${BASE}/api/profile/doctor-info`, {
      data: { lastVisitDate: "20/08/2026" },
    });
    expect(invalidDate.status()).toBe(400);
  });

  test("shows four aligned shortcuts and the number-free localized form", async ({ page }) => {
    await page.goto("/profile");
    const shortcuts = page.getByTestId("profile-personal-shortcuts");
    await expect(shortcuts).toBeVisible();
    await expect(shortcuts.locator("button")).toHaveCount(4);

    const boxes = await shortcuts.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: Math.round(rect.top), width: rect.width, height: rect.height };
      }),
    );
    expect(new Set(boxes.map((box) => box.top)).size).toBe(1);
    expect(boxes.every((box) => box.width >= 70 && box.height >= 44)).toBe(true);

    await page.getByTestId("profile-shortcut-doctor").click();
    await expect(page).toHaveURL(/\/doctor-info$/);
    await expect(page.getByTestId("doctor-info-page")).toBeVisible();
    await expect(page.getByTestId("text-doctor-instruction")).toHaveText(
      "Enter the information of your family doctor here.",
    );
    await expect(page.getByTestId("text-doctor-emergency-disclaimer")).toHaveText(
      "Not for emergencies.",
    );
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByTestId("input-mobile-phone")).toHaveCount(0);
    await expect(page.getByTestId("input-emergency-number")).toHaveCount(0);
  });
});