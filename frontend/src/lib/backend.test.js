import { supabase } from "./supabase";
import { updateEntity, updateTeamIdentity } from "./backend";

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
});
