# FE-012 — Quick sale, POS-03's second variant (F2d)

**Status:** Ready, unassigned. Written 2026-09-22 by `lead`.
**Roadmap item:** F2d
**Branch:** `agent/phase-0-foundations`
**Baseline:** `43328e4`, **1077 tests across 18 files**, typecheck clean
(lead-verified 2026-09-22). **Re-run it before you start** and state what you
got. The suite includes seven PostgreSQL migration tests, so run `npm run db:up`
first if `restaurant-pos-db-1` is not up.

---

## What this slice is

SCREEN-INVENTORY: *"Two variants of one screen — `table` and `quick_sale` —
differing in affordances only."* Every slice so far has built the table variant.
This one builds the other, in its two artifact states: **`quick`** and
**`quick-line`**.

A quick sale is `FR-D2`'s order with no table, paid immediately. What makes it a
slice of its own rather than a state in the grid is that **it changes the order's
identity and what the close bar offers** — not just what the menu shows.

---

## The one constraint that is not cosmetic

> **`FR-E5`**: For a quick-sale order, firing and receipt printing both occur at
> close. A quick-sale order presents **no fire control at all** — settling fires
> it. One visible control meaning "send to kitchen" on a table order and nothing
> on a quick sale teaches the cashier the control is unreliable, and that lesson
> carries to the table order where it matters.

Ruling **C-2** in SCREEN-INVENTORY says the same in its *Must not invent* list.
Read both before you write the close bar.

**Absent, not unavailable.** This is the distinction ruling **C-1** draws, and
this slice is on the absent side: a quick sale can never fire, so a greyed *Send
to kitchen* would be naming something that will never become available.

**Careful — F2h just built the opposite case.** As of `456c37f` the close bar
computes the fire control's *availability* from the order: unavailable when a
PENDING line holds an 86'd item (`FR-E4`), and unavailable when there is nothing
left to send (`FR-E1`, `B-16`). Both of those draw the control **inert in
place**, because on a table order the condition is temporary. **Do not reach for
that mechanism here.** On a quick sale the control does not exist. If the close
bar cannot express both, that is the refactor this slice owns.

**Settle carries the meaning instead**, in the artifact's own words and its own
width: *"Settle — sends the order to the kitchen"*, one wide primary control
replacing the table order's Settle (`order.html:375-376`).

---

## What the artifact draws

From `../restaurant-pos-design/docs/design/visual-directions/frost/pos/order.html`.
**Read that copy, not this branch's** — this branch's `docs/design/visual-directions/`
predates A7 and DESIGN-004's remediation. For POS-03 the two differ only by A7's
`pressed` additions, but do not form the habit: `settlement.html` here still
carries DESIGN-004's critical defect.

### `quick` — the counter order

| Where | What | Line |
|---|---|---|
| Bar | `Quick sale`, tag `COUNTER` instead of `Table 1` / `DINE IN` | `:40-42` |
| Panel head | `Order · counter`, and the count reads **`2 items · not yet sent`** — or `1 item · not yet sent` once a line is removed | `:119, :124-125` |
| Lines | One group, headed **`Not sent to the kitchen yet`**, tag `REMOVE FREELY`. Two lines: Burger (Large +20.000, Extra cheese +15.000) 135.000, and Soda 30.000. **Every row has a remove control** | `:200-220` |
| Totals | Subtotal 165.000, service charge 5% 8.250, total 173.250, includes tax 15.000. **No discount row** — this order carries none. Both single-removal sets are drawn | `:303-320` |
| Close bar | Discount and Void order live. **No fire control.** One wide primary *Settle — sends the order to the kitchen* | `:361-376` |

**The bar is still not built and this slice does not build it.**
`order-screen__bar` is an empty `aria-hidden` div at the artifact's height
(`OrderPanel.tsx`). The identity a cashier reads in `apps/pos` today is the
panel's own title, which is exactly where the artifact puts it too: `Order · T1`
becomes `Order · counter`. Leave the bar alone; say so in your handoff rather
than building a header nobody asked for.

### `quick-line` — the line editor's quick form

`M-5`/SCREEN-INVENTORY: *"The line editor has a table form and a quick form, as
POS-03 itself has two variants. They differ only in the return target: the quick
form returns to the quick workspace."* **DESIGN-002 ruled this is a second form
of one sheet, not a seventh modal** — the count stands at 7 POS / 13 back office
/ 6 modals, and nothing in this slice changes it.

The artifact's quick form (`:422-444`) differs from the table form in three
visible ways:

- **Header:** `Burger` with a `NOT SENT YET` tag — not the table form's
  `Steak — pending`.
- **Copy:** *"Nothing on a counter sale goes to the kitchen until you settle it,
  so removing this line needs no approval and is not recorded."* and *"You can
  also remove it straight from the order line. This sheet exists for quantity."*
- **Return target:** *Back* returns to the quick workspace.

The third is already right in `apps/pos`: `panelLine(lineId, view, order)` sets
`back: view`, which is whatever order is on screen. **So the quick form is the
same builder with the variant's title, tag and notes** — not a second code path,
and certainly not a second sheet component.

---

## The rule that governs every one of these differences

**Derive them from the order's variant, not from `?state=`.** `quick` and
`quick-line` are two views of one counter order; a `view.state === 'quick'`
condition sprinkled through the panel is the per-state flag F2h spent a slice
removing from the fire rule, and it will be wrong the moment a third quick state
exists (`FR-G13` already implies one — see *Held* below).

Give the order fixture its type — `table` or `quick_sale`, the PRD's own words
(`docs/PRD.md:40`: *"One bill. Type is `table` or `quick_sale`"*) — and let the
panel read that. The count string, the group heading, the close bar's shape and
the editor's form are then four consequences of one fact.

**`FR-E2` and `B-16` are why the group heading differs at all.** On a table order
a group answers *"did this go to the kitchen?"* (`I-7`). On a counter sale
nothing has, ever, until close — so the artifact's heading is a statement about
the whole order rather than about one round.

---

## What must not change

**Everything else.** In particular:

- **F2h's fire rule.** `fire.ts` is a pure module and stays one. Adding the
  variant must not make `blockingLines` or `sendableLines` state-aware, and the
  `fireblocked`, `fireblocked-overflow`, `error` and `fireerror` states must
  behave exactly as they do today. Their guards are the newest in the suite;
  **run them, do not edit them.**
- **Every opener carries the order on screen** (F2k). A quick row body opens
  *that* row's editor, and its *Remove line* takes *that* line. No control names
  a fixture state.
- **`I-12` still holds.** A quick sale's lines are all PENDING, so **every**
  trailing slot carries a remove control — which is the one state where `I-12`'s
  rule is uniform. The guard still reads *"no trailing slot has an anchor or
  button ancestor"*, with its detector self-tests intact.
- **`B-12`** on both PIN pads. You should not be near them.
- **The reachability guard still passes, self-tests included.** A quick sale
  reaches the same discount and void paths a table order does; `FR-H3` makes the
  unfired order's void ungated, which is what `sheet-voidorder` already draws.
- **Only *Settle* pushes a history entry.** Everything that stays on POS-03
  replaces (SITEMAP §1). The wide Settle is still Settle.
- **`<button>` for acting, `<a>` for going.**
- **No invented values. No `Number()` on money. No hover outside
  `@media (hover: hover)`. No console, storage, cookie or fetch.**
- **The `?state=` fixture states keep working for review**, and the dev-only
  state nav gains the two new ones in the artifact's order.

---

## Required inputs

1. **`../restaurant-pos-design/docs/design/visual-directions/frost/pos/order.html`**
   — states `quick` and `quick-line`. Not this branch's copy.
2. **`docs/PRD.md`** — `FR-D2`, `FR-E5`, and the Order definition at `:40`.
   **`FR-E5` in its own words**, not a summary of it.
3. **`docs/design/SCREEN-INVENTORY.md`, POS-03** — the two variants, ruling
   `C-2`, ruling `C-1`'s absent-versus-inert distinction, and the *Must not
   invent* list.
4. **`docs/design/SITEMAP.md` §1** in the design worktree, and DESIGN-002's
   ruling that the quick line editor is a **form**, not a node.
5. **`apps/pos/src/` and all of `apps/pos/test/`.** Particularly `fire.ts` and
   the close bar in `OrderPanel.tsx` (both changed yesterday in `456c37f`),
   `sheetFixtures.ts` (`panelLine`, `lineEditorTitle`, `PENDING_NOTES`) and
   `orderFixtures.ts`.
6. **`.agent/tasks/FE-011-fire-and-rejection-states.md`**, all three handoff
   entries — the close bar you are editing is the one it just rebuilt, and its
   rulings on absent-versus-inert are binding here.

---

## Acceptance criteria

1. **`quick` draws the counter order**: title `Order · counter`, the count
   reading `2 items · not yet sent`, one group headed `Not sent to the kitchen
   yet` with the `REMOVE FREELY` tag, both lines with their remove controls, and
   the artifact's totals with no discount row.
2. **No fire control exists on a quick sale.** Not inert, not hidden by CSS —
   **absent from the document**. Tested by asserting the close bar's controls
   are exactly Discount, Void order and Settle. `FR-E5`, `C-2`.
3. **Settle carries the fire meaning**, in the artifact's words, as the one wide
   primary control.
4. **The variant is a fact on the order, not a state name.** No component
   branches on `view.state` to decide the title, the count, the group heading,
   the close bar or the editor's form. **Prove it:** a table-order fixture given
   the quick type draws the quick affordances, and vice versa.
5. **`quick-line` is the same sheet in its quick form** — the variant's header,
   tag and notes — opened over the line that was tapped, returning to the quick
   workspace, with *Remove line* taking that line. Tested with **both** lines, so
   a single hardcoded Burger fails.
6. **Removing a line updates the order**, to the artifact's own figures for each
   of the two removals.
7. **F2h's four states are untouched.** Run their guards and say so.
8. **All 1077 existing tests still pass**, none deleted or weakened. Every test
   you changed is listed with its reason.
9. **Verify in a browser and say what you did.** At minimum: read the close bar
   on `quick` against the one on `default`; tap both rows and read both editor
   headings; remove each line and read the totals.
10. **`npm run verify` passes.** State the new test and file counts. Typecheck
    clean.

**Prove at least one guard red by injecting the defect it claims to catch** —
the obvious one is a fire control that survives on a quick sale. Say which and
what failed. The lead will do the same independently, and an independent codex
reviewer will read this slice together with F2h.

---

## Held — do not build, but name anything you find

- **An empty quick sale.** The artifact draws none, and the table order's empty
  state says *"Tap an item on the left to start"*, which is true of both. If you
  need an empty quick fixture for a test, say so rather than inventing its copy.
- **A quick sale under a settlement lock.** `FR-G13` and `AC-29` explicitly
  contemplate a **leased quick-sale order** — a back-office 86 against one is
  rejected — so this state exists in the requirements and is drawn nowhere. Name
  it; do not compose it.
- **Quick-sale receipt and close behaviour.** `FR-E5` puts both at close, which
  is POS-04. **F3.**
- **The bar.** Still unbuilt, deliberately.
- **The menu tile's opener**, still `A7`-shaped and still the lead's.

---

## Out of scope

- Anything in `fire.ts` beyond what criterion 2 requires of the close bar.
- Settlement, POS-07, and the placeholder `?state=settle*` / `?state=incidents`
  destinations.
- **Focus trapping and the stacked scrims.** Seven slices running now. Real, not
  acceptable at ship, not this slice.
- Any new token, CSS value or visual state beyond reusing what exists. The wide
  primary button is `btn--wide` in the artifact; check what `pos.css` already has
  before writing a rule.

---

## Handoff

Name the command and the URL the owner opens, and what to press to see each
state. List every test you modified and why. List anything you held and why.

**Raise judgement calls rather than taking them.** Nine slices, and a task file
of this lead's has been wrong in every one — most recently in a way only an
independent reviewer caught, and in F2h in a way the implementer caught by
building the rule the file asked for and noticing it contradicted the artifact.
**Where this file disagrees with `docs/BOUNDARIES.md`, the PRD, `SITEMAP.md` or
`SCREEN-INVENTORY.md`, those win and this file is the defect.**

Do not commit, and do not touch `.agent/MEMORY.md` or `.agent/ROADMAP.md`. The
lead verifies with `git log`, a browser, and by injecting the defects your tests
claim to catch.

---

# HANDOFF — implementer, 2026-09-22

**Done.** All ten acceptance criteria met. Not committed. `.agent/MEMORY.md`,
`.agent/ROADMAP.md` and every contract document untouched.

**Baseline re-run before starting:** `npm run verify` → **1077 tests across 18
files, typecheck clean**, matching the task file (`restaurant-pos-db-1` was
already up, so the seven PostgreSQL migration tests ran).

**Now:** `npm run verify` → **1123 tests across 19 files, typecheck clean.**

## Open it

```
npm run dev -w apps/pos
```

Then **http://127.0.0.1:5173/pos/order** — the fixture-state nav at the bottom
gains `Quick sale` and `Quick sale — line editor` at the end.

| To see | Press / open |
|---|---|
| The counter order | `?state=quick` — title `Order · counter`, count `2 items · not yet sent`, one group headed `Not sent to the kitchen yet`, no discount row, no `Send to kitchen`, wide `Settle — sends the order to the kitchen` |
| No fire control at all | On `quick`, inspect the close bar: it has exactly three controls. `Send to kitchen` is not in the DOM, not greyed, not `aria-disabled` — absent |
| The line editor’s quick form | `?state=quick-line` (Burger, statically, as the artifact routes it), or on `quick` tap either row — tap Soda and its own editor opens, tagged `NOT SENT YET`, with the counter-sale copy |
| A removal | On `quick`, press either row’s `×`. Burger gone → `1 item · not yet sent`, totals `30.000 / 1.500 / 31.500 / 2.727`. Soda gone → `135.000 / 6.750 / 141.750 / 12.273` |
| The table order is untouched | `?state=default` still shows all four close-bar controls, `Send to kitchen` included |

**Verified in a browser at 1280×800**, all of the above, plus: tapping Soda’s
row opens Soda’s own editor (not a hardcoded Burger); Back returns to `quick`
with focus on the row; console clean throughout (no errors, no React
warnings, only Vite’s own connect lines).

## What I built

**The variant is a fact on `OrderFixture`/`ShownOrder` (`type?: 'table' |
'quick_sale'`, optional, defaulting to `table` through `orderVariant()`), not
a branch on `view.state`.** Four consequences read it, each a pure function
so the "table fixture given the quick type, and vice versa" proof doesn't
need a full render:

- `orderCountLabel(type, count)` — the `· not yet sent` suffix.
- `pendingGroupHeading(type)` — `Not sent to the kitchen yet` vs `Pending ·
  not sent to the kitchen`.
- `actionsFor(type)` (exported from `OrderPanel.tsx`) — the close bar's
  control set. A quick sale's array simply has no `fire` entry; it isn't
  filtered out at render time, so the control cannot exist in the DOM
  (criterion 2 asked for absent, not hidden). Settle's entry differs by a
  `wide: true` flag and the artifact's longer label; a new `.action--wide {
  grid-column: 1 / -1 }` rule in `pos.css` puts it on its own row — no new
  length or colour, reused from `structure.css`'s own `.btn--wide`.
- `panelLine()` in `sheetFixtures.ts` — the line editor's form. Reads
  `orderVariant(order)`, never `view.state`; `LineSheetFixture` gained an
  optional `tag`, rendered through `SheetFrame`'s existing `aside` slot
  (`ItemSheet` already used it for the price) as `.sheet__aside
  .round-head__tag` — reusing the pill style the round header already has,
  no new CSS.

**Two new fixtures, `quick` and `quick-line`**, in `orderFixtures.ts`: one
pending group (`quickOrder`), Burger and Soda at the artifact's own figures,
`itemId`s set the same way every other line's is. `quick-line` mirrors it
statically for review, exactly as `sheet-line` mirrors the table order — the
panel behind a sheet is the order the sheet opened over. `MENU_FIXTURES`
gained matching empty entries; the menu region needed no change at all.

**`fire.ts` is untouched.** `blockingLines`/`sendableLines` still read lines,
never a variant. `OrderPanel.tsx` now gates *asking* fire.ts at all behind
`type === 'table'` — a quick sale has nothing to refuse and nothing "not
sendable yet" either, both questions presupposing a control that doesn't
exist — so `refusal` and `nothingToSend` are simply `undefined`/`false` for
`quick`/`quick-line`, which is also why no notice or `aria-describedby` can
ever appear there.

## Judgement calls

**None I disagreed with the task file on.** I read `FR-D2`, `FR-E5` and
ruling `C-2` in their own words, `SCREEN-INVENTORY.md` POS-03, and F2h's
handoff (its close-bar refactor is exactly what I extended). Everything the
task file predicted — that the fire mechanism had to become variant-aware
rather than reused, that the line editor is one sheet with two forms, that
the bar stays unbuilt — matched what was actually in `OrderPanel.tsx` and
`sheetFixtures.ts`.

**One thing worth naming: I made `type` optional rather than adding it to
all ~28 existing fixture literals.** The task file didn't specify either way.
I chose optional-with-default (`orderVariant()`) because CLAUDE.md's "don't
touch what isn't yours" reading of "what must not change: everything else"
argued against a 28-line mechanical diff on F2a–F2h's committed fixtures for
a fact they already have implicitly (every one of them is a table order).
The two new fixtures set it explicitly. If the lead would rather every
fixture spell it out — matching A7's `source: null` precedent of explicit
absence over implicit default — that's a small follow-up, not a redesign;
`orderVariant()` is the one place the default lives.

## Held, as the task file said to

- **The bar** — still the empty `aria-hidden` div at the artifact's height.
  `Order · counter` and `COUNTER` live only in the panel head, exactly as the
  task file predicted, since the bar isn't built.
- **An empty quick sale** — no fixture, not needed by any test.
- **A quick sale under a settlement lock** — named, not composed; `FR-G13`
  contemplates it but the artifact draws it nowhere.
- **Quick-sale receipt and close behaviour** — POS-04, F3.
- **The menu tile's opener** — untouched, still `A7`-shaped, still the
  lead's; I was never in `MenuRegion.tsx`.

## Every test I modified, and why

| File | Change | Why |
|---|---|---|
| `orderFixtures.ts` | New: `OrderVariant`, `orderVariant()`, `orderCountLabel()`, `pendingGroupHeading()`, `quick`/`quick-line` states and fixtures | The four derivations criterion 4 asks for, plus the two states |
| `voidFixtures.ts` | `ShownOrder` gained optional `type`; `shownOrder()` passes it through | `panelLine()` needs the order's variant when a row is tapped dynamically |
| `sheetFixtures.ts` | `LineSheetFixture` gained optional `tag`; `panelLine()` branches on `orderVariant(order)`; added `QUICK_NOTES` and the `quick-line` static fixture | M-5's quick form |
| `Sheets.tsx` | `LineSheet` passes `sheet.tag` as `SheetFrame`'s `aside` | Renders the `NOT SENT YET` tag through the existing slot |
| `menuFixtures.ts` | Two empty entries added (exhaustive `Record<OrderState,...>`) | Menu region is identical behind both new states |
| `OrderPanel.tsx` | Count label, pending heading, and the close bar all read `type`; `ACTIONS` replaced by exported `actionsFor(type)`; refusal/nothingToSend gated on `type === 'table'` | The four consequences, and the fire-control's absence on a quick sale |
| `pos.css` | Added `.action--wide { grid-column: 1 / -1 }` | Settle's own row on a quick sale, reusing structure.css's naming |
| `test/fire.test.tsx` | Two generic loops (`is never absent`, the `VIEWS` fire-availability table) now run over `TABLE_STATES` (`ALL_STATES` minus `quick`/`quick-line`) instead of `ALL_STATES` | Those guards assume a fire control exists to be live or off; on a quick sale there is none at all, which is criterion 2, not a bug in the guard |
| `test/order-panel.test.tsx` | Fixture-state list gains `quick`, `quick-line`; title text updated | The two new states |
| `test/sheets.test.tsx` | "no sheet in any other state" filter changed from `!BUILT.includes(s)` to `!(s in SHEET_FIXTURES)` | `BUILT` was every key `SHEET_FIXTURES` had until `quick-line` joined it; reading the fixture map directly is the general fix rather than a second hardcoded array, and would have prevented this from needing an edit at all |

`test/quick-sale.test.tsx` is new: 30 tests, covering all ten acceptance
criteria plus the pure-function proof for criterion 4.

## Guard proven red by injecting the defect it claims to catch

Restored a fire control unconditionally in `actionsFor` (`return
[DISCOUNT_BTN, VOID_ORDER_BTN, FIRE_BTN, SETTLE_BTN]` regardless of `type`) —
**7 tests failed**: the close-bar-composition test, three absence tests (on
`quick`, on `quick-line`, and after a removal), and the three Settle-label
tests (which then saw the narrow "Settle" the table order draws instead of
the wide fire-meaning one). Tree restored and re-verified green at 1123.

## Every existing test still passes

1123 passed, up from 1077; none deleted or weakened — the three files
touched are listed above with exactly what changed and why, and none of the
17 tests that gained coverage automatically (via `ORDER_STATES.map`/`.each`
loops in `order-panel.test.tsx`, `menu-region.test.tsx`, `discount.test.tsx`,
`money-display.test.ts`) needed a change to keep passing.

---

# HANDOFF 2 — implementer, 2026-09-22, classify by the fact, not by name

The lead's correction: `TABLE_STATES` in `fire.test.tsx` was `ALL_STATES.filter(s
=> s !== 'quick' && s !== 'quick-line')` — a name-based exclusion list, the one
place left in the slice that classified by `?state=` rather than by the order's
own `type`, exactly the discipline the rest of the slice holds to.

**Before:** 1123 tests / 19 files. **After:** **1127 tests / 19 files, typecheck
clean.**

## What changed

`apps/pos/test/fire.test.tsx`:

- `TABLE_STATES` now reads `ALL_STATES.filter((s) => orderVariant(ORDER_FIXTURES[s])
  === 'table')` — the same function production reads (`OrderPanel.tsx`,
  `sheetFixtures.ts`). Added `QUICK_SALE_STATES`, the complementary set, same
  derivation.
- New describe block, **`the fire control exists exactly on table orders, by
  the order's own type`**, four tests:
  1. Every `TABLE_STATES` member draws a fire control (present in the DOM).
  2. Every `QUICK_SALE_STATES` member draws none.
  3. The two sets partition `ALL_STATES` with no overlap, and `QUICK_SALE_STATES`
     equals `ALL_STATES.filter(s => ORDER_FIXTURES[s].type === 'quick_sale')` —
     asserting the derivation is the fixture's own field, not a second list.
  4. **Proven red**, in-suite: flips `ORDER_FIXTURES.quick.type` to `'table'`,
     recomputes the classification fresh, asserts `'quick'` now lands in the
     table set, then renders `?state=quick` and asserts the fire control is
     genuinely drawn — the classification and the render agree, because both
     read the same fact. Reverted in a `finally`.

No other file touched. `quick-sale.test.tsx`'s per-state tests (exact close-bar
composition, the editor's title/tag/copy, totals after a removal) are left as
they were — they assert content of two *known* fixtures, not a classification
over "every quick-sale state", so naming `quick`/`quick-line` there is not the
defect the lead flagged.

## Proven red twice, independently

**In-suite** (test 4 above, described): flipping `ORDER_FIXTURES.quick.type` to
`'table'` inside the test and reverting in `finally` — passes now that the
classification is fact-derived.

**Out-of-suite, the harder proof**: I removed `type: 'quick_sale'` from the
`quick` fixture literal directly in `orderFixtures.ts` (not through the test) and
ran the full suite. **11 tests failed** — not only the new fire-control
classification tests, but `quick-sale.test.tsx`'s title, count, heading, close-bar,
editor-title, and totals-after-removal tests too, because `quick` genuinely
rendered as a table order: `Burger — pending` instead of `Burger`, `1 item`
instead of `1 item · not yet sent`, `Settle` instead of the wide fire-meaning
label. That is the four-consequences claim (criterion 4) holding end to end, not
only at the fire control. Restored the fixture; `npm run verify` green at 1127.

## Not urgent, and why

As the lead said: today a new quick-sale state lands in `TABLE_STATES` under the
old filter and fails the `'never absent'` guard loudly — safe by construction.
The fix removes the maintenance burden (a name to remember to add), not a
present hole. `FR-G13`/`AC-29`'s leased quick-sale order — named, not composed,
in *Held* above — is exactly the state that would have needed it.

Not committed. `.agent/MEMORY.md` and `.agent/ROADMAP.md` untouched.
