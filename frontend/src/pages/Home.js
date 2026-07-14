import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarX, Clock, MapPin, Trophy } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { getTeam } from "../lib/selectors";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { GameCard } from "../components/game/GameCard";
import { SportBadge } from "../components/common/Badges";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS } from "../lib/statsConfig";
import logoSrc from "../assets/cvf-logo-transparent.png";

// Sandia ridge backgrounds (brand pass) — self-contained dark dusk scenes,
// used at full opacity. Replaces the stadium/stock photos.
import heroBg from "../assets/backgrounds/sandia-wide-hero-bg.svg";
import teamInterestBg from "../assets/backgrounds/sandia-team-interest-cta-bg.svg";
import freeAgentBg from "../assets/backgrounds/sandia-free-agent-cta-bg.svg";

const formatGameDate = (game) =>
  new Date(game.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: team?.logo_color || "var(--border-strong)" }}
        />
        <span className={`font-display uppercase tracking-tight text-heading md:text-display-lg truncate ${nameEmphasis}`}>
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
  const completed = game.status === "completed";
  const homeWin = completed && game.home_score > game.away_score;
  const awayWin = completed && game.away_score > game.home_score;
  return (
    <Link
      to={`/game/${game.id}`}
      data-testid={`home-scoreboard-${kind}`}
      className="block bg-card border border-border rounded-2xl p-4 md:p-5 shadow-card transition-all duration-200 hover:border-primary/50 hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-label uppercase text-muted-foreground">
          {kind === "latest" ? "Latest Final" : "Up Next"}
        </span>
        <SportBadge sport={game.sport} />
      </div>
      <div className="space-y-2">
        <ScoreboardLine team={away} score={game.away_score} isWinner={awayWin} isLoser={homeWin} completed={completed} />
        <ScoreboardLine team={home} score={game.home_score} isWinner={homeWin} isLoser={awayWin} completed={completed} />
      </div>
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{formatGameDate(game)}</span>
        <span className="flex items-center gap-1">
          <Clock size={13} weight="bold" /> {game.time}
        </span>
        <span className="flex items-center gap-1 truncate">
          <MapPin size={13} weight="bold" /> {game.location}
        </span>
      </div>
    </Link>
  );
};

export default function Home() {
  const { state } = useApp();
  const [sport, setSport] = useState("all");
  const [league_id, setLeagueId] = useState("all");

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
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const recent = filtered
    .filter((g) => g.status === "completed")
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  // Featured scoreboard (unfiltered — it sits above the sport/league selectors):
  // single most recent final + single next scheduled game, league-wide.
  const latestFinal = useMemo(
    () =>
      state.games
        .filter((g) => g.status === "completed")
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null,
    [state.games]
  );
  const nextUp = useMemo(
    () =>
      state.games
        .filter((g) => g.status === "upcoming")
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null,
    [state.games]
  );

  return (
    <div className="space-y-10 animate-fade-up">
      {/* IDENTITY BAND — compact lockup, not a marketing hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border">
        <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-sunken via-transparent to-transparent" />
        <div className="relative px-5 py-6 md:px-8 md:py-7">
          <div className="flex items-center gap-3.5">
            <img src={logoSrc} alt="" className="w-14 h-14 md:w-16 md:h-16 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display font-bold uppercase tracking-tight text-display-lg md:text-display-xl text-foreground leading-none">
                CVF Sports
              </h1>
              <p className="text-label uppercase tracking-widest text-primary mt-1.5">
                Current leagues · Albuquerque, NM
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              to="/register-team"
              data-testid="hero-register-team"
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-xs px-4 py-2.5 rounded-xl hover:bg-teal-deep transition-colors"
            >
              Submit Team Interest <ArrowRight size={14} weight="bold" />
            </Link>
            <Link
              to="/free-agent-signup"
              data-testid="hero-free-agent"
              className="inline-flex items-center gap-1.5 border border-white/15 text-foreground font-bold uppercase tracking-wide text-xs px-4 py-2.5 rounded-xl hover:border-primary transition-colors"
            >
              Join Free Agent Pool
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED SCOREBOARD — latest final + next game, league-wide */}
      {(latestFinal || nextUp) && (
        <section className="grid md:grid-cols-2 gap-3" data-testid="home-scoreboard">
          {latestFinal && <ScoreboardFeature game={latestFinal} kind="latest" state={state} />}
          {nextUp && <ScoreboardFeature game={nextUp} kind="up-next" state={state} />}
        </section>
      )}

      {/* SELECTORS */}
      <section className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-label uppercase text-muted-foreground mb-1.5 block">
            Sport
          </label>
          <Select
            value={sport}
            onValueChange={(v) => {
              setSport(v);
              setLeagueId("all");
            }}
          >
            <SelectTrigger data-testid="home-sport-select" className="bg-card border-border h-11">
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
          <label className="text-label uppercase text-muted-foreground mb-1.5 block">
            League
          </label>
          <Select value={league_id} onValueChange={setLeagueId}>
            <SelectTrigger data-testid="home-league-select" className="bg-card border-border h-11">
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
            <Link to="/schedule" className="text-primary text-sm font-semibold inline-flex items-center gap-1 min-h-[44px] -my-1 hover:gap-2 transition-all">
              All <ArrowRight size={14} weight="bold" />
            </Link>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcoming.length ? (
            upcoming.map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <EmptyState icon={CalendarX} title="No upcoming games" message="Try another sport or league filter." density="compact" className="sm:col-span-2 lg:col-span-3" />
          )}
        </div>
      </section>

      {/* RECENT SCORES */}
      <section>
        <SectionHeading
          title="Recent Scores"
          subtitle="Latest final results"
          action={
            <Link to="/standings" className="text-primary text-sm font-semibold inline-flex items-center gap-1 min-h-[44px] -my-1 hover:gap-2 transition-all">
              Standings <ArrowRight size={14} weight="bold" />
            </Link>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recent.length ? (
            recent.map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <EmptyState icon={Trophy} title="No final scores yet" message="Results appear after the first games wrap." density="compact" className="sm:col-span-2 lg:col-span-3" />
          )}
        </div>
      </section>

      {/* CTA CARDS */}
      <section className="grid md:grid-cols-2 gap-4">
        {[
          { to: "/register-team", img: teamInterestBg, title: "Team Interest", desc: "Tell us about your team — an admin will reach out to get you set up.", cta: "Submit Team Interest", testid: "cta-register-team" },
          { to: "/free-agent-signup", img: freeAgentBg, title: "Join the Free Agent Pool", desc: "No team? No problem. Get in the pool and let captains find you.", cta: "Join Free Agent Pool", testid: "cta-free-agent" },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            data-testid={c.testid}
            className="group relative overflow-hidden rounded-2xl border border-border min-h-[180px] flex items-end"
          >
            <img src={c.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-sunken via-transparent to-transparent" />
            <div className="relative p-5">
              <h3 className="font-display uppercase tracking-tight text-xl text-foreground">{c.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">{c.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm mt-3 group-hover:gap-2.5 transition-all">
                {c.cta} <ArrowRight size={15} weight="bold" />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
