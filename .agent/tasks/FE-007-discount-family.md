# FE-007 — POS discount family (F2i)

**Status:** Done 2026-09-18, lead-verified.
**Roadmap item:** F2i
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder9`

---

## What this slice is

The three M-3 discount nodes and the totals state a full comp produces. They
were held out of F2c because two of the three paths lead to the manager prompt,
and that prompt did not exist yet. It does now (F2g), so they can be built.

**Correcting the record before you read further.** F2c's task file put all three
discount nodes on the ungated side; SCREEN-INVENTORY summarises M-3 as
*"remove/replace (gated by the whole transition, FR-F8)"*; and the lead then
ruled, in FE-005's verification, that remove/replace is *wholly* gated.

**That ruling was wrong.** `FR-F8` in the PRD is more precise than the
inventory's paraphrase, and the PRD is the contract:

> An applied discount may be removed or replaced. The approval gate covers the
> **whole transition**: removing or replacing a **free-form** discount requires
> manager approval **even if its replacement is a preset**; removing or
> replacing a **preset is ungated unless the replacement is free-form**. Each
> successful change writes one audit entry containing before and after values.

"Whole transition" means the gate looks at **both ends** — what is being removed
*and* what replaces it — not that every path through the sheet is gated. The
artifact draws this correctly.

---

## Objective

The three discount sheets and the comp-to-zero totals render at 1280×800, with
the approval gate driven by `FR-F8`'s actual rule rather than by which sheet the
cashier is standing in.

---

## Required inputs

Read these yourself. Do not work from this file's summary.

1. **`docs/PRD.md`, `FR-F2` through `FR-F8`**, and `AC-8`, `AC-9`. On this
   branch. The contract.
2. **`docs/BOUNDARIES.md`, `B-8`, `B-21`, `B-22`.** Inviolable.
3. **`docs/design/SCREEN-INVENTORY.md` — M-3**, in the worktree at
   `../restaurant-pos-design`. Note its M-3 summary is compressed; where it and
   the PRD differ in precision, **the PRD wins**.
4. **`docs/design/visual-directions/frost/pos/order.html`** — the
   `sheet-discount`, `sheet-freeform`, `sheet-remove` and `zero` blocks.
5. **`.agent/tasks/FE-006-approval-prompt.md`** on this branch — the prompt you
   will open, and the rulings binding you. Read its verification section.

---

## What to build

### The four states

| State | What it shows |
|---|---|
| `sheet-discount` | The picker: four presets, plus a dashed *Other amount — needs a manager* |
| `sheet-freeform` | Percent or fixed amount, a value field, `MANAGER REQUIRED` |
| `sheet-remove` | The currently applied discount, and three ways to change it |
| `zero` | The totals after a 100% comp |

### The gate is data-driven, and this is the substance of the slice

`FR-F8` decides from **what is applied now** and **what would replace it**:

| Currently applied | Action | Gated? |
|---|---|---|
| Preset | Replace with another preset | **No** |
| Preset | Remove | **No** |
| Preset | Replace with free-form | **Yes** |
| Free-form | Replace with a preset | **Yes** |
| Free-form | Remove | **Yes** |
| Free-form | Replace with free-form | **Yes** |

The artifact draws only the first row's case — its applied discount is
*"Staff meal — 10% … Preset, no approval"* — so three of its controls are
ungated and one is dashed. **That is correct for that case and wrong as a
general rule.**

**You may add one fixture state for a free-form discount applied**, in which
*all three* controls in `sheet-remove` are gated. Naming it is yours; say what
you chose. This adds a state to an existing screen, not a node, so the count
stands at 7 POS / 13 back office / 6 modals — the same precedent A7 used when it
added `category-invalid` to BO-03.

**Test the table above directly.** A gate that is right in the one case the
artifact happens to draw is not a gate; it is a coincidence.

### Opening the prompt — binding from F2g

**`?state=approval` is a review harness, not a route.** SITEMAP §1 says a
`[MODAL]` is neither a route nor back-stackable. The artifact links Apply to
`order.html?state=approval` because it is static HTML; **you must not.** Open
the prompt as component state from the sheet, and pass it the action and the
reason as data. `Approval.tsx` already takes them that way.

Cancelling the prompt returns to the sheet with nothing changed — the freeform
sheet says so itself: *"Nothing changes on the order until they do."*

### `B-22` — one discount per order

The picker's head reads *"One per order"*. So choosing a preset when one is
already applied is a **replace**, not an add, and it goes through `FR-F8`'s
table. There is no path that stacks two discounts.

### `B-8` and `FR-F5` — a snapshot, and a preset that has gone

`FR-F4` snapshots the name, kind and value onto the order. `FR-F5`: **a
deactivated preset disappears from the picker but stays readable on orders that
already carry it.**

That is a real behaviour with a visible consequence: `sheet-remove`'s
*"Currently applied"* card must render a discount whose preset no longer exists
in the picker. **Worth a fixture and a test** — it is the difference between
storing a snapshot and storing a reference, and it is `B-8`'s whole point.

### `B-21` / `FR-F7` — nothing applies itself

No timer, no date logic, no automatic selection, no default preset pre-chosen. A
staff member always chooses. If you find yourself writing a default, stop.

### Check before you copy: "Remove the discount"

The artifact links *Remove the discount* to `order.html?state=empty`, which is
the **no-lines** state. Removing a discount should not empty the order.

**Check whether that is fixture shorthand or a defect, and raise it either way.**
Do not silently reproduce it and do not silently fix it. Two defects have now
been found in reviewed artifacts, both of them a control that is right in one
state and wrong in another.

---

## Constraints

- **No boundary is subject to your judgement.** If this task appears to require
  breaking `B-8`, `B-21` or `B-22`, the task is wrong — stop and say so.
- **Do not edit `Approval.tsx`'s behaviour.** You may pass it data. If it needs
  a prop it does not have, say so rather than reshaping it.
- **Do not edit the panel, menu region, existing sheets, `frost-states.css`, the
  fixture, the registry, or any contract document.**
- **Money stays a `bigint`.** Discounts are money, and a percentage applied to
  money must not round through a float. `packages/money` has `rateFromPercent`
  and `mulRate`; **`rateFromPercent` takes a `string`**, deliberately.
- **Every acting control is a `<button>`.** Every hover inside
  `@media (hover: hover)`. No fetch, storage, or console.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.**
- **Stop at the discount family.** No void sheets — that is F2j.

---

## Acceptance criteria

1. **Every row of the `FR-F8` table is tested**, including the free-form-applied
   cases the artifact does not draw.
2. The four artifact states plus your free-form-applied fixture render at
   1280×800 and are reachable by `?state=`.
3. **The prompt is opened as component state, never by a URL**, and no approval
   URL is written. Tested.
4. Cancelling the prompt returns to the sheet with the order unchanged.
5. A discount whose preset has been deactivated is still readable on the order
   that carries it, and absent from the picker. Tested.
6. No discount applies itself: no default selection, no timer, no date logic.
7. Money arithmetic goes through `packages/money`. No float, no `Number()`.
8. Sheets are dialogs; focus moves in, Escape and Cancel return it.
9. A pressed control draws the ring. **Verified in a browser with the press
   held.**
10. `npm run verify` passes. FE-006 left 472 tests across 15 files; state the new
    count. Typecheck clean.

---

## Out of scope

- `sheet-voidline`, `sheet-voidorder`, `sheet-voidorder-fired` — **F2j**.
- `error`, `fireerror`, `fireblocked` — F2h. `quick`, `quick-line` — F2d.
- The `<a>`-to-`<button>` conversion and `role="alert"` on the pads — F2e.
- Whether a zero-total order can be closed — F3.
- Any real audit write, approval check, or persistence.

---

## Handoff

Write your handoff here when the work is done. Name the command, the URL, and
the `?state=` values.

**Raise judgement calls rather than taking them.** Five consecutive slices have
found this lead's task files wrong where a reviewed document was right — twice
about which tokens exist, once about which states a screen has, once about which
actions are gated, once about quoted copy. **This file corrects one of those
errors and may well contain another.** Where it disagrees with the PRD or
BOUNDARIES.md, those win and this file is the defect; say so.

If a check was skipped, say which and why. The lead verifies with `git log`, a
browser, and by injecting the defect your tests claim to catch.

### 2026-09-18 — implementer (claude, Opus 5)

**Done: all four artifact states plus one added state are built. Every row of
`FR-F8` is tested, both as a function and by pressing the controls.** Nothing in
this slice needed `B-8`, `B-21` or `B-22` broken. Fourteen judgement calls are
listed below. Two are real disagreements with reviewed documents, and one is a
defect in the artifact of the same shape as the last two.

**Not committed.** The working tree is on `agent/phase-0-foundations`:

- new: `apps/pos/src/discount.ts` (the pure gate and the arithmetic),
  `discountFixtures.ts`, `DiscountSheets.tsx`, `apps/pos/test/discount.test.tsx`
- modified:
  - `OrderPanel.tsx`: **`OrderScreen` only**. It mounts the family, makes the
    background inert, and returns focus.
  - `orderFixtures.ts`: the five states.
  - `menuFixtures.ts`: the five states, each with the default grid. The
    `Record` type requires them.
  - `Sheets.tsx`: **one word**. `SheetFrame` is now exported. No sheet's
    behaviour changed.
  - `pos.css`: a new M-3 section.
  - `order-panel.test.tsx`: the exact-states list.
  - `sheets.test.tsx`: F2c's four held states are now served, and its
    reachability check also runs over F2i's four sheets.
- Untouched: `Approval.tsx`, the panel, the menu region, the item and line
  sheets, `frost-states.css`, the Frost fixture, the registry, every contract
  document, `.agent/MEMORY.md` and `.agent/ROADMAP.md`.

#### What the owner opens

```
npm run dev -w apps/pos     # http://127.0.0.1:5173/pos/order?state=sheet-remove-freeform
```

The new `?state=` values are **`sheet-discount`, `sheet-freeform`,
`sheet-remove`, `sheet-remove-freeform` and `zero`**. The added state is
**`sheet-remove-freeform`**: the same table order carrying a free-form
**Other discount — 15%**, where all three change controls are gated. The
panel beside it shows that discount's figures. Other states worth trying:

- On `sheet-remove-freeform`: **Replace with another preset** opens the picker
  with every preset gated. Choose Comp, enter any six digits and press →. You
  land on `zero`.
- On `sheet-freeform`: press **Apply**, then Cancel. You are back on the sheet
  with 15 still typed and the URL unchanged.

The Vite server on 5173 was already running (pid 31567, not mine). I used it
and left it running.

#### How the gate works

`needsManager(applied, change)` in `discount.ts` is the only place a gate is
decided. It reads the kind of the discount the order carries now and the kind
of the change: a preset, a free-form discount, or `'remove'`. It never reads
the sheet, the name, or the value. Every control asks it:

- the presets, and Other amount, on the picker
- the MANAGER REQUIRED tag and the note on the free-form sheet
- all three controls on the change sheet

The `— needs a manager` suffix and the dashed border are drawn from that same
answer. **The sheets all look at the same `applied`**, which is why the picker,
opened from `sheet-remove-freeform`, gates its presets.

#### Acceptance criteria

1. **Every row of `FR-F8` is tested, three ways.**
   - As a function: six `FR-F8` rows, plus the two nothing-applied rows
     (`FR-F2`, `FR-F3`), plus removing when nothing is applied (it throws).
   - A look-alike test: a free-form discount *named* "Staff meal" at 10% is
     still gated to remove. This proves the gate reads the kind, not the name.
   - By pressing controls: every row is reached through the real controls. The
     three free-form-applied rows go through `sheet-remove-freeform`. The
     nothing-applied rows go through a sheet rendered without `applied`.
   - A source scan: `DiscountSheets.tsx` holds no `source === '…'` comparison
     and no literal `gated={true|false}`.
   - A cross-check: in every state, and in every sheet reachable from it, each
     drawn control's suffix, dashed class and `data-gated` agree.
2. **Five states at 1280×800, reachable by `?state=`.** In Chrome the device
   measures 1280×800. The sheet is 820×736 at y 64, leaving the 460px panel
   uncovered. I looked at the screenshots of `sheet-freeform`,
   `sheet-remove-freeform`, `zero` and the prompt over the change sheet myself.
3. **The prompt is component state, never a URL. Tested.**
   - Opening it leaves `location.search` and `history.length` unchanged, and
     there is no `approval` anywhere in the URL.
   - A source scan finds no approval state string, no `pushState`,
     `replaceState` or `location.` call, and no `APPROVAL_FIXTURES` in any
     discount file.
   - F2c's reachability detector, now run over the four sheets, also passes.
   - In Chrome, pressing Space on the gated Remove opened the prompt, and the
     URL stayed `?state=sheet-remove-freeform` with a history delta of 0.
4. **Cancel returns to the sheet with the order unchanged.**
   - The same step comes back, with the typed value kept and identical panel
     totals.
   - Focus goes back to the control that raised the prompt.
   - Escape cancels the prompt alone. A second Escape closes the sheet.
   - A fresh opening starts with zero dots.
   - In Chrome, Escape left the sheet on *Change discount* with
     `:focus-visible` on *Remove the discount — needs a manager*.
5. **`FR-F5` / `B-8`.** The change sheet reads only the order's snapshot. Four
   tests:
   - a deactivated Staff meal still reads *Staff meal — 10%* at −40.500;
   - it is absent from the picker;
   - after the preset is **edited to 20%**, the order still reads 10%;
   - a `presetId` that references nothing reads the same.

   I did this with a sheet rendered directly, not a `?state=`. See call 12.
6. **Nothing applies itself.**
   - Mounting any sheet navigates nowhere and opens nothing, and no option is
     pressed.
   - Reached in the app, the free-form sheet has nothing typed.
   - A source scan finds no timer, `Date`, `performance` or `Temporal`.
7. **Money.**
   - A percent goes through `rateFromPercent(value.percent)`, which takes the
     string as typed, and then `mulRate`.
   - A fixed amount is parsed with `BigInt`.
   - The results are exact past 2^53: 50% of 9007199254740993 is …497.
   - Half-up rounding happens once.
   - `orderTotals` **reproduces the artifact's hand-written figures exactly**:
     the table order's `default` totals, its totals with the Steak removed, the
     overflow totals, and AC-4's worked example at two decimals (−165, 1485,
     135, 74, 1559).
   - `money-display` now scans the three new files.
8. **Dialogs.**
   - Each sheet is one labelled modal dialog, and focus moves in.
   - Every acting control is a `<button type="button">`. The free-form value is
     the only `<input>`.
   - Cancel or Escape lands on `default` with focus on **Discount**.
9. **Pressed ring, verified in Chrome with the press held.** Method: headless
   Chrome over CDP at 1400×1000, DPR 2, `mousePressed` held for 150ms, then
   release away from the target.

   | Held | `:active` | box-shadow | border |
   |---|---|---|---|
   | Regular customer — 5% | true | `rgb(3,33,37) 0 0 0 2px inset` | solid |
   | Other amount — needs a manager | true | ink inset | **dashed** |
   | Apply | true | `rgb(255,255,255) … inset` | solid |
   | Remove the discount — needs a manager | true | ink inset | dashed |
   | **Gated Remove, focused by Tab, Space held** | true | **`rgb(171,255,174) 0 0 0 6px, rgb(3,33,37) 0 0 0 2px inset`** | dashed |

   Releasing away from the target left the URL unchanged every time. The
   evidence is in this session's scratchpad (`press.mjs`, `shots/`). It is not
   in the repo.
10. **`npm run verify`: 16 files, 624 tests passed**, up from 15 and 472.
    Typecheck is clean.
    - 95 of the new tests are in `discount.test.tsx`.
    - The other 57 come from existing parameterised suites running over the
      five new states and the three new source files.

#### Defects injected, each one caught (source restored and re-verified afterwards)

| Injected | Failed |
|---|---|
| The gate ignores a free-form discount already applied | 10 |
| The change sheet hard-codes *Replace with another preset* ungated, correct in the artifact's case only | 4 |
| A gated change opens the prompt with `go({ state: 'approval' })` | 16 |
| Remove lands on `empty`, as the artifact links it | 1 |
| The card looks up the live preset instead of reading the snapshot | 1 |
| The picker offers deactivated presets | 1 |
| The percent is computed through `Number()` and `Math.round` | 3, including `money-display` |
| Escape under the prompt also closes the sheet | 1 |
| Cancel on the prompt navigates away instead of returning | 3 |
| A preset applies itself on mount | 14 |

#### Judgement calls — each is a lead ruling, not mine

1. **The artifact's *Remove the discount* → `?state=empty` is a defect, and I
   did not copy it.** My reading is that it is shorthand forced by a missing
   state: **no fixture draws the table order after its discount has gone**.
   As drawn, though, it is a defect of the known shape:
   - it teaches a reviewer that removing a discount empties the order;
   - it lands on a state where Discount is drawn unavailable;
   - the control is right in no state at all.

   I land it on `default`, as the artifact lands every other change it cannot
   draw. That is also shorthand: `default` still shows Staff meal. **Rule one
   of these:** accept `default` as shorthand, or have a designer draw a
   no-discount table order. Reverting is one line in `discountFixtures.ts`.

   The same gap covers every change: Regular customer, Service recovery, an
   approved free-form discount and a removal all land on `default` showing
   Staff meal. Only Comp has a drawn result (`zero`).
2. **The artifact's gated *Replace with another amount* links straight to
   `?state=approval`, which skips entering the amount.** Approving a
   replacement whose value does not exist yet approves a transition whose end
   is unknown. `FR-F8`'s gate covers the **whole transition**, and its audit
   entry needs the after value. I route it to the free-form sheet, so the
   prompt opens on Apply with both ends named. For the same reason *Replace
   with another preset*, which the artifact links to `default`, opens the
   picker. **Please rule.**
3. **The three discount sheets move between themselves as component state,
   not by URL.** This departs from F2c, whose sheets push history. Two
   reasons:
   - The gate depends on what the order carries, and a URL state cannot carry
     that. The picker opened over a free-form discount would need another
     `?state=`, and I may add only one.
   - SITEMAP §1's table gives `[SHEET]` **Route: No, Back-stackable: No**.

   This also means **F2c's pushing sheets (FE-005 call 10) disagree with
   SITEMAP §1**. That was ruled before this slice and is not mine to change,
   but the two families now behave differently on Back. Worth one ruling for
   both.
4. **A dashed border on a live control contradicts `docs/DESIGN.md`.** Shapes
   says *"Dashed borders mean **not available**: the 86'd tile, the disabled
   button, the empty state."* The artifact draws *Other amount — needs a
   manager* dashed, and that control *is* available, through the prompt.
   - I drew it as the artifact does: the secondary button, dashed control
     border, white fill, live, with the pressed ring.
   - That is now five dashed controls on `sheet-remove-freeform`.
   - **For a designer:** either DESIGN.md gains *"or needs a manager"*, or the
     gated control gets a different mark. The `— needs a manager` suffix
     already carries the meaning in words.
5. **The picker over a free-form discount is undrawn.** It is reachable from
   `sheet-remove-freeform`. The artifact's *"Presets — no approval needed"*
   would be false there, so the label becomes **"Presets — need a manager"**
   (PROVISIONAL COPY) and every preset takes the gated treatment.
6. **The change sheet's amount is −40.500, not the artifact's −16.500.**
   - The artifact figures its two-line default order at 165.000.
   - F2a's panel is the three-line order at 405.000.
   - I compute from the order beside the sheet, so the card and the panel agree
     (tested).
   - `zero` likewise comps 405.000, not 165.000.
7. **Two states are computed, not hand-written.** `orderFixtures.ts` said
   nothing was computed. `sheet-remove-freeform` and `zero` draw orders the
   artifact never figured, so `orderTotals`, which is display only, computes
   them. It is **tested to reproduce every hand-written figure it overlaps**.
   The alternative is typing 17.213 / 361.463 / 31.295 in by hand. The
   comment says why.
8. **Copy that is PROVISIONAL, marked in source:**
   - the free-form card line *"Applied by Ana R. at 19:44. Free-form, approved
     by M. Iqbal."* (the approver's name comes from the artifact's voided line);
   - the free-form name **"Other discount"**, which is the sheet's title;
   - the three prompt requests (below);
   - the two refusal messages;
   - the fixed-amount label *"Value — 0 to 405.000"*.

   The prompt requests read:
   - *"Replace Staff meal 10% — with Other discount 15% −60.750"*
   - *"Remove the discount — Other discount 15% −60.750"*
   - *"Apply a discount — …"*

   Removals and replacements use `action: 'discount-change'`. A free-form
   discount on an order carrying none uses `'free-form-discount'`.
9. **Percent is pre-chosen on the free-form sheet reached in the app**, with
   the value empty. The artifact draws Percent filled. A pre-chosen *kind* is
   not a discount applying itself: nothing is applied, and Apply still needs a
   value and a manager. It is still a default of a sort, so I am raising it.
   `sheet-freeform` itself holds 15 because the artifact draws 15. That is a
   picture of a cashier mid-entry, with the same precedent as `sheet-item`'s
   `chosen`.
10. **A refused value uses A7's invalid field, its first surface in the app.**
    - The border is 2px amber and a message in amber sits under the field.
    - The input gets `aria-invalid` and `aria-describedby`.
    - A7's 13px left padding has no token and is omitted, so the figure shifts
      1px.
    - A fixed amount above the subtotal is **refused**, not silently clamped.
      `FR-M5` says "capped". A preset such as Service recovery 50.000 *is*
      clamped by `discountAmount`, because a preset cannot be refused.
    - A fixed amount is digits only. `50.000` with grouping dots is refused.
11. **`ApprovalFixture` mixes the request with the harness's routing.** I pass
    the request as data and hand it:
    - `approve`: the view the change lands on;
    - `cancel`: a sentinel compared by identity;
    - `opener: ''`: focus return is the sheet's job here.

    `Approval.tsx` is unchanged and needed no new prop. When a real command
    exists, the type should probably split.
12. **`FR-F5` has a test, not a `?state=`.** The task file calls it "worth a
    fixture and a test" and also allows one added state, which went to
    free-form applied. A deactivated preset on screen would need a second state.
13. **The totals' "change" link is not built.** The artifact opens
    `sheet-remove` from a *change* link on the discount row. F2a's panel does
    not draw it, and the panel is out of bounds for me. So `sheet-remove` is
    reachable by `?state=` only, and its focus returns to **Discount**. F2e or
    a panel slice should add the link, as a `<button>`.
14. **Escape on the free-form sheet goes Back to the previous sheet**, matching
    its left foot button, as on the line editor. Back within the family moves
    focus to the new sheet's dialog, not to the control that opened the step.

#### Where this task file disagrees with a reviewed document

- **The `FR-F8` table and the opening correction are right.** I checked them
  against the PRD text.
- **"Three of its controls are ungated and one is dashed" is imprecise.**
  `sheet-remove` draws two ungated controls and one dashed. The picker draws
  four ungated and one dashed. Nothing built depends on this.
- **"Do not edit existing sheets"** could not be kept to the letter:
  - `SheetFrame` had to be exported to share the frame (one keyword, no
    behaviour);
  - `sheets.test.tsx`'s *"none of the four held"* assertion was bound to fail
    the moment those states existed, and was updated.

#### Found, not fixed

- **Focus is still not trapped** in either dialog. Carried from FE-005 and
  FE-006.
- **Two scrims stack** when the prompt opens over a sheet: the sheet's own,
  then the modal's. The prompt reads clearly (screenshot), but it is darker
  than the artifact's single-scrim approval. A designer should say whether the
  sheet's scrim yields.

#### Not checked

- Screen-reader announcement of the sheets, the refusal and the prompt.
- A real touch device, and `vite preview`.
- **Hover.** This slice adds no `:hover` rule, and a test pins that. The
  controls inherit F2c's `button.action:hover` inside `@media (hover: hover)`.
- A pixel comparison against the Frost artifact in the browser. I compared
  structure and copy from its source, not side by side.

---

### Lead verification and rulings, 2026-09-18

**`npm run verify`: 16 files, 624 tests passed**, typecheck clean, up from 472.

**The gate proven by ungating one transition.** Changing `needsManager` so a
free-form discount replaced by a preset no longer requires approval failed
**5 tests**. The rule lives in `discount.ts` as a pure module the sheets ask —
they never decide a gate themselves — and it correctly extends the task's table
with the *nothing applied* cases (`FR-F2`, `FR-F3`) that the table omitted.

**`role`-shaped win worth noting:** this slice **verified focused-and-pressed**,
the check FE-003 and FE-004 both had to report as not done. Space activates a
`<button>`. The 2026-09-17 ruling paid for itself in two slices.

#### Rulings

**Accepted, and the reasoning is better than the task's:**

1. **Gated *Replace with another amount* routes through the free-form sheet**
   rather than the artifact's direct link to the prompt. Approving a
   replacement whose value does not exist yet **approves a transition whose end
   is unknown**, and `FR-F8`'s audit entry needs the after value. The artifact's
   link is shorthand; this is the requirement.
2. **Figures computed from the adjacent order (405.000), not the artifact's
   two-line 165.000.** The card and the panel beside it must agree; matching a
   different order's numbers would look right and be wrong.
3. **Totals computed rather than hand-written** for the two states the artifact
   never figured. Display-only, and held to the artifact's own arithmetic by
   test.
4. ***Remove the discount* lands on `default`, not the artifact's `?state=empty`.**
   The artifact is defective here — it teaches that removing a discount empties
   the order, and lands on a state where Discount is unavailable. `default` is
   itself shorthand (it still shows Staff meal), and that is **accepted**: every
   other undrawn result lands there too. **A designer owes a no-discount table
   order**; until then the shorthand is stated rather than hidden.

**Accepted, and corrected upstream:**

5. **Sheets move as component state, never by URL — and F2c was wrong.**
   SITEMAP §1's table gives `[SHEET]` **Route: No, Back-stackable: No**. The
   lead accepted FE-005's call 10, which had sheets pushing history. **That
   acceptance was wrong.** `builder9` did not change F2c's behaviour, correctly,
   but the two families now disagree on Back. **F2e corrects F2c's sheets to
   replace**, alongside the button conversion and `role="alert"`.

**To a designer, not resolved here:**

6. **A dashed border on a live control contradicts `docs/DESIGN.md`**, which
   says dashed means *not available* — the 86'd tile, the disabled button, the
   empty state. The artifact draws *Other amount — needs a manager* dashed, and
   that control **is** available, through the prompt. Either DESIGN.md gains
   "or needs a manager", or gated controls get their own mark. The `— needs a
   manager` suffix already carries the meaning in words.
7. **"Presets — need a manager"** is PROVISIONAL COPY for the picker opened over
   a free-form discount, where the artifact's *"Presets — no approval needed"*
   would be false. Undrawn state, correctly flagged rather than asserted.
8. **The free-form sheet's refusal copy is PROVISIONAL.** The artifact only ever
   draws a valid 15%. This is A7's invalid-field state finally being consumed,
   and its wording has never been reviewed.

#### The lead's sixth error

This task file corrected one error (`FR-F8`) and contained another: it accepted
sheets pushing history. **Six consecutive slices.** The pattern is unchanged and
so is the mitigation — implementers read the sources, and every one of these was
caught by the person building rather than the person planning.
