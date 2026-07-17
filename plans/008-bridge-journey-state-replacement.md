# 008 — Bridge journey state replacement with opacity

- **Status**: DONE
- **Commit**: b20e419
- **Severity**: MEDIUM
- **Category**: Missed opportunity — state indication
- **Estimated scope**: 6 files, 3 page-local helpers and focused page tests

## Problem

Schedule and Standings replace substantial result regions instantly when filters change. Score Entry replaces the selected game's score/stat form instantly when the game selector changes. The controls work, but the committed state change has no visual bridge and can read as an abrupt redraw.

```jsx
// frontend/src/pages/Schedule.js — current result owner
{filteredGames.length === 0 ? (
  <EmptyState ... />
) : (
  <div className="space-y-6">...</div>
)}

// frontend/src/pages/Standings.js — current result owner
{leagues.length === 0 ? (
  <EmptyState ... />
) : (
  leagues.map(...)
)}

// frontend/src/pages/ScoreEntry.js:143-272 — current
<Select value={game_id} onValueChange={setGameId} ...>...</Select>
<div className="flex items-center gap-2">...</div>
<Card>...</Card>
<div className="space-y-4">...</div>
<Button data-testid="score-save" ...>Submit Score</Button>
```

## Target

On a committed filter/game change, only the owned result region begins at 75% opacity and transitions to 100% on the next animation frame using `duration-cvf-fast` (200ms) and `ease-cvf-out`. There is no transform, stagger, crossfade, delayed content, or layout animation. Reduced motion forces full opacity and disables the transition.

Use the completed Home implementation as the exact local pattern:

```jsx
const FilterResultRegion = ({ animate, className, testId, children }) => {
  const [entered, setEntered] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setEntered(true);
      return undefined;
    }
    setEntered(false);
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [animate]);

  return (
    <div
      className={`${className} transition-opacity duration-cvf-fast ease-cvf-out ${
        entered ? "opacity-100" : "opacity-75"
      } motion-reduce:opacity-100 motion-reduce:transition-none`}
      data-testid={testId}
    >
      {children}
    </div>
  );
};
```

Each page should own a filter revision counter, incremented only by the relevant selector callbacks, pass `animate={revision > 0}`, and include that revision in the result owner's `key`. The keyed remount reliably retriggers the helper while the `animate` flag preserves a full-opacity initial render.

- Schedule revision changes for Sport, Season, League / Tournament container, Team, and Status; wrap the existing games/empty-state result branch only.
- Standings revision changes for Sport and Season; wrap the existing standings/empty-state result branch only.
- Score Entry revision changes when `game_id` changes through the selector; wrap the game metadata, score Card, player-stat Cards, and Submit Score button. Keep the game selector and locked-game safety notice outside the transition so controls and safety state remain immediate.

## Repo conventions to follow

- Follow `frontend/src/pages/Home.js` exactly for next-frame entry, cleanup, opacity classes, and reduced-motion behavior.
- Keep helpers local because each page owns a different state boundary and transition trigger; do not create a global motion abstraction or migrate Home.
- Use the existing named tokens: `duration-cvf-fast` is 200ms and `ease-cvf-out` is `ease-out`.
- Preserve complete literal Tailwind class strings; do not interpolate utility names.

## Steps

1. In `frontend/src/pages/Schedule.js`, add a local result-region helper matching Home, add a revision counter, wrap each relevant filter setter so it updates the filter and increments the revision, and replace only the result owner with the helper keyed by the committed filter values plus revision. Preserve all filter values, sorting, week grouping, empty state, and test IDs.
2. In `frontend/src/pages/Standings.js`, add the same local helper and revision ownership for Sport/Season, then wrap only the current league/empty result region keyed by Sport, Season, and revision. Keep the Playoff Brackets link and filter controls stable.
3. In `frontend/src/pages/ScoreEntry.js`, add the same local helper and a game-selection revision. Change the Select callback to update `game_id` and increment the revision, then wrap the current game-specific region from metadata through Submit Score, keyed by `game_id` and revision.
4. Keep the Score Entry SectionHeading, locked notice, game selector, and unlock Dialog outside the opacity owner. Do not change the existing form-reinitialization effect or lock behavior.
5. Extend `frontend/src/pages/Schedule.test.js` with deterministic `requestAnimationFrame`/`cancelAnimationFrame` mocks and assertions for initial full opacity, one filter-change 75%-to-100% bridge, 200ms named classes, and cleanup on superseding change/unmount.
6. Add `frontend/src/pages/Standings.test.js` using the existing context-mocking conventions and the same structural/timing assertions.
7. Extend `frontend/src/pages/ScoreEntry.test.js` to assert a selector-driven game change bridges only the game-specific form, while the selector and locked notice do not receive transition classes.

## Boundaries

- Do NOT animate controls, headings, the Score Entry locked notice, individual cards/rows, height, position, scores, or layout reflow.
- Do NOT render old and new content together; this is a single-region opacity settle, not a crossfade.
- Do NOT add stagger, delay content availability, or queue multiple transitions during rapid selection.
- Do NOT change filtering, sorting, form initialization, game locking, data mutations, routing, or focus behavior.
- Do NOT add Framer Motion, keyframes, a global animation component, or new timing values.
- Do NOT modify Home's settled helper in this plan.
- If a cited owner no longer matches commit `b20e419` plus plans 005-007, STOP and report drift instead of improvising.

## Verification

- **Mechanical**: run focused Schedule, Standings, and Score Entry tests; run `cd frontend && CI=true npm test -- --watchAll=false`; run `cd frontend && npm run build`. Rapidly change each filter and confirm stale animation frames are cancelled with no React act warnings.
- **Feel check**: at 10% playback, change every Schedule filter, both Standings filters, and the Score Entry game. Only the result/form region should soften from 75% to 100% over 200ms; controls and safety state must remain stable, content must be immediately interactive, and only the newest selection may be visible.
- **Reduced-motion check**: emulate `prefers-reduced-motion: reduce`. Every replacement must appear immediately at full opacity with `transition-property: none` and unchanged keyboard/focus behavior.
- **Done when**: all three state replacements receive one quiet, interruptible 200ms opacity bridge, initial render and reduced motion are immediate, and focused/full tests plus build pass.
