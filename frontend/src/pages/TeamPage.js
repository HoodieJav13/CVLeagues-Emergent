import { useParams, Link } from "react-router-dom";
import { useApp } from "../context/AppStateContext";
import { getLeague, getProfile, computeTeamRecord, teamRoster, teamGames, teamStatLeaders } from "../lib/selectors";
import { HIGHLIGHT_STATS, statLabel } from "../lib/statsConfig";
import { SportBadge } from "../components/common/Badges";
import { PlayerCard } from "../components/player/PlayerCard";
import { GameCard } from "../components/game/GameCard";
import { SectionHeading } from "../components/common/Section";
import { Avatar } from "../components/common/Avatar";

export default function TeamPage() {
  const { id } = useParams();
  const { state } = useApp();
  const team = state.teams.find((t) => t.id === id);
  if (!team) return <p className="text-muted-foreground">Team not found.</p>;

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
      <div className="relative overflow-hidden rounded-2xl border border-border p-6" style={{ background: `linear-gradient(135deg, ${team.logo_color}22, transparent)` }}>
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-2xl text-ink" style={{ backgroundColor: team.logo_color }}>
            {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0">
            <h1 className="font-display uppercase text-display-lg text-foreground">{team.name}</h1>
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
      </div>

      {/* Stat leaders */}
      <section>
        <SectionHeading title="Stat Leaders" />
        <div className="grid grid-cols-3 gap-3">
          {leaders.map((l) => (
            <div key={l.key} className="bg-card border border-border rounded-2xl p-4 text-center">
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
            </div>
          ))}
        </div>
      </section>

      {/* Roster */}
      <section>
        <SectionHeading title="Roster" subtitle={`${roster.length} players`} />
        {roster.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-caption text-muted-foreground">
            No players on this roster yet. Names land here once the admin assigns them.
          </div>
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
  <div className="bg-[#0F1416]/60 border border-border rounded-xl p-3 text-center">
    <p className={`font-mono-score text-xl font-bold ${accent ? "text-teal" : "text-foreground"}`}>{value}</p>
    <p className="text-micro uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
  </div>
);
