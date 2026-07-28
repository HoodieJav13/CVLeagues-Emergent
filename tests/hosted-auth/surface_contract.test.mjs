import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("./surface_contract.js");

const {
  SURFACES, DEFAULT_SURFACE, BASE_TABLES, BASE_RPCS, M29_TABLES, M29_RPCS,
  resolveSurface, hasTable, hasRpc,
} = globalThis.CVF_MATRIX_SURFACES;

const matrixSource = readFileSync(new URL("./matrix.js", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./server.mjs", import.meta.url), "utf8");
const runbookSource = readFileSync(new URL("../../supabase/HOSTED_AUTH_RUNBOOK.md", import.meta.url), "utf8");

/* ---------------------------------------------------------------------------
 * Census. The whole point of two surfaces is that they cover DIFFERENT
 * amounts, so the counts are asserted explicitly. A mode that silently skips
 * work still reports PASS, which is exactly the failure these guard against.
 * ------------------------------------------------------------------------- */
test("m28 is the accepted Sequence 4 census: 26 tables, 25 RPCs", () => {
  const m28 = resolveSurface("m28");
  assert.equal(m28.tableCount, 26);
  assert.equal(m28.rpcCount, 25);
  assert.equal(m28.tables.length, 26);
  assert.equal(m28.rpcs.length, 25);
});

test("m29 adds exactly two tables and one RPC, and nothing else", () => {
  const m29 = resolveSurface("m29");
  assert.equal(m29.tableCount, 28);
  assert.equal(m29.rpcCount, 26);
  assert.deepEqual(
    m29.tables.filter((table) => !BASE_TABLES.includes(table)),
    ["venues", "game_participation"],
  );
  assert.deepEqual(
    m29.rpcs.filter((rpc) => !BASE_RPCS.includes(rpc)),
    ["set_game_participation"],
  );
});

test("m28 is a strict prefix of m29 — no table or RPC is dropped between them", () => {
  const m28 = resolveSurface("m28");
  const m29 = resolveSurface("m29");
  for (const table of m28.tables) assert.ok(m29.tables.includes(table), `m29 lost ${table}`);
  for (const rpc of m28.rpcs) assert.ok(m29.rpcs.includes(rpc), `m29 lost ${rpc}`);
});

test("no duplicates in either census", () => {
  for (const key of Object.keys(SURFACES)) {
    const surface = SURFACES[key];
    assert.equal(new Set(surface.tables).size, surface.tables.length, `${key} has duplicate tables`);
    assert.equal(new Set(surface.rpcs).size, surface.rpcs.length, `${key} has duplicate RPCs`);
  }
});

/* ---------------------------------------------------------------------------
 * Fixture selection. Migration 29 drops games.date/time/location and adds
 * venues. Seeding the wrong shape fails during SETUP, before any authorization
 * check, so the run produces no evidence at all.
 * ------------------------------------------------------------------------- */
test("m28 seeds the legacy game shape and no venue", () => {
  const m28 = resolveSurface("m28");
  assert.equal(m28.gameShape, "legacy");
  assert.equal(m28.seedsVenue, false);
  assert.equal(hasTable(m28, "venues"), false);
  assert.equal(hasTable(m28, "game_participation"), false);
});

test("m29 seeds a venue and the starts_at game shape", () => {
  const m29 = resolveSurface("m29");
  assert.equal(m29.gameShape, "starts_at");
  assert.equal(m29.seedsVenue, true);
  assert.equal(hasTable(m29, "venues"), true);
  assert.equal(hasTable(m29, "game_participation"), true);
});

/* ---------------------------------------------------------------------------
 * schedule_playoff_match changes signature at Migration 29. Probing the wrong
 * one returns "function not found", which reads as an authorization anomaly
 * when it is really a stale fixture.
 * ------------------------------------------------------------------------- */
test("schedule_playoff_match arguments follow the surface", () => {
  assert.deepEqual(
    [...resolveSurface("m28").schedulePlayoffMatchArgs],
    ["p_match_id", "p_date", "p_time", "p_location"],
  );
  assert.deepEqual(
    [...resolveSurface("m29").schedulePlayoffMatchArgs],
    ["p_match_id", "p_starts_at", "p_venue_id"],
  );
});

test("both RPCs are in every census — only the signature moves", () => {
  for (const key of Object.keys(SURFACES)) {
    assert.ok(hasRpc(SURFACES[key], "schedule_playoff_match"), `${key} lost schedule_playoff_match`);
  }
  assert.equal(hasRpc(resolveSurface("m28"), "set_game_participation"), false);
  assert.equal(hasRpc(resolveSurface("m29"), "set_game_participation"), true);
});

/* ---------------------------------------------------------------------------
 * Sequence 5A changes three ledger signatures additively. They must stay in
 * BOTH censuses: the endpoints exist at Migration 28, only their parameter
 * list grew, so denial coverage has to keep running against them.
 * ------------------------------------------------------------------------- */
test("the three Sequence 5A endpoints are present at both surfaces", () => {
  for (const rpc of ["append_scorekeeping_event", "replace_scorekeeping_event", "finalize_scorekeeping_session"]) {
    assert.ok(hasRpc(resolveSurface("m28"), rpc), `m28 missing ${rpc}`);
    assert.ok(hasRpc(resolveSurface("m29"), rpc), `m29 missing ${rpc}`);
  }
});

/* ---------------------------------------------------------------------------
 * Resolution behaviour.
 * ------------------------------------------------------------------------- */
test("the default surface is the current repository surface", () => {
  assert.equal(DEFAULT_SURFACE, "m29");
  assert.equal(resolveSurface(undefined).key, "m29");
});

test("an unknown surface fails loudly rather than defaulting", () => {
  assert.throws(() => resolveSurface("m30"), /Unknown matrix surface "m30"/);
});

/* ---------------------------------------------------------------------------
 * The harness actually consumes the contract. Without these, the contract can
 * be perfectly correct while the runner ignores it.
 * ------------------------------------------------------------------------- */
test("the browser matrix gates the Migration 29 relations rather than hard-coding them", () => {
  assert.match(matrixSource, /hasTable\(surface, "venues"\)/);
  assert.match(matrixSource, /M29_TABLES\.filter\(\(name\) => hasTable\(surface, name\)\)/);
  // A function, not a const: `surface` is resolved from the fetched config, so
  // dereferencing it at module scope throws at script load. See
  // matrix_load.test.mjs, which executes the script rather than reading it.
  assert.match(matrixSource, /const adminRpcNames = \(\) => surface\.rpcs;/);
  assert.doesNotMatch(matrixSource, /const ADMIN_RPC_NAMES = surface\.rpcs;/);
});

test("no games payload hard-codes a surface-specific column", () => {
  // Denial probes and success paths alike must build from the shared helpers.
  // A hard-coded legacy column in a denial probe is the worst case: it still
  // errors, so a permissive assertion banks a schema failure as RLS proof.
  assert.doesNotMatch(matrixSource, /^\s+(date|time|location):\s/m);
  assert.doesNotMatch(matrixSource, /p_date:|p_time:|p_location:/);
  assert.match(matrixSource, /\.\.\.scheduleFields\(/);
  assert.match(matrixSource, /schedulePlayoffMatchArgs\(surface, \{/);
});

test("every denial names the property it proves — no permissive helper survives", () => {
  assert.match(matrixSource, /function requireAuthorizationDenied\(/);
  assert.match(matrixSource, /function requireColumnAbsent\(/);
  assert.match(matrixSource, /function requireGuardRejection\(/);
  // The permissive helper accepted ANY error, so an evidence row claiming an
  // authorization boundary could be satisfied by a constraint violation. It is
  // deleted rather than deprecated, so nobody can reach for it again.
  assert.doesNotMatch(matrixSource, /requireDenied\s*\(/);
});

test("denial kinds are declared in one table, with the code authoritative", () => {
  // A blacklist rots: every new error class defaults to "authorization". A
  // per-helper allowlist rots more slowly but still drifts, which is how five
  // review rounds each found the same defect one helper further out. One
  // declared table is the form that cannot drift per call site.
  assert.match(matrixSource, /const DENIAL_KINDS = Object\.freeze\(\{/);
  for (const kind of ["databaseAuthorization", "tablePrivilege", "columnAbsent", "guard"]) {
    assert.match(matrixSource, new RegExp(`${kind}: Object\\.freeze\\(\\{`), `missing denial kind ${kind}`);
  }
  assert.match(matrixSource, /function matchesDenial\(/);
  assert.match(matrixSource, /function requireTypedDenial\(/);
  // The code gates everything; convenient text can never rescue a wrong code.
  assert.match(matrixSource, /if \(!code \|\| !kind\.codes\.includes\(code\)\) return false;/);
  // Text is matched against error.message only. details/hint are diagnostic
  // prose that echo other errors and must not decide what a check proved.
  assert.match(matrixSource, /pattern\.test\(String\(error\.message \|\| ""\)\)/);
  assert.match(matrixSource, /DENIAL-KIND-MISMATCH/);
  // Guards are P0001; authentication codes appear nowhere as acceptable.
  assert.match(matrixSource, /codes: Object\.freeze\(\["P0001"\]\)/);
  assert.doesNotMatch(matrixSource, /codes: Object\.freeze\(\[[^\]]*PGRST30/);
});

test("generated evidence records the surface it covers", () => {
  assert.match(serverSource, /\*\*Surface:\*\*/);
  assert.match(serverSource, /surface\.key/);
  assert.match(serverSource, /surface\.migrations/);
  assert.match(serverSource, /surface\.tableCount/);
  assert.match(serverSource, /surface\.rpcCount/);
});

test("the browser matrix labels the venue checks as Migration 29", () => {
  assert.match(matrixSource, /"migration 29 authorization"/);
  assert.doesNotMatch(matrixSource, /"migration 28 authorization"/);
});

test("the privileged runner gates seeding, baseline and cleanup on the surface", () => {
  assert.match(serverSource, /const surface = resolveSurface\(args\.surface\);/);
  assert.match(serverSource, /function venueSeedSql\(\)/);
  assert.match(serverSource, /function gameSeedSql\(\)/);
  // Baseline and cleanup must both be conditional, or a Migration 28 run dies
  // counting or deleting a table that does not exist.
  assert.match(serverSource, /hasTable\(surface, "venues"\) \? "  'venues'/);
  assert.match(serverSource, /hasTable\(surface, "game_participation"\) \? "  'game_participation'/);
  assert.match(serverSource, /hasTable\(surface, "game_participation"\) \? `delete from public\.game_participation/);
  assert.match(serverSource, /hasTable\(surface, "venues"\) \? `delete from public\.venues/);
});

test("the surface reaches the browser through the served config", () => {
  assert.match(serverSource, /surface: surface\.key,/);
  assert.match(serverSource, /url\.pathname === "\/surface-contract\.js"/);
  assert.match(matrixSource, /surface = resolveSurface\(config\.surface\)/);
});

test("the shell wrapper forwards --surface and rejects an unknown one", () => {
  const runner = readFileSync(new URL("./run_matrix.sh", import.meta.url), "utf8");
  assert.match(runner, /--surface\) SURFACE=/);
  assert.match(runner, /--surface "\$SURFACE"/);
  // Must fail closed. Silently defaulting an unknown surface to m29 would seed
  // the wrong fixture against a Migration 28 database.
  assert.match(runner, /Unknown matrix surface/);
  assert.match(runner, /exit 2/);
});

test("every documented surface key is actually accepted by the wrapper", () => {
  const runner = readFileSync(new URL("./run_matrix.sh", import.meta.url), "utf8");
  for (const key of Object.keys(SURFACES)) {
    assert.ok(runner.includes(`"${key}"`), `run_matrix.sh does not accept surface ${key}`);
  }
});

test("the publication preflight pins clean local main to freshly fetched origin/main", () => {
  assert.match(runbookSource, /git fetch origin --prune/);
  assert.match(runbookSource, /git status --short\s+# must print nothing/);
  assert.match(runbookSource, /local_main="\$\(git rev-parse HEAD\)"/);
  assert.match(runbookSource, /remote_main="\$\(git rev-parse origin\/main\)"/);
  assert.match(runbookSource, /test "\$local_main" = "\$remote_main"/);
  assert.match(runbookSource, /Stop if local `main` is stale,\s+ahead, or divergent from `origin\/main`/);
});

test("no live harness source still calls the venues surface Migration 28", () => {
  for (const [name, source] of [["matrix.js", matrixSource], ["server.mjs", serverSource]]) {
    assert.doesNotMatch(source, /[Mm]igration 28 surface/, `${name} mislabels the venues surface`);
  }
});
