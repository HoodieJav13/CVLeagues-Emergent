# CVF Sports — Leagues App

## What This Is
A mobile-first web app for running adult recreational kickball and flag football leagues in Albuquerque, NM. Public users view schedules, standings, scores, teams, and stats. An admin (the owner) manages everything. Built free as a player-first alternative to GameChanger, focused on adult rec leagues.

This frontend was generated via Emergent (React + CRA), then polished with a design-system-first UI pass. It is now being extended and wired to a real backend.

## Current Status
- Frontend MVP complete: all public pages working, 8-step score-entry flow verified
- UI/UX polished: design tokens + shared components customized to CVF brand
- Running locally via `npm start` from the `frontend/` folder
- Single source of truth on the `main` branch (UI polish merged in)
- Backend NOT yet wired — currently uses mock seed data + localStorage
- Navbar logo added at `src/assets/cvf-logo-transparent.png`

## Tech Stack
- Frontend: React (Create React App), React Router
- Styling: Tailwind CSS v3 + CSS variables; shadcn/ui components in `src/components/ui`
- State: single shared `AppStateContext` (the one source of truth)
- Business logic: pure selector functions in `src/lib/selectors.js`
- Roles: `src/lib/roles.js`
- Seed/mock data: `src/data/seed.js`
- Persistence (current): localStorage
- Future backend: Supabase (PostgreSQL + Auth), deployed on Vercel — NOT connected yet

## Architecture Rules — Read Before Editing
- `AppStateContext`, `selectors.js`, `roles.js`, and `seed.js` are the protected core. Extend them; do not rewrite their structure or logic unless explicitly asked.
- Admin and public read/write the SAME shared state. A score entered in admin must update public schedule, standings, and stats automatically. Never create a separate admin data store.
- Keep the same function signatures when swapping mock logic for Supabase, so pages don't need rewriting. Mark each swap point with a `// PHASE 2` comment.
- Use existing shared components (Button, Card, Badge, Table, Input, etc.) — do not introduce new UI libraries or one-off styles.
- Mobile-first. Every new view must work on iPhone SE width and up.

## Product Decisions — Locked
- **Admin-only for Season 1.** Only the admin logs in. Players are profile records, not user accounts. No player login, no captain dashboard, no claim-profile flow yet.
- **Auth User ≠ Player.** A `profiles` record is the person; an auth account is optional. `auth_user_id` is nullable so a player can claim an account later without losing history.
- **Sports at launch:** kickball and flag football only.
- **Payments:** manual tracking for Season 1 (fields in the data model, no Stripe yet).
- **One active season per sport at a time.** Records still get stamped with the season for long-term history; users don't pick a season on forms.

## Waiver / Identity Model
- Players are added by admin (or via intake forms), existing as profile records.
- Waivers are a SEPARATE step from intake forms — not bundled into them.
- `waivers` records are APPEND-ONLY: never edit a signed waiver; re-signing creates a new row.
- A `waiver_versions` table stores the exact text of each version (e.g. version string `CVF-WAIVER-2026-06-04-v1`).
- A submitted waiver does NOT equal eligibility. Eligibility = admin verification + team/season assignment.
- Capture on each waiver: signed name, signed_at, email, phone, ip_address, user_agent, accepted_terms, age_confirmed, media_consent (optional), verification_status (pending/verified/rejected/duplicate).
- Adults only for Season 1 ("I confirm I am 18+"). Minor/guardian flow is a later, separate intake — noted for the future, not built now.

## Future Data Model (shape mock data to match these)
- profiles (auth_user_id nullable, first/last/display name, email, phone, dob optional, age_confirmed, emergency contacts, admin notes)
- leagues (sport, season, status)
- teams (league_id, captain contact, status)
- team_players (team_id, profile_id, season_id, jersey_number, roster_status: pending_waiver/eligible/inactive/removed)
- games (league_id, home/away team, date, location, score_status: pending/submitted/approved/disputed/final, scores, submitted_by, approved_by, edit history)
- player_stats (profile_id, game_id, team_id, sport-specific fields)
- registrations (team interest submissions, status: new/contacted/approved/archived)
- free_agents (intake submissions, status: new/contacted/assigned/archived)
- waivers (see Waiver model above — append-only)

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

## Security (when backend is wired)
- Row Level Security on every Supabase table — non-negotiable.
- Public can READ public data (schedule, standings, scores). Unauthenticated users cannot write.
- Only admin can write league data, edit scores, or change roles.
- A game marked final is LOCKED — editing it requires a deliberate unlock, and every change is logged (score audit log).

## General Working Rules
- Always explain what you're doing before a large change.
- Ask clarifying questions before starting any significant new feature.
- Never delete files or data without asking.
- Never hardcode secrets — use environment variables.
- Preserve existing tests and the score-entry flow; after notable changes, confirm the app still builds and that flow still works.

## Build Roadmap (near-term)
1. Public intake forms: Free Agent + Team Interest (feed the admin sections)
2. Admin dashboard: Overview, Players, Registrations, Free Agents, Waivers (placeholder), Teams, Leagues, Schedule/Games, Scores/Stats
3. Branding pass: logos, real images, copy rewrite to CVF voice
4. Wire Supabase backend (auth, database, RLS, waiver flow)
5. Deploy to Vercel + custom domain
6. Soft launch — Season 1

## Intake Form Specs
Free Agent (required: name, phone or email, sport, consent; rest optional):
- Legal first name, legal last name, display name (optional)
- Phone, email
- Sport interest: kickball / flag football / both
- Experience level (optional)
- Preferred position (optional)
- Availability: multi-select, configurable list — current options: Sunday morning, Sunday night, Monday night
- Emergency contact name + phone (optional)
- Consent to be contacted (phone, text, or email) — required checkbox
- NO waiver in this form (waiver is a separate flow)

Team Interest (required: captain name, phone or email, sport, team name, consent):
- Captain legal name, captain phone, captain email
- Sport: kickball / flag football
- Team name
- Estimated roster size
- Preferred season (only one active per sport — informational)
- Consent to be contacted — required checkbox
- Notes (optional)