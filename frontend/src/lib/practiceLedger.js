/* ============================================================================
 * Practice-mode ledger helpers (Migration 30, Sequence 5B).
 * ----------------------------------------------------------------------------
 * Two jobs, one module:
 *
 * 1. Chain/projection selectors shared by the PracticeScorekeeper UI in BOTH
 *    modes: a practice correction is a NEW session referencing its finalized
 *    base, so score/effective-event reads must walk the base_session_id chain
 *    instead of filtering by game_id (practice sessions have game_id null).
 *
 * 2. Pure mock-mode implementations mirroring the VISIBLE outcomes of the
 *    seven hosted practice RPCs. Mock practice never touches games,
 *    playerStats, or edit history — exactly like the hosted RPCs, whose only
 *    writes are the four private scorekeeping tables. Lease tokens, hashing,
 *    idempotency replay, and advisory locking are backend internals and are
 *    deliberately not emulated.
 *
 * Every mock function takes the previous app state and returns
 * { next, result } so AppStateContext can apply it inside one setState.
 * ========================================================================== */

export const PRACTICE_MOCK_LEASE_TOKEN = "mock-practice-lease";

const leaseFor = (session) => ({
  session_id: session.id,
  lease_token: PRACTICE_MOCK_LEASE_TOKEN,
  lease_version: session.lease_version,
  lease_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  session_kind: "practice",
  ...(session.base_session_id
    ? { base_session_id: session.base_session_id, practice_correction: true }
    : {}),
});

const findPracticeSession = (state, session_id) => {
  const session = state.scorekeepingSessions.find((item) => item.id === session_id);
  if (!session) throw new Error(`[INV-20] Unknown scorekeeping session ${session_id}.`);
  if (session.session_kind !== "practice" || session.game_id != null) {
    throw new Error("[INV-04][INV-30] This action may target only a practice session.");
  }
  return session;
};

/* --------------------- chain + projection selectors ---------------------- */

// The correction chain: this session plus every base under it. The requested
// id is always included even before its row lands in fetched state.
export function practiceSessionChainIds(state, session_id) {
  const ids = [];
  let currentId = session_id;
  while (currentId && !ids.includes(currentId)) {
    ids.push(currentId);
    currentId = state.scorekeepingSessions.find((item) => item.id === currentId)?.base_session_id;
  }
  return ids;
}

// Chain events ordered oldest session first, then by the dense per-session
// sequence (practice sequences restart at 1 for each correction session).
export function practiceChainEvents(state, session_id) {
  const depth = new Map(practiceSessionChainIds(state, session_id).map((id, index) => [id, index]));
  return state.scorekeepingEvents
    .filter((item) => depth.has(item.session_id))
    .sort((a, b) =>
      (depth.get(b.session_id) - depth.get(a.session_id))
      || (a.sequence_number - b.sequence_number));
}

// Records/replacements not voided anywhere in the chain — the same effective
// set cvf_build_ledger_projection derives on the backend.
export function practiceEffectiveEvents(state, session_id) {
  const events = practiceChainEvents(state, session_id);
  const voided = new Set(events.filter((item) => item.action === "void").map((item) => item.voids_event_id));
  return events.filter((item) => ["record", "replace"].includes(item.action) && !voided.has(item.id));
}

// Mirrors cvf_build_ledger_projection's returned keys for practice sessions.
export function buildPracticeProjection(state, session_id) {
  const session = findPracticeSession(state, session_id);
  const effective = practiceEffectiveEvents(state, session_id);
  const effectiveIds = new Set(effective.map((item) => item.id));

  const score = { home: 0, away: 0 };
  const regulation = { home: 0, away: 0 };
  const warnings = [];
  let latestOvertime = null;
  let latestClosedOvertime = null;
  for (const event of effective) {
    if (event.period_type === "overtime") {
      latestOvertime = Math.max(latestOvertime || 0, Number(event.period_number || 0));
      if (event.event_type === "period_close") {
        latestClosedOvertime = Math.max(latestClosedOvertime || 0, Number(event.period_number || 0));
      }
    }
    if (!event.credited_team_id) continue;
    const side = event.credited_team_id === session.home_team_id ? "home" : "away";
    score[side] += Number(event.points || 0);
    if (event.period_type === "regulation") regulation[side] += Number(event.points || 0);

    // INV-07 resurfaces every reasoned paired-stat exception at finalization,
    // which is what forces an override reason there. Hosted pushes this inside
    // the same loop, after the score accumulation and past the period_close
    // continue, so the ordering here matches cvf_build_ledger_projection.
    if (event.pairing_override_reason) {
      warnings.push({
        invId: "INV-07",
        code: "ledger_pairing_override",
        message: `Event ${event.sequence_number} uses a reasoned paired-stat exception.`,
        values: {
          event_id: event.id,
          sequence_number: event.sequence_number,
          reason: event.pairing_override_reason,
        },
      });
    }
  }

  // Per-player stat aggregation keyed by profile id, same shape as hosted.
  const playerStats = {};
  state.scorekeepingEventAttributions
    .filter((attr) => effectiveIds.has(attr.event_id))
    .forEach((attr) => {
      const participant = state.scorekeepingParticipants.find((item) => item.id === attr.participant_id);
      if (!participant) return;
      const entry = playerStats[participant.profile_id]
        || (playerStats[participant.profile_id] = { team_id: participant.team_id, stats: {} });
      entry.stats[attr.stat_key] = (entry.stats[attr.stat_key] || 0) + Number(attr.stat_delta || 0);
    });

  // INV-05/INV-06 stat-vs-score reconciliation, same SOFT semantics as hosted.
  for (const teamId of [session.home_team_id, session.away_team_id]) {
    const totals = {};
    Object.values(playerStats)
      .filter((entry) => entry.team_id === teamId)
      .forEach((entry) => Object.entries(entry.stats).forEach(([key, value]) => {
        totals[key] = (totals[key] || 0) + value;
      }));
    const derived = session.sport === "kickball"
      ? (totals.runs || 0)
      : (totals.tds || 0) * 6 + (totals.onePoint || 0) + (totals.twoPoint || 0) * 2
        + (totals.threePoint || 0) * 3 + (totals.safeties || 0) * 2;
    const eventScore = teamId === session.home_team_id ? score.home : score.away;
    if (derived !== eventScore) {
      warnings.push({
        invId: session.sport === "kickball" ? "INV-05" : "INV-06",
        code: "ledger_stat_score_mismatch",
        message: `${session.sport} stat-derived points ${derived} do not equal event score ${eventScore}.`,
        values: { team_id: teamId, derived, score: eventScore },
      });
    }
  }

  const finalizable = latestOvertime == null
    || (regulation.home === regulation.away && latestClosedOvertime === latestOvertime);
  return {
    home_score: score.home,
    away_score: score.away,
    regulation_home_score: regulation.home,
    regulation_away_score: regulation.away,
    player_stats: playerStats,
    warnings,
    latest_overtime_period: latestOvertime,
    latest_closed_overtime_period: latestClosedOvertime,
    finalizable,
    winner_team_id: !finalizable || score.home === score.away
      ? null
      : score.home > score.away ? session.home_team_id : session.away_team_id,
    loser_team_id: !finalizable || score.home === score.away
      ? null
      : score.home > score.away ? session.away_team_id : session.home_team_id,
  };
}

// Mirrors cvf_validate_ledger_event (5A authoritative form, period_close arm
// included): exact point values per event type, per-sport stat-key allowlists,
// and negative deltas only on the signed yardage keys. The UI cannot normally
// produce these violations — buildLedgerEventCommand assembles the values —
// which is precisely why the mock must hold the line independently: the day
// the entry surface changes, this contract keeps rehearsal and hosted
// identical.
const SIGNED_STAT_KEYS = ["passYards", "rushYards", "recYards"];
const ALLOWED_STAT_KEYS = {
  kickball: ["kicks", "singles", "doubles", "triples", "homeRuns", "rbis", "runs", "walks", "strikeouts", "outs", "assists", "errors"],
  flag_football: [
    "completions", "attempts", "passYards", "passTDs", "ints", "carries", "rushYards", "rushTDs", "rushFirstDowns",
    "catches", "recYards", "recTDs", "recFirstDowns", "flagPulls", "sacks", "defInts", "safeties",
    "tds", "onePoint", "twoPoint", "threePoint",
  ],
};
const ALLOWED_EVENT_TYPES = {
  kickball: ["run", "out", "kick", "single", "double", "triple", "home_run", "walk", "strikeout", "assist", "error"],
  flag_football: ["touchdown", "one_point", "two_point", "three_point", "safety", "completion", "carry", "reception", "flag_pull", "sack", "interception"],
};
const FLAG_POINTS = { touchdown: 6, one_point: 1, two_point: 2, three_point: 3, safety: 2 };

export function validateLedgerEvent(session, event_type, points, attributions) {
  const type = String(event_type || "").trim().toLowerCase();
  const items = attributions || [];
  if (!Array.isArray(items)) throw new Error("[INV-03] Event attributions must be a JSON array.");

  if (type === "period_close") {
    if (Number(points) !== 0 || items.length !== 0) {
      throw new Error("[INV-02][INV-08] A period_close event is zero-point and has no player attribution.");
    }
    return;
  }

  const sport = session.sport === "kickball" ? "kickball" : "flag_football";
  if (!ALLOWED_EVENT_TYPES[sport].includes(type)) {
    throw new Error(`[INV-04] Event type ${type} is not valid for ${sport === "kickball" ? "kickball" : "flag football"}.`);
  }
  const expectedPoints = sport === "kickball" ? (type === "run" ? 1 : 0) : (FLAG_POINTS[type] ?? 0);
  if (Number(points) !== expectedPoints) {
    throw new Error(`[INV-02] ${sport === "kickball" ? "Kickball" : "Flag-football"} event ${type} requires ${expectedPoints} points.`);
  }

  for (const item of items) {
    const delta = item?.stat_delta;
    if (!item || typeof item !== "object" || !item.participant_id || !item.role || !item.stat_key
        || !Number.isInteger(Number(delta)) || String(delta).trim() === "") {
      throw new Error("[INV-03] Each attribution requires participant_id, role, stat_key, and integer stat_delta.");
    }
    if (!ALLOWED_STAT_KEYS[sport].includes(item.stat_key)) {
      throw new Error(`[INV-04] Stat key ${item.stat_key} is not valid for ${session.sport}.`);
    }
    if (Number(delta) < 0 && !SIGNED_STAT_KEYS.includes(item.stat_key)) {
      throw new Error(`[INV-03] Stat ${item.stat_key} cannot have a negative delta.`);
    }
  }
}

// Flag football pairs statistics that must reconcile inside a single event: the
// same-team throw/catch pairs, and interceptions, which cross sides because the
// offense throws what the credited defense catches. Mirrors
// cvf_flag_pairing_mismatches — an unpaired event is legal only with a reason,
// and a reason is legal only on an unpaired event.
const PAIRED_STAT_KEYS = [
  "completions", "catches", "passYards", "recYards",
  "passTDs", "recTDs", "ints", "defInts",
];
const SAME_TEAM_PAIRS = [
  ["completions", "catches"],
  ["passYards", "recYards"],
  ["passTDs", "recTDs"],
];

export function flagPairingMismatches(state, session, creditedTeamId, attributions) {
  if (session.sport !== "flag_football") return [];
  const rows = (attributions || [])
    .filter((item) => PAIRED_STAT_KEYS.includes(item.stat_key))
    .map((item) => ({
      ...item,
      participant: state.scorekeepingParticipants.find(
        (participant) => participant.id === item.participant_id
          && participant.session_id === session.id),
    }));
  if (rows.some((row) => !row.participant)) {
    throw new Error("[INV-07][INV-11] Paired-stat participants must belong to the active session snapshot.");
  }

  const total = (teamId, key) => rows
    .filter((row) => row.participant.team_id === teamId && row.stat_key === key)
    .reduce((sum, row) => sum + Number(row.stat_delta || 0), 0);
  const present = (teamId, key) => rows
    .some((row) => row.stat_key === key && row.participant.team_id === teamId);

  const mismatches = [];
  const check = (leftKey, rightKey, leftTeamId, rightTeamId) => {
    const leftTotal = total(leftTeamId, leftKey);
    const rightTotal = total(rightTeamId, rightKey);
    const leftPresent = present(leftTeamId, leftKey);
    const rightPresent = present(rightTeamId, rightKey);
    const wrongTeam = rows.some((row) =>
      (row.stat_key === leftKey && row.participant.team_id !== leftTeamId)
      || (row.stat_key === rightKey && row.participant.team_id !== rightTeamId));
    if (leftPresent !== rightPresent || leftTotal !== rightTotal || wrongTeam) {
      mismatches.push({
        left_key: leftKey,
        right_key: rightKey,
        left_present: leftPresent,
        right_present: rightPresent,
        left_total: leftTotal,
        right_total: rightTotal,
        expected_team_id: creditedTeamId,
        wrong_team: wrongTeam,
      });
    }
  };

  SAME_TEAM_PAIRS.forEach(([leftKey, rightKey]) => check(leftKey, rightKey, creditedTeamId, creditedTeamId));
  const offenseTeamId = creditedTeamId === session.home_team_id
    ? session.away_team_id
    : session.home_team_id;
  check("ints", "defInts", offenseTeamId, creditedTeamId);
  return mismatches;
}

/* ------------------------- mock RPC equivalents --------------------------- */

export function startPracticeSessionMock(prev, {
  home_team_id,
  away_team_id,
  rule_version,
  regulation_period_count,
  overtime_start_setting = "",
  rules_snapshot = {},
}, newId) {
  const home = prev.teams.find((team) => team.id === home_team_id);
  const away = prev.teams.find((team) => team.id === away_team_id);
  if (!home || !away) throw new Error("[INV-04] Both practice teams must exist.");
  if (home_team_id === away_team_id) throw new Error("[INV-02] Practice requires two distinct teams.");
  const homeLeague = prev.leagues.find((league) => league.id === home.league_id);
  const awayLeague = prev.leagues.find((league) => league.id === away.league_id);
  if (!homeLeague || !awayLeague || homeLeague.sport !== awayLeague.sport || homeLeague.season !== awayLeague.season) {
    throw new Error("[INV-10] Practice teams must share one sport and league season.");
  }
  if (!String(rule_version || "").trim() || !(Number(regulation_period_count) > 0)) {
    throw new Error("[INV-10] A valid immutable rule snapshot is required.");
  }
  if (homeLeague.sport === "flag_football" && Number(regulation_period_count) !== 4) {
    throw new Error("[INV-10] Flag football requires exactly four regulation quarters.");
  }

  const sessionId = newId("pracs");
  // Hosted snapshots eligible roster rows for the league season. Mock seed rows
  // carry no roster_status (treated app-wide as active/eligible), so absence
  // passes; explicit pending_waiver/inactive/removed rows are excluded.
  const participants = prev.teamPlayers
    .filter((row) =>
      [home_team_id, away_team_id].includes(row.team_id)
      && (row.roster_status == null || row.roster_status === "eligible")
      && (row.season == null || row.season === homeLeague.season))
    .map((row) => {
      const profile = prev.profiles.find((item) => item.id === row.profile_id);
      return {
        id: newId("pracp"),
        session_id: sessionId,
        game_id: null,
        source_team_player_id: row.id,
        source_participant_id: null,
        profile_id: row.profile_id,
        team_id: row.team_id,
        season: row.season || homeLeague.season,
        display_name: profile?.name || "Player",
        jersey_number: row.jersey_number ?? null,
        position: row.position || "",
        roster_status: row.roster_status || "eligible",
      };
    });
  if (!participants.some((item) => item.team_id === home_team_id)
      || !participants.some((item) => item.team_id === away_team_id)) {
    throw new Error("[INV-11] Both teams require at least one eligible snapshotted participant.");
  }

  const session = {
    id: sessionId,
    game_id: null,
    session_kind: "practice",
    status: "open",
    base_session_id: null,
    correction_reason: null,
    sport: homeLeague.sport,
    league_id: home.league_id,
    season: homeLeague.season,
    stage: "practice",
    home_team_id,
    away_team_id,
    rule_version: String(rule_version).trim(),
    regulation_period_count: Number(regulation_period_count),
    overtime_start_setting: String(overtime_start_setting || "").trim() || null,
    allow_ties: false,
    rules_snapshot: rules_snapshot || {},
    lease_version: 1,
    created_at: new Date().toISOString(),
  };
  return {
    next: {
      ...prev,
      scorekeepingSessions: [...prev.scorekeepingSessions, session],
      scorekeepingParticipants: [...prev.scorekeepingParticipants, ...participants],
    },
    result: leaseFor(session),
  };
}

export function appendPracticeEventMock(prev, { lease, command }, newId) {
  const session = findPracticeSession(prev, lease?.session_id);
  if (session.status !== "open") throw new Error("[INV-20] Events require an active practice session.");
  const isCorrection = Boolean(session.base_session_id);
  if (["void", "replace"].includes(command.action) && !isCorrection) {
    throw new Error("[INV-16][INV-17] Void and replacement events require a practice correction session.");
  }
  if (command.action === "record" && isCorrection) {
    throw new Error("[INV-16][INV-17] Correction sessions may only void or replace existing effective events.");
  }
  // Same gate append_practice_event applies: record and replace are validated,
  // void is exempt. Without this the rehearsal would accept flag-football
  // combinations the hosted RPC rejects, and teach a workflow that fails live.
  if (["record", "replace"].includes(command.action)) {
    // Same order as append_practice_event: full event validation first, then
    // the period_close arm, then pairing.
    validateLedgerEvent(session, command.event_type, command.points, command.attributions);
    const pairingReason = command.pairing_override_reason || null;
    if (command.event_type === "period_close") {
      if (command.period_type !== "overtime" || command.credited_team_id) {
        throw new Error("[INV-08] period_close requires a teamless overtime period.");
      }
    } else {
      const mismatches = flagPairingMismatches(
        prev, session, command.credited_team_id, command.attributions);
      if (mismatches.length > 0 && !pairingReason) {
        throw new Error("[INV-07] Paired flag-football statistics must reconcile within the same event.");
      }
      if (mismatches.length === 0 && pairingReason) {
        throw new Error("[INV-07] A pairing override reason is valid only for an unpaired flag-football event.");
      }
    }
  }
  // Dense per-SESSION sequence — the practice parallel of the per-game index.
  const sequence = prev.scorekeepingEvents.filter((item) => item.session_id === session.id).length + 1;
  const eventId = newId("prace");
  const event = {
    id: eventId,
    session_id: session.id,
    game_id: null,
    sequence_number: sequence,
    idempotency_key: command.idempotency_key,
    action: command.action,
    event_type: command.event_type,
    period_type: command.period_type ?? null,
    period_number: command.period_number ?? null,
    credited_team_id: command.credited_team_id ?? null,
    points: Number(command.points || 0),
    voids_event_id: command.voids_event_id ?? null,
    replaces_event_id: command.replaces_event_id ?? null,
    payload: command.payload || {},
    pairing_override_reason: command.pairing_override_reason || null,
    created_at: new Date().toISOString(),
  };
  const attributions = (command.attributions || []).map((item) => ({
    id: newId("praca"),
    event_id: eventId,
    session_id: session.id,
    game_id: null,
    participant_id: item.participant_id,
    role: item.role,
    stat_key: item.stat_key,
    stat_delta: Number(item.stat_delta),
  }));
  return {
    next: {
      ...prev,
      scorekeepingEvents: [...prev.scorekeepingEvents, event],
      scorekeepingEventAttributions: [...prev.scorekeepingEventAttributions, ...attributions],
    },
    result: {
      event_id: eventId,
      sequence_number: sequence,
      replayed: false,
      pairing_overridden: Boolean(command.pairing_override_reason),
    },
  };
}

const advanceLease = (prev, session) => {
  const renewed = { ...session, lease_version: session.lease_version + 1 };
  return {
    next: {
      ...prev,
      scorekeepingSessions: prev.scorekeepingSessions.map((item) => item.id === session.id ? renewed : item),
    },
    result: leaseFor(renewed),
  };
};

export function renewPracticeSessionMock(prev, lease) {
  const session = findPracticeSession(prev, lease?.session_id);
  if (session.status !== "open") throw new Error("[INV-20] Only an active session holds a lease.");
  return advanceLease(prev, session);
}

export function resumePracticeSessionMock(prev, session_id) {
  const session = findPracticeSession(prev, session_id);
  if (session.status !== "open") throw new Error("[INV-20] Only an active session can resume.");
  return advanceLease(prev, session);
}

export function cancelPracticeSessionMock(prev, { lease, reason }) {
  if (!String(reason || "").trim()) throw new Error("[INV-25] Canceling a scorekeeping session requires a reason.");
  const session = findPracticeSession(prev, lease?.session_id);
  return {
    next: {
      ...prev,
      scorekeepingSessions: prev.scorekeepingSessions.map((item) => item.id === session.id
        ? { ...item, status: "canceled", lease_version: item.lease_version + 1 }
        : item),
    },
    result: undefined,
  };
}

export function finalizePracticeSessionMock(prev, { lease, override_reason = "" }) {
  const session = findPracticeSession(prev, lease?.session_id);
  if (session.status !== "open") throw new Error("[INV-20] Only an active practice session can be evaluated.");
  const projection = buildPracticeProjection(prev, session.id);

  if (!projection.finalizable) {
    return {
      next: prev,
      result: {
        ok: true,
        status: "overtime_period_open",
        session_id: session.id,
        overtime_period: projection.latest_overtime_period,
        message: `Overtime period ${projection.latest_overtime_period} must be closed before evaluation.`,
      },
    };
  }
  if (projection.home_score === projection.away_score && !session.allow_ties) {
    return {
      next: prev,
      result: {
        ok: true,
        status: "continue_overtime",
        session_id: session.id,
        home_score: projection.home_score,
        away_score: projection.away_score,
        next_overtime_period: (projection.latest_overtime_period || 0) + 1,
        message: "The completed period remains tied; continue overtime.",
      },
    };
  }
  if (projection.warnings.length > 0 && !String(override_reason || "").trim()) {
    throw new Error(`SOFT validation requires an override reason: ${projection.warnings[0].message}`);
  }

  const result = {
    ok: true,
    status: "practice_finalized",
    session_id: session.id,
    home_score: projection.home_score,
    away_score: projection.away_score,
    warnings: projection.warnings,
    overridden: projection.warnings.length > 0,
    projection,
  };
  // The ONLY state change: close the private session. games, playerStats,
  // playoff collections, and edit history are untouched by design.
  return {
    next: {
      ...prev,
      scorekeepingSessions: prev.scorekeepingSessions.map((item) => item.id === session.id
        ? {
            ...item,
            status: "finalized",
            lease_version: item.lease_version + 1,
            override_reason: String(override_reason || "").trim() || null,
            validation_warnings: projection.warnings,
            finalization_result: result,
          }
        : item),
    },
    result,
  };
}

export function startPracticeCorrectionMock(prev, base_session_id, reason, newId) {
  if (!String(reason || "").trim()) throw new Error("[INV-24] A correction reason is required.");
  const base = findPracticeSession(prev, base_session_id);
  if (base.status !== "finalized") {
    throw new Error("[INV-24] A practice correction requires a finalized practice base session.");
  }
  const sessionId = newId("pracs");
  const session = {
    ...base,
    id: sessionId,
    status: "open",
    base_session_id: base.id,
    correction_reason: String(reason).trim(),
    lease_version: 1,
    override_reason: null,
    validation_warnings: null,
    finalization_result: null,
    created_at: new Date().toISOString(),
  };
  // Clone the base participant snapshot, exactly like the hosted correction.
  const participants = prev.scorekeepingParticipants
    .filter((item) => item.session_id === base.id)
    .map((item) => ({
      ...item,
      id: newId("pracp"),
      session_id: sessionId,
      source_team_player_id: null,
      source_participant_id: item.id,
    }));
  return {
    next: {
      ...prev,
      scorekeepingSessions: [...prev.scorekeepingSessions, session],
      scorekeepingParticipants: [...prev.scorekeepingParticipants, ...participants],
    },
    result: {
      ...leaseFor(session),
      base_session_id: base.id,
      practice_correction: true,
    },
  };
}
