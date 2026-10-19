# PHASE0-012b review — round 2

## Verdict

**clean** — F1, F2 and F3 are resolved against the task's “Round 2 — the review's three findings” rulings. There are no remaining findings in this re-review.

The reviewed implementation is commit `35b32471b208fae91259eed3fc44bb90f23025b1`. The worktree was at `c932813270a337bf59fcf2c6b8f1fe600e10ae20`; its only change after that implementation commit is the task's lead-verification note. The implementation under `e2e/` is identical. The integration base remains `development` at `33eb9104f281b0d83314bb48a5bc0f9c1f254c24`.

## Findings

None. The previous findings are closed as follows.

**F1 is resolved.** At `e2e/support/scan.ts:112`, rejected request bodies receive a fixed diagnostic rather than a pathname or URL. The other diagnostic locations receive fixed place labels from the collector, and the count diagnostic carries numbers. The two F1 cases in `e2e/tests/scan.spec.ts` check both detection and absence of the generated secret in diagnostics, using boolean assertions that do not print the secret. This satisfies round-2 ruling 1, the original Lead ruling 6, and B-12 for the reviewed diagnostic path.

**F2 is resolved.** At `e2e/support/scan.ts:83`, acceptance requires `POST`, the harness origin, and the credential's permitted pathname. Both the scanner and positive body-count helper use that same predicate. The F2 case covers a valid submission, a wrong method, and a wrong origin, including the positive count when valid and invalid requests occur together. This satisfies round-2 ruling 2 and the original Lead ruling 5.

**F3 is resolved.** At `e2e/support/fixtures.ts:110`, URL history is owned by the profile rather than by the live page. The context binding and init script report the initial URL, wrapped `pushState` and `replaceState` calls, and hash/popstate events. Navigation events provide a second source. At `fixtures.ts:210`, both histories enter the scanner's URL evidence even after a page closes. The F3 case checks both sources for same-document changes and a closed page; the Handoff records the required client-source mutation that changes and immediately restores the URL, failing with only “a PIN in a URL” in both engines. This satisfies round-2 ruling 3 and the task's copied AC-18 scan requirement for visited page URLs.

## What I ran and what I did not

**Independently observed:** `npm run verify` passed, including `tsc -p e2e`: **93 test files and 3,744 tests passed**, unchanged from the baseline. Vitest reported **62.39 seconds**. The Vite configuration-loader warning remained non-fatal.

Before and after that green run, `git diff --stat` was empty and `git status --short --branch` showed only the branch header. HEAD and the development base remained at the hashes above. The tree was stable; this report was rewritten afterwards.

`git diff --check development...HEAD` passed. The prohibited-pattern and literal-limit searches returned no matches. A credential-value check over `e2e/`, excluding `node_modules` and `test-results`, reported no hits for `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `PIN_PEPPER`, `POS_APP_PASSWORD`, or `POS_OWNER_PASSWORD`. No credential values were printed.

I executed the corrected scanner in memory with a generated password. A valid submission produced zero problems and count 1. A credential-bearing path/body produced a problem without repeating the password. Wrong-method and wrong-origin submissions each produced problems and count 0; adding a wrong-method request beside a valid one retained count 1 and still produced a problem.

I also executed the unchanged recorder and collector functions with an in-memory page/context model. Replacing a clean URL with a credential-bearing URL and restoring it retained all three reports. With no pages left open, the collector still passed the historical URL to the scanner, which detected it without putting the password in the diagnostic. This checks the wiring and lifetime of the collected data; it does not establish browser event delivery or timing.

**Attributed browser evidence:** The task's round-2 Lead verify note reports **58 passed in 42.2 seconds** at `35b3247`. The builder's round-2 Handoff reports two consecutive runs of **58 passed in 42.0 and 41.7 seconds**, both engines, and records the F1, F2 and F3 red proofs and their failure messages. The task explicitly supplies these as the reviewer's browser evidence.

I did not independently run the browser suite, reproduce the builder's source mutations, run Safari, or repeat browser-run temporary-directory cleanup. No source files were changed, and no mutation run is claimed for this re-review.

## Cleared

The shared route predicate now distinguishes valid and invalid requests consistently in both rejection diagnostics and positive counts. The shared URL history survives the transitions from a credential-bearing URL to a clean URL and from an open page to a closed page; the final page state no longer hides the earlier value. These were the cross-state checks for this round.

Round 2 leaves the original premises, B1–B11 specs, production code, database code and contracts unchanged. The round-1 clearance therefore remains applicable to real-pad throttling, audience isolation, production deadline reads, same-manager preservation versus other-manager/discard destruction, and the cross-tab actor guard. No approval stand-in is driven, and the deferred portions of AC-19, AC-27, AC-32 and AC-35 remain deferred as the task specifies.

## Handoff

The re-review is complete. F1–F3 are closed, verification is green at the unchanged baseline counts, and browser evidence is explicitly attributed above. Only this report was rewritten; the builder's task Handoff was not edited, in accordance with the instruction to write only the review report. No commit or push was made. The lead retains the merge decision and the required owner review for identity, audit and boundaries.

DONE
