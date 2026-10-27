# PHASE1-S4c2b review

## Verdict

**findings — three findings: one P2 and two P3.** Reviewed `agent/phase1-s4c2b` at `01789fee808266cf3a1f8afb8789bce88b1f818c` against `development` at `95193c1db994b166cec7a3c3cc580e3be9982bf8`, the task's rulings and acceptance criteria, its cited predecessor and DESIGN-020 handoffs, the Frost artifact, the contract schemas, and the cited requirements and boundaries. F1 is the correction already identified by the lead, independently confirmed here.

## Findings

### F1 — P2: A pending-removal row identifies the draft name instead of the saved name

**Location:** `apps/back-office/src/item/OptionSections.tsx:147` (also the Undo accessible name at line 160).

`Removed` uses the saved name only when the draft name is blank. Renaming the saved variant Large to Grande and then removing it produces a collapsed row named Grande and an Undo named “Undo removal of variant Grande”. The saved option being removed is Large. The ordinary removal test never renames the row first, so it hides this difference between the editable and pending-removal states.

**Authority:** `docs/DESIGN.md:1941`, the Names and labels rule; PHASE1-S4c2b lead ruling 5; and its *Rulings on the Handoff's findings*, ruling 1. The latter explicitly overturns the artifact's draft-name behavior and reserves this correction for round 2.

**Observed evidence:** A file-free Node probe invoked the actual model's rename and remove methods, then rendered the actual `OptionSection` with React's server renderer. It returned `saved: "Large"`, `shown: "Grande"`, and `undo: "Undo removal of variant Grande"`.

**Proposed fix:** Use the matching row in `form.original` for both the collapsed name and Undo's accessible name. Keep the draft name on the draft row so Undo still restores the manager's edits. Add the lead's rename-then-remove regression for both option kinds, including restoration of the draft name on Undo.

### F2 — P3: Editing the refused row clears a duplicate that still exists

**Location:** `apps/back-office/src/item/model.ts:834`.

`setOptionName` removes the edited row's name refusal before calling the list's `recheck`. Since `recheck` only clears existing refusals and never adds one, it cannot retain that row's duplicate error when the new text is still a duplicate. For example, make the second variant Large, press Save to receive the duplicate refusal, then change that same field to large. The two active names are still equal under the required case-insensitive comparison, but the error disappears and Save becomes enabled. Pressing Save would validate again; this is misleading error recovery, not evidence that a duplicate reaches the server.

**Authority:** PHASE1-S4c2b lead ruling 3 and acceptance criterion 3; DESIGN-020 round 2 F4; `docs/DESIGN.md:1951`. A duplicate refusal belongs to the list, and a name edit clears only duplicate refusals that no longer hold. The artifact also clears the edited field before rechecking (`item-editor.js:233`); that does not implement the stated F4 rule for this case.

**Observed evidence:** The file-free model probe first returned a `duplicate` error on the second row. After a case-only edit, it returned `errors: {}`, `saveHeld: false`, and `names: ["Large", "large"]`. Existing F4 tests cover changing or removing the other holder and introducing a new conflict, but do not cover editing the refused row while preserving its conflict.

**Proposed fix:** Continue clearing ordinary field refusals on edit, but pass an existing duplicate refusal through the list recheck. Clear it only when the edited name no longer conflicts with any other active row. Add cases for case-only edits, surrounding whitespace, changing to a different occupied name, and changing to a genuinely unique name. Preserve the rule that a previously unrefused row receives no new error before Save.

### F3 — P3: Pending option inputs use the prohibited native disabled state

**Location:** `apps/back-office/src/item/OptionSections.tsx:215` and `:239`; the contrary assertion is at `apps/back-office/test/item-options.test.tsx:239`.

Both option inputs use `disabled={pending}`, while the option buttons use the required `aria-disabled` and `tabIndex` convention. During a held save, the inputs therefore have native `disabled`, no `aria-disabled`, and no explicit `tabindex`. The new pending-state test explicitly expects native disabling, so the green suite preserves this task-rule mismatch.

**Authority:** PHASE1-S4c2b *Rules*, lines 301–303: “Use `aria-disabled` and `tabIndex={-1}` on inert controls, never `disabled`.” Lead ruling 5 additionally requires every field and option control to remain inert during a save.

**Observed evidence:** Rendering the actual section with a save held returned `disabled: true`, `ariaDisabled: null`, and `tabIndex: null` for each option input. The model's name and change setters do guard against a pending command; the defect is the specified presentation convention, not an observed concurrent write.

**Proposed fix:** Apply the required ARIA and tab-order state to both inputs and preserve their inability to change during a save, using read-only behavior and the model guards. Replace the native-disabled assertion with assertions for the required attributes and unchanged draft values after attempted input.

## What I ran and what I did not

- **`npm run verify` passed:** typecheck completed, then **141 test files and 5,174 tests passed**, exit code 0. The reported Vitest duration was 111.18 seconds. This is my run, not the builder's or lead's reported result.
- **Tree stability:** before that run, `git diff --stat` was empty, and HEAD/development were the hashes recorded above. After the green run, `git diff --stat` and `git status --short` were again empty, and both hashes were unchanged. The branch comparison contained 18 files, 2,921 insertions and 82 deletions. The review report was created only after these checks.
- **Client verification:** the separately started `npm run test:unit -- --project=client` passed **106 files and 4,336 tests**. While the original runners had not yet returned results, I also tried the thread pool: the client-only run passed the same **106 files and 4,336 tests**, and the targeted `item-keep.test.ts` run passed **13 tests**. The full thread-pool attempt failed during server setup with `connect EPERM 127.0.0.1:5433`; it produced no completed test count. These diagnostic attempts do not replace the successful ordinary verify run.
- **`npm run test:e2e:all` did not pass:** both production client builds succeeded, but Playwright setup failed with `connect EPERM 127.0.0.1:5433`. No browser cases completed in my attempt. The task records earlier 98-pass runs by the builder and lead; I did not independently reproduce that result.
- **Additional evidence:** the file-free probe used the actual model and actual `OptionSection`, a stub catalog and held update, jsdom, and React server rendering. It produced the three outputs described above. It was not a real-browser interaction test or a code mutation. An initial direct model import failed because Node had no `window`; the successful probe supplied jsdom before importing the model. I edited no source or test file and ran no mutation experiment.
- **Layout limitation:** I inspected the artifact markup, state definitions, behavior and CSS, and the production CSS diff. I did not visually inspect the served screen or prove geometry at either viewport. The jsdom overflow test proves row construction and control attributes, not visual reachability of all 36 rows. The owner's served-layout check remains outstanding.

## Cleared

- The two lists filter inactive options, sort by stored display order, number only active draft rows, and use separate name and price rules. Names count code points; case folding does not fold accents. Variant changes remain signed, modifier changes remain nonnegative, and cross-list names may coincide. This matches FR-B4 and FR-C1–FR-C4 within this slice.
- The preview parses canonical strings and adds with BigInt, floors at zero, and distinguishes the invalid and over-maximum cases. The over-maximum value is a note under DESIGN-020 question 2's explicit ruling. No new floating-point money path was found (B-1). The preview does not claim to include modifiers or implement the future order snapshot required by AC-26.
- Create and edit bodies are built through pure helpers and checked against the shared schemas. Edits send changed fields and explicit option operations; ordinary edits do not replace lists, and previews and bookkeeping flags do not enter the request. Both lists travel in one command. The removal copy preserves the distinction between deactivating an option and historical order snapshots (B-8, FR-C8); no order-storage code changes here. No new partial-save path was found in the client (B-20).
- Keep uses the shared `touched` helper, retains touched rows whole, follows current values for untouched rows, applies the ruled order policy, and creates a fresh identity for a changed option removed meanwhile. Use current replaces both lists. The exercised F1–F3 and 4(b) walks pass, and the rebuild itself sends nothing. The lead has already ruled that moved flags persist after Keep and that removing an entire list may omit an empty `order`; neither is reopened here.
- The existing item-screen assertions were expanded for the new lists without weakening their former checks. Browser cases I1–I3 are unchanged; the new I4–I6 cases drive the actual Menu openers and page requests, then inspect domain results. Client screen tests also mount the real `Screens` and open BO-04 through Menu. I found no substitution of a test-only navigation path for the production opener.
- The required shared-state check covered the row name across editable/removal states (F1), the same duplicate refusal across successive edits (F2), and the pending flag across fields and buttons (F3). No source, test, task, or memory file was edited, and no commit or push was made.
