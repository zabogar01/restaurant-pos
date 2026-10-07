# PHASE0-006 review

## 1. Verdict

**findings** — One medium-severity finding. The full verification suite and three consecutive throttle-only runs pass, but the cooldown calculation uses a transaction-start timestamp across a potentially unbounded lock wait. The illustrative SQL itself carries this defect; the lead should resolve the conflicting task instructions before requesting a correction.

## 2. Findings

### P2 — The shared transaction-start clock is stale after waiting for the bucket lock

**Location:** `apps/server/src/domain/throttle.ts:31-32`, `apps/server/src/domain/throttle.ts:65-68`. The coverage gap is in `apps/server/test/throttle.test.ts:245-260`.

**What is wrong:** PostgreSQL's `now()` is fixed at transaction start. `withTransaction` begins the transaction before the locking query, so acquiring the lock does not refresh the time used for the cooldown comparison or remaining-seconds calculation. Reading the updated row under `FOR UPDATE` correctly refreshes the bucket state, but not the transaction's clock. Consequently, a waiting request can return `THROTTLED` with more than 300 seconds remaining, or reject a verification after the stored cooldown has actually ended. This is the shared value that is correct for immediate attempts and wrong for queued attempts.

**Authority:** PHASE0-006's binding rule 8 requires `retryAfterSeconds` to be a whole number from 1 to 300. FR-A5 and AC-19 specify a five-minute cooldown; the owner ruling recorded at `.agent/DECISIONS.md:105` requires the failure count to reset when the cooldown ends. The same task rule also explicitly mandates `now()`, and the illustrative SQL uses it, so the implementation followed a conflicting prescription rather than independently choosing the wrong clock.

**Concrete failing scenarios:** An owner holds the LOGIN row lock; a verification begins its transaction and waits. Two seconds later the owner sets `blocked_until = clock_timestamp() + interval '5 minutes'` and commits. The waiting verification reads the new row, but subtracts its earlier transaction-start time, yielding approximately 302 seconds. Alternatively, with a cooldown already stored, a verification begins just before expiry, waits behind another holder until after expiry, and still returns `THROTTLED` because its `now()` remains before `blocked_until`. These scenarios are inferred from the code and PostgreSQL timestamp semantics; I did not execute these additional scenarios or observe their numeric results. Existing case 13 checks only the outcome and sets the deadline using the owner's earlier transaction-start `now()`, so its green result does not prove the range under a later deadline.

**Proposed fix:** Obtain an architect/lead correction to the task's explicit `now()` instruction. Retain the row lock and transaction client, but evaluate expiry and remaining duration using PostgreSQL time sampled after the lock is acquired; use current database time when starting a new cooldown as well. Do not merely clamp the seconds, because that leaves the stale expiry decision intact. Extend the lock-wait test to assert the complete result with a deadline established after the verifier starts waiting, and add a lock wait that crosses an existing cooldown's expiry. Both should continue to prove that the row, not an unlocked pre-read, supplies the decision state.

## 3. What I ran and what I did not

### Observed

- Reviewed `git diff development...agent/phase0-006`, the task and its embedded ARCH-007 authority, the cited PRD requirements and acceptance criteria, boundaries, architecture sections 7 and 11, the relevant owner rulings, and the supplied PIN, audit, pool, migration, and database-harness code. No separate reviewed design artifact applies to this domain-only task.
- Ran `npm run verify`: typechecking passed; **49 test files and 2,836 tests passed**. Relative to the task's development baseline of 48 files and 2,815 tests, that is one file and 21 tests added. Existing client source and tests are absent from the branch diff.
- Ran `npx vitest run apps/server/test/throttle.test.ts` **three consecutive times**: **1 file and 21 tests passed on each run**, with reported durations of 1.80 s, 1.80 s, and 1.85 s.
- Confirmed stability before and after verification, including after the last green focused run: `git diff --stat` was empty; `git diff development...agent/phase0-006 --stat` remained four files, 812 insertions and six deletions; HEAD remained `66cdbe4` (`chore(agent): PHASE0-006 to review`). The only subsequent file change made by this review is this report.
- Searched `throttle.ts` for `Date|console\.` using the content-search tool; it found no matches.
- The test runs emitted the existing Vite configuration warning but completed successfully.

### Not run or independently proved

- I did not run source mutations or independently reproduce the builder's seven red proofs. Their outputs are documented in the Handoff; this review checked their claimed coverage against the tests and implementation.
- I did not execute the additional clock/lock scenarios in the finding. Their results are static deductions, not claimed runtime observations.
- I did not run a browser, HTTP-route tests, an application-process restart, or a database restart. The fresh-module test and permanent-table assertion passed; they are the task's domain-level durability evidence, not a literal restart exercise. AC-19 remains open at the route, and AC-18 is not closed by this task.
- The required Herdr environment check was attempted but refused by the shell allowlist. No Herdr inspection or control was performed during the review; the final notification is requested explicitly by the dispatch.

## 4. Cleared

- The module's interface and exports match the task. No bucket reader/resetter, caller-supplied transaction, adjustable constants, new grant, migration, or route was introduced.
- Each attempt owns one transaction. The bucket is locked before PIN verification; lookup and updates use that transaction's client. A missing bucket throws, and a thrown lookup propagates through transaction rollback. There is no intervening pool checkout inside the held lock.
- LOGIN accepts active staff, while MANAGER_APPROVAL additionally requires a manager. The cashier approval-failure case and independent-class/reset cases pass. Expired cooldowns restart failure counting at one when evaluated with an up-to-date clock; success resets only its own class.
- The 25-attempt test settles with five failures, 20 throttled results, five PIN_FAILURE events, and one COOLDOWN_STARTED event. The explicit owner-lock tests demonstrate actual waiting and a decision based on the locked row.
- Security events are written after commit and after releasing the transaction client. The foreign-key rejection test proves the failure count remains committed. LOGIN failures emit PIN_FAILURE; approval failures do not. Throttled and verified attempts emit no event. Actor-attributed approval audit work remains correctly handed forward to Task 10 under FR-J3 and B-13.
- PINs are passed only to `findUserByPin` by the throttle implementation; the optional client preserves the existing keyed lookup and Argon2id verification. There is no new credential storage or logging path. The error/event PIN-exclusion test passes, supporting B-11, B-12 and FR-J4 within the tested cases.
- Different client instances and absent client identity accumulate in the same installation-wide bucket, supporting FR-A7 and AC-19. The constants are security policy specified by the task, not routine restaurant configuration under B-24.
- Existing tests and `audit.ts` are unchanged. The Handoff includes the seven red-proof reports, three focused green runs, case mapping, and the required Task 9 and Task 10 carry-forward items.
