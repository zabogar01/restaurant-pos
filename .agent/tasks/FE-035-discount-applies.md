---
id: FE-035
title: A discount chosen on POS-03 changes the order on screen
category: ui
touches: [money, audit, identity]
depends_on: []
owns: [apps/pos/src/**, apps/pos/test/**]
status: review
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

## Lead verify (2026-10-02)

The lead ran `npm run verify` in this worktree at `e184638`: typecheck clean, 39 files and
2638 tests, green (the baseline on `development` at `493ba49` is 37 files and 2544 tests), and
no `Not implemented` line. The lead then walked the discount in Chrome against the dev server
at 1280×800. No defect was found, and nothing goes back to the builder before the review.

- **The diff** stays inside `owns:`. `close.ts`, `fire.ts`, `tender.ts`, `refund.ts`,
  `VoidSheets.tsx`, `voidFixtures.ts` and `packages/**` have no diff. The only existing test
  file changed is `discount.test.tsx`, in the places the task named. `git diff --check` flags
  one blank line at the end of this file.
- **The operation** (`discountChange.ts`) was read whole: the six refusals in the order of R3,
  the gate decided on the order being written, the snapshot built inside, and one write of
  both fields. The store composes the lock as `fire` does and writes through `update`.
- **The owner's finding (criterion 11).** Table 2, opened from the floor with one Burger:
  Discount opened the **picker**, with no *Currently applied* card. Before this task it opened
  *Change discount* over Table 1's Staff meal.
- **A preset.** *Regular customer — 5%* closed the sheet with no prompt; the totals read
  *Regular customer 5% −6.750*, service charge 6.413, total 134.663 (from 141.750). The
  address and the history length did not change, and focus was on Discount.
- **The change sheet** then read *Regular customer — 5% −6.750* with no note, and only the
  free-form replacement was gated.
- **A free-form discount.** *15* and Apply opened the manager prompt, *Replace Regular
  customer 5% — with Other discount 15% −20.250*, over an inert sheet and an inert order whose
  totals had not moved. With five digits the confirm key was `aria-disabled` and a press
  changed nothing. Cancel returned to the sheet with *15* still typed and focus on Apply. A
  second Apply mounted an empty pad. Six digits and confirm closed both, and the totals read
  *Other discount 15% −20.250*, total 120.488.
- **A free-form discount gates what follows.** The change sheet drew all three controls
  gated. *Remove* opened the prompt; Escape closed the prompt alone and left the sheet and the
  order as they were.
- **A full discount.** A free-form 100%, confirmed, gave a total of 0. After Send, Settle
  showed *Nothing to collect* and closed with no tenders. POS-05 listed *Table 2 · Other
  discount 100% · no payment taken · 0*, beside the fixture's *Comp 100% · no payment taken*.
- **Settlement and closed orders.** Table 3 with *Staff meal — 10%*: total 127.575 on POS-03,
  127.575 due on POS-04, a Card tender of 127.575, then POS-05's row at 127.575 and POS-06's
  *Staff meal 10% −13.500* under *What was charged*.
- **The fixture addresses.** At `sheet-discount`, *Regular customer — 5%* landed on `default`
  with the totals reading *Regular customer 5% −20.250*, total 403.988. At `sheet-remove`,
  the picker's *Comp — 100%* landed on `zero` with a total of 0.
- **A lock.** At `lock-draft` the Discount control is `aria-disabled` and a press opens
  nothing.
- The browser console showed no error.

**Lead ruling on criterion 11's wording: the builder's reading is accepted.** The picker
always offers the *Staff meal* preset, so "shows no *Staff meal*" cannot be literal. What the
criterion means, and what is tested, is that no *Currently applied* card is drawn and the
panel has no discount row.

**Lead ruling on *a preset is applied at once*: accepted as built.** That test stubs the
store, so it asserts what the store was asked; the order changing is criterion 13's test in
`discount-apply.test.tsx`.

**Not proved by the builder, for the reviewer to weigh:** no separate mutation was run for
the place-lock cases, the closed-order refusal or `unknown-preset` in the store. Their tests
exist and pass.

## Handoff

### What I built

A discount chosen on POS-03 now changes the order on screen, through one pure operation that stands in for the server's discount command.

- `apps/pos/src/discountChange.ts` (new). `changeDiscount(order, change, through, facts)` is generic over any order carrying `applied?` and `appliedNote?`. It takes a `DiscountChange` request (`preset` by id, `free-form` by value, or `remove`), never a snapshot, and it builds the snapshot itself with `snapshotOf`, setting `source` and the free-form name. It checks `closed`, `locked`, `nothing-to-remove`, `unknown-preset` (unknown or not active), `invalid-value` and `needs-manager`, in that order, and answers `{ refused, order }` with the very order it was given, or `{ order }` with the new one. `nothing-to-remove` is checked before `needsManager` is called, because that function throws on that input. The gate is decided inside, on the order about to be written: a gated transition is refused unless `through` is `'manager-prompt'`. A fixed amount above the subtotal is not refused; `discountAmount` caps it. Every applied change drops `appliedNote`; a removal drops both fields. The module imports no React and no `*Fixtures` module, and holds no `Date`, timer or `console`. Its header lists what it leaves out (PIN verification, actor, approver, expected order version, catalog version, lease, audit entry, a persisted `OrderDiscount`) and says it is deleted when the server command exists. It also exports `snapshotFor`, which the sheet uses only to draw the manager-prompt request text.
- `apps/pos/src/discount.ts`: `FREE_FORM_NAME` moved here from `discountFixtures.ts` (no re-export; the only importers were the sheet and the fixtures file). No behavior change to `needsManager`, `discountAmount`, `orderTotals` or `parseFreeForm`.
- `apps/pos/src/orderStore.ts`: `store.changeDiscount(change, through)`, optional on `OrderStore` as `close` is, and a new `LiveOrderStore` type (`OrderStore` with `changeDiscount` required) that `useOrderBook`, `useOrderStore` and `ControlledOrderScreen` use. That makes the compiler check that `OrderScreen` and `PosRoutes` always supply it, while the five hand-built stores in `settlement.test.tsx` still type-check unchanged. It follows `refund`'s pattern: the facts are read at the call from `context.current` (`locked || originFacts(view).lock !== undefined`, so both the payment session and a place `draft` or `lease` refuse), the operation is evaluated against the latest book through `bookRef`, the ref is advanced, and the same operation runs again inside `update`'s functional updater, which also refuses a closed order. The presets handed to the operation are the fixtures' `PRESETS`.
- `apps/pos/src/DiscountSheets.tsx`: `DiscountSheet` takes `fixture`, `order` (a `ShownOrder`), `changeDiscount` and `go`. The discount, its note and the subtotal come from `order`. Ungated presses call `changeDiscount(..., 'direct')`. A gated press opens `ApprovalDialog` directly with `requireFull`; its `onSubmit={() => settle(changeDiscount(prompt.next, 'manager-prompt'), prompt.next)}` declares no parameter and is the only place the `'manager-prompt'` literal is written. The digits are never read. `onCancel` just closes the prompt and returns focus to the control that raised it. A refusal closes the prompt if open, keeps the sheet, routes nowhere and writes no copy. A success calls `go(fixture.landsOn(change))`.
- `apps/pos/src/discountFixtures.ts`: `DiscountSheetFixture` no longer carries `applied`, `appliedNote` or `subtotal` (one owner of that state), and `landsOn` now takes a `DiscountChange` instead of a snapshot (so the Comp landing reads the request's `presetId`, not a snapshot). `panelDiscount(view, order)` keeps its signature and uses the order only to pick the first sheet. The four `?state=sheet-*` fixtures keep the artifact's landings. `TABLE_SUBTOTAL` is gone (unused). The `OTHER_15` and `STAFF_MEAL` constants and their notes remain, since `orderFixtures.ts` seeds from them.
- `apps/pos/src/OrderPanel.tsx`: the discount sheet is handed `store.order` and `store.changeDiscount`. `const order = shownOrder(view)` stays, only for the void sheet, whose argument I did not touch (the comment now says so).
- `apps/pos/src/closedOrders.ts` (R13): for a no-tender book order whose discount is a 100% percent, the row reads `${totalsLabel(applied)} · no payment taken`. The Comp preset still reads *Comp 100% · no payment taken*; a free-form 100% reads *Other discount 100% · no payment taken*. Marked provisional copy in a comment. `CLOSED_COPY.compNoPayment` remains for the fixture rows.

### Decisions, and on what evidence

- **No active order answers `closed`.** `changeDiscount` in the store returns `{ refused: 'closed' }` if the book holds no active order. R3 has no "no order" refusal and I invented none; nothing in the screen can reach it.
- **The sheet asks `needsManager` through `{ source: next.kind }`**, since `DiscountChange['kind']` is exactly `DiscountSource` for the two non-remove cases. This keeps the existing source-reading test that forbids `source === 'preset'` in the sheet passing.
- **Landing tests were not edited.** `discount.test.tsx:170-262` and the later landing tests pass unmodified, as the task expected. The assertions that each landing is now true of the order are in the new file instead (see below), not added into those tests.
- **R12 refusal on a gated press whose preset is unknown**: the sheet skips the prompt (it has nothing to describe) and asks the store directly, which refuses `unknown-preset`. This path is unreachable from the picker, which lists only active presets.

### Tests

New: `apps/pos/test/discount-change.test.ts` (45 tests: AC 1 to 6) and `apps/pos/test/discount-apply.test.tsx` (44 tests: AC 7 to 23, store through a probe of `useOrderBook`, sheets through `OrderScreen`/`PosRoutes`, settlement and closed orders through the real route).

Existing tests changed, all in `apps/pos/test/discount.test.tsx`, none loosened:
- The `renderSheet` helper (now `renderSheet(fixture, order, refuses?)`, returning `{ went, asked }`, with `orderOf(state)` and `withoutDiscount(order)` helpers) and all seven callers. Each caller states the order it stands over; every assertion keeps its meaning (gates, request text, FR-F5, B-8 including a reference to nothing, B-21).
- *a preset is applied at once* now also asserts the store was asked `{ kind: 'preset', presetId: 'staff-meal' }` with `'direct'`. The assertion that the order itself changed is in `discount-apply.test.tsx` (AC 13), because `renderSheet` stubs the store. This is the one place I read the task's "gains an assertion that the order changed" as satisfied by a sibling test and not that test; say if you want it moved.
- `:312` read `fixture.applied`; it now reads `orderOf(state).applied`, the same fact the sheet reads.
- The source-reading tests at `:343` and `:441` gained `discountChange.ts` in their file lists, and `:159` gained one line holding the new module to the same "no `source ===` literal" rule. Nothing they forbid was weakened.

Red cases, each run as a mutation, the failure read, and reverted (the tree was clean of mutations before `verify`):
1. Gated row applying under `'direct'` (`&& false` on the gate): nine tests in `discount-change.test.ts` and *a gated change asked for directly is refused* went red.
2. `nothing-to-remove` check removed (so `needsManager` runs first): three tests red, with the real `there is no discount to remove` throw, including *twice in one tick*.
3. Inactive preset applying (`?.active` dropped): *a preset that is not active is refused* red.
4. `appliedNote` surviving a change: the note tests in both files red (the old *Applied by Ana R. at 19:44…* line still under the new discount).
5. A fixed amount capped at 400.000 as a proxy for refusing one above the subtotal: *a fixed amount above the subtotal applies* red with `invalid-value`.
6. `Date.now()` added to the module: the purity test in `discount-change.test.ts` and the timer/date test in `discount.test.tsx` red.
7. The `bookRef` advance removed: *twice in one tick* red (`[{}, {}]`). The session-lock term removed from the facts: *an active payment session refuses* red.
8. `OrderPanel` reverted to hand the fixture's `shownOrder(view)` to the sheet: nine tests red, including Table 2 opening *Change discount* (AC 11), the subtotal, the replace and the free-form application.
9. R13 reverted to `compNoPayment`: *a free-form 100% reads its own words* red (`Comp 100%`).
10. A `(pin)` parameter on `onSubmit`: both source-reading tests (AC 18) red.
11. `onCancel` applying the change: the Cancel and Escape tests in both files red (the totals read *Other discount 15%* after a cancelled prompt).

I did not run a separate mutation for the place-lock cases (`lock-draft`, `lock-lease`), the closed-order refusal, or `unknown-preset` in the store; their tests exist and pass but I did not prove each red on its own.

### What I found and did not fix

- **AC 11 cannot be read literally.** It says the picker "shows no *Staff meal*", but the picker always offers the *Staff meal — 10%* preset. I asserted what the red case means: the sheet is titled *Discount*, shows no *Currently applied* card, and the panel beside it has no discount row. Wording for the lead to confirm.
- **`addLine`, `removeLine`, `setQuantity` still check no lock** (out of scope, as stated). The void sheets are still inert on a live order (out of scope).
- **An emptied order keeps its discount** invisibly (out of scope). `totalsFor` returns bare totals for an order with no lines, so the discount row and the service row vanish while `applied` stays.
- **R13 search** (`applied`, `totalsFor`, `isComp` in `apps/pos/src` and `apps/pos/test`): `isComp` has exactly one reader, `bookRows` in `closedOrders.ts` (it did not feed anything else, and no test names it). `totalsFor` is read in `orderStore.ts` only (the store's totals, the refund's total, the close's total, the line-editor preview). `.applied` is also read by `FloorScreen.tsx:161` (the floor's tile totals from a fixture) and `voidFixtures.ts:127`. I changed none of those. `closed-orders.test.tsx:98` and `:316` pass unmodified.
- **Shell rule slip.** Once I edited `DiscountSheets.tsx`'s import block with a python heredoc instead of the file tools; the result was the same as an `Edit` would have made. No formatter was run, and no file outside my owned paths was touched.

### What the server owes (R14)

- Four audit entries: an ungated change (actor, no approver, before and after values, naming the preset); a gated change (one combined entry, actor and approver); a cancelled approval (actor, approver null); a failed approval (actor, approver null, counted against the approval throttle).
- The expected order version; the catalog version and the server's own presets (the client uses the fixtures' `PRESETS`); the actor from the session and the approver from the PIN inside the command; the lease refusal; server time; authoritative totals and the `SettingsVersion` rates in place of the two constants in `discount.ts`; a persisted `OrderDiscount`; the in-flight state and the picture of a rejected change, which no design draws yet.
- A discount change carries **no idempotency key** (ADR-003 lists seven commands and this is not one).
- Six points the contract leaves undecided: an approved change the server then refuses; the order of the server's checks; which exits from the prompt count as cancelled; an approval attempt during the cooldown; choosing the discount already applied; what a free-form discount is called.
- The stand-in goes when the command exists: delete `discountChange.ts`, `store.changeDiscount`, `LiveOrderStore`, and the confirm-key stand-in in the manager prompt (O2). This task closes none of AC-8, AC-9, AC-18 or AC-21.

### `npm run verify`

Run from the worktree root after the last edit: typecheck clean for `apps/server`, `packages/money` and `apps/pos`; `vitest run`: **39 test files, 2638 tests, all passed** (baseline at `493ba49` was 37 files and 2544 tests). The output holds no `Not implemented` line. The storage-dependent server migration tests were not exercised separately beyond what `npm run verify` runs.

### For the next agent

The one thing you do not have is a browser: I could not look at the screens, so the focus return to *Discount* (AC 13) and the inert sheet behind the prompt are proved in jsdom only. Commit: see the branch log on `agent/fe-035`.

DONE

