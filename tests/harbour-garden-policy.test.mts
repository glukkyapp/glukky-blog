import assert from "node:assert/strict";
import { isDevelopmentGardenRouteAvailable } from "../server/piggy-bank-policy";

assert.equal(isDevelopmentGardenRouteAvailable("production"), false);
assert.equal(isDevelopmentGardenRouteAvailable("development"), true);
assert.equal(isDevelopmentGardenRouteAvailable("test"), true);
assert.equal(isDevelopmentGardenRouteAvailable(undefined), true);

console.log("Harbour Garden development-route policy passed");