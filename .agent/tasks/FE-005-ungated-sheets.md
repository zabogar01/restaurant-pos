# FE-005 — POS ungated sheets (F2c)

**Status:** Done 2026-09-18 for the three states that were genuinely ungated.
Four were correctly refused and re-planned — see the lead's rulings.
**Roadmap item:** F2c
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder7`

---

## F2c was sixteen states. This is seven of them.

The roadmap gave F2c "the sheets, the approval PIN flow, and the fire-error
states". The lead counted before assigning, as with F2a and F2b: the POS-03
fixture has **29 states, nine of which are built**, and that bucket held
sixteen. Splitting again:

| Slice | What it covers |
|---|---|
| **F2c — this task** | The sheets that change a line or a discount **with no manager PIN anywhere** |
| F2g | The gated path: void line, void order, and the four approval-prompt states |
| F2h | `error`, `fireerror`, `fireblocked`, and the 86'd line in the panel |

**The split is along the PIN, and that is deliberate.** Everything in this slice
is an action a cashier takes alone. Nothing here is gated, nothing here writes
an approval record, and **no control in this slice may lead to a PIN prompt.**
Keeping the ungated work in its own task means a reviewer can check that
property by looking, rather than by tracing every control.

`linecontrols` is **not** in this slice. It is a fixture demo of the pending-vs-fired
signatures F2a already ships; it adds no behaviour.

---

## Objective

Seven sheet and totals states render at 1280×800 on the Frost tokens, over the
order screen, with no PIN-gated path reachable from any of them.

---

## Required inputs

1. **`docs/design/visual-directions/frost/pos/order.html`** — the Frost fixture,
   on `agent/design-direction`, in the worktree at `../restaurant-pos-design`.
   The sheet blocks are keyed by `data-when`.
2. **`docs/design/SCREEN-INVENTORY.md` — M-2 (item configuration sheet) and M-3
   (discount sheets)**, same worktree. M-1, the approval prompt, is **not yours**.
3. **`.agent/tasks/FE-004-menu-region.md`** on this branch — read the handoff
   and the lead's rulings under it. It is the standard for your own.
4. **`apps/pos/src/MenuRegion.tsx`, `OrderPanel.tsx`, `pos.css`**, and the seven
   tests under `apps/pos/test/`.

---

## What to build

### The seven states

`?state=` on `/pos/order`, alongside the nine already served.

| State | What it shows |
|---|---|
| `sheet-item` | M-2: the item configuration sheet — size, extras, a live line total |
| `sheet-item86` | The same sheet after a manager 86'd the item **mid-choice** |
| `sheet-line` | The line editor: quantity, whole numbers, maximum 99 |
| `sheet-discount` | M-3: the discount sheet |
| `sheet-freeform` | M-3: the free-form discount sheet |
| `sheet-remove` | M-3: remove or replace an existing discount |
| `zero` | A 100% comp. The totals block resolves to a zero total |

### `sheet-item86` is the one with a safety property

A manager marks an item 86 **while the cashier is still choosing its options**.
The artifact's handling is careful and you should not soften it:

- The sheet stays open and **the cashier's selections are kept**, so they can
  read back what they had picked.
- A notice says the item is no longer available and why.
- **"Add to order" stops being a control.** The artifact renders it as
  `span.btn.btn--off`, not a disabled link.

**Test that property directly:** in `sheet-item86` there is no control that adds
the line. Not "it is disabled" — that it cannot be activated at all. This is the
same shape as the 86'd tile in F2b and the disabled Continue on the lock screen:
a thing that would do nothing must not look like a thing that does something.

### No PIN-gated path, and prove it

**Acceptance criterion 1.** From every one of these seven states, no control
leads to `sheet-voidline`, `sheet-voidorder`, `sheet-voidorder-fired`, or any
`approval*` state. Write a test that asserts it across all seven, the way F2b
asserted the route out was the only control under a lock.

The reasoning is `I-12`'s and `B-16`'s: a gated action must never be reachable
from a position an ungated one has already taught, because paper cannot be
un-printed. That ruling has been enforced by structure so far. Here it is
enforced by reachability.

### `zero` — a comp that takes the total to nothing

A 100% comp discount resolves the totals block to zero. Render the artifact's
`zero` totals variant. **Do not reason about whether a zero-total order can be
closed** — `B-18` and settlement are F3's, and this slice shows a total, not a
close.

### Sheets are dialogs

The artifact draws a scrim and a sheet; it cannot express focus behaviour. Give
each sheet `role="dialog"` and `aria-modal="true"`, move focus into it when it
opens, and return focus on Cancel. Escape closes.

**If SCREEN-INVENTORY specifies overlay behaviour that differs, follow the
inventory and say so** — it is the confirmed structure, and this paragraph is
standard practice rather than a ruling.

### Controls are buttons

**Ruled 2026-09-17:** anything that acts on the order is a `<button>`; an anchor
is for leaving the screen. Every control you add here — size options, extras,
quantity steppers, Add, Cancel, discount choices — **acts**, so all of them are
buttons.

F2a and F2b built acting controls as anchors and that is being unwound
separately in **F2e**. Do not convert their controls as part of this task, and
do not add new ones.

### Values — check before you conclude

The sheets are dense with inline styles in the artifact: button widths of 150,
180, 120 and 88px, field widths, several margins, a 20px line-total row.

**Check the registry for each one before deciding it is absent.** The previous
task file asserted two absences that turned out to be present, because the
lead's grep was too narrow. A token may be named for its role rather than its
number — the 86 tag's values live under `--frost-unavailable-*`, not under
anything containing "86".

If a value is genuinely absent: **omit it, comment the omission in `pos.css`,
and name it in your handoff.** Do not invent it, and do not reach for a token
that shares a number for an unrelated reason. Mapping spacing onto the spacing
scale is fine and is not approximating.

---

## Constraints

- **No PIN, no approval, no void.** If a sheet you are building seems to need
  one, you have crossed into F2g. Stop and say so.
- **Do not edit the panel or menu-region markup** beyond what a sheet must add.
  Both are reviewed and committed.
- **Do not edit `frost-states.css`, the fixture, the registry, or any contract
  document.**
- **Money stays a `bigint`.** Line totals and discounts are money.
  `money-display.test.ts` bans `Number(` across `src`.
- **Every hover inside `@media (hover: hover)`.** `hover-scoped.test.ts`
  enforces it.
- **No fetch, storage, or console.** `console-free.test.ts` enforces it.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.**
- **Stop at the ungated sheets.** No approval prompt, no fire states, no
  quick-sale mode.

---

## Acceptance criteria

1. **No control in any of the seven states reaches a gated state**, proven by a
   test across all seven.
2. All seven render at 1280×800 and are reachable by `?state=`.
3. In `sheet-item86` the selections are still shown and **no control adds the
   line**.
4. Each sheet is a dialog: focus moves in, Cancel and Escape return it.
5. Every new acting control is a `<button>`.
6. A pressed control inside a sheet draws the ring. **Verified in a browser with
   the press held** — FE-002, FE-003 and FE-004 all describe the DevTools
   Protocol method.
7. `npm run verify` passes. FE-004 left 273 tests across 13 files; state the new
   count.
8. Typecheck clean.
9. Any value absent from the registry is omitted and named, never invented —
   and you checked, rather than taking this file's word for what is absent.

---

## Out of scope

- `sheet-voidline`, `sheet-voidorder`, `sheet-voidorder-fired`, and all four
  `approval*` states — **F2g**.
- `error`, `fireerror`, `fireblocked`, the 86'd line in the panel — **F2h**.
- `quick`, `quick-line` — **F2d**. `linecontrols` — not needed at all.
- Converting F2a's and F2b's anchors to buttons — **F2e**.
- Whether a zero-total order can be closed — F3.

---

## Handoff

Write your handoff here when the work is done. Name the command, the URL, and
the `?state=` values. Raise judgement calls rather than taking them — the last
three slices raised eleven, nine and several, and every one was worth having;
two of them caught errors in the task file itself. If a check was skipped, say
which and why. The lead verifies with `git log`, a browser, and by injecting the
defect your tests claim to catch.

### 2026-09-18 — implementer (claude, Opus 5)

**Partial, and deliberately so. Three of the seven states are built. Four are
held**, because the inventory and the PRD put a PIN-gated path inside each of
them. That is the stop condition this file names ("if a sheet you are building
seems to need an approval or a void … stop and say so"). See *The four held
states* below. The lead needs to rule on them before they can be built.

**Not committed.** Working tree on `agent/phase-0-foundations`:

- new: `apps/pos/src/Sheets.tsx`, `apps/pos/src/sheetFixtures.ts`,
  `apps/pos/test/sheets.test.tsx`
- modified: `apps/pos/src/OrderPanel.tsx` (**`OrderScreen` only**: the view
  is now held in state, a sheet renders over the frame, and the bar and body
  go `inert` while a sheet is open. `OrderPanel`, `LineRow`, `TotalsView` and
  `OrderActions` are untouched), `apps/pos/src/orderFixtures.ts` (three states
  and `viewSearch`), `apps/pos/src/menuFixtures.ts` (three entries and two
  comments), `apps/pos/src/pos.css` (`position: relative` on `.pos-device`,
  and a new F2c section), `apps/pos/test/order-panel.test.tsx` (the
  exact-states list now has twelve entries)

`.agent/MEMORY.md` and `.agent/ROADMAP.md` were already modified when I
started. **I did not touch them.** `frost-states.css`, the fixture, the
registry and every contract document are unedited. No F2a or F2b anchor was
converted.

#### What the owner opens

```
npm run dev -w apps/pos        # http://127.0.0.1:5173/pos/order
```

The new `?state=` values are **`sheet-item`, `sheet-item86` and `sheet-line`**.
The nine earlier states still work, and the dev links under the frame list all
twelve. Tapping a menu tile opens `sheet-item`. Tapping the pending Steak row
opens `sheet-line`. The Vite server on 5173 was **already running** (pid
31567, not mine, the same one FE-002 to FE-004 found). I used it and left it
running.

#### The four held states — a lead ruling is needed

| State | Why it cannot meet AC1 as written |
|---|---|
| `sheet-freeform` | **Gated by definition.** Inventory M-3: "free-form entry (gated, FR-F3)". The artifact tags it `MANAGER REQUIRED`, and its Apply goes to `?state=approval`. By this task's own split it is F2g. |
| `sheet-remove` | **Holds one gated control.** "Replace with another amount — needs a manager" goes to `?state=approval` (FR-F8: a replacement that is free-form is gated). Its other two controls are ungated, because the applied discount is a preset. |
| `sheet-discount` | The preset picker itself is ungated (FR-F2). But **"Other amount — needs a manager" leads one step into `sheet-freeform`**, whose Apply leads to approval. It passes AC1's literal list and fails its reachability intent. |
| `zero` | **Not a sheet, so nothing is inert.** The whole order screen is live, including F2a's panel. Its fired row bodies go to `sheet-voidline` and its Void order goes to `sheet-voidorder` — which is I-12 working as designed. The totals' `change` link also goes to `sheet-remove`. AC1 as literally written cannot hold here without breaking I-12. |

The task file puts M-3 on the ungated side. The inventory, which is the
confirmed structure, says two of M-3's three nodes are gated, and the artifact
draws the gated entries **visibly** (dashed, marked "needs a manager"). The
inventory also says "Denial is the approval modal being cancelled or failing,
**never a hidden control**." Hiding those entries to satisfy AC1 would
contradict the inventory. Leaving them in fails AC1. Neither is mine to
choose, so I built neither.

**Proposed ruling (the lead's to take or change):**

1. Move `sheet-freeform` to F2g outright.
2. Move `sheet-discount` and `sheet-remove` to F2g as well. Each is a mixed
   sheet whose gated entry is designed to sit beside its ungated ones, and
   F2g is where the approval prompt they lead to gets built.
3. Keep `zero` in a slice, and **restate AC1 for non-sheet states** as "no
   control this slice adds reaches a gated state; the panel's existing void
   paths are I-12's and stay." Alternatively, move `zero` with the discount
   sheets, since its only new control (`change`) leads to `sheet-remove`.

The test is ready for any of these. `sheets.test.tsx` lists all seven names,
and the AC1 block runs over every one that `ORDER_STATES` serves. A held state
is checked automatically once it is added, and one test ("serves exactly the
three built, and none of the four held") fails at that moment to force its
list to be updated.

#### Against the acceptance criteria

1. **Reachability — proven for the three built states. Not proven for the four
   held ones, which are not served.**
   - The test collects every live control on the frame (`a[href]`, `button`,
     inputs, `[role=button]`, positive tabindex, none inside `[inert]`). It
     reads each anchor's href. It **presses** each button on a fresh mount and
     reads the URL the press leaves behind. No destination is `sheet-voidline`,
     `sheet-voidorder`, `sheet-voidorder-fired` or any `approval*` state.
   - The test also asserts that every live control is inside the dialog, and
     that the panel's void anchors are **still drawn behind the sheet, inside
     `[inert]`**. That makes it clear what is doing the work.
   - The detector is proven to see a gated path: with the `inert` attributes
     stripped from a rendered `sheet-item`, it finds both `sheet-voidline` and
     `sheet-voidorder`.
   - **In Chrome:** I clicked a real mouse on the fired Soda row through the
     open `sheet-item`. The URL stayed `?state=sheet-item` and the dialog stayed
     open. `inert` holds in the browser, not only in jsdom.
2. **Three states at 1280×800, reachable by `?state=`.** In Chrome: the device
   measures 1280×800 in each. The sheet is `[0, 64, 820, 736]` and the panel
   is `[820, 64, 460, 736]`, so the panel is uncovered (DESIGN.md, Overlays).
   The sheet body does not overflow.
3. **`sheet-item86`: the selections are kept and nothing adds the line.**
   - Large and Extra cheese stay `aria-pressed`, and the line total stays
     135.000, the same as in `sheet-item`.
   - The notice copy is the artifact's.
   - "Add to order" is exactly one element: a `span.action.action--off` with no
     href, tabindex or role and no control ancestor. No live control on the
     frame contains the text. Pressing it leaves the URL and the dialog as they
     were. The only footer control is Cancel.
   - In Chrome, holding the press on it gives `:active` true and **`box-shadow:
     none`**.
4. **A dialog.** `role="dialog"`, `aria-modal="true"`, labelled by its `h2`.
   - Focus moves to the dialog on open (Chrome: `activeElement` is the dialog;
     the dialog draws no ring).
   - Cancel (item sheets) and Back (line) close the sheet and focus the opener:
     the Burger tile, or the pending Steak row body. Escape does the same.
   - In Chrome, Escape landed on `?state=default` with focus on
     `data-item="burger"` and `:focus-visible` true.
   - SCREEN-INVENTORY states no overlay behaviour beyond M-1's "modal over the
     triggering screen", so nothing conflicts. See call 2 on the panel being
     inert.
5. **Every new acting control is a `<button type="button">`.** Tested per
   sheet: there are zero anchors in any dialog.
6. **Pressed ring, verified with the press held.** See the next section.
   **Focused-and-pressed is verified too**, for the first time in this
   project.
7. **`npm run verify`: 14 files, 356 tests passed**, up from 13 and 273. The
   83 new tests:
   - 58 in `sheets.test.tsx`
   - 12 in `order-panel.test.tsx`: the I-12 block over three new states
   - 8 in `no-invented-values`: two new `src` files
   - 2 in `money-display`: the same two files
   - 3 in `menu-region.test.tsx`: the no-reflow block over three new states

   `npm run build -w apps/pos` also succeeds.
8. **Typecheck clean.** It is part of `verify`, which chains `tsc` before
   vitest with `&&`.
9. **Values.** See call 1. I checked the registry and the tokens JSON for each
   inline value rather than taking this file's list.

**Guards proven red by injecting the defect** (each restored byte-identical,
`cmp` clean, then re-run green):

| Injected | Failed |
|---|---|
| `inert` removed from `OrderScreen` | 9: all three AC1 checks in each of the three states |
| item86's Add drawn as `<button disabled>` | 2: not-a-control; only-way-out-is-Cancel |
| Focus return removed | 6: Cancel/Back and Escape, per sheet |
| `button.action:active` → `.action:active` | 2: the ring rules |
| Escape listener removed | 3 |
| item86 resets the size choice | 1: selections kept |

I also found and fixed a harness bug in my own test before trusting it:
`OrderScreen` keeps its view in state, so re-rendering into the same root
after a press kept the view the press had moved to. Every render now
remounts. The detector test is what exposed the bug.

#### How the press was held

The same method as FE-002 to FE-004. I drove installed Google Chrome
(`--headless=new`) over the DevTools Protocol against the dev server, at a
1400×1000 viewport and DPR 2.

- **Mouse:** `Input.dispatchMouseEvent mousePressed`, held for 150ms. While
  held I read `:active`, the computed style and a screenshot, then released
  away from the target.
- **Keyboard:** Tab to a button, then `Input.dispatchKeyEvent keyDown Space`,
  held for 150ms and read the same way, then `keyUp`.

I looked at the screenshots myself.

| Held | `:active` | box-shadow while held |
|---|---|---|
| Regular (unselected option) | true | `rgb(3,33,37) 0 0 0 2px inset`. Ink on the hover fill, because the mouse also hovers. |
| Large (selected option, primary fill) | true | white inset |
| Cancel | true | ink inset |
| Add to order | true | white inset |
| **Add to order, 86'd (span)** | true | **`none`** |
| Bacon, in `sheet-item86` | true | ink inset. The options stay live; see call 3. |
| Quantity + | true | ink inset |
| Remove line | true | white inset |
| **Regular, focused by Tab, Space held** | true | **`rgb(171,255,174) 0 0 0 6px, rgb(3,33,37) 0 0 0 2px inset`**: the focus ring and the pressed ring together. On keyUp Regular became selected. |
| **Quantity +, focused, Space held** | true | the same pair. On keyUp the quantity became 2. |

At rest, every one of these is `none`, or the focus ring alone when focused.
The Space screenshot shows the green outer ring and the ink inset ring both
drawn.

The evidence (`press-sheets.mjs`, `measure.mjs`, `shots/*.png`,
`shots/results.json`) is in this session's scratchpad,
`/private/tmp/claude-501/…/bf159adf-…/scratchpad/`. It is temporary and **not
in the repo**.

#### Not checked

- **Hover suppression on touch.** It is the same void check as FE-004, and I
  did not retry it. The new hover rules sit inside `@media (hover: hover)`,
  and `hover-scoped.test.ts` passes over them. I did not re-inject a defect
  into that test, because FE-004 already showed it failing.
- **Screen-reader announcement** of the dialog name and of the quantity
  `<output aria-live>`. I have no assistive technology here.
- A real touch device, and `vite preview`.

#### Judgement calls — each is a lead ruling, not mine

1. **Values.**
   - **Genuinely absent, and omitted:** the option widths 150px and 180px,
     the steppers' 88px and the quantity field's 120px. Each is commented in
     `pos.css`. I checked each against the registry and the tokens JSON.
     `--frost-menu-columns` (150), `--frost-receipt-reprint-width` (180) and
     `--frost-pin-columns`/`--frost-pin-key-height` (88) share those numbers
     for unrelated controls, so I did not use them.
   - **The consequence is visible:** in Chrome the steppers measure **43×72**
     and the quantity field **41×56**. That is a narrow pill with a small
     glyph, below every width in DESIGN.md's POS touch-target table (the
     narrowest there is the 56px slot). The options measure 88–183 wide
     instead of a uniform 150/180. The steppers are the one place where
     omitting a value visibly costs something. **I recommend the registry
     gain a stepper width**, rather than having me borrow the PIN key's 88.
   - **Present and used:** `--frost-sheet-top`, `--frost-sheet-right`,
     `--frost-sheet-header-height`, `--frost-scrim`, `--frost-overlay-border`,
     `--frost-overlay-shadow`, the three `--frost-overlay-*-padding` tokens,
     `--frost-field-height`, `--frost-field-padding`, `--frost-text-20`
     (line total and field) and `--frost-text-18` (heading).
   - The sheet head uses `--frost-overlay-head-padding` (16px 20px) at the
     64px head height. structure.css pads the sheet head `0 20px`, but
     DESIGN.md says "Overlay heads and feet use 16px 20px", and with the head
     centred the result is the same.
   - **Mapped onto the spacing scale:** the 20px, 24px and 8px inline margins
     and the 8px and 12px row gaps.
   - The line total's `<b>` is set semibold, per DESIGN.md: "No rendered text
     uses 700".
2. **The panel is inert while a sheet is open.** The artifact leaves the panel
   uncovered and, being static HTML, leaves its anchors live. With the panel
   live, AC1 fails from every sheet: the fired rows lead to `sheet-voidline`.
   `aria-modal` means that everything outside the dialog is not operable, so I
   used `inert`: the panel stays legible and cannot be operated. **This is
   what AC1 rests on**, so it should be ruled on explicitly rather than
   discovered.
3. **In `sheet-item86` the options stay operable.** The artifact draws them
   identically in both states, and AC-12 names only Add as disabled. A cashier
   can therefore still change a selection on an item that can no longer be
   added. The alternative is to draw them read-only once 86'd, in the same
   boxes as spans, with the selected fill kept. That is one condition in
   `ItemSheet`.
4. **The line total is computed live**, because the task says "a live line
   total". It is `unitPrice(base, deltas)` in bigint and floors at zero per
   FR-C2/AC-26. This is the first price arithmetic in `apps/pos`: F2a's
   fixtures compute nothing. It is display only, and a comment says the
   server prices the line.
5. **The quantity stepper is live on the sheet only.** It clamps to 1..99 and
   the panel does not follow, because there is no command to send and no
   figures to land on.
   - At a bound, the press does nothing while the button still looks live. I
     followed the artifact here: it draws a live − at quantity 1.
   - That sits awkwardly with "a thing that would do nothing must not look
     like a thing that does something". Drawing the bound stepper as
     `action--off` is the alternative.
6. **Where the artifact's actions go, kept as the artifact routes them:**
   - Add to order → `eightysix`
   - Line editor Back → `eightysix`
   - Cancel → `default`
   - Remove line → `default` without the Steak (`?state=default&gone=steak`,
     the same figures as the artifact's `order.html`)

   Add and Back landing on the 86'd grid look odd. They are the artifact's
   choices, not mine.
7. **`sheet-item86`'s grid 86s Steak, not Burger.** That is the artifact
   (`tile--off` is `data-when="eightysix fireblocked sheet-item86"`), and I
   followed it. The sheet says *Burger* is no longer available. Because the
   sheet covers the whole menu region, the mismatch is invisible on screen.
   **The artifact contradicts itself**, and that belongs on the design branch.
   Fixing it here is a one-item change in `MENU_FIXTURES`.
8. **Option semantics.** Both groups use `<button aria-pressed>` inside a
   labelled `role="group"`. Size is choose-one, and a radio group
   (`role="radio"` with roving tabindex) would describe it more exactly. I
   kept one pattern for both groups.
9. **Add-off keeps `aria-disabled="true"`**, as F2a's off close-bar actions
   do. It is a span either way. Drop the attribute if "not disabled" was
   meant to cover it.
10. **In-app navigation.** Sheet buttons change the view with
    `history.pushState` instead of reloading, because focus cannot be handed
    back across a reload. `OrderScreen` also listens to `popstate` so that
    the browser's Back button works. F2e will need the same mechanism when
    tiles and rows become buttons.

#### Found, not fixed

1. **The task file's split is wrong for M-3.** See *The four held states*.
   This is the fourth consecutive slice in which a task file disagreed with
   the inventory or the artifact.
2. **Focus is not trapped inside the dialog.** In Chrome, Tab walks the eight
   sheet controls and then leaves for the dev fixture links **below** the
   frame. It never reaches the inert panel. Those links are dev-only and sit
   outside the 1280×800 device. A production build has no such links, so
   focus would go to the browser chrome instead.
3. **After Remove line, focus has nowhere to return.** The opener, the Steak
   row, is gone. Focus falls to the document.
4. **The 86'd line in the panel** is still F2h's. The artifact tags the pending
   Steak `86` behind `sheet-item86`.
5. **The pressed ring on a selected option is faint**, like FE-004's selected
   category: a 2px white inset on a dark fill. Seen in `held-large-option-selected.png`. It is the A7
   rule working as written.

---

### Lead verification and rulings, 2026-09-18

**Run and read.** `npm run verify`: **14 files, 356 tests passed**, typecheck
clean, up from 273.

**Criterion 1 proven by injecting the defect it exists to catch.** Pointing the
item sheet's *Add to order* at `sheet-voidline` failed
*"every live control on the frame leads somewhere ungated"* — 2 failed, 56
passed. The guard carries **detector self-tests** of its own: it proves it
*finds* the panel's void paths once the background stops being inert, and that
it *ignores* a control inside an inert subtree. A reachability guard that cannot
demonstrate both halves is worthless, and this one demonstrates both.

**Looked at:** `sheet-item86` keeps Large and Extra cheese filled and the line
total at 135.000, states why the item went, and renders *Add to order* greyed
and dashed while Cancel stays live. The safety property holds visually, not just
in the DOM.

#### The task file was wrong, and the implementer built three of seven

**This slice's premise was wrong about M-3.** FE-005 put all three discount
nodes on the ungated side. SCREEN-INVENTORY says the opposite in one sentence:

> Three distinct nodes, not one: preset picker (ungated, FR-F2), free-form entry
> (**gated**, FR-F3), and remove/replace (**gated by the whole transition**,
> FR-F8).

So `sheet-freeform` is gated by definition, and `sheet-remove` is *wholly*
gated — stricter even than the handoff put it. `sheet-discount`'s picker is
ungated, but its *Other amount* entry leads one step into the gated sheet.
And `zero` is not a sheet at all, so nothing behind it is inert: the panel is
live, with the `I-12` void paths that are supposed to be there.

**`builder7` refused a false choice rather than resolving it.** Hiding the gated
entries would have satisfied criterion 1 and contradicted the inventory, which
says denial is "the approval modal being cancelled or failing, **never a hidden
control**". Leaving them in would have failed criterion 1. It built the three
states that were genuinely ungated, held four, and asked. That is the behaviour
this process exists to produce.

**This is the fourth consecutive slice in which a task file of the lead's was
wrong and a reviewed document was right.** The pattern is now specific enough to
name: the lead has been grouping work by *what it looks like* — "the sheets" —
when the inventory groups it by *who may do it*. **Slice by authority, not by
component.**

#### Rulings

1. **`sheet-freeform` and `sheet-remove` move out of F2c.** Gated. Splitting a
   sheet so its ungated half ships early would put a gated control on screen
   with nothing behind it.
2. **`sheet-discount` moves with them.** Its picker is ungated, but it is one
   tap from the gated entry, and the entry is *designed* to sit beside the
   presets. A sheet is one node to a cashier.
3. **`zero` moves with the discount family.** Its only new control is the
   totals' `change`, which leads to `sheet-remove`.
4. **Criterion 1 is restated for every future slice**, because as written it
   could not hold for a non-sheet state: *no control **this slice adds** reaches
   a gated state except through the approval prompt. A panel's existing void
   paths are `I-12`'s and stay.*
5. **F2g is re-planned into three, and the shared piece goes first** —
   the approval prompt (M-1) is what both families depend on, so it is built
   once, before either.

**Delivered and accepted: `sheet-item`, `sheet-item86`, `sheet-line`.** The test
file already lists all seven names and checks any state `ORDER_STATES` serves,
with one test failing the moment a held state is added so the list must be
updated. The held work is wired for whoever picks it up.

#### On the interruption

`builder7` was stopped mid-response by the machine sleeping, one step before it
wrote its tests. It went **idle with source on disk and `npm run verify` green
at 298** — and no tests for the new code and an empty handoff template. A
passing suite proved nothing, because the tests that would have failed had not
been written.

**The signal that caught it was the empty handoff section**, checked before
anything else. It was resumed in the same session with its context intact and
finished the work. Nothing was lost and nothing was rebuilt.
