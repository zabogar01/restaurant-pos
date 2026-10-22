---
id: DESIGN-020
title: BO-04 Item editor in Frost (slice D, second part) — item fields, variants and modifiers, prices, the catalog-changed refusal, and BO-03's links into it
category: ui
touches: [money, boundaries]
depends_on: [DESIGN-019]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-020 — BO-04 Item editor (slice D, second part)

**Written** 2026-10-22 by the lead. The second of the three tasks that make design slice **D** of the accepted Phase 1
plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4). **DESIGN-019** drew BO-03 (merged as
PR #131); **DESIGN-021** draws the POS addition later. This task draws **BO-04 only**, re-points BO-03's links into it,
and redraws one state of BO-08 (Part D).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design020`).
**Branch and place:** `agent/design-020`, cut from `development` at `d164a23`, in the worktree
`../restaurant-pos-wt/DESIGN-020`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`.

Nothing is built from this task directly. A design review follows; then plan slices **S4a** (the catalog schema and
domain), **S4b** (its routes) and **S4c** (BO-03 and BO-04 in the back office) are written from it and from DESIGN-019.
None is built yet, but their behaviour is fixed by ADR-012 Part 2 and consult C1 §2: draw what they will do, and where
you settle something they leave to the design (name lengths, the price input, how options are ordered and removed),
state it in the Handoff as a rule S4a and S4c can copy.

Abbreviations, as in DESIGN-017 to -019: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C1** = `.agent/reviews/ARCH-018-c1-configuration-schema.md`;
**C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`; **ADR-012** =
`docs/decisions/ADR-012-versioned-configuration.md`.

## Objective

When this task is done, BO-04 has a reviewed Frost composition, `F/item-editor.html` (new; the Paper prototype
`P/item-editor.html` is not edited), in every state S4c will build, with every word it will show (ADR-011 rule 24). The
manager creates an item in a category, or edits one: its name, its category, its tax-inclusive base price, its
**variants** (single-select, signed price delta) and its **modifiers** (multi-select, delta of zero or more), as two
separate lists on that item, and saves the whole change with one Save. The slice draws BO-04's half of ADR-012's catalog
rules: an edit refused because the catalog changed meanwhile (`CATALOG_CHANGED`), and a create refused because its
category was archived meanwhile.

## Required inputs

Read these, in this order.

1. **DESIGN-011**, BO-04 (`.agent/reviews/DESIGN-011-back-office-audit.md:132-151`): the P1 findings (real editable
   option rows with inline errors; the variant / modifier distinction; a new item offering nothing that implies it is
   saved; subject identity from BO-03; M-6 and the preserved draft).
2. **ADR-012 Part 2**, rules 9 to 14, above all **rule 10** and **rule 13** (an *edit* carries the version and is refused
   `CATALOG_CHANGED`; a *create* carries none).
3. **C1 §2.2 and §2.3** (the catalog tables, their notes, the command table, and `editItem`'s `changes`: an explicit
   list of what changed, never a replacement of the item), and **§0** (text that reaches paper: trimmed, no control
   character, lengths to settle with design D).
4. **DESIGN-019's Handoff** (`.agent/tasks/DESIGN-019-menu.md`, from `## Handoff` to the end, including rounds 2 and 3):
   *Delivery and the decisions S4a, S4c and S5 can copy*, the *For DESIGN-020* paragraph under *Questions and downstream
   work*, the link parameters every Edit and New item link carries, and the list-version rule (round 2, F1).
5. **DESIGN-017's and DESIGN-018's Handoffs** and **`D`** *Configuration forms* (from `D:1486`, through the DESIGN-018
   and DESIGN-019 additions): binding behaviour for every configuration form, the stale-draft refusal, the departure
   decision, the working-area dialog rule, one form and one command per screen, the rate-field table (the model for a
   strict numeric input with no float). Consume `F/office.css`, `F/office.js`, `F/patterns.html`, `F/entry.css` and
   `F/settings.css` where a pattern is the same; do not fork them.
6. `I` BO-04 (`:724-748`) and BO-03, the shared general failures (`I:83-124`); `S` BO-04 (`:280`) and BO-03;
   `P/item-editor.html`; the current `F/menu.html` with `menu.js` and `menu-states.js`.
7. The contract, for meaning: PRD FR-B1, FR-B4, FR-C1 to FR-C4, FR-C7, FR-C8, FR-M1, FR-M5, AC-26; BOUNDARIES B-1, B-8,
   B-13, B-17, B-24.

## Rulings that bind this task

- **Owner, Q5 (DECISIONS 2026-10-20):** currency and precision are installation constants, IDR at precision 0, shown and
  never editable. `I` BO-04's *price immutable-currency context* ("locked after the first order") is stale: draw the
  price fields' fixed currency context (IDR, whole rupiah) and bring `I` into line (Part C).
- **Owner, Q10:** an archived item may be restored (on BO-03). **Owner, Q11:** menu changes are not audited; draw no
  audit trace. **Owner, Q13:** `CATALOG_CHANGED` as an *enforced* refusal reaches the browser with the catalog routes;
  draw it as S4b and S4c will build it.
- **Prices are tax-inclusive** (FR-C1, PRD §4): one price field, the price the customer pays; no ex-tax field, no tax
  breakdown. **Bounds (C1 §2.2, FR-M5):** base price 0 to 99.999.999; variant delta −99.999.999 to 99.999.999; modifier
  delta 0 to 99.999.999; whole rupiah. **Settle the price input as a rule table** in the style of DESIGN-018's rate
  table: what is accepted (whether `.` grouping may be typed, whether spaces are), how a variant's sign is typed, the
  refusal order and copy, the display (`D`'s money convention: `.` grouping, no currency symbol). **No float anywhere
  on this path (B-1):** the rule must be implementable on strings, as the rate field is. Prices travel as canonical
  strings (C1 §2.4, S4b).
- **Two structures, never one "options" concept** (`I` BO-04 *Must not invent*; FR-C2, FR-C3): variants are
  single-select with a signed delta; modifiers are multi-select with a delta of zero or more. **No nested group, no
  modifier of a modifier, no stock, no image, no default variant, no shared modifier library** (FR-C4; C1 §2.2 notes:
  options belong to one item for ever).
- **The resolved price floors at zero** (FR-C2, AC-26). You may show the price a variant gives (base plus delta, never
  below 0) as a computed display; if you do, draw the floor case and say why. Draw nothing that suggests a negative
  price can be sold.
- **One Save, one command** (C1 §2.3): every change on the screen (fields, options added, edited, removed and reordered)
  goes in one save, carrying the catalog version the editor opened at. A create carries no version. One form and one
  command per screen (`D`, DESIGN-018).
- **`CATALOG_CHANGED`** on an edit: `D`'s stale-draft rule as DESIGN-018 and DESIGN-019 drew it (nothing written; the
  draft kept; one reread; what is now current shown beside the draft; Save held until the manager chooses to keep their
  draft on the new version or take the current item; never a resend). **A create into a category archived meanwhile** is
  also refused `CATALOG_CHANGED` (C1 §2.3): draw it, with the way out (choose another category). **Moving an item to a
  category archived meanwhile** is the edit's refusal.
- **Names (C1 §2.2 notes; C2 §4):** an item name is unique among **active items, across the whole menu**,
  case-insensitively; `DUPLICATE` on create and rename, placed on the item name, with the list behind it able to show
  the holder. **An item in an archived category keeps its name held** (DESIGN-019 *For DESIGN-020*): say so in the
  refusal's copy where it applies. Variant names are unique among the item's active variants, and modifier names among
  its active modifiers, case-insensitively: **lead ruling, these are local refusals** (the form holds every option of the
  item), placed on the option's name field, so a server `DUPLICATE` on BO-04 is always the item name. **Settle the item,
  variant and modifier name lengths** and state them: item and option names print on the kitchen ticket and the receipt,
  so weigh a printed line (DESIGN-019's 80-unit overflow name is a stress fixture, not a decision; recheck BO-03's
  longest name against your length). Lengths are counted in **code points** (zod and PostgreSQL count them; DESIGN-018's
  "UTF-16 units" sentence is wrong and is being corrected). Trimmed; no control character.
- **State commands stay on BO-03 (lead ruling, DESIGN-011 BO-04 P1).** 86, available again, archive and restore are
  BO-03's row actions (DESIGN-019). BO-04 shows the item's availability and archived status as facts, and offers none of
  those commands, so a new item never shows a control that implies it is saved. **Editing an archived item is allowed**
  (C1 §2.3): draw it, with the archived status plain.
- **Removing an option** sets it inactive (C1 §2.2); an order line keeps referring to it (B-8). **Lead ruling:** a removed
  option leaves the editor when the save is answered; there is no restore of an option in Phase 1; adding one with the
  same name later makes a new option. Removal of a saved option takes effect only on Save, and the draft shows it as
  pending removal until then (undo before Save is yours to draw). Say whether removing an option needs a confirmation,
  and why (ARCH-002's test: is it reversible?).
- **Order of options** (C1 §2.2 *Display order*): a new option goes last in its list; the order of each list is part of
  the one Save. Reorder without dragging, as DESIGN-019 settled (*Move up* / *Move down*), keyboard-operable; drag may be
  offered in addition, never alone.
- **Subject and return** (DESIGN-019 *For DESIGN-020*; DESIGN-011 P1): consume the `item`, `category`,
  `return=frost-menu`, `returnItem` and `state=new` parameters BO-03's links carry. Draw Cancel, a clean return and a
  saved return to the same BO-03 row (BO-03 highlights `?item=` on return through `data-selected`). A new item opens in
  the category it was created from. Say where Save lands (stay on BO-04 or return) and why.
- **Drafts:** the departure decision (Cancel, Escape, browser back, the rail, logout); **M-6 over the editor** (visible,
  inert) and **BO-01 with the draft held**, as `D`'s working-area rule; a different manager destroys the draft.
- **Tokens (lead, as in slices A to F):** registry first; a missing value may be registered in `frost.tokens.json`,
  `frost.css` and `D` with `source: null` and a `designed` record, each listed in the Handoff. No raw colour, size or
  weight. No success green.

## What to draw

### Part A — BO-04, `F/item-editor.html`

1. **Every state, by `?state=`:** new item (empty, in its category, no option); loading; failed to load, with *Try
   again*; an item with several variants and modifiers; an item with none; an archived item being edited; an 86'd item
   being edited (availability shown as a fact); overflow (many variants and modifiers, the longest names, the largest
   prices and deltas, a negative variant that floors the price at zero); local invalid input on each field kind (item
   name, base price, variant name and delta, modifier name and delta: empty, too long, control character, not a whole
   number, out of bounds, a negative modifier delta, a duplicate option name), each with recovery; saving; saved; item
   name in use (create and rename, and the archived-category case); general failure; outcome unknown (same version
   reread; newer version reread; reread failed); the stale-draft refusal on an edit (with its two choices); a create
   refused because its category was archived; a move to an archived category refused; option removal pending and
   undone; option reorder; the departure decision with its pending and unknown copy; **M-6 over the editor** and **BO-01
   with a draft held**.
2. **Subject-correct walks:** BO-03's Edit on any row opens that item; New item opens in that category; Cancel and
   return go back to that row; the editor never shows another item's data.
3. **Copy for every state**, final words, listed in the Handoff as a table S4c can copy (state, element, exact text,
   accessible name where a test will drive it). Name the controls their tests press: each field, *Add variant*, *Add
   modifier*, each option's remove, undo, move up and move down, *Save*, *Cancel*, the stale state's two choices, and the
   departure decision's Stay and Discard.
4. **Focus** after each command, refusal and decision, as DESIGN-017 to -019 tabled it.

### Part B — the patterns, in `D`

1. Add to *Configuration forms* what this slice settles for every later form: **the money input** (BO-07's fixed-amount
   preset will reuse it, as it reuses the rate field), **a form with two child lists in one save**, and **the
   stale-draft refusal over a form with child rows**. Say plainly which are behaviour and which are BO-04's copy. Change
   no existing rule.

### Part C — links, gallery, inventory and sitemap

1. `F/menu.js` (`editorHref`) and every BO-03 link to BO-04: point them at `F/item-editor.html`, carrying the same
   parameters. Report the `grep -c "prototype/"` counts before and after for each changed artifact, and update only the
   expected link counts in earlier checks (`design014.cjs`, `design019.cjs`), weakening no assertion.
2. Register every state in `manifest.js` and the gallery. Write `docs/design/checks/design020.cjs`.
3. Bring `I` BO-04 and `S` BO-04 into line: the fixed currency context (Q5), the stale-draft and archived-category
   refusals, name in use, the option rules, and that the state commands live on BO-03. Show each changed line in the
   Handoff (`git diff`).

### Part D — BO-08's `first-run-closed` (owed from S2b)

`F/settings.html?state=first-run-closed` lacks the money facts the built screen shows (S2b review F5; FR-B1 and `D`
require them): currency and decimal places shown as plain text above the empty state, no rate, no input. Redraw that one
state to match, change nothing else on BO-08, and keep `design018.cjs` green (update its expectation for that state only,
if it asserts the old drawing, and say so).

## Constraints

- Light only, desktop only. No stock, no inventory field, no image, no nested modifier group, no shared modifier
  library, no default variant, no ex-tax field, no timed availability, no audit trace, no POS operation.
- *Invent, revert, ask:* nothing the inventory, the PRD, ADR-012, C1 or C2 does not grant.
- Every person is named (B-13). The four product documents, ADR-012, C1 and C2 are not edited.
- Do not change DESIGN-012's, -013's, -014's, -016's, -017's, -018's or -019's shared behaviour except as Part B adds
  rules; their checks must still pass (`design012.cjs`, `design013.cjs`, `design014.cjs`, `design016.cjs`,
  `design017.cjs`, `design018.cjs`, `design019.cjs`).
- **The lead runs the check scripts** (this saves your allowance and the owner's approvals). When you want a run, ask
  the lead through Herdr (`herdr agent prompt lead "design020: please run <script>"`) and wait for the result in your
  pane; do not run them yourself unless the lead says so. Measure in a browser at 1440×900 and 1920×1080 through the
  check script; quote the measurements in the Handoff. Evidence stays outside the repository.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
expected prototype-link counts in `design014.cjs` and `design019.cjs` (Part C), and `design018.cjs`'s expectation for
`first-run-closed` only (Part D); change only those, say so, and weaken no assertion.

## Acceptance criteria

1. `F/item-editor.html` imports the shared `office.css`, and every state in Part A item 1 is reachable by `?state=` and
   registered. Red if one is missing.
2. The Handoff maps every `I` BO-04 state (as amended), every ruling above and every item of Parts A to D to the state or
   walk that shows it, and gives the copy table of Part A item 3.
3. The Handoff states, as rules S4a, S4b and S4c can test: the item, variant and modifier name lengths and rules; the
   price input table (accepted, refused in order with copy, display, bounds); option order, removal and the absence of
   option restore; what one save carries (the shape of `editItem`'s `changes` as the screen produces it, not its wire
   format); which commands carry the catalog version.
4. Shown in the browser: an edit refused `CATALOG_CHANGED` with the draft and its option rows kept; a create refused for
   an archived category; *name in use* on the item name; a duplicate option name refused locally; a negative variant
   flooring at zero, if a computed price is drawn; M-6 over the editor, inert; BO-01 with the draft held; BO-03's Edit
   and return walk landing on the same row.
5. No state on BO-04 offers 86, available again, archive or restore, and no new-item state implies a saved item.
6. Measurements at 1440×900 and 1920×1080: no horizontal overflow at the longest names and largest prices; the Save
   control and the option controls reachable in overflow.
7. No raw colour, size or weight; new tokens registered and listed; `npm run verify` green if anything under
   `docs/design/tokens/` changed. The seven earlier checks pass.
8. The Handoff lists every question raised and not ruled, each with a proposed answer, and anything S4a, S4c or
   DESIGN-021 must know.

## Out of scope

- BO-03 beyond its links into BO-04 (DESIGN-019 is merged). The POS addition (DESIGN-021). BO-07 (F's other half).
  BO-08 beyond Part D. Building anything.

## Reporting

Commit on `agent/design-020` only (path-scoped `git add`), after verify is green where it applies, and never push.
Commit as you finish each part, so work survives an allowance limit. Write the Handoff below in full prose, ending with
`DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design020: DESIGN-020 done — <one line>"
    herdr agent prompt lead "design020: BLOCKED — <question>"

## Handover (lead, 2026-10-22): finish the Codex designer's draft on Claude Opus

**Owner exception** (DECISIONS 2026-10-22): Codex hit its five-hour limit at 19:20, so this task is finished by a Claude
Opus 5.5 designer (`design020c`). The owner chose this over waiting for the 21:26 reset. The design review that follows is
still the lead's to route; the other-family rule stands for every other task.

**What the Codex designer (`design020`) did.** Part D is committed (`9b1abbd`: BO-08's `first-run-closed` shows the
installation money facts above the empty state; the lead ran `design018.cjs`, 724/724, and accepted it on that evidence).
Parts A and C are drawn but **uncommitted** in this worktree. Modified: `docs/design/checks/design019.cjs`,
`F/menu.html`, `F/menu.js`, `docs/design/visual-directions/index.html`, `docs/design/visual-directions/manifest.js`. New:
`docs/design/checks/design020.cjs`, `F/item-editor.html`, `F/item-editor.css`, `F/item-editor.js`,
`F/item-editor-states.js`. Its own summary: editable option rows, string-based money validation, pending removal with
Undo, keyboard reorder controls, stale-draft comparisons. **Part B (`D`) and the Handoff are not written. Finish it; do
not restart it.**

**The lead's check runs on this draft** (19:20): `design020.cjs` **705/706**, 120 states, no page errors;
`design019.cjs` 998/998 (74 states); `design014.cjs` no failures.

**Lead rulings given to the Codex designer in its pane** (record each in the Handoff, as rulings, not as your choices):
1. **Return plumbing (Part C).** `editorHref` keeps the existing `item`, `category`, `return=frost-menu`, `returnItem` and
   `state=new` parameters unchanged. A snapshot of the saved item travels in the URL only (no web storage, cookies or
   shared state) and holds only the fields the saved return shows. The BO-03 return adapter in `F/menu.js` reads only
   those parameters, applies the answered item to that one row (or inserts it, for a create), marks it `data-selected`
   and focuses its Edit; it changes no other row, no count rule, no BO-03 state, and sends nothing. **The originating
   category** may also travel in the URL (id, name, active flag, order) and is inserted only when no category with that id
   exists, solely to host the returned item (the B-24 first category → first item → saved return walk); it never replaces
   or renames a category. A code comment and the Handoff say both are review plumbing, which S4c replaces with the real
   list read.
2. **`design019.cjs:57`**: the expected destination suffix changes from `/prototype/back-office/item-editor.html` to
   `/frost/back-office/item-editor.html` as the Part C link migration; every identity assertion stays.
3. **Name limits**: item names 1–64 code points, variant and modifier names 1–32, as a name budget of two 32-column lines,
   not a promise of printer geometry (`D` and `I` state no printer width). In the Handoff: the budget and its reasoning in
   the rules table; DESIGN-019's 80-character BO-03 fixture now exceeds the item rule and is kept unchanged only as a
   wrapping stress, so S4c must not copy it as a valid name; and a carry-forward to Phases 3 and 4 that ticket and receipt
   layout must fit a 64-code-point item name and a 32-code-point option name.
4. **An option removed meanwhile, in the stale state.** (a) An option the draft did not change follows the current item:
   if it was removed meanwhile it leaves the draft under either choice, and the comparison shows it as removed. (b) An
   option the draft changed (name, delta or position) that was removed meanwhile: the comparison shows it removed; before
   the choice the notice says plainly that *Keep my changes* adds it again as a new option and *Use current item* drops it;
   after Keep it is a new, unsaved option with no old identity, sent as an added option by the next Save. (c) After Keep,
   local checks run again over the merged draft: an option whose name an active option of the current item now holds is a
   local duplicate refusal on that field, and Save stays held until it is fixed. (d) Neither choice sends anything. Draw (b)
   and (c) as states with their copy, and state (a) to (d) in Part B as behaviour for every form with child rows.

**What the next designer does:**
1. Read this task file whole. Check the draft against *Rulings that bind this task*, *What to draw*, the four rulings
   above and the *Acceptance criteria*; finish anything missing and correct anything wrong, saying so in the Handoff.
2. Fix the one check failure, **"no float parsing or money arithmetic"**: `F/item-editor.js:20`, the `long-N` fixture,
   puts `Number(id.slice(5))` on the same line as `price`, so the check's regex matches. It is a fixture index, not money;
   **do not weaken the check**: move the index arithmetic off any line that names a price or delta.
3. The same `long-N` fixture pads the item name to **80** characters, over the 64 rule, and BO-04 opens it as an editable
   item. Cap BO-04's copy at 64, or draw it as the local too-long refusal and say so; a saved item over the limit must
   not look valid.
4. Write **Part B** in `D` and the **Handoff** (every item of *Reporting* and the *Acceptance criteria*: the state map, the
   copy table, the rules tables S4a, S4b and S4c can copy, focus, measurements, link counts, questions).
5. **The lead runs the check scripts.** Ask through `herdr agent prompt lead "design020c: please run <script>"` and wait;
   rerun `design020.cjs` after your changes, and the earlier checks only if you change shared files.
6. Commit everything on `agent/design-020` (path-scoped `git add`), as you finish each step. End the Handoff with `DONE`
   and ping the lead: `herdr agent prompt lead "design020c: DESIGN-020 done — <one line>"`.

## Handoff
