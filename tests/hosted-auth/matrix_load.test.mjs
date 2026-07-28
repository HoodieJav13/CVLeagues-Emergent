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
 * A denial check whose claimed property is authorization must not be
 * satisfiable by a schema error. Otherwise a fixture naming a dropped column
 * records "column does not exist" as proof that RLS held.
 * ------------------------------------------------------------------------- */
test("a schema error is rejected as evidence of an authorization boundary", () => {
  const { context } = loadMatrix();
  const cases = [
    { message: 'column "location" of relation "games" does not exist' },
    { message: "Could not find the 'time' column of 'games' in the schema cache" },
    { message: "boom", code: "42703" },
    { message: "boom", code: "PGRST204" },
    { message: "function public.schedule_playoff_match(uuid, date, text, text) does not exist" },
  ];
  for (const error of cases) {
    assert.throws(
      () => vm.runInContext(`requireAuthorizationDenied(${JSON.stringify({ error })})`, context),
      /SCHEMA error/,
      `should have rejected: ${error.message}`,
    );
  }
});

test("a real authorization error still counts as denial", () => {
  const { context } = loadMatrix();
  const rlsError = { error: { message: "new row violates row-level security policy for table games", code: "42501" } };
  const accepted = vm.runInContext(`requireAuthorizationDenied(${JSON.stringify(rlsError)})`, context);
  assert.match(accepted, /authorization boundary/);
});

test("a silent success is still a failure", () => {
  const { context } = loadMatrix();
  assert.throws(
    () => vm.runInContext("requireAuthorizationDenied({ data: [], error: null })", context),
    /unexpectedly succeeded/,
  );
});
