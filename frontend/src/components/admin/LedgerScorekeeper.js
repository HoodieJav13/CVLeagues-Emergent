import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowsClockwise, CheckCircle, Flag, Plus, Prohibit } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "../../context/AppStateContext";
import {
  LEDGER_EVENT_OPTIONS,
  buildLedgerEventCommand,
  createLedgerOperationKeys,
} from "../../lib/ledgerScoring";
import { getTeam, isForfeitOutcome } from "../../lib/selectors";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

export function LedgerScorekeeper({ game, onExit }) {
  const app = useApp();
  const navigate = useNavigate();
  const home = getTeam(app.state, game.home_team_id);
  const away = getTeam(app.state, game.away_team_id);
  const [lease, setLease] = useState(null);
  const leaseRef = useRef(null);
  const heartbeatBusy = useRef(false);
  const mounted = useRef(true);
  const operationKeys = useRef(createLedgerOperationKeys());
  const [busy, setBusy] = useState(false);
  const [ruleVersion, setRuleVersion] = useState("CVF-2026.1");
  const [periodCount, setPeriodCount] = useState(game.sport === "flag_football" ? 4 : 5);
  const [overtimeSetting, setOvertimeSetting] = useState("");
  const [teamId, setTeamId] = useState(game.home_team_id);
  const [eventType, setEventType] = useState(LEDGER_EVENT_OPTIONS[game.sport][0].id);
  const [periodType, setPeriodType] = useState("regulation");
  const [periodNumber, setPeriodNumber] = useState(1);
  const [participantId, setParticipantId] = useState("");
  const [counterpartParticipantId, setCounterpartParticipantId] = useState("");
  const [yardDelta, setYardDelta] = useState(0);
  const [pairingOverrideReason, setPairingOverrideReason] = useState("");
  const [finalizationOverrideReason, setFinalizationOverrideReason] = useState("");
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
  const draft = effectiveEvents.reduce((score, item) => {
    if (!item.credited_team_id) return score;
    const side = item.credited_team_id === game.home_team_id ? "home" : "away";
    return { ...score, [side]: score[side] + Number(item.points || 0) };
  }, { home: 0, away: 0 });
  const option = LEDGER_EVENT_OPTIONS[game.sport].find((item) => item.id === eventType)
    || LEDGER_EVENT_OPTIONS[game.sport][0];
  const teamParticipants = participants.filter((item) => item.team_id === teamId);
  const otherTeamId = teamId === game.home_team_id ? game.away_team_id : game.home_team_id;
  const counterpartParticipants = participants.filter((item) =>
    item.team_id === (option.mode === "interception" ? otherTeamId : teamId)
  );
  const pairedEvent = ["completion", "passingTouchdown", "interception"].includes(option.mode);

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

  const buildCommand = () => buildLedgerEventCommand({
    option,
    periodType,
    periodNumber,
    creditedTeamId: teamId,
    primaryParticipantId: participantId,
    counterpartParticipantId,
    yardDelta,
    pairingOverrideReason,
  });

  const record = () => run(async () => {
    const command = buildCommand();
    const idempotencyKey = operationKeys.current.claim("record", command);
    await app.appendScorekeepingEvent({
      lease,
      command: { ...command, idempotency_key: idempotencyKey },
    });
    operationKeys.current.clear("record");
    setPairingOverrideReason("");
    toast.success(option.mode === "periodClose" ? "Overtime period closed" : `${option.label} recorded`);
  }).catch((error) => toast.error(error.message));

  const correct = (replace) => run(async () => {
    if (!targetEventId) throw new Error("Select an effective event to correct.");
    if (replace) {
      const command = buildCommand();
      const signature = { target_event_id: targetEventId, command };
      const voidKey = operationKeys.current.claim("correction-void", signature);
      const replacementKey = operationKeys.current.claim("correction-replacement", signature);
      await app.replaceScorekeepingEvent({
        lease,
        target_event_id: targetEventId,
        command: {
          ...command,
          void_idempotency_key: voidKey,
          replacement_idempotency_key: replacementKey,
        },
      });
      operationKeys.current.clear("correction-void");
      operationKeys.current.clear("correction-replacement");
    } else {
      const command = {
        action: "void",
        event_type: "void",
        points: 0,
        voids_event_id: targetEventId,
      };
      const idempotencyKey = operationKeys.current.claim("correction-void-only", command);
      await app.appendScorekeepingEvent({
        lease,
        command: { ...command, idempotency_key: idempotencyKey },
      });
      operationKeys.current.clear("correction-void-only");
    }
    setTargetEventId("");
    toast.success(replace ? "Event replaced" : "Event voided");
  }).catch((error) => toast.error(error.message));

  const finalize = () => run(async () => {
    const finalizationPayload = {
      session_id: lease.session_id,
      effective_event_ids: effectiveEvents.map((item) => item.id),
      override_reason: finalizationOverrideReason.trim() || null,
    };
    const finalizationKey = operationKeys.current.claim("finalize", finalizationPayload);
    const result = await app.finalizeScorekeepingSession({
      lease,
      idempotency_key: finalizationKey,
      override_reason: finalizationOverrideReason,
    });
    if (["continue_overtime", "overtime_period_open"].includes(result?.status)) {
      operationKeys.current.clear("finalize");
      setPeriodType("overtime");
      setPeriodNumber(Number(result.next_overtime_period || result.overtime_period || 1));
      toast.info(result.message || "Overtime continues.");
      return;
    }
    operationKeys.current.clear("finalize");
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
    const command = {
      game_id: game.id,
      winner_team_id: forfeitWinner,
      reason: forfeitReason.trim(),
    };
    const idempotencyKey = operationKeys.current.claim("forfeit", command);
    await app.declareLedgerForfeit({ ...command, idempotency_key: idempotencyKey });
    operationKeys.current.clear("forfeit");
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Record the next play</h2>
            <p className="text-sm text-muted-foreground">Overtime closes only when you record the explicit period-close event.</p>
          </div>
          {periodType === "overtime" ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">OT {periodNumber}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Period type</Label>
            <Select value={periodType} onValueChange={(value) => {
              setPeriodType(value);
              if (value === "regulation" && option.mode === "periodClose") {
                setEventType(LEDGER_EVENT_OPTIONS[game.sport][0].id);
              }
            }}>
              <SelectTrigger aria-label="Period type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regulation">Regulation</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ledger-period">{periodType === "overtime" ? "OT period" : game.sport === "kickball" ? "Inning" : "Quarter"}</Label>
            <Input id="ledger-period" type="number" min="1" value={periodNumber} onChange={(event) => setPeriodNumber(Number(event.target.value))} />
          </div>
          <div>
            <Label>Event</Label>
            <Select value={eventType} onValueChange={(value) => {
              setEventType(value);
              setParticipantId("");
              setCounterpartParticipantId("");
              setPairingOverrideReason("");
              const next = LEDGER_EVENT_OPTIONS[game.sport].find((item) => item.id === value);
              if (next?.mode === "periodClose") setPeriodType("overtime");
            }}>
              <SelectTrigger aria-label="Ledger event"><SelectValue /></SelectTrigger>
              <SelectContent>{LEDGER_EVENT_OPTIONS[game.sport].map((item) =>
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              )}</SelectContent>
            </Select>
          </div>
          {option.mode !== "periodClose" ? <div>
            <Label>Credited team</Label>
            <Select value={teamId} onValueChange={(value) => {
              setTeamId(value);
              setParticipantId("");
              setCounterpartParticipantId("");
            }}>
              <SelectTrigger aria-label="Credited team"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={game.home_team_id}>{home.name}</SelectItem>
                <SelectItem value={game.away_team_id}>{away.name}</SelectItem>
              </SelectContent>
            </Select>
          </div> : <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
            <p className="font-semibold">Admin completion signal</p>
            <p className="text-muted-foreground">No team or player is credited.</p>
          </div>}
        </div>

        {option.mode !== "periodClose" ? <div className={`grid gap-3 ${pairedEvent ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
          <div>
            <Label>{option.mode === "interception" ? "Interceptor" : ["completion", "passingTouchdown"].includes(option.mode) ? "Passer" : "Player"}</Label>
            <Select value={participantId} onValueChange={setParticipantId}>
              <SelectTrigger aria-label="Primary player"><SelectValue placeholder="Select player" /></SelectTrigger>
              <SelectContent>{teamParticipants.map((player) =>
                <SelectItem key={player.id} value={player.id}>{player.display_name}</SelectItem>
              )}</SelectContent>
            </Select>
          </div>
          {pairedEvent ? <div>
            <Label>{option.mode === "interception" ? "Opposing passer" : "Receiver"}</Label>
            <Select value={counterpartParticipantId} onValueChange={setCounterpartParticipantId}>
              <SelectTrigger aria-label="Paired player"><SelectValue placeholder="Select paired player" /></SelectTrigger>
              <SelectContent>{counterpartParticipants.map((player) =>
                <SelectItem key={player.id} value={player.id}>{player.display_name}</SelectItem>
              )}</SelectContent>
            </Select>
          </div> : null}
        </div> : null}

        {option.mode === "completion" ? <div className="max-w-xs">
          <Label htmlFor="ledger-yards">Completed-pass yards</Label>
          <Input id="ledger-yards" type="number" value={yardDelta} onChange={(event) => setYardDelta(Number(event.target.value))} />
          <p className="mt-1 text-xs text-muted-foreground">Negative yardage is allowed and is mirrored to passer and receiver.</p>
        </div> : null}

        {pairedEvent ? <div className="rounded-xl border border-border/70 bg-muted/25 p-4 space-y-2">
          <Label htmlFor="ledger-pairing-override">Paired-stat exception reason</Label>
          <Textarea
            id="ledger-pairing-override"
            value={pairingOverrideReason}
            onChange={(event) => setPairingOverrideReason(event.target.value)}
            placeholder="Required only when the paired player cannot be recorded"
          />
          <p className="text-xs text-muted-foreground">Each exception is attached immutably to this event and will surface again at finalization.</p>
        </div> : null}

        {lease.session_kind === "ordinary" ? <Button type="button" disabled={busy} onClick={record} className="gap-2">
          <Plus /> {option.mode === "periodClose" ? `Close OT ${periodNumber}` : "Record event"}
        </Button> : <div className="space-y-3">
          <Label>Effective event to correct</Label>
          <Select value={targetEventId} onValueChange={setTargetEventId}>
            <SelectTrigger aria-label="Effective event to correct"><SelectValue placeholder="Select event" /></SelectTrigger>
            <SelectContent>{effectiveEvents.map((item) =>
              <SelectItem key={item.id} value={item.id}>#{item.sequence_number} · {item.event_type} · {item.points} pt</SelectItem>
            )}</SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => correct(false)} className="gap-2"><Prohibit /> Void only</Button>
            <Button type="button" disabled={busy} onClick={() => correct(true)} className="gap-2"><ArrowsClockwise /> Void and replace</Button>
          </div>
        </div>}
      </CardContent>
    </Card>
    <Card><CardHeader><h2 className="font-semibold">Immutable event log</h2></CardHeader><CardContent><ol className="space-y-2">{events.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-3 text-sm border-b border-border/60 pb-2"><span>#{item.sequence_number} · {item.action} {item.event_type} · {item.period_type === "overtime" ? `OT ${item.period_number}` : `P${item.period_number || "—"}`}{item.pairing_override_reason ? " · paired-stat override" : ""}</span><span className={voided.has(item.id) ? "line-through text-muted-foreground" : "font-mono"}>{item.points} pt</span></li>)}</ol></CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">Finish or leave the session</h2></CardHeader><CardContent className="space-y-4">
      <div>
        <Label htmlFor="ledger-finalization-override">Final validation override reason</Label>
        <Textarea id="ledger-finalization-override" value={finalizationOverrideReason} onChange={(event) => setFinalizationOverrideReason(event.target.value)} placeholder="Required when the projection reports a soft warning" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-72"><Label htmlFor="ledger-cancel-reason">Cancellation reason</Label><Input id="ledger-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Required to cancel" /></div>
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>Cancel session</Button>
        </div>
        <Button type="button" disabled={busy || effectiveEvents.length === 0} onClick={finalize} className="gap-2">
          <CheckCircle /> {lease.session_kind === "correction" ? "Publish correction" : "Evaluate final score"}
        </Button>
      </div>
    </CardContent></Card>
  </div>;
}
