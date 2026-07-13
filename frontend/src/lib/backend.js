import { supabase } from "./supabase";

/* ============================================================================
 * Backend adapter (Phase 9b) — the ONLY module that talks to Supabase.
 * ----------------------------------------------------------------------------
 * Shapes returned here match the mock state exactly (the Phase 9a rename
 * sweep made row fields identical to DB columns), so selectors and pages are
 * agnostic to which mode is running.
 *
 * Multi-table mutations (score save, lock/unlock, approve, assign, verify)
 * go through the SECURITY DEFINER RPCs from supabase/migrations — the client
 * never composes multi-statement writes itself.
 * ========================================================================== */

// state collection -> table (collection keys stay camelCase; they're assembled
// here, not fetched — row FIELDS are the no-translation contract).
const TABLES = {
  profiles: "profiles",
  leagues: "leagues",
  teams: "teams",
  teamPlayers: "team_players",
  games: "games",
  playerStats: "player_stats",
  freeAgents: "free_agents",
  registrations: "team_registrations",
  waivers: "waivers",
};

const fail = (error, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/* ------------------------------ initial load ----------------------------- */
// Admin sessions read the profiles TABLE (full, incl. contact fields) and the
// PII intake/waiver tables; anonymous readers get the public_profiles VIEW
// and empty intake collections (RLS would return zero rows anyway — skipping
// the requests avoids pointless round-trips).
export async function fetchAppState(isAdmin) {
  const gamesQ = isAdmin
    ? supabase
        .from("games")
        .select("*, edit_history:game_edit_history(action, reason, created_at)")
        .order("date")
        .order("created_at", { referencedTable: "game_edit_history" })
    : supabase.from("games").select("*").order("date");

  const [games, leagues, teams, teamPlayers, playerStats, baselines, settingsRow, profiles, freeAgents, registrations, waivers] =
    await Promise.all([
      gamesQ,
      supabase.from("leagues").select("*").order("name"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("team_players").select("*"),
      supabase.from("player_stats").select("*"),
      supabase.from("career_baselines").select("*"),
      supabase.from("league_settings").select("*").eq("id", 1).single(),
      isAdmin
        ? supabase.from("profiles").select("*").order("last_name")
        : supabase.from("public_profiles").select("*").order("last_name"),
      isAdmin ? supabase.from("free_agents").select("*").order("created_at") : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("team_registrations").select("*").order("created_at") : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("waivers").select("*").order("signed_at") : Promise.resolve({ data: [] }),
    ]);

  for (const [r, what] of [
    [games, "games"], [leagues, "leagues"], [teams, "teams"], [teamPlayers, "team_players"],
    [playerStats, "player_stats"], [baselines, "career_baselines"], [settingsRow, "league_settings"],
    [profiles, "profiles"],
  ]) fail(r.error, `fetch ${what}`);

  // career_baselines rows -> the keyed map the selectors read.
  const careerBaselines = {};
  for (const row of baselines.data || []) {
    (careerBaselines[row.profile_id] ||= {})[row.sport] = row.stats;
  }

  return {
    profiles: profiles.data || [],
    leagues: leagues.data || [],
    teams: teams.data || [],
    teamPlayers: teamPlayers.data || [],
    games: (games.data || []).map((game) => ({
      ...game,
      edit_history: game.edit_history || [],
    })),
    playerStats: playerStats.data || [],
    careerBaselines,
    freeAgents: freeAgents.data || [],
    registrations: registrations.data || [],
    waivers: waivers.data || [],
    settings: {
      current_season: settingsRow.data.current_season,
      registration_open: settingsRow.data.registration_open,
    },
  };
}

/* ------------------------------- mutations ------------------------------- */
// Signatures mirror the AppStateContext actions one-to-one.

export async function submitScore({ game_id, home_score, away_score, periods, statsByPlayer }) {
  const p_stats = {};
  for (const [profile_id, v] of Object.entries(statsByPlayer || {})) {
    if (v && Object.values(v.stats || {}).some((n) => Number(n) > 0)) {
      p_stats[profile_id] = { team_id: v.team_id, stats: v.stats };
    }
  }
  const { error } = await supabase.rpc("save_score", {
    p_game_id: game_id,
    p_home_score: Number(home_score),
    p_away_score: Number(away_score),
    p_periods: periods,
    p_stats,
  });
  fail(error, "save score");
}

export async function lockGame(game_id) {
  const { error } = await supabase.rpc("lock_game", { p_game_id: game_id });
  fail(error, "mark final");
}

export async function unlockGame(game_id, reason) {
  const { error } = await supabase.rpc("unlock_game", { p_game_id: game_id, p_reason: reason });
  fail(error, "unlock game");
}

export async function setGameStatus(game_id, status) {
  const { error } = await supabase.rpc("set_game_status", { p_game_id: game_id, p_status: status });
  fail(error, "set game status");
}

export async function addRegistration(reg) {
  const { error } = await supabase.from("team_registrations").insert(reg);
  fail(error, "submit team interest");
}

// Approving is the intake->roster linkage: it must create the team via RPC.
// The league is the active league for the registration's sport ("one active
// season per sport" — locked decision makes this derivable).
export async function updateRegistrationStatus(id, status, state) {
  if (status === "approved") {
    const reg = state.registrations.find((r) => r.id === id);
    const league = state.leagues.find((l) => l.sport === reg?.sport && l.status !== "archived");
    if (!league) throw new Error("No active league for this sport — create the league first.");
    const { error } = await supabase.rpc("approve_registration", {
      p_registration_id: id,
      p_league_id: league.id,
      p_create_captain_profile: true,
    });
    fail(error, "approve registration");
  } else {
    const { error } = await supabase.from("team_registrations").update({ status }).eq("id", id);
    fail(error, "update registration");
  }
}

export async function addFreeAgent(agent) {
  const { error } = await supabase.from("free_agents").insert(agent);
  fail(error, "join free agent pool");
}

export async function setFreeAgentStatus(id, status) {
  const { error } = await supabase.from("free_agents").update({ status }).eq("id", id);
  fail(error, "update free agent");
}

// The admin assign modal patches {assigned_team_id, status:'assigned'} —
// in backend mode that IS the assign_free_agent chain.
export async function assignFreeAgent(id, team_id) {
  const { data, error } = await supabase.rpc("assign_free_agent", {
    p_free_agent_id: id,
    p_team_id: team_id,
  });
  fail(error, "assign free agent");
  return data; // { profile_id, team_player_id, linked_existing_profile, roster_status }
}

// Whitelisted: profiles.name is a GENERATED column and eligibility_status is
// derived (public_profiles view) — inserting either would error.
const PROFILE_COLS = [
  "first_name", "last_name", "display_name", "email", "phone", "dob", "sports",
  "experience", "bio", "avatar_color", "emergency_contact_name", "emergency_contact_phone",
];
const PALETTE = ["#22d3ee", "#f97316", "#a855f7", "#10b981", "#ef4444", "#facc15", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b"];

export async function createPlayer(profile) {
  const row = Object.fromEntries(Object.entries(profile).filter(([k]) => PROFILE_COLS.includes(k)));
  row.avatar_color = row.avatar_color || PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const { error } = await supabase.from("profiles").insert(row);
  fail(error, "add player");
}

export async function assignPlayerToTeam({ profile_id, team_id, jersey_number = null, position = "" }, state) {
  const team = state.teams.find((t) => t.id === team_id);
  const league = state.leagues.find((l) => l.id === team?.league_id);
  const season = league?.season || state.settings.current_season;
  const { error } = await supabase.from("team_players").insert({
    profile_id,
    team_id,
    season,
    jersey_number: jersey_number === "" || jersey_number == null ? null : Number(jersey_number),
    position: position || "",
  });
  fail(error, "assign player");
}

// Soft delete (roster_status), matching the schema's no-row-deletion rule.
export async function removePlayerFromTeam(teamPlayerId) {
  const { error } = await supabase.from("team_players").update({ roster_status: "removed" }).eq("id", teamPlayerId);
  fail(error, "remove from roster");
}

export async function createEntity(collection, entity) {
  const { error } = await supabase.from(TABLES[collection]).insert(entity);
  fail(error, `create ${collection}`);
}

export async function updateEntity(collection, id, patch) {
  // Free-agent assignment patch routes through the RPC chain instead.
  if (collection === "freeAgents" && patch.assigned_team_id && patch.status === "assigned") {
    return assignFreeAgent(id, patch.assigned_team_id);
  }
  const { error } = await supabase.from(TABLES[collection]).update(patch).eq("id", id);
  fail(error, `update ${collection}`);
}

export async function deleteEntity(collection, id) {
  // RESTRICT FKs make deletes of referenced rows fail — surfaced to the UI.
  const { error } = await supabase.from(TABLES[collection]).delete().eq("id", id);
  fail(error, `delete ${collection}`);
}

export async function toggleRegistration(sport, state) {
  const next = { ...state.settings.registration_open, [sport]: !state.settings.registration_open[sport] };
  const { error } = await supabase.from("league_settings").update({ registration_open: next }).eq("id", 1);
  fail(error, "toggle registration");
}

export async function assignTempAdmin(game_id, profile_id) {
  const { error } = await supabase.from("games").update({ temp_admin_id: profile_id }).eq("id", game_id);
  fail(error, "assign temp admin");
}

export async function appendAdminNote(collection, id, text) {
  const table = TABLES[collection];
  const { data, error } = await supabase.from(table).select("admin_notes").eq("id", id).single();
  fail(error, "load notes");
  const admin_notes = [...(data.admin_notes || []), { text, created_at: new Date().toISOString() }];
  const { error: upErr } = await supabase.from(table).update({ admin_notes }).eq("id", id);
  fail(upErr, "save note");
}

export async function verifyWaiver(waiver_id, decision) {
  const { error } = await supabase.rpc("verify_waiver", { p_waiver_id: waiver_id, p_decision: decision });
  fail(error, "verify waiver");
}

/* --------------------------------- auth ---------------------------------- */
export async function signInAdmin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  fail(error, "sign in");
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  fail(error, "sign out");
}
