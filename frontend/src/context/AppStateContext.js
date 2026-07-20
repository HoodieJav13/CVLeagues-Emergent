import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BACKEND_ENABLED } from "../lib/supabase";
import * as backend from "../lib/backend";
import { useRole } from "./RoleContext";
import { buildSingleElimBracket } from "../lib/brackets";
import { enforceAggregateValidation } from "../lib/scoreValidation";

/* ============================================================================
 * AppStateContext — THE SINGLE SHARED SOURCE OF TRUTH.
 * ----------------------------------------------------------------------------
 * Every page reads from `state` and mutates via the action functions below.
 * Because records / standings / stat totals / leaderboards are DERIVED from
 * `games` + `playerStats` at render time (see lib/selectors.js), a single
 * score update propagates across the entire app automatically.
 *
 * Hosted actions delegate to the Supabase adapter; development mock actions
 * preserve the same signatures for local review without backend fixtures.
 * ========================================================================== */

const AppStateContext = createContext(null);

// Mock fixtures and persistence are a development-only module. The compile-time
// production branch prevents webpack from including seed records in deployed
// artifacts; production and preview are always backend mode.
const mockState = process.env.NODE_ENV === "production" ? null : require("./mockState");
const initialState = mockState?.initialState;
const loadState = () => mockState.loadMockState();

let idCounter = 1000;
const newId = (prefix) => `${prefix}_${Date.now()}_${idCounter++}`;

// One entry in a game's mock audit log (Stage 3 — real audit table in Phase 2).
const logEntry = (action, reason, extra = {}) => ({
  action,
  created_at: new Date().toISOString(),
  ...(reason ? { reason } : {}),
  ...extra,
});

const scoreSnapshot = (game, playerStats) => ({
  home_score: game.home_score,
  away_score: game.away_score,
  periods: game.periods,
  player_stats: Object.fromEntries(
    playerStats
      .filter((row) => row.game_id === game.id)
      .map((row) => [row.profile_id, { team_id: row.team_id, stats: row.stats }])
  ),
});

// Brand avatar palette (mirrors seed.js) for newly created profiles.
const PLAYER_COLORS = ["#22d3ee", "#f97316", "#a855f7", "#10b981", "#ef4444", "#facc15", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b"];

export function AppStateProvider({ children }) {
  // Backend mode starts null until the first Supabase fetch resolves. Mock mode
  // loads only the validated, development-only fixture store.
  const { role } = useRole();
  const isAdmin = BACKEND_ENABLED && role === "admin";
  const [state, setState] = useState(BACKEND_ENABLED ? null : loadState);

  // Live handle on state for backend actions that need current data
  // (league derivation, settings toggles) without re-creating callbacks.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => {
    if (BACKEND_ENABLED) return; // persistence is Supabase's job in backend mode
    try {
      mockState.persistMockState(window.localStorage, state);
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  // Backend mode: full refetch on mount, on auth change (admin login widens
  // reads to PII tables), and after every mutation. Data volume is Season-1
  // small; realtime subscriptions are a later optimization, not a need.
  const refresh = useCallback(async () => {
    const next = await backend.fetchAppState(isAdmin);
    setState(next);
  }, [isAdmin]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    refresh().catch((e) => {
      console.error(e);
      toast.error(`Could not load league data: ${e.message}`);
    });
  }, [refresh]);

  /* ----------------------- SCORE ENTRY (core loop) ---------------------- */
  // Updates a game to completed, stores period scores, and replaces the
  // per-player stat rows for that game. Everything downstream re-derives.
  // score_status goes to "submitted" — admin promotes to "final" (locked)
  // via the Mark Final action. Every save appends to the edit history.
  const submitScore = useCallback(({
    game_id,
    home_score,
    away_score,
    periods,
    statsByPlayer,
    correction_reason = "",
    override_reason = "",
  }) => {
    const current = stateRef.current;
    const game = current.games.find((item) => item.id === game_id);
    if (!game) throw new Error("[INV-04] The controlled score mutation target no longer exists.");

    const validation = enforceAggregateValidation({
      game,
      home_score,
      away_score,
      periods,
      statsByPlayer,
      teamPlayers: current.teamPlayers,
      teams: current.teams,
    }, override_reason);

    const correction = game.locked === true;
    if (correction && (game.status !== "completed" || game.score_status !== "final")) {
      throw new Error(`[INV-24] Game ${game.id} must be completed, final, and locked before correction.`);
    }
    if (correction && !correction_reason.trim()) {
      throw new Error("[INV-24] Correcting a final game requires a reason.");
    }
    if (!correction && correction_reason.trim()) {
      throw new Error("[INV-30] A correction reason is valid only for a final locked game.");
    }

    const source = correction
      ? current.playoffMatches.find((match) => match.game_id === game_id && match.status === "completed")
      : null;
    const newWinner = Number(home_score) > Number(away_score) ? game.home_team_id : game.away_team_id;
    if (source && source.winner_team_id !== newWinner) {
      const destinationIds = [source.winner_to_match_id, source.loser_to_match_id].filter(Boolean);
      const blocked = destinationIds.some((id) => {
        const destination = current.playoffMatches.find((match) => match.id === id);
        return destination?.game_id || destination?.status === "completed";
      });
      if (blocked) {
        throw new Error("[INV-32] Winner-changing correction is blocked because a dependent playoff game is scheduled or completed.");
      }
    }

    setState((prev) => {
      const kept = prev.playerStats.filter((s) => s.game_id !== game_id);
      const fresh = Object.entries(statsByPlayer || {})
        .filter(([, v]) => v && Object.values(v.stats || {}).some((n) => Number(n) !== 0))
        .map(([profile_id, v]) => ({
          id: newId("s"),
          game_id,
          profile_id,
          team_id: v.team_id,
          sport: game.sport,
          stats: v.stats,
        }));

      const beforeState = scoreSnapshot(game, prev.playerStats);
      const nextGame = {
        ...game,
        status: "completed",
        score_status: correction ? "final" : "submitted",
        locked: correction,
        home_score: Number(home_score),
        away_score: Number(away_score),
        periods: periods || game.periods,
      };
      const afterState = scoreSnapshot(nextGame, [...kept, ...fresh]);
      nextGame.edit_history = [
        ...(game.edit_history || []),
        logEntry(
          correction ? "Final score corrected" : game.status === "completed" ? "Score edited" : "Score saved",
          correction ? correction_reason.trim() : null,
          {
            before_state: beforeState,
            after_state: afterState,
            override_reason: override_reason.trim() || null,
            validation_warnings: validation.soft,
          }
        ),
      ];

      let playoffMatches = prev.playoffMatches;
      if (correction) {
        const newLoser = newWinner === game.home_team_id ? game.away_team_id : game.home_team_id;
        if (source && source.winner_team_id !== newWinner) {
          const winnerSeed = newWinner === source.home_team_id ? source.home_seed : source.away_seed;
          const loserSeed = newLoser === source.home_team_id ? source.home_seed : source.away_seed;
          playoffMatches = prev.playoffMatches.map((match) => {
            if (match.id === source.id) {
              return { ...match, winner_team_id: newWinner, loser_team_id: newLoser };
            }
            let updated = match;
            if (match.id === source.winner_to_match_id) {
              updated = source.winner_to_slot === "home"
                ? { ...match, home_team_id: newWinner, home_seed: winnerSeed }
                : { ...match, away_team_id: newWinner, away_seed: winnerSeed };
            }
            if (match.id === source.loser_to_match_id) {
              updated = source.loser_to_slot === "home"
                ? { ...match, home_team_id: newLoser, home_seed: loserSeed }
                : { ...match, away_team_id: newLoser, away_seed: loserSeed };
            }
            if (updated !== match) {
              return { ...updated, status: updated.home_team_id && updated.away_team_id ? "ready" : "pending" };
            }
            return match;
          });
        }
      }

      return {
        ...prev,
        games: prev.games.map((item) => item.id === game_id ? nextGame : item),
        playerStats: [...kept, ...fresh],
        playoffMatches,
      };
    });
    return validation;
  }, []);

  /* --------------------------- REGISTRATIONS ---------------------------- */
  const addRegistration = useCallback((reg) => {
    setState((prev) => ({
      ...prev,
      registrations: [
        ...prev.registrations,
        { id: newId("reg"), status: "new", created_at: new Date().toISOString().slice(0, 10), ...reg },
      ],
    }));
  }, []);

  const updateRegistrationStatus = useCallback((id, status) => {
    setState((prev) => ({
      ...prev,
      ...(() => {
        const registration = prev.registrations.find((record) => record.id === id);
        if (!registration || status !== "approved") {
          return { registrations: prev.registrations.map((record) => record.id === id ? { ...record, status } : record) };
        }

        const league = prev.leagues.find((item) =>
          item.kind !== "tournament"
          && item.sport === registration.sport
          && item.season === registration.preferred_season
          && item.status !== "archived"
        );
        if (!league) throw new Error("No active league matches this registration's sport and season.");
        if (!["new", "contacted"].includes(registration.status)) {
          throw new Error(`Registration is already ${registration.status}.`);
        }

        const identityId = newId("ti");
        const teamId = newId("t");
        const profileId = newId("p");
        const assignmentId = newId("tp");
        const nameParts = registration.captain_name.trim().split(/\s+/);
        const lastName = nameParts.length > 1 ? nameParts.pop() : "";
        const firstName = nameParts.join(" ") || registration.captain_name.trim();
        const logoColor = PLAYER_COLORS[prev.teamIdentities.length % PLAYER_COLORS.length];
        const linkedWaivers = prev.waivers.map((waiver) =>
          !waiver.profile_id && registration.captain_email && waiver.email?.toLowerCase() === registration.captain_email.toLowerCase()
            ? { ...waiver, profile_id: profileId }
            : waiver
        );
        const eligible = linkedWaivers.some((waiver) => waiver.profile_id === profileId && waiver.verification_status === "verified");

        return {
          registrations: prev.registrations.map((record) => record.id === id ? {
            ...record,
            status: "approved",
            approved_team_id: teamId,
            processed_at: new Date().toISOString(),
          } : record),
          teamIdentities: [...prev.teamIdentities, {
            id: identityId,
            name: registration.team_name,
            logo_color: logoColor,
            founded: null,
            status: "active",
          }],
          teams: [...prev.teams, {
            id: teamId,
            identity_id: identityId,
            league_id: league.id,
            name: registration.team_name,
            logo_color: logoColor,
            founded: null,
            sport: league.sport,
            captain_id: profileId,
            division: null,
            status: "active",
          }],
          profiles: [...prev.profiles, {
            id: profileId,
            first_name: firstName,
            last_name: lastName,
            display_name: null,
            name: `${firstName} ${lastName}`.trim(),
            email: registration.captain_email || null,
            phone: registration.captain_phone || null,
            sports: [registration.sport],
            avatar_color: PLAYER_COLORS[prev.profiles.length % PLAYER_COLORS.length],
            eligibility_status: eligible ? "verified" : "not_verified",
          }],
          teamPlayers: [...prev.teamPlayers, {
            id: assignmentId,
            team_id: teamId,
            profile_id: profileId,
            season: league.season,
            jersey_number: null,
            position: "",
            roster_status: eligible ? "eligible" : "pending_waiver",
          }],
          waivers: linkedWaivers,
        };
      })(),
    }));
  }, []);

  /* ---------------------------- FREE AGENTS ----------------------------- */
  const addFreeAgent = useCallback((agent) => {
    setState((prev) => ({
      ...prev,
      freeAgents: [
        ...prev.freeAgents,
        { id: newId("fa"), status: "new", created_at: new Date().toISOString().slice(0, 10), ...agent },
      ],
    }));
  }, []);

  const setFreeAgentStatus = useCallback((id, status) => {
    setState((prev) => ({
      ...prev,
      freeAgents: prev.freeAgents.map((f) => (f.id === id ? { ...f, status } : f)),
    }));
  }, []);

  /* ----------------- ROSTER BUILDING (Flow C-lite) --------------------- */
  // Development roster building per CLAUDE.md. Creating a player and
  // assigning them to a team are SEPARATE, additive actions. Assignment NEVER
  // sets eligibility — the two are independent. We do NOT build intake
  // conversion here (approve→team / assign→profile); that relational linkage
  // is built once in the backend phase against real tables.

  // Create a bare profile record. New players start unassigned with eligibility
  // not yet verified. Hosted mode inserts public.profiles through the adapter.
  const createPlayer = useCallback((profile) => {
    setState((prev) => {
      const first = (profile.first_name || "").trim();
      const last = (profile.last_name || "").trim();
      const display = (profile.display_name || "").trim();
      const name = display || `${first} ${last}`.trim();
      return {
        ...prev,
        profiles: [
          ...prev.profiles,
          {
            id: newId("p"),
            sports: [],
            eligibility_status: "not_verified",
            ...profile,
            first_name: first,
            last_name: last,
            display_name: display || null,
            name,
            avatar_color: PLAYER_COLORS[prev.profiles.length % PLAYER_COLORS.length],
          },
        ],
      };
    });
  }, []);

  // Put a player on a team. The season is AUTO-STAMPED from the team's active
  // league season. Same team_players relationship is read/written by both the
  // player modal and the team roster view — one source of truth.
  // Hosted mode creates a real team_players row with roster_status.
  const assignPlayerToTeam = useCallback(({ profile_id, team_id, jersey_number = null, position = "" }) => {
    setState((prev) => {
      if (!profile_id || !team_id) return prev;
      if (prev.teamPlayers.some((tp) => tp.profile_id === profile_id && tp.team_id === team_id)) return prev; // no dupes
      const team = prev.teams.find((t) => t.id === team_id);
      const league = prev.leagues.find((l) => l.id === team?.league_id);
      const season = league?.season || prev.settings.current_seasons?.[team?.sport] || prev.settings.current_season;
      return {
        ...prev,
        teamPlayers: [
          ...prev.teamPlayers,
          { id: newId("tp"), team_id, profile_id, jersey_number: jersey_number === "" || jersey_number == null ? null : Number(jersey_number), position: position || "", season },
        ],
      };
    });
  }, []);

  // Mock mode removes the rendered assignment; hosted mode preserves history by
  // setting roster_status to removed. Both produce the same visible outcome.
  const removePlayerFromTeam = useCallback((teamPlayerId) => {
    setState((prev) => ({ ...prev, teamPlayers: prev.teamPlayers.filter((tp) => tp.id !== teamPlayerId) }));
  }, []);

  /* ----------- TEAM IDENTITIES & EXPLICIT CONTAINER ENROLLMENT ---------- */
  const createTeamIdentityAndEnroll = useCallback(({ name, logo_color, founded, league_id, captain_id = null, division = null }) => {
    let result;
    setState((prev) => {
      const league = prev.leagues.find((item) => item.id === league_id);
      if (!league) throw new Error("Select a league or tournament.");
      const identity_id = newId("ti");
      const team_id = newId("t");
      const identity = { id: identity_id, name: name.trim(), logo_color, founded: founded || null, status: "active" };
      const team = {
        id: team_id, identity_id, league_id, name: identity.name, logo_color: identity.logo_color,
        founded: identity.founded, sport: league.sport, captain_id: captain_id || null,
        division: division || null, status: "active",
      };
      result = { identity_id, team_id };
      return { ...prev, teamIdentities: [...prev.teamIdentities, identity], teams: [...prev.teams, team] };
    });
    return result;
  }, []);

  const enrollTeamIdentity = useCallback(({ identity_id, league_id, captain_id = null, division = null }) => {
    let team_id;
    setState((prev) => {
      const identity = prev.teamIdentities.find((item) => item.id === identity_id);
      const league = prev.leagues.find((item) => item.id === league_id);
      if (!identity || identity.status !== "active") throw new Error("Only an active team identity can be enrolled.");
      if (!league) throw new Error("Select a league or tournament.");
      if (prev.teams.some((item) => item.identity_id === identity_id && item.league_id === league_id)) {
        throw new Error("This team is already enrolled in that league or tournament.");
      }
      team_id = newId("t");
      const team = {
        id: team_id, identity_id, league_id, name: identity.name, logo_color: identity.logo_color,
        founded: identity.founded, sport: league.sport, captain_id: captain_id || null,
        division: division || null, status: "active",
      };
      return { ...prev, teams: [...prev.teams, team] };
    });
    return team_id;
  }, []);

  const updateTeamIdentity = useCallback((id, patch) => {
    setState((prev) => {
      const nextIdentity = prev.teamIdentities.find((item) => item.id === id);
      if (!nextIdentity) return prev;
      const canonical = { ...nextIdentity, ...patch };
      return {
        ...prev,
        teamIdentities: prev.teamIdentities.map((item) => item.id === id ? canonical : item),
        teams: prev.teams.map((team) => team.identity_id === id
          ? { ...team, name: canonical.name, logo_color: canonical.logo_color, founded: canonical.founded }
          : team),
      };
    });
  }, []);

  /* ------------------------- ADMIN: GENERIC CRUD ------------------------ */
  const createEntity = useCallback((collection, entity, prefix) => {
    setState((prev) => ({
      ...prev,
      [collection]: [...prev[collection], { id: newId(prefix), ...entity }],
    }));
  }, []);

  const updateEntity = useCallback((collection, id, patch) => {
    setState((prev) => {
      if (collection === "freeAgents" && patch.assigned_team_id && patch.status === "assigned") {
        const agent = prev.freeAgents.find((item) => item.id === id);
        const team = prev.teams.find((item) => item.id === patch.assigned_team_id);
        const league = prev.leagues.find((item) => item.id === team?.league_id);
        if (!agent || !team || !league) throw new Error("Free agent assignment is missing its player, team, or league.");
        if (["assigned", "archived"].includes(agent.status)) throw new Error(`Free agent is already ${agent.status}.`);

        const emailMatches = agent.email
          ? prev.profiles.filter((profile) => profile.email?.toLowerCase() === agent.email.toLowerCase())
          : [];
        const existing = emailMatches.length === 1 ? emailMatches[0] : null;
        const profileId = agent.profile_id || existing?.id || newId("p");
        if (prev.teamPlayers.some((assignment) => assignment.team_id === team.id && assignment.profile_id === profileId && assignment.season === league.season)) {
          throw new Error(`Player is already on this roster for ${league.season}.`);
        }
        const waivers = prev.waivers.map((waiver) =>
          !waiver.profile_id && agent.email && waiver.email?.toLowerCase() === agent.email.toLowerCase()
            ? { ...waiver, profile_id: profileId }
            : waiver
        );
        const eligible = waivers.some((waiver) => waiver.profile_id === profileId && waiver.verification_status === "verified");
        const profiles = existing || agent.profile_id
          ? prev.profiles
          : [...prev.profiles, {
              id: profileId,
              first_name: agent.first_name || agent.name?.split(" ")[0] || "Player",
              last_name: agent.last_name || agent.name?.split(" ").slice(1).join(" ") || "",
              display_name: agent.display_name || null,
              name: agent.display_name || agent.name,
              email: agent.email || null,
              phone: agent.phone || null,
              sports: agent.sports || [],
              experience: agent.experience || null,
              avatar_color: PLAYER_COLORS[prev.profiles.length % PLAYER_COLORS.length],
              eligibility_status: eligible ? "verified" : "not_verified",
            }];
        return {
          ...prev,
          profiles,
          waivers,
          teamPlayers: [...prev.teamPlayers, {
            id: newId("tp"),
            team_id: team.id,
            profile_id: profileId,
            season: league.season,
            jersey_number: null,
            position: "",
            roster_status: eligible ? "eligible" : "pending_waiver",
          }],
          freeAgents: prev.freeAgents.map((item) => item.id === id ? {
            ...item,
            ...patch,
            profile_id: profileId,
          } : item),
        };
      }

      return {
        ...prev,
        [collection]: prev[collection].map((entity) => entity.id === id ? { ...entity, ...patch } : entity),
      };
    });
  }, []);

  const deleteEntity = useCallback((collection, id) => {
    setState((prev) => ({
      ...prev,
      [collection]: prev[collection].filter((e) => e.id !== id),
    }));
  }, []);

  /* ------------------------- ADMIN: SETTINGS ---------------------------- */
  const toggleRegistration = useCallback((sport) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        registration_open: { ...prev.settings.registration_open, [sport]: !prev.settings.registration_open[sport] },
      },
    }));
  }, []);

  const setCurrentSeason = useCallback((sport, season) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        current_seasons: { ...prev.settings.current_seasons, [sport]: season },
      },
    }));
  }, []);

  const setHofPublished = useCallback((published) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, hof_published: published } }));
  }, []);

  const verifyWaiver = useCallback((waiverId, decision) => {
    setState((prev) => {
      const waiver = prev.waivers.find((item) => item.id === waiverId);
      if (!waiver) throw new Error("Waiver not found.");
      return {
        ...prev,
        waivers: prev.waivers.map((item) => item.id === waiverId ? {
          ...item,
          verification_status: decision,
          verified_by: "demo-admin",
          verified_at: new Date().toISOString(),
        } : item),
        teamPlayers: decision === "verified" && waiver.profile_id
          ? prev.teamPlayers.map((assignment) => assignment.profile_id === waiver.profile_id && assignment.roster_status === "pending_waiver"
              ? { ...assignment, roster_status: "eligible" }
              : assignment)
          : prev.teamPlayers,
      };
    });
  }, []);

  const generatePlayoffBracket = useCallback(({ league_id, seed_team_ids }) => {
    setState((prev) => {
      const generated = buildSingleElimBracket({ league_id, teamIds: seed_team_ids, idFactory: newId });
      return {
        ...prev,
        playoffBrackets: [...prev.playoffBrackets.filter((item) => item.league_id !== league_id), generated.bracket],
        playoffSeeds: [...prev.playoffSeeds.filter((item) => !prev.playoffBrackets.some((b) => b.league_id === league_id && b.id === item.bracket_id)), ...generated.seeds],
        playoffMatches: [...prev.playoffMatches.filter((item) => !prev.playoffBrackets.some((b) => b.league_id === league_id && b.id === item.bracket_id)), ...generated.matches],
      };
    });
  }, []);

  const schedulePlayoffMatch = useCallback(({ match_id, date, time, location }) => {
    setState((prev) => {
      const match = prev.playoffMatches.find((item) => item.id === match_id);
      const bracket = prev.playoffBrackets.find((item) => item.id === match?.bracket_id);
      const league = prev.leagues.find((item) => item.id === bracket?.league_id);
      if (!match?.home_team_id || !match?.away_team_id || !league) return prev;
      const game_id = newId("game");
      const game = {
        id: game_id, league_id: league.id, sport: league.sport,
        home_team_id: match.home_team_id, away_team_id: match.away_team_id,
        date, time, location, status: "upcoming", score_status: "pending", stage: "playoff",
        home_score: null, away_score: null, periods: { home: [], away: [] }, locked: false, edit_history: [],
      };
      return {
        ...prev,
        games: [...prev.games, game],
        playoffMatches: prev.playoffMatches.map((item) => item.id === match_id ? { ...item, game_id } : item),
      };
    });
  }, []);

  const linkPlayoffGame = useCallback(({ match_id, game_id }) => {
    setState((prev) => ({
      ...prev,
      playoffMatches: prev.playoffMatches.map((item) => item.id === match_id ? { ...item, game_id } : item),
    }));
  }, []);

  const advancePlayoffMatch = useCallback((match_id) => {
    setState((prev) => {
      const source = prev.playoffMatches.find((item) => item.id === match_id);
      const game = prev.games.find((item) => item.id === source?.game_id);
      if (!source || !game || !game.locked || game.score_status !== "final" || game.status !== "completed" || game.home_score === game.away_score) return prev;
      const homeWins = game.home_score > game.away_score;
      const winner = homeWins ? game.home_team_id : game.away_team_id;
      const loser = homeWins ? game.away_team_id : game.home_team_id;
      const winnerSeed = winner === source.home_team_id ? source.home_seed : source.away_seed;
      const loserSeed = loser === source.home_team_id ? source.home_seed : source.away_seed;
      const matches = prev.playoffMatches.map((item) => ({ ...item }));
      const place = (destinationId, slot, team, seed) => {
        if (!destinationId) return;
        const destination = matches.find((item) => item.id === destinationId);
        destination[`${slot}_team_id`] = team;
        destination[`${slot}_seed`] = seed;
        if (destination.home_team_id && destination.away_team_id) destination.status = "ready";
      };
      place(source.winner_to_match_id, source.winner_to_slot, winner, winnerSeed);
      place(source.loser_to_match_id, source.loser_to_slot, loser, loserSeed);
      const updated = matches.find((item) => item.id === match_id);
      Object.assign(updated, { status: "completed", winner_team_id: winner, loser_team_id: loser });
      const bracketDone = matches.filter((item) => item.bracket_id === source.bracket_id).every((item) => ["completed", "bye"].includes(item.status));
      return {
        ...prev,
        playoffMatches: matches,
        playoffBrackets: prev.playoffBrackets.map((item) => item.id === source.bracket_id && bracketDone ? { ...item, status: "complete" } : item),
      };
    });
  }, []);

  const assignTempAdmin = useCallback((game_id, profile_id) => {
    setState((prev) => ({
      ...prev,
      games: prev.games.map((g) => (g.id === game_id ? { ...g, temp_admin_id: profile_id } : g)),
    }));
  }, []);

  /* ------------- ADMIN: TRIAGE NOTES & GAME LOCK (Stage 3) -------------- */
  // Append a timestamped admin note to a registration or free agent record.
  const appendAdminNote = useCallback((collection, id, text) => {
    setState((prev) => ({
      ...prev,
      [collection]: prev[collection].map((e) =>
        e.id === id ? { ...e, admin_notes: [...(e.admin_notes || []), { text, created_at: new Date().toISOString() }] } : e
      ),
    }));
  }, []);

  // Mark Final: score becomes final AND the game locks against edits.
  const lockGame = useCallback((game_id) => {
    setState((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === game_id
          ? { ...g, score_status: "final", locked: true, edit_history: [...(g.edit_history || []), logEntry("Marked final")] }
          : g
      ),
    }));
  }, []);

  // Postpone / cancel a scheduled game (the UI blocks this on locked games).
  const setGameStatus = useCallback((game_id, status) => {
    setState((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === game_id
          ? { ...g, status, edit_history: [...(g.edit_history || []), logEntry(`Game ${status}`)] }
          : g
      ),
    }));
  }, []);

  // Restore the original seed data (clears any demo edits).
  const resetState = useCallback(() => {
    setState(mockState.resetMockState());
  }, []);

  /* ---------------- BACKEND MODE: same signatures, real writes ----------- */
  // Every action delegates to the adapter (RPCs for multi-table mutations),
  // then refetches. Errors surface centrally and are rethrown so UI callers
  // withhold success feedback and keep their dialogs open when a write fails.
  const act = useCallback(
    (fn) =>
      async (...args) => {
        try {
          const result = await fn(...args);
          await refresh();
          return result;
        } catch (e) {
          console.error(e);
          toast.error(e.message);
          throw e;
        }
      },
    [refresh]
  );

  const backendActions = {
    submitScore: act(backend.submitScore),
    addRegistration: act(backend.addRegistration),
    updateRegistrationStatus: act((id, status) => backend.updateRegistrationStatus(id, status, stateRef.current)),
    addFreeAgent: act(backend.addFreeAgent),
    setFreeAgentStatus: act(backend.setFreeAgentStatus),
    createPlayer: act(backend.createPlayer),
    assignPlayerToTeam: act((args) => backend.assignPlayerToTeam(args, stateRef.current)),
    removePlayerFromTeam: act(backend.removePlayerFromTeam),
    createTeamIdentityAndEnroll: act(backend.createTeamIdentityAndEnroll),
    enrollTeamIdentity: act(backend.enrollTeamIdentity),
    updateTeamIdentity: act(backend.updateTeamIdentity),
    createEntity: act((collection, entity) => backend.createEntity(collection, entity)),
    updateEntity: act(backend.updateEntity),
    deleteEntity: act(backend.deleteEntity),
    toggleRegistration: act((sport) => backend.toggleRegistration(sport, stateRef.current)),
    setCurrentSeason: act(backend.setCurrentSeason),
    setHofPublished: act(backend.setHofPublished),
    verifyWaiver: act(backend.verifyWaiver),
    generatePlayoffBracket: act(backend.generatePlayoffBracket),
    schedulePlayoffMatch: act(backend.schedulePlayoffMatch),
    linkPlayoffGame: act(backend.linkPlayoffGame),
    advancePlayoffMatch: act(backend.advancePlayoffMatch),
    assignTempAdmin: act(backend.assignTempAdmin),
    appendAdminNote: act(backend.appendAdminNote),
    lockGame: act(backend.lockGame),
    setGameStatus: act(backend.setGameStatus),
    resetState: () => toast.info("Demo reset is mock-mode only."),
  };

  const value = BACKEND_ENABLED
    ? { state, ...backendActions }
    : {
        state,
        submitScore,
        addRegistration,
        updateRegistrationStatus,
        addFreeAgent,
        setFreeAgentStatus,
        createPlayer,
        assignPlayerToTeam,
        removePlayerFromTeam,
        createTeamIdentityAndEnroll,
        enrollTeamIdentity,
        updateTeamIdentity,
        createEntity,
        updateEntity,
        deleteEntity,
        toggleRegistration,
        setCurrentSeason,
        setHofPublished,
        verifyWaiver,
        generatePlayoffBracket,
        schedulePlayoffMatch,
        linkPlayoffGame,
        advancePlayoffMatch,
        assignTempAdmin,
        appendAdminNote,
        lockGame,
        setGameStatus,
        resetState,
      };

  // Backend mode renders nothing until the first fetch lands (sub-second on
  // Season-1 data) — a blank-but-branded gate beats flashing empty pages.
  if (BACKEND_ENABLED && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading league data…
      </div>
    );
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
