# CVF Leagues frontend

This directory contains the Create React App frontend for CVF Leagues. Run frontend commands from this directory.

## Setup

```sh
npm install
cp .env.example .env.local
npm start
```

The owner must enter sensitive environment values personally. `.env.local` is local-only and must not be committed.

## Backend modes

The frontend selects hosted Supabase mode only when both variables below are present:

```sh
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
```

Use the project's public anonymous/publishable key only. A service-role or secret key must never be placed in React, any `REACT_APP_*` variable, browser code, logs, or repository files.

Local development selects mock/localStorage mode only when both backend variables are absent. Supplying only one is a configuration error; the app does not load fixtures. Mock mode uses versioned storage (`cvf_app_state_v8`), validates persisted structure, migrates the immediately previous fixture version, removes abandoned keys, and provides an explicit reset. Any fixture-shape change must increment `STORAGE_VERSION` in `src/context/mockState.js`.

Preview and production fail closed. The production prebuild requires both Supabase values plus `REACT_APP_TURNSTILE_SITE_KEY`; the runtime independently renders a configuration error before mounting Auth, application state, or routes if configuration is incomplete. Optimized artifacts exclude the development seed records, and backend mode never reads from or writes to localStorage.

Mock mode mirrors the visible results of hosted registration approval, free-agent assignment, waiver verification, and roster removal. Database-only implementation details—transaction boundaries, audit attribution, RLS, and soft-delete storage—remain the backend's responsibility and are verified separately.

In hosted mode, Auth roles come from the real Supabase session and `is_admin()` validation. Role resolution fails closed to anonymous while validation is in flight. The demo role switcher belongs only to mock development mode.

## Commands

```sh
# Development server at http://localhost:3000
npm start

# Non-interactive frontend test suite
CI=true npm test -- --watchAll=false

# Optimized production build
npm run build
```

See the root [`README.md`](../README.md) for the project overview and [`../supabase/README.md`](../supabase/README.md) for backend verification and hosted-operation gates.
