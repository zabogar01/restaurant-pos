---
id: DESIGN-017
title: BO-05 Tables in Frost (slice E1), the first back-office form, with consult C2's dialog, outcome and departure rules
category: ui
touches: [identity]
depends_on: [DESIGN-016]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-017 — BO-05 Tables (slice E1)

**Written** 2026-10-20 by the lead. Design slice **E1** of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4: "E1 (BO-05) first, because S1 sets the
pattern and waits on nothing else"), split from DESIGN-011's slice E (`.agent/reviews/DESIGN-011-back-office-audit.md:462`).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design017`).
**Branch and place:** `agent/design-017`, cut from `development` at `3749fb7`, in the worktree
`../restaurant-pos-wt/DESIGN-017`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`, and nothing in the main
checkout.

Nothing is built from this task directly. A design review follows; then the frontend slice **S1b** is written from it.
S1b's server half (S1a) is being built now against consult C2, so **the server's behaviour is fixed**: draw what it does.

Abbreviations, as in DESIGN-011 and DESIGN-016: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`.

## Objective

When this task is done, BO-05 has a reviewed Frost composition, `F/tables.html`, in every state S1b will build, with
every word S1b will show (ADR-011 rule 24: the builder copies the design's words; it invents none). Because BO-05 is
the **first back-office form**, the slice also settles the form patterns every later configuration screen copies:
field-level validation, a definite refusal, a pending save, an outcome that could not be confirmed, the unsaved-work
departure decision, and how a working-area dialog behaves when the session goes to M-6 or to BO-01. The rail gains its
first real destination, Tables.

## Required inputs

Read these, in this order.

1. **Consult C2 in full**, above all §3 (what a command answers; the list's order and grouping are yours), §4 (labels),
   §6 (unknown outcomes: the result table and the bullets under it), §7 (the manifest, the rail, the keyed working area,
   **the modal-dialog hazard and its rule**, *For E1, not decided here*, unsaved-work departure, and the browser cases
   C1 to C3 that S1b will run against your accessible names), and *Stale text* 2.
2. `.agent/reviews/DESIGN-011-back-office-audit.md`, BO-05 (`:150-165`) and slice E (`:462`). Its P1 (subject-correct
   walks for create, edit, refusal and success) and P2 (fixture counts) apply.
3. **DESIGN-012's task file and Handoff** (`.agent/tasks/DESIGN-012-office-shell-and-reauth.md`): the frame, the table
   pattern, read states, scroll ownership, the dialog pattern, Part C 5 (pending, saved, refused, outcome unknown) and
   Part C 6 (stay-or-discard), the **F1 ruling** (no page state makes *Log out* or the kitchen emergency action inert)
   and **N2** (as it now reads in `D`: a modal decision may defer the emergency action). Consume `F/office.css`,
   `F/office.js` and `F/patterns.html`; do not fork them.
4. **DESIGN-016's Handoff** (`.agent/tasks/DESIGN-016-login-and-today.md`, from *Handoff*): the rail, the landing, the
   `phase0` flag, BO-01's states (C2's hazard is about BO-01's fields), and how it registered states and wrote
   `design016.cjs`.
5. `I` BO-05 (`:738-753`) and the shared general failures (`I:83-124`); `S` BO-05 (`:265-267`); `P/tables.html`.
6. `D`: *Modal and sheet*, *Data table*, *Navigation (back office)*, *Notices and empty states*, *Buttons (back
   office)*, *Shared back-office patterns — DESIGN-012*, *Layout*, token provenance.
7. The contract, for meaning: PRD FR-B2 (now "create, edit, deactivate and reactivate"), FR-C8, FR-A2b, AC-32, AC-35;
   BOUNDARIES B-13, B-20, B-24.

## Rulings that bind this task

- **Owner, 2026-10-20 (DECISIONS), Q10:** tables may be **reactivated**; **no seat count**. Draw no seats anywhere
  (`P/tables.html` still draws them; fix that prototype's annotation, see Part C).
- **Owner, Q13:** the refusal to deactivate a table holding an `OPEN` order arrives with **Phase 2**. Draw it, name the
  order as `I` requires, and **mark it in the gallery and the Handoff as Phase 2** so S1b does not build it.
- **C2 §3, lead ruling:** no area column; nothing groups tables by area. `TableView` is `{ tableId, label, isActive }`
  only: draw nothing else per row (no seats, no current order, no timestamps).
- **C2 §4:** a label is 1 to 32 characters, no leading or trailing whitespace (the form trims before checking), no
  control character; unique among **active** tables, case-insensitively. Refusal code `DUPLICATE` for create, rename,
  and **reactivation** into a held label. Renaming an **inactive** table is allowed (the way out of a refused
  reactivation). Several inactive tables may share a label. *"If E1 draws a different length, E1 wins"*: if you change
  32, say so first in the Handoff, because S1a is being built to 32.
- **C2 §6:** the result table is binding behaviour; you write its words. A refused `NOT_FOUND` or `VALIDATION_FAILED`
  from the server is the *general failure*, draft kept. *Outcome unknown* keeps the draft and the form open, shows the
  reread list behind it, and offers Save and Cancel as ever, with **no "send again" control**; the client never claims
  success from the reread. One command at a time: Save is inert while pending.
- **C2 §6, last bullet:** architecture requires **no confirmation step** for deactivation or reactivation (both are
  reversible). You may draw one; if you do, say why in the Handoff.
- **C2 §7, the modal-dialog rule** (copy it into `D`'s shared back-office patterns, Part B): a modal dialog inside the
  working area is open only while the frame is shown; at BO-01 it is closed with its state kept, and reopened for the
  same manager; under M-6 it stays open behind M-6, visible and inert; a different manager's sign-in destroys it.
- **C2 §7, *For E1, not decided here*:** decide whether the table form is a **modal decision under N2** (and whether
  *Log out* is deferred the same way while it is open) or a **non-modal panel** (so *Log out* and the rail stay live).
  Either is buildable. Give your reason against DESIGN-012's F1.
- **Drafts (owner, 2026-10-14, 2026-10-16, 2026-10-20):** the same manager resuming through M-6 or signing in again at
  BO-01 gets the unsaved draft back; a different manager destroys it. C2's browser cases C1 to C3 assert this against
  your accessible names.
- **No `beforeunload` prompt** (C2 §7): a reload destroys the working area by rule 22; the browser's wording is not ours.
- **Tokens (lead, as in slices A, B, C, I):** registry first; a missing value may be registered in `frost.tokens.json`,
  `frost.css` and `D` with `source: null` and a `designed` record, each listed in the Handoff. No raw colour, size or
  weight. No success green.

## What to draw

### Part A — BO-05, `F/tables.html`

1. **Every state, by `?state=`:** empty (B-24: a real starting state, with the way to create the first table); loading;
   failed to load, with *Try again*; the list (active and inactive together, your order and grouping, recorded);
   overflow (a long floor, the header sticking inside its scroll owner, the longest 32-character label); create;
   rename; local invalid input (empty label; over-long; a pasted label with a control character, if the field can
   receive one); saving (pending); saved; **label in use** for create, for rename, and for reactivation (each placed on
   the label, with the list reread behind it so the holder is visible); deactivated; reactivated; general failure
   (draft kept); **outcome unknown** (draft kept, list reread, no resend); the **stay-or-discard decision** from Cancel,
   *Escape*, browser back and (if non-modal) a rail entry, including its pending and outcome-unknown copy ("leaving does
   not send it again", DESIGN-012 F1); **M-6 over the form** (the form visible and inert behind it); **BO-01 with a draft
   held** (the form closed, BO-01's fields live, per the dialog rule); and the Phase 2 **deactivation rejected — table
   holds an OPEN order** state, marked Phase 2.
2. **Subject-correct walks** (DESIGN-011 P1): every Edit opens that row's own label; a refusal names the right table; a
   success changes the right row. Fixture counts agree with the rows drawn (P2).
3. **The modal or non-modal decision** above, drawn, with *Log out*'s behaviour while the form is open.
4. **Copy for every state**, final words, listed in the Handoff as a table S1b can copy (state, element, exact text,
   accessible name where a test will drive it). Name the controls S1b's browser cases press: the rail's Tables entry,
   New table, a row's edit control, the label field, Save, Cancel, Deactivate, Reactivate, and the decision's Stay and
   Discard.
5. **Focus**: where it lands on opening the form, after a field error, after `DUPLICATE`, after save, after Cancel, and
   after the dialog is reopened for the same manager (C2 C1 says: the label field, holding the unsaved value).

### Part B — the patterns, in `D`

1. Add to *Shared back-office patterns* the rules this slice settles for every later form: field-level validation
   placement; the refusal on a field; pending; saved; outcome unknown (no resend, no inferred success); the departure
   decision; and **C2's modal-dialog rule**, verbatim in substance. Say plainly which are behaviour (binding on every
   form) and which are BO-05's copy.

### Part C — links, rail, gallery, inventory and wireframe

1. `F/office.js`: add `tables` where Frost destinations are resolved, so the rail's Tables entry and every authored link
   to `P/tables.html` reach `F/tables.html`. Report the `grep -c "prototype/"` counts before and after for each changed
   artifact, and that no Frost back-office artifact still links to `P/tables.html`.
2. Register the artifact and every state in `manifest.js` and the gallery. Write `docs/design/checks/design017.cjs`.
3. Bring `I` BO-05 and `S` BO-05 into line, in C2's *Stale text* 2 wording or better: purpose "create, edit, deactivate
   and reactivate"; the states *label in use — create, rename or reactivation refused* (FR-B2) and *reactivated table*;
   *deactivation rejected* kept and marked as arriving with Phase 2's orders (Q13); the sitemap gains "[INLINE] Label in
   use — refused" and the reactivate action. `P/tables.html` gains a pointer to the Frost artifact and loses seats and
   anything else Q10 or C2 removed. Show each changed line in the Handoff (`git diff`).

## Constraints

- Light only, desktop only. No seat count, no area, no merge, transfer or split (I BO-05), no POS operation.
- *Invent, revert, ask:* nothing the inventory, the PRD or C2 does not grant.
- Every person is named (B-13): the top bar shows the real manager's name in the fixture.
- The four product documents are not edited; C2 and the ADRs are not edited.
- Do not change DESIGN-012's or DESIGN-016's shared behaviour except as Part B adds rules; slices A, B, C and I must
  still pass their checks (`design012.cjs`, `design013.cjs`, `design014.cjs`, `design016.cjs`).
- Measure in a browser at 1440×900 and 1920×1080. Each run of a check script needs the owner's approval in the pane; ask
  before it, not after. Run the checks with `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node
  docs/design/checks/designNNN.cjs`. Evidence stays outside the repository; quote measurements in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
earlier check scripts may need their expected prototype-link counts updated for Part C; change only those expectations,
say so, and weaken no assertion.

## Acceptance criteria

1. `F/tables.html` exists, imports the shared `office.css`, and every state in Part A item 1 is reachable by `?state=`
   and registered. Red if one is missing.
2. The Handoff maps every `I` BO-05 state (as amended), every ruling above and every item of Parts A to C to the state
   or walk that shows it, and gives the copy table of Part A item 4.
3. Shown in the browser: the form's modal-or-non-modal behaviour as decided, with *Log out*'s; focus as Part A item 5
   says; M-6 over the form with the form inert; BO-01 with the form closed and BO-01's fields accepting input.
4. No seats, area or Phase 2 state presented as Phase 1; the Phase 2 state is marked.
5. Measurements at 1440×900 and 1920×1080: no horizontal overflow at the longest label; the sticky header in overflow.
6. No Frost back-office artifact links to `P/tables.html`; counts in the Handoff. No raw colour, size or weight; new
   tokens registered and listed; `npm run verify` green if anything under `docs/design/tokens/` changed. Slices A, B, C,
   I checks pass.
7. The Handoff lists every question raised and not ruled, each with a proposed answer.

## Out of scope

- BO-06 (slice E2), BO-07 and BO-08 (F), BO-03 and BO-04 (D); any server or API shape; building anything.

## Reporting

Commit on `agent/design-017` only, after verify is green where it applies, and never push. Write the Handoff below in
full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design017: DESIGN-017 done — <one line>"
    herdr agent prompt lead "design017: BLOCKED — <question>"

## Handoff
