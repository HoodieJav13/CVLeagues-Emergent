/* ============================================================================
 * GAME TIME — one place that knows how a game's start is stored and displayed.
 * ----------------------------------------------------------------------------
 * Since migration 28 a game carries a single `starts_at` timestamptz. The old
 * `date` column plus `time` display string ('6:30 PM') are gone: a display
 * string cannot be ordered within a day, cannot produce a calendar invite, and
 * carries no zone.
 *
 * Everything renders in the LEAGUE's zone, not the viewer's. A player checking
 * the schedule from another state should see the kickoff time they will
 * actually turn up for, not that instant shifted into wherever their phone is.
 * ========================================================================== */

export const LEAGUE_TIME_ZONE = "America/Denver";

export const gameStart = (game) => (game?.starts_at ? new Date(game.starts_at) : null);

// Millisecond value for sorting/comparison. Games missing a start sort last.
export const gameStartValue = (game) => {
  const start = gameStart(game);
  return start ? start.getTime() : Number.POSITIVE_INFINITY;
};

export const byStartAscending = (a, b) => gameStartValue(a) - gameStartValue(b);
export const byStartDescending = (a, b) => gameStartValue(b) - gameStartValue(a);

const format = (game, options) => {
  const start = gameStart(game);
  if (!start) return "";
  return start.toLocaleString("en-US", { timeZone: LEAGUE_TIME_ZONE, ...options });
};

// "Mon, Jun 9"
export const formatGameDate = (game) =>
  format(game, { weekday: "short", month: "short", day: "numeric" });

// "Jun 9"
export const formatGameShortDate = (game) =>
  format(game, { month: "short", day: "numeric" });

// "Monday, June 9, 2026"
export const formatGameLongDate = (game) =>
  format(game, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// "6:30 PM"
export const formatGameTime = (game) =>
  format(game, { hour: "numeric", minute: "2-digit" });

// "Jun 9 · 6:30 PM" — the compact admin/register pairing.
export const formatGameDateTime = (game) =>
  [formatGameShortDate(game), formatGameTime(game)].filter(Boolean).join(" · ");

// Calendar date in the LEAGUE's zone as YYYY-MM-DD. Used for week grouping and
// for `datetime` attributes; deriving this from the viewer's zone would put a
// late game in the wrong week for anyone east of Albuquerque.
export const gameDateKey = (game) => {
  const start = gameStart(game);
  if (!start) return "";
  // en-CA formats as YYYY-MM-DD, which is what we want and is stable.
  return start.toLocaleDateString("en-CA", { timeZone: LEAGUE_TIME_ZONE });
};

// Sunday-start week key for schedule grouping, computed on the league-zone date.
export const gameWeekKey = (game) => {
  const key = gameDateKey(game);
  if (!key) return "";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
};

export const formatWeekLabel = (weekKey) => {
  if (!weekKey) return "";
  const [year, month, day] = weekKey.split("-").map(Number);
  return `Week of ${new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  })}`;
};

/* ------------------------------- venues ---------------------------------- */
export const getVenue = (state, venue_id) =>
  (state?.venues || []).find((venue) => venue.id === venue_id) || null;

// Display label for where a game is played. Falls back to the raw id only if a
// venue row is genuinely missing, so a broken reference is visible.
export const venueLabel = (state, game) => {
  const venue = getVenue(state, game?.venue_id);
  if (!venue) return game?.venue_id ? "Unknown venue" : "";
  return [venue.name, venue.field_label].filter(Boolean).join(" · ");
};

// Value for an <input type="datetime-local">, expressed in league time so the
// admin edits the same clock face that everyone else reads.
export const toDateTimeLocalValue = (starts_at) => {
  if (!starts_at) return "";
  const date = new Date(starts_at);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  // Intl can emit hour "24" at midnight; normalise it.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
};

// Inverse of the above: a datetime-local string is league-local wall time, so
// resolve it against the league zone rather than the browser's.
export function fromDateTimeLocalValue(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  // Start from the UTC interpretation, then correct by the zone's offset at
  // that moment. Two passes settle daylight-saving boundaries correctly.
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i += 1) {
    const asZoned = new Date(guess).toLocaleString("en-US", { timeZone: LEAGUE_TIME_ZONE });
    const drift = new Date(asZoned).getTime() - guess;
    guess -= drift;
  }
  return new Date(guess).toISOString();
}
