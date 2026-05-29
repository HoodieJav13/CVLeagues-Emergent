import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { initialState } from "../data/seed";

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
const STORAGE_KEY = "cvf_app_state_v1";
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialState;
  } catch {
    return initialState;
  }
};

let idCounter = 1000;
const newId = (prefix) => `${prefix}_${Date.now()}_${idCounter++}`;

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
  const submitScore = useCallback(({ gameId, homeScore, awayScore, periods, statsByPlayer }) => {
    setState((prev) => {
      const games = prev.games.map((g) =>
        g.id === gameId
          ? { ...g, status: "completed", homeScore: Number(homeScore), awayScore: Number(awayScore), periods: periods || g.periods }
          : g
      );
      // Drop any existing stat rows for this game, then add the new ones.
      const game = prev.games.find((g) => g.id === gameId);
      const kept = prev.playerStats.filter((s) => s.gameId !== gameId);
      const fresh = Object.entries(statsByPlayer || {})
        .filter(([, v]) => v && Object.values(v.stats || {}).some((n) => Number(n) > 0))
        .map(([playerId, v]) => ({
          id: newId("s"),
          gameId,
          playerId,
          teamId: v.teamId,
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
        { id: newId("reg"), status: "pending", submittedDate: new Date().toISOString().slice(0, 10), ...reg },
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
        { id: newId("fa"), status: "available", createdDate: new Date().toISOString().slice(0, 10), ...agent },
      ],
    }));
  }, []);

  const setFreeAgentStatus = useCallback((id, status) => {
    setState((prev) => ({
      ...prev,
      freeAgents: prev.freeAgents.map((f) => (f.id === id ? { ...f, status } : f)),
    }));
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
        registrationOpen: { ...prev.settings.registrationOpen, [sport]: !prev.settings.registrationOpen[sport] },
      },
    }));
  }, []);

  const assignTempAdmin = useCallback((gameId, profileId) => {
    setState((prev) => ({
      ...prev,
      games: prev.games.map((g) => (g.id === gameId ? { ...g, tempAdminId: profileId } : g)),
    }));
  }, []);

  // Resend mock invite — flips a profile's claimed flag display intent only.
  // PHASE 2: trigger a real invite email via backend (e.g. Resend/Supabase).
  const resendInvite = useCallback((profileId) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === profileId ? { ...p, inviteResentAt: new Date().toISOString() } : p
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
    createEntity,
    updateEntity,
    deleteEntity,
    toggleRegistration,
    assignTempAdmin,
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
