# Event Ledger Lite — Sequence 3 Schema and Sequence 4 Runtime Contract

**Status:** Sequence 3 hosted-accepted; Sequence 4A–4C hosted-authorization accepted, durable pilot pending

**Migration:** `20260721201350_event_ledger_lite_schema.sql`

**Hosted status:** 27/27 migrations aligned; current 26-table / 25-RPC authorization surface accepted at 256/256

## Purpose and scope

Sequence 3 established the hosted database boundary required for event-level
scorekeeping without creating a second working score-entry system. Sequence 4
now publishes the controlled runtime behind that same authority boundary. The
client is not deployed and no hosted ledger session/event exists. The
real-session authorization matrix is accepted; positive populated-ledger
behavior still requires the later durable pilot.

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

Migration 23 remains the only active hosted score system:

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

## Sequence 4 runtime implementation

- Migration 25 adds AAL2-admin open/renew/resume/append/cancel RPCs, rotating
  ten-minute leases, immutable eligible-participant snapshots, sport-specific
  event dictionaries, server sequence assignment, and exact command replay.
- Migration 26 adds deterministic effective-ledger projection, atomic
  finalization, player-stat replacement, public-final-only publication,
  metadata-only failure audit, explicit scoreless forfeits, and the existing
  single playoff-advancement authority for played and forfeit outcomes.
- Migration 27 adds the single ledger correction authority. Corrections extend
  the latest finalized snapshot, append only void/replacement evidence, keep
  the public result unchanged while drafting, apply bracket-safe changes only
  at finalization, and make user-visible void-and-replace one atomic command.
- The admin score-entry surface can opt an eligible unscored game into the live
  ledger, restore a rotated lease, record events, finalize, cancel, correct, or
  declare a forfeit. Explicit mock mode refuses these writes rather than
  creating localStorage evidence.
- Public standings and result surfaces recognize only the complete explicit
  forfeit shape, add one W/L with zero points-for/against, and render W/L rather
  than inventing a numeric score. A locked forfeit cannot reopen scorekeeping.
- The local harness proves retry behavior, two-connection same-command
  concurrency, deterministic projection, failure rollback/audit, correction
  cancellation, forfeit identity, and playoff-forfeit advancement at **294/294** assertions.

The three migrations are structurally published and their current hosted
authorization surface is accepted. Hosted history, structure, row/settings
baseline, privileges, advisors, and the 256/256 real-session/catalog matrix all
pass. Sequence 5 still owns flag-football overtime, `INV-07`, the durable
populated-row proof, and pilot acceptance.

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
- The Migration-24 acceptance remains schema-only. The published Sequence 4
  runtime makes populated-row testing possible, but append-only evidence means
  that proof belongs to an explicitly approved durable Sequence 5 pilot row.

See
[`../../supabase/evidence/event-ledger-lite-hosted-acceptance-2026-07-21.md`](../../supabase/evidence/event-ledger-lite-hosted-acceptance-2026-07-21.md)
and
[`../../supabase/evidence/hosted-auth-matrix-2026-07-21-m24.md`](../../supabase/evidence/hosted-auth-matrix-2026-07-21-m24.md)
for the hosted gate record.

## Sequence 4 local verification checkpoint

Local verification on July 22, 2026:

- Test baseline and integration target both confirmed as `main@0225f97` before
  implementation; no divergence reconciliation was required.
- Clean isolated Supabase reset applied all **27** repository migrations; the
  catalog exposed exactly ten authenticated-only ledger runtime RPCs.
- Independent PostgreSQL harness: **294/294**, plus a real two-connection
  append race producing one durable event and one idempotent replay.
- Frontend: **33/33 suites, 128/128 tests**; optimized production build passed.
- Hosted-auth harness contract tests: **10/10**. Its future matrix now includes
  anonymous/non-admin denial and exact privilege catalog coverage for all ten
  ledger runtime RPCs.
- Responsive live-ledger setup was inspected at 375, 768, and 1440 pixels with
  no horizontal overflow or unexpected browser console warning during the
  clean render.

See
[`../../supabase/evidence/sequence-4-local-acceptance-2026-07-22.md`](../../supabase/evidence/sequence-4-local-acceptance-2026-07-22.md)
for the consolidated local gate.

## Sequence 4 hosted-push checkpoint

Published on July 22, 2026:

- A discrete owner approval authorized only Migrations 25–27 against the linked
  CVF Leagues project.
- Migration history is **27/27** and the post-push dry run is up to date.
- Expected columns, indexes, constraint, correction trigger, all ten fixed-path
  AAL2-admin RPCs, correction-mode guards, RLS/grants, helper ACLs, and the
  least-privilege service-role/default-ACL boundary passed readback.
- The complete operational row/settings baseline remained byte-for-byte equal
  at the observed count/setting level; all four ledger tables remain empty.
- Advisors report 33 Security findings (the accepted 23 plus ten intended
  authenticated runtime-RPC warnings) and 31 Performance findings (28 unused
  indexes plus the same three overlapping-policy warnings).
- No real-session matrix fixture, ledger evidence, deployment, or pilot was
  created.

See
[`../../supabase/evidence/sequence-4-hosted-push-2026-07-22.md`](../../supabase/evidence/sequence-4-hosted-push-2026-07-22.md)
for the published gate record.

## Sequence 4 hosted-authorization checkpoint

Accepted on July 22, 2026:

- The separately approved live matrix exercised anonymous, authenticated
  non-admin, password-only linked-admin, and AAL2 administrator access-control
  boundaries across all 26 tables and all 25 client-facing admin RPCs.
- **248/248** browser/API checks and **8/8** exact catalog checks passed, for
  **256/256** combined.
- All ten ledger runtime RPCs were confirmed authenticated-only; anonymous,
  non-admin, and AAL1-admin execution failed closed as required.
- The disposable aggregate fixture was removed completely. All 26 public-table
  counts plus `current_season`, `hof_published`, and the current waiver setting
  matched the pre-run baseline exactly; an independent post-run query confirmed
  the same values.
- All four ledger tables remain empty. Positive visibility and authorized write
  behavior against a populated append-only ledger row is deliberately deferred
  to the owner-approved durable Sequence 5 pilot.

See
[`../../supabase/evidence/hosted-auth-matrix-2026-07-22-m27.md`](../../supabase/evidence/hosted-auth-matrix-2026-07-22-m27.md)
for the accepted authorization record.
