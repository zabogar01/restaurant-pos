# FE-013 — Two corrections from the F2h / F2d review

**Status:** Ready, unassigned. Written 2026-09-22 by `lead`.
**Roadmap item:** F2h / F2d follow-up
**Branch:** `agent/phase-0-foundations`
**Baseline:** `63f74a6`, **1127 tests across 19 files**, typecheck clean.
Re-run it before you start and say what you got (`npm run db:up` first if
`restaurant-pos-db-1` is down).

**Read first:** [.agent/reviews/F2h-F2d-review.md](../reviews/F2h-F2d-review.md).
It is an independent review by a codex agent of the two committed slices, and
both findings below are its words before they are mine. Read its *Rules cleared*
section too — it tells you what **not** to change.

---

## 1. P2 — dismissing the rejection restores a line the cashier removed

**`MenuRegion.tsx:104`, `menuFixtures.ts:186`; the test that should have caught
it is `fire.test.tsx:468`.**

Reproduce it first, in a browser:

1. `?state=error` — the rejection notice, over the table order.
2. Press the Steak's remove control. URL `?state=error&gone=steak`, total
   **155.925**.
3. Press **Try again**. URL `?state=default`, **the Steak is back**, total
   **382.725**.

*Try again* navigates to `fixture.rejected`, which is `{ state: 'default' }`, so
it discards the view's `gone`. **The screen the cashier is looking at says
"The order is exactly as it was. Nothing was half-applied"** — `B-20`, and
SCREEN-INVENTORY POS-03 defines the state the same way. A control on that screen
that silently puts a removed line back contradicts the sentence next to it.

**The fix:** clearing the rejection keeps the view's order selection, `gone`
included. It clears the notice and nothing else.

**The test is the more important half.** The existing preservation check starts
from the untouched `error` fixture, where the before and after orders coincide
**because `error` and `default` draw the same lines** — so it passes on the
defect. Add the remove-then-retry sequence and assert the retained rows, the
totals, the discount, the absent notice and the unchanged history depth.

**This is the lead's error before it is anyone's.** FE-011's criterion 5 said
*"returns to the order the notice was drawn over"* and could be satisfied without
being met, because no case in it made the right answer differ from the wrong one
— the exact trap this project recorded twice in the last three slices and then
walked into again.

---

## 2. P2 — `quick-line`'s static fixture escapes the reachability sweep

**`quick-sale.test.tsx:307`; the sweeps at `sheets.test.tsx:185` and its fixed
list at `:63`; the corrected exclusion at `:501`.**

F2d fixed the **negative** sweep to read `SHEET_FIXTURES` rather than a hardcoded
array — right move. The **positive** sweep, the one that actually follows
controls, still enumerates F2c's three sheets plus the discount sheets, so
**`quick-line` is in neither.** Its own block asserts button markup and an inert
background, and presses nothing.

The reviewer traced the consequence rather than asserting it, and was careful to
say what it is not: **the submitted destinations are correct and there is no
approval bypass.** It is a blind guard. Point the static `quick-line` fixture's
*Remove line* at `{ state: 'approval' }` and nothing fails — the dynamic editor
tests use `panelLine`'s separately-built destinations, and the sweep never visits
the static fixture.

**The fix:** derive the ungated-sheet reachability cases from `SHEET_FIXTURES`,
assert the covered set **is** every such fixture (so the next sheet cannot be
added outside it), and follow `quick-line`'s Back, close and *Remove line*. Keep
every detector self-test exactly as it is — that detector's second half, the one
proving it ignores a control inside an inert subtree, is the sharpest test on
this project and is not yours to touch.

The reviewer notes the sweep's table-specific panel assertions are tangled with
its generic reachability ones. Separate them if that is what it takes to add a
quick form without weakening either; say so if you judge that a bigger change
than this slice should carry.

---

## What must not change

- **Everything the review cleared.** `B-17`'s refusal rule, the inert-versus-
  absent fire distinction, `fireerror`'s composition, the quick-sale identity,
  `I-12`, `B-12`, the fire parameterisation, and the repeated-rendering keys.
  Read its *Rules cleared* and *Guard audit* sections before you touch a test.
- **No test deleted or weakened.** Two are being made stronger; nothing else
  moves.
- **`fire.ts` stays pure and untouched.**
- **No invented values, no `Number()` on money, no hover outside
  `@media (hover: hover)`, no console, storage, cookie or fetch.**
- **Only *Settle* pushes a history entry.**

---

## Acceptance criteria

1. **Try again keeps the order**, `gone` included, and clears only the notice.
   Tested by the remove-then-retry sequence, from `error`.
2. **Prove it red**: restore the discarding destination and say how many tests
   fail. The count must be non-zero *because of the new sequence*, not because
   of an unrelated assertion.
3. **The positive reachability sweep is derived from `SHEET_FIXTURES`** and
   asserts it covers every ungated sheet fixture, `quick-line` included.
4. **`quick-line`'s static exits are followed** — Back, close, *Remove line*.
   **Prove it red** by pointing that fixture's *Remove line* at a gated state and
   showing the sweep now fails, then restore it.
5. **All 1127 existing tests pass**, none deleted or weakened; every changed test
   listed with its reason.
6. **`npm run verify` passes.** State the new counts. Typecheck clean.
7. **Verify item 1 in a browser** and say what you saw.

---

## Out of scope

- **The `itemId` identity gap** the review raises at the end: a line with no
  menu tile is treated as non-blocking, and *"a missing tile does not establish
  availability"*. Correct, and not a reachable defect in these fixtures. **The
  lead carries it**; do not change the rule.
- Everything else the review lists as held: fire execution, `UNKNOWN`, reprint
  and settlement destinations, empty and locked quick-sale compositions, focus
  trapping, the stacked scrims, the single-`gone` limitation.

---

## Handoff

**Both corrections built on `agent/phase-0-foundations`, uncommitted. `npm run
verify`: typecheck clean, 19 files, 1136 tests passed, up from 1127.**

### 1. Try again keeps the order

`MenuRegion.tsx:104` (now: 113): the button's `onClick` navigates to
`{ ...fixture.rejected!, gone: view.gone }` instead of `fixture.rejected!`
bare. `fixture.rejected` still names which state's figures this rejection was
drawn over (`{ state: 'default' }`); `view.gone` is the one thing that has to
survive the trip, since `error` and `default` share the identical order data
(`tableOrder`/`tableTotals`/`tableTotalsWithout`) and only the menu-level
notice differs between them.

Added `apps/pos/test/fire.test.tsx`: *"a line removed under the notice stays
removed once Try again clears it"* — removes Steak from `error`
(`?state=error&gone=steak`, total 155.925), presses Try again, and asserts the
URL is `?state=default&gone=steak`, the drawn order and totals are unchanged,
the notice is gone, and history length didn't move.

**Proved red:** reverted the destination to `viewSearch(fixture.rejected!)`
(discarding `gone`) — the new test failed (`'?state=default'` vs
`'?state=default&gone=steak'`), the other 137 tests in the file stayed green.
Restored, confirmed green again.

**Verified in a browser** (`http://127.0.0.1:5173/pos/order?state=error`,
dev server already running): pressed Steak's × (URL → `?state=error&gone=steak`,
total 155.925), pressed **Try again** (URL → `?state=default&gone=steak`), and
the panel still read Burger + Soda only, total still 155.925, no notice. Before
the fix this landed on `?state=default` with Steak back and total 382.725 —
matched the review's reproduction exactly.

### 2. The positive reachability sweep now covers `quick-line`

`apps/pos/test/sheets.test.tsx`: added `SHEET_STATES = Object.keys(SHEET_FIXTURES)`
and `REACHABILITY_STATES = [...SHEET_STATES, ...F2I_SHEETS]`, and pointed the
`describe.each` that presses every live control (acceptance criterion 1) at
`REACHABILITY_STATES` instead of the hand-kept `[...BUILT, ...F2I_SHEETS]`.
Added one test asserting `SHEET_STATES` is exactly
`['quick-line', 'sheet-item', 'sheet-item86', 'sheet-line']` and that
`REACHABILITY_STATES` contains all of it — the guard against a fifth fixture
being added and left out again.

**Split out**, not weakened: *"the panel stays legible beside the sheet"*
asserted the fixed names `['Burger', 'Soda', 'Steak']`, which is true for the
three F2c sheets and F2i's four (all opened over the table order) but not for
`quick-line` (opened over the counter order — Burger, Soda only). Moved it to
its own `describe.each([...BUILT, ...F2I_SHEETS])`, unchanged in content,
scoped to the states it was actually written for. *"tags the pending line 86"*
stayed in the generic sweep — `quick-line`'s menu fixture is `{}`, no 86'd
items, so `expect(tagged).toEqual([])` holds there too without narrowing.

Added `apps/pos/test/quick-sale.test.tsx`, next to the existing markup-only
`quick-line` block: a new `describe` that presses Back, Escape, and *Remove
line* by name and checks where each actually lands (`quick`, ungated, with the
counter order's own lines drawn correctly afterward) — the thing the review
said no existing test did.

**Proved red:** temporarily pointed `quick-line`'s `remove` at
`{ state: 'approval', gone: 'q-burger' }` (`sheetFixtures.ts`). Two failures,
not one: the generic sweep in `sheets.test.tsx` (`['approval']` found among
gated destinations) and the dedicated `quick-line` test in
`quick-sale.test.tsx` (`dialog()` was not null — landed on the approval
prompt instead of closing). 156 of 158 tests across the two files stayed
green. Restored to `{ state: 'quick', gone: 'q-burger' }`, confirmed both
green.

### What I did not touch

`fire.ts`, `discount.ts`, `void.ts` — untouched. No test deleted, no assertion
loosened; two are stronger, and the table-specific one that moved kept its
exact content. `itemId` identity gap left alone, as scoped.

### Judgement call, raised rather than taken

The review's finding 2 phrase was "follow quick-line's Back, close and Remove
line". There's no explicit close-X control on a sheet — `SheetFrame`'s
`onClose` fires only from Cancel/Back and from Escape (existing pattern at
`sheets.test.tsx:266`). I read "close" as Escape and added a dedicated test for
it. If "close" meant something else, say so and I'll adjust — it's a two-line
change.

No commit made. `.agent/MEMORY.md` and `.agent/ROADMAP.md` untouched.
