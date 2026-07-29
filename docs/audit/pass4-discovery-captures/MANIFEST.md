# Pass 4 Pre-Implementation Discovery — Capture Manifest

- **Date:** 2026-07-28
- **Branch:** `visual-discovery-pass4` (off `main` at `9469d18`; no application code edited)
- **Data mode:** local mock seed. The dev server was started with shell-level empty overrides for `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, and `REACT_APP_TURNSTILE_SITE_KEY`, which take precedence over `.env.local`; `MOCK_MODE` was therefore active and **zero Supabase network requests** were recorded during the session. Hosted was untouched.
- **Capture method:** Playwright Chromium (preinstalled), viewport-only JPEG at CSS-pixel scale.
- **Viewports:** 375 × 812 (primary) and 1440 × 900.
- The floating `DEMO PREVIEW / VIEWER` chip visible in captures is the env-gated development Role Switcher — audit tooling, not product surface.

## Baseline captures (pristine seed)

| File | Viewport | State |
| --- | ---: | --- |
| `home-375.jpeg` | 375 | Home top: hero, Latest Final / Up Next |
| `home-1440.jpeg` | 1440 | Home: hero geometry, featured pair, card grid start |
| `schedule-375.jpeg` | 375 | Schedule top: title, export button, filter stack, first rows |
| `schedule-1440.jpeg` | 1440 | Schedule register, three week groups |
| `standings-375.jpeg` | 375 | Standings top: filters, kickball register start |
| `standings-scrolled-375.jpeg` | 375 | Full kickball table (W/L/DIFF only at this width) |
| `standings-1440.jpeg` | 1440 | Full kickball table incl. GP/PF/STRK/LAST 5 |
| `leaderboards-375.jpeg` | 375 | Kickball dashboard: Home Runs hero + T1 rows |
| `leaderboards-flag-375.jpeg` | 375 | Flag Football: Passing Yards hero (645), copper rank 3 |
| `leaderboards-1440.jpeg` | 1440 | Two-column module dashboard |
| `playoffs-375.jpeg` | 375 | "Bracket not published yet" empty state |
| `playoffs-1440.jpeg` | 1440 | Same state, desktop |
| `game-final-g1-375.jpeg` | 375 | Final: 3-line matchup h1, event frame |
| `game-final-g1-boxscore-375.jpeg` | 375 | Inning table + per-team box score |
| `game-final-g1-1440.jpeg` | 1440 | Final event frame at desktop width |
| `game-upcoming-g11-375.jpeg` | 375 | Upcoming playoff: gold frame, focal time |
| `team-t1-375.jpeg` | 375 | Team header card, stat pills, stat leaders |
| `team-t1-roster-375.jpeg` | 375 | Roster card stack, eligibility icons, Upcoming |
| `team-t1-1440.jpeg` | 1440 | Header, stat leaders, roster grid |
| `team-t7-empty-375.jpeg` | 375 | High Desert Heat: 0-0, all stat leaders "—" |
| `profile-p1-375.jpeg` | 375 | Athlete header, Public/Private tabs, stat tiles with T-rank context |
| `profile-p1-1440.jpeg` | 1440 | Same, desktop |
| `profile-p1-flag-nostats-375.jpeg` | 375 | Second-sport tab with zero stats |
| `team-interest-375.jpeg` | 375 | Team Interest form top |
| `free-agent-375.jpeg` | 375 | Free Agent form top (note h1 hyphen wrap) |

## Stress captures (runtime localStorage mutation — unkind fixtures)

The seed contains no ties, no 0-0 finals, and no name longer than 18 characters. These states were produced by editing the dev-only versioned localStorage state in the browser (`cvf_app_state_v10`): team t2 renamed to "Los Ranchos de Albuquerque Roadrunners" (38 chars), g1 set to 5–5, g2 set to 0–0. **No repository file was touched; the key was deleted afterward and the pristine seed verified restored** (t2 = "Rio Grande Rollers", g1 = 4–7).

| File | Viewport | State |
| --- | ---: | --- |
| `stress-standings-tie-longname-1440.jpeg` | 1440 | T column appears; tie chips; "—" streaks; 38-char name fits |
| `stress-standings-tie-longname-375.jpeg` | 375 | 38-char name wraps to 3 lines; T/GP columns absent — a 0-0-2 team is indistinguishable from 0-0-0 |
| `stress-game-0-0-longname-375.jpeg` | 375 | 4-line matchup h1; 0–0 final with both scores equal-weight, no story |
| `stress-schedule-longname-375.jpeg` | 375 | Register truncation: ~9 visible characters per team name; 5–5 row with no tie treatment |
