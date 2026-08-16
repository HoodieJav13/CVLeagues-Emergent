---
target: Inlay direction poster (next.html) vs v2 baseline
total_score: 18
max_score: 24
na_heuristics: 5,7,9,10
p0_count: 0
p1_count: 3
timestamp: 2026-08-16T21-28-33Z
slug: docs-direction-mockups-2026-08-next-html
---
# Critique — Inlay direction poster (`next.html`) vs v2 baseline 23/32

Provenance: Assessments A (design review) and B (detector + browser + contrast math) ran as two isolated parallel sub-agents; synthesis after both returned. Not degraded. (A transiently saw B's overlay in the shared static server's page mid-run, discarded it, and reloaded before judging; isolation held in substance.)

## Design Health Score (next.html, Persuade surface — static direction poster)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Red keyline under FINAL collides with the app's red=live signal — a final can misread as live |
| 2 | Match system/real world | 3 | "Sundays are set in stone" over Tue 6:30 PM / Fri fixtures |
| 3 | User control & freedom | 2 | All links `#` stubs; switch text-selects on tap; no day-mode preview |
| 4 | Consistency & standards | 2 | Turquoise carries five roles (brand, label, time, link, winner score); winner recolor departs from locked Final treatment; h1 32px vs contract 40px |
| 5 | Error prevention | n/a | Static poster, no input to protect |
| 6 | Recognition over recall | 4 | Everything labeled in place; nothing to remember |
| 7 | Flexibility/efficiency | n/a | Persuade surface |
| 8 | Aesthetic & minimalist | 4 | Two team rows + one meta line per plate; hierarchy from stone color and score size, not decoration |
| 9 | Error recovery | n/a | No error-capable states |
| 10 | Help & documentation | n/a | Persuade surface |
| **Total** | | **18/24 (75%)** | **Good — first authored direction in the program** |

Cross-target comparison (different heuristic sets, not like-for-like): v2 scored 23/32 = 71.9%; Inlay scores 18/24 = 75%, with zero P0s where v2 had two.

## Design specificity: AUTHORED (Inlay); W is deliberately the generic comparator

The bezel-chip system is a real translation of NM silverwork into semantic UI structure — recessed well, clip-path silver rim, meaning-bearing stones (gold = rank 1, turquoise = winner, team-color = identity) — visible cold at 375px. The 4px team-color sliver quarantines arbitrary team hues so they never tint the page: thinking, not theming. Copy and geography are real-ABQ throughout; the join block placement follows IA reasoning, not splash habit. Warm graphite everywhere; zero navy. W ("Classic, warmed") would ship for any rec product with a logo swap — acceptable as the conservative pairing, but it is the safe reading, not the direction.

## Detector (Assessment B)

CLI scan: clean (0 findings). Runtime overlay: 19 findings in state I, 18 in state W. Seventeen are `ai-color-palette` hits firing on the owner's deliberate desaturated turquoise `#3FBFB2` — false positives (hue pattern-match, not stock cyan neon); `overused-font: Inter 69%` is the adjudicated locked-typography false positive (ignore.md). **The one real runtime keeper: the join CTA "Submit team interest" text `#06312C` at 2.6:1 against the turquoise gradient's dark end `#14776D` — confirmed against rendered pixels, and matched exactly by mechanical worst-case math.** Contrast table otherwise strong: all body/muted/accent text pairs pass 4.5:1 with room (5.7–15.7); winner scores pass 3:1 large-text at 7.6:1. Marginal gradient-endpoint fails on stone bezel (2.62 worst-case, ~4.1 midpoint) and gold bezel (4.04 worst-case, ~5.7 midpoint); W's red team-initials at ~3.7:1 are decorative and duplicated by the adjacent 13.9:1 team name.

## What's working

1. **The bezel chip is an ownable, semantic signature** — structure that encodes rank/winner/identity, drawn from NM silverwork, spottable in a cold screenshot at 375px. Closest thing this program has produced to a reference-tier device.
2. **Hue discipline that solves a product problem** — team colors live only in stones and slivers, so any team palette scales by construction; warm graphite kills the navy risk structurally.
3. **Real-homepage honesty** — slim identity band, straight into this week's games, poetry demoted to the join block; correct Apple-Sports-anchored IA, rare in a pitch surface. The winner-stone glint (once, 1.6s, reduced-motion-safe) is the contract's "celebration is temporal" idea executed.

## Priority issues

- **[P1] Red keyline under FINAL violates "Zia red = live/alert only."** The contract's palette lock and Eliminated clause are explicit; the poster stamps `--red-thread` under the one state that is definitionally not live. The source cites an owner 2026-08-12 "single red thread" spec — but that is not recorded in the contract, so the two documents conflict. Fix: gold/silver hairline for the stamp, or record the red thread as a contract addendum via change control before adoption. Never both-silently.
- **[P1] The decided sun/moon state mark (Addendum 6) is missing in Inlay and mis-drawn in W.** Both fixture games are night games; Inlay shows no mark, W shows a bare crescent without the gold star on only one card. A direction that silently retires a shipped, owner-decided identity element isn't presenting a choice — it's making one. Fix: render the decided crescent+star in the plate label row (it reads naturally as another set stone), or pitch removal as a named tradeoff.
- **[P1] Join CTA text fails contrast at the gradient's dark end (2.6:1, needs 4.5:1).** Detector-confirmed on rendered pixels. The conversion element on a persuade surface cannot be the page's least-legible text — the same class of defect that blocked v2's winner-gold. Fix: lighten the gradient's dark stop or darken to a single flat turquoise fill (W's flat `btnE` passes at 6.3:1).
- **[P2] Header wraps at exactly 375px** — "CVF SPORTS" breaks onto two lines at the one width the product guarantees. Fix: nowrap + tighter nav gap or collapse nav.
- **[P2] Fixture copy contradicts fixture data** — "Sundays are set in stone / Sundays across Albuquerque" over Tue/Fri games. A cautious joiner reads that as sloppiness. Fix: make the seed games Sunday.

## Persona red flags

- **First-time joiner:** passes the legitimacy sniff (real venues, standings, crafted finish) but the nav is 100% spectator — joining exists only after three screens of mobile scroll; the Sunday/Tuesday contradiction is the detail a cautious adult notices before handing over a phone number.
- **Phone in sunlight at a field:** the facts this persona needs (time at 11px caps, venue at 12.5px muted) are the most recessive text on an all-dark surface — and the direction currently has no day answer at all.
- **Stress tester:** 375px header wrap; bottom pill occludes standings row 1 mid-scroll; switch text-selects on tap; `role="tablist"` without `role="tab"`; no long-team-name truncation (`.setname` lacks `min-width:0`); duplicated inline away/home styles (lines 217/222) are a copy-paste seam that will ship a bug.

## Minor observations

- Turquoise semantic overload (five roles) + winner-recolor departs from the locked Final treatment — if adopted, keep winner emphasis as weight/opacity (the stone already marks the winner) and reserve teal text for action.
- Hexagon clip-path is correctly flat-top (Addendum 5 shape); container queries used per the installed skill; focus-visible on every interactive element; en-dashes in records; glint is once-only with reduced-motion kill.
- h1 32px vs the locked 40px display-xl; score numerals 38–40px sit just under the mobile ladder.
- No LIVE state shown — the poster never demonstrates how the "red thread" coexists with red-as-live, which is exactly the P1 collision.
- Standings adoption would need Addendum 4 T-rank handling — not shown.

## Contract-compliance summary

Violations/deviations needing explicit owner resolution: red-on-FINAL (palette lock), missing/mis-drawn Addendum 6 mark, h1 size, winner-recolor semantics. Legitimate proposed supersession requiring an addendum if chosen: bezel well replacing Addendum 5's 3px offset outline. Compliant: typography stack, no chart libs, no full Zia, fallback-first identity, motion vocabulary and reduced-motion, warm-graphite (no navy), Addendum 2 bold+conservative pairing, no rejected toolbox tools.

## Questions to consider

1. **If the stone is the signature, why isn't the score the stone?** The most loaded number on the page floats free in overloaded teal while initials get bezels. Score-as-stone would make the metaphor load-bearing and resolve the teal overload in one move.
2. **Is one ceremonial red line worth diluting the only alarm color?** What does the thread buy that a gold stamp doesn't — and what does it cost the first time a live game and a final share a screen?
3. **What is Inlay at 1 PM?** Kickball happens in daylight; silverwork-at-night is a dark-only conceit. Is the missing day answer a knowing scope choice or a hole in the direction?
