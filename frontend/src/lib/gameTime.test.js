import { fromDateTimeLocalValue, toDateTimeLocalValue, formatGameDateTime, isAmbiguousLeagueTime } from "./gameTime";

// The admin game editor and playoff scheduler type league-local wall time
// (America/Denver) into a datetime-local input. The stored instant must not
// depend on the zone the admin's browser happens to be set to. Jest cannot
// switch the process zone mid-run, so run this file under several TZ values
// (e.g. `TZ=America/Denver CI=true npm test -- gameTime`) to cover that axis.
describe("fromDateTimeLocalValue", () => {
  test("resolves league wall time to the right instant", () => {
    // Daylight time (MDT, UTC-6) and standard time (MST, UTC-7).
    expect(fromDateTimeLocalValue("2026-10-13T19:00")).toBe("2026-10-14T01:00:00.000Z");
    expect(fromDateTimeLocalValue("2026-01-13T19:00")).toBe("2026-01-14T02:00:00.000Z");
    expect(fromDateTimeLocalValue("2026-06-14T10:00")).toBe("2026-06-14T16:00:00.000Z");
  });

  test("opening and saving the editor unchanged keeps the kickoff", () => {
    const stored = "2026-09-01T00:30:00.000Z"; // Aug 31, 6:30 PM MDT
    const edited = fromDateTimeLocalValue(toDateTimeLocalValue(stored));
    expect(edited).toBe(stored);
    expect(formatGameDateTime({ starts_at: edited })).toBe("Aug 31 · 6:30 PM");
  });

  test("rejects incomplete values", () => {
    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(fromDateTimeLocalValue("2026-10-13")).toBeNull();
  });

  test("keeps the later fall-back instant when its wall time is unchanged", () => {
    const stored = "2026-11-01T08:30:42.000Z";
    expect(fromDateTimeLocalValue(toDateTimeLocalValue(stored), stored)).toBe(stored);
  });

  test("converts an edited ordinary time instead of retaining the old kickoff", () => {
    expect(fromDateTimeLocalValue("2026-11-02T01:30", "2026-11-01T08:30:00.000Z"))
      .toBe("2026-11-02T08:30:00.000Z");
  });

  test("rejects nonexistent spring-forward wall time with actionable validation", () => {
    expect(() => fromDateTimeLocalValue("2026-03-08T02:30")).toThrow(/does not exist.*choose another time/i);
  });
});

describe("isAmbiguousLeagueTime", () => {
  test("flags only the fall-back hour that happens twice", () => {
    expect(isAmbiguousLeagueTime("2026-11-01T01:30")).toBe(true);
    expect(isAmbiguousLeagueTime("2026-11-01T01:00")).toBe(true);
    expect(isAmbiguousLeagueTime("2026-11-01T00:59")).toBe(false);
    expect(isAmbiguousLeagueTime("2026-11-01T02:00")).toBe(false);
    expect(isAmbiguousLeagueTime("2026-10-13T19:00")).toBe(false);
    // A skipped spring-forward time is nonexistent, not ambiguous.
    expect(isAmbiguousLeagueTime("2026-03-08T02:30")).toBe(false);
    expect(isAmbiguousLeagueTime("")).toBe(false);
  });
});
