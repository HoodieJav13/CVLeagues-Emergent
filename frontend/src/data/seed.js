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

const AVATAR_COLORS = [
  "#22d3ee", "#f97316", "#a855f7", "#10b981", "#ef4444",
  "#facc15", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b",
];
const color = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];

/* ----------------------------- PROFILES ---------------------------------- */
// claimed=false => account not yet claimed (admin can resend mock invites)
export const profiles = [
  { id: "p1", firstName: "Marcus", lastName: "Trujillo", email: "marcus.t@cvf.demo", phone: "505-555-0101", sports: ["kickball", "flag_football"], experience: "Advanced", claimed: true, bio: "Two-sport athlete. Power kicker and a sneaky-fast slot receiver." },
  { id: "p2", firstName: "Diego", lastName: "Sanchez", email: "diego.s@cvf.demo", phone: "505-555-0102", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "Contact hitter who never strikes out." },
  { id: "p3", firstName: "Aaron", lastName: "Chavez", email: "aaron.c@cvf.demo", phone: "505-555-0103", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "Gold-glove shortstop." },
  { id: "p4", firstName: "Tyler", lastName: "Romero", email: "tyler.r@cvf.demo", phone: "505-555-0104", sports: ["kickball"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p5", firstName: "Brandon", lastName: "Lujan", email: "brandon.l@cvf.demo", phone: "505-555-0105", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Lead-off homer threat." },
  { id: "p6", firstName: "Jessica", lastName: "Martinez", email: "jess.m@cvf.demo", phone: "505-555-0106", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Captain. Brings the snacks and the wins." },
  { id: "p7", firstName: "Ashley", lastName: "Gallegos", email: "ashley.g@cvf.demo", phone: "505-555-0107", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p8", firstName: "Crystal", lastName: "Vigil", email: "crystal.v@cvf.demo", phone: "505-555-0108", sports: ["kickball"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p9", firstName: "Monica", lastName: "Padilla", email: "monica.p@cvf.demo", phone: "505-555-0109", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p10", firstName: "Sarah", lastName: "Montoya", email: "sarah.m@cvf.demo", phone: "505-555-0110", sports: ["kickball"], experience: "Beginner", claimed: true, bio: "" },
  { id: "p11", firstName: "Kevin", lastName: "Baca", email: "kevin.b@cvf.demo", phone: "505-555-0111", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Captain of the Nomads. Switch kicker." },
  { id: "p12", firstName: "Eric", lastName: "Apodaca", email: "eric.a@cvf.demo", phone: "505-555-0112", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p13", firstName: "Nathan", lastName: "Griego", email: "nathan.g@cvf.demo", phone: "505-555-0113", sports: ["kickball"], experience: "Advanced", claimed: true, bio: "Cleanup kicker." },
  { id: "p14", firstName: "Carlos", lastName: "Maestas", email: "carlos.m@cvf.demo", phone: "505-555-0114", sports: ["kickball"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p15", firstName: "Derek", lastName: "Quintana", email: "derek.q@cvf.demo", phone: "505-555-0115", sports: ["kickball"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p16", firstName: "Anthony", lastName: "Garcia", email: "anthony.g@cvf.demo", phone: "505-555-0116", sports: ["flag_football", "kickball"], experience: "Advanced", claimed: true, bio: "Captain & franchise QB. Also crushes it at first base." },
  { id: "p17", firstName: "Jordan", lastName: "Sandoval", email: "jordan.s@cvf.demo", phone: "505-555-0117", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "WR1. Route-running technician." },
  { id: "p18", firstName: "Mike", lastName: "Tafoya", email: "mike.t@cvf.demo", phone: "505-555-0118", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "Dual-threat back." },
  { id: "p19", firstName: "Steven", lastName: "Ortiz", email: "steven.o@cvf.demo", phone: "505-555-0119", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Ball-hawk safety." },
  { id: "p20", firstName: "Luis", lastName: "Herrera", email: "luis.h@cvf.demo", phone: "505-555-0120", sports: ["flag_football"], experience: "Intermediate", claimed: false, bio: "" },
  { id: "p21", firstName: "Amanda", lastName: "Lopez", email: "amanda.l@cvf.demo", phone: "505-555-0121", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Captain & gunslinger QB." },
  { id: "p22", firstName: "Rachel", lastName: "Duran", email: "rachel.d@cvf.demo", phone: "505-555-0122", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p23", firstName: "Nicole", lastName: "Archuleta", email: "nicole.a@cvf.demo", phone: "505-555-0123", sports: ["flag_football"], experience: "Beginner", claimed: false, bio: "" },
  { id: "p24", firstName: "Stephanie", lastName: "Mora", email: "steph.m@cvf.demo", phone: "505-555-0124", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p25", firstName: "Vanessa", lastName: "Salazar", email: "vanessa.s@cvf.demo", phone: "505-555-0125", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Edge rusher." },
  { id: "p26", firstName: "Chris", lastName: "Aragon", email: "chris.a@cvf.demo", phone: "505-555-0126", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Captain. Big arm, bigger ego." },
  { id: "p27", firstName: "Daniel", lastName: "Velasquez", email: "daniel.v@cvf.demo", phone: "505-555-0127", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Possession receiver." },
  { id: "p28", firstName: "Joseph", lastName: "Cordova", email: "joseph.c@cvf.demo", phone: "505-555-0128", sports: ["flag_football"], experience: "Intermediate", claimed: true, bio: "" },
  { id: "p29", firstName: "Robert", lastName: "Mondragon", email: "robert.m@cvf.demo", phone: "505-555-0129", sports: ["flag_football"], experience: "Intermediate", claimed: false, bio: "" },
  { id: "p30", firstName: "Patrick", lastName: "Bustamante", email: "patrick.b@cvf.demo", phone: "505-555-0130", sports: ["flag_football"], experience: "Advanced", claimed: true, bio: "Sack artist." },
].map((p, i) => ({ ...p, name: `${p.firstName} ${p.lastName}`, avatarColor: color(i) }));

/* ------------------------------ LEAGUES ---------------------------------- */
export const leagues = [
  { id: "l1", name: "Duke City Kickball", sport: "kickball", season: CURRENT_SEASON, description: "Albuquerque's premier adult co-ed kickball league. Tuesday & Thursday nights." },
  { id: "l2", name: "Burque Flag Football", sport: "flag_football", season: CURRENT_SEASON, description: "5-on-5 adult flag football under the lights at the West Mesa fields." },
];

/* ------------------------------- TEAMS ----------------------------------- */
export const teams = [
  { id: "t1", name: "Sandia Sluggers", sport: "kickball", leagueId: "l1", captainId: "p1", logoColor: "#22d3ee", founded: "2023" },
  { id: "t2", name: "Rio Grande Rollers", sport: "kickball", leagueId: "l1", captainId: "p6", logoColor: "#f97316", founded: "2022" },
  { id: "t3", name: "Nob Hill Nomads", sport: "kickball", leagueId: "l1", captainId: "p11", logoColor: "#a855f7", founded: "2024" },
  { id: "t4", name: "Bosque Blitz", sport: "flag_football", leagueId: "l2", captainId: "p16", logoColor: "#10b981", founded: "2022" },
  { id: "t5", name: "Mesa Mavericks", sport: "flag_football", leagueId: "l2", captainId: "p21", logoColor: "#ef4444", founded: "2023" },
  { id: "t6", name: "Frontier Force", sport: "flag_football", leagueId: "l2", captainId: "p26", logoColor: "#3b82f6", founded: "2024" },
];

/* --------------------------- TEAM_PLAYERS -------------------------------- */
// Join table. A player can appear on multiple teams across sports (cross-sport).
export const teamPlayers = [
  // t1 Sandia Sluggers (kickball)
  { id: "tp1", teamId: "t1", playerId: "p1", jersey: 7, position: "Pitcher" },
  { id: "tp2", teamId: "t1", playerId: "p2", jersey: 12, position: "Shortstop" },
  { id: "tp3", teamId: "t1", playerId: "p3", jersey: 3, position: "1st Base" },
  { id: "tp4", teamId: "t1", playerId: "p4", jersey: 21, position: "Outfield" },
  { id: "tp5", teamId: "t1", playerId: "p5", jersey: 9, position: "Catcher" },
  { id: "tp25", teamId: "t1", playerId: "p16", jersey: 4, position: "Outfield" }, // cross-sport
  // t2 Rio Grande Rollers (kickball)
  { id: "tp6", teamId: "t2", playerId: "p6", jersey: 1, position: "Pitcher" },
  { id: "tp7", teamId: "t2", playerId: "p7", jersey: 14, position: "2nd Base" },
  { id: "tp8", teamId: "t2", playerId: "p8", jersey: 8, position: "Outfield" },
  { id: "tp9", teamId: "t2", playerId: "p9", jersey: 22, position: "Catcher" },
  { id: "tp10", teamId: "t2", playerId: "p10", jersey: 5, position: "Shortstop" },
  // t3 Nob Hill Nomads (kickball)
  { id: "tp11", teamId: "t3", playerId: "p11", jersey: 11, position: "Pitcher" },
  { id: "tp12", teamId: "t3", playerId: "p12", jersey: 6, position: "1st Base" },
  { id: "tp13", teamId: "t3", playerId: "p13", jersey: 24, position: "Outfield" },
  { id: "tp14", teamId: "t3", playerId: "p14", jersey: 17, position: "Catcher" },
  { id: "tp15", teamId: "t3", playerId: "p15", jersey: 2, position: "Shortstop" },
  // t4 Bosque Blitz (flag football)
  { id: "tp16", teamId: "t4", playerId: "p16", jersey: 7, position: "QB" },
  { id: "tp17", teamId: "t4", playerId: "p17", jersey: 80, position: "WR" },
  { id: "tp18", teamId: "t4", playerId: "p18", jersey: 28, position: "RB / WR" },
  { id: "tp19", teamId: "t4", playerId: "p19", jersey: 20, position: "Safety" },
  { id: "tp20", teamId: "t4", playerId: "p20", jersey: 55, position: "Rusher" },
  { id: "tp26", teamId: "t4", playerId: "p1", jersey: 7, position: "WR" }, // cross-sport
  // t5 Mesa Mavericks (flag football)
  { id: "tp21", teamId: "t5", playerId: "p21", jersey: 12, position: "QB" },
  { id: "tp22", teamId: "t5", playerId: "p22", jersey: 81, position: "WR" },
  { id: "tp23", teamId: "t5", playerId: "p23", jersey: 84, position: "WR" },
  { id: "tp24", teamId: "t5", playerId: "p24", jersey: 23, position: "Safety" },
  { id: "tp27", teamId: "t5", playerId: "p25", jersey: 90, position: "Rusher" },
  // t6 Frontier Force (flag football)
  { id: "tp28", teamId: "t6", playerId: "p26", jersey: 9, position: "QB" },
  { id: "tp29", teamId: "t6", playerId: "p27", jersey: 88, position: "WR" },
  { id: "tp30", teamId: "t6", playerId: "p28", jersey: 32, position: "RB / WR" },
  { id: "tp31", teamId: "t6", playerId: "p29", jersey: 25, position: "Safety" },
  { id: "tp32", teamId: "t6", playerId: "p30", jersey: 99, position: "Rusher" },
];

/* ------------------------------- GAMES ----------------------------------- */
// status: 'upcoming' | 'completed' | 'postponed' | 'canceled'.
// periods holds per-inning/per-quarter scores.
// score_status: 'pending' | 'submitted' | 'approved' | 'disputed' | 'final'
// (CLAUDE.md data model) — lives ALONGSIDE status, which is kept as-is.
// 'final' means LOCKED (locked: true, set via the admin Mark Final action);
// editHistory is the mock audit log: { action, timestamp, reason? }.
//
// SEASON-IN-PROGRESS ANCHOR: this mock season is read as if "today" is
// 2026-06-27. Every game dated on/before the anchor is completed (with scores
// + playerStats); every game dated after it is upcoming (pending, no scores).
// Keep this invariant when editing: standings + leaderboards derive from
// completed games only, so a future-dated game must never carry a result.
export const games = [
  // --- Kickball completed ---
  { id: "g1", leagueId: "l1", sport: "kickball", homeTeamId: "t1", awayTeamId: "t2", date: "2026-06-09", time: "6:30 PM", location: "Los Altos Park, Field 2", status: "completed", score_status: "approved", homeScore: 7, awayScore: 4, periods: { home: [2, 0, 1, 3, 1], away: [0, 1, 2, 0, 1] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g2", leagueId: "l1", sport: "kickball", homeTeamId: "t2", awayTeamId: "t3", date: "2026-06-11", time: "7:30 PM", location: "Los Altos Park, Field 1", status: "completed", score_status: "approved", homeScore: 4, awayScore: 6, periods: { home: [1, 2, 0, 1, 0], away: [0, 3, 1, 2, 0] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g3", leagueId: "l1", sport: "kickball", homeTeamId: "t1", awayTeamId: "t3", date: "2026-06-16", time: "6:30 PM", location: "Los Altos Park, Field 2", status: "completed", score_status: "approved", homeScore: 8, awayScore: 5, periods: { home: [3, 1, 2, 0, 2], away: [1, 0, 1, 2, 1] }, tempAdminId: null, locked: false, editHistory: [] },
  // --- Kickball upcoming ---
  { id: "g4", leagueId: "l1", sport: "kickball", homeTeamId: "t2", awayTeamId: "t1", date: "2026-06-30", time: "6:30 PM", location: "Los Altos Park, Field 1", status: "upcoming", score_status: "pending", homeScore: null, awayScore: null, periods: { home: [], away: [] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g5", leagueId: "l1", sport: "kickball", homeTeamId: "t3", awayTeamId: "t1", date: "2026-07-02", time: "7:30 PM", location: "Los Altos Park, Field 2", status: "upcoming", score_status: "pending", homeScore: null, awayScore: null, periods: { home: [], away: [] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g6", leagueId: "l1", sport: "kickball", homeTeamId: "t3", awayTeamId: "t2", date: "2026-07-07", time: "6:30 PM", location: "Los Altos Park, Field 1", status: "upcoming", score_status: "pending", homeScore: null, awayScore: null, periods: { home: [], away: [] }, tempAdminId: null, locked: false, editHistory: [] },
  // --- Flag football completed ---
  { id: "g7", leagueId: "l2", sport: "flag_football", homeTeamId: "t4", awayTeamId: "t5", date: "2026-06-07", time: "8:00 PM", location: "West Mesa Fields, Field A", status: "completed", score_status: "approved", homeScore: 21, awayScore: 14, periods: { home: [7, 6, 0, 8], away: [0, 7, 7, 0] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g8", leagueId: "l2", sport: "flag_football", homeTeamId: "t5", awayTeamId: "t6", date: "2026-06-14", time: "7:00 PM", location: "West Mesa Fields, Field B", status: "completed", score_status: "approved", homeScore: 13, awayScore: 20, periods: { home: [6, 0, 7, 0], away: [7, 7, 0, 6] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g9", leagueId: "l2", sport: "flag_football", homeTeamId: "t4", awayTeamId: "t6", date: "2026-06-21", time: "8:00 PM", location: "West Mesa Fields, Field A", status: "completed", score_status: "approved", homeScore: 21, awayScore: 17, periods: { home: [0, 7, 7, 7], away: [7, 0, 7, 3] }, tempAdminId: null, locked: false, editHistory: [] },
  // --- Flag football upcoming ---
  { id: "g10", leagueId: "l2", sport: "flag_football", homeTeamId: "t5", awayTeamId: "t4", date: "2026-06-28", time: "7:00 PM", location: "West Mesa Fields, Field B", status: "upcoming", score_status: "pending", homeScore: null, awayScore: null, periods: { home: [], away: [] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g11", leagueId: "l2", sport: "flag_football", homeTeamId: "t6", awayTeamId: "t4", date: "2026-07-05", time: "8:00 PM", location: "West Mesa Fields, Field A", status: "upcoming", score_status: "pending", homeScore: null, awayScore: null, periods: { home: [], away: [] }, tempAdminId: null, locked: false, editHistory: [] },
  { id: "g12", leagueId: "l2", sport: "flag_football", homeTeamId: "t6", awayTeamId: "t5", date: "2026-07-12", time: "7:00 PM", location: "West Mesa Fields, Field B", status: "upcoming", score_status: "pending", homeScore: null, awayScore: null, periods: { home: [], away: [] }, tempAdminId: null, locked: false, editHistory: [] },
];

/* ---------------------------- PLAYER_STATS ------------------------------- */
// One row per player per completed game. Missing stat keys default to 0.
const ps = (id, gameId, playerId, teamId, sport, stats) => ({ id, gameId, playerId, teamId, sport, stats });

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
  { id: "fa1", name: "Olivia Naranjo", email: "olivia.n@cvf.demo", phone: "505-555-0201", sports: ["kickball"], experience: "Intermediate", notes: "Played college softball. Looking for a competitive squad.", status: "new", createdDate: "2026-05-28" },
  { id: "fa2", name: "Ben Carrillo", email: "ben.c@cvf.demo", phone: "505-555-0202", sports: ["flag_football"], experience: "Advanced", notes: "Former HS QB. Can also play safety.", status: "new", createdDate: "2026-05-29" },
  { id: "fa3", name: "Hannah Esquibel", email: "hannah.e@cvf.demo", phone: "", sports: ["kickball", "flag_football"], experience: "Beginner", notes: "New to leagues, eager to learn and have fun!", status: "new", createdDate: "2026-05-30" },
  { id: "fa4", name: "Marcus Tenorio", email: "marcus.te@cvf.demo", phone: "505-555-0204", sports: ["flag_football"], experience: "Intermediate", notes: "Speedy receiver, available weeknights.", status: "new", createdDate: "2026-06-01" },
  { id: "fa5", name: "Gabriela Rael", email: "gabriela.r@cvf.demo", phone: "505-555-0205", sports: ["kickball"], experience: "Advanced", notes: "Big bat, plays anywhere in the field.", status: "new", createdDate: "2026-06-02" },
  { id: "fa6", name: "Tyler Madrid", email: "tyler.ma@cvf.demo", phone: "505-555-0206", sports: ["kickball", "flag_football"], experience: "Intermediate", notes: "Two-sport guy looking to stay busy this summer.", status: "new", createdDate: "2026-06-03" },
  { id: "fa7", name: "Sophia Lucero", email: "sophia.l@cvf.demo", phone: "", sports: ["kickball"], experience: "Beginner", notes: "Just moved to ABQ, want to meet people.", status: "new", createdDate: "2026-06-04" },
  { id: "fa8", name: "Andrew Sena", email: "andrew.s@cvf.demo", phone: "505-555-0208", sports: ["flag_football"], experience: "Advanced", notes: "Pass rusher / edge. Played 4 seasons of flag.", status: "new", createdDate: "2026-06-05" },
];

/* ---------------------------- REGISTRATIONS ------------------------------ */
export const registrations = [
  { id: "reg1", teamName: "Westside Warriors", sport: "kickball", captainName: "Felix Ortega", captainEmail: "felix.o@cvf.demo", captainPhone: "505-555-0301", roster: [{ name: "Felix Ortega", email: "felix.o@cvf.demo" }, { name: "Dana Roybal", email: "dana.r@cvf.demo" }, { name: "Marco Silva", email: "marco.s@cvf.demo" }, { name: "Lena Trujillo", email: "lena.t@cvf.demo" }, { name: "Ray Gonzales", email: "ray.g@cvf.demo" }], status: "new", submittedDate: "2026-06-04" },
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
  { id: "w1", profileId: "p1", signed_name: "Marcus Trujillo", email: "marcus.t@cvf.demo", phone: "505-555-0101", signed_at: "2026-06-05T17:42:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "174.56.20.18", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", verification_status: "verified" },
  { id: "w2", profileId: "p6", signed_name: "Jessica Martinez", email: "jess.m@cvf.demo", phone: "505-555-0106", signed_at: "2026-06-05T19:03:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "98.60.142.77", user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", verification_status: "verified" },
  { id: "w3", profileId: "p4", signed_name: "Tyler Romero", email: "tyler.r@cvf.demo", phone: "505-555-0104", signed_at: "2026-06-06T15:11:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: false, ip_address: "70.171.33.204", user_agent: "Mozilla/5.0 (Linux; Android 14)", verification_status: "duplicate" },
  { id: "w4", profileId: "p4", signed_name: "Tyler J. Romero", email: "tyler.r@cvf.demo", phone: "505-555-0104", signed_at: "2026-06-08T20:27:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "70.171.33.204", user_agent: "Mozilla/5.0 (Linux; Android 14)", verification_status: "pending" },
  { id: "w5", profileId: "p8", signed_name: "C. Vigil", email: "crystal.v@cvf.demo", phone: "505-555-0108", signed_at: "2026-06-07T16:48:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: false, media_consent: false, ip_address: "166.70.21.9", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)", verification_status: "rejected" },
  { id: "w6", profileId: null, signed_name: "Olivia Naranjo", email: "olivia.n@cvf.demo", phone: "505-555-0201", signed_at: "2026-06-09T18:35:00Z", waiver_version: WAIVER_VERSION, accepted_terms: true, age_confirmed: true, media_consent: true, ip_address: "97.123.88.40", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", verification_status: "pending" },
];

/* ------------------------------ SETTINGS --------------------------------- */
export const settings = {
  currentSeason: CURRENT_SEASON,
  registrationOpen: { kickball: true, flag_football: false },
};

/* Assemble the initial shared state object. */
export const initialState = {
  profiles,
  leagues,
  teams,
  teamPlayers,
  games,
  playerStats,
  careerBaselines,
  freeAgents,
  registrations,
  waivers,
  settings,
};
