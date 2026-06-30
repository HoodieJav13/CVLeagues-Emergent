import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, UsersThree, PersonSimpleRun, CalendarCheck, Fire } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { SectionHeading } from "../components/common/Section";
import { GameCard } from "../components/game/GameCard";
import { SportBadge } from "../components/common/Badges";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS, sportName } from "../lib/statsConfig";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/25817560-5d06-4585-aa10-457413ce1b96/images/5975b05bd9b283882601199015cdf7faad4a29e64dcb2ad8f71963db8ff92f37.png";
const SPORT_IMG = {
  flag_football:
    "https://images.unsplash.com/photo-1489358921548-9b3f69a1eb4a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwxfHxmbGFnJTIwZm9vdGJhbGwlMjBhY3Rpb24lMjBnYW1lfGVufDB8fHx8MTc4MDA5NDU0MHww&ixlib=rb-4.1.0&q=85",
  kickball:
    "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxraWNrYmFsbCUyMGFjdGlvbiUyMGdhbWV8ZW58MHx8fHwxNzgwMDk0NTQwfDA&ixlib=rb-4.1.0&q=85",
};

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
      <section className="relative overflow-hidden rounded-3xl border border-border">
        <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-sunken via-[#0F1416]/70 to-transparent" />
        <div className="relative px-6 py-12 md:px-12 md:py-20 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> {state.settings.currentSeason} · Live
          </span>
          <h1 className="mt-4 font-display font-extrabold uppercase tracking-tighter text-foreground text-display-xl sm:text-5xl lg:text-6xl leading-[0.95]">
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
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 block">
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
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 block">
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
            <p className="font-display font-extrabold text-2xl text-foreground leading-none">{s.value}</p>
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
            <Link to="/schedule" className="text-primary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
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
            <Link to="/standings" className="text-primary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              Standings <ArrowRight size={14} weight="bold" />
            </Link>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recent.length ? (
            recent.map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <p className="text-sm text-muted-foreground">No completed games yet.</p>
          )}
        </div>
      </section>

      {/* CTA CARDS */}
      <section className="grid md:grid-cols-2 gap-4">
        {[
          { to: "/register-team", img: SPORT_IMG.kickball, title: "Team Interest", desc: "Tell us about your team and an admin will reach out to get you set up.", cta: "Submit Team Interest", testid: "cta-register-team" },
          { to: "/free-agent-signup", img: SPORT_IMG.flag_football, title: "Sign Up as Free Agent", desc: "No team? No problem. Get added to the pool and let captains find you.", cta: "Join Free Agent Pool", testid: "cta-free-agent" },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            data-testid={c.testid}
            className="group relative overflow-hidden rounded-2xl border border-border min-h-[180px] flex items-end"
          >
            <img src={c.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-sunken via-[#0F1416]/60 to-transparent" />
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
