# FE-036 review

## Verdict

**findings** — two findings, both P2. The ordinary live-order flows work and verification is green, but an invalid fixture target suppresses subsequent live void controls, and the direct-address order-void tests do not prove that the order changes.

Reviewed `agent/fe-036` at `1c8773e63beda224a47b39b208b987a35d058531` against `development` at `60f877e7fc8cecd93bffdfe23e826bf75e7115da`, using `.agent/tasks/FE-036-void-applies.md`, its cited requirements and boundaries, and the cited void-sheet and overflow design blocks.

## Findings

### 1. P2: An invalid fixture target keeps overriding subsequent live void requests

**Location:** `apps/pos/src/OrderPanel.tsx:224`.

`VOID_FIXTURES[view.state]` takes precedence over `voidOpened` before `subjectOf` rejects its target. When the URL names a missing or already-voided Burger, the sheet disappears and the frame becomes usable, but the invalid fixture remains the first choice on every subsequent render. Tapping another fired row or the close bar's **Void order** updates `voidOpened` and still draws nothing.

**Authority:** FE-036 R13 requires the fired-row, close-bar and direct-address paths to read and operate on the live order. Acceptance criterion 14 deliberately makes the no-subject frame usable; criteria 12 and 13 require the live row and order controls to open their respective sheets.

**Observed failing scenario:** Through `PosRoutes`, open Table 2 from the floor, add two Burgers and send them to the kitchen. Change the current address to `/pos/order?state=sheet-voidline` and dispatch `popstate`. The live line IDs are not the fixture's `burger`, so no sheet is drawn and the frame is not inert, as required. Tap either a live fired row or **Void order**. Neither opens a sheet. Two additional tests injected in memory independently reproduced these failures on the unchanged implementation.

**Proposed fix:** Give an explicitly opened target precedence over the address fixture, or discard an invalid fixture before selecting the live target. Add production-route regression tests that continue interacting after a fixture target is rejected. As a diagnostic control, changing only the selection expression in memory to prefer `voidOpened` made both failing tests pass. No source fix was written.

### 2. P2: The direct-address order-void tests inspect a different store and pass when the void does nothing

**Location:** `apps/pos/test/void-apply.test.tsx:574`, particularly the assertion at line 596.

The test creates `out` through `mountStore`, then replaces that probe with `OrderScreen`, which mounts its own store. `out.book` therefore refers to the unmounted probe. Checking that it contains one order says nothing about the order acted on by the displayed sheet, and does not assert a voided status even on that unrelated order. The remaining assertion checks only the landing URL. The changed existing test at `apps/pos/test/void.test.tsx:378` likewise checks only the URL.

**Authority:** FE-036 acceptance criterion 20 explicitly requires both whole-order addresses to void the active order and reject the red case of landing over an unchanged order. R15 requires the standalone wrapper's URL and order status to be asserted. The task's “Tests expected to change” section also explicitly requires the ungated existing test to assert that the order is voided.

**Observed surviving mutation:** A Vite transform changed only the `VoidSheet` whole-order callback in memory so that, when `view.state.startsWith('sheet-voidorder')`, it returned `{ cancels: [] }` without calling `store.voidOrder`. Other states retained the real operation. Both `void-apply.test.tsx` and `void.test.tsx` still passed: **161 tests in two files**. This recreates the task's original navigation-without-mutation defect at the two direct addresses. The transform reported one application; no file was edited.

**Proposed fix:** Exercise both addresses through `PosRoutes` and assert the affected table becomes free and the old order cannot reopen, or use a controlled screen harness exposing the same book that the screen actually mutates. Assert its status is `voided`, then demonstrate that the address-specific no-op mutation fails. Remove the unrelated probe assertion.

## What I ran and what I did not

- Ran `npm run verify` from the worktree root. Typechecking passed; **41 test files and 2,720 tests passed**. The output contained no `Not implemented` line. I did not need to start the database separately.
- Checked stability immediately before and after that green run: `git diff --stat` was empty and both branch hashes above were unchanged. They remained unchanged after the in-memory probes. The working tree was clean before writing this report.
- Ran the address-specific no-op mutation described in finding 2: 161 tests passed in two files.
- Injected two additional production-route tests in memory against the unchanged source: two failed, with 45 existing tests skipped. Applied the target-precedence diagnostic change in memory and reran those probes: two passed, with 45 skipped.
- Read the branch diff, including the existing test changes; traced the pure operations, store update/ref handling, prompt callbacks, floor/history readers and route guard; searched the order-status predicates and their consumers. Compared the three sheet variants and voided row with the cited design and boundaries.

I did not run a browser or visually inspect layout, run physical printing, or validate real server authorization, audit or persistence. I did not independently rerun the builder's reported 21 mutations. The mutation and probe results above are my own observed runs; the other implementation conclusions below combine source inspection with the passing suite. No source, test, task or memory file was changed, and nothing was committed or pushed.

## Cleared

- The pure operations apply the required refusal order, check line eligibility before `voidRule`, preserve the same order on refusal, retain line snapshots and rounds, and return only the fired IDs as `cancels`. The shared gate distinguishes no-fired-work orders from fired-line and fired-order cases.
- The store reads payment and place locks, advances its ref for consecutive void calls, and applies the operation through the functional updater. The terminal guard covers edits, fire, close and discounts. `reachedClosed` excludes voided orders while `noLongerOpen` includes them; the floor/history readers and route guard use the appropriate distinction.
- The live row flow through `PosRoutes` updates the row and totals. Percentage discounts follow the reduced subtotal, fixed discounts cap at the subtotal, and snapshots remain unchanged. Both live whole-order paths return to a free table on the floor using history replacement.
- The manager prompt requires six digits, submits through a parameterless handler with the displayed reason, preserves the sheet on cancellation/refusal, and stores no approval result. The four approval fixture addresses remain routing-only. The client creates no cancellation ticket or audit record and does not gate a transition on printing.
- The existing discount source-test change matches lead ruling B1. The excluded arithmetic/command modules and packages have no diff. The handoff identifies the server obligations and does not claim the deferred server acceptance criteria are satisfied.

The specified out-of-scope payment-lock omissions on ordinary line edits and the settlement session created before the terminal-route redirect remain unchanged. The preserved sheet copy and overflow approval note are covered by task rulings L1/L2; I have not treated those retained fixtures as evidence that printing or auditing occurred.
