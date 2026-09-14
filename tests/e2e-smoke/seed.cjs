// Loads frontend/src/data/seed.js (an ES module) into Node and reshapes it as
// the PostgREST rows backend.js expects, so the PRODUCTION bundle can be
// exercised end to end without a hosted Supabase project. The bundle never
// enters mock mode (that is development-only by design, see
// frontend/src/lib/supabase.js); the stub lives at the network boundary in
// the Playwright test instead, which is exactly where a hosted project would
// answer.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const FRONTEND = path.resolve(__dirname, "../../frontend");
const babel = require(path.join(FRONTEND, "node_modules/@babel/core"));
const cjsPlugin = require.resolve("@babel/plugin-transform-modules-commonjs", { paths: [FRONTEND] });

function loadEsm(file) {
  const src = fs.readFileSync(file, "utf8");
  const { code } = babel.transformSync(src, { filename: file, babelrc: false, configFile: false, plugins: [cjsPlugin] });
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = (id) => (id.startsWith(".") ? loadEsm(path.resolve(path.dirname(file), id.endsWith(".js") ? id : `${id}.js`)) : require(id));
  mod._compile(code, file);
  return mod.exports;
}

const seed = loadEsm(path.join(FRONTEND, "src/data/seed.js"));

const careerBaselineRows = Object.entries(seed.careerBaselines || {}).flatMap(([profile_id, bySport]) =>
  Object.entries(bySport).map(([sport, stats]) => ({ profile_id, sport, stats })),
);

// Tables an anonymous session must never request. Hosted RLS would return
// zero rows for most of them anyway; the smoke asserts the frontend does not
// even ask (backend.js gates these reads on isAdmin).
const ADMIN_ONLY_TABLES = [
  "profiles", "free_agents", "team_registrations", "waivers", "charges", "payment_entries", "hof_entries",
  "scorekeeping_sessions", "scorekeeping_participants", "scorekeeping_events", "scorekeeping_event_attributions",
];

// Every seeded email / phone string. If any of these reaches
// document.body.innerText for an unauthenticated visitor, PII leaked.
const SEEDED_PII = [
  ...seed.profiles.flatMap((p) => [p.email, p.phone]),
  ...(seed.freeAgents || []).flatMap((f) => [f.email, f.phone]),
  ...(seed.registrations || []).flatMap((r) => [r.captain_email, r.captain_phone]),
].filter((v) => typeof v === "string" && v.trim().length > 0);

// PostgREST table name -> rows. `public_profiles` is DELIBERATELY served with
// the full profile rows (email/phone included) even though the hosted view
// strips them: the stub is stricter than production so the UI's own restraint
// is what the PII assertion tests, not the view definition.
const TABLES = {
  games: seed.games,
  leagues: seed.leagues,
  seasons: seed.seasons,
  team_identities: seed.teamIdentities,
  teams: seed.teams,
  team_players: seed.teamPlayers,
  venues: seed.venues,
  game_participation: seed.gameParticipation,
  player_stats: seed.playerStats,
  playoff_brackets: seed.playoffBrackets,
  playoff_seeds: seed.playoffSeeds,
  playoff_matches: seed.playoffMatches,
  career_baselines: careerBaselineRows,
  profiles: seed.profiles,
  public_profiles: seed.profiles,
};

const LEAGUE_SETTINGS_ROW = {
  id: 1,
  current_season: seed.settings.current_season,
  current_kickball_season: seed.settings.current_seasons.kickball,
  current_flag_football_season: seed.settings.current_seasons.flag_football,
  registration_open: seed.settings.registration_open,
  hof_published: seed.settings.hof_published,
};

const seededGame = seed.games.find((g) => g.status === "completed") || seed.games[0];
const SEEDED_GAME_ID = seededGame.id;
const SEEDED_GAME_TEAM = seed.teams.find((t) => t.id === seededGame.home_team_id)?.name;

module.exports = { TABLES, LEAGUE_SETTINGS_ROW, SEEDED_GAME_ID, SEEDED_GAME_TEAM, ADMIN_ONLY_TABLES, SEEDED_PII };
