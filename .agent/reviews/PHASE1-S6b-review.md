# PHASE1-S6b review

## Verdict

**findings** — one high-priority finding. Reviewed `agent/phase1-s6b` at `e8340e0528d6e91e91cafb2b5a0fb554934cb55d` against `development` at `8a35a82dc5a6496bec73ffe84feb5a3e9d77ccaf`. The implementation commit is `583c30b`.

## Findings

### F1 — High (P1): Reconcile records by server version before giving an editor the newer version

**Location:** `apps/back-office/src/presets/model.ts:292`, with the corresponding unconditional replacement at `apps/back-office/src/presets/model.ts:340`.

`readList()` overlays every command record applied after the read started, without retaining or comparing that record's server version. It then adopts the snapshot's version. A read requested earlier can nevertheless take its database snapshot later than the command and include another manager's subsequent edit. The overlay discards that newer value while retaining its newer version. Conversely, when the newer read arrives first, `apply()` replaces its row with the older command answer while leaving the standing version ahead. Both arrival orders let an editor submit stale field values with a current `expectedVersion`.

**Authority:** ADR-012 rule 13 (`docs/decisions/ADR-012-versioned-configuration.md:334`) requires the edit version to represent the values the form was read from and explicitly prevents silently restoring an older value. PHASE1-S6b ruling 9 and DESIGN-022's standing-version rule require the list version to represent its rows. FR-C7 describes the shared counter, but ADR-012 rule 13 is the authority for this back-office failure. Ruling 18's inherited instruction to preserve an answered record against an earlier read needs version-aware reconciliation; client request-start and response-arrival order do not establish database snapshot order.

**Concrete failing scenario, reproduced against the actual model in memory:**

1. The list reads version 12 with an inactive `Staff meal` preset at 10% (`ratePpm: '100000'`).
2. The manager presses Reactivate, then leaves and revisits BO-07 while that command is outstanding. The revisit starts a list read. State commands permit this navigation.
3. Reactivation commits at version 13. Another tab changes the preset to 20% at version 14. The outstanding read takes its snapshot at version 14 and returns that 20% value.
4. Delivering the version-13 command answer before the version-14 read leaves the displayed preset at 10%, with standing and displayed versions both 14. Delivering the read first also leaves the preset at 10% and standing version 14; the displayed latest version additionally regresses to 13.
5. Opening Edit, changing only the name to `Staff lunch`, and saving sends `expectedVersion: 14` with `ratePpm: '100000'` in both cases. If the server remains at version 14, its version check permits overwriting the other tab's 20% without a stale warning or explicit choice.

The observed outgoing request is the evidence; the eventual database overwrite is inferred from the accepted server contract, not claimed as a database reproduction.

**Proposed fix:** retain server-version provenance for applied records and reconcile both reads and command answers against it. Preserve a command record over an older snapshot, but retain the snapshot's record when its version is equal or newer. Similarly, an older command answer must not replace a record already established by a newer full read. Keep the standing version consistent with the retained rows and preserve the existing conservative behavior for skipped versions. Add regression cases for both response orders above, plus the inverse case where an older snapshot must still retain the newer command result. Exercise the revisit through the real rail in the screen tests.

## What I ran and what I did not

- `npm run verify` passed: typechecking completed, **149 test files and 5,445 tests passed**. The reported unit-run duration was 115.02 seconds.
- `npm run test:unit -- --project client` passed: **113 files and 4,555 tests**. An additional run with `--pool threads --maxWorkers 1`, started while the earlier runs were quiet, also passed with the same counts.
- `git diff --check development` passed.
- Before and after the green verification, `git diff --stat development` was identical: **26 files changed, 4,917 insertions, 24 deletions**. HEAD remained `e8340e0`, and `git status --short --branch` showed a clean `agent/phase1-s6b` tree before writing this report.
- I ran a file-free `node --import tsx --input-type=module -e` reproduction importing the actual `createPresetsModel`, with deferred configuration responses. Both arrival orders failed the assertion that the outgoing rate remained `'200000'`: actual was `'100000'`, with `expectedVersion: 14`. The script caught and printed those assertion failures. This was a model-level reproduction, not a browser run or a source mutation. An initial attempt to load the model through the JavaScript REPL was rejected because that context disallows string code generation; the subsequent Node reproduction succeeded.
- I did not rerun the builder's mutation proofs or `npm run test:e2e:all`. The task's lead verification note records **108 browser tests passed in both engines** at `583c30b`; that is supplied evidence, not my run. I inspected P1–P4: the page sends the preset requests, and the shared-version case changes the catalog through the domain.
- I inspected the design artifact's markup, state definitions, behavior and relevant styles, but did not render it or perform a visual review of the served application. The **48-row overflow layout remains unmeasured**, as the Handoff records. Unit tests do not establish layout, native modal behavior or visual quality.

## Cleared

- The route, rail order and current-page marker, five `ConfigApi` additions, and fixture read failure match the task. Existing test changes update the relevant lists and counts without weakening unrelated assertions.
- The name, percentage and amount paths reuse the prescribed checks. Code-point length, silent acceptance of zero, exact string/BigInt conversion, selected-kind-only validation, separate typed buffers and fixed installation facts match B-1, FR-M5 and the task's rulings.
- Active/inactive grouping preserves server creation order. The ordinary skipped-version and plus-one cases, explicit stale choices, inactive editing, duplicate-holder recovery and no automatic resend are covered by the implementation and passing tests. These cases do not cover F1's overlapping read and successful command.
- I checked the shared command slot and Save control across pending, discarded-pending, stale, unknown and retry states. Openers remain guarded while pending, stale Save requires a choice, and asynchronous outcome presentation rechecks the session and departure gates. The real frame/session harness exercises draft retention, destruction for another manager and held-result presentation.
- The drawn and implemented controls stay within B-21, B-22 and FR-F2: no scheduling, stacking, approval or POS application control was introduced. Snapshot copy agrees with B-8 and FR-F4/F5; configuration writes make no audit claim. The deferred incident and BO-01 sentences follow ruling 21.
- The lead already records the different-manager focus conflict (Log out versus DESIGN-022's New preset) and the corrected stale-copy expectation in AC 17(b). I have not counted those accepted scope dispositions as new findings. The overflow and visual checks remain outstanding evidence, not cleared by the green suite.
