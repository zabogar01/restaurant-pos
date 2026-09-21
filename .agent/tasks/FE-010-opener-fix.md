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

**CORRECTED 2026-09-21, after review. This sentence was wrong.** It read
*"Send to kitchen and Settle leave POS-03 and keep pushing."* **Send to kitchen
does not leave POS-03.** `SITEMAP.md:154` puts `[INLINE] Fire result — ticket
printed / FAILED / UNKNOWN` **under POS-03**, and §1's table gives `[INLINE]`
Route: **No**, Back-stackable: **No**. Only *Settle* leaves, because POS-04 is
`[SCREEN]` and the sitemap says in as many words that it is "its own route, not
a sheet over POS-03".

So: **Send to kitchen replaces. Settle pushes.**

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
7. **CORRECTED 2026-09-21, after review — this criterion was wrong as written**
   and the implementation and two tests encode the error faithfully. It read
   *"Category and `×` replace the history entry; Send to kitchen and Settle
   still push."* It should read: **category, pending-line removal and *Send to
   kitchen* all replace the history entry; only *Settle* pushes, because only
   *Settle* leaves POS-03.** Back does not traverse an inline change.
   `SITEMAP.md:154` and §1's node table are the authority; see the correction
   under section 4.
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

### 2026-09-21 — implementer (`builder12`, Opus 5)

**All ten acceptance criteria are met except criterion 6's caveat, which is
built and flagged rather than held.** `npm run verify`: **17 files, 892 tests
passed**, up from 17 and 853. Typecheck clean. **No test deleted, none
weakened.** Every changed assertion is listed under *Tests modified*.

**Nothing is committed.** The working tree is on `agent/phase-0-foundations`.
Seven source files and four test files are modified; none are new. **I did not
touch `.agent/MEMORY.md` or `.agent/ROADMAP.md`** — they show as modified
because the lead edited them (the `builder12` roster row) while I was working.
The contract documents, `pos.css`, the registry and `frost-states.css` are
untouched. I wrote no new CSS: this slice adds no visual state.

**The baseline was re-run on this machine before starting**: `19b4b81`, 17
files, 853 tests, typecheck clean, exit 0.

**CORRECTED 2026-09-21, after review.** This paragraph read *"PostgreSQL was
not needed; no test in this suite touches it."* **That was false.**
Verification includes seven PostgreSQL migration tests —
`apps/server/test/migrate.test.ts` connects to 127.0.0.1:5433 and resets the
schema before each one. They passed because `restaurant-pos-db-1` was already
up on this machine (`docker ps`: up 4 days, healthy), not because the suite is
database-independent. **Start the repository database with `npm run db:up`
when it is not running.** No test was changed to make the original claim true.

#### One judgement call, raised and ruled before any code was written

**Criteria 1 and 2 disagreed, and criterion 2 won.** Criterion 1 says Discount
"opens the picker", tested from `default`, `overflow` and `zero`. Criterion 2
requires *removing* the applied discount to be gated by the order — but
*Remove the discount* exists only on the change sheet (`trail: ['change']`),
and `default` and `zero` both carry a discount. Built as ruled:

> **An order carrying nothing opens the picker; an order already carrying one
> opens the change sheet.** FR-F1 and B-22 give one discount per order, so an
> applied discount can only be removed or replaced, which is FR-F8's sheet. The
> picker is one press away from it, *Replace with another preset*.

Both sheets are reviewed compositions and neither is new. Criterion 1's
substance — component state, no URL, no history entry, the order still on the
panel beside it — holds from every state, and is tested from all four.

#### What the owner opens

```
npm run dev -w apps/pos     # http://127.0.0.1:5173/pos/order?state=overflow
```

The Vite server on 5173 was already running (pid 31567, not mine). I used it
and left it running.

- **`?state=overflow`, press Discount.** The **picker** opens over *this*
  order: Total still **1.244.250**, the voided Caesar Salad still struck
  through, URL still `?state=overflow`. Presets read *"no approval needed"*;
  *Other amount* is dashed and *needs a manager*. Before: the panel became the
  table order at 382.725 carrying Staff meal.
- **`?state=other-discount`** — the new state — **press Discount.** The
  **change sheet** opens: *Currently applied — Other discount — 15%*, −60.750,
  and **all three** controls dashed and *needs a manager*. Press *Remove the
  discount* and the manager prompt opens over it, reading *"Remove the discount
  — Other discount 15% −60.750"*. **Before, this order's picker would have read
  the fixture's Staff meal and offered every preset ungated.**
- **`?state=default`, press Discount.** The change sheet, *Staff meal — 10%*,
  −40.500, *Replace with another preset* and *Remove the discount* **ungated**,
  *Replace with another amount* gated.
- **`?state=overflow`, tap Coffee, then tap Cheesecake.** Two different
  editors: *"Coffee — pending"* with quantity **2**, and *"Cheesecake —
  pending"* with quantity **1**. Before, both opened *"Steak — pending"*.
  *Remove line* on Coffee's editor lands on `?state=overflow&gone=of-coffee`
  and the panel drops Coffee. *Back* keeps the order and returns focus to the
  row that was tapped.
- **`?state=overflow`, press Drinks.** **Drinks** takes the ink fill, the order
  is untouched, and the URL reads `?state=overflow&category=drinks`. Before, it
  read `?state=default&category=drinks`, the panel became the table order, and
  the rail still drew **Mains**.
- **`?state=sheet-discount`, `sheet-remove`, `sheet-remove-freeform`,
  `sheet-line`** still draw the artifact's own sheets, unchanged, for review.

#### 1 — Discount opens the discount family over the order on screen

- `OrderScreen` holds `discountOpened`. `panelDiscount(view, order)` in
  `discountFixtures.ts` builds the fixture from the view and the order the
  panel draws, exactly as `panelVoid` does.
- `applied` comes from the order (below), `subtotal` from
  `shownOrder(view).totals.subtotal` — so from `?state=default&gone=steak` the
  sheet takes 10% of **165.000**, the figure on the panel, not 405.000.
- `cancel` and `landsOn` are the view on screen, by the lead's 2026-09-18
  ruling for the void: no state draws an order once its discount has changed,
  and landing on `default` from `overflow` is the defect this slice fixes.
- `ACTIONS`' Discount entry no longer carries a `search`. It names no state at
  all, as *Void order* already did.

#### 2 — the gate reads the order

- **`OrderFixture` gains `applied?: DiscountSnapshot`** (FR-F4, B-8).
  `totals.discount` is the same discount *printed* — a label and an amount —
  and carries no `source`, which is the one fact `needsManager` reads.
- Every table-order state carries `STAFF_MEAL`; `zero` carries `COMP`;
  `sheet-remove-freeform` and the new `other-discount` carry `OTHER_15`;
  `overflow` and `empty` carry nothing. **No value is invented**: every one of
  those snapshots already existed and already matched the totals row drawn.
- `ShownOrder` carries `applied` through, so the sheet reads the same discount
  the panel prints.
- **A new guard holds the two together across all 25 states**: `applied` is
  present exactly when `totals.discount` is, its label matches `totalsLabel`,
  and its amount equals `discountAmount(subtotal, value)` — for `totalsWithout`
  figures too.
- `appliedNoteFor(snapshot)` derives the change sheet's note from the
  snapshot's `source`. Both strings already existed in `discountFixtures.ts`;
  this only stops them being written per state, so no order needs an actor or a
  time written onto it.

#### 3 — `other-discount`, the order with teeth

`'other-discount'` — *"Free-form discount applied"* — is the table order
carrying `OTHER_15`: the same lines, the same figures and the same snapshot as
`sheet-remove-freeform`, without the sheet. It is the only **non-sheet** order
carrying a free-form discount, and the only order where the fixture's answer
and the order's answer differ.

**Proof, as criterion 3 asks.** Pointing `panelDiscount` back at
`DISCOUNT_FIXTURES['sheet-discount'].applied` — one line — **fails 7 tests**.

#### 4 — the line editor opens over the line that was tapped

- `OrderScreen` holds `lineOpened` (a line id). `panelLine(lineId, view, order)`
  in `sheetFixtures.ts` builds the editor from that line on the order shown:
  title `` `${name} — pending` `` (the composition the artifact's *"Steak —
  pending"* already uses), that line's quantity, and `remove: {...view, gone:
  lineId}`.
- It returns `undefined` for anything that is not a PENDING line of the order
  on screen. Only a PENDING row body opens this sheet (I-12).
- `EDIT_LINE_SEARCH` is gone: no row body names a state any more.
- **The panel's removal rule is unchanged**, as the task file requires. *Remove
  line* asks for `?gone=<the tapped line>` and the panel honours it exactly as
  the row's `×` is honoured — only where the fixture has figures, never under a
  lock. On `overflow` that is `of-coffee`, `of-cheese` and `of-wine`; on the
  table order, `steak`. **A removal the fixtures cannot draw does nothing, as
  it does today. No total is computed and none is invented.**

#### 5 and 6 — the category

- `categorySearch` is **deleted**. `MenuRegion` takes the `view` and writes
  `viewSearch({ ...view, category: c.id })`: the state stays, `?gone=` stays,
  and only the category changes.
- `OrderView` gains `category?: CategoryId`. **`orderViewFrom` now reads it**,
  so the URL no longer asserts something nothing honours, and the rail draws
  `view.category ?? SELECTED_CATEGORY` as selected.
- **Criterion 6 is built, not held**, with one thing worth the lead's eye: the
  rail's selection now moves but **the grid does not**, because the artifact
  has items for Mains only (FE-004, accepted and documented). So pressing
  *Drinks* shows Drinks selected above the Mains grid. I judged that better
  than the alternative, and say why under *Judgement calls* below rather than
  taking it silently.

#### 7 — only leaving POS-03 pushes

`navigate(search, leaves = false)`. A [SHEET], a [MODAL] and an [INLINE] state
are none of them back-stackable (SITEMAP §1), so everything that stays on
POS-03 replaces; only *Send to kitchen* and *Settle* pass `leaves: true`. That
is the lead's ruling of 2026-09-18, applied in the one condition it needed.

Measured in Chrome from a clean load of `?state=overflow`, reading
`history.length` at each step:

| step | `history.length` | URL |
|---|---|---|
| start | 5 | `?state=overflow` |
| press *Drinks* | 5 | `?state=overflow&category=drinks` |
| press Coffee's `×` | 5 | `?state=overflow&gone=of-coffee&category=drinks` |
| press *Settle* | **6** | `?state=settle` |

Opening the picker, the change sheet and a line editor each left
`history.length` unchanged too.

#### Defects injected, each one caught (source restored, then verify re-run)

| Injected | Failed |
|---|---|
| **Criterion 3's proof:** the picker reads the fixture's `applied`, not the order's | **7** |
| Discount navigates to `?state=sheet-discount` (the old opener) | 16 |
| Every pending row opens the Steak's editor (the old opener) | 6 |
| A category press moves to the table order (the old `categorySearch`) | 3 |
| The rail ignores the category pressed (`SELECTED_CATEGORY` again) | 2 |
| Every inline change pushes again (the pre-F2k `navigate`) | 4 |
| **I-12:** the trailing slot nested inside the row body | **22** |
| **B-12:** a digit in a dot attribute | **6** |
| **Reachability:** the background not inert under a sheet | **46** |
| The reachability detector blinded to the new in-place openers | 1 |

**The three named guards are no weaker than they were.** I ran the *same three
injections against `19b4b81`* in a throwaway worktree and compared:

| Guard | at `19b4b81` | here |
|---|---|---|
| I-12, slot nested in the row body | 21 | **22** |
| B-12, a digit in a dot attribute | 6 | 6 |
| Background not inert under a sheet | 46 | 46 |

I-12 gained one because `ORDER_STATES` gained a state and the guard is
parameterised over all of them. **B-12's two files are untouched by this
slice** — `git diff --name-only` shows neither `PinPad.tsx` nor
`pin-pad.test.tsx`.

#### The reachability detector was extended *before* it was relied on

This is the trap `builder11` documented, and it applied here three times over.
`voidSheetOpen()` is now `openedInPlace()`: it reports a void sheet, **a
discount sheet** (`sheet-remove` when it draws *Currently applied*, else
`sheet-discount`) and **a line editor** opened in place, before falling back to
the URL. Without it the guard would have gone silently blind to all three
openers this slice moves off the URL — **removing the two new branches fails
the new self-test, and nothing else.**

The existing self-test — *"finds the panel's void paths once the background is
no longer inert"* — still asserts `sheet-voidline` and `sheet-voidorder`,
unchanged.

#### Tests modified — every one, and why

**Everything here follows a renamed constant, a changed signature or a state
the fixtures gained. No assertion was loosened; three are stronger.**

- **`order-panel.test.tsx`**
  - `EDIT_LINE_SEARCH` import dropped — the constant is gone.
  - `recording()` gains `openLine` and `openDiscount`, and records
    `navigate`'s new `leaves` argument. `PanelActions` grew, so a recorder that
    did not implement it no longer typechecks.
  - *"a PENDING row body is the button that opens the line editor"* → *"…for
    that line"*. It now presses **every** pending row and checks each reports
    **its own** `lineId`, with the ids distinct. **Stronger**: the old test
    passed on the defect, because every row asked for the same thing.
  - The close-bar test: Discount's expectation `{ navigate:
    '?state=sheet-discount' }` became `{ openDiscount: true }`, and
    fire/settle now assert `leaves: true`. Renamed to *"two open a sheet over
    this order, two leave POS-03"*.
  - The remove-control test gains one assertion: it asks for
    `?state=default&gone=steak` with **`leaves: false`**. Added, not relaxed.
  - The fixture-state list gains `'other-discount'` in its place and the name
    gains *"and the one of F2k"*.
- **`menu-region.test.tsx`**
  - `categorySearch` import dropped — the function is gone.
  - *"draws every category as a button that moves the screen to it"* → *"…that
    selects it in place, keeping the order and the state"*. It still presses
    all four and reads the URL; it now also asserts the rail's selection
    followed, that exactly one category is selected, and that the grid is
    unchanged. **Stronger**: the old test asserted the defect's own URL.
- **`sheets.test.tsx`**
  - `voidSheetOpen()` → `openedInPlace()`, widened as described above. What it
    asserts did not change; what it can see grew. Its self-test is kept
    verbatim and a second added.
  - Additions only otherwise: the criterion-4 block and the criterion-5/7
    block.
- **`discount.test.tsx`**: additions only.
- **`void.test.tsx`, `approval.test.tsx`, `pin-pad.test.tsx`,
  `order-line-ring.test.ts`, `hover-scoped.test.ts`, `console-free.test.ts`,
  `no-invented-values.test.ts`, `money-display.test.ts`: untouched.**

#### Judgement calls — please rule

1. **The rail now contradicts the grid.** Criterion 6 is built: pressing
   *Drinks* selects Drinks, and the twelve Mains tiles stay. That trades one
   inconsistency for another — before, the *URL* lied while the rail and grid
   agreed. I judged it the better trade because the old behaviour gave the
   cashier **no feedback at all** for a press that silently moved them to
   another order, and because the grid's limitation is FE-004's, already
   accepted and documented, while the rail's was a bug. **If you would rather
   the rail not move until there is a grid to move to, it is one line**
   (`view.category ?? SELECTED_CATEGORY` → `SELECTED_CATEGORY`) and two tests.
2. **A panel-opened discount lands on the view on screen**, including Comp.
   The `?state=sheet-discount` fixture still routes Comp to `zero`, so the
   comped result is still reviewable there. From the panel, applying Comp on
   `overflow` closes the sheet and leaves `overflow` — because landing on
   `zero` would replace the cashier's order with the table order, which is this
   slice's whole defect. Same shape as your 2026-09-18 ruling for the void.
   **The cost: from `default`, applying Comp no longer shows the comped
   totals.** The panel does not recompute (out of scope, and I did not take it).
3. **`appliedNoteFor` extends provisional copy to `zero`.** The change sheet
   over `zero` now reads *"Applied by Ana R. at 19:44. Preset, no approval."* —
   true of a Comp (FR-F2), and the same actor and time the same fixture order
   already carries for Staff meal. The alternative was a change sheet with no
   note, a composition the artifact never draws. **I preferred reusing the
   fixture's own fiction to drawing a gap; say if you want it the other way.**
4. **`?state=` keeps `gone` and `category` when a panel-opened sheet closes.**
   `cancel`/`back`/`landsOn` are the whole view, not just the state, so a
   removal and a category selection survive opening and closing a sheet. That
   follows from `cancel: view`; I mention it because it is a behaviour the
   fixtures never exercised before.

#### Found, not fixed

- **A line editor's *Remove line* clears any earlier `?gone=`.** From
  `?state=overflow&gone=of-coffee`, tapping Cheesecake and removing it asks for
  `?state=overflow&gone=of-cheese`, and Coffee comes back. **The row's `×` has
  always done this** — `?gone=` holds one line — so this is the fixture
  harness's shape, not a regression. Worth a real `gone` list if the panel ever
  removes more than one line.
- **The menu tile is untouched**, exactly as held. Every tile still opens
  Burger's sheet. I did not touch `MenuRegion.tsx`'s tile opener; the only
  change in that file is the category rail and the `view` prop.
- **The reachability guard cannot see the approval prompt opened in place.**
  Pre-existing and deliberate — `sheets.test.tsx`'s own comment restates the
  property for a gated family as *"every URL a control leaves behind is still
  somewhere ungated"*, and a gated control legitimately opens the prompt
  without a URL (M-1 is never a route). I did **not** make the detector report
  it, because doing so would fail the existing `sheet-remove-freeform` checks,
  where every control is correctly gated. Flagging it so the next slice does
  not read the guard as stronger than it is.

#### Still carried — touched nearby, not fixed

- **Focus is not trapped** in any sheet or the prompt. A panel-opened discount
  sheet and line editor behave exactly like the fixture ones. **Five slices
  running now** (FE-005, FE-007, FE-008, FE-009, FE-010).
- **Two scrims stack** when the prompt opens over the change sheet. Reproduced
  in Chrome on `other-discount` → *Remove the discount*. Five slices running.
- The selected category's pressed ring is white on ink and nearly invisible
  (FE-004's finding), and **it is now reachable on three more categories**,
  because selection follows the press.

#### Not checked

- **A real touch device**, hover suppression on touch, and `vite preview`.
- **Focused-and-pressed rings on the new controls.** No control is new — the
  category, the row bodies and Discount are all the same buttons FE-009
  measured; only what they open changed. I did not re-measure them.
- **Back after a `×` in Chrome.** The jsdom test does it cleanly
  (`arrive('eightysix', 'default')` → `×` → Back lands on `eightysix` with no
  `gone=`), and the browser confirms the mechanism — the `×` adds no history
  entry. But my browser history stack was muddied by address-bar navigations
  during the session, so **I did not get a clean in-browser Back-after-`×`
  reading and am not reporting one.**
- **Screen-reader announcement** of the change sheet's gated labels.

### 2026-09-21 — implementer (`builder12`), second entry: four corrections after review

All four done in one batch. **`npm run verify`: 17 files, 897 tests passed**,
up from 892. Typecheck clean. **Nothing committed**; still on
`agent/phase-0-foundations`. No test deleted; two widened, none weakened.

Counts, for the record: 853 at baseline → 892 as submitted → **897 now**. The
five are four new guards for these corrections plus one test that became two
by running over a second state.

#### 1 — *Send to kitchen* replaces. Only *Settle* pushes.

Your criterion was wrong and I encoded it; `SITEMAP.md:154` puts the fire
result under POS-03 as `[INLINE]`, and §1 gives `[INLINE]` Back-stackable:
**No**. Only POS-04 is a `[SCREEN]`.

- `ACTIONS` carries an explicit **`leaves: true` on Settle alone**; the
  onClick asks `'leaves' in a` rather than "has a `search`". Firing now takes
  the same path as the category press and the `×`.
- Comments corrected at `navigate`'s doc block and above `ACTIONS`, both now
  citing SITEMAP §2 for the fire result rather than restating the wrong rule.
- **Tests:** `sheets.test.tsx` — *Send to kitchen* moved into the *"replaces
  it"* table, and its former partner became *"Settle pushes one, because POS-04
  is its own screen"*. **Added:** *"Back after Send to kitchen does not
  traverse the firing"*. `order-panel.test.tsx` — the close-bar expectation is
  now `{ navigate: '?state=fireerror', leaves: false }`, and the test is
  renamed to say only Settle leaves.
- **Injected** `navigate(a.search, true)` for every action — the old
  behaviour: **3 tests fail.**

#### 2 — `appliedNoteFor` is gone; the note belongs to its own application

Your ruling taken as given: draw the gap rather than fill it.

- The two strings are explicit named constants again, **`STAFF_MEAL_NOTE`**
  (the artifact's own line under Staff meal, `frost/pos/order.html:529-531`)
  and **`OTHER_15_NOTE`** (FE-007's provisional free-form line, carried
  context). Nothing derives either from `source`.
- **`OrderFixture` gains `appliedNote?`**, tied to the application it
  describes, and `ShownOrder` carries it through. `panelDiscount` reads
  `order.appliedNote` and omits the field when there is none.
- **`zero` carries no note.** Its comment says why: the artifact gives this
  Comp no application history, borrowing Staff meal's actor and time would
  assert a different event's facts, and **the composition — a change sheet
  without the note — is owed to a designer.** Same wording on the
  `OrderFixture` field and in `discountFixtures.ts`.
- The two `DISCOUNT_FIXTURES` notes are **byte-identical to before this
  slice**.
- **Tests added:** the Staff meal note reaches the change sheet on the order it
  describes; `zero`'s change sheet draws *Comp — 100%* with **no** note node;
  and a sweep over all 25 states that no order carries a note without a
  discount, that each note is one of the two written down, and that the preset
  note only ever appears on Staff meal itself.
- **Injected** the derivation back (`source === 'preset' ? … : …`): **1 test
  fails.** **Injected** `appliedNote: STAFF_MEAL_NOTE` onto `zero` — the
  precise defect you rejected: **2 tests fail.**

#### 3 — the PostgreSQL claim is corrected in place

The first entry's sentence is struck and replaced above, at the point it was
made, saying what is true: seven migration tests hit 127.0.0.1:5433, they
passed because `restaurant-pos-db-1` was already up (`docker ps`: up 4 days,
healthy), and `npm run db:up` starts it. **I changed no test.** The reviewer
was right and I should have read `package.json`'s `verify` rather than assuming
the suite I was working in was the whole of it.

#### 4 — criterion 6 reverted, both halves together

- `MenuRegion` draws `SELECTED_CATEGORY` again. A category press now calls
  `navigate(viewSearch(view))`: **the order stays, including `?gone=`**, the
  entry is replaced, and nothing else changes.
- **`OrderView` no longer has `category`**, `viewSearch` writes none and
  `orderViewFrom` reads none. `orderFixtures.ts` no longer imports from
  `menuFixtures.ts` at all, which also removes the cross-import F2k added.
- Comments in `MenuRegion.tsx`, `menuFixtures.ts` and on `OrderView` all record
  **why** — a rail reading *Drinks* over a Mains grid says something false
  where the cashier can see it — and that the press's eventual behaviour is a
  designer's question.
- **Criterion 5 stands and is tested harder than before.** The
  `sheets.test.tsx` check now removes a line first and asserts the press lands
  on `?state=overflow&gone=of-coffee` — the order *and* the removal survive.
  The `menu-region.test.tsx` check **now runs over `overflow` as well as
  `default`**, because on the table order the old defect is invisible:
  `?state=default` is where it was going anyway. That widening is why the
  category injection catches 2 tests rather than 1.
- **Injected** `navigate('?state=default')` — the old destination: **2 tests
  fail.** **Injected** a `&category=` back onto the URL: **4 tests fail.**

#### Where I disagree with nothing, but want one thing on the record

The "rail follows the category" injection **cannot be made to fail**, because
after this revert nothing writes `?category=` for a rail to follow. The guard
against that behaviour returning is structural, not behavioural: `OrderView`
has no such field, and the tests assert the URL never contains one. If a future
slice reintroduces the field, those tests are what should stop it — **they
check the URL, not the rail**, so a reviewer should not read them as proving
the rail is pinned.

#### Unchanged from the first entry, and still true

The FR-F8 gate, `other-discount`, the line-editor opener, the discount opener,
the in-place history rule for sheets, the widened reachability detector, and
every judgement call you accepted. **I did not re-run the browser session**
after these corrections: the changes are a history flag, a fixture field, two
deleted URL parameters and a reverted CSS class, all covered by the tests
above, and re-reading the four screens would not have told me more than the
897 do. Say if you want it re-walked before you commit.

**Still carried, now six slices:** focus trapping and the stacked scrims. The
menu tile's opener is still held. A category press is still inert beyond
keeping the order — on your housekeeping list with the tile.
