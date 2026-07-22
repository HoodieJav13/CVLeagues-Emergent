# Sequence 4A–4C local acceptance — 2026-07-22

- **Completion level:** LOCALLY COMPLETE — owner review required
- **Test baseline:** `main@0225f97e96ae65ce1313b3a0b267c943f3cc23dd`
- **Integration target:** `main@0225f97e96ae65ce1313b3a0b267c943f3cc23dd`
- **Divergence:** none; baseline and target were explicitly confirmed identical before implementation
- **Hosted state:** unchanged at Migration 24
- **Commit state at checkpoint:** Sequence 4 changes were uncommitted

Post-review update: the owner approved the complete database, UI, test, and
documentation split on July 22, 2026. The reviewed implementation now lives in
`d7e5135`, `83b1893`, and `ed6423e`; this report is included by the fourth,
documentation-only commit. No push or hosted mutation was authorized.

## Objective and internal stage boundaries

Sequence 4 was executed as one approved local run while preserving three
reviewable boundaries:

1. **4A — runtime sessions and events:** AAL2-admin session start, lease renew,
   reasoned resume/takeover, idempotent event append, participant snapshots,
   cancellation, and fail-closed mock behavior.
2. **4B — projection and finalization:** deterministic ledger fold, atomic
   game/stat/history publication, metadata-only failure audit, explicit
   W/L-only forfeits, and outcome-aware playoff advancement.
3. **4C — corrections:** one ledger correction authority, immutable snapshot
   chaining, correction-only void/replacement evidence, atomic user-visible
   void-and-replace, cancel-without-public-change, and bracket-safe finalization.

No practice-mode data model, public live-score feed, player/captain role, or
second correction authority was introduced.

## Security and consistency findings

- Every client runtime endpoint calls the existing AAL2-aware `assert_admin()`.
- The four ledger tables remain authenticated SELECT-only, AAL2/RLS filtered,
  and directly non-writable. Anonymous and `service_role` retain no table
  privilege; `service_role` cannot execute any of the ten runtime RPCs.
- The lock order is consistent: advisory game lock, game row, session row.
- Lease tokens are returned once and stored only as hashes; renewal/resume
  rotates token and version. Stale tokens fail.
- Event identity is game-scoped and payload-hashed. A real two-connection race
  produces one durable event plus one replay, not two sequence rows.
- Finalization publishes game outcome, periods, player stats, playoff effects,
  session state, and append-only history atomically. Failed projection rolls
  mutations back and records only bounded failure metadata.
- Scoreless forfeits store winner/loser and reason, no score/period/stat
  projection, strict same-key replay identity, and use the established playoff
  advancement function.
- Public standings/cards/details consume that explicit outcome as one W/L with
  zero points-for/against, display W/L instead of 0–0, and do not offer an
  invalid correction/reopen action for a locked forfeit.
- Corrections leave the public final unchanged while drafting. The atomic
  replace RPC prevents a transport/validation failure from leaving a
  half-applied void-only user command.

## Verification evidence

| Gate | Result |
|---|---|
| Clean isolated Supabase reset | PASS — 27 migrations; latest `20260722052352` |
| Runtime function catalog | PASS — exactly 10 ledger RPC names |
| RLS catalog | PASS — 0 public tables without RLS |
| Constraint catalog | PASS — 0 unvalidated public constraints |
| Runtime service-role catalog | PASS — 0 executable ledger runtime RPCs |
| Exact ledger ACL/helper class sweep | PASS — every expected boolean true |
| PostgreSQL harness | PASS — 294/294 |
| Two-connection event race | PASS — one durable event, one replay |
| Hosted-matrix contract tests | PASS — 10/10 |
| Focused ledger/backend frontend tests | PASS — 12/12 |
| Complete frontend suite | PASS — 33/33 suites, 128/128 tests, serial rerun |
| Production environment preflight and build | PASS — compiled successfully |
| Responsive setup surface | PASS — 375, 768, 1440 px; no horizontal overflow |
| Clean-render browser console | PASS — no warning/error before the intentional mock rejection probe |

The first parallel frontend invocation produced only partial streamed output;
the required full suite was rerun serially because this repository has a
known parallel-load timing pattern. The serial run completed normally with all
128 assertions passing. This is not recorded as a product failure.

## Prepared hosted gate, not executed

The hosted authorization harness now prepares anonymous and authenticated
non-admin denial probes for all ten new RPCs and an exact catalog check that
the runtime endpoints are `authenticated`-only. It deliberately does not add
an automatically cleaned positive ledger fixture: event evidence is
append-only by design. The first owner-approved durable pilot row must prove
that AAL2 can read/write the row, a non-admin remains RLS-empty on the same
row, and the projection is correct.

## Remaining risks and later stages

- **BLOCKING before any hosted use:** owner review/commit, fresh private backup,
  linked migration-list preflight, dry run, discrete hosted-push approval,
  post-push structural/advisor readback, and separately approved real-session
  authorization checks.
- **BLOCKING before the flag-football pilot:** Sequence 5 must add the complete
  overtime workflow and enforce `INV-07` paired passing/receiving and
  interception reconciliation with negative tests.
- **BLOCKING before broad rollout:** Sequence 6 field evidence, owner decision
  on second-sport/live use, recovery/session-revocation acceptance, preview
  configuration, and final waiver text.

## Rollback

Before commit or hosted application, rollback is simply declining the local
diff. After any future approved hosted push, do not down-migrate or repair
history ad hoc. Stop official ledger use, preserve append-only evidence, and
ship a reviewed additive remediation migration. Aggregate games remain
isolated and continue through their existing authority.

## Owner checkpoint

Review the complete Sequence 4 diff and this evidence. No Sequence 4 commit,
push, hosted migration, hosted fixture, deployment, or pilot is authorized by
this local acceptance record.
