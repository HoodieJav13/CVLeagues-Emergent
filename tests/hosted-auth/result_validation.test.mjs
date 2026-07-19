import test from "node:test";
import assert from "node:assert/strict";

import { validateBrowserResult } from "./result_validation.mjs";

function result(overrides = {}) {
  return {
    startedAt: "2026-07-17T00:00:00.000Z",
    finishedAt: "2026-07-17T00:01:00.000Z",
    checks: [{
      category: "MFA authorization",
      name: "linked password-only administrator is not authorized",
      status: "PASS",
      detail: "Expected behavior observed.",
    }],
    ...overrides,
  };
}

test("allows legitimate password-only authorization evidence", () => {
  assert.doesNotThrow(() => validateBrowserResult(result()));
});

test("rejects credential fields outside the allowlisted report schema", () => {
  assert.throws(() => validateBrowserResult(result({ password: "not-allowed" })), /unexpected top-level field/);
});

test("rejects credential fields smuggled into a check", () => {
  const payload = result();
  payload.checks[0].adminTotp = "123456";
  assert.throws(() => validateBrowserResult(payload), /unexpected check field/);
});

test("rejects bearer tokens inside allowed text fields", () => {
  const payload = result();
  payload.checks[0].detail = "Bearer sensitive-token";
  assert.throws(() => validateBrowserResult(payload), /credential-shaped value/);
});

test("rejects invalid check statuses", () => {
  const payload = result();
  payload.checks[0].status = "UNKNOWN";
  assert.throws(() => validateBrowserResult(payload), /invalid check status/);
});
