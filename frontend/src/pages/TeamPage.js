import { useParams, Link } from "react-router-dom";
import { UsersThree, CalendarPlus, LinkSimple } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { getLeague, getProfile, computeTeamRecord, isFinalOutcome, teamRoster, teamGames, teamStatLeaders, identityEnrollments, identityCareerRecord } from "../lib/selectors";
import { HIGHLIGHT_STATS, statLabel } from "../lib/statsConfig";
import { SportBadge } from "../components/common/Badges";
import { PlayerCard } from "../components/player/PlayerCard";
import { GameCard } from "../components/game/GameCard";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { Avatar } from "../components/common/Avatar";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { buildCalendar, downloadCalendar } from "../lib/calendar";
import { BACKEND_ENABLED } from "../lib/supabase";
import { toast } from "sonner";

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
  const recent = games.filter(isFinalOutcome).reverse().slice(0, 3);
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
        {/* The whole season in one file — the thing that actually gets this
            schedule onto a player's phone. */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            data-testid="team-add-schedule"
            disabled={games.length === 0}
            onClick={() => downloadCalendar(
              buildCalendar(state, games, { name: `${team.name} — ${league?.season || "Schedule"}`, origin: window.location.origin }),
              `${team.name}-${league?.season || "schedule"}`
            )}
            className="h-11"
          >
            <CalendarPlus data-icon="inline-start" weight="bold" /> Add Season to Calendar
          </Button>
          {/* A subscription stays current on its own, but it needs the hosted
              feed to exist — in mock mode there is no URL to subscribe to, so
              offering one would hand out a link that cannot work. */}
          {BACKEND_ENABLED && (
            <Button
              variant="ghost"
              data-testid="team-subscribe-schedule"
              onClick={() => subscribeLink(team.id)}
              className="h-11 text-muted-foreground hover:text-primary"
            >
              <LinkSimple data-icon="inline-start" weight="bold" /> Copy Subscribe Link
            </Button>
          )}
        </div>
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

      <FranchiseHistory state={state} team={team} />
    </div>
  );
}

// A subscribed calendar re-fetches this URL on its own, so a reschedule reaches
// every subscriber without them doing anything. webcal:// makes most desktop
// and mobile clients open their calendar app directly instead of downloading.
async function subscribeLink(team_id) {
  const url = `${window.location.origin.replace(/^https?:/, "webcal:")}/api/calendar?team=${team_id}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Subscribe link copied", {
      description: "Add it in your calendar app under \u201cSubscribe to calendar\u201d. It updates itself when the schedule changes.",
    });
  } catch {
    toast.error("Could not copy the link");
  }
}

// Every season this brand has been enrolled in, newest first. The identity is
// the franchise; each `teams` row is one enrollment of it, so this is where a
// team's saved history actually becomes reachable.
const FranchiseHistory = ({ state, team }) => {
  const enrollments = identityEnrollments(state, team.identity_id);
  const career = identityCareerRecord(state, team.identity_id);
  // A single enrollment is just the current season restated — no history yet.
  if (enrollments.length < 2) return null;

  return (
    <section data-testid="team-franchise-history">
      <SectionHeading
        title="Franchise History"
        subtitle={`${career.seasons} seasons · ${career.wins}-${career.losses}${career.ties ? `-${career.ties}` : ""} all time`}
      />
      <div className="cvf-standings-register bg-card border border-border overflow-hidden rounded-xl">
        {enrollments.map(({ team: enrollment, league, record }) => {
          const isCurrent = enrollment.id === team.id;
          return (
            <Link
              key={enrollment.id}
              to={`/team/${enrollment.id}`}
              data-testid={`franchise-season-${enrollment.id}`}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 items-center border-b border-border last:border-0 transition-colors hover:bg-white/5 active:bg-white/10 ${isCurrent ? "bg-[var(--leader-bg)]" : ""}`}
            >
              <span className="min-w-0">
                <span className="block text-sm text-foreground truncate">{league?.season || "Unknown season"}</span>
                <span className="block text-micro uppercase tracking-widest text-muted-foreground truncate">
                  {league?.name || "—"}{league?.kind === "tournament" ? " · Tournament" : ""}
                </span>
              </span>
              <span className="font-mono-score tabular-nums text-sm text-foreground whitespace-nowrap">
                {record.wins}-{record.losses}{record.ties ? `-${record.ties}` : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

const Stat = ({ label, value, accent }) => (
  <Card density="compact" className="bg-surface/60 text-center">
    <CardContent className="p-[var(--card-spacing)]">
      <p className={`font-mono-score text-xl font-bold ${accent ? "text-teal" : "text-foreground"}`}>{value}</p>
      <p className="text-micro uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
    </CardContent>
  </Card>
);
