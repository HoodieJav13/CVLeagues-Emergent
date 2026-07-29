# Pass 4 — Remaining Batches, Half 1 Capture Manifest

- **Date:** 2026-07-29
- **Branch:** `pass4-remaining` (off `main` at `ba2d995`)
- **Scope:** the four decided page recompositions — Schedule D2 (decision 8),
  Standings A2 + data graphics (decisions 3, 4 / Addendum 7), Game Detail B2
  (decision 1 / Addendum 8), Home C2 (decision 5). Half 2 (Team/Profile,
  Playoffs, forms, voice) awaits owner review of this half.
- **Data mode:** local mock seed via `cvf-mock`; zero Supabase requests.
- **Capture method:** `playwright-core` + preinstalled Chromium headless
  shell, 2× scale, reduced motion. Home arrival states use Playwright **clock
  injection** (the seed is untouched): game day = 2026-06-30 15:00 league
  time, off-day = 2026-06-29.
- Viewports 375 × 812 and 1440 × 900. The `DEMO PREVIEW / VIEWER` chip is the
  dev-only Role Switcher.

## Schedule D2

| File | Viewport | Shows |
| --- | ---: | --- |
| `schedule-d2-top-375.jpeg` | 375 | Away-first convention in the subtitle; export moved below the register |
| `schedule-d2-375.jpeg` | 375 | Stacked scorelines: 38-char name wrapping whole, 5–5 tie, W/L forfeit with Forfeit meta, winner bold/loser muted |
| `schedule-d2-1440.jpeg` | 1440 | Desktop register unchanged (ALREADY FINE surface preserved) |

## Standings A2 + season-shape worm

| File | Viewport | Shows |
| --- | ---: | --- |
| `standings-a2-375.jpeg` | 375 | Page top: filters, 28px league title |
| `standings-a2-rows-375.jpeg` | 375 | Leader hero row (40px gold numeral, chips, share bar), W-L-T records, T3/T3, full mobile parity — the tie BLOCKING resolved |
| `standings-a2-1440.jpeg` | 1440 | Same composition scaled up (rank numerals to 3rem on the hero) |
| `standings-a2-worm-375.jpeg` | 375 | "Season shape" disclosure open: team-colored cumulative-diff worm (closed by default) |

## Game Detail B2

| File | Viewport | Shows |
| --- | ---: | --- |
| `game-b2-final-g1-375.jpeg` / `-1440.jpeg` | 375 / 1440 | Team-color fields meeting at the score; FINAL chip; sr-only h1; single date/time/venue statement |
| `game-b2-tie-g15-375.jpeg` | 375 | 5–5 tie, both scores equal-weight inside the two fields |
| `game-b2-forfeit-g16-375.jpeg` | 375 | W/L + FORFEIT chip in the score band; 38-char name wraps clear of it; no red CANCELED badge (finding resolved) |
| `game-b2-upcoming-g5-375.jpeg` | 375 | Focal kickoff time preserved inside the color environment |
| `game-b2-playoff-g13-375.jpeg` | 375 | Gold playoff frame + banner with the color fields |

## Home C2

| File | Viewport | Shows |
| --- | ---: | --- |
| `home-c2-gameday-375.jpeg` / `-1440.jpeg` | 375 / 1440 | GAME DAY takeover: GAMES TONIGHT, first-kick time, venue; JOIN bar gone from the top |
| `home-c2-gameday-strip-375.jpeg` | 375 | Scroll-snap today's-games strip |
| `home-c2-offday-375.jpeg` | 375 | NEXT: TUESDAY framing with the first-kick fact |
| `home-c2-fallback-feed-375.jpeg` | 375 | Real-clock fallback (Current Leagues) + New Teams feed ("Westside Warriors wants in · Kickball") |
| `home-c2-belowfold-cta-375.jpeg` | 375 | Newcomer CTA below the fold ("New to CVF?") |
