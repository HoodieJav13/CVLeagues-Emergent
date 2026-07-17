import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Schedule from "./Schedule";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState;
let mockAnimationFrames;
let mockNextAnimationFrame;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("../components/game/GameCard", () => ({
  GameCard: ({ game }) => <div data-testid={`game-card-${game.id}`} />,
}));

jest.mock("../components/ui/select", () => {
  const ReactModule = require("react");
  const SelectContext = ReactModule.createContext(() => {});
  const nextValue = {
    "schedule-filter-sport": "flag_football",
    "schedule-filter-season": "all",
    "schedule-filter-league": "all",
    "schedule-filter-team": "all",
    "schedule-filter-status": "completed",
  };
  return {
    Select: ({ children, onValueChange }) => <SelectContext.Provider value={onValueChange}>{children}</SelectContext.Provider>,
    SelectTrigger: ({ children, ...props }) => {
      const onValueChange = ReactModule.useContext(SelectContext);
      return <button type="button" onClick={() => onValueChange(nextValue[props["data-testid"]])} {...props}>{children}</button>;
    },
    SelectValue: () => <span />,
    SelectContent: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children }) => <div>{children}</div>,
  };
});

describe("Schedule visual contracts", () => {
  let container;
  let root;

  beforeEach(() => {
    mockAnimationFrames = new Map();
    mockNextAnimationFrame = 1;
    window.requestAnimationFrame = jest.fn((callback) => {
      const frame = mockNextAnimationFrame++;
      mockAnimationFrames.set(frame, callback);
      return frame;
    });
    window.cancelAnimationFrame = jest.fn((frame) => mockAnimationFrames.delete(frame));
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
    expect(trigger?.id).toBe("schedule-filter-sport");
    expect(trigger?.getAttribute("aria-labelledby")).toBe("schedule-filter-sport-label");
    expect(container.querySelector('#schedule-filter-sport-label')?.getAttribute("for")).toBe("schedule-filter-sport");
  });

  test("bridges committed filter results and cancels superseded frames", async () => {
    await act(async () => root.render(<Schedule />));

    const initial = container.querySelector('[data-testid="schedule-results"]');
    expect(initial?.className).toContain("opacity-100");
    expect(initial?.className).toContain("transition-opacity");
    expect(initial?.className).toContain("duration-cvf-fast");
    expect(initial?.className).toContain("ease-cvf-out");
    expect(initial?.className).toContain("motion-reduce:opacity-100");
    expect(initial?.className).toContain("motion-reduce:transition-none");

    await act(async () => {
      container.querySelector('[data-testid="schedule-filter-sport"]').click();
    });
    const firstFrame = 1;
    expect(container.querySelector('[data-testid="schedule-results"]')?.className).toContain("opacity-75");
    expect(mockAnimationFrames.has(firstFrame)).toBe(true);

    await act(async () => {
      container.querySelector('[data-testid="schedule-filter-season"]').click();
    });
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(firstFrame);
    const latestFrame = 2;
    expect(mockAnimationFrames.has(latestFrame)).toBe(true);

    await act(async () => {
      const callback = mockAnimationFrames.get(latestFrame);
      mockAnimationFrames.delete(latestFrame);
      callback();
    });
    expect(container.querySelector('[data-testid="schedule-results"]')?.className).toContain("opacity-100");
  });
});
