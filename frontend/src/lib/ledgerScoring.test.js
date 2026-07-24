import {
  LEDGER_EVENT_OPTIONS,
  buildLedgerEventCommand,
  createLedgerOperationKeys,
} from "./ledgerScoring";

const option = (sport, id) =>
  LEDGER_EVENT_OPTIONS[sport].find((item) => item.id === id);

describe("ledger scoring commands", () => {
  test("[INV-07] completed passes pair counts and signed yards in one event", () => {
    expect(buildLedgerEventCommand({
      option: option("flag_football", "completion"),
      periodType: "overtime",
      periodNumber: 2,
      creditedTeamId: "offense",
      primaryParticipantId: "passer",
      counterpartParticipantId: "receiver",
      yardDelta: -4,
    })).toEqual(expect.objectContaining({
      event_type: "completion",
      period_type: "overtime",
      period_number: 2,
      pairing_override_reason: null,
      attributions: [
        { participant_id: "passer", role: "passer", stat_key: "completions", stat_delta: 1 },
        { participant_id: "passer", role: "passer", stat_key: "passYards", stat_delta: -4 },
        { participant_id: "receiver", role: "receiver", stat_key: "catches", stat_delta: 1 },
        { participant_id: "receiver", role: "receiver", stat_key: "recYards", stat_delta: -4 },
      ],
    }));
  });

  test("[INV-07] an unpaired command requires and preserves its own reason", () => {
    expect(() => buildLedgerEventCommand({
      option: option("flag_football", "interception"),
      periodType: "regulation",
      periodNumber: 4,
      creditedTeamId: "defense",
      primaryParticipantId: "defender",
    })).toThrow("paired player");

    expect(buildLedgerEventCommand({
      option: option("flag_football", "interception"),
      periodType: "regulation",
      periodNumber: 4,
      creditedTeamId: "defense",
      primaryParticipantId: "defender",
      pairingOverrideReason: "Passer identity unavailable in official book",
    }).pairing_override_reason).toBe("Passer identity unavailable in official book");
  });

  test("[INV-08] period close is teamless, zero-point, and overtime-only", () => {
    expect(buildLedgerEventCommand({
      option: option("kickball", "period_close"),
      periodType: "overtime",
      periodNumber: 1,
    })).toEqual({
      action: "record",
      event_type: "period_close",
      period_type: "overtime",
      period_number: 1,
      credited_team_id: null,
      points: 0,
      attributions: [],
      pairing_override_reason: null,
    });
  });

  test("[INV-15] ambiguous retries reuse a key and meaningful changes rotate it", () => {
    let sequence = 0;
    const keys = createLedgerOperationKeys(() => `key-${++sequence}`);
    const first = keys.claim("record", { event_type: "completion", yards: 8 });
    expect(keys.claim("record", { event_type: "completion", yards: 8 })).toBe(first);
    expect(keys.claim("record", { event_type: "completion", yards: 9 })).not.toBe(first);
    keys.clear("record");
    expect(keys.claim("record", { event_type: "completion", yards: 9 })).toBe("key-3");
  });
});
