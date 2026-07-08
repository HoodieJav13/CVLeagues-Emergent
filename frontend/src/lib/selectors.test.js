/* ============================================================================
 * Stage-aware standings/totals verification (playoff/tournament pass).
 *
 * Seed fixture: g10 is a COMPLETED flag-football playoff game (t5 20–28 t4,
 * 2026-06-26) with full playerStats. The locked rule under test:
 *   - standings/records EXCLUDE playoff+tournament games
 *   - player season stat totals INCLUDE them (full-season totals)
 * ========================================================================== */
import { computeTeamRecord, computeStandings, playerSeasonStats } from "./selectors";
import { initialState } from "../data/seed";

const state = initialState;

describe("computeTeamRecord excludes playoff games", () => {
  test("t4 record is 2-0 from regular season only (playoff win g10 not counted)", () => {
    const rec = computeTeamRecord(state, "t4");
    expect(rec).toMatchObject({ wins: 2, losses: 0, ties: 0, played: 2 });
    // pointsFor from g7 (21) + g9 (21) only — not g10's 28.
    expect(rec.pointsFor).toBe(42);
  });

  test("t5 record is 0-2 (playoff loss g10 not counted)", () => {
    const rec = computeTeamRecord(state, "t5");
    expect(rec).toMatchObject({ wins: 0, losses: 2, played: 2 });
  });

  test("a game with no stage field counts as regular season (legacy states)", () => {
    const legacy = {
      ...state,
      games: state.games.map((g) => (g.id === "g10" ? { ...g, stage: undefined } : g)),
    };
    // Without the stage flag, g10 would count: t4 becomes 3-0.
    expect(computeTeamRecord(legacy, "t4").wins).toBe(3);
  });
});

describe("computeStandings unaffected by the scored playoff game", () => {
  test("flag football standings order: t4, t6, t5 — as of regular-season end", () => {
    const rows = computeStandings(state, "l2");
    expect(rows.map((r) => r.team.id)).toEqual(["t4", "t6", "t5"]);
    expect(rows.map((r) => r.record.played)).toEqual([2, 2, 2]);
  });
});

describe("playerSeasonStats includes playoff games in full-season totals", () => {
  test("p16 season passYards = g7 (185) + g9 (220) + playoff g10 (240)", () => {
    expect(playerSeasonStats(state, "p16", "flag_football").passYards).toBe(645);
  });

  test("p17 season recTDs include the playoff pair from g10", () => {
    // g7: 1, g9: 2, g10: 2
    expect(playerSeasonStats(state, "p17", "flag_football").recTDs).toBe(5);
  });
});
