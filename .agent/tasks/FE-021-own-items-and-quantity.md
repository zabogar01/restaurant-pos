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
