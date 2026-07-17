import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Schedule from "./Schedule";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("../components/game/GameCard", () => ({
  GameCard: ({ game }) => <div data-testid={`game-card-${game.id}`} />,
}));

jest.mock("../components/ui/select", () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  SelectValue: () => <span />,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

describe("Schedule visual contracts", () => {
  let container;
  let root;

  beforeEach(() => {
    mockState = {
      settings: { current_season: "Summer 2026" },
      seasons: [{ name: "Summer 2026", status: "active" }],
      leagues: [{ id: "league-1", name: "Monday Kickball", sport: "kickball", season: "Summer 2026", kind: "league" }],
      teams: [
        { id: "away", name: "Away", league_id: "league-1", sport: "kickball" },
        { id: "home", name: "Home", league_id: "league-1", sport: "kickball" },
      ],
      games: [{
        id: "game-1",
        league_id: "league-1",
        sport: "kickball",
        status: "upcoming",
        date: "2026-07-20",
        home_team_id: "home",
        away_team_id: "away",
      }],
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("uses the sanctioned week heading and lets Select own trigger sizing", async () => {
    await act(async () => root.render(<Schedule />));

    const heading = container.querySelector('[data-testid^="schedule-week-"] h2');
    expect(heading?.textContent).toBe("Week of Jul 19");
    expect(heading?.className).toContain("font-display");
    expect(heading?.className).toContain("text-subheading");
    expect(heading?.className).toContain("text-foreground");
    expect(heading?.className).not.toContain("text-sm");
    expect(heading?.className).not.toContain("text-muted-foreground");

    const trigger = container.querySelector('[data-testid="schedule-filter-sport"]');
    expect(trigger?.className).toBe("bg-card border-border");
    expect(trigger?.className).not.toContain("h-10");
    expect(trigger?.className).not.toContain("text-sm");
  });
});
