# DESIGN-008 — POS-02 floor in Frost, and three POS-07 corrections

**Status:** Written 2026-09-25 by `lead`. Unassigned.
**Owner:** a codex designer on `gpt-6-astra` (the owner's choice).
**Depends on:** [DESIGN-007](DESIGN-007-order-flow-gaps.md) (its order states
are what the floor opens into).
**Branch and place:** `agent/design-direction`, in **this worktree**
(`restaurant-pos-design`). Do **not** touch the code checkout at
`../restaurant-pos` or anything under `apps/`.

---

## Why this task exists

F4 builds the POS screens that are still missing. POS-07 (print incidents) had
a Frost artifact and is now built (FE-025, 2026-09-25). **POS-02, the floor,
has only a wireframe** (`docs/design/prototype/pos/floor.html`). The code
routes to it from three places (*Back to floor* after a close, the incidents
screen's `← Floor`, and a lost lease), and each one lands on an empty frame.
Of the unbuilt screens, the floor is the most urgent. The closed-order screens
(POS-05 and POS-06) follow as DESIGN-009.

Building POS-07 also exposed three gaps in `frost/pos/incidents.html`. They are
Part B.

**Sources:**
- `docs/design/SCREEN-INVENTORY.md` POS-02 (in the code checkout, `:85–122`)
  and POS-07 (`:407–445`);
- SITEMAP;
- the floor wireframe;
- the Frost system, `docs/design/tokens/frost.css`. Use registry tokens only.

---

## Part A — POS-02, the floor

Create `docs/design/visual-directions/frost/pos/floor.html`, built the same
way as the other Frost POS artifacts, and add it to `manifest.js`.

**States.** Start from the wireframe's eight:
- `default`: mixed occupancy;
- `clear`: all tables free;
- `empty`: no tables configured;
- `loading`;
- `error`;
- `overflow`: 24 tables;
- `confirm`: opening a table order;
- `dayclosed`.

Add two more:
- `incident`: the kitchen emergency banner on the floor. Use the existing
  `EmergencyBanner` look from `order.html`, with *Open incidents* going to
  `incidents.html`.
- `receipt-warning`: the receipt warning chip, going to `incidents.html`.

The inventory places both **from any POS screen**, and the floor is where a
cashier will see them most.

**Rules you must draw, not decide** (all from the inventory):
1. **A table holds at most one open order** (`FR-D1`). An occupied table opens
   *that* order. There is no second check, no split, no transfer and no merge.
2. **Quick sale is the same order model**, not a fake table and not a
   different-looking mode (`FR-D2`). Its entry sits on the floor and looks
   like it belongs to this product.
3. **No create-table control.** Tables are back-office configuration (`FR-B2`).
4. **Overflow scrolls.** Targets never shrink below touch size at 1280×800.
5. **A deactivated table disappears unless it holds an open order** (`FR-C8`).
   Draw the exception in `default`: one deactivated table still showing,
   because it is open.
6. **`dayclosed`** is a standing banner (ruling I-4): new orders belong to the
   next business day.
7. **Money is bare.** No `Rp`, amounts in `100.000` form, and times as
   24-hour `HH:MM` (owner rulings 2026-09-24). The wireframe's `15.59` is
   pre-IDR. Use real totals from the order fixtures: **Table 1 is the POS-03
   `default` order, 155.925, two rounds fired and one line pending.** Keep
   Table 1, Table 7 and Table 9 plausible with the incident and order
   fixtures that already name them.
8. **Light only** for the MVP.

**Each occupied tile links to `order.html`**, and Table 1 links to its
`default` state. A free table and the quick-sale entry link to the order
states that exist for them: `empty` for a new table order and `quick` for a
quick sale. **Do not invent new order states.** If one is missing, say so in
the handoff.

**A link to closed orders (POS-05)** belongs on the floor (SITEMAP; POS-05 is
*reached from POS-02*). Draw the entry point. Its target is a placeholder
until DESIGN-009 exists.

**`confirm`** is the wireframe's *Open table order*. State in the handoff
whether a confirmation step is needed at all, and argue it from the PRD.
ARCH-002 removed the fire confirmation for being friction with no failure to
prevent, and the same test applies here. **If you conclude it is not needed,
drop the state and explain why.** The lead rules on it.

## Part B — three POS-07 corrections (`frost/pos/incidents.html`)

1. **Reprint is per incident.** Today every Reprint links to `?state=reprint`,
   which draws the result on Table 1 round 2's card, so *Reprint receipt*
   shows a kitchen-ticket result. Fix it so each Reprint's result is drawn on
   its own card. Also draw a receipt reprint result, which has **no** *"check
   the kitchen"* line. The code already does this (FE-025). Its live copy is
   `Reprint sent` with no time, because nothing actually printed. Keep
   *"printed at 20:03"* only for a fixture that pictures a server's answer.
2. **A clear control.** `FR-E3` makes a kitchen incident persistent *until
   acted on*. The artifact tells the cashier *"Check the kitchen has the paper
   before clearing this"*, but draws no way to clear it. Draw one:
   - where it sits;
   - that clearing is an **explicit** action (the inventory: urgency is
     carried partly by *"whether clearing requires an explicit action"*);
   - how a receipt incident clears, differently from a kitchen one (`FR-E6`,
     `AC-23`);
   - whether clearing is audited. **Raise that one as a question, and do not
     rule it.** `FR-J3`'s audited list is the contract.
3. **Two values with no token.** The emergency card uses a 3px ink border and
   a 700 title weight, and the registry has neither. The build used
   `--frost-space-1` (4px) and semibold. Either give the registry the tokens,
   or redraw with existing ones. **Say which, and why.**

## Acceptance criteria

1. `floor.html` exists with all ten states, is listed in `manifest.js`, and
   uses registry tokens only.
2. Rules 1–8 are each visible in some state. The handoff names which state
   shows which rule.
3. Every link resolves to an existing artifact state. Name any gap.
4. At 1280×800 nothing is clipped, and `overflow` scrolls with touch-size
   tiles. State how you measured.
5. Part B: each Reprint's result lands on its own card, a receipt result
   exists, the clear control is drawn with the audit question raised, and the
   token question is answered.
6. **No other state changes appearance** unless the handoff names it and says
   why.

**A design review follows this task**, before any code is built from it.

## Reporting

Commit nothing. Append a handoff below. Then run
`herdr agent prompt lead "<your name>: DESIGN-008 done — <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

---

## Handoff


### designer6 — 2026-09-25 — ready for design review

Delivered on `agent/design-direction`; no commits. Only the named Frost
artifacts, manifest, and this handoff were edited. Neither `../restaurant-pos`
nor any `apps/` directory was written.

**Artifacts and decisions**

- Added `docs/design/visual-directions/frost/pos/floor.html`: nine states,
  deliberately omitting `confirm` under Part A's explicit exception. The
  remaining seven wireframe states plus `incident` and `receipt-warning` are
  present. New CSS uses 55 existing registry tokens, with no literal px or
  hex values. No token registry changes were needed.
- **Recommendation for the lead: drop the opening confirmation.** FR-D1
  requires an available table and at most one OPEN order; FR-D2 permits a
  tableless quick sale. Neither requires covers, approval, or confirmation.
  Opening does not fire kitchen work or take payment. A confirmation cannot
  enforce the one-order invariant; the server must do that regardless.
  Free tables therefore link directly to the existing `empty` state, and
  New quick sale links to `quick`. No new POS-03 states were invented.
  This is a recommendation for review, not a product-contract ruling.
- Updated the manifest with floor and incident fixtures. Its small gallery
  compatibility adapter supplies the seventh label and selects Frost for
  the Frost-only floor, since `review.js` hard-codes six labels and assumes
  Paper has every screen. Selecting Paper from the floor returns to the
  original order comparison. The existing six entries keep their indices;
  neither `review.js` nor Paper was edited.
- Both floor exits in `order.html` and the incidents header now reach Frost
  `floor.html`. No order-state styling changed.

**Where the eight floor rules are visible**

| Rule | Evidence |
|---|---|
| 1. One open order per table | `default`: one tile per table; occupied tiles say open and link to the order, with no second check, split, transfer, or merge affordance. |
| 2. Quick sale, same order model | Every state: New quick sale is an ordinary Frost action into existing POS-03 `quick`; never a fake table. |
| 3. No create-table control | Every state; `empty` explains that a manager configures tables in back office. |
| 4. Overflow scrolls | `overflow`: 24 tiles, four columns, unchanged 301×144px tile targets. |
| 5. Deactivated exception | `default`, `incident`, `receipt-warning`, `overflow`: Table 12 is explicitly deactivated but retains its open order. `clear` and `dayclosed` omit Table 12 entirely. |
| 6. Closed-day standing banner | `dayclosed`: no dismiss control; new orders belong to the next business day and closed-day orders cannot be voided/refunded. All visible tables are free. |
| 7. Bare money and 24-hour time | Table 1 in `default`: 155.925, two fired rounds, one pending line. Table 7 shows 382.725 total and 155.925 outstanding, consistent with two tenders being drafted in the lock fixture. Table 9 shows five items in round 1; its illustrative 173.250 total is drawn from an existing order fixture. `dayclosed` uses 23:14. No Rp labels. |
| 8. Light only | Every state inherits Frost light surfaces and explicitly sets the light color scheme. |

**Incident corrections**

- All five reprints (Table 1 work, cancellation, Table 9 work, Table 1
  receipt, counter receipt) reveal `Reprint sent` on their own card.
  `reprint` remains the Table 1 kitchen result; added `reprint-cancel`,
  `reprint-receipt`, `reprint-table9`, and `reprint-counter` are directly
  reviewable. Receipt results contain no kitchen instruction.
- `reprint-printed` alone pictures a server answer, explicitly labeled
  `Server confirmed: printed at 20:03`. Clicking reprint again changes that
  result back to `Reprint sent`; dispatch never claims physical delivery.
- Each kitchen card places a verification checkbox and **Clear incident**
  below its reprint row. The button stays disabled until the cashier checks
  that the kitchen has that specific ticket/cancellation. Reprint alone never
  clears the emergency. Clearing removes only that card. Navigation remains
  available throughout.
- Receipt cards have a smaller **Dismiss** beside their 48px reprint control,
  without kitchen verification. Dispatch alone does not claim the receipt
  printed. This is the proposed lower-urgency clearing treatment under
  FR-E6/AC-23, for design review.
- **Question for the lead/owner: must explicit kitchen-incident clearing
  and/or receipt-warning dismissal be audited, and if so which identified
  actor/event fields are required?** FR-J3 does not list these actions. No
  audit rule, event, manager approval, or audit claim was invented here.
- Used existing `--frost-space-1` (4px) for the emergency card boundary and
  `--frost-weight-semibold` (600) for its title. A new token solely to preserve
  a legacy 3px/700 inline value would fragment the registry; the existing
  build already uses these choices. Emergency red and white text remain.

**Appearance changes beyond the new floor**

All populated incident states have the new kitchen-clear/receipt-dismiss
controls and tokenized emergency boundaries. `reprint` uses the dispatch-only
copy. The kitchen heading now says “Check delivery with the kitchen” because
UNKNOWN cannot truthfully assert the kitchen has not seen the work. `overflow`
now scrolls so the added recovery controls cannot clip the receipt section.
The counter UNKNOWN receipt also says to check the printer before reprinting.
`empty` says “No unresolved print incidents” instead of claiming every ticket
printed: explicit clearing is not proof of print delivery. `loading` and
`error` keep their content and appearance; their Floor destination changes.
No shared stylesheet or other screen state was restyled.

**Verification run and read**

- Headless Chrome / Playwright at a 1280×800 viewport, all **9 floor + 12
  incident states**, then one confirmation pass after the copy/result fix:
  document size **1280×800 in every state**, zero JavaScript errors.
- Measured `getBoundingClientRect`, `clientHeight`, and `scrollHeight`:
  floor tiles **301×144px**; overflow viewport **1280×624px**, vertical overflow
  **328px**, 24 tiles. Scrolled to the last tile. Default and both warning
  states fit all 12 tiles without scrolling or clipping. Incident overflow
  has **175px** of internal scrolling before reprint results expand it.
- Exercised every reprint, verified each result's owning card, checked that
  receipt copy contains no kitchen instruction, verified kitchen Clear is
  disabled before checking, cleared all three kitchen incidents and both
  receipts, and reached Nothing outstanding. Checked gallery floor selection
  and the Paper-to-Frost transition.
- Checked visible links in every floor/incident fixture: destinations exist
  and named query states occur in their target artifact. `git diff --check`
  passed. All 55 floor and 17 added incident token references resolve in
  `frost.css`; no new floor CSS literal px/hex values.
- Inspected captured default/incident floor and default/receipt-result/
  overflow incident images. Temporary evidence is in
  `/private/tmp/design008-*.png`, `/private/tmp/design008-results.json`, and
  `/private/tmp/design008-check.cjs`; it is not committed durable evidence.
- The Impeccable detector ran once and returned warnings, **not a clean pass**:
  inherited device/header padding, tight leading, fixed-frame clipping, and
  palette advisories against its older visual-directions DESIGN.md context.
  The current registry and this task govern; unrelated order styles were not
  changed to satisfy those heuristics. No physical touchscreen, screen-reader,
  real printer, or application persistence test was performed.

**Gaps and next handoff**

- The current PRD FR-C8 prohibits deactivating an OPEN table; the inventory and
  this task also require defensive visibility if such a table exists. Table
  12 draws the requested exception, **not permission to deactivate it**. Lead
  should reconcile the wording; the PRD was not edited.
- Existing `empty` and `quick` states exist, so no new-order state is missing.
  POS-03 fixtures are still Table 1 samples: Table 7/9/12 and other free-table
  links cannot preserve their own identity, totals, or payment state in that
  static artifact. They link to existing `default`/`empty` as requested;
  table-specific data binding remains an implementation/design-fixture gap.
  In particular, the `quick` fixture already has sample lines rather than
  being an empty newly opened quick sale. No new state was invented to hide it.
- Closed orders uses the existing `prototype/pos/closed-orders.html` as its
  explicit placeholder until DESIGN-009 supplies the Frost artifact.
- The settlement and lock artifacts still have their inherited prototype
  destinations; they are outside this task's write list. Their owner should
  connect them to Frost floor when those files are assigned.
- Design review is next. It needs to assess the no-confirm recommendation,
  the kitchen verification/clear versus receipt-dismiss treatment, and obtain
  the audit ruling above before implementation relies on these new controls.


### Round 2 — designer6 — 2026-09-25

- Applied ruling A: `confirm` remains dropped; the no-confirmation flow is
  accepted, superseding the earlier recommendation status.
- Applied ruling B: removed Table 12's deactivated marking from both shared
  tile groups (default/incident/receipt-warning and overflow). It is now an
  ordinary open table, with two fired rounds and one pending line. Its total,
  link, position, and all other floor content/layout remain unchanged. The
  earlier “defensive exception” interpretation and rule-5 mapping above are
  superseded: FR-C8 makes an OPEN/deactivated table impossible.
- Applied ruling C to all three kitchen Clear controls: native
  `button type="button"`, `aria-disabled="true"` while unchecked, no
  `disabled` attribute or negative tabindex, and `aria-describedby` naming
  the visible verification label. The handler returns without action while
  off; checking/unchecking updates ARIA state. The off styling now selects
  the ARIA attribute. Receipt Dismiss controls are always on; no other off
  controls were added.
- Re-ran the existing `/private/tmp/design008-check.cjs` using its saved
  approval, without a new approval request (the initial sandboxed browser
  launch was denied). All 21 states measured 1280×800, zero JavaScript
  errors; tiles remain 301×144px, floor overflow 328px, incident overflow
  175px. Existing per-card reprint and enabled-clear interaction checks pass.
  Static assertions also passed for all three reason IDs, native focusable
  markup, no disabled attributes, checkbox-driven ARIA state, and the inert
  activation guard. Keyboard activation while off was not separately
  exercised in this unchanged browser script. `git diff --check` passed.
- The clearing-audit question remains **open for the owner**. No audit ruling,
  contract edit, or commit was made.

---

## Round 3 — the review's two P2s (lead rulings, 2026-09-25)

Review: [DESIGN-008-review.md](../reviews/DESIGN-008-review.md), request
changes, 2 P2. Both are accepted, and both are the shared-destination defect:
several controls land on one state that belongs to a different one.

1. **Each occupied tile opens its own order.** Add three states to
   `frost/pos/order.html`: `open-t7`, `open-t9` and `open-t12`. **Build them
   from existing compositions only; draw no new layout.**
   - Each state's heading, lines, rounds and totals match its floor tile
     exactly.
   - Table 7's tile says payment is in progress, so `open-t7` uses the
     `lock-draft` composition (its own payment lock).
   - Table 9 is five items in one fired round. Table 12 is an ordinary open
     table.
   - Give the arithmetic for each total in the handoff.
   - Point each tile at its state and add the states to `manifest.js`.
2. **New quick sale opens an empty sale.** Add `quick-new` to `order.html`:
   the `quick` composition with no lines, no charge rows, and **no fire
   control** (FE-012: absent on a counter sale, not inert). Every floor state's
   *New quick sale* goes to `quick-new`. The populated `quick` stays as it is.
3. Every other state stays unchanged. Re-check the links in every floor state.
   Append a *Round 3* handoff.

### Round 3 — designer7 — 2026-09-25

Delivered the two accepted review corrections on `agent/design-direction`;
no commit. Edited only Frost `pos/order.html`, `pos/floor.html`,
`manifest.js`, and appended this handoff. No access to the code checkout or
`apps/`, no sandbox escalation, and no incident-artifact changes this round.

**Destinations and compositions**

- Both occupied-tile groups now send Table 7 to `open-t7`, Table 9 to
  `open-t9`, and Table 12 to `open-t12`. Table 1 still opens `default`.
  Each new state has its own table heading and order-panel identifier.
- `open-t7` reuses the `lock-draft` composition: two fired rounds, one
  pending Steak, read-only lines, absent menu/category rail, and the own-payment
  notice. The notice explicitly shows 226.800 drafted and 155.925 outstanding.
- `open-t9` uses existing fired-round/line compositions: three Coffees and
  two Sodas, five items in round 1. Its FAILED status and 20:04 timestamp
  match the existing Table 9 incident. The existing emergency-banner
  composition links to `incidents.html?state=overflow`, where that card is
  shown. Its fire control is inert because there are no pending lines.
- `open-t12` uses the ordinary order composition: Soup of the Day in round 1,
  Soda in round 2, and one pending line of two Fries. The pending remove
  target retains `open-t12`, removes that line without a prompt, and shows
  the corresponding two-line count and recalculated total.
- The shared New quick sale entry now reaches `quick-new` in all nine floor
  states. It has the counter heading, existing empty-order message, zero
  subtotal/total, no discount/service/tax charge rows, and **no fire control**.
  Its off actions are native, focusable `aria-disabled` buttons. Populated
  `quick` is unchanged. All four new states are listed in the manifest;
  `default` remains the first order-gallery state.
- No new layout, CSS, or tokens. The four new states are static entry
  snapshots using the existing HTML compositions. They deliberately do not
  load DESIGN-007's interaction model, which assumes Table 1 or an already
  populated counter sale. Existing states still load that same deferred
  script. This avoids later model rendering silently replacing the new
  snapshot with Table 1's lines.

**Arithmetic (integer IDR, tax included rather than added)**

| State | Calculation | Total | Included tax, half-up |
|---|---|---|---|
| `open-t7` | Burger 135.000 + Soda 30.000 + Steak 240.000 = 405.000; less 10% staff meal 40.500 = 364.500; plus 5% service 18.225 | 382.725 | 364.500 / 11 → 33.136 |
| `open-t9` | Coffee 3 × 35.000 + Soda 2 × 30.000 = 165.000; no discount; plus 5% service 8.250 | 173.250 | 165.000 / 11 = 15.000 |
| `open-t12` | Soup 55.000 + Soda 30.000 + Fries 2 × 40.000 = 165.000; less 10% staff meal 16.500 = 148.500; plus 5% service 7.425 | 155.925 | 148.500 / 11 = 13.500 |

Table 7: 382.725 − 226.800 drafted = **155.925 outstanding**.
Table 12 after pending removal: 85.000 − 8.500 + 3.825 = **80.325**;
included tax 76.500 / 11 → **6.955**. `quick-new` has no lines and total zero.

**Verification run and read**

- Standard-library HTML source parser evaluated `data-when`, `data-unless`,
  and line visibility. All four new states have exactly one totals block;
  line quantities, amounts, round counts, discounts, service, and included
  tax match the arithmetic above. Table 7 has no visible menu or actionable
  line controls. Empty quick sale has zero lines, two zero summary rows,
  and no visible Send control.
- Checked links in **all nine floor states**: default 15, clear 14, empty 3,
  loading 3, error 4, overflow 27, dayclosed 14, incident 16, receipt-warning
  16. Every target file and named state exists; every occupied destination
  has the required identity; every New quick sale goes to `quick-new`.
- Compared visible source projections for **all 54 pre-existing order
  states** against the start-of-round snapshot: unchanged. Reviewed shared
  styles for state-specific selectors; no additional aliases were required.
- Node parsed the inline scripts and manifest and checked both branches of
  the conditional deferred-script inclusion: old states load the unchanged
  flow script; the four new states do not load its incompatible model.
- `git diff --check` passed. Checks are source-only, as requested; no browser,
  geometry, keyboard interaction, touchscreen, or application checks were
  run. Earlier rounds' 1280×800 measurements are not fresh evidence for
  these new snapshots. The temporary source-check script is
  `/private/tmp/design008-r3-source-check.py`, not durable repository evidence.

**Limits and next handoff**

The requested floor-to-order landing identities and empty creation state are
corrected. These are entry snapshots, not complete table-specific interactive
journeys: downstream item/void/discount sheets and settlement links still lead
to the existing shared illustrative states. In particular, Back to payment
uses the inherited `pending` settlement example; it is not a new Table 7
settlement fixture. Free tables retain the task's existing generic `empty`
destination. Extending those journeys would need separately scoped fixture
work; no shared flow script or settlement artifact was edited here.

Review the four new landing states next. The incident-clearing audit question
from the earlier rounds remains open and was not ruled or changed.
