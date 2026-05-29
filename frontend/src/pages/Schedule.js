import { useState, useMemo } from "react";
import { CalendarX } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { GameCard } from "../components/game/GameCard";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { SPORTS } from "../lib/statsConfig";

export default function Schedule() {
  const { state } = useApp();
  const [sport, setSport] = useState("all");
  const [leagueId, setLeagueId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [status, setStatus] = useState("all");

  const leagues = useMemo(
    () => (sport === "all" ? state.leagues : state.leagues.filter((l) => l.sport === sport)),
    [state.leagues, sport]
  );
  const teams = useMemo(
    () => state.teams.filter((t) => (sport === "all" || t.sport === sport) && (leagueId === "all" || t.leagueId === leagueId)),
    [state.teams, sport, leagueId]
  );

  const games = useMemo(() => {
    return state.games
      .filter((g) => sport === "all" || g.sport === sport)
      .filter((g) => leagueId === "all" || g.leagueId === leagueId)
      .filter((g) => teamId === "all" || g.homeTeamId === teamId || g.awayTeamId === teamId)
      .filter((g) => status === "all" || g.status === status)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [state.games, sport, leagueId, teamId, status]);

  return (
    <div className="space-y-5 animate-fade-up">
      <SectionHeading title="Schedule" subtitle={`${state.settings.currentSeason} · all matchups`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Filter label="Sport" value={sport} onChange={(v) => { setSport(v); setLeagueId("all"); setTeamId("all"); }} testid="schedule-filter-sport">
          <SelectItem value="all">All Sports</SelectItem>
          {SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </Filter>
        <Filter label="League" value={leagueId} onChange={(v) => { setLeagueId(v); setTeamId("all"); }} testid="schedule-filter-league">
          <SelectItem value="all">All Leagues</SelectItem>
          {leagues.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
        </Filter>
        <Filter label="Team" value={teamId} onChange={setTeamId} testid="schedule-filter-team">
          <SelectItem value="all">All Teams</SelectItem>
          {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </Filter>
        <Filter label="Status" value={status} onChange={setStatus} testid="schedule-filter-status">
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </Filter>
      </div>

      {games.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {games.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      ) : (
        <EmptyState icon={CalendarX} title="No games found" message="Try adjusting your filters." />
      )}
    </div>
  );
}

const Filter = ({ label, value, onChange, testid, children }) => (
  <div>
    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">
      {label}
    </label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testid} className="bg-card border-border h-10 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </div>
);
