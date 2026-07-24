const keyFactory = () =>
  globalThis.crypto?.randomUUID?.()
  || `ledger-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const event = (id, label, eventType, points, primaryStat, mode = "single") => ({
  id,
  label,
  eventType,
  points,
  primaryStat,
  mode,
});

export const LEDGER_EVENT_OPTIONS = {
  kickball: [
    event("run", "Run", "run", 1, "runs"),
    event("out", "Out", "out", 0, "outs"),
    event("kick", "Kick", "kick", 0, "kicks"),
    event("single", "Single", "single", 0, "singles"),
    event("double", "Double", "double", 0, "doubles"),
    event("triple", "Triple", "triple", 0, "triples"),
    event("home_run", "Home run", "home_run", 0, "homeRuns"),
    event("walk", "Walk", "walk", 0, "walks"),
    event("strikeout", "Strikeout", "strikeout", 0, "strikeouts"),
    event("assist", "Assist", "assist", 0, "assists"),
    event("error", "Error", "error", 0, "errors"),
    event("period_close", "Close overtime inning", "period_close", 0, null, "periodClose"),
  ],
  flag_football: [
    event("touchdown", "Rushing / return touchdown", "touchdown", 6, "tds"),
    event("passing_touchdown", "Passing touchdown", "touchdown", 6, "passTDs", "passingTouchdown"),
    event("one_point", "1-point try", "one_point", 1, "onePoint"),
    event("two_point", "2-point try", "two_point", 2, "twoPoint"),
    event("three_point", "3-point try", "three_point", 3, "threePoint"),
    event("safety", "Safety", "safety", 2, "safeties"),
    event("completion", "Completed pass", "completion", 0, "completions", "completion"),
    event("carry", "Carry", "carry", 0, "carries"),
    event("flag_pull", "Flag pull", "flag_pull", 0, "flagPulls"),
    event("sack", "Sack", "sack", 0, "sacks"),
    event("interception", "Interception", "interception", 0, "defInts", "interception"),
    event("period_close", "Close overtime round", "period_close", 0, null, "periodClose"),
  ],
};

const attribution = (participantId, role, statKey, statDelta) => ({
  participant_id: participantId,
  role,
  stat_key: statKey,
  stat_delta: Number(statDelta),
});

export function buildLedgerEventCommand({
  option,
  periodType,
  periodNumber,
  creditedTeamId,
  primaryParticipantId,
  counterpartParticipantId,
  yardDelta = 0,
  pairingOverrideReason = "",
}) {
  if (option.mode === "periodClose") {
    if (periodType !== "overtime") {
      throw new Error("An overtime period must be selected before it can be closed.");
    }
    return {
      action: "record",
      event_type: "period_close",
      period_type: "overtime",
      period_number: Number(periodNumber),
      credited_team_id: null,
      points: 0,
      attributions: [],
      pairing_override_reason: null,
    };
  }

  if (!primaryParticipantId) {
    throw new Error("Select the primary player credited with this event.");
  }

  const attributions = [];
  if (option.mode === "completion") {
    attributions.push(attribution(primaryParticipantId, "passer", "completions", 1));
    attributions.push(attribution(primaryParticipantId, "passer", "passYards", yardDelta));
    if (counterpartParticipantId) {
      attributions.push(attribution(counterpartParticipantId, "receiver", "catches", 1));
      attributions.push(attribution(counterpartParticipantId, "receiver", "recYards", yardDelta));
    }
  } else if (option.mode === "passingTouchdown") {
    attributions.push(attribution(primaryParticipantId, "passer", "passTDs", 1));
    if (counterpartParticipantId) {
      attributions.push(attribution(counterpartParticipantId, "receiver", "recTDs", 1));
      attributions.push(attribution(counterpartParticipantId, "scorer", "tds", 1));
    }
  } else if (option.mode === "interception") {
    attributions.push(attribution(primaryParticipantId, "interceptor", "defInts", 1));
    if (counterpartParticipantId) {
      attributions.push(attribution(counterpartParticipantId, "passer", "ints", 1));
    }
  } else {
    attributions.push(attribution(primaryParticipantId, "primary", option.primaryStat, 1));
  }

  const reason = pairingOverrideReason.trim();
  if (["completion", "passingTouchdown", "interception"].includes(option.mode)
      && !counterpartParticipantId && !reason) {
    throw new Error("Select the paired player or enter a reasoned pairing override.");
  }

  return {
    action: "record",
    event_type: option.eventType,
    period_type: periodType,
    period_number: Number(periodNumber),
    credited_team_id: creditedTeamId,
    points: option.points,
    attributions,
    pairing_override_reason: reason || null,
  };
}

export function createLedgerOperationKeys(makeKey = keyFactory) {
  const pending = new Map();
  return {
    claim(slot, payload) {
      const signature = JSON.stringify(payload);
      const current = pending.get(slot);
      if (current?.signature === signature) return current.key;
      const next = { signature, key: makeKey() };
      pending.set(slot, next);
      return next.key;
    },
    clear(slot) {
      pending.delete(slot);
    },
  };
}
