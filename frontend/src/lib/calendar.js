/* ============================================================================
 * CALENDAR EXPORT — RFC 5545 (iCalendar) generation.
 * ----------------------------------------------------------------------------
 * Built on migration 28's `games.starts_at`. This was impossible before it: a
 * calendar event needs an actual instant, and the old schema stored a date plus
 * the display string '6:30 PM', which is not one.
 *
 * All timestamps are emitted in UTC (the trailing Z form) rather than with a
 * VTIMEZONE block. UTC is unambiguous, every client resolves it to the reader's
 * own zone correctly, and it avoids shipping a timezone database we would then
 * have to keep current.
 * ========================================================================== */

import { gameStart, venueLabel, getVenue } from "./gameTime.js";
import { getTeam } from "./selectors.js";
import { sportName } from "./statsConfig.js";

const PRODID = "-//CVF Sports//Leagues//EN";

// How long to block out on someone's calendar. Rec games run to a time cap far
// more often than to a natural finish, so these are the scheduled slot lengths.
const DURATION_MINUTES = { kickball: 60, flag_football: 75 };
const DEFAULT_DURATION_MINUTES = 60;

export const gameDurationMinutes = (sport) => DURATION_MINUTES[sport] || DEFAULT_DURATION_MINUTES;

// Default reminder lead time. Two hours is enough to leave work, eat, and get
// across town to a field — a fifteen-minute warning is useless for a game you
// have to travel to.
export const DEFAULT_REMINDER_MINUTES = 120;

// RFC 5545 §3.3.6 duration, negative because the trigger fires BEFORE the start.
export function reminderTrigger(minutes) {
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`;
  return `-PT${minutes}M`;
}

// RFC 5545 §3.3.11: backslash, semicolon and comma are escaped, and newlines
// become a literal \n. Order matters — backslashes must be escaped first or the
// escapes we add would themselves be escaped.
export function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// UTF-8 byte length of a single code point. Computed directly rather than via
// TextEncoder, which is not present in every test environment and would be an
// avoidable dependency for arithmetic this simple.
export function utf8Length(text) {
  let bytes = 0;
  for (const character of Array.from(text)) {
    const code = character.codePointAt(0);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

// RFC 5545 §3.1: lines are folded at 75 OCTETS, not characters. Multi-byte
// characters must not be split across a fold, so this measures in UTF-8 bytes
// and breaks on character boundaries.
export function foldLine(line) {
  if (utf8Length(line) <= 75) return line;

  const parts = [];
  let current = "";
  let currentBytes = 0;
  // A continuation line starts with one space, which counts toward its 75.
  let limit = 75;

  for (const character of Array.from(line)) {
    const size = utf8Length(character);
    if (currentBytes + size > limit) {
      parts.push(current);
      current = character;
      currentBytes = size;
      limit = 74;
    } else {
      current += character;
      currentBytes += size;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

// iCalendar UTC form: 20260609T183000Z
export function toIcsUtc(date) {
  const pad = (value, width = 2) => String(value).padStart(width, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

// A stable UID matters: re-importing an updated feed must UPDATE the existing
// event rather than create a duplicate. The game id is already stable and
// unique, so it is the natural basis.
export const gameUid = (game) => `cvf-game-${game.id}@cvfsports`;

const summaryFor = (state, game) => {
  const home = getTeam(state, game.home_team_id)?.name || "TBD";
  const away = getTeam(state, game.away_team_id)?.name || "TBD";
  return `${away} @ ${home}`;
};

// LOCATION prefers the venue's street address, because that is what a phone can
// actually navigate to. The venue name is kept alongside it for readability.
const locationFor = (state, game) => {
  const venue = getVenue(state, game.venue_id);
  if (!venue) return venueLabel(state, game);
  return [venueLabel(state, game), venue.address].filter(Boolean).join(", ");
};

const descriptionFor = (state, game, { origin }) => {
  const lines = [sportName(game.sport)];
  if (game.stage && game.stage !== "regular") {
    lines.push(`${game.stage === "playoff" ? "Playoff" : "Tournament"} game`);
  }
  if (origin) lines.push(`${origin}/game/${game.id}`);
  return lines.join("\n");
};

/**
 * One VEVENT for one game. Returns null when the game has no usable start,
 * so a malformed row is skipped rather than emitting a broken calendar.
 */
export function buildGameEvent(state, game, {
  origin = "",
  now = new Date(),
  reminderMinutes = DEFAULT_REMINDER_MINUTES,
} = {}) {
  const start = gameStart(game);
  if (!start || Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + gameDurationMinutes(game.sport) * 60000);
  const canceled = game.status === "canceled";

  const fields = [
    ["BEGIN", "VEVENT"],
    ["UID", gameUid(game)],
    ["DTSTAMP", toIcsUtc(now)],
    ["DTSTART", toIcsUtc(start)],
    ["DTEND", toIcsUtc(end)],
    ["SUMMARY", escapeText(summaryFor(state, game))],
    ["LOCATION", escapeText(locationFor(state, game))],
    ["DESCRIPTION", escapeText(descriptionFor(state, game, { origin }))],
    // A canceled game keeps its UID and flips to CANCELLED so subscribers see
    // it disappear, rather than silently retaining a stale event.
    ["STATUS", canceled ? "CANCELLED" : "CONFIRMED"],
    ["END", "VEVENT"],
  ];
  if (origin) fields.splice(fields.length - 2, 0, ["URL", `${origin}/game/${game.id}`]);

  // A reminder is the difference between the game being ON a calendar and the
  // calendar actually telling someone about it. Deliberately omitted for a
  // canceled game: nudging a player toward a game that is not happening is
  // worse than no nudge at all.
  if (reminderMinutes != null && reminderMinutes > 0 && !canceled) {
    fields.splice(fields.length - 1, 0,
      ["BEGIN", "VALARM"],
      // DISPLAY is the action Apple, Google and Outlook all honour.
      ["ACTION", "DISPLAY"],
      ["DESCRIPTION", escapeText(summaryFor(state, game))],
      ["TRIGGER", reminderTrigger(reminderMinutes)],
      ["END", "VALARM"],
    );
  }

  return fields.map(([name, value]) => foldLine(`${name}:${value}`));
}

/**
 * A complete VCALENDAR for a set of games.
 *
 * `name` becomes the calendar's display name in clients that honour it. Lines
 * are joined with CRLF because RFC 5545 requires it — LF-only files are
 * rejected outright by some clients.
 */
export function buildCalendar(state, games, {
  name = "CVF Sports",
  origin = "",
  now = new Date(),
  reminderMinutes = DEFAULT_REMINDER_MINUTES,
} = {}) {
  const events = (games || [])
    .map((game) => buildGameEvent(state, game, { origin, now, reminderMinutes }))
    .filter(Boolean)
    .flat();

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeText(name)}`),
    // Ask subscribing clients to refresh roughly twice a day; schedules change
    // rarely enough that anything more frequent is wasted traffic.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

// Filesystem-safe, lowercase, no runs of separators.
export const calendarFilename = (label) =>
  `${String(label || "cvf-schedule")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cvf-schedule"}.ics`;

/**
 * Triggers a download of the given calendar text. Kept here so callers never
 * have to think about object URLs or revoking them.
 */
export function downloadCalendar(text, label) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = calendarFilename(label);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking immediately can race the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
