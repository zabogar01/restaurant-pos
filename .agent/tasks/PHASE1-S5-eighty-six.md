---
id: PHASE1-S5
title: The 86 toggle — mark an item unavailable or available again, server command and BO-03 row action together (plan S5, C1 §3, DESIGN-019)
category: ui
touches: [boundaries]
depends_on: [PHASE1-S4c2b]
owns: [apps/server/src/domain/catalog.ts, apps/server/src/http/routes/back-office-catalog.ts, apps/server/test/**, packages/contracts/src/catalog.ts, packages/contracts/src/routes.ts, packages/contracts/test/**, packages/api-client/src/client.ts, packages/api-client/src/specs.ts, apps/back-office/src/**, apps/back-office/test/**, e2e/tests/menu.spec.ts, e2e/support/**]
status: not-started
cycles: 0
---
# PHASE1-S5 — The 86 toggle

**Written** 2026-10-28 by the lead, from slice S5 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S5 — The 86 toggle*: "One task, the command and
the row action together"). It draws on:
- **ADR-012** (accepted), rules 10, 13 and 14;
- consult **C1** §3 (`.agent/reviews/ARCH-018-c1-configuration-schema.md`, *S5 — the 86 toggle*), copied below;
- the server halves **PHASE1-S4a** (the catalog domain, `catalogWrite`) and **PHASE1-S4b** (the routes);
- the design **DESIGN-019** (BO-03's 86 action and its states, rounds 2 and 3);
- **PHASE1-S4c1**, which built BO-03 without 86 and left the attach point.

Where this file, those documents and the code differ, the rulings below say which wins. Where they still differ, stop
and write `BLOCKED: <question>`.

## Objective

A signed-in manager marks an item **86** (unavailable) or **available again** from its BO-03 row, at once, with no
form. The command carries no catalog version and is never refused stale. It writes `is_available` only when it
differs, and then advances the one catalog version by exactly one, which is what the POS will poll (S7). The page says
what happened in DESIGN-019's words. An 86 acts at once even while a rename or reorder holds unsaved changes, and keeps
that draft (DESIGN-019 round 2, F7). This closes the ROADMAP bullet *86 toggle* (FR-B6, FR-C5).

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **ADR-012**, `docs/decisions/ADR-012-versioned-configuration.md`, rules 10, 13 and 14 (`:272` to `:400`).
3. **Consult C1 §3**, `.agent/reviews/ARCH-018-c1-configuration-schema.md` `:414` to `:447`. It is copied below, but
   read it in place too.
4. **The server as built:** `apps/server/src/domain/catalog.ts` (`catalogWrite`, `UNVERSIONED`, `archiveItem`,
   `restoreItem`), `apps/server/src/http/routes/back-office-catalog.ts` (`items/archive`, `items/restore`),
   `packages/contracts/src/catalog.ts` and `routes.ts`, `packages/api-client/src/client.ts` and `specs.ts`, and their
   tests (`apps/server/test/catalog.test.ts`, which already has the lock-wait helpers `waitingBackends` and
   `untilWaiting`; `catalog-routes.test.ts`; `packages/contracts/test/catalog.test.ts`). **PHASE1-S4b's task file and
   Handoff**, `.agent/tasks/PHASE1-S4b-catalog-routes.md`: how a route is added, and the route-table, access and
   contract tests that pass through their data.
5. **DESIGN-019's Handoff**, `.agent/tasks/DESIGN-019-menu.md` from `## Handoff`:
   - the rules table rows *Item availability when archived* and *Availability over an open editor (round 2, F7)*;
   - *Exact copy and accessible names for S4c and S5*: the rows *Item / Availability*, *Item / Availability action*,
     *86 pending / available pending*, *86 saved*, *86 saved, hidden item*, *Available saved*, *Available, still
     archived*, *Unknown state command*, *Definite state failure*, *State session refusal*;
   - *Focus and command lifetime*;
   - the lead's round 2 rulings F2, F6 and F7 (`:270`, `:287`, `:290`).
6. **The Frost artifact**, `docs/design/visual-directions/frost/back-office/menu.html` with `menu.js` (the
   Availability cell, `:54`) and `menu-states.js` (the states `eightysix` and `available`). It is a review fixture.
7. **BO-03 as built:** `apps/back-office/src/menu/` (`model.ts`: `CommandKind`, `resultOf`, the item archive and
   restore path, `busy()`, `external`; `Menu.tsx`: the Availability cell; `copy.ts`), `session/api.ts`,
   `session/fixtureSession.ts`, and their tests. **PHASE1-S4c1's Handoff**, *What was decided*, and its ruling 1
   (what it left to S5).
8. The contract, for meaning only: PRD FR-B6, FR-C5, FR-C7, FR-G13, AC-29; BOUNDARIES B-17, B-20, B-24.

## Decided: do not reopen

- **ADR-012 (accepted).**
  - *Rule 10:* availability is a catalog write. Marking an item unavailable or available again advances the one
    catalog version by exactly one. A command that changes nothing (an item marked unavailable that already is) writes
    nothing and advances nothing.
  - *Rule 13:* an 86 and its reversal are **state commands**. They carry no version and are never refused
    `CATALOG_CHANGED`: "An 86 in particular is urgent, and must not be refused because a price was edited in another
    tab."
  - *Rule 14:* every catalog write takes `catalog_revision` `FOR UPDATE` first. That is what `catalogWrite` does.
- **C1 §3.1, verbatim:**
  > Two explicit commands, not a "set availability" with a requested value (ARCHITECTURE §4.4):
  >
  > | Command | Carries the version? | Refusals besides shape |
  > |---|---|---|
  > | `markItemUnavailable(id)` | No (ADR-012 rule 13) | unknown id per C2 |
  > | `markItemAvailable(id)` | No | unknown id per C2 |
  >
  > Each goes through `catalogWrite` with no expected version: it takes `catalog_revision` `FOR UPDATE` first, writes
  > `is_available` if it differs, and advances the version only then. An archived item may be marked either way; it is
  > not offered, and the flag is kept for when it is restored. No migration and no new table: S5 changes no grant.
- **C1 §3.1, for Phase 4, carried here verbatim as C1 requires:**
  > FR-G13's check (refuse an 86 of an item that is on a pending line of a quick-sale order holding an active
  > CheckoutLease, naming that order) is added inside this command **after** the `FOR UPDATE` it already takes, and
  > lease acquisition on a quick-sale order takes the same row `FOR SHARE` before the order and the lease. The lock
  > order is catalog, then business day, then dining table (a quick sale has none), then order, then lease (ADR-012
  > rule 14; ARCHITECTURE §8 as amended with C2's DiningTable sentence). Phase 4 adds a check; it does not move the
  > lock.

  **For this task:** build no lease check, and put nothing between the lock and the write that Phase 4 would have to
  move. One comment in `markItemUnavailable` names where FR-G13's check goes.
- **Owner, Q11:** nothing here is audited. **Q13:** the Phase 4 lease refusal (`leaserejected`) is not built.
- **DESIGN-019, accepted with the lead's rulings:**
  - 86 and Make available sit on every item row, archived items and items in archived categories included;
  - no confirmation and no form;
  - F2: an item that is hidden (archived, or in an archived category) gets the hidden sentence, never "disabled in
    place";
  - F6: the accessible names are *Mark {name} 86* and *Make available {name}*;
  - F7: they act at once over an open editor.
- **S4c1 and S4c2a/b, as merged:** BO-03's one command per screen; BO-04's outstanding save holds BO-03 (`external`);
  `receiveItem`; unknown outcomes reread and never resend; drafts across M-6 and BO-01.

## Lead rulings (2026-10-28)

1. **The domain.** Add `markItemUnavailable(itemId)` and `markItemAvailable(itemId)` to `catalog.ts`. Each goes
   through `catalogWrite(UNVERSIONED, …)`, as `archiveItem` does. It reads the item (`NOT_FOUND` if unknown), writes
   `is_available` only if it differs, and returns the item. The version advances only when a row was written, exactly
   as `archiveItem` signals a no-op. An archived item, or one in an archived category, may be marked either way.
2. **The routes.** `POST /api/back-office/config/catalog/items/mark-unavailable` and `…/items/mark-available`, each
   with body `{ itemId }` (strict) and answer `ItemResponse` (`{ version, item }`), added beside `items/archive` and
   `items/restore` with the same route declaration.
   - Add the requests to `@pos/contracts` as `MarkItemUnavailableRequest` and `MarkItemAvailableRequest`, beside
     `ArchiveItemRequest`.
   - Add the `ROUTE_TABLE` entries in `routes.ts`, and the `ROUTES` names `catalogItemsMarkUnavailable` and
     `catalogItemsMarkAvailable` with their `SPECS` in the api-client.
   - The refusals are S4b's: unknown id `NOT_FOUND` (404), a bad body `VALIDATION_FAILED` (400). No new error code. A
     no-op answers 200 with the current version and the item.
3. **The client API.** Add the two functions to `officeApi()` and `configApi()` in `session/api.ts`, and the two paths
   to `fixtureSession.ts` answering `unavailable`, as S4c1 did for the other eleven. Update `config-api.test.tsx`'s key
   list.
4. **The row control** (DESIGN-019 copy table, `menu.js:54`). The Availability cell keeps its text (*Available* /
   *86 · Unavailable*) and gains one button after it:
   - visible *86*, named *Mark {name} 86*, on an available item;
   - visible *Make available*, named *Make available {name}*, on an unavailable item;
   - `data-availability="{itemId}"`, a `button`, inert exactly when BO-03's other item state commands are (`busy()`,
     which includes BO-04's outstanding save);
   - present on every item row, archived or not, in an active or an archived category.
5. **The command and its results**, as S4c1's item archive and restore. Two new `CommandKind`s,
   `eighty-six-item` and `make-available-item`.
   - **Send at once** from the row with `{ itemId }`. The page status is focusable and shows *Marking {name} 86…* or
     *Making {name} available…*. Every opener is inert meanwhile, and a second press sends nothing.
   - **`ok`:** apply the answered item through `apply` (the applied-record map and the one-step version rule hold).
     Announce, and focus that item's Edit:
     - *86*, item offered: *{name} is now marked 86. At the POS it is disabled in place, not removed.*
     - *86*, item hidden (archived, or its category archived): *{name} is now marked 86. It stays hidden from the POS
       while it or its category is archived.*
     - *Make available*: *{name} is available again.*, with *It stays hidden from the POS while it or its category is
       archived.* appended when hidden.
     A no-op answer announces the same sentence: the state the manager asked for is the state the item is in.
   - **Unknown** (`failed`, `unavailable`): one reread, never a resend. Show *{name}: the outcome could not be
     confirmed. The menu has been refreshed. Nothing was sent again.*, or the *could not be refreshed* variant. Focus
     the page status.
   - **Definite failure** (`NOT_FOUND`, `VALIDATION_FAILED`, any other refusal): *Something went wrong. {name} was not
     changed. Use its row action to try again.*, with one reread, focused. Both refusals are unreachable today: say so
     in the Handoff.
   - **Session refusal:** after the same manager resumes, *{name} was not changed. Use its row action to try again.*
     Nothing is resent.
   - S2b's round 2 F2 and S4c1's round 3 F1 apply. A result finished behind M-6, BO-01 or an open decision is held,
     with its reread, and presented once on return.
6. **Over an open editor (F7).** *86* and *Make available* **do not** go through `leave`. They act at once while a
   rename or a reorder (dirty or clean) is open, keep the editor and its draft, and on success focus the item's Edit.
   - **The version.** When the answer is exactly the standing version plus one, the list's standing version advances.
     An open editor whose `base` equals the old standing version advances with it, so the draft does not go stale on
     its own page's 86. Otherwise the editor keeps its base, and its Save meets `CATALOG_CHANGED` as S4c1 built.
   - **Inert:** while a save of that draft is pending (one command per screen), or while BO-04's save is outstanding,
     86 and Make available are inert like every other opener.
   - **Archive and Restore** keep the departure decision with round 2's body, unchanged.
7. **Not built:** the Phase 4 lease refusal (`leaserejected`, the ORD-1048 sentence); the kitchen-emergency sentences.
   BO-04 is untouched: it shows availability as a fact, and its draft has no availability field. Any catalog write
   advances the one version, so an 86 made in another tab refuses a BO-04 edit `CATALOG_CHANGED`. That is ADR-012's
   deliberately coarse check, already built.
8. **Copy** goes in `menu/copy.ts`, each string traced to a DESIGN-019 copy-table row.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

**Server (C1 §3.2, the cases verbatim, in `apps/server/test/catalog.test.ts`):**

1. **S5-1.** Marking an available item unavailable writes `is_available = false` and advances the version by one;
   marking it available again advances it again. *Red:* skip the advance: the POS poll would never see the 86.
2. **S5-2.** Marking an unavailable item unavailable writes nothing and advances nothing. *Red:* advance
   unconditionally.
3. **S5-3.** An `editItem` built before an 86 of a different item is refused `CATALOG_CHANGED` afterwards:
   availability advances the one version (ADR-012 rule 10; ROADMAP Phase 1). *Red:* a separate availability counter:
   the edit is written.
4. **S5-4.** An 86 succeeds after other catalog edits the caller never read (it carries no version). *Red:* route it
   through a version check.
5. **S5-5.** The 86 waits for a shared holder:
   - the owner takes `catalog_revision` `FOR SHARE` in an open transaction;
   - the 86 is started and is seen waiting (`untilWaiting`);
   - the owner commits, and the 86 completes.
   This is the property Phase 2's add-line and Phase 4's lease acquisition will rely on. *Red:* take the holder's lock
   as `FOR KEY SHARE`: the 86 does not wait, which is the hazard ADR-012 rule 14 names.
6. **S5-6.** Marking an archived item unavailable succeeds and advances the version. *Red:* refuse it.
7. **Unknown id** is `NOT_FOUND` for both commands, and nothing advances. *Red:* create a row instead.
8. **The routes** (`catalog-routes.test.ts`):
   - each needs a back-office session (401 without);
   - each refuses an extra key or a missing `itemId` with 400 `VALIDATION_FAILED`;
   - each answers `{ version, item }` with `isAvailable` as asked;
   - a no-op answers 200 with an unchanged version;
   - an unknown id is 404.
   The route-table, access and contract tests pass through their data, unedited. *Red:* declare one route
   `OPTIONAL`: the 401 case fails.

**Client (BO-03):**

9. **The control** (ruling 4). Each item row has exactly one availability button, with the visible label and
   accessible name for its state. It is present on archived items and items in archived categories. `menu.test.tsx`'s
   test *has no 86 or Make available control yet (S5)* becomes the assertion of these names, not weakened. *Red:* omit
   the control on archived items: that test fails.
10. **86 and Make available** (ruling 5). Each sends exactly one request with `{ itemId }` to its path, shows the
    pending sentence focused, applies the answer, announces the right sentence (offered, hidden by item, hidden by
    category, no-op), and focuses the item's Edit. *Red:* announce "disabled in place" for a hidden item (F2): that
    test fails.
11. **Unknown, failure, session** (ruling 5). One reread and never a resend, with each copy; held behind M-6 and
    presented once. *Red:* resend once after `failed`: the command count is 2.
12. **F7** (ruling 6):
    - 86 with a dirty rename open acts at once, with no decision, keeps the draft, and focuses Edit. A following Save
      carries the advanced base and is accepted.
    - An 86 whose answer skips a version leaves the editor's base, and Save meets `CATALOG_CHANGED`.
    - 86 is inert while the draft's save is pending, and while BO-04's save is outstanding.
    - Archive with a dirty rename still opens the decision.
    *Red:* route 86 through `leave`: the first case fails, because the decision opens.
13. **`ConfigApi`** (ruling 3). The key list and the type test include the two paths. Fixture mode answers
    `unavailable`. *Red:* leave one out of `configApi()`: the key-list test fails.
14. **In the browser** (`e2e/tests/menu.spec.ts`, both engines, the harness's rules; add a case, edit none). An item
    made through `createItem`. The manager presses *Mark {name} 86*: the page says it, the row reads *86 ·
    Unavailable*, and `readCatalog` shows `isAvailable: false` with the version one higher. *Make available {name}*
    reverses it. Exactly one request per press. Assert changes, not absolute counts.
15. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**; an edit to an existing helper's behaviour is a
  change to every spec: stop and ask. No migration, no grant, no change to `docs/` or `db/`.
- Red first, per criterion: write the test, run it against the unchanged code and record the failing assertion; then
  write the code. If you write a test after its code, say which tests and still apply and report each mutation. A
  criterion is accepted only with an observed red.
- Every visible word comes from DESIGN-019's copy table, and every style value from the Frost registry. Buttons and
  openers that are inert use `aria-disabled` and `tabIndex={-1}`, never `disabled`, as BO-03's other row actions do.
  Every model method guards, so a press on an inert button sends nothing.
- Browser-test rules, as S4c1's file states them: people through the harness's domain functions with random
  credentials; requests made by the page; assertions on state, accessible names and codes; no screenshots or
  artefacts committed; sign-ins through the existing helpers; the credential scan as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Use only the shell commands your role allows. Make edits with the file tools, not with `sed`, `python3`, heredocs or
  `cat >>`. S4c2b's builder used these, and an unattended run would refuse them.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- `apps/back-office/test/menu.test.tsx:110`, *has no 86 or Make available control yet (S5)*: it flips to assert the
  controls (criterion 9), renamed accordingly.
- `apps/back-office/test/config-api.test.tsx`: the key list and type test gain the two paths.
- Any BO-03 test that asserts an item row's exact list of controls, which now includes the availability button. List
  each change in the Handoff.
- New cases in `apps/server/test/catalog.test.ts`, `catalog-routes.test.ts`, `packages/contracts/test/catalog.test.ts`,
  and new BO-03 tests (for example `menu-availability.test.tsx`); one new case in `e2e/tests/menu.spec.ts`.
- **Nothing else should change.** `route-table.test.ts`, `access.test.ts` and `packages/contracts/test/routes.test.ts`
  pass through their data unedited, as in S4b. BO-04's tests and the other specs pass unedited. A change anywhere else
  is reported in the Handoff with its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `cf685d1` (#149 and #150 merged; the code is S4c2b's final tree, `3fd82db`). The lead's runs of that
tree: `npm run verify` 141 files, 5181 tests; `npm run test:e2e:all` 98 passed. Confirm the baseline before you start,
and state the new counts in the Handoff. Run `npm run test:e2e:all` yourself after your last mutation is reverted.

## Out of scope

- FR-G13's lease check and the `leaserejected` state (Phase 4). The POS's reading of availability (S7, consult C4).
- Any change to BO-04. Timed or scheduled availability. Audit (Q11).
- The code-point cleanup of older comments (queued).

## Commit and report

Commit on `agent/phase1-s5` only, after verify is green, and never push. Use Conventional Commits, explaining why;
more than one commit is fine if it reads better. Write the Handoff below in full prose:
- what was done (paths, commits);
- what was decided and on what evidence;
- tests changed and why;
- each red proof (mutation, failure read, reverted), and which tests were written after their code;
- what was found and not fixed;
- **what S7 needs**: the version the 86 advances, how a no-op answers, and where the POS would read `isAvailable`;
- the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff

*(The builder writes this section.)*
