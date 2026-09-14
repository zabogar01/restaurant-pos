# DESIGN-002 — Wireframe review

**Status:** Active
**Owner:** Product owner reviewing; `lead` capturing and applying
**Depends on:** none

## Objective

Walk the committed wireframe prototype screen by screen and record what the
owner finds. This is the review A2 never got: the prototype was built and
committed without anyone checking it against the requirements or against how
the work actually happens on a floor.

## Required inputs

| Input | Path |
|---|---|
| Wireframe launcher | `docs/design/prototype/index.html` |
| Confirmed structure | [docs/design/SITEMAP.md](../../docs/design/SITEMAP.md) |
| Screens, states, rulings | [docs/design/SCREEN-INVENTORY.md](../../docs/design/SCREEN-INVENTORY.md) |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) |

## Constraints

- The wireframes are **greyscale by intent**. Colour, typography, and
  component styling belong to
  [DESIGN-001](DESIGN-001-external-visual-direction.md) and the owner's
  external tool. An agent that adds colour here has misunderstood the task.
- A finding that would break a boundary is not applied. The task is wrong, not
  the boundary.
- Structure is currently described as **confirmed** in three places. Changing
  it means changing SITEMAP.md, SCREEN-INVENTORY.md, **and**
  `docs/design/EXTERNAL-HANDOFF.md`, which tells an external tool the screen
  list is complete and the structure settled. A structural change applied to
  two of the three sends a tool the wrong brief.
- The rulings C-1 to C-7 and I-1 to I-11 were reasoned. Reversing one is
  allowed but is a decision, recorded with its reason — not a silent edit.

## Acceptance criteria

1. Every finding is recorded below with the screen it belongs to and whether
   it is behavioral, structural, or a wireframe defect.
2. Each applied change names the file it changed.
3. Any structural change reaches all three documents named above.
4. Findings the owner raised and chose not to act on are recorded as declined,
   with the reason, rather than dropped.

## Out of scope

- Visual design of any kind.
- Application code.
- Changes to PRODUCT.md, PRD.md, ROADMAP.md, or BOUNDARIES.md. A wireframe
  finding that argues one of those is wrong is raised to the owner as a
  finding, never edited.

## Findings raised by the owner

Recorded by `lead` as raised, before analysis. The ruling on each is the
designer's, recorded in the Handoff below.

**F-1 — POS-03, cancel control on a pending order line.** After an item is
selected but before the order is fired, each order line should carry a cancel
control on the line itself.

*Lead's read:* removal of a PENDING line already exists, but only inside the
line-editor `[SHEET]`. `FR-H2` requires no approval, no audit, and explicitly
no confirmation dialog for removing a pending line, so a direct per-line
control is consistent with the requirement rather than a change to it. The
risk is state conditionality: a FIRED line is voided under `FR-H4`, needing a
manager PIN, a reason, and a cancellation ticket (`B-16`). One control that
silently removes a pending line and PIN-gates a fired one teaches the cashier
the wrong lesson about what a control means.

**F-2 — POS-04, card tender should not require entering an amount.** Card is
exact, so no keying. Split payment might be a toggle or a separate tab.

*Lead's read:* `B-5` forbids recording a non-cash tender above the remaining
balance, so defaulting card to the full remaining balance satisfies the
boundary by construction and removes a keying step from the most error-prone
screen. Split tender is in MVP scope (`PRODUCT.md`, `FR-G1`–`G14`) and must
survive. Two shapes: (a) prefill the full remaining balance, editable in
place — no new node; (b) an explicit split mode or tab — a new structural
node, which drags SITEMAP, SCREEN-INVENTORY, and EXTERNAL-HANDOFF with it.
`B-18` still requires exact settlement at close.

**F-3 — WITHDRAWN.** The owner asked whether line cancellation could drop the
manager gate entirely and be "just some kind of x button", then withdrew it
once the split was laid out: `FR-H2` already makes a PENDING line ungated and
unaudited, which ruling I-12 implements as the per-line `×`; `FR-H4` gates a
FIRED line behind a manager PIN, and `AC-3`, `AC-10`, `AC-11`, and `AC-22` are
all built on that gate. Removing it would have been a PRD amendment. No change
made, no contract wording proposed. Recorded so it is not re-raised as a new
question.

## Owner rulings made during the review

**Tender pads are a persistent panel, not an edge-entering `[SHEET]`.** Ruled
by the owner 2026-09-10, after the designer surfaced the disagreement and the
reviewer confirmed all three documents said `[SHEET]` while only the prototype
drew a panel.

The prototype was right and the documents lagged. SCREEN-INVENTORY's "what the
drawing exposed" item 2 already recorded the reason: sheets pushed the drafted
payment lines under the close bar at 1280×800, and POS-04 is the one screen
where `FR-G9`'s "nothing recorded until close" has to be legible at a glance.
The finding was written down and never propagated to the node type.

`SITEMAP.md` §1 and §2, `M-4` in SCREEN-INVENTORY.md, and the overlay list in
EXTERNAL-HANDOFF.md are retyped to match, with dismissal behaviour stated
explicitly. Overlay semantics change; screen count does not.

## Handoff

**2026-09-10 — `lead`.** Task opened when the owner asked to begin reviewing.
`designer`, who authored the prototype, is no longer live; the lead captures
and applies findings.

---

**2026-09-10 — `designer` (reinstated).** Two owner findings analysed and
applied. Neither is structural. Details below.

## Finding 1 — POS-03, per-line cancel control

**Ruling: APPLIED, with the gated twin deliberately kept out of the same
slot.** Recorded as ruling **I-12** in SCREEN-INVENTORY.md.

*Verification of the lead's read.* Confirmed on both counts, and one thing
more. Removal of a PENDING line existed only as a `Remove line` button inside
the line-editor sheet (`order.html?state=sheet-line`); the pending row's whole
body was the only way in. FR-H2 and **AC-3** — "voiding an unfired line
succeeds with no prompt" — make a direct per-line control consistent with the
requirement rather than a change to it, so no contract question arises.

*The thing that was not in the finding.* **A FIRED line had no affordance at
all.** `sheet-voidline` was drawn, annotated, and listed as a state, but
nothing in the prototype linked to it. The void-a-fired-line path was a dead
end. That is a wireframe defect, and it was fixed as part of this work.

*The state-conditionality problem, and how it is resolved.* Not by making one
control behave two ways, and not by disabling it. An order line now has
**three affordance signatures**, each readable in greyscale without reading
the words:

| Line state | Trailing slot | Row body | Consequence |
|---|---|---|---|
| PENDING | remove control (56px square) | opens the line editor | gone on one tap, no prompt, nothing written (FR-H2, AC-3) |
| FIRED | **reserved and empty** | opens the void sheet | manager PIN + required reason + cancellation ticket (FR-H4, B-16, AC-22) |
| VOIDED | reserved and empty | inert | terminal |

The rule this encodes: **the trailing slot of an order line carries exactly
one meaning and never acquires a second.** A gated action is never reachable
from the position an ungated one has already taught. A control that is silent
on one row and PIN-gated on the row above it produces a reflex that is correct
most of the time, and B-16 means the wrong one-in-twenty cannot be undone —
paper cannot be un-printed.

*Absent, not disabled* — the same reasoning the lead already accepted in
ruling C-1: a disabled control invites hunting for an override. The slot is
still **reserved** on fired and voided rows, for two reasons: it keeps the
money column in one place down the panel, which is what the cashier actually
scans; and it makes the absence visible rather than inferred.

*The manager marker sits on the round header, once per group, not on every
row.* The order panel's first job is being read. A tag on each of nine fired
lines is noise; a tag on each of two round headers is a fact.

*Does the line-editor sheet still earn its place?* **Yes, narrowed.** Quantity
(FR-D5, max 99 under FR-M5) has nowhere else to live, and putting `−`/`+`
steppers on the row would put three controls on a row whose main job is being
read. The sheet keeps its own Remove control — a cashier who opened it to set
quantity toward zero should not have to back out to find the exit. The
per-line control is the fast path, not a replacement. The sheet now says so.

## Finding 2 — POS-04, card amount

**Ruling: APPLIED as shape (a) — prefill, editable in place. Shape (b), an
explicit split mode or tab, DECLINED.** Recorded as ruling **I-13**.

*Verification of the lead's read.* Confirmed. B-5 — "a non-cash tender is
never recorded above the remaining balance" — is satisfied by construction if
the prefilled value *is* the remaining balance, because for card and custom
that value is simultaneously the default and the ceiling. Editing can only
reduce it.

*Applied to every method, not only card.* Cash gets the same prefill, because
exact cash is common and the keystroke is just as wasted. But cash and card
are **not** the same component (FR-G3, G4, B-5, M-4), and the prefill means
something different in each: for card it is the maximum, for cash it is a
default that may be exceeded. That difference is now stated in a caption
directly under the field — this is where a rule that was only *true* becomes
*legible*.

*Why (b) is declined.* Three reasons, in order of weight:

1. Keying an amount below the balance **already is** the split. The remainder
   stays on the balance, the pad is ready for the next method, and the close
   control stays refused until the balance is zero. A mode adds a step to
   reach a behaviour that already exists.
2. I agree with the lead's argument and it is the strongest one: a mode the
   cashier must remember to enter is a mode they forget with a customer
   waiting. B-18 is enforced against the **balance**, never against a mode,
   so a forgotten mode must never be able to change the arithmetic — and with
   no mode, it cannot.
3. It is the only version of this finding that would be structural. A tab or
   mode is a new node, which would have to land in SITEMAP.md,
   SCREEN-INVENTORY.md and the external brief that already tells a tool the
   structure is settled. That cost buys nothing the prefill does not deliver.

*What prefilling does NOT remove.* The over-balance rejection stays drawn. A
cashier can still key past the maximum, and **AC-6** requires the refusal to
name the maximum. The `cardover` state now reproduces AC-6 verbatim — 20.00
keyed against a 15.59 balance, 15.59 offered — where it previously used
figures that matched no acceptance criterion.

## Files changed

| File | Change |
|---|---|
| `docs/design/prototype/wireframe.css` | `.line__x` (the per-line remove control, 56px square), `.line__x--empty` (the reserved empty slot), link resets for `a.line` / `a.line__b`. Greyscale only; no colour, type, or motion added |
| `docs/design/prototype/pos/order.html` | Per-line remove on every PENDING row (table, quick sale, overflow); reserved empty slot on every FIRED and VOIDED row; fired rows now reach `sheet-voidline`, which was previously unreachable; `MANAGER TO VOID` / `REMOVE FREELY` markers on round headers; new `linecontrols` state; line-editor sheet copy; rail annotation for I-12 |
| `docs/design/prototype/pos/settlement.html` | Tender amount prefilled with the remaining balance in every state; `ALREADY FILLED IN — WHOLE BALANCE` / `KEYED BY HAND` / `FULLY ALLOCATED` markers; per-method captions distinguishing cash's default from card's ceiling; Cash/Card method selection now switches state; new `card` state; `Add cash` / `Add card` / `Nothing left`; `cardover` restated to AC-6's figures; rail annotation for I-13 |
| `docs/design/prototype/index.html` | Launcher state lists for POS-03 and POS-04 (they duplicate the per-screen lists and would otherwise go stale); the reviewer walkthrough now passes through both findings; steps renumbered |
| `docs/design/SCREEN-INVENTORY.md` | POS-03 line states and must-not-invent; POS-04 states and must-not-invent; rulings **I-12** and **I-13** added to the implied-rulings table |
| `docs/design/SITEMAP.md` | Two `[INLINE]` entries under POS-03, one under POS-04; a status note recording that the screen count is unchanged |
| `docs/design/EXTERNAL-HANDOFF.md` | Two new entries under "Rules you must not break"; the order line and the tender field named in the component-treatment list; an explicit statement that the screen list is complete and unchanged |

Nothing was committed. No file outside `docs/design/` was touched apart from
this task file.

## Structural? No — but all three documents moved together anyway

**Neither finding changes navigable topology.** No route, overlay, sheet, or
screen was added, removed, or retyped. *(Corrected in round 2: "neither finding
is structural" was too broad — `[INLINE]` is a node type in SITEMAP §1 and
`[INLINE]` nodes were added. See the round-2 entry.)* The screen list is still 7 POS screens, 13
back-office screens, and 6 modals, and every node in SITEMAP.md is the node it
was. Both changes are affordance and default-value changes *inside* existing
nodes.

I nevertheless updated **SITEMAP.md, SCREEN-INVENTORY.md and
EXTERNAL-HANDOFF.md together**, for two reasons. SITEMAP.md already carries
`[INLINE]` affordance rulings of exactly this kind — "86'd item DISABLED IN
PLACE, never removed" is the precedent — so silence there would have been an
omission, not a correct classification. And EXTERNAL-HANDOFF.md needed both
entries regardless: a tool that styles the tender field as an empty input, or
fills the reserved slot with a disabled control, would break both rulings
without knowing they existed. All three now say the same thing, including that
the structure is unchanged.

## Verification

- Both changed screens parse with no nesting errors and no nested anchors
  (checked with a parser, not by eye — the first draft of the pending row
  did nest an `<a>` inside an `<a>`, and was rebuilt).
- Every `data-when` / `data-unless` token resolves to a declared state in both
  files. No orphan tokens.
- All 27 POS-03 states show exactly one totals panel.
- All 16 POS-04 states were simulated: each shows exactly one balance figure,
  one amount field, one Add control, one close control, and one caption — and
  the caption never claims "already filled in" over a hand-keyed value.
- Rendered in a browser at 1280×800 and inspected: the three line signatures
  are distinguishable in greyscale, the money column stays aligned across row
  types, and the card path reads as method → Add → Close with nothing keyed.

## Found and not fixed

1. **SITEMAP and the prototype disagree on the tender pads' node type.**
   SITEMAP and M-4 call the cash, card, and custom pads `[SHEET]`. The
   prototype draws them as a persistent right-hand panel with method chips —
   not an edge-entering sheet. Real disagreement, orthogonal to finding 2
   (prefill works in either shape), and resolving it *would* be structural.
   **The lead's call, not mine.** I did not touch it.
2. **Arithmetic incoherence in POS-04 states, partly fixed.** `reauth`,
   `cancel`, `error` and `loading` showed a 15.59 balance while displaying a
   fully-allocated draft beneath it. My prefill work made that visible, so I
   corrected the balance to 0.00 in those four states, and with it the close
   control: a rejected close is now retryable rather than reading "balance
   outstanding", and a close in flight reads "Closing…". I did not audit the
   remaining screens for the same class of error.
3. **The line-editor sheet's Back control returns to `eightysix`,** not to the
   state the user arrived from. Pre-existing wireframe navigation slack, now
   slightly more visible because the sheet is reachable from more states. Not
   worth wiring a history model into a static prototype; flagged rather than
   fixed.
4. **`Meal voucher` and `Staff account` do not switch state** in the
   settlement prototype. They behave exactly as card does — prefilled, capped
   at the balance — and are drawn inert to keep the state list readable. Noted
   in the rail so a reader does not mistake it for a rule.
5. **POS-03's `default` state shows "3 items" over two lines.** Pre-existing
   copy defect, unrelated to either finding, untouched.
6. **Ruling I-8 remains open** and I did not settle it. Back-office reprint of
   a kitchen ticket is still granted by FR-E3 and unaudited by FR-J3. Nothing
   in this task bears on it.

---

**2026-09-10 — `designer`, second pass.** Lead verified the diff against the
acceptance criteria and returned one defect and one gap. Both closed.

## Defect — void reachable under both settlement locks

**Confirmed, and it was mine.** The fired-rounds block rendered under
`data-unless="empty quick loading"`, which does not exclude `lock-draft` or
`lock-lease`, and my first pass made every fired line body a live link to
`sheet-voidline`. AC-21 and AC-29 both list **void** among the five blocked
actions, so both lock states offered a void path. Before the fix the sheet was
unreachable from anywhere, so the contradiction did not exist — closing the
dead end opened it. The lead's diagnosis was exact.

**It was larger than the fired line.** FR-H1 reads "Void applies to an `OPEN`
order **or to lines on one**", and AC-3 calls removing an unfired line
"voiding an unfired line". So **removing a PENDING line is a void**, and
FR-G12 and FR-G13 block it too. The lead's note that the remove control was
"correctly absent" under both locks was right about the outcome but for an
incidental reason: the pending block simply did not render in those states.
Had it rendered, it would have been a second violation. It now cannot, by
construction rather than by accident.

**Shape chosen: inert, not absent — reason on the group header.**

Under either lock the order panel renders from a separate read-only block: no
`<a>` on any row, no remove control, every trailing slot reserved and empty,
and the round header carrying the lock reason in place of `MANAGER TO VOID` /
`REMOVE FREELY`.

Against the four conditions:

1. **A fired line cannot open the void sheet under either lock.** Verified by
   simulating all 27 POS-03 states through the visibility rules, counting
   `sheet-voidline` hrefs and remove controls reachable in each: both locks
   return zero. Nothing else changed — `default` still shows 2 void paths and
   0 remove controls, `linecontrols` 2 and 1, `overflow` 8 and 3.
2. **C-5 holds.** `FINISH PAYMENT FIRST` versus `ANOTHER CLIENT`. Never the
   same string, and each echoes the wording of its own screen-level notice.
3. **Inert, not absent — deliberately, and it does not contradict C-1.** C-1
   removes a control that is *permanently* impossible: a zero-total order can
   never be refunded, so a disabled Refund points at an override that does not
   exist, and hunting for it is the failure. A settlement lock is
   **temporary**, and each variant has a real route out — finish or cancel the
   payment, or wait for the other client. A marker naming that route points at
   something that exists, which is the opposite of C-1's case. Absence would
   also be wrong on its own terms: FR-G13 says reads are never blocked, and
   these lines are what the cashier is still entitled to read. Removing rows,
   or greying them, would damage the reading task in order to protect an
   action that is already unreachable.
4. **No fourth signature.** The slot means "removable now". Under a lock
   nothing is removable now, so every slot is empty — including the pending
   row's. That is I-12 holding, not an exception to it. The row body follows
   the same discipline: it stops being a control rather than becoming a
   different one. No per-row badge, no greying, no lock icon. The only thing
   that changes is one string per group header, which is where I-12 already
   put the marker.

## Gap — a PENDING line under a lock

**It can occur, and it is now drawn.** Nothing prevents a draft or lease
existing against a table order that still holds a pending line: FR-G10 refuses
the **close**, not the draft. POS-04's own *table order with PENDING lines*
state was already the proof — that refusal cannot be reached unless the
combination exists. The lead is right that the prototype dodged the question
rather than answering it.

Both lock states now show a pending line alongside the fired rounds, with the
totals moved to the with-pending figures. The answer to "how does the remove
control read there" is: **it does not exist**, for exactly the reason the
fired-line void does not — line removal is a void. The two screens now close
the loop on each other: `lock-draft`'s "Back to payment" points at POS-04's
pending refusal, and that refusal points back at `lock-draft`. Its copy was
also corrected — it claimed 2 unsent items where the order holds 1, and named
neither the item nor why sending it means leaving the payment.

## Also fixed in this pass

- **The round header band broke.** `.roundhead` is a fixed 32px band, and the
  first lease string wrapped it to two lines, breaking the group rhythm the
  order panel is scanned by. Shortened the string and gave `.roundhead`
  `white-space: nowrap; overflow: hidden`, so no future string can break the
  band. Structural, greyscale, no type or colour decision.

## Files changed in this pass

| File | Change |
|---|---|
| `docs/design/prototype/pos/order.html` | Interactive fired-rounds block excluded from both lock states; new read-only locked block (2 fired rounds + 1 pending line, no interaction, all slots empty, lock reason per header); totals wired to the with-pending figures under lock; both lock notices now say that removing an unsent line is also blocked, and that reading is not; `lock-draft` links to POS-04's pending refusal; two rail annotations |
| `docs/design/prototype/pos/settlement.html` | Pending-lines refusal corrected to 1 item, names the item, and links back to the locked order |
| `docs/design/prototype/wireframe.css` | `.roundhead` pinned to one line |
| `docs/design/SCREEN-INVENTORY.md` | Two new POS-03 states; I-12 extended with the lock behaviour and the inert-versus-absent reasoning; the FR-H4 must-not-invent entry notes neither control exists under a lock |
| `docs/design/SITEMAP.md` | Two `[INLINE]` entries under the settlement-lock nodes |
| `docs/design/EXTERNAL-HANDOFF.md` | The read-only-under-payment rule added to the trailing-slot rule |

Still no structural change: no node added, removed, or retyped. Still nothing
committed.

## Verification, this pass

- All 27 POS-03 states simulated through the visibility rules with ancestor
  hiding honoured; `lock-draft` and `lock-lease` expose zero void paths and
  zero remove controls, and every other state is unchanged from the first pass.
- Nesting clean and no nested anchors in all three changed HTML files; every
  `data-when` / `data-unless` token resolves to a declared state; all 27
  POS-03 states still show exactly one totals panel.
- Rendered both lock states at 1280×800 and inspected: all three group headers
  hold the 32px band, every trailing slot is empty, the money column stays
  aligned, and `default` is visually unchanged from before the split.

## Standing items

Item 1 of the previous "found and not fixed" list — SITEMAP calling the tender
pads `[SHEET]` while the prototype draws a persistent panel — is the lead's,
who is taking it to the owner. Untouched. Items 3, 4, 5 and 6 stand as
written; item 2's remaining half (no audit of other screens for the same class
of arithmetic incoherence) also stands.

## What the next agent needs and does not have

The two rulings are recorded in three design documents but **not in
`.agent/MEMORY.md`**, which is the lead's file. Until the lead records them,
an agent that orients from MEMORY.md alone will not know DESIGN-002 produced
two applied rulings. Nothing here is committed.


---

**2026-09-10 — `designer`, third pass.** gpt-5.6-sol returned eight findings,
four of them lead-verified. All eight fixed, plus four more that the
verification walks turned up. Every claim below was checked by simulating the
state machine, not by reading the diff.

## 1 — BLOCKER: add-line reachable under both locks — FIXED

Confirmed. `menugrid` was `data-unless="loading"`, so it rendered under both
locks with a live tile into `sheet-item` and a live Add there. AC-21 and AC-29
both list add-line. I had blocked the action row and the line actions and never
looked at the surface that actually performs the add.

**Menu grid and category rail are now absent under both locks**, and the lock
notice takes the region. Absent, not inert — the opposite call to the one I
made for the order lines, and the distinction is the point: FR-G13 blocks no
reads, and the lines are what the cashier is entitled to read, so they stay.
The menu is a pure input surface with nothing to read, so leaving it intact
would only invite tapping. Verified: 0 tile links, 0 void paths, 0 remove
controls in both lock states.

## 2 — HIGH: I-12 violated by its own markup — FIXED

The reviewer is right and this was the worst of the eight. The fired row was
`<a class="line">` wrapping the whole row *including* the reserved slot, so the
trailing coordinates that remove freely on a pending row opened a PIN-gated
void on a fired one. I wrote the ruling and then built the exact reflex it
forbids.

Every row is now `div.line` containing an `a.line__t` (quantity, name, amount)
with the trailing slot as its **sibling**. Pending and fired rows have
identical geometry. A check now asserts that no `.line__x` in the file has an
anchor ancestor: **19 slots inspected, 0 nested.** That check is the guard
against this regressing.

Hover: `.line__x:hover` (0,2,0) outranked `.line__x--empty` (0,1,0) regardless
of source order, so the reserved slot lit up on hover including on the inert
voided row. Now `a.line__x:hover` — the control is always an anchor, the
reserved slot always a div, so the selector cannot reach it.

## 3 — HIGH: cash and split transitions miswired — FIXED

Confirmed in full: both Settle links entered `partial`, which already
fabricated a 10.00 card draft; `empty` offered an exact cash prefill whose Add
went to `partial`; `partial`'s Add self-linked. Exact cash could not reach
Close and AC-7 could not be walked.

**Every Add now lands on the state that adding that amount actually produces.**
Both Settle links enter `empty`. Four states added so the three settlement
paths are walkable end to end:

- exact cash: `empty` → Add cash 15.59 → `exactcash` → Close
- card in full (the I-13 headline): `card` → Add card 15.59 → `exact` → Close
- **AC-7**: `card` → `cardsplit` (10.00 keyed) → Add → `partial` (5.59 owing,
  cash prefilled) → Add → `exactsplit` → Close
- **AC-5**: `empty` → `cashover` (20.00 keyed) → Add → `change` (4.41) → Close

## 4 — HIGH: AC-6 reproduced in text, not behaviour — FIXED

Confirmed. `cardover` had a live Add into `exact`, and `ceiling` the same via
Add cash. **Both Add controls are now disabled — "Over the limit — cannot add"
— and both drafts are unchanged** (B-20): `cardover` shows nothing drafted,
`ceiling` still shows its 10.00 card line. The keyed-value states now split
cleanly into a pair that adds (`cardsplit`, `cashover`) and a pair that cannot
(`cardover`, `ceiling`), which is the same rule read twice.

## 5 — MEDIUM: quick and overflow remove controls did not remove — FIXED

Confirmed: five controls linked to their own state.

Fixed by adding a second axis to the runtime rather than five outcome states.
`?gone=<line-id>` hides that line and selects its own totals block, so the
state vocabulary stays a list of behaviours instead of becoming a list of
outcomes. Ten lines of JS, documented in place. Walked all five:

| state | removed | subtotal | rows | count |
|---|---|---|---|---|
| quick | — / q-burger / q-soda | 16.50 → 3.00 / 13.50 | 2 → 1 | 2 → 1 item |
| overflow | — / coffee / cheese / wine | 118.50 → 111.50 / 112.50 / 110.50 | 9 → 8 | 9 → 8 items |

## 6 — MEDIUM: quick row body opened the table line editor — FIXED

Confirmed, and the reviewer is right that this is not navigation slack: the
return target put a **Send to kitchen** control in front of a counter cashier,
which C-2 and FR-E5 forbid outright. There is now a `quick-line` sheet whose
Back and Remove both return to the quick workspace. Implemented by widening
every `data-when` / `data-unless` list carrying the `quick` token, so the quick
variant behaves identically everywhere and differs only in the return target.

## 7 — MEDIUM: "Nothing has been taken" — FIXED

Confirmed, and the file did contradict itself. Both occurrences now say
**recorded**, and the cancel modal states plainly that a charge already put
through on a terminal is outside this system and cannot be known from here
(FR-G1, FR-G9, FR-G14).

## 8 — MEDIUM: cash ceiling copy — FIXED

FR-M5's "maximum acceptable cash amount" is the remaining balance plus the
9,999,999 change limit, capped by the 99,999,999 single-tender limit — not the
bare change limit. At a 5.59 balance that is **10,000,004.59**, and the copy
now shows the derivation rather than a constant.

## Found by the verification walks, not in the eight

1. **Blank page.** My first `gone` implementation set `data-gone` on the root
   element, which then matched the `[data-gone]` selector and hid the entire
   document. Caught by rendering, not by the diff — the state simulation passed
   cleanly while the real page was blank. Renamed to `data-removed-line`.
2. **`overflow` double-rendered the fired rounds.** The interactive fired block
   never excluded `overflow`, so that state drew Round 1 and Round 2 twice with
   different figures. Pre-existing since the original prototype. Fixed.
3. **Overflow's subtotal did not match its own lines.** Committed as 126.00;
   the lines sum to 118.50 with the voided 7.50 correctly excluded. Pre-existing,
   and I had to correct it because the three removal figures are derived from
   it — deriving from a figure I had just found to be wrong would have planted
   three more errors. Corrected throughout (118.50 / 5.93 / 124.43 / 10.77).
4. **The order-panel item count was a hardcoded "3 items"** on every table
   state regardless of content, and went stale the moment a line could be
   removed. Now state-accurate across all 28 states and all five removals;
   verified count against rendered rows in every one.
5. **The quick round header overflowed its 32px band** once it carried a tag.
   Shortened; the band holds. The settle button already carries the full "sends
   the order to the kitchen" promise, so nothing was lost.

## Structural verdict — corrected as instructed

The reviewer's correction is right and is now in all three documents, in the
narrower form EXTERNAL-HANDOFF already used. **No navigable or overlay topology
changed** — no route, modal, or sheet added, removed, or retyped, so the count
of 7 POS screens, 13 back-office screens and 6 modals holds. **Seven `[INLINE]`
nodes were added** (five under POS-03, two under POS-04), and `[INLINE]` is a
node type in SITEMAP §1, so "nothing structural changed" was too broad. An
`[INLINE]` node is a state of a screen, not a destination, which is why the
screen list is unaffected. My earlier verdict in this file is corrected in place.

**One judgement call for the lead.** The quick-sale line editor is recorded as
a second *form* of the existing line-editor sheet — parallel to POS-03's own
two variants, differing only in affordance and return target — not as a new
node. If you would rather count it as a distinct sheet, it is a one-line change
in SITEMAP and the modal count becomes 7. Flagged rather than decided, because
it changes a published count.

## Files changed this pass

| File | Change |
|---|---|
| `prototype/wireframe.js` | The `gone` axis (`data-line` / `data-gone`), root attribute named `data-removed-line` so it cannot hide the page, removal surfaced in the prototype chrome |
| `prototype/wireframe.css` | `.line__t` tap target so the trailing slot is always a sibling; `a.line__x:hover` so hover cannot reach the reserved slot |
| `prototype/pos/order.html` | Menu grid and rail absent under both locks; every row restructured; `quick-line` sheet; five real removals with their own totals; `overflow` no longer double-renders; overflow subtotal corrected; state-accurate item counts; quick round header shortened |
| `prototype/pos/settlement.html` | Four new states and the whole tender graph rewired; rejected amounts unaddable; ceiling copy derived from FR-M5; "recorded" not "taken" in both places |
| `prototype/index.html` | Both duplicated state lists updated; walkthrough now walks AC-7; renumbered |
| `docs/design/SCREEN-INVENTORY.md` | Menu-under-lock state; line-editor variants; tender-walk and rejection states; the recorded-versus-taken rule |
| `docs/design/SITEMAP.md` | Structural verdict narrowed; line-editor variants; menu-absent-under-lock node |
| `docs/design/EXTERNAL-HANDOFF.md` | Read-only rule extended to the menu; the recorded-versus-taken rule; screen-list note |

## Verification

- All 28 POS-03 and 20 POS-04 states simulated through both axes with ancestor
  hiding honoured. Locks: 0 tiles, 0 void paths, 0 remove controls. Every
  POS-04 state: exactly one balance, one amount field, one Add, one close
  control, one caption — and no caption contradicts its field.
- 19 trailing slots inspected; none has an anchor ancestor.
- All eight prototype HTML files: clean nesting, no nested anchors, no
  undeclared state tokens, and every internal `?state=` href resolves to a
  declared state.
- Item counts checked against rendered rows in all 28 states and all five
  removals.
- Rendered and inspected: both locks, `overflow`, `quick` with a removal, and
  `cardover`.

## Untouched, as instructed

The tender-pad `[SHEET]`-versus-panel question is with the owner and was not
touched. Previously reported items 3 (line-editor Back target — now resolved
for the quick variant, still loose for the table one), 4 and 6 stand; item 2's
unaudited half is now partly closed, since this pass audited POS-03 and POS-04
arithmetic and found and fixed the overflow subtotal.
