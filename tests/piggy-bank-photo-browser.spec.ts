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
  await expect(frame).not.toHaveAttribute("type", "button");
  await frame.click();
  await expect(page.locator('[data-testid="photo-expanded-dialog"]')).toHaveCount(0);

  expect((await page.request.post(`${BASE}/api/dev/set-coins`, {
    data: { coins: 25 },
  })).status()).toBe(200);
  await page.reload();
  await expect(frame.locator("img")).toHaveCount(1);
  await expect(frame.locator("img")).toHaveAttribute("src", /1970s-1/);
  await expect(frame).not.toHaveAttribute("aria-label", startingAriaLabel!);
  await expect(frame).toHaveAttribute("type", "button");
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

  await frame.click();
  const dialog = page.locator('[data-testid="photo-expanded-dialog"]');
  const expandedImage = page.locator('[data-testid="photo-expanded-image"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("roadmap.photo_dialog_title")).toHaveCount(0);
  await expect(expandedImage).toHaveClass(/object-contain/);
  await expect(page.locator('[data-testid="photo-expanded-attribution"]')).toBeVisible();
  await dialog.screenshot({ path: "/tmp/reward-photo-dialog-960.png" });
  const leakedTranslationKeys = await page.locator("body").evaluate(body =>
    Array.from(body.querySelectorAll("*")).flatMap(element => [
      element.textContent ?? "",
      element.getAttribute("aria-label") ?? "",
    ]).filter(value => value.includes("roadmap.photo_")),
  );
  expect(leakedTranslationKeys).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await frame.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await frame.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await page.locator('[data-testid="card-harbour-garden"]').screenshot({
    path: "/tmp/reward-card-957.png",
  });
  await page.request.post(`${BASE}/api/dev/reset-account`);
  await page.request.post(`${BASE}/api/profile`, { data: {} });
  await context.close();
});

test("first-point photo mode cache result uses photo popup copy", async ({ browser }) => {
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
  let awarded = false;

  await page.route("**/api/piggybank", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        coins: awarded ? 1 : 0,
        capacity: 60,
        gardensCompleted: 0,
        visualSetId: "harbour-garden-v1",
        reward: null,
        needsRewardSetup: false,
        mode: awarded ? "photo" : null,
        modeAutoAssigned: awarded,
        photoSetIndex: 0,
        unlockedPhotoCount: 0,
        cycleId: 1,
        presentationScope: "popup-mode-regression",
        canForceMode: false,
      }),
    });
  });
  await page.route("**/api/daily-task", async route => {
    if (route.request().method() === "POST") {
      awarded = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ completed: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        localDate: "2026-09-14",
        tasks: ["post_meal_walk"],
        completedTaskId: awarded ? "post_meal_walk" : null,
      }),
    });
  });

  await page.goto(BASE);
  const dailyTask = page.locator('[data-testid="daily-task-post_meal_walk"]');
  await expect(dailyTask).toBeVisible();
  await dailyTask.getByRole("checkbox").click();

  const popup = page.locator('[data-testid="popup-coin-saved"]');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Your Old Hong Kong photo collection grew");
  await expect(popup).not.toContainText("Your garden grew");

  await context.close();
});