# CVF Leagues

CVF Leagues is a mobile-first React application and Supabase backend for adult recreational kickball and flag football leagues in Albuquerque, New Mexico.

## Current state — July 14, 2026

- The extended-runway implementation is complete locally. It adds MFA-gated administration and protected intake, per-sport current seasons, tournament-safe stat scopes, fixed single-elimination brackets, admin-only payments and Hall of Fame workflows, and persistent team identities with explicit season/sport enrollment.
- Twenty additive migrations apply cleanly from scratch in the isolated database harness. The complete local database harness passes 207/207 assertions; the frontend passes 37/37 tests and the production build.
- The dedicated hosted Supabase project remains at the previously accepted 12-migration, 18-table baseline. Its retained 66-check authorization evidence is still valid for that baseline.
- Eight new migrations and the expanded 22-table/15-RPC authorization matrix are intentionally not applied or executed against hosted Supabase without an owner checkpoint. No deployment or hosted write was performed during the extended-runway build.
- Production launch is not ready. The New Mexico attorney-reviewed waiver text remains an external dependency, and hosted migration, expanded live authorization verification, advisor review, preview/production configuration, recovery checks, backup acceptance, and deployment remain open.

## Start here

- Project status and product rules: [`CLAUDE.md`](CLAUDE.md)
- Repository working agreement: [`AGENTS.md`](AGENTS.md)
- Database status, advisor dispositions, and runbook: [`supabase/README.md`](supabase/README.md)
- Frontend setup and backend modes: [`frontend/README.md`](frontend/README.md)
- Visual-system source of truth: [`CVLeagues_Design_Tokens.md`](CVLeagues_Design_Tokens.md)
- Extended-runway implementation record: [`docs/EXTENDED_RUNWAY_IMPLEMENTATION.md`](docs/EXTENDED_RUNWAY_IMPLEMENTATION.md)

## Verification

Run from the repository root:

```sh
cd frontend && CI=true npm test -- --watchAll=false
cd frontend && npm run build
./tests/pgtest/run_pgtest.sh
```

Never commit secrets or place a service-role/secret key in React. Hosted writes, Auth/admin changes, migration pushes, deployments, and destructive operations require explicit owner approval.
