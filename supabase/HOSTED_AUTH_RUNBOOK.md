# Hosted authorization acceptance runbook

This runbook is authoritative for the repeatable hosted authorization procedure. The accepted Sequence 4 baseline covers all 26 tables and 25 privileged RPCs, including the four private ledger relations and ten authenticated-only runtime RPCs, with real anonymous, authenticated non-admin, password-only administrator, and AAL2 administrator sessions plus privileged catalog checks.

The harness creates a uniquely namespaced disposable aggregate fixture through the linked Supabase CLI, exercises authorization through browser-held user sessions, removes the fixture through the same privileged CLI channel, and compares every public-table row count and relevant singleton setting with the pre-run baseline. It deliberately does not seed ledger evidence: those rows are append-only even to the migration owner. The accepted Sequence 4 run includes 248 browser/API checks and eight exact catalog checks, including the runtime-RPC ACL catalog check plus anonymous/non-admin denial for all ten new endpoints. A populated positive read/write proof remains a separate durable-pilot gate.

## Safety model

- Run only with explicit owner approval for the hosted fixture write and teardown.
- Confirm the linked project is `orlhqewzprjadyrdrqxw` before continuing. The runner also refuses any frontend URL with a different project reference.
- Use only the designated disposable administrator and authenticated non-admin test accounts.
- Enter both Auth passwords in the local browser page. Passwords and session tokens stay in browser memory and are cleared after sign-in.
- The runner reads only the public URL and anonymous/publishable key from `frontend/.env.local` and never prints their values.
- No service-role key or database password is used. Privileged fixture setup, teardown, and count queries use `supabase db query --linked` through the authenticated Supabase CLI Management API.
- The fixture uses a unique `cvf-matrix-<date>-<random>` namespace. Cleanup targets its explicit IDs, season, and reserved `example.invalid` addresses.
- Closing the page does not count as completion. If the browser cannot post results, interrupt the shell runner so its signal handler performs privileged cleanup.

Append-only waivers and game edit history intentionally cannot be deleted by an ordinary administrator. The privileged cleanup channel exists only to remove this approved disposable test namespace; it does not weaken or alter application policies.

## Prerequisites

From the repository root:

1. Confirm the working tree and branch.
2. Confirm Supabase CLI authentication and linkage to the dedicated project.
3. Confirm `frontend/.env.local` contains the hosted public URL, anonymous/publishable key, and Turnstile site key. Do not print their values.
4. Confirm `frontend/node_modules` is installed so the harness can serve the pinned local `@supabase/supabase-js` browser bundle.
5. Confirm the two disposable Auth users exist and that only the administrator is linked in `public.admin_users`.
6. Confirm the administrator has a verified TOTP factor and have its authenticator available.
7. Obtain explicit owner approval for the fixture cycle.

Read-only preflight:

```sh
git status --short
git branch --show-current
supabase --version
supabase migration list
supabase db push --dry-run
```

The current accepted behavioral baseline is Sequence 4: 27 migrations, 26 tables, and 25 administrator RPCs. Preflight must show all 27 hosted migrations aligned and an up-to-date dry run. Do not present the earlier 154-case Migration-23 or 225-case Migration-24 run as current-surface acceptance.

Latest accepted behavioral evidence: [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md) records the Sequence 4 baseline at 256/256 browser/API and catalog checks with fixture cleanup and exact restoration both passing. [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md) records the preceding 27-migration structural gate. The immutable [`Migration-24 evidence`](evidence/hosted-auth-matrix-2026-07-21-m24.md) and [`Migration-23 evidence`](evidence/hosted-auth-matrix-2026-07-21-m23.md) remain prior checkpoints.

## Run

Choose a dated evidence path, then start the harness:

```sh
CVF_HOSTED_AUTH_NO_OPEN=1 ./tests/hosted-auth/run_matrix.sh \
  supabase/evidence/hosted-auth-matrix-YYYY-MM-DD.md
```

Open the printed loopback URL in the in-app browser or another isolated browser. Complete both Turnstile widgets, enter the administrator and non-admin test-account credentials plus the administrator TOTP code personally, then select **Run hosted matrix**.

The terminal must end with all three lines reporting `PASS`:

```text
RESULT PASS: <passed>/<total> browser/API and catalog checks passed.
CLEANUP PASS: fixture namespace contains zero rows.
BASELINE PASS: all row counts and settings restored.
```

The command exits nonzero if any browser/API assertion, residue query, or baseline comparison fails.

## Matrix categories

### Identity resolution

- Anonymous `is_admin()` returns false.
- The real authenticated non-admin returns false.
- The linked administrator returns true.

### Protected intake boundary

- Direct anonymous team-interest, free-agent, and waiver writes are denied.
- Direct authenticated non-admin intake is denied by RLS.
- Public positive submissions are exercised through the deployed Turnstile-verified application endpoint, not through the Data API matrix.
- A privileged post-push catalog check confirms that `service_role` has INSERT only on `team_registrations` and `free_agents`, cannot read or rewrite their submitted PII, and has no DML privilege on unrelated public tables. The browser harness never receives the service secret.

### Public and private reads

- Anonymous reads succeed for the fixture season, league, persistent team identity, enrollment, roster, game, settings, waiver version, playoff bracket tables, and allowlisted public profile.
- Selecting PII such as email from `public_profiles` fails.
- Anonymous and non-admin sessions cannot retrieve `admin_users`, profiles, waivers, intake rows, edit history, charges, or payment entries. The harness treats either a Data API denial or an RLS-empty result as a pass.

### Private ledger boundary — Migration 24

For each of `scorekeeping_sessions`, `scorekeeping_participants`, `scorekeeping_events`, and `scorekeeping_event_attributions`, the browser matrix executes all four operations for all four relevant session states:

- Anonymous reads fail at the table-privilege boundary; insert, update, and delete also fail there.
- The authenticated non-admin can reach the SELECT-only Data API surface but receives no private rows; insert, update, and delete fail at the table-privilege boundary.
- The linked password-only administrator remains AAL1 and receives no private rows; insert, update, and delete fail at the table-privilege boundary.
- The AAL2 administrator can query each relation; insert, update, and delete still fail because ledger mutation is not a client capability.

At the accepted Migration-24 baseline, seven privileged catalog checks require all four relations to exist with RLS, exactly four authenticated admin-read policies, authenticated SELECT-only privileges, zero anonymous privileges, zero `service_role` privileges, and no client/service execution of the seven schema trigger helpers. The Sequence 4 contract expands the helper class sweep to twelve and adds an eighth check requiring all ten runtime RPCs to be executable by `authenticated` but not by `anon` or `service_role`. A catalog failure stops the runner before fixture seeding.

The hosted tables are expected to be empty immediately after Migration 24, so successful AAL2 queries assert the response shape against a possibly empty result and do not claim positive-row visibility by themselves. The current 294-assertion local harness supplies positive-row proof while hosted API and catalog checks prove the deployed access boundary without leaving undeletable ledger evidence behind. The first real Sequence 5 pilot session must close the hosted boundary against the same durable row: AAL2 can read it, authenticated non-admin remains RLS-empty, and the authorized write produces the expected projection. Automatic cleanup is not claimed because the evidence is intentionally append-only.

### Admin RPC denial

Anonymous execution is denied for all 15 client-facing admin RPCs. A real authenticated non-admin must reach and fail at `assert_admin()` for each:

- `submit_score`
- `lock_game`
- `correct_final_score`
- `set_game_status`
- `approve_registration`
- `assign_free_agent`
- `verify_waiver`
- `generate_single_elim_bracket`
- `schedule_playoff_match`
- `link_playoff_game`
- `advance_playoff_match`
- `enroll_team_identity`
- `create_team_identity_and_enroll`
- `update_team_identity`
- `update_team_enrollment`

After the Sequence 4 migrations are applied, the same denial loop also covers:

- `start_scorekeeping_session`
- `renew_scorekeeping_session`
- `resume_scorekeeping_session`
- `append_scorekeeping_event`
- `replace_scorekeeping_event`
- `finalize_scorekeeping_session`
- `cancel_scorekeeping_session`
- `declare_ledger_forfeit`
- `start_scorekeeping_correction`
- `finalize_scorekeeping_correction`

### Direct-write and append-only guards

- Anonymous game insertion fails.
- Non-admin score mutation fails or affects zero rows.
- Administrators cannot directly update an unlocked score, insert score-bearing games, insert player stats, or insert game history; those paths are RPC-only.
- Anonymous and non-admin bracket mutations fail.
- Administrators cannot bypass playoff RPCs with direct writes to bracket headers, seed snapshots, or match topology.
- Administrators cannot bypass team RPCs with direct writes to persistent identities or enrollment rows.
- Signed waiver fields cannot be mutated.
- Game edit history cannot be updated or deleted.
- A locked game's score and stage cannot be changed directly.
- An empty final-score correction reason fails.

### Payments authorization

- Anonymous and authenticated non-admin sessions cannot insert, update, or delete charges or payment entries.
- The administrator can complete create, update, and delete round trips for charges and payment entries.

### Administrator positive path

- All 15 admin RPCs succeed with valid disposable records.
- Score, lifecycle, intake conversion, roster assignment, and waiver verification effects persist.
- Initial score submission, locking, and a reasoned final-score correction create append-only history. The correction preserves the completed/final/locked state and records the exact reason, before/after snapshots, any SOFT override reason, and validation warnings.
- A four-team bracket is generated, one match is scheduled, another existing game is linked, and a final locked result advances.
- An existing identity enrolls into another sport with no roster or payment carryover, and a new identity plus first enrollment is created atomically.

### Hall of Fame gate

- Administrator can create and read an unpublished fixture entry.
- Anonymous and non-admin sessions cannot write the admin-only base table or see an unpublished entry through `public_hof_entries`.
- `public_hof_entries` rejects curator-only fields such as `created_by`, and both public roles can see the allowlisted row only after the administrator enables publication.
- Administrator update and delete round trips succeed on the base table.
- Cleanup restores the pre-run publication setting.

### Cleanup

- The namespace residue query returns zero seasons, leagues, team identities, profiles, waivers, and history rows.
- Counts for all 26 public tables match the pre-run values.
- `league_settings.hof_published`, `current_season`, and `current_waiver_version()` match their pre-run values.

## Failure handling

1. Do not delete or edit a failed evidence report.
2. Confirm the terminal ran cleanup and compare the before/after section.
3. If cleanup failed, stop. Use the printed run namespace with a reviewed, owner-approved privileged cleanup query; never issue a broad reset.
4. Diagnose the exact failed row. Make no more than three reasoned correction attempts for the same blocker.
5. Re-run with a new evidence filename after correction. Preserve both reports.
6. Never mark a failed authorization or cleanup assertion as informational.

## Re-run triggers

Run this matrix after any change to:

- RLS policies or Data API grants
- `admin_users`, `is_admin()`, or Auth-role resolution
- Any of the 15 admin RPCs
- Game lock/stage enforcement or edit history
- Profiles or the `public_profiles` allowlist
- Intake or waiver policies and triggers
- Charges or payment-entry visibility
- Hall of Fame publication policies
- Hosted migration application that changes exposed tables, functions, views, or privileges

Also run it before preview acceptance, before production deployment, and after any advisor remediation affecting authorization.
