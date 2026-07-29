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

## Step 3 — Sun/moon motif (decision 7) — proposal only

## Test baseline

Clean branch (`d550315`, before any edit):
`CI=true npm test -- --watchAll=false` → **38 suites passed, 208 tests passed,
0 failed** (48.2s). This is the floor the batch must stay at or above.

## Out-of-scope observations for later batches

