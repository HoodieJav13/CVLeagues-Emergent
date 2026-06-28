import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CaretDown, FloppyDisk, Plus, Minus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { getTeam, teamRoster } from "../lib/selectors";
import { STAT_GROUPS, HIGHLIGHT_STATS, statLabel } from "../lib/statsConfig";
import { SectionHeading } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { EligibilityIndicator } from "../components/common/EligibilityIndicator";
import { RoleGate } from "../components/layout/RoleGate";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

export default function ScoreEntry() {
  return (
    <RoleGate allow={["admin", "temp_admin"]} title="Score Entry">
      <Entry />
    </RoleGate>
  );
}

const periodCount = (sport) => (sport === "kickball" ? 5 : 4);
const periodLabel = (sport, i) => (sport === "kickball" ? `Inning ${i + 1}` : `Q${i + 1}`);

function Entry() {
  const { state, submitScore } = useApp();
  const { role, roleMeta } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  // temp_admin can only score their assigned game; admin sees all.
  const eligible = useMemo(() => {
    if (role === "temp_admin") return state.games.filter((g) => g.id === roleMeta.assignedGameId);
    return [...state.games].sort((a, b) => (a.status === b.status ? 0 : a.status === "upcoming" ? -1 : 1));
  }, [state.games, role, roleMeta]);

  const [gameId, setGameId] = useState(location.state?.gameId || eligible[0]?.id || "");
  const game = state.games.find((g) => g.id === gameId);

  const [periods, setPeriods] = useState({ home: [], away: [] });
  const [statsByPlayer, setStatsByPlayer] = useState({});
  const [expanded, setExpanded] = useState(null);

  // (Re)initialize form whenever the selected game changes.
  useEffect(() => {
    if (!game) return;
    const n = periodCount(game.sport);
    const fill = (arr) => Array.from({ length: n }, (_, i) => arr?.[i] ?? 0);
    setPeriods({ home: fill(game.periods?.home), away: fill(game.periods?.away) });
    // Prefill existing stat rows if editing a completed game.
    const existing = {};
    state.playerStats.filter((s) => s.gameId === game.id).forEach((s) => {
      existing[s.playerId] = { teamId: s.teamId, stats: { ...s.stats } };
    });
    setStatsByPlayer(existing);
    setExpanded(null);
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return <p className="text-muted-foreground">No game available to score.</p>;
  }

  const home = getTeam(state, game.homeTeamId);
  const away = getTeam(state, game.awayTeamId);
  const homeTotal = periods.home.reduce((a, b) => a + (Number(b) || 0), 0);
  const awayTotal = periods.away.reduce((a, b) => a + (Number(b) || 0), 0);

  const setPeriod = (side, i, val) =>
    setPeriods((p) => ({ ...p, [side]: p[side].map((v, idx) => (idx === i ? Math.max(0, Number(val) || 0) : v)) }));

  const addInning = () =>
    game.sport === "kickball" && setPeriods((p) => ({ home: [...p.home, 0], away: [...p.away, 0] }));

  const setStat = (playerId, teamId, key, val) =>
    setStatsByPlayer((prev) => ({
      ...prev,
      [playerId]: { teamId, stats: { ...(prev[playerId]?.stats || {}), [key]: Math.max(0, Number(val) || 0) } },
    }));

  const save = () => {
    submitScore({ gameId: game.id, homeScore: homeTotal, awayScore: awayTotal, periods, statsByPlayer });
    toast.success(`${away.name} ${awayTotal} – ${homeTotal} ${home.name} saved!`, {
      description: "Standings, records, stats & leaderboards updated.",
    });
    navigate(`/game/${game.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-3xl mx-auto">
      <SectionHeading title="Score Entry" subtitle={role === "temp_admin" ? "Scoring your assigned game" : "Select a game and record the final"} />

      {/* Game selector */}
      <Select value={gameId} onValueChange={setGameId} disabled={role === "temp_admin"}>
        <SelectTrigger data-testid="score-game-select" className="bg-card border-border h-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {eligible.map((g) => {
            const h = getTeam(state, g.homeTeamId), a = getTeam(state, g.awayTeamId);
            return (
              <SelectItem key={g.id} value={g.id}>
                {a.name} @ {h.name} · {new Date(g.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} {g.status === "completed" ? "(Final)" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <SportBadge sport={game.sport} />
        <span className="text-xs text-muted-foreground">{game.location} · {game.time}</span>
      </div>

      {/* Period scores */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display uppercase tracking-tight text-white">{game.sport === "kickball" ? "Innings" : "Quarters"}</p>
          {game.sport === "kickball" && (
            <button onClick={addInning} data-testid="score-add-inning" className="text-primary text-sm font-semibold flex items-center gap-1"><Plus size={14} weight="bold" /> Extra inning</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground text-[10px] uppercase tracking-widest">
                <th className="text-left font-semibold pb-2"> </th>
                {periods.home.map((_, i) => <th key={i} className="font-semibold pb-2 px-1 text-center min-w-[44px]">{game.sport === "kickball" ? i + 1 : `Q${i + 1}`}</th>)}
                <th className="font-semibold pb-2 px-2 text-center text-primary">Total</th>
              </tr>
            </thead>
            <tbody>
              {[{ side: "away", team: away, total: awayTotal }, { side: "home", team: home, total: homeTotal }].map((r) => (
                <tr key={r.side} className="border-t border-border">
                  <td className="py-2 pr-2 font-display uppercase tracking-tight text-white whitespace-nowrap text-sm">{r.team.name}</td>
                  {periods[r.side].map((v, i) => (
                    <td key={i} className="px-1 py-2">
                      <input
                        type="number" min="0" value={v}
                        data-testid={`score-${r.side}-period-${i}`}
                        onChange={(e) => setPeriod(r.side, i, e.target.value)}
                        className="w-11 h-10 bg-[#0f0f0f] border border-border rounded-lg text-center font-mono-score text-white focus:border-primary focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-2 text-center font-mono-score text-xl font-bold text-primary">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-player stats */}
      <div className="space-y-4">
        {[away, home].map((team) => {
          const roster = teamRoster(state, team.id);
          return (
            <div key={team.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <p className="px-4 py-3 border-b border-border font-display uppercase tracking-tight text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.logoColor }} /> {team.name} · Player Stats
              </p>
              {roster.map((r) => {
                const open = expanded === r.playerId;
                const pstats = statsByPlayer[r.playerId]?.stats || {};
                const summary = HIGHLIGHT_STATS[team.sport].map((k) => `${pstats[k] || 0} ${statLabel(team.sport, k).split(" ")[0]}`).join(" · ");
                return (
                  <div key={r.id} className="border-b border-border last:border-0">
                    <button
                      onClick={() => setExpanded(open ? null : r.playerId)}
                      data-testid={`score-player-toggle-${r.playerId}`}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <Avatar name={r.profile.name} color={r.profile.avatarColor} size={34} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate flex items-center gap-1.5">
                          <span className="truncate">{r.profile.name}</span>
                          <EligibilityIndicator status={r.profile.eligibilityStatus} />
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">{summary}</p>
                      </div>
                      <CaretDown size={16} weight="bold" className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3" data-testid={`score-player-form-${r.playerId}`}>
                        {STAT_GROUPS[team.sport].map((grp) => (
                          <div key={grp.group}>
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1.5">{grp.group}</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {grp.stats.map((st) => (
                                <label key={st.key} className="flex flex-col gap-1">
                                  <span className="text-[10px] text-muted-foreground truncate">{st.label}</span>
                                  <input
                                    type="number" min="0" value={pstats[st.key] || 0}
                                    data-testid={`score-stat-${r.playerId}-${st.key}`}
                                    onChange={(e) => setStat(r.playerId, team.id, st.key, e.target.value)}
                                    className="h-9 bg-[#0f0f0f] border border-border rounded-lg text-center font-mono-score text-sm text-white focus:border-primary focus:outline-none"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <button onClick={save} data-testid="score-save" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm py-4 rounded-xl hover:bg-[#06b6d4] transition-colors sticky bottom-20 md:bottom-6">
        <FloppyDisk size={18} weight="bold" /> Submit Score
      </button>
    </div>
  );
}
