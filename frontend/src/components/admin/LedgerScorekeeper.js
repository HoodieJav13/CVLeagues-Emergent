import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowsClockwise, CheckCircle, Flag, Plus, Prohibit } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "../../context/AppStateContext";
import { getTeam, isForfeitOutcome } from "../../lib/selectors";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

const operationKey = () => globalThis.crypto?.randomUUID?.() || `ledger-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const EVENT_OPTIONS = {
  kickball: [
    ["run", "Run", 1, "runs"], ["out", "Out", 0, "outs"], ["kick", "Kick", 0, "kicks"],
    ["single", "Single", 0, "singles"], ["double", "Double", 0, "doubles"],
    ["triple", "Triple", 0, "triples"], ["home_run", "Home run", 0, "homeRuns"],
    ["walk", "Walk", 0, "walks"], ["strikeout", "Strikeout", 0, "strikeouts"],
    ["assist", "Assist", 0, "assists"], ["error", "Error", 0, "errors"],
  ],
  flag_football: [
    ["touchdown", "Touchdown", 6, "tds"], ["one_point", "1-point try", 1, "onePoint"],
    ["two_point", "2-point try", 2, "twoPoint"], ["three_point", "3-point try", 3, "threePoint"],
    ["safety", "Safety", 2, "safeties"], ["completion", "Completion", 0, "completions"],
    ["carry", "Carry", 0, "carries"], ["reception", "Reception", 0, "catches"],
    ["flag_pull", "Flag pull", 0, "flagPulls"], ["sack", "Sack", 0, "sacks"],
    ["interception", "Interception", 0, "defInts"],
  ],
};

export function LedgerScorekeeper({ game, onExit }) {
  const app = useApp();
  const navigate = useNavigate();
  const home = getTeam(app.state, game.home_team_id);
  const away = getTeam(app.state, game.away_team_id);
  const [lease, setLease] = useState(null);
  const leaseRef = useRef(null);
  const heartbeatBusy = useRef(false);
  const mounted = useRef(true);
  const finalizationKey = useRef(operationKey());
  const [busy, setBusy] = useState(false);
  const [ruleVersion, setRuleVersion] = useState("CVF-2026.1");
  const [periodCount, setPeriodCount] = useState(game.sport === "flag_football" ? 4 : 5);
  const [overtimeSetting, setOvertimeSetting] = useState("");
  const [teamId, setTeamId] = useState(game.home_team_id);
  const [eventType, setEventType] = useState(EVENT_OPTIONS[game.sport][0][0]);
  const [periodNumber, setPeriodNumber] = useState(1);
  const [participantId, setParticipantId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [targetEventId, setTargetEventId] = useState("");
  const [forfeitReason, setForfeitReason] = useState("");
  const [forfeitWinner, setForfeitWinner] = useState(game.home_team_id);

  useEffect(() => { leaseRef.current = lease; }, [lease]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const activeSession = app.state.scorekeepingSessions.find((item) =>
    item.game_id === game.id && ["open", "drafting"].includes(item.status)
  );
  const sessionId = lease?.session_id || activeSession?.id;
  const participants = app.state.scorekeepingParticipants.filter((item) => item.session_id === sessionId);
  const events = useMemo(
    () => app.state.scorekeepingEvents.filter((item) => item.game_id === game.id),
    [app.state.scorekeepingEvents, game.id]
  );
  const voided = useMemo(() => new Set(events.filter((item) => item.action === "void").map((item) => item.voids_event_id)), [events]);
  const effectiveEvents = events.filter((item) => ["record", "replace"].includes(item.action) && !voided.has(item.id));
  const draft = effectiveEvents.reduce((score, item) => ({
    ...score,
    [item.credited_team_id === game.home_team_id ? "home" : "away"]:
      score[item.credited_team_id === game.home_team_id ? "home" : "away"] + Number(item.points || 0),
  }), { home: 0, away: 0 });
  const option = EVENT_OPTIONS[game.sport].find(([value]) => value === eventType) || EVENT_OPTIONS[game.sport][0];
  const teamParticipants = participants.filter((item) => item.team_id === teamId);

  useEffect(() => {
    if (!lease) return undefined;
    const timer = window.setInterval(async () => {
      if (heartbeatBusy.current || !leaseRef.current) return;
      heartbeatBusy.current = true;
      try {
        const renewed = await app.renewScorekeepingSession(leaseRef.current);
        if (mounted.current) setLease((current) => ({ ...current, ...renewed }));
      } catch {
        if (mounted.current) setLease(null);
      } finally {
        heartbeatBusy.current = false;
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [app, lease]);

  const run = async (work) => {
    setBusy(true);
    try { return await work(); } finally { if (mounted.current) setBusy(false); }
  };

  const start = () => run(async () => {
    const next = await app.startScorekeepingSession({
      game_id: game.id, rule_version: ruleVersion, regulation_period_count: periodCount,
      overtime_start_setting: overtimeSetting, rules_snapshot: { captured_by: "score-entry", version: ruleVersion },
    });
    setLease(next);
    toast.success("Live scorekeeping started");
  }).catch((error) => toast.error(error.message));

  const resume = () => run(async () => {
    const next = await app.resumeScorekeepingSession(activeSession.id, "Resume after reload");
    setLease(next);
    toast.success("Scorekeeping lease restored");
  }).catch((error) => toast.error(error.message));

  const attribution = (statKey) => participantId ? [{ participant_id: participantId, role: "primary", stat_key: statKey, stat_delta: 1 }] : [];
  const record = () => run(async () => {
    if (!participantId) throw new Error("Select the player credited with this event.");
    await app.appendScorekeepingEvent({ lease, command: {
      idempotency_key: operationKey(), action: "record", event_type: option[0], period_type: "regulation",
      period_number: Number(periodNumber), credited_team_id: teamId, points: option[2], attributions: attribution(option[3]),
    } });
    toast.success(`${option[1]} recorded`);
  }).catch((error) => toast.error(error.message));

  const correct = (replace) => run(async () => {
    if (!targetEventId) throw new Error("Select an effective event to correct.");
    if (replace) {
      if (!participantId) throw new Error("Select the player credited with the replacement.");
      await app.replaceScorekeepingEvent({ lease, target_event_id: targetEventId, command: {
        void_idempotency_key: operationKey(), replacement_idempotency_key: operationKey(),
        event_type: option[0], period_type: "regulation",
        period_number: Number(periodNumber), credited_team_id: teamId, points: option[2],
        attributions: attribution(option[3]),
      } });
    } else {
      await app.appendScorekeepingEvent({ lease, command: {
        idempotency_key: operationKey(), action: "void", event_type: "void", points: 0, voids_event_id: targetEventId,
      } });
    }
    setTargetEventId("");
    toast.success(replace ? "Event replaced" : "Event voided");
  }).catch((error) => toast.error(error.message));

  const finalize = () => run(async () => {
    await app.finalizeScorekeepingSession({ lease, idempotency_key: finalizationKey.current });
    toast.success(lease.session_kind === "correction" ? "Correction finalized" : "Final score published");
    navigate(`/game/${game.id}`);
  }).catch((error) => toast.error(error.message));

  const beginCorrection = () => run(async () => {
    if (!correctionReason.trim()) throw new Error("A correction reason is required.");
    const next = await app.startScorekeepingCorrection(game.id, correctionReason);
    setLease(next);
    toast.success("Audited correction draft opened");
  }).catch((error) => toast.error(error.message));

  const cancel = () => run(async () => {
    if (!cancelReason.trim()) throw new Error("A cancellation reason is required.");
    await app.cancelScorekeepingSession({ lease, reason: cancelReason });
    setLease(null);
    toast.success("Session canceled; published score unchanged");
  }).catch((error) => toast.error(error.message));

  const forfeit = () => run(async () => {
    if (!forfeitReason.trim()) throw new Error("A forfeit reason is required.");
    await app.declareLedgerForfeit({ game_id: game.id, winner_team_id: forfeitWinner, reason: forfeitReason, idempotency_key: operationKey() });
    toast.success("Forfeit recorded without a numerical score");
    navigate(`/game/${game.id}`);
  }).catch((error) => toast.error(error.message));

  if (isForfeitOutcome(game)) {
    const winner = getTeam(app.state, game.winner_team_id);
    return <div className="space-y-5 max-w-3xl mx-auto">
      <Button type="button" variant="ghost" onClick={onExit} className="gap-2"><ArrowLeft /> Back</Button>
      <Card><CardHeader><h1 className="text-2xl font-display font-bold">Final forfeit</h1></CardHeader>
        <CardContent className="space-y-2"><p className="font-semibold">{winner?.name || "Recorded winner"} · W</p>
          <p className="text-sm text-muted-foreground">This scoreless W/L outcome is final and locked. It cannot be reopened as an ordinary scorekeeping session.</p>
          {game.forfeit_reason ? <p className="text-sm">Reason: {game.forfeit_reason}</p> : null}
        </CardContent></Card>
    </div>;
  }

  if (game.locked && game.outcome_type === "played" && !activeSession && !lease) {
    return <div className="space-y-5 max-w-3xl mx-auto">
      <Button type="button" variant="ghost" onClick={onExit} className="gap-2"><ArrowLeft /> Back</Button>
      <Card><CardHeader><h1 className="text-2xl font-display font-bold">Correct final result</h1></CardHeader>
        <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">The published result remains unchanged until the replacement ledger finalizes.</p>
          <Label htmlFor="ledger-correction-reason">Required audit reason</Label>
          <Textarea id="ledger-correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
          <Button type="button" disabled={busy} onClick={beginCorrection}>Open correction draft</Button>
        </CardContent></Card></div>;
  }

  if (!lease) {
    return <div className="space-y-5 max-w-3xl mx-auto">
      <Button type="button" variant="ghost" onClick={onExit} className="gap-2"><ArrowLeft /> Back to aggregate entry</Button>
      <Card><CardHeader><div className="flex items-center gap-3"><Flag size={24} className="text-primary" /><div><h1 className="text-2xl font-display font-bold">Live event ledger</h1><p className="text-sm text-muted-foreground">{away.name} at {home.name}</p></div></div></CardHeader>
        <CardContent className="space-y-5">
          {activeSession ? <div className="rounded-xl border border-primary/30 bg-primary/10 p-4"><p className="font-semibold">An active session is waiting.</p><p className="text-sm text-muted-foreground mb-3">Restore a fresh lease after a reload or device handoff.</p><Button type="button" disabled={busy} onClick={resume} className="gap-2"><ArrowsClockwise /> Resume session</Button></div> : <>
            <div className="grid sm:grid-cols-2 gap-4"><div><Label htmlFor="ledger-rule-version">Rule version</Label><Input id="ledger-rule-version" value={ruleVersion} onChange={(event) => setRuleVersion(event.target.value)} /></div><div><Label htmlFor="ledger-period-count">Regulation {game.sport === "kickball" ? "innings" : "quarters"}</Label><Input id="ledger-period-count" type="number" min="1" value={periodCount} disabled={game.sport === "flag_football"} onChange={(event) => setPeriodCount(Number(event.target.value))} /></div></div>
            <div><Label htmlFor="ledger-overtime-setting">Overtime setting (competition snapshot)</Label><Input id="ledger-overtime-setting" value={overtimeSetting} onChange={(event) => setOvertimeSetting(event.target.value)} placeholder="Optional configured starting state" /></div>
            <Button type="button" disabled={busy} onClick={start} className="gap-2"><Plus /> Start live scorekeeping</Button>
          </>}
          {!activeSession && <div className="border-t pt-5 space-y-3"><h2 className="font-semibold">Record a forfeit</h2><div className="grid sm:grid-cols-2 gap-3"><Select value={forfeitWinner} onValueChange={setForfeitWinner}><SelectTrigger aria-label="Forfeit winner"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={game.home_team_id}>{home.name}</SelectItem><SelectItem value={game.away_team_id}>{away.name}</SelectItem></SelectContent></Select><Input value={forfeitReason} onChange={(event) => setForfeitReason(event.target.value)} placeholder="Required reason" /></div><Button type="button" variant="outline" disabled={busy} onClick={forfeit}>Declare forfeit</Button></div>}
        </CardContent></Card></div>;
  }

  return <div className="space-y-5 max-w-4xl mx-auto" data-testid="ledger-scorekeeper">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-micro uppercase tracking-widest text-primary font-bold">{lease.session_kind === "correction" ? "Correction draft" : "Live scorekeeping"}</p><h1 className="text-2xl sm:text-3xl font-display font-bold">{away.name} <span className="text-muted-foreground">{draft.away}</span> — <span className="text-muted-foreground">{draft.home}</span> {home.name}</h1></div><p className="text-xs text-muted-foreground">Lease v{lease.lease_version}</p></div>
    <Card><CardContent className="pt-6 space-y-4"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><div><Label>Team</Label><Select value={teamId} onValueChange={(value) => { setTeamId(value); setParticipantId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={game.home_team_id}>{home.name}</SelectItem><SelectItem value={game.away_team_id}>{away.name}</SelectItem></SelectContent></Select></div><div><Label>Event</Label><Select value={eventType} onValueChange={setEventType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVENT_OPTIONS[game.sport].map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="ledger-period">Period</Label><Input id="ledger-period" type="number" min="1" value={periodNumber} onChange={(event) => setPeriodNumber(Number(event.target.value))} /></div><div><Label>Player</Label><Select value={participantId} onValueChange={setParticipantId}><SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger><SelectContent>{teamParticipants.map((player) => <SelectItem key={player.id} value={player.id}>{player.display_name}</SelectItem>)}</SelectContent></Select></div></div>
      {lease.session_kind === "ordinary" ? <Button type="button" disabled={busy} onClick={record} className="gap-2"><Plus /> Record event</Button> : <div className="space-y-3"><Label>Effective event to correct</Label><Select value={targetEventId} onValueChange={setTargetEventId}><SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger><SelectContent>{effectiveEvents.map((item) => <SelectItem key={item.id} value={item.id}>#{item.sequence_number} · {item.event_type} · {item.points} pt</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => correct(false)} className="gap-2"><Prohibit /> Void only</Button><Button type="button" disabled={busy} onClick={() => correct(true)} className="gap-2"><ArrowsClockwise /> Void and replace</Button></div></div>}
    </CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">Immutable event log</h2></CardHeader><CardContent><ol className="space-y-2">{events.map((item) => <li key={item.id} className="flex justify-between gap-4 text-sm border-b border-border/60 pb-2"><span>#{item.sequence_number} · {item.action} {item.event_type}</span><span className={voided.has(item.id) ? "line-through text-muted-foreground" : "font-mono"}>{item.points} pt</span></li>)}</ol></CardContent></Card>
    <div className="flex flex-col sm:flex-row gap-3 sm:justify-between"><div className="flex gap-2"><Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason required to cancel" /><Button type="button" variant="outline" disabled={busy} onClick={cancel}>Cancel session</Button></div><Button type="button" disabled={busy || effectiveEvents.length === 0} onClick={finalize} className="gap-2"><CheckCircle /> {lease.session_kind === "correction" ? "Publish correction" : "Finalize score"}</Button></div>
  </div>;
}
