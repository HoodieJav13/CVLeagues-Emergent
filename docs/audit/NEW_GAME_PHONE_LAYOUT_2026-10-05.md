# New Game, phone score entry, and admin Teams overflow — 2026-10-05

```text
Outcome:               blocked-environment (scope complete; E2E smoke not verifiable here — 7/28 unresolved)
Delivery depth:        committed (local only; NOT pushed; no PR, merge, deploy, or hosted action)
Protocol version:      v1.2 (DIAL: EXECUTE, owner prompt 2026-10-05; local commits approved)
Test baseline:         1caa74ba28678138bd38a6cbd407a2909a2e6327 (Dot's reviewed fix, restored from the bundle)
Code verified at:      194f0064c7639c8b50654bbb8ddeef45e8a2025e (this record's parent; docs-only after that)
Branch and upstream:   claude/amazing-sagan-dpy3b0 (NOT PUSHED)
Migrations/deps:       none
```

## Starting point

- **Previous tip:** `bc463fe18d4417c06659bab1e9a440a6943accc9`. All six earlier commits are preserved.
- **Dot's package:**
  - Archive SHA-256: `fe8109d3…d13410d`.
  - `SHA256SUMS`: every file OK.
  - Bundle `dc4d57b2…` passed `git bundle verify` (it requires `5dae3ec`).
  - Patch `d1a57a98…` passed `git apply --check` on `bc463fe` and produced the reviewed tree `dff39a57…`. This was checked in a scratch worktree only.
- **Restore route:** the bundle, fetched into `handoff/kickoff-roster-guards`. The branch was then fast-forwarded (`--ff-only`) to `1caa74b`, tree `dff39a57`. The fixes were not recreated.

## Commits (on top of `1caa74b`)

1. `8817221` fix(admin): keep the Teams tab inside a phone-width page
2. `e278c55` fix(score-entry): keep all regulation periods and both totals on a phone
3. `dfb0fc6` feat(admin): create regular-season games from Schedule/Games
4. `194f006` fix(admin): review follow-ups for New Game and the phone layouts
5. this record (docs only)

## What changed

### New Game

A dialog on Schedule/Games.

**Fields:**
- **League:** active, `kind=league` only. Each option shows its season and sport.
- **Away and home teams:** must be active, enrolled in the chosen league, and different. When both teams name a division, it must be the same one.
- **Kickoff:** entered in league time.
- **Venue:** active venues only.

**Write path:** existing `createEntity("games")`.
- **Payload:** a client UUID `id` plus the schedule-only columns: `league_id`, derived `sport`, both teams, `starts_at`, `venue_id`, `stage=regular`. All of these are in Migration 29's INSERT grant, and RLS still requires the AAL2 admin.
- **Database defaults:** status, scores, periods, lock and audit.
- **Mock mode:** games get the same defaults inside the mock action.

**Behaviour:**
- **Double-click:** saves once, because the guard stays latched after success.
- **Failed save:** keeps the form open for a retry. The retry reuses the same `id`, so it cannot create a second game.
- **Cancel:** writes nothing.

### Phone score entry

- **Phones (below md):** the period table regrids per team. The name and live Total sit on top, then 44 px inputs five to a row, and extra innings wrap.
- **One set of inputs:** IDs, labels and state are unchanged, and explicit ARIA roles keep the table semantics.
- **Desktop:** unchanged.

### Admin Teams

- **Identity grid:** gets an explicit `minmax(0,1fr)` track on phones. Before, the implicit `auto` track grew to the 38-character team name and widened the document to 485–497 px.
- **Identity names:** wrap on phones and keep single-line truncation at `sm` and above, with a `title`.
- **Action buttons:** no longer shrink.
- **Admin header:** wraps at 320 px.
- **Enrollment table:** still scrolls inside its own card. Nothing is clipped globally.

## Red → green evidence (raw logs in the preservation package)

| Item | Red (before fix) | Green |
|---|---|---|
| Admin Teams, browser (320/360/375/390/768/1280) | 4 phone widths fail, document 485–497 px; 768/1280 pass | 6/6 |
| Score entry, browser (same widths) | 4 phone widths fail, inning 4/5 right edge 369–421 px; 768/1280 pass | 6/6 |
| Score entry, Jest (roles, total hooks, labels) | 1 failed | 7/7 |
| New Game, Jest (lib, dialog, gameTime ambiguity, backend columns, mock defaults) | 4 suites failed | 45/45 |
| New Game, double-click finishing between clicks | 2 creates | 1 create |
| Review follow-ups (same `id` on retry, fresh `id` per open, unique error keys) | 4 failed | 37/37 |

## Final results at `194f006` (exit codes)

| Check | Result |
|---|---|
| Frontend Jest | **44 suites / 267 tests pass** (exit 0). Baseline at `1caa74b`: 43 / 243. |
| API | **28/28** (exit 0) |
| Production build | **compiled** (exit 0) |
| pgtest | **382/382 + ledger race PASS + practice fork race PASS** (exit 0) |
| Local DB rehearsal | **64/64** (exit 0), including `newgame 01–12` (see below) |
| Browser: original rehearsal journey | 1/1 (exit 0) |
| Browser: boundaries (Dot's revision) | 10/10 (exit 0) |
| Browser: score-entry layout | 6/6 (exit 0) |
| Browser: admin Teams layout | 6/6 (exit 0) |
| Browser: New Game fictional season | 1/1 (exit 0) |
| **E2E smoke** | **21 passed, 7 FAILED (exit 1). Unresolved, environment-attributed, not green.** Every failure is only the final console-clean assertion: `ERR_TOO_MANY_RETRIES` loading external fonts through this container's proxy. Earlier runs here failed 13 and then 10. Dot's package reports 28/28 on another machine; that is reported, not verified here. |

**The `newgame 01–12` database checks:**
- Refused: anon, an authenticated non-admin, and an admin at AAL1.
- Allowed: the AAL2 schedule-only insert, which then holds database defaults and writes no stats, participation or history.
- Refused: status/score columns, the same team on both sides, a team from another league, a mismatched sport, and a retry with the same `id`.

## New Game fictional season (mock mode; `new-game-season.spec.js`)

- **Seeded prerequisites only:** a season, a league, a venue, and three teams with one fictional player each.
- **Refused through the form, no write:** same team on both sides, a skipped 2:30 AM spring-forward time, and an ambiguous 1:30 AM fall-back time.
- **Created through the form:** four games, at 360 px and 1280 px, using double-clicks. Each produced exactly one game, and NG4's 7:45 PM kickoff is stored as `2027-04-28T01:45Z`.
- **Reload:** all four games persist and appear on the public schedule.
- **Scoring:** three games scored. At 360 px, all 10 inputs and both totals sit inside the viewport (max right edge 323 px) and none is covered.
- **Standings before:** Punters 2-0, Jacks 1-1, Cats 0-2.
- **Correction:** NG2 corrected from 4-6 to 6-4 with a reason. The game stays final and locked, and the audit row records before and after.
- **Standings after:** Punters 2-0, Cats 1-1, Jacks 0-2.
- **Admin Teams:** fits at 360 and 390 px.

## Decisions and flags for the owner

1. **Ambiguous fall-back kickoff (open policy).** New Game refuses 1:00–1:59 AM on the night clocks fall back and writes nothing. That is not an approved policy; it is the non-choosing option. Edit Game and Playoffs keep the reviewed behaviour, which resolves a newly typed ambiguous time to the **earlier** occurrence. Decide which occurrence counts, or whether to keep refusing.
2. **Cross-division games are refused** when both teams name different divisions. This follows the instruction to validate division. The database has no such rule, so interdivision play would need a different decision.
3. **`1caa74b` will show as Unverified on GitHub.** Its author email is `jav13chav32@gmail.com` and it is not signed. A stop hook asked for it to be amended or rebased and pushed. I declined, because that rewrites preserved commit IDs and pushing is not authorized. Decide at push time.

## Not tested / limits

- **Hosted:** no hosted, preview or production path was exercised, including the real AAL2 session creating a game through the UI.
- **Real devices:** none. All widths are emulated Chromium.
- **Dev-only chrome in layout specs:** CRA's error overlay and the agentation annotation toolbar are hidden. Both load only in development.
- **Smoke:** not green here (see above).
