# Aggregate Scoring Validation Classification

**Applies to:** Sequence 2 aggregate-mode score submission and final correction

**Source of rules:** [`RULES_INVARIANT_MATRIX.md`](RULES_INVARIANT_MATRIX.md)

HARD violations reject without mutation. SOFT violations return every warning
and may proceed only with a nonblank override reason stored alongside the
warning payload in `game_edit_history`. Client validation exists for immediate
feedback; the RPC repeats every security or integrity decision and remains
authoritative.

| INV-ID | Tier | Rule enforced in Sequence 2 | Client | RPC / database |
|---|---|---|---|---|
| `INV-01` | HARD | Home/away period arrays have equal nonzero length; every period is valid; period sums equal submitted totals. | `validateAggregateScore` | `cvf_validate_aggregate_score` |
| `INV-03` | HARD | Scores, periods, and stats are integers; scores/periods/counts are nonnegative; only passing/rushing/receiving yards may be signed. | `validateAggregateScore`; input constraints match signed-key policy. | `cvf_validate_aggregate_score` validates JSON types, integer syntax, sign, and range. |
| `INV-04` | HARD | Score, stat, and history mutation uses sanctioned RPCs only, targets an existing game, and uses sport-allowlisted stat keys. | Adapter calls only `submit_score` or `correct_final_score`; a missing game or invalid key rejects before call. | Table/column grants are revoked; RPC row-locks the target game and repeats the sport-key allowlist. |
| `INV-05` | SOFT | Kickball player runs reconcile to score and RBIs do not exceed runs. | Warning dialog + required override. | Warning JSON + required `p_override_reason`. |
| `INV-06` | SOFT | Flag stat-derived points reconcile to entered score, including player-attributed safeties. | Warning dialog + required override. | Warning JSON + required `p_override_reason`. |
| `INV-07` | SOFT | Flag paired tallies reconcile: completion/catch, pass/receive yards and TDs, thrown/defensive interceptions, and subset counts. | Warning dialog + required override. | Warning JSON + required `p_override_reason`. |
| `INV-08` | HARD | Every Season 1 kickball and flag-football final has a winner; playoff finals also cannot tie. | `validateAggregateScore` names the tied values. | `cvf_validate_aggregate_score` rejects before mutation. |
| `INV-09` | HARD | A canceled game cannot receive an aggregate box score. | Shared validation rejects with the game ID and canceled state. | `submit_score` explicitly rejects canceled lifecycle state. |
| `INV-10` | HARD | Flag regulation uses exactly four quarters. Kickball accepts the existing variable aggregate period array; rule snapshotting waits for Sequence 3. | Period-count validation. | Period-count validation. |
| `INV-11` | HARD | Every stat row is attributed to a home/away team and a currently active roster row for that team. | State roster validation. | `team_players` membership validation under row lock. |
| `INV-13` | HARD | A safety has a nonnegative player count and contributes two derived points. | `safeties` is an allowlisted flag stat. | `safeties` is validated and included in the reconciliation formula. |
| `INV-19` | HARD | Season 1 scoring and correction are owner-admin AAL2 only. | Score Entry is admin-only; the adapter exposes no mock-only role bypass. | Both RPCs begin with `assert_admin()`; AAL1/non-admin/anon negatives cover them. |
| `INV-23` | HARD | Only a valid completed submitted/approved score may be marked final. | Existing Mark Final eligibility remains. | `lock_game` rechecks stored HARD validation before locking. |
| `INV-24` | HARD | A post-final correction requires a nonblank reason and a completed final locked game. | Correction cannot enter editable draft without a reason. | `correct_final_score` repeats state/reason checks under row lock. |
| `INV-30` | HARD | Aggregate correction uses one authority; the bare unlock path is unavailable. | Unlock controls and adapter function removed. | `unlock_game` execute revoked; correction RPC is the only final-score path. |
| `INV-31` | HARD | Aggregate correction atomically replaces score/stat projections, preserves the final lock, and emits non-authoritative before/after audit. | Mock correction commits the same visible state and history shape. | One `correct_final_score` transaction owns replacement and audit insertion. |
| `INV-32` | HARD | Correction projection, stats replacement, safe bracket revision, lock retention, and audit append commit atomically. Winner changes stop once a dependent game is scheduled. | Mock mode reproduces the same visible outcomes and stop rule. | One `correct_final_score` transaction performs or rolls back every effect. |
| `INV-37` | AUDIT | History is output, never projection input. Aggregate saves/corrections store non-authoritative before/after snapshots, reasons, overrides, and warnings. | Admin history renders reason, score delta, override, and warning count. | Only RPCs insert history rows. |
| `INV-38` | HARD | Direct history writes are denied. | No direct adapter mutation exists. | Insert/update/delete grants and client insert policy are removed. |
| `INV-39` | HARD | `games` and `player_stats` are never manually corrected. | Adapter sends correction inputs only to the RPC. | Direct score/stat grants are revoked; RPC rebuilds both projections. |

## Deferred because the required model does not exist until Sequence 3

`INV-02`, `INV-12`, `INV-14`–`INV-18`, `INV-20`–`INV-22`, `INV-25`–`INV-29`, and
`INV-33`–`INV-36` govern immutable participant snapshots, ledger events,
server event sequencing, scoring/correction sessions, explicit game mode, and
ledger-only correction authority. Sequence 2 does not emulate those concepts
inside aggregate mode.
