import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Standings from "./Standings";

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

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock("../components/ui/select", () => {
  const ReactModule = require("react");
  const SelectContext = ReactModule.createContext(() => {});
  const nextValue = {
    "standings-filter-sport": "flag_football",
    "standings-filter-season": "Summer 2026",
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

describe("Standings result motion", () => {
  let container;
  let root;

  beforeEach(() => {
    mockState = {
      settings: { current_seasons: { kickball: "Summer 2026", flag_football: "Summer 2026" } },
      seasons: [{ name: "Summer 2026", status: "active" }],
      leagues: [
        { id: "kickball-league", name: "Kickball", sport: "kickball", season: "Summer 2026", kind: "league", playoff_format: "single_elim" },
        { id: "football-league", name: "Football", sport: "flag_football", season: "Summer 2026", kind: "league", playoff_format: "single_elim" },
      ],
      teams: [
        { id: "kickball-team", name: "Kickball Team", league_id: "kickball-league", logo_color: "#fff" },
        { id: "football-team", name: "Football Team", league_id: "football-league", logo_color: "#000" },
      ],
      games: [],
    };
    mockAnimationFrames = new Map();
    mockNextAnimationFrame = 1;
    window.requestAnimationFrame = jest.fn((callback) => {
      const frame = mockNextAnimationFrame++;
      mockAnimationFrames.set(frame, callback);
      return frame;
    });
    window.cancelAnimationFrame = jest.fn((frame) => mockAnimationFrames.delete(frame));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("bridges committed filters with the named opacity contract", async () => {
    await act(async () => root.render(<Standings />));

    const initial = container.querySelector('[data-testid="standings-results"]');
    expect(initial?.className).toContain("opacity-100");
    expect(initial?.className).toContain("transition-opacity");
    expect(initial?.className).toContain("duration-cvf-fast");
    expect(initial?.className).toContain("ease-cvf-out");
    expect(initial?.className).toContain("motion-reduce:opacity-100");
    expect(initial?.className).toContain("motion-reduce:transition-none");

    const sportTrigger = container.querySelector('[data-testid="standings-filter-sport"]');
    expect(sportTrigger?.id).toBe("standings-filter-sport");
    expect(sportTrigger?.getAttribute("aria-labelledby")).toBe("standings-filter-sport-label");
    expect(container.querySelector('#standings-filter-sport-label')?.getAttribute("for")).toBe("standings-filter-sport");
    const row = container.querySelector('[data-testid="standings-row-kickball-team"]');
    expect(row?.getAttribute("aria-label")).toContain("Kickball Team: playoff seed 1");
    expect(row?.getAttribute("aria-label")).toContain("wins");
    expect(row?.dataset.playoffQualified).toBe("true");
    expect(row?.querySelector('[data-cvf-identity-badge="true"]')).not.toBeNull();
    expect(container.textContent).toContain("All teams qualify · final standings set playoff seeds");

    await act(async () => {
      container.querySelector('[data-testid="standings-filter-sport"]').click();
    });
    expect(container.querySelector('[data-testid="standings-results"]')?.className).toContain("opacity-75");
    expect(mockAnimationFrames.has(1)).toBe(true);

    await act(async () => {
      container.querySelector('[data-testid="standings-filter-season"]').click();
    });
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mockAnimationFrames.has(2)).toBe(true);

    await act(async () => {
      const callback = mockAnimationFrames.get(2);
      mockAnimationFrames.delete(2);
      callback();
    });
    expect(container.querySelector('[data-testid="standings-results"]')?.className).toContain("opacity-100");
  });
});
