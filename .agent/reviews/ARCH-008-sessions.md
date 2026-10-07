# ARCH-008 — Sessions (plan Task 7), and the back-office credential

Author: `architect8`, 2026-10-07. Read-only consult for PHASE0-007 (not yet written) and for the
task that will carry the back-office username and password. Nothing was edited except this
report, and nothing was committed.

## Summary

**Plan Task 7 cannot be dispatched as written.** Its code targets a table and a column that do
not exist (`app_session`, `last_activity_at`), sends the row's primary key as the cookie value,
invalidates by a sweep that the architecture replaced with a version comparison, and makes
"this request is interactive" the default. Its absolute-lifetime test violates a constraint that
migration `0003` already enforces. The module is small, so the right course is to supersede the
plan's code and test whole, as PHASE0-006 did.

What PHASE0-007 must say, in order of weight:

1. **A session is valid only while the credential version it recorded equals the user's.** The
   comparison is in the resolving statement. There is no sweep and no
   `invalidateSessionsForUser` (question 1).
2. **The cookie carries a random 256-bit token; the row stores its SHA-256.** The token leaves
   `session.ts` exactly once, as the return value of the call that minted it. Everything else
   refers to the session by its `id` (question 1).
3. **`interactive` is a required argument, never a default.** A route that forgets it must fail
   to compile, not silently keep a session alive. This binds the POS as much as the back
   office: the two-second catalog poll would otherwise make a POS session immortal (AC-28).
4. **Resolution is one statement that checks and touches together, and reads the clock with
   `clock_timestamp()`.** That statement can wait on a row lock, and `now()` would then decide
   with a stale clock in the unsafe direction (question 4).
5. **An expired session is refused, never marked.** An idle back-office session must stay
   renewable by M-6, so idle expiry cannot be written as a release (question 3).
6. **M-6 renews the same session row for the same manager and rotates its token.** The eight
   hours keep running from the original sign-in (question 5).

For the back-office credential:

7. **It is a table of its own, `back_office_credential`, with a per-account throttle on the same
   row.** Not a third installation-wide class and not the `LOGIN` bucket. AC-19 is untouched
   (question 5).
8. **It needs a new ADR and a contract change.** No accepted ADR covers authentication, and
   ARCHITECTURE section 7 describes PINs only. Exact PRD and BOUNDARIES wording is in *For the
   owner*. Nothing may be built for the credential until the owner has ruled.
9. **PHASE0-007 does not wait for any of that.** Sessions are indifferent to which credential
   was verified. The credential is its own task, after PHASE0-007 and before the routes
   (question 6).

No boundary is strained. Six points go to the owner; none blocks PHASE0-007.

## What I verified, and what I could not

Read: the task file; plan Task 7 whole, Task 8 whole and Task 9 whole
(`:1722-2726`); ARCHITECTURE.md whole; PRD whole; BOUNDARIES whole; `.agent/DECISIONS.md` whole;
ARCH-006 sections 4 to 8; ARCH-007 whole; migrations `0001` to `0005`; `pin.ts`, `throttle.ts`,
`audit.ts`, `config.ts`, `db/pool.ts`, `test/support/database.ts`; the session, password and
cookie mentions in the seven ADRs (only ADR-001 and ADR-002 mention sessions, one line each, and
no ADR mentions a credential); DESIGN-011's Q3, Q4 and M-6 rows; SCREEN-INVENTORY's BO-01 and
M-6; the one `now()` line in `.agent/LESSONS.md` that the task cites.

**The lead's account under *What exists* holds, with two additions.**

- `actor_session` carries `CHECK (absolute_expires_at IS NULL OR absolute_expires_at >
  issued_at)`. The plan's absolute-lifetime test sets only `absolute_expires_at` into the past
  and would be refused by that constraint. A test must age `issued_at` with it.
- `throttle.ts` as built reads the clock with `clock_timestamp()` after the lock is held, not
  with `now()` as ARCH-007's sample had it. I follow the built code and the lesson, not the
  sample.

Migration `0006` is not on this branch (PHASE0-006b is building it). Where a migration number
appears below it assumes `0006` lands first.

**One library fact, from the librarian** (PostgreSQL 16 documentation, "Read Committed", and
the executor README on EvalPlanQual). When an `UPDATE` waits on a row lock and the holder
commits a change to that row, PostgreSQL re-evaluates the `WHERE` clause against the new row
version and recomputes the `SET` expressions. `now()`, `transaction_timestamp()` and
`statement_timestamp()` keep the value they had before the wait; `clock_timestamp()` is called
again and returns the time after it. For a joined table that is not the update's target, the
re-check reuses the row originally joined. Question 4 rests on all three.

**Not read:** `.agent/STATE.md`, `QUEUE.md` and the journal (a worker does not); plan Task 10
beyond a search for callers of the session functions, which found none by name; the PHASE0-006b
task file. I ran no SQL and no tests: this is a design consult, and every statement below is
illustrative until the builder's tests prove it.

---

## 1. Plan Task 7 against the schema, section 7 and ARCH-006

**Authority:** ARCHITECTURE 5.1 (ActorSession), 7.2, 14.2, 14.4; FR-A2, FR-A2b, FR-A2c, FR-B3;
AC-27, AC-28, AC-32; ARCH-006 section 4; migration `0003`.

### Invalidation is a comparison

Section 7.2: deactivation or a PIN reset "increments a credential version and causes that
user's sessions to fail on their next authenticated request". FR-B3 says the same from the
product side. The mechanism is therefore a predicate in the statement that resolves a session:

    u.is_active AND u.credential_version = s.credential_version

Both halves are needed and each is tested alone. `is_active` refuses a deactivated user even if
the writer forgot the bump; the version refuses a reset user who is still active.

Two rules follow from ARCH-006 section 4, and both are for PHASE0-007:

- **`createSession` is given the version that was verified.** `verifyPinThrottled` returns
  `user.credentialVersion` from the same row and the same `SELECT` as the hash it checked.
  `createSession` stores that number and never re-reads the user's current one. A reset that
  lands between the verification and the insert then produces a session that is invalid from
  birth, which is correct. Re-reading would mint a valid session from the old PIN.
- **`invalidateSessionsForUser` is deleted, not fixed.** A sweep misses a session inserted
  beside it. It is also a second mechanism with the same purpose, and an exported function that
  releases sessions by user id is one more thing a later route can call wrongly.

A consequence worth stating: because nothing sweeps, **no writer ever holds a lock on a session
row on behalf of a user-management command.** The only writers of `actor_session` are the four
functions in question 3.

### The token

`0003` already decides the storage: `token_hash bytea`, exactly 32 bytes, unique. The task must
decide the rest.

- **Generation.** `crypto.randomBytes(32)`. Nothing else: no UUID, no timestamp, no user id
  mixed in.
- **What the cookie carries.** Those 32 bytes as base64url, 43 characters, no padding.
- **What is stored.** SHA-256 of the 32 raw bytes. A plain digest is right because the token
  is high-entropy; Argon2id is for secrets a person chooses.
- **What is returned, and when.** `createSession` and `reauthenticateSession` return
  `{ token, sessionId }`. That is the only time the token exists outside the cookie. It is not
  kept in a variable longer than the response needs, and it is never logged, never put in an
  error and never returned by a read.
- **What everything else uses.** `sessionId`, the row's `uuid`. It is safe to log, to put in
  an audit subject and to record on a CheckoutLease (section 6.3), because it is not a
  credential.
- **A malformed token** (not a string, or not 43 base64url characters) resolves to `NONE`
  without a query. It never reaches SQL or an error message.

Resolution finds the row by equality on the digest through the unique index. There is no
comparison in JavaScript and so nothing to make constant-time.

*The alternative*, the primary key as the cookie value, is what the plan has. ARCH-006 argued
it and the schema was built the other way; it is closed.

### Database time, and which function

Section 14.4 requires PostgreSQL time for session persistence. ARCH-006's rule stands: no
JavaScript `Date` is ever a parameter for a stored time, and every expiry comparison is made in
SQL. `session.ts` returns no timestamp at all, so no caller can compare one with the Node clock.

Which SQL function matters here, for the reason PHASE0-006 found:

- **The insert uses `now()`** for `issued_at`, `last_interactive_at` and
  `absolute_expires_at`. One statement, one instant, so the absolute expiry is exactly the
  policy's seconds after `issued_at`. An insert of a new row does not wait on another session's
  lock.
- **Every other statement uses `clock_timestamp()`**, for the comparison and for the value
  written. Those statements update or re-read an existing row and can wait behind another
  writer of it. See question 4 for the direction of the error `now()` would make.

`session.ts` functions take no client and join no caller's transaction. Each is a statement of
its own on the pool. That is not only tidiness: inside a caller's transaction, `now()` in the
insert would be the transaction's start, and a session resolved at the top of a long command
would be touched and judged at whatever time the command happened to reach it.

### `last_interactive_at`

FR-A2b: "Background polling does not count as user activity." AC-28: "Background polling does
not extend either", where "either" is the POS context and the back-office session. Section 7.2
adds health checks and background refresh.

- The column moves only when a request the route declares interactive resolves successfully.
- **`interactive` is a required positional argument of `resolveSession`.** The plan's
  `opts.touch` defaults to true, which fails in the wrong direction: a polling route written
  without the option extends the session forever. Required, the omission is a compile error.
- The plan marks only the back-office `/me` as non-interactive. The POS polls the catalog
  revision every two seconds (section 4.3) and both clients poll print incidents (section 12).
  Under the plan a POS left on any screen that polls would never reach 90 seconds. Which routes
  are interactive is Task 9's and each later route's to declare; PHASE0-007's Handoff must carry
  the rule forward.
- A non-interactive resolution writes nothing. It is a `SELECT`.
- The column never moves backwards (question 4).

### `absolute_expires_at`

Set once, at insert, to `now()` plus the audience's absolute seconds; `NULL` for the POS. It is
never updated afterwards: not by a touch, and not by M-6's renewal. The eight hours run from the
sign-in. The owner's ruling of 2026-10-06 ("after eight hours an idled back-office session
returns to Login") depends on that.

### Release

FR-A2 ("explicit release") and FR-A2b ("explicit logout"). `releaseSession` takes the token and
the audience, sets `released_at` where it is still null, and is idempotent. It does **not**
require the session to be live: logging out of a session that has just gone idle must still end
it, or the row stays renewable by M-6 after the manager believed they had left. The plan
releases by id through `requireSession`, which refuses an idle session and so cannot release
one.

---

## 2. Policy

**Authority:** FR-A2, FR-A2b, AC-28; ARCHITECTURE 7.2; B-24; ARCH-006 section 4; ARCH-007
question 7.

| Audience | Idle | Absolute |
|---|---|---|
| `POS` | 90 seconds | none |
| `BACK_OFFICE` | 30 minutes | eight hours from sign-in |

**Confirmed, all four.** FR-A2 gives the POS "90 seconds of inactivity or ... explicit release"
and no document gives it an absolute limit. The CheckoutLease's 15-minute authentication hard
stop (FR-G14) is a property of the lease, measured from the session's `issued_at`; it is not a
session lifetime and PHASE0-007 does not implement it.

**Where the numbers live.** One constant in `session.ts`, passed to SQL as parameters, and
nowhere else. B-24 covers "what a restaurant changes routinely"; the PRD fixes these four
numbers, so they are policy in code, as ARCH-006 ruled for these and ARCH-007 for the throttle's
two. No environment variable, settings row, optional argument or test hook changes them. A knob
added for tests is a knob in production.

One test pins the literal values against the PRD (90, 1800, 28800, and null), as the plan's
first test does. Every other test imports the constant. I depart slightly from ARCH-007 here,
which had tests never restate a number: without one pinned assertion, changing the constant
changes every test with it and nothing goes red.

**The comparison is strict and has one direction:** a session is live while
`last_interactive_at > clock_timestamp() - idle`, and while `absolute_expires_at >
clock_timestamp()`. At exactly 90 seconds it is expired.

---

## 3. The interface

### Exports

```ts
export type Audience = 'POS' | 'BACK_OFFICE';

export const SESSION_POLICY: Readonly<
  Record<Audience, { idleSeconds: number; absoluteSeconds: number | null }>
>;

/** What a verification returned. verifyPinThrottled's `user` satisfies it as it is. */
export interface VerifiedUser {
  id: string;
  credentialVersion: number;
}

export interface IssuedSession {
  /** The cookie value. Returned here and nowhere else. */
  token: string;
  sessionId: string;
}

export type SessionResolution =
  | { status: 'ACTIVE'; sessionId: string; staffUserId: string; role: StaffRole }
  // Valid in every respect except idle time. Grants nothing.
  | { status: 'IDLE'; sessionId: string; staffUserId: string }
  | { status: 'NONE' };

export function createSession(input: {
  audience: Audience;
  user: VerifiedUser;
  clientInstanceId?: string;
}): Promise<IssuedSession>;

export function resolveSession(
  token: string,
  audience: Audience,
  interactive: boolean
): Promise<SessionResolution>;

export function reauthenticateSession(
  token: string,
  audience: 'BACK_OFFICE',
  user: VerifiedUser
): Promise<IssuedSession | null>;

export function releaseSession(token: string, audience: Audience): Promise<void>;
```

That is the whole module. **Not exported, deliberately:** `invalidateSessionsForUser`, any
function that takes a `sessionId` and returns or changes a session, any reader of a timestamp,
and `COOKIE_NAME`.

### How resolution checks

One predicate, written once and used by every statement that judges a session:

| Check | Clause | Authority |
|---|---|---|
| The token | `s.token_hash = $1` | section 7.2 |
| Audience | `s.audience = $2` | FR-A2c; AC-27 |
| Not released | `s.released_at IS NULL` | FR-A2, FR-A2b |
| The user is active | `u.is_active` | section 7.2; AC-32 |
| The credential is current | `u.credential_version = s.credential_version` | section 7.2; FR-B3 |
| Not past the absolute limit | `s.absolute_expires_at IS NULL OR s.absolute_expires_at > clock_timestamp()` | FR-A2b |
| Not idle | `s.last_interactive_at > clock_timestamp() - make_interval(secs => $3)` | FR-A2, FR-A2b |

`u` is `staff_user` joined on `s.staff_user_id`, **in the same statement**. Yes to the lead's
question: a second query for the user would open a gap between the two reads, and the version
comparison is only an invalidation mechanism if it is made where the session is judged.

The audience is in the predicate, so a POS token presented as a back-office session finds no
row whoever holds it. The idle seconds are the policy's for the audience the route asked for,
which is the row's audience by the same clause.

**The role is returned, not judged.** Section 7.2: "Audience determines route context and
timeout policy, not business permission." `resolveSession` returns the user's *current* role
from the joined row; it does not refuse a cashier on a back-office session. That refusal is the
route guard's (Task 9), on every back-office route, on every request. It matters because
nothing in the schema bumps the credential version when a role changes: a manager demoted while
signed in to the back office keeps a session that resolves, with role `CASHIER`.

**`client_instance_id` is never compared.** FR-A7: it is continuity and telemetry, never
authorization. A session presented from a different browser profile resolves the same.

### The three statements of `resolveSession`

- `interactive = true`: an `UPDATE ... FROM staff_user ... RETURNING` with the whole predicate,
  setting `last_interactive_at`. A row returned is `ACTIVE`.
- `interactive = false`: a `SELECT` with the whole predicate. A row returned is `ACTIVE`.
- When either returns no row: a `SELECT` with the predicate **minus the idle clause**. A row
  returned is `IDLE`; none is `NONE`.

`IDLE` exists for one caller: the back office must tell "this manager idled, show M-6" from
"there is no session, show Login" (the inventory routes them to different places, and the owner
ruled on 2026-10-06 that the absolute limit goes to Login). It is a classification, not a
grant. The POS routes treat `IDLE` exactly as `NONE`. Nothing that reads `IDLE` may treat the
`staffUserId` in it as an authenticated actor.

### An expired session is refused, not marked

Nothing writes `released_at` when a session expires. Three reasons:

- **Idle expiry must be reversible for the back office.** M-6 renews an idle session. A session
  marked released at 30 minutes could not be renewed, and "unsaved form state is preserved
  behind re-authentication" (FR-A2b) would need a second session and a way to tie the draft to
  it.
- Expiry is a function of the row and the clock, as the throttle's lazy reset is (ARCH-007
  question 3). No scheduler exists in Phase 0 and none should be added for this.
- `released_at` then means one thing: a person released it.

Expired rows accumulate, because `pos_app` has no `DELETE`. That is acceptable for the MVP and
is the owner role's housekeeping if it ever matters.

### Why this shape

- **Token in, id out.** Every function that authenticates takes the token; every function
  returns the id. A function that took a `sessionId` and acted on the session would turn every
  logged id back into a credential.
- **A union, not `null`.** The plan returns `null` for six different refusals. The back office
  needs two of them told apart, and ARCH-007 made the same choice for the same reason: a result
  the compiler forces the caller to exhaust.
- **`COOKIE_NAME` is not the domain's.** A cookie name is an HTTP fact and belongs with the
  cookie's other attributes in Task 9. `session.ts` should not know it is carried in a cookie.

*The alternative I considered longest* is one statement for both resolutions, an `UPDATE` whose
`SET` is conditional on `interactive`. It keeps a single statement to test. It loses because
every two-second poll would then write the row and take its lock, which is the wait question 4
wants to avoid, in order to change nothing.

---

## 4. Concurrency

**Authority:** ARCHITECTURE 8 (`READ COMMITTED` with explicit row locks and preconditions);
14.2 ("audience-scoped sessions, credential invalidation"); FR-B3; the librarian's three facts.

### What must hold

1. **After a release commits, no resolution of that token succeeds.**
2. **A request that begins after a deactivation or a credential bump has committed is not
   resolved.** FR-B3's words are "on its next authenticated request"; a request already
   resolved when the bump commits may finish.
3. **A session is never judged live against a clock older than the moment of judging.**
4. **A touch never moves `last_interactive_at` backwards and never revives an expired or
   released row.**
5. **A session minted from a credential that changed before the insert is never valid.**

### What gives it

**The single-statement shape gives 1, 4 and most of 3 with no explicit lock.** The interactive
resolution is one `UPDATE` whose `WHERE` is the predicate. If it meets a row that another
transaction has locked, it waits; when the holder commits, PostgreSQL re-evaluates the `WHERE`
against the new row version.

- *Touch against release.* If the release commits first, the touch re-checks, finds
  `released_at` set, updates nothing and returns no row. If the touch commits first, the
  release then sets `released_at` on the touched row. Either order ends released.
- *Touch against renewal.* The renewal rotates `token_hash`; a touch that waited behind it
  re-checks against the new hash and finds no row.
- *Touch against touch.* Both succeed. The `SET` is
  `GREATEST(s.last_interactive_at, clock_timestamp())`, so whichever lands second cannot move
  the column back.
- *Touch against expiry.* Expiry is not an event; it is the predicate turning false. There is
  nothing to race except the clock, which is point 3.

**`clock_timestamp()` gives the rest of 3.** This is the PHASE0-006 lesson applied before the
build instead of after it. With `now()`, a resolution that waits behind another writer of the
row re-checks with the time at which its statement *started*. The error is in the unsafe
direction: an older clock makes a session look less idle and less expired than it is. The wait
is short when the holder is one of this module's single statements, but the rule should not
depend on who else might one day hold that row, and `clock_timestamp()` in the `WHERE` and the
`SET` is re-read on the re-check at no cost. It is a volatile function, which would matter if
it prevented an index scan; the row is found by `token_hash`, and the time clauses are filters
on that one row.

**Statement snapshots give 2.** Under `READ COMMITTED` each statement sees everything committed
before it began. A resolution that starts after the bump commits joins the new `staff_user` row
and fails the version clause. No lock on `staff_user` is needed, and none should be taken:
locking the user row on every request would queue every request of that user behind any command
that touches it.

The one subtlety is the librarian's third fact. If a resolution has already joined the old
`staff_user` row and then waits on the *session* row, its re-check reuses that old user row, so
it can succeed although the bump committed during the wait. That is the same case as "already
resolved when the bump commits": the request began first. It satisfies point 2 as worded, and
FR-B3 asks no more.

**The insert rule gives 5** (question 1): the version stored is the version verified.

### What I do not ask for

No `SELECT ... FOR UPDATE`, no advisory lock, no transaction spanning statements in
`session.ts`. The `IDLE` classification after a failed resolution is a second statement and can
disagree with the first if the row changed in between; it grants nothing, so the disagreement
costs at most the wrong screen once.

`reauthenticateSession` is likewise one `UPDATE` with its own predicate (question 5), and so
races a release or the absolute limit the same way: whichever commits first decides, and the
loser's re-check sees it.

---

## 5. The back-office credential

**Authority:** owner, 2026-10-05 ("same manager only"; a credential other than the PIN, Google
SSO planned after the MVP); owner, 2026-10-06 (username and password; first manager injected by
hand; M-6 asks only for the password and offers another manager their own sign-in; eight hours
returns to Login). FR-A2b, FR-A2c, FR-A3, FR-A5, FR-B3; B-11, B-12, B-13.

**Decided:** that the MVP back office uses a username and a password; the M-6 behaviour; the
draft rule; that the first manager is created by hand.

**Not decided, and recommended below:** the schema, the throttle, the username and password
rules, whether one credential version covers both credentials, and the wording of the contract.
Each open item is in *For the owner*.

### Schema: a table of its own

```sql
-- db/migrations/0007_back_office_credential.sql (illustrative)
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

*The alternative* is two nullable columns on `staff_user`. It is one table fewer and one join
fewer. It loses on four counts:

- **The POS path never needs it.** `findUserByPin` and every later reader of `staff_user` would
  carry a password hash in reach. A separate table keeps the hash out of every query that is
  not a back-office sign-in.
- **It is expected to be replaced.** The owner's direction is Google SSO after the MVP. A
  credential that will be superseded should be droppable as a table, not left as dead columns
  on the identity record.
- **The throttle state belongs beside the secret it protects**, on a row that a sign-in can
  lock without locking the user (question 4's reason for not locking `staff_user`).
- **`staff_user` is about to loosen.** Kitchen staff become user records in Phase 1 with no
  PIN. Adding two more nullable credential columns and a both-or-neither check to that table
  at the same time makes its constraints harder to read than two tables are.

The table cannot say "only a manager has one" without a trigger. The rule is enforced where a
password is verified: success requires an active user whose role is `MANAGER`, as ARCH-007 ruled
for the approval class.

### The username

- **Case-insensitive by storing lower case.** The domain function trims and lower-cases what
  was typed; the check constraint refuses anything else, so two managers cannot hold `Budi` and
  `budi`. No `citext` extension is needed.
- **ASCII letters, digits, dot, underscore and hyphen, 3 to 32 characters.** A deliberately
  narrow alphabet avoids Unicode normalisation and look-alike questions the MVP has no reason
  to answer.
- **Unique across all rows, including deactivated users.** This differs from the PIN ruling on
  purpose. A PIN is a secret that names nobody; a username is a name, it appears on M-6 and
  will appear in the users screen, and reusing one invites misreading history. Nothing is lost:
  usernames are not scarce.

The alphabet and length are a recommendation (*For the owner*, 4).

### The password

- Argon2id with the parameters `pin.ts` already states (19 MiB, two passes, one lane), from one
  shared definition, so the two cannot drift.
- Verified as typed: no trimming, no case folding, no truncation.
- A length rule and nothing else. I recommend 8 to 128 characters with no composition rules;
  the minimum is a product number (*For the owner*, 4).
- **Everything B-11 and B-12 say about a PIN holds for a password**, whatever the boundaries'
  wording is when the task runs (*For the owner*, 2). A PostgreSQL error from this table is
  replaced, never wrapped, as `pin.ts` does. A request body's `password` field is redacted by
  the logger exactly as `pin` is (Task 8).

### Does a password change bump `credential_version`? Yes, and there is one version

I recommend **one `credential_version` per user, bumped by deactivation, a PIN reset and a
password set or reset alike.**

- Section 7.2 already says a bump fails "that user's sessions", all of them. One number does
  that with the predicate PHASE0-007 builds, and no second column on `actor_session`.
- The cost is over-invalidation: resetting a manager's PIN also ends their back-office session,
  and resetting their password also ends their POS session. A POS session lasts 90 seconds, and
  a reset is rare and deliberate. Failing closed is the right way round.

*The alternative*, a version per credential, would let a PIN reset leave the back-office
session alone. It needs the session to record which credential made it and the predicate to
choose a column by audience. That is more mechanism to buy a convenience nobody asked for.

Two rules follow for Phase 1, when the first writer exists:

- A password or PIN change and its version bump commit in one transaction.
- A manager who changes **their own** password would end the session they are using. The
  command must re-stamp that one session with the new version in the same transaction, or the
  product must accept being sent to Login. That is a product choice (*For the owner*, 5).

This also shows that FR-B3 and AC-32 are now too narrow: both say a reset or deactivation
invalidates "that user's POS session". A deactivated manager's back-office session must end
too. The architecture already says so; the PRD wording is in *For the owner*.

### The throttle: per account, on the credential row

FR-A5 names two classes and both are for PIN verification. The owner's line of 2026-10-06 says
another manager's failures "count against their own account", and the lead's delegated line
says a wrong password at M-6 counts "on the idled manager's account". Both describe a count per
account. I recommend exactly that, and neither of the two options the task names.

| Option | What happens | Verdict |
|---|---|---|
| The `LOGIN` bucket | A password failure and a PIN failure share one count | **Rejected** |
| A third installation-wide class | All password failures share one count | Rejected |
| **Per account** | Each credential row counts its own failures | **Recommended** |

**Why not `LOGIN`.** It would change what AC-19 means without changing its words.

- A manager mistyping a password five times at their desk would lock every cashier out of the
  POS for five minutes, and five wrong PINs at the lock screen would lock the back office.
- Worse, ARCH-007's accepted limit would spread to passwords. Any successful verification in a
  class resets it, and every cashier holds a valid PIN. A cashier could guess four passwords
  for a manager's username, log in at the POS with their own PIN to reset the count, and
  repeat, never starting a cooldown. The owner accepted that loop for six-digit PINs on a
  loopback host; nothing suggests it should be extended to the credential that guards the
  configuration and the audit viewer.
- FR-A5's first words are "PIN verification". A password is not one.

**Why not a third class.** It is the smallest change: one more row in `pin_throttle_bucket` and
the function already written. It isolates passwords from PINs, and only a manager's successful
password could reset it, so the loop above does not exist. It loses because it contradicts what
the owner said (failures count against an account), because one manager's typing mistakes would
lock out every other manager, and because the table and both of its check constraints say `PIN`
and would have to be renamed or left misnamed. Installation-wide counting exists for PINs
because PIN-only entry has no account to count against (section 7.3). A username supplies one.

**The per-account rule.** Five consecutive wrong passwords for one username start a five-minute
cooldown for that username. Only a successful verification of that same account resets it.
State is on the credential row, so it survives every restart and no cookie resets it. The
function mirrors `verifyPinThrottled` in every respect that ARCH-007 argued, and the task file
should cite that report rather than restate it: one transaction owned by the function, the row
locked with `FOR UPDATE`, the check and the Argon2id verification and the count inside the held
lock, every statement on the transaction's client, the clock read with `clock_timestamp()`
after the lock, a refused attempt verified against nothing and writing nothing, a lazy reset
when a cooldown has ended, evidence written after the commit, a returned union and no exported
reset.

What is different from the PIN throttle, and must be said:

- **An unknown username has no row to lock or count against.** It returns `FAILED` and is
  never `THROTTLED`. So a real username that has been attacked answers differently from one
  that does not exist, and an attacker can learn which usernames exist. A username is not a
  secret, and the server is loopback-only. I recommend accepting this for the MVP and recording
  it for the gate in section 3.2, beside ARCH-007's timing note, which applies here more
  strongly: a known username costs an Argon2id verification and an unknown one does not.
- **Anyone who knows a manager's username can lock that manager out of the back office**, five
  minutes at a time. It is bounded, as section 16 requires of the PIN cooldown, and it locks
  out one person rather than the restaurant.
- **The M-6 failure counts on the same row** as a failure at Login for that username. There is
  one count per account, not one per screen.

**Effect on AC-19:** none. Its three sentences are about PIN classes and stay true as written.
A new criterion covers the password (*For the owner*, 1).

### Evidence

A failed back-office sign-in has no identified actor, so by FR-A5, FR-J3 and B-13 it is
security telemetry and never an audit entry. That holds at M-6 too: an idle session names who
*was* signed in, not who is typing.

`security_event` today allows two event types and two classes. The credential task widens both
checks: a new event type `PASSWORD_FAILURE`, and a new class value `BACK_OFFICE_LOGIN` used for
it and for a `COOLDOWN_STARTED` on an account. The event still names no person. ARCH-006 ruled
that the table has no reference to `staff_user` "in any form", and the username that was typed
must not be stored either: a mistyped username is frequently a password typed into the wrong
field. `audit.ts`'s `SecurityEventInput` widens to match; its writer does not otherwise change.

### M-6 against a session

**The same session row is renewed, for the same manager, with a new token.**

The route's sequence (Task 9 builds it; PHASE0-007 supplies the two session calls):

1. `resolveSession(token, 'BACK_OFFICE', false)` returns `IDLE` with a `staffUserId`. Anything
   else is not an M-6 case: `ACTIVE` needs no re-authentication and `NONE` goes to Login.
2. The password is verified, throttled, **for that `staffUserId`**, not for a username from the
   request. M-6 shows the username fixed (owner, 2026-10-06) and the server must not rely on
   the client to keep it fixed.
3. `reauthenticateSession(token, 'BACK_OFFICE', verifiedUser)` renews the row and returns a new
   token for the cookie.

`reauthenticateSession` is one `UPDATE` whose predicate is the resolving predicate with two
changes: the idle clause is removed, and `s.staff_user_id = $user.id AND s.credential_version =
$user.credentialVersion` is added. It sets `last_interactive_at` and a new `token_hash`. It does
not touch `issued_at` or `absolute_expires_at`.

- **Same manager only, by construction.** The owner's draft rule of 2026-10-05 is that a draft
  is resumed only by the manager whose session idled. The renewal succeeds only for the user
  the row already names, so a preserved draft can never be resumed under another identity
  through this path, whatever the client does.
- **The eight hours do not restart.** A renewal past the absolute limit is refused by the
  predicate and returns `null`; the route answers as for `NONE`, and the client goes to Login
  with its draft kept locally and never resent (owner, 2026-10-06).
- **The token rotates.** A cookie value that sat unused through an idle period should not come
  back to life when someone types a password. It costs one column in an `UPDATE` the function
  performs anyway.
- **If the password was reset while the session idled**, the verified version no longer equals
  the row's, and the renewal returns `null`. The old session is dead, as FR-B3 requires. The
  route may then sign the same manager in afresh with `createSession`; whether the client keeps
  the draft in that case is Task 9's and the designer's, and by the owner's rule it may, since
  it is the same manager.

*The alternative* is a new session at M-6. It loses because the absolute limit would either
restart at every idle timeout, which makes "eight hours absolute" bind only a manager who never
pauses for thirty minutes, or have to be copied from the old row, which is the renewal written
as two statements. It would also leave the same-manager rule to the route instead of the
predicate.

**Another manager at M-6** is an ordinary sign-in (owner, 2026-10-06): their username, their
password, their account's count, `createSession`. The route releases the idled session with
`releaseSession` first, so it does not remain renewable, and the client discards the draft.
PHASE0-007 needs nothing further for it.

**The POS has no renewal.** A PIN after the 90 seconds may be anyone's, so it is always a new
session. The tender draft that survives it is the tab's (FR-G9, AC-20), not the session's.
`reauthenticateSession` accepts only `'BACK_OFFICE'` in its type for that reason.

### The hand-injected first manager

"By hand" cannot mean SQL typed into `psql`. A manager row needs an Argon2id PIN hash and a
blind index keyed by `PIN_PEPPER`, which is outside the database by design (section 7.3), and
the credential row needs an Argon2id password hash.

I recommend a command-line script in `apps/server/scripts`, run by the owner on the host:

- It asks for the name, the PIN, the username and the password on the terminal, with the two
  secrets not echoed. **Never from arguments or the environment**: both end up in shell history
  and the process list, which is B-12 by another door.
- It creates the `staff_user` row with role `MANAGER` and the credential row in one
  transaction, through the same domain functions the Phase 1 users screen will use.
  `createStaffUser` gains an optional client for this, as `findUserByPin` did.
- It prints the new user's id and nothing secret.
- It is not seed data (B-24): it holds no name, PIN or password, and creates only what its
  operator types.

It writes no audit entry. Creating a user is not in FR-J3's list, and there is no authenticated
actor to name (B-13). Whether it should refuse when a manager already exists is a small product
point (*For the owner*, 6).

### An ADR, and a contract change: both

**A new ADR, `Proposed`.** No accepted ADR covers authentication, so nothing is superseded. An
ADR is still warranted: this is a second credential, a second throttle model and a renewal
path, each chosen over an alternative for reasons that will otherwise be lost, and the owner
has already said it will be replaced by SSO, which will want a decision to supersede. It should
be commissioned as an architect task of its own, with the amendments to ARCHITECTURE.md that
the decision makes necessary:

- section 2.1 ("Argon2id for PIN verification");
- section 5.1 (a BackOfficeCredential entity; StaffUser's description);
- section 7.2 ("User deactivation or PIN reset increments a credential version");
- section 7.3 (the per-account throttle beside the two PIN classes; and, from ARCH-007, "PINs
  are unique" should read "unique among active staff");
- section 13 (the back-office `auth` row);
- section 16 (the username-enumeration and account-lockout risks).

ARCHITECTURE.md is approved, so those edits need the owner's acceptance with the ADR. The
number is the lead's to assign: ARCH-006 provisionally called its deferred roles proposal
ADR-008, and no file by that name exists.

**A contract change.** The PRD does not say how a manager signs in to the back office, says
passwords nowhere, and limits FR-B3 and AC-32 to POS sessions. B-11 and B-12 name PINs only.
Exact wording is in *For the owner*, 1 and 2.

**Two designer documents are now stale** and are the designer's to change after the ruling:
SCREEN-INVENTORY's BO-01 (`:548-550`) lists "a cashier PIN" as the permission-denied state and
"LOGIN class, 5 minutes, shared installation-wide with the POS" as its throttle; SITEMAP `:248`
repeats the latter.

---

## 6. Sequencing

1. **PHASE0-007, sessions: now.** It depends on nothing the owner has yet to decide. It
   includes `reauthenticateSession`, because the renewal is session mechanics, its concurrency
   belongs with the rest of the module's, and it is indifferent to which credential was
   verified. If the lead prefers no function without a caller in the same phase's next task,
   it can move to the credential task; I recommend against splitting the module's predicate
   across two tasks.
2. **The owner rules** on *For the owner* 1 to 4. In parallel, **an architect task** writes the
   ADR and the ARCHITECTURE.md amendments.
3. **The credential, as its own task** (call it PHASE0-007b), after the ADR is accepted and the
   PRD wording is approved: the migration, the password module with its per-account throttle,
   the widening of the two `security_event` checks and of `audit.ts`'s types, and the script
   for the first manager. It follows PHASE0-007 and PHASE0-006b (it touches `pin.ts`, as 006b
   does) and can run beside plan Task 8, whose files are disjoint.
4. **Plan Task 9, the routes,** after PHASE0-007, the credential task and Task 8.
5. **Plan Task 10, approvals,** needs PHASE0-007 and the routes, and not the credential.

**Not PHASE0-007:** the credential is a different reviewable slice, blocked on the owner, and
sessions should not wait for it. **Not Task 9:** a route task that also introduces a table, a
hash and a throttle is three reviews in one, and the throttle's race cases deserve a test file
that is about nothing else, as PHASE0-006's was.

**Task 9 still needs a consult of its own** before it is written, as ARCH-007 said. This report
settles what the session and credential modules offer it. It does not settle the cookie
attributes, origin validation and the anti-CSRF token (section 7.2), the response codes, or
which routes are interactive.

---

## 7. Anything else in plan Task 7

**Wrong against the documents or against what is built.**

| # | Plan | Must be | Authority |
|---|---|---|---|
| 1 | `app_session`, `last_activity_at` | `actor_session`, `last_interactive_at` | `0003`; section 5.1 |
| 2 | Cookie value is the row's `id` | A random token; the row holds its SHA-256 | `0003`; ARCH-006 §4 |
| 3 | `createSession` takes no credential version | Takes the verified one; the column has no default, so the plan's insert fails | `0003`; ARCH-006 §4 |
| 4 | `invalidateSessionsForUser` sweeps | Removed; the version comparison | section 7.2; FR-B3 |
| 5 | No credential-version check in resolution | In the predicate | section 7.2 |
| 6 | `touch` defaults to true | `interactive` is required | FR-A2b; AC-28 |
| 7 | A `SELECT`, then a separate unguarded `UPDATE ... WHERE id = $1` | One statement | question 4 |
| 8 | `now()` in the judging statements | `clock_timestamp()` | question 4; LESSONS |
| 9 | Returns `null` for every refusal | A union with `IDLE` | question 3; owner, 2026-10-06 |
| 10 | `releaseSession(id)`, reachable only for a live session | By token, for an idle one too | FR-A2b |
| 11 | `role: string` | `StaffRole` | `pin.ts` |
| 12 | `($3 \|\| ' seconds')::interval` | `make_interval(secs => $3::int)` | as `throttle.ts` |
| 13 | `COOKIE_NAME` in the domain module | Task 9's | question 3 |

**Tests that cannot run as written.**

- `beforeEach` resets with `DELETE FROM` through `query()`. `pos_app` has no `DELETE` on either
  table. Reset is `resetDatabase()`.
- The absolute-lifetime case sets `absolute_expires_at` to one second ago and leaves
  `issued_at` at now. `actor_session_expiry_after_issue_check` refuses it. The test must move
  both, through `ownerQuery`.
- Fixture state (ageing a row, deactivating a user, bumping a version) is changed through
  `ownerQuery`, not through the application pool, as PHASE0-006's tests do.

**Boundaries.**

- **B-11, B-12:** not strained by PHASE0-007; a session token is not a PIN. The same care is
  owed to it anyway: never logged, never in an error, never returned by a read. The plan's Task
  8 logger redacts `pin` and `managerPin` body fields and nothing about cookies; Task 8 must
  establish that the request serializer it uses does not log the `Cookie` or `Set-Cookie`
  header, and must add `password` to the redacted paths.
- **B-13:** kept. A session always names one staff user, by a foreign key that is `NOT NULL`.
  `IDLE` must never be read as an actor.
- **B-14:** kept, and worth one sentence in the task file. Nothing in `session.ts` records an
  approval, and no session of either audience may ever satisfy one (FR-A2c, AC-27).
- **B-24:** kept. The four numbers are PRD-fixed policy.

**Found, outside Task 7, for the lead's later task files.**

- **Plan Task 8** updates `client_instance.last_seen`; the column is `last_seen_at`. It writes
  that row on every request, health checks and polls included, and sets the cookie
  `sameSite: 'lax'` where section 7.2 says `Strict`.
- **Plan Task 9** logs the back office in by PIN against the `LOGIN` bucket; calls
  `assertNotThrottled`, `recordFailure` and `recordSuccess`, none of which exists; sets both
  cookies to `session.id` with `sameSite: 'lax'`; and has a `permission-denied` path for a
  cashier PIN at the back office that no longer has a meaning. Its two audience tests survive
  in substance and move to the token.
- **A login that presents an existing session cookie** should release that session before
  issuing the new one, on both surfaces. It is hygiene, not a control, since the old token
  cannot be used without re-authentication and the cookie is overwritten. Task 9's.
- **A role change does not bump the credential version** (question 3). Whether it should is
  Phase 1's decision when FR-B3's writer exists. Until then the back-office route guard is what
  refuses a demoted manager.

---

## For the task file

### PHASE0-007: rules

1. `apps/server/src/domain/session.ts` exports exactly `Audience`, `SESSION_POLICY`,
   `VerifiedUser`, `IssuedSession`, `SessionResolution`, `createSession`, `resolveSession`,
   `reauthenticateSession` and `releaseSession`, with the signatures in question 3. The plan's
   Task 7 code and test are superseded and must not be copied.
2. `SESSION_POLICY` is `POS: 90 / null` and `BACK_OFFICE: 1800 / 28800` seconds. The numbers
   exist nowhere else and are passed to SQL as parameters. No environment variable, option or
   test hook changes them.
3. A token is `crypto.randomBytes(32)` as 43 base64url characters. The row stores the SHA-256
   of the 32 raw bytes. A token that is not a string of that shape resolves to `NONE`, is
   released as a no-op and is re-authenticated to `null`, each without a query.
4. The token appears only in the return value of `createSession` and
   `reauthenticateSession`. No error, log line or other return value carries it or its digest.
5. `createSession` inserts `user.credentialVersion` as given and never reads `staff_user`. Its
   one statement uses `now()` for `issued_at`, `last_interactive_at` and
   `absolute_expires_at`; the last is `now() + make_interval(secs => $n)` for `BACK_OFFICE` and
   `NULL` for `POS`.
6. Every other statement reads the clock with `clock_timestamp()`. `now()` appears in
   `session.ts` only in the insert. No `Date` appears in `session.ts`, and no function returns
   a timestamp.
7. The predicate in question 3 is written once and used by every statement that judges a
   session. `resolveSession` is one statement on the success path: an `UPDATE ... FROM
   staff_user ... RETURNING` when `interactive` is true, a `SELECT` when it is false. On no
   row, one `SELECT` with the predicate minus the idle clause decides between `IDLE` and
   `NONE`.
8. `interactive` is required. The touch sets `last_interactive_at = GREATEST(last_interactive_at,
   clock_timestamp())`. A non-interactive resolution writes nothing.
9. `resolveSession` returns the user's current role and refuses nobody on role. It never
   compares `client_instance_id`.
10. Nothing writes `released_at` except `releaseSession`. An expired session is refused, not
    marked.
11. `releaseSession` finds the row by token and audience and sets `released_at` where it is
    null, whether or not the session is idle. It is idempotent and returns nothing.
12. `reauthenticateSession` is one `UPDATE`: the predicate without the idle clause, plus
    `s.staff_user_id = user.id` and `s.credential_version = user.credentialVersion`. It sets
    `last_interactive_at` and a new `token_hash`, leaves `issued_at` and `absolute_expires_at`
    alone, and returns the new token, or `null` when no row matched.
13. No function takes a client or joins a caller's transaction. No statement takes an explicit
    lock.
14. No migration, no new grant, no change to `pin.ts`, `throttle.ts` or `audit.ts`.
15. Tests reset with `resetDatabase()`, change fixture state only through `ownerQuery`, and use
    no `.concurrent`.

### PHASE0-007: illustrative SQL

The rules bind; this shows they fit `pos_app`'s grants (`SELECT`, `INSERT`, `UPDATE` on
`actor_session`; `SELECT` on `staff_user`). `now()` is used only where no lock wait can precede
the decision.

```sql
-- createSession ($5 is null for POS)
INSERT INTO actor_session
  (token_hash, audience, staff_user_id, credential_version, client_instance_id,
   absolute_expires_at)
VALUES ($1, $2, $3, $4, $6,
        CASE WHEN $5::int IS NULL THEN NULL
             ELSE now() + make_interval(secs => $5::int) END)
RETURNING id;

-- resolveSession, interactive ($3 = the audience's idle seconds)
UPDATE actor_session s
   SET last_interactive_at = GREATEST(s.last_interactive_at, clock_timestamp())
  FROM staff_user u
 WHERE s.token_hash = $1
   AND s.audience = $2
   AND u.id = s.staff_user_id
   AND s.released_at IS NULL
   AND u.is_active
   AND u.credential_version = s.credential_version
   AND (s.absolute_expires_at IS NULL OR s.absolute_expires_at > clock_timestamp())
   AND s.last_interactive_at > clock_timestamp() - make_interval(secs => $3::int)
RETURNING s.id, s.staff_user_id, u.role;

-- reauthenticateSession ($3 = new digest, $4 = user id, $5 = verified version)
UPDATE actor_session s
   SET last_interactive_at = GREATEST(s.last_interactive_at, clock_timestamp()),
       token_hash = $3
  FROM staff_user u
 WHERE s.token_hash = $1
   AND s.audience = $2
   AND u.id = s.staff_user_id
   AND s.released_at IS NULL
   AND u.is_active
   AND u.credential_version = s.credential_version
   AND (s.absolute_expires_at IS NULL OR s.absolute_expires_at > clock_timestamp())
   AND s.staff_user_id = $4
   AND s.credential_version = $5
RETURNING s.id;

-- releaseSession
UPDATE actor_session
   SET released_at = clock_timestamp()
 WHERE token_hash = $1 AND audience = $2 AND released_at IS NULL;
```

### PHASE0-007: test cases for `apps/server/test/session.test.ts`

Fixtures: one cashier and one manager made with `createStaffUser`; `VerifiedUser` values taken
from `findUserByPin`. "Aged" means changed through `ownerQuery` relative to
`clock_timestamp()`.

*Policy and creation*

1. `SESSION_POLICY` is 90 and null for `POS`, 1800 and 28800 for `BACK_OFFICE`, as literals.
2. A new `POS` row has `absolute_expires_at` null. A new `BACK_OFFICE` row has
   `absolute_expires_at - issued_at` of exactly eight hours and `last_interactive_at =
   issued_at`.
3. The stored `credential_version` is the one passed in, including when it differs from the
   user's current version.
4. The returned token is 43 base64url characters; two sessions get different tokens; the row's
   `token_hash` is the SHA-256 of the decoded token; no column of the row contains the token.
   The `sessionId` is the row's `id` and is not the token.

*Resolution*

5. A fresh session resolves `ACTIVE` with the user's id and role.
6. A `POS` token resolves `NONE` as `BACK_OFFICE` and a `BACK_OFFICE` token resolves `NONE` as
   `POS`, for the same manager holding both (FR-A2c, AC-27).
7. Malformed tokens (empty, too short, not base64url, the `sessionId` itself, a number passed
   at runtime) resolve `NONE`.
8. A session resolves the same whatever `client_instance_id` it recorded (FR-A7).
9. After the user's role is changed through the owner, the session resolves `ACTIVE` with the
   new role.

*Idle and absolute*

10. A `POS` session aged 89 seconds resolves `ACTIVE`; aged 91 seconds it resolves `IDLE`.
11. A `BACK_OFFICE` session aged 29 minutes resolves `ACTIVE`; aged 31 minutes, `IDLE`.
12. An interactive resolution moves `last_interactive_at` to within a second of the clock. A
    non-interactive one leaves the row byte-for-byte unchanged.
13. A `BACK_OFFICE` session aged 29 minutes, resolved non-interactively, then aged to 31
    minutes, resolves `IDLE` (AC-28: polling does not extend it). The same for `POS` at 89 and
    91 seconds.
14. With `last_interactive_at` set a few seconds into the future, an interactive resolution
    does not move it back.
15. A `BACK_OFFICE` session whose `issued_at` and `absolute_expires_at` are aged so the limit
    passed one second ago resolves `NONE`, although it was interactive a moment ago.
16. An interactive resolution never changes `absolute_expires_at` or `issued_at`.

*Invalidation*

17. After the user's `credential_version` is raised, the session resolves `NONE` (FR-B3).
18. After the user is set inactive with the version unchanged, the session resolves `NONE`
    (AC-32).
19. The interleaving in ARCH-006 section 4: verify, raise the version, then `createSession`
    with the verified value. The new session resolves `NONE`.
20. Raising one user's version leaves another user's session `ACTIVE`.

*Release*

21. A released session resolves `NONE`, interactively and not. A second release changes
    nothing.
22. An idle session can be released, and is then `NONE`, not `IDLE`.
23. Releasing a `POS` token as `BACK_OFFICE` releases nothing.

*Re-authentication*

24. An idle `BACK_OFFICE` session, re-authenticated by its own user with the current version,
    returns a new token. The new token resolves `ACTIVE` with the same `sessionId`; the old
    token resolves `NONE`; `issued_at` and `absolute_expires_at` are unchanged.
25. Re-authentication by a different manager returns `null` and changes nothing (owner,
    2026-10-05).
26. It returns `null` and changes nothing when the session is released, when the absolute limit
    has passed, when the user is inactive, and when the verified version is not the row's.
27. An `ACTIVE` session can be re-authenticated; the token still rotates.

*Concurrency*

28. A release wins a race it started. An owner connection opens a transaction and sets
    `released_at` on the row. An interactive resolution starts. Through a second owner
    connection the test polls `pg_stat_activity` until a `pos_app` backend has
    `wait_event_type = 'Lock'`, then commits. The resolution returns `NONE`.
29. The clock is read after the wait. The owner opens a transaction and locks the row
    (`SELECT ... FOR UPDATE`). An interactive `POS` resolution starts. Once it shows as
    waiting, the owner sets `last_interactive_at = clock_timestamp() - interval '90 seconds'`
    in that transaction and commits. The resolution returns `IDLE`. No sleep is needed: the
    value is live at the instant the resolution began and expired at every instant after the
    owner wrote it.
30. Twenty-five interactive resolutions of one token sent at once (more than the pool's ten)
    all return `ACTIVE`. Set an explicit timeout.

*Shape*

31. The module exports exactly the names in rule 1.
32. No error thrown in any case above contains a token used in the test.

### PHASE0-007: red proofs

Each is a mutation the builder makes, runs, reads and reverts, reporting the failing output.

1. Remove the version clause from the predicate: cases 17 and 19 resolve `ACTIVE`.
2. Remove `u.is_active`: case 18 resolves `ACTIVE`.
3. Have `createSession` read the user's current version instead of the one given: cases 3 and
   19 fail.
4. Remove the audience clause: case 6 resolves `ACTIVE`.
5. Touch on a non-interactive resolution: cases 12 and 13 fail.
6. Replace `clock_timestamp()` with `now()` in the interactive statement: case 29 returns
   `ACTIVE`.
7. Split the interactive resolution into a `SELECT` and a following `UPDATE ... WHERE id`:
   case 28 returns `ACTIVE`.
8. Drop `s.staff_user_id = $4` from the re-authentication: case 25 returns a token.
9. Leave `token_hash` unchanged on re-authentication: case 24's old token resolves `ACTIVE`.
10. Drop `GREATEST`: case 14 moves the column back.

### PHASE0-007: the Handoff must carry forward

- For Task 9: the cookie carries `token`; the cookie's name and attributes are Task 9's;
  every route declares `interactive`, and polling, health and `/me` are not; the back-office
  guard requires role `MANAGER` on every request; the M-6 sequence in question 5; `IDLE` is
  never an actor; a login releases a presented session first; the token never reaches a log.
- For Task 8: the request serializer must not log cookie headers.
- For Task 10: a session of either audience never satisfies an approval (B-14, FR-A2c).
- AC-27 and AC-28 are proved here at the domain level. They are closed only when Task 9 proves
  them through the routes. AC-32 is closed when FR-B3's writer exists in Phase 1.

### The back-office credential task (separate; the lead names it)

**Not to be dispatched until the owner has ruled on *For the owner* 1 to 4 and the ADR is
accepted.** What follows is what the task file will need, on the recommendations above; a
different ruling changes it.

*Rules*

1. A forward migration creates `back_office_credential` as in question 5, with its grants, and
   widens `security_event_type_check` to add `PASSWORD_FAILURE` and
   `security_event_throttle_class_check` to add `BACK_OFFICE_LOGIN`. No earlier migration is
   edited. `pin_throttle_bucket` is not touched.
2. A new module (not `pin.ts`, not `throttle.ts`) exports a creation function, a
   username normaliser, and one verification function,
   `verifyPasswordThrottled(account, password, options?)`, where `account` is
   `{ username: string }` or `{ staffUserId: string }`. It returns the same three-way union as
   `verifyPinThrottled`, with `VERIFIED` carrying `{ id, role, credentialVersion }`.
3. One attempt is one transaction owned by that function: find and lock the credential row
   with `FOR UPDATE OF` the credential table only, read the cooldown from `clock_timestamp()`
   in a statement after the lock is held, verify, write the outcome, commit. Everything under
   the lock runs on the transaction's client (ARCH-007 question 1).
4. Success is a correct password for an **active** user whose role is **`MANAGER`**. Anything
   else that returns is a failure and is counted on the row. No row for the account is
   `FAILED`, never `THROTTLED`, and counts nowhere.
5. Five failures, five minutes, the lazy reset, and "a refused attempt verifies nothing and
   writes nothing" are exactly ARCH-007's questions 3 and 4, on this row. The two numbers are
   constants in the module.
6. `credentialVersion` comes from the same statement that read the hash.
7. After the commit: one `PASSWORD_FAILURE` event per failure, and one `COOLDOWN_STARTED` when
   a cooldown began, both with class `BACK_OFFICE_LOGIN`. The event carries no username and no
   staff id. `audit.ts` changes only in its two type unions and their arrays.
8. The password and the hash never leave the module: no log, no error, no event. A database
   error from this table is replaced, not wrapped. Argon2id parameters come from one definition
   shared with `pin.ts`.
9. The username is trimmed and lower-cased before it is stored or looked up, and one that does
   not fit the pattern is a failed verification without a query.
10. The first-manager script is as in question 5: secrets from the terminal only, both rows in
    one transaction, nothing secret printed.

*Test cases* (beyond the direct ports of PHASE0-006's cases 1 to 6, 11 to 13 and 16 to 21 onto
this row):

- `Budi` and `budi` are one account; creating the second is refused; a deactivated user's
  username cannot be given to another user.
- A correct password for a deactivated manager, and for a user whose role is `CASHIER`, is
  `FAILED` and is counted.
- An unknown username is `FAILED`, starts no cooldown after any number of attempts, and writes
  one `PASSWORD_FAILURE` each time.
- Five failures for one account leave another account verifying normally, and leave both PIN
  buckets unchanged; five PIN failures in `LOGIN` leave password verification unchanged; a
  successful PIN login does not reset an account's password count (the criterion proposed in
  *For the owner*, 1).
- Verification by `staffUserId` and by `username` count on the same row.
- No `security_event` row and no thrown error contains the username, the password or the hash
  used.
- The grants: `pos_app` cannot delete a credential row or update its `username`.

*Red proofs:* the ports of PHASE0-006's proofs 1, 2, 3, 4 and 7; drop the role rule (a cashier
verifies); count a password failure in the `LOGIN` bucket (the isolation case fails).

---

## For the owner

Nothing here blocks PHASE0-007. Items 1 to 4 block the credential task.

**1. The PRD does not yet say what was ruled.** Proposed replacement wording, for the lead to
draft and the owner to approve. Each paragraph replaces the requirement of the same number
whole, except the two marked new.

> **FR-A1** The MVP has two authenticating roles: cashier and manager. Each authenticating
> user has a six-digit numeric PIN, unique among active users (FR-A4). A manager also has a
> username and a password, used only to sign in to the back office (FR-A2b). Kitchen remains a
> non-authenticating staff classification with no PIN and no application permissions. The
> waiter role is deferred beyond the MVP.

> **FR-A2b** On the back-office client, managers sign in with a username and a password into a
> conventional session with a 30-minute idle timeout, an eight-hour absolute lifetime, and
> explicit logout. A PIN is never accepted at the back office. After an idle timeout the same
> manager re-authenticates with their password, and unsaved form state is preserved behind
> that re-authentication. Another manager may sign in instead with their own username and
> password, and never receives that state. After the absolute lifetime the manager signs in
> again from the login screen. Background polling does not count as user activity.

> **FR-A3** PINs and back-office passwords are stored using Argon2id, never in plaintext, and
> never written to any log.

> **FR-A5b** *(new)* Back-office password verification is throttled per account. After five
> consecutive failures for one username, the server rejects further verification for that
> username for five minutes. Only a successful verification of that account resets its
> counter. A password failure never counts in a PIN class, and no PIN verification resets a
> password counter. The state is server-side and survives browser, application, and database
> restart. Failed back-office sign-ins are security telemetry. No password value is recorded
> anywhere.

> **FR-B3** Manage users: create, assign role, set and reset PIN, set and reset a manager's
> back-office username and password, deactivate. Deactivating a user, or resetting their PIN
> or password, from the back office invalidates every session of that user, POS and back
> office, on its next authenticated request.

> **AC-32** Deactivating a user in the back office invalidates that user's sessions, POS and
> back office, on their next authenticated request. Deactivating a table holding an open order
> is rejected. *(Covers: FR-B3, C8)*

> **AC-35** *(new)* A manager signs in to the back office with a username and password; a PIN
> is refused there. Five consecutive wrong passwords for one username block that username for
> five minutes, surviving restart, without affecting any other username, PIN login or manager
> approval; a successful PIN login does not reset it. After a 30-minute idle timeout the same
> manager resumes with their password alone and finds their unsaved work; a different manager
> who signs in instead does not. *(Covers: FR-A2b, A5b)*

FR-A5, FR-A7, AC-19, AC-27 and AC-28 need no change. In section 6, the edge case "Back office
deactivates a user or resets a PIN mid-shift — that user's POS session is invalidated" should
read "that user's sessions are invalidated" to match.

The question underneath FR-A5b is the real one: **is the password throttle per account, as I
recommend and as the 2026-10-06 lines read, or installation-wide like the PIN's?** Per account
means one manager's mistakes cannot lock out another, and it lets someone who knows a username
lock that one manager out for five minutes at a time.

**2. B-11 and B-12 name PINs only.** A password is a credential of the same kind, and I have
told the task to treat it as one regardless. A boundary changes only by the owner's explicit
decision, recorded with its reasoning. Proposed:

> **B-11. PINs and passwords are hashed with a modern password hash, never stored or
> transmitted in plaintext.**

> **B-12. No PIN or password value appears in any log, audit entry, error message, stack
> trace, or analytics event, in any form — including partially masked.**

The *Why* lines stand, with "a PIN or password" for "a PIN" in B-11's.

**3. An ADR is needed, and ARCHITECTURE.md must change with it.** Shall the lead commission an
architect task to write the ADR as `Proposed`, with the amendments to sections 2.1, 5.1, 7.2,
7.3, 13 and 16 listed in question 5, for the owner to accept together?

**4. Three numbers and one rule that are the owner's.** My recommendations: a username is 3 to
32 characters of lower-case letters, digits, dot, underscore and hyphen, not case-sensitive; a
username is never reused, even after its holder is deactivated; a password is 8 to 128
characters with no composition rules.

**5. One version covers both credentials** (question 5). Resetting a manager's PIN will also
end their back-office session, and resetting their password will also end their POS session.
And a manager who changes their **own** password: do they stay signed in to the back office
(my recommendation), or are they sent to Login? Needed before the Phase 1 users screen, not
before.

**6. Two things to know rather than decide, unless the owner objects.**

- With a per-account throttle, a username that exists and has been attacked answers
  differently from one that does not exist, so usernames can be discovered. I recommend
  accepting it for the MVP and recording it for the gate before any networked use
  (ARCHITECTURE 3.2), beside the two points the owner accepted there on 2026-10-07.
- The first-manager script will create a manager whenever it is run by someone at the host's
  terminal, not only the first time. Refusing once a manager exists would stop the owner
  recovering from a forgotten password before the users screen is built. I recommend it does
  not refuse.

DONE
