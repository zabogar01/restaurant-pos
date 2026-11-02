---
id: PHASE1-S7a
title: The POS catalog on the server — the menu projection and the revision read, two POS routes (plan S7, consult C4)
category: feature
touches: [money, boundaries, identity]
depends_on: [PHASE1-S6a]
owns: [packages/contracts/src/pos-catalog.ts, packages/contracts/src/index.ts, packages/contracts/src/routes.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/server/src/domain/catalog.ts, apps/server/src/domain/pos-menu.ts, apps/server/src/http/routes/pos-catalog.ts, apps/server/src/http/server.ts, apps/pos/src/session/api.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**, apps/pos/test/**]
status: not-started
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

## Handoff

*(The builder writes here.)*
