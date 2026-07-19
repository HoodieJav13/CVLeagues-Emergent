# Pass 1R Capture Manifest

## Capture conditions

- Date: 2026-07-19
- Product baseline: current product source is byte-identical to `main` at `65ee435` for `frontend/src`, `frontend/public`, and frontend build/config files. The checked-out evidence branch contains documentation-only work beyond that baseline.
- Data mode: local mock data from `seed.js`; `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, and `REACT_APP_TURNSTILE_SITE_KEY` were blank. The browser recorded no Supabase requests.
- Capture method: viewport-only screenshots at scroll position 0 after route navigation and a two-second render settle. No full-page stitching was used.
- Viewports: 390 × 844, 768 × 1024, and 1440 × 1000 CSS pixels.
- Development-only role switcher: the bottom-left role switcher visible in captures is mock-mode audit tooling and is excluded from product findings.

## Files

| Surface | Route and state | 390 px | 768 px | 1440 px |
| --- | --- | --- | --- | --- |
| Home | `/`; populated featured final and upcoming games | [390](./home-390.png) | [768](./home-768.png) | [1440](./home-1440.png) |
| Schedule | `/schedule`; populated filters and final/upcoming/playoff-tagged cards | [390](./schedule-390.png) | [768](./schedule-768.png) | [1440](./schedule-1440.png) |
| Game Detail — final | `/game/g1`; final score and recorded statistics | [390](./game-final-g1-390.png) | [768](./game-final-g1-768.png) | [1440](./game-final-g1-1440.png) |
| Game Detail — upcoming | `/game/g11`; upcoming game without final statistics | [390](./game-upcoming-g11-390.png) | [768](./game-upcoming-g11-768.png) | [1440](./game-upcoming-g11-1440.png) |
| Standings | `/standings`; populated league table | [390](./standings-390.png) | [768](./standings-768.png) | [1440](./standings-1440.png) |
| Playoffs | `/playoffs`; reachable mock empty state | [390](./playoffs-390.png) | [768](./playoffs-768.png) | [1440](./playoffs-1440.png) |
| Leaderboards | `/leaderboards`; populated season leaderboard | [390](./leaderboards-390.png) | [768](./leaderboards-768.png) | [1440](./leaderboards-1440.png) |
| Team | `/team/t1`; populated identity, leaders, roster, and games | [390](./team-t1-390.png) | [768](./team-t1-768.png) | [1440](./team-t1-1440.png) |
| Profile | `/profile/p1`; populated public athlete profile | [390](./profile-p1-390.png) | [768](./profile-p1-768.png) | [1440](./profile-p1-1440.png) |
| Team Interest | `/team-interest`; initial form state | [390](./team-interest-390.png) | [768](./team-interest-768.png) | [1440](./team-interest-1440.png) |
| Free Agent | `/free-agent`; initial form state | [390](./free-agent-390.png) | [768](./free-agent-768.png) | [1440](./free-agent-1440.png) |

## Count

- 390 px: 11 files
- 768 px: 11 files
- 1440 px: 11 files
- Total: 33 PNG files

Transient header-paint flakes observed during early automation attempts were discarded and overwritten after DOM/paint verification. The files listed above are the stable final set.
