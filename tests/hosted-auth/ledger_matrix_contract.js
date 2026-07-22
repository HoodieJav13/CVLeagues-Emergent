(function installLedgerMatrixContract(target) {
  const tables = Object.freeze([
    "scorekeeping_sessions",
    "scorekeeping_participants",
    "scorekeeping_events",
    "scorekeeping_event_attributions",
  ]);
  const operations = Object.freeze(["read", "insert", "update", "delete"]);
  const roles = Object.freeze([
    Object.freeze({ key: "anonymous", label: "anonymous", category: "ledger authorization", readMode: "denied" }),
    Object.freeze({ key: "nonadmin", label: "authenticated non-admin", category: "ledger authorization", readMode: "hidden" }),
    Object.freeze({ key: "aal1Admin", label: "linked password-only administrator", category: "MFA authorization", readMode: "hidden" }),
    Object.freeze({ key: "aal2Admin", label: "AAL2 administrator", category: "ledger authorization", readMode: "allowed" }),
  ]);

  function checkName(role, operation, table) {
    if (operation === "read") {
      if (role.readMode === "allowed") return `${role.label} can query ${table}`;
      return `${role.label} cannot read ${table}`;
    }
    return `${role.label} cannot ${operation} ${table}`;
  }

  target.CVF_LEDGER_MATRIX_CONTRACT = Object.freeze({ tables, operations, roles, checkName });
})(globalThis);
