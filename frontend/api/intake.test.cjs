const test = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("./intake");

test("team registration validation returns only the database allowlist", () => {
  const row = _test.validateTeamRegistration({
    captain_name: "  Captain Example ",
    captain_email: "captain@example.com",
    captain_phone: "",
    sport: "kickball",
    team_name: " Sandias ",
    estimated_roster_size: "12",
    preferred_season: "Summer 2026",
    consent_to_contact: true,
    notes: "Ready",
    status: "approved",
  });
  assert.deepEqual(row, {
    captain_name: "Captain Example",
    captain_phone: null,
    captain_email: "captain@example.com",
    sport: "kickball",
    team_name: "Sandias",
    estimated_roster_size: 12,
    preferred_season: "Summer 2026",
    consent_to_contact: true,
    notes: "Ready",
  });
});

test("free agent validation rejects invalid enumerations and requires contact", () => {
  assert.throws(
    () => _test.validateFreeAgent({ first_name: "A", last_name: "B", sports: ["basketball"], availability: [], consent_to_contact: true }),
    /Phone or email is required/,
  );
  assert.throws(
    () => _test.validateFreeAgent({ first_name: "A", last_name: "B", email: "a@example.com", sports: ["basketball"], availability: [], consent_to_contact: true }),
    /Sports is invalid/,
  );
});

test("Turnstile validation binds the token to action and hostname", async () => {
  const config = { turnstileSecretKey: "test-secret", allowedHostnames: new Set(["preview.example.com"]) };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ success: true, action: "free_agent", hostname: "preview.example.com" }) });
  await _test.verifyTurnstile({ token: "token", action: "free_agent", remoteIp: "127.0.0.1", config, fetchImpl });
  await assert.rejects(
    _test.verifyTurnstile({ token: "token", action: "team_registration", remoteIp: "127.0.0.1", config, fetchImpl }),
    /Human verification failed/,
  );
});

test("Turnstile validation rejects malformed and oversized tokens before the network", async () => {
  const config = { turnstileSecretKey: "test-secret", allowedHostnames: new Set(["preview.example.com"]) };
  const fetchImpl = async () => assert.fail("Malformed tokens must not reach Siteverify.");

  for (const token of [null, "", 123, "x".repeat(2049)]) {
    await assert.rejects(
      _test.verifyTurnstile({ token, action: "free_agent", config, fetchImpl }),
      /Human verification is required/,
    );
  }
});

test("Turnstile validation rejects a valid token from an unapproved hostname", async () => {
  const config = { turnstileSecretKey: "test-secret", allowedHostnames: new Set(["preview.example.com"]) };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ success: true, action: "free_agent", hostname: "attacker.example" }) });

  await assert.rejects(
    _test.verifyTurnstile({ token: "token", action: "free_agent", config, fetchImpl }),
    /Human verification failed/,
  );
});

test("Turnstile validation fails closed on a non-success Siteverify response", async () => {
  const config = { turnstileSecretKey: "test-secret", allowedHostnames: new Set(["preview.example.com"]) };
  const fetchImpl = async () => ({ ok: false });

  await assert.rejects(
    _test.verifyTurnstile({ token: "token", action: "free_agent", config, fetchImpl }),
    /temporarily unavailable/,
  );
});

test("Turnstile validation fails closed on a Siteverify network error", async () => {
  const config = { turnstileSecretKey: "test-secret", allowedHostnames: new Set(["preview.example.com"]) };
  const fetchImpl = async () => { throw new Error("network unavailable"); };

  await assert.rejects(
    _test.verifyTurnstile({ token: "token", action: "free_agent", config, fetchImpl }),
    /temporarily unavailable/,
  );
});

test("Turnstile validation aborts a stalled Siteverify request and fails closed", async () => {
  const config = { turnstileSecretKey: "test-secret", allowedHostnames: new Set(["preview.example.com"]) };
  const nativeSetTimeout = global.setTimeout;
  global.setTimeout = (callback) => nativeSetTimeout(callback, 0);

  try {
    const fetchImpl = async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    await assert.rejects(
      _test.verifyTurnstile({ token: "token", action: "free_agent", config, fetchImpl }),
      /temporarily unavailable/,
    );
  } finally {
    global.setTimeout = nativeSetTimeout;
  }
});

test("server configuration fails closed when any secret setting is absent", () => {
  assert.throws(
    () => _test.readConfig({ SUPABASE_URL: "https://example.supabase.co" }),
    /temporarily unavailable/,
  );
});
