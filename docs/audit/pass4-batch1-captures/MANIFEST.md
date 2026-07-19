# Pass 4, Batch 1 Capture Manifest

Mock-only local frontend: `http://127.0.0.1:3013/schedule`

| File | Viewport | State |
| --- | ---: | --- |
| `schedule-populated-390.jpg` | 390 × 900 | Default current-season register, all sports and statuses |
| `schedule-filtered-upcoming-390.jpg` | 390 × 900 | Status = Upcoming, scrolled to playoff-tagged rows |
| `schedule-keyboard-focus-390.jpg` | 390 × 900 | Default register with the first game row keyboard-focused |
| `schedule-populated-768.jpg` | 768 × 1000 | Default current-season register, all sports and statuses |
| `schedule-filtered-upcoming-768.jpg` | 768 × 1000 | Status = Upcoming, playoff-tagged rows visible |
| `schedule-populated-1440.jpg` | 1440 × 1000 | Default current-season register, all sports and statuses |
| `schedule-filtered-upcoming-1440.jpg` | 1440 × 1000 | Status = Upcoming, playoff-tagged rows visible |

## Measured contracts

- Week/date heading: 24px.
- Row height: 96px at 390px; 72px at 768px and 1440px.
- Structural identity badge: 36px at 390px; 44px at 768px and 1440px.
- Badge flare: team-colored 3px offset outline; no external ray strokes.
- In-group row separator: 1px solid border.
- Playoff rail: 4px, `rgb(245, 184, 46)`; regular rows have no generated rail.
- Horizontal overflow: none at 390px, 768px, or 1440px.
- Result region retains its reduced-motion static-equivalent class.
- Keyboard traversal places a visible 2px teal focus outline on game rows.
- Cold-visibility verdict: PASS — the playoff rail is independently visible in each filtered-state capture without annotation.

Capture count: 3 at 390px, 2 at 768px, 2 at 1440px (7 total).
