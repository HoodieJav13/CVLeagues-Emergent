import { useMemo, useState } from "react";
import { Trophy } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { buildLeaderboard, currentSeasonForSport, seasonsForSport } from "../lib/selectors";
import { LEADERBOARD_CATEGORIES, SPORTS } from "../lib/statsConfig";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { FeaturedLeaderboardHero, RankedLeaderboardRow } from "../components/player/RankedLeaderboardRow";

const FLAG_FOOTBALL_EDITORIAL_ORDER = [
  "passYards",
  "passTDs",
  "recYards",
  "recTDs",
  "rushYards",
  "flagPulls",
  "sacks",
  "defInts",
];

const orderedCategories = (sport) => {
  const categories = LEADERBOARD_CATEGORIES[sport];
  if (sport !== "flag_football") return categories;
  const priorities = new Map(FLAG_FOOTBALL_EDITORIAL_ORDER.map((key, index) => [key, index]));
  return [...categories].sort((a, b) => (priorities.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (priorities.get(b.key) ?? Number.MAX_SAFE_INTEGER));
};

const topFiveIncludingTies = (rows) => {
  if (rows.length <= 5) return rows;
  const cutoffValue = rows[4].value;
  let cutoff = 5;
  while (cutoff < rows.length && rows[cutoff].value === cutoffValue) cutoff += 1;
  return rows.slice(0, cutoff);
};

const LeaderboardModule = ({ category, expanded, onToggle, rows }) => {
  const moduleId = `leaderboard-module-${category.key}`;
  const defaultRows = topFiveIncludingTies(rows);
  const visibleRows = expanded ? rows : defaultRows;
  const supportingRows = visibleRows.slice(1);

  return (
    <section className="cvf-leaderboard-module" aria-labelledby={`${moduleId}-title`} data-testid={moduleId}>
      {rows.length ? (
        <>
          <FeaturedLeaderboardHero row={rows[0]} statLabel={category.label} titleId={`${moduleId}-title`} />
          <div className="cvf-leaderboard-module__rows" id={`${moduleId}-rows`}>
            {supportingRows.map((row) => (
              <RankedLeaderboardRow key={row.profile.id} row={row} statLabel={category.label} />
            ))}
          </div>
          {rows.length > defaultRows.length ? (
            <div className="cvf-leaderboard-module__footer">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-controls={`${moduleId}-rows`}
                aria-expanded={expanded}
                onClick={onToggle}
              >
                {expanded ? (defaultRows.length > 5 ? "Show top 5 + ties" : "Show top 5") : `Show all ${rows.length}`}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <h2 className="cvf-leaderboard-module__empty-title" id={`${moduleId}-title`}>{category.label}</h2>
          <EmptyState icon={Trophy} title="No leaders yet" message="Stats appear after completed games are recorded." density="compact" />
        </>
      )}
    </section>
  );
};

export default function Leaderboards() {
  const { state } = useApp();
  const [sport, setSport] = useState("kickball");
  const [scope, setScope] = useState("season");
  const [season, setSeason] = useState(() => currentSeasonForSport(state, "kickball"));
  const [tournament, setTournament] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});

  const onSport = (s) => {
    setSport(s);
    setSeason(currentSeasonForSport(state, s));
    setTournament("");
    setExpandedCategories({});
  };

  const seasons = seasonsForSport(state, sport);
  const tournaments = state.leagues.filter((league) => league.sport === sport && league.kind === "tournament");
  const tournamentId = tournament || tournaments[0]?.id || null;
  const context = scope === "season" ? season : scope === "tournament" ? tournamentId : null;
  const categories = useMemo(() => orderedCategories(sport), [sport]);
  const modules = useMemo(() => categories.map((category) => ({
    category,
    rows: buildLeaderboard(state, sport, category.key, scope, context),
  })), [categories, context, scope, sport, state]);
  const contextLabel = scope === "season" ? season : scope === "tournament" ? (tournaments.find((item) => item.id === tournamentId)?.name || "No tournaments") : "League career";
  const toggleCategory = (key) => setExpandedCategories((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="space-y-5 animate-fade-up">
      <SectionHeading as="h1" band title="Leaderboards" subtitle="Season and career leaders across Albuquerque's leagues" />

      <Tabs value={sport} onValueChange={onSport}>
        <TabsList className="cvf-leaderboard-sport-tabs bg-card border border-border w-full grid grid-cols-2 h-11">
          {SPORTS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} data-testid={`leaderboard-sport-${s.id}`} className="border-b-2 border-b-transparent data-[state=active]:border-b-teal data-[state=active]:bg-surface-raised data-[state=active]:text-foreground data-[state=active]:shadow-none uppercase font-display tracking-tight">
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={sport} className="space-y-4 mt-4">
            <div className="cvf-leaderboard-controls">
              <Tabs value={scope} onValueChange={setScope} className="flex-1">
                <TabsList className="bg-card border border-border w-full grid grid-cols-3 h-10">
                  <TabsTrigger value="season" data-testid="leaderboard-scope-season" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Season</TabsTrigger>
                  <TabsTrigger value="career" data-testid="leaderboard-scope-career" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Career</TabsTrigger>
                  <TabsTrigger value="tournament" data-testid="leaderboard-scope-tournament" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Tournament</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {(scope === "season" || (scope === "tournament" && tournaments.length > 0)) ? (
              <div className="cvf-leaderboard-context-filter">
                {scope === "season" ? (
                  <Select value={season} onValueChange={setSeason}>
                    <SelectTrigger data-testid="leaderboard-season-select" className="bg-card border-border h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{seasons.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Select value={tournamentId} onValueChange={setTournament}>
                    <SelectTrigger data-testid="leaderboard-tournament-select" className="bg-card border-border h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{tournaments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <SportBadge sport={sport} />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                {contextLabel} · all categories
              </span>
            </div>

            {scope === "tournament" && !tournaments.length ? (
              <EmptyState icon={Trophy} title="No tournament leaders yet" message="No standalone tournaments have been created for this sport." density="default" />
            ) : (
              <div className="cvf-leaderboard-dashboard" data-testid="leaderboard-dashboard">
                {modules.map(({ category, rows }) => (
                  <LeaderboardModule
                    key={category.key}
                    category={category}
                    expanded={Boolean(expandedCategories[category.key])}
                    onToggle={() => toggleCategory(category.key)}
                    rows={rows}
                  />
                ))}
              </div>
            )}
          </TabsContent>
      </Tabs>
    </div>
  );
}
