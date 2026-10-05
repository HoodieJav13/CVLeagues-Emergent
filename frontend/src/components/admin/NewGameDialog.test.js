/* ============================================================================
 * Admin New Game — creating a regular-season game.
 *
 * Contract under test: only active regular-season leagues, only active teams
 * enrolled in the chosen league, two different teams, a real league-time
 * kickoff, an active venue; exactly one schedule-only write per save; a failed
 * save keeps the form for retry; Cancel writes nothing.
 * ========================================================================== */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import NewGameDialog, { buildNewGamePayload, validateNewGame } from "./NewGameDialog";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });
jest.mock("@/components/ui/button", () => jest.requireActual("../ui/button"), { virtual: true });
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const { toast } = require("sonner");

const state = {
  leagues: [
    { id: "l1", name: "Rehearsal Kickball", sport: "kickball", season: "Spring 2027", kind: "league" },
    { id: "l2", name: "Rehearsal Flag", sport: "flag_football", season: "Spring 2027", kind: "league" },
    { id: "l3", name: "Cup", sport: "kickball", season: "Spring 2027", kind: "tournament" },
    { id: "l4", name: "Old League", sport: "kickball", season: "Fall 2025", kind: "league", status: "archived" },
  ],
  teams: [
    { id: "t1", name: "Arroyo Alley Cats", league_id: "l1", sport: "kickball", division: "North" },
    { id: "t2", name: "Juniper Jacks", league_id: "l1", sport: "kickball", division: "North" },
    { id: "t3", name: "Volcano Vista Kicks", league_id: "l1", sport: "kickball", division: "South" },
    { id: "t4", name: "Retired Rockets", league_id: "l1", sport: "kickball", status: "inactive" },
    { id: "t5", name: "Bluebird Blitz", league_id: "l2", sport: "flag_football" },
    { id: "t6", name: "Sandstone Sprinters", league_id: "l2", sport: "flag_football" },
  ],
  venues: [
    { id: "v1", name: "Mesa Vista Park", field_label: "Field 1", status: "active" },
    { id: "v2", name: "Old Yard", field_label: null, status: "retired" },
  ],
  games: [],
};

const ordinary = { league_id: "l1", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-10-13T19:00", venue_id: "v1" };

describe("validateNewGame", () => {
  test("an ordinary game produces the schedule-only payload with sport derived from the league", () => {
    const { errors, payload } = validateNewGame(state, ordinary);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2",
      starts_at: "2026-10-14T01:00:00.000Z", venue_id: "v1", stage: "regular",
    });
  });

  test("every required value is named when missing", () => {
    const { errors, payload } = validateNewGame(state, {});
    expect(payload).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["away_team_id", "home_team_id", "league_id", "starts_at", "venue_id"]);
  });

  test("the same team cannot play itself", () => {
    const { errors, payload } = validateNewGame(state, { ...ordinary, away_team_id: "t1" });
    expect(payload).toBeNull();
    expect(errors.away_team_id).toMatch(/different teams/i);
  });

  test("teams must be active enrollments in the chosen league", () => {
    expect(validateNewGame(state, { ...ordinary, away_team_id: "t5" }).errors.away_team_id).toMatch(/not an active team in Rehearsal Kickball/);
    expect(validateNewGame(state, { ...ordinary, away_team_id: "t4" }).errors.away_team_id).toMatch(/not an active team/);
  });

  test("tournaments, archived leagues and retired venues are refused", () => {
    expect(validateNewGame(state, { ...ordinary, league_id: "l3" }).errors.league_id).toMatch(/regular-season league/);
    expect(validateNewGame(state, { ...ordinary, league_id: "l4" }).errors.league_id).toMatch(/regular-season league/);
    expect(validateNewGame(state, { ...ordinary, venue_id: "v2" }).errors.venue_id).toMatch(/active venue/);
  });

  test("teams in different named divisions cannot be paired", () => {
    expect(validateNewGame(state, { ...ordinary, away_team_id: "t3" }).errors.away_team_id).toMatch(/division North.*division South/);
  });

  test("a kickoff the clocks skip is refused with the converter's guidance", () => {
    const { errors, payload } = validateNewGame(state, { ...ordinary, starts_at: "2027-03-14T02:30" });
    expect(payload).toBeNull();
    expect(errors.starts_at).toMatch(/does not exist/);
  });

  test("a fall-back kickoff that happens twice is refused until the league decides which one counts", () => {
    const { errors, payload } = validateNewGame(state, { ...ordinary, starts_at: "2026-11-01T01:30" });
    expect(payload).toBeNull();
    expect(errors.starts_at).toMatch(/happens twice/);
  });

  test("buildNewGamePayload is the validated payload or null", () => {
    expect(buildNewGamePayload(state, ordinary)).toEqual(validateNewGame(state, ordinary).payload);
    expect(buildNewGamePayload(state, {})).toBeNull();
  });
});

const setValue = (element, value) => {
  const proto = element.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
};
const field = (id) => document.querySelector(`[data-testid="new-game-${id}"]`);

describe("New Game dialog", () => {
  let container;
  let root;
  let app;
  let onOpenChange;

  const render = async (createEntity = jest.fn().mockResolvedValue(undefined)) => {
    app = { state, createEntity };
    onOpenChange = jest.fn();
    await act(async () => root.render(<NewGameDialog app={app} open onOpenChange={onOpenChange} />));
  };
  const fill = async (values = ordinary) => {
    await act(async () => setValue(field("league"), values.league_id));
    await act(async () => setValue(field("home"), values.home_team_id));
    await act(async () => setValue(field("away"), values.away_team_id));
    await act(async () => setValue(field("start"), values.starts_at));
    await act(async () => setValue(field("venue"), values.venue_id));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("offers only active regular-season leagues, the chosen league's active teams, and active venues", async () => {
    await render();
    const options = (el) => [...el.options].map((option) => option.value).filter(Boolean);
    expect(options(field("league"))).toEqual(["l1", "l2"]);
    expect(field("league").textContent).toContain("Rehearsal Kickball · Kickball · Spring 2027");
    expect(options(field("venue"))).toEqual(["v1"]);
    await act(async () => setValue(field("league"), "l1"));
    expect(options(field("home"))).toEqual(["t1", "t2", "t3"]);
    await act(async () => setValue(field("home"), "t1"));
    await act(async () => setValue(field("league"), "l2"));
    expect(field("home").value).toBe("");
    expect(options(field("away"))).toEqual(["t5", "t6"]);
  });

  test("saves exactly one schedule-only game and closes", async () => {
    await render();
    await fill();
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    expect(app.createEntity).toHaveBeenCalledTimes(1);
    expect(app.createEntity).toHaveBeenCalledWith("games", { id: expect.any(String), ...validateNewGame(state, ordinary).payload }, "g");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalled();
  });

  test("invalid input writes nothing and says what to fix", async () => {
    await render();
    await fill({ ...ordinary, away_team_id: "t1" });
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    expect(app.createEntity).not.toHaveBeenCalled();
    expect(field("away").getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector('[data-testid="new-game-errors"]').textContent).toMatch(/different teams/i);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("a double-click creates one game and the save is disabled while pending", async () => {
    let finish;
    await render(jest.fn(() => new Promise((resolve) => { finish = resolve; })));
    await fill();
    const save = document.querySelector('[data-testid="new-game-save"]');
    await act(async () => {
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(save.disabled).toBe(true);
    await act(async () => finish());
    expect(app.createEntity).toHaveBeenCalledTimes(1);
  });

  test("a save that finishes between the two clicks of a double-click still creates one game", async () => {
    await render();
    await fill();
    const save = document.querySelector('[data-testid="new-game-save"]');
    await act(async () => save.click());
    // The dialog may still be on screen while it animates closed.
    await act(async () => save.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(app.createEntity).toHaveBeenCalledTimes(1);
  });

  test("a failed save keeps the values open for a retry", async () => {
    const createEntity = jest.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(undefined);
    await render(createEntity);
    await fill();
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(field("home").value).toBe("t1");
    expect(document.querySelector('[data-testid="new-game-save"]').disabled).toBe(false);
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    expect(createEntity).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("a retry after an insert that committed but failed to refresh reuses the same game id (no duplicate game)", async () => {
    // Hosted createEntity = INSERT then full refetch; a refetch failure rejects
    // even though the row exists. The retry must collide, not insert twice.
    const createEntity = jest.fn()
      .mockRejectedValueOnce(new Error("fetch games: network down"))
      .mockResolvedValueOnce(undefined);
    await render(createEntity);
    await fill();
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    expect(createEntity).toHaveBeenCalledTimes(2);
    const [first, second] = createEntity.mock.calls.map((call) => call[1]);
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second.id).toBe(first.id);
    expect({ ...second, id: undefined }).toEqual({ ...validateNewGame(state, ordinary).payload, id: undefined });
  });

  test("each newly opened form gets a fresh game id", async () => {
    await render();
    await fill();
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    await act(async () => root.render(<NewGameDialog app={app} open={false} onOpenChange={onOpenChange} />));
    await act(async () => root.render(<NewGameDialog app={app} open onOpenChange={onOpenChange} />));
    await fill();
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    const ids = app.createEntity.mock.calls.map((call) => call[1].id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  test("two refusals with the same wording render without key collisions", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await render();
    await fill();
    // A refresh removes both selected teams: home and away get identical wording.
    const refreshed = { ...state, teams: state.teams.filter((team) => !["t1", "t2"].includes(team.id)) };
    await act(async () => root.render(<NewGameDialog app={{ ...app, state: refreshed }} open onOpenChange={onOpenChange} />));
    await act(async () => document.querySelector('[data-testid="new-game-save"]').click());
    expect(document.querySelector('[data-testid="new-game-errors"]').textContent).toContain("That team is not an active team");
    expect(spy.mock.calls.filter((call) => String(call[0]).includes("same key"))).toEqual([]);
    spy.mockRestore();
  });

  test("Cancel writes nothing", async () => {
    await render();
    await fill();
    await act(async () => document.querySelector('[data-testid="new-game-cancel"]').click());
    expect(app.createEntity).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
