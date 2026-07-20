import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import ScoreEntry from "./ScoreEntry";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockUseApp;
const mockSubmitScore = jest.fn();
let mockGameSelectChange;
let mockAnimationFrames;
let mockNextAnimationFrame;

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

jest.mock("../components/ui/select", () => ({
  Select: ({ children, onValueChange }) => {
    mockGameSelectChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  SelectValue: () => <span />,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ state: { game_id: "game-1" } }),
  useNavigate: () => jest.fn(),
}), { virtual: true });

const lockedState = {
  games: [
    {
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
    },
    {
      id: "game-2",
      sport: "kickball",
      status: "completed",
      score_status: "final",
      locked: true,
      date: "2026-08-02",
      time: "7:00 PM",
      location: "Second Field",
      home_team_id: "home",
      away_team_id: "away",
      periods: { home: [0, 0, 0, 0, 0], away: [0, 0, 0, 0, 0] },
    },
  ],
  teams: [
    { id: "home", name: "Home", sport: "kickball", logo_color: "#fff" },
    { id: "away", name: "Away", sport: "kickball", logo_color: "#000" },
  ],
  teamPlayers: [{ id: "roster-1", team_id: "away", profile_id: "player-1", roster_status: "eligible" }],
  profiles: [{ id: "player-1", name: "Away Player", avatar_color: "#333", eligibility_status: "verified" }],
  playerStats: [],
};

function useLockedGameApp() {
  const [state] = useState(lockedState);

  return { state, submitScore: mockSubmitScore };
}

describe("ScoreEntry locked-game UX", () => {
  let container;
  let root;

  beforeEach(() => {
    mockSubmitScore.mockClear();
    mockSubmitScore.mockResolvedValue(undefined);
    mockUseApp = useLockedGameApp;
    mockGameSelectChange = undefined;
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

  test("[INV-24][INV-32] drafts, cancels, and completes a reasoned correction without unlocking", async () => {
    await act(async () => root.render(<ScoreEntry />));

    expect(container.querySelector('[data-testid="score-game-select"]')?.getAttribute("aria-labelledby")).toBe("score-game-select-label");
    expect(container.querySelector('#score-game-select-label')?.getAttribute("for")).toBe("score-game-select");
    expect(container.querySelector('[data-testid="score-locked-notice"]')?.textContent).toContain("This game is finalized and locked.");
    expect(container.querySelector('[data-testid="score-away-period-0"]')?.getAttribute("aria-label")).toBe("Away Inning 1");
    expect(container.querySelector('[data-testid="score-away-period-0"]').disabled).toBe(true);
    expect(container.querySelector("thead th")?.getAttribute("scope")).toBe("col");
    expect(container.querySelector("tbody th")?.getAttribute("scope")).toBe("row");
    expect(container.querySelector('[data-testid="score-add-inning"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="score-save"]').disabled).toBe(true);

    await act(async () => {
      container.querySelector('[data-testid="score-player-toggle-player-1"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="score-stat-player-1-kicks"]').disabled).toBe(true);

    await act(async () => {
      container.querySelector('[data-testid="score-correction-start"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const reason = document.querySelector('[data-testid="score-correction-reason"]');
    expect(document.activeElement).toBe(reason);
    await act(async () => {
      document.querySelector('[data-testid="score-correction-confirm"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(reason?.getAttribute("aria-invalid")).toBe("true");
    expect(reason?.getAttribute("aria-describedby")).toBe("score-correction-reason-error");
    expect(document.querySelector('#score-correction-reason-error')?.getAttribute("role")).toBe("alert");
    expect(document.querySelector('#score-correction-reason-error')?.textContent).toBe("A correction reason is required.");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(reason, "Correcting the final score");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(reason?.getAttribute("aria-invalid")).toBe("false");
    expect(reason?.getAttribute("aria-describedby")).toBeNull();
    expect(document.querySelector('#score-correction-reason-error')).toBeNull();

    await act(async () => {
      document.querySelector('[data-testid="score-correction-confirm"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="score-locked-notice"]')?.textContent).toContain("published result locked");
    expect(container.querySelector('[data-testid="score-away-period-0"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="score-add-inning"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="score-stat-player-1-kicks"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="score-save"]').disabled).toBe(false);

    await act(async () => {
      container.querySelector('[data-testid="score-correction-cancel"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="score-away-period-0"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="score-away-period-0"]').value).toBe("1");
    expect(mockSubmitScore).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector('[data-testid="score-correction-start"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const secondReason = document.querySelector('[data-testid="score-correction-reason"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(secondReason, "Correcting the final score");
      secondReason.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector('[data-testid="score-correction-confirm"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('[data-testid="score-save"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="score-soft-warnings"]')?.textContent).toContain("[INV-05]");
    const override = document.querySelector('[data-testid="score-override-reason"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(override, "Official book has team-only totals");
      override.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector('[data-testid="score-override-confirm"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(mockSubmitScore).toHaveBeenCalledWith(expect.objectContaining({
      game_id: "game-1",
      correction_reason: "Correcting the final score",
      override_reason: "Official book has team-only totals",
    }));
  });

  test("bridges only the selector-owned game form after a game change", async () => {
    await act(async () => root.render(<ScoreEntry />));

    const initial = container.querySelector('[data-testid="score-game-results"]');
    expect(initial?.className).toContain("opacity-100");
    expect(initial?.className).toContain("transition-opacity");
    expect(initial?.className).toContain("duration-cvf-fast");
    expect(initial?.className).toContain("ease-cvf-out");
    expect(initial?.className).toContain("motion-reduce:opacity-100");
    expect(initial?.className).toContain("motion-reduce:transition-none");
    expect(container.querySelector('[data-testid="score-game-select"]')?.className).not.toContain("transition-opacity");
    expect(container.querySelector('[data-testid="score-locked-notice"]')?.className).not.toContain("transition-opacity");

    await act(async () => {
      mockGameSelectChange("game-2");
    });

    expect(container.querySelector('[data-testid="score-game-results"]')?.className).toContain("opacity-75");
    expect(container.querySelector('[data-testid="score-game-results"]')?.textContent).toContain("Second Field");
    const latestFrame = [...mockAnimationFrames.keys()].at(-1);
    expect(latestFrame).toBeDefined();
    expect(container.querySelector('[data-testid="score-game-select"]')?.className).not.toContain("transition-opacity");
    expect(container.querySelector('[data-testid="score-locked-notice"]')?.className).not.toContain("transition-opacity");

    await act(async () => {
      const callback = mockAnimationFrames.get(latestFrame);
      mockAnimationFrames.delete(latestFrame);
      callback();
    });
    expect(container.querySelector('[data-testid="score-game-results"]')?.className).toContain("opacity-100");
  });
});
