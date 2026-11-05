---
id: PHASE1-S7b1
title: The served POS menu — the catalog store, the poll, the two menu sources and the grid (plan S7, consult C4)
category: ui
touches: [boundaries, money]
depends_on: [PHASE1-S7a, DESIGN-021]
owns: [apps/pos/src/catalog/**, apps/pos/src/session/source.ts, apps/pos/src/session/realSession.ts, apps/pos/src/session/types.ts, apps/pos/src/session/api.ts, apps/pos/src/session/useSession.tsx, apps/pos/src/App.tsx, apps/pos/src/PosRoutes.tsx, apps/pos/src/MenuRegion.tsx, apps/pos/src/menuFixtures.ts, apps/pos/src/sheetFixtures.ts, apps/pos/src/orderFixtures.ts, apps/pos/src/orderStore.ts, apps/pos/src/OrderPanel.tsx, apps/pos/src/Sheets.tsx, apps/pos/src/pos.css, apps/pos/test/**, e2e/tests/pos-catalog.spec.ts, e2e/tests/idle.spec.ts, e2e/support/**]
status: complete
cycles: 1
---
# PHASE1-S7b1 — The served POS menu

**Written** 2026-11-03 by the lead. Sources:
- slice S7 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S7*,
  `:348-367`, and the Definition of Done's S7 lines);
- **consult C4** (`.agent/reviews/ARCH-021-pos-catalog.md`), decisions 3 to 6 and 10 and *For the lead*, *S7b1*,
  copied below where they bind;
- **DESIGN-021** (`.agent/tasks/DESIGN-021-pos-catalog-states.md`, its Handoff, and lead ruling R1), the reviewed
  served states in `docs/design/visual-directions/frost/pos/order.html` (`?state=served…`), and `docs/DESIGN.md`
  *DESIGN-021 additions — served POS catalog* (`D:2097-2166`);
- **PHASE1-S7a** (merged, #165): the two routes, and its Handoff's *What S7b1 needs*;
- ADR-011 rules 1, 20, 21, 23, 24, 27 and 28; ADR-012 rules 10 to 12; ARCHITECTURE §4.3.

S7 is split into S7a (the server, merged) and **S7b1** (this), **S7b2** (M-2 for a served item, Add, the sheet between
polls) and **S7b3** (the POS preset picker). Where this file and C4 or DESIGN-021 differ, this file wins. Where this
file and an accepted ADR differ, or the code cannot do what this file says, stop and write `BLOCKED: <question>`.

**The owner holds this slice's PR until S7b2 is ready** (DECISIONS 2026-11-02: "the served POS is never merged with
menu tiles that open nothing"). So in this slice an available served tile opens nothing in served mode; that is
expected, not a defect. Do not build M-2 for served items here.

## Objective

In a served build the POS reads its menu from the server, keeps it current by a two-second poll, and draws POS-03's
menu region from it: the categories, the tiles with their prices and 86 state, and DESIGN-021's four catalog states
(loading, first read failed, empty catalog, possibly out of date). Fixture mode keeps today's fixture menu, through the
same screen code. The fixture menu leaves served bundles (B-24). An 86 made in the back office reaches the POS tile in
three seconds or less, proved in a browser (AC-12's grid half).

Nothing is written to the server. The order stays the client stand-in. The floor stays fixture (Q14).

## Decided: do not reopen

- **Owner:** Q13 (no Phase 1 POS command carries the catalog version); Q14 (a cashier may add a real item to the
  stand-in, which S7b2 builds); C4 OQ1 yes (real presets in the picker, S7b3; this slice carries `presets` in the held
  object and draws no picker); S7b1's PR held for S7b2.
- **The routes** (S7a): `GET /api/pos/catalog/revision` answers `{ version }`; `GET /api/pos/catalog/menu` answers
  `{ version, categories, items, presets }`; both `ACTIVE`, POS, not interactive. `ROUTES.posCatalogRevision`,
  `ROUTES.posCatalogMenu`; `PosApi` keys `'/api/pos/catalog/revision'` and `'/api/pos/catalog/menu'`, no argument,
  already declared and unused. Items are one flat array, grouped by category in the categories' order; options and
  presets are in order. There is no `isActive` and no `displayOrder`. Money and rates are canonical strings: decode
  with `decodeMoney` / `decodeRate`, never `Number()`. Refusals and session ends arrive as for `me`.
- **What reaches the POS** (C4 *For DESIGN-021* 1): an archived category and everything in it, an archived item, a
  removed option and a deactivated preset are absent; the POS cannot tell "archived" from "never existed". An 86'd item
  stays on the grid, disabled in place with its price. A category with no active items stays in the rail, selectable,
  with an empty grid. **Only an 86 is in place**: an archive, restore, new item or reorder reflows at the next refresh.
  The rail's selection follows the category's id; if the selected category disappears the selection moves to the first,
  with no notice; a fresh mount starts on the first category.

## C4's decisions, copied (items 3, 4, 5, 6, 10)

### The poll (C4 item 3)

A store with no React, `apps/pos/src/catalog/catalogStore.ts`, modelled on `realSession.ts`, with its timer injected.
It sits above the routes, as the session store does, and is handed **exactly the two read functions**, so it has no way
to reach `activity` (FR-A2b).

**One cycle at a time.** A cycle reads the revision, and if the answer differs from the held version, or no menu is
held, reads the menu. With no menu held it goes straight to the menu read. The next cycle is timed two seconds after
the previous one settles, so cycles cannot overlap. A refresh requested during a cycle joins that cycle.

| Condition | The poll |
|---|---|
| Signed in, on any POS screen | **Runs.** Not only on POS-03: a quick sale's close on POS-04 reads availability too |
| Under POS-01, for any reason | **Stopped**, with no request. An answer settling after the stop is dropped by an epoch that advances on every stop and start |
| A sign-in | **Starts with an immediate cycle.** The held menu stays on screen meanwhile. It is not person-specific, so another cashier's sign-in does not drop it |
| Tab hidden | **Paused**, resuming with an immediate cycle on `visibilitychange` to visible |
| Window `focus` with the tab visible | An immediate cycle (ARCHITECTURE §4.3) |
| One failed check | Nothing visible. Next cycle on schedule |
| Two in a row | *Possibly out of date*, or stays at *First read failed* if nothing is held. Cleared by the first check that leaves the client current |
| Session-ending answer | Nothing of the store's own: the core ends the session and tells `realSession.ts` |

**No backoff.** **A menu already shown stays usable while refreshes fail.** The store treats `refused`, `failed`,
`unavailable`, `invalid-request` and `session-gone` alike as "not a check that succeeded"; it reads no code and needs
no entry in `meaningOf`. A poll's 2xx moves no deadline (the routes have no session spec and are not interactive); a
fault goes only to the health read; a GET carries no anti-CSRF token. **Do not merge by version** as BO-03 does
(FE-037): the POS has one read at a time and no commands, so the store adopts whatever a read answers, even a lower
number (a restored database).

### The version the POS keeps (C4 item 10)

The store holds `{ version, categories, items, presets }` as **one immutable object, replaced whole**, in
`apps/pos/src/catalog/`. The screen renders from the current object. **No line or order carries the version**, and no
parameter is added for it now. *Never* expose the revision the poll last saw as the held version: it can be newer than
the contents on screen (ADR-012 rule 11).

### Menu sources under rule 23 (C4 item 5)

**One more use of the one constant.** `session/source.ts` is the only module that names the fixture catalog, as it
already is for the session: `createCatalogStore` picks the fixture store or the real one, and a `FixtureMenuFacts`-style
export is `null` in a build, as `FixtureLockPictures` is. `import.meta.env.DEV` is not the switch.

**One screen path, two sources.** Both stores give the screen the same client shape, with money already decoded by
`decodeMoney` at the one point the wire enters. The fixture store makes no request and starts no timer. `MenuRegion`
and the sheets read the store and do not know which it is. **No fallback in either direction**: an empty served
catalog is empty, and a served failure is a failure, never the fixture menu (B-24).

The split, which is the bulk of the work and must not move behaviour:

| Now | Becomes |
|---|---|
| `MENU_CATEGORIES`, `MENU_ITEMS`, `MENU_FIXTURES`, `itemDestination`, item-sheet fixtures | A fixture-only module, reached only through `source.ts`, holding the marker |
| `LOCK_NOTICE`, `REJECTED_NOTICE`, `LOADING_LABEL`, the types | A plain module, kept in the bundle |
| `originFacts(view).lock` and `.incident` | Stay, read from `ORDER_FIXTURES`: they are the order stand-ins'. `.menu` goes behind the source |
| `priceOf(itemId)` in `orderStore.ts` | Gone **in S7b2** (`NewLine` carries the base price). In this slice, keep the fixture path's pricing working through the source; do not change `NewLine` |
| `sheetFixtures.ts` | The line-editor stand-in (`panelLine`, `SHEET_FIXTURES`' line states) stays. The item sheets move out |
| `CategoryId`, a union of four literals | `string` |

`MenuFixture.lock` is set and no longer read (`MenuRegion` takes the lock from `originFacts`): drop it in the split.
Reword the comment at `orderFixtures.ts:37`, which names `MENU_ITEMS`, and `session/source.ts`'s comment, which
describes two things behind the switch.

**The bundle marker (B-24).** Export `FIXTURE_MENU_MARKER` from the fixture-only module and add it to `FIXTURE_ONLY` in
`apps/pos/test/built-session-support.ts`, which already builds twice, plainly and with `NODE_ENV=development`. Add one
or two option names the fixture sheets use and no fixture order does (confirm by search, for example `Chilli mayo`).
**Item names cannot be needles:** "Burger" and "Steak" are in `ORDER_FIXTURES`, which stays. The fixture module holds
only data and pure functions, so Rollup can drop it; **the marker test is the proof, not the reasoning.**

**Fixture orders beside a served menu.** A line is a snapshot. A fixture line's `itemId` is a slug such as `steak`, a
served item's a UUID, so a fixture line never matches the served unavailable list and `holdsUnavailable` needs no
change. **`OrderLine.itemId` stays optional and is not made a guarantee.** Nothing may look a line up in the catalog;
names are never compared.

**Availability for fire and close.** `fire` and `close` read the unavailable list from the catalog store **at the
press**, replacing `menu.eightySixed`. It is a stand-in's presentation of FR-E4; Phase 3's fire is the control. (The
plural refusal copy is S7b2's.)

### POS-03's `?state=` pictures (C4 item 6)

In a served build `?state=` keeps its job as the order stand-in's routing (`go`, `?gone=`, the floor's openers). It
stops choosing anything about the menu.

| Picture | Fixture mode | Served build |
|---|---|---|
| `eightysix`, `fireblocked`, `fireblocked-overflow`, `sheet-item86` | Stays: the fixture store reports the 86 | The order is drawn as today, and availability is the catalog's. A fixture Steak does not block |
| `loading`, `catalog`, `error`, `pressed` | Stays | No effect on the menu |
| `sheet-item`, `sheet-item-<id>` | Stays | Opens no sheet |
| Every other order-panel state | Stays | Unchanged |

**The gate.** `OrderPanel.tsx:357`'s state list is gated by `import.meta.env.DEV`; move that one gate to the constant.
The floor, settlement and closed-order gates (`FloorScreen.tsx:309`, `SettlementScreen.tsx:1010`,
`ClosedOrderScreen.tsx:207`, `ClosedOrdersScreen.tsx:167`) stay as they are, for Phase 2. ADR-011's *Not decided
here* needs no change: this does what its second clause asks, one screen earlier.

### The three-second proof (C4 item 4, steps 1 to 5 and 7; step 6 is S7b2's)

A new `e2e/tests/pos-catalog.spec.ts`: `twoProfiles`, the back office in one and the POS in the other. No real waits
(rule 27), and requests only by the page.

1. Build the menu through the back office's own screens, and sign in at both. `pos.clock.install()` comes before the
   POS's first `goto`.
2. With the tiles drawn, **pause the POS's clock** and wait until the POS has no catalog request outstanding, from the
   profile's own request and reply lists.
3. Mark the item 86 from its BO-03 row, and await its page status. **Assert the POS tile is still enabled**, which
   proves the change can only arrive by the poll.
4. `pos.clock.runFor(2000)`. Then `expect` the tile's `aria-disabled` with Playwright's ordinary retry. **Page time
   spent: 2000 ms, against a budget of 3000.**
5. Assert in place: the tile order and its bounding box are unchanged (AC-12's no reflow), it carries the tag named by
   `aria-describedby`, and a press opens no sheet. Then the reversal, the same way.
7. **Focus refresh:** with the clock still paused, make a change and dispatch `focus` on the window. The tile changes
   with no page time spent.

**The first 2xx body read in the page:** `pos.evaluate(() => fetch('/api/pos/catalog/menu').then((r) => r.json()))`.
Assert that its `version` equals the version read through the domain, and that an item archived in the test is absent.
The harness keeps reading only error bodies (`fixtures.ts:127`), so nothing changes there.

**Polling extends nothing, in a browser:** one case in `idle.spec.ts`. Let polls run, age the session past the limit
with both clocks, and assert the tab locks, with no `activity` sent.

Assertions are on state, accessible names and `data-item`, never copy (rule 27). The scan runs as usual. **Neither
page may be `hidden` in either engine**, or the poll pauses: confirm it in Chromium and WebKit; it is the first thing
to look at if the poll seems not to run.

**`idle.spec.ts` B6 and B8 will otherwise flake:** a poll and the deadline read now race for the verdict, so
`lastCodeOf(POS_ME)` may be null or `UNAUTHENTICATED`, and a poll may be in flight at `fastForward`, against rule 27.
They assert the code from either route and quiet the poll first. A helper in `e2e/support/` pauses, waits for no
outstanding catalog request, and resumes. **Ask the librarian to confirm `clock.resume`'s and `pauseAt`'s behaviour**
(`.agent/bin/ask.sh librarian "<question>"`) for the installed Playwright, and say in the Handoff what it answered. C4
notes the documentation and the 1.64.1 source disagree on whether the page clock flows after `install()`; the design
pauses explicitly, so it does not depend on the answer, but you must see the steps run.

## DESIGN-021's rules that bind this slice

Copied from its Handoff (*Rules S7b can test*, 1 to 6, and R1). The words are DESIGN-021's; copy them exactly from its
copy table (ADR-011 rule 24), and invent none.

1. **The menu is a whole served projection**, in server order. Active empty categories remain selectable, with "No
   items in this category yet." No POS copy claims to know that an absent item was archived. Category selection
   follows its id; losing that id selects the first category silently.
2. **Empty catalog means no categories.** It offers no non-working menu control, no retry and no link to the back
   office. The order panel remains. On an empty order, Discount, Void order and Settle stay in place, focusable and
   inert under ruling C-1 (never absent). "No items on this order yet." when no menu is held, including a successful
   empty read; a held menu uses "Add an item first." A table retains its inert Send; a counter never has Send. An
   existing order keeps its existing actions even when the menu read is empty, loading or failed.
3. **Loading is the first read only.** No new timer, countdown or promised duration (C4 D2: up to 20 seconds when the
   request and its health probe both time out). One unsuccessful first read enters failure, with the shared general
   failure's two variants (*The system is unavailable* for `unavailable`, *Something went wrong* otherwise), both with
   *Try again*. Poll retries continue every two seconds without replacing failure with loading; only an explicit *Try
   again* may show loading, and it repeats only the read.
4. **A held menu stays usable.** One failed check is silent; two consecutive failed checks show the quiet out-of-date
   notice; only a check that leaves the client current clears it. Returning after a session lock uses the held menu and
   checks immediately; the lock drawings remain the authority while locked.
5. **86 and restoration hold the slot exactly.** The price remains legible; unavailable tiles are grey, dashed, marked
   86, focusable and guarded by `aria-disabled` (never native `disabled` on a tile). A whole accepted update uses one
   polite "Menu availability updated." status, not one per tile; no change means no announcement. A focused tile keeps
   focus. The status occupies the menu's bottom edge in a fixed 72px band, **reserved even when empty and always in the
   accessibility tree**. The availability status stays until the next changed projection, the out-of-date warning, or
   leaving POS-03; unchanged polls keep it. Showing or clearing either status cannot resize the grid or shift its
   end-of-scroll tiles.
6. **Projection changes reflow.** An absent item is removed at refresh with no placeholder or announcement. New,
   restored and reordered items use the current projection. Prices update on the tile without a badge or notice.
   Lines already in the order keep their snapshots; an archived pending item is not marked or fire-blocked.
7. **R1, long tile names.** The 150×96 tile is kept; a name wraps and is ellipsized after two lines (clamped by lines,
   not characters); type does not shrink; the tile does not reflow; the full name is the tile's accessible name. **The
   price line is never truncated, wrapped away or pushed out of the tile**, at the longest name and the largest price
   together. A served category row's 72px is a minimum; it grows for a wrapped name (`D:2099`).

**Copy for this slice** (DESIGN-021's copy table; exact): *LOADING MENU*; *The system is unavailable* / *Wait a moment,
then try again.*; *Something went wrong* / *Try again. If the problem continues, ask a manager for help.*; *Try again*
(`served-retry`); *No menu items yet* / *There is nothing to add yet. A manager adds the menu in the back office.*;
*No items yet* / *Add an item when the menu is available.*; *Add an item first.* and *No items on this order yet.*
(`served-action-reason`); *No items in this category yet.*; *The menu may be out of date. You can keep taking orders.*
and *Menu availability updated.* (`served-status`, polite); tile accessible names `{full item name}, {base price}` and
`{full item name}, {base price}, unavailable, 86`; the category rail button `{category name}` with `aria-pressed`.

**Focus** (DESIGN-021, *Focus and keyboard rules*, round 2): a failure moves focus to *Try again* only if focus is on
the body or on a control removed by that read; otherwise focus stays. If a focused read control disappears when the
read succeeds (by poll or by *Try again*), focus moves to the first category, or to the empty-catalog message if there
is none. A user working in a persistent order control keeps it. A poll changing a price, name or availability keeps
focus where it was. A removed focused tile goes to its selected category; if that category also disappears, to the
first category.

## Acceptance criteria, each with its red proof

Write each test first, run it against the unchanged code, and record the failing assertion; then the code. Each *Red*
is a mutation you apply, observe failing for the stated reason, revert, and report. C4's numbers are in brackets.

1. **[1]** Served: tiles, order, categories and prices come from the store. A money field is decoded once, at the wire.
   *Red:* hard-code a category.
2. **[2] B-24:** `FIXTURE_MENU_MARKER` and the option-name needles are absent from both builds. *Red:* import the
   fixture module from `MenuRegion.tsx`.
3. **[3]** The poll never runs while signed out, runs on the floor and on POS-04, pauses when hidden, and runs one cycle
   at a time. Fake timer, stub API. *Red:* `setInterval`: two cycles overlap under a held response.
4. **[4]** `activity` cannot be reached by the store: it is given two functions, and the existing source scan stays
   green. *Red:* pass the whole API: type-level, and the scan is extended to hold it.
5. **[5]** Focus and becoming visible run a cycle at once; a sign-in does too. *Red:* remove a listener.
6. **[6]** One failed check shows nothing; two show *Possibly out of date*; the grid stays usable; a good check clears
   it. *Red:* threshold 1, or disable tiles.
7. **[7]** First read failed: entered on one failure, left by a later good read without a press and by *Try again*;
   background retries do not flicker; the two failure variants follow the core's classification. *Red:* set loading on
   every retry.
8. **[8]** Empty catalog is not an error, and shows no fixture; DESIGN-021 rule 2's inert actions and reasons. *Red:*
   fall back to fixtures.
9. **[9]** A cycle's result arriving after a lock changes nothing. *Red:* remove the epoch.
10. **[10]** A new version and its contents appear together; the held version is never the poll's last revision. *Red:*
    set the version before the read.
11. **[11] AC-12's grid, on the served path:** an 86'd tile keeps its slot, greys, carries the tag, and cannot be
    selected; restoration re-enables the same element. The fixture-path tests move to the served path, with a fixture
    twin where the fixture behaviour must also hold. *Red:* filter 86'd items out.
12. **[12]** Archived or removed items leave at the next refresh; the selection follows its id; a vanished category
    falls to the first. *Red:* select by index.
13. **DESIGN-021 rule 5's status band:** reserved when empty, in the accessibility tree, one announcement per accepted
    change, kept across unchanged polls, cleared as the rule says; the grid's height does not change when it shows or
    clears. *Red:* render the band only when it has text.
14. **R1:** at the longest name and the largest price together, the price line's box lies inside the tile's box in a
    served render, and the accessible name is the full name. *Red:* drop the two-line clamp.
15. **Focus**, as copied above: the failure rule, the removed-control rule and the removed-tile rule, each in a test.
    *Red:* always focus *Try again* on failure.
16. **[16]** `?state=` in served mode follows item 6's table; the `OrderPanel.tsx:357` gate is the constant. *Red:*
    leave the gate: `built-session-development` finds the list's marker in the bundle.
17. **Fire and close read availability at the press** from the catalog store: a served pending line whose item is 86'd
    blocks fire with the existing refusal, and restoring the item clears it; a fixture line `itemId: 'steak'` beside a
    served 86'd item named Steak does not block. *Red:* compare by name.
18. **[13] The three-second proof**, steps 1 to 5 and 7, both engines. *Red:* interval 3500.
19. **[14]** The body read in the page. *Red:* answer an archived item.
20. **[15]** Polling extends nothing in a browser. *Red:* mark the revision route interactive.
21. `idle.spec.ts` B6 and B8 pass reliably with the poll running: run them five times in each engine and report it.
22. `npm run verify` green, with counts. The lead runs `npm run test:e2e:all` before review and before merge; run it too
    and report it.

## Tests expected to change

- `apps/pos/test/built-session-support.ts` (the needles).
- These import the fixture modules and move their imports; their assertions must not change meaning:
  `menu-region.test.tsx`, `menu-categories.test.tsx`, `tile-for.ts`, `own-items.test.tsx`, `sheets.test.tsx`,
  `fire.test.tsx`, `one-press-fire.test.tsx`, `quick-sale.test.tsx`, `order-store.test.tsx`, `void-apply.test.tsx`,
  `discount-apply.test.tsx` (a grep of `menuFixtures|sheetFixtures` under `apps/pos/test` on `22be697`). If
  `discount.test.tsx` or `discount-change.test.ts` must change, say why. A served-mode render helper is new.
- `no-invented-values.test.ts` reads top-level `src` files only: extend it to `src/catalog`.
- `e2e/tests/idle.spec.ts` B6 and B8, as above. New: `e2e/tests/pos-catalog.spec.ts` and new tests under
  `apps/pos/test/`.
- Review the other POS browser tests that move a clock or count requests by path (C4 found none in `identity`,
  `premises`, `audience` or `scan` that should change meaning). **Nothing else should change.** A change anywhere else
  is reported with its reason; a weakened assertion is not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- **Buttons and openers** that turn off in served mode use `aria-disabled` and the off class, never native `disabled`
  (DESIGN-021 round 2, F3); fields are not in this slice.
- Fixtures in tests build served menus through a stub of the two read functions; browser tests build the catalog
  through the back office's screens or routes, never by insertion.
- Server tests need `npm run db:up`; the browser suite needs `npm run build:clients` (it builds them itself through
  `test:e2e`). No migration in this slice.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `22be697` (S7a #165 and the lead's #166 merged). The lead's last run, of S7a's final tree: `npm run
verify` 151 files, 5497 tests; `npm run test:e2e:all` 108 passed. Confirm the baseline before you start and state the
new counts in the Handoff.

## Out of scope

- M-2 for a served item, Add into the stand-in, `NewLine`'s snapshot, D1's ceilings, the open sheet between polls, the
  plural fire refusal (S7b2). The preset picker (S7b3). Any server change. The floor, tables, settlement and
  closed-order gates.

## Commit and report

Commit on `agent/phase1-s7b1` only, after verify is green, and never push. Conventional Commits, explaining why; commit
the split (no behaviour change) separately from the served path, so a reviewer can read it alone. Write the Handoff
below in full prose:
- what was done (paths, commits);
- **what S7b2 needs**: the catalog store's shape and how a sheet reads the live item; the source switch; where
  `priceOf` still lives; the served-mode render helper for tests;
- the librarian's answer on `clock.resume` and `pauseAt`;
- what was decided and on what evidence; tests changed and why; each red proof (mutation, failure read, reverted);
- what was found and not fixed; the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verify (2026-11-03)

Run by the lead in this worktree at `c277c57`, the tree clean, for the reviewer, who cannot reach the database or a
browser (evidence in `../restaurant-pos-wt/evidence/PHASE1-S7b1/`):

- `npm run verify`: **153 test files, 5612 tests, all passed** (baseline 151 / 5497), the builder's count confirmed.
- `npm run test:e2e:all`: **118 passed** (Chromium and WebKit; baseline 108): the four `pos-catalog` cases and B9 in
  each engine are the new ten.
- `git diff --name-only development...HEAD`: every path is inside `owns`. The existing tests changed are
  `built-session-support.ts`, `fire.test.tsx`, `menu-categories.test.tsx`, `menu-region.test.tsx`,
  `no-invented-values.test.ts`, `one-press-fire.test.tsx`, `own-items.test.tsx`, `sheets.test.tsx` and
  `e2e/tests/idle.spec.ts`, all on *Tests expected to change*.
- The Handoff was read whole. **For the reviewer to judge:**
  1. Commit `0285a34` (the split, "no behaviour change") raised the suite from 5497 to 5501 tests without a test file's
     cases being edited by hand; the builder did not find which enumeration grew. Find it, and say whether a case now
     enumerated differently has changed meaning.
  2. The tile markup changed for **both** sources (the name clamp and the price foot), and every tile gained an
     `aria-label`; the builder says every existing assertion still holds.
  3. The status band and the empty-order reason are drawn only when `store.kind === 'real'`, the one place the region
     branches on source rather than data.
  4. `SessionStore.catalogReads` is optional only because `fixtureSession.ts` was outside `owns`.
  5. Criterion 4's red was proved by the source scan, not by compiling the whole `PosApi` into the store.
  6. The hidden-tab pause is proved in jsdom only; neither engine hides a page in the harness.

## Round 2 (lead rulings, 2026-11-04), from the review

The review is `.agent/reviews/PHASE1-S7b1-review.md` (Codex, at `d9dd898`): verdict *findings*, three. The reviewer
reproduced 1 and 2 in jsdom; 3 is read from the CSS. **All three are accepted.** Fix them in this order, each test
first and red against the current code, committing as you go. Change nothing the review cleared. This is round 2 of at
most three.

1. **F1, a completed retry steals focus.** The pending refocus after *Try again* applies only while focus is still lost
   (on the body, or on the control the read removed). If the cashier has focused a surviving control in the meantime (an
   order line, an order action, an open sheet or dialog), the fallback is cancelled and focus stays there. Add the
   held-response test the review describes: press *Try again*, hold the read, focus an `.order-line__target`, deliver the
   menu, and assert focus is still on the line; and the existing lost-focus case still lands on the first category (or
   the empty-catalog message). *Red:* the current code moves focus to the category.
2. **F2, the availability announcement outlives a changed projection.** DESIGN-021 rule 5 (`D:2112`): the announcement
   ends at the **next changed projection**, the out-of-date warning, or leaving POS-03; an unchanged poll keeps it. Key
   its lifetime to the adoption of a changed projection as well as to availability changes: a newly adopted projection
   that changes anything clears the old announcement, unless that projection itself changes availability, which
   announces again. Tests: an 86 then a price-only change (cleared); an 86 then an archive (cleared); an 86 then an empty
   projection (cleared, beside the empty-catalog message); an 86 then an unchanged poll (kept). *Red:* the current code
   keeps it on the price-only change.
3. **F3, the band's place in the no-grid states.** The 72px band sits at the menu's bottom edge whatever body is drawn:
   loading, both first-read failures, the empty catalog and a populated grid. Anchor it independently of the body (an
   automatic top margin, or one growing content region). Extend `pos-catalog.spec.ts` (or a new browser case) to assert
   the band's bottom equals the menu region's bottom and its height is 72 in those states, in both engines; the jsdom
   test cannot measure it. *Red:* remove the anchor: the band's bottom is above the region's.
4. **The lead's open point, not a finding:** commit `0285a34` raised the suite from 5497 to 5501 tests with no test
   file edited by hand. The lead traces it (it needs an older checkout) and records the answer below this list; act on
   it only if it says a case has changed meaning.

**Item 4, answered by the lead.** `npx vitest list --project client` on `development` (`22be697`) and on this branch,
compared with the two new test files left out: `money-display.test.ts` ("POS source never converts to a double")
enumerates one case per POS source file, and commit `0285a34` added four files under `src/catalog/` (`types.ts`,
`fixtureCatalog.ts`, `useCatalog.tsx`, `menuCopy.ts`): those are the four. Commit `8142562`'s `catalogStore.ts` adds
a fifth, and `no-invented-values.test.ts`'s extension to `src/catalog` adds four cases per file. The only other
differences are the two built-bundle case 27 titles, renamed with the new needles. No existing case changed meaning;
nothing to do.

Then update the Handoff in place (mark round 2), with the new `verify` and `test:e2e:all` counts, and report done. The
lead reviews the round against these rulings; there is no second full review unless a fix goes beyond them.

## Round 2 lead review and acceptance (2026-11-04)

At `6c06d2f`, the tree clean. Three fix commits (`19203a4` F1, `acfca73` F2, `9b87ee9` F3) and the Handoff (`6c06d2f`);
every path inside `owns`. The fixes are the review's own as ruled, so the lead reviews the round instead of a second
full review.

- **Against the rulings, from `git diff dd8bf02..HEAD`:** F1, `MenuRegion`'s refocus effect returns when
  `document.activeElement` is anything but the body, so a surviving control keeps focus, and two tests cover the held
  retry with an order line focused and the still-lost case. F2, the announcement state remembers the adopted menu
  object, so a newly adopted projection clears it unless the availability counter moved too, and an unchanged poll
  (no new object) keeps it; five tests. F3, `margin-top: auto` on `.menu-status`, with browser cases P5 to P7 and a P1
  addition asserting a 72px band whose bottom meets `.order-screen__menu`'s in the empty, loading, both failure and
  populated states, in both engines.
- **The lead's red proof:** F2's change reverted in `MenuRegion.tsx` (`availability.menu !== menu ||` removed);
  `served-menu.test.tsx` failed three ("a price-only change clears it", "an archive clears it", "an empty projection
  clears it, beside the empty-catalog message"; 3 failed, 62 passed); restored with `git checkout --`, tree clean.
- **The lead's runs at `6c06d2f`** (evidence `../restaurant-pos-wt/evidence/PHASE1-S7b1/verify-r2.txt`,
  `e2e-all-r2.txt`): `npm run verify` **153 files, 5619 tests passed**; `npm run test:e2e:all` **124 passed**.

**Accepted.** PHASE1-S7b1 is complete. Its PR is held for S7b2 (DECISIONS 2026-11-02); S7b2 is cut from this branch.

## Handoff

**Builder's report, PHASE1-S7b1.** Two commits on `agent/phase1-s7b1`, nothing pushed, no formatter run (I did not run Prettier; every file was edited by hand, matching its neighbours). No browser was missing: Chromium and WebKit are installed and the Docker database was up, so every browser claim below was run, not reasoned.

### What I did

**Commit `0285a34`, the split (no behaviour change in fixture mode).** The fixture menu, its `?state=` pictures, its item sheets and the price lookup are now reached only through `session/source.ts`, behind the one constant `__FIXTURE_SESSION__`.
- New plain module `apps/pos/src/catalog/menuCopy.ts` (kept in every bundle): `LOCK_NOTICE`, `CATALOG_NOTICE`, `REJECTED_NOTICE`, `LOADING_LABEL`, the `LockNotice` type, and, added in the second commit, DESIGN-021's served copy.
- New `catalog/types.ts` (the client shape both sources give a screen), `catalog/fixtureCatalog.ts` (the fixture store: no request, no timer; plus `fixtureMenuFacts`), `catalog/useCatalog.tsx` (`CatalogProvider`, `useCatalogStore`, `useCatalog(view)`, `unavailableAt(store, view)`).
- `menuFixtures.ts` is now fixture-only data and pure functions, and exports `FIXTURE_MENU_MARKER`. The item-sheet fixtures moved into it from `sheetFixtures.ts`, which keeps the types, the quantity bounds, `unitPrice`, the two line-editor fixtures and `panelLine`. `originFacts` moved to `orderFixtures.ts` and now returns only `{ incident, lock }`; `menuFixtureFor(view)` replaced its `.menu`. `MenuFixture.lock` is gone. `CategoryId` is `string`. The comment at `orderFixtures.ts:37` and `source.ts`'s are reworded.
- `source.ts` exports `createCatalogStore(reads?)`, `FixtureMenu` (the `FixtureMenuFacts`, `null` in a build) and `FIXTURE_ORDER_STATES` (the constant POS-03's list of fixture states now reads; `OrderPanel.tsx:357`'s `import.meta.env.DEV` is gone).
- Between the two commits a build held an empty catalog, never the fixture menu; I wrote it that way so the intermediate commit is honest under B-24.
- Bundle test: `built-session-support.ts` gained the marker, `Chilli mayo`, `Garlic mayo` (confirmed by search to appear in no fixture order) and `pos-03-order-states`, a `data-fixture-list` attribute I added to the list's `<nav>`, because the generic `Fixture states` label appears in five other screens whose `DEV` gates stay.
- Rollup kept the item-sheet tables (a top-level `g(...)` call retains its string arguments), so the first build failed the new needle. I made the tables lazy (`itemSheetFixtures()`, `itemSheetStates()` build on first read); the marker test is the proof, as the task said it would have to be.

**Commit `8142562`, the served path.**
- `catalog/catalogStore.ts`: `createRealCatalog(reads, { setTimer, isVisible })`, no React, handed exactly `{ revision, menu }`. One cycle at a time (an `inFlight` token tagged with the epoch, so a dead cycle never blocks a new start); the next timed 2000 ms after the previous settles (`POLL_MS`); the epoch advances on every start and stop and is checked after each read inside a cycle; `visibilitychange` pauses and resumes, `focus` with the tab visible refreshes, `start()` (a sign-in) refreshes at once; no backoff; every non-`ok` result is alike "not a check that succeeded" and no code is read; `retry()` shows loading only when nothing is held; whatever a read answers is adopted whole, even a lower number; money and rates are decoded by `decodeMoney`/`decodeRate` once, in `toMenu`; a body that does not decode is a failed check.
- `SessionStore` gained an optional `catalogReads` (set by `realSession.ts` from `posApi`, absent on the fixture session, which I do not own); `useCatalogStore()` builds the served store from the session store's reads, one per session store, and `PosRoutes.tsx` starts it while signed in, so it runs on every POS screen and stops under POS-01.
- `MenuRegion.tsx` is data-driven from the store and draws DESIGN-021's states: loading, first read failed (both variants, *Try again*, `data-action="served-retry"`), empty catalog (`#menu-empty-catalog`, no control), empty category, the 72px status band, 86 held in place, the focus rules, selection by id. `OrderPanel.tsx` draws the no-menu empty-order words and the inert four's reason line. `orderStore.ts` reads the unavailable list from the catalog store at the press in `fire` and `close`. `pos.css` gained the clamp, the foot row, the scrolling grid and rail, the band and the empty block.
- New tests: `catalog-store.test.tsx` (32), `served-menu.test.tsx` (58), `served-harness.tsx`; `no-invented-values.test.ts` now reads `src/catalog` too. Browser: `e2e/tests/pos-catalog.spec.ts` (P1 to P4), `e2e/support/catalog.ts`, and B6, B8 and a new B9 in `idle.spec.ts`.

### What S7b2 needs

- **The store's shape.** `CatalogStore` (`catalog/types.ts`): `kind`, `getSnapshot()`, `subscribe`, `start()`, `retry()`. A snapshot is `{ menu, read, failure, outOfDate, availabilityChanges }`; `menu` is `{ version, categories, items, presets }`, one immutable object replaced whole. An item is `{ id, categoryId, name, price: Money, available, variants: {id,name,delta}[], modifiers: {id,name,delta}[] }`; presets carry `value: { kind: 'PERCENTAGE', rate } | { kind: 'FIXED', amount }`. **A sheet reads the live item** with `const { snapshot } = useCatalog(view)` and `snapshot.menu?.items.find((i) => i.id === itemId)`; an item absent from the projection is "no longer on the menu" (the archived-while-open case needs the last-known details kept in the sheet's own state, since the store holds only the current object). The version a sheet may keep is `snapshot.menu.version`; nothing else carries it (Q13).
- **The source switch.** `session/source.ts`: `createCatalogStore`, `FixtureMenu` (null in a build; has `pictureFor`, `eightySixedFor`, `itemDestination`, `itemSheet`, `priceOf`), `FIXTURE_ORDER_STATES`. `useCatalog(view)` returns `{ store, snapshot, picture, unavailable, destinationOf, itemSheetFor }`. `destinationOf` is `null` for a served menu, which is why a served tile opens nothing; S7b2 replaces that single `if (!off && destinationOf)` in `Tile` (`MenuRegion.tsx`) with its sheet opener.
- **Where `priceOf` still lives:** `orderStore.ts`, a small function that calls `FixtureMenu.priceOf` and throws when there is none (as it threw for an unknown item before). `NewLine` is unchanged. It goes when `NewLine` carries the base price.
- **The served-mode render helper for tests:** `apps/pos/test/served-harness.tsx`. `makeCatalogHarness(firstMenu)` builds the real store over stubbed reads with a manual timer and a visibility switch (`revision(...)`, `menu(...)`, `hold()`, `advance(ms)`, `settle()`, `count()`, `setVisible()`); `mountServed(h, view)` renders the order screen under `CatalogProvider`, started as POS signs in; `menuOf`, `ok`, `FAILED`, `UNAVAILABLE`, `NASI`, `SATE`, `TEA` build bodies. Under vitest `__FIXTURE_SESSION__` is undefined, so the fixture session and pictures stay available beside a served store, which is how the `?state=` table is tested.
- **The poll and an open sheet.** The store is above the routes and keeps polling while a sheet is open; a sheet re-renders from `useCatalog`'s snapshot. The band is outside the sheet and is not duplicated.

### What I decided, and on what evidence

- **`aria-pressed` and `aria-current` on the rail.** DESIGN-021's copy table says the rail button carries `aria-pressed`; existing assertions in `menu-region.test.tsx` and `menu-categories.test.tsx` read `aria-current` and the task says their meaning may not change. I emit both. If you would rather drop `aria-current`, those assertions need a ruling.
- **The tile markup changed for both sources.** The reviewed served artifact puts the name on two clamped lines and the price with its tag on the bottom line (`frost-served-catalog.css`). Keeping the old fixture tile beside it would have been two layouts for one component, so the fixture tile now has `.menu-tile__name` and `.menu-tile__foot` too, and the 86 tag sits beside the price instead of after the name. Every existing assertion (`.menu-tile__price`, `.tag-86`, `aria-describedby` equal to the tag's id, classes) still holds. Every tile now has an `aria-label` (`{name}, {price}` and `, unavailable, 86`).
- **The status band and the empty-order reason are drawn only when the store is the server's** (`store.kind === 'real'`). A hard-coded `['menu-notice', 'menu-grid']` children assertion in `menu-region.test.tsx` and FE-024's "the screen draws no reason here" for an empty fixture order would otherwise have changed meaning. This is the one place the region differs by source rather than by data; it is `store.kind`, not a build test.
- **`pausePoll` instead of leaving the clock paused for the whole test.** Playwright's click waits for animation frames, which a paused clock does not deliver, and `idle.spec.ts`'s `settle()` waits on a page `setTimeout`. So `P1` presses with `{ force: true }`, and the paused POS cases use a message-channel `turn()`. `pausePoll` pauses at the page's own time plus 500 ms (the runner's `Date.now()` is behind a page whose clock has been moved).
- **Waiting for the back office.** BO-03's status line can still hold the last action's words (the name of the item just created), so `mark86`, `makeAvailable` and `archiveAtOffice` wait for the server's answer to the one request they send. My first version awaited the status text and let P2 pass or fail by timing; I found it by printing the version the revision read returned (3, the old one).
- **A defect the first store tests found:** `check()` carried on to the menu read after a stop, because the epoch was only checked once the whole check returned. A late revision answer after a lock would have sent a menu request. Fixed; it is covered by "drops a revision answer that settles after the stop".
- **The librarian's answer on `clock.resume` and `pauseAt`** (asked with `ask.sh librarian`): after `install()` with no time the clock runs in real time (the guide says "let the page load naturally"); `pauseAt(time)` jumps the clock forward to `time` and pauses, and nothing fires until `runFor`, `fastForward`, `pauseAt` or `resume`; `resume()` lets time flow again; `runFor(n)` advances and fires all callbacks; `fastForward(n)` jumps and fires each due timer at most once. The v1.64 source auto-installs on any clock call, so `pauseAt` does not need `install()` first, though the docs say it must. The answer could not confirm whether `runFor` flushes promises between timers. I did not depend on it: each case pauses explicitly and I watched the steps run (P1 passes with the tile still enabled before `runFor(2000)` and disabled after, in both engines). `pauseAt` into the past throws ("Cannot fast-forward to the past"), which is why it takes the page's time.
- **Both pages are `visible` in both engines**: `document.visibilityState` was `visible` for the POS tab in every run, and the poll ran in Chromium and WebKit.

### Existing tests I changed, and why

Only imports moved, except where stated; no assertion was loosened.
- `built-session-support.ts`: the new needles (the task's instruction).
- `fire.test.tsx`, `one-press-fire.test.tsx`, `menu-categories.test.tsx`, `menu-region.test.tsx`: imports follow the moves (`REJECTED_NOTICE`, `CATALOG_NOTICE`, `LOCK_NOTICE`, `LOADING_LABEL` to `catalog/menuCopy.js`; `originFacts` to `orderFixtures.js`). In `menu-categories.test.tsx`, `facts.menu.eightySixed` became `menuFixtureFor({...}).eightySixed` (the same fact, read from where it now lives) and the `EXPECTED` table gained a `Record<string, ...>` view because `CategoryId` is `string`.
- `sheets.test.tsx`, `own-items.test.tsx`: the item sheets and the line editors were one table (`SHEET_FIXTURES`); they are two now, so each file builds `{ ...itemSheetFixtures(), ...SHEET_FIXTURES }` under the old name and every assertion reads it as before. `own-items.test.tsx` line 480 read `MENU_FIXTURES[id].lock`, which the task said to drop; it reads `originFacts({ state: id }).lock`, which is the same value for every state the test enumerates (the suite passes).
- `no-invented-values.test.ts`: reads `src/catalog` too (the task's instruction).
- Not changed though the task listed them: `tile-for.ts`, `quick-sale.test.tsx`, `order-store.test.tsx`, `void-apply.test.tsx`, `discount-apply.test.tsx`, `discount.test.tsx`, `discount-change.test.ts`; their imports still resolve.
- `e2e/tests/idle.spec.ts`: B6 and the POS B8 pause the poll first (`pausePoll`) and take the verdict from either route (`sessionVerdicts`: `SESSION_IDLE` among the codes of `me`, the revision and the menu). The back-office B8 is untouched. `polledTwice` gained a `quiet` flag. New B9.

### The red proofs (each: mutation applied, failure read, reverted)

1. **AC1** hard-coded a category in `MenuRegion` → 7 failures in `served-menu.test.tsx` (first: "draws the served categories in server order").
2. **AC2** imported `FIXTURE_MENU_MARKER` and `MENU_ITEMS` into `MenuRegion` and rendered them → production bundle test: `fixture-menu:rpos-b24c7e in …/index-….js: expected true to be false`.
3. **AC3** timer scheduled before settle and the in-flight guard removed → "times the next cycle two seconds after the previous settled, and never overlaps two": `expected 6 to be 1`.
4. **AC4** imported `PosApi` into `catalogStore.ts` → "its folder names no other route" fails. The scan was the red I ran; I did not compile a whole `PosApi` into the store, which has none of the keys `CatalogReads` names and so should not type-check either.
5. **AC5** removed the `focus` listener → "a focus on the window": `expected +0 to be 1`; removed the `visibilitychange` listener → "pauses while the tab is hidden and resumes…": `expected 1 to be +0`.
6. **AC6** threshold 1 instead of 2 → 6 failures across both files ("failed counts as a check that did not succeed…" and the band case).
7. **AC7** `commit({ read: 'loading' })` at the start of every cycle → "background retries never turn failure back into loading": `expected [ 'failed', 'loading', 'failed', … ] to not include 'loading'`.
8. **AC9** removed the epoch advance on stop → "drops a menu read that settles after the stop": `expected { version: 9, … } to be null`, and the revision-answer case.
9. **AC10** set the held version to the revision before the menu read → `expected 5 to be 1`.
10. **AC11** filtered 86'd items out of the grid → 4 failures (keeps order and slot; restoration re-enables the same element; focus kept; the store's unavailable states).
11. **AC12** selected by remembered index → 4 failures (the selected category's items; an active empty category; both removed-tile focus cases).
12. **AC13** rendered the band only when it has text → 8 failures ("is in the tree… before it has any text" and others).
13. **AC14** removed `-webkit-line-clamp` → the unit CSS test fails (`expected '…' to match /-webkit-line-clamp:\s*2/`). My first browser version of P4 still passed without the clamp (`overflow: hidden` alone keeps the price inside the tile by clipping mid-line), so I added the computed `-webkit-line-clamp` and a two-lines-high check; with the clamp dropped P4 now fails with `Expected: "2"  Received: "none"`.
14. **AC15** always focus *Try again* → "a failure leaves focus where the cashier is working" fails.
15. **AC16** restored `import.meta.env.DEV` as the gate → the development bundle test: `pos-03-order-states in …/index-….js`.
16. **AC17** compared by name (`unavailableIn` returns names, `holdsUnavailable` compares `line.name`) → "a fixture line itemId steak beside a served 86'd item named Steak does not block" fails (and two tile cases).
17. **AC18** `POLL_MS = 3500` → P1 fails at `runFor(2000)`: `Expected: "true"  Received: ""` on the tile's `aria-disabled`.
18. **AC19** the server's menu read drops `i.is_active AND c.is_active` → P3: `Expected value: not "Satay-…"  Received array: ["Soup-…", "Satay-…"]`.
19. **AC20** the revision route marked `interactive: true` (in `apps/server/src/http/routes/pos-catalog.ts`; the contracts table alone does not drive the server) → B9: `Expected: "signed-out"  Received: "signed-in"`. Reverted; `git status` shows nothing outside my paths.
20. The `R1` and `AC20` mutations also needed a rebuild of the clients; I rebuilt after each revert.

### Things I found and did not fix

- `OrderPanel.tsx`, `FloorScreen.tsx`, `SettlementScreen.tsx` and the closed-order screens still carry `import.meta.env.DEV` gates for their own lists of fixture states, as the task said to leave them. A `NODE_ENV=development` build still contains those lists.
- DESIGN-021's fire refusal copy has a plural form; `fire.ts` still uses the provisional plural from FE-011 (S7b2's, as the task says).
- `catalogReads` is optional on `SessionStore` only because `session/fixtureSession.ts` is not in my paths; if you would rather it be required, that file needs the one-line `catalogReads: undefined`-style change.
- The hidden-tab pause is proved in jsdom (the store's `isVisible`) but not in a browser: neither engine hides a page here. P1 and P2 prove the poll runs while visible.
- The full-suite test count rose from 5497 to 5501 in commit 1, which added no test file and changed no `it` by hand. I did not find which existing `it.each` enumerates the extra cases (my guess is a test that walks the tile markup, which gained spans), and I did not chase it.

### Output

- `npm run verify`, at the final tree (`8142562`): typecheck clean; **Test Files 153 passed (153), Tests 5612 passed (5612)** (baseline 151 files, 5497 tests). After commit 1 alone: 151 files, 5501 tests.
- `npm run test:e2e:all`, same tree: **118 passed (1.6m)** (baseline 108): the 8 new `pos-catalog` cases (four in each engine) and the new B9 in each.
- `idle.spec.ts` B6, the POS B8 and B9, `--repeat-each=5` in both engines: **30 passed (1.2m)**, no flake.

### What the next agent needs and does not have

M-2 for a served item, Add into the stand-in, `NewLine`'s base price, D1's ceilings, the sheet's open-between-polls behaviour (it can read `useCatalog` but nothing in this slice does), the plural fire refusal, and the preset picker (`snapshot.menu.presets` is held and decoded, and nothing draws it). I also did not check the owner's real browser behaviour with a touch device; geometry is proved in Chromium and WebKit at the default viewport (150 by 96 tiles, a 72px band).

### Round 2 (builder), from the review

Three commits after `dd8bf02`, each test first and red, nothing pushed. Item 4 needed nothing.

1. **F1, focus (`fix(pos): a completed retry no longer steals focus…`).** The held-response test (press *Try again*, hold the read, focus an `.order-line__target`, deliver) failed red: focus moved to the Meals category. `MenuRegion`'s refocus effect now applies only while focus is still lost (on the body); a surviving control keeps it. The lost-focus case is a second test and still lands on the first category; the earlier empty-catalog and removed-tile cases still pass.
2. **F2, the announcement (`fix(pos): end the availability announcement…`).** Five tests; three were red against the old code (price-only change, archive, empty projection, each leaving "Menu availability updated." in the band); the unchanged-poll and "availability changes again" cases passed before and after. The state now also remembers the adopted menu object: a different object clears the announcement unless the availability counter moved with it, and an unchanged poll adopts no new object, so it keeps it.
3. **F3, the band's place (`fix(pos): anchor the status band…`).** New browser cases P5 (empty catalog), P6 (first read held, loading) and P7 (first read failing, then the health read refused too, so both variants), plus the populated-grid check added to P1; each asserts the band is 72px high and its bottom is within 1px of `.order-screen__menu`'s bottom, in both engines. Red before the fix: the band was 514.5, 530.6 and 521.4px above the region's bottom. The fix is `margin-top: auto` on `.menu-status` in `pos.css`. I proved the red again after writing the final spec by removing the line (P5, P6, P7 failed in Chromium), then restored it. The first draft of P6 tried to reach failure on a page whose first read was held; a held read keeps the cycle in flight, so I split loading and failure into P6 and P7.

Output at the final tree: `npm run verify`: **153 files, 5619 tests passed** (was 5612; seven new unit tests). `npm run test:e2e:all`: **124 passed** (was 118; P5 to P7 in each engine). I did not rerun the B6/B8/B9 five-times check: nothing round 2 touched is on that path.

DONE
