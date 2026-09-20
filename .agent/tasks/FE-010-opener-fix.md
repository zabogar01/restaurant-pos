# FE-010 — Every opener carries the order on screen (F2k)

**Status:** Ready, unassigned. Written 2026-09-20 by `lead`.
**Roadmap item:** F2k
**Branch:** `agent/phase-0-foundations`
**Baseline:** `e5e0230`, 853 tests across 17 files, typecheck clean.

---

## What this slice is

F2e fixed **one** opener: the panel's void paths now open over the line and the
order the cashier actually tapped. **Three more openers carry the same defect**,
and two inline moves still push history where SITEMAP forbids it. This slice
finishes the job.

The defect has one shape, and it is worth stating once:

> A control on POS-03 opens an overlay built from a **fixture**, not from the
> order the cashier is looking at. The overlay then shows another order's lines,
> another order's figures, or another line's name — and the panel changes
> underneath the person who pressed it.

F2e fixed the instance where getting this wrong prints paper (`B-16`: a
cancellation ticket for work nobody asked to cancel). The instances below do not
print, but **one of them feeds an approval gate**, and the other two show the
cashier the wrong order.

**The fix already has a shape, built in F2e.** `OrderScreen` holds `voidOpened`
as component state; `panelVoid(target, view)` in `voidFixtures.ts` builds the
sheet's fixture from that target and the view on screen; opening writes no URL
and no history entry; the `?state=sheet-void*` fixtures still work for review.
**Follow that pattern.** It is already reviewed, already tested, and already the
answer to the same question.

---

## 1. Discount — the one that feeds a gate

`OrderPanel.tsx`'s close bar routes Discount through
`navigate('?state=sheet-discount')`. That is a fixture state, so:

- **The panel changes.** `ORDER_FIXTURES['sheet-discount']` is the table order.
  From `overflow` (13 lines, total `1.244.250`, **no discount**) or from `zero`
  (the same table order carrying **Comp 100%**), pressing Discount replaces the
  order on screen with the table order carrying **Staff meal 10%**.
- **The gate's input is a fixture's.**
  `DISCOUNT_FIXTURES['sheet-discount'].applied` is `STAFF_MEAL`, and `applied`
  is exactly the first argument `needsManager` reads for `FR-F8`
  (`discount.ts:54`). The picker therefore decides the manager gate from a
  discount the order on screen may not carry.

### Be precise about how bad this is today — the lead has checked

**No order fixture carries a `DiscountSnapshot` at all.** `OrderFixture.totals`
holds `discount?: Adjustment`, which is a **label string and an amount**
(`orderFixtures.ts:44`) — `'Staff meal 10%'`, `-40.500`. It has no `source`, and
`source` is the only field `FR-F8` turns on. So the fact the gate needs **is not
on the order**; the sheets have been reading it from a fixture because there was
nowhere else to read it from.

**The gate's *answer* coincides today, and only by luck.** `needsManager`
differs between a preset and a free-form applied discount. The only order
carrying a free-form discount is `sheet-remove-freeform`, which is a *sheet*
state — you cannot press the close bar's Discount from it, because the
background is inert while a sheet is open. Every order you *can* press Discount
from carries either a preset or nothing, and for those two the answer is the
same. **Do not report this as "the gate is currently wrong".** Report it as what
it is: the gate reads the wrong fact, and the wrong fact has not yet produced a
wrong answer because no reachable order carries a free-form discount.

**That is also the requirement.** Making the input correct is untestable unless
there is a case where it changes the answer. So this slice **adds one non-sheet
order state carrying a free-form discount** — the same table order carrying
`OTHER_15` instead of `STAFF_MEAL`, which is exactly what
`sheet-remove-freeform` already draws minus the sheet. From that order, remove
and replace are **gated** (`FR-F8`: removing or replacing a free-form discount
requires approval even if its replacement is a preset). Today, opening the
picker there would read `STAFF_MEAL` and offer them **ungated**. That is the
test with teeth.

`FR-F8` is the contract, and the PRD is more precise than
`SCREEN-INVENTORY.md`'s summary of it — that over-reading cost this project a
correction on 2026-09-18. **Go to `FR-F8` itself.**

---

## 2. The line editor — the wrong line

`EDIT_LINE_SEARCH` is the constant `'?state=sheet-line'`
(`orderFixtures.ts:134`), and **every** PENDING row body navigates to it
(`OrderPanel.tsx:256`). `SHEET_FIXTURES['sheet-line']` is hardcoded: title
`'Steak — pending'`, quantity `1`, and `remove: { state: 'default', gone:
'steak' }`.

So tapping **Coffee** on `overflow` opens the **Steak's** editor, and that
sheet's *Remove line* takes the **Steak** — on an order that then turns into the
table order. Ungated (`FR-H2`: a PENDING line is removed with no prompt and
nothing written), so there is no `B-16` exposure here. It is still the wrong
line, and *Remove line* is the same act the row's `×` performs.

**The panel's existing removal rule does not change.** `OrderPanel` honours
`?gone=` only where the fixture has figures for it, and never under a lock.
`overflow` has figures for `of-coffee`, `of-cheese` and `of-wine`; most orders
have figures only for `steak`. A panel-opened editor's *Remove line* asks for
`gone=<the line that was tapped>` and the panel honours it exactly as the `×`
control is honoured — **no new totals are computed and none are invented.** A
removal the fixtures cannot draw visibly does nothing, as it does today. Say so
in your handoff rather than reporting it as a new defect.

---

## 3. The category — the lead found this one reading the code

It is not in the roadmap line and was not in `builder11`'s list. Two facts,
both from `menuFixtures.ts:47` and `orderFixtures.ts:341`:

- **`categorySearch` hardcodes the state:**
  `` `?state=default&category=${id}` ``. Tapping a category on `overflow` or
  `zero` moves the cashier to the table order. That is the same defect as 1 and
  2, on a control nobody had counted.
- **`category=` is written and never read.** `orderViewFrom` parses only `state`
  and `gone`. `SELECTED_CATEGORY` is the constant `'mains'`, so pressing
  *Drinks* writes `category=drinks` to the URL and the rail still draws **Mains**
  as selected. The URL asserts something the screen contradicts.

**A category press is an inline change of POS-03**: it stays on the screen and
changes what the grid shows. It must keep the order on screen, and the rail's
selection must follow the category that was pressed.

**The grid does not change, and that is not yours to fix.** The artifact has
items for Mains only; FE-004 accepted and documented that. Selecting *Drinks*
leaves the same twelve tiles. Do not invent a drinks catalogue.

These are two separate acceptance criteria below. If you think the second one
belongs in a different slice, **say so and build the first** — that is the call
`builder7` made correctly on F2c.

---

## 4. Inline moves push history — ruled 2026-09-18, not yet applied

**The ruling, from FE-009's verification:** *a change that stays on POS-03
replaces the history entry; only leaving POS-03 pushes.* SITEMAP §1 gives
`[INLINE]` **Back-stackable: No**.

Today `OrderScreen.navigate` replaces only when a sheet or prompt is open or
about to open, and pushes otherwise. So the category press and the `×` removal
each push an entry, and **Back after a `×` puts the removed line back** — a
removal undone by a browser control. That is one condition in `navigate`.

*Send to kitchen* and *Settle* leave POS-03 and keep pushing.

---

## HELD, deliberately — the menu tile

`ITEM_SEARCH` is the constant `'?state=sheet-item'`, so **every tile opens
Burger's sheet** (`MenuRegion.tsx:129`). `builder11` named it as the same
disease. **It is not in this slice, and the reason is not scope.**

The other three openers need data the app already has: a line id, an order view,
a state. The item sheet needs an **option set** — sizes and extras — and the
reviewed artifact configures **Burger only**. Eleven of the twelve tiles have no
reviewed sheet to open. Every way out invents something:

- Giving Steak Burger's options invents that a steak takes *Extra cheese*.
- Drawing an item sheet with no option groups is a composition the artifact
  never draws.
- Leaving it is the defect.

**This is an `A7`-shaped gap: a real design decision, not a wiring bug.** The
precedent is exact — `DESIGN-005`'s designer invented a state to demonstrate the
invalid field, **reverted it and asked**, and the lead granted it. So the lead
asks rather than ruling from a task file.

**The lead's proposal, for the designer and the owner, recorded here so it is not
lost:** a tile opens the sheet for **that item's identity** — the name and price
`MENU_ITEMS` already carries — and the option groups render only for an item that
has a reviewed option set. An item with no options shows its line total and
nothing else. That is one new composition, small, and it goes through
`design-reviewer` rather than into this slice.

**If you touch `MenuRegion.tsx` for anything else, leave the tile's opener
alone.**

---

## What must not change

**Everything else.** In particular:

- **`I-12` still holds**, and its guard still reads *"no trailing slot has an
  anchor or button ancestor"* with all five of its detector self-tests. Widen
  what it looks for if an element changes; **never weaken what it asserts.**
- **`B-12` still holds on both PIN pads** — byte-identical output for different
  PINs, at every partial length. 22 tests fail if a digit leaks; keep it that
  way.
- **The reachability guard still passes**, including its self-test that it can
  see a void sheet opened in place while the URL says `default`. **If you make
  the discount family open in place, that guard goes blind to it the same way it
  nearly went blind to the void.** Extend the detector *before* relying on it —
  that is precisely the trap `builder11` documented.
- **No control this slice adds or rewires reaches a gated state except through
  the approval prompt.** The panel's existing void paths are `I-12`'s and stay.
- **`<button>` for acting, `<a>` for going.** An anchor goes to a screen that
  already exists; a button makes something happen and only incidentally arrives
  somewhere.
- **The lock states stay inert**, the route out stays the only control on the
  frame, and no discount, void or editor is reachable under either lock
  (`FR-G12`, `FR-G13`, `AC-21`, `AC-29`).
- **No invented values. No `Number()` on money. No hover outside
  `@media (hover: hover)`. No console, storage, cookie or fetch.**
- **The `?state=` fixture states keep working for review**, exactly as the
  `?state=sheet-void*` states did through F2e.

---

## Required inputs

1. **`.agent/tasks/FE-009-corrections.md`** — the whole handoff. Correction 1 is
   the pattern you are repeating; *Found, not fixed* is your brief; *Judgement
   calls* 2 and 4 and the lead's rulings under them are binding.
2. **`docs/PRD.md`, `FR-F8`** — the whole-transition gate, in its own words.
   Not `SCREEN-INVENTORY.md`'s summary of it.
3. **`docs/design/SITEMAP.md` §1**, in the worktree at
   `../restaurant-pos-design` — the node-type table: `[INLINE]`, `[SHEET]` and
   `[MODAL]` are none of them back-stackable.
4. **`apps/pos/src/` and all of `apps/pos/test/`.** Particularly
   `voidFixtures.ts` (`panelVoid`, `shownOrder`, `lineBody`), `OrderPanel.tsx`
   (`navigate`, `PanelActions`), `discount.ts` (`needsManager`) and
   `discountFixtures.ts`.

---

## Acceptance criteria

1. **The discount family opens over the order on screen.** Pressing Discount
   opens the picker as component state: no URL is written, `history.length` is
   unchanged, and the panel beside it still shows the order the cashier was
   looking at — its lines, its title and its totals. Tested from at least
   `default`, `overflow` and `zero`.
2. **The gate reads the order, not a fixture.** An order carries its applied
   discount as a `DiscountSnapshot`, and the picker passes *that* to
   `needsManager`. Tested: from the order carrying a **free-form** discount,
   replacing it with a preset and removing it are **both gated** and reach the
   approval prompt; from the order carrying a **preset**, replacing it with a
   preset and removing it are **ungated**; from an order carrying **nothing**,
   a preset is ungated and free-form is gated. `FR-F8`, `FR-F2`, `FR-F3`.
3. **One non-sheet order state carries a free-form discount**, so criterion 2
   has a case where the fixture's answer and the order's answer differ. Prove
   it: point the picker back at the fixture's `applied` and show the tests fail.
4. **The line editor opens over the line that was tapped.** Its title names that
   line and its *Remove line* asks for that line. Tested including that two
   different pending rows open two different editors — which is the defect.
5. **A category press keeps the order on screen.** Tested from `overflow`.
6. **The rail's selection follows the category that was pressed**, and the URL
   no longer asserts a category nothing honours. Tested. (Hold this one and say
   why, if you judge it a separate slice.)
7. **Category and `×` replace the history entry; *Send to kitchen* and *Settle*
   still push.** Back after a `×` does not put the line back. Tested.
8. **All 853 existing tests still pass**, with none deleted or weakened. Any
   test that changes to follow a renamed selector or element is listed in your
   handoff with its reason.
9. **Verify in a browser**, and say what you did. At minimum: press Discount on
   `overflow` and read the panel beside the picker; tap two different pending
   rows and read the two titles; press a category on `overflow` and confirm the
   order is still there.
10. **`npm run verify` passes.** State the new test and file counts. Typecheck
    clean.

**Prove at least one guard red by injecting the defect it claims to catch**, and
say which and what failed. The lead will do the same independently.

---

## Out of scope

- **The menu tile's opener.** Held, with the reason above.
- **Recomputing the panel's totals when a discount is applied.** `orderTotals`
  is pure and already builds `zero` and `sheet-remove-freeform`, so this is
  tempting and it is a behaviour change, not an opener fix. **Raise it if you
  think it belongs; do not take it.**
- `error`, `fireerror`, `fireblocked`, the 86'd line in the panel — F2h.
- `quick`, `quick-line` — F2d.
- **Focus trapping and the stacked scrims.** Carried findings from FE-005,
  FE-007, FE-008 and FE-009 — four slices running. Real, not acceptable at ship,
  and not this slice. Mention them if you touch anything near them.
- Any new screen or visual state beyond the one order state criterion 3 needs.

---

## Handoff

Name the command and the URL the owner opens, and what to press to see each
fix. List every test you modified and why. List anything you held and why.

**Raise judgement calls rather than taking them.** Every slice so far has found
a task file of this lead's wrong where a reviewed document was right — seven in
a row, and this file was written from reading `apps/pos/src`, which makes it
*more* specific and no more authoritative. **Where this file disagrees with
`docs/BOUNDARIES.md`, the PRD, `SITEMAP.md` or `SCREEN-INVENTORY.md`, those win
and this file is the defect.**

The lead verifies with `git log`, a browser, and by injecting the defects your
tests claim to catch — including by checking that the tests which already
existed still fail when they should.
