import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppStateProvider, useApp } from "./AppStateContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/supabase", () => ({ BACKEND_ENABLED: false }));
jest.mock("./RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn() } }));

let currentApp;
function Probe() {
  currentApp = useApp();
  return <output data-testid="state-counts" />;
}

describe("mock mode visible hosted parity", () => {
  let container;
  let root;

  beforeEach(async () => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<AppStateProvider><Probe /></AppStateProvider>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    currentApp = null;
  });

  test("registration approval creates the visible identity, enrollment, captain, and roster outcome", async () => {
    const before = currentApp.state;
    const registration = before.registrations.find((record) => record.id === "reg1");

    await act(async () => currentApp.updateRegistrationStatus(registration.id, "approved"));

    const approved = currentApp.state.registrations.find((record) => record.id === registration.id);
    const team = currentApp.state.teams.find((item) => item.id === approved.approved_team_id);
    const captain = currentApp.state.profiles.find((profile) => profile.id === team.captain_id);
    expect(approved.status).toBe("approved");
    expect(currentApp.state.teamIdentities.some((identity) => identity.id === team.identity_id)).toBe(true);
    expect(captain.name).toBe(registration.captain_name);
    expect(currentApp.state.teamPlayers).toEqual(expect.arrayContaining([
      expect.objectContaining({ team_id: team.id, profile_id: captain.id, season: registration.preferred_season }),
    ]));
  });

  test("free-agent assignment creates or links a player and adds the roster row", async () => {
    const agent = currentApp.state.freeAgents.find((item) => item.id === "fa1");
    const team = currentApp.state.teams.find((item) => item.sport === "kickball");

    await act(async () => currentApp.updateEntity("freeAgents", agent.id, { assigned_team_id: team.id, status: "assigned" }));

    const assigned = currentApp.state.freeAgents.find((item) => item.id === agent.id);
    expect(assigned).toMatchObject({ status: "assigned", assigned_team_id: team.id });
    expect(currentApp.state.profiles.some((profile) => profile.id === assigned.profile_id)).toBe(true);
    expect(currentApp.state.teamPlayers).toEqual(expect.arrayContaining([
      expect.objectContaining({ team_id: team.id, profile_id: assigned.profile_id }),
    ]));
    expect(currentApp.state.waivers.find((waiver) => waiver.email === agent.email)?.profile_id).toBe(assigned.profile_id);
  });
});
