# Hosted authorization acceptance runbook

This runbook is authoritative for the repeatable hosted authorization procedure. **Migrations 28 and 29 are published and independently authorization-accepted.** The current ACCEPTED baseline is Migration 29 at 29 migrations, covering 28 tables and 26 privileged RPCs, including the four private ledger relations and ten authenticated-only runtime RPCs, with real anonymous, authenticated non-admin, password-only administrator, and AAL2 administrator sessions plus privileged catalog checks.

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

The current accepted behavioral baseline is Migration 29: 29 migrations, 28 tables, and 26 administrator RPCs.

**Migrations 28 and 29 are complete at their independent acceptance boundaries.** The ordered procedure below preserves both records.

**Migration 28 (Sequence 5A)** adds no table and no net new RPC, so the counts are unchanged by it. It does change three RPC signatures: `append_scorekeeping_event` and `replace_scorekeeping_event` are dropped and recreated with an additive `p_pairing_override_reason text default null`, and `finalize_scorekeeping_session` is replaced at an identical signature. The added parameter is defaulted, so existing named-argument probes still resolve, and the old overloads are dropped rather than left alongside — there is no ambiguity for PostgREST to resolve.

**Migration 29 (venues / `starts_at` / participation)** adds `venues` and `game_participation` (28 tables), adds `set_game_participation` (26 RPCs), and REPLACES `schedule_playoff_match`'s signature — `(uuid, date, text, text)` becomes `(uuid, timestamptz, uuid)`. It also drops `games.date`, `games.time`, and `games.location`, so it is not silently reversible once applied.

**Migration 30 (practice mode)** adds no table and replaces no client-facing
RPC signature — every accepted probe still resolves unchanged. It adds seven
new admin RPCs (33 at the `m30` surface), makes `game_id` nullable across the
four private ledger tables with practice-shape constraints, backfills eight
plain foreign keys and two NULL-scope partial unique indexes, and re-emits
five trigger functions with practice branches. Because it REPLACES live
trigger functions that govern official scoring, its acceptance emphasis is
structural readback rather than signature drift.

**RPC-surface changes beyond the accepted Migration 28 baseline, by surface.**
Migration 28's three function replacements are already inside the accepted
256/256 surface; Migration 29's `schedule_playoff_match` replacement was the
`m29` re-run trigger; Migration 30 replaces nothing but adds seven endpoints
that only an `m30` run covers:

| RPC | Change | From | First covered by |
|---|---|---|---|
| `schedule_playoff_match` | signature replaced, old overload dropped | Migration 29 | accepted `m29` 270/270 |
| seven `*_practice_*` RPCs | new endpoints (26 → 33 admin RPCs) | Migration 30 | pending `--surface m30` run |

The three Migration-28 endpoints remain in the denial loop, and their coverage carries forward from the accepted `m28` run. A Migration 29 result is not coverage for the seven practice endpoints — only an `m30` pass probes them. The typed denial model rejects "function not found" as authorization evidence, so stale signatures fail closed.

## Publishing Migrations 28 and 29 — ordered checkpoint record

**The CLI cannot publish a subset.** `supabase db push` applies every pending
migration; `--include-all` broadens that set, it does not narrow it. There is
no "push only this one" flag. Isolation therefore comes from **what the
checked-out migrations directory contains**, not from a command-line option.

That single fact drove the isolated Migration 28 publication and still governs
Migration 29. Migration 28 was published from `main` and accepted before the
reconciliation head was allowed onto `main`, preventing the irreversible venues
migration from riding with it. The remaining steps begin with the post-Migration-28
checkpoint below.

### Step by step

1. **COMPLETED — independent review of the reconciliation branch head.**
2. **COMPLETED — `main` remained at the Migration 28-only surface.**
3. **COMPLETED — fresh off-platform logical export, preflight, and filename-exact dry run from `main`.**

   ```sh
   git fetch origin --prune
   git branch --show-current      # must be main
   git status --short             # must print nothing
   local_main="$(git rev-parse HEAD)"
   remote_main="$(git rev-parse origin/main)"
   test "$local_main" = "$remote_main"
   git log -1 --oneline --decorate
   supabase --version
   supabase migration list
   supabase db push --dry-run
   ```

   The fetch must succeed, the worktree must be clean, and the two resolved
   SHAs must be byte-for-byte identical. **Stop if local `main` is stale,
   ahead, or divergent from `origin/main`.** The expected migration filename
   alone is insufficient: a different commit can carry a same-named migration
   with different contents.

   **The dry run must name `20260723154411_sequence_5a_overtime_pairing_rules.sql`
   and nothing else.** Match the filename, not the number — the number is a
   position that has already shifted once during this program. If a second
   migration appears, stop: the wrong revision is checked out.
4. **COMPLETED — exact approval token, Migration 28 publication, and structural readback.**
5. **COMPLETED — separately approved fixture write and `--surface m28` matrix from the reviewed reconciliation worktree.**
6. **COMPLETED — 248/248 browser/API checks plus 8/8 catalog checks; cleanup and baseline restoration both PASS.** Preserve and commit [`evidence/hosted-auth-matrix-2026-07-28-m28.md`](evidence/hosted-auth-matrix-2026-07-28-m28.md).
7. **COMPLETED — fresh off-platform logical export.** Migration 29 is the irreversible one;
   this is the backup that matters.
8. **COMPLETED — confirmed that advancing `main` could not trigger an automatic deployment.** A
   Vercel project exists for this repository. Verify that Git auto-deployment
   is disabled, or that no production deployment can be produced from a push to
   `main`. **If automatic deployment cannot be ruled out, STOP here.** Do not
   advance `main`.
9. **COMPLETED — fast-forwarded `main` to the reconciliation branch head** — the head
   that now carries the Migration 28 evidence, not whichever SHA was current
   when this procedure was written.
10. **COMPLETED — deliberate incompatibility window opened and closed without deployment.** `main` now reads
    `starts_at` and `venue_id`; hosted is still at Migration 28 and has
    neither. This interval is transitional by design and is only safe because
    nothing is deployed from it. **No deployment, no preview build, and no
    unrelated work while it is open.** Close it by completing step 12.
11. **COMPLETED — filename-exact dry run.** It named
    `20260726120000_venues_game_start_times_participation.sql` and nothing else.
12. **COMPLETED — new exact approval token, Migration 29 publication, and structural
    readback.**
13. **COMPLETED — separate approval and `--surface m29` acceptance.** The
    filename-new rerun passed 262/262 browser/API checks plus 8/8 catalog
    checks, with cleanup and baseline restoration both PASS. See
    [`evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md`](evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md).

### Migration 30 publication — ordered sequence (OPEN; no step is started)

Practice mode merged to `main` on 2026-08-03 after independent review, so
unlike the Migration 29 sequence there is no branch left to advance: **the
incompatibility window is already open.** `main` carries the practice UI, the
seven practice RPCs' harness surface, and Migration 30 itself; hosted has none
of them. This window is milder than Migration 29's — no existing column moved,
so public pages are unaffected and only an admin invoking hosted practice mode
would hit a missing function — but the same rule binds: **no production
deployment while `main` and hosted disagree.** Verified at merge time that this
repository has no CI workflow and no push hook, so a `git push` cannot reach
the hosted backend; only the manual CLI steps below can.

14. **OPEN — fresh off-platform logical export.** Migration 30 rewrites five
    live trigger functions with `create or replace`; this is the backup that
    matters if a restore is ever needed mid-sequence.
15. **OPEN — deployment-safety confirmation.** Re-verify that no production
    deployment can be produced from `main` — the Vercel project's Git
    auto-deployment must still be disabled. **If automatic deployment cannot
    be ruled out, STOP here.**
16. **OPEN — filename-exact dry run from clean, pushed `main`.** The step-3
    preflight block applies verbatim (fetch, clean tree, local `main`
    byte-identical to `origin/main`). **The dry run must name
    `20260729182047_practice_mode_sessions.sql` and nothing else.** Match the
    filename, not the count or position. If any other filename appears, stop:
    the wrong revision is checked out.
17. **OPEN — new exact approval token, Migration 30 publication, and
    structural readback.** The token names this migration alone
    (`approved: hosted push of migrations 30-30`); no earlier token, including
    Migration 29's, carries forward. Grants and counts alone do not verify
    this migration — its center of gravity is structural. Readback confirms
    each of:
    - hosted ledger at thirty, latest version `20260729182047`; no new table;
    - the seven practice functions present with `authenticated`-only execute
      (no `anon`, no `service_role`);
    - `game_id` now **nullable** on all four private ledger tables;
    - the four session-shape constraints at their **exact definitions**
      (compare `pg_get_constraintdef`, not existence — a hosted constraint
      with the same name but a laxer body is precisely the drift this step
      exists to catch):
      `scorekeeping_sessions_session_kind_check` (kinds now include
      `practice`), `scorekeeping_sessions_stage_check` (stages now include
      `practice`), `scorekeeping_sessions_practice_game_check` (practice is
      exactly the NULL-game kind, both directions), and
      `scorekeeping_sessions_kind_shape_check` (the kind/status/base/reason
      arms, including the practice-correction arm) — and the auto-named
      `scorekeeping_sessions_check1` it replaced must be **gone**;
    - all eight plain replacement foreign keys present:
      `scorekeeping_sessions_base_fkey`,
      `scorekeeping_participants_session_fkey`, three on
      `scorekeeping_events` (session, voids, replaces), and three on
      `scorekeeping_event_attributions` (session, event, participant) —
      these are what stand in for the composite `(id, game_id)` FKs that
      stop enforcing at NULL;
    - the two partial unique indexes in the NULL-game scope
      (`scorekeeping_events_practice_sequence_idx`,
      `scorekeeping_events_practice_idempotency_idx`);
    - the five re-emitted trigger functions
      (`cvf_guard_scorekeeping_session`,
      `cvf_prepare_scorekeeping_participant`,
      `cvf_prepare_scorekeeping_event`,
      `cvf_prepare_scorekeeping_attribution`,
      `cvf_validate_correction_event_target`) matching the repository
      definitions — compare `pg_get_functiondef` output against the local
      harness database, not by eye; these govern OFFICIAL scoring, and a
      hosted/local divergence here is a stop condition;
    - RLS still enabled on all four private tables with the admin-only
      policies unchanged, and both advisors clean.
18. **OPEN — separate approval and `--surface m30` acceptance.** A distinct,
    separately approved fixture-writing matrix run — Migration 29's 270/270
    is not evidence for this surface and must never be presented as such.
    Record the dated evidence file with its observed ledger count and exact
    baseline restoration, then promote `DEFAULT_SURFACE` to `m30` in the same
    change that commits the accepted evidence.

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

# after publishing Migration 30
CVF_HOSTED_AUTH_NO_OPEN=1 ./tests/hosted-auth/run_matrix.sh \
  supabase/evidence/hosted-auth-matrix-YYYY-MM-DD-m30.md --surface m30
```

| | `m28` | `m29` | `m30` |
|---|---|---|---|
| Tables | 26 | 28 | 28 |
| Admin RPCs | 25 | 26 | 33 |
| `games` fixture | `date` / `time` / `location` | `starts_at` / `venue_id` | `starts_at` / `venue_id` |
| Venue seeded | no | yes | yes |
| `schedule_playoff_match` probe | `p_date`, `p_time`, `p_location` | `p_starts_at`, `p_venue_id` | `p_starts_at`, `p_venue_id` |
| Venue / participation checks | skipped | run | run |
| Practice RPC denial probes | skipped | skipped | run (all seven) |

`m30` adds no table — the practice boundary is rows in the four existing
private tables, which is the structural claim of Option B, and the surface
contract asserts the `m30` table list is byte-identical to `m29`'s. Its seven
extra RPCs join every denial loop with real named-argument payloads, so each
probe resolves at PostgREST and fails at the admin guard rather than at
function lookup; a census RPC without a payload fails the contract tests.

**The flag is a claim, and the runner now checks it.** Before baseline capture
and before any fixture is created, the runner reads
`supabase_migrations.schema_migrations` and compares the real hosted ledger
against the first N local migrations for the declared surface. It aborts on any
mismatch — wrong count, missing earlier migration, wrong latest version, or an
unexpected later one — and the evidence file records the **observed** count and
latest version alongside the declared census.

This matters most for `m28`, which is census-identical to the Migration 27
baseline: 26 tables and 25 RPCs either way, because Migration 28 adds a private
column and changes three function signatures rather than adding relations. A
run against the wrong database would otherwise seed cleanly, pass, and file an
evidence artifact headed "Migration 28" that proved only the previous baseline.
On a mismatch the runner prints the observed versus expected ledger and exits
before touching anything.

`m29` remains the default until the `--surface m30` acceptance is recorded —
promoting the default is a consequence of accepted evidence, never a
precondition for producing it. The flag is therefore mandatory for the `m28`
and `m30` passes, but state it explicitly in every pass so the evidence file
records which surface it covers. The generated report header carries the
surface key, label, migration number, and expected census. The three modes and
their censuses are pinned by `tests/hosted-auth/surface_contract.test.mjs`,
`matrix_load.test.mjs` executes the browser script rather than reading it, and
a payload-coverage test rejects any census RPC lacking named arguments — so a
mode that quietly does less work fails the contract tests instead of reporting
a hollow `PASS`.

Preflight must show the expected hosted migrations aligned and an up-to-date dry run. Do not present the earlier 154-case Migration-23 or 225-case Migration-24 run as current-surface acceptance.

Latest accepted behavioral evidence: [`evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md`](evidence/hosted-auth-matrix-2026-07-28-m29-rerun-02.md) records Migration 29 at 270/270, observed hosted ledger count 29 with latest version `20260726120000`, zero fixture residue, and exact baseline restoration. Its SHA-256 is `81e29cceffb24ec7ab1653bf6cfcf8d3261f508eb8f334ab4a0fc9af97a94158`. The failed invalid-TOTP [`first attempt`](evidence/hosted-auth-matrix-2026-07-28-m29.md) and the cleanup-safe 269/270 [`harness-defect run`](evidence/hosted-auth-matrix-2026-07-28-m29-rerun-01.md) remain immutable evidence; commit `f561c9a` corrected only the role-specific expectation and passed 75/75 harness contract tests before the accepted rerun. Migration 28's independent [`256/256 evidence`](evidence/hosted-auth-matrix-2026-07-28-m28.md), the prior [`2026-07-25 execution`](evidence/hosted-auth-matrix-2026-07-24.md), and independent [`2026-07-22 Migration-27 evidence`](evidence/hosted-auth-matrix-2026-07-22-m27.md) remain prior checkpoints. [`evidence/sequence-4-hosted-push-2026-07-22.md`](evidence/sequence-4-hosted-push-2026-07-22.md) records the preceding structural gate.

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
- Anonymous `set_game_participation` fails at the function-execute privilege
  boundary; authenticated non-admin access reaches and fails at `assert_admin()`.
- **No client role can delete a venue**, administrator included. Historical games reference venues, so the lifecycle action is a `status` change to `retired`, never a delete. The migration grants no DELETE to any client role.
- The `games` column allowlist still holds over the replacement columns: `authenticated` may write `starts_at` and `venue_id` but not `home_score`, `away_score`, or `periods`. The local harness pins the exact allowlist for both INSERT and UPDATE; confirm the hosted grant matches.

Participation is deliberately OUTSIDE the score lifecycle. It is not governed by the game lock and never interacts with the aggregate or ledger correction authority, so a locked game must still accept a participation write while its published result stays unchanged.

### Migration 30 surface — practice mode (33 admin RPCs)

The `m30` census is 28 tables and 33 admin RPCs: `m29`'s 26 plus
`start_practice_session`, `append_practice_event`, `renew_practice_session`,
`resume_practice_session`, `cancel_practice_session`,
`finalize_practice_session`, and `start_practice_correction`. No relation is
added or exposed — practice rows live in the four private tables, which remain
admin-read-only with no client write grant and no `service_role` privilege.

- Anonymous execution of each practice RPC fails at the function-execute
  privilege boundary; authenticated non-admin and AAL1-admin execution reaches
  and fails at `assert_admin()`. All seven appear in every denial loop.
- Each probe carries the RPC's real named arguments with deliberately bogus
  values, so PostgREST resolves the function and the failure is the
  authorization guard — a "function not found" is typed as an anomaly, never
  as denial evidence.
- Practice evidence stays invisible to non-admin sessions: the `m30` pass
  re-runs the private-table denial checks unchanged, because Migration 30
  altered no policy and granted no new table privilege.
- The positive practice flow (start → events → finalize preview → correction)
  is local pgtest territory (382/382 plus the fork race), not matrix
  territory: the hosted matrix proves the authorization boundary, and writing
  practice fixtures into the hosted project belongs to the same separately
  approved fixture decision as every other hosted write.

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
- Any admin RPC in the current surface census (26 at `m29`; 33 once `m30` is
  hosted and accepted), or any change to an RPC's signature
- `venues` or `game_participation` policies, grants, or the `set_game_participation` guard
- Game lock/stage enforcement or edit history
- Profiles or the `public_profiles` allowlist
- Intake or waiver policies and triggers
- Charges or payment-entry visibility
- Hall of Fame publication policies
- Hosted migration application that changes exposed tables, functions, views, or privileges

Also run it before preview acceptance, before production deployment, and after any advisor remediation affecting authorization.
