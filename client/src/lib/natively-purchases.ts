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

function hasNativelyPurchases(): boolean {
  return typeof (window as any).NativelyPurchases === "function";
}

export function isNativelyAvailable(): boolean {
  return hasNativelyPurchases();
}

export function purchasePackage(packageId: string): Promise<PurchaseResult> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases()) {
      return resolve({ success: false, error: "not_native" });
    }
    try {
      const purchases = new (window as any).NativelyPurchases();
      purchases.purchasePackage(packageId, (result: any) => {
        if (result?.error || result?.cancelled) {
          resolve({ success: false, error: result?.error || "cancelled" });
        } else {
          resolve({ success: true, customerInfo: result?.customerInfo || result });
        }
      });
    } catch (e: any) {
      resolve({ success: false, error: e.message });
    }
  });
}

export function restorePurchases(): Promise<RestoreResult> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases()) {
      return resolve({ success: false, error: "not_native" });
    }
    try {
      const purchases = new (window as any).NativelyPurchases();
      purchases.restorePurchases((result: any) => {
        if (result?.error) {
          resolve({ success: false, error: result.error });
        } else {
          resolve({ success: true, customerInfo: result?.customerInfo || result });
        }
      });
    } catch (e: any) {
      resolve({ success: false, error: e.message });
    }
  });
}

export function getCustomerInfo(): Promise<CustomerInfo | null> {
  return new Promise((resolve) => {
    if (!hasNativelyPurchases()) {
      return resolve(null);
    }
    try {
      const purchases = new (window as any).NativelyPurchases();
      purchases.getCustomerInfo((result: any) => {
        resolve(result || null);
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
