# FE-003 — POS order panel (F2a)

**Status:** Done 2026-09-17, lead-verified. Awaiting the owner's look.
**Roadmap item:** F2a, first of three slices
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder5`

---

## F2 is three tasks, and this is the first

The roadmap calls F2 "the POS order workspace — menu grid, running order, three
line signatures, 86'd tiles". The lead counted what that screen actually is
before assigning it: **the Frost fixture is 664 lines and carries about
twenty-six states.** FE-001 was one screen with eight states and produced 114
tests. F2 as one task is not a reviewable slice; it is three sessions pretending
to be one, and the owner's rule is that a task needing two sessions is two tasks.

| Slice | What it covers |
|---|---|
| **F2a — this task** | The running order panel: fire-round groups, the three line signatures, the money column, totals, and the two settlement locks |
| F2b | The menu grid: tiles, categories, 86'd tiles disabled in place, quick sale |
| F2c | The sheets, the approval PIN flow, and the fire-error states |

This slice is first because it carries the rulings. `I-12` lives here, the A7
round tag lands here, and this is **the first screen in the repository with
money on it**.

---

## Objective

The POS order panel renders at 1280×800 on the Frost tokens, in six fixture
states, with the three line signatures visually distinct and the settlement
locks rendering the panel inert but readable.

---

## Required inputs

1. **`docs/design/visual-directions/frost/pos/order.html`** — the Frost fixture,
   on `agent/design-direction`, in the worktree at `../restaurant-pos-design`.
   Your reference for structure and appearance. Read the panel region; you can
   ignore the menu grid and the sheets, which are F2b and F2c.
2. **`docs/design/SCREEN-INVENTORY.md` §POS-03**, same worktree — and in
   particular **ruling `I-12`**, quoted in the implied-rulings table. Read it in
   full. It is long because it is load-bearing, and this task is mostly its
   implementation.
3. **`docs/design/visual-directions/frost-states.css`** — on **this** branch now.
   The pressed-ring rules, including the order-line rule at line 58.
4. **`.agent/tasks/FE-002-apply-a7-states.md`** on this branch — what A9 landed
   and how it was verified. Its shape is the standard for your handoff.
5. **`apps/pos/src/pos.css`** and the three tests under `apps/pos/test/`.

---

## What to build

### The six states

Fixture states hang off `?state=` exactly as FE-001's do.

| State | What it shows |
|---|---|
| `default` | A populated order: two fire rounds of FIRED lines, plus PENDING lines not yet fired |
| `empty` | No lines yet |
| `overflow` | Enough lines to scroll the panel, so the totals and the close bar stay put |
| `pressed` | A FIRED line body held down — the A7 ring, statically, because a fixture cannot hold a finger |
| `lock-draft` | Settlement lock: payment started. Panel read-only, tag reads `FINISH PAYMENT FIRST` |
| `lock-lease` | Another client holds the order. Panel read-only, tag reads `ANOTHER CLIENT` |

### The three line signatures — this is `I-12`, do not improvise it

A row's trailing slot carries **exactly one meaning**.

1. **A PENDING line** has a remove control in its trailing slot. One tap, no
   prompt, nothing written (`FR-H2`, `AC-3`).
2. **A FIRED line reserves the same slot and leaves it empty** — absent, not
   disabled. Its void is reached by tapping the **row body**, which in F2c opens
   the reason-and-PIN sheet (`FR-H4`). In this slice the row body is a link to a
   sheet that does not exist yet; point it at the fixture URL and say so.
3. **Under either settlement lock, every slot is empty and no row is a control.**
   That is `I-12` holding, not a fourth signature. `FR-G12` and `FR-G13` block
   void, and `FR-H1` scopes void to an open order *or to lines on one*, so
   removing a PENDING line is a void too and is blocked with it.

**The reason, because an implementer who knows it will not quietly simplify it:**
a single control that is silent on one row and PIN-gated on the row above it
teaches a reflex that is correct most of the time, and `B-16` means paper cannot
be un-printed. The empty slot also keeps the money column aligned across row
types.

**Structural requirement, and DESIGN-002 pass 3 found this the hard way:** the
trailing slot must be a **sibling** of the row's tap target, never inside it. An
earlier draft made the fired row one anchor that swallowed the reserved slot,
violating `I-12` in its own markup. **Carry the guard test across**: assert no
trailing slot has an anchor ancestor.

### Locks render inert, not absent

Chosen deliberately: `C-1` removes a control that is permanently impossible, but
a lock is temporary and each variant has a real route out. `FR-G13` blocks no
reads, so **the rows must stay legible** — a read-only panel, every trailing
slot empty, the lock reason on the group header. Do not grey the text into
unreadability and do not remove the rows.

### The round-group header carries the tag

Lines group by fire round with the round's time and print status in the header
(`I-7`), so a cashier can answer "did this go to the kitchen?" without asking.
The header — not each row — carries the tag: `MANAGER TO VOID`, or the lock
reason under a lock.

**The tag is `--frost-round-tag-size`, 13px.** This is one of A7's four designed
tokens and this screen is why it exists: the fired row's slot is deliberately
empty, so the tag is the *only* visible statement that tapping the row opens a
PIN-gated path, and `docs/DESIGN.md` says nothing a cashier must act on sits
below 13px. It was 10px and that was `design-reviewer` finding 6.

Note the fixture sets `margin-left:auto` on the tag as an **inline style**. Do
not copy an inline style into the app; give it a class.

### Money — the first money in this repository's frontend

`apps/pos` has never imported `@pos/money`. It does now, and there is a trap
waiting that `builder2` found and measured:

**`formatMoney` returns `15590`, not `Rp 15.590`.** Grouping and the symbol are
the frontend's job. Use `Intl.NumberFormat('id-ID', …)` and **pass the `bigint`
straight in.** Wrapping it in `Number()` first silently loses precision —
`9007199254740993` renders as `…992`. That is a `B-1` violation by a shorter
route, and money is never a `number`.

**Write a test that fails if a `Number(` call appears anywhere in `apps/pos/src`
around a money value**, in the spirit of the existing `no-invented-values` and
`console-free` checks. A rule nothing checks is a rule an agent in a hurry will
break.

### The pressed ring on an order line — the ruling, already made

`frost-states.css:58` rings a pressed line with
`border-radius: 2px; margin: -8px; padding: 8px` so the ring clears the text
without moving it. Those are literal lengths and `no-invented-values.test.ts`
rejects them. **Do not add an exemption.**

DESIGN-005 gives the token form, and the lead has ruled it in:

```css
margin: calc(-1 * var(--frost-space-2));
padding: var(--frost-space-2);
border-radius: var(--frost-radius-surface);
```

`--frost-space-2` is 8px and `--frost-radius-surface` is 2px, so this is the
same rendering by a route the checker accepts.

**The ruling comes with a condition.** Reusing a spacing token here is correct —
the states sheet derives the offset from the row's own padding, so it *should*
track the spacing scale — but it creates a coupling nothing watches. If
`--frost-space-2` is ever retuned for layout, the ring silently crosses the 12px
gap into the trailing slot, and `I-12` breaks on screen with no test failing.

**So: add a test pinning the relationship.** The offset must stay within the
row's padding and short of the gap to the trailing slot. Same move as
`hover-scoped.test.ts`, same reason — an invisible coupling becomes a checked
one. If you find the test awkward to write, raise it; do not drop it.

The ring must ring **the tap target only** and stop short of the trailing slot.
That is `I-12` made visible, and it is the thing to check in a browser.

---

## Constraints

- **No invented values.** `no-invented-values.test.ts` forbids any colour, any
  length but `1px`, and any numeric font size, weight, line height or tracking
  in `apps/pos/src`, plus any `var(--frost-*)` absent from the registry.
- **Every hover inside `@media (hover: hover)`.** `hover-scoped.test.ts`
  enforces it and will fail you. Touch browsers hold `:hover` after a tap; on a
  menu tile that leaves it looking selected, and on an order line it is the same
  class of lie.
- **Nothing behind this is real.** No fetch, no storage, no console —
  `console-free.test.ts` enforces it. Fixtures only.
- **Do not edit `frost-states.css`, the fixture, or any contract document.** If
  a rule cannot be applied as written, say so in the handoff. Adjusting a
  reviewed design artifact to fit the code is the lead's call, not yours.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.** Your handoff goes
  in this file.
- **Stop at the panel.** No menu grid, no sheets, no PIN flow. An implementer
  that starts F2b has ended its task and should say so.

---

## Acceptance criteria

1. All six states render at 1280×800 and are reachable by `?state=`.
2. A PENDING row has a remove control; a FIRED row's slot is reserved and empty;
   under both locks every slot is empty and no row is a control.
3. The guard test passes: **no trailing slot has an anchor ancestor.**
4. The round header carries the tag at `--frost-round-tag-size`, with the lock
   reason substituted under a lock.
5. A pressed line rings the tap target only, stopping short of the trailing
   slot. **Verified in a browser with the press held**, not inferred from CSS.
   FE-002's handoff describes how to hold `:active`; reuse the method.
6. The offset-coupling test exists and has been seen to fail when the offset is
   widened past the gap.
7. Money renders as grouped IDR from a `bigint`, and a test fails on `Number()`
   applied to money.
8. `npm run verify` passes. FE-002 left 120 tests across 9 files; state the new
   count.
9. Typecheck clean.

---

## Out of scope

- The menu grid, categories, 86'd tiles, quick sale — **F2b**.
- Every sheet, the approval PIN flow, `fireerror`, `fireblocked`, `error` — **F2c**.
- Any real data, server call, or persistence.
- Merging anything.

---

## Handoff

Write your handoff here when the work is done. Name the command and the URL the
owner opens, and the `?state=` values. Say what you found and did not fix. If a
check was skipped, say which and why — "should work" is not a result, and the
lead verifies with `git log` and a browser rather than by reading this section.

### 2026-09-16 — implementer (claude, Opus 5)

**Not committed.** Nothing was committed, per instruction; `git log` shows
nothing from this task. Working tree on `agent/phase-0-foundations`:

- modified: `apps/pos/src/pos.css`, `apps/pos/src/main.tsx`,
  `apps/pos/src/icons.tsx`, `apps/pos/package.json`, `package-lock.json`
  (one line, from `npm install --offline` after adding `@pos/money`)
- new: `apps/pos/src/OrderPanel.tsx`, `apps/pos/src/orderFixtures.ts`,
  `apps/pos/src/money.ts`, `apps/pos/test/order-panel.test.tsx`,
  `apps/pos/test/order-line-ring.test.ts`, `apps/pos/test/money-display.test.ts`

`.agent/MEMORY.md` and `.agent/ROADMAP.md` were already modified when I started.
I did not touch them. `frost-states.css`, the fixture, the registry and every
contract document are unedited.

#### What the owner opens

```
npm run dev -w apps/pos        # http://127.0.0.1:5173/pos/order
```

`?state=` values: `default`, `empty`, `overflow`, `pressed`, `lock-draft`,
`lock-lease`. In dev, links to all six sit under the frame. The lock screen
stays at `/pos/` with its own states. `main.tsx` picks the screen from the
path, with no router. A Vite server for this checkout was **already running on
5173** (pid 31567, not mine, the same one FE-002 found). I used it and left it
running.

To see I-12 by hand at `?state=default`: hold down a fired row, then the
pending Steak row, then its ×. The × links to `?state=default&gone=steak`,
which removes the line and shows the artifact's default-state totals.

#### Done, against the acceptance criteria

1. **Six states at 1280×800, reachable by `?state=`.** Measured in Chrome: the
   device box is 1280×800 in every state, and the close bar's bottom edge is at
   800. Unknown states fall back to `default`.
2. **The three line signatures (`LineRow` in `OrderPanel.tsx`).**
   - A PENDING row puts one `a.order-line__remove` (aria-label
     `Remove <name>`) in its slot.
   - A FIRED row leaves its slot as an empty `div` (no children), and its row
     body is `<a href="?state=sheet-voidline">`.
   - A VOIDED row (overflow, Caesar Salad) is struck through. Its body is a
     `div` and its slot is empty.
   - Under either lock every body is a `div` and every slot is empty. Chrome
     counted **0** `a`/`button` inside `.order-lines` in both lock states.
3. **Slot guard** (`order-panel.test.tsx`): in all six states, no
   `.order-line__slot` has an anchor ancestor, and every row's children are
   exactly `[target, slot]`. The detector also has self-tests on the two bad
   shapes: a slot inside the target anchor, and a whole row inside an anchor.
4. **Round-header tag.** `.round-head__tag { font-size:
   var(--frost-round-tag-size) }`, which computes to 13px in Chrome.
   - Unlocked: `MANAGER TO VOID` on fired rounds, `REMOVE FREELY` on pending.
   - Locked: `FINISH PAYMENT FIRST` or `ANOTHER CLIENT` on every header,
     pending included.
   - The artifact's inline `margin-left:auto` is now a class, and a test pins
     that.
5. **Pressed ring, verified with the press held** (details below).
6. **Offset-coupling test** (`order-line-ring.test.ts`). It works from
   `pos.css` and the registry:
   - reads the ring rule's `padding: var(X)` and `margin: calc(-1 * var(X))`
     for both `a.order-line__target:active` and
     `.order-line__target.is-pressed`
   - looks up X, `.order-line`'s `padding` token and its `gap` token in the
     registry
   - asserts `offset ≤ min(row padding)` and `offset < gap`

   **Seen red:** with the offset set to `--frost-space-4` (16px), both clearance
   tests failed (`"clears": false`, `2 failed | 7 passed`). With
   `--frost-space-3` (12px, equal to the gap), both failed again. Restored
   byte-identical, then green.
7. **Money.** `money.ts` has `formatAmount(m: Money)`, which passes the bigint
   straight to `Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })`.
   Every fixture amount is a bigint literal (a test checks the type of all
   64). `money-display.test.ts`:
   - fails on `Number(`, `parseFloat(`, `parseInt(` or `Number.parse*(`
     anywhere in `apps/pos/src`, outside comments, and has detector self-tests
   - checks that `9_007_199_254_740_993n` renders `9.007.199.254.740.993`, and
     that the `Number()` route renders `…992` on this machine
   - has an `@ts-expect-error` proving a `number` is rejected

   **Seen red:** changing `idr.format(m)` to `idr.format(Number(m))` failed
   both the detector (`["Number("]`) and the exactness test. `tsc` did **not**
   catch it, because `Number()` accepts a bigint, so the test is the only
   guard. Restored, then green. I also confirmed the slot guard goes red: with
   the fired row as one anchor wrapping its slot, `no trailing slot has an
   anchor ancestor` failed in `default`, `overflow` and `pressed`.
8. **`npm run verify`: 12 files, 213 tests passed** (from 9 files and 120). The
   93 new tests:
   - 56 in `order-panel.test.tsx`
   - 16 in `money-display.test.ts`
   - 9 in `order-line-ring.test.ts`
   - 12 from `no-invented-values` picking up the three new `src` files

   `hover-scoped` now has real rules to check: four order-panel hovers, all
   inside `@media (hover: hover)`.
9. **Typecheck clean** over server, money and pos (part of `verify`).
   `npm run build -w apps/pos` also succeeds.

#### How the press was held

FE-002's method, reused. The Chrome tool only clicks, so I ran installed Google
Chrome (`--headless=new`) over the DevTools Protocol against the dev server:
1400×1000 viewport, DPR 2, `Input.dispatchMouseEvent mousePressed` held for
150ms. While held I read `:active`, computed style and `getBoundingClientRect`
and took a screenshot, then released away from the target. I looked at the
screenshots myself.

| Held | `:active` | box-shadow | Ring right edge → slot | Ring inside row (top / left) | Text moved |
|---|---|---|---|---|---|
| Soda (fired) body | true | `rgb(3,33,37) 0 0 0 2px inset`, margin −8px, padding 8px, radius 2px | **4px short** | 2px / 8px | 0 |
| Burger (fired, two-line) body | true | same | **4px short** | 2px / 8px | 0 |
| Steak (pending) body | true | same | **4px short of the × control** | 2px / 8px | 0 |
| Steak × control | true | `rgb(155,53,44) … inset` (brick). The body beside it: `none` | — | — | — |
| Void order action | true | ink inset | — | — | — |
| `lock-draft` / `lock-lease`: fired body, pending body, Settle (unavailable) | true | **`none`** in all six. The URL did not change on release | — | — | — |

4px is the 12px gap minus the 8px offset, which is what the ruling predicts.
The screenshots show the ring closing around the row body and stopping clear of
the × box. The static `?state=pressed` Soda row measured the same box as the
real held press: x 829, width 375, right edge 1204, slot at 1208. In
`overflow`, `.order-lines` scrolls, and the totals and close bar kept identical
boxes after scrolling to the bottom. Console output across the run was only
`[vite] connecting/connected` and React DevTools info, with no errors.

Evidence (`press-order.mjs`, `shots/*.png`, `shots/results.json`) is in this
session's scratchpad, `/private/tmp/claude-501/…/f0a5104a-…/scratchpad/`. It
is temporary and **not in the repo**.

#### Not checked

- **Focused and pressed on the new controls.** `pos.css` has the combined
  `var(--frost-focus-ring), var(--frost-pressed-ring)` rule for the row body,
  ×, and actions, mirroring FE-002. I did not verify it in a browser. Space
  does not activate a link, so FE-002's keyboard method does not carry over,
  and I did not try Enter.
- **A real touch device.** Mouse in headless Chrome only. While the mouse was
  held, the hover underline on the name also showed (headless reports
  `hover: hover`). On touch, the media query should gate that out, but it was
  not device-tested.
- **Built preview at `/pos/order`.** Dev-server SPA fallback was checked (200,
  rendered). `vite preview` was not run.

#### Where I departed from the artifact, and why. Each is a lead call

1. **`default` has a PENDING line; the artifact's `default` does not.** The task
   requires one. I used the artifact's own locked-state order (Burger, Soda,
   pending Steak), so its figures (405.000 / −40.500 / 18.225 / 382.725 /
   33.136) are reviewed ones. Removing the Steak lands exactly on the
   artifact's `default` figures. `pressed` is the same order with Soda held.
2. **Overflow round headers read `· printed`.** The artifact's overflow headers
   omit print status. I-7 and this task say the header carries it, so I added
   it.
3. **Literals with no token were omitted, not approximated:**
   - totals row padding `3px 0`
   - grand total `margin-top: 6px`
   - the empty notice title's `700` weight (now semibold 600) and its 6px gap
   - the head's 10px gap (invisible, because the count uses an auto margin)

   Totals rows sit about 6px tighter overall than the artifact. Each omission
   is commented in `pos.css`.
4. **No currency symbol.** The task says the symbol is the frontend's job, but
   the reviewed artifact sets every amount as a bare figure (`135.000`), so I
   followed the artifact. Negatives use U+2212, as the artifact draws.
5. **The pending round header is not tinted.** `visual.css` defines
   `.roundhead--pending` and the registry has `--frost-pending-surface`, but
   `order.html` never applies the class. I left it untinted.
6. **Under a lock, the route out is not on screen.** The artifact puts the lock
   notice ("Finish this payment first" / *Back to payment*, "Another client…" /
   *Manager: take over payment*) in the menu region, which is F2b's. The panel
   alone shows only the tag. **F2b must place that notice, or a locked panel
   has no visible way out.**
7. **The header bar and menu region are empty**, held at artifact geometry
   (64px bar, 460px panel).
8. **Destinations that do not exist yet.** Row bodies and actions link to
   artifact state names (`sheet-voidline`, `sheet-line`, `sheet-discount`,
   `sheet-voidorder`, `fireerror`). Those fall back to `default` today.
   **Settle's `?state=settle` is my name.** The artifact links to
   `settlement.html`.
9. **The × is a link to `?gone=<id>`, as in the artifact, not a button.** It
   honours only removals the artifact has figures for: one line at a time. It
   is ignored under a lock, and a test pins that.
10. **VOIDED rows are drawn** (overflow). SCREEN-INVENTORY lists them as the
    third line signature; this task's list does not name them.
11. **`pressed` holds only the fired row.** The artifact's `pressed` also holds
    Void order, Settle, a category and a tile. The last two are F2b's, and the
    task names only the line.

#### Found, not fixed

1. **The `Number(` check is blunt and still bypassable.** It bans the calls
   across all of `src`, not only "around money". It does not catch unary `+m`,
   an aliased `const N = Number`, or `Math.*` on a bigint (which throws anyway).
   Type-level `Money = bigint` catches most of the rest, but not `Number(m)`.
2. **Two-line rows ring shorter than the row.** The target's
   `min-height: 52px` is border-box, so while pressed the ring is 52–55px tall
   inside a 77px row. It still clears the text and stays inside the row
   (measured). This is the same geometry as `frost-states.css`, not a new
   decision.
3. **Rows are 77px, not 72px.** The 56px slot plus 10px padding each side and
   the 1px divider sets the height. The structure sheet already says "a line
   that grows to 76px to hold it".

---

### Lead verification and rulings, 2026-09-17

**Run and read, not taken from the handoff.**

- **`npm run verify`: 12 files, 213 tests passed**, typecheck clean. Matches.
- **All three new guards proven red by the lead**, each by injecting the defect
  it claims to catch:
  - *Offset coupling.* Widening the ring offset to `--frost-space-4` failed the
    clearance assertions, `2 failed | 7 passed`. The ruling is enforced, not
    merely written down.
  - *Money.* Rewriting `idr.format(m)` to `idr.format(Number(m))` failed both
    the detector and the exactness check, `2 failed | 14 passed`. Worth knowing:
    **`tsc` does not catch it**, because `Number()` accepts a bigint. The test
    is the only guard.
  - *`I-12` structure.* Wrapping a whole row in an anchor failed
    `no trailing slot has an anchor ancestor` in three states. That is exactly
    the defect DESIGN-002 pass 3 found by hand; it now fails automatically.
- **Two screenshots opened and looked at.** The held pending row rings the body
  and **stops clear of the × box** — `I-12` made visible, which is the thing
  that could not be proven from CSS. `lock-draft` renders every trailing slot
  empty with no control in any row, the lock reason on every header, and the
  rows fully legible: inert, not absent, as ruled.

The implementer reused FE-002's held-press method over the DevTools Protocol
and reported clearances of 4px, which is the 12px gap minus the 8px offset —
the number the ruling predicts, arrived at by measurement.

#### Rulings on the eleven departures, all of which were correctly raised

**Accepted as better than the instruction:**

1. **A PENDING line in `default`.** The task required one and the artifact's
   `default` has none, so it borrowed the artifact's own locked-state order.
   Removing the Steak lands exactly on the artifact's published figures, which
   makes the deviation checkable rather than invented.
2. **`· printed` on overflow round headers.** `I-7` says the header carries
   print status. The artifact omitted it; the ruling wins.
5. **The pending round header is left untinted.** `visual.css` defines
   `.roundhead--pending` and the registry carries `--frost-pending-surface`, but
   `order.html` never applies the class. Following the artifact over an unused
   class is right. *Carried to the design branch as a note: a defined class and
   a token that no fixture uses is either a gap or dead weight.*
9. **The × is a link honouring one removal at a time**, as the artifact draws,
   and ignored under a lock with a test pinning that.
10. **VOIDED rows are drawn.** **This one is the lead's error, not a
    departure.** This task's list of "three line signatures" named PENDING,
    FIRED and the locked case; SCREEN-INVENTORY's third signature is VOIDED, and
    the locked case is `I-12` holding rather than a signature — which this task
    file says correctly two paragraphs later and then contradicts in its own
    list. The implementer followed the inventory. Correct.
11. **`pressed` holds only the fired row.** The rest of the artifact's `pressed`
    is menu-grid, which is F2b's.

**Accepted with the cost recorded:**

3. **Five literals omitted rather than approximated**, leaving the totals block
   about 6px tighter than the artifact: totals row padding, the grand total's
   top margin, two gaps, and the empty notice's `700` weight rendered as
   semibold 600. Omitting beats inventing, and each is commented in `pos.css`.
   **The weight is the one that is not merely spacing** — it is a visible change
   to a heading. None of these is worth a designer round-trip before the owner
   has seen the screen; if the owner wants the artifact's exact totals block,
   the fix is registry tokens, not literals in `pos.css`.
8. **`?state=settle` is the implementer's name**; the artifact links to
   `settlement.html`. Fine as a placeholder. **F3 settles the real name**, and
   should correct this one when it lands.

**Accepted, and now a hard requirement on another task:**

6. **A locked panel has no visible route out.** The artifact puts the lock
   notice — *Back to payment*, *Manager: take over payment* — in the menu
   region, which this slice does not own. So the panel is correct and the
   *screen* is not yet: `lock-draft` and `lock-lease` currently strand a
   cashier. The implementer found this and refused to invent a button in the
   panel, which was the right call in both directions.
   **F2b's task file must carry this as an acceptance criterion, not a note.**
7. **The header bar and menu region are empty at artifact geometry** (64px bar,
   460px panel). Expected for a slice. F2b fills them.

**Deferred to the owner, provisionally following the artifact:**

4. **No currency symbol on any amount.** This task said the symbol is the
   frontend's job; the reviewed artifact draws every amount bare (`135.000`).
   The implementer followed the artifact and flagged the contradiction rather
   than picking silently. **Provisional ruling: follow the artifact.** Whether
   IDR shows `Rp` is one decision for every screen that displays money, not the
   order panel's to make alone, and **it should be settled before F3**, where
   money is shown to a customer at the point of payment. Raised with the owner
   2026-09-16; no answer yet.

#### Carried forward, not fixed

- **The `Number(` detector is blunt.** It bans the calls across all of `src`
  rather than only around money, and an alias (`const N = Number`) slips
  through. `+m` on a bigint throws, and `Money = bigint` covers most of the
  rest. Adequate, and the limit is stated rather than hidden.
- **Rows are 77px where the structure sheet says a line grows to 76px.** One
  pixel, from the 56px slot plus padding and the divider. Noted, not chased.
- **Focused-and-pressed was not verified in a browser** on the new controls.
  The combined focus-plus-pressed rule is there, mirroring FE-002, but Space
  does not activate a link so FE-002's keyboard method does not carry over.
  **A real gap**, small, and honestly reported. It belongs in F2b's browser
  pass, where the same control shapes recur.
