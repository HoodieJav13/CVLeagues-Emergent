# CVF Sports — Leagues App

## What This Is
A mobile-first web app for running adult recreational kickball and flag football leagues in Albuquerque, NM. Public users view schedules, standings, scores, teams, and stats. An admin (the owner) manages everything. Built free as a player-first alternative to GameChanger, focused on adult rec leagues.

Frontend was generated via Emergent (React + CRA), polished with a design-system-first UI pass, extended in Claude Code, and given a full visual-token upgrade. The Supabase adapter is env-gated; the owner-configured local environment now runs against hosted Supabase, while explicit mock mode remains available for local development. Twelve backend migrations pass the real local Supabase harness and are applied to the dedicated Free-plan Supabase project in US East (Ohio); hosted advisor findings have been reviewed with explicit dispositions and the database gate is closed. Preview/production environment configuration and production-safe mock handling remain open.

## Current Status
- Public site: all pages working; the eight-step score-entry flow is verified in mock mode only
- Intake forms (Free Agent + Team Interest): rebuilt to spec, feeding shared state
- Admin dashboard: COMPLETE — 9 tabs, triage workflows, game lock + edit history, waiver placeholder queue, operational overview
- Roster flow (Flow C-lite): Add Player, manual assignment, eligibility indicator — done
- Functional cleanup: env-gated demo switcher, dormant account surfaces, empty states, destructive confirmations — done
- Structural tweaks: player sport-tabs, schedule week-grouping, modal overflow fixes — done
- Visual upgrade (Phase 8a, four batches): design tokens, typography (Oswald/Inter), status pills, game cards (3-per-row desktop), standings, focus rings, empty-state styling, copy fixes — done
- Playoff/tournament mock UI (commit `f8b0a16`): `StageBanner` adds a gold band + trophy icon to GameCard, Schedule, and GameDetail; `computeTeamRecord` excludes playoff/tournament games from standings while season stat totals still include them
- Phase 9 backend database: twelve migrations are hosted and in sync; the real local Supabase stack passes 100/100 pgtest assertions plus 7/7 anonymous Data API checks, and hosted migration history, function attributes, 38/38 foreign-key index coverage, clean row counts, and both advisors are verified
- Running locally via `npm start` from `frontend/`; active backend-to-launch work is on `codex/backend-to-launch` (always confirm the checked-out branch before editing; `main` is not the current work branch)
- Navbar logo at `src/assets/cvf-logo-transparent.png`
- Dedicated hosted backend is linked, migrated, advisor-reviewed, and database-verified. The real administrator is linked, local hosted-mode environment variables are configured, three-session role resolution is verified fail-closed, and the locked-score unlock/re-lock flow is hosted-verified. MFA/recovery/session revocation, the complete hosted authorization matrix, production-safe mock handling, preview/production variables, and the live eight-step flow remain open.

## Current Priority
Phase 9's database gate is closed: repository controls, real local Supabase validation, project linking, all twelve hosted migrations, clean-state invariants, and advisor review are verified. The admin link, local hosted environment, role resolution, and locked-score UX flow are also verified. Next: complete hosted authorization matrix → MFA/recovery/session-revocation readiness → production-safe mock behavior plus preview/production variables → live eight-step flow → Phase 10 deployment and soft launch.

## Tech Stack
- Frontend: React (Create React App), React Router
- Styling: Tailwind CSS v3 + CSS variables; shadcn/ui components in `src/components/ui`
- Design tokens: full token system in `src/index.css` (:root) + `tailwind.config.js`. Brand = teal (primary/action), gold (achievement/needs-attention), Zia red (alert/live only). Sport accent: flag football = orange token, kickball = teal. Three-signal status system kept intact; meanings never rely on color alone (always shape/label/icon too).
- State: single shared `AppStateContext` (the one source of truth)
- Business logic: pure selectors in `src/lib/selectors.js`
- Roles: `src/lib/roles.js`
- Seed/mock data: `src/data/seed.js`
- Persistence (current fallback): localStorage
- Backend: Supabase (PostgreSQL + Auth); twelve migrations and the real admin link are applied and verified in the dedicated hosted project, and the local frontend is configured for hosted mode. Full authorization/live application acceptance and preview/production configuration remain open.
- Deployment target: Vercel (Phase 10)

## Architecture Rules — Read Before Editing
- `AppStateContext`, `selectors.js`, `roles.js`, `seed.js` are the protected core. Extend; don't rewrite structure/logic unless explicitly scoped.
- Admin and public read/write the SAME shared state. A score entered in admin updates public schedule/standings/stats automatically. Never create a separate admin data store.
- Preserve `AppStateContext` action signatures across mock and hosted Supabase paths. Describe new work using the current backend/live-verification roadmap terminology rather than the retired `PHASE 2` swap-point label.
- Out-of-scope account/login features are kept dormant behind the `FINAL_DRAFT` flag, not deleted.
- Use existing shared components and design tokens — no new UI libraries, no rogue hex colors (map to tokens).
- Mobile-first: every view works at iPhone SE width (375px) and up.

## Product Decisions — Locked
- **Admin-only for Season 1.** Only the admin logs in. Players are profile records, not accounts.
- **Auth User ≠ Player.** `profiles.auth_user_id` is nullable so a player can claim an account later without losing history.
- **Sports at launch:** kickball and flag football only.
- **Payments:** manual tracking for Season 1; the database ledger exists (`charges` + `payment_entries`), but payments UI and Stripe are deferred.
- **One active season per sport.** Records auto-stamped with the season; users don't pick a season on forms.
- **Quality-gated, no hard deadline.** Finish each phase's gates; don't drift.
- **Backend confirmed before Season 1.** Relational linkage (intake→roster→waiver) is built ONCE against real Supabase tables, NOT mock-built first.

## Roster & Eligibility (Season 1)
- **Flow C-lite (built):** "Add Player" creates a profile; manual roster assignment sets team + jersey; season auto-stamped.
- **Do NOT build intake-conversion in mock state** (approve→team, assign→profile). Built once in the backend phase.
- **Eligibility is purely informational.** Never blocks anything in-app. Admin enforces physically IRL.
- **`<EligibilityIndicator>`:** reusable, icon + tooltip, not color-alone. Shown on rosters, score entry, team pages. Hosted data derives eligibility from the real profile/waiver workflow; mock mode retains seed status for local development.

## Waiver / Identity Model
- Waivers are a SEPARATE step from intake forms — never bundled.
- `waivers` records are APPEND-ONLY: never edit a signed waiver; re-signing creates a new row.
- `waiver_versions` table stores exact text per version (e.g. `CVF-WAIVER-2026-06-04-v1`).
- Submitted waiver ≠ eligibility. Eligibility = admin verification + team/season assignment.
- Capture: signed name, signed_at, email, phone, ip_address, user_agent, accepted_terms, age_confirmed, media_consent (optional), verification_status (pending/verified/rejected/duplicate).
- Adults only Season 1 ("I confirm I am 18+"). Minor/guardian flow deferred.
- The append-only waiver schema and hosted submission RPC exist. The public waiver experience remains gated on attorney-approved immutable waiver text and abuse protection; it must never use fallback legal text. The admin Waivers tab can consume hosted records, while its remaining placeholder copy/UI cleanup is separate frontend work.
- LEGAL: waiver language reviewed by a New Mexico attorney before launch.

## Score Lifecycle (built, working)
- Two parallel fields: `status` (upcoming/completed/postponed/canceled) = game lifecycle; `score_status` (pending/submitted/approved/disputed/final) = score lifecycle. Intentionally separate.
- Flow: pending → submitted (score saved) → final (Mark Final, locks game) → approved (on unlock) → submitted (on re-edit).
- A final game is LOCKED: editing requires deliberate unlock + required reason; every change appends to `editHistory` in mock mode and maps to the append-only `game_edit_history` table in the backend schema.

## Backend Data Model (twelve migrations; hosted and database-verified)
- seasons (natural text key such as `Summer 2026`; referenced by all season-scoped records)
- profiles (auth_user_id nullable, first/last/display name, email, phone, optional date of birth, emergency contacts, admin notes; age confirmation is recorded on signed waiver rows, not profiles)
- leagues (sport, season, status, kind: league/tournament, playoff_format; standalone tournaments are league containers with `kind='tournament'`)
- teams (league_id, captain contact, status, division)
- team_players (team_id, profile_id, season natural-key reference, jersey_number, roster_status: pending_waiver/eligible/inactive/removed)
- games (league_id, home/away team, date, location, stage: regular/playoff/tournament, status, score_status, locked, editHistory, scores, submitted_by, approved_by); database guards keep stages consistent with league kind and prevent changing a locked game's stage
- player_stats (profile_id, game_id, team_id, sport-specific fields)
- team_registrations (status: new/contacted/approved/archived, adminNotes[])
- free_agents (status: new/contacted/assigned/archived, assignedTeamId, adminNotes[])
- waivers (append-only — see Waiver model)
- charges + payment_entries (manual payments ledger; every charge targets exactly one of profile_id or team_id, and team charges must match the team's league season)
- hof_entries + league_settings.hof_published (admin-curated Hall of Fame; unpublished entries are hidden from public reads by RLS)

## Stat Categories
Flag Football — Passing (comp/att/comp%/yds/TD/INT), Rushing (carries/yds/TD/1st), Receiving (catches/yds/TD/1st), Defense (flag pulls/sacks/INT), Scoring (TD/1-2-3pt conversions).
Kickball — Offense (kicks/1B/2B/3B/HR/RBI/runs/walks/K), Defense (outs/assists/errors).

## Security (database controls verified; hosted identity acceptance partially complete)
- Row Level Security is enabled in migrations on all 18 tables — non-negotiable.
- Data API grants are explicitly allowlisted for anonymous and authenticated roles; RLS and API exposure grants remain separate controls.
- `public_profiles` is an intentional definer-style security boundary with an exact safe-field allowlist and forbidden-PII regression tests.
- Public scoreboard reads are allowed; anonymous writes are limited to constrained intake and waiver submissions.
- Only admin writes league data, edits scores, changes roles.
- Game lock and append-only edit history are database-enforced; RLS separately restricts role access.
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
8b. ✅ Frontend cleanup: logo placement, favicon, mobile nav CTAs, tap targets, accessibility (H1s, labels), real <form> elements, "My Team" filter
9. ◐ Backend wiring — database gate closed: twelve migrations are hosted and in sync, the real local Supabase stack is 100/100, anonymous Data API checks are 7/7, and hosted advisors/invariants are verified. Admin bootstrap, local hosted environment configuration, three-session role resolution, and the locked-score flow are complete; the full authorization matrix, account recovery controls, production/preview configuration, and live-flow verification remain.
10. Deploy + soft launch (domain, backups, clean reset, Season 1) — follows live backend verification

External critical-path dependency (unchanged): NM attorney waiver review. Other lead-time items: domain purchase · confirm friend's native-app stack.

## Deferred / Backlog
- `duplicate_season` RPC
- Bracket/seeding UI
- Hall of Fame admin curation screen
- Payments UI
- Season-aware selector fixes: `playerSeasonStats` needs explicit season/stage filters once two seasons of stats coexist
- Consolidate the seven overlapping permissive RLS-policy cases reported by the Supabase Performance Advisor. Preserve existing anonymous/public and admin authorization semantics, and add negative RLS regression coverage before applying the consolidation.
- Before Season 2 player/captain accounts are built, fully review the role-resolution path and confirm every admin-gated UI check derives from the validated `backendRole`.

## Intake Form Specs (built)
Free Agent (required: name, phone or email, sport, consent): legal first/last name, display name (opt), phone, email, sport (kickball/flag football/both), experience (opt), preferred position (opt), availability multi-select (Sunday morning/Sunday night/Monday night — configurable), emergency contact (opt), consent to contact (req). NO waiver content.

Team Interest (required: captain name, phone or email, sport, team name, consent): captain legal name/phone/email, sport, team name, estimated roster size (opt), preferred season (informational), consent (req), notes (opt). CTA standardized to "Submit Team Interest" — it's an interest form, not a registration that secures a spot.
