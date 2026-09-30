---
id: DESIGN-009
title: POS-05 closed orders and POS-06 closed order detail in Frost, with the refund sheet, and where Close lands
category: ui
touches: [money, audit, boundaries]
depends_on: [DESIGN-008]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-009 — POS-05 closed orders and POS-06 closed order detail in Frost

**Status:** Written 2026-09-29 by `lead`. Unassigned.
**Owner:** a Codex designer on `gpt-6-astra`, effort high (agents.yaml `roles.designer`),
opened in its own pane by the lead with the model passed explicitly.
**Branch and place:** `agent/design-009`, cut from `development`, in the worktree
`../restaurant-pos-wt/DESIGN-009`. Touch nothing under `apps/`, `packages/` or `db/`,
and nothing in the main checkout at `../restaurant-pos`.

## Objective

Every POS screen except POS-05 and POS-06 now has a Frost artifact and is built. These
two have wireframes only (`docs/design/prototype/pos/closed-orders.html` and
`closed-order.html`), so the code slice that builds them (F4e) cannot start. When this
task is done, both screens exist as Frost artifacts that a builder can build without
asking a question: POS-05 finds a closed order, POS-06 shows what was charged, reprints
the receipt and refunds the whole order through the refund allocation sheet (M-5) and the
manager approval prompt (M-1). The task also settles one live conflict, where Close on
settlement lands, and closes five small design questions that earlier code slices raised.
A design review follows before any code is built from it.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. `docs/design/SCREEN-INVENTORY.md`:
   - Conventions, `:16–41`;
   - POS-05, `:427–447`;
   - POS-06, `:449–490`;
   - M-1 manager approval, `:894–926`;
   - M-5 refund allocation sheet, `:964–968`;
   - rulings I-1, I-4 and C-1 in the table from `:984`;
   - POS-02, `:85–122`: *returned to after close* is at `:91`.
2. `docs/design/SITEMAP.md` `:192–227`. That is the POS-05, POS-06 and M-1 tree, and the
   rule that POS-03 owns void and POS-06 owns refund.
3. The wireframes `docs/design/prototype/pos/closed-orders.html` (5 states) and
   `closed-order.html` (9 states). They are the behavioral authority; Frost restyles them.
   Their money is pre-IDR (`15.59`, *GST 10%*) and must not be copied.
4. The Frost POS artifacts in `docs/design/visual-directions/frost/pos/`, and
   `docs/design/visual-directions/manifest.js`, where every artifact and state is listed:
   - `order.html`: the M-1 states `approval`, `approval-error`, `approval-throttled` and
     `approval-denied`, and the fired-line void's *Reason — required* list;
   - `settlement.html`: the totals block, and the Close links at `:298–299` and `:368`;
   - `floor.html`: the POS-05 entry point at `:51`, currently the wireframe;
   - `incidents.html`: the receipt-class incident and the reprint results from DESIGN-008;
   - `lock.html`: the floor link at `:72`.
5. The Frost system: `docs/DESIGN.md` and `docs/design/tokens/frost.css`. Use registry
   tokens only.
6. The contract, for the rules below:
   - `docs/PRD.md`: FR-G7, FR-G8, FR-G11, FR-H1, FR-H5, FR-H5b, FR-H6, FR-H7, FR-E6,
     FR-A6, FR-J2, FR-J3, and AC-11, AC-13, AC-14, AC-25;
   - `docs/BOUNDARIES.md`: B-9, B-10, B-14, B-19, B-20, B-23.

## Part A — POS-05, closed orders

Create `docs/design/visual-directions/frost/pos/closed-orders.html`, built the same way
as the other Frost POS artifacts. Add it to `manifest.js`, and point `floor.html`'s entry
at it.

**States.**
- The wireframe's five: `default`, `empty`, `loading`, `error`, `overflow`.
- Add `nomatch`: a search that finds nothing. It is not the same as `empty`, which means
  no closed orders exist this business day.
- Add `dayclosed`. See rule A4.

**Rules to draw, not decide:**

- **A1. Search is by table, time and amount only (ruling I-1).**
  - Receipt numbers are not a search key and are not displayed anywhere. The numbering
    format is an open product question.
  - Draw how each of the three filters is set on a touch screen at 1280×800 with no
    physical keyboard.
- **A2. A refunded order is marked distinctly (FR-H6, B-10).** A zero-total order is a
  real closed order and appears in the list (FR-G11).
- **A3. The list is scoped to the open business day (inventory).** Overflow scrolls, the
  search bar stays put, and rows keep a touch-size target.
- **A4. `dayclosed`: this is a question, and yours to answer.** The floor's `dayclosed`
  banner says *orders from the closed day can no longer be voided or refunded*. That
  implies a cashier can still see them. But the list is scoped to the open business day.
  Draw what POS-05 lists after the day closes, and argue it in the Handoff from FR-H7,
  FR-G7 (a reprint still works) and ruling I-4. Candidates:
  - the closed day's orders, marked, with reprint only;
  - the new day's list, empty until the first close.
- **A5. Quick sales** are named as the floor and order workspace name them, not with the
  wireframe's *COUNTER*.

**Fixtures.** Use IDR, bare (no `Rp`, amounts in `100.000` form), with 24-hour `HH:MM`
times. Reuse orders that `settlement.html` already closes wherever you can, with the same
totals and tenders. The list must include at least these six:
1. the AC-25 case in IDR: a cash sale with change, whose effective contribution is less
   than the note handed over;
2. a card-plus-cash split;
3. a custom-named tender (FR-G1);
4. a zero-total comp;
5. a refunded order;
6. a quick sale.

## Part B — POS-06, closed order detail, with M-5 and M-1

Create `docs/design/visual-directions/frost/pos/closed-order.html` and add it to
`manifest.js`. Each POS-05 row links to its detail.

**States.** Start from the wireframe's nine: `default`, `zero`, `refunded`, `dayclosed`,
`sheet-refund`, `approval`, `reprint`, `loading`, `error`. Name the rest as you see fit,
and draw at least these cases:

- **Reprint results.** There are three:
  - a printed result;
  - a *FAILED* result;
  - an *UNKNOWN* result.

  The two failures are the receipt class, never the kitchen emergency (FR-E6, AC-23). The
  failure links to `incidents.html`, drawn consistently with DESIGN-008's reprint results.
  Live copy for a reprint the client sent reads `Reprint sent`, with no time. Keep a
  printed time only in a fixture that pictures the server's answer.
- **The refund sheet (M-5).** It needs four cases:
  - the default allocation;
  - the AC-25 default, where cash back equals the effective contribution, not the note;
  - an allocation the manager has edited that still sums exactly;
  - an allocation that does not sum, where the step forward is blocked and the copy says
    why.
- **The approval (M-1) over POS-06.** The prompt names the refund, its amount and the
  reason. Do not redraw M-1's error, throttled and denied states. Link to `order.html`'s,
  and say in the Handoff that they apply unchanged.
- **Cancel.** Say where cancelling the approval returns the manager (to the sheet with its
  allocation kept, or to the detail). Cancel writes nothing to the order (B-20) and is
  audited with a null approver (FR-J3, AC-18). The audit record is not drawn; say that it
  exists.
- **After a successful refund.** The order is `REFUNDED`, and the screen says so.
- **A refund command that fails.** Nothing is written (B-20). Say what the manager can do
  next.
- **The business-day-closed refusal at the moment of the attempt** (ruling I-4). It is
  distinct from the standing `dayclosed` state.
- **`overflow`.** A long order, with the figures pinned.

**Rules to draw, not decide:**

- **B1. Full-order refunds only (FR-H5, B-23).** No line selection and no partial-amount
  field.
- **B2. A zero-total order has no Refund action at all**: absent, not disabled (FR-H5b,
  ruling C-1).
- **B3. Allocation.**
  - It defaults to each tender's effective contribution, tendered minus change (FR-H5,
    AC-25).
  - It must sum exactly to the order total.
  - The manager may change it (*selected by the manager*, FR-H5).
  - Draw how an amount is edited on touch, and how a custom-named tender appears.
- **B4. Manager PIN and a required reason (FR-H5, FR-A6).** One combined audit entry
  names the actor, the approver, the reason and the order (FR-J2, FR-J3, AC-11).
  - Reuse the reason pattern from `order.html`'s fired-line void: presets plus
    *Other — type a reason*.
  - The wireframe's refund presets are fixture copy. The PRD names no list, so say so in
    the Handoff.
- **B5. `REFUNDED` is terminal (FR-H6, B-10).** A second refund is not offered.
- **B6. POS-06 has no void action and POS-03 has no refund action (FR-H1, B-19).**
- **B7. A reprint shows identical figures (FR-G7, AC-13).** Nothing is recomputed from
  today's settings.
- **B8. POS-06 shows what was charged, not a receipt.**
  - Receipt content and fiscal requirements are an open product question (PRD §9).
  - Draw no receipt layout, receipt number or fiscal field.
  - Draw no post-close correction control; post-close corrections are also open.
- **B9. The approval is a modal over POS-06, never a route or a mode (B-14).** It
  authorises this one refund.
- **B10. Totals.** Take the totals block from `settlement.html` (subtotal, discounts,
  service charge, total), not from the wireframe's *Includes GST* lines.

## Part C — where Close lands

This is a live conflict.
- `settlement.html`'s Close links to POS-06 (`:298–299`, still the wireframe).
- The inventory says the floor is *returned to after close* (`SCREEN-INVENTORY.md:91`).
- The code today lands on the floor and replaces the history entry, so Back does not
  return to a closed order.

1. Recommend one answer and argue it in the Handoff. Weigh at least these three points:
   - what the cashier does next after a close;
   - where a failed receipt print on close is seen (FR-G8, and the floor's
     `receipt-warning` chip);
   - that POS-06 is otherwise reached only from POS-05.
2. Point `settlement.html`'s Close links (`:298–299`) and *Back to floor* (`:368`) at the
   Frost artifacts that match your recommendation. Point `lock.html:72` at the Frost floor.
   After this task, no Frost artifact links to `docs/design/prototype/`.

The lead rules on the recommendation at review, before any code changes.

## Part D — five questions from earlier slices

Answer each in the Handoff. Change an artifact only where the answer needs it, and name
each change.

1. **An open quick sale has no place on the floor.** A quick sale is the same order model
   as a table (FR-D2), yet once opened it can only be reached from inside it. Draw where an
   open quick sale appears on `floor.html`, or argue that it needs no place.
2. **Units or lines.** Table 9's floor tile reads *5 items*, counting units. The order
   panel reads *2 items*, counting lines. Choose one convention for both, and give the
   copy.
3. **The derived *1 line pending* copy on the floor.** Confirm it or give the exact
   replacement.
4. **The order bar.** `order.html` draws an `h1` (*Table 7*), a tag and the actor in the
   order bar, and a *Release* control. The build shows only `← Floor`, because Release
   waits on the actor session (FR-A).
   - Say which of the four elements the order bar needs.
   - Say whether POS-05 and POS-06 carry the same header.
   - Keep the header consistent across the three screens.
5. ***Nothing outstanding* appears twice** in `incidents.html` when every incident is
   cleared: once in the empty composition, once in the status line. Keep one.

Also add one line to `docs/DESIGN.md`: the MVP ships light only, and the dark palette is
deferred. It currently reads as open.

## Constraints

- **No new tokens.** Use registry tokens only. If a value has no token, raise it; do not
  add one.
- **No code.** Nothing under `apps/`, `packages/` or `db/`.
- **No contract edits.** Do not edit the four product documents or an accepted ADR.
- **Audit and gating are the owner's contract (FR-J3, FR-G14).** Raise any question
  about whether an action is audited or gated; never rule it.
- **Do not draw a verifying-state cancel for M-1.** The owner's ruling on it is
  unconfirmed. If your flow needs it, raise it.
- **Do not invent controls the PRD does not grant.** This covers partial refunds, a
  refund note beyond the required reason, receipt-number search, and any card-terminal
  step. External terminals are out of scope in the PRD.
- **No other state of an existing artifact changes appearance** unless the Handoff names
  it and says why.
- **Measure in a browser at 1280×800**, not by arithmetic. A browser is a sandbox
  escalation; ask the owner through the lead.

## Tests expected to change

None. This task changes no code. If `npm run verify` is affected by anything you
touched, stop and raise it.

## Acceptance criteria

1. `closed-orders.html` exists with at least the seven states of Part A, and
   `closed-order.html` with every case listed in Part B. Both are in `manifest.js`, and
   both use registry tokens only. Red if a Part B case is missing or a raw colour, size or
   weight appears.
2. Every rule A1–A5 and B1–B10 is visible in some state, and the Handoff maps each rule to
   the state that shows it. Red if a rule has no state.
3. The AC-25 fixture defaults its refund to the effective contribution. The Handoff shows
   the arithmetic: tendered, change, contribution, total. Red if the default equals the
   note handed over.
4. The zero-total order's detail has no Refund element in the DOM. Red if a disabled or
   hidden Refund button exists.
5. No receipt number and no void control appears on POS-05 or POS-06. Red if either does.
6. Every link in the five existing Frost POS artifacts and the two new ones resolves to an
   existing Frost artifact state. `grep -r "prototype/" docs/design/visual-directions/frost/pos`
   returns nothing. Red on any wireframe link or dead state. (Corrected by the lead on
   2026-09-30 at design009's request: the grep first covered all of `frost/`, but the two
   back-office artifacts hold 51 wireframe links and the back office is out of scope here.
   Leave them untouched; they are owed to the back-office design task.)
7. Part C has one recommendation with its argument, and the Close links match it.
8. Part A's question A4 and all five Part D questions have an answer in the Handoff, and
   each artifact change they caused is named.
9. At 1280×800 nothing is clipped; `overflow` scrolls with touch-size targets. The
   Handoff says how it was measured.
10. The Handoff lists every question raised and not ruled, each with a proposed answer.

## Out of scope

- Building anything. F4e builds these screens after the review and the lead's rulings.
- The back office, including the BO-13 incidents screen and its reprint.
- Receipt layout, receipt numbering and fiscal content (PRD §9).
- The dark palette.
- Changes to M-1's own states, which are drawn in `order.html`.
- `DESIGN-007`'s `fireerror` wording, and the design task files under `.agent/tasks/`.
  Both are the lead's.

## Reporting

Commit on `agent/design-009` only when done, and never push. Append your Handoff below:
- what you drew and where;
- each rule-to-state mapping;
- the Part A4, C and D answers;
- what you measured and how;
- every question raised, each with a proposed answer.

Then run `herdr agent prompt lead "<your name>: DESIGN-009 done — <one line>"`, or
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

