# Durable populated-ledger pilot — scope and timing decision

**Date:** 2026-08-04 · **Status:** SPECIFIED, DEFERRED by owner decision.
**Trigger to run:** real Season 1 teams and rosters exist on the hosted project.

## The gate

Every hosted acceptance so far has exercised the four private ledger tables
**while they were empty**. That proves the negative direction well — no
anonymous, non-admin, or AAL1 caller can read or write them — but "you cannot
read this empty table" is a weaker claim than "you cannot read this table with
real rows in it." The open gate is the positive direction: *with real rows
present, the administrator can read them and no one else can, and authorized
writes behave.*

It stayed open because every other hosted test cleans up after itself and
these tables cannot be cleaned up through any application path. Proving it
means deliberately leaving rows behind, which is why it needs owner approval.

## Findings that shaped the decision (2026-08-04)

**1. Append-only is permanent to the application, not to the owner.** The
guard is an ordinary trigger (`cvf_reject_scorekeeping_evidence_rewrite`) on
`BEFORE UPDATE OR DELETE`, and the tables are owned by `postgres`. No RPC, API
call, authenticated admin session, or compromised client can ever delete a
row. The owner, in the dashboard SQL editor, can `DISABLE TRIGGER`, delete,
and re-enable. The control is deliberately awkward rather than absolute: it
makes rewriting score history impossible through normal use and conspicuous
when done on purpose. Earlier wording in this repository that implied "not
even the owner" was an overstatement and is corrected here.

**2. Practice mode removes most of the pilot's cost.** A practice session
writes to the same four tables under the same admin-only policies — Migration
30's readback confirms those policies carry no `game_id` predicate, so
NULL-game rows are covered identically. But practice references no game, so
none of the three permanences of an official-game pilot apply: no ledger rows
bound to a game, no one-way `scorekeeping_mode` conversion, and no game made
undeletable by `on delete restrict`. A practice pilot therefore closes the
gate's stated requirement with structurally inert rows.

**3. But a practice session PINS the teams and players it touches.** All of
these are `on delete restrict`: `scorekeeping_sessions.home_team_id` and
`away_team_id` → `teams`; `scorekeeping_participants.source_team_player_id` →
`team_players`; `.profile_id` → `profiles`; `.team_id` → `teams`. Because the
participant rows are themselves append-only, the roster rows they reference
cannot be deleted either.

**4. Hosted is an empty scaffold.** Baseline captured 2026-08-04: 1 admin,
1 league, 2 seasons, 1 profile, 1 team identity, 1 team, 1 roster row,
0 venues, 0 games, and 0 rows in all four ledger tables.

Practice requires two distinct teams sharing a sport and league season.
Running the pilot today therefore means inventing a second team plus profiles
and roster rows — and by finding 3, welding those fixtures permanently into
the production database. That is real long-term residue, and it is the reason
the pilot is deferred rather than run.

## Decision

**Defer until real Season 1 teams and rosters exist hosted.** At that point
the pilot costs nothing: the rehearsal uses two real teams, which is what
practice mode exists for, and every row it pins is data that was wanted
anyway. The evidence is also strictly better — real rosters instead of
fixtures. Nothing else is blocked by this gate in the meantime.

## Procedure when it runs

1. Confirm two real teams exist in one league and season with eligible roster
   rows, and capture a pre-run count of all four ledger tables plus `games`,
   `player_stats`, and `game_edit_history`.
2. Run a full rehearsal through the real admin UI against hosted — not
   synthetic calls — so the pilot exercises the actual administrator journey:
   start → several events → finalize (projection preview) → a correction
   session with a void and replacement → finalize again.
3. Verify positively: the administrator can read the resulting rows in all
   four tables.
4. Verify negatively with the anonymous key and an authenticated non-admin
   session: neither can read any of them. This is the half that has never been
   proven against populated tables and is the point of the exercise.
5. Verify the zero-official-write boundary against real hosted data: `games`,
   `player_stats`, and `game_edit_history` counts are unchanged from step 1,
   and every practice row has `game_id IS NULL`.
6. Record dated evidence beside the hosted-auth matrix files, including the
   pre/post counts and the session identifiers left behind.

## What this pilot does NOT prove

Practice deliberately publishes nothing, so it cannot demonstrate that a
finished game's projection reaches `games` and `player_stats` and appears
publicly. That remains a separate, later, and genuinely expensive gate: it
requires converting a real game to ledger mode, which is one-way and makes
that game permanently undeletable. Do not fold the two together.
