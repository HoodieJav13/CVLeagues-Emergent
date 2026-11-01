import React, { act } from "react";
import fs from "fs";
import path from "path";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Commissioner from "./Commissioner";
import { STORE_KEY, emptyDoc, loadStore, saveWorking } from "../lib/commissioner";

// CRA's Jest 27 resolver predates package exports. Resolve only the router's
// DOM re-export to the installed CJS file; use real router behavior in tests.
jest.mock("react-router/dom", () => {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  return jest.requireActual("react-router/dist/development/dom-export.js");
}, { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState;
let mockRole;
let mockBackend = false;
const SCOPE = JSON.stringify(["fixture", "local-admin"]);
const RAW_KEY = `cvf.commissioner.scope.v1.${encodeURIComponent(SCOPE)}.${STORE_KEY}`;
const storage = { getItem: (key) => { const raw = window.localStorage.getItem(`cvf.commissioner.scope.v1.${encodeURIComponent(SCOPE)}.${key}`); if (!raw) return raw; try { return JSON.parse(raw).payload || raw; } catch { return raw; } }, setItem: (key, payload) => window.localStorage.setItem(`cvf.commissioner.scope.v1.${encodeURIComponent(SCOPE)}.${key}`, JSON.stringify({ schema: "cvf.commissioner.scope", version: 1, scope: SCOPE, payload })) };

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../data/sports.js", () => ({
  SPORTS: [{ id: "kickball", name: "Kickball" }, { id: "flag_football", name: "Flag Football" }],
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("../context/RoleContext", () => ({ useRole: () => mockRole }));

jest.mock("../lib/supabase", () => ({ get MOCK_MODE() { return !mockBackend; }, get BACKEND_ENABLED() { return mockBackend; } }));

const game = (id, overrides = {}) => ({
  id,
  league_id: "lg-k",
  sport: "kickball",
  home_team_id: "t-a",
  away_team_id: "t-b",
  starts_at: "2026-07-01T00:30:00Z",
  venue_id: "v-1",
  status: "completed",
  score_status: "final",
  locked: true,
  home_score: 7,
  away_score: 5,
  ...overrides,
});

const synthetic = () => ({
  leagues: [{ id: "lg-k", name: "Test Kickball", sport: "kickball", season: "2026" }],
  teams: [{ id: "t-a", name: "Alpha" }, { id: "t-b", name: "Bravo" }],
  games: [
    game("g-1"),
    game("g-2", { starts_at: "2026-07-08T00:30:00Z", home_score: 3, away_score: 2 }),
  ],
  film: { reels: ["untouched"] },
  replays: [{ id: "untouched" }],
});

const ROUND_ONE = "lg-k|2026-06-30";
const ROUND_TWO = "lg-k|2026-07-07";

describe("commissioner rehearsal", () => {
  let container;
  let root;

  const renderTree = async (tree) => {
    await act(async () => { root.render(tree); });
  };
  const renderAt = async (entry = `/admin/commissioner?round=${encodeURIComponent(ROUND_ONE)}`) => {
    await renderTree(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/admin/commissioner" element={<Commissioner />} />
        </Routes>
      </MemoryRouter>
    );
  };
  const reload = async (entry) => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await renderAt(entry);
  };
  const q = (selector) => container.querySelector(selector);
  const id = (name) => q(`[data-testid="${name}"]`);
  const gameRow = (gameId) => q(`[data-commissioner-game="${gameId}"]`);
  const text = () => container.textContent;
  const click = async (element) => {
    expect(element).not.toBeNull();
    await act(async () => { element.click(); });
  };
  const setValue = async (element, value, eventName = "input") => {
    expect(element).not.toBeNull();
    const prototype = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    await act(async () => {
      setter.call(element, value);
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  };
  const write = async (heading, body) => {
    await setValue(id("commissioner-heading"), heading);
    await setValue(id("commissioner-body"), body);
  };
  const checkGame = (gameId) => click(gameRow(gameId).querySelector("button"));
  const save = () => click(id("commissioner-save"));

  beforeEach(() => {
    mockBackend = false;
    window.localStorage.clear();
    mockState = synthetic();
    mockRole = { role: "admin", authStatus: "mock", session: null };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => root.unmount());
    container.remove();
  });

  test("renders a guard and no league data when the local trial is off", async () => {
    mockRole = { role: "anonymous", authStatus: "signed_out", session: null };
    await renderAt();
    expect(text()).toMatch(/available to/);
    expect(id("commissioner")).toBeNull();
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });

  test("shows the round's sport, date and game count from source games only", async () => {

    await renderAt();
    const summary = id("commissioner-round-summary").textContent;
    expect(summary).toContain("Kickball");
    expect(summary).toContain("June 30, 2026");
    expect(summary).toContain("1 game this round");
    expect(id("commissioner-round").querySelectorAll("option")).toHaveLength(2);
  });

  test("round to preview: saved text appears exactly, survives a reload, and nothing claims posting", async () => {
    const fetchSpy = jest.fn();
    const previousFetch = global.fetch;
    global.fetch = fetchSpy;
    const before = JSON.stringify(mockState);
    try {
      await renderAt();
      expect(id("commissioner-preview").dataset.ready).toBe("false");
      expect(text()).not.toContain("Saved locally");

      await checkGame("g-1");
      expect(gameRow("g-1").dataset.check).toBe("checked");
      expect(gameRow("g-1").textContent).toContain("Local recap check");

      await click(id("commissioner-build"));
      expect(id("commissioner-body").value).toBe("Bravo 5, Alpha 7");
      expect(id("commissioner-save-state").textContent).toContain("Unsaved changes");
      expect(id("commissioner-preview").dataset.ready).toBe("false");

      await setValue(id("commissioner-body"), "Bravo 5, Alpha 7\n<b>Good game</b>");
      await save();
      expect(id("commissioner-save-state").textContent).toMatch(/^Saved locally · Local receipt 1 · /);

      const preview = id("commissioner-preview");
      expect(preview.dataset.ready).toBe("true");
      expect(preview.querySelector("h2").textContent).toBe("Share preview · not posted");
      expect(preview.textContent).toContain("Browser-only draft");
      const sheet = id("commissioner-preview-text");
      expect(sheet.querySelector("h3").textContent).toBe(id("commissioner-heading").value);
      expect(sheet.querySelector("p").textContent).toBe("Bravo 5, Alpha 7\n<b>Good game</b>");
      expect(sheet.querySelector("b")).toBeNull();

      await reload();
      expect(id("commissioner-save-state").textContent).toContain("Saved locally");
      expect(id("commissioner-preview").dataset.ready).toBe("true");

      const buttons = [...container.querySelectorAll("button")].map((button) => button.textContent);
      buttons.forEach((label) => expect(label).not.toMatch(/post|publish|export|copy|download|share/i));
      expect(text().replace(/not posted/g, "")).not.toMatch(/posted/i);
      expect(text()).not.toMatch(/clipboard|download|published/i);
      expect(storage.getItem(STORE_KEY)).not.toMatch(/posted/i);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(mockState)).toBe(before);
    } finally {
      global.fetch = previousFetch;
    }
  });

  test("repeat Save clicks keep one receipt", async () => {
    await renderAt();
    await checkGame("g-1");
    await write("Heading", "Body");
    await save();
    const stored = storage.getItem(STORE_KEY);
    await save();
    await save();
    expect(storage.getItem(STORE_KEY)).toBe(stored);
    expect(id("commissioner-save-state").textContent).toContain("Local receipt 1");
  });

  test("an interrupted edit returns after reload as unsaved, and the earlier save stays out of the editor label", async () => {
    await renderAt();
    await checkGame("g-1");
    await write("Heading", "Saved body");
    await save();
    await setValue(id("commissioner-body"), "Interrupted edit");
    expect(id("commissioner-preview").dataset.ready).toBe("false");
    expect(id("commissioner-preview-next").textContent).toMatch(/Save your changes/);

    await reload();
    expect(id("commissioner-body").value).toBe("Interrupted edit");
    const status = id("commissioner-save-state").textContent;
    expect(status).toContain("Unsaved changes");
    expect(status).toContain("draft kept in this browser");
    expect(status).toContain("earlier version kept, Local receipt 1");
    expect(text()).not.toContain("Saved locally");
    expect(id("commissioner-preview-text")).toBeNull();
  });

  test("each round keeps its own edits, and the chosen round survives a return with no address", async () => {
    await renderAt();
    await setValue(id("commissioner-body"), "Round one notes");

    await setValue(id("commissioner-round"), ROUND_TWO, "change");
    expect(id("commissioner-body").value).toBe("");
    await setValue(id("commissioner-body"), "Round two notes");

    await setValue(id("commissioner-round"), ROUND_ONE, "change");
    expect(id("commissioner-body").value).toBe("Round one notes");

    await setValue(id("commissioner-round"), ROUND_TWO, "change");
    await reload("/admin/commissioner");
    expect(id("commissioner-round").value).toBe(ROUND_TWO);
    expect(id("commissioner-body").value).toBe("Round two notes");
  });

  test("pending, malformed and forfeit games stay visible and unverified with no figures", async () => {
    mockState.games = [
      game("pending", { score_status: "pending", home_score: 11 }),
      game("malformed", { home_score: "12" }),
      game("forfeit", { is_forfeit: true, home_score: null, away_score: null, winner_team_id: "t-a" }),
      game("upcoming", { status: "scheduled", score_status: null, locked: false, home_score: null, away_score: null }),
      game("ok"),
    ];
    await renderAt();
    ["pending", "malformed", "forfeit", "upcoming"].forEach((gameId) => {
      const row = gameRow(gameId);
      expect(row.dataset.check).toBe("ineligible");
      expect(row.querySelector("button")).toBeNull();
      expect(row.textContent).toContain("Unverified");
    });
    expect(gameRow("forfeit").textContent).toContain("Alpha won by forfeit, no score recorded");
    expect(gameRow("forfeit").textContent).not.toMatch(/\d/);
    expect(gameRow("pending").textContent).not.toContain("11");
    expect(gameRow("malformed").textContent).not.toContain("12");

    await checkGame("ok");
    await click(id("commissioner-build"));
    expect(id("commissioner-body").value).toBe("Bravo 5, Alpha 7");
    await save();
    expect(id("commissioner-preview").dataset.ready).toBe("false");
    expect(id("commissioner-preview-next").textContent).toContain("4 games can't be checked yet");
  });

  test("a source result change invalidates the check and preview, and the saved text must be saved again", async () => {
    await renderAt();
    await checkGame("g-1");
    await write("Heading", "Bravo 5, Alpha 7");
    await save();
    expect(id("commissioner-preview").dataset.ready).toBe("true");

    mockState = { ...mockState, games: [game("g-1", { home_score: 8 }), mockState.games[1]] };
    await renderAt();
    expect(gameRow("g-1").dataset.check).toBe("stale");
    expect(id("commissioner-preview").dataset.ready).toBe("false");
    expect(id("commissioner-preview-text")).toBeNull();
    expect(id("commissioner-preview-next").textContent).toMatch(/changed after checking/);
    expect(id("commissioner-body").value).toBe("Bravo 5, Alpha 7");

    await checkGame("g-1");
    expect(id("commissioner-preview-next").textContent).toMatch(/save again/i);
    await setValue(id("commissioner-body"), "Bravo 5, Alpha 8");
    await save();
    expect(id("commissioner-preview").dataset.ready).toBe("true");
    expect(id("commissioner-save-state").textContent).toContain("Local receipt 2");
  });

  test("building never replaces edits without a deliberate confirmation", async () => {
    await renderAt();
    await checkGame("g-1");
    await write("My heading", "My careful words");

    await click(id("commissioner-build"));
    expect(id("commissioner-body").value).toBe("My careful words");
    expect(document.activeElement).toBe(id("commissioner-replace-yes"));

    await click(id("commissioner-replace-no"));
    expect(id("commissioner-body").value).toBe("My careful words");
    expect(id("commissioner-replace-confirm")).toBeNull();
    expect(document.activeElement).toBe(id("commissioner-build"));

    await click(gameRow("g-1").querySelector("button"));
    expect(id("commissioner-body").value).toBe("My careful words");
    await checkGame("g-1");

    await click(id("commissioner-build"));
    await click(id("commissioner-replace-yes"));
    expect(id("commissioner-body").value).toBe("Bravo 5, Alpha 7");
    expect(document.activeElement).toBe(id("commissioner-heading"));
  });

  test("keyboard focus stays on a game's button as its check toggles", async () => {
    await renderAt();
    const button = gameRow("g-1").querySelector("button");
    button.focus();
    await click(button);
    expect(gameRow("g-1").dataset.check).toBe("checked");
    expect(button.textContent).toBe("Undo check");
    expect(document.activeElement).toBe(button);
    await click(button);
    expect(gameRow("g-1").dataset.check).toBe("unchecked");
    expect(document.activeElement).toBe(button);
  });

  test("a build with no current check is unavailable", async () => {
    await renderAt();
    expect(id("commissioner-build").disabled).toBe(true);
  });

  test("a failed save keeps the text, keeps the last good save, says what to do and retries cleanly", async () => {
    await renderAt();
    await checkGame("g-1");
    await write("Heading", "Good version");
    await save();
    await setValue(id("commissioner-body"), "Newer version");
    const lastGood = storage.getItem(STORE_KEY);

    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await save();
    const alert = id("commissioner-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toMatch(/try again/i);
    expect(id("commissioner-body").value).toBe("Newer version");
    expect(text()).not.toContain("Saved locally");
    expect(storage.getItem(STORE_KEY)).toBe(lastGood);

    await setValue(id("commissioner-body"), "Newest version");
    expect(id("commissioner-save-state").textContent).toContain("this text is only on this page");
    expect(id("commissioner-body").value).toBe("Newest version");

    setItem.mockRestore();
    await save();
    expect(id("commissioner-error")).toBeNull();
    expect(id("commissioner-save-state").textContent).toContain("Saved locally");
    expect(id("commissioner-save-state").textContent).toContain("Local receipt 2");
    expect(id("commissioner-preview-text").textContent).toContain("Newest version");
  });

  test("a persisted save with a one-shot readback failure stays unconfirmed until an explicit retry", async () => {
    await renderAt(); await checkGame("g-1"); await write("Heading", "Body");
    const read = Storage.prototype.getItem;
    let failNext = false;
    const writeItem = Storage.prototype.setItem;
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(function(key, value) {
      writeItem.call(this, key, value); if (key === RAW_KEY) failNext = true;
    });
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(function(key) {
      if (key === RAW_KEY && failNext) { failNext = false; throw new Error("one-shot confirmation failure"); }
      return read.call(this, key);
    });
    await save();
    expect(id("commissioner-error").textContent).toMatch(/didn't confirm/);
    expect(id("commissioner-save-state").textContent).not.toContain("Saved locally");
    expect(id("commissioner-preview").dataset.ready).toBe("false");
    expect(id("commissioner-preview-text")).toBeNull();
    get.mockRestore(); set.mockRestore();
    await save();
    expect(id("commissioner-error")).toBeNull();
    expect(id("commissioner-save-state").textContent).toContain("Saved locally");
    expect(id("commissioner-preview").dataset.ready).toBe("true");
  });

  test("blocked storage keeps work on the page and each round's text in memory", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    await renderAt();
    expect(id("commissioner-storage-alert").textContent).toMatch(/blocking local storage/);
    await setValue(id("commissioner-body"), "Only on this page");
    await setValue(id("commissioner-round"), ROUND_TWO, "change");
    await setValue(id("commissioner-round"), ROUND_ONE, "change");
    expect(id("commissioner-body").value).toBe("Only on this page");
    await save();
    expect(text()).not.toContain("Saved locally");
  });

  test.each([
    ["corrupt", "{oops", /can't be read/],
    ["an unknown version", JSON.stringify({ ...emptyDoc(), version: 99 }), /different version/],
  ])("%s data is refused without removal and recovers only through a confirmed step", async (_name, raw, message) => {
    storage.setItem(STORE_KEY, raw);
    window.localStorage.setItem("unrelated", "keep");
    await renderAt();
    expect(id("commissioner-storage-alert").textContent).toMatch(message);

    await setValue(id("commissioner-body"), "Text typed anyway");
    await save();
    expect(id("commissioner-body").value).toBe("Text typed anyway");
    expect(text()).not.toContain("Saved locally");
    expect(storage.getItem(STORE_KEY)).toBe(raw);

    await click(id("commissioner-set-aside"));
    expect(document.activeElement).toBe(id("commissioner-set-aside-yes"));
    await click(id("commissioner-set-aside-no"));
    expect(document.activeElement).toBe(id("commissioner-set-aside"));
    expect(storage.getItem(STORE_KEY)).toBe(raw);

    await click(id("commissioner-set-aside"));
    expect(storage.getItem(STORE_KEY)).toBe(raw);
    expect(id("commissioner-set-aside-confirm").textContent).toMatch(/Nothing is deleted/);

    await click(id("commissioner-set-aside-yes"));
    expect(id("commissioner-storage-alert")).toBeNull();
    expect(document.activeElement).toBe(q("#commissioner-title"));
    expect(id("commissioner-recovery-note").textContent).toContain(`${STORE_KEY}.set-aside.`);
    const copyKey = id("commissioner-recovery-note").textContent.match(/under (\S+)\./)[1];
    expect(storage.getItem(copyKey)).toBe(raw);
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
    expect(id("commissioner-body").value).toBe("Text typed anyway");

    await checkGame("g-1");
    await write("Heading", "Text typed anyway");
    await save();
    expect(id("commissioner-save-state").textContent).toContain("Saved locally");
  });

  const otherTabWrites = (body) => {
    const revision = loadStore(storage).doc.rounds[ROUND_ONE]?.revision || 0;
    expect(saveWorking(storage, { roundKey: ROUND_ONE, expectedRevision: revision, heading: "Other tab", body }).ok).toBe(true);
  };

  test("another tab's write is refused visibly, and only an explicit choice replaces either side", async () => {
    await renderAt();
    await write("Mine", "This tab");
    otherTabWrites("Other tab's text");
    const stored = storage.getItem(STORE_KEY);

    await setValue(id("commissioner-body"), "This tab, still typing");
    expect(id("commissioner-conflict").getAttribute("role")).toBe("alert");
    expect(id("commissioner-body").value).toBe("This tab, still typing");
    expect(storage.getItem(STORE_KEY)).toBe(stored);

    await save();
    expect(text()).not.toContain("Saved locally");
    expect(storage.getItem(STORE_KEY)).toBe(stored);

    await click(id("commissioner-keep-mine"));
    expect(id("commissioner-conflict")).toBeNull();
    expect(loadStore(storage).doc.rounds[ROUND_ONE].working.body).toBe("This tab, still typing");
  });

  test("a storage event turns differing text into a stated conflict, and the other version can be loaded", async () => {
    await renderAt();
    await write("Mine", "This tab");
    otherTabWrites("Other tab's text");
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: RAW_KEY }));
    });
    expect(id("commissioner-conflict")).not.toBeNull();
    expect(id("commissioner-body").value).toBe("This tab");

    await click(id("commissioner-load-stored"));
    expect(id("commissioner-conflict")).toBeNull();
    expect(id("commissioner-body").value).toBe("Other tab's text");
  });

  test("a storage event for an unrelated key changes nothing", async () => {
    await renderAt();
    await write("Mine", "This tab");
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    expect(id("commissioner-conflict")).toBeNull();
    expect(id("commissioner-body").value).toBe("This tab");
  });

  test("over-limit text stays editable and is refused with the amount to trim", async () => {
    await renderAt();
    await setValue(id("commissioner-heading"), "x".repeat(125));
    expect(id("commissioner-error").textContent).toContain("5 characters over the 120 limit");
    expect(id("commissioner-heading").value).toHaveLength(125);
    expect(id("commissioner-heading").getAttribute("aria-invalid")).toBe("true");
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });

  test("no rounds says so", async () => {
    mockState = { ...mockState, games: [] };
    await renderAt("/admin/commissioner");
    expect(id("commissioner-no-rounds")).not.toBeNull();
  });

  test("controls are labeled native elements and the page links back to the comparison", async () => {
    await renderAt();
    expect(id("commissioner-round").tagName).toBe("SELECT");
    ["commissioner-round", "commissioner-heading", "commissioner-body"].forEach((name) => {
      expect(q(`label[for="${id(name).id}"]`)).not.toBeNull();
    });
    expect(id("commissioner-back").getAttribute("href")).toBe("/admin");
    expect(gameRow("g-1").querySelector("button").getAttribute("aria-label")).toBe("Check result: Bravo at Alpha");
    expect(id("commissioner-save-state").getAttribute("role")).toBe("status");
  });

  test("backend actor changes remount drafts; pending auth never reads the private workspace", async () => {
    mockBackend = true;
    const previousProject = process.env.REACT_APP_SUPABASE_URL;
    process.env.REACT_APP_SUPABASE_URL = "https://one.supabase.co";
    mockRole = { role: "admin", authStatus: "ready", session: { user: { id: "actor-a" } } };
    await renderAt(); await write("Actor A", "Private A");
    expect(text()).toContain("Current loaded league data");
    const aKeys = Object.keys(window.localStorage); expect(aKeys).toHaveLength(1);
    mockRole = { ...mockRole, session: { user: { id: "actor-b" } } }; await renderAt();
    expect(id("commissioner-body").value).toBe(""); await write("Actor B", "Private B");
    mockRole = { ...mockRole, authStatus: "checking" }; await renderAt();
    expect(id("commissioner")).toBeNull(); expect(text()).not.toContain("Private B");
    mockRole = { role: "admin", authStatus: "ready", session: { user: { id: "actor-a" } } }; await renderAt();
    expect(id("commissioner-body").value).toBe("Private A");
    process.env.REACT_APP_SUPABASE_URL = "https://two.supabase.co"; await renderAt();
    expect(id("commissioner-body").value).toBe("");
    if (previousProject === undefined) delete process.env.REACT_APP_SUPABASE_URL;
    else process.env.REACT_APP_SUPABASE_URL = previousProject;
  });

  test("signout unmounts draft text and another role cannot reopen it", async () => {
    await renderAt(); await write("Private heading", "Private body");
    mockRole = { role: "anonymous", authStatus: "signed_out" }; await renderAt();
    expect(id("commissioner")).toBeNull(); expect(text()).not.toContain("Private body");
    mockRole = { role: "player", authStatus: "ready" }; await renderAt();
    expect(id("commissioner")).toBeNull();
    mockRole = { role: "admin", authStatus: "mock" }; await renderAt();
    expect(id("commissioner-body").value).toBe("Private body");
  });

});

describe("commissioner stylesheet", () => {
  const css = fs.readFileSync(path.join(__dirname, "Commissioner.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  test("is scoped, uses tokens only and contains narrow phones", () => {
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map((match) => match[1].trim())
      .filter((selector) => !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(10);
    selectors.flatMap((selector) => selector.split(",")).map((selector) => selector.trim()).forEach((selector) => {
      expect(selector.startsWith(".cvf-commissioner")).toBe(true);
    });
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/white-space:\s*nowrap/);
    expect(css).not.toMatch(/(?:^|[\s;{])(?:min-)?width:\s*\d{3,}px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
