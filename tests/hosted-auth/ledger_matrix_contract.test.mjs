import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("./ledger_matrix_contract.js");

const contract = globalThis.CVF_LEDGER_MATRIX_CONTRACT;

test("ledger matrix names all four private relations", () => {
  assert.deepEqual([...contract.tables], [
    "scorekeeping_sessions",
    "scorekeeping_participants",
    "scorekeeping_events",
    "scorekeeping_event_attributions",
  ]);
});

test("ledger matrix exhaustively covers four roles and four operations", () => {
  assert.deepEqual(contract.roles.map((role) => role.key), ["anonymous", "nonadmin", "aal1Admin", "aal2Admin"]);
  assert.deepEqual([...contract.operations], ["read", "insert", "update", "delete"]);

  const names = contract.roles.flatMap((role) => contract.tables.flatMap((table) => (
    contract.operations.map((operation) => contract.checkName(role, operation, table))
  )));
  assert.equal(names.length, 64);
  assert.equal(new Set(names).size, 64);
});

test("browser runner invokes the complete ledger boundary for every role", () => {
  const source = readFileSync(new URL("./matrix.js", import.meta.url), "utf8");
  for (const role of contract.roles) {
    assert.match(source, new RegExp(`runLedgerBoundary\\(\\"${role.key}\\"`));
  }
});

test("Sequence 4 runtime RPCs are covered by browser denial and catalog checks", async () => {
  const browserSource = readFileSync(new URL("./matrix.js", import.meta.url), "utf8");
  const catalogSource = readFileSync(new URL("./ledger_catalog.sql", import.meta.url), "utf8");
  const runtimeRpcs = [
    "start_scorekeeping_session", "renew_scorekeeping_session", "resume_scorekeeping_session",
    "append_scorekeeping_event", "replace_scorekeeping_event", "finalize_scorekeeping_session",
    "cancel_scorekeeping_session", "declare_ledger_forfeit", "start_scorekeeping_correction",
    "finalize_scorekeeping_correction",
  ];

  // The denial loop no longer keeps its own literal list: the RPC census is
  // surface-dependent (Migration 29 adds set_game_participation), so it comes
  // from the shared surface contract. Assert against that object rather than
  // grepping matrix.js, which would only prove the names appear somewhere.
  await import("./surface_contract.js");
  const { SURFACES, hasRpc } = globalThis.CVF_MATRIX_SURFACES;
  assert.match(browserSource, /const adminRpcNames = \(\) => surface\.rpcs;/);

  for (const rpc of runtimeRpcs) {
    // Present at EVERY surface — Sequence 5A changed three of these signatures
    // but removed none of the endpoints, so denial coverage must never lapse.
    for (const key of Object.keys(SURFACES)) {
      assert.ok(hasRpc(SURFACES[key], rpc), `surface ${key} does not cover ${rpc}`);
    }
    assert.match(catalogSource, new RegExp(`\\('${rpc}'\\)`));
  }
});
