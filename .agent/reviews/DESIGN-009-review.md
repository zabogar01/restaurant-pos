# DESIGN-009 review — POS-05, POS-06, the refund sheet, and where Close lands

**Reviewer:** Claude (Opus 5.5), reviewing work built by a Codex designer.
**Branch:** `agent/design-009` at `74943f7`, compared with `development`.
**Date:** 2026-09-30.

## 1. Verdict

**findings** — nine findings. Two are high: the manager approves a refund
without seeing where the money goes, and Close lands on a floor that still
shows the order as open. Two are medium: the closed-day list hides the new
day's refundable orders, and the Handoff leaves two money and audit questions
unraised. Five are low.

The artifacts are careful work. The whole-order rule, the zero-total absence,
the AC-25 default, the terminal REFUNDED state, the missing void control, the
receipt-class reprint failures and the removal of wireframe links all hold in
source. The findings are about states the fixtures do not picture, and about
questions the Handoff answers without raising them.

## 2. Findings

### F1 (high) — The manager PIN prompt hides the refund allocation it approves

**Location:** `docs/design/visual-directions/frost/pos/closed.js:123`
(`drawApproval`). Also `closed.js:103–104`: while the modal is open, the sheet
is not drawn under it.

**What is wrong.** The M-1 prompt reads *Refund Table 1, 155.925 — reason:
Wrong dish served*. It never shows the allocation, which is the part of the
refund the manager can change. When `overlay` is `approval`, the allocation
sheet is not rendered. The detail behind the scrim shows the *original*
payments, not the allocation being approved. The prompt copy is identical for
the default allocation (Card 100.000 · Cash 55.925) and for an edited one that
returns the whole 155.925 in cash from the drawer. So the value that decides
where money leaves the restaurant is invisible at the moment of approval, and
it is the edited case that it hides.

**Authority.** FR-H5: allocations are *selected by the manager*. FR-A6 and
B-14: the approval authorises *one specific action*, and the allocation is
part of what that action does. The task's minimum (*names the refund, its
amount and the reason*, Part B) is met in letter. It does not make a hidden
allocation acceptable against FR-H5.

**Failing scenario.** A cashier opens the refund sheet on Table 1 (Card
100.000 + Cash 55.925). They edit Card to 0 and Cash to 155.925, pick a
reason, and tap Continue. The manager walks over and sees *Refund Table 1,
155.925 — reason: Wrong dish served*. They enter their PIN. The system then
records 155.925 of cash leaving the drawer against a sale where only 55.925 was
taken in cash. The manager's PIN is on an allocation they never saw.

**Proposed fix.** Show the allocation lines in the M-1 subject on POS-06,
for example *Card 0 · Cash 155.925*. Also mark when it differs from the
default, for example *Allocation edited*. The modal has room: the design's
own measurement puts it at 581px of an 800px device. Keep the rest of M-1
unchanged. If the lead reads FR-H5 as requiring the manager to operate the
sheet, not just approve it, that is an owner question. Raise it with this
wording.

### F2 (high) — Close lands on a floor that still pictures the closed order as open

**Location:** `docs/design/visual-directions/frost/pos/settlement.html:298–299`
now links to `floor.html`, the `default` state. At
`docs/design/visual-directions/frost/pos/floor.html:57`, that state draws
*Table 1 · 2 rounds fired · 1 line pending · Open · 155.925*.

**What is wrong.** Every settlement state is *Payment — Table 1*
(`settlement.html:43`), totalling 155.925. After Close, the landing state
shows that same order still open, with a pending line. The zero-total Close
(`settlement.html:299`, state `zero`) lands on the same state, so a 0 comp
also shows as Table 1 open at 155.925. The floor's `default` state is now
shared between two meanings: *the ordinary floor* and *the floor right after
closing Table 1*. It is wrong for the second one, and that is exactly the
state Part C adds.

The Handoff's failed-print landing has the same fault. `receipt-warning`
uses the same grid (`floor.html:56`, `data-when="default incident
receipt-warning"`), so it shows Table 1 open. Meanwhile its own incident reads
*Receipt did not print — Table 1, closed 20:14* (`incidents.html:106`). This
contradiction existed before this task. It matters now because Part C's
argument depends on this state.

**Authority.** Part C and acceptance criterion 7: the Close links must match
the recommendation. A link that lands on a state contradicting the close is
not a match. FR-G10: a table order cannot close while a line is PENDING, so a
floor showing *1 line pending* on the order just closed pictures something the
product forbids. `SCREEN-INVENTORY.md:91`: the floor is *returned to after
close*. The state it returns to must reflect the close.

**Failing scenario.** A builder implementing F4e takes `settlement.html →
floor.html` as the reference for what the cashier sees after Close. The
reference shows Table 1 still occupied. That fixture cannot tell apart a
correct implementation (Table 1 free) from a stale-floor bug (Table 1 still
open after Close). The second is the more likely bug, because the client
store holds the order until the floor refetches.

**Proposed fix.** Add a floor state for the moment after Close, for example
`after-close`, where Table 1 is free and the counts are adjusted. Add a
`receipt-warning` variant with Table 1 free too. Then point both Close links
at it: the normal close at `after-close`, and the failed-print case at the
free-table receipt-warning variant. `floor.html?state=clear` has Table 1 free,
but it also frees every other table and drops the open quick sale, so it is
not a faithful substitute. Name the new state in the Handoff. The rule is *no
other state of an existing artifact changes appearance*.

### F3 (medium) — Under the closed-day banner, the new day's refundable orders cannot be found

**Location:** `closed.js:30`, `:37–38` and `:42`. Also the floor redirect at
`floor.html:109`, which sends every Closed-orders tap from the `dayclosed`
floor to `closed-orders.html?state=dayclosed`.

**What is wrong.** FR-I3 opens the next business day at the moment of close.
The floor banner then *stands* (ruling I-4), and its own copy says *new orders
belong to the next business day*. The design ties the POS-05 list's day to
the floor's banner state, not to the orders that exist. While the banner is
up, every entry to POS-05 lists only the closed day's six read-only orders.
The Handoff's A4 answer covers the moment just after close, when the new day
has no closed orders. It does not say what happens once a new-day order
closes while the banner still stands. No drawn control reaches the open day's
list from that floor. How long the banner lasts is defined nowhere in the
artifact or the Handoff.

**Authority.** `SCREEN-INVENTORY.md:438`: POS-05 is *scoped to the open
business day*. The Handoff proposes a closed-day exception, which is fair to
propose, but the exception must not remove the rule's main case. FR-H5 and
FR-G7: new-day orders are refundable and reprintable, so they must be
findable. Ruling I-4.

**Failing scenario.** The day closes at 23:14 and the banner appears. At
23:40 a quick sale on the new day closes. At 23:45 the customer asks for a
refund. The cashier taps Closed orders and sees the 25 Sep orders marked
read-only. The 23:40 order is not listed, and nothing on the screen offers
the open day.

**Proposed fix.** Under the banner, POS-05 lists the open day's closed orders
first as the normal, refundable list. Below them it shows a separate group
marked *Closed day · 25 Sep · reprint only*. This keeps the A4 argument (the
just-closed orders stay visible) without hiding the open day. Also state when
the banner clears. Either choice is a design call, so the lead should rule on
it with A4.

### F4 (medium) — Refund allocation rules are decided silently, not raised

**Location:** `closed.js:83` (allocations built only from the original
tenders), `closed.js:117` (one editable row per original tender, with no way
to add one), `closed.js:133` (any amount accepted, including 0), and
`closed.js:102` (zero rows are filtered out of the REFUNDED view).

**What is wrong.** The design settles three FR-H5 questions without listing
them:
1. **Allocation targets.** The manager can only change the amounts on the
   original tender rows. They cannot add a tender type, so a card-only quick
   sale can never be refunded in cash.
2. **No cap per row.** A row may exceed its original effective contribution,
   for example Card 155.925 against a 100.000 card payment.
3. **Zero-value rows.** Editing a row to 0 is allowed. The REFUNDED view then
   hides it without comment, so it is undefined whether a zero `RefundTender`
   would be recorded. FR-H5b calls a zero-value allocation *a fake money
   record*.

Each of these may be the right answer. None of them is in *Questions raised*.

**Authority.** Criterion 10: the Handoff lists every question raised and not
ruled. The Objective asks for artifacts a builder can build *without asking a
question*. FR-H5 (*selected by the manager*) and FR-H5b.

**Failing scenario.** F4e's builder meets a card-only order whose card cannot
be reversed and has to decide alone whether a Cash row may be added. The
server validator and the sheet may then disagree about a zero row.

**Proposed fix.** Add the three questions to the Handoff with proposed
answers. My suggestions: original tenders only, as drawn; no cap per row,
with the question raised; zero rows dropped before the command and never
recorded. The lead routes them to the owner.

### F5 (medium) — Audit outcome for "approved, then the command failed" is not raised

**Location:** the `refund-error` and `day-refusal` states (`closed.js:96–97`).
The Handoff's audit paragraph covers only *cancel* and *success*.

**What is wrong.** In both states the manager has entered a valid PIN and the
refund did not happen. FR-J3 audits *every manager-approval outcome*. It
defines one combined entry for a successful approved action and an entry with
a null approver for a failed or cancelled approval. An approval that succeeds
followed by a command the server refuses fits neither definition. The
Handoff says nothing about what is recorded in either state.

**Authority.** Task constraint: *Audit and gating are the owner's contract
(FR-J3, FR-G14). Raise any question about whether an action is audited or
gated; never rule it.* Also FR-J3, AC-18 and criterion 10.

**Failing scenario.** F4e's builder writes the refund command handler and has
to choose, unguided, whether a refused refund writes an audit entry, and with
which approver.

**Proposed fix.** Raise it in the Handoff with a proposed answer, for example
*one entry naming actor and approver, outcome REFUSED with the refusal code,
no money fields*. Leave the ruling to the owner.

### F6 (low) — "Review refund" after a failure ignores eligibility, and the copy assumes a definite rejection

**Location:** `closed.js:96`. The `refund-error` notice renders a *Review
refund* button (`data-action="refund"`) whether or not the order is zero,
REFUNDED or on a closed day. The click handler at `closed.js:128` opens the
sheet without checking.

**What is wrong.** Everywhere else, eligibility is enforced by not rendering
the Refund control (`closed.js:89`, `:88`). This notice is the one place that
renders it by state alone. In the fixture it is reached only by a hand-made
URL: `?state=refund-error&order=refunded` offers a second refund on a
REFUNDED order, and `&order=zero` puts a Refund element in the DOM of a
zero-total order. No POS-05 link produces either URL, so the artifact as
walked is sound. The builder-facing point is the copy. *Refund failed · the
order is unchanged* is true only for a definite server rejection. After a
timeout, the client cannot know that nothing was written.

**Authority.** B-10 and AC-14: a second refund is rejected. B-20. FR-H5b and
ruling C-1: the Refund action is absent on zero-total orders.

**Failing scenario.** A refund command times out and the server commits it.
The client shows *the order is unchanged* with *Review refund*. The manager
enters a PIN again, and the server rejects the second refund as AC-14
requires. The screen then contradicts itself.

**Proposed fix.** Note in the Handoff that `refund-error` pictures a definite
rejection only. For no response, the client re-reads the order before offering
*Review refund*. Gate the notice's button on the same eligibility as
`figures()`.

### F7 (low) — A filter can show as set while the list ignores it

**Location:** `closed.js:32–34` and `:62–66`.

**What is wrong.** *Apply filter* updates the toolbar chip but not the list.
The list filters only when `state` is `filtered` or `nomatch`, and only
*Search* sets that. Once Search has been pressed, later Applies filter the
list straight away. So the same Apply control behaves two ways, and before
the first Search the toolbar can read *Table 7 · Set* over a list of all six
orders. The Handoff describes Apply and Search but not this mismatch.

**Authority.** Rule A1: the filters must be drawn so a cashier can set them
on touch without doubt.

**Failing scenario.** A cashier sets Table 7, taps Apply, sees *Table 7* in
the toolbar and six rows below it. They conclude the filter is broken, or
they pick the wrong Table 1 row.

**Proposed fix.** Choose one model. Either Apply filters immediately and
Search is dropped, or chips that have not been searched are marked pending
until Search. State the choice in the Handoff.

### F8 (low) — Registry tokens borrowed for unrelated dimensions

**Location:** `docs/design/visual-directions/frost/pos/closed.css:12` and
`:17`.

**What is wrong.** The POS-05 list columns are
`var(--frost-pin-key-height)` (88px, the lock keypad's key height),
`var(--frost-category-width)` (172px, the menu category rail) and
`var(--frost-receipt-reprint-width)` (180px, a button width). `.co-field`
also borrows `--frost-receipt-reprint-width` for its width. This passes
criterion 1's literal test, since no raw size appears. But it gets there by
binding the list's geometry to unrelated components, not by raising the
missing tokens as the constraint requires.

**Authority.** Constraint: *If a value has no token, raise it; do not add
one.* `docs/DESIGN.md` names each of these tokens for its own component.

**Failing scenario.** A later change to the PIN key height, for example
during a lock-screen touch-size review, silently widens POS-05's *Closed at*
column.

**Proposed fix.** Raise the list column widths and the allocation field width
as missing tokens in the Handoff, with the values used. The lead decides
whether to register them.

### F9 (low) — Two small fixture and accessibility slips

1. **Invented discount row on the quick sale.** POS-06 `quick` draws
   *Discount 0* (`closed.js:82`, `:89`). The workspace's quick-sale totals
   have no discount row (`order.html:374–379`). B10 asks for the figures as
   stored, and FR-G7 asks for identical figures. **Fix:** omit the discount
   row when the order carries no discount.
2. **The final incident clear is no longer announced.** In `incidents.html`,
   the last clear now empties the `aria-live` status line
   (`incidents.html:151`). It reveals the `.empty` composition, which is not a
   live region. Before this change, a screen reader heard *Nothing
   outstanding*; now it hears nothing. Part D5 asked for one visible message,
   not for silence. **Fix:** keep the visible text single, but give the empty
   composition `role="status"`, or put a visually hidden announcement in the
   live line.

## 3. What I ran and what I did not

**Observed.**
- `npm run verify` on `74943f7`: typecheck passed (`tsc` for server, money
  and pos), and `vitest run` reported **32 test files passed, 2256 tests
  passed**, with no failures. Dependencies were present in this worktree, so
  the designer's `tsc: command not found` did not recur.
- The tree did not move. `git status --porcelain` was empty and `HEAD` was
  `74943f7d2be7c8ac2d89215de246e3f2b1b54160` both before verify and after my
  last check.
- `grep -r "prototype/" docs/design/visual-directions/frost/pos` returned
  nothing (criterion 6 as corrected).
- A grep of `closed.js` for `void`, receipt-number patterns, `fiscal`, `GST`,
  `15.59` and `COUNTER` returned nothing.
- Every `--frost-*` token referenced in `closed.css` is defined in
  `docs/design/tokens/frost.css`. I checked the uncommon ones by name.
- The designer's commit `06f3a25` changes only the Handoff section of the task
  file. The two later commits on the branch are the lead's.
- Paper POS artifacts load the shared `mockup.js`, so its chrome change
  reaches them. The chrome is `display:none` in `visual.css:54`.

**Inferred from reading source, not executed.** Every behavioural claim in
F1, F3, F6 and F7, and the clearances below, comes from reading `closed.js`,
`floor.html`, `settlement.html` and `order.html`. I tried to exercise the
fixtures headlessly with `jsdom` through `node -e`. The command needed an
approval I did not have, so it did not run. I did not open a browser. The
1280×800 measurements, the 154-state crawl and the interaction checks in the
Handoff are the designer's evidence. I did not re-observe them. I made no
mutation run.

## 4. Cleared

- **B1 / B-23:** no line selection and no partial-amount field. The sheet
  always names the whole-order amount, and Continue is disabled unless the
  allocation sum equals the total (`closed.js:116–120`).
- **B2 / FR-H5b / C-1 / criterion 4:** on the zero-total order, `figures()`
  omits the Refund button, and the sheet cannot open (`closed.js:88–89`).
  The only exception is F6's hand-made URL.
- **B3 / AC-25 / criterion 3:** Cash 200.000 − change 44.075 = 155.925 is the
  default (`closed.js:14`, `:83`). The Handoff shows the arithmetic, and the
  sheet repeats it. The split (100.000 + 55.925), edited (80.000 + 75.925) and
  mismatch (short by 20.000) fixtures add up. The custom six-tender fixture
  sums to 155.925 and reuses settlement's *Meal voucher* and *Staff account*.
- **B4:** the reason is required, with presets plus *Other — type a reason*
  as in `order.html:594–598`. The Handoff says the presets are fixture copy.
  The on-screen keyboard is uppercase only, while the `sheet-other` fixture
  shows *Meal was cold*. This is cosmetic.
- **B5 / B-10 / FR-H6:** REFUNDED removes the action, and the header tag and
  notice say so. A successful walk reaches the same composition.
- **B6 / B-19 / FR-H1:** POS-06 has no void control. The `order.html` changes
  are count copy only, and it has no refund.
- **B7 / FR-G7 / AC-13:** reprint states keep stored figures. *Reprint sent*
  has no time, and only `reprint-printed` carries 20:26.
- **B8:** no receipt layout, receipt number, fiscal field or correction
  control.
- **B9 / B-14 / B-20:** the approval is an in-place dialog. Cancel returns to
  the sheet with the allocation and reason kept and the PIN cleared. The next
  attempt needs a new PIN. The Handoff says the cancel audit entry exists.
- **B10:** the default totals match settlement (165.000 − 16.500 + 7.425 =
  155.925). Leaving out *Includes tax* follows the task's instruction. See
  F9.1 for the quick-sale row.
- **FR-E6 / AC-23:** FAILED and UNKNOWN reprints use the amber receipt class
  and link to `incidents.html#receipt-1`, which exists.
- **FR-H7 / B-9 / I-4:** closed-day detail offers no Refund. `day-refusal` is
  distinct from the standing `dayclosed` state and offers no retry.
- **A1, A2, A5:** three touch filters with no receipt-number key, a distinct
  REFUNDED tag, the zero comp listed at 0, and *Quick sale* naming.
- **Criterion 1:** both artifacts and all states are in `manifest.js`, and
  the new CSS uses registry tokens only (F8 qualifies how).
- **Part D:** the answers are present and each artifact change is named. The
  Table 9 fixture does have two lines (`order.html:249–250`). The floor's
  dayclosed redirect runs after the deferred `mockup.js` sets `data-state`.
- **DESIGN.md:** the light-only line is added as instructed, and the
  supplement is marked as awaiting review.
- **Contract:** none of the four product documents, no accepted ADR and no
  token file is touched. Nothing under `apps/`, `packages/` or `db/` is
  touched.
