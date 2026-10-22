---
id: DESIGN-019
title: BO-03 Menu in Frost (slice D, first part) — items and categories, the 86 action, archive and restore, reorder, and the catalog-changed refusal
category: ui
touches: [boundaries]
depends_on: [DESIGN-018b]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-019 — BO-03 Menu (slice D, first part)

**Written** 2026-10-22 by the lead. The first of three tasks that make design slice **D** of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4: "D (BO-03, BO-04, with the POS
addition)"), split from DESIGN-011's slice D (`.agent/reviews/DESIGN-011-back-office-audit.md:461`) because D is the
largest slice. **DESIGN-020** draws BO-04, the item editor; **DESIGN-021** draws the POS addition (an empty or
unreachable catalog, an item 86'd while its sheet is open, M-2 for any server item). This task draws **BO-03 only**,
and only links to BO-04 (`P/item-editor.html` stays the destination until DESIGN-020 replaces it).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design019`).
**Branch and place:** `agent/design-019`, cut from `development` at `608f412`, in the worktree
`../restaurant-pos-wt/DESIGN-019`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`.

Nothing is built from this task directly. A design review follows; then plan slices **S4c** (BO-03's list and
categories) and **S5** (the 86 action) are written from it. Their server halves (S4a, S4b) are not built yet, but their
behaviour is fixed by ADR-012 Part 2 and consult C1 §2 and §3: draw what they will do, and where you settle something
they leave to the design (name lengths, the order of rows, how a reorder is done), say so in the Handoff as a rule S4a
and S4c can copy.

Abbreviations, as in DESIGN-017 and DESIGN-018: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C1** = `.agent/reviews/ARCH-018-c1-configuration-schema.md`;
**C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`; **ADR-012** =
`docs/decisions/ADR-012-versioned-configuration.md`.

## Objective

When this task is done, BO-03 has a reviewed Frost composition, `F/menu.html` (rework the existing artifact), in every
state S4c and S5 will build, with every word they will show (ADR-011 rule 24). The manager sees the whole menu grouped by
category, manages categories (create, rename, reorder, archive, restore), reorders items within a category, archives and
restores an item, opens an item in BO-04, and marks an item unavailable (86) or available again, fast, from its row. The
slice also draws BO-03's half of ADR-012's catalog rules: an edit refused because the catalog changed meanwhile
(`CATALOG_CHANGED`), and the state commands that are never refused for that reason.

## Required inputs

Read these, in this order.

1. **DESIGN-011**, BO-03 (`.agent/reviews/DESIGN-011-back-office-audit.md:104-130`): the P1 findings (sticky overflow
   with the 86 action kept; subject identity through toggle, edit, archive, cancel and return; category create **and
   edit** with validation recovery; the 86 wording "disabled in place"; the lease wording) and P2 (fixture counts).
2. **ADR-012 Part 2**, rules 9 to 14, above all **rule 10** (every committed catalog write advances the version,
   availability, archive and restore included) and **rule 13** (an *edit* carries the version and is refused
   `CATALOG_CHANGED`; a *state command* and a *create* do not).
3. **C1 §2.2 and §3** (the catalog tables and their notes; the 86 toggle), and §0 (*Text that reaches paper*: no control
   character in any name, trimmed, lengths to settle with design D).
4. **C2**, for the pattern: §2 (field-level validation), §4 (names unique among active records, case-insensitively,
   `DUPLICATE`; renaming an inactive record allowed), §6 (the result table: unknown outcomes, no resend).
5. **DESIGN-017's and DESIGN-018's Handoffs** (`.agent/tasks/DESIGN-017-tables.md`,
   `.agent/tasks/DESIGN-018-settings-and-tenders.md`) and **`D`** *Configuration forms — DESIGN-017 / consult C2* and
   *Configuration forms — DESIGN-018 additions* (`D:1486-1768`): binding behaviour for every configuration form, the
   status-command rule (state commands open no form), the stale-draft refusal, the departure decision, the
   working-area dialog rule, and the F4 partial-list state with its new wording. Consume `F/office.css`, `F/office.js`,
   `F/patterns.html`, and `F/tables.css` where a pattern is the same; do not fork them.
6. `I` BO-03 (`:677-707`), the shared general failures (`I:83-124`), rulings C-3 and C-4 (`I:1188-1189`); `S` BO-03
   (`:268-273`) and the cross-client flows (`:365`, `:376`); `P/menu.html` and the current `F/menu.html`.
7. The contract, for meaning: PRD FR-B4 (an archived item or category may be restored), FR-B6, FR-C1, FR-C5, FR-C6,
   FR-C7, FR-C8, FR-G13, AC-12, AC-29, AC-31; BOUNDARIES B-8, B-13, B-17, B-24.

## Rulings that bind this task

- **Owner, Q10 (DECISIONS 2026-10-20):** items and categories may be **restored** after archiving (PRD FR-B4).
- **Owner, Q13:** AC-12's add-time rejection arrives in Phase 2 and its fire-time rejection in Phase 3. BO-03's 86 is
  Phase 1. **The 86 refused while a CheckoutLease holds a quick-sale order carrying the item** (FR-G13, AC-29; ruling
  C-4: quick-sale only) arrives with leases in **Phase 4**: draw it, name the order as `I` requires, word it as
  DESIGN-011 proposes ("Try again when payment is no longer in progress."), and **mark it Phase 4** in the gallery and the
  Handoff so S5 does not build it.
- **Owner, Q11:** menu changes are **not audited**. Draw no audit trace.
- **ADR-012 rule 13, as BO-03 meets it.** *Edits* on BO-03 (renaming a category, reordering categories, reordering items
  within a category) carry the catalog version their screen was read at and can be refused `CATALOG_CHANGED`: draw that
  refusal with `D`'s stale-draft rule (nothing written, the draft or the new order kept, the list reread, the manager
  decides, no resend). *State commands* (86 and its reversal, archive and restore of an item or a category) and
  *creates* (a new category) are **never** refused `CATALOG_CHANGED`: draw nothing that suggests they could be. An 86 is
  urgent and must act at once from the row.
- **State commands open no form** (`D` *Status commands*, from DESIGN-017): 86, available again, archive and restore act
  from the row or the category's own control, with page-status results (pending, done, unknown, failure, session
  refusal). Decide whether archiving a **category** needs a confirmation (it hides every item in it from the POS, C1 §2.2
  *What the POS may offer*; it is reversible, so ARCH-002's test does not require one); say why either way.
- **C1 §2.2, *What the POS may offer*:** an item is offered only if it is active, available and in an active category.
  Archiving a category hides its items without changing them; restoring it shows them again. **Draw how BO-03 shows the
  items of an archived category** (C1 §5 asks design D for this).
- **Archived items and categories are retained** (FR-C8, B-8): an archived item keeps its row in an *archived* view or
  group, restorable; nothing on BO-03 deletes anything.
- **Names (C1 §2.2 notes; C2 §4):** category names unique among active categories, case-insensitively, `DUPLICATE` on
  create, rename and restore into a held name, renaming an archived category allowed. Item names are edited in BO-04
  (DESIGN-020), but an item **restore** into a name an active item holds is refused `DUPLICATE` here: draw it, with the
  way out (rename it in BO-04). Settle the **category name length** (BO-05's 32 is the precedent; a category name is
  printed on no ticket) and state it in the Handoff. No control character; trimmed.
- **Order** (C1 §2.2 *Display order*): a new category goes last; a new item goes last in its category; a reorder sets the
  full order of one scope (the categories; the items of one category). **Draw a reorder that works without dragging**
  (for example move-up and move-down, or a reorder mode with explicit positions), keyboard-operable, with the
  `CATALOG_CHANGED` refusal above. Drag may be offered in addition, never alone.
- **The cross-client 86** (DESIGN-011 BO-03, last paragraph; `S:365`): pair the 86'd item with the matching POS
  unavailable state **as review evidence only** (link to the existing Frost POS artifact's state that shows it, or name
  it in the Handoff); no product navigation between clients; no claim of a timed integration test. The POS states
  themselves are DESIGN-021's.
- **The partial-list state** (DESIGN-017's F4 as DESIGN-018 reworded it, owner DESIGN-018 Q4): BO-03's equivalent uses
  "The list may be out of date" wording, adapted to the menu. Draw it.
- **Money on BO-03** is the item's tax-inclusive base price as stored, whole rupiah with `.` grouping and no currency
  symbol (`D`'s money convention). BO-03 never edits a price (BO-04 does).
- **Tokens (lead, as in slices A, B, C, I, E1, F):** registry first; a missing value may be registered in
  `frost.tokens.json`, `frost.css` and `D` with `source: null` and a `designed` record, each listed in the Handoff. No raw
  colour, size or weight. No success green.

## What to draw

### Part A — BO-03, `F/menu.html`

1. **Every state, by `?state=`:** empty (B-24: a new installation has no category and no item; the way to create the
   first category, then the first item); loading; failed to load, with *Try again*; the menu (several categories, active
   and archived items, an 86'd item, an item with variants, in your grouping and order, recorded); overflow (a long menu,
   the header sticky inside its scroll owner, the 86 action and price on every row, the longest names); category create;
   category rename; category local invalid input (empty, over-long, control character), with recovery (typing a name
   enables Create again); category saving, saved, **name in use** (create, rename, restore), general failure, outcome
   unknown, and the departure decision; category archived (its items shown as you decide), category restored; item 86'd
   and available again, each with pending, unknown and failure page statuses; item archived, item restored, item restore
   refused **name in use**; reorder (categories, and items within a category) with its pending, saved, refused
   `CATALOG_CHANGED` and unknown states; the partial-list state; **M-6 over a category form** (visible, inert) and **BO-01
   with a draft held**; and the **Phase 4** 86-refused-under-lease state, marked.
2. **Subject-correct walks** (DESIGN-011 P1): every row's 86 changes that row and announces that item; every Edit opens
   that item's BO-04 entry (the prototype for now, carrying the item); archive, restore, cancel and return keep the
   subject. Fixture counts agree with the rows drawn (P2).
3. **Copy for every state**, final words, listed in the Handoff as a table S4c and S5 can copy (state, element, exact text,
   accessible name where a test will drive it). Name the controls their tests press: the rail's *Menu* entry, *New
   category*, a category's rename, archive, restore and reorder controls, *New item*, a row's Edit, 86, available-again,
   archive and restore controls, and the departure decision's Stay and Discard.
4. **Focus**: after each command, refusal and decision, as DESIGN-017 and DESIGN-018 tabled it.

### Part B — the patterns, in `D`

1. Add to *Configuration forms* what this slice settles for every later form: **a reorder without dragging** and its
   refusal; **a state command on a grouped list** (if it differs from BO-05's); **the catalog-changed refusal on a list
   edit** (as DESIGN-018's stale-draft rule applies to an order rather than a form). Say plainly which are behaviour and
   which are BO-03's copy. Change no existing rule.

### Part C — links, rail, gallery, inventory and sitemap

1. `F/office.js`: resolve `menu` to `F/menu.html` for the rail's *Menu* entry if it does not already, and keep links to
   BO-04 pointing at the prototype until DESIGN-020. Report the `grep -c "prototype/"` counts before and after for each
   changed artifact.
2. Register every state in `manifest.js` and the gallery. Write `docs/design/checks/design019.cjs`.
3. Bring `I` BO-03 and `S` BO-03 into line: restore (Q10), the reorder, the archived-category view, *name in use*,
   `CATALOG_CHANGED` on list edits, the Phase 4 lease refusal marked, and the partial-list state. Show each changed line
   in the Handoff (`git diff`).

## Constraints

- Light only, desktop only. No stock, no inventory field, no image, no nested modifier group, no POS operation, no
  timed availability, no audit trace.
- *Invent, revert, ask:* nothing the inventory, the PRD, ADR-012, C1 or C2 does not grant.
- Every person is named (B-13). The four product documents, ADR-012, C1 and C2 are not edited.
- Do not change DESIGN-012's, -016's, -017's or -018's shared behaviour except as Part B adds rules; their checks must
  still pass (`design012.cjs`, `design013.cjs`, `design014.cjs`, `design016.cjs`, `design017.cjs`, `design018.cjs`).
- Measure in a browser at 1440×900 and 1920×1080. Each run of a check script needs the owner's approval in the pane; ask
  before it, not after. Run the checks with `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node
  docs/design/checks/designNNN.cjs`. Evidence stays outside the repository; quote measurements in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must pass unchanged. Earlier
check scripts may need their expected prototype-link counts updated for Part C; change only those expectations, say so,
and weaken no assertion.

## Acceptance criteria

1. `F/menu.html` imports the shared `office.css`, and every state in Part A item 1 is reachable by `?state=` and
   registered. Red if one is missing.
2. The Handoff maps every `I` BO-03 state (as amended), every ruling above and every item of Parts A to C to the state or
   walk that shows it, and gives the copy table of Part A item 3.
3. The Handoff states, as rules S4a, S4c and S5 can test: the category name length and rules; the row order and
   grouping; the reorder interaction; how an archived category's items show; which BO-03 commands carry the catalog
   version and which do not.
4. Shown in the browser: an 86 and its reversal from the row with no form; a category rename refused `CATALOG_CHANGED`
   with the draft kept; a reorder refused the same way; *name in use* on a category and on an item restore; M-6 over a
   form, inert; BO-01 with the draft held.
5. No state suggests a state command or a create can be refused for a stale catalog; the Phase 4 state is marked.
6. Measurements at 1440×900 and 1920×1080: no horizontal overflow at the longest names; the header sticky in overflow;
   the 86 action present on every row in overflow.
7. No raw colour, size or weight; new tokens registered and listed; `npm run verify` green if anything under
   `docs/design/tokens/` changed. The six earlier checks pass.
8. The Handoff lists every question raised and not ruled, each with a proposed answer, and anything DESIGN-020 or
   DESIGN-021 must know.

## Out of scope

- BO-04, the item editor (DESIGN-020): its fields, variants, modifiers, prices and its own stale-draft state. The POS
  addition (DESIGN-021). BO-07 (F's other half). Building anything.

## Reporting

Commit on `agent/design-019` only, after verify is green where it applies, and never push. Write the Handoff below in
full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design019: DESIGN-019 done — <one line>"
    herdr agent prompt lead "design019: BLOCKED — <question>"

## Handoff

_Not started._
