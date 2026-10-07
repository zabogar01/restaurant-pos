---
id: PHASE0-007
title: Sessions with audience policy and credential-version invalidation
category: feature
touches: [identity]
depends_on: [PHASE0-006]
owns: [apps/server/src/**, apps/server/test/**]
status: not-started
cycles: 0
---
# PHASE0-007 — Sessions

**Written** 2026-10-07 by the lead, from the architect consult ARCH-008
(`.agent/reviews/ARCH-008-sessions.md`, by `architect8`, 2026-10-07), which supersedes plan Task 7
(`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1722-1974`) entirely. The consult is not
yet on `development`, so its binding sections are copied below **verbatim**; this file is complete
without it. Cut from `development` at `20ae39e`. Touches identity: the owner looks before merge.

## Objective

Give the server `apps/server/src/domain/session.ts`: create a session for a verified user and an
audience, resolve it from the cookie token, renew an idle back-office session for the same manager
(M-6), and release it. A session is valid only while its recorded credential version equals the
user's and the user is active; the cookie carries a random 256-bit token and the row stores only
its SHA-256; idle and absolute expiry follow FR-A2, FR-A2b and AC-28, with only interactive requests
extending a session; every decision after a possible lock wait reads `clock_timestamp()`. When
this task is done, `apps/server/test/session.test.ts` proves every rule below against the real
tables as `pos_app`.

## Required inputs

- **`db/migrations/0003_client_instance_and_actor_session.sql`**: `actor_session` (`token_hash
  bytea` 32 bytes unique, `audience`, `staff_user_id`, `credential_version` with no default,
  `client_instance_id`, `issued_at`, `last_interactive_at`, `absolute_expires_at` required for
  `BACK_OFFICE` and after `issued_at`, `released_at`); `pos_app` has SELECT, INSERT, UPDATE, no
  DELETE; SELECT on `staff_user`. No migration changes in this task.
- **`apps/server/src/domain/pin.ts`** (`findUserByPin` → `{ id, role, credentialVersion }`,
  `createStaffUser`, `StaffRole`), **`throttle.ts`** (`verifyPinThrottled`, whose `VERIFIED` `user`
  satisfies `VerifiedUser`), **`pool.ts`** (`query`, `withTransaction`, pool size 10), and the
  harness `apps/server/test/support/database.ts` (`resetDatabase`, `ownerQuery`, `ownerClient`).
- `docs/PRD.md` FR-A2, FR-A2b, FR-A2c, FR-A7, FR-B3, AC-27, AC-28, AC-32; `docs/BOUNDARIES.md`
  B-11 to B-14, B-24; `docs/ARCHITECTURE.md` §7 and §14.4; ARCH-006 §4.
- **Owner rulings** (`.agent/DECISIONS.md`): a back-office draft is resumed only by the same
  manager (2026-10-05); M-6 asks the idled manager for their password and offers another manager a
  fresh sign-in (2026-10-06). The back-office **credential** itself (username and password) is
  **not** this task: it waits on the owner's ADR and contract wording. Sessions are indifferent to
  which credential was verified; tests use PIN-verified users.
- LESSONS: PostgreSQL's `now()` is the transaction's start time and goes stale after a lock wait
  (PHASE0-006).

## The interface (ARCH-008 §3, verbatim)

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

## From ARCH-008 "For the task file" (verbatim; binding)

### PHASE0-007: rules

1. `apps/server/src/domain/session.ts` exports exactly `Audience`, `SESSION_POLICY`,
   `VerifiedUser`, `IssuedSession`, `SessionResolution`, `createSession`, `resolveSession`,
   `reauthenticateSession` and `releaseSession`, with the signatures in *The interface* above. The plan's
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


### The Handoff must carry forward

- For Task 9: the cookie carries `token`; the cookie's name and attributes are Task 9's;
  every route declares `interactive`, and polling, health and `/me` are not; the back-office
  guard requires role `MANAGER` on every request; the M-6 sequence in question 5; `IDLE` is
  never an actor; a login releases a presented session first; the token never reaches a log.
- For Task 8: the request serializer must not log cookie headers.
- For Task 10: a session of either audience never satisfies an approval (B-14, FR-A2c).
- AC-27 and AC-28 are proved here at the domain level. They are closed only when Task 9 proves
  them through the routes. AC-32 is closed when FR-B3's writer exists in Phase 1.

## Tests expected to change

- None. The lead grepped `apps/server/test/` for `actor_session` and `session`: `schema.test.ts`
  (grants and constraints) and `harness-race.test.ts` (a list of table names) name the table, and
  neither uses this module. If any existing test needs a change, stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s 49 files and
   2838 tests (lead's verify, 2026-10-07), the client's 40 files and 2719 tests unchanged.
2. `npx vitest run apps/server/test/session.test.ts` alone is green three times in a row (cases 28
   to 30 are concurrency cases), and the Handoff maps each case number to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. `grep -n "Date\|console\." apps/server/src/domain/session.ts` finds nothing, and `grep -n
   "now()" apps/server/src/domain/session.ts` finds only the insert (rule 6); the Handoff shows both.
5. The Handoff carries forward the items listed above for Tasks 8, 9 and 10.

## Out of scope

- The back-office username and password, their table, throttle and first-manager script (a
  separate task after the owner's ADR and contract rulings; ARCH-008 *For the owner*).
- Cookies, routes, CSRF and origin checks (Tasks 8 and 9); approval (Task 10); FR-B3's writer
  (Phase 1).

## Handoff

**What I did.** Added `apps/server/src/domain/session.ts` and `apps/server/test/session.test.ts`, committed on `agent/phase0-007` (the commit touching these two files and this Handoff; hash in `git log`). No migration, grant, or change to `pin.ts`, `throttle.ts`, `audit.ts` or any existing test. No formatter was run.

The module follows ARCH-008 as copied above. The predicate (token, audience, not released, user active, credential version equal, absolute limit) is one string constant `VALID`; the idle clause is a second constant `NOT_IDLE`, so the IDLE/NONE fallback uses `VALID` alone. Interactive resolution is one `UPDATE ... FROM staff_user ... RETURNING` with `GREATEST`; non-interactive is one `SELECT`; on no row one more `SELECT` without the idle clause decides IDLE or NONE. `reauthenticateSession` is one `UPDATE`. `createSession` is the only statement with `now()` and never reads `staff_user`. Token validation (`digestOf`) checks type, the 43-character base64url shape, and that decoding gives 32 bytes that re-encode to the same string, so a non-canonical spelling of the same bytes is refused; a malformed token costs no query.

**Decisions.** (1) Database errors are replaced with a constant `The session store failed` and keep no cause, as `pin.ts` does, because a PostgreSQL error's `detail` can carry the failing row (here the digest). Rule 4 asked that no error carry the token or digest; the task did not say how, so I followed the existing house pattern. (2) Case 8 needs a real `client_instance` row (the column is a foreign key), so the test inserts one through `ownerQuery`. (3) Case 32 provokes real database errors from `createSession` (unknown user id, a null credential version) and checks the error text and its own properties for the token, the digest hex and any `\x` 32-byte literal. I could not provoke a database error from `resolveSession` without breaking the pool, so that path is covered by the shared `run` wrapper only.

**Spec deviation in test 13.** The case as written ("aged to 29 minutes, polled, then aged to 31") would not catch a polling touch if "aged to 31" overwrote `last_interactive_at` absolutely, because the overwrite erases the touch. Red proof 5 showed it: with my first version only case 12 failed. I changed case 13 to move the row a further 2 minutes (2 seconds for POS) back relative to wherever the poll left it, so a touching poll leaves the row ACTIVE. With that change the proof fails cases 12 and 13 as the task expects.

**Existing tests changed:** none.

**Case to test map** (all in `apps/server/test/session.test.ts`; each test name begins with its case number): 1 SESSION_POLICY literals; 2 POS no limit, back office eight hours; 3 stores the version given; 4 token shape and SHA-256 only; 5 fresh ACTIVE; 6 audience NONE both ways; 7 malformed tokens; 8 client_instance_id; 9 role change; 10 POS 89/91; 11 back office 29/31 minutes; 12 interactive moves, non-interactive unchanged; 13 polling does not extend; 14 never moves back; 15 absolute limit; 16 issued_at and absolute unchanged; 17 version raised; 18 inactive; 19 ARCH-006 interleaving; 20 other user unaffected; 21 release and idempotence; 22 idle release is NONE; 23 wrong-audience release; 24 renewal; 25 different manager; 26 released, limit, inactive, version differs (one test, four labelled assertions); 27 ACTIVE re-authentication; 28 release wins the race; 29 clock read after the wait; 30 twenty-five simultaneous; 31 exact exports; 32 errors carry no token.

**Red proofs** (each mutated in `session.ts`, run, read, reverted by restoring a saved copy; the final file is the one that went green):
1. Version clause removed: cases 17, 19 and 20 failed (`expected ACTIVE to equal NONE`). Case 20 fails because the raised user's own session still resolves ACTIVE.
2. `u.is_active` removed: cases 18 and 26 failed (26: `inactive: expected { token, sessionId } to be null`).
3. `createSession` reads the user's current version: cases 3 (`expected '2' to be '1'`) and 19 failed.
4. Audience clause replaced with a no-op using `$2`: case 6 failed (`expected 'ACTIVE' to be 'NONE'`).
5. Non-interactive resolution touches: cases 12 and 13 failed (12 shows `last_interactive_at` moved from 05:18 to 05:28). See the deviation above.
6. `now()` instead of `clock_timestamp()` in the idle clause: case 29 returned `ACTIVE`, expected `IDLE`.
7. Interactive resolution split into `SELECT` then `UPDATE ... WHERE id`: case 28 returned `ACTIVE` (expected NONE), and case 29 also failed.
8. `s.staff_user_id = $4` dropped: case 25 returned a token instead of null.
9. `token_hash` left unchanged on re-authentication: cases 24 and 27 failed (24 at the new-token resolve, 27 because the old token still resolved ACTIVE).
10. `GREATEST` dropped: case 14 failed; `last_interactive_at` moved from +5 seconds back to the present.

**Greps.** `grep -n "Date\|console\." apps/server/src/domain/session.ts` printed nothing. `grep -n "now()" apps/server/src/domain/session.ts` printed only `87:                  ELSE now() + make_interval(secs => $5::int) END)`, the insert.

**Verify.** `npx vitest run apps/server/test/session.test.ts` was green three times in a row (32 of 32 each time, about 3.5 seconds). `npm run verify`: typecheck clean; 50 files, 2870 tests passed. Against `development`'s 49 files and 2838 tests that is one file and 32 tests added, exactly this task's; the client files are untouched.

**Found and not fixed.** An idle session past its absolute limit is NONE, as the owner ruled. Expired rows are never marked or deleted. Nothing bumps `credential_version` on a role change, so a demoted manager keeps a resolving session with role CASHIER; refusing that is the route guard's, as ARCH-008 says.

**Carry forward.** For Task 9: the cookie carries `token`; the cookie's name and attributes are Task 9's; every route declares `interactive`, and polling, health and `/me` are not; the back-office guard requires role `MANAGER` on every request; M-6 asks the idled manager for their password and calls `reauthenticateSession`, while another manager gets a fresh sign-in; `IDLE` is never an actor, and POS routes treat it as NONE; a login releases a presented session first; the token never reaches a log. For Task 8: the request serializer must not log cookie headers. For Task 10: a session of either audience never satisfies an approval (B-14, FR-A2c). AC-27 and AC-28 are proved here only at the domain level and close when Task 9 proves them through routes; AC-32 closes when FR-B3's writer exists in Phase 1.

**Not available.** No browser was needed or used.

DONE
