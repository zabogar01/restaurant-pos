# ARCH-018 — Consult C1: the configuration schema for S2a, S4a, S5 and S6a

> **Not binding.** This consult is the task-level half of ADR-012 (versioned configuration), written by `architect18`
> on 2026-10-20 for the lead's task files. ADR-012 is the decision; where this consult and ADR-012 differ, ADR-012 wins,
> and where this consult and a task file differ, the task file wins. It is written as ARCH-006 wrote migrations for
> PHASE0-003: to save each task's builder from re-deriving rules, not to bind them. **Every SQL block below is a
> sketch** for a builder to verify against PostgreSQL 16 and the tests; it is not code to paste. Names are proposals
> unless ADR-012 fixes them.
>
> **What it covers.** For slices S2a (settings versions), S4a (the catalog schema, its version and the domain), S5 (the
> 86 toggle) and S6a (discount presets): the tables and columns, the grants in each creating migration, the domain
> functions and their refusals, the test cases with the red proof for each, the tests expected to change, and how each
> reconciles with ARCH-006 §5 and the privilege-equality test.
>
> **What it leaves.** C2 (ARCH-019) owns how a route addresses one record, what a configuration command answers,
> `VALIDATION_FAILED`'s details, whether a list read is interactive, name uniqueness among active records, and the
> DiningTable lock. Where a slice below needs one of those, it says "per C2". C4 owns the POS catalog routes (S7).

## 0. Rules shared by the four slices

**Migrations.** Each slice adds one forward migration, numbered with the next free number when it is written (S1a's
table migration probably comes first). A migration that creates a table states that table's grants in the same file
(ARCH-006 §3); no `ALTER DEFAULT PRIVILEGES`, no grant on sequences, no `DELETE` on any table here. No migration seeds a
settings, category, item, option or preset row (B-24). The one seeded row is `catalog_revision`'s (ADR-012 rule 9).

**The privilege-equality test** (`apps/server/test/schema.test.ts`, case 1) gains an entry for each new table, written
out column by column where a grant is column-level; a table it does not name fails it, which is the point. **The table
list** (`apps/server/test/harness-race.test.ts`, `MIGRATED_TABLES`) gains each new table name. Case 14 (no `real`,
`double precision`, `numeric` or `money` column) covers every new table without change, and must stay green.

**Money and rates on the wire.** Prices, deltas and fixed amounts cross the API as canonical base-10 integer strings
of minor units through `encodeMoney`/`decodeMoney`; a JSON number is refused (B-1, ADR-004). Rates and percentage
values cross as canonical integer strings of **parts per million**. `packages/money` has no rate codec yet; S2a adds one
(`encodeRate`, `decodeRate`), mirroring the money codec: it refuses a JSON number, a sign, a leading zero, an exponent
and a fraction, and returns a `Rate` through `rateFromPpm`. The back office converts a typed percent with
`rateFromPercent` before sending; the server never parses a percent. Bounds are checked in the request schema (so an
out-of-range value is `VALIDATION_FAILED`, details per C2) and again by a database check (the backstop).

**Text that reaches paper.** Every business detail and every category, item, variant, modifier and preset name is
printed by an ESC/POS printer in Phase 3 or 4, where a control character is a printer command (ADR-012 rule 8). Each
such column refuses control characters in the database, and its request schema refuses them too. The request schema
also trims surrounding spaces before validating, and the database refuses a value that is blank or not trimmed. A
sketch of the check, for the builder to verify (in particular that `[[:cntrl:]]` matches C1 controls such as U+009B
under the database's encoding and collation, and if not, to spell the ranges out):

```sql
-- SKETCH. One shape per text column; N is the column's length guard.
CHECK (name = btrim(name) AND name <> '' AND char_length(name) <= N AND name !~ '[[:cntrl:]]')
```

The length guards below are recommendations, to be settled with the design slice that draws the field (F for BO-08 and
BO-07, D for BO-03 and BO-04), and stated in the task file.

**Codes.** `SETTINGS_CHANGED` enters `packages/contracts` in S2a and `CATALOG_CHANGED` in S4b, each with status 409, no
details, and a route test that emits it (ADR-010 rule 1; ADR-012 rules 3 and 13). Adding a code makes both clients'
exhaustive code maps (`apps/pos/src/session/realSession.ts`, `apps/back-office/src/session/realSession.ts`) fail to
compile until it is placed; the POS places both with its other unexpected codes. A record that does not exist is
answered per C2. No other new code is needed by these four slices: every refusal below maps to `VALIDATION_FAILED`,
one of the two version codes, or C2's not-found answer.

**Red proofs.** Each test below names the change that must make it fail. The builder makes that change once, sees the
test fail for the stated reason, and reverts it; the Handoff records that it did. A test with no observed red is not
evidence.

**Concurrency tests** follow the pattern of `throttle.test.ts` cases 12 and 13: an owner connection takes the lock or
writes the competing row inside an open transaction, the domain call is started, the test waits until a backend is
waiting (`waitingBackends()`), changes state under the lock, commits, and asserts that the call decided from what it
read under the lock.

## 1. S2a — settings versions

### 1.1 The table

```sql
-- SKETCH (ADR-012 rules 1, 2, 5 to 8). Verify every line.
CREATE TABLE settings_version (
  -- The current version is the highest number (ADR-012 rule 2). Assigned by the
  -- server as current + 1; the key is what refuses a concurrent duplicate.
  version            integer PRIMARY KEY,
  tax_rate_ppm       bigint NOT NULL,
  service_rate_ppm   bigint NOT NULL,
  outlet_name        text NOT NULL,
  address            text NOT NULL,
  phone              text NOT NULL,
  npwpd              text,
  footer             text NOT NULL,
  -- Written by the server from a constant; never from a request (rule 6).
  calculation_policy smallint NOT NULL,
  created_by         uuid NOT NULL REFERENCES staff_user (id),  -- if the lead keeps it (1.6)
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT settings_version_version_check CHECK (version >= 1),
  -- Zero to 100 percent (FR-M5; owner 2026-10-20).
  CONSTRAINT settings_version_tax_rate_check CHECK (tax_rate_ppm BETWEEN 0 AND 1000000),
  CONSTRAINT settings_version_service_rate_check CHECK (service_rate_ppm BETWEEN 0 AND 1000000),
  CONSTRAINT settings_version_policy_check CHECK (calculation_policy = 1),
  -- Text checks as in section 0. The address alone may hold line feeds, at most two.
  ...
);
```

There is **no currency and no precision column** (ADR-012 rule 5): they are installation constants (`'IDR'`, `0`) in
shared code, which the settings view reports. The column-list test (1.4, S2-6) proves their absence.

Recommended length guards, to settle with design F: outlet name 1–64; address 1–200 with at most three lines (two line
feeds; no other control character); phone 1–32; NPWPD 1–32 when present; footer 1–120. A charset for the phone and the
NPWPD (digits, spaces, `+ - . ( )`) is a reasonable typing guard if the design wants one; it is not required by any
ruling.

The four required text fields and the optional NPWPD are ADR-012 rule 8's reading of the owner's Q12 ("an optional
NPWPD"); if the lead reads the footer as optional too, `footer` becomes nullable with the same check when present.

### 1.2 Grants and immutability

```sql
-- SKETCH.
GRANT SELECT ON settings_version TO pos_app;
GRANT INSERT (version, tax_rate_ppm, service_rate_ppm, outlet_name, address, phone,
              npwpd, footer, calculation_policy, created_by)
  ON settings_version TO pos_app;

CREATE TRIGGER settings_version_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON settings_version
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change_to_immutable();
```

`SELECT` and `INSERT` only, the insert column-level so the application cannot choose `created_at` (as on
`audit_entry`). The trigger stops the owner, a migration and a test from rewriting a version an order will refer to.
`reject_change_to_append_only()` (0004) could be reused, but its message names B-7, which is the audit log's boundary;
a second function with a neutral message, created in this migration, is cleaner. The test reset drops the schema, which
the `audit_entry` trigger already shows is unaffected.

### 1.3 The domain (`apps/server/src/domain/settings.ts`)

- `readCurrentSettings(db)`: the version with the highest number, or `null` when none exists. One statement.
- `saveSettings(db, { actorId, expectedVersion, values })`, where `expectedVersion` is `number | null` and `values`
  holds the two rates as `Rate` and the five texts. In one transaction:
  1. read the highest number (`current`, or none);
  2. if `expectedVersion` differs from it (a number when none exists, `null` when one exists, or a different number),
     refuse `SETTINGS_CHANGED` and write nothing;
  3. if every value equals the current version's, write nothing and answer `unchanged` with the current number;
  4. insert `current + 1` (or 1), with `calculation_policy` from the server's constant;
  5. a unique violation on the primary key is the same stale condition reached concurrently: refuse
     `SETTINGS_CHANGED`. Any other database error stays an error.
- The values type has no currency, precision or policy field, so none can be passed.

Refusals: `SETTINGS_CHANGED` (stale, including the concurrent case). Everything about the shape of the values (a JSON
number, a rate out of range, a blank or over-long text, a control character, an unknown field such as `currency`) is
refused at the boundary as `VALIDATION_FAILED`, details per C2, before the domain runs. The routes (a read and one
command) are declared `ACTIVE` on the back-office surface; the command is interactive. Their paths and answers are per
C2, and must carry the version numbers ADR-012 rule 15 asks for.

### 1.4 Test cases

**Schema (`schema.test.ts`)**

| # | Case | Red proof |
|---|---|---|
| S2-1 | Case 1's map gains `settings_version`: table `['SELECT']`, and `INSERT` on each of the ten insertable columns | Grant `UPDATE`, or table-level `INSERT`: case 1 fails |
| S2-2 | As `pos_app`: `UPDATE`, `DELETE` and `TRUNCATE` are each refused with *permission denied*; an insert supplying `created_at` is refused | Grant `UPDATE`: the `UPDATE` reaches the trigger and the code differs (P0001, not 42501) |
| S2-3 | As the owner: `UPDATE`, `DELETE` and `TRUNCATE` are each refused by the trigger, with the table empty and with a row | Drop the trigger: the owner's statements succeed |
| S2-4 | Each rate: `-1` and `1000001` refused by its check; `0` and `1000000` accepted | Remove a check or move a bound: a refused value is stored |
| S2-5 | `version` 0 refused; a duplicate `version` refused (23505); `calculation_policy` 2 refused | Remove the check or the key |
| S2-6 | The column list (name, type, nullability) equals the list written in the test; in particular, no currency or precision column | Add a `currency` column: the list differs |
| S2-7 | Text checks: a blank or untrimmed outlet name refused; ESC (U+001B) and U+009B in the outlet name refused; a line feed in the address accepted and in the outlet name refused; a third line feed in the address refused; a null NPWPD accepted, a null phone refused | Remove the control-character clause: ESC is stored |
| S2-8 | The table is empty after migration (B-24) | Add a seed insert to the migration |

**Domain integration (a new `settings.test.ts`)**

| # | Case | Red proof |
|---|---|---|
| S2-9 | The first save, with no expected version, writes version 1, which is then current | Start numbering from the expected value: the first save fails or writes 0 |
| S2-10 | A save with the current number writes the next; every earlier version reads back column for column unchanged (FR-B1) | An implementation that updates the current row: the earlier version's values change |
| S2-11 | A save carrying an older number is refused `SETTINGS_CHANGED`; the row count and the current version are unchanged | Remove the comparison: a version is written |
| S2-12 | A save carrying no number when a version exists is refused `SETTINGS_CHANGED` | Treat `null` as "any": a version is written |
| S2-13 | Concurrency: the owner inserts version N+1 in an open transaction; a save with expected N is started and waits; the owner commits; the save is refused `SETTINGS_CHANGED` and exactly one version N+1 exists | Remove the 23505 mapping: the save fails as an internal error. Replace the key with a plain index: two versions N+1 exist |
| S2-14 | An identical submission writes nothing and answers the current number | Remove the comparison: a duplicate version is written |
| S2-15 | A change of the footer alone writes a new version (ADR-012 rule 4) | Version only on rate changes: no version is written |
| S2-16 | A service-charge rate of 11 percent (110000) is stored (owner, Q3) | A refusal of non-zero service charge |
| S2-17 | Every written version has `calculation_policy` 1 | Not testable as a red by input, since no input carries it; S2-5 proves the database refuses any other value |

**Boundary and routes**

| # | Case | Red proof |
|---|---|---|
| S2-18 | The rate codec: `'0'`, `'1000000'` decode; a JSON number, `'-1'`, `'01'`, `'1e6'`, `'1.5'`, `''` are refused (`packages/money` tests) | Decode with `Number()`: the number and `'1e6'` pass |
| S2-19 | The command refuses, as `VALIDATION_FAILED`: a rate sent as a JSON number, `'1000001'`, a control character in any text, an unknown field `currency` or `minorUnitPrecision` (strict object) | A non-strict schema: `currency` is accepted and ignored |
| S2-20 | A stale command answers 409 with `{ "error": { "code": "SETTINGS_CHANGED" } }` and no details; the envelope validates against `ErrorBody` | Answer `VERSION_CONFLICT` or add details |
| S2-21 | The settings read reports currency `IDR` and precision 0, from the shared constants | Hard-code them in the route: still green, so the test imports the constants and compares to them |
| S2-22 | A POS session is refused on both routes; the route table equals the registered routes (the existing access and route-table tests, extended) | Declare the route on the POS surface: the access test fails |

**Tests expected to change in S2a:** `schema.test.ts` case 1's expected map; `harness-race.test.ts`'s
`MIGRATED_TABLES`; the route-table and access tests (new routes); both clients' `realSession.ts` code maps (a compile
error, not a test); `packages/money`'s tests (the rate codec). No existing assertion should change meaning.

### 1.5 Reconciliation with ARCH-006 §5

| ARCH-006 §5 | Now |
|---|---|
| Do not create `settings_version` in Phase 0; its first writer is the Phase 1 settings screen | S2a creates it, with its first writer and reader |
| Rate `>= 0`: representational, keep | Kept |
| Rate `<= 1000000`: a business range, remove pending PRD §9 | Reinstated as the owner's ruling (FR-M5, 2026-10-20), not as a representational check |
| Precision `>= 0`, `<= 6`; currency `^[A-Z]{3}$` | No column: currency and precision are constants (ADR-012 rule 5) |
| Rate and money columns `bigint` | Kept; case 14 proves it |
| The current version cannot be ordered by a `uuid` and `created_at` | A server-assigned integer key; the highest is current (ADR-012 rule 2) |
| FR-M1's immutability after the first order is a check against other rows | Moot: nothing to check |
| No settings row is seeded | Kept (S2-8) |

### 1.6 Recommended, for the lead to decide

`created_by`: the manager who saved the version, a foreign key to `staff_user`. It answers "who set this rate?" when a
wrong rate is found, and costs a column. It is attribution on the record, not an audit entry; the owner ruled settings
changes unaudited (Q11), and this does not contradict that, but it is a product-visible fact no ruling asked for. If
the lead drops it, remove it from the table, the grant and S2-1.

## 2. S4a — the catalog schema, its version and the domain

### 2.1 The coordination row

```sql
-- SKETCH (ADR-012 rules 9, 10, 14).
CREATE TABLE catalog_revision (
  -- At most one row: the key can only be true.
  is_singleton boolean PRIMARY KEY DEFAULT true,
  -- The catalog version (the revision the POS polls). 0 is the empty catalog.
  version      integer NOT NULL DEFAULT 0,

  CONSTRAINT catalog_revision_singleton_check CHECK (is_singleton),
  CONSTRAINT catalog_revision_version_check CHECK (version >= 0)
);

-- The one seeded row. Not configuration: a counter and a lock point, seeded for
-- the reason the throttle rows are (ARCH-006 §5), so commands only ever update it.
INSERT INTO catalog_revision DEFAULT VALUES;

GRANT SELECT ON catalog_revision TO pos_app;
-- UPDATE on the counter alone. It is also what lets pos_app lock the row
-- FOR UPDATE and FOR SHARE (PostgreSQL requires UPDATE on at least one column).
GRANT UPDATE (version) ON catalog_revision TO pos_app;
```

**Recommended:** a `BEFORE UPDATE` row trigger that refuses any update other than `NEW.version = OLD.version + 1`, so
the version is monotonic by construction (ARCHITECTURE §4.3, "a monotonic catalog revision") rather than by every
command's care. It costs a few lines and one test (C-5).

### 2.2 The catalog tables

```sql
-- SKETCH. Text checks as in section 0 on every name.
CREATE TABLE menu_category (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  display_order integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,   -- false = archived (FR-B4, FR-C8)
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_category_display_order_check CHECK (display_order >= 0)
);

CREATE TABLE menu_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES menu_category (id),
  name          text NOT NULL,
  -- Tax-inclusive (FR-C1, PRD §4). At most the largest line total (FR-M5),
  -- since a dearer item could never be sold.
  base_price    bigint NOT NULL,
  display_order integer NOT NULL,
  is_available  boolean NOT NULL DEFAULT true,   -- false = 86'd (FR-C5)
  is_active     boolean NOT NULL DEFAULT true,   -- false = archived
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_base_price_check CHECK (base_price BETWEEN 0 AND 99999999),
  CONSTRAINT menu_item_display_order_check CHECK (display_order >= 0)
);

-- Single-select, signed delta (FR-C2). Belongs to one item for ever.
CREATE TABLE menu_item_variant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES menu_item (id),
  name          text NOT NULL,
  price_delta   bigint NOT NULL,
  display_order integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,   -- false = removed
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_variant_delta_check CHECK (price_delta BETWEEN -99999999 AND 99999999),
  CONSTRAINT menu_item_variant_display_order_check CHECK (display_order >= 0)
);

-- Multi-select, delta of zero or more (FR-C3). No group, no parent, no stock (FR-C4).
CREATE TABLE menu_item_modifier (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES menu_item (id),
  name          text NOT NULL,
  price_delta   bigint NOT NULL,
  display_order integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_modifier_delta_check CHECK (price_delta BETWEEN 0 AND 99999999),
  CONSTRAINT menu_item_modifier_display_order_check CHECK (display_order >= 0)
);

-- No DELETE on any of them: an order line will refer to these rows (B-8).
GRANT SELECT, INSERT ON menu_category, menu_item, menu_item_variant, menu_item_modifier TO pos_app;
GRANT UPDATE (name, display_order, is_active) ON menu_category TO pos_app;
GRANT UPDATE (category_id, name, base_price, display_order, is_available, is_active) ON menu_item TO pos_app;
GRANT UPDATE (name, price_delta, display_order, is_active) ON menu_item_variant TO pos_app;
GRANT UPDATE (name, price_delta, display_order, is_active) ON menu_item_modifier TO pos_app;
```

Notes for the task file:

- **ARCHITECTURE §5.1's "applicability" of a modifier** is the one item it belongs to (ADR-012's amendment). There is no
  shared modifier library and no modifier group: BO-04 edits an item's variants and modifiers as two lists on that item
  (`docs/design/SCREEN-INVENTORY.md` BO-04, *Must not invent*).
- **A variant's or modifier's `item_id` never changes** (no `UPDATE` grant on it), so an option cannot drift to another
  item under an order line that refers to it.
- **No `is_default` on a variant**, no stock or inventory column, no image, no ex-tax price, no nested group: none is in
  the contract.
- **Name uniqueness** follows C2's rule for active records. If C2 makes table labels unique among active tables, apply
  the same to category names, to item names, and to variant and modifier names **within one item**, by partial unique
  indexes on `lower(name)` `WHERE is_active`. Two active options of one item with one name would be indistinguishable on
  M-2 and on the kitchen ticket, so the within-item rule is recommended even if C2 decides otherwise for tables.
- **What the POS may offer** (for C4 and Phase 2): an item that is active, available, and in an active category. Archiving
  a category therefore hides its items without changing them, and restoring it shows them again; nothing is refused.
  This is reversible, so it needs no friction (ARCH-002's test). Design D should show it on BO-03.
- **Display order.** A new row goes last in its scope (the categories; the items of a category; the options of an item)
  at the largest order plus one; a reorder command sets the full order of one scope. No unique index on the order: a
  reorder rewrites many rows and ties are broken by name.

### 2.3 The domain (`apps/server/src/domain/catalog.ts`)

**One helper wraps every catalog write**, so that no command can forget the lock, the check or the advance:

```
catalogWrite(db, expectedVersion: number | null, body: (tx) => Promise<boolean /* wrote anything */>)
  BEGIN
  SELECT version FROM catalog_revision FOR UPDATE           -- first, before any read it validates (ADR-012 rule 14)
  if expectedVersion !== null and expectedVersion !== version → ROLLBACK, refuse CATALOG_CHANGED
  wrote = await body(tx)
  if wrote: UPDATE catalog_revision SET version = version + 1 RETURNING version
  COMMIT; answer the version now current
```

Never `FOR KEY SHARE` or `FOR NO KEY UPDATE` in its place. The commands (each through the helper):

| Command | Carries the version? (ADR-012 rule 13) | Refusals besides shape |
|---|---|---|
| `createCategory(name)` | No | none |
| `editCategory(id, expected, { name })` | Yes | `CATALOG_CHANGED`; unknown id per C2 |
| `reorderCategories(expected, ids)` | Yes | `CATALOG_CHANGED`; a list that is not exactly the active categories: `VALIDATION_FAILED` |
| `archiveCategory(id)`, `restoreCategory(id)` | No | unknown id per C2 |
| `createItem(categoryId, { name, basePrice, variants[], modifiers[] })` | No | an archived category: `CATALOG_CHANGED` (the only way to name one is a form read before it was archived); unknown category per C2 |
| `editItem(id, expected, changes)` | Yes | `CATALOG_CHANGED`, including a move to an archived category; an option id that is not this item's, per C2 |
| `archiveItem(id)`, `restoreItem(id)` | No | unknown id per C2 |
| `readCatalog(db)` | — | — |

`editItem`'s `changes` is an explicit list, not a replacement of the item: the fields that change (name, base price,
category), and for variants and for modifiers the ones added, the ones edited (by id, with their new name or delta),
the ones removed (by id, set inactive), and their new order. It is applied in one transaction under one check and
advances the version once. This is how BO-04's single Save stays one command without becoming the "complete
replacement" §4.4 and §13 forbid; its exact wire shape is S4b's, per C2.

`readCatalog` returns the version and every category, item and option **in one snapshot** (`REPEATABLE READ READ ONLY`,
or one statement; ADR-012 rule 11). Archived and removed rows are included, marked, because BO-03 shows archived items.

A command whose effect equals the stored state (an edit with unchanged values, archiving an archived item) writes nothing
and does not advance. Editing an archived item or category is allowed: it is not offered at the POS, and restoring it
should bring back what the manager last saw.

**S4a has no routes.** The routes and `CATALOG_CHANGED`'s entry into the contracts are S4b's.

### 2.4 Test cases

**Schema (`schema.test.ts`)**

| # | Case | Red proof |
|---|---|---|
| C-1 | Case 1's map gains the five tables with exactly the grants in 2.1 and 2.2 | Grant `DELETE` on `menu_item`, or `UPDATE` on `menu_item_variant.item_id`: case 1 fails |
| C-2 | `catalog_revision` holds exactly one row, version 0, after migration; a second row is refused by the owner (key and check) | Drop the seed, or make the key a serial |
| C-3 | As `pos_app`: `INSERT` and `DELETE` on `catalog_revision` refused; `UPDATE` of `version` succeeds; `SELECT ... FOR UPDATE` and `FOR SHARE` succeed | Grant `UPDATE` on nothing: the lock statements fail with *permission denied* |
| C-4 | As `pos_app`: `DELETE` refused on each catalog table | Grant `DELETE` |
| C-5 | (If the trigger is adopted) an update of the version by 2, by −1 or to the same value is refused | Drop the trigger |
| C-6 | Price checks: `base_price` −1 and 100000000 refused, 0 and 99999999 accepted; variant delta −100000000 refused, −99999999 accepted; modifier delta −1 refused, 0 accepted | Remove a check, or give the modifier the variant's bound |
| C-7 | Name checks on each table: blank, untrimmed and ESC refused | Remove the control-character clause |
| C-8 | The column lists of `menu_item_variant` and `menu_item_modifier` equal the lists in the test: no group, parent, stock or default column (FR-C4) | Add `parent_modifier_id`: the list differs |
| C-9 | The four catalog tables are empty after migration (B-24) | Seed a category |

**Domain integration (a new `catalog.test.ts`)**

| # | Case | Red proof |
|---|---|---|
| C-10 | Table-driven: each command in 2.3, applied to a real change, advances the version by exactly one | Skip the advance in one command: its row fails |
| C-11 | `createItem` with three variants and two modifiers advances the version by one, not six | Advance per row written |
| C-12 | An edit or archive that changes nothing advances nothing | Advance unconditionally |
| C-13 | A stale `editItem` (expected one behind) is refused `CATALOG_CHANGED`; the item, its options and the version are unchanged | Remove the comparison: the edit is written |
| C-14 | The decision is made from the version read under the lock: the owner holds `catalog_revision` `FOR UPDATE`; an `editItem` with the current version is started and waits; the owner advances the version and commits; the edit is refused `CATALOG_CHANGED` | Drop `FOR UPDATE` from the helper: the edit reads the old version before the owner commits and is written |
| C-15 | `createItem` and `archiveItem` succeed whatever version the client last saw (they carry none) | Make them carry and check it |
| C-16 | `createItem` into an archived category, and `editItem` moving to one, are refused `CATALOG_CHANGED` and write nothing | Check only that the category exists |
| C-17 | Archive and restore keep every row (no delete) and each advances the version; a restored item reads back as before (B-8, Q10) | Implement archive as a delete: the row is gone (and C-4 already refuses it) |
| C-18 | `readCatalog` is one snapshot: the read is started, a second connection commits a price change and an advance between its statements, and the read returns the old version with the old price | Read in `READ COMMITTED` statement by statement: the pair is mismatched |
| C-19 | `editItem` refuses an option id belonging to another item, writing nothing | Look options up by id alone |

**Tests expected to change in S4a:** `schema.test.ts` case 1's map; `MIGRATED_TABLES`. In **S4b** (routes): the
route-table and access tests, `packages/contracts` (the code, its envelope in `ErrorBody`, the request schemas with prices
as canonical strings), both clients' code maps, and a route test that a stale edit answers 409 `CATALOG_CHANGED` with no
details and that a price sent as a JSON number is `VALIDATION_FAILED`.

### 2.5 Reconciliation

ARCH-006 §5 named no catalog table. The privilege rule (grants in the creating migration, the equality test failing on
an unnamed table) holds for all five. The seeded `catalog_revision` row is the second seeded data after the throttle
rows, for the same reason; C-2 proves it as case 21 proves the throttle rows. The Phase 1 Definition of Done's B-24
line ("every new configuration table is empty after migration") is met by C-9, and `catalog_revision` is not a
configuration table (ADR-012 *Consequences*).

## 3. S5 — the 86 toggle

### 3.1 The commands

Two explicit commands, not a "set availability" with a requested value (ARCHITECTURE §4.4):

| Command | Carries the version? | Refusals besides shape |
|---|---|---|
| `markItemUnavailable(id)` | No (ADR-012 rule 13) | unknown id per C2 |
| `markItemAvailable(id)` | No | unknown id per C2 |

Each goes through `catalogWrite` with no expected version: it takes `catalog_revision` `FOR UPDATE` first, writes
`is_available` if it differs, and advances the version only then. An archived item may be marked either way; it is not
offered, and the flag is kept for when it is restored. No migration and no new table: S5 changes no grant.

**For Phase 4, in the task file verbatim:** FR-G13's check (refuse an 86 of an item that is on a pending line of a
quick-sale order holding an active CheckoutLease, naming that order) is added inside this command **after** the
`FOR UPDATE` it already takes, and lease acquisition on a quick-sale order takes the same row `FOR SHARE` before the
order and the lease. The lock order is catalog, then business day, then order, then lease (ADR-012 rule 14;
ARCHITECTURE §8). Phase 4 adds a check; it does not move the lock.

### 3.2 Test cases (`catalog.test.ts`, extended)

| # | Case | Red proof |
|---|---|---|
| S5-1 | Marking an available item unavailable writes `is_available = false` and advances the version by one; marking it available again advances it again | Skip the advance: the POS poll would never see the 86 |
| S5-2 | Marking an unavailable item unavailable writes nothing and advances nothing | Advance unconditionally |
| S5-3 | An `editItem` built before an 86 of a different item is refused `CATALOG_CHANGED` afterwards: availability advances the one version (ADR-012 rule 10; ROADMAP Phase 1) | A separate availability counter: the edit is written |
| S5-4 | An 86 succeeds after other catalog edits the caller never read (it carries no version) | Route it through a version check |
| S5-5 | The 86 waits for a shared holder: the owner takes `catalog_revision` `FOR SHARE` in an open transaction; the 86 is started and is seen waiting; the owner commits; the 86 completes. This is the property Phase 2's add-line and Phase 4's lease acquisition will rely on | Take the holder's lock as `FOR KEY SHARE`: the 86 does not wait, which is the hazard ADR-012 rule 14 names |
| S5-6 | Marking an archived item unavailable succeeds and advances the version | Refuse it |

**Tests expected to change in S5:** none beyond the new cases; the route-table and access tests gain S5's two routes if
S5 builds its own routes (the plan has S5 as "the command and the row action together").

## 4. S6a — discount presets

### 4.1 The table

```sql
-- SKETCH (FR-B5, FR-F4, FR-F5, FR-M5, B-21).
CREATE TABLE discount_preset (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  kind          text NOT NULL,
  -- Exactly one of these is set, by kind.
  rate_ppm      bigint,          -- PERCENTAGE: 0 to 100 percent (FR-M5)
  amount        bigint,          -- FIXED: minor units, at most the largest order total
  display_order integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,   -- false = deactivated (FR-F5)
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT discount_preset_kind_check CHECK (kind IN ('PERCENTAGE', 'FIXED')),
  CONSTRAINT discount_preset_value_check CHECK (
    (kind = 'PERCENTAGE' AND rate_ppm BETWEEN 0 AND 1000000 AND amount IS NULL) OR
    (kind = 'FIXED' AND amount BETWEEN 0 AND 99999999 AND rate_ppm IS NULL)),
  CONSTRAINT discount_preset_display_order_check CHECK (display_order >= 0)
  -- plus the text checks of section 0 on name
);

GRANT SELECT, INSERT ON discount_preset TO pos_app;
GRANT UPDATE (name, kind, rate_ppm, amount, display_order, is_active) ON discount_preset TO pos_app;
```

No date, time, schedule, trigger, minimum spend or stacking column (B-21, B-22). A fixed amount is capped at the subtotal
when it is applied (FR-M5), which is Phase 2's; storing an amount above a future subtotal is not an error. A value of
zero is within FR-M5's "0–100%" and is accepted; refusing it would be a business rule no ruling makes. Name uniqueness
among active presets per C2.

### 4.2 The commands

| Command | Carries the version? | Refusals besides shape |
|---|---|---|
| `createPreset({ name, kind, value })` | No | none |
| `editPreset(id, expected, { name?, kind?, value? })` | Yes | `CATALOG_CHANGED`; unknown id per C2 |
| `deactivatePreset(id)`, `reactivatePreset(id)` | No | unknown id per C2 |

All through `catalogWrite`; each real change advances the catalog version (FR-C7). On the wire a percentage is a ppm
string through the rate codec and a fixed amount a money string; the request schema refuses a value that does not match
its kind (a `FIXED` preset with a rate) as `VALIDATION_FAILED`.

### 4.3 Test cases

| # | Case | Red proof |
|---|---|---|
| S6-1 | Case 1's map gains `discount_preset` with exactly 4.1's grants; `MIGRATED_TABLES` gains it; the table is empty after migration | Grant `DELETE`; seed a preset |
| S6-2 | The value check: a `PERCENTAGE` with an amount, a `FIXED` with a rate, a rate of 1000001, an amount of −1 or 100000000, and an unknown kind are each refused; a 0 and a 1000000 rate, and a 0 and a 99999999 amount, are accepted | Loosen the check to `rate_ppm >= 0` |
| S6-3 | The column list equals the list in the test: no date, time or trigger column (B-21) | Add `valid_from` |
| S6-4 | Create, edit, deactivate and reactivate each advance the catalog version by one; a no-op advances nothing | Skip the advance for presets ("presets are not menu") |
| S6-5 | A stale `editPreset` is refused `CATALOG_CHANGED`, writing nothing | Remove the comparison |
| S6-6 | Deactivate keeps the row, readable with its name, kind and value (FR-F5); reactivate restores it (Q10) | Deactivate by delete (also refused by C-4's pattern, extended here) |
| S6-7 | The request schema refuses a value sent as a JSON number, a percentage above `'1000000'` ppm, and a kind–value mismatch, each as `VALIDATION_FAILED`. (The schema cannot tell a percent typed as `'10'` from 10 ppm; the back office's conversion with `rateFromPercent` is S6b's to test.) | Accept a number |

**Tests expected to change in S6a:** `schema.test.ts` case 1's map; `MIGRATED_TABLES`; the route-table and access tests.

## 5. What the task files still need from elsewhere

- **From C2:** route paths and how a record is addressed; what each command answers (ADR-012 rule 15's version numbers
  included); `VALIDATION_FAILED`'s details; the not-found answer; name uniqueness among active records; whether the
  list reads are interactive.
- **From design F and D:** the length guards and any charsets above; BO-08's first run (no version yet); the stale-draft
  state after M-6 on BO-04, BO-07 and BO-08 (ADR-012 *Consequences*); BO-03's view of items in an archived category.
- **From the lead:** whether `created_by` stays (1.6); whether the footer is required (1.1).
- **Not Phase 1:** the POS reads (C4, S7); the open-order capture and its refusal with no settings version, the
  add-line check, and the preset application (Phase 2); FR-G13 (Phase 4).
