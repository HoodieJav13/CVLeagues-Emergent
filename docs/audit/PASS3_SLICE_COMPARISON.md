# Pass 3 Vertical-Slice Comparison

- **Contract:** [`../direction/CVLeagues_Art_Direction_Contract.md`](../direction/CVLeagues_Art_Direction_Contract.md)
- **Primary journey:** Home → Schedule → Game Detail
- **Base commit on `main`:** `65ee435` — `Restore page-title token contract (Pass 1 finding)`
- **Evidence:** [`pass3-captures/MANIFEST.md`](pass3-captures/MANIFEST.md)
- **Decision status:** owner comparison pending; this document intentionally makes no winner recommendation.

## Shared implementation

Both branches implement the same content structure and contract behavior. They differ only in how the ray-line motif is composed.

Shared files:

- `frontend/src/components/direction/Pass3Prototype.js` — fallback hero/team zones and the postseason state rail.
- `frontend/src/data/pass3Prototype.js` — clearly marked prototype-only Eliminated and Clinched entries; it does not modify `seed.js`.
- `frontend/src/components/common/Badges.js` — Upcoming becomes the contracted teal outline; Live remains red with a pulsing dot and text label; Final remains neutral.
- `frontend/src/components/game/GameCard.js`, `frontend/src/pages/Home.js`, `frontend/src/pages/Schedule.js`, `frontend/src/pages/GameDetail.js` — apply the shared fallback, state, and motion examples to the real slice.
- `frontend/src/index.css` — branch-specific motif plus identical press/final transitions and reduced-motion fallbacks.

The existing Sandia SVG remains the non-photographic hero base. The fallback adds the existing logo lockup, approved palette, and the branch motif; no stock or placeholder photograph is introduced. Game Detail replaces flat team initials with permanent-feeling team-color fallback zones that can accept future photography without changing their footprint.

## Treatment A — Textured surface

- **Branch:** `pass3-slice-textured-surface`
- **Tip:** `42908c5`
- **Implementation commit:** `599540f`
- **Diff from main:** 9 files, 197 insertions, 16 deletions.

### Composition

Abstract ray groups and contour-like ellipses sit behind content at low opacity. The texture is clipped toward the right side of hero, featured score, game-card, Game Detail, team fallback, and state-card surfaces. It never enters buttons, form fields, tables, or data cells.

Evidence: [Home 1440](pass3-captures/textured-home-1440.png) · [Schedule 390](pass3-captures/textured-schedule-390.png) · [Game Detail 1440](pass3-captures/textured-game-g1-1440.png)

### Contract fit

| Contract item | Application |
| --- | --- |
| 70/20/10 balance | Existing broadcast hierarchy remains dominant; culture appears as restrained atmosphere; cinematic weight is limited to two short transitions. |
| Typography and palette | Existing Oswald/Inter ladder and approved teal/gold/red/orange palette are unchanged. The 40px page title from Step 0 remains intact. |
| Ray-line guardrail | Only abstract lines and contour arcs are drawn; the complete Zia symbol appears only inside the existing logo lockup. |
| Fallback-first zones | Home hero and Game Detail team marks look complete without photography and retain stable image-ready footprints. |
| State language | Upcoming is teal outline, Final neutral, playoff banner unchanged, Eliminated desaturated/muted, and Advanced uses a temporal gold flourish. |
| Density | The public slice keeps existing editorial spacing; filters and data tables remain untextured and legible. |
| Motion and access | Press feedback is 180ms; Final settles in 520ms with a strong ease-out. Pointer hover is gated, global focus remains visible, and reduced motion removes transforms/animations. |

### Tension and tradeoff

The texture gives the strongest culture presence and makes the three pages feel like one broadcast package. Because it repeats across multiple card surfaces, it competes most directly with the “spend boldness in one place” discipline. Opacity and right-side masking keep data legible, but rollout would require careful per-component restraint to avoid turning the motif into ambient wallpaper.

## Treatment B — Structural line

- **Branch:** `pass3-slice-structural-line`
- **Tip/implementation commit:** `901130f`
- **Diff from main:** 9 files, 256 insertions, 16 deletions.

### Composition

Cards remain visually quiet. Short line groups act as explicit corner marks and border extensions: teal denotes Upcoming/brand, gold denotes playoff/Advanced, neutral lines denote Final/Eliminated, and team marks inherit team color. The hero uses a teal corner group plus gold baseline around the permanent fallback zone.

Evidence: [Home 1440](pass3-captures/structural-home-1440.png) · [Schedule 390](pass3-captures/structural-schedule-390.png) · [Game Detail 1440](pass3-captures/structural-game-g1-1440.png)

### Contract fit

| Contract item | Application |
| --- | --- |
| 70/20/10 balance | Broadcast/data surfaces remain nearly unchanged; culture is concentrated into information-bearing edge details; motion remains two short moments. |
| Typography and palette | Existing Oswald/Inter ladder and approved palette remain unchanged. No new hue, font, or arbitrary type size appears. |
| Ray-line guardrail | Partial ray groups are literal linework; no decorative full Zia icon is created. |
| Fallback-first zones | Home and team zones retain the same stable composition as Treatment A, using structural marks instead of surface atmosphere. |
| State language | Identical labels, colors, winner treatment, stage banner, Eliminated state, and Advanced transition to Treatment A. |
| Density | Line accents occupy edges rather than content space; filters, data cells, buttons, and tables stay clear. |
| Motion and access | Identical 180ms press and 520ms Final transition, pointer gating, focus behavior, and complete reduced-motion fallback. |

### Tension and tradeoff

Structural marks preserve maximum scan speed and make it easier to prove why each line exists. Their culture signal is subtler, especially on mobile, and can read as ordinary border detailing if used too sparingly. Rollout would require a disciplined mapping from line color/placement to actual state so the device never becomes arbitrary decoration.

## Motion review

Following the `emil-design-eng` review format:

| Before | After | Why |
| --- | --- | --- |
| Static upcoming featured card | `scale(0.985)` press state with a specific 180ms transform/border transition | Confirms the card heard the press without bounce, overshoot, or `transition: all`. |
| Completed game enters at 72% opacity and `translateY(6px)` | Settles to full opacity and zero offset over 520ms using `cubic-bezier(0.23, 1, 0.32, 1)` | Communicates the rare transition into Final; it does not loop or delay interaction. |
| Motion-enabled behavior | Static label/color equivalent under `prefers-reduced-motion` | State remains completely understandable without movement. |

## Self-critique and revision record

- The first state-rail copy used internal phrases (“Prototype state check” and “Directional only”). Both branches were revised to the specific spectator-facing “Postseason update / Semifinal results / Summer 2026.”
- The browser did not expose a reliable pointer-hover frame. A prototype-only query-state hook now renders the same pressed transform deterministically for still evidence; it is clearly scoped and must not reach main.
- The full-page screenshot path was not used. All comparisons rely on viewport-only captures at the requested dimensions.
- No generic cream/serif/terracotta, neon-on-black, newspaper-column, stock-photo, gradient-mesh, ambient-motion, or decorative-chart pattern was introduced.

## Verification

| Gate | Textured surface | Structural line |
| --- | --- | --- |
| Frontend suite | 27/27 suites, 91/91 tests | 27/27 suites, 91/91 tests on isolated rerun |
| Production build | Pass | Pass |
| Viewports | 390px, 768px, 1440px | 390px, 768px, 1440px |
| Horizontal overflow in audited slice | None observed | None observed |
| Console errors during capture | None observed | None observed |
| Real seed modification | None | None |
| Merge status | Unmerged | Unmerged |

The structural branch’s first suite run overlapped a production build and timed out one existing ScoreEntry test at its five-second limit. The complete suite was rerun alone and passed 91/91; no assertion or product failure remained.

## Owner comparison questions

These questions describe the decision boundary without recommending an answer:

1. Should local-culture identity be felt as atmosphere across the broadcast package, or read as explicit edge grammar tied to state?
2. Is repeated low-opacity texture acceptable on ordinary competition cards, or should the bold cultural gesture stay concentrated in hero/state zones?
3. On 390px screens, does the structural treatment remain distinctive enough, or does the textured treatment better preserve identity at the cost of more visual activity?

No rollout should begin until the owner selects one treatment or specifies a bounded revision to compare.
