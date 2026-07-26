/* ============================================================================
 * iCalendar generation.
 *
 * These assertions encode the parts of RFC 5545 that clients actually reject
 * files over: CRLF line endings, 75-OCTET folding, text escaping, and stable
 * UIDs so a refreshed subscription updates events instead of duplicating them.
 * ========================================================================== */
import {
  buildCalendar,
  buildGameEvent,
  escapeText,
  foldLine,
  toIcsUtc,
  gameUid,
  gameDurationMinutes,
  calendarFilename,
  utf8Length,
  downloadCalendar,
} from "./calendar";

const state = {
  teams: [
    { id: "t1", name: "Sandia Sluggers" },
    { id: "t2", name: "Rio Grande Rollers" },
  ],
  venues: [
    { id: "v1", name: "Los Altos Park", field_label: "Field 2", address: "10500 Lomas Blvd NE, Albuquerque, NM" },
  ],
};

const game = {
  id: "g1",
  sport: "kickball",
  stage: "regular",
  status: "upcoming",
  home_team_id: "t1",
  away_team_id: "t2",
  venue_id: "v1",
  starts_at: "2026-06-09T18:30:00-06:00",
};

const NOW = new Date("2026-05-01T12:00:00Z");
const lines = (text) => text.split("\r\n");

describe("text escaping", () => {
  test("escapes backslash, semicolon, comma and newline per RFC 5545", () => {
    expect(escapeText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeText("line1\r\nline2")).toBe("line1\\nline2");
  });

  test("escapes the backslash first so added escapes are not re-escaped", () => {
    expect(escapeText("\\,")).toBe("\\\\\\,");
  });

  test("null and undefined become empty rather than the string 'null'", () => {
    expect(escapeText(null)).toBe("");
    expect(escapeText(undefined)).toBe("");
  });
});

describe("utf8 length", () => {
  test("counts bytes, not characters", () => {
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("é")).toBe(2);
    expect(utf8Length("·")).toBe(2);
    expect(utf8Length("😀")).toBe(4);
  });
});

describe("line folding", () => {
  test("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  test("folds a long line with CRLF plus a single leading space", () => {
    const folded = foldLine(`SUMMARY:${"x".repeat(200)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    parts.slice(1).forEach((part) => expect(part.startsWith(" ")).toBe(true));
    // Unfolding must reproduce the original exactly.
    expect(parts.map((part, i) => (i === 0 ? part : part.slice(1))).join("")).toBe(`SUMMARY:${"x".repeat(200)}`);
  });

  test("folds on octets, never splitting a multi-byte character", () => {
    // Each emoji is 4 UTF-8 bytes; 30 of them exceed 75 octets well before
    // they exceed 75 characters.
    const folded = foldLine(`SUMMARY:${"😀".repeat(30)}`);
    folded.split("\r\n").forEach((part) => {
      expect(utf8Length(part)).toBeLessThanOrEqual(75);
      // A split surrogate pair would show up as a replacement character.
      expect(part).not.toContain("�");
    });
  });
});

describe("UTC timestamps", () => {
  test("formats as the compact Z form", () => {
    expect(toIcsUtc(new Date("2026-06-09T18:30:00-06:00"))).toBe("20260610T003000Z");
  });

  test("zero-pads every component", () => {
    expect(toIcsUtc(new Date("2026-01-02T03:04:05Z"))).toBe("20260102T030405Z");
  });
});

describe("single game event", () => {
  test("emits the required properties", () => {
    const event = buildGameEvent(state, game, { origin: "https://cvf.example", now: NOW }).join("\r\n");
    expect(event).toContain("BEGIN:VEVENT");
    expect(event).toContain(`UID:${gameUid(game)}`);
    expect(event).toContain("DTSTAMP:20260501T120000Z");
    expect(event).toContain("DTSTART:20260610T003000Z");
    expect(event).toContain("SUMMARY:Rio Grande Rollers @ Sandia Sluggers");
    expect(event).toContain("STATUS:CONFIRMED");
    expect(event).toContain("URL:https://cvf.example/game/g1");
    expect(event).toContain("END:VEVENT");
  });

  test("DTEND reflects the sport's scheduled slot length", () => {
    const event = buildGameEvent(state, game, { now: NOW }).join("\r\n");
    // 60 minutes after 00:30Z
    expect(event).toContain("DTEND:20260610T013000Z");
    expect(gameDurationMinutes("flag_football")).toBe(75);
    expect(gameDurationMinutes("unknown_sport")).toBe(60);
  });

  test("LOCATION carries the street address so a phone can navigate to it", () => {
    const event = buildGameEvent(state, game, { now: NOW }).join("\r\n");
    // Commas inside the address must be escaped, not left raw.
    expect(event).toContain("LOCATION:Los Altos Park · Field 2\\, 10500 Lomas Blvd NE\\, Albuquerque\\, NM");
  });

  test("a canceled game keeps its UID and flips to CANCELLED", () => {
    const event = buildGameEvent(state, { ...game, status: "canceled" }, { now: NOW }).join("\r\n");
    expect(event).toContain(`UID:${gameUid(game)}`);
    expect(event).toContain("STATUS:CANCELLED");
  });

  test("a game with no usable start is skipped rather than emitted broken", () => {
    expect(buildGameEvent(state, { ...game, starts_at: null }, { now: NOW })).toBeNull();
    expect(buildGameEvent(state, { ...game, starts_at: "not-a-date" }, { now: NOW })).toBeNull();
  });

  test("a missing venue does not produce a broken event", () => {
    const event = buildGameEvent(state, { ...game, venue_id: "nope" }, { now: NOW }).join("\r\n");
    expect(event).toContain("LOCATION:Unknown venue");
  });
});

describe("full calendar", () => {
  test("wraps events in a VCALENDAR with CRLF endings", () => {
    const text = buildCalendar(state, [game], { name: "Sandia Sluggers", now: NOW });
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR")).toBe(true);
    expect(text).toContain("VERSION:2.0");
    expect(text).toContain("X-WR-CALNAME:Sandia Sluggers");
    // No bare LF anywhere.
    expect(/[^\r]\n/.test(text)).toBe(false);
  });

  test("skips unusable games but keeps the rest", () => {
    const text = buildCalendar(state, [game, { ...game, id: "g2", starts_at: null }], { now: NOW });
    expect(lines(text).filter((line) => line === "BEGIN:VEVENT")).toHaveLength(1);
  });

  test("an empty schedule still produces a valid empty calendar", () => {
    const text = buildCalendar(state, [], { now: NOW });
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("END:VCALENDAR");
    expect(text).not.toContain("BEGIN:VEVENT");
  });

  test("UIDs are stable across rebuilds so a refresh updates rather than duplicates", () => {
    const first = buildCalendar(state, [game], { now: NOW });
    const second = buildCalendar(state, [game], { now: new Date("2026-05-02T12:00:00Z") });
    const uidOf = (text) => lines(text).find((line) => line.startsWith("UID:"));
    expect(uidOf(first)).toBe(uidOf(second));
    // DTSTAMP is the thing that legitimately changes between builds.
    expect(first).not.toBe(second);
  });
});

describe("filenames", () => {
  test("slugifies and always ends in .ics", () => {
    expect(calendarFilename("Sandia Sluggers")).toBe("sandia-sluggers.ics");
    expect(calendarFilename("Rio  Grande / Rollers!")).toBe("rio-grande-rollers.ics");
  });

  test("falls back when the label has nothing usable", () => {
    expect(calendarFilename("")).toBe("cvf-schedule.ics");
    expect(calendarFilename("!!!")).toBe("cvf-schedule.ics");
  });
});

describe("download helper", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    jest.useFakeTimers();
    URL.createObjectURL = jest.fn(() => "blob:mock");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  test("names the file from the label and cleans up the object URL", () => {
    const clicks = [];
    const originalClick = window.HTMLAnchorElement.prototype.click;
    window.HTMLAnchorElement.prototype.click = function click() { clicks.push(this.download); };

    downloadCalendar("BEGIN:VCALENDAR\r\nEND:VCALENDAR", "Sandia Sluggers");

    expect(clicks).toEqual(["sandia-sluggers.ics"]);
    // The anchor must not be left behind in the document.
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    window.HTMLAnchorElement.prototype.click = originalClick;
  });
});
