---
id: PHASE0-005
title: The audit writer and the security-event writer
category: feature
touches: [audit]
depends_on: [PHASE0-004]
owns: [apps/server/src/**, apps/server/test/**]
status: not-started
cycles: 0
---
# PHASE0-005 — Audit and security-event writers

**Written** 2026-10-06 by the lead, from plan Task 5
(`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1308-1529`), the architect consult
ARCH-006 (`.agent/reviews/ARCH-006-phase0-core-schema.md`, sections 6 and 8 and the names table),
and the Handoffs of PHASE0-003c and PHASE0-004. Cut from `development` at `c507dfc`, after
PHASE0-004 (PIN hashing and lookup) merged as PR #56. The architect consult for this task is
ARCH-006; the owner looks before merge.

## Objective

Give the server the two functions every later command uses to leave evidence: one that writes an
`audit_entry` row **inside the caller's transaction**, so an action and its history commit or roll
back together (ADR-007, B-7), and one that writes a `security_event` row for an event with no
identified actor, so such events never reach the audit table (B-13). When this task is done,
`apps/server/src/domain/audit.ts` exists, `apps/server/test/audit.test.ts` proves every rule below
against the real tables as `pos_app`, and the writers refuse an invalid entry before any SQL runs.

## Required inputs

- **Plan Task 5** (`plan:1308-1529`) is the starting shape: `writeAudit(client, entry)`,
  `writeAuditOwnTransaction(entry)`, and most of its test cases. **This file supersedes the plan
  wherever they differ**; the differences are listed under *What changes from the plan*. Do not
  copy the plan's `beforeEach`, its outcome names, its `clientInstanceId`, or its telemetry writer.
- **The schema you write to** is `db/migrations/0004_audit_entry_and_security_event.sql` (on
  `development`). Read all of it. In short:
  - `audit_entry`: `actor_id uuid NOT NULL` (FK `staff_user`), `approver_id uuid` (FK, nullable,
    may equal the actor), `action text` (not blank), `outcome text` in `SUCCESS`,
    `APPROVAL_FAILED`, `APPROVAL_CANCELLED`, `subject_type`/`subject_id` (both or neither),
    `reason text`, `before_amount`/`after_amount bigint`, and `id` and `occurred_at` which the
    application can never supply. Checks: `outcome = 'SUCCESS' OR approver_id IS NULL`. An
    append-only trigger refuses UPDATE, DELETE and TRUNCATE for every role. `pos_app` has column
    INSERT only, **no SELECT**.
  - `security_event`: `event_type` in `PIN_FAILURE`, `COOLDOWN_STARTED`; `throttle_class` in
    `LOGIN`, `MANAGER_APPROVAL` (required); `client_instance_id uuid` (optional FK to
    `client_instance`); `id` and `occurred_at` from the database. No column that could name a
    person or hold free text. `pos_app` has column INSERT only.
  - Do not change any migration.
- **The pool** is `apps/server/src/db/pool.ts`: `query`, `withTransaction` (BEGIN, COMMIT, ROLLBACK
  on throw), connecting as `pos_app`; BIGINT comes back as a string.
- **The test harness:** `apps/server/test/support/database.ts` (`resetDatabase`, `ownerQuery`,
  `ownerClient`), `support/env.ts`. A staff user for a test is made with `createStaffUser` from
  `apps/server/src/domain/pin.ts` (`{ name, role, pin }` → `{ id }`).
- **ARCH-006 §6** (`:535-600`), **§8 *Found in Tasks 4 to 10*** (`:706-726`, the Task 5 and
  "Tasks 4 to 10" lines), and the **names table** (`:748-761`).
- `docs/ARCHITECTURE.md` section 11 and §5.1; ADR-007; `docs/PRD.md` FR-J2, FR-J3; `docs/BOUNDARIES.md`
  B-1, B-7, B-12, B-13.

## Lead rulings (2026-10-06; the owner may overturn them)

1. **The security-event writer is `writeSecurityEvent(input: SecurityEventInput): Promise<void>`**,
   not the plan's `writeTelemetry`, after the table it writes (ARCH-006 names table).
   `SecurityEventInput = { eventType: 'PIN_FAILURE' | 'COOLDOWN_STARTED'; throttleClass: 'LOGIN' |
   'MANAGER_APPROVAL'; clientInstanceId?: string }`. `throttleClass` is required. There is no
   `detail` and no other field. Plan Task 6's file will be written against this name.
2. **A subject is one optional field, `subject?: { type: string; id: string }`**, not two optional
   strings, so the type cannot express half a subject. Both strings must be non-blank.
3. **The writers validate before any SQL** and throw a fixed message naming the field and never
   its value: `invalid audit entry: <field>` and `invalid security event: <field>`. Inputs will
   come from HTTP bodies later, so every check is a runtime check (`typeof`, not only the type
   system): the PHASE0-004 lesson, where a number slipped past a pattern test.
4. **A database error that still escapes** a writer is rethrown unchanged. Unlike the PIN module,
   these rows hold no secret, and later callers need PostgreSQL's code (a foreign key violation
   for an unknown actor, for example). Do not wrap it.

## What changes from the plan

1. **`AuditInput.actorId` is `string`, never null** (B-13; ARCH-006 §8). An event with no
   identified actor is a security event.
2. **No `clientInstanceId` on `AuditInput`.** `audit_entry` has no such column (ARCH-006 §8).
3. **Outcomes are `'SUCCESS' | 'APPROVAL_FAILED' | 'APPROVAL_CANCELLED'`** (the migration's
   spelling), not `INVALID_APPROVAL` and `CANCELLED`. `REFUSED` is not added: it arrives with its
   `refusal_code` column in the phase that first writes it (the migration's comment).
4. **No `RETURNING`, and no SELECT from either table in `audit.ts`.** `pos_app` cannot read them;
   the writers return `void`.
5. **Tests reset with `resetDatabase()`**, never `DELETE` (B-7; `pos_app` has no DELETE). Tests read
   rows back through `ownerQuery`, since `pos_app` has no SELECT on these tables.
6. **Amounts are `bigint` only.** A `number` (or anything not a `bigint`) for `beforeAmount` or
   `afterAmount` is refused before SQL (B-1). Pass them to `pg` as the decimal string.

## Validation rules (each a fixed `invalid audit entry: <field>` before SQL)

- `actorId`: a non-empty string.
- `approverId`: absent, `null`, or a non-empty string; **present only when `outcome` is `SUCCESS`**
  (ADR-007; the table's check). It may equal `actorId`.
- `action`: a string that is not blank after trimming.
- `outcome`: one of the three.
- `subject`: absent, or an object whose `type` and `id` are both non-blank strings.
- `reason`: absent or a string.
- `beforeAmount`, `afterAmount`: absent or `typeof === 'bigint'`.
- The entry itself: a non-null object.

`writeSecurityEvent`: `eventType` and `throttleClass` each one of their two; `clientInstanceId`
absent or a non-empty string; the input a non-null object.

## Test cases for `apps/server/test/audit.test.ts`

Every case starts from `resetDatabase()` and one cashier made with `createStaffUser`; a manager is
made where a case needs an approver.

1. `writeAudit` inside `withTransaction` writes one row with the given actor, action, outcome,
   reason, subject and amounts, read back through `ownerQuery`; `occurred_at` is set by the
   database (within a few seconds of `now()` read from the database, not the Node clock).
2. **Rollback:** an entry written in a transaction that then throws leaves no row, and the
   original error reaches the caller unchanged.
3. **Commit together:** in one transaction, a business write stand-in (a second `writeAudit` is
   enough) and the entry both commit; read back two rows.
4. **B-1:** `beforeAmount: 9007199254740993n`, `afterAmount: 0n` and a negative amount
   (`-9007199254740993n`) are stored exactly (read back as strings).
5. `writeAuditOwnTransaction` writes an `APPROVAL_FAILED` entry with `approverId: null`, and an
   `APPROVAL_CANCELLED` entry with no `approverId`, each committed on its own.
6. A `SUCCESS` entry whose approver is the actor is accepted (ARCHITECTURE §7.1).
7. **Refused before SQL**, each with its fixed message and **no row written**: `actorId` null,
   `''`, a number; `action` `''`, `'   '`, a number; an unknown outcome; `approverId` present with
   `APPROVAL_FAILED` and with `APPROVAL_CANCELLED`; a subject with a blank `type` or `id`;
   `beforeAmount` as the number `100`; `afterAmount` as the string `'100'`; `reason` a number;
   `null` and a non-object as the entry. Prove "before SQL" by passing a client whose `query`
   records calls and asserting it was never called.
8. An unknown `actorId` (a valid UUID with no user) is rejected by the database with a foreign-key
   error (`code === '23503'`), rethrown, and no row is written.
9. No thrown validation error's message contains the offending value (use a distinctive value such
   as `'zz-secret-reason-zz'` in a field that fails validation, for example a reason passed as an
   object containing it, and an action of `'   '` beside it).
10. `writeSecurityEvent({ eventType: 'PIN_FAILURE', throttleClass: 'LOGIN' })` writes one
    `security_event` row and **no** `audit_entry` row; `COOLDOWN_STARTED` with
    `MANAGER_APPROVAL` and a `clientInstanceId` of a `client_instance` row made through
    `ownerQuery` stores that id.
11. `writeSecurityEvent` refuses before SQL: unknown `eventType`, missing or unknown
    `throttleClass`, a blank `clientInstanceId`, a `detail` or `actorId` key is **ignored or
    refused** (your choice, stated in the Handoff) but never written, and `null` as the input.
12. `audit.ts` exports no update, delete or read function: assert the module's export names are
    exactly `writeAudit`, `writeAuditOwnTransaction`, `writeSecurityEvent` (types aside).

## Tests expected to change

- None. The lead grepped `apps/server/test/` for `audit_entry`, `security_event` and `writeAudit`:
  `schema.test.ts` (grants and constraints) and `harness-race.test.ts` (a list of table names) name
  the tables; neither uses this module. If either or any other existing test needs a change, stop
  and raise it.

## Constraints

- **B-7:** no UPDATE, DELETE or TRUNCATE of `audit_entry` anywhere, in source or test.
- **B-13:** `actor_id` is never null and never a stand-in user; an unauthenticated event is a
  `security_event`.
- **B-12:** neither writer accepts, stores or logs a PIN; no `console` call in `audit.ts`.
- **B-1:** amounts are `bigint` end to end, never `Number`.
- Names follow ARCH-006's table: `security_event`, `event_type`, `actor_session`, never
  `security_telemetry`, `event` or `app_session`.
- Do not change `db/migrations/`, `pool.ts`, `pin.ts`, `vitest.config.ts`, the client, or any
  document. No new dependency.
- No action vocabulary: `action` is any non-blank string for now (ARCH-006 §6).

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts: `development`'s 47 files and 2780
   tests (lead's verify, 2026-10-06) plus `audit.test.ts`'s cases, with the client's 40 files and
   2719 tests unchanged.
2. `npx vitest run apps/server/test/audit.test.ts` alone is green, and the Handoff maps each case
   number above to its test name.
3. **Red proofs, each made, run, shown in the Handoff and reverted:** adding `RETURNING id` to the
   insert fails case 1 (permission denied); writing through `query` instead of the caller's client
   fails case 2; converting an amount with `Number()` fails case 4; removing the approver-outcome
   check fails case 7 before SQL; removing the `typeof` check on `actorId` fails case 7's numeric
   actor.
4. `grep -rn "UPDATE\|DELETE\|TRUNCATE\|RETURNING\|console\." apps/server/src/domain/audit.ts` finds
   nothing, and the Handoff shows it.

## Out of scope

- Plan Tasks 6 to 12: throttling, sessions, routes, approval, the cooldown-refused approval's
  audit entry (owner, 2026-10-06: an audit entry; Task 10 writes it), shells, acceptance tests.
- `REFUSED` and its `refusal_code` (later phase), an action vocabulary, an audit reader or viewer.
- Reusing a deactivated user's PIN (owner, 2026-10-06): a migration in another Phase 0 task.
- The vitest ESM warning.
