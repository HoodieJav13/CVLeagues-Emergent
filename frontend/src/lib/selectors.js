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
  state.games.forEach((g) => {
    if (g.status !== "completed") return;
    if (g.stage === "playoff" || g.stage === "tournament") return;
    if (g.home_team_id !== team_id && g.away_team_id !== team_id) return;
    const isHome = g.home_team_id === team_id;
    const own = isHome ? g.home_score : g.away_score;
    const opp = isHome ? g.away_score : g.home_score;
    pf += own; pa += opp;
    if (own > opp) wins++;
    else if (own < opp) losses++;
    else ties++;
  });
  return { wins, losses, ties, pointsFor: pf, pointsAgainst: pa, diff: pf - pa, played: wins + losses + ties };
}

/* ----------------------------- standings --------------------------------- */
// Sort by wins desc, then point differential desc, then points-for desc.
export function computeStandings(state, league_id) {
  const teams = state.teams.filter((t) => t.league_id === league_id);
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
    .sort((a, b) => new Date(b.game.date) - new Date(a.game.date));
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
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ---------------------------- leaderboards ------------------------------- */
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
  return [...playerIds]
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
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({ ...row, rank: i + 1 }));
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
