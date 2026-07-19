# Pass 4, Batch 2 Capture Manifest

Mock-only local frontend: `http://127.0.0.1:3013`

| File | CSS viewport | State |
| --- | ---: | --- |
| `standings-populated-390.jpg` | 390 × 900 | Kickball standings and projected Season 1 playoff seeds |
| `standings-populated-768.jpg` | 768 × 1000 | Kickball standings and projected Season 1 playoff seeds |
| `standings-populated-1440.jpg` | 1440 × 1000 | Kickball standings and projected Season 1 playoff seeds |
| `leaderboards-populated-390.jpg` | 390 × 900 | Kickball · season · home runs |
| `leaderboards-filtered-flag-football-390.jpg` | 390 × 900 | Filtered to Flag Football · season · passing yards |
| `leaderboards-keyboard-focus-390.jpg` | 390 × 900 | Filtered winner profile link keyboard-focused |
| `leaderboards-populated-768.jpg` | 768 × 1000 | Kickball · season · home runs |
| `leaderboards-populated-1440.jpg` | 1440 × 1000 | Kickball · season · home runs |
| `leaderboards-filtered-flag-football-1440.jpg` | 1440 × 1000 | Filtered to Flag Football · season · passing yards |

## Measured contracts

### Standings

- League heading: 24px.
- Row height: 56px.
- Shared structural team mark: 28px.
- Qualification rail: 4px gold, paired with the explicit rule “All teams qualify · final standings set playoff seeds.”
- The displayed standings rank is the projected seed; no standings math changed.
- Cold-visibility verdict: PASS — the qualification rail is visible without annotation and its meaning is stated immediately above the register.

### Leaderboards

- Rank 1: 96px row, 40px score, 48px shared identity mark.
- Ranks 2–3: 76px rows, 32px scores.
- Rank 4+: 64px rows.
- Medal rails: 4px gold/silver/bronze; no glow treatment.
- Filter groups retain their existing targets and operate at 0.82 resting opacity, returning to full opacity on focus.
- Cold-visibility verdict: PASS — rank 1 is the obvious first scan anchor in unannotated mobile and desktop captures.

No horizontal overflow was observed at 390px, 768px, or 1440px. Capture count: 3 Standings and 6 Leaderboards (9 total).
