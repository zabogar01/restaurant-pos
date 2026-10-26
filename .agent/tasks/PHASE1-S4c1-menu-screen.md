---
id: PHASE1-S4c1
title: BO-03 Menu in the back office — the grouped catalog list, categories, reorders, archive and restore, and the ConfigApi inclusion (plan S4c, DESIGN-019)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S4b]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/menu.spec.ts, e2e/support/**]
status: not-started
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

## Handoff

