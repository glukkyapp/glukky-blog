import { strict as assert } from "node:assert";
import {
  GI_REFERENCE_CANDIDATES,
  getGiCandidatesForFood,
  getPublicGiState,
  giFoodKey,
} from "../server/gi-resolution";

const food = {
  nameEn: "White rice",
  nameZhHant: " 白 飯 ",
  nameYue: "白飯",
};

assert.equal(giFoodKey(food), "白飯", "the canonical GI key is normalized Traditional Chinese only");
assert.equal(
  giFoodKey({ ...food, nameEn: "Brown rice", nameYue: "糙米" }),
  giFoodKey({ ...food, nameEn: "White rice", nameYue: "白飯" }),
  "English and Cantonese aliases must not affect a live GI key",
);

assert.deepEqual(
  getGiCandidatesForFood({ ...food, nameEn: "rice bowl", nameZhHant: "白飯配餸", nameYue: "" }),
  [],
  "candidate suggestions must not use substring matching",
);
assert.deepEqual(
  getGiCandidatesForFood({ ...food, nameEn: "red rice", nameZhHant: "紅米飯", nameYue: "紅米飯" }),
  [],
  "red rice must not inherit the brown-rice reference suggestion",
);
assert.equal(
  GI_REFERENCE_CANDIDATES.some(candidate => candidate.aliases.includes("紅米飯")),
  false,
  "the brown-rice red-rice alias must not exist",
);

assert.deepEqual(
  getPublicGiState({ status: "suggested", giValue: 73, resolvedAt: new Date() }),
  { giRank: null, giStatus: "pending" },
  "unapproved suggestions must never be public GI values",
);
assert.deepEqual(
  getPublicGiState({ status: "no_match", giValue: null, resolvedAt: new Date() }),
  { giRank: null, giStatus: "pending" },
  "an automated no-match remains pending publicly",
);
assert.deepEqual(
  getPublicGiState({ status: "unavailable", giValue: null, resolvedAt: new Date() }),
  { giRank: null, giStatus: "unavailable" },
  "only an explicit unavailable decision is public as unavailable",
);

console.log("GI resolution policy: 8 passed");