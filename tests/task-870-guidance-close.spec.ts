import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-task-870-guidance@glukky.test";
const TEST_PASS = "TestSpec123";

async function setupUser(context: BrowserContext, page: Page) {
  const api = context.request;
  let response = await api.post(`${BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (response.status() === 401) {
    response = await api.post(`${BASE}/api/auth/register`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
  }
  expect(response.status()).toBe(200);
  expect((await api.post(`${BASE}/api/profile`, { data: {} })).status()).toBe(200);
  await api.patch(`${BASE}/api/profile/intro-seen`);
  await page.addInitScript(() => localStorage.setItem("glukky_has_session", "1"));
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("every guidance close method dismisses immediately and sends one acknowledgement", async ({ context, page }) => {
  await setupUser(context, page);
  let acknowledgementCount = 0;

  await page.route("**/api/hstix/readings", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ readings: [] }),
  }));
  await page.route("**/api/user/glucose-guidance/**", async route => {
    if (route.request().method() === "POST") {
      acknowledgementCount++;
      // Deliberately leave the request unresolved. Closing a controlled dialog
      // must not wait for the acknowledgement network round trip.
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ kind: "hstix", seen: false }),
    });
  });

  const openFreshVisit = async () => {
    await page.goto("/hstix");
    await expect(page.getByTestId("dialog-glucose-guidance-hstix")).toBeVisible();
    await expect(page.getByTestId("text-glucose-guidance-inline-hstix")).toHaveCount(0);
  };
  const expectClosedOnce = async (expectedCount: number) => {
    await expect(page.getByTestId("dialog-glucose-guidance-hstix")).toHaveCount(0);
    await expect(page.getByTestId("text-glucose-guidance-inline-hstix")).toBeVisible();
    await expect.poll(() => acknowledgementCount).toBe(expectedCount);
  };

  await openFreshVisit();
  await page.getByTestId("button-glucose-guidance-got-it").click();
  await expectClosedOnce(1);

  await openFreshVisit();
  await page.keyboard.press("Escape");
  await expectClosedOnce(2);

  await openFreshVisit();
  await page.getByRole("button", { name: "Close" }).click();
  await expectClosedOnce(3);

  await openFreshVisit();
  await page.mouse.click(5, 5);
  await expectClosedOnce(4);
});