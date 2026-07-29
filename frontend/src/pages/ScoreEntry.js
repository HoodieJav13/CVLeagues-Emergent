import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarX, FloppyDisk, LockSimple, PencilSimpleLine, Plus, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { formatGameShortDate, formatGameTime, venueLabel } from "../lib/gameTime";
import { useRole } from "../context/RoleContext";
import { getTeam, isForfeitOutcome, teamRoster } from "../lib/selectors";
import { STAT_GROUPS, HIGHLIGHT_STATS, statLabel } from "../lib/statsConfig";
import { EmptyState, SectionHeading } from "../components/common/Section";
import { SportBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { EligibilityIndicator } from "../components/common/EligibilityIndicator";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { RoleGate } from "../components/layout/RoleGate";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { SIGNED_STAT_KEYS, validateAggregateScore } from "../lib/scoreValidation";
import { LedgerScorekeeper } from "../components/admin/LedgerScorekeeper";
import { PracticeScorekeeper } from "../components/admin/PracticeScorekeeper";

// A clearly separated admin-only entry into the no-consequence practice
// rehearsal. Rendered outside the game-scoped flow (and even when no game
// exists) because practice needs two teams, not a scheduled game.
const PracticeEntryCard = ({ onOpen }) => (
  <div data-testid="practice-mode-entry" className="rounded-xl border border-gold/40 bg-gold/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <span className="inline-flex items-center rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-micro font-bold uppercase tracking-widest text-gold mb-1.5">PRACTICE — no consequences</span>
      <p className="font-semibold">Practice mode</p>
      <p className="text-sm text-muted-foreground">Rehearse the full event ledger — signed yards, overtime closes, corrections — against any two same-league-season teams. Nothing is published anywhere.</p>
    </div>
    <Button type="button" variant="outline" onClick={onOpen} className="shrink-0">Open practice mode</Button>
  </div>
);

export default function ScoreEntry() {
  return (
    <RoleGate allow={["admin"]} title="Score Entry">
      <Entry />
    </RoleGate>
  );
}

const periodCount = (sport) => (sport === "kickball" ? 5 : 4);
const periodLabel = (sport, i) => (sport === "kickball" ? `Inning ${i + 1}` : `Q${i + 1}`);

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

function Entry() {
  const { state, submitScore, setGameParticipation } = useApp();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const eligible = useMemo(() => {
    return [...state.games].sort((a, b) => (a.status === b.status ? 0 : a.status === "upcoming" ? -1 : 1));
  }, [state.games]);

  const [game_id, setGameId] = useState(location.state?.game_id || eligible[0]?.id || "");
  const game = state.games.find((g) => g.id === game_id);

  const [periods, setPeriods] = useState({ home: [], away: [] });
  const [statsByPlayer, setStatsByPlayer] = useState({});
  // Who appeared. Tracked separately from statistics because a player can show
  // up and record nothing; a stat row is not evidence of playing.
  const [played, setPlayed] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [correctionDraft, setCorrectionDraft] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [validation, setValidation] = useState({ hard: [], soft: [] });
  const [saving, setSaving] = useState(false);
  const [gameSelectionRevision, setGameSelectionRevision] = useState(0);
  const [ledgerSelected, setLedgerSelected] = useState(false);
  const [practiceSelected, setPracticeSelected] = useState(false);
  const correctionTriggerRef = useRef(null);

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
    // Attendance prefills from any recorded participation, otherwise defaults
    // every rostered player to present — marking the handful who missed is far
    // less work than ticking everyone who came.
    const recorded = (state.gameParticipation || []).filter((row) => row.game_id === game.id);
    const attendance = {};
    [game.home_team_id, game.away_team_id].forEach((team_id) => {
      teamRoster(state, team_id).forEach((row) => {
        const existingRow = recorded.find((item) => item.profile_id === row.profile_id);
        attendance[row.profile_id] = {
          team_id,
          status: existingRow ? existingRow.status : "played",
        };
      });
    });
    setPlayed(attendance);
    setExpanded(null);
    setCorrectionDraft(false);
    setCorrectionReason("");
    setOverrideReason("");
    setValidation({ hard: [], soft: [] });
  }, [game_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (practiceSelected) {
    return <PracticeScorekeeper onExit={() => setPracticeSelected(false)} />;
  }

  if (!game) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <EmptyState icon={CalendarX} title="No game available" message="Schedule a game before entering a score." />
        <PracticeEntryCard onOpen={() => setPracticeSelected(true)} />
      </div>
    );
  }

  if (ledgerSelected || game.scorekeeping_mode === "ledger") {
    return <LedgerScorekeeper game={game} onExit={() => setLedgerSelected(false)} />;
  }

  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const locked = game.locked === true;
  const editable = !locked || correctionDraft;
  const homeTotal = periods.home.reduce((a, b) => a + (Number(b) || 0), 0);
  const awayTotal = periods.away.reduce((a, b) => a + (Number(b) || 0), 0);

  const setPeriod = (side, i, val) =>
    setPeriods((p) => ({ ...p, [side]: p[side].map((v, idx) => (idx === i ? Math.max(0, Number(val) || 0) : v)) }));

  const addInning = () =>
    game.sport === "kickball" && setPeriods((p) => ({ home: [...p.home, 0], away: [...p.away, 0] }));

  const setStat = (profile_id, team_id, key, val) =>
    setStatsByPlayer((prev) => ({
      ...prev,
      [profile_id]: {
        team_id,
        stats: {
          ...(prev[profile_id]?.stats || {}),
          [key]: SIGNED_STAT_KEYS.has(key) ? Number(val) || 0 : Math.max(0, Number(val) || 0),
        },
      },
    }));

  const payload = () => ({
    game,
    home_score: homeTotal,
    away_score: awayTotal,
    periods,
    statsByPlayer,
    teamPlayers: state.teamPlayers,
    teams: state.teams,
  });

  const participationEntries = () =>
    Object.entries(played)
      .filter(([, entry]) => entry?.status === "played")
      .map(([profile_id, entry]) => ({ profile_id, team_id: entry.team_id, status: "played" }));

  const performSave = async (softOverride = "") => {
    setSaving(true);
    try {
      await submitScore({
        game_id: game.id,
        home_score: homeTotal,
        away_score: awayTotal,
        periods,
        statsByPlayer,
        correction_reason: correctionDraft ? correctionReason.trim() : "",
        override_reason: softOverride.trim(),
      });
      // Attendance is recorded separately from the score and is not blocked by
      // the game lock, so a failure here must not roll back a saved score.
      try {
        await setGameParticipation({ game_id: game.id, entries: participationEntries() });
      } catch {
        toast.warning("Score saved, but attendance could not be recorded.");
      }
      toast.success(correctionDraft ? "Final result corrected and re-locked" : `${away.name} ${awayTotal} – ${homeTotal} ${home.name} saved!`, {
        description: correctionDraft ? "The reason and before/after values were added to audit history." : "Standings, records, stats & leaderboards updated.",
      });
      navigate(`/game/${game.id}`);
    } catch {
      // Backend mode already reports the failure; keep the form open for correction.
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const result = validateAggregateScore(payload());
    setValidation(result);
    if (result.hard.length) {
      toast.error(result.hard[0].message);
      return;
    }
    if (result.soft.length) {
      setOverrideOpen(true);
      return;
    }
    await performSave();
  };

  const beginCorrection = () => {
    const reason = correctionReason.trim();
    if (!reason) {
      setCorrectionError("A correction reason is required.");
      return;
    }
    setCorrectionError("");
    setCorrectionDraft(true);
    setCorrectionOpen(false);
    window.requestAnimationFrame(() => document.querySelector('[data-testid="score-away-period-0"]')?.focus());
  };

  const cancelCorrection = () => {
    const n = periodCount(game.sport);
    const fill = (arr) => Array.from({ length: n }, (_, i) => arr?.[i] ?? 0);
    const existing = {};
    state.playerStats.filter((row) => row.game_id === game.id).forEach((row) => {
      existing[row.profile_id] = { team_id: row.team_id, stats: { ...row.stats } };
    });
    setPeriods({ home: fill(game.periods?.home), away: fill(game.periods?.away) });
    setStatsByPlayer(existing);
    setCorrectionDraft(false);
    setCorrectionReason("");
    setOverrideReason("");
    setValidation({ hard: [], soft: [] });
    correctionTriggerRef.current?.focus();
  };

  const confirmOverride = async () => {
    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError("An override reason is required to save with warnings.");
      return;
    }
    setOverrideError("");
    setOverrideOpen(false);
    await performSave(reason);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <SectionHeading as="h1" title="Score Entry" subtitle="Select a game and record the final" />

      {!locked && game.status === "upcoming" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><p className="font-semibold">Score live, event by event</p><p className="text-sm text-muted-foreground">Use the append-only ledger for a resumable game-day workflow and automatic final projection.</p></div>
          <Button type="button" variant="outline" onClick={() => setLedgerSelected(true)}>Use live scorekeeper</Button>
        </div>
      )}

      {locked && (
        <div data-testid="score-locked-notice" role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <LockSimple size={20} weight="bold" className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">This game is finalized and locked.</p>
              <p className="text-sm text-muted-foreground">A correction keeps the published result locked until the audited replacement saves.</p>
            </div>
          </div>
          {role === "admin" && (
            correctionDraft ? (
              <Button type="button" variant="outline" data-testid="score-correction-cancel" onClick={cancelCorrection} className="shrink-0">Cancel correction</Button>
            ) : (
              <Button ref={correctionTriggerRef} type="button" variant="outline" data-testid="score-correction-start" onClick={() => setCorrectionOpen(true)} className="shrink-0 gap-2">
                <PencilSimpleLine size={16} weight="bold" /> Correct final result
              </Button>
            )
          )}
        </div>
      )}

      {/* Game selector */}
      <div>
        <Label id="score-game-select-label" htmlFor="score-game-select" className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">Game</Label>
        <Select
          value={game_id}
          onValueChange={(value) => {
            setGameId(value);
            setGameSelectionRevision((revision) => revision + 1);
          }}
        >
          <SelectTrigger id="score-game-select" aria-labelledby="score-game-select-label" data-testid="score-game-select" className="bg-card border-border h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((g) => {
              const h = getTeam(state, g.home_team_id), a = getTeam(state, g.away_team_id);
              return (
                <SelectItem key={g.id} value={g.id}>
                  {a.name} @ {h.name} · {formatGameShortDate(g)} {isForfeitOutcome(g) ? "(Forfeit)" : g.status === "completed" ? "(Final)" : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <FilterResultRegion
        key={`${game_id}:${gameSelectionRevision}`}
        animate={gameSelectionRevision > 0}
        className="space-y-6"
        testId="score-game-results"
      >
      <div className="flex items-center gap-2">
        <SportBadge sport={game.sport} />
        <span className="text-xs text-muted-foreground">{venueLabel(state, game)} · {formatGameTime(game)}</span>
      </div>

      {/* Period scores */}
      <Card density="default" className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <p className="font-display uppercase tracking-tight text-foreground">{game.sport === "kickball" ? "Innings" : "Quarters"}</p>
          {game.sport === "kickball" && (
            <Button variant="ghost" onClick={addInning} disabled={!editable} data-testid="score-add-inning" className="h-auto min-h-[44px] -my-1 p-0 gap-1 normal-case tracking-normal text-sm font-semibold text-primary hover:text-primary hover:bg-transparent"><Plus size={14} weight="bold" /> Extra inning</Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground text-micro uppercase tracking-widest">
                <th scope="col" className="text-left font-semibold pb-2"><span className="sr-only">Team</span></th>
                {periods.home.map((_, i) => <th scope="col" key={i} className="font-semibold pb-2 px-1 text-center min-w-[44px]">{game.sport === "kickball" ? i + 1 : `Q${i + 1}`}</th>)}
                <th scope="col" className="font-semibold pb-2 px-2 text-center text-primary">Total</th>
              </tr>
            </thead>
            <tbody>
              {[{ side: "away", team: away, total: awayTotal }, { side: "home", team: home, total: homeTotal }].map((r) => (
                <tr key={r.side} className="border-t border-border">
                  <th scope="row" className="py-2 pr-2 font-display uppercase tracking-tight text-foreground whitespace-nowrap text-sm">{r.team.name}</th>
                  {periods[r.side].map((v, i) => (
                    <td key={i} className="px-1 py-2">
                      <input
                        type="number" min="0" value={v}
                        disabled={!editable} readOnly={!editable} aria-readonly={!editable}
                        aria-label={`${r.team.name} ${periodLabel(game.sport, i)}`}
                        data-testid={`score-${r.side}-period-${i}`}
                        onChange={(e) => setPeriod(r.side, i, e.target.value)}
                        className="w-11 h-11 md:h-10 bg-surface-sunken border border-border rounded-lg text-center font-mono-score text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                    </td>
                  ))}
                  <td className="px-2 text-center font-mono-score text-xl font-bold text-primary">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Per-player stats */}
      <div className="space-y-4">
        {[away, home].map((team) => {
          const roster = teamRoster(state, team.id);
          return (
            <Card key={team.id} density="compact" className="rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border">
                <p className="font-display uppercase tracking-tight text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.logo_color }} /> {team.name} · Player Stats
                </p>
              </CardHeader>
              {roster.length === 0 ? (
                <CardContent className="p-0">
                  <EmptyState icon={UsersThree} title="No players assigned" message="Assign players before entering a score." density="compact" />
                </CardContent>
              ) : (
                <Accordion type="single" collapsible value={expanded || ""} onValueChange={(value) => setExpanded(value || null)}>
                {roster.map((r) => {
                const pstats = statsByPlayer[r.profile_id]?.stats || {};
                const summary = HIGHLIGHT_STATS[team.sport].map((k) => `${pstats[k] || 0} ${statLabel(team.sport, k).split(" ")[0]}`).join(" · ");
                return (
                  <AccordionItem key={r.id} value={r.profile_id} className="last:border-0">
                    <AccordionTrigger
                      data-testid={`score-player-toggle-${r.profile_id}`}
                      className="min-h-[52px] gap-3 px-4 py-3 font-normal text-foreground hover:no-underline hover:bg-white/5 active:bg-white/10"
                    >
                      <Avatar name={r.profile.name} color={r.profile.avatar_color} size={34} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                          <span className="truncate">{r.profile.name}</span>
                          <EligibilityIndicator status={r.profile.eligibility_status} />
                        </p>
                        <p className="text-micro text-muted-foreground tabular-nums">{summary}</p>
                      </div>
                      <label
                        className="flex items-center gap-1.5 text-micro uppercase tracking-widest text-muted-foreground shrink-0 pr-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          data-testid={`score-player-played-${r.profile_id}`}
                          checked={played[r.profile_id]?.status === "played"}
                          onChange={(event) => setPlayed((prev) => ({
                            ...prev,
                            [r.profile_id]: { team_id: team.id, status: event.target.checked ? "played" : "absent" },
                          }))}
                          className="w-4 h-4 accent-teal"
                        />
                        Played
                      </label>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3" data-testid={`score-player-form-${r.profile_id}`}>
                        {STAT_GROUPS[team.sport].map((grp) => (
                          <div key={grp.group}>
                            <p className="text-micro uppercase tracking-widest text-primary font-semibold mb-1.5">{grp.group}</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {grp.stats.map((st) => (
                                <label key={st.key} className="flex flex-col gap-1">
                                  <span className="text-micro text-muted-foreground truncate">{st.label}</span>
                                  <input
                                    type="number" min={SIGNED_STAT_KEYS.has(st.key) ? undefined : "0"} value={pstats[st.key] ?? 0}
                                    disabled={!editable} readOnly={!editable} aria-readonly={!editable}
                                    data-testid={`score-stat-${r.profile_id}-${st.key}`}
                                    onChange={(e) => setStat(r.profile_id, team.id, st.key, e.target.value)}
                                    className="h-11 md:h-9 bg-surface-sunken border border-border rounded-lg text-center font-mono-score text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              </Accordion>
              )}
            </Card>
          );
        })}
      </div>

      {validation.hard.length > 0 && (
        <div data-testid="score-hard-errors" role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 space-y-1">
          <p className="font-semibold text-destructive">Score cannot be saved</p>
          {validation.hard.map((item, index) => <p key={`${item.code}-${index}`} className="text-sm text-foreground">{item.message}</p>)}
        </div>
      )}

      <Button onClick={save} disabled={!editable || saving} data-testid="score-save" className="w-full h-auto py-4 gap-2 text-sm font-bold tracking-wide rounded-xl sticky bottom-20 md:bottom-6 [&_svg]:size-[18px]">
        <FloppyDisk size={18} weight="bold" /> {saving ? "Saving…" : correctionDraft ? "Save corrected final" : "Submit Score"}
      </Button>
      </FilterResultRegion>

      <PracticeEntryCard onOpen={() => setPracticeSelected(true)} />

      <Dialog open={correctionOpen} onOpenChange={(open) => {
        setCorrectionOpen(open);
        if (!open) setCorrectionError("");
      }}>
        <DialogContent
          data-testid="score-correction-dialog"
          className="bg-card border-border"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (correctionTriggerRef.current?.isConnected) correctionTriggerRef.current.focus();
            else document.getElementById("score-game-select")?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight text-foreground">Correct Final Result</DialogTitle>
            <DialogDescription>The published result stays locked while you draft. Saving records the reason and before/after values in audit history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="score-correction-reason" className="text-micro uppercase tracking-widest text-muted-foreground font-semibold">Correction reason (required)</Label>
            <Textarea
              id="score-correction-reason"
              data-testid="score-correction-reason"
              value={correctionReason}
              onChange={(event) => {
                setCorrectionReason(event.target.value);
                if (correctionError) setCorrectionError("");
              }}
              required
              aria-invalid={Boolean(correctionError)}
              aria-describedby={correctionError ? "score-correction-reason-error" : undefined}
              className="bg-surface-sunken border-border"
            />
            {correctionError && <p id="score-correction-reason-error" role="alert" className="text-sm text-destructive">{correctionError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCorrectionOpen(false); setCorrectionError(""); }}>Cancel</Button>
            <Button type="button" data-testid="score-correction-confirm" onClick={beginCorrection}>Begin correction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={(open) => {
        if (saving) return;
        setOverrideOpen(open);
        if (!open) setOverrideError("");
      }}>
        <DialogContent data-testid="score-override-dialog" className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight text-foreground">Review Score Warnings</DialogTitle>
            <DialogDescription>The score can be saved, but these independent tallies do not reconcile. Record why the official result should override them.</DialogDescription>
          </DialogHeader>
          <div data-testid="score-soft-warnings" className="rounded-lg border border-gold/40 bg-gold/10 p-3 space-y-1">
            {validation.soft.map((item, index) => <p key={`${item.code}-${index}`} className="text-sm text-foreground">{item.message}</p>)}
          </div>
          <div className="space-y-2 py-2">
            <Label htmlFor="score-override-reason" className="text-micro uppercase tracking-widest text-muted-foreground font-semibold">Override reason (required)</Label>
            <Textarea
              id="score-override-reason"
              data-testid="score-override-reason"
              value={overrideReason}
              onChange={(event) => {
                setOverrideReason(event.target.value);
                if (overrideError) setOverrideError("");
              }}
              required
              aria-invalid={Boolean(overrideError)}
              aria-describedby={overrideError ? "score-override-reason-error" : undefined}
              className="bg-surface-sunken border-border"
            />
            {overrideError && <p id="score-override-reason-error" role="alert" className="text-sm text-destructive">{overrideError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOverrideOpen(false); setOverrideError(""); }}>Back</Button>
            <Button type="button" data-testid="score-override-confirm" disabled={saving} onClick={confirmOverride}>Save with reason</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
