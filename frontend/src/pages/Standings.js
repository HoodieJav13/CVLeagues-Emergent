import { Link } from "react-router-dom";
import { Ranking } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { computeStandings } from "../lib/selectors";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";

export default function Standings() {
  const { state } = useApp();
  return (
    <div className="space-y-8 animate-fade-up">
      <SectionHeading as="h1" band title="Standings" subtitle={`${state.settings.current_season} · Albuquerque · wins first, point diff breaks ties`} />
      {state.leagues.length === 0 && (
        <EmptyState icon={Ranking} title="No standings yet" message="Standings appear once leagues and teams are set up." />
      )}
      {state.leagues.map((league) => {
        const rows = computeStandings(state, league.id);
        return (
          <section key={league.id} data-testid={`standings-league-${league.id}`}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-display uppercase tracking-tight text-lg text-foreground">{league.name}</h2>
              <SportBadge sport={league.sport} />
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
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
                  className={`grid grid-cols-[auto_minmax(0,1fr)_repeat(3,2.75rem)] sm:grid-cols-[auto_minmax(0,1fr)_repeat(4,3.5rem)] gap-1 px-3 py-3 items-center border-b border-border last:border-0 border-l-2 transition-colors hover:bg-white/5 active:bg-white/10 ${
                    rank === 1
                      ? "border-l-gold bg-[var(--leader-bg)]"
                      : rank % 2 === 0
                      ? "border-l-transparent bg-surface"
                      : "border-l-transparent"
                  }`}
                >
                  <span className={`w-6 text-center font-display font-bold ${rank === 1 ? "text-leader" : "text-muted-foreground"}`}>
                    {rank}
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.logo_color }} />
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
    </div>
  );
}
