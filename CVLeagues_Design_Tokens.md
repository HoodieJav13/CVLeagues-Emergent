# CVLeagues — Design Token Spec v2 (Phase 8c)

**Purpose:** Single source of truth for the visual system. v2 supersedes the Phase 8 spec: it keeps every locked decision, fixes the places where v1 was aspirational (a type/spacing/radius scale the codebase never adopted), corrects measured WCAG failures, and codifies patterns the code got right but v1 never documented. Every value below is a token — apply tokens, do not invent new colors, sizes, or styles.

**This is still a cosmetic spec: no functional changes, no logic changes.** The raw `<button>` → `<Button>` conversion in admin is explicitly **out of scope** (interactive surface, its own batch later).

**Theme:** Dark mode is the canonical default. All values below are the dark values. A light theme can be derived later by overriding the surface/text/status groups — brand-core accents are shared.

**Locked (do not revisit):** Oswald display / Inter body · teal = brand/action, Zia gold = achievement/emphasis, Zia red = live/alert only · dark canonical · status/eligibility never by color alone (icon + label + tooltip) · 44px minimum tap targets.

---

## 1. How to use this file

- Tokens live once in `frontend/src/index.css` (`:root`) and are referenced by `tailwind.config.js`. Change a token there, it propagates everywhere.
- The system now **meets the code where it is**: Tailwind's default `text-xs/sm/base` and `rounded-xl/2xl` utilities are remapped to token values (§8), so ordinary Tailwind reflexes land on the system instead of beside it.
- If a component needs a value not in this spec, stop and flag it rather than inventing one.
- §8 is the migration checklist for bringing the codebase in line with v2.

---

## 2. Color tokens

### Brand core
| Token | Hex | Use |
|---|---|---|
| `--cvf-teal` | `#5BB8CC` | Primary brand + primary action color |
| `--cvf-teal-deep` | `#3A8A9E` | Hover/pressed states for teal **fills**. Never body-size text on raised surfaces (4.3:1 — fails AA) |
| `--cvf-teal-tint` | `#10282E` | Deep teal wash background (upcoming cards, selected states) |
| `--cvf-ink` | `#0F1416` | Darkest ink — text on light/accent fills, deepest outlines |
| `--cvf-zia` | `#FF5A6E` | Zia red — live/alert accent ONLY, used sparingly (brightened for dark) |
| `--cvf-zia-deep` | `#C8102E` | Destructive button resting fill |
| `--cvf-zia-down` | `#A50D26` | **NEW** — hover/pressed for destructive fills. Destructive hover now **darkens**; v1's brighten-to-`--cvf-zia` put light text at 2.8:1 (hard AA fail) |
| `--cvf-gold` | `#F5B82E` | Zia gold — achievement/emphasis ONLY (stat leaders, first place, needs-attention pills) |
| `--cvf-gold-deep` | `#D49613` | Hover/pressed for gold elements |
| `--cvf-gold-tint` | `#2E2410` | Deep amber-brown wash background (highlight rows, callouts) |

### Sport accents — NEW
Sport identity gets its own tokens so gold stays achievement-only. v1 let the flag-football chip wear gold, which collided with the locked meaning (a gold sport chip beside a gold leader row or gold "Pending" pill read as one signal).

| Token | Hex | Use |
|---|---|---|
| `--sport-kickball` | `#5BB8CC` | Kickball accent — **intentional alias of `--cvf-teal`** |
| `--sport-kickball-tint` | `#10282E` | Kickball chip background — alias of `--cvf-teal-tint` |
| `--sport-flag` | `#FB923C` | Flag football accent — orange, brightened for dark (7.5:1 on raised) |
| `--sport-flag-tint` | `#2E1B0C` | Flag chip background (deep burnt-orange wash) |
| `--sport-flag-deep` | `#F97316` | Hover/pressed for flag-orange elements; also replaces the raw `#f97316` in `roles.js`/`seed.js` |

Orange means **flag football**, nothing else. It is not a fourth status signal.

### Surfaces & neutrals (dark — canonical)
| Token | Hex | Use |
|---|---|---|
| `--surface` | `#0F1416` | Page background (near-black, slight teal-cool tint) |
| `--surface-raised` | `#171D20` | Cards, modals, raised panels |
| `--surface-sunken` | `#0A0E10` | Section backgrounds, table header rows |
| `--border` | `#2A3236` | Default hairline borders (lives as HSL channels for the shadcn `border-border` utility — use the utility) |
| `--border-strong` | `#3C464B` | Emphasized borders, standings header underline |
| `--text-primary` | `#F4F6F5` | Body and heading text (off-white, not pure white) |
| `--text-secondary` | `#A8B0AD` | Labels, metadata, captions (7.7:1 on raised) |
| `--text-muted` | `#7E8883` | **CHANGED from `#6B7470`** — de-emphasized/placeholder text. Old value measured 3.5:1 on cards (AA fail); new value passes on every surface (4.65 raised / 5.07 surface / 5.30 sunken) |
| `--text-on-brand` | `#0F1416` | Dark ink text on teal/gold/orange fills |

**Pure black and pure white are banned in component code.** `text-black` on accent fills → `text-on-brand` (or `text-ink`); `text-white` → `text-foreground`. The only sanctioned white is the alpha overlay scale below.

### Overlay scale (dark-mode washes) — NEW, promoted from code
The white-alpha washes components already use are now official. These are the **only** allowed uses of pure white:

| Utility | Use |
|---|---|
| `bg-white/5` | Faint hover/selected wash on dark panels |
| `bg-white/10` | Stronger active/pressed wash |
| `border-white/15` | Hairline on translucent/floating elements |

No other white-alpha steps. If a wash needs to read "teal," use `--cvf-teal-tint`, not a tinted alpha.

### Functional / status
| Token | Hex | Use |
|---|---|---|
| `--status-live` | `#FF5A6E` | Live — **alias of `--cvf-zia`**. The only full-strength red |
| `--status-live-bg` | `#3A1419` | Live pill background |
| `--status-upcoming` | `#6FCFE3` | Upcoming — brightened teal |
| `--status-upcoming-bg` | `#10282E` | Upcoming pill background — **alias of `--cvf-teal-tint`** |
| `--status-final` | `#A8B0AD` | Final — **alias of `--text-secondary`** (intentionally quiet) |
| `--status-final-bg` | `#1C2327` | Final pill background |
| `--win` | `#F4F6F5` | Winner text — **alias of `--text-primary`**, full weight |
| `--loss-text` | `#7E8883` | **CHANGED** — loser text, **alias of `--text-muted`**. De-emphasis, not alarm; now AA-compliant at body size |
| `--leader` | `#F5B82E` | Stat leader / first place — **alias of `--cvf-gold`** |
| `--leader-bg` | `#2E2410` | Leader row wash — **alias of `--cvf-gold-tint`** |

### Rank accents (leaderboards) — NEW
Replaces the raw `#a1a1aa` / `#f97316` medal hexes in `Leaderboards.js`. Bronze is deliberately **not** the flag-football orange — different meaning, different value.

| Token | Hex | Use |
|---|---|---|
| (1st place) | use `--leader` | Gold — locked meaning |
| `--rank-silver` | `#A9B0B6` | 2nd place figure/name (7.8:1 on raised) |
| `--rank-bronze` | `#E08A4C` | 3rd place figure/name (6.4:1 on raised) |

### Alias policy
Tokens marked **alias** above are identical on purpose — they name a *role*, not a new color. Never diverge an alias's value independently; if a role ever needs its own value, that's a spec change, not a tweak.

### Status color semantics (codified from `Badges.js` — this is the real system)
v1 only described game pills. The code implements a four-role system across ~20 statuses; this is now the documented law:

| Role | Colors | Statuses |
|---|---|---|
| **Teal** — normal / positive / done | `--status-upcoming` + `--status-upcoming-bg` | upcoming, submitted, approved, new, assigned, active, verified |
| **Gold** — needs attention | `--cvf-gold` + `--cvf-gold-tint` | postponed, pending, contacted, invited |
| **Red** — alert / problem | `--status-live` + `--status-live-bg` | live, canceled, disputed, rejected |
| **Slate** — quiet / closed | `--status-final` + `--status-final-bg` | completed/final, archived, draft, duplicate |

Every pill carries a text label + leading dot — never color alone. Only `live` pulses (dot only, disabled under `prefers-reduced-motion`).

---

## 3. Typography tokens

### Typefaces
| Role | Family | Fallback stack | Notes |
|---|---|---|---|
| Display | **Oswald** | `'Oswald', 'Saira Condensed', system-ui, sans-serif` | Scoreboards, team names, page titles. Used with restraint |
| Body | **Inter** | `'Inter', system-ui, -apple-system, sans-serif` | All reading text |
| Numeric | **Inter** (tabular) | `font-variant-numeric: tabular-nums` | Scores, standings figures, jersey numbers |

**Weight ceiling: 700.** Both families load at 400/500/600/700 only (`public/index.html`). `font-extrabold`/`font-black` are **banned app-wide** — the browser synthesizes the missing weight and Oswald renders smeared and platform-inconsistent. (v1 didn't state this; 10 display headings drifted to `font-extrabold`.)

The `font-mono` → JetBrains Mono entry in `tailwind.config.js` is dead (font never loaded, class never used) — delete it. Score figures use `.font-mono-score` (display face + tabular).

### Type scale — re-based to match built reality
v1's scale (15px body) sat off Tailwind's grid, so the codebase used `text-sm`/`text-xs` 200 times and the tokens 22 times. v2 re-bases body to **14px** (the app's actual body size) and remaps Tailwind's `xs`/`sm`/`base` onto the tokens (§8), so the default reflex *is* the system.

| Token | Tailwind class | Size / Line | Weight | Use |
|---|---|---|---|---|
| `--text-display-xl` | `text-display-xl` | 40px / 1.05 | 700 | Page hero titles (display face; letter-spacing −0.02em baked in) |
| `--text-display-lg` | `text-display-lg` | 30px / 1.1 | 700 | Section titles, team names on detail pages (−0.02em baked in) |
| `--text-heading` | `text-heading` | 22px / 1.2 | 600 | Card titles, modal headers |
| `--text-subheading` | `text-subheading` | 16px / 1.3 | 600 | **CHANGED from 17px** — sub-sections, week/date group headers (17px was a one-off oddball; 16 sits on the grid) |
| `--text-body-lg` | `text-base` | 16px / 1.5 | 400 | **NEW** — lead paragraphs, form inputs |
| `--text-body` | `text-sm` **and** `text-body` | 14px / 1.5 | 400 | **CHANGED from 15px** — default reading text |
| `--text-body-strong` | `text-body-strong` | 14px / 1.5 | 600 | Emphasized inline (winner, key labels, button text) |
| `--text-label` | `text-label` | 13px / 1.4 | 500 | Field labels, metadata, eyebrows (uppercase, +0.04em baked in) |
| `--text-caption` | `text-xs` **and** `text-caption` | 12px / 1.4 | 400 | Timestamps, footnotes, helper text |
| `--text-micro` | `text-micro` | 11px / 1.35 | 500 | **NEW** — dense chips, table meta, sport badges. **Hard floor: nothing below 11px.** Replaces the 41 ad-hoc `text-[9px]/[10px]/[11px]` |
| `--score-figure` | `text-score` | 28px / 1 | 700 | Score numbers (display face, tabular) |

`text-lg` (18px) / `text-xl` (20px) keep Tailwind defaults — legal for one-off in-between moments, but **headings must use the recipes below**, not raw sizes.

### Heading recipes — use these exact strings
v1 left heading composition to each page; nine different h1 recipes resulted. These are now the only sanctioned patterns (uppercase can't be baked into a fontSize token, so it stays in the string; tracking and weight are baked in):

| Level | Recipe |
|---|---|
| Page title (h1) | `font-display text-display-xl uppercase text-foreground` |
| Section title (h2) | `font-display text-display-lg uppercase text-foreground` |
| Card / modal title (h3) | `font-display text-heading uppercase tracking-tight text-foreground` |
| Group header (h4 / week rows) | `font-display text-subheading uppercase tracking-tight text-foreground` |
| Eyebrow / kicker | `text-label uppercase text-muted-foreground` |

No `tracking-tighter`, no `leading-none`/`leading-[0.95]` overrides (line-height lives in the token), no `font-extrabold`. Responsive step-down where needed: `text-display-xl sm:text-display-lg` — swap tokens, don't invent sizes.

---

## 4. Spacing, radius, elevation

### Spacing — Tailwind's 4px scale IS the system
v1 declared a parallel `--space-*` scale whose numbering collided with Tailwind's (`--space-5` = 24px vs `p-5` = 20px) and whose `s1`–`s10` utilities were used exactly zero times. **Both are deleted.** The spacing system is Tailwind's default 4px scale, no custom vars:

- **Allowed steps:** `0.5` (2px) through `12` (48px), plus `16` (64px) and `20` (80px) for large section rhythm.
- **Half-steps** (`0.5 / 1.5 / 2.5 / 3.5`) are legal only ≤ `3.5`, for dense UI (pill padding, icon gaps). Above 14px, whole steps only.
- No arbitrary `p-[13px]`-style values.

### Radius — cards are 16px; reality promoted to spec
v1 said cards = 10px; the built app uses 12px (×32) and 16px (×28+) and looks right doing it. v2 adopts the softer radius and remaps Tailwind's `xl`/`2xl` to the token (§8) so all existing call sites snap to one value with zero component edits.

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Badges, pills, small chips |
| `--radius-md` | 10px | Buttons, inputs, inner controls (`rounded-lg` already resolves here via the shadcn remap) |
| `--radius-lg` | 16px | **Cards, panels, modals** (`rounded-xl` and `rounded-2xl` both remap here) |
| `--radius-full` | 9999px | Avatars, status dots, sport chips |

`rounded-3xl` is banned (one stray use — normalize to `rounded-2xl`).

### Elevation (dark mode)
Depth comes primarily from surfaces getting lighter as they rise (sunken → surface → raised); shadows are the secondary cue.

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.40)` | Resting cards |
| `--shadow-md` | `0 4px 14px rgba(0,0,0,0.50)` | Hovered cards, dropdowns |
| `--shadow-lg` | `0 14px 36px rgba(0,0,0,0.60)` | Modals |
| `shadow-glow-cyan` / `-sm` | teal glow (see config) | **Now documented** (v1 omitted it): hero moments and primary-CTA emphasis only — never on ordinary cards. Config key name is legacy; the color is brand teal |

---

## 5. Component patterns (apply, don't redesign)

### Status badge pills
- `--radius-sm`, padding `px-2.5 py-0.5`, `text-label` uppercase, leading 6px dot in the status color, text in the status color, matching `-bg` behind.
- Colors strictly per the four-role table in §2. Live pulses on the dot only; everything else static.

### Sport chips
- Outline chip, `rounded-full`, `text-micro` uppercase — deliberately distinct from the soft-filled, dotted status pills.
- Kickball: `--sport-kickball` text/border on `--sport-kickball-tint`. Flag football: `--sport-flag` on `--sport-flag-tint`. **Never gold.**

### Game cards — winner/loser weighting (completed games)
- Winner row: `--win` text, weight 600, score in `--score-figure`. Loser row: `--loss-text`, regular weight.
- 3px teal leading bar on the winner's side (transparent on the other row so columns align). No whole-card background change.
- Upcoming: teal left-edge accent + Upcoming pill. Recent result: neutral, Final pill, weighting applied.
- Card shell: `bg-card border border-border rounded-2xl` (→ 16px token).

### Standings table
- Header row: `--surface-sunken` bg, `--border-strong` bottom border, `text-label` uppercase heads.
- Figures: tabular nums, right-aligned. Zebra via `--surface`/`--surface-sunken` at very low contrast.
- First place: `--leader-bg` wash + 2px `--cvf-gold` left bar. Subtle, not loud.
- Leaderboard medal figures: `--leader` / `--rank-silver` / `--rank-bronze`, weight ≤ 700.

### Buttons — variants named as `button.jsx` names them
v1's names didn't match the primitive; the primitive wins. States are defined **once** in `components/ui/button.jsx` — never recreate them inline.

| Variant | Fill | Text | Hover |
|---|---|---|---|
| `default` (primary) | `--cvf-teal` | `--text-on-brand` | `--cvf-teal-deep` |
| `destructive` | `--cvf-zia-deep` | `--text-primary` | **`--cvf-zia-down`** (darkens — v1's brighten-to-zia failed AA at 2.8:1) |
| `outline` (v1's "Secondary") | transparent, `--border-strong` border | `--text-primary` | `--surface-sunken` bg, teal-tinged border |
| `secondary` | shadcn `--secondary` (quiet gray fill) | `--text-primary` | fill at 80% |
| `ghost` | transparent | `--text-muted` (**doc now matches code** — v1's teal-deep text failed AA on cards) | teal text on `--cvf-teal-tint` bg |
| `link` | — | `--cvf-teal`, underline on hover | — |
| emphasis-outline | transparent, `--cvf-gold`/40 border | `--cvf-gold` | `--cvf-gold-tint` bg — **NEW**, formalizes the gold outline pattern admin invented; use only for achievement/attention actions |

All buttons: `--radius-md`, `text-body-strong` uppercase, min 44px tap target, visible focus ring (2px `--cvf-teal`, 2px offset).
*(Converting admin's raw `<button>` elements to `<Button>` is out of scope for this pass — separate batch.)*

### Inputs
- `bg-card`, `border-input`, `--radius-md`, `text-body-lg` (16px — also prevents iOS zoom), focus ring per global spec.
- Placeholders: `--text-muted` at **full opacity** — no `/60` alpha (drops below AA).

### Empty states
- Centered, `--text-secondary`, one short directive line in the interface's voice (not an apology).
- Standardized copy: standings — "No games played yet. Standings appear once scores are entered." · roster — "No players assigned. Add a player to start this roster." · score-entry roster — "This team has no players yet. Assign players before entering a score."

---

## 6. Accessibility floor (non-negotiable)

- All text/background pairings meet WCAG AA (4.5:1 normal, 3:1 large) on their actual surfaces. Every token in this spec has been **measured**, not assumed — the v1→v2 changes to `--text-muted`, `--loss-text`, destructive hover, and ghost text exist because v1 values failed measurement.
- Body text stays in the `--text-*` neutrals; saturated accents are for labels, figures, and emphasis at ≥ AA ratios. `--cvf-teal-deep` is a fill color, not a text color on raised surfaces.
- Visible keyboard focus on every interactive element (global `:focus-visible` 2px teal / 2px offset; shadcn primitives render the equivalent ring).
- 44px minimum tap targets on all interactive elements.
- `prefers-reduced-motion`: no live-pulse, no entrance animations beyond instant.
- Status and eligibility are never color-alone: pills always carry text + dot; `<EligibilityIndicator>` stays icon + tooltip.

---

## 7. Out of scope for this pass (do NOT touch)

- Any data shape, API call, routing, or state logic.
- **Raw `<button>` → `<Button>` conversion** (AdminDashboard's 15 inline buttons et al.) — interactive surface, separate batch after Phase 8.
- The env-gated role switcher, FINAL_DRAFT gating, or any feature-flag behavior.
- Eligibility logic (display only).
- Adding or removing features.

---

## 8. Migration checklist (v1 → v2)

Config + token file (one-shot, zero component edits, silently normalizes most of the app):

1. `index.css`: `--text-muted` → `#7E8883` (also `--loss-text`); re-base `--text-body` → 14px, `--text-subheading` → 16px; add `--text-micro`, `--text-body-lg`, `--cvf-zia-down`, `--sport-flag`/`-tint`/`-deep`, `--sport-kickball`/`-tint` (aliases), `--rank-silver`, `--rank-bronze`; delete `--space-1`…`--space-10`.
2. `tailwind.config.js`: remap `fontSize` `xs` → caption, `sm` → body, `base` → body-lg (each with paired line-height/weight); add `micro`; remap `borderRadius` `xl` and `2xl` → `var(--radius-lg)`; delete the `s1`–`s10` spacing aliases and the `mono`/JetBrains entry; add sport/rank colors.
3. `button.jsx`: destructive hover → `--cvf-zia-down` (one line). `input.jsx`: placeholder to full-opacity `--text-muted` (one line).

Small sweeps (mechanical, display-only):

4. Headings (~10 h1/h2s): apply §3 recipes — removes `font-extrabold`, `tracking-tighter`, `leading` overrides.
5. `Badges.js` SportBadge → sport tokens; replace raw `#f97316` in `roles.js`/`seed.js` with `--sport-flag-deep`; `Leaderboards.js` medals → rank tokens.
6. `text-black` → `text-on-brand`/`text-ink` (×7); `text-white` → `text-foreground` (×3); remaining raw hexes in pages (`#5BB8CC`, `#F5B82E`, `#0F1416`, `#a1a1aa`, `#555`) → tokens.
7. `text-[9px]/[10px]/[11px]` (×41) → `text-micro` (long-tail; can trail the rest).
8. Delete CRA boilerplate in `App.css` (spinning-logo styles); one `rounded-3xl` → `rounded-2xl`.

After the config remap lands, verify: build passes, score-entry flow intact, game cards / standings / pills visually unchanged except the intended shifts (muted text slightly brighter, 12px radii → 16px, flag chips orange).

---

*CVF Sports — Built different. Built to last.*
