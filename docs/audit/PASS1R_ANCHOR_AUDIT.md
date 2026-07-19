# Pass 1R — Anchor Re-Audit

**Date:** 2026-07-19
**Mode:** Read-only product audit
**Product baseline:** Current public product source is byte-identical to `main` at `65ee435` for the application and frontend build/config surface. Pass 4 Batch 0 has not run.
**Evidence:** [33-frame viewport capture manifest](./pass1r-captures/MANIFEST.md)

## Verdict

**VISUALLY INSUFFICIENT:** The public experience is coherent, usable, responsive, and mostly contract-compliant, but it does not yet consistently clear the amended contract's reference-tier bar. The repeated 16 px rounded-card grammar, small fallback initials, and equal-weight data regions make several surfaces look like a competent sports template rather than a singular CVF broadcast product.

This is not a recommendation for a wholesale redesign. The highest-return work is concentrated: systemize the already-approved structural-line identity, replace the Schedule card grid with a competition register, give achievement data a real hierarchy, and consolidate the two operational forms. The existing color system, typography, state language, navigation, and most data behavior should remain.

No contract conflict was found. Addenda 1–3 explicitly support the bolder proposals below. The World Cup reference was directly accessible, so both required anchors informed the audit.

## Method and comparison rubric

The audit used the four-category vocabulary from Addendum 3:

- **BLOCKING:** prevents trustworthy evaluation or safe use.
- **NON-BLOCKING (noted):** real limitation that should be tracked but does not stop the pass.
- **VISUALLY INSUFFICIENT:** compliant and functional, but still reads as competent template work against the anchors.
- **ALREADY FINE:** clears both the functional and visual bar for its role.

The references are structural anchors, not skins to copy. Apple Sports informed score hierarchy and scan density. The World Cup work informed title scale, data-register rhythm, and focal identity zones. CVF's locked palette, typography, broadcast/culture/cinematic balance, and anti-patterns remain controlling.

### Anchor A — Apple Sports

Sources: [Apple Sports app at a glance](https://support.apple.com/guide/apple-sports-app/apple-sports-app-at-a-glance-apdec6a74b4c/web), [How to use Apple Sports](https://support.apple.com/en-us/116979), and [Apple Sports widgets announcement](https://www.apple.com/newsroom/2025/09/apple-sports-adds-widgets-and-expands-to-eight-new-countries/).

1. **Score/time hierarchy:** the score or start time occupies the strongest central position, roughly 1.3–1.5× the visual weight of team records and supporting metadata.
2. **Continuous score register:** matches are grouped by day/state/league and separated by hairlines; each match is not placed in its own rounded card.
3. **Phone density:** a match row carries two teams, marks, records, and state/score in roughly 95–100 px, allowing several matches to be scanned in one viewport.
4. **Compact state control:** Yesterday/Today/Upcoming uses one small segmented row; the selected state has full contrast while inactive states visibly recede.
5. **Restrained decoration:** team identity and sport structure create recognition; background color and shell decoration remain subordinate to results.

### Anchor B — World Cup 2026, simplified

Source: [World Cup 2026, simplified](https://sheets.works/data-viz/world-cup-2026/index.html).

1. **Decisive title ladder:** page H1s measure about 72–79 px on desktop and 40–48 px on mobile; section headings are about 35 px desktop/24 px mobile; data labels sit near 13 px.
2. **Dense register structure:** standings show four compact group tables across a 1440 px viewport and one stacked table at 390 px. Match schedules use date-grouped rows rather than card-per-match shells.
3. **Structural state encoding:** narrow qualification rails, centered scores, date groups, and explicit totals carry meaning without requiring decorative panels.
4. **Two-speed spacing:** large 80–120 px breathing zones frame compact 40–64 px data rows. Density occurs inside a deliberate page rhythm.
5. **Identity as a focal zone:** custom team/stadium objects receive large, intentional space while surrounding data tables remain quiet.

## Cross-cutting findings

### R1 — Structural identity is approved but absent from current main

**VISUALLY INSUFFICIENT — high confidence.** Home, both Game Detail states, Team, and Profile still rely on shallow color washes and flat square/circular initials. At a cold glance, the recurring ray-line culture motif is not visible. This falls below Addendum 2's visibility floor and leaves the product's identity dependent on headings and teal/gold color alone.

Evidence: [Home desktop hero](./pass1r-captures/home-1440.png), [final Game Detail desktop](./pass1r-captures/game-final-g1-1440.png), [Team desktop identity](./pass1r-captures/team-t1-1440.png), and [Profile desktop identity](./pass1r-captures/profile-p1-1440.png).

**Direction:** systemize the approved structural-line branch, including a reusable fallback identity badge. Use a 64 px badge on mobile and 72 px on desktop, a 2 px octagonal team-color outline, and 24–32 px ray/corner strokes at 2–3 px. The mark must be visible in an unannotated still at 1440 px. Preserve real-photo/logo slots as progressive enhancements; the fallback remains a finished design.

**Effort vs. impact:** five affected surfaces gain one immediately recognizable visual grammar. Expected cost is one shared badge/line primitive plus four page/component integrations and focused tests/CSS: approximately 5–7 files, no new dependency. Existing Pass 3 prototype code reduces implementation uncertainty. **High visual delta / medium cost.**

### R2 — Repeated rounded shells flatten unlike content

**VISUALLY INSUFFICIENT — high confidence.** The same border, radius, fill, and spacing treatment frames matches, statistics, leaderboard rows, identity headers, and form sections. The components are individually clean, but their uniformity conceals which regions are scores, registers, achievements, identities, or operations.

Evidence: [Schedule desktop grid](./pass1r-captures/schedule-1440.png), [Leaderboards desktop](./pass1r-captures/leaderboards-1440.png), [Team stat leaders](./pass1r-captures/team-t1-1440.png), and [Free Agent desktop](./pass1r-captures/free-agent-1440.png).

**Direction:** do not globally remove cards. Introduce three truthful structures: a hairline competition register for repeated games/data, a continuous stat strip for three-item summaries, and a single operational form surface with internal section rules. Retain cards for genuinely self-contained modules.

**Effort vs. impact:** replaces one visual treatment in three high-frequency patterns without changing tokens globally. The proposal set below touches approximately 10–15 existing/shared files across approved batches, no new dependency. **High visual delta / medium cumulative cost.**

### R3 — Responsive mechanics are sound

**ALREADY FINE.** All audited pages reflow cleanly at 390, 768, and 1440 px. Page titles use the corrected 40 px token without problematic 390 px wrapping. Navigation, filters, score blocks, form controls, and tab targets remain usable at phone width. No horizontal clipping was observed in the final capture set.

The mobile concern is therefore scan hierarchy, not breakage. Schedule and leaderboard proposals should preserve the existing touch-target floor and visible focus treatment.

### R4 — State language is clear and should not be redesigned

**ALREADY FINE.** FINAL, UPCOMING, playoff-stage labeling, sport badges, locked/private states, and empty-state explanations use plain, specific language and stable color semantics. The Game Detail final/upcoming distinction remains obvious at all viewports.

Evidence: [final game mobile](./pass1r-captures/game-final-g1-390.png), [upcoming game mobile](./pass1r-captures/game-upcoming-g11-390.png), and [Schedule mobile](./pass1r-captures/schedule-390.png).

Future visual work should strengthen the surrounding hierarchy without inventing new status vocabulary.

## Per-page audit

### Home

**Contract compliance:** The page uses the correct dark broadcast palette, Sandia reference, large title token, clear CTA pair, and meaningful final/upcoming content. **ALREADY FINE** for layout behavior and basic content hierarchy.

**VISUALLY INSUFFICIENT — high confidence:** The shallow rounded hero band and two conventional featured-game cards do not make the approved structural direction visible. In [Home at 1440](./pass1r-captures/home-1440.png), identity is carried mostly by copy and color; the large right half of the hero has no deliberate fallback focal object. At [390 px](./pass1r-captures/home-390.png), the hierarchy survives, but the page could still be a themed template.

**Direction:** apply R1 to the hero and featured modules. The bolder compliant version should let the Sandia/ray geometry occupy roughly the rightmost 35–40% of the desktop hero while collapsing to a 24–32 px corner/edge mark on mobile. Do not add a photo dependency. Cost: Home plus shared structural primitive and tests, about 3–5 files. **High delta / low-to-medium cost**, because the approved prototype already exists.

### Schedule

**Contract compliance:** Filters, sport/status badges, final/upcoming distinction, and playoff tags are correct. Touch targets and wrapping are sound. **ALREADY FINE** for interaction and state language.

**VISUALLY INSUFFICIENT — high confidence:** [Schedule at 1440](./pass1r-captures/schedule-1440.png) is a uniform three-column card grid with only two cards in the visible row, leaving a large unused field and making every match a separate object. [Schedule at 390](./pass1r-captures/schedule-390.png) requires repeated shell scanning. Against both anchors, this is the clearest “competent sports template” region.

**Direction:** introduce a Schedule-specific competition register, not a global GameCard replacement. Use 24 px week/date headings, 72 px desktop rows, 88–96 px phone rows, a centered score/time column, one 1 px separator, and a 4 px gold stage rail only for playoff games. Keep badges as compact metadata and preserve the current accessible targets.

**Effort vs. impact:** Schedule, a new or extended compact match-row component, CSS, and focused tests: approximately 4–6 files, no dependency. The visible change is a full grid-to-register conversion across the page. **Very high delta / medium cost.**

### Game Detail — final

**Contract compliance:** The final score is dominant, FINAL is unambiguous, team ordering is clear, and statistic sections recede appropriately. **ALREADY FINE** for score comprehension.

**VISUALLY INSUFFICIENT — high confidence:** In [the final state at 1440](./pass1r-captures/game-final-g1-1440.png), flat rounded-square initials and a conventional bordered score panel undercut the importance of the event. The page has no cold-visible CVF signature beyond palette.

**Direction:** apply R1's structural badge and event corner geometry. Increase the final score to approximately 56 px desktop/44 px mobile, retain team names near the current scale, and frame the result with a 2 px structural line rather than another heavier filled card. Cost: Game Detail plus shared identity/line primitives and tests, approximately 3–4 files. **High delta / low-to-medium cost.**

### Game Detail — upcoming

**Contract compliance:** Date, time, location, and upcoming state are readable without implying a result. **ALREADY FINE** for semantic state.

**VISUALLY INSUFFICIENT — high confidence:** [The upcoming state at 1440](./pass1r-captures/game-upcoming-g11-1440.png) leaves a large neutral lower field and gives a future event little visual gravity. The same flat initials make it feel like an unfinished version of the final card rather than a deliberate pre-game state.

**Direction:** reuse the same R1 event frame, but let time/date replace score as the central 44–48 px focal value and keep UPCOMING explicitly visible. No speculative countdown or motion dependency is justified. The cost is included in the final-state integration. **High delta / negligible incremental cost.**

### Standings

**Contract compliance:** The table is legible, ranks are explicit, the leading row is signaled, and horizontal overflow is avoided at 390 px. **ALREADY FINE** for data correctness and mobile mechanics.

**VISUALLY INSUFFICIENT — high confidence:** [Standings at 1440](./pass1r-captures/standings-1440.png) places a small league label and one conventional table inside a large page field. Compared with the World Cup anchor, the competition identity, rank structure, and playoff consequence are too quiet. The small color dot is insufficient team identity.

**Direction:** retain a dense table but turn it into a competition register: increase the league heading to 24 px, use approximately 56 px rows, replace 10 px dots with 24–28 px fallback team marks, use a 4 px meaningful seed/qualification rail, and place the playoff rule or destination in the table heading. Add clinched/eliminated treatment only when real data exposes those states.

**Effort vs. impact:** Standings plus shared small identity mark and tests/CSS: approximately 3–4 files, no dependency. **Medium-high delta / medium cost.**

### Playoffs

**NON-BLOCKING (noted):** The mock seed exposes only the empty public bracket state. [The empty state at 1440](./pass1r-captures/playoffs-1440.png) and [390](./pass1r-captures/playoffs-390.png) are trustworthy, but a populated bracket cannot be judged in this pass. The populated state must receive a focused audit when a bracket fixture is available in its approved batch.

**VISUALLY INSUFFICIENT — medium-high confidence:** The reachable empty state uses a generic trophy symbol in a large blank field. It communicates absence correctly but contributes no bracket grammar or CVF identity.

**Direction:** replace the generic focal icon with a non-data bracket silhouette built from the structural-line system: about 220 × 120 px desktop and 180 × 100 px mobile, using teal/gold rails without teams or fake outcomes. Keep the current plain explanation and CTA. Cost: Playoffs/EmptyState integration plus one small graphic primitive and test, approximately 2–3 files, no dependency. **Medium delta / low cost.**

### Leaderboards

**Contract compliance:** Scope, season, sport, and statistic controls are explicit; rank order and values are understandable; the list works at phone width. **ALREADY FINE** for function.

**VISUALLY INSUFFICIENT — high confidence:** In [Leaderboards at 1440](./pass1r-captures/leaderboards-1440.png), the top three achievements use nearly equal row weight and small medal glyphs. Filter controls occupy comparable visual emphasis to the result. [At 390](./pass1r-captures/leaderboards-390.png), the page remains readable but the winner does not become the scan anchor.

**Direction:** use a podium/list hybrid without introducing a separate decorative podium: rank 1 at approximately 96 px with a 40 px score and 48 px identity mark; ranks 2–3 at approximately 76 px with 32 px scores; rank 4 onward at approximately 64 px. Encode gold/silver/bronze with meaningful 4 px rails, not glows.

**Effort vs. impact:** Leaderboards plus a shared ranked-row component and focused tests/CSS: approximately 3–4 files, no dependency. **High delta / low-to-medium cost.**

### Team

**Contract compliance:** Record, captain, stat leaders, roster, and game sections are well ordered. The roster list itself is dense and useful. **ALREADY FINE** for the roster and content sequence.

**VISUALLY INSUFFICIENT — high confidence:** [Team at 1440](./pass1r-captures/team-t1-1440.png) uses a flat 64 px initial tile and three separate rounded stat cards. It does not provide the fallback-first team identity focal zone required by the amended direction. [At 390](./pass1r-captures/team-t1-390.png), stacked stat shells add length without adding hierarchy.

**Direction:** apply R1's 72/64 px structural team badge and convert the three summary stats into one continuous three-cell strip with internal 1 px rules. Preserve the existing roster and game-card sections until their own approved pattern is systemized.

**Effort vs. impact:** Team plus shared badge/stat-strip component and tests, approximately 2–4 files beyond R1. **High delta / low incremental cost.**

### Profile

**Contract compliance:** Public/private boundaries, sport tabs, teams, and available statistics are clear. Locked content looks intentionally unavailable. **ALREADY FINE** for information architecture and privacy state.

**VISUALLY INSUFFICIENT — high confidence:** [Profile at 1440](./pass1r-captures/profile-p1-1440.png) relies on a conventional circular initial avatar, tab strip, and three equal stat boxes. It does not treat the athlete as the focal identity. The result is visually interchangeable with a generic profile dashboard.

**Direction:** extend R1 with a 72/64 px athlete fallback badge and structural ray edge; keep the athlete name at the 40 px page scale and replace the equal stat boxes with the same continuous summary strip used by Team. Real photography may later replace the fallback in its designated slot without altering layout.

**Effort vs. impact:** Profile plus the shared badge/stat-strip and tests, approximately 2–4 files beyond R1. **High delta / low incremental cost.**

### Team Interest form

**Contract compliance:** This is an operational intake surface, so its restrained treatment is correct. Labels, errors, consent, and targets are clear. No cinematic treatment is warranted. **ALREADY FINE** for usability and the public/operational split.

**VISUALLY INSUFFICIENT — medium confidence:** [Team Interest at 1440](./pass1r-captures/team-interest-1440.png) stacks multiple independent 16 px rounded cards in a narrow column. The repeated shells read as component-library defaults and make the desktop journey longer than its information structure requires.

**Direction:** use one 680–720 px continuous form surface with truthful numbered sections (01 Contact, 02 Team, 03 Consent), 1 px internal separators, 32 px desktop section gaps, and 24 px mobile gaps. A 2 px teal section rail may identify the active/current section, but no culture texture or cinematic imagery should enter the form.

**Effort vs. impact:** Team Registration, a shared form-section primitive, CSS, and tests: approximately 2–3 files before reuse. **Medium delta / low-to-medium cost.**

### Free Agent form

**Contract compliance:** Field grouping, availability choices, consent, and submission action are explicit and touch-friendly. **ALREADY FINE** for form mechanics.

**VISUALLY INSUFFICIENT — medium confidence:** [Free Agent at 1440](./pass1r-captures/free-agent-1440.png) repeats the same stack of disconnected rounded shells as Team Interest. The larger number of sections makes the template effect more visible and extends the vertical journey.

**Direction:** reuse the Team Interest continuous operational shell with numbered sections (01 Contact, 02 Sport & Availability, 03 Player Notes, 04 Consent). Keep selection chips and controls unchanged unless later usability testing identifies a problem.

**Effort vs. impact:** Free Agent integration and tests after the shared primitive: approximately 1–2 incremental files, no dependency. **Medium delta / low incremental cost.**

## Consolidated proposals ranked by visual return per implementation cost

| Rank | Proposal | Concrete visual delta | Estimated implementation surface | Return / cost |
| --- | --- | --- | --- | --- |
| 1 | Systemize structural identity across Home, Game Detail, Team, Profile | Flat 48–64 px initials and invisible motif → 64/72 px octagonal fallback badges, 2 px outlines, 24–32 px cold-visible ray marks | 1 shared primitive + 4 integrations + tests/CSS; ~5–7 files; no dependency; prototype exists | Very high / medium |
| 2 | Convert Schedule to a competition register | Repeated three-column 16 px cards → 72 px desktop and 88–96 px mobile rows with centered score/time, 1 px rules, 4 px playoff rail | Schedule + row primitive + tests/CSS; ~4–6 files; no dependency | Very high / medium |
| 3 | Give Leaderboards a ranked achievement hierarchy | Nearly equal top-three rows → 96/76/76 px hierarchy, 40/32 px values, 4 px medal rails | Page + ranked-row primitive + tests/CSS; ~3–4 files | High / low-medium |
| 4 | Convert Team/Profile summary cards to one stat strip | Three equal rounded cards → one continuous three-cell strip with internal rules | Shared strip + 2 integrations/tests; ~3–4 files | High / low |
| 5 | Strengthen the Standings register | Small league label/10 px dots → 24 px heading, 24–28 px marks, 56 px rows, 4 px meaningful rank rail | Page + shared small mark/tests; ~3–4 files | Medium-high / medium |
| 6 | Consolidate both public forms | Three-to-five independent rounded shells → one 680–720 px surface with numbered sections and internal rules | Shared form section + 2 page integrations/tests; ~3–5 files | Medium / low-medium |
| 7 | Give the Playoffs empty state bracket grammar | Generic trophy → 220 × 120 / 180 × 100 structural bracket silhouette | Small primitive + page/test; ~2–3 files | Medium / low |

High-cost/marginal-delta work was intentionally excluded. Specifically, there is no recommendation for a new animation library, real-photo dependency, global token rewrite, navigation redesign, generic card-radius sweep, or decorative redesign of functional roster/form controls.

## Proposed revised Pass 4 batch plan

The approved order remains **systemize → Standings/Leaderboards → Team/Profile → Playoffs → forms**. The contents below fold the re-audit findings into that sequence rather than creating a parallel roadmap.

### Batch 0 — Cleanup, systemize, and complete the approved spectator slice

1. Preserve cleanup objectives already assigned to Batch 0.
2. Promote the structural-line Pass 3 primitives into shared production components: fallback identity badge, meaningful ray/corner line, and continuous stat strip.
3. Apply the approved structural base to Home and both Game Detail states.
4. Add the Schedule competition register as the one newly proposed vertical-slice amendment from Pass 1R.
5. Verify 390/768/1440, keyboard focus, reduced-motion equivalence, state language, and final/upcoming parity before the batch gate.

**Owner gate:** approve the Schedule grid-to-register change before implementation because it is a substantive new direction, not merely systemization of the selected Pass 3 branch.

### Batch 1 — Standings and Leaderboards

1. Add the stronger Standings competition register, small structural team marks, and meaningful playoff/seed rail.
2. Add the Leaderboards ranked-row hierarchy and medal rails.
3. Reuse Batch 0 primitives; do not introduce a second identity system.

### Batch 2 — Team and Profile

1. Extend the structural identity badge exactly as locked by Addendum 1.
2. Reuse the Batch 0 stat strip for summary metrics.
3. Preserve roster, privacy, and tab behavior unless separate evidence identifies a problem.

### Batch 3 — Playoffs

1. Replace the empty-state trophy with a structural bracket silhouette.
2. Create or use an approved local populated-bracket fixture.
3. Re-audit the real bracket at all three viewports before implementing populated-state visual changes. This is a focused state check, not another full-surface audit.

### Batch 4 — Team Interest and Free Agent forms

1. Create one restrained operational form shell and numbered section primitive.
2. Apply it to both forms without cinematic treatment or data-flow changes.
3. Re-run full validation, keyboard, abuse-protection, and submission-state checks because visual consolidation must not alter intake behavior.

## Limitations and falsified hypotheses

- **NON-BLOCKING (noted):** only the Playoffs empty state was reachable from the current mock seed; the populated bracket remains deliberately unjudged.
- **ALREADY FINE:** the prior full-page duplication report was a capture/stitching artifact, not a rendering defect. This pass used viewport-only captures and found no repeated page regions.
- **ALREADY FINE:** title-token hierarchy, state language, core responsive reflow, touch-target sizing, and the public/operational distinction do not justify redesign.
- **Falsified:** the entire interface does not need more cards, color, photography, or cinematic motion. Those additions would raise implementation cost without fixing the structural gaps identified here.

## Read-only proof

- Product source, tokens, styles, config, schema, and tests were not edited.
- New evidence is limited to `docs/audit/PASS1R_ANCHOR_AUDIT.md` and `docs/audit/pass1r-captures/`.
- The final capture set contains 33 viewport-only PNGs: 11 per viewport.
- Hosted Supabase was untouched; local runtime used mock-only data and recorded no Supabase requests.
- No implementation, merge, staging, commit, or Pass 4 work occurred.
