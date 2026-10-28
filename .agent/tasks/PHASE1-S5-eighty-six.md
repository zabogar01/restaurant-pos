---
id: PHASE1-S5
title: The 86 toggle — mark an item unavailable or available again, server command and BO-03 row action together (plan S5, C1 §3, DESIGN-019)
category: ui
touches: [boundaries]
depends_on: [PHASE1-S4c2b]
owns: [apps/server/src/domain/catalog.ts, apps/server/src/http/routes/back-office-catalog.ts, apps/server/test/**, packages/contracts/src/catalog.ts, packages/contracts/src/index.ts, packages/contracts/src/routes.ts, packages/contracts/test/**, packages/api-client/src/client.ts, packages/api-client/src/specs.ts, apps/back-office/src/**, apps/back-office/test/**, e2e/tests/menu.spec.ts, e2e/support/**]
status: active
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

## Lead ruling on the BLOCKED question (2026-10-28)

**Yes.** `packages/contracts/src/index.ts` is added to `owns`. Ruling 2 put the two request schemas in `@pos/contracts`,
and that package re-exports its catalog schemas by name from `index.ts`, as S4b did. Leaving the file out of `owns` was
the lead's omission. The staged change is exactly the two names `MarkItemAvailableRequest` and
`MarkItemUnavailableRequest`, which the lead read. This commit widens `owns` and nothing else.

**What to do.**
- Commit the staged work on this branch, now that the hook allows the path.
- Replace the Handoff's final `BLOCKED:` line with `DONE`, and add a sentence saying the commit followed this ruling.
- Ping the lead.

No other change is wanted.

## Lead verify (2026-10-28)

At `9c67317`, in this worktree:
- **`npm run verify`:** typecheck clean; **142 files, 5223 tests**.
- **`npm run test:e2e:all`:** **100 passed** (1.3 minutes), Chromium and WebKit.

**Paths and tests.**
- Every changed path is inside `owns`, as widened by the ruling above.
- The changed existing tests are `menu.test.tsx:110`, `config-api.test.tsx` and `catalog-routes.test.ts` test 1. All
  three are listed or anticipated, and each now asserts more than before.
- `item.test.tsx` AC 18 is the anticipated "exact list of controls" case. The row now begins with *Mark {name} 86*,
  and the Edit-before-Archive order is still asserted.

**Read by the lead.** `setItemAvailable` follows C1 §3.1:
- it goes through `catalogWrite(UNVERSIONED, …)`;
- an unknown id is `NOT_FOUND`;
- it writes only when the flag differs;
- the FR-G13 comment sits after the lock and before the write.

**The S5-5 red.** C1's suggested mutation (the holder taking `FOR KEY SHARE`) cannot fail the test: the writer's `FOR
UPDATE` still conflicts with `FOR KEY SHARE`. The builder's substitute, weakening the writer's own lock in
`catalogWrite` to `FOR KEY SHARE`, is the mutation that shows ADR-012 rule 14's hazard, and both cases failed under it.
The lead accepts it. C1's red line for S5-5 is noted as imprecise; it is not edited, because it is the architect's
document.

**Not checked by the lead:** BO-03's look with the new control. The owner looks before merge.

## Round 2 — the review's F1 (lead ruling, 2026-10-28)

Codex reviewed `01d9621` (`.agent/reviews/PHASE1-S5-review.md`) and found one P2. **It is accepted.**

**The defect.** `EditorPanel` (`Menu.tsx:531`) disables the name input and makes Save inert only on `pendingSave`, that
is, a command belonging to this editor. An availability command over an open editor has `editorKey: null`, so while it
is pending:
- the name input takes focus but `setDraft` discards the typing;
- Save and Save order look live but `save` sends nothing.

The one-command rule (ruling 5) is right. The controls simply do not show it. The artifact disables both controls for
any pending command (`menu.js:74`, `:76`).

**The fix.**
1. In `EditorPanel`, the controls follow the screen's busy state. The name input and every move control are inert
   while **any** command is pending or BO-04's save is outstanding: `command !== null || state.external`, or
   `model.busy()` if that is what the view already reads. Save and Save order are inert on the same condition.
2. Keep `pendingSave` for what is the editor's own: the *Saving…* notice and its focus.
3. The patterns, as already ruled:
   - the name input uses native `disabled`, as BO-03's field already does while its own save is pending (the S4c2b
     round 2 F3 ruling: fields use `disabled`);
   - Save, Save order and the move controls use `aria-disabled` and `tabIndex={-1}`.
4. When the availability answer lands, the controls come back, the draft is unchanged, and the editor's base follows
   ruling 6.

**Tests** (`menu-availability.test.tsx`; add, edit none):
- **A rename under a held 86:** the input is disabled and Save is `aria-disabled` with `tabIndex` -1. After the answer,
  both are live, the draft is unchanged, and a Save sends once.
- **A reorder of items under a held Make available:** Save order and the move controls are inert, then live after the
  answer. Pressing Save order while the command is held sends nothing.
- **BO-04's outstanding save** (`external`) with a rename open: the same controls are inert.

**Red:** restore `pendingSave` as the condition. The rename and reorder cases fail.

**What to do.** Fix it and add the tests, weakening no assertion. Run `npm run verify` and `npm run test:e2e:all` after
the last mutation is reverted. Commit on this branch. Append a *Round 2* section to the Handoff: what changed, the red
observed, and the new counts. End it `DONE` or `BLOCKED: <question>`, then ping the lead. Use only the file tools for
edits.

## Handoff

**Status: the slice is built and verified in the working tree, but it is not committed, because the pre-commit guard
refuses one path the task does not list.** Details under *Blocked* below.

### What I did

Server (red first, then code):
- `apps/server/src/domain/catalog.ts`: `markItemUnavailable(itemId)` and `markItemAvailable(itemId)`, both over one
  private `setItemAvailable` that goes through `catalogWrite(UNVERSIONED, …)` as `setItemActive` does. It reads the item
  (`NOT_FOUND` through `refuse` if unknown), returns `wrote: false` with the current record when the flag already
  matches, and otherwise updates `menu_item.is_available` and returns `wrote: true`, so the version advances exactly
  once and only then. One comment names where FR-G13's lease check goes in Phase 4 (after the lock, before the write);
  nothing is built there and nothing sits between the lock and the write.
- `apps/server/src/http/routes/back-office-catalog.ts`: `POST …/items/mark-unavailable` and `…/items/mark-available`,
  strict `{ itemId }`, answer `ItemResponse`, declared with the same `command` access object as `items/archive`.
- `packages/contracts/src/catalog.ts`: `MarkItemUnavailableRequest` and `MarkItemAvailableRequest`;
  `packages/contracts/src/routes.ts`: the two `ROUTE_TABLE` entries (interactive); `packages/contracts/src/index.ts`:
  their re-export (see *Blocked*).
- `packages/api-client/src/client.ts` (`ROUTES.catalogItemsMarkUnavailable` / `catalogItemsMarkAvailable`) and
  `specs.ts` (`SPECS` entries).

Client:
- `apps/back-office/src/session/api.ts` (both in `officeApi()` and `configApi()`) and `fixtureSession.ts` (both answer
  `unavailable`).
- `apps/back-office/src/menu/copy.ts`: `EIGHTY_SIX`, `MAKE_AVAILABLE`, `eightySixName`, `makeAvailableName`,
  `eightySixing`, `makingAvailable`, `eightySixed(name, hidden)`, `availableAgain(name, hidden)`; each is a row of
  DESIGN-019's copy table. The unknown, failed and session sentences reuse S4c1's `stateUnknown`, `stateUnknownUnread`,
  `stateFailed` and `stateSessionRefused`, which are the same table rows.
- `apps/back-office/src/menu/model.ts`: two `CommandKind`s, `eighty-six-item` and `make-available-item`; a new
  `changeItemAvailability(itemId)` (public, and it does **not** go through `leave`); page statuses `eighty-sixed` and
  `made-available` (with `hidden`) and two new `pending` actions; `resultOf` cases that focus the item's Edit; and
  `carryBase`, which moves an open editor's `base` with the list when the answer is exactly the standing version plus
  one and the editor's `base` was that standing version.
- `apps/back-office/src/menu/Menu.tsx`: the `<button type="button" className="office-button small"
  data-availability="{itemId}">` after the Availability text, labelled *86* or *Make available*, named *Mark {name} 86*
  or *Make available {name}*, `aria-disabled` and `tabIndex={-1}` when `busy`, on every item row.

### What I decided, and on what evidence

- **Hidden means archived item or archived category.** The 86 and Make available sentences use
  `item.isActive === false || category.isActive === false` (ruling 5 and DESIGN-019 F2). Archive/Restore's existing
  `hidden` only checks the category, because its own sentence already says the item is archived.
- **No `state.decision` ambiguity:** `changeItemAvailability` also returns when `state.decision` is open, so a press
  while the modal is up (which jsdom cannot make inert) sends nothing.
- **`carryBase` is limited to the two availability kinds.** Archive and Restore keep going through `leave`, so an open
  editor never reaches their answer. It reads the standing version at present time, not at send time, so a reread that
  moved the standing version between press and answer is judged on the version actually standing.
- **A no-op answer (version equal) announces the same sentence**, and `adopt` leaves the standing version where it is.
- **Fixture mode** answers `unavailable`, as S4c1 did for the other eleven.

### Tests I changed, and why

- `apps/back-office/test/menu.test.tsx`, *has no 86 or Make available control yet (S5)…*: flipped to the assertion of
  the seven names in drawn order plus one `[data-availability]` button per item row, its visible label, accessible name,
  and no `aria-disabled`/`disabled` while idle. The Edit/New item list is unchanged. Renamed *has one availability
  control on every item row, archived and hidden ones included, beside Edit and New item*.
- `apps/back-office/test/config-api.test.tsx`: key list and type test gain the two paths; the title says *thirteen*.
- `apps/back-office/test/item.test.tsx` (BO-04's file, **one assertion, outside the task's list**): AC 18, *Edit goes in
  front of Archive/Restore on every item…*, asserts each item row's exact `button` list. The availability button sits in
  the Availability cell ahead of the Actions cell, so `['Edit Burger', 'Archive item Burger']` became `['Mark Burger 86',
  'Edit Burger', 'Archive item Burger']`, and the same for Apple and Stew. This is the "any test that asserts an item
  row's exact list of controls" the task anticipates, but it lives in BO-04's file, so I name it here. Nothing was
  loosened: the order Edit-before-Archive is still asserted.
- `apps/server/test/catalog-routes.test.ts`, test 1 (*are the eleven of the route table*): it lists the route table's
  catalog entries verbatim; it now lists the two new paths after `items/restore`. The describe name still says
  "eleven routes"; I did not rename it. `route-table.test.ts`, `access.test.ts` and `packages/contracts/test/routes.test.ts`
  are unedited and pass.
- Additions only elsewhere: `catalog.test.ts` (a `describe('the 86 commands')` with S5-1 to S5-6 and NOT_FOUND, and the
  two 86 commands added to the existing no-audit test), `catalog-routes.test.ts` (a `describe('the 86 routes')`, and the
  two routes added to the no-audit test), `packages/contracts/test/catalog.test.ts` (accept, strict, malformed),
  `menu-support.tsx` (`ITEM_86`, `ITEM_AVAILABLE`), a new `menu-availability.test.tsx` (22 cases), and `e2e/tests/menu.spec.ts`
  case M5. `e2e/support/**` is untouched.

### Red proofs (mutation, failure read, reverted)

Written test first, observed red, then code: all server cases, the route cases, the flipped `menu.test.tsx` control test
(received `[]`), and `menu-availability.test.tsx` (20 of 22 red before the code; the other two, the fixture-mode case and
*Archive with a dirty rename still opens the decision*, already held, because I had added the fixture paths first and
Archive was unchanged).

Mutations, each reverted:
1. **S5-1** (skip the advance, `wrote: false` after the update): S5-1, S5-3, S5-4, S5-5 and S5-6 fail on `UNCHANGED`
   where `OK` was expected, and the "answers the item as stored" case.
2. **S5-2** (advance on a no-op, `wrote: true`): only S5-2 fails, `OK` 279 where `UNCHANGED` 278 was expected.
3. **S5-5.** The task's mutation (the holder takes `FOR KEY SHARE`) cannot show the hazard: `FOR UPDATE` conflicts with
   `FOR KEY SHARE`, so the 86 still waits. The hazard is on the writer's side, so I weakened the writer's own lock in
   `catalogWrite` to `FOR KEY SHARE`, which does not conflict with the holder's `FOR SHARE`. Both S5-5 cases fail: the
   86 was not waiting on the lock statement (it waited on the later `UPDATE catalog_revision`). Reverted.
4. **S5-6** (refuse an archived item) and **unknown id** (create a row instead of `NOT_FOUND`, applied together): S5-6
   fails (`NOT_FOUND` where `OK` was expected); both unknown-id cases fail. My "create a row" mutation was crude: it
   raised a database fault (`The catalog store failed`) rather than inserting a row, so that test proved the
   `NOT_FOUND` expectation, not row creation specifically.
5. **Routes** (declare `mark-unavailable` `OPTIONAL`): the 401 case in test 3 and my own 401 case fail with 200.
6. **Control** (omit the control on archived items): the flipped `menu.test.tsx` test, `every item row carries the
   control` and the two hidden-item sentence cases fail.
7. **F2** (always say "disabled in place"): the F2 case fails. It first looked masked by mutation 6 when I applied both
   together, so I re-ran it alone.
8. **Resend after `failed`** (a second request when the first is `failed`): three unknown-outcome cases fail with
   `ITEM_86` count 2.
9. **Route 86 through `leave`**: all four F7 cases fail (the decision opens; the editor closes).
10. **`carryBase` disabled**: *a following Save carries the advanced base* fails (`expectedVersion` 5, expected 6).
11. **Leave one path out of `configApi()`**: the key-list test fails with the 24 keys of 25.
12. **e2e M5** (written after its code): skip the advance on the server; M5 fails on both engines (`version` 2, expected 3).

Tests written after their code: the `packages/contracts` additions, `menu-availability.test.tsx`'s fixture-mode case,
and e2e M5. The contracts additions have no mutation of their own (the route tests would fail on a lax schema because the
extra-key case reaches the schema).

### Found and not fixed

- **`NOT_FOUND` and `VALIDATION_FAILED` from these two routes are unreachable today:** the button is built from a listed
  item and sends a uuid, so the model's definite-failure path for them is covered only by a test that injects the
  refusal.
- The "answers the item as stored" test in `catalog.test.ts` builds its failure message with `JSON.stringify` over a record
  holding `bigint`, so a failure would throw `Do not know how to serialize a BigInt` instead of showing the outcome. It
  only matters when it fails (the existing `ok` helper has the same pattern with a record). I saw it during mutation 1.
- `catalog-routes.test.ts`'s `describe('the eleven routes')` and `config-api.test.tsx`'s older titles still say
  "eleven" in places I did not need to edit.

### Blocked

**BLOCKED: `packages/contracts/src/index.ts` is not in this task's `owns`, and the pre-commit guard refuses it.** The
task says to add the requests to `@pos/contracts`, and lists `packages/contracts/src/catalog.ts` and `routes.ts`, but
the server route, the api-client specs and the tests import them from `@pos/contracts`, which only exposes what
`index.ts` re-exports. The only change I made there is two names in the existing `export { … } from './catalog.js'` block
(`MarkItemAvailableRequest`, `MarkItemUnavailableRequest`, alphabetically after `ItemsResponse`). Proposed resolution:
add `packages/contracts/src/index.ts` to this task's `owns:` (S4b's task must have had it) and resume this session,
or tell me to commit with it excluded (the commit would then not typecheck). Nothing else is blocked. The working tree
holds the complete, verified change. All of it, `index.ts` included, is staged by path; the one `git commit` I tried
was refused by the guard and nothing was committed. Once the path is allowed the commit is a single `git commit`.

### Verification, with the real output

`npm run verify` on the final tree (after the last mutation was reverted): typecheck clean across all seven projects,
`Test Files 142 passed (142)`, `Tests 5223 passed (5223)` (baseline 141 files and 5181 tests, so +1 file, +42 tests).
`npm run test:e2e:all` on the same tree: `100 passed (1.3m)` (baseline 98; M5 on both engines).
`npm run db:up` was already up; the development database `pos` was not touched. No formatter was run. No browser was
driven beyond the Playwright suite.

### What S7 needs

- **The version.** An 86 or its reversal advances the one `catalog_revision.version` by exactly one, and only when it
  changed `is_available`. The answer's `version` is the new version.
- **A no-op** answers 200 with `{ version, item }` where `version` is the unchanged current version and the item is as
  stored. The route answer does not say whether it wrote; a client reads "unchanged" from a version equal to the one it
  stood at.
- **Where the POS would read `isAvailable`:** every `ItemView` carries `isAvailable` (and `isActive`); the only read
  today is the back-office `GET /api/back-office/config/catalog`, which returns archived records too. S7's POS read is
  its own route (consult C4) and must hide an item that is archived or in an archived category regardless of the flag,
  and show an `isAvailable: false` item disabled in place.
- The lease refusal (FR-G13, Phase 4) goes in `setItemAvailable` after the lock and before the write.

### What the next agent needs and does not have

The lead's decision on `packages/contracts/src/index.ts`. Everything else is in the tree.

The lead ruled `packages/contracts/src/index.ts` into owns, and the staged work is now committed as 9c67317 on `agent/phase1-s5` with no further change.

DONE
