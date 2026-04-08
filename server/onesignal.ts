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

    const body = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: batch,
      headings: { en: payload.title },
      subtitle: { en: payload.subtitle },
      contents: { en: payload.message },
      url: payload.deepLink,
      data: { deepLink: payload.deepLink },
    };

    try {
      const response = await fetch(ONESIGNAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`OneSignal API error (${response.status}): ${errorText}`, "onesignal");
        totalSuccess = false;
      } else {
        const result = await response.json();
        log(`Notification sent to ${batch.length} users: ${result.id}`, "onesignal");
      }
    } catch (error: any) {
      log(`OneSignal request failed: ${error.message}`, "onesignal");
      totalSuccess = false;
    }
  }

  return totalSuccess;
}
