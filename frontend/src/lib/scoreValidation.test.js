import { enforceAggregateValidation, validateAggregateScore } from "./scoreValidation";

const teams = [
  { id: "home", name: "Home" },
  { id: "away", name: "Away" },
];
const teamPlayers = [
  { profile_id: "kh", team_id: "home", roster_status: "eligible" },
  { profile_id: "ka", team_id: "away", roster_status: "eligible" },
  { profile_id: "fh", team_id: "home", roster_status: "eligible" },
  { profile_id: "fa", team_id: "away", roster_status: "eligible" },
];

const base = (sport) => ({
  game: { id: "game", sport, home_team_id: "home", away_team_id: "away", stage: "regular" },
  teams,
  teamPlayers,
});

describe("aggregate score validation tiers", () => {
  test("[INV-01][INV-03] HARD rejects kickball period arithmetic with values", () => {
    const result = validateAggregateScore({
      ...base("kickball"),
      home_score: 3,
      away_score: 1,
      periods: { home: [1, 1], away: [1, 0] },
      statsByPlayer: {},
    });

    expect(result.hard).toEqual(expect.arrayContaining([
      expect.objectContaining({ invId: "INV-01", code: "period_sum_mismatch" }),
    ]));
    expect(result.hard[0].message).toContain("period sum 2");
    expect(result.hard[0].message).toContain("entered score 3");
  });

  test("[INV-09] HARD rejects an aggregate score for a canceled game", () => {
    const result = validateAggregateScore({
      ...base("kickball"),
      game: { ...base("kickball").game, status: "canceled" },
      home_score: 1,
      away_score: 0,
      periods: { home: [1], away: [0] },
      statsByPlayer: {},
    });

    expect(result.hard).toEqual(expect.arrayContaining([
      expect.objectContaining({ invId: "INV-09", code: "canceled_game_score" }),
    ]));
    expect(result.hard.find((item) => item.code === "canceled_game_score")?.message)
      .toContain("game");
  });

  test("[INV-08] HARD rejects a tied regular-season kickball final", () => {
    const result = validateAggregateScore({
      ...base("kickball"),
      home_score: 3,
      away_score: 3,
      periods: { home: [1, 2], away: [2, 1] },
      statsByPlayer: {
        kh: { team_id: "home", stats: { runs: 3 } },
        ka: { team_id: "away", stats: { runs: 3 } },
      },
    });

    expect(result.hard).toEqual(expect.arrayContaining([
      expect.objectContaining({ invId: "INV-08", code: "final_tie_not_allowed" }),
    ]));
    expect(result.hard.find((item) => item.code === "final_tie_not_allowed")?.message)
      .toContain("3-3");
  });

  test("[INV-05] SOFT kickball score/stat mismatch requires and accepts an override reason", () => {
    const payload = {
      ...base("kickball"),
      home_score: 2,
      away_score: 1,
      periods: { home: [2], away: [1] },
      statsByPlayer: {
        kh: { team_id: "home", stats: { runs: 1, rbis: 1 } },
        ka: { team_id: "away", stats: { runs: 1 } },
      },
    };

    expect(() => enforceAggregateValidation(payload)).toThrow("override reason");
    expect(enforceAggregateValidation(payload, "Scorebook confirms an unassigned run").soft)
      .toEqual(expect.arrayContaining([expect.objectContaining({ invId: "INV-05" })]));
  });

  test("[INV-03][INV-04][INV-11] HARD rejects invalid flag stats and attribution", () => {
    const result = validateAggregateScore({
      ...base("flag_football"),
      home_score: 6,
      away_score: 0,
      periods: { home: [6, 0, 0, 0], away: [0, 0, 0, 0] },
      statsByPlayer: {
        outsider: { team_id: "other", stats: { mystery: 1, tds: -1 } },
      },
    });

    expect(result.hard.map((item) => item.invId)).toEqual(expect.arrayContaining(["INV-03", "INV-04", "INV-11"]));
  });

  test("[INV-06][INV-07] SOFT flag reconciliation allows a recorded override", () => {
    const payload = {
      ...base("flag_football"),
      home_score: 8,
      away_score: 0,
      periods: { home: [8, 0, 0, 0], away: [0, 0, 0, 0] },
      statsByPlayer: {
        fh: { team_id: "home", stats: { tds: 1, twoPoint: 0, passTDs: 1, recTDs: 0 } },
        fa: { team_id: "away", stats: {} },
      },
    };

    const warnings = validateAggregateScore(payload).soft;
    expect(warnings.map((item) => item.invId)).toEqual(expect.arrayContaining(["INV-06", "INV-07"]));
    expect(() => enforceAggregateValidation(payload)).toThrow("override reason");
    expect(enforceAggregateValidation(payload, "Official sheet credits the conversion").soft.length).toBeGreaterThan(0);
  });

  test("[INV-03][INV-13] signed yardage and player-attributed safety are valid flag values", () => {
    const result = validateAggregateScore({
      ...base("flag_football"),
      home_score: 2,
      away_score: 0,
      periods: { home: [0, 2, 0, 0], away: [0, 0, 0, 0] },
      statsByPlayer: {
        fh: { team_id: "home", stats: { passYards: -4, recYards: -4, safeties: 1 } },
        fa: { team_id: "away", stats: {} },
      },
    });

    expect(result.hard).toEqual([]);
    expect(result.soft).toEqual([]);
  });
});
