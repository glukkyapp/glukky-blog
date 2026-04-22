// Server-side RevenueCat entitlement verifier.
//
// The frontend never tells the backend "I am premium". Instead the
// frontend asks the backend to refresh status; the backend then asks
// RevenueCat directly. This module is the only place that decides
// whether a user has an active premium entitlement right now.
//
// We treat the absence of REVENUECAT_SECRET_API_KEY as fail-closed:
// the verifier returns hasPremium=false and logs a single warning.
// It must NEVER auto-unlock when the secret is missing.

const RC_BASE = "https://api.revenuecat.com/v1";
const CACHE_TTL_MS = 30_000;

type CacheEntry = { hasPremium: boolean; expiresAt: number };
const cache = new Map<string, CacheEntry>();

let warnedMissingKey = false;

function warnMissingKeyOnce(): void {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  console.warn(
    "[revenuecat] REVENUECAT_SECRET_API_KEY is not set; verifier will fail closed (no premium unlocks).",
  );
}

interface RcSubscriberEntitlement {
  expires_date?: string | null;
  product_identifier?: string;
}

interface RcSubscriberSubscription {
  expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
}

interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RcSubscriberEntitlement>;
    subscriptions?: Record<string, RcSubscriberSubscription>;
  };
}

function isActiveExpiry(expiresDate: string | null | undefined): boolean {
  // RC convention: null expires_date means lifetime / non-expiring entitlement.
  if (expiresDate === null || expiresDate === undefined) return true;
  const ts = Date.parse(expiresDate);
  if (Number.isNaN(ts)) return false;
  return ts > Date.now();
}

function evaluatePayload(payload: RcSubscriberResponse): boolean {
  const sub = payload?.subscriber;
  if (!sub) return false;

  const entitlements = sub.entitlements || {};
  for (const ent of Object.values(entitlements)) {
    if (isActiveExpiry(ent?.expires_date)) return true;
  }

  const subscriptions = sub.subscriptions || {};
  for (const s of Object.values(subscriptions)) {
    if (isActiveExpiry(s?.expires_date)) return true;
  }

  return false;
}

export interface VerifyResult {
  hasPremium: boolean;
  source: "cache" | "revenuecat" | "no_key" | "error";
}

export async function verifyEntitlement(appUserId: string): Promise<VerifyResult> {
  if (!appUserId) return { hasPremium: false, source: "error" };

  const cached = cache.get(appUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return { hasPremium: cached.hasPremium, source: "cache" };
  }

  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    return { hasPremium: false, source: "no_key" };
  }

  try {
    const url = `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (resp.status === 404) {
      // Subscriber unknown to RC = definitely not premium.
      cache.set(appUserId, { hasPremium: false, expiresAt: Date.now() + CACHE_TTL_MS });
      return { hasPremium: false, source: "revenuecat" };
    }

    if (!resp.ok) {
      console.warn(`[revenuecat] verify failed for ${appUserId}: HTTP ${resp.status}`);
      return { hasPremium: false, source: "error" };
    }

    const payload = (await resp.json()) as RcSubscriberResponse;
    const hasPremium = evaluatePayload(payload);
    cache.set(appUserId, { hasPremium, expiresAt: Date.now() + CACHE_TTL_MS });
    return { hasPremium, source: "revenuecat" };
  } catch (err: any) {
    console.warn(`[revenuecat] verify error for ${appUserId}:`, err?.message || err);
    return { hasPremium: false, source: "error" };
  }
}

export function invalidateEntitlementCache(appUserId?: string): void {
  if (appUserId) cache.delete(appUserId);
  else cache.clear();
}
