import { supabase } from "./supabase";
import { fetchAppState, updateEntity, updateTeamIdentity, verifyWaiver } from "./backend";

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
