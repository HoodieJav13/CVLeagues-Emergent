# 006 — Normalize shared disclosure motion

- **Status**: DONE
- **Commit**: b20e419
- **Severity**: HIGH
- **Category**: Accessibility and cohesion — shared disclosure primitives
- **Estimated scope**: 6 files, 3 shared components and focused tests

## Problem

The shared Select and Dialog primitives use Radix/tailwindcss-animate entrances without an explicit CVF easing contract or a reduced-motion branch. Dialog content has a raw `duration-200`; Select relies on the plugin's implicit 150ms duration. Accordion content and its caret also retain movement under reduced motion.

```jsx
// frontend/src/components/ui/select.jsx:55 — current excerpt
"... data-[state=open]:animate-in data-[state=closed]:animate-out ...
 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ...
 origin-[--radix-select-content-transform-origin]"
```

```jsx
// frontend/src/components/ui/dialog.jsx:19,32 — current excerpts
"... data-[state=open]:animate-in data-[state=closed]:animate-out ..."
"... translate-x-[-50%] translate-y-[-50%] ... duration-200
 data-[state=open]:animate-in data-[state=closed]:animate-out ...
 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ..."
```

```jsx
// frontend/src/components/ui/accordion.jsx:27,36 — current excerpts
className="shrink-0 text-muted-foreground transition-transform duration-200"
className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
```

These owners feed Schedule, Standings, Playoffs, and Score Entry, so inconsistent behavior propagates across public and admin workflows.

## Target

Use the named `200ms ease-out` direct-interaction contract for Select, Dialog, and the Accordion caret. Preserve their normal transform/opacity or existing Accordion-height motion, but disable the keyframe/transform movement under reduced motion.

```jsx
// SelectContent target additions
"... !duration-cvf-fast ease-cvf-out ... motion-reduce:!animate-none"

// DialogOverlay and DialogContent target additions
"... !duration-cvf-fast ease-cvf-out ... motion-reduce:!animate-none"

// Accordion caret target
"... transition-transform duration-cvf-fast ease-cvf-out
 motion-reduce:!transform-none motion-reduce:transition-none"

// AccordionContent target
"... data-[state=closed]:animate-accordion-up
 data-[state=open]:animate-accordion-down motion-reduce:!animate-none"
```

`!duration-cvf-fast` is intentional: rendered verification showed the state-variant `animate-in/out` selector otherwise retained tailwindcss-animate's implicit 150ms duration. The important named token makes both animation and transition duration compute to 200ms. `motion-reduce:!animate-none` likewise overrides state-variant keyframe utilities. Dialog's static `translate-x-[-50%] translate-y-[-50%]` centering transforms remain; disabling its animation must not alter its final centered geometry.

## Repo conventions to follow

- `frontend/tailwind.config.js` owns `duration-cvf-fast: 200ms` and `ease-cvf-out: ease-out`.
- `frontend/src/components/ui/popover.jsx` is the existing Radix exemplar for `origin-[--radix-*-content-transform-origin] motion-reduce:!animate-none`.
- Preserve `animate-accordion-up/down` and their existing 200ms values in normal motion, as required by `design-plans/home-ui-system-roadmap.md`.
- Keep behavior in shared primitives so every consumer receives the same accessibility contract.

## Steps

1. In `frontend/src/components/ui/select.jsx`, add `!duration-cvf-fast ease-cvf-out motion-reduce:!animate-none` to `SelectContent`. Preserve every state fade/zoom/side class, transform origin, portal, viewport, and popper-position offset.
2. In `frontend/src/components/ui/dialog.jsx`, add `!duration-cvf-fast ease-cvf-out motion-reduce:!animate-none` to `DialogOverlay`.
3. In `DialogContent`, replace raw `duration-200` with `!duration-cvf-fast`, add `ease-cvf-out motion-reduce:!animate-none`, and preserve the static centering transforms and every state class.
4. In `frontend/src/components/ui/accordion.jsx`, replace the caret's raw `duration-200` with `duration-cvf-fast ease-cvf-out`, then add `motion-reduce:!transform-none motion-reduce:transition-none`.
5. Add `motion-reduce:!animate-none` to `AccordionContent` without changing its normal open/closed keyframe utilities.
6. Extend `frontend/src/components/ui/select.test.jsx` with structural assertions for named timing, easing, and the reduced-motion override.
7. Add `frontend/src/components/ui/dialog.test.jsx` to assert both overlay/content contracts and that static centering transforms remain.
8. Add `frontend/src/components/ui/accordion.test.jsx` to assert the named caret timing, reduced-motion caret/content branches, and retained normal Accordion keyframes.

## Boundaries

- Do NOT change Select trigger sizing, popper geometry, portal behavior, focus handling, keyboard behavior, or transform origin.
- Do NOT remove Dialog's final centering transforms, change modal layout, overlay opacity, close-button behavior, or focus trapping.
- Do NOT remove normal `animate-accordion-up/down` height animation or change its keyframes/duration.
- Do NOT modify `AlertDialog`, Sheet, Popover, or consumer pages in this plan.
- Do NOT remove `AccordionTrigger`'s `transition-all` here; plan 007 owns that separate broad-transition cleanup.
- Do NOT add Framer Motion, a new dependency, a custom curve, or a new duration.
- If a cited owner no longer matches commit `b20e419`, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: run `cd frontend && CI=true npm test -- --watchAll=false --runTestsByPath src/components/ui/select.test.jsx src/components/ui/dialog.test.jsx src/components/ui/accordion.test.jsx`; run the complete frontend test command; run `npm run build`. Inspect the production CSS for `duration-cvf-fast`, `ease-cvf-out`, and the important reduced-motion overrides.
- **Feel check**: at 10% playback, open/close Schedule and Standings selects, the Playoffs scheduling dialog, the Score Entry unlock dialog, and a Score Entry player Accordion. Normal motion must feel consistent at 200ms without a changed origin, geometry jump, or delayed focus.
- **Reduced-motion check**: emulate `prefers-reduced-motion: reduce` and repeat with pointer and keyboard. Selects and dialogs must appear/disappear without keyframe movement; Accordion content must open/close instantly and its caret must not rotate. Focus placement and return must remain correct.
- **Done when**: all three shared disclosure owners use the named timing contract, reduced motion removes movement, normal behavior and geometry are preserved, and focused/full tests plus build pass.
