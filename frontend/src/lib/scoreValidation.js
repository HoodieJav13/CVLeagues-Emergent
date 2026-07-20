import { allStatKeys } from "./statsConfig";

export const SIGNED_STAT_KEYS = new Set(["passYards", "rushYards", "recYards"]);

const issue = (invId, code, message, values = {}) => ({ invId, code, message, values });
const isInteger = (value) => Number.isFinite(Number(value)) && Number.isInteger(Number(value));
const isActiveRosterRow = (row) => !["removed", "inactive"].includes(row.roster_status);

const teamLabel = (teams, id, fallback) => teams.find((team) => team.id === id)?.name || fallback;

const statTotal = (entries, teamId, key) => entries
  .filter((entry) => entry.team_id === teamId)
  .reduce((sum, entry) => sum + (Number(entry.stats?.[key]) || 0), 0);

export function validateAggregateScore({
  game,
  home_score,
  away_score,
  periods,
  statsByPlayer = {},
  teamPlayers = [],
  teams = [],
}) {
  const hard = [];
  const soft = [];

  if (!game) {
    return { hard: [issue("INV-04", "unknown_game", "[INV-04] The controlled score mutation target no longer exists.")], soft };
  }

  if (game.status === "canceled") {
    hard.push(issue(
      "INV-09",
      "canceled_game_score",
      `[INV-09] Canceled game ${game.id || "(unknown id)"} cannot receive an aggregate score.`,
      { game_id: game.id || null, status: game.status }
    ));
  }

  const scores = { home: Number(home_score), away: Number(away_score) };
  for (const side of ["home", "away"]) {
    if (!isInteger(scores[side]) || scores[side] < 0) {
      hard.push(issue(
        "INV-03",
        "invalid_score",
        `[INV-03] ${side === "home" ? "Home" : "Away"} score must be a nonnegative integer; received ${(side === "home" ? home_score : away_score) ?? "null"}.`,
        { side, value: side === "home" ? home_score : away_score }
      ));
    }
  }

  if (isInteger(scores.home) && isInteger(scores.away) && scores.home === scores.away
      && (["kickball", "flag_football"].includes(game.sport) || game.stage === "playoff")) {
    hard.push(issue(
      "INV-08",
      "final_tie_not_allowed",
      `[INV-08] Season 1 final scores cannot be tied; received ${scores.home}-${scores.away}.`,
      { home: scores.home, away: scores.away }
    ));
  }

  const homePeriods = periods?.home;
  const awayPeriods = periods?.away;
  if (!Array.isArray(homePeriods) || !Array.isArray(awayPeriods)) {
    hard.push(issue("INV-01", "invalid_period_shape", "[INV-01] Periods must contain home and away arrays."));
  } else {
    if (homePeriods.length === 0 || homePeriods.length !== awayPeriods.length) {
      hard.push(issue(
        "INV-01",
        "period_length_mismatch",
        `[INV-01] Home and away must have the same nonzero period count; received home=${homePeriods.length}, away=${awayPeriods.length}.`,
        { home: homePeriods.length, away: awayPeriods.length }
      ));
    }
    if (game.sport === "flag_football" && homePeriods.length !== 4) {
      hard.push(issue(
        "INV-10",
        "flag_period_count",
        `[INV-10] Flag football regulation requires four quarters; received ${homePeriods.length}.`,
        { count: homePeriods.length }
      ));
    }

    for (const [side, values] of [["home", homePeriods], ["away", awayPeriods]]) {
      values.forEach((value, index) => {
        if (!isInteger(value) || Number(value) < 0) {
          hard.push(issue(
            "INV-03",
            "invalid_period_value",
            `[INV-03] ${side} period ${index + 1} must be a nonnegative integer; received ${value}.`,
            { side, period: index + 1, value }
          ));
        }
      });
      const sum = values.reduce((total, value) => total + (isInteger(value) ? Number(value) : 0), 0);
      if (isInteger(scores[side]) && sum !== scores[side]) {
        hard.push(issue(
          "INV-01",
          "period_sum_mismatch",
          `[INV-01] ${side} period sum ${sum} does not equal entered score ${scores[side]}.`,
          { side, periodSum: sum, score: scores[side] }
        ));
      }
    }
  }

  const allowedKeys = new Set(allStatKeys(game.sport));
  const teamIds = new Set([game.home_team_id, game.away_team_id]);
  const entries = [];

  for (const [profile_id, entry] of Object.entries(statsByPlayer || {})) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      hard.push(issue("INV-03", "invalid_stat_entry", `[INV-03] Player ${profile_id} has an invalid stat entry.`));
      continue;
    }
    if (!teamIds.has(entry.team_id)) {
      hard.push(issue(
        "INV-11",
        "invalid_stat_team",
        `[INV-11] Player ${profile_id} is attributed to team ${entry.team_id || "null"}, which is not in this game.`,
        { profile_id, team_id: entry.team_id }
      ));
    }
    const rostered = teamPlayers.some((row) =>
      row.profile_id === profile_id && row.team_id === entry.team_id && isActiveRosterRow(row)
    );
    if (!rostered) {
      hard.push(issue(
        "INV-11",
        "player_not_on_team",
        `[INV-11] Player ${profile_id} is not on the active roster for team ${entry.team_id || "null"}.`,
        { profile_id, team_id: entry.team_id }
      ));
    }

    const stats = entry.stats;
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
      hard.push(issue("INV-03", "invalid_stats_object", `[INV-03] Player ${profile_id} stats must be an object.`));
      continue;
    }
    for (const [key, value] of Object.entries(stats)) {
      if (!allowedKeys.has(key)) {
        hard.push(issue(
          "INV-04",
          "invalid_stat_key",
          `[INV-04] Stat key ${key} is not valid for ${game.sport}; player ${profile_id}.`,
          { profile_id, key, sport: game.sport }
        ));
        continue;
      }
      if (!isInteger(value)) {
        hard.push(issue(
          "INV-03",
          "noninteger_stat",
          `[INV-03] ${key} for player ${profile_id} must be an integer; received ${value}.`,
          { profile_id, key, value }
        ));
      } else if (!SIGNED_STAT_KEYS.has(key) && Number(value) < 0) {
        hard.push(issue(
          "INV-03",
          "negative_count_stat",
          `[INV-03] ${key} for player ${profile_id} cannot be negative; received ${value}.`,
          { profile_id, key, value }
        ));
      }
    }
    entries.push({ profile_id, team_id: entry.team_id, stats });
  }

  const homeName = teamLabel(teams, game.home_team_id, "Home team");
  const awayName = teamLabel(teams, game.away_team_id, "Away team");
  const sides = [
    { id: game.home_team_id, name: homeName, score: scores.home, opponent: game.away_team_id },
    { id: game.away_team_id, name: awayName, score: scores.away, opponent: game.home_team_id },
  ];

  if (game.sport === "kickball") {
    for (const side of sides) {
      const runs = statTotal(entries, side.id, "runs");
      const rbis = statTotal(entries, side.id, "rbis");
      if (isInteger(side.score) && runs !== side.score) {
        soft.push(issue(
          "INV-05",
          "kickball_runs_score",
          `[INV-05] ${side.name} has ${runs} recorded player runs but an entered score of ${side.score}.`,
          { team_id: side.id, runs, score: side.score }
        ));
      }
      if (rbis > runs) {
        soft.push(issue(
          "INV-05",
          "kickball_rbis_runs",
          `[INV-05] ${side.name} has ${rbis} RBIs but only ${runs} recorded runs.`,
          { team_id: side.id, rbis, runs }
        ));
      }
    }
  }

  if (game.sport === "flag_football") {
    for (const side of sides) {
      const tds = statTotal(entries, side.id, "tds");
      const onePoint = statTotal(entries, side.id, "onePoint");
      const twoPoint = statTotal(entries, side.id, "twoPoint");
      const threePoint = statTotal(entries, side.id, "threePoint");
      const safeties = statTotal(entries, side.id, "safeties");
      const derived = 6 * tds + onePoint + 2 * twoPoint + 3 * threePoint + 2 * safeties;
      if (isInteger(side.score) && derived !== side.score) {
        soft.push(issue(
          "INV-06",
          "flag_points_score",
          `[INV-06] ${side.name} stat-derived points are ${derived} but the entered score is ${side.score}.`,
          { team_id: side.id, derived, score: side.score }
        ));
      }

      for (const [left, right, label, invId] of [
        ["completions", "catches", "completions/catches", "INV-07"],
        ["passYards", "recYards", "passing/receiving yards", "INV-07"],
        ["passTDs", "recTDs", "passing/receiving touchdowns", "INV-07"],
      ]) {
        const leftValue = statTotal(entries, side.id, left);
        const rightValue = statTotal(entries, side.id, right);
        if (leftValue !== rightValue) {
          soft.push(issue(
            invId,
            `flag_${left}_${right}`,
            `[${invId}] ${side.name} ${label} do not reconcile: ${left}=${leftValue}, ${right}=${rightValue}.`,
            { team_id: side.id, [left]: leftValue, [right]: rightValue }
          ));
        }
      }

      const ints = statTotal(entries, side.id, "ints");
      const opponentDefInts = statTotal(entries, side.opponent, "defInts");
      if (ints !== opponentDefInts) {
        soft.push(issue(
          "INV-07",
          "flag_interceptions",
          `[INV-07] ${side.name} interceptions thrown (${ints}) do not match opponent defensive interceptions (${opponentDefInts}).`,
          { team_id: side.id, ints, opponentDefInts }
        ));
      }

      for (const [part, whole, label] of [
        ["completions", "attempts", "completions cannot exceed attempts"],
        ["rushFirstDowns", "carries", "rushing first downs cannot exceed carries"],
        ["recFirstDowns", "catches", "receiving first downs cannot exceed catches"],
      ]) {
        const partValue = statTotal(entries, side.id, part);
        const wholeValue = statTotal(entries, side.id, whole);
        if (partValue > wholeValue) {
          soft.push(issue(
            "INV-07",
            `flag_${part}_${whole}`,
            `[INV-07] ${side.name} ${label}: ${part}=${partValue}, ${whole}=${wholeValue}.`,
            { team_id: side.id, [part]: partValue, [whole]: wholeValue }
          ));
        }
      }
    }
  }

  return { hard, soft };
}

export class ScoreValidationError extends Error {
  constructor(issues) {
    super(issues.map((item) => item.message).join(" "));
    this.name = "ScoreValidationError";
    this.issues = issues;
  }
}

export function enforceAggregateValidation(payload, overrideReason = "") {
  const result = validateAggregateScore(payload);
  if (result.hard.length) throw new ScoreValidationError(result.hard);
  if (result.soft.length && !overrideReason.trim()) {
    throw new ScoreValidationError([
      issue(
        result.soft[0].invId,
        "override_reason_required",
        `Soft validation warnings require an override reason. ${result.soft.map((item) => item.message).join(" ")}`
      ),
    ]);
  }
  return result;
}
