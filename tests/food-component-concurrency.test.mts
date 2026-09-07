import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FoodItemMetadata } from "../shared/schema";
import { foodComponents, foodComponentTerms } from "../shared/schema";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";

const suffix = randomUUID().replaceAll("-", "");
const item: FoodItemMetadata = {
  nameEn: `Concurrency food ${suffix}`,
  nameZhHant: `並行食物${suffix}`,
  nameYue: `並行食物粵${suffix}`,
  isCarb: false,
  carbCategory: null,
  carbSubtype: null,
  sweetCategory: null,
  isSweet: false,
  suggestedSubtype: null,
  subtypeConfirmed: false,
  source: "claude",
};

let createdId: string | undefined;
try {
  const [first, second] = await Promise.all([
    storage.resolveOrCreateFoodItems([item]),
    storage.resolveOrCreateFoodItems([item]),
  ]);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0].id, second[0].id, "concurrent identical foods must converge on one ID");
  createdId = first[0].id;
  assert.ok(createdId);

  const matchingRows = await db.select({ id: foodComponents.id })
    .from(foodComponents)
    .where(eq(foodComponents.labelEn, item.nameEn));
  assert.equal(matchingRows.length, 1, "the catalog must contain exactly one winning component");
  console.log("Food component concurrent creation: 4 passed");
} finally {
  if (createdId) {
    await db.delete(foodComponentTerms).where(eq(foodComponentTerms.foodComponentId, createdId));
    await db.delete(foodComponents).where(eq(foodComponents.id, createdId));
  }
  await pool.end();
}