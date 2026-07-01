import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, UsersThree, PersonSimpleRun, CalendarCheck, Fire } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { SectionHeading } from "../components/common/Section";
import { GameCard } from "../components/game/GameCard";
import { SportBadge } from "../components/common/Badges";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS, sportName } from "../lib/statsConfig";

// Sandia ridge backgrounds (brand pass) — self-contained dark dusk scenes,
// used at full opacity. Replaces the stadium/stock photos.
import heroBg from "../assets/backgrounds/sandia-wide-hero-bg.svg";
import teamInterestBg from "../assets/backgrounds/sandia-team-interest-cta-bg.svg";
import freeAgentBg from "../assets/backgrounds/sandia-free-agent-cta-bg.svg";

export default function Home() {
  const { state } = useApp();
  const [sport, setSport] = useState("all");
  const [leagueId, setLeagueId] = useState("all");

  const leagues = useMemo(
    () => (sport === "all" ? state.leagues : state.leagues.filter((l) => l.sport === sport)),
    [state.leagues, sport]
  );

  const filtered = useMemo(() => {
    return state.games.filter(
      (g) => (sport === "all" || g.sport === sport) && (leagueId === "all" || g.leagueId === leagueId)
    );
  }, [state.games, sport, leagueId]);

  const upcoming = filtered
    .filter((g) => g.status === "upcoming")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const recent = filtered
    .filter((g) => g.status === "completed")
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  return (
    <div className="space-y-10 animate-fade-up">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-border">
        <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-sunken via-transparent to-transparent" />
        <div className="relative px-6 py-12 md:px-12 md:py-20 max-w-2xl">
          <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/30 text-primary text-xs font-semibold uppercase tracking-widest">
            {state.settings.currentSeason} · Albuquerque, NM
          </span>
          <h1 className="mt-4 font-display font-bold uppercase tracking-tight text-foreground text-display-xl sm:text-5xl lg:text-6xl">
            Adult Rec Leagues.<br />
            <span className="text-primary">Player First.</span> Always Free.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-md">
            Albuquerque's home for adult kickball &amp; flag football. Track your stats, build your
            squad, and own your athlete profile — across every sport you play.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/register-team"
              data-testid="hero-register-team"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl hover:bg-teal-deep transition-colors"
            >
              Submit Team Interest <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              to="/free-agent-signup"
              data-testid="hero-free-agent"
              className="inline-flex items-center gap-2 border border-white/15 text-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl hover:border-primary transition-colors"
            >
              Join Free Agent Pool
            </Link>
          </div>
        </div>
      </section>

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
          <Select value={leagueId} onValueChange={setLeagueId}>
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

      {/* SEASON INFO */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: CalendarCheck, label: "Season", value: state.settings.currentSeason },
          { icon: UsersThree, label: "Teams", value: state.teams.length },
          { icon: PersonSimpleRun, label: "Players", value: state.profiles.length },
          { icon: Fire, label: "Games", value: state.games.length },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <s.icon size={20} weight="duotone" className="text-primary mb-2" />
            <p className="font-display font-bold text-2xl text-foreground leading-none">{s.value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
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
            <p className="text-sm text-muted-foreground">No upcoming games for this filter.</p>
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
            <p className="text-sm text-muted-foreground">No final scores yet. Results land here after the first games wrap.</p>
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
