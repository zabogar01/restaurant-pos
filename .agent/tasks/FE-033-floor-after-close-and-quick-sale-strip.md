---
id: FE-033
title: POS-02 floor — the two after-close states, the open quick-sale strip, lines instead of items, and the closed-day header
category: ui
touches: []
depends_on: []
owns: [apps/pos/src/**, apps/pos/test/**]
status: complete
cycles: 0
---
# FE-033 — POS-02 floor: after Close, the open quick sale, and lines

**Status:** Written 2026-10-02 by `lead`. This is **F4e-4**, the last of the four slices that
build DESIGN-009. It touches no money, audit or identity rule: it draws figures the order book
already derives and changes no operation.
**Source:** DESIGN-009, complete and merged. The artifact is
`docs/design/visual-directions/frost/pos/floor.html` (eleven states, `:7`) and, for the order
panel's count, `order.html:159–168`. DESIGN-009's task file holds the rulings; where its round 1
and round 2 disagree, round 2 is current. One ruling there is **not** drawn in the artifact and
still binds: the closed-day header (Part 2 below).

## Objective

Today the floor (FE-026) draws nine states. It counts a table's *items* in units while the order
panel counts *items* in lines, an open quick sale can be reached only from inside itself, and
the closed-day floor's header names the day that closed. When this task is done the floor draws
the artifact's eleven states; the floor and the order panel both count **lines**; every open
quick sale that holds a line has a *Resume* control on the floor; and the closed-day floor's
header names the business day that is open. Close itself does not change: it still lands on the
plain floor, and the book still frees the table.

## Required inputs

1. **The artifact**, `docs/design/visual-directions/frost/pos/floor.html`: the eleven states
   and their labels (`:7`), the header (`:48`), the closed-day banner (`:49`), the receipt chip
   and the two states that show it (`:50`), the five count lines (`:51`), the open quick-sale
   strip and the six states that show it (`:52`), the mixed grid (`:56–69`) and the after-close
   grid (`:70–83`). The strip's padding is an inline style there; in the build it is a class.
2. **`order.html:159–168`**: the panel's count in every state, now *N lines*, *1 line · not yet
   sent*, and *Empty*.
3. **DESIGN-009's task file**, `.agent/tasks/DESIGN-009-closed-orders-and-refund.md`:
   Part C (`:177–194`) and Part D questions 1 to 3 (`:196–206`); the designer's answers to
   them (`:499–512`); round 2's lead ruling 2 (`:318–322`) and how it was drawn (`:750–776`);
   and the rulings on round 2's questions 1 and 3 (`:345–353`).
4. **The code this builds on**, all in `apps/pos/src`:
   - `FloorScreen.tsx` (FE-026, FE-027): `statusOf` (`:40–48`), `tileFor` and the rule that a
     tile reads the book before its fixture (`:69–98`), `fixtureOrder` (`:110–115`), the header
     (`:154–161`), the chip (`:168–176`), the toolbar's two doors (`:182–193`), `go` and `enter`
     (`:132–143`).
   - `floorFixtures.ts`: `FloorState`, `FLOOR_STATES`, `FLOOR_FIXTURES`, `FLOOR_COPY`.
   - `orderFixtures.ts`: `orderCountLabel` (`:164–167`), `orderVariant` (`:151–153`), the
     `quick` fixture (order id `quick-1`, `:855`) and `quick-new` (`:960`).
   - `orderStore.ts`: the book. `orders()` reports every order with its status
     (`:469–476`); `openFixture` (`:443–449`) and `newQuickSale` (`:460–465`) are the two
     openers a quick sale has today. There is no opener for a quick sale by id; this task adds
     one.
   - `OrderPanel.tsx:395` and `:453`: the panel's count, already of non-voided lines.
   - `SettlementScreen.tsx:686–696`, `closeNow`: read it, do not change it.
   - `pos.css`: the floor's rules from `.floor-tools` (`:2276`) to `.floor-warning` (`:2374`).
5. **The contract:** FR-D1, FR-D2 (`docs/PRD.md:148–150`), FR-E5 (`:179`), FR-G7 and FR-G8
   (`:219–221`), FR-I1 (`:296`); B-15 (`docs/BOUNDARIES.md:99`); ruling I-4
   (`docs/design/SCREEN-INVENTORY.md:106`, `:987`).

## What to build

### Part 1 — lines, on the floor and on the panel (Part D, questions 2 and 3)

The convention is **lines**: an order's lines that are not voided. Quantities stay on each line.

- **The floor tile.** `statusOf` keeps *N rounds fired* and *N lines pending* exactly as they
  are. Where it reads *N items* today (fired rounds, nothing pending) it reads *1 line* or
  *N lines*, counting non-voided lines across every group. Table 9 reads
  `1 round fired · 2 lines`; today it reads `5 items`, counting three Coffees and two Sodas.
- **The order panel.** `orderCountLabel` reads `1 line` or `N lines`, and a quick sale keeps
  its suffix: `2 lines · not yet sent`. `Empty` is unchanged. The number itself does not
  change: the panel already counts non-voided lines.
- **One count.** The number on the tile, on the panel and on the strip (Part 4) comes from one
  exported function over an order's groups. The rule that an order holding no line at all is a
  free table (`lineCount`, `FloorScreen.tsx:50`, which counts voided lines too) is a different
  question and is not changed.

Copy that says *items* and is **not** this count stays as it is: the empty panel's *No items
yet*, the print incidents' ticket descriptions (*2 items*, *5 items*), and settlement's *Cannot
close — 2 items have not been sent to the kitchen*.

### Part 2 — the closed-day header (lead ruling of 2026-09-30, not drawn)

In `dayclosed` the header's line reads `Business day open · 26 Sep`, above the banner, which
is unchanged (*Business day closed at 23:14* and its sentence). The artifact still draws
*Business day closed · 25 Sep* there (`floor.html:48`): the ruling
(`DESIGN-009-closed-orders-and-refund.md:352–353`) wins, and it matches POS-05, whose closed-day
list already names 26 Sep as the open day. Every other state keeps *Business day open · 25 Sep*.
Do not edit the artifact; the lead takes the mismatch to the designer.

### Part 3 — `after-close` and `after-close-receipt` (Part C)

Two fixture states, after `receipt-warning`, in the artifact's order and with its labels:
*After Close · Table 1 free* and *After Close · receipt warning*.

- `after-close` is the mixed floor with Table 1 free: its tile reads *Free* and *Open table
  order* and opens a new, empty Table 1 order, as any free tile does. Tables 7, 9 and 12 are
  as in `default`. The count is derived, as it is today, and comes to `3 open · 9 free`. The
  open quick-sale strip is drawn (Part 4).
- `after-close-receipt` is the same floor with the existing receipt chip, *Receipt printer:
  1 unprinted receipt* and *View receipts*, which goes to `/pos/incidents` as it does in
  `receipt-warning`.

**What drives them (lead ruling, on a stated premise).** The 2026-09-30 ruling is that the two
states are the two outcomes of the one Close: the floor shows the chip when the close result or
the floor read reports an unprinted receipt. **Premise: this client has no printer and no print
job, so no close made here can report an unprinted receipt.** Therefore:

- a live Close keeps landing on the plain `/pos/floor`, by `replaceState`, exactly as today,
  and the floor it lands on draws no receipt chip. `closeNow` is not changed;
- the table that closed is free because the **book** says so (FE-027), on whatever floor state
  is shown. That is the live `after-close`, and criterion 4 checks that it draws what the
  fixture draws;
- `after-close-receipt` is reached by its fixture address only. The chip keeps reading the one
  fixture fact it reads today (`receiptWarning`), which is where a server's floor read will
  later put the real one. Do not invent a failed print for a live close, and do not add a
  settlement state for one.

If you find that the premise is false (something in the client can report a print result), stop
and raise it.

### Part 4 — the open quick-sale strip (Part D, question 1)

Between the toolbar and the grid, a strip: the label `Open quick sale`, then one control per
open quick sale, each an anchor reading

`Quick sale · <N lines> · <total> · Resume`

with the count of Part 1 (`1 line`, `2 lines`) and the order's total through `formatAmount`.
The artifact's fixture control reads `Quick sale · 2 lines · 173.250 · Resume`.

**Its own element.** The artifact reuses `.floor-tools` with an inline padding. In the build
the strip has its own class, with the artifact's padding and the same row layout declared in
`pos.css` from tokens, so that the toolbar's `.floor-tools` still holds exactly its two doors.
Each control is a `.floor-action` anchor and carries the order's id in a data attribute.

**Which sales are listed.** The strip follows the tiles' rule: the book is read before the
fixture.

1. *The fixture's sale.* Six states draw the artifact's open quick sale: `default`, `incident`,
   `receipt-warning`, `overflow`, `after-close`, `after-close-receipt`. It is the `quick`
   fixture's order, id `quick-1`. Its count and total are **derived** from that fixture's order
   (as `fixtureOrder` does for a tile), never typed on the floor fixture. The other five states
   (`clear`, `dayclosed`, `empty`, `loading`, `error`) do not draw it.
2. *The book decides once it holds `quick-1`.* If the book holds that order, the fixture's
   control is replaced by what the book says: listed with the book's count and total while the
   order is open and holds a line, and not listed once it is closed, refunded or emptied. This
   is FE-027's rule for a table, applied to the quick sale.
3. *Every other open quick sale in the book* that holds at least one line is listed too, after
   the fixture's, in the order the book holds them, on every state that has read the floor. An
   open quick sale with no line is not listed: there is nothing to resume, as a table holding
   no line is free. Read whether an order is a quick sale from its type (`orderVariant`), not
   from its id.
4. *`loading` and `error` draw no strip*, whatever the book holds: nothing has been read.
   `empty` (no tables configured) does list the book's sales; a quick sale works without
   tables.
5. *With nothing to list, nothing is drawn*: no label, no empty container.

**What Resume does.** It makes that order the active one and goes to the order screen, client
side, exactly as a tile does (`go`): a plain click opens and pushes; a modified click is left to
the browser and opens nothing. The fixture's sale goes to `/pos/order?state=quick` (through
`openFixture('quick')`). A sale made with *New quick sale* goes to
`/pos/order?state=quick-new`, the address it had when the cashier left it, and needs a new
opener on the book that makes an existing order active by its id without reseeding it.

**A payment in progress (where FE-026's rule 5 meets the strip).** A quick sale whose payment
session holds drafts is still an open order, so it stays listed, with the same words. The
artifact draws no *Payment in progress* form of the control: do not invent one. Resume opens the
order locked, as its tile-less session already leaves it. Name this in the Handoff as a design
question.

**Several sales.** The artifact draws one control and sets no limit. The strip wraps, so that no
control leaves the 1280-wide frame. Two sales with the same lines and total read the same; that
is a design question for the Handoff, not something to solve here.

## Constraints

- **No operation changes.** `close.ts`, `tender.ts`, `refund.ts`, `refundDraft.ts`, `fire.ts`
  and `SettlementScreen.tsx` are not edited. Close's destination, its `replaceState` and its
  refusals stay as they are (B-15, FR-G8: a print result never gates or redirects a close).
- **Money is `Money` (`bigint`)** end to end, shown through `formatAmount`. Never call
  `Number()` on money. No `Rp`. A total on the strip is the order's own (`orderTotals`), never
  a figure typed for the floor.
- **FR-D1 holds as built.** A free Table 1 in the two new states opens a new order through the
  same path as every free tile; do not special-case it.
- **Release is not drawn**, and the closed-day banner does not clear: both wait for FR-A.
- **Styles come from the Frost registry.** No literal colour, length, weight or size, and every
  `:hover` rule inside `@media (hover: hover)`; `no-invented-values.test.ts` and
  `hover-scoped.test.ts` enforce both.
- Use `<a>` for going and `<button>` for acting. Do not run Prettier. Do not edit anything
  under `docs/`.

## Tests expected to change

Only the expected **word or list** changes in each; no assertion is removed or loosened.

- `apps/pos/test/floor.test.tsx`
  - `:57–70`, the `MIXED` table: Table 9's status becomes `1 round fired · 2 lines`. `MIXED`
    feeds `default`, `incident`, `receipt-warning` and `overflow`.
  - `:81–99`, `CLOSED` and the `TABLE` of states: `dayclosed`'s header becomes
    `Business day open · 26 Sep`, and `TABLE` gains `after-close` and `after-close-receipt`,
    which the two key-order assertions at `:103–104` read. The titles that say *nine*
    (`:54`, `:101`, `:102`) say eleven.
  - `:215`, Table 12's panel count: `3 items` becomes `3 lines`.
- `apps/pos/test/order-panel.test.tsx:306` and `:394`: `2 items`, `9 items` become lines.
- `apps/pos/test/fire.test.tsx:330`, `:580` and `:804`: `8 items`, `2 items`, `3 items`
  become lines.
- `apps/pos/test/quick-sale.test.tsx:53–57` (`orderCountLabel`, four assertions),
  `:115–119` and `:272–277` (the title and the assertions of each): *item(s)* becomes
  *line(s)*, with ` · not yet sent` kept.

These must pass **unmodified**: the per-state assertion that the toolbar's `.floor-tools`
anchors are exactly *Closed orders* and *New quick sale* (`floor.test.tsx:121`); `close.test.tsx`
entire; `incidents.test.tsx:49` and `:52` (*2 items*, *5 items*); `settlement.test.tsx:800`;
`closed-orders.test.tsx:724–733`; and the three source scans. New behaviour gets new tests
beside the old ones. If any other test needs changing, stop and ask.

## Acceptance criteria

1. **Eleven states, as the artifact draws them.** The table-driven test covers all eleven in
   the artifact's order. `after-close` and `after-close-receipt` draw Table 1 free, Tables 7, 9
   and 12 as in `default`, and `3 open · 9 free`; `after-close-receipt` also draws the chip and
   *View receipts*, which goes to `/pos/incidents` client side. Red if either state is missing,
   resolves to `default` (Table 1 open, `4 open · 8 free`), or `after-close` draws the chip.
2. **A live Close is not redirected and reports no print.** After a real Close the address is
   exactly `/pos/floor` with no query, reached by `replaceState`, and no receipt chip is drawn.
   Red if a close lands on a `?state=` address or draws the chip (the premise of Part 3).
3. **`closeNow` is untouched.** `git diff` shows no change to `SettlementScreen.tsx`,
   `close.ts`, `tender.ts`, `refund.ts`, `refundDraft.ts` or `fire.ts`.
4. **The live after-close floor is the fixture's.** Close Table 1 through the real route (its
   pending Steak removed or sent first, then Settle, a tender for the balance, Close). The
   floor then draws, tile for tile and in its count and strip, what a fresh load of
   `/pos/floor?state=after-close` draws. Red if the two differ, which is what a figure typed
   onto the new fixture would cause.
5. **Lines on the tile.** Table 9 reads `1 round fired · 2 lines`. A unit test of the status
   line gives it a fired order with one line (`1 line`) and one with a voided line (not
   counted). *N lines pending* is unchanged, and Tables 1 and 12 read as before. Red if units
   are counted (Table 9 would read 5) or a voided line is.
6. **Lines on the panel.** `orderCountLabel` gives `1 line`, `2 lines`, `1 line · not yet sent`
   and `2 lines · not yet sent`; an empty order still reads `Empty`. No state's number changes,
   only its word.
7. **One count.** The tile, the panel and the strip call one exported function for the number
   of non-voided lines; a unit test pins it with a voided line. The free-table rule still reads
   every line. Red if the panel or the strip keeps its own count.
8. **The closed-day header.** `dayclosed` reads `Business day open · 26 Sep` in the header and
   still draws the banner's two sentences; the other ten states read
   `Business day open · 25 Sep`. Red if `dayclosed` still says *closed · 25 Sep* in the header.
9. **The fixture's strip.** On a fresh load, the six states of Part 4 rule 1 draw the label and
   one control reading `Quick sale · 2 lines · 173.250 · Resume` with the href
   `/pos/order?state=quick`. The other five draw no strip and no label.
10. **Resume opens that order.** Pressing it shows *Order · counter*, `2 lines · not yet sent`
    and a total of 173.250, by `pushState` with the document untouched. A modified click is left
    to the browser and makes nothing active.
11. **The strip reads the book.** Resume the fixture's sale, remove the Burger, go back to the
    floor: the control reads `Quick sale · 1 line · 31.500 · Resume`. Remove the Soda too: the
    sale is no longer listed. Red if the control keeps the fixture's figures, which is the case
    a typed figure produces.
12. **A new sale is its own.** *New quick sale*, add a Burger, back to the floor: `default`
    lists two controls, the fixture's first. The new one goes to `/pos/order?state=quick-new`
    and shows its own one line, not the fixture's two. A new sale left empty is not listed. On
    `clear`, where no fixture sale is drawn, the new sale is the only control.
13. **A closed sale leaves the strip.** Close a new quick sale through the real route: it is
    no longer listed, and POS-05 lists it (FE-030). Then resume the **fixture's** sale and
    close it: `default` no longer draws its control, although the state's fixture does. Red if
    a closed sale can still be resumed.
14. **A sale being paid stays listed, in the same words.** Begin a payment on a quick sale,
    return to the floor: its control is there and reads as before, with no *Payment in
    progress* copy; Resume opens it with the panel locked. Red if it disappears or if copy the
    artifact does not have is drawn.
15. **Nothing read, nothing listed.** With a new sale holding a line in the book, `loading` and
    `error` draw no strip; `empty`, `clear` and `dayclosed` list it.
16. **The two doors are where they were.** In all eleven states the toolbar's `.floor-tools`
    holds exactly *Closed orders* and *New quick sale*, and the existing assertion passes
    unmodified. From the two new states *Closed orders* goes to the plain `/pos/closed-orders`;
    only `dayclosed` hands POS-05 its context.
17. **Touch at 1280×800.** The strip takes its row and nothing leaves the frame; in `overflow`
    the grid still scrolls under it; with enough sales to fill the row the controls wrap inside
    the frame. State how you measured, or that you could not: the lead walks it in a browser
    before closing the task.
18. `npm run verify` is green, with the test and file counts stated (the baseline on
    `development` at `0fab43c` is 36 files and 2515 tests), and only the tests named above
    changed.

## Out of scope

- Release, the actor session, and clearing the closed-day banner (FR-A).
- A printer, a print job, an incident raised by a close, a server or an API.
- A *Payment in progress* form of the strip's control, and any way to tell two equal sales
  apart: design questions, reported, not built.
- The incidents screen's *Nothing outstanding* drawn twice, and the three other known small
  defects (a reopened book-only order's address; `closeOrder` firing a quick sale as a table;
  the silent refusal of a quick sale holding an 86'd line). They have their own slice.
- `closeOrder` accepting a non-cash tender above the balance (B-5): its own task.
- Any edit under `docs/`, the artifact's `dayclosed` header included.

## Reporting

Commit on `agent/fe-033` only after verify is green, and never push. Append a Handoff below:
what you built and where, every decision you made and on what evidence, each test you changed
and why, the red cases you ran (mutation, failure, revert), what you found and did not fix, the
real verify output, and the design questions Part 4 names. Last line: DONE, or
BLOCKED: <question>.

Then run `herdr agent prompt lead "<your name>: FE-033 done — <tests> tests, <one line>"`,
or `herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Lead verify (2026-10-02)

The lead ran `npm run verify` in this worktree at `16310c6` (37 files, 2537 tests, green; the
baseline on `development` at `0fab43c` is 36 files and 2515 tests) and walked the floor in
Chrome against the dev server, at the device's 1280×800. No defect was found, and nothing goes
back to the builder.

- **The diff** stays inside `owns:`. The four existing test files changed are the four the task
  names, and each change is the expected word or list only. `SettlementScreen.tsx`, `close.ts`,
  `tender.ts`, `refund.ts`, `refundDraft.ts` and `fire.ts` have no diff, and nothing under
  `docs/` changed. The task file changed only below `## Handoff`.
- **The two new states.** `after-close` draws Table 1 free, `3 open · 9 free`, the strip and no
  chip; `after-close-receipt` adds *Receipt printer: 1 unprinted receipt* and *View receipts*.
- **A live Close.** Table 1, with its pending Steak removed, was settled by Card and closed. The
  address afterwards was `/pos/floor` with no query, the history length did not grow on Close,
  no chip was drawn, and the twelve tiles, the count and the strip read exactly as
  `?state=after-close` reads on a fresh load.
- **Lines.** Table 9's tile reads *1 round fired · 2 lines*; Table 1's panel read *3 lines*;
  the quick sale's read *2 lines · not yet sent* and *1 line · not yet sent*.
- **The closed-day header** reads *Business day open · 26 Sep* above the unchanged banner.
- **The strip.** Resume on the fixture's sale opened *Order · counter* at 173.250; with the
  Burger removed the control read *Quick sale · 1 line · 31.500 · Resume*. Four new sales each
  got their own control after it, and each resumed to its own order at `state=quick-new`. A sale
  with a payment begun stayed listed in the same words and resumed locked. Closing it took it
  off the strip and put it on POS-05's list.
- **Criterion 17, measured.** The device stays 1280×800 in every state walked. One control: the
  strip is one 60px row and the grid starts under it. Five controls wrap to two rows (the
  rightmost control ends at 1016px), nothing leaves the frame and the grid keeps the rest. In
  `overflow` the grid scrolls under the strip (content 952px in 564px) and Table 24 ends at
  780px. In `dayclosed` with two strip rows the grid still scrolls inside the frame.
- **Nothing read, nothing listed.** With five sales in the book, `loading` and `error` drew no
  strip; `empty`, `clear` and `dayclosed` drew all five.
- The browser console showed no error during the walk.

**Lead ruling on the builder's judgement call: accepted.** A `quick-1` the book holds, open and
with a line, is listed on `clear`, `dayclosed` and `empty` too. Part 4's rule 2 says the book
decides once it holds that order, and a table the book holds open is drawn on `clear` in the
same way (FE-026). Rule 1's five states only say where the *fixture* draws nothing.

**One reading the lead accepts, for the reviewer to weigh.** A sale counts as holding a line by
`countLines`, which leaves voided lines out, where a table's free rule (`lineCount`) counts them.
A quick sale's lines are pending until close (FR-E5) and a pending line is removed, not voided,
so the two cannot differ today.

Not walked: a modified click on Resume, and a voided line in the count. Both rest on the
builder's tests.

## Handoff

**What I built.**
- `apps/pos/src/orderFixtures.ts`: new exported `countLines(groups)`, the one count of non-voided lines. `orderCountLabel` now says `1 line` / `N lines`, keeping ` · not yet sent` for a quick sale.
- `apps/pos/src/OrderPanel.tsx` reads `countLines` instead of its own filter. `FloorScreen.tsx`'s `statusOf` reads it too, and its strip reads it through `countLines(order.groups)`, so tile, panel and strip share one function. The free-table rule (`lineCount`, which counts voided lines) is untouched.
- `apps/pos/src/floorFixtures.ts`: states `after-close` and `after-close-receipt` after `receipt-warning`, with the artifact's labels. Both use a mixed floor with Table 1 as a free tile. A new `quickSale` flag marks the six states that draw the fixture's strip. No figure is typed on the floor fixture. `dayClosed` copy is now `Business day open · 26 Sep` (ruling of 2026-09-30). New copy: `openQuickSale`, `quickSale`, `resume`.
- `apps/pos/src/orderStore.ts`: new opener `book.openOrder(id)`, which makes an order the book already holds active without reseeding it, and ignores an unknown id.
- `apps/pos/src/FloorScreen.tsx`: `quickSalesOf(fixture, book)` and the strip (`.floor-quick`, a label plus one `.floor-action` anchor per sale, each with `data-order-id`). `loading` and `error` return nothing.
- `apps/pos/src/pos.css`: `.floor-quick`, wrapping flex row with the artifact's padding, tokens only. `.floor-tools` is unchanged.
- Tests: new `apps/pos/test/floor-quick-sale.test.tsx` (20 tests). Word and list changes only in the tests named in the task.

No file the task forbids was touched: `SettlementScreen.tsx`, `close.ts`, `tender.ts`, `refund.ts`, `refundDraft.ts` and `fire.ts` have no diff. Nothing under `docs/` changed.

**Decisions.**
- Premise of Part 3 holds: I found no print job or print result anywhere the client can produce one, so a live Close needs no change. The new test pins that a real close lands on exactly `/pos/floor` with no query and no chip, and that the live floor's tile grid, count and strip HTML equals a fresh load of `?state=after-close`.
- The strip's order: the fixture's sale first, then every other open quick sale that holds a line, in book order. The fixture's sale, once the book holds `quick-1`, is decided by the book alone (open and holding a line, else not listed).
- **Judgement call:** if the book holds `quick-1`, open and with lines, and the state is one that draws no fixture sale (`clear`, `dayclosed`, `empty`), I still list it, because rule 3 says every open quick sale in the book appears on every state that has read the floor, and hiding a real open sale would strand it. The task text could be read the other way; the lead may rule.
- Resume for `quick-1` goes through `openFixture('quick')` to `/pos/order?state=quick`. Every other sale uses `openOrder(id)` to `/pos/order?state=quick-new`.
- The after-close floor on a live close is the `default` floor state (as FE-027 already does for the post-close landing), and the book frees Table 1, which is why the criterion-4 comparison with the fixture holds.

**Tests I changed, and why.** Only expected words or lists: `floor.test.tsx` (Table 9 `1 round fired · 2 lines`; `dayclosed` header; `TABLE` gained the two states; "nine" titles say eleven; `3 items` to `3 lines`), `order-panel.test.tsx:306,394`, `fire.test.tsx:330,580,804`, `quick-sale.test.tsx` (four `orderCountLabel` assertions, the two other tests and their titles). No assertion was removed or loosened. The toolbar assertion (`.floor-tools` holds exactly two doors), `close.test.tsx`, `incidents.test.tsx`, `settlement.test.tsx`, `closed-orders.test.tsx` and the three source scans pass unmodified.

**Red cases run.** (1) Making `quickSalesOf` ignore a book that holds `quick-1`: two tests failed (the control kept `2 lines · 173.250` instead of `1 line · 31.500`, and a closed fixture sale stayed listed). Reverted. (2) Making the tile count units: one new test and six floor-state tests failed (`1 round fired · 5 lines`). Reverted.

**Found and not fixed / design questions.**
- A quick sale whose payment has drafts is listed with the same words; the artifact draws no *Payment in progress* form, and none was invented. Resume opens it locked. Design question: should the control say a payment is in progress?
- Two sales with the same lines and total read identically on the strip, and nothing tells them apart. Design question.
- The artifact still draws `Business day closed · 25 Sep` in `dayclosed`'s header (`floor.html:48`); the build follows the ruling. The lead takes this to the designer.
- jsdom prints "Not implemented: navigation to another Document" during the run. I did not check whether it appears at baseline; it comes from clicking an anchor in tests and does not fail anything.

**Process note.** I ran one Python heredoc to edit `floorFixtures.ts` before registering the rule against heredocs; the result is an ordinary file edit. I did not run Prettier.

**Verify (real output).** `npm run verify`: typecheck clean; `Test Files 37 passed (37)`, `Tests 2537 passed (2537)`. Baseline was 36 files and 2515 tests, so +1 file and +22 tests (20 in the new file, plus two new floor-state rows in the table-driven test).

**Criterion 17 (touch at 1280×800).** Not measured: I had no browser. The strip is a wrapping flex row with the artifact's padding; the lead walks it. The `overflow` grid is `flex: 1; min-height: 0`, so it should still scroll under the strip.

**Next agent needs.** Browser walk of criterion 17; ruling on the `clear`/`empty`/`dayclosed` listing of a resumed `quick-1`.

DONE
