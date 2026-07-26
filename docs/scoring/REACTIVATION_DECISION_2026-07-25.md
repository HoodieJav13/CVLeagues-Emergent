# CVF Leagues Reactivation Decision — 2026-07-25

**Status:** OWNER-CONFIRMED

## Preserved accepted baseline

- The freeze was a bookmark around a known-good state, not a declaration that
  CVF Leagues development was finished.
- The exact frozen baseline is `origin/main` commit
  `fa737b2a17732f273251da5a4ba0a75b1037113e`
  (`docs(backend): accept sequence 4 authorization matrix`).
- Sequence 4 remains accepted at 256/256 through Migration 27. Its dated
  evidence files are immutable. Sequence 5A results are later work and must
  never be reinterpreted as part of the older Sequence 4 acceptance.

## Why work resumed

The owner explicitly lifted the freeze so the scorekeeping program can advance
from its accepted Sequence 4 baseline to another deliberate stopping point.
This reactivation is bounded; it does not reopen the whole application or
authorize miscellaneous backlog work.

## Reactivation stage R1

**Outcome:** reconcile the accepted Sequence 4 baseline with the already
committed, locally verified Sequence 5A overtime and `INV-07` work, install the
repository Protocol v1.2 contract, and produce one owner-reviewed merge commit.

**Stopping point:** the reviewed reconciliation merge commit exists locally,
the branch remains unpushed, Migration 28 remains unhosted, and the owner
selects the next bounded stage.

**Explicit exclusions:**

- no Git push, pull request, deployment, or hosted mutation;
- no hosted publication or acceptance of Migration 28;
- no durable populated-ledger fixture or official pilot;
- no signed standalone rushing-yard or practice-mode implementation;
- no Sequence 6 field testing or second-sport/live decision;
- no resumed Pass 4 UI batches or unrelated backlog work.

## Autonomy envelope

- **Branch/worktree:** `main` in
  `/private/tmp/cvfleagues-pass4-batch0`.
- **Allowed mutation scope:** the no-commit reconciliation of the two branch
  histories, Protocol v1.2 repository contract files, and documentation needed
  to preserve both histories and record this decision accurately.
- **Allowed commands:** repository inspection, diff/status checks, protocol
  validation, documentation verification, and—only after the separate owner
  checkpoint—the local merge commit.
- **Local/hosted boundary:** local-only. Push, deployment, Supabase writes,
  fixture creation, and every hosted migration remain separately gated.
- **Required review:** verify both Sequence 4 evidence runs are preserved,
  Sequence 5A remains labeled local-only, the protocol does not weaken
  `AGENTS.md`, and the complete reconciliation diff is owner-reviewed.
- **Stop conditions:** any product-code or migration conflict, unexplained
  baseline change, failed contract validation, failed diff check, missing
  evidence, or any action beyond the explicit exclusions above.

## What follows

After R1 closes, choose exactly one new bounded stage and issue a new autonomy
envelope. Candidate stages remain Migration 28 hosted publication/acceptance,
signed standalone rushing-yard plus practice-mode completion, or the later
durable flag-football pilot. No candidate is authorized by this decision.
