# PHASE0-012b review

## Verdict

**findings** — Three findings in the AC-18 scan. The browser cases otherwise follow the dispatched scope. This review compares `agent/phase0-012b` at `34933009f4737fc51950a32ef7491b589c925ee9` with `development` at `33eb9104f281b0d83314bb48a5bc0f9c1f254c24`.

## Findings

### F1 — P1: A scan failure can print the credential it detected

**Location:** `e2e/support/scan.ts:96`, propagated into an exception by `e2e/support/fixtures.ts:267`.

The diagnostic interpolates the rejected request's pathname. If a regression sends a password both in a diagnostic request body and in that request's path, the scanner detects the leak and then copies the password into its own error message. This breaks **B-12** and the task's **Lead ruling 6**, which explicitly requires the scan to report only credential kind and place, never the value. Random throwaway credentials do not exempt the harness from that rule.

I executed the unmodified scanner in memory with a generated password, its legitimate sign-in request, and an additional request whose body and path contained that password. The diagnostic contained the password; only the boolean result was printed. Replacing this diagnostic with a constant place description in memory preserved detection and removed the credential from the output.

**Proposed fix:** Report a fixed description such as “a password in a request body outside its credential route.” Do not interpolate request-derived URLs or paths. Add a focused check that a credential-bearing path produces a failure without putting the credential in any diagnostic.

### F2 — P2: Credential-route matching ignores the method and origin

**Location:** `e2e/support/scan.ts:16` and `e2e/support/scan.ts:95`.

The scanner accepts a request body solely by its URL pathname. `Sent` omits the method even though the fixture collects it, and `pathOf` discards the origin. A `PUT` to the back-office login pathname, or a request to the same pathname on another origin, is counted as an allowed credential submission. The positive body-count helper also counts it. This does not meet the task's **Lead ruling 5**, which permits credentials only in the named **POST** credential routes, or its one-origin constraint under **ADR-010** and the copied 012a rules.

I supplied each of those requests separately to the unmodified scanner with one expected password submission and no other leak. Both returned zero problems. These were isolated scanner checks; I did not demonstrate a green full browser suite with either product mutation. The signed-out A1 premise does not itself exercise credential submissions in the other tests.

**Proposed fix:** Carry the request method into `Sent` and require the complete allowed combination of harness origin, `POST`, and pathname. Reject other combinations with a fixed diagnostic. Cover wrong-method and wrong-origin evidence as well as an allowed submission.

### F3 — P2: Earlier page URLs are missing from the scan

**Location:** `e2e/support/fixtures.ts:168`–`173`.

The URL evidence consists of network request URLs and each still-open page's URL at teardown. No page-navigation history is collected. A client regression that puts a credential in a same-document URL using `history.replaceState`, then restores the clean URL before teardown, leaves neither a network request nor a final URL for the scanner to inspect. This misses the task's copied **question 5, AC-18 row**, which requires checking “every page URL visited,” and **Lead ruling 5**, which forbids credentials in any page URL.

This conclusion follows from the collector and its subscriptions. An in-memory execution of the extracted, unchanged collector with a clean final page URL and the legitimate sign-in request returned evidence that the scanner accepted. That check models the evidence left after such a transition; it is not a browser reproduction of the navigation.

**Proposed fix:** Record visited page URLs from page creation onward, including same-document changes, and retain them until the scan completes, including for pages subsequently closed. Add a red proof that places a credential in a same-document URL and restores the original URL before teardown.

## What I ran and what I did not

**Observed:** `npm run verify` passed, including `tsc -p e2e`: **93 test files and 3,744 tests passed**, equal to the task's baseline. Vitest reported **66.39 seconds**. It emitted the existing Vite configuration-loader warning, without failing verification.

The branch and development commit IDs above were identical before and after verification. `git diff --stat` was empty before and after the green run, and `git status --short --branch` showed only the branch header. The reviewed tree was stable. The report was written afterwards.

`git diff --check development...agent/phase0-012b` passed. The prohibited-pattern and literal-limit searches returned no matches. A credential-value check over `e2e/`, excluding `node_modules` and `test-results`, reported no hits for `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `PIN_PEPPER`, `POS_APP_PASSWORD`, or `POS_OWNER_PASSWORD`; no values were printed.

I ran the isolated in-memory scanner and collector checks described in F1–F3 using the local TypeScript compiler. Only F1's proposed diagnostic replacement was mutated, in memory. No source or test file was edited.

**Not independently run:** The browser suite, the builder's source-mutation red proofs, Safari, and browser-run temporary-directory cleanup. The task's **Lead verify** section explicitly supplies browser evidence for this reviewer: the lead reports 50 passing cases in 41.7 seconds, and the builder reports two consecutive 50-case passes in 43.2 and 41.4 seconds. Those are attributed evidence, not my runs. The task also records the lead's acceptance of the substituted B2 and B6/B7 red proofs. I did not repeat or independently validate those mutations.

## Cleared

- B1 and B2 drive wrong PINs through the real pad, inspect envelope codes and cooldown metadata, and check installation-wide refusal after clearing `rpos_cid`. The correct-PIN probe during cooldown is justified by the disabled pad. The security-versus-audit assertions address AC-18 and FR-A5 directly.
- B3–B5 use a manager to avoid confusing role refusal with audience refusal, exercise both directions, and reload the surviving surface after release/logout responses. Their coverage matches the browser portion of AC-27.
- B6–B8 use server-side relative ageing and the clients' deadline reads. The divergent idle presentation and zero-activity assertions address AC-28. Limits come from the policy; the task explicitly specifies the deliberately unequal first clock shifts in B8 to provoke an active deadline read.
- B9 and B10 reach M-6 through real sign-in and timeout paths. I specifically checked the working area shared across signed-in, idle, and signed-out states: the tests distinguish same-manager preservation, other-manager replacement, and discard removal. This checks the Phase 0 portion of FR-A2b, AC-35, ADR-009 section 6, and the 2026-10-14 destroyed-draft ruling without claiming a real form exists.
- B11 exercises the shared-cookie actor change through the production activity/CSRF/read path. Its pinned `invalidated` state agrees with the core's actor comparison and POS store mapping. Its request count and name observer address B-13 without claiming to remove the accepted cross-tab cookie risk.
- Every new spec has its positive credential-body check. The original premises are unchanged. Schema reset, domain-created people, audit/security read-only inspection, disabled trace/video/screenshots, and the absence of approval-prompt interaction preserve the task's other boundary constraints. The Handoff carries forward the explicitly deferred Phase 1 and Phase 2 work.
