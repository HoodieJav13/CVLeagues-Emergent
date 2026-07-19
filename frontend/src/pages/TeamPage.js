import { useParams, Link } from "react-router-dom";
import { UsersThree } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { getLeague, getProfile, computeTeamRecord, teamRoster, teamGames, teamStatLeaders } from "../lib/selectors";
import { HIGHLIGHT_STATS, statLabel } from "../lib/statsConfig";
import { SportBadge } from "../components/common/Badges";
import { PlayerCard } from "../components/player/PlayerCard";
import { GameCard } from "../components/game/GameCard";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { Avatar } from "../components/common/Avatar";
import { Card, CardContent } from "../components/ui/card";

export default function TeamPage() {
  const { id } = useParams();
  const { state } = useApp();
  const team = state.teams.find((t) => t.id === id);
  if (!team) return <EmptyState icon={UsersThree} title="Team not found" message="This team may have been removed or the link is invalid." />;

  const league = getLeague(state, team.league_id);
  const record = computeTeamRecord(state, team.id);
  const roster = teamRoster(state, team.id);
  const games = teamGames(state, team.id);
  const upcoming = games.filter((g) => g.status === "upcoming").slice(0, 3);
  const recent = games.filter((g) => g.status === "completed").reverse().slice(0, 3);
  const captain = getProfile(state, team.captain_id);
  const leaders = teamStatLeaders(state, team.id, HIGHLIGHT_STATS[team.sport]);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <Card density="spacious" className="relative overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${team.logo_color}22, transparent)` }}>
        <CardContent className="p-[var(--card-spacing)]">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-2xl text-ink" style={{ backgroundColor: team.logo_color }}>
            {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0">
            <h1 className="font-display uppercase text-display-xl text-foreground">{team.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <SportBadge sport={team.sport} />
              <span className="text-xs text-muted-foreground">{league?.name}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5">
          <Stat label="Record" value={`${record.wins}-${record.losses}`} />
          <Stat label="Pts For" value={record.pointsFor} />
          <Stat label="Diff" value={`${record.diff > 0 ? "+" : ""}${record.diff}`} accent={record.diff > 0} />
        </div>
        {captain && (
          <p className="text-xs text-muted-foreground mt-4">
            Captain: <Link to={`/profile/${captain.id}`} className="text-primary font-semibold">{captain.name}</Link>
          </p>
        )}
        </CardContent>
      </Card>

      {/* Stat leaders */}
      <section>
        <SectionHeading title="Stat Leaders" />
        <div className="grid grid-cols-3 gap-3">
          {leaders.map((l) => (
            <Card key={l.key} density="compact" className="rounded-2xl text-center">
              <CardContent className="p-[var(--card-spacing)]">
              <p className="text-micro uppercase tracking-widest text-muted-foreground font-semibold">{statLabel(team.sport, l.key)}</p>
              {l.profile ? (
                <>
                  <Avatar name={l.profile.name} color={l.profile.avatar_color} size={40} className="mx-auto my-2" />
                  <p className="font-mono-score text-2xl font-bold text-primary leading-none">{l.value}</p>
                  <Link to={`/profile/${l.profile.id}`} className="text-xs text-foreground hover:text-primary truncate block mt-1">{l.profile.name.split(" ")[0]}</Link>
                </>
              ) : (
                <p className="text-muted-foreground text-sm mt-3">—</p>
              )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Roster */}
      <section>
        <SectionHeading title="Roster" subtitle={`${roster.length} players`} />
        {roster.length === 0 ? (
          <EmptyState icon={UsersThree} title="No players assigned" message="Names appear here once an admin builds the roster." density="default" className="bg-card border border-border rounded-xl" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {roster.map((r) => (
              <PlayerCard key={r.id} profile={r.profile} jersey_number={r.jersey_number} position={r.position} isCaptain={team.captain_id === r.profile_id} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <SectionHeading title="Upcoming" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{upcoming.map((g) => <GameCard key={g.id} game={g} />)}</div>
        </section>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <section>
          <SectionHeading title="Recent Results" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{recent.map((g) => <GameCard key={g.id} game={g} />)}</div>
        </section>
      )}
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <Card density="compact" className="bg-surface/60 text-center">
    <CardContent className="p-[var(--card-spacing)]">
      <p className={`font-mono-score text-xl font-bold ${accent ? "text-teal" : "text-foreground"}`}>{value}</p>
      <p className="text-micro uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
    </CardContent>
  </Card>
);
