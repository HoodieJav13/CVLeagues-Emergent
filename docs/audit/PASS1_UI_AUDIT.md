# Pass 1 Spectator-Journey UI Audit

- **Audit baseline:** commit `a2839cc`
- **Mode:** read-only product audit using mock-only `seed.js` data
- **Primary journey:** Home → Schedule → Game Detail
- **Viewports:** 390 × 844, 768 × 1024, 1440 × 1000

## Design language in use

The public experience uses Oswald for broadcast-style display copy and Inter for dense competition data. Dark neutrals carry most surfaces; teal identifies brand/action, gold marks achievement or playoff emphasis, and red is reserved for live/alert states. The strongest existing patterns are the homepage hero, featured score treatment, compact game cards, winner bars, labeled status badges, and gold stage banners. The binding typography contract defines `text-display-xl` (40px) for page `h1` titles and `text-display-lg` (30px) for section `h2` titles. Interactive controls are required to maintain 44px minimum targets.

The complete capture inventory is in [`pass1-captures/MANIFEST.md`](pass1-captures/MANIFEST.md). Only `*-viewport.png` files are trusted layout evidence; the `*-default.png` files document a full-page screenshot stitching failure.

## Seed-hypothesis disposition

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| Scores, team names, and metadata have near-equal weight | **Refuted for score and game content; narrowed to page-title hierarchy.** Runtime computed styles were 44/20/12px on the 390px Home featured card and 28/16/12px on the 390px Schedule cards. At 1440px the Home featured card was 64/24/12px. The cards have a real hierarchy. The confirmed problem is that several page `h1` titles use the 30px section token. |
| Uniform cards, borders, and density flatten importance | **Refuted.** The hero, featured scoreboard, ordinary game cards, stage banners, detail scoreboard, stat tables, and empty states use meaningfully different treatments. See [Home 1440](pass1-captures/home-1440-viewport.png), [Schedule 1440](pass1-captures/schedule-1440-viewport.png), and [Game Detail 1440](pass1-captures/game-g1-1440-viewport.png). |
| The homepage broadcast identity does not govern downstream competition pages | **Not supported as a finding.** Downstream pages reuse the same sport/status vocabulary, display face, winner treatment, stage language, dark surfaces, and teal/gold semantics. Adding hero artwork or a new visual motif downstream would be a new direction for Pass 2, not a correction justified by this audit. |

## 1. Journey-level cross-cutting findings

| # | Severity | Problem | Evidence | Proposed correction | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | Public page titles do not consistently use the documented page-title token. Schedule and Game Detail render their `h1` at 30px—the same size intended for section headings—at both mobile and desktop. This compresses the page/section ladder even though the score-card hierarchy itself is sound. | The contract specifies `font-display text-display-xl uppercase text-foreground` for page titles and `text-display-lg` for section titles in `CVLeagues_Design_Tokens.md` §3. Runtime measurement found Schedule and `/game/g1` `h1` values of 30px at both 390px and 1440px; Home reaches 40px at 1440px. Compare [Home 1440](pass1-captures/home-1440-viewport.png), [Schedule 1440](pass1-captures/schedule-1440-viewport.png), and [Game Detail 1440](pass1-captures/game-g1-1440-viewport.png). `SectionHeading` applies `text-display-lg` regardless of whether its semantic tag is `h1` or `h2`, and Game Detail hard-codes the same token. | Make `SectionHeading` select `text-display-xl` when `as="h1"` and retain `text-display-lg` for section headings. Apply the exact page-title recipe to the manually owned public `h1` elements in Home and Game Detail, then verify inherited supporting pages. Do not invent a new font size or treatment. | High |

No other journey-level issue passed the improve-ui proof gate. In particular, the available evidence does not justify redesigning card density, score hierarchy, or downstream brand treatment.

## 2. Primary-page findings

### Home (`/`)

**ALREADY FINE — Content hierarchy.** The hero establishes the league identity; Latest Final and Up Next receive distinct prominence; ordinary game cards step down cleanly. Scores, team names, and metadata do not compete at equal weight. [390px evidence](pass1-captures/home-390-viewport.png) · [768px evidence](pass1-captures/home-768-viewport.png) · [1440px evidence](pass1-captures/home-1440-viewport.png)

**NON-BLOCKING (noted) — Shared title correction.** Home already reaches the 40px page-title token on desktop but steps down to 30px on mobile. Pass 3 should apply the same exact page-title contract across all three primary pages, then validate that “Current Leagues” still fits at 390px without harmful wrapping.

### Schedule (`/schedule`)

**NON-BLOCKING (noted) — Page title uses section scale.** This is the clearest manifestation of Finding 1: the 30px `h1` remains the same size from 390px through 1440px. [390px evidence](pass1-captures/schedule-390-viewport.png) · [1440px evidence](pass1-captures/schedule-1440-viewport.png)

**ALREADY FINE — Mobile scanning and state communication.** Filters remain usable in a two-column mobile grid, cards preserve score/team/meta hierarchy, and status plus stage are communicated with labels rather than color alone. Upcoming and empty states are explicit. [Upcoming filter](pass1-captures/schedule-390-upcoming-filter-viewport.png) · [No-results state](pass1-captures/schedule-390-empty-filter-viewport.png)

### Game Detail (`/game/g1`, `/game/g11`)

**NON-BLOCKING (noted) — Page title uses section scale.** The matchup `h1` is hard-coded to the 30px section token on mobile and desktop. Team names wrap at 390px without truncating, but the page-title contract still calls for the page token. [Completed game at 390px](pass1-captures/game-g1-390-viewport.png) · [Completed game at 1440px](pass1-captures/game-g1-1440-viewport.png)

**ALREADY FINE — Final/upcoming and playoff states.** The final game prioritizes score and period breakdown; the upcoming playoff game substitutes clear scheduling information and retains the gold stage treatment. [Upcoming playoff at 390px](pass1-captures/game-g11-390-upcoming-playoff-viewport.png) · [Upcoming playoff at 1440px](pass1-captures/game-g11-1440-upcoming-playoff-viewport.png)

## 3. Supporting-page consistency notes

- **NON-BLOCKING (noted) — Shared title drift is broader than the primary journey.** Standings, Playoffs, and Leaderboards also request `SectionHeading as="h1"`, so the proposed shared correction will repair them automatically. [Standings 1440](pass1-captures/standings-1440-viewport.png) · [Leaderboards 1440](pass1-captures/leaderboards-1440-viewport.png)
- **NON-BLOCKING (noted) — Two manual title owners need regression review.** Team and athlete profile pages use manual `text-display-lg` page headings. They confirm the same contract drift but do not require a separate visual direction. [Team 390](pass1-captures/team-t1-390-viewport.png) · [Profile 390](pass1-captures/profile-p1-390-viewport.png)
- **ALREADY FINE — Competition patterns are coherent.** Standings tables, leaderboard rows, team summaries, and profile statistics use consistent spacing, type, surface, and semantic-color patterns.
- **ALREADY FINE — Playoff empty states are honest.** The mock seed contains no bracket records; Kickball and Flag Football both show the unpublished state. A populated bracket could not be captured without violating the read-only fixture constraint. [Kickball 768](pass1-captures/playoffs-768-viewport.png) · [Flag Football 768](pass1-captures/playoffs-768-flag-football-unpublished-viewport.png)
- **NON-BLOCKING (noted) — Development-only controls were excluded.** The preview role switcher can overlay page content at narrow widths, but it is explicitly a mock-development tool and is not part of the spectator production surface.

## 4. Full-page capture-artifact verdict

**ALREADY FINE — This is a capture/stitching artifact, not a rendering bug.**

The prior apparent duplication was reproduced only by the browser's full-page screenshot path. The same route at the same viewport renders correctly in a viewport-only capture. DOM checks found exactly one `header`, one `main`, and one page `h1`; no duplicate React tree or repeated hero exists. The failure also changes shape by route and viewport—some full-page supporting captures are compressed into a narrow left strip—while the corresponding viewport captures remain correct.

Direct comparison: [artifact-prone Home 1440 full page](pass1-captures/home-1440-default.png) versus [trusted Home 1440 viewport](pass1-captures/home-1440-viewport.png), and [artifact-prone Standings 768 full page](pass1-captures/standings-768-default.png) versus [trusted Standings 768 viewport](pass1-captures/standings-768-viewport.png). Future visual audits should use viewport-only captures or another independently verified scrolling-capture mechanism.

## Self-contained implementation plan for Pass 3

### Outcome

Restore the existing documented page/section type ladder across the spectator journey without changing visual direction.

### Evidence chain

1. `CVLeagues_Design_Tokens.md` binds page `h1` to `text-display-xl` and section `h2` to `text-display-lg`.
2. `frontend/src/components/common/Section.js` currently applies `text-display-lg` to both semantic levels.
3. `frontend/src/pages/GameDetail.js` also hard-codes `text-display-lg` on its page `h1`; Home steps down to that token on mobile.
4. Runtime computed styles and three-width captures confirm the 30px/40px inconsistency.

### Exact change scope

1. Update `SectionHeading` so its default `h2` behavior remains unchanged and `as="h1"` receives the exact documented page-title recipe. Preserve band, subtitle, action, spacing, and color behavior.
2. Update the Home and Game Detail page headings to the same exact `font-display text-display-xl uppercase text-foreground` recipe. Do not add a new token, arbitrary size, shadow, gradient, animation, or component.
3. Verify the inherited result on Schedule, Standings, Playoffs, and Leaderboards. Normalize the two manual supporting owners—Team and Athlete Profile—to the same page-title recipe if they remain within the vertical-slice change set.
4. Add or update focused component/page assertions that distinguish `h1` from `h2` token ownership. Keep semantic heading levels intact.

### Validation

- Re-capture Home, Schedule, and both completed/upcoming Game Detail states at 390px, 768px, and 1440px using viewport-only screenshots.
- Confirm no title truncation or harmful two-line collision at 390px, particularly “Current Leagues” and the game matchup.
- Confirm section headings remain 30px and page headings compute to 40px.
- Regress Standings, Playoffs, Leaderboards, Team, and Profile at 390px and 1440px.
- Re-run frontend tests and production build. Stop if the exact contract causes a mobile collision; resolve that as an explicit documented exception rather than inventing an untracked size.

### Documentation impact

No new design decision is required. The implementation applies the existing token contract. If Pass 2 intentionally chooses responsive page-title behavior, record that as an explicit exception before Pass 3 changes the code.

## Proposed Pass 3 priority order

1. **Home → Schedule → Game Detail page-title vertical slice.** It is the only finding with binding contract, runtime, and capture proof.
2. **Inherited supporting-page regression.** Confirm the shared `SectionHeading` correction and normalize the two manual title owners if included.
3. **Do not preemptively redesign cards or downstream broadcast treatment.** The seeded density and identity hypotheses were refuted or unsupported; revisit only if Pass 2 establishes a new approved direction.
