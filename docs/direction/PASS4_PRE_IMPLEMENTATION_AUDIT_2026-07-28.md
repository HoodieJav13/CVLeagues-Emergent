# Pass 4 — Pre-Implementation Audit

**Date:** 2026-07-28
**Mode:** DIAL: REVIEW + PROPOSE (read-only; no application code edited, no hosted action, mock mode verified with zero Supabase requests)
**Baseline:** `main` at `9469d18`, branch `visual-discovery-pass4`
**Evidence:** [capture manifest](../audit/pass4-discovery-captures/MANIFEST.md) — 26 captures at 375 × 812 and 1440 × 900, including four stress captures produced by runtime-only fixture mutation (ties, 0–0, 38-char team name), state restored and verified afterward.
**Companion:** [PASS4_BLIND_SPOT_PASS_2026-07-28.md](PASS4_BLIND_SPOT_PASS_2026-07-28.md) names the categories; this document tests them on screen.

Verdicts are exactly **BLOCKING / NON-BLOCKING / VISUALLY INSUFFICIENT / ALREADY FINE** per Addendum 3.

---

## What I would change if I could only change three things

### 1. One entity, one identity device — everywhere.

The octagon-plus-offset badge is the best thing the batches produced, and it is the app's signature. It is also applied to only part of the product, and every gap is visible in a single screenshot. The same team renders as an octagon on Home's featured cards, a **flat rounded square on its own Team page header** ([team-t1-1440](../audit/pass4-discovery-captures/team-t1-1440.jpeg)), a **10px color dot on Home's game cards** — octagons and dots coexist in one viewport ([home-1440](../audit/pass4-discovery-captures/home-1440.jpeg)) — and dots again on Playoffs (in two different sizes) and Game Detail box-score headers. Players get the octagon only on Leaderboards; everywhere else they are generic circles. The dead `StatStrip` primitive tells the same story: the system was built, then applied surface-by-surface until the batches stopped, and no artifact owns coherence.

This is first because it is the highest ratio of visible-delta to cost in the product: the primitive already exists, at five proven sizes, and the work is replacement, not invention. Reference-tier products are recognizable because one grammar survives every surface. Right now a stranger flipping between Team and Home would reasonably conclude they're two apps sharing a palette.

### 2. Recompose Standings around the story it now knows, mobile-first.

Standings is the page where R2's data landed on Batch 2's finished layout without recomposition, and it shows in both directions. At 1440 it is a small floating table whose largest number is 14px, in a page that is mostly empty field ([standings-1440](../audit/pass4-discovery-captures/standings-1440.jpeg)) — against Anchor B, which makes standings monumental. At 375 — the primary viewport — everything R2 added is deleted: no GP, no PF, no streak, no LAST 5, no T column. The stress capture is the damning one: a team with two ties renders as `0 W / 0 L` with nothing else, **indistinguishable from a team that never played** ([stress-standings-tie-longname-375](../audit/pass4-discovery-captures/stress-standings-tie-longname-375.jpeg)). Addendum 4 calls tie-rank honesty mandatory on all ranked surfaces; the mobile table currently cannot express a tie at all. Meanwhile the gold qualification rail sits on every row because every team qualifies — a signal carrying zero differentiation.

This is second because it is the app's most-checked mid-week page, its anchor comparison is the least flattering of the three, and the fix is one page's composition rather than a system change.

### 3. Give the game its theater back.

Game Detail is the emotional center of the product and currently spends its space on everything except the game. At 375 the matchup h1 wraps to three lines (four with a real long name — [stress-game-0-0](../audit/pass4-discovery-captures/stress-game-0-0-longname-375.jpeg)), repeating the two team names that the scoreboard immediately below states again, pushing the score to the fold. At 1440 the event frame pushes both teams to the extreme edges and leaves a ~700px silent center with a small "FINAL" in it; the 56px scores are physically large but compositionally small in an 1100px-wide card ([game-final-g1-1440](../audit/pass4-discovery-captures/game-final-g1-1440.jpeg)). FINAL appears twice, the date twice, the time twice. And the page has no matchup identity: `logo_color` — a per-team asset already in the schema — is unused except in the badge outline, so every game page is visually the same game.

This is third because it is where identity, composition, and the cold-screenshot test converge on one surface: this page is what gets screenshotted into group chats after a win.

---

## Cross-cutting findings

### X1 — Identity fragmentation (the systemized grammar stops mid-product)

**VISUALLY INSUFFICIENT — high confidence.** Detail under "three things" #1 above. Inventory of divergences, each with the octagon already proven at a suitable size:

| Surface | Current device | Should be |
| --- | --- | --- |
| Team page header | flat `w-16 rounded-2xl` initials square ([TeamPage.js:38](../../frontend/src/pages/TeamPage.js)) | base octagon (4/4.5rem exists) |
| GameCard (Home/Team) | 10px color dot | register octagon (2.25rem exists) |
| Playoffs TeamSlot / seed rows | 8px and 10px dots (two sizes, one page) | standings octagon (1.75rem exists) |
| Game Detail box-score headers | 10px dot | standings octagon |
| Athlete identity outside Leaderboards | plain circular Avatar | direction decision needed: octagon for players everywhere, or an explicit two-shape rule (octagon = team, circle = person) applied consistently — either is coherent, the current mix is not |

**Delta:** every team reference ≥ 28px carries the same octagon; dot count on public pages drops to zero. **Cost:** swap call sites in ~6 files, no new primitive, tests touch snapshots only. The player-shape decision is an owner call (Phase 4 question).

### X2 — The app has no voice (copy is default-component dialect)

**VISUALLY INSUFFICIENT — medium confidence** (correct, functional, and reads as any app). Instances on capture: "All Containers" as a public filter label leaking schema vocabulary ([schedule-375](../audit/pass4-discovery-captures/schedule-375.jpeg)); "Duke City Kickball's bracket will appear after **the administrator** locks the seeds"; "No games found / Try adjusting your filters"; stat-leader tiles labeled with a bare first name ("6 / Marcus"). **Delta:** ~20 strings; empty states become editorial ("Season opens June 14" energy); zero layout change. **Cost:** trivial per string; the work is deciding the register (Phase 4 question).

### X3 — No surface identifies itself in a screenshot

**VISUALLY INSUFFICIENT — medium confidence.** Outside Home, no captured viewport carries a wordmark, sport, or season once the navbar scrolls away; a screenshotted box score or standings table into a team group chat carries zero brand. One static og-image serves every route. **Delta:** a small persistent page signature (wordmark + season) inside the capture zone of Standings/Game/Leaderboards; per-entity OG cards are a later, separate decision. **Cost:** low for the in-page signature (one shared component); OG cards need serverless rendering — defer.

### X4 — Latent unkind-fixture states have no design

**VISUALLY INSUFFICIENT (latent) — high confidence, verified by stress captures.** These states cannot occur in the seed but will occur in a real season, and none has a designed treatment:

- **0–0 / forfeit final:** both scores render equal-weight with no story or label ([stress-game-0-0-longname-375](../audit/pass4-discovery-captures/stress-game-0-0-longname-375.jpeg)). Forfeits are common in adult rec; the seeded forfeit W/L path (`isForfeitOutcome`) is unreachable from mock data and has never been visually audited.
- **Tie games:** a 5–5 register row gets no tie treatment; the winner/loser muting logic simply doesn't fire ([stress-schedule-longname-375](../audit/pass4-discovery-captures/stress-schedule-longname-375.jpeg)).
- **Long names:** 38 characters survives desktop, wraps to three lines at 375 in Standings and four h1 lines on Game Detail.

**Delta:** define FORFEIT/TIE labels + a name-length policy (e.g., register surfaces get an abbreviation field or 2-line clamp). **Cost:** low-medium, but requires an owner-approved unkind fixture in the seed so these states stay auditable — same gap Playoffs already has.

### X5 — Every page opens with controls instead of content

**VISUALLY INSUFFICIENT — medium-high confidence.** At 375, Schedule stacks a full-width export button plus five select boxes (~450px of chrome) before the first game ([schedule-375](../audit/pass4-discovery-captures/schedule-375.jpeg)); Standings and Leaderboards open with filter stacks; the teal JOIN banner tops every page, so the first pixel of every session is recruitment aimed at people who already joined. Anchor A's entire register philosophy is content-first with one compact segmented control. **Delta:** filters collapse to one row of chips/segments (~44px) with the full set behind a "Filter" affordance; calendar export moves below the register; JOIN banner suppressed on data pages or collapsed to a nav item. **Cost:** medium — shared layout + 3 pages; no data-flow change.

---

## Per-page findings

### Home

- **ALREADY FINE:** featured Latest Final / Up Next cards — octagons, winner treatment, score scale, venue metadata all land ([home-375](../audit/pass4-discovery-captures/home-375.jpeg)).
- **VISUALLY INSUFFICIENT — the hero is a permanent welcome mat.** "CURRENT LEAGUES / ALBUQUERQUE, NM" is a label that never changes, spending the page's largest type and its only Sandia/ray composition on no information. On game day nothing anywhere says TODAY. Against Anchor A ("what's happening now" as the organizing idea) this is the page's real gap — the blind-spot pass calls it *arrival states*. **Delta:** hero carries the temporal state of the league — next game day countdown-ish framing, "GAMES TONIGHT · 3", or this-week framing — with the existing geometry as backdrop; CTAs demote. **Cost:** medium (Home.js + selectors already expose the data; no schema).
- **VISUALLY INSUFFICIENT:** GameCard dots vs octagons in one viewport (X1).
- **NON-BLOCKING (noted):** JOIN banner dominance at 375 (X5).

### Schedule

- **ALREADY FINE:** the desktop register is the app's closest approach to reference tier — week groups, center score column, muted losers, playoff rail ([schedule-1440](../audit/pass4-discovery-captures/schedule-1440.jpeg)).
- **VISUALLY INSUFFICIENT — high confidence — mobile rows truncate the payload.** At 375 every team name shows ~9 characters ("Mesa Ma…", "Bosque …") because the center date+score column reserves ~40% of row width ([schedule-375](../audit/pass4-discovery-captures/schedule-375.jpeg), worse in [stress-schedule-longname-375](../audit/pass4-discovery-captures/stress-schedule-longname-375.jpeg)). Names are what a player scans for. **Delta:** rebalance the mobile grid (center column to ~5.5rem, names to 2-line clamp at 0.8125rem, or stacked-rows layout with right-aligned score); target ≥ 16 visible characters. **Cost:** low — `CompetitionRow` CSS grid only.
- **VISUALLY INSUFFICIENT:** filter stack before content (X5).
- **NON-BLOCKING:** "All Containers" copy (X2); "Download These Games" placement above content.

### Standings

- **Re-confirming and superseding the logged LAST 5 finding.** The logged VISUALLY INSUFFICIENT (16px chips, 10px text, 60% borders) is real and visible at 1440 — the chips under-register even on the gold leader row. But it understates the problem: chips are the desktop tail of a page whose mobile body deletes the entire R2 story (see "three things" #2). Fixing chip size alone would be the icon-sizes-and-padding failure mode. Superseding verdict: **VISUALLY INSUFFICIENT for the whole Standings composition**, with the chip spec (20px, 11px text, full-opacity borders, `--leader-bg` contrast pass) as one line item inside a mobile-first recomposition.
- **BLOCKING (latent, activates with real data): mobile cannot express ties.** At 375 the T and GP columns are absent, so a 0-0-2 team is indistinguishable from a 0-0-0 team ([stress capture](../audit/pass4-discovery-captures/stress-standings-tie-longname-375.jpeg)). Addendum 4 makes tie honesty mandatory on all ranked surfaces; this fails it silently the day the first kickball game ends level. Must be resolved in the Standings/Team batch, before real season data.
- **VISUALLY INSUFFICIENT:** gold qualification rail on every row = zero differentiation; page composition at 1440 (small table, 14px maximum number, vast dead field) against Anchor B's monumental treatment. **Delta:** seed numbers at display scale, diff as a signed bar (data graphic, not decoration — see blind-spot §11), rail re-scoped to something that varies (e.g., seed line or clinch state when it exists). **Cost:** medium — one page + register CSS.
- **NON-BLOCKING (noted, product not visual):** a 0 GP team ranks above a team that has played (High Desert Heat #3 over Rio Grande #4) — tiebreak ordering choice worth an owner glance, outside this pass's scope.

### Leaderboards

- **ALREADY FINE — the reference surface.** Category heroes, octagons, T-rank convention, copper/orange separation, expansion behavior — this page is what the rest of the app should feel like ([leaderboards-flag-375](../audit/pass4-discovery-captures/leaderboards-flag-375.jpeg)).
- **NON-BLOCKING (noted):** small-sample bathos — a 56px gold monument to "2" home runs reads slightly comic cold ([leaderboards-375](../audit/pass4-discovery-captures/leaderboards-375.jpeg)). Not a defect; a candidate refinement is value-plus-unit lockups ("2 HR") so scale reads as craft rather than inflation. Revisit when real season volumes exist.

### Game Detail

- **ALREADY FINE:** upcoming playoff state (gold frame + 44px focal time) and the box-score tables.
- **VISUALLY INSUFFICIENT — high confidence:** composition of the final state at both viewports; no matchup identity; duplication grammar (FINAL ×2, date ×2, time ×2). Detail in "three things" #3. **Delta:** h1 becomes metadata (or drops; the scoreboard is the h1), scores to ~72px desktop inside a compressed center, team-color ambient fields behind each side at real saturation (REQUIRES CONTRACT AMENDMENT only if treated as new motif — it uses existing per-team color in existing zones), single source for state/date/time. **Cost:** medium — GameDetail.js + event-frame CSS.
- **VISUALLY INSUFFICIENT (latent):** 0–0/forfeit story absence (X4).

### Team

- **VISUALLY INSUFFICIENT — high confidence:** header identity device (X1); three equal stat pills where the dead `StatStrip` was built for exactly this; roster as a contact-list card stack. The crown-for-captain and eligibility shields are good details worth keeping. **Delta:** octagon header at 4.5rem, stat pills → continuous 3-cell strip with internal rules, roster rows → register rows (name + position + jersey in a hairline list). **Cost:** low-medium — this *is* the approved Team/Profile batch, and the primitives exist.
- **NON-BLOCKING (noted):** calendar button occupies hero position inside the header card; empty-team page (t7) is honest but affectless — "—" tiles with no invitation ("Season starts for this team Jun 30") ([team-t7-empty-375](../audit/pass4-discovery-captures/team-t7-empty-375.jpeg)).
- **NON-BLOCKING (noted):** Franchise History is unreachable in mock data (every identity has exactly one enrollment), so the R2-C surface has never been visually audited. Its batch needs a two-enrollment fixture — same class of gap as the Playoffs bracket.

### Athlete Profile

- **VISUALLY INSUFFICIENT — high confidence:** the only public page with zero CVF structural vocabulary — no band, no octagon, no corner mark, generic circle avatar ([profile-p1-375](../audit/pass4-discovery-captures/profile-p1-375.jpeg)). It is simultaneously the page with the app's most human content: the bio line and the T-rank context tiles are genuinely good. **Delta:** identity treatment per the X1 decision, `.cvf-band` heading grammar, stat tiles → StatStrip; keep and expand the bio/rank-context language. **Cost:** low-medium, inside the approved batch.
- **NON-BLOCKING (noted):** PUBLIC/PRIVATE tab pair is presented to anonymous visitors with a lock glyph — consider whether the private tab belongs on the public surface at all; generic trophy empty state on the no-stats sport tab.

### Playoffs

- **VISUALLY INSUFFICIENT — re-logging Pass 1R's finding, now two batches stale:** the empty state is still a generic trophy in a large field; the proposed structural bracket silhouette was never built. Additionally the playoff *page* carries none of the gold stage vocabulary the rest of the app uses — no StageBanner, no octagons, dots in two sizes ([playoffs-375](../audit/pass4-discovery-captures/playoffs-375.jpeg)).
- **NON-BLOCKING (noted):** populated bracket remains publicly unreachable in mock data (seed brackets are empty arrays); its focused audit still owes on a fixture, per the existing batch plan. Copy: "after the administrator locks the seeds" (X2).

### Forms (Team Interest / Free Agent)

- **VISUALLY INSUFFICIENT — carrying Pass 1R unchanged:** both remain stacks of disconnected rounded shells; the consolidation direction (single surface, numbered sections, internal rules) is still the right call and still unbuilt ([team-interest-375](../audit/pass4-discovery-captures/team-interest-375.jpeg)).
- **NON-BLOCKING:** "FREE AGENT SIGN-UP" h1 hyphen-breaks across lines at 375 ([free-agent-375](../audit/pass4-discovery-captures/free-agent-375.jpeg)) — wording or `text-wrap: balance` fix.

---

## Hypothesis check (the owner's map)

Your hypothesis — that the richest findings sit where R2 dropped data onto finished visual work — **held for Standings** (the single richest surface in this audit) and **partially for Schedule** (the register absorbed venue/`starts_at` cleanly; its real problems are mobile truncation and control stacking, which predate R2). **Team/Profile and Playoffs** are rich, but as *never-batched* surfaces rather than R2 seams — their R2 additions (franchise history, venue select) are either unreachable in mock data or minor. The map missed three things the captures surfaced: the identity-grammar fragmentation (X1, the largest systemic finding), the voice/copy layer (X2), and the latent unkind-fixture states (X4). Calendar-export styling — an R2 seam candidate — turned out ALREADY FINE as buttons, just questionably placed.

## Effort-vs-impact discipline

Highest return per cost, in order: X1 identity swaps (existing primitives, ~6 files), Schedule mobile row rebalance (CSS grid only), X2 copy pass (~20 strings), Standings recomposition (1 page), Game Detail recomposition (1 page), X5 control collapse (shared + 3 pages), Home arrival state (1 page + selectors). Explicitly *not* recommended: any new dependency, a global radius/token sweep, per-entity OG-card infrastructure this season, or motion work ahead of Pass 5.
