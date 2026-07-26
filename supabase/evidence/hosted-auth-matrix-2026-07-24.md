# Hosted authorization matrix evidence — 2026-07-25

- **Overall:** PASS
- **Project:** `orlhqewzprjadyrdrqxw`
- **Run namespace:** `cvf-matrix-2026-07-25-511061d3`
- **Executed:** 2026-07-25T03:53:01.391Z to 2026-07-25T03:53:55.443Z
- **Browser/API checks:** 248 passed, 0 failed
- **Server catalog checks:** 8 passed, 0 failed
- **Combined checks:** 256 passed, 0 failed
- **Fixture residue check:** PASS
- **Baseline restoration:** PASS
- **Credentials:** Auth passwords were entered only in the local browser harness. Passwords, access/refresh tokens, database credentials, and service-role keys were neither logged nor written to this report.

## Context

This is the durable rerun of the hosted authorization matrix that originally exposed the frontend authorization defects fixed by commits `0b6933c` and `c5b55c2`. The procedure is defined in [`HOSTED_AUTH_RUNBOOK.md`](../HOSTED_AUTH_RUNBOOK.md).

## Category summary

| Category | Passed | Failed |
|---|---:|---:|
| ledger catalog | 8 | 0 |
| MFA authorization | 43 | 0 |
| identity | 3 | 0 |
| ledger authorization | 48 | 0 |
| protected intake | 4 | 0 |
| public reads | 14 | 0 |
| private reads | 18 | 0 |
| payments authorization | 18 | 0 |
| Hall of Fame authorization | 8 | 0 |
| RPC denial | 50 | 0 |
| direct-write guards | 20 | 0 |
| admin RPC success | 7 | 0 |
| locked-game guards | 3 | 0 |
| playoff RPC success | 4 | 0 |
| edit history | 1 | 0 |
| team identity RPC success | 3 | 0 |
| Hall of Fame gate | 4 | 0 |

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
| MFA authorization | linked password-only administrator cannot execute submit_score | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute lock_game | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute correct_final_score | PASS | Rejected by assert_admin(). |
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
| MFA authorization | linked password-only administrator cannot execute start_scorekeeping_session | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute renew_scorekeeping_session | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute resume_scorekeeping_session | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute append_scorekeeping_event | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute replace_scorekeeping_event | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute finalize_scorekeeping_session | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute cancel_scorekeeping_session | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute declare_ledger_forfeit | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute start_scorekeeping_correction | PASS | Rejected by assert_admin(). |
| MFA authorization | linked password-only administrator cannot execute finalize_scorekeeping_correction | PASS | Rejected by assert_admin(). |
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
| identity | anonymous is_admin() is false | PASS | Expected behavior observed. |
| identity | authenticated non-admin is_admin() is false | PASS | Expected behavior observed. |
| identity | administrator is_admin() is true | PASS | Expected behavior observed. |
| ledger authorization | anonymous cannot read scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot insert scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot update scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot delete scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot read scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot insert scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot update scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot delete scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot read scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot insert scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot update scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot delete scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot read scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot insert scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot update scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | anonymous cannot delete scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot read scorekeeping_sessions | PASS | SELECT grant reached RLS and returned zero private rows. |
| ledger authorization | authenticated non-admin cannot insert scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot update scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot delete scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot read scorekeeping_participants | PASS | SELECT grant reached RLS and returned zero private rows. |
| ledger authorization | authenticated non-admin cannot insert scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot update scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot delete scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot read scorekeeping_events | PASS | SELECT grant reached RLS and returned zero private rows. |
| ledger authorization | authenticated non-admin cannot insert scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot update scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot delete scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot read scorekeeping_event_attributions | PASS | SELECT grant reached RLS and returned zero private rows. |
| ledger authorization | authenticated non-admin cannot insert scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot update scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | authenticated non-admin cannot delete scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator can query scorekeeping_sessions | PASS | Authorized query completed. |
| ledger authorization | AAL2 administrator cannot insert scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot update scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot delete scorekeeping_sessions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator can query scorekeeping_participants | PASS | Authorized query completed. |
| ledger authorization | AAL2 administrator cannot insert scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot update scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot delete scorekeeping_participants | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator can query scorekeeping_events | PASS | Authorized query completed. |
| ledger authorization | AAL2 administrator cannot insert scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot update scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot delete scorekeeping_events | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator can query scorekeeping_event_attributions | PASS | Authorized query completed. |
| ledger authorization | AAL2 administrator cannot insert scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot update scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| ledger authorization | AAL2 administrator cannot delete scorekeeping_event_attributions | PASS | Denied at the table-privilege boundary. |
| protected intake | anonymous direct team-interest write is denied | PASS | Denied as required. |
| protected intake | anonymous direct free-agent write is denied | PASS | Denied as required. |
| protected intake | anonymous direct waiver write is denied | PASS | Denied as required. |
| protected intake | authenticated non-admin direct intake is denied by RLS | PASS | Denied as required. |
| public reads | anonymous can read fixture seasons | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture leagues | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture team_identities | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture teams | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture team_players | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture games | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture league_settings | PASS | Expected behavior observed. |
| public reads | anonymous can read fixture waiver_versions | PASS | Expected behavior observed. |
| public reads | anonymous can query playoff_brackets | PASS | Expected behavior observed. |
| public reads | anonymous can query playoff_seeds | PASS | Expected behavior observed. |
| public reads | anonymous can query playoff_matches | PASS | Expected behavior observed. |
| public reads | public_profiles exposes allowlisted fixture profile | PASS | Expected behavior observed. |
| public reads | public_profiles rejects PII column selection | PASS | Denied as required. |
| public reads | public_hof_entries rejects curator attribution | PASS | Denied as required. |
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
| private reads | anonymous cannot read hof_entries | PASS | Denied at the Data API boundary. |
| private reads | non-admin cannot read hof_entries | PASS | RLS returned zero private rows. |
| payments authorization | anonymous cannot insert charges | PASS | Denied as required. |
| payments authorization | anonymous cannot update charges | PASS | Denied as required. |
| payments authorization | anonymous cannot delete charges | PASS | Denied as required. |
| payments authorization | anonymous cannot insert payment entries | PASS | Denied as required. |
| payments authorization | anonymous cannot update payment entries | PASS | Denied as required. |
| payments authorization | anonymous cannot delete payment entries | PASS | Denied as required. |
| payments authorization | non-admin cannot insert charges | PASS | Denied as required. |
| payments authorization | non-admin cannot update charges | PASS | RLS affected zero rows. |
| payments authorization | non-admin cannot delete charges | PASS | RLS affected zero rows. |
| payments authorization | non-admin cannot insert payment entries | PASS | Denied as required. |
| payments authorization | non-admin cannot update payment entries | PASS | RLS affected zero rows. |
| payments authorization | non-admin cannot delete payment entries | PASS | RLS affected zero rows. |
| Hall of Fame authorization | anonymous cannot insert Hall of Fame entries | PASS | Denied as required. |
| Hall of Fame authorization | anonymous cannot update Hall of Fame entries | PASS | Denied as required. |
| Hall of Fame authorization | anonymous cannot delete Hall of Fame entries | PASS | Denied as required. |
| Hall of Fame authorization | non-admin cannot insert Hall of Fame entries | PASS | Denied as required. |
| Hall of Fame authorization | non-admin cannot update Hall of Fame entries | PASS | RLS affected zero rows. |
| Hall of Fame authorization | non-admin cannot delete Hall of Fame entries | PASS | RLS affected zero rows. |
| RPC denial | anonymous cannot execute submit_score | PASS | Denied as required. |
| RPC denial | non-admin cannot execute submit_score | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute lock_game | PASS | Denied as required. |
| RPC denial | non-admin cannot execute lock_game | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute correct_final_score | PASS | Denied as required. |
| RPC denial | non-admin cannot execute correct_final_score | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute set_game_status | PASS | Denied as required. |
| RPC denial | non-admin cannot execute set_game_status | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute approve_registration | PASS | Denied as required. |
| RPC denial | non-admin cannot execute approve_registration | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute assign_free_agent | PASS | Denied as required. |
| RPC denial | non-admin cannot execute assign_free_agent | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute verify_waiver | PASS | Denied as required. |
| RPC denial | non-admin cannot execute verify_waiver | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute generate_single_elim_bracket | PASS | Denied as required. |
| RPC denial | non-admin cannot execute generate_single_elim_bracket | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute schedule_playoff_match | PASS | Denied as required. |
| RPC denial | non-admin cannot execute schedule_playoff_match | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute link_playoff_game | PASS | Denied as required. |
| RPC denial | non-admin cannot execute link_playoff_game | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute advance_playoff_match | PASS | Denied as required. |
| RPC denial | non-admin cannot execute advance_playoff_match | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute enroll_team_identity | PASS | Denied as required. |
| RPC denial | non-admin cannot execute enroll_team_identity | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute create_team_identity_and_enroll | PASS | Denied as required. |
| RPC denial | non-admin cannot execute create_team_identity_and_enroll | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute update_team_identity | PASS | Denied as required. |
| RPC denial | non-admin cannot execute update_team_identity | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute update_team_enrollment | PASS | Denied as required. |
| RPC denial | non-admin cannot execute update_team_enrollment | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute start_scorekeeping_session | PASS | Denied as required. |
| RPC denial | non-admin cannot execute start_scorekeeping_session | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute renew_scorekeeping_session | PASS | Denied as required. |
| RPC denial | non-admin cannot execute renew_scorekeeping_session | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute resume_scorekeeping_session | PASS | Denied as required. |
| RPC denial | non-admin cannot execute resume_scorekeeping_session | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute append_scorekeeping_event | PASS | Denied as required. |
| RPC denial | non-admin cannot execute append_scorekeeping_event | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute replace_scorekeeping_event | PASS | Denied as required. |
| RPC denial | non-admin cannot execute replace_scorekeeping_event | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute finalize_scorekeeping_session | PASS | Denied as required. |
| RPC denial | non-admin cannot execute finalize_scorekeeping_session | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute cancel_scorekeeping_session | PASS | Denied as required. |
| RPC denial | non-admin cannot execute cancel_scorekeeping_session | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute declare_ledger_forfeit | PASS | Denied as required. |
| RPC denial | non-admin cannot execute declare_ledger_forfeit | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute start_scorekeeping_correction | PASS | Denied as required. |
| RPC denial | non-admin cannot execute start_scorekeeping_correction | PASS | Rejected by assert_admin(). |
| RPC denial | anonymous cannot execute finalize_scorekeeping_correction | PASS | Denied as required. |
| RPC denial | non-admin cannot execute finalize_scorekeeping_correction | PASS | Rejected by assert_admin(). |
| direct-write guards | anonymous direct game insert is denied | PASS | Denied as required. |
| direct-write guards | non-admin direct score update is denied | PASS | Denied with an API/RLS error. |
| direct-write guards | administrator cannot directly update an unlocked score | PASS | Denied as required. |
| direct-write guards | administrator cannot insert a score-bearing game directly | PASS | Denied as required. |
| direct-write guards | administrator cannot insert player stats directly | PASS | Denied as required. |
| direct-write guards | administrator cannot insert game history directly | PASS | Denied as required. |
| direct-write guards | non-admin direct bracket insertion is denied | PASS | Denied as required. |
| direct-write guards | non-admin cannot alter a team identity | PASS | Denied with an API/RLS error. |
| direct-write guards | administrator cannot directly insert a team identity | PASS | Denied as required. |
| direct-write guards | administrator cannot directly update a team identity | PASS | Denied as required. |
| direct-write guards | administrator cannot directly delete a team identity | PASS | Denied as required. |
| direct-write guards | administrator cannot directly insert a team enrollment | PASS | Denied as required. |
| direct-write guards | administrator cannot directly update a team enrollment | PASS | Denied as required. |
| direct-write guards | administrator cannot directly delete a team enrollment | PASS | Denied as required. |
| direct-write guards | administrator cannot directly mutate bracket headers | PASS | Denied as required. |
| direct-write guards | administrator cannot directly mutate locked seeds | PASS | Denied as required. |
| direct-write guards | administrator cannot directly mutate match topology | PASS | Denied as required. |
| direct-write guards | admin cannot mutate signed waiver fields | PASS | Denied as required. |
| direct-write guards | admin cannot update append-only history | PASS | Denied as required. |
| direct-write guards | admin cannot delete append-only history | PASS | Denied as required. |
| payments authorization | administrator can insert a charge | PASS | Expected behavior observed. |
| payments authorization | administrator can update a charge | PASS | Expected behavior observed. |
| payments authorization | administrator can insert a payment entry | PASS | Expected behavior observed. |
| payments authorization | administrator can update a payment entry | PASS | Expected behavior observed. |
| payments authorization | administrator can delete a payment entry | PASS | Expected behavior observed. |
| payments authorization | administrator can delete a charge after its entries are removed | PASS | Expected behavior observed. |
| admin RPC success | set_game_status succeeds | PASS | Expected behavior observed. |
| admin RPC success | submit_score succeeds and writes score | PASS | Expected behavior observed. |
| admin RPC success | lock_game succeeds | PASS | Expected behavior observed. |
| locked-game guards | empty correction reason is rejected | PASS | Expected behavior observed. |
| locked-game guards | direct locked score update is rejected | PASS | Denied as required. |
| locked-game guards | direct locked stage update is rejected | PASS | Denied as required. |
| admin RPC success | correct_final_score succeeds with a reason and preserves final lock | PASS | Expected behavior observed. |
| playoff RPC success | administrator generates a fixed single-elimination bracket | PASS | Expected behavior observed. |
| playoff RPC success | administrator schedules a ready bracket match | PASS | Expected behavior observed. |
| playoff RPC success | administrator links a matching existing playoff game | PASS | Expected behavior observed. |
| playoff RPC success | administrator advances a final locked playoff result | PASS | Expected behavior observed. |
| admin RPC success | approve_registration succeeds | PASS | Expected behavior observed. |
| admin RPC success | assign_free_agent succeeds | PASS | Expected behavior observed. |
| admin RPC success | verify_waiver succeeds and updates eligibility | PASS | Expected behavior observed. |
| edit history | admin RPCs created append-only correction history with before/after state | PASS | Expected behavior observed. |
| team identity RPC success | administrator enrolls a persistent identity cross-sport without history | PASS | Expected behavior observed. |
| team identity RPC success | administrator updates the canonical identity and propagation persists | PASS | Expected behavior observed. |
| team identity RPC success | administrator creates an identity and first enrollment atomically | PASS | Expected behavior observed. |
| Hall of Fame gate | admin can create unpublished Hall of Fame entry | PASS | Expected behavior observed. |
| Hall of Fame gate | anonymous cannot see unpublished entry | PASS | Expected behavior observed. |
| Hall of Fame gate | non-admin cannot see unpublished entry | PASS | Expected behavior observed. |
| Hall of Fame gate | published entry becomes public | PASS | Expected behavior observed. |
| Hall of Fame authorization | administrator can update a Hall of Fame entry | PASS | Expected behavior observed. |
| Hall of Fame authorization | administrator can delete a Hall of Fame entry | PASS | Expected behavior observed. |

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
| waiver_versions | 0 | 0 | PASS |
| waivers | 0 | 0 | PASS |

Fixture residue query: `{"history_rows":0,"identity_rows":0,"league_rows":0,"profile_rows":0,"season_rows":0,"waiver_rows":0}` — **PASS**.

## Disposition

The hosted authorization matrix is executed, reproducible, and durably evidenced. Re-run it after any RLS, Data API grant, Auth-role, admin RPC, game-lock, waiver, intake, payment-privacy, edit-history, or Hall of Fame publication change.
