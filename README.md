# CVF Leagues

CVF Leagues is a mobile-first React application and Supabase backend for adult recreational kickball and flag football leagues in Albuquerque, New Mexico.

## Current state — July 21, 2026

- The extended-runway backend is implemented and hosted-verified. It adds MFA-gated administration and protected intake, per-sport current seasons, tournament-safe stat scopes, fixed single-elimination brackets, admin-only payments and Hall of Fame workflows, and persistent team identities with explicit season/sport enrollment.
- Twenty-four additive migrations apply cleanly from scratch in both the isolated PostgreSQL harness and the real local Supabase stack. The complete database harness passes 277/277 assertions. Migration 24 establishes the private Event Ledger Lite schema and one-way aggregate/ledger authority boundary; it intentionally adds no client mutation RPC or public live-score surface.
- The dedicated hosted Supabase project has all 23 migrations accepted. The least-privilege `service_role` catalog check passes, both hosted advisors have recorded dispositions, and the revised real-session authorization matrix passes 154/154 across 22 tables and 15 administrator RPCs with exact fixture cleanup and restoration of the current Season 1 operational baseline.
- Migration 24 is committed locally in `1b31693` but remains unhosted pending a separately gated 26-table authorization matrix, fresh backup, preflight, dry run, and discrete push approval.
- Production launch is not ready. The New Mexico attorney-reviewed waiver text remains an external dependency regardless of every other gate, and recovery/session-revocation checks, preview/production configuration, live hosted-flow acceptance, backup acceptance, and deployment remain open.

## Documentation authority

| Document | Authority |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Repository working rules and review gates |
| [`CLAUDE.md`](CLAUDE.md) | Current product status, locked decisions, roadmap, and owner action queue |
| [`supabase/README.md`](supabase/README.md) | Schema, migration ledger, backend invariants, and hosted verification state |
| [`supabase/HOSTED_AUTH_RUNBOOK.md`](supabase/HOSTED_AUTH_RUNBOOK.md) | Repeatable hosted authorization procedure |
| [`supabase/evidence/`](supabase/evidence/) | Immutable dated records of completed verification runs |
| [`docs/EXTENDED_RUNWAY_IMPLEMENTATION.md`](docs/EXTENDED_RUNWAY_IMPLEMENTATION.md) | Historical extended-runway implementation and decision record |
| Notion | Planning mirror and historical decision context; repository facts above take precedence |
| This README | Stable project introduction and navigation only |

Additional references: [`frontend/README.md`](frontend/README.md) documents frontend setup and backend modes; [`CVLeagues_Design_Tokens.md`](CVLeagues_Design_Tokens.md) is the visual-system source of truth.

## Verification

Run from the repository root:

```sh
cd frontend && CI=true npm test -- --watchAll=false
cd frontend && npm run build
./tests/pgtest/run_pgtest.sh
```

Never commit secrets or place a service-role/secret key in React. Hosted writes, Auth/admin changes, migration pushes, deployments, and destructive operations require explicit owner approval.
