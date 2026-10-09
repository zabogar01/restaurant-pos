# ARCH-012 — Authentication routes and audience enforcement (plan Task 9)

Author: `architect12`, 2026-10-09. Read-only consult for PHASE0-009. Written against `development`
at `dfc96c3`. One file written; nothing else touched; nothing committed.

## Summary

Plan Task 9 cannot be built as written. Almost every line of it names something that does not exist
(`assertNotThrottled`, `recordFailure`, `recordSuccess`, `COOKIE_NAME` in the domain,
`resolveSession` returning `null`, `app_session`, `security_telemetry`) or contradicts something the
owner has since accepted (a PIN at the back office, flat error bodies, `SameSite=Lax`, routes
registered outside the `/api` context). It also has no anti-CSRF token, no M-6 route, no role check
on back-office requests, and a per-route `preHandler` that a later route can simply forget.

What PHASE0-009 must say instead, in ten lines:

1. **Every API route declares its access**, in `config.access`, as one of three shapes: no session,
   a presented session that the handler manages (the sign-in, sign-out and re-authentication
   routes only), or an active session with a required `interactive` flag. A route that does not
   declare, declares wrongly, or sits on an API path outside the `/api` context stops the server at
   startup. One guard in the API context enforces the declaration; no route has a `preHandler` of
   its own.
2. **Two session cookies, path-scoped, not `__Host-`:** `rpos_pos_sid` with `Path=/api/pos` and
   `rpos_bo_sid` with `Path=/api/back-office`; `HttpOnly`, `Secure`, `SameSite=Strict`, no `Domain`,
   and **no `Max-Age` or `Expires`**. The server alone decides when a session ends.
3. **No route accepts either cookie.** FR-A2c permits shared read routes; with path-scoped cookies
   a shared read is one handler registered under both surfaces, each with its own audience. The
   declaration has no "either" value.
4. **The anti-CSRF token is derived from the session token**, `HMAC-SHA256(key = cookie value,
   "rpos-csrf-v1")`, returned in the body of a sign-in, a re-authentication and the session read,
   kept by the client in memory, and sent in `X-RPOS-CSRF` on every mutating request that has a
   session. Nothing is stored, no secret is added, and it changes when the token rotates at M-6.
5. **The two sign-in routes carry no token.** What grants a session there is the credential in the
   body. What stops a cross-site sign-in is what ADR-010 already built (JSON only, no CORS, the
   origin refusal). I say below why a pre-session token would add nothing that is permitted.
6. **Six new codes:** `INVALID_CREDENTIALS` (401), `THROTTLED` (429), `UNAUTHENTICATED` (401),
   `SESSION_IDLE` (401), `FORBIDDEN` (403), `CSRF_REFUSED` (403). The first two declare
   `{ retryAfterSeconds: number }`. There is no `INVALID_PIN` and no `WRONG_AUDIENCE`.
7. **A malformed PIN is refused by the schema and never reaches the throttle.** A username and a
   password are checked for type and a generous size only; the domain decides the rest, so every
   typed credential gets the one answer.
8. **M-6 is `POST /api/back-office/auth/reauthenticate` with `{ password }` and nothing else.** The
   user is the one the idle session names. A sign-in releases a presented session only after the
   new credential has verified.
9. **A database failure in a hook or a route is 500 `INTERNAL`**, and the request is refused. Health
   remains the one route that answers `UNAVAILABLE`, and is how a client tells an outage.
10. **Split it in two:** PHASE0-009a, the declaration, the guard and the routes that need a session
    but verify nothing; PHASE0-009b, the routes that take a credential.

Three things are for the owner (last section): an ADR for the rules above that bind every later
route, a reading of FR-A2c, and one residual risk on the sign-in routes. **No change to PRODUCT.md,
PRD.md, ROADMAP.md or BOUNDARIES.md is proposed.** Two entries in the designer's
`SCREEN-INVENTORY.md` are stale against ADR-009 and against the built domain; exact wording is given
for the lead to route.

## What I verified, and what I could not

**Read, at `dfc96c3`:** all of `apps/server/src/http/` and `apps/server/src/domain/`,
`packages/contracts/src/`, `test/support/request.ts`, migrations `0003` and `0007`, plan Task 9
(`:2316-2729`) and the parts of Tasks 10 to 12 that consume it, ARCHITECTURE §3, §5, §7, §11 to
§14, ADR-009 and ADR-010 whole, PRD §2, FR-A1 to FR-A7, FR-J, §5, §6 and the four criteria,
BOUNDARIES B-11 to B-14 and B-24, POS-01, BO-01 and M-6 in the screen inventory, ARCH-007 §7,
ARCH-008 §5 to §7, ARCH-010 §7 and §10, ARCH-011's Handoff, the Handoffs of PHASE0-004 to 008b, and
every 2026-10 line of `.agent/DECISIONS.md`.

**The lead's "What exists" is accurate**, with one addition: `zod` is not installed anywhere. The
plan adds it in Tasks 4 and 8 and neither built task did. AGENTS.md's "What exists" still says
there is no HTTP server; that is the lead's file.

**I ran nothing.** This worktree has no `node_modules`, and the consult writes one file.

**From the librarian** (`ask.sh librarian`, three questions, sources in its answers):

- Fastify 5.12: `onRoute` runs synchronously at registration; a hook on the root instance fires for
  routes in descendant contexts; `routeOptions.url` includes the prefix; `routeOptions.config` is
  visible there and at request time as `request.routeOptions.config`; the generated `HEAD` route
  fires the hook too, with the `GET` route's options copied; a throw in the hook makes `ready()`
  and `listen()` reject. With no route `schema`, the JSON body is parsed and handed over
  unvalidated; `bodyLimit` defaults to 1 MiB.
- `@fastify/cookie` 11: `clearCookie` emits an empty value with `Expires` in 1970 and `Max-Age=0`,
  and **defaults to `Path=/` and `SameSite=Lax`** unless told otherwise; `setCookie` enforces
  nothing for a `__Host-` name.
- Cookies: `__Host-` requires `Secure`, `Path=/` and no `Domain`, and **does not separate ports**.
  `Path=/api/pos` matches `/api/pos/auth/login` and not `/api/back-office/x` or `/pos/index.html`.
  Another server on the same host can set a same-name cookie on another path; same-name cookies are
  usually sent longest path first and the draft says not to rely on it. A cookie with neither
  `Max-Age` nor `Expires` is a session cookie, which Chrome's session restore keeps.
- Fetch: `Sec-` headers cannot be set by page script; a cross-origin request with a custom header
  or a JSON content type is preflighted; an HTML form cannot set a custom header. `https://localhost`
  on any port is same-site with itself; `http://localhost` is not.
- zod: the current major is 4. An issue has `code`, `path` and `message`; the rejected value is not
  attached unless `reportInput` is set, and default messages do not contain it. An
  `unrecognized_keys` issue lists the extra keys, which are the client's strings.
- Playwright: each `browser.newContext()` has its own cookie jar; `page.request` shares its
  context's jar.

**Not verified, and how the design copes:**

- Which value `request.cookies[name]` holds when a name arrives twice. The guard therefore counts
  occurrences itself and treats a repeated name as no session (question 2).
- Whether a header set on the reply before an `AppError` is thrown survives into the error
  response. The cookie-clearing cases assert the exact `Set-Cookie` on the 401, so a test decides.
- Whether a rejection in an `onReady` hook rejects `ready()`. The startup cases assert the
  rejection; if it does not, the builder moves the check and the test still decides.
- Whether Playwright's API request context sends `Origin`. Task 12's concern; ARCH-011 already
  says to set it or let the page make the call.
- Safari's handling of a session cookie across a restart. Nothing depends on it.

---

## 1. Plan Task 9 against what is built and decided

The table lists every plan line to drop or change. "Built name" is what exists at `dfc96c3`.

| Plan | What is wrong | Must be | Authority |
|---|---|---|---|
| `:2319` `audience.ts`, `routes/posAuth.ts`, `routes/boAuth.ts` | Names; the repository's files are kebab-case | `http/access.ts`, `http/session-guard.ts`, `routes/pos-auth.ts`, `routes/back-office-auth.ts` (the lead may rename) | built tree |
| `:2325` consumes `findUserByPin`, "throttle functions" | A route never calls `findUserByPin`; three of the four throttle functions do not exist | `verifyPinThrottled('LOGIN', …)`, `verifyPasswordThrottled(…)`, the four session functions | ARCH-007 §7; PHASE0-006, 007, 007b |
| `:2326` `requireSession(audience)` as a per-route `preHandler` | A route that omits it is unguarded and nothing notices | A declaration every route must carry, one guard, a startup refusal | question 4 |
| `:2326` six routes | No M-6 route; nothing ever records interactive activity | Nine routes (question 7) | FR-A2b; ARCHITECTURE §13 |
| `:2333` `zod` 3, imported by path `@pos/contracts/src/auth.js` | Not installed; the package exports from its index | zod 4 in `@pos/contracts`, imported as `@pos/contracts` | question 9 |
| `:2337` one `LoginRequest { pin }` for both surfaces | The back office never accepts a PIN | Three strict request schemas | ADR-009 §1 |
| `:2340-2343` `ActorResponse` | No CSRF token | question 3 | §7.2 |
| `:2362` `buildServer()` | Takes `{ origin, logLevel, … }`; returns synchronously | `buildServer({ origin: TEST_ORIGIN, logLevel })` | `server.ts` |
| `:2371-2377` `DELETE FROM app_session, audit_entry, security_telemetry, staff_user`; `UPDATE auth_throttle` through `query()` | Three of those tables do not exist under those names; `pos_app` has no `DELETE` on any of them and no `SELECT` on two | `resetDatabase()`; fixture changes through `ownerQuery` | `0003`, `0004`, `0005`; PHASE0-003b |
| `:2383`, `:2421`, `:2430`, `:2437`, `:2446`, `:2459`, `:2465` `app.inject` | Refused by the Host check, and by the origin check when mutating | `inject(app, …)` from `test/support/request.ts`, or the jar client of question 10 | PHASE0-008b Handoff |
| `:2394`, `:2419`, `:2424`, `:2435`, `:2440`, `:2457`, `:2462`, `:2468`; `:1875-1877` `pos_sid`, `bo_sid` | Not project-specific | `rpos_pos_sid`, `rpos_bo_sid` | ADR-010 rule 3; question 2 |
| `:2400`, `:2408`, `:2452`, `:2476` `res.json().code` | The body is the envelope | `res.json().error.code` | ADR-010 rule 1 |
| `:2400`, `:2570`, `:2655`; `:2012` `INVALID_PIN` | Names one credential; the back office has another | `INVALID_CREDENTIALS` | question 5 |
| `:2015` `WRONG_AUDIENCE` | Would tell a caller the token is valid on the other surface | Never exists; the answer is `UNAUTHENTICATED` | task question 5; FR-A2c |
| `:2413-2414` reads `audit_entry` and `security_telemetry` through `query()` | `pos_app` cannot read either; the second is `security_event` | `ownerQuery` | `0004` |
| `:2417-2443` the two audience tests | Sound in substance. They transplant a session id; the cookie now holds a token, and the back-office sign-in is not a PIN | Kept, on tokens, asserting the code and that the answer equals the one for an unknown token | AC-27 |
| `:2429-2434`, `:2446-2450`, `:2635-2679` back-office login by `{ pin }` against `LOGIN` | Rejected by the owner | `{ username, password }` through `verifyPasswordThrottled` | ADR-009 §1, §4 |
| `:2445-2453`, `:2660-2663` "refuses a cashier at the back office", 403 `FORBIDDEN` | No longer has a meaning at sign-in: a cashier has no credential. As written it also confirmed that a PIN is valid, and reset the `LOGIN` bucket (`:2658`) before refusing | Deleted. `FORBIDDEN` survives only for an active back-office session whose user is no longer a manager | ADR-009 §1; question 8 |
| `:2473` "rejects a malformed PIN before touching the database" | False as a claim: the client-instance hook has already written. The property that matters is "before the throttle" | Asserts the bucket and `security_event` are unchanged | question 6 |
| `:2492` `@pos/contracts/src/errors.js` | Import by path | `@pos/contracts` | built |
| `:2493` `COOKIE_NAME` from `domain/session.js` | Not in the domain, by ARCH-008 §7 row 13 | The cookie names live in the HTTP session module and nowhere else | PHASE0-007 |
| `:2497` `role: string`, `actor?:` | Built type is `StaffRole` | `actor: { staffUserId; role: StaffRole; sessionId; audience } \| null` | `pin.ts` |
| `:2505`, `:2512`, `:2684` `opts: { touch?: boolean }`, defaulting to a touch | Built signature is `resolveSession(token, audience, interactive: boolean)` and it returns a union, never `null` | `interactive` required in the declaration; `IDLE` handled | PHASE0-007 |
| `:2509`, `:2514`, `:2552`, `:2561`, `:2570`, `:2638`, `:2647`, `:2655`, `:2662` `reply.code(n).send({ code })` | A handler never writes an error body; `retryAfterSeconds` at the top level is outside the envelope | `throw new AppError(code, status, details?)` | ADR-010 rule 1 |
| `:2535-2540`, `:2555-2573`, `:2621-2626`, `:2641-2658` `assertNotThrottled`, `recordFailure`, `recordSuccess`, `ThrottledError` | None exists. As three calls they also reopen the gap between check and count that ARCH-007 closed | One call, exhausted as a union | ARCH-007 §1, §7 |
| `:2549`, `:2591`, `:2600`, `:2635`, `:2681`, `:2691` paths written as `/api/pos/…` | Inside the API context the prefix is already `/api` | `/pos/auth/login` and so on, relative | `server.ts:75-90` |
| `:2575-2579`, `:2665-2669` `createSession({ staffUserId, … })` | Built input is `{ audience, user, clientInstanceId }`, with the verified credential version | `user` passed as the verification returned it | PHASE0-007 |
| `:2581`, `:2671` cookie value `session.id` | The id is not the secret; the row holds a hash of a token | `IssuedSession.token` | `0003`; ARCH-006 §4 |
| `:2583`, `:2673` `sameSite: 'lax'` | | `'strict'` | §7.2 |
| `:2585`, `:2675` `path: '/'` | | The surface's path | question 2 |
| `:2588`, `:2678` returns `{ staffUserId, role }` | No CSRF token | question 3 | §7.2 |
| `:2600-2607`, `:2691-2698` release behind `requireSession` | An idle session could not be released | Release by token, idle or not; 204 | ARCH-008 §7 row 10 |
| `:2604`, `:2695` `releaseSession(sessionId)` | Built signature is `(token, audience)` | Through the session module | PHASE0-007 |
| `:2605`, `:2696` `clearCookie(name, { path: '/' })` | Wrong path, and the plugin would default the rest to `SameSite=Lax` | The same path and attributes as the cookie that was set | librarian |
| `:2606`, `:2697` `{ released: true }`, `{ loggedOut: true }` | A body with nothing in it | 204 | |
| `:2708-2713` `app.register(posAuthRoutes)` in `server.ts` at the root | **Outside the API context**: no origin guard, no `no-store`, no client instance | Registered inside the context, as `healthRoutes` is | ADR-010, Consequences |
| `:2719` "all ten cases" | The file has nine | The cases in *For the task file* | |

**Lines in Tasks 10 to 12 that consume Task 9 and must not be copied** (in addition to ARCH-011's
list, which I confirm item by item: the cookie names, the flat bodies, `lax`, `INVALID_PIN` and
`WRONG_AUDIENCE`, the bundle roots, the `PIN_PEPPER` literals, the Playwright note and the `psql`
line all stand):

- `:3183-3190`, `:3363-3370` the clients' sign-in `fetch` calls. The back-office one sends `{ pin }`.
  Both must keep the returned `csrfToken` in memory.
- `:3193-3198`, `:3371-3379` read `body.code` and `body.retryAfterSeconds`. They are
  `body.error.code` and `body.error.details.retryAfterSeconds`. The `FORBIDDEN` branch at `:3373`
  goes with the cashier-at-the-back-office case.
- `:3202`, `:3384` `fetch(…, { method: 'POST' })` for release and logout. Each now needs
  `X-RPOS-CSRF`, or it is refused.
- `:3600-3603` the back office signed in by `bo-pin`.
- `:3644-3654` ages `app_session.last_activity_at` through `psql` with the owner's password on a
  command line. The table and column are `actor_session.last_interactive_at`, and the literal is
  B-24's and ARCH-006's concern.

---

## 2. The two session cookies

### Names and attributes

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

### Path scoping, not `__Host-`

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

### No route accepts either cookie

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

### Lifetime

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

### Setting, clearing, and the one module that does either

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

---

## 3. The anti-CSRF token

### Shape and binding

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

### Where it is issued

In the JSON body, as `csrfToken`, of exactly three kinds of response: a successful sign-in, a
successful re-authentication, and the session read (`GET …/auth/me`) of an active session. Never in
a cookie, never in a URL, never in an error. The client holds it in memory only.

Returning it from a `GET` is safe because no other origin can read the response: there is no CORS
(ADR-010 rule 4), the cookie is `SameSite=Strict`, and the origin guard refuses a cross-site read.

### Where it is checked

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

### Why this and not the alternatives

- *A stored synchronizer token* (a column on `actor_session`). It works, and it costs a migration,
  a grant, a second secret to keep out of errors and logs, and an update at every renewal. The
  derived token has every property it has.
- *A double-submit cookie.* It compares a script-readable cookie with a header. In a jar that any
  local server can write to, a cookie is the wrong thing to trust.
- *A fixed custom header* (`X-Requested-With`). It forces a preflight and is not a token. §7.2 and
  ADR-010 rule 3 ask for a token bound to a session.
- *HMAC under a server secret.* It would let the token outlive nothing and bind to nothing more
  than the derived one does, and it adds a secret to manage.

### What protects the two sign-in routes

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

---

## 4. The route declaration

### The declaration

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

### How a wrong route fails at startup

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

### The guard

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

---

## 5. Codes and statuses

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

### A database failure: 500 `INTERNAL`

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

---

## 6. Verification order

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

---

## 7. The routes, M-6, and a session already held

### The nine routes

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

### A sign-in when the browser already holds a session

On **`VERIFIED`**, and only then, the route releases whatever session the surface's cookie presents
(`releaseSession(token, audience)`, which needs no resolution and accepts an idle session), then
creates the new session, then sets the cookie. If the release fails, no session is created. If the
creation fails, the old session is already gone. Both fail closed.

A sign-in that **fails or is throttled changes no session and no cookie**. A mistyped PIN should not
end anything, and an unauthenticated request should have no effect beyond its own count.

ARCH-008 called this hygiene, and it is: the old token cannot be used without the old cookie, which
the new one overwrites. It matters in one place, below.

### The M-6 sequence

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

---

## 8. Role and credential edges

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

---

## 9. Validation

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

---

## 10. Proofs and sequencing

### Split it, as Task 8 was

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

### The two-client harness

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

### What closes, and what does not

| Criterion | Closes in Task 9 | Still open |
|---|---|---|
| AC-19 | The `LOGIN` class through the route: five failures, the cooldown, a correct PIN refused, the other class untouched, a cleared or replaced `rpos_cid` changing nothing, a rebuilt server still refusing | The `MANAGER_APPROVAL` class through its route (Task 10) |
| AC-27 | First sentence, both directions, for a manager | "must still enter a PIN for an inline POS approval" (Task 10) |
| AC-28 | At the API: 90 seconds, 30 minutes, 8 hours, and that a poll does not extend either | "divergent timeout presentation" in a browser (Task 12) |
| AC-35 | Sign-in by username and password; a PIN refused; the per-account cooldown and its isolation; an unknown username never blocked; restart; M-6 renewing the same session by password alone | "finds their unsaved work; a different manager does not" (the client, Tasks 11 and 12) |

### Against the boundaries and requirements the task names

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

---

## For the task file

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

---

## For the lead

Not decisions for the owner, and not mine to edit.

1. **`docs/design/SCREEN-INVENTORY.md`, BO-01, is stale against ADR-009.** Its states read
   "*permission-denied* (a cashier PIN — the back office is manager only)" and "*throttled* (LOGIN
   class, 5 minutes, shared installation-wide with the POS, FR-A5)", and its requirements cite
   FR-A5. Proposed, for the designer: *"**States.** empty (resting) · loading · error (wrong
   username or password; the server does not say which) · overflow (none) · throttled (this
   username, 5 minutes, FR-A5b; no other username and no PIN is affected)."* and
   *"**Requirements.** FR-A2b, FR-A2c, FR-A5b, FR-A7, FR-B preamble."* There is no
   permission-denied state at sign-in.
2. **POS-01's *permission-denied* state has no server signal and should not get one.** A
   deactivated user's PIN is answered exactly as a wrong PIN: `findUserByPin` selects active users
   only, FR-A4 lets another user take that PIN, and a distinct answer would confirm that a PIN was
   once valid. Proposed, for the designer: delete the *permission-denied* line. A user deactivated
   mid-shift is already covered by *session invalidated*.
3. **POS-01's *error* state says "wrong PIN, with attempts remaining before cooldown".** If that is
   meant as a number on the screen, the server does not report one (question 5). A question for the
   designer; I recommend the screen shows none.
4. **For the client task (Task 11's consult).** The client keeps `csrfToken` in memory and sends
   `X-RPOS-CSRF`; on `CSRF_REFUSED` it reads `me` once and retries once. It switches on
   `error.code`, never on the status. It calls `activity` only from real input, debounced, and
   never from a timer; the server cannot tell the difference, so this needs a client test. The
   visible idle countdown must be reckoned from the last request the server accepted as
   interactive, not from the last touch, or a debounced client will show time the server has
   already taken away. On a 5xx or no response, it asks health.
5. **The name and username on `SessionView`** (question 8, item 1) is the lead's to include in 009b
   or leave.

---

## For the owner

Nothing here blocks PHASE0-009a. **No change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md is
proposed.**

1. **An ADR to commission: ADR-011, sessions over HTTP, as `Proposed`.** ARCH-010 asked for ADR-010
   because six rules bound every later route and a task file is read by one builder. The same is
   true here. The rules that bind every route in every later phase are: the route declaration and
   its startup refusals; that no route accepts either cookie; the two cookies, their paths and
   their lack of a lifetime; the derived anti-CSRF token, its header and where it is checked; that
   the sign-in routes carry none, and why; and the six codes with the rule that none reveals the
   other surface. It would amend ARCHITECTURE §7.2, which today says "mutating routes also validate
   an anti-CSRF token" without the sign-in exception, and §13. It supersedes nothing, and it need
   not block 009a, as ADR-010 did not block 008a. I have not written it; this consult writes one
   file.

2. **A reading, stated so it can be corrected.** FR-A2c says "shared read routes may accept either"
   session. I have read "may" as a permission the architecture does not use: a read that both
   clients need is served under both `/api/pos/…` and `/api/back-office/…` by the same code, and no
   single route accepts both cookies. Nothing a person can see differs. If the owner wants a route
   that literally accepts either, the cookies cannot be path-scoped and question 2 is reopened.

3. **A risk to acknowledge: the sign-in routes have no anti-CSRF token.** A hostile page that could
   get a JSON request past the browser's cross-origin rules and past the origin guard could sign
   the victim's browser in as an account the attacker already holds. Nothing known does that, the
   attacker would need a valid PIN or manager password, and a token cannot be bound to anything
   before a session exists without using the client instance, which FR-A7 forbids. I recommend
   accepting it for the loopback MVP and recording it for the gate. If accepted, the ADR adds to
   the review list in ARCHITECTURE §3.2: *"a review of sign-in without a pre-session anti-CSRF
   token, which rests on the same-origin refusal alone"*.

DONE
