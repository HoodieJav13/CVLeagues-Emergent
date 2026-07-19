import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const baseState = {
  leagues: [{ id: "league-1", name: "Monday Kickball", sport: "kickball" }],
  games: [],
  teams: [],
};

const teams = [
  { id: "away", name: "The Exceptionally Long Westside Roadrunners", logo_color: "#5BB8CC" },
  { id: "home", name: "Downtown", logo_color: "#FB923C" },
];

const game = (id, status = "upcoming") => ({
  id,
  league_id: "league-1",
  sport: "kickball",
  status,
  date: status === "completed" ? "2026-07-10" : "2026-07-20",
  time: "6:30 PM",
  location: "Mesa Field",
  away_team_id: "away",
  home_team_id: "home",
  away_score: status === "completed" ? 8 : null,
  home_score: status === "completed" ? 5 : null,
});

describe("Home hierarchy", () => {
  let container;
  let root;

  beforeEach(() => {
    mockState = baseState;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("lets the shell own the brand and renders one desktop intake group", async () => {
    await act(async () => {
      root.render(<Home />);
    });

    expect(container.querySelector("h1")?.textContent).toBe("Current Leagues");
    expect(container.querySelector("h1")?.className).toContain("text-display-xl");
    expect(container.querySelector("h1")?.className).not.toContain("text-display-lg");
    expect(container.textContent).not.toContain("CVF Sports");
    expect(container.querySelectorAll('a[href="/register-team"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/free-agent-signup"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="home-desktop-join-actions"]')?.className).toContain("hidden");
    expect(container.querySelector('[data-testid="cta-register-team"]')).toBeNull();
    expect(container.querySelector('[data-testid="cta-free-agent"]')).toBeNull();
    expect(container.firstElementChild?.className).not.toContain("animate-fade-up");
    expect(container.querySelector('[data-testid="home-sport-select"]')?.getAttribute("aria-labelledby")).toBe("home-sport-label");
    expect(container.querySelector('[data-testid="home-league-select"]')?.getAttribute("aria-labelledby")).toBe("home-league-label");
    expect(container.querySelector('label[for="home-sport-select"]')).not.toBeNull();
    expect(container.querySelector('label[for="home-league-select"]')).not.toBeNull();
  });

  test("uses count-aware grids and readable compact team names", async () => {
    mockState = {
      ...baseState,
      teams,
      games: [game("game-1")],
    };

    await act(async () => root.render(<Home />));

    expect(container.querySelector('[data-testid="home-scoreboard"]')?.className).toContain("grid-cols-1");
    expect(container.querySelector('[data-testid="home-upcoming-grid"]')?.className).toContain("max-w-2xl");
    expect(container.querySelector('[data-testid="home-upcoming-grid"]')?.className).toContain("duration-cvf-fast");
    expect(container.querySelector('[data-testid="home-upcoming-grid"]')?.className).toContain("opacity-100");

    const featured = container.querySelector('[data-testid="home-scoreboard-up-next"]');
    expect(featured?.className).not.toContain("transition-");
    expect(featured?.className).not.toContain("transition-all");

    const teamName = [...container.querySelectorAll("span")]
      .find((element) => element.textContent === "The Exceptionally Long Westside Roadrunners");
    expect(teamName?.className).toContain("font-sans");
    expect(teamName?.className).toContain("whitespace-normal");
    expect(teamName?.className).not.toContain("truncate");

    const scheduleAction = container.querySelector('a[href="/schedule"]');
    expect(scheduleAction?.className).not.toContain("transition-all");
    expect(scheduleAction?.querySelector("svg")?.classList.toString()).toContain("transition-transform");
  }, 15000);

  test("uses two-column and multi-column grid variants for larger sets", async () => {
    mockState = {
      ...baseState,
      teams,
      games: [game("game-1"), game("game-2")],
    };

    await act(async () => root.render(<Home />));
    expect(container.querySelector('[data-testid="home-upcoming-grid"]')?.className).toContain("sm:grid-cols-2");
    expect(container.querySelector('[data-testid="home-upcoming-grid"]')?.className).not.toContain("lg:grid-cols-3");

    mockState = {
      ...baseState,
      teams,
      games: [game("game-1"), game("game-2"), game("game-3")],
    };

    await act(async () => root.render(<Home />));
    expect(container.querySelector('[data-testid="home-upcoming-grid"]')?.className).toContain("lg:grid-cols-3");
  });
});
