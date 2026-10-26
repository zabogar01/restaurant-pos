# PHASE1-S4a review

## Verdict: clean

No actionable findings. Reviewed `agent/phase1-s4a` at `d1cd90afb5d79fc4254bd7eb2ff91854ad05a9d7` against `development` at `2573854e891c746e35b79607e14be36a99c5c5ca`, using the task's acceptance criteria and cited authorities. The database restriction below limits independent runtime verification; the task's **Lead verify (2026-10-26)** explicitly accepts the lead's server-run evidence for that restriction.

## Findings

None.

## What I ran and what I did not

**Observed in this review.** I ran `npm run verify`. Its typecheck phase completed successfully and it entered Vitest, but produced no test results while stalled. A separate connection probe using the test harness's provisioning URL and a three-second connection timeout failed with `EPERM` connecting to `127.0.0.1:5433`. I interrupted the stalled verification process; it exited 130. This was not a green full verification run, and it supplied no completed-test count.

I then ran `npm run test:unit -- --project client`, which exited successfully: **89 test files passed, 3,736 tests passed**, in 11.02 seconds. This project includes the database-independent client and package tests. It does not establish that the new catalog integration or schema tests pass. `git diff --check development...agent/phase1-s4a` also passed.

**Tree stability.** Before verification, `git diff --stat` was empty and the branch comparison contained six files with 2,442 insertions. After the last green run, both facts were unchanged, the worktree was clean, and the branch and development commit IDs were still those recorded above. The report was added only after these checks. `git diff --stat 5def2e7 HEAD -- apps/server db/migrations` was empty, confirming that the reviewed server and migration files match the code covered by the lead's recorded run.

**Evidence supplied by the task.** The lead records a green `npm run verify` at `5def2e7`: **123 files, 4,540 tests**, compared with the stated baseline of 122 files and 4,486 tests. Those are the lead's counts, not independently reproduced counts. I read the new catalog test file and both existing-test diffs against the acceptance criteria; the existing assertions were not weakened. I did not rerun the builder's mutation proofs, either on disk or in memory, and do not claim to have observed their reported failures.

I did not run `npm run test:e2e:all`, browser checks, or migration commands against the development database. The task assigns the end-to-end run to the lead before merge. This slice changes no screen or route, so the client suite supplies no evidence about future BO-03/BO-04 production paths. I checked the cited DESIGN-019 and DESIGN-020 handoff rules and Round 2 rulings for the server contract, without claiming a fresh visual audit of those drawings.

## Cleared

- **Schema and scope:** Migration 0013 matches the task's five-table shape, singleton seed and exact column grants. The four configuration tables start empty (B-24). Prices use database `bigint` and TypeScript `Money`, with string conversion directly to and from `bigint` (B-1). Base, variant and modifier bounds match the task and DESIGN-020; FR-C2's resolved-price floor and FR-M5's line-total enforcement remain at the later line-pricing boundary. The options have no nesting, stock link or default variant (FR-C4).
- **Version and transaction rules:** Every command uses `catalogWrite`; its first statement after `BEGIN` locks the revision row `FOR UPDATE`, checks a supplied version before domain checks, and advances once only when the body reports a write (ADR-012 rules 9, 10, 13 and 14; C2 check-order ruling). Refusals thrown from a body and database errors pass through transaction rollback. `readCatalog` sets `REPEATABLE READ READ ONLY` before reading the version or contents (ADR-012 rule 11). The tests exercise lock contention, including an unversioned no-op that could not be proved by waiting on the later counter update alone.
- **Shared state discriminator:** I specifically checked `is_active` across categories, items and options. Archiving a category does not archive its items or release their active names. Archiving an item does not remove its options. Restore changes only the parent's flag, while option edits require an active option belonging to the correct item and list. An archived item may be edited or restored under an archived category, but creating or moving into that category is refused. These distinct uses follow the task's shape rules 4 and 5, FR-B4, and the DESIGN-019/020 rulings; the shared flag does not erase a separate availability or parent-archive fact.
- **One item save:** The option plan validates duplicate IDs and draft keys, ownership and final-order membership. Removal, temporary deactivation of renamed options, edits, reactivation, insertion and ordering follow shape rule 6. Name swaps retain the existing identities; re-adding a removed name creates a new identity and retains the inactive old row. A real final-state duplicate rolls back the whole save. Reorders operate on the complete active scope and preserve archived rows' stored order. No-op handling is checked before writes, including unchanged prices and options.
- **Errors and audit:** Duplicate outcomes distinguish the four named active-name indexes; other faults are replaced with a fixed-message error without a cause. The applicable logging authority is ADR-010 rule 2, with the task's shape rule 3 requiring this replacement. No catalog command writes audit records, consistent with the task's recorded Q11 ruling. The branch adds no route, request schema, client behavior or unrelated source change.
