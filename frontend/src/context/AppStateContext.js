import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { initialState } from "../data/seed";
import { freeAgentName } from "../lib/utils";
import { BACKEND_ENABLED } from "../lib/supabase";
import * as backend from "../lib/backend";
import { useRole } from "./RoleContext";
import { buildSingleElimBracket } from "../lib/brackets";

/* ============================================================================
 * AppStateContext — THE SINGLE SHARED SOURCE OF TRUTH.
 * ----------------------------------------------------------------------------
 * Every page reads from `state` and mutates via the action functions below.
 * Because records / standings / stat totals / leaderboards are DERIVED from
 * `games` + `playerStats` at render time (see lib/selectors.js), a single
 * score update propagates across the entire app automatically.
 *
 * PHASE 2: replace these local-state actions with Supabase mutations
 * (insert/update/delete) + realtime subscriptions. The function signatures can
 * stay the same so pages don't need rewriting.
 * ========================================================================== */

const AppStateContext = createContext(null);

// Lightweight localStorage persistence so the demo survives page refreshes.
// PHASE 2: this entire layer is replaced by Supabase queries + realtime.
// v2: Phase 9a snake_case field rename — pre-rename (v1) persisted state is
// deliberately abandoned rather than field-migrated; the demo reseeds.
// v3: playoff/tournament seed pass — new playoff GAMES (g10 reshaped, g13/g14
// added) can't reach a persisted state via field backfill, so the demo
// reseeds again (same precedent as v1→v2).
// v4: bracket records were added; v5 adds the demo-only manual payments ledger;
// v6 adds the admin Hall of Fame draft.
const STORAGE_KEY = "cvf_app_state_v6";

// Status-vocabulary migration (CLAUDE.md data model). Persisted demo state may
// predate the rename, so legacy values are remapped on load:
//   registrations: pending→new, rejected→archived
//   free agents:   available→new, invited→contacted; `name` backfilled from
//                  the first_name/last_name/display_name shape the intake form
//                  writes, so both legacy and new-shape records still display.
//   games:         score_status added alongside status (upcoming→pending,
//                  completed→approved). "final" now strictly means LOCKED via
//                  Mark Final, so legacy "final" records get locked: true.
//                  locked / edit_history / admin_notes backfilled when missing.
const REG_STATUS_MAP = { pending: "new", rejected: "archived" };
const FA_STATUS_MAP = { available: "new", invited: "contacted" };
const migrateState = (s) => ({
  ...s,
  seasons: s.seasons || initialState.seasons,
  settings: {
    ...s.settings,
    current_seasons: s.settings?.current_seasons || {
      kickball: s.settings?.current_season || initialState.settings.current_season,
      flag_football: s.settings?.current_season || initialState.settings.current_season,
    },
  },
  playoffBrackets: s.playoffBrackets || initialState.playoffBrackets,
  playoffSeeds: s.playoffSeeds || initialState.playoffSeeds,
  playoffMatches: s.playoffMatches || initialState.playoffMatches,
  charges: s.charges || initialState.charges,
  paymentEntries: s.paymentEntries || initialState.paymentEntries,
  hofEntries: s.hofEntries || initialState.hofEntries,
  // Mock waiver records (Stage 4) — backfill for states persisted before they existed.
  waivers: s.waivers || initialState.waivers,
  registrations: (s.registrations || []).map((r) => ({ ...r, status: REG_STATUS_MAP[r.status] || r.status, admin_notes: r.admin_notes || [] })),
  freeAgents: (s.freeAgents || []).map((f) => ({ ...f, status: FA_STATUS_MAP[f.status] || f.status, name: freeAgentName(f), admin_notes: f.admin_notes || [], assigned_team_id: f.assigned_team_id ?? null })),
  // Flow C-lite: profiles carry an informational eligibility flag; roster
  // assignments carry an auto-stamped season. Backfilled for older states.
  profiles: (s.profiles || []).map((p) => ({ ...p, eligibility_status: p.eligibility_status || "not_verified" })),
  teamPlayers: (s.teamPlayers || []).map((tp) => ({ ...tp, season: tp.season || (s.settings?.current_season ?? initialState.settings.current_season) })),
  games: (s.games || []).map((g) => ({
    ...g,
    score_status: g.score_status || (g.status === "completed" ? "approved" : "pending"),
    locked: g.locked ?? g.score_status === "final",
    edit_history: g.edit_history || [],
    stage: g.stage || "regular", // migration 9 shape; pre-playoff states backfill as regular season
  })),
  leagues: (s.leagues || []).map((l) => ({ ...l, kind: l.kind || "league", playoff_format: l.playoff_format ?? null })),
});

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return migrateState(raw ? JSON.parse(raw) : initialState);
  } catch {
    return initialState;
  }
};

let idCounter = 1000;
const newId = (prefix) => `${prefix}_${Date.now()}_${idCounter++}`;

// One entry in a game's mock audit log (Stage 3 — real audit table in Phase 2).
const logEntry = (action, reason) => ({ action, created_at: new Date().toISOString(), ...(reason ? { reason } : {}) });

// Brand avatar palette (mirrors seed.js) for newly created profiles.
const PLAYER_COLORS = ["#22d3ee", "#f97316", "#a855f7", "#10b981", "#ef4444", "#facc15", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b"];

export function AppStateProvider({ children }) {
  // Backend mode (Phase 9b): state comes from Supabase and starts null until
  // the first fetch resolves. Mock mode: seed + localStorage, unchanged.
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const submitScore = useCallback(({ game_id, home_score, away_score, periods, statsByPlayer }) => {
    setState((prev) => {
      const games = prev.games.map((g) =>
        g.id === game_id
          ? {
              ...g,
              status: "completed",
              score_status: "submitted",
              home_score: Number(home_score),
              away_score: Number(away_score),
              periods: periods || g.periods,
              edit_history: [...(g.edit_history || []), logEntry(g.status === "completed" ? "Score edited" : "Score saved")],
            }
          : g
      );
      // Drop any existing stat rows for this game, then add the new ones.
      const game = prev.games.find((g) => g.id === game_id);
      const kept = prev.playerStats.filter((s) => s.game_id !== game_id);
      const fresh = Object.entries(statsByPlayer || {})
        .filter(([, v]) => v && Object.values(v.stats || {}).some((n) => Number(n) > 0))
        .map(([profile_id, v]) => ({
          id: newId("s"),
          game_id,
          profile_id,
          team_id: v.team_id,
          sport: game.sport,
          stats: v.stats,
        }));
      return { ...prev, games, playerStats: [...kept, ...fresh] };
    });
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
      registrations: prev.registrations.map((r) => (r.id === id ? { ...r, status } : r)),
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
  // Minimal mock roster building per CLAUDE.md. Creating a player and
  // assigning them to a team are SEPARATE, additive actions. Assignment NEVER
  // sets eligibility — the two are independent. We do NOT build intake
  // conversion here (approve→team / assign→profile); that relational linkage
  // is built once in the backend phase against real tables.

  // Create a bare profile record. New players start unassigned with eligibility
  // not yet verified. PHASE 2: insert into public.profiles (auth_user_id nullable).
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
  // PHASE 2: this becomes a real team_players row; roster_status
  // (pending_waiver/eligible/inactive/removed) and the intake→roster
  // conversion are introduced there, NOT here.
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

  // Remove a single roster assignment (by team_players row id). In mock state a
  // removed player simply loses the row. PHASE 2: soft-delete via roster_status.
  const removePlayerFromTeam = useCallback((teamPlayerId) => {
    setState((prev) => ({ ...prev, teamPlayers: prev.teamPlayers.filter((tp) => tp.id !== teamPlayerId) }));
  }, []);

  /* ------------------------- ADMIN: GENERIC CRUD ------------------------ */
  const createEntity = useCallback((collection, entity, prefix) => {
    setState((prev) => ({
      ...prev,
      [collection]: [...prev[collection], { id: newId(prefix), ...entity }],
    }));
  }, []);

  const updateEntity = useCallback((collection, id, patch) => {
    setState((prev) => ({
      ...prev,
      [collection]: prev[collection].map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
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

  // Deliberate unlock — requires a reason, which is recorded in the history.
  const unlockGame = useCallback((game_id, reason) => {
    setState((prev) => {
      const source = prev.playoffMatches.find((match) => match.game_id === game_id && match.status === "completed");
      const destinationIds = [source?.winner_to_match_id, source?.loser_to_match_id].filter(Boolean);
      if (destinationIds.some((id) => {
        const destination = prev.playoffMatches.find((match) => match.id === id);
        return destination?.game_id || destination?.status === "completed";
      })) {
        toast.error("This result cannot be unlocked after a downstream playoff game is scheduled.");
        return prev;
      }

      const playoffMatches = source
        ? prev.playoffMatches.map((match) => {
            if (match.id === source.id) {
              return { ...match, status: "ready", winner_team_id: null, loser_team_id: null };
            }
            if (match.id === source.winner_to_match_id) {
              return source.winner_to_slot === "home"
                ? { ...match, home_team_id: null, home_seed: null, status: "pending" }
                : { ...match, away_team_id: null, away_seed: null, status: "pending" };
            }
            if (match.id === source.loser_to_match_id) {
              return source.loser_to_slot === "home"
                ? { ...match, home_team_id: null, home_seed: null, status: "pending" }
                : { ...match, away_team_id: null, away_seed: null, status: "pending" };
            }
            return match;
          })
        : prev.playoffMatches;

      return {
        ...prev,
        playoffMatches,
        playoffBrackets: source
          ? prev.playoffBrackets.map((bracket) => bracket.id === source.bracket_id ? { ...bracket, status: "active" } : bracket)
          : prev.playoffBrackets,
        games: prev.games.map((g) =>
        g.id === game_id
          ? { ...g, score_status: "approved", locked: false, edit_history: [...(g.edit_history || []), logEntry("Unlocked", reason)] }
          : g
        ),
      };
    });
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

  // Resend mock invite — flips a profile's claimed flag display intent only.
  // PHASE 2: trigger a real invite email via backend (e.g. Resend/Supabase).
  const resendInvite = useCallback((profile_id) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === profile_id ? { ...p, inviteResentAt: new Date().toISOString() } : p
      ),
    }));
  }, []);

  // Restore the original seed data (clears any demo edits).
  const resetState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  /* ---------------- BACKEND MODE: same signatures, real writes ----------- */
  // Every action delegates to the adapter (RPCs for multi-table mutations),
  // then refetches. Errors surface as toasts here because most call sites
  // fire-and-forget (mock heritage); tightening them to await is follow-up
  // polish, not a correctness need.
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
    createEntity: act((collection, entity) => backend.createEntity(collection, entity)),
    updateEntity: act(backend.updateEntity),
    deleteEntity: act(backend.deleteEntity),
    toggleRegistration: act((sport) => backend.toggleRegistration(sport, stateRef.current)),
    setCurrentSeason: act(backend.setCurrentSeason),
    setHofPublished: act(backend.setHofPublished),
    generatePlayoffBracket: act(backend.generatePlayoffBracket),
    schedulePlayoffMatch: act(backend.schedulePlayoffMatch),
    linkPlayoffGame: act(backend.linkPlayoffGame),
    advancePlayoffMatch: act(backend.advancePlayoffMatch),
    assignTempAdmin: act(backend.assignTempAdmin),
    appendAdminNote: act(backend.appendAdminNote),
    lockGame: act(backend.lockGame),
    unlockGame: act(backend.unlockGame),
    setGameStatus: act(backend.setGameStatus),
    resendInvite: () => {}, // real invite email is a Phase-2 feature (Resend)
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
        createEntity,
        updateEntity,
        deleteEntity,
        toggleRegistration,
        setCurrentSeason,
        setHofPublished,
        generatePlayoffBracket,
        schedulePlayoffMatch,
        linkPlayoffGame,
        advancePlayoffMatch,
        assignTempAdmin,
        appendAdminNote,
        lockGame,
        unlockGame,
        setGameStatus,
        resendInvite,
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
