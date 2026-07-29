import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarX, Clock, MapPin, Trophy } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { getTeam, isFinalOutcome, isForfeitOutcome } from "../lib/selectors";
import { formatGameDate, formatGameTime, venueLabel, byStartAscending, byStartDescending, gameDateKey, LEAGUE_TIME_ZONE } from "../lib/gameTime";
import { isNightGame } from "../components/direction/SunMoonMark";
import { sportName } from "../lib/statsConfig";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { GameCard } from "../components/game/GameCard";
import { SportBadge } from "../components/common/Badges";
import { Button } from "../components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS } from "../lib/statsConfig";
import { usePersistedPreference } from "../hooks/usePersistedPreference";
import { StructuralCorner, StructuralIdentityBadge } from "../components/direction/StructuralIdentity";
import { SunMoonMark } from "../components/direction/SunMoonMark";

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
      <SunMoonMark game={game} />
      {/* Label and sport badge cluster left so the mark owns the corner. */}
      <div className="flex items-center gap-2 mb-3">
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

  // --- C2 arrival states (decision 5): the hero carries the league's
  // temporal state instead of a permanent welcome mat. Game day is decided on
  // the LEAGUE's calendar date, never the viewer's timezone.
  const now = new Date();
  const todayKey = gameDateKey({ starts_at: now.toISOString() });
  const todaysGames = state.games
    .filter((g) => g.status !== "canceled" && g.status !== "postponed" && gameDateKey(g) === todayKey)
    .sort(byStartAscending);
  const gameDay = todaysGames.length > 0;
  const firstKick = todaysGames.find((g) => g.status === "upcoming") || todaysGames[0];
  const nextGame = gameDay
    ? null
    : state.games.filter((g) => g.status === "upcoming" && new Date(g.starts_at) > now).sort(byStartAscending)[0] || null;

  // Recent registrations feed: prospective team names only — no captain
  // contact details ever reach a public surface.
  const newTeams = (state.registrations || [])
    .filter((item) => item.status !== "archived")
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 3);

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
            {gameDay ? (
              <div data-testid="home-hero-gameday" className="cvf-settle">
                <p className="text-label uppercase tracking-widest text-primary">
                  Game day · {formatGameDate(firstKick)}
                </p>
                <h1 className="font-display text-display-xl uppercase text-foreground mt-1">
                  {isNightGame(firstKick) ? "Games Tonight" : "Games Today"}
                </h1>
                <p className="font-mono-score tabular-nums font-bold leading-none text-foreground text-[3rem] md:text-[4.5rem] mt-2">
                  {formatGameTime(firstKick)}
                </p>
                <p className="text-label uppercase tracking-widest text-muted-foreground mt-2">
                  First kick · {venueLabel(state, firstKick)}
                </p>
              </div>
            ) : nextGame ? (
              <div data-testid="home-hero-next">
                <p className="text-label uppercase tracking-widest text-primary">
                  {formatGameDate(nextGame)} · Albuquerque
                </p>
                <h1 className="font-display text-display-xl uppercase text-foreground mt-1">
                  Next: {gameWeekday(nextGame)}
                </h1>
                <p className="text-label uppercase tracking-widest text-muted-foreground mt-2">
                  First kick {formatGameTime(nextGame)} · {venueLabel(state, nextGame)}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="font-display text-display-xl uppercase text-foreground">
                  Current Leagues
                </h1>
                <p className="text-label uppercase tracking-widest text-primary mt-1.5">
                  Albuquerque, NM
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TODAY'S GAMES STRIP — game day only, finger-driven scroll-snap, no
          idle motion (decision 5). */}
      {gameDay && (
        <section aria-label="Today's games" data-testid="home-today-strip" className="cvf-today-strip cvf-settle-group">
          {todaysGames.map((g) => <TodayCard key={g.id} game={g} state={state} />)}
        </section>
      )}

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
            <EmptyState icon={CalendarX} title="Nothing on the calendar here" message="Try another sport or league." density="compact" className="sm:col-span-2 lg:col-span-3" />
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
            <EmptyState icon={Trophy} title="No finals yet" message="First results land here after opening night." density="compact" className="sm:col-span-2 lg:col-span-3" />
          )}
        </FilterResultRegion>
      </section>

      {/* NEW TEAMS — the community feed half of decision 5's body. Team names
          only; captain contact details never reach a public surface. */}
      {newTeams.length > 0 && (
        <section data-testid="home-new-teams">
          <SectionHeading title="New Teams" subtitle="Who's joining the league" />
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {newTeams.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <StructuralIdentityBadge className="cvf-identity-badge--sm" name={item.team_name} color="var(--cvf-teal)" />
                <span className="min-w-0 flex-1 text-sm text-foreground">
                  <span className="font-semibold">{item.team_name}</span>{" "}
                  <span className="text-muted-foreground">
                    {item.status === "approved" ? "just joined" : "wants in"} · {sportName(item.sport)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* NEWCOMER CTA — below the fold per decision 5; recruitment stops being
          every session's first pixel. */}
      <section data-testid="home-join-below-fold" className="bg-card border border-border rounded-2xl p-5 md:p-6">
        <h2 className="font-display uppercase text-display-lg text-foreground">New to CVF?</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Adult kickball and flag football in Albuquerque. Bring a team or come solo — we'll find you one.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button asChild className="h-11 w-full sm:w-auto">
            <Link to="/register-team" data-testid="hero-register-team">
              Submit Team Interest <ArrowRight size={14} weight="bold" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
            <Link to="/free-agent-signup" data-testid="hero-free-agent">
              Join Free Agent Pool
            </Link>
          </Button>
        </div>
      </section>

    </div>
  );
}

const gameWeekday = (game) =>
  new Intl.DateTimeFormat("en-US", { timeZone: LEAGUE_TIME_ZONE, weekday: "long" }).format(new Date(game.starts_at));

// One card of the game-day strip: both identities, the score or kickoff time,
// and the field — sized so the next card peeks in at 375px, inviting the swipe.
const TodayCard = ({ game, state }) => {
  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = isFinalOutcome(game);
  const forfeit = isForfeitOutcome(game);
  const homeWin = completed && (forfeit ? game.winner_team_id === game.home_team_id : game.home_score > game.away_score);
  const awayWin = completed && (forfeit ? game.winner_team_id === game.away_team_id : game.away_score > game.home_score);
  return (
    <Link to={`/game/${game.id}`} data-testid={`today-card-${game.id}`} className="cvf-today-card bg-card border border-border hover:border-primary/50">
      <TodayLine team={away} value={completed ? (forfeit ? (awayWin ? "W" : "L") : game.away_score) : formatGameTime(game)} isWinner={awayWin} isLoser={homeWin} isTime={!completed} />
      <TodayLine team={home} value={completed ? (forfeit ? (homeWin ? "W" : "L") : game.home_score) : null} isWinner={homeWin} isLoser={awayWin} />
      <span className="cvf-today-card__meta">{completed ? (forfeit ? "Forfeit" : "Final") : venueLabel(state, game)}</span>
    </Link>
  );
};

const TodayLine = ({ team, value, isWinner, isLoser, isTime }) => (
  <span className="cvf-today-card__line">
    <StructuralIdentityBadge className="cvf-identity-badge--sm" team={team} />
    <span className={`cvf-today-card__name ${isWinner ? "text-[var(--win)] font-semibold" : isLoser ? "text-[var(--loss-text)]" : "text-foreground"}`}>
      {team?.name || "TBD"}
    </span>
    {value != null && (
      <span className={`cvf-today-card__value ${isTime ? "text-teal text-xl" : isWinner ? "text-[var(--win)]" : isLoser ? "text-[var(--loss-text)]" : ""}`}>
        {value}
      </span>
    )}
  </span>
);
