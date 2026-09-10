import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer = readFileSync("client/src/components/piggy-bank-svg.tsx", "utf8");
const card = readFileSync("client/src/components/piggy-bank-card.tsx", "utf8");
const dailyTask = readFileSync("client/src/components/daily-task-card.tsx", "utf8");

assert.match(renderer, /useReducedMotion\(\)/);
assert.match(renderer, /initial=\{newLayerKeys\.has\(visualKey\) && !reduceMotion/);
assert.match(renderer, /key=\{visualKey\}/);
assert.match(renderer, /rounded-2xl/);
assert.match(renderer, /boxShadow:/);
assert.match(card, /previousCoins=\{prevCoins\.current\}/);
assert.match(card, /isFull && \(/);
assert.match(card, /button-start-new-garden/);
assert.match(card, /dialog-start-new-garden/);
assert.match(card, /\/api\/piggybank\/start-new-garden/);
assert.match(card, /invalidateQueries\(\{ queryKey: \["\/api\/piggybank"\] \}\)/);
assert.match(card, /startNewGardenMutation\.isPending/);
assert.match(dailyTask, /refetchInterval: 60_000/);
assert.match(dailyTask, /refetchOnWindowFocus: "always"/);
assert.match(dailyTask, /refetchOnMount: "always"/);

console.log("Harbour Garden motion and image-surface contract passed");