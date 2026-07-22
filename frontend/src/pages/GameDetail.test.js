import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GameDetail from "./GameDetail";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockRole;
let mockRoleMeta;
let mockState;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("../context/RoleContext", () => ({
  useRole: () => ({ role: mockRole, roleMeta: mockRoleMeta }),
}));

jest.mock("react-router-dom", () => ({
  useParams: () => ({ id: "game-1" }),
  useNavigate: () => jest.fn(),
  Link: ({ to, state, children, ...props }) => (
    <a href={to} data-route-state={JSON.stringify(state)} {...props}>{children}</a>
  ),
}), { virtual: true });

describe("GameDetail score action", () => {
  let container;
  let root;

  beforeEach(() => {
    mockRole = "admin";
    mockRoleMeta = {};
    mockState = {
      games: [{
        id: "game-1",
        sport: "kickball",
        status: "upcoming",
        date: "2026-07-20",
        time: "6:30 PM",
        location: "Mesa Field",
        away_team_id: "away",
        home_team_id: "home",
      }],
      teams: [
        { id: "away", name: "Away", logo_color: "#5BB8CC" },
        { id: "home", name: "Home", logo_color: "#FB923C" },
      ],
      profiles: [],
      playerStats: [],
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("renders an authorized score link through the shared Button contract", async () => {
    await act(async () => root.render(<GameDetail />));

    const title = container.querySelector('[data-testid="game-detail-heading"] h1');
    expect(title?.className).toContain("text-display-xl");
    expect(title?.className).not.toContain("text-display-lg");

    const action = container.querySelector('[data-testid="game-enter-score"]');
    expect(action?.tagName).toBe("A");
    expect(action?.getAttribute("href")).toBe("/score-entry");
    expect(action?.getAttribute("data-route-state")).toBe('{"game_id":"game-1"}');
    expect(action?.textContent).toContain("Enter Score");
    expect(action?.className).toContain("bg-primary");
    expect(action?.className).toContain("h-11");
    expect(action?.className).toContain("md:h-11");
    expect(action?.className).not.toContain("transition-all");
    expect(action?.querySelector('[data-icon="inline-start"]')).not.toBeNull();

    const frame = container.querySelector('[data-testid="game-event-frame"]');
    expect(frame?.getAttribute("data-game-state")).toBe("upcoming");
    expect(frame?.querySelectorAll('[data-cvf-identity-badge="true"]')).toHaveLength(2);
    expect(frame?.querySelector(".cvf-upcoming-focal__date")?.textContent).toBe("Jul 20");
    expect(frame?.querySelector(".cvf-upcoming-focal__time")?.textContent).toBe("6:30 PM");
  });

  test("does not expose the action to a role without score permission", async () => {
    mockRole = "anonymous";
    await act(async () => root.render(<GameDetail />));

    expect(container.querySelector('[data-testid="game-enter-score"]')).toBeNull();
  });

  test("renders final scores with the enlarged structural score treatment", async () => {
    mockState = {
      ...mockState,
      games: [{
        ...mockState.games[0],
        status: "completed",
        away_score: 8,
        home_score: 5,
        periods: { away: [], home: [] },
      }],
    };

    await act(async () => root.render(<GameDetail />));

    const frame = container.querySelector('[data-testid="game-event-frame"]');
    expect(frame?.getAttribute("data-game-state")).toBe("completed");
    expect(frame?.querySelector(".cvf-upcoming-focal")).toBeNull();
    expect([...frame.querySelectorAll(".cvf-game-score")].map((node) => node.textContent)).toEqual(["8", "5"]);
  });

  test("shows a final forfeit without numeric scores or an invalid correction action", async () => {
    mockState = {
      ...mockState,
      games: [{
        ...mockState.games[0], status: "canceled", score_status: "final", locked: true,
        outcome_type: "forfeit", winner_team_id: "away", loser_team_id: "home",
        away_score: null, home_score: null, periods: { away: [], home: [] },
      }],
    };

    await act(async () => root.render(<GameDetail />));
    const frame = container.querySelector('[data-testid="game-event-frame"]');
    expect(frame?.textContent).toContain("Forfeit");
    expect([...frame.querySelectorAll(".cvf-game-score")].map((node) => node.textContent)).toEqual(["W", "L"]);
    expect(container.querySelector('[data-testid="game-enter-score"]')).toBeNull();
  });
});
