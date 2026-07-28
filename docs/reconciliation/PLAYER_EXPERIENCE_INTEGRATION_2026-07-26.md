# Player-Experience Branch Integration (R2) — 2026-07-26

**Status:** OWNER-APPROVED, staged. **All four stages complete (R2-A through R2-D), plus repair stages R2-E, R2-F and R2-G.** The player-experience branch is fully integrated; nothing remains unmerged on it. Hosted state unchanged at Migration 27.

Records the staged reconciliation of `claude/sports-league-improvements-esu4eb`
into `main`, the migration renumbering and the evidence that it is safe, the
owner decisions taken during the stage, and the findings carried forward.

## Why this exists

The player-experience branch forked from `fa737b2` — the accepted Sequence 4
baseline — and was never merged. Meanwhile `main` advanced eight commits to
`cbfdcc6`, adding Sequence 5A, the Protocol v1.2 contract, and the named
hosted-migration approval token. Both lines added a local-only migration, and
six files were touched by both. Integrating in one merge would have bundled a
destructive schema conversion, a calendar API, derived statistics, profile
work, and venue administration into a single unreviewable delivery, so the
work was split into four bounded stages, each separately approved.

## Migration renumbering — and why it is safe

The venues migration was authored as "Migration 28" because, on its own branch,
it was the 28th. After integration it is the **29th**: Sequence 5A's
`20260723154411_sequence_5a_overtime_pairing_rules.sql` is the 28th.

**No file rename was required, and none was performed.** Each of the following
was directly verified rather than assumed:

1. **Filename order already sequences them correctly.** `20260723154411`
   (Sequence 5A) sorts before `20260726120000` (venues). Supabase applies
   migrations in filename order, so the combined stack needs no intervention.
2. **The two migrations do not touch the same objects.** Sequence 5A alters
   `scorekeeping_events` and the ledger RPCs. Migration 29 alters `games`, adds
   `venues` and `game_participation`, and replaces `schedule_playoff_match`.
   There is no overlap.
3. **Sequence 5A adds no column to `games`.** Its only new column is
   `scorekeeping_events.pairing_override_reason`. Migration 29 reissues the
   `games` column allowlist after dropping `date`/`time`/`location`, and that
   reissue therefore cannot drop a Sequence 5A column — there is none to drop.
4. **Sequence 5A adds no table and no net new RPC.** It drops and recreates
   `append_scorekeeping_event` and `replace_scorekeeping_event` with an
   additive defaulted parameter, and replaces `finalize_scorekeeping_session`
   and `finalize_scorekeeping_correction` at identical signatures. Table count
   is unchanged at 26; Migration 29 brings it to 28. RPC count is unchanged at
   25; Migration 29 brings it to 26.
5. **No migration before 29 references the dropped columns except the two it
   already handles** — `schedule_playoff_match` (Migration 15) and the
   Migration 23 grant. Both are rewritten by Migration 29 itself. Migrations
   24–28 never reference `games.date`, `games.time`, or `games.location`.
6. **The combined stack applies cleanly and passes.** A clean replay of all
   twenty-nine migrations followed by the full harness gives 338/338 plus the
   two-connection idempotency race.

**Live documentation and code comments were corrected to say 29.** Historical
commit messages, `supabase/evidence/*`, and `docs/audit/*` were deliberately
left alone: "Migration 28" was accurate within those snapshots, and rewriting
immutable evidence to match a later reality would destroy the record. Twenty
harness assertion labels were renamed `migration28 NN` → `migration29 NN`
because they are live test output, not historical evidence.

## Assertion count

Neither branch's count was the combined total: `main` measured 318 without the
cutover, the feature branch measured 314 without Sequence 5A. The combined
stack measures **338** (318 + 20 Migration-29 assertions).

`tests/pgtest/assertions.sql` required re-application, not a textual merge.
Git merges it **cleanly and silently into a broken file**: `main` added a
Sequence 5A fixture inserting a game with `date`, `time`, and `location` at a
location the feature branch never touched, so both sides survive the merge and
the harness then fails on columns that no longer exist against a table where
`starts_at` and `venue_id` are `NOT NULL`. This was confirmed by trial merge
before any integration work began, and independently confirmed by the owner.
The four affected fixtures were re-authored onto the new shape with four new
venue rows preserving their original distinct field names.

## Owner decisions taken during R2

1. **The nine-stage "player-experience program" is NOT adopted as the active
   roadmap.** It is recorded as a proposal. It was agreed conversationally in
   the session that produced the feature branch, but that session had not read
   `PROJECT_POLICY.md` and wrote the program into `CLAUDE.md` as governance,
   which was overreach. The repository continues to work one bounded,
   owner-approved stage at a time. The proposed order was: media/identity
   (Migration 30), captain accounts, RSVP/availability, Pass 4 Team/Profile and
   shareable stat card, deferred-debt sweep, then ledger pilot and deployment.
2. **Captain accounts plus optional tokenized player links** are recorded as an
   **approved direction, not a locked product decision**, under a distinct
   `CLAUDE.md` heading. The direction was explicitly approved, but it has no
   implementing code and it would amend the locked "Admin-only for Season 1"
   rule, so "Locked" would overstate it.
3. **Two decisions were ratified by approving R2-B**, because accepting the
   migration accepts them: `games.starts_at` as the single authoritative
   timestamp, and participation as permanently outside the score lifecycle.

## Defects found and fixed during R2-A

Both were surfaced by moving the full-statistics block from the Private tab to
the Public tab, and both were caught by the staged review gate before commit.

- **Career rate statistics were meaningless, not merely wrong.** An imported
  career baseline and the granular game rows are different domains, and the
  import contract does not require a baseline to carry every column. Seed `p1`
  draws 53 of 60 career hits from a baseline recording no kicks, publishing a
  career kick average of 6.000. A qualifier threshold does not fix this: career
  kicks is exactly 10 against a `kicks >= 10` minimum, so `meetsQualifier`
  returns true and the impossible figure renders anyway. Fixed by declining any
  non-count derived stat in the career column when a baseline contributed. The
  season column is entirely granular and keeps its rates.
- **`text-secondary` resolves to `colors.secondary.DEFAULT`**, a background
  slate, not the `--text-secondary` text token exposed as
  `text-muted-foreground`. It rendered new rank context near-black on dark. The
  game-log opponent already carried the same misuse and was previously
  admin-only; this stage made it public.

## Carried forward — not implemented here

| Item | Target stage |
|---|---|
| ~~Authorization matrix must cover four changed RPC signatures~~ | **CLOSED in R2-C.** All four are named in the runbook with what changed and which migration caused it, plus a note to confirm each probe still resolves after the push so a stale fixture is not misread as an authorization defect. |
| ~~Participation must be proven on a ledger-finalized game~~ | **CLOSED in R2-C.** `migration29 21/22` record participation against game `...950` — ledger-mode, finalized, already corrected — and prove score, periods, outcome, lock, status, `player_stats`, `game_edit_history` **and `scorekeeping_events`** are all byte-for-byte unchanged. The event count is the direct evidence that participation cannot become a second correction authority. |
| `/api/calendar` is unauthenticated and un-rate-limited; caching is not abuse protection, and `AGENTS.md` requires abuse protection on anonymous surfaces before public launch | **OPEN.** Integrated in R2-D and unreachable while undeployed. Binds before deployment. |
| Engine-level domain consistency: a derived stat should be unknowable when its inputs span domains, rather than the display layer knowing about baselines. Either teach `playerCareerStats` to report baseline contribution, or require baselines to carry every input their sport's ratios need | R2-B follow-up, unscheduled |
| `meetsQualifier` is exported, tested, and never called. It is a leaderboard eligibility control and belongs on the leaderboard surfaces | stage that touches `Leaderboards.js` |
| Standings `LAST 5` form chips logged VISUALLY INSUFFICIENT against Anchor B | Pass 4 Team/Profile batch |
| Migration 29 requires a venue before a game can be created, and the admin UI to create one arrives in R2-C | keep R2-B and R2-C close together |

## Hosted state

**Unchanged. Hosted remains at Migration 27.** No hosted mutation, publication,
deployment, or matrix run occurred during R2. The intended future order, which
this record does **not** authorize: verify combined locally → publish and
accept Migration 28 → fresh off-platform logical export → publish Migration 29
→ run the expanded 28-table / 26-RPC matrix. Each step needs its own owner
approval, and a hosted migration push additionally requires the literal token
`approved: hosted push of migrations X–Y`.

The ordered procedure now lives in [`../../supabase/HOSTED_AUTH_RUNBOOK.md`](../../supabase/HOSTED_AUTH_RUNBOOK.md).
Three facts about it are worth restating here, because each was established by
review rather than by design:

1. **`supabase db push` cannot publish a subset.** `--include-all` broadens the
   set; nothing narrows it. Isolation comes from what the checked-out
   migrations directory contains, which is why `main` stays put until
   Migration 28 is published and accepted — its directory is already exactly
   that push.
2. **The interval afterwards is a deliberate incompatibility window**, not an
   accident to be minimised away. Once `main` advances it reads
   `starts_at`/`venue_id` against a database still at Migration 28. It is safe
   only because nothing deploys from it. Advancing `main` is gated on first
   confirming no automatic deployment can fire; if that cannot be ruled out,
   the sequence stops before `main` moves. Eliminating the window entirely
   would mean restructuring Migration 29 as expand/deploy/contract rather than
   relying on timing — a larger change, not currently proposed.
3. **The acceptance runs happen from a configured worktree at the
   reconciliation head**, not from `main`, because `main` does not carry the
   two-surface harness while Migration 28 is being accepted. The harness reads
   the hosted database and `.env.local`, never the migrations directory, so
   this is correct rather than a workaround.

## Stage record

| Stage | Content | Verified at |
|---|---|---|
| R2-A | Derived-stat engine, participation-aware selectors, standings form/streak/shared tie ranks, full public profile. Two defects found and fixed before commit. | 159/159 frontend, build |
| R2-B | Migration 29 (venues, `starts_at`, participation) and the full frontend cutover. Harness re-authored rather than merged. | 338/338 + race, 160/160 frontend, 9/9 API, build |
| R2-C | Admin venue management, expanded 28-table/26-RPC matrix, franchise history, remembered view filters. Both carried-forward coverage gaps closed. | 340/340 + race, 178/178 frontend, build |
| R2-D | iCalendar export, VALARM reminders, subscribable `/api/calendar` feed. | 340/340 + race, 208/208 frontend, 21/21 API, build |

Final head verified at 340/340 database assertions plus the two-connection
idempotency race, 208/208 frontend tests across 38 suites, 21/21 API tests, a
passing production build, and a fail-closed prebuild validator that still
blocks without real environment values.

## Repair stage R2-E — the two-surface matrix

Found by independent review before the merge to `main`, and confirmed
directly: **the documented Migration-28 acceptance pass could not run.**

The runbook described three passes with a separate acceptance boundary per
migration. The executable harness could not follow it. After publishing only
Migration 28, hosted has no `venues`, no `game_participation`, no `starts_at`
and no `venue_id` — but the harness unconditionally seeded a venue, inserted a
game on the `starts_at` shape, counted both new tables in the baseline, deleted
them in cleanup, and probed `schedule_playoff_match` with its post-29 signature.

The failure mode was worse than failing checks. Seeding and baseline capture run
**before** the first authorization check, so a Migration 28 pass would have died
at setup and produced **no evidence at all** — not a partial pass with known
gaps. The separate acceptance boundaries existed in prose only.

A fourth signature problem sat inside the repair: `schedule_playoff_match`
changes shape at Migration 29, so the `m28` mode has to probe the *old*
arguments. Probing the new ones returns "function not found", which reads as an
authorization anomaly rather than a stale fixture.

**The repair.** `tests/hosted-auth/surface_contract.js` is a single shared
object read by both the privileged Node runner and the browser matrix, so the
two halves cannot disagree about which surface is under test:

| | `m28` | `m29` |
|---|---|---|
| Tables | 26 | 28 |
| Admin RPCs | 25 | 26 |
| `games` fixture | `date` / `time` / `location` | `starts_at` / `venue_id` |
| Venue seeded | no | yes |
| `schedule_playoff_match` probe | `p_date`, `p_time`, `p_location` | `p_starts_at`, `p_venue_id` |
| Venue / participation checks | skipped | run |

`--surface` flows from `run_matrix.sh` through the runner into the served
config and out to the browser, and an unknown value fails closed rather than
defaulting.

**Contract tests are the load-bearing part** — 18 new, 28 total in the harness
suite. Two modes are two code paths that can drift, and the drift is silent: a
mode that quietly does less work still reports `PASS`. The tests pin both
censuses by exact count, assert `m28` is a strict prefix of `m29` so nothing is
dropped between them, and verify the harness actually consumes the contract
rather than merely agreeing with it on paper. Verified non-vacuous by mutation:
un-gating the venue block fails the suite.

Updating the RPC census also broke an existing contract test, which is the
system working — `ledger_matrix_contract.test.mjs` asserted the ten runtime RPC
names appear as literals in `matrix.js`, and they now live in the shared
contract. It was repointed at the contract object rather than weakened, and now
additionally asserts all ten are present at *every* surface.

**Label sweep.** The R2-B renumbering ran before R2-C and R2-D existed and was
never re-run, so six live sites still called the venues surface Migration 28:
`VenuesTab.js` and its test, `calendar.js`, `GameDetail.js`, and five `check()`
category strings in `matrix.js`. The category strings mattered most — they
become row labels in durable evidence. A contract test now fails if any live
harness source calls the venues surface Migration 28. The sweep must run at the
end of any stage that adds files, not once per program.

Verified at 340/340 database assertions plus the two-connection race, 208/208
frontend tests across 38 suites, 21/21 API tests, 28/28 harness contract tests,
and a passing production build. No hosted action; hosted remains at Migration
27.

## Repair stage R2-F — the harness could not execute

R2-E made the two-migration procedure *expressible*. It did not make it
*runnable*. Independent review executed the browser script instead of reading
it and found four defects, all confirmed directly here.

**P0 — the browser matrix crashed at load.** R2-E replaced a literal
`ADMIN_RPC_NAMES` array with `surface.rpcs` at module scope, but `surface` is
resolved from the fetched config inside `runMatrix()`. The script threw
`TypeError: Cannot read properties of undefined (reading 'rpcs')` the instant
the browser loaded it — killing the whole matrix before any check. All 28
R2-E contract tests passed because **every one of them inspected source text
rather than executing the script.** That is the real lesson of this stage: a
regex over source can prove a string is present and prove nothing about whether
the program runs. Now a function, resolved lazily.

**P0 — the administrator success path still used the pre-29 schema.** R2-C
claimed `a64e74d` "fixed the stale `p_date`/`p_time`/`p_location` fixture." It
fixed exactly one call site — the *denial* probe. The success path still called
`schedule_playoff_match` with the retired signature and inserted a linked
playoff game using the dropped `date`/`time`/`location` columns. Both would
have failed against a hosted Migration 29. This was pre-existing on the feature
branch and survived the R2-C review, which is a miss in that review, not only
in the branch.

**P1 — two denial checks could pass for the wrong reason.** They submitted
dropped legacy columns and used `requireDenied`, which accepts *any* error. A
`column does not exist` response would have been banked as proof that RLS
worked — a green check for a boundary never exercised. `requireAuthorizationDenied`
now rejects schema-shaped failures (`42703`, `PGRST204`, missing column/function
text) so a stale fixture surfaces as a harness bug instead of a false pass.

**P1 — generated evidence did not say which surface it covered.** The runbook
claimed the evidence records the tested surface; it recorded project, namespace
and counts only. The report header now carries the surface key, its label, the
migration number, and the expected table/RPC census.

**Every games payload now flows through the shared contract** —
`gameScheduleFields` and `schedulePlayoffMatchArgs` — so denial probes and
success paths cannot drift apart one call site at a time. A contract test fails
if any hard-coded `date:`/`time:`/`location:`/`p_date:` reappears.

**`matrix_load.test.mjs` executes the script** in a `vm` context against a DOM
stub shaped like `matrix.html`, then exercises both surfaces' censuses and
payload builders. Verified non-vacuous by mutation: reintroducing the P0 fails
all 10 of its tests, where the regex suite caught it only incidentally.

Harness contract tests: 10 before R2-E → 28 after R2-E → **41 after R2-F**.

Verified at 340/340 database assertions plus the two-connection race, 208/208
frontend tests, 21/21 API tests, 41/41 harness contract tests, a passing
production build, and Protocol v1.2 validation. No hosted action; hosted
remains at Migration 27.

## Repair stage R2-G — denial helpers became allowlists

R2-F introduced `requireAuthorizationDenied` to stop a schema error being
banked as proof that RLS held. Independent review executed it with a
check-constraint failure and it returned **"Denied at the authorization
boundary."** The helper was a **blacklist**: it rejected the specific schema
errors R2-F had in mind and accepted everything else. Reproduced here for
`23514`, `23503`, `23505` and `23502` — all four false-passed.

That is the same defect as R2-F, one level up. R2-F fixed the instance and
missed the shape: a blacklist rots, because every error class nobody thought of
defaults to "authorization succeeded".

**Every denial helper now positively names the property it proves.**

| Helper | Passes only on | Used for |
|---|---|---|
| `requireAuthorizationDenied` | `42501`, `PGRST301/302`, or explicit permission-denied / row-level-security text | any row claiming an authorization boundary |
| `requireColumnAbsent` | `42703` / `PGRST204` / "does not exist" | the `public_profiles` and `public_hof_entries` PII allowlists, where a *schema* denial is the correct proof and an authorization error would prove the wrong thing |
| `requireGuardRejection` | a caller-supplied message pattern | database guards with their own text — the game lock, the required-correction-reason check |
| `requireNoWrite` | zero rows, **or** an authorization-shaped error | RLS-filtered writes |

`requireDenied` — which accepted any error at all — was **deleted, not
deprecated**, and a contract test fails if the identifier reappears. 35
authorization-labeled call sites were swept onto the strict helper; the three
`locked-game guards` checks now assert the guard's own message rather than
merely that something failed.

Negative tests cover `23502`, `23503`, `23505`, `23514`, `22P02`, `42703`,
`42883` and `PGRST204`, alongside positive tests that genuine `42501` and
row-level-security failures are still accepted and that a silent success still
fails.

Harness contract tests: 10 → 28 (R2-E) → 41 (R2-F) → **46**.

Verified at 340/340 database assertions plus the two-connection race, 208/208
frontend tests, 21/21 API tests, 46/46 harness contract tests, and a passing
production build. No hosted action; hosted remains at Migration 27.

### Standing note for later stages

Three consecutive review rounds found defects in this harness, and each was
found by *executing* something that had only been reasoned about. The pattern
worth carrying forward is not "check the matrix again" but: **a test that reads
source text proves a string is present and nothing about behaviour**, and **a
denial assertion must state which failure it accepts, never which it rejects.**

## Correction to an earlier proposal in this record

An intermediate fast-forward of `main` to the R2-A tip was proposed as a way to
isolate the Migration 28 push. It was unnecessary: `origin/main` already
contained Sequence 5A and already read the legacy game shape, so the R2-A tip
offered no additional isolation — only three unrelated stats/UI commits. The
proposal was made with the migration counts already in hand and the wrong
conclusion drawn from them. `main` stays where it is; the isolation was always
already there.
