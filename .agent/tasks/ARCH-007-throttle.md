# ARCH-007 — Is the Phase 0 plan's Task 6 (throttle buckets) right?

Owner: `architect7`. Written by the lead, 2026-10-07. Read-only consult: you write one report,
`.agent/reviews/ARCH-007-throttle.md`, and touch nothing else. It is the architect consult
WORKFLOW.md requires before a task that touches identity or audit is dispatched. The task it
serves is PHASE0-006 (plan Task 6, throttle buckets), not yet written; the lead writes it from
your report, as PHASE0-003c to 005 were written from ARCH-006.

## The question

Plan Task 6 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1532-1721`) gives
`throttle.ts` and its test verbatim. It predates ARCHITECTURE.md, the ADRs, ARCH-006 and what
has since been built. ARCH-006 §8 (`.agent/reviews/ARCH-006-phase0-core-schema.md:706-726`)
already found two defects in it. The lead wants to know what the task must say instead, before
a builder copies the plan.

## What exists (verify it; do not take the lead's word)

- `db/migrations/0005_pin_throttle_bucket.sql`: two seeded rows (`LOGIN`, `MANAGER_APPROVAL`),
  `consecutive_failures`, `blocked_until timestamptz`; `pos_app` has `SELECT` and column
  `UPDATE` only, no INSERT or DELETE. The plan's `auth_throttle` name is superseded.
- `apps/server/src/domain/audit.ts` (PHASE0-005, merged): `writeSecurityEvent({ eventType:
  'PIN_FAILURE' | 'COOLDOWN_STARTED', throttleClass, clientInstanceId? })` writes through the
  pool's own `query`, **not** a caller's client, so it cannot join a transaction. Its Handoff
  raised this for Task 6. `writeAudit(client, entry)` does take a client.
- `apps/server/src/domain/pin.ts` (PHASE0-004): `findUserByPin(pin)` returns
  `{ id, role, credentialVersion } | null`, Argon2id verify included.
- `apps/server/src/db/pool.ts`: `query`, `withTransaction`. Tests reset with `resetDatabase()`
  and change fixture state through `ownerQuery` (`apps/server/test/support/database.ts`).

## Owner rulings that bind this task (`.agent/DECISIONS.md`, 2026-10-06)

- **The failure count resets when a cooldown ends** (answering ARCH-006 *For the owner*, 2).
- **A cashier's approval refused by the cooldown writes an audit entry, not a security event.**
  That entry is plan Task 10's to write; say only what Task 6 must expose so Task 10 can.
- A deactivated user's PIN may be reused by another user (see question 8).

## Questions

1. **Concurrency.** Five guesses can arrive at once. What locking makes "five consecutive
   failures, then reject" hold under concurrent requests (row lock, single `UPDATE … RETURNING`,
   or other), given `pos_app`'s grants? Must the check and the Argon2id verify sit inside one
   held lock, or is a window between them acceptable? State the race you accept, if any.
2. **Time.** `blocked_until` from database time (`now()`), never the Node clock? How do tests
   prove the five-minute cooldown and its expiry without waiting (owner-side `UPDATE`)?
3. **The reset after cooldown** (owner ruling). Exact semantics: when does the counter become 0
   (lazily on the next check or failure, or otherwise), and what is the count after the first
   failure following an expired cooldown?
4. **An attempt during a cooldown.** Is it verified at all? Does it count as a failure, extend
   the cooldown, or write any security event? FR-A5 and AC-19 are the authority.
5. **Security events and transactions.** A `PIN_FAILURE` per failure and a `COOLDOWN_STARTED`
   when one starts: written in the same transaction as the bucket update, or deliberately
   outside it so a rolled-back login keeps them? If inside, should Task 6 add a client-taking
   variant to `audit.ts` (and what is it called), or is the current signature right?
6. **Success.** `recordSuccess` resets only its own class (FR-A5, AC-19). Anything else?
7. **The interface for Tasks 9 and 10.** What Task 6 exports (the plan's `assertNotThrottled`,
   `recordFailure`, `recordSuccess`, `ThrottledError.retryAfterSeconds`, `MAX_FAILURES`,
   `COOLDOWN_MINUTES`, or a different shape such as one `verifyWithThrottle`), so Task 10 can
   write the cooldown-refused approval's audit entry and Task 9 can answer a refused login
   without revealing whether a PIN exists. Constants: B-24 says these are not configuration.
8. **PIN reuse** (owner, 2026-10-06). `0002_staff_user.sql:29` makes `pin_lookup` unique across
   every row, deactivated ones included. What forward migration (a partial unique index on active
   users?), what it means for reactivating a user whose PIN was since taken, and which Phase 0
   task should carry it (this one, Task 7, or its own)?
9. **Anything else** in plan Task 6 that is wrong against ARCHITECTURE.md, the ADRs, B-11 to
   B-13, B-24, FR-A5, FR-J3, AC-18 and AC-19.

## Read

Plan Task 6 (`:1532-1721`); `docs/ARCHITECTURE.md` §7 and §11; the ADRs in `docs/decisions/`
that touch identity; `docs/PRD.md` FR-A5, FR-A7, FR-J3, FR-J4, AC-18, AC-19;
`docs/BOUNDARIES.md`; ARCH-006 §4, §6, §8 and *For the owner*; the files listed above;
`.agent/tasks/PHASE0-005-audit-and-security-event-writers.md` (its Handoff).

## Report

Write `.agent/reviews/ARCH-007-throttle.md` in full prose: a short summary, an answer to each
question with its authority, and a closing **For the task file** section (rules, names,
interface, test cases, red proofs) the lead can lift into PHASE0-006, plus **For the owner**
for anything only the owner can decide. Do not commit. When done, run exactly one of:

    herdr agent prompt lead "architect7: ARCH-007 done — <one line>"
    herdr agent prompt lead "architect7: BLOCKED — <question>"
