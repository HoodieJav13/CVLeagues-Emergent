import test from "node:test";
import assert from "node:assert/strict";

import { summarizeChecks } from "./check_summary.mjs";

const pass = (name) => ({ name, status: "PASS" });
const fail = (name) => ({ name, status: "FAIL" });

test("keeps browser and privileged catalog totals distinct and combined", () => {
  const summary = summarizeChecks([pass("browser one"), fail("browser two")], [pass("catalog one")]);
  assert.deepEqual({
    browserPassed: summary.browserPassed,
    browserFailed: summary.browserFailed,
    catalogPassed: summary.catalogPassed,
    catalogFailed: summary.catalogFailed,
    combinedPassed: summary.combinedPassed,
    combinedFailed: summary.combinedFailed,
  }, {
    browserPassed: 1,
    browserFailed: 1,
    catalogPassed: 1,
    catalogFailed: 0,
    combinedPassed: 2,
    combinedFailed: 1,
  });
  assert.deepEqual(summary.checks.map((check) => check.name), ["catalog one", "browser one", "browser two"]);
});
