---
id: PHASE0-009b
title: The credential routes — POS and back-office sign-in, and M-6 re-authentication
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-009a]
owns: [apps/server/**, packages/contracts/**, package.json, package-lock.json]
status: review
cycles: 0
---
# PHASE0-009b — The credential routes

**Written** 2026-10-09 by the lead, from the architect consult ARCH-012
(`.agent/reviews/ARCH-012-auth-routes.md`, by `architect12`, 2026-10-09), which supersedes plan
Task 9 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:2316-2729`). Do not copy anything
from plan Task 9. This is the second half of the split: PHASE0-009a built the route declaration, the
session guard and the six routes that need a session and verify nothing. This task adds the three
routes that take a credential. The consult's binding sections are copied below **verbatim**, with
their headings moved down one level; the numbered "questions" they refer to are the consult's
sections (question 7 is section 7, and so on). Touches identity and B-11 to B-14: the owner looks
before merge.

## Objective

A cashier signs in at `POST /api/pos/auth/login` with `{ pin }`, a manager at
`POST /api/back-office/auth/login` with `{ username, password }`, and an idled manager renews the same
back-office session at `POST /api/back-office/auth/reauthenticate` with `{ password }` alone. Each
route validates its body with one strict zod 4 schema, calls the throttled verification once, and on
`VERIFIED` only releases any presented session, issues a fresh one, sets the cookie and returns
`SessionView` with a new CSRF token. A failed or throttled attempt changes no session and no cookie,
answers `INVALID_CREDENTIALS` or `THROTTLED` with `retryAfterSeconds` exactly as the domain supplied it,
and says nothing about which part of a credential was wrong. When this task is done, the test cases
below prove every rule through `inject()` and the jar client against the real tables as `pos_app`,
and AC-19, AC-27, AC-28 and AC-35 close as far as the consult's question 10 table says.

## Required inputs

- **PHASE0-009a as merged** (read its task file in `.agent/tasks/`, the whole Handoff and the lead
  rulings 1 to 14): `RouteAccess` and `installAccessChecks` (`http/access.ts`), the session module
  (`http/session-guard.ts`: the cookie names and paths, the raw-header read, the clear, the CSRF
  derivation, `sessionGuard`, `actorOf`, `csrfTokenOf`, `signOut`), the routes in
  `http/routes/pos-auth.ts` and `back-office-auth.ts`, the jar client `test/support/client.ts`, the four
  codes and `SessionView` in `@pos/contracts`. Its Handoff section *Carried forward*, item "For 009b",
  is binding here.
- **PHASE0-008a and 008b** (their Handoffs): `buildServer`, the `/api` context and its hooks,
  `AppError`, the log rules, `request.clientInstanceId`. Use `inject(app, …)` from
  `test/support/request.ts`, never `app.inject`.
- **Built domain:** `verifyPinThrottled(throttleClass, pin, { clientInstanceId })` (`throttle.ts`) and
  `verifyPasswordThrottled(account, password, { clientInstanceId })` (`back-office-credential.ts`), both
  returning `ThrottledVerification` (`VERIFIED` with `user { id, role, credentialVersion }`, `FAILED`
  with `retryAfterSeconds: number | null`, `THROTTLED` with `retryAfterSeconds: number`);
  `createSession`, `resolveSession`, `reauthenticateSession(token, 'BACK_OFFICE', user)` (returns
  `IssuedSession | null`), `releaseSession` (`session.ts`); `createStaffUser` (`pin.ts`), `MAX_FAILURES` and `COOLDOWN_MINUTES` (`throttle.ts`),
  `createBackOfficeCredential`, `normaliseUsername`, `PASSWORD_MAX_FAILURES`,
  `PASSWORD_COOLDOWN_MINUTES` (`back-office-credential.ts`). `pos_app` has SELECT on `staff_user` and
  `back_office_credential` (migrations `0002`, `0007`).
- **Contract:** PRD FR-A2, FR-A2b, FR-A2c, FR-A4, FR-A5, FR-A5b, FR-A7, FR-J3, AC-19, AC-27, AC-28,
  AC-35; `docs/ARCHITECTURE.md` §7.2, §13; ADR-009 (§1, §3, §4, §6); ADR-010 (the six rules);
  `docs/BOUNDARIES.md` B-11, B-12, B-13, B-14, B-24.
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time; any statement you add that reads
  the clock uses `clock_timestamp()`. This task should need no SQL that reads a clock.

## From ARCH-012 (verbatim; binding)

### 5. Codes and statuses

Six codes enter `@pos/contracts`, each in the task that first emits and tests it.

| Situation | Status | Code | `details` |
|---|---|---|---|
| A credential did not verify: a wrong or unknown PIN; an unknown username, a wrong password, a deactivated manager, a user who is no longer a manager; a wrong password at M-6 | 401 | `INVALID_CREDENTIALS` | `{ retryAfterSeconds }` **only** when this failure started a cooldown; otherwise absent |
| A cooldown is in force and nothing was verified | 429 | `THROTTLED` | `{ retryAfterSeconds }`, always, 1 to 300 |
| No session resolves for this route's audience | 401 | `UNAUTHENTICATED` | none |
| The session is valid in every respect except idle time | 401 | `SESSION_IDLE` | none |
| An active back-office session whose user is not a manager | 403 | `FORBIDDEN` | none |
| A mutating request without the session's token | 403 | `CSRF_REFUSED` | none |
| A body that does not fit its schema | 400 | `VALIDATION_FAILED` (exists) | none |
| The database failed in a hook or a route | 500 | `INTERNAL` (exists) | none |

```ts
export interface ErrorDetailsByCode {
  INVALID_CREDENTIALS: { retryAfterSeconds: number };
  THROTTLED: { retryAfterSeconds: number };
}
```

`retryAfterSeconds` is a number PostgreSQL computed (`throttle.ts:40`, `back-office-credential.ts:126`).
These are the first codes to carry details, so this task owes the test of the handler's details
path that PHASE0-008a's case 29 could not make, and `error-details.types.ts` gains a block for each
of the six: for the four without details, the existing pattern; for the two with, that a string, an
exception's message and an object of another shape do not compile and `{ retryAfterSeconds: 1 }`
does.

**One code for a failed verification on both surfaces.** `INVALID_CREDENTIALS` says the same thing
at POS-01, BO-01 and M-6; each client chooses its own sentence. The fifth failure is still a failed
verification, so it keeps the code and gains the detail, which lets the screen show the cooldown
without a second request (ARCH-007 §7). `THROTTLED` is reserved for "nothing was looked at".

**Unknown username and wrong password are the same response**, byte for byte: the domain returns
`FAILED` for both, and the route maps `FAILED` to one thing. They diverge only at a cooldown (a
known account's fifth failure carries the detail, and its sixth attempt is `THROTTLED`; an unknown
name never is), which is the discovery risk the owner accepted in ADR-009. **The server reports no
count of attempts remaining**, on either surface. At the back office a count would distinguish a
known username at the first attempt.

**`SESSION_IDLE` is used on both surfaces.** At the back office it is what tells M-6 from Login. At
the POS it leads to POS-01, never to a renewal, and gives POS-01's two states a server basis:
`SESSION_IDLE` is ordinary expiry, and `UNAUTHENTICATED` on a session the client believed it had is
"session invalidated" (FR-B3). PHASE0-007's Handoff says POS routes "treat `IDLE` as `NONE`"; that
holds in every respect that matters, since `IDLE` grants nothing and the POS cookie is cleared. The
code alone differs.

**No code says a token is valid elsewhere.** A POS token presented in the back-office cookie
resolves `NONE` and is answered exactly as an unknown token is: same status, same body, same
clearing header. A test compares the two responses whole.

**Three codes share 401.** Clients switch on the code, never on the status (ADR-010). A client that
sent every 401 to the lock screen would treat a mistyped PIN as a lost session.

#### A database failure: 500 `INTERNAL`

PHASE0-008b left the client-instance hook's failure at 500 for this consult. It stays, and the same
holds for the session guard and for every route in this task.

- **The domain erases the error on purpose.** Every module replaces a database error with a fixed
  message and no cause (B-12). The HTTP layer receives a plain `Error` and cannot tell an outage
  from a violated constraint. Classifying it would mean each module reading and re-exporting the
  driver's error code, which is a change to four reviewed modules for one status.
- **A client must behave the same way for both.** Either means "this did not succeed, and for a
  command, do not assume it did not happen". §12 asks that an outage block writes visibly and that
  no client claims success; 500 does that.
- **Health already answers the question.** `GET /api/health` returns 503 `UNAVAILABLE` when the
  database cannot be reached. A client that receives a 5xx or no response asks health and shows
  "the system is unavailable" or "something went wrong" accordingly.

`UNAVAILABLE` therefore remains health's and the closing server's. The first place where "certainly
not applied" must be told from "unknown" is the idempotent commands of Phase 2, and that consult
should revisit this with the idempotency design in front of it.

### 6. Verification order

**A PIN that is not exactly six ASCII digits, as a string, is refused by the route's schema with 400
`VALIDATION_FAILED`. It never reaches `verifyPinThrottled`: nothing is counted and no security
event is written.** This confirms ARCH-007 §7.

- It can never be a valid PIN, so not counting it gives a guesser nothing, and the response does not
  depend on any secret.
- The `LOGIN` class is installation-wide. Counting malformed input would let one client bug, or one
  stuck key, lock every cashier out for five minutes.
- The refusal is the same during a cooldown: a malformed PIN gets 400, not 429.

The schema checks the type before the pattern, so the number `123456` is refused (the B-12 lesson
of PHASE0-004), as are a trailing newline and non-ASCII digits.

**A username and a password are different, and I rule the other way.** The route's schema checks
only that each is a string, non-empty, and within a generous size (256 and 1024 UTF-16 units; a
valid password of 128 code points can be 256 units long, so the cap must not be tighter than the
rule). Everything else goes to `verifyPasswordThrottled`, which already treats a malformed username
as an account with no row and a password of the wrong length as a failed match.

- **The domain stays the one authority on what a valid credential is.** The alternative is to
  repeat the username pattern and the length rule in the schema, or to export `passwordFits` for
  the route to call first. Either is a second copy of a rule that ADR-009 §3 took care to state
  once.
- **Every typed credential gets the same answer.** With a strict schema, a short password would get
  400 where a wrong one gets 401. That leaks nothing secret, but it is one more response a sign-in
  form has to explain, and one more place where "indistinguishable" has to be argued instead of
  being true by construction.
- **The blast radius is one account.** A malformed password against a real username counts as a
  failure on that row. That is the per-account lockout the owner accepted, five minutes at a time,
  and not the restaurant-wide lock that justifies the PIN rule.

A request that is not the right shape at all (a missing field, an extra key, a non-string) is 400
on both surfaces and counts nowhere.

**The order within each sign-in** is: origin guard and client instance (hooks); schema; one call to
the throttled verification; then, only on `VERIFIED`, the session. The route makes no query between
the schema and the verification, and holds no transaction of its own.

### 7. The routes, M-6, and a session already held

#### The nine routes

Paths are relative to the API context. Success bodies are `SessionView`
(`{ staffUserId, role, csrfToken }`) or empty.

| Route | Declaration | Body | Success |
|---|---|---|---|
| `POST /pos/auth/login` | `OPTIONAL`, `POS` | `{ pin }` | 200 `SessionView`, sets the cookie |
| `GET /pos/auth/me` | `ACTIVE`, `POS`, not interactive | | 200 `SessionView` |
| `POST /pos/auth/activity` | `ACTIVE`, `POS`, interactive | none | 204 |
| `POST /pos/auth/release` | `OPTIONAL`, `POS` | none | 204, clears the cookie |
| `POST /back-office/auth/login` | `OPTIONAL`, `BACK_OFFICE` | `{ username, password }` | 200 `SessionView`, sets the cookie |
| `GET /back-office/auth/me` | `ACTIVE`, `BACK_OFFICE`, not interactive | | 200 `SessionView` |
| `POST /back-office/auth/activity` | `ACTIVE`, `BACK_OFFICE`, interactive | none | 204 |
| `POST /back-office/auth/logout` | `OPTIONAL`, `BACK_OFFICE` | none | 204, clears the cookie |
| `POST /back-office/auth/reauthenticate` | `OPTIONAL`, `BACK_OFFICE` | `{ password }` | 200 `SessionView`, sets a new cookie |

**The two `activity` routes are an addition to the plan, and I recommend them.** Without them no
route in Phase 0 is interactive, so a POS session would end 90 seconds after sign-in whatever the
cashier did, and a manager who spent 31 minutes typing into one form without saving would be
idled. "Inactivity" in FR-A2 is the person's, and only the client sees a touch that causes no
request. The route moves `last_interactive_at` and does nothing else. It is mutating, so it needs
the CSRF token and cannot be driven from another site. It also gives AC-28 a production route to be
proved on. The server cannot tell a touch from a timer; that the client calls it only on real input
is a rule for the client task, with a client test (see *For the lead*).

#### A sign-in when the browser already holds a session

On **`VERIFIED`**, and only then, the route releases whatever session the surface's cookie presents
(`releaseSession(token, audience)`, which needs no resolution and accepts an idle session), then
creates the new session, then sets the cookie. If the release fails, no session is created. If the
creation fails, the old session is already gone. Both fail closed.

A sign-in that **fails or is throttled changes no session and no cookie**. A mistyped PIN should not
end anything, and an unauthenticated request should have no effect beyond its own count.

ARCH-008 called this hygiene, and it is: the old token cannot be used without the old cookie, which
the new one overwrites. It matters in one place, below.

#### The M-6 sequence

`POST /api/back-office/auth/reauthenticate`, body `{ password }`, strict: a `username` in the body is
a schema failure, so the request cannot name whom to verify.

1. Hooks: origin guard, client instance.
2. No cookie, or the name repeated: 401 `UNAUTHENTICATED`.
3. `X-RPOS-CSRF` must match the presented cookie: otherwise 403 `CSRF_REFUSED`.
4. Schema: otherwise 400.
5. `resolveSession(token, 'BACK_OFFICE', false)`.
   `NONE`: clear the cookie, 401 `UNAUTHENTICATED`. **No password is verified and nothing is
   counted.** Past the eight hours there is nothing to renew, and the client goes to Login with its
   draft kept locally and never resent (owner, 2026-10-06).
   `IDLE` or `ACTIVE`: continue with the `staffUserId` the resolution returned.
6. `verifyPasswordThrottled({ staffUserId }, password, { clientInstanceId })`, the account being the
   one the session names (ADR-009 §6).
   `THROTTLED`: 429. `FAILED`: 401 `INVALID_CREDENTIALS`. In both the session is untouched and
   remains renewable. The failure counts on the same row as a failure at Login (ADR-009 §4).
7. `reauthenticateSession(token, 'BACK_OFFICE', user)`.
   A session: set the cookie to the new token; 200 with the new CSRF token.
   `null` (the row was released, expired, or its version changed between steps 5 and 7): clear the
   cookie, 401 `UNAUTHENTICATED`.

Three decisions in that sequence:

- **An `ACTIVE` session is renewed like an idle one.** The client's timer and the server's clock
  will disagree by a second now and then. Verifying the password and rotating the token is
  harmless; answering "not needed" would close M-6 without a password having been checked.
- **A renewal that returns `null` does not fall through to a fresh session.** ARCH-008 allowed that
  the route "may" sign the same manager in afresh. I rule that it does not: it would start a new
  eight hours from inside M-6, and it is a second path to a session that only the sign-in route
  should own. The manager signs in at Login.
- **The POS has no such route.** A PIN after 90 seconds may be anyone's and is always a new session.

**Another manager at M-6** is the ordinary `POST /api/back-office/auth/login` with their own
username and password. The idled manager's cookie is presented with it, because the path is the
same, so on `VERIFIED` the idled session is released before the new one is issued and "does not
remain renewable" (ADR-009 §6). If the other manager's sign-in fails, the idled session is as
renewable as it was. The client discards the draft; when it does so is the designer's.

**M-6 exists only while the tab still holds its state.** After a reload the page has no draft and no
CSRF token, and `GET …/me` answers `SESSION_IDLE` with no body to supply one. The client shows
Login, and signing in releases the idle session. Nothing is lost that was not already gone, and no
read is granted on an idle session.

### 8. Role and credential edges

**A demoted manager.** A role change does not increment the credential version, so the session
still resolves, and `resolveSession` returns the user's **current** role, read in the same statement
that judges the session (`session.ts:120`, `:124`). The guard compares it with `MANAGER` on every
`ACTIVE` back-office request and answers 403 `FORBIDDEN`. **The domain offers everything needed.**

- The session is neither released nor cleared. If the role is restored, it resolves again.
- An interactive request from a demoted manager still moves `last_interactive_at` before the role
  is known. It grants nothing.
- If that session is idle, the answer is `SESSION_IDLE`, because an idle resolution returns no
  role. M-6 then fails at step 6: `verifyPasswordThrottled` requires an active manager, returns
  `FAILED`, and counts it. A demoted manager typing their correct password is told the credentials
  are invalid and can lock their own account for five minutes. That is ADR-009 §1 as written.
- Their POS session is unaffected and reads role `CASHIER` from the next request on. A promoted
  cashier reads `MANAGER` likewise. `request.actor.role` is the role at this request, never the
  role at sign-in (§7.2).

**What the domain does not offer**, for the lead:

1. *A person's name, or a manager's username.* `SessionView` carries an id and a role. The POS bar
   shows who is signed in, and M-6 shows the idled manager's username. Nothing in
   `apps/server/src/domain` reads `staff_user.name` or `back_office_credential.username` for an id.
   I recommend 009b adds `name` to both views and `username` to the back-office view, through one
   small reader; the alternative is that the client-shell task reopens these routes. The lead's
   call.
2. *A count of attempts remaining.* Deliberately absent (question 5).
3. *The time left before a session idles.* Not offered; see the note on the countdown in *For the
   lead*.
4. *A typed outage error.* Question 5.

**ADR-009's three open questions**, noted and not decided. No route in this task depends on any of
them.

- *Whether changing one's own password requires the current one.* If yes, that Phase 1 route
  verifies `{ staffUserId }` from the acting session, as step 6 of M-6 does. The session module's
  functions should not assume M-6 is their only caller.
- *Whether a manager who resets their own PIN stays signed in.* It would need the same re-stamp of
  the acting session that the own-password change needs. Nothing here.
- *Whether a role change increments the credential version.* If it does, a demoted manager gets
  `UNAUTHENTICATED` and `FORBIDDEN` becomes unreachable in practice. The guard's role check stays
  either way; it is the control, and the version would be a second one.

### 9. Validation

**Use zod, major 4, as a dependency of `@pos/contracts`.** NFR-5 has the two clients share API
schemas, and a schema that is also a type keeps the server's parsing and the client's request from
drifting. The builder confirms the current API with the librarian before writing against it.

**One validator.** Routes declare no Fastify `schema`. A second validator is a second set of
messages and a second place for a rule.

The rules that keep input out of responses and logs:

1. A route parses with `safeParse` through one helper. On failure the helper throws
   `new AppError(ErrorCode.VALIDATION_FAILED, 400)` and **drops the result**. The error object, its
   issues and its message are passed to nothing: not to the `AppError`, not to a logger.
2. `reportInput` is never set.
3. Every request schema is a strict object. An extra key is a failure. (`{ pin, username }` sent to
   the wrong surface should fail, not be half-read.)
4. Schemas carry no custom error messages. A message nobody may forward is noise, and the plan's
   `'PIN must be six digits'` is the client's copy to write.
5. **`VALIDATION_FAILED` carries no `details` in this task.** It has no entry in
   `ErrorDetailsByCode` today, so a details argument does not compile, and that stays true.

On the last: the three bodies have one or two fields, and both clients hold the same schema and can
say which field is wrong before sending. A field list would be the first details type whose content
is derived from what the client sent. When a Phase 1 form needs one, its consult should require
that the list be built by intersecting issue paths with **the schema's own keys**, so that an
`unrecognized_keys` issue, whose key names are the client's strings, can never contribute to it,
and that the type in the contracts be a union of those literal keys.

The schemas:

```ts
export const PosLoginRequest = z.strictObject({ pin: z.string().regex(/^[0-9]{6}$/) });
export const BackOfficeLoginRequest = z.strictObject({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(1024),
});
export const ReauthenticateRequest = z.strictObject({ password: z.string().min(1).max(1024) });
```

A body that is absent, not JSON, or not of a JSON content type is already answered by PHASE0-008a
(400 or 415 in the envelope).

### 10. Proofs and sequencing (excerpt)

#### What closes, and what does not

| Criterion | Closes in Task 9 | Still open |
|---|---|---|
| AC-19 | The `LOGIN` class through the route: five failures, the cooldown, a correct PIN refused, the other class untouched, a cleared or replaced `rpos_cid` changing nothing, a rebuilt server still refusing | The `MANAGER_APPROVAL` class through its route (Task 10) |
| AC-27 | First sentence, both directions, for a manager | "must still enter a PIN for an inline POS approval" (Task 10) |
| AC-28 | At the API: 90 seconds, 30 minutes, 8 hours, and that a poll does not extend either | "divergent timeout presentation" in a browser (Task 12) |
| AC-35 | Sign-in by username and password; a PIN refused; the per-account cooldown and its isolation; an unknown username never blocked; restart; M-6 renewing the same session by password alone | "finds their unsaved work; a different manager does not" (the client, Tasks 11 and 12) |

#### Against the boundaries and requirements the task names

- **B-11.** Kept by the listener. No route accepts a credential anywhere but a JSON body.
- **B-12.** The exposure is the three request bodies and the session and CSRF tokens. Nothing hands
  a body, a header or a cookie to a logger; the validation helper drops the parse result; no
  response echoes a field. The log scan is extended with a marker per channel.
- **B-13.** No route in this task writes an audit entry: signing in and out are not audited actions
  (FR-J3), and a failed sign-in has no actor. The security events are the domain's. `IDLE` is never
  an actor.
- **B-14.** No session of either audience satisfies an approval, and nothing on the request or the
  instance can carry one to the next request. One sentence for the task file.
- **B-24.** No seed. Tests create their users through the domain functions and import the policy
  numbers from the domain constants; no test restates 5, 90, 1800 or 28800.
- **FR-A2c.** The cookie is chosen by the route's declared audience. No header selects an audience,
  and passing the origin guard or the CSRF check grants nothing.
- **FR-A5, FR-A5b.** The route calls each throttled verification once and adds no state.
- **FR-A7.** `request.clientInstanceId` is passed to the domain as it is. Nothing reads or compares
  it.
- **Time.** PHASE0-009 should need no SQL of its own. If the name reader of question 8 is added it
  reads no clock. Any statement that does must use `clock_timestamp()`, never `now()`, unless it is
  the first statement of its transaction.

## For the task file (ARCH-012, verbatim; binding)

### PHASE0-009b: rules

1. The POS sign-in calls `verifyPinThrottled('LOGIN', pin, { clientInstanceId })` once and nothing
   else from `pin.ts` or `throttle.ts`. The back-office sign-in calls
   `verifyPasswordThrottled({ username }, …)` once and never a PIN function. Neither surface's
   route imports the other's verification.
2. A PIN that fails the schema never reaches the throttle. A username or password is checked for
   type and size only.
3. `FAILED` maps to `INVALID_CREDENTIALS`, with `retryAfterSeconds` only when the domain supplied
   it. `THROTTLED` maps to `THROTTLED`. No other distinction is made, and no count is reported.
4. On `VERIFIED`: release the presented session, create, set the cookie. On anything else: no
   session and no cookie is changed.
5. A sign-in sets a token the server generated in that request and never one that was presented.
6. `createSession` is given the verified `user` unchanged and `request.clientInstanceId` as it is.
7. Re-authentication follows question 7's seven steps in that order. The account is
   `{ staffUserId }` from the resolution. The body has no username.
8. Validation follows question 9's five rules. `VALIDATION_FAILED` has no details.
9. No route writes an audit entry (B-13, FR-J3). No route writes a security event itself.
10. No credential, token or username is put in a URL, a log or a response.

### PHASE0-009b: test cases

*POS sign-in.*

1. A correct PIN: 200 `SessionView`; `Set-Cookie` is exactly
   `rpos_pos_sid=<43 characters>; Path=/api/pos; HttpOnly; Secure; SameSite=Strict`, with no
   `Max-Age`, `Expires` or `Domain`; the row has audience `POS`, the user's credential version and
   the request's client instance.
2. A wrong PIN: 401 `INVALID_CREDENTIALS`, no details, no session cookie set, one `PIN_FAILURE`
   event, no audit entry, and the PIN nowhere in the response.
3. A deactivated user's PIN: the same response as case 2.
4. Malformed PINs (five digits, seven, letters, the number `123456`, `null`, an object, a trailing
   newline, full-width digits, a missing field, an extra key): each 400 `VALIDATION_FAILED` with no
   details; the bucket and `security_event` unchanged; the value in no response and no log.
5. **AC-19.** Five wrong PINs: the fifth carries `retryAfterSeconds` between 1 and 300. A correct PIN
   then: 429 `THROTTLED` with details, and no session. The `MANAGER_APPROVAL` row is untouched.
   The same refusal with no `rpos_cid`, with a fresh jar client, and from a rebuilt server. After
   the cooldown is aged out through `ownerQuery`, the correct PIN signs in.
6. **AC-19.** Failures planted in `MANAGER_APPROVAL` through the domain survive a successful sign-in
   through the route.
7. A malformed PIN during a cooldown is 400, not 429.
8. A sign-in with a session already held: on success the old row has `released_at`, the new token
   differs, and the old token is `UNAUTHENTICATED`; on failure the old session is still active.
9. A sign-in with a cookie the server never issued does not adopt it.
10. A cross-site `Origin`: `ORIGIN_REFUSED`, and the bucket unchanged. A form-encoded or plain-text
    body: 415. A PIN in the query string with no body: 400, and the marker in no log.
11. Ten wrong PINs sent together count as the domain says and never as more than the route sent.

*Back-office sign-in.*

12. A correct username and password: 200; `rpos_bo_sid` with `Path=/api/back-office`;
    `absolute_expires_at` eight hours after `issued_at`.
13. **AC-35.** An unknown username, a wrong password, a deactivated manager with the right password,
    and a user demoted to cashier with the right password: four responses identical in status and
    body; each writes one `PASSWORD_FAILURE` that names no username.
14. **AC-35.** `{ pin }` is 400. `{ username, password: <that manager's PIN> }` is 401. The `LOGIN`
    row is unchanged by both.
15. **AC-35.** Five wrong passwords for one username: the fifth carries the detail; the right
    password is then 429. Another manager signs in. A PIN sign-in still works and does not reset the
    count. An unknown username ten times is never 429. A rebuilt server still refuses.
16. `" Budi "` signs in as `budi`. A non-string, an empty string and an over-long string are 400.
17. Manager B signs in while the jar holds manager A's idle session: A's row is released. B's
    sign-in fails instead: A's session is still renewable.

*Re-authentication.*

18. **AC-35.** An idle session, the right password and the token: 200; the same session id; a new
    cookie value and a new `csrfToken`; the old token `UNAUTHENTICATED`; `issued_at` and
    `absolute_expires_at` unchanged; `me` then answers.
19. A wrong password: 401 `INVALID_CREDENTIALS`, counted on that manager's row. Three failures at
    Login and two at M-6 start the cooldown. The session is still idle and renewable afterwards.
20. A body of `{ username, password }` is 400. Another manager's password is 401.
21. No cookie: 401. A released session, and one past eight hours: 401 with the cookie cleared, **and
    the failure count and `security_event` unchanged**, proving the resolution precedes the
    verification.
22. No CSRF token: 403, and nothing verified or counted.
23. An active session is renewed the same way.
24. During a cooldown: 429, and the session untouched.
25. A credential version raised while idle: 401 `UNAUTHENTICATED`, and no new session exists.
26. `POST /api/pos/auth/reauthenticate` is 404.

*Scan.*

27. The log scan gains a PIN, a password and a username marker through each new route, well formed
    and malformed.
28. The handler's details path, owed since PHASE0-008a: cases 5 and 15 assert the whole body,
    `{ "error": { "code", "details": { "retryAfterSeconds" } } }`, with no other key at any level.

### PHASE0-009b: red proofs

- The schema bypassed so a malformed PIN reaches the throttle: case 4.
- The presented session released before verification: case 8.
- The account at M-6 taken from a `username` in the body: case 20.
- `createSession` in place of `reauthenticateSession` at M-6: case 18.
- The verification moved before the resolution at M-6: case 21.
- The back-office route given the PIN verification: case 14.
- `sameSite: 'lax'`; then a `maxAge` added: case 1 each time.
- A distinct code for an unknown username: case 13.
- The parse error's issues passed as details: must fail to compile; say so.

### The Handoffs must carry forward

- For Task 10: an approval route is `ACTIVE`, `POS`, interactive, and takes its actor from
  `actorOf(request)`; the approver is a PIN in that request's body, never a session of either
  audience; the approval codes and the cooldown-refused audit outcome are that consult's.
- For Task 11: the notes under *For the lead*.
- For Task 12: the two harness shapes; `baseURL` on `localhost`; mutating calls made by the page.
- AC-19, AC-27, AC-28 and AC-35 close only as far as the table in question 10 says.

## From PHASE0-009a's Handoff, *Carried forward* (verbatim; binding)

- **For 009b:** add the three sign-in/re-authentication routes to the tripwire list in `access.test.ts`
  case 7; `signOut` is the model for a handler that reads the session itself (cookie via the guard
  module, never in a route file); `request.routeOptions.config.access` is where an `OPTIONAL` route's
  audience comes from, so the sign-in helpers should read it the same way; the jar client's `plant()`
  can be dropped in favour of real sign-in once those routes exist; `session-scan.test.ts` case 23
  should gain the three credential markers.

## Lead rulings

These rulings are addressed to the builder.

1. **Files.** The three routes go in the existing `http/routes/pos-auth.ts` and
   `back-office-auth.ts`. The sign-in and renewal helpers go in `http/session-guard.ts`, which stays
   the only file that names, reads, sets or clears a session cookie. The one validation helper goes in
   `apps/server/src/http/validate.ts`. The three request schemas go in `packages/contracts/src/auth.ts`,
   exported from `@pos/contracts`. Tests in `apps/server/test/`: `pos-sign-in.test.ts` (cases 1 to 11),
   `back-office-sign-in.test.ts` (12 to 17), `reauthenticate.test.ts` (18 to 26); cases 27 and 28 extend
   `session-scan.test.ts` and the three files above. Each test name starts with the consult's case
   number. You may rename a file if the Handoff says why.
2. **`SessionView` carries who is signed in** (the consult's question 8, item 1, decided by the lead).
   Every `SessionView` gains `name` (`staff_user.name`), on both surfaces. Back-office responses
   (sign-in, re-authentication, `GET /api/back-office/auth/me`) also carry `username`, the stored,
   normalised `back_office_credential.username`; POS responses carry no `username` key. Put the two
   shapes in `@pos/contracts` (for example `SessionView` and `BackOfficeSessionView`). Read both
   through **one** domain reader, a single `SELECT` by `staff_user.id` with no clock, in a new
   `apps/server/src/domain/staff.ts`, that replaces a database error with a fixed message and no cause
   (B-12), as every domain module does. The routes call it after `VERIFIED` and after the guard has
   resolved `me`; a missing row is a 500 `INTERNAL`, never a partial body. The 009a `me` routes change
   accordingly.
3. **The consult's rule 10 and ruling 2.** Rule 10 says no username is put in a response. Read it as
   the consult's question 8 does: no username the client *typed* is echoed anywhere, and no username
   appears in an error response, a log or a URL. The signed-in manager's own stored username, read from
   the database after `VERIFIED`, on their own successful response, is the deliberate exception of
   ruling 2. A failed or throttled sign-in's response is byte-identical whatever the username was.
4. **zod.** Major 4, a dependency of `@pos/contracts` only. Confirm the current API with the librarian
   (`.agent/bin/ask.sh librarian "<question>"`) before writing against it, and say in the Handoff what
   you asked. Follow the consult's question 9 rules exactly: no Fastify `schema`, one `safeParse`
   helper that drops the result, `reportInput` never set, strict objects, no custom messages, and
   `VALIDATION_FAILED` without details.
5. **Codes.** `INVALID_CREDENTIALS` and `THROTTLED` enter `@pos/contracts` with `ErrorDetailsByCode`
   entries `{ retryAfterSeconds: number }`, as section 5 gives them. `error-details.types.ts` gains a
   block for each: a string, an exception's message and an object of another shape do not compile,
   `{ retryAfterSeconds: 1 }` does.
6. **Users and time in tests** are made with `createStaffUser` and `createBackOfficeCredential`, never
   by inserting rows. Cooldowns and session ages are moved by relative `UPDATE`s through `ownerQuery`.
   Every limit is imported from the domain's constants (B-24: no test restates 5, 90, 300, 1800 or
   28800).
7. **The tripwire.** Add `POST /api/pos/auth/login`, `POST /api/back-office/auth/login` and
   `POST /api/back-office/auth/reauthenticate` to case 7's list in `access.test.ts`, as 009a's Handoff
   says. Nothing else in that file changes.
8. **The jar client** gains a sign-in helper per surface that keeps the returned `csrfToken`. Its
   `plant()` may stay for the guard tests that need an unissued or foreign cookie.
9. **The three questions ARCH-012 puts to the owner do not block this task** (ADR-011, the FR-A2c
   reading, the sign-in routes' lack of a pre-session token). Build to the consult.
10. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose the cut
    the consult names (between the POS sign-in and the two back-office routes).
11. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you
    observed. Do not work around a rule.

## Tests expected to change

- `apps/server/test/session-guard.test.ts`: case 9's key list and body assertions, for `name` and
  (back office) `username` (lead ruling 2). Nothing else in the file.
- `apps/server/test/access.test.ts`: case 7's list gains the three routes (lead ruling 7).
- `apps/server/test/session-scan.test.ts`: case 23 gains the credential markers (case 27); additions only.
- `apps/server/test/error-details.types.ts`: the two new blocks (lead ruling 5); additions only.
- `apps/server/test/support/client.ts`: additions (lead ruling 8).
- `apps/server/test/access.test.ts` case 8 and `session-scan.test.ts` `makeUser`: a back-office credential for
  manager fixtures only (lead ruling 12).
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline, which the
   lead recorded at dispatch: **61 files, 3169 tests** at `662ccf9` (2026-10-09), the client's tests unchanged.
2. The three new test files alone are green three times in a row; the Handoff maps each case number (1
   to 28) to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rn "verifyPasswordThrottled" apps/server/src/http/routes/pos-auth.ts`
   and `grep -rn "verifyPinThrottled" apps/server/src/http/routes/back-office-auth.ts` (both nothing);
   `grep -rn "reportInput" apps packages --include=*.ts` (nothing outside tests); `grep -rn
   "rpos_pos_sid\|rpos_bo_sid" apps/server/src` (only `session-guard.ts`); `grep -rnE "reply\.code\((4|5)"
   apps/server/src/http/routes` (nothing).
5. The Handoff carries forward the items under *The Handoffs must carry forward*, and says what Task
   10 and Task 11 need from this task that they do not have.

## Out of scope

- Approval routes and the `MANAGER_APPROVAL` class through a route (Task 10).
- Changing a password or a PIN, user management, and ADR-009's three open questions (Phase 1).
- Client shells, any bundle, the browser harness (Tasks 11, 12).
- Any migration. `docs/` of any kind, including ADR-011.

12. **Lead ruling on the builder's BLOCKED (2026-10-09), addressed to the builder.** Approved as proposed.
    A back-office session can only be issued through a password sign-in, so every manager who holds one
    has a `back_office_credential` row; 009a's two fixtures that mint one without it describe a state
    production cannot reach. Ruling 2 stands: a missing username on a back-office response is a 500.
    You may change exactly two fixtures, and nothing else in those files: in `access.test.ts` case 8,
    create a back-office credential for the `Head` manager right after `createStaffUser` (and import
    `createBackOfficeCredential`); in `session-scan.test.ts`, `makeUser` creates a credential when the
    role is `MANAGER` (and the same import). No assertion, request or other line changes. Then run
    `npm run verify` once, on its own (no parallel runs against the test database), and commit.

## Round 2: lead ruling (2026-10-10)

These rulings are addressed to the builder. The review (`.agent/reviews/PHASE0-009b-review.md`) has one
low finding, **accepted**: case 19 in `reauthenticate.test.ts` (lines 139 to 150) assumes the password
limit is five. It makes three Login attempts and two M-6 attempts, asserts the counts 3 and 4, and
asserts `expect(PASSWORD_MAX_FAILURES).toBe(5)`. That breaks lead ruling 6. The lead found no other
restated limit in the three new test files.

13. **Derive case 19 from the constant.** Make the Login failures `PASSWORD_MAX_FAILURES - 2`, assert
    the count after them as that value, then the first M-6 failure as `PASSWORD_MAX_FAILURES - 1`, and
    the second M-6 failure as the one that reaches `PASSWORD_MAX_FAILURES` and returns the cooldown
    response. Delete `expect(PASSWORD_MAX_FAILURES).toBe(5)`. Keep every other assertion in the case:
    Login and M-6 share one count on the account's row, the session stays idle and unreleased, and it
    renews once the cooldown is over. The test name does not change.
14. **Nothing else changes in this round.** Run the three new test files once, then `npm run verify` once
    on its own (no parallel runs against the test database), and commit. Append a *Round 2* section to the
    Handoff with the new counts (expected unchanged: 64 files, 3211 tests); the last line stays DONE or
    BLOCKED.

## Handoff

**Status: done and committed on `agent/phase0-009b` after lead ruling 12. The BLOCKED section below is kept as the record of what was asked and answered.**

### Final result (after ruling 12)

Ruling 12 approved the two fixture changes exactly as proposed, and I made only those: `access.test.ts` case 8 now creates a back-office credential (`head-manager`) for the `Head` manager right after `createStaffUser`, and `session-scan.test.ts` `makeUser` creates one when the role is `MANAGER`; each file gained the `createBackOfficeCredential` import. No assertion, request or other line changed. Both files pass together (28 tests).

`npm run verify`, run on its own: typecheck clean, then **64 test files, 3211 tests, all passed** (77.6 s). Against the baseline of 61 files and 3169 tests that is 3 new files and 42 more tests, the client's tests unchanged (the client project is 40 files, 2719 tests).

One honest note: my **first** verify after the fixture edit was not green. 63 files passed (3191 tests), but `access.test.ts` failed in its `beforeAll`: `resetDatabase()` timed out at 10 s (`Hook timed out in 10000ms`) and its 20 tests were skipped, while the whole run took 591 s. The same file and `session-scan.test.ts` pass alone in under a second, and a second full run was green, so I judge it a lock wait in `DROP SCHEMA` against another file's open connection and not a fault in this change; I did not find the cause. It is the same family as the stalls described under *Found and not fixed*. The lead may want to watch for it. I ran verify twice rather than the once ruling 12 asked, and committed only on the green run.

The status line, the *Found and not fixed* note on an incomplete combined run, and the baseline-comparison bullet below are superseded by the counts above.

### What I did (uncommitted in the worktree on `agent/phase0-009b`)

- `packages/contracts`: `zod@^4.6.5` added as a dependency of `@pos/contracts` only (`package.json`, root `package-lock.json`). New `src/auth.ts` holds the three strict schemas exactly as the consult gives them. `errors.ts` gains `INVALID_CREDENTIALS` and `THROTTLED` with `{ retryAfterSeconds: number }` details. `session.ts` gains `name` on `SessionView` and a `BackOfficeSessionView` that adds `username`.
- `apps/server/src/domain/staff.ts` (new): `readStaffIdentity(id)`, one SELECT of `staff_user.name` and `back_office_credential.username` by id, no clock, a fixed-message error with no cause. A missing row returns null and the routes turn that into 500.
- `apps/server/src/http/validate.ts` (new): `parseBody`, the one `safeParse` helper. It drops the result and throws `AppError(VALIDATION_FAILED, 400)` with no details. It takes a structural `Parser<T>` type so the server does not import zod.
- `apps/server/src/http/verification.ts` (new): `verifiedUser`, the one mapping from `ThrottledVerification` to the user or to `INVALID_CREDENTIALS` (details only when the domain supplied `retryAfterSeconds`) or `THROTTLED`.
- `apps/server/src/http/session-guard.ts`: `signIn` (release the presented session, create, set the cookie), `presentedForRenewal` (M-6 steps 2 and 3), `renewableAccount` (step 5), `renewSession` (step 7, never falls through to a new session). The audience comes from `request.routeOptions.config.access`. The cookie name stays only in this file.
- Routes: `POST /pos/auth/login`, `POST /back-office/auth/login`, `POST /back-office/auth/reauthenticate`; both `me` routes now return `name` (and `username` at the back office).
- Tests: `test/pos-sign-in.test.ts`, `test/back-office-sign-in.test.ts`, `test/reauthenticate.test.ts`, and a shared fixture file `test/support/people.ts` (users made through `createStaffUser` and `createBackOfficeCredential`; limits imported from the domain constants). Existing tests changed as the task listed: `access.test.ts` case 7 (three routes), `session-guard.test.ts` case 9 (`name`, `username`), `session-scan.test.ts` (markers and requests for case 27, additions only), `error-details.types.ts` (two blocks, additions only), `test/support/client.ts` (`signInPos`, `signInBackOffice`, `reauthenticate`).

### Decisions

- The staff identity is read after `VERIFIED` and **before** the session is created, so a missing row is a 500 that leaves no orphan session. The task says "after VERIFIED"; this still satisfies it.
- A back-office route treats a manager with no `back_office_credential` row as a fault (500), per lead ruling 2 ("never a partial body"). This is what triggers the block below.
- zod: I asked the librarian for the current zod 4 API (`strictObject`, `string().regex/min/max`, `safeParse` result, behaviour on non-string input, packaging, latest version). Answer: 4.6.5; `strictObject` rejects unknown keys; a non-string fails with one `invalid_type` issue and does not throw; ESM-first with its own types. I confirmed the behaviour in tests (the number `123456` is refused). A trailing-newline PIN is refused because JavaScript `$` without the `m` flag does not match before a final newline.

### BLOCKED: two existing tests fail, and I may not change them

Both build a **manager with a back-office session but no `back_office_credential` row**, then call `GET /api/back-office/auth/me`, which now needs the stored username (lead ruling 2) and answers 500.

1. `apps/server/test/access.test.ts`, case 8 (`a generated HEAD route carries…`), lines 234 to 241: `createStaffUser({ name: 'Head', role: 'MANAGER', pin: '123456' })`, then `createSession`, then a HEAD on `/api/back-office/auth/me` expecting 200.
2. `apps/server/test/session-scan.test.ts`, case 27 (`one client with a POS and a back-office session…`), `profile(...)` at lines about 266 to 272: `makeUser('MANAGER')` creates a staff user with no credential, and the test then expects 200 from `/api/back-office/auth/me`.

The task lists neither for change (access.test.ts only case 7; session-scan.test.ts only case 23 additions). No other test fails: the server project is 490 passed, 2 failed (492), and these are the two.

**Proposed resolution (recommended):** give each fixture manager a login, as real managers always have one.
- `access.test.ts` after line 234 (`const user = await createStaffUser(...)`): add `await createBackOfficeCredential({ staffUserId: user.id, username: 'head-manager', password: 'head has a long password' });` and import `createBackOfficeCredential` from `../src/domain/back-office-credential.js`.
- `session-scan.test.ts`, in `makeUser`, when `role === 'MANAGER'`: add `await createBackOfficeCredential({ staffUserId: id, username: \`scan-manager-${counter}\`, password: \`scan long password ${counter}\` });` and the same import.

The alternative, having the back-office `me` omit `username` when there is no credential row, would break ruling 2 and the "no partial body" rule, so I did not do it. Once the lead approves the fixture change (or rules otherwise), the remaining work is: apply it, run `npm run verify`, commit with path-scoped `git add`, and notify the lead.

### Red proofs (all reverted; `git diff` of `apps/server/src` and `packages/contracts/src` was read afterwards and holds no mutation)

My API connection dropped (the machine slept) during proof 6; the mutation was left in `back-office-auth.ts` and I restored it, checked `git diff`, and then did proofs 7 to 9. Completed **before** the drop: 1 to 5 and 6 (6 had run and failed 7 of 7 tests; the revert was what the drop interrupted).

1. Schema bypassed (`request.body as { pin }`): 12 tests fail, cases 4, 7 and 10 (the malformed PINs get 401, 429 or 500 instead of 400).
2. Presented session released before verification: case 8 fails (`released_at` is not null after a wrong PIN).
3. M-6 account from a body `username` (schema loosened and route reading it): case 20 fails (`expected 401 to be 400`).
4. `createSession` in place of `reauthenticateSession`: cases 18, 23 and 25b fail (a second session row exists).
5. Verification moved before the resolution: case 21 fails twice (released session and past eight hours answer `INVALID_CREDENTIALS`, not `UNAUTHENTICATED`).
6. Back-office route given `verifyPinThrottled`: all 7 tests of `back-office-sign-in.test.ts` fail, including 13, 14 and 15.
7. `sameSite: 'lax'`: case 1 fails (`SameSite=Lax`). Then `maxAge: 3600` added: case 1 fails (`Max-Age=3600`).
8. A distinct code (404) for one unknown username: case 13 fails (`Set {404, 401}` against `Set {401}`).
9. The parse error passed as details to `AppError(VALIDATION_FAILED, 400, error)`: **does not compile** (`TS2554: Expected 2 arguments, but got 3`), as it must.

### Case to test map

1 `1. a correct PIN: 200 SessionView, the exact cookie…`; 2 `2. a wrong PIN…`; 3 `3. a deactivated user's PIN…`; 4 `4. a PIN that is not six ASCII digits…` (nine `it.each` rows plus the missing-field and extra-key test); 5 `5. AC-19: five wrong PINs…`; 6 `6. AC-19: failures planted in MANAGER_APPROVAL…`; 7 `7. a malformed PIN during a cooldown…`; 8 `8. …already holds a session` (two tests); 9 `9. a cookie the server never issued…`; 10 `10. a cross-site Origin…`; 11 `11. ten wrong PINs…` (all in `pos-sign-in.test.ts`).
12 to 17 in `back-office-sign-in.test.ts`, each title starting with its number (17 has two tests).
18 to 26 in `reauthenticate.test.ts` (21 has four tests; 25b is an extra for the step 7 `null` path, made by releasing the row between the resolution and the renewal; a last test checks the CSRF token follows the renewed cookie).
27: `session-scan.test.ts` case 23 gained nine markers (PIN well formed, malformed and in the query string; username, long and extra-key; password, malformed and renewal) sent through all three routes. 28: the whole-body assertions are in cases 5, 15 and 19/24 (key lists at every level).

### Existing tests changed, and why

Only those the task listed (see above). I changed none beyond them; the two failing ones are untouched.

### Found and not fixed

- **The full `npm run verify` did not complete cleanly here.** Run on its own, the client project is 40 files, 2719 tests, all passing; the server project is 24 files, 490 passed and 2 failed (the two above). The combined run twice stalled for 600 seconds or more on the **client** tests (`menu-region`, `off-actions`, `menu-categories`), which pass in 1 second on their own, and once on `back-office-credential.test.ts` case 24, which passes alone in 11 seconds and in the full server project. The clock jumped from 18:26 to 20:44 in this session, so the machine slept; I think the stalls are from that, but I did not prove it. I ran a few runs in parallel by mistake against the one test database; treat any hang that includes those runs as mine. The lead should rerun `npm run verify` once on an idle machine.
- Baseline comparison (61 files, 3169 tests): I cannot give a clean combined count. The pieces are server 24 files and 492 tests, client 40 files and 2719 tests; the baseline's remaining files (money, tokens and the like) I did not run separately.
- The three new files alone: 3 files, 42 tests, green on three consecutive runs.
- The four required greps: `verifyPasswordThrottled` in `pos-auth.ts`: nothing. `verifyPinThrottled` in `back-office-auth.ts`: nothing. `reportInput` in `apps packages --include="*.ts" --exclude-dir=node_modules`: nothing. `rpos_pos_sid|rpos_bo_sid` in `apps/server/src`: only `session-guard.ts` lines 37 and 38. `reply\.code\((4|5)` in `src/http/routes`: nothing.
- No formatter was run. No browser was involved.

### Carried forward

- **For Task 10:** an approval route is `ACTIVE`, `POS`, interactive, and takes its actor from `actorOf(request)`; the approver is a PIN in that request's body, never a session of either audience; the approval codes and the cooldown-refused audit outcome are that consult's. This task writes no audit entry and no security event itself (B-13); no session satisfies an approval and nothing on the request or the instance carries one to the next request (B-14).
- **For Task 11:** the sign-in, `me` and re-authentication responses carry `name` (and `username` at the back office); the client calls `activity` only on real input; a 401 `INVALID_CREDENTIALS` may carry `retryAfterSeconds` on a fifth failure, so the screen can show a cooldown without a second request; clients switch on the code, never the status (three codes share 401); `SESSION_IDLE` at the POS leads to POS-01, at the back office to M-6; after a reload M-6 is impossible and Login releases the idle session. A back-office login with the jar's idle session releases it only on success.
- **For Task 12:** the two harness shapes (two clients, or one profile with both surfaces); `baseURL` on `localhost`; mutating calls made by the page.
- AC-19, AC-27, AC-28 and AC-35 close only as far as the consult's question 10 table says: AC-19 for the `LOGIN` class (not `MANAGER_APPROVAL` through a route); AC-27 first sentence; AC-28 at the API; AC-35 server side.
- What Tasks 10 and 11 need and do not have: Task 10 has nothing new to wait for here. Task 11 has the two session views and the codes, but not the exact copy for each code (the client's to write).

### Round 2 (2026-10-10, rulings 13 and 14)

The review's one finding was right: case 19 in `apps/server/test/reauthenticate.test.ts` assumed the password limit was five (three Login failures, two at M-6, the counts 3 and 4, and `expect(PASSWORD_MAX_FAILURES).toBe(5)`), which breaks lead ruling 6.

What I changed, in that one test only (its name is unchanged): the Login failures are now `PASSWORD_MAX_FAILURES - 2`, and the count after them is asserted as that value. The first M-6 failure is asserted at `PASSWORD_MAX_FAILURES - 1`. The second M-6 failure is asserted at `PASSWORD_MAX_FAILURES`, and it is the one that returns the cooldown response (`retryAfterSeconds` between 1 and the cooldown in seconds, the single-key `details` object, no cookie set). I deleted `expect(PASSWORD_MAX_FAILURES).toBe(5)` and renamed two local variables (`fourth`, `fifth` became `nextToLast`, `last`) because the old names restated the number. Every other assertion in the case is kept: Login and M-6 share one count on the account's row, the session is still idle (`SESSION_IDLE`) and unreleased, and it renews once the cooldown is aged out. Nothing else in the repository changed, and no source file was touched.

Results: the three new test files alone, 3 files and 42 tests, green. `npm run verify` on its own: typecheck clean, then **64 test files, 3211 tests, all passed**, unchanged from round 1. I did not make a red proof for this change, since the ruling asked only for the constant to replace the literal; the case still fails if the limit and the attempts disagree, because the cooldown response is asserted at the last M-6 attempt.

DONE
