# A clearer, more resilient, motion-ready CVF Home

Written against: `3f783127ce77bd90ec9c6280dbdfb41c6e2aa640`

## Implementation record — 2026-07-16

- Gates 1–3 completed under the owner's approval to run the full sequence.
- Hierarchy: the shell is the sole identity owner; Home uses `Current Leagues`; desktop has one two-action CTA group and mobile retains the single Join disclosure.
- Resilience: one/two/multi game grids are count-aware; compact team names use readable Inter casing/wrapping across Home, Schedule, and Team detail.
- Motion: the `improve-animations` audit produced four plans in `plans/`; all four are complete. Whole-page Home motion, layout-triggering hover motion, decorative logo/card lift, and shared high-frequency press scaling were removed. Filter replacement uses a 200ms opacity transition; Join caret rotation communicates Radix open state.
- Accessibility: native filter label associations, explicit mobile button type, keyboard Escape/focus return, and specificity-safe reduced-motion overrides were verified in the rendered app.
- Evidence: focused UI tests passed; complete frontend suite passed 11/11 suites and 42/42 tests; production build compiled successfully; changed-files React Doctor scored 97/100 with one pre-existing shadcn export warning.
- Review decision: `review-animations` suggestions for 120–160ms timings and custom cubic-bezier curves were not adopted because they would broaden the approved 200ms/300ms/`ease-out` contract. High-frequency press motion was deleted instead.
- Commit: pending owner checkpoint; no commit, push, PR, deployment, hosted write, or data change was performed.

## Evidence chain

- Surface: public `/` route rendered through `frontend/src/components/layout/AppLayout.js` at 375px and 1280px, including the global logo, mobile Join bar, Home hero, featured scoreboard, filters, game lists, CTA cards, and bottom navigation.
- Problem: the first screen repeats the global identity and the same conversion routes; sparse game states collapse into narrow left-aligned cards with large unused regions; long team names are forced into condensed uppercase single-line truncation; and the motion layer is composed of generic whole-page entrances and `transition-all` while its reduced-motion promise is not honored.
- Design evidence: `CVLeagues_Design_Tokens.md` sections 3–6; `frontend/src/index.css`; `frontend/tailwind.config.js`; `frontend/src/pages/Home.js`; `frontend/src/components/game/GameCard.js`; `frontend/src/components/brand/Logo.js`; `frontend/src/components/layout/MobileJoinBar.js`; `frontend/src/components/layout/TopBar.js`; `frontend/src/components/layout/BottomNav.js`; and `frontend/src/components/ui/button.jsx`.
- Owner: `frontend/src/pages/Home.js` owns Home composition; `Logo.js` owns global identity; `MobileJoinBar.js` owns mobile conversion; `GameCard.js` owns shared game presentation; `index.css` and `tailwind.config.js` own global visual and motion tokens.
- Scope and affected surfaces: Home is the primary implementation surface. Shared `GameCard` changes inherit into `/schedule` and `/team/:id`. Reduced-motion corrections inherit into every page using `.animate-fade-up` or `.animate-fade-in`; `PopoverContent` corrections inherit into all Radix popovers.
- Uncertainty: no analytics currently prove whether repeated CTAs increase conversion. This roadmap therefore preserves both intake routes and one conversion presentation per breakpoint while removing only same-screen duplication.

## Design decision

Treat the global shell as the sole owner of CVF identity, the mobile Join bar as the sole mobile conversion owner, and the Home hero as a league-oriented content header. Preserve one desktop CTA group in the hero and remove the duplicated lower CTA cards.

Make Home game layouts respond to item count and make compact team data readable before decorative: Inter semibold, normal casing, and wrapping for team names in scoreboard/list contexts; Oswald remains the display voice for page and section titles, score figures, and detail-page team identity.

Replace the generic motion layer with a small contract derived from values already present in the repository: 200ms for direct interaction feedback, 300ms for local content entrances, and `ease-out`. Whole-page Home entrance motion is removed. Motion is attached to state change, navigation feedback, popover disclosure, and card affordance. Reduced-motion users receive instant entrances and no nonessential transform motion.

This is one roadmap with three sequential implementation stages. Each stage must pass its gate before the next begins.

## Reuse

- `Logo` remains the global identity owner; do not create another brand primitive.
- `MobileJoinBar` remains the mobile conversion owner and keeps both existing intake routes.
- `Button` and `buttonVariants` own desktop CTA visual states; use `Button asChild` for Home links instead of recreating button classes.
- `SectionHeading`, `SportBadge`, `StatusBadge`, `EmptyState`, and the existing winner/loser/status semantics remain intact.
- `GameCard` remains the shared game presentation owner; add no parallel Home-only game-card component.
- Existing motion values to formalize: `duration-200`, `.animate-fade-in` at 300ms, and `ease-out`.
- Typography exemplar for compact team data: the Inter `font-medium` team rows in `frontend/src/pages/Playoffs.js`; display identity remains exemplified by `frontend/src/pages/TeamPage.js`.
- Existing disclosure motion: Radix `PopoverContent` with `tailwindcss-animate`; preserve it and add reduced-motion handling.
- Existing dependency: `framer-motion` is installed but unused. Do not introduce it in this roadmap unless the motion-opportunity stage proves that CSS/Radix cannot express an approved transition and the owner approves the added runtime ownership.

No new visual primitive is required for hierarchy or game layout. Named Tailwind motion values are justified because the current system has repeated durations but no shared semantic motion contract, which is the root of the `transition-all` and reduced-motion drift.

## Roadmap and skill sequence

### Stage 1 — Clarify identity and conversion hierarchy

Objective: make the first screen about leagues and games while retaining one clear conversion path per breakpoint.

Skills:

- `improve-ui`: governing evidence and scope; already installed and complete for audit/planning.
- `emil-design-eng`: optional review-only challenge pass after the Stage 1 composition is rendered, before owner acceptance. It may question hierarchy and taste, but it does not override CVF route, status, contrast, or accessibility requirements.
- Existing `shadcn` guidance: use only to verify correct `Button asChild` and Popover composition. No additional shadcn skill installation is needed.

Gate: rendered 375px and 1280px Home shows one identity owner and one conversion presentation per breakpoint, with both intake routes still reachable.

### Stage 2 — Make game content resilient to count and name length

Objective: make zero-, one-, two-, three-, and four-game states look intentional and preserve readable team names.

Skills:

- Existing `vercel-react-best-practices` or `build-web-apps:react-best-practices`: review React composition after the Home and `GameCard` edits; no duplicate install is needed.
- `react-doctor`: install/use after Stage 2 implementation, not before the design is settled. It is a diagnostic gate, not a visual authority.
- `emil-design-eng`: optional second review if the typography-role change appears too neutral after rendering.

Gate: Home, Schedule, and Team detail render long-name and sparse-count fixtures at 375px, 768px, and 1280px without forced one-line name loss or accidental card-density changes.

### Stage 3 — Establish and apply the motion contract

Objective: repair reduced-motion behavior first, then add purposeful motion to the stable structure.

Skills, in order:

1. `emil-design-eng`: confirm the interaction hierarchy worth animating.
2. `find-animation-opportunities`: identify opportunities and explicitly reject decorative motion without state or hierarchy value.
3. `improve-animations`: audit the selected Home/navigation/card motions against the rendered implementation.
4. `fixing-accessibility`: verify reduced motion, focus visibility, keyboard operation, contrast, and motion-triggered readability before acceptance.
5. `review-animations`: review the final diff after implementation and before the stage gate.
6. `react-doctor` plus existing React best-practices review: final code-health pass after motion-related React changes.

Guidance precedence when motion skills disagree:

1. Owner-approved CVF roadmap and accessibility floor.
2. Runtime evidence on the selected surface.
3. The local motion contract in this plan.
4. `review-animations` for diff-specific correctness.
5. Broader animation principles as review input only.

Do not make `make-interfaces-feel-better` and `12-principles-of-animation` simultaneous governing skills: their stagger and easing advice can conflict with each other and with Emil's UI-specific guidance. If installed later, use them only as a single bounded critique after the local contract exists.

Gate: normal-motion rendering communicates filter updates and interactive affordances without delaying task completion; reduced-motion rendering reports no Home entrance animation and no nonessential transform animation.

### Stage 4 — Full verification and owner checkpoint

Skills:

- Existing `frontend-testing-debugging` and `agent-browser`: rendered verification and breakpoint/state matrix.
- `fixing-accessibility`: final interface pass.
- `react-doctor` and existing React best practices: final React diagnostics.

`playwright-cli` is not needed for this roadmap because `agent-browser` already provides viewport, media-emulation, interaction, and screenshot coverage. Add Playwright only if the owner separately approves creating a durable cross-browser E2E suite. Do not add Vitest—the project uses CRA/Jest. Do not add pnpm—the repository currently uses its established npm test/build commands and declares Yarn metadata; a package-manager migration is unrelated to this visual stage.

## Changes

1. `frontend/src/pages/Home.js` — Stage 1 hierarchy
   - Change: remove the Home-local logo image and the repeated `CVF Sports` title. Promote the existing phrase `Current Leagues` to the Home `h1`; retain `Albuquerque, NM` as supporting location copy and keep the Sandia background treatment.
   - Change: render the two hero intake links only on desktop using a `hidden md:flex` wrapper and existing `Button asChild` variants.
   - Change: remove the lower two CTA cards and their now-unused background asset imports. The routes `/register-team` and `/free-agent-signup` remain unchanged and reachable through desktop hero actions and the mobile Join bar.
   - Preserve: Sandia imagery, teal primary action, outline secondary action, route destinations, featured scoreboard order, filters, game lists, and empty states.
   - Verify: Home itself contains no repeated `CVF Sports` wordmark; mobile contains one Join control and no duplicate hero/lower intake actions; desktop contains exactly one two-action CTA group.

2. `frontend/src/components/brand/Logo.js` and `frontend/src/components/layout/MobileJoinBar.js` — Stage 1 owners
   - Change: none. Treat these as retained owners and verification surfaces.
   - Preserve: global link to `/`, logo asset, Albuquerque subline, sticky mobile placement, popover disclosure, 44px target, hidden-route behavior, and both intake links.
   - Verify: logo/location remain visible in the shell and the mobile popover remains keyboard-operable.

3. `frontend/src/pages/Home.js` — Stage 2 count-aware layout
   - Change: compute the featured count from `latestFinal` and `nextUp`. Use complete literal class strings so Tailwind can detect them: one featured item uses a one-column full-width section; two use `md:grid-cols-2`.
   - Change: add a Home-local grid-class helper with complete class literals. Zero games retains the full-width `EmptyState`; one game uses one column and an intentional wider single-card treatment; two use `sm:grid-cols-2`; three or four use `sm:grid-cols-2 lg:grid-cols-3`.
   - Change: for a lone regular game, constrain the card row to an intentional readable measure (`max-w-2xl w-full`) rather than leaving a one-third card against a full-width section. Keep it left-aligned with the section heading.
   - Preserve: sorting, filtering, four-item slice, latest-final/next-up selection, game links, and all data behavior.
   - Verify: 0/1/2/3/4-game fixtures create stable, intentional grids; no runtime-computed Tailwind fragments are used.

4. `frontend/src/pages/Home.js` and `frontend/src/components/game/GameCard.js` — Stage 2 typography
   - Change: change `ScoreboardLine` and `TeamLine` names from `font-display uppercase ... truncate` to the body family with semibold emphasis, normal casing, `leading-snug`, `whitespace-normal`, and `break-words`.
   - Change: allow team names to wrap instead of forcing a single-line ellipsis. Keep score figures non-shrinking and tabular so wrapping cannot displace score alignment.
   - Preserve: winner/loser colors and weight, the 3px winner bar, team-color dot, scores, status/sport badges, card radius, border accents, metadata, and detail-page display typography.
   - Verify: long names remain readable in featured and regular cards; ordinary names do not increase card height unnecessarily; completed-game winner/loser hierarchy remains obvious.

5. `frontend/src/pages/Schedule.js` and `frontend/src/pages/TeamPage.js` — Stage 2 inherited verification
   - Change: none. Treat both routes as inherited verification surfaces; stop the stage if the shared wrapping behavior exposes a local collision.
   - Preserve: schedule week grouping, filters, team roster/content order, and existing grid breakpoints.
   - Verify: shared `GameCard` typography fits these consumers at 375px, 768px, and 1280px with upcoming, completed, playoff, and long-location fixtures.

6. `frontend/tailwind.config.js` — Stage 3 motion tokens
   - Change: add `cvf-fast` for the repository's existing 200ms interaction value, `cvf-enter` for its existing 300ms entrance value, and `cvf-out` for `ease-out`; do not introduce additional duration or easing values in this stage.
   - Preserve: existing accordion animation values and `tailwindcss-animate`.
   - Verify: generated utilities are present in the production build and all selected consumers use named values instead of new arbitrary timings.

7. `frontend/src/index.css` — Stage 3 reduced motion and entrances
   - Change: keep `cvf-fade-in` as the 300ms local content entrance. Remove Home's dependency on the 500ms whole-page `cvf-fade-up`; do not delete `.animate-fade-up` until other routes receive a separate migration.
   - Change: expand the existing `prefers-reduced-motion: reduce` block so `.animate-fade-up`, `.animate-fade-in`, and `.cvf-status-pulse` have no animation and delay utilities resolve to zero delay.
   - Preserve: shimmer behavior; it is outside the traced Home surface for this roadmap.
   - Verify: media emulation returns `animation-name: none` for Home local entrances and the live pulse under reduced motion.

8. `frontend/src/pages/Home.js` — Stage 3 purposeful motion
   - Change: remove `animate-fade-up` from the Home root.
   - Change: key the upcoming and recent result grids from the active `sport` and `league_id` values and apply the named 300ms fade-in locally so motion communicates a filter-result replacement rather than every page visit.
   - Change: replace remaining `transition-all` on Home links/features with explicit transition properties and the named 200ms/ease-out utilities.
   - Preserve: immediate filter control response, focus location, route behavior, and content order.
   - Verify: changing a filter produces one brief result transition; initial controls never wait for an entrance; rapid filter changes do not queue animations.

9. `frontend/src/components/game/GameCard.js`, `frontend/src/components/layout/TopBar.js`, `frontend/src/components/layout/BottomNav.js`, `frontend/src/components/brand/Logo.js`, and `frontend/src/components/ui/button.jsx` — Stage 3 interaction motion
   - Change: replace `transition-all` with explicit properties appropriate to each owner: transform/border/shadow for cards; color/background/transform for navigation and buttons; transform only for the logo mark.
   - Change: use the named 200ms/ease-out utilities and add `motion-reduce:transform-none` or `motion-reduce:transition-none` where a nonessential scale/lift remains.
   - Preserve: current hover lift, active press feedback, focus rings, selected navigation indicators, and card elevation. Record any contrary `review-animations` recommendation for a separate owner decision.
   - Verify: no selected consumer retains `transition-all`; keyboard focus is unaffected; hover-only transforms do not run under reduced motion.

10. `frontend/src/components/ui/popover.jsx` — Stage 3 disclosure motion
    - Change: add `motion-reduce:animate-none` to `PopoverContent` so the mobile Join disclosure becomes instant under reduced motion.
    - Preserve: Radix positioning, portal behavior, open/closed state animations for normal motion, focus management, and all existing consumers.
    - Verify: Join popover opens/closes normally with keyboard and pointer in both media modes.

11. `frontend/src/pages/Home.test.js` and `frontend/src/components/game/GameCard.test.js` — regression coverage
    - Change: add focused Jest/DOM tests using the repository's existing `createRoot`, mocked `useApp`, and router-mocking pattern.
    - Change: cover the promoted `Current Leagues` heading, absence of Home-local wordmark duplication, one occurrence of each Home desktop intake route, single/two/multi featured and list structures, long team-name rendering, and preserved winner/loser semantics.
    - Preserve: tests remain functional/structural; do not snapshot the entire page or assert every Tailwind class.
    - Verify: the focused tests fail against the current implementation for the intended reasons and pass after each stage.

12. `CVLeagues_Design_Tokens.md` — documentation after acceptance only
    - Change: update the display/body typography roles so compact scoreboard/list team names use Inter while detail-page identity and score figures retain Oswald.
    - Change: document the count-aware Home game presentation and the named 200ms/300ms/ease-out motion contract.
    - Change: retain and clarify the reduced-motion rule: page/local entrances and nonessential transforms become instant; focus and state changes remain visible.
    - Preserve: palette semantics, contrast measurements, radius/elevation, winner/loser, badge, and 44px target rules.
    - Verify: documentation describes the accepted implementation and contains no stale claim that all team names use the display face.

## Scope

- Inherit: `GameCard` typography reaches Home, Schedule, and Team detail. Motion-token and reduced-motion changes reach all consumers of the named utilities and global entrance classes. Popover reduced-motion behavior reaches every `PopoverContent` consumer.
- Verify: `/`, `/schedule`, `/team/:id`, `/game/:id`, mobile Join disclosure, desktop top navigation, mobile bottom navigation, buttons, playoff/stage banners, completed winner/loser cards, and empty states.
- Exclude: palette replacement; database or API changes; routes; state/data shape; authentication; admin workflows; payments; RLS; intake behavior; new analytics; new animation dependencies; global migration of every page entrance; redesign of Schedule or Team detail; and any unrelated dirty-worktree files.

## Stage gates

### Gate 1 — hierarchy

- Objective: one identity owner and one conversion presentation per breakpoint.
- Findings addressed: audit finding 1.
- Affected systems: Home composition, global Logo, mobile Join ownership, Button reuse.
- Required evidence: 375px and 1280px renders; both intake routes; keyboard traversal; exact CTA occurrence count.
- Owner decision: accepting this roadmap accepts `Current Leagues` as the Home `h1`, desktop-only hero CTAs, and removal of the lower CTA cards.

### Gate 2 — resilient game presentation

- Objective: intentional sparse layouts and readable compact team data.
- Findings addressed: audit finding 2.
- Affected systems: Home grids, shared `GameCard`, typography documentation.
- Required evidence: 0/1/2/3/4 games, long names, completed/upcoming/playoff states, 375/768/1280 renders, focused Jest tests.
- Owner decision: accepting this roadmap accepts Inter normal-case team names in compact cards while retaining Oswald for display identity and scores.

### Gate 3 — motion foundation and opportunities

- Objective: truthful reduced-motion behavior and purposeful motion on stable layouts.
- Findings addressed: audit finding 3.
- Affected systems: CSS/Tailwind motion contract, Home results, shared cards/navigation/buttons/popovers.
- Required evidence: normal/reduced media emulation, keyboard/pointer interaction, no selected `transition-all`, animation-review output, accessibility review.
- Owner decision: any recommendation from the upcoming motion skills that changes the 200ms/300ms/ease-out baseline or introduces Framer Motion requires a new explicit checkpoint.

Do not begin the next gate merely because code is ready. Report the gate's diff, verification results, remaining risks, rollback, and unrelated-file status, then wait for owner approval as required by `AGENTS.md`.

## Validation

- Product: open `/`; confirm the shell carries the CVF identity, Home begins with `Current Leagues`, the next meaningful game content arrives earlier, and both team-interest/free-agent routes remain reachable once per breakpoint.
- Interface:
  - Viewports: 375×812, 768×1024, and 1280×720.
  - Data states: no games, one upcoming, one final, both featured games, two games, three games, four games, long team names, long location, completed tie, winner/loser, and playoff stage.
  - Interactions: sport filter, league filter, game-card link, desktop CTAs, mobile Join popover, top navigation, bottom navigation, keyboard focus, pointer hover, rapid filter switching.
  - Media: normal motion and `prefers-reduced-motion: reduce`.
- System: confirm Logo, MobileJoinBar, Button, GameCard, badges, and SectionHeading remain the sole relevant owners; confirm no parallel Home-only card/button primitive is introduced; confirm shared `GameCard` consumers remain coherent.
- Repository: `cd frontend && CI=true npm test -- --watchAll=false` → all Jest tests pass without watch mode.
- Repository: `cd frontend && npm run build` → production build completes without Tailwind class loss, unused-import failure, or environment validation regression.
- Repository: `git diff --check` → no whitespace errors.
- Repository: `git status --short` → only owner-approved UI stage files plus the pre-existing unrelated changes are present.
- Browser: use existing `agent-browser` verification to capture each required viewport/state and to confirm computed reduced-motion styles; no new browser dependency is required.
- Skills: run the motion/accessibility/React review skills at the stage points above and record actionable findings, rejected suggestions, and owner decisions in the stage report.

Database tests are not required for this display-only roadmap because no schema, Auth, RLS, API, or persistence behavior is in scope. If implementation crosses that boundary, stop and re-scope before running or modifying database work.

## Risks and rollback

- Conversion risk: fewer repeated CTAs could reduce repeated exposure. Mitigation: preserve both routes, the desktop hero group, and sticky mobile Join; verify route reachability. Rollback: restore only the lower CTA section without restoring the duplicate Home identity.
- Shared-component risk: team-name wrapping changes Schedule and Team detail cards. Mitigation: treat both as inherited verification surfaces. Rollback: add a proven `namePresentation` variant to `GameCard` only if those consumers demonstrably require different compact behavior; do not fork the component.
- Density risk: a lone full-width featured card or constrained lone regular card may feel oversized. Mitigation: verify exact count states at 768px and 1280px. Rollback: adjust only the Home count-aware wrapper while preserving readable typography.
- Motion risk: global reduced-motion corrections affect every page entrance and shared popover. Mitigation: run media emulation across representative public/admin routes. Rollback: revert only the normal-motion opportunity classes; do not restore a verified reduced-motion contract violation.
- Tailwind risk: dynamically assembled class fragments may be omitted from production CSS. Mitigation: use complete literal class strings and verify the production build.
- Scope risk: broad design skills may propose palette, architecture, or product-flow changes beyond these three findings. Mitigation: record those as separate proposals; do not absorb them into this stage without a new owner checkpoint.

## Stop conditions

- Stop if the owner does not accept the single-owner identity/conversion model or wants different hero copy/content.
- Stop if rendered evidence shows that removing the lower CTA cards makes either intake route materially undiscoverable at a required breakpoint.
- Stop if shared `GameCard` wrapping creates a collision in Schedule, Team detail, completed-score, or playoff-stage states that cannot be corrected inside the existing component owner.
- Stop if a motion skill recommends new timing/easing values, orchestration, or Framer Motion; present that recommendation and obtain owner approval before changing the local contract.
- Stop if any stage requires data-shape, route, backend, authentication, analytics, or hosted-service changes.
- Stop if an implementation file overlaps an unrelated owner change that cannot be preserved cleanly.

## Owner actions and decisions

- Approve Gate 1 before implementation begins.
- Review rendered evidence at the end of each gate and explicitly approve progression.
- Decide separately on any skill recommendation that broadens palette, typography beyond the compact team-name role, or motion beyond the named baseline.
- Provide no secrets, hosted changes, billing actions, or account actions for this roadmap.

## Design documentation

- After each gate is accepted and validated, update `CVLeagues_Design_Tokens.md` with the final accepted hierarchy, compact team-name typography role, count-aware Home layout, and motion contract.
- Record the completed visual milestone, evidence, date, and eventual commit hash in the repository roadmap documentation and Notion roadmap when available, following the owner checkpoint rules.
