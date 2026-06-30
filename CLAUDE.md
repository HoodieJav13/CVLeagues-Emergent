# CVF Sports — Leagues App

## What This Is
A mobile-first web app for running adult recreational kickball and flag football leagues in Albuquerque, NM. Public users view schedules, standings, scores, teams, and stats. An admin (the owner) manages everything. Built free as a player-first alternative to GameChanger, focused on adult rec leagues.

Frontend was generated via Emergent (React + CRA), polished with a design-system-first UI pass, extended in Claude Code, and given a full visual-token upgrade. Runs in mock state; not yet wired to a backend.

## Current Status
- Public site: all pages working, 8-step score-entry flow verified
- Intake forms (Free Agent + Team Interest): rebuilt to spec, feeding shared state
- Admin dashboard: COMPLETE — 9 tabs, triage workflows, game lock + edit history, waiver placeholder queue, operational overview
- Roster flow (Flow C-lite): Add Player, manual assignment, eligibility indicator — done
- Functional cleanup: env-gated demo switcher, dormant account surfaces, empty states, destructive confirmations — done
- Structural tweaks: player sport-tabs, schedule week-grouping, modal overflow fixes — done
- Visual upgrade (Phase 8a, four batches): design tokens, typography (Oswald/Inter), status pills, game cards (3-per-row desktop), standings, focus rings, empty-state styling, copy fixes — done
- Running locally via `npm start` from `frontend/`; single source of truth on `main`
- Navbar logo at `src/assets/cvf-logo-transparent.png`
- Backend NOT yet wired — mock seed data + localStorage with a migrateState pass

## Tech Stack
- Frontend: React (Create React App), React Router
- Styling: Tailwind CSS v3 + CSS variables; shadcn/ui components in `src/components/ui`
- Design tokens: full token system in `src/index.css` (:root) + `tailwind.config.js`. Brand = teal (primary/action), gold (achievement/needs-attention), Zia red (alert/live only). Sport accent: flag football = orange token, kickball = teal. Three-signal status system kept intact; meanings never rely on color alone (always shape/label/icon too).
- State: single shared `AppStateContext` (the one source of truth)
- Business logic: pure selectors in `src/lib/selectors.js`
- Roles: `src/lib/roles.js`
- Seed/mock data: `src/data/seed.js`
- Persistence (current): localStorage
- Future backend: Supabase (PostgreSQL + Auth), Vercel — confirmed for Season 1, NOT yet connected

## Architecture Rules — Read Before Editing
- `AppStateContext`, `selectors.js`, `roles.js`, `seed.js` are the protected core. Extend; don't rewrite structure/logic unless explicitly scoped.
- Admin and public read/write the SAME shared state. A score entered in admin updates public schedule/standings/stats automatically. Never create a separate admin data store.
- Keep the same function signatures when swapping mock logic for Supabase. Mark swap points `// PHASE 2`.
- Out-of-scope account/login features are kept dormant behind the `FINAL_DRAFT` flag, not deleted.
- Use existing shared components and design tokens — no new UI libraries, no rogue hex colors (map to tokens).
- Mobile-first: every view works at iPhone SE width (375px) and up.

## Product Decisions — Locked
- **Admin-only for Season 1.** Only the admin logs in. Players are profile records, not accounts.
- **Auth User ≠ Player.** `profiles.auth_user_id` is nullable so a player can claim an account later without losing history.
- **Sports at launch:** kickball and flag football only.
- **Payments:** manual tracking for Season 1 (fields in the model, no Stripe).
- **One active season per sport.** Records auto-stamped with the season; users don't pick a season on forms.
- **Quality-gated, no hard deadline.** Finish each phase's gates; don't drift.
- **Backend confirmed before Season 1.** Relational linkage (intake→roster→waiver) is built ONCE against real Supabase tables, NOT mock-built first.

## Roster & Eligibility (Season 1)
- **Flow C-lite (built):** "Add Player" creates a profile; manual roster assignment sets team + jersey; season auto-stamped.
- **Do NOT build intake-conversion in mock state** (approve→team, assign→profile). Built once in the backend phase.
- **Eligibility is purely informational.** Never blocks anything in-app. Admin enforces physically IRL.
- **`<EligibilityIndicator>`:** reusable, icon + tooltip, not color-alone. Shown on rosters, score entry, team pages. Data source becomes real waiver status in the backend phase.

## Waiver / Identity Model
- Waivers are a SEPARATE step from intake forms — never bundled.
- `waivers` records are APPEND-ONLY: never edit a signed waiver; re-signing creates a new row.
- `waiver_versions` table stores exact text per version (e.g. `CVF-WAIVER-2026-06-04-v1`).
- Submitted waiver ≠ eligibility. Eligibility = admin verification + team/season assignment.
- Capture: signed name, signed_at, email, phone, ip_address, user_agent, accepted_terms, age_confirmed, media_consent (optional), verification_status (pending/verified/rejected/duplicate).
- Adults only Season 1 ("I confirm I am 18+"). Minor/guardian flow deferred.
- Public waiver submission flow built in the backend phase (needs real DB, append-only architecture, attorney-reviewed language). Admin Waivers tab currently shows an honest "ships with backend" empty state.
- LEGAL: waiver language reviewed by a New Mexico attorney before launch.

## Score Lifecycle (built, working)
- Two parallel fields: `status` (upcoming/completed/postponed/canceled) = game lifecycle; `score_status` (pending/submitted/approved/disputed/final) = score lifecycle. Intentionally separate.
- Flow: pending → submitted (score saved) → final (Mark Final, locks game) → approved (on unlock) → submitted (on re-edit).
- A final game is LOCKED: editing requires deliberate unlock + required reason; every change appends to `editHistory` (mock audit log; becomes append-only table in backend).

## Future Data Model (shape mock data to match)
- profiles (auth_user_id nullable, first/last/display name, email, phone, dob optional, age_confirmed, emergency contacts, admin notes)
- leagues (sport, season, status)
- teams (league_id, captain contact, status)
- team_players (team_id, profile_id, season_id, jersey_number, roster_status: pending_waiver/eligible/inactive/removed — roster_status deferred to backend)
- games (league_id, home/away team, date, location, status, score_status, locked, editHistory, scores, submitted_by, approved_by)
- player_stats (profile_id, game_id, team_id, sport-specific fields)
- registrations (status: new/contacted/approved/archived, adminNotes[])
- free_agents (status: new/contacted/assigned/archived, assignedTeamId, adminNotes[])
- waivers (append-only — see Waiver model)

## Stat Categories
Flag Football — Passing (comp/att/comp%/yds/TD/INT), Rushing (carries/yds/TD/1st), Receiving (catches/yds/TD/1st), Defense (flag pulls/sacks/INT), Scoring (TD/1-2-3pt conversions).
Kickball — Offense (kicks/1B/2B/3B/HR/RBI/runs/walks/K), Defense (outs/assists/errors).

## Security (backend phase)
- Row Level Security on every Supabase table — non-negotiable.
- Public READ of public data; unauthenticated users cannot write.
- Only admin writes league data, edits scores, changes roles.
- Game lock + append-only edit history become RLS-enforced.
- The env-gated demo Role Switcher is replaced entirely by real Supabase Auth.

## General Working Rules
- Explain large changes before making them; ask clarifying questions before significant new features.
- Never delete files/data without asking. Never hardcode secrets — use env vars.
- Preserve tests and the score-entry flow; after notable changes confirm the build passes and that flow still works.
- Scope work by risk: bigger passes for low-risk display work, tight scoping for shared state, data shapes, or backend.
- Audit before building when there may be overlap with existing work — report what exists vs. what's needed before changing anything.

## Build Roadmap
1. ✅ Emergent MVP + UI polish + repo setup
2. ✅ Intake forms to spec
3. ✅ Admin dashboard (4 stages)
4. ✅ Bug/seed fixes
5. ✅ Roster flow (Flow C-lite)
6. ✅ Functional cleanup
7. ✅ Structural tweaks
8a. ✅ Visual upgrade (4 batches)
8b. Logo placement, favicon, mobile nav CTAs, tap targets, accessibility (H1s, labels), real <form> elements, "My Team" filter  ← NEXT
9. Backend wiring (Supabase, RLS, real intake→roster→waiver linkage)
10. Deploy + soft launch (domain, backups, clean reset, Season 1)

Background (lead time, start now): NM attorney waiver review · domain purchase · confirm friend's native-app stack.

## Intake Form Specs (built)
Free Agent (required: name, phone or email, sport, consent): legal first/last name, display name (opt), phone, email, sport (kickball/flag football/both), experience (opt), preferred position (opt), availability multi-select (Sunday morning/Sunday night/Monday night — configurable), emergency contact (opt), consent to contact (req). NO waiver content.

Team Interest (required: captain name, phone or email, sport, team name, consent): captain legal name/phone/email, sport, team name, estimated roster size (opt), preferred season (informational), consent (req), notes (opt). CTA standardized to "Submit Team Interest" — it's an interest form, not a registration that secures a spot.
