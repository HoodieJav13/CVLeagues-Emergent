# Leagues integration — 2026-10-06

Outcome: complete (local scope); exact-head release gates pending
Delivery depth: committed
Protocol version: v1.2
Test baseline: Claude 5defc6cff5c355b16e0460f7f9389a0e5eff7057, tree f293d4038c250c087cf14c6e64b260edf9a6b4f7
Integration target: HoodieJav13/CVLeagues-Emergent main, last observed 5dae3ec98bae05087388b357b42c8ad5fcae52b4
Runtime head: 19bdf2bb0a3d6504f18e1c312cb5e6b73f14d341; this record is a documentation-only successor
Branch and upstream: review/leagues-combined-oct6; not pushed at this checkpoint
Authority used: approved local integration, tests, focused commits and single combined PR preparation. PT sequencing is cleared; merge awaits exact-head checks and parent review acceptance. Deployment is separately gated.
Migrations/deps: none
External actions at checkpoint: read-only publication checks; no push/PR/merge/deploy/hosted fixture writes

## Verified input and preserved history

The owner-supplied cvf-leagues-mobile.zip in Mac Downloads contains 4,702,286 readable bytes, SHA-256 d6e54877009dc6c3d0c16929d05f90de417be85d7c11d2ba39c43829641e203e. Safe paths and all149 included checksums passed. It is a distinct subset of the earlier299-file tarball; the tarball hash was not applied to this ZIP. The unavailable Library helper was not retried or bypassed.

The incremental bundle was verified and consumed once, requiring exact1caa74ba28678138bd38a6cbd407a2909a2e6327 and yielding the exact Claude head/tree above. No patch was also applied. Original six Claude commits, the reviewed1caa74b fix and Claude's five subsequent commits remain unchanged. No rewrite was performed for unsigned status; fresh SSH trust verification remains unavailable without an allowedSignersFile.

## Approved policies and additional correction

Parent records owner approval Sentinel_94d37c3fe940819187653dc687e25183, October6 02:00UTC: “Yes agree on those 2.”

- Cross-division pairing is allowed within the same league. Distinct-team, active-enrollment and same-league checks remain; sport is derived from the league.
- New/changed repeated-hour fall-back times are rejected consistently in New Game, Edit Game and Playoffs, with actionable guidance and no write. Spring-forward gaps remain rejected.
- Untouched Edit Game clock faces preserve the exact existing instant, including either fold occurrence and seconds/milliseconds. Deliberate input changes clear that preservation anchor, including changing away and returning to a repeated minute. Historical games are not rewritten.

Independent review found one additional P2: INSERT could commit while refresh failed, after which same-form retries returned23505 indefinitely without refreshing. Games-only23505 recovery now reads exactly eight schedule columns by the stable client ID and succeeds only if every requested field matches; starts_at compares as an instant. Missing/mismatched rows, readback failures, RLS errors and other collection duplicates still reject. No upsert/update, protected score/history/PII read, grant or schema change is introduced. The actual provider/dialog/backend regression proves two attempts, one stored row, successful refresh and dialog closure.

Focused commits:

- 13c0380c84215b36296d28a6c97978160c577f55 — scheduling policies
- d54e7bce386987d4d1d8250a196e73762fc916c0 — committed-game retry recovery
- 19bdf2bb0a3d6504f18e1c312cb5e6b73f14d341 — rehearsal settlement conditions

## Direct verification

[Raw results and source fingerprints](leagues-integration-2026-10-06/verification.json).

| Check | Result |
| --- | --- |
| Full frontend Jest | 45 suites,283/283; exit0 |
| API | 28/28; exit0 |
| Production build | compiled; exit0 |
| Local database harness | 382/382 plus ledger append/replay and practice fork races; exit0 |
| Fictional-season database rehearsal | 64/64, including New Game grants/RLS/negative rights; exit0 |
| Time converter | 14/14 each under UTC, Denver, Los Angeles and Tokyo |
| Production smoke | unchanged28/28; exit0; zero unexpected/skipped/flaky tests or suite errors |
| Mock browser | boundaries12/12, Teams6/6, Score Entry6/6, New Game season1/1; original journey1/1 after settlement correction |
| Independent Claude review | focused50/50 and phone browser12/12; retry P2 raised |
| Independent fix review | affected57/57 plus independent edge cases9/9; P2 closed, no remaining fix findings |

Regression controls failed first: policy8 Jest and2 browser failures; retry3 Jest failures. Independent sweeps covered all60 repeated/skipped minutes in2026/2027, boundary minutes, both preserved occurrences and negative readback/privilege cases.

The first complete browser run was25/26. Its baseline-relevant synchronization failure showed a closed correction overlay/dialog, then the lingering INV08 Sonner error toast, intercepting the next stat click. The test now moves the pointer outside the toast to resume dismissal, asserts toast DOM removal, and waits for correction-dialog removal. The original journey subsequently passed1/1 with no page/console errors. Assertions/timeouts remain; no forced clicks, toast hiding or app change. The retained failure trace ZIP is incomplete; the raw call log and snapshot establish the observed interceptors.

Claude's historical smoke21/28 remains failed evidence; its font/network attribution is unproven. Unchanged restored Claude runtime independently passed28/28 here; the final fixed production run also passed28/28 and exited naturally. Baseline smoke and focused policy runs needed previously verified exact owned-socket cleanup after Chrome exited; no global Chrome termination or TLS/security changes.

Local database tests used cached PostgreSQL17, offline, read-only source and no exposed ports. CI's PostgreSQL16/Node20/bundled Chromium remains an exact-head gate. No hosted AAL2 creation, real-device test or deployment acceptance is claimed.

## Actual phone pixels

Before/after pixels were inspected. Fresh after captures show wrapped team cards, reachable actions and an inner enrollment-table scroll region. Score Entry retains44px controls with all five innings/live totals horizontally inside the phone, plus wrapped extras. Layout tests cover320/360/375/390/768/1280.

| Surface | Before | After |
| --- | --- | --- |
| Admin Teams | [before](leagues-integration-2026-10-06/captures/before-admin-teams-360.png) | [after](leagues-integration-2026-10-06/captures/after-admin-teams-360.png) |
| Score Entry | [before](leagues-integration-2026-10-06/captures/before-score-entry-360.png) | [after](leagues-integration-2026-10-06/captures/after-score-entry-360.png) |

Immediate New Game snapshots caught the fade. [Settled pixels](leagues-integration-2026-10-06/captures/new-game-dialog-settled-360.png) and [computed style](leagues-integration-2026-10-06/dialog-settled-style.json) show opacity1, opaque rgb(32,28,24), no active animations and360×628 bounds. No styling fix was needed. [Explicit fold reselection refusal](leagues-integration-2026-10-06/captures/explicit-fold-selection-refused.png).

## Publication and remaining gates

Fresh read-only checks: main still5dae3ec; no open PRs, repository webhooks or rulesets; main unprotected; merge commits permitted; auto-merge disabled. The only workflow is test-only CI on PR/main push/manual dispatch with contents:read; no deployment commands. No changes touch supabase, api, .github or dependency manifests/locks.

Accessible CVF Hobby Vercel account has no Git-linked project for this exact repository; exact-repo filter returned none. This does not establish absence in other accounts or a production target. No project creation, billing, domain, payments, deployment, schema push or hosted fixture action is authorized here.

Remaining release gates: independent exact combined-head review, CI's four mandatory jobs on that head and parent final review acceptance before one merge commit. PT sequencing is cleared; deployment target/authority and launch legal/live-flow/operational gates remain separate. No scheduling-policy decision is outstanding.

Measurements: approximately35minutes elapsed at record preparation; approximately20minutes manual review across implementer/reviewer; additional material findings1, resolved; cost unknown; machine pressure low to moderate during concurrent local browser runs.
Owner interactions: new decision gates0 (two decisions already approved); avoidable transport0 after local ZIP found; unplanned corrections2 (retry defect and test settlement).
Independence: no blind phase claimed; reviewer independently derived retry finding and checked actual source/tests with known scope/decisions supplied. Historical reports were preserved.
