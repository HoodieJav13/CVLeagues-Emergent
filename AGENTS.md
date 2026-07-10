# CVF Leagues — Repository Working Agreement

## Scope and source of truth

- Work one approved roadmap stage at a time. Satisfy its gate before proposing the next stage.
- When guidance conflicts, use this order: the owner's latest instruction, locked roadmap principles, verified code and tests, `CLAUDE.md`, the Notion roadmap, then older reports.
- Audit the repository and Git status before editing. Preserve unrelated changes and untracked files.

## Locked product and security rules

- Season 1 is admin-only. An Auth User is not a Player; `profiles.auth_user_id` remains nullable.
- Enable RLS on every exposed table and test anonymous, authenticated non-admin, and admin behavior. Data API grants and RLS are separate controls; verify both.
- Keep waivers and game edit history append-only.
- A locked game may be edited only after an explicit unlock reason is recorded.
- Production and preview must never silently fall back to mock or localStorage data.
- Never expose service-role or secret keys to the frontend. Use environment variables and let the owner enter secrets.
- Public profile reads must use an explicit safe-field allowlist and must not expose PII.
- Anonymous forms require abuse protection before public launch.

## Change discipline

- Use additive migrations for schema changes. Create migration files with `supabase migration new <name>` after confirming the installed CLI help.
- Never mutate hosted schema manually when a migration is appropriate.
- Never run a remote reset, repair migration history, restore data, or perform another destructive action without explicit owner approval.
- Keep functional, schema, documentation, and visual changes in separate focused commits.
- Do not commit, push, open a pull request, deploy, or write to a hosted service without the required owner checkpoint.
- Do not silently take over owner-only actions such as account creation, billing, secrets, MFA, legal approval, domains, or final launch acceptance.

## Required verification

Run commands from the repository root unless noted otherwise.

- Frontend tests: `cd frontend && CI=true npm test -- --watchAll=false`
- Production build: `cd frontend && npm run build`
- Complete database harness: `./tests/pgtest/run_pgtest.sh`
- Local Supabase migration application, once initialized: `supabase db reset`
- Before any hosted push: verify CLI help and version, run `supabase migration list`, then `supabase db push --dry-run`

For schema, Auth, RLS, or security work, also run the relevant negative authorization tests and Supabase Security/Performance Advisors. Local tests do not replace hosted API verification.

## Review gates

- Before implementation, provide the stage objective, findings, affected files/systems, proposed changes, tests, risks, rollback, owner actions, and decisions.
- Before committing, show the complete relevant diff, every test result, remaining risks, and confirmation that unrelated files were untouched. Stop for owner approval.
- Record verified milestones, evidence, decisions, blockers, completion date, and commit hash in the repository documentation and Notion roadmap when available.
