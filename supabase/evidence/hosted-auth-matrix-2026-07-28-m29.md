# Hosted authorization matrix evidence — 2026-07-28

- **Overall:** FAIL
- **Project:** `orlhqewzprjadyrdrqxw`
- **Surface:** `m29` — Migration 29 (venues, authoritative start times, participation)
- **Expected census:** 29 migrations · 28 tables · 26 admin RPCs
- **Observed hosted ledger:** 29 migrations applied, latest `20260726120000` — verified against the local sequence before baseline capture
- **Fixture game shape:** `starts_at` (venue seeded)
- **Run namespace:** `cvf-matrix-2026-07-28-d341f6d4`
- **Executed:** 2026-07-28T23:26:33.668Z to 2026-07-28T23:27:19.502Z
- **Browser/API checks:** 44 passed, 1 failed
- **Server catalog checks:** 8 passed, 0 failed
- **Combined checks:** 52 passed, 1 failed
- **Fixture residue check:** PASS
- **Baseline restoration:** PASS
- **Credentials:** Auth passwords were entered only in the local browser harness. Passwords, access/refresh tokens, database credentials, and service-role keys were neither logged nor written to this report.

## Context

This is the durable rerun of the hosted authorization matrix that originally exposed the frontend authorization defects fixed by commits `0b6933c` and `c5b55c2`. The procedure is defined in [`HOSTED_AUTH_RUNBOOK.md`](../HOSTED_AUTH_RUNBOOK.md).

## Category summary

| Category | Passed | Failed |
|---|---:|---:|
| ledger catalog | 8 | 0 |
| MFA authorization | 44 | 0 |
| harness | 0 | 1 |

## Detailed results

| Category | Check | Result | Detail |
|---|---|---|---|
| ledger catalog | all four ledger tables exist | PASS | Expected catalog boundary observed. |
| ledger catalog | all four ledger tables have RLS enabled | PASS | Expected catalog boundary observed. |
| ledger catalog | all four ledger tables have the AAL2 admin-read policy | PASS | Expected catalog boundary observed. |
| ledger catalog | anonymous has no ledger table privilege | PASS | Expected catalog boundary observed. |
| ledger catalog | authenticated has SELECT-only ledger privileges | PASS | Expected catalog boundary observed. |
| ledger catalog | service_role has no ledger table privilege | PASS | Expected catalog boundary observed. |
| ledger catalog | ledger trigger helpers are not client or service executable | PASS | Expected catalog boundary observed. |
| ledger catalog | all ten ledger runtime RPCs are authenticated-only | PASS | Expected catalog boundary observed. |
| MFA authorization | linked password-only administrator resolves identity | PASS | Expected behavior observed. |
| MFA authorization | linked password-only administrator is not authorized | PASS | Expected behavior observed. |
| MFA authorization | linked password-only administrator cannot execute submit_score | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute lock_game | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute correct_final_score | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute set_game_status | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute approve_registration | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute assign_free_agent | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute verify_waiver | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute generate_single_elim_bracket | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute schedule_playoff_match | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute link_playoff_game | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute advance_playoff_match | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute enroll_team_identity | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute create_team_identity_and_enroll | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute update_team_identity | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute update_team_enrollment | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute start_scorekeeping_session | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute renew_scorekeeping_session | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute resume_scorekeeping_session | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute append_scorekeeping_event | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute replace_scorekeeping_event | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute finalize_scorekeeping_session | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute cancel_scorekeeping_session | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute declare_ledger_forfeit | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute start_scorekeeping_correction | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute finalize_scorekeeping_correction | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot execute set_game_participation | PASS | Rejected by the assert_admin() guard. |
| MFA authorization | linked password-only administrator cannot read scorekeeping_sessions | PASS | SELECT grant reached RLS and returned zero private rows. |
| MFA authorization | linked password-only administrator cannot insert scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot update scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot delete scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot read scorekeeping_participants | PASS | SELECT grant reached RLS and returned zero private rows. |
| MFA authorization | linked password-only administrator cannot insert scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot update scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot delete scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot read scorekeeping_events | PASS | SELECT grant reached RLS and returned zero private rows. |
| MFA authorization | linked password-only administrator cannot insert scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot update scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot delete scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot read scorekeeping_event_attributions | PASS | SELECT grant reached RLS and returned zero private rows. |
| MFA authorization | linked password-only administrator cannot insert scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot update scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| MFA authorization | linked password-only administrator cannot delete scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| harness | matrix execution | FAIL | Invalid TOTP code entered |

## Fixture cleanup and baseline restoration

| Invariant | Before | After | Result |
|---|---:|---:|---|
| admin_users | 1 | 1 | PASS |
| career_baselines | 0 | 0 | PASS |
| charges | 0 | 0 | PASS |
| current_season | Summer 2026 | Summer 2026 | PASS |
| free_agents | 0 | 0 | PASS |
| game_edit_history | 0 | 0 | PASS |
| game_participation | 0 | 0 | PASS |
| games | 0 | 0 | PASS |
| hof_entries | 0 | 0 | PASS |
| hof_published | false | false | PASS |
| league_settings | 1 | 1 | PASS |
| leagues | 1 | 1 | PASS |
| payment_entries | 0 | 0 | PASS |
| player_stats | 0 | 0 | PASS |
| playoff_brackets | 0 | 0 | PASS |
| playoff_matches | 0 | 0 | PASS |
| playoff_seeds | 0 | 0 | PASS |
| profiles | 1 | 1 | PASS |
| scorekeeping_event_attributions | 0 | 0 | PASS |
| scorekeeping_events | 0 | 0 | PASS |
| scorekeeping_participants | 0 | 0 | PASS |
| scorekeeping_sessions | 0 | 0 | PASS |
| seasons | 2 | 2 | PASS |
| team_identities | 1 | 1 | PASS |
| team_players | 1 | 1 | PASS |
| team_registrations | 0 | 0 | PASS |
| teams | 1 | 1 | PASS |
| venues | 0 | 0 | PASS |
| waiver_versions | 0 | 0 | PASS |
| waivers | 0 | 0 | PASS |

Fixture residue query: `{"history_rows":0,"identity_rows":0,"league_rows":0,"profile_rows":0,"season_rows":0,"waiver_rows":0}` — **PASS**.

## Disposition

The gate remains open. Diagnose every failed row above, preserve the cleanup evidence, and do not downgrade the failure.
