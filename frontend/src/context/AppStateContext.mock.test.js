import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppStateProvider, useApp } from "./AppStateContext";
import { ErrorBoundary } from "../components/common/ErrorBoundary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/supabase", () => ({ BACKEND_ENABLED: false }));
jest.mock("./RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn() } }));
const { toast } = require("sonner");

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

  test("re-approving an archived registration is refused like hosted, without crashing the app", async () => {
    const registration = currentApp.state.registrations.find((record) => record.id === "reg1");
    await act(async () => currentApp.updateRegistrationStatus(registration.id, "archived"));
    const teamsBefore = currentApp.state.teams.length;
    toast.error.mockClear();

    let refusal;
    await act(async () => {
      try { await currentApp.updateRegistrationStatus(registration.id, "approved"); } catch (error) { refusal = error; }
    });

    expect(refusal?.message).toBe("Registration is already archived.");
    expect(toast.error).toHaveBeenCalledWith("Registration is already archived.");
    expect(container.isConnected && currentApp).toBeTruthy(); // provider still mounted
    expect(currentApp.state.teams).toHaveLength(teamsBefore);
    expect(currentApp.state.registrations.find((record) => record.id === registration.id).status).toBe("archived");
  });

  test("re-assigning an already assigned free agent is refused like hosted, without crashing the app", async () => {
    const team = currentApp.state.teams.find((item) => item.sport === "kickball");
    await act(async () => currentApp.updateEntity("freeAgents", "fa1", { assigned_team_id: team.id, status: "assigned" }));
    const rosterBefore = currentApp.state.teamPlayers.length;
    toast.error.mockClear();

    let refusal;
    await act(async () => {
      try { await currentApp.updateEntity("freeAgents", "fa1", { assigned_team_id: team.id, status: "assigned" }); } catch (error) { refusal = error; }
    });

    expect(refusal?.message).toBe("Free agent is already assigned.");
    expect(toast.error).toHaveBeenCalledWith("Free agent is already assigned.");
    expect(currentApp.state.teamPlayers).toHaveLength(rosterBefore);
  });

  test("assigning a just-submitted free agent gives the new player a visible name", async () => {
    // Intake rows from the public form carry first/last/display name but no
    // derived `name`; the created profile must still render as a person.
    await act(async () => currentApp.addFreeAgent({
      first_name: "Fiona", last_name: "Freeagent", display_name: null,
      email: "fiona.freeagent@example.test", phone: "505-555-0151", sports: ["kickball"], consent_to_contact: true,
    }));
    const agent = currentApp.state.freeAgents.find((item) => item.email === "fiona.freeagent@example.test");
    const team = currentApp.state.teams.find((item) => item.sport === "kickball");

    await act(async () => currentApp.updateEntity("freeAgents", agent.id, { assigned_team_id: team.id, status: "assigned" }));

    const profileId = currentApp.state.freeAgents.find((item) => item.id === agent.id).profile_id;
    const profile = currentApp.state.profiles.find((item) => item.id === profileId);
    expect(profile).toMatchObject({ first_name: "Fiona", last_name: "Freeagent", name: "Fiona Freeagent" });
  });

  test("same-team reassignment after Mark contacted refuses without reaching the error boundary", async () => {
    await act(async () => root.render(<ErrorBoundary><AppStateProvider><Probe /></AppStateProvider></ErrorBoundary>));
    const team = currentApp.state.teams.find((item) => item.sport === "kickball");
    await act(async () => currentApp.updateEntity("freeAgents", "fa1", { assigned_team_id: team.id, status: "assigned" }));
    await act(async () => currentApp.setFreeAgentStatus("fa1", "contacted"));
    const before = currentApp.state;
    toast.error.mockClear();
    let refusal;
    await act(async () => {
      try { await currentApp.updateEntity("freeAgents", "fa1", { assigned_team_id: team.id, status: "assigned" }); }
      catch (error) { refusal = error; }
    });
    expect(container.querySelector('[data-testid="app-error-boundary"]')).toBeNull();
    expect(container.querySelector('[data-testid="state-counts"]')).not.toBeNull();
    expect(refusal?.message).toBe(`Player is already on this roster for ${before.leagues.find((league) => league.id === team.league_id).season}.`);
    expect(toast.error).toHaveBeenCalledWith(refusal.message);
    expect(currentApp.state).toBe(before);
  });

  test("a game created from the admin form starts pending, unlocked, unscored and visible to every surface", async () => {
    const before = currentApp.state;
    const payload = { league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2027-04-06T00:30:00.000Z", venue_id: before.venues[0].id, stage: "regular" };

    await act(async () => currentApp.createEntity("games", payload, "g"));

    const created = currentApp.state.games.filter((game) => !before.games.some((old) => old.id === game.id));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      ...payload, status: "upcoming", score_status: "pending", home_score: null, away_score: null,
      periods: { home: [], away: [] }, locked: false, edit_history: [],
    });
    expect(currentApp.state.playerStats).toEqual(before.playerStats);
    expect(currentApp.state.gameParticipation).toEqual(before.gameParticipation);
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

  test("assignment composes with earlier game and waiver edits in the same batch", async () => {
    const game = currentApp.state.games[0];
    const team = currentApp.state.teams.find((item) => item.sport === "kickball");
    const agent = currentApp.state.freeAgents.find((item) => item.id === "fa1");
    const waiver = currentApp.state.waivers.find((item) => item.email === agent.email);
    await act(async () => {
      currentApp.updateEntity("games", game.id, { venue_id: "composition-review-venue" });
      currentApp.updateEntity("waivers", waiver.id, { verification_status: "verified", phone: "queued-edit" });
      currentApp.updateEntity("freeAgents", agent.id, { assigned_team_id: team.id, status: "assigned" });
    });
    const assigned = currentApp.state.freeAgents.find((item) => item.id === agent.id);
    expect(currentApp.state.games.find((item) => item.id === game.id).venue_id).toBe("composition-review-venue");
    expect(currentApp.state.waivers.find((item) => item.id === waiver.id)).toMatchObject({
      verification_status: "verified", phone: "queued-edit", profile_id: assigned.profile_id,
    });
    expect(currentApp.state.teamPlayers.find((item) => item.profile_id === assigned.profile_id && item.team_id === team.id).roster_status).toBe("eligible");
  });

  test("assignment preserves queued profile edits and refuses same-turn duplicate assignment", async () => {
    const team = currentApp.state.teams.find((item) => item.sport === "kickball");
    const profile = currentApp.state.profiles[0];
    let refusal;
    await act(async () => {
      currentApp.updateEntity("profiles", profile.id, { display_name: "Queued profile edit" });
      currentApp.updateEntity("freeAgents", "fa1", { assigned_team_id: team.id, status: "assigned" });
      try { currentApp.updateEntity("freeAgents", "fa1", { assigned_team_id: team.id, status: "assigned" }); }
      catch (error) { refusal = error; }
    });
    expect(currentApp.state.profiles.find((item) => item.id === profile.id).display_name).toBe("Queued profile edit");
    expect(refusal?.message).toBe("Free agent is already assigned.");
    const assigned = currentApp.state.freeAgents.find((item) => item.id === "fa1");
    expect(currentApp.state.teamPlayers.filter((item) => item.team_id === team.id && item.profile_id === assigned.profile_id)).toHaveLength(1);
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

  // Practice exists to rehearse the real contract, so the mock has to accept and
  // reject exactly what the hosted RPCs accept and reject. A rehearsal that is
  // more permissive than production teaches a workflow that fails on game day.
  test("[INV-07] practice enforces the paired-stat exception contract exactly as hosted does", async () => {
    const game = currentApp.state.games.find((item) => item.id === "g7");
    let lease;
    await act(async () => {
      lease = currentApp.startPracticeSession({
        home_team_id: game.home_team_id,
        away_team_id: game.away_team_id,
        rule_version: "CVF-2026.1",
        regulation_period_count: 4,
      });
    });
    const roster = currentApp.state.scorekeepingParticipants
      .filter((item) => item.session_id === lease.session_id && item.team_id === game.home_team_id);
    const [passer, receiver] = roster;
    expect(passer && receiver).toBeTruthy();

    const completion = (overrides) => ({
      idempotency_key: "practice-completion", action: "record", event_type: "completion",
      period_type: "regulation", period_number: 1,
      credited_team_id: game.home_team_id, points: 0,
      ...overrides,
    });
    const paired = [
      { participant_id: passer.id, role: "passer", stat_key: "completions", stat_delta: 1 },
      { participant_id: passer.id, role: "passer", stat_key: "passYards", stat_delta: 12 },
      { participant_id: receiver.id, role: "receiver", stat_key: "catches", stat_delta: 1 },
      { participant_id: receiver.id, role: "receiver", stat_key: "recYards", stat_delta: 12 },
    ];
    const unpaired = paired.slice(0, 2);

    // A reason is valid only on an unpaired event, and an unpaired event is
    // valid only with a reason. Hosted raises INV-07 both ways.
    expect(() => currentApp.appendPracticeEvent({
      lease, command: completion({ attributions: paired, pairing_override_reason: "Receiver unknown" }),
    })).toThrow(/valid only for an unpaired/);
    expect(() => currentApp.appendPracticeEvent({
      lease, command: completion({ attributions: unpaired }),
    })).toThrow(/must reconcile within the same event/);

    // The legal combination is accepted, and the exception then resurfaces as an
    // INV-07 warning that makes finalization demand an override reason.
    await act(async () => {
      currentApp.appendPracticeEvent({
        lease,
        command: completion({
          attributions: unpaired,
          pairing_override_reason: "Receiver left before the catch was recorded",
        }),
      });
    });
    // A rushing touchdown breaks the 0-0 tie, which would otherwise return
    // continue_overtime before finalization ever evaluates warnings.
    await act(async () => {
      currentApp.appendPracticeEvent({
        lease,
        command: {
          idempotency_key: "practice-td", action: "record", event_type: "touchdown",
          period_type: "regulation", period_number: 1,
          credited_team_id: game.home_team_id, points: 6,
          attributions: [{ participant_id: passer.id, role: "primary", stat_key: "tds", stat_delta: 1 }],
        },
      });
    });
    expect(() => currentApp.finalizePracticeSession({
      lease, idempotency_key: "practice-final-ff",
    })).toThrow(/override reason/);

    let finalized;
    await act(async () => {
      finalized = currentApp.finalizePracticeSession({
        lease,
        idempotency_key: "practice-final-ff",
        override_reason: "Rehearsing the reasoned exception",
      });
    });
    expect(finalized.projection.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ invId: "INV-07", code: "ledger_pairing_override" }),
    ]));
  });
});
