/* ============================================================================
 * STAT CONFIGURATION — defines stat categories, labels, groupings per sport,
 * and which stats are used for leaderboards. Drives the dynamic stat-entry
 * forms and leaderboard category dropdowns.
 * ========================================================================== */

// Grouped stat definitions used by the per-player score entry form & profile.
export const STAT_GROUPS = {
  kickball: [
    {
      group: "Offense",
      stats: [
        { key: "kicks", label: "Kicks" },
        { key: "singles", label: "Singles" },
        { key: "doubles", label: "Doubles" },
        { key: "triples", label: "Triples" },
        { key: "homeRuns", label: "Home Runs" },
        { key: "rbis", label: "RBIs" },
        { key: "runs", label: "Runs Scored" },
        { key: "walks", label: "Walks" },
        { key: "strikeouts", label: "Strikeouts" },
      ],
    },
    {
      group: "Defense",
      stats: [
        { key: "outs", label: "Outs Recorded" },
        { key: "assists", label: "Assists" },
        { key: "errors", label: "Errors" },
      ],
    },
  ],
  flag_football: [
    {
      group: "Passing",
      stats: [
        { key: "completions", label: "Completions" },
        { key: "attempts", label: "Attempts" },
        { key: "passYards", label: "Pass Yards" },
        { key: "passTDs", label: "Pass TDs" },
        { key: "ints", label: "INTs Thrown" },
      ],
    },
    {
      group: "Rushing",
      stats: [
        { key: "carries", label: "Carries" },
        { key: "rushYards", label: "Rush Yards" },
        { key: "rushTDs", label: "Rush TDs" },
        { key: "rushFirstDowns", label: "1st Downs" },
      ],
    },
    {
      group: "Receiving",
      stats: [
        { key: "catches", label: "Catches" },
        { key: "recYards", label: "Rec Yards" },
        { key: "recTDs", label: "Rec TDs" },
        { key: "recFirstDowns", label: "1st Downs" },
      ],
    },
    {
      group: "Defense",
      stats: [
        { key: "flagPulls", label: "Flag Pulls" },
        { key: "sacks", label: "Sacks" },
        { key: "defInts", label: "INTs" },
        { key: "safeties", label: "Safeties" },
      ],
    },
    {
      group: "Scoring",
      stats: [
        { key: "tds", label: "Total TDs" },
        { key: "onePoint", label: "1-pt Conv" },
        { key: "twoPoint", label: "2-pt Conv" },
        { key: "threePoint", label: "3-pt Conv" },
      ],
    },
  ],
};

// Flat list of all stat keys for a sport (used to build zeroed stat objects).
export const allStatKeys = (sport) =>
  STAT_GROUPS[sport].flatMap((g) => g.stats.map((s) => s.key));

// Human label lookup for a stat key.
export const statLabel = (sport, key) => {
  for (const g of STAT_GROUPS[sport]) {
    const found = g.stats.find((s) => s.key === key);
    if (found) return found.label;
  }
  return key;
};

// Leaderboard categories (subset of stats that make compelling leaderboards).
export const LEADERBOARD_CATEGORIES = {
  kickball: [
    { key: "homeRuns", label: "Home Runs" },
    { key: "rbis", label: "RBIs" },
    { key: "runs", label: "Runs Scored" },
    { key: "singles", label: "Singles" },
    { key: "doubles", label: "Doubles" },
    { key: "outs", label: "Outs Recorded" },
  ],
  flag_football: [
    { key: "passYards", label: "Passing Yards" },
    { key: "passTDs", label: "Passing TDs" },
    { key: "rushYards", label: "Rushing Yards" },
    { key: "recYards", label: "Receiving Yards" },
    { key: "recTDs", label: "Receiving TDs" },
    { key: "flagPulls", label: "Flag Pulls" },
    { key: "sacks", label: "Sacks" },
    { key: "defInts", label: "Interceptions" },
  ],
};

// Highlight stats shown on profile / team stat-leader cards.
export const HIGHLIGHT_STATS = {
  kickball: ["homeRuns", "rbis", "runs"],
  flag_football: ["passYards", "recYards", "flagPulls"],
};

export const sportName = (sport) =>
  sport === "kickball" ? "Kickball" : "Flag Football";

// Sports are runtime configuration, not demo fixtures, so production can use
// this list without pulling the development seed into its JavaScript bundle.
export { SPORTS } from "../data/sports";
