import { strict as assert } from "node:assert";
import {
  HSTIX_CORRECTION_WINDOW_MS,
  hstixCorrectionExpiresAt,
  isHstixCorrectionOpen,
} from "../server/hstix-correction";

const recordedAt = new Date("2026-08-23T12:00:00.000Z");
const expiresAt = hstixCorrectionExpiresAt(recordedAt);

assert.equal(expiresAt.toISOString(), "2026-08-23T12:05:00.000Z");
assert.equal(
  isHstixCorrectionOpen(recordedAt, new Date(expiresAt.getTime() - 1)),
  true,
  "the record is correctable before the server-issued expiry",
);
assert.equal(
  isHstixCorrectionOpen(recordedAt, expiresAt),
  false,
  "the record is rejected at the exact five-minute boundary",
);
assert.equal(
  isHstixCorrectionOpen(recordedAt, new Date(expiresAt.getTime() + 1)),
  false,
  "the record remains rejected after expiry",
);
assert.equal(HSTIX_CORRECTION_WINDOW_MS, 5 * 60 * 1000);

console.log("4 HStix correction-window checks passed");