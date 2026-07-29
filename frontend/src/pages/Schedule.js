import { useEffect, useState, useMemo } from "react";
import { CalendarX } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { CompetitionRow } from "../components/game/CompetitionRow";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS } from "../lib/statsConfig";
import { usePersistedPreference } from "../hooks/usePersistedPreference";
import { currentSeasonForSport } from "../lib/selectors";
import { byStartAscending, gameWeekKey, formatWeekLabel } from "../lib/gameTime";
import { buildCalendar, downloadCalendar } from "../lib/calendar";
import { BACKEND_ENABLED } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { CalendarPlus, LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

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
  // Sport is shared with Home under one key — it is the same preference.
  const [sport, setSport] = usePersistedPreference(
    "sport",
    "all",
    (value) => value === "all" || SPORTS.some((item) => item.id === value)
  );
  const [season, setSeason] = useState("current");
  const [league_id, setLeagueId] = useState("all");
  const [team_id, setTeamId] = usePersistedPreference("scheduleTeam", "all");
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

  // A remembered team that no longer appears under the current filters would
  // otherwise leave someone staring at an empty schedule with no obvious cause.
  useEffect(() => {
    if (team_id !== "all" && !teams.some((team) => team.id === team_id)) setTeamId("all");
  }, [teams, team_id, setTeamId]);

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
      .sort(byStartAscending);
  }, [state, sport, season, league_id, team_id, status]);

  // Group the already-filtered games by their week (Sunday start). Because groups
  // are built from the filtered list, a fully-filtered-out week never renders —
  // no empty headers. Insertion order is chronological (games are sorted asc).
  const weekGroups = useMemo(() => {
    const map = new Map();
    for (const g of games) {
      // Weeks are grouped on the LEAGUE's calendar date, not the viewer's, so a
      // late kickoff never lands in the wrong week for someone in another zone.
      const key = gameWeekKey(g);
      const label = formatWeekLabel(key);
      if (!map.has(key)) map.set(key, { key, label, games: [] });
      map.get(key).games.push(g);
    }
    return [...map.values()];
  }, [games]);

  return (
    <div className="space-y-5">
      {/* The away-first list-order convention is stated once, here, per
          decision 8 — the rows themselves never label away/home. */}
      <SectionHeading as="h1" band title="Schedule" subtitle="Away team listed first · current seasons by default · league and tournament schedules stay distinct" />

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

      {/* Calendar export for whatever the filters currently show — below the
          register so content comes first (games are why anyone opens this
          page). Subscribing to a whole league only makes sense once a single
          league is selected — "all leagues" is a view, not a thing anyone
          follows. Full width below `sm`: these labels are wider than a 375px
          row, and flex-wrap will not shrink an item below its content width. */}
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button
          variant="outline"
          data-testid="schedule-download-calendar"
          disabled={games.length === 0}
          onClick={() => downloadCalendar(
            buildCalendar(state, games, { name: calendarLabel(state, league_id), origin: window.location.origin }),
            calendarLabel(state, league_id)
          )}
          className="h-11 w-full sm:w-auto"
        >
          <CalendarPlus data-icon="inline-start" weight="bold" /> Download These Games
        </Button>
        {BACKEND_ENABLED && league_id !== "all" && (
          <Button
            variant="ghost"
            data-testid="schedule-subscribe-league"
            onClick={() => copyLeagueSubscribeLink(league_id)}
            className="h-11 w-full sm:w-auto text-muted-foreground hover:text-primary"
          >
            <LinkSimple data-icon="inline-start" weight="bold" /> Copy League Subscribe Link
          </Button>
        )}
      </div>
    </div>
  );
}

const calendarLabel = (state, league_id) => {
  if (league_id === "all") return "CVF Schedule";
  return state.leagues.find((league) => league.id === league_id)?.name || "CVF Schedule";
};

// A league subscription updates itself, so a reschedule reaches every follower
// without them doing anything.
async function copyLeagueSubscribeLink(league_id) {
  const url = `${window.location.origin.replace(/^https?:/, "webcal:")}/api/calendar?league=${league_id}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("League subscribe link copied", {
      description: "Add it in your calendar app under \u201cSubscribe to calendar\u201d. It updates itself when the schedule changes.",
    });
  } catch {
    toast.error("Could not copy the link");
  }
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
