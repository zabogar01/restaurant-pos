# DESIGN-009 review — round two

**Reviewer:** Codex, reviewing the Claude round-two corrections and the resulting design artifacts.
**Date:** 2026-09-30.
**Reviewed branch:** `agent/design-009` at `0cbdd302a9e5a25b1eb8c58dbf905e0d00975279`.

## 1. Verdict

**findings** — one medium finding in a parameterized refund-failure fixture. The nine original findings have been addressed by the round-two changes and the explicit owner and lead rulings. Fresh browser measurements could not be rerun in this session; that limitation is described below.

At review time, `development` was `b1d3878e571b0b94c186ef954996f12f82ee274d` and already contained the reviewed branch through merge `b48c92f`. Consequently, `git diff development...agent/design-009` was empty. I inspected the two-endpoint comparison and reviewed the task changes from their original base, `8b10f0b`, including the round-two design commit `03dcf82`. The later FR-H5 and FR-J3 changes on development encode the task's O1–O4 rulings; I used those rulings and current contract wording rather than treating the branch's older PRD wording as permission to contradict them.

## 2. Findings

### F1 — Medium: the shared failure fixture substitutes split-sale allocations on other orders

**Location:** `docs/design/visual-directions/frost/pos/closed.js:99`, with the selected-order handling at line 89 and the Review refund action at line 114.

The `refund-error` initializer replaces the selected order's allocations with Card 80.000 and Cash 75.925 unconditionally. This is coherent for the split-sale fixture, but the same detail accepts an `order` parameter for cash-only, custom-tender and quick-sale orders. A cash-only retry therefore introduces a Card allocation that the order never took. A card-only quick sale acquires a Cash row and an allocation total of 155.925 against its actual 173.250 total. The failure notice nevertheless says the allocation and reason were kept.

**Authority:** The task's owner ruling O1, at `.agent/tasks/DESIGN-009-closed-orders-and-refund.md:302`, limits allocations to the original tender types and forbids adding a row. FR-H5 on current development carries the same rule. Part B requires a failed-command recovery, and round-two ruling F6 requires reviewing the retained allocation after a definite rejection. This finding concerns the walkable design fixture; it is not evidence of a production refund defect.

**Concrete failing scenario observed:** I executed `closed-order.html?state=refund-error&order=cash` in JSDOM, clicked Review refund, then Continue to manager PIN. The modal read: “Refund Table 7, 155.925 — reason: Wrong dish served” and “Money back: Card 80.000 · Cash 75.925 ALLOCATION EDITED.” The ordinary Table 7 path from POS-05 to its refund sheet has only Cash 155.925. Thus the wrong allocation appears specifically when the shared failure initializer is used. The quick-sale failure variant was also executed and showed a 17.325 shortfall and an invented Cash row.

**Proposed fix:** Keep the edited Card/Cash preset specific to the split-sale failure example. Other selected orders must retain an attempted allocation belonging to their original tenders and their own total. If the error fixture is intentionally split-sale-only, make that restriction explicit and prevent an incompatible order parameter from changing its subject. Add a cash-only failure example so a builder can see that recovery preserves the original tender set.

## 3. What I ran and what I did not

### Observed checks

- I ran `npm run verify` myself. Typecheck passed. Vitest reported **32 test files passed and 2,256 tests passed**, with exit code 0. These application checks do not verify the design HTML.
- `git diff --stat` was empty before verification, immediately after the green run, and after the read-only review checks. HEAD and development remained at the hashes above. The reviewed tree did not move. The report is the only file changed by this review.
- I executed the actual fixture scripts in JSDOM across **159 declared states**: POS-05 11, POS-06 26, floor 11, order 58, settlement 34, lock 7 and incidents 12. The crawl completed without execution exceptions. All **347 distinct collected links** resolved to existing files and, where specified, declared states. The two new artifacts' manifest state lists match their declarations.
- `rg -n "prototype/" docs/design/visual-directions/frost/pos` returned no matches, exit code 1.
- The new stylesheet references **84 distinct Frost tokens**, all defined in the registry. It contains no literal pixel lengths, raw color literals or numeric font weights, and none of the three borrowed tokens rejected in round two.
- Targeted DOM checks covered refund absence on zero, refunded and closed-day details, including the zero/refunded failure combinations; AC-25 defaults; required reason selection; exact-sum rejection; approval cancellation preserving the allocation; edited and zero-row allocations in M-1; and successful fixture approval producing the terminal REFUNDED composition with only the nonzero Cash allocation.
- I followed the closed-day list's actual row links. Its new-day quick sale remained refundable and named 26 Sep; all six old-day rows had no Refund action. Apply filter, no match and Reset updated the two groups immediately.
- I checked the after-close receipt floor's free Table 1, the final incident-clear DOM after checking the required kitchen acknowledgment boxes, and reprint preservation of figures and refund exclusion on zero, refunded and closed-day details. The final incident message occurred once, in the revealed `role="status"` empty composition.
- The finding above was reproduced by executing the parameterized fixture and its actual click handlers. No file or source mutation was needed.

### Limits and evidence not rerun

Headless Chrome launch failed in this sandbox with SIGABRT. The separate Playwright browser tool was rejected by automatic approval review because the session's approval policy is `never`. I therefore did **not** rerun browser layout measurements, a browser interaction crawl, or an assistive-technology announcement test. JSDOM has no layout engine and cannot establish touch dimensions, clipping or scrolling geometry.

I visually inspected six designer-supplied captures from `/private/tmp/design009-r2/`: the edited approval, closed-day list, zero-row refund sheet, after-close receipt floor, amount editor and quick-sale detail. Those supplied images show legible compositions, the visible money split, a free Table 1 and the omitted quick-sale discount row. They are prior designer evidence, not screenshots or measurements generated by this reviewer. The designer's claimed 1280×800 dimensions, scrolling and target sizes remain supported by its Handoff and supplied evidence, not independently remeasured here.

I did not run printer dispatch, real PIN verification, server refund commands, audit persistence, database integration tests, the Impeccable detector or a separate finish reviewer. These HTML files explicitly simulate those operations. I made no production-path claim from their simulated approval success, and no in-memory mutation run is claimed.

## 4. Cleared

The original approval finding is resolved: M-1 now lists each allocation, marks edits, names zero rows as not refunded, and authorizes only the named refund. The cancellation destination and audit consequences are stated in the Handoff. O4's approved-then-refused outcomes and the distinction between a definite rejection and a no-response re-read are documented without inventing audit policy.

The Close finding is resolved by free-table floor variants and settlement links to after-close. The task's later ruling explicitly permits the receipt-warning variant to be driven by the close result rather than a separate settlement control. The existing default and receipt-warning floor states keep their original table occupancy.

The closed-day list now includes the open day's refundable orders first and a separate reprint-only closed-day group. The task records the owner's session-boundary rule for clearing that group and the lead's deferred floor-header wording; neither is an unresolved designer decision.

The shared Review refund eligibility now excludes zero and terminal orders. Immediate filtering resolves the redundant Search step. The borrowed-token finding is resolved with flexible layouts and named missing tokens, whose follow-up is explicitly outside this task. Quick-sale figures omit a nonexistent discount. The final incident-clear composition supplies a single live-region message in the DOM; actual screen-reader speech remains untested.

The A1–A5 and B1–B10 coverage is present in the artifacts and Handoff: touch filters, bare IDR and 24-hour times, distinct refunded and zero rows, Quick sale naming, full-order allocation, required reason and manager PIN, terminal refund exclusion, no void control on closed details, stored charged figures, receipt-class reprint results, and a modal approval over POS-06. The AC-25 arithmetic is 200.000 tendered minus 44.075 change equals 155.925 contributed and returned. The six original tender contributions, including custom names, sum to 155.925. No receipt number, fiscal layout, correction control, partial refund or card-terminal step was added.

The five Part D answers and named artifact changes are in the Handoff. The open quick-sale resume path, line-count convention, pending-line copy, consistent actor/header composition and light-only MVP statement are represented. No application source, tests, token registry, boundary document or accepted ADR was changed by the designer's two design commits.
