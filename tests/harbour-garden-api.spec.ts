import {
  test,
  expect,
  request as createRequestContext,
  type APIRequestContext,
} from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = "test-harbour-garden@glukky.test";
const TEST_PASS = "TestSpec123";

async function setupUser(request: any) {
  const registration = await request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (registration.status() === 409 || registration.status() === 429) {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(login.status()).toBe(200);
  } else {
    expect(registration.status()).toBe(200);
  }

}

test.describe("Harbour Garden API safeguards", () => {
  let request: APIRequestContext;

  test.beforeAll(async () => {
    request = await createRequestContext.newContext();
    await setupUser(request);
  });

  test.beforeEach(async () => {
    expect((await request.post(`${BASE}/api/dev/reset-account`)).status()).toBe(200);
    expect((await request.post(`${BASE}/api/profile`, { data: {} })).status()).toBe(200);
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  test("development presets persist on the existing capped balance", async () => {
    for (const coins of [0, 1, 5, 7, 11, 16, 20, 25, 31, 35, 40, 46, 55, 60]) {
      const set = await request.post(`${BASE}/api/dev/set-coins`, { data: { coins } });
      expect(set.status()).toBe(200);
      expect((await set.json()).coins).toBe(coins);

      const garden = await request.get(`${BASE}/api/piggybank`);
      expect(garden.status()).toBe(200);
      expect(await garden.json()).toMatchObject({
        coins,
        gardensCompleted: 0,
        visualSetId: "harbour-garden-v1",
      });
    }
  });

  test("development setter rejects invalid values", async () => {
    for (const coins of [-1, 61, 1.5, null, "5"]) {
      const response = await request.post(`${BASE}/api/dev/set-coins`, {
        data: { coins },
      });
      expect(response.status()).toBe(400);
    }
  });

  test("legacy reward and claim routes are inert and never reset completion", async () => {
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

  test("new garden requires completion and strictly validates the visual set", async () => {
    const incomplete = await request.post(`${BASE}/api/piggybank/start-new-garden`, {
      data: { visualSetId: "harbour-garden-v1" },
    });
    expect(incomplete.status()).toBe(409);
    expect(await incomplete.json()).toMatchObject({ code: "garden_not_complete" });

    for (const data of [{}, { visualSetId: "future-garden" }, { visualSetId: "harbour-garden-v1", extra: true }]) {
      const invalid = await request.post(`${BASE}/api/piggybank/start-new-garden`, { data });
      expect(invalid.status()).toBe(400);
    }
  });

  test("concurrent new-garden requests reset once and count one completed garden", async () => {
    expect((await request.post(`${BASE}/api/dev/set-coins`, { data: { coins: 60 } })).status()).toBe(200);
    const [first, second] = await Promise.all([
      request.post(`${BASE}/api/piggybank/start-new-garden`, {
        data: { visualSetId: "harbour-garden-v1" },
      }),
      request.post(`${BASE}/api/piggybank/start-new-garden`, {
        data: { visualSetId: "harbour-garden-v1" },
      }),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([200, 409]);

    const successful = first.status() === 200 ? first : second;
    expect(await successful.json()).toMatchObject({
      started: true,
      coins: 0,
      capacity: 60,
      gardensCompleted: 1,
      visualSetId: "harbour-garden-v1",
    });
    expect(await (await request.get(`${BASE}/api/piggybank`)).json()).toMatchObject({
      coins: 0,
      gardensCompleted: 1,
    });
  });

  test("daily task completion persists and awards the shared balance once", async () => {
    const initial = await request.get(`${BASE}/api/daily-task`);
    expect(initial.status()).toBe(200);
    const state = await initial.json();
    expect(state.tasks).toHaveLength(3);
    expect(new Set(state.tasks).size).toBe(3);
    expect(state.completedTaskId).toBeNull();

    const selected = state.tasks[0];
    const complete = await request.post(`${BASE}/api/daily-task`, { data: { taskId: selected } });
    expect(complete.status()).toBe(200);
    expect(await complete.json()).toMatchObject({
      completedTaskId: selected,
      awarded: 1,
      alreadyCompleted: false,
    });
    expect((await (await request.get(`${BASE}/api/piggybank`)).json()).coins).toBe(1);

    const duplicate = await request.post(`${BASE}/api/daily-task`, { data: { taskId: selected } });
    expect(duplicate.status()).toBe(200);
    expect(await duplicate.json()).toMatchObject({
      completedTaskId: selected,
      awarded: 0,
      alreadyCompleted: true,
    });
    expect((await (await request.get(`${BASE}/api/piggybank`)).json()).coins).toBe(1);

    const reload = await request.get(`${BASE}/api/daily-task`);
    expect(await reload.json()).toMatchObject({ completedTaskId: selected });
  });

  test("daily completion at capacity persists without a ledger award", async () => {
    expect((await request.post(`${BASE}/api/dev/set-coins`, { data: { coins: 60 } })).status()).toBe(200);
    const state = await (await request.get(`${BASE}/api/daily-task`)).json();
    const complete = await request.post(`${BASE}/api/daily-task`, { data: { taskId: state.tasks[0] } });
    expect(complete.status()).toBe(200);
    expect(await complete.json()).toMatchObject({
      completedTaskId: state.tasks[0],
      awarded: 0,
      alreadyCompleted: false,
    });
    expect((await (await request.get(`${BASE}/api/piggybank`)).json()).coins).toBe(60);
  });

  test("concurrent daily completions cannot award twice or replace the winner", async () => {
    const state = await (await request.get(`${BASE}/api/daily-task`)).json();
    const [first, second] = await Promise.all([
      request.post(`${BASE}/api/daily-task`, { data: { taskId: state.tasks[0] } }),
      request.post(`${BASE}/api/daily-task`, { data: { taskId: state.tasks[1] } }),
    ]);
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    const results = [await first.json(), await second.json()];
    expect(results.map((result) => result.awarded).sort()).toEqual([0, 1]);
    expect(new Set(results.map((result) => result.completedTaskId)).size).toBe(1);
    expect((await (await request.get(`${BASE}/api/piggybank`)).json()).coins).toBe(1);
  });
});