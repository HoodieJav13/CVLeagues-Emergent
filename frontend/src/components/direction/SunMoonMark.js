import { gameStart, LEAGUE_TIME_ZONE } from "../../lib/gameTime";

/* Addendum 6 state-bearing motif: solid white crescent + gold star for night
 * games, gold Zia-derived sun for day games, split on a fixed league-local
 * clock hour — never sunset math. The mark is decorative reinforcement: game
 * time is always stated textually beside it, and game state reads from the
 * StatusBadge and frame border, so no meaning rides on this mark alone. */
const NIGHT_CUTOFF_HOUR = 18; // 6:00 PM — changing the cutoff is this one constant

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

// An unknown start time renders as night: every real game in the league so
// far is a night game, so night is the honest default, not a guess at noon.
export const isNightGame = (game) => {
  const hour = leagueHour(game);
  return hour == null ? true : hour >= NIGHT_CUTOFF_HOUR;
};

const Moon = () => (
  <svg width="27" height="22" viewBox="28 2 58 46" aria-hidden="true">
    <path
      d="M63 4.5 a 21 21 0 1 0 14.25 37.5 a 16.5 16.5 0 0 1 -14.25 -37.5 Z"
      fill="var(--text-primary)"
    />
    <path
      d="M39 9 l2.7 6 6 2.7 -6 2.7 -2.7 6 -2.7 -6 -6 -2.7 6 -2.7 Z"
      fill="var(--cvf-gold)"
    />
  </svg>
);

/* Sunrise: solid half-disc grounded on a horizon, with a symmetric five-ray
 * fan in the Zia alternating-length rhythm (long-short-long-short-long).
 * Built with the same solidity as the crescent so the pair reads as one
 * system, not an outline sun next to a filled moon. */
const Sun = () => (
  <svg width="27" height="17" viewBox="29 10 56 34" aria-hidden="true">
    <g stroke="var(--cvf-gold)" strokeWidth="3.5" strokeLinecap="round" fill="none">
      <line x1="32" y1="42" x2="82" y2="42" />
      <line x1="57" y1="25" x2="57" y2="13" />
      <line x1="65.5" y1="27.3" x2="69.5" y2="20.3" />
      <line x1="48.5" y1="27.3" x2="44.5" y2="20.3" />
      <line x1="71.7" y1="33.5" x2="82.1" y2="27.5" />
      <line x1="42.3" y1="33.5" x2="31.9" y2="27.5" />
    </g>
    <path d="M44 42 a 13 13 0 0 1 26 0 Z" fill="var(--cvf-gold)" />
  </svg>
);

/* Addendum 11 §5: the mark is set like everything else in the Inlay world —
 * a stone in a small recessed bezel well. The Addendum 6 drawing, cutoff, and
 * corner placement are unchanged; only the setting adapts. */
export const SunMoonMark = ({ game, className = "" }) => (
  <span aria-hidden="true" className={`cvf-sunmoon ${className}`.trim()}>
    <span className="cvf-sunmoon__well">{isNightGame(game) ? <Moon /> : <Sun />}</span>
  </span>
);
