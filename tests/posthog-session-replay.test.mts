/**
 * Focused PostHog Session Replay contract checks.
 *
 * Run with: npx tsx tests/posthog-session-replay.test.mts
 */

import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";

const posthogSource = readFileSync("client/src/lib/posthog.ts", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const consentSource = readFileSync("client/src/contexts/consent-context.tsx", "utf8");
const serverSource = readFileSync("server/posthog.ts", "utf8");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function check(label: string, condition: boolean): void {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
}

console.log("PostHog Session Replay");
check(
  "browser initialization explicitly disables Session Replay",
  /posthog\.init\(key,\s*\{[\s\S]*disable_session_recording:\s*true/.test(posthogSource),
);
check(
  "application code never starts Session Replay",
  !sourceFiles("client/src")
    .concat(sourceFiles("server"))
    .some((path) => readFileSync(path, "utf8").includes("startSessionRecording(")),
);
check(
  "normal analytics and exception capture remain available",
  posthogSource.includes("posthog.capture(")
    && posthogSource.includes("posthog.identify(")
    && posthogSource.includes("export function trackException"),
);
check(
  "consent gating remains connected to initialization",
  appSource.includes("initPostHog(posthogConsentRef.current)")
    && appSource.includes("consentState.posthog === false"),
);
check(
  "server-side PostHog capture remains available",
  serverSource.includes("trackServer")
    && serverSource.includes("captureException"),
);
check(
  "replay is not manually stopped as a replacement flow",
  !posthogSource.includes("stopSessionRecording("),
);

console.log("\n6 passed");