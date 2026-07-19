# CVF Leagues — Art Direction Contract
*Pass 2 deliverable. Governs Pass 3 vertical-slice, Pass 4 systemize, Pass 5 motion. Any deviation from this doc during implementation is a stop-and-ask, not a judgment call.*

## Balance

**70% broadcast/editorial · 20% Albuquerque/local-culture · 10% cinematic.**
Broadcast/editorial governs by default. Culture is texture, not wallpaper. Cinematic is a small number of *earned* moments, not ambient decoration.

## Typography (contract, not new decisions)

- Page `h1` → `text-display-xl` (40px), uppercase, `text-foreground`. Section `h2` → `text-display-lg` (30px). This is the existing contract — Pass 1 found it inconsistently applied; restore it exactly, do not invent a new size.
- Score/metric display faces scale by context and viewport (already proven sound: ~44px mobile / ~64px desktop on featured cards, ~28px on ordinary cards). Preserve this ladder; extend it to any new card type rather than replacing it.
- Metadata (dates, locations, labels) stays small and recessive — 12–14px, muted color. It should never visually compete with score or team name.
- No new typefaces. Oswald (display) + Inter (body) remain the entire type system.

## Palette

- Locked: dark neutral canonical surface, teal (brand/action), Zia gold (achievement/emphasis), Zia red (live/alert only), flag-football orange (sport accent).
- No new hues introduced for texture or culture elements — they render in the existing palette at reduced opacity, not as new brand colors.

## Local-culture layer (the 20%)

- **Ray-line motif** (radiating line groups, drawn from the Zia sun symbol already in the logo) is the primary reusable graphic device: card dividers, corner accents, section-break rules, a subtle radiating treatment behind a hero stat.
- **Guardrail:** the full circle-and-rays Zia icon stays confined to existing logo lockups. Do not multiply the complete symbol across components — extract only the ray-line as an abstracted graphic element.
- Sandia ridge silhouette, topographic contour lines, and court-marking line-work are the supporting motif set. All render as low-opacity texture — atmosphere, never competing with data.
- Culture texture is allowed on: card backgrounds, dividers, section transitions. Not allowed on: data cells, buttons, form fields, or anywhere it could reduce legibility or touch-target clarity.

## Photography (no real photos yet — this is the load-bearing decision)

- Hero, profile, and team zones are designed **fallback-first**: logo mark + ray-line/topographic texture + team/brand color, composed to look like a deliberate design choice, not an empty slot waiting for a photo.
- Every photography zone ships with this fallback as the real, permanent-feeling state. When photos arrive later, they occupy the same zone with the same crop/overlay treatment — no redesign required, no visual "upgrade" moment that makes the fallback look like it was always temporary.

## State language

- **Live:** red badge + pulsing dot; reduced-motion fallback is a static red badge with "LIVE" label — the pulse is decoration, the label is the signal.
- **Upcoming:** teal outline badge.
- **Final:** neutral/muted badge; winner gets the existing winner-bar treatment (bold name + full-opacity score), loser recedes (muted name + reduced-opacity score). Keep as-is — Pass 1 confirmed this pattern works.
- **Playoff/stage:** existing gold banner treatment, unchanged.
- **Eliminated** *(new — brackets aren't populated yet, define now)*: desaturated card treatment, reduced opacity on team identity, no winner bar since there's no game score being emphasized — this is a standings-state, not a score-state. Small "Eliminated" label, muted, no red (red stays reserved for live).
- **Clinched/Advanced** *(new)*: brief gold flourish on the moment of transition (see motion below), settles into the same visual weight as any other winning team afterward — the celebration is temporal, not a permanent badge.

## Motion personality

- Verbs: *settle, shift-weight, reveal.* Not: bounce, spin, cartoon overshoot.
- Micro-interactions: 150–300ms. Transitions: 400–600ms. Easing: ease-out, confident stop — nothing that lingers or oscillates.
- **Distribution model:** cinematic weight spreads across small state-transition beats rather than concentrating in one feature — a game settling into FINAL, a clinch/elimination moment, a standings rank change. These are the primary 10%. One secondary showcase target (bracket reveal or championship game detail) may run longer and more elaborately, using the same motion vocabulary, once brackets have real data — not a separate design language.
- `prefers-reduced-motion` always has a complete, non-animated equivalent that communicates the same state change via instant color/label — motion is enhancement, never the only signal.
- Performance floor: 60fps target on a 3-year-old mid-range Android, not just the dev's machine.

## Density by surface

- Public spectator pages (Home, Schedule, Standings, Playoffs, Leaderboards, Game, Team, Profile): generous spacing, editorial breathing room, full expressive treatment above.
- Operational surfaces (Admin, intake, payments, score entry): inherit tokens and status language only. Denser, faster, calmer — no texture, no cinematic beats, minimal motion beyond functional feedback.

## Explicit anti-patterns

- Generic SaaS card grids with no hierarchy variation.
- Gratuitous glow, neon, or gradient-mesh backgrounds.
- Constant idle/ambient animation (anything that moves without a state change to communicate).
- Decorative charts where a list or table communicates faster (dither-kit and similar chart libraries stay shelved).
- Full Zia sun icon used decoratively outside the logo lockup.
- Stock or placeholder photography used to "fill" a zone before real photos exist — use the designed fallback instead.

## Change control

Any addition to this contract (new motif, new state, new motion pattern) gets recorded here before implementation — Pass 3/4/5 execute this document, they don't extend it silently.
