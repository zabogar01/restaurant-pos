# FE-020 — Bring POS-04 up to DESIGN-006

**Status:** Done 2026-09-24, `builder22`. Lead-verified at 1349 tests and walked and measured in a browser. Written 2026-09-24 by `lead`.
**Source:** DESIGN-006, committed on `agent/design-direction` as `c43fd08`. The
artifact is
`../restaurant-pos-design/docs/design/visual-directions/frost/pos/settlement.html`,
and its new sheet is `../restaurant-pos-design/docs/design/visual-directions/frost-settlement.css`.
The task, its review and both handoffs are in
`../restaurant-pos-design/.agent/tasks/DESIGN-006-settlement-corrections.md`
and `.agent/reviews/DESIGN-006-review.md` in that worktree. **Read the
worktree copies. This branch's `settlement.html` is stale.**
**Branch:** `agent/phase-0-foundations`.
**Model:** Sonnet. The browser walk belongs to the lead. **Write the handoff in
the slot at the bottom, early, and add to it as you go. When you resume after
an interruption, run `git diff` first and check for a live mutation.**
**Baseline:** `bdd65eb`, **1331 tests across 22 files**, typecheck clean. Re-run
it before you start and state what you get.

---

## What changes, and why

DESIGN-006 corrected the settlement artifact after F3 was built against it. It
also confirmed the six rulings F3 was built on (B1–B6), so **those need no code
change**. Five things do:

### 1. The refusal composition: the keypad beside the notice, not under it

In `cardover`, `ceiling` and the new single-tender state, the refusal notice
sat **above** the keypad and pushed its `0`/`←` row under Close. The lead
measured 47px of the `←` key hidden in `cardover` and 30px hidden in `ceiling`.
The design fix is a composition: **amount, message and Add stay on top; the
keypad goes on the left; the notice and caption go in a column to its right.**
Read `frost-settlement.css` and the artifact's `cardover` markup, then
reproduce that composition in `pos.css`.

- **Tokens only.** `no-invented-values.test.ts` holds, and the only literal
  length it allows is a `1px` border.
- **New POS-04 rules go after `.fixture-states`**, per FE-015's handoff.
- Every other state keeps its current composition.

### 2. The single-tender cap gets its notice and caption

FE-016's third ruling drew only *Cash maximum {max}* and an inert Add when the
99.999.999 cap binds, because no copy existed. It exists now. When the cash
maximum is bound by the single-tender limit, draw:

- **Notice title:** *"Cash exceeds the single-tender limit"*
- **Notice body:** *"You entered {keyed}. One payment line can hold at most
  **{max}**, even when the change would be within 9.999.999. Nothing has been
  recorded; the draft is unchanged."*
- **Caption:** *"The {balance} balance plus the 9.999.999 change limit is
  {balance + 9.999.999}. The lower, single-tender cap applies: key **{max} or
  less**."*

Every figure is live. `tender.ts`'s `cashCeilingBoundByChangeLimit` already
tells the two cases apart, so the component chooses copy and does no
arithmetic. The artifact's figures are balance 94.500.000, keyed 100.000.000
and max 99.999.999. Add a `ceiling-single` fixture state that seeds that
order: subtotal 100.000.000 with staff meal 10%. **Build it through
`orderTotals`, and never type a total.**

### 3. The pending notice routes through Cancel

F3c's notice ended *"… which means leaving this payment, because a draft blocks
both."* with **Back to the order**. That link lands on a **locked** POS-03,
where send and void are blocked, so the notice pointed at a path that does not
work (the design review's finding 4). The new copy:

- *"{Names} is/are still pending. Cancel payment before sending or voiding
  it/them; payment in progress blocks both."*
- When the payment has drafts, add one sentence. **The lead's ruling on
  plurals:** with one draft, *"Cancelling discards the {Method} {amount}
  draft."* (the artifact's own sentence, as in *"… the Cash 382.725 draft."*);
  with two or more, *"Cancelling discards {n} drafted payment lines."*, the
  grammar the cancel modal already uses. With no drafts, omit it.
- The action is **Cancel payment to edit the order**. It opens the **same live
  cancel modal** as the Cancel payment button, and it replaces *Back to the
  order*.

The title's plural stays exactly as F3c built it.

### 4. The cancel modal lists the drafts it will discard

The design's round 2 adds the drafted rows, **read-only**, inside the cancel
modal: method and amount with no Remove control. A *Change given* row is shown
but not counted. The count sentence keeps FE-018's rule of none, one or *n*.
The code's modal already reads the live session. It now also draws the rows.

### 5. The takeover asks for acknowledgement before the PIN

`FR-G14` and `FR-J3`: the review rejected an acknowledgement folded into
Continue. The modal becomes **two steps in local component state**:

1. **Step one:** the warning notice, whose body now ends *"… Check with them
   before you continue. Acknowledge this risk before entering your PIN."* The
   footer has **Cancel** (→ POS-03 `lock-lease`, as now) and **I understand**
   (primary). **No PIN pad is drawn.**
2. **Step two**, after *I understand*: the M-1 PIN pad appears, and the footer
   shows Cancel plus *"Risk acknowledged. Continue submits the manager PIN for
   this takeover only."* **Continue still verifies nothing**, because there is
   no server. That is FE-001's and F3d's precedent. `B-12` holds.

The design uses a `?ack=1` URL parameter to depict step two. **That is a
fixture device. The code keeps the step in component state**, so leaving and
returning starts at step one again.

---

## Do NOT copy these

- **The method chips' *"Not drawn"* labels, and the inert chips.** They
  describe what the static artifact covers, not product behaviour. The live
  Cash and Card chips stay live.
- **The artifact's `?cancel=1` and `?ack=1` parameters.** Those are fixture
  navigation. The code's cancel modal and takeover steps are state.
- **Meal voucher and Staff account.** Custom methods are still out of scope.
- **The Burger in `zero-pending`.** The code names whatever lines are pending.

---

## Acceptance criteria

1. **The Delete row is visible in every refusal.** In `cardover`, `ceiling` and
   `ceiling-single`, the component renders the notice and caption in a sibling
   column beside the keypad rather than above it. Assert the DOM structure,
   and prove it red against today's order. **The lead will measure the
   geometry in a browser.**
2. **The single-tender copy follows the binding limit.** With a balance above
   90.000.000 and 100.000.000 keyed on Cash, the new notice and caption appear
   with live figures, and `ceiling`'s change-limit copy does **not**. With the
   change limit binding, the reverse holds. **Red case:** FE-016's
   no-notice rendering.
3. **`ceiling-single`'s seed comes from `orderTotals`:** 100.000.000,
   −10.000.000, 4.500.000, **94.500.000**, 8.181.818.
4. **The pending notice's action opens the cancel modal**, and confirming it
   lands on an unlocked POS-03 where *Remove Steak* works. Walk it:
   `/pos/order` → Settle → *Cancel payment to edit the order* → confirm →
   Remove Steak → Settle → **155.925**. **Red case:** today's *Back to the
   order*, which lands on a locked POS-03.
5. **The discard sentence follows the drafts** in the pending notice: none,
   one (*"the Cash 382.725 draft"*), and two or more.
6. **The cancel modal lists the rows.** Two drafts show two read-only rows and
   *"2 drafted payment lines…"*. A *Change given* row appears but is not
   counted.
7. **Takeover is two steps.** Step one draws no PIN keys. After *I
   understand*, all 12 PIN controls appear with the acknowledgement caption.
   Remount, and it is step one again. **Red case:** a pad drawn before the
   acknowledgement.
8. **The chips stay live.** No *"Not drawn"* text appears anywhere in
   `apps/`.
9. **Existing tests:** any assertion on the old pending copy, *Back to the
   order*, the single-tender no-notice rendering, or the one-step takeover may
   change, **and only those**. Name each one. Everything else passes
   unchanged. `npm run verify` is green and typecheck clean; state the count.

Each red case is a real mutation, run on its own and then reverted.

---

## Read before you start

- `apps/pos/src/SettlementScreen.tsx`, all of it: the notices, the refusal
  block, the cancel modal and the takeover modal.
- `apps/pos/src/tender.ts`: `cashCeilingBoundByChangeLimit` and
  `tenderMaximum`.
- `apps/pos/src/PosRoutes.tsx`: `settlementSeed`, which is where
  `ceiling-single` goes.
- The worktree artifact, in the `cardover`, `ceiling-single`, `pending`,
  `pending-paid`, `cancel` and `takeover` states, and `frost-settlement.css`.
- FE-015's handoff on the `.fixture-states` CSS boundary.

**A boundary is not subject to your judgement.** If the task appears to require
breaking one, the task is wrong. Say so and stop.

---

## Handoff

Write it below as you go. State: what you built; the count before and after;
every existing test you changed and why; every red case and what failed; and
every judgement call.

Commit nothing. Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

### Implementer handoff

**builder22, done. Nothing committed. Browser walk and geometry are the lead's.**

**Count:** before **1331 tests / 22 files**, typecheck clean. After **1348 / 22** (+17, all new), typecheck clean, `npm run verify` green.

**What I built**
1. **Composition.** In a refusal (any state where a notice draws: `cardover`, `ceiling`, `ceiling-single`) the tender body is now `.tender-control` (amount, message, Add) then `.tender-refusal`, a two-column grid holding the keypad and `.tender-guidance` (notice + caption). Every other state renders exactly as before (`tender-control`, caption, keypad). The keypad is one `const` reused by both branches. CSS is appended at the end of `pos.css`, after `.fixture-states`, tokens only (`--frost-space-*`); `no-invented-values` passes.
2. **Single-tender copy.** `tenderNotice` and `tenderCaption` choose the copy off `cashCeilingBoundByChangeLimit`; all figures live. Added `cashChangeLimitedMaximum(balance)` to `tender.ts` (and `tenderMaximum` now uses it) so the caption's `{balance + 9.999.999}` is not computed in the component. `ceiling-single` is a new settlement state (keyed seed `100000000`); its order is a new private order fixture `settle-ceiling` (one fired 100.000.000 *Banquet* line, Staff meal 10%; `orderFixtures.ts`, `menuFixtures.ts`, `PosRoutes.tsx`). Totals come from `orderTotals` via the store: 100.000.000 / −10.000.000 / 4.500.000 / 94.500.000 / 8.181.818.
3. **Pending notice.** New copy; the discard sentence follows the drafts (none omitted, one *"the Cash 382.725 draft"*, two or more *"{n} drafted payment lines"*); the action *Cancel payment to edit the order* opens the same live cancel modal (`setCancelOpen(true)`). Title unchanged.
4. **Cancel modal** draws read-only rows (`.cancel-drafts__row`, no Remove); *Change given* row shown, not counted; count sentence unchanged.
5. **Takeover** is two steps in `useState`. Step one: notice with the new closing sentence, Cancel, *I understand*, no pad and no dots. Step two: `PinPad geometry="approval"` (12 controls), footer Cancel plus the acknowledgement caption. Continue verifies nothing. Remount returns to step one.
6. No *"Not drawn"* text exists in `apps/` (the chips were never coded to carry it); a test pins that.

**Existing tests I changed (two, both named in criterion 9)**
- `AC-5-single-tender-cap` (`settlement.test.tsx`): asserted FE-016's no notice and no caption; now asserts the new title and caption.
- `AC-11: takeover…` : asserted the inert `[data-action="take-over"]` span; now asserts it is gone and *I understand* is a button. Its Cancel navigation assertions are unchanged.
Nothing else needed changing: the earlier pending/cancel walks still pass as written.

**New tests (17):** composition (3 refusal states + one non-refusal state), `ceiling-single` seed / copy / binding-limit contrast / keyed-0 guard, pending notice (no drafts, one, two+, full walk to 155.925), cancel modal rows (two, change, none), takeover (step one/two, remount), no *"Not drawn"*.

**Red cases (each a real mutation, run alone, then reverted; file diffed back to the good copy)**
- A. Notice moved back above the control, today's order (AC1): 3 red, the `cardover`, `ceiling`, `ceiling-single` composition tests.
- B. Single-tender notice and caption return null, FE-016's rendering (AC2): 3 red, `AC-5-single-tender-cap`, the ceiling-single composition test, the copy test.
- C. Pending action back to `history.back()`, *Back to the order*'s behaviour (AC4): 1 red, the walk to 155.925.
- D. PIN pad drawn before acknowledgement (AC7): 2 red, step-one and remount tests.
- E. Cancel modal rows suppressed (AC6): 2 red.
- F. One-draft sentence collapsed into the count grammar (AC5): 1 red.
- G. Change row counted as a draft (AC6): 1 red.

**Judgement calls**
- **A keyed 0 on cash in the single-tender case draws no notice.** The new branch needs `amount > max`; without the guard, deleting every digit would say *"Cash exceeds the single-tender limit"* about 0. Tested. The card and change-limit branches still draw for a keyed 0, as before; I did not touch that.
- **Refusal notice is now below the amount/Add row, not above it**, matching the artifact (`tender-lower` sits under the field). Keypad comes first in DOM order, guidance second; CSS is a plain two-column grid.
- **`.settlement-back` class reused for the notice action** for identical styling; it carries `data-action="cancel-payment-from-notice"`. Existing tests select the header's `.settlement-back` first, so they are unaffected.
- **Takeover step two's `PinPad` has `geometry="approval"`** (72px keys, as the artifact draws) and no `seed`, so its dots start empty.
- **Not verified here:** geometry (Delete row visible, 47px/30px cases), takeover modal height with the 72px pad, and the visual of the new grid. Those need the browser walk.

### Lead correction (takeover step two ran off the device)

**Cause:** `TakeoverModal` rendered as a sibling of `.pos-device`, so `.modal`'s `top: 50%` centred on the viewport (about 958px in the lead's browser), not the 800px frame: 100 to 858, Cancel at 841. The artifact's modal lives inside the device. The artifact's `.takeover-modal` has one rule, `.notice { margin-bottom: 12px }`, plus the compact `12px 0` around the PIN dots.

**Fix:** the modal (and its scrim) now render inside `.pos-device`, so it centres on the frame (758px tall, about 21 to 779). It carries `takeover-modal`; `pos.css` adds `.takeover-modal .notice { margin-bottom: var(--frost-space-3) }` and `.takeover-modal .pin-dots { margin: var(--frost-space-3) 0 }`, replacing my `.takeover-pin` margin-top (the class stays, unstyled). Tokens only.

**Test:** one new test asserts the modal and scrim are inside `.pos-device`, the `takeover-modal` class, and the two CSS rules. **Red case:** modal moved back outside the device: that test failed alone, then reverted. JSDOM has no layout, so the pixels are not asserted; **the lead re-measures** (expect the footer inside 800 with a few px to spare; the compact margins save about 20px more).

**Count:** 1349 tests across 22 files (+1), `npm run verify` green, typecheck clean. The other modals (`cancel`, `reauth`, `leaselost`) still render outside the device; they are short enough to fit today, and I did not touch them.
