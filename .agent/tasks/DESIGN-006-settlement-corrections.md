# DESIGN-006 — POS-04 settlement: five artifact defects, and six rulings to confirm

**Status:** Done 2026-09-24. Round 1 by `designer3`, round 2 by `designer4` (codex `gpt-6-astra`). Reviewed by `design-reviewer2`; round 2 verified by the lead in a browser
**Owner:** `designer3` (codex, `gpt-6-astra`, the owner's choice)
**Written:** 2026-09-24 by `lead`
**Depends on:** [DESIGN-004](DESIGN-004-frost-review-remediation.md), [DESIGN-005](DESIGN-005-a7-three-missing-states.md)
**Branch and place:** `agent/design-direction`, in **this worktree**
(`restaurant-pos-design`). Do **not** touch the code checkout at
`../restaurant-pos` or anything under `apps/`.

---

## Why this task exists

POS-04 is now built, in four slices on `agent/phase-0-foundations`, and has had
an independent review. Building it against
`docs/design/visual-directions/frost/pos/settlement.html` turned up two kinds of
problem that belong to design rather than to code:

- **Five defects in the artifact.** Each one was found by building the screen
  or by opening it at 1280×800. The implementation either reproduced the defect
  faithfully or worked around it on a lead's ruling.
- **Six rulings the lead made where the artifact is silent.** The code already
  follows them. They are not design until a designer draws them and a review
  accepts them.

**Four of the five defects share one shape, which this project has now paid for
five times:** *one control or value shared across states, which hides the one
state where it is wrong.* When you finish, check every other state of this
artifact for that shape too.

---

## Part A — the five defects: fix each in the artifact

### A1. The keypad is clipped in `cardover` and `ceiling`

At 1280×800 the rejection notice pushes the keypad down, and the right column's
body is `overflow: hidden`. The bottom row, **`0` and `←`**, disappears under the
close bar. In the implementation, 47px of the 72px `←` key was hidden in
`cardover` and 30px in `ceiling`. **In this artifact it is worse:** the bottom
row is almost entirely hidden in `cardover`. **These are exactly the two states
in which the cashier has to delete digits** to correct the amount.

**Requirement, corrected 2026-09-24 after `designer3` queried "twelve keys":**
in every state that draws the tender pad, **all eleven tender controls** (ten
digits and Delete) show at full size, 88×72, and are tappable. So are the
notice, the field, its message, Add and Close. The blank twelfth cell stays
blank; it is not a missing key. `zero` draws no pad. Where a modal sits over the
screen, the pad underneath is deliberately blocked and is not measured.
Instead, **an active PIN modal shows all twelve of its own 72×72 controls.** Solve it
by composition, not by shrinking the keys. Touch geometry is Frost's and is not
up for trade. **Check all 21 states, not just these two.**

### A2. `pending` draws the total without the line it names

`pending` inherits the default figures: total **155.925** and balance 155.925.
That is the order **without** the Steak, while the notice says *"**Steak** is
still pending"*. The order with the Steak still on it is:

| Subtotal | Staff meal 10% | Service charge 5% | Total | Includes tax 10% |
|---|---|---|---|---|
| 405.000 | −40.500 | 18.225 | **382.725** | 33.136 |

Draw `pending` with these figures, a balance of **382.725** and a field
prefilled to 382.725. The implementation already derives them. (Arithmetic:
405.000 − 10% = 364.500; + 5% = 382.725; tax is 364.500 / 11 = 33.136.)

### A3. `reauth`: *Leave payment* contradicts its own caption

The link points at `order.html?state=default`, an **unlocked** order, while the
caption beside it says *"The draft stays in this tab."* The caption is the
requirement (`FR-G9`: the draft survives actor expiry in the same tab). Point it
at `order.html?state=lock-draft`, as `← Order` does in every other state.

### A4. `takeover`: manager PIN dots, and no keypad

The takeover modal draws six manager PIN dots, three of them filled, and **no
keypad**, so a manager cannot enter a PIN. The implementation keeps *I
understand — take over* inert because of it. Compose the manager's PIN entry.
**The approval prompt (`order.html`'s `approval*` states, M-1) is the precedent:**
reuse its composition rather than inventing a second one. The acknowledgement
of an external charge (`FR-G14`) must stay before the PIN, and `B-12` still
holds: no digit is ever shown.

### A5. No copy for the single-tender cap

The cash maximum is **the balance plus 9.999.999, capped at 99.999.999**
(`FR-M5`; SCREEN-INVENTORY POS-04). `ceiling`'s copy explains only the
change-limit case: *"… the 55.925 still owing plus the 9.999.999 change
limit …"*, and *"… not more than the restaurant can give change for."* When the
balance is **above 90.000.000**, the binding limit is the single-tender cap, and
both of those sentences become false. For now the implementation draws only
*Cash maximum {max}* and an inert Add, with no notice and no caption.

Add a state for it, `ceiling-single` or another name you prefer, with its own
figures (a balance above 90.000.000) and copy that states the real limit. Draw
it the way `ceiling` is drawn: notice, invalid field with message, caption, and
Add inert.

---

## Part B — six rulings: draw each as a state, so a review can accept or overturn it

For each one, either draw it as the lead ruled or draw something better **and
say why**. If you overturn a ruling, name it in your handoff so the lead can
send the code a correction.

| # | Where the artifact is silent | The lead's ruling, as built |
|---|---|---|
| B1 | A **zero-total table order that still has a pending line** | The zero composition, with the pending notice **below** the *Nothing to collect* notice, and Close inert. `FR-G10` wins over `FR-G11` |
| B2 | **`pending` at exactly zero balance**, where the cashier paid in full but the Steak is still pending | The inert Close reads **"Close order & print receipt"** (its own name), not *"balance outstanding"*, which would be false. A screen reader reaches the pending notice as its description |
| B3 | **`error` after a partial correction**. For example, Card 10.000 is added against the 37.800 still owed | The rejection notice stays, with live figures: *"… **27.800** is still owing"*. It clears once the balance reaches zero, and it **does not come back** if a draft is removed afterwards |
| B4 | The **`cancel` modal with 0, 1 or 2+ drafts** | *"One drafted payment line will be discarded."* / *"2 drafted payment lines will be discarded."*; **with no drafts, the sentence is omitted** |
| B5 | **Cash keyed below the balance** (the artifact draws the split caption only on card) | The same `cardsplit` caption applies to cash: *"{amount} of the {balance} owing. Adding this leaves {rest} on the balance for the next method. That is the whole of splitting a bill — there is no mode to enter."* |
| B6 | The `change` sentence when **card and cash were both tendered** | *"… not the {tendered} handed over"*, where {tendered} is **the sum of all drafted tenders**. `B-6`'s own wording is *"never the amount tendered"* |

**Out of scope here:** the floor placeholder. POS-02 gets designed when F4 builds
it.

---

## Rules that still apply

- **Frost only.** Use the existing tokens and the existing classes in
  `structure.css`, `visual.css` and `frost-states.css`. If a composition truly
  needs a new value, **mark it as designed** (DESIGN-005's `source: null` plus a
  `designed` block) and never disguise it as sourced. Prefer composing with what
  exists.
- **Do not edit `visual.css` or `structure.css`**, because their line numbers
  are the provenance of 168 sourced tokens. New rules go in a separate sheet, as
  A7's did.
- **Contract documents are not yours to edit** (`docs/PRD.md`,
  `docs/BOUNDARIES.md`, `docs/PRODUCT.md`, `docs/ROADMAP.md`). If a fix seems to
  need one changed, stop and tell the lead (the agent named `lead`, in pane
  `w2:p1`).
- `SCREEN-INVENTORY.md` POS-04 and `SITEMAP.md` **may** gain the new states you
  add, and the counts must stay honest. The rule is DESIGN-002's precedent: a
  new state on an existing screen is not a new node.
- **Every figure is arithmetic you can show.** Put the working in your handoff
  for every new figure.

---

## Acceptance criteria

1. **At 1280×800, every state that draws the tender pad shows all eleven tender
   controls at 88×72, and every active PIN modal shows all twelve of its 72×72
   controls** (A1, as corrected). Measure it
   in a headless browser if you have one, and state the method and the figures.
   If you cannot measure, say so plainly, and the lead will measure. **The red
   case is `cardover` as it stands today.**
2. `pending` draws **382.725** everywhere a figure appears.
3. `reauth`'s *Leave payment* points at `lock-draft`.
4. `takeover` has a working PIN composition, modelled on M-1, with the
   acknowledgement before it.
5. The single-tender-cap state exists, with figures and copy that are both true.
6. B1–B6 each exist as a named state, or each has an explicit overturn written
   in the handoff.
7. **No other state changes appearance** unless you name it in the handoff and
   say why.
8. The shape check is done: the handoff lists any other state where one shared
   control or value hides a wrong state, or says there are none.

**A design review follows this task**, before the code is corrected against it.

---

## Handoff

Write it below as you go. State:

- every state you added or changed;
- every figure, with its arithmetic;
- every ruling you confirmed or overturned;
- how you measured criterion 1;
- any value you had to design, and how you marked it.

Commit nothing unless the lead asks.

### Designer handoff

2026-09-24 — `designer3`. Artifact edits complete; static verification passed;
lead's rendered geometry measurement and independent design review remain.
No commits. No contract, central memory/roadmap, `apps/`, other checkout,
`visual.css`, `structure.css`, `mockup.js`, or token registry edited.

**Ruling received during work.** The lead confirmed eleven tender controls
(ten digits + Delete) at 88×72, with the twelfth cell left blank; no pad on
zero states; ignore pads beneath modals; twelve 72×72 controls on each active
PIN modal. The lead corrected A1/AC1. On browser access, the lead subsequently
instructed CSS box-model arithmetic and will measure all states afterwards.

**Files.** `docs/design/visual-directions/frost/pos/settlement.html`, new
`docs/design/visual-directions/frost-settlement.css`, POS-04 in
`docs/design/SCREEN-INVENTORY.md`, and the existing POS-04 section of
`docs/design/SITEMAP.md`. The task handoff is the only coordination-file edit.

**Existing states changed.**
- `cardover`, `ceiling`: amount/message/Add above, full keypad to the left of
  notice/caption. The notice no longer pushes Delete under Close. Nothing is
  shrunk. The amount and correction rule remain visible together.
- `pending`: all order figures now include Steak; Add cash leads to the new
  `pending-paid` fixture, preserving its total and its close block. The notice
  says payment in progress blocks edits, so the shared wording also holds
  when the zero-total draft contains no tenders.
- `reauth`: Leave payment now targets `order.html?state=lock-draft`.
- `takeover`: added M-1's masked entry and 3×4 PIN grid, including Delete and
  Continue. External-charge acknowledgement remains before entry. Continue
  performs the fixture takeover navigation; the duplicate footer submission
  is replaced with its acknowledgement caption, matching M-1's Cancel +
  caption footer. Title and manager tag share one line; dot margins reuse
  12px spacing to keep the whole composition inside the device. No PIN
  digits are exposed. As with M-1, digit keys are drawn controls, not an
  authentication implementation.
- `empty`, `exactsplit`: Cancel now reaches the matching zero-/two-draft
  modal fixture. Link destinations only; appearance unchanged.
- No other existing state is intentionally restyled. The grouping wrapper
  preserves the ordinary vertical caption/keypad composition. `cancel` keeps
  its existing one-line sentence and one-draft background.

**New states and rulings.** All six lead rulings are confirmed as drawn;
none overturned. This is design evidence awaiting review, not approval.
- A5 `ceiling-single`: balance 94.500.000, entered 100.000.000, invalid field,
  maximum 99.999.999, correct notice/caption, inert Add.
- B1 `zero-pending`: the existing zero order with its Burger pending; pending
  notice below Nothing to collect, no pad, Close inert. Burger is chosen
  because it belongs to the existing 165.000 subtotal; silently inserting
  Steak here would repeat A2. The right-side empty caption also tells the
  cashier to resolve the pending item before closing.
- B2 `pending-paid`: full Cash 382.725 draft, balance zero, inert Close with
  its own name and `aria-describedby="pending-notice"`; focusable button role
  lets a keyboard/screen-reader user reach the description. Same on B1.
- B3 `error-keyed`, `error-partial`, `error-settled`, `error-removed`: complete
  correction walk; rejection notice says 27.800 after Card 10.000 is added,
  disappears on exact settlement, and stays absent when the new cash line
  is removed. Add and that Remove link walk these four states.
- B4 `cancel-empty`, existing `cancel`, `cancel-multi`: zero/one/two drafts
  with omitted/singular/plural sentence; corresponding Keep collecting links.
- B5 `cashsplit`, `partialcash`, `exactcashsplit`: same cash split caption as
  card, then one Cash 100.000 draft, then two Cash drafts totalling 155.925.
- B6 `change-mixed`: Card 100.000 + Cash 100.000; revenue copy correctly
  compares the order total to both tenders' sum, 200.000.

**Every figure, with integer/half-up working.** Whole IDR throughout.
- Baseline (also B4/B5/B6): subtotal 165.000 − discount 16.500 = net 148.500;
  service 148.500 × 5% = 7.425; total 155.925; included tax 148.500 ÷ 11 =
  13.500. Cash/Card 100.000 leaves 155.925 − 100.000 = 55.925; adding
  55.925 makes balance zero. Two cash drafts stay two drafts.
- A2/B2: 165.000 + Steak 240.000 = 405.000; discount 40.500; net 364.500;
  service 18.225; total 382.725; tax 364.500 ÷ 11 = 33.136.363… → 33.136.
  No drafts: balance/prefill 382.725. Cash 382.725: balance/prefill zero.
- B1: Burger 135.000 + Soda 30.000 = 165.000; comp 100% = 165.000;
  net/service/tax/total/balance all zero; no drafted payment lines.
- A5: illustrative subtotal 100.000.000; 10% discount 10.000.000; net
  90.000.000; 5% service 4.500.000; total/balance 94.500.000; included tax
  90.000.000 ÷ 11 = 8.181.818.181… → 8.181.818. This is an order subtotal,
  not a single tender. Cash maximum = min(94.500.000 + 9.999.999,
  99.999.999) = 99.999.999. Keyed 100.000.000 exceeds that by 1; its
  hypothetical change 5.500.000 is below 9.999.999, proving the tender cap
  is the binding limit. Maximum allowed change here is 5.499.999.
- Existing change ceiling: 55.925 + 9.999.999 = 10.055.924, unchanged.
- B3 retains DESIGN-004's changed order: 205.000 − 20.500 = 184.500;
  service 9.225; total 193.725; tax 184.500 ÷ 11 = 16.772.727… → 16.773.
  193.725 − Card 155.925 = 37.800; minus Card 10.000 = 27.800;
  minus Cash 27.800 = zero. Remove that cash: 27.800 again. The rejection
  is historical UI state; its absence after correction is not inferred
  from balance alone.
- B6: Card 100.000 + Cash 100.000 = tendered 200.000; remaining after
  card 55.925; cash change 100.000 − 55.925 = 44.075; tendered less
  change = 155.925, the revenue. Same amount handed over as existing
  `change`, but now explicitly across two methods.
- B4 counts: no lines → no count sentence; [155.925] → one;
  [100.000, 55.925] → two. No figure is a stored tender before close.

**Geometry: calculated, not final rendered measurement.**
- Frost device has no border: 1280×800. Header 64 leaves 736 high.
  Left column is 560 including its border; right is 720. Method row =
  12 + 56 + 12 + 1 = 81. Close region = 16 + 72 + 16 + 2 = 106.
  Tender body is therefore 736 − 81 − 106 = 549, or 525 after its 12px
  top/bottom padding. Horizontal room is 720 − 40 = 680.
- Tender grid = 3×88 + 2×10 = 284 wide, 4×72 + 3×10 = 318 high.
  Refusal composition allocates 284 + 20 + 376 = 680; the notice's inner
  text width is 376 − 32 padding − 2 border = 342. The field remains
  56px; label/tag row about 21px + 4px gap; message 20.3px + 4px gap;
  row bottom margin 8px. About 113.3px above the 318px grid leaves
  525 − 113.3 − 318 = 93.7px spare. Notice/caption share the grid's
  other column, instead of adding their height above the keys.
- With notice title up to two 20.3px lines, body up to six, 26px
  padding/borders, 4px title gap, 12px notice margin, and caption up to
  five 21.75px lines + 14px margin, the side column budget is 327.15px;
  even that conservative allowance fits inside the 411.7px remaining.
  Line wrapping still requires the lead's real-browser check.
- Non-refusal states keep their original composition. Worst new split
  caption budget of four 21.75px lines + 14px, with ~81px label/field,
  8px row margin and the 318px grid: ~508px of 525. Zero states intentionally
  have no pad. Modal states intentionally obscure the underlying pad.
- PIN grid = 3×72 + 2×10 = 236 wide and 318 high. Takeover modal stays
  560 wide; its body has 518px inside padding/borders. Its title row is
  ~59.1 high, footer 105, borders 2. Budgeting notice at 152px plus 24px
  margins, label 21.4, dots 44 (20 + 2×12), pad 318, body padding 40:
  total ~765.5px, under 800. Reauth's existing composition is unchanged.
- A baseline-only headless run before the lead's later instruction captured
  old `cardover`: tender body clientHeight 549, scrollHeight 614. That was
  the defective input, **not verification of this delivery**. No further direct headless
  browser run or escalation was requested after the instruction. The lead must
  measure all 34 final states, clipping/occlusion and touch geometry.

**Verification and shape check.** Python's HTMLParser checked all 34 named
states using the same `data-when`/`data-unless` visibility rules: balanced
markup, one total/balance/field/tag/close per applicable state, draft sums
minus change plus balance equal total, live Close only at zero, 11 active
unobscured tender controls or 12 active PIN controls, and both pending-zero
Close descriptions. All passed. No browser, physical touch, or actual
screen-reader verification is claimed. Additional checks below recorded
when finished.

The cross-state check found existing fixture-navigation limitations beyond
these drawings: method links reset the draft to empty/card; many Cancel
entry links still select the one-card example regardless of their source;
`exactsplit` removing its first line drops the other too; `error` removing
its original Card returns to baseline totals; `overflow` Remove and original
`error` Add are placeholders. New snapshots retain placeholder Remove links
for permutations not drawn; the B3 last-cash Remove is explicitly walkable.
These do not define production behavior. They are listed for the lead rather
than silently inventing a complete interactive settlement runtime. No other
shared **displayed monetary value** failed the static state check.

**Values/provenance.** No new token value was needed. The new sheet composes
existing key dimensions, gaps, panel spacing, field borders/padding and
Frost colors. No new registry entry or fabricated source claim. Inline
fixture numbers are money examples, derived above, not design tokens.

**Final checks.** `git diff --check` passed. The source CSS files, shared
runtime and token files have no diff, preserving their provenance. The
Impeccable detector ran once and returned warnings (exit 2), not a clean
pass: existing small tags, inherited line-height/hierarchy, container
padding/clipping, colors/type sizes not represented by the comparison
DESIGN.md it auto-resolved, and em-dash density across the fixtures. These
are recorded rather than used to redesign Frost inside this correction.
It is not a per-state browser geometry check. Required final rendered
measurement remains with the lead. Temporary static checker/results are
`/private/tmp/design006-check.py` and
`/private/tmp/design006-static-results.json`; the latter ends with the
human-readable PASS line and is therefore a report, not pure JSON.

### Lead measurement, 2026-09-24

The lead measured the delivery in Chrome at a 1280×800 device, rendering every
one of the **34 states** in an iframe and reading each visible control's
bounding box against its nearest clipping ancestor and the Close bar.

- **Every state that draws the tender pad shows 11 controls at 88×72, with
  none clipped and none under Close.** That covers 29 states, including
  `cardover`, `ceiling` and `ceiling-single`.
- `takeover` and `reauth` each show a PIN pad of **12 controls at 72×72**,
  inside the device.
- `zero` and `zero-pending` draw no pad. The three `cancel*` states and
  `leaselost` are modals, and neither of them has a pad.
- In `cardover`, `ceiling`, `ceiling-single`, `takeover`, `pending-paid` and
  `zero-pending`, **no notice, caption, field, message, button or modal is
  clipped or runs past the device.**
- `cardover`, `takeover` and `reauth` were also checked by eye, from
  screenshots.
- *Leave payment* points at `order.html?state=lock-draft`. `visual.css`,
  `structure.css` and the token registry are unchanged.

**AC1 passes on a rendered measurement.** Three questions go to the design
review:

1. **`zero-pending` makes the Burger pending**, while the code's `zero` fixture
   has the Steak pending (a 100% comp over 405.000, which is also a total of 0).
   The handoff's reason, *"inserting Steak would repeat A2"*, does not hold at
   100% comp.
2. **The `pending` notice's wording changed.** If the review accepts it, the
   code will need to follow.
3. **`takeover` folded the explicit *I understand — take over* button into
   Continue** (*"Entering your PIN and continuing acknowledges this risk"*).
   `FR-G14` requires an acknowledgement before a takeover, and the takeover is
   audited. Is an implicit acknowledgement enough?

---

## Round 2 — the review's corrections (written by `lead`, 2026-09-24)

[The review](../reviews/DESIGN-006-review.md) returned *request changes*: three
P2 findings and one P3. **All four are accepted.** The review cleared A1–A3,
A5 and B2–B6, every figure, and the provenance check. Fix only these four:

1. **Method links keep the order's context** (finding 1). From `pending`,
   `pending-paid`, the `error*` states and `ceiling-single`, choosing Card or
   Cash must not fall back to the 155.925 baseline. Either draw the method
   variant the link needs, or make the link inert with a clear status until it
   has a truthful destination. **Check every method link in all 34 states.**
2. **Cancel shows the real draft** (finding 2). Every state's Cancel payment
   opens a modal that shows **that state's** drafts and count: 0, 1, 2 or
   overflow's 6. *Keep collecting* returns to **that same state**. A fixture
   parametrized by count is acceptable, provided the displayed draft and the
   links are all truthful.
3. **The takeover gets an explicit acknowledgement before the PIN** (finding
   3). After the warning there is a distinct *I understand* action, and only
   then does the PIN pad become active. Continue then submits the PIN for that
   one takeover. Keep the twelve-key M-1 composition. `B-12` holds.
4. **The pending notice gives a path that works** (finding 4). It tells the
   cashier that the payment has to be cancelled before the order can be edited,
   and in `pending-paid` it says that cancelling discards the cash draft. Its
   action leads to the **matching cancel state**, not to `lock-draft`. Keep the
   sentence *"payment in progress blocks both"*. The review accepted it.

**Lead's ruling on question 1:** the Burger stays in `zero-pending`. The design
state is an example. The code names whatever lines are actually pending, so no
change is needed on either side.

Every rule from round 1 still applies. **Re-check A1's geometry for any state
you change**, using box-model arithmetic, and the lead will measure it again.
Add a **Round 2 handoff** below.

### Round 2 handoff

2026-09-24 — `designer4`, Round 2 complete on the uncommitted Round 1
delivery. Only the four accepted review findings are in scope. No browser,
sandbox escalation, commits, application code, or contract changes.

**Composition chosen.** Keep all 34 named states. A settlement-only fixture
script will preserve the source state under a `cancel=1` modal, derive its
discard count from that state's visible drafted rows, and return Keep
collecting to the same source. The three existing cancel snapshots remain
entry points. Method choices without a truthful drawn destination will be
inert and visibly marked as unavailable in this example. Takeover uses an
explicit I understand step before revealing the existing M-1 PIN composition;
`ack=1` depicts the acknowledged step of this same modal. No authentication
runtime or PIN storage is introduced. Final checks and geometry follow below.

**Delivered and changed states.** All four accepted findings are corrected;
no ruling was overturned. No monetary value changed. Burger stays pending in
`zero-pending`, as the lead ruled.

- All 34 named states: method selection retains the current drawing; only
  `empty` ↔ `card` links to an alternate, because those share the same order,
  empty draft and unrejected context. Other alternate methods visibly say
  **Not drawn** and have no href. The selected method has no reset link.
  Existing voucher/account placeholders also gain the same explicit status.
  These labels describe fixture coverage, not product restrictions. Method
  slot dimensions and the `pressed` treatment are preserved.
- Every collecting state's Cancel link now opens
  `settlement.html?state=<source>&cancel=1`. The actual source remains behind
  the scrim, and the dialog copies its visible method/amount rows without
  Remove controls, plus its actual discard count. Keep collecting returns to
  the exact source, including pending, rejection, keyed value and method.
  `cancel-empty`, `cancel`, `cancel-multi` remain the zero/one/two-line gallery
  examples, returning to `empty`, `exact`, `exactsplit`. `reauth&cancel=1`
  replaces the sign-in overlay and returns to `reauth`. `takeover` and
  `leaselost` still have no Cancel payment entry. Background controls are
  inert while any overlay is visible.
- `pending`, `pending-paid`, `zero-pending`: the notice now explicitly says
  to cancel payment before sending or voiding, retains “payment in progress
  blocks both”, and opens that source's cancel dialog. `pending-paid`
  additionally names the Cash 382.725 draft that cancellation discards.
- `takeover`: the first step shows the warning and **I understand**, with
  PIN entry hidden. That action opens `state=takeover&ack=1`, revealing the
  unchanged twelve-key M-1 pad and masked dots. The acknowledgement button
  is replaced by “Risk acknowledged”; Continue submits for this one takeover.
  The query parameter represents an acknowledged drawing, not a security
  boundary. No entered PIN value is handled, stored, logged or audited here.

**Files and scope.** Settlement HTML and its separate CSS, new
`docs/design/visual-directions/frost-settlement.js`, POS-04 in SCREEN-INVENTORY
and SITEMAP, and this handoff. The shared `mockup.js`, source/provenance CSS,
token registry, review report, central coordination files and other checkout
are untouched. There are still 34 named states and 7 POS / 13 BO / 6 modal
nodes; `cancel=1` and `ack=1` are documented fixture parameters within existing
overlays. No additional visual redesign or application implementation.

**Counts and money.** No new monetary figures. The read-only cancel list
copies the source rows rather than maintaining a second money fixture.
Count = number of drafted tender rows; “Change given” is displayed but not
counted. Zero omits the sentence; one uses singular; two, three and six use
their exact counts. `error-settled` has **three**, a case beyond the review's
0/1/2/6 examples: 155.925 + 10.000 + 27.800 = 193.725. `overflow` has six:
40.000 + 30.000 + 20.000 + 10.000 + 20.000 + 35.925 = 155.925. Mixed change
has two tenders, 100.000 + 100.000, and a separate −44.075 change row.
All remaining sums and totals are the Round 1 arithmetic above.

**A1 box-model check, not rendered measurement.**

- Every changed method bar retains four 56px slots within 680px: three 8px
  gaps leave (680 − 24) / 4 = 164px per slot. With 32px padding and 2px border,
  text has 130px. A 15px name line (21.75px) plus a 12px status line (17.4px)
  uses 39.15px of 54px inner height. No additional row is added to the bar.
- All underlying tender compositions retain the Round 1 budget: 525px body
  interior, keypad 284×318 (eleven controls at 88×72), 81px method region and
  106px Close region. Ordinary/split composition upper budget remains ~508px;
  refusal composition remains ~113.3px above the 318px grid, with guidance
  beside it. No Round 2 change takes vertical space from a tender pad.
- Pending notices live in the left column. Totals region = ~193.1px;
  balance = 80.4px; Cancel footer = 96.4px. From 736px below the header,
  the notice/list region has 366.1px, or 334.1px inside its padding.
  Notice text has ~484px width. Allowing two title lines and five body lines
  at 20.3px, plus 26px padding/borders, 4px title gap and 12px bottom margin,
  gives 184.1px. With the draft heading (~25.75px) and the paid row (56px),
  `pending-paid` uses ~265.85px. `zero-pending` instead adds Nothing to
  collect (~123.2px including margin), totalling ~307.3px of 334.1px.
- Cancel modal remains 560px wide, 518px body interior. Conservative prose
  budget: first paragraph four lines, external-charge paragraph four,
  count one, all at 21.75px = 195.75px; paragraph margins total 60px.
  Six read-only rows at 32px = 192px. With body padding 40px, header 59.1px,
  footer 105px and outer borders 2px, maximum = ~653.85px of 800px. Its
  72px action controls are unchanged. These rows are text, not touch targets.
- Takeover's unacknowledged step has no active PIN pad. The acknowledged
  step removes I understand rather than stacking another action above the
  pad. At 560px modal width, allow warning title two lines and body four at
  20.3px, 26px padding/borders, 4px title gap, 24px notice margins: 175.8px.
  Add header 59.1, body padding 40, label 21.4, dots 44, grid 318, footer
  105 and borders 2 = ~765.3px. PIN grid stays 236×318, twelve 72×72 keys.
  `reauth` remains unchanged. All these are wrapping allowances; the lead
  must measure actual wrapping, clipping, focus and occlusion.

**Verification.** Balanced HTML and 34 distinct named states passed.
`node --check` passed for the new fixture script; `git diff --check` passed.
A temporary DOM simulation executed the actual settlement script against
all 34 named states, all 34 `cancel=1` variants, and `takeover&ack=1`:
**69 compositions passed**. It checked every method destination/inert status,
source and modal draft amounts, 0/1/2/3/6 counts, matching Keep collecting
links, pending cancel links, at most one visible modal, inert background,
acknowledgement before twelve PIN keys, and eleven unobscured tender keys.
A separate static arithmetic pass confirmed draft less change plus balance
equals total in every applicable named state. No browser, physical touch,
screen reader, authentication, lease or server behavior was tested.

The Impeccable detector ran once: 34 warnings across inherited padding,
small tags, leading, clipped-container risk, palette/type registry mismatch,
hierarchy and em-dash density. It auto-resolves the old comparison DESIGN.md;
the existing Frost/task constraints remain authoritative. This is not a
clean detector result and is not evidence of rendered geometry. No new token
was needed: the 12px secondary label, 32px group row and 12px row gap already
exist in Frost. Temporary checker and detector evidence are under
`/private/tmp/design006-round2/`; they are not repository deliverables.

**Remaining limits / next handoff.** Lead should measure the three pending
notices, both takeover steps, and all source-specific cancel overlays,
especially `overflow`, `error-settled` and `change-mixed`. The previously
reported Remove/Add placeholder limitations outside these four findings
remain unchanged; unavailable method variants are now explicit. The fixed
post-cancel order fixture remains the existing `order.html?state=default`.
This drawing still does not implement a complete order/payment runtime.
Nothing committed; no contract change or uncovered invention was required.
