---
id: PHASE1-S6a
title: Discount presets on the server — the discount_preset record, its four commands and list, and five back-office routes (plan S6, consult C1 §4)
category: feature
touches: [money, boundaries]
depends_on: [PHASE1-S5]
owns: [db/migrations/0014_discount_preset.sql, apps/server/src/domain/discount-preset.ts, apps/server/src/domain/catalog.ts, apps/server/src/http/routes/back-office-presets.ts, apps/server/src/http/server.ts, packages/contracts/src/discount-presets.ts, packages/contracts/src/routes.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/back-office/src/session/api.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**]
status: not-started
cycles: 0
---
# PHASE1-S6a — Discount presets on the server

**Written** 2026-10-29 by the lead. Sources:
- slice S6 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S6*);
- **consult C1** §0 and §4 (`.agent/reviews/ARCH-018-c1-configuration-schema.md`), copied below where it binds;
- **ADR-012** (`docs/decisions/ADR-012-versioned-configuration.md`), rules 9, 10, 13 and 14;
- the shape of **PHASE1-S4a/S4b** (the catalog domain and routes) and **PHASE1-S3a** (a small record with deactivate
  and reactivate).

The plan splits S6 into this server half and **PHASE1-S6b** (BO-07, written after this one merges, from the design
task DESIGN-022 that runs beside this one). Where this file and C1 differ, this file wins (C1 says so of itself). Where
this file and ADR-012 differ, or the code cannot do what this file says, stop and write `BLOCKED: <question>`.

## Objective

A manager can create, edit, deactivate and reactivate **discount presets**, and list them, through five new back-office
routes, against a new `discount_preset` record that starts empty (B-24). A preset is a name and either a percentage (0
to 100 percent, held as parts per million) or a fixed amount (minor units, 0 to 99,999,999). Presets are catalog rows
(ADR-012 rule 10): **every committed preset write advances the catalog version by exactly one**, through the existing
`catalogWrite`, and an edit carries the version it was built on. No screen yet; nothing applies a preset until Phase 2.

## Decided: do not reopen

- **PRD FR-B5** (owner, as worded 2026-10-20): "Manage discount presets: create, edit, deactivate and reactivate."
  **Q10** (DECISIONS 2026-10-20): presets may be reactivated.
- **FR-M5:** discounts are 0–100%; a fixed discount is capped at the subtotal when applied (Phase 2's, not this
  slice's); the order-total maximum is 99,999,999 minor units. C1 §4.1: an amount above some future subtotal is not an
  error, and **zero is accepted** for both kinds.
- **B-21 and FR-F7:** no date, time, schedule, trigger or automatic field of any kind. **B-22:** no stacking, priority,
  minimum-spend or combination field.
- **FR-F4, FR-F5:** applying a preset snapshots it onto the order (Phase 2); a deactivated preset leaves the picker and
  **stays readable**. So deactivation keeps the row; nothing is ever deleted.
- **Q11 (DECISIONS 2026-10-20):** nothing in Phase 1 is audited except user management. **No audit entry here.**
- **ADR-012 rule 10:** create, edit, deactivate and reactivate a preset each advance the catalog version by one; a
  command that writes nothing advances nothing. **Rule 13** (as its text above `CATALOG_CHANGED` says): an **edit**
  carries the version and is refused `CATALOG_CHANGED` when stale; **deactivate and reactivate are state commands** and
  a **create** is a create, and none of the three carries it.
- **S4b's lead ruling** (*The shape* 1): a catalog `DUPLICATE` crosses the wire bare, `{ "error": { "code":
  "DUPLICATE" } }`, with no subject. **ADR-010 rules 1 and 2; ADR-011 rules 1, 9 and 16**, as S3a and S4b: no new error
  code; no PostgreSQL error text logged or copied; every route declares `access` with no default `interactive`;
  `parseBody` unchanged; `VALIDATION_FAILED` with no details; fixed-string paths, the id in the body.
- **Lengths are code points** (zod 4.6.5 and `char_length`). Do not write "UTF-16 units" in any new comment.
- **The migration is `0014`.**

## The shape (lead rulings, 2026-10-29)

1. **No display order, no reorder.** C1 §4.1 sketches a `display_order` column, but FR-B5 names four operations and no
   reorder, ADR-012 rule 10's list has none for presets, and no command would set the column. It is left out. The list
   is ordered by `created_at`, then `id` (as S3a's tender methods). If S6b's design needs an order the manager sets,
   that is a contract question for the owner, not a column here.
2. **The name: 1 to 32 code points**, trimmed, no control character; unique among **active** presets,
   case-insensitively (C2's rule, as categories, options and tender methods). C1 leaves the guard to design slice F,
   which has not drawn BO-07 yet; the lead sets 32, the length of every other name that prints on a receipt line
   (category, variant, modifier, tender method). DESIGN-022 draws to this number. An inactive preset may share a name
   with an active one and with other inactive ones.
3. **Migration `0014_discount_preset.sql`**, from C1 §4.1 without `display_order`:

   ```sql
   CREATE TABLE discount_preset (
     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name        text NOT NULL,
     kind        text NOT NULL,
     rate_ppm    bigint,        -- PERCENTAGE only: 0 to 1000000 (0 to 100 percent)
     amount      bigint,        -- FIXED only: minor units, 0 to 99999999
     is_active   boolean NOT NULL DEFAULT true,   -- false = deactivated (FR-F5)
     created_at  timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT discount_preset_name_check CHECK (...),   -- as 0013's 32-code-point name checks
     CONSTRAINT discount_preset_kind_check CHECK (kind IN ('PERCENTAGE', 'FIXED')),
     CONSTRAINT discount_preset_value_check CHECK (
       (kind = 'PERCENTAGE' AND rate_ppm BETWEEN 0 AND 1000000 AND amount IS NULL) OR
       (kind = 'FIXED' AND amount BETWEEN 0 AND 99999999 AND rate_ppm IS NULL))
   );
   CREATE UNIQUE INDEX discount_preset_active_name_key ON discount_preset (lower(name)) WHERE is_active;
   GRANT SELECT, INSERT ON discount_preset TO pos_app;
   GRANT UPDATE (name, kind, rate_ppm, amount, is_active) ON discount_preset TO pos_app;
   ```

   Copy the name check's exact form from `0013_catalog.sql`'s category name check (length, trim, `[[:cntrl:]]`). No
   `DELETE`, no sequence grant, no `ALTER DEFAULT PRIVILEGES`, **no row inserted**.
4. **Contracts, a new `packages/contracts/src/discount-presets.ts`**, exported by name from `index.ts` (S5's lesson:
   the re-export is part of the slice):
   - `PresetName = name(32)`, as `catalog.ts` builds `CategoryName` (validated, never transformed).
   - `PresetValue`: a discriminated union on `kind` of two strict objects, `{ kind: 'PERCENTAGE', ratePpm: RatePpm }`
     and `{ kind: 'FIXED', amount: DiscountAmount }`. `RatePpm` is the existing schema in `settings.ts`
     (canonical ppm string, 0 to 1000000); `DiscountAmount` is a new export with `BasePrice`'s pattern (canonical
     minor-unit string, 0 to 99999999). A JSON number, a `FIXED` value carrying `ratePpm`, and a `PERCENTAGE` value
     carrying `amount` are each refused by the schema.
   - `PresetView`: strict `{ presetId: z.uuid(), name: string, value: PresetValue, isActive: boolean }`.
   - Requests, strict: `CreatePresetRequest { name, value }`; `UpdatePresetRequest { presetId, expectedVersion:
     CatalogVersion, name, value }`; `DeactivatePresetRequest { presetId }`; `ReactivatePresetRequest { presetId }`.
   - Responses: `PresetResponse { version: CatalogVersion, preset }`; `PresetsResponse { version, presets }`.
5. **An edit sends the whole preset.** `UpdatePresetRequest` carries the name and the value together, not a set of
   optional changes. ADR-012 lists "editing a preset's name, kind or value" as one edit; the record is three fields and
   the version check already refuses a stale form. An edit whose name and value equal the stored ones writes nothing
   and advances nothing; a change of case alone, a change of kind, or a change of value alone is a change. **An
   inactive preset may be edited** (as S3a's inactive rename): that is the way out of a refused reactivation.
6. **Routes** (`routes.ts`, beside the catalog block), every one `{ session: 'ACTIVE', audience: 'BACK_OFFICE',
   interactive }`:

   | Method | Path | Body | Answers | `interactive` |
   |---|---|---|---|---|
   | `GET` | `/api/back-office/config/catalog/presets` | none | `PresetsResponse` | `false` |
   | `POST` | `/api/back-office/config/catalog/presets/create` | `CreatePresetRequest` | `PresetResponse` | `true` |
   | `POST` | `/api/back-office/config/catalog/presets/update` | `UpdatePresetRequest` | `PresetResponse` | `true` |
   | `POST` | `/api/back-office/config/catalog/presets/deactivate` | `DeactivatePresetRequest` | `PresetResponse` | `true` |
   | `POST` | `/api/back-office/config/catalog/presets/reactivate` | `ReactivatePresetRequest` | `PresetResponse` | `true` |

   **The presets read is its own route**, not a new key in `GET /api/back-office/config/catalog`: `CatalogResponse` is
   strict and BO-03 decodes it, so a new key would break the merged menu screen for nothing. The read answers every
   preset, active and inactive, and the catalog version, both read in one `REPEATABLE READ READ ONLY` transaction, as
   `readCatalog` reads its version and rows. `ROUTES` names: `presetsList`, `presetsCreate`, `presetsUpdate`, `presetsDeactivate`,
   `presetsReactivate`.
7. **Domain, `apps/server/src/domain/discount-preset.ts`**: `listPresets`, `createPreset`, `editPreset`,
   `deactivatePreset`, `reactivatePreset`, each through `catalogWrite` (the list excepted), shaped as `catalog.ts`'s
   category commands (`createCategory`, `editCategory`, `setCategoryActive`): the edit passes `expected`; create,
   deactivate and reactivate pass `UNVERSIONED`; an unknown id is `refuse('NOT_FOUND')`; a no-op returns `{ wrote:
   false }`. **`catalog.ts` changes in two places only:** `DuplicateSubject` gains `'PRESET'` and `DUPLICATE_OF` gains
   `discount_preset_active_name_key`. Create, edit of an active preset into a held name, and reactivation into a held
   name are each `DUPLICATE` with nothing written. Every preset write is serialised by `catalogWrite`'s `FOR UPDATE` on
   `catalog_revision`; take no second lock.
8. **Routes module, `apps/server/src/http/routes/back-office-presets.ts`**, registered in `server.ts` after the catalog
   routes, mapping outcomes to answers exactly as `back-office-catalog.ts` does (`STALE` to `CATALOG_CHANGED`,
   `NOT_FOUND`, bare `DUPLICATE`, `UNCHANGED` answered as `OK` with the current version). The domain stores and reads
   `rate_ppm` and `amount` as `bigint`; the wire carries canonical strings (C1 §0). Use the money and rate codecs the
   catalog and settings routes already use; do not parse a percent anywhere on the server.
9. **The compile-forced client lines only.** Five `SPECS` entries and five `ROUTES` names in `packages/api-client`; the
   five functions in `officeApi()` in `apps/back-office/src/session/api.ts`. **`ConfigApi` excludes the five paths**, as
   S3a excluded the tender-method paths: an `Exclude` on `ConfigPath` with a comment saying S6b adds them to
   `ConfigApi`, `configApi()`, `fixtureSession.ts` and `config-api.test.tsx` with the screen. No back-office screen,
   test or `realSession.ts` change (no new code).
10. **Not decided here, and left alone:** Phase 2's apply takes `catalog_revision` `FOR KEY SHARE` first (ADR-012
    rule 14) and reads the preset; say in the Handoff which domain function Phase 2 can reuse to read one preset under
    that lock, without adding it.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report. C1's case numbers are in brackets.

1. **[S6-1]** `discount_preset` is **empty after migration**; `pos_app` has exactly `SELECT, INSERT` and `UPDATE
   (name, kind, rate_ppm, amount, is_active)`; a `pos_app` `DELETE`, `TRUNCATE` and an `UPDATE` of `id` or
   `created_at` are refused (`schema.test.ts`: the privilege map and a new `describe('discount_preset')`;
   `harness-race.test.ts`'s `MIGRATED_TABLES`). *Red:* grant `DELETE`: case 1 fails; insert a row in the migration: the
   empty case fails.
2. **[S6-3]** The table's column list equals, exactly, `id, name, kind, rate_ppm, amount, is_active, created_at`: no
   date, time, trigger, schedule or order column (B-21). *Red:* add `valid_from date`: the test fails.
3. **[S6-2]** As the owner, the database refuses a `PERCENTAGE` with an amount, a `FIXED` with a rate, either kind with
   neither, a rate of 1000001 or −1, an amount of −1 or 100000000, and the kind `PERCENT`; it accepts a rate of 0 and
   of 1000000 and an amount of 0 and of 99999999. The name backstop refuses 33 code points, an untrimmed name and ESC,
   and accepts 32 emoji. *Red:* loosen the value check to `rate_ppm >= 0`: the 1000001 case fails.
4. **[S6-4]** Create, edit, deactivate and reactivate each advance the catalog version by exactly one, and the answer
   carries the new version; a no-op edit, deactivating an inactive preset and reactivating an active one each advance
   nothing, answer the current version, and leave the row's `xmin` unchanged. *Red:* make the body report `wrote:
   true` unconditionally on deactivate: the no-op case fails.
5. **[S6-5]** An `editPreset` with a stale `expectedVersion` is 409 `CATALOG_CHANGED`, body exactly `{ "error": {
   "code": "CATALOG_CHANGED" } }`, writing nothing. Deactivate and reactivate succeed whatever the version (they carry
   none). *Red:* pass `UNVERSIONED` from the edit: the stale case answers 200.
6. **[S6-6]** Deactivate keeps the row, and the list still holds it with its name, kind, value and `isActive: false`
   (FR-F5); reactivate restores it. *Red:* make `deactivatePreset` delete the row: the readable case fails (the
   delete is refused anyway, since `pos_app` has no `DELETE`, criterion 1).
7. **Names.** Create, edit of an active preset and reactivation each answer bare `DUPLICATE` (409) when an active
   preset holds the name in any case, and write nothing; two inactive presets may share a name; an inactive preset may
   be edited to a name an active one holds. *Red:* index `name` instead of `lower(name)`: the case-variant test fails.
8. **Concurrency.** Two concurrent creates of one name end with one row and one `DUPLICATE`, and the version advanced
   once. Use S1a's barrier (`tables.test.ts`, `raced`), holding the lock the commands queue on (`catalog_revision` `FOR
   UPDATE` on the owner connection) and waiting until two `pos_app` backends are waiting. *Red:* make the index
   non-unique: both answer 200.
9. **[S6-7] The wire.** Each of these is 400 `VALIDATION_FAILED` with no details, writing nothing: a value sent as a
   JSON number (`ratePpm: 100000`, `amount: 5000`); `ratePpm: '1000001'`; `ratePpm: '010'`; `amount: '100000000'`;
   `amount: '-1'`; `{ kind: 'FIXED', ratePpm: '100000' }`; `{ kind: 'PERCENTAGE', amount: '5000' }`; an unknown kind;
   an empty, 33-code-point, untrimmed or control-character name; a malformed `presetId`; an extra key at either level.
   `ratePpm: '0'`, `'1000000'`, `amount: '0'` and `'99999999'` are accepted, and a 32-emoji name is accepted. (The
   schema cannot tell a percent typed as `'10'` from 10 ppm; `rateFromPercent` is S6b's to test.) *Red:* widen
   `DiscountAmount` to accept a number: its case fails.
10. **Answers.** Each command answers the preset as committed, and a following list read contains exactly that record
    at the version answered; the list holds active and inactive presets in creation order; an unknown `presetId` is 404
    `NOT_FOUND` with nothing written and the version unchanged. A value round-trips: a `PERCENTAGE` of `'125000'` reads
    back `'125000'`, a `FIXED` of `'99999999'` reads back `'99999999'`, and an edit from one kind to the other leaves
    the other column `NULL`. *Red:* order the list by `name` (create `B` before `A`): the creation-order case
    fails.
11. **Access.** Each new route refuses no back-office cookie, or a POS session's token, 401 `UNAUTHENTICATED`; a
    back-office session whose user is no longer a manager, 403 `FORBIDDEN`; on the four `POST`s, a missing or wrong
    anti-CSRF header, 403 `CSRF_REFUSED`; nothing written. One loop over the new entries. *Red:* declare one command
    `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: the no-cookie case fails.
12. The route table equals the registered routes (`route-table.test.ts`, data-driven, unedited). *Red:* remove one new
    entry from `ROUTE_TABLE`: it fails.
13. **The log-scan marker:** a create refused `DUPLICATE` whose name is a marker string leaves the marker in no log line
    and no response (as S3a, stdout captured too). *Red:* log the database error's `detail`: the marker appears.
14. No preset command writes an audit entry (the `audit_entry` count is unchanged across all five). No red; a guard,
    and the Handoff says so.
15. `npm run verify` green. The lead runs `npm run test:e2e:all` before merge (a migration, the contracts and the HTTP
    layer change); you may run it too and report it.

## Tests expected to change

- `apps/server/test/schema.test.ts`: the privilege map (`EXPECTED`, about `:216-224`) gains `discount_preset`; a new
  `describe('discount_preset')`.
- `apps/server/test/harness-race.test.ts`: `discount_preset` in `MIGRATED_TABLES` (`:6-23`).
- `apps/server/test/catalog-routes.test.ts`: only if its truncation list (about `:151`) must include the new table
  for isolation; say so if you change it.
- New: `apps/server/test/discount-presets.test.ts` (domain and routes; split in two if you prefer, as S4a/S4b did),
  `packages/contracts/test/discount-presets.test.ts`.
- **Nothing else should change.** `route-table.test.ts`, `access.test.ts`, `packages/contracts/test/routes.test.ts`
  (it enumerates only the tables routes), `apps/back-office/test/boundaries.test.tsx` (its key list comes from
  `ROUTE_TABLE` and `officeApi`, which both gain the five paths) and `config-api.test.tsx` (unchanged while `ConfigApi`
  excludes the paths) stay as they are. `packages/api-client/test/pure.test.ts` scans `src/*.ts`: new code there must
  not use `http:`, `console`, `Date.now` or `window`. A change anywhere else is reported with its reason; a weakened
  assertion is not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not run `db:migrate` on the development database `pos`;
  the lead does after the merge (the server refuses to start until it does, S0).
- No audit entry, no idempotency key, no single-preset route, no seed, no screen, no new error code, no reorder.
- Fixtures create presets through the domain or the routes, never by insertion, except the database-backstop cases in
  `schema.test.ts`, which insert as the owner on purpose.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `a6e682d` (S5 #151, and the lead's #152 and #153 merged). The lead's last run, of S5's final tree:
`npm run verify` 142 files, 5226 tests; `npm run test:e2e:all` 100 passed. Confirm the baseline before you start and
state the new counts in the Handoff.

## Out of scope

- BO-07, `ConfigApi`'s inclusion, the fixture session (S6b). Any back-office screen.
- Applying a preset, the cap at the subtotal, the snapshot on an order, the POS picker, the audit of an applied
  discount (Phase 2). The POS read of presets (C4, S7).
- A reorder or display order (ruling 1). The code-point comments elsewhere (queued cleanup).

## Commit and report

Commit on `agent/phase1-s6a` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits);
- **what S6b needs**: the exact routes, `ROUTES` and schema names, `PresetView` and `PresetValue`, the `ConfigApi`
  exclusion S6b removes, and how `CATALOG_CHANGED`, `DUPLICATE` and `NOT_FOUND` arrive;
- what Phase 2 can reuse (ruling 10);
- what was decided and on what evidence; tests changed and why; each red proof (mutation, failure read, reverted);
- what was found and not fixed; the real `verify` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff
