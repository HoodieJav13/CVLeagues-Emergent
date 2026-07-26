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
- For a game that has entered event-ledger scoring, ledger events are the only correction authority. Score/stat projections and `game_edit_history` are system outputs, not parallel writable correction inputs; ledger mode never falls back to aggregate editing.
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
- A broad instruction such as “execute sequences X–Y” authorizes the approved local sequence work only; it never pre-authorizes a hosted mutation contained within those sequences. Stop immediately before every hosted mutation and obtain a discrete owner approval naming that action and target.
- Do not silently take over owner-only actions such as account creation, billing, secrets, MFA, legal approval, domains, or final launch acceptance.

## Required verification

Run commands from the repository root unless noted otherwise.

- Frontend tests: `cd frontend && CI=true npm test -- --watchAll=false`
- Production build: `cd frontend && npm run build`
- Complete database harness: `./tests/pgtest/run_pgtest.sh`

Environment notes for a fresh checkout:

- `npm install` needs `--legacy-peer-deps`. `react-day-picker@8.10.1` peers `date-fns@^2||^3` while the project pins `4.1.0`. This is pre-existing debt scheduled for the deferred-debt sweep; do not "fix" it by changing either version mid-stage.
- The harness needs PostgreSQL **server** binaries, not just `psql`, and `initdb` refuses to run as root. Where the server lives off `PATH` and the shell is root, run it as the postgres user with a writable `TMPDIR`, for example:
  `su postgres -s /bin/bash -c 'export PATH=/usr/lib/postgresql/16/bin:$PATH TMPDIR=/tmp/cvf-pg; ./tests/pgtest/run_pgtest.sh'`
- `npm run build` intentionally fails without `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, and `REACT_APP_TURNSTILE_SITE_KEY`. That is the fail-closed rule working. Never supply placeholder values to get past it; to check that the bundle merely compiles, run `npx craco build`, which skips the prebuild validator.
- Local Supabase migration application, once initialized: `supabase db reset`
- Before any hosted push: verify CLI help and version, run `supabase migration list`, then `supabase db push --dry-run`

For schema, Auth, RLS, or security work, also run the relevant negative authorization tests and Supabase Security/Performance Advisors. Local tests do not replace hosted API verification.

## Review gates

- Before implementation, provide the stage objective, findings, affected files/systems, proposed changes, tests, risks, rollback, owner actions, and decisions.
- Before committing, show the complete relevant diff, every test result, remaining risks, and confirmation that unrelated files were untouched. Stop for owner approval.
- Record verified milestones, evidence, decisions, blockers, completion date, and commit hash in the repository documentation and Notion roadmap when available.

## Visual-pass calibration

- Before any visual audit or implementation pass, read [`docs/direction/CVLeagues_Art_Direction_Contract.md`](docs/direction/CVLeagues_Art_Direction_Contract.md) in full. All addenda are binding, including Addendum 4's badge-outline revision, copper rank-three token, tie convention, and OT7 Leaderboards/stats anchor.
- Genuine visual-direction choices require both a compliant treatment and a deliberately bolder contract-compliant variant. A motif or accent must be obvious in a cold still screenshot; ambiguity must not silently resolve toward the least visible option.
- Use Apple Sports as the Home/Schedule reference anchor, “World Cup 2026, simplified” by sheets.works as the Standings/Playoffs anchor, and OT7 as the Leaderboards/stats anchor.
- Visual findings use four verdicts: **BLOCKING / NON-BLOCKING / VISUALLY INSUFFICIENT / ALREADY FINE**. VISUALLY INSUFFICIENT catches work that is correct but still reads as a competent template against the reference anchors; include capture evidence and a proposed direction.
- Styling, motion, and identity proposals must state their concrete visual delta and implementation cost. Flag high-cost, marginal-delta work for owner reconsideration rather than shipping it as complete.

## Reporting Discipline — Risk-Calibrated Detail

Not everything warrants the same depth of report. Before writing up a finding,
triage it first:

- HIGH STAKES (full detail: diff, reasoning, explicit call-out) — anything
  touching auth/authorization/RLS/privilege boundaries, money, PII/data
  exposure, irreversible or hosted actions, or the first instance of a new
  architectural pattern.
- LOW STAKES (one-line verdict, no extended narrative) — a repeated instance
  of an already-established pattern (e.g., the third time the same class of
  fix is applied), a finding you've already self-classified as non-blocking,
  UI/display-only changes with passing tests, or routine test/build status.

Lead every finding with a one-line verdict: BLOCKING / NON-BLOCKING (noted) /
VISUALLY INSUFFICIENT / ALREADY FINE. Reserve full paragraphs of reasoning for
BLOCKING items, VISUALLY INSUFFICIENT findings that need a proposed direction,
and genuinely novel judgment calls. Don't re-explain why an established
pattern is correct each time it recurs — just confirm it was applied
consistently. Don't write extended risk narrative for something you've already
determined doesn't need owner action.

This isn't a license to skip verification — run the same checks. It's a
constraint on how much prose accompanies a finding that doesn't need a
decision from the owner.
