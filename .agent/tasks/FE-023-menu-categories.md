# FE-023 — POS-03: a category press shows that category's items

**Status:** Written 2026-09-24 by `lead`. Unassigned.
**Source:** the owner's ruling of 2026-09-24 (POS-03 question 8): *"it shows
menu with that category, so something like beers, water should be in drinks,
while steak should be on main"*. The owner left the categorisation to the
lead, and it is below. **This overrides the lead's ruling of 2026-09-21** that
the rail's selection does not move (`MenuRegion.tsx:28–35`,
`menuFixtures.ts:45–53`). That ruling existed only because the artifact drew a
grid for Mains alone. The owner has now answered the designer's question it
deferred.
**Branch:** `agent/phase-0-foundations`. Baseline: `8af57a8`, 1796 tests
across 25 files.
**No design pass.** Every category's grid uses the existing Mains grid's
composition, tiles and states unchanged. Nothing new is drawn.

---

## What is wrong today

The rail has four categories. Pressing any of them keeps the order and changes
nothing (`MenuRegion.tsx:81`). One grid, drawn under Mains, holds mains, sides
and drinks together (`menuFixtures.ts:24–25`). Desserts has no items, although
`overflow` carries a Cheesecake at 60.000 that the grid does not sell.

## The categorisation (the lead's ruling)

| Category | Items, in this order |
|---|---|
| Mains | Burger, Chicken Wings, Steak, Fish & Chips |
| Sides | Caesar Salad, Soup of the Day, Fries, Onion Rings |
| Drinks | Soda, **Mineral Water**, Coffee, Beer, House Wine |
| Desserts | **Cheesecake** |

- **Two new items.**
  - **Mineral Water, 20.000, no option groups.** The owner named water. The
    price is illustrative fixture data, like every other price here, and a
    comment should say so.
  - **Cheesecake, 60.000, no option groups.** Its price is the one `overflow`
    already charges, so Desserts is not empty.
  - Each gets its own `sheet-item-<id>` state, as FE-021's twelve did. Soda
    shows how an item sheet with no option groups looks. Mineral Water goes
    in the drinks table beside Soda.
- **`overflow`'s existing Cheesecake line stays exactly as it is,** with no
  `itemId`. It is historical fixture data. Do not rewrite it to point at the new
  item. `fire.ts`'s comment about "a Cheesecake the grid does not sell" becomes
  false: reword it to name the line's missing `itemId`, not the grid.
- A `category` field on `MenuItem` is the single source. Every item belongs to
  exactly one category.

## What changes

1. **A category press selects that category.** The rail's selection
   (`aria-current`, `menu-category--selected`) moves to it, and the grid shows
   only that category's items, in the table's order.
2. **The selected category lives outside the URL**, beside the order store,
   and has the store's lifetime. A press is `[INLINE]`: no `?category=`, no
   history entry, and the order is unchanged.
   - It survives opening and closing an item sheet (Cancel and Add).
     Otherwise, adding a Beer drops the cashier back on Mains every time.
   - A fresh load starts on Mains.
3. **Everything that applies to a tile applies in every category:**
   - the 86'd tile (`eightysix` 86s Steak, which is on Mains);
   - the pressed-tile fixture;
   - the catalog and rejection notices;
   - the lock notice, which replaces the rail *and* the grid;
   - `&from=` origins.

   The fixture `pressedCategories` still draws a pressed ring.
4. Rewrite the two comments that record the 2026-09-21 ruling, so they state
   the new rule and cite this task.

## Acceptance criteria

1. **Each category shows exactly its items**, as a table test over the four
   categories, reading the grid's tiles. **Red case: pressing Drinks still
   shows Burger.** Watch it fail against today's code.
2. **Every `MENU_ITEMS` entry is in exactly one category.** The union of the
   categories is the whole menu, with no duplicates.
3. `aria-current` is on exactly one category, and it is the one pressed.
4. **The category survives an item-sheet round trip:** Drinks → Beer → Add →
   the grid still shows Drinks. The same holds after Cancel.
5. A press changes neither the URL nor the history length, and the order is
   unchanged.
6. Adding Mineral Water or Cheesecake appends its own line at its own price. The
   FE-021 twelve-tile test extends to all fourteen items.
7. From `eightysix`, Steak's tile is off on Mains. Switching to Drinks and back
   keeps it off. Under a lock state, no rail and no grid are drawn.
8. The existing tests pass. The only tests that may change are ones encoding
   *"the rail's selection does not move"* or *"one grid holds every item"*.
   Name each one in the handoff.
9. `npm run verify` is green, with the test count and file count stated.

## Do NOT

- Add `?category=` to the URL.
- Draw anything new (an empty-category state, category counts, icons).
- Touch `fire.ts` logic, `RoundGroup` or the order store's money. Rewording
  the comment is the only change allowed in `fire.ts`.

## Reporting

Commit nothing. Append a handoff below, then run
`herdr agent prompt lead "<your name>: FE-023 done — <tests> tests, <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

**builder25, 2026-09-24. Done, uncommitted.** `npm run verify` green: typecheck clean, **26 files, 1921 tests** (baseline 1796 / 25; +1 file `menu-categories.test.tsx`, +125 tests).

**Shape.** `MenuItem.category` is the single source (`menuFixtures.ts`); `MENU_ITEMS` is now the ruled 14-item table, in the ruled order; `itemsIn(category)` feeds the grid. `SELECTED_CATEGORY` became `DEFAULT_CATEGORY`. The selection is `useState` in `useOrderStore` (`category`, `selectCategory` on `OrderStore`), so it has the store's lifetime and no URL or history. `MenuRegion` takes `category` and `selectCategory` and the rail press calls `selectCategory`. Two new items (`water` 20.000, `cheesecake` 60.000, no option groups) each got `sheet-item-<id>` in `OrderState`, `ORDER_STATES`, `ORDER_FIXTURES`, `MENU_FIXTURES` and `sheetFixtures`. `overflow`'s Cheesecake line is untouched. Comments reworded: `MenuRegion.tsx`, `menuFixtures.ts`, `fire.ts` (names the line's missing `itemId`), and two more that recorded the old ruling or the "grid does not sell" claim (`orderFixtures.ts` `OrderView` and `itemId` docs). No `docs/`, MEMORY or ROADMAP edits; `fire.ts` logic untouched.

**Red first.** `menu-categories.test.tsx` was written and run before any source change: 82 of 88 failed (6 passed trivially, e.g. the lock states). "Drinks does not still show Burger" was among the failures.

**States walked, not only the named ones.** Every non-sheet `ORDER_STATES` id × every category: exact tiles, and off tiles are exactly `originFacts(state).menu.eightySixed` ∩ category (this covers `fireblocked-overflow` 86ing Coffee on Drinks). Locks draw no rail or grid. `loading` keeps the rail and moves the selection. Every `ITEM_SHEET_ORIGINS` key × {Add, Cancel} keeps Drinks. Every origin's 86 shows behind an item sheet.

**Existing tests changed** (only ones encoding "the selection does not move" or "one grid holds every item", plus two mechanical):
- `menu-region.test.tsx`: "draws every item as a tile…", "…every category as a button that keeps the order" (the `aria-current` = Mains assertion), "prices each tile", eightysix "keeps every tile" and "leaves every other tile a working button", "the grid never reflows" (all states), `pressed` "holds the selected category… and one tile", `catalog` "full grid".
- `fire.test.tsx`: `fireblocked-overflow` Coffee test (slot 9 of 12 → slot 2 of Drinks), `error` "leaves the grid live" (12 tiles → Mains' 4).
- `sheets.test.tsx`: "a category press keeps the order on screen" (rail keeps Mains → selection is Drinks); the item-sheet opener presses Soda's category first.
- `own-items.test.tsx`, `one-press-fire.test.tsx`: tile presses go through new `test/tile-for.ts`, which selects the tile's category first. `ARTIFACT` gained `water` and `cheesecake`; "twelve" → "fourteen"; P2 eightysix asserts Drinks survived the sheet, then goes back to Mains to see Steak.
- `order-panel.test.tsx`: fixture-state id list gains the two new ids (not one of the two rulings; unavoidable).
- `settlement.test.tsx`: five `OrderStore` stubs gain `category` and `selectCategory` (typecheck).

**For the lead to rule.**
1. **`pressed` state.** Its pressed tile is Fries, a Side, and a fresh load is on Mains, so the ring is not visible until Sides is pressed. The pressed *category* rings (Mains, Sides) are visible. I left it as ruled ("pressed-tile fixture applies in every category"); a fixture that should open on Sides would need a seed the store does not have.
2. **Item sheet opened by URL over Mains** (e.g. `?state=sheet-item-beer`): the opener tile is not in the Mains grid, so Cancel has no tile to return focus to. Nothing crashes; focus falls back as it does for any missing opener. I did not change it (out of scope).
3. FE-024 will touch the same tile code; the off tile is still a `div`.

### Round 2 (builder25, 2026-09-24)

Lead rulings: (1) the `pressed` fixture's tile moves to a Main; (2) a URL-opened item sheet's missing opener is accepted as is.

- **Change:** `MENU_FIXTURES.pressed.pressedItem` is `burger` (was `fries`), with a comment. `pressedCategories` still `['mains', 'sides']`. No per-fixture starting category was added.
- **Red first:** the `menu-region.test.tsx` `pressed` test was changed to expect Burger held on load and failed against the old fixture (1 failed, 187 passed), then passed after the fixture change.
- **Test change (one):** `menu-region.test.tsx` › `pressed` › "holds the selected category, one other category and one tile". It now expects `burger` held on a fresh load, and that pressing Sides shows no held tile (the ring is drawn only under its own category). Nothing else referenced `pressedItem`.
- `npm run verify` green: 26 files, 1921 tests.
