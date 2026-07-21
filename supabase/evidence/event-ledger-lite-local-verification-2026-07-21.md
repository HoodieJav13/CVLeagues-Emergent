# Event Ledger Lite — Local Verification Evidence

**Date:** 2026-07-21

**Completion level:** COMMITTED LOCALLY in `1b31693`

**Hosted status:** NOT APPLIED

**Implementation commit:** `1b3169348f035bacd01e418a7b2bde0d42c0aa63`

**Test baseline:** `main@a2333a11318a1167ac80f380e27ad89c06f04c41` plus the then-uncommitted Sequence 2 acceptance-document sync

**Integration target:** the same then-current `main@a2333a11318a1167ac80f380e27ad89c06f04c41` worktree

**Divergence:** baseline and target were confirmed identical for implementation; the reusable forward-test artifact was separately divergence-blocking and was not transplanted

## Gate 0 and Gate 1.5

The earlier scorekeeping artifact was built from
`b2e2bb915ce13bfd723837611c4f6b9de36541b1`. The current target additionally
contains Migration 23 aggregate-scoring hardening. A bidirectional migration
and domain-name collision sweep found that the artifact would reintroduce the
retired unlock flow, replace current lock/stat triggers, revoke the accepted
aggregate `lock_game` path, hardcode five kickball innings, scope idempotency
to a session rather than a game, and introduce another finalization authority
without explicit mode separation.

Disposition: **divergence-blocking for direct integration**. Only its safe
concepts—advisory game locking, lease/version state, append-only evidence,
private RLS, and retry/concurrency test ideas—were retained. Migration 24 was
implemented additively on the current target.

## Implemented surface

- `games.scorekeeping_mode` with aggregate default and controlled one-way
  ledger conversion.
- Four private RLS tables: sessions, participants, events, and attributions.
- Immutable rule/game and participant snapshots, including correction cloning
  from the ordinary snapshot.
- One active session per game; ordinary/correction state separation.
- Server-assigned gapless sequence per game and game-scoped idempotency keys.
- Append-only events/attributions and void/replacement anti-fork constraints.
- Mode-aware guards that keep Migration 23 aggregate RPCs off ledger games.
- No client ledger mutation RPC, public projection, or hosted write.

## Verification results

| Gate | Result | Evidence |
|---|---:|---|
| Migration creation discipline | PASS | CLI `migration new --help` confirmed; migration created with `supabase migration new event_ledger_lite_schema` |
| Independent database harness | PASS | **277/277**; includes 46 Sequence-3-specific assertions |
| Real local Supabase replay | PASS | `supabase db reset --local --no-seed` applied all 24 migrations and finished successfully |
| Post-reset catalog readback | PASS | Migration `20260721201350` present; all four ledger tables have RLS; zero client write grants; zero client/service-role helper execution |
| Foreign-key indexes | PASS | Existing generic assertion covers every public FK; local total is 60/60 |
| Local database lint | PASS WITH KNOWN WARNINGS | No ledger finding; five pre-existing warnings in `generate_single_elim_bracket` |
| Frontend required command | FLAKY UNDER PARALLEL LOAD | 116/117; the same locked-score interaction exceeded its fixed five-second timeout |
| Targeted timing investigation | PASS | `ScoreEntry.test.js` 2/2; primary interaction 3.245s |
| Full frontend serial rerun | PASS | **117/117**, 32 suites |
| Production build | PASS | Optimized CRA build completed; environment preflight passed without printing values |
| Diff whitespace | PASS | `git diff --check` |
| Responsive render | NOT APPLICABLE | Schema/tests/docs only; no rendered UI changed |

The local CLI emitted a post-apply `pg-delta` catalog-cache timeout during both
initialization and reset. The reset still returned success, and direct SQL
readback confirmed the migration ledger, relations, RLS, and privilege
boundary. This is the same cache-only failure class observed after Migration
23, not a migration-transaction failure.

## Repeated frontend timing finding

`ScoreEntry.test.js` has now exceeded its fixed five-second test timeout three times
under parallel load. The test passes alone and in the full serial suite, and
no frontend file changed in this stage. The test currently covers an unusually
large correction flow in one case through many `act()` cycles. Before parallel
Jest is treated as a release gate, split the behaviors into focused tests or
deliberately raise only that test's timeout, then run parallel and open-handle
diagnostics. This is a test-reliability follow-up, not evidence of a product
failure.

## Risks and deferred work

- Sequence 3 proves schema constraints and authority separation, not the future
  AAL2 RPC behavior, deterministic fold, retry-result replay, or two-connection
  concurrency path.
- The four new private tables are not included in the currently accepted
  154-case hosted matrix because Migration 24 is not hosted. The future hosted
  plan must expand the matrix from 22 to 26 tables before push acceptance.
- The local stack's auxiliary Realtime/pg-meta health checks were slow, but the
  explicit database reset and direct database readback passed.

## Rollback and owner actions

Before commit, rollback is deletion of the new migration plus its focused
tests/docs. After a future hosted push, rollback must be a new additive
migration; never edit or repair hosted history casually.

The owner reviewed and approved the complete Migration 24 and focused test
diff, and the implementation was committed in `1b31693`. This approval did
not authorize a hosted push. A future hosted checkpoint requires an expanded
26-table matrix, fresh logical export, migration preflight/dry run, and a
discrete owner approval immediately before the push.
