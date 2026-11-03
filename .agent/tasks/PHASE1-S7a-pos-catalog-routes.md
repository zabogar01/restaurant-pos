---
id: PHASE1-S7a
title: The POS catalog on the server — the menu projection and the revision read, two POS routes (plan S7, consult C4)
category: feature
touches: [money, boundaries, identity]
depends_on: [PHASE1-S6a]
owns: [packages/contracts/src/pos-catalog.ts, packages/contracts/src/index.ts, packages/contracts/src/routes.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/server/src/domain/catalog.ts, apps/server/src/domain/pos-menu.ts, apps/server/src/http/routes/pos-catalog.ts, apps/server/src/http/server.ts, apps/pos/src/session/api.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**, apps/pos/test/**]
status: complete
cycles: 0
---
# PHASE1-S7a — The POS catalog on the server

**Written** 2026-11-02 by the lead. Sources:
- slice S7 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`,
  *S7*, `:348-367`);
- **consult C4** (`.agent/reviews/ARCH-021-pos-catalog.md`, items 1 and 2 and *For the lead*, *S7a*), copied below
  where it binds;
- **ADR-012** (`docs/decisions/ADR-012-versioned-configuration.md`), rules 10 to 12; **ADR-010** and **ADR-011** (route
  declarations, the route table, the error envelope, rules 1, 16, 20 and 28);
- the shape of **PHASE1-S4b** (the catalog routes) and **PHASE1-S6a** (presets), and `GET /api/health`'s opt-out of the
  client-instance hook.

The plan splits S7 into this server half and **S7b1, S7b2 and S7b3** (the POS client), written after this one from C4
and DESIGN-021. Where this file and C4 differ, this file wins. Where this file and an accepted ADR differ, or the code
cannot do what this file says, stop and write `BLOCKED: <question>`. **If C4's report is not on your branch** (its PR,
#162, may not be merged when you start), everything you need from it is copied here; do not go looking for it.

## Objective

The POS gains its first catalog reads: **two GET routes**, both for an active POS session and **not interactive**, so a
poll never extends the 90-second idle (FR-A2b, AC-28):

- `GET /api/pos/catalog/revision` answers `{ version }`, the catalog version alone, which the POS will poll every two
  seconds (ARCHITECTURE §4.3);
- `GET /api/pos/catalog/menu` answers **one snapshot** of everything the POS may show (categories, items with their 86
  state, active options, active presets) **with the version from the same snapshot** (ADR-012 rule 11).

No client behaviour: the POS keeps its fixture menu until S7b1. Nothing is written, so no migration and no audit.

## Decided: do not reopen

- **The owner's rulings:** Q14 (2026-10-20, a cashier may add a real item to the client stand-in in Phase 1, which S7b
  builds on these reads); Q13 (no Phase 1 POS command carries the catalog version); **C4 OQ1 (2026-11-02): yes**, the
  served POS picker shows real active presets, so **the projection carries `presets`**.
- **ARCHITECTURE §4.3 and ADR-012:** one monotonic catalog version on one coordination row, advanced by every committed
  catalog change (menu, option, price, availability, archive, restore, preset); a read of contents reports the version
  from the same snapshot; polling is never the integrity control.
- **What reaches the POS** (C4 item 1; DESIGN-019 round 2 F2; C1 §2.2 as C4 reads it): an active item in an active
  category, **86'd or not**. An 86'd item is present with `isAvailable: false`. An **archived** category and everything
  in it, an archived item, a removed variant or modifier, and a deactivated preset are **absent**, filtered in SQL, so an
  archived name never leaves the server.
- **Access** (plan S7; C4 item 2): both routes `{ session: 'ACTIVE', audience: 'POS', interactive: false }`, with `{
  method: 'GET', path, interactive: false }` in the route table. A back-office session is refused on both.
- **Money and rates cross the wire as canonical strings** (B-1, ADR-004; the existing `BasePrice`, `VariantPriceChange`,
  `ModifierPriceChange` and `PresetValue` schemas). Nothing here computes a price.

## The shape (C4 items 1 and 2, copied)

**The projection.** One read, `GET /api/pos/catalog/menu`, answering one snapshot.

```ts
// packages/contracts, a new pos-catalog.ts. Strict objects, as everywhere; a sketch for the builder.
PosMenuResponse = {
  version: CatalogVersion,
  categories: [{ categoryId, name }],
  items: [{
    itemId, categoryId, name,
    basePrice: BasePrice,                       // canonical string
    isAvailable: boolean,
    variants:  [{ variantId,  name, priceDelta: VariantPriceChange }],
    modifiers: [{ modifierId, name, priceDelta: ModifierPriceChange }],
  }],
  presets: [{ presetId, name, value: PresetValue }],
}
```

- **It holds** what the POS may show, and only that. **It omits** archived categories and their items, archived items,
  removed options and deactivated presets by filtering in SQL, so they are never loaded. It also omits `isActive`
  (always true here, and absent means no client can branch on it) and `displayOrder` (the array is the order).
- **Order:** categories, the items of each and each item's options by display order, ties by name with BO-03's collator
  (`Intl.Collator('en', { numeric: true, sensitivity: 'base' })`), then id. The database gives order and id, as
  `readCatalog` does; a small pure function in the domain settles ties by name. Presets stay in `listPresets`'s order
  (`created_at`, id), which is BO-07's. The client draws the order it is given.
- **The version** comes from the same `REPEATABLE READ READ ONLY` transaction as the contents (ADR-012 rule 11). A new
  domain function, `readPosMenu()`, takes the version first, as `readCatalog` does. It **cannot** be built from
  `readCatalog` and `listPresets`, which are two snapshots. Put it in `apps/server/src/domain/catalog.ts` or a new
  `pos-menu.ts`, whichever keeps the transaction helper in one place.

**The revision read.** A separate route, `GET /api/pos/catalog/revision`, answering `{ version }`. What each poll costs:
one session resolution and one single-row read.

- **It opts out of the client-instance hook** (`config.clientInstance: false`, as health does). Otherwise every poll is
  an `UPDATE client_instance`, a write every two seconds per tab, for a telemetry stamp the poll has no need to move.
  The first API request is still `me`, so FR-A7's first contact is unaffected. **The menu read keeps the hook.**
- **It should not log at the default level.** At the default `info`, Fastify's request logging writes lines for every
  poll. *Ruled:* a per-route `logLevel` of `warn` on this route only, **after you confirm the Fastify fact with the
  librarian** (`.agent/bin/ask.sh librarian "<question>"`): that a route's `logLevel` suppresses its request and reply
  lines at `info`, and that a 500 on that route is still logged. If either is false, stop and write `BLOCKED`. It
  changes no rule of ADR-010.

Rejected by C4, not to be built: a conditional read of the projection (`If-None-Match`, 304: needs a change to the
transport core and to ADR-010's envelope rule); polling the projection itself; server push.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report. C4's numbers are in brackets.

1. **[1]** Both routes are `ACTIVE`, POS, not interactive, and in the route table; the route table equals the registered
   routes. *Red:* declare one interactive: `route-table.test.ts` fails.
2. **[2]** A back-office session is refused on both; no session is `UNAUTHENTICATED`. *Red:* declare `BACK_OFFICE`:
   startup refuses it.
3. **[3]** Reading either route does not move the session's `last_interactive_at`; a session idled past the limit is
   answered `SESSION_IDLE` by each (AC-28). *Red:* declare interactive: the stamp moves.
4. **[4]** The menu omits an archived category and its items (even active, available ones), an archived item, a removed
   variant and a removed modifier, and a deactivated preset. A strict-schema parse rejects `isActive` or `displayOrder`
   on any entry. *Red:* load with `true` in place of the filter: each row fails.
5. **[5]** An 86'd active item is present with `isAvailable: false`. An item both 86'd and archived is absent. *Red:*
   filter on `is_available`.
6. **[6]** Order: display order, ties by name with the collator, then id, for categories, items and options; presets by
   creation then id. A tie is seeded through the owner connection. *Red:* remove the tie-break: `b` precedes `a` when
   `b`'s id is lower.
7. **[7] AC-31, Phase 1 part:** the version comes from one snapshot. A second connection commits a price change and a
   version advance between the read's statements; the read returns the old version with the old price (C-18's pattern
   in `catalog.test.ts`). *Red:* read in `READ COMMITTED`: the pair mismatches.
8. **[8]** Money and rates are canonical strings; every answer validates against `PosMenuResponse` and
   `PosRevisionResponse`. *Red:* send a number: the core's schema refuses it, and so does the test.
9. **[9]** `revision` equals the version after every command class: one row per ADR-012 rule 10 kind, through its
   route (a category, an item, an option, a price, an 86, an archive, a restore, a reorder, a preset create, edit,
   deactivate and reactivate). *Red:* skip the advance in one command.
10. **[10]** The revision route does not touch `client_instance`; the menu route does, as every other API route.
    *Red:* remove `clientInstance: false`: `last_seen_at` moves.
11. **[11]** An empty catalog answers version 0 (or the current version, if presets or a reorder advanced it) and empty
    lists, not an error (B-24). *Red:* treat none as `NOT_FOUND`.
12. **[12]** The revision route writes no request or reply line at `info`, and a 500 on it is still logged, in a test
    that captures the logger. Say in the Handoff what the librarian answered. *Red:* remove the option: a line appears.
13. `apps/pos/src/session/api.ts` gains the two entries its mapped type forces, wired to `ROUTES`; **they stay unused**
    until S7b1. No other POS source changes.
14. `npm run verify` green. The lead runs `npm run test:e2e:all` before merge (the contracts and the HTTP layer
    change); you may run it too and report it.

## Tests expected to change

- `apps/server/test/route-table.test.ts`, `apps/server/test/access.test.ts` and `packages/contracts/test/routes.test.ts`:
  their explicit lists gain the two routes, if they enumerate them.
- `apps/server/test/client-instance.test.ts`: only if it enumerates the routes that opt out.
- New: `apps/server/test/pos-catalog-routes.test.ts` (domain and routes; split if you prefer),
  `packages/contracts/test/pos-catalog.test.ts`.
- `apps/pos/test/**`: only a test that enumerates `PosApi`'s keys or the route table, which must gain the two paths; name
  it in the Handoff. `apps/server/test/schema.test.ts` is unchanged (no migration).
- **Nothing else should change.** `packages/api-client/test/pure.test.ts` scans `src/*.ts`: new code there must not use
  `http:`, `console`, `Date.now` or `window`. A change anywhere else is reported with its reason; a weakened assertion is
  not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Server tests need `npm run db:up` and `openssl` on `PATH`. No migration in this slice.
- No write, no audit entry, no new error code, no single-item route, no table read (the floor stays fixture until
  Phase 2), no client behaviour.
- Fixtures build the catalog through the domain or the routes, never by insertion, except the tie case in criterion 6,
  which seeds equal display orders through the owner connection on purpose.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `ad8276b` (FE-037 #159, the lead's #160 and #161 merged). The lead's last run, of FE-037's final tree:
`npm run verify` 149 files, 5453 tests; `npm run test:e2e:all` 108 passed. Confirm the baseline before you start and
state the new counts in the Handoff.

## Out of scope

- The POS catalog store, the poll, the served menu, the item sheet, the picker, the bundle marker and the browser tests
  (S7b1 to S7b3). Any POS or back-office screen.
- A conditional read, push, table reads, the add-line command and `CATALOG_CHANGED` at the POS (Phase 2).

## Commit and report

Commit on `agent/phase1-s7a` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits);
- **what S7b1 needs**: the exact routes, `ROUTES` names, `PosMenuResponse` and `PosRevisionResponse`, how a refusal and a
  session-ending answer arrive, and the two unused `PosApi` entries;
- the librarian's answer on the log level;
- what was decided and on what evidence; tests changed and why; each red proof (mutation, failure read, reverted);
- what was found and not fixed; the real `verify` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verify (2026-11-02)

Run by the lead in this worktree at `e0b812c`, for the reviewer, who cannot reach the database or a browser:

- `npm run verify`: **151 test files, 5497 tests, all passed** (baseline 149 / 5453), the builder's count confirmed.
- `npm run test:e2e:all`: **108 passed** (Chromium and WebKit), unchanged from the baseline.
- `git diff --name-only development...HEAD`: every path is inside `owns`. The only existing test changed is
  `packages/contracts/test/routes.test.ts` (one `it` added), which *Tests expected to change* names.
- **Criterion 5's own red proof, which the builder did not run:** `AND i.is_available` added to the item filter in
  `readPosMenu`; `pos-catalog-routes.test.ts` case 5 failed (`expected [ [ 'Tea', true ] ] to deeply equal [ [ 'Soup',
  false ], [ 'Tea', true ] ]`, 1 failed, 22 passed); reverted with `git checkout --`, tree clean.
- Every acceptance criterion from 1 to 14 maps to a named case in `pos-catalog-routes.test.ts` or
  `packages/contracts/test/pos-catalog.test.ts` (criterion 13 by reading `apps/pos/src/session/api.ts`).
- **For the reviewer:** the builder says the code was written before its tests, and every red proof was made by
  mutation afterwards. Judge whether any case would pass against a wrong implementation it was not mutated against.

## Handoff

### What was done

Commit `ed921fa` on `agent/phase1-s7a` (the Handoff itself is a second, docs-only commit on top). The slice adds two POS GET routes and nothing else; no migration, no write, no audit, no new error code.

- `packages/contracts/src/pos-catalog.ts` (new): `PosMenuResponse`, `PosRevisionResponse` and the entry schemas (`PosCategory`, `PosItem`, `PosVariant`, `PosModifier`, `PosPreset`), all strict objects reusing `BasePrice`, `VariantPriceChange`, `ModifierPriceChange`, `CatalogVersion` and `PresetValue`. Exported from `packages/contracts/src/index.ts`.
- `packages/contracts/src/routes.ts`: `GET /api/pos/catalog/revision` and `GET /api/pos/catalog/menu`, both `interactive: false`.
- `apps/server/src/domain/pos-menu.ts` (new): `readPosMenu()` (one `REPEATABLE READ READ ONLY` transaction; the version is the first query) and `readCatalogVersion()` (one single-row read). Ordering is a small pure comparator, `display_order`, then BO-03's collator on the name, then id.
- `apps/server/src/http/routes/pos-catalog.ts` (new), registered in `apps/server/src/http/server.ts` right after `posAuthRoutes`.
- `packages/api-client/src/specs.ts` and `client.ts`: `SPECS` entries and `ROUTES.posCatalogRevision` / `ROUTES.posCatalogMenu`.
- `apps/pos/src/session/api.ts`: the two `PosApi` entries the mapped type forces. They are unused until S7b1. No other POS source changed.
- Tests: `apps/server/test/pos-catalog-routes.test.ts` (23 cases), `packages/contracts/test/pos-catalog.test.ts` (20 cases), and one added case in `packages/contracts/test/routes.test.ts`.

### What S7b1 needs

- Routes: `GET /api/pos/catalog/revision` answers `{ version }`; `GET /api/pos/catalog/menu` answers `{ version, categories, items, presets }`. `ROUTES.posCatalogRevision` and `ROUTES.posCatalogMenu`; on `PosApi` the keys are `'/api/pos/catalog/revision'` and `'/api/pos/catalog/menu'`, both taking no argument. `ValueOf` for each is the inferred `PosRevisionResponse` / `PosMenuResponse` (neither holds a `csrfToken`, so `WithoutToken` leaves them alone).
- `PosMenuResponse`: `categories: [{ categoryId, name }]`; `items: [{ itemId, categoryId, name, basePrice, isAvailable, variants: [{ variantId, name, priceDelta }], modifiers: [{ modifierId, name, priceDelta }] }]`; `presets: [{ presetId, name, value }]` with `value` the existing `PresetValue` union. Money and rates are canonical strings; decode them with `decodeMoney` / `decodeRate`, never `Number()`. There is no `isActive` and no `displayOrder` anywhere (a strict parse refuses them); the arrays are already in the order to draw. Items are one flat array, grouped by category in the categories' order, so a client groups by `categoryId` without re-sorting.
- Refusals and session ends arrive exactly as for `me`: no session is `401 UNAUTHENTICATED`, an idle session `401 SESSION_IDLE` (the POS cookie is cleared), a back-office cookie is no session at all (`UNAUTHENTICATED`), and a failure of the store is `500 INTERNAL`. The core settles all of these with the same machinery it already uses for `me`; I added nothing there. A 2xx that fails the schema is the core's `fault`.
- A read never extends the idle (not interactive), so S7b1's poll cannot keep a session alive; only `activity` and commands do.

### The librarian's answer on the log level

Asked via `.agent/bin/ask.sh librarian`. It answered yes to both, with caveats. A route `logLevel` becomes the level of the route's child logger (pino: a child's `level` overrides the parent's), so Fastify's "incoming request" and "request completed" lines, which are emitted at `info`, are dropped on a `warn` route. Fastify's default error handler logs a 5xx at `error`, which passes a `warn` filter. It was explicit that this is a reading of `main`'s source rather than the v5.12.5 docs, that the docs do not say outright that the two lines are silenced, and that it ran nothing. Its suggested check was to count lines on `inject` for a 200 and a 500. The application does not use Fastify's default error handler (`apps/server/src/http/errors.ts` has its own and logs `request.log.error({ err }, 'request failed')` for a 500), so I did not rely on the answer: criterion 12's two cases run exactly that check against the real server at `info`. Result: a poll leaves no line at level 30 or below, the menu read leaves `incoming request` and `request completed`, and a forced 500 on the revision route writes a level-50 `request failed` line. Both conditions the task made a stop condition hold, so no BLOCKED.

### What was decided, and on what evidence

- **Items are ordered by category place, not grouped by iterating the served categories.** My first version built `items` with a `flatMap` over the served categories. The mutation that removed only the category half of the item filter (`c.is_active`) then passed all tests, because the grouping hid the archived category's items. The category half of the filter would have been dead code as far as any test or the wire was concerned. I changed it to sort the loaded items by their category's position, so only the SQL filter keeps an archived category's items out; with the category half removed the test now fails (an item of the archived category appears). The fallback place for an item whose category was not served is last, never dropped.
- **Options are loaded only for items that were loaded**, with `is_active` in the same statement.
- **The revision read is `query()` on the pool**, one statement, not a transaction: a single-row read is already a snapshot.
- `readPosMenu` imports only the `CatalogTx` type from `catalog.ts` and the `PresetValue` type from `discount-preset.ts`; it duplicates the small preset row mapping because `presetOf` is not exported and `discount-preset.ts` is outside this slice's owned paths. If the lead prefers one mapping, exporting it later is a two-line change.
- Order of the flat `items` array is category place, then display order, name, id. The task text says "the items of each ... by display order"; this is that, flattened.

### Existing tests changed

Only `packages/contracts/test/routes.test.ts`: one new `it` added, asserting the two entries and `interactive: false`. No assertion was changed or loosened. `route-table.test.ts` needed no edit: it reads `ROUTE_TABLE` and the registered routes, so the two new routes are covered by it as is. `access.test.ts`, `client-instance.test.ts` and everything under `apps/pos/test` needed no change (none enumerates the routes it would have to gain).

### Red proofs (mutation, failure read, reverted)

Honest note first: I wrote the production code before the tests, not red-first, so each guard below was proved red by mutation after the fact. Every mutation was reverted and the final tree is the committed one.

1. Both routes `interactive: true` → `route-table.test.ts` "for each ACTIVE route the table's interactive equals the route's declaration" failed (`GET /api/pos/catalog/revision: expected false to be true`), and criterion 3's `last_interactive_at` check failed for both routes (stamp moved).
2. Audience `BACK_OFFICE` → `StartupError: route GET /api/pos/catalog/revision declares audience BACK_OFFICE but is not under /api/back-office/`, the whole suite refused to start.
3. Category filter `true` in place of `is_active` → case 4 failed (`['Drinks','Old']` for `['Drinks']`). Item filter `true` → cases 4 and 5 failed (archived item present; 86'd-and-archived item present). Only `i.is_active` (category half dropped) → passed with the first version of the code, failed after the change described above. Option filter `true` → case 4 failed (`['Small','Large']`). Preset filter `true` → case 4 failed (`['Staff','Gone']`). Filtering on `is_available` is covered by case 5, whose assertion is the present-but-marked 86'd item; I did not run that exact mutation separately (the item-filter `true` mutation already fails case 5 from the other side).
4. Tie-break by name removed → case 6 failed (`['B','a10','a2']` for `['a2','a10','B']`). Only the first assertion (categories) is reached, but items and options use the same comparator and the same mutation.
5. `READ COMMITTED READ ONLY` → case 7 failed (`expected 1n to be 25000n`, the version old and the price new).
6. `basePrice: Number(...)` → case 8 failed (`PosMenuResponse.safeParse(...)` false). An earlier cruder mutation (`as unknown as string` of the bigint) produced 500s instead; I redid it with a real number so it proves the schema check.
7. `markItemAvailable`/`markItemUnavailable` returning `wrote: false` (temporary edit to `apps/server/src/domain/catalog.ts`, reverted; `git diff` of that file is empty) → case 9 failed at `86: expected 45 to be 46`.
8. `clientInstance: false` removed → case 10 failed (`last_seen_at` moved from the aged value).
9. Menu route throwing `NOT_FOUND` on an empty catalog → case 11 and every case that reads an empty menu failed (404).
10. `logLevel` removed → case 12 "no line at info" failed with the six `incoming request` / `request completed` lines listed. `logLevel: 'silent'` → case 12 "a 500 is still logged" failed (no level-50 `request failed`).
11. Contracts: `PosCategory` as a non-strict `z.object` → the two category cases of "refuses isActive or displayOrder" failed.

### Found and not fixed

- `docs/superpowers/plans/...` and the DESIGN docs were not read beyond what the task cites; nothing contradicted the task.
- Case 9 (revision follows every command class) drives `catalogWrite` through the real back-office routes, but the version-advance guarantee itself is S4a's and S6a's domain tests; this case only proves the POS revision read follows them.
- The menu path runs several statements (version, categories, items, two option tables, presets) in one transaction. It is fine for a restaurant menu; if a catalog ever reaches thousands of items, the `item_id = ANY($1)` option reads and the per-category filtering in JS are the first things to revisit.

### `npm run verify`

`npm run verify` (typecheck of all seven projects, then `vitest run`): **151 test files, 5497 tests, all passed**. Baseline in the task was 149 files and 5453 tests; the change is +2 files and +44 tests (23 server, 20 contracts, 1 added to `routes.test.ts`). `npm run test:e2e:all` was not run (the task leaves it to the lead; no browser is available to me). No formatter was run.

### What the next agent needs and does not have

S7b1 needs a decision I did not take: whether the store polls with `ROUTES.posCatalogRevision` and rereads the menu only when the version differs from the one it holds, which is what the shape supports. The `PosApi` entries are deliberately unused, so a lint rule or review looking for dead code will find them; they are the compile-forced stand-ins the file's own header describes.

DONE
