# Season 1 rehearsal + focused UX audit — 2026-10-05

```text
Outcome:               blocked-environment (approved local scope done; E2E smoke not verifiable here — 13/28 unresolved)
Delivery depth:        committed (six local commits, owner-approved 2026-10-05; NOT pushed)
Protocol version:      v1.2  (DIAL: AUDIT + FIX, owner prompt 2026-10-05)
Test baseline:         5dae3ec98bae05087388b357b42c8ad5fcae52b4 (= origin/main, clean)
Integration target:    main @ 5dae3ec; claude/amazing-sagan-dpy3b0 is six local commits ahead
Head SHA:              recorded in the off-repo preservation manifest (a commit cannot contain its own ID)
Branch and upstream:   claude/amazing-sagan-dpy3b0 -> origin/claude/amazing-sagan-dpy3b0 (NOT PUSHED)
Authority used:        inspect/edit/test (owner prompt); local commit (owner approval 2026-10-05); no push, PR, hosted, or external action
Commits:               six focused commits (see "Bounded fix patch"); IDs in the preservation manifest
Files changed:         7 modified + 1 new test (frontend), tests/season-rehearsal/ (new), this report + 10 captures
Migrations/deps:       none
External actions:      none
```

## Verdict

**The core Season 1 loop works, and the local evidence supports it.** A full
fictional season ran end to end through the real UI in mock mode and through
the real RPCs of all 30 migrations on a disposable Postgres. It covered intake,
approval, rosters, eligibility, scheduling, aggregate scoring, a winner-changing
correction, public records, and one official ledger game.

**Not ready to operate a real season from the admin UI**, for two reasons:

1. **F1 (open, needs a feature):** an admin cannot create a regular-season game.
2. **F2 (now fixed locally):** every schedule edit saved the wrong kickoff time,
   in hosted mode as well as mock mode.

Five defects were fixed with failing tests written first. The remaining
findings are proposals or NON-BLOCKING notes.

Two items stay **unresolved** and are not claimed as passing or approved:
the E2E smoke suite (13 of 28 tests failing, attributed to this container's
network, not green) and F2's silent change of a nonexistent spring-forward
time (2:30 AM → 1:30 AM), which awaits an owner decision.

Nothing here is real-device or hosted proof. See "Proof classes" below.

## Fictional season (single source: `tests/season-rehearsal/fixture.cjs`)

- **Season and leagues:** `Rehearsal 2027`; *Rehearsal Kickball League* and
  *Rehearsal Flag League*.
- **Venue:** *Mesa Vista Rehearsal Park · Field R1*.
- **Teams:**
  - Kickball: Petroglyph Punters (via intake), Volcano Vista Kicks, Arroyo
    Alley Cats, Juniper Jacks.
  - Flag football: Turquoise Trail Flaggers (via intake), Sandstone Sprinters,
    Bluebird Blitz.
- **People:** 21 fictional adults, all with `@example.test` emails and phones
  in `505-555-01xx`. That is 17 added through Add Player, 2 captains created by
  registration approval, and 2 free agents assigned to rosters. Every roster
  has three players.
- **Games:**
  - `rh-kg1…kg7` and `rh-fg1…fg3`.
  - KG5 is the 10:00 AM day game.
  - KG6 is upcoming; a tie was attempted on it and correctly blocked.
  - KG7 is postponed.
  - FG3 is upcoming in mock mode and is the official ledger game in the
    database leg.
- **The correction:** KG2 was entered as 2-4 (a Cats win), then corrected with
  a reason to 5-4 (a Jacks win). This flips the standings leader through
  head-to-head.
- **Final tables:**
  - Kickball: Jacks 2-1 (+0) ranked above Punters 2-1 (+6) on head-to-head;
    then Kicks 1-1 and Cats 0-2.
  - Flag football: Sprinters 2-0, Flaggers 0-1, Blitz 0-1.
  - PF/PA, form, streak, and leaderboard ties (T1/T1/T1, next rank T4) were
    all checked against hand-computed values.

## Proof classes

| Class | What | Result |
|---|---|---|
| **Mocked (local dev server, real UI, Playwright/Chromium)** | `rehearsal.spec.js`: the full journey | **1/1 pass** (2.0 min) on final code |
| | `boundaries.spec.js`: permissions, duplicates, failed save, correction propagation, recovery, practice | **7/7 pass** on final code |
| | `ux-capture.spec.js`: 22 screens × 375 / 768 / 1280 | 3/3 captured; scan reviewed below |
| **Local database (disposable PG16, shim + all 30 migrations)** | `run_rehearsal_db.sh`: same fixture through RPCs as anon / service_role / non-admin / AAL1 / AAL2 | **52/52 pass** |
| **Real device** | none | **not run**, classified `unavailable`: no device and no deployed URL. Every viewport result is emulated Chromium. |
| **Hosted** | none | **not run**, classified `not-applicable`: forbidden by the task |

## Findings (prioritized)

### F1 — BLOCKING (operations): no way to create a regular-season game in the admin UI

- **Evidence:** the Schedule/Games tab in `frontend/src/pages/AdminDashboard.js`
  (`GamesTab`) only lists, edits, finalizes, and postpones existing games. No
  code path calls `createEntity("games", …)`.
- **Contrast:** the database already allows it. An AAL2 admin can insert games
  under Migration 29's column grant, as the database leg does in its schedule
  step.
- **Why it blocks:** step 6 of
  `docs/operations/SEASON1_DATA_ENTRY_2026-08-05.md` ("Create games…") cannot
  be done through the UI. Only playoff games can be created, via the bracket.
- **Workaround used:** the rehearsal wrote the schedule into mock storage. Every
  later step used visible controls.
- **Proposal (new feature, needs owner approval):** a "New Game" modal in
  GamesTab with league, home, away, start (league time), and venue fields,
  saved through the existing `createEntity("games")` adapter.
  - Cost: one component and its tests. No migration.
  - Pair it with the same-league and two-different-teams guards that
    `enforce_game_consistency` already applies on the server.

### F2 — BLOCKING, FIXED: game start times saved wrong in every browser time zone

- **Where:** `fromDateTimeLocalValue` in `frontend/src/lib/gameTime.js`. It
  backs the admin "Edit Game" modal and playoff match scheduling, in hosted and
  mock mode alike.
- **The bug:** it parsed a locale string in the browser's zone and applied the
  zone offset on both passes.
- **Effect:**
  - A Denver browser saved a typed 7:00 PM as 1:00 PM.
  - A UTC browser saved it as 1:00 AM the next day.
  - Opening the editor and saving without any change also moved the kickoff.
- **How it surfaced:** rehearsal step 5 showed `Oct 14 · 1:00 AM`.
- **Fix:** compare league wall-clock times as UTC numbers. 8 lines changed.
- **Regression test:** `frontend/src/lib/gameTime.test.js`.
  - Before the fix: 2 failed. After: 3/3 pass under `TZ=UTC`,
    `America/Denver`, `America/New_York`, and `Asia/Tokyo`.
  - Jest cannot change zone mid-run, so the zone axis is covered by running the
    file under each `TZ`.
- **DST check:** fall-back is fine; ambiguous 1:30 AM resolves to MDT.
- **UNRESOLVED behavior (not an approved choice):** a nonexistent
  spring-forward wall time is silently changed. `2026-03-08T02:30` is stored
  as `08:30Z` and re-displays as **1:30 AM**, with no warning to the admin. No
  league game is plausibly scheduled then, but the owner has not decided
  whether such input should be rejected, shifted forward (3:30), or kept as is.
  Repro: `fromDateTimeLocalValue("2026-03-08T02:30")` then
  `toDateTimeLocalValue(...)` → `2026-03-08T01:30`. Not covered by a test.
- **Owner check:** any game edited through the UI on hosted before this fix may
  hold a shifted `starts_at`. The documented hosted baseline has 0 games, so
  this is expected to be empty.

### F5 — NON-BLOCKING (mock-only), FIXED: refused admin actions crashed the whole app

- **Repro:** archive an approved registration, then press Approve. The app is
  replaced by "Something broke"
  (`season1-rehearsal-captures/pre-fix-mock-crash-reapprove-archived.png`). Re-assigning an
  already-assigned free agent did the same.
- **Cause:** the mock actions threw inside React state updaters, so the error
  escaped into the render phase. Hosted mode rejects the same calls with a
  toast.
- **Fix:** `refuse()` runs the check before the state update in
  `frontend/src/context/AppStateContext.js`, giving a toast plus a rejection,
  as hosted does.
- **Tests:** 2 new cases in `AppStateContext.mock.test.js`, failing before the
  fix and passing after.
- **Not fixed (same pattern, not reachable from today's UI):** the
  `enroll`/`createTeamIdentityAndEnroll`/`verifyWaiver` throws and the
  free-agent duplicate-roster throw. A later cleanup could move them the same
  way.

### F6 — NON-BLOCKING, FIXED: double-clicking "Save with reason" saved twice

- **Effect:** two history rows 66 ms apart (`Score saved` then `Score edited`).
  The same score was written twice, but the audit got a duplicate row.
- **Mode:** hosted mode would issue two `submit_score` RPCs from the same
  handler path. This is inferred; it was observed only in mock mode.
- **Fix:** a ref-based in-flight guard in `ScoreEntry.js`. It stays latched on
  success, because the page navigates away, and resets on failure so a failed
  save can be retried.
- **Tests:** 2 new tests in `ScoreEntry.test.js` (double-click and
  retry-after-failure). The double-click test failed before the fix. The
  browser double-click check now records one save.

### F3 — NON-BLOCKING (mock-only), FIXED: a just-submitted free agent became a nameless player

- **Effect:** after assignment, the new profile had `name: undefined`. It
  rendered blank on rosters, in score entry, and on public pages until a page
  reload re-derived the name.
- **Fix:** derive the name with the existing `freeAgentName` helper.
- **Test:** 1 new mock-context test, failing before and passing after.

### F4 — NON-BLOCKING (data honesty), FIXED: Standings misstated its tiebreak

- **Effect:** the subtitle said "wins first, point diff breaks ties". The code
  (`computeStandings`) applies head-to-head first. In this season that put the
  +0 Jacks above the +6 Punters.
- **Fix:** the copy now reads "wins first, then head-to-head, then point diff".
- **Test:** 1 new Standings test, failing before and passing after. If the
  owner would rather change the rule than the label, that is a product
  decision.

### Proposals and notes (not fixed: product, design, or low-impact)

| # | Verdict | Finding | Evidence | Proposal and cost |
|---|---|---|---|---|
| P1 | NON-BLOCKING | Home contradicts itself. The hero says "NEXT: SUNDAY Oct 11" because it filters `starts_at > now`. The "Up Next" card and the "Upcoming Games" list do not filter, so they show overdue, unscored Jun 30 – Jul 7 games as upcoming. They also ignore the per-sport current season. | `season1-rehearsal-captures/phone-home-stale-up-next.png`; `Home.js` `nextUp` / `upcoming` | Owner decides how overdue unscored games should appear ("Awaiting score" vs hidden). Then a one-file selector change. |
| P2 | NON-BLOCKING | Every team made with "New Team Identity" defaults to `#3FBFB2`. Five of the seven rehearsal teams share one color, so identity stones and the Game Detail color field cannot tell them apart. Registration approval already rotates a palette. | final state; `TeamsTab.openNew` | Default to the next palette color, as approval does. Small change. |
| P3 | NON-BLOCKING | On a 375 px phone, the innings grid in score entry scrolls sideways. Inning 5 and the **Total** column sit off-screen at the field. | `season1-rehearsal-captures/phone-score-entry-innings-scroll.png` | Pin the Total column, or wrap to two rows on narrow screens. One component. |
| P4 | NON-BLOCKING | The stat summary in score entry reads "0 **Home** · 0 RBIs · 0 Runs". It takes the first word of "Home Runs", which reads like the home team. Flag football has the same problem ("Pass", "Rec"). | same capture; `ScoreEntry.js` `.split(" ")[0]` | Add explicit short labels (HR, RBI, R) in `statsConfig`. Copy only. |
| P5 | NON-BLOCKING | The admin Teams tab overflows to 485 px at 375 px wide. The whole page scrolls sideways instead of the table. This breaks the mobile-first rule on an operational surface. | `season1-rehearsal-captures/phone-admin-teams-overflow.png`; scan `horizontal overflow 485>375` | Let the enrollments table scroll inside its card. One class. |
| P6 | NON-BLOCKING | The admin Players table "Season" column shows the legacy `settings.current_season` ("Summer 2026") for every player, including Rehearsal 2027 rosters. | final state; `PlayersTab` | Show the season(s) from the player's roster rows. Small change. |
| P7 | NON-BLOCKING | The public Game Detail page gives no sign that a final was corrected. The audit exists for admins only. | `season1-rehearsal-captures/phone-game-kg2-corrected.png` | Owner decision on public correction transparency. |
| P8 | NON-BLOCKING | Standalone controls on phone are under 24 px tall: "Directions" 68×21, "Share profile" 106×21, "More filters" 103×15. Inline name links in lists also measure 17–21 px, but inline links are exempt under WCAG 2.5.8. | phone `scan.json` | Pad to a 24 px minimum (44 px is preferred). CSS only. |
| P9 | NON-BLOCKING | The free-agent success screen has no "submit another" action, unlike Team Interest. Re-opening the same route keeps showing the success screen. | rehearsal step 2 | Copy and structure parity with TeamRegistration. |
| — | ALREADY FINE | Demo-role gates (anonymous, player, captain, temp_admin) on `/admin` and `/score-entry` | boundaries 1 |  |
| — | ALREADY FINE | No PII on public profile, team, or free-agent pages | boundaries 1; DB `public 02/03` |  |
| — | ALREADY FINE | Correction propagates to standings, totals, box score, leaderboards, and the history timeline | boundaries 5; DB `corr 02-04` |  |
| — | ALREADY FINE | Ties share rank and gilding per Addendum 4 (T1/T1/T1, then T4) | `season1-rehearsal-captures/phone-leaderboards-t1-ties.png` |  |
| — | ALREADY FINE | Day-game sun mark at 10:00 AM and night moon mark per Addendum 6 | `season1-rehearsal-captures/desktop-game-kg5-day-mark.png` |  |
| — | ALREADY FINE | Consent checkboxes have accessible names through their wrapping `<label>`; the scanner's "unnamed" hits were false positives | role query: `checkbox name=/consent/` = 1 |  |
| — | ALREADY FINE | Blank Leaderboard modules in full-page captures were a scroll-reveal artifact | scrolled capture |  |

There is no light or day theme to audit. The day-mode answer is Addendum 11's
open item. Reduced motion was not re-audited, because no motion changed. Tablet
width (768) showed no failure distinct from phone or desktop.

## High-risk boundaries (local database, real RPCs)

- **Permissions:**
  - anon is denied league writes and direct intake inserts.
  - An authenticated non-admin and an AAL1 admin are denied league writes,
    `approve_registration`, `correct_final_score`, and
    `start_scorekeeping_session`.
  - service_role can insert intake rows but cannot read them back.
  - Team rows can be changed only through RPCs, even for an AAL2 admin.
  - Score columns cannot be written directly.
- **Duplicates:**
  - A second approval of a registration is refused.
  - A second free-agent assignment is refused.
  - A duplicate roster row is refused.
  - A replayed ledger event is returned as `replayed`, not duplicated.
  - A second open ledger session is refused (`INV-20`).
- **Validation:**
  - A kickball tie is blocked (`INV-08`).
  - Flag football with three quarters is blocked (`INV-10`).
  - A stat line for a player outside the game is blocked (`INV-11`).
  - A SOFT warning without a reason is refused; with a reason, it is recorded.
  - A final game cannot be re-scored with `submit_score` (`INV-24`).
- **Correction:**
  - A blank reason is refused.
  - The audit trail reads Score saved → Marked final → Final score corrected,
    with before/after values.
  - Corrected stat lines replace the originals.
  - `game_edit_history`, `scorekeeping_events`, and waivers are append-only at
    the grant layer, and waivers also at the trigger layer.
- **Ledger:**
  - FG3 finalizes at 12-6, final and locked.
  - Projected `player_stats` carry the attributed stats.
  - A ledger correction moves a touchdown from Tess to Uri; the score is
    unchanged and the game stays locked.
  - History holds only system output.
  - Aggregate `submit_score` and `correct_final_score` are refused for the
    ledger game (`INV-30`/`INV-39`).

## Test results on the final tree (base 5dae3ec; identical content to the six local commits)

| Check | Baseline (5dae3ec) | Final |
|---|---|---|
| Frontend Jest (`CI=true npm test -- --watchAll=false`) | 42 suites / 227 tests pass | **43 / 236 pass** (+9 regression tests, all failing before their fix) |
| API (`npm run test:api`) | 28/28 | **28/28** |
| Production build (placeholder env) | compiled | **compiled** |
| pgtest (`run_pgtest.sh`) | **382/382** + append race PASS + practice fork race PASS | reused: no SQL or migration changed |
| E2E smoke (`tests/e2e-smoke`) | 28 failed (env: font CDN TLS interception) | **NOT GREEN — 13 of 28 tests fail, UNRESOLVED, environment-attributed.** In each failing test the gating/PII/admin-table assertions ran and passed; the final console-clean assertion failed on `ERR_TOO_MANY_RETRIES` loading external fonts through this container's proxy. The attribution is inferred from the error text, not proven by a clean run: the suite must pass in CI (or another unintercepted environment) before it can be called green. Run with a session-local `ignoreHTTPSErrors` override that is not committed. |
| Rehearsal (mock UI) | — | **1/1** journey, **7/7** boundaries, **3/3** captures |
| Rehearsal (local DB) | — | **52/52** |

Environment notes:

- `initdb` refuses to run as root, so the database checks ran as the
  `postgres` user.
- The browser console's only errors were external font fetches.
- CRA's dev-only error overlay fires on the benign "ResizeObserver loop"
  notice; the specs hide it.

## Bounded fix patch

`git diff` of the four source files: `gameTime.js`, `AppStateContext.js`,
`ScoreEntry.js`, and `Standings.js`, about 50 changed lines. Tests are in
`gameTime.test.js` (new), `AppStateContext.mock.test.js`, `ScoreEntry.test.js`,
and `Standings.test.js`. Suggested commits, kept focused per AGENTS.md:

1. `fix(schedule): resolve league wall time independently of the browser zone` — `gameTime.js`, `gameTime.test.js`
2. `fix(mock): refuse invalid approvals/assignments without crashing; name new free-agent players` — `AppStateContext.js`, its mock test
3. `fix(score-entry): one save per double-click` — `ScoreEntry.js`, its test
4. `fix(standings): state the head-to-head tiebreak the table applies` — `Standings.js`, its test
5. `test: reusable Season 1 rehearsal (mock UI + local database)` — `tests/season-rehearsal/`
6. `docs: Season 1 rehearsal audit 2026-10-05` — this file and `season1-rehearsal-captures/`

## Judgment calls and deviations

1. **Schedule injected through mock storage.** Forced by F1 and labelled in the
   spec step name.
2. **Rehearsal waiver version.** The database leg inserts a
   `REHEARSAL-PLACEHOLDER-v0` waiver version, marked "not legal text", in the
   disposable database only. It is never in mock state, a hosted project, or
   the UI.
3. **F2's Jest test runs in a single zone.** Process-zone switching does not
   work inside Jest, so the zone axis was proved by separate `TZ=` runs, as
   documented in the test header.
4. **F5 fixed only the two reachable paths.** Same-pattern throws that the UI
   cannot reach were left alone and reported.
5. **The F6 guard stays latched after a successful save.** The page navigates
   away on success; a retry after failure is covered by a test.
6. **F4 changes the label, not the rule.** The documented code rule was treated
   as authoritative.
7. **pgtest was not re-run.** No SQL changed, so the baseline evidence is
   reused.
8. **The smoke run used an uncommitted override config** to work around this
   container's TLS interception.

## Handoff — next session

- **Branch:** `claude/amazing-sagan-dpy3b0`. Base 5dae3ec plus six local,
  unpushed commits. **The next action is the owner's push decision.** If the
  container is gone, restore from the preservation package (git bundle or
  patch series; see its README).
- **Unresolved, carried forward:** the E2E smoke (13/28, environment-attributed,
  not green) and the F2 nonexistent-DST-time behavior (owner decision).
- **To re-verify:** follow `tests/season-rehearsal/README.md`. The browser legs
  take about 6 minutes, the database leg about 1 minute.
- **Open work, in order:**
  1. F1 "New Game" proposal (needs owner approval as a stage).
  2. The P1 owner decision on overdue games.
  3. P2–P6 small UI fixes, if the owner approves them as a batch.
  4. Real-device and hosted live-flow acceptance, which remain Phase 10 gates.
- **Measurements:**
  - Elapsed time: about 1 hour of wall clock.
  - Machine pressure: low (4 CPUs, load under 1).
  - Owner interactions: 1 gate (commit approved 2026-10-05; push still pending).
  - Independence: none claimed. The executor reviewed its own work, so no
    blind phase.
