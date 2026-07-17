# 009 — Reveal a newly generated playoff bracket

- **Status**: DONE
- **Commit**: b20e419
- **Severity**: LOW
- **Category**: Missed opportunity — one-way completion feedback
- **Estimated scope**: 2 files, one local wrapper and focused page test

## Problem

After an admin successfully generates a playoff bracket, Playoffs instantly replaces the seed editor with the bracket. This is a rare, meaningful commit moment, but the UI currently provides only the structural swap and toast; the newly created result has no local visual arrival.

```jsx
// frontend/src/pages/Playoffs.js:53-57 — current
const generate = async () => {
  try {
    await app.generatePlayoffBracket({ league_id: league.id, seed_team_ids: seedIds });
    toast.success("Bracket generated and seeds locked");
  } catch { /* backend adapter already surfaces the error */ }
};

// frontend/src/pages/Playoffs.js:72-110 — current shape
{bracket ? (
  <>
    <div className="flex items-center gap-2">...</div>
    <BracketView ... />
  </>
) : (
  <Card>...seed editor...</Card>
)}
```

## Target

When `bracket` becomes present, wrap only the new bracket branch in the existing 300ms opacity-only local entrance helper. The seed editor exits immediately; the new bracket fades in once, with no overlap, transform, stagger, or round-by-round animation.

```jsx
{bracket ? (
  <div
    key={bracket.id}
    className="space-y-5 animate-fade-in"
    data-testid="playoff-bracket-reveal"
  >
    <div className="flex items-center gap-2">...</div>
    <BracketView ... />
  </div>
) : (
  <Card>...seed editor...</Card>
)}
```

`.animate-fade-in` is already defined as `cvf-fade-in 0.3s ease-out both`, and the global reduced-motion block already changes it to `animation: none`.

## Repo conventions to follow

- `frontend/src/index.css` owns the existing `animate-fade-in` 300ms `ease-out` local-content entrance and its reduced-motion override; reuse it without editing CSS.
- Use motion for the successful one-way bracket-generation result, not for routine route entry or every bracket card.
- Keep the data mutation, success toast, bracket rendering, and admin authorization ownership unchanged.

## Steps

1. In `frontend/src/pages/Playoffs.js`, replace the bracket branch Fragment with a keyed wrapper using `space-y-5 animate-fade-in` and `data-testid="playoff-bracket-reveal"`; `space-y-5` preserves the current root spacing between the status header and `BracketView`.
2. Preserve the existing SportBadge/status header and `BracketView` content inside that wrapper without changing their markup or data.
3. Keep the seed editor branch, `generate` handler, toast, scheduling Dialog, and bracket-match interactions unchanged.
4. Add `frontend/src/pages/Playoffs.test.js` following existing `useApp`, `useRole`, and router mock conventions. Cover a no-bracket admin fixture, the successful generate state transition, and a bracket-present fixture; assert the reveal wrapper appears only with a bracket and owns `animate-fade-in`.
5. In the test, assert the seed editor is absent after the successful state update and the bracket content remains available immediately; avoid animation-timer snapshots.

## Boundaries

- Do NOT animate the seed editor exit, render old and new branches together, or delay the bracket's availability.
- Do NOT stagger rounds, matches, seeds, teams, or scores; do not animate bracket layout/height/position.
- Do NOT change `generatePlayoffBracket`, permissions, schema, backend calls, toast behavior, scheduling, or bracket data.
- Do NOT edit `frontend/src/index.css` or introduce a new animation utility/dependency.
- Do NOT use Framer Motion for this opacity-only one-way entrance.
- If the cited conditional no longer matches commit `b20e419` plus plans 005-008, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: run `cd frontend && CI=true npm test -- --watchAll=false --runTestsByPath src/pages/Playoffs.test.js`; run the complete frontend suite; run `npm run build`; confirm production CSS retains the `animate-fade-in` rule and reduced-motion override.
- **Feel check**: at normal speed and 10% playback, generate a bracket once. The seed editor must disappear immediately and only the complete new bracket region should fade from 0% to 100% opacity over 300ms; there must be no movement, overlap, stagger, delayed interaction, or repeat animation during ordinary bracket use.
- **Reduced-motion check**: emulate `prefers-reduced-motion: reduce` and generate a bracket. The bracket must appear instantly at full opacity, with the same toast, focus, and interaction behavior.
- **Done when**: successful generation produces one restrained local bracket reveal, reduced motion is instant, existing mutation/authorization behavior is untouched, and focused/full tests plus build pass.
