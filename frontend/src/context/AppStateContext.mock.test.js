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

  test("[INV-24][INV-32][INV-37] mock correction keeps the result final and appends before/after audit", async () => {
    const game = currentApp.state.games.find((item) => item.id === "g1");
    await act(async () => currentApp.lockGame(game.id));

    const correctedPeriods = {
      home: [game.periods.home[0] + 1, ...game.periods.home.slice(1)],
      away: [...game.periods.away],
    };
    await act(async () => currentApp.submitScore({
      game_id: game.id,
      home_score: game.home_score + 1,
      away_score: game.away_score,
      periods: correctedPeriods,
      statsByPlayer: {},
      correction_reason: "Official scorebook correction",
      override_reason: "Player run attribution was not collected",
    }));

    const corrected = currentApp.state.games.find((item) => item.id === game.id);
    const audit = corrected.edit_history.at(-1);
    expect(corrected).toMatchObject({
      home_score: game.home_score + 1,
      away_score: game.away_score,
      score_status: "final",
      locked: true,
    });
    expect(audit).toMatchObject({
      action: "Final score corrected",
      reason: "Official scorebook correction",
      override_reason: "Player run attribution was not collected",
    });
    expect(audit.before_state.home_score).toBe(game.home_score);
    expect(audit.after_state.home_score).toBe(game.home_score + 1);
  });

  test("[INV-30] practice rehearsal returns projections without ever touching games or playerStats", async () => {
    const game = currentApp.state.games.find((item) => item.id === "g1");
    const gamesBefore = currentApp.state.games;
    const playerStatsBefore = currentApp.state.playerStats;

    // Start against the two same-league teams; participants snapshot both rosters.
    let lease;
    await act(async () => {
      lease = currentApp.startPracticeSession({
        home_team_id: game.home_team_id,
        away_team_id: game.away_team_id,
        rule_version: "CVF-2026.1",
        regulation_period_count: 5,
      });
    });
    const session = currentApp.state.scorekeepingSessions.find((item) => item.id === lease.session_id);
    expect(session).toMatchObject({ session_kind: "practice", game_id: null, status: "open", stage: "practice" });
    const participants = currentApp.state.scorekeepingParticipants.filter((item) => item.session_id === session.id);
    const homeRunner = participants.find((item) => item.team_id === game.home_team_id);
    const awayRunner = participants.find((item) => item.team_id === game.away_team_id);
    expect(homeRunner).toBeTruthy();
    expect(awayRunner).toBeTruthy();

    // One home run event, then finalize: the projection is RETURNED, not stored.
    let appended;
    await act(async () => {
      appended = currentApp.appendPracticeEvent({
        lease,
        command: {
          idempotency_key: "practice-run-1", action: "record", event_type: "run",
          period_type: "regulation", period_number: 1,
          credited_team_id: game.home_team_id, points: 1,
          attributions: [{ participant_id: homeRunner.id, role: "primary", stat_key: "runs", stat_delta: 1 }],
        },
      });
    });
    expect(appended.sequence_number).toBe(1);

    let finalized;
    await act(async () => {
      finalized = currentApp.finalizePracticeSession({ lease, idempotency_key: "practice-final-1" });
    });
    expect(finalized).toMatchObject({ ok: true, status: "practice_finalized", home_score: 1, away_score: 0 });
    expect(finalized.projection.player_stats[homeRunner.profile_id]).toEqual({
      team_id: game.home_team_id,
      stats: { runs: 1 },
    });

    // Rehearse a correction: void the run and replace it with an away run.
    let correction;
    await act(async () => {
      correction = currentApp.startPracticeCorrection(session.id, "Rehearsal: credited the wrong team");
    });
    expect(correction).toMatchObject({ session_kind: "practice", practice_correction: true, base_session_id: session.id });
    const awayClone = currentApp.state.scorekeepingParticipants.find((item) =>
      item.session_id === correction.session_id && item.profile_id === awayRunner.profile_id
    );
    await act(async () => {
      currentApp.appendPracticeEvent({
        lease: correction,
        command: { idempotency_key: "practice-void-1", action: "void", event_type: "void", points: 0, voids_event_id: appended.event_id },
      });
    });
    await act(async () => {
      currentApp.appendPracticeEvent({
        lease: correction,
        command: {
          idempotency_key: "practice-replace-1", action: "replace", event_type: "run",
          period_type: "regulation", period_number: 1,
          credited_team_id: game.away_team_id, points: 1, replaces_event_id: appended.event_id,
          attributions: [{ participant_id: awayClone.id, role: "primary", stat_key: "runs", stat_delta: 1 }],
        },
      });
    });
    let corrected;
    await act(async () => {
      corrected = currentApp.finalizePracticeSession({ lease: correction, idempotency_key: "practice-final-2" });
    });
    expect(corrected).toMatchObject({ ok: true, status: "practice_finalized", home_score: 0, away_score: 1 });

    // The whole rehearsal — start, events, two finalizations, a correction —
    // left every official collection untouched (same references, not just equal).
    expect(currentApp.state.games).toBe(gamesBefore);
    expect(currentApp.state.playerStats).toBe(playerStatsBefore);
  });
});
