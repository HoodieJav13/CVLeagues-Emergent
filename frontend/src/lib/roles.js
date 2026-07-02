/* ============================================================================
 * ROLES — demo role definitions & permission helpers.
 * ----------------------------------------------------------------------------
 * PRODUCTION RULE (Phase 2): roles are assigned ONLY by an admin via the
 * backend. A captain cannot promote themselves, a player cannot make themselves
 * a captain, a free agent cannot self-assign to a team. The Demo Role Preview
 * switcher below is an ADMIN-ONLY TESTING TOOL that exists purely because this
 * MVP has no real authentication. It must never ship as a user-facing feature.
 * ========================================================================== */

export const ROLES = {
  anonymous: {
    id: "anonymous",
    label: "Anonymous Viewer",
    short: "Viewer",
    description: "Public access — browse schedules, standings, scores & profiles.",
    color: "#a1a1aa",
  },
  player: {
    id: "player",
    label: "Player",
    short: "Player",
    description: "Sees own profile, stats, schedule and team.",
    color: "#22d3ee",
    // The demo player is bound to a specific profile so 'My Profile' resolves.
    profile_id: "p1",
  },
  captain: {
    id: "captain",
    label: "Captain",
    short: "Captain",
    description: "Manage roster, browse free agents, send mock invites.",
    color: "#10b981",
    profile_id: "p16",
    team_id: "t4",
  },
  admin: {
    id: "admin",
    label: "Admin",
    short: "Admin",
    description: "Full control: leagues, teams, players, games, scores, free agents.",
    color: "#facc15",
  },
  temp_admin: {
    id: "temp_admin",
    label: "Temp Admin",
    short: "Temp Admin",
    description: "Score-keeper for one assigned game only.",
    color: "#f97316",
    // Demo: assigned to a single upcoming game for score entry.
    assignedGameId: "g4",
  },
};

export const ROLE_ORDER = ["anonymous", "player", "captain", "admin", "temp_admin"];

/* --------------------------- permission helpers -------------------------- */
export const can = {
  // Full admin CRUD over everything
  manageAll: (role) => role === "admin",
  // The free-agent POOL is the captain's browse-and-invite tool. Admins manage
  // free agents in ONE place — the Admin dashboard's Free Agents tab — so the
  // pool stays captain-only to avoid two parallel management surfaces.
  viewFreeAgentPool: (role) => role === "captain",
  manageRoster: (role) => role === "captain" || role === "admin",
  // Score entry: admin (any game) or temp_admin (their assigned game only)
  enterScores: (role) => role === "admin" || role === "temp_admin",
  // Only admin can change roles / assign temp admins / open-close registration
  changeRoles: (role) => role === "admin",
  // Players (and above, except anonymous) have a personal profile/team view
  hasOwnProfile: (role) => role === "player" || role === "captain",
};

// Which bottom-nav / menu items a role should see.
export function navItemsForRole(role) {
  const base = [
    { to: "/", label: "Home", icon: "house" },
    { to: "/schedule", label: "Schedule", icon: "calendar" },
    { to: "/standings", label: "Standings", icon: "ranking" },
    { to: "/leaderboards", label: "Leaders", icon: "trophy" },
  ];
  if (role === "player" || role === "captain") {
    base.push({ to: "/profile/me", label: "Me", icon: "user" });
  }
  if (role === "captain") {
    base.push({ to: "/free-agents", label: "Agents", icon: "users" });
  }
  if (role === "admin") {
    base.push({ to: "/admin", label: "Admin", icon: "shield" });
  }
  if (role === "temp_admin") {
    base.push({ to: "/score-entry", label: "Score", icon: "pencil" });
  }
  return base;
}
