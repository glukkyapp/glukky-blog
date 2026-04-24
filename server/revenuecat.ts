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
  // stale negative) cached result. Used by `verifyEntitlementSelfHealing`
  // when probing alias ids during a forced refresh — without it the
  // first failed probe would lock the alias as "false" for 30 s and
  // defeat the unlock-within-~10s objective.
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

// Self-healing wrapper around verifyEntitlement. Tries the Replit user id
// first; if RC has no entitlement under that id, walks every anonymous id
// previously aliased to the same Replit user (loaded from the persistent
// `subscription_alias` table via the supplied loader) and verifies each
// one in turn. As soon as any anonymous id reports premium, we treat the
// user as premium and invalidate the negative cache for the Replit id so
// the next direct verify also sees it (RC's alias merge is eventually
// consistent on their side, but our subscription_alias mapping is the
// durable record on ours).
//
// This is the fix for the "purchase succeeded, app still locked" loop
// when the alias REST call had failed transiently or the server had
// restarted between purchase and verify.
export async function verifyEntitlementSelfHealing(
  replitUserId: string,
  loadAnonAliases: (replitUserId: string) => Promise<string[]>,
): Promise<VerifyResult & { aliasGranted: boolean; triedAliasIds: string[] }> {
  const primary = await verifyEntitlement(replitUserId);
  if (primary.hasPremium) {
    return { ...primary, aliasGranted: false, triedAliasIds: [] };
  }
  let aliases: string[] = [];
  try {
    aliases = await loadAnonAliases(replitUserId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[revenuecat] verifySelfHealing: alias load failed user=${replitUserId}: ${msg}`,
    );
  }
  if (aliases.length === 0) {
    return { ...primary, aliasGranted: false, triedAliasIds: [] };
  }

  let lastTransient = primary.transient;
  for (const anon of aliases) {
    // Bypass the 30-s entitlement cache for alias probes. Without
    // this, the first failed probe (RC propagation lag right after
    // a sandbox purchase) caches `false` and every retry inside the
    // same purchase flow reads stale-false until the TTL expires —
    // exactly the "purchase succeeded, app still locked" symptom
    // self-healing is supposed to fix.
    const r = await verifyEntitlement(anon, { bypassCache: true });
    if (r.hasPremium) {
      // Drop the negative cache for the Replit user so a subsequent direct
      // verify (e.g. from a /api/me call) returns true without going
      // through this self-healing path.
      invalidateEntitlementCache(replitUserId);
      console.log(
        `[revenuecat] verifySelfHealing granted user=${replitUserId} via alias=${anon}`,
      );
      return {
        hasPremium: true,
        source: "alias",
        transient: false,
        aliasGranted: true,
        triedAliasIds: aliases,
      };
    }
    if (r.transient) lastTransient = true;
  }
  return {
    hasPremium: false,
    source: primary.source,
    transient: lastTransient,
    aliasGranted: false,
    triedAliasIds: aliases,
  };
}

// ---------------------------------------------------------------------------
// Server-side aliasing of an anonymous RC subscriber to a Replit user id.
//
// The Build Natively wrapper does not expose RevenueCat's `Set Customer ID`
// (logIn) capability, so every iOS purchase is recorded against an anonymous
// `$RCAnonymousID:…` record. We attach that anonymous record to the signed-in
// Replit user id by calling RC's REST alias endpoint server-side. After this,
// `verifyEntitlement(replitUserId)` resolves the merged subscriber and finds
// the entitlement.
// ---------------------------------------------------------------------------

const ANON_ID_PREFIX = "$RCAnonymousID:";

export function looksLikeAnonymousAppUserId(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ANON_ID_PREFIX) && value.length > ANON_ID_PREFIX.length;
}

// In-memory cache of anonymous_app_user_id → replit_user_id, used as a
// hot-path read in front of the persistent `subscription_alias` table.
// The DB is the source of truth; the cache is just a TTL-bounded view of
// recently observed mappings to absorb webhook bursts. Last-write-wins.
const ALIAS_MAPPING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const aliasMapping = new Map<string, { replitUserId: string; expiresAt: number }>();

function rememberAliasMapping(anonymousId: string, replitUserId: string): void {
  aliasMapping.set(anonymousId, {
    replitUserId,
    expiresAt: Date.now() + ALIAS_MAPPING_TTL_MS,
  });
}

// Synchronous in-memory-only lookup. Kept exported for legacy callers and
// tests; production code should prefer `lookupAliasMappingAsync` so it
// also consults the persistent table after a server restart.
export function lookupAliasMapping(anonymousId: string): string | null {
  const entry = aliasMapping.get(anonymousId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    aliasMapping.delete(anonymousId);
    return null;
  }
  return entry.replitUserId;
}

export async function lookupAliasMappingAsync(
  anonymousId: string,
  loader?: (id: string) => Promise<string | null>,
): Promise<string | null> {
  const cached = lookupAliasMapping(anonymousId);
  if (cached) return cached;
  if (!loader) return null;
  try {
    const v = await loader(anonymousId);
    if (v) rememberAliasMapping(anonymousId, v);
    return v ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[revenuecat] alias DB lookup failed anon=${anonymousId}: ${msg}`);
    return null;
  }
}

// Exposed for tests so we can reset state between cases.
export function _clearAliasMappingForTests(): void {
  aliasMapping.clear();
}

export interface AliasResult {
  aliased: boolean;
  source:
    | "ok"
    | "no_key"
    | "invalid_anonymous_id"
    | "invalid_replit_user_id"
    | "not_found"
    | "error_transient"
    | "error"
    // First-writer-wins guard tripped: a different `replit_user_id`
    // already owns this anonymous id in the `subscription_alias`
    // table. Not transient — caller must not retry without
    // resolving the conflict (e.g. user signs out / changes id).
    | "owner_mismatch"
    // Initial persist write failed transiently (DB hiccup, etc).
    // No RC call attempted. Caller may retry.
    | "persist_error"
    // The (anon → replit) row was persisted, but RC alias REST
    // either was not attempted (no api key) or did not return
    // 2xx (transient RC failure, network error). We still return
    // `aliased: true` — the persisted row drives self-healing on
    // every subsequent verify, so a single successful capture
    // unlocks future verifies even when RC's own alias merge
    // never lands. The persisted row's first-writer-wins guard
    // is what protects against cross-user reassignment.
    // `verified` stays false in this branch as a telemetry hint;
    // it's flipped to true when a later RC 2xx (REST or webhook)
    // independently confirms the merge.
    | "ok_persist_only";
  transient: boolean;
  httpStatus?: number;
  errorMessage?: string;
}

export interface AliasPersistOutcome {
  // True only when the storage layer atomically inserted a new row OR
  // refreshed an existing row owned by the SAME `replit_user_id`.
  // False on `owner_mismatch` (a different user already owns the
  // anonymous id) or on a transient persist error.
  stored: boolean;
  reason: "ok_new" | "ok_same_owner" | "owner_mismatch" | "error";
}

export interface AliasPersistDeps {
  // Persists the (anonymous_id → replit_user_id) edge. The atomic
  // upsert behind this is first-writer-wins on the anonymous id —
  // a later call from a DIFFERENT replit_user_id is rejected with
  // `owner_mismatch`, which is the cross-user safety guard. The
  // persisted row is immediately consumed by self-healing reads
  // (`verifyEntitlementSelfHealing` / `getReplitUserIdForAnonymous`)
  // regardless of whether RC's alias REST below also succeeds —
  // that is the explicit task-#486 design.
  remember?: (anonymousId: string, replitUserId: string) => Promise<AliasPersistOutcome>;
  // Optional. Flips `verified=true` on an already-persisted
  // (anon, replit) row after RC alias REST returns 2xx. This is
  // pure telemetry — it does NOT affect read behaviour, since
  // unverified rows already drive self-healing. The storage
  // layer's owner-equality guard ensures we only promote rows
  // that belong to this user even if a stale RC 2xx arrives.
  markVerified?: (anonymousId: string, replitUserId: string) => Promise<void>;
}

export async function aliasAnonymousAppUserId(
  anonymousId: string,
  replitUserId: string,
  persist?: AliasPersistDeps,
): Promise<AliasResult> {
  if (!looksLikeAnonymousAppUserId(anonymousId)) {
    return { aliased: false, source: "invalid_anonymous_id", transient: false };
  }
  if (typeof replitUserId !== "string" || replitUserId.length === 0) {
    return { aliased: false, source: "invalid_replit_user_id", transient: false };
  }
  if (looksLikeAnonymousAppUserId(replitUserId)) {
    // Defence in depth: never alias an anonymous id onto another anonymous id.
    return { aliased: false, source: "invalid_replit_user_id", transient: false };
  }

  // STEP 1 — Persist the (anonymous_id → replit_user_id) edge.
  //
  // Persisting first lets the atomic upsert serve as a
  // first-writer-wins claim against cross-account reassignment:
  // a different `replit_user_id` calling alias for the same
  // anonymous id later will see `owner_mismatch` and be rejected.
  // The persisted row immediately drives self-healing on every
  // future verify — that is the whole point of task #486. The
  // RC alias REST in STEP 2 is best-effort: when it succeeds it
  // also merges subscribers on RC's side and we mark the row
  // `verified` for telemetry, but a STEP 2 failure does NOT
  // undo STEP 1 and does NOT block the user from being unlocked
  // on the next verify.
  let persistOutcome: AliasPersistOutcome = { stored: true, reason: "ok_new" };
  if (persist?.remember) {
    try {
      persistOutcome = await persist.remember(anonymousId, replitUserId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[revenuecat] alias persist failed anon=${anonymousId} replit=${replitUserId}: ${msg}`,
      );
      persistOutcome = { stored: false, reason: "error" };
    }
  }

  if (!persistOutcome.stored) {
    // First-writer-wins guard or transient DB error. Don't try RC
    // either — without our claim row, calling RC alias REST would
    // silently merge subscribers across users on RC's side and we
    // would have no local record of the conflict.
    console.warn(
      `[revenuecat] alias persist rejected anon=${anonymousId} replit=${replitUserId} reason=${persistOutcome.reason}`,
    );
    return {
      aliased: false,
      source: persistOutcome.reason === "owner_mismatch" ? "owner_mismatch" : "persist_error",
      transient: persistOutcome.reason === "error",
      errorMessage: `persist_${persistOutcome.reason}`,
    };
  }

  // STEP 2 — RC alias REST. Best-effort: success also merges
  // subscribers on RC's side (so RC's own customer record reflects
  // the same identity) and we mark the row `verified` for
  // telemetry. Failure does NOT undo STEP 1 and does NOT block
  // unlock — the persisted row from STEP 1 is already enough for
  // `verifyEntitlementSelfHealing` to pick up the anon id on the
  // next verify. We seed the in-memory mapping and invalidate the
  // entitlement cache as soon as STEP 1 succeeded so the very
  // next request in this process sees fresh state without a DB
  // round-trip.
  rememberAliasMapping(anonymousId, replitUserId);
  invalidateEntitlementCache(replitUserId);

  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    console.log(
      `[revenuecat] alias persist-only (no api key) anon=${anonymousId} replit=${replitUserId} persist=${persistOutcome.reason}`,
    );
    return { aliased: true, source: "ok_persist_only", transient: false };
  }

  try {
    const url = `${RC_BASE}/subscribers/${encodeURIComponent(anonymousId)}/alias`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_app_user_id: replitUserId }),
    });

    if (resp.ok) {
      // RC also merged the subscribers — flip `verified=true` on
      // the persisted row for telemetry. The storage layer's
      // owner-equality guard ensures we only promote rows that
      // already belong to this user, so a stale RC 2xx for a
      // re-purposed anon id can never wrongly verify a different
      // owner's row. (The in-memory mapping and entitlement
      // cache were already warmed in STEP 2's pre-check above.)
      if (persist?.markVerified) {
        try {
          await persist.markVerified(anonymousId, replitUserId);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[revenuecat] alias markVerified failed anon=${anonymousId} replit=${replitUserId}: ${msg}`,
          );
        }
      }
      console.log(
        `[revenuecat] alias ok anon=${anonymousId} replit=${replitUserId} http=${resp.status} persist=${persistOutcome.reason}`,
      );
      return { aliased: true, source: "ok", transient: false, httpStatus: resp.status };
    }

    // RC alias didn't merge — but STEP 1's persisted row is
    // enough for self-healing on the next verify. Return
    // `aliased: true` with `source: "ok_persist_only"` so callers
    // know the entitlement edge is recorded but RC's own merge is
    // pending (a later REST retry or webhook will flip
    // `verified=true` for telemetry).
    let bodyText = "";
    try { bodyText = (await resp.text()).slice(0, 300); } catch { /* ignored */ }
    const isTransient = resp.status === 429 || resp.status >= 500;
    console.warn(
      `[revenuecat] alias persist-only (RC ${resp.status}) anon=${anonymousId} replit=${replitUserId} body=${bodyText}`,
    );
    return {
      aliased: true,
      source: "ok_persist_only",
      transient: isTransient,
      httpStatus: resp.status,
      errorMessage: `RC HTTP ${resp.status}${bodyText ? ` ${bodyText}` : ""}`,
    };
  } catch (err: unknown) {
    // Network-level failure — same outcome as the non-2xx branch
    // above: the persisted row from STEP 1 is enough to unlock
    // the next verify, so we return `aliased: true` with the
    // `ok_persist_only` source rather than pretending nothing was
    // recorded.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[revenuecat] alias persist-only (RC network err) anon=${anonymousId} replit=${replitUserId}: ${msg}`,
    );
    return {
      aliased: true,
      source: "ok_persist_only",
      transient: true,
      errorMessage: msg || "network",
    };
  }
}

// ---------------------------------------------------------------------------
// Diagnostics: subscriber probe + server-side offerings list
//
// These power the dev-panel diagnostics card. The subscriber probe returns
// a sanitized summary of what RC has on file under {appUserId}. The
// offerings probe returns the offering + product identifiers visible to the
// server's RC key, so the panel can render a SAME / DIFFERENT verdict
// against the bridge's view (project-identity hint).
// ---------------------------------------------------------------------------

export interface ProbeEntitlement {
  identifier: string;
  expires_date: string | null;
  product_identifier: string | null;
}

export interface ProbeSubscription {
  product_id: string;
  expires_date: string | null;
  store: string | null;
  period_type: string | null;
  unsubscribe_detected_at: string | null;
}

export interface SubscriberProbeResult {
  httpStatus: number;
  source:
    | "ok"
    | "not_found"
    | "no_key"
    | "error_transient"
    | "error";
  hasPremium: boolean;
  entitlements: ProbeEntitlement[];
  subscriptions: ProbeSubscription[];
  originalAppUserId: string | null;
  managementUrl: string | null;
  errorMessage?: string;
}

export async function probeSubscriber(appUserId: string): Promise<SubscriberProbeResult> {
  const empty = {
    entitlements: [] as ProbeEntitlement[],
    subscriptions: [] as ProbeSubscription[],
    originalAppUserId: null,
    managementUrl: null,
  };
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    return { httpStatus: 0, source: "no_key", hasPremium: false, ...empty };
  }
  try {
    const url = `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (resp.status === 404) {
      return { httpStatus: 404, source: "not_found", hasPremium: false, ...empty };
    }
    if (resp.status === 429 || resp.status >= 500) {
      return {
        httpStatus: resp.status,
        source: "error_transient",
        hasPremium: false,
        ...empty,
        errorMessage: `HTTP ${resp.status}`,
      };
    }
    if (!resp.ok) {
      let bodyText = "";
      try { bodyText = (await resp.text()).slice(0, 300); } catch {}
      return {
        httpStatus: resp.status,
        source: "error",
        hasPremium: false,
        ...empty,
        errorMessage: `HTTP ${resp.status}${bodyText ? ` ${bodyText}` : ""}`,
      };
    }
    let payload: RcSubscriberResponse;
    try {
      payload = (await resp.json()) as RcSubscriberResponse;
    } catch (err: any) {
      return {
        httpStatus: resp.status,
        source: "error_transient",
        hasPremium: false,
        ...empty,
        errorMessage: `parse: ${err?.message || "unknown"}`,
      };
    }
    const sub = payload?.subscriber || {};
    const entitlements: ProbeEntitlement[] = Object.entries(sub.entitlements || {}).map(
      ([k, v]) => ({
        identifier: k,
        expires_date: v?.expires_date ?? null,
        product_identifier: v?.product_identifier ?? null,
      }),
    );
    const subscriptions: ProbeSubscription[] = Object.entries(sub.subscriptions || {}).map(
      ([k, v]) => ({
        product_id: k,
        expires_date: v?.expires_date ?? null,
        store: v?.store ?? null,
        period_type: v?.period_type ?? null,
        unsubscribe_detected_at: v?.unsubscribe_detected_at ?? null,
      }),
    );
    return {
      httpStatus: resp.status,
      source: "ok",
      hasPremium: evaluatePayload(payload),
      entitlements,
      subscriptions,
      originalAppUserId: sub.original_app_user_id ?? null,
      managementUrl: sub.management_url ?? null,
    };
  } catch (err: any) {
    return {
      httpStatus: 0,
      source: "error_transient",
      hasPremium: false,
      ...empty,
      errorMessage: err?.message || "network",
    };
  }
}

interface RcOfferingsResponse {
  current_offering_id?: string | null;
  offerings?: Array<{
    identifier?: string;
    description?: string;
    packages?: Array<{
      identifier?: string;
      platform_product_identifier?: string;
    }>;
  }>;
}

export interface ServerOfferingsResult {
  available: boolean;
  reason?: string;
  currentOfferingId: string | null;
  offeringIdentifiers: string[];
  productIdentifiers: string[];
  httpStatus?: number;
}

export async function fetchServerOfferings(appUserId: string): Promise<ServerOfferingsResult> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    return {
      available: false,
      reason: "no_key",
      currentOfferingId: null,
      offeringIdentifiers: [],
      productIdentifiers: [],
    };
  }
  try {
    // RC v1: /subscribers/{app_user_id}/offerings — returns the project's
    // offerings as visible to this API key for this user. Requires a
    // platform header per RC docs.
    const url = `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}/offerings`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Platform": "ios",
      },
    });
    if (!resp.ok) {
      let bodyText = "";
      try { bodyText = (await resp.text()).slice(0, 300); } catch {}
      return {
        available: false,
        reason: `HTTP ${resp.status}${bodyText ? ` ${bodyText}` : ""}`,
        currentOfferingId: null,
        offeringIdentifiers: [],
        productIdentifiers: [],
        httpStatus: resp.status,
      };
    }
    let payload: RcOfferingsResponse;
    try {
      payload = (await resp.json()) as RcOfferingsResponse;
    } catch (err: any) {
      return {
        available: false,
        reason: `parse: ${err?.message || "unknown"}`,
        currentOfferingId: null,
        offeringIdentifiers: [],
        productIdentifiers: [],
        httpStatus: resp.status,
      };
    }
    const offeringIdentifiers: string[] = [];
    const productIdentifiers = new Set<string>();
    for (const o of payload?.offerings || []) {
      if (o?.identifier) offeringIdentifiers.push(o.identifier);
      for (const p of o?.packages || []) {
        if (p?.platform_product_identifier) productIdentifiers.add(p.platform_product_identifier);
      }
    }
    return {
      available: true,
      currentOfferingId: payload?.current_offering_id ?? null,
      offeringIdentifiers,
      productIdentifiers: Array.from(productIdentifiers).sort(),
      httpStatus: resp.status,
    };
  } catch (err: any) {
    return {
      available: false,
      reason: `network: ${err?.message || "unknown"}`,
      currentOfferingId: null,
      offeringIdentifiers: [],
      productIdentifiers: [],
    };
  }
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

export function collectCandidateUserIds(event: RevenueCatWebhookEvent): string[] {
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
  // Optional DB-backed loader so an INITIAL_PURCHASE arriving with only
  // anonymous candidate ids can still resolve to a real Replit user id
  // even after a server restart cleared the in-memory alias cache.
  loadReplitUserIdForAnonymous?: (anonymousId: string) => Promise<string | null>;
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

  // INITIAL_PURCHASE fallback: if every candidate id is anonymous (the
  // wrapper has no Set Customer ID and the client never finished the
  // alias round-trip), look the anonymous id up in the in-memory alias
  // mapping populated by aliasAnonymousAppUserId() and append the mapped
  // Replit user id as a real candidate. Only INITIAL_PURCHASE — renewals
  // and other events should already carry the real id once the alias has
  // been performed once.
  if (
    intent === "grant" &&
    type === "INITIAL_PURCHASE" &&
    candidates.length > 0 &&
    candidates.every(looksLikeAnonymousAppUserId)
  ) {
    for (const anon of candidates) {
      const mapped = await lookupAliasMappingAsync(anon, deps.loadReplitUserIdForAnonymous);
      if (mapped && !candidates.includes(mapped)) {
        candidates.push(mapped);
      }
    }
  }

  // Find the first candidate that maps to a known user.
  for (const userId of candidates) {
    if (looksLikeAnonymousAppUserId(userId)) continue;
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
