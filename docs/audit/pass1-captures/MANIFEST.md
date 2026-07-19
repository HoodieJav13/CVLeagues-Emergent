# Pass 1 Capture Manifest

Captured on 2026-07-18 from commit `a2839cc` at `http://127.0.0.1:3010` with `seed.js` preview data and blank Supabase environment variables. No hosted service was contacted.

## Inventory

| Viewport | PNG files |
| --- | ---: |
| 390 × 844 | 21 |
| 768 × 1024 | 19 |
| 1440 × 1000 | 20 |
| **Total** | **60** |

`*-viewport.png` files are the trusted visual evidence. `*-default.png` files preserve the full-page capture failure for diagnosis; they are not reliable evidence of the rendered layout. The three `home-*-viewport-control.png` files are independent viewport-only controls for that diagnosis.

## Trusted baseline viewport captures

| Route | State | 390px | 768px | 1440px |
| --- | --- | --- | --- | --- |
| `/` | Populated home; latest final, upcoming game, playoff-tagged cards | [`home-390-viewport.png`](home-390-viewport.png) | [`home-768-viewport.png`](home-768-viewport.png) | [`home-1440-viewport.png`](home-1440-viewport.png) |
| `/schedule` | Populated schedule; default filters; final and upcoming games | [`schedule-390-viewport.png`](schedule-390-viewport.png) | [`schedule-768-viewport.png`](schedule-768-viewport.png) | [`schedule-1440-viewport.png`](schedule-1440-viewport.png) |
| `/game/g1` | Completed regular-season game | [`game-g1-390-viewport.png`](game-g1-390-viewport.png) | [`game-g1-768-viewport.png`](game-g1-768-viewport.png) | [`game-g1-1440-viewport.png`](game-g1-1440-viewport.png) |
| `/standings` | Populated current-season standings | [`standings-390-viewport.png`](standings-390-viewport.png) | [`standings-768-viewport.png`](standings-768-viewport.png) | [`standings-1440-viewport.png`](standings-1440-viewport.png) |
| `/playoffs` | Kickball bracket unpublished empty state | [`playoffs-390-viewport.png`](playoffs-390-viewport.png) | [`playoffs-768-viewport.png`](playoffs-768-viewport.png) | [`playoffs-1440-viewport.png`](playoffs-1440-viewport.png) |
| `/leaderboards` | Populated season leaderboards | [`leaderboards-390-viewport.png`](leaderboards-390-viewport.png) | [`leaderboards-768-viewport.png`](leaderboards-768-viewport.png) | [`leaderboards-1440-viewport.png`](leaderboards-1440-viewport.png) |
| `/team/t1` | Populated team detail | [`team-t1-390-viewport.png`](team-t1-390-viewport.png) | [`team-t1-768-viewport.png`](team-t1-768-viewport.png) | [`team-t1-1440-viewport.png`](team-t1-1440-viewport.png) |
| `/profile/p1` | Populated athlete profile | [`profile-p1-390-viewport.png`](profile-p1-390-viewport.png) | [`profile-p1-768-viewport.png`](profile-p1-768-viewport.png) | [`profile-p1-1440-viewport.png`](profile-p1-1440-viewport.png) |

## Additional reachable states

| Route | State | Viewport | File |
| --- | --- | ---: | --- |
| `/game/g11` | Upcoming playoff game with stage banner | 390px | [`game-g11-390-upcoming-playoff-viewport.png`](game-g11-390-upcoming-playoff-viewport.png) |
| `/game/g11` | Upcoming playoff game with stage banner | 768px | [`game-g11-768-upcoming-playoff-viewport.png`](game-g11-768-upcoming-playoff-viewport.png) |
| `/game/g11` | Upcoming playoff game with stage banner | 1440px | [`game-g11-1440-upcoming-playoff-viewport.png`](game-g11-1440-upcoming-playoff-viewport.png) |
| `/schedule` | Status set to Upcoming; six cards, three playoff-tagged | 390px | [`schedule-390-upcoming-filter-viewport.png`](schedule-390-upcoming-filter-viewport.png) |
| `/schedule` | Status set to Upcoming; six cards, three playoff-tagged | 1440px | [`schedule-1440-upcoming-filter-viewport.png`](schedule-1440-upcoming-filter-viewport.png) |
| `/schedule` | High Desert Heat + Completed; no-results state | 390px | [`schedule-390-empty-filter-viewport.png`](schedule-390-empty-filter-viewport.png) |
| `/playoffs` | Flag Football bracket unpublished empty state | 390px | [`playoffs-390-flag-football-unpublished-viewport.png`](playoffs-390-flag-football-unpublished-viewport.png) |
| `/playoffs` | Flag Football bracket unpublished empty state | 768px | [`playoffs-768-flag-football-unpublished-viewport.png`](playoffs-768-flag-football-unpublished-viewport.png) |
| `/playoffs` | Flag Football bracket unpublished empty state | 1440px | [`playoffs-1440-flag-football-unpublished-viewport.png`](playoffs-1440-flag-football-unpublished-viewport.png) |

The mock seed contains no playoff brackets, seeds, or bracket matches, so a populated bracket was not reachable without mutating the read-only fixture. Both available sports correctly showed the unpublished state.

## Capture-artifact controls

| Route | State | Viewport | File |
| --- | --- | ---: | --- |
| `/` | Independent viewport-only control | 390px | [`home-390-viewport-control.png`](home-390-viewport-control.png) |
| `/` | Independent viewport-only control | 768px | [`home-768-viewport-control.png`](home-768-viewport-control.png) |
| `/` | Independent viewport-only control | 1440px | [`home-1440-viewport-control.png`](home-1440-viewport-control.png) |

## Full-page artifact reference set

Every file below is a full-page capture of the same route/state as its trusted baseline counterpart. These files exhibit duplicated or mis-stitched content and exist only to preserve evidence of the capture-tool failure.

| Route | State | 390px | 768px | 1440px |
| --- | --- | --- | --- | --- |
| `/` | Populated home | [`home-390-default.png`](home-390-default.png) | [`home-768-default.png`](home-768-default.png) | [`home-1440-default.png`](home-1440-default.png) |
| `/schedule` | Populated schedule; default filters | [`schedule-390-default.png`](schedule-390-default.png) | [`schedule-768-default.png`](schedule-768-default.png) | [`schedule-1440-default.png`](schedule-1440-default.png) |
| `/game/g1` | Completed regular-season game | [`game-g1-390-default.png`](game-g1-390-default.png) | [`game-g1-768-default.png`](game-g1-768-default.png) | [`game-g1-1440-default.png`](game-g1-1440-default.png) |
| `/standings` | Populated current-season standings | [`standings-390-default.png`](standings-390-default.png) | [`standings-768-default.png`](standings-768-default.png) | [`standings-1440-default.png`](standings-1440-default.png) |
| `/playoffs` | Kickball bracket unpublished empty state | [`playoffs-390-default.png`](playoffs-390-default.png) | [`playoffs-768-default.png`](playoffs-768-default.png) | [`playoffs-1440-default.png`](playoffs-1440-default.png) |
| `/leaderboards` | Populated season leaderboards | [`leaderboards-390-default.png`](leaderboards-390-default.png) | [`leaderboards-768-default.png`](leaderboards-768-default.png) | [`leaderboards-1440-default.png`](leaderboards-1440-default.png) |
| `/team/t1` | Populated team detail | [`team-t1-390-default.png`](team-t1-390-default.png) | [`team-t1-768-default.png`](team-t1-768-default.png) | [`team-t1-1440-default.png`](team-t1-1440-default.png) |
| `/profile/p1` | Populated athlete profile | [`profile-p1-390-default.png`](profile-p1-390-default.png) | [`profile-p1-768-default.png`](profile-p1-768-default.png) | [`profile-p1-1440-default.png`](profile-p1-1440-default.png) |
