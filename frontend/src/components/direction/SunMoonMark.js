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
  <svg width="84" height="64" viewBox="0 0 84 64" aria-hidden="true">
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

const Sun = () => (
  <svg width="84" height="64" viewBox="0 0 84 64" aria-hidden="true">
    <g stroke="var(--cvf-gold)" strokeWidth="3" strokeLinecap="square" fill="none">
      <path d="M45 24 a 13.5 13.5 0 0 1 27 0" />
      <line x1="33" y1="24" x2="84" y2="24" />
      <line x1="58.5" y1="1.5" x2="58.5" y2="10.5" />
      <line x1="42" y1="6" x2="47.25" y2="14.25" />
      <line x1="75" y1="6" x2="69.75" y2="14.25" />
      <line x1="30" y1="15.75" x2="39" y2="19.5" />
    </g>
  </svg>
);

export const SunMoonMark = ({ game, className = "" }) => (
  <span aria-hidden="true" className={`cvf-sunmoon ${className}`.trim()}>
    {isNightGame(game) ? <Moon /> : <Sun />}
  </span>
);
