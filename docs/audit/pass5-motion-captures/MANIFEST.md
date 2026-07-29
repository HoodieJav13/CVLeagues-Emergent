# Pass 5 Motion — Reduced-Motion Parity Captures

- **Date:** 2026-07-29 · Branch: `main` working tree
- Motion itself cannot be captured in stills; these four captures are the
  **reduced-motion parity proof**: with `prefers-reduced-motion: reduce`
  forced, every beat's surface renders its complete final state (rows opaque,
  share bars at full width, FINAL chip present, bracket revealed, Eliminated
  state applied). The animated path was separately verified by computed-style
  assertion: `cvf-settle-up`/`cvf-share-grow` active under no-preference,
  `none` under reduce, bar width identical in both.
- The beats themselves need a live review — run `cvf-mock` and load
  Standings, a final Game Detail, game-day Home (clock-inject or wait for a
  real game day), and the Flag Football bracket.

| File | Surface |
| --- | --- |
| `rm-standings-375.jpeg` | Standings monument: rows + full-width share bars |
| `rm-game-final-375.jpeg` | Fresh-final settle surface: fields + chip, final state |
| `rm-home-gameday-375.jpeg` | Game-day arrival surface (clock-injected) |
| `rm-bracket-eliminated-375.jpeg` | Bracket reveal surface + the Eliminated state, first build |

