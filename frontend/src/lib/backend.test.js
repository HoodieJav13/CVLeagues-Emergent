import { supabase } from "./supabase";
import { fetchAppState, replaceScorekeepingEvent, submitScore, updateEntity, updateTeamIdentity, verifyWaiver } from "./backend";

jest.mock("./supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe("RPC-only team mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.rpc.mockResolvedValue({ error: null });
  });

  test("canonical identity edits use the allowlisted identity RPC", async () => {
    await updateTeamIdentity("identity-1", {
      name: "Bosque United",
      logo_color: "#112233",
      founded: "2026",
      status: "inactive",
      created_by: "must-not-pass",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("update_team_identity", {
      p_identity_id: "identity-1",
      p_patch: {
        name: "Bosque United",
        logo_color: "#112233",
        founded: "2026",
        status: "inactive",
      },
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test("generic team edits route only mutable enrollment fields through the RPC", async () => {
    await updateEntity("teams", "team-1", {
      captain_id: "profile-1",
      division: "Open",
      status: "active",
      identity_id: "must-not-pass",
      league_id: "must-not-pass",
      sport: "flag_football",
      name: "must-not-pass",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("update_team_enrollment", {
      p_team_id: "team-1",
      p_patch: {
        captain_id: "profile-1",
        division: "Open",
        status: "active",
      },
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test("team RPC failures surface through the adapter", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "Admin only" } });

    await expect(updateEntity("teams", "team-1", { status: "inactive" }))
      .rejects.toThrow("update team enrollment: Admin only");
  });

  test("profile edits strip generated and mock-only fields", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ update });

    await updateEntity("profiles", "profile-1", {
      first_name: "Ari",
      admin_notes: [{ text: "Called" }],
      name: "generated",
      age_confirmed: true,
      eligibility_status: "verified",
      claimed: true,
    });

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ first_name: "Ari", admin_notes: [{ text: "Called" }] });
    expect(eq).toHaveBeenCalledWith("id", "profile-1");
  });

  test("waiver decisions use the verification RPC", async () => {
    await verifyWaiver("waiver-1", "verified");
    expect(supabase.rpc).toHaveBeenCalledWith("verify_waiver", {
      p_waiver_id: "waiver-1",
      p_decision: "verified",
    });
  });

  test("[INV-04] aggregate box-score saves use only the hardened submit RPC", async () => {
    await submitScore({
      game_id: "game-1",
      home_score: 2,
      away_score: 1,
      periods: { home: [2], away: [1] },
      statsByPlayer: {
        "player-1": { team_id: "home", stats: { runs: 2 } },
      },
      override_reason: "Official result confirmed",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("submit_score", {
      p_game_id: "game-1",
      p_home_score: 2,
      p_away_score: 1,
      p_periods: { home: [2], away: [1] },
      p_stats: { "player-1": { team_id: "home", stats: { runs: 2 } } },
      p_override_reason: "Official result confirmed",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test("[INV-24][INV-32] final corrections use the reasoned correction RPC", async () => {
    await submitScore({
      game_id: "game-1",
      home_score: 8,
      away_score: 6,
      periods: { home: [8, 0, 0, 0], away: [6, 0, 0, 0] },
      statsByPlayer: {
        "player-1": { team_id: "home", stats: { passYards: -3 } },
      },
      correction_reason: "Correcting transcription",
      override_reason: "Official scorebook controls",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("correct_final_score", {
      p_game_id: "game-1",
      p_home_score: 8,
      p_away_score: 6,
      p_periods: { home: [8, 0, 0, 0], away: [6, 0, 0, 0] },
      p_stats: { "player-1": { team_id: "home", stats: { passYards: -3 } } },
      p_reason: "Correcting transcription",
      p_override_reason: "Official scorebook controls",
    });
  });

  test("[INV-16][INV-17] void-and-replace uses one atomic ledger RPC", async () => {
    await replaceScorekeepingEvent({
      lease: { session_id: "session-1", lease_token: "lease-token", lease_version: 3 },
      target_event_id: "event-1",
      command: {
        void_idempotency_key: "void-key",
        replacement_idempotency_key: "replace-key",
        event_type: "run",
        period_type: "regulation",
        period_number: 2,
        credited_team_id: "away",
        points: 1,
        payload: { source: "official-book" },
        attributions: [{ participant_id: "participant-1", role: "scorer", stat_key: "runs", stat_delta: 1 }],
      },
    });

    expect(supabase.rpc).toHaveBeenCalledWith("replace_scorekeeping_event", {
      p_session_id: "session-1",
      p_lease_token: "lease-token",
      p_lease_version: 3,
      p_void_idempotency_key: "void-key",
      p_replacement_idempotency_key: "replace-key",
      p_target_event_id: "event-1",
      p_event_type: "run",
      p_period_type: "regulation",
      p_period_number: 2,
      p_credited_team_id: "away",
      p_points: 1,
      p_payload: { source: "official-book" },
      p_attributions: [{ participant_id: "participant-1", role: "scorer", stat_key: "runs", stat_delta: 1 }],
    });
  });

  test("admin intake fetch errors cannot silently become empty queues", async () => {
    supabase.from.mockImplementation((table) => {
      const result = table === "free_agents"
        ? { data: null, error: { message: "intake unavailable" } }
        : table === "league_settings"
          ? { data: { current_season: "Summer 2026", current_kickball_season: "Summer 2026", current_flag_football_season: "Summer 2026", registration_open: {}, hof_published: false }, error: null }
          : { data: [], error: null };
      const query = {
        select: () => query,
        order: () => query,
        eq: () => query,
        single: () => Promise.resolve(result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });

    await expect(fetchAppState(true)).rejects.toThrow("fetch free_agents: intake unavailable");
  });
});
