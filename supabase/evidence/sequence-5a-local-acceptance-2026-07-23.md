# Sequence 5A local acceptance — overtime + INV-07

**Completion level:** LOCALLY COMPLETE — owner review and commit approval pending

**Date:** July 23, 2026

**Test baseline:** `main@316a592`

**Integration target:** `main@316a592`

**Divergence:** none; baseline and target were confirmed identical before
implementation.

**Hosted state:** unchanged at Migration 27. Migration 28 was not committed,
pushed, published, or exercised against hosted data.

## Objective and owner decisions

Sequence 5A completes the two rule-critical gaps selected by the owner:

1. Kickball adds one complete extra inning at a time; flag football adds one
   possession per team per round. Neither sport uses mid-period sudden death.
2. Overtime completion is always administrator-signaled through an explicit
   append-only `period_close` event. The projection never infers completion.
3. A tied closed period returns `continue_overtime` and leaves the game live.
   An open period returns `overtime_period_open`. Only an unequal projection
   after the latest effective close may finalize.
4. Overtime reuses the regulation ledger, lease, idempotency, projection,
   finalization, and void/replacement machinery.
5. The four flag-football paired-stat classes enforce same-event counterpart
   presence/equality by default. A per-event nonblank reason is the only
   exception and is append-only evidence that resurfaces at finalization.

The binding matrix was amended and owner-approved first in commit `316a592`.
The Migration-24-only acceptance count is recorded as 225/225; the later
Migration-27 current-surface rerun remains separately recorded as 256/256.

## Implemented surface

- Additive migration
  `20260723154411_sequence_5a_overtime_pairing_rules.sql`
  (SHA-256
  `721438d6ae89208ede6578dbff21a8fbd765b9dda8e74b9adebea8a816c66440`).
- Explicit `period_close` event shape and append/replace support.
- Overtime sequencing, closed-period rejection, projection metadata, tied/open
  continuation, and finalization gating.
- Per-event `pairing_override_reason` with append-only actor/time evidence.
- Exact same-event presence/team/total reconciliation for
  `completions/catches`, `passYards/recYards`, `passTDs/recTDs`, and
  `ints/opponent defInts`.
- Adapter and admin UI support for overtime, explicit close, paired
  participants, signed completed-pass yardage, event/final override reasons,
  and ambiguous-response idempotency-key reuse.
- The inherited lease validator is corrected from `STABLE` to `VOLATILE`
  because it reads `clock_timestamp()`; its existing deny-by-default execute
  boundary is preserved.

## High-stakes verification

- **Single correction authority:** unchanged. Aggregate RPCs still reject
  ledger games; overtime corrections use the existing ledger-only
  void/replacement chain.
- **Atomic non-finalization:** a tied closed OT period returns
  `continue_overtime` while the game remains live and unlocked; an unequal open
  OT period cannot publish. The correction finalizer explicitly rejects a
  non-finalizable projection when a correction removes the effective close,
  returning the intended invariant while leaving the prior
  completed/final/locked public result unchanged.
- **Overtime eligibility:** the first overtime event is rejected unless the
  regulation-only projection is tied. Projection finalizability preserves the
  same rule for correction sessions, so a correction cannot make unnecessary
  overtime publishable.
- **Append-only evidence:** direct owner UPDATE of a pairing exception is
  rejected. `period_close` correction uses void/replacement rather than
  mutation.
- **Authorization:** the new append signature is authenticated-only; anonymous
  and `service_role` lack execute. AAL1 admin and authenticated non-admin calls
  fail at the AAL2 guard. The new pairing helper is not client-executable.
- **Entry enforcement:** one-sided, blank-reason, wrong-team, unequal-total,
  and zero-delta one-sided pair attempts fail closed.
- **Final audit:** override-backed event warnings block unexplained
  finalization and are copied with the final override reason into immutable
  session/history evidence.
- **Concurrency/idempotency:** the real two-connection same-command race still
  yields one durable event and one replay. UI operation keys are retained for
  an ambiguous same-payload retry and rotated only when the payload changes or
  success is confirmed.

## Verification results

| Gate | Result |
|---|---|
| Complete PostgreSQL harness | PASS — 318/318 |
| Real two-connection append race | PASS — one durable event, one replay |
| Clean 28-migration replay | PASS — full harness plus isolated Supabase PostgreSQL lint instance |
| Post-visual cleanup readback | PASS — 28 migrations, 0 Auth users, 0 ledger rows |
| Local database lint | PASS at error level; no Migration-28 warning |
| Focused frontend suite | PASS — 3 suites, 18/18 |
| Complete frontend suite | PASS — 34 suites, 133/133 |
| Optimized production build | PASS |
| Responsive runtime | PASS — 375/768/1440, no horizontal overflow |
| Browser console/page errors | PASS — development notice only; zero page errors |
| Diff whitespace check | PASS |

The lint output retains only five previously documented
`generate_single_elim_bracket` warnings. The Sequence-4 lease-volatility
warning is resolved in Migration 28. The first candidate run also exposed and
fixed two defects before this checkpoint: a nullable finalizability comparison
that could admit an unequal open OT period, and total-only pairing logic that
could miss a zero-delta one-sided attribution.

Responsive evidence:

- [`../../docs/audit/sequence5a-captures/ledger-overtime-paired-375.png`](../../docs/audit/sequence5a-captures/ledger-overtime-paired-375.png)
- [`../../docs/audit/sequence5a-captures/ledger-overtime-paired-768.png`](../../docs/audit/sequence5a-captures/ledger-overtime-paired-768.png)
- [`../../docs/audit/sequence5a-captures/ledger-overtime-paired-1440.png`](../../docs/audit/sequence5a-captures/ledger-overtime-paired-1440.png)
- [`../../docs/audit/sequence5a-captures/ledger-overtime-close-375.png`](../../docs/audit/sequence5a-captures/ledger-overtime-close-375.png)

## Affected files and systems

- Database migration and PostgreSQL regression harness.
- Supabase adapter and adapter tests.
- Admin `LedgerScorekeeper` and component tests.
- New pure command/idempotency helper and unit tests.
- Binding scoring matrix, schema/status docs, repository status, this evidence
  report, and responsive capture manifest.

No payment, intake, waiver, public profile, mock-state, Turnstile, hosted
configuration, or unrelated project file changed. The user's original
`pass3-slice-evidence` workspace remains untouched; implementation occurred in
the isolated `/private/tmp/cvfleagues-pass4-batch0` worktree.

## Remaining risks and gates

- The UI accepts signed completed-pass yardage and mirrors it to passer and
  receiver, but signed standalone rushing-yard entry is still absent. `INV-03`
  remains a hard pilot blocker.
- Practice mode remains unimplemented and is a hard pilot boundary.
- Hosted still contains Migration 27 only. Migration 28 needs owner review,
  commit approval, then a later preflight/backup/dry-run and the explicit token
  `approved: hosted push of migration 28`.
- Hosted authorization/behavioral acceptance and the first durable
  populated-ledger row require separate approvals. No pilot authorization is
  inferred from approval of this local work.

## Rollback

Before commit, rollback is deletion/reversion of only the listed local
candidate files. After commit but before publication, revert the focused
commits. Once a migration is published, never edit or remove it; use a new
additive migration after explicit owner approval. No hosted rollback is
currently required because no hosted mutation occurred.

## Owner checkpoint

Review the complete Migration 28 SQL, Sequence 5A assertion block, adapter,
helper, scorekeeper, tests, docs, and captures. If accepted, approve focused
commits only. Hosted publication remains a later, separately named approval.
