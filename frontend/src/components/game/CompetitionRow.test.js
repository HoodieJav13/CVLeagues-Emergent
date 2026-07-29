import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { CompetitionRow } from "./CompetitionRow";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const state = {
  venues: [
    { id: "tv1", name: "Mesa Field 1", field_label: null, status: "active" },
    { id: "tv2", name: "North Field", field_label: null, status: "active" },
  ],
  teams: [
    { id: "away", name: "Mesa Heat", logo_color: "#f5b82e" },
    { id: "home", name: "Rio Runners", logo_color: "#5bb8cc" },
  ],
};

jest.mock("../../context/AppStateContext", () => ({
  useApp: () => ({ state }),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));

describe("CompetitionRow", () => {
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

  test("renders a completed playoff result as one structural register row", async () => {
    await act(async () => root.render(<CompetitionRow game={{
      id: "playoff-1",
      sport: "kickball",
      stage: "playoff",
      status: "completed",
      starts_at: "2026-07-20T18:00:00-06:00",
      venue_id: "tv1",
      away_team_id: "away",
      home_team_id: "home",
      away_score: 8,
      home_score: 5,
    }} />));

    const row = container.querySelector('[data-testid="competition-row-playoff-1"]');
    expect(row?.getAttribute("href")).toBe("/game/playoff-1");
    expect(row?.dataset.gameStage).toBe("playoff");
    // Two layouts render side by side (stacked mobile + desktop grid), each
    // carrying both team badges.
    expect(container.querySelectorAll('[data-cvf-identity-badge="true"]')).toHaveLength(4);
    expect(container.querySelectorAll(".cvf-identity-badge--register")).toHaveLength(2);
    expect(container.querySelector(".cvf-competition-row__focal")?.textContent).toBe("8–5");
    expect(container.querySelector('[data-testid="sport-badge-kickball"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stage-banner-playoff"]')).not.toBeNull();
    expect(container.textContent).toContain("Final");
    expect(container.textContent).toContain("Mesa Field 1");
    expect(container.querySelector(".cvf-competition-row__team--away .font-semibold")?.textContent).toBe("Mesa Heat");
    const homeName = container.querySelector(".cvf-competition-row__team--home .cvf-competition-row__team-name");
    expect(homeName?.classList.contains("text-[var(--loss-text)]")).toBe(true);
    expect(homeName?.textContent).toBe("Rio Runners");

    // D2 stacked scorelines: away line first with its own score, winner bold,
    // loser muted, full names never truncated into an ellipsis container.
    const stacked = container.querySelector('[data-testid="competition-stacked-playoff-1"]');
    const lines = stacked?.querySelectorAll(".cvf-competition-row__stacked-line");
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toContain("Mesa Heat");
    expect(lines[0].querySelector(".cvf-competition-row__stacked-value")?.textContent).toBe("8");
    expect(lines[0].querySelector(".cvf-competition-row__stacked-name")?.classList.contains("font-semibold")).toBe(true);
    expect(lines[1].textContent).toContain("Rio Runners");
    expect(lines[1].querySelector(".cvf-competition-row__stacked-value")?.textContent).toBe("5");
    expect(lines[1].querySelector(".cvf-competition-row__stacked-name")?.classList.contains("text-[var(--loss-text)]")).toBe(true);
  });

  test("renders an upcoming regular game with time as its central focal value", async () => {
    await act(async () => root.render(<CompetitionRow game={{
      id: "regular-1",
      sport: "flag_football",
      stage: "regular",
      status: "upcoming",
      starts_at: "2026-07-21T19:15:00-06:00",
      venue_id: "tv2",
      away_team_id: "away",
      home_team_id: "home",
    }} />));

    expect(container.querySelector('[data-testid="competition-row-regular-1"]')?.dataset.gameStage).toBe("regular");
    expect(container.querySelector(".cvf-competition-row__focal")?.textContent).toBe("7:15 PM");
    expect(container.textContent).toContain("Upcoming");
    expect(container.querySelector('[data-testid^="stage-banner-"]')).toBeNull();

    // Stacked layout: kickoff time rides the away line; the home line carries
    // no value until there is a score.
    const stacked = container.querySelector('[data-testid="competition-stacked-regular-1"]');
    expect(stacked?.querySelector(".cvf-competition-row__stacked-value--time")?.textContent).toBe("7:15 PM");
    const lines = stacked?.querySelectorAll(".cvf-competition-row__stacked-line");
    expect(lines[1].querySelector(".cvf-competition-row__stacked-value")).toBeNull();
  });
});
