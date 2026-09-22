# FE-014 — The order store: one mutable order behind POS-03 (FS)

**Status:** Ready, unassigned. Written 2026-09-22 by `lead`.
**Roadmap item:** FS — the flow spine. Inserted **before F3** at the owner's
direction, 2026-09-22.
**Branch:** `agent/phase-0-foundations`
**Model:** Sonnet (owner's model policy, 2026-09-22).
**Baseline:** `1aeba7b`, **1136 tests across 19 files**, typecheck clean
(lead-verified 2026-09-22, by running it). **Re-run it before you start and
state what you got.** The suite includes seven PostgreSQL migration tests, so
run `npm run db:up` first if `restaurant-pos-db-1` is not up.

---

## Why this slice exists

The owner asked when the frontend would have a working flow rather than a
preview. The honest answer was: nothing in the queue produced one. Eleven slices
built POS-03's twenty-seven states faithfully, and **every one of them is a
fixture selected by `?state=`**. Tapping a tile does not add a line; it navigates
to a different pre-written order. `orderFixtures.ts` says so in its own header:
*"Nothing is computed here: every total is the artifact's own figure."*

That was the right trade while the question was *does the screen look and behave
right*. It is the wrong one now that the question is *does the screen work*.

**This slice gives POS-03 one mutable order.** Add a line and it appears. Change
its quantity and the total moves. Remove it and it goes. No backend, no
persistence, no login — refresh and it resets to the fixture. That limit is
deliberate and is not a defect to fix here.

---

## The seam is `shownOrder` — but there are TWO derivations, not one

> **CORRECTED 2026-09-22 by `lead`, after `builder16` refused to build on the
> original claim.** This section first said *"every consumer already reads
> `shownOrder`'s result and nothing else"*. **That is false.** `builder16` read
> the code instead of the task file, found it, and stopped before writing
> anything. The ninth task-file error an implementer has caught, and the
> correction is below. The acceptance criteria are unchanged.

`voidFixtures.ts:120` funnels **the sheets** through one function:

```ts
export function shownOrder({ state, gone }: OrderView): ShownOrder
```

**The panel does not use it.** `OrderPanel` takes `view`, reads
`ORDER_FIXTURES[view.state]` at `:181`, and re-derives the order itself at
`:187-191` — the `?gone=` guard, the totals pick and the group filter are a
duplicate of `shownOrder`'s body. `OrderScreen` computes `order =
shownOrder(view)` at `:73` and hands it only to the sheets.

So the screen has **two implementations of one derivation**, and a store placed
behind `shownOrder` alone would change the sheets while the panel — lines,
quantities, count, totals — kept drawing the static fixture.

### The ruling: collapse them to one, without breaking the safety property

Give `OrderPanel` the order as an **optional** prop, defaulting to the current
derivation, and delete the duplicate body:

```ts
export function OrderPanel({
  view,
  order = shownOrder(view),
  actions = NO_ACTIONS,
}: { view: OrderView; order?: ShownOrder; actions?: PanelActions })
```

**Optional is not a style choice.** `test/order-panel.test.tsx:41` renders
`<OrderPanel view={…} actions={…} />` directly with no order; every other test
file mounts `<OrderScreen view={…} />`. A **required** prop breaks that file and
puts you in the position of editing tests to fit the store — which this task
forbids, and which would destroy the one property the whole review rests on.
Optional with that default keeps all 1136 green while `OrderScreen` hands down
the store's order.

### Two reads that stay on the fixture, so the slice stays honest

- `ORDER_FIXTURES[view.state].incident` (`:140-141`) is the **emergency banner**,
  application-wide (`FR-E3`), not order data. Leave it.
- `MENU_FIXTURES[view.state].eightySixed` (`:211`) is the **menu's** fact, not the
  order's — the back office's toggle lands there (`FR-C6`). Leave it. `fire.ts`
  must keep taking the order's lines and the menu's 86 list as two separate
  inputs; that separation is what F2h built and what makes the refusal resolve.

**`ShownOrder` keeps its shape.** If you find yourself widening that type so
components can reach into the store, stop — the gate modules must keep receiving
a plain order and answering from it alone. A rule that starts reading store
internals is how a gate ends up correct only in the state the artifact happens to
draw, which is the failure F2i and F2j were built to avoid.

### What the store holds

Seeded from `ORDER_FIXTURES[view.state]`, then mutated in place:

- the `title` and the `type` (`table` / `quick_sale`, `FR-D2`)
- the round `groups`, including the PENDING group
- the `applied` discount snapshot and its `appliedNote`, **carried unchanged**

It does **not** hold `totals`. Totals are derived — see below.

### Totals are computed, never stored

`discount.ts:108` already has the engine, and F2i built it against the artifact's
own figures:

```ts
export function orderTotals(subtotal: Money, discount?: DiscountSnapshot): Totals
```

Subtotal is the sum of the non-voided lines' `amount`. Service charge, tax and
the discount adjustment all fall out of `orderTotals`. **Write no arithmetic of
your own.** If a figure cannot be reached through `orderTotals` and `@pos/money`,
raise it rather than computing it inline.

---

## The safety property, and it is the whole review

**All 1136 existing tests must pass, unchanged.** Not adjusted, not loosened, not
deleted. Every one of them asserts that a fixture state renders the artifact's
own reviewed figures, so together they are a byte-level proof that **an
unmutated store reproduces the fixture exactly**.

If a test needs changing to accommodate the store, that is a signal the store is
wrong, not that the test is stale. Two exceptions you may take, and only these:

1. A test may be **added**.
2. A test that reaches for `ORDER_FIXTURES[state].totals` as its *expected* value
   may read the same figure from wherever it now lives, **provided the figure is
   identical**. Say so in the handoff, per test, with the figure.

Anything else is a conversation with the lead before you write it.

---

## What mutates in this slice

Four mutations. Each has a control that already exists on screen and currently
does nothing or navigates to a fixture.

| # | Mutation | The control today | After |
|---|---|---|---|
| 1 | **Add a line** | The item sheet's confirm (M-2, reached from any tile) navigates to a fixture | Appends a PENDING line for the item, with its quantity and modifiers, to the PENDING group |
| 2 | **Change quantity** | ~~The line editor's save (M-5) navigates to a fixture~~ **There is no save control — see the correction below** | `setQuantity` exists on the store and is tested against it. **No UI is wired to it in this slice** |
| 3 | **Remove a line** | The PENDING row's `×` writes `?gone=<id>` and the panel honours it only where the fixture pre-figured `totalsWithout` | Drops that line from the store outright, for **any** pending line |
| 4 | **Seed from `?gone=`** | — | `?gone=<id>` seeds the store with that line already removed, so every existing state and test still resolves |

**A line's `amount` is `quantity × item price + modifier deltas`.** All three
inputs are sourced: `MENU_ITEMS` (`menuFixtures.ts:26-39`) carries id, name and
price for all twelve items, and the modifier deltas are the item sheet's own.
Nothing here is invented.

**Every new line carries `itemId`.** `OrderLine.itemId` is optional because
`overflow` holds a Cheesecake the grid does not sell, but a line the grid created
always knows its item — and `fire.ts` reads `itemId` to decide whether a PENDING
line holds an 86'd item (`FR-E4`). A line added without one is a line that can
never block a fire. **The review of F2 carried this exact warning forward**: *"a
missing tile does not establish availability"*, and it must not be promoted into
a guarantee. Here it goes the other way — the store can always supply it, so it
must.

---

## What does NOT mutate, and why each one is held

Do not build these. Each is held for a stated reason, and **each reason is
someone else's decision, not a scoping convenience.**

- **Fire.** *Send to kitchen* keeps doing nothing visibly. Firing produces a new
  round with a **time** and a **delivery outcome**, and `RoundGroup` requires
  both (`firedAt: string`, `printed: boolean`). This app has no clock and the
  artifact draws no fired-round composition, so minting them invents data. Held
  on the lead's housekeeping as a designer's question since F2h; this slice does
  not resolve it. **The fire control's availability must keep reading `fire.ts`
  against the store's lines** — so removing an 86'd line still clears the
  refusal, now for real rather than through `totalsWithout`.
- **Discount.** The sheets keep behaving as they do today. The store **carries**
  a seeded `applied` snapshot and `orderTotals` figures it correctly, but nothing
  changes it. Mutating a discount runs through `needsManager` (`FR-F8`), and
  where that returns true it raises a manager approval that has no backend to
  resolve it. Faking that resolution would fake an authentication. Next slice.
- **Void.** Gated, audited, and writes a cancellation ticket (`FR-H4`, `B-16`).
  Backend territory.
- **Settle.** POS-04 does not exist yet. That is F3.
- **Persistence.** No `localStorage`, no session, no server. Refresh resets to
  the fixture, and that is the honest state of this application.

---

## Acceptance criteria

Each names the case that makes a right answer differ from a wrong one. **That is
deliberate.** This project has now recorded three times that a criterion phrased
as *"prove it red"* is satisfiable without being met, and then walked into the
trap a fourth time while writing the slice that fixed the second one. A
criterion whose right and wrong answers coincide in every case available to it
has not been tested.

1. **An unmutated store is the fixture.** For **every** state in `ORDER_STATES`,
   the screen with no interaction renders identically to the baseline. The 1136
   tests are this criterion; they must pass untouched.

2. **Adding a line moves the total, and moves it to the artifact's own figure.**
   On `quick` (subtotal 165.000), add a Soda (`MENU_ITEMS` price 30.000): the
   subtotal must read 195.000, with service charge and tax from `orderTotals`.
   **The red case:** a store that appends the line but keeps the fixture's stored
   `totals` renders 165.000 with three lines. Prove it by doing exactly that and
   watching the test fail.

3. **Removal is computed, and it agrees with the artifact.** Remove the Steak on
   `default`: the computed totals must equal `tableTotalsWithout.steak` —
   **the artifact's own reviewed figure, asserted field by field.** This is the
   sharpest test in the slice: it proves the store's arithmetic against a figure a
   human reviewed, not against itself. Do the same for at least
   `quickTotalsWithout` and `overflowTotalsWithout`.
   **The red case:** change the service-charge rate or the rounding and watch
   these fail. A store that computes *some* total will pass a self-consistent
   test; only the artifact's figures catch a wrong one.

4. **Removal works where no fixture pre-figured it.** The old rule honoured
   `?gone=` only where `totalsWithout[id]` existed (`voidFixtures.ts:122`).
   Remove a PENDING line on a state that has **no** `totalsWithout` entry for it
   and the line must go and the total must be right.
   **The red case:** the old guard, left in place, silently ignores the removal —
   the line stays. Name the state you used.

5. **Quantity is a rewrite, not an append — tested against the store, not the UI.**

   > **CORRECTED 2026-09-22 by `lead`, after `builder16` raised it.** This
   > criterion assumed the line editor had a save control to drive it from.
   > **It has none.** `LineSheetFixture` (`sheetFixtures.ts:31-41`) carries
   > `back` and `remove` and no save target; `LineSheet` (`Sheets.tsx:183`)
   > holds the stepper's quantity in local `useState` and its own comment says
   > *"this fixture has no command to send it with, so the panel does not
   > follow"*. **Lead-verified in the reviewed artifact**
   > (`order.html:449-476`, both `sheet-line` and `quick-line`): the foot has
   > exactly `Back` and `Remove line`. Adding a Save button would invent a
   > composition the artifact never draws, which this task forbids.

   `setQuantity(lineId, n)` exists on the store and is tested **directly against
   the store**, with no UI control wired to it. Same shape as A9, which landed
   `--frost-invalid` and the round tag unused on purpose for a later slice.

   Changing a line's quantity from 2 to 3 must leave the order holding the same
   number of lines, with that line's `amount` recomputed from the unit price and
   its modifier deltas.
   **The red case:** a store that appends produces an extra line; a store that
   multiplies the existing `amount` rather than recomputing from the unit price
   gives the wrong figure the moment a modifier is involved. **Use a line with a
   modifier**, so those two implementations actually differ — the Burger on
   `quick` carries Large +20.000 and Extra cheese +15.000.

   **Do not wire it to anything.** Leave a comment at the mutator saying it has
   no caller and why, on the precedent of A7's `source: null`: an explicit
   absence beats an invented presence.

6. **A settlement lock still blocks everything.** Under both locks
   (`FR-G12`, `FR-G13`) the panel is read-only: no row is a control, every
   trailing slot is empty, and **no mutation is reachable**. The old rule got
   this free by refusing `?gone=` under a lock; the store must get it on purpose.
   **The red case:** seed a locked state with `?gone=` and assert the line is
   still there — a lock is not a place where a removal is merely hidden.

7. **The gates are unchanged and still read the order.** `fire.ts`,
   `discount.ts` and `void.ts` are untouched by this slice. Prove `fire.ts` still
   resolves against real mutation: on `fireblocked-overflow`, remove the 86'd
   Coffee through the store and *Send to kitchen* must come back **while
   Cheesecake and House Wine are still pending** — `FR-E4`'s second half, now
   through a real removal rather than a pre-figured one.
   **The red case:** point the fire rule at the fixture's lines instead of the
   store's and watch it keep refusing after the line is gone.

8. **`npm run verify` is green**, typecheck clean, and you state the test count.

---

## Do not invent

Same rule the last five slices ran under, and A7 set the precedent when its four
designed tokens took `source: null` — **explicit absence beats invented
presence**, and a `PROVISIONAL COPY` comment authorises nothing.

- No times, no round numbers, no print outcomes.
- No item not in `MENU_ITEMS`, no price not in it.
- No copy the artifact does not draw. The count label, the group heading and the
  line signatures all already have functions that produce them
  (`orderCountLabel`, `pendingGroupHeading`); a mutated order must flow through
  those, not around them. **An order reduced to one item must read `1 item`, not
  `1 items`** — check what the existing function does before writing anything.
- If a composition you need does not exist in the artifact, **stop and raise it.**
  Six of the last eight slices found one, and every one of them was worth more
  raised than filled.

---

## Read before you start

- `apps/pos/src/voidFixtures.ts:100-138` — `ShownOrder`, `shownOrder`, `linesOf`.
  The seam, and the `?gone=` rule you are replacing.
- `apps/pos/src/orderFixtures.ts:632-645` — `OrderView`, `viewSearch`,
  `orderViewFrom`. Note the recorded reason the rail's category is **not** in
  `OrderView`; do not put anything in there that nothing honours.
- `apps/pos/src/OrderPanel.tsx:66-178` — `OrderScreen`, `navigate`, and
  `PanelActions`. The three openers are already component state and already hand
  each sheet the order on screen (F2e, F2k). **Your mutations join that set; they
  do not become URLs.** SITEMAP §1: a `[SHEET]`, `[MODAL]` or `[INLINE]` state is
  not back-stackable.
- `apps/pos/src/discount.ts:108-120` — `orderTotals`.
- `apps/pos/src/menuFixtures.ts:26-43` — `MENU_ITEMS` and `ITEM_SEARCH`.
- `docs/BOUNDARIES.md` — **B-20** in particular: a rejected command leaves the
  order exactly as it was. The `error` state exists to draw that, and F2's review
  found *Try again* putting back a line the cashier had removed. A store makes
  that class of defect easier to write, not harder.

**Read the artifact from the design worktree**, not this branch:
`../restaurant-pos-design/docs/design/visual-directions/frost/pos/order.html`.
This branch's copy predates A7 and DESIGN-004's remediation.

---

## Handoff

Write your handoff into this file, in the section below, **before you report
done.** An empty handoff section is the cheapest signal this project has that a
task did not finish, and it has caught a silent failure once already — an
implementer went idle with source on disk and a passing suite, one step before
it wrote its tests.

State: what you built, the test count before and after, each red case you proved
and what failed when you proved it, every judgement call you made, and every
composition you had to raise rather than build.

`git log` is the check, not the handoff. Commit nothing unless the lead asks.

### Implementer handoff

**Baseline, re-run before starting:** `1aeba7b`, `npm run db:up` confirmed the
container already healthy, `npm run verify` → typecheck clean, **1136 tests
across 19 files**, matching the task file exactly.

**Two task-file errors found and raised before writing any code**, both
already corrected in this file by the lead and referenced above — not
repeating them here, only the outcome: `OrderPanel` now takes `order` as the
one seam, and `setQuantity` ships with no caller.

#### What was built

- `apps/pos/src/orderStore.ts` — `useOrderStore(view)`. Seeds once per mount
  from `ORDER_FIXTURES[view.state]` (dropping a `?gone=` line already in the
  URL, never under a lock, exactly as `shownOrder` drops it); never reseeds on
  a later `view.state` change, because nothing in this app moves the cashier
  to a different order mid-session — `sheet-item`, `eightysix`, `default` and
  the rest are all the same order reached by this project's `?state=` scheme,
  so a reseed on every state change would be a store that forgets an added
  line the moment "Add to order" navigates it to `eightysix`. A `useEffect`
  watches `view.gone` for a *later* change (the row's × pressed after the
  screen is already up) and drops that line from the live order, not a fresh
  seed — so the seed path and the live-click path are one piece of code.
  `addLine`, `removeLine`, `setQuantity` mutate `groups`; totals are never
  stored — `toShownOrder` runs `orderTotals` over the live lines on every
  read, per the task file.
- `OrderPanel.tsx`: `OrderPanel` now takes `order?: ShownOrder = shownOrder(view)`
  and reads `totals`/`groups`/`type` from it; the duplicated `?gone=`-and-
  `totalsWithout` derivation at the old `:187-191` is deleted. `lock`,
  `pressedLineId` and the emergency `incident` still read `ORDER_FIXTURES`
  directly — none of those three is order data. `OrderScreen` now builds
  `store = useOrderStore(view)` and hands `store.order` to `OrderPanel` and
  `store.addLine` to `SheetView`; the sheets and the void sheet keep reading
  the untouched `order = shownOrder(view)`, per the ruling.
- `sheetFixtures.ts`: `ItemSheetFixture` gained `itemId` (`'burger'` on the
  `burger` fixture) — the one new field a line the store creates needs, per
  the task's "every new line carries itemId."
- `Sheets.tsx`: `ItemSheet`'s *Add to order* now calls `addLine` (itemId,
  name, quantity 1, the chosen modifiers) before `go(sheet.add)`, which is
  unchanged (still lands on `eightysix`, the artifact's own routing) — the
  store persists across it, so the added line is there. **Judgement call:**
  which selections become `Modifier` entries. A priced size option is
  included only when its delta is non-zero (the artifact never shows "Regular"
  beside a Burger at its base price); every chosen extra is included at
  whatever delta it carries, including zero, on the same footing as the
  Steak's own no-delta "Medium rare." No fixture exercises a zero-delta extra
  chosen through the sheet, so this is a real judgement call, not a traced
  fact — flagging it rather than asserting it was obviously right.
- `apps/pos/test/order-store.test.tsx` — new, 11 tests, all added (exception 1
  of the safety property; no existing test was touched).

#### Test count

1136 → 1152 → **1216** (20 files), after the parity sweep below. Breakdown:
**11** from the first pass (`order-store.test.tsx`), **5** from this project's
own generic sweeps (`no-invented-values.test.ts`, `money-display.test.ts`)
automatically picking up the new `orderStore.ts` file — not written by me,
just triggered by adding a `.ts` file to `src/` — and **64** from the parity
sweep added after the browser walkthrough (below). `npm run verify`:
typecheck clean, all 1216 pass.

#### Each red case proved, and what failed

All proved by temporarily breaking the named line, running the specific test,
reading the failure, then reverting — none of these changes are in the diff.

1. **AC2** (`toShownOrder`'s `totals: orderTotals(subtotal, …)` → hardcoded
   `orderTotals(165_000n, …)`): `expected 165000n to be 195000n` — the line
   list grew to 3 but the total stayed the fixture's stale figure, exactly the
   case named.
2. **AC5, multiply-the-amount** (`amount: lineAmount(...)` →
   `l.amount * BigInt(quantity)`): `expected 405000n to be 335000n` — the
   naive multiply of 135.000 × 3 versus the correct recompute
   100.000 × 3 + 35.000.
3. **AC5, append-instead-of-rewrite** (`rewriteQuantity` changed to push a
   second line): `expected […] to have a length of 2 but got 3`.
4. **AC4** (`seed`'s `drop` guard reinstated with the old
   `fixture.totalsWithout?.[view.gone]` check): on `sheet-voidorder` with
   `gone: 'soda'` — `expected [burger, soda, steak] to deeply equal
   [burger, steak]` — soda silently stays, the exact old defect
   (`voidFixtures.ts:122`), on a line `totalsWithout` never figured.
5. **AC7** (`OrderPanel`'s `lines` derivation pointed at `fixture.groups`
   instead of `groups` from the `order` prop): on `fireblocked-overflow`,
   removing Coffee through the real × — `expected 'SPAN' to be 'BUTTON'` — the
   fire rule keeps refusing because it never saw the removal.

AC3 and AC6 aren't "prove it red" criteria in the same sense — they assert an
exact figure or an exact non-removal, and I did not fabricate a broken
implementation to fail them; they're proved by asserting `toEqual` against
`ORDER_FIXTURES[state].totalsWithout[...]` (AC3, for `default`/`steak`,
`overflow`/`of-coffee`, `quick`/`q-burger`) and against `ORDER_FIXTURES[...].totals`
under both locks (AC6) directly.

AC1 is the untouched 1136 (now embedded in the 1152), still passing byte for
byte.

#### Judgement calls

- New line ids: `${itemId}-${n}` from a per-mount counter (`nextId`, a
  `useRef`), never collides with a fixture's own hand-picked ids. Not asserted
  by any test — nothing in the acceptance criteria names a new line's id.
- `empty`'s bare `{ subtotal: 0n, total: 0n }` totals (no `serviceCharge`/
  `taxIncluded` keys) is the one fixture not built from `serviceAndTax` or
  `orderTotals`. Recomputing via `orderTotals(0n)` would add zero-value
  service/tax rows the fixture omits — but no existing test exercises `empty`
  through `OrderScreen` (only `order-panel.test.tsx`'s direct
  `<OrderPanel view={…} />`, which defaults to `shownOrder` and never touches
  the store), so this never surfaces and I did not special-case it. Flagging
  it: if a future slice drives an order down to empty through the store, the
  panel will show two zero-value rows the dedicated `empty` fixture doesn't.
  Not a defect in this slice — `orderTotals`'s own unconditional shape,
  applied as instructed ("write no arithmetic of your own") — but worth the
  lead's eyes.

#### Composition raised, not built

Recorded on the lead's own housekeeping already, restating for the record:
**the reviewed artifact draws a quantity stepper with no commit control on
either `sheet-line` or `quick-line`** (`order.html:449-476`, `Back` and
`Remove line` only) — FR-D5 and FR-M5 have no reachable path in the design as
it stands. Not this slice's to solve.

#### Follow-up after the lead's browser walkthrough found `empty` diverging

Two things done, per the ruling:

1. **Parity sweep added** to `order-store.test.tsx` (no existing test edited):
   for every state in `ORDER_STATES` with no `gone`, the store's initial order
   now asserts `toEqual(shownOrder({ state }))` — 27 cases, one failed before
   the fix below (`empty`), 26 passed on the first run. Extended per
   instruction: for every `(state, lineId)` pair a fixture's `totalsWithout`
   actually carries — derived from `ORDER_FIXTURES` itself, not hand-listed —
   the store seeded with that `gone` asserts its `totals` equal
   `shownOrder(view).totals`. All of these passed on the first run: **no
   hand-figured `totalsWithout` entry disagrees with `orderTotals`**, so there
   was nothing to stop and report. 64 new tests total (27 + 37); nothing
   existing touched.
2. **`empty` fixed on lines, not money.** `toShownOrder` now checks the live
   line count: zero lines returns the fixture's bare `{ subtotal, total }`
   (no `serviceCharge`/`taxIncluded` keys); one or more lines runs
   `orderTotals` exactly as before, so `zero` (the 100% comp, discounted to
   nothing but drawn with both rows) is unaffected — its lines are still
   there, only its total is zero. `orderTotals` itself is untouched.

**Design question restated for the lead's housekeeping, not solved here**:
before this slice, `empty` was a fixture nobody could reach by acting;
`removeLine` now means a cashier can void their way into a genuinely empty
order, and which shape *that* order should draw (same as the fixture's, or
something else) is a question this slice didn't have standing to answer — it
only made the untested fixture-only shape match the reachable one.

#### What did not change

`fire.ts`, `discount.ts`, `void.ts`: untouched, confirmed by `git diff`
touching none of them. `shownOrder` (`voidFixtures.ts`): untouched — still
feeds the sheets and the void sheet exactly as before, including the old
totalsWithout-gated `?gone=` limit that `test/void.test.tsx:311-319` pins
directly against `shownOrder` and that this slice does not touch.
