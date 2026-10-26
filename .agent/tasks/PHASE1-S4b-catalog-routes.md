---
id: PHASE1-S4b
title: The catalog routes — eleven back-office routes on S4a's domain, the catalog contracts, and CATALOG_CHANGED (plan S4b, ADR-012 rules 13 and 15, consult C1 §2.4)
category: feature
touches: [money, boundaries]
depends_on: [PHASE1-S4a]
owns: [packages/contracts/src/catalog.ts, packages/contracts/src/routes.ts, packages/contracts/src/errors.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/server/src/http/routes/back-office-catalog.ts, apps/server/src/http/server.ts, apps/back-office/src/session/api.ts, apps/back-office/src/session/realSession.ts, apps/pos/src/session/realSession.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**]
status: review
cycles: 0
---
# PHASE1-S4b — The catalog routes

**Written** 2026-10-26 by the lead, from slice S4 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S4*), **ADR-012** rules 13 and 15
(`docs/decisions/ADR-012-versioned-configuration.md`), **consult C1** §0 (*Money and rates on the wire*, *Codes*) and
§2.4's last paragraph (`.agent/reviews/ARCH-018-c1-configuration-schema.md`), the pattern of **consult C2** §1, §3
and §6 (`.agent/reviews/ARCH-019-first-back-office-form.md`), and **PHASE1-S4a**'s Handoff, *What S4b needs*
(`.agent/tasks/PHASE1-S4a-catalog-server.md`, merged as PR #140). Two earlier slices are the model, and this one copies
their shape: **PHASE1-S3a** (`.agent/tasks/PHASE1-S3a-tender-methods-server.md`: routes, contracts, the compile-forced
client lines and the `ConfigApi` exclusion) and **PHASE1-S2a** (`.agent/tasks/PHASE1-S2a-settings-server.md`: a new
error code entering the contracts with its first emitter, and a value crossing the wire as a canonical string checked
in the schema). Where this file and those differ, this file wins; where this file and ADR-012 differ, stop and write
`BLOCKED: <question>`.

## Objective

A manager's browser can read the whole catalog with its version, and send the eleven catalog commands S4a built,
through new back-office routes. A stale edit is answered **409 `CATALOG_CHANGED`**, which enters `@pos/contracts`
here, its first emitter (ADR-010 rule 1, ADR-012 rule 13). Prices cross the wire as canonical integer strings of
minor units, never as JSON numbers (B-1, ADR-004). **No screen:** S4c builds BO-03 and BO-04 on these routes. **No
domain change:** S4a's `catalog.ts` is used as it stands.

## Decided: do not reopen

- **ADR-012 rule 13:** edits carry the catalog version their form was read at and are refused `CATALOG_CHANGED`
  (status 409, **no details**), writing nothing; creates and state commands (archive, restore) carry none. **Rule 15:**
  every successful catalog command answers the catalog version it produced, and the read returns the version it was
  read at. **Rule 11:** the read is S4a's `readCatalog`, one snapshot.
- **S4a (PR #140), binding:** the domain functions, their outcomes (`OK`, `UNCHANGED`, `STALE`, `NOT_FOUND`,
  `DUPLICATE { of }`, `INVALID`), the check order (version first), the change-list shape of `editItem`, an archived
  destination answered `STALE`, and the name and price rules in the database. Its Handoff's *What S4b needs* lists the
  exact signatures.
- **C2 §1 and §3 as S1a and S3a built them:** fixed-string paths under `/api/back-office/config/`, the record's id in
  the `POST` body; a record under a named key in every answer, read in the command's own transaction; the read is not
  interactive, every command is.
- **ADR-010 rules 1 and 2; ADR-011 rules 1, 9 and 16:** no PostgreSQL error text logged or copied; every route
  declares `access` with no default `interactive`; one validation helper (`parseBody`, unchanged), `VALIDATION_FAILED`
  with no details; no query string.
- **DESIGN-019 and DESIGN-020 rules** (lead rulings in those task files): names trimmed, no control character;
  category 1–32, item 1–64, variant and modifier 1–32 code points. Prices: base 0 to 99.999.999; variant change
  −99.999.999 to 99.999.999; modifier change 0 to 99.999.999. **Lengths are code points** (zod 4.6.5's `max`, as
  `char_length` counts; S2b Handoff, decision 1): the "UTF-16 units" comments in `tables.ts` and `settings.ts` are
  wrong, so do not copy them into `catalog.ts`. Correcting them is a separate queued cleanup.
- **Owner, Q11:** nothing here is audited.

## The shape (lead rulings, 2026-10-26)

1. **`DUPLICATE` stays bare on every catalog route** (S4a's Handoff left this open). Its body is exactly
   `{ "error": { "code": "DUPLICATE" } }`, as for tables and tender methods. Reasons: every catalog command but the
   two item saves has a single subject, which the screen knows from the command. On BO-04, DESIGN-020 places a server
   `DUPLICATE` on the item name, and refuses option-name duplicates locally before sending. C3 (ARCH-020 §6) gives
   `DUPLICATE` optional details **on the users routes only** (S8a). The route ignores the domain's `of`. If S4c finds a
   case where BO-04 must tell an option duplicate from an item duplicate, that is a later ruling with its own task.
   *Yours to overturn, owner.*
2. **No single-item read** (S4a's Handoff left this open). BO-04 builds on the whole catalog read: it needs the item,
   the category list for its category choice, and the version, all from one snapshot, and `readCatalog` already gives
   all three. DESIGN-020's "BO-04 reads the item and the catalog version in one snapshot when it opens" is satisfied by
   that read. *Yours to overturn.*
3. **`CATALOG_CHANGED`** enters `packages/contracts/src/errors.ts` as S2a added `SETTINGS_CHANGED`. It goes into
   `ErrorCode`, gets a `bare(...)` entry in the `ErrorBody` union, and a block in `apps/server/test/error-details.types.ts`
   that proves a details argument does not compile for it. It is placed in **both clients' code maps** in the
   general-failure group beside `SETTINGS_CHANGED` (`apps/back-office/src/session/realSession.ts`,
   `apps/pos/src/session/realSession.ts`). S4c gives the back office its real handling. The POS never receives it in
   Phase 1.
4. **The routes**, every one `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }`:

   | Method | Path (under `/api/back-office/config/catalog`) | Body | Domain call | Answers | `interactive` |
   |---|---|---|---|---|---|
   | `GET` | (the base path) | none | `readCatalog()` | `CatalogResponse` | `false` |
   | `POST` | `/categories/create` | `{ name }` | `createCategory` | `CategoryResponse` | `true` |
   | `POST` | `/categories/update` | `{ categoryId, expectedVersion, name }` | `editCategory` | `CategoryResponse` | `true` |
   | `POST` | `/categories/reorder` | `{ expectedVersion, categoryIds }` | `reorderCategories` | `CategoriesResponse` | `true` |
   | `POST` | `/categories/archive` | `{ categoryId }` | `archiveCategory` | `CategoryResponse` | `true` |
   | `POST` | `/categories/restore` | `{ categoryId }` | `restoreCategory` | `CategoryResponse` | `true` |
   | `POST` | `/items/create` | `{ categoryId, name, basePrice, variants, modifiers }` | `createItem` | `ItemResponse` | `true` |
   | `POST` | `/items/update` | `{ itemId, expectedVersion, changes }` | `editItem` | `ItemResponse` | `true` |
   | `POST` | `/items/reorder` | `{ categoryId, expectedVersion, itemIds }` | `reorderItems` | `ItemsResponse` | `true` |
   | `POST` | `/items/archive` | `{ itemId }` | `archiveItem` | `ItemResponse` | `true` |
   | `POST` | `/items/restore` | `{ itemId }` | `restoreItem` | `ItemResponse` | `true` |

   `ROUTES` names: `catalogRead`, `catalogCategoriesCreate`, `catalogCategoriesUpdate`, `catalogCategoriesReorder`,
   `catalogCategoriesArchive`, `catalogCategoriesRestore`, `catalogItemsCreate`, `catalogItemsUpdate`,
   `catalogItemsReorder`, `catalogItemsArchive`, `catalogItemsRestore`. Register the module in `server.ts` after the
   tender-methods routes. In `ROUTE_TABLE`, give the read the same one-line comment the other reads carry.
5. **Outcomes to HTTP**, in one `answered` helper as `back-office-tender-methods.ts` has: `OK` and `UNCHANGED` answer
   200 with the version and the record; `STALE` is 409 `CATALOG_CHANGED`; `NOT_FOUND` is 404 `NOT_FOUND`;
   `DUPLICATE` is 409 `DUPLICATE` (rule 1); `INVALID` is 400 `VALIDATION_FAILED`. None carries details. The answer
   does not say whether the command wrote: as for settings (owner, DESIGN-018 Q5), the client reads *unchanged* from
   an answered version equal to the one it stood at.
6. **Contracts, a new `packages/contracts/src/catalog.ts`**, exported from `index.ts`. Every object is strict, nested
   ones included. No custom messages.
   - **Names:** `CategoryName` (1–32), `ItemName` (1–64), `OptionName` (1–32, used by variants and modifiers alike),
     each `z.string().min(1).max(N)` refined by "equals its own trim" and "no `\p{Cc}`", with no transform (as
     `TenderMethodName`).
   - **Prices on the wire**, checked in the schema itself (the contracts depend on zod alone, as `RatePpm` does), then
     read by the route with `decodeMoney` from `@pos/money`:
     - `BasePrice` and `ModifierPriceChange`: `/^(0|[1-9][0-9]{0,7})$/`, so 0 to 99999999;
     - `VariantPriceChange`: `/^(0|-?[1-9][0-9]{0,7})$/`, so −99999999 to 99999999.
     A JSON number, a leading zero, `-0`, `+5`, an exponent, a fraction, a space and an empty string are refused.
     Answers encode with `encodeMoney`.
   - **`CatalogVersion`:** `z.number().int().min(0).max(2_147_483_647)`. Version 0 is valid (the empty catalog), unlike
     settings' version, which starts at 1. Every versioned request's field is named **`expectedVersion`**, as in
     `SaveSettingsRequest`.
   - **Views:** `CategoryView { categoryId, name, displayOrder, isActive }`;
     `VariantView { variantId, name, priceDelta, displayOrder, isActive }`;
     `ModifierView { modifierId, name, priceDelta, displayOrder, isActive }`. These are two structures, never one
     "option" view, because DESIGN-020 keeps variants and modifiers apart.
     `ItemView { itemId, categoryId, name, basePrice, displayOrder, isAvailable, isActive, variants, modifiers }`.
     Prices are canonical strings, ids UUIDs, `displayOrder` a non-negative integer. Removed options and archived rows
     are included, marked.
   - **Responses:** `CatalogResponse { version, categories, items }`; `CategoryResponse { version, category }`;
     `CategoriesResponse { version, categories }`; `ItemResponse { version, item }`; `ItemsResponse { version, items }`.
   - **Requests**, one per command, matching the table. `CreateItemRequest`'s `variants` and `modifiers` are arrays
     (possibly empty) of `{ name, priceDelta }`. `UpdateItemRequest.changes` mirrors S4a's `ItemChanges`:
     `{ fields?: { name?, basePrice?, categoryId? }, variants?: VariantChanges, modifiers?: ModifierChanges }`, where
     each list's changes are `{ added?: [{ key, name, priceDelta }], edited?: [{ id, name?, priceDelta? }], removed?:
     [id], order?: [{ id } | { key }] }`, with the price rule of that list. The `order` union is two strict objects, so
     `{ id, key }` together is refused. `key` is `z.string().min(1).max(64)`, refined "no `\p{Cc}`". Ids are
     `z.uuid()`. Lists carry no length cap of their own: the body limit (`PAYLOAD_TOO_LARGE`) bounds them, and no
     ruling sets a count.
7. **Routes module**, `apps/server/src/http/routes/back-office-catalog.ts`. It parses each body with `parseBody`,
   decodes prices with `decodeMoney`, calls S4a's function, and maps the outcome by rule 5. Views are built from S4a's
   records: `optionId` becomes `variantId` or `modifierId`, and prices are encoded. The record answered is the one the
   domain read in the command's own transaction; do not reread it.
8. **The compile-forced client lines only**, as S3a did:
   - eleven `SPECS` entries and the `ROUTES` names in `packages/api-client`;
   - eleven `officeApi()` functions in `apps/back-office/src/session/api.ts`;
   - **`ConfigApi` excludes the catalog paths for now**, with an `Exclude` on `ConfigPath` and a comment saying that S4c
     adds them to `ConfigApi`, `configApi()`, `fixtureSession.ts` and `config-api.test.tsx` together with the screens;
   - `CATALOG_CHANGED` placed in both `realSession.ts` maps (rule 3).
   No back-office screen or test file changes.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing for the stated reason, revert, and report. Route tests go in a
new `apps/server/test/catalog-routes.test.ts`, with fixtures made through the routes (a manager from `makePeople` with
an unused PIN base: `700000`). Use a per-case `TRUNCATE` of the four catalog tables on the owner connection, as
`catalog.test.ts` does, and assert versions relative to the version read at the start of each case.

1. The route table equals the registered routes, and each route's `interactive` equals its declaration
   (`route-table.test.ts`, data-driven, unedited). *Red:* remove `items/reorder` from `ROUTE_TABLE`: case 8 fails.
2. No `ROUTE_TABLE` path contains `?`, `#` or `:` (`packages/contracts/test/routes.test.ts`, generic, unedited).
   *Red:* append `?x` to one new path: the test fails.
3. **Access.** One loop over the eleven new entries. With no back-office cookie, or with a POS session's token, each
   route answers 401 `UNAUTHENTICATED`. A back-office session whose user is no longer a manager gets 403 `FORBIDDEN`.
   On the ten `POST`s, a missing or wrong anti-CSRF header gets 403 `CSRF_REFUSED`. In every refused case, the version
   is unchanged and nothing is written. *Red:* declare `categories/create` with `{ session: 'OPTIONAL', audience:
   'BACK_OFFICE' }`: the loop's no-cookie case fails.
4. **`CATALOG_CHANGED`.** A stale `categories/update`, `categories/reorder`, `items/update` and `items/reorder` (with
   `expectedVersion` one behind) each answer 409, with a body of exactly `{ "error": { "code": "CATALOG_CHANGED" } }`,
   which validates against `ErrorBody`. The following read shows the same version and rows. An `items/create` into a
   category archived since (no version carried) also answers 409 `CATALOG_CHANGED`. *Red:* map `STALE` to
   `DUPLICATE`: the code differs.
5. **Prices are strings, never numbers.** `items/create` with `basePrice` sent as the JSON number `10000` is 400
   `VALIDATION_FAILED`, and so is any `priceDelta` sent as a number, in a create or in an edit. Each price field's
   non-canonical strings are refused, each as 400: `'01'`, `'-0'`, `'+5'`, `'1e3'`, `'1.5'`, `' 5'`, `''`. So are its
   out-of-bound values: base `'-1'` and `'100000000'`; variant `'-100000000'` and `'100000000'`; modifier `'-1'` and
   `'100000000'`. The bounds `'0'`, `'99999999'` and the variant's `'-99999999'` are accepted and round-trip exactly
   through the following read. *Red:* accept `z.union([z.string(), z.number()])` for `basePrice`: the number case is
   not refused.
6. **Names.** For each of the four name kinds, at the route: empty, over length (33 code points, or 65 for an item),
   untrimmed, a line feed and ESC are each 400 `VALIDATION_FAILED` with no details, and the maximum in emoji (32, or 64)
   is accepted. *Red:* drop the trim refinement from `ItemName`: the untrimmed item create is not 400.
7. **Strictness and shape.** An extra key is 400 at the top level of each request body, inside `changes`, inside
   `fields`, inside a list's changes, and inside an `added` or `edited` entry. So are each of these: a malformed UUID;
   an `expectedVersion` of `-1`, `1.5` or `'1'`, or one missing on a versioned route; an `order` entry carrying both
   `id` and `key`; an empty `key`. *Red:* make the `edited` entry schema non-strict: its extra-key case is not 400.
8. **`INVALID` is `VALIDATION_FAILED`.** A `categories/reorder` missing one active category, and an `items/update`
   whose `order` is not the list's final active set, each answer 400 with a body of exactly `{ "error": { "code":
   "VALIDATION_FAILED" } }`, writing nothing. *Red:* map `INVALID` to 409 `CATALOG_CHANGED`: the status differs.
9. **`DUPLICATE` is bare** (rule 1). These each answer 409 with a body of exactly `{ "error": { "code": "DUPLICATE" } }`:
   a category create, rename and restore into a held name; an item create, rename and restore into a held name; and an
   item save with two added modifiers sharing one name. *Red:* add `details: { of }`: the exact-body assertion fails
   (and `ErrorBody` refuses it).
10. **`NOT_FOUND`.** An unknown `categoryId` on update, archive and restore, an unknown `itemId` on update, archive and
    restore, and another item's variant id in `edited` each answer 404 with a body of exactly `{ "error": { "code":
    "NOT_FOUND" } }`, writing nothing. *Red:* map `NOT_FOUND` to 400: the status differs.
11. **Answers are authoritative** (C2 §3, ADR-012 rule 15). After each of the ten commands, applied to a real change,
    the answered version is the start plus one. The answered record equals that record in the following
    `GET /catalog`, and that read's version equals the answered one. An unchanged command (a rename to the identical
    name, archiving an archived item, an `items/update` with nothing different) answers 200 with the version unchanged.
    An `items/update` that swaps two variants' names answers both with their new names (S4a rule 6, end to end). The
    read includes archived categories and items and removed options, each with `isActive: false`, and `isAvailable`
    on every item. *Red:* answer the request's values instead of the domain's record: `displayOrder` is missing and
    the case fails.
12. **Contracts** (`packages/contracts/test/catalog.test.ts`, new): each schema refuses and accepts as criteria 5 to 7
    say, without the server, and each view refuses an extra key and a numeric price. *Red:* loosen `VariantPriceChange`
    to `/^-?[0-9]+$/`: `'01'` and `'-0'` pass.
13. **The log-scan marker** (as S3a's case, stdout captured too). An `items/create` refused `DUPLICATE` whose name is a
    marker, a `categories/create` refused `VALIDATION_FAILED` whose name holds a marker and an ESC, and a stale
    `items/update` whose new name is a marker: each leaves the marker in no log line and no response. *Red:* log the
    database error's `detail` in the routes module's `answered` path, or the request body on a refusal: the marker
    appears.
14. **`CATALOG_CHANGED` in the contracts.** It is in `ErrorCode` and in the `ErrorBody` union as a bare entry. The
    `error-details.types.ts` block shows that a details argument for it does not compile. Both clients' code maps place
    it, so `npm run typecheck` is the proof. *Red:* leave it out of the POS map: typecheck fails at the exhaustive
    `never`.
15. **No audit.** No catalog route writes an audit entry: the `audit_entry` count is unchanged across the read, every
    command and a refusal. No red; this is a guard, and the Handoff says so.
16. `npm run verify` green. The lead runs `npm run test:e2e:all` before merge (the contracts and the HTTP layer
    change); you may run it too and report it.

## Tests expected to change

- `apps/server/test/error-details.types.ts`: a `CATALOG_CHANGED` block, as S2a added `SETTINGS_CHANGED`'s.
- New: `apps/server/test/catalog-routes.test.ts`, `packages/contracts/test/catalog.test.ts`.
- `route-table.test.ts`, `access.test.ts` and `packages/contracts/test/routes.test.ts` pass **unedited** through their
  data. If one needs an edit, say why in the Handoff.
- **Nothing else should change**: `catalog.test.ts` and `schema.test.ts` (no migration here), every back-office and
  POS test. A change anywhere else is reported in the Handoff with its reason. A weakened assertion is not acceptable.

## Rules

- Touch only the paths in `owns`. **S4a's `apps/server/src/domain/catalog.ts` is not in it.** If the routes need a
  domain change, stop and write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Server tests need `npm run db:up` and `openssl` on `PATH`. No migration in this task.
- No `Number()`, `parseFloat` or JSON number on a price anywhere: `decodeMoney` in, `encodeMoney` out.
- No route beyond the eleven, no single-item read, no audit entry, no idempotency key, no screen, no new code but
  `CATALOG_CHANGED`, and no details on any catalog refusal.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `454f78b` (S4a #140 and the lead's #141 merged). The lead's last runs, of S4a's final tree, which has
the same code: `npm run verify` 123 files, 4540 tests; `npm run test:e2e:all` 78 passed. Confirm the baseline before
you start and state the new counts in the Handoff.

## Out of scope

- BO-03 and BO-04, `ConfigApi`'s inclusion of the catalog paths, the fixture session, the back office's real handling
  of `CATALOG_CHANGED` (S4c).
- The 86 commands and their routes (S5). Discount presets (S6a). The POS projection and poll (C4, S7).
- Any change to `catalog.ts` or `0013`. The code-point comments elsewhere (queued cleanup).

## Commit and report

Commit on `agent/phase1-s4b` only, after verify is green, and never push. Use Conventional Commits, explaining why.
Write the Handoff below in full prose:
- what was done (paths, commits);
- **what S4c needs**: the exact route paths, `ROUTES` and schema names, every view's fields, how each refusal arrives
  (status and body), how *unchanged* is read from the version, and the `ConfigApi` exclusion S4c removes;
- what was decided and on what evidence;
- tests changed and why;
- each red proof (mutation, failure read, reverted);
- what was found and not fixed;
- the real `verify` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verify (2026-10-26)

At `6db7d9a`, in this worktree. `git diff --name-only development...HEAD`: the task file and paths in `owns` only. The
only changed existing test is `error-details.types.ts`, as listed; the new tests are `catalog-routes.test.ts` and
`packages/contracts/test/catalog.test.ts`. `npm run verify`: 125 files, 4593 tests, green (baseline 123/4540).
`npm run test:e2e:all`: 78 passed (Chromium and WebKit), unchanged. The lead read `back-office-catalog.ts` and
`catalog.ts` (contracts) against *The shape*. The eleven routes match the table, with the read `interactive: false`.
One `answered` helper maps `STALE` to 409 `CATALOG_CHANGED`, `NOT_FOUND` to 404, `DUPLICATE` to bare 409 (the domain's
`of` is dropped), and `INVALID` to 400 `VALIDATION_FAILED`. Prices are matched by regex in the schema, read with
`decodeMoney` and written with `encodeMoney`, never `Number`. Every object is strict, `order` a union of two strict
objects, and `expectedVersion` 0 to 2^31−1. `CATALOG_CHANGED` is bare in `ErrorBody` and placed in both code maps, and
`ConfigApi` excludes the catalog paths with its S4c comment. **Noted:** the builder wrote the tests with the code and
applied each red mutation afterwards (its Handoff says so); every criterion has an observed red. Reviewers cannot
reach the database or a browser: this note is the evidence for the server and browser runs, and a "blocked" on that
alone is ruled clear. Sent to review (`touches: money, boundaries`); the owner looks before merge.

## Handoff

### What was done

The eleven catalog routes are built on S4a's domain, unchanged, with the catalog contracts and `CATALOG_CHANGED`.

- `packages/contracts/src/catalog.ts` (new): the name schemas, the three price schemas, `CatalogVersion`, the views, the responses and the ten requests. Exported from `index.ts`.
- `packages/contracts/src/errors.ts`: `CATALOG_CHANGED` in `ErrorCode` and as a `bare(...)` entry in `ErrorBody`.
- `packages/contracts/src/routes.ts`: eleven `ROUTE_TABLE` entries, with a one-line comment on the read.
- `apps/server/src/http/routes/back-office-catalog.ts` (new) and its registration in `server.ts` after the tender-methods routes.
- `packages/api-client/src/client.ts` and `specs.ts`: eleven `ROUTES` names and `SPECS` entries.
- `apps/back-office/src/session/api.ts`: eleven `officeApi()` functions, and `ConfigApi` excludes the catalog paths with a comment saying S4c adds them to `ConfigApi`, `configApi()`, `fixtureSession.ts` and `config-api.test.tsx`.
- Both `realSession.ts` maps place `CATALOG_CHANGED` in the general-failure group beside `SETTINGS_CHANGED`.
- Tests: `apps/server/test/catalog-routes.test.ts` (34 cases), `packages/contracts/test/catalog.test.ts` (19 cases), and a `CATALOG_CHANGED` block in `apps/server/test/error-details.types.ts`.

Commit: one commit on `agent/phase1-s4b` (hash in `git log`; it cannot be written inside the commit itself).

### What S4c needs

Paths, all under `/api/back-office/config/catalog`: `GET` the base path; `POST` `/categories/{create,update,reorder,archive,restore}` and `/items/{create,update,reorder,archive,restore}`. `ROUTES` names: `catalogRead`, `catalogCategoriesCreate|Update|Reorder|Archive|Restore`, `catalogItemsCreate|Update|Reorder|Archive|Restore`. Schemas exported from `@pos/contracts`: `CatalogResponse`, `CategoryResponse`, `CategoriesResponse`, `ItemResponse`, `ItemsResponse`, `CreateCategoryRequest`, `UpdateCategoryRequest`, `ReorderCategoriesRequest`, `ArchiveCategoryRequest`, `RestoreCategoryRequest`, `CreateItemRequest`, `UpdateItemRequest`, `ReorderItemsRequest`, `ArchiveItemRequest`, `RestoreItemRequest`, plus `ItemChanges`, `VariantChanges`, `ModifierChanges`, `CategoryName`, `ItemName`, `OptionName`, `BasePrice`, `VariantPriceChange`, `ModifierPriceChange`, `CatalogVersion`.

Views: `CategoryView { categoryId, name, displayOrder, isActive }`; `VariantView { variantId, name, priceDelta, displayOrder, isActive }`; `ModifierView { modifierId, name, priceDelta, displayOrder, isActive }`; `ItemView { itemId, categoryId, name, basePrice, displayOrder, isAvailable, isActive, variants, modifiers }`. Prices are canonical strings of minor units; decode with `decodeMoney` and encode with `encodeMoney`. Responses carry `version` beside `category`, `categories`, `item` or `items`; the read carries `version`, `categories`, `items`, archived and removed rows included and marked.

Refusals: stale or an archived destination category is 409 `{"error":{"code":"CATALOG_CHANGED"}}`; unknown id is 404 `NOT_FOUND`; a held name is 409 `DUPLICATE`, bare on every route (ruling 1, so the screen cannot tell an option duplicate from an item duplicate by the response); a list that is not the whole scope is 400 `VALIDATION_FAILED`. None carries details. *Unchanged* is read from an answered `version` equal to the version the client stood at; the answer does not say whether the command wrote. Creates, archive and restore carry no version, so for them the client compares with the version of its last read, and an equal answer means nothing was written. `reorder` answers only the active rows of its scope, not the whole catalog.

The `ConfigApi` exclusion S4c removes is in `apps/back-office/src/session/api.ts` (`type ConfigPath = Exclude<...>`), together with adding the eleven paths to `configApi()`.

### What was decided, and on what evidence

- The `answered` helper is generic over the record and takes a small response builder, because the five response shapes differ by record name. `DUPLICATE` ignores the domain's `of` (ruling 1).
- Rules 1, 2 and 3 of the lead's rulings were followed as written; I did not overturn any.
- `UpdateItemRequest.changes` and its parts are the zod schemas in `catalog.ts`; the route rebuilds the domain's `ItemChanges` with absent fields left absent, so the domain sees only what changed.
- The tsconfig has no `exactOptionalPropertyTypes`, so the conditional spreads in the route are only for clarity, not for the compiler.

### Tests changed

No existing test was edited except `apps/server/test/error-details.types.ts`, which the task lists. `route-table.test.ts`, `access.test.ts` and `packages/contracts/test/routes.test.ts` pass unedited through their data. `catalog.test.ts` and `schema.test.ts` are untouched.

### Red proofs

Honest note first: I wrote the contracts, routes and tests together and ran them green, then applied each mutation afterwards, rather than running every test against absent code. Each mutation below was applied, its failure read, and the mutation reverted by reverse edit.

1. Removed `items/reorder` from `ROUTE_TABLE`: `route-table.test.ts` case 8 failed twice ("registered but not in the table", and the interactive check), and my case 1 failed.
2. Appended `?x` to `items/archive`: `routes.test.ts` case 2 failed on that path.
3. Declared `categories/create` as `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: my case 3 failed with 200 where 401 was expected, on "no cookie".
4. Mapped `STALE` to `DUPLICATE`: three case-4 tests failed on the code.
5. Accepted `z.union([string-regex, z.number()])` for `BasePrice`: four tests failed (the contracts number case, create, change, and the route test, which got 500 where 400 was expected because the number reached the domain).
6. Dropped the trim refinement from `ItemName`: four tests failed. At the route the untrimmed item was not 400; it was 500 from the database's own check. That is a failure for the stated reason (the schema no longer refuses it); the 500 is the database constraint answering a value the schema should have caught.
7. Made the `edited` entry non-strict: the contracts and route extra-key cases failed (200 where 400).
8. Mapped `INVALID` to 409 `CATALOG_CHANGED` (together with `NOT_FOUND` to 400 in one run): both case 8 tests failed on status, and both case 10 tests failed on status.
9. Added `details: { of }` to the `DUPLICATE` refusal (with `as never`, since `ErrorBody` refuses it by type): all five tests that assert the bare body failed, showing `"details":{"of":"CATEGORY"}` and the like.
10. Answered a hand-built category without `displayOrder` on `categories/update`: case 11 failed on the missing `displayOrder`.
11. Loosened `VariantPriceChange` to `/^-?[0-9]+$/`: the contracts variant test failed on `'01'`.
12. Case 13: I logged the parsed request body in the `items/create` handler, not the database error's `detail`. The marker appeared in the log lines and the test failed. This is a mutation of the "log the request body" kind the task names; I did not also mutate the database-detail path, because `catalogWrite` in `catalog.ts` is outside my paths.
13. Left `CATALOG_CHANGED` out of the POS map: `tsc -p apps/pos` failed at the exhaustive `never` ("Type '{ code: "CATALOG_CHANGED" ... }' is not assignable to type 'never'").

Criterion 15 (no audit) is a guard and has no red, as the task says.

### Found and not fixed

- The comments in `tables.ts` and `settings.ts` saying "UTF-16 units" are wrong (code points); left for the queued cleanup. `catalog.ts` says code points.
- A name that the schema fails to refuse reaches the database, whose check then makes it a 500 `INTERNAL`. That is existing behavior for every route, not new, but it means the schema is the only line that produces a 400.

### Verify

`npm run verify`: typecheck clean; 125 test files, 4593 tests passed. That is two files and 53 tests more than the lead's baseline of 123 files and 4540 tests (34 route cases and 19 contract cases). I did not run the baseline separately before starting; the arithmetic matches the lead's figure. I did not run `npm run test:e2e:all`; the lead runs it before merge. No browser was used. No formatter was run.

### What the next agent needs and does not have

Nothing is missing. The e2e run is the lead's.

DONE
