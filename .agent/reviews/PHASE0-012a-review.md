# PHASE0-012a review

## Verdict: findings

Two findings. Reviewed `agent/phase0-012a` at `cbee5bc0ab225454475aadf03a53bd92732c1a0b` against `development` at `66e76e8eaed5ce40ef756a78444143034f425aa1`, the task specification including its Round 2 ruling, and its cited contract. The independent verification run passed all 93 test files and 3,741 tests. That does not clear the two failure paths below.

## Findings

### 1. High: the inherited-environment branch can accept the development database

**Location:** `e2e/support/env.ts:45` (the forbidden-name set at lines 47–50).

The initial environment calculation merges shell overrides, but the `E2E_ENV_APPLIED=1` branch builds its forbidden-name set from `db/dev.env` alone, plus the two default names. It does not reject the shell's `POS_DB_NAME` or `POS_TEST_DB_NAME`. The shared marker therefore selects a weaker check precisely in the state where the function claims to validate an inherited environment. The current test at `apps/server/test/server-test-env.test.ts:100` exercises default names only and hides this difference.

**Authority:** PHASE0-012a rule 1 and its binding “The environment, built in code” section require refusal of the development and server-test databases with shell overrides; ARCHITECTURE §14.4 requires isolated test fixtures. The Handoff's decision 3 explicitly claims that a shell-set marker cannot skip the check.

**Failing scenario:** Set `E2E_ENV_APPLIED=1`, `POS_DB_NAME=custom_development`, `POS_E2E_DB_NAME=custom_development`, and both connection URLs to that database. `applyE2eEnv()` succeeds. I reproduced this in memory without connecting: the result was `guardAccepted: true`, and a constructed `pg.Client` selected `custom_development` as its database. With a valid provisioning connection and credentials, setup subsequently passes that owner connection to `resetE2eDatabase()`, whose reset drops the entire public schema. The database destruction is inferred from the code path; I did not execute it. The same omission applies to a shell-renamed server-test database.

**Proposed fix:** Preserve and enforce the effective forbidden database identities across initial configuration and worker re-evaluation. At minimum, the inherited branch must also reject the shell's development and server-test names; it should use the same validation policy as the initial branch rather than an independently weaker one. Add cases for shell-renamed databases with the marker set, and ensure ordinary worker re-evaluation still succeeds.

### 2. High: disabling traces does not prevent credential-bearing failure diagnostics

**Location:** `e2e/support/fixtures.ts:157`, together with `e2e/playwright.config.ts:18` and `:27`.

The password is passed directly to `locator.fill()` and its exception is allowed to reach the list reporter unchanged. In the installed Playwright 1.64.1 implementation, filling an existing element first records the complete value in an action log (`node_modules/playwright-core/lib/coreBundle.js:21539`), before checking whether the element is enabled and editable. A failed action can carry that log in its error. Tracing, video and screenshot settings do not disable this diagnostic path. Playwright also builds `error-context.md` for test errors independently of those settings (`node_modules/playwright/lib/index.js:705`), copying the error message into it (`node_modules/playwright/lib/errorContext.js:62`).

**Authority:** B-12 forbids PINs and passwords in error messages, stack traces and logs, including test credentials under the task's binding question 9. PHASE0-012a rule 10 and Constraints require that no artifact hold a credential. This is the harness's own diagnostic behavior, not the AC-18 application-log scan deferred to 012b.

**Failing scenario:** In A3 or A4, BO-01 still renders the Password input but a regression leaves it disabled or read-only. The helper reaches `fill(password)`, logs the value while retrying, and fails. The unchanged diagnostic can reach terminal output and the persisted error-context artifact. There is another exposure through fixture identity: `makePeople` embeds the PIN in the person's display name, so a failed name assertion or a failure snapshot after POS sign-in can contain the PIN even without a password-field snapshot. Successful runs and the signed-out A6 screenshots do not exercise these paths.

**Proposed fix:** Give credential-entry operations bounded failure handling that replaces sensitive Playwright diagnostics with fixed messages before they reach reporters, without retaining the original error or cause. Account for automatic failure-context snapshots as well as traces, and keep public fixture names independent of credentials. Prove a deliberately failed password fill and a failure after sign-in leave neither the password nor PIN in terminal output or artifacts. This finding is supported by installed source inspection; the attempted browser reproduction could not launch in this reviewer environment.

## What I ran and what I did not

**Observed directly:**

- `npm run verify` exited successfully. Type-checking included `e2e`; Vitest reported **93 passed test files and 3,741 passed tests**, duration **66.94 seconds**. This is three files and ten tests above the task's development baseline.
- `git diff --stat` was empty before and after that run, and the branch and development hashes remained the values above. The comparison remained 24 files, 1,719 insertions and 12 deletions. The tree was stable during review. This report was added only afterwards.
- The in-memory environment reproduction described in finding 1 succeeded. It constructed connection objects but opened no database connection and changed no file.
- The required source grep over `e2e` found none of the prohibited request APIs, selectors, destructive row statements, process commands, server-reuse settings or enabled tracing. A script read the development credential values privately and reported no occurrence of the owner password, application password or pepper in harness source; the two named password literals also had no hit.
- The contracts deep-import search found only the newly authorized browser subpath and its tests. The server does not import that subpath.

**Not independently executed:**

I did not rerun the browser suite, the builder's source mutations, the development-server coexistence check or temporary-directory cleanup. The task's Round 2 Handoff records successive 12-of-12 runs at 8.4 and 7.6 seconds, a final 12-of-12 run after restoration, and the requested failing zod-import mutation. Its lead-verification section separately records the coexistence check, unchanged development data and cleanup. These are supplied evidence, not my observations.

A standalone, in-memory Chromium probe intended to exercise a disabled password field failed at browser launch, before filling anything. No credential was printed. A separate direct TCP probe to PostgreSQL returned `EPERM`; this does not alter the successful `npm run verify` result actually returned by the verification command. The requested librarian consultation through `ask.sh` failed in both of its configured backends, so library details above were checked against the installed source. I did not run a browser mutation or observe an actual credential-bearing failure artifact, and do not claim otherwise.

## Cleared

The ordinary harness path matches the specified separation: port 8543, a distinct advisory-lock key, an anchored schema reset, domain-created people, serial execution, and fresh contexts closed before the next reset. The server child receives the enumerated environment without an environment file or owner URL. The readiness probe trusts the generated certificate, and setup requires both a successful probe and the child's listening message. The teardown implements termination, fallback killing, temporary-directory removal and lock release.

The A1–A6 specs use the served applications and page-origin requests. A1 checks actual initial session requests in addition to the aggregate origin check, addressing the documented CSP false-positive. A2 checks stored cookie attributes and subsequent non-reissuance. A3 observes both signed-out and signed-in shells without bypassing CSP. A4 reaches activity, release and logout through UI actions. A5 reaches the real PIN pad. A6 checks separate structures and assets and captures screenshots before typing. None of these proofs relies on an injected client session or a test-only screen entry path.

The two profile fixtures create the intended shared-jar and separate-jar shapes. The session-age helper shifts the stored timestamp relatively, scopes by audience and person, and requires exactly one returned row. No idle tests are claimed in this slice. The zod switch follows the explicit Round 2 ruling, runs first in both client entries, and is isolated from the server. The package pin, lockfile, scripts and Vitest exclusion match the task. B-7's row-history prohibition and B-24's test-only data placement are respected in the reset and fixture implementation. The remaining B1–B11 acceptance tests and AC-18 scan are correctly deferred to 012b.
