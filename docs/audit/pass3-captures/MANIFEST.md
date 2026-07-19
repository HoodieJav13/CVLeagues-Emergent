# Pass 3 Vertical-Slice Capture Manifest

Captured on 2026-07-19 from isolated prototype branches using mock-only fixture data and viewport-only screenshots. Full-page capture was intentionally avoided because Pass 1 proved its stitching path unreliable.

## Inventory

| Evidence | Textured surface | Structural line | Total |
| --- | ---: | ---: | ---: |
| Primary pages at 390px | 3 | 3 | 6 |
| Primary pages at 768px | 3 | 3 | 6 |
| Primary pages at 1440px | 3 | 3 | 6 |
| Eliminated + Clinched state frame | 1 | 1 | 2 |
| Motion before/after stills | 4 | 4 | 8 |
| **Total PNG files** | **14** | **14** | **28** |

The state frame contains two separately labeled prototype-only entries per treatment. Each treatment therefore demonstrates two new states and two motion moments, with two stills per motion moment.

## Primary journey

| Treatment | Route | State | 390px | 768px | 1440px |
| --- | --- | --- | --- | --- | --- |
| Textured surface | `/` | Populated Home; fallback hero, latest final, upcoming and playoff cards | [`textured-home-390.png`](textured-home-390.png) | [`textured-home-768.png`](textured-home-768.png) | [`textured-home-1440.png`](textured-home-1440.png) |
| Textured surface | `/schedule` | Default populated Schedule; postseason prototype states visible | [`textured-schedule-390.png`](textured-schedule-390.png) | [`textured-schedule-768.png`](textured-schedule-768.png) | [`textured-schedule-1440.png`](textured-schedule-1440.png) |
| Textured surface | `/game/g1` | Completed Game Detail; final treatment and team fallback zones | [`textured-game-g1-390.png`](textured-game-g1-390.png) | [`textured-game-g1-768.png`](textured-game-g1-768.png) | [`textured-game-g1-1440.png`](textured-game-g1-1440.png) |
| Structural line | `/` | Populated Home; fallback hero, latest final, upcoming and playoff cards | [`structural-home-390.png`](structural-home-390.png) | [`structural-home-768.png`](structural-home-768.png) | [`structural-home-1440.png`](structural-home-1440.png) |
| Structural line | `/schedule` | Default populated Schedule; postseason prototype states visible | [`structural-schedule-390.png`](structural-schedule-390.png) | [`structural-schedule-768.png`](structural-schedule-768.png) | [`structural-schedule-1440.png`](structural-schedule-1440.png) |
| Structural line | `/game/g1` | Completed Game Detail; final treatment and team fallback zones | [`structural-game-g1-390.png`](structural-game-g1-390.png) | [`structural-game-g1-768.png`](structural-game-g1-768.png) | [`structural-game-g1-1440.png`](structural-game-g1-1440.png) |

## Prototype-only postseason states

| Treatment | Route | Viewport | States | File |
| --- | --- | ---: | --- | --- |
| Textured surface | `/schedule` | 390px | Mesa Mavericks — Eliminated; Bosque Blitz — Advanced/Clinched | [`textured-states-eliminated-clinched-390.png`](textured-states-eliminated-clinched-390.png) |
| Structural line | `/schedule` | 390px | Mesa Mavericks — Eliminated; Bosque Blitz — Advanced/Clinched | [`structural-states-eliminated-clinched-390.png`](structural-states-eliminated-clinched-390.png) |

## Motion evidence

| Treatment | Moment | Viewport | Before | After |
| --- | --- | ---: | --- | --- |
| Textured surface | Upcoming featured-card press feedback | 1440px | [`textured-card-motion-before-1440.png`](textured-card-motion-before-1440.png) | [`textured-card-motion-pressed-1440.png`](textured-card-motion-pressed-1440.png) |
| Textured surface | Completed game settling into Final | 1440px | [`textured-final-settle-before-1440.png`](textured-final-settle-before-1440.png) | [`textured-final-settle-after-1440.png`](textured-final-settle-after-1440.png) |
| Structural line | Upcoming featured-card press feedback | 1440px | [`structural-card-motion-before-1440.png`](structural-card-motion-before-1440.png) | [`structural-card-motion-pressed-1440.png`](structural-card-motion-pressed-1440.png) |
| Structural line | Completed game settling into Final | 1440px | [`structural-final-settle-before-1440.png`](structural-final-settle-before-1440.png) | [`structural-final-settle-after-1440.png`](structural-final-settle-after-1440.png) |

The press-state “after” frame uses a prototype-only `?pass3Motion=pressed` capture hook so the still is deterministic. The real interaction remains the guarded hover/press transition. Reduced-motion CSS removes added transforms and animations while retaining static state labels and colors.
