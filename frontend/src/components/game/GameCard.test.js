import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameCard } from "./GameCard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

jest.mock("../../context/AppStateContext", () => ({
  useApp: () => ({ state: mockState }),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const awayName = "The Exceptionally Long Westside Roadrunners";

describe("GameCard team presentation", () => {
  let container;
  let root;

  beforeEach(() => {
    mockState = {
      teams: [
        { id: "away", name: awayName, logo_color: "#5BB8CC" },
        { id: "home", name: "Downtown", logo_color: "#FB923C" },
      ],
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("wraps long names while preserving completed-game emphasis", async () => {
    await act(async () => {
      root.render(
        <GameCard game={{
          id: "game-1",
          sport: "kickball",
          status: "completed",
          date: "2026-07-10",
          time: "6:30 PM",
          location: "Mesa Field",
          away_team_id: "away",
          home_team_id: "home",
          away_score: 8,
          home_score: 5,
        }} />
      );
    });

    const away = [...container.querySelectorAll("span")]
      .find((element) => element.textContent === awayName);
    const home = [...container.querySelectorAll("span")]
      .find((element) => element.textContent === "Downtown");

    expect(away?.className).toContain("font-sans");
    expect(away?.className).toContain("whitespace-normal");
    expect(away?.className).not.toContain("truncate");
    expect(away?.className).toContain("font-semibold");
    expect(home?.className).toContain("font-normal");

    const card = container.querySelector('[data-testid="game-card-game-1"]');
    expect(card?.className).not.toContain("transition-");
    expect(card?.className).not.toContain("transition-all");
    expect(card?.className).not.toContain("hover:-translate-y-1");
  });
});
