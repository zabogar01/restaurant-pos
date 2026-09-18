# FE-008 — POS void family (F2j)

**Status:** Done 2026-09-18, lead-verified.
**Roadmap item:** F2j
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder10`

---

## What this slice is

The three void sheets, and the last of POS-03's gated work. They were held out
of F2c because all three lead to the manager prompt, which exists now (F2g), and
F2i has since shown what a data-driven gate looks like.

**This slice's gate is the same shape as F2i's, and reads a different fact:**
voiding is gated **iff fired work is involved**, not by which sheet you are in.

---

## Objective

The three void sheets render at 1280×800, with the approval gate and the reason
requirement driven by `FR-H1`–`FR-H4`, and with nothing on screen implying that
a void waits on a printer.

---

## Required inputs

Read these yourself.

1. **`docs/PRD.md`, `FR-H1` through `FR-H4`**, and the `AC-*` rows that cite
   them. On this branch. The contract.
2. **`docs/BOUNDARIES.md`, `B-15`, `B-16`.** Inviolable.
3. **`docs/design/SCREEN-INVENTORY.md` — POS-03 and ruling `I-12`**, in the
   worktree at `../restaurant-pos-design`.
4. **`docs/design/visual-directions/frost/pos/order.html`** — the
   `sheet-voidline`, `sheet-voidorder` and `sheet-voidorder-fired` blocks.
5. **`.agent/tasks/FE-007-discount-family.md`** on this branch — read the
   handoff **and the lead's rulings**. `discount.ts` is the model for how a gate
   should be built here: a pure module the sheets ask, never a decision taken in
   a component.

---

## What to build

### The three states

| State | What it shows |
|---|---|
| `sheet-voidline` | Void one FIRED line. `MANAGER REQUIRED`, four reasons, a cancellation-ticket notice |
| `sheet-voidorder` | Void an order with **no** fired lines. No approval. *"The void is recorded against your name"* |
| `sheet-voidorder-fired` | Void an order **holding** fired lines. `MANAGER REQUIRED`, three reasons, the fired count named |

### The gate, from `FR-H1`–`FR-H4`

| What is being voided | Approval | Audited | Reason |
|---|---|---|---|
| A `PENDING` line (the × in the panel) | No | **No** (`FR-H2`) | No |
| An order with no `FIRED` lines | No | **Yes** (`FR-H3`) | No |
| A `FIRED` line | **Yes** (`FR-H4`) | Yes | **Required** |
| An order holding a `FIRED` line | **Yes** (`FR-H4`) | Yes | **Required** |

Note `FR-H2` and `FR-H3` differ on *audit* while agreeing on *approval*. They
are not the same case, and nothing you build should treat them as one.

**Build the gate as a pure module the sheets ask**, the way `discount.ts` does.
A sheet must not decide its own gate — that is exactly how a rule ends up
correct in the one state the artifact draws.

### The reason is required, and that is `FR-H4`

Both gated sheets say *"Reason — required"*. So **Continue is not available
until a reason is chosen**, and *"Other — type a reason"* means a typed reason
that is empty is not a reason.

The free-text case is where **A7's invalid-field state** applies —
`--frost-invalid` and `--frost-invalid-border`, landed unused in A9 and first
consumed by F2i. Its refusal copy is PROVISIONAL there; if you need wording,
mark yours PROVISIONAL too and say so.

### `B-15` — printing never gates anything

`FR-H4` creates a cancellation ticket **in the same transaction**, but
*"cancellation printing occurs after commit and never gates or rolls back the
void"*, and `B-15` says no transition is conditional on a print.

The artifact's notices are careful — *"A cancellation ticket will print in the
kitchen"*, *"It cancels this work only. It is not a new order and does not
re-send the item."* **Copy them exactly.** Do not add anything that implies the
void is waiting on the printer, and do not add a print-status indicator.

### `FR-H1` — void and refund are not the same action

*"The UI must not present them as the same action."* Nothing here is a refund;
POS-06 is. If you find yourself writing shared wording or a shared control for
the two, stop.

### `I-12` is already built — do not re-litigate it

A FIRED line's void is reached by **tapping the row body**, and its trailing
slot stays empty. That is built and tested in F2a. Your sheets are what the row
body opens. Do not add a void control to the trailing slot.

### Opening the prompt — binding, and F2i's precedent

**`?state=approval` is a review harness, not a route.** Open the prompt as
component state and pass it the action **and the chosen reason** — the artifact's
prompt head reads *"Void a fired line — Burger 135.000 — reason: customer
changed their mind"*, so the reason travels with the approval.

**F2i's case-ruling applies:** `Approval.tsx` renders the reason exactly as
given. **This slice owns the case** of the string it passes — the sheet offers
*"Customer changed their mind"* and the prompt shows it lower-case in the
artifact's running text. Decide, and say what you decided.

**Sheets move as component state, not by URL** (SITEMAP §1: a `[SHEET]` has
neither a route nor a back-stack entry). F2c's older sheets push; that is a
known defect being corrected in F2e, not a precedent to follow.

### Figures

`sheet-voidorder` shows 382.725 and `sheet-voidorder-fired` shows 155.925 —
**different orders**. F2i established the rule: compute from the order beside
the sheet so the sheet and the panel agree, rather than transcribing a figure
belonging to a different order. `discount.ts`'s `orderTotals` is display-only
and already does this.

---

## Constraints

- **No boundary is subject to your judgement.** If this appears to require
  breaking `B-15` or `B-16`, the task is wrong — stop and say so.
- **Do not edit `Approval.tsx`'s behaviour, the order panel, the menu region, or
  the existing sheets.** You may pass data in.
- **Do not edit `frost-states.css`, the fixture, the registry, or any contract
  document.**
- **Money stays a `bigint`.** Every acting control is a `<button>`. Every hover
  inside `@media (hover: hover)`. No fetch, storage, or console.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.**
- **Stop at the void family.** Not `error`, `fireerror`, `fireblocked` — F2h.

---

## Acceptance criteria

1. **Every row of the gate table is tested**, including that `FR-H2` and
   `FR-H3` differ on audit while agreeing on approval.
2. The three states render at 1280×800 and are reachable by `?state=`.
3. **Continue is unavailable until a reason is chosen**, and an empty typed
   reason is not a reason. Tested.
4. The prompt is opened as component state, never by a URL, and **the chosen
   reason travels with it**. Tested.
5. Nothing on screen implies the void waits on a printer, and no print-status
   indicator exists.
6. No void control appears in a line's trailing slot (`I-12` still holds).
7. Money arithmetic goes through `packages/money`; figures agree with the panel
   beside them.
8. Sheets are dialogs; focus moves in, Escape and Cancel return it.
9. A pressed control draws the ring, **verified in a browser with the press
   held** — and since these are buttons, **verify focused-and-pressed too**,
   which F2i showed is now reachable with Space.
10. `npm run verify` passes. FE-007 left 624 tests across 16 files; state the new
    count. Typecheck clean.

---

## Out of scope

- `error`, `fireerror`, `fireblocked`, the 86'd line in the panel — **F2h**.
- `quick`, `quick-line` — F2d. The `<a>`→`<button>` conversion, `role="alert"`,
  and correcting F2c's pushing sheets — F2e.
- Refunds, POS-06, and anything `CLOSED`.
- Any real audit write, print, approval check, or persistence.

---

## Handoff

Write your handoff here when the work is done. Name the command, the URL, and
the `?state=` values.

**Raise judgement calls rather than taking them.** Six consecutive slices have
found this lead's task files wrong where a reviewed document was right — most
recently that sheets should not push history, which this file now states
correctly only because the last implementer caught it. Where this file disagrees
with the PRD, BOUNDARIES.md or SITEMAP, **those win and this file is the
defect**; say so.

If a check was skipped, say which and why. The lead verifies with `git log`, a
browser, and by injecting the defect your tests claim to catch.

### 2026-09-18 — implementer (claude, Opus 5)

**Done. All three states are built. Every row of the gate table is tested, both
as a function and through the sheets.** Nothing here needed `B-15` or `B-16`
broken. **Two findings come first**, because each is the known defect shape: a
control that is right in one state and wrong in another. After them come
fifteen judgement calls. Each is a lead ruling, not mine.

**Not committed.** The working tree is on `agent/phase-0-foundations`:

- new: `apps/pos/src/void.ts` (the pure gate), `voidFixtures.ts`,
  `VoidSheets.tsx`, `apps/pos/test/void.test.tsx`
- modified:
  - `OrderPanel.tsx`: **`OrderScreen` only**. It mounts the family, makes the
    background inert, and returns focus. This is the same edit FE-007 made.
  - `orderFixtures.ts`: the three states, and one order (call 1).
  - `menuFixtures.ts`: the three states. The `Record` type requires them.
  - `pos.css`: a new void section, placed before the dev-only links.
  - `order-panel.test.tsx`: the exact-states list. The "unknown state" example
    was `sheet-voidline` and is now `fireerror`.
  - `sheets.test.tsx`: the "no sheet in any other state" check now also skips
    the void states.
- Untouched: `Approval.tsx`, `approvalFixtures.ts`, the panel, the menu region,
  the item, line and discount sheets, `frost-states.css`, the Frost fixture,
  the registry, every contract document, `.agent/MEMORY.md` and
  `.agent/ROADMAP.md`.

#### What the owner opens

```
npm run dev -w apps/pos     # http://127.0.0.1:5173/pos/order?state=sheet-voidline
```

The `?state=` values are **`sheet-voidline`, `sheet-voidorder` and
`sheet-voidorder-fired`**. Things to try:

- **On `sheet-voidline`:** Continue is drawn unavailable. Choose *Customer
  changed their mind* and press Continue. The prompt reads *"Void a fired line —
  Burger 135.000 — reason: customer changed their mind"*, and the URL does not
  change. Cancel returns you to the sheet with the reason still chosen.
- **On `sheet-voidline`:** choose *Other — type a reason* and press Continue
  with the field empty. The field is refused in amber and no prompt opens.
- **On `sheet-voidorder`:** *Void order* voids at once. There is no prompt and
  no reason.
- **On `sheet-voidorder-fired&gone=steak`:** the order value follows the panel
  to 155.925.

The Vite server on 5173 was already running (pid 31567, not mine). I used it
and left it running.

#### How the gate works

`voidRule(target)` in `void.ts` is the only place a void is decided. It asks one
thing: which lines on the target are `FIRED` (`cancels`).

- **Approval and the reason** both follow from whether `cancels` is non-empty.
- **Audit** follows from that, **or** from the target being an order. That is
  the one point where FR-H2 and FR-H3 part.
- **`requirement`** names the row that decided it: `FR-H2`, `FR-H3` or
  `FR-H4`.

The sheets draw everything from that answer: the tag, the reasons, the notice,
Continue versus *Void order*, and whether the prompt opens. Both order states use
the **same fixture shape and the same component**. The order beside the sheet
picks the variant, not the `?state=`. SITEMAP §2 draws the same structure: one
*Void whole order* sheet with an unfired variant and an approval path.

#### Findings — raise these first

**A. The artifact's `sheet-voidorder` contradicts itself, and the task file
repeats the contradiction.**

- The sheet says *"Nothing on this order has been sent to the kitchen"*.
- The panel the artifact draws beside it holds Round 1 and Round 2 fired, plus
  the pending Steak: 3 items, 382.725. `data-unless` on the fired block does
  not list `sheet-voidorder`.
- So **382.725 is the figure of an order holding fired work**. The task file's
  *"sheet-voidorder shows 382.725 and sheet-voidorder-fired shows 155.925 —
  different orders"* is wrong on the fact that matters.
- A data-driven gate cannot draw that sheet over that order. Over the artifact's
  panel it would, correctly, draw the fired variant.

**What I did:** `sheet-voidorder` opens over the **same three lines with nothing
yet fired**, all pending. The figures are unchanged (382.725), because firing
changes no price. It is one new order in `orderFixtures.ts`
(`unfiredTableOrder`). A test injecting the artifact's panel (defect 13 below)
fails 4 tests.

**Rule one of these:**

- accept this order;
- have a designer draw an unfired table order;
- or, if the intent was the quick sale (which never holds fired work, C-2),
  hold this state until F2d.

**B. The panel's void paths name fixture states, not the order or the line.
Out of my bounds, and serious once real.**

- **Every** fired row body links to `?state=sheet-voidline`, which is the
  **Burger's** sheet. Tapping Soda offers to void the Burger.
- Once a command exists, that is a cancellation ticket for the wrong work
  (B-16).
- *Void order* always links to `?state=sheet-voidorder`. From `default`, which
  holds fired work, it lands on a **different order** with nothing fired. The
  panel beside it changes under the cashier.
- The artifact does the same: every fired row links to the Burger's sheet.

`VOID_LINE_HREF` and `ACTIONS` belong to F2a. **The fix belongs to F2e or a
panel slice:** the row body and *Void order* become `<button>`s that open the
sheet as component state over the current order and line. At that point the
gate picks the variant, and the two order states become one entry point. My
sheet already reads a `lineId` and the order it is handed. Only the opener is
missing.

#### Acceptance criteria

1. **Every row of the gate table is tested.**
   - As a function: the four rows, plus:
     - FR-H2 and FR-H3 agree on approval and the reason and differ on audit;
     - an empty order, and an order with only voided lines, are FR-H3;
     - a voided line throws;
     - `cancels` holds fired work only (B-16);
     - a look-alike line (same name, 99×, 0 amount) is gated by status alone.
   - Through the sheets: the unfired fixture over an order with **one** fired
     line is gated, and the fired fixture over an unfired order is not. This
     proves the sheet reads the order, not the state.
   - A source scan: `VoidSheets.tsx` has no `status ===`, no
     `requirement ===` and no `state === 'sheet-void…'` comparison.
     `voidFixtures.ts` says nothing about approval or audit.
   - `AC-3`'s pending half is the gate's FR-H2 row. **The panel's × does not ask
     `voidRule`**, because the panel is out of bounds. See call 14.
2. **Three states at 1280×800, reachable by `?state=`.**
   - In Chrome the device measures 1280×800. The sheet is 820×736 at y 64, and
     no sheet body scrolls.
   - I looked at the screenshots of all three states, the refused Other, and
     Continue focused and held on `sheet-voidorder-fired`.
3. **Continue is unavailable until a reason is chosen. Tested.**
   - Until then it is a `span.action--off` with `aria-disabled`, and no button
     is named Continue.
   - Choosing *Other* with the field empty, or with only spaces, then pressing
     Continue opens no prompt. The field takes A7's invalid state and focus.
     `givenReason` has its own tests for `''`, `' '` and `'\t\n'`. See call 5
     for the reading I took.
4. **The prompt is component state, and the reason travels with it. Tested.**
   - `location.search` and `history.length` are unchanged, and there is no
     `approval` in the URL.
   - A source scan finds no `pushState`, `replaceState`, `location.`, approval
     state string or `APPROVAL_FIXTURES`.
   - The request text is asserted exactly, for a listed reason and for a typed
     one.
   - Cancel keeps the chosen or typed reason and returns focus to Continue.
   - Escape cancels the prompt alone. A second Escape closes the sheet.
   - A second opening starts a fresh pad.
   - In Chrome: Space on Continue opened the prompt with the reason, a history
     delta of 0 and the search unchanged.
5. **B-15.**
   - On every sheet, and after an Other refusal, the only text mentioning
     *print* is the artifact's two sentences, word for word.
   - There is no *printing*, *printer*, *printed*, *waiting*, *sending* or
     *queued*.
   - There is no `role=status`, progressbar, `aria-live` or `aria-busy`.
   - An unprinted fired round changes neither the gate nor the copy.
   - FR-H1: no *refund* anywhere.
6. **I-12 holds in all three states.** Every fired slot is empty, and the only
   slot control is a pending line's *Remove* (`gone=`), inert under the sheet.
   The fired row body still links to the void sheet. F2a's I-12 suites also run
   over the three new states.
7. **Money.**
   - The order value is the panel's own total, not transcribed. It is tested
     against the panel's grand total with and without `gone=steak`.
   - The card's amount is tested against the panel's Burger row.
   - The fired count is tested against the panel's fired rows.
   - No arithmetic is added, only reading. `money-display` scans the new files.
8. **Dialogs.**
   - Each sheet is one labelled modal dialog, and focus moves in.
   - Every acting control is a `<button type="button">`. The Other field is the
     only `<input>`.
   - Escape, Cancel and *Keep order* land on `default`, with focus on the opener:
     the Burger row body, or *Void order*.
9. **Pressed ring, verified in Chrome with the press held.**
   - Method: headless Chrome over CDP at 1400×1000, DPR 2.
   - Mouse: `mousePressed` held 150ms, released away from the target.
   - Keyboard: Tab to focus, then Space held 150ms, then released.

   | Held | `:active` | box-shadow |
   |---|---|---|
   | Sent to the wrong table | true | `rgb(3,33,37) 0 0 0 2px inset` |
   | Customer changed their mind, **chosen** | true | `rgb(255,255,255) … 2px inset` |
   | Other — type a reason | true | ink inset |
   | Cancel / Keep order | true | ink inset |
   | Continue / Void order (primary) | true | white inset |
   | **Kitchen cannot make it, Tab + Space held** | true | **`rgb(171,255,174) 0 0 0 6px, rgb(3,33,37) 0 0 0 2px inset`** |
   | **Continue, Tab + Space held** (both gated sheets) | true | **focus ring + white inset** |
   | **Keep order, Tab + Space held** | true | focus ring + ink inset |

   - A mouse released away from the target left the URL unchanged every time.
   - The unavailable Continue is a dashed span and cannot ring.
   - The evidence is in this session's scratchpad (`press.mjs`,
     `press-results.json`, `shots/`). It is not in the repo.
10. **`npm run verify`: 17 files, 753 tests passed**, up from 16 and 624.
    Typecheck is clean.
    - 99 of the new tests are in `void.test.tsx`.
    - The other 30 come from existing parameterised suites running over the
      three new states and the three new source files.

#### Defects injected, each one caught (source restored, then verify re-run)

| Injected | Failed |
|---|---|
| An order holding fired work is ungated | 19 |
| A pending removal is audited (FR-H2 folded into FR-H3) | 2 |
| An empty typed reason is accepted | 11 |
| The reason check is skipped at commit | 4 |
| Continue is available before a reason | 2 |
| The prompt opens by `go({ state: 'approval' })` | 17 |
| The reason is dropped from the prompt | 3 |
| A reason is pre-chosen | 2 |
| *"Waiting for the kitchen printer…"* is added under the notice | 3 |
| The order value is transcribed (382.725) instead of read | 3 |
| Escape under the prompt also closes the sheet | 2 |
| The order sheet always draws the unfired variant | 5 |
| `sheet-voidorder` over the artifact's fired panel | 4 |

#### Judgement calls — each is a lead ruling

1. **`sheet-voidorder`'s order.** See finding A.
2. **The panel's void paths.** See finding B. It is found, not fixed.
3. **No reason is pre-chosen in any fixture.** The artifact draws *Customer
   changed their mind* and *Customer left* chosen, with Continue live.
   - Unlike F2i's `sheet-freeform`, this `?state=` **is** the in-app route. A
     fired row body links straight to it.
   - So a fixture's choice would be a default: a void recorded with a reason
     nobody gave (FR-H4; M-1 says *"required, not optional"*).
   - The state therefore opens with nothing chosen and Continue unavailable.
     One tap reproduces the artifact's picture.
4. **The case of the reason. What I decided:**
   - Each listed reason carries **two written forms**: `label` for the sheet
     (*"Customer changed their mind"*) and `inline` for the prompt's running
     text (*"customer changed their mind"*).
   - Nothing is lower-cased at runtime, because that mangles names and
     acronyms. A test pins that each `inline` is its `label` with a lower-case
     first letter.
   - A **typed** reason is passed **verbatim, trimmed**: *"Pak Budi's BBQ order
     was a duplicate"* stays as typed.
   - **Open:** the request carries the display form. Which form the audit
     entry records (FR-J2) is for when a command exists.
5. **"Continue unavailable" versus "an empty typed reason is not a reason".** I
   read these as two rules:
   - Continue is unavailable until an **option** is chosen.
   - With *Other* chosen and nothing typed, Continue is live and **refuses**,
     using A7's invalid field as the task file anticipates.

   The alternative is to keep Continue unavailable until the typed text is
   non-empty. That needs no invalid state, but it gives no reason why. Changing
   it is two lines. **Please rule.**
6. **PROVISIONAL COPY, marked in source.** The artifact never draws *Other*
   chosen, the order prompt, or one fired line.
   - the field label *"Reason, in your words"*;
   - the refusal *"Type a reason, or choose one above."*;
   - the order's request, *"Void an order holding fired lines — Order · T1
     382.725 — reason: customer left"*;
   - the singular *"1 line has already been sent to the kitchen"*.

   Choosing *Other* moves focus into the field. That is my call; it brings up
   the keyboard on a touch device.
7. **The text field is unstyled territory** (DESIGN.md Open item 4).
   - It takes the numeric field's box (56px, 1px control border, 2px corners,
     `0 14px`) at the body's type, full width.
   - A7's 13px invalid padding has no token and is omitted, as in F2i.
8. **The card reads *"Burger — Large, Extra cheese"*.** The artifact has
   *"Large, extra cheese"*.
   - It is derived from the line's modifiers, so it matches the panel, and I did
     not change the case (call 4's reason).
   - The round and time (*"round 1 at 19:42"*) are read from the round group,
     not written in.
9. **Every void, and every cancel, lands on `default`.** That is shorthand, as
   in F2i.
   - The artifact sends an unfired void to `floor.html`, which this client does
     not have.
   - Its unfired sheet's **Keep order → `?state=eightysix`** (the 86'd-item
     state) is a defect. I did not copy it; its fired twin goes to `default`.
   - **A designer owes a voided result** for a line and for an order.
10. **The unfired *Void order* is drawn spruce primary, as the artifact draws
    it.** DESIGN.md names *Void order* a destructive action, and allows a
    *final* destructive action a brick fill. For a designer.
11. **The panel's `SELECTED` tag on the Burger row** in `sheet-voidline` is not
    drawn, because the panel is out of bounds.
12. **Closing a void sheet pushes one history entry.** Space on *Keep order*
    gave a history delta of 1. This is `OrderScreen.go`, shared with F2c and
    F2i. **F2e's correction covers it**; nothing within the void family pushes.
13. **`voidRule` takes no settlement lock.** FR-G12 and FR-G13 block void. Today
    the panel makes every void path unreachable under a lock. When a command
    exists, the lock refusal belongs with it, not in this display gate.
14. **The pending line's × does not ask `voidRule`.** The panel is out of
    bounds. A panel slice should route it through the gate's FR-H2 row.
15. **`.void-tag` repeats `.discount-tag`.** Both should become one sheet tag
    when the sheets are next touched. Two comments are now stale and left alone:
    - `approvalFixtures.ts` still says the void sheet *"does not exist yet
      (F2j)"*;
    - `OrderPanel.tsx`'s `ACTIONS` comment still says *"today resolves to the
      default state"*.

#### Where this task file disagrees with a reviewed document

- **The figures paragraph.** See finding A. The artifact's 382.725 order holds
  fired work. In the app both order sheets read 382.725, because both sit over
  the three-line order (F2i's precedent). 155.925 appears with `gone=steak`.
- **"Do not edit … the order panel"** could not be kept to the letter.
  `OrderScreen` lives in `OrderPanel.tsx`, and the mount had to go there, as in
  FE-007. The panel component itself is unchanged.
- **The gate table, B-15, FR-H1, I-12 and the component-state rule** are right.
  I checked each against the PRD, BOUNDARIES.md, SITEMAP §1–2 and the inventory.

#### Found, not fixed

- Finding B, above.
- **Focus is still not trapped** in the sheet or the prompt. Carried from
  FE-005 to FE-007.
- **Two scrims stack** when the prompt opens over a sheet. Carried from FE-007.

#### Not checked

- Screen-reader announcement of the sheets, the refusal and the prompt.
- A real touch device, and `vite preview`.
- **Hover.** This slice adds no `:hover` rule, and a test pins that. The
  controls inherit F2c's `button.action:hover` inside `@media (hover: hover)`.
- Escape with a real keyboard in Chrome. It is tested in jsdom only.
- A pixel comparison against the Frost artifact. I compared structure and copy
  from its source, and looked at screenshots.

---

### Lead verification and rulings, 2026-09-18

**`npm run verify`: 17 files, 753 tests passed**, typecheck clean, up from 624.

**The gate proven by collapsing it.** Changing `voidRule` so an unfired order's
void is no longer audited — merging `FR-H3` into `FR-H2` — failed 2 tests. The
distinction the task file warned about is enforced, not just described.
`void.ts` is a pure module the sheets ask, matching `discount.ts`.

#### Finding B is the most consequential thing found on this screen

**Every fired row body links to `?state=sheet-voidline`, which is the *Burger's*
sheet. Tapping Soda offers to void the Burger.** *Void order* likewise always
lands on a fixture order rather than the one on screen, so the panel changes
under the cashier.

Once a command exists behind it, that is **a cancellation ticket for work nobody
asked to cancel** — precisely what `B-16` exists to prevent, because paper cannot
be un-printed. The artifact does the same thing, so this was inherited rather
than introduced.

`builder10` identified it, established it was out of its bounds (`VOID_LINE_HREF`
and `ACTIONS` belong to F2a), and did not reach into committed work. Correct.

**Ruled: this becomes an acceptance criterion on F2e**, which is now four
related corrections to already-committed work and is no longer optional tidying:

1. Acting controls become `<button>` across F2a and F2b.
2. `role="alert"` on both PIN pads' failure notices.
3. F2c's sheets replace history rather than pushing it (SITEMAP §1).
4. **The panel's void paths carry the actual line and order**, opening the sheet
   as component state — which is only possible once (1) is done. That is why
   these are one job and not four.

#### Finding A — the third artifact defect, and the same shape again

**`sheet-voidorder` says *"Nothing on this order has been sent to the kitchen"*
while the panel the artifact draws beside it holds two fired rounds.** The
`data-unless` on the fired block does not list `sheet-voidorder`, so 382.725 is
the figure of an order holding fired work.

**The task file repeated the contradiction**, asserting the two order sheets show
"different orders" — wrong on the fact that matters. A data-driven gate cannot
draw that sheet over that order; over the artifact's own panel it would correctly
draw the fired variant.

**Accepted:** `sheet-voidorder` now opens over the same three lines with
**nothing yet fired**. The figures are unchanged, because firing changes no
money. That is the only order for which the sheet's own copy is true.

**All three artifact defects found by implementation have one shape:** a live
close on a stale balance (DESIGN-004), a live confirm during a lockout (F2g), and
now a sheet asserting nothing is fired beside a panel showing fired work. **Each
is a thing correct in isolation and wrong in combination**, and each was found by
building the combination rather than by reading either half. That is the review
heuristic to hand the design branch, and it is now earned three times over.

#### Rulings on the rest

**Accepted:**

- **No reason is pre-chosen in any fixture.** The artifact draws one chosen with
  Continue live, but this `?state=` *is* the in-app route — a fired row body
  opens it — so a pre-chosen reason would be **a void recorded with a reason
  nobody gave**. `FR-H4` and M-1 both say required, not optional. One tap
  reproduces the artifact's picture.
- **Two written forms per reason, and nothing lower-cased at runtime.** `label`
  for the sheet, `inline` for the prompt's running text, pinned by a test;
  a typed reason passes through verbatim and trimmed. Runtime lower-casing would
  mangle names — *"Pak Budi's BBQ order"* — which is exactly the sort of damage
  that looks fine in the one example anyone tests.
- **Continue is unavailable until an option is chosen; with *Other* chosen and
  nothing typed, Continue is live and refuses** using A7's invalid field. The
  alternative — stay disabled until text is non-empty — needs no invalid state
  but **gives no reason why**, and A7 designed that state to name the rule and
  the limit. The refusal is the better behaviour.
- **PROVISIONAL copy marked in source** for the four strings the artifact never
  draws, and focus moving into the field when *Other* is chosen.
- **`OrderScreen` lives in `OrderPanel.tsx`**, so mounting had to touch that
  file. The panel component itself is unchanged; the constraint's intent held.

#### Still carried, now three slices running

Focus is not trapped in a sheet or the prompt, and two scrims stack when the
prompt opens over a sheet. Both inherited from FE-005 and FE-007. **Neither is
acceptable at ship**; both belong with F2e's corrections or a slice of their own.
