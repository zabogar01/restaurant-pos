---
id: PHASE1-S4c2a
title: BO-04 Item editor in the back office, the item's own fields — create and edit, the version rules, and the way between BO-03 and BO-04 (plan S4c, DESIGN-020)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S4c1]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/item-editor.spec.ts, e2e/support/**]
status: not-started
cycles: 0
---
# PHASE1-S4c2a — BO-04 Item editor: the item's own fields

**Written** 2026-10-27 by the lead, from slice S4 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S4*: "S4c BO-03 … and BO-04 …, which may
itself split by screen"). S4c1 built BO-03 Menu (PR #144). This task builds **BO-04, the item editor, for the item's
own fields** (name, category, base price), with **Edit** and **New item** on BO-03 and the way between the two
screens. **PHASE1-S4c2b** adds the two option lists (variants and modifiers); it is written after this one merges
(ruling 1). The task draws on:
- the server halves **PHASE1-S4a** (the domain, PR #140) and **PHASE1-S4b** (the eleven routes, PR #142);
- the design **DESIGN-020** (BO-04, merged as PR #135);
- **PHASE1-S4c1** (BO-03, PR #144), whose screen model, `Decision` and patterns this one extends;
- the back-office client slices whose patterns S4c1 copied: **PHASE1-S1b** (BO-05), **PHASE1-S2b** (BO-08's
  settings: a versioned form, the stale notice, *Keep my changes* and *Use current*) and **PHASE1-S3b** (BO-08's
  methods).

Where this file, DESIGN-020 and those patterns differ, the rulings below say which wins. Where they still differ, stop
and write `BLOCKED: <question>`.

## Objective

On BO-03 Menu, a signed-in manager presses **Edit** on an item row, or **New item** on an active category, and arrives
at **BO-04**, a screen of its own at `/back-office/menu/item` with *Menu* current in the rail. BO-04 reads the catalog
itself, shows the item's name, category and base price with its status as plain facts, and saves them as one command
through the S4b routes: a create carries no version, an edit carries the version BO-04 read. Every word comes from
DESIGN-020. A stale edit is refused `CATALOG_CHANGED`: the draft is kept, the catalog is reread once, and the manager
chooses *Keep my changes* or *Use current item*. A save that succeeds returns to BO-03 on the same row, announced, with
that row's Edit focused; Cancel returns to the opener. The screen follows the configuration-form rules S1b, S2b, S3b and
S4c1 built: one command in flight; unknown outcomes reread and never resend; drafts held across M-6 and BO-01 for the
same manager. **Variants and modifiers are not edited yet**: every save here leaves them as they are (ruling 1).

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-020's Handoff**, `.agent/tasks/DESIGN-020-item-editor.md` from `## Handoff` to the end, and the lead's
   rulings above it (*Round 2 — the review's seven findings and the Handoff's four questions*). These parts bind this
   task, minus the exclusions of ruling 1:
   - *Lead rulings recorded for this task* (1 is review plumbing this task replaces, ruling 3 below; 3 and 4 bind);
   - *Rules S4a, S4b and S4c can copy*: *Names* (the item-name row), *The price input* (all three columns, ruling 7),
     *What one save carries*, *The version BO-04 builds on*, *Where Save lands*;
   - *Exact copy and accessible names for S4c*: every product word comes from it (ADR-011 rule 24);
   - *Focus*.
3. **`docs/DESIGN.md`**:
   - *Configuration forms — DESIGN-020 additions* (`:1876` to the end): *The money input*, *A create refused because
     its parent was archived*, *Name lengths count code points*, *BO-04 copy and layout*. The two child-list sections
     (`:1916` to `:2007`) are S4c2b's, except the parts of *The stale-draft refusal* that speak of the record's own
     fields, which bind here.
   - The DESIGN-017, DESIGN-018 and DESIGN-019 additions (`:1486`, `:1628`, `:1788`), as S4c1 applied them. All
     headings still say "awaiting review"; all were reviewed and merged.
4. **The Frost artifact**, `docs/design/visual-directions/frost/back-office/item-editor.html` with `item-editor.css`,
   `item-editor.js` and `item-editor-states.js`, the shared `office.css`.
   - Open it with `?state=<name>`; `item-editor-states.js` lists all 62 states.
   - It is a review fixture: its records, `ItemFixture`, response selectors, URL parameters (`item`, `category`,
     `return`, `returnItem`, `state=new`), the URL snapshots and the BO-03 return adapter in `menu.js`, and its
     disclaimers are not product and are not copied (ruling 3 replaces them).
   - Port CSS only through tokens already in `docs/design/tokens/frost.css`; `apps/back-office/test/no-invented-values.test.ts`
     enforces this.
5. **PHASE1-S4c1's Handoff**, `.agent/tasks/PHASE1-S4c1-menu-screen.md` from `## Handoff`, above all *What S4c2 needs*,
   and its *Round 2* and *Round 3* sections. **PHASE1-S4b's Handoff**, `.agent/tasks/PHASE1-S4b-catalog-routes.md`,
   *What S4c needs*: the `items/create` and `items/update` bodies, the views, how each refusal arrives, and how
   *unchanged* is read.
6. **PHASE1-S2b's Handoff**, `.agent/tasks/PHASE1-S2b-settings-screen.md`, *The version rules* and *Round 2*: BO-04's
   draft follows them as BO-08's settings form does.
7. **The existing back office**: `apps/back-office/src/` (`menu/`, `settings/`, `forms/`, `copy.ts`, `Screens.tsx`,
   `Rail.tsx`, `routes.ts`, `router.ts`, `work/guard.ts`, `session/`), and the tests beside them. **The browser
   harness**: `e2e/support/**`, `e2e/tests/menu.spec.ts`.
8. The contract, for meaning only: PRD FR-B4, FR-C1, FR-C7, FR-C8, FR-A2b, FR-M1, AC-31, AC-35; BOUNDARIES B-1, B-8,
   B-20, B-24.

## Decided: do not reopen

- **ADR-012 rules 10, 11, 13 (accepted):** every committed catalog write advances the version by one; a read reports
  the version from the same snapshot; an **edit** carries the version its form was opened at and is refused
  `CATALOG_CHANGED`; a **create** carries none and cannot be refused stale, but a create into a category archived
  meanwhile is refused `CATALOG_CHANGED` (S4a: an archived destination is `STALE`).
- **S4a and S4b (merged):** the routes and their answers as S4b's Handoff states them. `DUPLICATE` is bare. There is
  no single-item read: BO-04 uses the catalog read. `INVALID` arrives as `VALIDATION_FAILED`. Editing an archived item
  is allowed. A save whose every change equals the stored state writes nothing, and its answer carries the version
  still in force.
- **Owner, Q5:** currency IDR at precision 0, fixed for the installation. **Q10:** archived, never deleted. **Q11:**
  nothing here is audited.
- **DESIGN-020, accepted with the lead's rulings:** item names 1–64 code points, trimmed, no control character, unique
  among active items across the whole menu, case-insensitively (an item in an archived category still holds its name);
  the money input of `D` `:1887`; BO-04 builds on its own read (Q4); 86, Make available, archive and restore are
  BO-03's, and BO-04 shows availability and archive status as facts only; the departure, M-6, logout and BO-01 copy is
  DESIGN-019's.
- **Drafts (owner, 2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back. A different manager's sign-in destroys it, and so does a reload.
- **C2 §6 and ADR-011 rule 20:** an unknown outcome rereads and never resends; success is never inferred from a
  reread; there is no "send again" control.
- **Lengths are code points.** Count with `[...value].length`, never `value.length`. Do not write "UTF-16 units" in a
  new comment.
- **Money never passes through a float (B-1).** Prices cross the API as canonical integer strings; decode with
  `decodeMoney`, never `Number`.
- **Client paths name a screen and nothing else** (`routes.ts`: no record id, no draft, no query string; a test scans
  `src/` for query and hash reads). The server answers any extensionless path under `/back-office/` with the entry
  point (`apps/server/src/http/bundles.ts`, `classify`), so `/back-office/menu/item` needs no server change.
- **S4c1's and the earlier slices' patterns**, as merged: reuse `forms/Decision.tsx`, `fieldsInError`,
  `work/guard.ts`, the router's guard, the logout confirmation and the M-6 and BO-01 handling as they are.

## Lead rulings (2026-10-27)

1. **Scope: S4c2 is split by authority, as S1 to S4 were; this task is S4c2a.** BO-04 has 62 drawn states, about as
   many as BO-03, and two option lists whose *Keep my changes* rules (DESIGN-020 round 2) are the most intricate the
   project has drawn. S4c2a builds BO-04 for the item's own fields; **S4c2b** adds the variants and modifiers.
   - **S4c2a builds these 40 states:** `default`, `new`, `loading`, `load-error`, `not-found`, `archived`,
     `eightysix`, `archived-eightysix`, `in-archived-category`, `overflow` (its item name at 64 code points and its
     99.999.999 base price only), `saving`, `saved`, `unchanged`, `duplicate-create`, `duplicate-rename`,
     `duplicate-archived-category`, `failure`, `unknown`, `unknown-changed`, `unknown-read-failed`, `stale`,
     `stale-same`, `stale-read-failed`, `create-category-archived`, `move-category-archived`, `unsaved`,
     `unsaved-logout`, `leave-pending`, `leave-unknown`, `reauth`, `bo01-draft`, `reauth-decision`, `bo01-decision`,
     `invalid-item-empty`, `invalid-item-long`, `invalid-item-control`, `invalid-base-empty`, `invalid-base-format`,
     `invalid-base-bounds`, `invalid-base-negative`. Each is drawn without the Variants and Modifiers sections.
   - **Left to S4c2b (22 states):** `none`, `floor`, `remove-pending`, `remove-undone`, `reorder`, `stale-removed`,
     `stale-duplicate`, the eight `invalid-variant-*` and `invalid-modifier-*` name states, the seven
     `invalid-variant-delta-*` and `invalid-modifier-delta-*` states, and the option half of `overflow`. Also S4c2b's:
     the *Variants* and *Modifiers* sections, their help, notes and empty bodies, Add, Remove, Undo, Move, the
     per-variant *Without modifiers* preview, the over-maximum note, the removal standing note, and the two
     *Current order* lists of the stale comparison.
   - **Every save here leaves the options as they are.** An edit's `changes` has no `variants` or `modifiers` key; a
     create sends `variants: []` and `modifiers: []`. The stale comparison shows *Item name*, *Category*, *Base price*
     and *Status* only. The ordinary context sentence keeps DESIGN-020's words (*Save the item, its variants and its
     modifiers together. …*) although the lists arrive in S4c2b, as S4c1 kept *Use New item* before New item existed.
   - **Not built at all:** the standalone `saved` and `unchanged` drawings with *Return to menu* (DESIGN-020: "for
     review"; a saved or unchanged answer returns to BO-03, ruling 9); 86, Make available, archive and restore in any
     form (S5 and BO-03); the kitchen-emergency sentences; BO-01's held-draft sentence (S10); `leaserejected`.
   Say all of this in the Handoff.
2. **The screen, the route and the rail.** `Screen` gains `'item'` with path `/back-office/menu/item`. The path names
   the item-editor screen and nothing else, so `routes.ts`'s rule holds; its comment needs no change beyond naming the
   new screen if it lists screens. The rail marks **Menu** current (`aria-current="page"`) on BO-04 as on BO-03, and
   lists no new entry. The frame's top bar stays as built (`OfficeApp.tsx` shows *Back office* on every screen; S1b to
   S4c1 kept it), so DESIGN-020's *Item editor* top-bar text is not built; say so in the Handoff. *Item editor* is still
   the heading of the no-subject drawing (ruling 3). The screen's model is made per working-area key in `Screens.tsx`,
   beside BO-03's.
3. **Which item BO-04 edits lives in client state, never in the address (the open point S4c2 rules).** DESIGN-020's
   URL parameters are review plumbing (its lead ruling 1); `routes.ts` forbids record ids and query strings.
   - **The subject** is `{ kind: 'edit', itemId } | { kind: 'new', categoryId }`. It is held inside the keyed working
     area (made in `Screens.tsx` per key, as the models are), so a different manager's sign-in destroys it with the key
     and a reload destroys it (ADR-011 rule 22), exactly as a draft is destroyed.
   - **Only BO-03 sets it:** *Edit* on an item row (`edit`) and *New item* on an active category's header (`new`).
     Each goes through BO-03's `leave` once, so a dirty BO-03 inline editor meets the departure decision first; then the
     subject is set and the router arrives at `item`. The navigation must not ask a second time.
   - **Leaving BO-04 by any way clears it:** a saved return, Cancel, Discard, the rail, browser Back, *Return to menu*,
     *View item on Menu*.
   - **Arriving at `/back-office/menu/item` with no subject** (a reload, a typed address, browser Forward after
     leaving, or the same path after a different manager's sign-in) shows DESIGN-020's *Different manager* drawing:
     heading *Item editor*, *Choose an item on Menu to edit it.*, and *Return to menu*, focused. No read is made and
     nothing else is drawn. *Return to menu* goes to BO-03 by the router (no departure decision: there is no draft).
   - **A subject whose item the read does not hold** shows `not-found` (*Item could not be found* / *Return to Menu
     and choose the item again.* / *Return to menu*). It is unreachable today, because the read returns archived items
     too; say so in the Handoff.
4. **BO-04's read and its version** (DESIGN-020 Q4, *The version BO-04 builds on*). This supersedes S4c1's Handoff
   note that an editor opened from BO-03 carries `state.version`: the opener passes no version.
   - Each arrival with a subject reads `GET /api/back-office/config/catalog` once. *Loading item…* shows meanwhile.
     A failed read shows `load-error`; its *Try again* repeats the read only.
   - The draft builds on that read's version (`base`). The base then moves only by an answer, an unchanged answer,
     *Keep my changes* or *Use current item*; a reread alone never moves it (S2b's version rules).
   - An edit's `expectedVersion` is the base. A create carries none.
   - **A new item** opens with its subject's category selected. Its fields are blank, it has no status but *Not saved
     yet*, and nothing on the screen implies a saved item.
5. **One screen model**, `apps/back-office/src/item/model.ts`, holding the read, the draft and the one command:
   - one `workGuard` registration made as `menu/model.ts` makes its own, one `command` slot, one `decision`, one held
     result, one `leave(next)` that every departure goes through;
   - version rules copied from `settings/model.ts`, as S4c1's `menu/model.ts` copied them;
   - S2b's round 2 F2 and S4c1's round 3 F1: after each asynchronous reread (unknown, `DUPLICATE`, stale, a retry),
     recheck the session gate and the open decision before presenting; if presentation is not permitted, hold the
     finished result with its read and present it once, with its focus, when the same manager returns, never
     repeating the command or the reread.
   Pure helpers live in their own files under `item/`: the name check, the price input (ruling 7), the status and
   context facts, the category options, the change list, and `item/copy.ts`. A shared helper with `menu/` is fine only
   if every existing `menu-*.test.*` passes unedited.
6. **The item name.** Trim, then DESIGN-020's order: empty, then more than 64 code points, then a control character
   (`\p{Cc}`), each with its copy (*Enter an item name.* / *Use 64 characters or fewer.* / *Remove control characters
   from the item name.*) on `#item-name-error`, with the field `aria-invalid`. The trimmed name is sent. A pair test
   over the boundary values shows the check and S4b's `ItemName` agree. Uniqueness is the server's. BO-03's 80-unit
   stress name is not a valid name (DESIGN-020 Handoff, *Budget reasoning*).
7. **The price input, built whole now** (`D` `:1887`, DESIGN-020 *The price input*), in `item/price.ts`, for all three
   field kinds: base price, variant price change and modifier price change. S4c2a wires only *Base price*; S4c2b wires
   the two changes and must not need to edit this file.
   - Trim; then refuse in `D`'s order (empty; a leading `-` where no negative is allowed; not such a number; out of
     bounds), each with its copy from DESIGN-020's table. Accepted: ASCII digits (leading zeros allowed), or `.` groups
     of three; a variant change may carry one ASCII `+` or `-` directly before the digits.
   - Convert on strings to the canonical integer string: remove every `.`, drop a `+`, drop leading zeros keeping one
     `0`, write `-0` as `0`. Check the bound on that string as an integer (BigInt, or by length and then digits).
   - **Never** `Number`, `parseFloat`, `parseInt`, `Math.round`, `Math.floor` or `toFixed` in `src/item/`. A source
     test scans for them, as `menu-money.test.ts` does for `menu/`.
   - **Display.** A stored or accepted value is shown grouped with `.` (reuse `menu/money.ts`'s formatter; a negative
     shows `-` directly before the digits, never `+`). A refused value stays exactly as typed. While the manager types,
     the field keeps their text as typed (never regroup under the caret); an accepted value is regrouped when the field
     loses focus, and every value is shown grouped when the form opens or is replaced (*Use current item*).
   - **A pair test** with `BasePrice`, `VariantPriceChange` and `ModifierPriceChange` from `@pos/contracts`: every
     input the check accepts canonicalises to a string the schema accepts, and the bound values agree (`99.999.999`
     accepted, `100.000.000` refused; for a variant change also `-99.999.999` accepted and `-100.000.000` refused).
   - The 21 money cases of DESIGN-020's *Refused under rule 3* paragraph and the accepted examples (`00010`, `10.000`,
     `-10.000`, `+5000`, `-0`) are each a unit case.
8. **The category field.** A select labelled *Category*, help *Choose an active category. An existing item may stay in
   its archived category.*, first option *Choose a category*. It lists, in BO-03's category order, every active
   category, plus the draft's and the stored item's category when archived, an archived one reading `{name} ·
   Archived`; an archived category other than the stored item's is disabled (`item-editor.js:105`). The local check
   (`item-editor.js:73`): none chosen is *Choose a category.*; an archived category is *This category is archived.
   Choose another category.*, except the stored item's own category on an edit, where the item may stay. Errors go on
   `#item-category-error`.
9. **Save, and the way back to BO-03.**
   - **Save** checks every field first; the first invalid field in reading order (name, category, base price) takes
     focus and nothing is sent.
   - **Create** sends `{ categoryId, name, basePrice, variants: [], modifiers: [] }`. **Edit** sends `{ itemId,
     expectedVersion, changes }`, with `changes.fields` holding only the changed ones of `name`, `basePrice` and
     `categoryId`, and no `fields` key when none changed: a clean Save still sends, as `changes: {}` (DESIGN-018: an
     edit equal to the stored item is still sent; its answer is *unchanged*).
   - **Saving:** the focusable notice *Saving…* / *Wait for the result. Your draft is kept.*; fields inert; Cancel, the
     rail and Log out stay live through the departure decision.
   - **An `ok` answer** returns to BO-03 through the router and the subject is cleared. Add `receiveItem(item, version)`
     to `menu/model.ts`, as S4c1's Handoff describes: it applies `{ version, categories: [], items: [item] }` through
     the private `apply` (the applied-record map, the partial state and the one-step version rule all hold), then sets
     the page result *{name} saved.*, or *Nothing changed. Menu version {n} is still current.* when an edit's answered
     version equals its `expectedVersion`, and focuses that row's Edit. A create is never *unchanged*.
   - **BO-03's visit read** on that return still happens (S4c1 ruling 4), and the applied-record map keeps the answered
     item from being undone by a read that began before it.
   - **Cancel** with a clean draft, and **Discard** from the decision Cancel opened, return to BO-03 with focus on the
     opener: the item's Edit, or for a new item that category's *New item* (*New category* if it no longer exists).
     Departure by the rail or browser Back lands with the frame's existing navigation focus, unchanged.
   - **The focus target `itemAction`** moves to `[data-edit="id"]`, in `Menu.tsx`'s resolver and in `resultOf` in
     `model.ts` (S4c1's Handoff, *Focus*). BO-03's item state-command successes then focus Edit, as DESIGN-019 says.
10. **A save still outstanding when BO-04 is left** (`leave-pending`; `D` `:1518`, *Command results*). Discard drops
    the draft only; the command is not cancelled and never resent. BO-03 is one catalog surface with BO-04: while that
    save is outstanding, BO-03's page status reads *Waiting for an earlier save to finish. Nothing will be sent
    again.* and every BO-03 opener and state command is inert. When the answer settles, the status clears silently; an
    `ok` answer is applied to BO-03's list with no page result and no focus move; any other answer presents nothing
    (the draft was discarded) and BO-03 rereads once if the answer was unknown. `leave-unknown` (leaving after an
    unknown outcome) uses DESIGN-019 round 3's body, as S4c1 built it.
11. **`CATALOG_CHANGED` on an edit** (`D` DESIGN-018 stale refusal, DESIGN-020 *Stale* rows). Write nothing, keep the
    draft, reread once, and show *Current item* beside the draft: Item name, Category, Base price and Status, each
    value that differs from the draft marked *Differs from your draft*. The notice is DESIGN-020's *Stale* row with the
    new version, plus *The current item has the same values as your draft.* when they match (`stale-same`), focused.
    *Save* stays held, with *Choose which version to keep before saving.*, until *Keep my changes* (base moves to the
    reread version, the draft stays whole, focus Save or the first field the rerun checks refuse, the *After Keep*
    notice) or *Use current item* (the form shows the reread item, clean, focus Item name, the *After Use* notice).
    Neither choice sends anything. A failed reread withholds the comparison and offers a read-only *Try again*
    (`stale-read-failed`).
    - **An edit that moved the item to a category archived meanwhile** (`move-category-archived`) is this refusal,
      with *The destination category was archived. Choose another category after deciding which version to keep.*
      appended, and the category refused after either choice until an active one is chosen.
12. **A create refused `CATALOG_CHANGED`** can only mean its category was archived meanwhile
    (`create-category-archived`): nothing was written, the draft is kept, the catalog is reread once, the notice is
    *The category was archived* / *Nothing was saved. Your draft is kept. Choose another category before saving.*, the
    category field shows the archived category (`{name} · Archived`) with its refusal, Save is held with *Choose an
    active category before saving.* until an active category is chosen, and focus goes to Category. The next create
    still carries no version.
13. **Unknown outcomes** (`failed` or `unavailable`): one reread, never a resend. Same version: *Outcome not
    confirmed* / *The menu has been refreshed. …*, focus Item name. Reread failed: the *could not be refreshed* notice
    with a read-only *Try again*. A newer version: the stale comparison and choices with the *may include this save*
    notice, focused (`unknown-changed`).
14. **`DUPLICATE`** (409, bare). With no option change sent, it always means the item name: the draft stays, *An active
    item already uses this name. Choose another name.* goes on Item name with focus, and the catalog is reread once.
    Once the reread shows which active item holds the name (compare trimmed names with BO-03's collator at
    `sensitivity: 'base'`, as S4c1 does; no holder line if none matches), the line *Name held by {name} in
    {category}.* (or *…in {category}, an archived category.*, with the error *An active item in an archived category
    still uses this name. Choose another name.*) and the link *View item on Menu* appear. *View item on Menu* leaves
    through the departure decision (the draft is dirty) and, on Discard, lands on BO-03 with the holder's Edit focused
    and the row `data-selected`, as BO-03's return marks a row; it is client state, never the address.
15. **`NOT_FOUND`** (404) and **`VALIDATION_FAILED`** (400) on a save can only mean the item vanished or the client sent
    a malformed change, which this client does not do. Treat each as the definite failure (*Something went wrong* /
    *Nothing was saved. …*), with one reread. Say in the Handoff that both are unreachable today. No new copy.
16. **A session refusal** of a save: after the same manager resumes, *Nothing was saved* / *Your draft is kept. Press
    Save to try again.*, with focus on the draft control (S4c1's Handoff, *What was decided*, the session-refusal aim).
17. **The status and context facts** (DESIGN-020 round 2, F5). `#item-status`: `[Archived item · ]Available` or
    `[Archived item · ]86 · Unavailable`, then ` · Hidden from the POS · category archived` when the stored item's
    category is archived; a new item reads *Not saved yet*. The context paragraph is the first that applies of: the
    archived-category sentence (active item in an archived category), the archived-item sentence, the 86'd sentence,
    the ordinary sentence; a new item has the ordinary one. `#version-facts`: *Menu version {n} · Availability and
    archive status are managed on Menu.* for an edit, empty while the read is loading or failed; *Not saved yet.
    Nothing is created until you save.* for a new item. The money facts (*Currency: IDR · Indonesian rupiah*, *Decimal
    places: 0 · amounts are whole rupiah*, *Fixed for this installation. Prices include tax.*) are plain text above the
    fields, withheld while loading or failed.
18. **The working-area rules, unchanged** (S4c1 ruling 14). Under M-6, BO-04 stays visible and inert. At BO-01 it is
    hidden with the draft held; the same manager gets it back with the field last edited focused (or the restored
    decision's Stay); a different manager's sign-in destroys the model and the subject, and BO-04 then shows ruling
    3's no-subject drawing. The departure decision comes from Cancel, Escape, browser Back, the rail and Log out
    (`unsaved-logout` uses the existing logout confirmation); Stay keeps the draft, and Escape means Stay. It uses the
    shared `forms/Decision.tsx` with DESIGN-019's bodies.
19. **BO-03's two new controls** (S4c1's Handoff, *Where Edit and New item attach*). *Edit* goes in front of
    Archive/Restore in each item row's `office-actions`, visible text *Edit*, accessible name *Edit {name}*
    (DESIGN-019 Handoff copy table, row *Item*, `:444`), with `data-edit="{itemId}"`. It is live on active and
    archived items alike. *New item* goes after *Reorder items* in an active category's header, visible text *New
    item*, accessible name *New item in {name}* (row *Active category*, `:438`), with `data-new-item="{categoryId}"`,
    and is absent on an archived category. Each is a button, as BO-03's other openers are, never a link with an
    `href` naming a record. Both are inert, as BO-03's
    other openers are, while the first read is loading or any command (BO-03's or BO-04's, ruling 10) is pending.
20. **Copy** goes in `apps/back-office/src/item/copy.ts`. Each string must trace to a row of DESIGN-020's copy table, or
    to the shared copy where DESIGN-020 says DESIGN-019's words are reused. No zod message, server text, error code or
    submitted value ever becomes visible text, except the manager's own values in the fields and the names, categories
    and prices the read returns.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

1. **Route and rail.** `/back-office/menu/item` is in the manifest as `item`, and the rail marks *Menu* current on it,
   with no new entry. *Red:* mark no rail entry current on `item`: the rail test fails.
2. **The subject never reaches the address.** Opening BO-04 from Edit and from New item leaves the address at
   `/back-office/menu/item` with no query or hash; `routes.test.ts`'s source scan still passes. Arriving with no subject
   shows the no-subject drawing with *Return to menu* focused, and makes no read. *Red:* make the no-subject arrival
   read the catalog: the read-count assertion fails.
3. **The read and its version.** Opening an item reads once and shows its name, category and grouped base price; the
   first Save carries that read's version, not BO-03's standing version (make them differ in the fixture). A reread
   after an unknown outcome does not move the base. `load-error`'s *Try again* reads once and sends nothing. *Red:*
   carry BO-03's `state.version`: the version assertion fails.
4. **The item name.** The pair test of ruling 6. The refusals come in order with their copy and focus; nothing is sent
   while the name is invalid; the body carries the trimmed name; a 64-emoji name is accepted locally and 65 is
   refused. *Red:* count with `name.length`: the 64-emoji case fails.
5. **The price input.** The unit cases and the pair test of ruling 7, for all three kinds; the source test passes; a
   refused `1000.5` stays as typed; `10000` typed is sent as `"10000"` and shown `10.000` after blur. *Red:* parse
   with `Number(text.replaceAll('.', ''))`: the source test fails (and say whether any value case also fails).
6. **The category field.** Its options, order and disabled rule of ruling 8; the stored archived category stays
   allowed on an edit; another archived category is refused locally with its copy. *Red:* drop the "stored item's own
   category" exception: the in-archived-category edit is refused and that test fails.
7. **Create.** New item in a category opens BO-04 with that category selected and blank fields; Save sends exactly one
   create with ruling 9's body (empty option arrays, no version); the answer returns to BO-03 with the item in its
   category, *{name} saved.*, and its Edit focused. *Red:* send `expectedVersion` on a create: the strict request
   schema or the body assertion fails (report which).
8. **Edit.** An edit sends one update whose `changes.fields` holds only the changed fields; a clean Save sends
   `changes: {}`; the answer returns to BO-03 with the row updated and Edit focused; an answer whose version equals
   `expectedVersion` shows *Nothing changed. Menu version {n} is still current.* *Red:* send every field: the
   changed-only assertion fails.
9. **`receiveItem`.** An answer one version ahead of BO-03's standing version advances it; one that skips leaves it
   (S4c1's rule); an older visit read that lands after the answer does not undo the item. *Red:* adopt the answered
   version always: the skip case fails.
10. **Cancel and Discard.** A clean Cancel returns with focus on the item's Edit, or on that category's New item for a
    new item, or on New category when that category is gone. A dirty Cancel opens the decision; Stay keeps the draft;
    Discard returns as a clean Cancel does. *Red:* return focus to the heading: the focus test fails.
11. **`CATALOG_CHANGED`** (ruling 11) on an edit: one update request, one reread, the comparison with its markers, the
    notice focused, Save held with its reason; *Keep my changes* moves the base and the next Save carries the reread
    version; *Use current item* replaces the form and focuses Item name; neither sends anything; a failed reread has no
    comparison and a read-only *Try again*; `stale-same` adds its sentence; `move-category-archived` appends its
    sentence and refuses the category after either choice. *Red:* enable Save before a choice: that test fails.
12. **A create into an archived category** (ruling 12): the notice, the refused category showing `· Archived`, Save
    held with its reason, focus on Category, and the next create carries no version. *Red:* treat it as the edit stale
    refusal: the comparison appears and the test fails.
13. **Unknown outcomes** (ruling 13): one reread and never a resend, for each of the three copies. *Red:* resend once
    after `failed`: the command count is 2.
14. **`DUPLICATE`** (ruling 14): the error on Item name with focus, one reread, the holder line in both variants, no
    holder line when none matches, and *View item on Menu* through the decision to BO-03 with the holder's Edit
    focused. *Red:* skip the reread: the holder line never appears.
15. **One command across BO-03 and BO-04** (ruling 10). With a save outstanding, Discard lands on BO-03 with the
    waiting status and every opener inert; the `ok` answer then lands in the list silently and the status clears.
    *Red:* leave BO-03's openers live while BO-04's save is outstanding: that test fails.
16. **Departure, M-6 and BO-01** (ruling 18): the decision from Cancel, Escape, Back, the rail and Log out; under M-6
    BO-04 is inert; a held answer is presented once on return; a different manager's sign-in leaves the no-subject
    drawing. *Red:* present a held answer while M-6 is up: that test fails.
17. **Status and facts** (ruling 17): the exact status text in `archived`, `eightysix`, `archived-eightysix` and
    `in-archived-category`, the context precedence, and the money facts withheld while loading. *Red:* drop the
    category-archived suffix: that test fails.
18. **BO-03's controls** (ruling 19): Edit in front of Archive/Restore on every item, New item only on active
    categories, both inert while a command is pending; BO-03's item archive success now focuses Edit. Every existing
    `menu*.test.*` passes, edited only where it asserted the `itemAction` target or the row's controls (list each).
    *Red:* show New item on an archived category: that test fails.
19. **In the browser** (`e2e/tests/item-editor.spec.ts`, both engines, the harness's rules).
    - **(a)** A category made through `createCategory`. The manager opens Menu, presses that category's New item, types
      a run-unique name and `12.500`, saves, and is back on Menu with *{name} saved.* and the row showing `12.500`.
      The database agrees through `readCatalog` (`basePrice` `12500`, no variants, no modifiers).
    - **(b)** The manager presses that item's Edit, changes the name and the price, and saves; the database agrees, and
      exactly one update request was sent.
    - **(c)** The manager opens Edit, then an `editItem` made through the domain advances the version. The manager
      changes the price and presses Save: the stale notice shows, exactly one update was sent, and the database price
      is the domain's. *Keep my changes* then Save saves the manager's price.
    - **(d)** A reload on `/back-office/menu/item` shows *Choose an item on Menu to edit it.* and *Return to menu*,
      which returns to Menu.
    Assert changes, not absolute counts. Nothing is deleted.
20. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**; an edit to an existing helper's behaviour is a
  change to every spec: stop and ask. No change to `packages/`, `apps/server`, `db/` or `docs/`. If a route or schema
  is wrong for the screen, that is a question, not a fix.
- Red first, per criterion: write the test, run it against the unchanged code and record the failing assertion; then
  write the code. If you write a test after its code, say which tests and still apply and report each mutation. A
  criterion is accepted only with an observed red.
- Every visible word comes from DESIGN-020's copy table or the shared copy, and every style value from the Frost
  registry. Use `aria-disabled` and `tabIndex={-1}` on inert controls, as BO-03, BO-05 and BO-08 do, never `disabled`
  (S4c1's Handoff: Playwright's `toBeDisabled()` reads `aria-disabled`). Every model method also guards, so a press on
  an inert control sends nothing.
- Browser-test rules (ADR-011 rules 27 and 28; the 012a and 012b Handoffs):
  - people through the harness's domain functions with random credentials (never `makePeople` from the server tests);
  - requests made by the page;
  - assertions on state, accessible names and codes;
  - no screenshots or artefacts committed;
  - sign-ins through the existing helpers, so the credential ledger counts them;
  - the credential scan runs as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config. One command per shell call; no heredoc edits: use
  the file tools.

## Tests expected to change

- `apps/back-office/test/routes.test.ts`: the manifest gains `item` at `/back-office/menu/item`.
- `menu*.test.tsx`: only where they assert the `itemAction` focus target (it becomes Edit) or the exact controls of an
  item row or a category header (they gain Edit and New item). The two the lead found are `menu.test.tsx:417`
  (focus on *Restore item Burger* after an archive) and `:424` (*Archive item Apple* after a restore); each becomes
  the item's *Edit {name}*. List every changed assertion in the Handoff; none is weakened.
- Any test that asserts which rail entry is current, only if it enumerates screens.
- New tests under `apps/back-office/test/` (for example `item*.test.tsx`, `item-name.test.ts`, `item-price.test.ts`),
  and the new spec `e2e/tests/item-editor.spec.ts`.
- **Nothing else should change.** BO-05's and BO-08's tests, `e2e/tests/menu.spec.ts`, `tables.spec.ts`,
  `settings.spec.ts` and `payment-methods.spec.ts` pass unedited. A change anywhere else is reported in the Handoff
  with its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `826a401` (S4c1 #144 and the lead's #145 and #146 merged; the code is S4c1's final tree, `05a6e54`).
The lead's runs of that tree: `npm run verify` 133 files, 4752 tests; `npm run test:e2e:all` 86 passed. Confirm the
baseline before you start, and state the new counts in the Handoff. Run `npm run test:e2e:all` yourself before you
finish.

## Out of scope

- Any server, contract, transport-core or migration change. The variants and modifiers (S4c2b, ruling 1). 86 and Make
  available (S5). The items ruling 1 lists as not built.
- The code-point cleanup of the older comments and `tables/label.ts` (queued).
- Polling, an idempotency key, a single-item read, and a server-side field list for `VALIDATION_FAILED`.

## Commit and report

Commit on `agent/phase1-s4c2a` only, after verify is green, and never push. Use Conventional Commits, explaining why;
more than one commit is fine if it reads better. Write the Handoff below in full prose:
- what was done (paths, commits);
- **what S4c2b needs**: where the Variants and Modifiers sections attach in the form and in the stale comparison, how
  the change list and the model's draft would carry option rows, which price-input functions the two change fields
  call, how *Keep my changes* and *Use current item* would hand child rows to DESIGN-020 round 2's rules, and the
  accessible names the browser spec drives;
- what was decided and on what evidence;
- tests changed and why;
- each red proof (mutation, failure read, reverted), and which tests were written after their code;
- what was left out on purpose (ruling 1);
- what was found and not fixed;
- the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff

*(The builder writes this section.)*
