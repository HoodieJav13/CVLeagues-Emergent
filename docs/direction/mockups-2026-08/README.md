# Direction mockups — August 2026

Five full-commitment Home treatments, built for owner reaction after the
2026-08-06 direction conversation (owner: current UI several levels below
intent, hates the navy base; partner: existing UI acceptable). Serve this
folder statically and flip variants with the bottom pill; view at phone width.

- **A · High Desert Daylight** — owner favorite. Adobe plaster field, chalk
  panels, hard offset shadows, drawn horizon with sun mark. Candidate LIGHT
  half of a day/night switch (dark remains the mandatory default).
- **B · Friday Lights** — broadcast: warm black, light pools, huge numerals,
  gold ticker, no cards.
- **C · Night Game** — synthesis; owner specifically loves its Sandia-sunset
  gradient.
- **D · A-Night** — A's dark twin: same grammar inverted (dark adobe panels,
  cream borders, black offset shadows), crescent moon + star on the horizon,
  C's sunset as the dusk band. Candidate DARK default.
- **E · Tuned Classic** — the partner's track: the existing identity
  (hexagons, teal, moon, same layout) with craft upgrades only — deeper ink
  instead of navy, depth from light instead of 1px borders, committed type
  scale, tightened rhythm.

None of these amends the Art Direction Contract yet. A chosen direction
becomes a new addendum ratified by the owner; only then does implementation
begin. Engineering note preserved from the build: a `.heroC > *` child rule
silently overrode the sunset layer's positioning for four iterations — scope
content-lifting rules with `:not()` when a sibling layer must keep its own
positioning.
