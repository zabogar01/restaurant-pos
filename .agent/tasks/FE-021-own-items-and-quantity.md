# FE-021 — POS-03: every tile adds its own item, and a line's quantity saves

**Status:** Written 2026-09-24 by `lead`. Unassigned.
**Source:** DESIGN-007 Parts A and B, committed on `agent/design-direction` as
`032a6e9` (feat) and `2da9d75` (docs). The artifact is
`../restaurant-pos-design/docs/design/visual-directions/frost/pos/order.html`.
Its new files are `frost-order-flow.js`, `frost-order-flow.css` and
`frost-order-flow.design.json` in the same `visual-directions/` folder. The
task, both handoffs, the lead's verification and the review are in
`../restaurant-pos-design/.agent/tasks/DESIGN-007-order-flow-gaps.md` and
`.agent/reviews/DESIGN-007-review.md`. **Read the worktree copies. This
branch's `order.html` is stale.**
**Branch:** `agent/phase-0-foundations`. Baseline: `6d69f2c`, 1349 tests
across 22 files.
**Part C, sending to the kitchen, is [FE-022](FE-022-one-press-fire.md).** It is
not this slice. Do not touch `fire.ts`, `RoundGroup` or the fire control.

---

## What is wrong today

1. **Every tile adds a Burger.** `MenuRegion.tsx:191` sends every tile to
   `ITEM_SEARCH` (`menuFixtures.ts:43`, `?state=sheet-item`). That is Burger's
   sheet (`sheetFixtures.ts:86–108`, whose own comment at `:17` says *"always
   'burger'"*). `ItemSheet` then appends `sheet.itemId` (`Sheets.tsx:136`). So
   tapping Fish & Chips adds *Burger · Large · Extra cheese* at 135.000. This
   has been a live defect since FS made Add real.
2. **The line editor's quantity never saves.** `LineSheet` holds the stepper
   in local `useState` (`Sheets.tsx:219–220`). Its only actions are Back and
   Remove line (`:230–233`). `store.setQuantity` (`orderStore.ts:68`, `:190`)
   exists, is tested, and has **no caller**. So `FR-D5`/`FR-M5` are
   unreachable.
3. **Adding is always quantity 1** (`Sheets.tsx:136`).

## What changes

### A. Each tile opens its own item

- **Twelve item sheet fixtures**, one per `MENU_ITEMS` id (`burger wings steak
  fish salad soup fries rings soda coffee beer wine`). Each has its own name,
  price and option groups. Take the option sets **exactly from the artifact**
  (`frost-order-flow.js`, the `items` table near `:11`). Do not invent your
  own. They are illustrative fixture data, as the design handoff says, and a
  comment should say so. **Soda has no option groups**, so its sheet draws no
  empty group label.
- **New states `sheet-item-<id>`**, with `sheet-item` kept as Burger's alias
  and `sheet-item86` still Burger's. Each tile navigates to its own state.
  Replace the single `ITEM_SEARCH` with a per-item destination. The
  `data-item` opener selector (`sheetFixtures.ts:102`) must name the tile that
  was actually pressed, so focus returns to it.
- **The shape to kill:** one destination shared by twelve controls. Criterion 1
  is its red case.

### B. The quantity is committed explicitly

The pattern is the owner's Square reference, as drawn in DESIGN-007 Part B:

- **Item sheet:** the footer has **− n +** beside *Add to order*. Add appends
  `quantity: n`, and the line amount is `n × unit` with modifiers.
- **Line editors** (`sheet-line`, `quick-line`, and every pending line opened
  from the panel): the footer has **− n +** beside a primary reading
  **`Update to n`**. The primary is **off while n equals the line's current
  quantity**. Pressing it calls `store.setQuantity(lineId, n)` and closes the
  sheet. **Back discards** the draft. **Remove line** stays a separate,
  secondary control.
- **Bounds (`FR-M5`):** − is off at 1 and **is never a removal**. + is off at
  99, with the maximum stated as the artifact states it. `QUANTITY_MIN` and
  `QUANTITY_MAX` (`sheetFixtures.ts:48–49`) stay the only source.
- **Pending lines only.** A fired line has no stepper (void family,
  `FR-F*`/`FR-H4`).
- **In-sheet unsaved totals:** draw them if the artifact draws them, as it does
  for the changed states. They are a preview and never the order's figures
  until the cashier commits.
- The artifact's changed and max fixtures (`sheet-item-two`, `sheet-item-max`,
  `sheet-line-changed`, `sheet-line-max`, `quick-line-changed`,
  `quick-line-max`) become states if they are reachable in the app. A draft is
  local sheet state, so **decide whether each needs a URL state at all, and
  say which in the handoff.** `[INLINE]` changes do not push history (SITEMAP).

## Do NOT copy these

- **The artifact's `frost-order-flow.js` is a fixture composer, not a design
  for the store.** Do not port its model. The order store (`orderStore.ts`) is
  the single owner of order state (FE-019). Only the option sets, the copy and
  the composition come from the artifact.
- **Round 1 of the design scraped the rendered panel to rebuild the order**,
  and the review caught it dropping a comp and erasing a void. The store never
  reads the DOM. Your Add and Update go through `addLine` and `setQuantity`.
- Do not show `Rp`. Amounts stay bare, because that is an open owner decision.

## Acceptance criteria

Each premise gets its own test. A criterion that is true only because
something else is true needs its own red case (MEMORY, the eleventh error).

1. **Each of the twelve tiles adds its own item.** Test it for every tile: tap,
   Add, and the new pending line has that item's id, name and price. **Red
   case: Fish & Chips adds a Burger.** Revert your routing and watch this test
   fail.
2. Soda's sheet renders no option-group label. Every option set equals the
   artifact's (by a table test, not by eye).
3. Add at n = 2 appends one line at quantity 2 with amount `2 × unit`, and the
   totals follow. Test it with a modifier price as well.
4. `Update to n` calls `setQuantity` exactly once with `n`. Back calls
   nothing. **The primary is off when n equals the current quantity.**
5. **− at 1 is off and never removes the line**, which gets its own test. + at
   99 is off. No path produces 0 or 100.
6. **Figures:** from `?state=sheet-line` (Steak), setting 1 → 3 and pressing
   Update gives subtotal **885.000**, Staff meal **−88.500**, service
   **39.825**, total **836.325**, included tax **72.409**. These are the
   review's independent figures.
7. **Comp and void survive** (the design review's two findings, applied to
   the store): Add Soda from `zero` gives total **0** with Comp 100% kept. Add
   Soda from `overflow` keeps the voided Caesar Salad row and gives total
   **1.275.750**.
8. No stepper on a fired line.
9. All 1349 existing tests still pass. The only tests that may change are ones
   encoding *"every tile opens Burger"*. Name each one in the handoff.
10. `npm run verify` is green, with the test count and file count stated.

## Read before you start

- `CLAUDE.md`, and `docs/BOUNDARIES.md` (money rules).
- `apps/pos/src/Sheets.tsx`, `sheetFixtures.ts`, `menuFixtures.ts`,
  `MenuRegion.tsx` and `orderStore.ts`.
- DESIGN-007 Parts A and B, **both** handoffs, and the review.

## Reporting

Work only on this branch. Commit nothing. When done, append a handoff below and
run:
`herdr agent prompt lead "<your name>: FE-021 done — <tests> tests, <one line>"`.
If you are blocked or need a ruling, run:
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

### builder23 — 2026-09-24

**Result:** `npm run verify` green. **23 files, 1577 tests** (baseline 1349 / 22). New file `apps/pos/test/own-items.test.tsx` (45 tests). Nothing committed. No contract or central-memory file touched. `fire.ts`, `RoundGroup` and the fire control untouched.

**Criteria → tests** (all in `own-items.test.tsx` unless noted)
1. Twelve `it.each` tap→Add→line tests. **Red case seen:** before routing, `expected 'Burger' to be 'Fish & Chips'`.
2. Table test against a transcription of the artifact's `items` table (names, prices, groups, choose-one/any, defaults); Soda has no `.sheet__label`/`.sheet-group`.
3. Add at n=2: Burger 270.000 with totals = `orderTotals(sub + 270.000, STAFF_MEAL)`; Fish & Chips + Chilli mayo × 2 = 290.000. Store-level tests in `order-store.test.tsx` too.
4. Update calls `setQuantity` exactly once (spy on the `SheetView` prop); Back calls nothing; primary `disabled` while n = current.
5. − at 1 disabled and never removes the line (row count unchanged); + at 99 disabled; a 150-press sweep never leaves 1..99. The item sheet has the same bounds.
6. From `?state=sheet-line`, 1→3: 885.000 / −88.500 / 39.825 / 836.325 / 72.409. Also the panel-opened path (Steak → 2 = 480.000).
7. Soda added from `zero` → total 0 with Comp kept; from `overflow` → voided Caesar Salad row kept, total 1.275.750.
8. `panelLine` is undefined for a fired line; pressing a fired row draws no stepper.
9. See "Changed tests". 10. Verify green, counts above.

**Red cases by mutation (Part B).** I wrote Part B's code before its tests, so I proved each test can fail by breaking the code. Each mutation failed exactly the tests named for it, then I restored the code:
- Add ignores quantity → 2 failed.
- − allowed to 0 → 2 failed.
- Update never disabled → 1 failed.
- + allowed to 100 → 2 failed.
- Update double-commit → 1 failed.
- Back commits → 1 failed.

**Lead ruling applied (FR-C2).** `lineAmount` is now `max(0, price + deltas) × qty`, clamping the unit and not the total. The old formula was `qty × price + deltas`. New red case for "recompute, never multiply the stored amount": 2→3→2 on the quick Burger gives 270.000 / 405.000 / 270.000 (multiplying stored would give 810.000). Also a clamp test: a unit driven below 0 gives amount 0.

**Changed tests (name each)**
- `order-store.test.tsx` AC5 (was `:144`, comment `:127-131`): 335.000 → **405.000**, per FR-C2 and the lead ruling. Added three tests (2→3→2 rewrite, Add ×2 with modifier, unit clamp).
- `menu-region.test.tsx` "draws every item as a tile…" and "leaves every other tile a working button": each tile now asserts `itemDestination(id)` and its own sheet title. These are the two that encoded "every tile opens Burger".
- `order-panel.test.tsx` "has exactly the six states…": the 12 new `sheet-item-<id>` ids appended to the expected `ORDER_STATES` list.
- `sheets.test.tsx`: the reachability-sweep key list gets the 12 new states, and the bigint check reads `item.groups` since `sizes`/`extras` no longer exist. **Neither is "tiles open Burger"**, but both are forced by new states or a new fixture shape. Flagging for the lead.

**Fixture sweep (ruling's request).** The only fixture line with quantity > 1 and modifiers is fired `of-burger` (2 × 135.000 = 270.000, stored 270.000). It agrees. Its modifiers carry no deltas, so a rewrite would price it at 200.000, but it is fired and has no stepper. Lines with quantity > 1 and no modifiers (`of-soda`, `of-wings`, `of-beer`, `of-coffee`) all agree with price × qty. No stored figure elsewhere disagrees. Nothing silently changed.

**Decisions to confirm**
- **URL states for drafts: none.** `sheet-item-two`, `sheet-item-max`, `sheet-line-changed`, `sheet-line-max`, `quick-line-changed`, `quick-line-max` are not app states. A draft is local sheet state and `[INLINE]` changes push no history, so a URL would name something the store cannot hold. Tests reach 2 and 99 by pressing.
- **Unsaved preview:** drawn only while the draft differs from the line ("Line total", the `unit × n = amount` line, then "After update · not saved yet" plus totals). The artifact also draws it at n = current. It's a pure `previewQuantity(order, lineId, q)` over the store's order and writes nothing.
- **Bound copy** is the artifact's ("Minimum 1. Use Remove line…", "Maximum 99 per line. Increase is unavailable.", "Minimum 1 per line." on Add). The existing label "Quantity — whole numbers, maximum 99" is kept on the line editor so its existing test still passes.
- **Off controls:** − / + / Update are `disabled` buttons (`aria-disabled`, `action--off`), not spans, so the hand finds them in the same place. The 86'd item sheet has **no stepper**: there is nothing to commit and the existing "only way out is Cancel" test holds.
- **Add routing:** `sheet-item` and `sheet-item86` keep Burger's artifact routing (Add → `eightysix`). The twelve `sheet-item-<id>` sheets Add → `default`. `eightysix` 86s Steak, which is wrong for a tile press.
- **Modifier rule:** a choose-one **Size** at delta 0 isn't listed as a modifier (unchanged rule); all other chosen options are listed. The rule is keyed on group id `size`. Coffee and Beer also have a "Size" group, so "Regular" is omitted there too. Steak's "Medium rare" is listed, as before.
- `ItemSheetFixture` is now `groups[]` + `chosen: Record<groupId, optionId[]>` instead of `sizes`/`extras`. `ITEM_SEARCH` is gone, replaced by `itemDestination(id)`.
- The 12 new states also appear in the dev fixture nav (`ORDER_STATES`).

**Not done / out of scope.** No Part C. No visual review in a browser; CSS is three small rules (`.sheet-stepper--foot`, `.sheet__bound`, `.sheet__preview`) on existing tokens and the footer layout is unchecked visually.

### builder23 — Round 2 (2026-09-24)

**Result:** `npm run verify` green: **23 files, 1588 tests** (round 1: 1577). `git diff --check` clean. Nothing committed. No contract or central-memory file touched. `RoundGroup`, `fire.ts` and the fire control untouched. Every finding's red case was written first and failed; I also broke each fix to confirm its test goes red (mutations listed at the end).

**Findings**
1. **P1, live line editor.** `OrderPanel.tsx` now builds the panel line editor from `store.order`, not `shownOrder(view)`. Red case: Add Fish & Chips from `default`, tap its row, Update to 2 → row quantity 2, amount 400.000 (Tartare + Extra fish default, unit 200.000).
2. **P2, 86'd availability.** The item sheet returns to the state it was opened from. `OrderView` gets an optional `from` (URL `&from=<state>`, honoured only on `sheet-item-*`, only for a real non-sheet state, and omitted when `default`, so the default URL is unchanged). `menuFixtureFor(view)` makes the grid, the panel's unavailable list and Send read the origin's availability while the sheet is open. Cancel and Add both go to `from ?? default`. Tested from `eightysix` for Cancel and for Add, both while the sheet is open and after it closes. The Steak stays tagged 86, Send stays a span, the Steak tile stays off, and the URL returns to `?state=eightysix`. The `zero` and `overflow` survivals stay green. `sheet-item` and `sheet-item86` keep the artifact's own routing.
3. **P2, unit-price snapshot.** `OrderLine.unitPrice?` is written at `addLine` (`max(0, base + deltas)`; `amount = unitPrice × qty`). A quantity edit reprices from the line's own snapshot. Fallback for a fixture line without one: the menu, or the line's own amount ÷ qty when it has no menu item. Red case: change the catalog price after Add, edit qty 1→2, get 270.000, not 310.000.
4. **P2, zero-delta options.** Every chosen option goes into the line's modifiers, a zero-delta Size included (Coffee/Beer/Burger "Regular"), as the bare name, like the other zero-delta modifiers. **No existing test changed for this.** New tests: Coffee Regular, Burger Regular.
5. **P2, item-sheet footer.** Both sheets' footers are now `.sheet__secondary` (Cancel; on the line editor, Back and Remove line), `.sheet__commit` (− n + and the primary), and the bound copy, as in the artifact's `.flow-secondary`/`.flow-commit`. The line editor uses the same rows. Three small rules in `pos.css`, existing tokens only, no browser layout check.
6. **P2, 86'd sheet.** The stepper stays and works, and the total follows it; Add stays a span that is not a control.
7. **P3, resting preview.** Line total, `unit × n = amount` and "After update · not saved yet" totals are drawn at rest on `sheet-line`, `quick-line` and every panel-opened line editor.
8. **P3, twelve-tile test.** It now asserts each new row's **amount** against the artifact table (price plus default selections' deltas), independent of the fixture. Red: adding 1 to the unit price in `addLine` fails 23 tests.

**Extra bug found and fixed.** The resting preview made `previewQuantity` run on every pending line, and overflow's Cheesecake has no `itemId`, so `priceOf` threw ("no menu item for itemId undefined"). Fixed in the store with the own-unit fallback above (an Update on it would have thrown before). New test: Cheesecake × 2 = 120.000.

**Changed tests (name each)**
- `own-items.test.tsx`, the preview test at 271–278 ("shows the unsaved preview only once the draft differs"): replaced by "draws the preview at rest…" plus a quick-line one, per ruling 7.
- `own-items.test.tsx`, twelve-tile test: now asserts the amount (8). `ARTIFACT` table moved above it.
- `sheets.test.tsx`, "the only way out is Cancel (or Escape)": **selector changed, needs your eye.** With the stepper kept on the 86'd sheet (ruling 6), `.sheet__foot button` also matches − and +, so the literal assertion cannot hold. It now reads `.sheet__secondary button` (the row that holds exits) equals `['Cancel']`, and presses every `.sheet__commit` button to assert the dialog stays open. Semantics are kept: Cancel is the only exit.
- `menu-region.test.tsx`, "leaves every other tile a working button": the destination expectation is now `itemDestination(id, 'eightysix')`, because tiles pressed on `eightysix` carry `&from=eightysix`.
- `order-store.test.tsx`: two new describes (catalog-change snapshot; Cheesecake own-unit).

**Mutations run (each red, each restored):** panel line editor back on the fixture order → P1 test; menu fixture off `from` → both 86 tests; Cancel/Add hardwired to default → both 86 tests; snapshot removed → catalog-change test; own-unit fallback removed → Cheesecake test plus two `sheets.test.tsx` overflow tests; Size-at-zero filter restored → both P4 tests; preview only when changed → both P7 tests; Add unit price off by one → twelve-tile amounts (and 11 others).

**Left as is.** Fixture line `of-burger` (fired, no deltas on its modifiers) still would reprice to its base if a rewrite ever reached it; it has no stepper. `sheet-item` opened directly still routes Add → `eightysix` (the artifact's alias routing).

### builder23 — Round 3 (2026-09-24)

**Result:** `npm run verify` green: **23 files, 1638 tests** (round 2: 1588). `git diff --check` clean. Nothing committed; no contract or central-memory file touched. Red cases written first (22 failing), then the fixes; each fix then broken again to confirm its test goes red.

**9 — Add never returns to a state whose notice is now false.** `ITEM_SHEET_ORIGINS` (`orderFixtures.ts`) classifies each origin explicitly:
- `keeps` (persistent, Add returns to it): `default`, `overflow`, `zero`, `other-discount`, `quick` (order context) and `eightysix`, `fireblocked`, `fireblocked-overflow`, `fireerror` (86 availability, the FE-011 refusal, the incident banner).
- `clears` (Add goes to `default`, order kept): `error`, `catalog` (transient rejection notices), and also `empty` (no longer empty) and `pressed` (a held tap). **These last two are my call; please confirm.**
- Cancel always returns to the origin, because its notice is still true.
- Tests: Add from `error` and from `catalog` leaves no notice, adds the line and lands on `?state=default`. Cancel from `error` keeps the origin and the notice. One derived test, Add from every accepted origin, asserts no rejection or catalog notice is drawn afterwards.

**10 — `from` is an allow-list.** `orderViewFrom` accepts a `from` only if it is a key of `ITEM_SHEET_ORIGINS`, and only on `sheet-item-*`. The rule in the code comment: a workspace state where a tile is pressable, so no overlays and no inert-grid states (lock, loading). Everything else parses as no origin. The table test runs over **every `ORDER_STATES` id**. Its rule is derived from the fixture tables, not from the parser's list: accepted iff not in `SHEET/APPROVAL/DISCOUNT/VOID_FIXTURES` and `MENU_FIXTURES[id]` has no `lock` or `loading`. It also checks the rule isn't vacuous, that named bad values (`sheet-line`, `quick-line`, `approval`, `lock-*`, `loading`, `sheet-discount`, `sheet-voidline`, `nonsense`, `settle-error`) are rejected, and that `from` on a non-item-sheet state is ignored. An edited URL `sheet-item-soda&from=sheet-line` cancels to `default`, not another sheet.

**3 — the catalog is never consulted after a line exists.** I chose `amount ÷ quantity` over seeding: `unitOf(line) = line.unitPrice ?? amount ÷ qty`, exported and used by both `rewriteQuantity` and the preview label, so the figure and its arithmetic agree. `priceOf` is now used only at `addLine`. This is exact because a FR-C2 line's amount is unit × quantity. Red case (the reviewer's scenario): Burger base 100.000 → 120.000, then open the pre-existing quick Burger. The label reads `135.000 × 1 = 135.000` at rest, `135.000 × 2 = 270.000` after +, and the Update lands 270.000. The old `unitOf` fixed-catalog fallback would give 155.000. Cheesecake (no menu item) and the round-2 snapshot test are unchanged.

**Mutations (each red, restored):** Add always keeps origin → 3 tests; parser accepts any state → 6+ table rows; catalog fallback back in `unitOf` → the quick-Burger test.

**Changed tests:** none of the existing ones this round. New tests are in `own-items.test.tsx` ("round 3"). One type fix in that file (`OrderState` cast).

**Left as is.** No browser layout check of the new footer rows. `sheet-item` opened directly still uses Burger's artifact routing (Add → `eightysix`).

### builder23 — Round 4 (2026-09-24)

**Result:** `npm run verify` green: **23 files, 1641 tests** (round 3: 1638). `git diff --check` clean. Nothing committed; no contract or central-memory file touched.

**11 — the incident banner survives an open item sheet.** New helper `originFacts(view)` in `menuFixtures.ts` returns the facts an item sheet takes from its origin (`view.from ?? view.state`): `{ menu, incident }`. `menuFixtureFor` now delegates to it, and `OrderPanel` reads the banner from it. Its doc comment states the rule: view-level facts about the place, not the sheet, are read there, never as `X[view.state]`. So the next one is added in one spot. The banner stays visible and inert behind the sheet, as with the void sheet.

**Tests** (`own-items.test.tsx`, "round 4"):
- Red case: open Soda from `fireerror`; the banner is present with the sheet open, is inert, and is still there after Cancel. It failed at the open-sheet assertion before the fix.
- Derived: for every `ITEM_SHEET_ORIGINS` origin whose `ORDER_FIXTURES` entry has an incident, the banner with that incident's title is present with the sheet open. A non-vacuity test asserts `fireerror` is in that set.
- Mutation: reading the incident from `view.state` again fails both.

**Not moved:** `ORDER_FIXTURES[view.state]` in `OrderPanel`'s panel (`lock`, `pressedLineId`) and `MENU_FIXTURES[view.state].loading` still read the view's own state. No allowed origin has a lock, loading or a pressed line that should persist (`pressed` is a `clears` origin), so nothing is wrong today, but they are not routed through `originFacts`. Say if you want them moved for the next one's sake.

**Changed tests:** none.

### builder23 — Round 5 (2026-09-24)

**Result:** `npm run verify` green: **23 files, 1645 tests** (round 4: 1641). `git diff --check` clean. Nothing committed; no contract or central-memory file touched.

**12 — Cancel from `pressed` no longer brings back the held visual.** The policy is in `ITEM_SHEET_ORIGINS`, not in the handler. It now has three values, each documented on the table:
- `keeps`: Cancel and Add both return to the origin (`default`, `overflow`, `zero`, `other-discount`, `quick`, `eightysix`, `fireblocked`, `fireblocked-overflow`, `fireerror`).
- `clears-on-add`: Cancel returns to the origin, Add goes to `default` (`error`, `catalog`, `empty`). The old `clears` value for these is renamed.
- `clears`: a transient interaction that has already ended. Both go to `default` (`pressed`).

`OrderPanel` reads one `policy` and derives `cancelTo` and `addTo` from it.

**Tests** (`own-items.test.tsx`, "round 5"):
- Red case: open Soda from `pressed`, Cancel → it landed on `?state=pressed` and the held row and tile were marked pressed. It now lands on `default` with zero `.is-pressed` nodes.
- Add from `pressed` gives the same result.
- Cancel from `error` and `catalog` still returns to the origin.
- Mutation: `pressed` back to `clears-on-add` fails the Cancel test.
- The banner test's Add half is added: after Cancel, open Soda again, Add, and the banner is still present. It passed at once, because Add from `fireerror` already returned to it.

**Changed tests:** none; the round-3 "Add from any accepted origin" test still passes unchanged.
