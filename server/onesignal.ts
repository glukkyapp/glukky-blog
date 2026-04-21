import { log } from "./index";

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

    const scheduleInfo: string[] = [];
    if (payload.send_after) scheduleInfo.push(`send_after: ${payload.send_after}`);
    if (payload.delivery_time_of_day) scheduleInfo.push(`delivery_time_of_day: ${payload.delivery_time_of_day}`);
    if (payload.delayed_option) scheduleInfo.push(`delayed_option: ${payload.delayed_option}`);
    log(`Sending notification to ${batch.length} subscription(s): ${JSON.stringify(batch)}${scheduleInfo.length > 0 ? ` (${scheduleInfo.join(", ")})` : ""}`, "onesignal");

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
          if (result.errors && result.errors.length > 0) {
            log(`OneSignal reported errors: ${JSON.stringify(result.errors)}`, "onesignal");
            totalSuccess = false;
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
