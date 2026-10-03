# ARCH-005 — How the fixture client may apply a void

Author: `architect5`, 2026-10-03. Read-only consult for FE-036 (not yet written). Nothing was
edited except this report, and nothing was committed.

## Summary

1. **The operation (V1, V2): right in outline.** Two entry points, `store.voidLine` and
   `store.voidOrder`, over one pure module beside `void.ts`. Two, because the architecture has
   two commands (ADR-003 lists them separately). The refusals are right with one constraint on
   their order: `unknown-line` and `not-fired` must come before any call to `voidRule`, which
   throws on a voided line. An empty order, an order whose only lines are voided, and a quick
   sale are **not** refusals. A closed business day is the server's refusal only; the client
   cannot honestly make it, and for an open order FR-I2 makes it unreachable outside a race.
2. **The line void (V3): confirmed.** Status changed in place, line kept in its round, amount
   untouched, `note` unset. A time without a name is not forbidden; whether to show it is the
   owner's copy.
3. **The whole-order void (V4): the record is right, the predicate is not.** Adding `voided`
   to `OrderStatus` while `reachedClosed` stays `status !== 'open'` makes that name false and
   leaves POS-05 and POS-06 correct only by accident. Worse, five readers of `isClosed` would
   silently treat a voided order as open: the table would never free, and a close or a discount
   change on a voided order would report success. All are listed in section 3. The cashier
   lands on the floor by replacing the history entry, as Close does.
4. **The cancellation ticket (V5): I recommend the client does not store one.** Nothing reads
   it, and the client already keeps no receipt for a close on the same reasoning. The rule
   that matters (B-16: only the fired work cancelled) is returned by the operation and tested
   there. This is a recommendation, with the stored shape given if the lead keeps V5.
5. **The reason (V6): confirmed.** Checked inside the operation, then dropped. No screen
   reads it after the void, which is where the void differs from the refund.
6. **The gate: confirmed, and it matters more here than for the discount.** The gate is a
   function of line status, and the sheet today reads a different order from the one written.
7. **The sheets (V7): the throw becomes reachable.** With `store.order`, a fixture address
   can sit over an order that has no fired `burger`, and `voidRule` throws on a line voided a
   moment ago. A void sheet whose target is not a FIRED line of the order is not drawn. The
   four `?state=approval*` addresses stay routing only.
8. **Money: confirmed.** FR-I5 itself anticipates that the reduction in total differs from the
   line's value. The operation's own `locked` check is what makes a void under a tender draft
   impossible.
9. **Audit and what the server owes:** listed. Unlike the discount, both void commands carry
   an **idempotency key** (ADR-003).
10. **Pushback:** nine points, collected in section 10.

## What I verified

Read with the file tools: the task file; `docs/ARCHITECTURE.md`, `docs/PRD.md`,
`docs/BOUNDARIES.md`, `docs/design/SITEMAP.md` and `docs/design/SCREEN-INVENTORY.md` whole;
ADR-003, ADR-005 and ADR-007; `.agent/DECISIONS.md` (the task cites its 2026-10-03 rulings);
ARCH-003's and ARCH-004's reports whole; and in `apps/pos/src`: `void.ts`, `VoidSheets.tsx`,
`voidFixtures.ts`, `orderStore.ts`, `discountChange.ts`, `DiscountSheets.tsx`,
`discountFixtures.ts`, `Approval.tsx`, `approvalFixtures.ts`, `OrderPanel.tsx`,
`orderFixtures.ts`, `sheetFixtures.ts`, `menuFixtures.ts`, `fire.ts`, `close.ts`,
`paymentSession.ts`, `PosRoutes.tsx`, `FloorScreen.tsx`, `floorFixtures.ts`,
`closedOrders.ts`, `closedOrderDetail.ts`, `navigation.ts`, and `SettlementScreen.tsx` lines
560 to 889 only.

The lead's account under *What exists* holds, with these precisions:

- **`voidRule` throws.** `void.ts:50` throws on a line whose status is `voided`. The sheet
  calls it on every render (`VoidSheets.tsx:50`). This matters for questions 1 and 7.
- **The fixture order reaches the sheet at `OrderPanel.tsx:172` and `:334`**, as the lead
  says. The same component also derives `inert` from whether a void fixture exists (`:265`),
  not from whether a sheet is drawn. This matters for question 7.
- **The strip has two status checks,** `FloorScreen.tsx:137` (the fixture's own sale) and
  `:142` (every other). Both compare against `'open'`.
- **The tile reads the table through the book,** not through a status: `tileFor`
  (`FloorScreen.tsx:76-105`) calls `openOrderIdOf` and `hasOrderFor`, which rest on
  `tableSlot` and so on `isClosed`.
- **`floorFixtures.ts:107` is a sentence of copy,** the closed-day banner's body. The closed
  day is the `dayClosed` flag on the `dayclosed` fixture (`:87`). No book order has a
  business day.
- **`ApprovalPrompt` does not pass `requireFull`** (`Approval.tsx:113-126`), and the void
  sheet uses it (`VoidSheets.tsx:181`). The owner's ruling says six digits.
- **The artifact lands an unfired order's void on the floor.** `voidFixtures.ts:53-58` says
  so, and says the client "does not have" a floor. It has had one since FE-026.

Not read: any test file, `discount.ts`, `refund.ts`, `tender.ts`, `Sheets.tsx`,
`MenuRegion.tsx`, `PinPad.tsx`, `ClosedOrderScreen.tsx`, `ClosedOrdersScreen.tsx`,
`IncidentsScreen.tsx`, the rest of `SettlementScreen.tsx`, `packages/money`, and ADR-001, 002,
004 and 006. I had no search tool, so every list of readers below is what I found by reading
the files above, not the result of a search. No library or API fact was needed, so the
librarian was not asked.

---

## 1. The operation's shape (V1, V2)

### What the documents decide

- The POS "never owns committed order, money, receipt, approval, or print state" (ARCHITECTURE
  section 4.1). Clients "send explicit commands, not replacement aggregates or requested
  status values" (section 4.4). The surface is `void` under `/api/pos/orders/…` (section 13).
- Whole-order void and fired-line void are **two commands**: ADR-003 and section 8 list them
  as items 4 and 5 of the seven that carry an idempotency key. FR-J3 lists them as two audited
  actions and FR-I5 reports them on two lines.
- `OPEN → VOIDED` is an order transition and `VOIDED` is terminal (section 6.1, B-10).
  `FIRED → VOIDED` is a line transition "with inline manager approval, reason, audit, and a
  kitchen cancellation ticket" (section 6.1, FR-H4).
- Removing a PENDING line is a different command ("add/edit/remove pending line", section 13),
  ungated and unaudited (FR-H2).
- A lease, and separately this tab's own tender draft, block void (section 6.3, FR-G12,
  FR-G13, AC-21, AC-29).
- A refusal leaves the order exactly as it was (B-20).

### V1: confirmed, as two entry points

```ts
store.voidLine(lineId, reason, through);            // a FIRED line on the active order
store.voidOrder(reason, through, voidedAt);         // the active order
```

Both sit over one pure module beside `void.ts` (its own file, so that removing the stand-in
is a file deletion, as ARCH-004 argued for `discountChange.ts`; `void.ts` stays, because the
sheet still asks `voidRule` what to draw). The module reads no clock and imports no React and
no fixture. Each function returns the changed order, or the very same order with a named
refusal.

*The alternative*, one `store.void(request, through)` over a request union, loses on three
counts. The server's seam is two commands, so Phase 2 would split it again. The two have
different results: a line void stays on POS-03, an order void is terminal and leaves it. And
the two have different refusals (`unknown-line` and `not-fired` belong to the line only). A
small extra reason: `void` is a reserved word, so the method could not be destructured.

The write follows `changeDiscount` (`orderStore.ts:452-473`): facts read at the press through
the context ref, the pure operation evaluated against the latest book, the ref advanced, and
the same operation run again inside the functional updater through `update`. There is no
by-id path. As with `changeDiscount`, make the methods optional on `OrderStore` and required
on `LiveOrderStore`, so a test's hand-built store need not supply them.

`reason` is `string | undefined`. `through` is required, with no default (question 6).
`voidedAt` is an argument, as `closedAt` is. `voidLine` takes no time: under V3 and section 4
nothing it writes carries one.

### V2: the refusals

Checked in this order, so the answer is deterministic:

1. `not-open`: the order is closed, refunded or voided (FR-H1, B-10). With no active order,
   the same answer.
2. `locked`: this order's own payment session, or the place's lock, `draft` or `lease`
   (FR-G12, FR-G13). One refusal, as `fireOrder` and `changeDiscount` have; the two locks'
   words stay the screen's.
3. `unknown-line` (line void only): the order holds no line with that id.
4. `not-fired` (line void only): the line is PENDING or VOIDED.
5. `no-reason`: `voidRule` says a reason is required and the reason is empty after trimming
   (FR-H4).
6. `needs-manager`: `voidRule` says approval is required and `through` is not
   `'manager-prompt'`.

**The constraint on the order.** Checks 3 and 4 must run before `voidRule` is called, because
`voidRule` throws on a voided line (`void.ts:50`). This is the same trap ARCH-004 named for
`nothing-to-remove` and `needsManager`. The result is a value, never a throw.

`not-fired` for a PENDING line is right, and it is not AC-3's "voiding an unfired line". That
act is the remove command, reached by the row's ×, and the client must not route a void call
onto it: an operation that quietly removed a pending line would be an unaudited path with the
void's name.

### Not refusals

- **An empty order.** FR-H3 covers it: it holds no FIRED line. No requirement refuses it, and
  on the server it has to be voidable, because FR-I2 refuses end-of-day while any order is
  OPEN and names settle or void as the two ways out. The close bar draws Void order off on an
  empty order (`OrderPanel.tsx:512`); that is a drawing decision, and the operation must not
  turn it into a rule. See *For the owner*, 3.
- **An order whose only lines are voided.** `firedWork` is empty, so `voidRule` answers
  FR-H3: no approval, no reason, nothing to cancel. That is correct by the letter of FR-H3 (a
  VOIDED line is not a FIRED line) and by B-16 (each line's own void already cancelled its
  work; a second ticket would cancel nothing).
- **A quick sale.** Nothing on it is fired before close (FR-E5), so its void is always
  FR-H3, and `voidLine` on it always answers `not-fired`. No special case.

### A closed business day (FR-H7)

**The server's only.** Two reasons, both from the documents.

- An order belongs to the business day open when it was created (FR-I1), and a day cannot
  close while any order is OPEN (FR-I2, section 6.6). So every OPEN order belongs to the open
  day. For a void, FR-H7 can only bite in a race between the void and the day close, which
  the server settles by locking the BusinessDay before changing reportable facts (section 8).
- The book has no business day, and POS-03 has no drawn picture of a void refused for a
  closed day.

ARCH-003 gave the refund a `day-closed` input fact. That does not carry over: a closed order
on a closed day is an ordinary state with a reviewed picture (`day-refusal`), and an open
order on a closed day is not a state at all. *The alternative*, an input fact no caller can
set, is pretend infrastructure. The Handoff lists FR-H7 as owed.

---

## 2. The line void (V3)

### What the documents decide

- "Voided lines remain historical and are excluded from current order totals" (section 6.1).
  The subtotal is the "sum of non-voided line totals" (PRD section 4, step 1).
- A KitchenTicket is immutable and holds the lines fired in its round (section 5.1). The line
  was on that ticket and stays in that round.
- The line's snapshot does not change (B-8). FR-I5 reports a fired-line void's "tax-inclusive
  line snapshot value", so the amount must survive the void.
- A VOIDED line "is struck through and inert" (SCREEN-INVENTORY, POS-03 line states).

### Confirmed

Set the one line's `status` to `voided`, in place, in its round. Change nothing else on the
line: not `amount`, not `unitPrice`, not `quantity`, not `modifiers`. Do not use `dropLine`:
dropping a fired line is FR-H2's unaudited removal applied to fired work. The round group
stays even when every line in it is voided, and keeps its number, time and delivery.

### `note` and the time

**What is decided.** No approver is named and nothing says *approved* (owner, 2026-10-01 and
2026-10-03; B-13, B-14; ARCH-003 question 3). `note` is documented as "when, and who approved
it" (`orderFixtures.ts:54`), and the `overflow` fixture's *Voided 19:51 · approved by M.
Iqbal* stays fixture copy, exactly as *approved by M. Iqbal* stayed on the fixture `refunded`
picture.

**What is not forbidden.** A time is not an identity and not an approval, so FR-A6, B-13 and
B-14 do not reach it. The owner's refund ruling shows a time without a name
(`REFUNDED · <HH:MM>`). FR-J2's timestamp is the audit entry's, which is the server's; a
client time would be a browser clock that server time later replaces (section 14.4), as
`firedAt` and `closedAt` are.

**What I recommend.** V3 as drafted: `note` unset, no time recorded on the line.

- The refund had to say something, because the REFUNDED notice is that state's whole picture.
  A voided row is already unmistakable: it is struck through and inert.
- `note` takes the place of the modifiers in the row (`OrderPanel.tsx:708`). A partial note
  would hide what the line was in exchange for a clock reading.
- A sentence written into a field documented as the approval record is where a later reader
  looks for the record.

**The owner's copy to rule:** whether a line voided in this session reads *Voided 19:51*. If
the owner wants it, the rules are ARCH-004's for the discount time: the time is an argument,
never read inside the operation; it is stored as its own field on the line, not baked into
`note`; it is shown as the rounds show theirs; and the line carries no name and none of the
words *approved*, *approval* or *manager*.

---

## 3. The whole-order void (V4)

### The record: confirmed

`StoreState` gains `voided?: { voidedAt: string }`, set once and never unset, as `closed` and
`refunded` are. The status is derived from its presence and stored nowhere else. Nothing else
on the order changes: the lines keep their statuses, and the discount stays.

Leaving the lines alone is deliberate. FR-I5 values a whole-order void at "the order total
immediately before void", and with the lines untouched that figure is still derivable.
Section 6.1 does not say whether a whole-order void also moves each line to VOIDED; that is
Phase 2's schema, and the client must not answer it by invention.

`voidedAt` has no reader today. I accept it because it is the record's body, in the shape its
two siblings have, and costs one argument. It is an ISO instant from the caller's clock, like
`closedAt`.

### The predicate: V4 is wrong as drafted

`reachedClosed` is `status !== 'open'` (`orderStore.ts:189`). Its comment, and FR-I5's use of
the phrase, mean CLOSED or REFUNDED: "every order that reached `CLOSED`". A voided order
never reached CLOSED. If `statusOf` gains `voided` and the predicate is left alone:

- `bookRows` (`closedOrders.ts:243`) and `bookDetail` (`closedOrderDetail.ts:348`) stay
  correct, but only because each also requires `closedAt`. The owner's ruling that a voided
  order is not on POS-05 would rest on a second clause nobody wrote for that purpose.
- The predicate's name would be false, and the next reader that trusts it (a count, a report
  line) would count voids as sales.

**Two predicates, by name:**

```ts
/** CLOSED or REFUNDED: the orders POS-05 lists and FR-I5 counts. */
export const reachedClosed = (s: OrderStatus) => s === 'closed' || s === 'refunded';
/** Anything but OPEN, VOIDED included: the table is free and nothing may change. */
export const noLongerOpen = (s: OrderStatus) => s !== 'open';
```

and one private `isOpen(o)` in the store: neither `closed` nor `voided` is set.

*The alternative*, keeping one predicate and relying on `closedAt`, loses for the reason
ARCH-003 gave for a third status: a reader that forgets must fail visibly and safely, not
silently.

### Every reader, and what it does today with a voided order

| Reader | Today | With a voided order, unchanged | Must become |
|---|---|---|---|
| `statusOf` (`orderStore.ts:191`) | `open \| closed \| refunded` | reports `open` | reports `voided` first |
| `tableSlot` (`:196`), so `openOrderIdOf`, `openTable` and the tile | open is `!isClosed` | **the table never frees; the next press reopens the voided order** | open is `isOpen` |
| `update` (`:360`) | refuses a closed order | **add, remove, quantity, `?gone=` and fire all write a voided order** (B-10) | refuses unless `isOpen` |
| `close` pre-check (`:442`) | refuses a closed order | **returns `true` for a voided order**, and the settlement screen leaves as if it had closed | refuses unless `isOpen` |
| `changeDiscount` facts (`:458`) | `closed: isClosed(order)` | **advances the ref and answers success** for a voided order while `update` writes nothing | `closed: !isOpen(order)` |
| `refundInBook` (`:254`) | `closed: isClosed(held)` | answers `not-closed` | no change; this is right (B-19) |
| `bookRows` (`closedOrders.ts:243`) | `reachedClosed` and `closedAt` | right by the second clause | right by the first, once narrowed |
| `bookDetail` (`closedOrderDetail.ts:348`) | the same | the same | the same |
| `PosRoutes.tsx:91` | `reachedClosed` | right, by today's wide meaning | **must read `noLongerOpen`**; with a narrowed `reachedClosed` and no change here, Back onto a voided order draws live controls |
| `FloorScreen.tsx:137`, `:142` | `status === 'open'` | lists it, because the status says `open` | no change, once `statusOf` is right |
| `closedOrders.ts:257` | `status === 'refunded'` | right | no change |

The four rows in bold are the ones that do the wrong thing silently. Three of them are not
about lists at all: they let a terminal order be changed, or report a success that did not
happen.

With those in place the owner's ruling holds by construction: the table frees (`tileFor`
finds no open order and returns the free tile, and the next press takes `table-9-2`), the
strip drops it, POS-05 and POS-06 never see it, and it cannot be refunded.

### Where the cashier lands

**The floor.** SCREEN-INVENTORY says POS-02 is "returned to after close, void, or abandoning
an order", and the artifact lands the unfired void there (`voidFixtures.ts:53-58`).

**By what navigation.** As Close does (`SettlementScreen.tsx:692-696`): replace the current
history entry with `/pos/floor`, then tell the owner of the location (`onLocationChange`).
Replace, not push, so Back cannot return to the workspace of a voided order. The sheet does
not do this through `go`; an order void's landing is not a `?state=` view and is not a
property of a fixture. The order screen owns it, and does it only after the operation
answered without a refusal.

`PosRoutes`' redirect (`:91-97`) stays as the guard for Back and Forward. *The alternative*,
navigating nowhere and letting that redirect carry the cashier, would work today, and loses
because it makes a guard into the primary path: the landing would exist only as a side effect
of a check written for something else.

A line void lands where the sheet's fixture says: the same view for a panel-opened sheet.

The standalone `OrderScreen` wrapper has no floor. The landing is asserted in a routed test;
no voided-order picture is invented for the wrapper (owner, 2026-10-03).

---

## 4. The cancellation ticket (V5)

### What the documents decide

- The void's transaction "creates one immutable kitchen cancellation ticket containing only
  the previously fired work being cancelled" (FR-H4, section 6.2, AC-22).
- It is a correction, never a fire, and never reissues the work (B-16).
- Printing is after commit and "never gates or rolls back the void" (FR-H4, B-15, ADR-005).
- FAILED or UNKNOWN delivery creates an emergency incident (FR-H4, FR-E3).

All of that is the server's: the ticket, its PrintJob, its attempts and its incident.

### Must the client record it? I recommend not

V5 stores a ticket on the order with `delivery: 'queued'`. I recommend the book stores
nothing, and the pure operation **returns** what the ticket would cover:

```ts
{ order, cancels: ReadonlyArray<string> }   // ids of the FIRED lines this void cancelled
```

- **Nothing reads it.** No screen draws a cancellation ticket. POS-07 is fixture-driven and
  does not read the book. ARCH-004's rule applies: a field stored for no reader is a field
  with no consumer.
- **The client's own precedent.** A close on the server stores a Receipt and a receipt
  PrintJob (section 6.4); the client's close stores neither and says nothing about a receipt
  (`SettlementScreen.tsx:686-691`). A fire is recorded as a round only because the panel
  draws rounds and their delivery (I-7). The rule the client already follows is: it holds
  what a client screen reads, and the Handoff lists the rest as owed.
- **`delivery: 'queued'` would be a claim.** It means "committed, delivery not yet known". On
  a round the cashier sees that claim and can act on it. On a ticket nobody sees, it is a
  delivery state that can never advance and can never raise the incident FR-H4 requires.
- **It guesses the schema.** There is no type for it today. Inventing one now fixes fields
  (a sequence, a time, a line list) ahead of the Phase 2 design that owns them.

**Why that is not a fake absence.** A fake absence would be a place where tickets are listed
and this one is missing, or a screen saying no ticket was needed. The book has no such place,
as it has none for receipts or audit entries, so the absence asserts nothing. What B-16 and
AC-22 need from the client is the rule, and the rule keeps an executable form: the operation
takes `voidRule(...).cancels` from the order it writes and returns exactly those ids. A test
asserts that a line void returns that one line, that an order void returns the lines still
FIRED and no PENDING or VOIDED one, and that an FR-H3 void returns none.

*If the lead keeps V5,* the honest shape is
`cancellations?: ReadonlyArray<{ at: string; lineIds: ReadonlyArray<string> }>` on
`StoreState`, appended once per void that covers fired work, never merged, never a
`RoundGroup`, never numbered as a round, and with **no `delivery` field**. It loses to
returning the ids because it is state without a reader.

### A void never waits on it: confirmed

The operation is synchronous and has no print step. No pending, sending or printing state is
drawn, no copy after the void mentions paper, and the result does not depend on anything
about a ticket (B-15). A live void raises no print incident, as a live fire raises none.

---

## 5. The reason (V6)

**Confirmed: the reason travels in the request and is not stored.**

FR-H4 requires it and AC-11 puts it in the audit entry, which the server owns (FR-J2,
ADR-007). The contract gives it no other home; the cancellation ticket is not said to carry
it.

**No client screen needs it after the void.** The manager prompt shows it before the void, in
the request text. A voided row shows no reason, in the artifact or the fixtures. A voided
order is listed nowhere (owner, 2026-10-03). This is where the void differs from the refund:
the refund record keeps its reason only because the reviewed REFUNDED notice prints it.

Three rules follow.

- The operation checks the reason itself and refuses `no-reason`, whatever the sheet did.
  Passing it is not ceremony: it is the command's shape and the stand-in for the server's
  validation.
- The reason shown in the prompt is the reason submitted (ARCH-003, question 8, rule 1). The
  prompt's `onSubmit` passes the reason captured when the prompt opened, not a fresh read of
  the sheet's state.
- The reason is not logged and not kept in a ref or the URL. It is free text.

---

## 6. The gate

**Confirmed on both points.**

**FR-H3 needs no manager and no reason.** `voidRule` answers `approval: false, reason: false`
for an order with no FIRED line. One precision on the draft's wording: `through` is still a
required argument. The FR-H3 call passes `'direct'`. What it does not need is
`'manager-prompt'`.

**The operation refuses an ungated call for a gated target, whatever the sheet decided.** It
calls `voidRule` on the target as the store holds it, in the same update that writes, and
refuses `needs-manager` unless `through` is `'manager-prompt'`.

This matters more for the void than it did for the discount. The gate is a function of line
status. Today the sheet reads `shownOrder(view)`: at `?state=sheet-voidorder` that is the
fixture's unfired order, for which the answer is FR-H3. Had the operation existed without its
own check, a cashier at that address over an order holding fired work would have voided it
with one press, no reason, and no word to the kitchen. The rule from ARCH-004 stands:
whatever writes decides the gate, on the state it writes.

The rest of ARCH-004's question 2 applies unchanged. `'manager-prompt'` is a literal inside
M-1's `onSubmit` and nowhere else; it is never stored in state, a ref, the order, the URL or
a prop; it is never named *approved* or *confirmed*; and a call through it for a target that
turns out to be ungated applies, because the value only ever unlocks.

---

## 7. The sheets (V7)

### V7's first sentence: confirmed

The live sheet reads `store.order`. Following ARCH-004's question 4, the three
`?state=sheet-void*` addresses are live too: on POS-03 a `?state=` address chooses what is
drawn around the one live order, never a different order.

### Can the throw now happen? Yes, three ways

`subjectOf` throws when the line is not on the order or not in a fired group
(`VoidSheets.tsx:280`, `:284`), and `voidRule` throws on a voided line (`void.ts:50`).

1. **A fixture address over another order.** `sheet-voidline` names `burger`. `?state=` does
   not reseed and does not choose the order, so a history entry at that address, reached with
   Table 9 active, sits over an order with no `burger`.
2. **A line voided in this session.** The same address over Table 1 after its Burger was
   voided finds the line, in a fired group, with status `voided`. `subjectOf` passes and
   `voidRule` throws.
3. **The render after a successful line void.** If the sheet renders once between the store's
   write and its own closing, it is case 2. Today the write and the close would share one
   event handler and be batched, so it does not happen. A sheet that is correct only because
   of batching is not correct.

### What the sheet must do instead

**A void sheet whose target is not a FIRED line of the store's order is not drawn.** This is
`panelLine`'s rule already (`sheetFixtures.ts:245-247`): "there is nothing to draw". No error
notice and no new copy. The order void's sheet always has a subject.

The decision must be made where `voiding` is computed, not inside `VoidSheet`. `inert`
(`OrderPanel.tsx:265`), the focus return and `overlayAt` all read whether a void fixture
exists. A sheet that returned `null` while its fixture stayed truthy would leave the whole
frame inert under nothing.

`subjectOf` becomes a function that returns `undefined`, and the sheet calls `voidRule` only
on a subject it has.

### The door

`VoidSheet` stops using `ApprovalPrompt` and its `STAY` identity trick, and uses
`ApprovalDialog` as `DiscountSheets.tsx:152-162` does: `requireFull` (the owner's ruling says
six digits), an `onSubmit` handler that declares no parameter and calls the operation with
`'manager-prompt'`, and `onCancel` returning to the sheet exactly as it was, reason kept
(B-20). No footnote: the refund's *Approves this refund only.* is not this action's (B-19).
The comment at the call site says confirm stands for the server accepting the command and
that nothing is verified.

On a refusal: M-1 closes if open, the sheet stays, nothing routes, no new copy (ARCH-004,
rule 11). A test hands the sheet a store whose operation refuses.

### The `APPROVAL_FIXTURES` addresses: stay routing

ARCH-004 kept them because the store could not perform a void. Now it can, and I still
recommend they stay as they are, through `ApprovalPrompt`. The reason has changed.

- **They are pictures of M-1, not doors.** Three of the four picture a server's answer (a
  wrong PIN, the cooldown, a PIN that is not a manager's). Making confirm apply a void under
  *PIN not recognised* would act out the opposite of what the picture says.
- **Their request is a fixture's.** *Burger 135.000 — reason: customer changed their mind* is
  a line nobody tapped and a reason nobody chose. `voidFixtures.ts:25-28` already rules that a
  reason chosen in a fixture is "a void recorded with a reason nobody gave" (FR-H4). And the
  object shown would not be the object submitted, unless the request were rebuilt from the
  store, which makes it a different picture.

So confirm at `?state=approval` goes on routing to `default` and changes nothing. That is an
inert control at a review address, and it is the lesser harm; the comment on
`APPROVAL_FIXTURES` should say these four addresses perform nothing. The live path to a void
is the sheet. `ApprovalPrompt` then serves these four addresses only.

---

## 8. Money and the discount

### Confirmed, by the documents

- The subtotal is the sum of non-voided lines, and the discount, service charge and tax follow
  from it at order level (PRD section 4, FR-M4). `totalsFor` already does this
  (`orderStore.ts:208-212`).
- The discount's snapshot is its name, kind and value, and does not move (B-8, FR-F4). The
  amount taken is recomputed: a percentage follows the subtotal, a fixed amount is capped at
  it (FR-M5; ARCH-004, question 5).
- **FR-I5 states the consequence itself.** A fired-line void is reported with its
  "tax-inclusive line snapshot value, and the before/after reduction in order total. These
  differ whenever an order-level percentage discount or service charge applies." The two
  figures are expected to differ. With *Service recovery — 50.000 off* on 165.000, voiding
  the 135.000 Burger leaves a subtotal of 30.000, a capped discount of 30.000 and a total of
  zero: the line's value is 135.000 and the total fell by 120.750.

A void never re-validates, shrinks or drops the discount. That would be a discount change
nobody chose, and for a free-form discount an ungated one (FR-F8).

The client records neither report figure. The line keeps its amount, so the first is
derivable; the before and after totals belong to the server's audit entry (FR-J2). The
manager prompt already shows the right figure in each case: the line's amount for a line, the
order's total before the void for an order.

An order whose lines are all voided has a total of zero. It may be closed with no tenders
(FR-G11) or voided under FR-H3. Both are honest.

### A void under a tender draft

**Impossible by the operation's own check, and only by that.** The operation refuses `locked`
when this order has an active payment session or the place carries a lock, read at the moment
of the call through the store's context ref, as `changeDiscount` reads it.

The screens also leave no path: under either lock no row is a control and the close bar is
off. That is an argument about what is drawn, and ARCH-004's question 6 explains why it is
not enough: `closeOrder` accepts the drafts it is given, so a line voided under a card
drafted for the whole balance would close with "change" against a card (B-5).

---

## 9. Audit and what the server owes (V8)

**V8 is right.** No audit in the client and no mock of one, for ARCH-003's reasons (ADR-007,
B-7, B-13). No actor, no approver, no approval flag, and never `approver: null`.

### The entries

1. **A whole-order void with nothing fired** (FR-H3). One entry naming the initiating actor
   and no approver: action, outcome, order, timestamp and before and after amounts, in the
   same transaction as `OPEN → VOIDED` (FR-J2, FR-J3, ADR-007). Exactly one (AC-10). No
   reason is required.
2. **A fired-line void** (FR-H4). One **combined** entry naming actor and approver, with the
   reason, the order and the line, and the order total before and after, in the same
   transaction as `FIRED → VOIDED`, the cancellation ticket and its PrintJob (AC-11, AC-18,
   AC-22, section 11).
3. **A whole-order void holding fired work** (FR-H4). One combined entry naming actor and
   approver, with the reason, in the same transaction as `OPEN → VOIDED` and one cancellation
   ticket for the work still FIRED (AC-10, AC-18).
4. **A cancelled approval.** Cancel or Escape in M-1: one entry naming the initiating actor,
   `approver = null`, outcome cancelled, in its own short transaction. If it cannot commit,
   the request fails (ADR-007; AC-3's "refused when cancelled"). Cancelling the sheet before
   M-1 opens writes nothing.
5. **A failed approval.** A wrong PIN, or a valid PIN that is not a manager's: one entry
   naming the initiating actor with `approver = null`, and a count against the
   `MANAGER_APPROVAL` throttle (FR-A5, FR-J3, AC-18).
6. **Nothing** for the removal of a PENDING line (FR-H2, AC-3).
7. **No PIN value in either store, in any form** (FR-J4, B-12).

### What else Phase 2 must replace

- **The cancellation ticket.** An immutable KitchenCancellationTicket holding only the work
  that one void cancelled, visibly distinct from a work ticket, with its PrintJob in the same
  transaction, dispatched after commit (FR-H4, AC-22, B-16, ADR-005).
- **The incident.** FAILED or UNKNOWN delivery raises the emergency incident in both clients;
  a reprint is a new PrintAttempt against the same document, never a new cancellation
  (FR-H4, FR-E3, ADR-005).
- **An idempotency key on each command.** Whole-order void and fired-line void are two of the
  seven (ADR-003, section 8). This is where the void differs from the discount, which has
  none. The key's scope is actor, command type, subject and key.
- **The expected order version.** A void never uses blind last-write-wins (section 8, NFR-4).
- **FR-H7 and B-9,** enforced under the BusinessDay lock (section 8).
- **The lease:** `LEASE_HELD` (FR-G13). This tab's draft guard stays a client rule.
- **Server time** for the void and the ticket (section 14.4).
- **The actor and the approver:** the actor from the POS session, the approver from the PIN
  inside the command. A manager who starts a void still enters a PIN (section 7.1, AC-27).
- **The persisted state:** `VOIDED` on the order, the table freed by the one-open-order
  constraint, authoritative totals after a line void, and FR-I5's two void lines.
- **The pictures of a server's answer.** The in-flight state, and a rejected void
  (`VERSION_CONFLICT`, `LEASE_HELD`, a closed day). None is drawn for POS-03.

### Undecided, to be named in the Handoff and not assumed

- **An approved void that the server then refuses.** FR-J3 and AC-18 define the `REFUSED`
  entry for a refund only. Open since ARCH-004 (*For the owner*, 3).
- **The key and a second PIN entry.** A retry with the same key must resend the command, and
  the command carries a PIN the client must not keep. Whether a new entry after a wrong PIN
  is a new key, and whether the PIN is part of the request fingerprint, is Phase 2
  architecture and an ADR then.
- **The order of the server's checks,** and **which exits from M-1 count as cancelled.** Both
  carried from ARCH-003 and ARCH-004.
- **Whether a whole-order void also moves each line to VOIDED.** Section 6.1 does not say.
- **Where the offered reasons come from.** The lists are fixture copy. Whether void reasons
  are configuration (B-24) or fixed is not stated.
- **Cancelling work the kitchen never saw.** A fired line whose own ticket is FAILED or
  UNKNOWN (Table 9's fixture) still gets a cancellation ticket under FR-H4.

---

## 10. Anything else in the draft

1. **V4 leaves `reachedClosed` meaning two things,** and five readers of `isClosed`
   unguarded (question 3). This is the most serious point: without it a voided order holds
   its table and can be closed.
2. **V5 stores a document with no reader** and a delivery state that cannot advance
   (question 4).
3. **V2 must put `unknown-line` and `not-fired` before `voidRule`,** which throws
   (question 1).
4. **V7 is silent on three things:** the sheet with no subject, the `approval*` addresses,
   and the order void's landing, which is not a `?state=` view (questions 3 and 7).
5. **The sheet's prompt accepts fewer than six digits** (`ApprovalPrompt` has no
   `requireFull`). The owner's ruling says six.
6. **The acceptance criteria must not claim AC-3, AC-10, AC-11, AC-18, AC-21 or AC-22.**
   FE-036's tests prove the client's behaviour. ADR-002 and section 14 place those criteria
   against real PostgreSQL and the real server. Say once that they stay open.
7. **Two sentences on the sheet describe things this build does not do.** *A cancellation
   ticket will print in the kitchen* and *The void is recorded against your name* are the
   reviewed artifact's words for what the product does. I recommend they stay: they are the
   same kind of statement as *MANAGER REQUIRED* over a prompt that verifies nothing, which
   the owner accepted as a stand-in. What the client must not do is say anything of the kind
   **after** the void: no *ticket sent*, no *void recorded*, no status line. Disclosed to the
   owner below.
8. **B-19.** The stand-in must not borrow from the refund: its own module, its own record,
   its own status, no shared footnote, and no path by which a voided order reaches POS-05,
   POS-06 or `refund`. `refundInBook` already answers `not-closed` for it.
9. **Found, and not FE-036's to fix.**
   - `addLine`, `removeLine` and `setQuantity` still check no lock (ARCH-004, rule 16).
   - `PosRoutes.tsx:72-77` opens a payment session on a settlement visit before the
     `:91` check, so Back onto the settlement route of a closed or voided order leaves a
     session keyed to it. It exists today for closed orders.
   - A round whose lines are all voided keeps the tag *MANAGER TO VOID* over rows that
     cannot be tapped, and still counts as a round on the floor tile. Design.
   - `FloorScreen.tsx:57` counts voided lines, so a table whose order holds only voided
     lines is drawn open. That is correct (the order is OPEN and must be closed or voided)
     and must not be "fixed" into a free table.

V1, V3, V6 and V8 stand as drafted. No boundary is broken by the draft. B-10, B-14, B-15,
B-16, B-19 and B-20 are each consistent with what is proposed here.

---

## For the task file

Rules for the *Architect consult* section of FE-036, in the lead's words or these.

1. **Stand-in.** A void on a live order is made by a pure module of its own beside `void.ts`,
   reached as `store.voidLine(lineId, reason, through)` and
   `store.voidOrder(reason, through, voidedAt)` on the active order. The module reads no
   clock and imports no React and no fixture. Its header says it stands in for the server's
   two void commands (ARCHITECTURE sections 6.1 and 13) and lists what it leaves out: PIN
   verification, the actor, the approver, the idempotency key, the expected order version,
   the lease, the business-day lock, the audit entry, the cancellation ticket and its print,
   and a persisted `VOIDED` state.
2. **Refusals,** in this order: `not-open`, `locked`, `unknown-line`, `not-fired`,
   `no-reason`, `needs-manager`. The third and fourth are the line void's only, and are
   checked before `voidRule` is called. The result is a value naming the refusal, never a
   throw and never a bare boolean. A refusal returns the same order object.
3. **Not refusals:** an empty order, an order whose only lines are voided, a quick sale. No
   `day-closed` refusal and no input fact for one.
4. **The lock is checked inside the operation:** this order's own payment session or the
   place's lock, `draft` or `lease`, read through the store's context ref at the moment of
   the call.
5. **The gate is decided inside the operation.** It calls `voidRule` on the target as the
   store holds it, in the same update that writes. `through` is required, with no default:
   `'direct'` from the sheet's ungated path, `'manager-prompt'` as a literal inside M-1's
   `onSubmit` and nowhere else. It is never stored and never named *approved* or *confirmed*.
   The reason is checked there too.
6. **A line void** sets that line's `status` to `voided`, in place, in its round. Nothing
   else on the line changes, the round stays, `note` stays unset, and no time is recorded.
   The line is never dropped.
7. **An order void** sets `voided: { voidedAt }`, once, and changes nothing else: not the
   lines, not the discount. `OrderStatus` gains `voided`, derived from the record.
8. **Two predicates.** `reachedClosed` means `closed` or `refunded`; a new predicate means
   anything but `open`. In the store, one private `isOpen`. Change `tableSlot`, `update`, the
   `close` pre-check, `changeDiscount`'s `closed` fact and `PosRoutes.tsx:91`; leave
   `refundInBook`. Search `apps/pos/src` and `apps/pos/test` for `isClosed`, `reachedClosed`,
   `status ===`, `status !==` and `.closed`, and say in the Handoff what was found.
9. **All or nothing.** Follow `changeDiscount`: evaluate against the latest book, advance the
   ref, run the same operation in the functional updater through `update`. No by-id path.
10. **No cancellation ticket in the book.** The operation's success result carries
    `cancels`, the ids of the FIRED lines the void cancelled, taken from `voidRule` on the
    order written. Tests assert it for a line, for an order with fired, pending and voided
    lines, and for an FR-H3 void. No `delivery`, no round, no incident, and nothing waits.
11. **The reason** is passed, checked and dropped. The prompt's submit passes the reason it
    displayed. It is not stored, logged or put in the URL.
12. **One sheet, one order.** Every void sheet on POS-03, opened from a row, the close bar or
    a `?state=sheet-void*` address, reads `store.order` and writes through the operation. A
    line target that is not a FIRED line of that order draws no sheet; the decision is made
    where `voiding` is computed, so the frame is never inert under nothing. Nothing throws on
    an order's state.
13. **The door.** `ApprovalDialog` with `requireFull`, an `onSubmit` that declares no
    parameter, and `onCancel` returning to the sheet with the reason kept. No footnote. The
    call-site comment says confirm stands for the server accepting the command and that
    nothing is verified. No magic PIN.
14. **Landings.** A line void lands where its fixture says. An order void replaces the
    history entry with `/pos/floor` and tells the location's owner; the redirect in
    `PosRoutes` stays as the guard. A refusal closes M-1 if open, keeps the sheet and routes
    nowhere, with no new copy. A test hands the sheet a store whose operation refuses.
15. **The four `?state=approval*` addresses** stay routing only, through `ApprovalPrompt`,
    with a comment that they picture M-1 and perform nothing.
16. **Nothing is said after the void** about a ticket, a print or a record. No approver, no
    actor, no approval flag, never `approver: null`.
17. **No audit in the client,** and no mock of one. The Handoff lists what the server owes:
    the seven entries and six undecided points of question 9, and the replacements listed
    there. It says that both void commands carry an idempotency key.
18. **Removal.** When the server's void commands exist, the stand-in module is deleted, not
    kept as a fallback.
19. **What the tests prove.** The client's behaviour. AC-3, AC-10, AC-11, AC-18, AC-21 and
    AC-22 are not closed by this task.
20. **Out of scope, recorded as found:** the four items of section 10, point 9.

## For the owner

Nothing here blocks FE-036. No change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md is
asked for, and no new ADR is proposed.

1. **A time on a voided line.** For a line voided in this session I recommend the row shows
   nothing beyond its strike-through. If the owner wants *Voided 19:51*, with no name and no
   word about approval, it is a change to reviewed copy on an identity matter and is the
   owner's to confirm.
2. **Two sentences the stand-in cannot keep.** The void sheets say *A cancellation ticket
   will print in the kitchen* and *The void is recorded against your name*. In the fixture
   client nothing prints and nothing is recorded. I recommend leaving the reviewed copy as it
   is and saying nothing after the void; this is stated so it is accepted knowingly, as the
   PIN stand-in was.
3. **An opened order with no lines.** The close bar draws Void order off on an empty order,
   and the floor draws its table free. On the server that order is OPEN and blocks
   end-of-day (FR-I2). How a cashier abandons it (SCREEN-INVENTORY names "abandoning an
   order" and does not define it) is a product and design question, needed before Phase 2.
4. **Still open from ARCH-004.** Whether an approved void that the server then refuses writes
   a `REFUSED` entry, as a refund does (FR-J3, AC-18).
5. **Still open from ARCH-003.** Whether an abandoned approval prompt is a *cancelled
   approval* for FR-J3.
6. **For a designer, with the owner's review:** the tag on a round whose lines are all
   voided; the picture of a rejected void; the provisional copy already flagged in
   `VoidSheets.tsx` (the order's approval request, the one-line count, the *Other* field);
   and whether a cancellation ticket should print for work whose own ticket never printed.

DONE
