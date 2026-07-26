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

/* ============================================================================
 * DERIVED STATS — rate and composite figures computed FROM the counting stats
 * above. Never stored; like everything in selectors.js they are recomputed so a
 * single corrected game propagates everywhere.
 *
 * A derived stat with `needsGamesPlayed` cannot be computed until participation
 * data exists (a player with no stat row still played). Until then `compute`
 * returns null and the UI renders an em dash rather than a wrong number.
 * ========================================================================== */

// Sentinel for "this figure needs a games-played denominator we may not have".
export const GAMES_PLAYED_KEY = "gamesPlayed";

const ratio = (numerator, denominator) =>
  denominator > 0 ? numerator / denominator : null;

// Per-game figures share one guard: no participation data => no figure.
const perGame = (statKey) => ({ totals, gamesPlayed }) =>
  gamesPlayed == null ? null : ratio(totals[statKey] || 0, gamesPlayed);

const kickballHits = (t) =>
  (t.singles || 0) + (t.doubles || 0) + (t.triples || 0) + (t.homeRuns || 0);

export const DERIVED_STATS = {
  kickball: [
    {
      key: "hits",
      label: "Hits",
      group: "Offense",
      format: "count",
      qualifier: null,
      compute: ({ totals }) => kickballHits(totals),
    },
    {
      key: "kickAverage",
      label: "Kick Average",
      group: "Offense",
      format: "ratio",
      precision: 3,
      qualifier: { key: "kicks", min: 10 },
      compute: ({ totals }) => ratio(kickballHits(totals), totals.kicks || 0),
    },
    {
      key: "sluggingPct",
      label: "Slugging",
      group: "Offense",
      format: "ratio",
      precision: 3,
      qualifier: { key: "kicks", min: 10 },
      compute: ({ totals }) => ratio(
        (totals.singles || 0) + 2 * (totals.doubles || 0) + 3 * (totals.triples || 0) + 4 * (totals.homeRuns || 0),
        totals.kicks || 0
      ),
    },
    {
      key: "fieldingPct",
      label: "Fielding",
      group: "Defense",
      format: "ratio",
      precision: 3,
      qualifier: { key: "outs", min: 5 },
      compute: ({ totals }) => {
        const chances = (totals.outs || 0) + (totals.assists || 0) + (totals.errors || 0);
        return ratio((totals.outs || 0) + (totals.assists || 0), chances);
      },
    },
    {
      key: "runsPerGame",
      label: "Runs / Game",
      group: "Offense",
      format: "decimal",
      precision: 1,
      needsGamesPlayed: true,
      compute: perGame("runs"),
    },
    {
      key: "rbisPerGame",
      label: "RBIs / Game",
      group: "Offense",
      format: "decimal",
      precision: 1,
      needsGamesPlayed: true,
      compute: perGame("rbis"),
    },
  ],
  flag_football: [
    {
      key: "completionPct",
      label: "Completion %",
      group: "Passing",
      format: "percent",
      precision: 1,
      qualifier: { key: "attempts", min: 20 },
      compute: ({ totals }) => ratio(totals.completions || 0, totals.attempts || 0),
    },
    {
      key: "yardsPerAttempt",
      label: "Yards / Attempt",
      group: "Passing",
      format: "decimal",
      precision: 1,
      qualifier: { key: "attempts", min: 20 },
      compute: ({ totals }) => ratio(totals.passYards || 0, totals.attempts || 0),
    },
    {
      key: "yardsPerCatch",
      label: "Yards / Catch",
      group: "Receiving",
      format: "decimal",
      precision: 1,
      qualifier: { key: "catches", min: 10 },
      compute: ({ totals }) => ratio(totals.recYards || 0, totals.catches || 0),
    },
    {
      key: "yardsPerCarry",
      label: "Yards / Carry",
      group: "Rushing",
      format: "decimal",
      precision: 1,
      qualifier: { key: "carries", min: 10 },
      compute: ({ totals }) => ratio(totals.rushYards || 0, totals.carries || 0),
    },
    {
      key: "scrimmageYards",
      label: "Scrimmage Yards",
      group: "Rushing",
      format: "count",
      qualifier: null,
      compute: ({ totals }) => (totals.rushYards || 0) + (totals.recYards || 0),
    },
    {
      key: "passYardsPerGame",
      label: "Pass Yards / Game",
      group: "Passing",
      format: "decimal",
      precision: 1,
      needsGamesPlayed: true,
      compute: perGame("passYards"),
    },
    {
      key: "scrimmageYardsPerGame",
      label: "Scrimmage Yds / Game",
      group: "Rushing",
      format: "decimal",
      precision: 1,
      needsGamesPlayed: true,
      compute: ({ totals, gamesPlayed }) =>
        gamesPlayed == null ? null : ratio((totals.rushYards || 0) + (totals.recYards || 0), gamesPlayed),
    },
  ],
};

export const derivedStat = (sport, key) =>
  (DERIVED_STATS[sport] || []).find((stat) => stat.key === key) || null;

export const isDerivedStat = (sport, key) => Boolean(derivedStat(sport, key));

// Compute one derived stat. Returns null when the figure is not yet knowable —
// missing participation data, or a zero denominator — never a misleading 0.
export function computeDerivedStat(sport, key, totals, { gamesPlayed = null } = {}) {
  const stat = derivedStat(sport, key);
  if (!stat) return null;
  if (stat.needsGamesPlayed && gamesPlayed == null) return null;
  return stat.compute({ totals: totals || {}, gamesPlayed });
}

// Whether a player's totals clear a derived stat's leaderboard qualifier.
export function meetsQualifier(sport, key, totals, { gamesPlayed = null } = {}) {
  const stat = derivedStat(sport, key);
  if (!stat?.qualifier) return true;
  const { key: qualifierKey, min } = stat.qualifier;
  const observed = qualifierKey === GAMES_PLAYED_KEY ? gamesPlayed : (totals || {})[qualifierKey];
  if (observed == null) return false;
  return observed >= min;
}

// Display string for a derived value. null renders as an em dash everywhere so
// "not yet knowable" never reads as zero.
export function formatDerivedStat(sport, key, value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const stat = derivedStat(sport, key);
  if (!stat) return String(value);
  if (stat.format === "count") return String(Math.round(value));
  if (stat.format === "percent") return `${(value * 100).toFixed(stat.precision ?? 1)}%`;
  if (stat.format === "ratio") {
    const text = value.toFixed(stat.precision ?? 3);
    // Baseball-style leading-zero strip, but only below 1.000.
    return value < 1 ? text.replace(/^0/, "") : text;
  }
  return value.toFixed(stat.precision ?? 1);
}

// Label lookup that spans both counting and derived stats.
export const anyStatLabel = (sport, key) => derivedStat(sport, key)?.label || statLabel(sport, key);

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
export { SPORTS } from "../data/sports.js";
