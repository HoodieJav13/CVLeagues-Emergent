# Pass 4 Batch 0 Capture Manifest

## Conditions

- Date: 2026-07-19
- Branch: `main`
- Data mode: local mock seed with Supabase and Turnstile frontend variables blank
- Capture method: in-app browser, viewport-only, at the top of each route
- Viewport overrides: 390 × 844, 768 × 1024, and 1440 × 1000 CSS pixels. Image dimensions may exclude the browser scrollbar gutter.
- Development-only `Demo Preview Viewer` control is audit tooling and is not part of the production surface.

## Captures

| Surface | Route/state | 390 | 768 | 1440 |
| --- | --- | --- | --- | --- |
| Home | `/`; permanent fallback hero and populated featured games | [390](./home-390.jpg) | [768](./home-768.jpg) | [1440](./home-1440.jpg) |
| Game Detail | `/game/g1`; completed final with score | [390](./game-final-g1-390.jpg) | [768](./game-final-g1-768.jpg) | [1440](./game-final-g1-1440.jpg) |
| Game Detail | `/game/g11`; upcoming playoff | [390](./game-upcoming-g11-390.jpg) | [768](./game-upcoming-g11-768.jpg) | [1440](./game-upcoming-g11-1440.jpg) |

## Measured acceptance checks

- Identity badge: 64 × 64 px at 390; 72 × 72 px at 768 and 1440.
- Badge outline: 2 px octagonal team-color field with three 2 px ray strokes spanning 32/24.8/24 px at mobile size.
- Home focal geometry: 37.9% of the hero width at 768/1440; replaced by a 32 × 32 px edge mark below 768.
- Final score: 44 px at 390; 56 px at 768/1440.
- Upcoming time: 44 px at 390; 48 px at 768/1440.
- Event frame: 2 px structural border; gold for the playoff example, neutral for the completed regular-season example.
- No horizontal overflow was observed at any target viewport.
- The initial 390 px upcoming layout allowed the 44 px time to collide with team labels. It was rejected, revised to a full-width centered mobile row, and recaptured. Final bounding-box checks report no overlap with either team identity.
- New structural surfaces compute `animation-name: none`; their meaning and identity are fully present without motion.

## Cold-visibility verdict

**PASS.** In the unannotated 1440 px Home still, the gold Sandia/ray focal geometry is immediately visible as the rightmost 37.9% of the hero. In all three 1440 px stills, the octagonal team badges and projected rays are independently visible without magnification or explanation. Neither depends on photography, animation, hover, or prior knowledge.
