import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CaretDown, FloppyDisk, LockSimple, LockSimpleOpen, Plus, Minus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { getTeam, teamRoster } from "../lib/selectors";
import { STAT_GROUPS, HIGHLIGHT_STATS, statLabel } from "../lib/statsConfig";
import { SectionHeading } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { EligibilityIndicator } from "../components/common/EligibilityIndicator";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { RoleGate } from "../components/layout/RoleGate";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

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
  const { state, submitScore, unlockGame } = useApp();
  const { role, roleMeta } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  // temp_admin can only score their assigned game; admin sees all.
  const eligible = useMemo(() => {
    if (role === "temp_admin") return state.games.filter((g) => g.id === roleMeta.assignedGameId);
    return [...state.games].sort((a, b) => (a.status === b.status ? 0 : a.status === "upcoming" ? -1 : 1));
  }, [state.games, role, roleMeta]);

  const [game_id, setGameId] = useState(location.state?.game_id || eligible[0]?.id || "");
  const game = state.games.find((g) => g.id === game_id);

  const [periods, setPeriods] = useState({ home: [], away: [] });
  const [statsByPlayer, setStatsByPlayer] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // (Re)initialize form whenever the selected game changes.
  useEffect(() => {
    if (!game) return;
    const n = periodCount(game.sport);
    const fill = (arr) => Array.from({ length: n }, (_, i) => arr?.[i] ?? 0);
    setPeriods({ home: fill(game.periods?.home), away: fill(game.periods?.away) });
    // Prefill existing stat rows if editing a completed game.
    const existing = {};
    state.playerStats.filter((s) => s.game_id === game.id).forEach((s) => {
      existing[s.profile_id] = { team_id: s.team_id, stats: { ...s.stats } };
    });
    setStatsByPlayer(existing);
    setExpanded(null);
  }, [game_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return <p className="text-muted-foreground">No game available to score.</p>;
  }

  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const locked = game.locked === true;
  const homeTotal = periods.home.reduce((a, b) => a + (Number(b) || 0), 0);
  const awayTotal = periods.away.reduce((a, b) => a + (Number(b) || 0), 0);

  const setPeriod = (side, i, val) =>
    setPeriods((p) => ({ ...p, [side]: p[side].map((v, idx) => (idx === i ? Math.max(0, Number(val) || 0) : v)) }));

  const addInning = () =>
    game.sport === "kickball" && setPeriods((p) => ({ home: [...p.home, 0], away: [...p.away, 0] }));

  const setStat = (profile_id, team_id, key, val) =>
    setStatsByPlayer((prev) => ({
      ...prev,
      [profile_id]: { team_id, stats: { ...(prev[profile_id]?.stats || {}), [key]: Math.max(0, Number(val) || 0) } },
    }));

  const save = async () => {
    try {
      await submitScore({ game_id: game.id, home_score: homeTotal, away_score: awayTotal, periods, statsByPlayer });
      toast.success(`${away.name} ${awayTotal} – ${homeTotal} ${home.name} saved!`, {
        description: "Standings, records, stats & leaderboards updated.",
      });
      navigate(`/game/${game.id}`);
    } catch {
      // Backend mode already reports the failure; keep the form open for correction.
    }
  };

  const unlock = async () => {
    const reason = unlockReason.trim();
    if (!reason) return toast.error("A reason is required to unlock");

    setUnlocking(true);
    try {
      await unlockGame(game.id, reason);
      toast.success("Game unlocked — score entry is editable");
      setUnlockOpen(false);
      setUnlockReason("");
    } catch {
      // Backend mode already reports the failure; keep the dialog open for correction.
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-3xl mx-auto">
      <SectionHeading as="h1" title="Score Entry" subtitle={role === "temp_admin" ? "Scoring your assigned game" : "Select a game and record the final"} />

      {locked && (
        <div data-testid="score-locked-notice" role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <LockSimple size={20} weight="bold" className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">This game is finalized and locked.</p>
              <p className="text-sm text-muted-foreground">Unlock it to make changes.</p>
            </div>
          </div>
          {role === "admin" && (
            <Button type="button" variant="outline" data-testid="score-unlock" onClick={() => setUnlockOpen(true)} className="shrink-0 gap-2">
              <LockSimpleOpen size={16} weight="bold" /> Unlock game
            </Button>
          )}
        </div>
      )}

      {/* Game selector */}
      <Select value={game_id} onValueChange={setGameId} disabled={role === "temp_admin"}>
        <SelectTrigger data-testid="score-game-select" className="bg-card border-border h-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {eligible.map((g) => {
            const h = getTeam(state, g.home_team_id), a = getTeam(state, g.away_team_id);
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
          <p className="font-display uppercase tracking-tight text-foreground">{game.sport === "kickball" ? "Innings" : "Quarters"}</p>
          {game.sport === "kickball" && (
            <Button variant="ghost" onClick={addInning} disabled={locked} data-testid="score-add-inning" className="h-auto min-h-[44px] -my-1 p-0 gap-1 normal-case tracking-normal text-sm font-semibold text-primary hover:text-primary hover:bg-transparent"><Plus size={14} weight="bold" /> Extra inning</Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground text-micro uppercase tracking-widest">
                <th className="text-left font-semibold pb-2"> </th>
                {periods.home.map((_, i) => <th key={i} className="font-semibold pb-2 px-1 text-center min-w-[44px]">{game.sport === "kickball" ? i + 1 : `Q${i + 1}`}</th>)}
                <th className="font-semibold pb-2 px-2 text-center text-primary">Total</th>
              </tr>
            </thead>
            <tbody>
              {[{ side: "away", team: away, total: awayTotal }, { side: "home", team: home, total: homeTotal }].map((r) => (
                <tr key={r.side} className="border-t border-border">
                  <td className="py-2 pr-2 font-display uppercase tracking-tight text-foreground whitespace-nowrap text-sm">{r.team.name}</td>
                  {periods[r.side].map((v, i) => (
                    <td key={i} className="px-1 py-2">
                      <input
                        type="number" min="0" value={v}
                        disabled={locked} readOnly={locked} aria-readonly={locked}
                        data-testid={`score-${r.side}-period-${i}`}
                        onChange={(e) => setPeriod(r.side, i, e.target.value)}
                        className="w-11 h-10 bg-surface-sunken border border-border rounded-lg text-center font-mono-score text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              <p className="px-4 py-3 border-b border-border font-display uppercase tracking-tight text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.logo_color }} /> {team.name} · Player Stats
              </p>
              {roster.length === 0 ? (
                <p className="px-4 py-8 text-center text-caption text-muted-foreground">
                  This team has no players yet. Assign players before entering a score.
                </p>
              ) : roster.map((r) => {
                const open = expanded === r.profile_id;
                const pstats = statsByPlayer[r.profile_id]?.stats || {};
                const summary = HIGHLIGHT_STATS[team.sport].map((k) => `${pstats[k] || 0} ${statLabel(team.sport, k).split(" ")[0]}`).join(" · ");
                return (
                  <div key={r.id} className="border-b border-border last:border-0">
                    <Button
                      variant="ghost"
                      onClick={() => setExpanded(open ? null : r.profile_id)}
                      data-testid={`score-player-toggle-${r.profile_id}`}
                      className="w-full h-auto justify-start gap-3 px-4 py-3 rounded-none normal-case tracking-normal font-normal whitespace-normal text-left text-foreground hover:text-foreground hover:bg-white/5 active:scale-100"
                    >
                      <Avatar name={r.profile.name} color={r.profile.avatar_color} size={34} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                          <span className="truncate">{r.profile.name}</span>
                          <EligibilityIndicator status={r.profile.eligibility_status} />
                        </p>
                        <p className="text-micro text-muted-foreground tabular-nums">{summary}</p>
                      </div>
                      <CaretDown size={16} weight="bold" className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                    </Button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3" data-testid={`score-player-form-${r.profile_id}`}>
                        {STAT_GROUPS[team.sport].map((grp) => (
                          <div key={grp.group}>
                            <p className="text-micro uppercase tracking-widest text-primary font-semibold mb-1.5">{grp.group}</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {grp.stats.map((st) => (
                                <label key={st.key} className="flex flex-col gap-1">
                                  <span className="text-micro text-muted-foreground truncate">{st.label}</span>
                                  <input
                                    type="number" min="0" value={pstats[st.key] || 0}
                                    disabled={locked} readOnly={locked} aria-readonly={locked}
                                    data-testid={`score-stat-${r.profile_id}-${st.key}`}
                                    onChange={(e) => setStat(r.profile_id, team.id, st.key, e.target.value)}
                                    className="h-9 bg-surface-sunken border border-border rounded-lg text-center font-mono-score text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

      <Button onClick={save} disabled={locked} data-testid="score-save" className="w-full h-auto py-4 gap-2 text-sm font-bold tracking-wide rounded-xl sticky bottom-20 md:bottom-6 [&_svg]:size-[18px]">
        <FloppyDisk size={18} weight="bold" /> Submit Score
      </Button>

      <Dialog open={unlockOpen} onOpenChange={(open) => !unlocking && setUnlockOpen(open)}>
        <DialogContent data-testid="score-unlock-dialog" className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight text-foreground">Unlock Game</DialogTitle>
            <DialogDescription>Unlocking allows score edits and records the required reason in the game's edit history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="score-unlock-reason" className="text-micro uppercase tracking-widest text-muted-foreground font-semibold">Reason (required)</Label>
            <Textarea
              id="score-unlock-reason"
              data-testid="score-unlock-reason"
              value={unlockReason}
              onChange={(event) => setUnlockReason(event.target.value)}
              disabled={unlocking}
              className="bg-surface-sunken border-border"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={unlocking} onClick={() => setUnlockOpen(false)}>Cancel</Button>
            <Button type="button" data-testid="score-unlock-confirm" disabled={unlocking} onClick={unlock}>
              {unlocking ? "Unlocking…" : "Unlock game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
