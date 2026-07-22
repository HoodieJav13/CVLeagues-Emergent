# Event Ledger Lite — Sequence 3 Schema Contract

**Status:** hosted-accepted; schema committed in `1b31693`

**Migration:** `20260721201350_event_ledger_lite_schema.sql`

**Hosted status:** accepted through Migration 24 at 225/225 authorization/catalog checks

## Purpose and scope

Sequence 3 establishes the database boundary required for future event-level
scorekeeping without creating a second working score-entry system. It is a
dormant schema stage: no client can start a session, append an event, project a
score, finalize a game, or correct a ledger result yet.

The binding rules remain
[`RULES_INVARIANT_MATRIX.md`](RULES_INVARIANT_MATRIX.md). Sequence 4 must build
on this schema rather than weakening it.

## What Migration 24 adds

- `games.scorekeeping_mode`, defaulting to `aggregate`, plus a server-owned
  ledger-conversion timestamp.
- A controlled aggregate-to-ledger transition. It is allowed only for an
  upcoming, pending, unlocked, unscored game with no stats or ledger session.
  Reversal to aggregate mode is rejected.
- `scorekeeping_sessions`, with ordinary/correction separation, one active
  session per game, versioned lease state, required correction reasons, and an
  immutable snapshot of sport, league, season, stage, teams, rule version,
  regulation-period count, overtime setting, tie policy, and rule JSON.
- `scorekeeping_participants`, copied from eligible roster rows for an ordinary
  session. Correction sessions clone the original participant snapshot instead
  of rereading a later mutable roster.
- `scorekeeping_events`, with a server-assigned gapless per-game sequence,
  game-scoped idempotency key, request hash, period/team attribution, and
  append-only record/void/replacement actions.
- `scorekeeping_event_attributions`, which can reference only a participant in
  the same immutable session snapshot.
- Cross-game and fork protection for void/replacement chains. One original can
  be voided once and replaced once; a replacement must follow the matching
  void in the same correction session.

## Authority boundary

Migration 23 remains the only active score system:

- Aggregate games continue through `submit_score`, `lock_game`, and
  `correct_final_score` without behavior changes.
- Those aggregate RPCs are rejected if the target game is ledger mode.
- Ledger projection writes to `games` or `player_stats` require a private
  transaction flag reserved for the future finalizer.
- Migration 24 adds no mutation RPC, no projection view, no public live score,
  and no alternative playoff-correction function.

This preserves one correction authority per game (`INV-30`).

## Access and evidence rules

All four ledger tables enable RLS. Authenticated administrators receive read
access through admin-only policies; anonymous users receive no table grant;
authenticated clients receive no write grant; and `service_role` receives no
table, sequence, or helper-function privilege. Trigger helpers are not
client-executable.

Participant, event, and attribution rows are append-only. A referenced Auth
actor may become `NULL` through the repository-standard `ON DELETE SET NULL`
behavior, but the remainder of the evidence row cannot change. Session rule
and identity snapshots are immutable; future server-controlled state changes
must advance the lease version.

## Deferred to Sequence 4

- AAL2 owner-admin session/open/renew/cancel/finalize RPCs.
- Same-payload idempotent retry behavior, including canonical request
  normalization and original-result replay.
- Sport-specific event dictionaries and complete HARD/SOFT validation.
- Deterministic effective-ledger fold into periods, scores, player statistics,
  outcome, standings, bracket consequences, and append-only edit history.
- Failure audit behavior and correction cancellation/re-finalization.
- Public-final-only publication and proof that correction drafts never leak.
- Concurrency tests across two real database connections.

No ledger pilot may begin until those items and the remaining UI/rules gaps in
the invariant matrix are closed.

## Verification checkpoint

Local verification on July 21, 2026:

- Independent PostgreSQL harness: **277/277**.
- Explicit `supabase db reset --local --no-seed`: passed through Migration 24.
- Direct post-reset catalog readback: four ledger tables present with RLS,
  zero client ledger-write privileges, and zero client/service-role helper
  execution privileges.
- Local database lint: no Migration-24 error or warning; five existing
  shadowed/unused-variable warnings remain in `generate_single_elim_bracket`.
- Frontend serial suite: **117/117**; production build passed.

See
[`../../supabase/evidence/event-ledger-lite-local-verification-2026-07-21.md`](../../supabase/evidence/event-ledger-lite-local-verification-2026-07-21.md)
for the full gate record.

Hosted acceptance on July 21, 2026:

- A fresh private logical backup, linked migration-list preflight, and dry run
  confirmed that only Migration 24 would be applied.
- The separately approved push completed; post-push migration history and dry
  run confirmed all 24 migrations aligned.
- Hosted structural readback confirmed 26/26 public tables with RLS, four empty
  ledger tables, both game-mode columns, all nine expected triggers, all seven
  helpers, and all three critical anti-fork/active-session indexes.
- The separately approved hosted matrix passed **225/225** browser/API and
  catalog checks, removed every fixture row, and restored every observed row
  count and singleton setting exactly.
- The accepted boundary remains schema-only. Sequence 4 must prove populated-row
  AAL2 visibility and non-admin RLS emptiness once its controlled write path
  exists.

See
[`../../supabase/evidence/event-ledger-lite-hosted-acceptance-2026-07-21.md`](../../supabase/evidence/event-ledger-lite-hosted-acceptance-2026-07-21.md)
and
[`../../supabase/evidence/hosted-auth-matrix-2026-07-21-m24.md`](../../supabase/evidence/hosted-auth-matrix-2026-07-21-m24.md)
for the hosted gate record.
