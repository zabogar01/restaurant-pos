---
id: FE-030
title: POS-05 closed orders — the list, its three touch filters and the closed-day grouping, read-only
category: ui
touches: []
depends_on: [DESIGN-010]
owns: [apps/pos/src/**, apps/pos/test/**]
status: active
cycles: 1
---
# FE-030 — POS-05 closed orders, read-only

**Status:** Written 2026-09-30 by `lead`. This is **F4e-1**, the first of the slices that
build POS-05 and POS-06 from DESIGN-009. It is read-only: nothing on this screen changes
an order.
**Source:** DESIGN-009, complete and merged, with DESIGN-010's token. The artifact is
`docs/design/visual-directions/frost/pos/closed-orders.html`, driven by `closed.js` and
styled by `closed.css` in the same folder. The DESIGN-009 task file's Handoff, and its
*Round 2* section especially, is the rationale; where round 1 and round 2 disagree, round 2
is current.

## Objective

Today `/pos/closed-orders` renders a placeholder: an empty device frame
(`PosRoutes.tsx:97`, `ClosedOrdersPlaceholder`). When this task is done it is POS-05 as the
artifact draws it: the orders closed in the open business day, newest first, each row
showing when it closed, which order it was, what payment was taken and its total; three
touch filters (table, closing time, exact amount) that apply at once; and every one of the
artifact's eleven states. The orders the cashier closed in this session, which the order
book already keeps (FE-027), are listed alongside the fixture's. Each row leads to POS-06,
which the next slice builds; for now that route is a placeholder.

## Required inputs

1. **The artifact**, `closed-orders.html` with `closed.js` (the `if(list){…}` branch,
   `:26–95`) and `closed.css`. Its eleven states, as `manifest.js:418–466` declares them:
   `default`, `empty`, `loading`, `error`, `overflow`, `nomatch`, `dayclosed`,
   `dayclosed-start`, `filter-table`, `filter-time`, `filter-amount`. Open it in a browser
   if you have one; if you do not, say so and do not look for one.
2. **DESIGN-009's task file**, `.agent/tasks/DESIGN-009-closed-orders-and-refund.md`:
   Part A rules A1 to A5 (`:76–95`); round 2 items 3 (F3, the closed-day grouping,
   `:778–798`), 5 (F7, immediate filtering, `:832–836`) and 6 (F8, `:838–860`); Part D
   answer 4 on the header (`:515–522`).
3. **DESIGN-010's task file and Handoff**, `.agent/tasks/DESIGN-010-closed-order-tokens-and-fixture.md`:
   the token `--frost-closed-list-columns` for the four columns.
4. **The code this builds on:**
   - `PosRoutes.tsx`: the route and the placeholder it replaces;
   - `orderStore.ts`: `OrderBook.orders()` (`:226`) returns every order the book holds,
     with `status`, and for a closed one `closedAt`, `tenders` and `change`;
   - `close.ts`: `ClosedOrder` and `Tender`; `closedAt` is an ISO timestamp,
     `new Date().toISOString()` at `SettlementScreen.tsx:693`;
   - `FloorScreen.tsx` and `floorFixtures.ts`: the header composition POS-05 shares, the
     *Closed orders* link (`FloorScreen.tsx:181`) and why Release is not drawn (`:29–30`);
   - `navigation.ts`: `followClientSide`, which every leaving anchor uses;
   - `Sheets.tsx`: the dialog pattern (focus onto the dialog, scrim, `aria-modal`).
5. **The contract:** `docs/PRD.md` FR-G11 (a zero-total order is a closed order), FR-H6
   (REFUNDED is distinct), section 9 *Restaurant time zone* (WIB, 24-hour `HH:MM`);
   `docs/design/SCREEN-INVENTORY.md` POS-05 (`:427–447`) and ruling I-1;
   `docs/BOUNDARIES.md` B-10.

## What to build

1. **The screen**, replacing `ClosedOrdersPlaceholder`, in the artifact's composition:
   - the header: `← Floor`, the `h1` *Closed orders*, the tag *DAY OPEN*, the actor and
     the idle figure, as the floor draws them. **Release is not drawn**, for the reason
     `FloorScreen.tsx:29–30` gives: it ends the actor's session, which is FR-A and not built;
   - the day line (*Business day open · 25 Sep*, the floor's own `dayOpen` copy), or in
     the two closed-day states the amber banner instead;
   - the toolbar: three filter buttons, each showing its current value (*Any* when unset),
     and *Reset*; there is **no Search button** (F7);
   - the column heads *Closed at*, *Order*, *Payment taken*, *Total*, and the list in a
     scroll region beneath them. The toolbar and heads stay put while the list scrolls.
2. **A row**, per the artifact's `row()` (`closed.js:35–38`):
   - *Closed at*: `HH:MM` in WIB;
   - *Order*: *Table n*, or *Quick sale* for a quick sale (A5), never *COUNTER*;
   - *Payment taken*: each tender as `<label> <amount>`, joined by ` · `. A cash sale with
     change adds a second line, *Change <change> · contribution <total>*. A zero-total
     order reads *Comp 100% · no payment taken* when its discount is the 100% comp, and
     *No payment taken* otherwise. A refunded order adds the *REFUNDED* tag (A2);
   - *Total*: the order total, bare IDR.

   No receipt number appears anywhere, as a column, a label or search key (ruling I-1).
   Each row is an anchor that leaves the screen, followed client-side.
3. **What is listed.**
   - The artifact's six fixture orders (`closed.js:12–19`), with its times, tenders and totals.
   - **Every order the book holds as closed, in `default`** (and so in any filter applied
     over it). Its row reads from the book: the table number from its id or *Quick sale*
     from its type, `closedAt` converted to WIB `HH:MM`, the book's tenders and change, and
     the order's total. Its status comes from the book's `status`, never from a fixture
     state name.
   - The other states are the artifact's pictures and list only its fixtures: `empty`
     lists nothing, `overflow` the artifact's 36 rows, `dayclosed` and `dayclosed-start`
     their two groups.
   - Newest first, by closing time.
4. **The three filters** (A1), each a sheet over the list, following the artifact:
   - **Table:** *Any*, *Quick sale* and *Table 1* to *Table 12* (the floor's twelve
     configured tables, `FLOOR_FIXTURES.default`).
   - **Closing time:** *From* and *To* fields and a 24-hour keypad with delete and clear.
     *Apply* refuses an invalid `HH:MM` or a *From* later than *To*, with the artifact's
     copy, and filters nothing until it is valid. The default range is 18:00 to 21:00.
   - **Amount:** a keypad; it matches the exact order total in whole rupiah.
   - *Apply filter* closes the sheet and filters the list at once. *Cancel* closes it and
     changes nothing. *Reset* on the toolbar clears all three. Filters combine.
   - When filters are set and nothing matches: the *No matching orders* composition with
     *Clear filters* (`nomatch`). That is distinct from `empty`, which says no order has
     closed this business day.
   - Compare amounts as `Money` (`bigint`). Never call `Number()` on money.
5. **The closed-day states** (F3, and the owner's ruling of 2026-09-30):
   - `dayclosed`: the banner *25 Sep · Business day closed at 23:14* with the artifact's
     body copy; a group *Business day open · 26 Sep* listing the one new-day quick sale;
     then a group *Closed day · 25 Sep · reprint only* listing the six fixture orders.
   - `dayclosed-start`: the same, with the first group reading *No orders closed yet in
     this business day.*
   - Filters apply to both groups, with the artifact's per-group no-match copy, and the
     single *No matching orders* composition when neither group matches.
   - `← Floor` from these two states goes to `/pos/floor?state=dayclosed`.
   - The floor's *Closed orders* link, in the floor's `dayclosed` state only, goes to
     `/pos/closed-orders?state=dayclosed` (the artifact's `floor.html:123`). In every other
     floor state it stays `/pos/closed-orders`.
6. **Where a row goes.** A new route `/pos/closed-order` renders a placeholder, the bare
   device frame and no copy, on the precedent `ClosedOrdersPlaceholder` set. The rows'
   hrefs are fixed now so that FE-031 can build against them:
   - a fixture row: the artifact's own query, `?state=<state>&order=<state>&time=<HH:MM>`,
     and under `dayclosed` the artifact's `list=dayclosed` for the new-day row and
     `state=dayclosed` for the closed-day rows (`closed.js:36`);
   - a book row: `?order=<book id>`, for example `?order=table-1`.
7. **The other states:** `empty`, `loading` and `error` draw the artifact's message in the
   list's place, with its copy. `error`'s *Retry* shows `default`. `overflow` lists the
   artifact's 36 rows in the scroll region.
8. **Styles** in `pos.css`, mapped from `closed.css` with registry tokens only; the columns
   use `--frost-closed-list-columns`. No new token.

## Constraints

- **Read-only.** Nothing here changes the book or any order. No refund, no reprint, no
  void control (B-19 does not apply to a list, but there is nothing to act on here).
- **No receipt number** anywhere (I-1). **No date search**, no older-day lookup: the list
  is the open business day (inventory), plus the closed-day group in the two closed-day states.
- **Release is not drawn** and the closed-day banner does not clear. The owner ruled that
  the banner and the closed-day group clear when the POS session that showed them ends
  (DECISIONS.md, 2026-09-30); there is no session or idle lock in the client yet (FR-A),
  so both stay fixture states here. Do not build a timer or a dismiss control.
- Do not change the floor beyond item 5's link; the floor's other DESIGN-009 changes
  (after-close, the quick-sale strip, the line counts) are a later slice.
- Use `<a>` for going and `<button>` for acting; an off action is `aria-disabled`, never
  `disabled` (FE-024). Do not run Prettier.

## Tests expected to change

- `apps/pos/test/floor.test.tsx:438–444`, *Closed orders goes to a placeholder: the bare
  device frame and no copy*. It pins the placeholder this task replaces. Change it to
  assert that the link reaches POS-05's `default` list.

Every other existing test must pass unmodified, including `floor.test.tsx:465–488`
(criterion 7, which presses *Closed orders* and goes back) and the three scans that read
every source file: `no-invented-values.test.ts`, `console-free.test.ts` and
`hover-scoped.test.ts`. If any other test needs changing, stop and ask.

## Acceptance criteria

1. **Every state draws what the artifact draws.** A table-driven test over all eleven
   states checks each one's rows (time, order, payment, total, tag) or message, and the
   header, toolbar and day line or banner. Red if a state is missing or draws another
   state's rows.
2. **A live close is listed.** Close Table 1 through the real route (floor → order →
   settle → Close, as `close.test.tsx` and `order-book.test.tsx` do), then press *Closed
   orders*: Table 1 is listed with the WIB time of its `closedAt`, its tenders and its
   total, and links to `/pos/closed-order?order=table-1`. A quick sale closed the same way
   reads *Quick sale*. Red if the row is read from a fixture, or the time is UTC.
3. **WIB, not the machine's zone.** A `closedAt` of `2026-09-25T13:14:00.000Z` shows
   `20:14`, whatever time zone the test process runs in. Red if the conversion uses the
   local zone.
4. **Newest first.** A book order closed at 21:30 WIB is listed above the fixture's 20:14.
   Red if book orders are appended after the fixtures.
5. **No receipt number.** No row, column head or filter names or shows one. Red on any.
6. **Filters apply at once and combine.** Set Table 7: only Table 7 is listed, with no
   further press. Then set amount 155.925: still Table 7. Set Table 12: *No matching
   orders*. *Reset*: all six. Red if a filter needs a second step or a set filter is dropped.
7. **The time filter validates.** From 21:00 To 18:00 is refused with the artifact's copy,
   and the list is unchanged. 25:00 is refused. 19:50 to 20:05 lists Table 4 (20:04) and
   Table 3 (19:58) and nothing else; the bounds are inclusive, so 20:04 to 20:04 lists
   Table 4. Red if an invalid range filters or a bound is exclusive.
8. **`nomatch` is not `empty`.** `nomatch` shows *No matching orders* with *Clear
   filters*; `empty` shows *No closed orders yet today* with no filter reset. Red if one
   draws the other's copy.
9. **The closed-day grouping.** In `dayclosed`, the new-day quick sale is in the first
   group and links with `list=dayclosed`; the six are in the second and link with
   `state=dayclosed`. `dayclosed-start`'s first group reads *No orders closed yet in this
   business day.* Red if the groups are merged or the closed-day rows link as refundable.
10. **The closed-day entry and exit.** From `/pos/floor?state=dayclosed`, *Closed orders*
    goes to `/pos/closed-orders?state=dayclosed`; `← Floor` returns to the closed-day
    floor. From the default floor, both are the plain routes. Red if the context is lost.
11. **Client-side, and the dialog behaves.** Every row and link is `pushState` with the
    document untouched; a modified click is left to the browser. Each filter sheet takes
    focus when it opens, is `aria-modal`, and *Cancel* and Escape close it with nothing
    changed.
12. **Touch at 1280×800.** Rows are at least the artifact's height; in `overflow` the list
    scrolls and the toolbar and heads do not move. The column heads stay aligned with the row
    cells when the scroller shows a classic, space-taking scrollbar: the artifact puts the heads
    outside the scroller, so a scrollbar shifts the rows' *Total* left of its heading
    (DESIGN-010 review, "Not run"). Keep them aligned, for example with `scrollbar-gutter:
    stable` on both or the heads inside the scroller, and say which. State how you measured, or that you
    could not; the lead walks it in a browser before closing the task.
13. `npm run verify` is green, with the test and file counts stated, and only the test
    named above changed.

## Out of scope

- POS-06, the closed order detail, and its reprint (FE-031); the refund sheet and
  approval (FE-032).
- The floor's after-close states, the open quick-sale strip, the line-count convention and
  the floor `dayclosed` header naming the open day (a later slice).
- Release, the actor session, and clearing the closed-day banner (FR-A).
- A server, an API, or any business-day arithmetic on the real date.

## Reporting

Commit on `agent/FE-030` only after verify is green, and never push. Append a Handoff
below: what you built and where, every decision you made and on what evidence, each test
you changed and why, the red cases you ran (mutation, failure, revert), what you found and
did not fix, the real verify output, and anything the next slice needs. Last line: DONE,
or BLOCKED: <question>.

Then run `herdr agent prompt lead "<your name>: FE-030 done — <tests> tests, <one line>"`,
or `herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Lead verify, round 1 (2026-10-01)

The lead ran `npm run verify` in this worktree at `6cf7f39` (33 files, 2339 tests, green) and
walked POS-05 in Chrome against the dev server, at the device's 1280×800. What held: all eleven
states draw the artifact's rows and copy; the three filters apply at once and combine; the time
filter refuses 21:00–18:00 and 25:00 and its bounds are inclusive; Escape and *Cancel* change
nothing; a live close of Table 9 is listed first with its WIB time and links `?order=table-9`;
the closed-day floor link and `← Floor` keep their context. **Criterion 12 is measured:** with a
16px space-taking scrollbar forced on `.closed-scroll` in `overflow`, the heads' and the rows'
*Total* both end at x=1244, the four column starts are identical (20, 124, 312, 1064), and the
toolbar and the heads do not move at scroll offsets 0, 900 and the end.

Two things to fix in this round. Change nothing else.

1. **The column heads paint over an open filter sheet.** `.closed-listhead` has `z-index: 1`;
   the sheet (`.sheet`, `position: absolute`, `z-index: auto`) and its scrim are siblings of the
   scroller, so the sticky band is drawn on top of them. In `filter-table` it covers *Table 1*
   and *Table 2*; in `filter-time` and `filter-amount` it covers the keypad's 1 2 3 row. The keys
   still receive the press, because the scroller is `inert`, so no test sees it. Make the heads
   stay under the sheet and the scrim while still covering the rows that scroll beneath them
   (dropping the `z-index` is enough for a positioned element over unpositioned rows; isolating
   the scroller's stacking is the other way), and say which you chose. Pin it with a test of the
   structure, as you did for sticky, and state its red case. The lead walks the three sheets again.
2. **The Handoff's baseline is wrong.** `development` at `1f4fac8` runs 32 files and **2256**
   tests (the lead ran it on 2026-10-01), not 2266; this branch adds 83, not 73. Correct the
   two sentences that state it.

Accepted as built, no change wanted: decision 2 (book rows above the fixtures; it is a
fixture-and-live mix that ends with the backend), decision 3 (the time field validates what it
shows) and decision 4 (a sheet opens on what is applied). The lead reports decisions 2 and 3 to
the owner.

Append a *Round 2* section to your Handoff: what you changed, the red case, the verify output.
Last line DONE or BLOCKED: <question>, as before.

## Handoff

**What I built.** POS-05 replaces `ClosedOrdersPlaceholder` on `/pos/closed-orders`, in the artifact's composition, with all eleven states.

- `apps/pos/src/closedOrders.ts`: the pure side. The states and copy (the artifact's, verbatim), the six fixture orders as `Money` bigints, the `?state=` reader, the row model, the WIB conversion, the three filters' matching, the keypad entry and the time-range validation.
- `apps/pos/src/ClosedOrdersScreen.tsx`: the screen, the rows, the closed-day groups and the three filter sheets. The sheets reuse `SheetFrame` from `Sheets.tsx` (focus onto the dialog, scrim, `aria-modal`, Escape) and the approval keypad's `.keypad--approval` / `.key`.
- `apps/pos/src/PosRoutes.tsx`: renders the screen, `key`ed on the query string so a new `?state=` reseeds it. A new route `/pos/closed-order` renders the bare device frame and no copy (the placeholder FE-031 replaces).
- `apps/pos/src/FloorScreen.tsx`: the *Closed orders* link goes to `?state=dayclosed` in the floor's `dayclosed` state only (item 5), and nowhere else changed.
- `apps/pos/src/orderStore.ts`: `tableOf` is now exported (one word, `export`). It was the only owner of the `table-n` id format, and the row reads the table number through it instead of copying the regex.
- `apps/pos/src/pos.css`: a `closed-*` block mapped from `closed.css`, registry tokens only, the columns on `--frost-closed-list-columns`, hover scoped to `@media (hover: hover)`. No new token.
- `apps/pos/test/closed-orders.test.tsx`: 73 new tests, one block per acceptance criterion.
- `apps/pos/test/floor.test.tsx`: one test changed (below).

Single commit on `agent/fe-030`. The hash is whatever `git log -1` shows on that branch; I cannot print it into this file before the commit is made.

**Decisions, and the evidence for each.**

1. *Column heads inside the scroller, sticky* (criterion 12). The artifact puts the heads outside the scroller, so a classic scrollbar narrows the rows and not the heads. I put `.closed-listhead` as the scroller's first child with `position: sticky; top: 0`. One scrollbar then narrows heads and rows alike, in any browser. I preferred this to `scrollbar-gutter: stable` on both because that property is missing on older tablet Safari. The toolbar stays outside the scroller, so it does not move. I could not measure it: there is no browser here, so the test pins the structure (heads first in the scroller, sticky, both on `--frost-closed-list-columns` and one padding). The lead's browser walk at 1280×800 with a classic scrollbar is still needed.
2. *Book rows list above all fixtures, newest first by the instant of `closedAt`.* The fixtures carry only a time of day on the open business day (25 Sep) and no instant. The book's orders were closed by this cashier after them, and the machine's clock is not 25 Sep. Sorting by clock face would hide a morning close at the bottom under the 20:14 fixtures, which reads as "not newest first". Criterion 4 (21:30 above 20:14) holds either way. This is a judgement; if you want a pure time-of-day merge, it is one comparator in `listedRows`.
3. *The time field is validated as it is shown.* The artifact's `valid()` requires four typed digits, but its `clock()` pads from the left, so a cashier who types 8, 0, 0 sees `From 08:00` and the artifact refuses it. I validate the padded `HH:MM` the field shows (`rangeIsValid`). 25:00, 12:60 and From later than To are all still refused, with the artifact's copy. Entry is still the artifact's calculator style (digits shift in from the right, a leading zero is dropped, a fifth digit is ignored).
4. *The time sheet opens on what is applied.* The artifact keeps its `from` and `to` across a Cancel, so a cancelled edit leaks into the next opening, and a stale refusal message survives. Here a sheet opens on the applied range, or 18:00 to 21:00 if none, with no refusal showing, so Cancel really changes nothing. The same holds for the table and amount drafts.
5. *`Reset` and `Retry` return to the picture the screen began in* (`default`, or the closed-day state), as `closed.js:81` does, not to a filter picture. Applying a filter from `nomatch` or a `filter-*` picture leaves it for `default`, as `closed.js:79` does.
6. *A book row's payment, change and comp text come from the book.* Tenders are the book's, `Change n · contribution total` appears when `change > 0n`, and a zero-total order reads *Comp 100% · no payment taken* when its snapshot is a percent discount whose `rateFromPercent` equals `RATE_SCALE`, else *No payment taken*. Amount comparison is `BigInt(typed digits) === row.total`. There is no `Number()` on money.
7. *`inert`* is applied to the header, banner, toolbar and list while a sheet is open (React 18: the bare attribute through a spread, as `DiscountSheets.tsx` does).
8. A DEV-only `fixture-states` nav lists the eleven states, as the floor and the incidents screen do. It is `import.meta.env.DEV` only. Tests that count anchors exclude it.

**The one existing test I changed.** `floor.test.tsx`, *Closed orders goes to a placeholder: the bare device frame and no copy*. It pinned the placeholder. It now presses *Closed orders*, expects `/pos/closed-orders`, the `h1` *Closed orders*, `data-closed-state="default"` and six rows. `floor.test.tsx` criterion 7 (presses *Closed orders*, goes back) and the three source scans pass unmodified.

**Red cases I ran** (mutate, read the failure, revert; the full suite was re-run green after the last revert):

- WIB conversion through `getHours()`: *2026-09-25T13:14Z is 20:14, in any process time zone* fails with `expected '13:14' to be '20:14'` (it loops `process.env.TZ`; this machine's zone is already WIB, so only the loop catches it).
- Book rows appended after the fixtures: five tests fail (the live Table 1, the quick sale, the ordering test, the live zero-total order and the WIB row).
- Time bounds made exclusive: *the bounds are inclusive* fails (`expected [] to deeply equal ['Table 4']`). The 19:50 to 20:05 test alone would not catch this, because no fixture sits on a bound.
- Closed-day rows given the open-day link context: both criterion 9 link tests fail.
- The closed-day floor link and the `← Floor` return reverted to the plain routes: both criterion 10 tests fail.
- `position: sticky` swapped for `relative`: the criterion 12 structure test fails.
- The range validation bypassed: the three criterion 7 refusal tests fail.

**Found and not fixed.**

- The artifact's `valid()` quirk in decision 3 is the artifact's, not the contract's. If the owner wants the artifact's behaviour exactly, that is a DESIGN question; I chose the usable reading.
- The closed-day group is a fixture state only: the banner never clears and there is no timer or dismiss (the 2026-09-30 ruling, FR-A not built). `dayclosed` and `dayclosed-start` list only their fixtures, never the book.
- `closedAt` is read with `Date.parse` and `Intl`; a malformed `closedAt` would throw. The close always stamps `toISOString()`, so I added no guard. A test that hand-builds a book with `closedAt: 't1'` (as `order-book.test.tsx` does) must not render the list.
- Criterion 2's example closes Table 1 through the real route. Table 1 holds a pending Steak (FR-G10 refuses its close), so the test removes pending lines through the panel's own × first, then settles by card. Tables 9 and 12 close the same way.
- Prettier was not run, and nothing touched a file by formatter.
- No browser was available, said once: the touch layout (criterion 12) is checked by structure only.

**Output of `npm run verify`:** typecheck clean (server, money, pos). `vitest run`: **33 test files passed (33), 2339 tests passed (2339)**. Baseline before this task (`development` at `1f4fac8`) was 32 files and 2256 tests, so +1 file and +83 tests: 73 in `closed-orders.test.tsx`, and 10 from the three source scans (`no-invented-values` runs five checks per source file, and this task adds two). The changed floor test is in both counts. (Round 1 of the lead's verify corrected my earlier, wrong 2266 and +73.)

**What the next slice (FE-031, POS-06) needs.** The route `/pos/closed-order` exists and is a bare frame. Its query is fixed: a fixture row is `?state=<state>&order=<state>&time=<HH%3AMM>`, with `list=dayclosed` for the new-day quick sale and `state=dayclosed` for the closed-day rows (the artifact's own encoding, `URLSearchParams`); a book row is `?order=<book id>`, for example `?order=table-1`. POS-06 must read a book id from the book (`book.orders()` / `orderFor`), which the row already proves is reachable from `PosRoutes`. It must not assume `PosRoutes` has seeded the book on a cold load: a direct visit to `/pos/closed-order?order=table-1` has an empty book.

### Round 2 (lead verify round 1, commit 29bef5d)

**1. Heads over the sheet.** I dropped `z-index: 1` from `.closed-listhead` in `apps/pos/src/pos.css`, the first of the two fixes the lead offered. A sticky element is positioned, and a positioned element with `z-index: auto` still paints above the unpositioned rows that scroll beneath it, so the heads keep covering them. The sheet and its scrim are `position: absolute; z-index: auto` and come later in the device frame than the scroller, so they now paint over the heads. I did not isolate the scroller's stacking, because removing one declaration is enough and adds no new rule. I have not seen it in a browser (none here); the lead walks the three sheets again.

The new test, *the sticky heads sit under an open sheet and its scrim*, in `closed-orders.test.tsx`, pins the structure. `.closed-listhead`, `.closed-scroll` and `.sheet` carry no `z-index`, and in `filter-table` the `.sheet` and `.sheet-scrim` follow `.closed-scroll` among the device frame's children. Red case: I put `z-index: 1` back on `.closed-listhead`, and that test failed (`expected '…z-index: 1…' not to match /z-index/`); I reverted it. This is a structural pin: jsdom does not paint, so it cannot see the overlap itself.

**2. The baseline.** Corrected in the Handoff's verify paragraph above: `development` at `1f4fac8` is 32 files and 2256 tests, and this branch adds 83 (73 in the new file, 10 from the source scans that now cover two more files).

**Output of `npm run verify` after the fix:** typecheck clean. `vitest run`: **33 test files passed (33), 2340 tests passed (2340)**, which is the 2339 above plus the one new test. Nothing else changed.

DONE
