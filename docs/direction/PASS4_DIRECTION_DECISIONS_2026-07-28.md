# Pass 4 — Direction Decisions (Phase 4 Interview, 2026-07-28)

Owner decisions taken in the discovery interview: **eight questions were asked,
producing the ten recorded rows below** (questions 1 and 4 each yielded two
decisions). These select directions; **no batch is authorized by this document.**
Each decision that amends the Art Direction Contract is marked ⚠ and must be
written into the contract as a numbered addendum at the start of the batch that
implements it — before implementation, per the contract's change-control rule.

Row 2 reverses recorded owner decisions rather than adding new territory, so it
was held provisional until it cleared the same evidence bar it overturns. **It
has now cleared it:** the owner reviewed gallery section E0 — octagon vs both
hexagon orientations, identical content at 64/44/28px in 375px frames — and
chose the hexagon from that comparison on 2026-07-28.

| # | Decision | Detail | Contract impact |
|---|---|---|---|
| 1 | **Ambient team color approved at B2 level** | Game Detail becomes a team-color environment (~38% mix fields meeting at the score). B3 full-bleed poster is approved **only** as a dedicated shareable frame, not the default game page. | Within fallback-first zones; record as clarifying addendum when built |
| 2 | **Identity badge becomes a hexagon — everywhere, for everything** | One shape (hexagon + 3px offset outline) for teams **and** players, replacing the octagon on all surfaces and the square/dots/circles elsewhere. Decided **from the E0 side-by-side** (octagon vs both hexagon orientations, identical content at 64/44/28px in 375px frames) — the evidence bar a reversal of two recorded decisions required (Pass 3 addendum :69; Addendum 4 :97, owner-directed). Orientation: **flat-top (E0-b)**, chosen against pointy-top in the same comparison. | ✅ **Recorded as Addendum 5** (2026-07-28): octagon retired with explicit supersession of Addendum 4 :97 and the Pass 3 scope note :69, citing E0 as basis |
| 3 | **Standings direction = A2, "the table is the monument"** | Leader hero row, 40px rank numerals, point-share bars, 28px league title, full mobile content parity (form/streak/ties — resolves the latent tie-honesty BLOCKING). | Within contract |
| 4 | **Data graphics approved behind controls** | Hand-drawn SVG data graphics (differential worm, sparklines) in team colors/existing palette are permitted when they communicate faster than the table they accompany — **disclosed behind an explicit control, never open by default, never background texture.** Chart libraries stay shelved. | ⚠ Amends the anti-pattern list |
| 5 | **Home = C2 game-day takeover** | Plus: swipeable (finger-driven, non-idle) today's-games score strip; body becomes recent results + recent registrations feed ("Westside Warriors just joined"). JOIN banner removed from data pages; newcomer CTA stays on Home below the fold. | Within contract (auto-drift ticker would need amendment; not chosen) |
| 6 | **Cinematic budget increase approved in principle** | 70/20/10 may shift (e.g., 65/20/15), spent on audience-guaranteed moments: game-day arrival, fresh-final settle, clinch/elimination. | ⚠ Amends the balance line when Pass 5 scopes it |
| 7 | **Rays: redraw as a time-aware sun/moon mark** | The current three-stroke corner rays are rejected as drawn. The motif becomes state-bearing: Zia-derived sun mark for day games, moon/crescent for night games (fixed local cutoff, e.g. 6 PM — not sunset math). Redrawn variants shown in-batch as the Addendum 2 pair. | ⚠ Amends the Pass 3 motif addendum |
| 8 | **Schedule mobile rows = D2 stacked scorelines** | Away over home, score per line, winner bold/loser muted; names never truncate; away/home becomes list-order convention (state it once in UI copy). | Within contract |
| 9 | **Voice register: broadcast base, local-warm lean** | Data surfaces speak broadcast; empty/community moments carry Albuquerque warmth; nothing sounds like a form validator. | New contract section when the copy pass lands |
| 10 | **Unkind fixture set approved for `seed.js`** | Owner-approved addition of tie, 0-0/forfeit, 38-char team name, two-enrollment franchise, and populated-bracket fixtures so the five currently-unauditable states become permanently auditable in mock mode. Rides with the first batch that needs it; touches the protected seed file under this explicit approval. | Process approval (seed governance) |

**Not yet decided / open for batch scoping:** sun/moon drawing itself; page-signature (X3) placement; per-entity OG cards (deferred, post-deployment); sunlight/outdoor variant (ladder item 14, unpriced); public live scoring (ladder item 15, product decision far beyond this pass).

**Separate from these decisions:** `.claude/launch.json` gained a `cvf-mock` entry during this pass (tooling so the dev server runs mock-mode without touching `.env.local`). It is a tracked-file change the owner did not request; keep or revert it as its own call at commit time — it is not covered by any approval in this document.

**Source artifacts:** [blind-spot pass](PASS4_BLIND_SPOT_PASS_2026-07-28.md) · [audit](PASS4_PRE_IMPLEMENTATION_AUDIT_2026-07-28.md) · [direction gallery](prototypes/2026-07-28-directions.html) · [captures](../audit/pass4-discovery-captures/MANIFEST.md)
