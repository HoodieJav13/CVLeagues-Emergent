# Pass 4 — Identity Batch Capture Manifest

- **Date:** 2026-07-28
- **Branch:** `pass4-batch-identity` (off `main` at `d550315`)
- **Data mode:** local mock seed via the `cvf-mock` launch entry (shell-level
  empty Supabase/Turnstile overrides; zero Supabase network requests).
- **Capture method:** Playwright (`playwright-core` driving the preinstalled
  Chromium headless shell in `~/Library/Caches/ms-playwright`), 2× device
  scale, `prefers-reduced-motion: reduce`. `/opt/pw-browsers` does not exist on
  this machine; `playwright install` was **not** run.
- **Viewports:** 375 × 812 (primary) and 1440 × 900.
- The floating `DEMO PREVIEW / VIEWER` chip is the env-gated development Role
  Switcher — audit tooling, not product surface.

## Step 1 render-proof (unkind fixtures, captured before the shape swap — badges still octagon)

| File | Viewport | Proves |
| --- | ---: | --- |
| `fixtures-standings-1440.jpeg` | 1440 | 38-char name unbroken; T column live; T3/T3 shared rank, next rank 5; forfeit W inside Sluggers 3-0; Roadrunners 0-1 with L1 |
| `fixtures-team-t1-franchise-375.jpeg` | 375 | Franchise History reachable: 2 seasons · 4-0 all time (Summer 2026 3-0, Fall 2025 1-0) |

## Step 2 — flat-top hexagon badge (Addendum 5), every surface

| File | Viewport | State |
| --- | ---: | --- |
| `home-375.jpeg` / `home-1440.jpeg` | 375 / 1440 | Featured scoreboard: base hexagons, winner/loser weighting intact |
| `home-gamecards-375.jpeg` | 375 | GameCards: `--sm` hexagons replace the 10px dots |
| `team-t1-375.jpeg` / `team-t1-1440.jpeg` | 375 / 1440 | Team header: base hexagon replaces the rounded-square tile; stat-leader `--md` player badges |
| `team-t1-roster-375.jpeg` | 375 | Roster PlayerCards: `--md` player hexagons (crown/eligibility details kept) |
| `team-t9-longname-375.jpeg` | 375 | 38-char team page beside the base hexagon |
| `profile-p1-375.jpeg` | 375 | Profile header: base hexagon (first CVF identity device on this page) |
| `profile-p1-teams-375.jpeg` | 375 | Team History rows: `--sm` team hexagons |
| `game-g1-boxscore-375.jpeg` | 375 | 64px game heads; box-score header + player rows on `--sm` hexagons |
| `game-g15-tie-375.jpeg` | 375 | Tie stress: 5–5 equal-weight beside the badges |
| `game-g16-forfeit-375.jpeg` | 375 | Forfeit stress: W/L + FORFEIT + 38-char name at 64px badge |
| `standings-375.jpeg` / `standings-1440.jpeg` | 375 / 1440 | `--sm` hexagons in the register incl. T3/T3 rows and t9 |
| `schedule-375.jpeg` / `schedule-1440.jpeg` | 375 / 1440 | Register hexagons; Forfeit focal row; 5–5 tie row |
| `leaderboards-375.jpeg` | 375 | Hero + ranked-row player hexagons; T1 ties; copper intact |
| `playoffs-flag-bracket-375.jpeg` / `-1440.jpeg` | 375 / 1440 | Populated bracket: `--sm` hexagons replace both dot sizes |

## Step 3 — sun/moon motif proposal pair (Addendum 6; drawing NOT decided)

Rendered in place via a temporary uncommitted wiring of
[`2026-07-28-sunmoon-mark-proto.jsx`](../../direction/prototypes/2026-07-28-sunmoon-mark-proto.jsx)
into the Game Detail event frame and Home featured cards, then reverted.
Day/night uses the Addendum 6 working cutoff (6:00 PM America/Denver); state
tones (teal upcoming / gold playoff / neutral final) are unchanged — the
sun/moon changes shape only. Variant A = contract-compliant; Variant B =
deliberately bolder (roughly 1.7× the corner zone, 3.5px vs 2px strokes, plus
a ≤22%-opacity tone wash).

| File | State |
| --- | --- |
| `motif-A-night-upcoming-g5.jpeg` | A · moon, teal, upcoming night game |
| `motif-A-night-final-g1.jpeg` | A · moon, neutral, final night game |
| `motif-A-day-final-g17.jpeg` | A · sun, neutral, 10:00 AM day game |
| `motif-A-playoff-upcoming-g13.jpeg` | A · gold tone; **mark collides with the StageBanner** (see finding) |
| `motif-A-home-featured.jpeg` | A · on Home featured cards |
| `motif-B-night-upcoming-g5.jpeg` | B · bold moon + stars + wash, teal |
| `motif-B-night-final-g1.jpeg` | B · bold moon, neutral |
| `motif-B-day-final-g17.jpeg` | B · bold sun, neutral |
| `motif-B-playoff-upcoming-g13.jpeg` | B · gold; same StageBanner collision |
| `motif-B-home-featured.jpeg` | B · on Home featured cards (slight sport-pill overlap, visible) |

### Moon revision (owner-directed, same day)

On owner review of the first pair the moon was judged not impactful enough for
what is in practice the league's default state (every current-season game is a
night game). Both moons were redrawn — **solid filled crescents replacing the
outlines** (mass registers on the dark surface where hairline outlines
disappear), and the bolder variant's crescent now carries the **badge's own
offset-echo signature** (a 45%-opacity duplicate shifted 3px lower-right, the
same grammar as the hexagon's offset outline). The suns are unchanged; the
`motif-A/B-*.jpeg` night shots above are superseded by these and kept only as
the decision trail:

| File | State |
| --- | --- |
| `motif-A2-night-upcoming-g5.jpeg` | A2 · solid crescent + star, teal, 2× area of A's outline moon |
| `motif-A2-night-final-g1.jpeg` | A2 · neutral tone on a final |
| `motif-A2-home-featured.jpeg` | A2 · on Home featured cards |
| `motif-B2-night-upcoming-g5.jpeg` | B2 · solid crescent + offset echo + two stars + 24% wash |
| `motif-B2-night-final-g1.jpeg` | B2 · neutral tone on a final |
| `motif-B2-home-featured.jpeg` | B2 · Home; the sport-pill overlap remains visible (placement finding below) |

### Shipped mark (owner decision: A2, white moon / gold star, corner cleared)

The owner chose A2 with fixed celestial colors — solid white
(`--text-primary`) crescent, gold (`--cvf-gold`) star, gold sun — and asked
for the corner to be cleared so the mark renders bigger. The StatusBadge now
clusters left beside the SportBadge on the Game Detail frame (and the sport
pill beside the label on Home featured cards), freeing the top-right corner
for the mark at 84×64 (~1.5× the proposed A2). On banner-topped playoff
frames the mark drops below the StageBanner. These captures show the
**shipped** component, not a prototype:

| File | Viewport | State |
| --- | ---: | --- |
| `mark-night-upcoming-g5-375.jpeg` / `-1440.jpeg` | 375 / 1440 | White crescent + gold star, corner unoccluded |
| `mark-night-final-g1-375.jpeg` | 375 | Same mark on a final (state reads from badge/border, not the mark) |
| `mark-night-forfeit-g16-375.jpeg` | 375 | Forfeit stress: mark coexists with CANCELED badge + long name |
| `mark-day-final-g17-375.jpeg` | 375 | Gold sun over horizon on the 10:00 AM Fall 2025 game |
| `mark-playoff-below-banner-g13-375.jpeg` | 375 | Below-banner placement rule on a gold playoff frame |
| `mark-home-featured-375.jpeg` / `-1440.jpeg` | 375 / 1440 | Home featured cards, label + sport pill clustered left |

**Findings shipped with the proposal (not resolved here):**

- **NON-BLOCKING (layout, must be resolved with the mark decision):** on
  playoff/tournament games the gold StageBanner occupies the frame's top edge
  and hides most of the corner mark; on Home featured cards the right-aligned
  sport pill grazes the mark. The chosen mark needs a placement rule for
  banner-topped and pill-adjacent frames.
- **Observation:** with the current schedule every current-season game starts
  at or after 6:30 PM — the sun mark will be rare in real data (day states in
  these captures come from the Fall 2025 fixture). Worth one owner thought on
  whether the cutoff hour makes day games meaningfully representable.
