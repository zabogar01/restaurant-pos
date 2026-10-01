---
id: DESIGN-010
title: Register the two closed-order tokens and make every refund fixture keep its own order's tenders
category: ui
touches: [money]
depends_on: [DESIGN-009]
owns: [docs/design/**, docs/DESIGN.md]
status: complete
cycles: 1
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
   *(Corrected by the lead on 2026-09-30 at design010's request. POS-05's overflow has no
   `1.559.250` row; that figure is POS-06's long order. Measure the unchanged POS-06 figure,
   and check the 180px Total column with a temporary, browser-only POS-05 row carrying
   `1.559.250`, which is not committed. In `sheet-edit` the keypad output replaces the rows and
   keeps its `flex:1` width; measure the allocation field at 180px after *Cancel edit* instead.)*
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

## Round 2 — the review's two findings (lead rulings, 2026-09-30)

Review: [DESIGN-010-review.md](../reviews/DESIGN-010-review.md), two low findings, both
accepted as the reviewer proposed. Change nothing else. Leave the review file alone; the lead
commits it.

1. **F1 — `docs/DESIGN.md`.** Change the source-shaped count from 168 to 170 at `:3` and
   `:489`. After the sentence ending "and the authored value" (`:490`), add the reviewer's
   sentence recording that the two DESIGN-010 tokens cite their consuming declaration, and
   that their values were first authored in DESIGN-009 round 1 (`06f3a25`, `closed.css:12`
   and `:17`) and registered by the lead's ruling on round 2's question 4. Say the same
   origin in the DESIGN-009 supplement (`:1078–1079`).
2. **F2 — `refund-error-cash` keeps its subject.** In `closed.js:90`, the named state takes
   precedence over `order=`, so `?state=refund-error-cash&order=default` still shows Table 7,
   cash only.

Append a `### Round 2` section to your Handoff answering both by number, with how you checked
F2 (a browser run on the permitted terms, or say you could not). Commit on
`agent/design-010`.

## Handoff

DESIGN-010 registers the approved closed-order layout tokens and corrects the
illustrative refund drafts without changing application source or the contract.
The changes are in `docs/design/tokens/frost.tokens.json`, its generated
`frost.css`, the Frost POS artifacts' `closed.css`, `closed.js` and
`closed-order.html`, `visual-directions/manifest.js`, and the DESIGN-009
supplement in `docs/DESIGN.md`.

### Tokens and provenance

`--frost-closed-list-columns` is exactly
`88px 172px minmax(0,1fr) 180px`. Both `.co-listhead` and `.co-row` use it.
`--frost-allocation-field-width` is exactly `180px`; `.co-allocation .co-field`
uses it, with the remaining row width assigned to the tender label. The
half-row grid stand-in is removed. The amount-filter and allocation-editor
outputs retain their existing `flex:1` rule.

Both entries use the **source-object shape**, with no `designed` block. The
values were authored in DESIGN-009 round 1, reviewed as missing tokens in
round 2 and approved for registration by the lead. They are not newly designed
values in this task. Their source objects cite the consuming artifact after
this change: `closed.css` line 12, `.co-listhead,.co-row`,
`grid-template-columns`; and line 17, `.co-allocation .co-field`, `width`.
`authoredValue` records the actual `var(--frost-...)` declaration at that
location, rather than claiming a literal still exists there. The registered
values are the DESIGN-009 values reproduced in Part A of this task. CSS was
regenerated from every registry entry in insertion order, retaining its
existing generated-file header. Every JSON value matches its CSS declaration.

### Refund examples and retained rows

The six examples now begin with the selected order's default allocations,
including cash less change and repeated original tender rows. No tender is
invented, combined or reordered. For multi-tender orders, `sheet-edited`,
`refund-error` and `day-refusal` move 20.000 from the first row to the last.
`sheet-invalid` subtracts 20.000 from the first row and displays
*Allocate 20.000 more. Allocations must equal <the order total> exactly.*
Continue remains disabled.

For multiple tenders, `sheet-zero` and `approval-edited` move the first row's
entire contribution to the last row, leaving the first at 0. The sheet and
M-1 identify that row as *not refunded*. For a single tender, the valid
`sheet-edited`, `approval-edited`, `refund-error` and `day-refusal` drafts
retain the full default contribution, with no ALLOCATION EDITED tag in M-1.
There is no other tender to move money to. A single-tender `sheet-zero` keeps
the selected subject, shows its only row at 0 and disables Continue. Its copy
names the full shortfall: 155.925 for cash, 173.250 for quick sale, or
1.559.250 for the long order. No state silently substitutes another order.

The table includes the four required orders and the additional long-order
coverage. All amounts are whole rupiah. For `day-refusal`, these are the
retained attempted allocations, not visible refund controls: the business day
is closed, so neither the sheet nor M-1 can reopen. That eligibility is
unchanged. Invalid drafts likewise cannot reach M-1 until corrected.

| State | Selected order | Allocation rows, in order | Sum |
|---|---|---|---|
| `sheet-edited` | `default` | Card 80.000 · Cash 75.925 | 155.925 |
| `sheet-edited` | `cash` | Cash 155.925 | 155.925 |
| `sheet-edited` | `custom` | Card 20.000 · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 55.925 | 155.925 |
| `sheet-edited` | `quick` | Card 173.250 | 173.250 |
| `sheet-edited` | `long` | Card 1.559.250 | 1.559.250 |
| `sheet-invalid` | `default` | Card 80.000 · Cash 55.925 | 135.925 |
| `sheet-invalid` | `cash` | Cash 135.925 | 135.925 |
| `sheet-invalid` | `custom` | Card 20.000 · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 35.925 | 135.925 |
| `sheet-invalid` | `quick` | Card 153.250 | 153.250 |
| `sheet-invalid` | `long` | Card 1.539.250 | 1.539.250 |
| `refund-error` | `default` | Card 80.000 · Cash 75.925 | 155.925 |
| `refund-error` | `cash` | Cash 155.925 | 155.925 |
| `refund-error` | `custom` | Card 20.000 · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 55.925 | 155.925 |
| `refund-error` | `quick` | Card 173.250 | 173.250 |
| `refund-error` | `long` | Card 1.559.250 | 1.559.250 |
| `day-refusal` | `default` | Card 80.000 · Cash 75.925 | 155.925 |
| `day-refusal` | `cash` | Cash 155.925 | 155.925 |
| `day-refusal` | `custom` | Card 20.000 · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 55.925 | 155.925 |
| `day-refusal` | `quick` | Card 173.250 | 173.250 |
| `day-refusal` | `long` | Card 1.559.250 | 1.559.250 |
| `sheet-zero` | `default` | Card 0 (not refunded) · Cash 155.925 | 155.925 |
| `sheet-zero` | `cash` | Cash 0 (not refunded) | 0 |
| `sheet-zero` | `custom` | Card 0 (not refunded) · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 75.925 | 155.925 |
| `sheet-zero` | `quick` | Card 0 (not refunded) | 0 |
| `sheet-zero` | `long` | Card 0 (not refunded) | 0 |
| `approval-edited` | `default` | Card 0 (not refunded) · Cash 155.925 | 155.925 |
| `approval-edited` | `cash` | Cash 155.925 | 155.925 |
| `approval-edited` | `custom` | Card 0 (not refunded) · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 75.925 | 155.925 |
| `approval-edited` | `quick` | Card 173.250 | 173.250 |
| `approval-edited` | `long` | Card 1.559.250 | 1.559.250 |

The new declared and gallery-registered state `refund-error-cash` selects
Table 7 by default. It is equivalent to
`closed-order.html?state=refund-error&order=cash`. Both paths were exercised
through *Review refund* and *Continue to manager PIN*: the sheet has only
Cash 155.925, and M-1 reads exactly *Money back: Cash 155.925*, without
ALLOCATION EDITED. The original Cash 200.000 and change 44.075 remain in the
closed order's payment history. `refund-error` continues to describe a
**definite rejection**. No-response recovery still requires rereading the
order before a retry; this task adds no command or persistence behavior.

### Measurements and browser evidence

I ran headless Google Chrome through Playwright with a 1280×800 viewport.
The `.co-app` bounding box was 1280×800. The initial sandbox launch failed
with SIGABRT; the task-authorized escalated browser runs succeeded. Scripts,
JSON output and screenshots are outside the repository in
`/private/tmp/design010/`; none is committed. The completed check is
`check.cjs`, and its evidence is `report.json`.

Measurements use `getBoundingClientRect()`, computed grid columns, DOM Range
text bounds, and `scrollWidth`/`clientWidth` in Chrome, not arithmetic from CSS.

| Surface and state | Browser result |
|---|---|
| POS-05, every one of its 11 states | The header and every rendered row measured 88 / 172 / 752 / 180px. The list's scroll width equalled its client width: no sideways scrolling. |
| POS-05 `overflow`, temporary text stress case | `1.559.250` measured 80.078125px inside the 180px Total column, with both text edges inside the cell. The text replacement existed only in the browser; the fixture is unchanged. |
| POS-06 `overflow` | The existing `1.559.250` grand total measured 106.765625px, with text bounds inside its cell. |
| `sheet-refund` | Both allocation fields measured 180px. |
| `sheet-ac25` | Its one allocation field measured 180px. |
| `sheet-custom` | All six allocation fields measured 180px. |
| `sheet-edited`, `sheet-invalid`, `sheet-zero` | Both default-order allocation fields measured 180px in each state. |
| `sheet-edit` | The keypad output retained `flex:1` and measured 522px. After Cancel edit, both allocation fields measured 180px. |
| POS-05 `filter-amount` | The output retained `flex:1` and measured 730.328125px. |

I inspected the before/after list and six-row sheet screenshots, and the
cash-only M-1 screenshot. The tender labels and figures are legible; the
six-row sheet retains its scrolling body and fixed footer. The temporary
large list total is visibly inside its column.

### Validation and limits

- The completed browser crawl visited **160 declared states across seven POS
  artifacts** with **zero JavaScript errors**. All **350 distinct collected
  links** resolve to existing files, and the collected POS state links name
  declared states. POS-05 and POS-06 manifest state lists match their HTML
  declarations. The gallery loads `refund-error-cash` in its Frost iframe.
- All 30 state/order combinations in the table preserve the original tender
  rows and satisfy their expected sums. Reachable sheets and M-1 subjects
  were checked by their actual controls. The test also used a temporary,
  read-only browser accessor to inspect retained drafts, including
  `day-refusal`; it did not enable forbidden controls or modify repository
  scripts. Both cash recovery entry points were separately checked with the
  unmodified fixture script.
- Zero-total and already-refunded `refund-error` examples have no Review
  refund control. Closed-day details and every `day-refusal` combination have
  no Refund control, including after Return to order.
- Every Frost token referenced by `closed.css` exists in the registry. The
  stylesheet has no raw color, pixel length or numeric font weight. Both
  stand-ins are absent, and JSON/CSS registry values agree.
- `rg -n "prototype/" docs/design/visual-directions/frost/pos` returned no
  matches. `git diff --check` passed.
- **`npm run verify` could not run in this worktree.** It exited 127 during
  typecheck with `sh: tsc: command not found`. Unit tests did not run. I did
  not run `npm ci`, install dependencies or change build files. The lead was
  notified to run verify at review, as this task explicitly permits when the
  worktree cannot run it. No application verification pass is claimed.
- These are illustrative fixture checks. No real refund command, manager
  authentication, printer operation, persistence or audit entry was tested.

### Appearance changes and scope

The following names enumerate the affected states and interactions:

1. POS-05 `default`, `empty`, `loading`, `error`, `overflow`, `nomatch`,
   `dayclosed`, `dayclosed-start`, `filter-table`, `filter-time` and
   `filter-amount`: the shared header and rendered rows use the registered
   fixed columns. Filter controls and outputs keep their styling.
2. POS-06 `sheet-refund`, `sheet-ac25`, `sheet-custom`, `sheet-edited`,
   `sheet-invalid` and `sheet-zero`: allocation amount buttons become 180px
   wide. The same rule applies whenever an existing interaction opens these
   allocation rows, including Cancel edit from `sheet-edit`, Cancel reason
   from `sheet-other`, cancellation of `approval` or `approval-edited`, and
   Review refund from `refund-error`. The keypad and reason-editor initial
   views retain their appearance.
3. POS-06 `sheet-edited`, `sheet-invalid`, `sheet-zero`, `approval-edited`,
   `refund-error` and `day-refusal`, when parameterized with a non-split order:
   the selected order keeps its own rows and totals as documented above.
   Only the first four render changed allocation content immediately;
   `refund-error` reveals it on Review refund. `day-refusal` retains the
   correct hidden attempted draft while its refusal composition is unchanged.
   The original split-sale allocation figures and M-1 subject stay the same.
4. `refund-error-cash` is the one added POS-06 state and gallery option. It
   uses the existing failure composition for Table 7.

No other artifact was edited. Application source, tests, product documents,
accepted ADRs, floor, settlement, order, incidents and back-office artifacts
are untouched. The task frontmatter is untouched. The lead's separate
acceptance-criterion correction is retained alongside this Handoff.

### Questions raised and resolved

I raised two contradictions in acceptance criterion 3 and proposed measuring
the existing POS-06 large total plus a temporary POS-05 text stress case, and
measuring allocation fields after Cancel edit while retaining the keypad
output's `flex:1` width. The lead accepted both proposals and inserted the
correction into this task on 2026-09-30. I followed that correction. There
are no new design or contract questions. The remaining review action is the
lead's `npm run verify` in an environment with dependencies.

DONE

### Round 2

1. **F1 — token count and provenance wording.** `docs/DESIGN.md` now says
   170 source-shaped tokens in both its frontmatter description and its
   Tokens paragraph. The paragraph records the two DESIGN-010 exceptions:
   their source locations are their consuming declarations, whose authored
   values are the tokens themselves. Their values originated in DESIGN-009
   round 1 (`06f3a25`, `closed.css:12` and `:17`) and were approved by the
   lead's ruling on round 2's question 4. The DESIGN-009 supplement records
   the same origin. I counted the registry directly: 174 entries, consisting
   of 170 source-shaped entries and four designed entries. Both corrected
   counts and both origin statements were checked. No registry or CSS value
   changed.
2. **F2 — the named cash-only failure keeps Table 7.** The `selected`
   expression in `closed.js` now gives `refund-error-cash` precedence over
   `order=`. I ran headless Chrome through Playwright at 1280×800, using the
   task's permitted browser terms. I opened the named state with no order
   parameter and with each of `default`, `cash`, `custom`, `quick`, `long`,
   `zero` and `refunded`. All eight cases showed Table 7. In each case,
   *Review refund* showed exactly one Cash 155.925 allocation, and *Continue
   to manager PIN* showed exactly *Money back: Cash 155.925*, with no Card
   row or ALLOCATION EDITED tag. Three additional checks confirmed that the
   general `refund-error` state still respects `order=default`, `quick` and
   `cash`, including the existing edited split-sale allocation. All 11
   browser cases passed with no JavaScript errors. The script, JSON results
   and screenshot are in `/private/tmp/design010-round2/`, outside the
   repository and not committed.

I ran `npm run verify`: typecheck passed, and Vitest reported **32 test files
passed and 2,256 tests passed**, exit code 0. Dependencies are available in
this worktree now; I did not install them or run `npm ci`. `git diff --check`
passed. I did not repeat layout measurements or the full state/link crawl,
because this round changes only provenance text and named-state precedence.

This round changes only `docs/DESIGN.md`, the selection expression in
`closed.js`, and this appended Handoff. The review file remains untracked,
unstaged and unedited; its SHA-256 digest matched before and after the work.
The task frontmatter and rulings are unchanged. No questions remain.

DONE
