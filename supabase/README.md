# CVF Leagues — Supabase backend

This file is authoritative for CVF Leagues schema, migration ledger, backend invariants, and hosted verification state. Current product status, roadmap, and owner actions live in [`../CLAUDE.md`](../CLAUDE.md). This dedicated Supabase project must remain separate from ZonAthletica or any unrelated project.

## Verified status — 2026-07-26

- **Twenty-eight migration files are present in filename order; twenty-seven are applied to hosted. Migration 28 is local-only and unpushed.** A clean isolated reset applies all twenty-eight, and the independent pgtest run passes 312/312 plus a real two-connection idempotency race.
- Migration 28 (`20260726120000_venues_game_start_times_participation.sql`) adds `venues` and `game_participation`, replaces `games.date`/`games.time`/`games.location` with an authoritative `starts_at` timestamptz plus `venue_id`, and adds one RPC (`set_game_participation`). It **drops three columns**, so it is not silently reversible once hosted.
- Because it adds two tables and one RPC, the accepted Sequence 4 matrix (26 tables / 25 RPCs / 256 checks) no longer covers the full surface. **Expand and re-run the authorization matrix to 28 tables / 26 RPCs before pushing.** The 256/256 acceptance remains valid for the twenty-seven-migration hosted baseline it was run against.
- The frontend has not yet been migrated to the new game shape. `backend.js` still selects the dropped columns and calls the retired `schedule_playoff_match(uuid, date, text, text)` signature, so hosted mode would break until that work lands. Mock mode is unaffected because it runs off `seed.js`.
- Sequence 4's real-session authorization matrix is accepted at its stated baseline; the durable populated-ledger pilot remains separate and frozen.
- The linked hosted project has all twenty-seven migrations applied. Migration 24's private Event Ledger Lite boundary remains behaviorally accepted, and Migrations 25–27 passed migration, structure, row/settings baseline, privilege catalog, and advisor readback. The Season 1 operational baseline was preserved exactly.
- Hosted verification confirms 74/74 foreign-key constraints with covering indexes, all 26 hosted tables with RLS enabled, the four empty ledger relations, and the expected operational row-count baseline. The earlier 60/60 local figure counted a narrower catalog shape and is superseded by this direct hosted constraint sweep.
- Hosted Security and Performance Advisors were rerun after Sequence 4: 33 Security and 31 Performance findings have the itemized dispositions below. The ten additional Security warnings map exactly to the intended authenticated runtime RPCs; no ledger ACL or unindexed-foreign-key finding was reported.
- `supabase/config.toml` is present; unused local Storage and Analytics services are intentionally disabled.
- The real Auth administrator is linked through `admin_users`, and administration requires verified AAL2/TOTP. The final hosted matrix verified fail-closed anonymous, authenticated non-admin, password-only linked-admin, and AAL2 administrator behavior across the current surface.
- The Sequence 4 hosted authorization matrix passed 256/256 browser/API and catalog checks across all 26 tables and all 25 administrator RPCs. Fixture cleanup and exact restoration of the current Season 1 operational baseline both passed. See [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md). The immutable Migration-24 and Migration-23 evidence files remain prior accepted checkpoints.
- Sequence 4 adds ten authenticated-only AAL2 ledger RPCs, deterministic final projection, W/L-only forfeits, bracket-safe corrections, and the admin live-ledger surface. Its three migrations are published and its authorization boundary is behaviorally accepted. No durable ledger evidence, deployment, or pilot was created. See [`evidence/sequence-4-local-acceptance-2026-07-22.md`](evidence/sequence-4-local-acceptance-2026-07-22.md), [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md), and [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md).
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

The project is linked and all twenty-seven migrations are applied with migration history, structural catalog checks, the operational row/settings baseline, and both advisors read back. Behavioral authorization acceptance is current at Sequence 4's 256/256 run. See [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md), [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md), and the immutable earlier checkpoints.

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
| `20260722052347_ledger_runtime_sessions.sql` | Adds controlled AAL2 session leases, participant capture, validated/idempotent event append, resume, renewal, and cancellation |
| `20260722052350_ledger_projection_finalization.sql` | Adds deterministic ledger projection, atomic finalization/failure audit, explicit W/L-only forfeits, and outcome-aware bracket advancement |
| `20260722052352_ledger_correction_authority.sql` | Adds the single ledger correction authority, atomic void-and-replace, immutable snapshot chaining, and bracket-safe refinalization |
| `20260726120000_venues_game_start_times_participation.sql` | **Local only, not hosted.** Adds `venues`; replaces game date/display-time/free-text location with an authoritative `starts_at` timestamptz and `venue_id`; adds `game_participation` and `set_game_participation` outside the score lock; reissues Migration 23's games column allowlist over the replacement columns; replaces `schedule_playoff_match` with the new signature |

## Completed database hardening

- Team charges must match the referenced team's league season.
- Charged teams cannot move to a league in another season.
- Leagues with charged teams cannot be reassigned to a conflicting season.
- Season-name cascades remain supported and verified.
- Games with granular statistics cannot change leagues; leagues with granular statistics cannot change season or league/tournament kind.
- Bracket headers, seed snapshots, and match topology are read-only through the Data API; all mutations use the verified playoff RPC workflow.
- Team identities and enrollments are read-only through the Data API; creation, enrollment, brand propagation, and supported lifecycle edits use admin-guarded RPCs.
- Aggregate score/stat/history mutation is RPC-only locally and hosted. `submit_score` and `correct_final_score` enforce HARD invariants, require a recorded reason for SOFT overrides, and preserve append-only audit; the final correction never unlocks the public result.
- Event Ledger Lite's Sequence 4 runtime, projection, forfeit, correction, and admin UI are locally verified; Migrations 25–27 are published; and the expanded real-session authorization matrix is accepted. Aggregate remains the default; the durable populated-ledger pilot remains unexecuted and frozen.
- Career-baseline imports must not overlap seasons represented by granular game statistics. The legacy `current_season` setting is compatibility-only once sport defaults diverge; both are documented non-blocking contracts.
- Anonymous and authenticated Data API privileges are explicitly allowlisted; future tables and functions are private by default.
- `service_role` access is explicitly limited to `INSERT` on `team_registrations` and `free_agents`; it has no other current public-table privilege, no public-sequence privilege, and no public-function `EXECUTE`. Future objects created by the repository migration owner (`postgres`) inherit no `service_role` access. Supabase platform-owned `supabase_admin` default ACLs cannot be altered by customer migrations; this is an accepted platform boundary, not an unresolved application grant, and every current object is re-revoked explicitly.
- `public_profiles` is verified as an intentional definer-style view with an exact 12-column safe-field allowlist.
- Anonymous clients cannot read profiles, waivers, intake records, admin identities, edit history, charges, or payment entries.
- Authenticated non-admin sessions can reach admin-managed tables only where required for RLS evaluation, and RLS returns no private rows.
- Anonymous/non-admin payment writes are explicitly denied, while administrator charge and payment-entry CRUD is positively verified. `payment_entries.recorded_by` remains client-supplied convenience metadata and is not trustworthy audit attribution.
- `hof_entries` is admin-only; `public_hof_entries` is an exact display-field allowlist gated by `hof_published`. Anonymous/non-admin writes are explicitly denied and administrator CRUD is positively verified.
- `current_waiver_version()` uses caller privileges, and `cvf_palette_color(integer)` has an immutable `pg_catalog` search path.
- The direct hosted catalog sweep confirms all 74 public foreign-key constraints have a covering index, with no unindexed-foreign-key advisor findings.

## Hosted advisor dispositions — 2026-07-22

The current Security Advisor reports 33 findings:

| Finding | Count | Disposition |
|---|---:|---|
| `rls_enabled_no_policy` on `admin_users` | 1 INFO | Intentional deny-all helper table. RLS is enabled and Data API access is revoked; admin membership is checked through controlled functions rather than client row reads. No action. |
| `security_definer_view` on `public_profiles` and `public_hof_entries` | 2 ERROR | Intentional allowlisted display boundaries. The views expose exact safe-field allowlists; base-table privileges remain private and both have negative regression coverage. |
| Anonymous executable `SECURITY DEFINER` warnings on `is_admin()` and `is_admin_identity()` | 2 WARN | Intentional authorization/MFA-routing helpers. Anonymous sessions receive false; no admin data is returned. |
| Authenticated executable `SECURITY DEFINER` warnings on helpers and admin RPCs | 27 WARN | Covers the prior two helpers/15 RPCs plus all ten Sequence 4 runtime RPCs. Hosted definitions confirm every new runtime endpoint calls the AAL2-aware admin guard; the expanded real-session matrix passed. |
| `auth_leaked_password_protection` | 1 WARN | Auth configuration setting, not a code defect or evidence of a leaked credential. Leaked-password protection requires a paid plan; enabling it is an owner/billing decision. It is not applicable to the current single-admin Free-plan state, so no action now. Revisit if the plan or account model changes. |

The current Performance Advisor reports 31 findings:

| Finding | Count | Disposition |
|---|---:|---|
| Unused indexes | 28 INFO | Expected at the early operational baseline, including the three new Sequence 4 outcome/history indexes and indexes on the intentionally empty ledger tables. Ten indexes from the prior 38-finding observation have since recorded use. Reassess after Season 1 activity; do not remove preemptively. |
| Multiple permissive policies | 3 WARN | Deferred consolidation recorded in `CLAUDE.md`. Preserve current public/admin semantics and negative RLS regression coverage before changing policies. Migration 23 removed the former `player_stats` overlap when it retired direct writes. |

## Remaining backend launch gates

Hosted authorization acceptance is complete and durably evidenced at 256/256 through Sequence 4 — see [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md). That acceptance covers the twenty-seven-migration hosted baseline. Migration 28 adds two tables and one RPC on top of it and is not yet covered; the matrix must be expanded to 28 tables / 26 RPCs and re-run before that migration is pushed.

Sequence 4 is behaviorally accepted through Migration 27. A later durable pilot remains required before official use. Because ledger evidence is intentionally append-only, the hosted positive-row proof must use an explicitly owner-approved durable pilot fixture rather than pretending it can be automatically cleaned up. That pilot is currently frozen.

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

The hosted ledger currently contains twenty-seven of the twenty-eight repository migrations; Migration 28 is the outstanding one. Every future migration push, migration-history repair, or other hosted write requires owner approval.

Migration 28 additionally requires, before its push is proposed: the authorization matrix expanded to 28 tables and 26 RPCs and re-run, and the frontend migrated to the new game shape so hosted mode is not left broken between the push and the client update. Never print or commit access tokens, database passwords, secret keys, or service-role keys.

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
- **RLS:** all 28 local (26 hosted) tables enable RLS. API privileges are separately allowlisted and covered by catalog assertions plus the accepted hosted authorization matrix at its stated baseline.
- **Game time and place:** `games.starts_at` is the single authoritative timestamptz, and `games.venue_id` references a real venue. The former `date` column, `time` display string, and free-text `location` are dropped — two records of one fact drift as soon as one is edited alone.
- **Participation is outside the score lifecycle:** `game_participation` is never written by the scoring RPCs, is not governed by the game lock, and never interacts with the aggregate or ledger correction authority. `set_game_participation` writes no score, stat, or history row, so it cannot become a second correction authority. A regression assertion proves participation is recordable on a final locked game while leaving the published result and edit-history count unchanged.
- **Games column allowlist:** Migration 23 restricts authenticated clients to schedule columns on `games`. Migration 28 reissues that allowlist over `starts_at`/`venue_id` after dropping the columns it originally named; score, stat, and history columns remain unreachable except through the scoring RPCs.
- **Ledger authority:** hosted Migration 24 makes aggregate the default, permits only controlled one-way conversion before score/session evidence, and blocks aggregate RPCs from ledger projections. Hosted Migrations 25–27 add the AAL2 ledger authority; structural acceptance passed, while real-session and durable-pilot behavior remain separately gated.
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
