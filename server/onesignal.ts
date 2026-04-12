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
  delayed_option?: "timezone" | "last-active";
}

export async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    log("OneSignal credentials not configured, skipping notification", "onesignal");
    return false;
  }

  if (payload.playerIds.length === 0) {
    log("No player IDs to send to, skipping", "onesignal");
    return false;
  }

  const batchSize = 2000;
  let totalSuccess = true;

  for (let i = 0; i < payload.playerIds.length; i += batchSize) {
    const batch = payload.playerIds.slice(i, i + batchSize);

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
    if (payload.delayed_option) {
      body.delayed_option = payload.delayed_option;
    }

    log(`Sending notification to ${batch.length} subscription(s): ${JSON.stringify(batch)}${payload.send_after ? ` (send_after: ${payload.send_after}, delayed_option: ${payload.delayed_option})` : ""}`, "onesignal");

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
