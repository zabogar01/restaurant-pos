# ARCH-004 — How may the fixture client apply a discount?

Owner: `architect4`. Written by the lead, 2026-10-02. Read-only consult: you write one report
and touch nothing else. It is the architect consult WORKFLOW.md requires before a task that
touches money, audit or identity is dispatched. ARCH-003
(`.agent/reviews/ARCH-003-refund-in-the-client.md`) answered the same question for the refund;
build on it, and say where the discount differs.

## The question

The owner reviewed the frontend on 2026-10-02 and found that the discount does nothing on a
live order. FE-035 (not yet written; the lead's draft rules are below) makes it real in the
in-memory order book. Two owner rulings are already recorded in `.agent/DECISIONS.md`
(2026-10-02): the discount stays **per order** (FR-F1, B-22), and a **manager-gated** change
uses the refund's stand-in of 2026-10-01 (six digits and the confirm key apply it, no PIN
verified, the digits discarded unread, nothing about an approval stored, removed when the
server command exists). What is not settled is the shape of the operation and what the client
must not pretend, given that a discount, unlike a refund, is gated only for some transitions.

## What exists (verify it; do not take the lead's word)

- `apps/pos/src/discount.ts` is pure and correct: `needsManager` (FR-F8's table),
  `discountAmount`, `orderTotals`, `parseFreeForm` (FR-M5), `snapshotOf` (FR-F4, B-8).
- `apps/pos/src/orderStore.ts` carries `applied?: DiscountSnapshot` and `appliedNote?: string`
  on each order, and `totalsFor` figures the totals from them. **Nothing writes either
  field** after the fixture seed (`:156-157`). The store's mutations are `addLine`,
  `removeLine`, `setQuantity`, `fire`, `close` (on `OrderStore`) and `refund` (on
  `OrderBook`). `fire` and `close` read the lock; the three line mutations do not.
- `apps/pos/src/DiscountSheets.tsx`: every change goes through one door, `change()` (`:53-61`).
  Ungated it calls `go(fixture.landsOn(next))`; gated it opens `ApprovalPrompt`, the
  fixture-routed adapter, whose approve is also only a navigation.
- `apps/pos/src/OrderPanel.tsx:224`: the live sheet is
  `panelDiscount(view, order)`, where `order` is **`shownOrder(view)`, the fixture's order,
  not `store.order`** (`:172-174` says so). So on Table 2 the sheet shows Table 1's Staff meal
  and Table 1's subtotal. `panelDiscount`'s `landsOn` returns the same view
  (`discountFixtures.ts:160`), so a choice changes nothing.
- `apps/pos/src/Approval.tsx`: since FE-032 there is one M-1, `ApprovalDialog`, controlled,
  with `onSubmit(pin)` and `onCancel()`; `ApprovalPrompt` is the adapter the POS-03 sheets use.
- `STAFF_MEAL_NOTE` (`discountFixtures.ts:74`) is *Applied by Ana R. at 19:44. Preset, no
  approval.* The lead ruled on 2026-09-21 that a note belongs to one application event and is
  never derived; an order whose application nobody recorded carries none.
- The close bar draws Discount off under either lock and on an empty order
  (`OrderPanel.tsx`, `OrderActions`, `off`).
- The client keeps no audit record and knows no actor, no manager and no session (FR-A is
  not built).

## The lead's draft rules (confirm, correct or reject each)

- **D1.** One pure operation beside `discount.ts`'s rules, reached as
  `store.changeDiscount(next: DiscountSnapshot | 'remove')` on the active order, returning a
  result value: the change, or a named refusal. It writes `applied` in one update through the
  functional updater; a refusal returns the same order (B-20).
- **D2.** Refusals: the order is closed; a lock holds (this tab's tender draft, FR-G12, or
  another client's lease, FR-G13); `remove` with nothing applied; a value outside FR-M5's
  bounds for the order's subtotal at the moment of the change, checked again inside the
  operation and not only by the sheet.
- **D3.** The operation takes no approval and returns none. The sheet's door asks
  `needsManager` as today: ungated, it calls the operation; gated, it opens `ApprovalDialog`
  and the operation is called from `onSubmit`, whose handler declares no parameter.
- **D4.** A change made in this session records no actor, no approver and no approval flag.
  The order's `appliedNote` is **cleared** by every change, so one discount's note never sits
  under another, and a discount applied in this session shows no note.
- **D5.** The live sheet reads `store.order` (its `applied`, its note, its subtotal), never
  `shownOrder(view)`. The four `?state=sheet-*` fixture addresses keep the artifact's routing
  and never call the operation.
- **D6.** No audit in the client and no mock of one. The Handoff lists what the server owes.
- **D7.** The stand-in is deleted, not kept as a fallback, when the server command exists.

## Answer these

1. **The operation's shape (D1, D2).** Is it right against `docs/ARCHITECTURE.md` and the
   ADRs? Name any refusal that is missing or wrong, and say whether the lock belongs inside
   the operation when `addLine`, `removeLine` and `setQuantity` today do not check it.
2. **The gate with no approval to check (D3).** A refund is always gated; a discount is
   gated for six of eight transitions. An operation that takes no approval cannot refuse an
   ungated call for a gated transition, so the gate would live only in the sheet. Is that
   acceptable for the stand-in, or must the operation itself know the transition is gated
   (for example by refusing `needs-manager` unless the call says the prompt was confirmed)?
   Weigh section 7.1, B-14 and ARCH-003's rule that no approval is held in client state.
3. **What is recorded and shown (D4).** Is clearing the note right? May the client record
   the time of the change, and if so may the change sheet show it (*Applied at 19:44.*
   without a name), or is any such line the owner's copy to rule? Consider FR-A6, B-14, FR-F6
   and the rule that the client must not fabricate identity.
4. **Fixture addresses (D5).** On `?state=sheet-discount` the fixture's order and the book's
   active order are the same Table 1. Is it right that a choice there keeps routing and does
   not write the book (ARCH-003 rule 13), or does that leave a second inert discount?
5. **Money.** A fixed discount is validated against the subtotal when it is applied
   (FR-M5), and `discountAmount` caps it afterwards if lines are removed. Is a snapshot whose
   amount later exceeds the subtotal an honest state under B-8, or must a line removal be
   refused or the discount re-validated? Say what FR-M4, FR-M5 and the ADRs decide and what
   is a recommendation. Also: a 100% comp makes the total zero and the order closes with no
   tenders (`close.ts`); confirm nothing else is needed.
6. **A tender draft and a discount change.** FR-G12 blocks the change while a draft is
   active. Confirm there is no path by which the total moves under drafts already keyed, and
   say what the operation must check to keep it so.
7. **Closed and refunded orders.** POS-05 and POS-06 derive a book order's total through
   `totalsFor(lines, applied)`. Confirm the discount an order closed with is the one they
   show, and name any reader that would not.
8. **Audit and what the server owes (D6).** List the entries FR-F6, FR-J3, AC-8, AC-9 and
   AC-18 require (a preset: actor; a free-form or a gated change: actor and approver; a
   cancelled or failed approval), and anything else Phase 2 must replace: idempotency key,
   expected order version, server time, the preset read from the server.
9. **Anything else** in the draft rules that contradicts `docs/ARCHITECTURE.md`, an accepted
   ADR or a boundary. Push back where the lead is wrong.

## Read

- `docs/ARCHITECTURE.md` and the ADRs in `docs/decisions/` that bear on commands, approvals,
  money and audit.
- `docs/PRD.md`: FR-F1 to FR-F8, FR-A6, FR-G12, FR-G13, FR-J3, FR-M3 to FR-M5, AC-8, AC-9,
  AC-18, AC-21. `docs/BOUNDARIES.md`: B-8, B-12, B-14, B-20, B-21, B-22.
- `.agent/reviews/ARCH-003-refund-in-the-client.md` (sections 4 and 8, *For the task file*).
- The code named under *What exists*, and `apps/pos/src/refund.ts` with
  `orderStore.ts:226-247` for how the refund stand-in was built.

## Constraints

- Do not edit any file except your report. Do not commit. Do not start any other agent.
- Use the file tools to read. Do not run shell commands except the one report line below; a
  shell prompt would wait on the owner.
- A boundary is not subject to your judgement. If a draft rule seems to need one broken, say
  the rule is wrong.
- Separate what the documents decide from what you recommend, and name any question that is
  the owner's (product, contract wording, identity, copy) rather than answering it by
  architecture.

## Reporting

Write `.agent/reviews/ARCH-004-discount-in-the-client.md` in full prose: one section per
question above, each with the answer, the authority it rests on (the ADR, requirement or
boundary by ID) and, where you recommend rather than cite, the alternatives and why they lose.
End with a short list titled *For the task file*: the exact rules the lead should write into
FE-035, and a list titled *For the owner*: anything only the owner can rule.

Then run exactly one of:

    herdr agent prompt lead "architect4: ARCH-004 done — .agent/reviews/ARCH-004-discount-in-the-client.md"
    herdr agent prompt lead "architect4: BLOCKED — <question>"
