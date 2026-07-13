# CVF Leagues — Supabase backend

This directory contains the migration source of truth for CVF Leagues' dedicated Supabase project. It must remain separate from ZonAthletica or any unrelated project.

## Verified status — 2026-07-13

- Twelve migration files are present in filename order and committed through `2454768`.
- A clean real local Supabase reset applies all twelve migrations on PostgreSQL 17; the complete pgtest suite passes 100/100 and anonymous PostgREST checks pass 7/7.
- This repository is linked to the dedicated hosted project, whose migration ledger matches all twelve local migrations; a final `db push --dry-run` reports the remote database is up to date.
- Hosted verification confirms the two remediated function attributes, 38/38 foreign-key index coverage, and the expected clean row-count baseline.
- Hosted Security and Performance Advisors were rerun: all 12 Security Advisor and 19 Performance Advisor findings have the itemized dispositions below. No finding is being silently dismissed.
- `supabase/config.toml` is present; unused local Storage and Analytics services are intentionally disabled.
- The real Auth administrator is linked through `admin_users`, and the owner-configured local frontend runs against hosted Supabase. Anonymous, authenticated non-admin, and administrator role resolution is verified fail-closed; the hosted locked-score disable/unlock/re-enable/re-lock fixture cycle also passes with baseline row counts restored.
- The hosted authorization matrix is executed and durably evidenced: 66/66 browser/API checks passed with real anonymous, authenticated non-admin, and administrator sessions, and fixture cleanup restored the exact hosted baseline. See [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-13.md`](evidence/hosted-auth-matrix-2026-07-13.md).
- MFA/recovery/session-revocation readiness, production-safe mock handling, preview/production environment values, and the live eight-step application flow remain open.
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

The project is linked and all twelve migrations are applied. Hosted migration history, catalog invariants, clean row counts, both advisors, and the real-session hosted authorization matrix are verified. The reusable procedure and dated evidence are retained in [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-13.md`](evidence/hosted-auth-matrix-2026-07-13.md). This closes the Phase 9 database and hosted-authorization gates; it does not replace the still-pending live application QA.

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

## Completed database hardening

- Team charges must match the referenced team's league season.
- Charged teams cannot move to a league in another season.
- Leagues with charged teams cannot be reassigned to a conflicting season.
- Season-name cascades remain supported and verified.
- Anonymous and authenticated Data API privileges are explicitly allowlisted; future tables and functions are private by default.
- `public_profiles` is verified as an intentional definer-style view with an exact 12-column safe-field allowlist.
- Anonymous clients cannot read profiles, waivers, intake records, admin identities, edit history, charges, or payment entries.
- Authenticated non-admin sessions can reach admin-managed tables only where required for RLS evaluation, and RLS returns no private rows.
- `current_waiver_version()` uses caller privileges, and `cvf_palette_color(integer)` has an immutable `pg_catalog` search path.
- All 38 public foreign keys have a covering index; no hosted unindexed-foreign-key advisor findings remain.

## Hosted advisor dispositions — 2026-07-13

The current Security Advisor reports 12 findings:

| Finding | Count | Disposition |
|---|---:|---|
| `rls_enabled_no_policy` on `admin_users` | 1 INFO | Intentional deny-all helper table. RLS is enabled and Data API access is revoked; admin membership is checked through controlled functions rather than client row reads. No action. |
| `security_definer_view` on `public_profiles` | 1 ERROR | Intentional security boundary. The view exposes an explicit 12-column safe-field allowlist and has negative PII regression coverage. Keep and document. |
| Anonymous executable `SECURITY DEFINER` warning on `is_admin()` | 1 WARN | Already reviewed. Anonymous execution is required by current RLS/helper behavior and returns false without an authenticated admin identity. No action. |
| Authenticated executable `SECURITY DEFINER` warning on `is_admin()` | 1 WARN | The same existing function as the anonymous warning, surfaced separately by the newer role-specific lint. Already reviewed with the same disposition; no new function or code change triggered it. |
| Authenticated executable `SECURITY DEFINER` warnings on admin RPCs | 7 WARN | Applies to `approve_registration`, `assign_free_agent`, `lock_game`, `save_score`, `set_game_status`, `unlock_game`, and `verify_waiver`. Each is an intentional client-callable endpoint that invokes `assert_admin()`; all seven real-session non-admin negative checks pass in the retained hosted matrix evidence. No schema action now. |
| `auth_leaked_password_protection` | 1 WARN | Auth configuration setting, not a code defect or evidence of a leaked credential. Leaked-password protection requires a paid plan; enabling it is an owner/billing decision. It is not applicable to the current single-admin Free-plan state, so no action now. Revisit if the plan or account model changes. |

The current Performance Advisor reports 19 findings:

| Finding | Count | Disposition |
|---|---:|---|
| Unused indexes | 12 INFO | Expected while hosted launch tables are empty. Reassess from real query and usage evidence after data entry; do not remove preemptively. |
| Multiple permissive policies | 7 WARN | Deferred consolidation recorded in `CLAUDE.md`. Preserve current public/admin semantics and add negative RLS regression coverage before changing policies. |

## Remaining backend launch gates

Hosted authorization matrix executed and durably evidenced — see [`HOSTED_AUTH_RUNBOOK.md`](HOSTED_AUTH_RUNBOOK.md) and [`evidence/hosted-auth-matrix-2026-07-13.md`](evidence/hosted-auth-matrix-2026-07-13.md).

1. Complete MFA, recovery, and session-revocation checks for the already-linked administrator; decide separately whether a break-glass administrator is warranted.
2. Harden preview/production against silent mock fallback, then enter the hosted URL and publishable key in those environments without exposing a service-role or secret key. Local hosted-mode values are already configured.
3. Run the live eight-step score flow and edge-case suite against hosted Supabase with no mock or localStorage participation.
4. Complete Phase 10 preview deployment and acceptance before production launch.

Statistics scope decisions remain required before Season 2 or real tournament statistics. Payment audit semantics remain required before operational use of the payments tables.

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
supabase db reset
supabase migration list --local
```

`supabase db reset` recreates the local database, applies migrations in order, and applies `supabase/seed.sql` if one exists. This repository intentionally has no seed file. Never substitute a remote reset for this local command.

Run the repository harness separately:

```sh
./tests/pgtest/run_pgtest.sh
```

The harness requires local PostgreSQL binaries and permission to allocate PostgreSQL shared memory.

## Future hosted migration procedure

The hosted ledger currently matches all twelve repository migrations and the database gate is closed. Every future migration push, migration-history repair, or other hosted write still requires owner approval. Never print or commit access tokens, database passwords, secret keys, or service-role keys.

Before a future hosted migration:

```sh
supabase migration list
supabase db push --dry-run
```

The dry-run must show only the expected additive migrations, once each and in filename order. It must not include seed data or reveal migration-history divergence. Supabase documents that `db push --dry-run` prints migrations without applying them; see the [CLI reference](https://supabase.com/docs/reference/cli/introduction).

Stop for explicit owner approval before:

```sh
supabase db push
```

After an approved push, immediately re-run migration listing, compare hosted history with Git, verify expected objects, and run Security and Performance Advisors. Do not repair history speculatively if a migration fails.

## Database-owned invariants

- **Admin identity:** `admin_users` is distinct from player profiles; Auth User is not Player.
- **RLS:** all 18 tables enable RLS. API privileges must also be explicitly verified.
- **Game locks:** score, lifecycle, lock, and competition-stage changes are blocked while locked unless the approved unlock transaction records a non-empty reason.
- **Edit history:** game history rows are insert-only and immutable.
- **Competition stages:** tournament containers accept only tournament games; league containers accept regular/playoff games.
- **Waivers:** signature fields are immutable, re-signing inserts a new row, and profile linkage is one-shot.
- **Public profiles:** `public_profiles` intentionally uses definer-style view behavior to read through private `profiles` RLS. Its exact allowlist is `id`, `first_name`, `last_name`, `display_name`, `name`, `sports`, `experience`, `bio`, `avatar_color`, `claimed`, `eligibility_status`, and `created_at`. Email, phone, date of birth, emergency contacts, admin notes, Auth user IDs, and waiver details are absent and regression-tested.
- **Data API:** grants are reset and rebuilt from an anon/authenticated allowlist. RLS remains mandatory after a role receives object access. New functions created by the migration role do not inherit PostgreSQL's default `PUBLIC EXECUTE`; later client-facing functions require an explicit grant. See Supabase's [API security guidance](https://supabase.com/docs/guides/api/securing-your-api) and [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- **Intake:** anonymous users can submit clean initial records but cannot read them back or set triage state.
- **Hall of Fame:** entries remain invisible to public roles until the settings gate is enabled.
- **Payments:** exactly one payer is required per charge, and a team charge must match the team's league season.

## Remaining owner-controlled steps

1. Configure MFA, recovery, session revocation, and any break-glass administrator. The primary Auth administrator and `admin_users` link are already complete.
2. Insert the attorney-approved waiver as a new immutable `waiver_versions` row. Until then, the public waiver flow must have no fallback text.
3. Create the real Season 1 league and team records only after the clean-state report is approved.
4. Enter the project URL and publishable/public key personally for preview and production. Local hosted-mode values already exist. Never put a service-role or secret key in React.

No remote database reset, migration repair, Auth/admin identity change, or hosted data write is routine housekeeping.
