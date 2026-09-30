---
id: DESIGN-010
title: Register the two closed-order tokens and make every refund fixture keep its own order's tenders
category: ui
touches: [money]
depends_on: [DESIGN-009]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-010 — Two closed-order tokens and the refund fixtures' allocations

**Status:** Written 2026-09-30 by `lead`. Unassigned.
**Owner:** a designer on the model in agents.yaml `roles.designer` (Codex `gpt-6-astra`,
effort high), opened in its own pane by the lead with the model passed explicitly.
**Branch and place:** `agent/design-010`, cut from `development`, in the worktree
`../restaurant-pos-wt/DESIGN-010`. Touch nothing under `apps/`, `packages/` or `db/`, and
nothing in the main checkout at `../restaurant-pos`.

## Objective

DESIGN-009 drew POS-05 (closed orders) and POS-06 (closed order detail) in Frost and left
two things for a small follow-up. First, two layout values have no token, so the artifacts
use flexible stand-ins; the lead ruled that both tokens be registered with the values
DESIGN-009 proposed, and the stand-ins replaced. Second, the review found that the walkable
POS-06 fixture replaces the selected order's refund allocation with a split-sale example
whatever order is selected, so a cash-only or quick-sale order shows a tender it never took.
When this task is done, both tokens are in the registry and used, and every refund state of
`closed-order.html` shows only the selected order's own tenders, summing to its own total.
F4e, the code slice that builds these screens, reads these artifacts, so a wrong fixture
here becomes a wrong test there.

## Required inputs

Everything you need is here or cited.

1. `.agent/tasks/DESIGN-009-closed-orders-and-refund.md`:
   - *Round 2*, item 6 (F8), `:838–860`: the stand-ins and the two proposed tokens;
   - *Rulings on round 2's five questions*, item 4, `:354–356`: the lead's ruling to register them;
   - owner ruling O1 at `:302–303`, and O2 and O3 below it.
2. `.agent/reviews/DESIGN-009-review.md`, finding F1 (`:15–25`): the fixture defect and the
   reviewer's proposed fix.
3. `docs/design/visual-directions/frost/pos/closed.js`, `closed.css`, `closed-order.html`,
   `closed-orders.html`, and `docs/design/visual-directions/manifest.js`.
4. `docs/DESIGN.md`, section *Tokens* (from `:486`), for the registry's two provenance
   shapes, and the *DESIGN-009 supplement* (from `:1072`), which records the stand-ins.
5. `docs/design/tokens/frost.tokens.json` (the registry; for the pattern, see
   `--frost-menu-columns` at `:1275` and `--frost-approval-columns` at `:1726`) and the
   generated `docs/design/tokens/frost.css`.
6. The contract: `docs/PRD.md` FR-H5 and AC-25, AC-34.

## Part A — the two tokens

1. Register these two tokens in `frost.tokens.json` with the values DESIGN-009 proposed,
   and regenerate `frost.css` from it so that the two files agree:
   - `--frost-closed-list-columns: 88px 172px minmax(0,1fr) 180px` — POS-05's four
     columns: *Closed at*, *Order*, *Payment taken*, *Total*;
   - `--frost-allocation-field-width: 180px` — the refund allocation amount field.
2. Their provenance follows `docs/DESIGN.md`'s rule, one shape per token, never mixed. They
   were first authored in DESIGN-009 round 1's `closed.css` and are sourced from the
   artifact that uses them once this task lands. Say in the Handoff which shape you used and why.
3. Replace the stand-ins in `closed.css`:
   - the list header and every row (`.co-listhead`, `.co-row`) use
     `--frost-closed-list-columns`;
   - the allocation field uses `--frost-allocation-field-width`, in place of the
     `repeat(2,minmax(0,1fr))` half-row grid on `.co-allocation`.

   The amount-filter and allocation-editor outputs (`flex:1`) are not part of this. Leave them.
4. Update the DESIGN-009 supplement in `docs/DESIGN.md` so that it no longer says the columns
   are flexible pending tokens.

## Part B — every refund state keeps the selected order's tenders

`closed.js:99–100` overwrites `allocations` for six states, whatever `order=` names:
`sheet-edited`, `sheet-invalid`, `refund-error` and `day-refusal` get Card 80.000 and Cash
75.925 (or 55.925), and `sheet-zero` and `approval-edited` get Card 0 and Cash 155.925.
That is right only for the split sale (`order=default`, Card 100.000 plus Cash 55.925). For
`order=cash`, `order=custom`, `order=quick` and the long order it adds a tender the order
never took (O1) or sums to the wrong total.

1. For each of those six states and every order that state can be opened with, the
   allocation rows are exactly the selected order's own tenders, in order, and:
   - `sheet-edited`, `approval-edited`, `refund-error` and `day-refusal` sum exactly to that
     order's total;
   - `sheet-invalid` misses that order's total by a stated amount, and its copy names it;
   - `sheet-zero` sets one of that order's rows to 0. An order with a single tender cannot
     picture a zero row and still sum; say what `sheet-zero` shows for it, or make the state
     reachable only for orders with two or more tenders, and say which.

   How you get there is yours: derive the edited allocation from the order, or restrict a
   state to the orders it makes sense for. If you restrict one, an incompatible `order=`
   must not change the state's subject; say what it shows instead.
2. Where `refund-error` is not eligible (zero, refunded, closed day), nothing changes: DESIGN-009's
   F6 gating stays.
3. **Add a cash-only failure example**, registered in `manifest.js`: `refund-error` on the
   Table 7 cash order (the AC-25 fixture, Cash 155.925 contributed from a 200.000 note). Its
   *Review refund* reopens the sheet with Cash 155.925 and no Card row. The manifest may
   carry it as a named state or as a state with `order=cash`; the gallery must reach it.

## Constraints

- **Registry values are those two, exactly.** Any other value with no token: raise it; do not add one.
- **No code.** Nothing under `apps/`, `packages/` or `db/`.
- **No contract edits.** Do not edit the four product documents or an accepted ADR.
- **Do not reopen O1 to O4** or any DESIGN-009 ruling. They are the owner's and the lead's.
- **No other state changes appearance** except those named here: the POS-05 list columns in
  every state, the allocation field in the six sheet states that have rows, and the six
  refund states when opened with a non-split order. Name every state you touched.
- **Measure in a browser at 1280×800**, not by arithmetic. The owner approved headless
  Chrome through Playwright for DESIGN-009 on the same terms: script and screenshots outside
  the repository, nothing committed. If your environment cannot run it, say so in the
  Handoff, and the lead measures instead. Do not claim a measurement you did not make.
- `frost.css` is imported by the POS app (`packages/tokens/frost.css` re-exports it), so
  adding tokens is visible to `npm run verify`. Do not run `npm ci` in the worktree. If
  verify cannot run there, say so; the lead runs it at review.

## Tests expected to change

None. Adding two custom properties to `frost.css` must not change any test result. If
`npm run verify` is affected, stop and raise it.

## Acceptance criteria

1. Both tokens exist in `frost.tokens.json` and in `frost.css` with exactly the values in
   Part A, and the two files agree. Red if either file lacks one or the values differ.
2. `closed.css` uses both tokens and no longer contains the `minmax(0,1fr) minmax(0,1fr)
   minmax(0,3fr) minmax(0,1fr)` list stand-in or the `repeat(2,minmax(0,1fr))` allocation
   grid. It still contains no raw colour, `px` value or numeric font weight, and every
   `--frost-*` it references is defined. Red on any of these.
3. At 1280×800 the POS-05 columns measure 88, 172, the remainder, and 180px, and
   `1.559.250` in the overflow state is not clipped. Each allocation field is 180px wide in
   `sheet-refund`, `sheet-custom` (six rows) and `sheet-edit`. The Handoff gives the
   measured widths and how they were measured. Red if the list scrolls sideways or a figure is clipped.
4. For each of the six states in Part B opened with each of `order=default`, `cash`,
   `custom` and `quick`, the sheet and the M-1 *Money back* line list only that order's
   tender names. The Handoff has a table: state × order → rows shown and their sum. Red if
   any cell shows a tender the order did not take, or a sum other than stated.
5. `closed-order.html?state=refund-error&order=cash` → *Review refund* → the sheet shows
   Cash 155.925 and no Card row; *Continue to manager PIN* shows *Money back: Cash
   155.925* with no `ALLOCATION EDITED` tag. The cash-only failure example is in
   `manifest.js`. Red if a Card row appears.
6. The crawl DESIGN-009 ran still passes: every declared state of the seven POS artifacts
   loads with no JavaScript error, and every collected link resolves to an existing file
   and declared state. `grep -r "prototype/" docs/design/visual-directions/frost/pos`
   returns nothing.
7. The Handoff names every state whose appearance changed, and why.

## Out of scope

- Building anything. F4e builds these screens.
- Any other DESIGN-009 state, the floor, settlement, order or incidents artifacts.
- The two back-office Frost artifacts and their wireframe links.
- The questions still open from DESIGN-009: older-day lookup and retention, receipt content
  and numbering, post-close corrections, and the M-1 verifying-state cancel.

## Reporting

Commit on `agent/design-010` only when done, and never push. Append your Handoff below:
what changed and where, the provenance shape and why, the Part B table, what you measured
and how, and every question raised with a proposed answer.

Then run `herdr agent prompt lead "<your name>: DESIGN-010 done — <one line>"`, or
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff
