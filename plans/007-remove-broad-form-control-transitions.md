# 007 — Remove broad shared-control transitions

- **Status**: DONE
- **Commit**: b20e419
- **Severity**: MEDIUM
- **Category**: Performance and cohesion — transition scope
- **Estimated scope**: 6 files, 3 shared components and focused tests

## Problem

Input, Textarea, and AccordionTrigger use `transition-all`, allowing any changed CSS property—including borders, shadows, dimensions, and layout-affecting properties—to interpolate. That violates CVF's shared-control rule to animate only explicitly approved transform or opacity properties.

```jsx
// frontend/src/components/ui/input.jsx:10 — current excerpt
"... transition-all duration-200 ..."

// frontend/src/components/ui/textarea.jsx:9 — current excerpt
"... transition-all duration-200 ..."

// frontend/src/components/ui/accordion.jsx:19 — current excerpt
"... transition-all hover:underline ... [&[data-state=open]>svg]:rotate-180"
```

The audited direct consumers include the Playoffs scheduling Dialog Input, Score Entry unlock Dialog Textarea, and Score Entry player-stat Accordion.

## Target

Remove `transition-all duration-200` from the Input and Textarea base class strings. Remove `transition-all` from AccordionTrigger. Do not add a replacement transition to those elements: their border, color, shadow, focus, and underline state changes are immediate. The Accordion caret remains the sole explicit transform transition and is normalized by plan 006.

```jsx
// Input/Textarea target
// same class string with `transition-all duration-200` absent

// AccordionTrigger target
"... text-sm font-medium hover:underline text-left
 [&[data-state=open]>svg]:rotate-180"
```

## Repo conventions to follow

- `CVLeagues_Design_Tokens.md` explicitly prohibits `transition-all` on shared controls and limits motion to transform/opacity.
- Shared component files are the correct ownership layer; do not patch individual Playoffs or Score Entry consumers.
- Plan 006 owns the Accordion caret's explicit `transition-transform duration-cvf-fast ease-cvf-out` contract and its reduced-motion branch.

## Steps

1. Complete plan 006 first so the Accordion caret has an explicit named transition independent of its trigger.
2. Remove `transition-all duration-200` from the base class string in `frontend/src/components/ui/input.jsx`.
3. Remove `transition-all duration-200` from the base class string in `frontend/src/components/ui/textarea.jsx`.
4. Remove `transition-all` from `AccordionTrigger` in `frontend/src/components/ui/accordion.jsx`; preserve the state-driven caret rotation selector.
5. Add `frontend/src/components/ui/input.test.jsx` and `frontend/src/components/ui/textarea.test.jsx` with structural assertions that their rendered controls contain neither `transition-all` nor a broad duration utility, while existing focus/disabled classes remain.
6. Extend `frontend/src/components/ui/accordion.test.jsx` to assert the trigger has no `transition-all` and the caret still owns the explicit transform transition from plan 006.

## Boundaries

- Do NOT change focus rings, borders, colors, shadows, disabled behavior, dimensions, placeholder styles, typography, or consumer class overrides.
- Do NOT add `transition-colors`, `transition-shadow`, or another substitute; the approved target is immediate visual state on these owners.
- Do NOT remove or alter the Accordion caret's explicit transform transition from plan 006.
- Do NOT edit Playoffs, Score Entry, or other consumers to compensate.
- Do NOT add dependencies or animation utilities.
- If plan 006 is not complete, or a cited owner no longer matches commit `b20e419` plus plan 006, STOP and report the dependency/drift instead of improvising.

## Verification

- **Mechanical**: run `rg -n 'transition-all' frontend/src/components/ui/{input,textarea,accordion}.jsx`; run `cd frontend && CI=true npm test -- --watchAll=false --runTestsByPath src/components/ui/input.test.jsx src/components/ui/textarea.test.jsx src/components/ui/accordion.test.jsx`; run the complete frontend suite; run `npm run build`.
- **Feel check**: at normal speed and 10% playback, focus, type in, disable, and blur the Playoffs scheduling Input and Score Entry unlock Textarea; open/close a Score Entry player Accordion. Control borders/shadows/underlines must update immediately, while only the caret performs its explicit 200ms rotation.
- **Reduced-motion check**: emulate reduced motion and repeat. Controls remain immediate and the Accordion caret/content movement is removed by plan 006.
- **Done when**: the three shared owners contain no `transition-all`, Input/Textarea computed transition duration is `0s`, the Accordion caret retains only its scoped transition, and focused/full tests plus build pass.
