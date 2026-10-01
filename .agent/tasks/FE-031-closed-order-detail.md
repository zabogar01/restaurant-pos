---
id: FE-031
title: POS-06 closed order detail — what was charged, the original payment and the reprint results, read-only
category: ui
touches: []
depends_on: [FE-030]
owns: [apps/pos/src/**, apps/pos/test/**]
status: not-started
cycles: 0
---
# FE-031 — POS-06 closed order detail, read-only

**Status:** Written 2026-10-01 by `lead`. This is **F4e-2**, the second of the slices that
build POS-05 and POS-06 from DESIGN-009. It is read-only: nothing on this screen changes an
order. The refund (the allocation sheet, the manager approval and what follows them) is
FE-032 and is not built here.
**Source:** DESIGN-009, complete and merged, with DESIGN-010's fixture corrections. The
artifact is `docs/design/visual-directions/frost/pos/closed-order.html`, driven by the
detail branch of `closed.js` (`:87–180`, after the list branch returns) and styled by
`closed.css` in the same folder. DESIGN-009's Handoff, and its *Round 2* section
especially, is the rationale; where round 1 and round 2 disagree, round 2 is current.

## Objective

Today `/pos/closed-order` renders a placeholder: the bare device frame
(`ClosedOrderPlaceholder` in `PosRoutes.tsx`). When this task is done it is POS-06 as the
artifact draws it, without the refund: the order a POS-05 row led to, showing when it
closed, the lines that were charged, the original payment, the stored totals under *What
was charged*, and a *Reprint receipt* action with its four results. An order the cashier
closed in this session is read from the order book; a fixture row shows the same fixture
order the list showed. Fourteen of the artifact's twenty-seven states are built here.

## Required inputs

1. **The artifact**, `closed-order.html` with `closed.js` and `closed.css`. Its states are
   declared in `closed-order.html:7`. This task builds these fourteen: `default`, `cash`,
   `custom`, `quick`, `zero`, `refunded`, `dayclosed`, `reprint`, `reprint-unknown`,
   `reprint-sent`, `reprint-printed`, `loading`, `error`, `overflow`. The other thirteen
   (`sheet-*`, `approval`, `approval-edited`, `refund-error`, `refund-error-cash`,
   `day-refusal`) are FE-032's. Read in `closed.js`: which order a URL selects (`:90–95`),
   the figures (`:96–97`, `:120`), the header and the two unavailable states (`:122–124`),
   the notices (`:125–132`), the body (`:133`), and the two actions this task keeps
   (`:173`, `:175`). Open it in a browser if you have one; if you do not, say so and do not
   look for one.
2. **DESIGN-009's task file**, `.agent/tasks/DESIGN-009-closed-orders-and-refund.md`:
   Part B's reprint paragraph and rules B2 and B5 to B10 (`:116–175`); round 2 item 7 (F9,
   no discount row when the order carries none, `:336–338`); Part D answer 4 on the header
   (`:515–522`); the Handoff's reprint paragraph (`:429–436`) and *Fixture arithmetic*
   (`:457–472`).
3. **FE-030's task file and Handoff**, `.agent/tasks/FE-030-closed-orders-list.md`, its
   last section above all (*What the next slice needs*): the row hrefs are fixed, and a
   direct visit to `/pos/closed-order?order=table-1` finds an empty book.
4. **The code this builds on:**
   - `PosRoutes.tsx`: the route and the placeholder it replaces;
   - `closedOrders.ts` and `ClosedOrdersScreen.tsx` (FE-030): the six fixture orders
     (`FIXTURE_ORDERS`, module-private today), `wibTime`, the row's name for a book order,
     the header composition, and the `closed-*` styles in `pos.css`;
   - `orderStore.ts`: `OrderBook.orders()` (`:226`) and `orderFor(id)` (`:222`). A closed
     entry carries `order` (a `ShownOrder`: `groups` of lines, `totals`, `applied`),
     `closedAt`, `tenders` and `change`;
   - `orderFixtures.ts`: `OrderLine` (`:32`), whose `amount` is the line's own total and
     whose `status` may be `voided`;
   - `OrderPanel.tsx`: `LineContent` and `modifierText` (`:697–722`), how a line and its
     modifiers are worded, and `TotalsView` (`:724`), the totals block settlement draws;
   - `close.ts`: `Tender` (`{ label, amount }`) and `ClosedOrder`; `tender.ts` and
     `SettlementScreen.tsx`: how settlement decides which tender is cash and takes change;
   - `incidentFixtures.ts`: `LIVE_REPRINT_TITLE` (*Reprint sent*) and the receipt class of
     notice POS-07 already draws; `navigation.ts`: `followClientSide`.
5. **The contract:** `docs/PRD.md` FR-G7 and AC-13 (a reprint carries identical figures),
   FR-G8 and FR-E6 (a receipt failure is lower priority and never the kitchen emergency),
   FR-G11 (a zero-total order is a closed order), FR-H6 (REFUNDED is terminal), FR-H7
   (no refund against a closed business day), section 9 (receipt content is open; WIB,
   24-hour `HH:MM`); `docs/design/SCREEN-INVENTORY.md` POS-06 (`:449–`) and rulings I-1 and
   C-1; `docs/BOUNDARIES.md` B-1, B-6, B-9, B-10, B-19.

## What to build

1. **The screen**, replacing `ClosedOrderPlaceholder`, in the artifact's composition:
   - the header: `← Closed orders`, an `h1` naming the order (*Table 1*, *Quick sale*),
     the tag *CLOSED* or *REFUNDED*, the actor and the idle figure as POS-05 draws them.
     **Release is not drawn**, for the reason POS-05 gives (it is FR-A, not built);
   - a two-column body: on the left a scroll region with the note line, any notices, the
     charged lines and the original payment; on the right the pinned summary, *What was
     charged* with the totals, and beneath it the actions.
2. **Which order is shown.** The row hrefs FE-030 fixed are this screen's input.
   - **A fixture row**, `?state=<state>&order=<state>&time=<HH:MM>`: the artifact's own
     scheme (`closed.js:90–95`). `state` selects the picture, `order` selects which of the
     six fixture orders, and `time` is the closing time shown. With no `order`, the state
     picks its own order as the artifact's table does (`cash` → Table 7, `custom` →
     Table 4, `quick` → Quick sale, `zero` → Table 6, `refunded` → Table 3, otherwise
     Table 1). `list=dayclosed` marks the open day's order in the closed-day list.
   - **A book row**, `?order=<book id>` and no `state`: the order is read from the book,
     by id, and drawn from the book alone: its name as POS-05 names it, `closedAt` in WIB,
     its own lines, tenders, change and stored totals. Its picture is `default`.
   - **One source for the six fixture orders.** The list and the detail must read the
     same data, so an order cannot show one payment in the list and another here. Export
     what FE-030 kept private, or move it; do not copy it.
   - **Lead ruling: a book id the book does not hold** (a reload, or a direct visit; the
     book lives in memory) draws the artifact's `error` composition, *Could not load this
     order*. It must never fall back to a fixture order: that would show Table 1's money
     under another order's address. *Retry* reads the book again.
   - A `state` this task does not build reads as `default`.
3. **The left column**, per `closed.js:133`:
   - the note *Closed <HH:MM> · Business day 25 Sep*, or *26 Sep* under `list=dayclosed`.
     A book order belongs to the open business day the floor's fixture names; do no
     arithmetic on the real date;
   - the group head *<n> lines · charged items* and one row per charged line: quantity,
     name with its modifiers beneath as the order panel words them, and the line's amount.
     The fixture orders carry the artifact's two lines (Burger with *Large (+20.000) ·
     Extra cheese (+15.000)*, 135.000; Soda, 30.000). **Lead ruling: a voided line was not
     charged and is not listed or counted**; `n` counts lines, not units (DESIGN-009 Part D
     answer 2);
   - the group head *Original payment* and one row per tender, label and amount, in the
     order they were taken, repeated labels kept. A zero-total order reads *No payment
     taken · fully discounted* instead. Where change was given, two more rows: *Change
     given −<change>* and *Cash contribution <amount>*;
   - in `refunded` only, the group *Money returned · full order* with the artifact's rows
     (each tender less its change; a row at 0 left out).
4. **The cash contribution is the cash tendered less the change**, never the order total
   by assumption (DESIGN-009 B3, AC-25: the effective contribution). For the fixture's
   single cash tender the two are equal (200.000 − 44.075 = 155.925). For a book order
   that took a card and then cash with change they are not. Write **one helper** for it,
   as `Money` (`bigint`), and use it here **and in POS-05's row**: FE-030's row writes
   `contribution <order total>` (`closedOrders.ts:225`), which is wrong for that mixed
   case because the lead's FE-030 text said `<total>`. Decide which tender is cash the
   way settlement does, and say in the Handoff what that test is.
5. **The summary**, per `figures()` (`closed.js:120`): the heading *What was charged*;
   *Subtotal*; the discount row with its own label and a minus sign, **omitted when the
   order carries no discount** (F9, the `quick` state); the service charge row; *Total* in
   the grand style; and the line *Stored at close · figures do not change with today's
   settings.* For a book order every figure is read from the stored `order.totals` and the
   stored discount snapshot; nothing is recomputed (FR-G7, B10). Reuse `TotalsView` only
   if it draws exactly these rows; the artifact has no tax line here.
6. **The actions.** *Reprint receipt* is present in every state that shows an order,
   including `zero`, `refunded` and `dayclosed`, and is not gated. **No Refund control is
   drawn in this slice, in any state** (FE-032 adds it). The artifact's three reasons a
   refund is not offered are drawn as it has them: *No payment taken · fully discounted.*
   (zero), *Already refunded · this order is final.* (refunded), *Refund unavailable ·
   business day closed.* (closed day). There is no void control (B-19).
7. **Reprint and its four results** (FR-G7, FR-G8, FR-E6), each a notice above the lines:
   - pressing *Reprint receipt* shows *Reprint sent*, with no time and no claim that it
     printed, and leaves everything else on the screen as it was, including a closed-day
     or REFUNDED notice (`closed.js:173`). This holds for a book order too;
   - `reprint-sent` pictures that same notice;
   - `reprint`: *Receipt reprint FAILED · The order is still closed.* with the link *View
     receipt incidents*;
   - `reprint-unknown`: *Receipt delivery UNKNOWN · Check the printer before reprinting.*
     with the same link;
   - `reprint-printed`: *Receipt PRINTED · 20:26 · Server-confirmed result. The original
     charged figures were used.* A printed time appears only in this fixture.
   - The two failures use the receipt (amber) class, never the kitchen emergency. The
     link goes to `/pos/incidents`, client-side. Add no anchor and do not change
     `IncidentsScreen`.
   - Every result shows the same figures as `default` (AC-13).
8. **The other states.**
   - `dayclosed`: the notice *This order's business day is closed · Reprinting still
     works. Refunds are unavailable.* A fixture row reached with `state=dayclosed` shows
     its own order (`order=cash` is Table 7) under that notice.
   - `refunded`: the tag *REFUNDED* and the artifact's notice (*REFUNDED · 20:31 ·
     approved by M. Iqbal*, with the fixture reason).
   - `loading` and `error`: the header reads *Closed order* with no tag, and the body is
     the artifact's message. `error`'s *Retry* shows `default` for a fixture address.
   - `overflow`: the long order (twenty lines, subtotal 1.650.000, discount 165.000,
     service charge 74.250, total and Card 1.559.250). The left column scrolls; the
     summary and the actions do not move.
9. **Leaving.** `← Closed orders` goes to `/pos/closed-orders`, and to
   `/pos/closed-orders?state=dayclosed` from a closed-day order or one reached with
   `list=dayclosed` (`closed.js:123`). It is an anchor, followed client-side.
10. **Styles** in `pos.css`, mapped from `closed.css` with registry tokens only, reusing
    FE-030's `closed-*` classes where they already say the same thing. The summary's width
    is `--frost-order-panel-width`. No new token. Give nothing in the scrolling column a
    `z-index`: FE-030's round 1 found a sticky head painting over a sheet for that reason.

## Constraints

- **Read-only.** Nothing here changes the book or any order. No refund, no void, no
  correction control, no allocation, no manager prompt.
- **What was charged, not a receipt** (B8). No receipt layout, receipt number or fiscal
  field (ruling I-1; PRD section 9 is open).
- **Money is `Money` (`bigint`)** end to end. Never call `Number()` on money.
- **Release is not drawn**, and the closed-day notice does not clear (FR-A is not built).
- A reprint here creates no incident and writes nothing: the client has no print job to
  follow. Do not wire it to the incidents screen's state.
- Use `<a>` for going and `<button>` for acting; an off action is `aria-disabled`, never
  `disabled` (FE-024). Do not run Prettier.

## Tests expected to change

- `apps/pos/test/closed-orders.test.tsx:891–896`, */pos/closed-order is the bare device
  frame and no copy, and keeps the order in its query*. It pins the placeholder this task
  replaces, and it visits `?order=table-1` with an empty book. Change it to assert what
  that address now draws: the `error` composition of item 2's ruling.

A test of POS-05's row for a cash sale with change keeps its result where the only tender
is cash; add the mixed case beside it rather than editing it. Every other existing test
must pass unmodified, including the row hrefs (`closed-orders.test.tsx:86`) and the three
source scans (`no-invented-values.test.ts`, `console-free.test.ts`,
`hover-scoped.test.ts`). If any other test needs changing, stop and ask.

## Acceptance criteria

1. **Every state draws what the artifact draws.** A table-driven test over the fourteen
   states checks the header (name, tag), the note, the notices, the charged lines, the
   payment rows, the totals rows and the actions. Red if a state is missing or draws
   another state's order.
2. **A fixture row shows its own order.** Following each of POS-05's six rows shows the
   order, time, tenders and total that row showed. Red if the detail reads a second copy
   of the fixtures, or a row opens Table 1.
3. **A live close is shown from the book.** Close a table through the real route (as
   FE-030's criterion 2 does), open *Closed orders*, follow its row: the detail shows that
   order's name, the WIB time of its `closedAt`, its own lines with modifiers, its tenders
   and its stored totals. Red if any figure comes from a fixture.
4. **An unknown book id is an error, not a fixture.** `/pos/closed-order?order=table-1`
   on a fresh load draws *Could not load this order*, no line and no money. Red if any
   order is drawn.
5. **Voided lines are not charged.** A book order closed with a voided line lists and
   counts only the others. Red if the voided line appears.
6. **The cash contribution is tendered less change.** For a book order that took a card
   and then cash with change, both this screen and POS-05's row show the cash tendered
   less the change, not the order total. For the `cash` fixture both still read 155.925.
   Red if either shows the order total in the mixed case.
7. **No discount row without a discount.** `quick` and a book order with no discount draw
   three totals rows. `zero` draws *Comp 100%* at −165.000 and a total of 0.
8. **Stored figures.** A reprint result changes no figure: every reprint state's totals
   and payment equal `default`'s (AC-13).
9. **Reprint.** Pressing *Reprint receipt* shows *Reprint sent* with no time, in
   `default`, `zero`, `refunded`, `dayclosed` and on a book order, and the screen's other
   notices stay. The two failures carry the receipt class and a client-side link to
   `/pos/incidents`. Red if a time is invented or a failure uses the kitchen class.
10. **No refund, no void.** No state draws a Refund or a void control, hidden or
    otherwise, and the three unavailable notes read as the artifact has them.
11. **Leaving keeps the context.** `← Closed orders` returns to the plain list, and to
    `?state=dayclosed` from a closed-day order and from the new-day order reached with
    `list=dayclosed`. Every link is `pushState` with the document untouched; a modified
    click is left to the browser.
12. **Touch at 1280×800.** In `overflow` the left column scrolls and the summary, the
    totals and *Reprint receipt* stay where they are. State how you measured, or that you
    could not; the lead walks it in a browser before closing the task.
13. `npm run verify` is green, with the test and file counts stated (the baseline on
    `development` at `ff28d23` is 33 files and 2340 tests), and only the test named above
    changed.

## Out of scope

- The refund: the M-5 allocation sheet, the reason, the M-1 approval, REFUNDED in the
  book, `refund-error`, `day-refusal` and the Refund control itself (FE-032).
- The floor's after-close states, the open quick-sale strip and the line counts (FE-033).
- Release, the actor session, and clearing the closed-day banner (FR-A).
- A print job, an incident raised by a reprint, a server, an API, or any business-day
  arithmetic on the real date.

## Reporting

Commit on `agent/fe-031` only after verify is green, and never push. Append a Handoff
below: what you built and where, every decision you made and on what evidence, each test
you changed and why, the red cases you ran (mutation, failure, revert), what you found and
did not fix, the real verify output, and anything FE-032 needs (where the Refund control
goes, what the screen already knows about refundability, how a book order would become
REFUNDED). Last line: DONE, or BLOCKED: <question>.

Then run `herdr agent prompt lead "<your name>: FE-031 done — <tests> tests, <one line>"`,
or `herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

**What I built.** POS-06 now replaces the placeholder at `/pos/closed-order`, read-only, with the fourteen states the task names. Four new or changed source areas, all under `apps/pos/src`:

- `closedOrderDetail.ts` (new): the model. It reads the URL (`detailRequestFrom`), builds a `ClosedDetail` for a fixture address (`fixtureDetail`) or for a book address (`bookDetail`), holds the artifact's copy and the four reprint results, and `moneyReturned` for the REFUNDED group.
- `ClosedOrderScreen.tsx` (new): the screen, with the header, the left scroll column (note, notices, charged lines, original payment, money returned), the pinned summary (*What was charged*) and the actions.
- `closedOrders.ts`: `FIXTURE_ORDERS` and `FixtureOrder` are exported rather than copied, so the list and the detail read one set of six orders. New exports: `cashContribution`, `CASH_TENDER`, and `bookOrderName` (the row's naming, lifted out so the detail names a book order the same way). POS-05's row now writes its *contribution* through the helper.
- `PosRoutes.tsx` renders the screen and the placeholder is gone; `OrderPanel.tsx` exports `modifierText` (one word changed) so a line's modifiers are worded exactly as the panel words them; `pos.css` gains the `closed-body`, `closed-line`, `closed-summary` and related classes on registry tokens only (the `no-invented-values` scan passes, and the summary is `--frost-order-panel-width`).

**Decisions, and on what evidence.**

1. *Which tender is cash.* Settlement keeps a tender's label as `methodLabel(method)`, which is `'Cash'` or `'Card'` (`SettlementScreen.tsx:105`), and change is only ever taken against cash (`tender.ts`, `closeOrder`). So the helper counts tenders whose label is exactly `Cash`, sums them and subtracts the change: 200.000 − 44.075 = 155.925 for the fixture, and for a card of 1 plus cash of 9.999.999 on a 155.925 order it is 155.924, not the total. `cashContribution` returns `Money` (`bigint`) and is used in POS-05's row, in the detail's *Cash contribution* row and nowhere else. The artifact's *Money returned* takes the change off the last tender only if it is Cash; I take it off the last Cash tender, which agrees for all six fixtures.
2. *URL scheme.* An `order` with no `state` is a book id; anything with a `state` is the artifact's scheme (closed.js:90–95). No `state` and no `order` reads as the artifact's `default` (Table 1). A `state` this slice does not build (the thirteen of FE-032, or nonsense) reads as `default`, and `overflow` with no `order` picks the long order. `time` is shown only if it is `HH:MM`; anything else falls back to the order's own time rather than printing the query text.
3. *Book orders.* Drawn from the book alone. A book order that is still open, or an id the book does not hold, is the `error` composition; no fixture stands in. *Retry* on a book address re-renders and so re-reads the book; on a fixture address it shows `default`. A book order is in Business day 25 Sep, the floor fixture's open day; no date arithmetic. A book order's total of 0 reads as a zero-total order (*No payment taken · fully discounted*, and the zero reason in the actions).
4. *Stored figures.* A book order's totals are its `order.totals` (subtotal, the stored discount's own label and negative amount, the service charge, total), with no tax row; the discount row is absent when the order carries none. I did not reuse `TotalsView`, because it draws the tax line the artifact has no place for here. For fixtures the discount and service figures are the artifact's (closed.js:96–97) and the total is the fixture's own `total` (the long order's is the artifact's 1.559.250); a test checks every fixture's last row equals its `total`.
5. *Voided lines.* Filtered out of the list and the count. The heading says *1 line* for one (the artifact only ever draws "2 lines" and "20 lines"; I pluralised rather than print "1 lines").
6. *Notices.* The closed-day notice and the failures use the amber `closed-notice`; REFUNDED, *Reprint sent* and *PRINTED* use a plain variant (`closed-notice--plain`, the artifact's neutral `co-notice`). The reprint result is one slot: pressing *Reprint receipt* sets it to *Reprint sent*, replacing a failure or an earlier result, and the closed-day and REFUNDED notices are derived from the order, so they stay. Nothing is written, no incident is created and the history length does not change.
7. *Dev nav.* Like POS-05, the screen draws the fixture-states link row under `import.meta.env.DEV`, outside `.closed-order`.

**Existing tests changed: one.** `apps/pos/test/closed-orders.test.tsx`, the test that pinned the bare-frame placeholder (*/pos/closed-order is the bare device frame and no copy…*). It visited `?order=table-1` with an empty book; it now asserts the `error` composition, no line, and that the query is kept. Nothing else in that file or any other existing test was touched. The mixed-tender case for POS-05's row is in the new file (`closed-order.test.tsx`, criterion 6), beside a test that the cash fixture still reads 155.925 on both screens, rather than editing the existing cash row test.

**Red cases run (mutation, failure, revert).**
1. `cashContribution` without `- change`: 17 failures across both files (the `cash` state, the cash fixture on the row and the detail, the helper, the mixed case). Reverted.
2. The original FE-030 defect, the book row writing the order total: exactly one failure, the mixed card-then-cash test (*contribution 173.249* expected, *173.250* received), which is the case the fixture cannot reach. Reverted.
3. Voided-line filter removed: the voided-line test fails (*3 lines*, Cheesecake listed). Reverted.
4. `bookDetail` falling back to Table 1's fixture for an unknown id: four failures (criterion 4 three times, and the changed placeholder test). Reverted.
5. The *Receipt reprint FAILED* notice drawn plain instead of amber: the receipt-class test fails. Reverted.

**What I found and did not fix.**
- Table 1 and the menu's Burger seed to the same two modifiers and 135.000 as the artifact's fixture line, so a live close of Table 1 shows lines that look like the fixture's. The Table 1 test therefore compares the detail with what the order panel showed at the settle, and the live-close test that proves "no figure from a fixture" is a quick sale of a Steak, whose line and total (240.000 plus service) no fixture has.
- A fresh load of a book address is an error by the lead's own ruling; the lead may want the floor's *Closed orders* back link to remain the way out. It does: *← Closed orders* is drawn in the error picture too.
- `modifierText` is now exported from a `.tsx` component module and imported by a screen; if the lead prefers it in a plain module, it moves without changing behaviour.

**Not measured.** No browser is available to this session, so criterion 12 is a structural check only: in `overflow` the left column is the `closed-scroll` region (`overflow-y: auto`, `min-height: 0`, focusable), the summary is its sibling, `flex: none`, with no overflow of its own, and no `z-index` or sticky rule exists in the scrolling column. The lead must walk it at 1280×800.

**What FE-032 needs.** The Refund control belongs in `.closed-actions` in `ClosedOrderScreen.tsx`, after *Reprint receipt* as in the artifact. `Body` already derives the three reasons from `detail.zero`, `detail.refunded` and `detail.closedDay`; a refund is offered exactly when none of them holds, so that same `why` gate is the refundability gate. A book order never reads as REFUNDED: `bookDetail` sets `refunded: false` because the book has no such field. To make one REFUNDED, the book entry needs a `refunded` fact (and the approver and reason the notice draws, which are now fixture copy in `noticesFor`), read by `bookDetail`; `moneyReturned` already produces the *Money returned · full order* rows from the stored tenders and change. The refund's thirteen states (`sheet-*`, `approval*`, `refund-error*`, `day-refusal`) still read as `default` here (`detailRequestFrom`). *Reprint sent* and the other results are a single `result` slot in the screen; a refund notice would be a second, independent notice.

**`npm run verify`** (typecheck, then `vitest run`): 34 test files, 2411 tests, all passed. The baseline at `ff28d23` was 33 files and 2340 tests: the new `closed-order.test.tsx` is 61 tests, and the other 10 are, I infer from the per-file scans in `no-invented-values.test.ts` (four checks per source file) and the other two scans, the per-file checks for the two new source files (`closedOrderDetail.ts`, `ClosedOrderScreen.tsx`); I did not itemise them. The `console-free` and `hover-scoped` scans pass. I ran no formatter.

DONE
