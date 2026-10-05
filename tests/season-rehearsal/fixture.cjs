// CVF Season 1 rehearsal fixture — ONE reusable, wholly fictional season.
// Every person, team, and contact below is invented: emails use the reserved
// example.test domain and phones the fictional 505-555-01xx range. Nothing
// here may be entered into a hosted project (see README.md).
//
// The same fixture drives both proofs:
//   rehearsal.spec.js  — local mock mode, through the real admin/public UI
//   rehearsal.sql      — a disposable local Postgres with all 30 migrations
// Stable ids (rh-*) are used where the surface lets the caller choose them;
// UI-created rows get generated ids that the spec resolves by name.

const SEASON = "Rehearsal 2027";

const LEAGUES = {
  kickball: { key: "kb", name: "Rehearsal Kickball League", sport: "kickball" },
  flag_football: { key: "ff", name: "Rehearsal Flag League", sport: "flag_football" },
};

const VENUE = { name: "Mesa Vista Rehearsal Park", field_label: "Field R1", address: "100 Fictional Way NE" };

// Intake: two Team Interest submissions become teams through admin approval;
// two Free Agent submissions are assigned onto directly created teams.
const REGISTRATIONS = [
  { team_name: "Petroglyph Punters", sport: "kickball", captain_name: "Rhea Testwell", captain_email: "rhea.testwell@example.test", captain_phone: "505-555-0141", roster: 3 },
  { team_name: "Turquoise Trail Flaggers", sport: "flag_football", captain_name: "Omar Placeholder", captain_email: "omar.placeholder@example.test", captain_phone: "505-555-0142", roster: 3 },
];
const FREE_AGENTS = [
  { first_name: "Fiona", last_name: "Freeagent", email: "fiona.freeagent@example.test", phone: "505-555-0151", sport: "kickball", assign_to: "Juniper Jacks" },
  { first_name: "Felix", last_name: "Freeagent", email: "felix.freeagent@example.test", phone: "505-555-0152", sport: "flag_football", assign_to: "Bluebird Blitz" },
];
const DIRECT_TEAMS = [
  { name: "Volcano Vista Kicks", sport: "kickball" },
  { name: "Arroyo Alley Cats", sport: "kickball" },
  { name: "Juniper Jacks", sport: "kickball" },
  { name: "Sandstone Sprinters", sport: "flag_football" },
  { name: "Bluebird Blitz", sport: "flag_football" },
];

// Add Player records (first, last, team, jersey). Captains/free agents above
// complete each roster to three.
const PLAYERS = [
  ["Pia", "Pendleton", "Petroglyph Punters", 7], ["Quinn", "Quarry", "Petroglyph Punters", 11],
  ["Vera", "Vantage", "Volcano Vista Kicks", 3], ["Wes", "Windmill", "Volcano Vista Kicks", 8], ["Xena", "Xeric", "Volcano Vista Kicks", 21],
  ["Ada", "Arroyo", "Arroyo Alley Cats", 2], ["Bo", "Bramble", "Arroyo Alley Cats", 5], ["Cy", "Cholla", "Arroyo Alley Cats", 9],
  ["Juno", "Juniper", "Juniper Jacks", 4], ["Kit", "Kestrel", "Juniper Jacks", 10],
  ["Tess", "Trailhead", "Turquoise Trail Flaggers", 12], ["Uri", "Upland", "Turquoise Trail Flaggers", 80],
  ["Sam", "Sandstone", "Sandstone Sprinters", 1], ["Rio", "Redrock", "Sandstone Sprinters", 88], ["Lu", "Ledge", "Sandstone Sprinters", 24],
  ["Bree", "Bluebird", "Bluebird Blitz", 9], ["Cal", "Canyon", "Bluebird Blitz", 15],
];

// Players whose eligibility the admin marks verified (informational only).
const VERIFIED = ["Pia Pendleton", "Vera Vantage", "Sam Sandstone"];

// Schedule. Times are America/Denver; KG5 is the lone day game (sun mark).
// Scores are the FINAL truth after the correction; KG2 is first entered wrong.
const GAMES = [
  { id: "rh-kg1", sport: "kickball", away: "Volcano Vista Kicks", home: "Petroglyph Punters", starts_at: "2026-09-01T18:30:00-06:00", away_innings: [0, 1, 0, 2, 0], home_innings: [2, 0, 1, 0, 2] },
  { id: "rh-kg2", sport: "kickball", away: "Juniper Jacks", home: "Arroyo Alley Cats", starts_at: "2026-09-01T19:45:00-06:00",
    entered: { away_innings: [0, 0, 1, 0, 1], home_innings: [1, 1, 0, 2, 0] },
    away_innings: [0, 0, 1, 0, 4], home_innings: [1, 1, 0, 2, 0],
    correction_reason: "Scorer transposed the Jacks' four-run fifth inning; confirmed with both captains." },
  { id: "rh-kg3", sport: "kickball", away: "Arroyo Alley Cats", home: "Petroglyph Punters", starts_at: "2026-09-08T18:30:00-06:00", away_innings: [0, 1, 0, 0, 0], home_innings: [3, 0, 2, 0, 1],
    // Two Punters runs came from a substitute who is not rostered, so player
    // runs (4) intentionally disagree with the score (6): a SOFT warning.
    override_reason: "Two runs scored by an unrostered substitute; stats recorded for rostered players only." },
  { id: "rh-kg4", sport: "kickball", away: "Juniper Jacks", home: "Volcano Vista Kicks", starts_at: "2026-09-08T19:45:00-06:00", away_innings: [1, 0, 2, 1, 0], home_innings: [0, 3, 0, 1, 2] },
  { id: "rh-kg5", sport: "kickball", away: "Petroglyph Punters", home: "Juniper Jacks", starts_at: "2026-09-13T10:00:00-06:00", away_innings: [1, 0, 0, 1, 0], home_innings: [0, 2, 0, 0, 1] },
  { id: "rh-kg6", sport: "kickball", away: "Volcano Vista Kicks", home: "Arroyo Alley Cats", starts_at: "2026-10-13T18:30:00-06:00", upcoming: true,
    // Attempted, blocked: kickball ties are a HARD rule (INV-08).
    tie_attempt: { away_innings: [1, 0, 0, 0, 2], home_innings: [0, 3, 0, 0, 0] } },
  { id: "rh-kg7", sport: "kickball", away: "Arroyo Alley Cats", home: "Juniper Jacks", starts_at: "2026-09-15T18:30:00-06:00", postpone: true },
  { id: "rh-fg1", sport: "flag_football", away: "Sandstone Sprinters", home: "Turquoise Trail Flaggers", starts_at: "2026-09-06T18:00:00-06:00", away_quarters: [7, 7, 0, 7], home_quarters: [0, 7, 7, 0] },
  { id: "rh-fg2", sport: "flag_football", away: "Bluebird Blitz", home: "Sandstone Sprinters", starts_at: "2026-09-13T18:00:00-06:00", away_quarters: [0, 7, 0, 0], home_quarters: [7, 7, 7, 7] },
  { id: "rh-fg3", sport: "flag_football", away: "Turquoise Trail Flaggers", home: "Bluebird Blitz", starts_at: "2026-10-11T18:00:00-06:00", upcoming: true },
];

// Kickball stat lines: [first last, {stats}] per game. Runs sum to the team
// score except KG3's deliberate SOFT case.
const KB = (kicks, singles, runs, rbis, extra = {}) => ({ kicks, singles, runs, rbis, ...extra });
const KICKBALL_STATS = {
  "rh-kg1": [["Vera Vantage", KB(4, 2, 2, 1)], ["Wes Windmill", KB(3, 1, 1, 2)], ["Rhea Testwell", KB(4, 3, 3, 2, { doubles: 1 })], ["Pia Pendleton", KB(4, 2, 2, 3)]],
  "rh-kg2": [["Juno Juniper", KB(4, 3, 3, 2, { homeRuns: 1 })], ["Kit Kestrel", KB(3, 2, 2, 3)], ["Ada Arroyo", KB(4, 2, 2, 2)], ["Bo Bramble", KB(3, 2, 2, 2, { outs: 4 })]],
  "rh-kg3": [["Cy Cholla", KB(3, 1, 1, 1)], ["Rhea Testwell", KB(4, 2, 2, 2)], ["Quinn Quarry", KB(4, 2, 2, 2)]],
  "rh-kg4": [["Juno Juniper", KB(4, 2, 2, 2)], ["Fiona Freeagent", KB(3, 2, 2, 2)], ["Xena Xeric", KB(5, 4, 4, 3, { homeRuns: 2 })], ["Vera Vantage", KB(4, 2, 2, 3)]],
  "rh-kg5": [["Pia Pendleton", KB(4, 2, 2, 2)], ["Kit Kestrel", KB(4, 3, 3, 3, { triples: 1 })]],
};
// KG2 as first (wrongly) entered: Jacks' 5th-inning runs missing.
KICKBALL_STATS["rh-kg2-entered"] = [["Juno Juniper", KB(4, 2, 1, 1)], ["Kit Kestrel", KB(3, 1, 1, 1)], ["Ada Arroyo", KB(4, 2, 2, 2)], ["Bo Bramble", KB(3, 2, 2, 2, { outs: 4 })]];

// Flag football: every TD is a 7 (TD + 1-pt). Pass/catch pairs reconcile
// within a team so INV-07 stays quiet.
const FLAG_STATS = {
  "rh-fg1": [
    ["Sam Sandstone", { completions: 12, attempts: 18, passYards: 165, passTDs: 2 }],
    ["Rio Redrock", { catches: 8, recYards: 120, recTDs: 2, tds: 2, onePoint: 2 }],
    ["Lu Ledge", { catches: 4, recYards: 45, carries: 6, rushYards: 38, rushTDs: 1, tds: 1, onePoint: 1 }],
    ["Omar Placeholder", { completions: 9, attempts: 20, passYards: 110, passTDs: 2 }],
    ["Uri Upland", { catches: 9, recYards: 110, recTDs: 2, tds: 2, onePoint: 2 }],
    ["Tess Trailhead", { flagPulls: 6, sacks: 1 }],
  ],
  "rh-fg2": [
    ["Bree Bluebird", { completions: 7, attempts: 15, passYards: 70, passTDs: 1, ints: 2 }],
    ["Felix Freeagent", { catches: 7, recYards: 70, recTDs: 1, tds: 1, onePoint: 1 }],
    ["Sam Sandstone", { completions: 15, attempts: 22, passYards: 240, passTDs: 3 }],
    ["Rio Redrock", { catches: 10, recYards: 180, recTDs: 2, tds: 2, onePoint: 2, defInts: 1 }],
    ["Lu Ledge", { catches: 5, recYards: 60, recTDs: 1, carries: 4, rushYards: -3, rushTDs: 1, tds: 2, onePoint: 2, defInts: 1 }],
  ],
};

// Expected league tables once every score (and the KG2 correction) lands.
// Punters and Jacks are both 2-1; the order between them is whatever the
// app's documented tiebreak says — the spec records it rather than assuming.
const EXPECTED = {
  kickball: { "Petroglyph Punters": [2, 1], "Juniper Jacks": [2, 1], "Volcano Vista Kicks": [1, 1], "Arroyo Alley Cats": [0, 2] },
  flag_football: { "Sandstone Sprinters": [2, 0], "Turquoise Trail Flaggers": [0, 1], "Bluebird Blitz": [0, 1] },
};

module.exports = { SEASON, LEAGUES, VENUE, REGISTRATIONS, FREE_AGENTS, DIRECT_TEAMS, PLAYERS, VERIFIED, GAMES, KICKBALL_STATS, FLAG_STATS, EXPECTED };
