# CVF Sports — Leagues App

This file is the authoritative repository source for current product status, locked product decisions, roadmap state, and the owner action queue. Repository working rules live in [`AGENTS.md`](AGENTS.md); schema, migration, and hosted-backend verification facts live in [`supabase/README.md`](supabase/README.md).

## What This Is
A mobile-first web app for running adult recreational kickball and flag football leagues in Albuquerque, NM. Public users view schedules, standings, scores, teams, and stats. An admin (the owner) manages everything. Built free as a player-first alternative to GameChanger, focused on adult rec leagues.

Frontend was generated via Emergent (React + CRA), polished with a design-system-first UI pass, extended in Claude Code, and given a full visual-token upgrade. The Supabase adapter is env-gated and explicit mock mode remains available for local development. The repository contains twenty-eight migrations and passes 314/314 database assertions plus a real two-connection ledger race locally, alongside 169/169 frontend tests. **Twenty-seven migrations are hosted; Migration 28 is local-only and unpushed.** Sequence 4's 26-table / 25-RPC real-session authorization matrix is accepted at 256/256 with zero fixture residue and exact baseline restoration, at the twenty-seven-migration baseline. Migration 28 adds two tables and one RPC beyond that accepted matrix, so the matrix must be expanded and re-run before any hosted push. The durable populated-ledger pilot remains a separate gate. Preview/production acceptance remains open.

## Current Status
- Public site: all pages working; the existing eight-step aggregate score-entry flow is verified in mock mode. The admin live-ledger runtime and UI are built and locally verified, while the hosted flag-football pilot is not yet authorized.
- Intake forms (Free Agent + Team Interest): rebuilt to spec, feeding shared state
- Admin dashboard: COMPLETE locally — 11 tabs including brackets, manual payments, and Hall of Fame curation; triage workflows, game lock + edit history, waiver queue, and operational overview
- Roster flow (Flow C-lite): Add Player, manual assignment, eligibility indicator — done
- Functional cleanup: env-gated demo switcher, dormant account surfaces, empty states, destructive confirmations — done
- Structural tweaks: player sport-tabs, schedule competition register, modal overflow fixes — done
- Mock-state boundary review: COMPLETE and owner-accepted in `a2839cc` — localStorage is development-only and versioned, production/preview fail closed, optimized artifacts exclude fixtures, and the key admin mock flows match their hosted visible outcomes.
- Visual foundation: design tokens, typography (Oswald/Inter), status language, focus rings, empty-state styling, accessibility, and motion-system cleanup — done.
- Pass 4 visual elevation: Batch 0 Home/Game Detail identity, Batch 1 Schedule competition register, Batch 2 Standings hierarchy, and Batch 2.5 multi-category Leaderboards dashboard are committed on `main`. Team/Profile, Playoffs, and forms remain later approved batches.
- Competition display and stat isolation: `StageBanner` marks playoff/tournament games, Season 1 has a real single-elimination bracket workflow, and tournament statistics are tracked separately and excluded from league-season and league-career/all-time totals.
- Extended-runway backend: all twenty-seven published migrations apply locally and are hosted; the two-connection append race passes and the current operational Season 1 baseline remains preserved. Sequence 4 behavioral authorization acceptance passed at 256/256 at that baseline.
- Player-experience program (in progress, unfrozen): Stages 1 and 2 are complete. The derived-stat engine, participation-aware selectors, standings form/streak/tie-rank display, full public profile, franchise history, and remembered view filters are committed. Migration 28 (venues, authoritative `starts_at`, participation) is local-only at 314/314 assertions, with the frontend fully migrated to the new game shape and admin venue management shipped.
- Running locally via `npm start` from `frontend/`; always confirm the checked-out branch before editing.
- Navbar logo at `src/assets/cvf-logo-transparent.png`
- Dedicated hosted backend is linked and aligned at twenty-seven migrations, one behind the repository. The least-privilege service-role catalog, both advisors, Migration 23 RPC-only aggregate boundary, Migration 24 private ledger boundary, and Sequence 4's accepted 256/256 expanded matrix remain evidenced at that baseline. Recovery/session-revocation acceptance, preview/production variables, live application flows, and deployment remain open.

## Current Priority
Leagues is reactivated for the player-experience program, sequenced below. There is **no deadline** — the season is not imminent and quality governs. Preview and production deployment are deliberately deferred to the end of the program rather than run mid-way. Sequence 5's durable flag-football pilot, overtime handling, `INV-07` paired-stat reconciliation, and Sequence 6 field testing remain frozen and are not part of this program. Attorney-approved New Mexico waiver text remains an independent launch blocker.

### Player-experience program order
Each stage depends on the ones before it; schema lands before the data is displayed, and each visual pass runs after the data it renders so nothing is designed twice.

1. **Selector and display foundations** *(done)* — derived-stat engine, participation-aware selectors, rank context, standings form/streak/shared tie ranks, full public profile.
2. **Migration 28: venues, `starts_at`, participation** *(done)* — full cutover, no second copy of game time. Admin venue management shipped here rather than in Stage 4, because Migration 28 made `venue_id` required and leaving no way to create one would have blocked the hosted push.
3. **Calendar and reminders** *(done)* — per-game add-to-calendar, per-team season download, and a subscribable `/api/calendar` feed that re-fetches itself so a reschedule reaches every subscriber. The feed shares the app's iCalendar generator rather than duplicating it, and reads with the anon key over publicly readable rows only.
4. **Migration 29: media and identity** — profile and team imagery, designed as a general media table so highlights slot in later rather than two URL columns. Restyles the venue tab as part of its admin-content pass rather than building it.
5. **Captain accounts plus optional tokenized player links** — see the locked decision below.
6. **RSVP and availability** — built on Stage 5.
7. **Pass 4 visual: Team/Profile and the shareable stat card** — consumes every stage above.
8. **Deferred-debt sweep** — legacy `current_season` retirement, overlapping RLS policy consolidation, the `react-day-picker`/`date-fns` peer conflict requiring `--legacy-peer-deps`.
9. **Ledger pilot, preview, production** — unchanged gates, run last.

## Owner Action Queue

- **Launch remains blocked on attorney-approved waiver text regardless of all other gates closing.** After approval, insert the final text as a new immutable `waiver_versions` row; never substitute draft or fallback legal text.
- **Approve the Migration 28 hosted push when the program reaches a natural checkpoint.** It is committed and locally verified but deliberately unpushed. It drops three `games` columns, so it is not silently reversible on hosted; expand and re-run the authorization matrix over the two new tables and one new RPC first.
- Complete the real administrator's recovery and session-revocation acceptance; decide whether a break-glass administrator is warranted. TOTP enrollment and AAL2 elevation are already complete.
- Enter preview/production Supabase and Turnstile environment values personally, without exposing a service-role or secret key to React. The calendar feed additionally needs `SUPABASE_ANON_KEY` and optionally `PUBLIC_SITE_ORIGIN` server-side; it must never be given the secret key.
- **Verify the calendar subscription against a real client at deployment.** The feed is unit-tested but cannot be proven end to end without a public URL: confirm a phone accepts `webcal://<host>/api/calendar?team=<id>` and picks up a reschedule on its own.
- If Leagues is reactivated, separately approve the durable populated-ledger pilot fixture. Field-test the admin-only flag-football pilot before approving a second sport or live use.
- Run live hosted application flows and the remaining visual-consistency acceptance across desktop and mobile before approving preview.
- Approve production deployment only after every technical, visual, operational, and legal gate above is closed.

## Tech Stack
- Frontend: React (Create React App), React Router
- Styling: Tailwind CSS v3 + CSS variables; shadcn/ui components in `src/components/ui`
- Design tokens: full token system in `src/index.css` (:root) + `tailwind.config.js`. Brand = teal (primary/action), gold (achievement/needs-attention), Zia red (alert/live only). Sport accent: flag football = orange token, kickball = teal. Three-signal status system kept intact; meanings never rely on color alone (always shape/label/icon too).
- State: single shared `AppStateContext` (the one source of truth)
- Business logic: pure selectors in `src/lib/selectors.js`
- Roles: `src/lib/roles.js`
- Seed/mock data: `src/data/seed.js`
- Persistence: Supabase in hosted mode; versioned localStorage only in explicit local-development mock mode (never a production/preview fallback)
- Backend: Supabase (PostgreSQL + Auth); twenty-eight migrations are verified by the isolated harness and twenty-seven are applied to the dedicated hosted project. The real administrator, Sequence 4's 256/256 authorization matrix, least-privilege service-role boundary, and hosted advisors are accepted. Preview/production configuration, the durable populated-ledger pilot, and live-flow acceptance remain open.
- Deployment target: Vercel (Phase 10)

## Architecture Rules — Read Before Editing
- `AppStateContext`, `selectors.js`, `roles.js`, `seed.js` are the protected core. Extend; don't rewrite structure/logic unless explicitly scoped.
- Admin and public read/write the SAME shared state. A score entered in admin updates public schedule/standings/stats automatically. Never create a separate admin data store.
- Preserve `AppStateContext` action signatures across mock and hosted Supabase paths. Describe new work using the current backend/live-verification roadmap terminology rather than the retired `PHASE 2` swap-point label.
- Out-of-scope account/login features are kept dormant behind the `FINAL_DRAFT` flag, not deleted.
- Use existing shared components and design tokens — no new UI libraries, no rogue hex colors (map to tokens).
- Mobile-first: every view works at iPhone SE width (375px) and up.

## Visual Direction and Audit Method — Binding

- [`docs/direction/CVLeagues_Art_Direction_Contract.md`](docs/direction/CVLeagues_Art_Direction_Contract.md), including all four addenda, governs every visual audit and implementation pass. Structural surface lines remain the selected Pass 3 base; Addendum 4 replaces badge rays with the octagon plus offset outline, establishes copper for rank-three semantics, and adds OT7 as the Leaderboards/stats reference anchor.
- For a genuine visual-direction choice, present the contract-compliant treatment and a deliberately bolder variant. Both must remain inside the contract; the bolder option must visibly push concrete size, weight, or opacity values instead of becoming a second conservative interpretation.
- Identity motifs must clear the contract's cold-screenshot visibility floor. Ambiguity does not default to the least noticeable safe option; make the compliant distinction clearly visible, then let the owner choose between meaningful alternatives.
- Audit Home and Schedule against Apple Sports, Standings and Playoffs against “World Cup 2026, simplified” by sheets.works, and Leaderboards/stats against OT7. Use exactly four finding verdicts: **BLOCKING / NON-BLOCKING / VISUALLY INSUFFICIENT / ALREADY FINE**.
- **VISUALLY INSUFFICIENT** means an element may be correct and contract-compliant but still reads as a competent template rather than reference-tier work. Log it with capture evidence and a proposed direction; never fold it into ALREADY FINE.
- Every proposed styling, motion, or identity change must state its concrete visual delta (size, color, position, opacity, or timing) and implementation cost (files, components, dependencies). High-cost work with marginal visible impact returns to the owner for reconsideration instead of being presented as complete.

## Product Decisions — Locked
- **Admin-only for Season 1, with MFA required.** Only the admin logs in, and administration requires a verified AAL2/TOTP session. Players are profile records, not accounts. **Amended by the captain-accounts decision below, which takes effect only when Stage 5 is implemented; until then this rule stands unchanged.**
- **Captain accounts plus optional tokenized player links (approved direction, not yet built).** Open player self-signup is explicitly rejected: adult rec players have no standing reason to log in, so a full account surface risks being built for nobody while adding a barrier to signup. Instead, captains — who already do the organizing work and are already identified by name, phone, and email on every team registration — receive real admin-invited accounts with scoped permissions. Admin-issued invitations to a known set largely dissolve the profile-claiming risk that makes open claiming dangerous. Players get an optional personal link requiring no password or signup, which tests engagement cheaply and can later become a claim flow, since `profiles.auth_user_id` is already nullable for exactly that. Captains will be the first authenticated non-admin principal with real read/write rights, so captain-scoped RLS is new high-stakes work needing its own negative matrix, and captain sessions need an assurance tier below the admin's AAL2/TOTP.
- **Game start time is a single authoritative timestamp.** `games.starts_at` (timestamptz) is the only record of when a game happens. The former `date` column plus `time` display string were dropped rather than kept alongside it, because two sources for one fact drift the moment one is edited without the other. Venue is likewise a real `venues` reference, not free text.
- **Participation is not part of the score lifecycle.** `game_participation` records who appeared. It is never written by the scoring RPCs, is not governed by the game lock, and never interacts with the aggregate or ledger correction authority. A statistics row is not evidence of appearing — a player can appear and record nothing — so games played is tracked directly and every per-game figure derives from it. An unknowable rate renders as an em dash, never as zero.
- **Auth User ≠ Player.** `profiles.auth_user_id` is nullable so a player can claim an account later without losing history.
- **Sports at launch:** kickball and flag football only.
- **Payments:** manual, admin-only, admin-correctable tracking for Season 1. The UI and ledger are built locally; Stripe, reversal/void accounting, player-visible balances, and automation remain deferred.
- **Score corrections have one authority per game.** Aggregate games use AAL2 `correct_final_score`: a required reason, the same HARD/SOFT validation contract as initial entry, atomic score/stat replacement plus append-only audit, and no intermediate unlock. Once a game begins event-ledger scoring, immutable ledger events become its only correction source; it never returns to aggregate editing.
- **Ledger projections are derived, not independently editable.** For event-ledger games, `games` scores, `player_stats`, standings/playoff effects, and `game_edit_history` are system outputs. A post-final correction opens an AAL2 reasoned correction session, appends void/replacement events, then atomically reprojects, preserves/re-establishes the final lock, handles playoff effects, and writes append-only history. `game_edit_history` is audit output only, never a competing score input.
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
- **Mock intake conversion mirrors hosted outcomes, not backend internals.** Local registration approval and free-agent assignment create the visible team/profile/roster/waiver-link results needed for realistic review. Transactionality, authorization, attribution, and storage invariants remain backend-only concerns.
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

## Score Lifecycle

### Existing aggregate flow (built)

- Two parallel fields: `status` (upcoming/completed/postponed/canceled) = game lifecycle; `score_status` (pending/submitted/approved/disputed/final) = score lifecycle. Intentionally separate.
- Flow: pending → submitted (score saved) → final (Mark Final, locks game). A correction drafts replacement values locally, requires a reason, passes the same HARD/SOFT validation tiers, and atomically replaces the aggregate score/stats while the public game remains completed, final, and locked.
- Initial aggregate submission and final correction are RPC-only. `game_edit_history` records actor, timestamp, reason, non-authoritative before/after snapshots, any SOFT override reason, and warnings; it is audit output, never a competing score input.

### Event Ledger Lite correction contract (runtime published; authorization boundary accepted)

- Migration 24 adds explicit aggregate/ledger mode, a controlled one-way conversion guard, private session/rule/participant snapshots, server-assigned per-game event sequences, game-scoped idempotency keys, append-only events/attributions, and void/replacement chain constraints.
- Migrations 25–27 add ten AAL2 runtime RPCs, rotating leases, deterministic projection/finalization, scoreless forfeits, and one ledger correction authority without weakening the prior boundary. They are committed and hosted with structural/catalog readback and the 256/256 real-session authorization matrix complete; the durable populated-ledger pilot remains pending and frozen.
- Ordinary scoring and corrections append domain events; clients never directly mutate score/stat projections or edit history.
- Finalization projects the ledger deterministically and locks the public result.
- After finalization, public results remain locked while an AAL2 administrator drafts a reasoned correction. Applying it atomically appends void/replacement events, rebuilds every affected projection, reconciles bracket advancement, records system-generated append-only history, and returns the game to a final locked state.
- Aggregate correction remains available only to games that have never entered ledger mode. The two correction mechanisms never write the same game's authoritative score.

## Backend Data Model (twenty-eight repository migrations, twenty-seven hosted; behavior accepted through Migration 24)
- seasons (natural text key such as `Summer 2026`; referenced by all season-scoped records)
- league_settings (singleton publication/registration settings plus per-sport current-season defaults; legacy `current_season` is compatibility-only)
- profiles (auth_user_id nullable, first/last/display name, email, phone, optional date of birth, emergency contacts, admin notes; age confirmation is recorded on signed waiver rows, not profiles)
- leagues (sport, season, status, kind: league/tournament, playoff_format; standalone tournaments are league containers with `kind='tournament'`)
- team_identities (persistent canonical name, color, founded year, lifecycle)
- teams (identity_id, league_id, captain contact, status, division; one explicit container enrollment)
- team_players (team_id, profile_id, season natural-key reference, jersey_number, roster_status: pending_waiver/eligible/inactive/removed)
- venues (name, address, field label, coordinates, lifecycle status; publicly readable, admin-write, never client-deletable because historical games reference them)
- games (league_id, home/away team, `starts_at` timestamptz, venue_id, stage: regular/playoff/tournament, status, score_status, locked, scorekeeping_mode: aggregate/ledger, scores, submitted_by, approved_by); database guards keep stages consistent with league kind, enforce one-way ledger conversion, and prevent aggregate scoring RPCs from governing a ledger game. Migration 23's column-level allowlist lets authenticated clients edit schedule columns only — `starts_at` and `venue_id` are in it, score/stat/history columns are not
- game_participation (game_id, profile_id, team_id, status: played/absent/excused, source: admin/stats, recorded_by; unique per game+player, team must be playing in that game). Written only by `set_game_participation`, deliberately outside the score lock
- player_stats (profile_id, game_id, team_id, sport-specific fields)
- career_baselines (controlled historical aggregates that must not overlap granular game seasons)
- game_edit_history (append-only RPC-written audit records; aggregate corrections include reason, before/after snapshots, SOFT override reason, and validation warnings)
- team_registrations (status: new/contacted/approved/archived, adminNotes[])
- free_agents (status: new/contacted/assigned/archived, assignedTeamId, adminNotes[])
- waivers (append-only — see Waiver model)
- charges + payment_entries (manual payments ledger; every charge targets exactly one of profile_id or team_id, and team charges must match the team's league season)
- hof_entries + public_hof_entries + league_settings.hof_published (admin-only curation base; published display fields use an explicit safe-field view)
- playoff_brackets + playoff_seeds + playoff_matches (fixed bracket topology, seed snapshot, scheduled/linked games, manual advancement, third-place path)
- scorekeeping_sessions + scorekeeping_participants (private immutable rule/game/roster snapshots, ordinary/correction separation, lease/version state, one active session per game)
- scorekeeping_events + scorekeeping_event_attributions (private append-only ordered ledger, game-scoped idempotency, server-assigned sequence, void/replacement integrity, snapshotted-player attribution)

## Stat Categories
Flag Football — Passing (comp/att/comp%/yds/TD/INT), Rushing (carries/yds/TD/1st), Receiving (catches/yds/TD/1st), Defense (flag pulls/sacks/INT), Scoring (TD/1-2-3pt conversions).
Kickball — Offense (kicks/1B/2B/3B/HR/RBI/runs/walks/K), Defense (outs/assists/errors).

## Security (local and hosted controls verified at their stated baselines)
- Row Level Security is enabled on all 28 local (26 hosted) tables — non-negotiable. Migration 28's two new tables are publicly readable by design (where a game is played and who played in it are both box-score facts) and admin-write. Migration 24's four private tables have admin-read-only RLS, no anonymous grant, no client write grant, and no service-role privilege locally and hosted.
- Data API grants are explicitly allowlisted for anonymous and authenticated roles; RLS and API exposure grants remain separate controls.
- `public_profiles` is an intentional definer-style security boundary with an exact safe-field allowlist and forbidden-PII regression tests.
- Public scoreboard reads are allowed. Anonymous intake and waiver submissions pass through the Turnstile-verified server endpoint; direct Data API inserts are denied.
- Only admin writes league data, edits scores, changes roles.
- Game lock and append-only edit history are database-enforced; RLS separately restricts role access. Migration 23 makes aggregate score/stat/history mutation RPC-only locally and hosted and retires client execution of the bare unlock path.
- Playoff topology and team identity/enrollment mutation are RPC-only; direct authenticated table writes are revoked.
- `service_role` has only `INSERT` on `team_registrations` and `free_agents`, no other public-table privilege, no public-sequence privilege, and no public-function execution. Platform-owned `supabase_admin` default ACLs are an accepted Supabase boundary; current objects are explicitly re-revoked.
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
9. ✅ Backend wiring and hosted baseline acceptance — 24 hosted migrations, least-privilege service-role catalog, both advisors, and 225/225 real-session and catalog authorization checks accepted.
9b. ✅ Extended-runway build — launch hardening, season/tournament isolation, Season 1 brackets, manual payments, admin Hall of Fame curation, and persistent team enrollment.
9c. ◐ Scorekeeping integrity program — Stages 0–1 are committed; Stage 2 aggregate hardening and Stage 3 Event Ledger Lite schema are hosted-accepted. Stage 4A–4C runtime/projection/correction is accepted after 294/294 plus a two-connection race, 128/128 frontend tests, 10/10 matrix contract tests, passing hosted structural/catalog/advisor readback, and the 256/256 expanded real-session matrix. The program is frozen before Stage 5 flag-football pilot/practice mode and Stage 6 field test/rollout decision.
9d. ◐ Pass 4 visual elevation — Batches 0–2.5 complete; Team/Profile, Playoffs, and forms resume inside the player-experience program (its Stage 7).
9e. ◐ Player-experience program — the nine stages under Current Priority. Stages 1 and 2 are complete at 169/169 frontend tests and 314/314 database assertions, including the full `starts_at` cutover and admin venue management. Stage 3 is in progress; Stages 4–9 not started.
10. Deploy + soft launch (domain, recovery, live-flow acceptance, Season 1) — remains blocked by final waiver text and the remaining owner gates, and now deliberately sequenced after the player-experience program rather than mid-way through it

External critical-path dependency (unchanged): NM attorney waiver review. Other lead-time items: domain purchase · confirm friend's native-app stack.

## Deferred / Backlog
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
