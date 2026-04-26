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
  store?: string;
  period_type?: string;
}

interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RcSubscriberEntitlement>;
    subscriptions?: Record<string, RcSubscriberSubscription>;
    original_app_user_id?: string | null;
    management_url?: string | null;
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
  source: "cache" | "revenuecat" | "not_found" | "no_key" | "error_transient" | "error" | "alias";
  // True when the underlying verifier failed in a way that may resolve
  // on retry (5xx, 429, network/parse). False when the answer is
  // authoritative (200 from RC, 404 from RC, comp user, no key).
  transient: boolean;
}

export async function verifyEntitlement(
  appUserId: string,
  options?: { bypassCache?: boolean },
): Promise<VerifyResult> {
  if (!appUserId) return { hasPremium: false, source: "error", transient: false };

  // `bypassCache` is the escape hatch for callers that want a live
  // RC fetch even if our 30-s TTL would otherwise return a (possibly
  // stale negative) cached result. Used by the post-purchase refresh
  // path so the user sees premium unlock within seconds rather than
  // waiting for the cache TTL to expire.
  if (!options?.bypassCache) {
    const cached = cache.get(appUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return { hasPremium: cached.hasPremium, source: "cache", transient: false };
    }
  } else {
    // Drop any stale entry up-front so the caller can't accidentally
    // race a parallel verify that would have re-populated the cache
    // with the same stale value.
    cache.delete(appUserId);
  }

  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    return { hasPremium: false, source: "no_key", transient: false };
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
      // Subscriber unknown to RC = definitely not premium. Authoritative.
      cache.set(appUserId, { hasPremium: false, expiresAt: Date.now() + CACHE_TTL_MS });
      return { hasPremium: false, source: "not_found", transient: false };
    }

    if (resp.status === 429 || resp.status >= 500) {
      // Rate-limited or RC-side outage — caller should retry.
      console.warn(`[revenuecat] verify transient HTTP ${resp.status} for ${appUserId}`);
      return { hasPremium: false, source: "error_transient", transient: true };
    }

    if (!resp.ok) {
      // Other 4xx (auth, bad request, etc.) — not retryable from our side.
      console.warn(`[revenuecat] verify failed for ${appUserId}: HTTP ${resp.status}`);
      return { hasPremium: false, source: "error", transient: false };
    }

    let payload: RcSubscriberResponse;
    try {
      payload = (await resp.json()) as RcSubscriberResponse;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[revenuecat] verify parse error for ${appUserId}:`, msg);
      return { hasPremium: false, source: "error_transient", transient: true };
    }
    const hasPremium = evaluatePayload(payload);
    // One-line verifier log (RC hit, not cache) so sandbox debugging is
    // legible from the workflow console without re-fetching.
    try {
      const ents = payload?.subscriber?.entitlements || {};
      const subs = payload?.subscriber?.subscriptions || {};
      const entSummary = Object.entries(ents).map(
        ([k, v]) => `${k}@${v?.expires_date ?? "lifetime"}`,
      );
      const subSummary = Object.entries(subs).map(
        ([k, v]) => `${k}@${v?.expires_date ?? "lifetime"}`,
      );
      console.log(
        `[revenuecat] verify hit user=${appUserId} hasPremium=${hasPremium} ` +
          `entitlements=[${entSummary.join(", ")}] subscriptions=[${subSummary.join(", ")}] ` +
          `original_app_user_id=${payload?.subscriber?.original_app_user_id ?? "null"}`,
      );
    } catch {
      // logging must never break verification
    }
    cache.set(appUserId, { hasPremium, expiresAt: Date.now() + CACHE_TTL_MS });
    return { hasPremium, source: "revenuecat", transient: false };
  } catch (err: unknown) {
    // Network-level failure (fetch threw) — retryable.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[revenuecat] verify error for ${appUserId}:`, msg);
    return { hasPremium: false, source: "error_transient", transient: true };
  }
}

export function invalidateEntitlementCache(appUserId?: string): void {
  if (appUserId) cache.delete(appUserId);
  else cache.clear();
}


// ---------------------------------------------------------------------------
// Webhook event handling
// ---------------------------------------------------------------------------

// Events that should immediately revoke premium access.
const REVOKE_EVENT_TYPES = new Set([
  "EXPIRATION",
  "BILLING_ISSUE",
  "REFUND",
  "SUBSCRIPTION_PAUSED",
]);

// Events that should grant / re-affirm premium access.
const GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);

export type WebhookOutcome =
  | "revoked"
  | "granted"
  | "cancellation_revoked"
  | "cancellation_kept"
  | "ignored"
  | "no_user";

export interface RevenueCatWebhookEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
}

export interface RevenueCatWebhookBody {
  event?: RevenueCatWebhookEvent;
  api_version?: string;
}

function collectCandidateUserIds(event: RevenueCatWebhookEvent): string[] {
  const ids = new Set<string>();
  const push = (v?: string | null) => {
    if (typeof v === "string" && v.trim()) ids.add(v.trim());
  };
  push(event.app_user_id);
  push(event.original_app_user_id);
  for (const a of event.aliases || []) push(a);
  return Array.from(ids);
}

function cancellationShouldRevoke(event: RevenueCatWebhookEvent): boolean {
  // CANCELLATION fires when auto-renew is turned off OR when the user
  // is fully revoked (refund / dev revocation). Only revoke if access
  // has actually ended — i.e. expiry (and any grace period) is in the past.
  const now = Date.now();
  const grace = event.grace_period_expiration_at_ms;
  if (typeof grace === "number" && grace > now) return false;
  const exp = event.expiration_at_ms;
  if (typeof exp === "number" && exp <= now) return true;
  // No expiry info → leave it to the next verifyEntitlement call (don't revoke).
  return false;
}

export interface ApplyEventDeps {
  setPremium: (userId: string, value: boolean) => Promise<boolean>;
  reverify?: (userId: string) => Promise<boolean>;
}

export async function applyWebhookEvent(
  event: RevenueCatWebhookEvent,
  deps: ApplyEventDeps,
): Promise<{ outcome: WebhookOutcome; userId?: string; type?: string }> {
  const type = (event.type || "").toUpperCase();
  const candidates = collectCandidateUserIds(event);

  if (!type) return { outcome: "ignored" };

  // Decide intent.
  let intent: "grant" | "revoke" | "ignore" = "ignore";
  if (REVOKE_EVENT_TYPES.has(type)) {
    intent = "revoke";
  } else if (GRANT_EVENT_TYPES.has(type)) {
    intent = "grant";
  } else if (type === "CANCELLATION") {
    intent = cancellationShouldRevoke(event) ? "revoke" : "ignore";
  }

  if (intent === "ignore") {
    return {
      outcome: type === "CANCELLATION" ? "cancellation_kept" : "ignored",
      type,
    };
  }

  // Find the first candidate that maps to a known user.
  for (const userId of candidates) {
    invalidateEntitlementCache(userId);

    if (intent === "revoke") {
      const ok = await deps.setPremium(userId, false);
      if (ok) {
        return {
          outcome: type === "CANCELLATION" ? "cancellation_revoked" : "revoked",
          userId,
          type,
        };
      }
      continue;
    }

    // grant — re-verify with RC if possible to avoid trusting a spoofed body.
    // Fail closed: if reverify throws we do NOT auto-grant; behave like the
    // verifier returning false so a stale/spoofed event can't unlock premium.
    let verified: boolean;
    if (deps.reverify) {
      try {
        verified = await deps.reverify(userId);
      } catch {
        verified = false;
      }
    } else {
      verified = true;
    }
    const ok = await deps.setPremium(userId, verified);
    if (ok) return { outcome: "granted", userId, type };
  }

  return { outcome: "no_user", type };
}
