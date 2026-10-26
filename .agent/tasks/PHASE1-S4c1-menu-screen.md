---
id: PHASE1-S4c1
title: BO-03 Menu in the back office — the grouped catalog list, categories, reorders, archive and restore, and the ConfigApi inclusion (plan S4c, DESIGN-019)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S4b]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/menu.spec.ts, e2e/support/**]
status: active
cycles: 0
---
# PHASE1-S4c1 — BO-03 Menu in the back office

**Written** 2026-10-26 by the lead, from slice S4 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S4*: "S4c BO-03 … and BO-04 …, which may
itself split by screen"). This task builds **BO-03 Menu**. **PHASE1-S4c2** builds BO-04 (the item editor) and the
links between the two screens; it is written after this one merges. The task draws on:
- the server halves **PHASE1-S4a** (the domain, PR #140) and **PHASE1-S4b** (the eleven routes, PR #142);
- the design **DESIGN-019** (BO-03, merged as PR #131);
- the three back-office client slices whose patterns this one copies: **PHASE1-S1b** (BO-05, the list and panel),
  **PHASE1-S2b** (BO-08's settings: a versioned form, the stale notice, *Keep my changes* and *Use current*) and
  **PHASE1-S3b** (BO-08's methods: a second list with status commands under one screen model).

Where this file, DESIGN-019 and those patterns differ, the rulings below say which wins. Where they still differ, stop
and write `BLOCKED: <question>`.

## Objective

A signed-in manager opens **Menu** from the rail and sees the restaurant's catalog grouped by category: active
categories first, then archived ones, every item in its category with its base price and availability, archived items
after active ones. The manager creates and renames categories, reorders the categories and the items of a category,
and archives and restores categories and items. All of this goes through the S4b routes, with every word from
DESIGN-019. A stale rename or reorder is refused `CATALOG_CHANGED`: the draft is kept, the menu is reread once, and
the manager chooses *Keep my changes* or *Use current menu*. The screen follows the configuration-form rules S1b, S2b
and S3b built: one form open and one command in flight per screen; unknown outcomes reread and never resend; the
partial list; drafts held across M-6 and BO-01 for the same manager. **Items cannot be created or edited yet**: that
is BO-04, in S4c2.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-019's Handoff**, `.agent/tasks/DESIGN-019-menu.md` from `## Handoff` to the end, including *Round 2* and
   *Round 3*. These parts bind this task, minus the exclusions of ruling 1:
   - the rules table (*Delivery and the decisions S4a, S4c and S5 can copy*);
   - *Exact copy and accessible names for S4c and S5*: every product word comes from it (ADR-011 rule 24);
   - *Focus and command lifetime*.
   Also read the lead's rulings in the same file: *Round 2* (F1 to F7) and *Round 3*.
3. **`docs/DESIGN.md`**, *Configuration forms — DESIGN-017 / consult C2* (from `:1486`), *DESIGN-018 additions*
   (`:1628`) and *DESIGN-019 additions* (`:1788` to `:1875`). All three bind this task; their headings still say
   "awaiting review", but all were reviewed and merged. The DESIGN-020 additions are BO-04's (S4c2).
4. **The Frost artifact**, `docs/design/visual-directions/frost/back-office/menu.html` with `menu.css`, `menu.js` and
   `menu-states.js`, the shared `office.css` and BO-05's `tables.css` (whose panel classes it reuses).
   - Open it with `?state=<name>`; `menu-states.js` lists all 74 states.
   - It is a review fixture: its records, response selector, URL snapshot plumbing (`editorHref`, the return adapter)
     and disclaimers are not product and are not copied.
   - Port CSS only through tokens already in `docs/design/tokens/frost.css`; `apps/back-office/test/no-invented-values.test.ts`
     enforces this.
5. **PHASE1-S4b's Handoff**, `.agent/tasks/PHASE1-S4b-catalog-routes.md`, *What S4c needs*. It gives the routes,
   `ROUTES` names, schemas and views, how each refusal arrives, how *unchanged* is read from the version, and the
   `ConfigApi` exclusion you now remove.
6. **The three client slices**, task files and Handoffs: `.agent/tasks/PHASE1-S1b-tables-screen.md` (*How it works,
   and what a later form copies*, rounds 2 to 4), `.agent/tasks/PHASE1-S2b-settings-screen.md` (*How it works, and
   what S3 copies*, above all *The version rules*, and *Round 2*), `.agent/tasks/PHASE1-S3b-payment-methods-screen.md`
   (*How the methods part sits in the screen model*, *Round 2*).
7. **The existing back office**: `apps/back-office/src/` (`tables/`, `settings/`, `copy.ts`, `Screens.tsx`, `Rail.tsx`,
   `routes.ts`, `router.ts`, `work/guard.ts`, `forms/fieldsInError.ts`, `session/`), and the tests beside them. **The
   browser harness**: `e2e/support/**`, `e2e/tests/tables.spec.ts`, `e2e/tests/payment-methods.spec.ts`.
8. The contract, for meaning only: PRD FR-B4, FR-C1, FR-C7, FR-C8, FR-A2b, AC-31, AC-35; BOUNDARIES B-1, B-8, B-20,
   B-24.

## Decided: do not reopen

- **ADR-012 rules 10, 11, 13 (accepted):** every committed catalog write advances the version by one; a read reports
  the version from the same snapshot; **edits** (a category rename, either reorder) carry the version their form was
  opened at and are refused `CATALOG_CHANGED`; **creates and state commands** (category create, archive, restore)
  carry none and cannot be refused stale.
- **S4a and S4b (merged):** the routes and their answers as S4b's Handoff states them. `DUPLICATE` is bare. No
  single-item read. An archived category named as a destination is `CATALOG_CHANGED`. `INVALID` arrives as
  `VALIDATION_FAILED`.
- **Owner, Q10:** categories and items are archived and restored, never deleted. **Q11:** nothing here is audited.
- **DESIGN-019, accepted with the lead's rulings:**
  - category names are 1–32, trimmed, with no control character, unique among active categories case-insensitively;
  - no confirmation before archive or restore;
  - reorders use *Move up*, *Move down* and *Save order*, never dragging;
  - the list version rule (round 2, F1);
  - the departure decision's bodies for Archive and Restore (round 2, F7; round 3);
  - a restore into a held name is a **page result**, not a form.
- **Drafts (owner, 2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back. A different manager's sign-in destroys it, and so does a reload.
- **C2 §6 and ADR-011 rule 20:** an unknown outcome rereads and never resends; success is never inferred from a
  reread; there is no "send again" control.
- **Lengths are code points.** Count with `[...value].length`, as `settings/fields.ts` and `settings/methods.ts` do,
  never `value.length`. DESIGN-019's "UTF-16 units" sentence is wrong; do not copy it into a new comment.
- **Client paths name a screen and nothing else** (`routes.ts`: no record id, no draft, no query string; a test scans
  for query and hash reads). BO-03's path is `/back-office/menu`.
- **S1b's, S2b's and S3b's patterns**, as merged: reuse `fieldsInError`, `work/guard.ts`, the router's guard, the
  logout confirmation and the M-6 and BO-01 handling as they are.

## Lead rulings (2026-10-26)

1. **Scope: BO-03 in every state DESIGN-019 draws, except these, which are left out on purpose.** Say so in the
   Handoff.
   - **86 and Make available** are S5's (plan: "the command and the row action together"). That covers:
     - the two controls;
     - the states `eightysix` and `available`;
     - the eight page-result states for `86` and `available` (pending, unknown, failure and session);
     - round 2's F7 rule that availability acts over an open editor.
     The **Availability** column still shows each item's availability as text (*Available* / *86 · Unavailable*), and
     the Actions cell has no availability control.
   - **Edit and New item** are S4c2's, together with BO-04 and the way between the two screens. The *Empty category*
     row keeps DESIGN-019's copy as drawn, although it names New item; S4c2 adds the control. An item's state-command
     success focuses **that item's row action now shown** (Restore after an archive, Archive after a restore) until
     S4c2 adds Edit, which then takes that focus as DESIGN-019 says.
   - The **kitchen-emergency** sentences and the `kitchen` state: the built frame has no incident action, as in S3b.
   - **BO-01's held-draft sentence** (S10).
   - **`leaserejected`** (Phase 4).
2. **The screen, the route and the rail.** `Screen` gains `'menu'` with path `/back-office/menu`. The rail lists
   **Menu, Tables, Settings** in that order under *Configuration* (DESIGN-019 round 2, F5); *Menu* comes from the copy
   module. The heading is *Menu*. The screen is made per working-area key in `Screens.tsx`, beside BO-05's and BO-08's.
3. **One screen model**, `apps/back-office/src/menu/model.ts`, holding the list and every editor and command for the
   screen:
   - one `workGuard` registration, one `command` slot (a union over the command kinds), one `decision`, one held
     result, one `leave(next)` that every opener goes through;
   - list behaviour copied from `tables/model.ts` as S3b copied it (its own read clock, applied-record map and sequence;
     F1 of S3b: a superseded reread never reports success);
   - version rules copied from `settings/model.ts` (*The version rules* in S2b's Handoff).
   At most one editor is open: the category form (create or rename) or a reorder (categories, or the items of one
   category). While any command is pending, every opener on the screen is inert and a second press sends nothing.
   Pure helpers (the name check, the grouping and sort, the price text, the copy) live in their own files under
   `menu/`.
4. **The list read.** Every visit reads `GET /api/back-office/config/catalog` once (not interactive).
   - A failed visit read keeps a newer success.
   - A read that began before a command was answered never undoes the answered record.
   - The **partial state** applies when a command succeeds while the list read stands failed. It uses DESIGN-019's
     *Partial list* copy, withholds the counts, and disables both reorder openers. *Try again* repeats the read only.
   - *Loading menu…* shows while the first read is in flight.
   - *The menu has been refreshed.* is used only as DESIGN-019's copy table says, never to infer an unknown command's
     result.
5. **The version the list stands at** (DESIGN-019 round 2, F1, verbatim in `D` `:1818`).
   - A full read sets it.
   - A command answer advances it to the answered version only when that version is exactly the standing version plus
     one, or equal to it.
   - Otherwise the list keeps its standing version, so the next edit opened from it is refused `CATALOG_CHANGED` and
     rereads.
   - An editor carries the list's standing version at the moment it opens. A reread alone never moves an open draft's
     base: only an answer, an unchanged answer, *Keep my changes* or *Use current menu* moves it (S2b's rule).
   - *Unchanged* (an edit or reorder whose answered version equals the version it carried) closes the editor with
     *Nothing changed. Menu version {n} is still current.*
6. **Grouping and order** (DESIGN-019 rules table, *Grouping and row order*).
   - Active categories come first, then archived ones. Each set is in stored `displayOrder`, ties broken by name with
     BO-05's collator (`Intl.Collator('en', { numeric: true, sensitivity: 'base' })`), then by id.
   - Within a category, active items come before archived ones, with the same rule inside each set.
   - Every category and item stays visible.
   - The count line `{categories} categories · {items} items` counts **every** category and item the read returned,
     archived included (as the artifact does). It is withheld unless the full read succeeded.
   - An item's options line is `{n} variants · {n} modifiers`, counting **active** options only (a removed option is
     history).
   - The hidden-item note follows DESIGN-019's precedence: the category reason first, when both are archived.
7. **Prices on screen.** The stored tax-inclusive base price is shown as whole rupiah with dot grouping and no
   currency symbol. Format the `bigint` from `decodeMoney` with `Intl.NumberFormat('id-ID', { maximumFractionDigits:
   0 })`, as `apps/pos/src/money.ts` does, **never through `Number`**. Put this in `menu/money.ts`, with a source test
   that scans `src/menu/` for `Number(`, `parseFloat`, `parseInt`, `Math.round` and `toFixed` (as S2b's
   `settings-rate.test.ts` does for `settings/`). BO-03 has no price input.
8. **The category name.** Trim it before checking, then apply DESIGN-019's order: empty, then too long (more than 32
   code points), then a control character (`\p{Cc}`), each with its copy and with focus on *Category name*.
   - The trimmed name is sent.
   - A pair test over the boundary values (as S3b's ruling 6 for methods) shows the check and S4b's `CategoryName`
     agree.
   - An obsolete error clears on edit, and Create stays live (DESIGN-019 Handoff, *Link migration*, last paragraph).
   - Uniqueness is the server's: there is no local duplicate check.
9. **Commands and their bodies.**

   | Command | Body |
   |---|---|
   | Create category | `{ name }` |
   | Rename (active or archived) | `{ categoryId, expectedVersion, name }`; a rename never restores |
   | Reorder categories | `{ expectedVersion, categoryIds }`, the complete active scope in the draft's order |
   | Reorder items | `{ categoryId, expectedVersion, itemIds }`, the complete active scope in the draft's order |
   | Archive or restore a category | `{ categoryId }` |
   | Archive or restore an item | `{ itemId }` |

   Each `ok` answer is applied to the list: the category, the scope's rows, or the item. The results, sentences and
   focus targets are DESIGN-019's, with ruling 1's substitution for an item's Edit.
10. **`CATALOG_CHANGED` and the newer-version unknown** (DESIGN-019, `D` `:1806`). On a stale rename or reorder:
    - write nothing, keep the draft and reread once;
    - show the current category name, or the complete current order, beside the draft, with the new version in the
      notice;
    - *Save* / *Save order* stays disabled, with its reason, until *Keep my changes* or *Use current menu* is chosen;
    - neither choice sends anything;
    - a failed reread withholds the comparison and offers a read-only *Try again*.
    An unknown outcome whose reread shows a **newer** version uses the same comparison and says the version may include
    this save. Archived records stay outside a reorder scope; DESIGN-019 says a reorder never silently merges a changed
    scope.
11. **`DUPLICATE`** (409, bare).
    - **On create or rename:** the form stays with the draft. The refusal goes on *Category name*, with focus there.
      The list is reread once behind it. The holder's group heading is marked *Name in use* once the reread shows which
      active category holds the name (compare with the collator, `sensitivity: 'base'`; no marker if none matches).
    - **On a category or item restore:** DESIGN-019's page result for that kind, focused, the list reread once, and
      the holder marked. No form opens, and nothing is ever resent.
12. **`NOT_FOUND`** (404) and **`VALIDATION_FAILED`** (400, S4a's `INVALID`) on any catalog command can only mean a
    record vanished or the client sent an incomplete scope, which this client does not do. Treat each as the definite
    failure of that command, with the list reread once. Say in the Handoff that both are unreachable today. No new copy.
13. **State commands** (archive and restore of a category or an item) send at once from the header or row.
    - The page status is focusable and shows the pending sentence; every opener is inert meanwhile.
    - Unknown: one reread, never a resend, with DESIGN-019's sentence (or the *could not be refreshed* variant).
    - A definite failure and a session refusal use DESIGN-019's copy, as S1b built them for tables.
    - With an editor open and dirty, *Archive* and *Restore* go through the departure decision with DESIGN-019's
      round 2 body (or round 3's, when the draft's own save is unknown). With a clean editor, they close it and act.
14. **The working-area rules, unchanged.** The editors are non-modal panels:
    - under M-6 they stay visible and inert;
    - at BO-01 they are hidden, with the draft held;
    - the same manager gets them back with the draft control focused;
    - a different manager destroys them.
    S2b's round 2 F2 applies to every command here. After each asynchronous reread (unknown, `DUPLICATE`, stale),
    recheck the session gate and the open decision before presenting. If presentation is not permitted, hold the
    finished result with its read and present it once, with its focus, when the same manager returns, never repeating
    the command or the reread.
15. **`Decision` is extracted now.** BO-05 and BO-08 each hold a copy, and BO-03 would add a third (S3b's ruling 14
    said to extract at the third). Move it to one shared module under `apps/back-office/src/forms/`, used by all three
    screens, with the body chosen by the caller. BO-05's and BO-08's existing tests must pass **unedited**; if one
    cannot, stop and ask.
16. **`ConfigApi`.** Remove S4b's `Exclude` of the catalog paths from `ConfigPath` in `session/api.ts`. Add the eleven
    functions to `configApi()`, and add the eleven paths to `fixtureSession.ts` answering `unavailable`, as the table
    and tender-method paths do; fixture mode then shows BO-03's read failure. Update `config-api.test.tsx`'s key list.
17. **Copy** goes in `apps/back-office/src/menu/copy.ts`. Each string must trace to a row of DESIGN-019's copy table, or
    to the shared copy where DESIGN-019 says BO-05's or DESIGN-018's words are reused (the departure decision, the
    logout decision, M-6). No zod message, server text, error code or submitted value ever becomes visible text, except
    the manager's own value in *Category name* and the names and prices the read returns.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

1. **Rail and route.** The rail lists Menu, Tables, Settings in that order under *Configuration*, with *Menu* current
   on BO-03, and `/back-office/menu` opens BO-03. *Red:* put Menu last: the order test fails.
2. **Grouping, order, counts.** A fixture holds:
   - an archived category between two active ones;
   - an active category holding `Item 10`, `Item 2` and an archived `Apple`, with two items tied on `displayOrder`;
   - an item with two variants (one removed) and one modifier.
   The rows read in ruling 6's order. The options line counts active options only (`1 variants · 1 modifiers`). The
   count line counts every record. The hidden notes follow the precedence. *Red:* sort ties with `a.name < b.name`: the
   tie test fails.
3. **Prices.** `99999999` shows as `99.999.999` and `0` as `0`, with no currency symbol. The source test of ruling 7
   passes. *Red:* format with `Number(price).toLocaleString('id-ID')`: the source test fails.
4. **Empty, loading, failure, partial.** The empty menu shows DESIGN-019's *No menu yet* with *New category*.
   *Loading menu…* shows while the read is in flight. A failed read shows the alert with *Try again*, withholds the
   count and disables both reorder openers. A command that succeeds while the read stands failed shows the partial
   state, with its copy and the answered record applied. *Red:* leave *Reorder categories* live in the partial state:
   that test fails.
5. **The category name.** The pair test of ruling 8. The UI refusals come in order with their copy and focus. Nothing is
   sent while the name is invalid. The body carries the trimmed name. A 32-emoji name is accepted locally. *Red:* count
   with `name.length`: the 32-emoji case fails.
6. **Create, rename, archive, restore.** Each sends exactly one request with ruling 9's body, applies the answer,
   announces DESIGN-019's sentence and moves focus as DESIGN-019 says (ruling 1 for items).
   - An archived category's group moves after the active ones.
   - A rename of an archived category leaves it archived.
   - A category archive changes no item row.
   *Red:* send `{ id }` instead of `{ categoryId }` on archive: the body assertion fails.
7. **Reorder.** *Reorder categories* is disabled below two active categories, and a category's *Reorder items* below
   two active items, and both are disabled while the read is loading, failed or partial.
   - In the panel, *Move up* is disabled on the first row and *Move down* on the last, and focus stays on the moved
     record's control (or its other one at an end).
   - *Save order* sends the full active scope once, with the version the panel opened at. Archived rows keep their
     place.
   - Saved, the result sentence shows and focus returns to the opener.
   - An unchanged order answers *Nothing changed. Menu version {n} is still current.*
   *Red:* send only the moved rows: the body assertion fails.
8. **The list version** (ruling 5).
   - A command answer one step ahead advances the standing version, so the next rename carries it and succeeds.
   - An answer that skips a version (another tab wrote) leaves it, so the next rename carries the old version and meets
     `CATALOG_CHANGED`.
   - A reread never moves an open draft's base.
   *Red:* always adopt the answered version: the skip case is not refused.
9. **`CATALOG_CHANGED`** (ruling 10), on a rename and on each reorder. The draft is kept and the reread happens once.
   The comparison and notice copy are shown, with Save disabled and its reason. *Keep my changes* moves the base to the
   reread version, focuses Save, and the next Save carries that version. *Use current menu* replaces the draft and
   focuses the name or the first enabled move control. Neither sends anything. With a failed reread there is no
   comparison and a read-only *Try again*. *Red:* enable Save before a choice: that test fails.
10. **Unknown outcomes.** An edit or a state command answered `failed` or `unavailable` gets one reread and never a
    resend.
    - The copy is DESIGN-019's, with and without a failed reread.
    - An edit whose reread shows a newer version gets the comparison and the "may include this save" notice.
    *Red:* resend once after `failed`: the command count is 2.
11. **`DUPLICATE`** (ruling 11). On create and rename, the draft is kept, the refusal appears on *Category name* with
    focus, there is one reread, and the holder is marked. On a category restore and an item restore, the page result
    appears, focused, with one reread and the holder marked, and no form opens. The request count stays one per press.
    *Red:* open the rename form on a restore refusal: the no-form assertion fails.
12. **One form, one command per screen.**
    - With a dirty rename, *New category*, *Reorder categories* and the rail each meet the departure decision.
    - *Archive* meets it with DESIGN-019's round 2 body, and with the round 3 body when that save is unknown.
    - With a clean editor, the opener simply hands over.
    - While any command is pending, every opener is inert and a press sends nothing.
    *Red:* let *Archive* bypass `leave`: the decision test fails.
13. **Departure, M-6 and BO-01** (ruling 14).
    - The decision comes from Cancel, Escape, browser back and the rail; Stay keeps the draft, and Escape means Stay.
    - Under M-6 the editor stays visible and inert.
    - At BO-01 the draft is held, given back to the same manager with focus and value, and destroyed for a different
      manager.
    - A command result arriving while M-6 is up is held and presented once on return.
    *Red:* present the held result while signed out: the M-6 test fails.
14. **`Decision` extracted** (ruling 15). One module; BO-05 and BO-08 use it; their tests pass unedited. A source test
    shows exactly one `Decision` definition in `src/`. *Red:* restore BO-05's local copy: the source test fails.
15. **`ConfigApi`** (ruling 16). The type test and key list include the eleven catalog paths. Fixture mode shows BO-03's
    read failure. No fixture marker reaches the built bundle. *Red:* leave one function out of `configApi()`: the
    key-list test fails.
16. **In the browser** (`e2e/tests/menu.spec.ts`, both engines, the harness's rules).
    - **(a)** A manager opens Menu from the rail, creates a category with a run-unique name, and sees it listed. The
      manager renames it, archives it and sees it after the active categories, then restores it. The database agrees,
      read through `readCatalog` in `apps/server/src/domain/catalog.ts`, as `payment-methods.spec.ts` reads through
      `listTenderMethods`.
    - **(b)** Two categories are made through `createCategory`. The manager opens *Reorder categories*, then a
      `createCategory` made through the domain advances the version. The manager moves one down and presses *Save
      order*: the stale notice shows, exactly one reorder request was sent, and the database order is unchanged. *Keep
      my changes* then *Save order* saves it.
    - **(c)** An item made through `createItem` shows its price grouped with dots.
    Assert changes, not absolute counts, since earlier specs or reruns leave records. Nothing is deleted (there is no
    `DELETE`).
17. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**; an edit to an existing helper's behaviour is a
  change to every spec: stop and ask. No change to `packages/`, `apps/server`, `db/` or `docs/`. If a route or schema
  is wrong for the screen, that is a question, not a fix.
- Red first, per criterion: write the test, run it against the unchanged code and record the failing assertion; then
  write the code. If you write a test after its code, say which tests and still apply and report each mutation.
- Every visible word comes from DESIGN-019's copy table or the shared copy, and every style value from the Frost
  registry. Use `aria-disabled` and `tabIndex={-1}` on inert openers, as BO-05 and BO-08 do, never `disabled` (except
  where the artifact and `D` say a control is disabled: the end-of-list move controls and the reorder openers below
  two rows; check how BO-05 and BO-08 express "disabled" and match them).
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

- `apps/back-office/test/config-api.test.tsx`: the `ConfigApi` key list (ruling 16).
- `apps/back-office/test/routes.test.ts`: the manifest gains `/back-office/menu`.
- `apps/back-office/test/fixture-session.test.tsx` and `config-api.test.tsx`'s fixture case: only where they assert the
  whole rail or the fixture page.
- Any existing test that asserts the rail's entries or their count: it gains *Menu*, never weakened. List each one in
  the Handoff.
- New tests under `apps/back-office/test/` (for example `menu*.test.tsx`, `menu-name.test.ts`, `menu-money.test.ts`,
  `decision.test.ts`), and the new spec `e2e/tests/menu.spec.ts`.
- **Nothing else should change.** BO-05's and BO-08's tests pass unedited (ruling 15), and so do
  `e2e/tests/tables.spec.ts`, `settings.spec.ts` and `payment-methods.spec.ts`. A change anywhere else is reported in
  the Handoff with its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `870c969` (S4b #142 and the lead's #143 merged). The lead's runs of S4b's final tree, which has the
same code: `npm run verify` 125 files, 4593 tests; `npm run test:e2e:all` 78 passed. Confirm the baseline before you
start, and state the new counts in the Handoff. Run `npm run test:e2e:all` yourself before you finish.

## Out of scope

- Any server, contract, transport-core or migration change. BO-04, the item create and edit, and the way between BO-03
  and BO-04 (S4c2). The items of ruling 1.
- The code-point cleanup of BO-05's `tables/label.ts` and the older comments (queued).
- Polling, an idempotency key, a single-record read, and a server-side field list for `VALIDATION_FAILED`.

## Commit and report

Commit on `agent/phase1-s4c1` only, after verify is green, and never push. Use Conventional Commits, explaining why;
more than one commit is fine if it reads better. Write the Handoff below in full prose:
- what was done (paths, commits);
- **what S4c2 needs**: where BO-04's Edit and New item controls attach on BO-03, how the menu model would receive an
  item answered by BO-04, the list version an editor opened from BO-03 would carry, the shared `Decision`, and the
  accessible names the browser spec drives;
- what was decided and on what evidence;
- tests changed and why;
- each red proof (mutation, failure read, reverted);
- what was left out on purpose (ruling 1);
- what was found and not fixed;
- the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Round 2 — the Handoff's finding 1 (lead ruling, 2026-10-26)

The builder's finding 1 is accepted, and so is its finding 2: the task's browser scenario (b) was the lead's error,
because a `createCategory` changes the active scope. M2, which keeps the scope, stays as written. The ruling below takes
the answer DESIGN-020 already reviewed for the same case on BO-04's option lists (round 2, F2), and applies it to
BO-03's reorders. *The owner may overturn it.*

1. **Remove the client-side scope guard** in `save()` (`model.ts`, the `sameSet(editor.order, scopeNow(editor))`
   branch). It shows a definite failure for a request that was never sent, which is a fabricated result. A scope can only
   change through a committed write, and every committed write advances the version. So a draft built on an older
   scope always carries an older `expectedVersion`, and the server refuses it `CATALOG_CHANGED` before it judges the
   list (S4a's check order: version first). Send the draft, and let the server decide. Keep the
   `editor.base === null` part of the guard only if it is still reachable; say which in the Handoff.
2. ***Keep my changes* on a reorder whose scope changed** rebuilds the draft against the reread scope. The order is:
   - **if the draft moved no row:** the current order;
   - **otherwise:** the draft's order for the records it holds that are still in the current active scope, followed by
     the records new to the scope, in their current order.
   Records that left the scope (archived, or no longer active) drop out. The base moves to the reread version, as
   today. Nothing is sent. The rebuilt list is what the panel shows, so the merge is visible before *Save order* and is
   not the "silent merge" `D` forbids. When the scope did not change, *Keep my changes* behaves exactly as today.
3. **No new copy.** The stale notice, the comparison (*Current order: …*), the after-Keep notice (*Your changes now
   build on version {n}. Nothing has been saved yet. Press Save order to save them.*) and *Use current menu* are
   DESIGN-019's, unchanged. An unknown outcome whose reread shows a newer version reaches the same comparison and the
   same rule.
4. **Tests.**
   - A unit test, in `menu-versions.test.tsx` or beside it, covers each of these cases: a record added to the scope
     (added last); a record archived out of the scope (dropped); both at once; and a draft that moved nothing (takes
     the current order). After Keep, *Save order* sends exactly the rebuilt list with the reread version.
   - **M3** in `e2e/tests/menu.spec.ts` becomes the real-database walk of the added case: the panel is open, a domain
     `createCategory` runs, and *Save order* gets the stale notice with exactly one request. *Keep my changes* shows the
     new category last. *Save order* then saves, and the database order equals the panel's.
   *Red:* restore the old *Keep* (base only, order untouched). The added-record test fails, because the sent list is
   not the whole scope.
5. Run `npm run verify` and `npm run test:e2e:all`. Commit on this branch. Append a *Round 2* section to the Handoff (what
   changed, each new test and its observed red, the counts), ending `DONE` or `BLOCKED: <question>`, and report to the
   lead through Herdr.

## Lead verify (2026-10-26)

At `f0d88dc` (round 1 `0ff6a88`, round 2 `8220472`), in this worktree.
- **Scope.** `git diff --name-only development...HEAD`: the task file and paths in `owns` only. The changed existing tests
  are `config-api.test.tsx` and `routes.test.ts` (listed), plus `settings.test.tsx` and `sign-in.test.tsx`. In those two,
  the diff only adds *Menu* to rail assertions (the task's "any existing test that asserts the rail's entries"); nothing
  is weakened. BO-05's and BO-08's tests and their specs pass unedited with the shared `Decision`.
- **Runs.** `npm run verify`: 133 files, 4746 tests, green (baseline 125/4593). `npm run test:e2e:all`: 86 passed, in
  Chromium and WebKit (baseline 78; `menu.spec.ts` adds four per engine).
- **Round 2 read against its ruling.** The client scope guard is gone. `keepMine` rebuilds a reorder whose scope
  changed: a draft that moved nothing takes the current order; otherwise it keeps the draft's order for the rows still
  in the scope and puts new rows last. Nothing is sent. The four new cases had an observed red.
- **Process deviation.** The builder wrote the screen tests after the code and then applied each mutation; its Handoff
  names which, and every criterion has an observed red.
- **Not done by the lead.** The lead cannot sign in to the back office, so it has not walked BO-03 in a real browser;
  the owner looks before merge. `menu.spec.ts` drives the real routes in both engines.
- **For the reviewer.** Reviewers cannot reach the database or a browser, so this note is the evidence for those runs,
  and a "blocked" on that alone is ruled clear. Review against the task, DESIGN-019's Handoff and `D`. Look closely at
  `menu/model.ts`'s version, held-result and command-lifetime rules, and at the rulings of round 2.

## Round 3 — the review's F1 and F2 (lead rulings, 2026-10-26)

Codex reviewed `ca09d8d` (`.agent/reviews/PHASE1-S4c1-review.md`) and found two P2 issues. **Both are accepted, as the
review proposes.**

1. **F1. An explicit retry of a reread presents through the gates.** Give `retryRead()` the same gated completion as
   the automatic reread: keep the completed read and the identity of the originating editor or result, and recheck the
   session gate and the open departure decision before presenting. If presentation is not permitted, hold the result
   and present it once, with its focus, when the same manager resumes or presses *Stay*. Never repeat the read or the
   command. Ruling 14 already requires this; the retry path missed it.
   *Tests:* delayed-retry cases for an unknown outcome and for a stale refusal, each with M-6 opening while the retry
   read is outstanding, and with the departure decision open. Each asserts nothing is presented behind the gate, the
   result is presented once on return, and the request count is unchanged.
   *Red:* drop the gate check in `retryRead`; the M-6 retry case presents behind M-6.
2. **F2. *New category* stays live after a failed read.** DESIGN-019's `error` state and the artifact (`menu.js:47`)
   keep it live, and ruling 1 builds every drawn state. The lead had let the Handoff's BO-05 reading stand; that was
   wrong. Give creation its own condition in the view and the model: inert while the first read is loading or while any
   command is pending, live otherwise, failed read included. The complete-read restriction stays on the two reorder
   openers only.
   A create that succeeds after a failed read applies the answered category and takes the **partial** composition
   (ruling 4): the counts are withheld, the alert reads DESIGN-019's *Partial list* copy, and the reorder openers stay
   off.
   *Tests:* a failed first read then *New category* opens the panel; *Create* sends one `{ name }`; the partial state
   follows, with its copy.
   *Red:* restore the `usable` gate on the opener; the panel does not open.
3. Run `npm run verify` and `npm run test:e2e:all`. Commit on this branch. Append a *Round 3* section to the Handoff
   (what changed, each new test and its observed red, the counts), ending `DONE` or `BLOCKED: <question>`, and report to
   the lead through Herdr. This is the last fix round this task allows (`max_fix_cycles` 2).

## Handoff

### What was done

BO-03 Menu is built, in one code commit on `agent/phase1-s4c1`: `0ff6a88` (the hash of this Handoff's own commit is in `git log`; a commit cannot name itself). A signed-in manager opens **Menu** from the rail (`/back-office/menu`) and sees the catalog grouped by category: active categories first, then archived ones, every item with its base price and availability text, archived items after active ones. They create and rename categories, reorder the categories and the items of one category with *Move up*, *Move down* and *Save order*, and archive and restore categories and items. Everything goes through the S4b routes, and every product word comes from DESIGN-019's copy table.

Paths, all under `apps/back-office/` unless noted:

- `src/menu/model.ts` (new): the one screen model. One `workGuard` registration, one `command` slot over eight command kinds, one `decision`, one held result, one `leave(next, continuing)` that every opener goes through. Its list read, applied-record maps and read sequence are copied from `tables/model.ts` as S3b copied them; its version rules are copied from `settings/model.ts`.
- `src/menu/Menu.tsx` (new): the view, with the non-modal editor panel above the table.
- `src/menu/copy.ts`, `name.ts`, `money.ts`, `group.ts` (new): copy, the category name check, price text, and grouping, order, reorder scopes and the hidden-reason precedence.
- `src/forms/Decision.tsx` (new): the shared stay-or-discard dialog. `src/tables/Tables.tsx` and `src/settings/Settings.tsx` drop their local copies and use it.
- `src/routes.ts`, `src/Rail.tsx`, `src/Screens.tsx`, `src/office.css`: the `menu` screen, the rail order Menu, Tables, Settings, the model made once per working-area key, and the ported Frost rules.
- `src/session/api.ts`, `src/session/fixtureSession.ts`: the `Exclude` of the catalog paths is removed, the eleven functions are in `configApi()`, and the eleven paths answer `unavailable` in fixture mode.
- Tests: `test/menu.test.tsx`, `menu-versions.test.tsx`, `menu-departure.test.tsx`, `menu-fixture.test.tsx`, `menu-group.test.ts`, `menu-name.test.ts`, `menu-money.test.ts`, `decision.test.ts`, with `menu-support.tsx` as their shared fixtures. Browser: `e2e/tests/menu.spec.ts`. No file under `e2e/support/`, `packages/`, `apps/server`, `db/` or `docs/` was touched. No formatter was run.

### What S4c2 needs

- **Where Edit and New item attach.** The item row's Actions cell in `Menu.tsx` is `<div className="office-actions">` and today holds only the Archive/Restore button (`data-item-state`). Edit goes in front of it. The category header's `office-actions` holds *Rename*, *Archive/Restore* and, for an active category, *Reorder items*; *New item* goes after *Reorder items*, and is absent in an archived category (the empty-category rows already say so). The *Empty category* row already names New item, as ruling 1 required.
- **Focus.** An item's state-command success and a failed or unknown item command focus `{ itemAction: id }`, which `Menu.tsx` resolves to `[data-item-state="id"]`. When Edit exists, change the resolver in `Menu.tsx` and the one `itemAction` case in `resultOf` in `model.ts` so it takes `[data-edit="id"]`, as DESIGN-019 says. Nothing else needs to move.
- **How the model would receive an item answered by BO-04.** `apply(applied)` in `model.ts` is private and takes `{ version, categories, items }`; an item answer is `{ version, categories: [], items: [item] }`. It upserts the item, keeps the applied-record map so an older read never undoes it, marks the list partial if the read stands failed, and advances the standing version only by the one-step rule. I did not add a public method because nothing calls it; S4c2 should add `receiveItem(item, version)` that calls `apply`, then sets the page result and focus.
- **The version an editor opened from BO-03 would carry.** `state.version`, the list's standing version at the moment the editor opens, read inside the opener's `leave` callback (see `openRename`). A BO-04 editor opened from this screen should do the same, and `null` means no editor can open (the opener is inert), exactly as the rename opener behaves.
- **The shared `Decision`.** `forms/Decision.tsx` takes `{ open, body, onStay, onDiscard }` and reads the session phase itself. The caller chooses the body. `Menu.tsx` shows the three bodies (ordinary, uncertain, and the two "continue" ones) by `state.continuing` and `model.guard.status()`.
- **Accessible names the browser spec drives.** Rail link *Menu*; heading *Menu*; `#menu-count`; buttons *New category*, *Reorder categories*, *Create*, *Save*, *Save order*, *Cancel*, *Keep my changes*, *Use current menu*, *Try again*; textbox *Category name*; dialogs *New category*, *Rename {name}*, *Reorder categories*, *Reorder items in {name}*; row controls *Rename category {name}*, *Archive category {name}*, *Restore category {name}*, *Reorder items in {name}*, *Archive item {name}*, *Restore item {name}*, *Move up {name}*, *Move down {name}*. Page status is `#page-status` and the form notice `#form-notice`; category headings are `#menu-rows h2`; item rows are `tr[data-item]`, category rows `tr[data-category]`, the price cell `td.num`.

### What was decided, and on what evidence

- **Disabled is `aria-disabled` + `tabIndex={-1}` everywhere**, including the end-of-list move controls and the reorder openers below two rows. BO-05 and BO-08 never use `disabled`, and the artifact's `disabled` on those controls is the review fixture's. Playwright's `toBeDisabled()` reads `aria-disabled`, so a browser assertion on "disabled" still holds. Every opener's model method also guards, so a press on an inert one sends nothing.
- **New category and Rename are inert when the standing version is `null`** (the first read failed, so there is no version to carry), and New category is inert when the read has failed and no answer was applied. This follows BO-05/BO-08 (`usable` gates the openers); the artifact keeps New category live in its error state. A command that succeeds while the read stands failed makes the list `partial`, in which New category is live and both reorder openers stay off.
- **A full read sets the standing version, except** when an answer adopted after that read began is ahead of what the read saw: then the answer's version stays. That is the version twin of the applied-record merge ("a read that began before a command was answered never undoes the answered record").
- **A session refusal of a form save** sets a form notice (*Nothing was saved. Your draft is kept. Press {Save/Create/Save order} to try again.*) and aims focus at the draft control. DESIGN-019 has the row; BO-05 and BO-08 draw none. The focus aim is needed: without it, the Saving notice's queued focus request fired after M-6 and landed on the new session notice instead of the draft (found by `menu-departure.test.tsx`, fixed in `model.ts`).
- **Success sentences for failure kinds** are one text each, not a title plus a body: DESIGN-019's table gives one sentence per row, and the tests compare to it exactly.
- **The category-restore and item-restore duplicate** are page results with `role="alert"` and focus on `#page-status`; the holder is derived in the view from the reread list (`holderOf` in `model.ts`) once the one reread has landed, so there is nothing to clear.
- **`NOT_FOUND` and `VALIDATION_FAILED`** are the definite failure of the command with one reread. Both are unreachable today: this client names only records it has read and sends only whole scopes.
- **Lengths count code points** (`[...name].length`); DESIGN-019's "UTF-16 units" sentence is not copied into any comment.

### Tests changed, and why

Only the tests the task lists, and every one gains the new entry without weakening:

- `config-api.test.tsx`: the runtime key list gains the eleven catalog paths, and a new type test names them (with a `@ts-expect-error` on a nonexistent one).
- `routes.test.ts`: the manifest is `landing, menu, settings, tables` and `PATHS.menu` is `/back-office/menu`.
- `sign-in.test.tsx`: two assertions about the rail (its text, hrefs and links) gain *Menu* first.
- `settings.test.tsx:51`: the rail's text `ConfigurationTablesSettings` becomes `ConfigurationMenuTablesSettings`. The task's list does not name this file, but it says any existing test that asserts the rail's entries gains Menu; this is the one I found beyond the listed ones, by running the suite.

BO-05's and BO-08's own tests (`tables*.test.tsx`, `methods*.test.tsx`, `settings*.test.tsx` apart from the one line above) and `e2e/tests/tables.spec.ts`, `settings.spec.ts` and `payment-methods.spec.ts` pass unedited, with the shared `Decision`.

### Red proofs

**Order of work, honestly.** Written red first, against absent code, and observed failing: `menu-name.test.ts`, `menu-money.test.ts` and `menu-group.test.ts` (modules missing); `decision.test.ts` (two definitions, in `settings/Settings.tsx` and `tables/Tables.tsx`); the edited `routes.test.ts`, `sign-in.test.tsx` and `config-api.test.tsx` (four failures: the manifest, the rail text, the links, the key list). Written **after** the code they cover, with each mutation applied afterwards: `menu.test.tsx`, `menu-versions.test.tsx`, `menu-departure.test.tsx` and `menu-fixture.test.tsx`, and `e2e/tests/menu.spec.ts`. Each mutation below was applied, its failure read, and the mutation reverted by reverse edit; the final tree has none (I ran the back-office suite and `npm run verify` after the last revert).

1. Menu last in the rail: `menu.test.tsx` "lists Menu, Tables and Settings in that order" failed (`'ConfigurationTablesSettingsMenu'` for `'ConfigurationMenuTablesSettings'`).
2. Tie-break by `a.name < b.name`: `menu.test.tsx` "draws the active categories first…" failed (`Item 10` before `Item 2`), and `menu-group.test.ts` "breaks a display-order tie by name, naturally" failed.
3. `Number(price).toLocaleString('id-ID')`: only `menu-money.test.ts` "money.ts calls no parseFloat, parseInt, Number(…" failed (`['Number(']`). The display test passes with it, because 99999999 is a safe double; the source test is the guard, as the task says.
4. Reorder categories live in the partial state: **the first test survived.** It archived Mains, which left one active category, so the opener was off for that reason anyway. I rewrote the test to use an item archive (two categories stay active, two items stay active in Mains), reran the mutation, and it failed at "Reorder categories is aria-disabled in the partial state".
5. `name.length` for `[...name].length`: `menu-name.test.ts` (32 emoji and "counts code points") and `menu.test.tsx` "accepts a name of 32 emoji locally" failed (`Use 32 characters or fewer.`).
6. `{ id }` instead of `{ categoryId }` on archive: `menu.test.tsx` "Archive category sends { categoryId }…" failed, though earlier than the body assertion: the client's own request schema refuses `{ id }`, so nothing was sent and the page showed the failure sentence instead of *Archiving Mains…*. The body assertion itself was not reached.
7. Reorder sends only the moved rows: **survived on Reorder categories**, because swapping two categories moves both. Applied to Reorder items instead (Burger stays put), `menu.test.tsx` "Reorder items sends the category, the version and the whole active scope" failed on the missing Burger id.
8. Always adopt the answered version: `menu-versions.test.tsx` "an answer that skips a version…" (7 for 5) and "a state command that skips a version…" (8 for 5) failed.
9. Remove the guard that keeps Save off before a choice: the two stale-rename tests failed (`CATEGORY_UPDATE` count 2 for 1).
10. Resend once after an unknown outcome: six tests of AC 10 failed with the command count 2.
11. Open the rename form on a category-restore refusal: "a refused category restore is a page result…" failed (the page result was gone).
12. Let *Archive category* bypass `leave`: **the first assertion was too weak.** The closed dialog is always in the DOM, so my body check saw `ORDINARY` and failed for the wrong reason. I added `expect(decision()).not.toBeNull()` before each body check; the rerun then failed four tests at "expected null not to be null".
13. Present while the session is away (drop `!gate` in `answered`): `menu-departure.test.tsx` "a command result arriving while M-6 is up is held…" failed (the page said *Main plates saved.* behind M-6).
14. A local `function Decision()` in `Tables.tsx`: `decision.test.ts` failed (`['forms/Decision.tsx', 'tables/Tables.tsx']`).
15. One function left out of `configApi()`: `config-api.test.tsx` failed (the key list lacked `items/restore`).

### What was left out on purpose (ruling 1)

86 and Make available (the controls, the `eightysix` and `available` states, the eight page-result states for them, and F7's availability-over-an-open-editor rule): S5. The Availability column shows each item's availability as text only. Edit and New item, BO-04 and the way between: S4c2. The kitchen-emergency sentences and the `kitchen` state, BO-01's held-draft sentence, and `leaserejected`: not built.

### What I found and did not fix

1. **A changed reorder scope has no designed way out, so I added a guard and one more e2e case; this needs a ruling.** If another write adds, archives or restores a record in the reorder's scope, the draft no longer matches the scope. The server would refuse the list (`VALIDATION_FAILED`). The client never sends it: `save()` compares the draft with the current scope first and, on a mismatch, shows the definite-failure notice (*Something went wrong. Nothing was saved. Your draft is kept. Press Save order to try again.*) without a request. The manager's only exit is Cancel, Discard and reopening. DESIGN-019 says a reorder never silently merges a changed scope but draws no copy for this case. **Proposed resolution:** a notice (new copy row) saying the order list changed, with *Use current menu* kept offered, or have Keep my changes rebuild only when the sets are equal and otherwise stay on the comparison. `e2e/tests/menu.spec.ts` M3 documents today's behaviour against the real database.
2. **The task's browser scenario (b) cannot work as written.** A `createCategory` made through the domain adds an *active* category, which changes the scope. After Keep my changes the client would have to send a list that is not the whole scope. M2 is the variant that keeps the scope: the other write is `createCategory` followed by `archiveCategory`, so the version advances by two and the active scope is unchanged; the stale notice, one reorder request, the unchanged database order, Keep my changes and the final save all hold. M3 is the literal `createCategory` case, ending at finding 1.
3. **Copy names controls that do not exist yet.** The item-restore duplicate sentence says *Rename this archived item in the item editor*, and the empty-category row says *Use New item*; both are DESIGN-019's words and stay as drawn until S4c2 adds Edit and New item, as ruling 1 allows for the second.
4. **The holder test uses the collator at `sensitivity: 'base'`** (ruling 11), which treats accents as equal, while the server's unique index is on `lower(name)`. After a DUPLICATE refusal the real holder always matches the collator, but an accent variant (*Cafe*, *Café*) could be marked too. Harmless today; worth one sentence if a ruling wants the exact rule.
5. **Try again after a failed read uses a visible read** (`load(true)`, as BO-05 does), so the list is replaced by *Loading menu…* for the moment of the retry, including above an open editor.
6. **Singular counts** read `1 categories · 1 items`, as drawn.
7. **Comments saying "UTF-16 units"** in `tables.ts`, `settings.ts` and DESIGN-019 itself are wrong (code points); left for the queued cleanup. `tables/label.ts` is untouched.

### Verify output

`npm run verify`: typecheck clean across server, money, contracts, api-client, pos, back-office and e2e; **133 test files, 4743 tests passed** (baseline 125 files, 4593 tests: +8 files, +150 tests). `npm run test:e2e:all`: **86 passed** in 1.0 minute, Chromium and WebKit (baseline 78: +8, four new cases in each engine). A browser was available and used. The back-office client project alone is 40 files, 966 tests.

### What the next agent needs and does not have

The lead's ruling on finding 1 (it decides S4c2's and S5's reorder copy too) and whether M3 stays as written. S4c2 needs nothing else from this slice; the attach points are above. I did not run a review pass, and nothing here is audited (owner Q11).

DONE

### Round 2 (finding 1, the lead's ruling of 2026-10-26)

Code commit `8220472` on `agent/phase1-s4c1`; the hash of this section's own commit is in `git log`.

**What changed**, all in `apps/back-office/src/menu/model.ts`:

1. **The client-side scope guard is removed** from `save()`, together with `scopeNow`, which only it used. A reorder now sends the draft and the server decides, as the ruling says: a draft built on an older scope carries an older `expectedVersion` and is refused `CATALOG_CHANGED` before the list is judged. The `editor.base === null` part of the guard is kept. It is **not reachable**: a reorder opens only on a non-null standing version (`openReorderCategories` and `openReorderItems` return when it is null), and `base` is only ever replaced by a version number. It stays so the type narrows to `number` for the request body, and the comment says so.
2. **Keep my changes on a reorder whose scope changed rebuilds the draft** against the reread scope (`keepMine`). The test for "changed" is whether the draft's ids and the reread scope's ids are the same set. If they are not: a draft that moved no row takes the current order; otherwise the draft's order for the records still in the scope comes first, followed by the records new to the scope in their current order, and records that left the scope drop out. The base moves to the reread version, the draft's baseline becomes the current order (so leaving still asks only if the merged draft differs from it), nothing is sent, and focus goes to Save order. When the scope did not change, and for a rename, Keep behaves exactly as before. An unknown outcome whose reread shows a newer version reaches the same `keepMine`, so it gets the same rule. No new copy: the stale notice, the comparison, the after-Keep notice and *Use current menu* are unchanged.

**New tests, and the red observed.**

- `menu-versions.test.tsx`, replacing the old "never sent as an incomplete scope" test (which asserted the fabricated failure): four cases under "Keep my changes on a reorder whose scope changed rebuilds the draft against the reread scope". Each opens *Reorder categories*, gets `CATALOG_CHANGED`, rereads, presses Keep, asserts the panel shows the rebuilt list and that Keep sent nothing, then presses *Save order* and asserts the one request carries exactly the rebuilt list with the reread version 6. The cases are: a category added to the scope (goes last); one archived out (drops out); one added and one archived at once; and a draft that moved nothing, which takes the current order (the added category sits between the two).
- **Red:** I restored the old Keep (base only, order untouched) by making the rebuild branch unreachable. All four failed at the rebuilt list (for example `['Drinks', 'Mains']` for `['Drinks', 'Mains', 'Extra']`, and `['Drinks', 'Mains']` for `['Mains']`), as the ruling predicted: the list that would have been sent is not the whole scope. Reverted; all 28 tests of the file pass.
- `e2e/tests/menu.spec.ts` M3 is now the real-database walk of the added case: the panel is open, a domain `createCategory` runs, *Save order* gets the stale notice with exactly one reorder request and the database order unchanged, *Keep my changes* shows the new category last (`1. Bravo`, `2. Alpha`, `3. Joined`) with still one request, *Save order* saves (two requests), and the database order equals the panel's. M2 is unchanged.

**Counts.** `npm run verify`: typecheck clean; **133 files, 4746 tests** (3 more than before: the old test became four). `npm run test:e2e:all`: **86 passed**, Chromium and WebKit. No existing test other than the replaced one was changed; no formatter was run.

**Still open.** Finding 3 to 7 of the first Handoff are as written there. Nothing new was found.

DONE
