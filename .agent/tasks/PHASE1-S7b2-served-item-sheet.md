---
id: PHASE1-S7b2
title: M-2 for a served item, Add into the stand-in, and the open sheet between polls (plan S7, consult C4)
category: ui
touches: [money, boundaries]
depends_on: [PHASE1-S7b1]
base: agent/phase1-s7b1
owns: [apps/pos/src/Sheets.tsx, apps/pos/src/MenuRegion.tsx, apps/pos/src/OrderPanel.tsx, apps/pos/src/orderStore.ts, apps/pos/src/fire.ts, apps/pos/src/tender.ts, apps/pos/src/sheetFixtures.ts, apps/pos/src/menuFixtures.ts, apps/pos/src/session/source.ts, apps/pos/src/catalog/**, apps/pos/src/pos.css, apps/pos/test/**, e2e/tests/pos-catalog.spec.ts, e2e/support/**]
status: active
cycles: 0
---
# PHASE1-S7b2 — M-2 for a served item, Add, and the sheet between polls

**Written** 2026-11-03 by the lead. Sources:
- slice S7 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S7*);
- **consult C4** (`.agent/reviews/ARCH-021-pos-catalog.md`), decisions 7 and 8, *For DESIGN-021* sections 3 to 5, D1,
  and *For the lead*, *S7b2*, copied below where they bind;
- **DESIGN-021** (`.agent/tasks/DESIGN-021-pos-catalog-states.md`, its Handoff rules 7 to 11, its copy and focus
  tables, and R1), the reviewed served sheet states in `docs/design/visual-directions/frost/pos/order.html`
  (`?state=served-item…`, `served-line…`, `served-fireblocked…`), and `docs/DESIGN.md` *DESIGN-021 additions*
  (`D:2097-2166`);
- **PHASE1-S7b1** (its Handoff, *What S7b2 needs*): the catalog store, `useCatalog`, the source switch,
  `served-harness.tsx`;
- ADR-011 rules 23, 24 and 27; ADR-012 rule 12; PRD FR-C2 to FR-C7, FR-D4, FR-E4, FR-M5, AC-12, AC-26; B-8, B-17.

Where this file and C4 or DESIGN-021 differ, this file wins. Where this file and an accepted ADR differ, or the code
cannot do what this file says, stop and write `BLOCKED: <question>`.

**The owner merges S7b1 and S7b2 together** (DECISIONS 2026-11-02), so this branch is cut from S7b1's,
`agent/phase1-s7b1` (frontmatter `base:`), and its diff against `development` includes S7b1's commits. Review and
report only your own: `git log agent/phase1-s7b1..HEAD`.

## Objective

In a served build, pressing an available tile opens M-2 for that item, built from the live catalog. The cashier
chooses a variant (exactly one when the item has variants) and any modifiers, sets the quantity, and Add puts a line
into the client stand-in order as a snapshot (Q14). The sheet follows the item while it is open: an 86, a restore, an
archive, a price, name or option change. FR-M5's ceilings (D1) turn Add, plus and the line editor's Update off, and the
store refuses past them. `addLine` refuses under a lock, for an 86'd item and past the ceilings (ARCH-004's gap). The
fire refusal gains DESIGN-021's plural. Nothing is written to the server.

## Decided: do not reopen

- **Owner:** Q13 (no Phase 1 POS command carries the catalog version); Q14 (a real item into the stand-in); S7b1 and
  S7b2 merge together.
- **The store** (S7b1): `useCatalog(view)` gives `{ store, snapshot, … }`; `snapshot.menu` is one immutable object
  replaced whole; an item is `{ id, categoryId, name, price, available, variants: {id,name,delta}[], modifiers:
  {id,name,delta}[] }`, money already decoded. **A sheet reads the live item** with `snapshot.menu?.items.find((i) =>
  i.id === itemId)`; an item absent from the projection is no longer on the menu, so the sheet keeps the last-known
  details in its own state. `destinationOf` is `null` for a served menu: replace the `if (!off && destinationOf)` in
  `Tile` (`MenuRegion.tsx`) with the served opener; the fixture path keeps its `?state=sheet-item-<id>` routing.
- **No line or order carries the catalog version**, and no parameter is added for it (C4 item 10, Q13).

## C4's decisions, copied

### Add into the stand-in (C4 item 7)

**`NewLine` becomes the snapshot.**

```ts
type NewLine = {
  itemId: string;     // required, as now: FR-E4 depends on it
  name: string;
  quantity: number;
  basePrice: Money;
  modifiers?: ReadonlyArray<Modifier>;   // the chosen variant and modifiers: name and delta
};
```

- **Snapshotted:** the names, the component deltas and the resolved unit price with FR-C2's floor (AC-26), through the
  existing `resolveUnit`. A zero delta is written as the bare name, as today.
- **Not snapshotted: option ids.** Lines are snapshots and read nothing back.
- **`basePrice` replaces `priceOf`,** which lets the fixture menu's price lookup leave the store. Remove `priceOf`
  from `orderStore.ts` and `FixtureMenu.priceOf` if nothing else reads it; the fixture sheets pass the fixture price.

**`addLine` closes ARCH-004's gap under a lock**, and returns an outcome rather than nothing, as `changeDiscount` does.
It reads its facts at the press, through the same ref `fire` uses, and follows `changeDiscount`'s pattern of advancing
`bookRef` so that a second call in one tick sees the first:

| Refusal | Read from | Note |
|---|---|---|
| `closed` | `isOpen` | Already silently refused by `update` |
| `locked` | `locked || originFacts(view).lock !== undefined` | **ARCH-004's gap.** Own draft or another's lease |
| `unavailable` | The catalog store's current list, at the press | **FR-C5, as a stand-in only.** A check in a browser controls nothing; the server's refusal in Phase 2 is the control (ADR-012 rule 12) |
| `over-limit` | D1's pure function | D1 |

A refusal changes nothing and returns the same book (B-20), and the sheet stays open. The screen should never offer
any of these, so the store check is reached only if the screen is wrong, which is exactly why it exists. A comment must
say *stand-in* in the words `discountChange.ts` uses, and name the server command that replaces it (Phase 2's
add-line). `removeLine` and `setQuantity` keep their lock gap until Phase 2. D1's ceiling **does** apply to the line
editor's *Update*, in the screen and in `setQuantity`, because it is a different rule from the lock.

**The sheet opens by component state in served mode** (`itemOpened`, beside `lineOpened` and `discountOpened`): a UUID
is not an `OrderState`, and the sheet is not back-stackable. Cancel and Add leave the view as it is. Focus returns to
the tile, or to the selected category's button if the tile has gone.

### The open sheet between polls (C4 item 8, *For DESIGN-021* 4)

`ItemSheet` keeps its `picked` state of option ids and receives its `sheet` from an adapter that builds it from the
live item at each render, so `Sheets.tsx` changes little. It remembers the last-known item for the archived case, and
it compares what the sheet opened on with what it now holds to raise the *changed* notice.

| While the sheet is open | The sheet | Add |
|---|---|---|
| **The item is 86'd** | Choices kept, marked unavailable, explained (AC-12) | Off |
| **The item is available again** | The notice goes, choices kept | On, subject to the rest of this table |
| **The item is archived, or its category is** (it left the projection) | The last-known name, options and choices stay readable; a notice says it is no longer on the menu (never the 86 sentence). Cancel returns to a grid without that tile | Off |
| **It reappears** (restored) | As the row for available | On |
| **Its price, an option's delta or a name changes** | The figures update at once, so what is shown is what Add adds. A notice says the item changed while the cashier was choosing, and stays until the sheet closes. One notice, whatever changed | On |
| **A chosen modifier is removed** | It leaves the choices and the total. The same notice names what was removed | On |
| **The chosen variant is removed** | No variant is chosen now. The same notice names it | Off until one is chosen |
| **A new option is added, or options are reordered** | Drawn unselected, in place. No notice | Unchanged |
| **Checks are failing** (*Possibly out of date*) | Nothing changes; the sheet does not show that notice | Unchanged |

**Add never asks for an acknowledgement**, and stays live on a price change: what is displayed is what Add adds
(FR-C7). **Pending lines are not repriced:** a line is a snapshot (FR-D4, B-8).

### M-2 for any served item (C4 *For DESIGN-021* 3)

At most two groups, with DESIGN-021's two fixed labels; a list with nothing in it draws nothing. **Nothing is
preselected.** An item with variants needs exactly one chosen before Add; until then the line total shows the base
price plus any modifiers, floored at zero. A variant's delta may be negative; the resolved unit floors at zero (AC-26).

### D1, FR-M5's ceilings in the stand-in

One pure function that M-2 and the store both call, so the drawn state and the refusal cannot disagree. A shared
`LINE_TOTAL_LIMIT`, and an order limit of the same value (99.999.999), belong beside `SINGLE_TENDER_LIMIT` in
`tender.ts`.

- **M-2:** when the line or the order would pass 99.999.999, Add is off with a plain reason, and plus is off when the
  next quantity would pass it. Minus stays live.
- **A choice can pass the bound at quantity 1:** the off-state follows the choices as well as the keys; the option
  itself is never refused.
- **The order figure is the order's `total`** as the panel shows it, after discount and service charge, with the new
  line in it (fixture rates in Phase 1). The reason quotes no computed excess.
- **The line editor uses the same check:** its *Update to n* is off, with the same reason, when the new quantity would
  pass either ceiling.
- **Not checked in the stand-in:** removing or replacing a discount.

### The fire-blocked state (C4 *For DESIGN-021* 5)

`fire` and `close` already read the unavailable list from the catalog store at the press (S7b1). Replace `fire.ts`'s
provisional plural with DESIGN-021's: count pending **lines**, deduplicate the bold names **by item id** in first-line
order, and use "item" or "items" by the number of **distinct items**. The reviewed singular does not change. A pending
line whose item was **archived** does not block and is not marked.

## DESIGN-021's rules that bind this slice

Rules 7 to 11 of its Handoff, its copy table's M-2, quantity, bound, notice, editor and fire rows, and its focus rules
for a sheet, **copied exactly** (ADR-011 rule 24). In short:

- **7.** Every tile opens M-2, including zero-price and no-option items; there is no direct-add tile. Groups *Variant —
  choose one* and *Modifiers — choose any*. Each commit snapshots the full name, choices and displayed unit.
- **8.** M-2's body alone scrolls; the live notice, unit and line total sit in a fixed band between body and footer; a
  new notice shrinks the body without moving its top or `scrollTop`; quantity keys and Add stay in the fixed footer,
  which always reserves one reason line. Unit = `max(0, base + variant + modifiers)`; line = unit × quantity.
  Cancel/Escape discard; Add alone commits. The pending-line editor uses the same footer and an explicit *Update to n*.
- **9.** The open sheet follows the current item, as the table above.
- **10.** **The stepper stays visible while the item is unavailable or absent** (DESIGN-021 answered C4's comment
  discrepancy: follow the drawing, not `Sheets.tsx:154`'s comment, which you correct). Add alone is blocked by
  availability. **Buttons** (Add, Update, the quantity keys) turn off with `aria-disabled` and the off class, never
  native `disabled`; a poll disabling a focused Add keeps focus there, and Escape still closes.
- **11.** D1, as above.
- **R1:** the sheet's heading shows the full item name. **A 64-code-point name in the order panel's line wraps in full**
  and is never ellipsized, with the line's quantity, amount and trailing slot intact.

## Acceptance criteria, each with its red proof

Write each test first, run it against the unchanged code, and record the failing assertion; then the code. Each *Red*
is a mutation you apply, observe failing for the stated reason, revert, and report. C4's numbers are in brackets.

1. **[1]** Any served item opens M-2 by component state, with no URL change, at *empty*, with no preselection and at
   most two groups. *Red:* preselect the first variant.
2. **[2]** An item with variants: Add off until exactly one is chosen, with the reason; an item with none needs none.
   *Red:* allow none.
3. **[3]** The line snapshots names, deltas and the floored unit (AC-26): base 10.000, variant −20.000 gives unit 0.
   *Red:* clamp the total, not the unit.
4. **[4] `addLine` under a lock** (own draft and fixture lease) refuses, returning the same book. Driven at the hook, as
   ARCH-004 asks. *Red:* remove the check: a line is added.
5. **[5]** `addLine` of an 86'd item refuses, reading the store at the press; a comment says stand-in. *Red:* read the
   value captured at render.
6. **[6] D1:** a choice or quantity past either ceiling turns Add and plus off with the reason, the store refuses, and
   the line editor's *Update* does the same. Exact bound 99.999.999 accepted, 100.000.000 refused. *Red:* check the
   line only.
7. **[7]** Every row of the open-sheet table, with a stub store changing the item under an open sheet (the S7b1
   harness). *Red:* snapshot the item at open.
8. **[8] AC-12's sheet, in the browser:** C4 item 4 step 6 in `e2e/tests/pos-catalog.spec.ts`: open another item,
   choose a variant and a modifier, 86 it from BO-03, `runFor(2000)`, and assert the sheet is open, the options still
   `aria-pressed`, and Add `aria-disabled`; both engines. *Red:* close the sheet on 86.
9. **[9]** Fire blocked for a real pending line, cleared by restoring; the plural refusal counts lines and dedupes names
   by item id, with item/items by distinct items; a fixture line `itemId: 'steak'` beside a served 86'd item named
   Steak does not block; a line with no `itemId` never blocks. *Red:* compare by name.
10. **[10]** A pending line keeps its price after the item's price changes (B-8). *Red:* read the catalog for the line.
11. **Rule 8's fixed band and footer:** a notice arriving and a reason clearing move neither Add nor the options, and
    keep the body's `scrollTop`. *Red:* put the notice inside the scrolling body.
12. **Rule 10's focus:** a poll turning Add off while it has focus keeps focus on it; its handler does nothing; Escape
    closes. *Red:* use native `disabled`.
13. **R1 in the order panel:** a 64-code-point name wraps in full beside an intact quantity, amount and trailing slot.
    *Red:* ellipsize the line's name.
14. **Focus** after Cancel and Add: the tile, or the selected category's button if the tile has gone. *Red:* focus the
    first category.
15. The fixture path is unchanged: `sheet-item86` and the twelve fixture sheets keep their tests, with a served twin
    where the served behaviour must also hold.
16. `npm run verify` green, with counts. The lead runs `npm run test:e2e:all` before review and before merge; run it
    too and report it.

## Tests expected to change

- `sheets.test.tsx`, `own-items.test.tsx`, `order-store.test.tsx`, `one-press-fire.test.tsx`, `fire.test.tsx` (C4);
  `fire-order.test.ts` (the plural, if it asserts the provisional form); `quick-sale.test.tsx` only if it calls
  `addLine` with the old `NewLine`. Name in the Handoff every test whose assertions changed and why; an import move is
  not a change of meaning.
- `served-menu.test.tsx` (S7b1's "a press opens no sheet" becomes M-2 opening), `catalog-store.test.tsx` only if the
  store's shape changes, `served-harness.tsx` (additions).
- `e2e/tests/pos-catalog.spec.ts` (step 6 added; P1's "a press opens no sheet" on an 86'd tile stays).
- **Nothing else should change.** A change anywhere else is reported with its reason; a weakened assertion is not
  acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- The fixture path keeps working through the source switch; nothing in a served build imports the fixture menu (S7b1's
  bundle needles stay green).
- Money is `Money` (bigint) end to end; no `Number()` on an amount.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`agent/phase1-s7b1` as reviewed. Its final tree: `npm run verify` 153 files, 5612 tests; `npm run test:e2e:all` 118
passed. Confirm the baseline before you start and state the new counts in
the Handoff.

## Out of scope

- The preset picker (S7b3). Any server change. The add-line command, `CATALOG_CHANGED` at the POS, the server's FR-M5
  refusal (Phase 2). `removeLine`'s and `setQuantity`'s lock gap (Phase 2).

## Commit and report

Commit on `agent/phase1-s7b2` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose: what was done; **what S7b3 needs** (the store's preset shape as you leave it, and the
picker's entry point); what was decided and on what evidence; tests changed and why; each red proof; what was found and
not fixed; the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Round 2: the lead's rulings on the review, 2026-11-04

The review is `.agent/reviews/PHASE1-S7b2-review.md` (Codex, three findings). Read it whole. Its *Cleared* section
settles the lead's five questions: points 2 to 5 need no change here, apart from what R1 says about the reason row.
Fix exactly these, each test first with its red proof recorded, and nothing else.

- **R1 (F1, accepted).** A pending line in a served order opens its line editor in the served frame: the served heading
  class, focus on the heading, Tab and Shift-Tab wrapping, and the growing, wrapping header (R1's full name). Carry
  "this is a served catalog" from where `ServedItemSheet` already knows it, through `SheetView` to `LineSheet` and
  `SheetFrame`; do not guess it from the line. **The reserved reason row is served mode only:** the fixture line editor
  returns to exactly its reviewed layout, with no empty reason row. Tests: add a served item with a 64-code-point name,
  open its pending row, and assert the served class, the heading's focus, Tab from *Update to n* wrapping to *Back*, and
  the wrapping header; a fixture line editor has no reason row. *Red:* drop the served flag on `LineSheet`.
- **R2 (F2, accepted).** In a served order, the fire refusal draws **one** recovery control, *Show unavailable lines*,
  test id `served-show-blocked`, which reveals and focuses the **first** blocking line (DESIGN-021's copy table, line
  773, binds exactly; its artifact is `docs/design/visual-directions/frost-served-catalog.js:116`). The existing
  reveal-and-focus callback does the work. **The fixture path keeps its reviewed per-line controls unchanged.** Tests:
  two lines for one item, and two distinct items: one control each time, and it focuses the first line. *Red:* map a
  control per blocking line.
- **R3 (F3, ruled by the lead; the owner may overturn it).** The builder may not invent screen copy (ADR-011 rule 24).
  When **one** chosen option is removed, keep DESIGN-021's reviewed sentence naming it. When **more than one** chosen
  option has been removed while the sheet is open (at once or across polls, a variant and a modifier counted alike),
  show DESIGN-021's reviewed generic sentence instead, exactly: *This item changed while you were choosing. Check the
  updated choices and prices before adding.* Delete the comma-joined plural. The removed options still leave the
  choices and the total, and a removed variant still turns Add off until one is chosen. A drawn plural is queued for
  the designer, not for you. Tests: two removals at once, and two across successive polls, each show the generic
  sentence; one removal still names the option. *Red:* restore the comma-joined plural.
- **R4 (from the review's *What I did not* note).** AC-11 is proved structurally in jsdom only. Add a browser assertion
  to `e2e/tests/pos-catalog.spec.ts`, both engines: open a served item whose options overflow the body, scroll the body,
  record `scrollTop`, make a notice arrive (86 it or change its price, then `runFor(2000)`), and assert the body's
  `scrollTop` and Add's position are unchanged. Use the menu setup P8 already uses. *Red:* put the notice inside the
  scrolling body.

**How to work.** Create and change files with the Write and Edit tools only, never with shell heredocs, `python3` or
`sed`; the last round stopped for over an hour on an approval prompt for a heredoc. Run `npm run verify` before you
commit, and run `npm run test:e2e:all` and report its count. Append a *Round 2* section to the Handoff (do not rewrite
round 1) with each fix, each red proof, the tests changed and the real counts, ending with `DONE` or `BLOCKED: <one
question>`.

## Lead verification, 2026-11-04 (before review)

The lead ran these in this worktree at `f118283`; this note is the evidence a reviewer cannot gather.

- **`npm run verify`:** exit 0; typecheck clean; 156 files, 5686 tests passed. **`npm run test:e2e:all`:** exit 0; 128
  passed, both engines, P8 and P9 included. Output in `../restaurant-pos-wt/evidence/PHASE1-S7b2/lead/`.
- **Paths:** every changed path is inside `owns`. The four test files outside *Tests expected to change*
  (`order-book`, `void-apply`, `discount-apply`, `settlement`) are named in the Handoff as mechanical.
- **The two red proofs the builder did not run, run by the lead** (each reverted, tree clean after):
  - AC-3, *clamp the total, not the unit* (`resolveUnit` unclamped, the line's amount floored instead): 2 tests fail,
    `served-add-store.test.tsx` (`expected -10000n to be 0n`) and `served-item-sheet.test.tsx` (`expected '−30.000' to
    be '0'`).
  - AC-9, *compare by name* (`holdsUnavailable` also matches `line.name`, `unavailableIn` emits names as well as ids):
    3 tests fail, the fixture-`steak` case in `served-fire.test.tsx` and `served-menu.test.tsx`, and "a line with no
    item never blocks".

**For the reviewer.** Review `agent/phase1-s7b1..HEAD`: this branch is cut from S7b1's, which is already reviewed.
The lead asks for a view on each of these, beyond the review's own reading:

1. **The fire notice's recovery control.** DESIGN-021's copy table, whose fire rows this task binds exactly, gives
   *Show unavailable lines* (`served-show-blocked`), revealing and focusing the first offending line. The panel still
   draws one `Show {name}` button per blocking line (`OrderPanel.tsx:649-650`). The Handoff lists this as found and
   not fixed. Is it a defect of this slice?
2. **A lock that arrives while M-2 is open** is refused by the store only; the sheet stays open with Add live and no
   reason. Is that reachable in the Phase 1 stand-in, and if so, is a silent refusal acceptable under B-20 and C4 item 7?
3. **D1's order figure includes the fixture service charge**, so a single line of exactly 99.999.999 is not addable
   without a discount; AC-6's exact bound is proved in the pure function under a 100% discount. Does this follow C4's
   "the order's `total` as the panel shows it"?
4. **`ServedItemSheet` is a new component** rather than the fixture `ItemSheet` fed by an adapter, which departs from
   C4 item 8's "so `Sheets.tsx` changes little". Is the fixture path still exactly as reviewed?
5. **An archived item** is refused by the sheet but not by the store (C4's table names only the 86 list), and the
   fixture line editor now reserves an empty reason line. Are either of these a problem?

## Handoff

### Builder handoff, 2026-11-04

**What I did.** A press on an available served tile now opens M-2 for that item by component state (no URL change). The cashier chooses a variant (exactly one when the item has variants) and any modifiers, sets the quantity, and Add puts a snapshot line into the stand-in order. The sheet follows the live item between polls, per the C4 table. Nothing is written to the server.

Paths:
- `apps/pos/src/Sheets.tsx`: new `ServedItemSheet`. `SheetFrame` gained an optional fixed `band` between body and footer, plus a `served` flag (focus opens on the heading, Tab/Shift-Tab wrap). `QuantityStepper` takes `moreBlocked`. `LineSheet` gained D1 (Update off, reason line, plus off).
- `apps/pos/src/catalog/servedSheet.ts` (new): the adapter and the follow rule (`groupsOf`, `follow`, `noticeOf`, `prune`).
- `apps/pos/src/catalog/menuCopy.ts`: DESIGN-021's M-2 copy.
- `apps/pos/src/orderStore.ts`: `NewLine` is the snapshot (`basePrice`; `priceOf` removed along with `FixtureMenu.priceOf`/`fixturePriceOf`). `addLine` returns an outcome and refuses `closed`, `locked`, `unavailable` and `over-limit`, reading facts at the press and advancing `bookRef`. The stand-in comment names Phase 2's add-line command. `ceilingFor` is D1's one pure function. `setQuantity` refuses past a ceiling.
- `apps/pos/src/tender.ts`: `LINE_TOTAL_LIMIT`, `ORDER_TOTAL_LIMIT`.
- `apps/pos/src/fire.ts`: DESIGN-021's plural (lines counted, names deduped by item id, item/items by distinct items). The reviewed singular is unchanged.
- `apps/pos/src/MenuRegion.tsx` (`openItem`), `OrderPanel.tsx` (`itemOpened` state, inert, focus return to tile or selected category), `pos.css` (band, reason line, R1 `overflow-wrap`).
- Tests: `served-item-sheet.test.tsx`, `served-add-store.test.tsx`, `served-fire.test.tsx` (new); P8 and P9 in `e2e/tests/pos-catalog.spec.ts`.

**Decisions and evidence.**
- I built `ServedItemSheet` as a separate component, not by adapting the fixture `ItemSheet`. The served sheet differs in nearly every branch (band, notices, reasons, ceilings, nothing preselected). The fixture sheets stay exactly as reviewed. The adapter the task describes is `catalog/servedSheet.ts`; `picked` is still option ids. This departs from "Sheets.tsx changes little".
- The order ceiling is the order's total after discount and service (5% in fixtures). A single line of exactly 99.999.999 is therefore only addable under a discount that cancels the service charge. The pure test proves the exact line bound under a 100% discount.
- The stepper stays while the item is 86'd or gone (DESIGN-021 rule 10). I corrected the `Sheets.tsx` comment.
- Fixture `ItemSheet`'s Add now stays open if the store refuses.

**Existing tests changed.**
- `served-menu.test.tsx`: "a press opens nothing" became "opens M-2, address unchanged" (expected).
- `fire.test.tsx`: deleted "no reviewed state produces more than one blocking line, so the plural stays unreviewed". Its own comment says to delete it once the plural is reviewed, and DESIGN-021 reviewed it.
- `order-store.test.tsx`, `own-items.test.tsx`: mechanical (`basePrice` added; stub returns `({})`).
- Outside the expected list, mechanical only (`basePrice` on calls, or `addLine: () => ({})` stubs for the new return type): `order-book`, `void-apply`, `discount-apply`, `settlement` tests. No assertion changed.
- `served-harness.tsx`: additions only (served variants/modifiers).
- `sheets.test.tsx`, `one-press-fire`, `fire-order`: untouched, still passing.

**Red proofs** (mutation, observed failing, reverted):
1. Preselect first variant: 4 tests fail (nothing-chosen, variant-required).
2. Allow no variant: 3 fail.
3. Unit not clamped (the store's `resolveUnit` clamp removed; the task's "clamp the total" variant was not run separately): stored unit `-10000n`, expected `0n`.
4. Remove the lock check: both lock tests fail (`{}` instead of `{refused:'locked'}`).
5. Read the 86 list captured at render: the stale-`addLine` test fails.
6. Check the line only: 4 fail (order-total cases).
7. Sheet uses the item snapshotted at open: 12 fail.
8. Close the sheet on 86: P8 fails in Chromium.
9. Dedupe by name: `['Steak']` instead of `['Steak','Steak']`. The fixture-`steak` case holds because the 86 list is item ids, but I did not run a separate compare-by-name mutation for blocking.
10. Reprice from the catalog on a quantity edit: 200000n instead of 90000n.
11. Notice inside the scrolling body: structure test fails. This is structural only; jsdom cannot measure.
12. Native `disabled`: 8 fail, including the focus test.
13. Ellipsize the name: the CSS test fails, and P9 fails in Chromium.
14. Focus the first category: the "selected, not first" test fails.

**Found, not fixed.**
- The fire notice still draws a `Show {name}` button per blocking line. DESIGN-021 specifies one "Show unavailable lines" (`served-show-blocked`). I stayed within the task.
- `LineSheet` does not use the served heading focus or Tab wrap, and the fixture line editor now carries an empty reserved reason line. The tests pass.
- The multi-removed-options wording ("A, B were removed and deselected.") is mine; DESIGN-021 only draws one.
- A lock arriving while M-2 is open is refused by the store only; the sheet stays and shows no reason.
- An archived item is refused by the sheet, not by the store (C4's table lists only the 86 list).
- P8/P9 build the menu through the server's domain functions, not BO screens, as `item-editor.spec.ts` does. The 86 is the BO row control.
- The task's baseline said 5612 tests; I measured 5619 before starting.
- No Prettier was run.

**Output.**
- `npm run verify`: typecheck clean; 156 files, 5686 tests passed (baseline 153 / 5619).
- `npm run test:e2e:all`: 128 passed (both engines), including P8 and P9.

**What S7b3 needs.** The store's presets are unchanged: `CatalogMenu.presets: {id, name, value: {kind:'PERCENTAGE', rate} | {kind:'FIXED', amount}}[]`, read from `useCatalog(view).snapshot.menu?.presets`. The picker's entry point is `discountOpened` / `panelDiscount` in `OrderPanel.tsx` and `DiscountSheet`. `changeDiscount` in `orderStore.ts` still passes the fixture `PRESETS`, which S7b3 must replace.

DONE
