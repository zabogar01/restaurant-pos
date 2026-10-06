---
id: PHASE0-003c
title: The Phase 0 core schema, with append-only audit enforced by grants and a trigger
category: feature
touches: [audit, identity, money]
depends_on: [PHASE0-003b]
owns: [db/migrations/**, apps/server/test/**]
status: not-started
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

*(Written by the builder.)* It must also list, for the later task files, the seven items under
ARCH-006 §8 *Found in Tasks 4 to 10*, and say that tests reset with `resetDatabase()`.
