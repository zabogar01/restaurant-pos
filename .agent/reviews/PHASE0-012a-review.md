# PHASE0-012a re-review

## Verdict: clean

Both previous findings are closed within the lead's Round 3 rulings. No new actionable finding was identified.

Reviewed current HEAD `2f5f01e6aea95a3661018243e71911bb034a3162` against `development` at `66e76e8eaed5ce40ef756a78444143034f425aa1`, concentrating on builder commit `2255290`. The subsequent commit changes task status and records the lead's verification; it changes no implementation. This report supersedes the previous two-finding verdict.

## Findings

None.

## What I ran and what I did not

**Observed directly:**

- `npm run verify` passed, including the harness type-check: **93 test files and 3,744 tests passed**, in **68.62 seconds**. That is three additional tests over the previous review's 3,741.
- Before and after verification, `git diff --stat` was empty, `git status` was clean, and HEAD and development remained the hashes above. The reviewed tree was stable. Only this report was edited afterwards.
- An in-memory check of the actual `applyE2eEnv()` refused both original failing configurations: a shell-renamed development database and a shell-renamed server-test database, with the inherited-environment marker set. A real runner-branch calculation followed by worker re-evaluation succeeded. Retargeting the worker to either original URL-only database was then refused using the carried forbidden names. These checks opened no database connection.
- An in-memory check invoked the actual sign-in helpers with fake page actions that threw credential-bearing errors. It separately failed all six PIN clicks, Continue, the username fill, the password fill and Sign in: **ten failure points checked**. Every result was a fresh error with the expected fixed message, no original cause, and neither the generated PIN nor password in its stack. Each action supplied the 10,000 ms timeout. This checks the helpers' exception handling; it is not a browser-artifact reproduction.
- The prohibited-pattern grep over harness source was empty. A private-value scan reported no occurrence of the development owner password, application password or pepper; no values were printed. Inspection found no credential-entry call outside the two protected helpers.

**Supplied evidence and limits:**

I read the Round 3 Handoff and the lead's Round 3 verification. The builder records the required old-guard mutation producing two failing cases, followed by restoration. The builder also records the three Chromium failure proofs: a disabled Password input, a false assertion after POS sign-in, and a false assertion after back-office sign-in. The recorded scan found no PIN, username or password in captured terminal output or failure artifacts. The builder reports two complete browser runs passing 12 of 12 at 8.7 and 8.2 seconds; the lead independently records two 12-of-12 runs at 10.1 seconds each.

I did not independently rerun those browser proofs, inspect their deleted artifacts, rerun the browser suite, mutate repository source, or repeat the development-server coexistence and temporary-directory cleanup checks. Those remain supplied evidence. I did not commit or push. The task file and its Handoff were left unchanged under the explicit report-only reviewer scope.

## Cleared

**Previous finding 1: environment isolation.** `e2e/support/env.ts:27` now centralizes the harness's forbidden-name policy in `refusedDatabases`. The runner and inherited branches both include the file's and shell's development and server-test names, plus the literal protected names. The runner collects original URL database names before retargeting and carries them to workers. The new cases in `apps/server/test/server-test-env.test.ts:125` cover the two original failures and legitimate worker re-evaluation. This resolves the original shared-marker difference between runner and worker states under PHASE0-012a Round 3 ruling 1 and the task's isolation requirement.

The Handoff explicitly describes the remaining ambiguity: an environment that forges the marker and carried list while naming a custom development database only through the already-retargeted-looking URLs cannot be distinguished from a legitimate worker using those values. The lead expressly accepts that residual at task lines 729–730. This clean verdict does not assert protection against that accepted configuration.

**Previous finding 2: credential-bearing diagnostics.** `e2e/support/people.ts:31` replaces the credential-derived public identities with independently generated names, PINs, usernames and passwords. It still creates staff and manager credentials through the domain functions, retries a PIN collision, and leaves the server-test factory unchanged. This removes the display-name disclosure in failed assertions and snapshots while preserving B-11, B-13 and B-24 and Round 3 ruling 2's factory requirements.

At `e2e/support/fixtures.ts:155` and `:167`, both complete entry sequences are inside catches that replace failures with new errors naming only the step and independent display name. No original message, stack or cause is retained. Per-action timeouts allow the ordinary stuck-action cases to reach those catches before the default test deadline. Together with the supplied Chromium failure scans, this closes the previously identified B-12 diagnostic paths under Round 3 ruling 2. I do not treat tracing being off as proof that Playwright writes no failure artifacts.

**Regression coverage.** The premise tests only change their helper arguments to pass the person object; their assertions and production UI paths remain intact. A1–A6 still address NFR-1, NFR-5 and AC-1's first clause through the served applications. The separate database and port, lock, per-test schema reset, two context shapes, relative session-age helper, certificate handling, CSP enforcement and first-import zod switch retain the behavior cleared in the first review. B-7's prohibition on row-history mutation remains respected. The B1–B11 tests and AC-18 scan remain explicitly deferred to 012b.

DONE
