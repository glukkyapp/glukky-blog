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
  playerIds: string[];
  send_after?: string;
  delivery_time_of_day?: string;
  delayed_option?: "timezone" | "last-active";
}

interface OneSignalRequestBody {
  app_id: string;
  include_subscription_ids: string[];
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

export async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    log("OneSignal credentials not configured, skipping notification", "onesignal");
    return false;
  }

  const uniquePlayerIds = Array.from(new Set(payload.playerIds));

  if (uniquePlayerIds.length === 0) {
    log("No player IDs to send to, skipping", "onesignal");
    return false;
  }

  if (uniquePlayerIds.length !== payload.playerIds.length) {
    log(`Deduplicated player IDs: ${payload.playerIds.length} -> ${uniquePlayerIds.length}`, "onesignal");
  }

  const batchSize = 2000;
  let totalSuccess = true;

  for (let i = 0; i < uniquePlayerIds.length; i += batchSize) {
    const batch = uniquePlayerIds.slice(i, i + batchSize);

    const body: OneSignalRequestBody = {
      app_id: ONESIGNAL_APP_ID,
      include_subscription_ids: batch,
      headings: { en: payload.title },
      subtitle: { en: payload.subtitle },
      contents: { en: payload.message },
      url: payload.deepLink,
      data: { deepLink: payload.deepLink },
    };

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
    // received — including every targeted subscription id and every
    // schedule-related field. This is the diagnostic that lets us
    // answer "did we even send to this device?" without guessing.
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
          // Fetch the delivery report immediately, then once more if
          // counters look unpopulated.
          if (typeof result.id === "string" && result.id.length > 0) {
            void logDeliveryReport(result.id);
          }
        } catch {}
      }
    } catch (error: any) {
      log(`OneSignal request failed: ${error.message}`, "onesignal");
      totalSuccess = false;
    }
  }

  return totalSuccess;
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
