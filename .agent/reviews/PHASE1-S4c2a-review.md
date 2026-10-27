# PHASE1-S4c2a review

## Verdict: findings

Reviewed `agent/phase1-s4c2a` at `54a6cc0a0e133dfed95cff9ba3c225a713e01a80` against `development` at `826a401fff923fe69b843cf55809a97184632103`, the task and its later rulings, the cited handoffs, DESIGN-020, and the cited requirements and boundaries. There are two findings. No source or test file was changed.

## Findings

### F1 — P2: A saved item can return to a category Menu cannot render, consuming its focus request

**Location:** `apps/back-office/src/menu/model.ts:1055`, with the return-focus resolver at `apps/back-office/src/menu/Menu.tsx:195` and `:209`.

`receiveItem` applies the answered item without making its destination category available to Menu. BO-04 reads independently, so its category choices can include a category absent from BO-03's earlier snapshot. Menu's `groups` function renders items only inside known categories. On return, the saved item is therefore missing from the rendered groups until the visit read finishes. The focus effect consumes the request immediately and falls back to New category when the item's Edit is absent. A subsequent successful read does not issue another focus request.

**Failing scenario:** Menu reads version 5 with category A. Another manager creates category B. Open an item from A: BO-04 reads version 6, including B. Choose B and save successfully at version 7. Hold Menu's return visit read. Menu announces the save but has only A in its categories and the saved item assigned to B; no group contains that item. When the read eventually supplies B, the row can appear, but the consumed focus request is not retried. The same case is possible when creating an item and choosing a newly read category.

**Authority:** PHASE1-S4c2a ruling 9 and acceptance criteria 7 and 8 require the saved return on the item's row with its Edit focused. DESIGN-020's “Where Save lands” and “Focus” tables carry the same requirement. The task's suggested `categories: []` adapter is insufficient for this case; the lead should adjust that detail along with the fix.

**Evidence:** I executed the unchanged Menu and Item models in memory through their normal opener, own read, category change, save answer, and Menu arrival methods. The resulting state contained one saved item but zero items in the output of the production `groups` function, with the visit read pending and the saved result and item focus request staged. The fallback and its failure to retry are established by the focus effect's source; I did not observe focus in a browser.

**Proposed fix:** Carry enough authoritative category information from BO-04's read to host an answered item whose category Menu does not know, preserving the existing version and read-reconciliation rules. Alternatively, defer the saved-row focus until the visit read makes that row renderable, with an explicit recovery path if that read fails. Do not consume the request merely because the target is temporarily absent. Add a screen test with different category sets in the two initial reads and a delayed return read; assert that the saved row is available and its Edit receives focus.

### F2 — P2: A duplicate-name reread presents its holder behind a closed gate

**Location:** `apps/back-office/src/item/model.ts:534`, especially the callback at `:535` and `showHolder` at `:553`.

The duplicate branch starts a detached reread and calls `showHolder` when it completes, checking only that the model has not stopped and the read succeeded. `showHolder` checks form identity and the duplicate error, but neither the session gate nor the departure decision. Setting `reread: true` immediately exposes the holder line and its View item on Menu link through `holderOf`; a holder in an archived category also changes the error copy. Unlike the stale and unknown branches, this finished result is not held until presentation is permitted.

**Failing scenario:** Rename Burger to an existing name. The save returns `DUPLICATE` and starts its catalog reread. Before that read settles, M-6 opens, or the manager presses Cancel and leaves the departure decision open. Deliver the reread containing the name holder. The holder result appears behind the gate or decision, instead of waiting for the same manager to resume or press Stay.

**Authority:** PHASE1-S4c2a ruling 5 explicitly includes `DUPLICATE` among the asynchronous rereads that must recheck the session gate and open decision, hold the finished result with its read, and present it once on return without repeating either request. Ruling 18 supplies the session and departure behavior. This is a presentation-rule defect, not evidence of a server write or a different manager receiving the draft.

**Evidence:** In two executions of the unchanged Item model, I held the duplicate reread after the initial refusal. With `setGate(false)`, completing it changed `form.reread` to true and made `holderOf` return the holder. In the second execution, completing it while `decision === true` likewise exposed the holder. Each execution made exactly two catalog reads: the opening read and the duplicate reread. The rendered consequence follows directly from `ItemEditor.tsx:305` and `:391`.

**Proposed fix:** Hold the duplicate reread's finished presentation through the same gate-and-decision mechanism as the other results. Preserve its read and form identity, drop it if the draft was discarded or the duplicate error was cleared, and expose it once after resume or Stay without another read. Add held-reread tests for M-6, BO-01, and the departure decision, including Discard.

## What I ran and what I did not

- `npm run verify` completed successfully: typechecking passed; **138 test files and 5,028 tests passed**. Vitest reported 98.59 seconds. This is my run, not the builder's or lead's result.
- `npm run test:unit -- --project=client` also passed: **103 files and 4,190 tests**. I started it while the full run had not yet produced its test summary.
- `git diff --stat development` was identical before and after the green verification run, and again after the reproductions: **25 files changed, 4,563 insertions, 83 deletions**. The working tree was clean before this report. `git diff --check development` passed. No implementation mutation was made.
- `npm run test:e2e:all` built both clients successfully, then exited before running browser tests because its setup received `connect EPERM 127.0.0.1:5433`. I therefore have no independent browser pass count. The task records the lead's 92 passing browser cases; that remains separate evidence.
- A separate attempt to inspect the built editor with Chromium and in-memory API fixtures failed at browser launch with a macOS sandbox permission error. No screenshot or visual layout inspection was obtained. Docker socket inspection was also denied. These restrictions did not prevent the full unit verification run above from completing.
- The two findings were reproduced at model level using the repository's unchanged TypeScript modules transpiled in memory, controlled responses, and deferred read promises. The DOM focus consequence in F1 is inferred from the production rendering and focus code. An additional attempt to mount the existing screen harness outside Vitest failed in the ad hoc loader and supplies no evidence. I did not rerun the builder's mutations, and I claim none of its recorded red proofs as my own.

## Cleared

The price helper stays on strings and BigInt for all three field kinds, preserves refused text, and uses the existing exact formatter. The boundary and contract-pair tests cover signs, grouping, bounds, and code-point name lengths. This is consistent with B-1 and FR-M1; the item bodies carry canonical integer strings.

Create omits a version and supplies empty option arrays. Update carries the version BO-04 read, sends only changed item fields, and leaves variants and modifiers absent from the change list. Clean Save still sends an empty change list. Stale and unknown results do not silently rebase or automatically resend. Keep and Use current follow the task's later rulings, including the corrected archived-destination behavior. The one-command restriction also covers a save discarded on the way back to Menu.

The screen subject is client state, is cleared on departure, and never enters the address. Menu remains the current rail entry. Existing tests reach the editor through the real `Screens` composition and Menu openers; the new browser spec uses the production navigation and page requests rather than a fixture-only editor route. The saved-return category mismatch in F1 is not represented by those tests.

The shared-value check concentrated on Menu's saved-return focus target across existing and newly learned categories, producing F1, and on the duplicate result across normal and gated states, producing F2. The status/context combinations, installation facts, stale comparison, validation copy, and no-subject state otherwise match the scoped design in source. The excluded option-list states and state-command controls remain excluded as ruled. No changed path adds order-history mutation, partial server writes, audit behavior, or hard-coded production catalog data contrary to B-8, B-20, or B-24. Visual geometry and native browser focus remain unverified in this review.
