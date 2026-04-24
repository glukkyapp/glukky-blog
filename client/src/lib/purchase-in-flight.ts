// Tiny ref-counted flag so the build-staleness reload banner can avoid
// triggering window.location.reload() while a paywall purchase or
// restore is mid-flight (which would silently drop the StoreKit
// callback). Increment when entering a purchase/restore flow,
// decrement in finally.

let inFlight = 0;

export function beginPurchaseFlight() {
  inFlight += 1;
}

export function endPurchaseFlight() {
  inFlight = Math.max(0, inFlight - 1);
}

export function isPurchaseInFlight(): boolean {
  return inFlight > 0;
}
