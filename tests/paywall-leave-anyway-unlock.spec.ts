import { test, expect } from "@playwright/test";

/**
 * Integration coverage for the gate-status round trip behind the
 * "leave-anyway → purchase" flow:
 *
 *   - POST /api/profile/hard-lock toggles hardLockedAfterAdviceDismiss
 *   - GET  /api/gate-status reflects it on the next read
 *
 * The pure decision matrix that clears the flag inside
 * /api/refresh-premium-status is unit-tested directly in
 * tests/paywall-leave-anyway-unlock.test.mts (imports the real
 * `computePremiumRefreshUpdate` helper from server/gate.ts), so this
 * spec only needs to prove the HTTP plumbing is wired up correctly.
 */

const BASE = "http://localhost:5000";
const TEST_EMAIL = `test-paywall-unlock@glukky.test`;
const TEST_PASS = "TestSpec123";

async function setupUser(request: any) {
  const reg = await request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (reg.status() === 409) {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(login.status()).toBe(200);
  } else {
    expect(reg.status()).toBe(200);
  }

  await request.post(`${BASE}/api/dev/reset-account`);

  const profile = await request.post(`${BASE}/api/profile`, {
    data: {
      walksPerWeek: 3,
      walkDuration: 20,
      dinnerTime: "before_9pm",
      sleepPattern: "regular_10_6",
      eatingOutFrequency: "1_2",
      struggles: ["sugary_food_drink"],
    },
  });
  expect(profile.status()).toBe(200);
}

test.describe("paywall hard-lock gate round trip", () => {
  test.beforeEach(async ({ request }) => {
    await setupUser(request);
  });

  test("setting hard-lock flips the gate to lockApp on next read", async ({ request }) => {
    const before = await request.get(`${BASE}/api/gate-status`);
    expect(before.status()).toBe(200);
    const beforeBody = await before.json();
    expect(beforeBody.hardLockedAfterAdviceDismiss).toBe(false);

    const set = await request.post(`${BASE}/api/profile/hard-lock`, {
      data: { optedOut: true },
    });
    expect(set.status()).toBe(200);
    const setBody = await set.json();
    expect(setBody.hardLockedAfterAdviceDismiss).toBe(true);

    const after = await request.get(`${BASE}/api/gate-status`);
    expect(after.status()).toBe(200);
    const afterBody = await after.json();
    expect(afterBody.hardLockedAfterAdviceDismiss).toBe(true);
    // Free user + hard-lock flag must produce at least one lockApp
    // feature so the client lock-app effect fires.
    if (!afterBody.isPremium) {
      const anyLockApp = Object.values(afterBody.features as Record<string, any>)
        .some((f) => f && f.lockApp === true);
      expect(anyLockApp).toBe(true);
    }
  });

  test("clearing hard-lock removes lockApp on next read", async ({ request }) => {
    await request.post(`${BASE}/api/profile/hard-lock`, {
      data: { optedOut: true },
    });

    const clear = await request.post(`${BASE}/api/profile/hard-lock`, {
      data: { optedOut: false },
    });
    expect(clear.status()).toBe(200);
    const clearBody = await clear.json();
    expect(clearBody.hardLockedAfterAdviceDismiss).toBe(false);

    const after = await request.get(`${BASE}/api/gate-status`);
    const afterBody = await after.json();
    expect(afterBody.hardLockedAfterAdviceDismiss).toBe(false);
    if (!afterBody.isPremium) {
      const anyLockApp = Object.values(afterBody.features as Record<string, any>)
        .some((f) => f && f.lockApp === true);
      expect(anyLockApp).toBe(false);
    }
  });

  test("hard-lock endpoint rejects malformed body", async ({ request }) => {
    const r = await request.post(`${BASE}/api/profile/hard-lock`, {
      data: { optedOut: "yes" },
    });
    expect(r.status()).toBe(400);
  });
});
