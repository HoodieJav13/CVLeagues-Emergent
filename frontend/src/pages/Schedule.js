import { useEffect, useState, useMemo } from "react";
import { CalendarX } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { CompetitionRow } from "../components/game/CompetitionRow";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS } from "../lib/statsConfig";
import { currentSeasonForSport } from "../lib/selectors";

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

export default function Schedule() {
  const { state } = useApp();
  const [sport, setSport] = useState("all");
  const [season, setSeason] = useState("current");
  const [league_id, setLeagueId] = useState("all");
  const [team_id, setTeamId] = useState("all");
  const [status, setStatus] = useState("all");
  const [filterRevision, setFilterRevision] = useState(0);

  const leagues = useMemo(
    () => state.leagues.filter((league) => {
      if (sport !== "all" && league.sport !== sport) return false;
      if (season === "all") return true;
      if (season === "current") return league.season === currentSeasonForSport(state, league.sport);
      return league.season === season;
    }),
    [state, sport, season]
  );
  const teams = useMemo(
    () => {
      const visibleLeagueIds = new Set(leagues.map((league) => league.id));
      return state.teams.filter((t) =>
        visibleLeagueIds.has(t.league_id)
        && (sport === "all" || t.sport === sport)
        && (league_id === "all" || t.league_id === league_id)
      );
    },
    [state.teams, leagues, sport, league_id]
  );

  const games = useMemo(() => {
    return state.games
      .filter((g) => sport === "all" || g.sport === sport)
      .filter((g) => {
        const league = state.leagues.find((item) => item.id === g.league_id);
        if (!league || season === "all") return true;
        if (season === "current") return league.season === currentSeasonForSport(state, league.sport);
        return league.season === season;
      })
      .filter((g) => league_id === "all" || g.league_id === league_id)
      .filter((g) => team_id === "all" || g.home_team_id === team_id || g.away_team_id === team_id)
      .filter((g) => status === "all" || g.status === status)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [state, sport, season, league_id, team_id, status]);

  // Group the already-filtered games by their week (Sunday start). Because groups
  // are built from the filtered list, a fully-filtered-out week never renders —
  // no empty headers. Insertion order is chronological (games are sorted asc).
  const weekGroups = useMemo(() => {
    const map = new Map();
    for (const g of games) {
      const d = new Date(g.date + "T00:00:00");
      d.setDate(d.getDate() - d.getDay()); // back to the week's Sunday
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const label = `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      if (!map.has(key)) map.set(key, { key, label, games: [] });
      map.get(key).games.push(g);
    }
    return [...map.values()];
  }, [games]);

  return (
    <div className="space-y-5">
      <SectionHeading as="h1" band title="Schedule" subtitle="Current seasons by default · league and tournament schedules stay distinct" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Filter label="Sport" value={sport} onChange={(v) => { setSport(v); setSeason("current"); setLeagueId("all"); setTeamId("all"); setFilterRevision((revision) => revision + 1); }} testid="schedule-filter-sport">
          <SelectItem value="all">All Sports</SelectItem>
          {SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </Filter>
        <Filter label="Season" value={season} onChange={(v) => { setSeason(v); setLeagueId("all"); setTeamId("all"); setFilterRevision((revision) => revision + 1); }} testid="schedule-filter-season">
          <SelectItem value="current">Current by Sport</SelectItem>
          <SelectItem value="all">All Seasons</SelectItem>
          {state.seasons.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
        </Filter>
        <Filter label="League" value={league_id} onChange={(v) => { setLeagueId(v); setTeamId("all"); setFilterRevision((revision) => revision + 1); }} testid="schedule-filter-league">
          <SelectItem value="all">All Containers</SelectItem>
          {leagues.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.kind === "tournament" ? " · Tournament" : ""}</SelectItem>)}
        </Filter>
        <Filter label="Team" value={team_id} onChange={(v) => { setTeamId(v); setFilterRevision((revision) => revision + 1); }} testid="schedule-filter-team">
          <SelectItem value="all">All Teams</SelectItem>
          {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </Filter>
        <Filter label="Status" value={status} onChange={(v) => { setStatus(v); setFilterRevision((revision) => revision + 1); }} testid="schedule-filter-status">
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </Filter>
      </div>

      <FilterResultRegion
        key={`${sport}:${season}:${league_id}:${team_id}:${status}:${filterRevision}`}
        animate={filterRevision > 0}
        className="space-y-6"
        testId="schedule-results"
      >
        {games.length ? (
          weekGroups.map((grp) => (
            <section key={grp.key} data-testid={`schedule-week-${grp.key}`}>
              <h2 className="cvf-competition-group__heading">{grp.label}</h2>
              <div className="cvf-competition-register">
                {grp.games.map((g) => <CompetitionRow key={g.id} game={g} />)}
              </div>
            </section>
          ))
        ) : (
          <EmptyState icon={CalendarX} title="No games found" message="Try adjusting your filters." />
        )}
      </FilterResultRegion>
    </div>
  );
}

const Filter = ({ label, value, onChange, testid, children }) => (
  <div>
    <label id={`${testid}-label`} htmlFor={testid} className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">
      {label}
    </label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={testid} aria-labelledby={`${testid}-label`} data-testid={testid} className="bg-card border-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </div>
);
