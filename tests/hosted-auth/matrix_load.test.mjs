import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* ============================================================================
 * BROWSER SCRIPT LOAD TEST
 * ----------------------------------------------------------------------------
 * Regex assertions over source text cannot tell you whether the script RUNS.
 * They did not: matrix.js shipped deriving the RPC census from `surface` at
 * module scope while `surface` is assigned later, inside runMatrix(). Every
 * source-text check passed while the real script threw
 * "Cannot read properties of undefined (reading 'rpcs')" the moment the
 * browser loaded it — killing the entire matrix before a single check.
 *
 * So: actually execute it, against a DOM stub shaped like matrix.html, and
 * then exercise the surface-dependent branches for BOTH surfaces. This is the
 * test that would have caught that class of defect.
 * ========================================================================== */

const HARNESS = new URL(".", import.meta.url);
const read = (name) => readFileSync(new URL(name, HARNESS), "utf8");

// Element ids matrix.js reaches for, mirroring matrix.html.
const ELEMENT_IDS = [
  "output", "run", "mfa-step", "mfa-continue",
  "admin-email", "admin-password", "admin-totp",
  "nonadmin-email", "nonadmin-password",
];

function makeElement(id) {
  return {
    id,
    value: "",
    textContent: "",
    disabled: false,
    hidden: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    listeners: {},
    addEventListener(event, handler) { this.listeners[event] = handler; },
    removeEventListener() {},
    appendChild() {},
    setAttribute() {},
    focus() {},
    scrollIntoView() {},
  };
}

function loadMatrix() {
  const elements = new Map(ELEMENT_IDS.map((id) => [id, makeElement(id)]));
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    supabase: { createClient: () => ({}) },
    document: {
      getElementById: (id) => elements.get(id) ?? null,
      querySelector: () => null,
      addEventListener() {},
      body: makeElement("body"),
      createElement: (tag) => makeElement(tag),
    },
    location: { origin: "http://127.0.0.1:55882", href: "http://127.0.0.1:55882/" },
    navigator: { userAgent: "node-load-test" },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  // Dependency order matches matrix.html.
  vm.runInContext(read("./ledger_matrix_contract.js"), context, { filename: "ledger_matrix_contract.js" });
  vm.runInContext(read("./surface_contract.js"), context, { filename: "surface_contract.js" });
  vm.runInContext(read("./matrix.js"), context, { filename: "matrix.js" });
  return { context, sandbox, elements };
}

test("matrix.js loads without throwing", () => {
  assert.doesNotThrow(loadMatrix, "browser matrix threw during script evaluation");
});

test("loading wires the run button, so the harness is actually startable", () => {
  const { elements } = loadMatrix();
  assert.equal(typeof elements.get("run").listeners.click, "function");
});

test("nothing dereferences the surface at module scope", () => {
  // The original defect. Loading happens before any config fetch, so if the
  // module body touches `surface` it throws here and nowhere else.
  const { context } = loadMatrix();
  assert.equal(vm.runInContext("typeof surface", context), "undefined");
  assert.equal(vm.runInContext("typeof adminRpcNames", context), "function");
});

test("the RPC census resolves per surface once config lands", () => {
  const { context } = loadMatrix();
  for (const [key, expected] of [["m28", 25], ["m29", 26]]) {
    const count = vm.runInContext(
      `surface = resolveSurface(${JSON.stringify(key)}); adminRpcNames().length;`,
      context,
    );
    assert.equal(count, expected, `${key} should expose ${expected} admin RPCs`);
  }
});

test("set_game_participation is probed only where the RPC exists", () => {
  const { context } = loadMatrix();
  assert.equal(
    vm.runInContext('surface = resolveSurface("m28"); adminRpcNames().includes("set_game_participation");', context),
    false,
  );
  assert.equal(
    vm.runInContext('surface = resolveSurface("m29"); adminRpcNames().includes("set_game_participation");', context),
    true,
  );
});

test("game payloads carry the right columns for each surface", () => {
  const { context } = loadMatrix();
  vm.runInContext('config = { runId: "run", ids: { venue: "venue-uuid" } };', context);

  const legacy = vm.runInContext('surface = resolveSurface("m28"); JSON.stringify(scheduleFields());', context);
  assert.deepEqual(Object.keys(JSON.parse(legacy)).sort(), ["date", "location", "time"]);

  const modern = vm.runInContext('surface = resolveSurface("m29"); JSON.stringify(scheduleFields());', context);
  assert.deepEqual(Object.keys(JSON.parse(modern)).sort(), ["starts_at", "venue_id"]);
});

test("schedule_playoff_match arguments follow the surface in both directions", () => {
  const { context } = loadMatrix();
  vm.runInContext('config = { runId: "run", ids: { venue: "venue-uuid", unknownPlayoffMatch: "match-uuid" } };', context);

  const legacy = JSON.parse(vm.runInContext(
    'surface = resolveSurface("m28"); JSON.stringify(schedulePlayoffMatchArgs(surface, { matchId: "m", dateText: "d", timeText: "t", locationText: "l", startsAt: "s", venueId: "v" }));',
    context,
  ));
  assert.deepEqual(Object.keys(legacy).sort(), ["p_date", "p_location", "p_match_id", "p_time"]);

  const modern = JSON.parse(vm.runInContext(
    'surface = resolveSurface("m29"); JSON.stringify(schedulePlayoffMatchArgs(surface, { matchId: "m", dateText: "d", timeText: "t", locationText: "l", startsAt: "s", venueId: "v" }));',
    context,
  ));
  assert.deepEqual(Object.keys(modern).sort(), ["p_match_id", "p_starts_at", "p_venue_id"]);
});

/* ---------------------------------------------------------------------------
 * Denial semantics. Every probe here is EXPECTED to fail, so the only thing
 * separating a real boundary check from a green rectangle is why it failed.
 * These helpers are allowlists: an earlier blacklist version rejected known
 * schema errors and accepted everything else, so a check-constraint or
 * foreign-key violation still recorded "denied at the authorization boundary".
 * ------------------------------------------------------------------------- */
const NON_AUTHORIZATION_FAILURES = [
  { code: "23514", message: "new row violates check constraint games_status_check" },
  { code: "23503", message: "insert or update on table violates foreign key constraint" },
  { code: "23505", message: "duplicate key value violates unique constraint" },
  { code: "23502", message: "null value in column violates not-null constraint" },
  { code: "22P02", message: "invalid input syntax for type uuid" },
  { code: "42703", message: 'column "location" of relation "games" does not exist' },
  { code: "PGRST204", message: "Could not find the 'time' column of 'games' in the schema cache" },
  { code: "42883", message: "function public.schedule_playoff_match(uuid, date, text, text) does not exist" },
];

const AUTHENTICATION_FAILURES = [
  { code: "PGRST301", message: "JWT expired" },
  { code: "PGRST302", message: "No API key found in request" },
  { code: "PGRST301", message: "permission denied for table games" },
  { code: undefined, message: "invalid JWT" },
  { code: undefined, message: "no API key supplied" },
];

test("no non-authorization failure can pass as a database authorization result", () => {
  const { context } = loadMatrix();
  for (const error of [...NON_AUTHORIZATION_FAILURES, ...AUTHENTICATION_FAILURES]) {
    assert.throws(
      () => vm.runInContext(`requireAuthorizationDenied(${JSON.stringify({ error })})`, context),
      /not a database authorization result/,
      `${error.code} was accepted as database authorization: ${error.message}`,
    );
  }
});

test("genuine database authorization failures are accepted", () => {
  const { context } = loadMatrix();
  const accepted = [
    { code: "42501", message: "permission denied for table games" },
    { code: "42501", message: "new row violates row-level security policy for table games" },
    { code: undefined, message: "permission denied for schema public" },
  ];
  for (const error of accepted) {
    const outcome = vm.runInContext(`requireAuthorizationDenied(${JSON.stringify({ error })})`, context);
    assert.match(outcome, /database authorization boundary/, `rejected a real database denial: ${error.message}`);
  }
});

test("a silent success is still a failure", () => {
  const { context } = loadMatrix();
  assert.throws(
    () => vm.runInContext("requireAuthorizationDenied({ data: [], error: null })", context),
    /unexpectedly succeeded/,
  );
});

test("requireNoWrite refuses a non-authorization error too", () => {
  const { context } = loadMatrix();
  for (const error of [...NON_AUTHORIZATION_FAILURES, ...AUTHENTICATION_FAILURES]) {
    assert.throws(
      () => vm.runInContext(`requireNoWrite(${JSON.stringify({ error })})`, context),
      /non-database-authorization reason/,
      `${error.code} was accepted as an RLS-filtered write: ${error.message}`,
    );
  }
  // Zero rows remains the normal RLS-filtered outcome.
  assert.match(vm.runInContext("requireNoWrite({ data: [], error: null })", context), /zero rows/);
  assert.match(
    vm.runInContext(`requireNoWrite(${JSON.stringify({ error: { code: "42501", message: "permission denied for table games" } })})`, context),
    /database authorization error/,
  );
});

test("requireHidden accepts only database denial or an RLS-empty result", () => {
  const { context } = loadMatrix();
  for (const error of [...NON_AUTHORIZATION_FAILURES, ...AUTHENTICATION_FAILURES]) {
    assert.throws(
      () => vm.runInContext(`requireHidden(${JSON.stringify({ error })})`, context),
      /non-database-authorization reason/,
      `${error.code} was accepted as proof that private rows were hidden: ${error.message}`,
    );
  }

  assert.match(
    vm.runInContext(`requireHidden(${JSON.stringify({ error: { code: "42501", message: "permission denied for table profiles" } })})`, context),
    /database authorization boundary/,
  );
  assert.match(vm.runInContext("requireHidden({ data: [], error: null })", context), /zero private rows/);
  assert.throws(
    () => vm.runInContext("requireHidden({ data: [{ id: 1 }], error: null })", context),
    /Private rows were exposed/,
  );
});

test("the PII allowlist check demands a schema error, not an authorization one", () => {
  const { context } = loadMatrix();
  const absent = { error: { code: "42703", message: 'column "email" does not exist' } };
  assert.match(vm.runInContext(`requireColumnAbsent(${JSON.stringify(absent)})`, context), /absent from the allowlisted view/);
  // An authorization error here would mean the wrong property was proven: the
  // column must not EXIST on the view, not merely be unreadable.
  const authz = { error: { code: "42501", message: "permission denied for table profiles" } };
  assert.throws(
    () => vm.runInContext(`requireColumnAbsent(${JSON.stringify(authz)})`, context),
    /Expected the column to be absent/,
  );
});

test("the permissive requireDenied helper is gone", () => {
  const { context } = loadMatrix();
  assert.equal(vm.runInContext("typeof requireDenied", context), "undefined");
});

test("database guards are asserted by their own message", () => {
  const { context } = loadMatrix();
  const locked = { error: { message: "Game abc is final and locked. Unlock it (with a reason) before editing." } };
  assert.match(
    vm.runInContext(`requireGuardRejection(${JSON.stringify(locked)}, /final and locked/i, "the game lock")`, context),
    /Rejected by the game lock/,
  );
  const wrong = { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
  assert.throws(
    () => vm.runInContext(`requireGuardRejection(${JSON.stringify(wrong)}, /final and locked/i, "the game lock")`, context),
    /unexpected reason/,
  );
});

/* ---------------------------------------------------------------------------
 * The private ledger boundary makes the narrowest claim in the matrix: not
 * "the database refused" but "it refused at the table-privilege boundary".
 * Text alone was not enough — an authentication failure carrying incidental
 * "permission denied" detail satisfied it, which proves the role never reached
 * the database rather than that the grant held.
 * ------------------------------------------------------------------------- */
test("the ledger privilege boundary rejects authentication failures", () => {
  const { context } = loadMatrix();
  const rejected = [
    { code: "PGRST301", message: "JWT expired" },
    { code: "PGRST301", message: "permission denied for table scorekeeping_events" },
    { code: "PGRST302", message: "No API key found in request" },
    { code: "23514", message: "new row violates check constraint" },
  ];
  for (const error of rejected) {
    assert.throws(
      () => vm.runInContext(`requirePrivilegeDenied(${JSON.stringify({ error })})`, context),
      /table-privilege boundary/,
      `accepted a non-privilege failure: ${error.code} ${error.message}`,
    );
  }
});

test("a real table-privilege denial still passes", () => {
  const { context } = loadMatrix();
  const denial = { error: { code: "42501", message: "permission denied for table scorekeeping_events" } };
  assert.match(
    vm.runInContext(`requirePrivilegeDenied(${JSON.stringify(denial)})`, context),
    /table-privilege boundary/,
  );
  // A 42501 that is NOT a privilege denial must not satisfy this narrower claim.
  const rlsOnly = { error: { code: "42501", message: "new row violates row-level security policy" } };
  assert.throws(() => vm.runInContext(`requirePrivilegeDenied(${JSON.stringify(rlsOnly)})`, context));
});
