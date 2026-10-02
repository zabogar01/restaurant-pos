---
id: FE-035
title: A discount chosen on POS-03 changes the order on screen
category: ui
touches: [money, audit, identity]
depends_on: []
owns: [apps/pos/src/**, apps/pos/test/**]
status: not-started
cycles: 0
---
# FE-035 — The discount applies

**Why this task exists.** The owner reviewed the frontend on 2026-10-02 and found that the
discount does nothing. The lead confirmed it and found it is two defects: the discount sheet
on a live order reads a fixture's order instead of the order on screen, and no choice in it
writes anything. FE-014 deferred this as its "next slice" and no slice was ever queued.

## Objective

On POS-03, a discount sheet reads the order the panel is showing and a choice in it changes
that order: a preset applies at once, a manager-gated change applies after the manager prompt
is confirmed, a discount can be replaced or removed, and the totals, the settlement and the
closed order all follow. The change is made by one pure operation that stands in for the
server's discount command, decides the manager gate itself and refuses what it must.

## Required inputs

### The two defects, as they stand (`development` at `493ba49`)

- `apps/pos/src/OrderPanel.tsx:171` — `const order = shownOrder(view)`, the fixture-only
  derivation, under a comment that says the sheets are not wired to the store. `:224` hands
  it to `panelDiscount(view, order)`. So on Table 2 (a table opened from the floor, drawn at
  `?state=default`) the sheet shows Table 1's *Staff meal 10%* and Table 1's subtotal, while
  the panel beside it, drawn from `store.order` (`:294`), shows Table 2.
- `apps/pos/src/DiscountSheets.tsx:53-61` — the one door, `change()`. Ungated it calls
  `go(fixture.landsOn(next))`; gated it opens `ApprovalPrompt`, whose approve is also only a
  navigation. `panelDiscount`'s `landsOn` returns the same view
  (`discountFixtures.ts:160`). Nothing writes the order.
- `apps/pos/src/orderStore.ts` — each order carries `applied?: DiscountSnapshot` and
  `appliedNote?: string` (`:50-51`), written only by the fixture seed (`:156-157`).
  `totalsFor` (`:191-195`) figures every total from the lines and `applied`, so the
  arithmetic already follows whatever `applied` holds. `discount.ts` (`needsManager`,
  `discountAmount`, `orderTotals`, `parseFreeForm`, `snapshotOf`) is pure and correct and is
  not to be rewritten.

### Owner rulings (`.agent/DECISIONS.md`, 2026-10-02)

- **O1.** The discount stays per order (FR-F1, B-22). No per-line discount.
- **O2.** A manager-gated discount change uses the refund's stand-in of 2026-10-01: six
  digits and the confirm key apply it with no PIN verified, the digits are discarded unread,
  nothing about an approval is stored, and the stand-in goes when the server command exists.

### Architect consult (ARCH-004)

The architect's report (`.agent/reviews/ARCH-004-discount-in-the-client.md`) is on the lead's
branch and is **not in your worktree**; you do not need it. The lead accepts its sixteen
rules. They are restated here in full as R1 to R14, with their reasons, and these are what you
build. Where this file says "ARCH-004 section 8", the content you need is in R14.

- **R1. A stand-in, in its own module.** One pure operation in a new module beside
  `discount.ts` (the name is yours; `discountChange.ts` is the lead's suggestion). It reads no
  clock and imports no React and no fixture. Its header comment says it stands in for the
  server's apply, replace and remove discount command (`docs/ARCHITECTURE.md` section 13) and
  lists what it leaves out: PIN verification, the actor, the approver, the expected order
  version, the catalog version, the lease, the audit entry and a persisted `OrderDiscount`.
  When the server command exists the module is deleted, not kept as a fallback.
- **R2. A request, never a snapshot.** The caller passes
  ```ts
  export type DiscountChange =
    | { kind: 'preset'; presetId: string }
    | { kind: 'free-form'; value: DiscountValue }
    | { kind: 'remove' };
  ```
  The operation is handed the preset list as an input fact, resolves the id, builds the
  snapshot with `snapshotOf` and sets `source` itself. A free-form snapshot's name is
  `FREE_FORM_NAME`'s value, passed in as a fact or moved to `discount.ts`, since the module
  imports no fixture. No caller supplies `source`, or a preset's name or value.
- **R3. Refusals, checked in this order:** `closed`, `locked`, `nothing-to-remove`,
  `unknown-preset` (unknown, or not active: FR-F5), `invalid-value`, `needs-manager`. The
  result is a value naming the refusal, never a throw and never a bare boolean.
  `nothing-to-remove` is checked before `needsManager` is called, because `needsManager`
  throws on that input (`discount.ts:55`).
- **R4. Validity is the value's own.** A percent the money package parses and that is at most
  100%; a fixed amount that is not negative. **A fixed amount above the subtotal is not
  refused**: it applies and `discountAmount` caps it (FR-M5). This check is not optional: an
  invalid snapshot in the book makes `discountAmount` throw inside `totalsFor` on every later
  render. `parseFreeForm`'s stricter entry rule stays in the free-form sheet as it is.
- **R5. The lock is checked inside the operation.** `locked` is true when this order has an
  active payment session or the place carries a lock, `draft` or `lease`. The store composes
  it as `fire` does (`orderStore.ts:392-401`): `context.current.locked ||
  originFacts(view).lock !== undefined`, read at the moment of the call, never captured when
  the callback was created. Unlike `close`, both locks refuse.
- **R6. The gate is decided inside the operation.** It calls `needsManager(order.applied,
  …)` on the order it is about to write, in the same update that writes. A gated transition
  is refused `needs-manager` unless the second argument, `through`, is `'manager-prompt'`.
  `through` is required and has no default: `'direct'` from the sheet's ungated path,
  `'manager-prompt'` as a literal inside the manager prompt's `onSubmit` handler and nowhere
  else. It is never placed in state, a ref, the order, the URL or a prop, and it is never
  named *approved*, *approval* or *confirmed*. A `'manager-prompt'` call for a transition that
  turns out ungated applies.
- **R7. The store method.** `store.changeDiscount(change, through)` on `OrderStore`, on the
  active order, through `update` (which already refuses a closed order). There is no by-id
  path. It returns the result. Follow `refund`'s pattern (`orderStore.ts:435-443`) so a
  second call in the same tick sees the first: evaluate against the latest book through the
  ref, advance the ref, and run the same operation inside the functional updater. Five
  hand-built `OrderStore` objects in `test/settlement.test.tsx` (`:328`, `:450`, `:761`,
  `:781`, `:1045`) do not supply it; make the method optional on the type, as `close` is, and
  have `OrderScreen` and `PosRoutes` always supply it.
- **R8. All or nothing.** Validate everything, then write `applied` and clear `appliedNote`
  in one update. `remove` clears both fields. A refusal returns the same order object, so the
  book's identity says nothing changed (B-20).
- **R9. What is recorded.** The snapshot and nothing else: no actor, no approver, no approval
  flag, never `approver: null`, and no time. A discount applied in this session carries no
  note, and the change sheet draws that gap as it already does for `zero`. The header's
  *Ana R.* is fixture copy and is never copied into a note.
- **R10. One sheet, one order.** Every discount sheet on POS-03, whether opened from the
  close bar or by a `?state=sheet-discount`, `sheet-freeform`, `sheet-remove` or
  `sheet-remove-freeform` address, reads `applied`, the note and the subtotal from
  `store.order` and writes through the operation. A fixture address supplies only the step
  showing (`trail`), the half-typed entry, the opener and the landings (`cancel`,
  `landsOn`). The four addresses keep the artifact's landings (`discountFixtures.ts:89-90`),
  which become true because the order was written before the landing. The picture at mount
  is unchanged, because the store is seeded from the same state's order fixture.
- **R11. The door.** The sheet still asks `needsManager` about the store's order, to draw a
  control gated and to decide whether to open the prompt. Ungated, it calls the operation
  with `'direct'`. Gated, it opens `ApprovalDialog` directly (not `ApprovalPrompt`) with
  `requireFull`, an `onSubmit` handler that **declares no parameter**, and `onCancel`
  returning to the sheet exactly as it was. No footnote. The comment at the call site says
  the confirm key stands for the server accepting the command and that nothing is verified.
  There is no magic PIN, and a second attempt mounts a fresh prompt.
- **R12. On a refusal** the prompt closes if it was open, the discount sheet stays, and it
  shows the order's discount as the store holds it. Nothing routes and no new copy is
  written. A correctly built screen cannot reach a refusal; a test hands the sheet a store
  whose operation refuses.
- **R13. The closed-orders reader.** `bookRows` (`closedOrders.ts:246`) prints
  `CLOSED_COPY.compNoPayment`, *Comp 100% · no payment taken*, for any 100% percent
  discount, so a free-form 100% would list as *Comp*. Lead ruling, **provisional copy**: for
  a no-tender order whose discount is a 100% percent, the row reads the snapshot's own label
  followed by the same words, `${totalsLabel(applied)} · no payment taken`. The *Comp* preset
  therefore still reads *Comp 100% · no payment taken*. Nothing reads `presetId` (B-8).
  Search `apps/pos/src` and `apps/pos/test` for `applied`, `totalsFor` and `isComp` and say
  in the Handoff what you found.
- **R14. No audit in the client, and no mock of one.** The Handoff lists what the server
  owes:
  - four audit entries: an ungated change (actor, no approver, before and after values,
    naming the preset); a gated change (one combined entry, actor and approver); a cancelled
    approval (actor, approver null); a failed approval (actor, approver null, counted against
    the approval throttle);
  - the expected order version; the catalog version and the server's own presets; the actor
    from the session and the approver from the PIN inside the command; the lease refusal;
    server time; authoritative totals and the `SettingsVersion` rates in place of the two
    constants in `discount.ts`; a persisted `OrderDiscount`; the in-flight state and the
    picture of a rejected change, which no design draws yet;
  - that a discount change carries **no idempotency key** (ADR-003 lists seven commands and
    this is not one);
  - six points the contract leaves undecided: an approved change the server then refuses;
    the order of the server's checks; which exits from the prompt count as cancelled; an
    approval attempt during the cooldown; choosing the discount already applied; what a
    free-form discount is called.

### Lead rulings on the architect's questions for the owner (the owner may overturn them)

- **L1.** No time is recorded and no *Applied at …* line is shown (R9).
- **L2.** The free-form sheet keeps refusing a typed fixed amount above the subtotal, in its
  existing provisional copy.

### Documents

- `docs/PRD.md` FR-F1 to FR-F8 (lines 188-204), FR-G12, FR-G13, FR-M3 to FR-M5.
- `docs/BOUNDARIES.md` B-8, B-12, B-14, B-20, B-21, B-22.
- The design: `docs/design/visual-directions/frost/pos/order.html`, the `sheet-discount`,
  `sheet-freeform`, `sheet-remove` and `zero` blocks. No new state is drawn by this task and
  none is needed: the sheets, the prompt and the totals row already exist.

## Constraints

- **No new screen, state, copy or CSS**, except R13's one provisional label. Do not add a
  notice, a success line or a refusal message.
- `discount.ts`'s `needsManager`, `discountAmount`, `orderTotals` and `parseFreeForm` keep
  their behavior. You may move `FREE_FORM_NAME` (R2). Write no arithmetic of your own: every
  figure comes from `orderTotals` and `discountAmount`.
- The digits are never read, compared, stored, passed on or logged (B-12, O2).
- Nothing chooses a discount but a press (B-21, FR-F7): opening a sheet, mounting an address
  and adding or removing a line change no discount. A line change never re-validates,
  shrinks or drops a discount.
- One discount per order (B-22): the operation replaces the one field.
- The void sheets (`VoidSheets.tsx`, `voidFixtures.ts`) and `ApprovalPrompt`'s use by them
  and by the `?state=approval*` addresses are not touched, though the void sheet is still
  handed `shownOrder(view)`. If removing that variable is needed, keep the void's argument
  exactly as it is.
- `close.ts`, `fire.ts`, `tender.ts`, `refund.ts` and `packages/**` have no diff.
- Format by hand, matching each file. Run no formatter.
- This task does not close AC-8, AC-9, AC-18 or AC-21: those are proved against the real
  server. Do not cite them as satisfied.

## Tests expected to change

All in `apps/pos/test/discount.test.tsx`. Found by the lead's grep; the explorer was not
used as the authority.

- **The `renderSheet` helper (`:72-82`) and its seven callers** (`:269`, `:279`, `:401`,
  `:407`, `:415`, `:420`, `:429`). It mounts a `DiscountSheet` from a fixture that supplies
  `applied`, the note and the subtotal. Under R10 those come from the order, so the helper
  and how each caller states its order may change. **Every assertion's meaning stays:** the
  gates, the request text, FR-F5 and B-8 (a deactivated or edited preset still reads; a
  reference to nothing reads the same), B-21 (opening changes nothing).
- **`:278-283`, "a preset is applied at once"**, asserts only where the sheet went. It gains
  an assertion that the order changed.
- **The source-reading tests at `:159`, `:343` and `:441`** read the discount source files as
  text. If one fails because code moved to the new module, extend its file list to include
  that module; do not weaken what it forbids.
- `closed-orders.test.tsx:98` and `:316` assert *Comp 100% · no payment taken* and must still
  pass unmodified under R13.

Tests of the landings (`:170-262`, `:797-869`) are expected to pass **unmodified** and to
gain assertions. So are the tests elsewhere that open or close a discount sheet without
choosing in it: `sheets.test.tsx:179-188`, `:362` and `:396`, and the state lists in
`order-panel.test.tsx:146-151`, `own-items.test.tsx:491`, `fire.test.tsx:754` and
`approval.test.tsx:468`. If any other existing test goes red, in this file or another, stop and end
BLOCKED with its name and what it asserts.

## Acceptance criteria

Each is a test unless it says otherwise. "The order" is what the panel draws from the store:
the totals rows and, where named, `store.order.applied`.

**The pure operation**

1. **FR-F8's eight rows, both doors.** For each of the eight transitions of
   `discount.ts:41-49`, the operation called `'direct'` applies the three ungated ones and
   refuses the five gated ones `needs-manager`, returning the same order object; called
   `'manager-prompt'` it applies all eight. Red case: a gated row applying under `'direct'`.
2. **The refusals, in order.** One test per refusal of R3, and one that an input which is
   closed, locked and gated at once answers `closed`. `remove` on an order with nothing
   applied answers `nothing-to-remove` and does not throw. Red case: a throw, or a later
   refusal answering first.
3. **The caller cannot author the gate.** The operation's argument type has no `source`,
   name or preset value; a preset id that is unknown, or whose preset is not active, is
   refused `unknown-preset`. Red case: an inactive preset applying.
4. **Validity (R4).** A percent of `100.0001`, a percent that does not parse and a negative
   fixed amount are refused `invalid-value`. A fixed amount above the subtotal **applies**,
   and the order's total is then `0` with the snapshot's amount unchanged. Red case: the
   fixed amount refused, or a later `totalsFor` throwing.
5. **The note.** Every applied change clears `appliedNote`; a refusal leaves it. Red case:
   *Applied by Ana R. at 19:44. Preset, no approval.* still under a discount chosen since.
6. **The module is clean.** It imports no React and no `*Fixtures` module, and holds no
   `Date`, no timer and no `console`. Red case: any of them.

**The store**

7. **`changeDiscount` writes the active order only, and the totals follow.** On the Table 1
   order (`default`, *Staff meal 10%*, subtotal 405.000), `{ kind: 'preset', presetId:
   'regular' }` with `'direct'` makes the discount row read *Regular customer 5%* and
   *−20.250*, and every totals row equal `orderTotals(405_000n, <that snapshot>)`. Red case:
   the row still reading *Staff meal 10%*.
8. **The lock (R5).** With a payment session active on the order, and separately at a
   fixture state whose place carries a `draft` or a `lease` lock, `changeDiscount` answers
   `locked` and the order object is the same. Red case: the total moving under a lock.
9. **A closed order is refused** `closed`, and its totals on POS-06 do not move. Red case: a
   closed order's discount changing.
10. **Twice in one tick.** Two `remove` calls in the same tick: the first applies, the second
    answers `nothing-to-remove`. Red case: both reporting success.

**The sheet reads the order on screen**

11. **Table 2 is not Table 1.** Through `PosRoutes`: open Table 2 from the floor, add a
    Burger, press Discount. The sheet is the **picker** (title *Discount*), not *Change
    discount*, and shows no *Staff meal*. Red case: today's behavior, the change sheet with
    Table 1's Staff meal.
12. **The subtotal is the order's.** On an order whose lines differ from its fixture's (a
    line added through the item sheet), the change sheet's *Currently applied* amount is the
    discount on the panel's subtotal. Red case: the fixture's figure.

**A choice changes the order**

13. **A preset applies at once (FR-F2).** On an order with no discount, pressing a preset
    closes the sheet with no prompt, adds the discount row to the totals, and leaves the URL
    and the history length unchanged; focus is on Discount. Red case: no row.
14. **Replace and remove a preset (FR-F8, ungated).** From the change sheet on a
    preset-carrying order: another preset replaces it with no prompt; *Remove the discount*
    removes the row and the total equals `orderTotals(subtotal)`. Red case: either leaving
    the old row.
15. **A free-form discount through the prompt (FR-F3, O2).** *Other amount*, `15`, *Apply*
    opens the manager prompt; nothing on the order has changed while it is open; the confirm
    key is off until six digits are entered; six digits and the confirm key close the prompt
    and the sheet and the totals read *Other discount 15%*. Red case: the order changing
    before confirm, or confirming with five digits.
16. **Cancelling the prompt changes nothing (B-20).** Cancel and Escape each return to the
    sheet as it was, with the entry still typed and the order's totals unchanged. Red case:
    a discount applied by a cancelled prompt.
17. **A free-form discount gates everything after it.** On an order carrying a free-form
    discount, replacing it with a preset and removing it each go through the prompt, and
    after confirm the order reads the preset, or no discount. Red case: either applying with
    no prompt.
18. **The digits go nowhere.** The prompt's `onSubmit` handler in the discount sheet declares
    no parameter, and `'manager-prompt'` appears as a literal only inside it (a source-reading
    test, as `discount.test.tsx:159` does it). Red case: a `pin` parameter, or the literal
    elsewhere.
19. **The four addresses are live (R10).** At `?state=sheet-discount`, *Regular customer —
    5%* lands on `default` **and** the totals read *Regular customer 5%*. At
    `?state=sheet-remove`, the picker's *Comp — 100%* lands on `zero` and the total is `0`;
    *Remove the discount* lands on `default` with no discount row. At
    `?state=sheet-remove-freeform`, a preset confirmed through the prompt lands where that
    preset lands and the order carries it. Red case: the landing reached over an unchanged
    order.
20. **A refusal (R12).** A sheet handed a store whose `changeDiscount` refuses stays open,
    routes nowhere, shows the order's discount, and the prompt, if it was open, is closed.
    Red case: the sheet closing as if the change had been made.
21. **Nothing chooses a discount but a press (B-21).** Mounting any of the four addresses,
    opening and cancelling the sheet, and adding or removing a line leave `applied` as it
    was. A line removed below a fixed discount's amount leaves the snapshot unchanged and the
    total at `0`. Red case: a discount dropped or shrunk by a line change.

**The rest of the client follows**

22. **Settlement.** After a discount is applied on POS-03, Settle shows the discounted total
    as the amount due. A 100% discount reaches the zero-total settlement and closes with no
    tenders. Red case: the undiscounted total due.
23. **Closed orders.** A book order closed with a discount lists on POS-05 with the
    discounted total, and POS-06 shows the discount row with the snapshot's label. A book
    order closed with a free-form 100% reads *Other discount 100% · no payment taken*, and
    one closed with the *Comp* preset reads *Comp 100% · no payment taken* (R13). Red case:
    the free-form one reading *Comp 100%*.
24. `npm run verify` is green from the repository root. The baseline at `493ba49` is 2544
    tests in 37 files; the output still holds no `Not implemented` line.

## Out of scope

Each is deliberate. Record under *Found, not fixed* anything you see of them, and change none.

- **The void sheets.** Fired-line and whole-order void are inert on a live order in the same
  way; that needs its own architect consult (a cancellation ticket, B-16).
- **`addLine`, `removeLine` and `setQuantity` do not check a lock** in the store.
- **`closeOrder` accepts a non-cash tender above the running balance** (B-5).
- **An emptied order keeps its discount**, invisible, while Discount is drawn off on an empty
  order. Do not draw or drop it.
- A time or actor line on the change sheet; a word such as *capped* on the totals row; the
  name of a free-form discount; the picture of a rejected discount change. All are the
  designer's or the owner's.
- Anything in `apps/server`, any audit record, and the back office's presets.

## Reporting

Write the Handoff below in full prose: what you built and where, each decision and its
evidence, every existing test you changed and why, the red cases you ran (mutate, read the
failure, revert), what you found and did not fix, what the server owes (R14), and the real
`npm run verify` output. If a rule here contradicts the code, a boundary or another rule,
build what the question does not affect and end `BLOCKED: <question>` with a proposed
answer.

## Handoff

