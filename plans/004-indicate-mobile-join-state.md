# 004 — Indicate mobile Join disclosure state

- **Status**: DONE
- **Commit**: 3f78312
- **Severity**: LOW
- **Category**: Missed opportunity — feedback and state indication
- **Estimated scope**: 2 files, small shared-state classes and tests

## Problem

The mobile Join trigger's caret remains pointed down when the Radix popover is open, so the trigger does not visually report disclosure state.

```jsx
// frontend/src/components/layout/MobileJoinBar.js:22-28 — current
<button
  data-testid="mobile-join"
  aria-label="Join CVF Sports"
  className="... hover:bg-teal-deep transition-colors ..."
>
  Join <CaretDown size={16} weight="bold" />
</button>
```

## Target

Use the `data-state` that Radix places on the trigger and rotate the caret 180 degrees while open with the owner-approved `200ms ease-out` direct-interaction contract. Keep the frequent trigger press instant. Reduced motion removes the caret transform while the Radix state, color, label, and popover remain fully functional.

```jsx
<button className="group ...">
  Join
  <CaretDown
    data-testid="mobile-join-caret"
    className="transition-transform duration-cvf-fast ease-cvf-out group-data-[state=open]:rotate-180 motion-reduce:transform-none motion-reduce:transition-none"
    size={16}
    weight="bold"
  />
</button>
```

## Repo conventions to follow

- `PopoverTrigger asChild` already gives the raw button Radix's `data-state`; no controlled React state is needed.
- Use the `duration-cvf-fast` and `ease-cvf-out` named utilities established by plan 001.

## Steps

1. Add `group` to the existing Join trigger without adding press motion.
2. Add a test ID and explicit transform transition to `CaretDown`; rotate it with `group-data-[state=open]:rotate-180`, and suppress the transform/transition under reduced motion.
3. Add a focused `MobileJoinBar.test.js` using the repository's router and Radix-compatible DOM test conventions. Assert the trigger/caret class contract and confirm both intake links remain present after opening.

## Boundaries

- Do NOT introduce controlled popover state, timers, Framer Motion, or a new dependency.
- Do NOT change the popover content animation, positioning, routes, copy, 44px target, or hidden-route logic.
- Do NOT use a custom 160ms curve; keep the accepted 200ms/ease-out contract.
- If Radix does not place `data-state` on the `asChild` trigger at runtime, STOP and report instead of adding duplicate application state.

## Verification

- **Mechanical**: run the focused MobileJoinBar test, complete frontend suite, and production build. Open the popover in the rendered app and inspect that the trigger changes from `data-state="closed"` to `data-state="open"`.
- **Feel check**: at 10% playback, tap Join and confirm the caret rotates around its center while the popover grows from the trigger origin. Rapid toggles must always reflect the current Radix state. Under reduced motion, the caret must not transform, while the menu appears and keyboard focus works normally.
- **Done when**: the caret truthfully mirrors disclosure state, both intake routes remain reachable, and reduced-motion users receive no nonessential transform.
