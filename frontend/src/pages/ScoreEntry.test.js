import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import ScoreEntry from "./ScoreEntry";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockUseApp;
const mockUnlockGame = jest.fn();

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../context/AppStateContext", () => ({
  useApp: () => mockUseApp(),
}));

jest.mock("../context/RoleContext", () => ({
  useRole: () => ({ role: "admin", roleMeta: {} }),
}));

jest.mock("../components/layout/RoleGate", () => ({
  RoleGate: ({ children }) => children,
}));

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ state: { game_id: "game-1" } }),
  useNavigate: () => jest.fn(),
}), { virtual: true });

const lockedState = {
  games: [{
    id: "game-1",
    sport: "kickball",
    status: "completed",
    score_status: "final",
    locked: true,
    date: "2026-08-01",
    time: "6:00 PM",
    location: "Test Field",
    home_team_id: "home",
    away_team_id: "away",
    periods: { home: [2, 2, 1, 1, 1], away: [1, 1, 1, 1, 0] },
  }],
  teams: [
    { id: "home", name: "Home", sport: "kickball", logo_color: "#fff" },
    { id: "away", name: "Away", sport: "kickball", logo_color: "#000" },
  ],
  teamPlayers: [{ id: "roster-1", team_id: "away", profile_id: "player-1", roster_status: "eligible" }],
  profiles: [{ id: "player-1", name: "Away Player", avatar_color: "#333", eligibility_status: "verified" }],
  playerStats: [],
};

function useLockedGameApp() {
  const [state, setState] = useState(lockedState);
  const unlockGame = async (gameId, reason) => {
    mockUnlockGame(gameId, reason);
    setState((current) => ({
      ...current,
      games: current.games.map((game) => game.id === gameId ? { ...game, locked: false, score_status: "approved" } : game),
    }));
  };

  return { state, submitScore: jest.fn(), unlockGame };
}

describe("ScoreEntry locked-game UX", () => {
  let container;
  let root;

  beforeEach(() => {
    mockUnlockGame.mockClear();
    mockUseApp = useLockedGameApp;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("disables editing while locked and re-enables after a reasoned unlock", async () => {
    await act(async () => root.render(<ScoreEntry />));

    expect(container.querySelector('[data-testid="score-locked-notice"]')?.textContent).toContain("This game is finalized and locked.");
    expect(container.querySelector('[data-testid="score-away-period-0"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="score-add-inning"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="score-save"]').disabled).toBe(true);

    await act(async () => {
      container.querySelector('[data-testid="score-player-toggle-player-1"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="score-stat-player-1-kicks"]').disabled).toBe(true);

    await act(async () => {
      container.querySelector('[data-testid="score-unlock"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const reason = document.querySelector('[data-testid="score-unlock-reason"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(reason, "Correcting the final score");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      document.querySelector('[data-testid="score-unlock-confirm"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockUnlockGame).toHaveBeenCalledWith("game-1", "Correcting the final score");
    expect(container.querySelector('[data-testid="score-locked-notice"]')).toBeNull();
    expect(container.querySelector('[data-testid="score-away-period-0"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="score-add-inning"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="score-stat-player-1-kicks"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="score-save"]').disabled).toBe(false);
  });
});
