import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import Playoffs from "./Playoffs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockUseApp;
const mockGeneratePlayoffBracket = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => mockUseApp(),
}));

jest.mock("../context/RoleContext", () => ({
  useRole: () => ({ role: "admin" }),
}));

jest.mock("../lib/selectors", () => ({
  computeStandings: (state, leagueId) => state.teams
    .filter((team) => team.league_id === leagueId)
    .map((team, index) => ({ team, rank: index + 1, record: { wins: 4 - index, losses: index, diff: 8 - index } })),
  getTeam: (state, teamId) => state.teams.find((team) => team.id === teamId),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock("sonner", () => ({
  toast: { success: (...args) => mockToastSuccess(...args) },
}));

jest.mock("../components/ui/select", () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  SelectValue: () => <span />,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

const baseState = {
  leagues: [{
    id: "league-1",
    name: "Monday Kickball",
    kind: "league",
    sport: "kickball",
    season: "Summer 2026",
    playoff_format: "single_elim",
  }],
  teams: Array.from({ length: 4 }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    league_id: "league-1",
    logo_color: "#14b8a6",
  })),
  games: [],
  playoffBrackets: [],
  playoffSeeds: [],
  playoffMatches: [],
};

function useBracketGenerationApp() {
  const [state, setState] = useState(baseState);
  const generatePlayoffBracket = async ({ league_id, seed_team_ids }) => {
    mockGeneratePlayoffBracket({ league_id, seed_team_ids });
    setState((current) => ({
      ...current,
      playoffBrackets: [{ id: "bracket-1", league_id, status: "scheduled" }],
    }));
  };
  return { state, generatePlayoffBracket };
}

function useExistingBracketApp() {
  return {
    state: {
      ...baseState,
      playoffBrackets: [{ id: "bracket-existing", league_id: "league-1", status: "scheduled" }],
    },
    generatePlayoffBracket: jest.fn(),
  };
}

function useReadyMatchApp() {
  return {
    state: {
      ...baseState,
      games: [{
        id: "game-1",
        league_id: "league-1",
        stage: "playoff",
        home_team_id: "team-1",
        away_team_id: "team-2",
        date: "2026-08-10",
        time: "6:30 PM",
        status: "upcoming",
      }],
      playoffBrackets: [{ id: "bracket-ready", league_id: "league-1", status: "scheduled" }],
      playoffMatches: [{
        id: "match-1",
        bracket_id: "bracket-ready",
        round_number: 1,
        match_number: 1,
        label: "Semifinal",
        status: "ready",
        home_team_id: "team-1",
        away_team_id: "team-2",
        home_seed: 1,
        away_seed: 4,
        game_id: null,
      }],
    },
    generatePlayoffBracket: jest.fn(),
    linkPlayoffGame: jest.fn(),
    schedulePlayoffMatch: jest.fn(),
    advancePlayoffMatch: jest.fn(),
  };
}

describe("Playoffs bracket reveal", () => {
  let container;
  let root;

  beforeEach(() => {
    mockGeneratePlayoffBracket.mockClear();
    mockToastSuccess.mockClear();
    mockUseApp = useBracketGenerationApp;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("replaces seeding with an immediately available local reveal after generation", async () => {
    await act(async () => root.render(<Playoffs />));

    expect(container.querySelector('[data-testid="playoff-bracket-reveal"]')).toBeNull();
    expect(container.textContent).toContain("Review Seeding");
    expect(container.querySelector('[data-testid="playoffs-sport"]')?.getAttribute("aria-labelledby")).toBe("playoffs-sport-label");
    expect(container.querySelector('#playoffs-sport-label')?.getAttribute("for")).toBe("playoffs-sport");

    await act(async () => {
      container.querySelector('[data-testid="generate-bracket"]').click();
      await Promise.resolve();
    });

    const reveal = container.querySelector('[data-testid="playoff-bracket-reveal"]');
    expect(mockGeneratePlayoffBracket).toHaveBeenCalledWith({
      league_id: "league-1",
      seed_team_ids: ["team-1", "team-2", "team-3", "team-4"],
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Bracket generated and seeds locked");
    expect(container.textContent).not.toContain("Review Seeding");
    expect(reveal?.className).toContain("space-y-5");
    expect(reveal?.className).toContain("animate-fade-in");
    expect(reveal?.querySelector('[data-testid="playoff-bracket"]')).not.toBeNull();
  });

  test("uses the same reveal owner for an existing bracket", async () => {
    mockUseApp = useExistingBracketApp;
    await act(async () => root.render(<Playoffs />));

    const reveal = container.querySelector('[data-testid="playoff-bracket-reveal"]');
    expect(reveal?.className).toContain("animate-fade-in");
    expect(reveal?.querySelector('[data-testid="playoff-bracket"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Review Seeding");
  });

  test("labels every scheduling control in the match dialog", async () => {
    mockUseApp = useReadyMatchApp;
    await act(async () => root.render(<Playoffs />));

    const dialogTrigger = container.querySelector('[data-testid="schedule-match-match-1"]');
    await act(async () => {
      dialogTrigger.click();
    });

    const existingMatch = document.querySelector('[data-testid="playoffs-existing-match"]');
    expect(existingMatch?.getAttribute("aria-labelledby")).toBe("playoffs-existing-match-label");
    expect(document.querySelector('#playoffs-existing-match-label')?.getAttribute("for")).toBe("playoffs-existing-match");
    expect(document.activeElement).toBe(existingMatch);

    for (const [id, label] of [
      ["playoff-match-date", "Date (required)"],
      ["playoff-match-time", "Time (required)"],
      ["playoff-match-location", "Location (required)"],
    ]) {
      const input = document.getElementById(id);
      expect(input?.required).toBe(true);
      expect(document.querySelector(`label[for="${id}"]`)?.textContent).toBe(label);
    }

    await act(async () => {
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.getElementById("playoff-match-date")).toBeNull();
    expect(document.activeElement).toBe(dialogTrigger);
  });
});
