import { log } from "./index";
import { db } from "./db";
import { userProfiles } from "@shared/schema";
import { isNotNull, inArray, sql } from "drizzle-orm";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

interface NotificationPayload {
  title: string;
  subtitle: string;
  message: string;
  deepLink: string;
  // Targeting: prefer external_ids when present (alias-based);
  // fall back to playerIds (subscription-id based) for users
  // whose wrapper hasn't yet returned an external id.
  // Exactly one of these should be non-empty per call.
  externalIds?: string[];
  playerIds?: string[];
  send_after?: string;
  delivery_time_of_day?: string;
  delayed_option?: "timezone" | "last-active";
  // For delivery_time_of_day sends, the t+0 and t+6s reports
  // always read 0 — the actual delivery hasn't happened yet.
  // Setting `postTriggerReportAfterMs` schedules an additional
  // delivery-report fetch this many ms in the future, intended
  // to land a few minutes after the latest recipient's local
  // trigger time. The label is used in the log line so the
  // operator can distinguish it from t+0 / t+6s entries.
  postTriggerReportAfterMs?: number;
  postTriggerReportLabel?: string;
}

interface OneSignalRequestBody {
  app_id: string;
  // Exactly one of include_aliases / include_subscription_ids per call.
  include_aliases?: { external_id: string[] };
  include_subscription_ids?: string[];
  // RULE A — required when include_aliases is used. Without this
  // OneSignal silently delivers nothing on the alias path.
  target_channel?: "push";
  headings: { en: string };
  subtitle: { en: string };
  contents: { en: string };
  url: string;
  data: { deepLink: string };
  send_after?: string;
  delivery_time_of_day?: string;
  delayed_option?: "timezone" | "last-active";
}

// OneSignal's per-notification report has slightly different shapes
// across endpoints; we only read a small subset and tolerate missing
// fields (some counters only populate after a few seconds).
interface OneSignalNotificationReport {
  id?: string;
  successful?: number;
  failed?: number;
  errored?: number;
  converted?: number;
  remaining?: number;
  recipients?: number;
  platform_delivery_stats?: Record<string, unknown>;
  errors?: unknown;
}

async function fetchDeliveryReport(notificationId: string): Promise<OneSignalNotificationReport | null> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) return null;
  try {
    const url = `https://api.onesignal.com/notifications/${encodeURIComponent(notificationId)}?app_id=${encodeURIComponent(ONESIGNAL_APP_ID)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      log(`OneSignal report fetch ${notificationId} HTTP ${response.status}: ${text}`, "onesignal");
      return null;
    }
    try {
      return JSON.parse(text) as OneSignalNotificationReport;
    } catch {
      log(`OneSignal report ${notificationId}: non-JSON body`, "onesignal");
      return null;
    }
  } catch (e: any) {
    log(`OneSignal report fetch ${notificationId} failed: ${e?.message ?? e}`, "onesignal");
    return null;
  }
}

function logReport(notificationId: string, label: string, report: OneSignalNotificationReport | null): void {
  if (!report) {
    log(`OneSignal report ${notificationId} (${label}): (no report)`, "onesignal");
    return;
  }
  const counts = {
    recipients: report.recipients ?? null,
    successful: report.successful ?? null,
    failed: report.failed ?? null,
    errored: report.errored ?? null,
    converted: report.converted ?? null,
    remaining: report.remaining ?? null,
  };
  log(
    `OneSignal report ${notificationId} (${label}): ${JSON.stringify(counts)}`,
    "onesignal",
  );
  if (report.platform_delivery_stats) {
    log(
      `OneSignal report ${notificationId} platform_delivery_stats: ${JSON.stringify(report.platform_delivery_stats, null, 2)}`,
      "onesignal",
    );
  }
  if (report.errors) {
    log(
      `OneSignal report ${notificationId} per-recipient errors: ${JSON.stringify(report.errors)}`,
      "onesignal",
    );
  }
}

// Counters look "unpopulated" when OneSignal has accepted the
// notification but hasn't yet attributed any platform delivery to
// it — typical for the first ~2–5 s after POST, and also the
// expected steady state for a delivery_time_of_day send (counters
// stay at 0 until each recipient's local clock hits the trigger).
function reportLooksUnpopulated(r: OneSignalNotificationReport | null): boolean {
  if (!r) return true;
  const sum =
    (r.recipients ?? 0) +
    (r.successful ?? 0) +
    (r.failed ?? 0) +
    (r.errored ?? 0);
  return sum === 0 && !r.platform_delivery_stats;
}

// Fetch the delivery report immediately, log it, and — only if the
// counters look unpopulated — do exactly one follow-up fetch ~6s
// later. We deliberately do not poll past that; for
// delivery-time-of-day sends the report will keep reading 0 for a
// long time and that's already useful information.
async function logDeliveryReport(notificationId: string): Promise<void> {
  const immediate = await fetchDeliveryReport(notificationId);
  logReport(notificationId, "t+0", immediate);
  if (!reportLooksUnpopulated(immediate)) return;
  setTimeout(() => {
    fetchDeliveryReport(notificationId).then((r) => logReport(notificationId, "t+6s", r));
  }, 6000);
}

// Result of a single sendPushNotification call. `notificationId` is
// the OneSignal id from the FIRST batch (callers in the new
// pre-scheduler always pass <=1 recipient per call so this is
// always the right id to persist). Older callers that send broadly
// and don't care about the id can still ignore this field.
export interface SendPushResult {
  success: boolean;
  notificationId: string | null;
}

export async function sendPushNotification(payload: NotificationPayload): Promise<SendPushResult> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    log("OneSignal credentials not configured, skipping notification", "onesignal");
    return { success: false, notificationId: null };
  }

  // RULE B — guard send_after. A past timestamp is treated by
  // OneSignal as "send immediately", which silently negates the
  // whole point of pre-scheduling. Drop the field with a warning
  // and let the next pass requeue, rather than firing at the
  // wrong time.
  if (payload.send_after) {
    const ms = Date.parse(payload.send_after);
    if (!Number.isFinite(ms) || ms <= Date.now()) {
      log(
        `OneSignal send REJECTED: send_after=${payload.send_after} is invalid or not strictly in the future. Skipping send; next pass will requeue.`,
        "onesignal",
      );
      return { success: false, notificationId: null };
    }
  }

  const externalIds = Array.from(new Set(payload.externalIds ?? []));
  const playerIds = Array.from(new Set(payload.playerIds ?? []));

  if (externalIds.length === 0 && playerIds.length === 0) {
    log("No external_ids or player_ids to send to, skipping", "onesignal");
    return { success: false, notificationId: null };
  }

  // Choose the target axis. New callers always pass exactly one;
  // legacy callers (broad immediate sends) pass playerIds only.
  const useAliases = externalIds.length > 0;
  const targets = useAliases ? externalIds : playerIds;

  if (useAliases && payload.playerIds && payload.playerIds.length > 0) {
    log(
      `OneSignal send: external_ids and player_ids both provided; preferring external_ids (n=${externalIds.length})`,
      "onesignal",
    );
  }

  const batchSize = 2000;
  let totalSuccess = true;
  let firstNotificationId: string | null = null;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);

    const body: OneSignalRequestBody = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: payload.title },
      subtitle: { en: payload.subtitle },
      contents: { en: payload.message },
      url: payload.deepLink,
      data: { deepLink: payload.deepLink },
    };

    if (useAliases) {
      body.include_aliases = { external_id: batch };
      // RULE A — required for the alias path.
      body.target_channel = "push";
    } else {
      body.include_subscription_ids = batch;
    }

    if (payload.send_after) {
      body.send_after = payload.send_after;
    }
    if (payload.delivery_time_of_day) {
      body.delivery_time_of_day = payload.delivery_time_of_day;
    }
    if (payload.delayed_option) {
      body.delayed_option = payload.delayed_option;
    }

    // Full pretty-printed payload so we can see exactly what OneSignal
    // received — including every targeted id and every schedule-related
    // field. This is the diagnostic that lets us answer "did we even
    // send to this device?" without guessing.
    log(`OneSignal send → POST ${ONESIGNAL_API_URL}\n${JSON.stringify(body, null, 2)}`, "onesignal");

    try {
      const response = await fetch(ONESIGNAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      log(`OneSignal response (${response.status}): ${responseText}`, "onesignal");

      if (!response.ok) {
        totalSuccess = false;
      } else {
        try {
          const result = JSON.parse(responseText);
          if (result.errors && (Array.isArray(result.errors) ? result.errors.length > 0 : true)) {
            log(`OneSignal reported errors: ${JSON.stringify(result.errors)}`, "onesignal");
            totalSuccess = false;
          }
          // Capture the first batch's notification id so the
          // pre-scheduler can persist it for later cancellation.
          if (typeof result.id === "string" && result.id.length > 0) {
            const notificationId = result.id;
            if (firstNotificationId === null) firstNotificationId = notificationId;
            void logDeliveryReport(notificationId);
            // For delivery_time_of_day sends, also schedule a
            // post-trigger report so the actual recipient counts
            // show up in logs once the local time has passed.
            if (
              typeof payload.postTriggerReportAfterMs === "number" &&
              payload.postTriggerReportAfterMs > 0 &&
              payload.postTriggerReportAfterMs < 24 * 60 * 60_000
            ) {
              const label = payload.postTriggerReportLabel ?? "post-trigger";
              setTimeout(() => {
                fetchDeliveryReport(notificationId).then((r) =>
                  logReport(notificationId, label, r),
                );
              }, payload.postTriggerReportAfterMs);
            }
          }
        } catch {}
      }
    } catch (error: any) {
      log(`OneSignal request failed: ${error.message}`, "onesignal");
      totalSuccess = false;
    }
  }

  return { success: totalSuccess, notificationId: firstNotificationId };
}

// Cancel a previously scheduled OneSignal notification.
// Returns `{ ok: true }` ONLY when OneSignal confirms cancellation
// with an HTTP 2xx response. Any other outcome — non-2xx, network
// throw, missing credentials — returns `{ ok: false, status }` so
// the caller can decide whether to keep the local dedup row.
//
// Important: the pre-scheduler reconciler MUST keep the DB row
// when this returns false. Deleting a dedup row whose OneSignal
// notification is still live would let the bad notification
// deliver silently with no trace on our side.
export async function cancelOneSignalNotification(
  notificationId: string,
): Promise<{ ok: boolean; status: number | null }> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    log("OneSignal credentials not configured, cannot cancel notification", "onesignal");
    return { ok: false, status: null };
  }
  try {
    const url = `https://api.onesignal.com/notifications/${encodeURIComponent(notificationId)}?app_id=${encodeURIComponent(ONESIGNAL_APP_ID)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      log(`OneSignal cancel ${notificationId} HTTP ${response.status}: ${text}`, "onesignal");
      return { ok: false, status: response.status };
    }
    log(`OneSignal cancel ${notificationId} OK: ${text}`, "onesignal");
    return { ok: true, status: response.status };
  } catch (e: any) {
    log(`OneSignal cancel ${notificationId} failed: ${e?.message ?? e}`, "onesignal");
    return { ok: false, status: null };
  }
}

// Schema invariant: user_profiles.user_id is UNIQUE and
// user_profiles.onesignal_player_id is a single varchar — there is
// no way for one user to hold more than one active player_id.
// /api/onesignal/register already nulls the player_id from any other
// user_profiles row that shares the new id, which keeps each id
// associated with at most one user.
//
// This startup pass is a safety net for rows that pre-date that
// cross-user wipe: if any onesignal_player_id still appears in more
// than one row, keep only the row with the highest internal id
// (most recently inserted) and null out the rest. The "no
// duplicates" log line on a clean DB also serves as a positive
// assertion of the one-active-subscription-per-user invariant.
export async function cleanupDuplicatePlayerIds(): Promise<void> {
  try {
    const dups = await db
      .select({
        playerId: userProfiles.onesignalPlayerId,
        ids: sql<number[]>`array_agg(${userProfiles.id} ORDER BY ${userProfiles.id} DESC)`,
      })
      .from(userProfiles)
      .where(isNotNull(userProfiles.onesignalPlayerId))
      .groupBy(userProfiles.onesignalPlayerId)
      .having(sql`count(*) > 1`);

    if (dups.length === 0) {
      log("Player-id cleanup: no duplicates (one active subscription per user)", "onesignal");
      return;
    }

    let cleared = 0;
    for (const row of dups) {
      const ids = row.ids ?? [];
      const stale = ids.slice(1);
      if (stale.length === 0) continue;
      await db
        .update(userProfiles)
        .set({ onesignalPlayerId: null })
        .where(inArray(userProfiles.id, stale));
      cleared += stale.length;
      log(
        `Player-id cleanup: keeping id=${ids[0]} for ${row.playerId}, cleared ${stale.length} stale row(s) ${JSON.stringify(stale)}`,
        "onesignal",
      );
    }
    log(`Player-id cleanup: total cleared=${cleared} across ${dups.length} duplicate id(s)`, "onesignal");
  } catch (e: any) {
    log(`Player-id cleanup failed: ${e?.message ?? e}`, "onesignal");
  }
}
