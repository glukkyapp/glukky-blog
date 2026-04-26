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

export interface RestoreResult {
  success: boolean;
  customerId?: string;
  error?: string;
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

// Identity gate. The bridge's `showPaywall` / `showPaywallIfNeeded`
// register the StoreKit transaction against whatever RC customer is
// currently active. If the paywall is presented before `login(userId)`
// finishes, the receipt is recorded against an `$RCAnonymousID:…`
// subscriber and `verifyEntitlement(replitUserId)` 404s. We keep an
// in-flight login promise here and force every paywall / restore
// entry-point to await it before touching the bridge. Cleared on
// `logoutFromRevenueCat()` so a session switch can't leak a previous
// user's identity into the next purchase.
let pendingLogin: Promise<LoginResult> | null = null;
let loggedInUserId: string | null = null;

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
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`[rc] ${fnName} timeout after ${CALL_TIMEOUT_MS}ms`));
    }, CALL_TIMEOUT_MS);
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
    return Promise.resolve({
      status: "BRIDGE_MISSING",
      error: "NativelyPurchases.login not available",
    });
  }

  // Assigned synchronously so any paywall call dispatched in the same
  // tick sees a non-null `pendingLogin` and waits.
  loggedInUserId = userId;
  pendingLogin = (async (): Promise<LoginResult> => {
    try {
      const result = await callWithCallback<LoginResult>("login", (cb) =>
        inst.login!(userId, email ?? "", cb),
      );
      return result ?? { status: "EMPTY_RESULT" };
    } catch (err) {
      return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
    }
  })();
  return pendingLogin;
}

export async function logoutFromRevenueCat(): Promise<void> {
  // Drop the identity gate first so a paywall presented during a
  // sign-out → sign-in transition does not still await the previous
  // user's pending login.
  pendingLogin = null;
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

export async function presentPaywall(opts: PaywallOptions = {}): Promise<PaywallResult> {
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
}

export async function presentPaywallIfNeeded(
  entitlementId: string,
  opts: PaywallOptions = {},
): Promise<PaywallResult> {
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
}

export async function restorePurchases(): Promise<RestoreResult> {
  await awaitLoginIfPending();
  const inst = getInstance();
  if (!inst || typeof inst.restore !== "function") {
    return { success: false, error: "NativelyPurchases.restore not available" };
  }
  try {
    const result = await callWithCallback<{ status?: string; customerId?: string; error?: string }>(
      "restore",
      (cb) => inst.restore!(cb),
    );
    const ok = result?.status === "SUCCESS" && !result?.error;
    return { success: ok, customerId: result?.customerId, error: result?.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
