# Hosted authorization acceptance runbook

This runbook is authoritative for the repeatable hosted authorization procedure. **The current target surface is Migrations 28 and 29 combined: 28 tables and 26 privileged RPCs.** The last ACCEPTED baseline is Sequence 4 at 27 migrations, covering 26 tables and 25 privileged RPCs, including the four private ledger relations and ten authenticated-only runtime RPCs, with real anonymous, authenticated non-admin, password-only administrator, and AAL2 administrator sessions plus privileged catalog checks.

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

**Two unhosted migrations change the target surface, and neither has been accepted.** They publish as two separate approved actions with two separate acceptance boundaries; the ordered procedure is below.

**Migration 28 (Sequence 5A)** adds no table and no net new RPC, so the counts are unchanged by it. It does change three RPC signatures: `append_scorekeeping_event` and `replace_scorekeeping_event` are dropped and recreated with an additive `p_pairing_override_reason text default null`, and `finalize_scorekeeping_session` is replaced at an identical signature. The added parameter is defaulted, so existing named-argument probes still resolve, and the old overloads are dropped rather than left alongside — there is no ambiguity for PostgREST to resolve.

**Migration 29 (venues / `starts_at` / participation)** adds `venues` and `game_participation` (28 tables), adds `set_game_participation` (26 RPCs), and REPLACES `schedule_playoff_match`'s signature — `(uuid, date, text, text)` becomes `(uuid, timestamptz, uuid)`. It also drops `games.date`, `games.time`, and `games.location`, so it is not silently reversible once applied.

**Four RPC signatures have therefore changed since the accepted 256/256 baseline, not one.** This runbook's own re-run trigger fires on any signature change, so all four are in scope:

| RPC | Change | From |
|---|---|---|
| `append_scorekeeping_event` | drop + recreate, additive defaulted parameter | Migration 28 |
| `replace_scorekeeping_event` | drop + recreate, additive defaulted parameter | Migration 28 |
| `finalize_scorekeeping_session` | replaced at identical signature | Migration 28 |
| `schedule_playoff_match` | signature replaced, old overload dropped | Migration 29 |

The three Migration-28 endpoints are already in the denial loop, so their coverage carries over — but confirm each probe still resolves to a real function after the push rather than failing as "function not found," which would read as an authorization defect when it is a stale fixture.

## Publishing Migrations 28 and 29 — the ordered procedure

**The CLI cannot publish a subset.** `supabase db push` applies every pending
migration; `--include-all` broadens that set, it does not narrow it. There is
no "push only this one" flag. Isolation therefore comes from **what the
checked-out migrations directory contains**, not from a command-line option.

That single fact drives the whole sequence below. `main` stays where it is
until Migration 28 is published *and accepted*, because `origin/main` already
contains Sequence 5A and nothing else beyond it — its migrations directory is
already exactly the Migration 28 push. Advancing `main` first would put the
venues migration in that directory and a plain `db push` would publish both,
bundling the irreversible column drop with the overtime migration.

### Step by step

1. **Finish independent review of the reconciliation branch head.** No hosted
   action before it lands.
2. **Leave `main` where it is.** Its migrations directory is already the
   Migration 28 push, and its frontend still reads the legacy game shape, so it
   matches the database it is about to be pointed at.
3. **From `main`: fresh off-platform logical export, preflight, dry run.**

   ```sh
   git branch --show-current      # must be main
   git log -1 --oneline
   supabase --version
   supabase migration list
   supabase db push --dry-run
   ```

   **The dry run must name `20260723154411_sequence_5a_overtime_pairing_rules.sql`
   and nothing else.** Match the filename, not the number — the number is a
   position that has already shifted once during this program. If a second
   migration appears, stop: the wrong revision is checked out.
4. **Exact approval token, then publish Migration 28**, then structural
   readback: `supabase migration list`, object verification, Security and
   Performance advisors.
5. **Separate approval for the fixture write**, then run the matrix with
   `--surface m28` **from a dedicated worktree at the reconciliation branch
   head** — see "Running the matrix from a worktree" below. `main` does not
   carry the two-surface harness at this point, so running from `main` would
   use the old hard-wired-to-`m29` runner and die during fixture seeding.
6. **Verify and record.** All three lines must read `PASS`. Commit the dated
   `m28` evidence file on the reconciliation branch.
7. **Fresh off-platform logical export.** Migration 29 is the irreversible one;
   this is the backup that matters.
8. **Confirm that advancing `main` cannot trigger an automatic deployment.** A
   Vercel project exists for this repository. Verify that Git auto-deployment
   is disabled, or that no production deployment can be produced from a push to
   `main`. **If automatic deployment cannot be ruled out, STOP here.** Do not
   advance `main`.
9. **Fast-forward `main` to the current reconciliation branch head** — the head
   that now carries the Migration 28 evidence, not whichever SHA was current
   when this procedure was written.
10. **This opens a deliberate incompatibility window.** `main` now reads
    `starts_at` and `venue_id`; hosted is still at Migration 28 and has
    neither. This interval is transitional by design and is only safe because
    nothing is deployed from it. **No deployment, no preview build, and no
    unrelated work while it is open.** Close it by completing step 12.
11. **Dry run again.** It must now name
    `20260726120000_venues_game_start_times_participation.sql` and nothing else.
12. **New exact approval token, then publish Migration 29**, then structural
    readback.
13. **Separate approval**, then run the matrix with `--surface m29` and record
    its acceptance as an independent dated evidence file.

### Each pass is its own acceptance boundary

Structural readback, advisors, and a full matrix run belong to **each**
publication, recorded as separate dated evidence. A Migration 28 result is not
evidence for Migration 29 and must never be carried forward as one.

### Running the matrix from a worktree

Steps 5 and 13 run the harness from the reconciliation branch head while `main`
may be elsewhere. A dedicated worktree keeps the two from interfering:

```sh
git worktree add ../cvf-matrix-run <reconciliation-branch-head>
```

That worktree needs three things that are deliberately **not** in Git:

- `frontend/.env.local` — the hosted URL, anonymous/publishable key, and
  Turnstile site key. Copy it in; never commit it, never print its values.
- Supabase CLI link state for `orlhqewzprjadyrdrqxw`.
- `frontend/node_modules`, so the runner can serve the pinned local
  `@supabase/supabase-js` browser bundle.

The harness reads the hosted database and `.env.local`. It does **not** read
the migrations directory, which is why running it from a checkout other than
`main` is correct rather than a workaround.

### Surface modes

**Each pass runs an explicit surface mode.** The harness cannot infer which
surface is hosted, and guessing wrong fails during fixture seeding rather than
at a check, which produces no evidence at all:

```sh
# after publishing Migration 28
CVF_HOSTED_AUTH_NO_OPEN=1 ./tests/hosted-auth/run_matrix.sh \
  supabase/evidence/hosted-auth-matrix-YYYY-MM-DD-m28.md --surface m28

# after publishing Migration 29
CVF_HOSTED_AUTH_NO_OPEN=1 ./tests/hosted-auth/run_matrix.sh \
  supabase/evidence/hosted-auth-matrix-YYYY-MM-DD-m29.md --surface m29
```

| | `m28` | `m29` |
|---|---|---|
| Tables | 26 | 28 |
| Admin RPCs | 25 | 26 |
| `games` fixture | `date` / `time` / `location` | `starts_at` / `venue_id` |
| Venue seeded | no | yes |
| `schedule_playoff_match` probe | `p_date`, `p_time`, `p_location` | `p_starts_at`, `p_venue_id` |
| Venue / participation checks | skipped | run |

`m29` is the default; the flag is mandatory only for the Migration 28 pass, but
state it explicitly in both so the evidence file records which surface it
covers. The generated report header carries the surface key, label, migration
number, and expected census. The two modes and their censuses are pinned by
`tests/hosted-auth/surface_contract.test.mjs`, and `matrix_load.test.mjs`
executes the browser script rather than reading it, so a mode that quietly does
less work fails the contract tests instead of reporting a hollow `PASS`.

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

Migration 29 adds one more to the same denial loop:

- `set_game_participation`

### Migration 29 surface — venues and participation

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
