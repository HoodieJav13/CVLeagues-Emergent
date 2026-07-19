# Hosted authorization matrix evidence — 2026-07-17

- **Overall:** FAIL
- **Project:** `orlhqewzprjadyrdrqxw`
- **Run namespace:** `cvf-matrix-2026-07-17-e2ad8515`
- **Executed:** 2026-07-17T05:19:31.097Z to 2026-07-17T05:20:24.434Z
- **Browser/API checks:** 17 passed, 1 failed
- **Fixture residue check:** PASS
- **Baseline restoration:** PASS
- **Credentials:** Auth passwords were entered only in the local browser harness. Passwords, access/refresh tokens, database credentials, and service-role keys were neither logged nor written to this report.

## Context

This is the durable rerun of the hosted authorization matrix that originally exposed the frontend authorization defects fixed by commits `0b6933c` and `c5b55c2`. The procedure is defined in [`HOSTED_AUTH_RUNBOOK.md`](../HOSTED_AUTH_RUNBOOK.md).

## Category summary

| Category | Passed | Failed |
|---|---:|---:|
| MFA authorization | 17 | 0 |
| harness | 0 | 1 |

## Detailed results

| Category | Check | Result | Detail |
|---|---|---|---|
| MFA authorization | linked password-only administrator resolves identity | PASS | Expected behavior observed. |
| MFA authorization | linked password-only administrator is not authorized | PASS | Expected behavior observed. |
| MFA authorization | linked password-only administrator cannot execute save_score | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute lock_game | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute unlock_game | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute set_game_status | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute approve_registration | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute assign_free_agent | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute verify_waiver | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute generate_single_elim_bracket | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute schedule_playoff_match | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute link_playoff_game | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute advance_playoff_match | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute enroll_team_identity | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute create_team_identity_and_enroll | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute update_team_identity | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute update_team_enrollment | PASS | Rejected by assert_admin(). |
| harness | matrix execution | FAIL | Administrator has no verified TOTP factor. Enroll through the application first. |

## Fixture cleanup and baseline restoration

| Invariant | Before | After | Result |
|---|---:|---:|---|
| admin_users | 1 | 1 | PASS |
| career_baselines | 0 | 0 | PASS |
| charges | 0 | 0 | PASS |
| current_season | Summer 2026 | Summer 2026 | PASS |
| free_agents | 0 | 0 | PASS |
| game_edit_history | 0 | 0 | PASS |
| games | 0 | 0 | PASS |
| hof_entries | 0 | 0 | PASS |
| hof_published | false | false | PASS |
| league_settings | 1 | 1 | PASS |
| leagues | 0 | 0 | PASS |
| payment_entries | 0 | 0 | PASS |
| player_stats | 0 | 0 | PASS |
| playoff_brackets | 0 | 0 | PASS |
| playoff_matches | 0 | 0 | PASS |
| playoff_seeds | 0 | 0 | PASS |
| profiles | 0 | 0 | PASS |
| seasons | 1 | 1 | PASS |
| team_identities | 0 | 0 | PASS |
| team_players | 0 | 0 | PASS |
| team_registrations | 0 | 0 | PASS |
| teams | 0 | 0 | PASS |
| waiver_versions | 0 | 0 | PASS |
| waivers | 0 | 0 | PASS |

Fixture residue query: `{"history_rows":0,"identity_rows":0,"league_rows":0,"profile_rows":0,"season_rows":0,"waiver_rows":0}` — **PASS**.

## Disposition

The gate remains open. Diagnose every failed row above, preserve the cleanup evidence, and do not downgrade the failure.
