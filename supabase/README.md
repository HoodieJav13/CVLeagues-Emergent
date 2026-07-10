# CVF Leagues — Supabase backend

This directory contains the migration source of truth for CVF Leagues' dedicated Supabase project. It must remain separate from ZonAthletica or any unrelated project.

## Verified status — 2026-07-10

- Ten migration files are present in filename order.
- The repository's plain-PostgreSQL harness applies all ten migrations and passes 63/63 assertions.
- The frontend Supabase adapter is implemented and env-gated.
- Supabase CLI `2.109.0` is installed on the audited machine.
- `supabase/config.toml` is not present, so the repository has not been initialized as a local Supabase project.
- A real `supabase db reset`, PostgREST/Data API test, hosted migration, advisor run, and hosted authorization matrix have not been completed.
- No production seed data, hosted project reference, or credentials are stored here.

Passing the PostgreSQL harness does not prove local-stack or hosted Supabase behavior. In particular, it does not exercise the Data API, Auth sessions, project exposure settings, or hosted advisors.

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

## Completed pre-hosting hardening

- Team charges must match the referenced team's league season.
- Charged teams cannot move to a league in another season.
- Leagues with charged teams cannot be reassigned to a conflicting season.
- Season-name cascades remain supported and verified.

## Pre-hosting blockers

Do not push the current migration set to a hosted project until these gates are resolved and reviewed:

1. Add and test explicit Data API privileges for every table, view, sequence, and function the frontend needs. New Supabase projects no longer necessarily expose newly created database objects automatically; RLS controls rows after an object is exposed, while `GRANT` controls whether the API role can reach it at all. See Supabase's [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
2. Add public-profile regression tests that attempt to retrieve each forbidden PII field, not only tests that count visible rows.
3. Apply the migrations through a real local Supabase reset and test the API with anonymous, authenticated non-admin, and admin sessions.
4. Review whether direct table writes can bypass score/history RPC invariants before the hosted authorization matrix.

Statistics scope decisions remain required before Season 2 or real tournament statistics. Payment audit semantics remain required before operational use of the payments tables.

## Local verification

First confirm the installed commands instead of relying on remembered CLI flags:

```sh
supabase --version
supabase --help
supabase db --help
supabase migration --help
```

After the owner approves the local Supabase-validation stage:

```sh
supabase init
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

## Hosted migration gate

Project creation, linking, credentials, migration push, migration-history repair, and hosted writes require owner approval. Never print or commit access tokens, database passwords, secret keys, or service-role keys.

After the owner creates the dedicated project and authorizes linking:

```sh
supabase login
supabase link --project-ref <project-ref>
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
- **Public profiles:** public names and sport fields come from an explicit allowlist; contact and administrative PII stays in `profiles`.
- **Intake:** anonymous users can submit clean initial records but cannot read them back or set triage state.
- **Hall of Fame:** entries remain invisible to public roles until the settings gate is enabled.
- **Payments:** exactly one payer is required per charge, and a team charge must match the team's league season.

## Owner-controlled steps after a verified push

1. Create the real Supabase Auth administrator and add its UUID to `admin_users` through a privileged channel.
2. Configure MFA, recovery, session revocation, and any break-glass administrator.
3. Insert the attorney-approved waiver as a new immutable `waiver_versions` row. Until then, the public waiver flow must have no fallback text.
4. Create the real Season 1 league and team records only after the clean-state report is approved.
5. Enter the project URL and publishable/public key personally. Never put a service-role or secret key in React.

No remote database reset, migration repair, Auth/admin identity change, or hosted data write is routine housekeeping.
