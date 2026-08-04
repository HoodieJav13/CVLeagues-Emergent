# Practice Mode — Design Options (Option B selected, reviewed, merged)

**Date:** 2026-07-29 · **Status:** MERGED — Option B, ratified on `main`
2026-08-03 after independent adversarial review. Hosted push remains a
separately approved gate; hosted is deliberately at twenty-nine migrations.

> **Ordering record (2026-08-03, preserved).** Two facts, recorded without
> asserting which authorized which, because the repository cannot establish it
> and the owner does not recall: Migration 30 and a practice rehearsal UI were
> committed on 2026-07-29 (`a9de3ab`, `10ad297`), and the written selection of
> Option B was committed on 2026-08-01 (`781aafd`). The 8/01 selection was
> authored against `origin/main` and stated practice mode was "unbuilt," which
> was already untrue of the branch; the branch's own copy of this file said "no
> implementing code," which was untrue there. The owner subsequently chose
> ratification over rebuild: the branch was independently reviewed (four
> defects found and fixed pre-merge, plus one caught by an external check —
> see `65cf141` and the merge-day commits), locally accepted at 382/382 with a
> two-connection fork race, and merged. The irregularity stands as recorded:
> implementation preceded any recoverable authorization, and review recovered
> the skipped control after the fact rather than legitimizing the ordering.
**Contract:** RULES_INVARIANT_MATRIX pilot row — "A full no-consequence
scoring rehearsal with events, retry, finalization preview, and correction.
Practice data is explicitly nonproduction, nonpublic, and excluded from
standings, career totals, brackets, and official game projections."

## Why this stopped for a decision

The signed-rushing-yardage half of this stage needed no schema change and is
done locally. Practice mode does need schema, and the audit of Migration 24
shows why the shape is an owner-level choice: **sessions are game-bound by
design** — `game_id NOT NULL`, composite keys `(id, game_id)` threaded through
participants and events, the one-active-session-per-game index, and the
correction chain's `(base_session_id, game_id)` anti-fork reference. Every
candidate practice shape amends one of those load-bearing invariants, and the
repository's own rule is that schema stages on the scorekeeping subsystem get
a reviewed plan before code.

## Option A — practice games in `public.games`

A `practice` stage or flag on real game rows; sessions bind normally.

- ✅ No session-schema change at all.
- ❌ **Public blast radius.** Every selector written as "not playoff/not
  tournament" silently counts practice games into standings, records,
  schedules, calendars, and feeds. The seed's own history shows how easily one
  filter is missed; a single miss publishes practice data — the exact failure
  the contract forbids.
- ❌ Practice rows live in the public `games` table forever or need deletion.

## Option B — sessions without games (recommended)

`session_kind` gains `'practice'`; `game_id` becomes nullable **only** for
practice (`CHECK ((session_kind = 'practice') = (game_id IS NULL))`). A
practice start RPC takes an explicit home/away team pair and snapshots
eligible participants through the existing code path. Practice events sequence
per session instead of per game. Finalization computes and **returns** the
projection (the "finalization preview") and writes nothing to `games`,
`player_stats`, or `game_edit_history`; practice corrections operate on the
same private tables.

- ✅ **Exclusion is structural, not filtered.** Practice data exists only in
  the four private tables, which already carry admin-only RLS, no anonymous
  grant, and no client write grant — "nonpublic" is inherited, not policed.
- ✅ Real game ledgers stay pristine: practice never consumes a game's
  sequence numbers, never blocks its one-active-session slot, never touches
  its projections.
- ✅ Retry/idempotency and validation run through the real RPCs — the
  rehearsal exercises the true server behavior the pilot row asks for.
- ❌ **Invasive within the subsystem:** the composite `(id, game_id)` FKs and
  per-game event sequencing must gain practice-aware parallels, and all ten
  runtime RPCs need practice guards. This is a proper migration sequence with
  its own negative matrix (practice can never write official projections;
  official paths can never accept a practice session), not a rider.

## Option C — frontend-only rehearsal

A practice toggle running the scorekeeper against an in-memory simulator.

- ✅ Cheapest; zero schema.
- ❌ Fails the recorded contract: retry safety and server validation are the
  point of the rehearsal, and "practice **data** is nonproduction" implies
  data exists. Local mock mode already provides this level of rehearsal in
  development; it does not serve the real admin at a hosted field.

## Recommendation

**Option B**, executed as its own bounded sequence (Migration 30) with a full
pgtest negative matrix and the standard hosted-push token gate afterward. The
local harness runs in this environment (340/340 + concurrency verified
2026-07-29, `LC_ALL=C` required), so local verification is available
immediately once the shape is approved.

## What the sequence would verify (sketch)

- Positive: practice start (team pair) → events (including signed rushing) →
  retry with same idempotency key → finalization preview returns a projection
  and writes nothing → practice correction drafts and finalizes, still
  writing nothing official.
- Negative: practice sessions rejected by every official writer (projection,
  finalization, edit history, bracket advancement); ordinary/correction
  sessions rejected with NULL games; practice never blocks a real game's
  session slot; anonymous/authenticated non-admin denied on all practice
  surfaces; a practice session can never be converted into an official one.
