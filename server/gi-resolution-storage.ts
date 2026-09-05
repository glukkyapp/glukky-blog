import { sql } from "drizzle-orm";
import { db } from "./db";

export type ClaimFoodGiEntryInput = {
  normalizedFoodName: string;
  claimToken: string;
  now: Date;
  retryNoMatchBefore: Date;
  claimExpiresAt: Date;
};

export async function claimFoodGiEntry(entry: ClaimFoodGiEntryInput): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO food_gi_entries (
      normalized_food_name, status, reference_id, gi_value, source, resolved_at, claim_expires_at, claim_token
    )
    VALUES (
      ${entry.normalizedFoodName}, 'pending', NULL, NULL, 'pending', ${entry.now}, ${entry.claimExpiresAt}, ${entry.claimToken}
    )
    ON CONFLICT (normalized_food_name) DO UPDATE SET
      status = 'pending',
      reference_id = NULL,
      gi_value = NULL,
      source = 'pending',
      resolved_at = ${entry.now},
      claim_expires_at = ${entry.claimExpiresAt},
      claim_token = ${entry.claimToken}
    WHERE (
      food_gi_entries.status = 'no_match'
      AND food_gi_entries.resolved_at <= ${entry.retryNoMatchBefore}
    ) OR (
      food_gi_entries.status = 'pending'
      AND (
        food_gi_entries.claim_expires_at IS NULL
        OR food_gi_entries.claim_expires_at <= ${entry.now}
      )
    )
    RETURNING normalized_food_name
  `);
  return result.rows.length === 1;
}

export type CompleteFoodGiEntryInput = {
  normalizedFoodName: string;
  claimToken: string;
  status: "resolved" | "no_match";
  referenceId: string | null;
  giValue: number | null;
  source: string;
  resolvedAt: Date;
};

export async function completeFoodGiEntry(entry: CompleteFoodGiEntryInput): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE food_gi_entries SET
      status = ${entry.status},
      reference_id = ${entry.referenceId},
      gi_value = ${entry.giValue},
      source = ${entry.source},
      resolved_at = ${entry.resolvedAt},
      claim_expires_at = NULL,
      claim_token = NULL
    WHERE normalized_food_name = ${entry.normalizedFoodName}
      AND status = 'pending'
      AND claim_token = ${entry.claimToken}
    RETURNING normalized_food_name
  `);
  return result.rows.length === 1;
}