import assert from "node:assert/strict";
import {
  clampGardenPoints,
  getGardenLayerKeys,
  getGardenTree,
  isGardenComplete,
  renderOrder,
} from "../client/src/components/harbour-garden-state";

assert.deepEqual(renderOrder, [
  "background", "tree", "flower1", "flower2", "bird",
  "bench", "lamp", "flower3", "ferry", "flower4",
]);

const cases = [
  [0, null, ["background"]],
  [1, "seedling", ["background", "tree"]],
  [5, "seedling", ["background", "tree", "flower1"]],
  [7, "small-tree", ["background", "tree", "flower1"]],
  [11, "small-tree", ["background", "tree", "flower1", "flower2"]],
  [16, "young-tree", ["background", "tree", "flower1", "flower2"]],
  [20, "young-tree", ["background", "tree", "flower1", "flower2", "bird"]],
  [25, "young-tree", ["background", "tree", "flower1", "flower2", "bird", "bench"]],
  [31, "complete-tree", ["background", "tree", "flower1", "flower2", "bird", "bench"]],
  [35, "complete-tree", ["background", "tree", "flower1", "flower2", "bird", "bench", "lamp"]],
  [40, "complete-tree", ["background", "tree", "flower1", "flower2", "bird", "bench", "lamp", "flower3"]],
  [46, "complete-tree", ["background", "tree", "flower1", "flower2", "bird", "bench", "lamp", "flower3", "ferry"]],
  [55, "complete-tree", [...renderOrder]],
  [60, "complete-tree", [...renderOrder]],
] as const;

for (const [points, tree, layers] of cases) {
  assert.equal(getGardenTree(points), tree, `tree at ${points}`);
  assert.deepEqual(getGardenLayerKeys(points), layers, `layers at ${points}`);
}

assert.equal(clampGardenPoints(-1), 0);
assert.equal(clampGardenPoints(61), 60);
assert.equal(isGardenComplete(59), false);
assert.equal(isGardenComplete(60), true);
assert.equal(isGardenComplete(61), true);
assert.deepEqual(getGardenLayerKeys(59), [...renderOrder]);
assert.deepEqual(getGardenLayerKeys(61), [...renderOrder]);

console.log("Harbour Garden thresholds and render order passed");