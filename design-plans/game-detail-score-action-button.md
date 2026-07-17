# Route the Game Detail score action through the shared Button owner

Written against: `de5b8e62d4289610ad83ab31882f9723a78c0628`

## Evidence chain

- Surface: `/game/:id` when `can.enterScores(role)` is true for an admin or the assigned temporary admin.
- Problem: `frontend/src/pages/GameDetail.js:91-100` recreates a primary button inline on a `Link`, including fill, text, typography, spacing, radius, hover, active scale, and `transition-all`, even though the page already imports and uses `Button` at `frontend/src/pages/GameDetail.js:8,55-57`.
- Design evidence: `CVLeagues_Design_Tokens.md:221-235` states that button states are defined once in `components/ui/button.jsx` and must not be recreated inline. `frontend/src/components/ui/button.jsx:7-48` provides the default primary variant and `asChild` composition. Home’s intake actions at `frontend/src/pages/Home.js:196-205` prove the accepted `Button asChild` + `Link` pattern in the current runtime.
- Owner: `frontend/src/components/ui/button.jsx` owns button presentation. `frontend/src/pages/GameDetail.js` owns score-action visibility, route, state payload, copy, and placement.
- Scope and affected surfaces: the conditional Enter Score/Edit Score action on Game Detail only; both admin and assigned-temp-admin states inherit the correction.
- Uncertainty: none. The shared primitive is already imported, supports `asChild`, and expresses the existing primary action without a new variant.

## Design decision

Replace the inline-styled score `Link` with the existing default `Button asChild`, keeping the link as the semantic/navigation owner. Apply only `mt-5 h-11` locally for placement and the documented 44px target; let the shared default variant own fill, text, typography, radius, hover, disabled/focus behavior, and icon sizing. Remove the inline active-scale and `transition-all` behavior rather than recreating motion locally.

## Reuse

- `Button` default variant from `frontend/src/components/ui/button.jsx`.
- `Button asChild` to preserve the existing React Router `Link`, route state, and navigation behavior.
- `h-11` for the documented 44px target and `mt-5` for existing placement.
- Exemplar: `frontend/src/pages/Home.js:196-205` wraps route links with `Button asChild` and keeps only layout-specific classes local.

## Changes

1. `frontend/src/pages/GameDetail.js`
   - Change: wrap the existing `/score-entry` link in `<Button asChild className="mt-5 h-11">`; remove the link’s duplicated visual class string.
   - Change: keep `to="/score-entry"`, `state={{ game_id: game.id }}`, `data-testid="game-enter-score"`, the pencil icon, and conditional `Edit Score`/`Enter Score` copy on the child `Link`.
   - Preserve: `canScore` authorization/display condition, admin and assigned-game temporary-admin rules, score-entry route/state behavior, card placement, completed/upcoming copy, and all surrounding game data.
   - Verify: the rendered anchor receives the default Button classes through Radix Slot, remains 44px high, retains its test ID and route state, and contains no local `transition-all` or active-scale class.

2. `frontend/src/pages/GameDetail.test.js`
   - Change: add focused tests using the repository’s Jest/React DOM/router-mocking conventions for an allowed score-entry role and a disallowed viewer role.
   - Change: in the allowed state, assert the action is an anchor to `/score-entry`, keeps the game ID route state through the mocked Link contract, displays the correct Enter/Edit copy, and inherits the shared default Button class contract without `transition-all` or `active:scale-*`.
   - Change: in the disallowed state, assert `game-enter-score` is absent.
   - Preserve: do not snapshot the complete Game Detail page or retest unrelated box-score rendering.
   - Verify: focused tests fail against the inline implementation for the intended owner/class reason and pass after the composition change.

## Scope

- Inherit: both Enter Score and Edit Score labels, plus admin and assigned temporary-admin visibility states, use the shared default Button owner.
- Verify: upcoming and completed games; admin, assigned temporary admin, unassigned temporary admin, and viewer roles; pointer and keyboard navigation; 375px and 1280px layouts.
- Exclude: `canScore` logic, role permissions, score locking/unlocking, score-entry behavior, route/state shape, back button styling, other Game Detail links, global Button variants, motion tokens, and any admin workflow outside this conditional action.

## Validation

- Product: from an allowed Game Detail state, activate Enter Score/Edit Score and confirm navigation reaches `/score-entry` with the same `game_id`; confirm the action remains absent for disallowed roles.
- Interface: at 375×812 and 1280×720, confirm the action aligns under the metadata, uses the existing primary Button appearance, retains a 44px target, exposes a visible focus ring, and does not introduce layout shift.
- System: confirm `Button` remains the sole presentation owner, the child remains a `Link`, and no parallel CTA class string or new variant is added.
- Repository: `cd frontend && CI=true npm test -- --watchAll=false --runTestsByPath src/pages/GameDetail.test.js` → focused tests pass.
- Repository: `cd frontend && CI=true npm test -- --watchAll=false` → all suites pass.
- Repository: `cd frontend && npm run build` → production build succeeds.
- Repository: `git diff --check` → no whitespace errors.

## Stop conditions

- Stop if `Button asChild` fails to preserve the Link’s `state` payload or ref/keyboard behavior in the installed React Router/Radix versions; report runtime evidence instead of replacing navigation semantics.
- Stop if implementing the visual owner change requires modifying `canScore`, role permissions, score state, locking, or any backend/API behavior.
- Stop if Game Detail has overlapping unrelated edits that cannot be preserved cleanly.

## Design documentation

- After acceptance and validation: none. `CVLeagues_Design_Tokens.md:221-235` already records the accepted shared Button ownership rule.
