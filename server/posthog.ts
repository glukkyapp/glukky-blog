import { PostHog } from "posthog-node";

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

export function trackServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId,
      event,
      properties,
    });
  } catch (err) {
    console.warn("[posthog/server] capture failed:", err);
  }
}

export function captureException(
  error: unknown,
  distinctId?: string,
  context?: Record<string, unknown>,
): void {
  const c = getClient();
  if (!c) return;
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));
    if (typeof (c as any).captureException === "function") {
      (c as any).captureException(err, distinctId, context);
    } else {
      c.capture({
        distinctId: distinctId || "server",
        event: "$exception",
        properties: {
          $exception_message: err.message,
          $exception_type: err.name,
          $exception_stack_trace_raw: err.stack,
          ...context,
        },
      });
    }
  } catch (e) {
    console.warn("[posthog/server] captureException failed:", e);
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
