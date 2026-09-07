import assert from "node:assert/strict";
import fs from "node:fs";
import { automaticNotificationIdempotencyKey } from "../server/notification-idempotency.ts";

const trigger = ["user-a", "foodsnap_reminder", "2026-09-07"] as const;
const expected = automaticNotificationIdempotencyKey(...trigger);

assert.equal(
  expected,
  "5322f0f9-9fa4-57c5-b1d9-97450fd50420",
  "the fixed namespace and encoding must remain stable across runtimes and releases",
);
assert.match(
  expected,
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  "key must be an RFC 9562 UUIDv5",
);
assert.equal(automaticNotificationIdempotencyKey(...trigger), expected);
assert.deepEqual(
  await Promise.all(
    Array.from({ length: 20 }, async () => automaticNotificationIdempotencyKey(...trigger)),
  ),
  Array(20).fill(expected),
  "concurrent computation must be stable",
);

assert.notEqual(
  automaticNotificationIdempotencyKey("user-b", trigger[1], trigger[2]),
  expected,
  "changing the user must change the key",
);
assert.notEqual(
  automaticNotificationIdempotencyKey(trigger[0], "reengagement", trigger[2]),
  expected,
  "changing the notification type must change the key",
);
assert.notEqual(
  automaticNotificationIdempotencyKey(trigger[0], trigger[1], "2026-09-08"),
  expected,
  "changing the local trigger date must change the key",
);
assert.throws(
  () => automaticNotificationIdempotencyKey(trigger[0], trigger[1], "09/07/2026"),
  /Invalid canonical local trigger date/,
);

const notificationsSource = fs.readFileSync("server/notifications.ts", "utf8");
const oneSignalSource = fs.readFileSync("server/onesignal.ts", "utf8");
const routesSource = fs.readFileSync("server/routes.ts", "utf8");

assert.match(
  notificationsSource,
  /automaticNotificationIdempotencyKey\(\s*user\.userId,\s*type,\s*next\.localTriggerDate,\s*\)/,
  "automatic scheduling must derive identity from exactly the logical trigger components",
);
assert.match(
  notificationsSource,
  /sendPushNotification\(\{[\s\S]*?idempotencyKey,[\s\S]*?\}\)/,
  "automatic scheduling must forward the computed key",
);
assert.match(
  oneSignalSource,
  /if \(payload\.idempotencyKey\) \{\s*body\.idempotency_key = payload\.idempotencyKey;\s*\}/,
  "the existing Create Message body must forward an explicitly supplied key",
);
assert.doesNotMatch(
  routesSource,
  /sendPushNotification\(\{[\s\S]{0,1000}?idempotencyKey/,
  "non-automatic route callers must not gain a generated key",
);

console.log("Automatic notification idempotency tests passed.");