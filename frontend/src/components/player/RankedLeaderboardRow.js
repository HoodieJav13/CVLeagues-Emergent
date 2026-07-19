import { Link } from "react-router-dom";
import { StructuralIdentityBadge } from "../direction/StructuralIdentity";
import { AthleteHoverCard } from "./AthleteHoverCard";

export const RankedLeaderboardRow = ({ row, statLabel }) => {
  const tier = row.rank <= 3 ? `podium-${row.rank}` : "field";

  return (
    <div
      className="cvf-ranked-row"
      data-rank={row.rank}
      data-rank-tier={tier}
      data-testid={`leaderboard-row-${row.profile.id}`}
    >
      <span className="cvf-ranked-row__rank" aria-label={`Rank ${row.rank}`}>{row.rank}</span>
      <StructuralIdentityBadge
        className="cvf-identity-badge--leaderboard"
        color={row.profile.avatar_color}
        name={row.profile.name}
        testId={`leaderboard-identity-${row.profile.id}`}
      />
      <div className="cvf-ranked-row__identity">
        <AthleteHoverCard profile={row.profile} team={row.team}>
          <Link to={`/profile/${row.profile.id}`} className="cvf-ranked-row__name">
            {row.profile.name}
          </Link>
        </AthleteHoverCard>
        {row.team ? (
          <Link to={`/team/${row.team.id}`} className="cvf-ranked-row__team">{row.team.name}</Link>
        ) : null}
      </div>
      <span className="cvf-ranked-row__value" aria-label={`${row.value} ${statLabel}`}>{row.value}</span>
    </div>
  );
};
