import posthog from "posthog-js";

let initialized = false;
type Pending =
  | { kind: "identify"; id: string; properties?: Record<string, unknown> }
  | { kind: "reset" }
  | { kind: "track"; eventName: string; properties?: Record<string, unknown> }
  | { kind: "setProps"; properties: Record<string, unknown> }
  | { kind: "exception"; error: unknown; context?: Record<string, unknown> };
const pending: Pending[] = [];

function flushPending(): void {
  while (pending.length) {
    const p = pending.shift()!;
    try {
      if (p.kind === "identify") {
        posthog.identify(p.id, p.properties);
        if (p.properties && Object.keys(p.properties).length > 0) {
          posthog.setPersonProperties(p.properties);
        }
      } else if (p.kind === "reset") {
        posthog.reset();
      } else if (p.kind === "track") {
        posthog.capture(p.eventName, p.properties);
      } else if (p.kind === "setProps") {
        posthog.setPersonProperties(p.properties);
      } else if (p.kind === "exception") {
        const err =
          p.error instanceof Error
            ? p.error
            : new Error(typeof p.error === "string" ? p.error : JSON.stringify(p.error));
        if (typeof (posthog as any).captureException === "function") {
          (posthog as any).captureException(err, p.context);
        } else {
          posthog.capture("$exception", {
            $exception_message: err.message,
            $exception_type: err.name,
            $exception_stack_trace_raw: err.stack,
            ...p.context,
          });
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[posthog] flush failed:", err);
    }
  }
}

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
    session_recording: { maskAllInputs: true },
    persistence: "localStorage+cookie",
    loaded: () => {
      initialized = true;
      flushPending();
    },
    debug: import.meta.env.DEV,
  });
  initialized = true;
  flushPending();
}

export function identifyUser(
  id: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) {
    pending.push({ kind: "identify", id, properties });
    return;
  }
  try {
    posthog.identify(id, properties);
    if (properties && Object.keys(properties).length > 0) {
      posthog.setPersonProperties(properties);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] identify failed:", err);
  }
}

export function setUserProperties(properties: Record<string, unknown>): void {
  if (!properties || Object.keys(properties).length === 0) return;
  if (!initialized) {
    pending.push({ kind: "setProps", properties });
    return;
  }
  try {
    posthog.setPersonProperties(properties);
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] setPersonProperties failed:", err);
  }
}

export function resetUser(): void {
  if (!initialized) {
    pending.push({ kind: "reset" });
    return;
  }
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
  if (!initialized) {
    pending.push({ kind: "track", eventName, properties });
    return;
  }
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
  if (!initialized) {
    pending.push({ kind: "exception", error, context });
    return;
  }
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
