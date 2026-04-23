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
    try {
      const purchases = new window.NativelyPurchases();
      purchases.restorePurchases((result) => {
        if (result?.error) {
          resolve({ success: false, error: result.error });
        } else {
          resolve({ success: true, customerInfo: result?.customerInfo || undefined });
        }
      });
    } catch (e: unknown) {
      resolve({ success: false, error: e instanceof Error ? e.message : "unknown" });
    }
  });
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
      if (out.priceString === null) {
        // eslint-disable-next-line no-console
        console.warn(`${LOG_TAG} resolved null`, {
          source: out.source,
          durationMs: out.durationMs,
          errorMessage: out.errorMessage,
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

/**
 * Backwards-compatible wrapper used by the paywall headline. See
 * getMonthlyPriceDetails for the diagnostic-rich version used by the dev panel.
 */
export async function getMonthlyPriceString(): Promise<string | null> {
  const r = await getMonthlyPriceDetails();
  return r.priceString;
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
      // We treat identity as "ready" when logIn succeeded, OR when the
      // bridge clearly does not expose logIn at all (older Natively
      // build) — in that case the user has no recovery path and we'd
      // otherwise block the subscribe button forever. For real failure
      // modes (timeout / runtime error) we keep ready=false so the
      // gate stays closed and the user can retry from the dev panel
      // or by reopening the paywall.
      const treatAsReady = res.ok || res.error === "no_login_method";
      currentLoginRef.ready = treatAsReady;
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
