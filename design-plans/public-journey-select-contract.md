# Bring public Select controls onto the accepted input contract

Written against: `de5b8e62d4289610ad83ab31882f9723a78c0628`

## Evidence chain

- Surface: `/schedule` and `/standings`, with inherited verification on every route that renders `frontend/src/components/ui/select.jsx`.
- Problem: the shared `SelectTrigger` at `frontend/src/components/ui/select.jsx:13-25` still defaults to `h-10`, `text-sm`, `transition-all duration-200`, and `data-[placeholder]:text-muted-foreground/60`. Schedule and Standings then repeat `h-10 text-sm` at `frontend/src/pages/Schedule.js:123` and `frontend/src/pages/Standings.js:94`, preventing the selected public surfaces from inheriting the accepted input typography and target size.
- Design evidence: `CVLeagues_Design_Tokens.md:237-239` defines inputs as `text-body-lg`/`text-base` with full-opacity `--text-muted` placeholders; `CVLeagues_Design_Tokens.md:245-249` permits only transform/opacity animation and rejects unbounded transition ownership; `CVLeagues_Design_Tokens.md:253-259` sets the 44px interaction floor. The current Home filters at `frontend/src/pages/Home.js:235,259` already use `h-11` and demonstrate the accepted public-filter height.
- Owner: `frontend/src/components/ui/select.jsx` owns shared trigger presentation. `frontend/src/pages/Schedule.js` and `frontend/src/pages/Standings.js` own the selected surfaces' local overrides.
- Scope and affected surfaces: the default-class correction inherits into Home, Schedule, Standings, Leaderboards, Playoffs, registration/intake forms, Score Entry, Admin Dashboard, Payments, and Hall of Fame wherever a consumer does not explicitly override a class. Schedule and Standings must remove their legacy height/type overrides. Explicit `h-9`, `text-xs`, `h-12`, or other local density overrides outside the selected surface remain unchanged but must be rendered as regression surfaces.
- Uncertainty: the contract and correction are explicit. The only validation risk is whether a shared 44px/16px default exposes a layout collision in dense admin or five-filter Schedule layouts; do not invent a compact variant during this stage.

## Design decision

Make the shared `SelectTrigger` default match the accepted input contract: `h-11`, `text-base`, full-opacity placeholder text, and no broad transition. Remove Schedule and Standings’ `h-10 text-sm` overrides so those public filters inherit the owner. Preserve Radix behavior, content positioning/animation, focus treatment, surfaces, borders, shadows, icons, disabled states, and all option/state logic.

This is a default-owner correction, not a repository-wide removal of intentional local variants. Consumers with explicit compact or spacious overrides keep them until a separately evidenced audit says otherwise.

## Reuse

- `h-11` for the documented 44px control height.
- `text-base` for `--text-body-lg`/16px form text.
- `text-muted-foreground` at full opacity for placeholders.
- Existing `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` composition; add no parallel select primitive.
- Exemplar: Home’s public filter triggers at `frontend/src/pages/Home.js:235,259` already apply `h-11` while preserving the same shared Radix owner.

## Changes

1. `frontend/src/components/ui/select.jsx`
   - Change: in the `SelectTrigger` base class, replace `h-10` with `h-11`, replace `text-sm` with `text-base`, replace `data-[placeholder]:text-muted-foreground/60` with `data-[placeholder]:text-muted-foreground`, and remove `transition-all duration-200`.
   - Preserve: `w-full`, flex layout, whitespace behavior, radius, border, `bg-card`, padding, shadow, focus ring/offset/border, disabled presentation, line clamp, icon, forwardRef behavior, and all `SelectContent` classes.
   - Verify: a trigger without local size/type classes computes to 44px high and 16px text, placeholder text resolves at full muted color, and no transition property is declared by the trigger owner.

2. `frontend/src/pages/Schedule.js`
   - Change: remove `h-10 text-sm` from the local `SelectTrigger`; retain `bg-card border-border` and every filter label, value, option, reset, and data-testid.
   - Preserve: five-filter grid, sport/season/league/team/status dependency resets, option labels, filtering, chronological grouping, and empty state.
   - Verify: all five Schedule filters inherit the shared 44px/16px default without clipping option values at 375px, 768px, or 1280px.

3. `frontend/src/pages/Standings.js`
   - Change: remove `h-10 text-sm` from the local `SelectTrigger`; retain `bg-card border-border` and all filter behavior/test IDs.
   - Preserve: sport-driven season reset, standings computation, playoff link, league sections, table presentation, and empty states.
   - Verify: Sport and Season filters inherit the shared default and retain their two-column responsive layout.

4. `frontend/src/components/ui/select.test.jsx`
   - Change: add a focused structural test using the repository’s current Jest/React DOM conventions. Render a basic `Select`/`SelectTrigger` composition and assert the shared trigger contains `h-11`, `text-base`, and full-opacity placeholder classes, and does not contain `transition-all`, `duration-200`, or `text-muted-foreground/60`.
   - Preserve: avoid full snapshots and do not test Radix internals.
   - Verify: the test fails against commit `de5b8e6` for the intended class-contract reasons and passes after the owner correction.

## Scope

- Inherit: every `SelectTrigger` receives the corrected default unless `tailwind-merge` resolves an explicit consumer override later in its `className`.
- Verify: `/`, `/schedule`, `/standings`, `/leaderboards`, `/playoffs`, `/register-team`, `/free-agent-signup`, `/score-entry`, `/admin`, Payments, and Hall of Fame; include placeholder, selected-value, disabled, and long-option states.
- Exclude: changing Select option copy, filtering/data behavior, Radix APIs, `SelectContent` entrance/exit motion, label semantics, adding compact/spacious variants, removing existing explicit `h-9`/`h-12` overrides, and unrelated Button or input primitives.

## Validation

- Product: filter Schedule and Standings by every available control; results and reset relationships must remain identical while the triggers use the accepted visual contract.
- Interface: render 375×812, 768×1024, and 1280×720; verify the five-filter Schedule row, two-filter Standings row, Home filters, long league/team names, placeholder states, Admin compact overrides, and Score Entry’s explicit `h-12` trigger.
- System: confirm `SelectTrigger` remains the sole shared owner, Schedule/Standings no longer override its default size/type, and explicit density exceptions still win through `cn`/`tailwind-merge`.
- Repository: `cd frontend && CI=true npm test -- --watchAll=false` → all suites pass.
- Repository: `cd frontend && npm run build` → production build succeeds and the literal Tailwind classes are generated.
- Repository: `git diff --check` → no whitespace errors.

## Stop conditions

- Stop if the shared default creates a verified collision in a consumer without an explicit local density override; report the exact consumer and rendered evidence before introducing any new variant.
- Stop if changing the shared primitive requires option-state, Radix API, filtering, or form-behavior changes.
- Stop if implementation overlaps unrelated owner work in the currently dirty auth/admin files and cannot preserve it cleanly.

## Design documentation

- After acceptance and validation: no design-token change is required; `CVLeagues_Design_Tokens.md:237-239,245-249,253-259` already describes the intended contract. Record the completed owner correction and commit hash in the active UI roadmap only.
