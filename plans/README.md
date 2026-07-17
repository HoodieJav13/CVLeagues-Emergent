# Improve Animations plans

Plans 001-004 were written against `3f78312` after the Gate 2 rendered Home, Schedule, and Team-detail verification. The follow-up cross-surface audit plans 005-009 are written against `b20e419`.

| Plan | Title | Severity | Status |
|---|---|---:|---|
| 001 | Replace broad and layout-triggering transitions | HIGH | DONE |
| 002 | Repair reduced motion and remove the Home entrance | MEDIUM | DONE |
| 003 | Bridge filter-result replacement with opacity | MEDIUM | DONE |
| 004 | Indicate mobile Join disclosure state | LOW | DONE |
| 005 | Remove legacy whole-route entrances | MEDIUM | DONE |
| 006 | Normalize shared disclosure motion | HIGH | DONE |
| 007 | Remove broad shared-control transitions | MEDIUM | DONE |
| 008 | Bridge journey state replacement with opacity | MEDIUM | DONE |
| 009 | Reveal a newly generated playoff bracket | LOW | DONE |

Plans 001-004 were completed and verified on 2026-07-16. Plans 005-009 were completed and verified on 2026-07-17. Rendered verification corrected the shared Select/Dialog duration specificity so the named 200ms contract wins over tailwindcss-animate's 150ms state variant. No commit was created; the repository owner checkpoint remains pending.

## Recommended execution order

The original batch ran in order 001-004. Run the selected follow-up batch in this order:

1. Plan 005 removes generic route-level motion before adding any local state indication.
2. Plan 006 normalizes shared Select, Dialog, and Accordion disclosure timing and reduced-motion behavior.
3. Plan 007 removes broad shared-control transitions after plan 006 gives the Accordion caret explicit ownership.
4. Plan 008 adds quiet 200ms opacity bridges to Schedule, Standings, and Score Entry after the shared foundation is corrected.
5. Plan 009 adds the rare 300ms generated-bracket reveal last.

Plan 007 depends on plan 006 because both touch `accordion.jsx` and its focused test. Plans 008 and 009 rely only on the existing named tokens and repaired reduced-motion contract, but should follow 005-007 so the experience is evaluated on the settled foundation.

## Deliberately not selected

- No new custom cubic-bezier, 120ms, or 160ms values: the owner-approved CVF contract remains 200ms direct interaction, 300ms local content, and `ease-out`.
- No Framer Motion or new animation dependency.
- No staggered result cards, animated navigation indicator, score count-up, hero parallax, logo flourish, or featured-card entrance; these are too frequent, decorative, or comprehension-hostile for this sports-data surface.
- No positional game-card hover lift; featured and regular data cards remain spatially stable and use border/shadow affordance consistently.
- The original Home-only stage deliberately deferred a broader entrance migration. Plan 005 is the separately audited, scoped follow-up for Schedule, Standings, Playoffs, Game Detail, and Score Entry.
- No playoff seed-reordering animation until a separate FLIP/Framer ownership decision is approved.
- No extra-inning insertion animation; the score-entry form remains spatially stable.
- Preserve normal Accordion height animation while removing it under reduced motion.
