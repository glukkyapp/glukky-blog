export interface CustomerInfo {
  activeSubscriptions?: string[];
  entitlements?: { active?: Record<string, unknown> };
  originalAppUserId?: string | null;
  // RC iOS SDK exposes both spellings depending on version.
  original_app_user_id?: string | null;
  latestExpirationDate?: string | null;
  latest_expiration_date?: string | null;
}

export interface CustomerInfoDetail {
  bridgePresent: boolean;
  available: boolean;
  originalAppUserId: string | null;
  latestExpirationDate: string | null;
  activeSubscriptions: string[];
  activeEntitlementKeys: string[];
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

interface OfferingProduct {
  priceString?: string;
  price?: number;
  currencyCode?: string;
}

interface OfferingProductWithId extends OfferingProduct {
  identifier?: string;
}

interface OfferingPackage {
  product?: OfferingProductWithId;
  identifier?: string;
  packageType?: string;
}

interface OfferingsResult {
  current?: {
    identifier?: string;
    monthly?: OfferingPackage;
    annual?: OfferingPackage;
    availablePackages?: OfferingPackage[];
  } | null;
  all?: Record<
    string,
    {
      identifier?: string;
      availablePackages?: OfferingPackage[];
    }
  >;
  error?: string;
}

export interface OfferingsSummary {
  bridgePresent: boolean;
  available: boolean;
  reason?: string;
  currentOfferingIdentifier: string | null;
  offeringIdentifiers: string[];
  productIdentifiers: string[];
}

export interface NativelyPurchasesInstance {
  purchasePackage(packageId: string, callback: (result: { error?: string; cancelled?: boolean; customerInfo?: CustomerInfo }) => void): void;
  restorePurchases(callback: (result: { error?: string; customerInfo?: CustomerInfo }) => void): void;
  getCustomerInfo(callback: (result: CustomerInfo | null) => void): void;
  getOfferings?(callback: (result: OfferingsResult | null) => void): void;
  logIn?(appUserId: string, callback: (result: { customerInfo?: CustomerInfo; created?: boolean; error?: string }) => void): void;
  getAppUserID?(callback: (id: string | null) => void): void;
  getAppUserId?(callback: (id: string | null) => void): void;
}

export type PriceSource =
  | "live-current-monthly"
  | "live-availablePackages-monthly"
  | "live-availablePackages-firstPriced"
  | "null-no-bridge"
  | "null-no-getOfferings"
  | "null-timeout"
  | "null-error"
  | "null-no-current"
  | "null-no-monthly-package"
  | "null-empty-string";

export interface MonthlyPriceResult {
  priceString: string | null;
  source: PriceSource;
  durationMs: number;
  rawOfferings?: OfferingsResult | null;
  errorMessage?: string;
}

const PRICE_FETCH_TIMEOUT_MS = 8000;
const LOG_TAG = "[paywall-price]";

// One diag POST per page load. The paywall can be opened repeatedly; we
// only need the first failure signature to figure out which of the six
// null sources is firing on a given device build.
let diagSent = false;

function sendPriceDiag(payload: Record<string, unknown>): void {
  if (diagSent) return;
  diagSent = true;
  try {
    fetch("/api/diag/paywall-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort; never break price resolution because diag failed
  }
}

// Last-seen offering snapshot from getMonthlyPriceDetails. Captured on
// every fetch (success or failure) so the purchase-trace start event
// can include the client-side offering identifiers for the server's
// project-mismatch detector.
export interface OfferingSnapshot {
  source: PriceSource;
  currentOfferingIdentifier: string | null;
  offeringIdentifiers: string[];
  packageIdentifiers: string[];
  hasCurrent: boolean;
  hasMonthly: boolean;
}

let lastOfferingSnapshot: OfferingSnapshot | null = null;

function buildOfferingSnapshot(
  result: MonthlyPriceResult,
): OfferingSnapshot {
  const raw = result.rawOfferings;
  const current = raw?.current ?? null;
  const offeringIdentifiers: string[] = [];
  const packageIdentifiers: string[] = [];
  try {
    if (current?.identifier) offeringIdentifiers.push(current.identifier);
    if (raw?.all) {
      for (const k of Object.keys(raw.all)) {
        if (!offeringIdentifiers.includes(k)) offeringIdentifiers.push(k);
      }
    }
    const pkgs = current?.availablePackages || [];
    for (const p of pkgs) {
      if (p?.identifier) packageIdentifiers.push(p.identifier);
    }
    if (current?.monthly?.identifier && !packageIdentifiers.includes(current.monthly.identifier)) {
      packageIdentifiers.push(current.monthly.identifier);
    }
  } catch {
    // best-effort summary
  }
  return {
    source: result.source,
    currentOfferingIdentifier: current?.identifier ?? null,
    offeringIdentifiers,
    packageIdentifiers,
    hasCurrent: Boolean(current),
    hasMonthly: Boolean(current?.monthly),
  };
}

export function getLastOfferingSnapshot(): OfferingSnapshot | null {
  return lastOfferingSnapshot;
}

// Trace correlation id generator. Short, URL-safe, collision-resistant
// enough for an in-memory ring buffer keyed by client.
export function generateTraceId(): string {
  const a = Math.random().toString(16).slice(2, 8);
  const b = Math.random().toString(16).slice(2, 8);
  return (a + b).padEnd(12, "0").slice(0, 12);
}

// Fire-and-forget purchase-trace POST. Same shape as sendPriceDiag —
// best-effort, swallow errors, never break the purchase flow because a
// diagnostic call failed. Server logs one line per phase and appends to
// the in-memory ring buffer surfaced by /api/diag/rc-state.
export function postPurchaseTrace(
  id: string,
  phase: string,
  t: number,
  data: Record<string, unknown>,
  extras?: { clientOfferingIdentifiers?: string[]; clientPackageIdentifiers?: string[] },
): void {
  try {
    fetch("/api/diag/purchase-trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, phase, t, data, ...(extras ?? {}) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort
  }
}

export interface RcStateDiag {
  replitUserId: string;
  webhookConfigured: boolean;
  subscriberProbe: {
    source: string;
    hasPremium: boolean;
    httpStatus: number;
    originalAppUserId: string | null;
  };
  serverOfferings: {
    available: boolean;
    offeringIdentifiers: string[];
  };
  projectMismatchSuspected: boolean;
}

// Best-effort fetch of the server-side RC state diagnostic. Used to
// build the cause string appended to a failed purchase / restore toast
// so the user can read the actionable cause without the dev panel.
export async function fetchRcStateDiag(): Promise<RcStateDiag | null> {
  try {
    const resp = await fetch("/api/diag/rc-state", {
      method: "GET",
      credentials: "include",
    });
    if (!resp.ok) return null;
    return (await resp.json()) as RcStateDiag;
  } catch {
    return null;
  }
}

function isNonEmptyPrice(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

interface NativelyPurchasesConstructor {
  new(): NativelyPurchasesInstance;
}

declare global {
  interface Window {
    NativelyPurchases?: NativelyPurchasesConstructor;
  }
}

function hasNativelyPurchases(): boolean {
  return typeof window.NativelyPurchases === "function";
}

export function isNativelyAvailable(): boolean {
  return hasNativelyPurchases();
}

const ANON_ID_PREFIX = "$RCAnonymousID:";

function looksAnonymous(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ANON_ID_PREFIX) && value.length > ANON_ID_PREFIX.length;
}

function readOriginalAppUserId(info: CustomerInfo | null | undefined): string | null {
  if (!info) return null;
  const v = info.originalAppUserId ?? info.original_app_user_id ?? null;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Ask the server to attach an anonymous RC subscriber id (the
 * `original_app_user_id` we got back from the bridge after
 * purchase / restore) to the signed-in Replit user id. This is the
 * server-side aliasing path that replaces the wrapper's missing
 * `Set Customer ID` capability.
 *
 * No-op (resolves silently) when:
 * - There is no anonymous id to attach.
 * - The id already matches the signed-in Replit user id (alias unnecessary).
 * - The bridge isn't present (web preview).
 *
 * Failures are logged and swallowed so they don't block the existing
 * verify-retry loop.
 */
export interface AliasAttemptResult {
  attempted: boolean;
  aliased: boolean;
  source: string;
  httpStatus?: number | null;
  anonymousAppUserId: string | null;
}

export async function aliasAnonymousIfNeeded(
  customerInfo: CustomerInfo | null | undefined,
  replitUserId: string | null | undefined,
): Promise<AliasAttemptResult> {
  if (!replitUserId) {
    return { attempted: false, aliased: false, source: "no_user", anonymousAppUserId: null };
  }
  const anonymousId = readOriginalAppUserId(customerInfo);
  if (!anonymousId) {
    return { attempted: false, aliased: false, source: "no_anon_id", anonymousAppUserId: null };
  }
  if (!looksAnonymous(anonymousId)) {
    return {
      attempted: false,
      aliased: false,
      source: "not_anon_format",
      anonymousAppUserId: anonymousId,
    };
  }
  if (anonymousId === replitUserId) {
    return {
      attempted: false,
      aliased: false,
      source: "already_replit_id",
      anonymousAppUserId: anonymousId,
    };
  }
  try {
    const resp = await fetch("/api/revenuecat/alias-anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ anonymousAppUserId: anonymousId }),
    });
    if (!resp.ok) {
      console.warn(`[revenuecat] alias-anonymous failed: HTTP ${resp.status}`);
      return {
        attempted: true,
        aliased: false,
        source: `http_${resp.status}`,
        httpStatus: resp.status,
        anonymousAppUserId: anonymousId,
      };
    }
    const data = await resp.json().catch(() => null);
    console.log(
      `[revenuecat] alias-anonymous result aliased=${data?.aliased ?? "?"} source=${data?.source ?? "?"}`,
    );
    return {
      attempted: true,
      aliased: Boolean(data?.aliased),
      source: typeof data?.source === "string" ? data.source : "unknown",
      httpStatus: resp.status,
      anonymousAppUserId: anonymousId,
    };
  } catch (e: any) {
    console.warn("[revenuecat] alias-anonymous error:", e?.message || e);
    return {
      attempted: true,
      aliased: false,
      source: "network_error",
      anonymousAppUserId: anonymousId,
    };
  }
}

export function purchasePackage(packageId: string): Promise<PurchaseResult> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases() || !window.NativelyPurchases) {
      return resolve({ success: false, error: "not_native" });
    }
    try {
      const purchases = new window.NativelyPurchases();
      purchases.purchasePackage(packageId, (result) => {
        // Never unlock premium from purchase callback alone.
        // Only unlock when RevenueCat customerInfo shows an active premium entitlement.
        const customerInfo = result?.customerInfo || null;
        const hasPremium = isPremiumFromCustomerInfo(customerInfo);

        if (result?.error) {
          resolve({ success: false, error: result.error });
        } else if (result?.cancelled) {
          resolve({ success: false, error: "cancelled" });
        } else if (customerInfo && hasPremium) {
          resolve({ success: true, customerInfo });
        } else {
          // Apple confirmed (no error, no cancel) but customerInfo
          // doesn't yet show the entitlement. This is the typical
          // 2–5s Apple → StoreKit → RevenueCat propagation gap in
          // sandbox. Surface it as a distinct result so the paywall
          // can poll the server's verifier instead of silently
          // collapsing into "cancelled".
          resolve({
            success: false,
            error: "pending_verification",
            customerInfo: customerInfo || undefined,
          });
        }
      });
    } catch (e: unknown) {
      resolve({ success: false, error: e instanceof Error ? e.message : "unknown" });
    }
  });
}

export function restorePurchases(): Promise<RestoreResult> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases() || !window.NativelyPurchases) {
      return resolve({ success: false, error: "not_native" });
    }
    let purchases: NativelyPurchasesInstance;
    try {
      purchases = new window.NativelyPurchases();
    } catch (e: unknown) {
      return resolve({ success: false, error: e instanceof Error ? e.message : "unknown" });
    }
    // Older Build Natively wrappers (and the iOS web preview shim) do not
    // implement restorePurchases. Calling it then throws a confusing
    // "purchases.restorePurchases is not a function" instead of failing
    // gracefully. Detect missing method up front so the paywall can fall
    // back to a forced server-side verify and the verdict badge can
    // distinguish "user pressed Restore but bridge has no method" from
    // a genuine RC-side failure.
    const restoreFn = (purchases as any).restorePurchases;
    if (typeof restoreFn !== "function") {
      return resolve({ success: false, error: "restore_not_supported" });
    }
    // Bound the wait so a never-firing callback can't hang the paywall
    // forever — the wrapper has been observed to silently drop the
    // restore callback in some sandbox states.
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ success: false, error: "restore_timeout" });
    }, 15000);
    try {
      restoreFn.call(purchases, (result: { error?: string; customerInfo?: CustomerInfo }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (result?.error) {
          resolve({ success: false, error: result.error });
        } else {
          resolve({ success: true, customerInfo: result?.customerInfo || undefined });
        }
      });
    } catch (e: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, error: e instanceof Error ? e.message : "unknown" });
    }
  });
}

// ---------------------------------------------------------------------------
// Anonymous-id capture sequence (Task #486 self-healing).
//
// After every purchase or restore, RevenueCat assigns the buyer an
// `$RCAnonymousID:…` record that we MUST be able to read back so the
// server can alias it to the signed-in Replit user id. The Build Natively
// wrapper exposes (or is supposed to expose) several routes to that id:
//
//   1. The CustomerInfo callback returned by purchasePackage / restore
//   2. A fresh getCustomerInfo() round-trip
//   3. A bridge-side getAppUserID() / getAppUserId() accessor
//
// In sandbox we have observed each of these returning null on different
// devices for different reasons (timing, missing method, wrapper version).
// Walking them in order — and recording which one yielded the id — turns
// "anon id never obtained" from a silent dead-end into an actionable
// signal in the trace, AND raises the success rate of the alias step
// because a single working route is enough.
// ---------------------------------------------------------------------------

export type AnonCaptureMethod =
  | "purchase_callback"
  | "getCustomerInfo"
  | "getAppUserID"
  | "getAppUserId"
  | "getOriginalAppUserId"
  | "getAnonymousId"
  | "getAnonymousID";

export interface AnonCaptureAttempt {
  method: AnonCaptureMethod;
  // What the method actually returned, classified for the trace whitelist:
  //   - "anon"   → an `$RCAnonymousID:…` value (success)
  //   - "real"   → a non-anonymous string (e.g. a real Replit user id)
  //   - "null"   → the method returned but with no usable id
  //   - "missing"→ the method does not exist on the bridge instance
  //   - "timeout"→ the callback never fired within the bound
  //   - "error"  → the call threw or the wrapper signaled an error
  outcome: "anon" | "real" | "null" | "missing" | "timeout" | "error";
}

export interface AnonCaptureResult {
  anonymousAppUserId: string | null;
  capturedBy: AnonCaptureMethod | null;
  attempts: AnonCaptureAttempt[];
}

const CAPTURE_STEP_TIMEOUT_MS = 4000;

function classifyId(value: unknown): "anon" | "real" | "null" {
  if (typeof value !== "string" || value.length === 0) return "null";
  return looksAnonymous(value) ? "anon" : "real";
}

// One bridge-method call, bounded with a per-step timeout so a hung
// callback in any single accessor cannot block the whole sequence.
function callWithTimeout<T>(
  fn: ((cb: (v: T) => void) => void) | undefined,
  timeoutMs: number,
): Promise<{ outcome: "value" | "missing" | "timeout" | "error"; value?: T; error?: string }> {
  return new Promise((resolve) => {
    if (typeof fn !== "function") return resolve({ outcome: "missing" });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ outcome: "timeout" });
    }, timeoutMs);
    try {
      fn((v: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ outcome: "value", value: v });
      });
    } catch (e: any) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ outcome: "error", error: e?.message || "unknown" });
    }
  });
}

// Typed view over the wrapper instance — every accessor we attempt is
// declared optional so we can read it without `any` and the missing
// case is naturally a `typeof === "function"` check. The accessors
// share a single callback signature: `(cb: (value) => void) => void`.
type StringIdAccessor = (cb: (v: string | null) => void) => void;
type CustomerInfoAccessor = (cb: (v: CustomerInfo | null) => void) => void;

interface BridgeAccessors {
  getCustomerInfo?: CustomerInfoAccessor;
  getAppUserID?: StringIdAccessor;
  getAppUserId?: StringIdAccessor;
  getOriginalAppUserId?: StringIdAccessor;
  getAnonymousId?: StringIdAccessor;
  getAnonymousID?: StringIdAccessor;
}

// Bind a bridge accessor to its `this` so we can pass it through
// `callWithTimeout`. Returns `undefined` if the method does not exist
// (the wrapper version on this device does not ship it). Generic over
// the value type (string id vs CustomerInfo).
function bindAccessor<T>(
  instance: BridgeAccessors,
  fn: ((cb: (v: T) => void) => void) | undefined,
): ((cb: (v: T) => void) => void) | undefined {
  if (typeof fn !== "function") return undefined;
  return (cb: (v: T) => void) => fn.call(instance, cb);
}

// Order matters: when more than one accessor returns an anon id in
// parallel we pick the winner by this priority. `purchase_callback`
// is handled before the parallel block.
const STRING_ACCESSOR_PRIORITY: Array<keyof BridgeAccessors> = [
  "getAppUserID",
  "getAppUserId",
  "getOriginalAppUserId",
  "getAnonymousId",
  "getAnonymousID",
];

export async function captureAnonymousIdSequence(
  purchaseCallbackInfo: CustomerInfo | null | undefined,
): Promise<AnonCaptureResult> {
  const attempts: AnonCaptureAttempt[] = [];

  // 1) Whatever came back on the purchase / restore callback. Free, no
  // round-trip, but often null on the first sandbox purchase.
  const fromCallback = readOriginalAppUserId(purchaseCallbackInfo ?? null);
  attempts.push({ method: "purchase_callback", outcome: classifyId(fromCallback) });
  if (fromCallback && looksAnonymous(fromCallback)) {
    return { anonymousAppUserId: fromCallback, capturedBy: "purchase_callback", attempts };
  }

  // 2) Bridge missing → record every remaining method as missing for
  // a legible trace and bail.
  const allBridgeMethods: AnonCaptureMethod[] = [
    "getCustomerInfo",
    ...STRING_ACCESSOR_PRIORITY,
  ];
  if (!hasNativelyPurchases() || !window.NativelyPurchases) {
    for (const method of allBridgeMethods) attempts.push({ method, outcome: "missing" });
    return { anonymousAppUserId: fromCallback, capturedBy: null, attempts };
  }

  let purchases: NativelyPurchasesInstance | null = null;
  try {
    purchases = new window.NativelyPurchases();
  } catch {
    for (const method of allBridgeMethods) attempts.push({ method, outcome: "error" });
    return { anonymousAppUserId: fromCallback, capturedBy: null, attempts };
  }

  // Typed view of the wrapper instance — no `any` cast.
  const bridge = purchases as unknown as BridgeAccessors;

  // 3) Fire every read-only accessor in parallel. Each call is bounded
  // by `CAPTURE_STEP_TIMEOUT_MS`, so the whole capture step is bounded
  // by ~CAPTURE_STEP_TIMEOUT_MS regardless of how many wrapper
  // accessors are present, instead of `count × timeout` worst-case.
  // This keeps the unlock path fast on partial bridges.
  const ciPromise = callWithTimeout<CustomerInfo | null>(
    bindAccessor<CustomerInfo | null>(bridge, bridge.getCustomerInfo),
    CAPTURE_STEP_TIMEOUT_MS,
  );
  const stringPromises = STRING_ACCESSOR_PRIORITY.map((name) =>
    callWithTimeout<string | null>(
      bindAccessor<string | null>(bridge, bridge[name] as StringIdAccessor | undefined),
      CAPTURE_STEP_TIMEOUT_MS,
    ),
  );
  const [ciRes, ...stringResList] = await Promise.all([ciPromise, ...stringPromises]);

  // Resolve outcomes in priority order: getCustomerInfo first (most
  // reliable + carries the originalAppUserId field), then each string
  // accessor in declared priority. First anon hit wins.
  let captured: { id: string; method: AnonCaptureMethod } | null = null;

  if (ciRes.outcome === "missing" || ciRes.outcome === "timeout" || ciRes.outcome === "error") {
    attempts.push({ method: "getCustomerInfo", outcome: ciRes.outcome });
  } else {
    const ciId = readOriginalAppUserId(ciRes.value ?? null);
    attempts.push({ method: "getCustomerInfo", outcome: classifyId(ciId) });
    if (!captured && ciId && looksAnonymous(ciId)) {
      captured = { id: ciId, method: "getCustomerInfo" };
    }
  }

  STRING_ACCESSOR_PRIORITY.forEach((name, i) => {
    const res = stringResList[i];
    const method = name as AnonCaptureMethod;
    if (res.outcome === "missing" || res.outcome === "timeout" || res.outcome === "error") {
      attempts.push({ method, outcome: res.outcome });
      return;
    }
    const cls = classifyId(res.value);
    attempts.push({ method, outcome: cls });
    if (!captured && cls === "anon" && typeof res.value === "string") {
      captured = { id: res.value, method };
    }
  });

  if (captured !== null) {
    const hit = captured as { id: string; method: AnonCaptureMethod };
    return { anonymousAppUserId: hit.id, capturedBy: hit.method, attempts };
  }

  return {
    anonymousAppUserId: null,
    capturedBy: null,
    attempts,
  };
}

// Compact one-line summary of a capture sequence for the trace event,
// e.g. "purchase_callback:null|getCustomerInfo:anon".
export function summarizeCaptureSequence(result: AnonCaptureResult): string {
  return result.attempts.map((a) => `${a.method}:${a.outcome}`).join("|").slice(0, 120);
}

// ---------------------------------------------------------------------------
// Bridge probe (Task #486).
//
// A finer-grained version of the boolean "bridgePresent" check. For each
// method the paywall depends on we record exactly how it failed —
// "missing" (not on the instance), "null" (returned with no value),
// "timeout" (callback never fired) or "value" (returned something) —
// so a stuck purchase can be diagnosed from the trace alone instead of
// requiring an over-the-shoulder TestFlight session.
// ---------------------------------------------------------------------------

export type BridgeMethodOutcome = "missing" | "null" | "timeout" | "value" | "error";

export interface BridgeProbeResult {
  bridgePresent: boolean;
  methods: Record<string, BridgeMethodOutcome>;
  // Per-method returned value (truncated, redacted) for read-only methods.
  // Side-effect methods get null here because we never invoke them.
  values: Record<string, string | null>;
  // Compact "purchasePackage:value|restorePurchases:missing" string for the trace.
  summary: string;
}

// Probed methods. Includes the canonical names exposed by Build Natively
// plus the alternative names other RevenueCat wrappers (Cordova, Capacitor,
// React Native) historically use, so a future re-export that switches
// names is detected immediately.
const PROBE_METHODS = [
  "getCustomerInfo",
  "getOfferings",
  "getAppUserID",
  "getAppUserId",
  "getOriginalAppUserId",
  "getAnonymousId",
  "getAnonymousID",
  "logIn",
  "purchasePackage",
  "restorePurchases",
] as const;

// Maximum per-value length recorded in the probe. Returned values are
// JSON-stringified, then truncated. Anonymous ids are kept verbatim
// (they're the whole point), but big customerInfo blobs get cut to 200
// chars so a single probe doesn't blow up the trace ring buffer.
const VALUE_TRUNCATE_LEN = 200;

function summarizeProbeValue(method: string, raw: unknown): string | null {
  if (raw == null) return null;
  // For anonymous / app-user-id callers, just stringify the value
  // directly — these are short and the WHOLE diagnostic point is to
  // see them.
  if (typeof raw === "string") return raw.slice(0, VALUE_TRUNCATE_LEN);
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  // For customerInfo / offerings, pull out the most diagnostic field
  // (originalAppUserId or current offering id) and stringify a small
  // shape. JSON.stringify can throw on cycles, so guard.
  try {
    if (method === "getCustomerInfo") {
      const ci = raw as Record<string, unknown>;
      const oid = (ci.originalAppUserId ?? ci.original_app_user_id ?? null) as string | null;
      const ents = ci.entitlements as { active?: Record<string, unknown> } | undefined;
      const activeEnts = ents?.active ? Object.keys(ents.active) : [];
      return JSON.stringify({ originalAppUserId: oid, activeEntitlements: activeEnts }).slice(
        0,
        VALUE_TRUNCATE_LEN,
      );
    }
    if (method === "getOfferings") {
      const o = raw as Record<string, unknown>;
      const cur = (o.current as Record<string, unknown> | undefined)?.identifier ?? null;
      const all = o.all && typeof o.all === "object" ? Object.keys(o.all as object) : [];
      return JSON.stringify({ current: cur, all }).slice(0, VALUE_TRUNCATE_LEN);
    }
    return JSON.stringify(raw).slice(0, VALUE_TRUNCATE_LEN);
  } catch {
    return "[unserialisable]";
  }
}

export async function probeBridgeMethods(): Promise<BridgeProbeResult> {
  const methods: Record<string, BridgeMethodOutcome> = {};
  const values: Record<string, string | null> = {};
  const present = hasNativelyPurchases();
  if (!present || !window.NativelyPurchases) {
    for (const m of PROBE_METHODS) {
      methods[m] = "missing";
      values[m] = null;
    }
    return {
      bridgePresent: false,
      methods,
      values,
      summary: PROBE_METHODS.map((m) => `${m}:missing`).join("|"),
    };
  }

  let purchases: NativelyPurchasesInstance;
  try {
    purchases = new window.NativelyPurchases();
  } catch {
    for (const m of PROBE_METHODS) {
      methods[m] = "error";
      values[m] = null;
    }
    return {
      bridgePresent: true,
      methods,
      values,
      summary: PROBE_METHODS.map((m) => `${m}:error`).join("|"),
    };
  }

  // For purchase-flow methods (purchasePackage, logIn, restorePurchases)
  // we MUST NOT actually invoke them — that would charge the user or
  // trigger a real RC round-trip with side effects. Existence-only check.
  const sideEffectMethods: ReadonlyArray<string> = ["purchasePackage", "logIn", "restorePurchases"];

  for (const m of PROBE_METHODS) {
    const fn = (purchases as any)[m];
    if (typeof fn !== "function") {
      methods[m] = "missing";
      values[m] = null;
      continue;
    }
    if (sideEffectMethods.includes(m)) {
      methods[m] = "value"; // present, not invoked
      values[m] = null;
      continue;
    }
    // Read-only callback methods can be invoked safely.
    const res = await callWithTimeout<unknown>(
      (cb: (v: unknown) => void) => fn.call(purchases, cb),
      3000,
    );
    if (res.outcome === "value") {
      methods[m] = res.value == null ? "null" : "value";
      values[m] = summarizeProbeValue(m, res.value);
    } else {
      methods[m] = res.outcome;
      values[m] = null;
    }
  }

  const summary = PROBE_METHODS.map((m) => `${m}:${methods[m]}`).join("|").slice(0, 240);
  return { bridgePresent: true, methods, values, summary };
}

// ---------------------------------------------------------------------------
// Install id (Task #486).
//
// A stable, anonymous, per-browser-install UUID kept in localStorage and
// stamped onto every trace / probe POST. Lets us correlate a user's
// successful purchase with the exact device install in the deployment
// log, even after the user signs out and back in. Not a tracking id —
// it never leaves the trace pipeline and is never written to the user
// profile.
// ---------------------------------------------------------------------------

const INSTALL_ID_KEY = "glukky.installId";

interface CryptoLike {
  randomUUID?: () => string;
}

function generateUuid(): string {
  try {
    const c = (globalThis as { crypto?: CryptoLike }).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // fall through to manual generation
  }
  // RFC4122-ish fallback for environments without crypto.randomUUID.
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) {
    s += hex[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) s += "-";
  }
  return s;
}

export function getInstallId(): string {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return "no-storage";
  }
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing && existing.length > 0) return existing;
    const fresh = generateUuid();
    window.localStorage.setItem(INSTALL_ID_KEY, fresh);
    return fresh;
  } catch {
    return "storage-error";
  }
}

export function getCustomerInfoDetail(): Promise<CustomerInfoDetail> {
  return new Promise((resolve) => {
    const empty: CustomerInfoDetail = {
      bridgePresent: hasNativelyPurchases(),
      available: false,
      originalAppUserId: null,
      latestExpirationDate: null,
      activeSubscriptions: [],
      activeEntitlementKeys: [],
    };
    if (!hasNativelyPurchases() || !window.NativelyPurchases) return resolve(empty);
    let purchases: NativelyPurchasesInstance;
    try {
      purchases = new window.NativelyPurchases();
    } catch {
      return resolve(empty);
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(empty);
    }, 5000);
    try {
      purchases.getCustomerInfo((info) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!info) return resolve(empty);
        const orig = info.originalAppUserId ?? info.original_app_user_id ?? null;
        const exp = info.latestExpirationDate ?? info.latest_expiration_date ?? null;
        resolve({
          bridgePresent: true,
          available: true,
          originalAppUserId: typeof orig === "string" && orig.length > 0 ? orig : null,
          latestExpirationDate: typeof exp === "string" && exp.length > 0 ? exp : null,
          activeSubscriptions: Array.isArray(info.activeSubscriptions) ? info.activeSubscriptions : [],
          activeEntitlementKeys: info.entitlements?.active ? Object.keys(info.entitlements.active) : [],
        });
      });
    } catch {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(empty);
    }
  });
}

export function getOfferingsSummary(): Promise<OfferingsSummary> {
  return new Promise((resolve) => {
    const empty = (reason?: string): OfferingsSummary => ({
      bridgePresent: hasNativelyPurchases(),
      available: false,
      reason,
      currentOfferingIdentifier: null,
      offeringIdentifiers: [],
      productIdentifiers: [],
    });
    if (!hasNativelyPurchases() || !window.NativelyPurchases) return resolve(empty("no-bridge"));
    let purchases: NativelyPurchasesInstance;
    try {
      purchases = new window.NativelyPurchases();
    } catch (e: unknown) {
      return resolve(empty(`error: ${e instanceof Error ? e.message : "unknown"}`));
    }
    if (typeof purchases.getOfferings !== "function") return resolve(empty("no-getOfferings"));
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(empty("timeout"));
    }, 6000);
    try {
      purchases.getOfferings((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!result) return resolve(empty("null-result"));
        if (result.error) return resolve(empty(`error: ${result.error}`));
        const offeringIdentifiers = new Set<string>();
        const productIdentifiers = new Set<string>();
        const collect = (pkgs?: OfferingPackage[]) => {
          for (const p of pkgs || []) {
            const pid = p?.product?.identifier;
            if (typeof pid === "string" && pid.length > 0) productIdentifiers.add(pid);
          }
        };
        const cur = result.current;
        if (cur?.identifier) offeringIdentifiers.add(cur.identifier);
        if (cur) {
          collect(cur.availablePackages);
          if (cur.monthly) collect([cur.monthly]);
          if (cur.annual) collect([cur.annual]);
        }
        if (result.all) {
          for (const [k, v] of Object.entries(result.all)) {
            if (v?.identifier) offeringIdentifiers.add(v.identifier);
            else if (k) offeringIdentifiers.add(k);
            collect(v?.availablePackages);
          }
        }
        resolve({
          bridgePresent: true,
          available: true,
          currentOfferingIdentifier: cur?.identifier ?? null,
          offeringIdentifiers: Array.from(offeringIdentifiers).sort(),
          productIdentifiers: Array.from(productIdentifiers).sort(),
        });
      });
    } catch (e: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(empty(`error: ${e instanceof Error ? e.message : "unknown"}`));
    }
  });
}

export function getCustomerInfo(): Promise<CustomerInfo | null> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases() || !window.NativelyPurchases) {
      return resolve(null);
    }
    try {
      const purchases = new window.NativelyPurchases();
      purchases.getCustomerInfo((result) => {
        resolve(result || null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Resolve the monthly price details from RevenueCat with bounded latency
 * and observable failure paths. Always resolves; never hangs.
 *
 * Every null path is logged once with the [paywall-price] tag so future
 * regressions surface in Safari Web Inspector / Natively logs without
 * code changes.
 */
export function getMonthlyPriceDetails(): Promise<MonthlyPriceResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const finish = (r: Omit<MonthlyPriceResult, "durationMs">) => {
      const out: MonthlyPriceResult = { ...r, durationMs: Date.now() - startedAt };
      // Cache an offering snapshot on every fetch (success OR null) so
      // the purchase-trace start event and project-mismatch detector
      // always see the most recent client-side identifiers.
      const snapshot = buildOfferingSnapshot(out);
      lastOfferingSnapshot = snapshot;
      if (out.priceString === null) {
        // eslint-disable-next-line no-console
        console.warn(`${LOG_TAG} resolved null`, {
          source: out.source,
          durationMs: out.durationMs,
          errorMessage: out.errorMessage,
        });
        // Also surface to the server so we can read the cause from the
        // deployment log without needing an in-device Web Inspector.
        sendPriceDiag({
          source: out.source,
          durationMs: out.durationMs,
          errorMessage: out.errorMessage ?? null,
          currentOfferingIdentifier: snapshot.currentOfferingIdentifier,
          offeringIdentifiers: snapshot.offeringIdentifiers,
          packageIdentifiers: snapshot.packageIdentifiers,
          hasCurrent: snapshot.hasCurrent,
          hasMonthly: snapshot.hasMonthly,
          ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
      }
      resolve(out);
    };

    if (!hasNativelyPurchases() || !window.NativelyPurchases) {
      return finish({ priceString: null, source: "null-no-bridge" });
    }

    let purchases: NativelyPurchasesInstance;
    try {
      purchases = new window.NativelyPurchases();
    } catch (e: unknown) {
      return finish({
        priceString: null,
        source: "null-error",
        errorMessage: e instanceof Error ? e.message : "unknown",
      });
    }

    if (typeof purchases.getOfferings !== "function") {
      return finish({ priceString: null, source: "null-no-getOfferings" });
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      finish({ priceString: null, source: "null-timeout" });
    }, PRICE_FETCH_TIMEOUT_MS);

    try {
      purchases.getOfferings((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const current = result?.current;
        if (!current) {
          return finish({ priceString: null, source: "null-no-current", rawOfferings: result });
        }

        const direct = current.monthly?.product?.priceString;
        if (isNonEmptyPrice(direct)) {
          return finish({
            priceString: direct.trim(),
            source: "live-current-monthly",
            rawOfferings: result,
          });
        }

        const packages = current.availablePackages || [];
        const monthlyPkg = packages.find(
          (p) => p?.identifier === "$rc_monthly" || p?.packageType === "MONTHLY",
        );
        let monthlyPkgEmpty = false;
        if (monthlyPkg) {
          const ps = monthlyPkg.product?.priceString;
          if (isNonEmptyPrice(ps)) {
            return finish({
              priceString: ps.trim(),
              source: "live-availablePackages-monthly",
              rawOfferings: result,
            });
          }
          // Monthly package exists but priceString is empty/whitespace —
          // remember and fall through to first priced package as a last
          // resort before bailing out.
          monthlyPkgEmpty = true;
        }

        const firstPriced = packages.find((p) => isNonEmptyPrice(p?.product?.priceString));
        if (firstPriced && isNonEmptyPrice(firstPriced.product?.priceString)) {
          return finish({
            priceString: (firstPriced.product!.priceString as string).trim(),
            source: "live-availablePackages-firstPriced",
            rawOfferings: result,
          });
        }

        if (monthlyPkgEmpty) {
          return finish({
            priceString: null,
            source: "null-empty-string",
            rawOfferings: result,
          });
        }

        return finish({
          priceString: null,
          source: "null-no-monthly-package",
          rawOfferings: result,
        });
      });
    } catch (e: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      finish({
        priceString: null,
        source: "null-error",
        errorMessage: e instanceof Error ? e.message : "unknown",
      });
    }
  });
}


export function isPremiumFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const subs = info.activeSubscriptions || [];
  if (subs.length > 0) return true;
  const active = info.entitlements?.active;
  if (active && Object.keys(active).length > 0) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Identity (logIn / getAppUserId)
//
// The iOS RevenueCat SDK records purchases against whatever app-user-id
// it currently knows. If we never call logIn(replitUserId), every
// purchase is attributed to an anonymous "$RCAnonymousID:…" record and
// the server's verifyEntitlement(replitUserId) will always return 404.
//
// We track the most recent in-flight / completed logIn so the paywall
// can gate the subscribe button on identity being ready for *this*
// user. On the web (no bridge) identity is treated as ready so the
// gate doesn't permanently block anything.
// ---------------------------------------------------------------------------

const RESTORED_ONCE_PREFIX = "rc_restored_once_";

type LoginResult = { ok: boolean; error?: string };

let currentLoginRef:
  | { userId: string; promise: Promise<LoginResult>; ready: boolean; result?: LoginResult }
  | null = null;
const identityListeners = new Set<() => void>();

function notifyIdentity() {
  identityListeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function subscribeIdentity(fn: () => void): () => void {
  identityListeners.add(fn);
  return () => { identityListeners.delete(fn); };
}

export function isIdentityReadyFor(userId: string | undefined | null): boolean {
  if (!userId) return false;
  // No bridge → identity is a no-op. Treat as ready so callers don't
  // permanently block on the web preview path.
  if (!hasNativelyPurchases()) return true;
  return currentLoginRef?.userId === userId && currentLoginRef.ready;
}

export interface IdentityState {
  userId: string | null;
  ready: boolean;
  bridgePresent: boolean;
  lastResult: LoginResult | null;
}

export function getIdentityState(): IdentityState {
  return {
    userId: currentLoginRef?.userId ?? null,
    ready: !!currentLoginRef?.ready,
    bridgePresent: hasNativelyPurchases(),
    lastResult: currentLoginRef?.result ?? null,
  };
}

function doLogIn(appUserId: string): Promise<LoginResult> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases() || !window.NativelyPurchases) {
      return resolve({ ok: false, error: "not_native" });
    }
    let purchases: NativelyPurchasesInstance;
    try {
      purchases = new window.NativelyPurchases();
    } catch (e: unknown) {
      return resolve({ ok: false, error: e instanceof Error ? e.message : "unknown" });
    }
    if (typeof purchases.logIn !== "function") {
      console.warn("[revenuecat] NativelyPurchases.logIn not exposed by bridge");
      return resolve({ ok: false, error: "no_login_method" });
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn("[revenuecat] logIn timed out");
      resolve({ ok: false, error: "timeout" });
    }, 8000);
    try {
      purchases.logIn(appUserId, (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (result?.error) {
          console.warn("[revenuecat] logIn error:", result.error);
          resolve({ ok: false, error: result.error });
        } else {
          resolve({ ok: true });
        }
      });
    } catch (e: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: e instanceof Error ? e.message : "unknown" });
    }
  });
}

export function ensureIdentified(appUserId: string): Promise<LoginResult> {
  if (!appUserId) return Promise.resolve({ ok: false, error: "no_user" });
  if (!hasNativelyPurchases()) return Promise.resolve({ ok: true });
  if (currentLoginRef?.userId === appUserId) return currentLoginRef.promise;

  const promise = doLogIn(appUserId).then(async (res) => {
    if (currentLoginRef?.userId === appUserId) {
      // Identity is "ready" ONLY when logIn actually succeeded.
      // Previously we also treated `no_login_method` as ready so the
      // subscribe button wasn't permanently blocked on older Natively
      // builds — but per Build Natively's RevenueCat docs, a wrapper
      // without `Set Customer ID` records every purchase against an
      // anonymous `$RCAnonymousID:…` and the server's
      // verifyEntitlement(replitUserId) will always 404. Allowing the
      // button through in that state silently takes the user's money
      // and locks them out. Keep the gate closed and let the dev
      // panel / paywall surface the actionable cause.
      currentLoginRef.ready = res.ok;
      currentLoginRef.result = res;
      notifyIdentity();
      // After the first successful logIn for this user on this device,
      // fire one restorePurchases() so any pre-existing anonymous
      // sandbox purchases get attached to the now-identified record.
      // Only mark the "restored once" sentinel after restore actually
      // succeeds, so a transient failure doesn't permanently disable
      // automatic recovery on subsequent boots.
      if (res.ok) {
        try {
          const key = RESTORED_ONCE_PREFIX + appUserId;
          if (typeof localStorage !== "undefined" && !localStorage.getItem(key)) {
            const restoreRes = await restorePurchases().catch(() => null);
            if (restoreRes && restoreRes.success) {
              try { localStorage.setItem(key, String(Date.now())); } catch {}
            }
          }
        } catch {}
      }
    }
    return res;
  });

  currentLoginRef = { userId: appUserId, promise, ready: false };
  notifyIdentity();
  return promise;
}

export function getCurrentAppUserId(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases() || !window.NativelyPurchases) return resolve(null);
    let purchases: NativelyPurchasesInstance;
    try {
      purchases = new window.NativelyPurchases();
    } catch {
      return resolve(null);
    }
    const fn = purchases.getAppUserID || purchases.getAppUserId;
    if (typeof fn !== "function") return resolve(null);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, 4000);
    try {
      fn.call(purchases, (id: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(typeof id === "string" && id.length > 0 ? id : null);
      });
    } catch {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}
