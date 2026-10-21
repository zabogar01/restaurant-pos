---
id: PHASE1-S2a
title: Settings versions on the server — settings_version, the rate codec, the installation constants, the settings read and save routes (plan S2a, ADR-012, consult C1)
category: feature
touches: [money, boundaries]
depends_on: [PHASE1-S1b, DESIGN-018]
owns: [db/migrations/0011_settings_version.sql, apps/server/src/domain/settings.ts, apps/server/src/http/routes/back-office-settings.ts, apps/server/src/http/server.ts, packages/money/src/**, packages/money/test/**, packages/contracts/src/settings.ts, packages/contracts/src/routes.ts, packages/contracts/src/errors.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/back-office/src/session/api.ts, apps/back-office/src/session/realSession.ts, apps/pos/src/session/realSession.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**]
status: not-started
cycles: 0
---
# PHASE1-S2a — Settings versions on the server

**Written** 2026-10-21 by the lead, from slice S2 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S2*), **ADR-012** (versioned configuration,
accepted 2026-10-20, `docs/decisions/ADR-012-versioned-configuration.md`, Part 1, rules 1 to 8 and 15), **consult C1**
(`.agent/reviews/ARCH-018-c1-configuration-schema.md`, §0 and §1, copied verbatim below), the pattern of **consult C2**
(`.agent/reviews/ARCH-019-first-back-office-form.md`, §1, §2, §3 and §6) as S1a built it, and the guards that
**DESIGN-018** settled (merged as PR #125). Read ADR-012 Part 1 and C1 §0 and §1 whole once. Where this file and a source
differ, this file's *Rulings* win; where two sources differ and no ruling settles it, stop and write `BLOCKED:`.

## Objective

A manager can read the installation's current settings and save a new settings version, through two new back-office
routes, against a new append-only `settings_version` record that starts empty. Each save carries the version it was
built on and is refused `SETTINGS_CHANGED` if that is no longer current; an identical save writes nothing. No screen
yet: S2b builds BO-08's settings section on these routes from DESIGN-018. This slice also adds the rate codec to
`@pos/money` and the installation's currency and precision as shared constants.

## Decided: do not reopen

- **Owner, 2026-10-20 (DECISIONS):** Q2, each rate **0 to 100 percent** (0 to 1,000,000 ppm); Q3, a **non-zero service
  charge** may be stored; Q5, currency and precision are **fixed at IDR and 0**, never stored and never accepted by a
  command; Q11, **settings changes are not audited**; Q12, the business details are outlet name, address, phone, an
  optional NPWPD and a footer line.
- **Lead calls standing (DECISIONS 2026-10-20), now confirmed by the owner (2026-10-21):** the footer is **required**;
  a version records **`created_by`**, shown as "Saved by {name}".
- **Owner, 2026-10-21 (DECISIONS), DESIGN-018's questions:** Q5, the save command **answers the full settings view of
  the version now current**, and the client reads *unchanged* from an answered version equal to the one it carried; Q2,
  the phone accepts **only digits, spaces and `+ - . ( )`** (no `/`). The NPWPD has no charset (lead's reading).
- **ADR-012:** rule 1 (append-only, `SELECT` and `INSERT` only, a trigger refusing `UPDATE`, `DELETE`, `TRUNCATE`; no
  seed); rule 2 (an integer version key, server-assigned as current + 1; the highest is current); rule 3 (the command
  carries the version it was built on; `SETTINGS_CHANGED`, 409, no details, also for the concurrent unique violation);
  rule 4 (every change makes a version, details too; an identical submission writes nothing and is not refused; a stale
  one is refused first); rule 5 (no currency or precision column); rule 8 (no control character in any business
  detail, except a line feed in the address); rule 15 (the read and every answer carry the version number).
- **ADR-010 rule 1:** `SETTINGS_CHANGED` enters `@pos/contracts` here, the task that first emits and tests it. **ADR-010
  rule 2:** no PostgreSQL error text is logged or copied. **ADR-011 rules 1, 9, 16:** routes declare `access` with no
  default `interactive`; one validation helper, `VALIDATION_FAILED` with no details; fixed-string paths, ids in bodies.
- **C2 §3 and §6 as S1a built them:** a record under a named key in every answer, read in the command's own
  transaction; the list-style read is not interactive, the command is; a command that changes nothing writes nothing.

## Rulings (lead, 2026-10-21): what C1 and C2 leave to this task

1. **Migration `0011_settings_version.sql`**, C1 §1.1 and §1.2 as sketched, with `created_by` kept and the `footer`
   `NOT NULL`. The trigger uses a new function with a neutral message (C1 §1.2), created in the same migration.
2. **Text guards (DESIGN-018's table, with the owner's phone ruling).** Every text is trimmed by the client before
   sending; the request schema refuses an untrimmed or blank value rather than transforming it (C2 §4's rule); lengths
   are in UTF-16 units, as zod's `max` counts, and the database backstop is `char_length` (code points never exceed
   UTF-16 units, so the backstop never refuses what the schema accepts).

   | Column | Required | Request schema | Database check |
   |---|---|---|---|
   | `outlet_name` | yes | 1–64, trimmed, no control character (Cc) | trimmed, not blank, `char_length` ≤ 64, no control character |
   | `address` | yes | 1–200, trimmed, at most two line feeds, no control character except LF | the same, LF the only control allowed, at most two LF |
   | `phone` | yes | 1–32, trimmed, only `[0-9 +\-.()]` | the same charset, `char_length` ≤ 32 |
   | `npwpd` | no | `null`, or 1–32 trimmed with no control character | `NULL`, or the same |
   | `footer` | yes | 1–120, trimmed, no control character | trimmed, not blank, `char_length` ≤ 120, no control character |

   Verify, as C1 §0 asks, that `[[:cntrl:]]` matches C1 controls such as U+009B under the database's encoding and
   collation; if it does not, spell the ranges out, and say which you used in the Handoff.
3. **Rates on the wire** (C1 §0): canonical base-10 integer strings of parts per million, `'0'` to `'1000000'`.
   `@pos/money` gains `encodeRate(rate: Rate): string` and `decodeRate(value: unknown): Rate`, mirroring
   `encodeMoney`/`decodeMoney` (refuse a JSON number, a sign, a leading zero, an exponent, a fraction, an empty string;
   return through `rateFromPpm`). The request schema in `@pos/contracts` checks the shape and the 0–1,000,000 bound
   itself (contracts depend only on zod), so an out-of-range rate is `VALIDATION_FAILED` before the domain runs; the
   route then decodes with `decodeRate`. No float anywhere (B-1).
4. **Installation constants:** `packages/money/src/installation.ts` exports `INSTALLATION_CURRENCY = 'IDR'` and
   `INSTALLATION_MINOR_UNIT_PRECISION = 0`, re-exported from `@pos/money`'s index. The server's settings read reports
   them from these constants (S2-21); nothing else in this slice uses them. The contracts schema types them as
   `currency: z.string().regex(/^[A-Z]{3}$/)` and `minorUnitPrecision: z.number().int().min(0)`, without importing
   the constants.
5. **The routes**, C2 §1's shape (fixed paths under `/api/back-office/config/`, the subject in the body):

   | Method | Path | Body | Answers | `interactive` |
   |---|---|---|---|---|
   | `GET` | `/api/back-office/config/settings` | none | `SettingsReadView` | `false` |
   | `POST` | `/api/back-office/config/settings/save` | `SaveSettingsRequest` | `SettingsReadView` | `true` |

   Both `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }`; the guard already requires `MANAGER` and, on
   the `POST`, the anti-CSRF token.
6. **The views** (strict schemas in `packages/contracts/src/settings.ts`):
   - `SettingsReadView` = `{ installation: { currency, minorUnitPrecision }, current: SettingsVersionView | null }`.
     `current` is `null` until the first save (the first run, ADR-012 rule 1).
   - `SettingsVersionView` = `{ version, createdAt, createdByName, taxRatePpm, serviceChargeRatePpm, outletName,
     address, phone, npwpd, footer }`: `version` a positive integer; `createdAt` an ISO 8601 timestamp string with
     offset; `createdByName` the saving manager's `staff_user.name` (B-13), read by a join in the same statement;
     the two rates as canonical ppm strings; `npwpd` a string or `null`.
   - `SaveSettingsRequest` = `{ expectedVersion, taxRatePpm, serviceChargeRatePpm, outletName, address, phone, npwpd,
     footer }`: `expectedVersion` a positive integer or `null` (the first save); no `currency`, `minorUnitPrecision`,
     `calculationPolicy`, `version` or `createdBy` field (strict: any is `VALIDATION_FAILED`).
   - A successful save answers `SettingsReadView` with `current` the version now current: the new one, or, for an
     identical submission, the existing one, whose `version` then equals `expectedVersion`. A stale save answers 409
     `{ "error": { "code": "SETTINGS_CHANGED" } }` and writes nothing.
7. **The actor:** `created_by` is the signed-in manager's user id from the session, never from the request.
8. **Order of checks in the command's transaction** (C2's *What the pattern needs from ADR-012*, point 4; C1 §1.3):
   read the highest number; compare with `expectedVersion` (stale → `SETTINGS_CHANGED`); compare values (identical →
   answer the current version, write nothing); insert `current + 1` with `calculation_policy` from the server's
   constant and `created_by`; a 23505 on the primary key is `SETTINGS_CHANGED`; any other database error is a fault.
9. **The compile-forced client lines only:** `SPECS` entries and `ROUTES` names, two back-office API functions
   (declared, called by no screen), and `SETTINGS_CHANGED` placed in both clients' code maps (the back office's in its
   general-failure group for now, the POS's with its other unexpected codes). S2b gives the back office its real
   handling. No screen, no manifest or rail change.

## Tests expected to change

C1 §1.4's list: `schema.test.ts` (case 1's map, new cases), `harness-race.test.ts` (`MIGRATED_TABLES`), the
route-table and access tests only through their data (the new routes), both clients' `realSession.ts` code maps (a
compile error, not a test), `error-details.types.ts` (the `SETTINGS_CHANGED` block), and `packages/money`'s tests (the
rate codec, the constants). New: `apps/server/test/settings.test.ts` and the settings route cases. No existing
assertion may change meaning; a change elsewhere is reported in the Handoff with its reason.

## Acceptance criteria, each with its red proof

C1 §1.4's cases **S2-1 to S2-22**, as written below, are the acceptance criteria, with these additions and readings:

- **S2-7** also covers every row of Ruling 2's table: each column's over-long value refused, the phone's `/` and a
  letter refused, a blank NPWPD string refused while `NULL` is accepted, and an address with a CR refused.
- **S2-19** also covers each text rule of Ruling 2 at the request schema (one case per column and rule), a rate string
  `'01'` and `'1000001'`, an `expectedVersion` of `0`, `-1`, `1.5` or `'1'`, and each forbidden extra key.
- **S2-23 (new):** the save answers `SettingsReadView` with `current` exactly as the following read returns it, and
  `createdByName` is the signed-in manager's name; an identical save answers the existing version with `version` equal
  to `expectedVersion` and the row count unchanged. *Red:* answer the request's values instead of the committed row:
  `createdAt` is missing and the case fails.
- **S2-24 (new):** no settings route writes an audit entry (the `audit_entry` count is unchanged across a read, a save,
  a stale save and an identical save). *Red:* not needed; a guard against a later change, and the Handoff says so.
- **S2-25 (new):** the log-scan marker test: a save refused `VALIDATION_FAILED` whose outlet name carries a marker, and
  a stale save whose footer carries one, leave the marker in no log line and no response.
- **Verify:** `npm run verify` green, counts in the Handoff. The lead runs `npm run test:e2e:all` before merge (a
  migration, the contracts and the HTTP layer change; no browser test changes).

## Rules

- Touch only the paths in `owns`. If the code needs another, stop and write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code. Each *Red* line is a mutation you apply, observe failing, revert, and report in the Handoff.
- Concurrency tests (S2-13) follow `throttle.test.ts` cases 12 and 13 and S1a's barrier: an owner connection inserts
  inside an open transaction, the save is started, the test waits until a backend is waiting (`waitingBackends()`),
  then commits, and asserts the save decided from what it read; release in `finally`.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not run `db:migrate` on the development database `pos`;
  the lead does after the merge (the server refuses to start until it does, S0).
- Format by hand, matching each file; there is no formatter config.
- Read `apps/server/src/domain/dining-table.ts`, `apps/server/src/http/routes/back-office-tables.ts`,
  `packages/contracts/src/tables.ts` and `apps/server/test/tables.test.ts` first: S1a's shapes are the pattern.

## Baseline

`development` at `0006932`: `npm run verify` 104 files and 3934 tests (S1b's final tree; DESIGN-018 changed no code).

## Out of scope

- BO-08 and anything under `apps/back-office/src` beyond Ruling 9 (S2b); tender types (S3).
- Capturing a settings version when an order opens, and the refusal with no settings version (Phase 2).
- Any audit entry; an idempotency key; a read of an older version by number.

## Commit and report

Commit on `agent/phase1-s2a` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose, ending with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr
as AGENTS.md says. The Handoff must carry forward, for S2b: the exact route names, schema names and view shapes; how
*unchanged* reads on the wire; the rate codec's names; the constants' names; and which control-character pattern the
database uses.

## From consult C1 §0 — rules shared by the four slices (verbatim)

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

## From consult C1 §1 — S2a (verbatim; the *Rulings* above settle what it leaves open)

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

## Handoff

_Not started._
