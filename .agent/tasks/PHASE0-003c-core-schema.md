---
id: PHASE0-003c
title: The Phase 0 core schema, with append-only audit enforced by grants and a trigger
category: feature
touches: [audit, identity, money]
depends_on: [PHASE0-003b]
owns: [db/migrations/**, apps/server/test/**]
status: complete
cycles: 0
---
# PHASE0-003c — Core schema and append-only grants

**Written** 2026-10-05 by the lead, from the architect consult ARCH-006
(`.agent/reviews/ARCH-006-phase0-core-schema.md`, on `development`). Third of three slices of
Phase 0 Task 3, cut from `development` after PHASE0-003b (the serial test harness, `pos_test`,
the unprivileged `pos_app` pool) merged.

## Objective

Create the six tables Phase 0's later tasks build on (`staff_user`, `client_instance`,
`actor_session`, `audit_entry`, `security_event`, `pin_throttle_bucket`; ARCH-006's rule 5 says
"the five", a miscount of the same six), each with exactly the privileges the application role
needs and no more, so that B-7 (the audit log is append-only), B-13 (every audit entry names a
person), B-12 (no PIN anywhere) and B-1 (no float money) are properties of the database rather
than of each caller's discipline. When this task is done the four migrations below are applied
by `npm run db:migrate`, and one test file proves every grant, constraint and type rule, as
`pos_app` where the rule is the application's and as the owner where it is the trigger's.

## Required inputs

- **ARCH-006 is the specification.** Read, in this order: *For the task file* (from `:740`): the
  name table (`:748-761`), *Migrations for PHASE0-003c* (`:796-1001`), *Test cases* (`:1003-1055`)
  and *Rules for PHASE0-003c* (`:1057-1070`). Then sections 1, 3, 4 and 6 for the reasons.
- **The plan's Task 3 SQL is superseded and must not be copied**
  (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:767-1050`). Where ARCH-006 differs from
  the plan, ARCH-006 wins; where this file differs from ARCH-006, this file wins.
- PHASE0-003b's harness: `apps/server/test/support/database.ts` (`ownerQuery`, `ownerClient`,
  `resetDatabase`), `apps/server/test/support/env.ts`, `vitest.config.ts`, `db/dev.env`.
  `pos_app` has `LOGIN` and `USAGE` on `public` only; every grant arrives in a migration here.
- `docs/ARCHITECTURE.md` §5.1, §7.2, §7.3, §11, §14.2, §14.4; ADR-007; `docs/PRD.md` FR-A1 to
  FR-A7, FR-J1 to FR-J4; `docs/BOUNDARIES.md` B-1, B-7, B-11 to B-13, B-24.

## Lead rulings on ARCH-006's recommendations (2026-10-05; the owner may overturn them)

1. **No `settings_version` table** in Phase 0. ARCH-006's optional `0006_settings_version.sql` is
   **not** created.
2. **`actor_session.token_hash` is kept**, with its check and unique index, as ARCH-006 gives it.
3. **Outcome spellings:** `SUCCESS`, `APPROVAL_FAILED`, `APPROVAL_CANCELLED`. The check is
   expected to widen later (`REFUSED` arrives with its `refusal_code` in the phase that writes it);
   say so in the migration comment, as ARCH-006 does.
4. **The statement-level append-only trigger on `audit_entry`** is created, for every role.
5. **Evidence tables are INSERT-only for `pos_app`, column-level**, with no `SELECT`.

## What to build

1. The four migrations exactly as ARCH-006 gives them, file names included:
   `0002_staff_user.sql`, `0003_client_instance_and_actor_session.sql`,
   `0004_audit_entry_and_security_event.sql`, `0005_pin_throttle_bucket.sql`. Each file grants for
   the tables it creates. No `ALTER DEFAULT PRIVILEGES`, no grant on sequences, no role, password
   or settings, staff or rate row (the two throttle rows are seeded, FR-A5).
2. `apps/server/test/schema.test.ts` with ARCH-006's 21 cases, setup by `resetDatabase()`,
   assertions on evidence tables read through the owner connection, and `pos_app` actions made
   through the application pool (`query` from `apps/server/src/db/pool.ts`) or a `pos_app`
   connection built from `DATABASE_URL`. Case 1's expected privilege map is written out in the
   test, table by table and column by column, and a table in `public` that the map does not name
   (other than `schema_migration`) fails it.
3. Before writing, put these to the librarian (`.agent/bin/ask.sh librarian "<question>"`) and cite
   the answers in the Handoff: an `INSERT` into a `GENERATED ALWAYS AS IDENTITY` column needs no
   privilege on its sequence; one statement-level trigger may be `BEFORE UPDATE OR DELETE OR
   TRUNCATE`; how to read column-level privileges from the catalog
   (`information_schema.column_privileges` or `aclexplode` on `pg_attribute.attacl`).

## Tests expected to change

- `apps/server/test/harness-race.test.ts`: both cases assert that `public` holds only
  `schema_migration`. They change to the exact sorted list `schema_migration` plus the six tables
  this task creates (`actor_session`, `audit_entry`, `client_instance`, `pin_throttle_bucket`,
  `security_event`, `staff_user`), still exact equality, never `toContain`.
- Any other existing test that changes: stop and raise it.

## Constraints

- **B-13:** `audit_entry.actor_id` is `NOT NULL`. No test inserts a null or stand-in actor except
  case 9, which asserts the refusal.
- **B-7:** no test resets or cleans with `DELETE`, `UPDATE` or `TRUNCATE` on `audit_entry`; it
  resets with `resetDatabase()`. Case 6 is the only place those statements are run against it, to
  prove the trigger refuses them.
- **B-12:** no column on either evidence table could hold a PIN; no `detail` or `jsonb` column.
- **B-1:** case 14 asserts no `real`, `double precision`, `numeric` or `money` column anywhere in
  `public`, and a `before_amount` above 2^53 reads back as the same string.
- Not added in this task: `order_id`, `refusal_code`, `REFUSED`, an action vocabulary, a
  `classification` column, a CSRF or re-authentication column, `client_instance_id` on
  `audit_entry`, `settings_version`, or any table beyond these six.
- Touch only `db/migrations/` and `apps/server/test/`. No change to `apps/server/src/`, the vitest
  configuration, `db/dev.env` or the client.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts: `development`'s 45 files and 2737 tests (PHASE0-003b merged, lead's verify 2026-10-06)
   plus `schema.test.ts`'s cases, with the client's 40 files and 2719 tests unchanged.
2. Every one of ARCH-006's 21 cases exists and passes, and the Handoff maps case number to test
   name.
3. **Red proofs, each shown in the Handoff and reverted:** granting `SELECT ON audit_entry TO
   pos_app` fails case 1 or 3; dropping the trigger fails case 6; making `actor_id` nullable fails
   case 9; adding a `detail jsonb` column to `security_event` fails case 12; adding a seventh
   table with no entry in the privilege map fails case 1.
4. `npx vitest run apps/server/test/schema.test.ts` alone is green.
5. `npm run db:migrate` (against `pos`) applies `0002` to `0005`, and a second run applies nothing.
   The Handoff shows both outputs.

## Out of scope

- Everything in plan Tasks 4 to 12 (PIN hashing, audit and telemetry writers, throttle service,
  sessions, HTTPS server, routes, approval, client shells, acceptance tests).
- ADR-008 (database roles and structural immutability): the owner's word to commission it.
- The vitest ESM warning (`vitest.config.ts` loaded as CommonJS).

## Handoff

### What I did

Created the four migrations exactly as ARCH-006 gives them, file names included:
`db/migrations/0002_staff_user.sql`, `0003_client_instance_and_actor_session.sql`,
`0004_audit_entry_and_security_event.sql`, `0005_pin_throttle_bucket.sql`. Each grants for the
tables it creates; there is no `ALTER DEFAULT PRIVILEGES`, no sequence grant, no role, password,
or settings, staff or rate row. The only seeded rows are the two throttle buckets (FR-A5). The
lead's five rulings were applied: no `settings_version`, `token_hash` kept, the three outcome
spellings (the migration comment says the check will widen), the statement-level trigger for every
role, and INSERT-only column-level grants on the evidence tables with no `SELECT`.

Wrote `apps/server/test/schema.test.ts` with ARCH-006's 21 cases. Every test resets with
`resetDatabase()`; none cleans with `DELETE`, `UPDATE` or `TRUNCATE`, and `audit_entry` is only
touched by those statements in case 6, which proves the trigger refuses them. `pos_app` actions go
through `query` from `apps/server/src/db/pool.ts`; fixtures and every read of an evidence table go
through the owner connection. Failures are asserted by SQLSTATE and, for check and unique
violations, by constraint name (`error.constraint`), so a refusal for the wrong reason fails.

Edited `apps/server/test/harness-race.test.ts` as the task allows: both cases now assert the exact
sorted list `actor_session, audit_entry, client_instance, pin_throttle_bucket, schema_migration,
security_event, staff_user` (a shared `MIGRATED_TABLES` constant) with `toEqual`, never
`toContain`. Every assertion stays; only the expected list changed.

No commit hash is given here because the Handoff is part of the commit; the commit is on
`agent/phase0-003c` and is the one that adds this file.

### Librarian answers (via `.agent/bin/ask.sh librarian`, citing PostgreSQL 16 docs)

- Identity column: an `INSERT` that takes the generated value needs only `INSERT` on the table or
  columns; no privilege on the sequence (https://www.postgresql.org/docs/16/sql-insert.html,
  `.../sql-createtable.html`). The test confirms it: `pos_app` inserts into both evidence tables
  with no sequence grant, and case 1 asserts no sequence privilege.
- One trigger may be `BEFORE UPDATE OR DELETE OR TRUNCATE ... FOR EACH STATEMENT`; TRUNCATE can
  only be statement-level; an enabled trigger also fires for the owner and superusers
  (`.../sql-createtrigger.html`, `.../sql-altertable.html`; `session_replication_role` can bypass
  it, which is worth knowing for ADR-008).
- Column privileges: `information_schema.column_privileges` expands table-level grants into every
  column and depends on the current role; `aclexplode(pg_attribute.attacl)` shows only column-level
  entries. I used `has_table_privilege` and `has_column_privilege` for `pos_app`, which give the
  effective answer including PUBLIC, and subtracted table-level grants to get column-only ones.

### Decisions and evidence

- Case 1 builds the effective privilege map from the catalog functions (above) for every relation
  in `public`, compares the key set to the expected map (so an unnamed table fails), then compares
  the full map. `schema_migration` must have no privilege. Sequences are checked separately.
- Case 4, `id` supplied: `GENERATED ALWAYS` refuses a supplied `id` in the rewriter before the
  privilege check, so a plain insert fails with an identity error, not *permission denied*. The test
  asserts that refusal, and also an `OVERRIDING SYSTEM VALUE` insert, which does reach the privilege
  check and gets 42501. Both are in the one test.
- `noUncheckedIndexedAccess` is on, so the test has a small `only(rows)` helper.
- B-1 case: reads `before_amount` as 9007199254740993 (2^53 + 1) and gets the same string, relying
  on the bigint-as-string parser that `pool.ts` registers when the test imports it.

### Case number to test name (all in `apps/server/test/schema.test.ts`)

1 `gives pos_app exactly the privileges in the expected map, and none on schema_migration (case 1)` ·
2 `makes pos_app the owner of nothing and gives it no CREATE on schema public (case 2)` ·
3 `lets pos_app insert into audit_entry and refuses UPDATE, DELETE, TRUNCATE and SELECT (case 3)` ·
4 `refuses a pos_app insert into audit_entry that supplies occurred_at or id (case 4)` ·
5 `gives security_event the same refusals and lets pos_app insert (case 5)` ·
6 `makes the trigger refuse UPDATE, DELETE and TRUNCATE on audit_entry, even for the owner (case 6)` ·
7 `refuses pos_app INSERT, DELETE and a class rename on pin_throttle_bucket, and allows a counter update (case 7)` ·
8 `refuses pos_app DELETE on staff_user, actor_session and client_instance (case 8)` ·
9 `rejects a null actor_id on audit_entry (case 9)` ·
10 `rejects an approver on a failed or cancelled approval and accepts SUCCESS with or without one (case 10)` ·
11 `rejects an outcome outside the three (case 11)` ·
12 `has exactly the columns written here on audit_entry and security_event (case 12)` ·
13 `gives security_event no foreign key to staff_user (case 13)` ·
14 `has no floating-point, numeric or money column, and keeps bigint amounts exact (case 14)` ·
15 `rejects a duplicate pin_lookup on staff_user (case 15)` ·
16 `rejects KITCHEN as a staff_user role (case 16)` ·
17 `rejects a pin_hash that is not an Argon2id encoded hash (case 17)` ·
18 `starts credential_version at 1 on a new staff_user row (case 18)` ·
19 `rejects an actor_session insert without credential_version (case 19)` ·
20 `rejects an unknown audience, a BACK_OFFICE session with no expiry and a duplicate token_hash (case 20)` ·
21 `holds exactly the LOGIN and MANAGER_APPROVAL buckets (case 21)`.

### Red proofs (each mutation made, run read, reverted; `git status` afterwards shows only the intended files)

1. `GRANT SELECT ON audit_entry TO pos_app` in 0004: case 1 failed (received `table: ["SELECT"]` where
   `[]` was expected) and case 3 failed (the `SELECT` statement succeeded). 2 failed, 19 passed.
2. `DROP TRIGGER audit_entry_append_only ON audit_entry` in 0004: case 6 failed (the owner's
   statement succeeded). 1 failed, 20 passed.
3. `actor_id` made nullable in 0004: case 9 failed (insert succeeded) and case 12 failed (`actor_id
   uuid NULL`). 2 failed, 19 passed.
4. `detail jsonb` added to `security_event`: case 12 failed (`detail jsonb NULL` extra). 1 failed.
5. A temporary `0006_tmp_red_proof.sql` creating `seventh`: case 1 failed (`seventh` in the table
   list but not in the map). 1 failed. The file was deleted.

### Existing test changed

`apps/server/test/harness-race.test.ts`, listed by the task, for the reason above. Nothing else.

### Verify and acceptance output

- `npm run verify`: typecheck clean; `Test Files 46 passed (46)`, `Tests 2758 passed (2758)`.
  That is 2737 + 21 and 45 + 1, as expected. I did not separately re-count the client's 40 files
  and 2719 tests, but the total accounts for them unchanged. (My first verify run failed on
  typecheck, seven `TS2532` errors from `noUncheckedIndexedAccess` in my test; fixed with `only`.)
- `npx vitest run apps/server/test/schema.test.ts` alone: 1 file, 21 tests passed.
- `npm run db:migrate` against `pos`: first run printed `applied: 0001_extensions.sql,
  0002_staff_user.sql, 0003_client_instance_and_actor_session.sql,
  0004_audit_entry_and_security_event.sql, 0005_pin_throttle_bucket.sql` (this `pos` database had
  not been migrated before, so 0001 came with it). Second run: `no pending migrations`.
- No formatter was run. No browser is relevant here.

### Found and not fixed

- The vitest ESM warning remains (out of scope).
- `session_replication_role = replica` stops the append-only trigger firing for a role allowed to
  set it (superuser only by default). `pos_app` cannot. Relevant to ADR-008's wording.
- `migrate.test.ts` still drops the schema without restoring `GRANT USAGE ... TO PUBLIC`; harmless
  since 0002 grants `USAGE` to `pos_app`, and I did not touch it.
- `pos_app` has `SELECT` on no evidence table, so a later reader task must add a grant in its own
  migration, per ARCH-006's rule 2.

### For the later task files: ARCH-006 §8 *Found in Tasks 4 to 10*

1. **Task 4:** `config.ts` carries `postgres://pos_app:apppassword@...` as a default (a credential
   in source), and `findUserByPin` does not return the credential version.
2. **Tasks 4 to 10:** tests reset state with `DELETE FROM` through `query()`. That is `pos_app`
   and now fails; for `audit_entry` it is B-7. **Tests reset with `resetDatabase()`**
   (`apps/server/test/support/database.ts`), never with `DELETE`.
3. **Task 5:** `AuditInput.actorId` is `string | null` (a B-13 defect) and carries `clientInstanceId`,
   which `audit_entry` does not have.
4. **Task 6:** writes a `PIN_FAILURE` event with a free-form `detail` (the column does not exist);
   its `recordFailure` leaves the counter at five after a cooldown ends, so the first failure
   afterwards blocks again at once (ARCH-006 *For the owner*, 2).
5. **Task 7:** invalidates sessions by sweep, not by credential version (ARCH-006 section 4).
6. **Task 9:** sets both session cookies `sameSite: 'lax'`; section 7.2 says `SameSite=Strict`,
   origin validation and an anti-CSRF token.
7. **Task 10:** counts the failure and then writes the audit entry in a second transaction, and
   writes no audit entry when the approval is refused by the cooldown (ARCH-006 *For the owner*, 1).

### What the next agent needs and does not have

`pos_app` can insert into `audit_entry` and `security_event` but cannot read them or `RETURNING` a
column from them; Task 5's writer must not use `RETURNING`. AC-18 and AC-19 are not closed here.

DONE
