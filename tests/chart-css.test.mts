import assert from "node:assert/strict"
import test from "node:test"

import {
  buildChartCss as buildAppChartCss,
  isSafeChartColor,
  isSafeChartIdentifier,
} from "../client/src/components/ui/chart-css"
import { buildChartCss as buildMockupChartCss } from "../artifacts/mockup-sandbox/src/components/ui/chart-css"

const builders = [
  ["application", buildAppChartCss],
  ["mockup sandbox", buildMockupChartCss],
] as const

test("accepts generated and conservative explicit identifiers", () => {
  for (const value of ["chart-r0", "chart-R12", "chart_explicit-7", "A"]) {
    assert.equal(isSafeChartIdentifier(value), true)
  }
  for (const value of ["chart-r0]", "chart id", 'chart-"bad', "", null]) {
    assert.equal(isSafeChartIdentifier(value), false)
  }
})

test("accepts only supported hex and numeric rgb(a) colors", () => {
  for (const value of [
    "#abc",
    "#abcd",
    "#A1b2C3",
    "#A1b2C3d4",
    "rgb(0, 128, 255)",
    "rgba(1,2,3,0)",
    "rgba(1, 2, 3, .5)",
    "rgba(1, 2, 3, 1.0)",
  ]) {
    assert.equal(isSafeChartColor(value), true, value)
  }
  for (const value of [
    "#ab",
    "red",
    "var(--safe)",
    "rgb(256, 0, 0)",
    "rgb(0, 0, 0, 1)",
    "rgba(0, 0, 0)",
    "rgba(0, 0, 0, 1.1)",
    "rgb(0,\n0,0)",
    "#fff; color:red",
    "rgb(0,0,0)} body { color:red",
  ]) {
    assert.equal(isSafeChartColor(value), false, value)
  }
})

for (const [name, buildChartCss] of builders) {
  test(`${name} isolates invalid chart values`, () => {
    const css = buildChartCss("chart-r0", {
      valid_hex: { color: "#abc" },
      "bad;key": { color: "#fff" },
      invalidColor: { color: "#fff; background:red" },
      mixedTheme: { theme: { light: "rgb(1, 2, 3)", dark: "red" } },
      goodTheme: { theme: { light: "#123456", dark: "rgba(4,5,6,.75)" } },
      malformed: null,
    })

    assert.match(css ?? "", /\[data-chart="chart-r0"\]/)
    assert.match(css ?? "", /--color-valid_hex: #abc;/)
    assert.match(css ?? "", /--color-mixedTheme: rgb\(1, 2, 3\);/)
    assert.match(css ?? "", /--color-goodTheme: #123456;/)
    assert.match(css ?? "", /--color-goodTheme: rgba\(4,5,6,.75\);/)
    assert.doesNotMatch(css ?? "", /bad;key|background:red|--color-invalidColor/)
    assert.equal((css?.match(/--color-mixedTheme/g) ?? []).length, 1)
  })

  test(`${name} suppresses unsafe selectors without affecting callers`, () => {
    assert.equal(
      buildChartCss('chart-x"] { color:red } body', { safe: { color: "#fff" } }),
      null
    )
    assert.equal(buildChartCss("chart-safe", null), null)
    assert.equal(buildChartCss("chart-safe", { safe: { color: "red" } }), null)
    assert.equal(
      buildChartCss("chart-safe", {
        safe: { color: "#fff" },
        get broken() {
          throw new Error("malformed configuration")
        },
      }),
      '[data-chart="chart-safe"] {\n  --color-safe: #fff;\n}\n\n.dark [data-chart="chart-safe"] {\n  --color-safe: #fff;\n}\n'
    )
  })
}