import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Leaderboards from "./Leaderboards";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => {
  const { initialState } = require("../data/seed");
  return { useApp: () => ({ state: initialState }) };
});

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock("../components/ui/tabs", () => {
  const ReactModule = require("react");
  const TabsContext = ReactModule.createContext(() => {});
  return {
    Tabs: ({ children, onValueChange }) => <TabsContext.Provider value={onValueChange || (() => {})}>{children}</TabsContext.Provider>,
    TabsList: ({ children, ...props }) => <div {...props}>{children}</div>,
    TabsTrigger: ({ children, value, ...props }) => {
      const onValueChange = ReactModule.useContext(TabsContext);
      return <button type="button" onClick={() => onValueChange(value)} {...props}>{children}</button>;
    },
    TabsContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  };
});

jest.mock("../components/ui/select", () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  SelectValue: () => <span />,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

jest.mock("../components/player/RankedLeaderboardRow", () => ({
  FeaturedLeaderboardHero: ({ row, statLabel, titleId }) => (
    <div data-testid={`mock-hero-${row.profile.id}`}>
      <h2 id={titleId}>{statLabel}</h2>
      <span>{row.rankLabel}</span>
    </div>
  ),
  RankedLeaderboardRow: ({ row }) => <div data-testid={`mock-row-${row.profile.id}`}>{row.rankLabel}</div>,
}));

describe("Leaderboards multi-category dashboard", () => {
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

  test("renders every kickball category without a stat dropdown", async () => {
    await act(async () => root.render(<Leaderboards />));

    expect(container.querySelector('[data-testid="leaderboard-stat-select"]')).toBeNull();
    expect([...container.querySelectorAll('[data-testid^="leaderboard-module-"]')].map((module) => module.dataset.testid)).toEqual([
      "leaderboard-module-homeRuns",
      "leaderboard-module-rbis",
      "leaderboard-module-runs",
      "leaderboard-module-singles",
      "leaderboard-module-doubles",
      "leaderboard-module-outs",
    ]);
  });

  test("orders all eight flag-football modules by editorial priority", async () => {
    await act(async () => root.render(<Leaderboards />));
    await act(async () => container.querySelector('[data-testid="leaderboard-sport-flag_football"]').click());

    expect([...container.querySelectorAll('[data-testid^="leaderboard-module-"]')].map((module) => module.dataset.testid)).toEqual([
      "leaderboard-module-passYards",
      "leaderboard-module-passTDs",
      "leaderboard-module-recYards",
      "leaderboard-module-recTDs",
      "leaderboard-module-rushYards",
      "leaderboard-module-flagPulls",
      "leaderboard-module-sacks",
      "leaderboard-module-defInts",
    ]);
  });

  test("keeps the cutoff tie group together and exposes an accessible expansion", async () => {
    await act(async () => root.render(<Leaderboards />));
    const module = container.querySelector('[data-testid="leaderboard-module-rbis"]');
    const toggle = module.querySelector('button[aria-expanded="false"]');

    expect(module.querySelectorAll('[data-testid^="mock-row-"]')).toHaveLength(5);
    expect(toggle?.getAttribute("aria-controls")).toBe("leaderboard-module-rbis-rows");

    await act(async () => toggle.click());
    expect(module.querySelector('button[aria-expanded="true"]')?.textContent).toBe("Show top 5 + ties");
    expect(module.querySelectorAll('[data-testid^="mock-row-"]').length).toBeGreaterThan(5);
  });
});
