import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { validateBrowserResult } from "./result_validation.mjs";
import { summarizeChecks } from "./check_summary.mjs";

import { readdirSync } from "node:fs";
import { compareMigrationState, localVersions, formatMigrationStateFailure } from "./migration_state.mjs";

await import("./surface_contract.js");
const { resolveSurface, hasTable } = globalThis.CVF_MATRIX_SURFACES;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, []),
);

const root = resolve(args.root || process.cwd());
const port = Number(args.port || 55882);
const reportPath = resolve(args.report || join(root, "supabase/evidence/hosted-auth-matrix.md"));
const projectRef = "orlhqewzprjadyrdrqxw";
// Which hosted surface this run targets. Migrations 28 and 29 publish
// separately, so there is a real intermediate state and the harness must be
// able to address it. Defaults to the current repository surface.
const surface = resolveSurface(args.surface);
const tempDir = mkdtempSync(join(tmpdir(), "cvf-hosted-auth-"));
const runId = `cvf-matrix-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
const ids = Object.fromEntries(
  [
    "league", "identityLeague", "homeTeam", "awayTeam", "extraTeam1", "extraTeam2", "profile", "roster",
    "game", "linkedPlayoffGame", "unknownPlayoffMatch", "seedHistory", "charge", "payment", "adminCharge", "adminPayment",
    "registration", "freeAgent", "waiver", "hof", "deniedGame", "unknownTeamIdentity", "venue",
  ].map((name) => [name, randomUUID()]),
);
const season = `Matrix ${runId}`;
const fixtureWaiverVersion = `CVF-MATRIX-${runId}`;

let server;
let baseline;
let migrationState;
let ledgerCatalogChecks = [];
let fixtureSeeded = false;
let cleanupStarted = false;
let completed = false;

function parseEnvFile(path) {
  const parsed = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    parsed[match[1]] = value;
  }
  return parsed;
}

const frontendEnv = parseEnvFile(join(root, "frontend/.env.local"));
const supabaseUrl = frontendEnv.REACT_APP_SUPABASE_URL;
const anonKey = frontendEnv.REACT_APP_SUPABASE_ANON_KEY;
const turnstileSiteKey = frontendEnv.REACT_APP_TURNSTILE_SITE_KEY;
if (!supabaseUrl || !anonKey || !turnstileSiteKey) throw new Error("frontend/.env.local must contain the hosted public Supabase and Turnstile variables.");
if (new URL(supabaseUrl).hostname !== `${projectRef}.supabase.co`) throw new Error(`Refusing to run: frontend/.env.local is not configured for ${projectRef}.`);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sanitize(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-key]")
    .slice(0, 500);
}

function runLinkedSql(label, sql) {
  const file = join(tempDir, `${label}.sql`);
  writeFileSync(file, sql, { mode: 0o600 });
  const result = spawnSync(
    "supabase",
    ["db", "query", "--linked", "--output-format", "json", "--file", file],
    { cwd: root, env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" }, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(`${label} failed: ${sanitize(result.stderr || result.stdout || "Supabase CLI query failed")}`);
  return JSON.parse(result.stdout).rows || [];
}

const countSql = `
select json_build_object(
  'admin_users', (select count(*) from public.admin_users),
  'profiles', (select count(*) from public.profiles),
  'leagues', (select count(*) from public.leagues),
  'team_identities', (select count(*) from public.team_identities),
  'teams', (select count(*) from public.teams),
  'team_players', (select count(*) from public.team_players),
  'games', (select count(*) from public.games),
${hasTable(surface, "venues") ? "  'venues', (select count(*) from public.venues)," : ""}
${hasTable(surface, "game_participation") ? "  'game_participation', (select count(*) from public.game_participation)," : ""}
  'game_edit_history', (select count(*) from public.game_edit_history),
  'player_stats', (select count(*) from public.player_stats),
  'career_baselines', (select count(*) from public.career_baselines),
  'team_registrations', (select count(*) from public.team_registrations),
  'free_agents', (select count(*) from public.free_agents),
  'waiver_versions', (select count(*) from public.waiver_versions),
  'waivers', (select count(*) from public.waivers),
  'league_settings', (select count(*) from public.league_settings),
  'seasons', (select count(*) from public.seasons),
  'charges', (select count(*) from public.charges),
  'payment_entries', (select count(*) from public.payment_entries),
  'hof_entries', (select count(*) from public.hof_entries),
  'playoff_brackets', (select count(*) from public.playoff_brackets),
  'playoff_seeds', (select count(*) from public.playoff_seeds),
  'playoff_matches', (select count(*) from public.playoff_matches),
  'scorekeeping_sessions', (select count(*) from public.scorekeeping_sessions),
  'scorekeeping_participants', (select count(*) from public.scorekeeping_participants),
  'scorekeeping_events', (select count(*) from public.scorekeeping_events),
  'scorekeeping_event_attributions', (select count(*) from public.scorekeeping_event_attributions),
  'hof_published', (select hof_published from public.league_settings where id = 1),
  'current_season', (select current_season from public.league_settings where id = 1),
  'current_waiver_version', public.current_waiver_version()
) as baseline;
`;

function getCounts(label) {
  const rows = runLinkedSql(label, countSql);
  if (!rows[0]?.baseline) throw new Error(`Could not read ${label} row counts.`);
  return rows[0].baseline;
}

function getLedgerCatalogChecks() {
  const sql = readFileSync(join(root, "tests/hosted-auth/ledger_catalog.sql"), "utf8");
  const rows = runLinkedSql("ledger-catalog", sql);
  const observed = rows[0]?.ledger_catalog;
  if (!observed) throw new Error("Could not read the Migration 24 ledger privilege catalog.");

  return [
    ["all four ledger tables exist", "tables_present"],
    ["all four ledger tables have RLS enabled", "rls_enabled"],
    ["all four ledger tables have the AAL2 admin-read policy", "admin_read_policies"],
    ["anonymous has no ledger table privilege", "anon_no_privileges"],
    ["authenticated has SELECT-only ledger privileges", "authenticated_select_only"],
    ["service_role has no ledger table privilege", "service_role_no_privileges"],
    ["ledger trigger helpers are not client or service executable", "helpers_not_client_executable"],
    ["all ten ledger runtime RPCs are authenticated-only", "runtime_rpcs_authenticated_only"],
  ].map(([name, key]) => ({
    category: "ledger catalog",
    name,
    status: observed[key] === true ? "PASS" : "FAIL",
    detail: observed[key] === true ? "Expected catalog boundary observed." : `Catalog boundary failed: ${key}.`,
  }));
}

// The fixture's game shape is the surface's game shape. At Migration 28 the
// venues table does not exist yet and games still carry date/time/location;
// seeding the Migration 29 shape there fails during SETUP, before any
// authorization check runs, which yields no evidence rather than a partial run.
function venueSeedSql() {
  if (!surface.seedsVenue) return "";
  return `insert into public.venues (id, name, address)
values (${sqlLiteral(ids.venue)}::uuid, ${sqlLiteral(`${runId} venue`)}, ${sqlLiteral(`${runId} address`)});`;
}

function gameSeedSql() {
  if (surface.gameShape === "legacy") {
    return `insert into public.games (id, league_id, sport, home_team_id, away_team_id, date, time, location, stage)
values (${sqlLiteral(ids.game)}::uuid, ${sqlLiteral(ids.league)}::uuid, 'kickball', ${sqlLiteral(ids.homeTeam)}::uuid, ${sqlLiteral(ids.awayTeam)}::uuid, '2099-07-13'::date, '6:30 PM', ${sqlLiteral(`${runId} field`)}, 'regular');`;
  }
  return `insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id, stage)
values (${sqlLiteral(ids.game)}::uuid, ${sqlLiteral(ids.league)}::uuid, 'kickball', ${sqlLiteral(ids.homeTeam)}::uuid, ${sqlLiteral(ids.awayTeam)}::uuid, '2099-07-13T18:30:00-06:00'::timestamptz, ${sqlLiteral(ids.venue)}::uuid, 'regular');`;
}

// Read the hosted ledger directly. supabase_migrations.schema_migrations is
// the authoritative record of what has actually been applied.
function readHostedMigrationVersions() {
  const rows = runLinkedSql(
    "migration-ledger",
    "select version from supabase_migrations.schema_migrations order by version;",
  );
  return rows.map((row) => String(row.version));
}

// Runs BEFORE baseline capture and fixture creation. The surface flag states
// which schema the operator believes is hosted; this is what checks it.
function assertHostedMigrationState() {
  const local = localVersions(readdirSync(join(root, "supabase/migrations")));
  const remote = readHostedMigrationVersions();
  const result = compareMigrationState({ local, remote, surface });
  if (!result.ok) {
    throw new Error(formatMigrationStateFailure(result, surface));
  }
  console.log(
    `SURFACE VERIFIED ${surface.key}: hosted ledger has ${result.observed.count} migrations, latest ${result.observed.latest}.`,
  );
  return result;
}

function seedFixture() {
  const waiverInsert = baseline.current_waiver_version
    ? ""
    : `insert into public.waiver_versions (version, body_text, effective_at) values (${sqlLiteral(fixtureWaiverVersion)}, 'Disposable hosted authorization matrix text. Not legal waiver language.', now());`;
  runLinkedSql("seed", `begin;
${waiverInsert}
insert into public.seasons (name, status) values (${sqlLiteral(season)}, 'active');
insert into public.leagues (id, name, sport, season, status, kind, playoff_format)
values
  (${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(`${runId} league`)}, 'kickball', ${sqlLiteral(season)}, 'active', 'league', 'single_elim'),
  (${sqlLiteral(ids.identityLeague)}::uuid, ${sqlLiteral(`${runId} flag league`)}, 'flag_football', ${sqlLiteral(season)}, 'active', 'league', 'single_elim');
insert into public.profiles (id, first_name, last_name, email, sports)
values (${sqlLiteral(ids.profile)}::uuid, ${sqlLiteral(runId)}, 'Player', ${sqlLiteral(`${runId}.player@example.invalid`)}, array['kickball']);
insert into public.teams (id, league_id, name, sport, logo_color, status)
values
  (${sqlLiteral(ids.homeTeam)}::uuid, ${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(`${runId} home`)}, 'kickball', '#5BB8CC', 'active'),
  (${sqlLiteral(ids.awayTeam)}::uuid, ${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(`${runId} away`)}, 'kickball', '#F97316', 'active'),
  (${sqlLiteral(ids.extraTeam1)}::uuid, ${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(`${runId} extra one`)}, 'kickball', '#A855F7', 'active'),
  (${sqlLiteral(ids.extraTeam2)}::uuid, ${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(`${runId} extra two`)}, 'kickball', '#10B981', 'active');
insert into public.team_players (id, team_id, profile_id, season, jersey_number, roster_status)
values (${sqlLiteral(ids.roster)}::uuid, ${sqlLiteral(ids.homeTeam)}::uuid, ${sqlLiteral(ids.profile)}::uuid, ${sqlLiteral(season)}, 13, 'pending_waiver');
${venueSeedSql()}
${gameSeedSql()}
insert into public.game_edit_history (id, game_id, action)
values (${sqlLiteral(ids.seedHistory)}::uuid, ${sqlLiteral(ids.game)}::uuid, 'Fixture seeded');
insert into public.charges (id, season, profile_id, amount_due_cents, notes)
values (${sqlLiteral(ids.charge)}::uuid, ${sqlLiteral(season)}, ${sqlLiteral(ids.profile)}::uuid, 1000, ${sqlLiteral(runId)});
insert into public.payment_entries (id, charge_id, amount_cents, method, note)
values (${sqlLiteral(ids.payment)}::uuid, ${sqlLiteral(ids.charge)}::uuid, 500, 'matrix', ${sqlLiteral(runId)});
insert into public.team_registrations (id, captain_name, captain_email, sport, team_name, preferred_season, consent_to_contact)
values (${sqlLiteral(ids.registration)}::uuid, ${sqlLiteral(`${runId} Captain`)}, ${sqlLiteral(`${runId}.captain@example.invalid`)}, 'kickball', ${sqlLiteral(`${runId} approved team`)}, ${sqlLiteral(season)}, true);
insert into public.free_agents (id, first_name, last_name, email, sports, consent_to_contact)
values (${sqlLiteral(ids.freeAgent)}::uuid, ${sqlLiteral(runId)}, 'Agent', ${sqlLiteral(`${runId}.agent@example.invalid`)}, array['kickball'], true);
insert into public.waivers (id, signed_name, email, waiver_version, accepted_terms, age_confirmed, media_consent, user_agent)
values (${sqlLiteral(ids.waiver)}::uuid, ${sqlLiteral(`${runId} Agent`)}, ${sqlLiteral(`${runId}.agent@example.invalid`)}, ${sqlLiteral(baseline.current_waiver_version || fixtureWaiverVersion)}, true, true, false, 'cvf-hosted-auth-matrix');
commit;`);
  fixtureSeeded = true;
}

function cleanupSql() {
  return `begin;
update public.league_settings set hof_published = ${baseline.hof_published ? "true" : "false"} where id = 1;
delete from public.payment_entries where id = ${sqlLiteral(ids.payment)}::uuid or note = ${sqlLiteral(runId)};
delete from public.charges where id = ${sqlLiteral(ids.charge)}::uuid or notes = ${sqlLiteral(runId)};
delete from public.hof_entries where id = ${sqlLiteral(ids.hof)}::uuid or title like ${sqlLiteral(`${runId}%`)};
delete from public.playoff_brackets where league_id = ${sqlLiteral(ids.league)}::uuid;
delete from public.game_edit_history where game_id in (select id from public.games where league_id = ${sqlLiteral(ids.league)}::uuid);
delete from public.player_stats where game_id in (select id from public.games where league_id = ${sqlLiteral(ids.league)}::uuid);
${hasTable(surface, "game_participation") ? `delete from public.game_participation where game_id in (select id from public.games where league_id = ${sqlLiteral(ids.league)}::uuid);` : ""}
delete from public.waivers where email like ${sqlLiteral(`${runId}.%@example.invalid`)};
delete from public.team_players where season = ${sqlLiteral(season)};
delete from public.team_registrations where captain_email like ${sqlLiteral(`${runId}.%@example.invalid`)};
delete from public.free_agents where email like ${sqlLiteral(`${runId}.%@example.invalid`)};
delete from public.games where league_id in (${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(ids.identityLeague)}::uuid);
${hasTable(surface, "venues") ? `delete from public.venues where id = ${sqlLiteral(ids.venue)}::uuid;` : ""}
delete from public.teams where league_id in (${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(ids.identityLeague)}::uuid);
delete from public.team_identities where name like ${sqlLiteral(`${runId}%`)};
delete from public.profiles where email like ${sqlLiteral(`${runId}.%@example.invalid`)};
delete from public.leagues where id in (${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(ids.identityLeague)}::uuid);
delete from public.waiver_versions where version = ${sqlLiteral(fixtureWaiverVersion)};
delete from public.seasons where name = ${sqlLiteral(season)};
commit;
select json_build_object(
  'season_rows', (select count(*) from public.seasons where name = ${sqlLiteral(season)}),
  'league_rows', (select count(*) from public.leagues where id in (${sqlLiteral(ids.league)}::uuid, ${sqlLiteral(ids.identityLeague)}::uuid)),
  'identity_rows', (select count(*) from public.team_identities where name like ${sqlLiteral(`${runId}%`)}),
  'profile_rows', (select count(*) from public.profiles where email like ${sqlLiteral(`${runId}.%@example.invalid`)}),
  'waiver_rows', (select count(*) from public.waivers where email like ${sqlLiteral(`${runId}.%@example.invalid`)}),
  'history_rows', (select count(*) from public.game_edit_history where game_id = ${sqlLiteral(ids.game)}::uuid)
) as residue;`;
}

async function cleanupFixture() {
  if (!fixtureSeeded || cleanupStarted) return { skipped: true };
  cleanupStarted = true;
  try {
    const rows = runLinkedSql("cleanup", cleanupSql());
    const residue = rows.at(-1)?.residue || {};
    const after = getCounts("after-cleanup");
    const countsRestored = JSON.stringify(after) === JSON.stringify(baseline);
    const residueClear = Object.values(residue).every((value) => Number(value) === 0);
    fixtureSeeded = false;
    return { skipped: false, residue, residueClear, after, countsRestored };
  } catch (error) {
    cleanupStarted = false;
    throw error;
  }
}

function markdownEscape(value) {
  return sanitize(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function makeReport(browserResult, cleanupResult) {
  const browserChecks = Array.isArray(browserResult.checks) ? browserResult.checks : [];
  const summary = summarizeChecks(browserChecks, ledgerCatalogChecks);
  const checks = summary.checks;
  const passed = summary.combinedPassed;
  const failed = summary.combinedFailed;
  const cleanupPassed = cleanupResult.residueClear && cleanupResult.countsRestored;
  const overall = failed === 0 && cleanupPassed ? "PASS" : "FAIL";
  const categoryRows = Object.entries(checks.reduce((acc, check) => {
    const category = check.category || "uncategorized";
    acc[category] ||= { pass: 0, fail: 0 };
    acc[category][check.status === "PASS" ? "pass" : "fail"] += 1;
    return acc;
  }, {})).map(([category, count]) => `| ${markdownEscape(category)} | ${count.pass} | ${count.fail} |`).join("\n");
  const checkRows = checks.map((check) => `| ${markdownEscape(check.category)} | ${markdownEscape(check.name)} | ${check.status === "PASS" ? "PASS" : "FAIL"} | ${markdownEscape(check.detail || "")} |`).join("\n");
  const countRows = Object.keys(baseline).filter((key) => key !== "current_waiver_version").map((key) =>
    `| ${key} | ${markdownEscape(baseline[key])} | ${markdownEscape(cleanupResult.after[key])} | ${baseline[key] === cleanupResult.after[key] ? "PASS" : "FAIL"} |`,
  ).join("\n");

  const reportDate = String(browserResult.finishedAt || new Date().toISOString()).slice(0, 10);
  return `# Hosted authorization matrix evidence — ${reportDate}

- **Overall:** ${overall}
- **Project:** \`${projectRef}\`
- **Surface:** \`${surface.key}\` — ${markdownEscape(surface.label)}
- **Expected census:** ${surface.migrations} migrations · ${surface.tableCount} tables · ${surface.rpcCount} admin RPCs
- **Observed hosted ledger:** ${migrationState.observed.count} migrations applied, latest \`${markdownEscape(migrationState.observed.latest)}\` — verified against the local sequence before baseline capture
- **Fixture game shape:** \`${surface.gameShape}\`${surface.seedsVenue ? " (venue seeded)" : " (no venue; venues not yet published)"}
- **Run namespace:** \`${runId}\`
- **Executed:** ${markdownEscape(browserResult.startedAt)} to ${markdownEscape(browserResult.finishedAt)}
- **Browser/API checks:** ${summary.browserPassed} passed, ${summary.browserFailed} failed
- **Server catalog checks:** ${summary.catalogPassed} passed, ${summary.catalogFailed} failed
- **Combined checks:** ${passed} passed, ${failed} failed
- **Fixture residue check:** ${cleanupResult.residueClear ? "PASS" : "FAIL"}
- **Baseline restoration:** ${cleanupResult.countsRestored ? "PASS" : "FAIL"}
- **Credentials:** Auth passwords were entered only in the local browser harness. Passwords, access/refresh tokens, database credentials, and service-role keys were neither logged nor written to this report.

## Context

This is the durable rerun of the hosted authorization matrix that originally exposed the frontend authorization defects fixed by commits \`0b6933c\` and \`c5b55c2\`. The procedure is defined in [\`HOSTED_AUTH_RUNBOOK.md\`](../HOSTED_AUTH_RUNBOOK.md).

## Category summary

| Category | Passed | Failed |
|---|---:|---:|
${categoryRows}

## Detailed results

| Category | Check | Result | Detail |
|---|---|---|---|
${checkRows}

## Fixture cleanup and baseline restoration

| Invariant | Before | After | Result |
|---|---:|---:|---|
${countRows}

Fixture residue query: \`${JSON.stringify(cleanupResult.residue)}\` — **${cleanupResult.residueClear ? "PASS" : "FAIL"}**.

## Disposition

${overall === "PASS" ? "The hosted authorization matrix is executed, reproducible, and durably evidenced. Re-run it after any RLS, Data API grant, Auth-role, admin RPC, game-lock, waiver, intake, payment-privacy, edit-history, or Hall of Fame publication change." : "The gate remains open. Diagnose every failed row above, preserve the cleanup evidence, and do not downgrade the failure."}
`;
}

function safeJsonResponse(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error("Result payload too large.");
  }
  return JSON.parse(body);
}

async function handleResults(request, response) {
  if (completed) return safeJsonResponse(response, 409, { error: "Result already recorded." });
  try {
    const browserResult = await readJson(request);
    validateBrowserResult(browserResult);
    const cleanupResult = await cleanupFixture();
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, makeReport(browserResult, cleanupResult), { mode: 0o600, flag: "wx" });
    completed = true;
    const summary = summarizeChecks(browserResult.checks, ledgerCatalogChecks);
    const failed = summary.combinedFailed;
    const passed = summary.combinedPassed;
    const allPassed = failed === 0 && cleanupResult.residueClear && cleanupResult.countsRestored;
    console.log(`RESULT ${allPassed ? "PASS" : "FAIL"}: ${passed}/${summary.checks.length} browser/API and catalog checks passed.`);
    console.log(`CLEANUP ${cleanupResult.residueClear ? "PASS" : "FAIL"}: fixture namespace contains zero rows.`);
    console.log(`BASELINE ${cleanupResult.countsRestored ? "PASS" : "FAIL"}: all row counts and settings restored.`);
    console.log(`REPORT ${reportPath}`);
    safeJsonResponse(response, 200, { ok: true, report: reportPath, cleanup: cleanupResult.residueClear && cleanupResult.countsRestored });
    setTimeout(() => server.close(() => process.exit(allPassed ? 0 : 1)), 250);
  } catch (error) {
    console.error(`Matrix finalization failed: ${sanitize(error.message)}`);
    try { await cleanupFixture(); } catch (cleanupError) { console.error(`Emergency cleanup failed: ${sanitize(cleanupError.message)}`); }
    safeJsonResponse(response, 500, { error: sanitize(error.message) });
  }
}

function serveFile(response, path, contentType) {
  response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
  response.end(readFileSync(path));
}

function serveMatrixHtml(response) {
  const html = readFileSync(join(root, "tests/hosted-auth/matrix.html"), "utf8")
    .replaceAll("__TURNSTILE_SITE_KEY__", turnstileSiteKey);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
}

async function main() {
  ledgerCatalogChecks = getLedgerCatalogChecks();
  const catalogFailures = ledgerCatalogChecks.filter((check) => check.status !== "PASS");
  if (catalogFailures.length > 0) {
    throw new Error(`Migration 24 ledger catalog preflight failed: ${catalogFailures.map((check) => check.name).join(", ")}`);
  }
  migrationState = assertHostedMigrationState();
  baseline = getCounts("baseline");
  seedFixture();
  const publicConfig = {
    supabaseUrl,
    anonKey,
    projectRef,
    runId,
    season,
    waiverVersion: baseline.current_waiver_version || fixtureWaiverVersion,
    baselineHofPublished: baseline.hof_published,
    surface: surface.key,
    ids,
  };

  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      if (request.method === "GET" && url.pathname === "/health") return safeJsonResponse(response, 200, { ready: true });
      if (request.method === "GET" && url.pathname === "/config.json") return safeJsonResponse(response, 200, publicConfig);
      if (request.method === "GET" && url.pathname === "/supabase.js") return serveFile(response, join(root, "frontend/node_modules/@supabase/supabase-js/dist/umd/supabase.js"), "text/javascript; charset=utf-8");
      if (request.method === "GET" && url.pathname === "/ledger-matrix-contract.js") return serveFile(response, join(root, "tests/hosted-auth/ledger_matrix_contract.js"), "text/javascript; charset=utf-8");
      if (request.method === "GET" && url.pathname === "/surface-contract.js") return serveFile(response, join(root, "tests/hosted-auth/surface_contract.js"), "text/javascript; charset=utf-8");
      if (request.method === "GET" && url.pathname === "/matrix.js") return serveFile(response, join(root, "tests/hosted-auth/matrix.js"), "text/javascript; charset=utf-8");
      if (request.method === "GET" && url.pathname === "/") return serveMatrixHtml(response);
      if (request.method === "POST" && url.pathname === "/results") return await handleResults(request, response);
      response.writeHead(404).end("Not found");
    } catch (error) {
      safeJsonResponse(response, 500, { error: sanitize(error.message) });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`READY http://127.0.0.1:${port}/`);
    console.log(`FIXTURE ${runId} seeded through linked Supabase CLI; no credentials logged.`);
  });
}

async function emergencyExit(signal) {
  console.error(`${signal}: running fixture cleanup before exit.`);
  try { await cleanupFixture(); } catch (error) { console.error(`Emergency cleanup failed: ${sanitize(error.message)}`); }
  rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
}

process.on("SIGINT", () => emergencyExit("SIGINT"));
process.on("SIGTERM", () => emergencyExit("SIGTERM"));
process.on("exit", () => rmSync(tempDir, { recursive: true, force: true }));

main().catch(async (error) => {
  console.error(`Hosted authorization runner failed: ${sanitize(error.message)}`);
  try { await cleanupFixture(); } catch (cleanupError) { console.error(`Emergency cleanup failed: ${sanitize(cleanupError.message)}`); }
  process.exit(1);
});
