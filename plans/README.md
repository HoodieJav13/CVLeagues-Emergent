# Improve Animations plans

Written against `3f78312` after the Gate 2 rendered Home, Schedule, and Team-detail verification.

| Plan | Title | Severity | Status |
|---|---|---:|---|
| 001 | Replace broad and layout-triggering transitions | HIGH | DONE |
| 002 | Repair reduced motion and remove the Home entrance | MEDIUM | DONE |
| 003 | Bridge filter-result replacement with opacity | MEDIUM | DONE |
| 004 | Indicate mobile Join disclosure state | LOW | DONE |

Completed and verified on 2026-07-16. No commit was created; the repository owner checkpoint remains pending.

## Recommended execution order

1. Plan 001 establishes the approved `duration-cvf-fast`, `duration-cvf-enter`, and `ease-cvf-out` utilities while removing the largest performance/cohesion problem.
2. Plan 002 repairs the accessibility contract before adding new motion.
3. Plan 003 uses the established 300ms token for the highest-leverage surviving opportunity.
4. Plan 004 uses the established 200ms token for a small disclosure-state improvement.

Plans 003 and 004 depend on the named utilities added by plan 001. Plan 002 is otherwise independent but should run before either missed-opportunity plan.

## Deliberately not selected

- No new custom cubic-bezier, 120ms, or 160ms values: the owner-approved CVF contract remains 200ms direct interaction, 300ms local content, and `ease-out`.
- No Framer Motion or new animation dependency.
- No staggered result cards, animated navigation indicator, score count-up, hero parallax, logo flourish, or featured-card entrance; these are too frequent, decorative, or comprehension-hostile for this sports-data surface.
- No positional game-card hover lift; featured and regular data cards remain spatially stable and use border/shadow affordance consistently.
- No global migration of every legacy page entrance; this stage removes Home's whole-page entrance and makes the shared helpers truthful under reduced motion.
