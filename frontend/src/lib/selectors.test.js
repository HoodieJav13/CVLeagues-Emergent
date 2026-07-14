/* ============================================================================
 * Stage-aware standings/totals verification (playoff/tournament pass).
 *
 * Seed fixture: g10 is a COMPLETED flag-football playoff game (t5 20–28 t4,
 * 2026-06-26) with full playerStats. The locked rule under test:
 *   - standings/records EXCLUDE playoff+tournament games
 *   - player league-season totals INCLUDE playoffs but EXCLUDE tournaments
 * ========================================================================== */
import {
  buildLeaderboard,
  computeTeamRecord,
  computeStandings,
  playerCareerStats,
  playerGameLog,
  playerSeasonStats,
  playerTournamentStats,
} from "./selectors";
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

describe("multi-season and standalone tournament isolation", () => {
  const isolated = {
    ...state,
    seasons: [
      ...(state.seasons || []),
      { name: "Fall 2026", status: "completed" },
    ],
    settings: {
      ...state.settings,
      current_seasons: { kickball: "Summer 2026", flag_football: "Summer 2026" },
    },
    leagues: [
      ...state.leagues,
      { id: "l-old", name: "Fall Flag", sport: "flag_football", season: "Fall 2026", kind: "league" },
      { id: "l-tourney", name: "Duke City Classic", sport: "flag_football", season: "Summer 2026", kind: "tournament" },
    ],
    games: [
      ...state.games,
      { id: "g-old", league_id: "l-old", sport: "flag_football", date: "2025-10-01", status: "completed", stage: "regular" },
      { id: "g-tourney", league_id: "l-tourney", sport: "flag_football", date: "2026-05-01", status: "completed", stage: "tournament" },
    ],
    playerStats: [
      ...state.playerStats,
      { id: "s-old", game_id: "g-old", profile_id: "p16", team_id: "t4", sport: "flag_football", stats: { passYards: 100 } },
      { id: "s-tourney", game_id: "g-tourney", profile_id: "p16", team_id: "t4", sport: "flag_football", stats: { passYards: 200 } },
    ],
  };

  test("current-season totals include league playoffs but exclude old seasons and tournaments", () => {
    expect(playerSeasonStats(isolated, "p16", "flag_football").passYards).toBe(645);
    expect(playerSeasonStats(isolated, "p16", "flag_football", "Fall 2026").passYards).toBe(100);
  });

  test("league career adds old league seasons but never standalone tournaments", () => {
    const originalCareer = playerCareerStats(state, "p16", "flag_football").passYards;
    expect(playerCareerStats(isolated, "p16", "flag_football").passYards).toBe(originalCareer + 100);
  });

  test("tournament totals and game logs remain a separate domain", () => {
    expect(playerTournamentStats(isolated, "p16", "flag_football", "l-tourney").passYards).toBe(200);
    expect(playerGameLog(isolated, "p16", "flag_football").some((row) => row.game.id === "g-tourney")).toBe(false);
    expect(playerGameLog(isolated, "p16", "flag_football", { domain: "tournament", tournament_id: "l-tourney" }).map((row) => row.game.id)).toEqual(["g-tourney"]);
  });

  test("leaderboards honor an explicit historical season or tournament container", () => {
    expect(buildLeaderboard(isolated, "flag_football", "passYards", "season", "Fall 2026")[0]).toMatchObject({ profile: { id: "p16" }, value: 100 });
    expect(buildLeaderboard(isolated, "flag_football", "passYards", "tournament", "l-tourney")[0]).toMatchObject({ profile: { id: "p16" }, value: 200 });
  });
});
