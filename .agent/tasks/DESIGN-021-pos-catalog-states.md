---
id: DESIGN-021
title: The POS addition in Frost (plan gap G6), the served menu, M-2 for any item and the served preset picker, for S7b
category: ui
touches: [money, boundaries]
depends_on: [DESIGN-022]
owns: [docs/design/**, docs/DESIGN.md]
status: review
cycles: 0
---
# DESIGN-021 — The POS addition: the served menu, M-2 for any item, the served preset picker

**Written** 2026-10-30 by the lead. The POS addition of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4 row S7b at `:431`, gap **G6** at `:83-85`),
paired with design slice D as DESIGN-011 asked. DESIGN-019 and -020 (BO-03, BO-04) and DESIGN-022 (BO-07) are merged.
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design021`). The review
is Claude Opus's (the other family).
**Branch and place:** `agent/design-021`, cut from `development` at `ad8276b`, in the worktree
`../restaurant-pos-wt/DESIGN-021`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`.

Nothing is built from this task directly. A design review follows; then plan slice **S7b** (the POS reads the catalog)
is written from it and from consult **C4**. **C4 runs at the same time** (ARCH-021, an architect, `architect21`). It
decides several things that change what you draw; they are marked **(C4)** below. The architect writes them first, in a
*For DESIGN-021* section of `.agent/reviews/ARCH-021-pos-catalog.md`, and the lead relays it to you. Draw every
**(C4)** state as the lead's provisional answer says, so the work does not wait; when C4's answer arrives, bring the
drawing into line with it. If you reach a **(C4)** item before its answer and the provisional answer below does not let
you draw it, ask the lead; do not ask the architect directly.

Abbreviations: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` = `docs/design/SITEMAP.md`,
`FP/` = `docs/design/visual-directions/frost/pos/`, `V/` = `docs/design/visual-directions/`. **C1** =
`.agent/reviews/ARCH-018-c1-configuration-schema.md`; **ADR-012** = `docs/decisions/ADR-012-versioned-configuration.md`.

## Objective

Today the POS menu is a fixture of twelve items with twelve hand-made item sheets (DESIGN-007). From S7 on, the served
POS shows whatever the manager has entered in the back office, which starts as **nothing** (B-24). When this task is
done, POS-03, M-2 and M-3's preset picker have reviewed Frost states for a **served** catalog of any size and shape, with
every word S7b will show (ADR-011 rule 24: the builder copies the design's words and invents none):

- POS-03 when the catalog is **empty**, when its **first read fails**, and while a **refresh fails** (G6);
- POS-03's menu for an arbitrary served catalog, including its extremes, and the 86 arriving for **any** item;
- **one** M-2 sheet drawn from data, for any served item, instead of a sheet per fixture item;
- the preset picker for served presets.

Almost every visual rule already exists in `D`. This slice applies them to data the POS did not have before; it should
add very little.

## Required inputs

Read these, in this order.

1. `I` POS-03 (`:163-312`), M-2 (`:1137-1145`), M-3 (`:1147-1153`), the shared general failures (`:83-124`), and the
   *Conventions* (`:16-41`).
2. `FP/order.html`, `V/frost-order-flow.js` and `V/frost-order-flow.css` (DESIGN-007's sheets: `sheet-item-<id>`,
   `sheet-item86`, the quantity keys and the draft totals), and the states `empty`, `loading`, `eightysix`,
   `fireblocked`, `catalog`, `sheet-discount`. The handoffs of `.agent/tasks/DESIGN-007-order-flow-gaps.md` (states and
   arithmetic) and `DESIGN-008-floor-and-incident-corrections.md`.
3. `D` *Money* (`:749`), *POS touch targets* (`:824`), *Buttons (POS)* (`:948`), *Menu tile* (`:978`), *Category row*
   (`:993`), *Modal and sheet* (`:1074`), *Notices and empty states* (`:1202`), *Do's and Don'ts* (`:1207`).
4. The downstream notes written for you: `.agent/tasks/DESIGN-019-menu.md` (*For DESIGN-021*, and round 2's F2: the
   86 and archive copy on BO-03), `DESIGN-020-item-editor.md` (*For DESIGN-021*: the POS shows
   `max(0, base + variant + modifiers)`), `DESIGN-022-discount-presets.md` (*Questions and downstream notes*).
5. The contract, for meaning: PRD FR-C1 to FR-C8, FR-D4, FR-E4, FR-F1 to FR-F5, FR-M5, AC-12, AC-26; BOUNDARIES B-8,
   B-17, B-21, B-22, B-24. ARCHITECTURE §4.3 (the poll and the open sheet).
6. `DECISIONS.md` lines for 2026-10-13 (the Phase 0 stand-ins) and 2026-10-20 Q14 (a cashier may add a real item to
   the client stand-in in Phase 1).

## Server facts (S4a to S6a, merged)

- **Names:** a category 1 to 32 code points, an item 1 to 64, a variant or modifier 1 to 32, a preset 1 to 32; trimmed,
  no control character (`packages/contracts/src/catalog.ts`, `discount-presets.ts`).
- **Prices,** whole rupiah: an item's tax-inclusive base price 0 to 99.999.999; a **variant** delta −99.999.999 to
  99.999.999, single-select (FR-C2); a **modifier** delta 0 to 99.999.999, multi-select, flat (FR-C3, FR-C4). An item
  may have no variants, no modifiers, or both; there is no default variant and no limit on how many options an item
  has. The resolved unit price is `max(0, base + variant + modifiers)` (FR-C2, AC-26).
- **Order:** categories, the items of a category, and the options of an item each have a manager-set display order
  (ties by name). The POS shows that order.
- **What reaches the POS** (C1 §2.2; DESIGN-019 round 2, F2, lead-ruled): an item that is active and in an active
  category. An **86'd** item stays, **disabled in place, never removed** (ruling C-3, AC-12). An **archived** item, and
  every item of an archived category, does not reach the POS. **(C4)** whether a category whose items are all archived
  is shown; provisional: not shown. **(C4)** inactive (removed) options: provisional: not shown on M-2.
- **Presets:** a percentage (0 to 100 percent, up to four decimal places) or a fixed amount (0 to 99.999.999). Only
  **active** presets reach the picker; **zero is valid and shown**; a fixed amount is capped at the subtotal when
  applied (FR-M5); a deactivated preset stays readable on an order that carries it (FR-F5). Presets are not
  approval-gated (FR-F2).
- **The catalog version** advances on every catalog change, an 86, an archive, a restore and a preset change included
  (ADR-012 rule 10). The POS polls it every two seconds and refreshes on tab focus (ARCHITECTURE §4.3). No Phase 1 POS
  command carries it (Q13): there is no `CATALOG_CHANGED` refusal of a POS command until Phase 2, and the existing
  `catalog` state is not part of this task.

## Rulings that bind this task

- **Q14:** in Phase 1, Add puts a real item into the client stand-in order, as fixture items do today. Nothing new is
  drawn for that; the order panel, the line states and the totals are unchanged.
- **Ruling C-3, AC-12:** an 86 disables a tile in place, greyed and marked, never removed, so the grid does not reflow
  under a finger. An open M-2 keeps the choices, marks the item unavailable, disables Add and explains why. This now
  holds for **any** item, not only Steak.
- **No product navigation between the clients.** The POS never links to the back office, and no POS state tells the
  cashier to do something only a manager can do without saying it is a manager's task.
- **Every person is named** (B-13). **Nothing applies itself** (FR-F7, B-21): the picker suggests nothing.
- **The floor (POS-02) and the order stand-ins stay fixture** until Phase 2 (owner 2026-10-13, Q14). Do not redraw
  them.
- **The existing pictures stay.** Keep the twelve `sheet-item-<id>` states and their aliases working; add states, do
  not rename or remove any. **(C4)** decides which `?state=` pictures the served build keeps; that is a build question,
  not a drawing one.
- **Tokens:** use the registry first. A missing value may be registered in `frost.tokens.json`, `frost.css` and `D`
  with `source: null` and a `designed` record, each listed in the Handoff. No raw colour, size or weight. No success
  green. Money in the Frost numeral style, whole rupiah with `.` grouping and no currency symbol (`D` *Money*).
- **Light only;** POS touch targets as `D` says.

## What to draw

### Part A — POS-03 with a served catalog, in `FP/order.html`

1. **Every state, by `?state=`,** for the table variant, and for the quick-sale variant where it differs. List them in
   the Handoff. They include:
   - **empty catalog**: no item can be offered (B-24's first state, and also the state when every category is
     archived). The order panel stays. Say in plain words that there is nothing to add yet and that a manager adds the
     menu; no control that cannot work. Decide whether Add-dependent controls (the quick sale's Settle, a discount) are
     shown, and why.
   - **loading**, on the first read (the existing *LOADING MENU*; confirm or adjust it).
   - **first read failed**: nothing to show, with *Try again*. **(C4)** when it is entered; provisional: the first read
     answers anything but success, or does not answer.
   - **refresh failing while a menu is shown**. **(C4)** whether the menu shown stays usable and after how long the
     cashier is told; provisional: it stays usable, and after three failed polls in a row (about six seconds) a quiet,
     persistent notice says the menu may be out of date, and clears itself when a poll succeeds. Never the emergency
     banner's urgency (that is reserved for print incidents, ARCHITECTURE §4.3 first paragraph).
   - **a served menu at its extremes**: one category; many categories (the category rail's overflow); a category of
     one item; a long category (the existing overflow); the longest item name (64 code points) and the largest price
     (99.999.999) on a tile; a price of 0.
   - **an 86 arriving** for an item that is not Steak, and the same item **made available again**; say whether either
     is announced to assistive technology, bearing in mind that a poll can change many tiles at once.
   - **an item archived while shown**, **(C4)** provisional: it leaves the grid at the next refresh, because it is no
     longer on the menu; say how the grid behaves so that it does not move under a finger (for example, removal only
     when no touch is in progress, or a placeholder), with a reason.
   - **a price changed while shown**: the tile shows the new price at the next refresh; lines already in the order keep
     theirs (FR-D4, B-8). Say whether anything marks it.
2. **The fire-blocked state for a real item** (FR-E4, B-17): **(C4)** whether it applies to a stand-in line in
   Phase 1; provisional: yes, as today, for any item. Draw it for a non-fixture item only if it differs from the Steak
   picture.

### Part B — M-2 for any served item, from data

1. **One sheet** composed from an item's data, drawn in `V/frost-order-flow.js` (or beside it, sharing it; do not
   fork). The existing per-item fixtures may become examples of it. States:
   - an item with **no options** (the Soda case), **variants only**, **modifiers only**, **both**;
   - **many** variants and many modifiers (the sheet's own scroll owner; Add and the quantity keys stay in reach);
   - the **longest** option name (32 code points) and the **largest** deltas (−99.999.999, +99.999.999);
   - a **negative variant delta that floors the unit price at zero** (AC-26), with the figure shown;
   - whether a variant must be chosen before Add when an item has variants (FR-C2 says "single-select"; there is no
     default variant): decide, say why, and draw the state where Add waits for a choice if it does;
   - **item 86'd while the sheet is open**, for any item (`I` M-2: choices kept, marked unavailable, Add disabled,
     explained);
   - **(C4)** the item **archived** while open, its **price or options changed** while open, and an option it has
     **selected removed** while open. Provisional: archived reads like the 86 case with its own sentence (the item is
     no longer on the menu); a price change updates the figures in place and says so once; a removed selected option
     is deselected and named. Draw each.
2. **The pending-line editor** (DESIGN-007's *Update to n*) for a served item: confirm it needs nothing new, or draw what
   it needs.

### Part C — the preset picker (M-3) with served presets

1. **(C4)** decides whether the Phase 1 picker reads real presets or keeps the fixture presets until Phase 2. Draw the
   served states either way; they are needed by Phase 2 at the latest:
   - **no active preset** (the picker's empty state; free-form discount stays where it is today);
   - a few presets of both kinds; **many** presets (scroll); the **longest name** (32 code points); **100%**, a
     four-decimal percent such as **12.3456%** (in BO-07's decimal style, DESIGN-022, unless the POS needs another, with
     a reason), **0%**, a fixed **0** and a fixed **99.999.999**;
   - a fixed preset larger than the current subtotal: say whether the picker shows the capped amount it would apply or
     the preset's value, and why (FR-M5 caps at application);
   - **(C4)** a preset deactivated while the picker is open; provisional: it leaves the picker at the next refresh,
     and if it was about to be chosen, nothing is applied and the cashier is told plainly.
2. No suggestion, ranking or "best discount" (FR-F7, B-21), no approval prompt for a preset (FR-F2), no date or
   schedule.

### Part D — copy, focus, registry and documents

1. **Copy for every new state**, in final words, as a table S7b can copy: the state, the element, the exact text, and
   the accessible name where a test will drive it. Name at least: *Try again*; the out-of-date notice; the empty
   catalog's text; a tile's accessible name when available and when 86'd; M-2's option controls, Add and its disabled
   reason; the picker's entries.
2. **Focus:** where focus lands when the first read fails and when *Try again* succeeds; when an 86, an archive or a
   change arrives while M-2 is open; when the picker's content changes under it. Nothing a poll does may move focus
   unless the focused element disappears; say where it goes then.
3. **`D`:** a short *DESIGN-021 additions* part, only for rules a later screen could reuse (the out-of-date notice and
   the data-driven sheet are the likely ones). Change no existing rule.
4. Register every new state in `FP/order.html`'s state list, `V/manifest.js` and the gallery (`V/index.html`). Write
   `docs/design/checks/design021.cjs` (POS-03, M-2 and M-3 states, measured at **1280×800**, the POS's size).
5. Bring `I` POS-03, M-2 and M-3, and `S` POS-03, into line: the new states (G6 closed), the data-driven sheet, and
   the served picker. Show each changed line in the Handoff (`git diff`).

## Constraints

- *Invent, revert, ask:* draw nothing the inventory, the PRD, ADR-012, C1, the server facts or the rulings above do
  not grant. A new screen, a new navigation path or a new modal is out of bounds; these are states of POS-03, M-2 and
  M-3.
- No catalog editing, 86 toggle, price edit or preset edit on the POS. No image, stock, ex-tax price, nested modifier
  group or default variant (C1 §2.2).
- The four product documents, the ADRs, C1 and C2 are not edited. Do not change DESIGN-007's line, round, fire, lock or
  totals behaviour, or DESIGN-012 to -022's shared rules. The existing checks (`design012.cjs` to `design020.cjs`,
  `design022.cjs`) must still pass.
- **The lead runs the check scripts**, which saves your allowance and the owner's approvals. When you want a run, ask
  through Herdr (`herdr agent prompt lead "design021: please run <script>"`) and wait for the result in your pane. Do
  not run them yourself unless the lead says so. Measure in a browser at 1280×800 through the check script and quote
  the measurements in the Handoff. Evidence stays outside the repository.

## Tests expected to change

None outside `docs/design/`. If you register a token, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
expected counts in earlier check scripts may change only where they count POS states or links you add; change only
those expectations, say so, and weaken no assertion.

## Acceptance criteria

1. Every state in Parts A to C is reachable by `?state=` and registered; a missing state fails this. The twelve
   existing item sheets and every earlier POS-03 state still render as before.
2. The Handoff maps every `I` POS-03, M-2 and M-3 state (as amended), every ruling above and every item of Parts A to
   D to the state that shows it, and gives the copy table of Part D item 1.
3. The Handoff states each of these as a rule S7b can test:
   - what the empty catalog shows and offers;
   - when the first-read failure and the out-of-date notice appear and clear (as C4 decides);
   - how an 86, a restore, an archive and a price change appear on the grid, and how the grid avoids moving under a
     finger;
   - M-2's composition from data: option order, whether a variant is required, the floor at zero, the 86 and the
     other mid-sheet changes;
   - the picker's order and content, and what it shows for a fixed preset above the subtotal.
4. Every **(C4)** item follows C4's *For DESIGN-021* section, or the Handoff names the difference and why.
5. Measurements at 1280×800 show no horizontal overflow and no clipped control at the longest names and the largest
   values, and the touch targets hold.
6. No raw colour, size or weight; any new tokens registered and listed; `npm run verify` green if anything under
   `docs/design/tokens/` changed. The earlier checks pass.
7. The Handoff lists every question raised and not ruled, each with a proposed answer, and anything S7b must know.

## Out of scope

- Applying a discount and its arithmetic (Phase 2), the free-form and remove/replace sheets, approval (M-1), the
  `catalog` refusal state (Phase 2), the floor, settlement, closed orders, print incidents. The back office. The frame
  focus question on BO-07 (queued separately). Building anything.

## Reporting

Commit on `agent/design-021` only, with path-scoped `git add`, after verify is green where it applies, and never push.
Commit as you finish each part, so the work survives an allowance limit. Write the Handoff below in full prose, ending
with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design021: DESIGN-021 done — <one line>"
    herdr agent prompt lead "design021: BLOCKED — <question>"

## Lead rulings during the task

**R1 (2026-10-30), long tile names.** The designer's proposal is accepted: the ruled 150×96 tile is kept; a name wraps
and is ellipsized after two lines; type does not shrink and the tile does not reflow; the full name is the tile's
accessible name and M-2's heading. Four conditions, each to be stated as a rule S7b can test:

1. **The price line is never truncated, wrapped away or pushed out of the tile**, at the longest name and the largest
   price together. The price is the cashier's second way to tell two items apart.
2. **Every tile opens M-2; no tile adds directly.** M-2's heading shows the whole name before Add, so a truncated tile
   is always confirmed by its full name before a line exists. If any item could be added without M-2, say so: the rule
   then needs another answer.
3. **Draw the collision:** two active items whose names differ only after the second line (names are unique, but a
   truncated prefix is not), side by side, and show where the cashier tells them apart. Name it in the Handoff as a
   known limit for the owner, with a proposed note (for example, a hint on BO-04's name field); do not draw the back
   office.
4. **A 64-code-point name in the order panel's line** (a real item now reaches the stand-in order, Q14) wraps in full
   and is never ellipsized, because the order is the record the cashier reads back. Measure it, with the line's
   quantity, price and trailing slot intact.

Measure with a realistic long Indonesian name as well as the 64-W worst case, and clamp by lines, not by a character
count.

## C4's *For DESIGN-021* (relayed by the lead, 2026-10-30)

Copied verbatim from `.agent/reviews/ARCH-021-pos-catalog.md` at `2e33a81` on `agent/arch-021` (headings demoted one
level). It **replaces the lead's provisional (C4) answers** wherever they differ; R1 above still stands. The lead's
notes on what changed:

- A category with no active items **stays in the rail** with an empty-grid state (provisional said not shown).
- An archive, restore, new item or reorder **reflows the grid** at the next refresh; only an 86 holds its slot. Part A's
  "how the grid avoids moving under a finger" now applies to the 86 only.
- *Possibly out of date* after **two** failed checks, not three; *First read failed* retries by the poll on its own.
- Section 7 (real presets in the Phase 1 picker) is **an owner question the lead is putting to the owner now**. Draw the
  recommended answer, as the section says.
- A percent shows with a **decimal comma** and no trailing zeros, as BO-07 does; this corrects the task's `12.3456%`.
- D2's loading can last up to 20 seconds; draw no duration. Section 5 asks you for the plural of `fire.ts`'s refusal.

#### 1. What reaches the POS

- **One projection, read as a whole.** It holds the active categories, their active items with each item's 86 state,
  each item's active variants and active modifiers, and (see 7) the active presets. All of it is in display order; the
  client does not sort.
- **It never holds** an archived category or anything in one, an archived item, a removed variant or modifier, or a
  deactivated preset. The POS cannot tell "archived" from "never existed". Draw nothing that names an archive at the POS.
- **An 86'd item stays on the grid**, disabled in place with its price (ruling C-3, already drawn). An item that is
  available again re-enables in place.
- **A category with no active items is still in the rail** and selectable. Its grid is empty, so it needs a one-line
  empty-grid state. Neither the inventory nor the artifact has one.
- **Only an 86 is in place.** An archive, restore, new item or reorder reflows the grid at the next refresh. AC-12's
  no-reflow promise is about an 86, and an archived item has no slot to keep.
- **The rail's selection follows the category's id.** If the selected category disappears, the selection moves to the
  first category, with no notice. A fresh mount starts on the first category.

#### 2. POS-03's catalog states, and when each is entered

All four concern the menu region only. The order panel stays live in every one of them. Under either settlement lock
the menu region is the lock notice and none of these shows.

| State | Entered when | Left when | The menu |
|---|---|---|---|
| **Loading** | The tab's first read is out and no menu is held. Never again after a menu has been held: not on a refresh, not after a lock | The read answers | None |
| **First read failed** | That read failed, or got no answer within the bound in D2. Nothing is held, so there is no threshold: one failure enters it | A later read succeeds. The poll keeps retrying every two seconds and the menu then appears with no press. *Try again* asks at once | None. Needs *Try again*, which repeats the read only |
| **Empty catalog** | A read succeeded and holds no category. This is a new installation (B-24). It is not an error, there is no *Try again*, and a menu made in the back office appears by the poll | The read holds a category | None |
| **Possibly out of date** | A menu is held and **two checks in a row** have failed | The next check that leaves the client current | **Stays fully usable**: tiles, sheets and Add all work |

- **One failed check shows nothing.** Two failures mean about four seconds since the last good answer, which is past the
  three-second budget, so the POS can no longer claim the budget. Hence two, not one and not five. The notice is
  non-blocking and states a doubt, not a failure of anything the cashier did.
- **A background retry does not flicker.** While *First read failed* stands, the poll's retries change nothing on
  screen. Only a press of *Try again* may show loading.
- **"The system is unavailable" and "something went wrong" are one state here.** The core distinguishes them, and the
  cashier can do nothing different. If you want two sentences, say so and the client will carry them; the entry rules
  do not change.
- **After a lock**, the held menu returns at once and is checked immediately. There is no loading state on sign-in, so a
  cashier returning every 90 seconds never sees a blank grid.
- **Not a Phase 1 state:** the existing `catalog` picture ("The menu changed while you were ordering… Nothing was
  added"). No POS command carries the version until Phase 2 (Q13), so that sentence could never be true in a served
  build. It stays a fixture picture. Do not repurpose its words for *Possibly out of date*. The `error` picture
  ("Could not add that line") is the same: no Phase 1 command is refused.

The other POS screens draw no catalog state. The floor stays fixture until Phase 2 (Q14).

#### 3. M-2 for any served item

- **The sheet has at most two groups, and they have no names of their own.** The catalog stores two flat lists on an
  item (FR-C2, FR-C3, FR-C4; no group, no parent). The fixture headings ("Size", "Doneness", "Extras") have no source in
  a served item. **You need two fixed labels**: one for the variants (choose one), one for the modifiers (choose any). A
  list with nothing in it draws nothing, as Soda does today.
- **Nothing is preselected.** There is no default variant in the schema (C1 §2.2), and preselecting one would be a price
  the cashier did not choose. The fixtures' preselections are pictures of a cashier mid-choice. The sheet opens at
  *empty*, which M-2 already lists.
- **An item with variants needs exactly one chosen before Add** (FR-C2 as ADR-012 reads it, enforced by the server from
  Phase 2 and mirrored here). **New state:** Add is off, with a plain reason, until a variant is chosen. This is
  distinct from the 86 state and from the ceiling in D1. Until a variant is chosen the line total shows the base price
  plus any modifiers, floored at zero.
- **Negative deltas and the floor** (FR-C2, AC-26): a variant's delta may be negative and the resolved unit floors at
  zero. The existing *resolved unit price floors at zero* state applies to real items.
- **Long names:** an item name is 1–64 code points, a variant or modifier name 1–32, and prices run to 99.999.999. An
  item may have any number of options, so *overflow* applies.

#### 4. The open sheet between polls

The sheet renders the live item from the current menu, never a copy taken when it opened. The cashier's choices are
held as option ids and survive every refresh. In every row below the sheet stays open: nothing is pulled from under a
finger. **Add never asks for an acknowledgement:** a pending line is freely removable (FR-H2), so ARCH-002's test finds
no irreversible harm to guard.

| While the sheet is open | The sheet | Add |
|---|---|---|
| **The item is 86'd** | Choices kept, marked unavailable, explained (AC-12; `sheet-item86` as drawn) | Off |
| **The item is available again** | The notice goes, choices kept | On, subject to the rest of this table |
| **The item is archived, or its category is** (it left the projection) | **New state.** The last-known name, options and choices stay readable. A notice says it is no longer on the menu. Do not reuse the 86 sentence: "a manager marked it 86" would be false. Cancel returns to a grid without that tile | Off |
| **It reappears** (restored) | As the row for available | On |
| **Its price, an option's delta or a name changes** | **New state.** The figures update at once, so what is shown is what Add adds. A notice says the item changed while the cashier was choosing, and stays until the sheet closes. One notice, whatever changed | On |
| **A chosen modifier is removed** | **New state.** It leaves the choices and the total. The same notice names what was removed | On |
| **The chosen variant is removed** | **New state.** No variant is chosen now. The same notice names it | Off until one is chosen (section 3) |
| **A new option is added, or options are reordered** | Drawn unselected, in place. No notice | Unchanged |
| **Checks are failing** (*Possibly out of date*) | Nothing changes; the sheet does not show that notice | Unchanged |

The sheet is opened by component state in served mode, as the line editor and the discount sheets already are, not by
`?state=sheet-item-<id>`. Nothing about it is in the URL and it is not back-stackable (SITEMAP §1). If the session
locks, POS-01 replaces the screen and the sheet's draft is gone, since the next person may be someone else. That is
existing behaviour and needs no drawing.

#### 5. A pending line whose item is 86'd later

**The stand-in's fire-blocked state applies to real items in Phase 1** (FR-E4, B-17 as presentation). The refusal and
the row tag are already read off the order by `fire.ts`, and the served path gives them the real unavailable list, so
restoring the item clears the block. No new drawing. The plural copy in `fire.ts` is still marked provisional (FE-011),
and a served order can now reach it: **please supply the plural wording.**

A pending line whose item was **archived** does not block in Phase 1, and nothing marks it. FR-E4 and ADR-012 rule 12
name availability only, and the line is a snapshot (FR-C8). Whether a fire refuses an archived item is Phase 3's.

#### 6. `?state=` pictures

Every menu picture you keep working from (`eightysix`, `loading`, `catalog`, `error`, `pressed`, `sheet-item*`) stays in
**fixture mode only**. In a served build those states draw the real catalog's facts and no fixture sheet. New pictures
for sections 2 to 4 are fixture-mode pictures on the same terms. Fixture order lines keep their names and prices beside
a served menu, under the owner's 2026-10-13 stand-ins. Do not draw a connection between them and the menu.

#### 7. The discount picker's served states

**Owner question, not yet ruled.** Q14 speaks of a real menu item; it does not literally cover applying a real preset.
This consult recommends real presets in served mode, and the lead will put that to the owner. **Draw the recommended
answer.** If the owner says no, the fixture list stays and only the states below go unused.

- **What it shows:** active presets only, in the server's order (oldest created first, as BO-07). A zero-valued preset
  is shown. Nothing is approval-gated (FR-F2). The free-form path and FR-F8's gates do not change.
- **New states, all in the picker:**
  - **Loading** and **first read failed:** the presets are read with the menu, so these are the same two facts as
    section 2. *Other amount* stays offered in both.
  - **No active presets:** the presets group is absent or says so (yours to choose), and *Other amount* stays.
- **Values:** a percent can carry four decimal places. Show it with a decimal comma and no trailing zeros, as BO-07
  does (owner, DESIGN-018 Q6). The fixture `10%` form is the whole-number case. A fixed amount larger than the
  subtotal is listed as stored and capped when applied (FR-M5), with the capped figure on the totals.
- **Between polls:** the open picker follows the live list. A deactivated preset's row goes and an edited preset's row
  updates, with no notice and no in-place rule, because applying the wrong preset is replaced without approval. An
  applied preset is a snapshot on the order and is unaffected (FR-F4, FR-F5).

#### 8. Copy the client needs that no design document holds (ADR-011 rule 24)

1. *First read failed*: title, body, *Try again*. 2. *Empty catalog*. 3. *Possibly out of date*. 4. The empty grid of a
category with no items. 5. The two fixed group labels of M-2. 6. Add off until a variant is chosen. 7. M-2's *no longer
on the menu* notice. 8. M-2's *item changed* notice, including its form naming a removed option. 9. D1's ceiling
reason. 10. The picker's loading, failed and no-presets states. 11. The plural of `fire.ts`'s refusal (section 5).

#### D1. FR-M5's ceilings in the Phase 1 stand-in — answered

**Yes, in both, as the lead's provisional answer says, with three additions.** The rule is one pure function that M-2
and the store both call, so the drawn state and the refusal cannot disagree. It is presentation in Phase 1 and stays as
presentation in Phase 2, when the server's refusal becomes the control. Enforcing it costs one state now, and that
state is needed in Phase 2 anyway. Without it, a legal served item would show a line total the server will later refuse.

- **M-2.** When the line or the order would pass 99.999.999, Add is off with a plain reason, and the plus key is off when
  the next quantity would pass it. Minus stays live.
- **Addition 1: a choice can pass the bound at quantity 1.** A base of 99.999.999 plus a positive delta passes it before
  any quantity. So the off-state follows the choices as well as the keys: choosing an option may turn Add off, and
  unchoosing it turns Add on. The option itself is never refused, and the reason names the limit. Draw the state with
  the quantity at 1.
- **Addition 2: the order figure is the order's `total`** as the panel shows it, after discount and service charge, with
  the new line in it. In Phase 1 that uses the fixture rates (ADR-012 *Consequences*). The reason should not quote a
  computed excess.
- **Addition 3: the line editor uses the same check.** Its *Update to n* (M-5's form too) is off, with the same reason,
  when the new quantity would pass either ceiling. Otherwise the rule is walked around by adding one and raising the
  quantity. This is a ceiling, not a lock, so it does not disturb the plan's deferral of `setQuantity`'s lock check to
  Phase 2.
- **Not checked in the stand-in:** removing or replacing a discount, which can raise the total past the ceiling. Nothing
  is stored, and refusing a discount change needs a state no one has drawn for a case that needs a near-limit order. The
  server owns it from Phase 2.

The reason's wording is item 9 in section 8. The ceiling needs no new constant in `tender.ts`'s sense: a shared
`LINE_TOTAL_LIMIT`, and an order limit of the same value, belong beside `SINGLE_TENDER_LIMIT`.

#### D2. The first read with no response — answered

**No new timer: the core's bound ends it. But the bound is up to 20 seconds, not 10, and the lead's provisional answer
understates it.** A request that times out at `DEFAULT_TIMEOUT_MS` is a fault, and a fault makes the core ask
`GET /api/health` before it returns a result (ADR-011 rule 20; `healthDecides`, `client.ts:299`). That read has its own
ten-second timer. So:

| What the server does | *Loading* lasts |
|---|---|
| Refuses the connection, or answers an error | About as long as one round trip, plus the health read |
| Holds the read, then answers health | About 10 seconds |
| Holds both | Up to 20 seconds |

Draw nothing that promises a duration. *Loading* needs no second stage for the long case. The order panel is usable
throughout, and a hung server on the same machine is rare. A separate 10-second timer in the catalog store would put
the state on a second clock, ahead of a result the core has not returned yet, and the late answer would then have to be
reconciled. Rejected.

## Lead verify (2026-10-30)

At `6fdfa1b`, the tree clean. `git diff --name-only ad8276b...HEAD`: this task file, `docs/DESIGN.md`,
`docs/design/SCREEN-INVENTORY.md`, `docs/design/SITEMAP.md`, `docs/design/checks/design021.cjs`, and in
`docs/design/visual-directions/` `frost-order-flow.js`, `frost-served-catalog.css`, `frost-served-catalog.js`,
`frost/pos/order.html`, `index.html` and `manifest.js`. All are within `owns`; nothing under `apps/`, `packages/`, `db/` or
`e2e/`, and nothing under `docs/design/tokens/`, so `npm run verify` is not required (AC 6). `git diff --check` is clean.

The lead ran the checks in this worktree after `npm ci`, with `PLAYWRIGHT_MODULE` from it and evidence outside the
repository (`../restaurant-pos-wt/evidence/DESIGN-021/`):

- **run2** (`fe71f6a` plus the designer's then-uncommitted edits): `design021.cjs` 58 states, 352/352; and the earlier
  checks, each exit 0 with no failures or errors: `design012` 421 checks / 116 states, `design013` 371 / 41, `design014`
  287/287 (the `development` baseline), `design016` 399/399, `design017` 349/349, `design018` 730/730, `design019`
  998/998, `design020` 754/754, `design022` 688/688.
- **run3** (the final source): `design021.cjs` exit 0, 58 states, 360/360, no failures or errors. Its recorded source
  hashes (`frost-order-flow.js` `b1cc252b`, `frost-served-catalog.js` `9df0b612`, `frost-served-catalog.css` `033abec1`,
  `frost/pos/order.html` `607c0fc2`, `manifest.js` `4c3db5a8`) equal `shasum -a 256` of the committed files at `6fdfa1b`.
  The earlier checks were not re-run after run2; the files changed since then are this task's own POS files and the
  inventory, sitemap and `D` text, which those checks do not read except through `manifest.js` and `index.html`.

The lead did not walk the states by hand; the owner's look follows the review. The reviewer is Claude Opus (the designer
was Codex). C4's *For DESIGN-021* (above) is the authority for every former **(C4)** item; R1 stands; OQ1 is open with
the owner, and the drawn picker states follow its recommended yes. The lead accepted the designer's 86-stepper reading
(stepper live within its bounds, Add alone blocked).

## Handoff

### design021 — 2026-10-30

The drawings implement Parts A–D and the lead-relayed C4 section above. They
are local design fixtures, not a production catalog, seed data, or application
code. Only design artifacts, the two design documents, the sitemap, inventory,
and this Handoff were changed. The existing order model, fire rounds, locks,
committed totals and twelve DESIGN-007 item-sheet examples remain. No file
under apps, packages, db or e2e was edited. No product document, ADR or token
registry was edited; no new token is needed. No push was made.

Part A was committed as `c7bf819`, Part B as `87d8bc2`, and Part C plus the
provisional money limits as `f18582b`. The C4 correction and passing browser check were committed as `a00da29`;
they supersede provisional behavior in those commits. In particular, there is no archive
placeholder, three-failure threshold, preset-change notice or picker cap
preview in the final drawing.

#### Rules S7b can test, and the reasons for them

1. **The menu is a whole served projection.** Categories, items, variants,
   modifiers and presets retain server order. Active empty categories remain
   selectable, with “No items in this category yet.” Archived categories,
   their items, archived items, removed options and inactive presets are
   absent. No POS copy claims to know that an absent item was archived.
   Category selection follows its id; losing that id selects the first
   category silently. The standalone pictures do not fetch a server.
2. **Empty catalog means no categories**, following C4, not an empty active
   category. It offers no non-working menu control, no retry, and no link to
   the back office. The text makes menu setup a manager's task. The order
   panel remains. On an empty order, Discount, Void order and Settle stay in
   place, focusable and inert, with “Add an item first.” A table also retains
   its inert Send; a counter never has Send. An existing order keeps its
   existing actions even when the menu read is empty, loading or failed.
3. **Loading is the first read only.** It lasts until the transport answers;
   C4 D2 permits up to 20 seconds when both the request and its health probe
   time out. There is no new timer, countdown or promised duration. One
   unsuccessful first read enters failure. Keep the existing shared general
   failure title/body variants, because this preserves consistent failure
   language across clients; S7b should carry the core's unavailable versus
   unexpected-failure classification. Both have the same Try again action.
   Poll retries continue every two seconds without replacing failure with
   loading. Explicit Try again may show loading and repeats only the read.
4. **A held menu stays usable.** One failed check is silent. Two consecutive
   failed checks show the quiet out-of-date notice, approximately four
   seconds after the last good answer for promptly failing checks. Only a
   check that leaves the client current clears it. An open M-2 does not
   duplicate the notice or disable Add. Returning after a session lock uses
   the held menu and checks immediately; the existing lock drawings remain
   the authority while locked. No Phase 1 command carries a catalog version.
5. **86 and restoration hold the slot exactly.** The price remains legible;
   unavailable tiles are grey, dashed, marked 86, focusable and guarded by
   aria-disabled. A whole accepted update uses one polite “Menu availability
   updated.” status, not one announcement per tile. No change means no
   announcement. A focused tile retains focus. Availability restoration
   removes 86 and re-enables that same button. The status occupies the menu's
   bottom edge so its appearance never moves a tile's top-left position.
6. **Projection changes reflow.** An absent item is removed at refresh with
   no placeholder, delay for a finger, or archive announcement. New items,
   restored items and order changes likewise use the current projection.
   Only 86 has AC-12's no-reflow promise. Prices update on the tile without a
   badge or notice. Lines already in the order retain their snapshots; an
   archived pending item is not marked or fire-blocked in Phase 1. The
   `served-price` line keeps 45.000 while its tile becomes 50.000.
7. **Every tile opens M-2, including zero-price and no-option items.** There
   is no direct-add tile. At most two fixed groups appear: Variant and
   Modifiers. An empty list draws no heading. Nothing is selected when
   opening a fresh item. When variants exist, exactly one is required;
   modifiers are independent multi-select choices. Until a variant is
   chosen, figures show base plus selected modifiers. Each commit snapshots
   the full name, choices and displayed non-negative unit price. The
   selected fixture states are pictures after a cashier made choices, not
   default selections to copy into the build.
8. **M-2 keeps quantity and Add in reach.** Its body alone scrolls, including
   long option lists and calculations. The header shows the full item name.
   Quantity keys and Add stay in the fixed footer. The unit is
   `max(0, base + variant + modifiers)`; the line is unit times quantity.
   Cancel/Escape discard, and Add alone commits. A pending-line editor uses
   the same footer, snapshot unit and explicit Update to n; unchanged Update
   remains off. Back discards, and Remove stays separate.
9. **The open sheet follows the current item.** Choices survive by option
   identity. An 86 keeps choices and disables Add; becoming available clears
   the availability notice. An item leaving the projection keeps last-known
   details, with the distinct no-longer-on-menu sentence. Reappearance
   restores Add subject to the remaining guards. Name, price and option
   delta changes update the figures immediately and leave one change notice
   until closing. Selected option removal names the removed choice and
   removes its delta. A removed variant leaves no choice, so Add waits if
   variants remain; a removed modifier does not disable an otherwise valid
   Add. New options and reorder do not create a notice or a selection.
10. **The stepper stays visible while unavailable.** This answers C4's
    ItemSheet-comment discrepancy: quantity can still be adjusted within
    its quantity/money bounds during 86 or absence. Add alone is blocked by
    availability. Restoration retains the draft quantity and choices. S7b2
    should follow this drawing, not the contradictory code comment.
11. **D1's ceiling is one check shared by Add and Update.** A line amount
    above 99.999.999 disables commit; otherwise check the resulting order
    total, after its discount and service, against the same limit. Plus is
    off if the next quantity would exceed either limit or 99. Minus stays
    live above 1. A choice may exceed a limit at quantity 1; the option stays
    selectable, and changing the choice can clear the reason. No computed
    excess is quoted. The order panel stays committed while the editor's
    preview is explicitly unsaved. Removal/replacement of discounts remains
    outside this stand-in ceiling, as C4 D1 states; Phase 2 owns enforcement.
12. **Preset choice is explicit.** Active presets retain the server's
    oldest-created-first order, including zero values. Percentages use a
    decimal comma without trailing zeros: 12,3456%, 100%, 0%. Fixed amounts
    show their stored value, including 0 and 99.999.999. A value above the
    subtotal is still listed as stored; application caps it in the totals.
    This follows C4 and keeps a preset identifiable independently of the
    current order. No ranking, suggestion, scheduling or new approval
    appears. Loading, failure and no active presets retain Other amount.
    Changed entries update and removed entries leave silently. An already
    applied preset remains the order's snapshot. The design runtime records
    a chosen preset and closes; applying its discount/arithmetic is out of
    this task's scope and is not newly simulated.

**R1 and the known name collision.** The 150×96 tile clamps the name by two
lines, never by character count. Price always has its own unclipped line.
The full name is exposed in its accessible name and M-2 before Add. The two
active items “Nasi Goreng Kampung dengan Ayam Suwir dan Sambal Terasi Merah”
and “… Hijau” deliberately have identical visible prefixes; their different
prices and full sheet headings distinguish them. This remains a known limit
for the owner. Proposed future BO-04 hint: “Put distinguishing words near the
start of the item name.” BO-04 was not edited. Stress fixtures use both 64 W
characters and the realistic Indonesian name “Nasi Goreng Kampung dengan Ayam
Suwir dan Sambal Terasi Istimewa”. Both wrap in full on order lines beside the
quantity, amount and unchanged 56×56 trailing control.

#### Exact copy and accessible names

Braces denote substituted data; they are not displayed literally. Every
amount uses whole rupiah and period grouping. The accessible name is the
visible label where the last column says “same”. An option's name includes
its signed delta; plus zero is shown as +0. No raw error code appears.

| State | Element | Exact text | Accessible name / test target |
|---|---|---|---|
| Initial menu read | Loading label | LOADING MENU | Status, same |
| Initial unavailable read | Title | The system is unavailable | Alert title, same |
| Initial unavailable read | Body | Wait a moment, then try again. | Same |
| Unexpected read failure | Title | Something went wrong | Alert title, same |
| Unexpected read failure | Body | Try again. If the problem continues, ask a manager for help. | Same |
| Either read failure | Action | Try again | Try again; `served-retry` |
| Empty catalog | Title | No menu items yet | Same; `served-empty` |
| Empty catalog | Body | There is nothing to add yet. A manager adds the menu in the back office. | Same |
| Empty order | Title / body | No items yet / Add an item when the menu is available. | Same |
| Empty order | Disabled-action reason | Add an item first. | `served-action-reason`, described by each disabled action |
| Empty active category | Grid | No items in this category yet. | Same |
| Held read uncertain | Notice | The menu may be out of date. You can keep taking orders. | Polite status, `served-status` |
| Batch availability update | Status | Menu availability updated. | Polite status, `served-status` |
| Available tile | Name and price | {full item name}; {base price} | `{full item name}, {base price}` |
| Unavailable tile | Name, price and marker | {full item name}; {base price}; 86 | `{full item name}, {base price}, unavailable, 86`; aria-disabled |
| Category | Rail button | {category name} | Same; aria-pressed indicates selection |
| M-2 | Sheet title | {full item name} | Dialog labelled by `flow-title` |
| M-2 variants | Group heading | Variant — choose one | Group “Variant” |
| M-2 modifiers | Group heading | Modifiers — choose any | Group “Modifiers” |
| M-2 option | Choice | {option name} {signed delta} | Same; aria-pressed indicates choice |
| M-2 figures | Labels | Unit price / Line total | Same; `served-unit` and `data-line-total` |
| M-2 variant required | Add reason | Choose a variant before adding this item. | `served-add-reason` |
| M-2 commit | Action | Add to order | Same; `.flow-save`, described by `served-add-reason` |
| M-2 cancel | Action | Cancel | Same; `data-cancel` |
| Quantity | Minus / plus | − / + | Decrease quantity / Increase quantity |
| Quantity | Readout | {quantity} | Quantity; group also named Quantity |
| Quantity at 1, adding | Bound | Minimum 1 per line. | Polite bound line |
| Quantity at 1, editing | Bound | Minimum 1. Use Remove line to remove this line. | Polite bound line |
| Quantity at 99 | Bound | Maximum 99 per line. Increase is unavailable. | Polite bound line |
| Other quantities | Bound | Quantity · whole numbers, maximum 99 | Polite bound line |
| Monetary line limit | Commit reason | Line total cannot exceed 99.999.999. | `served-add-reason` |
| Monetary order limit | Commit reason | Order total cannot exceed 99.999.999. | `served-add-reason` |
| Next quantity exceeds money limit | Bound | Cannot increase quantity. {applicable ceiling sentence above} | Polite bound line |
| Open item becomes 86 | Notice | {item name} is no longer available. A manager marked it 86. Your choices are kept, but it cannot be added. | Polite status, `served-sheet-notice` |
| Open item becomes 86 | Add reason | This item is unavailable. | `served-add-reason` |
| Open item leaves projection | Notice | {item name} is no longer on the menu. Your choices are kept, but it cannot be added. | Polite status, `served-sheet-notice` |
| Open item leaves projection | Add reason | This item is no longer on the menu. | `served-add-reason` |
| Name, price or delta changes | Notice | This item changed while you were choosing. Check the updated choices and prices before adding. | Polite status, `served-sheet-notice` |
| Selected option removed | Notice | This item changed while you were choosing. {option name} was removed and deselected. | Polite status, `served-sheet-notice`; variant-required reason appears separately when needed |
| Pending editor | Actions | Back / Remove line / Update to {quantity} | Same |
| Pending editor | Preview label | After update · not saved yet | Same |
| Fire refusal, singular | Title / body | Cannot send to the kitchen / {item name} is 86’d. Remove the pending line or ask a manager to restore the item. | Same |
| Fire refusal, plural | Title / body | Cannot send to the kitchen / {item names} are 86’d. Remove their pending lines or ask a manager to restore the items. | Same; names are a comma-separated list, not a quantity claim |
| Fire refusal | Recovery | Show unavailable lines | Same; `served-show-blocked`, reveals/focuses first offending line |
| M-3 | Title / note | Discount / One per order | Dialog labelled by `flow-title` |
| M-3 | Group | Presets — no approval needed | `preset-heading` |
| Preset read | Loading label | LOADING PRESETS | Status, same |
| Preset unavailable read | Title / body / action | The system is unavailable / Wait a moment, then try again. / Try again | Alert; action `preset-retry` |
| No active presets | Body | No active presets. A manager can add or activate a preset in the back office. | Same |
| Percent preset | Entry | {preset name} — {percentage}% | Same; visible name and value occupy separate columns |
| Fixed preset | Entry | {preset name} — {amount} off | Same |
| M-3 secondary path | Label / action | Anything else / Other amount — needs a manager | Same |
| M-3 footer | Action | Cancel | Same; `served-preset-cancel` |

Restoration, added/reordered options and preset edits/removals add no success
sentence. The preset-removal provisional sentence “Nothing was applied” was
removed under C4. For a change and unavailability arriving together, one
notice contains the availability sentence followed by the change sentence;
restoration removes only the availability part. The item-change sentence
persists until closing. S7b should deduplicate names if several pending lines
hold the same unavailable item when composing the plural refusal.

#### Focus and keyboard rules

The initial read-failure picture starts on Try again. In a running workspace,
a failed background read must preserve focus in the live order panel. If a
focused read control disappears when the read succeeds (whether by polling or
explicit retry), focus moves to the first category, or to the empty-catalog
message if no category exists. A user already working in a persistent order
control retains it. Background retries never replace the failure UI.

Opening M-2 or M-3 focuses its heading, keeps the readable order inert, and
contains Tab/Shift-Tab inside the sheet. Escape and Cancel return to the
opener; if it disappeared, use its still-existing item button after a restore,
or the selected category otherwise. A poll changing a price, name, availability,
selection value or preset value keeps focus where it was. A removed focused
option goes to that group's heading; if the group itself is empty and gone,
use the sheet heading. A removed focused preset goes to Presets — no approval
needed. A removed focused tile goes to its selected category. If that category
also disappears, use the first category. The fixture's review URLs are not
served application navigation or browser-history entries for sheets.

#### Every state and the acceptance mapping

The following table lists all new query pictures. The same entries are in
order.html, manifest.js and the gallery's Frost selector; Paper excludes them.
All share the same 1280×800 surface and existing order/overlay compositions.

| Query state | Picture |
|---|---|
| `served` | Served menu |
| `served-empty` | Served menu — empty |
| `quick-served-empty` | Counter — empty catalog |
| `served-empty-order` | Empty catalog — existing order |
| `served-loading` | Served menu — first read |
| `quick-served-loading` | Counter — first read |
| `served-error` | Served menu — unavailable |
| `quick-served-error` | Counter — unavailable |
| `served-error-internal` | Served menu — unexpected failure |
| `served-stale` | Served menu — refresh failing |
| `quick-served-stale` | Counter — refresh failing |
| `served-single` | Served menu — one item |
| `served-categories` | Served menu — many categories |
| `served-overflow` | Served menu — many items |
| `served-extremes` | Served menu — longest name, maximum and zero price |
| `served-86` | Served menu — Nasi Goreng 86 |
| `served-restored` | Served menu — Nasi Goreng restored |
| `served-archived` | Served menu — item archived |
| `served-price` | Served menu — price changed |
| `served-item-none` | Served M-2 — no options |
| `served-item-variants` | Served M-2 — choose a variant |
| `served-item-modifiers` | Served M-2 — modifiers only |
| `served-item-both` | Served M-2 — both option kinds |
| `served-item-many` | Served M-2 — many options |
| `served-item-extremes` | Served M-2 — longest names and deltas |
| `served-item-floor` | Served M-2 — unit price floors at zero |
| `served-item-86` | Served M-2 — 86 while open |
| `served-item-archived` | Served M-2 — archived while open |
| `served-item-price` | Served M-2 — price changed |
| `served-item-options` | Served M-2 — options changed |
| `served-item-removed` | Served M-2 — selected variant removed |
| `served-item-long` | Served M-2 — 64 W name |
| `served-item-indonesian` | Served M-2 — long Indonesian name |
| `quick-served-item-both` | Counter — served item sheet |
| `served-line-long` | Order line — 64 W name |
| `served-line-indonesian` | Order line — long Indonesian name |
| `quick-served-line` | Counter — served pending-line editor |
| `served-presets` | Served presets — all values |
| `served-presets-empty` | Served presets — none active |
| `served-presets-many` | Served presets — overflow and longest name |
| `served-presets-removed` | Served presets — deactivated before selection |
| `served-item-line-bound` | Served M-2 — quantity limited by money |
| `served-item-order-bound` | Served M-2 — order maximum blocks Add |
| `served-category-empty` | Served menu — active category with no items |
| `served-item-restored` | Served M-2 — available again |
| `served-item-reappeared` | Served M-2 — back on the menu |
| `served-item-changed` | Served M-2 — name and option delta changed |
| `served-item-modifier-removed` | Served M-2 — chosen modifier removed |
| `served-item-reorder` | Served M-2 — options reordered |
| `served-item-choice-bound` | Served M-2 — choice exceeds line maximum at 1 |
| `served-line-bound` | Pending-line editor — money ceiling |
| `quick-served-line-bound` | Counter line editor — money ceiling |
| `served-presets-loading` | Served presets — first read |
| `served-presets-error` | Served presets — first read failed |
| `served-presets-changed` | Served presets — value changed |
| `served-fireblocked` | Served pending lines — plural 86 refusal |
| `served-loading-order` | First read — existing order stays live |
| `served-error-order` | First read failed — existing order stays live |

Part A uses `served` through `served-price`, the two existing-order read
pictures, active empty category, and `served-fireblocked`. The quick pictures
draw the only changed affordance: no Send, and the explicit Settle wording.
All other menu/sheet layouts are identical between table and counter. Part B
uses the served-item and served-line pictures; Part C uses served-presets.
Part D is the copy/focus/rules above, the registry, the amended inventory and
sitemap, the reusable additions in D and design021.cjs.

| Existing inventory state / ruling | Retained evidence or new mapping |
|---|---|
| POS-03 empty order, loading, error | `empty`, `loading`, `error` remain; served read facts have separate states above, so command rejection is not reused for a read failure. |
| Permission denial and gated actions | `approval`, `approval-error`, `approval-throttled`, `approval-denied`, `sheet-freeform`, `sheet-remove`, `sheet-voidline`, `sheet-voidorder-fired`; unchanged. |
| Overflow, pending/fired/voided lines, round grouping | `overflow`, `linecontrols`, `fire-heading-width`; served menu/option/rail overflow is separate. |
| 86 and fire block, C-3/AC-12/B-17 | `eightysix`, `fireblocked`, `sheet-item86` remain; arbitrary Nasi Goreng and Jasmine Tea use served availability/blocked states. |
| CATALOG_CHANGED / FR-C7 | `catalog` remains fixture-only, Phase 2. It is not a served Phase 1 refusal or refresh notice. |
| Discount applied / zero total / B-21/B-22 | `default`, `zero`, `sheet-remove`; no new automatic or stacked application. |
| Own draft / another lease / locked pending line | `lock-draft`, `open-t7`, `lock-lease`; menu absent and line controls inert, unchanged. |
| Fire outcomes and blocked-line recovery | `fire-ready`, `fire-queued`, `fire-printed`, `fire-failed`, `fire-unknown`, `fire-then-add`, `fire-heading-width`, `fireerror`, `fireblocked`; no delivery claim added. |
| Twelve existing item-sheet pictures and aliases | `sheet-item-burger`, `-wings`, `-steak`, `-fish`, `-salad`, `-soup`, `-fries`, `-rings`, `-soda`, `-coffee`, `-beer`, `-wine`; `sheet-item`, `sheet-item86`, `sheet-item-two`, `sheet-item-max`. The served composer shares their flow; it does not replace these examples. |
| Quantity editor, table and quick | `sheet-line`, `sheet-line-changed`, `sheet-line-max`, `quick-line`, `quick-line-changed`, `quick-line-max`; served editor uses the same snapshot/preview/commit behavior plus D1. |
| M-2 empty/loading/error/overflow | Empty choices and many options are drawn above. A served sheet uses the held read, so it has no independent loading/read error; those are POS-03's menu states before any item opener exists. The old command-error/catalog pictures remain Phase 2 fixtures. |
| M-2 zero floor and availability | `served-item-floor`, `served-item-86`, `served-item-restored`; no inferred negative sale. |
| M-3's three nodes and snapshots | Served preset states extend only the picker; free-form and remove/replace/approval remain existing nodes. Deactivated presets are absent here and existing applied snapshot stays readable on the order. |
| Q14, B-8, FR-D4, B-24 | Explicit Add places a real item into the transient client order; prices/names become snapshots. No server or persistence is claimed. Empty catalog contains no seed menu; floor and old order lines stay fixture. |
| B-13, client boundary, light/tokens | Ana R. remains the named cashier. No POS control opens the back office or performs manager catalog work. Light Frost, existing tokens, no success green. |
| R1 and C4 | Applied as the rules above state, including all D1 additions and D2's transport bound. C4 section 7's recommendation is drawn pending OQ1. |

#### Arithmetic examples

- Normal served Nasi Goreng is 45.000. Small −10.000 plus Fried egg +5.000
  resolves to 40.000. The floor example is `max(0, 45.000 − 99.999.999) = 0`.
- The option-ceiling picture keeps quantity 1 and a chosen +99.999.999 variant
  over base 99.999.999; its line exceeds the limit and Add is off. Unselecting
  a positive modifier or choosing the negative variant recomputes the guard.
- A 60.000.000 item can be added once to the shown table, but twice would make
  a 120.000.000 line, so Plus is off. The editor picture starts at a draft
  quantity of 2 over a committed quantity of 1; Update is off and Minus works.
- The order-ceiling picture holds a 10.000.000 line. Adding 99.999.999 would
  make subtotal 109.999.999, less a rounded 10% discount of 11.000.000, plus
  service 4.950.000: total 103.949.999. The displayed reason names only the
  99.999.999 limit, not this computed excess.
- The long-name order picture has subtotal 99.999.999, discount 10.000.000,
  service 4.500.000 and total 94.499.999; its full name and large amount fit.
  The Indonesian-name line is 65.000, discount 6.500, service 2.925, total
  61.425. Snapshot arithmetic is unchanged from DESIGN-007.
- Preset 99.999.999 remains that stored value in the picker even beside a
  165.000 subtotal. The later application is capped to 165.000. No new preset
  arithmetic was implemented in this design runtime.

#### Verification and measured limits

The lead ran the browser scripts; I read their output and inspected the
screenshots. Final DESIGN-021 run 3 passed **360/360 checks across 58 new
states**, with no page errors or failures. Every pre-existing order query
state was opened, and all twelve named DESIGN-007 item sheets were checked.
The final five source hashes match the measured working files:

| Source | SHA-256 prefix |
|---|---|
| frost-order-flow.js | b1cc252b |
| frost-served-catalog.js | 9df0b612 |
| frost-served-catalog.css | 033abec1 |
| frost/pos/order.html | 607c0fc2 |
| manifest.js | 4c3db5a8 |

Evidence is outside the repository at
`../evidence/DESIGN-021/run3/design021/measurements.json`, with screenshots
and stdout alongside it. The earlier required suite, run by the lead against
the C4-corrected tree in run 2, passed: design012 421 checks/116 states;
design013 371 checks/41 states; design014 287/287 (the known development
baseline); design016 399/399; design017 349/349; design018 730/730;
design019 998/998; design020 754/754; design022 688/688. Their output is under
`../evidence/DESIGN-021/run2/designNNN/`. There is no design015.cjs.
Run 1 stopped because Playwright correctly would not click an aria-disabled
tile; the test now invokes its DOM activation to prove the guard. That run
also exposed the picker-footer selector, which was fixed before the green
runs. Run 3 specifically covers the final served Discount opener, retained
86 stepper and scroll reachability. No unresolved check failure remains.

| Measured case at 1280×800 | Result |
|---|---|
| Every new state | Product 1280×800; document and product horizontal extent 1280; no document horizontal overflow. |
| Menu extremes | All tiles 150×96; maximum 99.999.999 price fits beneath the two-line name; full-price width checks pass. |
| M-2 geometry | Sheet x0, y64, width820, height736. Sheet body width818 with no horizontal overflow. |
| Many options | Body client height411, scroll height2439, final scrollTop2028. Last option reachable; fixed footer unchanged. |
| M-2 footer | Cancel 150×72; minus/plus 88×88; Add 466×88. Footer controls stay entirely above y800. |
| Extreme option names/deltas | Option controls at least72px tall; names wrap and full signed 99.999.999 values fit. The longest header grows without clipping Add. |
| Many categories | Rail client height736, scroll height1728, final scrollTop992; width and scroll width171 inside its 172px rail allocation. |
| Long category | Grid client height736, scroll height2096, final scrollTop1360; client/scroll width648. |
| Many presets | Body client height565, scroll height3371, final scrollTop2806; final entry and Other amount reachable. Cancel remains 778×72 at y711. |
| 64 W order line | Full name box approximately232×87, normal wrapping and visible overflow; no hidden name content. Quantity/amount remain separate and trailing remove is56×56. |
| Indonesian order line | Full name box approximately261×43.5; no hidden name content, same intact trailing slot. |

`node --check` on both runtime scripts and the new check, and
`git diff --check`, were run and passed. The final checks cover restoration,
archive reflow/focus, retry focus, the two-failure threshold, the zero floor,
required variants, removed choices, quantity/option/editor monetary bounds,
preset read states, silent removal and plural fire copy.

The source-only Impeccable detector ran once. It returned warnings on inherited
frame padding, compact tags/text and fixed surface conventions, rather than a
clean result. Its context loader selected the older visual-directions DESIGN.md;
the task's current docs/DESIGN.md and registry govern. No inherited Frost rule
was changed to satisfy those heuristics. Physical touch, assistive-technology
speech output, real catalog HTTP, session timing and application integration
were not tested here. No npm verification was required because no token or
application file changed. Earlier design check expectations were not changed.

#### Inventory and sitemap diff

The exact changed lines follow; surrounding context is retained for review.

```diff
diff --git a/docs/design/SCREEN-INVENTORY.md b/docs/design/SCREEN-INVENTORY.md
index 44106e8..487bb80 100644
--- a/docs/design/SCREEN-INVENTORY.md
+++ b/docs/design/SCREEN-INVENTORY.md
@@ -184,0 +185,13 @@ affordances only.
+- *served catalog* — DESIGN-021 closes G6: first read loading; first read
+  failed with Try again; successful empty catalog; held catalog possibly out
+  of date after two failed checks, still usable. Reads affect only the menu;
+  existing order work remains live. Initial failure retries in the background
+  without flicker. A successful current check clears the stale notice.
+- *served menu extremes* — one or many categories, one or many items, an active
+  category with no items, 64-code-point names, 0 and 99.999.999 prices. The rail
+  and grid scroll independently. Tile names clamp at two lines with a full
+  accessible name and M-2 heading; prices never clamp. Order-line names wrap
+  in full. Empty categories stay in the rail; a removed selected category
+  falls back to the first. Only an 86 preserves its slot; projection removals,
+  additions and reorder reflow at refresh. Price changes have no tile badge
+  and never change a line snapshot.
@@ -243,2 +256,3 @@ affordances only.
-- *item configuration / quantity commit* — DESIGN-007 gives each of the twelve
-  menu tiles its own `sheet-item-<id>` fixture. `sheet-item` remains Burger's
+- *item configuration / quantity commit* — DESIGN-007 supplies twelve named
+  `sheet-item-<id>` design examples; the application fixture catalog has fourteen
+  tiles (C4), and a served catalog has no fixed item count. `sheet-item` remains Burger's
@@ -250,0 +265,6 @@ affordances only.
+  DESIGN-021 adds one data-driven M-2 for served items: fixed Variant and
+  Modifiers labels, no default choices, required variant when present, flat
+  modifier choices and a zero floor. Every tile opens that sheet before Add.
+  The existing twelve fixture pictures and aliases remain. Add and pending
+  Update use the same line/order monetary ceilings; Plus stops before an
+  increase would exceed them. The quantity editor retains snapshot prices.
@@ -1145 +1165,14 @@ suggestion) · *resolved unit price floors at zero* (FR-C2, AC-26).
-**Requirements.** FR-C2, FR-C3, FR-C4, FR-C5, FR-C6, FR-D4.
+DESIGN-021 served states: *no options*, *variants only*, *modifiers only*,
+*both*, *many options*, *long names and extreme deltas*, *variant required*,
+*zero floor*, *86 then available again*, *no longer on the menu then
+reappearing*, *item name/price/option delta changed*, *selected variant
+removed*, *selected modifier removed*, *new or reordered options*, and
+*line/order ceiling, including a choice at quantity 1*. The sheet stays open;
+choices survive by identity except removed options. Figures update before
+Add. Availability restoration clears its notice; the item-change notice
+persists until close. New options and reorder have no notice. M-2 uses the
+held catalog; it has no independent first-read request in served mode. Its
+loading/read-failure entry is therefore POS-03's menu state, with no sheet
+opener until an item is known. CATALOG_CHANGED remains a Phase 2 fixture.
+
+**Requirements.** FR-C2, FR-C3, FR-C4, FR-C5, FR-C6, FR-D4, FR-M5.
@@ -1154,0 +1188,10 @@ after values (FR-F8).
+DESIGN-021 adds the served picker's *loading*, *first read failed*, *no active
+presets*, *both kinds and zero*, *four-decimal percentage*, *maximum fixed
+amount*, *long name and overflow*, *deactivated while open* and *edited while
+open* states. Other amount stays offered during loading, failure and emptiness.
+Presets keep server order (oldest created first), use decimal commas for
+percentages, and show fixed values as stored; the cap is reflected at
+application in order totals. Poll updates are silent, never suggested or
+preselected; a removed focused entry yields focus to the preset heading.
+These drawings follow C4's recommended real-preset path pending its owner ruling.
+
diff --git a/docs/design/SITEMAP.md b/docs/design/SITEMAP.md
index 22242f5..9349c00 100644
--- a/docs/design/SITEMAP.md
+++ b/docs/design/SITEMAP.md
@@ -134,0 +135,3 @@ Tablet landscape, 1280×800. Touch. Standing cashier. 90-second idle expiry
+│   │       DESIGN-021: served loading / first-read failure / empty /
+│   │       possibly out of date; active empty category; rail/grid overflow.
+│   │       Only 86 holds its slot; absent items reflow. G6 is drawn.
@@ -150,0 +154,3 @@ Tablet landscape, 1280×800. Touch. Standing cashier. 90-second idle expiry
+│   │       DESIGN-021: one data-driven sheet; variant required when present;
+│   │       live prices and options, removed choices, zero floor, full names;
+│   │       no-longer-on-menu notice; Add/Update share money ceilings.
@@ -163,0 +170,2 @@ Tablet landscape, 1280×800. Touch. Standing cashier. 90-second idle expiry
+│   │       DESIGN-021: served loading / failure / empty / long list;
+│   │       zero and precise values; silent live edits and removals.
```

#### Questions, differences and next handoff

- The lead's provisional D1 and D2 questions are answered by C4 above: shared
  monetary ceilings include option choices and the pending editor; the
  transport's request plus health probe can take 20 seconds. No new timer.
- C4 OQ1 remains with the owner: should real presets feed the Phase 1 picker?
  This delivery draws C4's recommended “yes”. The states still serve Phase 2
  if the owner says no; this does not block the requested drawings.
- R1's name collision is an acknowledged limitation with the proposed BO-04
  hint above. That is a future owner/design decision, not an edit to BO-04.
- No other C4 difference remains. This is ready for the other-family design
  review, not a claim that the review or owner approval has happened. S7b
  must bind real projection data/option ids, transport outcomes and transient
  store guards; it must not copy fixture arrays, URL state plumbing, or the
  fixture's selection-only preset callback as an application command.

DONE
