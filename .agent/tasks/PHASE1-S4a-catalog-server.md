---
id: PHASE1-S4a
title: The catalog on the server — the catalog_revision row, the four catalog tables, catalogWrite and the catalog domain (plan S4, consult C1 §2, ADR-012 Part 2)
category: feature
touches: [money, boundaries]
depends_on: [PHASE1-S3b]
owns: [db/migrations/0013_catalog.sql, apps/server/src/domain/catalog.ts, apps/server/test/**]
status: not-started
cycles: 0
---
# PHASE1-S4a — The catalog on the server

**Written** 2026-10-26 by the lead, from slice S4 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S4*), **ADR-012** Part 2
(`docs/decisions/ADR-012-versioned-configuration.md`, rules 9 to 14), **consult C1** §0 and §2
(`.agent/reviews/ARCH-018-c1-configuration-schema.md`), the check order in **consult C2**
(`.agent/reviews/ARCH-019-first-back-office-form.md`, *What the pattern needs from ADR-012*, item 4), and the two
design slices whose rules this server must hold: **DESIGN-019** (BO-03 Menu, `.agent/tasks/DESIGN-019-menu.md`,
Handoff, the rules table) and **DESIGN-020** (BO-04 Item editor, `.agent/tasks/DESIGN-020-item-editor.md`, Handoff,
*Rules S4a, S4b and S4c can copy*, and *Round 2*). The plan splits S4 into **S4a** (this task: schema, grants, the
domain, the version advance and the stale refusal), **S4b** (the back-office catalog routes and `CATALOG_CHANGED` in
the contracts) and **S4c** (BO-03 and BO-04). S4a has **no route, no contract change and no client change**.

Where this file and C1 differ, this file wins; where this file and ADR-012 differ, stop and write `BLOCKED:
<question>`. C1's SQL is a sketch: verify every line against PostgreSQL 16 and the tests.

## Objective

A catalog exists on the server, empty (B-24), behind one coordination row: categories, items with a tax-inclusive
base price, single-select variants with a signed price change and multi-select modifiers with a non-negative price
change, each belonging to one item. Archive replaces delete for categories and items, and removal (set inactive)
replaces delete for options (B-8). Every catalog write goes through one helper that locks `catalog_revision` first,
refuses a stale edit with nothing written, and advances the version by exactly one when it wrote anything. A read
returns the version and the contents from one snapshot. S4b puts routes on these functions; S5 adds the 86 commands
through the same helper; S6a adds discount presets through it.

## Decided: do not reopen

- **ADR-012 (accepted 2026-10-20)**, rules 9 to 14, binding. In short: one global catalog version on one seeded row
  at 0 (rule 9); every committed catalog write advances it by exactly one, however many rows it writes, a restore
  included, and a no-op advances nothing (rule 10); a read reporting the version reads it in the same snapshot as the
  contents (rule 11); **edits carry the version and are refused stale; creates and state commands (archive, restore)
  carry none** (rule 13); every catalog write takes the row `FOR UPDATE` before it reads anything it validates, never
  `FOR KEY SHARE` or `FOR NO KEY UPDATE` (rule 14).
- **C2's check order** (item 4 of *What the pattern needs from ADR-012*): **lock, then version, then the domain
  checks**, so a stale command is refused stale before it is judged on stale assumptions (a stale edit of an unknown
  id is `STALE`, not `NOT_FOUND`).
- **Owner, Q10 (DECISIONS 2026-10-20):** categories and items are archived and restored, never deleted. **Q11:**
  nothing in Phase 1 is audited except user management: no audit entry here. **Q5:** IDR at precision 0 is an
  installation constant; prices are integer minor units.
- **ADR-012 *Not decided here*, last bullets:** a removed variant or modifier is **not restored**; re-adding the name
  makes a new option.
- **DESIGN-019 and DESIGN-020 names** (lead rulings, recorded in those task files): category name 1–32, item name
  1–64, variant and modifier name 1–32; each trimmed, no control character. **Lengths are code points** (zod 4.6.5
  and PostgreSQL's `char_length` both count them; S2b Handoff, decision 1). The "UTF-16 units" wording in DESIGN-019,
  C2 §4 and older comments is wrong: do not copy it into a new comment. Correcting the old comments is a separate
  queued cleanup, not this task.
- **Uniqueness, case-insensitive, among active rows only:** a category name among active categories; an item name
  among active items **across the whole menu** (an item in an archived category is still active and still holds its
  name); a variant name among the item's active variants; a modifier name among the item's active modifiers (a variant
  and a modifier may share a name). Archived and removed rows may share names.
- **Prices** (DESIGN-020, C1 §2.2): base price 0 to 99.999.999; variant change −99.999.999 to 99.999.999; modifier
  change 0 to 99.999.999. Integer minor units, `bigint` in the database, `Money` (`bigint`) in TypeScript, never a JS
  `number` and never a float. FR-C2's floor at zero applies when a line is priced (Phase 2), not when a change is
  stored: a variant of −99.999.999 on a base of 100.000 is stored. **DESIGN-020 question 2 (lead, 2026-10-22):** a
  variant whose base plus change exceeds the 99.999.999 line maximum is **not refused** in Phase 1; Phase 2's add-line
  enforces FR-M5.
- **No group, nesting, parent, default variant, stock, image, ex-tax price or shared modifier library** (FR-C4, C1
  §2.2 notes, SCREEN-INVENTORY BO-04 *Must not invent*). A variant's or modifier's `item_id` never changes.
- **The migration is `0013`** (S3a added `0012`).

## The shape (lead rulings, 2026-10-26)

1. **Migration `0013_catalog.sql`.** Write it in `0012`'s style (comments saying why; the check constraint shape
   `char_length(name) BETWEEN 1 AND N AND name !~ '^\s|\s$' AND name !~ '[[:cntrl:]]'`, which S2a verified matches C0
   and C1 controls under this database's UTF8).
   - **`catalog_revision`** as C1 §2.1: `is_singleton boolean PRIMARY KEY DEFAULT true` with `CHECK (is_singleton)`;
     `version integer NOT NULL DEFAULT 0` with `CHECK (version >= 0)`; **one seeded row**, `INSERT INTO catalog_revision
     DEFAULT VALUES`. Grants: `SELECT` and `UPDATE (version)` to `pos_app`, nothing else. **Adopt C1's recommended
     trigger:** a `BEFORE UPDATE` row trigger, through a new function created in this migration, that refuses any update
     where `NEW.version <> OLD.version + 1`. Its message names no row content.
   - **`menu_category`, `menu_item`, `menu_item_variant`, `menu_item_modifier`** with exactly C1 §2.2's columns, price
     checks and display-order checks, and the name checks above (32, 64, 32, 32). Grants exactly C1 §2.2's: `SELECT,
     INSERT` on the four; `UPDATE (name, display_order, is_active)` on `menu_category`; `UPDATE (category_id, name,
     base_price, display_order, is_available, is_active)` on `menu_item`; `UPDATE (name, price_delta, display_order,
     is_active)` on each option table. No `DELETE`, no grant on `item_id`, `id` or `created_at`. **No catalog row is
     seeded.** `is_available` is created here and written by S5; S4a writes it only through `DEFAULT true`.
   - **Partial unique indexes**, each the authority for its rule (no command pre-checks, as `0012`):
     `menu_category_active_name_key ON menu_category (lower(name)) WHERE is_active`;
     `menu_item_active_name_key ON menu_item (lower(name)) WHERE is_active`;
     `menu_item_variant_active_name_key ON menu_item_variant (item_id, lower(name)) WHERE is_active`;
     `menu_item_modifier_active_name_key ON menu_item_modifier (item_id, lower(name)) WHERE is_active`.
     No unique index on `display_order` (C1 §2.2: ties are broken by name on screen).
2. **`catalogWrite`**, exported from `apps/server/src/domain/catalog.ts`, is the only way any catalog command writes
   (S5 and S6a will reuse it). In one `withTransaction` (the default `READ COMMITTED`, so each statement after the lock
   sees what committed before it):
   1. `SELECT version FROM catalog_revision FOR UPDATE` is the **first statement**;
   2. if the command carries an expected version and it differs, answer `STALE` and write nothing;
   3. run the command's body, which reports whether it wrote anything;
   4. if it wrote, `UPDATE catalog_revision SET version = version + 1 RETURNING version`;
   5. answer the version now current (advanced, or unchanged on a no-op).
   A command that carries no version passes "none" (not `0`: version 0 is a real version, the empty catalog). Type it
   so a versioned command cannot pass "none" by accident.
3. **Outcomes.** As `tender-method.ts` and `settings.ts`, the domain returns outcomes and S4b raises the `AppError`s.
   One union for every catalog command:
   - `OK { version, record }` — wrote, `version` is the advanced one;
   - `UNCHANGED { version, record }` — nothing to write, `version` is the current one;
   - `STALE` — the expected version is not current, or (rule 4) an archived category was named as a destination;
   - `NOT_FOUND` — an unknown category, item, or option id (rule 4);
   - `DUPLICATE { of: 'CATEGORY' | 'ITEM' | 'VARIANT' | 'MODIFIER' }` — SQLSTATE `23505` on one of the four named
     indexes, matched by constraint name; S4b decides what crosses the wire (`DUPLICATE` is bare today);
   - `INVALID` — a command whose shape only the stored state can judge (rule 4); S4b answers it `VALIDATION_FAILED`
     with no details.
   Any other database error is a fault, replaced by a fixed-message `Error` with no cause (a PostgreSQL `detail` quotes
   the name; ADR-010 rule 2, B-12), exactly as `tender-method.ts` does. `record` is the category, the item (with all
   its variants and modifiers, active and removed, each with `isActive`), or for a reorder the scope's records in their
   new order, read in the command's own transaction.
4. **The commands**, each through `catalogWrite`. Names are binding for S4b; parameter shapes may be refined if the
   Handoff says how.

   | Command | Carries the version | Refusals besides `STALE` on a version mismatch |
   |---|---|---|
   | `createCategory(name)` | No | `DUPLICATE` |
   | `editCategory(categoryId, expected, { name })` | Yes | `NOT_FOUND`; `DUPLICATE` (only when the category is active) |
   | `reorderCategories(expected, categoryIds)` | Yes | `INVALID` unless the list is exactly the active categories, each once |
   | `archiveCategory(categoryId)`, `restoreCategory(categoryId)` | No | `NOT_FOUND`; restore into a held name `DUPLICATE` |
   | `createItem({ categoryId, name, basePrice, variants, modifiers })` | No | `NOT_FOUND` (category); **`STALE` when the category is archived**; `DUPLICATE` (item, or two options in one list) |
   | `editItem(itemId, expected, changes)` | Yes | `NOT_FOUND` (item or option); `STALE` on a move to an archived category; `DUPLICATE`; `INVALID` |
   | `reorderItems(categoryId, expected, itemIds)` | Yes | `NOT_FOUND` (category); `STALE` when the category is archived; `INVALID` unless the list is exactly that category's active items, each once |
   | `archiveItem(itemId)`, `restoreItem(itemId)` | No | `NOT_FOUND`; restore into a held name `DUPLICATE` |
   | `readCatalog()` | — | — |

   - **`reorderItems`** is the lead's addition to C1's table (DESIGN-019's open question): it mirrors
     `reorderCategories` for one category's items.
   - **An archived category named as a destination** (a create into it, a move into it, a reorder of its items) is
     `STALE`, as C1 §2.3 says for create and move: BO-03 never offers these on an archived category, so the only way to
     name one is a read from before it was archived. Nothing is written.
   - **Archive and restore change one flag and nothing else.** Archiving a category changes no item; archiving an item
     changes none of its options. Restoring an item whose category is archived is allowed (it stays hidden from the POS
     until the category is restored). Editing an archived category or item is allowed, and so is renaming an archived
     one to a name an active row holds (inactive rows are not in the index).
   - **No-ops write nothing and advance nothing**, and answer `UNCHANGED` with the current version: a rename to the
     identical name (a change of case alone is a change), a reorder into the current order, archiving an archived row or
     restoring an active one, and an `editItem` whose every change equals the stored state.
   - **Display order** (C1 §2.2, DESIGN-019): a new category goes last among **all** categories (largest order plus
     one); a new item last among all items of its category; a moved item last in its new category. A reorder rewrites
     the scope's active rows to 0…n−1 and leaves archived rows' stored order alone. A create's options take their given
     order.
5. **`editItem`'s change list** (C1 §2.3; DESIGN-020 *What one save carries*). An explicit list, never a replacement:
   - `fields`: any of `name`, `basePrice`, `categoryId`, only those that change;
   - for `variants` and for `modifiers` each: `added` (each `{ key, name, priceDelta }`, `key` a string the client
     chose, unique within the list), `edited` (each `{ id, name?, priceDelta? }`), `removed` (ids, set inactive),
     and an optional `order` (every option of the list that will be active after the save, as `{ id }` or `{ key }`,
     each once).
   - **`NOT_FOUND`** when an `edited` or `removed` id is not an **active** option of this item in that list (another
     item's option, a variant id under `modifiers`, an already removed option), writing nothing (C-19).
   - **`INVALID`** when an id appears twice across `edited` and `removed`, a `key` repeats, or `order` is present and
     is not exactly the list's final active set. Without `order`, surviving options keep their order and added ones go
     last in the order given; with it, the list's active rows are rewritten 0…n−1.
   - It is applied in one transaction under one version check and advances the version **once**.
6. **DESIGN-020 question 1, the swap (lead ruling, 2026-10-26; yours to overturn, owner).** The screen's rule is
   "unique among the item's active options **after** the save", and BO-04 lets one save swap two option names, or
   remove an option and add another with its name. A non-deferrable partial unique index is checked row by row, so
   applying such a save naively collides mid-transaction. **Mechanism: temporary deactivation inside the
   transaction, keeping the plain partial unique indexes.** For each list, in this order:
   1. set the `removed` options inactive;
   2. set inactive every `edited` option whose **name** changes;
   3. write the edits (names and price changes) to those rows and the price-only edits to theirs;
   4. set the renamed options active again, in one statement;
   5. insert the `added` options;
   6. apply the order.
   Every intermediate state is invisible to other transactions (one transaction), and catalog writes are serialised by
   the `catalog_revision` lock, so no other writer interleaves. A real duplicate in the final state (a rename onto an
   untouched active option, two added options with one name) still fails on the index at step 4 or 5 and is
   `DUPLICATE`, with everything rolled back. **Why not the alternative:** a deferrable exclusion constraint (`EXCLUDE
   USING btree (item_id WITH =, lower(name) WITH =) WHERE (is_active) DEFERRABLE`) would also work, but it raises
   `23P01` at `COMMIT` instead of `23505` at the statement, gives the option tables a different uniqueness mechanism
   from every other table, and moves the failure point outside the body that maps it. If you find a case the sequence
   gets wrong, stop and write `BLOCKED:` with it; do not switch mechanism on your own.
7. **`readCatalog()`** answers `{ version, categories, items }` from **one snapshot** (ADR-012 rule 11): either one
   statement, or a transaction whose first statement is `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`
   inside `withTransaction` (do not change `pool.ts`). Every row is included, archived and removed ones marked
   (`isActive`), with `isAvailable` on items. Order: by `display_order`, then `id`; grouping and tie-breaking by name
   are the screens' (S4c). Prices come back as `Money` through `BigInt` of the database's string, never `Number`.
   No single-item read: S4b decides whether BO-04 needs one.
8. **Not decided here, and left alone:** routes, request schemas, `CATALOG_CHANGED` in the contracts, the wire shape
   of `DUPLICATE`'s subject and of `editItem`'s change list (S4b); the 86 commands (S5); presets (S6a); the POS
   projection and poll (C4, S7). Say in the Handoff that `catalogWrite` is exported and how S5 and S6a call it.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing for the stated reason, revert, and report. The C-numbers are
C1 §2.4's cases. Catalog integration tests go in a new `apps/server/test/catalog.test.ts`, calling the domain
directly (as `throttle.test.ts` and `session.test.ts` do). **Assert versions relative to the version read at the start
of each case**: the trigger refuses resetting the counter, and the file resets the database once (`beforeAll`), then
`TRUNCATE`s the four catalog tables on the owner connection per case.

**Schema (`schema.test.ts`, which resets per case)**

1. **C-1.** Case 1's privilege map gains the five tables with exactly rule 1's grants, column by column.
   *Red:* grant `UPDATE (item_id)` on `menu_item_variant`: case 1 fails.
2. **C-2.** `catalog_revision` holds exactly one row, version 0, after migration; a second row is refused as the owner
   (by the key, and with `is_singleton = false` by the check). *Red:* drop the seed insert: the case fails.
3. **C-3.** As `pos_app`: `INSERT` and `DELETE` on `catalog_revision` refused; `UPDATE … SET version = version + 1`
   succeeds; `SELECT … FOR UPDATE` and `SELECT … FOR SHARE` succeed. *Red:* grant `UPDATE` on nothing (drop the column
   grant): the lock statements fail *permission denied*.
4. **C-4.** As `pos_app`: `DELETE` and `TRUNCATE` refused on each of the four catalog tables, and an `UPDATE` of `id`,
   `created_at` or an option's `item_id` refused. *Red:* grant `DELETE` on `menu_item`: its case fails.
5. **C-5.** As the owner: an update of the version by 2, by −1, or to the same value is refused by the trigger; by +1
   it succeeds. *Red:* drop the trigger: the +2 update succeeds.
6. **C-6.** Price checks: `base_price` −1 and 100000000 refused, 0 and 99999999 accepted; variant change −100000000
   and 100000000 refused, −99999999 and 99999999 accepted; modifier change −1 and 100000000 refused, 0 and 99999999
   accepted. *Red:* give the modifier the variant's bound: −1 is stored.
7. **C-7.** Name checks on each table: blank, untrimmed, over-length (33 code points on a category, variant and
   modifier; 65 on an item) and ESC refused; the maximum in emoji (32, or 64 for an item) accepted. *Red:* drop the
   `[[:cntrl:]]` clause on `menu_item`: ESC is stored.
8. **C-8.** The column lists (name, type, nullability) of all five tables equal lists written in the test: no group,
   parent, stock, default, image or ex-tax column. *Red:* add `parent_modifier_id` to `menu_item_modifier`: the list
   differs.
9. **C-9.** The four catalog tables are empty after migration (B-24). *Red:* seed a category: the case fails.
10. **Uniqueness backstop.** Per index: two active rows with one name in different case are refused `23505`; an
    inactive row may share a name with an active one and with another inactive one; two items' variants may share a
    name; a variant and a modifier of one item may share a name. *Red:* index `name` instead of `lower(name)` on
    `menu_item_variant`: the case-variant insert is stored.
11. `MIGRATED_TABLES` in `harness-race.test.ts` gains the five tables. Case 14 (no float, numeric or money column)
    covers them without change and stays green.

**Domain (`catalog.test.ts`)**

12. **C-10, C-11.** Table-driven: every command in rule 4, applied to a real change, answers `OK` with the version
    exactly one above the case's start, and the row reads back as answered; `createItem` with three variants and two
    modifiers advances by one, not six. *Red:* skip the advance in `restoreItem`: its row fails.
13. **C-12.** Each no-op in rule 4 answers `UNCHANGED` with the current version and writes nothing (`xmin` of the row,
    and the version, unchanged). *Red:* advance unconditionally in `catalogWrite`: the version moves.
14. **C-13.** A stale `editItem`, `editCategory`, `reorderCategories` and `reorderItems` (expected one behind) each
    answer `STALE`, and the rows and the version are unchanged; a stale `editCategory` of an **unknown** id is `STALE`,
    not `NOT_FOUND` (check order). *Red:* remove the comparison: the edit is written.
15. **C-14.** The decision is made under the lock: the owner holds `catalog_revision` `FOR UPDATE` in an open
    transaction; an `editItem` carrying the current version is started; the test waits until a `pos_app` backend is
    waiting on a lock (S1a's `waitingBackends()` in `tables.test.ts`); the owner advances the version and commits; the
    edit answers `STALE` and writes nothing. Commit the owner in `finally`. *Red:* move the `FOR UPDATE` after the
    version comparison (or drop it): the edit is written.
16. **Unversioned commands still serialise.** With the owner holding the row `FOR UPDATE`, a `createCategory` and an
    `archiveItem` each do not return before the owner commits; with the owner holding it `FOR SHARE`, the same.
    (The second is the property Phase 2's add-line and Phase 4's lease acquisition will rely on.) *Red:* skip the lock
    in `catalogWrite` when no version is carried: the create returns at once.
17. **C-15.** `createItem`, `createCategory`, archive and restore succeed after other catalog writes the caller never
    read (they carry none). No red beyond rule 2's typing; say so.
18. **C-16 and the archived destination.** `createItem` into an archived category, `editItem` moving an item into
    one, and `reorderItems` of one each answer `STALE` and write nothing; into an unknown category each is
    `NOT_FOUND`. *Red:* check only that the category exists: the create is written.
19. **C-17, Q10.** Archive and restore keep every row; each advances the version by one; a restored item and category
    read back as before. Archiving a category leaves its items' rows untouched (`xmin`); archiving an item leaves its
    options' rows untouched. Restoring an item whose category is archived succeeds. *Red:* make `archiveCategory`
    also archive its items: the items' `xmin` changes.
20. **Names held across rulings** (DESIGN-019 and DESIGN-020 meet here). An item in an archived category still holds
    its name: a `createItem` elsewhere with that name, in any case, is `DUPLICATE { of: 'ITEM' }`. Restoring an
    archived item, or an archived category, into a name an active row holds is `DUPLICATE` and writes nothing. An
    archived category or item may be renamed into a held name. `createCategory`, `editCategory` and `createItem` each
    answer `DUPLICATE` with the right `of` when an active row holds the name in another case. *Red:* map every `23505`
    to `DUPLICATE { of: 'ITEM' }`: the category case fails on `of`.
21. **C-19.** `editItem` naming another item's option, a variant id under `modifiers`, or an already removed option
    (in `edited` or `removed`) answers `NOT_FOUND` and writes nothing. *Red:* look options up by id alone: the other
    item's option is edited.
22. **`INVALID`.** `reorderCategories` and `reorderItems` with a list missing one active row, with an extra (archived
    or unknown) id, or with a repeat, each answer `INVALID`; so does an `editItem` with an id in both `edited` and
    `removed`, a repeated `key`, or an `order` that is not the final active set. Nothing is written. *Red:* accept a
    reorder list that is a subset: the reorder is written.
23. **The swap (rule 6).** In one `editItem`: two variants' names swapped (`Small`↔`Large`) succeeds, both active,
    names swapped, version +1; a case-only rename (`large`→`Large`) succeeds; removing `Regular` and adding a new
    `Regular` succeeds, the old row inactive and the new one active; a rename onto an untouched active variant's name
    is `DUPLICATE { of: 'VARIANT' }` with nothing written and the version unchanged; two added modifiers with one name
    are `DUPLICATE { of: 'MODIFIER' }`. *Red (two, each reverted):* apply the renames without steps 2 and 4: the swap
    answers `DUPLICATE`; apply additions before removals: the remove-and-add case answers `DUPLICATE`. Also show that
    omitting step 4 leaves the renamed options inactive and the swap case fails.
24. **Order.** A create's options take the given order; `editItem` without `order` puts added options last; with
    `order`, the active options read back in exactly that order; a moved item goes last in its new category; a reorder
    leaves archived rows' `display_order` unchanged. *Red:* rewrite every row of the scope, archived included: the
    archived row's order changes.
25. **C-18, one snapshot.** `readCatalog` returns a version and contents that belong together: with a second
    connection committing a price change and its version advance after `readCatalog`'s first statement, the read
    returns the old version with the old price. If `readCatalog` is one statement, say so and prove it by reading the
    code; if it is several, intercept the pooled client's `query` (e.g. `vi.spyOn`) to run the competing commit after
    the first statement. *Red:* remove the `SET TRANSACTION … REPEATABLE READ` line: the pair is mismatched.
26. **Money.** Prices round-trip exactly at the bounds (99999999, −99999999, 0) as `bigint`; a variant of −99999999
    on a base of 100000, and a variant of 99999999 on a base of 99999999, are each stored (FR-C2's floor and FR-M5's
    line maximum are Phase 2's). *Red:* read `base_price` with `Number(...)` and compare as `bigint`: the type check or
    the comparison fails.
27. **Faults.** A database error on a catalog table other than the four named indexes (provoke one by passing a
    65-code-point item name past the domain, which only the check refuses) becomes an `Error` with the fixed message,
    no `cause`, and the name in neither the message nor any log line. *Red:* rethrow the original error: the name
    appears.
28. **No audit.** No catalog command writes an audit entry (`audit_entry` count unchanged across every command and a
    refusal). No red; a guard, and the Handoff says so.
29. `npm run verify` green. The lead runs `npm run test:e2e:all` before merge (a migration lands); you may run it too
    and report it.

## Tests expected to change

- `apps/server/test/schema.test.ts`: case 1's privilege map gains the five tables; new `describe('catalog_revision')`
  and `describe('menu catalog')` (or one per table) for criteria 2 to 10.
- `apps/server/test/harness-race.test.ts`: the five tables in `MIGRATED_TABLES`.
- New: `apps/server/test/catalog.test.ts`.
- **Nothing else should change**: `route-table.test.ts`, `access.test.ts`, every contracts, api-client and client
  test. A change anywhere else is reported in the Handoff with its reason; a weakened assertion is not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file (`pool.ts`, `packages/money`, the contracts), stop and
  write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not run `db:migrate` on the development database `pos`;
  the lead does after the merge (the server refuses to start until it does, S0).
- No route, no contract, no audit entry, no idempotency key, no seed beyond `catalog_revision`'s row, no screen, no new
  error code. No `Number()` or `parseFloat` on a price.
- Fixtures create catalog rows through the domain functions, never by insertion, except where a schema case tests the
  database itself as the owner or `pos_app`.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `2573854` (S3b #137 and the lead's #138, #139 merged; the last two are records only). The lead's last
runs, of S3b's final tree, which has the same code: `npm run verify` 122 files, 4486 tests; `npm run test:e2e:all` 78
passed. Confirm the baseline before you start and state the new counts in the Handoff.

## Out of scope

- The routes, the request schemas, `CATALOG_CHANGED` in `packages/contracts`, both clients' code maps (S4b).
- BO-03 and BO-04 (S4c). The 86 commands (S5). Discount presets (S6a). The POS projection and poll (C4, S7).
- Restoring a removed option. Any single-item read. ARCHITECTURE §8 beyond what ADR-012 rule 14 already says.
- The code-point comments elsewhere (queued cleanup).

## Commit and report

Commit on `agent/phase1-s4a` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose: what was done (paths, commits); **what S4b needs** (every exported function's exact
signature and outcome type, the `DUPLICATE` subjects, the `INVALID` cases, `editItem`'s change-list type, how
`catalogWrite` is called with and without a version, and anything S5 and S6a must know to reuse it); what was decided
and on what evidence (in particular whether rule 6's sequence met any case it could not handle); tests changed and why;
each red proof (mutation, failure read, reverted); what was found and not fixed; the real `verify` output. End with
`DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff

