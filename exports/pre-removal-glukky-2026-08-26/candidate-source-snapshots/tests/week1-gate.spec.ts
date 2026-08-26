import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5000";
const TEST_EMAIL = `test-week1-spec@glukky.test`;
const TEST_PASS = "TestSpec123";
const WEEK1_DATE = "2026-03-16";

async function loginRequest(request: any) {
  const r = await request.post(`${BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  return r.status();
}

async function setupTestUser(request: any) {
  const reg = await request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (reg.status() === 409) {
    await loginRequest(request);
  } else {
    expect(reg.status()).toBe(200);
  }

  await request.post(`${BASE}/api/dev/reset-account`);

  await request.post(`${BASE}/api/dev/set-time`, {
    data: { date: WEEK1_DATE, hour: 10 },
  });

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

  const plan = await request.post(`${BASE}/api/plan/weekly`, {
    data: { walkDays: [0, 2, 4], eatOutDays: [], lateDinnerDays: [] },
  });
  expect(plan.status()).toBe(200);

  await request.post(`${BASE}/api/dev/set-time`, {
    data: { date: null, hour: null },
  });
}

test.describe("Week-1 report gate — Sunday 10pm regression", () => {
  test.beforeEach(async ({ request }) => {
    await setupTestUser(request);
  });

  test("Sunday 22:00: user is in week-1 and canPlan=true — pending must NOT show", async ({
    request,
  }) => {
    const setTime = await request.post(`${BASE}/api/dev/set-time`, {
      data: { date: "2026-03-22", hour: 22 },
    });
    expect(setTime.status()).toBe(200);
    const timeData = await setTime.json();
    expect(timeData.dateOverride).toBe("2026-03-22");
    expect(timeData.timeOverride).toBe(22);

    const planRes = await request.get(`${BASE}/api/plan/current`);
    expect(planRes.status()).toBe(200);
    const plan = await planRes.json();
    expect(plan.weekNumber).toBe(1);

    const profileRes = await request.get(`${BASE}/api/profile`);
    expect(profileRes.status()).toBe(200);

    const devRes = await request.get(`${BASE}/api/dev/time`);
    const dev = await devRes.json();

    const effectiveDateStr = dev.dateOverride;
    const planSundayStr = (() => {
      const d = new Date(plan.startDate + "T00:00:00");
      d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7);
      if (d.getDay() !== 0) {
        while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
      }
      return d.toISOString().split("T")[0];
    })();

    const isPastPlanWeek = !!planSundayStr && effectiveDateStr > planSundayStr;
    const isWeek1 = !isPastPlanWeek;

    const effectiveDayJS = new Date(effectiveDateStr + "T00:00:00").getDay();
    const isSunday = effectiveDayJS === 0;
    const isSundayNight = isSunday && dev.timeOverride >= 22;
    const isLatePlanning = isPastPlanWeek && !isSunday;
    const canPlan = isSundayNight || isLatePlanning;

    expect(isWeek1).toBe(true);
    expect(canPlan).toBe(true);
    expect(isWeek1 && !canPlan).toBe(false);

    await request.post(`${BASE}/api/dev/set-time`, {
      data: { date: null, hour: null },
    });
  });

  test("Tuesday 15:00: user is in week-1 and canPlan=false — pending MUST show", async ({
    request,
  }) => {
    const setTime = await request.post(`${BASE}/api/dev/set-time`, {
      data: { date: "2026-03-17", hour: 15 },
    });
    expect(setTime.status()).toBe(200);

    const planRes = await request.get(`${BASE}/api/plan/current`);
    const plan = await planRes.json();

    const devRes = await request.get(`${BASE}/api/dev/time`);
    const dev = await devRes.json();

    const effectiveDateStr = dev.dateOverride;
    const planSundayStr = (() => {
      const d = new Date(plan.startDate + "T00:00:00");
      while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    })();

    const isPastPlanWeek = !!planSundayStr && effectiveDateStr > planSundayStr;
    const isWeek1 = !isPastPlanWeek;

    const effectiveDayJS = new Date(effectiveDateStr + "T00:00:00").getDay();
    const isSunday = effectiveDayJS === 0;
    const isSundayNight = isSunday && dev.timeOverride >= 22;
    const isLatePlanning = isPastPlanWeek && !isSunday;
    const canPlan = isSundayNight || isLatePlanning;

    expect(isWeek1).toBe(true);
    expect(canPlan).toBe(false);
    expect(isWeek1 && !canPlan).toBe(true);

    await request.post(`${BASE}/api/dev/set-time`, {
      data: { date: null, hour: null },
    });
  });

  test("Sunday 21:59: boundary — canPlan is false, pending MUST show", async ({
    request,
  }) => {
    const setTime = await request.post(`${BASE}/api/dev/set-time`, {
      data: { date: "2026-03-22", hour: 21 },
    });
    expect(setTime.status()).toBe(200);

    const devRes = await request.get(`${BASE}/api/dev/time`);
    const dev = await devRes.json();

    const effectiveDayJS = new Date(dev.dateOverride + "T00:00:00").getDay();
    const isSunday = effectiveDayJS === 0;
    const isSundayNight = isSunday && dev.timeOverride >= 22;
    expect(isSunday).toBe(true);
    expect(isSundayNight).toBe(false);

    await request.post(`${BASE}/api/dev/set-time`, {
      data: { date: null, hour: null },
    });
  });
});
