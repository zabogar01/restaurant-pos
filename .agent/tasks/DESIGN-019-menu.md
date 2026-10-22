---
id: DESIGN-019
title: BO-03 Menu in Frost (slice D, first part) — items and categories, the 86 action, archive and restore, reorder, and the catalog-changed refusal
category: ui
touches: [boundaries]
depends_on: [DESIGN-018b]
owns: [docs/design/**, docs/DESIGN.md]
status: active
cycles: 1
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

## Handover (lead, 2026-10-22): finish the Codex designer's draft on Claude Opus

**Owner exception** (DECISIONS 2026-10-22): Codex hit its usage limit, so this task is finished by a Claude Opus 5.5
designer (`design019c`) and reviewed by Claude Opus, with no Codex step. The other-family rule stands for every other
task.

The Codex designer (`design019`) drew the whole slice and wrote the Handoff below, but **committed nothing**. Its work
is uncommitted in this worktree. Modified: `.agent/tasks/DESIGN-019-menu.md` (this Handoff), `docs/DESIGN.md`,
`docs/design/SCREEN-INVENTORY.md`, `docs/design/SITEMAP.md`, `docs/design/checks/design014.cjs`,
`docs/design/visual-directions/frost/back-office/menu.html`, `docs/design/visual-directions/index.html`,
`docs/design/visual-directions/manifest.js` and `docs/design/visual-directions/review.js`. New:
`docs/design/checks/design019.cjs`, and `frost/back-office/menu.css`, `menu.js` and `menu-states.js`. **Finish it; do
not restart it.**

**The lead's check runs on this draft** (2026-10-22): `design019.cjs` **965/967**, 74 states, no page errors. The only
failures are "long names and amounts fit 1440" and "… 1920", with detail `{category: 33, item: 80, bad: 0}`: the longest
category name in the fixture measures 33 against the 32-character rule. The six earlier checks pass: `design012` 421/421,
`design013` 371/371, `design014` 288/288, `design016` 399/399, `design017` 347/347, `design018` 724/724.

**What the next designer does:**
1. Read this task file whole, including the Handoff below. Check the draft against the task's *Rulings*, *What to draw*
   and *Acceptance criteria*, finish anything missing, and correct anything wrong, saying so in the Handoff.
2. Fix the length failure: the longest category is exactly 32 in the fixture, and the check agrees.
3. **Lead rulings already given in this task** (to the Codex designer): category names are 1–32 characters; reorder is by
   *Move up* / *Move down* with *Save order*; archiving a category needs no confirmation, with copy saying it hides the
   items from the POS without changing them; Edit links carry their own item's identity in the URL, the check asserts
   it, and `P/item-editor.html` is **not** edited (DESIGN-020 redraws BO-04).
4. Rerun `design019.cjs` once after your changes. Rerun the six earlier checks only if you change shared files
   (`office.*`, `manifest.js`, `review.js`, `index.html`, or another artifact). Ask the owner in the pane before each
   run.
5. Commit everything on `agent/design-019` (path-scoped `git add`), complete the Handoff with the counts, end it with
   `DONE`, and ping the lead.

## Lead verify (2026-10-22)

The lead checked the branch at `907a9c8`. The tree is clean, and every changed path is inside `owns` or is this task
file. The lead ran all seven checks in this worktree, with evidence outside the repository: `design019.cjs` **969/969**
(74 states, no errors); `design012` 421/421; `design013` 371/371; `design014` 288/288; `design016` 399/399;
`design017` 347/347; `design018` 724/724. The lead looked at `default` and `reorder-categories-stale` at 1440.
**The designer's open question** (C1 lists no `reorderItems` command) is the lead's to settle in S4a's task file. C1
§2.2's *Display order* note already names "the items of a category" as a reorder scope, so S4a gets
`reorderItems(categoryId, expected, ids)`, shaped like `reorderCategories`. No change here.
**For the reviewer:** you cannot launch a browser; this note is the evidence for the checks. Check the work against the
task's *Rulings*, *What to draw* and *Acceptance criteria*, ADR-012 rules 10 and 13, C1 §2.2, and `D`'s
configuration-form rules. Two things the lead noticed:
1. **The rail.** In `default`, the rail shows the full future navigation (Today, End of day, Reports, Audit, Staff,
   Discount presets, Printing), while `tables.html` and `settings.html` draw the Phase 1 rail (DESIGN-018: "The Phase 1
   rail lists Tables and Settings"). Decide which is right for BO-03's Phase 1 drawing.
2. **The row control labelled "86".** Check its accessible name, and the available-again control's.

## Round 2 — the review's seven findings (lead rulings, 2026-10-22)

The review (`.agent/reviews/DESIGN-019-review.md`, verdict *findings*, seven) is accepted. Findings 1 to 6 are applied as
the review proposes, in the words below; finding 7 is the lead's call, ruled below. Apply exactly this, then add a section
*Round 2* at the end of the Handoff (what changed, each new assertion and the red you observed against round 1, the
counts), and end it with `DONE`.

- **F1, the version a list edit carries.** Add this rule, word for word, to the Handoff's rules table and to `D`'s
  DESIGN-019 *Catalog changed during a list edit* paragraph: "BO-03 keeps the version its list stands at. A full read
  sets it. A command answer advances it to the answered version only when that version is exactly the standing version
  plus one, or equal to it for an unchanged answer. Otherwise the list keeps its standing version, so the next edit
  opened from it is refused `CATALOG_CHANGED` and rereads. An editor carries the list's standing version at the moment it
  opens." Make the fixture keep a separate list version. Add an assertion: after a state command whose answer skips a
  version, the next rename is refused stale.
- **F2, the 86 result for a hidden item.** For an item that is archived or whose category is archived, the 86 result
  reads "`{name} is now marked 86.` It stays hidden from the POS while it or its category is archived." Add the row to the
  copy table. Assert that 86 on Apple Pie and on Winter Stew does not say "disabled in place".
- **F3, reorder needs a complete read.** Disable *Reorder categories* and every *Reorder items* unless the read is
  complete (not while loading, failed or partial). Add to the Handoff's reorder rule and to `D`'s reorder paragraph: "A
  reorder needs a complete read: its openers are disabled while the list is loading, failed or partial." Assert both
  openers are disabled in `loading`, `error` and `partial`.
- **F4, the inventory's create sentence.** Replace `I:703-704` with: "A category create and the state commands never
  carry the catalog version and cannot be refused for a stale catalog. An item create (BO-04) carries none either, but is
  refused `CATALOG_CHANGED` when its category has been archived (C1 §2.3)." Add the same line to the Handoff's *For
  DESIGN-020* paragraph, together with the review's note on names held by items in an archived category (*Cleared*, last
  bullet).
- **F5, the Phase 1 rail.** Author the Phase 1 rail in `menu.html`: *Configuration* → *Menu*, *Tables*, *Settings*, in
  the future rail's order, with Menu current. Add *Menu* to the authored rails of `tables.html` and `settings.html`, as
  DESIGN-018 added Settings. Replace your `D` sentence ("The shared review rail retains future destinations…") with: "The
  Phase 1 rail lists Menu, Tables and Settings; `tables.html` and `settings.html` now show all three." Assert the three
  entries and the walk between them from each of the three pages.
- **F6, accessible names begin with the visible label.** *Make available* is named "Make available {name}"; *Move up* and
  *Move down* are named "Move up {name}" and "Move down {name}". *86* keeps "Mark {name} 86" (it contains the visible
  label and reads well aloud). Update the copy table, and assert each name.
- **F7, an urgent state command while an editor is open (lead ruling).** *86* and *Make available* **act at once** while
  a rename or reorder editor holds unsaved changes: no departure decision, and the draft is kept. They change
  availability only, which never changes a rename or a reorder scope. Under F1's rule, their answer, when it is the
  standing version plus one, is the page's own write and nothing else, so the open editor's base advances with the list
  and the draft does not go stale. (When the answer skips a version, the editor keeps its base and meets
  `CATALOG_CHANGED` on Save, as F1 says.) *Archive* and *Restore* of an item or a category **do** change scopes, so they
  keep going through the departure decision. That decision's body, when a state command opened it, reads: "Your edits
  have not been saved. Stay to keep editing, or discard them to continue." Record both rules in the Handoff and in `D`'s
  *State commands on grouped lists*. While a save of the draft is **pending**, the one-command-per-screen rule still holds:
  *86* is inert until the answer arrives. Assert: 86 with a dirty rename open acts at once, keeps the draft, and a
  following Save is accepted; Archive with a dirty rename open opens the decision with the new body.
- **Checks.** Run `design019.cjs` once, then the six earlier checks once each (F5 changes `tables.html` and
  `settings.html`). Ask the owner in the pane before each run. Change nothing else.

## Handoff

### Delivery and the decisions S4a, S4c and S5 can copy

Drawn by `design019` (Codex) on `agent/design-019` and finished by `design019c`
(Claude Opus, under the owner's exception of 2026-10-22). The finishing pass
reviewed the draft against this task's rulings, *What to draw* and acceptance
criteria, and kept it. Two things were corrected and one rule was added; see
*Finishing pass* below. The artifact is
`docs/design/visual-directions/frost/back-office/menu.html`, with `menu.css`,
`menu.js` and `menu-states.js`. It consumes `office.css`, `office.js` and
`tables.css`. These are local review drawings, with illustrative records and
explicit result selectors, not application code or a second configuration API.
No credential, request or configuration is stored or sent. No token is added.

The lead gave four rulings, restated in the *Handover* section above:
category names are 1–32 characters; reorder uses Move up, Move down and Save
order; archiving a category needs no confirmation, and the copy says it hides
the items from the POS without changing them; and Edit links carry their own
item's identity while `P/item-editor.html` is not edited. The later instruction
to carry parameters only superseded an earlier answer that allowed an adapter.
They are recorded here so the lead can carry them into DECISIONS, which this
role cannot edit.

| Rule for builders | Decision and reason |
|---|---|
| Category names | Trim before validating. Require 1–32 UTF-16 units, reject Unicode Cc controls, and do not truncate with maxlength. Check empty, length, then controls. A valid name typed after a refusal clears the obsolete error and enables Create for a new validation. This follows BO-05's compact name precedent. |
| Category uniqueness | Unique among active categories, case-insensitively. Create, rename of an active category and restore into a held name are refused DUPLICATE. Archived categories may share names and may be renamed. A rename never also restores the category. |
| Item restore uniqueness | An active item anywhere in the menu may hold the name. Refusal keeps the archived row and points to its own Edit action; DESIGN-020 owns the actual rename. Restore remains a separate action afterwards. |
| Grouping and row order | Active categories first, then archived categories. Each set is in stored display order, ties by case-insensitive name and then stable identity. Within each category, active items precede archived items, with the same ordering rule inside each set. All categories and items remain visible; no filter can hide the affected subject after a command. |
| Creation and restoration order | New categories go last among all stored category positions; new items go last in their category. Restoring retains the stored position and rejoins the active group, with the tie rule above. |
| Reorder | The complete active categories, or all active items of one active category, form one scope. Explicit Move up/Move down changes the draft only. Save order sends the complete scope and its opening catalog version once. Archived records retain their stored order. First-up and last-down are disabled. Keyboard activation works without dragging. A scope with fewer than two active records has no order to change: Reorder categories is disabled below two active categories, and a category's Reorder items below two active items in it (including an empty category). A reorder needs a complete read: its openers are disabled while the list is loading, failed or partial. |
| Category archive | No confirmation: it is reversible and changes no item. The category header explains the effect before the action; the result names the category and states that item status and availability are unchanged. |
| Archived categories | Keep the group after the active categories, label it Archived category, retain every item with its own active and availability flags, and label the rows Hidden from the POS · category archived. Rename and Restore remain in the group header; New item and Reorder items are absent until restoration. |
| Item availability when archived | 86 and Make available remain on every row, including archived items and items in archived categories, per C1 §3. Their stored availability changes, but an archived item/category still keeps the item hidden from the POS. |
| Version-bearing commands | Category rename and both reorders carry the catalog version read when their editor opened. A reread alone never rebases the draft. |
| The list's version (round 2, F1) | BO-03 keeps the version its list stands at. A full read sets it. A command answer advances it to the answered version only when that version is exactly the standing version plus one, or equal to it for an unchanged answer. Otherwise the list keeps its standing version, so the next edit opened from it is refused `CATALOG_CHANGED` and rereads. An editor carries the list's standing version at the moment it opens. |
| Availability over an open editor (round 2, F7) | 86 and Make available act at once while an editor holds unsaved changes: no departure decision, and the draft is kept. They change availability only, which never changes a rename or a reorder scope. When their answer is the list's standing version plus one, the open editor's base advances with the list and the draft does not go stale; when it skips a version, the editor keeps its base and meets `CATALOG_CHANGED` on Save. While a save of the draft is pending, 86 is inert until the answer arrives. |
| Archive and restore over an open editor (round 2, F7) | Archive and Restore of an item or a category change scopes, so they go through the departure decision. Its body then reads: Your edits have not been saved. Stay to keep editing, or discard them to continue. |
| Commands without a version | Category create, 86, available again, category/item archive and category/item restore carry none and cannot be refused CATALOG_CHANGED. Every committed catalog write still advances the version exactly once; no-op commands do not. |
| Prices | The stored tax-inclusive base price, whole rupiah with dot grouping and no currency prefix. BO-03 has no price input. |

The four table columns are Item, Base price · IDR, Availability and Actions.
Category headers carry their own controls. An editor opens as a full-width
non-modal panel above the table, using the existing panel, field and button
styles; its two internal columns put the draft beside its result/comparison.
This keeps prices and urgent availability actions legible while an editor is
open. The Phase 1 rail lists Menu, Tables and Settings (round 2, F5); `tables.html`
and `settings.html` now show all three. There is no Phase 5 business-day fact.

The default fixture has four categories and ten items, including one archived
category, one archived item and two unavailable items. Overflow adds 48 items
for 58 total, with a 32-unit category name, 80-unit item stress names, and
99.999.999 prices. The 80-unit fixture exercises wrapping; it does not decide
BO-04's item-name schema. DESIGN-020 must settle that limit and recheck its
longest name against this table. Counts derive from records and are withheld
while loading, after a failed read and in the partial-list state.

### Requirement and state map

All 74 states are registered in `menu-states.js` and `manifest.js`; the gallery
loads them from that manifest. The old Paper state list is kept separately as
`paperStates`, and the gallery selects it only for Paper. Paper files are not
changed.

| Requirement, ruling or task item | Drawing or walk |
|---|---|
| I BO-03 empty; B-24; Part A first category and item | `empty` has zero categories/items. New category creates the first category; its own New item link carries that category to BO-04. |
| I loading / error; shared read failure | `loading`, `error`; Try again repeats the read only. Permission denied remains the shared session handling, not a new menu permission state. |
| I overflow; DESIGN-011 sticky header / 86 / fixture counts | `overflow`; every row retains its own availability action and base price. The browser script measures the header against its scroll owner at both sizes and compares counts with records. |
| FR-B4 category create/edit; DESIGN-011 recovery | `category`, `rename`, `rename-archived`, `category-invalid`, `invalid-long`, `invalid-control`; recovery is an interactive input/submit walk. |
| C2 validation / authoritative result | `saving`, `saved`, `failure`; one command at a time, invalid input sends nothing, saved closes the editor and replaces its own record. An unchanged save closes with the version still current. |
| Names unique while active | `duplicate-create`, `duplicate-rename`, `duplicate-category-restore`, `duplicate-item-restore`; the current holder stays visible. A refused restore remains a page result, with Rename/Edit as the explicit recovery path. |
| Unknown outcomes and reread failure | `unknown`, `unknown-changed`, `unknown-read-failed`; no resend and no inferred success. The ordinary explicit save remains available unless a stale comparison first requires a decision. |
| ADR-012 rules 10 and 13; list edit refusal | `stale`, `stale-read-failed`, `reorder-categories-stale`, `reorder-items-stale`; draft kept, one reread, current value/order shown, Save disabled until Keep my changes or Use current menu. |
| Reorder without dragging | `reorder-categories-edit`, `reorder-items-edit`, each with `-pending`, `-saved`, `-stale`, `-unknown`. Keyboard Enter activates Move down; saved order carries the opening version. |
| Q10 restore / FR-C8 / B-8 retention | `category-archived`, `category-restored`, `item-archived`, `item-restored`. Category archive/restore leaves all item flags unchanged. Existing-order snapshots are described as unchanged. |
| Direct 86 and reversal / FR-B6, C5, C6 / C-3 | `eightysix`, `available`; the check walks both directions on every item, including archived records. Each result names the selected item, with no form. |
| Page result matrix for state commands | `pending-`, `unknown-`, `failure-`, `session-`, each followed by `86`, `available`, `category-archive`, `category-restore`, `item-archive`, or `item-restore`. All 24 are registered; none sends a catalog version. |
| Configuration departure / no automatic resend | `unsaved`, `unsaved-logout`, `leave-pending`, `leave-unknown`; Cancel, Escape, browser Back, rail and logout walks. Discard never cancels an already-sent command; a late authoritative answer updates its record silently. |
| M-6 / BO-01 draft isolation | `reauth`, `bo01-draft`, `reauth-decision`, `bo01-decision`; same-manager recovery keeps the draft and does not submit, different-manager sign-in destroys it. BO-01 closes working-area modal dialogs before its fields become usable. |
| F4 partial list | `partial`; known rows include the saved Main plates category, counts are withheld, New stays live, and Try again reads the full menu. |
| FR-G13 / AC-29 / C-4 / owner Q13 | `leaserejected` is explicitly **Phase 4 only** in the artifact and gallery. It names Quick-sale order ORD-1048, opened 20:14. S5 must not build this refusal. No table-settlement refusal is implied. |
| Cross-client 86 / S cross-client flow / AC-12 | Review the Steak row in `F/menu.html?state=eightysix` beside the existing Frost `pos/order.html?state=eightysix`. This is paired visual evidence only, not product navigation or proof of a three-second integration. Add/fire validation remains Phase 2/3; DESIGN-021 owns the new POS states. |
| Subject-correct Edit / Part A.2, latest lead ruling | Every Edit URL targets P/item-editor.html with its row's `item`, `category`, `return=frost-menu` and `returnItem`. The check compares every URL with that row's identity. BO-04 ignores these today; the visible editor/Cancel/return walk belongs to DESIGN-020. |
| Part B | DESIGN's DESIGN-019 additions separate binding reorder/grouped-command/stale-list behaviour from BO-03 copy and composition. Existing rules are unchanged. |
| Part C rail, inventory, sitemap, gallery | Menu already resolves to Frost in office.js, so it is untouched. The manifest, gallery, inventory and sitemap now name every required family. DESIGN-014 changes only its expected authored Menu prototype-link count. |
| B-13 / owner Q11 / constraints | M. Iqbal and Ratna Ayu are named; no audit trace, stock, image, timing control, nested modifier group or POS operation is added. |

### Exact copy and accessible names for S4c and S5

Braces below denote trusted record values, never server or schema error messages.
Tests identify a row by its stable record identity before selecting a named
control, since archived records may share names. Review selectors, the fixture
explanation, Phase 4 build annotation and All states link are outside product
copy. BO-01/M-6 reuse the reviewed session components; this fixture only composes
them with the menu draft.

| State / context | Element | Exact text | Accessible name / test target |
|---|---|---|---|
| Frame | Heading / rail / top bar | Menu | heading Menu; rail link Menu |
| Frame | Actor / logout | `{manager} · Manager` / Log out | link Log out |
| Menu | Count | `{categories} categories · {items} items` | `#menu-count`; absent unless full read succeeded |
| Menu | Context | Prices include tax · Whole rupiah · IDR. Changes reach the POS within three seconds. Existing orders keep their saved names and prices. | paragraph |
| Toolbar | Actions | New category / Reorder categories | same button names |
| Table | Caption | Active categories first · Archived items stay in their category | table caption |
| Table | Headers | Item / Base price · IDR / Availability / Actions | column headers |
| Category | Heading | `{name}` or `{name} · Archived category` | heading level 2 |
| Active category | Effect note | Archiving this category hides its items from the POS without changing them. | group note |
| Archived category | Effect note | Hidden from the POS. Item status and availability are kept. Restore this category to show its active, available items again. | group note |
| Category | Rename / archive / restore | Rename / Archive / Restore | Rename category {name}; Archive category {name}; Restore category {name} |
| Active category | Reorder / add | Reorder items / New item | Reorder items in {name}; New item in {name} |
| Empty category | Body | No items in this category yet. Use New item to add the first one. | row text |
| Empty archived category | Body | No items in this category yet. Restore the category before adding an item. | row text |
| Item | Options / archive status | `{n} variants · {n} modifiers` / Archived item | row text |
| Item | Availability | Available / 86 · Unavailable | row text |
| Item | Availability action | 86 / Make available | Mark {name} 86; Make available {name} |
| Item | Edit / archive / restore | Edit / Archive / Restore | Edit {name}; Archive item {name}; Restore item {name} |
| Hidden item | Note | Hidden from the POS · category archived / Hidden from the POS · item archived | category reason takes precedence when both are archived |
| Empty menu | Heading / body | No menu yet / Nothing is preloaded. Create a category, then add your first item. | New category remains the sole creation entry |
| Loading | Status | Loading menu… | status |
| Read failure | Title / body / action | Menu could not be loaded / Try again to read the menu. / Try again | alert; read-only button Try again |
| Partial list | Title | The menu list may be out of date | alert |
| Partial list | Body / action | The menu could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list. / Try again | read-only button Try again |
| Read recovered | Status | The menu has been refreshed. | not used to infer an unknown command's result |
| Category form | Heading | New category / Rename {name} | named non-modal dialog |
| Category form | Create context | Choose the category name staff will see at the POS. | paragraph |
| Category form | Rename context | Rename this category. Existing orders keep their saved names. | paragraph |
| Archived rename | Context | Archived category. Saving its name does not restore it. | paragraph |
| Category form | Label / helper | Category name / 1–32 characters. Active categories must have different names. | textbox Category name; helper in aria-describedby |
| Category form | Actions | Create / Save / Cancel | button names; Create only for creation |
| Invalid empty | Field error | Enter a name | `#name-error`; invalid field described and focused |
| Invalid long | Field error | Use 32 characters or fewer. | same |
| Invalid control | Field error | Remove control characters from the name. | same |
| Create / rename duplicate | Field error | An active category already uses this name. Choose another name. | same; list reread |
| Duplicate holder | Marker | Name in use | visible row/group text |
| Restore duplicate | Page result | `{name} was not restored. An active category already uses this name. Rename this archived category, save, then restore it.` | focusable page alert; Rename is a separate action |
| Item restore duplicate | Page result | `{name} was not restored. An active item already uses this name. Rename this archived item in the item editor, save, then restore it.` | focusable page alert; own Edit link is the recovery |
| Reorder | Heading | Reorder categories / Reorder items in {category} | named non-modal dialog |
| Reorder | Context | Move each row up or down, then save the full order. Archived records keep their stored order. | paragraph |
| Reorder | Row / controls | `{position}. {name}` / Move up / Move down | Move up {name}; Move down {name} |
| Reorder | Submit / cancel | Save order / Cancel | exact buttons |
| Pending edit | Status | Saving… Wait for the result. Your draft is kept. | focusable form status |
| Saved category | Result | `{name} saved.` | page status |
| Saved order | Result | Category order saved. / `Item order in {category} saved.` | page status |
| Unchanged | Result | `Nothing changed. Menu version {n} is still current.` | page status |
| Stale refusal | Notice | `The menu changed while you were editing. Nothing was saved. The menu has been read again at version {n}. Your draft is kept. Choose which to keep.` | focusable form alert |
| Stale comparison | Heading / value | Current menu / `Current category name: {name}` or `Current order: {names separated by →}` | current values beside draft |
| Stale choices | Controls / disabled reason | Keep my changes / Use current menu / Choose Keep my changes or Use current menu first. | exact buttons; reason describes disabled Save |
| After Keep | Notice | `Your changes now build on version {n}. Nothing has been saved yet. Press Save to save them.` | use Save order for a reorder |
| After Use | Notice | `The form now shows version {n}. Nothing was saved. Edit it and save, or Cancel to close.` | form status |
| Stale reread failed | Notice | The menu changed while you were editing. Nothing was saved. Your draft is kept, but the current menu could not be read. Try again to read it before choosing. | read-only Try again; Save stays disabled |
| Definite edit failure | Notice | Something went wrong. Nothing was saved. Your draft is kept. Press Save to try again. | substitute Create or Save order for that form's submit label |
| Unknown edit | Notice | Outcome not confirmed. The menu has been refreshed. Your draft is kept; nothing was sent again. | form status |
| Unknown edit, read failed | Notice | Outcome not confirmed. The menu could not be refreshed. Your draft is kept; nothing was sent again. | read-only Try again |
| Unknown, newer menu | Notice | `Outcome not confirmed. The menu has been read again at version {n}. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.` | comparison and explicit choices; no inferred success |
| 86 pending / available pending | Page result | `Marking {name} 86…` / `Making {name} available…` | focusable page status; no form |
| Archive / restore pending | Page result | `Archiving {name}…` / `Restoring {name}…` | same |
| 86 saved | Page result | `{name} is now marked 86. At the POS it is disabled in place, not removed.` | page status; an item the POS offers |
| 86 saved, hidden item | Page result | `{name} is now marked 86.` It stays hidden from the POS while it or its category is archived. | page status; the item or its category is archived |
| Available saved | Page result | `{name} is available again.` | append hidden qualifier below when relevant |
| Available, still archived | Additional sentence | It stays hidden from the POS while it or its category is archived. | page status |
| Category archived | Page result | `{name} archived. Its items are hidden from the POS; their status and availability are unchanged.` | page status |
| Category restored | Page result | `{name} restored. Its active, available items are shown at the POS again.` | page status |
| Item archived / restored | Page result | `{name} archived. It is kept for history.` / `{name} restored.` | page status |
| Item in archived category | Additional sentence | Its category is archived, so it stays hidden from the POS. | appended to item archive/restore result |
| Unknown state command | Page result | `{name}: the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.` | use The menu could not be refreshed. when the reread failed |
| Definite state failure | Page result | `Something went wrong. {name} was not changed. Use its row action to try again.` | focusable page alert |
| State session refusal | Result after resuming | `{name} was not changed. Use its row action to try again.` | no resent command |
| Form session refusal | Notice after resuming | Nothing was saved. Your draft is kept. Press Save to try again. | substitute Create / Save order |
| Discard, pending answer | Status | Waiting for an earlier save to finish. Nothing will be sent again. | clears silently with answer |
| Ordinary departure | Title / body | Discard unsaved changes? / Your edits have not been saved. Stay to keep editing, or discard them before leaving. | named modal dialog |
| Pending / unknown departure | Body | The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave. | same dialog |
| Ordinary departure | Actions | Stay / Discard | exact buttons; Stay initially focused |
| Departure opened by Archive or Restore | Body | Your edits have not been saved. Stay to keep editing, or discard them to continue. | same dialog, title and actions |
| Logout decision | Title / body | Log out and discard your changes? / The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session. | reviewed logout copy |
| Logout decision | Actions | Keep this draft / Discard changes and log out | exact buttons |
| Uncertain logout | Additional sentence | The save may or may not have succeeded. Leaving does not send it again. | separate context paragraph |
| Departure emergency | Sentence | Decide whether to stay or discard before opening print incidents. | existing incident title and identity repeated |
| Logout emergency | Sentence | Decide whether to keep this draft or discard it before opening print incidents. | same |
| M-6 | Title / body | Your session timed out / Your unsaved changes are kept. Continue as m.iqbal to resume them. | named modal; background visible and inert |
| M-6 | Fields / actions | Username / Password / Continue / Log out / Sign in as a different manager | exact names; own username read-only |
| M-6 empty secret | Error | Enter your password. | field error |
| Other-manager acknowledgement | Title / body | Sign in as a different manager? / The current manager’s unsaved changes will not be available to the manager signing in. | named modal |
| Other-manager acknowledgement | Actions | Stay with current manager / Continue to sign-in | exact buttons |
| Other-manager sign-in | Title / body | Sign in as a different manager / Enter your own username and password. The current manager’s unsaved changes will not be available to you. | named modal |
| Other-manager sign-in | Actions | Back to m.iqbal / Sign in | editable Username and Password |
| M-6 emergency | Sentence / action | Continue your session to open print incidents. / Open print incidents after sign-in | exact button |
| Queued M-6 emergency | Body | Continue as m.iqbal to open print incidents. Your unsaved changes are kept. | held destination; departure follows authentication |
| BO-01 held draft | Heading / intro | Back office / Sign in with your manager username and password. | working area hidden |
| BO-01 held draft | Notice | Your session has ended / Sign in again to continue. / The previous session’s unsaved changes are stored on this tab and are not submitted automatically. | no previous manager identity or draft displayed |
| BO-01 | Fields / action / local errors | Username / Password / Sign in / Enter your username. / Enter your password. | exact names |
| Phase 4 lease refusal | Page result | `{name} was not marked 86. Quick-sale order ORD-1048 (opened 20:14) is being paid and includes this item. Try again when payment is no longer in progress.` | focusable page alert; order identity from refusal |

### Focus and command lifetime

| Moment | Focus and behaviour |
|---|---|
| Open category form / invalid / duplicate / ordinary failure or unknown | Category name. An obsolete error clears on edit. |
| Open reorder | First enabled move control. Moving retains the record's control, falling back to its other direction at an edge. |
| Save / Create / Save order pending | The focusable Saving notice; fields and all command openers are inert. Cancel, rail, logout and incident navigation remain available. |
| Stale or unknown with newer version | The refusal/comparison notice. Keep moves to Save; Use current moves to Category name or the first enabled move control. |
| Category saved or state command succeeded | The affected category's Rename. |
| Item state command succeeded | The affected item's Edit. |
| Reorder saved | The Reorder categories / Reorder items opener for that scope. |
| State command pending, unknown, definite failure, duplicate restore or lease refusal | The page status; no form or resend control. |
| Clean Cancel or Discard | That editor's opener, not the first row. |
| Departure opens / Escape while departure open | Stay; Escape means Stay. |
| Stay | Category name, or the first enabled move control; draft and request context retained. |
| Same manager resumes | Draft field/control, or the still-pending departure decision's Stay first. Held responses are consumed under their actual result; recovery does not resubmit. |
| Different manager resumes | New category; prior draft and pending context destroyed, no old result announced. |
| Discard while save pending | Waiting sentence; late authoritative record still updates the list silently, without reopening a form or announcing. |

### Finishing pass (design019c, 2026-10-22)

1. **The length failure is fixed.** The overflow fixture's longest category name
   was `Category ABCDEFGHIJKLMNOPQRSTUVWX`, 33 characters against the 32-character
   rule. It is now `Category ABCDEFGHIJKLMNOPQRSTUVW`, exactly 32, and the check's
   existing assertion (`category === 32`) passes unchanged (`menu.js`, overflow
   fixture).
2. **A shared control was wrong in some states.** *Reorder items* was enabled on
   every active category. In a category with one active item (Sides, Drinks in the
   default fixture) or none (a category just created), it opened a reorder panel
   with every move disabled, where focus had no target and Save order could only
   answer "Nothing changed". It is now disabled below two active items, the same
   rule the draft already applied to *Reorder categories*. The rule ships as code
   in `menu.js` and as two new assertions in `design019.cjs` ("nothing to reorder
   in an empty scope"; "Reorder items needs two active items"), and is written into
   `D`'s DESIGN-019 reorder behaviour and the rules table above.
3. **Checked and kept.** The draft meets each ruling: no state command or create
   carries a version (asserted for every command in every state); state commands
   open no form; the Phase 4 refusal is marked in the artifact and the gallery;
   archived categories keep their items visible with their own flags; restore
   into a held name is a page result with Rename or Edit as the way out; no audit
   trace, stock, image or timing control appears; every person is named
   (M. Iqbal, Ratna Ayu); `menu.css` uses tokens only. No token was added, so
   `npm run verify` does not apply (nothing under `docs/design/tokens/` changed).

### Verification and measurements

Run with the owner's approval in the pane, once, after the finishing changes:
`PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/design019.cjs`
→ **969 / 969 passed**, 74 states, no page errors, exit 0. The two added
assertions account for the change from the lead's 967. Evidence (screenshots of
every state at both sizes, and `measurements.json`) is in
`/tmp/design019-evidence/run1`, outside the repository.

Measurements from that run:

| Viewport | Frame width / x | Rail | Top bar | Field height | Content padding | Overflow, scrolled 850px: header top / scroll-owner top | Long names |
|---|---|---|---|---|---|---|---|
| 1440×900 | 1440 / 0 | 220 | 64 | 40 | 24px | 64 / 64 (sticky) | category 32, item 80, 0 cells overflowing |
| 1920×1080 | 1440 / 240 | 220 | 64 | 40 | 24px | 64 / 64 (sticky) | category 32, item 80, 0 cells overflowing |

In every one of the 74 states at both sizes: no horizontal page overflow,
content overflow ≤ 1px, one visible `main`, every item row has its availability
action and a whole-rupiah price, counts agree with the fixture's records
wherever a count is shown, and every open dialog fits the viewport.

**Not rerun:** the six earlier checks. The finishing pass changed only
`menu.js`, `design019.cjs`, `D` and this Handoff; no shared file (`office.*`,
`manifest.js`, `review.js`, `index.html`, another artifact) changed after the
lead's run on the draft, which passed all six: `design012` 421/421, `design013`
371/371, `design014` 288/288, `design016` 399/399, `design017` 347/347,
`design018` 724/724. Screenshots of `default`, `stale`, `overflow` (scrolled),
`reauth`, `duplicate-item-restore` and `leaserejected` at 1440 were inspected by
eye.

### Link migration and scope

`grep -c "prototype/"` counts matching source lines, against `HEAD` (`2cc05ff`):

| Artifact | Before | After | Why |
|---|---|---|---|
| `F/menu.html` | 34 | 0 | The old page hard-coded its rail (end-of-day, presets, reports, users) and 30 item-editor links; the rail now comes from `office.js` and rows are rendered by `menu.js`. |
| `F/menu.js` | (new) | 1 | `editorHref`: the one BO-04 destination, `../../../prototype/back-office/item-editor.html` with the row's `item`, `category`, `return=frost-menu` and `returnItem` (`state=new` for New item). |
| `F/menu.css`, `F/menu-states.js` | (new) | 0 | — |
| `F/office.js` | 1 | 1 | Unchanged: it already resolves `menu` to `menu.html`. |

`design014.cjs` changes only its expected authored count for `menu.html`, from
34 to 0; no assertion is weakened. No change is made to `P/item-editor.html`,
`apps/`, `packages/`, `db/`, `e2e/`, accepted ADRs, consults or the four
product documents.

**`I` BO-03, changed lines** (`git diff -U0`):

```
@@ -683,10 +683,24 @@
-**States.** *empty* (no items yet — the state a new installation starts in,
-because no menu is hard-coded, B-24) · *loading* · *error* · *permission-denied*
-(n/a; back office is manager only) · *overflow* (long menu: dense table,
-sticky headers, no truncation of price or availability) · *item 86'd* ·
-*86 rejected while a CheckoutLease holds a quick-sale order carrying that item,
-naming the order* (FR-G13, AC-29) · *item archived* (FR-C8) ·
-*category-invalid* — Create tapped with an empty name; the Name field is
-invalid with "Enter a name"; Create stays disabled until a name is entered;
-nothing is written (added 2026-09-14 by the lead's ruling in DESIGN-005
-finding 4; a state of the category modal, not a new node).
+**States.** *empty* (no category and no item; create the first category, then
+its first item; B-24) · *loading* · *read failure with Try again* ·
+*permission-denied* (n/a; manager only) · *overflow* (grouped long menu,
+sticky headers, complete prices and availability actions) · *category create
+and rename*, including archived categories · *local invalid category name*
+(empty, more than 32 UTF-16 units, control character; trimmed before checking;
+"Enter a name" for empty; typing clears the error and enables Create again) ·
+*name in use* on category create, rename or restore, and on item restore ·
+*category and item archived / restored* (retained rows; archived categories
+show all their items and explain that they are hidden from the POS without
+changing their status or availability) · *86 / available again*, directly
+from each row · *category reorder / item reorder within a category*, with
+Move up, Move down and Save order · *catalog changed on rename or reorder*
+(`CATALOG_CHANGED`: nothing saved, draft/order kept, menu reread, explicit
+Keep my changes or Use current menu before Save) · *pending, saved, definite
+failure and outcome unknown* · *partial list — the menu list may be out of date*
+(counts withheld, known rows with the latest answer, Try again reads the full
+list) · *departure decision* · *M-6 over an inert form* · *BO-01 with draft held* ·
+*Phase 4 only: 86 refused while a CheckoutLease holds a quick-sale order carrying
+that item, naming the order* (FR-G13, AC-29; S5 does not build this refusal).
+Creates and state commands never carry the catalog version and cannot be refused
+for a stale catalog. Every committed catalog write, including 86, archive and
+restore, advances the version. The [Frost BO-03 composition](visual-directions/frost/back-office/menu.html)
+and DESIGN-019 Handoff supply the exact copy and walks, pending design review.
```

One change of meaning to flag for the reviewer: the old *category-invalid* line
said "Create stays disabled until a name is entered". The draft, following
DESIGN-011's recovery finding, keeps Create enabled and validates on press,
showing "Enter a name"; typing clears the error. Nothing is written either way.

**`S` BO-03 and the cross-client flows, changed lines** (`git diff -U0`):

```
@@ -269,5 +269,11 @@
-│   │   ├── [INLINE] 86 toggle per item row ............... FR-B6, C5
-│   │   ├── [INLINE] 86 rejected — item on a leased order . FR-G13
-│   │   ├── [MODAL] Category create / edit ................ FR-B4
-│   │   ├── [INLINE] Category create refused — empty name . FR-B4
-│   │   └── [INLINE] Empty — no items yet ................. FR-B4
+│   │   ├── [INLINE] 86 / available again per item row .... FR-B6, C5
+│   │   ├── [INLINE] Phase 4: 86 refused — leased quick sale, order named  FR-G13
+│   │   ├── [INLINE] Category create / rename — non-modal panel  FR-B4
+│   │   ├── [INLINE] Category name invalid / name in use .. FR-B4
+│   │   ├── [INLINE] Archive / restore category or item; name-in-use refusal  FR-B4, C8
+│   │   ├── [INLINE] Archived category — items retained, hidden from POS  FR-B4, C8
+│   │   ├── [INLINE] Reorder categories / items — Move up, Move down, Save order  FR-B4
+│   │   ├── [INLINE] Catalog changed — rename / reorder draft kept  ADR-012
+│   │   ├── [INLINE] Partial list — may be out of date .... FR-B4
+│   │   ├── [MODAL] Stay or discard unsaved changes ....... FR-A2b
+│   │   └── [INLINE] Empty — create a category, then an item  FR-B4, B-24
@@ -367 +373,3 @@
-   visibly.
+   visibly. DESIGN-019 pairs its Steak 86 state with the existing Frost POS
+   `order.html?state=eightysix` as review evidence only; no product navigation
+   crosses clients and no timed integration result is claimed.
@@ -376,0 +385 @@
+   This refusal arrives in Phase 4; DESIGN-019 marks it separately from S5.
```

### Questions and downstream work

No question blocks this design. The subject-adapter question was resolved by
the lead's ruling: carry parameters only. One question is raised and not ruled:

- **C1 names no command for reordering the items of a category.** C1 §2.2
  *Display order* makes "the items of a category" a reorder scope, and this task
  draws that reorder with a version and a `CATALOG_CHANGED` refusal, but C1 §2.3's
  command table lists only `reorderCategories(expected, ids)`. **Proposed
  answer:** S4a adds `reorderItems(categoryId, expected, ids)`, which carries the
  version, is refused `CATALOG_CHANGED` when stale, and is refused
  `VALIDATION_FAILED` for a list that is not exactly the active items of that
  active category, mirroring `reorderCategories`. A reorder into an archived
  category cannot be opened from BO-03 (the control is absent there), so a stale
  read naming one is the `CATALOG_CHANGED` case. The architect owns the wording.

For **DESIGN-020**: consume the `item`, `category`, `return=frost-menu` and
`returnItem` parameters every Edit and New item link carries (New item adds
`state=new`); draw the editor's Cancel and return walk back to the same row
(BO-03 highlights `?item=` on return through `data-selected`); settle the item
name length guard and recheck this table's longest name against it (the
80-unit overflow name is a stress fixture, not a decision); and note that an
item restore refused *name in use* sends the manager to BO-04 to rename it,
after which Restore on BO-03 remains a separate action. A category create and the
state commands never carry the catalog version and cannot be refused for a stale
catalog. An item create (BO-04) carries none either, but is refused
`CATALOG_CHANGED` when its category has been archived (C1 §2.3). Items in an
archived category keep `is_active`, so under C1 §2.2's partial unique index their
names stay held while the category is archived: an item create elsewhere with such
a name is refused `DUPLICATE`, and BO-04 should say why.

For **DESIGN-021**: the new POS catalog and 86-sheet states are yours. The
existing Steak pair (`F/menu.html?state=eightysix` beside
`frost/pos/order.html?state=eightysix`) is review evidence only.

The formal design review is the lead's next step before S4c and S5 are written.

DONE

### Round 2 (design019c, 2026-10-22)

The lead's rulings in *Round 2 — the review's seven findings* are applied as
written. The rules and copy above are updated in place. Each changed row says
"round 2" where it is new, and the copy table carries the new names and rows.

**What changed.**

| Finding | Change |
|---|---|
| F1, the list's version | `menu.js` keeps `listVersion` apart from the server's `version`. A full read sets it. A *received* answer moves it only when the answer is the standing version plus one (or equal, for an unchanged answer). An editor opens with `base: listVersion`. A review fixture, *Another tab saves a change* (`#fixture-other`, outside the product), advances the server's version without the list reading it. The rule is added word for word to the rules table and to `D`'s *Catalog changed during a list edit*. |
| F2, the 86 result for a hidden item | An item that is archived, or whose category is archived, gets `{name} is now marked 86.` followed by "It stays hidden from the POS while it or its category is archived." Offered items keep "At the POS it is disabled in place, not removed." Both rows are in the copy table. |
| F3, reorder needs a complete read | *Reorder categories* and every *Reorder items* are disabled unless the read is complete (not while loading, failed or partial). Added to the reorder rule here and in `D`. |
| F4, the inventory's create sentence | `I` BO-03's sentence is replaced with the ruling's wording, which scopes immunity to the category create and the state commands and names the item create's `CATALOG_CHANGED` when its category has been archived. The same line, with the review's note on names held by items in an archived category, is added to *For DESIGN-020* above. |
| F5, the Phase 1 rail | `menu.html` authors Configuration → Menu, Tables, Settings, with Menu current. `tables.html` and `settings.html` add *Menu* before Tables. `D`'s rail sentence is replaced with the ruling's wording, and the sentence about the future rail in this Handoff is replaced to match. `grep -c "prototype/"` is 0 before and after for all three files, because the Phase 1 entries are local. |
| F6, label in name | *Make available* is named "Make available {name}"; *Move up* and *Move down* are named "Move up {name}" and "Move down {name}". *86* keeps "Mark {name} 86". |
| F7, availability over an open editor | *86* and *Make available* call the command directly, with no departure decision; the draft stays open and the item's Edit takes focus. Archive and Restore keep the decision, and its body is then "Your edits have not been saved. Stay to keep editing, or discard them to continue." While a save is pending, the row controls stay inert, as before. Recorded in the rules table, the copy table and `D`'s *State commands on grouped lists*. |

One rule is applied more broadly than the ruling's words, and I'm noting it
here. The ruling names "a rename or reorder editor". The code acts at once over
any open editor, including *New category*. A category create carries no
version, so an availability answer cannot make it stale. Routing it through a
decision would contradict the task's ruling that an 86 acts at once.

**Two check-script changes outside the new assertions.**
- In `design019.cjs`, the keyboard-reorder walk used to find the move-down
  button by its name (`/down$/`). F6 changed that name, so the walk now selects
  the button by `[data-delta="1"]`. The assertion itself is unchanged, and the
  names are now asserted separately (F6).
- In `design014.cjs`, the lead ruled to remove `'menu'` from the loop at line
  147 that waits for a rail entry `[data-nav="audit"]`. Under F5, `menu.html`
  draws the Phase 1 rail, which has no Audit entry, so that wait timed out.
  This is an expectation change caused by the F5 rule. Nothing else is
  weakened, and the four other pages in that loop are still asserted.
  `design014` goes from 288 assertions to 287 for that reason.

**New assertions, and their red against round 1.** I exported round 1
(`907a9c8`) to the scratchpad and ran the round-2 `design019.cjs` against it
once, with the owner's approval. Result: **978 / 995**. All 969 round-1
assertions passed, and 17 new assertions failed:

| Assertion | Red against round 1 |
|---|---|
| F1 skipped answer: next rename refused stale | Failed. Round 1 has no way to represent another tab's write: the fixture hook is absent, and its single version moved with every answer. The rename after 86 was accepted. |
| F2 hidden item 86 result pie / stew | Failed: "Apple Pie is now marked 86. At the POS it is disabled in place, not removed." (Winter Stew the same) |
| F3 reorder openers disabled loading / error / partial | Failed in all three |
| F5 Phase 1 rail on menu / tables / settings | Failed: menu showed the ten-entry future rail; tables and settings showed only Tables and Settings |
| F5 walk tables → menu, settings → menu | Failed: no entry |
| F6 availability names; move names in both reorder states | Failed: "Make Soda available", "Move Mains up" |
| F7 86 acts at once over a dirty rename | Failed: the departure decision opened |
| F7 Archive item / Archive category asks, worded to continue | Failed: the body said "… discard them before leaving." |

Nine new assertions pass on both rounds, because they cover behaviour round 1
already had. They are kept so the new rule's positive half is tested:
- F1 contiguous answer: the list advances and the rename is accepted.
- F2: an offered item keeps "disabled in place".
- Seven F5 walks between pages whose entries round 1 already had.

**What the checks caught in round 2 itself.**
- The first run on the round 2 tree stopped on a bug in my new check code: it
  clicked the hidden review-fixtures button directly. The check now presses it
  through the page script, as it already does for its other fixture buttons.
- The second run failed two existing assertions ("explicit save after Keep" in
  `unknown-changed` and `reorder-items-unknown`). They exposed a flaw in my
  first F1 code: an unknown outcome's simulated server write moved the open
  editor's base, which is a silent rebase. The fix is that only a *received*
  answer moves the list, and only a state command's answer (availability, per
  F7) moves an open editor's base. The two assertions then passed unchanged.

**Counts.**
- Mine, each run with the owner's approval: `design019` **997 / 997**, 74
  states, no page errors, at 1440×900 and 1920×1080. The frame, rail, top bar,
  field and padding measurements are unchanged, and the sticky header still
  meets its scroll owner at 64 / 64. After the ruling's change, `design014`
  passed **287 / 287**.
- The lead's runs on this round 2 tree: `design019` 997/997, `design012`
  421/421, `design013` 371/371, `design016` 399/399, `design017` 347/347,
  `design018` 724/724. Before the ruling's change, `design014` timed out as
  described above.
- My own earlier runs of `design012`, `013`, `016`, `017` and `018` on the same
  tree also exited 0.
- Evidence: `/tmp/design019-evidence/round1-red`, `run2` (the failed run) and
  `run3` (the passing run), outside the repository. `npm run verify` does not
  apply, because nothing under `docs/design/tokens/` changed.

**Question raised, not ruled (proposed answer).** F7 gives the departure body
for a decision opened by Archive or Restore. When the draft's own save is in
doubt (the outcome is unknown), the decision still shows DESIGN-018's
uncertain body: "The save may or may not have succeeded. Leaving does not send
it again. Stay to keep the draft, or discard it and leave." That body talks of
leaving. I kept it rather than invent copy, because it is an existing rule.
**Proposed:** when Archive or Restore opens it, use "The save may or may not
have succeeded. Continuing does not send it again. Stay to keep the draft, or
discard it to continue."

DONE
