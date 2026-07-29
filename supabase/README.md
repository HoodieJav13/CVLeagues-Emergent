# CVF Leagues — Supabase backend

This file is authoritative for CVF Leagues schema, migration ledger, backend invariants, and hosted verification state. Current product status, roadmap, and owner actions live in [`../CLAUDE.md`](../CLAUDE.md). This dedicated Supabase project must remain separate from ZonAthletica or any unrelated project.

## Verified status — 2026-07-28

- Twenty-nine migration files are present in filename order. A clean isolated reset applies all twenty-nine, and the independent pgtest run passes 340/340 plus a real two-connection idempotency race. Migrations 28 and 29 are both published and independently authorization-accepted. Hosted and `main` now present the same 29-migration surface.
- **Migration 29 dropped three `games` columns (`date`, `time`, `location`) and is therefore not silently reversible.** Its fresh pre-publication off-platform export and no-auto-deployment gate were completed before `main` advanced. It adds two tables (`venues`, `game_participation`), adds one RPC (`set_game_participation`), and replaces `schedule_playoff_match`'s signature.
- Migration 28's preserved 256/256 matrix covers its independent 28-migration, 26-table, 25-administrator-RPC checkpoint. Migration 29's separately approved `--surface m29` matrix covers the current 29-migration, 28-table, 26-administrator-RPC surface at 270/270. The two exact hosted-ledger assertions keep both acceptance boundaries independently auditable.
- **The CLI cannot publish a subset.** `supabase db push` applies every pending migration and `--include-all` only broadens that set, so isolation came from the checked-out migrations directory. The ordered publication record and completed no-deployment stop condition are in [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md).
- **The deliberate incompatibility window is closed.** No deployment occurred while `main` expected `starts_at`/`venue_id` and hosted was still at Migration 28; Migration 29 publication brought hosted onto the same surface.
- Local harness coverage pins the exact `games` INSERT and UPDATE column allowlists. This is a named column list, so it narrows silently when a listed column is dropped and leaves new columns unwritable — Migration 29 hit exactly that case and reissues the grant over `starts_at`/`venue_id`. Verified on the combined stack: score, stat, and history columns remain unreachable except through the scoring RPCs.
- The linked hosted project has all twenty-nine migrations applied. Migration 24's private Event Ledger Lite boundary remains behaviorally accepted, Migrations 25–27 passed migration, structure, row/settings baseline, privilege catalog, and advisor readback, Migration 28 passed its separate 256/256 matrix, and Migration 29 passed its separate 270/270 matrix. The Season 1 operational baseline was preserved exactly.
- Hosted verification confirms 82/82 foreign-key constraints with covering indexes, all 28 hosted tables with RLS enabled, the four empty ledger relations, empty `venues`/`game_participation`, and the expected operational row-count baseline. The earlier 74/74 figure was the Migration 28 surface and is superseded by this direct Migration 29 sweep.
- Hosted Security and Performance Advisors were rerun after Migration 29: 34 Security and 36 Performance findings have the itemized dispositions below. The additional Security warning maps exactly to the intended authenticated `set_game_participation` RPC, and the five additional Performance infos are unused indexes on the new empty surface; no ledger ACL or unindexed-foreign-key finding was reported.
- `supabase/config.toml` is present; unused local Storage and Analytics services are intentionally disabled.
- The real Auth administrator is linked through `admin_users`, and administration requires verified AAL2/TOTP. The final hosted matrix verified fail-closed anonymous, authenticated non-admin, password-only linked-admin, and AAL2 administrator behavior across the current surface.
- The Migration 28 hosted authorization matrix passed 256/256 browser/API and catalog checks across all 26 hosted tables and all 25 administrator RPCs. Its exact hosted-ledger assertion observed 28 migrations with latest version `20260723154411`; fixture cleanup and exact restoration of the Season 1 operational baseline both passed. See [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-28-m28.md`](evidence/hosted-auth-matrix-2026-07-28-m28.md). The Sequence 4, Migration-24, and Migration-23 evidence files remain prior accepted checkpoints.
- The Migration 29 hosted authorization matrix passed 270/270 checks across all 28 hosted tables and all 26 administrator RPCs. Its exact hosted-ledger assertion observed 29 migrations with latest version `20260726120000`; fixture cleanup and exact restoration both passed. See [`evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md`](evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md). The invalid-TOTP first report and the 269/270 harness-expectation report are preserved beside it as immutable failed evidence.
- Sequence 4 adds ten authenticated-only AAL2 ledger RPCs, deterministic final projection, W/L-only forfeits, bracket-safe corrections, and the admin live-ledger surface. Its three migrations are published and its authorization boundary is behaviorally accepted. No durable ledger evidence, deployment, or pilot was created. See [`evidence/sequence-4-local-acceptance-2026-07-22.md`](evidence/sequence-4-local-acceptance-2026-07-22.md), [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md), and [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md).
- The independent earlier [`Migration-27 matrix`](evidence/hosted-auth-matrix-2026-07-22-m27.md) passed the same 256/256 surface with exact cleanup and restoration; both dated evidence files are preserved.
- Sequence 5A's Migration 28 adds explicit admin-closed overtime periods, tied continuation without publication, and event-specific `INV-07` pairing enforcement/override evidence. Local verification passes 318/318 plus the race, 133/133 frontend tests, production build, schema replay/lint, and responsive browser checks; hosted structural readback and the 256/256 authorization matrix also pass. Positive populated-ledger behavior remains a separate durable-pilot gate. See [`evidence/sequence-5a-local-acceptance-2026-07-23.md`](evidence/sequence-5a-local-acceptance-2026-07-23.md) and [`evidence/hosted-auth-matrix-2026-07-28-m28.md`](evidence/hosted-auth-matrix-2026-07-28-m28.md).
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

The project is linked and all twenty-nine hosted migrations are applied with migration history, structural catalog checks, the operational row/settings baseline, and both advisors read back. Behavioral authorization acceptance is current through Migration 29's 270/270 surface. See the accepted [`Migration 29 execution`](evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md), the independent [`Migration 28 execution`](evidence/hosted-auth-matrix-2026-07-28-m28.md), the prior [`2026-07-25 execution`](evidence/hosted-auth-matrix-2026-07-24.md), the independent [`2026-07-22 execution`](evidence/hosted-auth-matrix-2026-07-22-m27.md), [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md), and the immutable earlier checkpoints.

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
| `20260723154411_sequence_5a_overtime_pairing_rules.sql` | **Migration 28. Hosted and authorization-accepted.** Sequence 5A: explicit overtime-period close/continuation, paired-stat entry enforcement with append-only reasoned exceptions, and overtime-aware projection/finalization |
| `20260726120000_venues_game_start_times_participation.sql` | **Migration 29. Hosted and authorization-accepted.** Adds `venues`; replaces game date/display-time/free-text location with an authoritative `starts_at` timestamptz and `venue_id`; adds `game_participation` and `set_game_participation` outside the score lock; reissues Migration 23's games column allowlist over the replacement columns; replaces `schedule_playoff_match` with the new signature |

## Completed database hardening

- Team charges must match the referenced team's league season.
- Charged teams cannot move to a league in another season.
- Leagues with charged teams cannot be reassigned to a conflicting season.
- Season-name cascades remain supported and verified.
- Games with granular statistics cannot change leagues; leagues with granular statistics cannot change season or league/tournament kind.
- Bracket headers, seed snapshots, and match topology are read-only through the Data API; all mutations use the verified playoff RPC workflow.
- Team identities and enrollments are read-only through the Data API; creation, enrollment, brand propagation, and supported lifecycle edits use admin-guarded RPCs.
- Aggregate score/stat/history mutation is RPC-only locally and hosted. `submit_score` and `correct_final_score` enforce HARD invariants, require a recorded reason for SOFT overrides, and preserve append-only audit; the final correction never unlocks the public result.
- Event Ledger Lite's Sequence 4 runtime, projection, forfeit, correction, and admin UI are locally verified; Migrations 25–27 are published; and the expanded real-session authorization matrix is accepted. Aggregate remains the default; the durable populated-ledger pilot remains unexecuted.
- Sequence 5A's Migration 28 is locally verified, hosted, and authorization-accepted. It reuses the same ledger authority for overtime, requires explicit append-only period closes, prevents mid-period/tied publication, and makes paired-stat exceptions per-event, reasoned, immutable, and visible again at finalization.
- Career-baseline imports must not overlap seasons represented by granular game statistics. The legacy `current_season` setting is compatibility-only once sport defaults diverge; both are documented non-blocking contracts.
- Anonymous and authenticated Data API privileges are explicitly allowlisted; future tables and functions are private by default.
- `service_role` access is explicitly limited to `INSERT` on `team_registrations` and `free_agents`; it has no other current public-table privilege, no public-sequence privilege, and no public-function `EXECUTE`. Future objects created by the repository migration owner (`postgres`) inherit no `service_role` access. Supabase platform-owned `supabase_admin` default ACLs cannot be altered by customer migrations; this is an accepted platform boundary, not an unresolved application grant, and every current object is re-revoked explicitly.
- `public_profiles` is verified as an intentional definer-style view with an exact 12-column safe-field allowlist.
- Anonymous clients cannot read profiles, waivers, intake records, admin identities, edit history, charges, or payment entries.
- Authenticated non-admin sessions can reach admin-managed tables only where required for RLS evaluation, and RLS returns no private rows.
- Anonymous/non-admin payment writes are explicitly denied, while administrator charge and payment-entry CRUD is positively verified. `payment_entries.recorded_by` remains client-supplied convenience metadata and is not trustworthy audit attribution.
- `hof_entries` is admin-only; `public_hof_entries` is an exact display-field allowlist gated by `hof_published`. Anonymous/non-admin writes are explicitly denied and administrator CRUD is positively verified.
- `current_waiver_version()` uses caller privileges, and `cvf_palette_color(integer)` has an immutable `pg_catalog` search path.
- The direct hosted catalog sweep confirms all 82 public foreign-key constraints have a covering index, with no unindexed-foreign-key advisor findings.

## Hosted advisor dispositions — 2026-07-28

The current Security Advisor reports 34 findings:

| Finding | Count | Disposition |
|---|---:|---|
| `rls_enabled_no_policy` on `admin_users` | 1 INFO | Intentional deny-all helper table. RLS is enabled and Data API access is revoked; admin membership is checked through controlled functions rather than client row reads. No action. |
| `security_definer_view` on `public_profiles` and `public_hof_entries` | 2 ERROR | Intentional allowlisted display boundaries. The views expose exact safe-field allowlists; base-table privileges remain private and both have negative regression coverage. |
| Anonymous executable `SECURITY DEFINER` warnings on `is_admin()` and `is_admin_identity()` | 2 WARN | Intentional authorization/MFA-routing helpers. Anonymous sessions receive false; no admin data is returned. |
| Authenticated executable `SECURITY DEFINER` warnings on helpers and admin RPCs | 28 WARN | Covers the prior two helpers/15 RPCs, all ten Sequence 4 runtime RPCs, and Migration 29's `set_game_participation`. Hosted definitions confirm every endpoint calls the AAL2-aware admin guard, and the 270/270 current-surface matrix verifies lower-role and lower-assurance denial. Positive ledger execution remains a durable-pilot check. |
| `auth_leaked_password_protection` | 1 WARN | Auth configuration setting, not a code defect or evidence of a leaked credential. Leaked-password protection requires a paid plan; enabling it is an owner/billing decision. It is not applicable to the current single-admin Free-plan state, so no action now. Revisit if the plan or account model changes. |

The current Performance Advisor reports 36 findings:

| Finding | Count | Disposition |
|---|---:|---|
| Unused indexes | 33 INFO | Expected at the early operational baseline, including the three new Sequence 4 outcome/history indexes, indexes on the intentionally empty ledger tables, and five indexes on Migration 29's empty venues/participation surface. Ten indexes from the prior 38-finding observation have since recorded use. Reassess after Season 1 activity; do not remove preemptively. |
| Multiple permissive policies | 3 WARN | Deferred consolidation recorded in `CLAUDE.md`. Preserve current public/admin semantics and negative RLS regression coverage before changing policies. Migration 23 removed the former `player_stats` overlap when it retired direct writes. |

## Remaining backend launch gates

Hosted authorization acceptance is complete and durably evidenced at 270/270 through Migration 29 — see [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md`](evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md).

Sequence 5A and Migration 29 are behaviorally accepted at their independent hosted boundaries. The remaining signed-rushing-yardage UI path and practice-mode boundary must close before the durable official pilot. Because ledger evidence is intentionally append-only, the hosted positive-row proof must use an explicitly owner-approved durable pilot fixture rather than pretending it can be automatically cleaned up.

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

The hosted ledger currently contains repository Migrations 1–29 and is up to date. Every future migration push, migration-history repair, or other hosted write requires owner approval. Never print or commit access tokens, database passwords, secret keys, or service-role keys.

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
- **Game time and place:** `games.starts_at` is the single authoritative timestamptz and `games.venue_id` references a real venue. The former `date` column, `time` display string, and free-text `location` are dropped — two records of one fact drift as soon as one is edited alone.
- **Participation is outside the score lifecycle:** `game_participation` is never written by the scoring RPCs, is not governed by the game lock, and never interacts with the aggregate or ledger correction authority. `set_game_participation` writes no score, stat, or history row, so it cannot become a second correction authority. Regressions prove participation is recordable on both aggregate-final and ledger-finalized locked games while leaving the published result, edit history, projections, and ledger events unchanged; the R2-C extension closes the prior `INV-30`/`INV-35`/`INV-39` proof gap.
- **RLS:** all 28 local and hosted tables enable RLS. API privileges are separately allowlisted and covered by catalog assertions plus the accepted hosted authorization matrix at its stated baseline.
- **Ledger authority:** hosted Migration 24 makes aggregate the default, permits only controlled one-way conversion before score/session evidence, and blocks aggregate RPCs from ledger projections. Hosted Migrations 25–27 add the AAL2 ledger authority; structural and real-session authorization acceptance passed, while populated-ledger behavior remains a durable-pilot gate.
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
