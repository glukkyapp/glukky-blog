import {
  test,
  expect,
  request as createRequestContext,
  type APIRequestContext,
} from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-harbour-garden@glukky.test";
const TEST_PASS = "TestSpec123";

test("photo mode renders its starting state, preloads the set, and shows one full-size photo", async ({ browser }) => {
  const api: APIRequestContext = await createRequestContext.newContext();
  const login = await api.post(`${BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  expect(login.status()).toBe(200);
  const storageState = await api.storageState();
  await api.dispose();

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState,
  });
  const page = await context.newPage();
  const loadedPhotos = new Set<string>();
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/reward-photos/1970s-1/") && response.ok()) {
      loadedPhotos.add(path);
    }
  });

  expect((await page.request.post(`${BASE}/api/dev/reset-account`)).status()).toBe(200);
  expect((await page.request.post(`${BASE}/api/profile`, { data: {} })).status()).toBe(200);
  expect((await page.request.post(`${BASE}/api/piggybank/mode`, {
    data: { mode: "photo" },
  })).status()).toBe(200);

  await page.goto(BASE);
  const frame = page.locator('[data-testid="photo-display"]');
  await expect(frame).toBeVisible();
  await expect(frame.locator("img")).toHaveCount(1);
  await expect(frame.locator("img")).toHaveAttribute("alt", "");
  await expect(frame.locator("img")).toHaveClass(/opacity-20/);
  const startingAriaLabel = await frame.getAttribute("aria-label");
  expect(startingAriaLabel).toBeTruthy();
  await expect(page.locator('[data-testid="photo-copyright-disclaimer"]')).toBeVisible();

  expect((await page.request.post(`${BASE}/api/dev/set-coins`, {
    data: { coins: 25 },
  })).status()).toBe(200);
  await page.reload();
  await expect(frame.locator("img")).toHaveCount(1);
  await expect(frame.locator("img")).toHaveAttribute("src", /1970s-1/);
  await expect(frame).not.toHaveAttribute("aria-label", startingAriaLabel!);
  await expect.poll(() => loadedPhotos.size).toBe(12);

  const surface = await frame.evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      ratio: rect.width / rect.height,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    };
  });
  expect(surface.ratio).toBeCloseTo(1376 / 768, 1);
  expect(surface.borderRadius).not.toBe("0px");
  expect(surface.boxShadow).not.toBe("none");

  await page.locator('[data-testid="card-harbour-garden"]').screenshot({
    path: "/tmp/reward-card-957.png",
  });
  await page.request.post(`${BASE}/api/dev/reset-account`);
  await page.request.post(`${BASE}/api/profile`, { data: {} });
  await context.close();
});