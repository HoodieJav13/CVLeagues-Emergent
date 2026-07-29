import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ranking, ChartLine, CaretDown } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { computeStandings, currentSeasonForSport, seasonsForSport, isFinalOutcome, isForfeitOutcome } from "../lib/selectors";
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
        className="space-y-10"
        testId="standings-results"
      >
        {leagues.length === 0 && (
          <EmptyState icon={Ranking} title="No standings yet" message="Standings appear once leagues and teams are set up." />
        )}
        {leagues.map((league) => {
          const rows = computeStandings(state, league.id);
          const maxPointsFor = Math.max(1, ...rows.map(({ record }) => record.pointsFor));
          return (
            <section key={league.id} data-testid={`standings-league-${league.id}`}>
              <div className="cvf-standings-heading">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2>{league.name}</h2>
                  <SportBadge sport={league.sport} />
                </div>
                <p><span aria-hidden="true" /> All teams qualify · final standings set playoff seeds</p>
              </div>
              <SeasonShape state={state} league={league} rows={rows} />
              <div className="cvf-standings-register bg-card border border-border overflow-hidden">
                {rows.length === 0 && (
                  <EmptyState icon={Ranking} title="No teams yet" message="Teams appear here after they join this league." density="compact" />
                )}
                {rows.map(({ team, record, rank, displayRank, rankLabel }) => (
                  <StandingsRow
                    key={team.id}
                    team={team}
                    record={record}
                    rank={rank}
                    rankLabel={rankLabel}
                    leader={displayRank === 1}
                    shareWidth={Math.round((record.pointsFor / maxPointsFor) * 100)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </FilterResultRegion>
    </div>
  );
}

// A2 "the table is the monument": one row per team at every viewport, the
// leader as a hero block, and the season's shape carried by a point-share bar
// on every row (the gold rail's old always-on meaning now varies). Form,
// streak, and ties render at every width — a tied team is never displayed as
// indistinguishable from one that has not played.
const StandingsRow = ({ team, record, rank, rankLabel, leader, shareWidth }) => {
  const recordLabel = `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;
  return (
    <Link
      to={`/team/${team.id}`}
      data-testid={`standings-row-${team.id}`}
      data-playoff-qualified="true"
      aria-label={`${team.name}: playoff seed ${rank}, standings position ${rankLabel}, ${record.played} games played, ${record.wins} wins, ${record.losses} losses${record.ties ? `, ${record.ties} ties` : ""}, ${record.pointsFor} points for, ${record.diff > 0 ? "+" : ""}${record.diff} point differential${record.streak ? `, ${record.streak.count} game ${record.streak.result === "W" ? "winning" : "losing"} streak` : ""}`}
      className={`cvf-standings-row block border-b border-border last:border-0 transition-colors hover:bg-white/5 active:bg-white/10 ${leader ? "cvf-standings-row--leader bg-[var(--leader-bg)]" : ""}`}
    >
      <div className="cvf-standings-row__body">
        <span className={`cvf-standings-row__rank ${leader ? "text-leader" : "text-muted-foreground"}`}>{rankLabel}</span>
        <StructuralIdentityBadge className="cvf-identity-badge--md" team={team} />
        <span className="cvf-standings-row__identity">
          <span className="cvf-standings-row__name">{team.name}</span>
          <span className="cvf-standings-row__form" data-testid={`standings-form-${team.id}`}>
            <FormChips form={record.form} />
          </span>
        </span>
        <span className="cvf-standings-row__figures">
          <span className="cvf-standings-row__record">{recordLabel}</span>
          <span className="cvf-standings-row__context">
            <span>{record.pointsFor} PF</span>
            <span className={record.diff > 0 ? "text-teal" : record.diff < 0 ? "text-[var(--loss-text)]" : ""}>
              {record.diff > 0 ? "+" : ""}{record.diff}
            </span>
            <StreakLabel streak={record.streak} />
          </span>
        </span>
      </div>
      {/* Point-share bar: this team's points-for as a share of the league's
          best. The one visual that varies on every row. */}
      <span className="cvf-standings-row__share" aria-hidden="true">
        <span
          className={leader ? "bg-gold" : "bg-border-strong"}
          style={{ width: `${shareWidth}%`, backgroundColor: leader ? "var(--cvf-gold)" : "var(--border-strong)" }}
        />
      </span>
    </Link>
  );
};

const StreakLabel = ({ streak }) => {
  if (!streak) return <span>—</span>;
  return (
    <span className={streak.result === "W" ? "text-teal font-bold" : "text-[var(--loss-text)]"}>
      {streak.label}
    </span>
  );
};

// Oldest to newest, left to right. 20px chips, 11px letters, full-opacity
// borders (the carried Batch 2 spec). The letter is the signal; color
// reinforces it, so the three-signal rule holds without relying on hue.
const FORM_CHIP = {
  W: "border-teal text-teal",
  L: "border-[var(--loss-text)] text-[var(--loss-text)]",
  T: "border-[var(--rank-silver)] text-[var(--rank-silver)]",
};

const FormChips = ({ form }) => {
  if (!form?.length) return <span className="text-muted-foreground text-micro">—</span>;
  return (
    <span className="flex items-center gap-1">
      {form.map((result, index) => (
        <span
          key={index}
          className={`w-5 h-5 rounded-[4px] border flex items-center justify-center text-[11px] font-bold leading-none ${FORM_CHIP[result]}`}
        >
          {result}
        </span>
      ))}
    </span>
  );
};

/* ------------------------- season-shape worm ------------------------------ */
// Addendum 7 data graphic: cumulative point differential per team over the
// league's completed regular-season games, hand-drawn SVG in team colors,
// disclosed behind an explicit control and never open by default. Forfeits
// carry no points, so they hold a team's line flat — consistent with how the
// table scores them.
function leagueDiffSeries(state, league) {
  const games = state.games
    .filter((g) => g.league_id === league.id && isFinalOutcome(g) && g.stage !== "playoff" && g.stage !== "tournament")
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const cumulative = new Map();
  const series = new Map();
  const point = (teamId, index) => {
    if (!series.has(teamId)) series.set(teamId, [{ index: 0, value: 0 }]);
    series.get(teamId).push({ index, value: cumulative.get(teamId) || 0 });
  };
  games.forEach((g, i) => {
    const index = i + 1;
    if (!isForfeitOutcome(g)) {
      cumulative.set(g.home_team_id, (cumulative.get(g.home_team_id) || 0) + (g.home_score - g.away_score));
      cumulative.set(g.away_team_id, (cumulative.get(g.away_team_id) || 0) + (g.away_score - g.home_score));
    }
    point(g.home_team_id, index);
    point(g.away_team_id, index);
  });
  return { series, steps: games.length };
}

const SeasonShape = ({ state, league, rows }) => {
  const [open, setOpen] = useState(false);
  const { series, steps } = leagueDiffSeries(state, league);
  if (steps < 2) return null;

  const width = 360;
  const height = 120;
  const pad = 8;
  const values = [...series.values()].flat().map((p) => Math.abs(p.value));
  const maxAbs = Math.max(1, ...values);
  const x = (index) => pad + (index / steps) * (width - pad * 2);
  const y = (value) => height / 2 - (value / maxAbs) * (height / 2 - pad);
  const leaderId = rows[0]?.team.id;

  return (
    <div className="mb-3">
      <button
        type="button"
        data-testid={`standings-season-shape-${league.id}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-micro font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
      >
        <ChartLine size={14} weight="bold" aria-hidden="true" />
        Season shape
        <CaretDown size={12} weight="bold" aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <figure className="mt-2 mb-0 rounded-xl border border-border bg-card p-3">
          <figcaption className="text-micro uppercase tracking-widest text-muted-foreground mb-2">
            Point differential, game by game
          </figcaption>
          <svg viewBox={`0 0 ${width} ${height}`} className="block w-full h-auto" aria-hidden="true">
            <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 5" />
            {rows.slice().reverse().map(({ team }) => {
              const points = series.get(team.id);
              if (!points || points.length < 2) return null;
              const path = points.map((p) => `${x(p.index)},${y(p.value)}`).join(" ");
              const last = points[points.length - 1];
              const leader = team.id === leaderId;
              return (
                <g key={team.id}>
                  <polyline
                    points={path}
                    fill="none"
                    stroke={team.logo_color || "var(--border-strong)"}
                    strokeWidth={leader ? 3 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {leader && <circle cx={x(last.index)} cy={y(last.value)} r="3.5" fill={team.logo_color || "var(--cvf-gold)"} />}
                </g>
              );
            })}
          </svg>
        </figure>
      )}
    </div>
  );
};

const Filter = ({ label, value, onChange, testid, children }) => (
  <div>
    <label id={`${testid}-label`} htmlFor={testid} className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={testid} aria-labelledby={`${testid}-label`} data-testid={testid} className="bg-card border-border"><SelectValue /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </div>
);
