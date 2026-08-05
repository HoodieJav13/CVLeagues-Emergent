# Migration 30 hosted push — structural gate record (2026-08-04)

Owner token: `approved: hosted push of migrations 30-30`, issued 2026-08-04 in
the session that executed runbook steps 14–17. Step 18 (`--surface m30`
matrix) is NOT covered by this record and remains separately approved.

## Step 14 — fresh off-platform logical export (pre-push)

Project `CVF Leagues` (`orlhqewzprjadyrdrqxw`) was found `INACTIVE` (free-plan
idle pause, ~7 days after the last hosted action) and restored by the owner
from the dashboard before any step ran. The unrelated `CVFPT-Main` project was
verified not linked and was not touched.

Exports written outside the repository, mode `0600`, and copied to
`~/Documents/cvf-backups/` with post-copy hash verification:

- schema: `cvf-leagues-pre-m30-schema-2026-08-04.sql` — 264,867 bytes —
  SHA-256 `4b886726eded2a618b525d1628a6ba538b98e1475039db5d9d69423dcc32c29d`
- public data: `cvf-leagues-pre-m30-data-2026-08-04.sql` — 21,231 bytes —
  SHA-256 `2e0d309d7aef9ed92f1e3e190ff23fe2a0aaac5531a10bdfb32db75438931e85`

The data dump repeated the known self-referential-constraint warning
(restore must be constraint-aware), as first recorded in the Sequence 4 gate.
Pre-push sanity: the schema dump contained zero practice functions and did
contain the Migration 29 objects — the backup captures the true pre-M30 state.

## Step 15 — deployment safety (re-verified at push time)

- Zero repository webhooks and zero GitHub deployment records in the
  repository's entire history (`gh api`), and no CI workflows — verified fresh.
- Prior same-week live dashboard verification (external reviewer): the Vercel
  project has no connected Git repository; all Vercel deployments were
  manually initiated.
- The local `frontend/.vercel` link is inert (CLI not installed) and provides
  no push-triggered path.

## Step 16 — preflight and filename-exact dry run

- Branch `main`, clean tree; local and `origin/main` byte-identical at
  `7309f27`. CLI v2.109.0, linked project confirmed.
- Hosted ledger matched local migrations 1–29 exactly; `20260729182047`
  absent remotely.
- `supabase db push --dry-run` named `20260729182047_practice_mode_sessions.sql`
  and nothing else.

## Step 17 — push and structural readback

Push executed from `main@7309f27` after re-verifying the preflight held.
Post-push `supabase migration list --linked`: 30 rows, zero local/remote
mismatches, latest remote `20260729182047`.

Readback method: fresh post-push schema dump
(`/private/tmp/cvf-leagues-post-m30-schema-2026-08-04.sql`, 299,746 bytes,
mode `0600`) diffed against the pre-push export; every hunk attributed.

- **Seven practice functions** present, each `REVOKE ... FROM PUBLIC` +
  `GRANT EXECUTE ... TO authenticated` only — no `anon`, no `service_role`.
- **Table census unchanged**: 28 `CREATE TABLE` statements pre and post; no
  new relation.
- **`game_id` nullable** on all four private ledger tables (no `NOT NULL` in
  any of the four post-push definitions).
- **Four session-shape constraints at exact definitions** (from
  `pg_dump`-rendered `CHECK` bodies): `session_kind_check` with kinds
  `ordinary|correction|practice`; `stage_check` with stages
  `regular|playoff|tournament|practice`; `practice_game_check` as the
  biconditional `(session_kind = 'practice') = (game_id IS NULL)`;
  `kind_shape_check` present. The replaced auto-named
  `scorekeeping_sessions_check1` is **gone** (zero occurrences).
- **All eight replacement foreign keys** present: `sessions_base`,
  `participants_session`, `events_{session,voids_event,replaces_event}`,
  `event_attributions_{session,event,participant}`.
- **Both NULL-scope partial unique indexes** present with exact columns and
  `WHERE (game_id IS NULL)` predicates
  (`scorekeeping_events_practice_sequence_idx`,
  `scorekeeping_events_practice_idempotency_idx`).
- **Five re-emitted trigger functions byte-identical** between the hosted
  dump and the repository migration source (PL/pgSQL bodies compared verbatim
  between `$$` delimiters): `cvf_guard_scorekeeping_session` (6,028 chars),
  `cvf_prepare_scorekeeping_participant` (2,965),
  `cvf_prepare_scorekeeping_event` (9,146),
  `cvf_prepare_scorekeeping_attribution` (1,336),
  `cvf_validate_correction_event_target` (1,377).
- **RLS and policy surface unchanged**: zero `POLICY` or
  `ROW LEVEL SECURITY` lines and zero table-level grant/revoke lines in the
  pre/post diff. The only ACL changes are the seven new functions' own
  revoke/grant pairs.
- **Full diff attribution**: 742 changed lines total, 47 deletions; every
  deletion is a replaced constraint definition or an interior line of the
  five re-emitted function bodies; every addition is a practice function,
  constraint, FK, index, or function-body line introduced by Migration 30.

## Advisors (step 17, closed for security; performance expectation stated)

**Security Advisor — CONFIRMED AT ACCEPTED BASELINE (owner-run, 2026-08-04).**
The owner ran the dashboard advisor post-push. ERROR-level findings: exactly
the two intentional allowlisted definer-view ERRORs
(`public.public_profiles`, `public.public_hof_entries`) — the same pair
recorded as accepted baseline in
[`service-role-hardening-2026-07-15.md`](service-role-hardening-2026-07-15.md)
and
[`aggregate-scoring-hosted-acceptance-2026-07-21.md`](aggregate-scoring-hosted-acceptance-2026-07-21.md),
and the same boundary CLAUDE.md documents as deliberate with safe-field
allowlists and forbidden-PII regression tests. **No finding names any
practice object.** Migration 30 added no view, so no new definer-view
surface exists to flag.

**Performance Advisor — expected shape, to be confirmed at the step 18
session.** The accepted baseline is unused-index INFOs plus the deliberately
deferred overlapping-permissive-policy WARNs. Migration 30 adds two partial
unique indexes on empty scope, so up to two NEW unused-index INFOs
(`scorekeeping_events_practice_sequence_idx`,
`scorekeeping_events_practice_idempotency_idx`) are expected and benign.
Anything outside those classes joins this record before step 18 runs.

## Not done, deliberately

No `--surface m30` matrix run, no fixture write of any kind, and no
`DEFAULT_SURFACE` promotion — all step 18, separately approved. Hosted
behavioral acceptance for Migration 30 does not exist yet; Migration 29's
270/270 remains the latest accepted behavioral evidence.
