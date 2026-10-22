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

### Delivery

Drawn by `design020` (Codex) on `agent/design-020` and finished by `design020c`
(Claude Opus 5.5, under the owner's exception of 2026-10-22). The finishing
pass checked the draft against *Rulings that bind this task*, *What to draw*,
the lead's four handover rulings and the acceptance criteria. It kept the
draft, and fixed or added the things listed under *Finishing pass* below.

Commits on `agent/design-020`, after Part D's `9b1abbd`:

- `a158963` Parts A and C: `F/item-editor.html`, `item-editor.css`,
  `item-editor.js` and `item-editor-states.js` (new), the BO-03 links and
  return adapter in `F/menu.js` and `F/menu.html`, the gallery
  (`manifest.js`, `index.html`), `design020.cjs` (new), `design019.cjs` (one
  expected link suffix), and `I` and `S` BO-04.
- `b1c410c` Part B in `D`, and the copy pass on BO-04.
- This Handoff.

These are local review drawings with illustrative records and explicit result
selectors. No credential, request or configuration is stored or sent. No
token is added: `item-editor.css` uses registry tokens only, nothing under
`docs/design/tokens/` changed, so `npm run verify` does not apply. Nothing
under `apps/`, `packages/`, `db/` or `e2e/` changed, and `P/item-editor.html`
is not edited.

### Lead rulings recorded for this task

These are the lead's rulings, given to `design020` in its pane and restated
in the handover above. They are recorded here as rulings, not as the
designer's choices, so the lead can carry them into DECISIONS.

1. **Return plumbing.** `editorHref` keeps `item`, `category`,
   `return=frost-menu`, `returnItem` and `state=new` unchanged. A snapshot of
   the item travels in the URL only (no web storage, cookies or shared state)
   and holds only what BO-03's row shows (id, name, category, price, the two
   option counts, active, available, order). The BO-03 adapter in `F/menu.js`
   reads only those parameters, applies the answered item to that one row (or
   inserts it, for a create), marks it `data-selected` and focuses its Edit; it
   changes no other row, count rule or BO-03 state, and sends nothing. The
   originating category may also travel (id, name, active, order) and is
   inserted only when no category with that id exists, solely to host the
   returned item (the B-24 walk). Code comments in `menu.js` and
   `item-editor.js` say both are review plumbing, which **S4c replaces with
   the real list read**.
2. **`design019.cjs:57`**: the expected Edit destination suffix changes from
   `/prototype/back-office/item-editor.html` to
   `/frost/back-office/item-editor.html`; every identity assertion stays.
3. **Name limits**: item names 1–64 code points; variant and modifier names
   1–32. This is a name budget of two 32-column lines, not a promise of printer
   geometry (`D` and `I` state no printer width).
4. **An option removed meanwhile, in the stale state**: (a) an untouched option
   follows the current item; (b) a changed option removed meanwhile is shown
   removed, the notice says before the choice what each choice does, and after
   Keep it is a new, unsaved option sent as an added option; (c) local checks
   run again after Keep; (d) neither choice sends anything. (b) and (c) are
   drawn as `stale-removed` and `stale-duplicate`; (a) to (d) are in `D`
   Part B as behaviour for every form with child rows.

### Finishing pass (design020c)

1. **The one check failure is fixed without weakening the check.** The
   `long-N` fixture in `item-editor.js` computed its index with
   `Number(id.slice(5))` on the line that set `price`. The index now has its own
   line (`stressIndex`), and the price is set on a separate line. The
   assertion "no float parsing or money arithmetic" is unchanged.
2. **BO-03's 80-unit stress rows no longer look valid.** Opening `long-N` from
   BO-03's `overflow` now shows the name untruncated with the local too-long
   refusal ("Use 64 characters or fewer.") on Item name and Save held. A stored
   name can never exceed 64 code points once S4a's check exists, so this is a
   fixture artefact, drawn as a refusal so that it cannot pass for a valid
   item. The editor's own fallback for `long-N` uses the same 80-unit name, so
   the subject matches BO-03. New assertion: "stored stress name over 64 opens
   as the local refusal".
3. **A refused amount stays as typed.** The draft regrouped any digits in a
   field on every render, so a refused `1000.5` became `1.000.5`. A field now
   groups a value only when it parses, and otherwise shows exactly what the
   manager typed. New assertions: "refused amount kept as typed", "valid amount
   saved canonical".
4. **Option names no longer go stale.** The draft named each row's buttons
   after the option's name at render time, so a new row typed as "Large" kept
   "Remove variant Unnamed variant", and its visible label ("1. Variant name")
   did not begin its accessible name ("Variant 1 name"). Fields are now
   labelled "Variant 1 name" and "Variant 1 price change", and controls "Remove
   variant 1", "Move up variant 1", "Move down variant 1", by position, which
   every render keeps current. A new row shows "New · not saved yet" beside its
   label. New assertion: "option control name …" and "option fields named by
   visible label".
5. **The stale comparison marks what differs.** `D` requires the current value
   wherever it differs from the draft. Each differing field in *Current item*
   now reads in medium weight with "Differs from your draft" under it. New
   assertion: "stale comparison marks differing values".
6. **An unchanged save is never announced as saved.** The draft returned an
   unchanged answer to BO-03 with "{name} saved.". It now returns
   `saved=unchanged` with the version, and BO-03 shows its reviewed
   "Nothing changed. Menu version {n} is still current." New assertion:
   "unchanged return names the version, not a save".
7. **A clean Cancel from New item returns focus to its opener.** The draft
   left focus nowhere on BO-03. It now goes to that category's New item (New
   category if that category no longer exists), as `D`'s Cancel rule says. New
   assertion: "new item clean return focuses its opener". The Cancel return
   also now names the category the editor opened in, not a category the
   discarded draft had selected.
8. **Copy.** The unknown-outcome, after-Keep and after-Use notices now use
   BO-03's reviewed wording; stale notices end with "Choose which to keep.";
   the after-Keep notice says "Correct the marked fields, then press Save." only
   when the rerun local checks found something. The removed-meanwhile sentence
   now names the option by its saved name (the comparison does), and the copy
   no longer uses the generic word "choices" for variants and modifiers (two
   structures, never one "options" concept). The holder of a name in an
   archived category says so. A different manager's sign-in now leaves the
   editor titled "Item editor" with "Choose an item on Menu to edit it.",
   instead of the title "Menu" and a sentence about the previous manager's
   draft. The over-maximum variant note no longer asserts POS behaviour
   (see *Questions*).
9. **Inventory and sitemap** (Part C item 3) were not in the draft and are
   written (diffs below). `D` Part B was not in the draft and is written.

### Requirement and state map

All 60 states are registered in `item-editor-states.js` (`WF.states`) and in
`manifest.js`; `design020.cjs` asserts the two lists are identical, and the
gallery opens them (asserted with `stale-removed`).

| Requirement, ruling or task item | State or walk |
|---|---|
| `I` new item; DESIGN-011 P1 (nothing implies a saved item) | `new`: blank name and price, the originating category selected, no option, heading "New item", status "Not saved yet", no 86/archive control. Walk: BO-03 New item in Sides opens with Sides. |
| `I` loading; read failure | `loading`; `load-error` with Try again (repeats the read only); `not-found` for an unknown subject, with Return to menu. |
| Item with options / with none | `default` (Burger: 3 variants, 3 modifiers); `none` (Fish & Chips). |
| Editing an archived item (C1 §2.3) | `archived` (Winter Stew): status "Archived item", context says saving does not restore it. |
| 86'd item (availability as a fact) | `eightysix` (Soda): status "86 · Unavailable", context says saving does not make it available. |
| `I` overflow; AC 6 | `overflow`: 64-code-point item name, 18 variants and 18 modifiers at 32 code points, 99.999.999 prices and changes, −99.999.999 variant. Measured below. |
| FR-C2, AC-26 floor | `floor`: base 100.000 with a −99.999.999 variant reads "Without modifiers: 0 · Base price plus this change is below zero, so the price floors at 0." |
| Local invalid input, each field kind | `invalid-item-{empty,long,control}`, `invalid-variant-{empty,long,control,duplicate}`, `invalid-modifier-{empty,long,control,duplicate}`, `invalid-base-{empty,format,bounds,negative}`, `invalid-variant-delta-{empty,format,bounds}`, `invalid-modifier-delta-{empty,format,bounds,negative}`. Each sends nothing; recovery is a walk (fix the field, Save sends once). |
| Duplicate option name, local (lead ruling) | `invalid-variant-duplicate`, `invalid-modifier-duplicate`: refused on the later row's name. |
| Saving / saved / unchanged / failure | `saving`, `saved`, `unchanged`, `failure`. |
| Name in use, create / rename / archived category | `duplicate-create`, `duplicate-rename`, `duplicate-archived-category` (Apple Pie, in archived Seasonal). Focus on Item name, one reread, holder shown. |
| Outcome unknown | `unknown` (same version), `unknown-changed` (newer version: comparison and choices, "may include this save"), `unknown-read-failed` (facts withheld, Try again reads only). |
| `CATALOG_CHANGED` on an edit, two choices | `stale`, `stale-same` (same values), `stale-read-failed`; walks: Keep (no send, Save carries 13), Use current (fields and rows replaced, no send). |
| Ruling 4(b), 4(c) | `stale-removed`, `stale-duplicate`; walks assert 4(a) under both choices and 4(d). |
| Create into a category archived meanwhile | `create-category-archived`: draft kept, category refused, Save held until an active category; the next create still carries no version. |
| Move to a category archived meanwhile | `move-category-archived`: stale comparison; after Keep the category is still refused until an active one is chosen; Save carries 13. |
| Option removal pending / undone; reorder | `remove-pending`, `remove-undone`, `reorder`; walks: removal pending until Save, Undo restores before Save, keyboard Move down. |
| Departure decision | `unsaved`, `unsaved-logout`, `leave-pending`, `leave-unknown`; walks from Cancel, Escape, the rail, browser Back and Log out. |
| M-6 over the editor; BO-01 with the draft held | `reauth`, `reauth-decision`, `bo01-draft`, `bo01-decision`; same manager keeps the whole draft and options; a different manager destroys them. Answers held behind each gate (saved, unknown, idle) are walked. |
| Subject-correct walks (Part A.2) | Every BO-03 row's Edit opens that item's name, price and category; Cancel returns to that row (`data-selected`, its Edit focused); a saved return applies only that item; New item → Cancel returns to New item; first category → first item → saved return (B-24). |
| State commands stay on BO-03 | Asserted in every state at both sizes: no Archive, Restore, 86 or Make available in the form. |
| One Save, one command; version only on edits | Asserted for every command in every state: a create has `expected: null`, an edit an integer. |
| Q5 fixed currency | Currency and decimal places as plain text above the fields, in every form state; withheld while loading or failed. |
| Q11 no audit; B-13 | No audit trace drawn. M. Iqbal and Ratna Ayu are named. |
| Part B | `D`, *Configuration forms — DESIGN-020 additions*. |
| Part C | Links and gallery (`a158963`), `I` and `S` diffs below, counts below. |
| Part D | `9b1abbd` (the Codex designer), accepted by the lead on `design018.cjs` 724/724. |

### Rules S4a, S4b and S4c can copy

**Names.**

| Field | Rule |
|---|---|
| Item name | Trim; then 1–64 Unicode code points; no Unicode Cc control character. Checked in the order empty, length, control. Unique among **active items across the whole menu**, case-insensitively; an item in an archived category is still active and still holds its name. Server refusal `DUPLICATE`, always on the item name on BO-04. Archived items may share names. |
| Variant name | Trim; 1–32 code points; no Cc control. Unique among the item's **active variants**, case-insensitively. Refused **locally** (the form holds every option); a pending-removal variant's name is free in the same save. |
| Modifier name | As variant, among the item's **active modifiers**. A variant and a modifier may share a name. |
| Budget reasoning | Item and option names print on the kitchen ticket and the receipt. 64 and 32 are a budget of two 32-column lines for the item and one for an option, not a promise of printer geometry. DESIGN-019's 80-unit BO-03 fixture now exceeds the item rule and is kept unchanged only as a wrapping stress: **S4c must not copy it as a valid name.** Carry forward to Phases 3 and 4: ticket and receipt layout must fit a 64-code-point item name and a 32-code-point option name. |
| No truncation | No `maxlength`; validation runs on Save. A pasted control character is refused, not stripped. |

**The price input** (the full table is in `D` Part B).

| | Base price | Variant price change | Modifier price change |
|---|---|---|---|
| Bounds | 0 to 99.999.999 | −99.999.999 to 99.999.999 | 0 to 99.999.999 |
| Sign | none (`-` refused first) | one ASCII `+` or `-` directly before the digits | none (`-` refused first) |
| Accepted | digits (`00010`), or `.` groups of three (`10.000`) | same, signed (`-10.000`, `+5000`, `-0` → `0`) | as base |
| 1 · empty | Enter a base price. | Enter a price change. | Enter a price change. |
| 2 · leading `-` | Use 0 or more. | (allowed) | Use 0 or more. |
| 3 · not such a number | Enter whole rupiah, such as 10.000. | Enter whole rupiah, such as 10.000 or -10.000. | Enter whole rupiah, such as 10.000. |
| 4 · out of bounds | Use 99.999.999 or less. | Use a price change from -99.999.999 to 99.999.999. | Use 99.999.999 or less. |
| Sent as | canonical integer string (`"10000"`, `"-10000"`) | | |
| Shown as | `.` grouping, `-` for negative, no `+`, no currency symbol | | |

Refused under rule 3: a space inside (`1 000`), a decimal part (`10.00`,
`1000.5`), `,`, an exponent (`1e3`), a Unicode minus (`−1`), a space after the
sign (`- 1`), a `+` on base or modifier. All of these are asserted in
`design020.cjs` (21 money cases). No float is used: the fixture parses with a
pattern and `BigInt`, and the check forbids `parseFloat`, `Number(` near a price
or delta, and `Math.round`/`floor`.

**The computed price.** BO-04 shows under each variant "Without modifiers:
{max(0, base + change)}", because a negative change is easy to misjudge. It
floors at 0 and says so; it is never negative. The section help says the
final price adds the selected modifiers and then floors at zero (FR-C2), so
the per-variant figure is correct only without modifiers, which is what it
says. It is display only and is not sent.

**Options.**

| Rule | Decision |
|---|---|
| Two structures | Variants (single-select, signed change) and modifiers (multi-select, change ≥ 0) are two lists with two Add actions. No group, nesting, default variant, stock, image or shared library. |
| Add | A new option goes last in its list, with an empty name and a change of `0`, marked "New · not saved yet"; focus goes to its name. |
| Remove | A saved option becomes pending removal (Undo restores it in place, before Save). A new option is deleted at once. On Save the saved option is set inactive; it leaves the editor when the save is answered. |
| Restore | None in Phase 1. Adding the same name later makes a new option. |
| Confirmation | None: before Save, Undo reverses removal; after Save, re-adding restores what the POS can sell, and existing orders keep their snapshots (B-8). Only identity is not restorable, which nobody sees. |
| Order | Move up / Move down, keyboard-operable, disabled at the ends; no drag. The order of each list is part of the one Save. |

**What one save carries** (the screen's shape, not S4b's wire format).

- **Create** (`createItem(categoryId, …)`), **no version**: name, category,
  base price, the variants in order (name, change), the modifiers in order
  (name, change).
- **Edit** (`editItem(id, expected, changes)`), **carries the version the
  editor read when it opened** (or the version chosen by Keep my changes, or
  named by an earlier answer). `changes`:
  `fields` — only the changed ones of name, base price, category;
  for `variants` and for `modifiers`: `added` (name, change, a draft key,
  in order), `edited` (id, and only the changed name and/or change), `removed`
  (ids), `order` (every active option id and draft key in display order,
  present whenever the order differs from the opening order, which includes
  any add or removal).
- An edit whose values equal the stored item is still sent; the answer
  "unchanged" names the version still in force (`D`, DESIGN-018).
- BO-04 has no other command. 86, available again, archive and restore are on
  BO-03 and carry no version.

**The version BO-04 builds on.** BO-04 is its own screen: it reads the item and
the catalog version in one snapshot when it opens (ADR-012 rule 11), and its
draft builds on that read. It does not inherit BO-03's list version. The base
then moves only by an answer, an unchanged answer, or Keep my changes; a reread
alone never moves it (`D`, DESIGN-018).

**Where Save lands.** An authoritative success returns to BO-03 on the same row
(inserted for a create), which announces "{name} saved." (or the unchanged
sentence) and focuses that row's Edit. This is `D`'s success rule ("closes the
form, announces the named result and focuses that row's Edit"): BO-04 is the
form and BO-03 its list, and the state commands the manager may want next
(86, archive) live there. The standalone `saved` and `unchanged` drawings show
the closed form with the result and Return to menu, for review.

### Exact copy and accessible names for S4c

Braces are trusted record values, never server or schema messages. Review
selectors, the fixture explanation and the All states link are outside product
copy. Departure, logout, M-6, other-manager and BO-01 copy are DESIGN-019's
rows, reused verbatim, and are not repeated here except where BO-04 differs.

| State / context | Element | Exact text | Accessible name / test target |
|---|---|---|---|
| Frame | Top bar / rail | Item editor / Menu current | rail link Menu |
| Existing item | Heading / status | `{name}` / Available, 86 · Unavailable, or Archived item | heading level 1 |
| New item | Heading / status | New item / Not saved yet | heading level 1 |
| Ordinary | Context | Save the item, its variants and its modifiers together. Existing orders keep their saved names and prices. | paragraph |
| Archived item | Context | Archived item. Saving does not restore it. Availability and archive actions are on Menu. Existing orders keep their saved names and prices. | paragraph |
| 86'd item | Context | 86 · Unavailable. Saving does not make it available. Availability and archive actions are on Menu. Existing orders keep their saved names and prices. | paragraph |
| Existing item | Facts | `Menu version {n} · Availability and archive status are managed on Menu.` | `#version-facts`; empty when the reread failed |
| New item | Facts | Not saved yet. Nothing is created until you save. | same |
| Form | Section | Item details | heading level 2 |
| Money facts | Terms / values / note | Currency: IDR · Indonesian rupiah / Decimal places: 0 · amounts are whole rupiah / Fixed for this installation. Prices include tax. | term-and-value rows, no control |
| Item name | Label / help | Item name / 1–64 characters. Active item names are unique across the menu. | textbox Item name |
| Category | Label / help / first option | Category / Choose an active category. An existing item may stay in its archived category. / Choose a category | combobox Category; an archived category reads `{name} · Archived` |
| Base price | Label / help | Base price / Price the customer pays. 0–99.999.999; whole rupiah. | textbox Base price |
| Variants | Heading / note / help | Variants / Single-select · one choice, with a positive or negative price change. / Names: 1–32 characters. Type a minus sign for a reduction, such as -10.000. | heading level 2 |
| Variants | Floor help | The final unit price includes selected modifiers, then floors at zero. | paragraph |
| Modifiers | Heading / note / help | Modifiers / Multi-select · any number of choices, each adding zero or more. / Names: 1–32 characters. Price changes: 0–99.999.999; whole rupiah. | heading level 2 |
| Lists | Add | Add variant / Add modifier | same button names |
| Empty list | Body | No variants yet. Use Add variant to add the first one. / No modifiers yet. Use Add modifier to add the first one. | paragraph |
| Option row | Labels | `Variant {n} name` / `Variant {n} price change` (Modifier likewise) | textbox of the same name |
| New option | Marker | New · not saved yet | beside the name label |
| Option row | Controls | Move up / Move down / Remove | `Move up variant {n}`, `Move down variant {n}`, `Remove variant {n}` (modifier likewise) |
| Variant preview | Note | `Without modifiers: {price}` | paragraph |
| Floor | Note | `Without modifiers: 0 · Base price plus this change is below zero, so the price floors at 0.` | same |
| Over the line maximum | Note | `Without modifiers: {price} · More than the largest line total, 99.999.999.` | same; see *Questions* |
| Preview not computable | Note | Enter a valid base price and price change to see this variant’s price. | same |
| Pending removal | Row / control | `{name}` / Will be removed when you save. / Undo | `Undo removal of variant {name}` (modifier likewise) |
| Removal | Standing note | Removed variants and modifiers stay on existing orders. After saving, they cannot be restored; adding the name again creates a new one. | paragraph |
| Footer | Hint | All changes are saved together. | describes Save (`aria-describedby`) |
| Footer | Hint, pending / stale / archived category / errors | Wait for the save result. / Choose which version to keep before saving. / Choose an active category before saving. / Correct the marked fields before saving. | same |
| Footer | Actions | Cancel / Save | same button names |
| Item name invalid | Error | Enter an item name. / Use 64 characters or fewer. / Remove control characters from the item name. | `#item-name-error`, field `aria-invalid` |
| Variant name invalid | Error | Enter a variant name. / Use 32 characters or fewer. / Remove control characters from the variant name. / Another variant uses this name. Choose another name. | on the row's name field |
| Modifier name invalid | Error | Enter a modifier name. / Use 32 characters or fewer. / Remove control characters from the modifier name. / Another modifier uses this name. Choose another name. | same |
| Money invalid | Error | the price table above | on the field |
| Category invalid | Error | Choose a category. / This category is archived. Choose another category. | `#item-category-error` |
| Loading | Status | Loading item… | status |
| Read failure | Title / body / action | Item could not be loaded / Try again to read this item. / Try again | alert; read-only button |
| Unknown subject | Title / body / action | Item could not be found / Return to Menu and choose the item again. / Return to menu | alert; link |
| Saving | Notice | Saving… / Wait for the result. Your draft is kept. | focusable status |
| Saved (standalone) | Result / action | `{name} saved.` / Return to menu | focusable status; link |
| Unchanged | Result | `Nothing changed. Menu version {n} is still current.` | same, on BO-03 after return |
| Saved return | BO-03 page status | `{name} saved.` | the row's Edit focused |
| Definite failure | Notice | Something went wrong / Nothing was saved. Your draft is kept. Press Save to try again. | alert |
| Session refusal, after resuming | Notice | Nothing was saved / Your draft is kept. Press Save to try again. | status |
| Unknown, same version | Notice | Outcome not confirmed / The menu has been refreshed. Your draft is kept; nothing was sent again. | status |
| Unknown, reread failed | Notice / action | Outcome not confirmed / The menu could not be refreshed. Your draft is kept; nothing was sent again. / Try again | read-only button |
| Unknown, newer version | Notice | Outcome not confirmed / `The menu has been read again at version {n}. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.` | alert; comparison and choices |
| Stale | Notice | The menu changed while you were editing / `Nothing was saved. The menu has been read again at version {n}. Your draft is kept. Choose which to keep.` | alert, focused |
| Stale, same values | Added sentence | The current item has the same values as your draft. | before "Choose which to keep." |
| Stale, changed option removed (4b) | Added sentence | `The current item no longer has {kind} {saved name}, which your draft changes. Keep my changes adds it back as a new {kind} named {draft name}; Use current item leaves it out.` | several: `… has variant A and modifier B, which your draft changes. Keep my changes adds them back as new variants and modifiers; Use current item leaves them out.`; "named …" is omitted when the name is unchanged |
| Stale, reread failed | Notice / action | The menu changed while you were editing / Nothing was saved. Your draft is kept, but the current item could not be read. Try again to read it before choosing. / Try again | read-only button; no choices |
| Comparison | Heading / terms | Current item / Item name, Category, Base price, Status / `Variants · current order`, `Modifiers · current order` | aside, heading level 2 |
| Comparison | Marker / rows | Differs from your draft / `{name} · {change}` / `{name} · Removed from the current item.` / No variants. / No modifiers. | under a differing value |
| Comparison | Reason / choices | Choose Keep my changes or Use current item before saving. / Keep my changes / Use current item | same button names |
| After Keep | Notice | Your changes are kept / `Your changes now build on menu version {n}. Nothing has been saved yet. Press Save to save them.` (or `… Correct the marked fields, then press Save.`) | status |
| After Use | Notice | Current item loaded / `The form now shows menu version {n}. Nothing was saved. Edit it and save, or Cancel to close.` | status |
| Name in use | Error | An active item already uses this name. Choose another name. | on Item name |
| Name in use, archived category | Error | An active item in an archived category still uses this name. Choose another name. | same |
| Name holder | Line / link | `Name held by {name} in {category}.` (`…in {category}, an archived category.`) / View item on Menu | link to BO-03 with that item selected |
| Create, category archived | Notice | The category was archived / Nothing was saved. Your draft is kept. Choose another category before saving. | alert; focus Category |
| Move, category archived | Added sentence | The destination category was archived. Choose another category after deciding which version to keep. | appended to the stale notice |
| Departure, discarded pending save | Status | Waiting for an earlier save to finish. Nothing will be sent again. | as `D` |
| Different manager | Heading / context / action | Item editor / Choose an item on Menu to edit it. / Return to menu | link focused |

### Focus

| Moment | Focus |
|---|---|
| Open (existing or new) | Item name. |
| Save refused locally | The first invalid field in reading order. |
| Add variant / Add modifier | The new row's name. |
| Remove a saved option | Its Undo. |
| Remove a new option | That list's Add. |
| Undo | The restored row's name. |
| Move up / Move down | The same control, or the row's other move control at an end. |
| Save pending | The Saving notice. Fields and option controls are inert; Cancel, the rail and Log out stay live. |
| Saved, with BO-03 return | BO-03: that row's Edit. Standalone drawing: Return to menu. |
| Clean Cancel / Discard | BO-03: the item's Edit, or for a new item that category's New item (New category if gone). |
| Definite failure, unknown (same version or reread failed), name in use | Item name. |
| Stale, unknown with a newer version, edit moved to an archived category | The notice. |
| Keep my changes | Save, or the first field the rerun checks refuse. |
| Use current item | Item name. |
| Create refused, category archived | Category. |
| Departure opens; Escape in it | Stay; Escape means Stay. |
| Stay | The field last edited, or the notice while pending. |
| M-6 | Password. Same manager resumes: the field last edited, or the restored decision's Stay. |
| Different manager | Return to menu. |

### Verification and measurements

All runs by the lead in this worktree, at my request:

- After the first finishing changes: `design020.cjs` **717 / 717**, 120 states
  (60 × two sizes), no page errors, no failures (evidence in my scratchpad,
  `…/scratchpad/ev1`, outside the repository); `design019.cjs` **998 / 998**,
  74 states, no page errors, no failures (it covers `menu.js`'s changed return
  adapter).
- After the copy pass: `design020.cjs` **717 / 717**, 120 states, no page
  errors, no failures (`…/scratchpad/ev2`).

The draft scored 705/706 on the lead's 19:20 run. The finishing pass added 11
assertions (listed under *Finishing pass*) and changed one: the
`stale-removed` notice assertion now compares the exact new sentence instead
of the old fragment "again as new choices".

Measurements (overflow state, from `measurements.json`):

| Viewport | Frame width / x | Rail | Top bar | Item name field | Content padding | Save before scrolling (y, bottom) | Last modifier's Remove after scrolling (y) | Scrolled |
|---|---|---|---|---|---|---|---|---|
| 1440×900 | 1440 / 0 | 220 | 64 | 40 high | 24px | 848, 884 | 611 | 4350 |
| 1920×1080 | 1440 / 240 | 220 | 64 | 40 high | 24px | 1028, 1064 | 791 | 4170 |

In all 60 states at both sizes: no horizontal page overflow, content overflow
≤ 1px, one visible `main`, password fields empty, no business-day fact, every
open dialog inside the viewport, every create unversioned and every edit
versioned, no state command in the form. The footer is sticky, so Save stays
in view through 18 variants and 18 modifiers at the longest legal names
(asserted: 64 and 32 code points exactly). I inspected `default`,
`stale-removed` and `floor` at 1440 by eye.

**Earlier checks not rerun.** `design012`, `013`, `014`, `016`, `017` and `018`
were not rerun after the finishing pass, because no file they read changed:
the pass touched only `item-editor.*`, `menu.js`, `design020.cjs`, `D`, `I`
BO-04 and `S` BO-04. `design017.cjs` reads `S` (no `[PANEL]`/`[ACTION]` tag,
and BO-05's line); my `S` lines use only `[INLINE]` and `[MODAL]`, and BO-05 is
untouched. `design018.cjs` reads `I` and `S` only between BO-08 and BO-09.
`design014.cjs` counts `prototype/` lines in `menu.html` (0, unchanged), so it
needs no change. The lead's 19:20 run on the draft passed `design014` and
`design019`.

### Link migration and scope

`grep -c "prototype/"` against `d164a23`:

| Artifact | Before | After | Why |
|---|---|---|---|
| `F/menu.js` | 1 | 0 | `editorHref` now points at `item-editor.html` with the same parameters, plus the URL-only review snapshots of ruling 1. |
| `F/menu.html` | 0 | 0 | Only the review-fixture sentence changed. |
| `F/item-editor.html`, `.css`, `.js`, `-states.js` | (new) | 0 | Its rail is authored and local. |

`design019.cjs` changes only its expected Edit suffix (ruling 2).
`design014.cjs` is unchanged (its `menu` count was already 0).

**`I` BO-04, changed lines** (`git diff -U0 d164a23`): the *Reached by*,
*States* and *Requirements* paragraphs are replaced, and two paragraphs are
added. The old stale line *price immutable-currency context (currency and
precision are locked after the first order)* is replaced by *Fixed currency
context* (Q5).

```
-**Reached by / from.** BO-03.
-
-**States.** *empty* (new item) · *loading* · *error* (validation) ·
-*permission-denied* (n/a) · *overflow* (many variants and modifiers on one
-item) · *unsaved changes* (must survive idle re-authentication, FR-A2b) ·
-*price immutable-currency context* (currency and precision are locked after
-the first order, FR-B1, M1).
-
-**Requirements.** FR-B4, FR-C1, FR-C2, FR-C3, FR-C4, FR-C8.
+**Reached by / from.** BO-03: an item's Edit opens that item; a category's
+New item opens a new item in that category. Cancel, a clean return and a saved
+return land on the same BO-03 row (a new item's clean return, on that
+category's New item).
+
+**States.** *new item* (empty, in the category it was created from, no variant
+or modifier, nothing that implies a saved item) · *loading* · *read failure
+with Try again* · *permission-denied* (n/a) · *an item with variants and
+modifiers*, and *with none* · *archived item being edited* (archived shown as a
+fact; saving does not restore it) · *86'd item being edited* (unavailable shown
+as a fact) · *overflow* (many variants and modifiers, the longest names, the
+largest prices; Save and every option control reachable) · *a negative variant
+whose price floors at zero* · *local invalid input* on the item name, base
+price, variant name and price change, modifier name and price change (empty,
+too long, control character, not a whole number, out of bounds, a negative
+base price or modifier change, a duplicate option name within the item) ·
+*option removal pending, and undone* · *options reordered* (Move up, Move
+down) · *saving, saved, unchanged, definite failure* · *outcome unknown* (same
+version, newer version, reread failed) · *name in use* on create and rename,
+including a name held by an item in an archived category · *catalog changed on
+an edit* (`CATALOG_CHANGED`: nothing saved, draft and option rows kept, item
+reread, current values beside the draft, Keep my changes or Use current item
+before Save), including a changed option removed meanwhile and a kept option
+whose name is now taken · *create refused because its category was archived
+meanwhile* (choose another category) · *move to a category archived meanwhile
+refused* · *departure decision* (with pending and unknown copy) · *M-6 over the
+editor* · *BO-01 with the draft held*.
+
+**Fixed currency context** (owner, Q5): currency and decimal places are
+installation constants, IDR at 0 decimal places, shown as plain text above the
+price fields and never editable. Every price is whole rupiah, grouped with dots,
+without a currency symbol.
+
+**Rules settled by DESIGN-020.** Item names 1–64 code points, unique among
+active items across the whole menu, case-insensitively (an item in an archived
+category still holds its name); variant and modifier names 1–32 code points,
+unique among the item's active variants or active modifiers, refused locally.
+All names trimmed, no control character. Base price 0–99.999.999; variant
+change −99.999.999 to 99.999.999; modifier change 0–99.999.999. One Save sends
+every change on the screen as one command; an edit carries the catalog version
+the editor read, a create carries none. A removed option is set inactive on
+Save and cannot be restored; adding the name again makes a new option. A new
+option goes last in its list. 86, available again, archive and restore are
+BO-03's row actions; BO-04 shows availability and archived status as facts and
+offers none of them. The [Frost BO-04 composition](visual-directions/frost/back-office/item-editor.html)
+and DESIGN-020 Handoff supply the exact copy, rules and walks, pending design
+review.
+
+**Requirements.** FR-B1, FR-B4, FR-C1, FR-C2, FR-C3, FR-C4, FR-C7, FR-C8,
+FR-M1, FR-M5.
```

`I` BO-04's *Must not invent* list is unchanged.

**`S` BO-04, changed lines** (`git diff -U0 d164a23`):

```
@@ -280,0 +281 @@
+│       ├── [INLINE] Currency and decimal places — fixed, plain text  FR-B1, M1
@@ -284 +285,6 @@
-│       └── [MODAL] Archive item — snapshots unaffected ... FR-C8, B-8
+│       ├── [INLINE] Option removal pending / undo; Move up, Move down  FR-B4
+│       ├── [INLINE] Invalid field / duplicate option name — local  FR-B4, M5
+│       ├── [INLINE] Item name in use — refused ........... FR-B4
+│       ├── [INLINE] Catalog changed — draft kept, Keep or Use current  ADR-012
+│       ├── [INLINE] Category archived meanwhile — choose another  ADR-012
+│       └── [MODAL] Stay or discard unsaved changes ....... FR-A2b
```

One removal to flag for the reviewer: BO-04's *Archive item* modal is gone
from `S`, because the lead's ruling puts archive on BO-03, whose node already
lists *Archive / restore category or item* (DESIGN-019). The snapshot fact it
carried (B-8) is in BO-04's standing context: "Existing orders keep their
saved names and prices."

### Questions and downstream work

No question blocks this design. Raised and not ruled, each with a proposed
answer:

1. **Swapping two option names in one save (S4a).** The screen accepts a draft
   where variant A is renamed B and variant B renamed A in one Save, because the
   result is valid. C1's recommended uniqueness is a partial unique index on
   `lower(name) WHERE is_active`, which cannot be deferred, so applying the two
   renames row by row collides mid-transaction. The same applies to removing
   an option and adding one with its name in one save, unless removals are
   applied first. **Proposed:** S4a's `editItem` applies removals first, then
   edits and additions, and makes a swap safe (for example by a deferred
   constraint trigger for within-item uniqueness, or by renaming through a
   temporary value inside the transaction). The architect owns the mechanism;
   the screen's rule stays "unique among active options after the save".
2. **A variant whose price exceeds the largest line total.** Base 99.999.999
   plus a change of 99.999.999 is within each field's bounds, but one unit
   exceeds FR-M5's maximum line total, so it could never be sold. BO-04 does not
   refuse it (no document grants that refusal); it notes "More than the largest
   line total, 99.999.999." under that variant. **Proposed:** keep the note and
   no refusal in Phase 1; Phase 2's add-line enforces FR-M5. If the owner wants
   a refusal, it belongs in the contract first.
3. **Keep my changes and untouched item fields.** Under DESIGN-018, Keep keeps
   the item's fields as the draft has them, so a field another manager changed
   that this draft never touched goes back on the next Save. Ruling 4(a) makes
   untouched *options* follow the current item instead. **Proposed:** keep both
   as ruled; the comparison now marks each differing field ("Differs from your
   draft"), so the manager sees what Keep would put back. If the lead wants
   symmetry, untouched fields would follow the current item too, which changes
   DESIGN-018's rule and so is the owner's call.
4. **BO-04's version is its own read.** I state that BO-04 builds on the item
   read it makes when it opens, not on BO-03's list version (DESIGN-019's "an
   editor carries the list's standing version" is about BO-03's inline
   editors). **Proposed:** S4c follows this; it is what makes BO-04's loading and
   read-failure states meaningful.

For **S4a**: name lengths (64 / 32 code points), bounds and option order as in
the tables above; `editItem` applies an explicit change list; removals set
inactive and never restore; within-item uniqueness among active options
(question 1).

For **S4b**: prices cross as canonical strings in every field of
`createItem` and `editItem`, including option deltas; a draft key identifies an
added option in `order`.

For **S4c**: copy, focus and rules above; the URL snapshots in `menu.js` and
`item-editor.js` are review plumbing, replaced by real reads; do not copy
BO-03's 80-unit stress name as valid; the money input is a pattern plus integer
comparison on strings, never `Number` or a float.

For **DESIGN-021**: nothing on the POS changes here. The POS shows
`max(0, base + variant + modifiers)` (FR-C2); BO-04's per-variant figure is a
back-office aid only.

For the **lead**: carry the four rulings above into DECISIONS; DESIGN-018's
"UTF-16 units" sentence still stands in `D` (not edited here, as the task
says it is being corrected).

DONE
