import { sportName } from "../../lib/statsConfig";

const SPORT_STYLES = {
  kickball: { bg: "rgba(34,211,238,0.12)", fg: "#22d3ee", border: "rgba(34,211,238,0.35)" },
  flag_football: { bg: "rgba(249,115,22,0.12)", fg: "#fb923c", border: "rgba(249,115,22,0.35)" },
};

export const SportBadge = ({ sport, className = "" }) => {
  const s = SPORT_STYLES[sport] || SPORT_STYLES.kickball;
  return (
    <span
      data-testid={`sport-badge-${sport}`}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {sportName(sport)}
    </span>
  );
};

export const StatusBadge = ({ status, className = "" }) => {
  const map = {
    // game status
    completed: { fg: "#a1a1aa", bg: "rgba(255,255,255,0.06)", label: "Final" },
    upcoming: { fg: "#22d3ee", bg: "rgba(34,211,238,0.12)", label: "Upcoming" },
    postponed: { fg: "#facc15", bg: "rgba(250,204,21,0.12)", label: "Postponed" },
    canceled: { fg: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Canceled" },
    // game score_status (pending/submitted/approved/disputed/final)
    pending: { fg: "#facc15", bg: "rgba(250,204,21,0.12)", label: "Pending" },
    submitted: { fg: "#22d3ee", bg: "rgba(34,211,238,0.12)", label: "Submitted" },
    approved: { fg: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Approved" },
    disputed: { fg: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Disputed" },
    final: { fg: "#a1a1aa", bg: "rgba(255,255,255,0.06)", label: "Final" },
    // intake triage (registrations & free agents)
    new: { fg: "#22d3ee", bg: "rgba(34,211,238,0.12)", label: "New" },
    contacted: { fg: "#facc15", bg: "rgba(250,204,21,0.12)", label: "Contacted" },
    assigned: { fg: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Assigned" },
    archived: { fg: "#a1a1aa", bg: "rgba(255,255,255,0.06)", label: "Archived" },
    // entity lifecycle (teams & leagues)
    draft: { fg: "#a1a1aa", bg: "rgba(255,255,255,0.06)", label: "Draft" },
    active: { fg: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Active" },
    // waiver verification (pending/rejected shared with the entries above)
    verified: { fg: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Verified" },
    duplicate: { fg: "#a1a1aa", bg: "rgba(255,255,255,0.06)", label: "Duplicate" },
    // legacy demo values kept for FINAL DRAFT (dormant) account features
    rejected: { fg: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Rejected" },
    invited: { fg: "#facc15", bg: "rgba(250,204,21,0.12)", label: "Invited" },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
};
