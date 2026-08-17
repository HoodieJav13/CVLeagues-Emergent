import { Link } from "react-router-dom";
import { StructuralIdentityBadge } from "../direction/StructuralIdentity";
import { AthleteHoverCard } from "./AthleteHoverCard";

export const RankedLeaderboardRow = ({ row, statLabel }) => {
  const tier = row.rank <= 3 ? `podium-${row.rank}` : "field";
  const rankLabel = row.rankLabel || `${row.rank}`;

  return (
    <div
      className="cvf-ranked-row"
      data-rank={row.rank}
      data-rank-label={rankLabel}
      data-rank-tier={tier}
      data-testid={`leaderboard-row-${row.profile.id}`}
    >
      <span className="cvf-ranked-row__rank" aria-label={`Rank ${rankLabel}`}>{rankLabel}</span>
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

export const FeaturedLeaderboardHero = ({ row, statLabel, titleId }) => {
  const rankLabel = row.rankLabel || `${row.rank}`;

  return (
    <div
      className="cvf-leaderboard-hero"
      data-rank-label={rankLabel}
      data-tied={row.tied ? "true" : "false"}
      data-testid={`leaderboard-hero-${row.profile.id}`}
    >
      {/* The Pass 3 corner rays are retired on this surface (Addendum 11 open
          item, resolved by this batch); the heading carries the engraved rule
          that replaces them. */}
      <div className="cvf-leaderboard-hero__heading">
        <span className="cvf-leaderboard-hero__kicker">Category leader</span>
        <h2 id={titleId}>{statLabel}</h2>
      </div>

      <div className="cvf-leaderboard-hero__identity">
        <StructuralIdentityBadge
          className="cvf-identity-badge--leaderboard-hero"
          color={row.profile.avatar_color}
          name={row.profile.name}
          testId={`leaderboard-hero-identity-${row.profile.id}`}
        />
        <div className="cvf-leaderboard-hero__person">
          <span className="cvf-leaderboard-hero__rank" aria-label={`Rank ${rankLabel}`}>{rankLabel}</span>
          <AthleteHoverCard profile={row.profile} team={row.team}>
            <Link to={`/profile/${row.profile.id}`} className="cvf-leaderboard-hero__name">
              {row.profile.name}
            </Link>
          </AthleteHoverCard>
          {row.team ? (
            <Link to={`/team/${row.team.id}`} className="cvf-leaderboard-hero__team">{row.team.name}</Link>
          ) : null}
        </div>
      </div>

      <span className="cvf-leaderboard-hero__value" aria-label={`${row.value} ${statLabel}`}>{row.value}</span>
    </div>
  );
};
