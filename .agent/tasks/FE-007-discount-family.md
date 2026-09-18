# FE-007 — POS discount family (F2i)

**Status:** Active
**Roadmap item:** F2i
**Branch:** `agent/phase-0-foundations`
**Assigned:** unassigned — a fresh implementer, clean context

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
