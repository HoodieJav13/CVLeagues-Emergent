/* ============================================================================
 * SELECTORS — pure business-logic / derived-data functions.
 * ----------------------------------------------------------------------------
 * These compute records, standings, stat totals and leaderboards FROM the
 * shared raw state (games + playerStats). Nothing is precomputed/stored, so a
 * single game update propagates everywhere automatically.
 *
 * PHASE 2: these become SQL views / RPC functions or server-side queries.
 * ========================================================================== */

import { allStatKeys, computeDerivedStat } from "./statsConfig.js";
import { gameStartValue, byStartAscending } from "./gameTime.js";

/* ---------------------------- lookups ------------------------------------ */
export const getTeam = (state, id) => state.teams.find((t) => t.id === id);
export const getProfile = (state, id) => state.profiles.find((p) => p.id === id);
export const getLeague = (state, id) => state.leagues.find((l) => l.id === id);
export const getGame = (state, id) => state.games.find((g) => g.id === id);
export const isForfeitOutcome = (game) => Boolean(
  game
  && game.outcome_type === "forfeit"
  && game.status === "canceled"
  && game.score_status === "final"
  && game.locked
  && game.winner_team_id
  && game.loser_team_id
);
export const isFinalOutcome = (game) => game?.status === "completed" || isForfeitOutcome(game);

export const teamName = (state, id) => getTeam(state, id)?.name ?? "TBD";
export const playerName = (state, id) => getProfile(state, id)?.name ?? "Unknown";

export function currentSeasonForSport(state, sport) {
  return state.settings?.current_seasons?.[sport]
    || state.settings?.current_season
    || state.seasons?.find((season) => season.status === "active")?.name
    || "";
}

export function seasonsForSport(state, sport, { kind = "league" } = {}) {
  const names = new Set(
    state.leagues
      .filter((league) => league.sport === sport && (!kind || league.kind === kind))
      .map((league) => league.season)
  );
  if (kind === "league") names.add(currentSeasonForSport(state, sport));
  const ordered = (state.seasons || []).filter((season) => names.has(season.name));
  const known = new Set(ordered.map((season) => season.name));
  return [
    ...ordered,
    ...[...names].filter((name) => !known.has(name)).map((name) => ({ name, status: "unknown" })),
  ];
}

/* --------------------------- team records -------------------------------- */
// Derived from completed REGULAR-SEASON games only. Playoff/tournament games
// are their own record set and never move the standings (playoffs are seeded
// FROM these records); their stats still count toward season totals — see
// playerSeasonStats. A game with no stage field (legacy persisted state) is
// regular season.
export function computeTeamRecord(state, team_id) {
  let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;
  // Outcomes are also collected in date order so streak and recent form come
  // from the same single pass the totals do — no second source of truth.
  const outcomes = [];
  state.games.forEach((g) => {
    if (!isFinalOutcome(g)) return;
    if (g.stage === "playoff" || g.stage === "tournament") return;
    if (g.home_team_id !== team_id && g.away_team_id !== team_id) return;
    if (isForfeitOutcome(g)) {
      if (g.winner_team_id === team_id) { wins++; outcomes.push({ startsAt: g.starts_at, result: "W" }); }
      else if (g.loser_team_id === team_id) { losses++; outcomes.push({ startsAt: g.starts_at, result: "L" }); }
      return;
    }
    const isHome = g.home_team_id === team_id;
    const own = isHome ? g.home_score : g.away_score;
    const opp = isHome ? g.away_score : g.home_score;
    pf += own; pa += opp;
    if (own > opp) { wins++; outcomes.push({ startsAt: g.starts_at, result: "W" }); }
    else if (own < opp) { losses++; outcomes.push({ startsAt: g.starts_at, result: "L" }); }
    else { ties++; outcomes.push({ startsAt: g.starts_at, result: "T" }); }
  });

  outcomes.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const form = outcomes.slice(-5).map((o) => o.result);

  // Current streak: consecutive identical results counted back from the most
  // recent game. Ties break a streak rather than extending one.
  let streak = null;
  if (outcomes.length) {
    const latest = outcomes[outcomes.length - 1].result;
    if (latest !== "T") {
      let count = 0;
      for (let i = outcomes.length - 1; i >= 0 && outcomes[i].result === latest; i -= 1) count += 1;
      streak = { result: latest, count, label: `${latest}${count}` };
    }
  }

  return {
    wins, losses, ties,
    pointsFor: pf, pointsAgainst: pa, diff: pf - pa,
    played: wins + losses + ties,
    form,
    streak,
  };
}

/* ----------------------------- standings --------------------------------- */
// Sort by wins, mini-table head-to-head wins among teams tied on overall wins,
// then point differential and points scored.
export function computeStandings(state, league_id) {
  const teams = state.teams.filter((t) => t.league_id === league_id);
  const rows = teams.map((t) => ({ team: t, record: computeTeamRecord(state, t.id) }));
  const winsByTeam = new Map(rows.map((row) => [row.team.id, row.record.wins]));
  const headToHeadWins = new Map(rows.map((row) => [row.team.id, 0]));

  state.games.forEach((game) => {
    if (game.league_id !== league_id || !isFinalOutcome(game) || game.stage === "playoff" || game.stage === "tournament") return;
    if (winsByTeam.get(game.home_team_id) !== winsByTeam.get(game.away_team_id)) return;
    const winner = isForfeitOutcome(game)
      ? game.winner_team_id
      : game.home_score === game.away_score
        ? null
        : game.home_score > game.away_score ? game.home_team_id : game.away_team_id;
    if (!winner) return;
    if (headToHeadWins.has(winner)) headToHeadWins.set(winner, headToHeadWins.get(winner) + 1);
  });

  const sorted = rows.sort((a, b) => {
    if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
    const h2h = headToHeadWins.get(b.team.id) - headToHeadWins.get(a.team.id);
    if (h2h !== 0) return h2h;
    if (b.record.diff !== a.record.diff) return b.record.diff - a.record.diff;
    return b.record.pointsFor - a.record.pointsFor;
  });

  // Two teams are genuinely tied only when the ENTIRE tiebreak chain fails to
  // separate them. `rank` stays a sequential seed position because playoff
  // seeding consumes it; `rankLabel`/`tied` carry the contract's shared-rank
  // display convention (T3/T3, next skips to 5).
  const tiebreakKey = (row) => [
    row.record.wins,
    headToHeadWins.get(row.team.id),
    row.record.diff,
    row.record.pointsFor,
  ].join("|");

  let sharedRank = 0;
  let previousKey = null;
  const withDisplayRank = sorted.map((row, i) => {
    const key = tiebreakKey(row);
    if (i === 0 || key !== previousKey) sharedRank = i + 1;
    previousKey = key;
    return { ...row, rank: i + 1, displayRank: sharedRank };
  });

  const displayRankCounts = withDisplayRank.reduce((counts, row) => {
    counts.set(row.displayRank, (counts.get(row.displayRank) || 0) + 1);
    return counts;
  }, new Map());

  return withDisplayRank.map((row) => {
    const tied = displayRankCounts.get(row.displayRank) > 1;
    return { ...row, tied, rankLabel: tied ? `T${row.displayRank}` : `${row.displayRank}` };
  });
}

/* --------------------------- stat aggregation ---------------------------- */
const zeroStats = (sport) =>
  allStatKeys(sport).reduce((acc, k) => ((acc[k] = 0), acc), {});

function addStats(target, stats) {
  Object.entries(stats || {}).forEach(([k, v]) => {
    target[k] = (target[k] || 0) + (Number(v) || 0);
  });
  return target;
}

const statContext = (state, row) => {
  const game = getGame(state, row.game_id);
  const league = game ? getLeague(state, game.league_id) : null;
  return { game, league };
};

// League season totals include regular-season and playoff games for one
// selected season. Standalone tournaments are deliberately excluded.
export function playerSeasonStats(state, profile_id, sport, season = currentSeasonForSport(state, sport)) {
  const total = zeroStats(sport);
  state.playerStats
    .filter((s) => s.profile_id === profile_id && s.sport === sport)
    .filter((s) => {
      const { game, league } = statContext(state, s);
      return game
        && game.status === "completed"
        && league?.kind !== "tournament"
        && league?.season === season
        && game.stage !== "tournament";
    })
    .forEach((s) => addStats(total, s.stats));
  return total;
}

// League career = prior imported baseline + every league season. Standalone
// tournaments never affect league career/all-time records.
export function playerCareerStats(state, profile_id, sport) {
  const leagueTotals = zeroStats(sport);
  state.playerStats
    .filter((s) => s.profile_id === profile_id && s.sport === sport)
    .filter((s) => {
      const { game, league } = statContext(state, s);
      return game && game.status === "completed" && league?.kind !== "tournament" && game.stage !== "tournament";
    })
    .forEach((s) => addStats(leagueTotals, s.stats));
  const baseline = state.careerBaselines?.[profile_id]?.[sport] || {};
  return addStats(leagueTotals, baseline);
}

// Tournament totals live in a separate stat domain. tournament_id is the
// standalone tournament container (a leagues row with kind='tournament').
export function playerTournamentStats(state, profile_id, sport, tournament_id = null) {
  const total = zeroStats(sport);
  state.playerStats
    .filter((s) => s.profile_id === profile_id && s.sport === sport)
    .filter((s) => {
      const { game, league } = statContext(state, s);
      return game
        && game.status === "completed"
        && league?.kind === "tournament"
        && game.stage === "tournament"
        && (!tournament_id || league.id === tournament_id);
    })
    .forEach((s) => addStats(total, s.stats));
  return total;
}

// Per-game log defaults to the league stat domain. Tournament logs must be
// requested explicitly so the two record systems never blend in the UI.
export function playerGameLog(state, profile_id, sport, { domain = "league", season = null, tournament_id = null } = {}) {
  return state.playerStats
    .filter((s) => s.profile_id === profile_id && s.sport === sport)
    .map((s) => {
      const { game, league } = statContext(state, s);
      return { ...s, game, league };
    })
    .filter((s) => {
      if (!s.game || !s.league) return false;
      if (domain === "tournament") {
        return s.league.kind === "tournament"
          && s.game.stage === "tournament"
          && (!tournament_id || s.league.id === tournament_id);
      }
      return s.league.kind !== "tournament"
        && s.game.stage !== "tournament"
        && (!season || s.league.season === season);
    })
    .sort((a, b) => gameStartValue(b.game) - gameStartValue(a.game));
}

/* --------------------------- games played -------------------------------- */
// Participation is recorded separately from statistics: a player who appeared
// and recorded nothing still played that game, so a stat row is NOT evidence of
// games played. Until participation data exists this returns null, and every
// per-game figure downstream renders an em dash rather than a wrong average.
const PLAYED_STATUSES = ["played"];

export function playerGamesPlayed(state, profile_id, sport, { domain = "league", season = null, tournament_id = null } = {}) {
  const rows = state.gameParticipation;
  if (!Array.isArray(rows)) return null;

  const games = new Set();
  rows.forEach((row) => {
    if (row.profile_id !== profile_id) return;
    if (!PLAYED_STATUSES.includes(row.status)) return;
    const { game, league } = statContext(state, row);
    if (!game || !league || !isFinalOutcome(game)) return;
    if (getTeam(state, row.team_id)?.sport !== sport) return;
    if (domain === "tournament") {
      if (league.kind !== "tournament" || game.stage !== "tournament") return;
      if (tournament_id && league.id !== tournament_id) return;
    } else {
      if (league.kind === "tournament" || game.stage === "tournament") return;
      if (season && league.season !== season) return;
    }
    games.add(row.game_id);
  });
  return games.size;
}

// One derived figure for one player, with the correct totals and games-played
// denominator for the requested scope.
export function playerDerivedStat(state, profile_id, sport, statKey, scope = "season", context = null) {
  const totals = scope === "career"
    ? playerCareerStats(state, profile_id, sport)
    : scope === "tournament"
      ? playerTournamentStats(state, profile_id, sport, context)
      : playerSeasonStats(state, profile_id, sport, context || currentSeasonForSport(state, sport));
  const gamesPlayed = playerGamesPlayed(state, profile_id, sport, {
    domain: scope === "tournament" ? "tournament" : "league",
    season: scope === "season" ? (context || currentSeasonForSport(state, sport)) : null,
    tournament_id: scope === "tournament" ? context : null,
  });
  return computeDerivedStat(sport, statKey, totals, { gamesPlayed });
}

/* ------------------------- franchise history ----------------------------- */
// A team_identity is the persistent brand; each `teams` row is one explicit
// league/season/sport enrollment of it. Franchise history is therefore every
// enrollment sharing an identity — the thing that makes "past results all
// saved" reachable from the team you are looking at.
export function identityEnrollments(state, identity_id) {
  if (!identity_id) return [];
  return state.teams
    .filter((team) => team.identity_id === identity_id)
    .map((team) => ({
      team,
      league: getLeague(state, team.league_id),
      record: computeTeamRecord(state, team.id),
    }))
    .sort((a, b) => String(b.league?.season || "").localeCompare(String(a.league?.season || "")));
}

// Career totals across every enrollment of one identity.
export function identityCareerRecord(state, identity_id) {
  return identityEnrollments(state, identity_id).reduce((total, row) => ({
    wins: total.wins + row.record.wins,
    losses: total.losses + row.record.losses,
    ties: total.ties + row.record.ties,
    seasons: total.seasons + 1,
  }), { wins: 0, losses: 0, ties: 0, seasons: 0 });
}

/* --------------------------- rank context -------------------------------- */
// Where one player sits on a leaderboard they already appear on. Returns null
// when the player has no qualifying value, so callers render nothing at all
// rather than an invented "unranked" position.
export function playerRankContext(state, profile_id, sport, statKey, scope = "season", context = null) {
  const rows = buildLeaderboard(state, sport, statKey, scope, context);
  const row = rows.find((entry) => entry.profile?.id === profile_id);
  if (!row) return null;
  return { rank: row.rank, rankLabel: row.rankLabel, tied: row.tied, value: row.value, fieldSize: rows.length };
}

// Roster rows that still count. Backend soft-deletes assignments via
// roster_status ('removed'/'inactive'); mock rows have no roster_status and
// pass through. 'pending_waiver' and 'eligible' are both ACTIVE — eligibility
// is informational only and never hides a player.
const activeRosterRows = (state) =>
  state.teamPlayers.filter((tp) => !["removed", "inactive"].includes(tp.roster_status));

// Which sports has this player recorded stats / roster spots in.
export function playerSports(state, profile_id) {
  const fromRoster = activeRosterRows(state)
    .filter((tp) => tp.profile_id === profile_id)
    .map((tp) => getTeam(state, tp.team_id)?.sport)
    .filter(Boolean);
  const fromStats = state.playerStats.filter((row) => row.profile_id === profile_id).map((row) => row.sport);
  return [...new Set([...fromRoster, ...fromStats])];
}

// Teams a player belongs to (with sport + role meta).
export function playerTeams(state, profile_id) {
  return activeRosterRows(state)
    .filter((tp) => tp.profile_id === profile_id)
    .map((tp) => {
      const team = getTeam(state, tp.team_id);
      return team
        ? { ...tp, team, isCaptain: team.captain_id === profile_id, record: computeTeamRecord(state, team.id) }
        : null;
    })
    .filter(Boolean);
}

/* ------------------------------- roster ---------------------------------- */
export function teamRoster(state, team_id) {
  return activeRosterRows(state)
    .filter((tp) => tp.team_id === team_id)
    .map((tp) => ({ ...tp, profile: getProfile(state, tp.profile_id) }))
    .filter((tp) => tp.profile);
}

/* ------------------------------ schedule --------------------------------- */
export function teamGames(state, team_id) {
  return state.games
    .filter((g) => g.home_team_id === team_id || g.away_team_id === team_id)
    .sort(byStartAscending);
}

/* ---------------------------- leaderboards ------------------------------- */
// Apply standard competition ranking to an already value-sorted result set.
// Equal values share a T-rank and consume every occupied place (1, T2, T2, 4).
export function applyCompetitionRanks(rows) {
  const valueCounts = rows.reduce((counts, row) => {
    counts.set(row.value, (counts.get(row.value) || 0) + 1);
    return counts;
  }, new Map());

  let previousValue;
  let previousRank = 0;

  return rows.map((row, index) => {
    const rank = index > 0 && row.value === previousValue ? previousRank : index + 1;
    const tied = valueCounts.get(row.value) > 1;
    previousValue = row.value;
    previousRank = rank;
    return { ...row, rank, rankLabel: tied ? `T${rank}` : `${rank}`, tied };
  });
}

// Build a ranked leaderboard for a sport + stat key.
// scope: 'season' | 'career' | 'tournament'
export function buildLeaderboard(state, sport, statKey, scope = "season", context = null) {
  const fn = scope === "career"
    ? playerCareerStats
    : scope === "tournament"
      ? (s, pid, sp) => playerTournamentStats(s, pid, sp, context)
      : (s, pid, sp) => playerSeasonStats(s, pid, sp, context || currentSeasonForSport(s, sp));
  // Include anyone with matching stats even if the roster later becomes
  // inactive; current roster membership alone is not historical evidence.
  const playerIds = new Set(
    state.playerStats.filter((row) => row.sport === sport).map((row) => row.profile_id)
  );
  activeRosterRows(state)
    .filter((tp) => getTeam(state, tp.team_id)?.sport === sport)
    .forEach((tp) => playerIds.add(tp.profile_id));
  const sortedRows = [...playerIds]
    .map((pid) => {
      const profile = getProfile(state, pid);
      const team = playerTeams(state, pid).find((t) => {
        const league = getLeague(state, t.team.league_id);
        if (t.team.sport !== sport) return false;
        if (scope === "tournament") return league?.id === context;
        if (scope === "season") return league?.season === (context || currentSeasonForSport(state, sport));
        return league?.kind !== "tournament";
      })?.team;
      return { profile, team, value: fn(state, pid, sport)[statKey] || 0 };
    })
    .filter((row) => row.profile && row.value > 0)
    .sort((a, b) => b.value - a.value);

  return applyCompetitionRanks(sortedRows);
}

// Team stat leaders: top player on a team for each highlight stat.
export function teamStatLeaders(state, team_id, highlightKeys) {
  const team = getTeam(state, team_id);
  if (!team) return [];
  const roster = teamRoster(state, team_id);
  return highlightKeys.map((key) => {
    let best = null;
    roster.forEach((r) => {
      const season = getLeague(state, team.league_id)?.season || currentSeasonForSport(state, team.sport);
      const val = playerSeasonStats(state, r.profile_id, team.sport, season)[key] || 0;
      if (!best || val > best.value) best = { profile: r.profile, value: val };
    });
    return { key, ...(best || {}) };
  });
}

/* -------------------------- claimed counts ------------------------------- */
export function claimStats(state) {
  const claimed = state.profiles.filter((p) => p.claimed).length;
  return { claimed, unclaimed: state.profiles.length - claimed, total: state.profiles.length };
}
