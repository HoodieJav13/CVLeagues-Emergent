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
  seasons: "seasons",
  profiles: "profiles",
  leagues: "leagues",
  teams: "teams",
  teamPlayers: "team_players",
  games: "games",
  playerStats: "player_stats",
  freeAgents: "free_agents",
  registrations: "team_registrations",
  waivers: "waivers",
  charges: "charges",
  paymentEntries: "payment_entries",
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

  const [games, leagues, seasons, teams, teamPlayers, playerStats, playoffBrackets, playoffSeeds, playoffMatches, baselines, settingsRow, profiles, freeAgents, registrations, waivers, charges, paymentEntries] =
    await Promise.all([
      gamesQ,
      supabase.from("leagues").select("*").order("name"),
      supabase.from("seasons").select("*").order("starts_on", { ascending: false, nullsFirst: false }),
      supabase.from("teams").select("*").order("name"),
      supabase.from("team_players").select("*"),
      supabase.from("player_stats").select("*"),
      supabase.from("playoff_brackets").select("*"),
      supabase.from("playoff_seeds").select("*").order("seed"),
      supabase.from("playoff_matches").select("*").order("round_number").order("match_number"),
      supabase.from("career_baselines").select("*"),
      supabase.from("league_settings").select("*").eq("id", 1).single(),
      isAdmin
        ? supabase.from("profiles").select("*").order("last_name")
        : supabase.from("public_profiles").select("*").order("last_name"),
      isAdmin ? supabase.from("free_agents").select("*").order("created_at") : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("team_registrations").select("*").order("created_at") : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("waivers").select("*").order("signed_at") : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("charges").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("payment_entries").select("*").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);

  for (const [r, what] of [
    [games, "games"], [leagues, "leagues"], [seasons, "seasons"], [teams, "teams"], [teamPlayers, "team_players"],
    [playerStats, "player_stats"], [playoffBrackets, "playoff_brackets"], [playoffSeeds, "playoff_seeds"],
    [playoffMatches, "playoff_matches"], [baselines, "career_baselines"], [settingsRow, "league_settings"],
    [profiles, "profiles"],
    [charges, "charges"], [paymentEntries, "payment_entries"],
  ]) fail(r.error, `fetch ${what}`);

  // career_baselines rows -> the keyed map the selectors read.
  const careerBaselines = {};
  for (const row of baselines.data || []) {
    (careerBaselines[row.profile_id] ||= {})[row.sport] = row.stats;
  }

  return {
    seasons: seasons.data || [],
    profiles: profiles.data || [],
    leagues: leagues.data || [],
    teams: teams.data || [],
    teamPlayers: teamPlayers.data || [],
    games: (games.data || []).map((game) => ({
      ...game,
      edit_history: game.edit_history || [],
    })),
    playerStats: playerStats.data || [],
    playoffBrackets: playoffBrackets.data || [],
    playoffSeeds: playoffSeeds.data || [],
    playoffMatches: playoffMatches.data || [],
    careerBaselines,
    freeAgents: freeAgents.data || [],
    registrations: registrations.data || [],
    waivers: waivers.data || [],
    charges: charges.data || [],
    paymentEntries: paymentEntries.data || [],
    settings: {
      current_season: settingsRow.data.current_season,
      current_seasons: {
        kickball: settingsRow.data.current_kickball_season || settingsRow.data.current_season,
        flag_football: settingsRow.data.current_flag_football_season || settingsRow.data.current_season,
      },
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

async function submitPublicIntake(type, payload, turnstile_token) {
  const response = await fetch("/api/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload, turnstile_token, website: "" }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Submission could not be saved.");
}

export async function addRegistration(reg, turnstileToken) {
  await submitPublicIntake("team_registration", reg, turnstileToken);
}

// Approving is the intake->roster linkage: it must create the team via RPC.
// The league must match both the registration sport and preferred season.
// Multiple seasons can coexist, so selecting the first non-archived league is
// no longer safe.
export async function updateRegistrationStatus(id, status, state) {
  if (status === "approved") {
    const reg = state.registrations.find((r) => r.id === id);
    const league = state.leagues.find((l) =>
      l.kind !== "tournament"
      && l.sport === reg?.sport
      && l.season === reg?.preferred_season
      && l.status !== "archived"
    );
    if (!league) throw new Error("No active league matches this registration's sport and season.");
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

export async function addFreeAgent(agent, turnstileToken) {
  await submitPublicIntake("free_agent", agent, turnstileToken);
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
  const season = league?.season || state.settings.current_seasons?.[team?.sport] || state.settings.current_season;
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
  let row = entity;
  if (collection === "paymentEntries" && !entity.recorded_by) {
    const { data, error: userError } = await supabase.auth.getUser();
    fail(userError, "identify payment recorder");
    row = { ...entity, recorded_by: data.user?.id || null };
  }
  const { error } = await supabase.from(TABLES[collection]).insert(row);
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

export async function setCurrentSeason(sport, season) {
  const columns = {
    kickball: "current_kickball_season",
    flag_football: "current_flag_football_season",
  };
  const column = columns[sport];
  if (!column) throw new Error("Unsupported sport.");
  const { error } = await supabase.from("league_settings").update({ [column]: season }).eq("id", 1);
  fail(error, "set current season");
}

export async function generatePlayoffBracket({ league_id, seed_team_ids }) {
  const { error } = await supabase.rpc("generate_single_elim_bracket", {
    p_league_id: league_id,
    p_seed_team_ids: seed_team_ids,
  });
  fail(error, "generate playoff bracket");
}

export async function schedulePlayoffMatch({ match_id, date, time, location }) {
  const { error } = await supabase.rpc("schedule_playoff_match", {
    p_match_id: match_id,
    p_date: date,
    p_time: time,
    p_location: location,
  });
  fail(error, "schedule playoff match");
}

export async function linkPlayoffGame({ match_id, game_id }) {
  const { error } = await supabase.rpc("link_playoff_game", { p_match_id: match_id, p_game_id: game_id });
  fail(error, "link playoff game");
}

export async function advancePlayoffMatch(match_id) {
  const { error } = await supabase.rpc("advance_playoff_match", { p_match_id: match_id });
  fail(error, "advance playoff match");
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
export async function signInAdmin(email, password, captchaToken) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  fail(error, "sign in");
}

export async function signOutAdmin(scope = "local") {
  const { error } = await supabase.auth.signOut({ scope });
  fail(error, "sign out");
}

export async function requestAdminPasswordReset(email, captchaToken) {
  const redirectTo = `${window.location.origin}/admin/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
    captchaToken,
  });
  fail(error, "request password reset");
}

export async function updateAdminPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  fail(error, "update password");
}

export async function isAdminIdentity() {
  const { data, error } = await supabase.rpc("is_admin_identity");
  fail(error, "resolve admin identity");
  return data === true;
}

export async function getMfaState() {
  const [aal, factors] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  fail(aal.error, "read MFA level");
  fail(factors.error, "read MFA factors");
  return {
    currentLevel: aal.data.currentLevel,
    nextLevel: aal.data.nextLevel,
    verifiedFactors: [...(factors.data.totp || []), ...(factors.data.phone || [])]
      .filter((factor) => factor.status === "verified"),
  };
}

export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "CVF Admin Authenticator",
  });
  fail(error, "start MFA enrollment");
  return data;
}

export async function verifyMfaCode(factorId, code) {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  fail(challenge.error, "start MFA challenge");
  const verified = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  fail(verified.error, "verify MFA code");
}
