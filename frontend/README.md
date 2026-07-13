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

If either backend variable is missing, the current implementation silently activates mock data and localStorage. That behavior supports explicit local development, but it also occurs in production builds and is a launch blocker. Preview and production must not be deployed until backend configuration is present and the production mock-fallback gate is hardened.

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
