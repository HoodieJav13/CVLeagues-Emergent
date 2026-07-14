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

test("server configuration fails closed when any secret setting is absent", () => {
  assert.throws(
    () => _test.readConfig({ SUPABASE_URL: "https://example.supabase.co" }),
    /temporarily unavailable/,
  );
});
