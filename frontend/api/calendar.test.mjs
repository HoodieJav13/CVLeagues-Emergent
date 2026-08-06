import test from "node:test";
import assert from "node:assert/strict";
import handler, { readQuery, readConfig, feedName, loadFeedData, readLimiterConfig, clientAddress, _test } from "./calendar.mjs";

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

/* ============================================================================
 * Per-IP rate limit — the abuse-protection gate (owner decision 2026-08-06).
 * ========================================================================== */

const LIMITER = { url: "https://kv.example.upstash.io", token: "kv-token" };

function fetchReturningCount(count) {
  return async (url, options) => {
    fetchReturningCount.lastCall = { url, options };
    return { ok: true, json: async () => [{ result: count }, { result: 1 }] };
  };
}

test("readLimiterConfig fails closed on a deployed platform with no store", () => {
  assert.throws(
    () => readLimiterConfig({ VERCEL: "1" }),
    /temporarily unavailable/i,
    "a missing limiter on the deployed platform is a deployment mistake, not a pass"
  );
});

test("readLimiterConfig skips limiting only where the feed is unreachable anyway", () => {
  assert.equal(readLimiterConfig({}), null);
  const viaKv = readLimiterConfig({ KV_REST_API_URL: LIMITER.url, KV_REST_API_TOKEN: LIMITER.token });
  assert.deepEqual(viaKv, { url: LIMITER.url, token: LIMITER.token });
  const viaUpstash = readLimiterConfig({ UPSTASH_REDIS_REST_URL: LIMITER.url, UPSTASH_REDIS_REST_TOKEN: LIMITER.token });
  assert.deepEqual(viaUpstash, { url: LIMITER.url, token: LIMITER.token });
});

test("clientAddress prefers the first forwarded hop", () => {
  assert.equal(clientAddress({ headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }), "203.0.113.9");
  assert.equal(clientAddress({ headers: { "x-real-ip": "203.0.113.7" } }), "203.0.113.7");
  assert.equal(clientAddress({ headers: {} }), "unknown");
});

test("requests under the limit pass and over the limit are limited", async () => {
  const under = await _test.enforceRateLimit(LIMITER, "203.0.113.9", fetchReturningCount(_test.RATE_LIMIT_MAX), 0);
  assert.equal(under.limited, false);
  assert.equal(under.skipped, false);
  const over = await _test.enforceRateLimit(LIMITER, "203.0.113.9", fetchReturningCount(_test.RATE_LIMIT_MAX + 1), 0);
  assert.equal(over.limited, true);
});

test("the store sees a per-IP, per-window key and never the raw token in the URL", async () => {
  await _test.enforceRateLimit(LIMITER, "203.0.113.9", fetchReturningCount(1), 42_000_000);
  const { url, options } = fetchReturningCount.lastCall;
  assert.equal(url, `${LIMITER.url}/pipeline`);
  assert.ok(!url.includes(LIMITER.token), "token travels in the Authorization header only");
  const [incr] = JSON.parse(options.body);
  assert.equal(incr[0], "INCR");
  assert.match(incr[1], /^cvf-cal:203\.0\.113\.9:\d+$/);
});

test("a transient store failure serves unthrottled rather than taking the feed down", async () => {
  const failing = async () => { throw new Error("redis unreachable"); };
  const result = await _test.enforceRateLimit(LIMITER, "203.0.113.9", failing);
  assert.equal(result.limited, false);
  assert.equal(result.skipped, true);
});

test("a limited caller gets 429 with Retry-After and no calendar body", async () => {
  const saved = { ...process.env };
  process.env.KV_REST_API_URL = LIMITER.url;
  process.env.KV_REST_API_TOKEN = LIMITER.token;
  process.env.VERCEL = "1";
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchReturningCount(_test.RATE_LIMIT_MAX + 5);
  try {
    const res = mockResponse();
    await handler({ method: "GET", query: { team: TEAM_ID }, headers: { "x-forwarded-for": "203.0.113.9" } }, res);
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers["retry-after"], String(_test.RATE_LIMIT_WINDOW_SECONDS));
    assert.match(res.body.error, /too many requests/i);
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});
