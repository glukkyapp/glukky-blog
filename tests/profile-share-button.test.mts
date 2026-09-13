/**
 * Focused profile share-button contract checks.
 *
 * Run with: npx tsx tests/profile-share-button.test.mts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile = readFileSync("client/src/pages/profile.tsx", "utf8");
const documentHead = readFileSync("client/index.html", "utf8");
const posthog = readFileSync("client/src/lib/posthog.ts", "utf8");

assert.match(profile, /import \{ track \} from "@\/lib\/posthog";/);
assert.doesNotMatch(profile, /from ["']posthog-js["']/);

const handler = profile.match(/const handleShare = \(\) => \{([\s\S]*?)\n  \};/);
assert.ok(handler, "profile should define the share handler");
const handlerBody = handler[1];
assert.equal(
  (handlerBody.match(/;/g) ?? []).length,
  2,
  "share handler should contain exactly two actions",
);
assert.match(handlerBody, /track\("share_button_tapped"\);/);
assert.match(
  handlerBody,
  /window\.natively\.shareText\("Try this app: https:\/\/apps\.apple\.com\/app\/your-app-id"\);/,
);
assert.ok(
  handlerBody.indexOf('track("share_button_tapped")') <
    handlerBody.indexOf("window.natively.shareText"),
  "analytics should be captured before opening the share sheet",
);

assert.match(
  profile,
  /data-testid="profile-personal-shortcuts"[\s\S]*data-testid=\{`profile-shortcut-\$\{key\}`\}[\s\S]*data-testid="button-share-app"/,
);
assert.match(profile, /分享這個APP給朋友或家人/);
assert.match(
  profile,
  /data-testid="button-share-app"[\s\S]*分享這個APP給朋友或家人[\s\S]*<\/button>/,
);

assert.equal(
  (documentHead.match(/natively-frontend\.min\.js/g) ?? []).length,
  1,
  "BuildNatively SDK should remain installed exactly once",
);
assert.equal(
  (posthog.match(/import posthog from "posthog-js";/g) ?? []).length,
  1,
  "PostHog SDK should remain imported through the shared module",
);

console.log("profile share button tests passed");