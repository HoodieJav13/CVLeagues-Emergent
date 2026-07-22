import { Link } from "react-router-dom";
import { MapPin, Clock } from "@phosphor-icons/react";
import { useApp } from "../../context/AppStateContext";
import { getTeam, isFinalOutcome, isForfeitOutcome } from "../../lib/selectors";
import { SportBadge, StatusBadge } from "../common/Badges";
import { StageBanner, isSpecialStage } from "./StageBanner";

// Winner/loser weighting (spec §5). Winner: --win text, body-strong weight,
// score in --score-figure. Loser: --loss-text, regular weight. A 3px teal
// leading bar marks the winner's side (transparent on the other row so columns
// stay aligned) — no whole-card background change. isWinner/isLoser come purely
// from the caller's existing score comparison; this component decides nothing.
const TeamLine = ({ team, score, isWinner, isLoser, completed }) => {
  const nameEmphasis = isWinner
    ? "text-[var(--win)] font-semibold"
    : isLoser
    ? "text-[var(--loss-text)] font-normal"
    : "text-foreground font-normal";
  const scoreEmphasis = isWinner
    ? "text-[var(--win)]"
    : isLoser
    ? "text-[var(--loss-text)] font-normal"
    : "text-foreground font-normal";
  return (
    <div
      className={`flex items-center justify-between gap-3 border-l-[3px] pl-2.5 ${
        isWinner ? "border-teal" : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: team?.logo_color || "var(--border-strong)" }}
        />
        <span className={`font-sans normal-case tracking-normal text-base sm:text-sm leading-snug whitespace-normal break-words ${nameEmphasis}`}>
          {team?.name || "TBD"}
        </span>
      </div>
      {completed ? (
        <span className={`font-mono-score tabular-nums text-score sm:text-[1.5rem] ${scoreEmphasis}`}>
          {score}
        </span>
      ) : null}
    </div>
  );
};

export const GameCard = ({ game, className = "" }) => {
  const { state } = useApp();
  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = isFinalOutcome(game);
  const forfeit = isForfeitOutcome(game);
  const homeWin = completed && (forfeit ? game.winner_team_id === game.home_team_id : game.home_score > game.away_score);
  const awayWin = completed && (forfeit ? game.winner_team_id === game.away_team_id : game.away_score > game.home_score);
  // Upcoming games get a teal left-edge accent; recent results stay neutral.
  // Both read off the existing game.status — no new state.
  // Playoff/tournament games (any status) instead carry the gold treatment:
  // full-width StageBanner up top + gold left edge, upcoming AND historical.
  const isUpcoming = game.status === "upcoming";
  const special = isSpecialStage(game);
  const dateStr = new Date(game.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      to={`/game/${game.id}`}
      data-testid={`game-card-${game.id}`}
      className={`block bg-card border border-border rounded-xl p-4 sm:p-3 shadow-card hover:border-primary/50 hover:shadow-card-hover ${
        special ? "border-l-2 border-l-gold" : isUpcoming ? "border-l-2 border-l-teal" : ""
      } ${className}`}
    >
      {special && (
        // Full-bleed strip: negative margins pull it over the card padding.
        <StageBanner stage={game.stage} className="-mx-4 -mt-4 sm:-mx-3 sm:-mt-3 mb-3 sm:mb-2 px-4 sm:px-3 py-1.5 rounded-t-xl" />
      )}
      <div className="flex items-center justify-between mb-3 sm:mb-2">
        <SportBadge sport={game.sport} />
        <StatusBadge status={game.status} />
      </div>
      <div className="space-y-2 sm:space-y-1">
        <TeamLine team={away} score={forfeit ? (awayWin ? "W" : "L") : game.away_score} isWinner={awayWin} isLoser={homeWin} completed={completed} />
        <TeamLine team={home} score={forfeit ? (homeWin ? "W" : "L") : game.home_score} isWinner={homeWin} isLoser={awayWin} completed={completed} />
      </div>
      <div className="mt-3 sm:mt-2 pt-3 sm:pt-2 border-t border-border flex flex-wrap items-center gap-x-4 sm:gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-medium text-foreground/80">{dateStr}</span>
        <span className="flex items-center gap-1">
          <Clock size={13} weight="bold" /> {game.time}
        </span>
        <span className="flex items-center gap-1 truncate">
          <MapPin size={13} weight="bold" /> {game.location}
        </span>
      </div>
    </Link>
  );
};
