import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarX, Clock, MapPin, Trophy } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { getTeam, isFinalOutcome, isForfeitOutcome } from "../lib/selectors";
import { formatGameDate, formatGameTime, venueLabel, byStartAscending, byStartDescending } from "../lib/gameTime";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { GameCard } from "../components/game/GameCard";
import { SportBadge } from "../components/common/Badges";
import { Button } from "../components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS } from "../lib/statsConfig";
import { usePersistedPreference } from "../hooks/usePersistedPreference";
import { StructuralCorner, StructuralIdentityBadge } from "../components/direction/StructuralIdentity";

// Sandia ridge backgrounds (brand pass) — self-contained dark dusk scenes,
// used at full opacity. Replaces the stadium/stock photos.
import heroBg from "../assets/backgrounds/sandia-wide-hero-bg.svg";



const gameGridClass = (count) => {
  if (count === 1) return "grid grid-cols-1 gap-3 max-w-2xl w-full";
  if (count === 2) return "grid sm:grid-cols-2 gap-3";
  return "grid sm:grid-cols-2 lg:grid-cols-3 gap-3";
};

const FilterResultRegion = ({ animate, className, testId, children }) => {
  const [entered, setEntered] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setEntered(true);
      return undefined;
    }

    setEntered(false);
    const frame = window.requestAnimationFrame(() => setEntered(true));

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [animate]);

  return (
    <div
      className={`${className} transition-opacity duration-cvf-fast ease-cvf-out ${
        entered ? "opacity-100" : "opacity-75"
      } motion-reduce:opacity-100 motion-reduce:transition-none`}
      data-testid={testId}
    >
      {children}
    </div>
  );
};

// One row of the featured scoreboard. Winner weighting mirrors GameCard's
// TeamLine semantics (--win / --loss-text, 3px teal leading bar) at the
// featured scale: names in display type, figures in --score-figure-lg /
// --text-display-2xl Oswald tabular numerals.
const ScoreboardLine = ({ team, score, isWinner, isLoser, completed }) => {
  const nameEmphasis = isWinner
    ? "text-[var(--win)] font-semibold"
    : isLoser
    ? "text-[var(--loss-text)] font-normal"
    : "text-foreground font-normal";
  const scoreEmphasis = isWinner
    ? "text-[var(--win)]"
    : isLoser
    ? "text-[var(--loss-text)]"
    : "text-foreground";
  return (
    <div
      className={`flex items-center justify-between gap-3 border-l-[3px] pl-3 ${
        isWinner ? "border-teal" : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <StructuralIdentityBadge team={team} className="shrink-0" />
        <span className={`font-sans normal-case tracking-normal text-xl md:text-2xl leading-snug whitespace-normal break-words ${nameEmphasis}`}>
          {team?.name || "TBD"}
        </span>
      </div>
      {completed ? (
        <span className={`font-mono-score tabular-nums text-score-lg md:text-display-2xl shrink-0 ${scoreEmphasis}`}>
          {score}
        </span>
      ) : null}
    </div>
  );
};

// Featured scoreboard card: the most recent final (kind="latest") or the next
// scheduled game (kind="up-next"), rendered big. Pure read of existing game
// shape — same fields GameCard consumes.
const ScoreboardFeature = ({ game, kind, state }) => {
  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = isFinalOutcome(game);
  const forfeit = isForfeitOutcome(game);
  const homeWin = completed && (forfeit ? game.winner_team_id === game.home_team_id : game.home_score > game.away_score);
  const awayWin = completed && (forfeit ? game.winner_team_id === game.away_team_id : game.away_score > game.home_score);
  return (
    <Link
      to={`/game/${game.id}`}
      data-testid={`home-scoreboard-${kind}`}
      className="relative overflow-hidden block bg-card border border-border rounded-2xl p-4 md:p-5 shadow-card hover:border-primary/50 hover:shadow-card-hover"
    >
      <StructuralCorner tone={completed ? "neutral" : "teal"} size="feature" />
      <div className="flex items-center justify-between mb-3">
        <span className="text-label uppercase text-muted-foreground">
          {kind === "latest" ? "Latest Final" : "Up Next"}
        </span>
        <SportBadge sport={game.sport} />
      </div>
      <div className="space-y-2">
        <ScoreboardLine team={away} score={forfeit ? (awayWin ? "W" : "L") : game.away_score} isWinner={awayWin} isLoser={homeWin} completed={completed} />
        <ScoreboardLine team={home} score={forfeit ? (homeWin ? "W" : "L") : game.home_score} isWinner={homeWin} isLoser={awayWin} completed={completed} />
      </div>
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{formatGameDate(game)}</span>
        <span className="flex items-center gap-1">
          <Clock size={13} weight="bold" /> {formatGameTime(game)}
        </span>
        <span className="flex items-center gap-1 truncate">
          <MapPin size={13} weight="bold" /> {venueLabel(state, game)}
        </span>
      </div>
    </Link>
  );
};

export default function Home() {
  const { state } = useApp();
  // Remembered across visits: someone who follows one sport should not
  // re-pick it every time they open the app.
  const [sport, setSport] = usePersistedPreference(
    "sport",
    "all",
    (value) => value === "all" || SPORTS.some((item) => item.id === value)
  );
  const [league_id, setLeagueId] = useState("all");
  const [filterRevision, setFilterRevision] = useState(0);

  const leagues = useMemo(
    () => (sport === "all" ? state.leagues : state.leagues.filter((l) => l.sport === sport)),
    [state.leagues, sport]
  );

  const filtered = useMemo(() => {
    return state.games.filter(
      (g) => (sport === "all" || g.sport === sport) && (league_id === "all" || g.league_id === league_id)
    );
  }, [state.games, sport, league_id]);

  const upcoming = filtered
    .filter((g) => g.status === "upcoming")
    .sort(byStartAscending)
    .slice(0, 4);
  const recent = filtered
    .filter(isFinalOutcome)
    .sort(byStartDescending)
    .slice(0, 4);

  // Featured scoreboard (unfiltered — it sits above the sport/league selectors):
  // single most recent final + single next scheduled game, league-wide.
  const latestFinal = useMemo(
    () =>
      state.games
        .filter(isFinalOutcome)
        .sort(byStartDescending)[0] || null,
    [state.games]
  );
  const nextUp = useMemo(
    () =>
      state.games
        .filter((g) => g.status === "upcoming")
        .sort(byStartAscending)[0] || null,
    [state.games]
  );
  const featuredCount = Number(Boolean(latestFinal)) + Number(Boolean(nextUp));

  return (
    <div className="space-y-10">
      {/* LEAGUE BAND — the global shell owns the CVF identity lockup. */}
      <section className="cvf-home-hero relative overflow-hidden rounded-2xl border border-border" data-testid="home-hero">
        <img src={heroBg} alt="" className="cvf-home-hero__backdrop absolute inset-0 w-full h-full object-cover" />
        <div className="cvf-home-hero__scrim absolute inset-0" aria-hidden="true" />
        <div className="cvf-home-hero__focal" aria-hidden="true" data-testid="home-hero-focal">
          <img src={heroBg} alt="" />
          <span className="cvf-home-hero__ridge" />
          <StructuralCorner tone="gold" size="hero" />
        </div>
        <StructuralCorner className="cvf-home-hero__mobile-mark" size="compact" />
        <div className="relative z-10 px-5 py-6 md:px-8 md:py-8 md:max-w-[62%]">
          <div className="min-w-0">
            <h1 className="font-display text-display-xl uppercase text-foreground">
              Current Leagues
            </h1>
            <p className="text-label uppercase tracking-widest text-primary mt-1.5">
              Albuquerque, NM
            </p>
          </div>
          <div className="mt-5 hidden md:flex flex-wrap gap-2.5" data-testid="home-desktop-join-actions">
            <Button asChild className="h-11">
              <Link to="/register-team" data-testid="hero-register-team">
                Submit Team Interest <ArrowRight size={14} weight="bold" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link to="/free-agent-signup" data-testid="hero-free-agent">
                Join Free Agent Pool
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURED SCOREBOARD — latest final + next game, league-wide */}
      {(latestFinal || nextUp) && (
        <section
          className={featuredCount === 2 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}
          data-testid="home-scoreboard"
        >
          {latestFinal && <ScoreboardFeature game={latestFinal} kind="latest" state={state} />}
          {nextUp && <ScoreboardFeature game={nextUp} kind="up-next" state={state} />}
        </section>
      )}

      {/* SELECTORS */}
      <section className="grid grid-cols-2 gap-3">
        <div>
          <label id="home-sport-label" htmlFor="home-sport-select" className="text-label uppercase text-muted-foreground mb-1.5 block">
            Sport
          </label>
          <Select
            value={sport}
            onValueChange={(v) => {
              setSport(v);
              setLeagueId("all");
              setFilterRevision((revision) => revision + 1);
            }}
          >
            <SelectTrigger id="home-sport-select" aria-labelledby="home-sport-label" data-testid="home-sport-select" className="bg-card border-border h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {SPORTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label id="home-league-label" htmlFor="home-league-select" className="text-label uppercase text-muted-foreground mb-1.5 block">
            League
          </label>
          <Select
            value={league_id}
            onValueChange={(value) => {
              setLeagueId(value);
              setFilterRevision((revision) => revision + 1);
            }}
          >
            <SelectTrigger id="home-league-select" aria-labelledby="home-league-label" data-testid="home-league-select" className="bg-card border-border h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              {leagues.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* UPCOMING */}
      <section>
        <SectionHeading
          title="Upcoming Games"
          subtitle="Next matchups on the schedule"
          action={
            <Link to="/schedule" className="group text-primary text-sm font-semibold inline-flex items-center gap-1 min-h-[44px] -my-1">
              All
              <ArrowRight className="cvf-directional-link-icon transition-transform duration-cvf-fast ease-cvf-out motion-reduce:!transform-none motion-reduce:transition-none" size={14} weight="bold" />
            </Link>
          }
        />
        <FilterResultRegion
          key={`${sport}:${league_id}:upcoming:${filterRevision}`}
          animate={filterRevision > 0}
          className={gameGridClass(upcoming.length)}
          testId="home-upcoming-grid"
        >
          {upcoming.length ? (
            upcoming.map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <EmptyState icon={CalendarX} title="No upcoming games" message="Try another sport or league filter." density="compact" className="sm:col-span-2 lg:col-span-3" />
          )}
        </FilterResultRegion>
      </section>

      {/* RECENT SCORES */}
      <section>
        <SectionHeading
          title="Recent Scores"
          subtitle="Latest final results"
          action={
            <Link to="/standings" className="group text-primary text-sm font-semibold inline-flex items-center gap-1 min-h-[44px] -my-1">
              Standings
              <ArrowRight className="cvf-directional-link-icon transition-transform duration-cvf-fast ease-cvf-out motion-reduce:!transform-none motion-reduce:transition-none" size={14} weight="bold" />
            </Link>
          }
        />
        <FilterResultRegion
          key={`${sport}:${league_id}:recent:${filterRevision}`}
          animate={filterRevision > 0}
          className={gameGridClass(recent.length)}
          testId="home-recent-grid"
        >
          {recent.length ? (
            recent.map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <EmptyState icon={Trophy} title="No final scores yet" message="Results appear after the first games wrap." density="compact" className="sm:col-span-2 lg:col-span-3" />
          )}
        </FilterResultRegion>
      </section>

    </div>
  );
}
