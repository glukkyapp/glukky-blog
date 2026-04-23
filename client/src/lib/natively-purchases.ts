export interface CustomerInfo {
  activeSubscriptions?: string[];
  entitlements?: { active?: Record<string, unknown> };
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

interface OfferingPackage {
  product?: OfferingProduct;
  identifier?: string;
  packageType?: string;
}

interface OfferingsResult {
  current?: {
    monthly?: OfferingPackage;
    annual?: OfferingPackage;
    availablePackages?: OfferingPackage[];
  } | null;
  error?: string;
}

export interface NativelyPurchasesInstance {
  purchasePackage(packageId: string, callback: (result: { error?: string; cancelled?: boolean; customerInfo?: CustomerInfo }) => void): void;
  restorePurchases(callback: (result: { error?: string; customerInfo?: CustomerInfo }) => void): void;
  getCustomerInfo(callback: (result: CustomerInfo | null) => void): void;
  getOfferings?(callback: (result: OfferingsResult | null) => void): void;
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
          resolve({ success: false, error: "cancelled" });
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
