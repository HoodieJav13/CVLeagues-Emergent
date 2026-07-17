# 001 — Replace broad and layout-triggering transitions

- **Status**: DONE
- **Commit**: 3f78312
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 7 files, small mechanical class changes

## Problem

High-frequency shared controls and game surfaces transition every animatable property. Two Home section links also animate `gap`, which triggers layout instead of compositor-only work.

```jsx
// frontend/src/components/ui/button.jsx:8 — current
"... transition-all duration-200 ... active:scale-[0.97] ..."

// frontend/src/components/layout/TopBar.js:22 — current
`... transition-all duration-200 active:scale-[0.97] ...`

// frontend/src/components/layout/BottomNav.js:44 — current
`... transition-all duration-200 active:scale-[0.96] ...`

// frontend/src/components/game/GameCard.js:71 — current
`... transition-all duration-200 hover:border-primary/50 hover:-translate-y-1 hover:shadow-card-hover ...`

// frontend/src/pages/Home.js:82 — current
"... transition-all duration-200 hover:border-primary/50 hover:shadow-card-hover"

// frontend/src/pages/Home.js:243,263 — current
"... gap-1 ... hover:gap-2 transition-all"
```

## Target

Use complete literal Tailwind utilities only where transform feedback remains. Keep the owner-approved direct-interaction contract exactly at `200ms ease-out`; do not add the audit's proposed 120–160ms values or custom cubic-bezier curves. Remove positional hover lift from data cards so featured and regular game cards use one stable-position rule, and let their border/shadow hover states update instantly instead of animating paint properties. Move section-link arrows with `transform`, not `gap`.

```jsx
// representative targets
"transition-transform duration-cvf-fast ease-cvf-out"
"hover:border-primary/50 hover:shadow-card-hover"
"group ... gap-1"
"transition-transform duration-cvf-fast ease-cvf-out group-hover:translate-x-1 motion-reduce:transform-none"
```

Shared button and navigation press transforms are too frequent to justify, so remove them with the broad transitions. Logo scaling is decorative and should also be removed, not expanded.

## Repo conventions to follow

- `frontend/tailwind.config.js` owns named design utilities. Add `transitionDuration.cvf-fast: "200ms"`, `transitionDuration.cvf-enter: "300ms"`, and `transitionTimingFunction.cvf-out: "ease-out"` once for all selected plans.
- Existing `duration-200` interactions establish the accepted 200ms value; this plan gives that value a semantic name without changing its feel.
- Keep complete class strings so Tailwind's scanner can generate them in the production build.

## Steps

1. In `frontend/tailwind.config.js`, add the three approved duration/easing names described above; add no other motion token.
2. In `frontend/src/components/ui/button.jsx`, remove `transition-all duration-200` and the shared active-scale animation; keep its visual, disabled, and focus states.
3. Make equivalent removals in `frontend/src/components/layout/TopBar.js` and `frontend/src/components/layout/BottomNav.js`; state colors and indicators remain instant.
4. In `frontend/src/components/game/GameCard.js`, remove the transition and `hover:-translate-y-1` positional lift; retain instant border/shadow hover affordance.
5. In `frontend/src/pages/Home.js`, remove the transition from `ScoreboardFeature`; retain instant border/shadow hover affordance.
6. In both Home section action links, keep a fixed `gap-1`, add `group`, and move only the `ArrowRight` icon with an explicit transform transition; suppress that transform under reduced motion.
7. In `frontend/src/components/brand/Logo.js`, remove the decorative hover scale and its transition classes.

## Boundaries

- Do NOT change routes, component structure beyond wrapping/classing the two existing arrow icons, focus styles, colors, or shadows.
- Do NOT add Framer Motion or another dependency.
- Do NOT introduce 120ms, 160ms, custom cubic-bezier, spring, or stagger values.
- Do NOT touch unrelated `transition-all` consumers outside the audited Home/shared-shell surface.
- If a cited class no longer matches commit `3f78312`, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: `cd frontend && CI=true npm test -- --watchAll=false`; `cd frontend && npm run build`; `rg -n "transition-all|hover:gap-|hover:-translate-y" frontend/src/pages/Home.js frontend/src/components/game/GameCard.js frontend/src/components/layout/TopBar.js frontend/src/components/layout/BottomNav.js frontend/src/components/ui/button.jsx frontend/src/components/brand/Logo.js` returns no selected-surface matches.
- **Feel check**: at 10% playback, hover Home game cards and section links; cards must remain spatially fixed, border/shadow changes must settle together, and arrows must move without shifting adjacent text. Press desktop and mobile navigation; feedback must remain immediate. Under reduced motion, press transforms and arrow translation must disappear while color/state feedback remains.
- **Done when**: every selected surface has an explicit property list, no Home link animates layout, data-card hover behavior is coherent, and the 200ms/ease-out contract is generated in the production build.
