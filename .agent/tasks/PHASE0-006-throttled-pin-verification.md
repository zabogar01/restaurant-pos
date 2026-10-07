---
id: PHASE0-006
title: PIN verification under the two throttle buckets
category: feature
touches: [identity]
depends_on: [PHASE0-005]
owns: [apps/server/src/**, apps/server/test/**]
status: not-started
cycles: 0
---
# PHASE0-006 — Throttled PIN verification

**Written** 2026-10-07 by the lead, from the architect consult ARCH-007
(`.agent/reviews/ARCH-007-throttle.md`, by `architect7`, 2026-10-07), which supersedes plan Task 6
(`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1532-1721`) entirely. The consult is not
yet on `development`, so its binding sections are copied below **verbatim**; this file is complete
without it. Cut from `development` at `bbe1dce`, after PHASE0-005 (audit writers) merged as PR #59.
Touches identity: the owner looks before merge.

## Objective

Give the server one function, `verifyPinThrottled`, that checks a throttle class, verifies a PIN
and counts the outcome **inside one held row lock in a transaction it owns**, so that five
consecutive failures in a class start a five-minute cooldown that holds under concurrent guesses
and survives restart (FR-A5, AC-19), and so that only a success in the same class resets it. The
plan's three-function shape (`assertNotThrottled`, verify, `recordFailure`/`recordSuccess`) is the
race this task exists to avoid: do not build it. When this task is done,
`apps/server/src/domain/throttle.ts` exists, `findUserByPin` takes an optional client, and
`apps/server/test/throttle.test.ts` proves every rule below against the real tables as `pos_app`.

## Required inputs

- **`db/migrations/0005_pin_throttle_bucket.sql`**: two seeded rows (`LOGIN`, `MANAGER_APPROVAL`),
  `consecutive_failures`, `blocked_until timestamptz`; `pos_app` has `SELECT` and column `UPDATE`
  (`consecutive_failures`, `blocked_until`) only. No migration changes in this task.
- **`apps/server/src/domain/pin.ts`**: `findUserByPin(pin)` → `{ id, role, credentialVersion } |
  null`, Argon2id verify included; `createStaffUser`; `StaffRole`.
- **`apps/server/src/domain/audit.ts`**: `writeSecurityEvent({ eventType, throttleClass,
  clientInstanceId? })`, through the pool. Not edited.
- **`apps/server/src/db/pool.ts`** (`getPool`, `query`, `withTransaction`; pool size 10) and the
  harness `apps/server/test/support/database.ts` (`resetDatabase`, `ownerQuery`, `ownerClient`).
- `docs/PRD.md` FR-A5, FR-A7, FR-J3, FR-J4, AC-18, AC-19; `docs/BOUNDARIES.md` B-11, B-12, B-13,
  B-24; `docs/ARCHITECTURE.md` §7 and §11.
- **Owner rulings** (`.agent/DECISIONS.md`, 2026-10-06): the failure count resets when a cooldown
  ends; a cashier's approval refused by the cooldown writes an audit entry (Task 10 writes it; this
  task only returns `THROTTLED` as a value).

## The interface (ARCH-007 §7, verbatim)

```ts
export type ThrottleClass = 'LOGIN' | 'MANAGER_APPROVAL';

export const MAX_FAILURES = 5;
export const COOLDOWN_MINUTES = 5;

export type ThrottledVerification =
  | { outcome: 'VERIFIED'; user: { id: string; role: StaffRole; credentialVersion: number } }
  // retryAfterSeconds is a number when this failure started a cooldown, otherwise null.
  | { outcome: 'FAILED'; retryAfterSeconds: number | null }
  | { outcome: 'THROTTLED'; retryAfterSeconds: number };

export function verifyPinThrottled(
  throttleClass: ThrottleClass,
  pin: string,
  options?: { clientInstanceId?: string }
): Promise<ThrottledVerification>;
```

That is the whole module. **Not exported, deliberately:** `assertNotThrottled`, `recordFailure`,
`recordSuccess`, `ThrottledError`, and any function that resets, reads or sets a bucket.
`StaffRole` is imported from `pin.ts`.

## From ARCH-007 "For the task file" (verbatim; binding)

1. `apps/server/src/domain/throttle.ts` exports exactly `ThrottleClass`, `MAX_FAILURES`,
   `COOLDOWN_MINUTES`, `ThrottledVerification` and `verifyPinThrottled`, with the signatures
   in *The interface* above (ARCH-007 question 7). The plan's Task 6 code and test are superseded and must not be copied.
2. One attempt is one transaction owned by `verifyPinThrottled`: lock the class's row with
   `SELECT ... FOR UPDATE`; if `blocked_until > now()`, return `THROTTLED` having written
   nothing; otherwise verify, write the outcome to the row, commit.
3. Between the lock and the commit, every statement runs on the transaction's client. No pool
   call. `findUserByPin` gains an optional second parameter, a `Pick<pg.PoolClient, 'query'>`,
   and uses it when given; nothing else about `pin.ts` changes and no existing `pin.test.ts`
   assertion is edited.
4. A missing bucket row is an error that is thrown, never treated as "not throttled".
5. Success is: `LOGIN`, an active user; `MANAGER_APPROVAL`, an active user with role
   `MANAGER`. Anything else that returns is a failure. A thrown verification rolls back and
   propagates.
6. On success: `consecutive_failures = 0, blocked_until = NULL` for that class only.
7. On failure: the new count is 1 if `blocked_until` was set (an ended cooldown), otherwise
   the old count plus 1; `blocked_until` becomes `now() + COOLDOWN_MINUTES` when the new count
   reaches `MAX_FAILURES`, otherwise `NULL`. One `UPDATE ... RETURNING`.
8. All time is PostgreSQL's: `now()` in SQL for the write, the comparison and the seconds
   remaining. No `Date` in `throttle.ts`. `retryAfterSeconds` is a whole number from 1 to 300.
9. After the commit, and only then: for a `LOGIN` failure, one
   `writeSecurityEvent({ eventType: 'PIN_FAILURE', ... })`; for a failure in either class
   that started a cooldown, one `COOLDOWN_STARTED`. `clientInstanceId` is passed through when
   given. `audit.ts` is not edited.
10. `throttle.ts` passes the PIN to `findUserByPin` and to nothing else: no log, no error
    message, no event, no query parameter of its own (B-12). It takes no client and joins no
    caller's transaction.
11. No migration. No new grant. No environment variable, option or test hook that changes the
    two constants.
12. Tests reset with `resetDatabase()`, read `security_event` and change bucket state only
    through `ownerQuery`, and use no `.concurrent`.

### PHASE0-006: illustrative SQL

The rules bind; this shows they fit `pos_app`'s grants.

```sql
-- 1. lock and read
SELECT blocked_until IS NOT NULL AND blocked_until > now() AS blocked,
       ceil(extract(epoch FROM blocked_until - now()))::int AS retry_after_seconds
  FROM pin_throttle_bucket
 WHERE throttle_class = $1
   FOR UPDATE;

-- 2a. success
UPDATE pin_throttle_bucket
   SET consecutive_failures = 0, blocked_until = NULL
 WHERE throttle_class = $1;

-- 2b. failure ($2 = MAX_FAILURES, $3 = COOLDOWN_MINUTES)
UPDATE pin_throttle_bucket
   SET consecutive_failures =
         CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END,
       blocked_until =
         CASE WHEN (CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END) >= $2::int
              THEN now() + make_interval(mins => $3::int) END
 WHERE throttle_class = $1
RETURNING blocked_until IS NOT NULL AS cooldown_started,
          ceil(extract(epoch FROM blocked_until - now()))::int AS retry_after_seconds;
```

### PHASE0-006: test cases for `apps/server/test/throttle.test.ts`

Fixtures: one cashier and one manager made with `createStaffUser`; a wrong PIN is one nobody
holds.

*Counting*

1. Four wrong PINs in `LOGIN` return `FAILED` with `retryAfterSeconds: null`; the row reads 4
   and `blocked_until` is null; a correct PIN then returns `VERIFIED` with that user's id, role
   and credential version.
2. The fifth wrong PIN returns `FAILED` with `retryAfterSeconds` 300; the row reads 5
   and `blocked_until - now()`, read through the owner, lies in `(295, 300]` seconds.
3. During the cooldown the **correct** PIN returns `THROTTLED` with a `retryAfterSeconds` from
   1 to 300, and afterwards the row is unchanged: same count, same `blocked_until`.
4. With `blocked_until` set by the owner to 30 seconds ahead, an attempt returns `THROTTLED`
   with `retryAfterSeconds` 30 (or 29).

*The reset*

5. With `blocked_until` aged one second into the past and the count still 5, a wrong PIN
   returns `FAILED` with `retryAfterSeconds: null`, and the row reads 1 with `blocked_until`
   null. Four more wrong PINs are then needed to start the next cooldown.
6. With the same aged row, a correct PIN returns `VERIFIED` and the row reads 0 and null.

*Classes*

7. Five wrong PINs in `LOGIN` leave `MANAGER_APPROVAL` verifying normally, and the reverse.
8. Four wrong PINs in `MANAGER_APPROVAL`, then a correct cashier **login**, then one more wrong
   approval PIN: the approval class is now in a cooldown (FR-A5, AC-19). This is the plan's
   fourth case.
9. A cashier's own correct PIN in `MANAGER_APPROVAL` returns `FAILED`, increments that class's
   count, and after four earlier failures starts its cooldown. A manager's correct PIN there
   returns `VERIFIED` and resets it.
10. A correct PIN in a class resets that class's row only; the other row is unchanged.

*Concurrency*

11. Twenty-five wrong PINs sent at once (more than the pool's ten) all settle: exactly five
    `FAILED` and twenty `THROTTLED`; the row reads 5; `security_event` holds exactly five
    `PIN_FAILURE` and one `COOLDOWN_STARTED`. Set an explicit test timeout; a hang is the
    failure this case exists for.
12. The lock is real. An owner connection opens a transaction and takes the `LOGIN` row
    `FOR UPDATE`. Twelve wrong-PIN attempts start. Through a second owner connection the test
    polls `pg_stat_activity` until at least six `pos_app` backends have
    `wait_event_type = 'Lock'`, then commits the owner transaction. Result: exactly five
    `FAILED`, seven `THROTTLED`.
13. The decision is made from the row as read under the lock. With the owner holding the row
    as in case 12, one correct-PIN attempt starts; once it shows as waiting, the owner sets
    the row's `blocked_until` five minutes ahead in that same transaction and commits. The
    attempt returns `THROTTLED`, not `VERIFIED`.

*Evidence*

14. A `LOGIN` failure writes one `PIN_FAILURE` row with `throttle_class = 'LOGIN'` and the
    given `client_instance_id` (and null when none is given). A `MANAGER_APPROVAL` failure
    writes **no** `PIN_FAILURE`.
15. The fifth failure writes one `COOLDOWN_STARTED` in each class. A `THROTTLED` attempt and a
    `VERIFIED` one write no row.
16. On a wrong `LOGIN` PIN, a `clientInstanceId` that is a well-formed UUID naming no
    `client_instance` row makes `verifyPinThrottled` reject with the foreign-key error, **and the failure is still counted**: the row's count
    went up by one.
17. Failures made with different client instances, and with none, accumulate in the one
    bucket (FR-A7, AC-19).

*Durability and shape*

18. After a cooldown starts, a fresh import of the module (`vi.resetModules()` and a dynamic
    import) still returns `THROTTLED`: the module holds no state. `pg_class.relpersistence`
    for `pin_throttle_bucket` is `'p'`: the table is neither unlogged nor temporary.
19. The module exports exactly the names in rule 1.
20. With a bucket row missing (removed through the owner), `verifyPinThrottled` rejects and
    does not return `VERIFIED`.
21. No error thrown by any case above, and no `security_event` row, contains the PIN used.

### PHASE0-006: red proofs

Each is a mutation the builder makes, runs, reads and reverts, reporting the failing output.

1. Remove `FOR UPDATE`: case 12 reports more than five `FAILED`. (Case 11 probably does too,
   but only case 12 is deterministic.)
2. Call `findUserByPin(pin)` without the client: case 11 times out.
3. Write the events inside the transaction, through the client: case 16's count does not go
   up.
4. Drop the `ELSE 1` branch so the count is always incremented: case 5 reads 6 and starts a
   cooldown at once.
5. Drop the role rule for `MANAGER_APPROVAL`: case 9 returns `VERIFIED`.
6. Remove the class from the success `UPDATE`'s `WHERE`: cases 8 and 10 fail.
7. Read the cooldown state in a statement of its own before the locking one, and decide from
   that: case 13 returns `VERIFIED`.


### The Handoff must carry forward

- For Task 9: the response rules in question 7, the six-digit rule at the route, and that the
  back-office login is no longer a PIN login.
- For Task 10: `THROTTLED` is a value and writes no event; the audit outcome for a
  cooldown-refused approval does not exist yet; a failed approval writes no `PIN_FAILURE`.
- AC-19 is proved here at the domain level. It is closed only when Task 9 proves it through
  the route. AC-18 is not closed by this task.

## Tests expected to change

- None. `findUserByPin` gains an optional parameter, so `pin.test.ts` keeps every assertion (rule
  3). The lead grepped `apps/server/test/` for `pin_throttle_bucket` and `findUserByPin`:
  `schema.test.ts` (grants, case 7), `harness-race.test.ts` (a list of table names) and
  `pin.test.ts` (calls with one argument) name them, and none should change. If any existing test needs a change, stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s 48 files and
   2815 tests (lead's verify, 2026-10-07), the client's 40 files and 2719 tests unchanged.
2. `npx vitest run apps/server/test/throttle.test.ts` alone is green, run three times in a row
   (cases 11 to 13 are concurrency cases), and the Handoff maps each case number to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. `grep -n "Date\|console\." apps/server/src/domain/throttle.ts` finds nothing (rule 8, B-12),
   and the Handoff shows it.
5. The Handoff carries forward the items listed above for Tasks 9 and 10.

## Out of scope

- Reusing a deactivated user's PIN: its own task after this one (partial unique index, migration
  `0006`). Do not touch `createStaffUser` or the index here.
- The cooldown-refused approval's audit outcome (Task 10's consult), routes and the six-digit
  check at the route (Task 9), sessions (Task 7), a bucket reader for the lock screen.
- Changing FR-A5's reset rule (an owner question in ARCH-007, *For the owner* 2).

## Handoff

**What I did.** Added `apps/server/src/domain/throttle.ts`, which exports exactly `ThrottleClass`,
`MAX_FAILURES`, `COOLDOWN_MINUTES`, `ThrottledVerification` and `verifyPinThrottled` (at runtime the
three values; the types vanish). One attempt is one `withTransaction`: the class's row is read with
`SELECT ... FOR UPDATE`; a missing row throws (a message naming the class, never the PIN);
`blocked_until > now()` returns `THROTTLED` having written nothing; otherwise `findUserByPin(pin, client)`
runs on the transaction's client, success (`LOGIN`: any active user; `MANAGER_APPROVAL`: role
`MANAGER`) resets that class's row, and anything else is one `UPDATE ... RETURNING` using the
illustrative SQL's `CASE` (an ended cooldown restarts the count at 1). All time is PostgreSQL's; the
file has no `Date`. After the commit, a `LOGIN` failure writes `PIN_FAILURE` and a failure that
started a cooldown writes `COOLDOWN_STARTED`, through `writeSecurityEvent`, passing
`clientInstanceId` through. `findUserByPin` in `apps/server/src/domain/pin.ts` gained the optional
`Pick<pg.PoolClient, 'query'>` second parameter and an `import type pg`; nothing else in `pin.ts`
changed. Added `apps/server/test/throttle.test.ts` (21 tests, one per case). Commit hash: see
`git log` on `agent/phase0-006` (the commit follows this Handoff, so its hash cannot be written here).

**Decisions.** I followed the task's SQL and rules without deviation. `retryAfterSeconds` is
converted with `Number()` because PostgreSQL's `::int` arrives as a JS number already; it is not
money. A failed evidence write (case 16) rejects the call after the count has committed, as the task
requires; the `COOLDOWN_STARTED` write is skipped in that case because `PIN_FAILURE` throws first
(the task does not say otherwise). Cases 7 and 9 call `resetDatabase()` and recreate fixtures
mid-test to test the reverse direction from a clean bucket; that is slower but keeps each case in one
test as the task numbers them.

**Existing tests changed:** none. `pin.test.ts` and the others are untouched.

**Case to test name** (`apps/server/test/throttle.test.ts`): 1 "1: four wrong PINs count without a
cooldown, then a correct PIN verifies"; 2 "2: the fifth wrong PIN starts a five-minute cooldown";
3 "3: during the cooldown the correct PIN is THROTTLED and nothing is written"; 4 "4: retryAfterSeconds
is the time left on a cooldown set by the owner"; 5 "5: a wrong PIN after an ended cooldown counts as
the first failure"; 6 "6: a correct PIN after an ended cooldown verifies and resets the row"; 7 "7: a
cooldown in one class leaves the other verifying"; 8 "8: a correct login does not reset the approval
class (FR-A5, AC-19)"; 9 "9: a cashier's own PIN fails approval; a manager's verifies and resets"; 10
"10: a success resets its own class's row only"; 11 "11: twenty-five simultaneous wrong PINs settle as
five failures and twenty throttled" (30 s timeout); 12 "12: the row lock is real: ..." (30 s, polls
`pg_stat_activity` for at least six `pos_app` backends waiting on `Lock`); 13 "13: the decision is
made from the row as read under the lock"; 14 to 17 the "evidence" tests of the same numbers; 18 "18:
a fresh module still refuses, and the table is a permanent one"; 19 "19: the module exports exactly
the agreed names"; 20 "20: a missing bucket row is an error, never 'not throttled'"; 21 "21: no error
and no event row contains the PIN".

**Red proofs** (each mutated, run, read, reverted; `throttle.ts` is back to its green state):
1. Removed `FOR UPDATE`: case 11 `expected ... length of 5 but got 23`; case 12 `length of 5 but got
   12`; case 13 `expected 'VERIFIED' to be 'THROTTLED'`. Case 12 is deterministic as the task says.
2. `findUserByPin(pin)` without the client: case 11 `Test timed out in 30000ms`, and every later test
   hit `Hook timed out in 10000ms` (the pool was exhausted by 10 held transactions each waiting for an
   11th connection).
3. Inserted the `PIN_FAILURE` row inside the transaction through the client: case 16 `expected +0 to be
   1` (the foreign-key error rolled the count back).
4. Count always `consecutive_failures + 1` (both `CASE`s): case 5 `retryAfterSeconds` received 300,
   expected null (the aged row went to 6 and started a cooldown at once).
5. `accepted` forced true (role rule dropped): case 9 received `outcome: 'VERIFIED'` for the cashier in
   `MANAGER_APPROVAL`.
6. Success `UPDATE` without `WHERE throttle_class = $1`: case 8 `retryAfterSeconds` null, expected 300;
   case 10 `expected +0 to be 3`.
7. An unlocked read before the locking one, with the decision taken from it: case 13 `expected
   'VERIFIED' to be 'THROTTLED'` (cases 11 and 12 failed too, with 23 and 12 FAILED).

**Checks.** `grep -n "Date\|console\." apps/server/src/domain/throttle.ts` prints nothing.
`npx vitest run apps/server/test/throttle.test.ts` passed three times in a row, 21 of 21 each time
(about 2 s). `npm run verify`: typecheck clean; 49 test files, 2836 tests passed (against
`development`'s 48 files and 2815: one new file, 21 new tests; the client's 40 files and 2719 tests
are unchanged inside that total). No formatter was run. No browser was needed.

**Found and not fixed.** Nothing in committed work. Note for the lead: the first draft of the test
file failed typecheck (`managerId` used before assigned), fixed before commit by making it a local
in case 9.

**For Task 9.** The response rules are ARCH-007 question 7: `FAILED` carries `retryAfterSeconds` only
on the failure that started a cooldown, otherwise null; `THROTTLED` always carries a whole number
from 1 to 300. `verifyPinThrottled` does not check the six-digit rule: a non-six-digit PIN is simply a
failure and counts. The route must apply the six-digit rule (and decide whether a malformed PIN
should even reach the throttle) itself. The back-office login is no longer a PIN login.

**For Task 10.** `THROTTLED` is a returned value and writes no event, no audit entry and no bucket
change. The audit outcome for an approval refused by the cooldown does not exist yet (owner ruling:
it must be audited; `AuditOutcome` has no member for it). A failed `MANAGER_APPROVAL` writes no
`PIN_FAILURE`; only the cooldown start writes `COOLDOWN_STARTED`.

**Closure.** AC-19 is proved here at the domain level only; it closes when Task 9 proves it through
the route. AC-18 is not closed by this task.

DONE
