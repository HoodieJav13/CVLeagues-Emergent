import { fromDateTimeLocalValue, isAmbiguousLeagueTime } from "./gameTime";

/* ============================================================================
 * New regular-season game: options and validation (pure; UI-free so the
 * adapter contract can be tested without the dialog). The payload is exactly
 * the schedule columns Migration 29 grants an authenticated client — league,
 * derived sport, both teams, league-time kickoff, venue, stage "regular" —
 * with RLS still requiring the AAL2 admin. Everything else stays a database
 * default or protected output.
 * ========================================================================== */

export const BLANK_NEW_GAME = { league_id: "", home_team_id: "", away_team_id: "", starts_at: "", venue_id: "" };

const isRegularLeague = (league) => league && league.kind !== "tournament" && league.status !== "archived";
const isActiveTeamIn = (team, league_id) => team && team.league_id === league_id && (team.status || "active") !== "inactive";

export const newGameLeagues = (state) => (state.leagues || []).filter(isRegularLeague);
export const newGameTeams = (state, league_id) => (state.teams || []).filter((team) => isActiveTeamIn(team, league_id));
export const newGameVenues = (state) => (state.venues || []).filter((venue) => venue.status !== "retired");

// Returns { errors: { field: message }, payload } — payload is null unless the
// form is complete and every rule holds.
export function validateNewGame(state, form) {
  const errors = {};
  const league = (state.leagues || []).find((item) => item.id === form.league_id);
  const team = (id) => (state.teams || []).find((item) => item.id === id);

  if (!form.league_id) errors.league_id = "Choose a league.";
  else if (!isRegularLeague(league)) errors.league_id = "Choose an active regular-season league (tournaments and playoffs are scheduled elsewhere).";

  for (const side of ["home_team_id", "away_team_id"]) {
    const label = side === "home_team_id" ? "home" : "away";
    if (!form[side]) errors[side] = `Choose the ${label} team.`;
    else if (league && !isActiveTeamIn(team(form[side]), league.id)) {
      errors[side] = `${team(form[side])?.name || "That team"} is not an active team in ${league.name}.`;
    }
  }
  if (form.home_team_id && form.home_team_id === form.away_team_id) {
    errors.away_team_id = "Home and away must be different teams.";
  }
  const home = team(form.home_team_id);
  const away = team(form.away_team_id);
  if (!errors.home_team_id && !errors.away_team_id && home?.division && away?.division && home.division !== away.division) {
    errors.away_team_id = `${home.name} plays in division ${home.division} and ${away.name} in division ${away.division}. Choose teams from the same division.`;
  }

  let starts_at = null;
  if (!form.starts_at) errors.starts_at = "Choose the kickoff date and time.";
  else if (isAmbiguousLeagueTime(form.starts_at)) {
    errors.starts_at = "That time happens twice the night clocks fall back, and the league has not decided which one counts. Choose a time outside 1:00–1:59 AM that night.";
  } else {
    try {
      starts_at = fromDateTimeLocalValue(form.starts_at);
      if (!starts_at) errors.starts_at = "Choose the kickoff date and time.";
    } catch (error) {
      errors.starts_at = error.message;
    }
  }

  const venue = (state.venues || []).find((item) => item.id === form.venue_id);
  if (!form.venue_id) errors.venue_id = "Choose a venue.";
  else if (!venue || venue.status === "retired") errors.venue_id = "Choose an active venue.";

  if (Object.keys(errors).length) return { errors, payload: null };
  return {
    errors,
    payload: {
      league_id: league.id,
      sport: league.sport,
      home_team_id: form.home_team_id,
      away_team_id: form.away_team_id,
      starts_at,
      venue_id: form.venue_id,
      stage: "regular",
    },
  };
}

export const buildNewGamePayload = (state, form) => validateNewGame(state, form).payload;
