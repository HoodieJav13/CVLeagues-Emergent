/* ============================================================================
 * SELECTORS — pure business-logic / derived-data functions.
 * ----------------------------------------------------------------------------
 * These compute records, standings, stat totals and leaderboards FROM the
 * shared raw state (games + playerStats). Nothing is precomputed/stored, so a
 * single game update propagates everywhere automatically.
 *
 * PHASE 2: these become SQL views / RPC functions or server-side queries.
 * ========================================================================== */

import { allStatKeys } from "./statsConfig";

/* ---------------------------- lookups ------------------------------------ */
export const getTeam = (state, id) => state.teams.find((t) => t.id === id);
export const getProfile = (state, id) => state.profiles.find((p) => p.id === id);
export const getLeague = (state, id) => state.leagues.find((l) => l.id === id);
export const getGame = (state, id) => state.games.find((g) => g.id === id);

export const teamName = (state, id) => getTeam(state, id)?.name ?? "TBD";
export const playerName = (state, id) => getProfile(state, id)?.name ?? "Unknown";

/* --------------------------- team records -------------------------------- */
// Derived from completed games only.
export function computeTeamRecord(state, teamId) {
  let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;
  state.games.forEach((g) => {
    if (g.status !== "completed") return;
    if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) return;
    const isHome = g.homeTeamId === teamId;
    const own = isHome ? g.homeScore : g.awayScore;
    const opp = isHome ? g.awayScore : g.homeScore;
    pf += own; pa += opp;
    if (own > opp) wins++;
    else if (own < opp) losses++;
    else ties++;
  });
  return { wins, losses, ties, pointsFor: pf, pointsAgainst: pa, diff: pf - pa, played: wins + losses + ties };
}

/* ----------------------------- standings --------------------------------- */
// Sort by wins desc, then point differential desc, then points-for desc.
export function computeStandings(state, leagueId) {
  const teams = state.teams.filter((t) => t.leagueId === leagueId);
  return teams
    .map((t) => ({ team: t, record: computeTeamRecord(state, t.id) }))
    .sort((a, b) => {
      if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
      if (b.record.diff !== a.record.diff) return b.record.diff - a.record.diff;
      return b.record.pointsFor - a.record.pointsFor;
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));
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

// Aggregate a player's season stats for a given sport (current season only).
export function playerSeasonStats(state, playerId, sport) {
  const total = zeroStats(sport);
  state.playerStats
    .filter((s) => s.playerId === playerId && s.sport === sport)
    .forEach((s) => addStats(total, s.stats));
  return total;
}

// Career = prior-season baseline + current season.
export function playerCareerStats(state, playerId, sport) {
  const season = playerSeasonStats(state, playerId, sport);
  const baseline = state.careerBaselines?.[playerId]?.[sport] || {};
  return addStats({ ...season }, baseline);
}

// Per-game log for a player in a sport (joined with game meta).
export function playerGameLog(state, playerId, sport) {
  return state.playerStats
    .filter((s) => s.playerId === playerId && s.sport === sport)
    .map((s) => ({ ...s, game: getGame(state, s.gameId) }))
    .filter((s) => s.game)
    .sort((a, b) => new Date(b.game.date) - new Date(a.game.date));
}

// Which sports has this player recorded stats / roster spots in.
export function playerSports(state, playerId) {
  const fromRoster = state.teamPlayers
    .filter((tp) => tp.playerId === playerId)
    .map((tp) => getTeam(state, tp.teamId)?.sport)
    .filter(Boolean);
  return [...new Set(fromRoster)];
}

// Teams a player belongs to (with sport + role meta).
export function playerTeams(state, playerId) {
  return state.teamPlayers
    .filter((tp) => tp.playerId === playerId)
    .map((tp) => {
      const team = getTeam(state, tp.teamId);
      return team
        ? { ...tp, team, isCaptain: team.captainId === playerId, record: computeTeamRecord(state, team.id) }
        : null;
    })
    .filter(Boolean);
}

/* ------------------------------- roster ---------------------------------- */
export function teamRoster(state, teamId) {
  return state.teamPlayers
    .filter((tp) => tp.teamId === teamId)
    .map((tp) => ({ ...tp, profile: getProfile(state, tp.playerId) }))
    .filter((tp) => tp.profile);
}

/* ------------------------------ schedule --------------------------------- */
export function teamGames(state, teamId) {
  return state.games
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ---------------------------- leaderboards ------------------------------- */
// Build a ranked leaderboard for a sport + stat key.
// scope: 'season' | 'career'
export function buildLeaderboard(state, sport, statKey, scope = "season") {
  const fn = scope === "career" ? playerCareerStats : playerSeasonStats;
  // candidate players: anyone on a roster for this sport
  const playerIds = new Set(
    state.teamPlayers
      .filter((tp) => getTeam(state, tp.teamId)?.sport === sport)
      .map((tp) => tp.playerId)
  );
  return [...playerIds]
    .map((pid) => {
      const profile = getProfile(state, pid);
      const team = playerTeams(state, pid).find((t) => t.team.sport === sport)?.team;
      return { profile, team, value: fn(state, pid, sport)[statKey] || 0 };
    })
    .filter((row) => row.profile && row.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

// Team stat leaders: top player on a team for each highlight stat.
export function teamStatLeaders(state, teamId, highlightKeys) {
  const team = getTeam(state, teamId);
  if (!team) return [];
  const roster = teamRoster(state, teamId);
  return highlightKeys.map((key) => {
    let best = null;
    roster.forEach((r) => {
      const val = playerSeasonStats(state, r.playerId, team.sport)[key] || 0;
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
