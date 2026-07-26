# CVF Leagues Project Policy

**Protocol version:** v1.2

Repository-specific policy for the CVF agent loop. This file mirrors and
operationalizes `AGENTS.md`; it does not replace the repository working
agreement, redefine Protocol v1.2, or weaken higher-level safety controls.

## Autonomy envelope

- Envelope version: 2026-07-25
- Permission posture: bounded autonomy inside an owner-approved local stage;
  supervised checkpoints for commits and external actions
- Tool adapter: Codex managed workspace, repository tools, and explicitly
  configured authenticated connectors
- Workspace boundary: this repository and explicitly declared isolated
  worktrees; preserve every unrelated branch, worktree, stash, and untracked
  file
- Credential visibility: configured credentials may be used only for an
  authorized action; raw credentials must never be read, printed, copied,
  stored, or requested
- Missing-envelope behavior: read-only orientation, then stop before mutation

## Authority defaults

- Inspect: allowed
- Edit and test: allowed only inside the current owner-approved local stage
- Commit: confirmation after the complete reviewed diff and evidence checkpoint
- Push: confirmation for the exact branch and target
- Merge or direct delivery to the default branch: confirmation
- Deploy and hosted mutation: confirmation for the exact named action and
  target; broader sequence approval is insufficient
- Hosted migration: requires the literal approval token
  `approved: hosted push of migrations X–Y` with the exact migration range
- External messages: confirmation
- Destructive history: forbidden

## Commit and delivery conventions

- Audit Git state before editing and preserve unrelated work.
- Work one approved roadmap stage at a time and satisfy its gate before
  proposing the next stage.
- Keep schema, functional, test, documentation, and visual changes in focused
  commits.
- Before commit, present the complete relevant diff, every test result,
  remaining risks, rollback, and confirmation that unrelated files are
  untouched.
- Commit, push, pull request, merge, deploy, and hosted writes remain distinct
  authority actions. Never infer a higher rung from approval of a lower one.

## Data, authorization, and migration invariants

- Season 1 is admin-only. An Auth User is not a Player and
  `profiles.auth_user_id` remains nullable.
- Enable RLS on every exposed table. Verify Data API grants and RLS separately
  for anonymous, authenticated non-admin, lower-assurance admin, AAL2 admin,
  and applicable service roles.
- Keep waivers, scorekeeping evidence, and game edit history append-only.
- Ledger events are the sole correction authority for ledger-mode games;
  projections and audit history are outputs, never parallel writable inputs.
- Use additive migrations created through the installed Supabase CLI after
  checking current help. Never manually mutate hosted schema when a migration
  is appropriate.
- Never reset hosted state, repair migration history, restore data, or perform
  another destructive database action without explicit owner approval and a
  rollback plan.
- Public profile reads use explicit safe-field allowlists and expose no PII.
- Anonymous forms require abuse protection before public launch.

## Deployment architecture

- Frontend preview/production deploy through the repository's configured
  Vercel path; database changes deploy through linked Supabase migrations.
- Production and preview never silently fall back to mock or localStorage
  data. Mock persistence is local-development-only and explicitly selected.
- Before a hosted migration, verify CLI help/version, migration alignment,
  fresh backup, dry run, expected delta, and baseline. Structural publication
  and behavioral acceptance remain separate gates.

## Product and feature-retirement policy

- The owner's latest direct instruction controls active roadmap scope.
- The prior freeze was explicitly lifted only for reactivation stage R1:
  reconcile accepted Sequence 4 commit `fa737b2` with the already committed
  local Sequence 5A work and install this contract. The stage stops at an
  owner-reviewed local merge commit. See
  `docs/scoring/REACTIVATION_DECISION_2026-07-25.md`.
- Migration 28 publication/acceptance, later sequences, durable pilot work,
  UI batches, and official use require new owner-approved stages.
- Season 1 remains aggregate-by-default until a separately approved ledger
  pilot. Preserve dormant future-season mechanisms rather than deleting them
  when a Season 1 rule supersedes their current use.
- Attorney-approved waiver text remains an independent launch blocker.

## Design and visual policy

- Read `docs/direction/CVLeagues_Art_Direction_Contract.md` before visual work;
  every addendum is binding.
- Use Apple Sports for Home/Schedule, simplified World Cup 2026 for
  Standings/Playoffs, and OT7 for Leaderboards/stats.
- Genuine direction decisions require both a compliant treatment and a
  deliberately bolder compliant variant. Respect accessibility and
  reduced-motion requirements.
- Use `BLOCKING`, `NON-BLOCKING`, `VISUALLY INSUFFICIENT`, and `ALREADY FINE`
  verdicts with concrete visual delta and implementation cost.

## Credentials and external systems

- Configured GitHub, Supabase, Vercel, and other connectors may be used only
  for actions marked allowed in the current authority ledger.
- The owner enters secrets, MFA, billing, account, legal, and domain values.
  Never expose service-role or secret keys to frontend code or reports.
- Hosted mutation probes require the same explicit authority as successful
  hosted writes, even when denial is expected.

## Context documentation

- Source-of-truth order within the applicable instruction layer:
  owner's latest direction, locked roadmap principles and invariant matrices,
  verified code/runtime/tests, `CLAUDE.md`, Notion roadmap, then older reports.
- `CLAUDE.md` is authoritative for current product status and owner actions.
  `supabase/README.md`, the hosted authorization runbook, scoring invariant
  matrix, and dated evidence files govern their respective technical claims.
- Record milestones, decisions, blockers, completion date, and commit hashes
  durably. Preserve dated evidence; write a new file for a new run rather than
  rewriting historical proof.

## Stop and escalation behavior

- Stop for new product or schema decisions, scope expansion, authorization or
  money semantics, PII exposure, legal posture, credentials, hosted actions,
  destructive actions, commit, push, merge, deployment, and final acceptance.
- Treat owner gates as resumable pauses. Report the decision, directly
  verified evidence, options, and consequences; no agent may answer for the
  owner.
- A broad instruction such as “execute sequences X–Y” authorizes only the
  approved local work and never pre-authorizes a hosted mutation.
