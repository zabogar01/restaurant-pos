# PHASE0-009b review

## Verdict: clean

Round 2 resolves the prior review's one low-severity finding. There are no remaining findings. I reviewed `agent/phase0-009b` at `8bce97659fb0ccf25d1b39aeb99048ee4ecf89d5` against `development` at `662ccf990b7af5591dce570d652934a9af51a460`, including the full credential-route diff and the correction since the previously reviewed `c71b36b`.

The authorities checked were the task and its lead rulings, its cited PRD requirements and acceptance criteria, B-11 through B-14 and B-24, Architecture sections 7.2 and 13, ADR-009's credential and renewal rules, ADR-010's HTTP rules, and the relevant prerequisite handoffs. No client design or screen is implemented by this task.

## Findings

None.

The previous finding at `apps/server/test/reauthenticate.test.ts:139` is resolved. Case 19 now makes `PASSWORD_MAX_FAILURES - 2` Login failures, checks the next M-6 failure against `PASSWORD_MAX_FAILURES - 1`, and checks the final failure against `PASSWORD_MAX_FAILURES`. The literal assertion that the limit equals five is gone. The test retains its cooldown-detail, unchanged-cookie, idle-session, unreleased-row, and successful-renewal assertions. This meets lead rulings 6 and 13; the specific authority for deriving test limits is the task ruling, not B-24's broader configuration rule. The round 2 executable diff changes only this test, as ruling 14 requires.

## What I ran and what I did not

- I ran `npm run verify` once, without starting another test run in parallel. Typechecking passed. Vitest reported **64 test files passed and 3,211 tests passed**, with a duration of **44.21 seconds**. This matches the round 2 handoff and adds three files and 42 tests to the dispatch baseline of 61 files and 3,169 tests. The run printed the Vite configuration-loader compatibility warning and no test failures.
- Immediately before and after that run, `git diff development --stat` was identical: **23 files changed, 2,416 insertions, 25 deletions**. Both commit IDs remained unchanged, and the worktree was clean on `agent/phase0-009b` before this report was edited. The stat includes the already committed prior report and task file.
- `git diff --check development...HEAD` passed. Source searches found the session-cookie names only in `session-guard.ts`, the appropriate verifier on each credential surface, and no `reportInput` in application or package TypeScript files. Inspection confirmed that the changed routes raise errors through the existing envelope rather than constructing error responses themselves.
- I read the three new integration test files, the changes to existing tests, the jar client's request path, and the session domain operations used by the new helpers. Credential and renewal tests obtain their sessions through the production sign-in routes; fixture-only session creation in the existing guard tests is not being used to claim coverage of sign-in behavior. The two manager-fixture additions follow ruling 12.
- I did not independently rerun the builder's mutation proofs or its three consecutive focused runs, and I made no in-memory mutations. Those results remain handoff evidence. I did not change a policy constant to simulate a future threshold; the test's independence from the literal five was established by inspecting the revised attempt and assertion expressions, with the current configuration exercised by verification.
- I did not use a browser or claim coverage of unsaved draft restoration, browser timeout presentation, or approval routes. These remain later tasks under the task's closure table. A diagnostic `ps` command was denied by the environment and supplied no evidence; verification subsequently completed successfully.

## Cleared

The shared-state check covered `signIn` across both audiences and successful, failed, and throttled verification, and `verifiedUser` across Login and M-6. Successful verification precedes release of the presented session and creation of a fresh token. Failed and throttled verification do not reach session mutation. Tests cover an existing POS session surviving failure and throttling, and another manager's idle back-office session remaining renewable after a failed sign-in. The revised case 19 exercises one password counter across Login and M-6, as ADR-009 section 4 requires.

M-6 follows the task's sequence: cookie, CSRF token, strict password-only body, session resolution, account-bound password verification, and renewal. Active and idle sessions share renewal without bypassing verification. Renewal rotates the token on the same row without restarting the absolute lifetime. Invalid resolution counts no password attempt, and a null renewal clears the cookie without creating another session. These checks cover the API portion of FR-A2b, ADR-009 section 6, and AC-35.

Strict schemas reject malformed PINs and extra fields before counting. Password schemas leave credential policy to the domain. Failed credentials share one response, while a failure that starts a cooldown and an already-running cooldown retain their distinct codes and typed retry details. The real routes exercise the error handler's details path, and typechecking exercises the forbidden-details cases required by ADR-010 rule 1 and the task's ruling 5.

Cookie audience selection, cookie attributes, CSRF rotation, throttle isolation, client-instance replacement, and rebuilt-server refusals are covered at the API level. The identity reader uses one parameterized SELECT without a clock and replaces database exceptions with a fixed error. Successful views return stored identity fields, with no username in POS views, as rulings 2 and 3 require. The changed routes add no audit or security-event writer, no approval state, and no credential logging. I found no boundary violation in the changed paths; the API closure limits for AC-19, AC-27, AC-28, and AC-35 remain those stated in the task.
