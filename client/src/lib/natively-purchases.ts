// Thin wrapper around Build Natively's RevenueCat bridge. BN exposes a
// `NativelyPurchases` constructor on `window` whose instance has these
// callback-style methods (per the BN docs the user pulled):
//
//   login(userId, userEmail, cb)              -> { status, customerId, error }
//   logout(cb)                                -> { status, error }
//   restore(cb)                               -> { status, customerId, error }
//   showPaywall(showCloseButton, offeringId, cb)
//   showPaywallIfNeeded(entitlementId, showCloseButton, offeringId, cb)
//     -> { status, message, error }
//     message ∈ "purchased" | "restored" | "cancelled" | "not_presented" | "error"
//
// All other surface area we previously called (`setCustomerId`,
// `getCustomerInfo`, `getOfferings`, `purchasePackage`, `getAppUserID`)
// does NOT exist on the BN bridge — that mismatch is what every prior
// paywall attempt failed on.

export interface LoginResult {
  status: string;
  customerId?: string;
  error?: string;
}

export interface PaywallResult {
  status: string;
  message?: string;
  error?: string;
}

export type RestoreFailureReason =
  | "BRIDGE_MISSING"
  | "BRIDGE_TIMEOUT"
  | "BRIDGE_ERROR"
  | "NO_LOGIN_PENDING"
  | "LOGIN_FAILED"
  | "LOGIN_TIMEOUT"
  | "NO_ACTIVE_SUBSCRIPTION";

export interface RestoreResult {
  success: boolean;
  customerId?: string;
  error?: string;
  reason?: RestoreFailureReason;
}

interface NativelyPurchasesInstance {
  login?(userId: string, userEmail: string, cb: (result: LoginResult) => void): void;
  logout?(cb: (result: { status?: string; error?: string }) => void): void;
  restore?(cb: (result: { status?: string; customerId?: string; error?: string }) => void): void;
  showPaywall?(
    showCloseButton: boolean,
    offeringId: string | undefined,
    cb: (result: PaywallResult) => void,
  ): void;
  showPaywallIfNeeded?(
    entitlementId: string,
    showCloseButton: boolean,
    offeringId: string | undefined,
    cb: (result: PaywallResult) => void,
  ): void;
}

declare global {
  interface Window {
    NativelyPurchases?: new () => NativelyPurchasesInstance;
  }
}

const CALL_TIMEOUT_MS = 30_000;
// Tighter bound for restore — a hung BN callback should be visible
// within seconds, not 30s of dead silence. The paywall present calls
// keep the longer 30s budget because an iOS sheet can legitimately
// stay open while the user reads it.
const RESTORE_CALL_TIMEOUT_MS = 10_000;

// Identity gate. The bridge's `showPaywall` / `showPaywallIfNeeded`
// register the StoreKit transaction against whatever RC customer is
// currently active. If the paywall is presented before `login(userId)`
// finishes, the receipt is recorded against an `$RCAnonymousID:…`
// subscriber and `verifyEntitlement(replitUserId)` 404s. We keep an
// in-flight login promise here and force every paywall / restore
// entry-point to await it before touching the bridge. Cleared on
// `logoutFromRevenueCat()` so a session switch can't leak a previous
// user's identity into the next purchase.
//
// NOTE: `logoutFromRevenueCat()` is intentionally only called on an
// auth-user switch (different signed-in Replit user). RC's `logout`
// creates a fresh anonymous subscriber, so we must not call it on
// every page load or paywall close — that would orphan the receipt.
let pendingLogin: Promise<LoginResult> | null = null;
let lastLoginResult: LoginResult | null = null;
let loggedInUserId: string | null = null;

// Single-paywall mutex. The lock-app effect, the floating nav bar,
// snap, weekly-planner, profile, and dev panel can all dispatch
// `presentPaywall` / `presentPaywallIfNeeded` independently. Without
// a mutex, two unrelated callers in the same second can stack two
// hosted paywall sheets on top of each other (the BN bridge does not
// dedupe). This holds the in-flight presentation promise here so a
// second call returns the existing promise instead of re-entering
// the bridge.
let paywallInFlight: Promise<PaywallResult> | null = null;

export function isNativelyAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.NativelyPurchases === "function";
}

async function awaitLoginIfPending(): Promise<void> {
  if (!pendingLogin) return;
  try {
    await pendingLogin;
  } catch {
    // login failures don't block the paywall — we still want the
    // user to see something rather than hang indefinitely. The
    // server-side verifyEntitlement will catch a mis-attributed
    // purchase on the next refresh.
  }
}

// Stricter login wait used ONLY by the restore code path. Returns the
// resolved LoginResult (or a synthetic failure result) within the
// caller-provided budget. Restore must never run against an anonymous
// RC subscriber — if login hasn't actually returned SUCCESS, restore
// would record the receipt on the wrong RC identity and never reach
// the Replit user. The paywall present calls intentionally use the
// looser `awaitLoginIfPending` so a transient login hiccup doesn't
// block a brand-new purchase.
export async function waitForRevenueCatLogin(
  timeoutMs = 8_000,
): Promise<LoginResult> {
  // Already settled? Return the cached result.
  if (lastLoginResult && !pendingLogin) return lastLoginResult;
  if (lastLoginResult && pendingLogin) {
    // Re-login in flight (e.g. user switch) — fall through and await.
  }
  if (!pendingLogin) {
    return { status: "NO_LOGIN_PENDING", error: "No RevenueCat login attempt has been made yet" };
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<LoginResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ status: "LOGIN_TIMEOUT", error: `login did not resolve within ${timeoutMs}ms` }),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([pendingLogin, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getCachedLoginState(): { userId: string | null; result: LoginResult | null; pending: boolean } {
  return { userId: loggedInUserId, result: lastLoginResult, pending: !!pendingLogin && !lastLoginResult };
}

function getInstance(): NativelyPurchasesInstance | null {
  if (!isNativelyAvailable()) return null;
  try {
    return new window.NativelyPurchases!();
  } catch (err) {
    console.warn("[rc] NativelyPurchases instantiation failed:", err);
    return null;
  }
}

function callWithCallback<T>(
  fnName: string,
  invoke: (cb: (result: T) => void) => void,
  timeoutMs: number = CALL_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`[rc] ${fnName} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    try {
      invoke((result: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    }
  });
}

export function loginToRevenueCat(
  userId: string,
  email: string,
): Promise<LoginResult> {
  // If we're already (or in the middle of) logging in this exact user,
  // reuse the existing promise — otherwise a re-render that re-fires
  // the identity effect could race two `login(...)` calls.
  if (loggedInUserId === userId && pendingLogin) return pendingLogin;

  const inst = getInstance();
  if (!inst || typeof inst.login !== "function") {
    const result: LoginResult = {
      status: "BRIDGE_MISSING",
      error: "NativelyPurchases.login not available",
    };
    lastLoginResult = result;
    return Promise.resolve(result);
  }

  // Assigned synchronously so any paywall call dispatched in the same
  // tick sees a non-null `pendingLogin` and waits.
  loggedInUserId = userId;
  // Clear any prior settled result — a re-login is genuinely in flight.
  lastLoginResult = null;
  pendingLogin = (async (): Promise<LoginResult> => {
    try {
      const result = await callWithCallback<LoginResult>("login", (cb) =>
        inst.login!(userId, email ?? "", cb),
      );
      const settled = result ?? { status: "EMPTY_RESULT" };
      lastLoginResult = settled;
      return settled;
    } catch (err) {
      const settled: LoginResult = { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
      lastLoginResult = settled;
      return settled;
    } finally {
      // Clear the pending marker so subsequent calls see the cached
      // result and don't await an already-settled promise.
      pendingLogin = null;
    }
  })();
  return pendingLogin;
}

export async function logoutFromRevenueCat(): Promise<void> {
  // Drop the identity gate first so a paywall presented during a
  // sign-out → sign-in transition does not still await the previous
  // user's pending login.
  pendingLogin = null;
  lastLoginResult = null;
  loggedInUserId = null;
  const inst = getInstance();
  if (!inst || typeof inst.logout !== "function") return;
  try {
    await callWithCallback<{ status?: string; error?: string }>("logout", (cb) =>
      inst.logout!(cb),
    );
  } catch (err) {
    console.warn("[rc] logout error:", err);
  }
}

export interface PaywallOptions {
  showCloseButton?: boolean;
  offeringId?: string;
}

function trackedPresentation(
  fnName: string,
  fn: () => Promise<PaywallResult>,
): Promise<PaywallResult> {
  if (paywallInFlight) {
    console.warn(
      `[paywall] ${fnName} ignored — another paywall presentation is already in flight (mutex). Returning existing promise.`,
    );
    return paywallInFlight;
  }
  // Hold a mutable token so the inner finally can compare against the
  // currently-tracked promise without referencing its own binding before
  // initialization (which TS rejects under strict mode).
  const slot: { p: Promise<PaywallResult> | null } = { p: null };
  const promise: Promise<PaywallResult> = (async () => {
    try {
      return await fn();
    } finally {
      // Cleared regardless of success / cancel / error so the next
      // legitimate caller can present.
      if (paywallInFlight === slot.p) paywallInFlight = null;
    }
  })();
  slot.p = promise;
  paywallInFlight = promise;
  return promise;
}

export async function presentPaywall(opts: PaywallOptions = {}): Promise<PaywallResult> {
  return trackedPresentation("presentPaywall", async () => {
    await awaitLoginIfPending();
    const inst = getInstance();
    if (!inst || typeof inst.showPaywall !== "function") {
      return {
        status: "BRIDGE_MISSING",
        error: "NativelyPurchases.showPaywall not available (web preview?)",
      };
    }
    try {
      const result = await callWithCallback<PaywallResult>("showPaywall", (cb) =>
        inst.showPaywall!(opts.showCloseButton ?? true, opts.offeringId, cb),
      );
      return result ?? { status: "EMPTY_RESULT" };
    } catch (err) {
      return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export async function presentPaywallIfNeeded(
  entitlementId: string,
  opts: PaywallOptions = {},
): Promise<PaywallResult> {
  return trackedPresentation("presentPaywallIfNeeded", async () => {
    await awaitLoginIfPending();
    const inst = getInstance();
    if (!inst || typeof inst.showPaywallIfNeeded !== "function") {
      return {
        status: "BRIDGE_MISSING",
        error: "NativelyPurchases.showPaywallIfNeeded not available",
      };
    }
    try {
      const result = await callWithCallback<PaywallResult>("showPaywallIfNeeded", (cb) =>
        inst.showPaywallIfNeeded!(entitlementId, opts.showCloseButton ?? true, opts.offeringId, cb),
      );
      return result ?? { status: "EMPTY_RESULT" };
    } catch (err) {
      return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export interface RestoreOptions {
  // Bounded wait for `loginToRevenueCat` to actually return SUCCESS
  // before we touch the bridge. Default 8s — long enough for a normal
  // sign-in, short enough that the UI never appears frozen.
  loginTimeoutMs?: number;
  // Per-call bound on the BN bridge `restore` callback. Default 10s.
  bridgeTimeoutMs?: number;
  // Caller-provided Replit identity. When supplied, `restorePurchases`
  // will ensure a `loginToRevenueCat(userId, email)` is in-flight (or
  // already settled to this same userId) BEFORE waiting on the login
  // gate. This eliminates the `NO_LOGIN_PENDING` race that occurs when
  // the user hits Restore in the same tick as the App.tsx identity
  // effect, before its `loginToRevenueCat` call has had a chance to
  // assign `pendingLogin`.
  userId?: string;
  email?: string;
}

export async function restorePurchases(opts: RestoreOptions = {}): Promise<RestoreResult> {
  const loginTimeoutMs = opts.loginTimeoutMs ?? 8_000;
  const bridgeTimeoutMs = opts.bridgeTimeoutMs ?? RESTORE_CALL_TIMEOUT_MS;

  // Stricter login gate for restore only: we must be calling
  // `restore()` against a real Replit-user RC subscriber, NEVER an
  // anonymous one (otherwise the receipt re-attaches to the
  // wrong subscriber and verify keeps 404'ing).
  const loginState = getCachedLoginState();
  console.log(
    `[restore] login-state userId=${loginState.userId ?? "(none)"} pending=${loginState.pending} ` +
      `lastStatus=${loginState.result?.status ?? "(none)"}`,
  );

  // Bridge availability check up front — clearer error than waiting
  // for login to time out on a web preview.
  const inst = getInstance();
  if (!inst || typeof inst.restore !== "function") {
    return {
      success: false,
      reason: "BRIDGE_MISSING",
      error: "NativelyPurchases.restore not available (web preview?)",
    };
  }

  // Self-initiate login if the caller passed identity AND we don't
  // already have a SUCCESS result for that exact user. This closes
  // the race where the Restore button is tapped in the same tick as
  // the App.tsx identity effect — `pendingLogin` may not yet be
  // assigned, and `waitForRevenueCatLogin` would short-circuit to
  // `NO_LOGIN_PENDING`.
  if (opts.userId) {
    const needsLogin =
      loggedInUserId !== opts.userId ||
      (!pendingLogin &&
        (lastLoginResult === null || lastLoginResult.status !== "SUCCESS"));
    if (needsLogin) {
      console.log(
        `[restore] self-initiating loginToRevenueCat(userId=${opts.userId}) — ` +
          `prior loggedInUserId=${loggedInUserId ?? "(none)"} ` +
          `lastStatus=${lastLoginResult?.status ?? "(none)"} pending=${!!pendingLogin}`,
      );
      // Fire-and-forget — `waitForRevenueCatLogin` below will await
      // the resulting `pendingLogin` promise. Errors surface there.
      void loginToRevenueCat(opts.userId, opts.email ?? "");
    }
  }

  const loginResult = await waitForRevenueCatLogin(loginTimeoutMs);
  if (loginResult.status !== "SUCCESS") {
    if (loginResult.status === "LOGIN_TIMEOUT") {
      return { success: false, reason: "LOGIN_TIMEOUT", error: loginResult.error };
    }
    if (loginResult.status === "NO_LOGIN_PENDING") {
      return { success: false, reason: "NO_LOGIN_PENDING", error: loginResult.error };
    }
    if (loginResult.status === "BRIDGE_MISSING") {
      return { success: false, reason: "BRIDGE_MISSING", error: loginResult.error };
    }
    return {
      success: false,
      reason: "LOGIN_FAILED",
      error: loginResult.error || `login status=${loginResult.status}`,
    };
  }

  console.log(
    `[restore] login OK customerId=${loginResult.customerId ?? "(none)"} — calling bridge restore (timeout=${bridgeTimeoutMs}ms)`,
  );

  try {
    const result = await callWithCallback<{ status?: string; customerId?: string; error?: string }>(
      "restore",
      (cb) => inst.restore!(cb),
      bridgeTimeoutMs,
    );
    const status = result?.status ?? "";
    const customerId = result?.customerId;
    console.log(
      `[restore] bridge result status=${status} customerId=${customerId ?? "(none)"} error=${result?.error ?? "(none)"}`,
    );
    if (result?.error) {
      return { success: false, reason: "BRIDGE_ERROR", error: result.error, customerId };
    }
    if (status !== "SUCCESS") {
      return { success: false, reason: "BRIDGE_ERROR", error: `restore status=${status}`, customerId };
    }
    return { success: true, customerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[restore] bridge threw:", message);
    if (message.includes("timeout")) {
      return { success: false, reason: "BRIDGE_TIMEOUT", error: message };
    }
    return { success: false, reason: "BRIDGE_ERROR", error: message };
  }
}
