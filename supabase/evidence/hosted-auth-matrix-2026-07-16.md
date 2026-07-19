# Hosted authorization matrix evidence — 2026-07-16

- **Overall:** FAIL
- **Project:** `orlhqewzprjadyrdrqxw`
- **Run namespace:** `cvf-matrix-2026-07-16-b54ed8f8`
- **Executed:** 2026-07-16T18:11:01.267Z to 2026-07-16T18:11:01.465Z
- **Browser/API checks:** 0 passed, 1 failed
- **Fixture residue check:** PASS
- **Baseline restoration:** PASS
- **Credentials:** Auth passwords were entered only in the local browser harness. Passwords, access/refresh tokens, database credentials, and service-role keys were neither logged nor written to this report.

## Context

This is the durable rerun of the hosted authorization matrix that originally exposed the frontend authorization defects fixed by commits `0b6933c` and `c5b55c2`. The procedure is defined in [`HOSTED_AUTH_RUNBOOK.md`](../HOSTED_AUTH_RUNBOOK.md).

## Category summary

| Category | Passed | Failed |
|---|---:|---:|
| harness | 0 | 1 |

## Detailed results

| Category | Check | Result | Detail |
|---|---|---|---|
| harness | matrix execution | FAIL | Both account credentials and the administrator authenticator code are required. |

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
