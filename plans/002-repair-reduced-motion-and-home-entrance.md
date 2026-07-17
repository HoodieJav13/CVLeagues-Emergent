# 002 — Repair reduced motion and remove the Home entrance

- **Status**: DONE
- **Commit**: 3f78312
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files, small CSS and class changes

## Problem

The frequently revisited Home route moves the entire page 12px for 500ms on every mount, and that movement still runs when the user requests reduced motion. Radix popovers likewise retain zoom and directional slide keyframes because the global reduced-motion rule only disables the status pulse.

```jsx
// frontend/src/pages/Home.js:151 — current
<div className="space-y-10 animate-fade-up">
```

```css
/* frontend/src/index.css:178-202 — current */
@keyframes cvf-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: cvf-fade-up 0.5s ease-out both; }
.animate-fade-in { animation: cvf-fade-in 0.3s ease-out both; }
@media (prefers-reduced-motion: reduce) {
    .cvf-status-pulse { animation: none; }
}
```

```jsx
// frontend/src/components/ui/popover.jsx:19 — current excerpt
"... data-[state=open]:animate-in data-[state=closed]:animate-out ... data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ..."
```

## Target

Home has no whole-page entrance animation. The global reduced-motion block makes the existing entrance helpers and delay helpers instant, and every Radix `PopoverContent` disables its keyframe animation under reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
    .animate-fade-up,
    .animate-fade-in,
    .cvf-status-pulse { animation: none; }
    .delay-75,
    .delay-150,
    .delay-225,
    .delay-300 { animation-delay: 0ms; }
}
```

```jsx
// PopoverContent target excerpt
"... motion-reduce:animate-none"
```

## Repo conventions to follow

- `frontend/src/index.css:200` already owns the global `prefers-reduced-motion` contract and disables `.cvf-status-pulse`; extend that same block.
- `frontend/src/components/ui/popover.jsx` is the shared shadcn/Radix owner, so the reduced-motion branch belongs there rather than at `MobileJoinBar`.
- Keep `.animate-fade-up` available for other routes; this stage removes only Home's use and repairs its reduced-motion behavior globally.

## Steps

1. Remove `animate-fade-up` from the Home root in `frontend/src/pages/Home.js`.
2. Extend the existing `prefers-reduced-motion: reduce` block in `frontend/src/index.css` so `.animate-fade-up`, `.animate-fade-in`, and `.cvf-status-pulse` have `animation: none`, and every existing delay helper uses `animation-delay: 0ms`.
3. Add `motion-reduce:animate-none` to the shared `PopoverContent` class in `frontend/src/components/ui/popover.jsx`.

## Boundaries

- Do NOT delete the existing keyframes or migrate other route entrances in this plan.
- Do NOT change normal-motion popover geometry, origin, focus management, portal behavior, or durations.
- Do NOT change shimmer; it is outside the traced Home surface.
- Do NOT add dependencies.
- If a cited class no longer matches commit `3f78312`, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: `cd frontend && CI=true npm test -- --watchAll=false`; `cd frontend && npm run build`; inspect computed styles with `prefers-reduced-motion: reduce` and confirm `animation-name: none` on an element using `.animate-fade-in`, on the Join popover content, and on `.cvf-status-pulse`.
- **Feel check**: revisit Home repeatedly and confirm no page translation occurs. Open and close the mobile Join popover with pointer and keyboard in normal motion, then repeat under reduced motion. Normal motion must retain its Radix origin; reduced motion must open instantly without zoom/slide. Focus must land and return correctly in both modes.
- **Done when**: Home has no mount entrance and reduced-motion media emulation reports no entrance, pulse, delay, or popover transform animation.
