---
id: PHASE0-009a
title: Route access declarations, the session guard, and the routes that need a session
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-008b]
owns: [apps/server/**, packages/contracts/**, package.json, package-lock.json]
status: review
cycles: 0
---
# PHASE0-009a — Route access declarations and the session guard

**Written** 2026-10-09 by the lead, from the architect consult ARCH-012
(`.agent/reviews/ARCH-012-auth-routes.md`, by `architect12`, 2026-10-09), which supersedes plan
Task 9 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:2316-2729`). Do not copy anything
from plan Task 9; section 1 of the consult lists every line of it that is wrong. This is the first
half of the split: this task builds what a request must present to reach a route. PHASE0-009b
builds the routes that take a credential (sign-in and re-authentication) and is not part of this
task. The consult's binding sections are copied below **verbatim**, with their headings moved down
one level; the numbered "questions" they refer to are the consult's sections (question 2 is
section 2, and so on). Touches identity and B-13/B-14: the owner looks before merge.

## Objective

Every route under `/api` declares, in `config.access`, whether it needs no session, manages a
presented session itself, or requires an active session of one audience with an explicit
`interactive` flag; a route that does not declare, declares wrongly, or sits outside the API
context stops the server at startup. One guard in the API context enforces the declaration: it
reads only the declared audience's path-scoped cookie, checks the derived anti-CSRF token before
resolving on every mutating request, refuses idle and unknown sessions with distinct codes,
requires the manager role on every back-office request, and sets `request.actor`. Six routes use
it: `GET /api/pos/auth/me`, `POST /api/pos/auth/activity`, `POST /api/pos/auth/release`,
`GET /api/back-office/auth/me`, `POST /api/back-office/auth/activity` and
`POST /api/back-office/auth/logout`. When this task is done the
test cases below prove every rule through `inject()` against the real tables as `pos_app`, with
sessions minted by the domain's `createSession`; no credential is verified anywhere in this task.

## Required inputs

- **PHASE0-008a and 008b as merged** (read both task files' Handoffs in `.agent/tasks/`):
  `buildServer({ origin, logLevel, tls?, logStream?, apiRoutes? })`, the `/api` context and its
  hooks (`no-store`, the origin guard, the client-instance hook), `AppError`, `StartupError`,
  `@pos/contracts`'s `ErrorCode` and `ErrorDetailsByCode`, `request.clientInstanceId`, and the log
  rules (no header, cookie or body is ever handed to the logger). 008b's Handoff, *Carried forward*,
  item "Task 9", is binding here.
- **Built domain** (`apps/server/src/domain/session.ts`): `Audience`, `SESSION_POLICY`,
  `createSession({ audience, user, clientInstanceId })` returning `IssuedSession { token, sessionId }`,
  `resolveSession(token, audience, interactive)` returning `SessionResolution` (`ACTIVE` with
  `staffUserId` and `role`, `IDLE` with no role, `NONE`), `releaseSession(token, audience)`.
  `StaffRole` and `createStaffUser` are in `pin.ts`; `createBackOfficeCredential` is in
  `back-office-credential.ts`. Migration `0003` holds `actor_session` (`last_interactive_at`,
  `issued_at`, `absolute_expires_at`, `released_at`, `credential_version`).
- **Test support:** `inject(app, …)`, `TEST_ORIGIN`, `TEST_HOST` (`test/support/request.ts`);
  `ownerQuery`, `resetDatabase` (`test/support/database.ts`). Never `app.inject` directly: the Host
  check refuses it.
- **Contract:** PRD FR-A2, FR-A2b, FR-A2c, FR-A7, AC-27, AC-28; `docs/ARCHITECTURE.md` §7.2, §13;
  ADR-009 §1, §6; ADR-010 (accepted; the six rules); `docs/BOUNDARIES.md` B-12, B-13, B-14, B-24.
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time and goes stale after a lock
  wait; any statement you add that reads the clock uses `clock_timestamp()`. This task should need
  no SQL of its own.

## From ARCH-012 (verbatim; binding)

### 2. The two session cookies

#### Names and attributes

| | POS | Back office |
|---|---|---|
| Name | `rpos_pos_sid` | `rpos_bo_sid` |
| Value | `IssuedSession.token` | `IssuedSession.token` |
| `Path` | `/api/pos` | `/api/back-office` |
| `HttpOnly`, `Secure`, `SameSite=Strict` | yes, the literals | yes, the literals |
| `Domain` | never | never |
| `Max-Age`, `Expires` | never | never |

Both names are on the `rpos_` stem and differ from each other and from `rpos_cid`, as ADR-010 rule 3
requires. `rpos_cid` keeps `Path=/`: it describes the browser profile (§3.1).

#### Path scoping, not `__Host-`

ADR-010 left this to be chosen deliberately. I choose path scoping, for four reasons.

- **`__Host-` protects against things this origin does not have.** It makes a browser refuse a
  cookie that carries a `Domain` or was set over an insecure connection. Its purpose is to stop a
  sibling subdomain or a plain-HTTP page from planting a cookie. It does not separate ports
  (librarian), so it does nothing about the one real exposure here, the shared `localhost` jar the
  owner accepted. Another local server can set a `__Host-` cookie of the same name as easily as
  any other.
- **Path scoping does something on every request.** The POS token is not sent to a back-office
  route, to either bundle, or to any path outside `/api/pos`; and likewise the other way. A token
  that is not transmitted cannot be logged, mishandled or read by the wrong handler. It also
  narrows what a neighbouring `localhost` server is sent: only a request to a path under
  `/api/pos` on that server would carry the POS token.
- **It makes AC-27 structural as well as checked.** A back-office route never receives the POS
  cookie at all. The audience clause in `resolveSession` remains the control; the path means the
  wrong token is not even present to be judged.
- **The two cannot be combined.** `__Host-` forces `Path=/`.

*What path scoping costs.* A route outside both surface paths receives neither cookie. That is the
subject of the next heading. And a neighbouring server can plant a same-name cookie on a longer
path, which a browser would send first. `__Host-` would not prevent the equivalent attack (it can
overwrite the `Path=/` cookie outright), so nothing is lost; the guard's answer is below.

*`__Secure-`* (which permits a path) was considered. It adds only "set over a secure connection",
which `Secure` on this origin already implies for our own cookie, and Chrome allows `Secure`
cookies from `http://localhost` anyway. Not taken.

#### No route accepts either cookie

FR-A2c says "shared read routes **may** accept either". ARCHITECTURE §13 already has no shared
surface: print incidents, the one read both clients make, are listed at `/api/pos/printing/…` and
at `/api/back-office/printing/…`, and the section says the two surfaces "may expose different
projections of the same underlying data, but they call the same application services".

So a shared read is **one handler registered under both surfaces**, each registration declaring its
own audience. The declaration (question 4) has no "either" value. This removes a question that an
either-audience route would otherwise have to answer on every request, namely which cookie wins
when a browser profile holds both, and with it the temptation to pick by a header.

This uses a permission the PRD grants and does not require. It is recorded for the owner as a
reading.

#### Lifetime

**Neither cookie has a `Max-Age` or an `Expires`.** The server decides when a session ends: 90
seconds idle at the POS; 30 minutes idle and 8 hours absolute at the back office
(`SESSION_POLICY`, FR-A2, FR-A2b). A cookie attribute cannot enforce any of that and should not
pretend to.

- A `Max-Age` equal to the policy would write the policy's numbers in a second place
  (`session.ts:7` says they "exist nowhere else"), and would be wrong after an M-6 renewal, where
  the eight hours keep running from the original sign-in and the renewal does not return what is
  left.
- A `Max-Age` is a statement about the browser's clock, which §14.4 says is never an authority.
- A session cookie normally goes when the browser closes, which suits a shared device. Where
  session restore keeps it (Chrome), the token is presented again and the server judges it as it
  judges any other. POS-01's "no remember me, no stay-signed-in" is a property of the 90 seconds,
  not of the cookie.

#### Setting, clearing, and the one module that does either

One module, `http/session-guard.ts`, is the only code that names the two cookies, reads them, sets
them or clears them. It picks the cookie from the route's declared audience and from nothing in the
request (§7.2). Handlers never touch a cookie; a source scan proves it.

**Reading.** The guard reads the raw `Cookie` header and counts the occurrences of the one name the
route's audience selects. Exactly one is a presented token. None, or more than one, is no session.
A repeated name means something else has written into the jar; refusing is the only answer that
does not depend on which copy a parser happens to return.

**Setting.** Only a verified sign-in and an M-6 renewal set a session cookie, each with a token the
server has just generated. The server never adopts a value the client presented.

**Clearing.** A cookie is cleared, with the same `Path` and attributes it was set with, whenever its
token can never be accepted again:

| Event | Cookie |
|---|---|
| Release (POS) or logout (back office) | cleared, always, whatever the session's state |
| A guarded route resolves `NONE` (released, past the absolute limit, user deactivated, credential version changed, unknown, malformed, wrong surface) | cleared on the 401 |
| A guarded POS route resolves `IDLE` | cleared on the 401. The POS has no renewal, so an idle POS token is dead |
| A guarded back-office route resolves `IDLE` | **kept**. M-6 needs it |
| Re-authentication finds no renewable session | cleared on the 401 |
| A sign-in fails or is throttled | untouched |
| A repeated cookie name | a clear is attempted for the surface's own path; the planted copy is on a path the server cannot know |

The session row is not marked when a cookie is cleared for expiry (ARCH-008: "an expired session is
refused, not marked").

### 3. The anti-CSRF token

#### Shape and binding

```
csrfToken = base64url( HMAC-SHA256( key = the session cookie's value, message = "rpos-csrf-v1" ) )
```

Forty-three characters, computed in `http/session-guard.ts` with `node:crypto`. It is bound to the
session by construction: it can be computed only by something that holds the session token, which
is the server and, because the cookie is `HttpOnly`, nothing in a page.

- **Nothing is stored and no secret is added.** No migration, no column, no new configuration
  value beside `PIN_PEPPER`.
- **It does not reveal the session token** (HMAC is one-way), and it is not derivable from the
  `token_hash` column, which is a plain SHA-256 of the token's bytes.
- **It rotates with the token.** An M-6 renewal issues a new token and therefore a new CSRF token,
  returned in the renewal's response.
- **It is not the client instance** and shares nothing with it.

#### Where it is issued

In the JSON body, as `csrfToken`, of exactly three kinds of response: a successful sign-in, a
successful re-authentication, and the session read (`GET …/auth/me`) of an active session. Never in
a cookie, never in a URL, never in an error. The client holds it in memory only.

Returning it from a `GET` is safe because no other origin can read the response: there is no CORS
(ADR-010 rule 4), the cookie is `SameSite=Strict`, and the origin guard refuses a cross-site read.

#### Where it is checked

By the guard, **before the session is resolved**, on every request that is not `GET` or `HEAD` and
whose route has a session:

- every route declared `ACTIVE`;
- release, logout and re-authentication, when a cookie is presented.

The request must carry exactly one `X-RPOS-CSRF` header whose value equals the token derived from
the presented cookie, compared in constant time after a length check. Otherwise 403
`CSRF_REFUSED`, with nothing resolved and nothing written. Checking first matters: an interactive
resolution moves `last_interactive_at`, and a request that fails this check must not be able to
keep a session alive.

Passing the check grants nothing. The session is still resolved, the user is still checked for
active state, credential version and role, exactly as on a read.

#### Why this and not the alternatives

- *A stored synchronizer token* (a column on `actor_session`). It works, and it costs a migration,
  a grant, a second secret to keep out of errors and logs, and an update at every renewal. The
  derived token has every property it has.
- *A double-submit cookie.* It compares a script-readable cookie with a header. In a jar that any
  local server can write to, a cookie is the wrong thing to trust.
- *A fixed custom header* (`X-Requested-With`). It forces a preflight and is not a token. §7.2 and
  ADR-010 rule 3 ask for a token bound to a session.
- *HMAC under a server secret.* It would let the token outlive nothing and bind to nothing more
  than the derived one does, and it adds a secret to manage.

#### What protects the two sign-in routes

They have no session, so there is nothing to bind a token to. **They carry no anti-CSRF token**, and
the reasoning should be recorded so that it is not later read as an omission.

What a sign-in grants, it grants because a credential in the body verified. No header, and no
passing of any guard, contributes to that (FR-A2c).

The attack a token would address is a cross-site *forced sign-in*: a hostile page makes the
victim's browser sign in as the attacker. On this server such a request is stopped three times over
by refusals already built: a cross-site HTML form cannot send JSON, and the server parses nothing
else (415); a cross-origin `fetch` with a JSON body is preflighted, and the server answers no
preflight; and the origin guard refuses any mutating request whose `Origin` is not the server's
own. The attacker would also need a valid PIN or a manager's password.

A pre-session token would have to be bound to something the attacker cannot obtain. Before a
session exists the only per-browser value the server knows is the client instance, and FR-A7 and
ADR-010 forbid anything from being granted or refused by it. The other candidate is a token signed
under a server secret and handed out by an unauthenticated route before sign-in. Anyone may ask
that route for one, so it protects only because a page on another origin cannot read the response
that carries it. That is the browser's same-origin rule, which is what the refusals above already
rest on. It would be a second mechanism, with a new secret, giving the first one's guarantee.

One property is added that costs nothing: a sign-in always issues a fresh token and never adopts a
presented one, so a planted cookie cannot become an authenticated session.

The residual risk is named in *For the owner*.

### 4. The route declaration

#### The declaration

```ts
// http/access.ts
export type RouteAccess =
  // No session cookie is read. Health; later, the lock screen's incident-presence read (C-6).
  | { session: 'NONE' }
  // The handler manages the presented session through the session module.
  // Sign-in, release, logout and re-authentication only.
  | { session: 'OPTIONAL'; audience: Audience }
  // The guard requires an ACTIVE session of this audience and sets request.actor.
  | { session: 'ACTIVE'; audience: Audience; interactive: boolean };

declare module 'fastify' {
  interface FastifyContextConfig {
    access?: RouteAccess; // optional in the type, required at startup for every API route
  }
}
```

- **`audience`** is `POS` or `BACK_OFFICE`, the domain's own type. There is no value for "either"
  (question 2).
- **`interactive`** has no default. `true` means a person did this; `false` means the page did.
  Polling, the session read and health are `false` (FR-A2b, AC-28).
- **The back-office manager requirement is not declared.** It is a property of the audience: the
  guard requires role `MANAGER` on every `ACTIVE` back-office route. A field that every
  back-office route must set to the same value is a field one route will forget. No POS route
  requires a role in Phase 0, because a manager's authority at the POS is the PIN typed at the
  moment (B-14), never the session's role. If a later phase needs a role on a POS route, the field
  is added then.
- **The anti-CSRF requirement is not declared either.** It follows from the method.

#### How a wrong route fails at startup

`buildServer` adds a root `onRoute` hook before anything is registered, and a second inside the API
context. A hook on the root sees every route in every descendant context, with its full path
(librarian). The checks, each a `StartupError` with a fixed sentence naming the method and the
route's path (both come from source, never from a request):

1. A route on an API path (`isApiPath(routeOptions.url)`) has no `config.access`, or one that is not
   exactly one of the three shapes: an unknown `session`; `ACTIVE` without a boolean `interactive`;
   a missing or unknown `audience`; any extra key.
2. A route with an audience is not under that audience's surface: `POS` under `/api/pos/`,
   `BACK_OFFICE` under `/api/back-office/`. The cookie is scoped to that path, so a route anywhere
   else would never receive it and would answer 401 for ever.
3. **An API path registered outside the API context.** The root hook records every API route it
   sees; the hook inside the context records every route registered there. Before the server is
   ready, a route in the first set and not in the second is refused. This catches a route added on
   the root instance and a second plugin registered under `/api` beside the real one, neither of
   which would have the origin guard, `no-store` or the session guard.
4. A route outside `/api` that carries `access`. It would promise a guard that does not run there.

The generated `HEAD` route copies its `GET` route's options, so it carries the same declaration and
is guarded the same way.

`ready()` and `listen()` reject, so the process never listens (ADR-010 rule 5 already puts
`listenLoopback` after `ready`).

**A tripwire in the tests.** One test lists every registered route whose `session` is `NONE` or
`OPTIONAL` and compares it with an explicit list: health, the two sign-ins, release, logout,
re-authentication. A later task that adds a route to either class has to edit that list, where a
reviewer will see it. `OPTIONAL` exists for those five routes and is not a way around the guard.

Health becomes `config: { access: { session: 'NONE' }, clientInstance: false }`.

#### The guard

One `onRequest` hook in the API context, after the client-instance hook. The order in the context
is then: `no-store`, origin, client instance, session guard. A request refused by the origin guard
never reaches it. For a route declared `ACTIVE`:

1. Read the audience's cookie. None, or the name repeated: 401 `UNAUTHENTICATED`.
2. If the method is not `GET` or `HEAD`: check `X-RPOS-CSRF`. Otherwise 403 `CSRF_REFUSED`.
3. `resolveSession(token, audience, access.interactive)`.
   `NONE`: clear the cookie, 401 `UNAUTHENTICATED`.
   `IDLE`: 401 `SESSION_IDLE`; the POS cookie is cleared, the back-office cookie is kept.
4. Back office, and the role returned is not `MANAGER`: 403 `FORBIDDEN`.
5. `request.actor = { staffUserId, role, sessionId, audience }`.

`request.actor` is decorated as `null` and is non-null only after step 5. `IDLE` is never an actor
(B-13). A handler reads the actor through a function that throws if it is null, never with `!`.
Nothing else is decorated onto the request or the instance, and nothing in `request.actor` records
an approval (B-14).

If any statement in the guard throws, the request is refused with 500 and the handler does not run.
The guard never treats a failure to resolve as a session.

For `NONE` the guard does nothing. For `OPTIONAL` it does nothing either; the handler calls the
session module's functions, which take the request and the reply and read the audience from the
route's own declaration:

- sign in: release the presented session, create one, set the cookie, return the CSRF token;
- sign out: check CSRF if a cookie is presented, release, clear;
- resolve for re-authentication, and renew: question 7.

The token is never returned to a handler.

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

### 10. Proofs and sequencing

#### Split it, as Task 8 was

- **PHASE0-009a, the declaration and the guard.** `RouteAccess`, the startup refusals, health's
  declaration, the session module (cookie names, the read, the clear, the CSRF derivation, the
  guard, sign-out), the four codes `UNAUTHENTICATED`, `SESSION_IDLE`, `FORBIDDEN` and
  `CSRF_REFUSED`, and the five routes that need a session and verify nothing: both `me`, both
  `activity`, release and logout. No request body, no zod, no credential. Its tests mint sessions
  through `createSession` and plant the cookie.
- **PHASE0-009b, the credentials.** zod and the three schemas, `INVALID_CREDENTIALS` and `THROTTLED`
  with their details, the session module's sign-in and renewal, the two sign-in routes and
  re-authentication, and the extension of the log scan.

009a is one review about what a request must present; 009b is one about what a credential may
cause. 009b depends on 009a and on nothing else. If 009b proves too large in the writing, the cut
is between the POS sign-in and the two back-office routes.

#### The two-client harness

The roadmap asks Phase 0 for a "two-client test harness running concurrent browser contexts". That
is a browser harness and belongs to Task 12, which has the bundles. What Task 9 owes it is the
API-level half, and it should be built here because the route proofs need it:

**A jar client**, `test/support/client.ts`: a small object over `inject()` that keeps the cookies a
response sets, by name and path, sends on each request only those whose path matches as a browser
would, remembers the last `csrfToken` it was given, and adds `X-RPOS-CSRF` to mutating requests.
Two clients are two browser profiles acting at once. One client holding both sessions is one
profile with the POS and the back office in two tabs. A test can then assert, on the jar, that a
back-office route was never sent the POS cookie.

For Task 12: one context with two pages (a shared jar) **and** two contexts (two actors), with
`baseURL` on `localhost`, and mutating calls made by the page so that `Origin` and the token are
the browser's own.

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

### PHASE0-009a: rules

1. Every API route declares `config.access` as one of the three shapes in question 4. `interactive`
   has no default. There is no "either" audience and no role field.
2. `buildServer` refuses, at startup and with a `StartupError`, the four cases in question 4. No
   flag disables any of them.
3. `http/session-guard.ts` is the only file that contains the strings `rpos_pos_sid` and
   `rpos_bo_sid`, and the only one under `src/http` besides `client-instance.ts` that reads or
   writes a cookie. No file under `src/http/routes` references `cookies`, `setCookie`,
   `clearCookie` or `headers.cookie`.
4. The cookie is selected by the route's declared audience. A name that appears more than once in
   the `Cookie` header is no session.
5. Cookie attributes are exactly those in question 2. A clear repeats the path and attributes.
6. The CSRF token is the derivation in question 3, compared in constant time, checked before the
   session is resolved, on every non-`GET`, non-`HEAD` request to a route with a session.
7. The guard's order is question 4's. `request.actor` is null unless the guard set it, and is read
   through a function that throws when it is null.
8. The back-office guard requires role `MANAGER` on every `ACTIVE` request, from the role the
   resolution returned.
9. A handler never writes an error body: it throws `AppError`. No route calls
   `reply.code(4xx)` or `reply.code(5xx)`.
10. A thrown error in the guard refuses the request. Nothing is ever inferred from a failure.
11. `me` is not interactive. `activity` is, and does nothing else. Release and logout answer 204
    whatever the session's state, and release an idle session.
12. No session, of either audience, records or satisfies an approval (B-14, FR-A2c).
13. The session token and the CSRF token never reach a logger, an error or a URL.
14. Existing tests keep passing unedited except `error-details.types.ts` (additions) and whatever
    asserts health's route options.

### PHASE0-009a: interface

```ts
// http/access.ts
export type RouteAccess = /* question 4 */;
export function installAccessChecks(app: FastifyInstance): { api(api: FastifyInstance): void };

// http/session-guard.ts
export interface Actor { staffUserId: string; role: StaffRole; sessionId: string; audience: Audience }
export function sessionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export function actorOf(request: FastifyRequest): Actor;
export function csrfTokenOf(request: FastifyRequest): string;        // for `me`
export function signOut(request: FastifyRequest, reply: FastifyReply): Promise<void>;

// @pos/contracts
export interface SessionView { staffUserId: string; role: 'CASHIER' | 'MANAGER'; csrfToken: string }
```

Names are illustrative; the shapes are not.

### PHASE0-009a: test cases

*Declaration and startup.*

1. An API route with no `access`: `ready()` rejects with a `StartupError` naming the method and path.
2. Each malformed declaration is refused: an unknown `session`; `ACTIVE` with no `interactive`; a
   non-boolean `interactive`; a missing audience; an unknown audience; `NONE` with an audience;
   `OPTIONAL` with `interactive`.
3. An audience that does not match the surface: `/api/pos/x` declared `BACK_OFFICE`; `/api/other/x`
   declared `POS`.
4. A fully declared API route registered on the root instance, and one inside a second plugin
   registered under `/api`, are both refused.
5. A route outside `/api` carrying `access` is refused.
6. Health declares `{ session: 'NONE' }`, still creates no client-instance row and still answers
   with a session cookie present and unread.
7. The tripwire: the routes whose `session` is `NONE` or `OPTIONAL` are exactly the listed ones.
8. A generated `HEAD` route is guarded as its `GET` is.

*The guard.*

9. An active session on `me`: 200, the four actor fields correct, `csrfToken` present.
10. No cookie: 401 `UNAUTHENTICATED`, and no `Set-Cookie` for the session cookie.
11. An unknown well-formed token, a malformed value, a released session, one past the absolute
    limit, a deactivated user, and a raised credential version: each 401 `UNAUTHENTICATED` with the
    exact clearing `Set-Cookie` (empty value, the surface's `Path`, `Max-Age=0`, `HttpOnly`,
    `Secure`, `SameSite=Strict`).
12. **AC-27.** A manager's POS token in `rpos_bo_sid` on a back-office route, and their back-office
    token in `rpos_pos_sid` on a POS route: each response equals, in status, body and `Set-Cookie`,
    the response to an unknown token; the session row's `last_interactive_at` is unchanged.
13. The cookie name twice in one header, in either order, one of them a valid token: 401, and
    nothing is touched.
14. **AC-28, limits.** POS aged to 89 seconds: 200; to 91: 401 `SESSION_IDLE` and the cookie cleared.
    Back office aged to 29 minutes: 200; to 31: 401 `SESSION_IDLE` and **no** `Set-Cookie`. Back
    office past 8 hours: 401 `UNAUTHENTICATED`.
15. **AC-28, polling.** `me` twice leaves `last_interactive_at` unchanged; `activity` moves it. A row
    aged to just inside the limit, polled, then moved a further two seconds back relative to where
    the poll left it, is `SESSION_IDLE` (PHASE0-007's case 13 explains why "relative"); the same
    with `activity` in place of the poll is still active. On both surfaces.
16. A back-office session whose user is set to `CASHIER` through `ownerQuery`: 403 `FORBIDDEN` on
    `me` and on `activity`, the cookie kept; set back to `MANAGER`: 200. The same user's POS
    session answers 200 with role `CASHIER`.
17. CSRF on `activity`: no header, a wrong value, another session's token, the client-instance id,
    and the header sent twice are each 403 `CSRF_REFUSED` with `last_interactive_at` unchanged; the
    right value is 204. A `GET` needs none.
18. The CSRF token is 43 base64url characters, differs from the cookie value and from every
    encoding of `token_hash`, differs between two sessions, and is the same on two reads.
19. Release and logout: with cookie and token, 204, `released_at` set, the cookie cleared; again,
    204; an idle session is released; with no cookie, 204 and nothing written; with a cookie and no
    token, 403 and the session not released; a POS release leaves the same user's back-office
    session alone.
20. An origin-refused request to `activity` moves nothing.
21. The session store failing inside the guard: 500 `INTERNAL`, the handler not run, no actor.
22. A miss under a surface (`GET /api/pos/nope`) is still the 404 envelope, with a session cookie
    present, unread and not cleared.

*Scans and the jar.*

23. Log scan at the most verbose level: a session token and a CSRF token sent on every route appear
    in no log line and no error body.
24. The source scans of rules 3 and 9.
25. `error-details.types.ts` has a block for each new code.
26. No new response carries `Access-Control-*` or `Strict-Transport-Security`; every one carries
    `Cache-Control: no-store`.
27. Two jar clients hold two POS sessions at once and neither displaces the other. One jar client
    holds a POS and a back-office session; the request it sends to a back-office route contains no
    `rpos_pos_sid`, and the reverse.

### PHASE0-009a: red proofs

Each mutated, run, read, reverted.

- The missing-declaration check removed: case 1.
- The outside-context check removed: case 4.
- The role check removed: case 16.
- `me` declared interactive: case 15.
- The CSRF check removed; then compared with `request.clientInstanceId`: case 17 both times.
- The CSRF check moved after the resolution: case 17 (`last_interactive_at` moves).
- `IDLE` accepted as an actor: case 14.
- The cookie cleared with the plugin's defaults: case 11.
- The repeated-name check removed: case 13. If it still passes, the parser happens to return the
  planted copy last; say so, and keep the check.

### The Handoffs must carry forward

- For Task 10: an approval route is `ACTIVE`, `POS`, interactive, and takes its actor from
  `actorOf(request)`; the approver is a PIN in that request's body, never a session of either
  audience; the approval codes and the cooldown-refused audit outcome are that consult's.
- For Task 11: the notes under *For the lead*.
- For Task 12: the two harness shapes; `baseURL` on `localhost`; mutating calls made by the page.
- AC-19, AC-27, AC-28 and AC-35 close only as far as the table in question 10 says.

## Lead rulings

1. **Files.** `apps/server/src/http/access.ts` (`RouteAccess`, the startup checks),
   `apps/server/src/http/session-guard.ts` (the cookie names, the read, the clear, the CSRF
   derivation, the guard, `actorOf`, `csrfTokenOf`, `signOut`), `apps/server/src/http/routes/pos-auth.ts`
   and `apps/server/src/http/routes/back-office-auth.ts`. Tests in `apps/server/test/`, one file per
   group: `access.test.ts` (cases 1 to 8), `session-guard.test.ts` (9 to 22) and
   `session-scan.test.ts` (23 to 27), plus the jar client at `apps/server/test/support/client.ts`.
   Each test name starts with the consult's case number. You may rename a file if a reason in the
   Handoff says why.
2. **Probe routes in existing tests.** `server.test.ts`, `client-instance.test.ts`, `origin.test.ts`
   and `log-scan.test.ts` register probe routes through `buildServer`'s `apiRoutes` with no
   declaration, and will be refused at startup once rule 2 exists. Give each probe registration
   `config: { access: { session: 'NONE' } }`, merged with any `config` it already has. Change
   nothing else in those files: no assertion, no request, no other line. The consult's rule 14 did
   not list these; this ruling adds them. If a probe needs anything other than `NONE` to keep its
   assertions true, stop and raise it.
3. **Codes.** Only the four codes this task emits enter `@pos/contracts`: `UNAUTHENTICATED`,
   `SESSION_IDLE`, `FORBIDDEN`, `CSRF_REFUSED`, none with details. `INVALID_CREDENTIALS` and
   `THROTTLED` are 009b's. `SessionView { staffUserId, role, csrfToken }` goes in `@pos/contracts`
   and is imported as `@pos/contracts`, never by path. No zod in this task: no route here takes a
   body.
4. **Sessions in tests** are minted with `createSession` for users made with `createStaffUser` (and
   `createBackOfficeCredential` where a back-office user is needed), never by inserting rows.
   Aging is a relative `UPDATE` of `actor_session` through `ownerQuery`, with the limits read from
   `SESSION_POLICY` (B-24: no test restates 90, 1800 or 28800).
5. **The three questions ARCH-012 puts to the owner do not block this task**: commissioning
   ADR-011, the FR-A2c reading (no route accepts either cookie), and accepting the sign-in routes'
   lack of a pre-session token. Build to the consult. If the owner later rules otherwise, that is a
   new task.
6. **`activity`** answers 204 with no body and does nothing but the interactive resolution. `me`
   answers 200 with `SessionView` and is not interactive.
7. **The consult says "the lead may rename" its file names.** The names in ruling 1 stand.
8. **If a rule cannot be met against the built code** (for example, a hook ordering that Fastify
   will not give, or a header set before an `AppError` that does not survive into the error
   response), stop and write `BLOCKED:` with what you observed. Do not work around a rule. The
   consult names two such unknowns under *What I verified, and what I could not*; a test decides
   each, and the Handoff says what it found.

## Tests expected to change

- `apps/server/test/server.test.ts`, `client-instance.test.ts`, `origin.test.ts`, `log-scan.test.ts`:
  the probe registrations' `config` only (lead ruling 2).
- `apps/server/test/error-details.types.ts`: a block for each of the four new codes, additions
  only (case 25).
- A test asserting health's route options, if one exists (the explorer and a grep found none).
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline of
   **58 files, 3095 tests** (the lead, at `3e46f7b`, 2026-10-09), the client's tests unchanged.
2. `access.test.ts`, `session-guard.test.ts` and `session-scan.test.ts` alone are green three times
   in a row; the Handoff maps each case number (1 to 27) to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rn "rpos_pos_sid\|rpos_bo_sid" apps/server/src` (only
   `session-guard.ts`); `grep -rnE "cookies|setCookie|clearCookie|headers\.cookie" apps/server/src/http/routes`
   (nothing); `grep -rnE "reply\.code\((4|5)" apps/server/src/http/routes` (nothing); and
   `grep -rn "now()" apps/server/src/http` (nothing).
5. The Handoff carries forward the items under *The Handoffs must carry forward*, plus anything this
   task found that 009b needs.

## Out of scope

- The sign-in routes, re-authentication (M-6), zod and the request schemas, `INVALID_CREDENTIALS`,
  `THROTTLED`, and the log-scan markers for credentials: PHASE0-009b.
- A person's name or a manager's username on `SessionView` (the consult's question 8, item 1): the
  lead decides it for 009b.
- Approval routes (Task 10), client shells and any bundle (Task 11), the browser harness (Task 12).
- Any migration. `docs/` of any kind, including ADR-011.

## Lead verification (2026-10-09)

Checked by the lead in this worktree at `9ac36c2`, before review. `npm run verify` by the lead: green,
**61 files, 3166 tests** (baseline 58 / 3095 at `3e46f7b`).

- **Paths.** Every changed file is under `owns:`. The existing tests changed are the five the task
  allows: four gained only the probe `config` (one hoisted `const config` per file is accepted), and
  `error-details.types.ts` gained four blocks.
- **Criterion 4.** The lead re-ran the four greps: the cookie names appear only at
  `session-guard.ts:32-33`, the route files hold no cookie access and no `reply.code(4xx|5xx)`. The
  `now()` grep prints `log.ts:125 Date.now()`, JavaScript's clock in a PHASE0-008 log line. The
  criterion was written for SQL `now()`, which is absent; **accepted as met**.
- **Accepted as built:** release and logout require the CSRF header whenever a cookie is presented,
  dead or not (the consult's literal reading); the jar client keeps one CSRF token per surface; case 14
  and 15 margins derived from `SESSION_POLICY` rather than the consult's literal seconds; the tripwire
  lists three routes until 009b adds its three.
- **For the reviewer:** the task touches identity and boundaries. Check the guard's order against
  ARCH-012 section 4, the clearing attributes against section 2, and that no handler reads a cookie.

## Handoff

### What I did

Built the route access declaration, the startup refusals, the session guard, and the six routes that
need a session and verify nothing, to ARCH-012 and the lead rulings. Nothing is pushed. Files:

- `apps/server/src/http/access.ts` (new): `RouteAccess`, the `FastifyContextConfig.access` augmentation,
  `installAccessChecks(app)`. A root `onRoute` hook refuses (as `StartupError`, naming method and path)
  an API route with no declaration or a malformed one (unknown `session`, `ACTIVE` without a boolean
  `interactive`, missing or unknown audience, any extra key), an audience that does not match
  `/api/pos/` or `/api/back-office/`, and a route outside `/api` that carries `access`. It records the
  API routes it sees; the hook that `.api(api)` adds inside the context records those registered
  there; an `onReady` hook refuses any route in the first set and not the second.
- `apps/server/src/http/session-guard.ts` (new): the only file naming `rpos_pos_sid` / `rpos_bo_sid`.
  Raw `Cookie` header read, counting the audience's name (none or repeated is no session); `sessionGuard`
  in ARCH-012's order (cookie, CSRF on non-GET/HEAD, `resolveSession`, manager role on back office,
  `request.actor`); `actorOf` (throws on null), `csrfTokenOf`, `signOut`, `decorateActor`. Clearing is
  `reply.setCookie(name, '', { path, maxAge: 0, httpOnly, secure, sameSite: 'strict' })`: it emits
  exactly the five attributes of case 11 (no `Expires`, no `Domain`).
- `apps/server/src/http/routes/pos-auth.ts`, `back-office-auth.ts` (new): the six routes.
- `apps/server/src/http/server.ts`: `installAccessChecks` and `decorateActor` before anything is
  registered, `access.api(api)` first in the context, `sessionGuard` as the fourth `onRequest` hook
  (after no-store, origin, client instance), the two route plugins registered. `routes/health.ts`:
  `config: { access: { session: 'NONE' }, clientInstance: false }`.
- `packages/contracts`: the four codes `UNAUTHENTICATED`, `SESSION_IDLE`, `FORBIDDEN`, `CSRF_REFUSED`
  (none with details; the doc comment's count is now "eleven") and `SessionView` (`src/session.ts`,
  exported as `@pos/contracts`).
- Tests: `test/access.test.ts`, `test/session-guard.test.ts`, `test/session-scan.test.ts`, and the jar
  client `test/support/client.ts`.

### Decisions, and the evidence for them

- **Both unknowns the consult named resolved in favour of the rules.** A header set before a thrown
  `AppError` survives into the envelope (the clearing `Set-Cookie` is on the 401, case 11), and a
  root `onRoute` hook sees every route in every descendant context with its full URL, including the
  generated `HEAD` (cases 4, 7 and 8 pass, and go red under their mutations). No rule was worked
  around.
- **Paths in `apiRoutes` are relative to `/api`.** A probe at `/api/pos/x` is registered as `/pos/x`
  (my first attempt double-prefixed it and the startup check refused it, which was a free proof of
  check 2).
- **Repeated cookie name on a guarded route:** 401 `UNAUTHENTICATED` and a clear attempt for the
  surface's own path, as the table in section 2 says. On release/logout it is 204 and a clear attempt,
  and no session is released (which copy is meant cannot be known).
- **Release/logout with a cookie present and a dead or unknown token** still need the CSRF header
  (derived from the cookie value, whatever it is). A client that lost its in-memory token cannot clear
  a dead cookie by releasing; it is cleared by the next guarded 401 instead. This follows the consult
  literally ("when a cookie is presented"); say so if you want it relaxed.
- **Case 15 margins.** The consult's literal numbers (89 seconds, then two more) leave about a second of
  slack for an HTTP round trip. I age to `idle − idle/30` and step back `idle/15`, both computed from
  `SESSION_POLICY`, so the test cannot flake on a slow request and states no policy number (B-24).
  Case 14 uses `idle ∓ 2` seconds at the POS and `idle ∓ 60` at the back office for the same reason.
- **The tripwire (case 7) lists three routes, not six.** The sign-ins and re-authentication do not
  exist yet. 009b must add `POST /api/pos/auth/login`, `POST /api/back-office/auth/login` and
  `POST /api/back-office/auth/reauthenticate` to that list in `access.test.ts`.
- **The jar client keeps one CSRF token per surface** (`/api/pos`, `/api/back-office`) because a profile
  with both sessions holds two. The consult describes "the last csrfToken"; a single value would send
  the wrong token to one surface. It also exposes `plant()` because no sign-in route exists yet.

### Case to test map (1 to 27)

`access.test.ts`: 1 → "1. an API route with no access…"; 2 → "2. %s is refused" (ten malformed shapes,
including all seven the consult lists); 3 → "3. an audience that does not match the surface…"; 4 → "4.
a declared route on the root instance, and one in a second plugin…"; 5 → "5. a route outside /api
that carries access…"; 6 → "6. health declares NONE, creates no client instance…"; 7 → "7. the routes
declared NONE or OPTIONAL…"; 8 → "8. a generated HEAD route…".

`session-guard.test.ts` (each `it.each` runs once per surface): 9 → "9. an active $audience session on
me…"; 10 → "10. $audience with no cookie…"; 11 → "11. $audience: a token that can never be accepted"
(unknown, malformed, released, deactivated, raised version, and past the absolute limit for the back
office); 12 → "12. AC-27…" (both directions, `me` and `activity`, compared whole, row unchanged); 13 →
"13. $audience: the cookie name twice…"; 14 → "14. AC-28: the limits" (three tests); 15 → "15. AC-28:
polling does not extend $audience" (two tests per surface); 16 → "16. a demoted manager…"; 17 → "17.
CSRF on $audience activity" (nine refusals, then the right value; a GET needs none); 18 → "18. the CSRF
token is 43 base64url characters…"; 19 → "19. $audience: ending the session" (four tests) and "19. a POS
release leaves the same user's back-office session alone, and the reverse"; 20 → "20. $audience: an
origin-refused activity moves nothing"; 21 → "21. $audience: the session store failing…"; 22 → "22.
$audience: a miss under the surface…".

`session-scan.test.ts`: 23 → "23. no session token and no CSRF token appears in any log line or any
error body" (log at trace); 24 → three tests, "24. only session-guard.ts names the session cookies…",
"24. no route writes an error status itself…", "24. nothing under src/http reads the database clock
with now()"; 25 → "25. error-details.types.ts has a block for every code" (text check, plus the
compile-time blocks themselves, which `npm run typecheck` enforces); 26 → "26. no response carries
Access-Control-* or Strict-Transport-Security, and every one is no-store"; 27 → two tests, "27. two
clients hold two POS sessions at once…" and "27. one client with a POS and a back-office session sends
each route only its own cookie".

### Red proofs (each mutated, run, read, reverted; sources were diffed against a backup afterwards)

1. `!wellFormed(access)` → `access !== undefined && !wellFormed(access)`: case 1 failed (1 of 17).
2. The outside-context filter made always empty: case 4 failed (1 of 17).
3. Role check disabled (`false && …`): case 16 failed (1 of 46).
4. `me` declared `interactive: true` on both surfaces: case 15, "me twice leaves last_interactive_at
   unchanged", failed on both surfaces ("expected '…08:29:32…' to be '…08:28:05…'").
5. CSRF check removed: case 17 failed on both surfaces. Then `sent === request.clientInstanceId` accepted:
   case 17 failed on both surfaces again.
6. CSRF check moved after `resolveSession`: case 17 failed on both surfaces with "no header: expected
   '2026-10-09 08:29:00.720105+00' to be '2026-10-09 08:28:55.709666+00'", i.e. `last_interactive_at`
   moved, as the consult predicted.
7. `IDLE` accepted as an actor: case 14 (both limit tests) and case 15's idle leg failed (4 of 46).
8. Clearing with `reply.clearCookie(name)` (plugin defaults): case 11 failed for every variant on both
   surfaces, plus 12, 13 and the clearing assertions of 14 and 19 (19 of 46).
9. Repeated-name check removed (first copy wins): case 13 failed on both surfaces ("expected 204 to be
   401"). My parser returns the first copy, so the check is load-bearing here, not redundant.

### Existing tests changed

Only what the task permits. `client-instance.test.ts`, `origin.test.ts`, `server.test.ts`,
`log-scan.test.ts`: each probe registration gained `config: { access: { session: 'NONE' } }` and
nothing else (no assertion, request or other line; where a file registers several probes I hoisted one
`const config` in `origin.test.ts`, `server.test.ts` and `log-scan.test.ts`, and inlined it in
`client-instance.test.ts`). `error-details.types.ts`: four blocks added, existing lines untouched. No
other test was changed and none was loosened.

### Found and not fixed

- **Acceptance criterion 4's last grep is not empty.** `grep -rn "now()" apps/server/src/http` prints
  `apps/server/src/http/log.ts:125:    time: Date.now(),`. That is JavaScript's clock in a log line written
  in PHASE0-008, not SQL, and I did not touch it. The task's intent (no SQL `now()` in `src/http`) holds;
  my case 24 test matches a bare `now()` call and ignores `.now()`. The lead should reword the criterion
  or accept it.
- `log.ts` contains the string `req.headers.cookie` (a redaction path). Rule 3's literal grep is scoped
  to `src/http/routes` and is clean; my wider scan of `src/http` looks for actual reads and writes
  (`.cookies`, `.setCookie(`, `.clearCookie(`, `request.headers.cookie`).
- `ErrorBody` / `AppError` still allow any status with any code; nothing ties 401 to `UNAUTHENTICATED`
  by type. Unchanged, out of scope.

### Verify output

`npm run verify`: typecheck clean; `Test Files 61 passed (61)`, `Tests 3166 passed (3166)`. Baseline
at `3e46f7b` was 58 files / 3095 tests, so this task adds 3 files and 71 tests; the client project's
tests are unchanged. `access.test.ts`, `session-guard.test.ts` and `session-scan.test.ts` alone: three
runs in a row, each `Test Files 3 passed (3)`, `Tests 71 passed (71)` (17 + 46 + 8). Greps for
criterion 4: `rpos_pos_sid|rpos_bo_sid` appears only at `session-guard.ts:32-33`; the `cookies|setCookie|
clearCookie|headers\.cookie` grep and the `reply\.code\((4|5)` grep over `src/http/routes` print
nothing; the `now()` grep prints only the `Date.now()` line above.

No browser was needed or used. I ran no formatter. One shell command in my own session used a heredoc
(a throwaway Python edit of `support/client.ts`) against the role's shell rule; the result is the file
as committed.

### Carried forward

- **Task 10:** an approval route is `ACTIVE`, `POS`, interactive, and takes its actor from
  `actorOf(request)`; the approver is a PIN in that request's body, never a session of either audience;
  the approval codes and the cooldown-refused audit outcome are that consult's. No session records or
  satisfies an approval (B-14); `request.actor` carries four fields and none is an approval.
- **Task 11 (client):** the client holds `csrfToken` in memory only, sends it as `X-RPOS-CSRF` on every
  non-GET request, and calls `activity` only on real input (a touch, a key), never on a timer or a poll,
  with a client test for that. Switch on the code, never the status: three codes share 401
  (`UNAUTHENTICATED`, `SESSION_IDLE`, and in 009b `INVALID_CREDENTIALS`). `SESSION_IDLE` at the POS goes
  to POS-01 (ordinary expiry; the cookie is already cleared); `UNAUTHENTICATED` on a session the client
  believed it had is "session invalidated". At the back office `SESSION_IDLE` goes to M-6 and the
  cookie is kept. `me` is the way to get a `csrfToken` after a page reload. The lead's earlier notes under
  *For the lead* in the consult also apply.
- **Task 12 (browser harness):** one context with two pages (a shared jar) and two contexts (two actors),
  `baseURL` on `localhost`, mutating calls made by the page so `Origin` and the token are the browser's
  own. `test/support/client.ts` is the API-level half.
- **AC-19, AC-27, AC-28, AC-35** close only as far as the table in question 10 says. This task proves
  AC-27's first sentence in both directions for a manager and AC-28 at the API (limits and polling);
  AC-19 and AC-35 need 009b's sign-in routes.
- **For 009b:** add the three sign-in/re-authentication routes to the tripwire list in `access.test.ts`
  case 7; `signOut` is the model for a handler that reads the session itself (cookie via the guard
  module, never in a route file); `request.routeOptions.config.access` is where an `OPTIONAL` route's
  audience comes from, so the sign-in helpers should read it the same way; the jar client's `plant()`
  can be dropped in favour of real sign-in once those routes exist; `session-scan.test.ts` case 23
  should gain the three credential markers.

### What the next agent needs and does not have

Nothing is missing for 009b. Not decided here, and not blocking: whether `SessionView` carries a name
and username (the consult's question 8, item 1; the lead's call for 009b).

### Commit

Committed on `agent/phase0-009a` after verify was green; the hash is in `git log`.

DONE
