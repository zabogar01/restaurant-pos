# PHASE0-004 review

## Verdict

**clean** — Round 2 closes both findings; no new findings. See the Re-review section for current evidence and the standalone-run limitation. The original review below is retained as history: it found two issues at `dc9bbe46cd76b22865857415dc1c71ebc64c3d03` against `development` at `2ee22857e0608a2b528348e9117e86993d0f7a2e`.

## Findings from Round 1 (both closed in Round 2)

### 1. High: the shared PIN guard permits a runtime number to reach an error that exposes the PIN

**Location:** `apps/server/src/domain/pin.ts:19`, with the exposed error originating at `apps/server/src/domain/pin.ts:44` and escaping through `apps/server/src/domain/pin.ts:86`.

`RegExp.test` coerces its argument, so the numeric value `123456` passes `isPin`. `pinLookup` then passes that number to `Hmac.update`, whose `TypeError` includes the numeric input. `findUserByPin` also exposes this error because lookup happens before its database-error handler. I reproduced both calls against the unchanged module and checked that each error message contains the supplied numeric PIN. The string annotation provides no runtime protection; a numeric value arriving through JavaScript or parsed JSON still takes this path. No HTTP route exists in this task, so this is a demonstrated domain-function leak, not a claim of an existing remotely reachable endpoint.

This violates **B-12**, **ARCHITECTURE §7.3 and §12**, and the task's objective and “What changes from the plan” point 4, which prohibit PINs in errors leaving these functions. The plan's `assertValidPinFormat` explicitly checks `typeof pin === 'string'` at `docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1222`; that protection was dropped. This is the shared-value check across states: valid strings are safe, but a six-digit number passes the same predicate and reaches a different, unsafe error path.

**Proposed fix:** reject non-string values before regex evaluation, preferably with an `unknown`-accepting type guard. Keep the fixed format error for throwing helpers and return `null`/`false` from lookup/verification rejection paths as specified. Add regression coverage for numeric runtime inputs, including inspection of all exposed error properties, so database-only sanitization cannot hide this case.

### 2. Medium: the exported domain API does not preserve the task's starting contract

**Location:** `apps/server/src/domain/pin.ts:23`, `apps/server/src/domain/pin.ts:32`, and `apps/server/src/domain/pin.ts:51`.

The implementation makes the format assertion private under a different name, reverses `verifyPin` to `(encoded, pin)`, and changes `createStaffUser` from `Promise<{ id: string }>` to `Promise<string>`. The task's **Required inputs**, first item (`.agent/tasks/PHASE0-004-pin-hashing-and-lookup.md:33`), retains the plan's six functions and names and lists the superseding differences. Those differences do not authorize these API changes. The explicit contract is at `docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1063`, with implementations at lines 1221, 1233, and 1256.

I observed that `assertValidPinFormat` is absent from the module exports. I also generated a real hash with `hashPin` and called `verifyPin(pin, hash)` as documented: it returned `false`, while the reversed call returned `true`. Both arguments are strings, so TypeScript will not catch a consumer using the documented order. A bootstrap consumer following the plan's `const { id } = await createStaffUser(...)` would also receive the wrong return shape; that consequence is established by source inspection, not by a separate database probe. The new tests consistently use the changed interfaces, so their green result does not establish compatibility with the specified consumers.

**Proposed fix:** export `assertValidPinFormat`, preserve the public `(pin, hash)` verification order, and return `{ id }` from creation. Update the tests and internal call accordingly, retaining the explicitly required `credentialVersion` addition to `findUserByPin`.

## What I ran and what I did not

- **Observed:** `npm run verify` passed typechecking and **47 test files / 2,772 tests**, matching the task's aggregate baseline plus 14 PIN tests. The Vite CommonJS/ESM warning remains. The output gave aggregate counts, so I did not independently measure a separate client-project count.
- **Observed:** before and after that green run, `git diff --stat` was empty, the branch and baseline hashes above were unchanged, and the branch diff remained **8 files changed, 792 insertions, 10 deletions**. `git status --short --branch` showed a clean `agent/phase0-004`. The reviewed tree was stable.
- **Observed:** the requested standalone `npx vitest run apps/server/test/pin.test.ts` failed during setup with `connect EPERM 127.0.0.1:5433`; it also printed “No test files found.” The equivalent `npm run test:unit -- apps/server/test/pin.test.ts` hit the same connection restriction. Neither was a successful standalone test run or a test assertion failure. The full verify run above did succeed.
- **Observed:** read-only `node --import tsx --input-type=module -e` probes confirmed safe import with `PIN_PEPPER` unset, an error naming that variable when lookup is used, the missing assertion export, the verification argument-order mismatch, and the numeric-input leak. Numeric inputs to `hashPin` and `createStaffUser` produced native errors rather than the required format error; their observed messages did not contain the numeric PIN. Trailing newline and carriage-return strings were rejected with the fixed format error.
- **Observed:** `rg -n 'apppassword|devpassword|postgres://' apps/server/src` returned no matches. The branch diff changes no existing test file, migration, client file, or Vitest configuration; it adds the PIN tests and changes the test environment helper.
- **Not run:** I did not rerun the builder's six mutation proofs, run browser or endpoint tests, or test Linux binaries. There is no built screen or API route in this task. The mutation outcomes in the Handoff remain builder-reported evidence. I did not call Context7 or obtain a new librarian answer; the Handoff contains the builder's librarian summary. Its stated package version is 2.2.1, whereas the reviewed manifest and lockfile specify 2.2.2.

## Cleared

The implementation explicitly selects Argon2id with memory/time/parallelism 19456/2/1. The added suite covers encoded parameters, matching and nonmatching PINs, salt variation, malformed hashes, and ASCII PIN examples. HMAC-SHA256 derives the lookup index from a pepper read on every call, with no source default or PostgreSQL parameter carrying the pepper. The tests exercise changed, missing, and short peppers.

For valid string inputs, creation validates the name and role before SQL, stores the hash and digest, relies on the existing unique index through `ON CONFLICT DO NOTHING`, and replaces database exceptions with a fixed error without a cause. The forced check-violation test exercises actual PostgreSQL error sanitization. Lookup filters inactive users, verifies the selected row's hash instead of trusting the digest, and returns its ID, role, and credential version from one SELECT. The planted mismatched row and changed credential-version tests cover those distinct states.

The domain code uses the application pool; fixture changes and schema resets use the owner connection. No audit writer, session behavior, throttle, migration change, or deactivated-PIN reuse policy was introduced. Those remain outside this task's scope. Only this review report was intentionally written; no source, test, task, or memory file was edited, and no commit or push was made.

## Re-review — Round 2

### Verdict

**clean** — both accepted findings are closed, with no new findings in the fix. Reviewed the implementation at `56779f6`. The checked-out HEAD was `51c33c66b65ca57df2e493118c53c6efb3286c9e`; its only change after `56779f6` is the task's status from `active` to `review`. I inspected the fix diff and the full branch changes against the unchanged `development` baseline, plus the task's Round 2 rulings and Handoff.

### Findings and closure evidence

**Finding 1 is closed.** At `apps/server/src/domain/pin.ts:22`, the shared predicate checks the runtime type before applying the regex. The four throwing functions use the fixed format error; verification and lookup return `false` and `null`. This satisfies Round 2 ruling 1 and closes the demonstrated B-12 leak. The eight new tests at `apps/server/test/pin.test.ts:212` cover the required number, null, undefined, and coercible object across all six functions, including inspection of error properties. Independent probes also exercised an object whose coercion throws, an array, a boolean, and a symbol. All were rejected safely without invoking object coercion. These probes ran with the pepper unset, confirming rejection occurs before configuration or database access.

**Finding 2 is closed.** `assertValidPinFormat` is exported at `apps/server/src/domain/pin.ts:26`; `verifyPin(pin, encoded)` has the required order at line 35; creation returns `{ id }` at line 77. The internal verification call at line 103 and all test call sites use that order. A direct probe verified a real matching hash using the documented API and rejected a different PIN. The database tests destructure the creation result and use its ID to read the stored row. These changes satisfy Round 2 ruling 2 and the plan's interface contract at line 1063. The same-row `credentialVersion` return is preserved.

The Handoff now identifies `^2.2.2`, consistent with the manifest and lockfile, satisfying Round 2 ruling 3. The shared guard was checked across valid string, malformed string, and non-string states; the fix neither coerces invalid values nor prevents valid PIN verification.

### What I ran and what I did not

- **Observed:** `npm run verify` passed typechecking and **47 test files / 2,780 tests**. This is eight more tests than Round 1. The existing Vite configuration warning remains.
- **Observed:** before and after the green run, `git diff --stat` was empty, HEAD and `development` hashes were unchanged, and the branch diff remained **9 files changed, 913 insertions, 10 deletions**. The reviewed implementation was stable. Report and Handoff updates were made afterward.
- **Observed:** the read-only Node probes described above passed. The call-site search found the corrected public argument order throughout server source and tests. The credential-default search returned no matches.
- **Observed limitation:** `npx vitest run apps/server/test/pin.test.ts` could not complete setup because connecting to `127.0.0.1:5433` returned `EPERM`. It also printed “No test files found.” I do not count this as a standalone pass or an assertion failure. The full verification run did pass; the builder separately reports 22 standalone PIN tests passing.
- **Not run:** I did not repeat the builder's mutation run removing the type check, or the original six mutation proofs. Their reported failures remain builder evidence. No browser, endpoint, or cross-platform binary testing was performed; the fix introduces no screen, route, or dependency change.

### Cleared and handoff

The fix changes only the shared runtime guard, the exported contract, its callers, and the corresponding tests. Argon2id parameters, per-call pepper lookup, duplicate handling, database-error sanitization, inactive-user rejection, mismatched-hash rejection, and same-row credential-version selection remain intact and covered by the passing suite. No new boundary violation was found in the changed paths.

Both findings are ready for the lead's disposition. At the user's explicit request, I appended this re-review's outcome to the task's Handoff; no other task content, source, tests, or memory files were changed. No commit or push was made.

DONE
