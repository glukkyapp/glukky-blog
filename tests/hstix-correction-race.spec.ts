import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-hstix-correction-race@glukky.test";
const TEST_PASS = "TestSpec123";
const READING_ID = 987654;

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
    data: {
    },
  })).status()).toBe(200);
  await api.patch(`${BASE}/api/profile/intro-seen`);
  await page.addInitScript(() => localStorage.setItem("glukky_has_session", "1"));
}

test.use({ viewport: { width: 390, height: 844 } });

test("an in-flight expired correction closes once and never falls back to POST", async ({ context, page }) => {
  await setupUser(context, page);
  await page.addInitScript(() => {
    const expiryMessage = "This reading can no longer be changed.";
    const seen = new WeakSet<Element>();
    const testWindow = window as Window & { hstixExpiryToastCount?: number };
    testWindow.hstixExpiryToastCount = 0;
    new MutationObserver(records => {
      const countToast = (node: Node) => {
        const element = node.nodeType === Node.ELEMENT_NODE
          ? node as Element
          : node.parentElement;
        const toast = element?.closest('li[role="status"]');
        if (toast?.textContent?.includes(expiryMessage) && !seen.has(toast)) {
          seen.add(toast);
          testWindow.hstixExpiryToastCount = (testWindow.hstixExpiryToastCount ?? 0) + 1;
        }
      };
      for (const record of records) {
        for (const node of record.addedNodes) {
          countToast(node);
          if (node.nodeType === Node.ELEMENT_NODE) {
            node.querySelectorAll?.('li[role="status"]').forEach(countToast);
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  let hstixListCalls = 0;
  const hstixRequests: Array<{ method: string; pathname: string }> = [];
  const correctionExpiresAt = new Date(Date.now() + 3000).toISOString();
  await page.route("**/api/hstix/readings**", async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    hstixRequests.push({ method: request.method(), pathname });

    if (pathname === `/api/hstix/readings/${READING_ID}`) {
      expect(request.method()).toBe("PATCH");
      await new Promise(resolve => setTimeout(resolve, 2650));
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: "HSTIX_CORRECTION_EXPIRED",
          message: "This reading can no longer be changed.",
        }),
      });
    }

    expect(pathname).toBe("/api/hstix/readings");
    expect(request.method()).toBe("GET");
    hstixListCalls += 1;
    return route.fulfill({
      contentType: "application/json",
      // Home and the HStix sheet both read the correction window. Keep the
      // same reading available across those two legitimate GETs so the sheet
      // submits its update as a PATCH instead of treating the reading as new.
      body: JSON.stringify(hstixListCalls <= 2 ? {
        readings: [{
          id: READING_ID,
          glucoseMmol: 6.1,
          note: null,
          recordedAt: new Date().toISOString(),
          mealSnapId: null,
          mealTimingConfidence: "unrelated",
          correctionExpiresAt,
        }],
        latestCorrectableReading: {
          id: READING_ID,
          glucoseMmol: 6.1,
          note: null,
          recordedAt: new Date().toISOString(),
          correctionExpiresAt,
        },
      } : { readings: [], latestCorrectableReading: null }),
    });
  });

  await page.goto("/");
  await page.getByTestId("button-home-hstix-change").click();
  await page.getByTestId("button-post-meal-confirm-keypad").click();

  await expect.poll(() => hstixRequests.some(request =>
    request.method === "PATCH" && request.pathname === `/api/hstix/readings/${READING_ID}`,
  )).toBe(true);
  const expiryNotice = page.getByText("This reading can no longer be changed.");
  await expect(expiryNotice).toHaveCount(1, { timeout: 4000 });
  await expect(page).toHaveURL(/\/hstix$/);
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(() => window.hstixExpiryToastCount)).toBe(1);
  expect(hstixRequests.filter(request => request.pathname === `/api/hstix/readings/${READING_ID}`))
    .toEqual([{ method: "PATCH", pathname: `/api/hstix/readings/${READING_ID}` }]);
  expect(hstixRequests.some(request => request.method === "POST")).toBe(false);
});