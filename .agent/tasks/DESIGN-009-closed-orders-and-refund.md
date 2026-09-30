---
id: DESIGN-009
title: POS-05 closed orders and POS-06 closed order detail in Frost, with the refund sheet, and where Close lands
category: ui
touches: [money, audit, boundaries]
depends_on: [DESIGN-008]
owns: [docs/design/**, docs/DESIGN.md]
status: review
cycles: 2
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

## Round 2 — the review's nine findings (lead and owner rulings, 2026-09-30)

Review: [DESIGN-009-review.md](../reviews/DESIGN-009-review.md), nine findings. Every one is
accepted. Keep the round-1 Handoff below as it is and add a `### Round 2` section after it that
answers each item here by number. Draw nothing beyond these items; the rule that no other state
of an existing artifact changes appearance still holds, so name every state you touch.

**Owner rulings (money and audit; draw them, do not reopen them):**

- **O1 — allocation targets (F4).** Refund allocations may use only the order's original tender
  types, as drawn. No row can be added.
- **O2 — no per-row cap (F4).** A row may exceed that tender's effective contribution; only the
  sum must equal the order total. The manager sees the split in M-1 (item 1).
- **O3 — zero rows (F4).** A row edited to 0 is dropped before the refund command and never
  recorded. Show that on the sheet (for example the row reads *not refunded*), not only in the
  REFUNDED view.
- **O4 — approved, then refused (F5).** One audit entry naming actor and approver, outcome
  REFUSED with the refusal code, no money fields. Say in the Handoff which states carry it
  (`refund-error` for a definite rejection, `day-refusal`).

**Lead rulings (design):**

1. **F1.** The M-1 subject on POS-06 lists the allocation lines (for example *Card 0 · Cash
   155.925*) and marks *Allocation edited* when it differs from the default. Add a fixture state
   for the edited case. The rest of M-1 is unchanged.
2. **F2 and Part C.** Close lands on the floor (the lead's ruling, as you recommended). Add a
   floor state `after-close` where Table 1 is free and the counts are adjusted, and a
   `receipt-warning` variant with Table 1 free; point settlement's normal Close and zero-total
   Close at `after-close`, and the failed-print Close at the free-table variant. `clear` is not a
   substitute. Existing floor states keep their appearance.
3. **F3.** Under the closed-day banner, POS-05 lists the open day's closed orders first as the
   normal, refundable list, and below them a separate group *Closed day · <date> · reprint only*.
   Draw the state with at least one new-day order. Propose in the Handoff when the banner clears;
   do not rule it.
4. **F6.** Gate the `refund-error` notice's *Review refund* on the same eligibility as the Refund
   control. Note in the Handoff that `refund-error` pictures a definite rejection only; after no
   response the client re-reads the order before offering a retry.
5. **F7.** *Apply filter* filters the list immediately; remove the separate Search step. Keep the
   no-match state reachable through the filters.
6. **F8.** Stop borrowing `--frost-pin-key-height`, `--frost-category-width` and
   `--frost-receipt-reprint-width` for POS-05. List the list-column widths and the allocation
   field width in the Handoff as missing tokens with the values you need; do not add tokens. Use
   the nearest honest existing layout (for example a flexible column) meanwhile, and say which.
7. **F9.** Omit the discount row when an order carries no discount (the `quick` state), and
   restore a screen-reader announcement when the last incident clears while keeping the visible
   message single.

Re-run your headless check for every state you touched and report it as in round 1. Commit on
`agent/design-009` when done.

## Rulings on round 2's five questions (2026-09-30)

1. **Failed-print Close (lead).** Accepted as proposed: `after-close` and `after-close-receipt`
   are the two outcomes of the one Close link. The floor shows the receipt-warning chip when the
   close result or the floor read reports an unprinted receipt. No new settlement state.
2. **When the closed-day banner clears (owner).** Accepted as proposed: the POS-02 banner and
   the POS-05 closed-day group clear together when the first POS session that displayed them
   ends (Release or the idle lock). If the day closes while the POS is locked, the next session
   shows them and they clear when that session ends. After that, POS-05 lists the open day only.
3. **Floor `dayclosed` header copy (lead).** It should name the open day
   (*Business day open · 26 Sep*) above the same banner. Not redrawn here; F4e builds it that way.
4. **Missing tokens (lead).** `--frost-closed-list-columns` and `--frost-allocation-field-width`
   are to be registered with the values proposed, then the stand-ins replaced, in a small
   designer follow-up after this task. Not in this task.
5. **O4 (owner's record).** Matches the ruling and the PRD text (FR-J3, AC-18). Nothing to do.

## Handoff

DESIGN-009 adds the Frost POS-05 and POS-06 artifacts in
`docs/design/visual-directions/frost/pos/closed-orders.html` and
`closed-order.html`. Their local `closed.css` and `closed.js` compose the
registry tokens and walkable illustrative fixtures. These files are design
artifacts, not application code: no refund, printer dispatch, authentication,
server persistence, or audit entry actually executes. Both screens and all
34 new fixture states are registered in `manifest.js`.

### What was drawn and how it works

POS-05 has the seven required states and three touch filter sheets. The table
picker includes Any, Quick sale, and the configured-table fixture choices.
The closing-time filter has From and To fields, a 24-hour numeric keypad,
delete and clear keys, and rejects invalid HH:MM or a reversed range. The
amount filter matches the exact order total in whole rupiah. Apply keeps the
chosen filter; Search applies the three filters together; Reset clears them.
No physical keyboard is necessary. Empty means no orders have closed this
business day; no match means orders exist but none match the filters.

Each row reaches its corresponding detail, retaining its displayed closing
time and tender fixture. The six primary examples are Table 1 with card and
cash, Table 7 with cash and change, Table 4 with custom-named tenders, the
refunded Table 3, a zero-total Table 6 comp, and Quick sale. No receipt number,
fiscal field, receipt layout, correction control, or void control is drawn.
The detail reads stored charged figures and original payments. It does not
recalculate history from current settings or present itself as a receipt.

The allocation sheet defaults to every original tender's effective
contribution. The original six-tender settlement fixture retains its three
separate Card contributions, Meal voucher, Staff account, and Cash. Tapping
an allocation opens a numeric editor inside the same left sheet. Keep amount
returns to the allocation summary; Cancel edit leaves that allocation as it
was. The total stays visible in the right panel. An allocation mismatch names
the exact shortfall or excess and disables Continue. No line selection or
partial-refund amount exists.

A fresh sheet requires a deliberate reason selection. The three refund
presets are illustrative copy inherited from the wireframe, not a PRD-defined
list: Wrong dish served, Customer complaint, and Charged in error. Other —
type a reason opens an on-screen alphabet keyboard with Space, Delete and
Clear. A blank or whitespace-only reason cannot proceed. The full order,
amount and chosen reason are repeated by the Manager PIN modal over POS-06.
The modal authorises this one refund; it creates no manager mode or session.
The fixture requires six entered digits before its approval key is enabled;
these are presentation interactions, not a real credential check.

The unchanged M-1 failure surfaces are directly referenced here:
[wrong PIN](../../docs/design/visual-directions/frost/pos/order.html?state=approval-error),
[approval cooldown](../../docs/design/visual-directions/frost/pos/order.html?state=approval-throttled),
and [cashier PIN refused](../../docs/design/visual-directions/frost/pos/order.html?state=approval-denied).
Their error copy, attempt limits, installation-wide throttle and denied-PIN
behavior apply unchanged over POS-06 with the refund subject substituted.
They were not redrawn or modified. There is no verifying-state cancel in this
design; the unresolved owner ruling is not assumed.

Cancel in M-1 returns to the allocation sheet with every allocation and the
reason preserved, and clears the entered PIN. It writes nothing to the order
(B-20). The server must append the FR-J3 / AC-18 cancelled-approval audit
entry naming the initiating actor and a null approver; that audit record is
not drawn. A successful refund has one combined FR-J2 / FR-J3 / AC-11 audit
entry naming actor, approver, reason and order, and returns to a detail marked
REFUNDED with the returned allocations visible. A second refund is absent.
A failed command changes nothing on the order and retains the allocation and
reason for Review refund; a fresh attempt needs a fresh manager PIN. The
`day-refusal` snapshot describes the distinct server refusal when the day
closed during the attempt, then Return to order reaches the standing
read-only state. It never offers a retry that would breach B-9.

Reprint is an outlined, ungated action. A client request displays only
“Reprint sent”, without a time or a success claim. The `reprint-printed`
fixture alone depicts a server-confirmed PRINTED result at 20:26. FAILED and
UNKNOWN results use the pale amber receipt class and link to the receipt
section of the existing Frost incidents artifact. UNKNOWN asks the cashier
to check the printer before reprinting. Every reprint retains the stored
figures, including zero, refunded and closed-day orders.

### Rule-to-state mapping

| Rule | Artifact and evidence |
|---|---|
| A1 | POS-05 `filter-table`, `filter-time`, `filter-amount` show the three touch filters. `nomatch` shows their empty result. Receipt-number search is absent. |
| A2 | POS-05 `default` includes the distinct REFUNDED marker and zero-total comp. Their rows open POS-06 `refunded` and `zero`. |
| A3 | POS-05 `default` labels the open business day; `overflow` has 36 rows in a scroll region below the fixed filters. |
| A4 | POS-05 `dayclosed` retains the just-closed day's six orders and explicitly says read-only. Every row opens a day-closed detail, including zero and refunded fixtures. |
| A5 | POS-05 `default` and POS-06 `quick` use “Quick sale”, matching the floor and workspace title. |
| B1 | POS-06 `sheet-refund`, `sheet-edit` and `approval` name the whole-order amount. No partial amount or selectable line exists. |
| B2 | POS-06 `zero` contains no Refund element, hidden or otherwise. It has only Reprint receipt. |
| B3 | POS-06 `sheet-refund` defaults card/cash, `sheet-ac25` defaults effective cash, `sheet-custom` shows configured names, `sheet-edited` sums exactly, `sheet-invalid` blocks, and `sheet-edit` draws touch entry. |
| B4 | POS-06 `sheet-refund`, `sheet-other`, and `approval` show required reason and manager PIN; the audit consequences are specified above. |
| B5 | POS-06 `refunded` names the terminal status and removes the action. Completing the walkable approval reaches the same terminal composition. |
| B6 | Every POS-06 state has no void control. POS-03 retains only its existing void paths and has no refund action. |
| B7 | POS-06 `reprint-sent`, `reprint`, `reprint-unknown`, and `reprint-printed` keep the same stored figures as `default`; the interactive reprint also preserves zero/refunded/day-closed state. |
| B8 | POS-06 `default` is labelled What was charged and displays items, payments and totals, without receipt or fiscal content. |
| B9 | POS-06 `approval` is an in-place dialog over the visible order. Cancel returns to the preserved sheet, and the PIN is not carried forward. |
| B10 | POS-06 `default` repeats settlement's subtotal 165.000, Staff meal 10% −16.500, service charge 5% 7.425, and total 155.925. `zero` uses the full 165.000 comp and no tenders. |

### Fixture arithmetic

The AC-25 case scales the same effective-contribution rule into the existing
IDR settlement `change` fixture: cash tendered 200.000 minus change 44.075
is effective contribution 155.925, exactly the order total. The default cash
refund is therefore 155.925, never the 200.000 note. The split fixture from
settlement `exactsplit` is Card 100.000 plus Cash 55.925 = 155.925. The edited
allocation is Card 80.000 plus Cash 75.925 = 155.925. The mismatch fixture is
80.000 + 55.925 = 135.925, short by 20.000.

The custom example reuses settlement `overflow`: Card 40.000 + Card 30.000 +
Meal voucher 20.000 + Card 10.000 + Staff account 20.000 + Cash 35.925 =
155.925. The zero fixture has no tenders and total 0. Quick sale matches the
workspace's undiscounted 165.000 plus service charge 8.250 = 173.250. The
long-order fixture has ten Burger/Soda pairs, subtotal 1.650.000, discount
165.000, service charge 74.250, total and Card contribution 1.559.250.

### Recommendations for A4, C and D

**A4: retain the just-closed day's orders when entering from the closed-day
floor.** FR-H7 forbids refunding them, not reading them, and FR-G7 still
requires reprinting. I-4 already gives the floor a closed-day banner and
requires an attempt-time refusal. An empty new-day list at that moment would
hide the order the cashier was just discussing. The `dayclosed` entry shows
the just-closed day with a clear read-only banner; ordinary open-day entry
continues to show the open business day. This is the narrow closed-day
exception proposed for the inventory's current scope. It does not introduce
a date search or settle historical lookup/retention for older business days.

**C: Close should replace settlement with the floor.** The cashier's normal
next task is another table or quick sale, so returning to the floor removes
an unnecessary exit from POS-06. A failed receipt print does not undo Close
(FR-G8); the existing floor `receipt-warning` chip makes the failure visible
and opens incidents. POS-06 remains a deliberate lookup from POS-05 for
reprint or refund. Both settlement Close links and Back to floor now point to
`floor.html`, and lock's successful entry points to the same Frost floor.
The builder should preserve the existing history replacement so Back cannot
return to a closed settlement. The normal Close fixture depicts the ordinary
floor; a failed-print server result uses the already-drawn `receipt-warning`
floor state. This remains a recommendation for the lead/owner at review,
not a contract or application change.

1. An open quick sale needs a visible return path. `floor.html` now has an
   Open quick sale strip with “Quick sale · 2 lines · 173.250 · Resume” linking
   to the populated `order.html?state=quick`. It appears in `default`,
   `incident`, `receipt-warning` and `overflow`, where this illustrative open
   order exists. Clear, dayclosed, empty, loading and error do not invent an
   open quick sale. The strip can contain one resume control per returned
   open quick sale; the fixture shows one and imposes no new order limit.
2. Use **lines**, meaning active order lines, excluding voided lines, on both
   surfaces. Table 9 reads “1 round fired · 2 lines”; its workspace reads
   “2 lines”. The dynamic order count now says “1 line” or “N lines”, and the
   remaining static snapshots and manifest label use the same convention.
   Quantities remain visible on each line. Print incidents retain their own
   existing ticket-description copy; this task does not reinterpret tickets.
3. Keep “1 line pending”. It counts unfired active lines, not units, and is
   consistent with the chosen convention. The floor's existing Table 1 and
   Table 12 copy is unchanged.
4. Keep all four header elements: an h1 naming the order or screen, a context
   tag, the identified actor with idle countdown, and Release. The existing
   POS-03 header already has them; POS-05 and POS-06 use the same composition.
   The tags carry the relevant context: day open/closed on the list and
   CLOSED/REFUNDED on detail. POS-03 keeps DINE IN/COUNTER as its existing
   context tags. Back leads to Floor from POS-03/POS-05 and Closed orders from
   POS-06. Release is the session behavior already designed, not a new F4e
   authentication implementation; its code dependency on FR-A remains.
5. Keep the incidents empty composition as the sole “Nothing outstanding”
   message. When the last incident is cleared, the fixture reveals that
   composition and empties the status line. Intermediate clears still use
   the status line. Reprint receipt links gained a stable `receipt-1` anchor.

`docs/DESIGN.md` now states that the MVP ships light only and the dark palette
is deferred. It also records a short DESIGN-009 component supplement and
updates the obsolete absent-screen entry to acknowledge the existing floor
and the new closed-order artifacts, explicitly pending review. No token or
registry value changed.

### Changes to existing artifacts

`floor.html` changes its Closed orders destination, carries closed-day
context through that destination, adds the resume strip in the four named
states, and changes Table 9's count in default/incident/receipt-warning and
overflow. Those four floor states have less grid height to make the quick
sale reachable; tile targets are unchanged. `order.html` changes count copy
only, with `frost-order-flow.js` keeping dynamically edited counts in sync.
The existing header, M-1 states and other appearance remain unchanged.
`settlement.html` and `lock.html` change destinations only. `incidents.html`
changes the final-clear empty outcome and adds the receipt anchor; other
incident compositions are untouched. `manifest.js` registers the new screens,
forces them to Frost in the gallery, and corrects the Table 9 state caption.
The hidden POS gallery-chrome link in `mockup.js` now says POS floor and
points to `floor.html`, replacing its pre-existing missing `frost/index.html`
destination. Back-office gallery chrome is unchanged.

### Verification and review

The owner approved headless Chrome through Playwright at 1280×800 and required
all scripts and screenshots outside the repository. Evidence is in
`/private/tmp/design009/`; no screenshot or checking script is committed.
The first pass visited all 154 declared states across the seven POS artifacts
and measured a 1280×800 document in every state, with no JavaScript errors.
It found the pre-existing hidden gallery-chrome dead link, which was fixed.
The new CSS references registry tokens only; no new raw colour, dimension or
font weight was introduced. The Impeccable static detector returned `[]` for
the two HTML artifacts and their CSS/JS.

The lead confirmed a correction to acceptance criterion 6 during this task:
`grep -r "prototype/" docs/design/visual-directions/frost/pos` must return
nothing, and all seven POS artifacts must resolve to Frost states. The two
back-office artifacts are explicitly untouched; their wireframe links belong
to a later back-office design task. The criterion itself was corrected on the
lead's branch and was not edited here.

`npm run verify` could not run its checks because dependencies are absent in
this worktree. The exact failure after the typecheck script started was
`sh: tsc: command not found`. The lead ruled that verify is `none` for the
designer role, instructed no `npm ci`, and authorised a design-only commit
once design acceptance checks pass. `docs/design/tokens/frost.css` and all
other token files are unchanged. The lead will run verify on this branch at
review. No passing application-test claim is made here.

### Final browser measurements

The confirmation pass again measured all 154 declared states at exactly
1280×800 (`documentElement.scrollWidth × scrollHeight`), with zero JavaScript
errors and zero missing-file or unknown-state destinations across the links
collected from every state, including hidden fixture chrome. The seven
artifact counts were: POS-05 10, POS-06 24, floor 9, order 58, settlement 34,
lock 7, and incidents 12. The link grep scoped to `frost/pos` returns nothing.
The token audit found 87 registry references, zero undefined references and
zero raw CSS colours, dimensions or font weights in `closed.css`.

The table records every new state. The rectangle columns use
`getBoundingClientRect()`; scroll figures are `clientHeight / scrollHeight`.
Every state below has a 1280×800 document and application rectangle
`(x=0, y=0, width=1280, height=800)`.

| Screen / state | Main scroll height / content | Sheet body height / content |
|---|---:|---:|
| closed-orders / `default` | 521 / 521 | — |
| closed-orders / `empty` | 521 / 521 | — |
| closed-orders / `loading` | 521 / 521 | — |
| closed-orders / `error` | 521 / 521 | — |
| closed-orders / `overflow` | 521 / 2592 | — |
| closed-orders / `nomatch` | 521 / 521 | — |
| closed-orders / `dayclosed` | 467 / 467 | — |
| closed-orders / `filter-table` | 521 / 521 | 565 / 565 |
| closed-orders / `filter-time` | 521 / 521 | 565 / 565 |
| closed-orders / `filter-amount` | 521 / 521 | 565 / 565 |
| closed-order / `default` | 736 / 736 | — |
| closed-order / `cash` | 736 / 736 | — |
| closed-order / `custom` | 736 / 736 | — |
| closed-order / `quick` | 736 / 736 | — |
| closed-order / `zero` | 736 / 736 | — |
| closed-order / `refunded` | 736 / 736 | — |
| closed-order / `dayclosed` | 736 / 736 | — |
| closed-order / `sheet-refund` | 736 / 736 | 565 / 565 |
| closed-order / `sheet-ac25` | 736 / 736 | 565 / 565 |
| closed-order / `sheet-custom` | 736 / 736 | 565 / 829 |
| closed-order / `sheet-edited` | 736 / 736 | 565 / 565 |
| closed-order / `sheet-invalid` | 736 / 736 | 565 / 565 |
| closed-order / `sheet-edit` | 736 / 736 | 565 / 565 |
| closed-order / `sheet-other` | 736 / 736 | 565 / 565 |
| closed-order / `approval` | 736 / 736 | — |
| closed-order / `refund-error` | 736 / 736 | — |
| closed-order / `day-refusal` | 736 / 736 | — |
| closed-order / `reprint` | 736 / 736 | — |
| closed-order / `reprint-unknown` | 736 / 736 | — |
| closed-order / `reprint-sent` | 736 / 736 | — |
| closed-order / `reprint-printed` | 736 / 736 | — |
| closed-order / `loading` | — | — |
| closed-order / `error` | — | — |
| closed-order / `overflow` | 736 / 1630 | — |

POS-05's normal list rectangle is `(0, 278.625, 1280, 521.375)`; the
closed-day banner makes it `(0, 333.28125, 1280, 466.71875)`. Every list row
measures at least 72px high. The 36-row overflow list has 2592px of content;
scrolling it leaves the toolbar fixed. POS-06's charged-content rectangle is
`(0, 64, 820, 736)` and its figures panel is `(820, 64, 460, 736)` in every
loaded state. The long order has 1630px of content. Scrolling it to the bottom
leaves the figures panel's rectangle unchanged.

Every sheet rectangle is `(0, 64, 820, 736)`. Its body is
`(1, 129, 818, 565)` and footer is `(1, 694, 818, 105)` with footer
`clientHeight / scrollHeight = 104 / 104`. The custom tender sheet has 829px
of content inside its 565px scroll body; the reason and validation remain
reachable and the footer stays visible. The M-1 modal rectangle is
`(360, 109.65625, 560, 580.6875)` with `clientHeight / scrollHeight = 579 / 579`.
Its footer is `(361, 608.34375, 558, 81)`, inside the device. The existing five
POS artifacts also measured 1280×800 in every declared state; the new floor
resume strip preserves table targets and uses the existing grid scroll area.

Twelve grouped browser interaction checks passed: touch table lookup and the
matching quick-sale detail; exact-amount lookup; HH:MM validation and range
lookup; all six closed-day rows retaining reprint-only eligibility; the AC-25
default; mismatch correction, preserved cancellation and successful terminal
refund; Other reason touch entry; retained failure recovery; stored figures
and eligibility across four reprint contexts; both overflow regions with
pinned controls; floor context/resume navigation; and one final incidents
empty composition. A zero-total detail had zero Refund controls in the DOM.
These are design-fixture checks, not backend or authentication tests.

The independent Impeccable finish reviewer examined all 12 supplied captures,
source and measurements. It found no material layout or core-refund behavior
issue, and requested two corrections: complete the singular/manifest line
terminology, and finish the required behavioral Handoff. Both corrections
were scored resolved in the reviewer’s verdict pass, with disposition
`ship` for that correction scope. The static detector returned no findings. The separate lead-led design review and the
A4/C recommendations are still pending.

### Questions raised and proposed answers

- A4 and C above remain explicit recommendations for review: retain the
  just-closed day's reprint-only list, and return Close to the floor.
- The global Frost link check conflicted with the back-office exclusion.
  Proposed POS-only scope was confirmed by the lead, as recorded above.
- Missing verification dependencies prevented the application check. The
  lead resolved this with the designer-role exception above, not installation.
- The refund presets are fixture copy, not contractual options. Proposed
  answer: retain these three plus Other for the first implementation unless
  the owner supplies restaurant-specific wording.
- Older-day lookup and retention, receipt layout/numbering/fiscal content,
  post-close correction, and verifying-state M-1 cancellation remain the
  pre-existing open questions. Proposed scope for F4e is the two entry contexts
  drawn here, stored figures only, no receipt/fiscal/correction UI, and no
  verifying-state cancel until ruled. No approval, audit or gating policy was
  invented to resolve them.

DONE

### Round 2

Round 2 was drawn by a Claude designer (Opus 5.5) taking over from the round-1 Codex
designer. It answers the nine review findings as ruled in *Round 2 — the review's nine
findings* above, item by item. The round-1 Handoff above is kept as written; where it and
this section disagree, this section is current. Nothing beyond these items was drawn,
with one named exception under item 6 (F8).

#### Owner rulings

**O1 — allocation targets.** Drawn as ruled, with no change: the sheet has exactly one
row per original tender (`closed.js`, `defaults()`), and there is no control to add a
row or a tender type. A builder should note the consequence. A card-only order, such as
the quick sale, can only be refunded to Card. If the card cannot be reversed, the POS
has no cash route, and that is the owner's ruling, not a gap to fill.

**O2 — no per-row cap.** Drawn as ruled. A row accepts any whole-rupiah amount, and
only the sum is checked against the order total. The manager sees the resulting split in
M-1 (item 1). The new `approval-edited` fixture shows the case the review worried about:
Cash 155.925 against a sale that took only 55.925 in cash.

**O3 — zero rows.** A row edited to 0 now reads **Card · not refunded** on the sheet,
and the sheet adds the line *A row at 0 is not refunded and is left out of the refund.*
The new state `sheet-zero` pictures it (Card 0, Cash 155.925, sum exact, reason chosen,
Continue enabled). M-1 names the row the same way (*Card not refunded*). The REFUNDED
view already lists only non-zero rows under *Money returned · full order*. Builder rule:
drop every 0 row before sending the refund command; the command never carries a zero
RefundTender.

**O4 — approved, then refused.** Not drawn: the audit record is server-side. Two states
picture an approval that succeeded followed by a refund the server refused. Each writes
one audit entry naming the actor and the approver, with outcome REFUSED, the refusal
code and no money fields:
- `refund-error`: a definite rejection of the refund command after a valid manager PIN.
- `day-refusal`: the business day closed during the attempt (ruling I-4). Its refusal
  code is the business-day-closed code.

The two existing outcomes are unchanged. A cancelled approval writes an entry with a
null approver (FR-J3, AC-18). A successful refund writes one combined entry naming the
actor, the approver, the reason and the order (FR-J2, FR-J3, AC-11). After no response
(item 4) the client writes nothing; the server's record is whatever it actually did.

#### Lead rulings

**1. F1 — the allocation in M-1.** The M-1 subject on POS-06 now has a second line under
*Refund <order>, <total> — reason: <reason>*:

- `Money back: <tender> <amount> · <tender> <amount> …`, in sheet order. A 0 row reads
  `<tender> not refunded`.
- An `ALLOCATION EDITED` tag follows when any row differs from its default (the tender's
  effective contribution) or the row count differs. The comparison is row by row, so
  three separate Card tenders are compared separately.

`approval` (relabelled *Manager PIN · default allocation*) now pictures the default
allocation: *Money back: Card 100.000 · Cash 55.925*, with no tag. In round 1 it
pictured the edited 80.000 / 75.925 split with no way to tell. The new
`approval-edited` (*Manager PIN · allocation edited*) pictures *Money back: Card not
refunded · Cash 155.925* with the tag. `sheet-zero` leads into it. The rest of M-1 is
unchanged: heading, dots, keypad, *Approves this refund only.*, Cancel and its note. The
error, throttled and denied states still link to `order.html` and apply unchanged. The
six-tender allocation (`closed-order.html?state=approval&order=custom`) wraps to two
lines, and the modal stays inside the device (below).

**2. F2 and Part C — Close lands on the floor.** Two new floor states:

- `after-close` (*After Close · Table 1 free*): the `default` floor with Table 1 free,
  its tile reading *Free · Open table order* and opening a new order. The count is
  *3 open · 9 free*, and the open quick sale strip is kept. Everything else is identical
  to `default`.
- `after-close-receipt` (*After Close · receipt warning*): the same, plus the existing
  *Receipt printer: 1 unprinted receipt · View receipts* chip. This matches the receipt
  incident *Table 1, closed 20:14*.

In settlement, both *Close order & print receipt* links (the normal close, in its ten
states, and `zero`) now point to `floor.html?state=after-close`. *Back to floor* in
`leaselost` still points to the plain floor, because nothing closed there. No existing
floor state changed appearance. The check confirms that Table 1 is still open in
`default` and `receipt-warning`. The builder keeps the history replacement, so Back
cannot return to a closed settlement.

**A question for the lead, not decided:** settlement has no failed-print Close link to
point at `after-close-receipt`. The receipt prints after the tap on Close, and the
server's close result is what reports the failure (FR-G8). There is one Close control,
and it cannot know in advance. Drawing a separate control would invent one, so I did
not. `after-close-receipt` is registered and reachable from the gallery. **Proposed
answer:** the builder always lands on the floor. The floor shows the receipt-warning
chip when the close result or the floor read reports an unprinted receipt, so
`after-close` and `after-close-receipt` are the two outcomes of one link. If the lead
wants a clickable fixture path, the alternative is a new settlement state (for example
`closed-printfail`). That is a settlement change, outside these items.

**3. F3 — the closed-day list.** POS-05 `dayclosed` (relabelled *Day closed · open day
first*) is redrawn:

- **Banner.** It keeps the amber warning: *25 Sep · Business day closed at 23:14*, then
  *The open day's orders are listed first. Orders from 25 Sep follow, read-only:
  reprinting still works, refunds are unavailable.* The header tag now reads DAY OPEN.
- **Group 1, *Business day open · 26 Sep*.** One new-day order, *23:40 · Quick sale ·
  Card 173.250 · 173.250*: the review's scenario. It opens the normal, refundable
  detail (`closed-order.html?state=quick&order=quick&time=23:40&list=dayclosed`). On
  that detail, *list=dayclosed* makes the note read *Business day 26 Sep* and makes
  Back return to the closed-day list. Refund and Reprint are both offered.
- **Group 2, *Closed day · 25 Sep · reprint only*.** The six closed-day orders. Each
  opens the standing read-only `dayclosed` detail, as in round 1.

New state `dayclosed-start` (*Day closed · no new-day order yet*): the moment just after
the close. Group 1 reads *No orders closed yet in this business day.* and Group 2 lists
the six orders.

Filters apply to both groups. A group with no match reads *No matching orders in this
business day.* or *No matching orders from the closed day.* When a filter matches
nothing in either group, the list shows the single *No matching orders* composition.

**Proposal for when the banner clears (not ruled):** the POS-02 banner and the POS-05
closed-day group clear together, when the first POS session that displayed them ends
(Release, or the idle lock). If the day closes while the POS is locked, the next session
shows them, and they clear when that session ends. After that, POS-05 lists the open
business day only, as the inventory scopes it. Older-day lookup stays the open
retention question. Why: ruling I-4 exists so a cashier learns of the close before
promising a refund. The cashier who was on shift when the day closed is the one who may
have promised it, and a session boundary is a point the server already knows. No timer
or dismiss control has to be invented.

Also for the lead: the floor's existing `dayclosed` header reads *Business day closed ·
25 Sep*, while POS-05 now names the open day, 26 Sep. I left the floor state unchanged
because it is not in these items. If it should match, the floor header would read
*Business day open · 26 Sep* above the same banner.

**4. F6 — Review refund after a failure.** The `refund-error` notice now renders *Review
refund* only where the Refund control would itself exist: not zero, not REFUNDED and
not on a closed day (`refundable()` in `closed.js`, shared with the figures panel). When
the order is not eligible, the notice reads *Refund failed · the order is unchanged* /
*Nothing was refunded.* with no control. The check confirms that
`?state=refund-error&order=zero` and `&order=refunded` have no Refund element in the
DOM. The reachable `refund-error` state looks as it did in round 1.

**Builder note:** `refund-error` pictures a **definite rejection** only. When the refund
command gets no response (a timeout or a lost connection), the client must not show
*the order is unchanged*. It re-reads the order first:
- if the order is REFUNDED, it shows the REFUNDED detail, because the refund happened;
- if it is still CLOSED, it shows `refund-error` with *Review refund*, which needs a
  fresh manager PIN.

The client never re-sends the command on its own.

**5. F7 — one filter model.** *Apply filter* now filters the list immediately, and the
*Search* button is gone. The toolbar holds the three filter buttons and *Reset*, which
clears all three. `nomatch` is still reachable through the filters, for example with
Table 12, or with an amount of 500.000. The check sets Table 7, then Table 12, then
Reset, and an exact 155.925, and confirms that each list updates without a search step.

**6. F8 — borrowed tokens.** `closed.css` no longer references
`--frost-pin-key-height`, `--frost-category-width` or `--frost-receipt-reprint-width`.
Meanwhile:
- **List columns**, in the header and every row, use the flexible proportions
  `minmax(0,1fr) minmax(0,1fr) minmax(0,3fr) minmax(0,1fr)`. At 1280 wide they measure
  198.66, 198.67, 596.00 and 198.67px.
- **The allocation field** fills the right half of its row: `.co-allocation` is now a
  two-column `repeat(2,minmax(0,1fr))` grid, and the field measures 383 × 56px.
- **The amount-filter and allocation-editor outputs** fill their row (`flex:1`).

These are the named exception to "draw nothing beyond these items". The same selector
now centres its value vertically; in round 1 the figure sat at the top of the 56px
field. That is visible in `sheet-edit` and `filter-amount`.

**Missing tokens, raised and not added.** They are the values round 1 used:
- `--frost-closed-list-columns: 88px 172px minmax(0,1fr) 180px`: *Closed at*, *Order*,
  *Payment taken* and *Total*. It follows the `--frost-menu-columns` and
  `--frost-approval-columns` pattern. 88px fits `HH:MM`, 172px fits *Quick sale* or
  *Table 12*, and 180px fits `1.559.250` at 18px.
- `--frost-allocation-field-width: 180px`: the refund allocation amount field.

With the flexible stand-in, the time column wastes about 110px and the payment column
is about 150px narrower than it would be. Nothing is clipped.

**7. F9.**
- **F9.1.** POS-06 omits the discount row when the order has no discount. `quick` now
  shows Subtotal 165.000, Service charge 5% 8.250 and Total 173.250, matching
  `order.html`'s quick-sale totals. `default` still shows *Staff meal 10% −16.500*, and
  `zero` still shows *Comp 100% −165.000*.
- **F9.2.** In `incidents.html`, the empty composition (*Nothing outstanding / No
  unresolved print incidents.*) is still the only visible message, and it now carries
  `role="status"`. On the last clear, the script reveals it empty and fills it 100ms
  later, so a screen reader announces the change. The status line stays empty, and
  intermediate clears still use it. The check observes the empty reveal, then the fill,
  and finds *Nothing outstanding* exactly once in the page text. The appearance of every
  incidents state is unchanged.

#### States touched

- **POS-05 `closed-orders.html`.**
  - Every state: the toolbar loses *Search* (F7), and the columns use the flexible
    proportions (F8).
  - `dayclosed` is redrawn and relabelled (F3), and `dayclosed-start` is new.
  - `filter-amount`: the output is full-width and vertically centred.
- **POS-06 `closed-order.html`.**
  - `approval` is changed and relabelled, and `approval-edited` is new (F1).
  - `sheet-zero` is new (O3).
  - `quick` loses the discount row (F9.1).
  - Every sheet state with allocation rows (`sheet-refund`, `sheet-ac25`,
    `sheet-custom`, `sheet-edited`, `sheet-invalid`, `sheet-zero`): the field fills the
    right half of its row. `sheet-edit`: the output is full-width and centred (F8).
  - `refund-error` is gated, with no visible change in the reachable fixture (F6).
  - New context parameter `list=dayclosed` (F3).
- **POS-02 `floor.html`.** `after-close` and `after-close-receipt` are new. No existing
  state changed.
- **POS-04 `settlement.html`.** The two Close links change destination only.
- **POS-07 `incidents.html`.** `role="status"` and the last-clear script. No visible
  change.
- **`manifest.js`.** Five new states (floor 2, POS-05 1, POS-06 2) and two relabels (POS-05 `dayclosed`,
  POS-06 `approval`).
- **`docs/DESIGN.md`.** The DESIGN-009 supplement records immediate filtering, the
  flexible columns pending tokens, the closed-day grouping, the O1–O3 allocation rules
  and the M-1 money-back line.

No token file, `frost.css`, `order.html`, `lock.html` or `mockup.js` changed.

#### Verification

Headless Chrome through Playwright at a 1280×800 viewport, as the owner approved. The
script and screenshots are in `/private/tmp/design009-r2/` (`check.cjs`, `widths.cjs`,
`measurements.json`, 16 PNGs); none is committed.

- **The crawl** visited all 159 declared states of the seven POS artifacts: POS-05 11,
  POS-06 26, floor 11, order 58, settlement 34, lock 7, incidents 12. Every document
  measured exactly 1280×800. There were no JavaScript errors, and every file link
  collected from every state resolved to an existing file and a declared state.
- **The link grep:** `grep -r "prototype/" docs/design/visual-directions/frost/pos`
  returns nothing (exit 1).
- **The token audit on `closed.css`:** 84 distinct `--frost-*` references, all defined
  in `frost.css`. None of the three borrowed tokens appears. There are no raw colours,
  no `px` values and no numeric font weights.
- **Eleven round-2 interaction checks passed.** They cover F7; F3 (groups, links, the
  new-day detail, `dayclosed-start` and filters across both groups); F1 default and
  edited; the full edit-to-zero walk (cancel keeps it, the PIN approves, the REFUNDED
  view lists Cash only, no second refund); the six-tender modal fit; F6; F9.1; F9.2;
  F2; and F8.
- **`npm run verify`:** typecheck passed, and vitest reported 32 files and 2256 tests
  passed. This task changes no code, and verify is unaffected.
- **Not run:** the Impeccable static detector and finish reviewer. Round 2 is a set of
  ruled corrections, and I judged it from the screenshots instead.

| Screen / state | Main scroll client / content | Sheet body client / content | Modal y / height |
|---|---:|---:|---:|
| closed-orders / `default` | 521 / 521 | — | — |
| closed-orders / `overflow` | 521 / 2592 | — | — |
| closed-orders / `nomatch` | 521 / 521 | — | — |
| closed-orders / `dayclosed` | 467 / 571 | — | — |
| closed-orders / `dayclosed-start` | 467 / 550 | — | — |
| closed-orders / `filter-table`, `filter-time`, `filter-amount` | 521 / 521 | 565 / 565 | — |
| closed-order / `default`, `quick`, `refund-error`, `day-refusal` | 736 / 736 | — | — |
| closed-order / `sheet-refund`, `sheet-edited`, `sheet-invalid`, `sheet-zero`, `sheet-edit` | 736 / 736 | 565 / 565 | — |
| closed-order / `sheet-custom` | 736 / 736 | 565 / 829 | — |
| closed-order / `approval` | 736 / 736 | — | 98.78 / 602.44 |
| closed-order / `approval-edited` | 736 / 736 | — | 98.66 / 602.69 |
| closed-order / `approval&order=custom` (six tenders) | — | — | 87.91 / 624.19 |
| closed-order / `overflow` | 736 / 1630 | — | — |
| floor / `default`, `receipt-warning`, `after-close`, `after-close-receipt` | 484 / 484 | — | — |
| incidents / `default`, `empty` | 736 / 736 | — | — |

Every POS-05 row is at least 72px high, and every allocation field is 56px high. The two
closed-day lists scroll inside their region beneath the fixed banner, toolbar and column
heads. The six-tender M-1 ends at y = 712, inside the 800px device.

#### Questions raised, each with a proposed answer

1. **The failed-print Close link (item 2).** No settlement control exists to point at
   `after-close-receipt`. Proposed: treat `after-close` and `after-close-receipt` as the
   two outcomes of the one Close link, with the chip driven by the close result. The
   alternative is a new settlement fixture state, which the lead would have to assign.
2. **When the closed-day banner clears (item 3).** Proposed: when the first POS session
   that displayed it ends, taking the POS-05 closed-day group with it.
3. **The floor `dayclosed` header copy (item 3).** Proposed: leave it until the lead
   decides whether it should name the open day (*Business day open · 26 Sep*).
4. **Missing tokens (item 6).** Proposed: register `--frost-closed-list-columns: 88px
   172px minmax(0,1fr) 180px` and `--frost-allocation-field-width: 180px`, then replace
   the flexible stand-ins.
5. **O4 wording (for the owner's record).** Proposed as ruled: `refund-error` and
   `day-refusal` each carry one REFUSED entry naming actor and approver, with the
   refusal code and no money fields. A no-response attempt records only what the server
   actually did.

The questions still open from round 1 are unchanged: older-day lookup and retention,
receipt content and numbering, post-close corrections, and the M-1 verifying-state
cancel.

DONE
