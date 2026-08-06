import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, CalendarBlank, CalendarX, CalendarPlus, PencilSimpleLine } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { getTeam, getProfile, isFinalOutcome, isForfeitOutcome } from "../lib/selectors";
import { formatGameLongDate, formatGameShortDate, formatGameTime, venueLabel, getVenue, gameDateKey } from "../lib/gameTime";
import { buildCalendar, downloadCalendar } from "../lib/calendar";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { StageBanner, isSpecialStage } from "../components/game/StageBanner";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/common/Section";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { AthleteHoverCard } from "../components/player/AthleteHoverCard";
import { StructuralIdentityBadge } from "../components/direction/StructuralIdentity";
import { SunMoonMark } from "../components/direction/SunMoonMark";

const PERIOD_LABEL = (sport, i) => (sport === "kickball" ? `${i + 1}` : `Q${i + 1}`);
const PERIOD_HEAD = (sport) => (sport === "kickball" ? "Inning" : "Quarter");

// Key stat columns shown in the box score per sport.
const BOX = {
  kickball: [
    { key: "kicks", label: "K" },
    { key: "rbis", label: "RBI" },
    { key: "runs", label: "R" },
    { key: "homeRuns", label: "HR" },
  ],
  flag_football: [
    { key: "passYards", label: "PYD" },
    { key: "recYards", label: "RYD" },
    { key: "tds", label: "TD" },
    { key: "flagPulls", label: "FP" },
  ],
};

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useApp();
  const { role } = useRole();
  const game = state.games.find((g) => g.id === id);

  if (!game) return <EmptyState icon={CalendarX} title="Game not found" message="This game may have been removed or the link is invalid." />;

  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = isFinalOutcome(game);
  const forfeit = isForfeitOutcome(game);
  const gameStats = state.playerStats.filter((s) => s.game_id === game.id);
  const dateStr = formatGameLongDate(game);
  const shortDate = formatGameShortDate(game);

  const canScore = role === "admin";
  const periods = game.periods?.home || [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} data-testid="game-back" className="h-auto min-h-[44px] -my-1 p-0 pr-2 gap-1.5 normal-case tracking-normal text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent">
        <ArrowLeft size={16} weight="bold" /> Back
      </Button>

      {/* B2 (Addendum 8): the scoreboard IS the page title. The matchup h1
          stays for accessibility and document structure but no longer spends
          three viewport lines repeating what the scoreboard states. */}
      <div data-testid="game-detail-heading" className="sr-only">
        <h1>
          {away?.name || "TBD"} vs {home?.name || "TBD"}
        </h1>
      </div>

      <Card
        density="spacious"
        className="cvf-event-frame relative overflow-hidden rounded-2xl"
        data-game-state={game.status}
        data-game-stage={game.stage}
        data-testid="game-event-frame"
      >
        <SunMoonMark game={game} className={isSpecialStage(game) ? "cvf-sunmoon--below-banner" : ""} />
        <CardContent className="relative z-10 p-5 md:p-7">
        {isSpecialStage(game) && (
          <StageBanner stage={game.stage} className="-mx-5 -mt-5 md:-mx-7 md:-mt-7 mb-5 px-5 md:px-7 py-2 rounded-t-2xl" />
        )}
        {/* Sport clusters left so the sun/moon mark owns the corner (Addendum
            6). For a decided game the centered FINAL/FORFEIT chip is the one
            state statement, so the StatusBadge renders only while the game is
            still live in the schedule — state, date, and time each speak once
            (Addendum 8). */}
        <div className="flex items-center gap-2 mb-5">
          <SportBadge sport={game.sport} />
          {!completed && <StatusBadge status={game.status} />}
        </div>

        {/* B2 team-color environment: each side is a field of that team's own
            color at ~38% mix, meeting at the score. */}
        <div className="cvf-gd-scoreboard relative -mx-5 md:-mx-7">
          <div className={`grid items-stretch ${completed ? "grid-cols-2 cvf-settle-fade" : "grid-cols-2 md:grid-cols-3"}`}>
            <TeamHead team={away} score={forfeit ? (game.winner_team_id === away?.id ? "W" : "L") : game.away_score} completed={completed} win={completed && (forfeit ? game.winner_team_id === away?.id : game.away_score > game.home_score)} />
            {!completed && (
              <time className="cvf-upcoming-focal order-3 col-span-2 mt-3 pb-2 text-center md:order-none md:col-span-1 md:mt-0 md:self-center" dateTime={gameDateKey(game)}>
                <span className="cvf-upcoming-focal__date">{shortDate}</span>
                <span className="cvf-upcoming-focal__time">{formatGameTime(game)}</span>
              </time>
            )}
            <TeamHead team={home} score={forfeit ? (game.winner_team_id === home?.id ? "W" : "L") : game.home_score} completed={completed} win={completed && (forfeit ? game.winner_team_id === home?.id : game.home_score > game.away_score)} home />
          </div>
          {completed && (
            <span className="cvf-gd-state-chip cvf-settle-chip">{forfeit ? "Forfeit" : "Final"}</span>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-border flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {completed && (
            <>
              <span className="flex items-center gap-1.5"><CalendarBlank size={15} weight="bold" /> {dateStr}</span>
              <span className="flex items-center gap-1.5"><Clock size={15} weight="bold" /> {formatGameTime(game)}</span>
            </>
          )}
          <span className="flex items-center gap-1.5"><MapPin size={15} weight="bold" /> {venueLabel(state, game)}</span>
          {/* Migration 29 gave venues real coordinates; this is the first UI
              that spends them. The universal Google Maps URL resolves to the
              native maps app on both platforms; the address is the fallback
              when a venue predates coordinate entry. */}
          {(() => {
            const venue = getVenue(state, game.venue_id);
            if (!venue) return null;
            const query = venue.latitude != null && venue.longitude != null
              ? `${venue.latitude},${venue.longitude}`
              : venue.address;
            if (!query) return null;
            return (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="game-directions"
                className="flex items-center gap-1.5 text-primary hover:underline underline-offset-4 font-medium"
              >
                Directions
              </a>
            );
          })()}
        </div>

        {/* Field guidance — the address for anyone navigating by name, and the
            venue's own notes (parking, which entrance, field quirks) whenever
            the admin has written any. A venue without notes adds no row. */}
        {(() => {
          const venue = getVenue(state, game.venue_id);
          if (!venue?.address && !venue?.notes) return null;
          return (
            <div data-testid="game-venue-guidance" className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {venue.address ? <p>{venue.address}</p> : null}
              {venue.notes ? <p>{venue.notes}</p> : null}
            </div>
          );
        })()}

        {/* Add to calendar — available to everyone, and the reason migration 29
            made the start time a real timestamp. */}
        {!completed && (
          <Button
            variant="outline"
            data-testid="game-add-to-calendar"
            onClick={() => downloadCalendar(
              buildCalendar(state, [game], { name: `${away?.name || "TBD"} @ ${home?.name || "TBD"}`, origin: window.location.origin }),
              `${away?.name || "away"}-at-${home?.name || "home"}`
            )}
            className="mt-5 h-11 md:h-11"
          >
            <CalendarPlus data-icon="inline-start" weight="bold" /> Add to Calendar
          </Button>
        )}

        {canScore && !forfeit && (
          <Button asChild className="mt-5 h-11 md:h-11">
            <Link
              to="/score-entry"
              state={{ game_id: game.id }}
              data-testid="game-enter-score"
            >
              <PencilSimpleLine data-icon="inline-start" weight="bold" /> {game.locked ? "Correct Final Result" : completed ? "Edit Score" : "Enter Score"}
            </Link>
          </Button>
        )}
        </CardContent>
      </Card>

      {/* Period breakdown */}
      {completed && periods.length > 0 && (
        <Card density="compact" className="rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-border py-2.5">
          <p className="text-micro uppercase tracking-widest text-muted-foreground font-semibold">
            {PERIOD_HEAD(game.sport)} by {PERIOD_HEAD(game.sport).toLowerCase()}
          </p>
          </CardHeader>
          <CardContent className="p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium pb-2 pr-3"> </th>
                  {periods.map((_, i) => (
                    <th key={i} className="text-center tabular-nums px-2 pb-2">{PERIOD_LABEL(game.sport, i)}</th>
                  ))}
                  <th className="text-center tabular-nums px-2 pb-2 text-primary">T</th>
                </tr>
              </thead>
              <tbody>
                {[{ t: away, arr: game.periods.away, total: game.away_score }, { t: home, arr: game.periods.home, total: game.home_score }].map((row) => (
                  <tr key={row.t.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-display uppercase tracking-tight text-foreground whitespace-nowrap">{row.t.name}</td>
                    {row.arr.map((v, i) => (
                      <td key={i} className="text-center font-mono-score px-2 text-muted-foreground">{v}</td>
                    ))}
                    <td className="text-center font-mono-score px-2 text-primary font-bold">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Player box score */}
      {completed && gameStats.length > 0 && (
        <div className="space-y-4">
          {[away, home].map((t) => {
            const rows = gameStats.filter((s) => s.team_id === t.id);
            if (!rows.length) return null;
            const cols = BOX[game.sport];
            return (
              <Card key={t.id} density="compact" className="rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border py-2.5">
                <p className="font-display uppercase tracking-tight text-foreground flex items-center gap-2">
                  <StructuralIdentityBadge className="cvf-identity-badge--sm" team={t} /> {t.name}
                </p>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-micro uppercase tracking-wide">
                        <th className="text-left font-semibold px-4 py-2">Player</th>
                        {cols.map((c) => <th key={c.key} className="text-center font-semibold px-2 py-2">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const p = getProfile(state, s.profile_id);
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="px-4 py-2.5">
                              <AthleteHoverCard profile={p} team={t}>
                                <Link to={`/profile/${p.id}`} className="flex items-center gap-2 hover:text-primary active:opacity-80">
                                  <StructuralIdentityBadge className="cvf-identity-badge--sm" color={p.avatar_color} name={p.name} />
                                  <span className="font-medium text-foreground truncate">{p.name}</span>
                                </Link>
                              </AthleteHoverCard>
                            </td>
                            {cols.map((c) => (
                              <td key={c.key} className="text-center font-mono-score text-muted-foreground px-2">{s.stats[c.key] || 0}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {completed && gameStats.length === 0 && (
        <EmptyState title="No box score for this one" message="The final is official — individual stats never made it off the field." density="default" className="bg-card border border-border rounded-2xl" />
      )}
    </div>
  );
}

// One team half of the color environment: the field is that team's own
// logo_color mixed to ~38% against the card surface, angled toward the
// center so the two fields meet at the score.
const fieldBackground = (team, home) =>
  team?.logo_color
    ? { background: `linear-gradient(${home ? 200 : 160}deg, color-mix(in srgb, ${team.logo_color} 38%, hsl(var(--card))), hsl(var(--card)) 85%)` }
    : undefined;

const TeamHead = ({ team, score, completed, win, home }) => (
  <Link
    to={`/team/${team.id}`}
    className="cvf-gd-field flex min-w-0 flex-col items-center text-center group"
    style={fieldBackground(team, home)}
  >
    <StructuralIdentityBadge team={team} className="mb-2" />
    <span className="font-display uppercase tracking-tight text-foreground text-sm leading-tight group-hover:text-primary transition-colors">{team.name}</span>
    <span className="text-micro text-muted-foreground uppercase">{home ? "Home" : "Away"}</span>
    {completed && (
      <span className={`cvf-game-score mt-1 font-mono-score tabular-nums font-bold ${win ? "text-primary" : "text-muted-foreground"}`}>{score}</span>
    )}
  </Link>
);
