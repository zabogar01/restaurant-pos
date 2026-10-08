---
id: PHASE0-007b
title: The back-office credential, its per-account throttle, and the first-manager script
category: feature
touches: [identity, audit]
depends_on: [PHASE0-007, ARCH-009]
owns: [db/migrations/**, apps/server/src/**, apps/server/test/**, apps/server/scripts/**, apps/server/package.json]
status: complete
cycles: 2
---
# PHASE0-007b — The back-office credential

**Written** 2026-10-08 by the lead, from the architect consult ARCH-008
(`.agent/reviews/ARCH-008-sessions.md` §5 and *The back-office credential task*), from ADR-009
(accepted by the owner on 2026-10-08), and from ARCH-009's Handoff (*What the credential build
task needs*). All three are on `development`. Where ARCH-008's text and ADR-009 differ, ADR-009
wins. The rules below are binding and complete; the documents are cited for the reasoning. This
task touches identity and audit, so the owner looks before merging.

## Objective

Give the server a back-office credential: a `back_office_credential` table (username, Argon2id
password hash, and that account's throttle state); a module that creates a credential and
verifies a password **throttled per account**, under a row lock, exactly as `verifyPinThrottled`
does for a PIN class; two new values in `security_event` so that a failed back-office sign-in
leaves telemetry that names nobody; and a command-line script with which the owner creates the
first manager by typing their name, PIN, username and password at the host's terminal. When this
task is done, `apps/server/test/back-office-credential.test.ts` proves every rule below against
the real tables as `pos_app`, and nothing about PIN verification or the PIN throttle has changed.

## Required inputs

- **Decided, do not reopen** (owner; `.agent/DECISIONS.md` 2026-10-06 to 2026-10-08):
  - The MVP back office signs in with a username and a password. A PIN is never accepted there,
    and a password is never accepted at the POS or as an approval (ADR-009 §1).
  - A username is 3 to 32 characters of lower-case ASCII letters, digits, dot, underscore and
    hyphen, compared case-insensitively by storing it lower-cased, and is never reused, even after
    its holder is deactivated. A password is 8 to 128 characters with no composition rules
    (ADR-009 §3).
  - The password throttle is **per account**: five consecutive failures for one username start a
    five-minute cooldown for that username; only a successful verification of that account resets
    it; the count also returns to zero when a cooldown ends. It shares nothing with the PIN
    throttle (PRD FR-A5b, ADR-009 §4).
  - One credential version covers a manager's PIN and password (ADR-009 §5). No writer of it is
    in this task.
  - The first manager is created by a script at the host's terminal, which does not refuse when a
    manager already exists (ADR-009 §7; owner, 2026-10-07).
  - A wrong password at M-6 counts on the idled manager's own account row, never in a PIN class.
    Cite PRD FR-A5b and DECISIONS 2026-10-06 line 113 for this; **line 102's "counts as a LOGIN
    failure" is superseded** and must not be followed.
- **Contract:** `docs/PRD.md` FR-A1, FR-A2b, FR-A3, FR-A5, FR-A5b, FR-A7, FR-B3, AC-19, AC-35;
  `docs/BOUNDARIES.md` B-11, B-12, B-13, B-24 (B-11 and B-12 name passwords beside PINs).
- **Architecture:** `docs/decisions/ADR-009-back-office-username-and-password.md` (whole);
  `docs/ARCHITECTURE.md` §5.1 (BackOfficeCredential, SecurityEvent), §7.2, §7.3, §11.
- **The PIN throttle this mirrors:** `apps/server/src/domain/throttle.ts` as built, and its task
  file `.agent/tasks/PHASE0-006-throttled-pin-verification.md` (rules, test cases 1 to 23, red
  proofs, and *Round 2* on `clock_timestamp()`). ARCH-007's sample used `now()`; the built code
  reads the clock with `clock_timestamp()` in a statement after the lock, and this task follows
  the built code.
- **Code:** `apps/server/src/domain/pin.ts` (`ARGON2` parameters at `:13`, not exported;
  `createStaffUser` at `:51`, which takes no client; `findUserByPin`'s optional client is the
  pattern), `audit.ts` (`SecurityEventInput` at `:25`, `EVENT_TYPES` and `THROTTLE_CLASSES` at
  `:32–33`), `session.ts` (`VerifiedUser`; `reauthenticateSession` already exists and is not
  changed), `db/pool.ts` (`query`, `withTransaction`), `config.ts` (`pinPepper`),
  `apps/server/scripts/provision.ts` (how a script in this package is written and run), and the
  harness `apps/server/test/support/database.ts` (`resetDatabase`, `ownerQuery`, `ownerClient`).
- **Migrations:** `0001` to `0006` are on `development`. Yours is `0007`. `0004` defines
  `security_event_type_check` and `security_event_throttle_class_check`; `0005` defines
  `pin_throttle_bucket`.
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time and goes stale after a lock
  wait (PHASE0-006).

## Rules

1. **Migration `db/migrations/0007_back_office_credential.sql`**, forward only; no earlier
   migration is edited and `pin_throttle_bucket` is not touched. It creates the table, its index
   and its grants as below, and widens the two `security_event` checks by dropping and re-adding
   each under the same name: `event_type IN ('PIN_FAILURE', 'COOLDOWN_STARTED',
   'PASSWORD_FAILURE')` and `throttle_class IN ('LOGIN', 'MANAGER_APPROVAL',
   'BACK_OFFICE_LOGIN')`.

   ```sql
   CREATE TABLE back_office_credential (
     staff_user_id        uuid PRIMARY KEY REFERENCES staff_user (id),
     -- Stored lower-case. Unique across every row, active or not.
     username             text NOT NULL,
     -- Argon2id encoded hash (B-11, FR-A3).
     password_hash        text NOT NULL,
     consecutive_failures integer NOT NULL DEFAULT 0,
     blocked_until        timestamptz,

     CONSTRAINT back_office_credential_username_check
       CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
     CONSTRAINT back_office_credential_password_hash_check
       CHECK (password_hash LIKE '$argon2id$%'),
     CONSTRAINT back_office_credential_failures_check
       CHECK (consecutive_failures >= 0)
   );

   CREATE UNIQUE INDEX back_office_credential_username_key
     ON back_office_credential (username);

   -- No DELETE, and the username cannot be changed by the application.
   GRANT SELECT, INSERT ON back_office_credential TO pos_app;
   GRANT UPDATE (password_hash, consecutive_failures, blocked_until)
     ON back_office_credential TO pos_app;
   ```

   The pattern's first character excludes a leading dot, underscore or hyphen. That is the
   architect's narrowing within the owner's alphabet; keep it.

2. **One Argon2id definition.** Move the parameter object out of `pin.ts` into
   `apps/server/src/domain/argon2.ts`, exported, and import it in `pin.ts` and in the new module.
   Nothing else about hashing or verifying a PIN changes.

3. **`createStaffUser` gains an optional second parameter**, a `Pick<pg.PoolClient, 'query'>`,
   used when given, exactly as `findUserByPin` did. No other change to `pin.ts` beyond rule 2, and
   no existing `pin.test.ts` assertion is edited.

4. **A new module, `apps/server/src/domain/back-office-credential.ts`** (not `pin.ts`, not
   `throttle.ts`), exporting exactly:

   ```ts
   export const PASSWORD_MAX_FAILURES = 5;
   export const PASSWORD_COOLDOWN_MINUTES = 5;

   export type BackOfficeAccount = { username: string } | { staffUserId: string };

   /** Trimmed and lower-cased; null when the result does not fit the username rule. */
   export function normaliseUsername(typed: string): string | null;

   export async function createBackOfficeCredential(
     input: { staffUserId: string; username: string; password: string },
     client?: Pick<pg.PoolClient, 'query'>
   ): Promise<{ username: string }>;

   export async function verifyPasswordThrottled(
     account: BackOfficeAccount,
     password: string,
     options?: { clientInstanceId?: string }
   ): Promise<ThrottledVerification>;
   ```

   `ThrottledVerification` is imported as a type from `throttle.ts`, so a `VERIFIED` user is
   `{ id, role, credentialVersion }` and satisfies `session.ts`'s `VerifiedUser`. The two
   constants are not configurable by any environment variable, option or test hook.

5. **`createBackOfficeCredential`** normalises the username (refused if `null`), checks that the
   password is 8 to 128 characters counted as Unicode code points (`[...password].length`),
   refused otherwise, hashes it, and inserts one row. Every refusal is a thrown `Error` with a
   fixed message that contains neither value: a malformed username, a password of the wrong
   length, a username already taken (by anyone, active or not), a staff user who already has a
   credential, and an unknown staff user each have their own message. It does **not** check the
   user's role or activity (ADR-009 §1: that rule lives in verification), does **not** touch
   `staff_user`, and does not change `credential_version`. It is the creation path for the
   first-manager script and for tests; setting a password on an existing manager, with its
   version bump, is Phase 1's (*Out of scope*).

6. **One attempt is one transaction owned by `verifyPasswordThrottled`** (ADR-009 §4; ARCH-007
   questions 1 to 6, as built in `throttle.ts`):
   - Find and lock the account's credential row with `SELECT ... FOR UPDATE OF
     back_office_credential` joined to `staff_user`. The same statement reads `password_hash`,
     the user's `id`, `role`, `is_active` and `credential_version`, so `credentialVersion` comes
     from the statement that read the hash.
   - Then, in a **separate statement on the same client**, read the cooldown decision (blocked or
     not, and the seconds remaining) from `clock_timestamp()`, never `now()`.
   - If blocked: return `THROTTLED`, having verified nothing and written nothing; the cooldown is
     not extended.
   - Otherwise verify with Argon2id, write the outcome to that row, commit.
   - Every statement between the lock and the commit runs on the transaction's client; no pool
     call. The function takes no client and joins no caller's transaction. A thrown
     verification rolls back and propagates.

7. **Success** is a correct password for an **active** user whose role is **`MANAGER`**. A
   correct password for a deactivated user, or for a user whose role is `CASHIER`, is `FAILED` and
   is counted on the row (ADR-009 §1). On success: `consecutive_failures = 0, blocked_until =
   NULL` on that row only.

8. **On failure**, on that row: the new count is 1 if `blocked_until` was set (an ended
   cooldown), otherwise the old count plus 1; `blocked_until` becomes `clock_timestamp() +
   PASSWORD_COOLDOWN_MINUTES` when the new count reaches `PASSWORD_MAX_FAILURES`, otherwise
   `NULL`. One `UPDATE ... RETURNING`, all of its time from `clock_timestamp()`.
   `retryAfterSeconds` is a whole number from 1 to 300 when a cooldown started or refused, and
   `null` on a failure that started none, as in `throttle.ts`.

9. **No row for the account** (an unknown username, a username that `normaliseUsername` refuses,
   a `staffUserId` that is not a UUID, or a user with no credential) is `FAILED` with
   `retryAfterSeconds: null`, is never `THROTTLED`, and counts nowhere. A refused username or a
   non-UUID id is decided without a query. A password outside 8 to 128 code points can match no
   stored hash: for an existing row it is a counted failure, verified against nothing.

10. **Evidence, after the commit and only then** (ADR-009 §4; FR-A5b; B-13): one
    `writeSecurityEvent({ eventType: 'PASSWORD_FAILURE', throttleClass: 'BACK_OFFICE_LOGIN',
    clientInstanceId })` for every `FAILED`, including an account with no row; and one
    `COOLDOWN_STARTED` with class `BACK_OFFICE_LOGIN` when this failure started a cooldown. A
    `THROTTLED` or `VERIFIED` attempt writes no event. No audit entry is ever written. The event
    carries no username and no staff id, because a mistyped username is often a password typed
    into the wrong field.

11. **`audit.ts` changes only in its two type unions and the two arrays at `:32–33`**, which gain
    `'PASSWORD_FAILURE'` and `'BACK_OFFICE_LOGIN'`. Its writer does not otherwise change.

12. **No secret leaves the module** (B-11, B-12): the password and the hash go to Argon2id and to
    the one `INSERT`/`UPDATE` that stores the hash, and nowhere else: no log, no error message,
    no event, no `console`. A PostgreSQL error raised while reading or writing this table is
    replaced with a fixed message, never wrapped, because its detail can carry the hash or the
    username. No `Date` in the module: all time is PostgreSQL's.

13. **The script `apps/server/scripts/create-manager.ts`**, run as `npm run create-manager -w
    apps/server` (a new `package.json` script on the pattern of `provision`, reading
    `../../db/dev.env`):
    - It reads the name, the PIN, the username and the password **from the terminal only**, the
      two secrets not echoed and each asked twice; a mismatch aborts and writes nothing. Never
      from arguments or the environment (ADR-009 §7, B-12).
    - It refuses to run, writing nothing, when standard input is not a TTY, so a secret cannot
      be piped in from shell history.
    - It creates the `staff_user` row with role `MANAGER` and the credential row **in one
      transaction**, through `createStaffUser(…, client)` and `createBackOfficeCredential(…,
      client)`. Any refusal rolls both back and prints the refusal's fixed message.
    - It prints the new user's id and username and nothing secret. It writes no audit entry and
      no security event. It does not refuse when a manager already exists.
    - Keep the prompting separate from the work: export a function that takes the four answers
      and does the work in one `withTransaction`, so the test file can exercise it without a TTY.
      The entry point is the only code that touches `process.stdin` and closes the pool when it
      ends.
    - It is not seed data (B-24): it holds no name, PIN, username or password.

14. **Tests** reset with `resetDatabase()`, read `security_event` and the PIN buckets and change
    credential state only through `ownerQuery`/`ownerClient`, and use no `.concurrent`. Fixtures:
    managers and a cashier made with `createStaffUser`, credentials with
    `createBackOfficeCredential`; a wrong password is one nobody holds.

### Illustrative SQL

The rules bind; this shows they fit `pos_app`'s grants.

```sql
-- 1. find and lock (by username; by id, WHERE c.staff_user_id = $1)
SELECT c.staff_user_id, c.password_hash, u.role, u.is_active, u.credential_version
  FROM back_office_credential c
  JOIN staff_user u ON u.id = c.staff_user_id
 WHERE c.username = $1
   FOR UPDATE OF c;

-- 2. the decision, a statement of its own after the lock is held
SELECT blocked_until IS NOT NULL AND blocked_until > clock_timestamp() AS blocked,
       ceil(extract(epoch FROM blocked_until - clock_timestamp()))::int AS retry_after_seconds
  FROM back_office_credential
 WHERE staff_user_id = $1;

-- 3a. success
UPDATE back_office_credential
   SET consecutive_failures = 0, blocked_until = NULL
 WHERE staff_user_id = $1;

-- 3b. failure ($2 = PASSWORD_MAX_FAILURES, $3 = PASSWORD_COOLDOWN_MINUTES)
UPDATE back_office_credential
   SET consecutive_failures =
         CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END,
       blocked_until =
         CASE WHEN (CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END) >= $2::int
              THEN clock_timestamp() + make_interval(mins => $3::int) END
 WHERE staff_user_id = $1
RETURNING blocked_until IS NOT NULL AS cooldown_started,
          ceil(extract(epoch FROM blocked_until - clock_timestamp()))::int AS retry_after_seconds;
```

## Test cases for `apps/server/test/back-office-credential.test.ts`

Number them in the test names as here, so the Handoff can map them.

*Creation and the username*

1. `normaliseUsername('  Budi.S ')` is `'budi.s'`; it returns `null` for a two-character and a
   33-character name, for one with a space, a non-ASCII letter or `@` inside, and for one that
   starts with `.`, `_` or `-`.
2. With `budi` created, creating `Budi` for another manager is refused as taken; with that holder
   deactivated (through the owner), it is still refused.
3. A password of 7 code points and one of 129 are refused at creation; 8 and 128 are accepted; a
   password of eight emoji (8 code points, 16 UTF-16 units) is accepted.
4. A second credential for the same staff user, and one for an unknown staff user id, are each
   refused with their own message. No refusal message contains the username or password given.
5. The stored row holds the lower-cased username and a hash starting `$argon2id$`, and the
   password does not appear in the row.

*Counting* (one account unless stated)

6. Four wrong passwords return `FAILED` with `retryAfterSeconds: null`; the row reads 4 and
   `blocked_until` is null; the correct password then returns `VERIFIED` with that user's id,
   role and credential version, and the row reads 0 and null.
7. The fifth wrong password returns `FAILED` with `retryAfterSeconds` 300; the row reads 5 and
   `blocked_until - clock_timestamp()`, read through the owner, lies in `(295, 300]` seconds.
8. During the cooldown the **correct** password returns `THROTTLED` with `retryAfterSeconds` from
   1 to 300, and the row is unchanged afterwards.
9. With `blocked_until` set by the owner 30 seconds ahead, an attempt returns `THROTTLED` with
   `retryAfterSeconds` 30 (or 29).

*The reset when a cooldown ends*

10. With `blocked_until` one second in the past and the count 5, a wrong password returns
    `FAILED` with `null`, and the row reads 1 and null; four more are needed for the next
    cooldown.
11. With the same aged row, the correct password returns `VERIFIED` and the row reads 0 and null.

*Who may succeed*

12. A correct password for a deactivated manager is `FAILED` and counted; so is a correct
    password on a credential belonging to a `CASHIER`. After four earlier failures, either starts
    the cooldown.
13. Verifying by `{ staffUserId }` and by `{ username }` counts on the same row: three failures
    one way and two the other start the cooldown. `{ username: 'BUDI ' }` reaches `budi`'s row.

*No row*

14. An unknown username, a malformed one, a non-UUID `staffUserId`, and the id of a manager with
    no credential each return `FAILED` with `null`; twenty attempts at one unknown username never
    return `THROTTLED`; each attempt writes exactly one `PASSWORD_FAILURE` and no
    `COOLDOWN_STARTED`.

*Isolation from the PIN throttle* (FR-A5b, AC-35)

15. Five wrong passwords for one account leave another account verifying normally and leave both
    `pin_throttle_bucket` rows exactly as they were.
16. Five wrong PINs in `LOGIN` (through `verifyPinThrottled`) leave password verification
    unchanged, and a successful password leaves both PIN buckets unchanged.
17. Four wrong passwords, then a successful PIN login by the same manager, then one more wrong
    password: the account is now in a cooldown.

*Concurrency*

18. Twenty-five wrong passwords for one account sent at once (more than the pool's ten) all
    settle: exactly five `FAILED` and twenty `THROTTLED`; the row reads 5; `security_event` holds
    exactly five `PASSWORD_FAILURE` and one `COOLDOWN_STARTED`. Set an explicit test timeout; a
    hang is the failure this case exists for.
19. The lock is real. An owner connection opens a transaction and takes the account's row `FOR
    UPDATE`. Twelve wrong-password attempts start. A second owner connection polls
    `pg_stat_activity` until at least six `pos_app` backends have `wait_event_type = 'Lock'`, then
    the first commits. Result: exactly five `FAILED`, seven `THROTTLED`.
20. The decision is made from the row as read under the lock. With the owner holding the row as
    in case 19, one correct-password attempt starts; once it is waiting, the owner sets
    `blocked_until` five minutes ahead in that transaction and commits. The attempt returns
    `THROTTLED`, not `VERIFIED`.
21. The clock is read after the wait. The owner holds the row; one correct-password attempt
    starts; once it is waiting, the owner runs `SELECT pg_sleep(2)`, sets `blocked_until =
    clock_timestamp() + interval '5 minutes'` and commits. The attempt returns `THROTTLED` with
    `retryAfterSeconds` from 298 to 300, never above.
22. The owner sets the row to count 5 and `blocked_until = clock_timestamp() + interval '2
    seconds'` and commits, then takes the row `FOR UPDATE`; one correct-password attempt starts;
    once it is waiting, the owner runs `SELECT pg_sleep(3)` and commits. The attempt returns
    `VERIFIED` and the row reads 0 and null.

*Evidence*

23. A failure writes one `PASSWORD_FAILURE` with `throttle_class = 'BACK_OFFICE_LOGIN'` and the
    given `client_instance_id` (null when none is given); the fifth writes one
    `COOLDOWN_STARTED` in that class; a `THROTTLED` and a `VERIFIED` attempt write none. No
    attempt writes an `audit_entry`.
24. On a wrong password, a `clientInstanceId` that is a well-formed UUID naming no
    `client_instance` row makes `verifyPasswordThrottled` reject with the foreign-key error, **and
    the failure is still counted**: the row's count went up by one.
25. No `security_event` row and no error thrown by any case above contains the username typed,
    the password, or the stored hash.

*Durability, grants and shape*

26. After a cooldown starts, a fresh import of the module (`vi.resetModules()` and a dynamic
    import) still returns `THROTTLED`. `pg_class.relpersistence` for `back_office_credential` is
    `'p'`.
27. As `pos_app`: `DELETE FROM back_office_credential`, `UPDATE ... SET username = …` and `UPDATE
    ... SET staff_user_id = …` are each refused with insufficient privilege.
28. The module exports exactly the names in rule 4; `audit.ts` accepts the two new values and
    still refuses `LOGIN_OK` and `X`.

*The first-manager script* (through its exported function)

29. Given a name, PIN, username and password, it creates an active `MANAGER` with that PIN
    (`findUserByPin` finds them) and a credential with which `verifyPasswordThrottled` returns
    `VERIFIED` for that user; it writes no `audit_entry` and no `security_event`.
30. With a username already taken, or a PIN already held by an active user, it creates **neither**
    row (both tables unchanged) and reports the fixed refusal message, which contains no value
    typed.
31. Run a second time with new values while a manager exists, it creates a second manager.

## Red proofs

Each is a mutation the builder makes, runs, reads and reverts, reporting the failing output.

1. Remove `FOR UPDATE OF back_office_credential`: case 19 reports more than five `FAILED`.
2. Send the failure `UPDATE` through the pool instead of the transaction's client: the first
   counting case hangs to its timeout.
3. Write the events inside the transaction, on its client: case 24's count does not go up.
4. Drop the `ELSE 1` branch: case 10 reads 6 and starts a cooldown at once.
5. Drop the role rule (a cashier's credential verifies): case 12 returns `VERIFIED`.
6. Read the cooldown decision in a statement before the locking one: case 20 returns `VERIFIED`.
7. Put `now()` back in the decision statement: case 22 (and 21 if it fails too) fails.
8. Count a password failure in the `LOGIN` bucket as well: case 15 fails.
9. Remove the lower-casing from `normaliseUsername`: case 2 or 13 fails.
10. In the script's function, create the two rows outside one transaction: case 30 leaves a
    `staff_user` row behind.

## The Handoff must carry forward

- **For Task 8:** the request logger redacts a body's `password` field exactly as `pin`.
- **For Task 9:** the back-office login calls `verifyPasswordThrottled({ username }, …)`, never
  a PIN function, and the POS login and approval never call it. M-6 is: `resolveSession(token,
  'BACK_OFFICE', false)` returns `IDLE`; verify `{ staffUserId }` **from that session**, never a
  username from the request; then `reauthenticateSession`. Another manager at M-6 is an ordinary
  sign-in, after `releaseSession` on the idled session. The response must not tell an unknown
  username from a wrong password; `THROTTLED` does reveal that a username exists, which the owner
  accepted for the MVP (ADR-009, *Risks accepted*). The back-office guard requires role `MANAGER`
  on every request.
- **For Phase 1's users screen:** setting or resetting a password bumps `credential_version` in
  the same transaction and does **not** touch `consecutive_failures` or `blocked_until` (ADR-009
  §4, FR-A5b), which the column grant would permit, so it needs a test then; the own-password
  re-stamp of the acting session (ADR-009 §5) wants a short architect consult first.
- **AC-35** is proved here at the domain level only; it closes when Task 9 proves it through the
  routes and the client.
- How the owner runs the script, in one line, for the lead to put in the commands list.

## Tests expected to change

The lead grepped `apps/server/test/` for the table list, the grants and the two `security_event`
checks.

- **`harness-race.test.ts`**, `MIGRATED_TABLES` (`:6–14`): add `'back_office_credential'`. The
  list is exact by design, so a new table must be added.
- **`schema.test.ts`**, the `EXPECTED` privileges map (`:88–117`): add `back_office_credential:
  { table: ['INSERT', 'SELECT'], columns: { password_hash: ['UPDATE'], consecutive_failures:
  ['UPDATE'], blocked_until: ['UPDATE'] } }`. Nothing else in the file.
- None other. `audit.test.ts` refuses `LOGIN_OK` and `X`, which stay refused; `pin.test.ts` and
  `throttle.test.ts` keep every assertion (rules 2 and 3). If any other existing test needs a
  change, stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s 50 files and
   2876 tests (lead's verify, 2026-10-08, at `ed80773`), the client's tests unchanged.
2. `npx vitest run apps/server/test/back-office-credential.test.ts` alone is green three times in
   a row (cases 18 to 22 are concurrency cases), and so are `throttle.test.ts` and
   `session.test.ts` once each; the Handoff maps each case number to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. `grep -n "Date\|console\.\|now()" apps/server/src/domain/back-office-credential.ts` finds
   nothing, and the Handoff shows it.
5. `npm run db:migrate` applies `0007` to the dev database `pos`, and the Handoff shows it.
6. The script refuses without a TTY: the Handoff shows `echo | npm run create-manager -w
   apps/server` exiting non-zero and writing nothing. The interactive run needs a terminal the
   builder does not have; the lead runs it and the Handoff says it was not run.
7. The Handoff carries forward the items listed above.

## Out of scope

- Routes, cookies, CSRF, origin checks, the logger (Tasks 8 and 9); approval (Task 10).
- Setting or resetting a password or PIN on an existing user, the credential-version bump that
  goes with it, the own-password re-stamp, and whether a role change bumps the version (Phase 1;
  the last is an open owner question).
- Any change to `pin_throttle_bucket`, `verifyPinThrottled`, `session.ts`, or the PIN rules.
- The designer's documents (SCREEN-INVENTORY BO-01, SITEMAP `:248`) and any client code.
- `docs/` of any kind. A problem with the contract or the ADR is raised in the Handoff, not
  fixed.

## Lead verification (2026-10-08)

- `npm run verify` in this worktree at `550c6f3`: 51 files, 2907 tests, green. Changed paths are all
  within `owns:`; the only existing tests changed are the two listed.
- **Interactive run of the script**, in a real terminal (a Herdr pane) against `pos_test`, not the
  dev database: the two secrets are not echoed; a full run created an active `MANAGER` and a
  credential row (`leadcheck`, `$argon2id$` hash, count 0) and wrote no `security_event` and no
  `audit_entry`; a PIN typed differently the second time printed "The two PIN entries differ;
  nothing was written", exited 1, and wrote nothing.
- **Defect found (for the fix round):** the labels of the two visible prompts, `Name:` and
  `Username:`, never appear. `ask` writes the label to stdout and then calls `rl.question('')`,
  and readline in terminal mode redraws the line with the empty prompt, erasing the label. The
  operator sees a blank line and does not know what to type. The secret prompts keep their labels
  only because the redraw is muted. Fix: give a visible prompt its label through `rl.question`.

## Round 2 — the review's three findings (lead ruling, 2026-10-08)

The review is `.agent/reviews/PHASE0-007b-review.md` (Codex, at `f53fd86`). Read it in full. All
three findings are accepted. This is fix cycle 1 of 2.

1. **P1: readline history shows a hidden PIN at the username prompt** (B-12, ADR-009 §7, rule 13).
   Pressing Up at `Username:` recalls and prints the PIN. Fix: no secret may ever reach any input
   history. Create the interface with `historySize: 0`, or read each secret through an interface
   of its own that is closed before the next question; either way, pressing Up or Down at a
   visible question must print nothing that was typed at a secret one.
2. **P2: the visible labels `Name:` and `Username:` are erased** (the lead's finding above, and
   the review's). Give a visible question its label through `rl.question(label)`; keep the muted
   path for secrets with its label still shown.
3. **P2: an Argon2id exception is counted as a wrong password.** Rule 6 says a thrown
   verification rolls back and propagates; the Handoff's "unreachable" is wrong, because the
   `CHECK` tests only the `$argon2id$` prefix. Fix: let the verifier's exception leave the
   transaction callback so the transaction rolls back, and reject outward with the module's
   fixed, secret-free message (rule 12). No count is written and no event. A wrong password stays
   a counted failure.

**Tests** (add as cases 32 to 34; keep 1 to 31 green and unedited):

- **32 (prompts, findings 1 and 2):** make the prompting testable without a real terminal: the
  prompt function takes its input and output streams (the entry point passes `process.stdin` and
  `process.stdout`), and the test drives it with stream doubles marked as TTYs. Feed a name, a
  PIN twice, then the Up-arrow sequence `\x1b[A` and Down `\x1b[B` at the username question, then
  the rest. Assert that nothing written to the output, at any point, contains the PIN or the
  password typed; and that the output after each visible question was asked ends with that
  question's label (`Name: `, `Username: `) still on the line, that is, no line-clearing sequence
  follows the last time the label was written before the input.
- **33 (finding 3):** through the owner, set an account's `password_hash` to
  `'$argon2id$broken'`. `verifyPasswordThrottled` rejects with the fixed message (which contains
  neither the username, the password nor the hash); the row's `consecutive_failures` and
  `blocked_until` are unchanged; no `security_event` row was written.
- **34 (finding 3):** with the same broken hash on one account, a wrong password on another
  account is still `FAILED` and counted, so the change is narrow.

**Red proofs:** (a) remove `historySize: 0` (or the separate interface): case 32 finds the PIN in
the output; (b) put the label back on stdout with `rl.question('')`: case 32 fails on the label;
(c) restore the catch that turns a verifier exception into `matches = false`: case 33 fails.

**Then:** re-run `npm run verify` and the credential file three times, and add a **Round 2**
section to the Handoff with each change, each red proof's failing output, and the counts. Do not
rewrite round 1's sections except where the fix makes a statement in them untrue (the
"unreachable" claim and the untested prompting). The lead will repeat the terminal run.

## Lead verification, round 2 (2026-10-08)

- `npm run verify` at `60e6e49`: 51 files, 2910 tests, green. Round 2 changed only the script, the
  credential module, its test file and this file.
- **Terminal re-run** in a Herdr pane against `pos_test`: `Name:` and `Username:` now show their
  labels; Up twice and Down at `Username:`, and Up at each password prompt, recalled nothing; the
  pane never showed the PIN or the password. The created account verified (`VERIFIED`) with
  exactly the password typed, so no recalled text was added to it. A password typed differently
  the second time printed "The two Password entries differ; nothing was written" and left no row.
- The builder's change to case 32's label assertion (no line-clearing sequence after the label,
  rather than "ends with the label") is accepted: readline's cursor move after a correct label
  makes the original wording false for correct code.

## Round 3 — the re-review's one finding (lead ruling, 2026-10-08)

The re-review is `.agent/reviews/PHASE0-007b-review.md` (Codex, at `9335d57`; it replaces the
round-1 report, which stays in the branch history at `e11e208`). Read it in full. Its finding is
accepted. **This is fix cycle 2 of 2, the last**: anything a further review finds goes to the owner.

**P1: readline's kill ring carries a hidden PIN to the visible `Username:` prompt.** Ctrl+U at
`PIN:` deletes the text into the interface's kill ring; Ctrl+Y at `Username:` yanks it back and
prints it. `historySize: 0` covers only history. The lead checked that the kill ring is held on
each `Interface` instance (`Symbol(_killRing)`), so state does not cross interfaces.

1. **Fix: one fresh readline interface per question.** Each question, visible or secret, creates
   its own interface (with `historySize: 0`), asks once, and closes it before the next question
   is asked. No interface, buffer or line state is shared between two questions. Keep everything
   round 2 fixed: visible labels through `rl.question(label)`, the muted path for secrets, the
   ask-twice and mismatch behaviour, `prompt(input, output)` with the process streams as
   defaults. If closing an interface ends or pauses the input stream so that the next question
   cannot read, say so in the Handoff and show how it was handled; do not switch to a different
   mechanism without saying why.
2. **Test, case 35** (keep 1 to 34 green and unedited): with the stream doubles of case 32, type
   a name; at `PIN:` type the PIN, send Ctrl+U (`\x15`), type the PIN again, Enter; confirm it;
   at `Username:` send Ctrl+Y (`\x19`), then Ctrl+U to clear whatever is there, then type the
   username, Enter; at `Password:` type the password, Ctrl+U, type it again, Enter; confirm it
   the same way. Assert that nothing
   written to the output contains the PIN or the password, and that the returned answers are
   exactly the name, PIN, username and password intended.
3. **Red proof:** go back to one shared interface (round 2's shape, `historySize: 0` kept): case
   35 finds the PIN in the output. Show the failing output; revert.

**Then:** re-run `npm run verify` and the credential file three times, and add a **Round 3**
section to the Handoff with the change, the red proof and the counts. The lead repeats the
terminal run, including Ctrl+U then Ctrl+Y.

## Lead verification, round 3 (2026-10-08)

- `npm run verify` at `278af1c`: 51 files, 2911 tests, green. Round 3 changed only the script, the
  test file and this file.
- **Terminal re-run** in a Herdr pane against `pos_test`: at `PIN:` the PIN, Ctrl+U, the PIN again;
  at `Username:` Ctrl+Y, Up and Down printed nothing; at `Password:` the password, Ctrl+U, the
  password again. The pane never showed the PIN or the password; the account verified with exactly
  the intended password. (A first attempt sent the control keys with a key name Herdr does not
  support; the PIN entries then differed, the script refused and wrote nothing.)

## Handoff

**What I did.** Migration `db/migrations/0007_back_office_credential.sql` creates `back_office_credential` exactly as written in rule 1 (table, the unique index, grants) and widens `security_event_type_check` and `security_event_throttle_class_check` by drop and re-add under the same names. `apps/server/src/domain/argon2.ts` now holds the one exported `ARGON2` object; `pin.ts` imports it, and `createStaffUser` takes an optional second `client` parameter on the pattern of `findUserByPin`. Nothing else in `pin.ts` changed. `audit.ts` changed only in its two type unions and its two arrays. `apps/server/src/domain/back-office-credential.ts` exports exactly the five names in rule 4. `apps/server/scripts/create-manager.ts` exports `createManager(answers)` (one `withTransaction`, `createStaffUser(…, client)` then `createBackOfficeCredential(…, client)`); only the entry point, behind the same `invokedDirectly` guard as `provision.ts`, touches `process.stdin`, and it closes the pool. `apps/server/package.json` gained the `create-manager` script. Tests: new `apps/server/test/back-office-credential.test.ts`; the two expected edits in `harness-race.test.ts` (`MIGRATED_TABLES`) and `schema.test.ts` (`EXPECTED`). Commit hash is on the branch `agent/phase0-007b` (see `git log -1`).

**Decisions and evidence.**
- `normaliseUsername` lower-cases ASCII letters only (`/[A-Z]/g`), not `toLowerCase()`. `'K'` (Kelvin sign) lower-cases to ASCII `k` under `toLowerCase()` and would have been accepted as a username, which the owner's alphabet forbids. Case 1 asserts it is refused.
- The verification wraps only the `withTransaction` call in a catch that throws the fixed message "The back-office credential store failed" (rule 12). The two `writeSecurityEvent` calls sit outside that catch, so case 24 still sees the raw foreign-key error (`code` 23503), as `verifyPinThrottled` does.
- ~~A thrown Argon2 `verify` is treated as a non-match and counted.~~ **Wrong; corrected in Round 2.** The `CHECK` tests only the `$argon2id$` prefix, so a stored `$argon2id$broken` is reachable. A thrown verification now rolls back and rejects with the fixed message.
- Creation refusals map on the PostgreSQL error's `code` and `constraint` name: `back_office_credential_username_key` is "taken", `back_office_credential_pkey` is "already has a credential", `23503` is "does not exist", anything else is the fixed store-failure message. When `createBackOfficeCredential` runs on a caller's client, a refusal aborts that transaction; the script rolls back, which is the intent.
- A password outside 8 to 128 code points skips Argon2 and is a counted failure for an existing row (rule 9).

**Existing tests changed.** Only the two the task lists: `harness-race.test.ts` (added `'back_office_credential'` to `MIGRATED_TABLES`, sorted between `audit_entry` and `client_instance`) and `schema.test.ts` (added the `back_office_credential` entry to `EXPECTED`). No assertion in `pin.test.ts`, `throttle.test.ts`, `audit.test.ts` or `session.test.ts` was touched.

**Case map** (test names in `back-office-credential.test.ts` begin with the number): 1 `normaliseUsername`; 2 username taken; 3 password length; 4 second credential and unknown user; 5 stored row; 6 four wrong then correct; 7 fifth wrong; 8 correct during cooldown; 9 owner-set 30 s; 10 and 11 ended cooldown; 12 deactivated and cashier; 13 id and username share a row; 14 no row (24 events: 4 shapes plus 20 repeats); 15, 16, 17 isolation from the PIN throttle; 18 to 22 concurrency; 23 evidence and no audit entry; 24 unknown client instance; 25 no secret in errors or events; 26 durability; 27 grants; 28 exports and audit values; 29, 30, 31 the script's function.

**Red proofs** (each mutation made, run, read, reverted; the file is green again after each revert):
1. Removed `FOR UPDATE OF c`: cases 18, 19 and 20 failed. Case 19: "expected … to have a length of 5 but got 12"; case 18: got 23; case 20: "expected 'VERIFIED' to be 'THROTTLED'".
2. Sent the failure `UPDATE` through `getPool()`: cases 6, 16 and 26 ran to their timeouts ("Test timed out in 15000ms", "Hook timed out in 10000ms"); the leaked row lock hung the following `beforeEach` hooks. This run took 45 s.
3. Wrote a `PASSWORD_FAILURE` row inside the transaction on its client: case 24 failed ("expected Error: The back-office credential store f… to match object { code: '23503' }"). The assertion that fails first is the error `code`, because the module masks the database error; the transaction had rolled back, so the count assertion after it would also have failed. I did not make that second assertion run first.
4. Replaced `ELSE 1` with `ELSE consecutive_failures + 1`: case 10 failed (`retryAfterSeconds` 300 where `null` expected: a cooldown started at once).
5. Dropped `&& row.role === 'MANAGER'`: case 12 failed (the cashier's credential returned `VERIFIED`).
6. Added the decision query before the locking statement and used its result: case 20 returned `VERIFIED` instead of `THROTTLED`; cases 21 and 22 failed too.
7. `now()` in the decision statement: case 21 failed ("expected 303 to be less than or equal to 300") and case 22 failed (`THROTTLED` instead of `VERIFIED`); case 20 passed, as expected.
8. Added an `UPDATE pin_throttle_bucket … 'LOGIN'` on each password failure: case 15 failed (LOGIN `consecutive_failures` 5 where 0 expected).
9. Removed the ASCII lower-casing from `normaliseUsername`: cases 1, 2, 5, 13 and 31 failed. Case 2 fails because `'Budi'` is then refused as malformed rather than reported as taken, so it fails on the wrong message; case 13 fails with 5th attempt `null` instead of 300.
10. In `createManager`, called `createStaffUser` without the client: case 30 failed (`staff_user` count 3, expected 2), the orphan manager left behind.

**`npm run verify`** (after the final revert): typecheck clean; 51 test files, 2907 tests passed. `development` was 50 files and 2876 tests; the difference is one new file and 31 tests (the 31 cases). The client's tests are unchanged. `back-office-credential.test.ts` alone passed three times in a row (31/31 each time); `throttle.test.ts` and `session.test.ts` together passed once (55 tests).

**Acceptance 4.** `grep -n "Date\|console\.\|now()" apps/server/src/domain/back-office-credential.ts` printed nothing.

**Acceptance 5.** `npm run db:migrate` printed `applied: 0007_back_office_credential.sql` against the dev database.

**Acceptance 6.** I could not run the literal `echo | npm run create-manager -w apps/server` because my shell allows no pipes. `npm run create-manager -w apps/server < /dev/null` is the same condition (standard input is not a TTY): it printed "create-manager needs a terminal; refusing to read from a pipe", exited 1 before any database connection, and so wrote nothing. **The interactive run was not made**: I have no terminal. The lead should run it once, with hidden input and the two mismatch cases, before the owner trusts it. The script's prompting code was therefore untested in round 1; from Round 2 case 32 drives it with stream doubles marked as TTYs.

**Found and not fixed.**
- `docs/BOUNDARIES.md` B-24 and the task say the script holds no PIN; true. But the muted-output technique writes the prompt label directly to `process.stdout` and then mutes `readline`'s echo; on a terminal that does not honour that, a secret could echo. Needs the lead's interactive check.
- A password longer than 128 code points at verification is a counted failure that skips hashing, so it is faster than a normal failure. This is a timing difference only for lengths no account can hold; I judged it harmless, and the contract asks for it.
- No Prettier was run.

**Carry forward.**
- *Task 8:* the request logger redacts a body's `password` field exactly as `pin`.
- *Task 9:* the back-office login calls `verifyPasswordThrottled({ username }, …)`, never a PIN function, and the POS login and approval never call it. M-6: `resolveSession(token, 'BACK_OFFICE', false)` returns `IDLE`; verify `{ staffUserId }` from that session, never a username from the request; then `reauthenticateSession`. Another manager at M-6 is an ordinary sign-in after `releaseSession` on the idled session. The response must not tell an unknown username from a wrong password; `THROTTLED` does reveal that a username exists, accepted by the owner for the MVP (ADR-009, *Risks accepted*). The back-office guard requires role `MANAGER` on every request.
- *Phase 1 users screen:* setting or resetting a password bumps `credential_version` in the same transaction and must not touch `consecutive_failures` or `blocked_until`, which the column grant permits, so it needs its own test then. The own-password re-stamp of the acting session (ADR-009 §5) wants an architect consult first.
- *AC-35* is proved at the domain level only (cases 15 to 17); it closes when Task 9 proves it through the routes and the client.
- *Command for the lead's commands list:* `npm run create-manager -w apps/server` (run at the host's terminal; it asks for name, PIN, username and password, the secrets twice and hidden).

**What the next agent lacks.** An interactive terminal run of the script (above). Nothing else.

### Round 2 (fix cycle 1 of 2)

**Changes.**
1. *P1, history shows a hidden PIN.* `apps/server/scripts/create-manager.ts`: the `readline` interface is created with `historySize: 0`, so no line typed at any question is kept and Up at `Username:` has nothing to recall.
2. *P2, erased labels.* A visible question now passes its label to `rl.question('Name: ')`, so readline's own redraw keeps it. The secret path is unchanged: the label is written once to the output, the output is muted, then `rl.question('')`. The prompting is now an exported `prompt(input, output)` whose defaults are `process.stdin` and `process.stdout`; the entry point calls it with the defaults. Nothing else touches the process streams.
3. *P2, verifier exception counted.* `apps/server/src/domain/back-office-credential.ts`: the inner `try/catch` around `verify` is removed. A thrown verification leaves the transaction callback, the transaction rolls back (no count, no event), and the existing outer catch rejects with the fixed message "The back-office credential store failed". A wrong password is still a counted failure.

**New tests** (cases 1 to 31 are unedited and green). 32: drives `prompt` with a `PassThrough` input and a collecting `Writable` output, both marked as TTYs; it types a name, the PIN twice, `\x1b[A\x1b[A\x1b[B` at the username question, the username, then the password twice. It asserts that after `Name: ` and `Username: ` nothing that follows the label's last write clears the line, that the returned answers are exactly those typed, and that the whole output contains neither the PIN nor the password. One deviation from the ruling's wording: readline writes a cursor-move (`\x1b[7G`) after a visible label even in the correct build, so "the output ends with the label" is false for correct code. The test therefore forbids a line-clearing sequence (`\x1b[J`, `\x1b[0J`, `\x1b[0-2K`) after the label instead of requiring the label to be the last bytes. 33: with `$argon2id$broken` set on an account through the owner, `verifyPasswordThrottled` rejects with exactly the fixed message, containing neither username, password nor hash; the row's count and `blocked_until` are unchanged; `security_event` is empty. 34: with that hash on one account, a wrong password on another is `FAILED` with `null` and counted (1), with one `PASSWORD_FAILURE`.

**Red proofs** (made, run, read, reverted):
- (a) Removed `historySize: 0`: case 32 failed with the PIN recalled into the username buffer: expected `username: "dewi.owner"`, received `"654321dewi.owner"`.
- (b) Wrote the label to the output and called `rl.question('')` for visible questions: case 32 failed at the first label check (`expected false to be true`, the `Name: ` screen contained `\x1b[0J` after the label).
- (c) Restored the catch turning an exception into `matches = false`: case 33 failed (`expected '' to be 'The back-office credential store failed'`, i.e. the call resolved); case 34 still passed, as it should.

**Counts.** `npm run verify`: typecheck clean; 51 files, 2910 tests passed (round 1: 2907, plus the three new cases). `back-office-credential.test.ts` alone: 34/34 on three consecutive runs. `throttle.test.ts` and `session.test.ts` were not re-run alone; the full run covers them.

**Not done.** I cannot make a real-terminal run; the lead repeats it. Case 32 proves the readline sequence with doubles, not a particular terminal emulator. No Prettier run. The `grep` for `Date|console.|now()` on the credential module still finds nothing (the edit removed code only).

### Round 3 (fix cycle 2 of 2)

**Change.** `apps/server/scripts/create-manager.ts`: `ask` now creates its own readline interface (`historySize: 0`, same muted output) for every question, visible or secret, asks once, and closes it in a `finally` before the next question. The shared interface and its `try/finally` around the four questions are gone, so no line, history or kill-ring state is shared between two questions. Everything round 2 fixed is kept: visible labels through `rl.question(label)`, the muted path with its label written once for secrets, ask-twice with the mismatch error, and `prompt(input, output)` with the process streams as defaults.

**Closing an interface and the input stream.** `rl.close()` pauses the input stream, and creating the next interface resumes it. I saw no lost keystrokes: cases 32 and 35 both type a whole session across five interfaces with the doubles, and both pass with no workaround. I added none. A real terminal sends keys only after each prompt appears, so nothing is typed into the gap. Type-ahead across the gap on a real terminal stays buffered in the stream while it is paused; I could not test that without a terminal.

**Test.** Case 35 (cases 1 to 34 unedited and green), using the stream doubles of case 32: name; at `PIN:` the PIN, Ctrl+U, the PIN again, Enter; the PIN again to confirm; at `Username:` Ctrl+Y, Ctrl+U, then the username, Enter; at `Password:` the password, Ctrl+U, the password again, Enter; the password again to confirm. It asserts the returned answers are exactly the name, PIN, username and password intended, and that the output contains neither the PIN nor the password. The harness removes each label from the captured text as it is reached so that the label's own bytes cannot hide a leak; the labels contain neither secret.

**Red proof.** Back to one shared interface (`historySize: 0` kept, closed only at the end): case 35 failed with `expected '\u001b[1G\u001b[0J\u001b[7GDewi\r\n\n…' not to contain '654321'`. The received output showed `[1G[0J[11G654321[1G[0JUsername: [11Gdewi.owner`: the Ctrl+Y at `Username:` printed the PIN killed at `PIN:`. Reverted; case 35 passes again.

**Counts.** `npm run verify`: typecheck clean; 51 files, 2911 tests passed (round 2: 2910, plus case 35). `back-office-credential.test.ts` alone: 35/35 on three consecutive runs.

**Not done.** The real-terminal run, including Ctrl+U then Ctrl+Y, is the lead's. No Prettier run. Only `create-manager.ts`, the test file and this Handoff changed.

DONE
