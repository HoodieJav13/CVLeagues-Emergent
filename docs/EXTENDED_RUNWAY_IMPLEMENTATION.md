# CVF Leagues — Extended Runway Implementation Record

## Status

Local implementation completed on July 14, 2026. Hosted migration, hosted verification, deployment, secrets, legal approval, and final launch acceptance remain owner-controlled.

Companion decision record: [CVF Leagues — Extended Runway Product Decisions](https://app.notion.com/p/39d075acdeec815ca1cff7814196a4ed).

## Locked decisions implemented

- Season 1 remains admin-only. Player and captain records are not Auth accounts.
- Waivers and game edit history remain append-only. Final waiver text still requires New Mexico attorney approval.
- Payments remain a manual, admin-only, admin-correctable bookkeeping ledger. Reversal/void accounting, Stripe, player-visible balances, and automated collection are out of scope.
- `payment_entries.recorded_by` is client-supplied convenience metadata, not trustworthy audit attribution.
- Standalone tournament statistics are stored but excluded from league-season and league-career/all-time totals.
- Granular player statistics derive season/domain through their game and league. Once statistics exist, the game cannot change `league_id` and the league cannot change `season` or `kind`; atomic season-name cascades remain supported.
- Career baselines are accepted non-blocking import debt: a season may be represented either in `career_baselines` or in granular game statistics, never both, or career totals will double-count it.
- The legacy `league_settings.current_season` column is accepted non-blocking compatibility debt. Current clients use the sport-specific defaults; older consumers must not treat the legacy value as authoritative after the two sport defaults diverge.
- Season 1 playoffs are variable-size, fixed single-elimination brackets with all teams qualifying, standings/H2H/point-differential seeding, highest-seed byes, manual advancement, and a third-place game.
- Playoff bracket, seed, and match tables are read-only through the client Data API; verified RPCs exclusively own topology, scheduling linkage, advancement, and safe retraction mutations.
- Hall of Fame curation and the `hof_entries` base table are admin-only. Published display fields are exposed only through the explicit `public_hof_entries` allowlist; no public Hall of Fame route or publication control was added.
- A persistent `team_identities` record owns canonical name, color, and founded year. A `teams` row is one explicit league/season/sport/tournament enrollment. New enrollments copy only the brand shell and never copy rosters, payments, games, stats, waivers, or registrations.
- Persistent team identities and their enrollments are read-only through the client Data API; narrow admin RPCs own creation, enrollment, canonical-brand edits, and enrollment lifecycle edits.
- The server-held Supabase secret has INSERT-only Data API access to `team_registrations` and `free_agents`; it cannot read submitted PII or perform DML on unrelated current or future public tables.
- The remaining overlapping permissive RLS policies stay intentionally deferred because they are a performance finding, not a correctness finding, and changing them would reopen a verified authorization surface. The team-table overlap disappeared naturally when direct team writes were removed; no unrelated consolidation was attempted.
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
| Retroactive audit hardening | Exhaustive AAL1 admin-RPC denials; fail-closed RoleContext/RoleGate tests; post-stat historical classification guards | Pending owner-reviewed commits |

## RPC-only mutation helper pattern

Revoking authenticated table DML can also remove privileges that invoker-context trigger helpers previously relied on. Treat that as an expected part of every RPC-only conversion: audit the full trigger/helper chain, row-lock requirements, object grants, and negative bypass coverage. Use `SECURITY DEFINER` only for a helper that genuinely must retain an owner-only operation, always with a fixed `search_path` and no client `EXECUTE` grant. In this pass, `enforce_charge_team_season()` required that treatment because its `FOR SHARE` lock needs table `UPDATE` privilege after direct team updates were revoked; the bracket and team mutation RPCs were already admin-guarded definers. `cvf_palette_color(integer)` did not require definer privileges—it remains a pure invoker helper with an immutable `pg_catalog` search path and an explicit narrow execute grant. This is the established RPC-lockdown pattern, not a new judgment call each time it recurs.

## Verification evidence

- A real local Supabase stack (Postgres, GoTrue, PostgREST, and Kong) reset cleanly and applied all 21 migrations in filename order.
- The complete database harness against the real stack passed 211/211, including four service-role privilege-boundary assertions.
- A 64-check live HTTP matrix passed with real anonymous, authenticated non-admin, AAL1 linked-admin, and AAL2 admin sessions. It covered bracket/seed/match RPC-only mutation, payments CRUD authorization, the `public_hof_entries` publication allowlist, team identity/enrollment RPCs, and INSERT-only protected intake. Fixture cleanup returned zero matching rows.
- Local Security Advisor: one known intentional `admin_users` deny-all INFO; no new finding.
- Local Performance Advisor: 12 expected unused-index INFOs and four previously accepted overlapping-permissive-policy WARNs (down from seven); no new finding.
- Local GoTrue version skew logged only: `v2.193.0` local versus `v2.192.0` linked hosted.
- `./tests/pgtest/run_pgtest.sh`: 211/211 passed after the service-role shim update.
- `cd frontend && CI=true npm test -- --watchAll=false`: 37/37 passed.
- `cd frontend && npm run build`: compiled successfully with production environment validation (a documented Cloudflare test site key was used only for the local build gate).
- `supabase db lint --local --schema public --level warning --fail-on error`: passed with no errors. It reports only five pre-existing bracket-function warnings for shadowed/unused loop declarations.
- Hosted authorization harness JavaScript passes `node --check` and now covers 22 tables, 15 admin RPC denial paths, explicit payments CRUD authorization, team-identity public reads, RPC-only cross-sport enrollment, and shell-only carryover.
- Browser verification in mock mode confirmed identity creation, cross-sport enrollment, zero-roster enrollment shells, responsive identity cards, success feedback, and no console errors.
- A temporary local-only Fall 2025 league fixture with one completed stats-bearing game proved rendered season switching: Summer 2026 home-run leaders showed a top value of 2, while Fall 2025 isolated the fixture players at 7 and 1. The fixture and persisted mock state were removed afterward; the seed file hash was restored and only Summer 2026 remained selectable.
- The prior hosted baseline remains evidenced at `supabase/evidence/hosted-auth-matrix-2026-07-13.md` (66/66 checks). The new local changes have not been represented as hosted-verified.

## Rollback boundaries

- Frontend stages are isolated in focused commits and can be reverted independently before deployment.
- Database work is additive. Before any hosted push, review the nine pending migrations with `supabase migration list` and `supabase db push --dry-run`.
- After hosted application, rollback should use a reviewed forward migration. Do not reset production, repair migration history, or destructively remove identity/bracket data.
- Team enrollments deactivate instead of deleting, preserving games, rosters, charges, and history.

## Owner checkpoint: hosted acceptance

Do not perform these steps implicitly:

1. Review the nine pending migrations and the complete relevant diff.
2. Confirm a current off-platform database backup/export and recovery plan.
3. Run `supabase migration list`, then `supabase db push --dry-run`; confirm exactly the expected nine migrations in filename order.
4. Approve the hosted `supabase db push` separately.
5. Re-run migration history and catalog checks, the expanded real-session authorization matrix, and Supabase Security and Performance Advisors.
6. Configure/verify Turnstile secrets, preview/production public variables, admin TOTP/recovery/session revocation, and fail-closed production behavior.
7. Run the live application acceptance flows against hosted data, then approve preview and production deployments separately.
8. Insert attorney-approved waiver text as a new immutable version; never substitute draft or fallback legal text.

## Remaining product decisions and blind spots

- The profile-only charge sport/season ambiguity and the legacy `current_season` singleton are the same underlying modeling gap: a season label alone cannot identify concurrent sport/container context. Revisit them together when season/sport modeling is next redesigned.
- Define tournament-specific public/admin stat views before recording tournament data at scale; storage is isolated now, but a dedicated tournament leaderboard/history UI is not built.
- Define bracket correction operations for the rare case where a downstream playoff game has already been scheduled; current behavior correctly blocks unsafe upstream unlocks.
- Define whether canonical brand edits should rewrite every displayed historical enrollment forever. The current implementation deliberately does; if immutable historical branding is preferred later, add explicit snapshot/display fields rather than weakening the identity invariant silently.
- Hall of Fame entries do not currently enforce cross-field consistency between optional game/profile/team context and the selected sport, season, or record scope. This is low risk under the single-curator model; revisit it if curation permissions ever expand.
- Reassess RLS policy consolidation only from measured query volume or while already redesigning authorization.
- Treat player/captain self-service as a separate security program with email verification, reset/recovery, abuse controls, safe profile claim/linking, and a new anonymous/non-admin/captain/admin authorization matrix.
