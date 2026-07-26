import test from "node:test";
import assert from "node:assert/strict";
import handler, { readQuery, readConfig, feedName, loadFeedData, _test } from "./calendar.mjs";

/* ============================================================================
 * Public calendar feed.
 *
 * The contract: exactly one well-formed selector, anonymous-readable data only,
 * correct calendar headers, and no internal detail leaked to a caller who is by
 * definition unauthenticated.
 * ========================================================================== */

const TEAM_ID = "11111111-2222-3333-4444-555555555555";
const LEAGUE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function mockResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.body = payload; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const ENV = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" };

test("readQuery requires exactly one selector", () => {
  assert.throws(() => readQuery({}), /team or league is required/i);
  assert.throws(() => readQuery({ team: TEAM_ID, league: LEAGUE_ID }), /not both/i);
});

test("readQuery rejects anything that is not a well-formed id", () => {
  assert.throws(() => readQuery({ team: "not-a-uuid" }), /not valid/i);
  assert.throws(() => readQuery({ team: "1; drop table games" }), /not valid/i);
  assert.throws(() => readQuery({ team: ["array"] }), /not valid/i);
});

test("readQuery accepts a valid team or league", () => {
  assert.deepEqual(readQuery({ team: TEAM_ID }), { kind: "team", id: TEAM_ID });
  assert.deepEqual(readQuery({ league: LEAGUE_ID }), { kind: "league", id: LEAGUE_ID });
});

test("readConfig fails closed when environment values are absent", () => {
  assert.throws(() => readConfig({}), /temporarily unavailable/i);
  assert.throws(() => readConfig({ SUPABASE_URL: "x" }), /temporarily unavailable/i);
  assert.deepEqual(readConfig(ENV), { supabaseUrl: ENV.SUPABASE_URL, supabaseAnonKey: ENV.SUPABASE_ANON_KEY });
});

test("readConfig never asks for the secret key", () => {
  // The service role is INSERT-only on intake tables and cannot read a game.
  // Requiring it here would be both useless and a privilege escalation.
  const source = _test.readConfig.toString();
  assert.ok(!source.includes("SECRET"), "calendar feed must not reference a secret key");
});

test("feedName uses the team's own name when it resolves", () => {
  const teams = [{ id: TEAM_ID, name: "Sandia Sluggers" }];
  assert.equal(feedName({ kind: "team", id: TEAM_ID }, teams), "Sandia Sluggers — CVF Sports");
  assert.equal(feedName({ kind: "team", id: "missing" }, teams), "CVF Sports");
  assert.equal(feedName({ kind: "league", id: LEAGUE_ID }, teams), "CVF Sports");
});

test("loadFeedData matches a team on either side of the fixture", async () => {
  const calls = [];
  const client = {
    from(table) {
      const builder = {
        select() { return builder; },
        order() { return builder; },
        or(expression) { calls.push({ table, or: expression }); return Promise.resolve({ data: [], error: null }); },
        eq(column, value) { calls.push({ table, eq: [column, value] }); return Promise.resolve({ data: [], error: null }); },
        then(resolve) { return resolve({ data: [], error: null }); },
      };
      return builder;
    },
  };
  await loadFeedData(client, { kind: "team", id: TEAM_ID });
  assert.equal(calls[0].or, `home_team_id.eq.${TEAM_ID},away_team_id.eq.${TEAM_ID}`);
});

test("loadFeedData surfaces a read failure without exposing the query", async () => {
  const client = {
    from() {
      const builder = {
        select() { return builder; },
        order() { return builder; },
        or() { return Promise.resolve({ data: null, error: { code: "PGRST301" } }); },
        eq() { return Promise.resolve({ data: null, error: { code: "PGRST301" } }); },
        then(resolve) { return resolve({ data: [], error: null }); },
      };
      return builder;
    },
  };
  await assert.rejects(
    () => loadFeedData(client, { kind: "team", id: TEAM_ID }),
    /games read failed/
  );
});

test("handler rejects methods other than GET and HEAD", async () => {
  const res = mockResponse();
  await handler({ method: "POST", query: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, "GET, HEAD");
});

test("handler reports a bad selector as a client error", async () => {
  const res = mockResponse();
  await handler({ method: "GET", query: { team: "nope" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /not valid/i);
});

test("handler fails closed and says nothing specific when misconfigured", async () => {
  const saved = { ...process.env };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const res = mockResponse();
  await handler({ method: "GET", query: { team: TEAM_ID } }, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /temporarily unavailable/i);
  // No hostname, key name, or stack detail reaches an anonymous caller.
  assert.ok(!JSON.stringify(res.body).toLowerCase().includes("supabase"));
  Object.assign(process.env, saved);
});

test("the cache window is long enough that a popular feed is not re-queried per client", () => {
  assert.ok(_test.CACHE_SECONDS >= 600, "subscriptions poll often; cache must absorb that");
});
