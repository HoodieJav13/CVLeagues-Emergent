# 003 — Bridge filter-result replacement with opacity

- **Status**: DONE
- **Commit**: 3f78312
- **Severity**: MEDIUM
- **Category**: Missed opportunity — state indication
- **Estimated scope**: 2 files, one small React helper and focused tests

## Problem

Changing Sport or League immediately replaces both Home result regions, sometimes swapping several game cards for an empty state with no visual bridge. The change is functional and frequent, so list movement and stagger are inappropriate, but a quiet opacity transition can make the committed state change legible.

```jsx
// frontend/src/pages/Home.js:117-130 — current
const filtered = useMemo(() => {
  return state.games.filter(
    (g) => (sport === "all" || g.sport === sport) && (league_id === "all" || g.league_id === league_id)
  );
}, [state.games, sport, league_id]);

// frontend/src/pages/Home.js:248,268 — current
<div className={gameGridClass(upcoming.length)} data-testid="home-upcoming-grid">
<div className={gameGridClass(recent.length)} data-testid="home-recent-grid">
```

## Target

Each committed filter state mounts a small result-region owner at `opacity: 0.75`, then transitions to `opacity: 1` on the next animation frame. Because filtering is frequent direct feedback, use the owner-approved `200ms ease-out` interaction contract. The transition is CSS-transition based, has no transform or stagger, does not delay interaction, and cleans up the queued animation frame when a new filter change supersedes it. Reduced motion renders at full opacity with no transition.

```jsx
const FilterResultRegion = ({ transitionKey, className, testId, children }) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [transitionKey]);

  return (
    <div
      className={`${className} transition-opacity duration-cvf-fast ease-cvf-out ${entered ? "opacity-100" : "opacity-75"} motion-reduce:opacity-100 motion-reduce:transition-none`}
      data-testid={testId}
    >
      {children}
    </div>
  );
};
```

Mount each result region with `key={`${sport}:${league_id}:upcoming`}` or the recent equivalent so its first paint belongs to the new committed filter state. `transitionKey` must contain the same committed values.

## Repo conventions to follow

- `frontend/src/pages/Home.js` already owns filter state and the upcoming/recent result grids; keep the helper local rather than creating a general animation primitive.
- Use the `duration-cvf-fast` (`200ms`) and `ease-cvf-out` (`ease-out`) utilities established in `frontend/tailwind.config.js` by plan 001.
- Existing `Home.test.js` uses `createRoot`, mocked `useApp`, and structural class assertions; extend that style without full snapshots.

## Steps

1. Import `useEffect` alongside the existing React hooks in `frontend/src/pages/Home.js`.
2. Add the local `FilterResultRegion` helper with one next-frame entry, cleanup, explicit opacity transition, and reduced-motion classes.
3. Replace only the two upcoming/recent grid wrapper elements with `FilterResultRegion`, passing their current grid classes and test IDs plus a stable transition key derived from `sport` and `league_id`.
4. Keep every card, empty state, sort, filter, and slice operation unchanged.
5. Extend `frontend/src/pages/Home.test.js` with deterministic `requestAnimationFrame` mocks and assertions that the region begins at `opacity-75`, settles to `opacity-100`, uses `duration-cvf-enter`, and cancels frames when superseded/unmounted.

## Boundaries

- Do NOT animate individual cards, layout, height, position, or scores.
- Do NOT add stagger or delay interaction/content availability.
- Do NOT use keyframe animation or Framer Motion.
- Do NOT change filtering logic, result order, focus, route behavior, or select composition.
- Do NOT introduce the audit's proposed 120ms custom value; the owner-approved local-content value is 300ms.
- If a cited owner no longer matches commit `3f78312`, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: run `cd frontend && CI=true npm test -- --watchAll=false --runTestsByPath src/pages/Home.test.js`, the complete frontend suite, and `npm run build`. Rapidly switch filters and confirm no retained `requestAnimationFrame` callbacks or React act warnings.
- **Feel check**: at 10% playback, change Sport and League repeatedly. Only the two result regions should soften from 75% to 100% opacity; controls, headings, and layout must not move. Rapid changes must show only the newest state and never queue staggered work. Under reduced motion, new results must appear instantly at full opacity.
- **Done when**: filter replacements receive one quiet, interruptible opacity bridge with complete cleanup, while initial controls and result availability remain immediate.
