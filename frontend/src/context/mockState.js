import { initialState } from "../data/seed";
import { freeAgentName } from "../lib/utils";

export { initialState };

// Bumped to 10 for migration 29: games carry starts_at + venue_id instead of
// date/time/location, and venues/gameParticipation are new collections. A
// persisted v9 state cannot be repaired into the new game shape without
// inventing kickoff times, so it is discarded rather than migrated.
export const STORAGE_VERSION = 10;
export const STORAGE_KEY = `cvf_app_state_v${STORAGE_VERSION}`;
export const LEGACY_STORAGE_KEYS = Array.from(
  { length: STORAGE_VERSION - 1 },
  (_, index) => `cvf_app_state_v${index + 1}`
);

const REQUIRED_ARRAYS = [
  "seasons", "profiles", "leagues", "teams", "teamPlayers", "venues", "games",
  "gameParticipation",
  "playerStats", "freeAgents", "registrations", "waivers", "charges",
  "paymentEntries", "hofEntries", "teamIdentities", "playoffBrackets",
  "playoffSeeds", "playoffMatches",
  "scorekeepingSessions", "scorekeepingParticipants", "scorekeepingEvents",
  "scorekeepingEventAttributions",
];

const REG_STATUS_MAP = { pending: "new", rejected: "archived" };
const FA_STATUS_MAP = { available: "new", invited: "contacted" };

export const migrateMockState = (state) => ({
  ...state,
  seasons: state.seasons || initialState.seasons,
  settings: {
    ...state.settings,
    current_seasons: state.settings?.current_seasons || {
      kickball: state.settings?.current_season || initialState.settings.current_season,
      flag_football: state.settings?.current_season || initialState.settings.current_season,
    },
  },
  venues: state.venues || initialState.venues,
  gameParticipation: state.gameParticipation || initialState.gameParticipation,
  playoffBrackets: state.playoffBrackets || initialState.playoffBrackets,
  playoffSeeds: state.playoffSeeds || initialState.playoffSeeds,
  playoffMatches: state.playoffMatches || initialState.playoffMatches,
  scorekeepingSessions: state.scorekeepingSessions || initialState.scorekeepingSessions,
  scorekeepingParticipants: state.scorekeepingParticipants || initialState.scorekeepingParticipants,
  scorekeepingEvents: state.scorekeepingEvents || initialState.scorekeepingEvents,
  scorekeepingEventAttributions: state.scorekeepingEventAttributions || initialState.scorekeepingEventAttributions,
  charges: state.charges || initialState.charges,
  paymentEntries: state.paymentEntries || initialState.paymentEntries,
  hofEntries: state.hofEntries || initialState.hofEntries,
  teamIdentities: state.teamIdentities || initialState.teamIdentities,
  waivers: state.waivers || initialState.waivers,
  registrations: (state.registrations || []).map((record) => ({
    ...record,
    status: REG_STATUS_MAP[record.status] || record.status,
    admin_notes: record.admin_notes || [],
    preferred_season: record.preferred_season
      || state.settings?.current_seasons?.[record.sport]
      || state.settings?.current_season
      || initialState.settings.current_season,
  })),
  freeAgents: (state.freeAgents || []).map((agent) => ({
    ...agent,
    status: FA_STATUS_MAP[agent.status] || agent.status,
    name: freeAgentName(agent),
    admin_notes: agent.admin_notes || [],
    assigned_team_id: agent.assigned_team_id ?? null,
  })),
  profiles: (state.profiles || []).map((profile) => ({
    ...profile,
    eligibility_status: profile.eligibility_status || "not_verified",
  })),
  teamPlayers: (state.teamPlayers || []).map((assignment) => ({
    ...assignment,
    season: assignment.season || (state.settings?.current_season ?? initialState.settings.current_season),
  })),
  games: (state.games || []).map((game) => ({
    ...game,
    score_status: game.score_status || (game.status === "completed" ? "approved" : "pending"),
    locked: game.locked ?? game.score_status === "final",
    edit_history: game.edit_history || [],
    stage: game.stage || "regular",
  })),
  leagues: (state.leagues || []).map((league) => ({
    ...league,
    kind: league.kind || "league",
    playoff_format: league.playoff_format ?? null,
  })),
});

export const isValidMockState = (state) => Boolean(
  state
  && typeof state === "object"
  && !Array.isArray(state)
  && state.settings
  && typeof state.settings === "object"
  && REQUIRED_ARRAYS.every((key) => Array.isArray(state[key]))
);

const removeKeys = (storage, keys) => {
  keys.forEach((key) => storage.removeItem(key));
};

export function persistMockState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }));
}

export function loadMockState(storage = window.localStorage) {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current) {
      const envelope = JSON.parse(current);
      if (envelope?.version !== STORAGE_VERSION || !isValidMockState(envelope.state)) {
        throw new Error("Stale or malformed mock state");
      }
      removeKeys(storage, LEGACY_STORAGE_KEYS);
      return migrateMockState(envelope.state);
    }

    const previousKey = LEGACY_STORAGE_KEYS.at(-1);
    const previous = previousKey ? storage.getItem(previousKey) : null;
    if (previous) {
      const migrated = migrateMockState(JSON.parse(previous));
      if (!isValidMockState(migrated)) throw new Error("Malformed legacy mock state");
      persistMockState(storage, migrated);
      removeKeys(storage, LEGACY_STORAGE_KEYS);
      return migrated;
    }
  } catch {
    removeKeys(storage, [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  }

  removeKeys(storage, LEGACY_STORAGE_KEYS);
  return initialState;
}

export function resetMockState(storage = window.localStorage) {
  removeKeys(storage, [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  return initialState;
}
