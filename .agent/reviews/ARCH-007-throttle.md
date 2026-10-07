# ARCH-007 — Is the Phase 0 plan's Task 6 (throttle buckets) right?

Author: `architect7`, 2026-10-07. Read-only consult for PHASE0-006 (not yet written). Nothing
was edited except this report, and nothing was committed.

## Summary

**The plan's Task 6 cannot be dispatched as written.** Its three-function shape
(`assertNotThrottled`, then verify, then `recordFailure` or `recordSuccess`) is the defect, not a
detail of it: the check and the count are separate transactions with the verification between
them, so any number of guesses that arrive together all pass the check before one failure is
recorded. "Five" becomes "five plus whatever was in flight". Fixing the names and the reset rule
and keeping that shape would ship the race.

What the task must say instead, in order of weight:

1. **One exported function, `verifyPinThrottled`, does the check, the verification and the
   count inside one held row lock, in a transaction it owns.** There is no accepted race inside
   a class (question 1).
2. **Nothing else is exported that changes a bucket.** No `recordSuccess`, no `recordFailure`,
   no reset. An exported reset is a way to clear a cooldown without a PIN (question 7).
3. **The lookup must run on the transaction's own connection.** If it takes a second connection
   from the pool while the lock is held, ten queued guesses deadlock the server permanently.
   `findUserByPin` therefore gains an optional client parameter (question 1).
4. **The bucket update commits first; security events are written after it, through the
   existing `writeSecurityEvent`.** `audit.ts` does not change. Evidence that fails to write
   must never refund a strike (question 5).
5. **A failed manager approval writes no `PIN_FAILURE` security event.** FR-A5 puts it in the
   audit log, and the plan would record it twice (question 5).
6. **A refused attempt is a returned value, not a thrown error**, so Task 10 can write the
   audit entry the owner ruled on (question 7).
7. **PIN reuse is its own small task**, with a partial unique index. The existing
   `ON CONFLICT (pin_lookup)` in `createStaffUser` stops working the moment the index becomes
   partial, and must change in the same commit (question 8).

No boundary is strained by any of this. Two points go to the owner; neither blocks PHASE0-006.

## What I verified, and what I could not

Read: the task file; plan Task 6 whole and the parts of Tasks 9 and 10 that call it
(`:2545-2580`, `:2895-2960`); ARCHITECTURE.md sections 5.1, 7, 8, 11 and 14; ADR-007 whole;
PRD FR-A3 to FR-A7, FR-B3, FR-J2 to FR-J4, AC-18, AC-19, AC-32; BOUNDARIES B-7, B-11, B-12,
B-13, B-24; ARCH-006 whole; `.agent/DECISIONS.md` from 2026-09-30 on (the task cites it);
`db/migrations/0002` and `0005`; `audit.ts`, `pin.ts`, `config.ts`, `pool.ts`;
`test/support/database.ts`; the test titles of `schema.test.ts` and `pin.test.ts`; the root
`vitest.config.ts`; the PHASE0-005 Handoff.

**The lead's account under *What exists* holds in every particular.** `pos_app` has `SELECT` and
`UPDATE (consecutive_failures, blocked_until)` on `pin_throttle_bucket` and nothing else;
`writeSecurityEvent` goes through the pool's `query`; `findUserByPin` returns the credential
version from the row it verified.

One thing in `pin.ts` matters more than the task file says: `findUserByPin` finds the row by its
digest first and runs Argon2id only if a row exists. A wrong guess therefore costs one `SELECT`
and no hashing. Only a correct PIN pays for Argon2id. That is what makes holding a lock across
the verification cheap (question 1).

**Library facts.** I put four to the librarian. Three came back as I expected and are used
below: `SELECT ... FOR UPDATE` needs `UPDATE` on at least one column, which the column grant
satisfies; `pg.Pool` defaults to ten clients and waits forever for one when
`connectionTimeoutMillis` is unset; `now()` is the transaction's start time and does not advance
while a statement waits for a lock.

**The fourth answer was wrong, and I checked it myself.** The librarian said `ON CONFLICT (c)`
infers a partial unique index without repeating its predicate. It does not. I ran the statements
against the development container in a temporary table inside a transaction that I rolled back,
so nothing persistent was touched: without the predicate PostgreSQL 16 raises *there is no unique
or exclusion constraint matching the ON CONFLICT specification*; with `ON CONFLICT (c) WHERE
is_active` it works; and setting a deactivated row active again when its value has been taken
raises a unique violation. Question 8 rests on that probe.

**Not read:** `.agent/STATE.md`, `QUEUE.md` and the journal (a worker does not); ADR-001 to 006
beyond the two lines of ADR-002 that mention throttle buckets; plan Tasks 7 and 8.

---

## 1. Concurrency

**Authority:** FR-A5 ("after five consecutive failures ... the server rejects further
verification"); ARCHITECTURE 7.3 ("each is atomically locked and updated"); section 8
(`READ COMMITTED` with explicit row locks); section 14.2 ("throttle bucket races").

### Ruling

One transaction, owned by the throttle, per attempt:

1. Lock the class's row with `SELECT ... FOR UPDATE`.
2. If the row is in a cooldown, return the refusal. Nothing is verified and nothing is written.
3. Otherwise verify the PIN, on the same connection.
4. Write the outcome to the row: the reset on success, the increment on failure.
5. Commit.

**The check and the verification must sit inside the one held lock. No window is acceptable.**
With a window, the bound on guesses is set by how many requests the attacker sends at once, which
is not a bound. It also cannot be tested: a property that holds "usually" has no red proof.

Inside a class the lock gives every attempt a place in one order, so "five consecutive" means
something exact, and the count is right by construction. **I accept no race inside a class.**
Across classes there is nothing to race: the two rows are independent.

What is *not* a race, and should not be mistaken for one: a success by any valid PIN in a class
resets that class's count, including four failures somebody else made. That is FR-A5 as written
(see *For the owner*, 2).

### Why the cost is acceptable

Attempts in one class run one at a time. A wrong guess holds the lock for two short statements.
A correct PIN holds it for one Argon2id verification (19 MiB, two passes: tens of milliseconds).
The MVP has one terminal. Serial verification is what the requirement asks for, not a side
effect to engineer around.

### The hazard this creates, and the rule that removes it

The lock holder occupies one pool connection. Every attempt waiting behind it occupies another,
blocked in PostgreSQL. The pool holds ten. `findUserByPin` today calls the pool's `query`, which
needs a connection of its own. So with ten attempts in flight, nine waiters hold nine
connections, the holder asks for an eleventh, the pool queues that request forever (no
connection timeout is set), and the holder never commits. **The server stops answering every
request, PIN or not, until it is restarted.** Ten simultaneous requests to the login route are
enough.

The rule:

> Everything that runs while the bucket's row lock is held runs on the transaction's own
> client. No pool call (`query`, `withTransaction`, `writeSecurityEvent`) is made between the
> lock and the commit.

It needs one change outside `throttle.ts`: `findUserByPin(pin, db?)` takes an optional
`Pick<pg.PoolClient, 'query'>` and uses it when given. Its behaviour, its return value, its
error replacement (B-12) and its existing tests are otherwise unchanged. This is PHASE0-006's
to make, with a test that fails by hanging if it is undone (*For the task file*, case 11).

### Alternatives, and why they lost

- **The plan's shape with a better lock in `recordFailure`.** The lock was never the problem;
  the gap between the check and the count is. Lost for the reason in the summary.
- **Count the attempt first, forgive on success** (one `UPDATE ... RETURNING` that charges a
  strike before verifying, and a reset afterwards). No lock is held across the verification
  and no connection hazard exists, which is attractive. It loses on meaning: the stored count
  becomes "failures plus attempts in flight"; a fifth attempt that is *correct* starts a
  cooldown it then has to cancel; a success can erase a cooldown that a different, failing
  attempt started; and a crash between the charge and the verification leaves a strike for a
  failure that never happened. Each case can be argued safe, but none of it can be read off
  the row, and the architecture says locked.
- **`FOR UPDATE NOWAIT`, refusing a concurrent attempt as "busy".** It bounds connections, but
  adds a fourth outcome every caller and screen must handle, and lets anyone refuse a real
  login by sending requests in a loop without ever starting a cooldown.
- **An in-process mutex per class.** The server is one process today (ADR-001), so it would
  work, but it is a second mechanism beside the one the architecture names, and it is wrong the
  day there are two processes.
- **A generic `verifyWithThrottle(class, callback)` that hands the caller the client.** See
  question 7.

## 2. Time

**Authority:** ARCHITECTURE 14.4 ("use PostgreSQL time for ... cooldown"); ARCH-006 section 4.

**Database time only.** `blocked_until` is written as `now() + interval` inside the `UPDATE`,
compared with `now()` inside SQL, and the seconds remaining are computed in SQL
(`ceil(extract(epoch from blocked_until - now()))`). No `Date`, no `Date.now()` and no
JavaScript arithmetic on a timestamp appears in `throttle.ts`. The function returns a number of
seconds, never a timestamp, so no caller is tempted to compare one with the Node clock.

**One consequence the builder must know rather than discover.** `now()` is the transaction's
start time. An attempt that waits for the lock decides with a clock as old as its wait. The
effects are that a cooldown can end earlier than five minutes after the fifth failure by the
length of that wait, and that an attempt which queued just before a cooldown expired is refused
although the cooldown has, by the wall clock, just ended. The wait is bounded by the queue in
front of it (at most nine attempts, a fraction of a second). **I accept this skew.** It buys one
instant for the check and the write in the same transaction. The builder must not "fix" it with
Node time; `clock_timestamp()` is not needed.

**Tests never wait and never shorten the cooldown.** They change the row through `ownerQuery`:

- to age a cooldown past its end: `SET blocked_until = now() - interval '1 second'`;
- to place one just before its end: `SET blocked_until = now() + interval '30 seconds'`;
- to prove the length: after the fifth failure, read
  `extract(epoch from blocked_until - now())` through the owner connection and assert it lies
  in `(295, 300]`.

There is no test hook, environment variable or parameter that changes the five failures or the
five minutes. A knob added for tests is a knob in production (question 7, on B-24).

## 3. The reset after a cooldown

**Authority:** owner ruling, 2026-10-06 ("the failure count resets when a cooldown ends").

**The reset is lazy, and it is a rule for reading the row, not a job that rewrites it.** Nothing
runs when five minutes pass: there is no scheduler in Phase 0 and none should be added for this.
The state of a bucket is a function of its row and `now()`:

| Row | Meaning | Effective count |
|---|---|---|
| `blocked_until IS NULL` | no cooldown | `consecutive_failures` |
| `blocked_until > now()` | cooling down | refused; the count is not consulted |
| `blocked_until <= now()` | the cooldown has ended | **0** |

So the count *is* zero from the instant the cooldown ends, although the stored column still
reads 5 until the next verification completes and writes its outcome. That next verification is
the only thing that rewrites the row:

- it fails: `consecutive_failures = 1`, `blocked_until = NULL`. **The count after the first
  failure following an expired cooldown is 1**, and four more are needed to block again;
- it succeeds: `consecutive_failures = 0`, `blocked_until = NULL`.

A check alone never writes. There is no need: under question 1 every attempt that is not
refused ends in a write, and if the verification throws (a database failure) the transaction
rolls back and the row still reads as "ended, count 0".

Two things follow. `blocked_until IS NOT NULL` always means "a cooldown started and no
verification has completed since", and the stored count is then 5. And any later reader of the
row (a status endpoint, a back-office screen) must apply the table above, not print the column.

## 4. An attempt during a cooldown

**Authority:** FR-A5 ("rejects further verification in that class for five minutes"); AC-19;
ARCHITECTURE section 16 (the risk row: "a *bounded* local denial of service").

- **It is not verified.** No digest lookup, no Argon2id. The refusal is decided from the bucket
  row alone, so a correct PIN and a wrong one get the same answer in the same time, and the
  answer says nothing about whether the PIN exists.
- **It does not count as a failure.** No PIN was verified, so no verification failed.
- **It does not extend the cooldown.** `blocked_until` is not touched. Five minutes is what
  FR-A5 says; a cooldown that every attempt renews is one that a person tapping the keypad, or
  a script, can hold for ever, and section 16 accepts this risk only because it is bounded.
- **It writes no security event.** `COOLDOWN_STARTED` was written once, when the cooldown
  began. A refused attempt is neither a PIN failure nor a new cooldown.
- **It writes nothing at all.** The transaction that found the cooldown commits empty.

For `MANAGER_APPROVAL`, the refused attempt has an identified actor, and the owner ruled it an
audit entry. That entry is Task 10's. What Task 6 owes it is in question 7.

The plan gets one of these wrong in a way worth naming: its `recordFailure` sets
`blocked_until = now() + 5 minutes` whenever the count is at or above five, so every failure
recorded during a cooldown would extend it. Under the plan's race that path is reachable.

## 5. Security events and transactions

**Authority:** FR-A5; FR-J3; AC-18; ADR-007; ARCHITECTURE sections 5.1 and 11; B-13.

### Which events

| | `LOGIN` | `MANAGER_APPROVAL` |
|---|---|---|
| A failed verification | one `PIN_FAILURE` | **none** |
| The failure that starts a cooldown | also one `COOLDOWN_STARTED` | one `COOLDOWN_STARTED` |
| A refused attempt, a success | none | none |

**A failed manager approval is not a `PIN_FAILURE` security event.** FR-A5 separates the two in
one sentence: "Unauthenticated login failures are security telemetry; failed and cancelled
manager approvals remain actor-attributed audit entries." FR-J3 gives the reason telemetry
exists at all: those events "have no identified actor". A failed approval has one, and Task 10
writes its `APPROVAL_FAILED` entry. The plan's `recordFailure` writes `PIN_FAILURE` for both
classes, which records the same fact in both stores and blurs the line B-13 depends on.

`COOLDOWN_STARTED` is written for both classes. It is a fact about the installation, not about
a person ("throttle cooldowns are security telemetry", FR-J3), and the fifth failed approval's
audit entry does not say that a cooldown began.

The plan never writes `COOLDOWN_STARTED`. AC-18 expects cooldowns in telemetry.

### Where they are written

**After the throttle's transaction commits, through the existing `writeSecurityEvent`. The
signature in `audit.ts` is right; Task 6 adds nothing to that file.**

The principle: *the bucket is enforcement and the event is evidence, and evidence must never be
able to undo enforcement.* If the event were inserted in the same transaction as the increment,
any failure of that insert would roll the strike back. One such failure is within a caller's
reach: `client_instance_id` is a foreign key, so a client-instance value that does not exist
raises an error, and a route that passed a cookie value straight through would give an attacker
guesses that are never counted. Writing the event after the commit closes that for good. It
also keeps the rule from question 1 (no pool call under the lock) without an exception, and it
is what the PHASE0-005 Handoff observed: the pool-level writer survives a caller's rollback for
free.

What this costs, stated plainly:

- **A crash between the commit and the insert loses an event for a failure that was counted.**
  Acceptable for operational telemetry; the reverse, a counted event with no strike, would not
  be.
- **If the event insert throws, `verifyPinThrottled` throws.** The strike stands, the caller
  answers with a server error, and no success is involved, because events are only written on
  the failure path. For an approval this means Task 10 does not reach its `APPROVAL_FAILED`
  entry on that request; the protected action still does not run, which is what ADR-007
  requires of it.

*The alternative*, a client-taking `writeSecurityEventOn(client, input)` used inside the
transaction, gives an exact one-to-one between strikes and events. It loses because the only
way to keep that equality when the insert fails is to give the strike back.

### The transaction is never the caller's

`verifyPinThrottled` takes no client and joins no transaction. A login or an approval that
later rolls back must not roll back its throttle outcome. Task 10's business transaction opens
after the throttle's has committed.

## 6. Success

**Authority:** FR-A5; AC-19.

A success sets its own class's row to `consecutive_failures = 0, blocked_until = NULL` and
touches nothing else: not the other class's row, and no security event. The `WHERE` names one
class.

What needs saying is **what counts as a success**, because the plan leaves it to each caller
and Task 10 would get it subtly wrong by accident one day:

- `LOGIN`: the PIN belongs to an active staff user.
- `MANAGER_APPROVAL`: the PIN belongs to an active staff user **whose role is `MANAGER`**
  (ARCHITECTURE 7.1). A cashier's own valid PIN typed at an approval prompt is a *failure* in
  that class: it increments the count, and it must never reset it. If it reset the count, any
  cashier could clear an attack on the manager PIN by typing their own, which is exactly what
  FR-A5's "a successful cashier login must not reset failed manager-approval guesses" forbids
  by another door.

That rule lives in `throttle.ts`, keyed on the class, and is tested there (question 7).

A verification that throws is neither. The transaction rolls back and the row is unchanged.

## 7. The interface for Tasks 9 and 10

### Exports

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

### Why one function

- **It is the only shape that can hold question 1.** Three functions put the caller's code,
  and therefore the gap, between the check and the count.
- **No exported reset.** With `recordSuccess` exported, every later route is one line from
  clearing a cooldown without a PIN. With one function, the only path to a reset is a
  verification that succeeded under the lock.
- **No caller code under the lock.** The alternative I considered longest is a generic
  `verifyWithThrottle(class, (client) => ...)`. It keeps the PIN out of `throttle.ts`
  entirely, which is its merit. It loses because it hands the throttle's client to the caller:
  a callback that ignores it and uses the pool recreates the deadlock in question 1 with no
  test in Task 6 able to see it, and a callback that writes through it (Task 10's audit entry,
  say) puts work in the throttle's transaction whose failure would refund a strike. The PIN
  passing through one function that never logs it is the smaller exposure. `throttle.ts`
  gives the PIN to `findUserByPin` and to nothing else.

### Why a returned value, not `ThrottledError`

Both callers must *do* something on a refusal: Task 9 answers with the seconds remaining, and
Task 10 writes an audit entry naming the cashier (owner, 2026-10-06). A refusal is an expected
outcome with data, and an exception that must be caught for the normal flow is a refusal that
will one day not be caught. A union the compiler forces the caller to exhaust is the safer
contract. Exceptions are left for what they mean: the database failed.

### What each later task gets

- **Task 9 (login).** `THROTTLED` is decided before any PIN is looked at, so the response
  cannot depend on whether the PIN exists. `FAILED` does not distinguish "no such PIN" from
  "a row matched and Argon2id refused"; the route sends one response for both. On the fifth
  failure `FAILED` carries `retryAfterSeconds`, so the screen can show the cooldown at once
  without a second request. On `VERIFIED` the route passes `user.credentialVersion` to session
  creation unchanged (ARCH-006 section 4, point 2).
- **Task 10 (approval).** `THROTTLED` arrives as a value with `retryAfterSeconds` and with no
  security event written, so Task 10 can write its audit entry with the actor it already
  holds. **Task 10 has a gap of its own that this consult does not close:** the audit table's
  outcome check allows `SUCCESS`, `APPROVAL_FAILED` and `APPROVAL_CANCELLED`, and none of them
  says "refused by the cooldown, no PIN verified". `APPROVAL_FAILED` would misstate it. A
  fourth outcome is a migration that widens the check. That is for Task 10's consult.
- **Both.** A request whose PIN is not six digits should be refused by the route's schema
  before it reaches the throttle. It can never be a valid PIN, so not counting it gives an
  attacker nothing, and counting it lets a client bug lock the restaurant out. If one does
  reach `verifyPinThrottled`, it is a failed verification like any other.
- `options.clientInstanceId` must be the id of a `client_instance` row the server resolved
  (Task 8), never a cookie value passed through.

### Constants and B-24

`MAX_FAILURES` and `COOLDOWN_MINUTES` are constants in `throttle.ts`, passed to SQL as
parameters, and exist nowhere else. B-24 covers "what a restaurant changes routinely"; FR-A5
fixes both numbers, so they are policy in code, exactly as ARCH-006 ruled for the session idle
limits. They are not read from the environment, from a settings table, or from an optional
argument. Tests import them and never restate 5.

No read-only status function is exported. Nothing in Phase 0 reads a bucket except the
verification itself; a lock screen that wants to show a cooldown on load will bring its own
reader, under the table in question 3.

## 8. PIN reuse

**Authority:** owner ruling, 2026-10-06; FR-A4; FR-B3; ARCHITECTURE 7.3.

### The migration

A new forward migration; `0002` is never edited.

```sql
-- db/migrations/0006_staff_user_active_pin_lookup.sql
-- A PIN is unique among ACTIVE staff (owner, 2026-10-06): a deactivated
-- user's PIN may be given to someone else. An audit entry names a staff id,
-- never a PIN, so the actor stays unambiguous (FR-A4, B-13).
DROP INDEX staff_user_pin_lookup_key;

CREATE UNIQUE INDEX staff_user_active_pin_lookup_key
  ON staff_user (pin_lookup) WHERE is_active;
```

No index is needed for deactivated rows: nothing looks one up by PIN. `findUserByPin` already
filters on `is_active`, so with the partial index it still matches at most one row.

### What breaks if the migration lands alone

`createStaffUser` inserts with `ON CONFLICT (pin_lookup) DO NOTHING`. Against a partial index
that statement no longer names a usable constraint and PostgreSQL rejects it outright (verified;
see *What I verified*). **Every user creation would fail**, with `pin.ts`'s generic "store
failed" message. The same commit must change it to
`ON CONFLICT (pin_lookup) WHERE is_active DO NOTHING`.

### Reactivation

**The PRD has no reactivation.** FR-B3 lists create, assign role, set and reset PIN, and
deactivate. So today the question does not arise, and this task adds no reactivation path.

If one is ever added, the index already decides the dangerous case: setting `is_active` back to
true on a row whose PIN an active user now holds is a unique violation, so two active users can
never share a PIN whatever the application does. What the *command* should do is a product
question (*For the owner*, 1). My recommendation is that reactivation always sets a new PIN: the
old one was known to someone the restaurant chose to lock out.

### Which task

**Its own task**, not this one and not Task 7. It is unrelated to throttling and to sessions;
it is a migration, one line of `pin.ts`, and changes to two existing tests, and it is an
identity change that deserves a review that is about nothing else. It must merge before the
Phase 1 users screen, which is the first code that deactivates anyone. Nothing in Tasks 6 to 12
depends on it.

It touches `pin.ts`, as PHASE0-006 does (a different function). Run the two one after the
other, in either order, rather than at once.

Its tests: a duplicate PIN among active users is still refused (the constraint name in
`schema.test.ts` case 15 changes); a PIN held only by a deactivated user can be given to a new
user; `findUserByPin` then returns the new user and never the deactivated one; setting the
deactivated row active again is refused by the index; the PostgreSQL error for that refusal,
whose detail contains the digest, does not escape `pin.ts` (B-12).

## 9. Anything else in plan Task 6

**Wrong against the documents or against what is built.**

| # | Plan | Must be | Authority |
|---|---|---|---|
| 1 | Check, verify and count in three transactions | One held lock | question 1 |
| 2 | Count stays at 5 after a cooldown | Lazy reset | owner, 2026-10-06 |
| 3 | A failure during a cooldown extends it | Never touched | FR-A5; section 16 |
| 4 | `PIN_FAILURE` for failed approvals | `LOGIN` only | FR-A5; FR-J3 |
| 5 | No `COOLDOWN_STARTED` anywhere | Written when one starts | FR-J3; AC-18 |
| 6 | `writeTelemetry({ event, ... })`, a `detail` column | `writeSecurityEvent({ eventType, ... })`, typed columns | ARCH-006; `audit.ts` |
| 7 | `auth_throttle`, `security_telemetry` | `pin_throttle_bucket`, `security_event` | section 5.1 |
| 8 | `recordSuccess` and `recordFailure` exported | Not exported | question 7 |
| 9 | `ThrottledError` | A returned outcome | question 7 |
| 10 | No race test | Required | section 14.2 |

**Tests that cannot run as written.** The plan's `beforeEach` resets with `UPDATE` and `DELETE`
through `query()`. `pos_app` cannot delete from `security_event`, and cannot select from it
either, so the plan's telemetry assertions fail on permission before they assert anything. Reset
is `resetDatabase()`; every read of `security_event` and every change to fixture state goes
through `ownerQuery`.

**The six-digit scan is retired, not ported.** The plan proves "no PIN in telemetry" by
searching `detail` for six digits. There is no `detail`; `schema.test.ts` case 12 already pins
the table's columns. The Task 6 test instead asserts the event rows' exact contents.

**The plan's fourth test is right and stays**, as the plan says, the one that matters most: a
login success must not reset approval failures.

**Found, outside Task 6.**

- **Plan Task 9 writes a back-office login against the `LOGIN` PIN bucket.** The owner has
  since ruled that the back office signs in with a username and password, and that a wrong
  password counts "on the idled manager's account" (2026-10-06). That is a per-account rule and
  a different credential. `pin_throttle_bucket` is installation-wide and is for PINs. Whatever
  throttles back-office passwords is not this table and not this task, and Task 9 needs its
  own consult before it is written.
- **Timing.** A correct PIN takes an Argon2id verification longer to answer than a wrong one.
  The throttle limits how often that can be measured, and the server is loopback-only. It
  belongs on the list for the gate in ARCHITECTURE 3.2, not in this task.
- **ARCHITECTURE 7.3 says "PINs are unique".** After the reuse ruling the accurate words are
  "unique among active staff". That document is the architect's; it is a one-line change for
  whoever is commissioned to make it, alongside the PRD wording below.

---

## For the task file

### PHASE0-006: rules

1. `apps/server/src/domain/throttle.ts` exports exactly `ThrottleClass`, `MAX_FAILURES`,
   `COOLDOWN_MINUTES`, `ThrottledVerification` and `verifyPinThrottled`, with the signatures
   in question 7. The plan's Task 6 code and test are superseded and must not be copied.
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

### PHASE0-006: the Handoff must carry forward

- For Task 9: the response rules in question 7, the six-digit rule at the route, and that the
  back-office login is no longer a PIN login.
- For Task 10: `THROTTLED` is a value and writes no event; the audit outcome for a
  cooldown-refused approval does not exist yet; a failed approval writes no `PIN_FAILURE`.
- AC-19 is proved here at the domain level. It is closed only when Task 9 proves it through
  the route. AC-18 is not closed by this task.

### The PIN reuse task (separate; the lead names it)

Rules: migration `0006` as in question 8, never an edit to `0002`; `createStaffUser`'s conflict
target gains `WHERE is_active` in the same commit; no reactivation function is added; the five
tests listed in question 8; `schema.test.ts` case 15 changes its constraint name and gains the
deactivated-duplicate case, and its privilege map does not change (an index carries no grant).
Red proof: revert the `ON CONFLICT` change and every `createStaffUser` test fails. Sequence it
before or after PHASE0-006, not beside it.

---

## For the owner

Nothing here blocks PHASE0-006.

1. **FR-A4 no longer says what was ruled, and reactivation is undefined.** The PRD reads "PINs
   are unique per user, so an audit actor is unambiguous." Proposed replacement, for the lead
   to draft and the owner to approve:

   > **FR-A4** PINs are unique among active users, so an audit actor is unambiguous. A
   > deactivated user's PIN may be given to another user.

   Separately: can a deactivated user be made active again? FR-B3 does not say so, and nothing
   is being built for it. If the answer is yes, I recommend it always requires a new PIN. Needed
   before the Phase 1 users screen.

2. **A limit of FR-A5 the owner should know is there.** Any success in a class resets that
   class's count. A cashier holds a valid PIN, so a cashier can guess four PINs at the lock
   screen, log in as themselves, release, and repeat without ever starting a cooldown. The
   manager's login PIN is the same PIN that approves refunds and voids, so the separate
   `MANAGER_APPROVAL` bucket does not protect it from that route. By hand, against a million
   PINs, this is not practical; by script it needs access to the one machine the server runs
   on. I recommend accepting it for the MVP and recording it for the gate before any networked
   use (ARCHITECTURE 3.2). Any fix changes FR-A5, so it is the owner's and nothing is built for
   it here. Every such guess does leave a `PIN_FAILURE` event.

3. **Confirm, or object to, one reading.** I have ruled from FR-A5's wording that a failed
   manager approval appears in the audit log only, and not also as a `PIN_FAILURE` in security
   telemetry. If the owner wants both, it is one line in the task file.

DONE
