// Health values and PII stripped before sending — MCHK Code §1.4.1
import posthog from "posthog-js";

let initialized = false;

const INTERNAL_EMAILS = new Set(["cynthiayuyu@hotmail.com"]);
type Pending =
  | { kind: "identify"; id: string; properties?: Record<string, unknown> }
  | { kind: "reset" }
  | { kind: "track"; eventName: string; properties?: Record<string, unknown> }
  | { kind: "setProps"; properties: Record<string, unknown> }
  | { kind: "exception"; error: unknown; context?: Record<string, unknown> };
const pending: Pending[] = [];

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

function flushPending(): void {
  while (pending.length) {
    const p = pending.shift()!;
    try {
      if (p.kind === "identify") {
        const clean = sanitise(p.properties);
        posthog.identify(p.id, clean);
        if (clean && Object.keys(clean).length > 0) {
          posthog.setPersonProperties(clean);
        }
      } else if (p.kind === "reset") {
        posthog.reset();
      } else if (p.kind === "track") {
        posthog.capture(p.eventName, sanitise(p.properties));
      } else if (p.kind === "setProps") {
        posthog.setPersonProperties(sanitise(p.properties) ?? {});
      } else if (p.kind === "exception") {
        const err =
          p.error instanceof Error
            ? p.error
            : new Error(typeof p.error === "string" ? p.error : JSON.stringify(p.error));
        const cleanCtx = sanitise(p.context);
        if (typeof (posthog as any).captureException === "function") {
          (posthog as any).captureException(err, cleanCtx);
        } else {
          posthog.capture("$exception", {
            $exception_message: err.message,
            $exception_type: err.name,
            $exception_stack_trace_raw: err.stack,
            ...cleanCtx,
          });
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[posthog] flush failed:", err);
    }
  }
}

export function optOut(): void {
  try { posthog.opt_out_capturing(); } catch (e) {
    if (import.meta.env.DEV) console.warn("[posthog] opt_out_capturing failed:", e);
  }
}

export function optIn(): void {
  try { posthog.opt_in_capturing(); } catch (e) {
    if (import.meta.env.DEV) console.warn("[posthog] opt_in_capturing failed:", e);
  }
}

export function initPostHog(consented = true): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  if (!consented) {
    posthog.opt_out_capturing();
  }

  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
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
  email?: string | null,
): void {
  if (email && INTERNAL_EMAILS.has(email.toLowerCase())) {
    try { posthog.opt_out_capturing(); } catch (e) { /* silent */ }
    return;
  }
  const clean = sanitise(properties);
  if (!initialized) {
    pending.push({ kind: "identify", id, properties: clean });
    return;
  }
  try {
    posthog.identify(id, clean);
    if (clean && Object.keys(clean).length > 0) {
      posthog.setPersonProperties(clean);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] identify failed:", err);
  }
}

export function setUserProperties(properties: Record<string, unknown>): void {
  if (!properties || Object.keys(properties).length === 0) return;
  const clean = sanitise(properties) ?? {};
  if (Object.keys(clean).length === 0) return;
  if (!initialized) {
    pending.push({ kind: "setProps", properties: clean });
    return;
  }
  try {
    posthog.setPersonProperties(clean);
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
  const clean = sanitise(properties);
  if (!initialized) {
    pending.push({ kind: "track", eventName, properties: clean });
    return;
  }
  try {
    posthog.capture(eventName, clean);
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[posthog] capture failed:", err);
  }
}

export function trackException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const clean = sanitise(context);
  if (!initialized) {
    pending.push({ kind: "exception", error, context: clean });
    return;
  }
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));
    if (typeof (posthog as any).captureException === "function") {
      (posthog as any).captureException(err, clean);
    } else {
      posthog.capture("$exception", {
        $exception_message: err.message,
        $exception_type: err.name,
        $exception_stack_trace_raw: err.stack,
        ...clean,
      });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[posthog] trackException failed:", e);
  }
}
