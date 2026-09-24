# DESIGN-007 — POS-03: every tile its own item, a quantity that saves, and what firing shows

**Status:** Delivered and accepted 2026-09-24. Round 1 by `designer5` (codex `gpt-6-astra`); review by `design-reviewer3` requested changes (2 P2); round 2 corrected both, lead-verified in headless Chrome. Uncommitted
**Owner:** unassigned — to be a codex designer on `gpt-6-astra` (the owner's choice)
**Written:** 2026-09-24 by `lead`
**Depends on:** [DESIGN-005](DESIGN-005-a7-three-missing-states.md), [DESIGN-006](DESIGN-006-settlement-corrections.md)
**Branch and place:** `agent/design-direction`, in **this worktree**
(`restaurant-pos-design`). Do **not** touch the code checkout at
`../restaurant-pos` or anything under `apps/`.

---

## Why this task exists

POS-03 now has a real order store (FS, FE-014): *Add to order* adds a line, the
total moves, and a cashier can walk an order to payment. Walking it exposed
three places where `docs/design/visual-directions/frost/pos/order.html` draws
nothing a real flow can use. **Together they decide whether a cashier can build
a real table order and pay it.** The owner ruled on 2026-09-24 that these three
go before F4.

---

## Part A — every tile opens its own item

**The defect.** Every tile links to `order.html?state=sheet-item`, which is
**Burger's** sheet (`order.html:101`, `:111`, `:399–431`). The implementation
copied that, so tapping *Fish & Chips* today adds *a Burger with extra cheese at
135.000*. Only Burger has a reviewed option set.

**The owner's ruling:** model the other items on what exists. Each of the twelve
items the grid already draws gets its own sheet, with its own name and price:

| Item | Price | Item | Price |
|---|---|---|---|
| Burger | 100.000 | Soup of the Day | 55.000 |
| Chicken Wings | 90.000 | Fries | 40.000 |
| Steak | 240.000 | Onion Rings | 45.000 |
| Fish & Chips | 140.000 | Soda | 30.000 |
| Caesar Salad | 75.000 | Coffee | 35.000 |
| Beer | 65.000 | House Wine | 80.000 |

Draw it as follows:

1. **Keep Burger's sheet exactly as it is.** It is the one reviewed option set.
2. **Give each other item an option set in Burger's shape.** That means a
   *choose one* group and/or a *choose any* group, with modifier prices in the
   same `+20.000` / `−10.000` form. Keep the sets plausible and small: Steak's
   doneness, a sauce for Wings, a size for drinks. **These are fixture data, not
   a catalogue.** Say so in the handoff, list every set, and show each modifier
   price's arithmetic in the line total.
3. **At least one item has no options at all** (Soda or Coffee are the obvious
   candidates). Draw that composition deliberately. It needs the name, the
   price, the line total, Cancel and Add, with no empty group labels.
4. **Each tile links to its own sheet state.** Name the states
   `sheet-item-<id>`, using the ids `burger wings steak fish salad soup fries
   rings soda coffee beer wine`. `sheet-item` stays as Burger's alias, so older
   links keep working.
5. `sheet-item86` stays Burger's. Do not multiply the 86'd state across twelve
   items.

## Part B — a line's quantity actually saves

**The defect.** Both line editors (`sheet-line` at `order.html:457`, and
`quick-line` at `:432`) draw a − / field / + stepper, but their only buttons
are **Back** and **Remove line**. The number can never be committed. `FR-D5`
says a `PENDING` line may be edited freely, and `FR-M5` caps quantity at 99.
Neither has a reachable path in the design. The sheet's own copy says *"This
sheet exists for quantity, which has nowhere else to live"*, and then gives it
nowhere to go.

**The owner's ruling:** there is a button that adjusts the quantity, modelled
on Square's quantity control. **The owner's reference screenshot is in
`REFERENCE:` below.** Match its interaction, not its visuals: Frost stays
Frost.

**What the reference shows**, as read by the lead: Square uses **one sheet for
adding and for editing**, titled with the item and its price. Variations are
choose-one tiles, and each tile carries its price. The footer pairs a pill
stepper, **− 2 +**, with a primary **Save**. Nothing is committed until Save is
pressed, and the × discards.

**The lead's ruling, from the reference: an explicit commit.** Changes that apply on each press are rejected; the reference commits on Save.

Draw:

1. **The footer carries the stepper next to the primary action**, in the same
   way on both sheets:
   - the item sheet (Part A): **− n +** beside *Add to order*;
   - the line editors: **− n +** beside a primary that names the result, such
     as *Update to 3*, with **Back** discarding.

   When the number equals the line's current quantity, the primary is off.
   **Remove line** stays, but it is secondary and set apart from the stepper.
   A sheet must never show a number the order does not hold once it closes.
   Touch size is Frost's (88px keys), and the pill shape is not required.
2. **The bounds are drawn.** At 1, − is off, and it is **not** a remove:
   removal stays its own button. At 99, + is off, with the reason visible
   (`FR-M5`).
3. **Changed state:** one state showing a quantity changed from the line's
   original, such as Steak 1 → 3, with every affected figure recomputed. That
   includes the line amount, the subtotal, the discount, the service charge,
   the total and the included tax. Show the arithmetic.
4. **Quantity at add time:** the item sheet carries the stepper (as ruled in 1).
   Draw one add-time state at quantity 2 or more, with the line total
   multiplied, and show its arithmetic.
5. **Scope: pending lines only.** A fired line's quantity is a void (`FR-F*`,
   the void family). Do not draw a stepper on a fired line.

Apply this to both `sheet-line` and `quick-line`.

## Part C — what Send to kitchen does

**The owner's ruling, 2026-09-24, on the recommendation in
[ARCH-002](../../restaurant-pos/.agent/reviews/ARCH-002-fire-confirmation.md):
no confirmation dialog.** One press sends. **The control shows the count**,
for example *Send 2 to kitchen*, and the pending group already on screen serves
as the confirmation. This keeps ruling I-11 (confirmations in the back office,
PIN gates on the POS) and the six-modal count. **Do not draw a confirm modal.**
Read ARCH-002 §2 and §4 before you draw.

Draw each of these as an `[INLINE]` state of POS-03, table variant:

1. **`fire-ready`**: a pending group of one or more lines, nothing 86'd, and
   the control live and reading *Send n to kitchen*. **Decide whether n counts
   lines or quantities, and say which** in the handoff.
2. **`fire-queued`**: the lines that were pending form a new last round, and
   the pending group is gone. The heading follows the existing fired-round
   heading (`Round 3 · fired 20:14 · …`), with wording for *sending / not yet
   confirmed*. It must never say *printed*: no printer exists yet, and that
   would claim paper. The lines carry the fired tag, and the trailing slot stays
   reserved and empty (I-12). The control is **inert in place**, and Settle is
   live. Draw **where focus lands** afterwards (suggested: the new round's
   heading), and the polite status line (*Round 3 sent to the kitchen*).
3. **`fire-printed`**: as 2, with the heading reading *printed*. No banner.
4. **`fire-failed`**: today's `fireerror`, redrawn. It has the FAILED wording,
   the emergency banner with its reprint path (`FR-E3`, `AC-23`, `AC-33`), and
   the fire control inert so it cannot read as *send again*. **Fix the defect
   F2h found:** the round heading must not say *printed* under a banner saying
   the ticket did not print.
5. **`fire-unknown`**: this has **its own wording, distinct from FAILED.**
   `UNKNOWN` means the ticket *may* have printed. The copy must not claim that
   nothing printed, and it must tell the cashier to check with the kitchen
   before reprinting, because a false *not printed* leads to food cooked twice
   (`B-16`). It uses the same banner class and reprint path as FAILED. (This
   closes POS-03 question 4.)
6. **`fire-then-add`**: rounds 1..n fired, a new pending group below them,
   and the control live again with the new count (`FR-D3`, `FR-E2`).
7. **`fireblocked`** (exists): check it next to the new count label. Its known
   defect is that the notice can name a line scrolled out of view at 1280×800
   (POS-03 question 10). **Fix it if the composition allows. If not, say why.**
8. **Heading at width**: the longest heading (*Round 12 · fired 23:59 ·*
   followed by the longest UNKNOWN wording) at 1280×800. It must not wrap under
   the tag, and it must read in greyscale.

**Out of scope:** quick sale (it has no fire control, C-2), hold and coursing
(`FR-E1` sends every pending line), and any *resend round* control.

---

## Rules that still apply

- **Frost only.** Use existing tokens and classes in `structure.css`,
  `visual.css`, `frost-states.css`. A value that is truly new is **marked
  designed** (DESIGN-005's `source: null` + `designed` block), never disguised
  as sourced.
- **Do not edit `visual.css` or `structure.css`.** Their line numbers are
  provenance. New rules go in a separate sheet.
- **Touch geometry is Frost's.** Keys and buttons do not shrink to fit.
- **Contract documents are not yours** (`docs/PRD.md`, `docs/BOUNDARIES.md`,
  `docs/PRODUCT.md`, `docs/ROADMAP.md`). If a fix seems to need one, stop and
  tell `lead` (pane `w2:p1`).
- `SCREEN-INVENTORY.md` POS-03 and `SITEMAP.md` may gain the new states, and
  their counts must stay honest. A new state on an existing screen or sheet is
  not a new node (DESIGN-002).
- **Every figure is arithmetic you can show.**
- **The shape to check** (paid for five times): *one control or value shared
  across states hides the state where it is wrong.* Part A's defect is exactly
  that shape.

## Acceptance criteria

1. Each of the twelve tiles opens a sheet with **its own** name and price. The
   red case is Fish & Chips opening Burger.
2. At least one item draws the no-options composition. Every option set is
   listed in the handoff with its arithmetic.
3. `sheet-line` and `quick-line` each commit a quantity by an
   explicit commit (**− n +** and a primary that names the result), and the
   item sheet adds at the chosen quantity.
4. The bounds 1 and 99 are drawn, and − at 1 is not a removal.
5. A changed-quantity state exists with every figure recomputed and its
   arithmetic shown.
6. Part C's eight states exist. `fire-queued` never says *printed*, `fire-unknown`'s
   wording differs from `fire-failed`'s, and no confirm modal is drawn.
7. At 1280×800 nothing new is clipped. State how you measured.
8. **No other state changes appearance** unless the handoff names it and says
   why.

**A design review follows this task**, before the code is corrected against it.

## REFERENCE:

[`docs/design/references/square-quantity-1.png`](../../docs/design/references/square-quantity-1.png),
the owner's screenshot of Square's item sheet, 2026-09-24. **Take the
interaction from it, not the look.** Its *Note*, *Taxes* and *Item description*
sections are **out of scope**. The PRD grants no line note and no per-line tax
toggle, so do not draw them. It shows `Rp` because Square does. Whether this
POS shows `Rp` is an open owner decision, so keep amounts bare, as the
artifact does.

---

## Handoff

Write it below as you go. List every state added or changed, every figure with
its arithmetic, every option set, the chosen commit pattern, how you measured,
and any value you designed. Commit nothing unless the lead asks.

### 2026-09-24 — designer5 delivery

**Delivered for independent design review, not marked approved.** Worked only
in `restaurant-pos-design`, on `agent/design-direction`. No commits. Read
AGENTS, MEMORY, ROADMAP, WORKFLOW, the money/behavior boundaries and relevant
PRD/UX structure, ARCH-002 (including §2 and §4) in the sibling checkout, and
visually inspected the supplied Square PNG. No contract change or new ruling
was needed. The task header and coordination files are left to the lead.

#### Files and scope

- `docs/design/visual-directions/frost/pos/order.html`: all twelve tile
  destinations, 25 additional named fixtures, and links to the isolated files
  below. Superseded item/line overlay markup moved into the fixture composer
  so there is one definition, rather than a dead Back/Remove-only editor.
- `docs/design/visual-directions/frost-order-flow.js`: walkable **design
  fixtures**, not application code. Options and quantity drafts, explicit
  Add/Update/Back/Cancel, affected totals, and inline fire transitions. No API,
  storage, dispatcher, live clock, or printer. A page reload resets the fixture.
- `docs/design/visual-directions/frost-order-flow.css`: new compositions only.
- `docs/design/visual-directions/frost-order-flow.design.json`: honest
  `source: null` plus `designed` metadata for the new compositions.
- `docs/design/SCREEN-INVENTORY.md` POS-03 and `docs/design/SITEMAP.md`: added
  fixture descriptions under existing screen/sheet/inline nodes. No added
  node, screen, sheet, or modal: counts remain **7 POS / 13 back office / 6
  modals**. No fire confirmation.

`visual.css`, `structure.css`, `frost-states.css`, token registry/generated
CSS, Paper, behavioral prototype, contracts, application code and the sibling
checkout were not edited. The reference directory and task file were already
untracked on arrival; the supplied PNG was only read.

#### Part A — fixture options and arithmetic

**These sets are illustrative fixture data, not an approved catalogue or
production seed data.** Burger retains its exact reviewed base price, Size
and Extras choices/prices, and initial Large + Extra cheese selection. Its
footer changes only as Part B requires; a line calculation is now visible.
The other items follow the same flat choose-one / choose-any composition.
A star below identifies an initially selected choice; unstarred extras start
unselected. All initial quantities are 1 unless a quantity fixture says so.

| State suffix | Base | Choose-one set | Choose-any set | Initially shown line arithmetic |
|---|---:|---|---|---|
| `burger` | 100.000 | Size: Regular +0; Large +20.000 ★; Small −10.000 | Extra cheese +15.000 ★; Bacon +20.000; No onion +0 | (100.000 +20.000 +15.000) × 1 = **135.000** |
| `wings` | 90.000 | Sauce: Buffalo +0 ★; BBQ +0; Garlic butter +10.000 | None | (90.000 +0) × 1 = **90.000** |
| `steak` | 240.000 | Doneness: Medium rare +0 ★; Medium +0; Well done +0 | Pepper sauce +10.000 ★; Garlic butter +15.000 | (240.000 +0 +10.000) × 1 = **250.000** |
| `fish` | 140.000 | Sauce: Tartare +0 ★; Chilli mayo +5.000 | Extra fish +60.000 ★ | (140.000 +0 +60.000) × 1 = **200.000** |
| `salad` | 75.000 | None | Grilled chicken +25.000 ★; No croutons +0 | (75.000 +25.000) × 1 = **100.000** |
| `soup` | 55.000 | Bread: With bread +0; No bread −5.000 ★ | None | (55.000 −5.000) × 1 = **50.000** |
| `fries` | 40.000 | Seasoning: Salt +0 ★; Chilli +0 | Cheese sauce +10.000 | (40.000 +0) × 1 = **40.000** |
| `rings` | 45.000 | Dip: Ketchup +0; Garlic mayo +5.000 ★ | None | (45.000 +5.000) × 1 = **50.000** |
| `soda` | 30.000 | **None** | **None** | 30.000 × 1 = **30.000** |
| `coffee` | 35.000 | Size: Regular +0; Large +10.000 ★ | Extra shot +10.000 | (35.000 +10.000) × 1 = **45.000** |
| `beer` | 65.000 | Size: Regular +0; Large +25.000 ★ | None | (65.000 +25.000) × 1 = **90.000** |
| `wine` | 80.000 | Pour: Standard +0; Small −20.000 ★ | None | (80.000 −20.000) × 1 = **60.000** |

Every tile's actual href is `order.html?state=sheet-item-<suffix>`. Activating
it opens that item in place and keeps the current table/counter context.
`sheet-item` is still Burger's alias; `sheet-item86` remains Burger alone.
Soda draws name, base price, line total, calculation, quantity, Cancel, Add,
and no empty option labels. Every option is operable: the displayed
calculation lists each selected delta separately, then multiplies by quantity.
Choose-one replaces the previous delta; choose-any independently toggles its
delta. Example exercised: Burger Small + Bacon, no cheese, quantity 2 =
(100.000 −10.000 +20.000) × 2 = **220.000**.

The existing pending Steak used by the line-editor fixture is **240.000**,
Medium rare +0, with no extras. It is deliberately not replaced with the
new add-sheet selection (250.000 including pepper sauce): editing quantity
uses the line's existing resolved price, not the catalogue's current choices.

#### Part B — explicit commit and every affected figure

Footer order: separate Back/Cancel and secondary Remove line row; then
**− / quantity / + beside Add to order or Update to n**; then the bound.
Keys/output and commit are 88px high, keys/output 88px wide. Secondary buttons
retain 72px height. No controls shrink to fit. At 1, minus is disabled and
never removes; at 99, plus is disabled and “Maximum 99 per line” explains it.
Unchanged/reverted quantities disable Update. Back, Cancel and Escape discard.
The order panel is inert while the sheet is open, avoiding a fire against a
line being drafted. Draft figures are labeled **“After update · not saved
yet”** in the sheet; the panel continues to show committed figures. Update
recomputes the panel before closing; reopening reads the saved quantity.
Remove line remains explicit, ungated, and separate from the stepper.

Both table and quick editors use this pattern. Clicking another pending row
edits that actual row, including counter Soda and overflow lines; it no longer
silently opens a Burger/Steak editor for an unrelated line. Fired rows still
open the existing void path and never receive quantity controls.

New quantity fixture states:

- `sheet-item-two`: Burger 2 × 135.000 = **270.000**, not added yet.
- `sheet-item-max`: Burger 99 × 135.000 = **13.365.000**, plus disabled.
- `sheet-line-changed`: pending Steak **1 → 3**, 3 × 240.000 = **720.000**.
- `sheet-line-max`: pending Steak **1 → 99**, 99 × 240.000 = **23.760.000**.
- `quick-line-changed`: counter Burger **1 → 3**, 3 × 135.000 = **405.000**.
- `quick-line-max`: counter Burger **1 → 99**, 99 × 135.000 = **13.365.000**.
- Existing `sheet-line` and `quick-line` show quantity 1 unchanged, minus and
  Update disabled. Existing item sheets also start at 1 with minus disabled.

All arithmetic is in whole IDR, with integer-exact `BigInt` ratios. Define
`H(a/b)` as integer half-up rounding. `S = sum(unit × quantity)`,
`discount = H(S/10)` for the existing table Staff meal preset, `D = S − discount`,
`service = H(D/20)`, `total = D + service`, `included tax = H(D/11)`.
The counter fixture has no discount. Tax is order-level, display-only, and
service is untaxed. No preset was newly applied by these interactions.

| Fixture/result | Subtotal S | Discount | D | Service 5% | Total | Included tax 10% |
|---|---:|---:|---:|---:|---:|---:|
| Original table: 135.000 +30.000 +240.000 | 405.000 | 40.500 | 364.500 | 18.225 | **382.725** | 33.136 |
| Steak → 3: 135.000 +30.000 +720.000 | 885.000 | 88.500 | 796.500 | 39.825 | **836.325** | 72.409 |
| Steak → 99: 135.000 +30.000 +23.760.000 | 23.925.000 | 2.392.500 | 21.532.500 | 1.076.625 | **22.609.125** | 1.957.500 |
| Original counter: 135.000 +30.000 | 165.000 | 0 | 165.000 | 8.250 | **173.250** | 15.000 |
| Counter Burger → 3: 405.000 +30.000 | 435.000 | 0 | 435.000 | 21.750 | **456.750** | 39.545 |
| Counter Burger → 99: 13.365.000 +30.000 | 13.395.000 | 0 | 13.395.000 | 669.750 | **14.064.750** | 1.217.727 |
| Add Burger × 2: 405.000 +270.000 | 675.000 | 67.500 | 607.500 | 30.375 | **637.875** | 55.227 |
| Add Burger × 99: 405.000 +13.365.000 | 13.770.000 | 1.377.000 | 12.393.000 | 619.650 | **13.012.650** | 1.126.636 |
| Remove pending Steak: 135.000 +30.000 | 165.000 | 16.500 | 148.500 | 7.425 | **155.925** | 13.500 |
| Counter Soda → 2: 135.000 +60.000 | 195.000 | 0 | 195.000 | 9.750 | **204.750** | 17.727 |

For every other add-sheet selection, its table result is exactly
`S = 405.000 + displayed line total`, followed by the same sequence above;
Cancel leaves S at 405.000. Each stepper/option choice displays the expanded
line expression so no modifier price is hidden inside a total.

#### Part C — fire states, count and recovery

**n counts pending lines**, not summed quantities. The ready fixture has
Steak × 1 and Fries × 2: **2 lines / 3 units**, so it says **Send 2 to kitchen**.
Order-header counts in the newly composed fixtures explicitly say “lines”.
One press moves both to the next last round; no subset, hold, confirmation,
PIN, or resend. The action does not navigate or write browser history.

| State | What it shows |
|---|---|
| `fire-ready` | Rounds 1 and 2 already fired, pending Steak × 1 + Fries × 2, live Send 2 to kitchen. |
| `fire-queued` | New Round 3 · fired 20:14 · **sending · unconfirmed**. Pending gone; all trailing slots empty. Heading receives focus using Frost's focus treatment. Polite visible `role=status` / `aria-live=polite`: “Round 3 sent to the kitchen”. Fire inert, Settle live. |
| `fire-printed` | Same lines and amounts, Round 3 heading **printed**, no banner. This is a delivery fixture, never a claim made by the live fixture press. |
| `fire-failed` | Heading **FAILED · not printed**, emergency banner says ticket did not print and links to Open incidents. Fire inert; Settle live. |
| `fire-unknown` | Heading **UNKNOWN · may have printed**. Emergency banner: “Ticket may have printed. Check with the kitchen before reprinting.” Same class/path as FAILED, no false “did not print”. |
| `fire-then-add` | Rounds 1–3 fired/queued; new Coffee × 1 pending below them. Live Send 1 to kitchen creates only Round 4. |
| `fireblocked` (existing) | Send 1 to kitchen inert; fixed notice names Steak; initially scrolls the offending row into view. 48px Show Steak action restores that row and focuses it after scrolling through earlier work. No controls/totals shrink. |
| `fire-heading-width` | Rounds 1–12; last heading “Round 12 · fired 23:59 · UNKNOWN · may have printed”. Separate delivery/tag columns; focus and text still legible in greyscale. |

`fireerror` now aliases the FAILED composition. It no longer shows a printed
heading while claiming failure. Historical printed rounds remain correctly
printed; only the new round has the current delivery outcome. Focus scrolling
can move earlier rounds offscreen, but they remain in the independently
scrollable list. No order mutation ever depends on printing.

Fire arithmetic (firing itself never changes a price):

| Composition | S | Discount | D | Service | Total | Included tax |
|---|---:|---:|---:|---:|---:|---:|
| Ready / queued / printed / failed / unknown / `fireerror`: 135.000 +30.000 +240.000 +(2 × 40.000) | 485.000 | 48.500 | 436.500 | 21.825 | **458.325** | 39.682 |
| Then add Coffee +35.000; same figures after the next fire | 520.000 | 52.000 | 468.000 | 23.400 | **491.400** | 42.545 |
| Width: Round 1 Burger 135.000; rounds 2–11 each Soda 30.000; round 12 Steak 240.000 + Fries 80.000 | 755.000 | 75.500 | 679.500 | 33.975 | **713.475** | 61.773 |

Times 19:42, 19:58, 20:14, 23:00 and 23:59 are labeled fixture data, not a
clock/time-zone ruling. The fixture press uses 20:14 only to make the visual
transition reproducible; implementation must follow ARCH-002's injected
clock/server timestamp direction. The live transition only produces queued.

#### Exact appearance delta against existing states

Baseline and final device captures were compared for all **29 pre-existing
states**. The **25 new states** are the twelve `sheet-item-<id>` states, six
quantity states listed above, and seven `fire-*` states (the eighth Part C
case is existing `fireblocked`). Total: **54 named states**.

- Pixel-identical: `empty`, `quick`, `lock-draft`, `lock-lease`.
- `linecontrols`, `catalog`, `sheet-voidorder`, `overflow`: only the fire
  button text changes to its own pending count (1, 1, 1, 3 respectively).
- `eightysix`: fire now says Send 1 to kitchen and is inert, because its
  pending Steak is explicitly 86’d. The interactive transition independently
  refuses an unavailable pending line after a sheet closes or another item
  is added, too (B-17).
- `default`, `zero`, `pressed`, `loading`, `error`, `sheet-discount`,
  `sheet-freeform`, `sheet-remove`, `sheet-voidline`, `sheet-voidorder-fired`,
  `approval`, `approval-error`, `approval-throttled`, `approval-denied`:
  only the existing fire control changes to the disabled treatment. None has
  a pending line available to send; leaving it live would read as resend.
- `sheet-item`, `sheet-item86`, `sheet-line`, `quick-line`: the specified
  quantity/footer/preview changes. Table fire shows its pending count;
  `sheet-item86` also disables fire for the existing 86’d Steak.
- `fireblocked`: notice, Show Steak recovery, initial scroll and count.
- `fireerror`: explicitly replaced by coherent new-round FAILED fixture,
  including the new four-line arithmetic, heading, inert fire and banner.
- Tiles gain correct hrefs and interaction without changing resting pixels.
  Pending row targets open their actual line; this changes behavior, not the
  resting geometry. No unrelated sheet or modal has been redesigned.

#### Designed values, evidence and remaining limits

New composition decisions are in `frost-order-flow.design.json` with
`source: null` and a `designed` block, not attributed to source line numbers.
They reuse Frost's palette, type, 8/12/16/20/24px spaces, 72px actions, 48px
compact actions and 88px keys. Designed combinations: 88px primary alongside
quantity keys; secondary actions on a separate row; a minimum 48px round
heading with `minmax(0, 1fr) max-content` columns and 12px gap; in-sheet unsaved
totals; polite status and blocked-line recovery. No new scalar/color/type
token was needed. Burger's 150/180px option widths are retained. Amounts in
new content are bare; this does not settle the open Rp decision. The shared
legacy runtime still labels legacy panel totals “Total · Rp”; it was not
edited as a side effect.

**Verification actually run:**

- Headless installed Chrome via Playwright, fixed **1280×800 device** captured
  at native scale (1400×1200 outer browser leaves room for fixture chrome).
  29 before-captures, 54 after-captures; pixel diffs confined to the named
  exceptions above. Manual visual inspection of all twelve item sheets in a
  contact sheet, changed quantity, blocked fire, emergency and maximum-length
  UNKNOWN heading, plus a greyscale capture of that heading.
- DOM bounds over all 54 states: **zero script errors, zero horizontal
  overflows in new compositions, zero footer/action controls outside the
  device, zero sheet-body scroll overflow**. The existing order list still
  scrolls as intended. The first pass caught preview negative-margin overflow
  and 7px of sheet-item86 scroll; both fixed and the complete scan rerun.
- **15 interaction groups passed**: all twelve tile destinations; no-options
  Soda; table save/reopen; Back discards; quick save stays counter; all three
  maximum fixtures; explicit Add × 2; fire/focus/status; queued vs failed vs
  unknown wording; Show Steak focus; 86 refusal after cancel/add; editing
  counter Soda; second fire sends only the new Coffee; revert disables Update
  and removal remains separate; modifier/quantity arithmetic. Geometry and
  interaction verification reported no failures on the final pass.
- `node --check` for the fixture JS and `git diff --check` passed.
- Impeccable mechanical detector run once over the changed UI files: **31
  warnings and 5 advisories**, not a clean pass. These flag inherited small
  tags/headings, fixture-frame clipping, structural bands with no padding,
  existing palette values missing from its older DESIGN.md context, existing
  em-dash density, and the reused 20px line-total type size. Those source
  styles are expressly immutable for this task. The new sheet/footer and
  heading geometry was measured separately as above; no warning is claimed
  to have been silently fixed.

Local verification evidence is at `/private/tmp/design007/`: `scan.json`,
`interactions.json`, `detector.json`, baseline/final PNGs, `heading-grey.png`,
`items-contact.png`, and `check.cjs`. This is temporary local evidence, not
committed or guaranteed to survive a clone. The states and this written
account are the durable review inputs.

**Found and not fixed / next handoff:** Independent design review follows
this task; nothing here self-approves Frost. POS-07's existing fixture has a
FAILED kitchen-work ticket and an UNKNOWN cancellation ticket, but **no
UNKNOWN kitchen-work detail**, and its default round is still round 2. Both
new banners deliberately use the existing `incidents.html` path the task
requests; its generic detail does not carry the current order/round/outcome.
A later POS-07 design/implementation must retain UNKNOWN and the ticket
identity through that route, rather than changing it to FAILED. No contract
or new ruling is needed to address that separate fixture gap.

Other existing navigation (settlement, discount, fired-line void and floor)
remains a fixture jump, not a persistent order store. This task demonstrates
local Add/Update/Fire; it does not implement payment, authorisation or printer
recovery. Production data, runtime clock, durable state and real printer
outcomes remain implementation work. Physical touch, screen-reader and
real-device testing were not performed. Designer/implementer should use the
visible unsaved-preview distinction, 86 refusal, line-specific editors and
four delivery values; do not copy the fixture data or hardcoded timestamp
into application configuration.

---

## Round 2 — the review's corrections (written by `lead`, 2026-09-24)

[Review](../reviews/DESIGN-007-review.md) by `design-reviewer3`: **request
changes, 2 P2, both accepted.** Criteria 1–7 pass. Both findings are the
project's known shape: **one shared Add path rebuilds the order from what is on
screen, and throws away facts it did not know how to read.**

1. **Adding from `zero` drops the 100% comp.** `readVisibleModel` infers the
   discount only from a visible *"Staff meal"* (`frost-order-flow.js:199`), so
   Comp 100% becomes no discount, and Soda gives a total of **204.750**. It must
   be **0**: a subtotal of 195.000 with the comp gives a discount of 195.000,
   and the service charge, tax and total are all zero.
2. **Adding from `overflow` erases the voided Caesar Salad** (`:202` skips
   `.line--void`, and `:64` rerenders only the modelled rows). The same rebuild
   also labels the old rounds *printed*, although `overflow` never showed a
   delivery outcome.

**Correction, as the review recommends:** carry the discount's **kind and
value**, the **voided rows**, and each round's **known delivery value (or its
absence)** explicitly in the composed model. Do not scrape them from rendered
text. An Add or a Fire appends new work and never deletes or invents a
historical display fact.

**Criteria for round 2:**

- R2-1. Test Add from **every** pre-existing state that has an Add path, not
  only `zero` and `overflow`. List each state and its resulting figures in the
  handoff. The red cases are `zero` → 204.750 and `overflow` → the salad gone.
- R2-2. After Add, and again after Fire, `overflow` still shows the voided
  salad with its *"Voided 19:51 · approved by M. Iqbal"* note, and no old round
  gains a delivery word it did not have.
- R2-3. Nothing that passed in round 1 changes. Name any state whose resting
  pixels change.

Append a *Round 2 handoff* below. Commit nothing.

### Round 2 handoff — designer5, 2026-09-24

**Both accepted P2 findings corrected; R2-1..R2-3 verified. Ready for the
lead/reviewer to recheck, not self-approved. No commits and no ruling needed.**

Only `docs/design/visual-directions/frost-order-flow.js` and this appended
handoff changed in Round 2. No HTML, CSS, tokens, contract, architecture,
review report, sibling checkout, or coordination file was edited this round.

**Correction.** Removed `readVisibleModel` entirely. The fixture composer now
holds explicit starting lines and discount snapshots for the existing states:
`{name, kind: 'percent', value}` is Staff meal / 10, Comp / 100, or no discount.
Adding, changing quantity, removing pending work and firing retain that object;
no display string decides which discount exists. The calculation uses its
value with integer half-up arithmetic. These are the existing percentage
fixtures, not a new discount feature or catalogue.

Overflow's explicit lines include the 75.000 Caesar Salad with `voided: true`
and the exact note **“Voided 19:51 · approved by M. Iqbal”**. Voided lines stay
rendered with `.line--void`, struck name/amount, empty trailing slot and no
controls. They are excluded from the subtotal, active-line count, edit and
fire selection, rather than deleted from the model. Existing `gone` variants
remove only the named pending line. The editor's row-to-model mapping now
includes the inert history row so it cannot select the wrong pending line.

Each existing overflow round has **`delivery: null`**, meaning no delivery
outcome was supplied by that drawing. Its heading therefore keeps only
“Round n · fired HH:MM” and the manager tag. Other fixtures keep their explicit
known delivery values. Only newly fired pending lines receive `queued`.
Neither Add nor Fire invents a printed outcome for the older rounds.

#### R2-1 — Add from every pre-existing state

Ran installed Chrome headlessly via Playwright at the same 1280×800 device
size. The common addition was **one Soda at 30.000**, without options. Tested
all 29 original states separately. Below are the actual post-Add figures;
“none” means no discount snapshot, not a newly applied zero discount.

For the existing sheet/modal states, the path column explicitly states the
normal dismissal before selecting Soda. Dismissal preserves the currently
applied discount; it does not apply the choice drawn in a discount picker.
`sheet-item86` still forbids its Burger Add; Cancel exposes the available Soda.

| Starting state | Path before Soda → Add | Subtotal | Discount | Service | Total | Included tax |
|---|---|---:|---:|---:|---:|---:|
| `default` | Direct | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `empty` | Direct | 30.000 | none | 1.500 | 31.500 | 2.727 |
| `quick` | Direct | 195.000 | none | 9.750 | 204.750 | 17.727 |
| `linecontrols` | Direct | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `quick-line` | Back, in place | 195.000 | none | 9.750 | 204.750 | 17.727 |
| `overflow` | Direct | 1.215.000 | none | 60.750 | 1.275.750 | 110.455 |
| `zero` | Direct | 195.000 | **Comp 195.000** | **0** | **0** | **0** |
| `eightysix` | Direct; pending Steak still blocks fire | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `fireblocked` | Direct; pending Steak still blocks fire | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `catalog` | Direct | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `lock-draft` | **No Add path: menu absent** | — | — | — | — | — |
| `lock-lease` | **No Add path: menu absent** | — | — | — | — | — |
| `fireerror` | Direct; prior failed outcome retained | 515.000 | Staff 51.500 | 23.175 | 486.675 | 42.136 |
| `loading` | **No Add path: menu absent** | — | — | — | — | — |
| `error` | Direct | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `sheet-item` | Cancel, in place | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `sheet-item86` | Cancel, in place | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `sheet-line` | Back, in place | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `sheet-discount` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `sheet-freeform` | Back → picker; Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `sheet-remove` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `sheet-voidline` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `sheet-voidorder` | Keep order → eightysix | 435.000 | Staff 43.500 | 19.575 | 411.075 | 35.591 |
| `sheet-voidorder-fired` | Keep order → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `approval` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `approval-error` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `approval-throttled` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `approval-denied` | Cancel → default | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |
| `pressed` | Direct | 195.000 | Staff 19.500 | 8.775 | 184.275 | 15.955 |

Arithmetic: `S = starting subtotal + 30.000`; discount is `H(S × value / 100)`
when a snapshot exists; `D = S − discount`; service is `H(D / 20)`;
total is `D + service`; tax is `H(D / 11)`. Thus the red comp case is
165.000 + 30.000 = 195.000, discount 195.000, D 0, service 0, total 0, tax 0.
Two successive Add → Fire cycles were also checked: the second subtotal and
comp are both **225.000**, while service, total and tax remain **0**.

To test the data initialization independently of navigation out of a legacy
overlay, also invoked the Add handler directly in all **21 existing
applied-discount drawings**: default, pressed, zero, error, sheet-discount,
sheet-freeform, sheet-remove, sheet-voidline, sheet-voidorder-fired, approval,
approval-error, approval-throttled, approval-denied, linecontrols, eightysix,
fireblocked, catalog, sheet-item, sheet-item86, sheet-line, sheet-voidorder.
All retained their original snapshot and produced the figures above. This
additional handler test is not a claim that tapping through a scrim is a user
path; the normal paths were tested separately.

#### R2-2 — history after Add and Fire

Checked **both checkpoints** on `overflow` and all three removal variants:
`gone=of-coffee`, `gone=of-cheese`, `gone=of-wine`. At each checkpoint:

- The voided Caesar Salad, 75.000 struck amount and exact approval/time note
  remain in Round 1. The row has no link, button or quantity control.
- Round 1 still says fired 19:42 and Round 2 fired 19:58. Neither gains
  printed, sending, FAILED, UNKNOWN, or an undefined placeholder.
- Add appends one pending Soda. Fire then sends only pending lines into
  Round 3, with queued wording. The voided salad remains old history.
- Every monetary figure is identical immediately before and after Fire.

| Starting overflow variant, after Soda Add and after Fire | Subtotal | Service | Total | Included tax |
|---|---:|---:|---:|---:|
| Full | 1.215.000 | 60.750 | 1.275.750 | 110.455 |
| Coffee already removed (−70.000) | 1.145.000 | 57.250 | 1.202.250 | 104.091 |
| Cheesecake already removed (−60.000) | 1.155.000 | 57.750 | 1.212.750 | 105.000 |
| Wine already removed (−80.000) | 1.135.000 | 56.750 | 1.191.750 | 103.182 |

None carries a discount. The first subtotal is the prior 1.185.000 + 30.000;
the other subtotals subtract only the named removed pending amount. The
75.000 voided salad contributes **zero** in every case.

#### R2-3 — unchanged approved evidence and verification limits

**No state's resting pixels changed.** Compared all **54** new device captures
against the final Round 1 captures: **54 identical, zero pixel differences**.
Reran the complete Round 1 browser script: all **15 interaction groups passed**;
all 54 states had zero script errors, horizontal overflow, clipped
footer/action controls, or sheet-body overflow. Names, prices, options,
quantity commit/discard/bounds, fire outcomes/focus/count and 86 refusal remain
as previously reviewed. No design value or new state was introduced.

Round 2's cross-state run passed **26 normal Add paths**, the **3 no-menu
checks**, **8 overflow history checkpoints**, **2 successive comp Add/Fire
cycles**, and **21 direct discount-initialization checks**. The first version
of the *verification script* misread the old “Comp 100% change” label and
expected the reported bug; the UI already produced the correct zero result.
Corrected that expected-value recognition and reran the full Round 2 script:
zero failures. No application change was made to satisfy that harness error.
`node --check` and `git diff --check` also passed.

Temporary local evidence: `/private/tmp/design007/round2/results.json`,
`check.cjs`, `before.js`, the 54 `before-*.png` captures, and post-Fire PNGs.
The rerun Round 1 evidence is still `/private/tmp/design007/scan.json`,
`interactions.json`, and `after-*.png`. These are local, not committed evidence;
this table and the walkable fixtures are the durable handoff.

**Next agent:** recheck the two reported paths and accept/reject this
correction. Future fixture edits must update the explicit starting model
alongside the drawing; do not restore DOM-text inference. No additional
contract/ruling blocker was found. The previously recorded POS-07 UNKNOWN
work-ticket detail limitation is unchanged. Physical touch, screen-reader,
printer, backend and application tests were not performed; this round changes
only the design fixture's state preservation.

### Lead verification, 2026-09-24

The lead ran its own Playwright script against installed headless Chrome, not
the designer's:

- `zero` → Soda → Add: subtotal 195.000, **Comp 100% −195.000**, service 0,
  **total 0**, tax 0. Red case (204.750) cleared.
- `overflow` → Soda → Add: *"Voided 19:51"* present, no *printed* before or
  after; totals 1.215.000 / 60.750 / **1.275.750** / 110.455, matching the
  review. **Send 4 to kitchen** → Round 3 *sending · unconfirmed*; Rounds 1–2
  unchanged with no delivery word; voided note still present; Send inert,
  Settle live. Zero page errors.
- Seen, not a defect: after the fire, the status line *"Round 3 sent to the
  kitchen"* sits under the scrolling line list, and the last row (Soda) is
  partly scrolled out of view. The list scrolls; nothing is hidden for good.

**Accepted.** DESIGN-007 is done, pending the owner's go-ahead to commit.
