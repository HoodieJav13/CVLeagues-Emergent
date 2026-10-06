import { supabase } from "./supabase";
import { createEntity, fetchAppState, replaceScorekeepingEvent, submitScore, updateEntity, updateTeamIdentity, verifyWaiver } from "./backend";
import { buildNewGamePayload } from "./newGame";

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
      p_pairing_override_reason: null,
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

describe("admin New Game insert", () => {
  test("inserts schedule columns only; status, scores, lock and audit stay database defaults", async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ insert });
    const state = {
      leagues: [{ id: "l1", name: "League", sport: "kickball", season: "Spring 2027", kind: "league" }],
      teams: [{ id: "t1", name: "A", league_id: "l1" }, { id: "t2", name: "B", league_id: "l1" }],
      venues: [{ id: "v1", name: "Park", status: "active" }],
    };
    // The dialog adds a client id (in the grant) so a retried save is idempotent.
    const payload = { id: "6f1c1f9e-6c0b-4d5e-9a51-6f3f9a1b2c3d", ...buildNewGamePayload(state, { league_id: "l1", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-10-13T19:00", venue_id: "v1" }) };

    await createEntity("games", payload);

    expect(supabase.from).toHaveBeenCalledWith("games");
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    // Migration 29's authenticated INSERT column grant, minus temp_admin_id.
    expect(Object.keys(row).sort()).toEqual(["away_team_id", "home_team_id", "id", "league_id", "sport", "stage", "starts_at", "venue_id"]);
    expect(row).toEqual({ id: "6f1c1f9e-6c0b-4d5e-9a51-6f3f9a1b2c3d", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-10-14T01:00:00.000Z", venue_id: "v1", stage: "regular" });
  });

  test("retry recovers a matching committed game by client id without changing it", async () => {
    const payload = { id: "6f1c1f9e-6c0b-4d5e-9a51-6f3f9a1b2c3d", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-10-14T01:00:00.000Z", venue_id: "v1", stage: "regular" };
    const insert = jest.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const maybeSingle = jest.fn().mockResolvedValue({ data: { ...payload, starts_at: "2026-10-14T01:00:00+00:00" }, error: null });
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ insert, select });
    await expect(createEntity("games", payload)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("id", payload.id);
    expect(select).toHaveBeenCalledWith("id,league_id,sport,home_team_id,away_team_id,starts_at,venue_id,stage");
  });

  test.each([null, { venue_id: "other-venue" }, { starts_at: "2026-10-14T02:00:00Z" }])(
    "a missing or differently scheduled existing id is never treated as a saved retry: %p", async (difference) => {
      const payload = { id: "6f1c1f9e-6c0b-4d5e-9a51-6f3f9a1b2c3d", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-10-14T01:00:00.000Z", venue_id: "v1", stage: "regular" };
      const insert = jest.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
      const maybeSingle = jest.fn().mockResolvedValue({ data: difference ? { ...payload, ...difference } : null, error: null });
      const select = jest.fn(() => ({ eq: () => ({ maybeSingle }) }));
      supabase.from.mockReturnValue({ insert, select });
      await expect(createEntity("games", payload)).rejects.toThrow("create games: duplicate key");
      expect(insert).toHaveBeenCalledTimes(1);
    },
  );

  test("a failed duplicate readback remains a retryable error", async () => {
    const payload = { id: "6f1c1f9e-6c0b-4d5e-9a51-6f3f9a1b2c3d", league_id: "l1", sport: "kickball", home_team_id: "t1", away_team_id: "t2", starts_at: "2026-10-14T01:00:00.000Z", venue_id: "v1", stage: "regular" };
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: "network down" } });
    supabase.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } }), select: () => ({ eq: () => ({ maybeSingle }) }) });
    await expect(createEntity("games", payload)).rejects.toThrow("confirm saved game: network down");
  });

  test("another collection's duplicate never invokes game recovery", async () => {
    const select = jest.fn();
    supabase.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } }), select });
    await expect(createEntity("venues", { id: "existing", name: "Park" })).rejects.toThrow("create venues: duplicate key");
    expect(select).not.toHaveBeenCalled();
  });

  test("a rejected insert surfaces through the adapter so the dialog can stay open", async () => {
    supabase.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { message: "new row violates row-level security policy" } }) });
    await expect(createEntity("games", { league_id: "l1" })).rejects.toThrow("create games: new row violates row-level security policy");
  });
});
