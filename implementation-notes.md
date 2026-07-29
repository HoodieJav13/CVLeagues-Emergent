# Pass 4 Implementation Notes — Batch: Identity (2026-07-28)

Durable deviation log for the Identity batch (decisions 2, 7, 10 from
`docs/direction/PASS4_DIRECTION_DECISIONS_2026-07-28.md`). Every deviation from
the approved direction is numbered and explained; conservative option taken
when forced. Handed to the next batch — not a scratch file.

**Branch:** `pass4-batch-identity` off `main` at `d550315`.
**Mode:** DIAL: EXECUTE inside the owner-approved Identity batch.

## Authority ledger (protocol v1.2)

- inspect: allowed — repository policy
- edit/test: allowed — owner-approved Identity batch (this prompt)
- commit: allowed on the batch branch — the batch prompt instructs landing
  Step 1 as its own commit and committing this file with the batch
- push: confirmation — repository policy (and "never push to main" is explicit)
- merge/deploy/hosted mutation/external message: confirmation/forbidden —
  repository policy; none planned
- raw credentials / destructive history: forbidden — protocol default

## Deviations and judgment calls

(numbered as they occur; see per-step sections below)

## Step 1 — Unkind fixtures (decision 10)

Baseline established before editing: see "Test baseline" below.

Fixtures added to `frontend/src/data/seed.js` (extend-only; no existing
structure reorganized):

- **Tie** — `g15`, kickball, Nob Hill Nomads 5–5 Rio Grande Rollers
  (2026-06-23, before the season anchor). Aggregate score only, no player-stat
  rows: score-entered-without-box-score is itself a legitimate state, and it
  keeps leaderboards/profiles stable.
- **0-0 forfeit** — `g16`, Roadrunners forfeit to Sluggers, in the exact
  `isForfeitOutcome` shape (`canceled` + `final` + `locked` +
  winner/loser + `outcome_type: "forfeit"`, scores 0-0). Makes the previously
  unreachable seeded-forfeit render path reachable.
- **38-char team name** — identity `ti9` / team `t9` "Los Ranchos de
  Albuquerque Roadrunners" (38 chars), enrolled in the current kickball league,
  no roster (mirrors t7), carrying the forfeit loss so the name reaches
  Schedule, Standings, Game Detail, and Team.
- **Two-enrollment franchise** — prior season `Fall 2025` (season row +
  league `l3` + enrollments `t10` (Rollers identity) and `t11` (Sluggers
  identity) + one completed game `g17`, 9–6). Both franchises now have real
  Franchise History; the historical season becomes selectable on
  season-filtered surfaces, which is the locked product behavior.
- **Populated bracket** — `pb1` for Burque Flag Football with seeds
  t4/t6/t8/t5, Semifinal 1 completed and advanced (game `g10`), Semifinal 2
  ready and linked to `g11`, Championship/Third Place each holding one
  advanced slot. Shape mirrors `buildSingleElimBracket` +
  `advancePlayoffMatch` output exactly.

### Judgment calls in Step 1

1. **`g10` promoted from `approved`/unlocked to `final`/locked** (one existing
   fixture row modified). The seeded bracket has advanced g10's winner, and
   `advancePlayoffMatch` legitimately requires a locked final. Leaving g10
   merely approved would make the fixture contradict the app's own guard.
   Conservative alternative (bracket with no advancement) would have left the
   advanced-slot rendering unauditable, defeating the fixture's purpose.
2. **`STORAGE_VERSION` bumped 10 → 11** in `frontend/src/context/mockState.js`.
   A persisted v10 dev state is valid but lacks the fixtures, and decision 10's
   purpose is that these states are *permanently auditable in mock mode* — a
   silently-stale localStorage would defeat that. Discard-not-merge follows the
   existing v9→v10 precedent.
3. **t7 (High Desert Heat) deliberately left untouched** — it is the app's only
   empty-team fixture (audit relies on it); the tie was placed between t2/t3
   instead.
4. **The tie and forfeit are new games rather than mutations of g1/g2** (the
   discovery captures mutated existing games at runtime). Adding rows is the
   extend-only option and preserves every existing assertion target.
5. **New identity color `#14b8a6`** comes from the existing `AVATAR_COLORS`
   palette in the same file — no new hue introduced.

### What broke, and the near-clean-pass analysis

Exactly **2 of 208 tests** broke, both in `src/lib/derivedStats.test.js`
("franchise history"): they assumed identity `ti1` has exactly one seed
enrollment. The fixture exposed a real assumption — the "career record sums
every enrollment" test was actually **vacuous** before (with one enrollment,
summation was never exercised). Both were updated to assert genuine three-season
ordering and genuine two-enrollment summation. No assertion was weakened.

Why so little broke — investigated, not assumed: every page suite
(`Standings/Home/Schedule/Playoffs/GameDetail/...`) mocks `AppStateContext`
with hand-built states and never consumes the seed. Only five suites import
`initialState`, and their literal assertions pin flag-football records
(`t4`/`t5`) and playoff-exclusion behavior, which the kickball-side fixtures
deliberately avoid (g10's lock change alters no record). The near-clean pass is
therefore legitimate but reflects thin seed coverage, so render-proof was
gathered instead of trusting the suite: all five fixtures were verified live in
mock mode (Playwright, 375px and 1440px) — 38-char name + T column + T3/T3
shared rank + forfeit W on Standings; FORFEIT + W/L on Game Detail g16; 5–5
equal-weight tie on g15; two-season Franchise History on Team t1; populated
bracket with advanced winner, ready semifinal, and locked-seeds row on
Playoffs → Flag Football.

Observation for a later batch: the fixture confirms audit X4's finding that the
g16 forfeit page shows a red CANCELED status badge next to the FORFEIT label —
status language worth revisiting in the Game Detail batch (red is reserved for
live/alert).

## Step 2 — Hexagon identity badge (decision 2)

One component (`StructuralIdentityBadge`), one clip-path. The shape lives in a
single CSS rule (`frontend/src/index.css`), so the octagon → flat-top hexagon
swap is one polygon change; every existing badge surface (Home featured,
Schedule register, Standings, Leaderboards hero/rows, Game Detail heads)
changed shape with zero JS edits. No second badge implementation exists.

Substitutes retired per Addendum 5 (all now `StructuralIdentityBadge`):

| Surface | Was | Now |
| --- | --- | --- |
| Team page header | `w-16 rounded-2xl` initials square | base badge (4rem / 4.5rem md) |
| Team page stat leaders | 40px circular Avatar | `--md` (2.75rem) player badge |
| GameCard team lines (Home/Team) | 10px color dot | `--sm` (1.75rem) team badge |
| Playoffs seed-review rows | 10px dot | `--sm` team badge |
| Playoffs bracket TeamSlot | 8px dot | `--sm` team badge |
| Game Detail box-score headers | 10px dot | `--sm` team badge |
| Game Detail box-score player rows | 28px circular Avatar | `--sm` player badge |
| PlayerCard (roster) | 42px circular Avatar | `--md` player badge |
| AthleteHoverCard | 46px circular Avatar | `--md` player badge |
| Athlete Profile header | 72px circular Avatar | base badge |
| Athlete Profile team history | 10px dot | `--sm` team badge |

Size ladder now: base 4rem (4.5rem md) / `--leaderboard-hero` 5.5rem /
`--register` 2.25rem (2.75rem md) / `--leaderboard` 2.25rem / `--md` 2.75rem /
`--sm` 1.75rem — i.e. the E0 evidence sizes 64/44/28 plus the previously
proven context sizes. `--standings` was renamed to the generic `--sm`
(identical values; one usage updated) rather than duplicating the class.

Verified at 64/44/28 and every landing site via live captures at 375px and
1440px, including the stress fixtures: the 38-char name beside a 64px badge on
Game Detail, the 0-0 forfeit (W/L + FORFEIT + badge), the 5–5 tie row, the
populated bracket slots, and the T3/T3 standings rows. Dot count on public
pages is now zero. Cold-screenshot visibility: the badge is the first
identity element that registers on every captured surface (Addendum 2 floor —
directly verified on captures, though the owner's cold read remains the
authority).

### Judgment calls in Step 2

6. **Player badge color = `avatar_color`** (each player keeps their personal
   color), following the shipped, batch-accepted Leaderboards pattern. The E0
   gallery's roster mock painted players in their *team's* color instead.
   Addendum 5 decides shape, not player color; shipped precedent is the
   conservative reading. If the owner intended team-colored rosters, it is a
   one-line change per call site — flagging rather than deciding.
7. **Operational surfaces left untouched** (AdminDashboard identity dots and
   Avatars, ScoreEntry, captain-gated FreeAgentPool, dev RoleSwitcher). The
   prompt's replacement list names public surfaces; Addendum 5 retires
   substitutes "as batches reach them," and the contract's density rule keeps
   operational surfaces token-only. The `Avatar` component is retained solely
   for those surfaces. A later operational-surface batch can finish the sweep.
8. **Playwright environment deviation:** `/opt/pw-browsers` does not exist on
   this machine and `PLAYWRIGHT_BROWSERS_PATH` was unset. `playwright install`
   was NOT run (per instruction); captures use `playwright-core` (scratchpad
   install) driving the already-present Chromium headless shell in
   `~/Library/Caches/ms-playwright/chromium_headless_shell-1228`.
9. **Normalized off-ladder person sizes** to the E0 ladder: 72px profile
   header → base (64px, 72px at md), 46px hover card and 40/42px roster
   avatars → 44px `--md`. The Addendum keeps "existing badge sizes"; these
   were Avatar sizes, not badge sizes, and the ladder is the system.

## Step 3 — Sun/moon motif (decision 7) — proposal only

## Test baseline

Clean branch (`d550315`, before any edit):
`CI=true npm test -- --watchAll=false` → **38 suites passed, 208 tests passed,
0 failed** (48.2s). This is the floor the batch must stay at or above.

## Out-of-scope observations for later batches

