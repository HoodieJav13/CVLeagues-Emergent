# CVF Leagues

CVF Leagues is a mobile-first React application and Supabase backend for adult recreational kickball and flag football leagues in Albuquerque, New Mexico.

The frontend currently supports an explicit local mock mode and contains an env-gated Supabase adapter. Eleven database migrations and a 96-assertion local PostgreSQL test harness are present. A dedicated hosted Supabase project exists, but the repository is not linked, the migrations have not been applied remotely, and a real local Supabase reset has not been completed. Production launch is not ready.

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
