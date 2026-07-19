import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { RankedLeaderboardRow } from "./RankedLeaderboardRow";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));

jest.mock("./AthleteHoverCard", () => ({
  AthleteHoverCard: ({ children }) => children,
}));

describe("RankedLeaderboardRow", () => {
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

  test("renders the winner with the shared identity mark and podium tier", async () => {
    await act(async () => root.render(<RankedLeaderboardRow
      statLabel="Home Runs"
      row={{
        rank: 1,
        value: 12,
        profile: { id: "p1", name: "Jessica Martinez", avatar_color: "#5BB8CC" },
        team: { id: "t1", name: "Sandia Sluggers" },
      }}
    />));

    const row = container.querySelector('[data-testid="leaderboard-row-p1"]');
    expect(row?.dataset.rank).toBe("1");
    expect(row?.dataset.rankTier).toBe("podium-1");
    expect(container.querySelector('[data-cvf-identity-badge="true"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="12 Home Runs"]')?.textContent).toBe("12");
    expect(container.querySelector('a[href="/profile/p1"]')?.textContent).toBe("Jessica Martinez");
    expect(container.querySelector('a[href="/team/t1"]')?.textContent).toBe("Sandia Sluggers");
  });

  test("uses the field tier from rank four onward", async () => {
    await act(async () => root.render(<RankedLeaderboardRow
      statLabel="Runs"
      row={{ rank: 4, value: 5, profile: { id: "p4", name: "Casey Vigil", avatar_color: "#A855F7" }, team: null }}
    />));

    expect(container.querySelector('[data-testid="leaderboard-row-p4"]')?.dataset.rankTier).toBe("field");
    expect(container.querySelector('[aria-label="Rank 4"]')?.textContent).toBe("4");
  });
});
