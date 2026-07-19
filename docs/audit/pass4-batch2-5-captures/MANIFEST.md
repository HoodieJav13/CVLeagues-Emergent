# Pass 4, Batch 2.5 capture manifest

Captured from the development-only mock state at `http://127.0.0.1:3013/leaderboards`. Backend variables were blank; hosted Supabase was untouched. Every image is viewport-only.

| File | CSS viewport | State |
| --- | ---: | --- |
| `leaderboards-kickball-390.jpg` | 390×900 | Kickball, six-category dashboard, default top-five-plus-ties state |
| `leaderboards-kickball-768.jpg` | 768×1000 | Kickball, single-column tablet layout |
| `leaderboards-kickball-1440.jpg` | 1440×1000 | Kickball, two-column desktop layout with real T-ranks |
| `leaderboards-flag-football-390.jpg` | 390×900 | Flag Football, eight-category dashboard; copper rank 3 beside orange sport identity |
| `leaderboards-flag-football-768.jpg` | 768×1000 | Flag Football, single-column tablet layout |
| `leaderboards-flag-football-1440.jpg` | 1440×1000 | Flag Football, two-column desktop layout and editorial category order |
| `leaderboards-flag-football-tie-sacks-1440.jpg` | 1440×1000 | Seeded three-way T1 Sacks tie; complete T5 cutoff tie group remains visible |
| `leaderboards-flag-football-expanded-1440.jpg` | 1440×1000 | Receiving Yards expanded from five to six entries; collapse control visible |
| `leaderboards-flag-football-scroll-end-390.jpg` | 390×900 | Bottom of all eight mobile modules; offscreen modules rendered correctly |
| `leaderboards-keyboard-focus-390.jpg` | 390×900 | Visible keyboard focus on the Kickball sport tab |

## Cold-visibility verdicts

- **Category hero hierarchy: PASS.** The 88px desktop / 72px mobile identity mark and 56px desktop / 44px mobile value are the immediate scan anchors in each module.
- **Copper/orange distinction: PASS.** `--cvf-copper` resolves to `#C9825F`, measures 5.55:1 on the raised surface, and remains visibly browner and less saturated than Flag Football orange (`#FB923C`).
- **Mobile scroll sanity: PASS.** Eight modules produce a 4,424px document at the 390px viewport; three continuous scroll advances reached the final module with no blank, clipped, or horizontally overflowing region. `content-visibility: auto` is active on every module.

## OT7 reference notes retained for future batches

These observations are deliberately out of Batch 2.5 scope:

- Schedule week/date navigation → possible Batch 1 follow-up polish after launch.
- Conference-first standings grouping → revisit with multi-league/division and Season 2 structures.
- Home championship strip plus one dominant feature → Pass 5/homepage refinement.
- Identity-led team navigation → revisit if a public Teams index is introduced.

