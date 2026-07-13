# CVF Leagues

CVF Leagues is a mobile-first React application and Supabase backend for adult recreational kickball and flag football leagues in Albuquerque, New Mexico.

## Current state — July 13, 2026

- The repository is linked to the dedicated hosted Supabase project. All 12 migrations are applied locally and remotely with matching migration history.
- The real local Supabase stack passes 100/100 pgtest assertions and 7/7 anonymous Data API checks. Hosted schema invariants and both advisors have been reviewed with explicit dispositions.
- A real Auth administrator is linked through `admin_users`. Local frontend hosted-mode variables are configured, and anonymous, non-admin, admin role resolution plus the locked-score unlock flow have been verified against hosted Supabase.
- The hosted authorization matrix is complete and retained in [`supabase/HOSTED_AUTH_RUNBOOK.md`](supabase/HOSTED_AUTH_RUNBOOK.md) with [dated evidence](supabase/evidence/hosted-auth-matrix-2026-07-13.md). Production launch is not ready: MFA/recovery/session-revocation, the full live eight-step flow, production-safe mock handling, preview/production environment variables, legal/privacy readiness, abuse protection, backup recovery, and deployment remain open.

## Start here

- Project status and product rules: [`CLAUDE.md`](CLAUDE.md)
- Repository working agreement: [`AGENTS.md`](AGENTS.md)
- Database status, advisor dispositions, and runbook: [`supabase/README.md`](supabase/README.md)
- Frontend setup and backend modes: [`frontend/README.md`](frontend/README.md)
- Visual-system source of truth: [`CVLeagues_Design_Tokens.md`](CVLeagues_Design_Tokens.md)

## Verification

Run from the repository root:

```sh
cd frontend && CI=true npm test -- --watchAll=false
cd frontend && npm run build
./tests/pgtest/run_pgtest.sh
```

Never commit secrets or place a service-role/secret key in React. Hosted writes, Auth/admin changes, migration pushes, deployments, and destructive operations require explicit owner approval.
