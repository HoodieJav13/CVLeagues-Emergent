# Hosted authorization acceptance runbook

This runbook is authoritative for the repeatable hosted authorization procedure. **The current target surface is Migration 28: 28 tables and 26 privileged RPCs.** The last ACCEPTED baseline is Sequence 4 at 27 migrations, covering 26 tables and 25 privileged RPCs, including the four private ledger relations and ten authenticated-only runtime RPCs, with real anonymous, authenticated non-admin, password-only administrator, and AAL2 administrator sessions plus privileged catalog checks.

The harness creates a uniquely namespaced disposable aggregate fixture through the linked Supabase CLI, exercises authorization through browser-held user sessions, removes the fixture through the same privileged CLI channel, and compares every public-table row count and relevant singleton setting with the pre-run baseline. It deliberately does not seed ledger evidence: those rows are append-only even to the migration owner. Both accepted Sequence 4 runs include 248 browser/API checks and eight exact catalog checks, including runtime-RPC ACL coverage plus anonymous/non-admin/AAL1 denial for all ten new endpoints. A populated positive read/write proof remains a separate durable-pilot gate.

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

The current accepted behavioral baseline is Sequence 4: 27 migrations, 26 tables, and 25 administrator RPCs.

**Migration 28 changes the target surface and has not yet been accepted.** It adds `venues` and `game_participation` (28 tables), adds `set_game_participation` (26 RPCs), and REPLACES `schedule_playoff_match`'s signature — `(uuid, date, text, text)` becomes `(uuid, timestamptz, uuid)`. It also drops `games.date`, `games.time`, and `games.location`, so it is not silently reversible once applied.

Because it drops columns, run this matrix in two passes:

1. **Before the push**, with 27 hosted migrations: preflight only, to confirm history alignment and a clean dry run. Do not expect the new checks to pass — the tables do not exist yet.
2. **Immediately after the push**, with 28 hosted migrations: the full matrix, including the Migration 28 section below. This is the run that becomes the new accepted evidence.

Preflight must show the expected hosted migrations aligned and an up-to-date dry run. Do not present the earlier 154-case Migration-23 or 225-case Migration-24 run as current-surface acceptance.

Latest accepted behavioral evidence: [`evidence/hosted-auth-matrix-2026-07-24.md`](evidence/hosted-auth-matrix-2026-07-24.md) records the later run at 256/256 with fixture cleanup and exact restoration both passing. Its execution timestamps use UTC (`2026-07-25`), while the immutable filename uses the America/Denver local run date (`2026-07-24`). The independent [`2026-07-22 Migration-27 evidence`](evidence/hosted-auth-matrix-2026-07-22-m27.md) records the same accepted surface from the earlier run. [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md) records the preceding structural gate. The immutable Migration-24 and Migration-23 evidence remain prior checkpoints.

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

Anonymous execution is denied for all 25 client-facing admin RPCs. A real authenticated non-admin must reach and fail at `assert_admin()` for each. The first 15 are:

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

The same denial loop also covers the ten Sequence 4 RPCs:

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

Migration 28 adds one more to the same denial loop:

- `set_game_participation`

### Migration 28 surface — venues and participation

Both tables are publicly readable by design: where a game is played and who played in it are box-score facts, the same class of information as a score.

- Anonymous and non-admin sessions can query `venues` and `game_participation`.
- Anonymous and non-admin insert and update are denied on both.
- Anonymous and non-admin `set_game_participation` fails at `assert_admin()`.
- **No client role can delete a venue**, administrator included. Historical games reference venues, so the lifecycle action is a `status` change to `retired`, never a delete. The migration grants no DELETE to any client role.
- The `games` column allowlist still holds over the replacement columns: `authenticated` may write `starts_at` and `venue_id` but not `home_score`, `away_score`, or `periods`. The local harness pins the exact allowlist for both INSERT and UPDATE; confirm the hosted grant matches.

Participation is deliberately OUTSIDE the score lifecycle. It is not governed by the game lock and never interacts with the aggregate or ledger correction authority, so a locked game must still accept a participation write while its published result stays unchanged.

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

- All 15 pre-Sequence-4 admin RPCs succeed with valid disposable records. The
  ten ledger-runtime RPCs require a durable ledger game/session and receive
  their positive hosted execution proof in the Sequence 5 pilot.
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
- Counts for all 28 public tables match the pre-run values, including `venues` and `game_participation`.
- The fixture venue is removed only after the fixture games that reference it.
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
- Any of the 26 admin RPCs, or any change to an RPC's signature
- `venues` or `game_participation` policies, grants, or the `set_game_participation` guard
- Game lock/stage enforcement or edit history
- Profiles or the `public_profiles` allowlist
- Intake or waiver policies and triggers
- Charges or payment-entry visibility
- Hall of Fame publication policies
- Hosted migration application that changes exposed tables, functions, views, or privileges

Also run it before preview acceptance, before production deployment, and after any advisor remediation affecting authorization.
