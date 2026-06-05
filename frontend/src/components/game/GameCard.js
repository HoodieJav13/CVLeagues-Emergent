import { Link } from "react-router-dom";
import { MapPin, Clock } from "@phosphor-icons/react";
import { useApp } from "../../context/AppStateContext";
import { getTeam, computeTeamRecord } from "../../lib/selectors";
import { SportBadge, StatusBadge } from "../common/Badges";

const TeamLine = ({ team, score, isWinner, completed }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: team?.logoColor || "#555" }}
      />
      <span
        className={`font-display uppercase tracking-tight text-base truncate ${
          completed && !isWinner ? "text-muted-foreground" : "text-white"
        }`}
      >
        {team?.name || "TBD"}
      </span>
    </div>
    {completed ? (
      <span
        className={`font-mono-score text-xl font-bold tabular-nums ${
          isWinner ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {score}
      </span>
    ) : null}
  </div>
);

export const GameCard = ({ game, className = "" }) => {
  const { state } = useApp();
  const home = getTeam(state, game.homeTeamId);
  const away = getTeam(state, game.awayTeamId);
  const completed = game.status === "completed";
  const homeWin = completed && game.homeScore > game.awayScore;
  const awayWin = completed && game.awayScore > game.homeScore;
  const dateStr = new Date(game.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      to={`/game/${game.id}`}
      data-testid={`game-card-${game.id}`}
      className={`block bg-card border border-border rounded-xl p-4 shadow-card transition-all duration-200 hover:border-primary/50 hover:-translate-y-1 hover:shadow-card-hover ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <SportBadge sport={game.sport} />
        <StatusBadge status={game.status} />
      </div>
      <div className="space-y-2">
        <TeamLine team={away} score={game.awayScore} isWinner={awayWin} completed={completed} />
        <TeamLine team={home} score={game.homeScore} isWinner={homeWin} completed={completed} />
      </div>
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-medium text-white/80">{dateStr}</span>
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
