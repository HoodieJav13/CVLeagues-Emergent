# 005 — Remove legacy whole-route entrances

- **Status**: DONE
- **Commit**: b20e419
- **Severity**: MEDIUM
- **Category**: Cohesion — excessive entrance motion
- **Estimated scope**: 5 files, class-only removals

## Problem

Five frequently visited workflow and results routes still animate their entire page from `translateY(12px)` and zero opacity for 500ms every time they mount. The animation is slower and broader than CVF's current 200ms direct-interaction and 300ms local-content contract, and it adds motion without identifying a meaningful state change.

```jsx
// frontend/src/pages/Schedule.js:71 — current
<div className="space-y-5 animate-fade-up">

// frontend/src/pages/Standings.js:18 — current
<div className="space-y-8 animate-fade-up">

// frontend/src/pages/Playoffs.js:61 — current
<div className="space-y-5 animate-fade-up">

// frontend/src/pages/GameDetail.js:54 — current
<div className="space-y-6 animate-fade-up">

// frontend/src/pages/ScoreEntry.js:122 — current
<div className="space-y-6 animate-fade-up max-w-3xl mx-auto">
```

The shared helper currently owns the legacy movement:

```css
/* frontend/src/index.css:178-190 — current */
@keyframes cvf-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: cvf-fade-up 0.5s ease-out both; }
```

## Target

Remove only `animate-fade-up` from the five route-root class strings. Each route renders immediately and remains spatially stable. Do not replace the generic entrance with another page-level animation.

```jsx
<div className="space-y-5">                            // Schedule, Playoffs
<div className="space-y-8">                            // Standings
<div className="space-y-6">                            // Game Detail
<div className="space-y-6 max-w-3xl mx-auto">          // Score Entry
```

## Repo conventions to follow

- `CVLeagues_Design_Tokens.md` permits 300ms entrances only for approved local content, not routine whole-route mounts.
- The completed Home motion stage already removed its whole-page entrance; apply the same settled route-level policy to these audited surfaces.
- Keep `frontend/src/index.css` unchanged because other routes may still consume the helper and its reduced-motion behavior is already correct.

## Steps

1. Remove `animate-fade-up` from the root container in `frontend/src/pages/Schedule.js`.
2. Remove `animate-fade-up` from the root container in `frontend/src/pages/Standings.js`.
3. Remove `animate-fade-up` from the root container in `frontend/src/pages/Playoffs.js`.
4. Remove `animate-fade-up` from the root container in `frontend/src/pages/GameDetail.js`.
5. Remove `animate-fade-up` from the root container in `frontend/src/pages/ScoreEntry.js`.
6. Search those five files for surviving route-root `animate-fade-up` usage and confirm there is none.

## Boundaries

- Do NOT delete or modify `.animate-fade-up`, its keyframes, `.animate-fade-in`, or delay helpers in `frontend/src/index.css`.
- Do NOT remove local state-change motion introduced by another approved plan.
- Do NOT change layout, spacing, typography, data behavior, focus, routing, or tests beyond any assertion that explicitly expected the removed root class.
- Do NOT migrate additional routes without a separate audited plan.
- If a cited root no longer matches commit `b20e419`, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: run `rg -n 'animate-fade-up' frontend/src/pages/{Schedule,Standings,Playoffs,GameDetail,ScoreEntry}.js`; run `cd frontend && CI=true npm test -- --watchAll=false`; run `cd frontend && npm run build`.
- **Feel check**: at normal speed and 10% playback, revisit all five routes through in-app navigation and browser refresh. The route shell and content must appear immediately with no page-wide opacity or vertical movement, layout jump, or focus regression.
- **Reduced-motion check**: emulate `prefers-reduced-motion: reduce` and repeat the route visits. Behavior must remain immediate and equivalent to normal motion because no route entrance remains.
- **Done when**: all five route roots render without `animate-fade-up`, source CSS remains intact, and tests/build pass.
