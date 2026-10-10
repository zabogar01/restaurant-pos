# PHASE0-009b review

## Verdict: findings

One low-severity finding in a test. I found no production behavior defect in the changed credential routes. Reviewed `agent/phase0-009b` at `c71b36b801defdbad6eb2332309811c008645988` against `development` at `662ccf990b7af5591dce570d652934a9af51a460`, using the task, its cited requirements and boundaries, the accepted identity and HTTP decisions, and the prerequisite handoffs.

## Findings

### 1. Low: the shared password-counter test restates the policy limit

**Location:** `apps/server/test/reauthenticate.test.ts:150`, with the fixed attempt sequence at lines 139–148.

Case 19 imports `PASSWORD_MAX_FAILURES` but then asserts that it equals the literal `5`. Its three Login attempts and two M-6 attempts also assume that fixed threshold. This directly contradicts PHASE0-009b lead ruling 6 (`.agent/tasks/PHASE0-009b-credential-routes.md:541`), which requires every limit to come from the domain constants and explicitly prohibits restating `5`. The specific authority is that task ruling, rather than B-24's broader configuration rule.

The current policy makes this test pass. A concrete failure scenario is a future approved change of the domain threshold to six: the test still stops at five, expects a cooldown there, and fails its literal assertion even when Login and M-6 correctly share the configured counter. That scenario is inferred from the source; I did not mutate the threshold or run that scenario.

**Proposed fix:** make the Login attempt count `PASSWORD_MAX_FAILURES - 2`, derive the intermediate count assertions from that value, and let the final two M-6 failures reach the imported limit. Remove `expect(PASSWORD_MAX_FAILURES).toBe(5)`. Keep the assertions that Login and M-6 share the account's count and that the session remains renewable.

## What I ran and what I did not

- I ran `npm run verify` once, without another test run in parallel. Typechecking passed. Vitest reported **64 test files passed and 3,211 tests passed**, in **48.91 seconds**. This matches the builder's final count and adds three files and 42 tests to the dispatch baseline of 61 files and 3,169 tests. The run printed the Vite configuration-loader compatibility warning; it did not report a test failure.
- Immediately before and after verification, `git diff development --stat` was identical: **22 files changed, 2,351 insertions, 25 deletions**. `git status --short --branch` was clean on `agent/phase0-009b`, and both commit IDs remained unchanged. These checks precede creation of this report.
- `git diff --check development...HEAD` passed. Source searches confirmed that only `session-guard.ts` names the session cookies, each route imports only its own credential verifier, and `reportInput` is absent from the application and package TypeScript sources. Inspection confirmed that the route handlers raise errors through the existing envelope rather than writing error responses themselves.
- I read the new integration tests and the changes to existing tests, including the production sign-in paths used by the jar client, the renewal race test, the trace-level credential scan, and the compile-time error-detail checks. The existing test edits match the task's allowances, including ruling 12's two credential fixtures.
- I did not independently rerun the builder's nine mutation proofs or the three consecutive focused runs. Their results are handoff evidence, not reviewer-observed runs. I did not use a browser or claim coverage of unsaved draft restoration, browser timeout presentation, or approval routes; those remain later tasks under the task's closure table.
- Two diagnostic commands added no verification evidence: `ps` was denied by the environment, and `docker compose ps` lacked the required environment-file settings. The full verification subsequently completed successfully, so neither prevented the review.

## Cleared

The shared-state check focused on `signIn` across both audiences and across successful, failed, and throttled verification, plus `verifiedUser` across Login and M-6. Success releases the presented session before creating a fresh token. Failure and throttling do not reach session mutation. The integration coverage includes preserving an existing POS session and preserving another manager's idle back-office session after a failed sign-in.

M-6 checks the cookie and CSRF token, validates the password-only body, resolves the session before verification, and obtains the account from that resolution. Active and idle sessions use the same renewal path. Renewal rotates the token on the same row without restarting the absolute lifetime; a null renewal clears the cookie and does not create a session. These paths satisfy the reviewed API portion of FR-A2b, ADR-009 section 6, and AC-35.

Strict schemas reject malformed PINs and extra fields before counting. Password schemas leave credential policy to the domain. Failed credentials share one response, while the failure starting a cooldown and an already-running cooldown retain their distinct codes and typed retry detail. The tests exercise the existing handler's details path through actual routes.

Cookie audience selection, cookie attributes, CSRF rotation, throttle isolation, client-instance replacement, and rebuilt-server refusals are covered at the API level. The identity reader uses one parameterized SELECT without a clock and replaces database exceptions with a fixed error. Successful views return stored identity fields, with no username in POS views. The changed routes add no audit or security-event writer, no approval state, and no credential logging. B-11 through B-14 remain respected within this task's scope.
