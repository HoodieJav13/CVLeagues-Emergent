# CVF Leagues — Supabase backend

This file is authoritative for CVF Leagues schema, migration ledger, backend invariants, and hosted verification state. Current product status, roadmap, and owner actions live in [`../CLAUDE.md`](../CLAUDE.md). This dedicated Supabase project must remain separate from ZonAthletica or any unrelated project.

## Verified status — 2026-07-21

- Twenty-four migration files are present in filename order. A real local Supabase reset applies all twenty-four, and the independent pgtest run passes 277/277. Migration 24 (`event_ledger_lite_schema`) is locally complete and committed in `1b31693`; its 26-table authorization harness is prepared locally, and the migration remains unhosted pending backup, preflight, dry run, and its discrete push gate.
- The linked hosted project has the first twenty-three migrations applied. Migration 23 (`aggregate_scoring_hardening`) is hosted-accepted, and the current Season 1 operational row/settings baseline was preserved exactly. The service-role privilege catalog passes at the accepted customer-controlled boundary.
- Hosted verification confirms the two remediated function attributes, 38/38 foreign-key index coverage, all 22 hosted tables with RLS enabled, and the expected operational row-count baseline. Local Migration 24 raises the schema to 60 indexed foreign keys and 26 RLS-enabled tables.
- Hosted Security and Performance Advisors were rerun after Migration 23: 23 Security and 13 Performance findings have the itemized dispositions below. The removed `player_stats` write policy eliminated one prior overlapping-policy warning.
- `supabase/config.toml` is present; unused local Storage and Analytics services are intentionally disabled.
- The real Auth administrator is linked through `admin_users`, and administration requires verified AAL2/TOTP. The final hosted matrix verified fail-closed anonymous, authenticated non-admin, password-only linked-admin, and AAL2 administrator behavior across the current surface.
- The Migration-23 hosted authorization matrix passed 154/154 browser/API checks across 22 tables and all 15 administrator RPCs. Fixture cleanup and exact restoration of the current Season 1 operational baseline both passed. See [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-21-m23.md`](evidence/hosted-auth-matrix-2026-07-21-m23.md). The immutable [`Migration-22 evidence`](evidence/hosted-auth-matrix-2026-07-17-final.md) and [`July 13 evidence`](evidence/hosted-auth-matrix-2026-07-13.md) remain prior accepted checkpoints.
- Launch hardening requires AAL2/TOTP for administration and routes public intake through a Turnstile-verified server boundary. Recovery/session revocation, preview/production values, live hosted application acceptance, and deployment remain open.
- No production seed data or credentials are stored here; only the non-secret project reference and URL are recorded.

## Hosted project record

Owner-confirmed on 2026-07-10:

- Project reference: `orlhqewzprjadyrdrqxw`
- Project URL: `https://orlhqewzprjadyrdrqxw.supabase.co`
- Owner: CVF Leagues owner
- Region: US East (Ohio)
- Plan: Free
- Dashboard access: owner only
- Scope: dedicated to CVF Leagues; no unrelated CVF or ZonAthletica resources
- Database password: owner confirmed it is stored securely; its value and storage details are not recorded here
- Backup capability: Free-plan project; regular off-platform logical exports remain required before launch

The project is linked and the first twenty-three migrations are applied with migration history, structural catalog checks, the operational row/settings baseline, both advisors, and the Migration-23 real-session authorization matrix accepted at 154/154. Migration 24 is local-only. The current accepted hosted run is [`evidence/hosted-auth-matrix-2026-07-21-m23.md`](evidence/hosted-auth-matrix-2026-07-21-m23.md); the immutable [`Migration-22`](evidence/hosted-auth-matrix-2026-07-17-final.md) and [`twelve-migration`](evidence/hosted-auth-matrix-2026-07-13.md) checkpoints remain historical evidence.

## Migration inventory

| File | Contents |
|---|---|
| `20260702000100_extensions_and_admin.sql` | `moddatetime`, `admin_users`, `is_admin()`, and `assert_admin()` |
| `20260702000200_profiles.sql` | Private `profiles`; nullable `auth_user_id`; generated display name; no client deletes |
| `20260702000300_leagues_teams_rosters.sql` | `leagues`, `teams`, sport consistency, and soft-lifecycle `team_players` |
| `20260702000400_games_and_stats.sql` | Games, lock enforcement, append-only edit history, player stats, and career baselines |
| `20260702000500_intake.sql` | Anonymous insert-only team/free-agent intake with admin-only triage reads |
| `20260702000600_waivers.sql` | Immutable waiver versions and append-only signed waivers |
| `20260702000700_settings_and_views.sql` | Settings singleton and the definer-style `public_profiles` PII boundary |
| `20260702000800_rpcs.sql` | Score, lock/unlock, status, intake conversion, roster assignment, and waiver RPCs |
| `20260707000900_season2_foundations.sql` | Seasons, competition stages, tournament containers, payments tables, and Hall of Fame gate |
| `20260710075655_enforce_charge_team_season.sql` | Charge-team season constraint triggers and supporting indexes |
| `20260710144539_explicit_data_api_grants.sql` | Deny-by-default Data API privileges with explicit anon/authenticated allowlists |
| `20260712063616_remediate_database_advisors.sql` | Safe function execution attributes and complete public foreign-key index coverage |
| `20260714035101_require_admin_mfa_and_protect_public_intake.sql` | AAL2 admin enforcement and removal of direct anonymous intake writes |
| `20260714041538_per_sport_current_seasons.sql` | Per-sport current-season foreign keys and defaults |
| `20260714043619_single_elimination_brackets.sql` | Public bracket tables, RLS, seeding/scheduling/linking/advancement RPCs, and unlock safety |
| `20260714053049_persistent_team_identities.sql` | Persistent team brands, explicit enrollment RPCs, canonical propagation, and registration integration |
| `20260714174151_protect_historical_stat_classification.sql` | Prevents stat-bearing games/leagues from silently changing historical season or tournament classification |
| `20260714180129_restrict_playoff_mutation_to_rpcs.sql` | Removes direct bracket/seed/match DML so verified playoff RPCs own the consistency boundary |
| `20260714193413_restrict_team_mutation_to_rpcs.sql` | Removes direct team identity/enrollment DML and adds narrow admin edit RPCs |
| `20260714202756_expose_safe_hof_entries.sql` | Makes the HOF base table admin-only and exposes published display fields through an allowlisted view |
| `20260715004338_restrict_service_role_to_intake_inserts.sql` | Restricts the server secret to INSERT-only protected team/free-agent intake access |
| `20260715201257_fully_restrict_service_role_privileges.sql` | Removes the remaining service-role table administration, sequence, and public-function privileges and hardens migration-owner defaults |
| `20260720031319_aggregate_scoring_hardening.sql` | Adds two-tier aggregate validation, makes score/stat/history mutation RPC-only, and replaces bare unlock with reasoned atomic final correction |
| `20260721201350_event_ledger_lite_schema.sql` | Adds dormant aggregate/ledger mode separation, private immutable session/rule/participant snapshots, ordered append-only events/attributions, correction-chain constraints, and no client mutation RPC |

## Completed database hardening

- Team charges must match the referenced team's league season.
- Charged teams cannot move to a league in another season.
- Leagues with charged teams cannot be reassigned to a conflicting season.
- Season-name cascades remain supported and verified.
- Games with granular statistics cannot change leagues; leagues with granular statistics cannot change season or league/tournament kind.
- Bracket headers, seed snapshots, and match topology are read-only through the Data API; all mutations use the verified playoff RPC workflow.
- Team identities and enrollments are read-only through the Data API; creation, enrollment, brand propagation, and supported lifecycle edits use admin-guarded RPCs.
- Aggregate score/stat/history mutation is RPC-only locally and hosted. `submit_score` and `correct_final_score` enforce HARD invariants, require a recorded reason for SOFT overrides, and preserve append-only audit; the final correction never unlocks the public result.
- Event Ledger Lite is schema-only and local-only: aggregate remains the default, conversion is controlled and one-way, aggregate RPCs cannot mutate ledger games, the four ledger tables are private/admin-read-only, and no client-facing ledger mutation or public live-score path exists yet.
- Career-baseline imports must not overlap seasons represented by granular game statistics. The legacy `current_season` setting is compatibility-only once sport defaults diverge; both are documented non-blocking contracts.
- Anonymous and authenticated Data API privileges are explicitly allowlisted; future tables and functions are private by default.
- `service_role` access is explicitly limited to `INSERT` on `team_registrations` and `free_agents`; it has no other current public-table privilege, no public-sequence privilege, and no public-function `EXECUTE`. Future objects created by the repository migration owner (`postgres`) inherit no `service_role` access. Supabase platform-owned `supabase_admin` default ACLs cannot be altered by customer migrations; this is an accepted platform boundary, not an unresolved application grant, and every current object is re-revoked explicitly.
- `public_profiles` is verified as an intentional definer-style view with an exact 12-column safe-field allowlist.
- Anonymous clients cannot read profiles, waivers, intake records, admin identities, edit history, charges, or payment entries.
- Authenticated non-admin sessions can reach admin-managed tables only where required for RLS evaluation, and RLS returns no private rows.
- Anonymous/non-admin payment writes are explicitly denied, while administrator charge and payment-entry CRUD is positively verified. `payment_entries.recorded_by` remains client-supplied convenience metadata and is not trustworthy audit attribution.
- `hof_entries` is admin-only; `public_hof_entries` is an exact display-field allowlist gated by `hof_published`. Anonymous/non-admin writes are explicitly denied and administrator CRUD is positively verified.
- `current_waiver_version()` uses caller privileges, and `cvf_palette_color(integer)` has an immutable `pg_catalog` search path.
- All 60 local public foreign keys have a covering index; the accepted hosted Migration-23 baseline remains 38/38 with no unindexed-foreign-key advisor findings.

## Hosted advisor dispositions — 2026-07-21

The current Security Advisor reports 23 findings:

| Finding | Count | Disposition |
|---|---:|---|
| `rls_enabled_no_policy` on `admin_users` | 1 INFO | Intentional deny-all helper table. RLS is enabled and Data API access is revoked; admin membership is checked through controlled functions rather than client row reads. No action. |
| `security_definer_view` on `public_profiles` and `public_hof_entries` | 2 ERROR | Intentional allowlisted display boundaries. The views expose exact safe-field allowlists; base-table privileges remain private and both have negative regression coverage. |
| Anonymous executable `SECURITY DEFINER` warnings on `is_admin()` and `is_admin_identity()` | 2 WARN | Intentional authorization/MFA-routing helpers. Anonymous sessions receive false; no admin data is returned. |
| Authenticated executable `SECURITY DEFINER` warnings on helpers and admin RPCs | 17 WARN | Covers the two helpers plus all 15 authenticated admin RPC endpoints. Every mutation RPC invokes the AAL2-aware admin guard; the expanded hosted real-session matrix confirmed the expected denial and success paths. |
| `auth_leaked_password_protection` | 1 WARN | Auth configuration setting, not a code defect or evidence of a leaked credential. Leaked-password protection requires a paid plan; enabling it is an owner/billing decision. It is not applicable to the current single-admin Free-plan state, so no action now. Revisit if the plan or account model changes. |

The current Performance Advisor reports 13 findings:

| Finding | Count | Disposition |
|---|---:|---|
| Unused indexes | 10 INFO | Expected at the early operational baseline. Reassess from real query and usage evidence after Season 1 activity; do not remove preemptively. |
| Multiple permissive policies | 3 WARN | Deferred consolidation recorded in `CLAUDE.md`. Preserve current public/admin semantics and negative RLS regression coverage before changing policies. Migration 23 removed the former `player_stats` overlap when it retired direct writes. |

## Remaining backend launch gates

Hosted authorization acceptance is complete and durably evidenced at 154/154 through Migration 23 — see [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-21-m23.md`](evidence/hosted-auth-matrix-2026-07-21-m23.md).

Migration 24 remains local-only. Its harness is prepared to expand the accepted 22-table boundary to all 26 tables. Before the hosted push, review and commit that harness, capture a fresh logical export, confirm only Migration 24 is pending, complete the dry run, and stop for discrete owner approval. The full 26-table run can occur only after the four ledger relations exist remotely and requires its own discrete approval because it writes and removes hosted fixtures.

1. Complete recovery and session-revocation checks for the already-linked AAL2 administrator; decide separately whether a break-glass administrator is warranted.
2. Enter hosted and Turnstile public/secret values in preview/production without exposing service-role or secret keys to React, then verify fail-closed behavior.
3. Run the live application flows against hosted Supabase with no mock or localStorage participation.
4. Complete preview deployment and acceptance before production launch.

The attorney-reviewed waiver language remains an independent launch dependency. Tournament-specific reporting remains a product follow-up. The profile-charge sport/season ambiguity is the same underlying gap as the legacy `current_season` singleton—a season label alone cannot identify concurrent sport/container context—and those should be revisited together.

## Local verification

Local Storage and Analytics are disabled in `config.toml` because CVF Leagues currently uses neither service; local verification covers the database, Auth, and Data API.

First confirm the installed commands instead of relying on remembered CLI flags:

```sh
supabase --version
supabase --help
supabase db --help
supabase migration --help
```

To reproduce the verified local database gate:

```sh
supabase start
supabase db reset --local --no-seed
supabase migration list --local
```

`supabase db reset --local --no-seed` recreates only the local database and applies migrations in order. This repository intentionally has no seed file. Never substitute `--linked` or a remote reset for this local command.

Run the repository harness separately:

```sh
./tests/pgtest/run_pgtest.sh
```

The harness requires local PostgreSQL binaries and permission to allocate PostgreSQL shared memory.

## Future hosted migration procedure

The hosted ledger currently contains the first twenty-three repository migrations; Migration 24 is local-only. Every future migration push, migration-history repair, or other hosted write requires owner approval. Never print or commit access tokens, database passwords, secret keys, or service-role keys.

Before a future hosted migration:

```sh
supabase migration list
supabase db push --dry-run
```

The dry-run must show only the migrations explicitly approved for that future push, once each and in filename order. It must not include seed data or reveal migration-history divergence. Supabase documents that `db push --dry-run` prints migrations without applying them; see the [CLI reference](https://supabase.com/docs/reference/cli/introduction).

Stop for explicit owner approval before:

```sh
supabase db push
```

After an approved push, immediately re-run migration listing, compare hosted history with Git, verify expected objects, and run Security and Performance Advisors. Do not repair history speculatively if a migration fails.

## Database-owned invariants

- **Admin identity:** `admin_users` is distinct from player profiles; Auth User is not Player.
- **RLS:** all 26 local tables and all 22 currently hosted tables enable RLS. API privileges are separately allowlisted and covered by catalog assertions plus the accepted hosted authorization matrix at its stated baseline.
- **Ledger authority:** local Migration 24 makes aggregate the default, permits only controlled one-way conversion before score/session evidence, blocks aggregate RPCs from ledger projections, and keeps all ledger mutation unavailable until Sequence 4 adds reviewed AAL2 RPCs.
- **Game locks:** Migration 23 retires aggregate unlock locally and hosted. A final correction requires AAL2 plus a non-empty reason and atomically preserves the completed/final/locked state; unsafe winner-changing playoff corrections remain blocked after downstream scheduling.
- **Edit history:** game history rows are RPC-written, append-only, and immutable. Aggregate before/after snapshots are audit evidence only and never projection input.
- **Competition stages:** tournament containers accept only tournament games; league containers accept regular/playoff games.
- **Waivers:** signature fields are immutable, re-signing inserts a new row, and profile linkage is one-shot.
- **Public profiles:** `public_profiles` intentionally uses definer-style view behavior to read through private `profiles` RLS. Its exact allowlist is `id`, `first_name`, `last_name`, `display_name`, `name`, `sports`, `experience`, `bio`, `avatar_color`, `claimed`, `eligibility_status`, and `created_at`. Email, phone, date of birth, emergency contacts, admin notes, Auth user IDs, and waiver details are absent and regression-tested.
- **Data API:** grants are reset and rebuilt from an anon/authenticated allowlist. RLS remains mandatory after a role receives object access. New functions created by the migration role do not inherit PostgreSQL's default `PUBLIC EXECUTE`; later client-facing functions require an explicit grant. See Supabase's [API security guidance](https://supabase.com/docs/guides/api/securing-your-api) and [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- **Intake:** direct anonymous Data API writes are denied. Public submissions use the Turnstile-verified server endpoint and cannot set or read triage state.
- **Hall of Fame:** the base table is admin-only; public roles can read only the allowlisted view, and it remains empty until the settings gate is enabled.
- **Payments:** exactly one payer is required per charge, and a team charge must match the team's league season.
- **Playoffs:** fixed bracket topology and seed snapshots are public-read/RPC-write; advancement requires a final locked result, and winner-changing aggregate corrections are blocked once a dependent game is scheduled or completed.
- **Team identity:** one canonical brand may enroll once per league/tournament; enrollment creates no roster, payment, game, stat, waiver, or registration history.

## Owner action authority

The single current owner-action queue is maintained in [`CLAUDE.md`](../CLAUDE.md#owner-action-queue). Backend acceptance gates above define the required technical evidence but do not duplicate or supersede that queue.

No remote database reset, migration repair, Auth/admin identity change, or hosted data write is routine housekeeping.
