import { useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Medal } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { buildLeaderboard } from "../lib/selectors";
import { LEADERBOARD_CATEGORIES, SPORTS } from "../lib/statsConfig";
import { SectionHeading } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

export default function Leaderboards() {
  const { state } = useApp();
  const [sport, setSport] = useState("kickball");
  const [scope, setScope] = useState("season");
  const cats = LEADERBOARD_CATEGORIES[sport];
  const [stat, setStat] = useState(cats[0].key);

  const onSport = (s) => {
    setSport(s);
    setStat(LEADERBOARD_CATEGORIES[s][0].key);
  };

  const rows = buildLeaderboard(state, sport, stat, scope);
  const catLabel = LEADERBOARD_CATEGORIES[sport].find((c) => c.key === stat)?.label;

  return (
    <div className="space-y-5 animate-fade-up">
      <SectionHeading title="Leaderboards" subtitle="Top performers across the league" />

      <Tabs value={sport} onValueChange={onSport}>
        <TabsList className="bg-card border border-border w-full grid grid-cols-2 h-11">
          {SPORTS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} data-testid={`leaderboard-sport-${s.id}`} className="data-[state=active]:bg-primary data-[state=active]:text-black uppercase font-display tracking-tight">
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {SPORTS.map((s) => (
          <TabsContent key={s.id} value={s.id} className="space-y-4 mt-4">
            <div className="flex gap-2.5">
              <Tabs value={scope} onValueChange={setScope} className="flex-1">
                <TabsList className="bg-card border border-border w-full grid grid-cols-2 h-10">
                  <TabsTrigger value="season" data-testid="leaderboard-scope-season" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Season</TabsTrigger>
                  <TabsTrigger value="career" data-testid="leaderboard-scope-career" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">Career</TabsTrigger>
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

            <div className="flex items-center gap-2">
              <SportBadge sport={s.id} />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{scope} · {catLabel}</span>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden" data-testid="leaderboard-list">
              {rows.length ? rows.map((row, i) => (
                <div key={row.profile.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/5 transition-colors">
                  <span className={`w-7 text-center font-display font-extrabold text-lg ${i === 0 ? "text-gold" : i === 1 ? "text-[#a1a1aa]" : i === 2 ? "text-[#f97316]" : "text-muted-foreground"}`}>
                    {i < 3 ? <Medal size={20} weight="fill" className="inline" /> : row.rank}
                  </span>
                  <Avatar name={row.profile.name} color={row.profile.avatarColor} size={38} />
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${row.profile.id}`} className="font-display uppercase tracking-tight text-foreground hover:text-primary truncate block text-base">{row.profile.name}</Link>
                    {row.team && <Link to={`/team/${row.team.id}`} className="text-xs text-muted-foreground hover:text-foreground">{row.team.name}</Link>}
                  </div>
                  <span className="font-mono-score text-xl font-bold text-primary tabular-nums">{row.value}</span>
                </div>
              )) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No stats recorded yet.</div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
