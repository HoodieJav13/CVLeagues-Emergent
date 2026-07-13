# Hosted authorization matrix evidence — 2026-07-13

- **Overall:** PASS
- **Project:** `orlhqewzprjadyrdrqxw`
- **Run namespace:** `cvf-matrix-2026-07-13-a2c2319d`
- **Executed:** 2026-07-13T21:56:29.072Z to 2026-07-13T21:56:38.777Z
- **Browser/API checks:** 66 passed, 0 failed
- **Fixture residue check:** PASS
- **Baseline restoration:** PASS
- **Credentials:** Auth passwords were entered only in the local browser harness. Passwords, access/refresh tokens, database credentials, and service-role keys were neither logged nor written to this report.

## Context

This is the durable rerun of the hosted authorization matrix that originally exposed the frontend authorization defects fixed by commits `0b6933c` and `c5b55c2`. The procedure is defined in [`HOSTED_AUTH_RUNBOOK.md`](../HOSTED_AUTH_RUNBOOK.md).

## Category summary

| Category | Passed | Failed |
|---|---:|---:|
| identity | 3 | 0 |
| anonymous submissions | 4 | 0 |
| public reads | 9 | 0 |
| private reads | 16 | 0 |
| RPC denial | 14 | 0 |
| direct-write guards | 5 | 0 |
| admin RPC success | 7 | 0 |
| locked-game guards | 3 | 0 |
| edit history | 1 | 0 |
| Hall of Fame gate | 4 | 0 |

## Detailed results

| Category | Check | Result | Detail |
|---|---|---|---|
| identity | anonymous is_admin() is false | PASS | Expected behavior observed. |
| identity | authenticated non-admin is_admin() is false | PASS | Expected behavior observed. |
| identity | administrator is_admin() is true | PASS | Expected behavior observed. |
| anonymous submissions | clean team-interest submission succeeds | PASS | Expected behavior observed. |
| anonymous submissions | clean free-agent submission succeeds | PASS | Expected behavior observed. |
| anonymous submissions | clean current-version waiver submission succeeds | PASS | Expected behavior observed. |
| anonymous submissions | anonymous intake cannot set triage state | PASS | Denied as required. |
| public reads | anonymous can read fixture seasons | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture leagues | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture teams | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture team_players | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture games | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture league_settings | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture waiver_versions | PASS | Expected behavior observed. |
| public reads | public_profiles exposes allowlisted fixture profile | PASS | Expected behavior observed. |
| public reads | public_profiles rejects PII column selection | PASS | Denied as required. |
| private reads | anonymous cannot read admin_users | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read admin_users | PASS | Denied at the Data API boundary. |
| private reads | anonymous cannot read profiles | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read profiles | PASS | RLS returned zero private rows. |
| private reads | anonymous cannot read waivers | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read waivers | PASS | RLS returned zero private rows. |
| private reads | anonymous cannot read team_registrations | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read team_registrations | PASS | RLS returned zero private rows. |
| private reads | anonymous cannot read free_agents | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read free_agents | PASS | RLS returned zero private rows. |
| private reads | anonymous cannot read game_edit_history | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read game_edit_history | PASS | RLS returned zero private rows. |
| private reads | anonymous cannot read charges | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read charges | PASS | RLS returned zero private rows. |
| private reads | anonymous cannot read payment_entries | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read payment_entries | PASS | RLS returned zero private rows. |
| RPC denial | anonymous cannot execute save_score | PASS | Denied as required. |
| RPC denial | non-admin cannot execute save_score | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute lock_game | PASS | Denied as required. |
| RPC denial | non-admin cannot execute lock_game | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute unlock_game | PASS | Denied as required. |
| RPC denial | non-admin cannot execute unlock_game | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute set_game_status | PASS | Denied as required. |
| RPC denial | non-admin cannot execute set_game_status | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute approve_registration | PASS | Denied as required. |
| RPC denial | non-admin cannot execute approve_registration | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute assign_free_agent | PASS | Denied as required. |
| RPC denial | non-admin cannot execute assign_free_agent | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute verify_waiver | PASS | Denied as required. |
| RPC denial | non-admin cannot execute verify_waiver | PASS | Rejected by assert_admin(). |
| direct-write guards | anonymous direct game insert is denied | PASS | Denied as required. |
| direct-write guards | non-admin direct score update is denied | PASS | RLS affected zero rows. |
| direct-write guards | admin cannot mutate signed waiver fields | PASS | Denied as required. |
| direct-write guards | admin cannot update append-only history | PASS | Denied as required. |
| direct-write guards | admin cannot delete append-only history | PASS | Denied as required. |
| admin RPC success | set_game_status succeeds | PASS | Expected behavior observed. |
| admin RPC success | save_score succeeds and writes score | PASS | Expected behavior observed. |
| admin RPC success | lock_game succeeds | PASS | Expected behavior observed. |
| locked-game guards | empty unlock reason is rejected | PASS | Denied as required. |
| locked-game guards | direct locked score update is rejected | PASS | Denied as required. |
| locked-game guards | direct locked stage update is rejected | PASS | Denied as required. |
| admin RPC success | unlock_game succeeds with a reason | PASS | Expected behavior observed. |
| admin RPC success | approve_registration succeeds | PASS | Expected behavior observed. |
| admin RPC success | assign_free_agent succeeds | PASS | Expected behavior observed. |
| admin RPC success | verify_waiver succeeds and updates eligibility | PASS | Expected behavior observed. |
| edit history | admin RPCs created append-only history with unlock reason | PASS | Expected behavior observed. |
| Hall of Fame gate | admin can create unpublished Hall of Fame entry | PASS | Expected behavior observed. |
| Hall of Fame gate | anonymous cannot see unpublished entry | PASS | Expected behavior observed. |
| Hall of Fame gate | non-admin cannot see unpublished entry | PASS | Expected behavior observed. |
| Hall of Fame gate | published entry becomes public | PASS | Expected behavior observed. |

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
| profiles | 0 | 0 | PASS |
| seasons | 1 | 1 | PASS |
| team_players | 0 | 0 | PASS |
| team_registrations | 0 | 0 | PASS |
| teams | 0 | 0 | PASS |
| waiver_versions | 0 | 0 | PASS |
| waivers | 0 | 0 | PASS |

Fixture residue query: `{"history_rows":0,"league_rows":0,"profile_rows":0,"season_rows":0,"waiver_rows":0}` — **PASS**.

## Disposition

The hosted authorization matrix is executed, reproducible, and durably evidenced. Re-run it after any RLS, Data API grant, Auth-role, admin RPC, game-lock, waiver, intake, payment-privacy, edit-history, or Hall of Fame publication change.
