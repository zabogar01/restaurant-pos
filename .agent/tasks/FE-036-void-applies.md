---
id: FE-036
title: A void on POS-03 changes the order on screen
category: ui
touches: [money, audit, identity]
depends_on: []
owns: [apps/pos/src/**, apps/pos/test/**]
status: not-started
cycles: 0
---
# FE-036 — The void applies

**Why this task exists.** The owner's frontend review found the discount inert on a live order
(fixed by FE-035). The void is inert in the same way: voiding a FIRED line and voiding a whole
order only close the sheet, and the void sheet reads a fixture's order instead of the order on
screen. The owner's review of the frontend is complete once the void is settled.

## Objective

On POS-03, a void sheet reads the order the panel is showing, and a void changes that order. A
FIRED line voided through the manager prompt is struck through and drops out of the totals. A
whole order with nothing fired voids at once; one holding fired work voids through the manager
prompt; either way the order becomes VOIDED, its table frees, and the cashier lands on the
floor. The change is made by one pure module that stands in for the server's two void commands,
decides the gate itself and refuses what it must.

## Required inputs

### The defects, as they stand (`development` at `60f877e`)

- `apps/pos/src/OrderPanel.tsx:172` — `const order = shownOrder(view)`, the fixture-only
  derivation, handed to the void sheet at `:334`. `:226` computes `voiding` from
  `VOID_FIXTURES[view.state]` or `panelVoid(voidOpened, view)`; `:265` derives `inert` from it.
  `shownOrder` stays (it has other callers: `OrderPanel.tsx:382`, `discount-apply.test.tsx`).
- `apps/pos/src/VoidSheets.tsx:53-66` — the one door, `commit()`. Ungated it calls
  `go(fixture.landsOn)`; gated it opens `ApprovalPrompt` (`:181`), whose approve is only a
  navigation and which does not pass `requireFull`. `subjectOf` (`:272-294`) throws when the
  line is not on the order or not in a fired group, and `voidRule` (`void.ts:50`) throws on a
  voided line; the sheet calls both on every render (`:49-50`).
- `apps/pos/src/voidFixtures.ts:88-92` — `panelVoid` returns `cancel: view, landsOn: view`; the
  three `?state=sheet-void*` fixtures (`:65-78`) land on `default`. Nothing writes the order.
- `apps/pos/src/orderStore.ts` — `StoreState` has `closed?` and `refunded?`; `statusOf`
  (`:191`) reports `open | closed | refunded`; `reachedClosed` (`:189`) is `status !== 'open'`.
  `isClosed` guards `tableSlot` (`:194-199`), `update` (`:356-364`), the `close` pre-check
  (`:442`), `changeDiscount`'s `closed` fact (`:458`) and `refundInBook` (`:254`).
  `totalsFor` (`:208-212`) already leaves a `voided` line out of the subtotal.
  `changeDiscount` (`:452-473`) is the pattern to follow.
- `apps/pos/src/discountChange.ts` and `DiscountSheets.tsx:152-162` show how FE-035 built the
  discount's stand-in and its door; build the void the same way.

### Owner rulings (`.agent/DECISIONS.md`, 2026-10-03)

- **O1.** A manager-gated void (a FIRED line, or an order holding one, FR-H4) uses the refund's
  stand-in: six digits and the confirm key apply it with no PIN verified, the digits are
  discarded unread, nothing about an approval is stored, and the stand-in goes when the server
  command exists.
- **O2.** A voided order is listed nowhere in the POS: its table frees, it leaves the floor and
  the quick-sale strip, it is not on POS-05 or POS-06, and the back-office reports count it
  later. No voided-order picture is drawn.

### Architect consult (ARCH-005)

The architect's report (`.agent/reviews/ARCH-005-void-in-the-client.md`) is on the lead's
branch and is **not in your worktree**; you do not need it. The lead accepts its twenty rules.
They are restated here in full as R1 to R18, and these are what you build.

- **R1. A stand-in, in its own module.** One pure module beside `void.ts` (the name is yours;
  `voidChange.ts` is the lead's suggestion). It reads no clock and imports no React and no
  fixture. Its header says it stands in for the server's two void commands (fired-line void
  and whole-order void, `docs/ARCHITECTURE.md` sections 6.1 and 13) and lists what it leaves
  out: PIN verification, the actor, the approver, the idempotency key, the expected order
  version, the lease, the business-day lock, the audit entry, the cancellation ticket and its
  print, and a persisted `VOIDED` state. `void.ts` stays as it is: the sheet still asks
  `voidRule` what to draw. When the server's commands exist the module is deleted, not kept as
  a fallback.
- **R2. Two entry points.** `store.voidLine(lineId, reason, through)` and
  `store.voidOrder(reason, through, voidedAt)`, on the active order, over the module's two
  functions. `reason` is `string | undefined`; `through` is `'direct' | 'manager-prompt'`,
  required, with no default; `voidedAt` is an ISO instant from the caller's clock, as
  `closedAt` is. `voidLine` takes no time. Make both methods optional on `OrderStore` and
  required on `LiveOrderStore`, as `changeDiscount` is, so a test's hand-built store need not
  supply them.
- **R3. Refusals, checked in this order:** `not-open` (the order is closed, refunded or voided,
  or there is no active order), `locked`, `unknown-line`, `not-fired`, `no-reason`,
  `needs-manager`. `unknown-line` and `not-fired` belong to the line void only and are checked
  **before `voidRule` is called**, because it throws on a voided line. `not-fired` answers a
  PENDING line as well as a VOIDED one: a pending line leaves by its row's × (FR-H2), and the
  void must never quietly remove it. The result is a value naming the refusal, never a throw
  and never a bare boolean. A refusal returns the same order object (B-20).
- **R4. Not refusals:** an empty order, an order whose only lines are voided, a quick sale
  (each is FR-H3: nothing FIRED). No `day-closed` refusal and no input fact for one: FR-H7 is
  the server's.
- **R5. The lock is checked inside the operation:** this order's own payment session, or the
  place's lock (`draft` or `lease`), read through the store's context ref at the moment of the
  call, exactly as `changeDiscount` composes it. Both locks refuse.
- **R6. The gate is decided inside the operation.** It calls `voidRule` on the target as the
  store holds it, in the same update that writes, and refuses `no-reason` when a reason is
  required and the reason is empty after trimming, and `needs-manager` when approval is
  required and `through` is not `'manager-prompt'`. `'manager-prompt'` appears as a literal
  only inside the manager prompt's `onSubmit`; it is never stored in state, a ref, the order,
  the URL or a prop, and never named *approved*, *approval* or *confirmed*. A
  `'manager-prompt'` call for a target that turns out ungated applies. The FR-H3 void passes
  `'direct'`.
- **R7. A line void** sets that line's `status` to `voided`, in place, in its round. Nothing
  else on the line changes: not `amount`, `unitPrice`, `quantity`, `modifiers` or `note`. The
  round stays, with its number, time and delivery, even when every line in it is voided. The
  line is never dropped (`dropLine` is FR-H2's removal, not a void). No time is recorded.
- **R8. An order void** sets `voided: { voidedAt }` on the order, once and never unset, and
  changes nothing else: not the lines, not the discount. `OrderStatus` gains `'voided'`,
  derived from the record's presence; `statusOf` checks it first.
- **R9. Two predicates.** `reachedClosed(status)` narrows to `closed` or `refunded` (the orders
  POS-05 lists and FR-I5 counts). A new exported predicate (the name is yours;
  `noLongerOpen` is the architect's) means anything but `open`. In the store, one private
  `isOpen(o)`: neither `closed` nor `voided` is set. Then:
  - `tableSlot`, `update`, the `close` pre-check and `changeDiscount`'s `closed` fact use
    `isOpen` (today each would treat a voided order as open: the table would never free, and
    a close or a discount change on it would report success);
  - `PosRoutes.tsx:91`'s redirect reads the new predicate, so Back onto a voided order's route
    lands on the floor;
  - `refundInBook` is left as it is: it already answers `not-closed` for a voided order (B-19);
  - `FloorScreen.tsx:137` and `:142` compare against `'open'` and need no change once
    `statusOf` is right; `closedOrders.ts:243` and `closedOrderDetail.ts:348` need none once
    `reachedClosed` is narrowed.
  Search `apps/pos/src` and `apps/pos/test` for `isClosed`, `reachedClosed`, `status ===`,
  `status !==` and `.closed`, and say in the Handoff what you found and what you changed.
- **R10. All or nothing.** Follow `changeDiscount`: evaluate against the latest book through
  the ref, advance the ref, and run the same operation inside the functional updater through
  `update`. No by-id path. Two calls in the same tick: the second sees the first.
- **R11. No cancellation ticket in the book.** The operation's success result carries
  `cancels`, the ids of the FIRED lines the void cancelled, taken from `voidRule` on the order
  it writes, and the store method returns it. Nothing is stored for it: no field, no
  `delivery`, no round, no incident, and nothing waits on it (B-15, B-16).
- **R12. The reason** is passed, checked and dropped. The prompt's submit passes the reason the
  prompt displayed, captured when it opened, not a fresh read of the sheet's state. It is not
  stored, logged, kept in a ref or put in the URL.
- **R13. One sheet, one order.** Every void sheet on POS-03, opened from a fired row, from the
  close bar or by a `?state=sheet-voidline|sheet-voidorder|sheet-voidorder-fired` address,
  reads `store.order` and writes through the operation. **A line target that is not a FIRED
  line of that order draws no sheet**, as `panelLine` already does for a line that is not
  pending (`sheetFixtures.ts:245-247`). That decision is made where `voiding` is computed in
  `OrderPanel.tsx`, so `inert`, the focus return and `overlayAt` never see a sheet that is not
  drawn. `subjectOf` returns `undefined` instead of throwing, and the sheet calls `voidRule`
  only on a subject it has. Nothing throws on an order's state. The order void's sheet always
  has a subject.
- **R14. The door.** `VoidSheet` stops using `ApprovalPrompt` and its `STAY` identity trick.
  Gated, it opens `ApprovalDialog` as `DiscountSheets.tsx` does: `requireFull`, an `onSubmit`
  handler that **declares no parameter** and calls the operation with `'manager-prompt'`, and
  `onCancel` returning to the sheet exactly as it was, reason kept (B-20). No footnote (the
  refund's *Approves this refund only.* is not this action's, B-19). The comment at the call
  site says the confirm key stands for the server accepting the command and that nothing is
  verified. No magic PIN; a second attempt mounts a fresh prompt.
- **R15. Landings.** A line void lands where its fixture says: the same view for a sheet opened
  from a row, `default` for `?state=sheet-voidline`. An order void, once the operation answered
  without a refusal, **replaces** the history entry with `/pos/floor` and tells the location's
  owner (`onLocationChange`), as Close does (`SettlementScreen.tsx:692-696`); it is not a
  `?state=` view and not a fixture property, so it does not go through `go`. The order screen
  owns this navigation. `PosRoutes`' redirect stays as the guard for Back and Forward. In the
  standalone `OrderScreen` wrapper, which has no floor, assert only the URL and the order's
  status; draw nothing new there.
- **R16. On a refusal** the prompt closes if it was open, the sheet stays, nothing routes, and
  no new copy is written. A correctly built screen cannot reach a refusal; a test hands the
  sheet a store whose operation refuses.
- **R17. The four `?state=approval*` addresses** (`APPROVAL_FIXTURES`) stay routing only,
  through `ApprovalPrompt`: they are pictures of M-1 (a wrong PIN, the cooldown, a PIN that is
  not a manager's), and their request is a fixture's line and a reason nobody chose. Add a
  comment on `APPROVAL_FIXTURES` that these addresses picture the prompt and perform nothing.
  `ApprovalPrompt` then serves them only.
- **R18. Nothing is said after the void** about a ticket, a print or a record: no notice, no
  status line, no success copy. No approver, no actor, no approval flag, never
  `approver: null`. No audit in the client, and no mock of one. The Handoff lists what the
  server owes:
  - **seven audit facts:** a whole-order void with nothing fired (one entry, actor, no
    approver, no reason; exactly one, AC-10); a fired-line void (one combined entry, actor and
    approver, reason, order and line, totals before and after); a whole-order void holding
    fired work (one combined entry, actor and approver, reason); a cancelled approval (actor,
    approver null); a failed approval (actor, approver null, counted against the approval
    throttle); nothing for removing a PENDING line; no PIN value in any store;
  - **the replacements:** the immutable cancellation ticket holding only the cancelled work,
    visibly distinct from a work ticket, with its PrintJob in the same transaction and printed
    after commit; the emergency incident on FAILED or UNKNOWN delivery; **an idempotency key on
    each of the two void commands** (ADR-003 lists both, unlike the discount); the expected
    order version; FR-H7 and B-9 under the BusinessDay lock; the lease (`LEASE_HELD`); server
    time; the actor from the session and the approver from the PIN inside the command; the
    persisted `VOIDED` state and authoritative totals; the in-flight and rejected-void
    pictures, which no design draws;
  - **six undecided points, named and not assumed:** an approved void the server then refuses;
    the idempotency key across a second PIN entry; the order of the server's checks and which
    exits from M-1 count as cancelled; whether a whole-order void also moves each line to
    VOIDED; where the offered reasons come from; a cancellation ticket for work whose own
    ticket never printed.

### Lead rulings on the architect's questions for the owner (the owner may overturn them)

- **L1.** A line voided in this session shows nothing beyond its strike-through: no
  *Voided 19:51*, no note (R7). The `overflow` fixture's *Voided 19:51 · approved by M. Iqbal*
  stays fixture copy.
- **L2.** The reviewed sheet copy stays as it is, *A cancellation ticket will print in the
  kitchen* and *The void is recorded against your name* included, though in the client nothing
  prints and nothing is recorded; nothing is said after the void (R18).

### Documents

- `docs/PRD.md` FR-G12, FR-G13, FR-H1 to FR-H4, FR-M5; `docs/BOUNDARIES.md` B-8, B-10, B-14,
  B-15, B-16, B-19, B-20.
- The design: `docs/design/visual-directions/frost/pos/order.html`, the `sheet-voidline`,
  `sheet-voidorder` and `sheet-voidorder-fired` blocks, and the voided row of `overflow`. No new
  state is drawn and none is needed: the sheets, the prompt, the struck-through row and the
  floor already exist.

## Constraints

- **No new screen, state, copy or CSS.** No notice, success line or refusal message.
- `void.ts`'s `voidRule`, `firedWork` and `givenReason` keep their behavior. Write no
  arithmetic: every figure comes from `totalsFor` and `orderTotals`.
- A void never re-validates, shrinks or drops the discount. A percentage discount follows the
  lower subtotal; a fixed one is capped by `discountAmount` (FR-M5).
- The digits are never read, compared, stored, passed on or logged (B-12, O1).
- Removing a PENDING line by its × (`?gone=`) is unchanged.
- Nothing about the void reaches POS-05, POS-06 or the refund (B-19).
- `close.ts`, `fire.ts`, `tender.ts`, `refund.ts`, `discount.ts`, `discountChange.ts` and
  `packages/**` have no diff.
- Format by hand, matching each file. Run no formatter.
- This task does not close AC-3, AC-10, AC-11, AC-18, AC-21 or AC-22: those are proved against
  the real server. Do not cite them as satisfied.

## Tests expected to change

Found by the lead's grep; the explorer was not used as the authority. All in
`apps/pos/test/void.test.tsx` unless named.

- **The `renderSheet` helper (`:65-76`) and its three callers** (`:338`, `:346`, `:355`). It
  mounts a `VoidSheet` with a fixture and an order. The sheet's props will change (the store's
  order and its operations). **Every assertion's meaning stays:** the order sheet draws the
  variant its order calls for, whatever the `?state=`.
- **`:362-373`, FR-H3 "the order leaves the sheet"**, asserts `urlState()` is `default`. The
  order void now lands on `/pos/floor` (R15); assert the path, and that the order is voided.
- **`:551-560`, "approved, the void lands on the order"**, run for `sheet-voidline` and
  `sheet-voidorder-fired`. The line void still lands on `default` and gains an assertion that
  the Burger row is voided; the order void now lands on `/pos/floor`.
- **`:688-698`**, Chicken Wings voided on `overflow`: `panelRows('fired')` was 6 and becomes 5,
  with Wings among the voided rows.

Expected to pass **unmodified**: the gate, reason, prompt-request, B-15, B-16 and FR-H1 tests
of `void.test.tsx`; `:312-321` (`shownOrder` stays); the state lists in
`order-panel.test.tsx:152-154`, `approval.test.tsx:468` and `fire.test.tsx:817`; the close-bar
lists in `fire.test.tsx`, `quick-sale.test.tsx:162` and `order-panel.test.tsx:275`; every
`closed-orders`, `closed-order`, `refund-screen` and `floor-quick-sale` test. If any other
existing test goes red, in this file or another, stop and end BLOCKED with its name and what it
asserts.

## Acceptance criteria

Each is a test unless it says otherwise.

**The pure module**

1. **The gate, both doors.** For a FIRED line and for an order holding one, `'direct'` is
   refused `needs-manager` (same order object) and `'manager-prompt'` applies. For an order
   with nothing fired, `'direct'` applies with no reason. Red case: a gated void applying
   under `'direct'`.
2. **The refusals, in order.** One test per refusal of R3, and one that an input which is
   closed, locked and gated at once answers `not-open`. A line void of a VOIDED line answers
   `not-fired` and does not throw; of a PENDING line, `not-fired`, and the line is still there.
   A gated void with an empty or all-space reason answers `no-reason`. Red case: a throw, or a
   later refusal answering first.
3. **Not refusals (R4).** An empty order, an order whose only lines are voided, and a quick
   sale each void with `'direct'` and no reason. Red case: any refused.
4. **What a line void writes (R7).** Only that line's `status` changes; its round keeps its
   number, time, delivery and place; every other line and the discount are the same objects;
   the subtotal drops by the line's amount. Red case: the line dropped or its amount changed.
5. **What an order void writes (R8).** `voided.voidedAt` is the instant passed; lines and
   discount are unchanged. Red case: lines rewritten.
6. **`cancels` (R11).** A line void returns that one id; an order void over fired, pending and
   voided lines returns exactly the lines still FIRED; an FR-H3 void returns none. Red case: a
   pending or voided line among them.
7. **The module is clean.** It imports no React and no `*Fixtures` module, and holds no `Date`,
   no timer and no `console`. Red case: any of them.

**The store and the book**

8. **The lock (R5).** With a payment session active on the order, and separately at a fixture
   state whose place carries a `draft` or a `lease` lock, both methods answer `locked` and the
   order object is the same. Red case: a line voided under a lock.
9. **Twice in one tick (R10).** Two `voidLine` calls for the same line in one tick: the first
   applies, the second answers `not-fired`. Two `voidOrder` calls: the second answers
   `not-open`. Red case: both reporting success.
10. **A voided order is terminal (R9).** After `voidOrder`: `addLine`, `removeLine`,
    `setQuantity`, `fire`, `close` and `changeDiscount` change nothing, and `close` returns
    `false` and `changeDiscount` answers a refusal. Red case: any of them writing, or `close`
    returning `true`.
11. **The book (R9, O2).** A voided order's status is `voided`; `reachedClosed` is false for it
    and true for closed and refunded; the new predicate is true for all three. Its table frees:
    `openOrderIdOf` answers undefined and the next `openTable` makes a new order. It is not on
    the quick-sale strip, POS-05's rows or POS-06, and `refund` answers `not-closed`. Red case:
    the table still taken, or the order listed.

**The sheet reads the order on screen**

12. **A line added in this session.** Through `PosRoutes`: open a table from the floor, add a
    Burger, send it to the kitchen, tap its fired row: the sheet shows that Burger and its
    amount. Voiding it through the prompt strikes it through and the totals drop. Red case:
    another order's line, or a throw.
13. **Void order over a live order.** Through `PosRoutes`: on a table whose order holds fired
    work, Void order shows the gated variant with the panel's total and the panel's fired
    count; on a table with only pending lines, the ungated variant. Red case: the fixture's
    variant or figures.
14. **No subject, no sheet (R13).** At `?state=sheet-voidline` over an active order with no
    fired `burger`, and over one whose Burger was voided in this session, no sheet is drawn,
    the frame is not inert, and nothing throws. Red case: a throw, or an inert frame under no
    sheet.

**A void changes the order**

15. **A fired line through the prompt (FR-H4, O1).** Reason, Continue, the prompt: nothing on
    the order has changed while it is open; the confirm key is off until six digits are
    entered; six digits and the confirm key close prompt and sheet, the row is struck through
    and inert, and the totals equal `totalsFor` over the remaining lines. Red case: the order
    changing before confirm, or confirming with five digits.
16. **Cancelling the prompt changes nothing (B-20).** Cancel and Escape each return to the
    sheet as it was, reason kept, order unchanged. Red case: a void applied by a cancelled
    prompt.
17. **The reason submitted is the reason shown (R12).** A typed reason is what the prompt's
    request displays; the prompt's `onSubmit` declares no parameter, and `'manager-prompt'`
    appears as a literal only inside it (a source-reading test, as `discount.test.tsx` does
    it). Red case: a `pin` parameter, or the literal elsewhere.
18. **An order with nothing fired (FR-H3).** Through `PosRoutes`: Void order, Void order: no
    prompt, no reason; the URL is `/pos/floor`, replaced, not pushed (the history length is
    unchanged); the floor draws the table free; Back does not return to the voided order's
    workspace. Red case: the table still drawn taken, or Back reopening the order.
19. **An order holding fired work (FR-H4).** The same, through reason and prompt. Red case:
    voided with no prompt.
20. **The three addresses are live (R13, R15).** At `?state=sheet-voidline`, approving voids
    the Burger in the book and lands on `default`. At `?state=sheet-voidorder` and
    `sheet-voidorder-fired`, the void voids the active order and lands on `/pos/floor`. Red
    case: the landing reached over an unchanged order.
21. **A refusal (R16).** A sheet handed a store whose operation refuses stays open, routes
    nowhere, and the prompt, if it was open, is closed. Red case: the sheet closing as if the
    void had been made.
22. **The approval addresses perform nothing (R17).** At `?state=approval`, six digits and the
    confirm key route as today and every line's status is unchanged. Red case: a line voided
    from a fixture's request.
23. **Money.** On an order carrying a percentage discount, a fired-line void lowers the
    discount amount with the subtotal and leaves the snapshot unchanged; with a fixed discount
    above the remaining subtotal, the total is `0` and the snapshot unchanged. A void under an
    active tender draft is refused by the operation (criterion 8). Red case: the snapshot
    changed or dropped.
24. **Nothing is said after the void (R18).** After each kind of void, no new text appears in
    the panel or the frame about a ticket, a print, a record or an approval. Red case: any.
25. `npm run verify` is green from the repository root. The baseline at `60f877e` is 2644 tests
    in 39 files (the lead's run, with `npm run db:up`); the output holds no `Not implemented`
    line.

## Out of scope

Each is deliberate. Record under *Found, not fixed* anything you see of them, and change none.

- `addLine`, `removeLine` and `setQuantity` check no payment lock in the store (QUEUE 8g).
- `PosRoutes.tsx:72-77` opens a payment session on a settlement visit before the `:91` check,
  so Back onto a closed or voided order's settlement route leaves a session keyed to it.
- A round whose lines are all voided keeps its *MANAGER TO VOID* tag and still counts on the
  floor tile; `FloorScreen.tsx:57` counts voided lines, so a table whose order holds only
  voided lines is drawn open. That is correct (the order is OPEN) and must not be "fixed".
- Void order is drawn off on an empty order (`OrderPanel.tsx:512`); do not change the drawing.
- A time on a voided line, the picture of a rejected void, and the provisional copy already
  flagged in `VoidSheets.tsx`: the owner's or the designer's.
- Anything in `apps/server`, any audit record, any cancellation-ticket record.

## Reporting

Write the Handoff below in full prose: what you built and where, each decision and its
evidence, every existing test you changed and why, the R9 search and what it found, the red
cases you ran (mutate, read the failure, revert), what you found and did not fix, what the
server owes (R18), and the real `npm run verify` output. If a rule here contradicts the code, a
boundary or another rule, build what the question does not affect and end
`BLOCKED: <question>` with a proposed answer.

## Handoff

*(The builder writes this.)*
