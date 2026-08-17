import { Link } from "react-router-dom";
import { MapPin } from "@phosphor-icons/react";
import { useApp } from "../../context/AppStateContext";
import { getTeam, isFinalOutcome, isForfeitOutcome } from "../../lib/selectors";
import { formatGameDate, formatGameTime, venueLabel } from "../../lib/gameTime";
import { SportBadge, StatusBadge } from "../common/Badges";
import { StructuralIdentityBadge } from "../direction/StructuralIdentity";
import { StageBanner, isSpecialStage } from "./StageBanner";

const TeamIdentity = ({ align, isLoser, isWinner, team }) => (
  <div className={`cvf-competition-row__team cvf-competition-row__team--${align}`}>
    <StructuralIdentityBadge
      className={`cvf-identity-badge--register${isWinner ? " cvf-gild" : ""}`}
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

/* Mobile scoreline (D2): one team per line, full name in display type that
 * wraps instead of truncating — the name is the payload a player scans for.
 * Winner/loser weighting reads top-to-bottom; away is always the first line
 * (list-order convention, stated once in the Schedule page copy). */
const StackedLine = ({ team, value, isWinner, isLoser, valueClass = "" }) => (
  <div className="cvf-competition-row__stacked-line">
    <StructuralIdentityBadge className={`cvf-identity-badge--sm${isWinner ? " cvf-gild" : ""}`} team={team} />
    <span
      className={`cvf-competition-row__stacked-name ${
        isWinner
          ? "text-[var(--win)] font-semibold"
          : isLoser
          ? "text-[var(--loss-text)] font-normal"
          : "text-foreground font-medium"
      }`}
    >
      {team?.name || "TBD"}
    </span>
    {value != null && (
      <span
        className={`cvf-competition-row__stacked-value ${valueClass} ${
          isWinner ? "text-[var(--win)]" : isLoser ? "text-[var(--loss-text)]" : ""
        }`}
      >
        {value}
      </span>
    )}
  </div>
);

export const CompetitionRow = ({ game }) => {
  const { state } = useApp();
  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = isFinalOutcome(game);
  const forfeit = isForfeitOutcome(game);
  const homeWin = completed && (forfeit ? game.winner_team_id === game.home_team_id : game.home_score > game.away_score);
  const awayWin = completed && (forfeit ? game.winner_team_id === game.away_team_id : game.away_score > game.home_score);
  const special = isSpecialStage(game);
  const date = formatGameDate(game);

  const stackedAwayValue = completed
    ? (forfeit ? (awayWin ? "W" : "L") : game.away_score)
    : formatGameTime(game);
  const stackedHomeValue = completed
    ? (forfeit ? (homeWin ? "W" : "L") : game.home_score)
    : null;

  return (
    <Link
      to={`/game/${game.id}`}
      className="cvf-competition-row"
      data-game-stage={game.stage || "regular"}
      data-testid={`competition-row-${game.id}`}
    >
      {/* D2 stacked scorelines — mobile only. */}
      <div className="cvf-competition-row__stacked" data-testid={`competition-stacked-${game.id}`}>
        <div className="cvf-competition-row__stacked-head">
          <SportBadge sport={game.sport} />
          <StatusBadge status={game.status} />
        </div>
        <StackedLine
          team={away}
          value={stackedAwayValue}
          isWinner={awayWin}
          isLoser={homeWin}
          valueClass={completed ? "" : "cvf-competition-row__stacked-value--time"}
        />
        <StackedLine team={home} value={stackedHomeValue} isWinner={homeWin} isLoser={awayWin} />
        <div className="cvf-competition-row__stacked-meta">
          {special ? <StageBanner stage={game.stage} className="cvf-competition-row__stage" /> : null}
          <span>{forfeit ? "Forfeit" : date}</span>
          <span className="cvf-competition-row__location">
            <MapPin size={13} weight="bold" aria-hidden="true" />
            <span>{venueLabel(state, game)}</span>
          </span>
        </div>
      </div>

      {/* Desktop register — unchanged layout from Batch 1. */}
      <div className="cvf-competition-row__grid">
        <div className="cvf-competition-row__sport">
          <SportBadge sport={game.sport} />
        </div>

        <TeamIdentity align="away" team={away} isWinner={awayWin} isLoser={homeWin} />

        <div className="cvf-competition-row__center">
          <span className="cvf-competition-row__date">{date}</span>
          <span className="cvf-competition-row__focal">
            {forfeit ? "Forfeit" : completed ? `${game.away_score}–${game.home_score}` : formatGameTime(game)}
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
              <span>{venueLabel(state, game)}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
