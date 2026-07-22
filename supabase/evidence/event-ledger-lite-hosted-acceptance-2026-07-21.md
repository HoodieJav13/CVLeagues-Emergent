# Event Ledger Lite hosted acceptance — 2026-07-21

- **Completion level:** ACCEPTED
- **Project:** `orlhqewzprjadyrdrqxw` (`CVF Leagues`)
- **Integration commit at push:** `0eafcf99981f1d0dad57d0f3bcfd5d9e198cce93`
- **Schema commit:** `1b31693`
- **Authorization-harness commit:** `10d2446`
- **Migration:** `20260721201350_event_ledger_lite_schema.sql`
- **Real-session evidence:** [`hosted-auth-matrix-2026-07-21-m24.md`](hosted-auth-matrix-2026-07-21-m24.md)

## Authorization and scope

The owner separately approved both hosted mutations:

1. Apply only Migration 24, then perform structural and baseline readback and
   stop.
2. Run the fixture-writing 26-table hosted authorization matrix with automatic
   cleanup and exact baseline-restoration verification.

Neither approval authorizes a Sequence 4 runtime push, pilot fixture, Auth
change, migration repair, reset, or deployment.

## Pre-push gate

- The worktree was clean on `main@0eafcf9`; the test baseline and intended
  integration target were identical.
- The linked project was explicitly confirmed as CVF Leagues
  (`orlhqewzprjadyrdrqxw`).
- Migration history showed the first 23 migrations hosted and only Migration
  24 pending. The dry run named only
  `20260721201350_event_ledger_lite_schema.sql`.
- Fresh private logical exports were captured outside the repository and set
  to owner-only permissions:
  - schema: `/private/tmp/cvf-leagues-pre-m24-schema-2026-07-21.sql` — SHA-256
    `714ab96f6095532bfbe7d34d9abee4e54aaa389bc6db8c7683ba0341362eb593`
  - public data: `/private/tmp/cvf-leagues-pre-m24-data-2026-07-21.sql` — SHA-256
    `67997fa3af1ced997a195e18781c214cebcff88d4ca8d7a08b8f658d15bbb39e`
- The observed operational baseline contained one administrator, one league,
  one team identity, one team, one profile, one roster row, one settings row,
  and two seasons. All games, scoring/history, payments, intake, waiver,
  playoff, Hall of Fame, and ledger tables were empty. `hof_published=false`,
  `current_season='Summer 2026'`, and no current waiver version existed.

## Hosted application and structural readback

- `supabase db push --linked --yes`: **PASS**. The CLI emitted the known
  post-application pg-delta cache warning because its temporary target CA file
  was absent; migration history, structural readback, and the post-push dry run
  independently confirmed that this warning did not affect the applied schema.
- Hosted migration history: **24/24 aligned**. Post-push dry run: **remote
  database up to date**.
- Public base tables with RLS: **26/26**.
- Ledger relations: **4/4 present**, with **0** total rows after the push and
  after matrix cleanup.
- Game-mode columns: **2/2**; existing non-aggregate games: **0**.
- Expected ledger safeguards: **9/9 triggers**, **7/7 helper functions**, and
  **3/3 critical active-session/anti-fork indexes**.
- The ledger catalog gate passed all seven checks: table presence, RLS,
  AAL2-admin read policies, zero anonymous privilege, authenticated SELECT-only
  privilege, zero `service_role` privilege, and no client/service execution of
  trigger helpers.
- Direct hosted catalog inspection found **74/74** public foreign-key
  constraints covered by indexes and no uncovered relation. This supersedes
  the narrower 60/60 figure in the dated local-only evidence.
- Security Advisor: **23** previously accepted findings and no ledger-specific
  finding. Performance Advisor: **38** findings — 35 unused-index INFOs,
  including 25 expected on the empty ledger relations, plus the three existing
  multiple-policy WARNs. No unindexed-foreign-key warning was reported.

## Real-session acceptance

The owner entered both disposable test-account passwords and the administrator
TOTP only in the local browser harness. The generated report uses a UTC
execution date of July 22 while this repository checkpoint is dated July 21 in
America/Denver. The terminal reported:

```text
RESULT PASS: 225/225 browser/API and catalog checks passed.
CLEANUP PASS: fixture namespace contains zero rows.
BASELINE PASS: all row counts and settings restored.
```

The total comprises 218 browser/API checks and seven privileged catalog checks.
It covers anonymous, authenticated non-admin, password-only linked-admin, and
AAL2 administrator behavior; all 26 public tables; all 15 existing
administrator RPCs; the four ledger relations' read/write boundary; and the
existing intake, payment, playoff, team-identity, Hall of Fame, score, lock,
history, and public/private-read guarantees.

A fresh read-only post-matrix query again confirmed all 26 row counts and the
singleton settings exactly matched the recorded pre-run baseline. The four
ledger relations remained empty and every expected Migration-24 structural
object remained present.

## Known coverage boundary

Migration 24 intentionally provides no legitimate client ledger-write path.
The hosted matrix therefore proves all client writes are denied and that an
AAL2 administrator can successfully query each ledger table, but those
positive reads may return an empty array. Local pgtest `ledger schema 46`
proves positive-row policy behavior. Sequence 4's first controlled hosted write
must close the cross-role proof against the same populated row: AAL2 can read
it while authenticated non-admin and AAL1 sessions remain RLS-empty.

## Disposition

Sequence 3 Event Ledger Lite is **hosted-accepted**. Its schema remains dormant:
there is still no client-facing ledger mutation RPC, deterministic projection,
public live-score surface, or second correction authority. Sequence 4 may begin
only through its documented local verification and separately approved hosted
gates.
