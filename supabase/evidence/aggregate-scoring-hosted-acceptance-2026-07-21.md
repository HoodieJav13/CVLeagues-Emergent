# Aggregate scoring hosted acceptance — 2026-07-21

- **Completion level:** ACCEPTED
- **Project:** `orlhqewzprjadyrdrqxw` (`CVF Leagues`)
- **Repository commit:** `a2333a11318a1167ac80f380e27ad89c06f04c41`
- **Migration:** `20260720031319_aggregate_scoring_hardening.sql`
- **Supabase CLI:** `2.109.0`
- **Real-session evidence:** [`hosted-auth-matrix-2026-07-21-m23.md`](hosted-auth-matrix-2026-07-21-m23.md)

## Pre-push gate

- **Authorization provenance:** The owner instructed Codex to “go ahead and execute sequence 2-3” after the Sequence 2 hosted-push checkpoint had been described. Codex treated that combined instruction as authorization to push Migration 23; there was no separate just-in-time owner confirmation immediately before the `supabase db push` command. The owner subsequently confirmed that this accurately describes the authorization path and established a stricter standing rule requiring a discrete approval immediately before every future hosted mutation.
- The clean `main` worktree and `origin/main` both resolved to `a2333a1`.
- Test baseline and integration target were identical: `main@a2333a1`.
- The authenticated Supabase account exposed two projects; the worktree was linked explicitly to `CVF Leagues` (`orlhqewzprjadyrdrqxw`), never the separate `CVFPT-Main` project.
- The repository contained exactly 23 migrations. The hosted ledger contained migrations 1–22, and `supabase db push --linked --dry-run` named only Migration 23.
- The Free-plan project reported WAL-G enabled, PITR disabled, and no retained physical backup. Before the push, private logical exports were written outside the repository:
  - schema: `/private/tmp/cvf-leagues-pre-m23-schema-2026-07-21.sql` — SHA-256 `ec103c67766f340cb5ab0bd65b32a67d0156cf95aab3371b7b8d2035dc0d7487`
  - public data: `/private/tmp/cvf-leagues-pre-m23-data-2026-07-21.sql` — SHA-256 `d657b6b270e381a4048df6eabc9cc5539e256c2626acfdcabb5a8377e6a381b9`
- The data-only export warned that the self-referential `playoff_matches` foreign keys require constraint-aware restoration. Rollback remains a reviewed forward migration; no reset, history repair, or destructive restore was performed.
- The pre-push service-role/default-ACL catalog passed: only `INSERT` on `team_registrations` and `free_agents`, zero public-function execution, zero public-sequence privileges, and zero `postgres` default-ACL leaks.
- The observed pre-push operational baseline was: `admin_users=1`, `seasons=2`, `leagues=1`, `team_identities=1`, `teams=1`, `profiles=1`, `team_players=1`, and `league_settings=1`; all games, scores, history, payments, intake, waiver, playoff, and Hall of Fame tables were empty. `hof_published=false`, `current_season='Summer 2026'`, and no waiver version existed.

## Local verification immediately before push

- `./tests/pgtest/run_pgtest.sh`: **PASS — 231/231**.
- Initial parallel frontend run: **FAIL — 116/117**, solely because the locked-score interaction test exceeded its fixed five-second timeout.
- Isolated `ScoreEntry.test.js`: **PASS — 2/2**; the affected test completed in 4.677 seconds, confirming a marginal timing assumption rather than a product assertion failure.
- Serial full frontend run: **PASS — 117/117** across 32 suites.
- `npm run build`: **PASS** after the separate worktree was given the existing ignored production public environment file; values were not printed or copied into tracked files.

## Hosted application and structural read-back

- The final pre-push migration list and dry run again showed only Migration 23.
- `supabase db push --linked --yes`: **PASS**. The CLI emitted a post-application pg-delta catalog-cache warning because a temporary CA file was absent. This was classified as a cache-only CLI warning after all structural read-backs below passed.
- Hosted migration list: **23/23 matched**.
- Post-push dry run: **remote database up to date**.
- `game_edit_history` contains the four approved aggregate audit columns: `before_state`, `after_state`, `override_reason`, and `validation_warnings`.
- Authenticated `games` inserts expose only the approved scheduling columns (`id`, league/sport/team/date/time/location/temp-admin/stage); updates expose the same set without `id`.
- Authenticated direct mutation privileges on `player_stats` and `game_edit_history`: **zero**.
- `submit_score`, `lock_game`, and `correct_final_score` are authenticated-only, fixed-search-path `SECURITY DEFINER` functions. `save_score`, `unlock_game`, and both internal aggregate helpers are not client-executable. Anonymous and `service_role` execution are denied on all seven scoring functions.
- All 22 public base tables retain RLS; direct score-write policies on `player_stats` and `game_edit_history` are absent.
- The entire observed operational row/settings baseline matched the pre-push values exactly.
- Post-push service-role/default-ACL catalog: **PASS**, unchanged from pre-push.
- Security Advisor: **23 known accepted findings** — 1 deny-all helper INFO, 2 intentional allowlisted definer-view ERRORs, 2 anonymous helper WARNs, 17 authenticated helper/admin-RPC WARNs, and 1 Free-plan leaked-password-protection WARN.
- Performance Advisor: **13 findings** — 10 early-baseline unused-index INFOs and 3 deferred overlapping-policy WARNs. Migration 23 removed the former `player_stats` overlap.

## Real-session acceptance

The owner entered both disposable test-account passwords and the administrator TOTP only in the local browser harness. The revised hosted matrix then reported:

```text
RESULT PASS: 154/154 browser/API checks passed.
CLEANUP PASS: fixture namespace contains zero rows.
BASELINE PASS: all row counts and settings restored.
```

The matrix covered anonymous, authenticated non-admin, password-only linked-admin, and AAL2 administrator behavior; all 15 client-facing admin RPCs; direct-write bypasses; append-only history; reasoned final correction; payments; playoff progression; team identities; Hall of Fame publication; and exact teardown. No credentials, tokens, database passwords, or service-role keys were written to evidence.

## Disposition

Sequence 2 aggregate validation and RPC-only correction is **hosted-accepted**. Sequence 3 Event Ledger Lite may begin against this twenty-three-migration integration target. The isolated Scorekeeping Foundation artifact must still pass Gate 1.5 reconciliation and must not restore the retired unlock flow or create a second final-score correction authority.
