import { useState } from "react";
import { Trophy } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { buildLeaderboard, currentSeasonForSport, seasonsForSport } from "../lib/selectors";
import { LEADERBOARD_CATEGORIES, SPORTS } from "../lib/statsConfig";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Card, CardContent } from "../components/ui/card";
import { RankedLeaderboardRow } from "../components/player/RankedLeaderboardRow";

export default function Leaderboards() {
  const { state } = useApp();
  const [sport, setSport] = useState("kickball");
  const [scope, setScope] = useState("season");
  const [season, setSeason] = useState(() => currentSeasonForSport(state, "kickball"));
  const [tournament, setTournament] = useState("");
  const cats = LEADERBOARD_CATEGORIES[sport];
  const [stat, setStat] = useState(cats[0].key);

  const onSport = (s) => {
    setSport(s);
    setSeason(currentSeasonForSport(state, s));
    setTournament("");
    setStat(LEADERBOARD_CATEGORIES[s][0].key);
  };

  const seasons = seasonsForSport(state, sport);
  const tournaments = state.leagues.filter((league) => league.sport === sport && league.kind === "tournament");
  const tournamentId = tournament || tournaments[0]?.id || null;
  const context = scope === "season" ? season : scope === "tournament" ? tournamentId : null;
  const rows = buildLeaderboard(state, sport, stat, scope, context);
  const catLabel = LEADERBOARD_CATEGORIES[sport].find((c) => c.key === stat)?.label;

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

        {SPORTS.map((s) => (
          <TabsContent key={s.id} value={s.id} className="space-y-4 mt-4">
            <div className="cvf-leaderboard-controls flex flex-col sm:flex-row gap-2.5">
              <Tabs value={scope} onValueChange={setScope} className="flex-1">
                <TabsList className="bg-card border border-border w-full grid grid-cols-3 h-10">
                  <TabsTrigger value="season" data-testid="leaderboard-scope-season" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Season</TabsTrigger>
                  <TabsTrigger value="career" data-testid="leaderboard-scope-career" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Career</TabsTrigger>
                  <TabsTrigger value="tournament" data-testid="leaderboard-scope-tournament" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Tournament</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={stat} onValueChange={setStat}>
                <SelectTrigger data-testid="leaderboard-stat-select" className="bg-card border-border h-10 flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEADERBOARD_CATEGORIES[s.id].map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <SportBadge sport={s.id} />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                {scope === "season" ? season : scope === "tournament" ? (tournaments.find((item) => item.id === tournamentId)?.name || "No tournaments") : "League career"} · {catLabel}
              </span>
            </div>

            <Card density="compact" className="rounded-2xl overflow-hidden" data-testid="leaderboard-list">
              <CardContent className="p-0">
              {rows.length ? rows.map((row) => (
                <RankedLeaderboardRow key={row.profile.id} row={row} statLabel={catLabel} />
              )) : (
                <EmptyState icon={Trophy} title="No leaders yet" message={scope === "tournament" && !tournaments.length ? "No standalone tournaments have been created for this sport." : "Stats appear after completed games are recorded."} density="default" />
              )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
