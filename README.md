# CVF Leagues

CVF Leagues is a mobile-first React application and Supabase backend for adult recreational kickball and flag football leagues in Albuquerque, New Mexico.

The frontend currently supports an explicit local mock mode and contains an env-gated Supabase adapter. Ten database migrations and a local PostgreSQL test harness are present, but the repository has not yet completed a real local Supabase reset or connected to a hosted project. Production launch is not ready.

## Start here

- Project and product guidance: [`CLAUDE.md`](CLAUDE.md)
- Operational rules: [`AGENTS.md`](AGENTS.md)
- Database status and runbook: [`supabase/README.md`](supabase/README.md)
- Frontend setup: [`frontend/README.md`](frontend/README.md)

## Verification

```sh
cd frontend && CI=true npm test -- --watchAll=false
cd frontend && npm run build
./tests/pgtest/run_pgtest.sh
```

Do not place secrets in the repository. Do not push migrations, create Auth/admin identities, deploy, or change hosted infrastructure without owner approval.
