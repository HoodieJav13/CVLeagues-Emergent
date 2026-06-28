# CVF Sports — Leagues App

## What This Is
A mobile-first web app for running adult recreational kickball and flag football leagues in Albuquerque, NM. Public users view schedules, standings, scores, teams, and stats. An admin (the owner) manages everything. Built free as a player-first alternative to GameChanger, focused on adult rec leagues.

Frontend was generated via Emergent (React + CRA), polished with a design-system-first UI pass, and extended in Claude Code. It runs in mock state and is not yet wired to a backend.

## Current Status
- Public site: all pages working, 8-step score-entry flow verified
- UI/UX design-system polish: done, merged to main
- Intake forms (Free Agent + Team Interest): rebuilt to spec, feeding shared state
- Admin dashboard: COMPLETE — 9 tabs, triage workflows, game lock + edit history, waiver placeholder queue, operational overview
- Running locally via `npm start` from `frontend/`
- Single source of truth on `main`
- Navbar logo at `src/assets/cvf-logo-transparent.png`
- Backend NOT yet wired — mock seed data + localStorage, with a migrateState pass that remaps legacy persisted data

## Tech Stack
- Frontend: React (Create React App), React Router
- Styling: Tailwind CSS v3 + CSS variables; shadcn/ui components in `src/components/ui`
- State: single shared `AppStateContext` (the one source of truth)
- Business logic: pure selectors in `src/lib/selectors.js`
- Roles: `src/lib/roles.js`
- Seed/mock data: `src/data/seed.js`
- Persistence (current): localStorage
- Future backend: Supabase (PostgreSQL + Auth), Vercel — confirmed for Season 1, NOT yet connected

## Architecture Rules — Read Before Editing
- `AppStateContext`, `selectors.js`, `roles.js`, `seed.js` are the protected core. Extend them; don't rewrite structure or logic unless explicitly asked and scoped.
- Admin and public read/write the SAME shared state. A score entered in admin updates public schedule, standings, stats automatically. Never create a separate admin data store.
- Keep the same function signatures when swapping mock logic for Supabase. Mark each swap point with `// PHASE 2`.
- Account/player-login features that are out of Season 1 scope are kept dormant behind a `FINAL_DRAFT` flag, not deleted.
- Use existing shared components — no new UI libraries or one-off styles.
- Mobile-first: every view works on iPhone SE width and up.

## Product Decisions — Locked
- **Admin-only for Season 1.** Only the admin logs in. Players are profile records, not accounts. No player login, captain dashboard, or claim-profile flow yet.
- **Auth User ≠ Player.** A `profiles` record is the person; an auth account is optional. `auth_user_id` is nullable so a player can claim an account later without losing history.
- **Sports at launch:** kickball and flag football only.
- **Payments:** manual tracking for Season 1 (fields in the model, no Stripe).
- **One active season per sport.** Records are stamped with the season automatically; users don't pick a season on forms.
- **Quality-gated, no hard deadline.** Finish each phase's "done when" gates; don't drift.
- **Backend confirmed before Season 1.** Because of this, relational linkage (intake→roster→waiver) is built ONCE against real Supabase tables, NOT mock-built first.

## Roster & Eligibility (Season 1)
- **Now (mock state) — Flow C-lite:** a minimal "Add Player" creates a profile record; manual roster assignment puts a player on a team with a jersey number; season auto-stamped on assignment.
- **Do NOT build intake-conversion in mock state** (approve→team, assign→profile). That relational linkage is built once in the backend phase against real tables — mock-building it means writing it twice.
- **Eligibility is purely informational.** It NEVER blocks anything in the app. The admin enforces eligibility physically in real life (an ineligible player simply isn't allowed to play).
- **Eligibility indicator:** a reusable `<EligibilityIndicator>` — icon + tooltip, not color-alone (accessible). Shown next to player names on rosters, score entry, and team pages. Built once; its data source becomes real waiver status in the backend phase.

## Waiver / Identity Model
- Waivers are a SEPARATE step from intake forms — never bundled in.
- `waivers` records are APPEND-ONLY: never edit a signed waiver; re-signing creates a new row.
- A `waiver_versions` table stores the exact text of each version (e.g. `CVF-WAIVER-2026-06-04-v1`).
- A submitted waiver does NOT equal eligibility. Eligibility = admin verification + team/season assignment.
- Capture per waiver: signed name, signed_at, email, phone, ip_address, user_agent, accepted_terms, age_confirmed, media_consent (optional), verification_status (pending/verified/rejected/duplicate).
- Adults only for Season 1 ("I confirm I am 18+"). Minor/guardian flow is a later, separate intake.
- The public waiver submission flow is built in the backend phase (needs real DB, append-only architecture, attorney-reviewed language). Until then the admin Waivers tab shows an honest "ships with backend" empty state.
- LEGAL: waiver language must be reviewed by a New Mexico attorney before launch.

## Score Lifecycle (built, working)
- A game has two parallel fields: `status` (upcoming/completed/postponed/canceled) = the game's lifecycle, and `score_status` (pending/submitted/approved/disputed/final) = the score's lifecycle. They are intentionally separate.
- Flow: pending → submitted (score saved) → final (Mark Final, locks the game) → approved (on unlock) → submitted (on re-edit).
- A final game is LOCKED: editing requires a deliberate unlock with a required reason, and every change appends to an `editHistory` array (the mock audit log; becomes an append-only table in the backend).

## Future Data Model (shape mock data to match)
- profiles (auth_user_id nullable, first/last/display name, email, phone, dob optional, age_confirmed, emergency contacts, admin notes)
- leagues (sport, season, status)
- teams (league_id, captain contact, status)
- team_players (team_id, profile_id, season_id, jersey_number, roster_status: pending_waiver/eligible/inactive/removed)
- games (league_id, home/away team, date, location, status, score_status, locked, editHistory, scores, submitted_by, approved_by)
- player_stats (profile_id, game_id, team_id, sport-specific fields)
- registrations (team interest submissions, status: new/contacted/approved/archived, adminNotes[])
- free_agents (intake submissions, status: new/contacted/assigned/archived, assignedTeamId, adminNotes[])
- waivers (append-only — see Waiver model)

## Stat Categories
Flag Football:
- Passing: completions, attempts, completion %, yards, TDs, INTs
- Rushing: carries, yards, TDs, 1st downs
- Receiving: catches, yards, TDs, 1st downs
- Defense: flag pulls, sacks, INTs
- Scoring: TDs, 1-point, 2-point, 3-point conversions

Kickball:
- Offense: kicks, singles, doubles, triples, home runs, RBIs, runs scored, walks, strikeouts
- Defense: outs recorded, assists, errors

## Security (backend phase)
- Row Level Security on every Supabase table — non-negotiable.
- Public READ of public data; unauthenticated users cannot write.
- Only admin writes league data, edits scores, changes roles.
- Game lock and append-only edit history become RLS-enforced, not just UI courtesy.
- Env-gate the demo Role Switcher so it never ships in a public build (stopgap until real auth replaces it).

## General Working Rules
- Explain large changes before making them; ask clarifying questions before any significant new feature.
- Never delete files or data without asking.
- Never hardcode secrets — use environment variables.
- Preserve existing tests and the score-entry flow; after notable changes, confirm the app still builds and that flow still works.
- Scope work by risk: bigger passes for low-risk display work, tight scoping for anything touching shared state, data shapes, or the backend.

## Build Roadmap (current)
1. ✅ Emergent MVP + UI polish + repo setup
2. ✅ Intake forms to spec
3. ✅ Admin dashboard (4 stages)
4. Bug/seed fixes (timeline consistency, free-agent data shape, 404 route, score button rename)  ← CURRENT
5. Roster flow (Flow C-lite: Add Player, assignment, eligibility indicator)
6. Functional cleanup (FINAL_DRAFT hiding, dead controls, empty states, env-gate switcher, delete confirmations)
7. Structural tweaks (player sport-tabs, schedule week-grouping)
8. Branding + strictly-visual upgrade pass
9. Backend wiring (Supabase, RLS, real intake→roster→waiver linkage)
10. Deploy + soft launch (domain, backups, clean reset, Season 1)

## Intake Form Specs (built)
Free Agent (required: name, phone or email, sport, consent; rest optional):
- Legal first/last name, display name (optional); phone, email
- Sport: kickball / flag football / both
- Experience (optional), preferred position (optional)
- Availability: multi-select, configurable — Sunday morning, Sunday night, Monday night
- Emergency contact name + phone (optional)
- Consent to be contacted (phone/text/email) — required
- NO waiver content (waiver is a separate flow)

Team Interest (required: captain name, phone or email, sport, team name, consent):
- Captain legal name, phone, email
- Sport: kickball / flag football
- Team name, estimated roster size (optional)
- Preferred season (informational — one active per sport)
- Consent to be contacted — required
- Notes (optional)