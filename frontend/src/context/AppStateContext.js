import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { initialState } from "../data/seed";
import { freeAgentName } from "../lib/utils";

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
const STORAGE_KEY = "cvf_app_state_v2";

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
  })),
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
const logEntry = (action, reason) => ({ action, timestamp: new Date().toISOString(), ...(reason ? { reason } : {}) });

// Brand avatar palette (mirrors seed.js) for newly created profiles.
const PLAYER_COLORS = ["#22d3ee", "#f97316", "#a855f7", "#10b981", "#ef4444", "#facc15", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b"];

export function AppStateProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

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
      const season = league?.season || prev.settings.current_season;
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
        e.id === id ? { ...e, admin_notes: [...(e.admin_notes || []), { text, timestamp: new Date().toISOString() }] } : e
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
    setState((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === game_id
          ? { ...g, score_status: "approved", locked: false, edit_history: [...(g.edit_history || []), logEntry("Unlocked", reason)] }
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

  const value = {
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
    assignTempAdmin,
    appendAdminNote,
    lockGame,
    unlockGame,
    setGameStatus,
    resendInvite,
    resetState,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
