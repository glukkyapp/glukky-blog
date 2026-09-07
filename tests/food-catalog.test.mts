import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  createFoodComponentId,
  normalizeFoodTerm,
  parseFoodCatalogCsv,
  resolveExactFoodComponent,
} from "../server/food-catalog";

const csv = readFileSync("attached_assets/hk_carb_catalog_49_no_gi_reference_1788772727567.csv", "utf8");
const rows = parseFoodCatalogCsv(csv);
assert.equal(rows.length, 49, "the supplied catalog has exactly 49 data rows");
assert.equal(rows.find(row => row.internalId === "red_rice")?.aliases.includes("糙米"), false,
  "red rice is never silently merged with brown rice");
assert.equal(rows.find(row => row.internalId === "pineapple_bun")?.sweetCategory, "sweet_food");

assert.equal(normalizeFoodTerm(" Whole-grain　Rice! "), "wholegrainrice");
assert.equal(normalizeFoodTerm("白　飯"), "白飯");
const id = createFoodComponentId(1_700_000_000_000);
assert.match(id, /^food_[0-9A-HJKMNP-TV-Z]{26}$/, "runtime IDs use food_<ULID>");

const componentId = "food_00000000000000000000000001";
const candidate = (id: string, termType: "official" | "alias" = "official") => ({
  id: componentId, active: true, verified: true,
  term: { id, foodComponentId: componentId, locale: "en", term: "White rice", normalizedTerm: "whiterice", termType },
});
const resolved = resolveExactFoodComponent(" white-rice ", "en", [candidate("term_00000000000000000000000001")]);
assert.deepEqual(resolved, { resolved: {
  id: componentId, source: "catalog_match",
}});
const ambiguous = resolveExactFoodComponent("white rice", "en", [
  candidate("term_00000000000000000000000001"),
  { ...candidate("term_00000000000000000000000002"), id: "food_00000000000000000000000002",
    term: { ...candidate("x").term, id: "term_00000000000000000000000002", foodComponentId: "food_00000000000000000000000002" } },
]);
assert.equal("unresolved" in ambiguous && ambiguous.unresolved.reason === "ambiguous", true);
assert.equal("resolved" in resolveExactFoodComponent("white rice", "en", Array.from({ length: 9 }, () => candidate("term_x"))), false,
  "broad query candidate lists fail closed");

console.log("food catalog tests passed");