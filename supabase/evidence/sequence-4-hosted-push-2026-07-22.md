# Sequence 4 hosted push — 2026-07-22

- **Completion level:** PUBLISHED — hosted behavioral acceptance pending
- **Project:** `orlhqewzprjadyrdrqxw` (`CVF Leagues`)
- **Repository commit:** `168a432f2d36d97880c48cd6196e0aeda2a21724`
- **Migrations:** 25–27
- **Supabase CLI:** `2.109.0`

## Authorization and scope

The owner was shown an exact checkpoint naming `supabase db push --linked
--yes`, the CVF Leagues project, and only Migrations 25–27. The owner then
gave a discrete `approve`. That approval covered the migration push and its
immediate read-only structural, baseline, catalog, and advisor verification.
It did not authorize the fixture-writing hosted authorization matrix, a
durable ledger pilot row, deployment, or live pilot use.

## Pre-push gate

- Test baseline and integration target were identical at clean
  `main@168a432`.
- The authenticated CLI showed the linked project as `CVF Leagues`, ref
  `orlhqewzprjadyrdrqxw`, status `ACTIVE_HEALTHY`; the unrelated CVFPT project
  was not linked.
- Hosted migration history matched local Migrations 1–24 exactly.
- `supabase db push --linked --dry-run` named only, once and in order:
  1. `20260722052347_ledger_runtime_sessions.sql`
  2. `20260722052350_ledger_projection_finalization.sql`
  3. `20260722052352_ledger_correction_authority.sql`
- Fresh private logical exports were written outside the repository with mode
  `0600`:
  - schema: `/private/tmp/cvf-leagues-pre-seq4-schema-2026-07-22.sql` —
    SHA-256 `87b9bfc57f3f9597a78f8b95b589d4d212012b5665a12693ff885d4dfbef27b1`
  - public data: `/private/tmp/cvf-leagues-pre-seq4-data-2026-07-22.sql` —
    SHA-256 `1adf569caa55ea304c755adfdb6b96db560d77e4e31794b3a55c1a6c6cff13c5`
- The data-only export warned that the self-referential playoff and ledger
  constraints require constraint-aware restoration. The export completed;
  rollback remains a reviewed forward migration or an explicitly approved,
  constraint-aware restore rather than a speculative reset.
- All 26 public tables had RLS. The four ledger relations were empty, had four
  AAL2-admin read policies, authenticated SELECT-only access, and no anonymous
  or `service_role` table access. Migration 24's seven helpers were not client
  or service executable; none of the ten Sequence 4 RPCs existed yet.
- `service_role` retained only `INSERT` on `free_agents` and
  `team_registrations`, with zero public-sequence or public-function privilege
  and zero `postgres` default grant in the `public` schema. Twelve broad
  `postgres` defaults initially surfaced during inspection and were confirmed
  to belong only to Supabase's platform `storage` schema, not the application
  boundary.
- The row/settings baseline was: `admin_users=1`, `seasons=2`, `leagues=1`,
  `team_identities=1`, `teams=1`, `profiles=1`, `team_players=1`, and
  `league_settings=1`; every other public table was empty.
  `current_season='Summer 2026'`, `hof_published=false`, and no waiver version
  existed.

## Push and immediate readback

- `supabase db push --linked --yes`: **PASS** — all three approved migrations
  applied in filename order.
- The CLI emitted a post-application pg-delta cache warning because its
  temporary target CA file was absent. Independent readbacks below classify
  this as a cache-only CLI warning, not a migration failure.
- Hosted migration history is **27/27 aligned** and the post-push dry run says
  `Remote database is up to date.`
- The eleven expected columns, three indexes, valid game-outcome constraint,
  and correction-target trigger are present.
- All ten runtime RPCs exist as fixed-search-path `SECURITY DEFINER` functions,
  invoke the administrator guard, and resolve through an authorization anchor
  that requires AAL2.
- Hosted function definitions preserve the mutually exclusive correction
  authorities: aggregate correction cannot set the private ledger-projection
  transaction flag, while ledger correction begins only from a ledger game and
  finalizes through the guarded ledger session/projection chain.
- The complete ledger catalog passed: four tables present with RLS, four admin
  read policies, anonymous denied, authenticated SELECT-only, `service_role`
  denied, twelve helpers non-client-executable, and all ten runtime RPCs
  executable only by `authenticated` at the SQL-grant layer.
- The full row/settings baseline matched the pre-push observation exactly;
  all four append-only ledger relations remain empty.
- The broader service-role/default-ACL boundary remained unchanged.

## Advisors

Security Advisor: **33 findings** — 1 INFO, 2 ERROR, 30 WARN.

- The previously accepted 23 findings remain: the deny-all `admin_users`
  helper, two exact allowlisted definer views, two anonymous boolean auth
  helpers, 17 authenticated admin/helper RPC warnings, and the Free-plan
  leaked-password-protection setting.
- The ten new WARNs correspond exactly to the ten intended Sequence 4 runtime
  RPCs. They are authenticated `SECURITY DEFINER` endpoints by design; every
  function calls the AAL2 admin guard, while anonymous and `service_role`
  execution are denied. The separately approved real-session matrix must still
  execute the role boundary before behavioral acceptance.

Performance Advisor: **31 findings** — 28 INFO, 3 WARN.

- The 28 INFOs are unused indexes at the still-empty/early operational
  baseline, including the three new outcome/history indexes from Migration 26.
  Do not remove them before real Season 1 query evidence exists.
- The same three overlapping public/admin SELECT policy warnings remain on
  `career_baselines`, `leagues`, and `seasons`.
- The earlier 38-finding Migration-24 observation is historical; ten prior
  indexes have since recorded use, so this fresh 31-finding result supersedes
  that count without representing a regression.

## Current gate

Sequence 4 is **published**, not **accepted**. No hosted fixture, ledger event,
session, correction, deployment, or pilot was created in this push gate.

The next separately authorized check is the 26-table / 25-RPC real-session
authorization matrix with its disposable aggregate fixture, automatic cleanup,
and exact baseline-restoration proof. Because ledger evidence is append-only,
the first positive populated-ledger visibility/write proof remains an explicit
durable Sequence 5 pilot action rather than a supposedly disposable matrix row.
Overtime and `INV-07` paired-stat reconciliation remain hard blockers before
that pilot can represent a real official game.
