import { createHash } from "node:crypto";

// Fixed application namespace for automatic notification trigger identities.
// UUIDv5 keeps the same logical trigger stable across processes and restarts.
const AUTOMATIC_NOTIFICATION_NAMESPACE = "6a4d9f7e-6751-4ab7-8f5b-cadf52b44b54";

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function automaticNotificationIdempotencyKey(
  userId: string,
  notificationType: string,
  localTriggerDate: string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localTriggerDate)) {
    throw new Error(`Invalid canonical local trigger date: ${localTriggerDate}`);
  }

  // A JSON tuple is an unambiguous encoding: component boundaries and string
  // escaping cannot collide (unlike delimiter-based concatenation).
  const triggerIdentity = JSON.stringify([userId, notificationType, localTriggerDate]);
  const bytes = createHash("sha1")
    .update(uuidBytes(AUTOMATIC_NOTIFICATION_NAMESPACE))
    .update(triggerIdentity, "utf8")
    .digest()
    .subarray(0, 16);

  // RFC 9562 UUIDv5 version and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}