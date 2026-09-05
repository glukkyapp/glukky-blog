/**
 * Database-backed GI claim lease regression coverage.
 *
 * Run with: npx tsx tests/gi-resolution-claims.test.mts
 */
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { claimFoodGiEntry, completeFoodGiEntry } from "../server/gi-resolution-storage";
import { foodGiEntries } from "../shared/schema";

const normalizedFoodName = `gi-claim-test-${randomUUID()}`;
const firstToken = randomUUID();
const secondToken = randomUUID();
const thirdToken = randomUUID();
const now = new Date();
const retryNoMatchBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

try {
  const firstClaim = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: firstToken,
    now,
    retryNoMatchBefore,
    claimExpiresAt: new Date(now.getTime() + 60_000),
  });
  const concurrentClaim = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: secondToken,
    now,
    retryNoMatchBefore,
    claimExpiresAt: new Date(now.getTime() + 60_000),
  });
  assert.equal(firstClaim, true, "the first instance should win the atomic claim");
  assert.equal(concurrentClaim, false, "an unexpired claim must suppress duplicate AI work");

  const afterExpiry = new Date(now.getTime() + 60_001);
  const reclaimed = await claimFoodGiEntry({
    normalizedFoodName,
    claimToken: thirdToken,
    now: afterExpiry,
    retryNoMatchBefore,
    claimExpiresAt: new Date(afterExpiry.getTime() + 60_000),
  });
  assert.equal(reclaimed, true, "an expired abandoned claim should be retryable");

  const staleOwnerCompletion = await completeFoodGiEntry({
    normalizedFoodName,
    claimToken: firstToken,
    status: "resolved",
    referenceId: "rice-white",
    giValue: 73,
    source: "test",
    resolvedAt: afterExpiry,
  });
  const currentOwnerCompletion = await completeFoodGiEntry({
    normalizedFoodName,
    claimToken: thirdToken,
    status: "resolved",
    referenceId: "rice-white",
    giValue: 73,
    source: "test",
    resolvedAt: afterExpiry,
  });
  assert.equal(staleOwnerCompletion, false, "a stale instance must not finalize a reclaimed entry");
  assert.equal(currentOwnerCompletion, true, "the current claim owner should finalize its result");

  console.log("GI database claim lease: 6 passed");
} finally {
  await db.delete(foodGiEntries).where(eq(foodGiEntries.normalizedFoodName, normalizedFoodName));
  await pool.end();
}