import React, { act } from "react";
import { createRoot } from "react-dom/client";
import TeamPage from "./TeamPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("react-router-dom", () => ({
  useParams: () => ({ id: "t1" }),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

/* ============================================================================
 * Team-form sparkline — the Addendum 7 contract, asserted:
 * behind an explicit toggle and never open by default; aria-hidden SVG; a dot
 * per finalized game; absent entirely below two finalized games.
 * ========================================================================== */

const game = (id, home_score, away_score, extra = {}) => ({
  id, league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2",
  starts_at: `2026-06-0${id.slice(-1)}T18:00:00-06:00`, venue_id: null,
  status: "completed", score_status: "approved", home_score, away_score,
  periods: { home: [], away: [] }, locked: false, edit_history: [], ...extra,
});

function baseState(games) {
  return {
    teams: [
      { id: "t1", identity_id: "ti1", name: "Sluggers", sport: "kickball", league_id: "l1", captain_id: null, logo_color: "#22d3ee", status: "active" },
      { id: "t2", identity_id: "ti2", name: "Rollers", sport: "kickball", league_id: "l1", captain_id: null, logo_color: "#f97316", status: "active" },
    ],
    team_identities: [], leagues: [{ id: "l1", name: "Duke City", sport: "kickball", season: "Summer 2026", kind: "league" }],
    teamPlayers: [], profiles: [], playerStats: [], venues: [],
    games,
  };
}

describe("TeamPage form sparkline", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("closed by default; opening reveals an aria-hidden SVG with one dot per finalized game", async () => {
    mockState = baseState([game("g1", 5, 3), game("g2", 2, 4), game("g3", 6, 6)]);
    await act(async () => root.render(<TeamPage />));

    const toggle = container.querySelector('[data-testid="team-form-toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="team-form-graph"]')).toBeNull();

    await act(async () => toggle.click());
    const figure = container.querySelector('[data-testid="team-form-graph"]');
    expect(figure).not.toBeNull();
    const svg = figure.querySelector("svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(figure.querySelectorAll("circle").length).toBe(3);
  });

  test("absent below two finalized games — a one-game line is noise, not form", async () => {
    mockState = baseState([game("g1", 5, 3), game("g2", 2, 4, { status: "upcoming", score_status: "pending", home_score: null, away_score: null })]);
    await act(async () => root.render(<TeamPage />));
    expect(container.querySelector('[data-testid="team-form-toggle"]')).toBeNull();
  });
});
