# PHASE0-003b review

## Verdict

**findings** — Round 2 closes the original high-severity F1. One new low-severity task-compliance finding remains in the regression test's URL fixtures. Verification passes.

Reviewed branch head `50c018533d76a06adebc7f096145756b48377efa` against `development` at `e9d5b9677dc869416754f28d306c92d1fe672a1f`, including fix commit `78480a9`. This round checks the delta since the first review at `1709acab0956eab98319dac4a0702bf95dffaa5b` against the task's Round 2 F1 ruling. The original review also covered ARCH-006 sections 2 and 3 and its PHASE0-003b rules, architecture sections 11 and 14, and B-7. No screen or design artifact changed.

## Findings

### F2. Low: the new test embeds password-bearing connection strings

**Location:** `apps/server/test/server-test-env.test.ts:18`, also lines 19, 33 and 34.

The regression cases introduce four connection-string literals with username `u` and password `p`. PHASE0-003b's **Constraints, second bullet** expressly forbids a credential, password, or connection string with a password in a test file and requires tests to read these from the environment loaded by setup. The values are placeholders; this is not evidence of a usable credential leak. It is nevertheless a direct departure from that task constraint, and the Round 2 ruling did not waive it.

**Concrete failing scenario:** A scan of the new test for `postgres://` returns all four literals. The suite remains green because its assertions only check target selection, not this source constraint. The existing acceptance-6 scan covers runtime source and migrations, so it cannot catch the new test-file violation.

**Proposed fix:** Build these fixture URLs from the connection URLs supplied by the test environment, changing only their database paths to `devdb`, `ownerdb`, or `pos`. Preserve the existing assertions and keep the cases disconnected from PostgreSQL.

## What I ran and what I did not

- **Observed:** `npm run verify` exited 0. Typechecking passed; Vitest reported **45 passed files and 2,737 passed tests**. The previously accepted Vite configuration warning remains.
- **Observed:** `git diff --stat` was empty before and after the green run. The branch and development hashes above were identical on both sides. The only untracked file at the start was this existing review report. The reviewed source tree was stable.
- **Observed:** `env POS_TEST_DB_NAME=pos npx vitest run --project server` exited 1 at configuration load with `POS_TEST_DB_NAME is "pos", which is the development database; refusing to run tests against it`. It did not reach global setup. This is the intended refusal, not a failed test run.
- **Observed:** I executed the four new test bodies in an isolated, in-memory harness using the actual helper source, transpiled TypeScript, a private environment object, and small assertion/stub adapters. All four passed with the current helper. Removing the two guard blocks only in memory made the three rejection cases fail with an expected-exception error; the default case still passed. This was an isolated mutation probe, not a second Vitest run. It opened no database connection and wrote no source or test file. Two initial probe attempts failed while loading the TypeScript API; the corrected probe produced the results stated here.
- **Observed:** The credential-string scan of source, migrations, and tests found exactly the four new fixture literals described in F2. The inspected round-to-round diff contains only the environment helper, its new test, and the task's ruling/Handoff additions.
- **Not independently repeated:** The lead's development-database before/after query, the builder's ten-run sequence, cross-session lock wait, and clean-shell provisioning. The lead reports that `pos` remained untouched. This review proves the refusal occurs before connection setup; it does not claim an independent database-content comparison. The prior targeted migration run was sandbox-blocked, while full verification passed in both review rounds. Post-build ruling 3 continues to carry the accepted partial evidence for acceptance criteria 5 and 7.

## Cleared

**F1 is resolved.** At `apps/server/test/support/env.ts:41–54`, the helper rejects a test name matching `POS_DB_NAME` or either decoded development URL database name. It also rejects names containing URL escapes or delimiters before retargeting. The error identifies the variable and database. Since the root configuration calls this helper while loading, rejection precedes the advisory-lock connection and provisioning. This satisfies the Round 2 F1 ruling and closes the violation of task item 2 and acceptance criterion 4 identified in the first review.

The shared value examined was `POS_TEST_DB_NAME` across its default, development-name, URL-derived-name, and encoded-name states. The new regression assertions distinguish those states, and the in-memory mutation demonstrates their sensitivity. Restoring development URLs within the default-case unit test is appropriate: Vitest has already retargeted worker variables, while this function's production entry point is configuration loading. The live refusal check also exercises that actual entry point.

**What else changed:** The helper additionally restricts test database names to letters, digits and underscores, preventing encoded target aliases. A shell whose development connection URL already names the selected test database now refuses to run, as required by the lead's equality rule. The new file adds four tests; the total rose from 44 files and 2,733 tests to 45 and 2,737. No runtime source, migration, client code, build configuration, provisioning code, or existing test changed in Round 2. The remaining task-file changes document the ruling and builder Handoff. F2 concerns only the newly introduced fixture strings.

The first review's cleared areas remain unchanged: separate application and migration connections; missing-variable errors; application-role restrictions; preserved migration assertions and transaction behavior; serial server files and a session-held cross-run lock; loopback-only Compose binding; and reset-by-schema-recreation rather than audit-row deletion. Actual audit-table privileges and append-only enforcement remain PHASE0-003c work.

## Handoff

Round 2 review is complete. F1 is closed, verification is green, and F2 is the sole remaining finding. The lead should decide the finding and dispatch the small fixture correction if accepted. I updated only this review report, leaving the builder's task Handoff intact under the reviewer ownership rule. No commit or push was made.

DONE
