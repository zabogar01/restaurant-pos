# ARCH-004 — How the fixture client may apply a discount

Author: `architect4`, 2026-10-02. Read-only consult for FE-035 (not yet written). Nothing was
edited except this report, and nothing was committed.

## Summary

1. **The operation (D1, D2): right in outline, wrong in two details.** A pure, command-shaped
   operation reached through `store.changeDiscount` on the active order is consistent with the
   architecture and with `close` and `refund`. But the caller must pass a *request* (a preset
   id, a typed value, or remove), not a finished `DiscountSnapshot`: the snapshot's `source`
   is the fact the gate reads, and the caller must not be its author. And D2's fourth refusal
   is wrong: FR-M5 says a fixed discount is **capped** at the subtotal, not refused above it,
   so a 50.000 preset on a 30.000 order must apply. The lock belongs inside the operation.
2. **The gate (D3): not acceptable in the sheet alone.** The operation must decide for itself,
   from the order it is about to write, whether the transition is gated, and refuse
   `needs-manager` unless the call comes from M-1's submit. That is not an approval held in
   client state; it is the stand-in for "this command carries a PIN".
3. **Recorded and shown (D4): confirmed.** Clearing the note on every change is right. The
   architecture does not forbid the client recording a time, but I recommend FE-035 records
   none and shows no line; any *Applied at 19:44.* line is the owner's copy to rule.
4. **Fixture addresses (D5): the second sentence is wrong.** ARCH-003's rule 13 was about
   POS-06, where a `state` address shows a fixture's order. On POS-03 every address shows the
   book's active order, and item sheets at `?state=` addresses already write it. Leaving the
   four discount addresses as routing only leaves a second inert discount. They should keep
   their routing and make the choice real.
5. **Money.** A snapshot whose fixed value exceeds the subtotal is an honest state: the
   documents decide it. A line removal is never refused and the discount is never re-validated
   or dropped. A 100% comp closes with no tenders and needs nothing more.
6. **Tender drafts.** No path moves the total under keyed drafts through the discount,
   provided the operation checks the lock. It must, because `closeOrder` would otherwise
   record a card above the balance (B-5).
7. **Closed and refunded orders** show the discount they closed with. One reader misnames it:
   `bookRows` calls any 100% discount *Comp 100%*.
8. **Audit and what the server owes.** Listed below. The lead's list is wrong on one item: a
   discount change takes **no idempotency key** (section 8, ADR-003). One case is undecided
   by the contract: a discount change that is approved and then refused.
9. **Pushback:** eight points, collected in section 9.

## What I verified

Read with the file tools: the task file; `docs/ARCHITECTURE.md` whole; ADR-002, 003, 004 and
007; `docs/PRD.md` and `docs/BOUNDARIES.md` whole; `.agent/DECISIONS.md` (the task cites its
2026-10-02 rulings); ARCH-003's report whole; and in `apps/pos/src`: `discount.ts`,
`orderStore.ts`, `DiscountSheets.tsx`, `discountFixtures.ts`, `OrderPanel.tsx`, `Approval.tsx`,
`approvalFixtures.ts`, `refund.ts`, `close.ts`, `fire.ts`, `tender.ts`, `paymentSession.ts`,
`PosRoutes.tsx`, `SettlementScreen.tsx`, `closedOrders.ts`, `closedOrderDetail.ts`,
`ClosedOrderScreen.tsx`, `orderFixtures.ts`, `menuFixtures.ts`, `voidFixtures.ts`.

The lead's account under *What exists* holds, with these precisions:

- **FR-F8's table gates five of eight transitions, not six.** `discount.ts:41-49`: ungated are
  none to preset, preset to preset, and removing a preset; the other five are gated.
- **The line that reads the fixture's order is `OrderPanel.tsx:171`** (`const order =
  shownOrder(view)`), under the comment at `:169-170`. `:224` passes it to `panelDiscount`.
  I confirmed the mechanism. I did not read `FloorScreen.tsx`, so I did not confirm which
  `?state=` a floor-opened table lands on.
- **The lock and the three line mutations.** `addLine`, `removeLine` and `setQuantity`
  (`orderStore.ts:369-390`) do not check a lock. The row's × does not call `removeLine`; it
  writes `?gone=`, and the effect that honours it does check both locks (`:365`). So a line
  removal from the panel is lock-checked in the store, and the three store methods are not.
- **`fire` and `close` read different locks, on purpose.** `fire` refuses under this tab's
  session or the place's fixture lock (`:393-401`). `close` refuses only under a lease
  (`:411-418`), because this tab's own session is how a close is reached.
- **`needsManager` throws** on `remove` with nothing applied (`discount.ts:55`), and
  `discountAmount` throws on a negative amount or a percent above 100 (`:68`, `:72`). Both
  matter for question 1.
- **`ApprovalPrompt` does not pass `requireFull`** (`Approval.tsx:113-126`). The owner's
  ruling says *six digits* and the confirm key; the adapter as it stands accepts fewer.

Not read: any test file, `Sheets.tsx`, `MenuRegion.tsx`, `VoidSheets.tsx`, `FloorScreen.tsx`,
`ClosedOrdersScreen.tsx`, `RefundSheet.tsx`, `refundDraft.ts`, `PinPad.tsx`, `packages/money`,
and ADR-001, 005 and 006. I had no search tool, so every list of readers or call sites below
is what I found by reading the files above, not the result of a search. No library or API
fact was needed, so the librarian was not asked.

---

## 1. The operation's shape (D1, D2)

### What the documents decide

- The POS "never owns committed order, money, receipt, approval, or print state" and may show
  provisional totals that server results replace (ARCHITECTURE section 4.1).
- "Clients send explicit commands, not replacement aggregates or requested status values. The
  server derives every resulting state" (section 4.4). The surface is "apply/replace/remove
  discount" under `/api/pos/orders/…` (section 13).
- A discount change "records one before/after transition and gates the whole transition when
  the old or new state requires free-form approval" (section 11, FR-F8).
- A discount "captures its displayed name, kind, and value" (section 5.2, B-8, FR-F4). The
  server is authoritative for catalog state, which includes presets (section 4.4, FR-C7).
- A lease, and separately this tab's own tender draft, block "add-line, discount change, fire,
  void, and a competing settlement" (section 6.3, FR-G12, FR-G13).
- A closed order "accepts no new lines, discounts, tenders, or ordinary edits" (section 6.1).
- At most one discount per order (B-22, FR-F1, the constraint list in section 8).
- A refusal leaves the order exactly as it was (B-20).

### D1: confirmed, with one correction to the argument

A pure operation with a named-refusal result, written in one functional update, on the active
order through `update`, is right. It matches `fireOrder`, `closeOrder` and `refundOrder`, and
`update` already refuses a closed order. Do not give it a by-id path as the refund has: a
discount changes only on an open order on POS-03, and a second path would need its own closed
guard.

**The correction: the caller passes a request, and the operation builds the snapshot.**

```ts
export type DiscountChange =
  | { kind: 'preset'; presetId: string }
  | { kind: 'free-form'; value: DiscountValue }
  | { kind: 'remove' };
```

D1 has the sheet hand over a finished `DiscountSnapshot`, with `source`, `name` and `value`
already filled in. Three things are wrong with that:

1. `source` is the one fact FR-F8's gate reads. A caller that authors it authors the gate:
   `{ source: 'preset', name: 'Staff meal', value: 55% }` would be an ungated free-form
   discount. The operation must set `source` from the kind of request it was given.
2. A preset's name, kind and value are configuration (B-8, B-24). The command names the
   preset; whoever records the discount copies the preset's facts. So the operation takes the
   preset list as an input fact, as `closeOrder` takes `unavailable`, resolves the id, and
   builds the snapshot with `snapshotOf`. It refuses an id that is unknown or not active
   (FR-F5). That refusal is the stand-in for the server's `CATALOG_CHANGED`.
3. A whole snapshot is closer to a replacement value than to a command (section 4.4).

*The alternative*, keeping `DiscountSnapshot | 'remove'` and having the operation check that a
preset snapshot equals `snapshotOf` of an active preset, reaches the same safety by comparing
what it could have derived. It loses because it is more code for a worse seam: Phase 2 would
still have to change the argument.

The sheet's door may go on building a snapshot for what it *displays* (the M-1 request text
needs a name and an amount). What it sends is the request.

**Put the operation in its own module,** beside `discount.ts`, not inside it. D7 says the
stand-in is deleted when the server command exists. `discount.ts` is not deleted then: the
sheet still asks `needsManager` to draw a gated control, and section 4.1 allows provisional
totals. A separate module makes D7 a file deletion. Give it the header `refund.ts` has: what
it stands in for, and what it leaves out (question 8).

**Returning the result.** Follow `refund` (`orderStore.ts:435-443`): evaluate the pure
operation against the latest book, advance the ref, and run the same operation again inside
the functional updater. A second call in the same tick then sees the first one's result. A
refusal returns the same order object, so `update` returns the same book.

One caution, as ARCH-003 gave for `refund`: `close` is optional on `OrderStore` so a test's
hand-built store need not supply it. A required `changeDiscount` may break hand-built stores
in existing tests.

### D2: the refusals

**Confirmed:** the order is closed; a lock holds; `remove` with nothing applied.

**Wrong: "a value outside FR-M5's bounds for the order's subtotal at the moment of the
change".** FR-M5 reads "a fixed discount is **capped** at the subtotal", and section 10 and
ADR-004 say the same. It does not say a fixed discount above the subtotal is refused. As
drafted, the rule would refuse *Service recovery — 50.000 off* on an order of 30.000. That is
a preset, which FR-F2 says applies with no prompt, and the picker has no drawn refusal for it.
The documents' answer is that it applies and takes 30.000 off. `discountAmount` already does
this (`discount.ts:69`).

What the operation must check is the value's own validity, whatever the subtotal:

- a percent that the money package's parser accepts and that is no greater than 100% (FR-M5);
- a fixed amount that is not negative.

This check is not optional. An invalid snapshot written to the book makes `discountAmount`
throw inside `totalsFor` on every later render, on POS-03, POS-04, POS-05 and POS-06 alike.

The free-form sheet's stricter entry rule (`parseFreeForm` refuses a typed amount above the
subtotal) may stay as entry guidance. It is provisional copy already
(`discount.ts:151-155`). Whether a typed amount above the subtotal should be refused at entry
or accepted and capped is not decided by FR-M5; I list it for the owner, not blocking.

*The alternative*, the operation refusing a free-form fixed amount above the subtotal while
letting a preset through, loses. It treats one value two ways, it is a refusal the server
contract does not have, and the state it prevents arises anyway when a line is removed
(question 5).

**Missing:** the preset is unknown or not active (above); and `needs-manager` (question 2).

**Checked in this order,** so the answer is deterministic:

1. `closed`: the order has reached CLOSED, REFUNDED included.
2. `locked`: a lock holds.
3. `nothing-to-remove`: `remove` with nothing applied. This must come before any call to
   `needsManager`, which throws on that input.
4. `unknown-preset`: the id is not an active preset.
5. `invalid-value`: as above.
6. `needs-manager`: the transition is gated and the call did not come from M-1's submit.

**Not a refusal: an empty order.** The close bar draws Discount off on an empty order
(`OrderPanel.tsx:503`). That is a drawing decision. No requirement refuses a discount on an
order with no lines, so the operation should not invent one.

### The lock belongs inside the operation

Yes. Section 6.3, FR-G12, FR-G13, AC-21 and AC-29 each name discount change among the five
blocked mutations. Of the five, it is the one that moves the total without touching a line,
and question 6 shows what that does to drafts already keyed.

`addLine`, `removeLine` and `setQuantity` not checking is a gap, not a precedent. `fireOrder`
checks "whatever the panel drew" (`fire.ts:144-155`), and the `?gone=` path checks too. The
three store methods rely on the screen never offering them under a lock. I did not read
`Sheets.tsx` or `MenuRegion.tsx`, so I cannot confirm that reliance holds everywhere. It is
not FE-035's to fix; I recommend a small separate task that makes them refuse under a lock in
the store.

The lock is an input fact, composed as `fire` composes it: this order's own payment session,
or the place's lock from `originFacts(view)`, read through the context ref at the moment of
the call. One refusal, `locked`, as `fireOrder` and `closeOrder` have. The screen already
knows which lock it is and FR-G12 requires the two never to share a message, so the words
stay the screen's.

---

## 2. The gate with no approval to check (D3)

**Answer: the gate may not live only in the sheet. The operation decides whether the
transition is gated, and refuses `needs-manager` unless the call is M-1's submit.**

### What the documents decide

- "Manager approval is embedded in the protected POS command" (section 7.1). The server is
  authoritative for inline manager approval (section 4.4).
- The gate covers the whole transition and is decided "from what the order carries now"
  (FR-F8, section 11).
- An approval authorises one action at the moment it is given, and is never cached or carried
  (B-14, FR-A6).
- ARCH-003, accepted by the owner on 2026-10-01 and extended to the discount on 2026-10-02:
  the digits are never read, nothing about an approval is stored, and the seam is one callback
  that carries out the whole protected command.

### Why the refund's arrangement does not carry over

For the refund the gate also lives in the screen: `book.refund` takes no approval, and any
caller could reach it without M-1. That was acceptable because a refund is always gated and
has one call site. There is no decision to get wrong.

For the discount the decision is a function of state: what the order carries, and what would
replace it. Under D3 the sheet evaluates that function against *its* copy of `applied`, and
the operation writes to the store's order. The defect the owner found on 2026-10-02 is exactly
that those two were different orders. Had the operation existed that day, a sheet holding
Table 1's *Staff meal* over an order carrying a free-form discount would have replaced it with
a preset and no prompt. The rule that prevents this is not "the sheet must read the right
order", which is a rule about every future caller. It is that **whatever writes decides the
gate, on the state it writes.**

So the operation calls `needsManager(order.applied, change)` itself, inside the same update
that writes.

### What the call says, and why it is not an approval

Having decided the transition is gated, the operation has no PIN to check. It needs one thing
from the caller: which door the call came through. I recommend a required argument with no
default:

```ts
store.changeDiscount(change, 'direct');          // the sheet's ungated path
store.changeDiscount(change, 'manager-prompt');  // inside M-1's onSubmit, and nowhere else
```

A gated transition called `'direct'` is refused `needs-manager`, and nothing changes.

This is the stand-in for the real command's shape. On the server, a gated discount command
carries a manager PIN inside it and an ungated one carries none; a gated transition that
arrives without one is refused. The argument says "this command carries a PIN" without
carrying the digits.

Weighed against the three authorities the lead names:

- **Section 7.1.** The decision moves to where the architecture puts it. The callback is still
  one call that carries out the whole command.
- **B-14.** Nothing is cached, carried or stored. The value is a literal in a synchronous
  call. It must stay one: it is never placed in React state, a ref, the order, the URL or a
  prop, and there is no step that sets a flag for a later call to read.
- **ARCH-003's rule.** No approval is held in client state, because none exists. Nobody
  approved anything; the value names a door. That is why it must not be called `approved`,
  `approval` or `confirmed`, and why the call-site comment must say, as the refund's does,
  that the confirm key stands for the server accepting the command and that nothing is
  verified.

### Alternatives, and why they lose

- *The gate in the sheet only (D3 as drafted).* The gate reads one object and the write
  touches another. FR-F8's table would be enforced on no write path, and would be testable
  only by rendering a sheet. The operation would not be shaped like the command, so Phase 2
  would have to move the decision.
- *The operation takes the PIN, or an approval value.* Forbidden: the digits are discarded
  unread (owner, 2026-10-01 and 2026-10-02; B-12), and a value passed between a verify step
  and an act step is an approval in client state (B-14).
- *The operation is called first, and the sheet opens M-1 on `needs-manager`.* This is
  consistent with the architecture and I would accept it. It loses only on cost: the sheet
  already draws gated controls ahead of the press and must ask `needsManager` to do so, so
  asking first is today's door with one check added behind it.

### Details

- The sheet goes on asking `needsManager` to draw a control as gated and to decide whether to
  open M-1. With D5 it asks about the store's order, so the two answers agree unless there is
  a defect. The operation's check is what catches the defect.
- A call through `'manager-prompt'` for a transition that turns out to be ungated applies.
  The value only ever unlocks. What the server does with a PIN it did not need is Phase 2's.
- The door uses `ApprovalDialog` directly, with `requireFull` set (the owner's ruling says six
  digits), `onSubmit` a handler that declares no parameter, and `onCancel` returning to the
  sheet exactly as it was. No footnote: none is drawn for a discount, and the refund's
  *Approves this refund only.* is not this action's copy.
- No magic PIN, no stored flag, a fresh mounting per attempt: ARCH-003's question 4 applies
  unchanged.

---

## 3. What is recorded and shown (D4)

### Clearing the note: confirmed

The note describes one application event (lead ruling, 2026-09-21, recorded at
`discountFixtures.ts:66-71` and `orderFixtures.ts:226-234`). A change is a new event. Leaving
*Applied by Ana R. at 19:44. Preset, no approval.* under a discount applied a minute ago would
assert an actor, a time and an authority that belong to a different discount. So every
successful change clears `appliedNote` in the same update that writes `applied`, and a
refusal clears nothing (B-20). On `remove`, both fields go.

### No actor, no approver, no approval flag: confirmed

The server is authoritative for actor identity and approval (section 4.4), every audited
action names an identified person (B-13), and the client knows neither. ARCH-003's question 3
applies unchanged: no `approver` field, never `approver: null` (ADR-007 reserves that shape
for a failed or cancelled approval), and no `gated` or `approved` marker on the order.

The snapshot's `source` is not such a marker. It is part of what a discount is (FR-F4, and
`OrderDiscount`'s source reference in section 5.1). A preset that replaced a free-form
discount leaves `source: 'preset'`, and nothing on the order says a manager was involved.
That is correct.

The header's *Ana R. · Cashier* is fixture copy and must not be copied into a note.

### The time

**What the documents decide.** Nothing forbids the client holding a time. It already holds
`firedAt`, `closedAt` and `refundedAt`, each from an injected browser clock that the server's
time replaces (section 14.4). A time is not an identity, so B-13 and B-14 do not reach it.

**What I recommend.** FE-035 records no time and shows no line, as D4 says.

- Nothing reads it. POS-05 and POS-06 do not show when a discount was applied, and no report
  exists. A field stored only to feed a line nobody has reviewed is a field with no consumer.
- The note's job in the design is attribution: who, when, on what authority (FR-F6). A line
  with only the time keeps the least important third and reads like a record. The record is
  the server's audit entry, with the server's time (FR-J2).
- The standing ruling already covers this case: "an order whose application nobody recorded
  carries none", and the change sheet already draws that gap for `zero`.

**Whether the change sheet may show *Applied at 19:44.* is the owner's to rule.** It is a
change to reviewed copy on an identity matter, the same kind of question as the REFUNDED
notice the owner ruled on 2026-10-01. It is not blocking. If the owner wants the line, the
rules are: the time is an argument to the operation and never read inside it; it is stored as
its own field, not baked into `appliedNote`; it is shown in WIB; and the line carries no name
and none of the words *approved*, *approval* or *manager*.

---

## 4. Fixture addresses (D5)

**The first sentence of D5 is right. The second is wrong, and would leave a second inert
discount.**

### Why ARCH-003's rule 13 does not apply here

Rule 13 was written for POS-06, which has two address schemes. `?order=<id>` alone is a book
order. Anything with a `state` shows one of the artifact's six fixture orders, which are not
in the book at all. A refund confirmed there "has no book entry to change".

POS-03 has one scheme. Every address is a `?state=` address, and at every one of them the
panel draws `store.order`, the book's active order (`OrderPanel.tsx:294`). A sheet at a
`?state=` address already writes that order: a menu tile opens its item sheet by navigating
to `?state=sheet-item-<id>` (`menuFixtures.ts:53-54`), and that sheet's *Add* calls
`store.addLine` (`OrderPanel.tsx:314-317`). On POS-03, `?state=` chooses what is drawn around
the one live order. It never chooses a different order.

So at `?state=sheet-discount` there is a book entry to change. It is on screen, and the sheet
is drawn over it.

### What D5's second sentence would produce

Load `?state=sheet-discount`, choose *Regular customer — 5%*. The sheet routes to
`?state=default`. The panel still shows *Staff meal 10%*, because the store was not written.
That is the owner's finding of 2026-10-02 again, at the four addresses a reviewer uses to look
at the discount sheets.

It is also already broken in a second way. The artifact routes *Comp* to `?state=zero`
(`discountFixtures.ts:89-90`). Since FE-014 a change of `?state=` does not reseed the store,
so today that press lands on an address called `zero` over an order that is not comped.

### What I recommend

On POS-03, a discount sheet is one thing however it was opened:

- It reads the order's facts (`applied`, the note, the subtotal) from `store.order`. A fixture
  never supplies them.
- A change goes through the one door and the one operation.
- The fixture address supplies only what a URL has to picture: which step is showing
  (`trail`), the half-typed entry on `sheet-freeform`, the opener, and where Cancel and a
  successful change land.

The four addresses keep the artifact's landings. They become true: after the operation has
written a comp, `?state=zero` shows a comped order because the order is comped. A refusal
does not route.

Each picture is preserved at mount, because the store is seeded from the same state's order
fixture. `ORDER_FIXTURES['sheet-remove-freeform']` already carries `OTHER_15` and its note
(`orderFixtures.ts:730-737`), and the other three carry *Staff meal* and its note. The
fixture sheet's own `applied`, `appliedNote` and `subtotal` then repeat the seed and can stop
being read by the screen.

*The alternative*, D5 as drafted, loses for the reason above. *A third option*, removing the
four addresses, loses because `sheet-freeform` pictures a state (15 typed) a reviewer cannot
otherwise reach in one step, and the addresses cost nothing once they are live.

Two cautions for the lead. I have not read the tests: one that asserts a choice at a fixture
address leaves the order unchanged would conflict with this, and tests of the landings should
still pass. And a `DiscountSheet` mounted on its own by a component test has no store; if the
operation is an optional prop there, the routed app and `OrderScreen` must always supply it.

The `?state=approval*` addresses are a different case. They picture M-1 itself over a void
that the store cannot perform. They stay as they are, through `ApprovalPrompt`.

---

## 5. Money

### A snapshot whose fixed amount later exceeds the subtotal

**The documents decide this; it is an honest state.**

- B-8, FR-F4, section 5.2 and ADR-004: the snapshot is the discount's name, kind and
  **value**. It is not the amount taken off. The value is a historical fact and does not move.
- FR-M5 and section 10: "a fixed discount is capped at the subtotal". The amount taken is
  computed from the snapshot and the current lines each time, and capped. Section 6.4 has the
  close "recompute authoritative totals from snapshots".
- FR-M4: the discount is taken once at order level, and tax and service charge follow from
  the discounted subtotal. `orderTotals` does this.

So *50.000 off* on an order reduced to 30.000 takes 30.000, the total is zero, and the
snapshot still reads 50.000. That is what "capped" is for.

**A line removal is never refused on account of the discount.** FR-D5 and FR-H2: a pending
line "may be edited or removed freely".

**The discount is never re-validated, shrunk or dropped by a line change.** That would be a
discount change nobody chose. If the discount were free-form, it would be an ungated,
unaudited change to a gated discount, against FR-F8 and FR-F6. B-21's rule that a discount
never applies itself has the same root: a discount changes only when a staff member changes
it.

The lead's premise needs one correction: FR-M5 does not say a fixed discount is "validated
against the subtotal when it is applied". It says capped. See question 1.

Recommendations, not decisions:

- The totals row will read *Service recovery 50.000 off* against −30.000. The label names the
  snapshot and the amount is what was taken. Whether that wants a word such as *capped* is a
  design question, not FE-035's.
- **Found, not FE-035's to fix.** `totalsFor` returns bare totals for an order with no lines
  (`orderStore.ts:192`), and Discount is drawn off on an empty order. An order emptied by the
  cashier therefore still carries its discount, invisible and unchangeable, until a line is
  added and it reappears. FE-035 makes this reachable on any table. It is honest arithmetic,
  but it is a state nobody drew. The owner's ruling that an emptied order shows no charge
  rows is marked conversation-only in DECISIONS.md and does not cover the discount.

One observation the PRD already settles: an approved percentage applies to lines added after
the approval (FR-D3, FR-F8 gates the discount transition, not line changes). FE-035 opens no
new question there.

### The 100% comp

Confirmed, nothing else is needed. `closeOrder` keeps no tenders when the total is zero
(`close.ts:82`), refuses a table order with a pending line first, and otherwise closes with
an empty tender list and no change (FR-G11, section 6.4, AC-24). The settlement screen keys
its zero composition on the live total, not on a state name (`SettlementScreen.tsx:746`). A
zero-total order is not refundable (`refund.ts:97`, FR-H5b). A quick sale's lines still fire
at close.

---

## 6. A tender draft and a discount change

**Confirmed: no path, provided the operation checks the lock.**

By reading, the screens leave none today:

- A payment session begins on Settle or on a direct settlement visit
  (`PosRoutes.tsx:72-77`), is keyed to one order, and makes POS-03 draw the `draft` lock for
  that order. Under either lock the close bar draws Discount off (`OrderPanel.tsx:503`), so
  the sheet cannot be opened.
- With a discount sheet or M-1 open, the rest of the frame is inert, so Settle cannot be
  pressed. A route change unmounts the order screen and the sheet with it, and nothing is
  applied.
- Cancel payment discards the drafts before it lifts the lock.
- A session that begins after a discount change is seeded from the live total.

That is an argument about what the screens offer. It is not a guarantee, and here the
guarantee matters. The settlement screen derives the balance from the live total on every
render, and `closeOrder` recomputes the total at close, so a moved total would not go
unnoticed. But `closeOrder` accepts whatever drafts it is given (ARCH-003, question 9, item
6). A card drafted for the whole balance, followed by a discount, would close with "change"
against a card. That is B-5.

**What the operation must check:** `locked`, true when this order has an active payment
session or when the place carries a lock, `draft` or `lease`. Unlike `close`, both locks
refuse. It is read at the moment of the call through the store's context ref, as `fire` reads
it, never captured when the callback was created.

The same hole stays open through the three unchecked line mutations (question 1), and
`closeOrder` still does not refuse a non-cash tender above the running balance. Both are
found, not fixed, and neither is FE-035's.

---

## 7. Closed and refunded orders

**Confirmed: they show the discount the order closed with.**

The book stores no totals. It stores the lines and `applied`, and every reader derives
figures through `toShownOrder` and `totalsFor`. After close, both inputs are frozen: `update`
refuses any change to a closed order (`orderStore.ts:343`), and the refund writes `refunded`
and nothing else (`:246`). The rates are constants. So the derivation gives the figures the
order closed with, every time.

This holds only if `changeDiscount` writes through `update`, or refuses a closed order as
`update` does. It must never get a by-id path that skips the guard.

Readers, by reading:

| Reader | Reads | Result |
|---|---|---|
| `bookRows`, total (`closedOrders.ts:241`) | `o.order.totals.total` | correct |
| `bookDetail` (`closedOrderDetail.ts:349-373`) | `held.order.totals`, label from the snapshot | correct |
| `refundInBook` (`orderStore.ts:239`) | `totalsFor(lines, applied).total` | correct |
| `bookRows`, payment text (`closedOrders.ts:246`, `isComp` at `:214-215`) | any percent discount of 100% | **misnames** |

`bookRows` prints *Comp 100% · no payment taken* for any 100% percent discount. Until FE-035
the only such discount on a book order was the *Comp* preset. After it, a free-form 100%
(named *Other discount*) lists as *Comp*. The fix is to name the row from the snapshot's own
label, never from the preset id, which B-8 reserves for reporting. The wording is copy.

I did not read `FloorScreen.tsx` or `ClosedOrdersScreen.tsx`. They read the book through
`orderFor` and the row model, so I expect no other reader, but the builder must search for
`applied` and `totalsFor`.

On the server none of this is derived on read: the Receipt stores every displayed figure
(section 5.2, ADR-006).

---

## 8. Audit and what the server owes (D6)

**D6 is right.** No audit in the client and no mock of one, for ARCH-003's reasons: audit
evidence is inserted in the same PostgreSQL transaction as the action (ADR-007), the log is
append-only (B-7), and every entry names an identified actor (B-13).

### The entries the server owes

1. **An ungated change** (a preset applied to an order with none, a preset replaced by a
   preset, a preset removed). One entry naming the initiating actor and no approver, with the
   action, outcome, order, timestamp and before and after values, in the same transaction as
   the `OrderDiscount` write (FR-F6, FR-F8, FR-J2, FR-J3, ADR-007). The entry names the
   preset, not a bare number (AC-8). A preset's record "carries only the actor" (AC-9).
2. **A gated change** (the five gated transitions). One **combined** entry naming actor and
   approver, with before and after values, in the same transaction (FR-F6, FR-F8, FR-J3,
   section 11, AC-9, AC-18).
3. **A cancelled approval.** Cancel or Escape in M-1: one entry naming the initiating actor,
   `approver = null`, outcome cancelled, in its own short transaction. If it cannot commit,
   the request fails (ADR-007). So on the server, Cancel is a request that can fail.
   Cancelling the *sheet* before M-1 opens is not an approval outcome and writes nothing.
4. **A failed approval.** A wrong PIN, or a valid PIN that is not a manager's: one entry
   naming the initiating actor with `approver = null`, and a count against the
   `MANAGER_APPROVAL` throttle (FR-A5, FR-J3, AC-18).
5. **No PIN value in either store, in any form** (FR-J4, B-12).

### What else Phase 2 must replace

- **The expected order version.** A discount change never uses blind last-write-wins (section
  8, ADR-003, NFR-4).
- **No idempotency key. The lead's list is wrong here.** Section 8 and ADR-003 name seven
  commands that carry one: open order, fire, settle and close, whole-order void, fired-line
  void, refund, end-of-day close. Discount change is not among them. Its retry safety is the
  expected version, and after a lost response the client reads the order again; it cannot
  resend, because it did not keep the PIN. Adding a key is a new ADR superseding ADR-003's
  list, not something a task file introduces.
- **The preset, read from the server.** The picker lists the server's active presets (FR-F5).
  The command names a preset id with the catalog version. The server copies name, kind and
  value from its own `DiscountPreset` (B-8) and answers `CATALOG_CHANGED` when the client's
  catalog is stale (FR-C7, section 4.3).
- **The actor and the approver.** The actor from the POS session (FR-A2); the approver from
  the PIN carried inside the command (section 7.1). The gate does not depend on the actor's
  role: a manager who starts a free-form discount still enters a PIN (section 7.1, AC-27).
- **The lease.** The server refuses with `LEASE_HELD` (FR-G13, section 13). This tab's draft
  guard stays a client rule and is never sent (section 6.3).
- **Server time** for the change, in place of any browser clock (section 14.4).
- **Authoritative totals** in place of `orderTotals` (section 4.1), and the two rates from
  the order's `SettingsVersion` in place of the constants at `discount.ts:93-94` (FR-B1,
  B-24).
- **A persisted `OrderDiscount`** under the at-most-one constraint (section 8).
- **The pictures of a server's answer.** The wrong-PIN notice and the throttle already have
  props on `ApprovalDialog`. The in-flight state does not exist. A *rejected discount change*
  has no reviewed picture at all, and `VERSION_CONFLICT`, `LEASE_HELD` and `CATALOG_CHANGED`
  all become reachable. A designer owes it before Phase 2.

### Undecided, to be named in the Handoff and not assumed

- **An approved change that the server then refuses.** FR-J3 and AC-18 define the `REFUSED`
  entry for a refund only (owner, 2026-09-30). For a discount change whose PIN is valid and
  whose command is then refused, the contract says nothing. The owner's.
- **The order of the server's checks.** Whether version, lease and validity are checked
  before or after the PIN decides which entry a stale or malformed gated request produces,
  and whether the case above can arise at all. Phase 2 architecture, and an ADR then.
- **Which exits from M-1 count as cancelled.** ARCH-003's third owner question is still
  open: DECISIONS.md holds no ruling on an abandoned prompt, and the ruling on Cancel while
  verifying is marked conversation-only.
- **An approval attempt during the cooldown.** FR-J3 calls throttle cooldowns telemetry
  "because they have no identified actor", but an approval attempt has one. Audit entry or
  telemetry is not stated.
- **A change to the same discount** (the applied preset chosen again). Whether it is a no-op
  or an audited replace is not stated.
- **What a free-form discount is called.** FR-F4 snapshots a name; the PRD gives a free-form
  discount none. *Other discount* is the sheet's title reused (`discountFixtures.ts:54`).

---

## 9. Anything else in the draft

1. **D1's argument is a snapshot the caller authors.** It must be a request (question 1).
2. **D2's bounds rule contradicts FR-M5.** A fixed discount is capped, not refused (question
   1).
3. **D3 leaves the gate in the sheet.** The operation must decide it (question 2).
4. **D5's second sentence misapplies ARCH-003's rule 13** (question 4).
5. **The lead's question 8 lists an idempotency key.** The architecture requires none for a
   discount change (question 8).
6. **"Six of eight" is five of eight** (`discount.ts:41-49`).
7. **The acceptance criteria must not claim AC-8, AC-9, AC-18 or AC-21.** FE-035's tests
   prove the client's behaviour only. ADR-002 requires integration tests against real
   PostgreSQL, and section 14.3 places approval, lease blocking and the tab guard in
   Playwright against the real server. Say once in the task file that those criteria stay
   open.
8. **Found, and not FE-035's to fix.** The void sheet is still handed `shownOrder(view)`, the
   fixture's order (`OrderPanel.tsx:325`), and the void does not write the store. It is the
   same defect the owner found for the discount, on a path that is manager-gated and prints a
   cancellation ticket (B-16). It will need its own consult.

On a refusal the sheet has no drawn picture. A correctly built screen cannot reach one, so I
recommend the least invention: M-1 closes if it was open, the discount sheet stays, and it
shows the order's actual discount read from the store. Nothing routes, nothing claims
success, and no new copy is written. A test hands the sheet a store whose `changeDiscount`
refuses, which is also the proof that the sheet does not decide the outcome.

D4, D6 and D7 stand as drafted. No boundary is broken by the draft. B-8, B-12, B-14, B-20,
B-21 and B-22 are each consistent with what is proposed here: the operation replaces one
field, so a second discount cannot stack (B-22), and it is called only from a press (B-21).

---

## For the task file

Rules for the *Architect consult* section of FE-035, in the lead's words or these.

1. **Stand-in.** A discount change on a live order is made by one pure operation in its own
   module beside `discount.ts`, reached as `store.changeDiscount(change, through)` on the
   active order. The module reads no clock and imports no React and no fixture. Its header
   says it stands in for the server's apply/replace/remove discount command (ARCHITECTURE
   section 13) and lists what it leaves out: PIN verification, the actor, the approver, the
   expected order version, the catalog version, the lease, the audit entry and a persisted
   `OrderDiscount`.
2. **A request, never a snapshot.** `change` is `{ kind: 'preset', presetId }`,
   `{ kind: 'free-form', value }` or `{ kind: 'remove' }`. The operation resolves the preset
   from a preset list it is handed as an input fact, builds the snapshot with `snapshotOf`,
   and sets `source` itself. The caller never supplies `source` or a preset's name or value.
3. **Refusals,** in this order: `closed`, `locked`, `nothing-to-remove`, `unknown-preset`
   (unknown or not active), `invalid-value`, `needs-manager`. The result is a value naming
   the refusal, never a throw and never a bare boolean. `nothing-to-remove` is checked before
   `needsManager` is called.
4. **Validity is the value's own.** A percent the money package parses and that is at most
   100%; a fixed amount that is not negative. A fixed amount above the subtotal is **not**
   refused: it applies and `discountAmount` caps it (FR-M5). `parseFreeForm`'s entry rule
   stays in the free-form sheet.
5. **The lock is checked inside the operation.** `locked` is this order's own payment session
   or the place's lock, `draft` or `lease`, read through the store's context ref at the
   moment of the call, as `fire` reads it.
6. **The gate is decided inside the operation.** It calls `needsManager(order.applied,
   change)` in the same update that writes. A gated transition is refused `needs-manager`
   unless `through` is `'manager-prompt'`. `through` is a required argument with no default:
   `'direct'` from the sheet's ungated path, `'manager-prompt'` as a literal inside M-1's
   `onSubmit` handler and nowhere else. It is never stored in state, a ref, the order, the
   URL or a prop, and it is never named *approved* or *confirmed*.
7. **The door.** The sheet asks `needsManager` about the store's order, as today. Ungated, it
   calls the operation. Gated, it opens `ApprovalDialog` with `requireFull`, an `onSubmit`
   handler that declares no parameter, and `onCancel` returning to the sheet as it was. No
   footnote. The comment at the call site says confirm stands for the server accepting the
   command and that nothing is verified. There is no magic PIN.
8. **All or nothing.** Validate everything, then write `applied` and clear `appliedNote` in
   one update through the functional updater, following `refund`'s pattern so a second call
   in the same tick sees the first. A refusal returns the same order object. The write goes
   through `update`; there is no by-id path.
9. **What is recorded.** No actor, no approver, no approval flag, never `approver: null`, and
   no time. A discount applied in this session shows no note. The header's actor copy is
   never copied into one. (A time line is pending the owner, below, and is not built.)
10. **One sheet, one order.** Every discount sheet on POS-03, opened from the close bar or by
    a `?state=sheet-*` address, reads `applied`, the note and the subtotal from `store.order`
    and writes through the operation. A fixture address supplies only the step showing, a
    half-typed entry, the opener and the landings. The four addresses keep the artifact's
    landings. A refusal does not route.
11. **On a refusal** M-1 closes if open, the discount sheet stays, and it shows the order's
    discount from the store. No new copy. A test hands the sheet a store whose operation
    refuses.
12. **The closed-order reader.** `bookRows` names a no-payment row from the snapshot's own
    label, not from `isComp`. Search `apps/pos/src` and `apps/pos/test` for `applied`,
    `totalsFor` and `isComp`, and say in the Handoff what was found.
13. **No audit in the client,** and no mock of one. The Handoff lists what the server owes:
    the four entries and six undecided points of question 8; the expected order version; the
    catalog version and the server's presets; server time; the lease; authoritative totals
    and the `SettingsVersion` rates; the in-flight state and the rejected-change picture. It
    says that a discount change carries no idempotency key.
14. **Removal.** When the server's discount command exists, the stand-in module is deleted,
    not kept as a fallback (section 12, section 15).
15. **What the tests prove.** The client's behaviour. AC-8, AC-9, AC-18 and AC-21 are not
    closed by this task. A unit test walks all eight rows of FR-F8's table against the pure
    operation with `'direct'` and with `'manager-prompt'`.
16. **Out of scope, recorded as found:** the three line mutations do not check a lock;
    `closeOrder` accepts a non-cash tender above the running balance; an emptied order keeps
    an invisible discount; the void sheet reads the fixture's order.

## For the owner

Nothing here blocks FE-035. No change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md is
asked for, and no new ADR is proposed.

1. **A time line on the change sheet.** For a discount applied in this session I recommend no
   line at all. If the owner wants *Applied at 19:44.*, with no name and no word about
   approval, it is a change to reviewed copy on an identity matter and is the owner's to
   confirm.
2. **A typed fixed amount above the subtotal.** FR-M5 says a fixed discount is capped. The
   free-form sheet refuses the entry, in provisional copy. Refuse at entry, or accept and
   cap? A preset above the subtotal applies and caps either way.
3. **Needed before Phase 2: an approved discount change that the server then refuses.**
   FR-J3 and AC-18 define the `REFUSED` audit entry for a refund only. Does a discount change
   (and a fired-line void) write the same entry, or none?
4. **Still open from ARCH-003.** Whether an abandoned approval prompt is a *cancelled
   approval* for FR-J3. The discount adds five more transitions that raise the prompt.
5. **Copy and design, for a designer with the owner's review:** the name of a free-form
   discount (*Other discount* today); the no-payment row for a full discount that is not the
   *Comp* preset; what an emptied order that still carries a discount shows; and the picture
   of a rejected discount change.

DONE
