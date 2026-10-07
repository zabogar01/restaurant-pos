---
id: PHASE0-005
title: The audit writer and the security-event writer
category: feature
touches: [audit]
depends_on: [PHASE0-004]
owns: [apps/server/src/**, apps/server/test/**]
status: complete
cycles: 1
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

## Round 2 — the review's one finding (lead ruling, 2026-10-06)

The review is `.agent/reviews/PHASE0-005-review.md` (OpenCode `openai/gpt-6.1-sol`, at `fc8f4d6`;
Codex was at its limit). Read it in full. Its one finding is accepted; this is fix cycle 1 of 2.

1. **Low: case 11 does not prove "before SQL" for `writeSecurityEvent`.** An empty table shows no
   row survived, not that no SQL ran. For each invalid input in case 11, observe the pool's query
   entry point that `writeSecurityEvent` uses (a `vi.spyOn` on the pool, for example
   `getPool().query`, restored after each test) and assert zero calls. Keep the real-database
   assertions. Do not change `audit.ts`'s signature or `pool.ts`. Red proof: add a harmless
   `await query('SELECT 1')` before validation in `writeSecurityEvent`, show the new assertion
   failing, revert.

Re-run `npm run verify` and the focused file, and add a **Round 2** section to the Handoff with
the change, the red proof and the counts. Do not rewrite round 1's sections.

## Handoff

**What I did.** I added `apps/server/src/domain/audit.ts` with exactly three exports: `writeAudit(client, entry)`, `writeAuditOwnTransaction(entry)` and `writeSecurityEvent(input)`, plus the types `AuditInput`, `AuditOutcome` and `SecurityEventInput`. I added `apps/server/test/audit.test.ts` with 35 tests. Both are committed on `agent/phase0-005` together with this Handoff. No migration, `pool.ts`, `pin.ts`, config or document was changed, and no dependency was added.

**What I decided.**
- Validation is hand-written runtime checks that throw `invalid audit entry: <field>` or `invalid security event: <field>` and never include the value. The checks run in this order: entry, `actorId`, `action`, `outcome`, `approverId`, `subject`, `reason`, amounts. `approverId` is checked after `outcome`, so an approver on a non-SUCCESS entry reports `approverId`.
- `reason: null` is refused; only `undefined` counts as absent. `approverId` accepts `undefined`, `null` or a non-empty string. The task said "absent" for `reason` and I read it strictly.
- `writeAuditOwnTransaction` validates once before opening a transaction, then `writeAudit` validates again inside it, so a bad entry never even takes a connection.
- Case 11 choice: unknown keys such as `detail` and `actorId` on a security event are **ignored**, never read or written. The test also asserts the table's column list, so nothing can store them.
- `writeSecurityEvent` uses the pool's `query`, not a transaction, since it is a single statement. Database errors are rethrown unchanged (ruling 4), proven by case 8 (`code === '23503'`).
- Amounts go to `pg` as `bigint.toString()`. The test client for "before SQL" is a recording stub passed as the client; the real-client path is covered by the other cases.

**Existing tests changed:** none.

**Case-to-test map** (all in `apps/server/test/audit.test.ts`): 1 `case 1: writes one row with every field and a database timestamp`; 2 `case 2: a rolled-back transaction leaves no row and the original error surfaces`; 3 `case 3: entries in one transaction commit together`; 4 `case 4: amounts beyond 2^53, zero and negative are stored exactly`; 5 `case 5: failed and cancelled approvals commit on their own`; 6 `case 6: a SUCCESS entry may name the actor as approver`; 7 the 14 `case 7: <name>` rows plus 4 `case 7: the entry itself is …` rows (each field case also runs through `writeAuditOwnTransaction` and checks no row); 8 `case 8: an unknown actor is a foreign key error, rethrown, with no row`; 9 `case 9: no message contains the offending value`; 10 two `case 10:` tests; 11 five `case 11: refuses …` rows and `case 11: detail and actorId keys are ignored and never written`; 12 `case 12: exports only the three writers`.

**Red proofs** (each mutated, run, read, reverted; the final file has none of them):
1. `RETURNING id` added to the insert: 7 failures, all `permission denied for table audit_entry` (code 42501), including cases 1, 2, 3, 4, 5, 6 and 8.
2. Insert through `query` instead of the caller's client: case 2 failed, `expected [ { id: '1', … } ] to have a length of +0 but got 1`.
3. `String(Number(e.beforeAmount))`: case 4 failed, `expected '9007199254740992' to be '9007199254740993'`.
4. Approver-outcome check removed: case 7 `approver with APPROVAL_FAILED` and `approver with APPROVAL_CANCELLED` failed with `expected the call to fail`, meaning the recording client accepted the entry, so the refusal is before SQL.
5. `typeof` check on `actorId` removed (left `=== ''` and `=== null`): case 7 `actorId number` failed with `expected the call to fail`.

**Grep** `grep -rn "UPDATE\|DELETE\|TRUNCATE\|RETURNING\|console\." apps/server/src/domain/audit.ts` printed nothing.

**Verify** (`npm run verify`, after the final edit): typecheck clean; `Test Files 48 passed (48)`, `Tests 2815 passed (2815)`. That is 2780 + 35 and 47 + 1 files, with the client's counts unchanged. `npx vitest run apps/server/test/audit.test.ts` alone: 35 passed. My first verify failed typecheck on `noUncheckedIndexedAccess` in the test (`rows[0]` possibly undefined); I fixed the test, not the config. No formatter was run.

**Found and not fixed.** Nothing in committed work outside my slice. One note for Task 6: `writeSecurityEvent` opens its own pool call, so a caller that wants the event to survive a rolled-back login transaction gets that for free; a caller that wants it inside a transaction has no way to, because the task fixed the signature without a client.

**Next agent needs.** No browser was involved. Nothing is missing.

### Round 2

**Change.** In `apps/server/test/audit.test.ts`, each "case 11: refuses … before any row is written" test now wraps the call in `vi.spyOn(getPool(), 'query')`, asserts the spy was never called, and restores it in a `finally`. The real-database assertion that the table stays empty is kept. `audit.ts`, `pool.ts` and the signatures are unchanged. The spy works because `writeSecurityEvent` calls the pool's `query` through `getPool()`, the same singleton the spy wraps.

**Red proof.** I added `await query('SELECT 1')` before validation in `writeSecurityEvent`. All five case 11 refusal tests failed with `expected "query" to not be called at all, but actually been called 1 times`, showing `"SELECT 1"` as the call. The empty-table assertion alone would have passed. I reverted the line.

**Counts.** `npm run verify`: typecheck clean; `Test Files 48 passed (48)`, `Tests 2815 passed (2815)`, unchanged from round 1 because I strengthened five existing tests rather than adding any. The focused file alone ran 35 tests (30 passed with the mutation in place, 5 failed as shown). No existing test other than my own was touched; no formatter was run.

DONE
