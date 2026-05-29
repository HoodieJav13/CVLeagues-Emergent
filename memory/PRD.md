# CVF Sports — PRD

## Original Problem
Mobile-first MVP web app for adult recreational kickball & flag football leagues in Albuquerque, NM. Free, dark-mode-native, player-first league management platform (GameChanger for adults). Frontend-only, local mock data + shared local state, no backend/auth/payments. Brand: CVF / Core Value Fitness (cyan #22d3ee, NM Zia accents, near-black #0f0f0f).

## Architecture (current)
- React (CRA) + Tailwind + React Router. Vite-friendly structure (no CRA-specific hacks).
- **Single shared source of truth**: `src/context/AppStateContext.js` holds all data (profiles, leagues, teams, teamPlayers, games, playerStats, freeAgents, registrations, settings) + mutation actions.
- **Derived data** (records, standings, stat totals, leaderboards) computed at render via `src/lib/selectors.js` from games + playerStats — so a score update propagates everywhere.
- Seed/mock data: `src/data/seed.js` (DB-shaped). Stat config: `src/lib/statsConfig.js`. Roles/permissions: `src/lib/roles.js`.
- Demo Role Preview switcher: `src/components/RoleSwitcher.js` (admin-only testing tool, floating bottom-left).

## Roles
anonymous, player, captain, admin, temp_admin. Production rules reflected in UI (RoleGate); demo switcher exists only because there's no real auth.

## Implemented (Feb 2026)
- Pages: Home, Schedule (filters), Standings (auto-sort), GameDetail (box score), TeamPage, Leaderboards (season/career per sport+stat), AthleteProfile (public/private tabs, role-gated), TeamRegistration (5–15 roster + validation), FreeAgentSignup, FreeAgentPool (captain/admin, invites), AdminDashboard (tabbed CRUD: leagues/teams/players/games/scores/free agents; reg windows; temp admin assign; resend invites; pending registrations), ScoreEntry (period + per-player stats).
- 8-step success loop wired through shared state.
- Mobile sticky bottom nav + desktop top bar, dark theme, Phosphor icons, sonner toasts.

## Phase 2 backlog (P0→P2)
- P0: Supabase (DB tables mirror seed shapes) + auth (replace demo switcher), realtime.
- P1: invite emails (Resend), photo upload (object storage), approve-registration auto-creates team.
- P2: team chat, push notifications, payments/Stripe, in-app notifications.

## Migration to Vite note
Swap react-scripts/craco for Vite; move index.html to root; rename entry, set `@` alias in vite config; env vars VITE_ prefix. No component logic changes needed.
