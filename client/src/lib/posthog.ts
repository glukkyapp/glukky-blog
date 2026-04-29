import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
    },
    persistence: "localStorage+cookie",
    loaded: () => {
      initialized = true;
    },
    debug: import.meta.env.DEV,
  });
  initialized = true;
}

export function identifyUser(
  id: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  try {
    posthog.identify(id, properties);
    if (properties && Object.keys(properties).length > 0) {
      posthog.setPersonProperties(properties);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] identify failed:", err);
  }
}

export function resetUser(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] reset failed:", err);
  }
}

export function track(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  try {
    posthog.capture(eventName, properties);
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] capture failed:", err);
  }
}

export function trackException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) return;
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));
    if (typeof (posthog as any).captureException === "function") {
      (posthog as any).captureException(err, context);
    } else {
      posthog.capture("$exception", {
        $exception_message: err.message,
        $exception_type: err.name,
        $exception_stack_trace_raw: err.stack,
        ...context,
      });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[posthog] trackException failed:", e);
  }
}
