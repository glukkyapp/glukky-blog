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

interface NativelyPurchasesInstance {
  purchasePackage(packageId: string, callback: (result: { error?: string; cancelled?: boolean; customerInfo?: CustomerInfo }) => void): void;
  restorePurchases(callback: (result: { error?: string; customerInfo?: CustomerInfo }) => void): void;
  getCustomerInfo(callback: (result: CustomerInfo | null) => void): void;
  getOfferings?(callback: (result: OfferingsResult | null) => void): void;
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

export function getMonthlyPriceString(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases() || !window.NativelyPurchases) {
      return resolve(null);
    }
    try {
      const purchases = new window.NativelyPurchases();
      if (typeof purchases.getOfferings !== "function") {
        return resolve(null);
      }
      purchases.getOfferings((result) => {
        const current = result?.current;
        if (!current) return resolve(null);

        const direct = current.monthly?.product?.priceString;
        if (direct) return resolve(direct);

        const packages = current.availablePackages || [];
        const monthlyPkg = packages.find(
          (p) => p?.identifier === "$rc_monthly" || p?.packageType === "MONTHLY",
        );
        if (monthlyPkg?.product?.priceString) {
          return resolve(monthlyPkg.product.priceString);
        }

        const firstPriced = packages.find((p) => !!p?.product?.priceString);
        resolve(firstPriced?.product?.priceString ?? null);
      });
    } catch {
      resolve(null);
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
