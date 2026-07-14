# CVF Leagues — Extended Runway Implementation Record

## Status

Local implementation completed on July 14, 2026. Hosted migration, hosted verification, deployment, secrets, legal approval, and final launch acceptance remain owner-controlled.

Companion decision record: [CVF Leagues — Extended Runway Product Decisions](https://app.notion.com/p/39d075acdeec815ca1cff7814196a4ed).

## Locked decisions implemented

- Season 1 remains admin-only. Player and captain records are not Auth accounts.
- Waivers and game edit history remain append-only. Final waiver text still requires New Mexico attorney approval.
- Payments remain a manual, admin-only, admin-correctable bookkeeping ledger. Reversal/void accounting, Stripe, player-visible balances, and automated collection are out of scope.
- Standalone tournament statistics are stored but excluded from league-season and league-career/all-time totals.
- Season 1 playoffs are variable-size, fixed single-elimination brackets with all teams qualifying, standings/H2H/point-differential seeding, highest-seed byes, manual advancement, and a third-place game.
- Hall of Fame curation is admin-only. No public Hall of Fame route or publication control was added.
- A persistent `team_identities` record owns canonical name, color, and founded year. A `teams` row is one explicit league/season/sport/tournament enrollment. New enrollments copy only the brand shell and never copy rosters, payments, games, stats, waivers, or registrations.
- The seven overlapping permissive RLS policies remain intentionally deferred because they are a performance finding, not a correctness finding, and changing them would reopen a verified authorization surface.
- Player/captain self-service remains deferred because it is a deliberate Season 1 risk boundary, adds a third authorization role, and intersects the unresolved waiver/eligibility dependency.

## Completed stages and commits

| Stage | Outcome | Commits |
|---|---|---|
| Launch hardening | AAL2/TOTP admin authorization, protected public intake boundary, production environment validation | `92ed963`, `3615d82` |
| Season and stat isolation | Per-sport current-season defaults; explicit league season context; tournament totals separated from league career | `0c4f9d4`, `1fee215` |
| Playoffs | Public bracket schema/RLS/RPCs; variable-size Season 1 seeding, byes, third-place path, scheduling/linking, manual advancement, safe unlock retraction | `1b8f157`, `c5ff3ab` |
| Payments | Admin-only charge/payment UI with team/profile targets, partial balances, filters, edit/delete confirmation, notes, and CSV export | `46b54dd` |
| Hall of Fame | Admin-only player/game/record curation and preview; publication stays gated | `c5ca031` |
| Team continuity | Persistent identities, explicit cross-season/cross-sport enrollment, registration approval integration, canonical brand propagation, no history carryover | `4738e02`, `c87e4dd` |

## Verification evidence

- `supabase db reset` applied all 16 migrations from scratch in an isolated local Supabase project.
- `./tests/pgtest/run_pgtest.sh`: 144/144 passed.
- `cd frontend && CI=true npm test -- --watchAll=false`: 18/18 passed.
- `cd frontend && npm run build`: compiled successfully with production environment validation (a documented Cloudflare test site key was used only for the local build gate).
- `supabase db lint --local --schema public --level warning --fail-on error`: passed with no errors. It reports only five pre-existing bracket-function warnings for shadowed/unused loop declarations.
- Hosted authorization harness JavaScript passes `node --check` and now covers 22 tables, 13 admin RPC denial paths, team-identity public reads, cross-sport enrollment, and shell-only carryover.
- Browser verification in mock mode confirmed identity creation, cross-sport enrollment, zero-roster enrollment shells, responsive identity cards, success feedback, and no console errors.
- The prior hosted baseline remains evidenced at `supabase/evidence/hosted-auth-matrix-2026-07-13.md` (66/66 checks). The new local changes have not been represented as hosted-verified.

## Rollback boundaries

- Frontend stages are isolated in focused commits and can be reverted independently before deployment.
- Database work is additive. Before any hosted push, review the four pending migrations with `supabase migration list` and `supabase db push --dry-run`.
- After hosted application, rollback should use a reviewed forward migration. Do not reset production, repair migration history, or destructively remove identity/bracket data.
- Team enrollments deactivate instead of deleting, preserving games, rosters, charges, and history.

## Owner checkpoint: hosted acceptance

Do not perform these steps implicitly:

1. Review the four pending migrations and the complete relevant diff.
2. Confirm a current off-platform database backup/export and recovery plan.
3. Run `supabase migration list`, then `supabase db push --dry-run`; confirm exactly the expected four migrations in filename order.
4. Approve the hosted `supabase db push` separately.
5. Re-run migration history and catalog checks, the expanded real-session authorization matrix, and Supabase Security and Performance Advisors.
6. Configure/verify Turnstile secrets, preview/production public variables, admin TOTP/recovery/session revocation, and fail-closed production behavior.
7. Run the live application acceptance flows against hosted data, then approve preview and production deployments separately.
8. Insert attorney-approved waiver text as a new immutable version; never substitute draft or fallback legal text.

## Remaining product decisions and blind spots

- Decide whether a profile-only charge must also carry league/sport context before multiple simultaneous seasons make that ambiguity operationally important.
- Define tournament-specific public/admin stat views before recording tournament data at scale; storage is isolated now, but a dedicated tournament leaderboard/history UI is not built.
- Define bracket correction operations for the rare case where a downstream playoff game has already been scheduled; current behavior correctly blocks unsafe upstream unlocks.
- Define whether canonical brand edits should rewrite every displayed historical enrollment forever. The current implementation deliberately does; if immutable historical branding is preferred later, add explicit snapshot/display fields rather than weakening the identity invariant silently.
- Reassess RLS policy consolidation only from measured query volume or while already redesigning authorization.
- Treat player/captain self-service as a separate security program with email verification, reset/recovery, abuse controls, safe profile claim/linking, and a new anonymous/non-admin/captain/admin authorization matrix.
