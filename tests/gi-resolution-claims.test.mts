/**
 * Database-backed GI claim lease regression coverage.
 *
 * Run with: npx tsx tests/gi-resolution-claims.test.mts
 */
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  approveFoodGiSuggestion,
  claimFoodGiEntry,
  completeFoodGiEntry,
} from "../server/gi-resolution-storage";
import { foodGiEntries } from "../shared/schema";

const normalizedFoodName = `gi-claim-test-${randomUUID()}`;
const firstToken = randomUUID();
const secondToken = randomUUID();
const thirdToken = randomUUID();
const now = new Date();

try {
  const firstClaim = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: firstToken,
    now,
    claimExpiresAt: new Date(now.getTime() + 60_000),
  });
  const concurrentClaim = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: secondToken,
    now,
    claimExpiresAt: new Date(now.getTime() + 60_000),
  });
  assert.equal(firstClaim, true, "the first instance should win the atomic claim");
  assert.equal(concurrentClaim, false, "an unexpired claim must suppress duplicate AI work");

  const afterExpiry = new Date(now.getTime() + 60_001);
  const reclaimed = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: thirdToken,
    now: afterExpiry,
    claimExpiresAt: new Date(afterExpiry.getTime() + 60_000),
  });
  assert.equal(reclaimed, true, "an expired abandoned claim should be retryable");

  const staleOwnerCompletion = await completeFoodGiEntry({
    normalizedFoodName,
    claimToken: firstToken,
    status: "suggested",
    referenceId: "rice-white",
    giValue: 73,
    source: "test",
    resolvedAt: afterExpiry,
  });
  const currentOwnerCompletion = await completeFoodGiEntry({
    normalizedFoodName,
    claimToken: thirdToken,
    status: "suggested",
    referenceId: "rice-white",
    giValue: 73,
    source: "test",
    resolvedAt: afterExpiry,
  });
  assert.equal(staleOwnerCompletion, false, "a stale instance must not finalize a reclaimed entry");
  assert.equal(currentOwnerCompletion, true, "the current claim owner should save its suggestion");

  const postSuggestionClaim = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: randomUUID(),
    now: afterExpiry,
    claimExpiresAt: new Date(afterExpiry.getTime() + 60_000),
  });
  assert.equal(postSuggestionClaim, false, "a suggestion must not be re-claimed or re-generated");

  const approved = await approveFoodGiSuggestion({
    normalizedFoodName,
    referenceId: "rice-white",
    giValue: 73,
    source: "test-curator",
    resolvedAt: afterExpiry,
  });
  assert.equal(approved, true, "only an explicit curator transition makes a suggestion live");

  console.log("GI database claim lease: 7 passed");
} finally {
  await db.delete(foodGiEntries).where(eq(foodGiEntries.normalizedFoodName, normalizedFoodName));
  await pool.end();
}