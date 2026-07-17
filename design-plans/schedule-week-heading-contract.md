# Apply the sanctioned week-heading typography on Schedule

Written against: `de5b8e62d4289610ad83ab31882f9723a78c0628`

## Evidence chain

- Surface: `/schedule`, specifically each rendered `Week of <date>` group above its game-card grid.
- Problem: `frontend/src/pages/Schedule.js:103` renders week headings with `font-display uppercase tracking-tight text-sm text-muted-foreground`, using the 14px body token and muted color instead of the documented week/group-header recipe.
- Design evidence: `CVLeagues_Design_Tokens.md:138` assigns `text-subheading` (16px/1.3, weight 600) to week/date group headers. `CVLeagues_Design_Tokens.md:149-158` defines the exact group-header recipe as `font-display text-subheading uppercase tracking-tight text-foreground` and prohibits raw heading sizes.
- Owner: `frontend/src/pages/Schedule.js` owns week grouping, label generation, and the group heading markup. `frontend/src/components/game/GameCard.js` remains the game-content owner below it.
- Scope and affected surfaces: Schedule week headings only; one class correction applies to every generated week group.
- Uncertainty: none. The documentation names week rows explicitly and provides one exact correction.

## Design decision

Keep the semantic `h2`, grouping, label text, margin, and game grid unchanged. Replace only the heading’s typography/color classes with the exact documented group-header recipe so week boundaries use the sanctioned hierarchy rather than an ad hoc body-size heading.

## Reuse

- `text-subheading` for the documented 16px week/date group scale.
- Exact recipe: `font-display text-subheading uppercase tracking-tight text-foreground`.
- Existing `weekGroups` composition and `GameCard` grid.
- Exemplar: the recipe is binding in `CVLeagues_Design_Tokens.md:157`; no new heading primitive is justified for this page-local generated label.

## Changes

1. `frontend/src/pages/Schedule.js`
   - Change: replace the week `h2` class with `font-display text-subheading uppercase tracking-tight text-foreground mb-2.5`.
   - Preserve: `h2` semantics, `grp.label`, `mb-2.5`, chronological week insertion order, empty-week suppression, section test IDs, card grid classes, and all filtering behavior.
   - Verify: every rendered week label resolves to the exact group-header typography contract and remains visually subordinate to the Schedule page title.

2. `frontend/src/pages/Schedule.test.js`
   - Change: add a focused test using the repository’s existing React DOM/Jest mocking patterns. Supply at least one upcoming game, render Schedule, locate the generated `Week of` heading, and assert it contains `text-subheading` and `text-foreground` while omitting `text-sm` and `text-muted-foreground`.
   - Preserve: avoid a full-page snapshot and do not duplicate selector/filtering unit coverage unrelated to the heading.
   - Verify: the test fails against commit `de5b8e6` for the intended typography classes and passes after the correction.

## Scope

- Inherit: every Schedule week generated from `weekGroups` receives the corrected class.
- Verify: zero, one, and multiple week groups; long localized date labels; upcoming/completed cards; 375px, 768px, and 1280px layouts.
- Exclude: page-title styling, filter styling, week-generation logic, date formatting, card grids, GameCard presentation, motion, copy, and Schedule data behavior.

## Validation

- Product: visit `/schedule`, change filters across states that produce zero, one, and multiple weeks, and confirm grouping and card membership remain unchanged.
- Interface: at 375×812, 768×1024, and 1280×720, confirm week labels use the 16px display group-header role, remain readable, and do not compete with the page title or card content.
- System: confirm the implementation uses the existing `text-subheading` token and exact documented recipe without adding a new component or arbitrary size.
- Repository: `cd frontend && CI=true npm test -- --watchAll=false --runTestsByPath src/pages/Schedule.test.js` → focused test passes.
- Repository: `cd frontend && CI=true npm test -- --watchAll=false` → all suites pass.
- Repository: `cd frontend && npm run build` → production build succeeds.
- Repository: `git diff --check` → no whitespace errors.

## Stop conditions

- Stop if current source no longer renders week labels through `frontend/src/pages/Schedule.js` or if another accepted component becomes their owner.
- Stop if the correction requires changing heading semantics, date copy, grouping, or card layout.
- Stop if implementation overlaps unrelated owner changes in Schedule and cannot preserve them cleanly.

## Design documentation

- After acceptance and validation: none. `CVLeagues_Design_Tokens.md:138,149-158` already records the exact accepted week-header role.
