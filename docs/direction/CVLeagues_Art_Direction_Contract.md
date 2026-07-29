# CVF Leagues — Art Direction Contract
*Pass 2 deliverable. Governs Pass 3 vertical-slice, Pass 4 systemize, Pass 5 motion. Any deviation from this doc during implementation is a stop-and-ask, not a judgment call.*

## Balance

**70% broadcast/editorial · 20% Albuquerque/local-culture · 10% cinematic.**
Broadcast/editorial governs by default. Culture is texture, not wallpaper. Cinematic is a small number of *earned* moments, not ambient decoration.

## Typography (contract, not new decisions)

- Page `h1` → `text-display-xl` (40px), uppercase, `text-foreground`. Section `h2` → `text-display-lg` (30px). This is the existing contract — Pass 1 found it inconsistently applied; restore it exactly, do not invent a new size.
- Score/metric display faces scale by context and viewport (already proven sound: ~44px mobile / ~64px desktop on featured cards, ~28px on ordinary cards). Preserve this ladder; extend it to any new card type rather than replacing it.
- Metadata (dates, locations, labels) stays small and recessive — 12–14px, muted color. It should never visually compete with score or team name.
- No new typefaces. Oswald (display) + Inter (body) remain the entire type system.

## Palette

- Locked: dark neutral canonical surface, teal (brand/action), Zia gold (achievement/emphasis), Zia red (live/alert only), flag-football orange (sport accent).
- No new hues introduced for texture or culture elements — they render in the existing palette at reduced opacity, not as new brand colors.

## Local-culture layer (the 20%)

- **Ray-line motif** (radiating line groups, drawn from the Zia sun symbol already in the logo) is the primary reusable graphic device: card dividers, corner accents, section-break rules, a subtle radiating treatment behind a hero stat.
- **Guardrail:** the full circle-and-rays Zia icon stays confined to existing logo lockups. Do not multiply the complete symbol across components — extract only the ray-line as an abstracted graphic element.
- Sandia ridge silhouette, topographic contour lines, and court-marking line-work are the supporting motif set. All render as low-opacity texture — atmosphere, never competing with data.
- Culture texture is allowed on: card backgrounds, dividers, section transitions. Not allowed on: data cells, buttons, form fields, or anywhere it could reduce legibility or touch-target clarity.

## Photography (no real photos yet — this is the load-bearing decision)

- Hero, profile, and team zones are designed **fallback-first**: logo mark + ray-line/topographic texture + team/brand color, composed to look like a deliberate design choice, not an empty slot waiting for a photo.
- Every photography zone ships with this fallback as the real, permanent-feeling state. When photos arrive later, they occupy the same zone with the same crop/overlay treatment — no redesign required, no visual "upgrade" moment that makes the fallback look like it was always temporary.

## State language

- **Live:** red badge + pulsing dot; reduced-motion fallback is a static red badge with "LIVE" label — the pulse is decoration, the label is the signal.
- **Upcoming:** teal outline badge.
- **Final:** neutral/muted badge; winner gets the existing winner-bar treatment (bold name + full-opacity score), loser recedes (muted name + reduced-opacity score). Keep as-is — Pass 1 confirmed this pattern works.
- **Playoff/stage:** existing gold banner treatment, unchanged.
- **Eliminated** *(new — brackets aren't populated yet, define now)*: desaturated card treatment, reduced opacity on team identity, no winner bar since there's no game score being emphasized — this is a standings-state, not a score-state. Small "Eliminated" label, muted, no red (red stays reserved for live).
- **Clinched/Advanced** *(new)*: brief gold flourish on the moment of transition (see motion below), settles into the same visual weight as any other winning team afterward — the celebration is temporal, not a permanent badge.

## Motion personality

- Verbs: *settle, shift-weight, reveal.* Not: bounce, spin, cartoon overshoot.
- Micro-interactions: 150–300ms. Transitions: 400–600ms. Easing: ease-out, confident stop — nothing that lingers or oscillates.
- **Distribution model:** cinematic weight spreads across small state-transition beats rather than concentrating in one feature — a game settling into FINAL, a clinch/elimination moment, a standings rank change. These are the primary 10%. One secondary showcase target (bracket reveal or championship game detail) may run longer and more elaborately, using the same motion vocabulary, once brackets have real data — not a separate design language.
- `prefers-reduced-motion` always has a complete, non-animated equivalent that communicates the same state change via instant color/label — motion is enhancement, never the only signal.
- Performance floor: 60fps target on a 3-year-old mid-range Android, not just the dev's machine.

## Density by surface

- Public spectator pages (Home, Schedule, Standings, Playoffs, Leaderboards, Game, Team, Profile): generous spacing, editorial breathing room, full expressive treatment above.
- Operational surfaces (Admin, intake, payments, score entry): inherit tokens and status language only. Denser, faster, calmer — no texture, no cinematic beats, minimal motion beyond functional feedback.

## Explicit anti-patterns

- Generic SaaS card grids with no hierarchy variation.
- Gratuitous glow, neon, or gradient-mesh backgrounds.
- Constant idle/ambient animation (anything that moves without a state change to communicate).
- Decorative charts where a list or table communicates faster (dither-kit and similar chart libraries stay shelved).
- Full Zia sun icon used decoratively outside the logo lockup.
- Stock or placeholder photography used to "fill" a zone before real photos exist — use the designed fallback instead.

## Pass 3 decision — ray-line implementation (ADDENDUM)

**Decision: `pass3-slice-structural-line` is the base direction.** Between the two Pass 3 treatments, structural/edge-grammar wins on owner review of real captures — the textured/atmospheric treatment was too low-opacity to register as a deliberate motif at any viewport, while the structural treatment reads clearly, ties color to state (teal/gold/neutral corner marks matching Upcoming/Advanced/Eliminated), and remains legible at 390px.

- Ray-line motif renders going forward as **corner marks / edge accents on cards and identity badges**, not background texture or atmosphere. This supersedes the "textured surface" option in the original contract's culture-layer section — both were legitimate hypotheses at Pass 2; this is the resolved answer.
- **New scope for Pass 4:** the Game Detail team-badge treatment (octagon outline + ray mark, replacing flat color-fill initials) is a standout result and extends to Team and Profile page identity badges, not just Game Detail. This was not in the original Pass 3 slice boundary — record it here as approved scope before Pass 4 begins.
- Corner-mark weight should stay proportionate at small sizes (390px) but may warrant slightly more visual weight on primary/featured surfaces (hero, featured score card) in Pass 4 rollout — evaluate rather than assume during systemization.

## Boldness calibration (ADDENDUM 2)

**Observed pattern:** execution has trended more conservative than intended, independent of the contract's actual content. The Textured branch technically satisfied every contract line item while rendering at near-imperceptible opacity — compliant, but not *present*, despite an explicit owner instruction for the culture layer to be more present. This is a process failure, not a one-off misjudgment: an executing agent resolving ambiguity will round down toward "safe" by default, and nothing in the prior process asked "is this distinctive" — only "is this broken."

**Corrective rules, effective immediately:**

- Where a pass involves a genuine visual-direction choice (not a bug fix or contract restoration), produce the contract-compliant option **and** one deliberately bolder variant that pushes size/weight/opacity past what feels comfortable, explicitly labeled as such. The owner chooses between real alternatives, not between two conservative readings of the same idea.
- **Visibility floor:** any motif, accent, or texture introduced for visual identity must be spottable in a still screenshot cold, with no prior knowledge it's there. If it can't be found without being told where to look, it's under threshold and doesn't satisfy "present" — regardless of how correct it is on paper.
- This does not loosen the anti-pattern list or the public/operational density split — those remain. It specifically targets the gap between "technically compliant" and "actually distinctive."

## Audit methodology & reference anchors (ADDENDUM 3)

**The problem, precisely:** prior audits could only answer "is this broken against the written contract" — a question that structurally resolves to "already fine" whenever nothing is provably wrong, with no mechanism to flag "correct, but not distinctive enough to matter." That gap is exactly what Boldness Calibration (Addendum 2) caught after the fact, at cost. This addendum closes it going in, and adds a second failure mode this project should guard against: engineering effort that's disproportionate to the visual payoff it buys.

**Reference anchors (the missing Pass 2 step, closed now):**
- **Apple Sports** — glanceable live scores, speed, personalized competition tracking. Primary anchor for Home and Schedule registers.
- **"World Cup 2026, simplified"** (sheets.works, Awwwards-recognized) — data-viz tournament/bracket treatment. Primary anchor for Standings/Playoffs registers.
- Future reference-gathering should pull from Awwwards' "Data Visualization" and "Mobile & Apps" categories, not "Sports" — that category is dominated by one-page brand-campaign microsites, the wrong comparison class for a live-data utility app.

**New required audit finding category — VISUALLY INSUFFICIENT.** Distinct from BLOCKING, NON-BLOCKING, and ALREADY FINE. Any element that passes contract-compliance must still be checked against the reference anchors above: would this be mistaken for reference-tier work, or does it read as a competent template? If the honest answer is "competent template," log it as VISUALLY INSUFFICIENT with a proposed direction — do not fold it into ALREADY FINE. Not a bug, but not done.

**Effort-vs-impact accounting.** Any pass proposing a visual-direction change states, in concrete terms: (a) the actual visual delta (size/color/position/opacity numbers, not descriptive language), and (b) implementation cost (files, components, new dependencies touched). If cost is high and stated delta is marginal, flag it for owner reconsideration rather than shipping it as complete — this is the direct fix for changes that are "more trouble on the backend than actual frontend impact." This does not apply to foundational/integrity work like Gate 0, which is correctly judged on safety and correctness, not visual ROI — it applies specifically to styling, motion, and identity work going forward.

## Batch 1–2 revisions & Anchor C (ADDENDUM 4)

**Identity badge revision (owner-directed, Batch 1).** The 24–32px ray strokes originally specified for identity badges are replaced by a **3px team-color outline offset toward the lower-right**. The ray/corner-mark motif remains the treatment for surface-level elements — cards, heroes, rails, section accents — but no longer appears on badges. Rays live at surface level; badges carry the octagon + offset outline. Supersedes the badge portion of R1's spec; all future badge work (Team, Profile, compact table marks) follows the outline treatment.

**Copper token (replaces bronze).** Rank-3 medal treatment collided with flag-football orange. Bronze is retired in favor of a distinctly warm copper — visually separated from `--cvf-orange` by being darker, browner, and less saturated (reference family: `#B87352`; final value set in tokens, not hardcoded per the no-hex-in-components rule). Add as a named token (e.g. `--cvf-copper`) with a defined role: rank-3/medal semantics only. It is not a general accent and must not migrate into other uses.

**Tie convention (mandatory, all ranked surfaces).** Tied values share rank: `T3 / T3`, next rank skips (`5`). Shared rank means shared rail/medal treatment — three players tied for first are all gold, not gold/silver/copper. Applies to Leaderboards, Standings tiebreak displays, and any future ranked view. Rendering tied stats as distinct ranks is a data-honesty violation, not a style choice.

**Anchor C — OT7 Leaders page (https://otseven.com/stats).** Overtime's spring football league. Better matched to CVF's scale and player-first positioning than Anchors A/B for leaders/stats surfaces specifically. Qualities to draw on:
1. Multi-category dashboard — all stat categories rendered simultaneously as stacked modules, no category dropdown; a player finds their own name by scrolling, not filtering.
2. Featured-leader hero per category — rank 1 as a distinct hero block (identity zone, name, team, large value) above the rank 2+ list. Maps directly onto CVF's fallback-first badge zones; photo-ready later.
3. T-rank tie convention (codified above).
4. **Do not copy:** 10-deep lists. At CVF roster sizes a top-10 is the whole league. Cap at top 5 per category module with an expansion for full leaders.
Anchor A remains primary for Home/Schedule; Anchor B for Standings/Playoffs; Anchor C for Leaderboards/stats surfaces.

## Identity badge shape — hexagon (ADDENDUM 5)

**Identity badge shape revision (owner-directed, Pass 4 discovery, 2026-07-28).**
The octagon specified in Addendum 4 and recorded as approved Pass 4 scope in the
Pass 3 addendum is replaced by a **flat-top hexagon** (flat edge up, vertices
left/right). The **3px team-color offset outline is retained unchanged**, as are
the existing badge sizes and the surface-level placement rules. **Supersedes the
badge shape in Addendum 4 ("badges carry the octagon + offset outline") and the
Pass 4 scope note in the Pass 3 addendum ("octagon outline + ray mark");** every
other clause of both addenda stands. All badge work — Game Detail, Team, Profile,
Schedule/Standings/Leaderboards marks, compact table marks — follows the flat-top
hexagon.

Two decisions ride with the shape:

1. **One device for every entity.** The hexagon badge is the identity device for
   teams **and** players, at every size, on every surface. The Team-page
   rounded-square tile, the color dots on GameCard/Playoffs/box-score headers,
   and plain circular avatars in identity positions are all retired in favor of
   the hexagon as batches reach them.
2. **Evidence basis.** This reverses a decision originally made on owner review
   of real captures, so it was decided the same way: the owner chose the
   flat-top hexagon against the octagon and the pointy-top alternative in a
   side-by-side comparison of identical content at 64/44/28px in 375px frames
   (`docs/direction/prototypes/2026-07-28-directions.html`, section E0). A
   record of a changed decision, not a contradiction: where any earlier text
   says octagon, this addendum governs.

## Change control

Any addition to this contract (new motif, new state, new motion pattern) gets recorded here before implementation — Pass 3/4/5 execute this document, they don't extend it silently.
