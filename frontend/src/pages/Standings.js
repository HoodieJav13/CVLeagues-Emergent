import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ranking } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { computeStandings, currentSeasonForSport, seasonsForSport } from "../lib/selectors";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { StructuralIdentityBadge } from "../components/direction/StructuralIdentity";
import { SPORTS } from "../lib/statsConfig";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

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

export default function Standings() {
  const { state } = useApp();
  const [sport, setSport] = useState("kickball");
  const [season, setSeason] = useState(() => currentSeasonForSport(state, "kickball"));
  const [filterRevision, setFilterRevision] = useState(0);
  const seasons = seasonsForSport(state, sport);
  const leagues = state.leagues.filter((league) => league.kind !== "tournament" && league.sport === sport && league.season === season);
  return (
    <div className="space-y-8">
      <SectionHeading as="h1" band title="Standings" subtitle={`${season} · Albuquerque · wins first, point diff breaks ties`} />
      <div className="grid sm:grid-cols-2 gap-2.5">
        <Filter label="Sport" value={sport} onChange={(value) => { setSport(value); setSeason(currentSeasonForSport(state, value)); setFilterRevision((revision) => revision + 1); }} testid="standings-filter-sport">
          {SPORTS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
        </Filter>
        <Filter label="Season" value={season} onChange={(value) => { setSeason(value); setFilterRevision((revision) => revision + 1); }} testid="standings-filter-season">
          {seasons.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
        </Filter>
      </div>
      <div className="flex justify-end">
        <Link to="/playoffs" className="inline-flex min-h-11 items-center rounded-xl border border-gold/40 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gold hover:bg-gold/10">View Playoff Brackets</Link>
      </div>
      <FilterResultRegion
        key={`${sport}:${season}:${filterRevision}`}
        animate={filterRevision > 0}
        className="space-y-8"
        testId="standings-results"
      >
        {leagues.length === 0 && (
          <EmptyState icon={Ranking} title="No standings yet" message="Standings appear once leagues and teams are set up." />
        )}
        {leagues.map((league) => {
        const rows = computeStandings(state, league.id);
        // Locked Season 1 rule: every team qualifies and the regular-season
        // standings order is the playoff seed order. The gold rail therefore
        // identifies a real qualifier; it is not a decorative rank accent.
        return (
          <section key={league.id} data-testid={`standings-league-${league.id}`}>
            <div className="cvf-standings-heading">
              <div className="flex flex-wrap items-center gap-2">
                <h2>{league.name}</h2>
                <SportBadge sport={league.sport} />
              </div>
              <p><span aria-hidden="true" /> All teams qualify · final standings set playoff seeds</p>
            </div>
            <div className="cvf-standings-register bg-card border border-border overflow-hidden">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_repeat(3,2.75rem)] sm:grid-cols-[auto_minmax(0,1fr)_repeat(4,3.5rem)] gap-1 px-3 py-2.5 bg-surface-sunken border-b border-border-strong text-label uppercase text-muted-foreground">
                <span className="w-6 text-center">#</span>
                <span>Team</span>
                <span className="text-right">W</span>
                <span className="text-right">L</span>
                <span className="hidden text-right sm:block">PF</span>
                <span className="text-right">DIFF</span>
              </div>
              {rows.length === 0 && (
                <EmptyState icon={Ranking} title="No teams yet" message="Teams appear here after they join this league." density="compact" />
              )}
              {rows.map(({ team, record, rank }) => (
                <Link
                  key={team.id}
                  to={`/team/${team.id}`}
                  data-testid={`standings-row-${team.id}`}
                  data-playoff-qualified="true"
                  aria-label={`${team.name}: playoff seed ${rank}, ${record.wins} wins, ${record.losses} losses, ${record.pointsFor} points for, ${record.diff > 0 ? "+" : ""}${record.diff} point differential`}
                  className={`cvf-standings-row grid grid-cols-[auto_minmax(0,1fr)_repeat(3,2.75rem)] sm:grid-cols-[auto_minmax(0,1fr)_repeat(4,3.5rem)] gap-1 px-3 items-center border-b border-border last:border-0 transition-colors hover:bg-white/5 active:bg-white/10 ${
                    rank === 1
                      ? "bg-[var(--leader-bg)]"
                      : rank % 2 === 0
                      ? "bg-surface"
                      : ""
                  }`}
                >
                  <span className={`w-6 text-center font-display font-bold ${rank === 1 ? "text-leader" : "text-muted-foreground"}`}>
                    {rank}
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <StructuralIdentityBadge className="cvf-identity-badge--standings" team={team} />
                    <span className="font-display uppercase tracking-tight text-foreground text-sm leading-tight whitespace-normal sm:text-base sm:whitespace-nowrap">{team.name}</span>
                  </span>
                  <span className="text-right font-mono-score font-bold text-foreground tabular-nums">{record.wins}</span>
                  <span className="text-right font-mono-score text-muted-foreground tabular-nums">{record.losses}</span>
                  <span className="hidden text-right font-mono-score text-muted-foreground tabular-nums sm:block">{record.pointsFor}</span>
                  <span className={`text-right font-mono-score tabular-nums ${record.diff > 0 ? "text-teal" : record.diff < 0 ? "text-[var(--loss-text)]" : "text-muted-foreground"}`}>
                    {record.diff > 0 ? "+" : ""}{record.diff}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
        })}
      </FilterResultRegion>
    </div>
  );
}

const Filter = ({ label, value, onChange, testid, children }) => (
  <div>
    <label id={`${testid}-label`} htmlFor={testid} className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={testid} aria-labelledby={`${testid}-label`} data-testid={testid} className="bg-card border-border"><SelectValue /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </div>
);
