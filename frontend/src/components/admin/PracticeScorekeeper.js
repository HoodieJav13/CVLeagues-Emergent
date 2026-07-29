import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowsClockwise, CheckCircle, Flag, Plus, Prohibit } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../../context/AppStateContext";
import {
  LEDGER_EVENT_OPTIONS,
  buildLedgerEventCommand,
  createLedgerOperationKeys,
} from "../../lib/ledgerScoring";
import { practiceChainEvents, practiceEffectiveEvents } from "../../lib/practiceLedger";
import { getTeam } from "../../lib/selectors";
import { statLabel } from "../../lib/statsConfig";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

/* ============================================================================
 * PracticeScorekeeper — a no-consequence rehearsal of the event ledger.
 * ----------------------------------------------------------------------------
 * A deliberate sibling of LedgerScorekeeper rather than a mode of it: the
 * shared scoring logic already lives in lib/ledgerScoring.js, and everything
 * game-bound about the official surface (game prop, forfeits, the locked-game
 * correction entry, navigation to /game/:id) does not exist here. Practice
 * sessions have game_id null; their evidence lives only in the private
 * scorekeeping collections, and finalization RETURNS a projection preview
 * instead of publishing anything.
 * ========================================================================== */

// The always-visible register: practice must never be mistaken for scoring.
const PracticeChip = () => (
  <span
    data-testid="practice-chip"
    className="inline-flex items-center rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-micro font-bold uppercase tracking-widest text-gold"
  >
    PRACTICE — no consequences
  </span>
);

export function PracticeScorekeeper({ onExit }) {
  const app = useApp();
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [ruleVersion, setRuleVersion] = useState("CVF-2026.1");
  const [periodCount, setPeriodCount] = useState(5);
  const [overtimeSetting, setOvertimeSetting] = useState("");
  const [lease, setLease] = useState(null);
  const leaseRef = useRef(null);
  const heartbeatBusy = useRef(false);
  const mounted = useRef(true);
  const operationKeys = useRef(createLedgerOperationKeys());
  const [busy, setBusy] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [eventType, setEventType] = useState("");
  const [periodType, setPeriodType] = useState("regulation");
  const [periodNumber, setPeriodNumber] = useState(1);
  const [participantId, setParticipantId] = useState("");
  const [counterpartParticipantId, setCounterpartParticipantId] = useState("");
  const [yardDelta, setYardDelta] = useState(0);
  const [pairingOverrideReason, setPairingOverrideReason] = useState("");
  const [finalizationOverrideReason, setFinalizationOverrideReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [targetEventId, setTargetEventId] = useState("");
  const [preview, setPreview] = useState(null);
  const [correctionReason, setCorrectionReason] = useState("");

  useEffect(() => { leaseRef.current = lease; }, [lease]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const session = app.state.scorekeepingSessions.find((item) => item.id === lease?.session_id);
  const previewSession = app.state.scorekeepingSessions.find((item) => item.id === preview?.session_id);
  const activePractice = app.state.scorekeepingSessions.find((item) =>
    item.session_kind === "practice" && item.game_id == null && item.status === "open"
  );

  const teamEntries = useMemo(
    () => app.state.teams
      .map((team) => ({ team, league: app.state.leagues.find((league) => league.id === team.league_id) }))
      .filter((entry) => entry.league && entry.team.status !== "archived"),
    [app.state.teams, app.state.leagues]
  );
  const homeEntry = teamEntries.find((entry) => entry.team.id === homeTeamId);
  const awayEntries = homeEntry
    ? teamEntries.filter((entry) =>
        entry.team.id !== homeTeamId
        && entry.league.sport === homeEntry.league.sport
        && entry.league.season === homeEntry.league.season)
    : [];

  const scopeSession = session || previewSession;
  const sport = scopeSession?.sport || homeEntry?.league.sport || "kickball";
  const eventOptions = LEDGER_EVENT_OPTIONS[sport];
  const option = eventOptions.find((item) => item.id === eventType) || eventOptions[0];
  // The session row is authoritative once fetched; the picker selections keep
  // the surface coherent in the window between start and the state refresh.
  const homeId = scopeSession?.home_team_id || homeTeamId;
  const awayId = scopeSession?.away_team_id || awayTeamId;
  const home = getTeam(app.state, homeId) || homeEntry?.team;
  const away = getTeam(app.state, awayId);

  const sessionId = lease?.session_id || null;
  const participants = app.state.scorekeepingParticipants.filter((item) => item.session_id === sessionId);
  const events = useMemo(
    () => (sessionId ? practiceChainEvents(app.state, sessionId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.state.scorekeepingEvents, app.state.scorekeepingSessions, sessionId]
  );
  const voided = useMemo(() => new Set(events.filter((item) => item.action === "void").map((item) => item.voids_event_id)), [events]);
  const effectiveEvents = sessionId ? practiceEffectiveEvents(app.state, sessionId) : [];
  const draft = effectiveEvents.reduce((score, item) => {
    if (!item.credited_team_id) return score;
    const side = item.credited_team_id === homeId ? "home" : "away";
    return { ...score, [side]: score[side] + Number(item.points || 0) };
  }, { home: 0, away: 0 });
  const isCorrection = Boolean(lease?.practice_correction || session?.base_session_id);
  const teamParticipants = participants.filter((item) => item.team_id === teamId);
  const otherTeamId = teamId === homeId ? awayId : homeId;
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
        const renewed = await app.renewPracticeSession(leaseRef.current);
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

  const adoptLease = (next) => {
    setLease(next);
    setPreview(null);
    setTeamId((current) => current || homeTeamId || "");
    setEventType("");
    setTargetEventId("");
  };

  const start = () => run(async () => {
    if (!homeEntry || !awayTeamId) throw new Error("Pick two teams from the same sport and league season.");
    const regulationCount = sport === "flag_football" ? 4 : periodCount;
    const next = await app.startPracticeSession({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      rule_version: ruleVersion,
      regulation_period_count: regulationCount,
      overtime_start_setting: overtimeSetting,
      rules_snapshot: { captured_by: "practice-mode", version: ruleVersion },
    });
    adoptLease(next);
    setTeamId(homeTeamId);
    toast.success("Practice session started — nothing here publishes");
  }).catch((error) => toast.error(error.message));

  const resume = () => run(async () => {
    const next = await app.resumePracticeSession(activePractice.id, "Resume practice after reload");
    setHomeTeamId(activePractice.home_team_id);
    setAwayTeamId(activePractice.away_team_id);
    adoptLease(next);
    setTeamId(activePractice.home_team_id);
    toast.success("Practice lease restored");
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
    const idempotencyKey = operationKeys.current.claim("practice-record", command);
    await app.appendPracticeEvent({ lease, command: { ...command, idempotency_key: idempotencyKey } });
    operationKeys.current.clear("practice-record");
    setPairingOverrideReason("");
    toast.success(option.mode === "periodClose" ? "Overtime period closed" : `${option.label} recorded`);
  }).catch((error) => toast.error(error.message));

  // Practice corrections void/replace through append_practice_event: a void
  // event first, then (for replace) a replacement referencing the original.
  const correct = (replace) => run(async () => {
    if (!targetEventId) throw new Error("Select an effective event to correct.");
    const voidCommand = { action: "void", event_type: "void", points: 0, voids_event_id: targetEventId };
    const voidKey = operationKeys.current.claim("practice-void", voidCommand);
    await app.appendPracticeEvent({ lease, command: { ...voidCommand, idempotency_key: voidKey } });
    operationKeys.current.clear("practice-void");
    if (replace) {
      const replacement = { ...buildCommand(), action: "replace", replaces_event_id: targetEventId };
      const replacementKey = operationKeys.current.claim("practice-replacement", replacement);
      await app.appendPracticeEvent({ lease, command: { ...replacement, idempotency_key: replacementKey } });
      operationKeys.current.clear("practice-replacement");
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
    const finalizationKey = operationKeys.current.claim("practice-finalize", finalizationPayload);
    const result = await app.finalizePracticeSession({
      lease,
      idempotency_key: finalizationKey,
      override_reason: finalizationOverrideReason,
    });
    if (["continue_overtime", "overtime_period_open"].includes(result?.status)) {
      operationKeys.current.clear("practice-finalize");
      setPeriodType("overtime");
      setPeriodNumber(Number(result.next_overtime_period || result.overtime_period || 1));
      toast.info(result.message || "Overtime continues.");
      return;
    }
    operationKeys.current.clear("practice-finalize");
    setPreview(result);
    setLease(null);
    setFinalizationOverrideReason("");
    toast.success("Projection preview ready — nothing was published");
  }).catch((error) => toast.error(error.message));

  const rehearseCorrection = () => run(async () => {
    if (!correctionReason.trim()) throw new Error("A correction reason is required.");
    const next = await app.startPracticeCorrection(preview.session_id, correctionReason);
    adoptLease(next);
    setCorrectionReason("");
    toast.success("Practice correction opened — void or replace effective events");
  }).catch((error) => toast.error(error.message));

  const cancel = () => run(async () => {
    if (!cancelReason.trim()) throw new Error("A cancellation reason is required.");
    await app.cancelPracticeSession({ lease, reason: cancelReason });
    setLease(null);
    setCancelReason("");
    toast.success("Practice session canceled");
  }).catch((error) => toast.error(error.message));

  const playerName = (profile_id) =>
    app.state.profiles.find((item) => item.id === profile_id)?.name
    || app.state.scorekeepingParticipants.find((item) => item.profile_id === profile_id)?.display_name
    || "Player";

  /* ----------------------- projection preview ---------------------------- */
  if (preview) {
    const previewHome = getTeam(app.state, previewSession?.home_team_id);
    const previewAway = getTeam(app.state, previewSession?.away_team_id);
    const statRows = Object.entries(preview.projection?.player_stats || {});
    return <div className="space-y-5 max-w-4xl mx-auto" data-testid="practice-scorekeeper">
      <Button type="button" variant="ghost" onClick={onExit} className="gap-2"><ArrowLeft /> Back to score entry</Button>
      <div className="flex flex-wrap items-center gap-3"><PracticeChip /><p className="text-xs text-muted-foreground">Session {preview.session_id}</p></div>
      <Card data-testid="practice-projection-preview">
        <CardHeader>
          <h1 className="text-2xl font-display font-bold">Projection preview</h1>
          <p className="text-sm text-muted-foreground">Computed from the practice ledger and returned only to this screen. No game, standing, or stat total changed.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xl font-display font-bold">
            {previewAway?.name || "Away"} <span className="font-mono-score">{preview.away_score}</span>
            {" — "}
            <span className="font-mono-score">{preview.home_score}</span> {previewHome?.name || "Home"}
          </p>
          {Array.isArray(preview.warnings) && preview.warnings.length > 0 ? <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 space-y-1">
            {preview.warnings.map((item, index) => <p key={index} className="text-sm text-foreground">{item.message}</p>)}
          </div> : null}
          {statRows.length > 0 ? <ul className="space-y-1">
            {statRows.map(([profileId, row]) => <li key={profileId} className="flex flex-wrap justify-between gap-3 text-sm border-b border-border/60 pb-1">
              <span className="font-medium">{playerName(profileId)}</span>
              <span className="text-muted-foreground tabular-nums">
                {Object.entries(row.stats || {}).map(([key, value]) => `${value} ${statLabel(sport, key)}`).join(" · ")}
              </span>
            </li>)}
          </ul> : <p className="text-sm text-muted-foreground">No player statistics were attributed.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Rehearse a correction</h2></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Opens a new practice session over this finalized rehearsal with void and replace enabled — the same correction contract as an official ledger game.</p>
          <Label htmlFor="practice-correction-reason">Correction reason (required)</Label>
          <Textarea id="practice-correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
          <Button type="button" disabled={busy} onClick={rehearseCorrection} className="gap-2"><ArrowsClockwise /> Rehearse a correction</Button>
        </CardContent>
      </Card>
    </div>;
  }

  /* --------------------------- session setup ----------------------------- */
  if (!lease) {
    return <div className="space-y-5 max-w-3xl mx-auto" data-testid="practice-scorekeeper">
      <Button type="button" variant="ghost" onClick={onExit} className="gap-2"><ArrowLeft /> Back to score entry</Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3"><Flag size={24} className="text-gold" /><div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-display font-bold">Practice ledger</h1><PracticeChip /></div>
            <p className="text-sm text-muted-foreground">A full rehearsal of live scorekeeping — signed yards, overtime closes, corrections — with no game and no published output.</p>
          </div></div>
        </CardHeader>
        <CardContent className="space-y-5">
          {activePractice ? <div className="rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="font-semibold">An active practice session is waiting.</p>
            <p className="text-sm text-muted-foreground mb-3">Restore a fresh lease after a reload or device handoff.</p>
            <Button type="button" disabled={busy} onClick={resume} className="gap-2"><ArrowsClockwise /> Resume practice session</Button>
          </div> : <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Home team</Label>
                <Select value={homeTeamId} onValueChange={(value) => { setHomeTeamId(value); setAwayTeamId(""); }}>
                  <SelectTrigger aria-label="Practice home team" data-testid="practice-home-team"><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>{teamEntries.map((entry) =>
                    <SelectItem key={entry.team.id} value={entry.team.id}>{entry.team.name} · {entry.league.season}</SelectItem>
                  )}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Away team (same sport + league season)</Label>
                <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                  <SelectTrigger aria-label="Practice away team" data-testid="practice-away-team"><SelectValue placeholder="Select opponent" /></SelectTrigger>
                  <SelectContent>{awayEntries.map((entry) =>
                    <SelectItem key={entry.team.id} value={entry.team.id}>{entry.team.name} · {entry.league.season}</SelectItem>
                  )}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label htmlFor="practice-rule-version">Rule version</Label><Input id="practice-rule-version" value={ruleVersion} onChange={(event) => setRuleVersion(event.target.value)} /></div>
              <div><Label htmlFor="practice-period-count">Regulation {sport === "kickball" ? "innings" : "quarters"}</Label><Input id="practice-period-count" type="number" min="1" value={sport === "flag_football" ? 4 : periodCount} disabled={sport === "flag_football"} onChange={(event) => setPeriodCount(Number(event.target.value))} /></div>
            </div>
            <div><Label htmlFor="practice-overtime-setting">Overtime setting (competition snapshot)</Label><Input id="practice-overtime-setting" value={overtimeSetting} onChange={(event) => setOvertimeSetting(event.target.value)} placeholder="Optional configured starting state" /></div>
            <Button type="button" disabled={busy} onClick={start} className="gap-2"><Plus /> Start practice session</Button>
          </>}
        </CardContent>
      </Card>
    </div>;
  }

  /* --------------------------- active session ---------------------------- */
  return <div className="space-y-5 max-w-4xl mx-auto" data-testid="practice-scorekeeper">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1"><PracticeChip /><p className="text-micro uppercase tracking-widest text-primary font-bold">{isCorrection ? "Practice correction" : "Practice scorekeeping"}</p></div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">{away?.name} <span className="text-muted-foreground">{draft.away}</span> — <span className="text-muted-foreground">{draft.home}</span> {home?.name}</h1>
      </div>
      <p className="text-xs text-muted-foreground">Lease v{lease.lease_version}</p>
    </div>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{isCorrection ? "Void or replace an effective event" : "Record the next play"}</h2>
            <p className="text-sm text-muted-foreground">Identical ledger rules — overtime closes only through the explicit period-close event.</p>
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
              if (value === "regulation" && option.mode === "periodClose") setEventType(eventOptions[0].id);
            }}>
              <SelectTrigger aria-label="Period type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regulation">Regulation</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="practice-period">{periodType === "overtime" ? "OT period" : sport === "kickball" ? "Inning" : "Quarter"}</Label>
            <Input id="practice-period" type="number" min="1" value={periodNumber} onChange={(event) => setPeriodNumber(Number(event.target.value))} />
          </div>
          <div>
            <Label>Event</Label>
            <Select value={option.id} onValueChange={(value) => {
              setEventType(value);
              setParticipantId("");
              setCounterpartParticipantId("");
              setPairingOverrideReason("");
              const next = eventOptions.find((item) => item.id === value);
              if (next?.mode === "periodClose") setPeriodType("overtime");
            }}>
              <SelectTrigger aria-label="Practice event"><SelectValue /></SelectTrigger>
              <SelectContent>{eventOptions.map((item) =>
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
                <SelectItem value={homeId}>{home?.name}</SelectItem>
                <SelectItem value={awayId}>{away?.name}</SelectItem>
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

        {["completion", "rush"].includes(option.mode) ? <div className="max-w-xs">
          <Label htmlFor="practice-yards">{option.mode === "rush" ? "Rushing yards (signed)" : "Completed-pass yards"}</Label>
          <Input id="practice-yards" type="number" data-testid="practice-yards" value={yardDelta} onChange={(event) => setYardDelta(Number(event.target.value))} />
          <p className="mt-1 text-xs text-muted-foreground">
            {option.mode === "rush"
              ? "Negative yardage is allowed — a carry can lose ground."
              : "Negative yardage is allowed and is mirrored to passer and receiver."}
          </p>
        </div> : null}

        {pairedEvent ? <div className="rounded-xl border border-border/70 bg-muted/25 p-4 space-y-2">
          <Label htmlFor="practice-pairing-override">Paired-stat exception reason</Label>
          <Textarea
            id="practice-pairing-override"
            value={pairingOverrideReason}
            onChange={(event) => setPairingOverrideReason(event.target.value)}
            placeholder="Required only when the paired player cannot be recorded"
          />
          <p className="text-xs text-muted-foreground">Practice rehearses the identical paired-stat exception contract.</p>
        </div> : null}

        {!isCorrection ? <Button type="button" disabled={busy} onClick={record} className="gap-2">
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
    <Card><CardHeader><h2 className="font-semibold">Practice event log</h2></CardHeader><CardContent><ol className="space-y-2">{events.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-3 text-sm border-b border-border/60 pb-2"><span>#{item.sequence_number} · {item.action} {item.event_type} · {item.period_type === "overtime" ? `OT ${item.period_number}` : `P${item.period_number || "—"}`}{item.pairing_override_reason ? " · paired-stat override" : ""}</span><span className={voided.has(item.id) ? "line-through text-muted-foreground" : "font-mono"}>{item.points} pt</span></li>)}</ol></CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">Finish or leave the rehearsal</h2></CardHeader><CardContent className="space-y-4">
      <div>
        <Label htmlFor="practice-finalization-override">Final validation override reason</Label>
        <Textarea id="practice-finalization-override" value={finalizationOverrideReason} onChange={(event) => setFinalizationOverrideReason(event.target.value)} placeholder="Required when the projection reports a soft warning" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-72"><Label htmlFor="practice-cancel-reason">Cancellation reason</Label><Input id="practice-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Required to cancel" /></div>
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>Cancel session</Button>
        </div>
        <Button type="button" disabled={busy || effectiveEvents.length === 0} onClick={finalize} className="gap-2">
          <CheckCircle /> Evaluate practice projection
        </Button>
      </div>
    </CardContent></Card>
  </div>;
}
