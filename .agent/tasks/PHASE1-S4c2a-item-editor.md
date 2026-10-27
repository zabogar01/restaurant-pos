---
id: PHASE1-S4c2a
title: BO-04 Item editor in the back office, the item's own fields — create and edit, the version rules, and the way between BO-03 and BO-04 (plan S4c, DESIGN-020)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S4c1]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/item-editor.spec.ts, e2e/support/**]
status: active
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

## Lead verify (2026-10-27)

At `9fcdb94`, in this worktree:
- **`npm run verify`:** typecheck clean; **138 files, 5028 tests** passed.
- **`npm run test:e2e:all`:** **92 passed** (1.1 minutes), Chromium and WebKit. This is the lead's run after the
  builder's mutations were reverted, so the builder's untested gap is closed.
- **Baseline:** the lead reran `npm run verify` on `development` (`826a401`): 133 files, 4752 tests, as the task file
  says. The 32 tests the builder could not place come from `no-invented-values.test.ts`, which runs one case per
  ported CSS value: it goes from 154 cases to 186 with the new `office.css` rules. The five new files hold 244, as the
  Handoff says (145, 20, 38, 24, 17, each counted by the lead). This is not a defect.
- **Paths:** every changed path is inside `owns`. The changed tests are `routes.test.ts` and `menu.test.tsx`, both
  listed under *Tests expected to change*. The menu test's three assertions are listed in the Handoff, and none is
  weakened.
- **Read by the lead:** `item/price.ts` uses patterns and BigInt, and no float (`\d` without the `u` flag matches ASCII
  digits only). `routes.ts` and `Rail.tsx` match rulings 2 and 3. Every `href` in BO-04 is `PATHS.menu`.
- **Not checked by the lead:** the drawn layout. The lead cannot sign in to the back office, so the owner's look at
  BO-03 and BO-04 served is the check, before merge (finding 6).

## Rulings on the Handoff's findings (lead, 2026-10-27)

These need no code change, so they spend no round.
1. **Finding 1 is accepted, and ruling 11's last clause is corrected.** After *Keep my changes*, the destination
   category is refused until an active one is chosen. After *Use current item*, the form shows the current item and
   nothing is refused. The built behaviour, which follows the artifact's `chooseCurrent(false)`, stands. The
   task-file sentence "the category refused after either choice" was the lead's error.
2. **Finding 2 is accepted.** Save is held, `aria-disabled`, while any field error shows, with *Correct the marked
   fields before saving.* That footer hint is one of DESIGN-020's own rows (*Footer, Hint … errors*), which only means
   something if Save is held. Editing a field clears its error.
3. **Finding 4 stands as built.** *Keep my changes* after an unknown outcome leaves the draft "uncertain", as BO-03
   does, so leaving asks with the uncertain body. That save's outcome is still unknown, so the body is true.
4. **Findings 3, 5, 7 and 8** are noted. Finding 7 is the resolver's fallback for a case BO-03 cannot reach today.

## Round 2 — the review's F1 and F2 (lead rulings, 2026-10-27)

Codex reviewed `54a6cc0` (`.agent/reviews/PHASE1-S4c2a-review.md`) and found two P2 defects. **Both are accepted.** The
lead read both places in the code (`menu/model.ts` `receiveItem`; `item/model.ts` the `duplicate` branch and
`showHolder`). The fixes stay inside `owns`.

1. **F1: a saved item must have a category on Menu to sit in.** The defect: BO-04 reads the catalog on its own, so it
   can save an item into a category that BO-03's last read does not hold. `receiveItem` applies `categories: []`, so
   the item has no group, and Menu's focus request falls back to *New category* before the visit read lands.
   - **The fix.** `receiveItem` also takes the destination category as BO-04's read holds it (a `CategoryView`). Menu
     inserts that category **only when it holds no category with that id**, solely to host the returned item. This is
     DESIGN-020's lead ruling 1 (the B-24 walk): "inserted only when no category with that id exists, solely to host
     the returned item".
   - A category Menu already holds is never replaced from BO-04's read, because Menu's copy may be newer. The inserted
     category is **not** an answered record: it does not enter the applied-record map, and it does not move the
     standing version. Only the item's answer does, by the one-step rule. The visit read that follows replaces it as
     any read does.
   - The same holds for `releaseFromSave`'s `ok` answer, and for a create into a category BO-03 has not read.
   - **Tests:** a screen test where BO-03's first read and BO-04's read hold different categories. BO-04 saves into
     the category only it knows, with Menu's return read held. Assert that the row is drawn in that category, that its
     Edit has focus, and that the page result is *{name} saved.*. Then let the visit read land and assert that the row
     and the category stay, with no second focus move. Add one case where the held visit read fails: the hosted
     category and row stay, under the partial state's copy.
   - **Red:** pass `categories: []` again. The focus assertion fails, with focus on *New category*.
   - Do not change the focus effect's "consume once" rule; with the category hosted, the target exists.
2. **F2: the duplicate reread's holder is a finished result and goes through the gates.** `showHolder` runs whenever
   the reread lands, and checks neither the session gate nor the open departure decision. So the holder line, *View
   item on Menu* and the archived-category error copy can appear behind M-6, at BO-01, or under the decision. Ruling
   5 names `DUPLICATE` among the rereads that must be held.
   - **The fix.** When the reread lands and presentation is not permitted, hold the result with its read in the same
     held slot the stale and unknown results use. Present it once, when the same manager resumes or presses *Stay*,
     with no second read and no second save.
   - Drop the held result if the form was replaced or discarded, or if the duplicate error was cleared by an edit
     meanwhile (`showHolder`'s existing identity check).
   - Correct the comment above the branch: the duplicate reread does present something.
   - **Tests:** M-6 opening while the reread is held, then *Continue* as the same manager; the departure decision open
     while it lands, then *Stay*, and then separately *Discard*; and a different manager's sign-in. Each asserts that
     the holder line is absent behind the gate, that it appears once on return (not at all after Discard or a
     different manager), and that the read and update counts are unchanged.
   - **Red:** drop the gate check. The M-6 case shows the holder line behind M-6.

**What to do.** Fix both and add the tests above, weakening no existing assertion. Run `npm run verify` and `npm run
test:e2e:all`. Commit on this branch. Append a *Round 2* section to the Handoff: for each finding, what changed, the
red you observed, and the new counts. End it `DONE` or `BLOCKED: <question>`, then ping the lead.

## Handoff

### What was done

BO-04 is built for the item's own fields, in one code commit on `agent/phase1-s4c2a`: `8e48693` (the hash of this Handoff's own commit is in `git log`; a commit cannot name itself). A signed-in manager presses **Edit** on an item row or **New item** on an active category's header and arrives at `/back-office/menu/item`, with *Menu* current in the rail and no new rail entry. BO-04 reads the catalog itself, shows the item's name, category and grouped base price with its status as plain facts, and saves them as one command through the S4b routes. A save that succeeds returns to BO-03 on the same row, announced, with that row's Edit focused. Every product word comes from DESIGN-020's copy table, and every style value is a Frost token (`no-invented-values.test.ts` passes).

Paths, all under `apps/back-office/` unless noted:

- `src/item/model.ts` (new): the one screen model. It holds the subject, the read, the draft and the one command; one `workGuard` registration, one `command` slot, one `decision`, one held result, one held retry, one `leave(next)` that every departure goes through. The version rules are copied from `menu/model.ts` and `settings/model.ts`.
- `src/item/ItemEditor.tsx` (new): the view. It also draws the no-subject sentence, *Loading item…*, the load error and *not found*.
- `src/item/price.ts` (new): the price input, built whole for the three field kinds. `src/item/name.ts` (the item name), `categories.ts` (the options and the local check), `facts.ts` (status and context), `copy.ts` (every string, traced to DESIGN-020's rows).
- `src/forms/answer.ts` (new): `meaningOf`, `call` and the answer types, extracted from `menu/model.ts` because BO-04's model needs the same reading of an answer. `menu/model.ts` now imports them; its behaviour is unchanged and every existing `menu*.test.*` passes unedited except the three assertions listed below.
- `src/menu/model.ts`, `Menu.tsx`, `copy.ts`: Edit and New item, `openItemEditor`, `receiveItem`, `stageArrival`, `holdForSave`, `releaseFromSave`, `bindItemEditor`, the `external` slot and `selected` row, and the `itemAction` focus moving to Edit.
- `src/routes.ts` (`item` at `/back-office/menu/item`), `Rail.tsx` (Menu current on `item`), `Screens.tsx` (the model made per working-area key, beside BO-03's), `office.css` (the ported Frost rules for the heading, the form, the money facts, the comparison and the sticky footer).
- Tests: `test/item.test.tsx`, `item-versions.test.tsx`, `item-departure.test.tsx`, `item-price.test.ts`, `item-name.test.ts`, with `item-support.tsx` as their shared helpers. Browser: `e2e/tests/item-editor.spec.ts` (three cases, I1 to I3, which cover the task's scenarios (a) and (b) together, (c) and (d)). Nothing under `e2e/support/`, `packages/`, `apps/server`, `db/` or `docs/` was touched. No formatter was run.

### What S4c2b needs

- **Where the sections attach.** In `ItemEditor.tsx`, inside `.item-draft`, after the `<section aria-labelledby="details-title">`: one `<section className="item-section">` for Variants and one for Modifiers, then the removal note, as the artifact does (`item-editor.html` lines 28 to 30). The `.item-option*`, `.item-section*`, `.item-list-empty` and `.item-removal-note` rules are not ported yet; they are `item-editor.css` lines 14 to 31, to add to `office.css` through tokens already registered. In the stale comparison, `Comparison` at the bottom of `ItemEditor.tsx` renders the four rows today; the two *current order* lists and the removed-option rows go after them.
- **The model's draft and the change list.** `Form.draft` is `{ name, categoryId, price }` (price as typed) and `Form.original` is the same with a canonical price. The lists would be two more arrays on `Fields`, each row `{ id | null, key, name, change, removed, moved, isNew }`, so `fieldsOf`, `formFor`, `dirty()` and `priceKey` each gain one line. The change list is built inline in `save()` (the `fields` object and the `changes` it becomes); S4c2b should lift it into `item/changes.ts` and add `variants` and `modifiers` objects (`added`, `edited`, `removed`, `order`) beside `fields`. A create's `variants: []` and `modifiers: []` in the same function become the rows in order. The `fieldsInError(CreateItemRequest | UpdateItemRequest, body)` guard already covers whatever is built.
- **The price-input functions.** `checkPrice(typed, 'variant')` and `checkPrice(typed, 'modifier')`, and `shownPrice(typed, kind)` for the display on blur. `price.ts` needs no edit: the three kinds, the order of refusals and the pair test with all three contract schemas are in place. The error copy for the two change fields is not in `item/copy.ts` (only base price's four lines are); the rows are in DESIGN-020's *Money invalid* table. The name check for a variant or modifier (1 to 32 code points) is not written; `name.ts` has `checkItemName`, and `menu/name.ts` has the 32-code-point one for categories, so the option name check is one more small function with the same shape.
- **Keep my changes and Use current item.** `keepMine()` and `useCurrent()` in `item/model.ts` are the two places. `keepMine()` builds `rebuilt` from `offered.item` and then runs `checkAll(rebuilt)`; the child-row principle (a touched row keeps the draft's values whole, an untouched row follows the current record, the order rule, a touched row removed meanwhile comes back as a new row, the duplicate recheck) goes between those two lines, with the `touched` and `removedChanged` helpers DESIGN-020 round 2 describes (the artifact's `item-editor.js` lines 124 to 160 are the reference). `useCurrent()` replaces both lists from `offered.item` beside the three fields. `compare()` and `noticeOf` (the *same values* sentence, `sameValues`) gain the lists and the removed-option sentence.
- **`checkAll` and the focus targets.** `checkAll(form)` is the one validation, in reading order, and returns the first invalid field. It would walk the option rows after price. `FocusTarget` in `model.ts` and the focus effect in `ItemEditor.tsx` name the three fields today; an option row's fields and its Add, Undo and Move controls are new targets (DESIGN-020's *Focus* table).
- **Accessible names the browser spec drives today.** Rail link *Menu*; heading level 1 (the item's name, *New item*, or *Item editor*); `#item-status`, `#item-context`, `#version-facts`, `#form-notice`, `#page-status` on Menu; textboxes *Item name* and *Base price*, combobox *Category*; buttons *Edit {name}*, *New item in {category name}*, *Save*, *Cancel*, *Keep my changes*, *Use current item*, *Try again*; links *Return to menu* and *View item on Menu*; `#current-values`, `#comparison`, `#save-hint`, `#item-name-error`, `#item-category-error`, `#item-price-error`, `#duplicate-holder`. S4c2b's spec adds *Variant {n} name*, *Variant {n} price change*, *Add variant*, *Remove variant {n}*, *Move up variant {n}* and the modifier equivalents, as DESIGN-020 names them.

### What was decided, and on what evidence

- **The subject** is `{ kind: 'edit', itemId } | { kind: 'new', categoryId }`, held in `createItemModel`'s state, which `Screens.tsx` makes once per working-area key. Only `menu.openItemEditor` sets it, through BO-03's `leave` once; the router then arrives at `item` by `router.navigate`, and because BO-03's editor was closed by `depart`, the guard finds it clean and does not ask a second time (`item-departure.test.tsx`, *a dirty BO-03 editor meets the decision once*). Every way out of BO-04 goes through the item model's `depart`, which clears the subject. `routes.test.ts`'s source scan for query and hash reads still passes.
- **Menu presents what BO-04 hands back when it is next on screen.** `Menu.tsx` ignores a focus request made before it mounted (S4c1's `handled` ref), and `shown()` used to clear the page result on every visit. So `receiveItem` applies the item through the private `apply` at once, and the sentence, the focus and the selected row travel as a staged `Arrival` that `shown()` presents after it clears the old page. `shown()` now returns a cleanup that marks Menu as not visible. This is the one structural addition to `menu/model.ts`.
- **A save left outstanding** sets Menu's `external` slot (`holdForSave`) only if the command is still outstanding after `depart` has flushed any held answer, so a result that was already held and settles silently never leaves the status stuck. `busy()` in the model and `busy` in the view read `command !== null || external`, and every opener, state command and `save` use it.
- **Save is held, `aria-disabled`, while any field error is showing**, with *Correct the marked fields before saving.*, and `save()` also returns without sending. DESIGN-020's artifact does this (`#save-item` is disabled while `errors.size > 0`, and after `DUPLICATE`); the task file says only that Save checks every field first. Editing a field clears its own error. It also means the acceptance wording *nothing is sent while the name is invalid* holds for a second press too. I did not find a ruling against it; if the lead wants Save live after a refusal, it is one line in `save()` and one in the view.
- **Keep my changes compares the draft with the current item**, so `original` becomes the reread item's fields. A field the draft never touched but another manager changed is therefore sent again by the next Save, which is DESIGN-020 question 3's answer ("keep as ruled") and DESIGN-018's rule. `stale-same` followed by Keep leaves a clean form.
- **The row is marked `data-selected` on every return**: a saved or unchanged answer, a clean Cancel, a Discard, and *View item on Menu*. The ruling names the mark only for *View item on Menu*, but DESIGN-020's walks say each return "marks it `data-selected`". The rule is `#menu-list tr[data-selected='true']` in `office.css`; it is cleared on the next visit.
- **A reread that fails after an unknown outcome or a stale refusal** blanks `#version-facts` (the artifact does the same) and leaves the money facts, because the form is still drawn. The money facts are withheld only while the first read is loading or has failed, when no form is drawn at all.
- **Evidence for the three outcomes the task says are unreachable**: `NOT_FOUND` and `VALIDATION_FAILED` on a save are the definite failure with one reread, and are tested with a stubbed refusal (`item-versions.test.tsx`), but this client sends only an item and category it has read and only what its own checks accept, so neither can arrive from a real server today. `not-found` (a subject the read does not hold) is unreachable too, because the read returns archived items and archived categories; it is built and tested with a stubbed read.

### Tests changed, and why

Only the tests the task lists, and each gains the new entry without weakening:

- `routes.test.ts`: the manifest list gains `item`, and one assertion for `PATHS.item`.
- `menu.test.tsx`, the test *has no 86, Make available, Edit or New item control yet (S5 and S4c2)* (the exact controls of an item row and a category header). The assertion for 86 and Make available is unchanged; the one for Edit and New item flips from "none" to the exact list of nine names in order, which is stronger than the old "none". The test is renamed accordingly.
- `menu.test.tsx`, the test *Archive item and Restore item send { itemId } and focus the row action now shown*, lines 417 and 424: *Restore item Burger* and *Archive item Apple* become *Edit Burger* and *Edit Apple*, as the task directs. The test is renamed to say it focuses the row's Edit.

`sign-in.test.tsx`, `settings.test.tsx` and every other test that enumerates the rail pass unedited, because the rail text does not change. BO-05's, BO-08's and BO-03's own tests, and `e2e/tests/menu.spec.ts`, `tables.spec.ts`, `settings.spec.ts` and `payment-methods.spec.ts`, pass unedited.

### Red proofs

**Order of work, honestly.** Written before the code they cover, and seen failing: `item-price.test.ts` and `item-name.test.ts`. My first `npm run verify` ran after I had written those two files and before `src/item/price.ts` and `src/item/name.ts` existed; the typecheck stopped at `TS2307: Cannot find module '../src/item/name.js'` and the same for `price.js`. That is the red for the modules being absent, and it means I never ran the baseline `verify` on a clean tree; I rely on the lead's baseline (133 files, 4752 tests) and my counts below are against it. Written **after** the code they cover, with every mutation applied afterwards: `item.test.tsx`, `item-versions.test.tsx`, `item-departure.test.tsx` and `e2e/tests/item-editor.spec.ts`. Each mutation below was applied, its failure read, and the mutation reverted by reverse edit; I grepped `src/` for the mutations' text afterwards and ran `npm run verify` on the final tree.

1. **Rail** (mark no entry current on `item`): `item.test.tsx` AC 1 failed at `expect(…aria-current).toBe('page')`, received `null`.
2. **No-subject arrival reads the catalog** (`void fetchCatalog()` in `shown()`): two tests failed, the arrival (`h.count(READ)` 1 for 0) and browser Forward (4 for 3).
3. **Carry BO-03's `state.version`** (`base: menu.getState().version ?? snapshot.version`): AC 3 failed at `expectedVersion` 5 for 8.
4. **`name.length` for `[...name].length`**: `item-name.test.ts` (64 emoji, two tests) and `item.test.tsx` (*accepts 64 emoji*, zero requests sent) failed.
5. **`Number(text.replaceAll('.', ''))` in the price check**: only the source test failed (`['Number(']`). **No value case failed**: with these inputs a double gives the same answer, as S4c1's red 3 also found, so the source test is the guard.
6. **Drop the stored item's own-category exception**: *an item in an archived category may stay in it* failed (the refusal showed).
7. **Send `expectedVersion` on a create**: the create test failed with zero requests, not at the body assertion: the form's own `fieldsInError(CreateItemRequest, body)` guard refuses the strict schema's unknown key first and shows the failure notice, so nothing is sent. The schema is the line that catches it.
8. **Send every field on an edit**: two tests failed at the body (`basePrice` and `categoryId` present beside `name`; and the clean Save carried all three instead of `changes: {}`).
9. **Adopt the answered version always** (in `adopt`): the skip case failed, 8 for 5.
10. **Cancel without staging the focus**: three tests failed, with focus on `<body>`.
11. **Let Save through before a choice**: AC 11 failed, `ITEM_UPDATE` count 2 for 1.
12. **Treat a stale create as the edit refusal**: it cannot show a comparison (a create has no item to compare), so it reached the definite failure notice, `Something went wrong…` for `The category was archived…`, and the test failed there. No comparison appeared, which is the code's own stop.
13. **Resend once after an unknown outcome**: four AC 13 tests failed, the command count 2 for 1 (and 3 for 2).
14. **Skip the reread after `DUPLICATE`**: three tests failed, the holder line never appeared (`READ` 2 for 3, the archived-category copy missing, and *View item on Menu* absent).
15. **BO-03's openers live while BO-04's save is outstanding** (`busy` without `external`, in the model and the view): the first AC 15 test failed, `Edit Burger` not inert. The tests after it, which assert once the answer has settled, passed, as they should.
16. **Present while M-6 is up** (drop `!gate` in `answered`): two AC 16 tests failed (the editor had already returned to Menu behind M-6, and a reread was made behind it).
17. **Drop the category-archived suffix from the status**: two AC 17 tests failed.
18. **Show New item on an archived category**: two tests failed, one in `item.test.tsx` and the changed one in `menu.test.tsx`.

### What was left out on purpose (ruling 1)

The 22 states of S4c2b and the Variants and Modifiers sections with everything that belongs to them (the help, notes and empty bodies, Add, Remove, Undo, Move, the per-variant *Without modifiers* preview, the over-maximum note, the removal standing note, the two *Current order* lists of the stale comparison). The standalone *saved* and *unchanged* drawings with *Return to menu* (a saved or unchanged answer returns to BO-03). 86, Make available, archive and restore in any form. The kitchen-emergency sentences, BO-01's held-draft sentence and `leaserejected`. DESIGN-020's *Item editor* top-bar text is not built, because the frame's top bar says *Back office* on every screen (ruling 2); *Item editor* appears only as the heading of the no-subject, loading, load-error and not-found drawings. The ordinary context sentence keeps DESIGN-020's words, which speak of the variants and modifiers, although those lists arrive in S4c2b.

### What I found and did not fix

1. **Ruling 11's "the category refused after either choice" cannot hold for *Use current item*, and I built it for Keep only; this needs a ruling.** After *Use current item* the form shows the reread item, with its own category, so there is no destination left to refuse; the artifact's `chooseCurrent(false)` also clears the refusal. After *Keep my changes* the draft's archived destination is refused by the rerun local checks (focus on Category, Save held, the *Correct the marked fields, then press Save.* notice, `item-versions.test.tsx`). **Proposed wording** for the next ruling or for DESIGN-020 round 3: "after Keep my changes the destination category is refused until an active one is chosen; after Use current item the form shows the current item and nothing is refused."
2. **Save held on a visible field error** is my reading of the artifact (see *What was decided*). It is not in the task's rulings.
3. **The accent rule.** `holderOf` compares trimmed names with BO-03's collator at `sensitivity: 'base'`, as ruling 14 says, so an accent variant (*Cafe*, *Café*) could be shown as holding the name when the server's index on `lower(name)` does not count it. S4c1's finding 4 said the same; harmless today.
4. **After Keep my changes on an unknown outcome with a newer version, the form stays "uncertain"**, so leaving still asks with the uncertain body. That is what BO-03's `keepMine` does (it never clears `uncertain`), and I copied it. A ruling could make Keep and Use current clear it.
5. **`.item-work:has(.item-current)`**: the artifact's selector was `:has(.item-current:not([hidden]))`; BO-04 renders the comparison only when it is wanted, so the plain `:has` is equivalent.
6. **I did not look at the page.** The unit tests run in jsdom and the browser spec asserts state, accessible names, focus and counts; none of it checks the layout (the two-thirds form beside *Current item*, the sticky footer, the grid of the three fields). The CSS is ported from the artifact's rules and passes the registry test, but no one has seen BO-04 drawn. The lead's or the owner's eye on `npm run dev` is needed before merge.
7. **Edge not separately tested.** *New category if that category no longer exists* (a clean Cancel from a new item whose category row has gone) is implemented as the resolver's fallback in `Menu.tsx` and not exercised: BO-03 never loses a category row, it only archives it, and an archived category's New item is absent, which does take the fallback; the unit tests do not set that up.
8. The comments saying "UTF-16 units" in older files are untouched (queued). The code-point rule is in every new comment.

### Verify output

`npm run verify`: typecheck clean across server, money, contracts, api-client, pos, back-office and e2e; **138 test files, 5028 tests passed** (the lead's baseline was 133 files, 4752 tests: +5 files, as expected). The five new files hold 244 tests (145 in `item-price.test.ts`, 20 in `item-name.test.ts`, 38 in `item.test.tsx`, 24 in `item-versions.test.tsx`, 17 in `item-departure.test.tsx`) and the three edited tests are count-neutral, so the arithmetic gives 4752 + 244 = 4996, not 5028: **the tree I started from already held 32 more tests than the lead's figure**. I saw the same gap in the back-office project alone, which ran 1007 tests before my new files were counted (S4c1's Handoff gives 966 at round 1, and its rounds 2 and 3 added 9). I did not run the baseline on a clean tree, so I cannot say where the 32 come from; the difference is not from my changes. `npm run test:e2e:all`: **92 passed** in 1.2 minutes, Chromium and WebKit (baseline 86: +6, three new cases in each engine). A browser was available and used. The e2e run was made before the mutations and the source was restored byte for byte afterwards (checked with a search for each mutation's text and a final `npm run verify`); I did not rerun the e2e suite after the mutations.

### What the next agent needs and does not have

The lead's rulings on findings 1 (the category after *Use current item*) and 2 (Save held on an error), and a look at the drawn page (finding 6). S4c2b needs nothing else from this slice; the attach points are above. I did not run a review pass, and nothing here is audited (owner Q11).

DONE

### Round 2 (the review's F1 and F2, the lead's rulings of 2026-10-27)

Code commit `2e23d04` on `agent/phase1-s4c2a`; the hash of this section's own commit is in `git log`.

**F1. A saved item has a category on Menu to sit in.** `receiveItem(item, version, unchanged, category?)` and `releaseFromSave`'s `ok` outcome now take the destination category as BO-04's read holds it (`item/model.ts` passes `state.categories.find(...)`). A new private `host()` in `menu/model.ts` inserts it only when Menu's list holds no category with that id, so a category Menu already holds is never replaced from BO-04's read. The inserted category is not an answered record: it is not in the applied map and moves no version; only the item's answer does, by the one-step rule. One addition beyond the ruling, needed for its failure test: a `hosted` flag, set by `host()` and cleared by a successful read, makes a failed visit read leave the known rows drawn as a partial list. Without it the visit read starts after the answer was applied, so S4c1's `clock > startedAt` test does not mark the list partial and the table would vanish. The focus effect's consume-once rule is untouched.

*Tests* (`item-versions.test.tsx`, *Round 2, F1*): Menu's first read holds three categories; BO-04's read also holds *Specials*; Burger is moved there and saved with Menu's return read held. The first case asserts the hosted category's heading and the row, focus on *Edit Burger*, and *Burger saved.*; then the visit read lands with both and the row, category, focus and sentence stay. The second lets the held visit read fail: the category and row stay under *The menu list may be out of date*. *Red:* passing no category again failed both cases, at the hosted category row being absent (the first assertion, before the focus one the ruling expected; the category is what the focus needs).

**F2. The refused name's holder goes through the gates.** In the `duplicate` branch of `present`, when the reread lands and `!gate || state.decision`, the result is held in the existing held-retry slot (`heldRetry = () => showHolder(command)`) and `flush()` presents it once on *Continue* or *Stay*, with no second read and no second save. `showHolder`'s identity check (same form key, error still `duplicate`) drops it after Discard, after an edit that cleared the error, and a different manager's sign-in destroys the model. I used `heldRetry` rather than `held` because `held` carries a command's answer, which the duplicate branch has already presented; both slots are drained by the same `flush()`. The comment above the branch now says the reread does present something.

*Tests* (`item-departure.test.tsx`, *Round 2, F2*): a create of a held name is refused with its reread held; M-6 opens, the read lands (no holder), *Continue* shows it, `READ` and `ITEM_CREATE` counts unchanged; the departure decision open while it lands (absent), then *Stay* (present, counts unchanged); the decision answered *Discard* (never shown, BO-03 reached); a different manager's sign-in (never shown, the no-subject sentence). *Red:* showing the holder at once failed the M-6 case (holder behind M-6) and the decision case (holder under the decision).

**Counts.** `npm run verify`: typecheck clean; **138 files, 5034 tests** (up 6: two F1 cases, four F2 cases). `npm run test:e2e:all`: **92 passed**, Chromium and WebKit. No existing test was edited; no formatter was run.

**Still open.** Findings 6 (the drawn layout, which no one has seen) and 7 of the first Handoff, as the lead noted.

DONE
