---
target: v2 mockups (HD + Tuned Classic) vs v1-A
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
timestamp: 2026-08-12T04-10-58Z
slug: docs-direction-mockups-2026-08-v2-html
---
# Critique — v2 mockups (HD day/night + E2) vs loved reference v1-A

Provenance: Assessments A (design review) and B (detector + browser) ran as two isolated parallel sub-agents; synthesis after both returned. Not degraded.

## Design Health Score (v2 file, Persuade surface)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | E2's moon glyph decorates a FINAL card where it signifies nothing |
| 2 | Match system/real world | 4 | "First pitch" over a flag-football card is the one wrinkle |
| 3 | User control & freedom | 2 | ☀️/☾ toggle ambiguity (current state vs target?); contradicts Addendum 6's fixed 6 PM state |
| 4 | Consistency & standards | 2 | emoji vs glyph in one control; winner gold in HD vs teal in E2; hexagons in E2 only |
| 5 | Error prevention | 3 | static persuade surface, little to prevent |
| 6 | Recognition over recall | 3 | icon-only toggle; E2 footer requires design-team vocabulary |
| 7 | Flexibility/efficiency | n/a | persuade surface |
| 8 | Aesthetic & minimalist | 3 | toggle chrome; E2 ships internal metadata as visible copy |
| 9 | Error recovery | 3 | nothing misleads |
| 10 | Help & documentation | n/a | persuade surface |
| **Total** | | **23/32** | Competent-plus; direction-level defects dominate |

## Design specificity
v1-A: authored (letterpress poster for a real NM thing). HD-v2 day: same poster, cheaper stock. HD-v2 night: drifting generic-dark. E2: category-interchangeable — likable the way a good template is likable.

## Detector (Assessment B)
8 CLI findings (overused-font ×4 = the repo's locked Inter; dot-grid misread as line-field ×2; bounce-easing token decl; layout transition:height). Browser scans: day 14, night 17, E2 17 — with B self-identifying the night low-contrast rows as MID-TRANSITION timing artifacts and several E2 hits as targeting the hidden HD section. Real keepers: turquoise-on-cream 3.9:1 (day, text-sized uses), tag text at 10px, all-caps body 76 chars. Token-pair contrast (mechanical): all four muted pairs pass ≥5.2:1; failures live in accents, not muted text.

## THE DIAGNOSIS — why v1-A landed and HD-v2 doesn't (ranked)
1. **Day paid the night tax.** The OKLCH shared-chroma twin forced every day accent down together: teal #0F8A80→#227F75 (~27% sat loss, and it's the color of "DAY" itself), chile and gold duller, ink lifted #221B12→#292218. Legibility went UP; life went DOWN. Structural cause, not taste drift.
2. **Both emotional payoffs changed color role.** Winner score teal→gold = 2.6:1 on cream (fails 3:1 large-text) and severs the victory-speaks-in-brand-color rhyme. CTA gold→chile red = severs the sun-lands-on-the-button rhyme and violates the contract's "Zia red = alert/live only."
3. **The instrument entered the poster.** 34px color-emoji toggle in the nav of a flat-ink identity; crowds 375px (mark wraps); contradicts Addendum 6 (state-bearing mark, fixed 6 PM — weather, not preference).
4. **Night lost v1-D's hand-tuned warmth.** Panel #2B231C→#2F2B24 (khaki-gray), chile→salmon, dusk burn→pastel, and the moon's gold star was deleted.
5. **Micro-regularizations** (dropped letter-spacings etc.) sum to "cheaper print."

## Priority issues
- [P0] Day palette pays night tax → day = v1-A verbatim pigments; night derived freely toward v1-D. (BLOCKING, contract terms)
- [P0] E2 has no join CTA → conversion block absent from a persuade surface; also makes HD-vs-E2 comparison unfair. (BLOCKING)
- [P1] Winner gold on cream 2.6:1 → return day winner to teal. (BLOCKING as a11y)
- [P1] Emoji toggle → drawn state mark (shipped white/gold sun-moon), out of nav; product binds to 6 PM league time. (VISUALLY INSUFFICIENT + contract conflict)
- [P2] Night warmth: five value changes + restore the star. (VISUALLY INSUFFICIENT)

## What's working
Dusk band animating in on flip (real theater); disciplined structural fidelity (made the diagnosis clean); E2's 3-layer depth system is reference-tier and should ship in product dark surfaces regardless of direction verdict.

## Personas
Sunlight game-time check: the one needed fact is the smallest muted text everywhere; worst in E2. First-time joiner: red button reads alert on HD; NOTHING to click on E2. "Does it look legit?": OS-rendered emoji + shipped scaffolding text ("OKLCH-deepened ink") say unfinished.

## Questions
1. Why does day pay for night? 2. Is E2 liked, or merely recognized — is "likable" the bar, or "ours"? 3. If the winning score isn't in the league's color, whose win is it?
