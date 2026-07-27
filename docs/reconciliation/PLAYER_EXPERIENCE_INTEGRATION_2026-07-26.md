# Player-Experience Branch Integration (R2) — 2026-07-26

**Status:** OWNER-APPROVED, staged. R2-A and R2-B complete. R2-C and R2-D not authorized.

Records the staged reconciliation of `claude/sports-league-improvements-esu4eb`
into `main`, the migration renumbering and the evidence that it is safe, the
owner decisions taken during the stage, and the findings carried forward.

## Why this exists

The player-experience branch forked from `fa737b2` — the accepted Sequence 4
baseline — and was never merged. Meanwhile `main` advanced eight commits to
`cbfdcc6`, adding Sequence 5A, the Protocol v1.2 contract, and the named
hosted-migration approval token. Both lines added a local-only migration, and
six files were touched by both. Integrating in one merge would have bundled a
destructive schema conversion, a calendar API, derived statistics, profile
work, and venue administration into a single unreviewable delivery, so the
work was split into four bounded stages, each separately approved.

## Migration renumbering — and why it is safe

The venues migration was authored as "Migration 28" because, on its own branch,
it was the 28th. After integration it is the **29th**: Sequence 5A's
`20260723154411_sequence_5a_overtime_pairing_rules.sql` is the 28th.

**No file rename was required, and none was performed.** Each of the following
was directly verified rather than assumed:

1. **Filename order already sequences them correctly.** `20260723154411`
   (Sequence 5A) sorts before `20260726120000` (venues). Supabase applies
   migrations in filename order, so the combined stack needs no intervention.
2. **The two migrations do not touch the same objects.** Sequence 5A alters
   `scorekeeping_events` and the ledger RPCs. Migration 29 alters `games`, adds
   `venues` and `game_participation`, and replaces `schedule_playoff_match`.
   There is no overlap.
3. **Sequence 5A adds no column to `games`.** Its only new column is
   `scorekeeping_events.pairing_override_reason`. Migration 29 reissues the
   `games` column allowlist after dropping `date`/`time`/`location`, and that
   reissue therefore cannot drop a Sequence 5A column — there is none to drop.
4. **Sequence 5A adds no table and no net new RPC.** It drops and recreates
   `append_scorekeeping_event` and `replace_scorekeeping_event` with an
   additive defaulted parameter, and replaces `finalize_scorekeeping_session`
   and `finalize_scorekeeping_correction` at identical signatures. Table count
   is unchanged at 26; Migration 29 brings it to 28. RPC count is unchanged at
   25; Migration 29 brings it to 26.
5. **No migration before 29 references the dropped columns except the two it
   already handles** — `schedule_playoff_match` (Migration 15) and the
   Migration 23 grant. Both are rewritten by Migration 29 itself. Migrations
   24–28 never reference `games.date`, `games.time`, or `games.location`.
6. **The combined stack applies cleanly and passes.** A clean replay of all
   twenty-nine migrations followed by the full harness gives 338/338 plus the
   two-connection idempotency race.

**Live documentation and code comments were corrected to say 29.** Historical
commit messages, `supabase/evidence/*`, and `docs/audit/*` were deliberately
left alone: "Migration 28" was accurate within those snapshots, and rewriting
immutable evidence to match a later reality would destroy the record. Twenty
harness assertion labels were renamed `migration28 NN` → `migration29 NN`
because they are live test output, not historical evidence.

## Assertion count

Neither branch's count was the combined total: `main` measured 318 without the
cutover, the feature branch measured 314 without Sequence 5A. The combined
stack measures **338** (318 + 20 Migration-29 assertions).

`tests/pgtest/assertions.sql` required re-application, not a textual merge.
Git merges it **cleanly and silently into a broken file**: `main` added a
Sequence 5A fixture inserting a game with `date`, `time`, and `location` at a
location the feature branch never touched, so both sides survive the merge and
the harness then fails on columns that no longer exist against a table where
`starts_at` and `venue_id` are `NOT NULL`. This was confirmed by trial merge
before any integration work began, and independently confirmed by the owner.
The four affected fixtures were re-authored onto the new shape with four new
venue rows preserving their original distinct field names.

## Owner decisions taken during R2

1. **The nine-stage "player-experience program" is NOT adopted as the active
   roadmap.** It is recorded as a proposal. It was agreed conversationally in
   the session that produced the feature branch, but that session had not read
   `PROJECT_POLICY.md` and wrote the program into `CLAUDE.md` as governance,
   which was overreach. The repository continues to work one bounded,
   owner-approved stage at a time. The proposed order was: media/identity
   (Migration 30), captain accounts, RSVP/availability, Pass 4 Team/Profile and
   shareable stat card, deferred-debt sweep, then ledger pilot and deployment.
2. **Captain accounts plus optional tokenized player links** are recorded as an
   **approved direction, not a locked product decision**, under a distinct
   `CLAUDE.md` heading. The direction was explicitly approved, but it has no
   implementing code and it would amend the locked "Admin-only for Season 1"
   rule, so "Locked" would overstate it.
3. **Two decisions were ratified by approving R2-B**, because accepting the
   migration accepts them: `games.starts_at` as the single authoritative
   timestamp, and participation as permanently outside the score lifecycle.

## Defects found and fixed during R2-A

Both were surfaced by moving the full-statistics block from the Private tab to
the Public tab, and both were caught by the staged review gate before commit.

- **Career rate statistics were meaningless, not merely wrong.** An imported
  career baseline and the granular game rows are different domains, and the
  import contract does not require a baseline to carry every column. Seed `p1`
  draws 53 of 60 career hits from a baseline recording no kicks, publishing a
  career kick average of 6.000. A qualifier threshold does not fix this: career
  kicks is exactly 10 against a `kicks >= 10` minimum, so `meetsQualifier`
  returns true and the impossible figure renders anyway. Fixed by declining any
  non-count derived stat in the career column when a baseline contributed. The
  season column is entirely granular and keeps its rates.
- **`text-secondary` resolves to `colors.secondary.DEFAULT`**, a background
  slate, not the `--text-secondary` text token exposed as
  `text-muted-foreground`. It rendered new rank context near-black on dark. The
  game-log opponent already carried the same misuse and was previously
  admin-only; this stage made it public.

## Carried forward — not implemented here

| Item | Target stage |
|---|---|
| Authorization matrix must cover **four** changed RPC signatures, not the one the runbook names | R2-C |
| Participation must be proven writable on a **ledger-finalized** game, not only a locked aggregate one (`INV-30`/`INV-35`/`INV-39`) | R2-C |
| `/api/calendar` is unauthenticated and un-rate-limited; caching is not abuse protection, and `AGENTS.md` requires abuse protection on anonymous surfaces before public launch | decide before R2-D |
| Engine-level domain consistency: a derived stat should be unknowable when its inputs span domains, rather than the display layer knowing about baselines. Either teach `playerCareerStats` to report baseline contribution, or require baselines to carry every input their sport's ratios need | R2-B follow-up, unscheduled |
| `meetsQualifier` is exported, tested, and never called. It is a leaderboard eligibility control and belongs on the leaderboard surfaces | stage that touches `Leaderboards.js` |
| Standings `LAST 5` form chips logged VISUALLY INSUFFICIENT against Anchor B | Pass 4 Team/Profile batch |
| Migration 29 requires a venue before a game can be created, and the admin UI to create one arrives in R2-C | keep R2-B and R2-C close together |

## Hosted state

**Unchanged. Hosted remains at Migration 27.** No hosted mutation, publication,
deployment, or matrix run occurred during R2. The intended future order, which
this record does **not** authorize: verify combined locally → publish and
accept Migration 28 → fresh off-platform logical export → publish Migration 29
→ run the expanded 28-table / 26-RPC matrix. Each step needs its own owner
approval, and a hosted migration push additionally requires the literal token
`approved: hosted push of migrations X–Y`.
