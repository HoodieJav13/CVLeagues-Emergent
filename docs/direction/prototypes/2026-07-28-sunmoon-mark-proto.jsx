/* PROTOTYPE — Step 3 of the Identity batch (decision 7). NOT PRODUCT CODE.
 * Renders the two Addendum 6 candidate marks in place so they can be captured
 * for the owner's choice. This file is deliberately uncommitted and is removed
 * after captures; the chosen drawing gets recorded in the contract first.
 *
 * Variant selection is per-URL (?motif=bold) so both candidates can be
 * captured without code edits between shots.
 */
import { gameStart, LEAGUE_TIME_ZONE } from "../../lib/gameTime";

const NIGHT_CUTOFF_HOUR = 18; // working cutoff per Addendum 6: 6:00 PM league time

const leagueHour = (game) => {
  const start = gameStart(game);
  if (!start) return null;
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: LEAGUE_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(start)
  );
};

export const isNightGame = (game) => {
  const hour = leagueHour(game);
  return hour == null ? true : hour >= NIGHT_CUTOFF_HOUR;
};

export const motifVariant = () =>
  new URLSearchParams(window.location.search).get("motif") === "bold" ? "bold" : "compliant";

const TONES = {
  teal: "var(--cvf-teal)",
  gold: "var(--cvf-gold)",
  neutral: "var(--border-strong)",
};

/* Sun: half-disc rising from the frame's top edge with a Zia-derived ray fan —
 * grouped rays of two lengths, drawn as strokes, echoing the logo's ray
 * grammar without reproducing the full circle-and-rays symbol.
 * Moon: open crescent. Color always comes from the state tone. */
const SunCompliant = ({ color }) => (
  <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden="true">
    <g stroke={color} strokeWidth="2" strokeLinecap="square" fill="none">
      <path d="M30 16 a 9 9 0 0 1 18 0" fill="none" />
      <line x1="22" y1="16" x2="56" y2="16" />
      <line x1="39" y1="1" x2="39" y2="7" />
      <line x1="28" y1="4" x2="31.5" y2="9.5" />
      <line x1="50" y1="4" x2="46.5" y2="9.5" />
      <line x1="20" y1="10.5" x2="26" y2="13" />
    </g>
  </svg>
);

/* Moon revision (2026-07-28, owner feedback on the first pair): night is the
 * league's common state, so the moon carries more weight — solid filled
 * crescent instead of an outline, which is what actually registers on the
 * dark surface in a cold read. */
const MoonCompliant = ({ color }) => (
  <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden="true">
    <path d="M42 3 a 14 14 0 1 0 9.5 25 a 11 11 0 0 1 -9.5 -25 Z" fill={color} />
    <path d="M26 6 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 Z" fill={color} />
  </svg>
);

const SunBold = ({ color }) => (
  <svg width="96" height="72" viewBox="0 0 96 72" aria-hidden="true">
    <defs>
      <radialGradient id="cvf-sun-wash" cx="70%" cy="20%" r="80%">
        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="96" height="72" fill="url(#cvf-sun-wash)" />
    <g stroke={color} strokeWidth="3.5" strokeLinecap="square" fill="none">
      <path d="M52 26 a 16 16 0 0 1 32 0" />
      <line x1="38" y1="26" x2="96" y2="26" />
      <line x1="68" y1="0" x2="68" y2="11" />
      <line x1="50" y1="4" x2="56" y2="14" />
      <line x1="86" y1="4" x2="80" y2="14" />
      <line x1="36" y1="12" x2="46" y2="18" />
      <line x1="96" y1="14" x2="90" y2="18" />
    </g>
  </svg>
);

const MoonBold = ({ color }) => (
  <svg width="96" height="72" viewBox="0 0 96 72" aria-hidden="true">
    <defs>
      <radialGradient id="cvf-moon-wash" cx="78%" cy="22%" r="75%">
        <stop offset="0%" stopColor={color} stopOpacity="0.24" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="96" height="72" fill="url(#cvf-moon-wash)" />
    {/* Offset echo first (badge-signature move: duplicate shifted lower-right),
        then the solid crescent on top — the motif borrows the hexagon badge's
        own offset-outline grammar instead of generic clip-art moonlight. */}
    <path d="M81 5 a 16 16 0 1 0 10.5 28.5 a 12.5 12.5 0 0 1 -10.5 -28.5 Z" fill={color} opacity="0.45" />
    <path d="M78 2 a 16 16 0 1 0 10.5 28.5 a 12.5 12.5 0 0 1 -10.5 -28.5 Z" fill={color} />
    <path d="M50 3 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2 Z" fill={color} />
    <path d="M64 41 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 Z" fill={color} />
  </svg>
);

export const SunMoonMark = ({ game, tone = "teal" }) => {
  const color = TONES[tone] || TONES.teal;
  const night = isNightGame(game);
  const bold = motifVariant() === "bold";
  const Mark = night ? (bold ? MoonBold : MoonCompliant) : (bold ? SunBold : SunCompliant);
  return (
    <span
      aria-hidden="true"
      style={{ position: "absolute", top: 0, right: 0, zIndex: 3, pointerEvents: "none" }}
    >
      <Mark color={color} />
    </span>
  );
};
