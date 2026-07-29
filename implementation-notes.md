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

- **Addendum 6 recorded first** (contract change-control): state-bearing
  motif, sun = day / moon = night, fixed league-local clock-hour cutoff
  (working value 6:00 PM America/Denver, confirmed with the mark decision),
  state tones keep carrying color so no meaning rides on shape alone. The
  drawing itself is explicitly NOT decided. Non-game ray surfaces (Leaderboards
  hero) keep the existing rays until the mark is chosen — no false time state.
- **Both variants rendered in place** on Game Detail and Home featured cards at
  375px via a temporary wiring that was reverted after capture (PROPOSE, not
  BUILD — no product surface ships the mark). The SVG source is preserved at
  `docs/direction/prototypes/2026-07-28-sunmoon-mark-proto.jsx` (not imported
  by the app) so the chosen drawing doesn't have to be reinvented.
- Variant A (compliant): 56×44 corner zone, 2px strokes — sun as half-disc on
  a horizon line with a five-stroke Zia-derived ray fan; moon as open crescent
  with one four-point star. Variant B (bolder): 96×72 zone, 3.5px strokes,
  larger disc/crescent, second star, and a ≤22%-opacity tone wash — a genuine
  push past comfortable, not a second conservative reading.
- Captures: `docs/audit/pass4-identity-captures/motif-*.jpeg` (10 shots:
  day/night × final/upcoming/playoff/home × both variants).

### Judgment calls in Step 3

10. **First bold-moon geometry collided with the status badge** and read as
    broken rather than bold; redrawn to clear the badge before capture. Bold
    means larger and heavier, not occluded.
11. **StageBanner/sport-pill collisions were captured, not designed around** —
    placement on banner-topped frames is part of the owner's mark decision and
    is logged as a NON-BLOCKING finding in the capture manifest.
12. **Sun state is rare in current data** (all current-season games start
    ≥ 6:30 PM); the day captures use the Fall 2025 10:00 AM fixture. Flagged
    to the owner in the manifest.

### Moon revision (owner feedback, 2026-07-28, second iteration)

The owner reviewed the first pair and asked for a more impactful moon,
noting night is the common state (correct — every current-season game starts
after 6:30 PM, so the moon is effectively the motif). Both moons redrawn:

- **A2 (compliant):** outline crescent → solid filled crescent, ~2× the area,
  one larger star. Same 56×44 corner zone, no wash.
- **B2 (bolder):** solid crescent at 16px radius with the badge's
  offset-echo signature (45%-opacity duplicate shifted 3px lower-right —
  ties the motif to the hexagon identity grammar), two stars, wash raised to
  24%. Geometry tightened so the crescent's lower horn clears the status
  pill instead of re-emerging beneath it (first draft did, and read broken).
- Suns unchanged; original A/B night captures kept in the folder as decision
  trail, superseded by `motif-A2/B2-*.jpeg`.
- Same discipline as the first pass: temporary wiring, captured at 375px,
  reverted; docs prototype source updated to the revised drawings; product
  code untouched (verified `git diff frontend/` empty against the verified
  head, so the 208/208 + build evidence stands).

### Mark decided and shipped (owner choice, 2026-07-28, third iteration)

The owner chose **A2 with fixed celestial colors** — white moon, gold star —
and directed respacing so the mark isn't crowded by the status pill. Recorded
in Addendum 6 first (per change control), then implemented as real product
code: `frontend/src/components/direction/SunMoonMark.js` on the Game Detail
event frame and Home featured cards, replacing `StructuralCorner` there.
`StructuralCorner` remains on non-game surfaces (Leaderboards hero, Home hero)
per Addendum 6's no-false-time-state rule.

### Judgment calls in the shipped mark

13. **Sun color = gold** is an extrapolation of the owner's white-moon /
    gold-star direction (the Zia sun is the brand's gold symbol), not an
    explicit owner choice — recorded as vetoable in Addendum 6. Day games are
    currently rare (only the Fall 2025 fixture starts before 6 PM).
14. **Respacing implemented as relocation, not shrinking:** the StatusBadge
    keeps its size (shrinking it would change the status system app-wide) and
    moves left beside the SportBadge; on Home the sport pill joins the kind
    label on the left. The freed corner lets the mark render at 84×64,
    ~1.5× the proposed A2, unoccluded.
15. **Fixed colors mean the mark no longer carries state tone.** State still
    reads from the StatusBadge label and frame border color, so the
    three-signal rule holds; noted in Addendum 6.
16. **Banner collision resolved by the below-banner rule** (`--below-banner`
    modifier, 2.75rem top offset) rather than hiding the mark on playoff
    frames.
17. **Unknown start time renders as night** — every real league game is at
    night, so night is the honest default rather than a guess at noon.

Verified: 208/208 suite, production build, live captures at 375/1440 across
night/day/final/forfeit/playoff/Home states (`mark-*.jpeg`).

### Sun redraw (owner rejection, 2026-07-28, fourth iteration)

The shipped stroke-built sun was rejected on owner review ("looks like a
7-year-old drew it") — the diagnosis: four rays at uneven ad-hoc angles, a
horizon running into the frame edge, and an outline construction sitting next
to a solid moon. Redrawn as a **solid gold half-disc** grounded on an inset
round-capped horizon with a **symmetric five-ray fan** (evenly spaced at 30°
steps, alternating long-short-long-short-long in the Zia rhythm) — the same
filled solidity as the crescent, so the pair reads as one system. Addendum 6's
sun description updated to match; the vetoable-gold note stands. Same-day
captures replace `mark-day-final-g17-*.jpeg`.

## Test baseline

Clean branch (`d550315`, before any edit):
`CI=true npm test -- --watchAll=false` → **38 suites passed, 208 tests passed,
0 failed** (48.2s). This is the floor the batch must stay at or above.

---

# Pass 4 — Remaining batches, HALF 1 (2026-07-29)

Owner authorized executing the rest of Pass 4, then split it in two on
review-cadence grounds. **Half 1 = the four decided page recompositions**
(Schedule D2 #8, Standings A2 #3 + data graphics #4, Game Detail B2 #1,
Home C2 #5) on branch `pass4-remaining` off `main` at `ba2d995`. **Half 2**
(Team/Profile, Playoffs, forms, voice #9) waits for owner review of this half.
Out of scope and untouched: cinematic budget (#6, Pass 5), page-signature X3
and OG cards (undecided/deferred), B3 poster (approved only as a dedicated
shareable frame; not built).

Baseline: the Identity-batch merge state — 38 suites / 208 tests passing.

## Batch A — Schedule D2 (decision 8)

Mobile rows became stacked scorelines: away line first (list-order convention
stated once in the page subtitle), score per line, winner bold / loser muted,
display-type names that wrap — the 38-char fixture renders whole. Kickoff time
rides the away line on upcoming games; forfeits read W/L with "Forfeit" in the
meta line. Calendar export moved below the register. The ALREADY FINE desktop
grid is untouched (dual-render with CSS breakpoint switching — the component
renders both layouts; the test asserts both).

## Batch B — Standings A2 + worm (decisions 3, 4)

Addendum 7 recorded before the code. Leader hero row (40px gold numeral,
2rem record), 20px full-opacity form chips (the carried Batch 2 spec), W-L-T
records, PF/diff/streak context line, and a per-row point-share bar replacing
the always-on gold rail. One layout at every viewport — **the latent
tie-honesty BLOCKING is resolved** (a 1-1-1 team can never again render as
0-0). The differential worm renders behind the "Season shape" disclosure,
closed by default, `aria-hidden`, from a local pure helper over existing
selectors.

## Batch C — Game Detail B2 (decision 1, Addendum 8)

Addendum 8 recorded before the code. Team-color fields at 38% mix meet at the
score; matchup h1 is sr-only (the scoreboard is the title); scores at
4rem/4.5rem; state/date/time each speak once. Judgment calls:

18. **The centered FINAL/FORFEIT chip is the sole state statement on decided
    games**, so the StatusBadge renders only for undecided states — which also
    retires the red CANCELED badge beside FORFEIT (the Identity batch's logged
    status-language finding, resolved here as designed rather than patched).
19. **Chip anchors to the score band**, not the vertical center — the first
    draft overlapped the 38-char name; bold placement must not occlude.
20. **Upcoming games keep the proven focal time** inside the new color
    environment; their meta line shows venue only (the focal already states
    date and time).
21. GameDetail.test's h1 typography assertions were replaced with sr-only
    assertions — deliberate, per Addendum 8.

## Batch D — Home C2 (decision 5)

- Hero arrival states, decided on the league's calendar date: game day →
  "GAMES TONIGHT/TODAY" (via `isNightGame` — the Addendum 6 cutoff reused) +
  first-kick time at 3rem/4.5rem + venue; off-day → "NEXT: {WEEKDAY}" +
  first-kick fact; no future games → the original Current Leagues block
  (honest fallback — the frozen seed relative to the real clock hits this).
- Game-day strip: scroll-snap, finger-driven, no idle motion; card per game.
- "New Teams" feed from `registrations`: **"wants in" for unapproved
  submissions, "just joined" only for approved ones** (judgment call 22 — the
  decision's example copy said "just joined", but announcing an unreviewed
  interest form as a joined team would misstate the product's own
  interest-≠-registration rule; team name + sport only, no captain PII).
- Newcomer CTA moved below the fold; **the sticky MobileJoinBar is unmounted
  from the layout everywhere** (judgment call 23: with data pages excluded by
  decision 5 and Home's CTA below the fold, the bar had no remaining surface;
  the component and its tests stay dormant rather than deleted).
- Captures use Playwright clock injection (2026-06-30 15:00 league time for
  game day; 2026-06-29 for off-day) — the seed itself is untouched.

---

# Pass 4 — Remaining batches, HALF 2 (2026-07-29)

Branch `pass4-half2` off `main` at `ceb028b` (the Half-1 merge). Scope: the
approved-but-unbuilt Team/Profile, Playoffs, and forms batches plus the voice
pass (decision 9, Addendum 9 recorded first).

## Batch E — Team/Profile

TeamPage: stat pills → the previously-dead StatStrip (record now shows ties);
roster card grid → hairline register rows (badge, name, crown/eligibility,
position · jersey). AthleteProfile: highlight tiles → StatStrip with
league-rank sub-lines (rank testids preserved); card headings adopt
SectionHeading. StatStrip gained an optional `sub`/`subTestId`.

24. **Stat-leader links show the full name** (was bare first name — audit X2's
    "6 / Marcus" finding), folded in here since the element was already open.
25. **PUBLIC/PRIVATE tabs left as-is** for anonymous visitors — the audit's
    "consider removing" is a product question, not a copy fix; logged, not
    decided.

## Batch F — Playoffs vocabulary

Gold band on the page heading (SectionHeading `tone` prop, `.cvf-band--gold`);
the generic trophy empty state became a structural bracket silhouette — seed
lines merging into a champion flat-top hexagon, gold on the path — the Pass 1R
finding finally built.

## Batch G — Forms

Both intake forms consolidated onto one FormSurface with numbered FormSection
steps and internal hairlines (new shared grammar in
`components/common/FormSection.js`). All testids/validation/Turnstile behavior
unchanged. Free Agent h1 → "Free Agent Signup" (hyphen wrap fix).

## Batch H — Voice pass (decision 9, Addendum 9)

Addendum 9 (voice register) recorded first: broadcast base, local-warm lean,
schema vocabulary never leaks, nothing sounds like a form validator. Then the
public-copy sweep (13 strings): "All Containers" → "All Leagues"; "the
administrator locks the seeds" → "the league locks the seeds"; empty states
become invitations with facts ("First game, first numbers", "The table opens
with the season", "Roster in progress", "No box score for this one", "First
results land here after opening night"). Admin/auth surfaces keep their
precise register per the addendum — the "administrator" strings in RoleGate/
recovery flows are deliberately untouched.

---

# Post-Pass 4 stage work (2026-07-29, on `main` after the owner's push)

## Maintenance — parallel-test flake (owner-directed)

Resolved with evidence; see the rewritten backlog entry in CLAUDE.md. Zero
open handles; cause is chronic machine contention; mega-test split + one
documented global 20s budget. 210/210 parallel under load ~390.

## Signed rushing yardage (INV-03) — done locally

No schema needed: the ledger runtime already allowlists signed `rushYards` on
`carry` events (local harness re-baselined at 340/340 + concurrency,
`LC_ALL=C` required on this machine). The carry control gained the signed
yards input parallel to the completed-pass control; one event carries
`carries +1` and the signed `rushYards` delta. Invariant matrix row updated to
RESOLVED LOCALLY; hosted positive proof stays with the durable pilot.

## Practice mode — STOPPED at an owner gate, by design

Every candidate shape amends a load-bearing Migration 24 invariant (game-bound
sessions, composite anti-fork keys, per-game sequencing). Three shapes with
tradeoffs and a recommendation (Option B — practice sessions without games,
structural exclusion inside the already-private tables) are recorded in
`docs/scoring/PRACTICE_MODE_DESIGN_2026-07-29.md`. Migration 30 waits for the
owner's shape choice.

## Pass 5 motion (Addendum 10 recorded first)

Motion tokens defined (`--motion-fast/settle`, `--ease-out/settle` — they were
referenced but never defined; judgment call 26: defining them fixed silently
zero-duration transitions on two hover states). Four beats in the contract
vocabulary, transform/opacity only, one-time, non-idle: game-day arrival
settle + strip stagger; fresh-final settle (fields, chip, scores); the
monument settle (row stagger + share-bar scaleX growth); bracket reveal
stagger as the secondary showcase. The **Eliminated** contract state shipped
with it (desaturated identity, muted label, no red) on bracket loser slots.
Clinch flourish stays dormant (judgment call 27: all Season 1 teams qualify,
so the state cannot vary — building it would animate a constant).
Reduced-motion: every class no-ops under `reduce`; parity directly verified by
computed-style assertion and four forced-reduce captures
(`docs/audit/pass5-motion-captures/`).

## Out-of-scope observations for later batches

