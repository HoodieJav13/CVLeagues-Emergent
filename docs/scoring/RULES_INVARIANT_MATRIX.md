# CVF Leagues Sport Rules and Invariant Matrix

**Status:** Binding specification for scorekeeping Sequences 2–6

**Owner-confirmed:** July 19, 2026

**Correction authority decision:** **DECIDED — July 19, 2026**

This document defines the rules that later scoring RPCs, ledger events,
projections, authorization tests, and pilot acceptance checks must implement.
Every implementation rule and test must cite at least one invariant ID from
this matrix. If code and this document disagree, implementation stops until
the owner resolves the discrepancy.

## A. Sport rules

### Shared scorekeeping conventions

| Rule | Binding decision |
|---|---|
| Numeric representation | Scores, period values, event point values, and count statistics are integers. Passing, rushing, and receiving yards are signed integers because a valid play can lose yards. |
| Period projection | A game's team total equals the sum of all regulation and overtime period projections. Every scoring event belongs to exactly one period. |
| Player attribution | Player-attributed events may reference only the immutable participant snapshot captured when the scoring session begins. Team-only events must explicitly omit the player rather than use a placeholder profile. |
| Forfeit | A forfeit is represented as a canceled game with an explicit winning team and losing team. It contributes one win and one loss, but no numeric score, points-for/against, periods, or player statistics. |
| Mercy rule | Neither sport has a mercy rule at this time. An administrator may not silently infer one. A future mercy rule requires a versioned rule change. |
| Post-final correction | Aggregate-mode games use reasoned atomic `correct_final_score` while remaining final/locked. Ledger-mode corrections use void/replacement events. The two mechanisms never govern the same game. |

### Kickball

#### Game and scoring rules

| Topic | Binding decision | Reconciliation |
|---|---|---|
| Regulation | The regulation inning count is variable and must be selected from the applicable league/game rules before scoring begins. It is not hardcoded to five. The selected count is snapshotted onto the scoring session and cannot change after the first event. | Every regulation scoring event references an inning from `1..regulation_innings`. |
| Extra innings and ties | Extra innings are appended one complete inning at a time. Playoff games must continue until there is a winner. A non-playoff competition may retain a tie only when its snapshotted competition rules explicitly allow ties; otherwise extra innings continue until a winner exists. | A final playoff projection may not be tied. |
| Run | A runner legally scores: +1 to the team score and `runs + 1` for that runner. | The sum of player `runs` for a team equals that team's projected score. |
| RBI | An RBI is attached to a scoring run only when the kick/play earns conventional RBI credit. Runs caused by an error or another non-RBI play may have no RBI. | Team RBIs may be lower than team runs; an RBI never creates score independently. |
| Home run | A home-run kick increments the kicker's `homeRuns`; the kicker receives a run, and the kicker receives one RBI for each RBI-eligible run produced by the play, including the kicker's own run. | All resulting runs are projected as individual run events and therefore reconcile to score. |
| Mercy | None. | No automatic early-final rule exists. |
| Forfeit | Shared forfeit convention above. | Win/loss only; no score or player stats. |

#### Kickball stat dictionary

All kickball stats are nonnegative integer counts.

| `statsConfig` key | Producing event or event attribute | Score relationship |
|---|---|---|
| `kicks` | A recorded kick attempt/result, including a fair result or strikeout; a walk alone does not increment it. | Independent tally. |
| `singles` | Kick result classified as a single. | Independent; any resulting runs are separate run events. |
| `doubles` | Kick result classified as a double. | Independent; any resulting runs are separate run events. |
| `triples` | Kick result classified as a triple. | Independent; any resulting runs are separate run events. |
| `homeRuns` | Kick result classified as a home run. | Creates the run/RBI events described above; the HR count itself is not added to score. |
| `rbis` | RBI attribution attached to an RBI-eligible run event. | Does not independently add points; team RBIs cannot exceed team runs. |
| `runs` | A player-attributed run-scored event. | Team sum must equal the projected team score. |
| `walks` | Walk event credited to the kicker. | Independent tally. |
| `strikeouts` | Strikeout event charged to the kicker. | Independent tally. |
| `outs` | Defensive out-credit event. Multiple outs require distinct out credits. | Independent tally. |
| `assists` | Defensive assist-credit event associated with an out. | Independent tally. |
| `errors` | Defensive error event charged to a player. | Independent; may explain a run with no RBI. |

### Flag football

#### Game and scoring rules

| Topic | Binding decision | Reconciliation |
|---|---|---|
| Regulation | Four quarters. Operational clock length may be configured separately, but the scoring projection always has four regulation periods. | Regulation scoring events reference `Q1`–`Q4`. |
| Touchdown | +6 team points. Every touchdown has exactly one scorer. A passing TD also credits exactly one passer and exactly one receiver; a rushing TD credits the rusher; a pick-six credits the intercepting defender. | `tds` identifies scorers and excludes passing credit. `passTDs` is never added to score a second time. |
| Conversion | +1, +2, or +3 team points according to the recorded attempt. Only the player who scores the conversion receives `onePoint`, `twoPoint`, or `threePoint`; no separate passing-conversion statistic is kept. | Conversion event value and the scorer's conversion key must agree. |
| Safety | +2 team points and attribution to the player who caused the safety. Sequence 2 adds the `safeties` player count; the later ledger must preserve the same team and player attribution. | Safety points reconcile from player `safeties` in aggregate mode and effective safety events in ledger mode. |
| Interception | A thrown interception credits `ints + 1` to the passer and `defInts + 1` to the intercepting defender. If returned for a touchdown, that same play also produces a +6 pick-six scoring event and `tds + 1` for the defender. | Team `ints` equals opponent team `defInts`; the interception itself is not points. |
| Overtime | No final tie is allowed. CVF uses college-style alternating possessions: each team receives one possession in an overtime round from the configured overtime start spot; after the first round, a touchdown requires a two-point attempt; beginning with the third round, teams alternate conversion attempts rather than full possessions. Rounds continue until both teams have had the required opportunity and the score is unequal. | Each round is a distinct `OTn` period. A game cannot finalize midway through an equal-opportunity round unless a defensive score ends the contest under the possession rule. |
| Mercy | None. | No automatic early-final rule exists. |
| Forfeit | Shared forfeit convention above. | Win/loss only; no score or player stats. |

The overtime start spot is a versioned competition setting because CVF field
dimensions may differ from NCAA fields. Changing it never changes the
alternating-possession or no-tie rules above.

#### Flag-football stat dictionary

Count statistics are nonnegative integers. `passYards`, `rushYards`, and
`recYards` are signed integers; all other keys are nonnegative.

| `statsConfig` key | Producing event or event attribute | Score relationship |
|---|---|---|
| `completions` | Completed forward-pass event credited to its passer. | Team total equals team `catches`. |
| `attempts` | Forward-pass attempt, complete or incomplete, credited to its passer. | Independent; completions cannot exceed attempts. |
| `passYards` | Signed yards on completed forward-pass events, credited to the passer. | Team total equals team `recYards`. |
| `passTDs` | Passing-touchdown event credited to the passer. | Team total equals team `recTDs`; excluded from score arithmetic to avoid double-counting. |
| `ints` | Interception-thrown event charged to the passer. | Team total equals opponent `defInts`. |
| `carries` | Rushing-attempt event credited to the ball carrier. | Independent tally. |
| `rushYards` | Signed yards on rushing-attempt events. | Independent tally. |
| `rushTDs` | Rushing-touchdown event credited to the rusher. | Also increments that scorer's `tds`. |
| `rushFirstDowns` | First-down flag on a rushing event. | Independent tally; cannot exceed carries. |
| `catches` | Completed-pass reception credited to the receiver. | Team total equals team `completions`. |
| `recYards` | Signed yards on completed-pass receptions. | Team total equals team `passYards`. |
| `recTDs` | Receiving-touchdown event credited to the receiver. | Also increments that scorer's `tds`; team total equals team `passTDs`. |
| `recFirstDowns` | First-down flag on a reception event. | Independent tally; cannot exceed catches. |
| `flagPulls` | Defensive flag-pull event credited to a defender. | Independent tally. |
| `sacks` | Sack event credited to a defender. | Independent tally. |
| `defInts` | Defensive interception event credited to the interceptor. | Team total equals opponent `ints`; a pick-six also increments `tds`. |
| `safeties` | Safety event credited to the responsible defender. | Team score contribution is `2 * sum(safeties)`. |
| `tds` | Any touchdown scored by this player: receiving, rushing, or defensive. It explicitly excludes a passer's passing credit. | Team score contribution is `6 * sum(tds)`. |
| `onePoint` | Successful one-point conversion scored by this player. | Team score contribution is `1 * sum(onePoint)`. |
| `twoPoint` | Successful two-point conversion scored by this player. | Team score contribution is `2 * sum(twoPoint)`. |
| `threePoint` | Successful three-point conversion scored by this player. | Team score contribution is `3 * sum(threePoint)`. |

For a flag-football team, the score must reconcile to:

`6 × tds + onePoint + 2 × twoPoint + 3 × threePoint + 2 × safeties`

The formula uses scorer touchdowns, not `passTDs`, because a passing
touchdown deliberately creates both passer and receiver credit.

## B. Numbered invariants

### Score, rules, and attribution

| ID | Falsifiable invariant |
|---|---|
| `INV-01` | For each team, the projected final score equals the sum of its regulation and overtime period projections. |
| `INV-02` | Every scoring event has an allowed sport-specific type and point value, belongs to exactly one period, and contributes to exactly one team's period total. |
| `INV-03` | Scores, period points, event sequence numbers, event point values, and count statistics are integers. Counts are nonnegative; only `passYards`, `rushYards`, and `recYards` may be negative. |
| `INV-04` | No client can directly insert, update, or delete authoritative score, stat, event, session, or edit-history values. All sanctioned mutations pass through an allowlisted AAL2 RPC. |
| `INV-05` | Kickball team score equals team `runs`; RBIs do not create score and team RBIs cannot exceed team runs. |
| `INV-06` | Flag-football scoring reconciles to the formula in Section A, with passing credit excluded from duplicate point calculation. |
| `INV-07` | Team flag-football totals reconcile as `completions = catches`, `passYards = recYards`, `passTDs = recTDs`, and one team's `ints = opponent defInts`. |
| `INV-08` | In Season 1, every final kickball and flag-football game has a winner. A tied kickball game continues into extra innings; a tied flag-football game continues under its overtime rules. Playoff finals also cannot tie. |
| `INV-09` | A forfeit has lifecycle status `canceled`, explicit winner and loser teams, and a final locked outcome; it contributes W/L only and has null score, empty periods, and no player-stat projection. |
| `INV-10` | The applicable rule version, regulation-period count, overtime start setting, sport, league, season, stage, and team participants are snapshotted before the first ledger event and cannot change afterward. |
| `INV-11` | A scoring session snapshots the eligible participants for both teams when it opens. Every player-attributed event references exactly one snapshotted participant on the event's credited team. |
| `INV-12` | Later mutable-roster changes cannot add, remove, or rewrite a scoring session's participant snapshot. An unsnapshotted player receives no event or projected statistic for that session. |
| `INV-13` | A safety preserves both the scoring team and responsible-player attribution in the authoritative ledger even if the current public stat projection does not display a safety category. |

### Event sequence and sessions

| ID | Falsifiable invariant |
|---|---|
| `INV-14` | The server assigns event sequence numbers. Effective and voided ledger rows form one gapless sequence `1..N` per game; clients cannot select or reuse a sequence. |
| `INV-15` | An idempotency key is unique within a game. Retrying the same command with the same key returns the original result and creates no additional event, history row, or projection change. |
| `INV-16` | A void event references one existing event in the same game that is not already voided and is not itself a void. |
| `INV-17` | A replacement identifies one voided original and forms a single linear correction chain. Two replacements cannot claim the same predecessor, and chains cannot fork or cross games. |
| `INV-18` | At most one active ordinary scoring session exists per game and at most one active correction session exists per game. Ordinary and correction sessions cannot be active for the same game simultaneously. |
| `INV-19` | In Season 1, opening, mutating, canceling, or finalizing either session requires the owner-admin identity with a verified AAL2 session. Anonymous, non-admin, AAL1 admin, and legacy `temp_admin` callers are denied. |
| `INV-20` | A session has an explicit server-controlled state. Closed, canceled, and finalized sessions reject new events. |

### Game state and public projection

| ID | Falsifiable invariant |
|---|---|
| `INV-21` | The ledger-mode state graph is `scheduled → live → final/locked`. A final game may enter `correction-drafting`, then only `re-finalized` or the prior `final/locked` state through cancellation. Unsupported transitions fail. |
| `INV-22` | `scheduled → live` occurs only through the scoring-session start RPC after rule, team, and participant snapshots succeed. |
| `INV-23` | Finalization occurs only through the sanctioned AAL2 path after every applicable HARD rule passes: aggregate games move from completed/submitted-or-approved to final/locked through `lock_game`; future ledger games move from live to final/locked through atomic ledger finalization. |
| `INV-24` | A post-final correction requires a nonblank reason and a currently final, locked game. Aggregate correction applies atomically without an intermediate unlock; a future ledger correction session does not mutate the published projection until commit. |
| `INV-25` | While a correction is drafting, public readers continue to see the prior final locked score, periods, stats, winner, and bracket consequences. Draft events and session metadata are not public. |
| `INV-26` | Re-finalization atomically replaces the published projection and returns the game to final/locked. Cancellation discards the draft's effect and leaves the prior published projection byte-for-byte unchanged. |
| `INV-27` | Scheduled games expose schedule metadata only; live ledger games remain admin-only during the pilot; final/locked games expose only their committed public projection and allowlisted public fields. |

### Mode separation and finalization

| ID | Falsifiable invariant |
|---|---|
| `INV-28` | Every score-bearing game declares exactly one mode: `aggregate` or `ledger`. |
| `INV-29` | A game may move from aggregate to ledger only through a controlled one-way conversion before any ledger session starts. A ledger-mode game can never return to aggregate mode. |
| `INV-30` | Each game has exactly one correction authority: aggregate-mode games use `correct_final_score`; ledger-mode games use void/replacement events. No game can use both or return from ledger mode to aggregate mutation. |
| `INV-31` | Aggregate correction replaces score/stat projections atomically, records reason and before/after audit output, and preserves the final lock. Existing aggregate history is never rewritten as synthetic ledger history when ledger mode is introduced. |
| `INV-32` | Every aggregate correction and future ledger finalization is atomic across validation, `games`, `player_stats`, safe bracket consequences, retained/reapplied lock, and system-written history. Ledger finalization additionally folds the effective ordered ledger. All effects commit or none commit. |
| `INV-33` | Projection rows are deterministic cached output: the same effective ledger and rule snapshot produce the same game, player-stat, outcome, and bracket projection. Projection values are never independent correction input. |
| `INV-34` | A failed finalization changes no ledger effectiveness, projection, lock, or bracket state. Any `failed` audit entry is system-generated outside the rolled-back projection transaction and contains metadata only. |

## C. Correction authority — DECIDED July 19, 2026

### Binding authority rules

| ID | Falsifiable invariant |
|---|---|
| `INV-35` | For a ledger-mode game, effective ledger events are the sole authority for score, periods, player stats, outcome, and bracket consequences. |
| `INV-36` | Post-final corrections append void and replacement events. Original events are immutable and remain auditable. |
| `INV-37` | `game_edit_history` is audit output only and is never projection input. Ledger correction rows record `opened`, `finalized`, `canceled`, or `failed`, plus actor, server timestamp, required reason, and session reference. Aggregate-mode saves/corrections may additionally retain non-authoritative before/after score-stat snapshots, validation warnings, and their override reason, as decided for Sequence 2 on July 19, 2026. |
| `INV-38` | Only controlled RPCs write `game_edit_history`. Direct client insert, update, delete, truncate, trigger, and references privileges are denied, and its existing append-only database guard remains active. |
| `INV-39` | Neither clients nor administrators manually correct `games` or `player_stats` projection rows. Rebuilding from the effective ledger is the only ledger-mode correction path. |

### Seven-step correction flow

1. The owner-admin supplies a required, nonblank correction reason.
2. An AAL2 RPC locks the game row and verifies final/locked ledger state,
   absence of another active session, and the bracket-safety matrix below.
3. The RPC creates the correction session and an `opened` audit-output row.
4. The prior result remains locked and publicly visible while draft void and
   replacement events are appended to the correction session.
5. Finalize locks the correction/session/event rows, folds the proposed
   effective ledger, and validates every applicable invariant.
6. The transaction atomically rebuilds projections, applies the permitted
   bracket revision, retains the lock, closes the session, and appends the
   `finalized` audit-output row. Any failure leaves the prior publication
   untouched and produces only metadata-only failure audit through a
   controlled system path.
7. Cancel closes the correction session, leaves the published result and
   authoritative pre-correction ledger effectiveness unchanged, and appends a
   metadata-only `canceled` audit-output row.

### Bracket-safety matrix

The system determines safety from the correction's projected winner, not from
the fact that a correction was opened. Drafting may begin in every row below;
the decision controls whether re-finalization may commit.

| Corrected result and downstream state | Decision | Required atomic behavior |
|---|---|---|
| Winner is unchanged, regardless of whether a dependent game is unscheduled, scheduled, live, or final | **Allowed** | Rebuild score/stats and source-match display only. Preserve every downstream participant, game, result, and advancement exactly. |
| Winner changes and the source is terminal (championship or third-place game) with no dependent destination | **Allowed** | Replace the source match winner/loser and terminal bracket placement atomically. |
| Winner changes; a destination slot was populated but its dependent game has not been scheduled (`game_id` is null and destination is not completed) | **Allowed; automatic retraction/reapply** | Retract the old winner/loser from every affected next-round or third-place slot and insert the corrected participants in the same transaction. |
| Winner changes; a dependent game is scheduled but has not started | **Blocked** | Do not automatically unschedule or rewrite a scheduled contest. The owner must use a separate controlled cancellation/unscheduling workflow, clear the dependency, and retry finalization. The prior result remains published meanwhile. |
| Winner changes; a dependent game is live, completed, final, locked, or has produced further advancement | **Blocked; owner incident required** | No automatic cascade through played competition. Preserve all published results. The owner must explicitly resolve the competition incident before correction finalization can be retried. |
| Source is a bye rather than a played score-bearing game | **Not a ledger correction case** | Bye topology changes require the bracket-management RPC path, not score correction. |

This policy deliberately does not cascade participant replacement through a
scheduled or played game. It favors a visible operational stop over silently
rewriting competition history.

## D. Flag-football pilot scope fence

### The pilot must exercise

| Area | Required evidence |
|---|---|
| Full games | Complete admin-only flag-football games from scheduled through four quarters and final/locked projection, including touchdown, conversion, interception, signed yardage, and player-attributed safety fixtures across the test set. |
| Overtime | At least one tied regulation game completed through college-style overtime with equal opportunity and a non-tied final result. |
| Retry safety | Repeated create-event and finalize commands with the same idempotency keys produce one result and no duplicate event/history/projection effect. |
| Validation | Negative cases cover illegal point values, invalid periods, unsnapshotted players, broken passing/receiving reconciliation, negative count stats, and a tied final result. |
| Correction | At least one post-final void/replacement correction, one cancellation, one failed finalization, and proof that the prior public projection remains unchanged during drafting and after failure/cancellation. |
| Playoffs | Same-winner correction, unscheduled-destination winner change with atomic retract/reapply, and scheduled/played-destination winner-change denial. Include the third-place path. |
| Practice mode | A full no-consequence scoring rehearsal with events, retry, finalization preview, and correction. Practice data is explicitly nonproduction, nonpublic, and excluded from standings, career totals, brackets, and official game projections. |
| Authorization | Real anonymous, authenticated non-admin, AAL1 admin, and AAL2 owner-admin calls prove the Season 1 boundary across sessions, events, correction, finalization, and history. |

### The pilot must not touch

- Kickball games, player stats, rules, standings, or career totals.
- Public live-score visibility; only a committed final projection may use the
  existing allowlisted public read surface.
- Player or captain accounts, signup, password reset, email verification, or
  any authorization-role expansion.
- Existing aggregate-mode game history or correction mechanics.
- Hosted data outside a separately approved Sequence 4 push and matrix. The
  Migration-24 schema and expanded 26-table authorization gate are complete;
  they do not authorize a runtime or pilot fixture write.

## Current implementation gaps discovered during the rules review

These are traceable inputs to later sequences, not changes made by this
docs-only stage. The hosted baseline contains no scored games, so this review
found no evidence of corrupted live data.

| Verdict | Current behavior | Required later trace |
|---|---|---|
| **BLOCKING before ledger pilot** | `ScoreEntry` hardcodes five kickball innings instead of snapshotting a variable regulation count. | `INV-10` |
| **BLOCKING before ledger pilot** | All form stats are clamped nonnegative, so valid negative pass/rush/receiving yardage cannot be entered. | `INV-03` |
| **BLOCKING before ledger pilot** | Current score entry reads the mutable roster and has no participant snapshot. | `INV-11`, `INV-12` |
| **RESOLVED AND HOSTED-ACCEPTED IN SEQUENCE 2** | `submit_score` and `correct_final_score` enforce aggregate HARD rules server-side and require a recorded override reason for SOFT reconciliation warnings. Migration 23 passed the revised 154/154 hosted authorization matrix. | `INV-01`–`INV-08` |
| **BLOCKING before ledger pilot** | Current status/standings logic ignores canceled games and has no explicit forfeit outcome, so it cannot represent the approved W/L-only forfeit rule. | `INV-09` |
| **RESOLVED AND HOSTED-ACCEPTED IN SEQUENCE 2** | `safeties` is now an allowlisted player stat and is included in flag score reconciliation. | `INV-13` |
| **BLOCKING before ledger pilot** | The existing UI has no flag-football overtime entry model. | `INV-01`, `INV-08`, `INV-10` |
| **RESOLVED AND HOSTED-ACCEPTED IN SEQUENCE 2** | Migration 23 revokes direct score/stat/history mutation, retires aggregate unlock, and the Score Entry route no longer admits `temp_admin`. | `INV-04`, `INV-19`, `INV-38` |
| **RESOLVED AND HOSTED-ACCEPTED IN SEQUENCE 2** | Aggregate final correction preserves downstream advancement for same-winner changes, atomically reprojects unscheduled destinations for winner changes, and blocks winner changes after a dependent game is scheduled or completed. | `INV-30`–`INV-32`, bracket-safety matrix |
| **RESOLVED AND HOSTED-ACCEPTED IN SEQUENCE 3** | Migration 24 gives every game an explicit aggregate/ledger mode, permits only a controlled one-way conversion before scoring/session evidence exists, and blocks aggregate scoring/correction RPCs from mutating ledger-mode projections. The hosted 26-table matrix passed 225/225 with exact cleanup and baseline restoration. | `INV-28`–`INV-30`, `INV-35`, `INV-39` |
| **RESOLVED AND HOSTED-ACCEPTED IN SEQUENCE 3** | Migration 24 adds immutable rule/game and eligible-participant snapshots, correction-session cloning from the ordinary snapshot, one active session per game, server-assigned gapless per-game sequence numbers, game-scoped idempotency uniqueness, and append-only event/attribution evidence with void/replacement anti-fork constraints. No runtime RPC or projection exists yet. | `INV-10`–`INV-18`, `INV-20` |
| **BLOCKING before ledger pilot** | Sequence 4 still must add AAL2 session/event/finalization RPCs, deterministic projection and replay, failure audit, public-final-only publication, forfeit handling, and bracket-safe ledger correction. | `INV-01`–`INV-09`, `INV-19`, `INV-21`–`INV-27`, `INV-32`–`INV-39` |
