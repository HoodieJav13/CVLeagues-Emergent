import { sportName } from "../../lib/statsConfig";

// Sport chip — an OUTLINE chip (rounded-full + coloured border, no dot) to stay
// visually distinct from the soft-filled, dotted, radius-sm status pills below.
// Kickball = teal, flag football = orange (v2 sport tokens — gold is reserved
// for achievement/emphasis and never marks a sport).
const SPORT_STYLES = {
  kickball: { bg: "var(--sport-kickball-tint)", fg: "var(--sport-kickball)", border: "var(--sport-kickball)" },
  flag_football: { bg: "var(--sport-flag-tint)", fg: "var(--sport-flag)", border: "var(--sport-flag)" },
};

export const SportBadge = ({ sport, className = "" }) => {
  const s = SPORT_STYLES[sport] || SPORT_STYLES.kickball;
  return (
    <span
      data-testid={`sport-badge-${sport}`}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-micro font-semibold uppercase tracking-wide ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {sportName(sport)}
    </span>
  );
};

// Status pill (spec §5). Every status maps to a brand token pairing — text +
// matching -bg — and carries a TEXT label plus a leading dot (never colour
// alone). Colour categories follow the three-signal system: teal = normal/
// positive/done, gold = needs-attention, Zia red = alert/problem, slate =
// quiet/closed. `live` pulses on the dot only (see .cvf-status-pulse, which is
// disabled under prefers-reduced-motion); every other status is static.
const TEAL = { fg: "var(--status-upcoming)", bg: "var(--status-upcoming-bg)" };
const GOLD = { fg: "var(--cvf-gold)", bg: "var(--cvf-gold-tint)" };
const ALERT = { fg: "var(--status-live)", bg: "var(--status-live-bg)" };
const SLATE = { fg: "var(--status-final)", bg: "var(--status-final-bg)" };

const STATUS_STYLES = {
  // game status
  live: { ...ALERT, label: "Live", pulse: true }, // dormant: no existing data emits "live"
  upcoming: { ...TEAL, label: "Upcoming" },
  completed: { ...SLATE, label: "Final" },
  postponed: { ...GOLD, label: "Postponed" },
  canceled: { ...ALERT, label: "Canceled" },
  // game score_status (pending/submitted/approved/disputed/final)
  pending: { ...GOLD, label: "Pending" },
  submitted: { ...TEAL, label: "Submitted" },
  approved: { ...TEAL, label: "Approved" },
  disputed: { ...ALERT, label: "Disputed" },
  final: { ...SLATE, label: "Final" },
  // intake triage (registrations & free agents)
  new: { ...TEAL, label: "New" },
  contacted: { ...GOLD, label: "Contacted" },
  assigned: { ...TEAL, label: "Assigned" },
  archived: { ...SLATE, label: "Archived" },
  // entity lifecycle (teams & leagues)
  draft: { ...SLATE, label: "Draft" },
  active: { ...TEAL, label: "Active" },
  ready: { ...TEAL, label: "Ready" },
  bye: { ...SLATE, label: "Bye" },
  complete: { ...SLATE, label: "Complete" },
  // waiver verification (pending/rejected shared with the entries above)
  verified: { ...TEAL, label: "Verified" },
  duplicate: { ...SLATE, label: "Duplicate" },
  // legacy demo values kept for FINAL DRAFT (dormant) account features
  rejected: { ...ALERT, label: "Rejected" },
  invited: { ...GOLD, label: "Invited" },
};

export const StatusBadge = ({ status, className = "" }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-cvf-sm text-label uppercase ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0${s.pulse ? " cvf-status-pulse" : ""}`}
        style={{ backgroundColor: s.fg }}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
};
