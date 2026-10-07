# PHASE0-007 review

## Verdict

**clean** — No actionable findings in `agent/phase0-007` at `5ee9a79e753c86727e8ea6282a0d02ed4da97f5a`, reviewed against `development` at `20ae39e97fcc21a9923cba6b35bbf8b47c96a968`. This is a domain-module review; it does not close the route-level acceptance criteria deferred by the task.

## Findings

None.

## What I ran and what I did not

I independently ran `npm run verify`. It exited successfully: TypeScript checking passed, and Vitest reported **50 test files and 2,870 tests passed**, with no failed files or tests. The run took 23.59 seconds. Compared with the task's recorded development baseline of 49 files and 2,838 tests, this adds one file and 32 tests, matching `session.test.ts`. The client source and tests are unchanged in the branch diff. The aggregate output did not separately print the client's file and test totals; the task's 40-file, 2,719-test client baseline is not a separately observed result from this review.

The working tree was clean before and after verification: `git diff --stat` printed nothing on both sides. The branch diff remained three files and 1,182 insertions: the task file (463 lines), the session module (183), and its tests (536). Both commit IDs above were unchanged after the green run. `git diff development...agent/phase0-007 --check` also passed. The review report was added only after those checks.

I attempted `npx vitest run apps/server/test/session.test.ts` separately. Its setup failed with `connect EPERM 127.0.0.1:5433`; the process exited 1 without running the tests. Consequently, I did not independently reproduce the three consecutive standalone green runs. The session tests did run as part of the successful full verification. The three standalone runs and ten red proofs described in the Handoff remain builder-reported evidence; I inspected their descriptions and the corresponding assertions, but did not rerun those mutations.

The source search for `Date`, `console.`, and `now()` found only the insert's `now()` at `apps/server/src/domain/session.ts:87`. I also attempted an additional in-memory malformed-token check, but the JavaScript runtime rejected generated-code execution before its assertions ran. It provides no runtime evidence, and no source or test file was changed.

I read the task, its copied binding ARCH-008 sections, the cited PRD requirements and boundaries, architecture sections 7 and 14.4, ARCH-006 section 4, the relevant recorded owner rulings, and the migration, credential interfaces, pool, and database harness. There is no screen change to inspect. I did not run browser, cookie, route, password-login, approval, or Phase 1 credential-writer tests; those integrations are outside this task.

## Cleared

- The shared `VALID` predicate is applied to both ACTIVE resolution paths, the IDLE fallback, and re-authentication. I specifically checked the shared-state failure shape: omitting the idle clause for renewal and classification does not omit audience, release, active-user, credential-version, or absolute-expiry checks. IDLE returns no role, and released or absolutely expired sessions are not classified as IDLE. These checks follow FR-A2, FR-A2b, FR-A2c, FR-B3, AC-27, AC-28, AC-32, and task rules 7 and 12.
- Creation stores the version supplied by credential verification without rereading the user, preserving ARCH-006 section 4's verify/reset/create interleaving. Resolution obtains the current role in the same statement and does not use `client_instance_id` as authorization (FR-A7). Refusing a demoted manager on a back-office route remains Task 9's responsibility, as the task explicitly requires.
- The token is 32 random bytes encoded as base64url; storage contains its SHA-256 digest. Token-consuming exports share validation before querying. Static inspection confirms that database exceptions are replaced without their original cause, token, or digest. This is task rule 4's token rule; B-12 separately governs PIN values.
- Interactive resolution uses one conditional update and `GREATEST`; polling uses a read-only select. The tests cover release winning an update race, expiry after the task's specified lock-wait interleaving, and 25 simultaneous resolutions. Test 13's relative aging preserves evidence of an erroneous polling touch instead of overwriting it, so the documented adjustment strengthens AC-28 coverage.
- Re-authentication keeps the session ID and absolute lifetime, rotates the token, and requires the same verified user and version. Another manager cannot adopt the session. This matches the 2026-10-05 same-manager ruling and the 2026-10-06 M-6 refinement. Release is audience-scoped, idempotent, and works on idle sessions.
- The diff contains no migration, grant, existing-test, credential, throttle, audit, or client changes. The Handoff carries forward cookie secrecy, route activity classification, current-role checks, IDLE's lack of actor authority, release before login, and the prohibition on using sessions for inline approval (B-13, B-14, FR-A2c). Fixed timeout constants implement the PRD; ARCH-006 section 4 explicitly explains why B-24 does not make them restaurant configuration.
