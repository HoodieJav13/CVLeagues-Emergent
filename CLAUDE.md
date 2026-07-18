# CVF Sports — Leagues App

This file is the authoritative repository source for current product status, locked product decisions, roadmap state, and the owner action queue. Repository working rules live in [`AGENTS.md`](AGENTS.md); schema, migration, and hosted-backend verification facts live in [`supabase/README.md`](supabase/README.md).

## What This Is
A mobile-first web app for running adult recreational kickball and flag football leagues in Albuquerque, NM. Public users view schedules, standings, scores, teams, and stats. An admin (the owner) manages everything. Built free as a player-first alternative to GameChanger, focused on adult rec leagues.

Frontend was generated via Emergent (React + CRA), polished with a design-system-first UI pass, extended in Claude Code, and given a full visual-token upgrade. The Supabase adapter is env-gated and explicit mock mode remains available for local development. The repository now contains twenty-one migrations verified by the isolated and real-stack harnesses; hosted Supabase remains at the first-twelve accepted baseline, so hosted mode must not be treated as compatible until the nine pending migrations pass their separate hosted checkpoint. Preview/production acceptance remains open.

## Current Status
- Public site: all pages working; the eight-step score-entry flow is verified in mock mode only
- Intake forms (Free Agent + Team Interest): rebuilt to spec, feeding shared state
- Admin dashboard: COMPLETE locally — 11 tabs including brackets, manual payments, and Hall of Fame curation; triage workflows, game lock + edit history, waiver queue, and operational overview
- Roster flow (Flow C-lite): Add Player, manual assignment, eligibility indicator — done
- Functional cleanup: env-gated demo switcher, dormant account surfaces, empty states, destructive confirmations — done
- Structural tweaks: player sport-tabs, schedule week-grouping, modal overflow fixes — done
- Visual upgrade (Phase 8a, four batches): design tokens, typography (Oswald/Inter), status pills, game cards (3-per-row desktop), standings, focus rings, empty-state styling, copy fixes — done
- Competition display and stat isolation: `StageBanner` marks playoff/tournament games, Season 1 has a real single-elimination bracket workflow, and tournament statistics are tracked separately and excluded from league-season and league-career/all-time totals.
- Extended-runway backend: twenty-one migrations apply in the isolated and real-stack harnesses and 211/211 pgtest assertions pass. The hosted project remains at the twelve-migration baseline until owner approval.
- Running locally via `npm start` from `frontend/`; always confirm the checked-out branch before editing.
- Navbar logo at `src/assets/cvf-logo-transparent.png`
- Dedicated hosted backend is linked and accepted at its July 13 baseline. The real administrator is linked, three-session role resolution and the locked-score flow are hosted-verified, and the 66-check evidence is retained. The nine pending migrations, expanded matrix, advisors, recovery acceptance, preview/production variables, and live application flows remain open.

## Current Priority
The extended-runway build is locally complete; its historical implementation record is [`docs/EXTENDED_RUNWAY_IMPLEMENTATION.md`](docs/EXTENDED_RUNWAY_IMPLEMENTATION.md). Next is an owner-controlled hosted acceptance: nine-migration dry-run/review → approved push → expanded 22-table/15-RPC authorization matrix and advisors → preview/live-flow acceptance → production launch. Attorney-approved New Mexico waiver text remains an independent blocker.

## Owner Action Queue

- **Launch remains blocked on attorney-approved waiver text regardless of all other gates closing.** After approval, insert the final text as a new immutable `waiver_versions` row; never substitute draft or fallback legal text.
- Confirm a current off-platform database backup/export and recovery plan before any hosted migration push.
- Review `supabase migration list` and `supabase db push --dry-run`, then approve the hosted push separately if and only if the expected nine migrations are shown.
- Verify hosted TOTP configuration and the real administrator's factor enrollment, AAL2 elevation, recovery, session revocation, and any break-glass decision.
- Enter preview/production Supabase and Turnstile environment values personally, without exposing a service-role or secret key to React.
- After the approved push, require the 22-table/15-RPC hosted authorization matrix, service-role catalog checks, migration-history verification, and both Supabase advisors to pass.
- Create real Season 1 league and team records only after the clean hosted state is accepted.
- Run live hosted application flows and a dedicated visual-consistency audit of brackets, payments, and Hall of Fame across desktop and mobile before approving preview.
- Approve production deployment only after every technical, visual, operational, and legal gate above is closed.

## Tech Stack
- Frontend: React (Create React App), React Router
- Styling: Tailwind CSS v3 + CSS variables; shadcn/ui components in `src/components/ui`
- Design tokens: full token system in `src/index.css` (:root) + `tailwind.config.js`. Brand = teal (primary/action), gold (achievement/needs-attention), Zia red (alert/live only). Sport accent: flag football = orange token, kickball = teal. Three-signal status system kept intact; meanings never rely on color alone (always shape/label/icon too).
- State: single shared `AppStateContext` (the one source of truth)
- Business logic: pure selectors in `src/lib/selectors.js`
- Roles: `src/lib/roles.js`
- Seed/mock data: `src/data/seed.js`
- Persistence (current fallback): localStorage
- Backend: Supabase (PostgreSQL + Auth); twenty-one migrations are verified by the isolated and real-stack harnesses, the first twelve plus the real admin link are applied and verified in the dedicated hosted project, and the local frontend is configured for hosted mode. The nine-migration hosted extension, expanded authorization acceptance, and preview/production configuration remain open.
- Deployment target: Vercel (Phase 10)

## Architecture Rules — Read Before Editing
- `AppStateContext`, `selectors.js`, `roles.js`, `seed.js` are the protected core. Extend; don't rewrite structure/logic unless explicitly scoped.
- Admin and public read/write the SAME shared state. A score entered in admin updates public schedule/standings/stats automatically. Never create a separate admin data store.
- Preserve `AppStateContext` action signatures across mock and hosted Supabase paths. Describe new work using the current backend/live-verification roadmap terminology rather than the retired `PHASE 2` swap-point label.
- Out-of-scope account/login features are kept dormant behind the `FINAL_DRAFT` flag, not deleted.
- Use existing shared components and design tokens — no new UI libraries, no rogue hex colors (map to tokens).
- Mobile-first: every view works at iPhone SE width (375px) and up.

## Product Decisions — Locked
- **Admin-only for Season 1, with MFA required.** Only the admin logs in, and administration requires a verified AAL2/TOTP session. Players are profile records, not accounts.
- **Auth User ≠ Player.** `profiles.auth_user_id` is nullable so a player can claim an account later without losing history.
- **Sports at launch:** kickball and flag football only.
- **Payments:** manual, admin-only, admin-correctable tracking for Season 1. The UI and ledger are built locally; Stripe, reversal/void accounting, player-visible balances, and automation remain deferred.
- **Current season is per sport.** Multiple seasons may coexist long term; public views default to the chosen sport's current season and historical seasons remain selectable.
- **Tournament stats are separate.** They are tracked but excluded from league-season and league-career/all-time totals.
- **Historical stat classification locks after granular stats exist.** A stat-bearing game cannot move leagues, and its league cannot change season or switch between league/tournament kind. Season-name cascades remain supported.
- **Career baseline import contract.** A historical season belongs either to `career_baselines` or granular game stats, never both. This accepted import-process constraint is documented and non-blocking for Season 1.
- **Legacy season compatibility.** `league_settings.current_season` remains temporarily for older consumers but is non-authoritative once the per-sport defaults diverge. Its eventual removal is documented, non-blocking debt.
- **Team continuity uses identities plus enrollments.** `team_identities` is the persistent brand; each `teams` row is an explicit league/season/sport/tournament enrollment with no automatic roster/payment/history carryover. The deferred `duplicate_season` concept was intentionally superseded by enrolling an existing `team_identity` into the selected league, season, sport, or tournament.
- **Team mutation is RPC-only.** Authenticated clients cannot directly insert, update, or delete persistent identities or enrollment rows; narrow admin RPCs own supported mutations.
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

## Backend Data Model (twenty-one migrations in the local source of truth; first twelve hosted)
- seasons (natural text key such as `Summer 2026`; referenced by all season-scoped records)
- profiles (auth_user_id nullable, first/last/display name, email, phone, optional date of birth, emergency contacts, admin notes; age confirmation is recorded on signed waiver rows, not profiles)
- leagues (sport, season, status, kind: league/tournament, playoff_format; standalone tournaments are league containers with `kind='tournament'`)
- team_identities (persistent canonical name, color, founded year, lifecycle)
- teams (identity_id, league_id, captain contact, status, division; one explicit container enrollment)
- team_players (team_id, profile_id, season natural-key reference, jersey_number, roster_status: pending_waiver/eligible/inactive/removed)
- games (league_id, home/away team, date, location, stage: regular/playoff/tournament, status, score_status, locked, editHistory, scores, submitted_by, approved_by); database guards keep stages consistent with league kind and prevent changing a locked game's stage
- player_stats (profile_id, game_id, team_id, sport-specific fields)
- team_registrations (status: new/contacted/approved/archived, adminNotes[])
- free_agents (status: new/contacted/assigned/archived, assignedTeamId, adminNotes[])
- waivers (append-only — see Waiver model)
- charges + payment_entries (manual payments ledger; every charge targets exactly one of profile_id or team_id, and team charges must match the team's league season)
- hof_entries + public_hof_entries + league_settings.hof_published (admin-only curation base; published display fields use an explicit safe-field view)
- playoff_brackets + playoff_seeds + playoff_matches (fixed bracket topology, seed snapshot, scheduled/linked games, manual advancement, third-place path)

## Stat Categories
Flag Football — Passing (comp/att/comp%/yds/TD/INT), Rushing (carries/yds/TD/1st), Receiving (catches/yds/TD/1st), Defense (flag pulls/sacks/INT), Scoring (TD/1-2-3pt conversions).
Kickball — Offense (kicks/1B/2B/3B/HR/RBI/runs/walks/K), Defense (outs/assists/errors).

## Security (local controls verified; hosted extension pending)
- Row Level Security is enabled on all 22 local exposed tables — non-negotiable. The hosted accepted baseline currently contains 18 tables.
- Data API grants are explicitly allowlisted for anonymous and authenticated roles; RLS and API exposure grants remain separate controls.
- `public_profiles` is an intentional definer-style security boundary with an exact safe-field allowlist and forbidden-PII regression tests.
- Public scoreboard reads are allowed. Anonymous intake and waiver submissions pass through the Turnstile-verified server endpoint; direct Data API inserts are denied.
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
9. ◐ Backend wiring — July 13 hosted baseline accepted; July 14–15 extended-runway work is locally complete at 21 migrations and 211/211 pgtest assertions. Hosted application and expanded acceptance remain open.
9b. ✅ Extended-runway local build — launch hardening, season/tournament isolation, Season 1 brackets, manual payments, admin Hall of Fame curation, and persistent team enrollment.
10. Deploy + soft launch (domain, backups, clean reset, Season 1) — follows live backend verification

External critical-path dependency (unchanged): NM attorney waiver review. Other lead-time items: domain purchase · confirm friend's native-app stack.

## Deferred / Backlog
- **Next frontend-quality stage — dedicated mock-state review before broader UI work.** The dependency/abuse-protection sequence is complete through axios removal (`6261f90`), React Router 7.18.1 (`4c75a7b`), and Turnstile lifecycle/failure hardening (`e6af8ed`). Before resuming general UI or motion work, inventory every mock-data and localStorage runtime path and verify that production and preview cannot silently fall back to either; distinguish test/demo fixtures from deployable behavior; check persistence reset/migration, stale-fixture leakage, and parity with hosted-data flows; then return findings, proposed changes, tests, risks, and rollback through the normal owner review gate before implementation.
- Consolidate the remaining overlapping permissive RLS-policy cases only after measured need or during a deliberate authorization redesign. The team overlap disappeared when direct team writes were removed; preserve all remaining public/admin semantics and rerun the complete negative matrix before further consolidation.
- Season 2 player/captain self-service: signup, email verification, password recovery, safe profile claiming, captain permissions, abuse controls, and a new authorization matrix. This remains outside Season 1 and is also gated by the waiver/eligibility design.
- Public Hall of Fame route and publication control.
- Hall of Fame cross-field consistency: optional game/profile/team context is not checked against the selected sport, season, or record scope. Low risk while one administrator curates every row; revisit before expanding curator permissions.
- Tournament-specific leaderboard/history UI. Tournament rows are safely isolated from league totals now.
- Payment processor integration and automated reminders/reconciliation. The unresolved profile-charge context is the same season/sport modeling gap as the legacy `current_season` singleton and should be revisited with it.
- Double-elimination and round-robin bracket engines; Season 1 is single elimination only.

## Intake Form Specs (built)
Free Agent (required: name, phone or email, sport, consent): legal first/last name, display name (opt), phone, email, sport (kickball/flag football/both), experience (opt), preferred position (opt), availability multi-select (Sunday morning/Sunday night/Monday night — configurable), emergency contact (opt), consent to contact (req). NO waiver content.

Team Interest (required: captain name, phone or email, sport, team name, consent): captain legal name/phone/email, sport, team name, estimated roster size (opt), preferred season (informational), consent (req), notes (opt). CTA standardized to "Submit Team Interest" — it's an interest form, not a registration that secures a spot.
