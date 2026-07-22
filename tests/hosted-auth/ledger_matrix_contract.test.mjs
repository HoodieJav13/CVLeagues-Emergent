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
