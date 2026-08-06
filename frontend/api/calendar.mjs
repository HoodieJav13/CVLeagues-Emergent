import { createClient } from "@supabase/supabase-js";
import { buildCalendar } from "../src/lib/calendar.js";

/* ============================================================================
 * PUBLIC CALENDAR FEED — a subscribable .ics URL.
 * ----------------------------------------------------------------------------
 * The download in the app is a snapshot: reschedule a game and every player who
 * already downloaded still has the old time. A calendar client given THIS url
 * re-fetches it on its own, so a change made in the admin dashboard reaches
 * every subscriber without anyone doing anything. For a rec league where
 * rainouts and field changes are routine, that is the difference between a
 * calendar that is trusted and one that is quietly wrong.
 *
 * Authored as .mjs specifically so it can import the SAME generator the app
 * uses. A second copy of iCalendar generation would drift, and the two would
 * disagree about the schedule — the exact failure this program keeps removing.
 *
 * KEY CHOICE: this uses the ANON key, never the secret key. Games, teams and
 * venues are already publicly readable — the same rows an anonymous browser can
 * fetch — so RLS governs this endpoint identically to the client. The service
 * role is deliberately restricted to INSERT on the two intake tables and could
 * not read a game even if it were used here.
 * ========================================================================== */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Subscriptions poll on their own schedule; caching keeps a popular team's feed
// from hitting the database on every client's refresh.
const CACHE_SECONDS = 1800;

class FeedError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

/* ----------------------------------------------------------------------------
 * PER-IP RATE LIMIT — the abuse-protection gate for this anonymous surface.
 * Owner decision 2026-08-06. The cache above limits repeat cost; it does not
 * limit a determined caller, and AGENTS.md requires abuse protection on
 * anonymous surfaces before public launch. Fixed window per IP, counted in a
 * Vercel KV / Upstash Redis store over its REST API — plain fetch, no client
 * library.
 *
 * Failure semantics are deliberately split, matching the repo's fail-closed
 * configuration discipline:
 *  - Store env vars ABSENT on a deployed platform: 503. A missing limiter is
 *    a deployment mistake, and failing open would silently void the launch
 *    gate this code exists to close.
 *  - Store env vars present but the store call FAILS at runtime: fail open
 *    and serve. A transient Redis error should not take a read-only public
 *    schedule down; the event is logged for the operator.
 *  - Not on a deployed platform (local dev/tests, where the feed is
 *    unreachable anyway): skipped.
 * -------------------------------------------------------------------------- */

const RATE_LIMIT_MAX = 30;          // requests per window per IP
const RATE_LIMIT_WINDOW_SECONDS = 600;

export function readLimiterConfig(env = process.env) {
  // Vercel KV's names first; plain Upstash names as the fallback.
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || null;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || null;
  const deployed = Boolean(env.VERCEL) || env.NODE_ENV === "production";
  if (!url || !token) {
    if (deployed) throw new FeedError(503, "Calendar feed is temporarily unavailable.");
    return null; // local dev and unit tests: nothing to limit against
  }
  return { url, token };
}

export function clientAddress(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) return forwarded.split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

export async function enforceRateLimit(limiter, ip, fetchImpl = fetch, now = Date.now()) {
  if (!limiter) return { limited: false, skipped: true };
  const windowBucket = Math.floor(now / 1000 / RATE_LIMIT_WINDOW_SECONDS);
  const key = `cvf-cal:${ip}:${windowBucket}`;
  try {
    const response = await fetchImpl(`${limiter.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${limiter.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(RATE_LIMIT_WINDOW_SECONDS), "NX"]]),
    });
    if (!response.ok) throw new Error(`limiter store returned ${response.status}`);
    const results = await response.json();
    const count = Number(results?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error("limiter store returned a non-numeric count");
    return { limited: count > RATE_LIMIT_MAX, skipped: false };
  } catch (error) {
    // Availability over strictness for a transient store failure — but say so.
    console.error("Calendar rate limiter unavailable; serving unthrottled.", error?.message || error);
    return { limited: false, skipped: true };
  }
}

export function readConfig(env = process.env) {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new FeedError(503, "Calendar feed is temporarily unavailable.");
  return { supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY };
}

// Exactly one selector, and it must be a well-formed id. Anything else is
// rejected before a query is built.
export function readQuery(query = {}) {
  const team = query.team ?? null;
  const league = query.league ?? null;
  if (team && league) throw new FeedError(400, "Specify either a team or a league, not both.");
  if (!team && !league) throw new FeedError(400, "A team or league is required.");
  const id = team || league;
  if (typeof id !== "string" || !UUID.test(id)) throw new FeedError(400, "That identifier is not valid.");
  return { kind: team ? "team" : "league", id };
}

function serverClient({ supabaseUrl, supabaseAnonKey }) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function loadFeedData(client, { kind, id }) {
  const gamesQuery = client.from("games").select("*").order("starts_at");
  const { data: games, error: gamesError } = kind === "team"
    ? await gamesQuery.or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
    : await gamesQuery.eq("league_id", id);
  if (gamesError) throw new Error(`games read failed (${gamesError.code || "unknown"})`);

  const [{ data: teams, error: teamsError }, { data: venues, error: venuesError }] = await Promise.all([
    client.from("teams").select("id, name, league_id"),
    client.from("venues").select("id, name, field_label, address"),
  ]);
  if (teamsError) throw new Error(`teams read failed (${teamsError.code || "unknown"})`);
  if (venuesError) throw new Error(`venues read failed (${venuesError.code || "unknown"})`);

  return { games: games || [], teams: teams || [], venues: venues || [] };
}

export function feedName({ kind, id }, teams) {
  if (kind === "team") {
    const team = teams.find((item) => item.id === id);
    return team ? `${team.name} — CVF Sports` : "CVF Sports";
  }
  return "CVF Sports";
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const selector = readQuery(req.query || {});
    const limit = await enforceRateLimit(readLimiterConfig(), clientAddress(req));
    if (limit.limited) {
      res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SECONDS));
      return res.status(429).json({ error: "Too many requests. Calendar clients refresh at most a few times per hour." });
    }
    const config = readConfig();
    const client = serverClient(config);
    const { games, teams, venues } = await loadFeedData(client, selector);

    const origin = process.env.PUBLIC_SITE_ORIGIN || "";
    const text = buildCalendar({ teams, venues }, games, {
      name: feedName(selector, teams),
      origin,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    // Inline rather than attachment: a subscribing client fetches this, it is
    // not something a person downloads by hand.
    res.setHeader("Content-Disposition", 'inline; filename="cvf-schedule.ics"');
    res.setHeader("Cache-Control", `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
    return res.status(200).send(text);
  } catch (error) {
    if (error instanceof FeedError) return res.status(error.status).json({ error: error.publicMessage });
    // Never leak query or connection detail to an anonymous caller.
    console.error("Calendar feed failed.", error?.message || error);
    return res.status(500).json({ error: "Calendar feed could not be generated." });
  }
}

export const _test = {
  FeedError, readConfig, readQuery, loadFeedData, feedName, CACHE_SECONDS,
  readLimiterConfig, clientAddress, enforceRateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS,
};
