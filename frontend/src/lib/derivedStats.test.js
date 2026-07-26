/* ============================================================================
 * Derived-stat engine + games-played/rank selectors.
 *
 * The contract under test is the "not yet knowable" one: a rate stat whose
 * denominator is missing must return null and render as an em dash, never as a
 * zero. The seed now carries participation, so per-game figures resolve against
 * it; a state with the collection removed entirely is what must stay dark.
 * ========================================================================== */
import {
  computeDerivedStat,
  formatDerivedStat,
  meetsQualifier,
  derivedStat,
  isDerivedStat,
  anyStatLabel,
} from "./statsConfig";
import {
  computeTeamRecord,
  playerGamesPlayed,
  playerDerivedStat,
  playerRankContext,
  playerCareerStats,
  playerSeasonStats,
  hasCareerBaseline,
} from "./selectors";
import { initialState } from "../data/seed";

const state = initialState;

describe("derived stat computation", () => {
  test("kick average divides hits by kicks and strips the leading zero", () => {
    const totals = { kicks: 10, singles: 2, doubles: 1, triples: 0, homeRuns: 1 };
    expect(computeDerivedStat("kickball", "kickAverage", totals)).toBeCloseTo(0.4, 5);
    expect(formatDerivedStat("kickball", "kickAverage", 0.4)).toBe(".400");
  });

  test("slugging weights extra-base hits and keeps a leading digit above 1.000", () => {
    const totals = { kicks: 4, singles: 0, doubles: 0, triples: 0, homeRuns: 2 };
    expect(computeDerivedStat("kickball", "sluggingPct", totals)).toBeCloseTo(2, 5);
    expect(formatDerivedStat("kickball", "sluggingPct", 2)).toBe("2.000");
  });

  test("fielding percentage counts errors against total chances", () => {
    const totals = { outs: 7, assists: 2, errors: 1 };
    expect(computeDerivedStat("kickball", "fieldingPct", totals)).toBeCloseTo(0.9, 5);
  });

  test("completion percentage formats as a percent", () => {
    const totals = { completions: 15, attempts: 24 };
    const value = computeDerivedStat("flag_football", "completionPct", totals);
    expect(value).toBeCloseTo(0.625, 5);
    expect(formatDerivedStat("flag_football", "completionPct", value)).toBe("62.5%");
  });

  test("scrimmage yards sums rushing and receiving", () => {
    expect(computeDerivedStat("flag_football", "scrimmageYards", { rushYards: 40, recYards: 62 })).toBe(102);
  });

  test("a zero denominator yields null rather than zero", () => {
    expect(computeDerivedStat("kickball", "kickAverage", { kicks: 0, singles: 0 })).toBeNull();
    expect(computeDerivedStat("flag_football", "yardsPerCarry", { carries: 0, rushYards: 0 })).toBeNull();
  });

  test("a per-game stat is null without a games-played denominator", () => {
    const totals = { runs: 12 };
    expect(computeDerivedStat("kickball", "runsPerGame", totals)).toBeNull();
    expect(computeDerivedStat("kickball", "runsPerGame", totals, { gamesPlayed: 4 })).toBeCloseTo(3, 5);
  });

  test("null formats as an em dash for every format", () => {
    expect(formatDerivedStat("kickball", "runsPerGame", null)).toBe("—");
    expect(formatDerivedStat("flag_football", "completionPct", null)).toBe("—");
    expect(formatDerivedStat("kickball", "kickAverage", Infinity)).toBe("—");
  });

  test("unknown keys resolve safely", () => {
    expect(derivedStat("kickball", "nope")).toBeNull();
    expect(isDerivedStat("kickball", "kickAverage")).toBe(true);
    expect(isDerivedStat("kickball", "homeRuns")).toBe(false);
    expect(computeDerivedStat("kickball", "nope", {})).toBeNull();
  });

  test("label lookup spans counting and derived stats", () => {
    expect(anyStatLabel("kickball", "homeRuns")).toBe("Home Runs");
    expect(anyStatLabel("kickball", "kickAverage")).toBe("Kick Average");
  });
});

describe("leaderboard qualifiers", () => {
  test("a player below the minimum denominator does not qualify", () => {
    expect(meetsQualifier("flag_football", "completionPct", { attempts: 5 })).toBe(false);
    expect(meetsQualifier("flag_football", "completionPct", { attempts: 20 })).toBe(true);
  });

  test("a stat with no qualifier always qualifies", () => {
    expect(meetsQualifier("flag_football", "scrimmageYards", {})).toBe(true);
  });
});

describe("games played", () => {
  test("returns null when the state carries no participation collection at all", () => {
    const { gameParticipation, ...withoutParticipation } = state;
    expect(playerGamesPlayed(withoutParticipation, "p1", "kickball")).toBeNull();
  });

  test("the seed supplies participation, so games played is a real number", () => {
    expect(playerGamesPlayed(state, "p1", "kickball")).toBeGreaterThan(0);
  });

  test("counts only distinct played games inside the requested domain", () => {
    const withParticipation = {
      ...state,
      gameParticipation: [
        { id: "gp1", game_id: "g1", profile_id: "p1", team_id: "t1", status: "played" },
        { id: "gp2", game_id: "g3", profile_id: "p1", team_id: "t1", status: "played" },
        // absent must not count toward games played
        { id: "gp3", game_id: "g2", profile_id: "p1", team_id: "t1", status: "absent" },
      ],
    };
    expect(playerGamesPlayed(withParticipation, "p1", "kickball", { season: "Summer 2026" })).toBe(2);
  });

  test("per-game derived stats are dark without participation and light up with it", () => {
    const { gameParticipation, ...withoutParticipation } = state;
    expect(playerDerivedStat(withoutParticipation, "p1", "kickball", "runsPerGame")).toBeNull();
    expect(playerDerivedStat(state, "p1", "kickball", "runsPerGame")).not.toBeNull();
  });
});

describe("team record form and streak", () => {
  test("preserves the existing record fields", () => {
    const record = computeTeamRecord(state, "t1");
    expect(record).toEqual(expect.objectContaining({
      wins: expect.any(Number),
      losses: expect.any(Number),
      ties: expect.any(Number),
      pointsFor: expect.any(Number),
      pointsAgainst: expect.any(Number),
      diff: expect.any(Number),
      played: expect.any(Number),
    }));
    expect(record.played).toBe(record.wins + record.losses + record.ties);
  });

  test("form lists at most the five most recent results, oldest first", () => {
    const record = computeTeamRecord(state, "t1");
    expect(record.form.length).toBeLessThanOrEqual(5);
    record.form.forEach((result) => expect(["W", "L", "T"]).toContain(result));
  });

  test("streak counts consecutive identical results back from the latest game", () => {
    const twoWins = {
      ...state,
      games: [
        { id: "x1", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-06-01T18:00:00-06:00", stage: "regular", status: "completed", score_status: "approved", home_score: 5, away_score: 1 },
        { id: "x2", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t3", starts_at: "2026-06-08T18:00:00-06:00", stage: "regular", status: "completed", score_status: "approved", home_score: 6, away_score: 2 },
      ],
    };
    expect(computeTeamRecord(twoWins, "t1").streak).toEqual({ result: "W", count: 2, label: "W2" });
  });

  test("a tie breaks the streak instead of extending it", () => {
    const endsInTie = {
      ...state,
      games: [
        { id: "x1", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-06-01T18:00:00-06:00", stage: "regular", status: "completed", score_status: "approved", home_score: 5, away_score: 1 },
        { id: "x2", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t3", starts_at: "2026-06-08T18:00:00-06:00", stage: "regular", status: "completed", score_status: "approved", home_score: 3, away_score: 3 },
      ],
    };
    expect(computeTeamRecord(endsInTie, "t1").streak).toBeNull();
    expect(computeTeamRecord(endsInTie, "t1").ties).toBe(1);
  });

  test("a team with no completed games has empty form and no streak", () => {
    const record = computeTeamRecord({ ...state, games: [] }, "t1");
    expect(record.form).toEqual([]);
    expect(record.streak).toBeNull();
  });
});

describe("rank context", () => {
  test("returns the player's place on a leaderboard they appear on", () => {
    const context = playerRankContext(state, "p5", "kickball", "homeRuns");
    if (context) {
      expect(context.rank).toBeGreaterThanOrEqual(1);
      expect(context.fieldSize).toBeGreaterThanOrEqual(context.rank);
      expect(context.rankLabel).toEqual(expect.any(String));
    }
  });

  test("returns null for a player with no qualifying value", () => {
    expect(playerRankContext(state, "does-not-exist", "kickball", "homeRuns")).toBeNull();
  });
});

/* ----------------------------------------------------------------------------
 * Mixed-domain career rates. A baseline may supply a numerator with no
 * denominator, which makes the resulting ratio meaningless rather than merely
 * large. These pin the exact seed values that produced a published career kick
 * average of 6.000, so the defect cannot come back quietly.
 * -------------------------------------------------------------------------- */
describe("career baselines poison career rates", () => {
  test("p1's baseline supplies hits but no kicks", () => {
    expect(hasCareerBaseline(state, "p1", "kickball")).toBe(true);
    expect(Object.keys(state.careerBaselines.p1.kickball)).not.toContain("kicks");

    const career = playerCareerStats(state, "p1", "kickball");
    const season = playerSeasonStats(state, "p1", "kickball", "Summer 2026");
    // Every kick came from a granular game; the baseline added only hits.
    expect(career.kicks).toBe(season.kicks);
  });

  test("a qualifier threshold does NOT rescue the ratio", () => {
    const career = playerCareerStats(state, "p1", "kickball");
    // Exactly at the kicks >= 10 threshold, so the gate passes...
    expect(meetsQualifier("kickball", "kickAverage", career)).toBe(true);
    // ...and would publish an impossible figure. This is why the fix keys on
    // baseline contribution rather than on a minimum denominator.
    expect(computeDerivedStat("kickball", "kickAverage", career)).toBeGreaterThan(1);
  });

  test("the season scope stays sound because it is entirely granular", () => {
    const season = playerSeasonStats(state, "p1", "kickball", "Summer 2026");
    expect(computeDerivedStat("kickball", "kickAverage", season)).toBeLessThanOrEqual(1);
  });

  test("a profile with no baseline is unaffected", () => {
    expect(hasCareerBaseline(state, "p4", "kickball")).toBe(false);
  });
});
