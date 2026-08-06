import { validateLedgerEvent } from "./practiceLedger";

/* ============================================================================
 * Mock event validation — mirrors cvf_validate_ledger_event (5A form).
 * The UI cannot normally produce these violations, which is exactly why the
 * mock holds the line independently: rehearsal and hosted must reject the
 * same commands the day the entry surface changes.
 * ========================================================================== */

const KICKBALL = { sport: "kickball" };
const FLAG = { sport: "flag_football" };
const attr = (stat_key, stat_delta = 1) => ({ participant_id: "p1", role: "primary", stat_key, stat_delta });

describe("validateLedgerEvent", () => {
  test("point values must match the event type exactly", () => {
    expect(() => validateLedgerEvent(FLAG, "touchdown", 5, [])).toThrow(/INV-02/);
    expect(() => validateLedgerEvent(FLAG, "safety", 3, [])).toThrow(/INV-02/);
    expect(() => validateLedgerEvent(KICKBALL, "run", 2, [])).toThrow(/INV-02/);
    expect(() => validateLedgerEvent(KICKBALL, "out", 1, [])).toThrow(/INV-02/);
    expect(() => validateLedgerEvent(FLAG, "touchdown", 6, [attr("tds")])).not.toThrow();
    expect(() => validateLedgerEvent(KICKBALL, "run", 1, [attr("runs")])).not.toThrow();
  });

  test("event types are per-sport", () => {
    expect(() => validateLedgerEvent(KICKBALL, "touchdown", 6, [])).toThrow(/INV-04/);
    expect(() => validateLedgerEvent(FLAG, "home_run", 0, [])).toThrow(/INV-04/);
  });

  test("stat keys must be in the sport's allowlist", () => {
    expect(() => validateLedgerEvent(KICKBALL, "kick", 0, [attr("passYards")])).toThrow(/INV-04/);
    expect(() => validateLedgerEvent(FLAG, "completion", 0, [attr("homeRuns")])).toThrow(/INV-04/);
  });

  test("negative deltas are legal only on the signed yardage keys", () => {
    expect(() => validateLedgerEvent(FLAG, "carry", 0, [attr("rushYards", -7)])).not.toThrow();
    expect(() => validateLedgerEvent(FLAG, "completion", 0, [attr("passYards", -3), attr("recYards", -3)])).not.toThrow();
    expect(() => validateLedgerEvent(FLAG, "touchdown", 6, [attr("tds", -1)])).toThrow(/negative delta/);
    expect(() => validateLedgerEvent(KICKBALL, "run", 1, [attr("runs", -1)])).toThrow(/negative delta/);
  });

  test("period_close is zero-point with no attribution", () => {
    expect(() => validateLedgerEvent(FLAG, "period_close", 0, [])).not.toThrow();
    expect(() => validateLedgerEvent(FLAG, "period_close", 1, [])).toThrow(/INV-08/);
    expect(() => validateLedgerEvent(FLAG, "period_close", 0, [attr("tds")])).toThrow(/INV-08/);
  });

  test("malformed attributions are rejected as a shape error", () => {
    expect(() => validateLedgerEvent(FLAG, "carry", 0, [{ role: "rusher", stat_key: "carries", stat_delta: 1 }])).toThrow(/INV-03/);
    expect(() => validateLedgerEvent(FLAG, "carry", 0, [attr("carries", 1.5)])).toThrow(/INV-03/);
  });
});
