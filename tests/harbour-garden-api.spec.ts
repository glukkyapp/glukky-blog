import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-harbour-garden@glukky.test";
const TEST_PASS = "TestSpec123";

async function setupUser(request: any) {
  const registration = await request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (registration.status() === 409) {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(login.status()).toBe(200);
  } else {
    expect(registration.status()).toBe(200);
  }

  expect((await request.post(`${BASE}/api/dev/reset-account`)).status()).toBe(200);
  expect((await request.post(`${BASE}/api/profile`, { data: {} })).status()).toBe(200);
}

test.describe("Harbour Garden API safeguards", () => {
  test.beforeEach(async ({ request }) => {
    await setupUser(request);
  });

  test("development presets persist on the existing capped balance", async ({ request }) => {
    for (const coins of [0, 1, 5, 7, 11, 16, 20, 25, 31, 35, 40, 46, 55, 60]) {
      const set = await request.post(`${BASE}/api/dev/set-coins`, { data: { coins } });
      expect(set.status()).toBe(200);
      expect((await set.json()).coins).toBe(coins);

      const garden = await request.get(`${BASE}/api/piggybank`);
      expect(garden.status()).toBe(200);
      expect((await garden.json()).coins).toBe(coins);
    }
  });

  test("development setter rejects invalid values", async ({ request }) => {
    for (const coins of [-1, 61, 1.5, null, "5"]) {
      const response = await request.post(`${BASE}/api/dev/set-coins`, {
        data: { coins },
      });
      expect(response.status()).toBe(400);
    }
  });

  test("legacy reward and claim routes are inert and never reset completion", async ({ request }) => {
    expect((await request.post(`${BASE}/api/dev/set-coins`, { data: { coins: 60 } })).status()).toBe(200);

    const reward = await request.post(`${BASE}/api/piggybank/reward`, {
      data: { reward: "legacy reward" },
    });
    expect(reward.status()).toBe(410);

    const claim = await request.post(`${BASE}/api/piggybank/claim`, { data: {} });
    expect(claim.status()).toBe(410);

    const garden = await request.get(`${BASE}/api/piggybank`);
    expect((await garden.json()).coins).toBe(60);
  });
});