# CVLeagues — Design Token Spec (Phase 8)

**Purpose:** Single source of truth for the strictly-visual upgrade pass. Paste this into Claude Code at the start of Phase 8. Every value below is a token — apply tokens, do not invent new colors, sizes, or styles. This is a cosmetic sweep: **no functional changes, no logic changes.**

**Derived from:** CVF brand assets (teal/cyan + black + New Mexico Zia red identity).

**Theme:** Dark mode is the canonical default. All surface, text, and status tokens below are the dark values Claude Code should implement. A light theme can be derived later by overriding the surface/text/status groups — the brand-core accents are shared across both.

---

## 1. How to use this file

- Implement these as CSS custom properties (`:root` variables) and Tailwind theme extensions — one place, referenced everywhere.
- Replace hardcoded colors, font sizes, and ad-hoc spacing in components with these tokens.
- If a component needs a value not in this spec, stop and flag it rather than inventing one.
- Do not change component logic, data flow, routing, or state. Presentation only.

---

## 2. Color tokens

### Brand core
| Token | Hex | Use |
|---|---|---|
| `--cvf-teal` | `#5BB8CC` | Primary brand + primary action color |
| `--cvf-teal-deep` | `#3A8A9E` | Hover/pressed states for teal elements |
| `--cvf-teal-tint` | `#10282E` | Deep teal wash background (upcoming cards, selected states) |
| `--cvf-ink` | `#0F1416` | Darkest ink — text on light/accent fills, deepest outlines |
| `--cvf-zia` | `#FF5A6E` | Zia red — live/alert accent ONLY, used sparingly (brightened for dark) |
| `--cvf-zia-deep` | `#C8102E` | Hover/pressed for red elements |
| `--cvf-gold` | `#F5B82E` | Zia gold — secondary accent (highlights, emphasis, leaders) |
| `--cvf-gold-deep` | `#D49613` | Hover/pressed for gold elements |
| `--cvf-gold-tint` | `#2E2410` | Deep amber-brown wash background (highlight rows, callouts) |

### Surfaces & neutrals (dark mode — canonical)
| Token | Hex | Use |
|---|---|---|
| `--surface` | `#0F1416` | Page background (near-black, slight teal-cool tint) |
| `--surface-raised` | `#171D20` | Cards, modals, raised panels |
| `--surface-sunken` | `#0A0E10` | Section backgrounds, table header rows (recedes below surface) |
| `--border` | `#2A3236` | Default hairline borders, dividers |
| `--border-strong` | `#3C464B` | Emphasized borders, standings header underline |
| `--text-primary` | `#F4F6F5` | Body and heading text (off-white, not pure white) |
| `--text-secondary` | `#A8B0AD` | Labels, metadata, captions |
| `--text-muted` | `#6B7470` | De-emphasized / placeholder text |
| `--text-on-brand` | `#0F1416` | Dark ink text sitting on teal/gold fills |

**Dark mode is the app default.** Surfaces stack by getting *lighter* as they rise (sunken → surface → raised). Pure black and pure white are both avoided — `--surface` carries a faint cool tint, text tops out at off-white to reduce glare.

### Functional / status (dark mode — accents brightened for contrast on dark surfaces)
| Token | Hex | Use |
|---|---|---|
| `--status-live` | `#FF5A6E` | Live game — brightened Zia red. The only place red appears at full strength |
| `--status-live-bg` | `#3A1419` | Live badge pill background (deep red-black) |
| `--status-upcoming` | `#6FCFE3` | Upcoming game — brightened teal |
| `--status-upcoming-bg` | `#10282E` | Upcoming badge pill background (deep teal-black) |
| `--status-final` | `#A8B0AD` | Completed game — neutral gray (intentionally quiet) |
| `--status-final-bg` | `#1C2327` | Final badge pill background |
| `--win` | `#F4F6F5` | Winner text — full off-white, full weight |
| `--loss-text` | `#6B7470` | Loser text — muted gray, lighter weight (de-emphasis, not alarm) |
| `--leader` | `#F5B82E` | Stat leader / first-place highlight — Zia gold (holds full strength on dark) |
| `--leader-bg` | `#2E2410` | Background wash for a highlighted leader row (deep amber-brown) |

**Where gold earns its place (not decoration):** stat leaders, first-place standings row, and "highlight" emphasis. This gives each accent a distinct job — teal = brand/action, gold = achievement/emphasis, red = live/alert. Three signals, three meanings, no overlap.

**Rationale for win/loss:** the losing side de-emphasizes via color + weight, it does not turn red. Red is reserved for "live" so the signal stays meaningful.

---

## 3. Typography tokens

### Typefaces
| Role | Family | Fallback stack | Notes |
|---|---|---|---|
| Display | **Oswald** | `'Oswald', 'Saira Condensed', system-ui, sans-serif` | Athletic, condensed — scoreboards, team names, page titles. Used with restraint. Single-token swap if you change it later. |
| Body | **Inter** | `'Inter', system-ui, -apple-system, sans-serif` | Schedules, standings, all reading text. Optimized for scannability. |
| Numeric | **Inter** (tabular) | use `font-variant-numeric: tabular-nums` | Scores, standings figures, jersey numbers — must align in columns. |

*Default is Oswald (no licensing concern, loads from Google Fonts or self-hosted). The family is a single token — swapping it later (e.g. to Saira Condensed) is a one-line change that propagates everywhere. Body stays system-ui if avoiding a second font load; flag before adding one.*

### Type scale
| Token | Size / Line | Weight | Use |
|---|---|---|---|
| `--text-display-xl` | 40px / 1.05 | 700 | Page hero titles (display face) |
| `--text-display-lg` | 30px / 1.1 | 700 | Section titles, team names on detail pages |
| `--text-heading` | 22px / 1.2 | 600 | Card titles, modal headers |
| `--text-subheading` | 17px / 1.3 | 600 | Sub-sections, week/date group headers |
| `--text-body` | 15px / 1.5 | 400 | Default reading text |
| `--text-body-strong` | 15px / 1.5 | 600 | Emphasized inline (winner, key labels) |
| `--text-label` | 13px / 1.4 | 500 | Field labels, metadata, eyebrows (uppercase, +0.04em tracking) |
| `--text-caption` | 12px / 1.4 | 400 | Timestamps, footnotes, helper text |
| `--score-figure` | 28px / 1 | 700 | Score numbers (display face, tabular) |

---

## 4. Spacing, radius, elevation

### Spacing scale (4px base)
`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-5: 24px` · `--space-6: 32px` · `--space-8: 48px` · `--space-10: 64px`

Use the scale for all padding, margins, and gaps. No arbitrary values.

### Radius
| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Badges, pills, inputs, small chips |
| `--radius-md` | 10px | Cards, buttons |
| `--radius-lg` | 16px | Modals, large panels |
| `--radius-full` | 9999px | Avatar/circle elements, status dots |

### Elevation (dark mode)
On dark, depth comes primarily from **surfaces getting lighter as they rise** (sunken → surface → raised), with shadows as a secondary cue. Shadows are deeper/blacker than light mode and paired with a subtle top hairline on raised elements.
| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.40)` | Resting cards |
| `--shadow-md` | `0 4px 14px rgba(0,0,0,0.50)` | Hovered cards, dropdowns |
| `--shadow-lg` | `0 14px 36px rgba(0,0,0,0.60)` | Modals |

---

## 5. Component patterns (apply, don't redesign)

### Status badge pills
- Shape: `--radius-sm`, padding `2px 10px`, `--text-label`, uppercase.
- A small leading dot (`--radius-full`, 6px) in the status color, with text in the status color and the matching `-bg` token behind.
- **Live**: add a subtle pulse on the dot only (respects `prefers-reduced-motion` — no pulse when reduced).
- Final / Upcoming: static, no animation.

### Game cards — winner/loser weighting (completed games)
- Winner row: `--win` text, `--text-body-strong`, score in `--score-figure`.
- Loser row: `--loss-text`, regular weight.
- A thin 3px leading bar in `--cvf-teal` on the winner's side. No background-color change to the whole card.

### Upcoming vs recent-result cards (visual distinction)
- Upcoming: `--surface-raised` with a `--cvf-teal-tint` left edge accent and the Upcoming pill.
- Recent result: `--surface-raised`, neutral, Final pill, winner/loser weighting applied.

### Standings table
- Header row: `--surface-sunken` background, `--border-strong` bottom border, `--text-label` uppercase column heads.
- Figures: tabular nums, right-aligned. Zebra striping via `--surface` / `--surface-sunken` at very low contrast only.
- First-place row: `--leader-bg` background wash with a `--cvf-gold` left edge bar (2px). Subtle, not loud.
- Sport icon chip on mixed/cross-sport cards, sized to cap-height of the row label.

### Buttons
| Variant | Fill | Text | Hover |
|---|---|---|---|
| Primary | `--cvf-teal` | `--text-on-brand` | `--cvf-teal-deep` |
| Destructive | `--cvf-zia-deep` | `--text-primary` | `--cvf-zia` |
| Secondary | transparent, `--border-strong` outline | `--text-primary` | `--surface-sunken` bg |
| Ghost | transparent | `--cvf-teal-deep` | `--cvf-teal-tint` bg |

All buttons: `--radius-md`, `--text-body-strong`, visible keyboard focus ring (2px `--cvf-teal`, 2px offset).

### Empty states
- Centered, `--text-secondary`, one short directive line in the interface's voice (not an apology).
- Examples to standardize on:
  - Empty standings: "No games played yet. Standings appear once scores are entered."
  - Empty roster: "No players assigned. Add a player to start this roster."
  - Empty score-entry roster: "This team has no players yet. Assign players before entering a score."

---

## 6. Accessibility floor (non-negotiable, still cosmetic)
- All text/background pairings meet WCAG AA (4.5:1 body, 3:1 large text) on the dark surfaces. The brightened accents (`--status-live`, `--status-upcoming`) are tuned to pass on `--surface`/`--surface-raised`; the deep `-bg` tints are for fills behind colored text, not for text themselves. Never put `--text-body` in a saturated accent — keep body text in the `--text-*` neutrals.
- Visible keyboard focus on every interactive element.
- `prefers-reduced-motion`: disable the live-pulse and any transitions beyond instant.
- Status is never communicated by color alone — the pill always carries a text label (this also satisfies the existing `<EligibilityIndicator>` icon+tooltip principle).

---

## 7. Out of scope for this pass (do NOT touch)
- Any data shape, API call, routing, or state logic.
- The env-gated role switcher, FINAL_DRAFT gating, or any feature flag behavior.
- Eligibility logic (display only — already informational).
- Adding or removing features. This is the cosmetic sweep only.

---

*CVF Sports — Built different. Built to last.*
