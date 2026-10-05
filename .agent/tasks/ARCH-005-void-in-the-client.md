# ARCH-005 — How may the fixture client apply a void?

Owner: `architect5`. Written by the lead, 2026-10-03. Read-only consult: you write one report
and touch nothing else. It is the architect consult WORKFLOW.md requires before a task that
touches money, audit or identity is dispatched. ARCH-003
(`.agent/reviews/ARCH-003-refund-in-the-client.md`) answered this question for the refund and
ARCH-004 (`.agent/reviews/ARCH-004-discount-in-the-client.md`) for the discount; build on both,
and say where the void differs.

## The question

The owner's frontend review found the discount inert on a live order (fixed by FE-035, merged
2026-10-03). The void is inert in the same way: voiding a FIRED line and voiding a whole order
only close the sheet. Removing a PENDING line with its × already works (FR-H2) and is not in
scope. FE-036 (not yet written; the lead's draft rules are below) makes the void real in the
in-memory order book. Two owner rulings are recorded in `.agent/DECISIONS.md` (2026-10-03):

- a manager-gated void (FR-H4) uses the refund's stand-in of 2026-10-01: six digits and the
  confirm key apply it, no PIN verified, the digits discarded unread, nothing about an approval
  stored, removed when the server command exists;
- a voided order is listed nowhere in the POS for now: its table frees, it leaves the floor and
  the quick-sale strip, it is not on POS-05, and the back-office reports count it later.

What is not settled is the operation's shape, what it records (the voided line, the voided
order, the cancellation ticket, the reason), and what the client must not pretend.

## What exists (verify it; do not take the lead's word)

- `apps/pos/src/void.ts` is pure: `voidRule(target)` returns the requirement (FR-H2, H3, H4),
  `approval`, `reason`, `audited` and `cancels` (the FIRED lines a cancellation ticket covers,
  `firedWork`). `givenReason(choice)` turns a listed or typed reason into text, or undefined.
- `apps/pos/src/VoidSheets.tsx`: one sheet for a FIRED line (reached from its row body, I-12)
  and one for the whole order (the close bar's Void order). Its one door, `commit()` (`:53-66`),
  refuses a missing reason, then either calls `go(fixture.landsOn)` (ungated) or opens the
  fixture-routed `ApprovalPrompt` whose approve is also only a navigation. `subjectOf` throws
  if the line is not on the order or is not in a fired group.
- `apps/pos/src/voidFixtures.ts`: `panelVoid` returns `cancel: view, landsOn: view`, so a void
  changes nothing. The three `?state=sheet-voidline|sheet-voidorder|sheet-voidorder-fired`
  addresses land on `default`.
- `apps/pos/src/OrderPanel.tsx:172` and `:334`: the void sheet is handed
  `order = shownOrder(view)`, **the fixture's order, not `store.order`** — the same defect the
  discount sheet had before FE-035. A line added in this session cannot be voided correctly, and
  on a table seeded from `empty` the sheet shows another order's lines.
- `apps/pos/src/orderStore.ts`: the book. `StoreState` has `closed?` and `refunded?`, and
  `statusOf` reports `open | closed | refunded`. `reachedClosed(status)` is `status !== 'open'`
  and is read by `closedOrders.ts:243` (POS-05), `closedOrderDetail.ts:348` (POS-06) and
  `PosRoutes.tsx:91` (Back onto a closed order redirects to the floor). `tableSlot` treats a
  table as taken while it holds an order that is not closed. `totalsFor` already leaves a
  `voided` line out of the subtotal. FE-035's `changeDiscount` (`:452-473`) is the pattern the
  lead expects to follow: facts read at the press, a pure operation, a ref advance for a second
  call in the same tick, the functional updater as the write.
- `apps/pos/src/discountChange.ts` (FE-035, after ARCH-004): the caller passes a **request**,
  never a finished result; the operation itself refuses `needs-manager` unless the call names
  the prompt's door (`through: 'manager-prompt'`, a literal, never stored).
- `apps/pos/src/orderFixtures.ts`: `LineStatus` is `pending | fired | voided`; a voided line
  keeps its place in its round and carries `note?` (the `overflow` fixture's Caesar Salad reads
  *Voided 19:51 · approved by M. Iqbal*). `RoundGroup` is a fired round (`round`, `firedAt`,
  `delivery`) or the pending group. There is no type for a cancellation ticket.
- `OrderPanel.tsx:650-690`: a voided row is drawn struck through and is inert.
- `FloorScreen.tsx:142`: the quick-sale strip lists only orders whose status is `open`.
- `floorFixtures.ts:107` and `closedOrders.ts` know a closed business day (FR-H7) as fixture
  states only.
- The client keeps no audit record and knows no actor, no manager and no session (FR-A is not
  built). Kitchen delivery in the client is only ever `queued` (FE-022).

## The lead's draft rules (confirm, correct or reject each)

- **V1.** One pure operation beside `void.ts`, reached as `store.voidLine(lineId, reason,
  through)` and `store.voidOrder(reason, through)` (or one `store.void(request, through)`; say
  which) on the active order, returning the change or a named refusal. A refusal returns the
  same order (B-20). The gate is decided inside the operation by `voidRule` on the order it
  writes, and `needs-manager` is refused unless `through` is `'manager-prompt'` (ARCH-004).
- **V2.** Refusals, in order: the order is closed, refunded or voided; a lock holds (this tab's
  payment session, FR-G12, or another client's lease, FR-G13); an unknown line; a line that is
  not FIRED (a PENDING line leaves by its ×, a voided one has nothing left); a missing reason
  where FR-H4 requires one, checked again inside the operation; `needs-manager`.
- **V3.** A fired-line void sets that line's status to `voided` in place, in its round; nothing
  else on the line changes. The totals fall through `totalsFor` as they already do. The line's
  `note` is left unset: no approver is named, and no time is shown unless the owner rules copy.
- **V4.** A whole-order void sets one new field, `voided: { voidedAt }`, and is terminal.
  `statusOf` gains `voided`. The table frees; the order leaves the strip; POS-05 and POS-06
  never show it; Back onto its route lands on the floor. The cashier lands on the floor after
  the void.
- **V5.** A void covering fired work records one cancellation ticket on the order: the time,
  the ids of the lines it cancels (`voidRule(...).cancels`, never anything else, B-16), and
  `delivery: 'queued'`. It is not a round, never reuses a round number, is never drawn as a
  fired round, and raises no print incident.
- **V6.** The reason travels in the request and is not stored in the client.
- **V7.** The live sheet reads `store.order`, never `shownOrder(view)`. Following ARCH-004, the
  three `?state=sheet-void*` addresses are live too, over the book's active order.
- **V8.** No audit in the client and no mock of one; no approver, no actor. The Handoff lists
  what the server owes. The stand-in is deleted, not kept as a fallback, when the server command
  exists.

## Answer these

1. **The operation's shape (V1, V2).** Is it right against `docs/ARCHITECTURE.md` and the ADRs?
   One entry point or two? Name any refusal that is missing or wrong (an empty order? an order
   whose only lines are voided? a quick sale?), and say whether a closed business day (FR-H7)
   is a refusal the client can honestly make today or only the server's.
2. **The line void (V3).** Is a status change in place, with the line kept in its round, the
   right record? Is leaving `note` unset right, or may the client show the time of the void
   (*Voided 19:51*) without a name? Weigh FR-A6, FR-J2, B-14 and the refund's owner ruling of
   2026-10-01 (no *approved by* on a client refund). Name what is the owner's copy to rule.
3. **The whole-order void (V4).** A new terminal status changes `reachedClosed`, which three
   readers use to mean "closed or refunded". Say how the book must model it so that POS-05 and
   POS-06 never list a voided order, the table and the strip free, and the Back redirect still
   holds; name every reader of `statusOf`, `reachedClosed`, `isClosed` and `tableSlot` that must
   change, and any that would silently do the wrong thing. Where does the cashier land, and by
   what navigation (the void sheet's `go` only moves within POS-03)?
4. **The cancellation ticket (V5).** Must the client record it at all, given nothing in the
   client draws it and nothing prints? If yes, what is its honest shape (B-15, B-16, FR-E3,
   FR-H4, AC-22) and where does it live; if no, say why that is not a fake absence. Confirm a
   void never waits on it.
5. **The reason (V6).** Is not storing it right, given FR-H4 and AC-11 put it in the audit,
   which the server owns? Does any screen in the client need it after the void?
6. **The gate (V1).** Confirm that the FR-H3 void (an order with nothing fired) needs no
   `through` and no reason, and that the operation must still refuse an ungated call for a
   gated target even if the sheet decided otherwise (ARCH-004, question 2).
7. **The sheets (V7).** The sheet currently throws when its line is not on the order. With
   `store.order` and the live fixture addresses, can that now happen (a line removed, a
   `sheet-voidline` address over an order with no `burger`)? Say what the sheet must do
   instead. Say also what the `APPROVAL_FIXTURES` void addresses must do: stay routing, or call
   the operation.
8. **Money and the discount.** A fired-line void lowers the subtotal under an order discount:
   a percentage moves with it, a fixed one is capped (FR-M5, `discountAmount`). Confirm that is
   honest under B-8 and FR-I5's "before/after reduction in order total", and that a void under
   an active tender draft is impossible (FR-G12) by the operation's own check.
9. **Audit and what the server owes (V8).** List the entries FR-H3, FR-H4, FR-J2, FR-J3, AC-3,
   AC-10, AC-11, AC-18 and AC-22 require, and what else Phase 2 must replace: the
   cancellation-ticket row and its print after commit, FR-H4's emergency incident on FAILED or
   UNKNOWN delivery, FR-H7, idempotency key and expected version (ADR-003), server time.
10. **Anything else** in the draft rules that contradicts `docs/ARCHITECTURE.md`, an accepted
    ADR or a boundary (B-14, B-15, B-16, B-19, B-20 in particular). Push back where the lead is
    wrong.

## Read

- `docs/ARCHITECTURE.md` and the ADRs in `docs/decisions/` that bear on commands, approvals,
  money, printing and audit.
- `docs/PRD.md`: FR-A6, FR-E3, FR-G12, FR-G13, FR-H1 to FR-H7, FR-I5, FR-J2, FR-J3, FR-M5,
  AC-3, AC-10, AC-11, AC-18, AC-22. `docs/BOUNDARIES.md`: B-8, B-14, B-15, B-16, B-19, B-20.
- `docs/design/SITEMAP.md` and `docs/design/SCREEN-INVENTORY.md` on POS-02, POS-03's void
  sheets (F2j) and POS-05.
- `.agent/reviews/ARCH-003-refund-in-the-client.md` and
  `.agent/reviews/ARCH-004-discount-in-the-client.md`, each one's *For the task file*.
- The code named under *What exists*, and `apps/pos/src/discountChange.ts`,
  `apps/pos/src/DiscountSheets.tsx` and `apps/pos/src/Approval.tsx` for how the discount
  stand-in was built.

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

Write `.agent/reviews/ARCH-005-void-in-the-client.md` in full prose: one section per question
above, each with the answer, the authority it rests on (the ADR, requirement or boundary by
ID) and, where you recommend rather than cite, the alternatives and why they lose. End with a
short list titled *For the task file*: the exact rules the lead should write into FE-036, and a
list titled *For the owner*: anything only the owner can rule.

Then run exactly one of:

    herdr agent prompt lead "architect5: ARCH-005 done — .agent/reviews/ARCH-005-void-in-the-client.md"
    herdr agent prompt lead "architect5: BLOCKED — <question>"
