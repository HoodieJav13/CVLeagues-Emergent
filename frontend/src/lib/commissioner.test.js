import {
  LIMITS,
  SET_ASIDE_PREFIX,
  STORE_KEY,
  STORE_SCHEMA,
  STORE_VERSION,
  assessGame,
  assessReadiness,
  buildRecapText,
  buildRounds,
  checkRows,
  checkSnapshot,
  derivePage,
  emptyDoc,
  fingerprintGame,
  loadStore,
  parseStore,
  pickRound,
  recapStatus,
  resultLine,
  saveRecap,
  saveWorking,
  setAsideUnreadable,
  setCheck,
  writeSelectedRound,
} from "./commissioner";

jest.mock("../data/sports.js", () => ({
  SPORTS: [{ id: "kickball", name: "Kickball" }, { id: "flag_football", name: "Flag Football" }],
}), { virtual: true });

jest.mock("../lib/supabase", () => ({ MOCK_MODE: true, BACKEND_ENABLED: false }));

const NOW = () => Date.UTC(2026, 9, 31, 7, 0, 0);

const memoryStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: jest.fn((key) => { data.delete(key); }),
  };
};

const finalGame = (id, overrides = {}) => ({
  id,
  league_id: "lg-k",
  sport: "kickball",
  home_team_id: "t-a",
  away_team_id: "t-b",
  starts_at: "2026-07-01T00:30:00Z",
  status: "completed",
  score_status: "final",
  locked: true,
  home_score: 7,
  away_score: 5,
  ...overrides,
});

const baseState = (games) => ({
  leagues: [
    { id: "lg-k", name: "Test Kickball", sport: "kickball", season: "2026" },
    { id: "lg-f", name: "Test Flag", sport: "flag_football", season: "2026" },
  ],
  teams: [{ id: "t-a", name: "Alpha" }, { id: "t-b", name: "Bravo" }],
  games,
});

const KEY = "lg-k|2026-06-30";
const OTHER_KEY = "lg-k|2026-07-08";
const roundOf = (games) => buildRounds(baseState(games)).rounds[0];
const recordOf = (storage, key = KEY) => loadStore(storage).doc.rounds[key] || null;
const saveArgs = (overrides = {}) => ({
  roundKey: KEY, expectedRevision: 0, heading: "Heading", body: "Body", snapshot: [], now: NOW, ...overrides,
});

describe("rounds", () => {
  test("group by league and league-local date, not the UTC date", () => {
    const { rounds } = buildRounds(baseState([
      finalGame("late", { starts_at: "2026-07-01T04:30:00Z" }),
      finalGame("early", { starts_at: "2026-07-01T00:30:00Z" }),
      finalGame("next-day", { starts_at: "2026-07-01T07:30:00Z" }),
      finalGame("flag", { league_id: "lg-f", sport: "flag_football" }),
    ]));
    expect(rounds.map((round) => round.key).sort()).toEqual(["lg-f|2026-06-30", "lg-k|2026-06-30", "lg-k|2026-07-01"]);
    expect(rounds.find((round) => round.key === KEY).games.map((game) => game.id)).toEqual(["early", "late"]);
  });

  test("count a game with no league or usable date instead of inventing a round", () => {
    const { rounds, skipped } = buildRounds(baseState([
      finalGame("ok"),
      finalGame("no-date", { starts_at: null }),
      finalGame("bad-date", { starts_at: "not a date" }),
      finalGame("no-league", { league_id: "missing" }),
    ]));
    expect(rounds).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  test("a round is chosen from the address, then storage, then the newest finishable round", () => {
    const { rounds } = buildRounds(baseState([
      finalGame("older"),
      finalGame("newer", { starts_at: "2026-07-09T00:30:00Z", status: "live" }),
    ]));
    expect(pickRound(rounds, OTHER_KEY, KEY).key).toBe(OTHER_KEY);
    expect(pickRound(rounds, "gone|2026-01-01", OTHER_KEY).key).toBe(OTHER_KEY);
    expect(pickRound(rounds, null, null).key).toBe(KEY);
    expect(pickRound([], null, null)).toBeNull();
  });
});

describe("eligibility", () => {
  test("requires completed, final, locked and two nonnegative integers", () => {
    expect(assessGame(finalGame("a")).eligible).toBe(true);
    expect(assessGame(finalGame("zero", { home_score: 0, away_score: 0 })).eligible).toBe(true);
  });

  test.each([
    ["live", { status: "live" }, "live"],
    ["upcoming", { status: "scheduled" }, "upcoming"],
    ["postponed", { status: "postponed" }, "postponed"],
    ["canceled", { status: "canceled" }, "canceled"],
    ["pending score", { score_status: "pending" }, "pending"],
    ["unlocked", { locked: false }, "unlocked"],
    ["lock missing", { locked: undefined }, "unlocked"],
    ["null score", { home_score: null }, "malformed"],
    ["string score", { home_score: "7" }, "malformed"],
    ["negative score", { away_score: -1 }, "malformed"],
    ["fractional score", { away_score: 1.5 }, "malformed"],
    ["not a number", { away_score: Number.NaN }, "malformed"],
  ])("%s stays unverified with no figures", (_name, overrides, code) => {
    const game = finalGame("g", overrides);
    expect(assessGame(game)).toMatchObject({ eligible: false, code });
    expect(resultLine(baseState([game]), game)).toBe("No confirmed result");
  });

  test("a forfeit never acquires points, even when score columns hold numbers", () => {
    [
      finalGame("f1", { is_forfeit: true, home_score: null, away_score: null, winner_team_id: "t-a" }),
      finalGame("f2", { is_forfeit: true, home_score: 0, away_score: 0, winner_team_id: "t-a" }),
      finalGame("f3", { forfeit_team_id: "t-b", home_score: 7, away_score: 0, winner_team_id: "t-a" }),
    ].forEach((game) => {
      expect(assessGame(game)).toMatchObject({ eligible: false, code: "forfeit" });
      const line = resultLine(baseState([game]), game);
      expect(line).toBe("Alpha won by forfeit, no score recorded");
      expect(line).not.toMatch(/\d/);
    });
  });
});

describe("checks and fingerprints", () => {
  test("any score, status or lock change invalidates a check", () => {
    const game = finalGame("g");
    const storage = memoryStorage();
    expect(setCheck(storage, { roundKey: KEY, expectedRevision: 0, game, now: NOW }).ok).toBe(true);
    const record = recordOf(storage);
    expect(checkRows(roundOf([game]), record)[0].status).toBe("checked");
    [{ home_score: 8 }, { away_score: 6 }].forEach((change) => {
      expect(checkRows(roundOf([{ ...game, ...change }]), record)[0].status).toBe("stale");
    });
    [{ status: "live" }, { score_status: "pending" }, { locked: false }].forEach((change) => {
      const changed = { ...game, ...change };
      expect(fingerprintGame(changed)).not.toBe(fingerprintGame(game));
      expect(checkRows(roundOf([changed]), record)[0]).toMatchObject({ status: "stale" });
    });
  });

  test("an ineligible game is refused and nothing is written", () => {
    const storage = memoryStorage();
    const result = setCheck(storage, { roundKey: KEY, expectedRevision: 0, game: finalGame("g", { status: "live" }), now: NOW });
    expect(result).toMatchObject({ ok: false, code: "not-eligible" });
    expect(storage.data.size).toBe(0);
  });

  test("repeat checks keep one record and the first time", () => {
    const game = finalGame("g");
    const storage = memoryStorage();
    setCheck(storage, { roundKey: KEY, expectedRevision: 0, game, now: NOW });
    const repeat = setCheck(storage, { roundKey: KEY, expectedRevision: 1, game, now: () => NOW() + 1000 });
    expect(repeat.unchanged).toBe(true);
    expect(recordOf(storage).checks).toHaveLength(1);
    expect(recordOf(storage).revision).toBe(1);
  });

  test("recap text is built only from current checks, in a pure call", () => {
    const checked = finalGame("a");
    const unchecked = finalGame("b", { home_score: 30 });
    const pending = finalGame("c", { score_status: "pending", home_score: 40 });
    const games = [checked, unchecked, pending];
    const storage = memoryStorage();
    setCheck(storage, { roundKey: KEY, expectedRevision: 0, game: checked, now: NOW });
    const before = storage.data.get(STORE_KEY);
    const text = buildRecapText(baseState(games), roundOf(games), recordOf(storage));
    expect(text.heading).toContain("Test Kickball");
    expect(text.body).toBe("Bravo 5, Alpha 7");
    expect(storage.data.get(STORE_KEY)).toBe(before);
  });
});

describe("working draft and explicit save", () => {
  test("a working draft is recoverable but is not a save", () => {
    const storage = memoryStorage();
    expect(saveWorking(storage, { roundKey: KEY, expectedRevision: 0, heading: "Draft", body: "Text", now: NOW }).ok).toBe(true);
    const record = recordOf(storage);
    expect(record.saved).toBeNull();
    expect(record.working).toMatchObject({ heading: "Draft", body: "Text" });
    expect(derivePage(record, null)).toMatchObject({ heading: "Draft", body: "Text" });
    expect(recapStatus(record, derivePage(record, null)).code).toBe("unsaved");
  });

  test("editing after a save keeps saved content until the next explicit save", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    saveWorking(storage, { roundKey: KEY, expectedRevision: 1, heading: "Heading", body: "Changed", now: NOW });
    const record = recordOf(storage);
    expect(record.saved.body).toBe("Body");
    expect(record.working.body).toBe("Changed");
    expect(recapStatus(record, derivePage(record, null)).code).toBe("unsaved");
  });

  test("typing back to the saved text returns to the saved state", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    saveWorking(storage, { roundKey: KEY, expectedRevision: 1, heading: "Heading", body: "Changed", now: NOW });
    saveWorking(storage, { roundKey: KEY, expectedRevision: 2, heading: "Heading", body: "Body", now: NOW });
    const record = recordOf(storage);
    expect(record.working).toBeNull();
    expect(recapStatus(record, derivePage(record, null)).code).toBe("saved");
  });

  test("repeat saves keep one receipt, one time and one revision", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    const first = recordOf(storage);
    const repeat = saveRecap(storage, saveArgs({ expectedRevision: 1, now: () => NOW() + 60000 }));
    expect(repeat).toMatchObject({ ok: true, unchanged: true });
    expect(recordOf(storage)).toEqual(first);
    expect(first.saved.receipt).toBe(1);
  });

  test("a real change takes the next receipt", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    saveRecap(storage, saveArgs({ expectedRevision: 1, body: "New" }));
    expect(recordOf(storage).saved).toMatchObject({ body: "New", receipt: 2 });
  });

  test("blank and over-limit text is refused, never truncated", () => {
    const storage = memoryStorage();
    expect(saveRecap(storage, saveArgs({ body: "   " }))).toMatchObject({ ok: false, code: "text-empty" });
    const long = saveRecap(storage, saveArgs({ body: "x".repeat(LIMITS.body + 5) }));
    expect(long.ok).toBe(false);
    expect(long.message).toContain("5 characters over");
    expect(saveWorking(storage, { roundKey: KEY, expectedRevision: 0, heading: "h".repeat(LIMITS.heading + 1), body: "", now: NOW }).ok).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  test("two rounds keep their own work", () => {
    const storage = memoryStorage();
    saveWorking(storage, { roundKey: KEY, expectedRevision: 0, heading: "One", body: "", now: NOW });
    saveWorking(storage, { roundKey: OTHER_KEY, expectedRevision: 0, heading: "Two", body: "", now: NOW });
    expect(recordOf(storage, KEY).working.heading).toBe("One");
    expect(recordOf(storage, OTHER_KEY).working.heading).toBe("Two");
  });

  test("the open round is a preference and bumps no revision", () => {
    const storage = memoryStorage();
    saveWorking(storage, { roundKey: KEY, expectedRevision: 0, heading: "One", body: "", now: NOW });
    expect(writeSelectedRound(storage, OTHER_KEY).ok).toBe(true);
    expect(loadStore(storage).doc.selectedRoundKey).toBe(OTHER_KEY);
    expect(recordOf(storage).revision).toBe(1);
  });
});

describe("storage failure", () => {
  const refusing = (storage) => ({
    ...storage,
    setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
  });

  test("a failed save keeps the last good save and gives a next step, and retry works", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    const before = storage.data.get(STORE_KEY);
    const failed = saveRecap(refusing(storage), saveArgs({ expectedRevision: 1, body: "New" }));
    expect(failed).toMatchObject({ ok: false, code: "write-failed" });
    expect(failed.message).toMatch(/try again/i);
    expect(failed.message).toMatch(/earlier saved version is unchanged/i);
    expect(storage.data.get(STORE_KEY)).toBe(before);
    expect(saveRecap(storage, saveArgs({ expectedRevision: 1, body: "New" })).ok).toBe(true);
    expect(recordOf(storage).saved.body).toBe("New");
  });

  test("a write that storage silently drops never counts as saved", () => {
    const storage = memoryStorage();
    const dropping = { ...storage, setItem: () => {} };
    expect(saveRecap(dropping, saveArgs())).toMatchObject({ ok: false, code: "write-unconfirmed" });
  });

  test("blocked storage reads as unavailable, not as empty work that may be written", () => {
    const throwing = { getItem: () => { throw new Error("denied"); }, setItem: jest.fn() };
    [null, throwing].forEach((storage) => {
      expect(loadStore(storage)).toMatchObject({ status: "unavailable", writable: false });
      expect(saveRecap(storage, saveArgs())).toMatchObject({ ok: false, code: "unavailable" });
    });
    expect(throwing.setItem).not.toHaveBeenCalled();
  });

  test("a store at its size limit refuses rather than stranding itself", () => {
    const storage = memoryStorage();
    const doc = emptyDoc();
    const work = { revision: 1, checks: [], working: null, saved: null };
    for (let index = 0; index < LIMITS.rounds; index += 1) doc.rounds[`lg-${index}|2026-06-30`] = work;
    storage.setItem(STORE_KEY, JSON.stringify(doc));
    expect(saveRecap(storage, saveArgs())).toMatchObject({ ok: false, code: "round-limit" });
  });
});

describe("unreadable data", () => {
  const validDoc = () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    return JSON.parse(storage.data.get(STORE_KEY));
  };

  test.each([
    ["broken JSON", () => "{oops", "corrupt"],
    ["an array", () => "[]", "corrupt"],
    ["another schema", () => JSON.stringify({ schema: "other", version: STORE_VERSION }), "corrupt"],
    ["an unknown version", () => JSON.stringify({ ...emptyDoc(), version: STORE_VERSION + 1 }), "unknown-version"],
    ["an unknown top-level field", () => JSON.stringify({ ...emptyDoc(), posted: true }), "corrupt"],
    ["an unknown saved field", () => {
      const doc = validDoc();
      doc.rounds[KEY].saved.posted = true;
      return JSON.stringify(doc);
    }, "corrupt"],
    ["an oversized heading", () => {
      const doc = validDoc();
      doc.rounds[KEY].saved.heading = "x".repeat(LIMITS.heading + 1);
      return JSON.stringify(doc);
    }, "corrupt"],
    ["a markup-carrying round key", () => JSON.stringify({ ...emptyDoc(), rounds: { "<b>": {} } }), "corrupt"],
    ["a prototype key", () => `{"schema":"${STORE_SCHEMA}","version":${STORE_VERSION},"selectedRoundKey":null,"rounds":{"__proto__":{}}}`, "corrupt"],
    ["too much data", () => " ".repeat(LIMITS.rawChars + 1), "corrupt"],
  ])("%s is refused, left in place and blocks every write", (_name, build, status) => {
    const raw = build();
    const storage = memoryStorage({ [STORE_KEY]: raw, unrelated: "keep" });
    expect(parseStore(raw).status).toBe(status);
    expect(loadStore(storage)).toMatchObject({ status, writable: false });
    expect(saveRecap(storage, saveArgs())).toMatchObject({ ok: false, code: status });
    expect(saveWorking(storage, { roundKey: KEY, expectedRevision: 0, heading: "a", body: "b", now: NOW }).ok).toBe(false);
    expect(writeSelectedRound(storage, KEY).ok).toBe(false);
    expect(storage.data.get(STORE_KEY)).toBe(raw);
    expect(storage.data.get("unrelated")).toBe("keep");
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  test("setting aside copies first, starts empty and removes nothing", () => {
    const storage = memoryStorage({ [STORE_KEY]: "{oops", unrelated: "keep" });
    const result = setAsideUnreadable(storage, { now: NOW });
    expect(result.ok).toBe(true);
    expect(result.setAsideKey.startsWith(SET_ASIDE_PREFIX)).toBe(true);
    expect(storage.data.get(result.setAsideKey)).toBe("{oops");
    expect(storage.data.get("unrelated")).toBe("keep");
    expect(loadStore(storage)).toMatchObject({ status: "ready", writable: true });
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  test("setting aside twice in one instant keeps both copies", () => {
    const storage = memoryStorage({ [STORE_KEY]: "{one" });
    const first = setAsideUnreadable(storage, { now: NOW });
    storage.setItem(STORE_KEY, "{two");
    const second = setAsideUnreadable(storage, { now: NOW });
    expect(second.setAsideKey).not.toBe(first.setAsideKey);
    expect(storage.data.get(first.setAsideKey)).toBe("{one");
    expect(storage.data.get(second.setAsideKey)).toBe("{two");
  });

  test("a failed copy leaves the unreadable data exactly where it is", () => {
    const storage = memoryStorage({ [STORE_KEY]: "{oops" });
    const refusing = { ...storage, setItem: () => { throw new Error("full"); } };
    expect(setAsideUnreadable(refusing, { now: NOW })).toMatchObject({ ok: false, code: "set-aside-failed" });
    expect(storage.data.get(STORE_KEY)).toBe("{oops");
  });

  test("readable data is never set aside", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    const raw = storage.data.get(STORE_KEY);
    expect(setAsideUnreadable(storage, { now: NOW })).toMatchObject({ ok: false, code: "not-unreadable" });
    expect(storage.data.get(STORE_KEY)).toBe(raw);
  });
});

describe("another tab", () => {
  test("a write from an older revision is refused and overwrites nothing", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs({ body: "From the other tab" }));
    const raw = storage.data.get(STORE_KEY);
    expect(saveRecap(storage, saveArgs({ expectedRevision: 0, body: "Stale tab" }))).toMatchObject({ ok: false, code: "conflict" });
    expect(saveWorking(storage, { roundKey: KEY, expectedRevision: 0, heading: "x", body: "y", now: NOW })).toMatchObject({ ok: false, code: "conflict" });
    expect(storage.data.get(STORE_KEY)).toBe(raw);
  });

  test("work in one round does not conflict with another round", () => {
    const storage = memoryStorage();
    saveRecap(storage, saveArgs());
    expect(saveRecap(storage, saveArgs({ roundKey: OTHER_KEY, expectedRevision: 0 })).ok).toBe(true);
  });

  test("page text stays pinned until storage holds it, and conflicts once storage moves on", () => {
    const record = { revision: 2, checks: [], working: { heading: "Other", body: "Tab", updatedAt: "2026-10-31T07:00:00.000Z" }, saved: null };
    const pin = { heading: "Mine", body: "Text", revision: 1 };
    expect(derivePage(record, pin)).toMatchObject({ heading: "Mine", pinned: true, conflict: true });
    expect(derivePage({ ...record, revision: 1 }, pin)).toMatchObject({ heading: "Mine", conflict: false });
    expect(derivePage(record, { heading: "Other", body: "Tab", revision: 1 })).toMatchObject({ revision: 2, pinned: false, conflict: false });
  });
});

describe("share preview readiness", () => {
  const prepared = (games) => {
    const storage = memoryStorage();
    let revision = 0;
    games.filter((game) => assessGame(game).eligible).forEach((game) => {
      revision = setCheck(storage, { roundKey: KEY, expectedRevision: revision, game, now: NOW }).record.revision;
    });
    return { storage, revision };
  };
  const saveFor = (storage, revision, games, body = "Body") => {
    const round = roundOf(games);
    saveRecap(storage, saveArgs({ expectedRevision: revision, body, snapshot: checkSnapshot(round, recordOf(storage)) }));
    return recordOf(storage);
  };
  const page = (record) => derivePage(record, null);

  test("is ready only for exact saved text over a full set of current checks", () => {
    const games = [finalGame("a"), finalGame("b")];
    const { storage, revision } = prepared(games);
    const record = saveFor(storage, revision, games);
    const readiness = assessReadiness(roundOf(games), record, page(record));
    expect(readiness).toMatchObject({ ready: true, nextAction: "" });
    expect(readiness.saved).toBe(record.saved);
    expect(JSON.stringify(record)).not.toMatch(/posted/i);
  });

  test("unsaved edits block it and name the next action", () => {
    const games = [finalGame("a")];
    const { storage, revision } = prepared(games);
    const record = saveFor(storage, revision, games);
    const readiness = assessReadiness(roundOf(games), record, { heading: "Heading", body: "Edited" });
    expect(readiness).toMatchObject({ ready: false, code: "unsaved", saved: null });
    expect(readiness.nextAction).toMatch(/save your changes/i);
  });

  test("a source change blocks it, and checking again still needs a new save", () => {
    const games = [finalGame("a")];
    const { storage, revision } = prepared(games);
    const record = saveFor(storage, revision, games);
    const changed = [finalGame("a", { home_score: 9 })];
    expect(assessReadiness(roundOf(changed), record, page(record))).toMatchObject({ ready: false, code: "stale" });

    setCheck(storage, { roundKey: KEY, expectedRevision: record.revision, game: changed[0], now: NOW });
    const rechecked = recordOf(storage);
    expect(assessReadiness(roundOf(changed), rechecked, page(rechecked))).toMatchObject({ ready: false, code: "resave" });

    saveRecap(storage, saveArgs({ expectedRevision: rechecked.revision, snapshot: checkSnapshot(roundOf(changed), rechecked) }));
    const saved = recordOf(storage);
    expect(assessReadiness(roundOf(changed), saved, page(saved)).ready).toBe(true);
  });

  test("a pending, unchecked or forfeit game keeps the round incomplete", () => {
    const pending = [finalGame("a"), finalGame("b", { status: "live" })];
    const open = prepared(pending);
    const pendingRecord = saveFor(open.storage, open.revision, pending);
    expect(assessReadiness(roundOf(pending), pendingRecord, page(pendingRecord))).toMatchObject({ ready: false, code: "ineligible" });

    const forfeit = [finalGame("a"), finalGame("b", { is_forfeit: true, home_score: null, away_score: null })];
    const decided = prepared(forfeit);
    const forfeitRecord = saveFor(decided.storage, decided.revision, forfeit);
    expect(assessReadiness(roundOf(forfeit), forfeitRecord, page(forfeitRecord))).toMatchObject({ ready: false, code: "ineligible" });

    const games = [finalGame("a")];
    expect(assessReadiness(roundOf(games), null, { heading: "", body: "" })).toMatchObject({ ready: false, code: "unchecked" });
  });

  test("a new game in the round blocks it", () => {
    const games = [finalGame("a")];
    const { storage, revision } = prepared(games);
    const record = saveFor(storage, revision, games);
    expect(assessReadiness(roundOf([...games, finalGame("b")]), record, page(record))).toMatchObject({ ready: false, code: "unchecked" });
  });
});
