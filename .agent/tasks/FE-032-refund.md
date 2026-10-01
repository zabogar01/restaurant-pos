---
id: FE-032
title: POS-06 refund — the allocation sheet, the reason, the manager approval and the REFUNDED order
category: ui
touches: [money, audit, boundaries]
depends_on: [FE-031]
owns: [apps/pos/src/**, apps/pos/test/**]
status: not-started
cycles: 0
---
# FE-032 — POS-06 refund

**Status:** Written 2026-10-01 by `lead`. This is **F4e-3**, the third of the slices that
build POS-05 and POS-06 from DESIGN-009. It touches money, audit and boundaries. The
architect's consult (ARCH-003) is answered and the owner ruled its two questions on
2026-10-01; both are written into *Architect consult and owner rulings* below, which is
binding and wins wherever the artifact or an earlier Handoff says otherwise.
**Source:** DESIGN-009, complete and merged, with DESIGN-010's fixture corrections. The
artifact is `docs/design/visual-directions/frost/pos/closed-order.html`, driven by the detail
branch of `closed.js` (`:87–180`) and styled by `closed.css`. DESIGN-009's Handoff, and its
*Round 2* section especially, is the rationale; where round 1 and round 2 disagree, round 2 is
current.

## Objective

Today POS-06 (FE-031) shows a closed order read-only, with no Refund control in any state.
When this task is done a refundable order offers *Refund this order*, which opens the M-5
allocation sheet over the order: how the money goes back, tender by tender, and why. A valid
allocation and a reason lead to the manager approval (M-1) as a modal over POS-06; an approved
refund leaves the order REFUNDED, terminally, with the money returned listed. The thirteen
refund states of the artifact are built, and an order the cashier closed in this session can be
refunded in the order book, once.

## Required inputs

1. **The artifact**, `closed-order.html` with `closed.js` and `closed.css`. This task builds
   the thirteen states FE-031 left: `sheet-refund`, `sheet-ac25`, `sheet-custom`,
   `sheet-edited`, `sheet-invalid`, `sheet-zero`, `sheet-edit`, `sheet-other`, `approval`,
   `approval-edited`, `refund-error`, `refund-error-cash`, `day-refusal`
   (`closed-order.html:7`). Read in `closed.js`: which order a state selects (`:90`), the
   default allocation and the fixture edits (`:98–113`), the reason and overlay each state
   starts with (`:115–118`), `refundable()` (`:119`), the Refund control and the three
   unavailable notes (`:120`), the failure notices (`:127–128`), `drawSheet` (`:138–152`),
   `drawApproval` (`:153–156`) and the actions (`:157–176`).
2. **DESIGN-009's task file**, `.agent/tasks/DESIGN-009-closed-orders-and-refund.md`: Part B
   on the sheet, the approval, Cancel, the failure and the day refusal (`:126–144`), rules B1
   to B6 and B9 (`:147–173`); the owner's rulings O1 to O4 (`:299–312`) and how round 2 drew
   them (`:695–727`); lead rulings 1 (the allocation in M-1, `:731–748`) and 4 (*Review
   refund* and the no-response rule, `:815–829`); the Handoff on the
   sheet, the reason, M-1's unchanged failure states and Cancel (`:386–427`).
3. **DESIGN-010's task file**, `.agent/tasks/DESIGN-010-closed-order-tokens-and-fixture.md`,
   Part B (`:72–`): every refund state keeps the selected order's own tenders, and
   `refund-error-cash` keeps Table 7 whatever `order=` says.
4. **FE-031's task file and Handoff**, `.agent/tasks/FE-031-closed-order-detail.md`, its
   section *What FE-032 needs* above all.
5. **The code this builds on:**
   - `ClosedOrderScreen.tsx` and `closedOrderDetail.ts` (FE-031): the screen, `Body`'s `why`
     gate, the single reprint-result slot, `detailRequestFrom` (the thirteen states read as
     `default` today), `bookDetail` (`refunded: false` today), `moneyReturned`;
   - `closedOrders.ts`: `cashContribution`, `CASH_TENDER`, the six fixture orders, and
     `bookRows` (a book row is never REFUNDED today, and lists only `status === 'closed'`);
   - `orderStore.ts` and `close.ts`: the book. `close` (`:356–381`, over the pure `closeOrder`)
     is the one operation that records money today. Its inner `update` (`:287–295`) changes
     the **active order only** and refuses any change to a closed order; POS-06 is handed
     `book`, not a store, and the order it shows need not be the active one. `orders()`
     (`:226`, `:409–415`) reports `status: 'open' | 'closed'`; `isClosed` (`:163`);
   - `PosRoutes.tsx:90`: `closedActive` compares `status === 'closed'`, the guard that keeps
     live controls off a closed order reached by Back;
   - `Approval.tsx`, `PinPad.tsx`, `approvalFixtures.ts`: M-1 as POS-03 draws it. It is a
     fixture picture: it takes `{ approval, go }` and routes to a fixture view. `PinPad`
     hands the digits to `onSubmit(pin)` (`PinPad.tsx:81–88`) and `ApprovalPrompt`'s handler
     declares no parameter (`Approval.tsx:62`), so they are dropped unread. No PIN is
     verified anywhere in the client;
   - `VoidSheets.tsx` and `voidFixtures.ts`: the reason pattern (presets and *Other — type a
     reason*, a plain text input there);
   - `Sheets.tsx`: `SheetFrame` (focus onto the dialog, scrim, `aria-modal`, Escape).
6. **The contract:** `docs/PRD.md` FR-H1, FR-H5, FR-H5b, FR-H6, FR-H7, FR-A6, FR-J2, FR-J3,
   AC-11, AC-14, AC-18, AC-25, AC-34 and the two refund edge cases in section 6;
   `docs/BOUNDARIES.md` B-1, B-6, B-9, B-10, B-14, B-19, B-20, B-23;
   `docs/design/SCREEN-INVENTORY.md` POS-06, M-1 and M-5 (`:964–`), rulings C-1 and I-4.

## What to build

1. **The Refund control.** *Refund this order* is drawn beneath *Reprint receipt*, in the
   destructive style, exactly when the order is refundable: not zero-total, not REFUNDED, not
   on a closed business day (`refundable()`, the gate FE-031's `why` already computes). Where
   it is not refundable the control is **absent, not disabled** (FR-H5b, ruling C-1), and the
   note FE-031 draws says why. POS-06 has no void control (B-19).
2. **The allocation sheet (M-5)**, a sheet over the left of POS-06 that leaves *What was
   charged* visible, per `drawSheet`:
   - the notice *Refund the whole order · <total>* / *Part of an order cannot be refunded.
     An order can be refunded once.* There is no line selection and no partial amount (B-23);
   - one row per original tender, in the order they were taken, repeated names kept (three
     Card tenders are three rows). **No row can be added** (O1, FR-H5);
   - each row defaults to that tender's **effective contribution**, tendered less change
     (FR-H5, AC-25): the `cash` order defaults to Cash 155.925, never the 200.000 note;
   - *Allocated <sum> of <total>*. When the sum differs, the alert *Allocate <n> more* or
     *Reduce allocations by <n>*, then *Allocations must equal <total> exactly.*, and
     *Continue to manager PIN* is off. A row may exceed its tender's contribution; only the
     sum is checked (O2);
   - a row at 0 reads *<tender> · not refunded*, with the line *A row at 0 is not refunded
     and is left out of the refund.* (O3);
   - the line *Defaults to each original tender less its change.*, with the cash arithmetic
     where change was given (*Cash: 200.000 − 44.075 = 155.925.*), computed, not copied;
   - *Reason — required*: the three presets and *Other — type a reason*. Without a reason
     *Continue* is off and the sheet says *Select a reason before continuing.*
   - *Cancel* closes the sheet. *Continue to manager PIN* opens the approval.
3. **Editing an amount** (`sheet-edit`): tapping a row's amount opens the editor in the same
   sheet: *<tender> · money back*, the note that this changes the allocation only and the
   refund remains the whole order, the amount field, *Other allocations: <n>*, *Required
   total: <total>*, and the keypad (digits shift in from the right, a leading zero is dropped,
   nine digits at most, delete and clear, as FE-030's `keyed`). *Keep amount* writes it (an
   empty field is 0); *Cancel edit* leaves the row as it was.
4. **Typing a reason** (`sheet-other`): the artifact's field and on-screen alphabet keyboard
   with Space, Delete and Clear, 160 characters at most. *Keep reason* is off while the text
   is empty or only spaces; *Cancel reason* keeps whatever reason was set before. The reason
   is trimmed.
5. **The approval (M-1)**, a modal over POS-06 with a scrim, never a route or a mode (B-14,
   FR-A6), per `drawApproval`: *Manager PIN*; *Refund <order>, <total> — reason: <reason>*;
   *Money back: <tender> <amount> · …* in sheet order, a 0 row reading *<tender> not
   refunded*; the tag *ALLOCATION EDITED* when any row differs from its default, row by row;
   six dots that show a count and never a digit (B-12); the keypad; *Approves this refund
   only.*; *Cancel* with *Cancelling changes nothing on the order.*
   - **Cancel returns to the sheet** with every allocation and the reason kept and the
     entered digits cleared. It writes nothing to the order (B-20).
   - The confirm key is off until six digits are entered.
   - M-1's wrong-PIN, throttled and denied states are **not built for POS-06**: the artifact
     does not draw them here and says POS-03's apply unchanged.
   - There must be **one** M-1 in the code. Give `Approval.tsx` the seam this needs rather
     than copying it, and leave POS-03's use and its tests as they are.
6. **What an approval does.** On a book order (`?order=<id>` alone) the confirm calls the
   book's refund operation once and then draws the order from the book. On a fixture address
   (anything with a `state`) it shows the artifact's REFUNDED composition in screen state and
   writes nothing. *Architect consult and owner rulings* gives both exactly.
7. **After a refund.** The order is REFUNDED: the tag, the notice, *Money returned · full
   order* listing each allocation above 0, and the note *Already refunded · this order is
   final.* The Refund control is gone and a second refund cannot be started (FR-H6, B-10).
   *Reprint receipt* still works. For a book order the notice and the *Money returned* rows
   are built **from its refund record**, never from FE-031's fixture copy or from
   `moneyReturned`: after an edited allocation those would show money going back where it
   did not, under an approver nobody identified. POS-05's row for that order shows the
   *REFUNDED* tag, and the order stays in the list (A2).
8. **A refund that fails** (`refund-error`, `refund-error-cash`): the amber notice *Refund
   failed · the order is unchanged* with *Your allocation and reason are kept. Review them,
   then enter a manager PIN for a new attempt.* and *Review refund*, which reopens the sheet
   with that allocation and reason. Where the order is not refundable the notice reads
   *Nothing was refunded.* and carries no control. Nothing is written (B-20), and a new
   attempt needs a new PIN (B-14). The client never re-sends a refund on its own.
9. **The day closed during the attempt** (`day-refusal`, ruling I-4): the notice *Refund
   refused · business day closed during this attempt* / *Nothing was refunded. The order is
   unchanged. Reprinting still works.* with *Return to order*, which shows the standing
   closed-day picture. It never offers a retry (B-9, FR-H7).
10. **The fixture states** start as `closed.js:90` and `:98–118` have them: the order each
    state selects, the edit each one pictures (moved 20.000, short by 20.000, the first row
    at 0), the reason already chosen, and which overlay is open. `refund-error-cash` is
    Table 7 whatever `order=` says (DESIGN-010). On a zero-total, REFUNDED or closed-day
    order no sheet or approval opens, whatever the state says.
11. **Styles** in `pos.css`, mapped from `closed.css` with registry tokens only; the
    allocation field is `--frost-allocation-field-width`. No new token.

## Lead rulings (design, within the artifact; the owner may overturn them)

- **A cancelled sheet is discarded.** *Cancel* on the sheet throws the draft away: opening
  *Refund this order* again starts from the default allocation with no reason chosen. The
  artifact keeps the draft; a stale, edited allocation waiting behind a closed sheet is a
  worse default for money than typing it again. The draft is kept in exactly two places:
  across *Cancel* in M-1, and after a failed refund for *Review refund*.
- **Money is `Money` (`bigint`)** in the row, the sum, the difference and the comparison.
  The artifact compares with `Number`; do not.
- **An off action is `aria-disabled`, never `disabled`** (FE-024), including *Continue*,
  *Keep reason* and the confirm key, and each off action says why nearby.

## Architect consult and owner rulings

The architect answered ARCH-003 on 2026-10-01 (the report is
`.agent/reviews/ARCH-003-refund-in-the-client.md` on the lead's branch; everything you need
from it is here). The owner then ruled its two questions the same day (DECISIONS.md). These
sixteen rules are binding.

**Owner rulings (2026-10-01).**

- **O5 — the approval stand-in is accepted.** In this fixture client, six digits and the
  confirm key move a book order to REFUNDED in the in-memory book with no PIN verified, under
  rules 1, 10 and 15 below. It is a stand-in for the server's answer, not a working gate.
- **O6 — a refund made in this session names no approver.** Its notice reads `REFUNDED ·
  <HH:MM>` and *The whole order was refunded. Reason: <reason>.*, the reviewed copy with the
  approver clause removed. *REFUNDED · 20:31 · approved by M. Iqbal* stays, as fixture copy,
  only on the fixture `refunded` picture (and Table 3's row address).

**The rules.**

1. **A stand-in.** An approved refund of a book order is recorded in the in-memory book by
   `book.refund(orderId, request, refundedAt)`, over a pure `refundOrder` in a module beside
   `close.ts` that reads no clock and imports no React. Its header comment, and the comment on
   `OrderBook.refund`, say that it stands in for the server's full-refund command
   (ARCHITECTURE section 13), runs in memory and is lost on reload, and list what it omits:
   PIN verification, the actor, the approver, the idempotency key and expected order version
   (ADR-003), the business-day lock (section 8), the audit entry (ADR-007), and persisted
   `Refund` and `RefundTender` rows.
2. **A command, never a status.** The screen passes the order id, the allocations and the
   reason. It never sets a status and keeps no `refunded` flag of its own. After any result
   it draws the order from the book.
3. **The record.** The book's order gains `refunded?: { refundedAt, reason, allocations,
   amount }`, set once and never unset, as `closed` is. `allocations` holds amounts above zero
   only, in tender order, each with the original tender's position and its label copied;
   `amount` is the order total; `reason` is trimmed; `refundedAt` is an argument, as
   `closedAt` is. It has **no approver, no actor and no approval flag, and never `approver:
   null`** (that shape is ADR-007's failed or cancelled approval). The close facts, the lines
   and the totals are not touched (ARCHITECTURE section 6.5: the refund is its own record).
4. **The status.** `orders()` reports `'open' | 'closed' | 'refunded'`, with `refunded`
   derived from the record's presence and stored nowhere else, and carries the record. Then
   every reader must handle it: `bookRows` lists refunded orders and reads the tag from the
   book; `bookDetail` accepts `refunded` and reads its time, reason and allocations from the
   record; `noticesFor` builds a book order's notice from the record (O6); *Money returned*
   lists the record's allocations; **`PosRoutes.tsx:90` must count `refunded` as closed**, or
   Back onto a refunded order's order or settlement route draws live controls again.
   `isClosed` stays true for a refunded order (its table is free and it accepts no edit).
   Search `apps/pos/src` and `apps/pos/test` for every other comparison against `'closed'`,
   `isClosed` and `.closed`, and say in the Handoff what you found. Prefer one named
   predicate for "reached CLOSED" over scattered string comparisons.
5. **Refusals.** The operation checks, in this order, and reports the first that applies:
   `unknown-order` (the book's own, for an id it does not hold), `not-closed`,
   `already-refunded`, `zero-total`, `day-closed` (an input fact the caller passes, as
   `locked` is for `closeOrder`; no book order sets it), `no-reason` (empty after trimming),
   `not-a-tender` (a position outside the order's tenders, or the same position twice),
   `invalid-amount` (negative), `sum-mismatch` (the amounts above zero do not sum to the
   total exactly). The result is a value that names the refusal, never a throw and never a
   bare boolean. A refunded order always answers `already-refunded`, whatever else is wrong.
6. **All or nothing** (B-20). Validate the whole request, then write one field in one state
   update, through the functional updater against the previous state, as `close` does, so a
   second call in the same tick finds the order refunded and changes nothing. A refusal
   returns the same book object (a test can assert identity). **Do not loosen `update`'s
   closed-order guard**; the refund gets its own by-id path that can set `refunded` and
   nothing else.
7. **Zero rows.** The screen drops them before calling (O3), and the operation also never
   stores one: it discards a zero amount before the sum check rather than refusing it.
8. **The default allocation is a walk, not a label.** Take the tenders in the order they were
   taken: `contribution = min(tender amount, remaining)`, then `remaining -= contribution`,
   starting from the order total (FR-G4 defines change this way). The default for a row is
   its contribution. Write it once and use it for the sheet's defaults, for the row-by-row
   comparison behind *ALLOCATION EDITED*, and for the arithmetic line (drawn for the tender
   whose contribution is less than its amount). A test asserts that no row is negative, that
   the rows sum to the total, and that the Cash rows sum to FE-031's `cashContribution`.
   `moneyReturned` is not used for a book order; for the fixture `refunded` picture build it
   on the walk or give the fixture its own record, so the client has one rule for change.
9. **The approver.** As O6. The record has no approver; the notice does not say *approved*;
   the time is `refundedAt` in WIB.
10. **The PIN.** The digits are never read, compared, stored, passed on or logged (B-12). The
    POS-06 confirm handler declares no parameter. There is **no magic PIN**: accepting one
    value would be a fabricated credential check. Six digits is input completeness, not
    verification. The comment at the call site says in words that confirm stands for the
    server accepting the protected command and that nothing is verified. Nothing about an
    approval is stored: no `approved` flag, no approval time.
11. **The M-1 seam** (ARCHITECTURE section 7.1, ADR-007, B-14). M-1 becomes one controlled,
    presentational dialog: the request to display, fixed for the life of one mounting;
    `onSubmit(pin)`, a **single callback that carries out the whole protected action** (never
    a step that returns an approval the caller then holds); `onCancel()`, the caller's, used
    by Cancel and Escape alike; and `notice` and `throttled` as props the caller sets (POS-06
    passes neither). There is no other way to dismiss it: the scrim has no click handler
    today, and it stays that way. The object displayed and the object submitted are the same
    one, so the sheet cannot change the allocation while the modal is open. A new attempt is
    a new mounting. No idempotency key, attempt id or version goes into the component or the
    operation now. `ApprovalPrompt({ approval, go })` stays as a thin adapter over the dialog
    for POS-03, so its routing and its tests do not change.
12. **What the screen draws on each result.** It closes the approval, then draws from the
    book:
    - refunded: the REFUNDED detail from the record; the draft is discarded;
    - `already-refunded`: the REFUNDED detail from the record that exists, never from the
      draft, with *Refund failed · the order is unchanged* / *Nothing was refunded.* and no
      control;
    - `zero-total`, `not-closed`, `unknown-order`: the same notice with no control, over
      whatever the book holds;
    - `day-closed`: the `day-refusal` picture, then the standing closed-day picture, never a
      retry (B-9);
    - `no-reason`, `not-a-tender`, `invalid-amount`, `sum-mismatch`: `refund-error` with
      *Review refund*, the allocation and reason kept, and a fresh M-1 for a new attempt.

    A correctly built sheet cannot reach a refusal on a book order, so test this by handing
    the screen a book whose `refund` refuses; that is also the proof that the screen does not
    decide the outcome. Build **no asynchronous path, no pending or verifying state, no
    `no-response` outcome and no simulated failure** on a book order. `refund-error`,
    `refund-error-cash` and `day-refusal` stay reachable by URL as fixture pictures.
13. **Fixture addresses.** A confirm on an address with a `state` shows the artifact's
    REFUNDED composition in screen state, with the chosen reason and allocation and **no
    approver** (O6). It never calls `book.refund` and never creates a book entry.
14. **No audit in the client, and no mock of one.** The Handoff lists what the server owes in
    Phase 5: the combined success entry; the cancelled approval with a null approver (Cancel
    and Escape in M-1; cancelling the sheet is not an approval outcome); the **failed
    approval** (a wrong PIN, or a PIN that is not a manager's) with a null approver; the
    approved-then-refused entry of ruling O4; nothing on no response; and no PIN value
    anywhere. It also lists: the idempotency key and expected version (ADR-003); the
    business-day lock; server time for `refundedAt`; the server's own refusal codes; each
    tender's effective contribution from the server in place of the walk; the in-flight state
    and the no-response re-read; whether `RefundTender` rows follow original tenders or tender
    types; and two undecided points (the order of the server's checks, and which exits from
    M-1 count as cancelled).
15. **Removal.** When the server's refund command exists, the in-memory operation is deleted,
    not kept as a fallback for an unreachable server. Say so in the module comment.
16. **What the tests prove.** The client's behaviour only. AC-11, AC-14, AC-18, AC-25 and
    AC-34 are **not** closed by this task: they need the server and PostgreSQL (ADR-002).
    Do not write that a test satisfies one of them.

**A caution on existing tests.** `OrderStore.close` is optional so that a test's hand-built
store need not supply it. If a required `refund` on `OrderBook` would force a change to an
existing test's hand-built book, make it optional in the same way and say so; do not edit
those tests.

## Constraints

- **Full-order only** (B-23): no line selection, no partial amount.
- **Once only** (FR-H6, B-10): a REFUNDED order has no refund path, by any route or state.
- **No refund against a closed business day** (B-9, FR-H7) and none for a zero-total order
  (FR-H5b).
- **Void and refund are never one action** (B-19): no void here, no refund on POS-03.
- **No partial state** (B-20): a cancelled sheet, a cancelled approval and a failed refund
  each leave the order exactly as it was.
- **The approval authorises this one refund** (B-14): nothing is remembered between
  openings, no digit is kept or shown, and no approval is reused for a second attempt.
- **The refund is its own record** (ARCHITECTURE sections 6.5 and 8): the order's total,
  lines, tenders and change are not changed by it.
- No receipt layout, receipt number or fiscal field (I-1, PRD section 9). Release is not
  drawn. Do not run Prettier.

## Tests expected to change

- `apps/pos/test/closed-order.test.tsx:188–192`: the states this task builds
  (`sheet-refund`, `approval`) are asserted to read as `default`. Change it to keep only the
  unknown and empty cases.
- `apps/pos/test/closed-order.test.tsx:686–705`: *no Refund or void control in any state*.
  Change it to assert the Refund control exactly where the order is refundable and its
  absence, with the three notes, where it is not; there is still no void control anywhere.

Every other existing test must pass unmodified, including POS-03's approval tests
(`pin-pad.test.tsx` and the approval fixtures') and the three source scans. If any other
test needs changing, stop and ask.

## Acceptance criteria

1. **Every state draws what the artifact draws.** A table-driven test over the thirteen
   states checks the order shown, the rows and amounts, the sum line, the alert or its
   absence, the reason, whether *Continue* is on, and the M-1 subject, money-back line and
   tag. Red if a state shows another order's tenders (DESIGN-010's defect).
2. **Refund is offered exactly where the order is refundable.** Present on `default`, `cash`,
   `custom`, `quick`, `overflow` and the new-day order; absent on `zero`, `refunded`,
   `dayclosed`, and on `refund-error` reached with a zero or REFUNDED order. Red if it is
   ever drawn disabled, or present where it must not be.
3. **The default is the effective contribution**, by the walk of rule 8. The `cash` order
   defaults to Cash 155.925. A book order paid by a card and then cash with change defaults
   to the card's amount and the cash tendered less the change. Two cash tenders of 50.000
   and 150.000 on 155.925 default to 50.000 and 105.925. No row is negative, the rows sum to
   the order total, and the Cash rows sum to `cashContribution`. Red if the cash row is the
   note, or a row can go negative.
4. **Only the original tenders** (O1). The rows are the order's tenders, one each, in order;
   nothing in the sheet adds a row or a tender type, and the operation refuses a position
   that is not one of the order's tenders or is given twice.
5. **Only the sum is checked** (O2). A row above its contribution is accepted when the sum
   is exact. Short by 20.000 reads *Allocate 20.000 more*; over by 5.000 reads *Reduce
   allocations by 5.000*; either turns *Continue* off. Red if a row is capped, or a mismatch
   can continue.
6. **A zero row is dropped** (O3). The sheet and M-1 say *not refunded*; the refund that is
   recorded and the *Money returned* list carry no row at 0.
7. **A reason is required.** No reason, or only spaces, cannot continue. A typed reason is
   trimmed and holds at most 160 characters.
8. **Cancel leaves nothing behind** (B-20). Cancelling the sheet, the edit, the typed reason
   or the approval leaves the order exactly as it was: same status, no refund record. After
   *Cancel* in M-1 the sheet shows the same allocation and reason, and the digits are gone.
   After *Cancel* on the sheet, a reopened sheet is the default allocation with no reason.
9. **An approved refund** leaves the order REFUNDED with the money returned as allocated,
   on POS-06 and as the *REFUNDED* tag on POS-05's row, for a book order closed and refunded
   through the real route in one session, with an **edited** allocation: the rows shown are
   the record's, not the default. Its total, lines, tenders and change are unchanged. The
   notice reads `REFUNDED · <HH:MM>` with the reason and **no approver** (O6). Red if the
   notice names anyone, or the rows are recomputed.
10. **Once only.** A REFUNDED order offers no Refund control, and a second `book.refund` of
    the same order answers `already-refunded` and returns the same book object. Red if two
    refunds of one order can be recorded, or the second replaces the first.
11. **The operation refuses, in order, and writes nothing.** One test per refusal of rule 5,
    each asserting the named refusal and book identity; a refunded order with a bad request
    still answers `already-refunded`.
12. **The approval is this refund's alone** (B-14). The modal shows a count of digits and no
    digit; reopening it starts empty; the confirm key is off below six digits; the confirm
    handler receives no digits (rule 10), and any six digits behave alike. POS-03's approval
    behaves and tests as before. Red if a value is compared or kept.
13. **The screen draws the book's answer** (rule 12). Handed a book whose `refund` refuses,
    the screen shows the picture for that refusal: `already-refunded` shows the existing
    record and no control; a validation refusal shows `refund-error` with the allocation and
    reason kept for *Review refund*. `day-refusal` leads only to the closed-day picture, with
    no Refund control and no retry.
14. **A fixture address writes nothing** (rule 13). Confirming a refund on a `state` address
    shows the REFUNDED composition with no approver and leaves the book without a new entry.
15. **Back cannot revive a refunded order.** With a refunded order still the active one, its
    order and settlement routes draw no live control (`PosRoutes.tsx:90`).
16. **Touch at 1280×800.** The sheet leaves *What was charged* visible; the six-tender
    allocation scrolls inside the sheet; the approval modal stays inside the device with the
    six-tender money-back line wrapped. State how you measured, or that you could not; the
    lead walks it in a browser before closing the task.
17. `npm run verify` is green, with the test and file counts stated (the baseline on
    `development` at `1fc0f6c` is 34 files and 2411 tests), and only the two tests named
    above changed.

## Out of scope

- A server, an API, a real PIN check, manager identity, PIN throttling, and any audit entry:
  the audit log is the server's (FR-J2, FR-J3) and is not drawn.
- M-1's wrong-PIN, throttled and denied states over POS-06.
- A business day that closes in the client; `day-refusal` and `dayclosed` stay fixture states.
- The floor's after-close states, the quick-sale strip and the line counts (FE-033).
- Release and the actor session (FR-A).

## Reporting

Commit on `agent/fe-032` only after verify is green, and never push. Append a Handoff below:
what you built and where, every decision you made and on what evidence, each test you changed
and why, the red cases you ran (mutation, failure, revert), what you found and did not fix,
the real verify output, and the list rule 14 asks for: what the server owes and must replace
when the refund becomes a server command. Last line: DONE, or BLOCKED: <question>.

Then run `herdr agent prompt lead "<your name>: FE-032 done — <tests> tests, <one line>"`,
or `herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff
