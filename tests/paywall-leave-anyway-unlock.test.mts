/**
 * Regression test for the "blank page after leave-anyway → purchase" path.
 *
 * Imports the real production helper used by /api/refresh-premium-status
 * so this test fails the moment the decision matrix drifts.
 *
 * Run with: npx tsx tests/paywall-leave-anyway-unlock.test.mts
 */

import { strict as assert } from "assert";
import { computePremiumRefreshUpdate } from "../server/gate";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} ${detail}`);
    failed++;
  }
}

console.log("computePremiumRefreshUpdate regression\n");

console.log("Verified purchase clears stale hardLockedAfterAdviceDismiss");
{
  const update = computePremiumRefreshUpdate(
    { isPremium: false, hardLockedAfterAdviceDismiss: true },
    true,
  );
  check("update is produced", update !== null);
  check("isPremium flips true", update?.isPremium === true);
  check(
    "hardLockedAfterAdviceDismiss is reset to false",
    update?.hardLockedAfterAdviceDismiss === false,
    JSON.stringify(update),
  );
}

console.log("\nAlready-premium user with stale flag still gets it cleared");
{
  const update = computePremiumRefreshUpdate(
    { isPremium: true, hardLockedAfterAdviceDismiss: true },
    true,
  );
  check("update is produced", update !== null);
  check(
    "isPremium not written when unchanged",
    update !== null && !("isPremium" in update),
  );
  check(
    "hardLockedAfterAdviceDismiss reset to false",
    update?.hardLockedAfterAdviceDismiss === false,
  );
}

console.log("\nFree user with hard-lock and verify=false stays put");
{
  const update = computePremiumRefreshUpdate(
    { isPremium: false, hardLockedAfterAdviceDismiss: true },
    false,
  );
  check("no update when verify fails", update === null);
}

console.log("\nPremium-flips with no lock flag only writes isPremium");
{
  const update = computePremiumRefreshUpdate(
    { isPremium: false, hardLockedAfterAdviceDismiss: false },
    true,
  );
  check("isPremium flips", update?.isPremium === true);
  check(
    "hardLockedAfterAdviceDismiss not written when already false",
    update !== null && !("hardLockedAfterAdviceDismiss" in update),
  );
}

console.log("\nNo-op: nothing changes when neither side moves");
{
  const update = computePremiumRefreshUpdate(
    { isPremium: true, hardLockedAfterAdviceDismiss: false },
    true,
  );
  check("no update produced", update === null);
}

console.log("\nDowngrade: premium revokes don't touch the lock flag");
{
  const update = computePremiumRefreshUpdate(
    { isPremium: true, hardLockedAfterAdviceDismiss: false },
    false,
  );
  check("isPremium flips false", update?.isPremium === false);
  check(
    "hardLockedAfterAdviceDismiss left alone",
    update !== null && !("hardLockedAfterAdviceDismiss" in update),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
