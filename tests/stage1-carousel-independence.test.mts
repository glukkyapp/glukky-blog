import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preloadSource = readFileSync("client/src/lib/preload-assets.ts", "utf8");
const landingSource = readFileSync("client/src/pages/landing.tsx", "utf8");
const loadingSource = readFileSync(
  "client/src/components/cube-loading-screen.tsx",
  "utf8",
);

const stage1Match = preloadSource.match(
  /const STAGE_1:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/,
);
assert.ok(stage1Match, "Stage 1 resource list must remain explicit");
assert.equal(
  stage1Match[1].trim(),
  "preLoginBrandMark",
  "the brand mark must be the sole Stage 1 visual resource",
);

for (const slideImport of ["slide1Img", "slide2Img", "slide3Img"]) {
  assert.doesNotMatch(
    preloadSource,
    new RegExp(`import\\s+${slideImport}\\s+from`),
    `${slideImport} must not be imported by the Stage 1 preload module`,
  );
  assert.match(
    landingSource,
    new RegExp(`import\\s+${slideImport}\\s+from`),
    `${slideImport} must remain imported by Landing`,
  );
  assert.match(
    landingSource,
    new RegExp(`image:\\s*${slideImport}\\b`),
    `${slideImport} must remain available in the Landing carousel`,
  );
}

assert.match(
  landingSource,
  /data-testid="landing-lang-screen"[\s\S]*?<img[\s\S]*?src=\{preLoginBrandMark\}/,
  "the initial language screen must continue to render the brand mark",
);
assert.match(
  landingSource,
  /data-testid=\{`slide-dot-\$\{i\}`\}/,
  "the carousel must retain direct navigation for every slide",
);
assert.match(
  landingSource,
  /onTouchEnd=\{\(e\) => \{[\s\S]*?handleSlideNext\(\);[\s\S]*?setSlideIndex/,
  "the carousel must remain swipeable in both directions",
);
assert.match(
  loadingSource,
  /const MIN_DURATION_MS = 14_000;/,
  "the deterministic 14-second launch minimum must remain unchanged",
);

console.log("Stage 1 carousel independence contract passed");
