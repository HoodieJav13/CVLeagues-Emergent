/* ============================================================================
 * CVF SPORTS — SEED / MOCK DATA
 * ----------------------------------------------------------------------------
 * This file is the SINGLE SOURCE OF TRUTH for all demo data. It is shaped like
 * a future relational/Supabase schema so it can be swapped for real DB tables
 * with minimal refactor.
 *
 * PHASE 2 (backend) MAPPING:
 *   profiles      -> public.profiles        (linked to auth.users)
 *   leagues       -> public.leagues
 *   teams         -> public.teams
 *   teamPlayers   -> public.team_players    (join table profiles<->teams)
 *   games         -> public.games
 *   playerStats   -> public.player_stats    (one row per player per game)
 *   freeAgents    -> public.free_agents
 *   registrations -> public.team_registrations
 *   settings      -> public.league_settings
 *
 * NOTE: Team win/loss records, point differentials, standings, season/career
 * stat totals and leaderboards are NOT stored here — they are DERIVED at
 * runtime from `games` + `playerStats` (see lib/selectors.js). This guarantees
 * that updating one game propagates everywhere automatically.
 * ========================================================================== */

export const SPORTS = [
  { id: "kickball", name: "Kickball" },
  { id: "flag_football", name: "Flag Football" },
];

export const CURRENT_SEASON = "Summer 2026";

export const seasons = [
  { name: CURRENT_SEASON, status: "active", starts_on: "2026-06-01", ends_on: "2026-08-31" },
];

const AVATAR_COLORS = [
  "#22d3ee", "#f97316", "#a855f7", "#10b981", "#ef4444",
  "#facc15", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b",
];
const color = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];

/* ----------------------------- PROFILES ---------------------------------- */
// claimed=false => account not yet claimed (admin can resend mock invites)
export const profiles = [
  { id: "p1", first_name: "Marcus", last_name: "Trujillo", email: "marcus.t@cvf.demo", phone: "505-555-0101", sports: ["kickball", "flag_football"], experience: "Advanced", claimed: true, bio: "Two-sport athlete. Power kicker and a sneaky-fast slot receiver." },
  { id: "p2", first_name: "Diego", last_name: "Sanchez", email: "diego.s@cvf.demo", phone: "505-555-0102", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "Contact hitter who never strikes out." },
  { id: "p3", first_name: "Aaron", last_name: "Chavez", email: "aaron.c@cvf.demo", phone: "505-555-0103", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "Gold-glove shortstop." },
  { id: "p4", first_name: "Tyler", last_name: "Romero", email: "tyler.r@cvf.demo", phone: "505-555-0104", sports: ["kickball"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p5", first_name: "Brandon", last_name: "Lujan", email: "brandon.l@cvf.demo", phone: "505-555-0105", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Lead-off homer threat." },
  { id: "p6", first_name: "Jessica", last_name: "Martinez", email: "jess.m@cvf.demo", phone: "505-555-0106", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Captain. Brings the snacks and the wins." },
  { id: "p7", first_name: "Ashley", last_name: "Gallegos", email: "ashley.g@cvf.demo", phone: "505-555-0107", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p8", first_name: "Crystal", last_name: "Vigil", email: "crystal.v@cvf.demo", phone: "505-555-0108", sports: ["kickball"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p9", first_name: "Monica", last_name: "Padilla", email: "monica.p@cvf.demo", phone: "505-555-0109", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p10", first_name: "Sarah", last_name: "Montoya", email: "sarah.m@cvf.demo", phone: "505-555-0110", sports: ["kickball"], experience: "Beginner", claimed: true, bio: "" },
  { id: "p11", first_name: "Kevin", last_name: "Baca", email: "kevin.b@cvf.demo", phone: "505-555-0111", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Captain of the Nomads. Switch kicker." },
  { id: "p12", first_name: "Eric", last_name: "Apodaca", email: "eric.a@cvf.demo", phone: "505-555-0112", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p13", first_name: "Nathan", last_name: "Griego", email: "nathan.g@cvf.demo", phone: "505-555-0113", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Cleanup kicker." },
  { id: "p14", first_name: "Carlos", last_name: "Maestas", email: "carlos.m@cvf.demo", phone: "505-555-0114", sports: ["kickball"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p15", first_name: "Derek", last_name: "Quintana", email: "derek.q@cvf.demo", phone: "505-555-0115", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p16", first_name: "Anthony", last_name: "Garcia", email: "anthony.g@cvf.demo", phone: "505-555-0116", sports: ["flag_football", "kickball"], experience: "Advanced", claimed: true, bio: "Captain & franchise QB. Also crushes it at first base." },
  { id: "p17", first_name: "Jordan", last_name: "Sandoval", email: "jordan.s@cvf.demo", phone: "505-555-0117", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "WR1. Route-running technician." },
  { id: "p18", first_name: "Mike", last_name: "Tafoya", email: "mike.t@cvf.demo", phone: "505-555-0118", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "Dual-threat back." },
  { id: "p19", first_name: "Steven", last_name: "Ortiz", email: "steven.o@cvf.demo", phone: "505-555-0119", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Ball-hawk safety." },
  { id: "p20", first_name: "Luis", last_name: "Herrera", email: "luis.h@cvf.demo", phone: "505-555-0120", sports: ["flag_football"], experience: "Intermediate", claimed: false, bio: "" },
  { id: "p21", first_name: "Amanda", last_name: "Lopez", email: "amanda.l@cvf.demo", phone: "505-555-0121", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Captain & gunslinger QB." },
  { id: "p22", first_name: "Rachel", last_name: "Duran", email: "rachel.d@cvf.demo", phone: "505-555-0122", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p23", first_name: "Nicole", last_name: "Archuleta", email: "nicole.a@cvf.demo", phone: "505-555-0123", sports: ["flag_football"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p24", first_name: "Stephanie", last_name: "Mora", email: "steph.m@cvf.demo", phone: "505-555-0124", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p25", first_name: "Vanessa", last_name: "Salazar", email: "vanessa.s@cvf.demo", phone: "505-555-0125", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Edge rusher." },
  { id: "p26", first_name: "Chris", last_name: "Aragon", email: "chris.a@cvf.demo", phone: "505-555-0126", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Captain. Big arm, bigger ego." },
  { id: "p27", first_name: "Daniel", last_name: "Velasquez", email: "daniel.v@cvf.demo", phone: "505-555-0127", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Possession receiver." },
  { id: "p28", first_name: "Joseph", last_name: "Cordova", email: "joseph.c@cvf.demo", phone: "505-555-0128", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p29", first_name: "Robert", last_name: "Mondragon", email: "robert.m@cvf.demo", phone: "505-555-0129", sports: ["flag_football"], experience: "Intermediate", claimed: false, bio: "" },
  { id: "p30", first_name: "Patrick", last_name: "Bustamante", email: "patrick.b@cvf.demo", phone: "505-555-0130", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Sack artist." },
].map((p, i) => ({
  ...p,
  name: `${p.first_name} ${p.last_name}`,
  avatar_color: color(i),
  // Informational eligibility flag (Flow C-lite). Seeded as a MIX so the
  // <EligibilityIndicator> shows both states out of the box. NEVER gates
  // anything — the admin enforces eligibility in real life.
  // PHASE 2: this flag is replaced by real waiver verification status.
  eligibility_status: i % 3 === 0 ? "verified" : "not_verified",
}));

/* ------------------------------ LEAGUES ---------------------------------- */
// kind: 'league' | 'tournament' — a standalone tournament is its own container
// row (migration 9 shape). playoff_format: 'single_elim' | 'double_elim' |
// 'round_robin' | null; varies per season, informational until bracket UI.
export const leagues = [
  { id: "l1", name: "Duke City Kickball", sport: "kickball", season: CURRENT_SEASON, kind: "league", playoff_format: "single_elim", description: "Albuquerque's premier adult co-ed kickball league. Tuesday & Thursday nights." },
  { id: "l2", name: "Burque Flag Football", sport: "flag_football", season: CURRENT_SEASON, kind: "league", playoff_format: "single_elim", description: "5-on-5 adult flag football under the lights at the West Mesa fields." },
];

/* ------------------------------- TEAMS ----------------------------------- */
export const teams = [
  { id: "t1", name: "Sandia Sluggers", sport: "kickball", league_id: "l1", captain_id: "p1", logo_color: "#22d3ee", founded: "2023" },
  { id: "t2", name: "Rio Grande Rollers", sport: "kickball", league_id: "l1", captain_id: "p6", logo_color: "#f97316", founded: "2022" },
  { id: "t3", name: "Nob Hill Nomads", sport: "kickball", league_id: "l1", captain_id: "p11", logo_color: "#a855f7", founded: "2024" },
  { id: "t4", name: "Bosque Blitz", sport: "flag_football", league_id: "l2", captain_id: "p16", logo_color: "#10b981", founded: "2022" },
  { id: "t5", name: "Mesa Mavericks", sport: "flag_football", league_id: "l2", captain_id: "p21", logo_color: "#ef4444", founded: "2023" },
  { id: "t6", name: "Frontier Force", sport: "flag_football", league_id: "l2", captain_id: "p26", logo_color: "#3b82f6", founded: "2024" },
  { id: "t7", name: "High Desert Heat", sport: "kickball", league_id: "l1", captain_id: null, logo_color: "#facc15", founded: "2026" },
  { id: "t8", name: "Route 66 Rush", sport: "flag_football", league_id: "l2", captain_id: null, logo_color: "#ec4899", founded: "2026" },
];

/* --------------------------- TEAM_PLAYERS -------------------------------- */
// Join table. A player can appear on multiple teams across sports (cross-sport).
// Each assignment is stamped with the active `season` (auto-set on assignment).
// PHASE 2: gains a roster_status (pending_waiver/eligible/inactive/removed)
// driven by the waiver flow against the real team_players table.
export const teamPlayers = [
  // t1 Sandia Sluggers (kickball)
  { id: "tp1", team_id: "t1", profile_id: "p1", jersey_number: 7, position: "Pitcher" },
  { id: "tp2", team_id: "t1", profile_id: "p2", jersey_number: 12, position: "Shortstop" },
  { id: "tp3", team_id: "t1", profile_id: "p3", jersey_number: 3, position: "1st Base" },
  { id: "tp4", team_id: "t1", profile_id: "p4", jersey_number: 21, position: "Outfield" },
  { id: "tp5", team_id: "t1", profile_id: "p5", jersey_number: 9, position: "Catcher" },
  { id: "tp25", team_id: "t1", profile_id: "p16", jersey_number: 4, position: "Outfield" }, // cross-sport
  // t2 Rio Grande Rollers (kickball)
  { id: "tp6", team_id: "t2", profile_id: "p6", jersey_number: 1, position: "Pitcher" },
  { id: "tp7", team_id: "t2", profile_id: "p7", jersey_number: 14, position: "2nd Base" },
  { id: "tp8", team_id: "t2", profile_id: "p8", jersey_number: 8, position: "Outfield" },
  { id: "tp9", team_id: "t2", profile_id: "p9", jersey_number: 22, position: "Catcher" },
  { id: "tp10", team_id: "t2", profile_id: "p10", jersey_number: 5, position: "Shortstop" },
  // t3 Nob Hill Nomads (kickball)
  { id: "tp11", team_id: "t3", profile_id: "p11", jersey_number: 11, position: "Pitcher" },
  { id: "tp12", team_id: "t3", profile_id: "p12", jersey_number: 6, position: "1st Base" },
  { id: "tp13", team_id: "t3", profile_id: "p13", jersey_number: 24, position: "Outfield" },
  { id: "tp14", team_id: "t3", profile_id: "p14", jersey_number: 17, position: "Catcher" },
  { id: "tp15", team_id: "t3", profile_id: "p15", jersey_number: 2, position: "Shortstop" },
  // t4 Bosque Blitz (flag football)
  { id: "tp16", team_id: "t4", profile_id: "p16", jersey_number: 7, position: "QB" },
  { id: "tp17", team_id: "t4", profile_id: "p17", jersey_number: 80, position: "WR" },
  { id: "tp18", team_id: "t4", profile_id: "p18", jersey_number: 28, position: "RB / WR" },
  { id: "tp19", team_id: "t4", profile_id: "p19", jersey_number: 20, position: "Safety" },
  { id: "tp20", team_id: "t4", profile_id: "p20", jersey_number: 55, position: "Rusher" },
  { id: "tp26", team_id: "t4", profile_id: "p1", jersey_number: 7, position: "WR" }, // cross-sport
  // t5 Mesa Mavericks (flag football)
  { id: "tp21", team_id: "t5", profile_id: "p21", jersey_number: 12, position: "QB" },
  { id: "tp22", team_id: "t5", profile_id: "p22", jersey_number: 81, position: "WR" },
  { id: "tp23", team_id: "t5", profile_id: "p23", jersey_number: 84, position: "WR" },
  { id: "tp24", team_id: "t5", profile_id: "p24", jersey_number: 23, position: "Safety" },
  { id: "tp27", team_id: "t5", profile_id: "p25", jersey_number: 90, position: "Rusher" },
  // t6 Frontier Force (flag football)
  { id: "tp28", team_id: "t6", profile_id: "p26", jersey_number: 9, position: "QB" },
  { id: "tp29", team_id: "t6", profile_id: "p27", jersey_number: 88, position: "WR" },
  { id: "tp30", team_id: "t6", profile_id: "p28", jersey_number: 32, position: "RB / WR" },
  { id: "tp31", team_id: "t6", profile_id: "p29", jersey_number: 25, position: "Safety" },
  { id: "tp32", team_id: "t6", profile_id: "p30", jersey_number: 99, position: "Rusher" },
].map((tp) => ({ season: CURRENT_SEASON, ...tp }));

/* ------------------------------- GAMES ----------------------------------- */
// status: 'upcoming' | 'completed' | 'postponed' | 'canceled'.
// periods holds per-inning/per-quarter scores.
// score_status: 'pending' | 'submitted' | 'approved' | 'disputed' | 'final'
// (CLAUDE.md data model) — lives ALONGSIDE status, which is kept as-is.
// 'final' means LOCKED (locked: true, set via the admin Mark Final action);
// edit_history is the mock audit log: { action, timestamp, reason? }.
//
// SEASON-IN-PROGRESS ANCHOR: this mock season is read as if "today" is
// 2026-06-27. Every game dated on/before the anchor is completed (with scores
// + playerStats); every game dated after it is upcoming (pending, no scores).
// Keep this invariant when editing: standings + leaderboards derive from
// completed games only, so a future-dated game must never carry a result.
//
// stage: 'regular' | 'playoff' | 'tournament' (migration 9 shape; defaulted to
// 'regular' by the .map below — only playoff games declare it). Playoff games
// count toward season stat totals but are EXCLUDED from standings (selectors).
// Narrative: flag football's 3-team round robin finished 06-21, so its playoff
// round robin is underway (g10 played, g11/g12 to come). Kickball's regular
// season runs through 07-07 with single-elim playoffs after (g13/g14).
export const games = [
  // --- Kickball completed ---
  { id: "g1", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", date: "2026-06-09", time: "6:30 PM", location: "Los Altos Park, Field 2", status: "completed", score_status: "approved", home_score: 7, away_score: 4, periods: { home: [2, 0, 1, 3, 1], away: [0, 1, 2, 0, 1] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g2", league_id: "l1", sport: "kickball", home_team_id: "t2", away_team_id: "t3", date: "2026-06-11", time: "7:30 PM", location: "Los Altos Park, Field 1", status: "completed", score_status: "approved", home_score: 4, away_score: 6, periods: { home: [1, 2, 0, 1, 0], away: [0, 3, 1, 2, 0] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g3", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t3", date: "2026-06-16", time: "6:30 PM", location: "Los Altos Park, Field 2", status: "completed", score_status: "approved", home_score: 8, away_score: 5, periods: { home: [3, 1, 2, 0, 2], away: [1, 0, 1, 2, 1] }, temp_admin_id: null, locked: false, edit_history: [] },
  // --- Kickball upcoming ---
  { id: "g4", league_id: "l1", sport: "kickball", home_team_id: "t2", away_team_id: "t1", date: "2026-06-30", time: "6:30 PM", location: "Los Altos Park, Field 1", status: "upcoming", score_status: "pending", home_score: null, away_score: null, periods: { home: [], away: [] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g5", league_id: "l1", sport: "kickball", home_team_id: "t3", away_team_id: "t1", date: "2026-07-02", time: "7:30 PM", location: "Los Altos Park, Field 2", status: "upcoming", score_status: "pending", home_score: null, away_score: null, periods: { home: [], away: [] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g6", league_id: "l1", sport: "kickball", home_team_id: "t3", away_team_id: "t2", date: "2026-07-07", time: "6:30 PM", location: "Los Altos Park, Field 1", status: "upcoming", score_status: "pending", home_score: null, away_score: null, periods: { home: [], away: [] }, temp_admin_id: null, locked: false, edit_history: [] },
  // --- Flag football completed ---
  { id: "g7", league_id: "l2", sport: "flag_football", home_team_id: "t4", away_team_id: "t5", date: "2026-06-07", time: "8:00 PM", location: "West Mesa Fields, Field A", status: "completed", score_status: "approved", home_score: 21, away_score: 14, periods: { home: [7, 6, 0, 8], away: [0, 7, 7, 0] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g8", league_id: "l2", sport: "flag_football", home_team_id: "t5", away_team_id: "t6", date: "2026-06-14", time: "7:00 PM", location: "West Mesa Fields, Field B", status: "completed", score_status: "approved", home_score: 13, away_score: 20, periods: { home: [6, 0, 7, 0], away: [7, 7, 0, 6] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g9", league_id: "l2", sport: "flag_football", home_team_id: "t4", away_team_id: "t6", date: "2026-06-21", time: "8:00 PM", location: "West Mesa Fields, Field A", status: "completed", score_status: "approved", home_score: 21, away_score: 17, periods: { home: [0, 7, 7, 7], away: [7, 0, 7, 3] }, temp_admin_id: null, locked: false, edit_history: [] },
  // --- Flag football playoffs (round robin; g10 played, g11/g12 upcoming) ---
  { id: "g10", league_id: "l2", sport: "flag_football", home_team_id: "t5", away_team_id: "t4", date: "2026-06-26", time: "7:00 PM", location: "West Mesa Fields, Field B", status: "completed", score_status: "approved", stage: "playoff", home_score: 20, away_score: 28, periods: { home: [7, 6, 0, 7], away: [7, 7, 7, 7] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g11", league_id: "l2", sport: "flag_football", home_team_id: "t6", away_team_id: "t8", date: "2026-07-05", time: "8:00 PM", location: "West Mesa Fields, Field A", status: "upcoming", score_status: "pending", stage: "playoff", home_score: null, away_score: null, periods: { home: [], away: [] }, temp_admin_id: null, locked: false, edit_history: [] },
  // --- Kickball playoffs (single elim, after the 07-07 finale; matchups are
  //     mock placeholders — real seeding/bracket UI is a later pass) ---
  { id: "g13", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", date: "2026-07-09", time: "6:30 PM", location: "Los Altos Park, Field 2", status: "upcoming", score_status: "pending", stage: "playoff", home_score: null, away_score: null, periods: { home: [], away: [] }, temp_admin_id: null, locked: false, edit_history: [] },
  { id: "g14", league_id: "l1", sport: "kickball", home_team_id: "t3", away_team_id: "t7", date: "2026-07-14", time: "7:00 PM", location: "Los Altos Park, Field 1", status: "upcoming", score_status: "pending", stage: "playoff", home_score: null, away_score: null, periods: { home: [], away: [] }, temp_admin_id: null, locked: false, edit_history: [] },
].map((g) => ({ stage: "regular", ...g }));

/* ---------------------------- PLAYER_STATS ------------------------------- */
// One row per player per completed game. Missing stat keys default to 0.
const ps = (id, game_id, profile_id, team_id, sport, stats) => ({ id, game_id, profile_id, team_id, sport, stats });

export const playerStats = [
  // ===== g1 : t1 7 - 4 t2 (kickball) =====
  ps("s_g1_p1", "g1", "p1", "t1", "kickball", { kicks: 5, singles: 2, doubles: 1, homeRuns: 1, rbis: 3, runs: 2, strikeouts: 1, outs: 3, assists: 1 }),
  ps("s_g1_p2", "g1", "p2", "t1", "kickball", { kicks: 4, singles: 2, rbis: 1, runs: 1, outs: 2 }),
  ps("s_g1_p3", "g1", "p3", "t1", "kickball", { kicks: 4, singles: 1, doubles: 1, rbis: 2, runs: 1, outs: 2, assists: 1 }),
  ps("s_g1_p4", "g1", "p4", "t1", "kickball", { kicks: 3, singles: 1, runs: 1, walks: 1, outs: 1 }),
  ps("s_g1_p5", "g1", "p5", "t1", "kickball", { kicks: 3, homeRuns: 1, rbis: 1, runs: 2, strikeouts: 1, outs: 1, errors: 1 }),
  ps("s_g1_p6", "g1", "p6", "t2", "kickball", { kicks: 4, singles: 2, rbis: 2, runs: 1, outs: 2 }),
  ps("s_g1_p7", "g1", "p7", "t2", "kickball", { kicks: 3, doubles: 1, runs: 1, outs: 1, errors: 1 }),
  ps("s_g1_p8", "g1", "p8", "t2", "kickball", { kicks: 3, singles: 1, rbis: 1, runs: 1, outs: 2 }),
  ps("s_g1_p9", "g1", "p9", "t2", "kickball", { kicks: 3, singles: 1, runs: 1, strikeouts: 1, outs: 1 }),
  ps("s_g1_p10", "g1", "p10", "t2", "kickball", { kicks: 2, walks: 1, strikeouts: 1, outs: 1, assists: 1 }),
  // ===== g2 : t2 4 - 6 t3 (kickball) =====
  ps("s_g2_p6", "g2", "p6", "t2", "kickball", { kicks: 4, singles: 1, doubles: 1, rbis: 1, runs: 1, outs: 2 }),
  ps("s_g2_p7", "g2", "p7", "t2", "kickball", { kicks: 3, singles: 1, runs: 1, outs: 1 }),
  ps("s_g2_p8", "g2", "p8", "t2", "kickball", { kicks: 3, homeRuns: 1, rbis: 1, runs: 1, outs: 1, errors: 1 }),
  ps("s_g2_p9", "g2", "p9", "t2", "kickball", { kicks: 3, singles: 1, runs: 1, outs: 2 }),
  ps("s_g2_p10", "g2", "p10", "t2", "kickball", { kicks: 2, strikeouts: 2, outs: 1 }),
  ps("s_g2_p11", "g2", "p11", "t3", "kickball", { kicks: 4, singles: 2, doubles: 1, rbis: 2, runs: 2, outs: 3, assists: 1 }),
  ps("s_g2_p12", "g2", "p12", "t3", "kickball", { kicks: 4, singles: 1, triples: 1, rbis: 1, runs: 1, outs: 2 }),
  ps("s_g2_p13", "g2", "p13", "t3", "kickball", { kicks: 3, homeRuns: 1, rbis: 2, runs: 1, outs: 1 }),
  ps("s_g2_p14", "g2", "p14", "t3", "kickball", { kicks: 3, singles: 1, runs: 1, outs: 2, errors: 1 }),
  ps("s_g2_p15", "g2", "p15", "t3", "kickball", { kicks: 3, walks: 1, runs: 1, strikeouts: 1, outs: 1 }),
  // ===== g3 : t1 8 - 5 t3 (kickball) =====
  ps("s_g3_p1", "g3", "p1", "t1", "kickball", { kicks: 5, singles: 1, doubles: 1, homeRuns: 1, rbis: 3, runs: 2, outs: 3 }),
  ps("s_g3_p2", "g3", "p2", "t1", "kickball", { kicks: 4, singles: 2, rbis: 1, runs: 2, outs: 2, assists: 1 }),
  ps("s_g3_p3", "g3", "p3", "t1", "kickball", { kicks: 4, doubles: 1, rbis: 1, runs: 1, outs: 2 }),
  ps("s_g3_p4", "g3", "p4", "t1", "kickball", { kicks: 4, singles: 1, runs: 1, walks: 1, outs: 1 }),
  ps("s_g3_p5", "g3", "p5", "t1", "kickball", { kicks: 4, triples: 1, homeRuns: 1, rbis: 2, runs: 2, strikeouts: 1, outs: 1, errors: 1 }),
  ps("s_g3_p11", "g3", "p11", "t3", "kickball", { kicks: 4, singles: 2, rbis: 1, runs: 1, outs: 2 }),
  ps("s_g3_p12", "g3", "p12", "t3", "kickball", { kicks: 4, doubles: 1, rbis: 1, runs: 1, outs: 2, assists: 1 }),
  ps("s_g3_p13", "g3", "p13", "t3", "kickball", { kicks: 3, homeRuns: 1, rbis: 2, runs: 1, outs: 1 }),
  ps("s_g3_p14", "g3", "p14", "t3", "kickball", { kicks: 3, singles: 1, runs: 1, outs: 2, errors: 1 }),
  ps("s_g3_p15", "g3", "p15", "t3", "kickball", { kicks: 3, walks: 1, runs: 1, strikeouts: 1, outs: 1 }),
  // ===== g7 : t4 21 - 14 t5 (flag football) =====
  ps("s_g7_p16", "g7", "p16", "t4", "flag_football", { completions: 12, attempts: 18, passYards: 185, passTDs: 2, ints: 1, carries: 3, rushYards: 22, rushTDs: 1, rushFirstDowns: 2, tds: 1 }),
  ps("s_g7_p17", "g7", "p17", "t4", "flag_football", { catches: 6, recYards: 95, recTDs: 1, recFirstDowns: 4, flagPulls: 2, tds: 1 }),
  ps("s_g7_p18", "g7", "p18", "t4", "flag_football", { carries: 5, rushYards: 40, catches: 4, recYards: 60, recTDs: 1, recFirstDowns: 3, tds: 1 }),
  ps("s_g7_p19", "g7", "p19", "t4", "flag_football", { flagPulls: 5, sacks: 1, defInts: 1 }),
  ps("s_g7_p20", "g7", "p20", "t4", "flag_football", { flagPulls: 4, sacks: 2 }),
  ps("s_g7_p21", "g7", "p21", "t5", "flag_football", { completions: 10, attempts: 20, passYards: 150, passTDs: 2, ints: 2, carries: 2, rushYards: 10 }),
  ps("s_g7_p22", "g7", "p22", "t5", "flag_football", { catches: 5, recYards: 80, recTDs: 1, recFirstDowns: 3, flagPulls: 3, tds: 1 }),
  ps("s_g7_p23", "g7", "p23", "t5", "flag_football", { catches: 4, recYards: 55, recTDs: 1, recFirstDowns: 2, tds: 1 }),
  ps("s_g7_p24", "g7", "p24", "t5", "flag_football", { flagPulls: 6, defInts: 1 }),
  ps("s_g7_p25", "g7", "p25", "t5", "flag_football", { flagPulls: 3, sacks: 1 }),
  // ===== g8 : t5 13 - 20 t6 (flag football) =====
  ps("s_g8_p21", "g8", "p21", "t5", "flag_football", { completions: 9, attempts: 19, passYards: 140, passTDs: 1, ints: 1 }),
  ps("s_g8_p22", "g8", "p22", "t5", "flag_football", { catches: 5, recYards: 70, recTDs: 1, recFirstDowns: 3, flagPulls: 2, tds: 1 }),
  ps("s_g8_p23", "g8", "p23", "t5", "flag_football", { catches: 3, recYards: 45, recFirstDowns: 2 }),
  ps("s_g8_p24", "g8", "p24", "t5", "flag_football", { flagPulls: 5, sacks: 1 }),
  ps("s_g8_p25", "g8", "p25", "t5", "flag_football", { flagPulls: 4, sacks: 2, defInts: 1 }),
  ps("s_g8_p26", "g8", "p26", "t6", "flag_football", { completions: 13, attempts: 19, passYards: 210, passTDs: 2, ints: 0, carries: 4, rushYards: 30, rushTDs: 1, tds: 1 }),
  ps("s_g8_p27", "g8", "p27", "t6", "flag_football", { catches: 7, recYards: 110, recTDs: 1, recFirstDowns: 5, flagPulls: 2, tds: 1 }),
  ps("s_g8_p28", "g8", "p28", "t6", "flag_football", { carries: 6, rushYards: 45, catches: 5, recYards: 65, recTDs: 1, recFirstDowns: 3, tds: 1 }),
  ps("s_g8_p29", "g8", "p29", "t6", "flag_football", { flagPulls: 6, sacks: 1, defInts: 1 }),
  ps("s_g8_p30", "g8", "p30", "t6", "flag_football", { flagPulls: 5, sacks: 3 }),
  // ===== g9 : t4 21 - 17 t6 (flag football) =====
  ps("s_g9_p16", "g9", "p16", "t4", "flag_football", { completions: 14, attempts: 20, passYards: 220, passTDs: 3, ints: 1, carries: 2, rushYards: 15 }),
  ps("s_g9_p17", "g9", "p17", "t4", "flag_football", { catches: 7, recYards: 120, recTDs: 2, recFirstDowns: 5, flagPulls: 3, tds: 2 }),
  ps("s_g9_p18", "g9", "p18", "t4", "flag_football", { carries: 6, rushYards: 50, catches: 5, recYards: 55, recTDs: 1, recFirstDowns: 2, tds: 1 }),
  ps("s_g9_p19", "g9", "p19", "t4", "flag_football", { flagPulls: 6, sacks: 2, defInts: 1 }),
  ps("s_g9_p20", "g9", "p20", "t4", "flag_football", { flagPulls: 5, sacks: 1 }),
  ps("s_g9_p26", "g9", "p26", "t6", "flag_football", { completions: 11, attempts: 21, passYards: 175, passTDs: 2, ints: 2, carries: 3, rushYards: 20 }),
  ps("s_g9_p27", "g9", "p27", "t6", "flag_football", { catches: 6, recYards: 90, recTDs: 1, recFirstDowns: 4, flagPulls: 2, tds: 1 }),
  ps("s_g9_p28", "g9", "p28", "t6", "flag_football", { carries: 5, rushYards: 35, catches: 4, recYards: 50, recTDs: 1, recFirstDowns: 2, tds: 1 }),
  ps("s_g9_p29", "g9", "p29", "t6", "flag_football", { flagPulls: 5, defInts: 1 }),
  ps("s_g9_p30", "g9", "p30", "t6", "flag_football", { flagPulls: 4, sacks: 2 }),
  // ===== g10 : t5 20 - 28 t4 (flag football, PLAYOFF round robin) =====
  // Playoff stats count toward season totals (same categories/weighting);
  // only the standings computation excludes this game (see selectors).
  ps("s_g10_p16", "g10", "p16", "t4", "flag_football", { completions: 15, attempts: 22, passYards: 240, passTDs: 3, ints: 0, carries: 3, rushYards: 18, rushTDs: 1, tds: 1 }),
  ps("s_g10_p17", "g10", "p17", "t4", "flag_football", { catches: 7, recYards: 105, recTDs: 2, recFirstDowns: 4, flagPulls: 2, tds: 2 }),
  ps("s_g10_p18", "g10", "p18", "t4", "flag_football", { carries: 5, rushYards: 38, catches: 4, recYards: 60, recTDs: 1, recFirstDowns: 2, tds: 1 }),
  ps("s_g10_p19", "g10", "p19", "t4", "flag_football", { flagPulls: 5, sacks: 1, defInts: 1 }),
  ps("s_g10_p20", "g10", "p20", "t4", "flag_football", { flagPulls: 4, sacks: 2 }),
  ps("s_g10_p21", "g10", "p21", "t5", "flag_football", { completions: 11, attempts: 21, passYards: 165, passTDs: 2, ints: 1, carries: 2, rushYards: 12 }),
  ps("s_g10_p22", "g10", "p22", "t5", "flag_football", { catches: 6, recYards: 85, recTDs: 1, recFirstDowns: 3, flagPulls: 2, tds: 1 }),
  ps("s_g10_p23", "g10", "p23", "t5", "flag_football", { catches: 4, recYards: 50, recTDs: 1, recFirstDowns: 2, tds: 1 }),
  ps("s_g10_p24", "g10", "p24", "t5", "flag_football", { flagPulls: 5, defInts: 1 }),
  ps("s_g10_p25", "g10", "p25", "t5", "flag_football", { flagPulls: 4, sacks: 2 }),
];

/* --------------- CAREER BASELINE (prior seasons, per player) -------------- */
// career total = baseline + current-season aggregation (see selectors).
// Represents stats accumulated before Summer 2026.
export const careerBaselines = {
  // kickball
  p1: { kickball: { homeRuns: 9, rbis: 28, runs: 24, singles: 31, doubles: 11, triples: 2 } },
  p2: { kickball: { homeRuns: 1, rbis: 14, runs: 18, singles: 26, doubles: 4 } },
  p3: { kickball: { homeRuns: 3, rbis: 17, runs: 15, singles: 19, doubles: 8 } },
  p5: { kickball: { homeRuns: 12, rbis: 24, runs: 21, singles: 14, triples: 4 } },
  p6: { kickball: { homeRuns: 4, rbis: 22, runs: 19, singles: 24 } },
  p11: { kickball: { homeRuns: 6, rbis: 20, runs: 22, singles: 27, doubles: 9 } },
  p13: { kickball: { homeRuns: 10, rbis: 26, runs: 17, singles: 12 } },
  p12: { kickball: { homeRuns: 2, rbis: 12, runs: 14, singles: 21, triples: 3 } },
  // flag football
  p16: { flag_football: { passYards: 1820, passTDs: 18, rushYards: 210, rushTDs: 6 } },
  p17: { flag_football: { recYards: 1140, recTDs: 12, catches: 78, flagPulls: 20 } },
  p18: { flag_football: { rushYards: 540, rushTDs: 7, recYards: 680, recTDs: 6 } },
  p19: { flag_football: { flagPulls: 64, sacks: 11, defInts: 7 } },
  p21: { flag_football: { passYards: 1610, passTDs: 15, ints: 12 } },
  p22: { flag_football: { recYards: 980, recTDs: 9, catches: 64 } },
  p26: { flag_football: { passYards: 1740, passTDs: 17, rushYards: 180, rushTDs: 5 } },
  p27: { flag_football: { recYards: 1020, recTDs: 10, catches: 70 } },
  p30: { flag_football: { flagPulls: 58, sacks: 16, defInts: 3 } },
};

/* ----------------------------- FREE_AGENTS ------------------------------- */
export const freeAgents = [
  { id: "fa1", name: "Olivia Naranjo", email: "olivia.n@cvf.demo", phone: "505-555-0201", sports: ["kickball"], experience: "Intermediate", notes: "Played college softball. Looking for a competitive squad.", status: "new", created_at: "2026-05-28" },
  { id: "fa2", name: "Ben Carrillo", email: "ben.c@cvf.demo", phone: "505-555-0202", sports: ["flag_football"], experience: "Advanced", notes: "Former HS QB. Can also play safety.", status: "new", created_at: "2026-05-29" },
  { id: "fa3", name: "Hannah Esquibel", email: "hannah.e@cvf.demo", phone: "", sports: ["kickball", "flag_football"], experience: "Beginner", notes: "New to leagues, eager to learn and have fun!", status: "new", created_at: "2026-05-30" },
  { id: "fa4", name: "Marcus Tenorio", email: "marcus.te@cvf.demo", phone: "505-555-0204", sports: ["flag_football"], experience: "Intermediate", notes: "Speedy receiver, available weeknights.", status: "new", created_at: "2026-06-01" },
  { id: "fa5", name: "Gabriela Rael", email: "gabriela.r@cvf.demo", phone: "505-555-0205", sports: ["kickball"], experience: "Advanced", notes: "Big bat, plays anywhere in the field.", status: "new", created_at: "2026-06-02" },
  { id: "fa6", name: "Tyler Madrid", email: "tyler.ma@cvf.demo", phone: "505-555-0206", sports: ["kickball", "flag_football"], experience: "Intermediate", notes: "Two-sport guy looking to stay busy this summer.", status: "new", created_at: "2026-06-03" },
  { id: "fa7", name: "Sophia Lucero", email: "sophia.l@cvf.demo", phone: "", sports: ["kickball"], experience: "Beginner", notes: "Just moved to ABQ, want to meet people.", status: "new", created_at: "2026-06-04" },
  { id: "fa8", name: "Andrew Sena", email: "andrew.s@cvf.demo", phone: "505-555-0208", sports: ["flag_football"], experience: "Advanced", notes: "Pass rusher / edge. Played 4 seasons of flag.", status: "new", created_at: "2026-06-05" },
];

/* ---------------------------- REGISTRATIONS ------------------------------ */
export const registrations = [
  { id: "reg1", team_name: "Westside Warriors", sport: "kickball", captain_name: "Felix Ortega", captain_email: "felix.o@cvf.demo", captain_phone: "505-555-0301", roster: [{ name: "Felix Ortega", email: "felix.o@cvf.demo" }, { name: "Dana Roybal", email: "dana.r@cvf.demo" }, { name: "Marco Silva", email: "marco.s@cvf.demo" }, { name: "Lena Trujillo", email: "lena.t@cvf.demo" }, { name: "Ray Gonzales", email: "ray.g@cvf.demo" }], status: "new", created_at: "2026-06-04" },
];

/* ------------------------------- WAIVERS ---------------------------------- */
// MOCK records shaped per the CLAUDE.md waiver model (real submission flow
// ships with the backend). APPEND-ONLY in production: a re-sign creates a new
// row, never an edit — w3/w4 below show one player's superseded + re-signed
// pair. A submitted waiver does NOT equal eligibility; eligibility = admin
// verification + team/season assignment.
// verification_status: 'pending' | 'verified' | 'rejected' | 'duplicate'
export const WAIVER_VERSION = "CVF-WAIVER-2026-06-04-v1";
export const waivers = [
  { id: "w1", profile_id: "p1", signed_name: "Marcus Trujillo", email: "marcus.t@cvf.demo", phone: "505-555-0101", signed_at: "2026-06-05T17:42:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "174.56.20.18", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", verification_status: "verified" },
  { id: "w2", profile_id: "p6", signed_name: "Jessica Martinez", email: "jess.m@cvf.demo", phone: "505-555-0106", signed_at: "2026-06-05T19:03:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "98.60.142.77", user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", verification_status: "verified" },
  { id: "w3", profile_id: "p4", signed_name: "Tyler Romero", email: "tyler.r@cvf.demo", phone: "505-555-0104", signed_at: "2026-06-06T15:11:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: false, ip_address: "70.171.33.204", user_agent: "Mozilla/5.0 (Linux; Android 14)", verification_status: "duplicate" },
  { id: "w4", profile_id: "p4", signed_name: "Tyler J. Romero", email: "tyler.r@cvf.demo", phone: "505-555-0104", signed_at: "2026-06-08T20:27:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "70.171.33.204", user_agent: "Mozilla/5.0 (Linux; Android 14)", verification_status: "pending" },
  { id: "w5", profile_id: "p8", signed_name: "C. Vigil", email: "crystal.v@cvf.demo", phone: "505-555-0108", signed_at: "2026-06-07T16:48:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: false, media_consent: false, ip_address: "166.70.21.9", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)", verification_status: "rejected" },
  { id: "w6", profile_id: null, signed_name: "Olivia Naranjo", email: "olivia.n@cvf.demo", phone: "505-555-0201", signed_at: "2026-06-09T18:35:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "97.123.88.40", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", verification_status: "pending" },
];

/* ------------------------------ SETTINGS --------------------------------- */
export const settings = {
  current_season: CURRENT_SEASON,
  current_seasons: { kickball: CURRENT_SEASON, flag_football: CURRENT_SEASON },
  registration_open: { kickball: true, flag_football: false },
};

/* Assemble the initial shared state object. */
export const initialState = {
  seasons,
  profiles,
  leagues,
  teams,
  teamPlayers,
  games,
  playerStats,
  playoffBrackets: [],
  playoffSeeds: [],
  playoffMatches: [],
  careerBaselines,
  freeAgents,
  registrations,
  waivers,
  settings,
};
