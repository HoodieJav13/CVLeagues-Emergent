# Season 1 rehearsal

One reusable, wholly fictional season (`fixture.cjs`) carried through the app
twice — once through the real UI in local mock mode, once through the real RPCs
of all 30 migrations on a disposable local Postgres. Nothing here touches a
hosted project, and no fixture value may ever be entered into one.

Report and findings: [`docs/audit/SEASON1_REHEARSAL_2026-10-05.md`](../../docs/audit/SEASON1_REHEARSAL_2026-10-05.md).

## What it covers

| File | Proof | Surface |
|---|---|---|
| `rehearsal.spec.js` | mock mode, real UI | season/leagues/venue setup → public Team Interest + Free Agent intake → approval → direct teams → 17 players + rosters → free-agent assignment → eligibility → schedule edit/postpone → aggregate scores (HARD tie block, SOFT override) → mark final → reasoned correction → public standings/teams/profiles/leaderboards → reload |
| `boundaries.spec.js` | mock mode, real UI | demo-role gating, PII on public pages, duplicate approve/assign, double-click save, HARD-invalid save, correction propagation, malformed-store recovery, practice mode |
| `ux-capture.spec.js` | mock mode, real UI | captures + mechanical a11y scan at 375 / 768 / 1280 |
| `rehearsal_db.cjs` + `run_rehearsal_db.sh` | disposable local Postgres | the same season through anon / service_role / non-admin / AAL1 / AAL2 identities, RPC duplicate guards, server validation, correction audit, and one official event-ledger game (start → replay → finalize → ledger correction) |

Mock mode cannot run official ledger scoring (it is backend-only by design), so
the ledger leg exists only in the database proof. The admin UI has no "create
game" control, so `rehearsal.spec.js` writes the schedule into mock storage
(finding F1 in the report); every other step goes through visible controls.

## Running

Browser legs need the mock-mode dev server (no `REACT_APP_SUPABASE_*` set) and
reuse the `tests/e2e-smoke` Playwright install — no new dependencies:

```sh
cd frontend && BROWSER=none npm start          # leave running on :3000
cd tests/e2e-smoke && npm ci                   # once
cd tests/season-rehearsal
export NODE_PATH=../e2e-smoke/node_modules REHEARSAL_ARTIFACTS=/tmp/rehearsal
../e2e-smoke/node_modules/.bin/playwright test -c playwright.config.js rehearsal.spec.js    # ~2 min, writes final-state.json
REHEARSAL_STATE=/tmp/rehearsal/final-state.json \
  ../e2e-smoke/node_modules/.bin/playwright test -c playwright.config.js boundaries.spec.js ux-capture.spec.js
```

`boundaries` and `ux-capture` seed the browser from the rehearsal's
`final-state.json`, so run `rehearsal.spec.js` first.

Database leg (same prerequisites as `tests/pgtest/run_pgtest.sh`: PostgreSQL 16
binaries on `PATH`, run as a non-root user):

```sh
./tests/season-rehearsal/run_rehearsal_db.sh    # exits non-zero unless every check passes
```
