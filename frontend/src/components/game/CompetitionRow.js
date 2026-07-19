import { Link } from "react-router-dom";
import { MapPin } from "@phosphor-icons/react";
import { useApp } from "../../context/AppStateContext";
import { getTeam } from "../../lib/selectors";
import { SportBadge, StatusBadge } from "../common/Badges";
import { StructuralIdentityBadge } from "../direction/StructuralIdentity";
import { StageBanner, isSpecialStage } from "./StageBanner";

const TeamIdentity = ({ align, isLoser, isWinner, team }) => (
  <div className={`cvf-competition-row__team cvf-competition-row__team--${align}`}>
    <StructuralIdentityBadge
      className="cvf-identity-badge--register"
      team={team}
      testId={`competition-identity-${team?.id || align}`}
    />
    <span
      className={`cvf-competition-row__team-name ${
        isWinner
          ? "text-[var(--win)] font-semibold"
          : isLoser
          ? "text-[var(--loss-text)] font-normal"
          : "text-foreground font-medium"
      }`}
    >
      {team?.name || "TBD"}
    </span>
  </div>
);

export const CompetitionRow = ({ game }) => {
  const { state } = useApp();
  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = game.status === "completed";
  const homeWin = completed && game.home_score > game.away_score;
  const awayWin = completed && game.away_score > game.home_score;
  const special = isSpecialStage(game);
  const date = new Date(`${game.date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      to={`/game/${game.id}`}
      className="cvf-competition-row"
      data-game-stage={game.stage || "regular"}
      data-testid={`competition-row-${game.id}`}
    >
      <div className="cvf-competition-row__sport">
        <SportBadge sport={game.sport} />
      </div>

      <TeamIdentity align="away" team={away} isWinner={awayWin} isLoser={homeWin} />

      <div className="cvf-competition-row__center">
        <span className="cvf-competition-row__date">{date}</span>
        <span className="cvf-competition-row__focal">
          {completed ? `${game.away_score}–${game.home_score}` : game.time}
        </span>
      </div>

      <TeamIdentity align="home" team={home} isWinner={homeWin} isLoser={awayWin} />

      <div className="cvf-competition-row__meta">
        <div className="cvf-competition-row__status">
          <StatusBadge status={game.status} />
        </div>
        <div className="cvf-competition-row__details">
          {special ? <StageBanner stage={game.stage} className="cvf-competition-row__stage" /> : null}
          <span className="cvf-competition-row__location">
            <MapPin size={13} weight="bold" aria-hidden="true" />
            <span>{game.location}</span>
          </span>
        </div>
      </div>
    </Link>
  );
};
