// Health values and PII stripped before sending — MCHK Code §1.4.1
// MCHK §6 — Health data must not be used for model training, research studies, or any third-party beyond PostHog/Claude/OneSignal with explicit user consent. See replit.md "Data-use restrictions".
import { PostHog } from "posthog-node";
import { createHash } from "crypto";
import { pool } from "./db";

// Dev/internal accounts — never tracked server-side, regardless of in-app consent.
// Checked before the DB read so no capture() call ever fires for these IDs.
const DEV_USER_IDS = new Set([
  "25b37f85-0968-40b0-a49c-0fd4dff94a25", // cynthiayuyu@hotmail.com
]);

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return null;
  client = new PostHog(key, {
    host: "https://us.i.posthog.com",
    flushAt: 20,
    flushInterval: 10000,
  });
  return client;
}

function hashId(id: string | number): string {
  return createHash("sha256").update(String(id)).digest("hex");
}

function normalise(key: string): string {
  return key.toLowerCase().replace(/[_\-\s]/g, "");
}

const BLOCKED_KEYS = new Set([
  "glucose", "glucosemmol", "glucosemgdl", "mmol", "mgdl",
  "hba1c", "hba1clevel", "fastingbaseline", "fastingbaselinemmol",
  "meal", "foodname", "food", "reading", "readingvalue", "level",
  "diagnosis", "condition", "healthcondition", "glucosegroup",
  "disease", "medication", "symptom", "postmealsymptom",
  "struggle", "struggles", "sleeppattern",
  "email", "phone", "dob", "dateofbirth", "userid",
]);

function sanitise(properties?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!properties) return properties;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (!BLOCKED_KEYS.has(normalise(k))) {
      result[k] = v;
    }
  }
  return result;
}

export function trackServer(
  distinctId: string | null,
  event: string,
  properties?: Record<string, unknown>,
  consented?: boolean | null,
): void {
  if (consented === false) return;
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId: distinctId ? hashId(distinctId) : "server",
      event,
      properties: sanitise(properties),
    });
  } catch (err) {
    console.warn("[posthog/server] capture failed:", err);
  }
}

export function captureException(
  error: unknown,
  distinctId?: string | null,
  context?: Record<string, unknown>,
  consented?: boolean | null,
): void {
  if (consented === false) return;
  const c = getClient();
  if (!c) return;
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));
    const hashedId = distinctId ? hashId(distinctId) : "server";
    const cleanCtx = sanitise(context);
    if (typeof (c as any).captureException === "function") {
      (c as any).captureException(err, hashedId, cleanCtx);
    } else {
      c.capture({
        distinctId: hashedId,
        event: "$exception",
        properties: {
          $exception_message: err.message,
          $exception_type: err.name,
          $exception_stack_trace_raw: err.stack,
          ...cleanCtx,
        },
      });
    }
  } catch (e) {
    console.warn("[posthog/server] captureException failed:", e);
  }
}

export async function getPosthogConsent(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (DEV_USER_IDS.has(userId)) return false; // short-circuit — never hits DB, no capture fires
  try {
    const result = await pool.query<{ consented: boolean }>(
      `SELECT consented FROM user_consents WHERE user_id = $1 AND service_name = 'posthog' ORDER BY consented_at DESC LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].consented === true;
  } catch {
    return false;
  }
}

export async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  try {
    await client.shutdown();
  } catch (err) {
    console.warn("[posthog/server] shutdown failed:", err);
  }
}
