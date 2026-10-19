# ADR-011: The browser clients, their sessions and what is served to them

**Status:** Accepted

**Date:** 2026-10-19

**Approved by:** Product owner

Nothing is superseded by this record. ADR-010 left five matters for later in
its *Not decided here*: the session cookies (their names, lifetime, path, and
`__Host-` against path scoping), the anti-CSRF token and what protects a
sign-in, the route declaration, the authentication codes, and what is served
outside `/api`. This record settles all five and adds the rules that bind the
two browser clients and their browser tests. ADR-008 remains reserved for the
deferred database-roles decision.

The record is written after the fact. Everything it describes is built and
merged: PHASE0-009a and 009b (the route declaration, the session guard, the
credential routes), 011a (the served bundles), 011b (the session clock and the
route table), 011c1 and 011c2 (the transport core and the POS sign-in), 011d1
and 011d2 (the back office and M-6), and 012a (the browser harness). It records
what was built and why. It redesigns nothing, and it decides one small change
that is not built yet (rule 12, the root's 404).

The owner accepted both of the record's proposals on 2026-10-19, with the
record: the reading of FR-A2c, that no route accepts either cookie (rule 3),
and that the two sign-in routes carry no anti-CSRF token (rule 5).

## Context

ADR-010 was written because six rules bound every later route and a task file
is read by one builder, once. The same has happened twice more. The consult for
the authentication routes (ARCH-012, plan Task 9) found rules that bind every
route in every later phase: how a route declares the session it needs, which
cookie it reads, where the anti-CSRF token is checked, and which codes may be
answered. The consult for the client shells (ARCH-014, plan Task 11) found
rules that bind every client screen: one request path, a retry that must never
change who is acting, the server as the only clock, fixtures that a served build
cannot contain, and what is served outside `/api` at all. The consult for the
browser harness (ARCH-015, plan Task 12) found rules that bind every later
phase's browser tests. Each recommended an ADR. The owner commissioned one, as
`Proposed`, on 2026-10-13, and asked for it to be written on 2026-10-17.

The forces are these.

- **B-11** forbids a PIN or password transmitted in plaintext; **B-12** forbids
  one in any log, error or stack trace, in any form. In a browser client the
  places a credential can leak multiply: a URL, browser storage, the DOM, an
  attribute, the console, a request other than its own, and a test tool's own
  artefacts.
- **B-13** requires every audited action to name a specific person. In a
  browser, one cookie jar serves every tab of a profile. A request a tab sends
  as one person can be answered under another person's session, if another tab
  signed in between.
- **B-14** forbids an approval that outlives its action. Nothing a session
  carries, on either surface, may represent one.
- **B-24** forbids a hard-coded staff list or rate, which rules out a seeder in
  production source and a literal idle limit in a client.
- **FR-A2, FR-A2b, FR-A2c** give the two surfaces different sessions,
  different timeouts and different credentials, and say that "a client-supplied
  header alone is never sufficient". **FR-A7** makes `ClientInstance` continuity
  and telemetry only.
- **NFR-1** fixes one HTTPS origin on `localhost`, path-separated. **NFR-5**
  requires two independently bootstrapped bundles with separate route manifests,
  session cookies and layouts, sharing schemas and authentication primitives.
- **ARCHITECTURE §14.4** says the browser clock is never an authority.
- **The `localhost` cookie jar is shared** with every other local server,
  whatever its port, which the owner accepted for the MVP on 2026-10-08. A
  related fact matters as much and is easier to miss: every `https://localhost`
  port is the **same site** as every other. `SameSite=Strict` therefore stops
  nothing a page on another local port sends. What stops it is the origin
  refusal of ADR-010 rule 3 and the token of rule 4 below.

The framework and library defaults point the wrong way, as ADR-010 found for
the server. `@fastify/cookie`'s `clearCookie` defaults to `Path=/` and
`SameSite=Lax`. `@fastify/static` only warns when its root is missing, and then
answers a plain 404. Vite's `import.meta.env.DEV` follows `NODE_ENV`, not the
build command, so `NODE_ENV=development vite build` produces a bundle that
believes it is a development server. zod 4 probes at start-up whether it may
compile validators by calling `Function('')`, which a strict content-security
policy refuses and reports. Playwright writes an `error-context.md` for every
failing test, holding the error message and a page snapshot, whatever its
`trace`, `video` and `screenshot` options say.

Several rules were learned from the build and its reviews rather than from a
consult, and they are the ones most likely to be undone by someone who did not
see the failure:

- a cookie name sent twice in one `Cookie` header (009a);
- a route registered twice under the same method and path with different
  constraints, so that a check by name passed a registration outside the API
  context (009a, round 2);
- a response that settles after the session it was sent under has ended, and
  then signs a tab back in or ends someone else's session (011c1, rounds 2 and
  3; 011c2, round 3; 011d1, round 2; 011d2, round 2);
- a back-office logout that fails and must not look like a success (011d1);
- zod's start-up probe, which only a real browser could see (012a, round 2);
- Playwright's error context, and a harness that named its people after their
  PINs (012a, round 3).

The owner has ruled on these points, and this record carries them rather than
reopening them:

- 2026-10-08: `localhost` is one cookie jar shared with every local server,
  accepted for the MVP; the kit makes the certificate and never installs trust;
  the browser warning is clicked through once per profile; FR-A7's "first
  contact" is the browser's first API request.
- 2026-10-13: in Phase 0 the served POS shows fixture screens and approval
  stand-ins under a real sign-in, each stand-in going when its server command
  arrives.
- 2026-10-13: a browser may offer to save a manager's back-office password,
  accepted for the loopback MVP, and reviewed at the gate in ARCHITECTURE §3.2.
- 2026-10-14: when a different manager signs in from M-6, the idled manager's
  unsaved draft is destroyed; after the eight-hour limit, the same manager
  signing in again in that tab gets their draft back.
- 2026-10-14: the transport core supports one cookie-changing request
  (sign-in, re-authentication, release, logout) at a time per tab; the screens
  enforce it; the two-tab case is an accepted risk for the §3.2 gate and this
  record.
- 2026-10-15 and 2026-10-16: a back-office logout that fails stays signed in on
  screen; the idled manager signing in through M-6's other-manager form keeps
  their draft; after "Discard changes and log out", any end the logout brings
  destroys the draft.

**The evidence for the cookie premise is automated.** Every session in this
record rests on a browser storing and resending `Secure; HttpOnly;
SameSite=Strict` cookies on an `https://localhost` origin whose certificate it
does not trust, because the owner clicks through the warning and nothing
installs trust. Until PHASE0-012a this had been checked once, by hand. 012a's
case A2 now asserts it in Chromium and in WebKit on every run of the harness:
under `ignoreHTTPSErrors`, `rpos_cid` is stored with `secure`, `httpOnly`,
`sameSite: 'Strict'` and path `/`, it is resent (the next response sets no new
one), and the page is a secure context. The session cookies carry the same
three attributes on narrower paths. That they too are stored and resent is
shown by cases A4 and A5: the POS's `activity` is answered 204, which only an
active `rpos_pos_sid` presented with its token can earn, and a cashier reaches
`data-session="signed-in"` at the real pad. PHASE0-012b's case B3 asserts the
two session cookies' names and paths directly. Safari itself is not
Playwright's WebKit; the owner's hand check of 2026-10-13 remains the Safari
evidence, and is to be repeated at the Phase 0 gate.

Library behaviour cited here comes from the librarian, by way of the consults
and Handoffs named, not from recall.

## Decision

Twenty-eight rules, in four parts. Each binds every route, client screen and
browser test in this phase and every later one. None has a development mode,
a test mode or a flag, except where a rule names the fixture mode, which a
served build cannot contain.

### Part 1. Sessions over HTTP

#### 1. Every API route declares its access

Every route under `/api` carries `config.access`, exactly one of three shapes:

| Shape | Meaning | Routes today |
|---|---|---|
| `{ session: 'NONE' }` | No session cookie is read | health |
| `{ session: 'OPTIONAL', audience }` | The handler manages the presented session through the session module | the two sign-ins, release, logout, re-authentication |
| `{ session: 'ACTIVE', audience, interactive }` | The guard requires an active session of this audience and sets the actor | both `me`, both `activity` |

`audience` is `POS` or `BACK_OFFICE`. There is no value meaning "either"
(rule 3). `interactive` has no default: `true` means a person did this, `false`
means the page did; polling, `me` and health are `false` (FR-A2b, AC-28). The
back office's manager requirement is not declared, because it is a property of
the audience: the guard requires the role `MANAGER` on every `ACTIVE`
back-office request, from the role the resolution returned at this request. No
POS route requires a role, because a manager's authority at the POS is the PIN
typed at that moment (B-14), never the session's role. The anti-CSRF
requirement is not declared either; it follows from the method (rule 4).

The server refuses to start, with a fixed sentence naming the method and path,
when:

1. an API route has no declaration, or one that is not exactly one of the three
   shapes (an unknown `session`, a missing or non-boolean `interactive` on
   `ACTIVE`, a missing or unknown audience, any extra key);
2. a route's audience does not match its surface: `POS` must be under
   `/api/pos/`, `BACK_OFFICE` under `/api/back-office/`, because the cookie is
   scoped to that path and a route anywhere else would never receive it;
3. an API route is registered outside the API context. Membership is proved by
   the registration itself, compared by object identity between a root hook and
   a hook inside the context, **never by method and path**: Fastify accepts two
   registrations with the same method and path when their constraints differ,
   and a check by name passed one that had no origin guard, no `no-store` and
   no session guard;
4. a route outside `/api` carries a declaration, which would promise a guard
   that does not run there.

One guard in the API context enforces the declaration. No route has a
`preHandler` of its own. The order of the context's hooks is `no-store`, the
origin refusal, the client instance, the session guard. A test holds the list of
routes declared `NONE` or `OPTIONAL` equal to an explicit list, so a route that
joins either class does so where a reviewer sees it.

For an `ACTIVE` route the guard: reads the audience's cookie (none, or the
name repeated, is 401 `UNAUTHENTICATED`); on any method but `GET` and `HEAD`,
checks the token (rule 4); resolves the session; on the back office, requires
`MANAGER` (403 `FORBIDDEN`); and sets the actor. The actor is null unless the
guard set it, is read through a function that throws when it is null, and
carries four fields (staff user, role at this request, session, audience), none
of which records an approval. A statement in the guard that throws refuses the
request with 500; a failure to resolve is never treated as a session.

#### 2. Two session cookies, path-scoped, with no lifetime

| | POS | Back office |
|---|---|---|
| Name | `rpos_pos_sid` | `rpos_bo_sid` |
| `Path` | `/api/pos` | `/api/back-office` |
| Value | the session token the server generated | the same |
| `HttpOnly`, `Secure`, `SameSite=Strict` | always | always |
| `Domain`, `Max-Age`, `Expires` | never | never |

`rpos_cid` keeps `Path=/`, because it describes the browser profile (§3.1); it
is unchanged by this record.

**No lifetime.** The server alone decides when a session ends: 90 seconds idle
at the POS, 30 minutes idle and eight hours absolute at the back office. A
`Max-Age` would write the policy's numbers in a second place, would be wrong
after an M-6 renewal (the eight hours keep running from the original sign-in),
and would be a statement about the browser's clock, which §14.4 says is never
an authority. Where a browser's session restore keeps the cookie, the server
judges the token as it judges any other.

**One module, `http/session-guard.ts`, is the only code that names the two
cookies, reads them, sets them or clears them.** A source scan holds it. It
picks the cookie from the route's declared audience and from nothing in the
request (FR-A2c). A handler never touches a cookie.

**Reading** counts the occurrences of the one name the audience selects in the
raw `Cookie` header. Exactly one is a presented token. None, or more than one,
is no session: a repeated name means something else has written into the jar,
and refusing is the only answer that does not depend on which copy a parser
happens to return.

**Setting.** Only a verified sign-in and an M-6 renewal set a session cookie,
each with a token the server generated in that request. The server never adopts
a value the client presented, so a planted cookie cannot become an
authenticated session.

**Clearing** repeats the path and the three attributes the cookie was set with
(an empty value, `Max-Age=0`, no `Expires`, no `Domain`), never the plugin's
defaults. A cookie is cleared whenever its token can never be accepted again:
on release and logout, whatever the session's state; on a guarded 401 that
resolved no session; on a POS `SESSION_IDLE` (the POS has no renewal, so an idle
POS token is dead); and when re-authentication finds nothing to renew. It is
**kept** on a back-office `SESSION_IDLE`, because M-6 needs it, and it is not
touched by a sign-in that fails or is throttled. A session row is not marked
when its cookie is cleared for expiry.

#### 3. No route accepts either cookie

FR-A2c says "shared read routes **may** accept either" session. This record
reads that as a permission the architecture does not use. A read that both
clients need, such as the print incidents of §12, is one handler registered
under both `/api/pos/…` and `/api/back-office/…`, each registration declaring
its own audience, as ARCHITECTURE §13 already lists it. No single route accepts
both cookies, and the declaration has no "either" value.

The reason is that an either-audience route would have to decide on every
request which cookie wins when a profile holds both, and the only things it
could decide by are the request's own headers, which FR-A2c says are never
sufficient. Path scoping also makes the question unanswerable on purpose: a
route outside both surface paths receives neither cookie. Nothing a person can
see differs. If the owner wants a route that literally accepts either, the
cookies cannot be path-scoped, and rule 2 is reopened by a superseding ADR.

#### 4. The anti-CSRF token is derived from the session token

```
csrfToken = base64url( HMAC-SHA256( key = the session cookie's value, message = "rpos-csrf-v1" ) )
```

Forty-three characters, computed in the session module. Only something that
holds the session token can compute it, which is the server and, because the
cookie is `HttpOnly`, nothing in a page. Nothing is stored and no secret is
added. It does not reveal the session token (HMAC is one-way), it is not
derivable from the stored token hash, and it changes when the token rotates at
M-6. It is not the client instance and shares nothing with it.

**Issued** only in the JSON body, as `csrfToken`, of a successful sign-in, a
successful re-authentication and the session read (`GET …/auth/me`) of an
active session. Never in a cookie, a URL or an error. Returning it from a `GET`
is safe because no other origin can read the response: there is no CORS
(ADR-010 rule 4) and the origin refusal stops a cross-site read.

**Sent** by the client in the header `X-RPOS-CSRF`, a constant in
`@pos/contracts`, on every request that is not `GET` or `HEAD`.

**Checked** by the session module, **before the session is resolved**, on every
request that is not `GET` or `HEAD` to a route with a session: every `ACTIVE`
route, and release, logout and re-authentication whenever a cookie is presented,
even a dead one. The request must carry exactly one `X-RPOS-CSRF` header equal
to the token derived from the presented cookie, compared in constant time after
a length check; otherwise 403 `CSRF_REFUSED`, with nothing resolved and nothing
written. Checking first matters because an interactive resolution moves the
session's activity stamp, and a request that fails the check must not be able to
keep a session alive. A client that has lost its token cannot clear a dead
cookie by releasing; the next guarded 401 clears it.

Passing the check grants nothing. The session is still resolved, and the user's
active state, credential version and role are still checked, exactly as on a
read.

**Why it is needed on this origin.** `SameSite=Strict` does not separate
`localhost` ports, so a page served by another local program is the same site
and its requests carry this application's cookies. Such a page is a different
origin, and ADR-010 rule 3 refuses its mutating requests by `Origin` and
`Sec-Fetch-Site`. The token is the second refusal, and the one bound to the
session, which §7.2 has required since it was approved.

#### 5. The sign-in routes carry no anti-CSRF token

`POST /api/pos/auth/login` and `POST /api/back-office/auth/login` have no
session, so there is nothing to bind a token to. What a sign-in grants, it
grants because a credential in the body verified; no header and no guard
contributes to it (FR-A2c).

The attack a token would address is a forced sign-in: a hostile page makes the
victim's browser sign in as an account the attacker holds. On this server that
request is refused three times over by what ADR-010 built: a cross-site HTML
form cannot send JSON and the server parses nothing else; a cross-origin `fetch`
with a JSON body is preflighted and the server answers no preflight; and the
origin refusal rejects any mutating request whose `Origin` is not the server's
own, including one from another `localhost` port. The attacker would also need a
valid PIN or a manager's password.

A pre-session token would have to be bound to something the attacker cannot
obtain. Before a session exists, the only per-browser value the server knows is
the client instance, and FR-A7 and ADR-010 forbid anything from being granted
or refused by it. The other candidate is a token signed under a server secret
and handed out by an unauthenticated route; anyone may ask that route for one,
so it protects only because another origin cannot read the response, which is
the same-origin rule the refusals above already rest on. It would be a second
mechanism and a new secret, giving the first one's guarantee.

The client rules add a second line that a token would not. A forced sign-in in
the victim's profile is, to an open tab, the same as a sign-in in another tab:
the tab's next mutation is refused, its session read names someone else, and
the tab goes to its sign-in screen without acting as that person (rule 18).

The residual risk is listed under *Risks accepted for the MVP*.

On `VERIFIED`, and only then, a sign-in releases whatever session the surface's
cookie presents, then creates a session, then sets the cookie. A sign-in that
fails or is throttled changes no session and no cookie. If the release fails,
no session is created.

#### 6. M-6 renews the same session, and only that session

`POST /api/back-office/auth/reauthenticate` takes `{ password }` and nothing
else; a `username` in the body is a schema failure, so the request cannot name
whom to verify. The order is fixed: the cookie (none or repeated: 401); the token
(403); the schema (400); the resolution, which must name a session that is idle
or active (otherwise the cookie is cleared, 401 `UNAUTHENTICATED`, **and no
password is verified or counted**); the throttled verification of the account
the session names (ADR-009 §6); and the renewal of that same row under a new
token, which sets a new cookie and returns a new `csrfToken`. A renewal that
finds the row gone between resolution and renewal answers 401 and never falls
through to a fresh session: only the sign-in route starts a new eight hours.
An active session is renewed like an idle one, because the client's timer and
the server's clock will disagree by a second now and then. The POS has no such
route: a PIN after 90 seconds may be anyone's and is always a new session.

Another manager at M-6 uses the ordinary sign-in route. The idled manager's
cookie travels with it, because the path is the same, so on `VERIFIED` the idled
session is released before the new one is issued, and does not remain
renewable.

#### 7. Six authentication codes, and none reveals the other surface

| Situation | Status | Code | `details` |
|---|---|---|---|
| A credential did not verify: a wrong or unknown PIN; an unknown username, a wrong password, a deactivated manager, a user who is no longer a manager; a wrong password at M-6 | 401 | `INVALID_CREDENTIALS` | `{ retryAfterSeconds }` only when this failure started a cooldown |
| A cooldown is in force and nothing was verified | 429 | `THROTTLED` | `{ retryAfterSeconds }`, always |
| No session resolves for this route's audience | 401 | `UNAUTHENTICATED` | none |
| The session is valid in every respect except idle time | 401 | `SESSION_IDLE` | none |
| An active back-office session whose user is not a manager | 403 | `FORBIDDEN` | none |
| A mutating request without the session's token | 403 | `CSRF_REFUSED` | none |

`retryAfterSeconds` is a number PostgreSQL computed. The server reports no
count of attempts remaining, on either surface: at the back office a count
would distinguish a known username at the first attempt. An unknown username
and a wrong password are the same response, byte for byte, until a cooldown
(the discovery risk ADR-009 accepted).

**No code says a token is valid elsewhere.** A POS token presented in the
back-office cookie resolves to no session and is answered exactly as an unknown
token is: the same status, body and clearing header. There is no `WRONG_AUDIENCE`
and no `INVALID_PIN`.

Three codes share 401. **Clients switch on the code, never on the status**
(ADR-010 rule 1); a client that sent every 401 to its sign-in screen would treat
a mistyped PIN as a lost session.

A database failure in a hook or a route is 500 `INTERNAL`, and the request is
refused. Health remains the one route that answers `UNAVAILABLE`, and is how a
client tells an outage from a fault (rule 20).

#### 8. The session view and the activity route

The session view is the body of a sign-in, a re-authentication and `me`:
`staffUserId`, `name`, `role`, `csrfToken`, `idleSeconds` and
`idleRemainingSeconds`, and at the back office the manager's stored `username`.
The two numbers are durations, never instants. `idleSeconds` comes from the
server's session policy and from nowhere else. `idleRemainingSeconds` is computed
by PostgreSQL from the activity stamp, the limit and `clock_timestamp()` in the
same statement that judged the session, rounded **down** and clamped to
`0..idleSeconds`, so the client never shows more than the server will give. The
back office's eight hours are not sent; M-6 learns of them from
`UNAUTHENTICATED`.

`POST …/auth/activity` exists on both surfaces, is `ACTIVE` and interactive,
has no body, answers 204, and does nothing but the interactive resolution.
Without it no route in Phase 0 would be interactive, and a session would end on
schedule whatever the person did. The server cannot tell a touch from a timer;
that a client calls it only on real input is a client rule (rule 21), proved by
a client test.

#### 9. One validator, and what a malformed credential costs

Request bodies are validated with zod 4, a dependency of `@pos/contracts` only,
so that the server's parsing and the clients' requests share one schema
(NFR-5). Routes declare no Fastify `schema`. One helper parses, throws
`VALIDATION_FAILED` (400) on failure and **drops the result**: the issues and
their messages are passed to nothing. `reportInput` is never set. Every request
schema is a strict object. Schemas carry no custom messages. `VALIDATION_FAILED`
carries no details.

A PIN that is not exactly six ASCII digits, as a string, is refused by the
schema and never reaches the throttle: it can never be a valid PIN, and counting
it would let one stuck key lock every cashier out of the installation-wide
`LOGIN` class. A username and a password are checked only for type and a
generous size; the domain decides the rest, so every typed credential gets the
one answer and ADR-009 §3's rules exist in one place. A malformed password
against a real username counts on that one account, which is the per-account
lockout the owner accepted.

### Part 2. What is served outside `/api`

#### 10. Where the bundles are, and when they are served

Each client builds into its own package's `dist/` (`apps/pos/dist`,
`apps/back-office/dist`), Vite's default. The server finds them by a path
resolved from its own source file's position, never from the working directory.
Building the server without bundle roots serves nothing outside `/api`, as
building it without a certificate means it cannot listen, so no in-process test
depends on whether someone has run a build. The bundle routes are registered on
the root, outside the API context, and carry no declaration.

Existence is checked on every request, not at startup. A bundle built while the
server runs (the watch loop of rule 23) is served without a restart. A request
that would be answered with an `index.html` that does not exist gets a plain-text
503 with a fixed sentence naming the command to run; the server also logs one
fixed line per missing bundle at startup.

#### 11. What each path answers, and the two reserved shapes

| Request | Answer |
|---|---|
| `GET /pos/`, `GET /pos/index.html` | the POS `index.html` |
| `GET /pos/assets/<file>` that exists | the file |
| `GET /pos/<anything else>` whose last segment has no dot and whose first segment is not `assets` | the POS `index.html` (the fallback) |
| a missing file under `/pos/assets/`, or a missing path whose last segment has a dot | plain-text 404, never HTML |
| any path with a dot segment, a dotfile, a NUL or a backslash | plain-text 404, before the file system is touched |
| `GET /pos` | 302 to the constant `/pos/` |
| any other method under the prefix | plain-text 404 |
| the same rows for `/back-office` | the same, from the back-office bundle only |
| `GET /` and anything else outside both prefixes and `/api` | plain-text 404 |

The fallback exists because the clients route by `pushState`: reloading
`/pos/floor` must return the application. It never answers a missing asset,
because a missing hashed script answered with 200 and HTML fails in the browser
as a syntax error far from its cause, and is cached. The rule is by the path's
shape, never by an `Accept` header, which a client chooses. Each prefix falls
back only to its own bundle; there is no catch-all on the root, so no path under
`/api` and none outside the two prefixes can receive HTML. The server holds no
list of client paths, because each client owns its route manifest (NFR-5). The
redirect's `Location` is a constant in source.

**Two path shapes are reserved under each prefix, and a client's route manifest
may use neither:** a first segment `assets`, and a last segment containing a
dot. A client route of either shape would be answered as a file lookup and never
reach the client. This is decided here so that it is a rule a client author can
read, not a surprise found by reloading a page.

#### 12. Headers

| Response | `Cache-Control` |
|---|---|
| `index.html` and every fallback | `no-cache` (revalidated, so a rebuilt bundle is picked up on the next load) |
| a file under `assets/` (content-hashed) | `public, max-age=31536000, immutable` |
| any other file in a bundle root | `no-cache` |
| every 404, 503 and redirect under a prefix | `no-store` |
| every error outside `/api` written by the error handler | `no-store` |
| the 404 for a path outside both prefixes and `/api` | `no-store` (**decided here; not yet built**) |

**The last row is a decision.** PHASE0-011a found that the root's not-found
handler, which predates the bundles, sets no `Cache-Control`. Nothing leaks and
nothing is ever served at those paths, so the harm today is nil. It is decided
for one reason: the rule "no error and no miss outside `/api` is cacheable" is
then true without exception, and a test can assert it for every response class,
as ADR-010's tests already do for `/api`. The change is one line in the root
not-found handler and the one assertion that pins the header's absence today
(`apps/server/test/server.test.ts`, case 31, "stays a plain 404"); the body and
type that tell those paths from `/api` are unchanged. It is owed to a small
task.

Every response from a bundle route, a hit, a miss, the 503, the redirect and a
refusal on a bare prefix, carries exactly:

- `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src
  'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src
  'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Cross-Origin-Resource-Policy: same-origin`.

No response outside the two prefixes carries these four headers, and no bundle
response ever carries `Strict-Transport-Security` (ADR-010 rule 6), an
`Access-Control-*` header (rule 4) or `Set-Cookie`. The headers are set by hand.
No security-header plugin is installed, because its defaults include HSTS.

The policy has no `unsafe-inline`, no `unsafe-eval`, no nonce and no `data:`
source. `form-action 'none'` is deliberate: no form in either client is ever
submitted by the browser, and a sign-in form that lost its handler cannot then
put a password in a URL.

#### 13. The clients are built to the policy, not the policy to the clients

- Vite's built HTML has no inline script or style, and each Vite configuration
  sets `assetsInlineLimit: 0`, so no asset becomes a `data:` URI. A test makes
  its own build of the real configuration and asserts both.
- Frost names system fonts only, icons are inline SVG elements, and React's
  `style={{}}` prop is a CSSOM write, which the policy does not block.
- **Each client's first import is `@pos/contracts/browser`**, a side-effect
  module that calls `z.config({ jitless: true })` before any schema is built.
  Without it zod's start-up probe calls `Function('')`; the policy refuses it,
  zod catches the refusal, the client works, and the browser reports a
  `securitypolicyviolation`, which is the event the harness checks for. The
  server never imports that module; it has no policy. A unit test per client
  holds the import first, and the harness's case A3 is the proof in a browser.
- A violation is a defect in the client, never a reason to widen the policy.

#### 14. A bundle request touches no session, no cookie and no database

The Host check of ADR-010 rule 3 applies to every request, bundles included.
The same-origin check does not, and must not: a bundle request is a navigation,
often with `Sec-Fetch-Site: none` or `cross-site` (a bookmark, a link), and it
reads and writes nothing. `rpos_cid` is neither issued nor read on a bundle
request (FR-A7's first contact is the first API request). The two session
cookies are scoped to their API paths and are never sent with a bundle request.
With PostgreSQL stopped, both shells still load, and then say the system is
unavailable.

#### 15. An error outside `/api` is plain text

ADR-010 rule 1 already says that outside `/api` an error or a miss is not the
envelope and obeys the same prohibition. As built, the error handler branches on
the path: under `/api` the envelope; outside it `text/plain`, wording fixed by
status, `no-store`, nothing from the request or the exception. The refused-Host
sentence names the server's own origin from configuration ("This application
answers only at https://localhost:8443."), because that is where a person who
typed `127.0.0.1` will look. These sentences are server text for a wrong
address, not screen copy; the designer may revise them. Responses the framework
writes before routing stay the envelope whatever the path, as ADR-010 says.

### Part 3. The client rules

#### 16. One request path per client

The transport core is one package, `@pos/api-client`: pure TypeScript, no React,
no DOM beyond `fetch` and `AbortSignal`, with `fetch`, the monotonic clock and a
timer injected at construction. ARCHITECTURE §2.1 permits it as an
authentication primitive; it is neither a shell nor a route manifest. What the
two clients do differently with a result (the POS's sign-in screen or M-6 on
`SESSION_IDLE`) stays in each client.

- **Each client constructs exactly one instance, in one module**, and only that
  module imports the package's constructor. No other source file in either
  client calls `fetch`, a console, browser storage, `document.cookie` or a
  beacon; a recursive source scan holds it.
- **Requests are addressed by route-table entry**, never by a free URL string.
  The route table (method, path, `interactive`) lives in `@pos/contracts`, and
  a server test holds it equal to the registered API routes in both directions.
- **Each client has one API module that maps every route of its own surface,
  and health, through an exhaustive mapped type.** A route added to the table
  without a function there is a compile error in that client. When Phase 2 adds
  its first command, the server test fails until the table has it, then the POS
  fails to compile until its API module declares it: that is the moment the
  builder wires the call and deletes the stand-in, in the same task. A client
  cannot name a route of the other surface.
- Every request is to a relative path, with `credentials: 'same-origin'`,
  `cache: 'no-store'` and `redirect: 'error'`, and has a timeout (ten seconds;
  Argon2id is the slowest thing it waits for). A body is JSON, checked against
  the shared request schema **before** it is sent, so a malformed PIN or an
  empty password never leaves the client. A request with no body sends no
  `Content-Type`. No credential is ever placed in a URL, and the core has no way
  to add a query string to a credential route.
- `@pos/contracts` holds only data: types, schemas (the requests, both session
  views, the error envelope), the header name and the route table. No function
  that performs a request belongs there, because the server imports it.

#### 17. The anti-CSRF token lives in the core's closure and nowhere else

Not in React state, the DOM, storage, a log or a result. A session view returned
to a client is every field except `csrfToken`, at the type level and at run
time. The token is replaced by every session view the core adopts and sent on
every request that is not `GET` or `HEAD`. At the POS it is dropped when the
session ends, `SESSION_IDLE` included. At the back office it is **kept** through
`SESSION_IDLE`, because M-6's request needs it.

#### 18. A tab never acts as, or shows, a person it did not sign in

Two tabs of one client in one profile present one cookie. If the second tab
signs in, the first tab's token no longer matches the cookie, its next mutation
is refused, and `me` answers for whoever signed in second. An unconditional
retry would carry out the first tab's command as that person, under a name the
first tab was not showing. In Phase 0 the mutations are session routes and the
harm is small; from Phase 2 it would be a void or a refund attributed to the
wrong actor, which is B-13. The rules are set now, in the one place.

- **The retry.** On `CSRF_REFUSED` the core reads `me` once (single-flight) and
  retries the request once, **only if `me` names the same `staffUserId` the core
  held when the request was sent**. If it names anyone else, or the core held
  nobody, nothing is retried and the result is that the session is gone. A
  second refusal after the retry is not retried again.
- **No release or logout on another person's cookie.** When the session now
  names someone else, the core sends nothing to end it: the cookie belongs to
  another tab's session, and ending it would sign that tab out.
- **Obsolete responses change nothing.** The core keeps a session generation,
  advanced when a session is installed or ends. A response that settles under a
  different generation from the one it was sent under adopts no token, actor or
  deadline, drops none, moves nothing and announces nothing; if it would have
  applied a session view or a session end, its result is `session-gone`. A
  back-office `SESSION_IDLE` is not an end and does not advance the generation,
  so a re-authentication sent before the idle still renews. A session recovered
  by `me` into an empty core advances the generation but is not an install, so a
  sign-in already in flight still installs when it settles.
- **The client follows the core, and never re-signs itself in.** When the core
  announces that the session now names a different person, the tab shows its
  sign-in screen as for `UNAUTHENTICATED` (POS-01 *session invalidated*, BO-01
  *Session ended*), sends nothing, and sends no `activity` until a sign-in in
  this tab. **Only the first lookup, while the tab is starting, may recover a
  session from nothing; after that, only a sign-in in this tab signs it in.** A
  local revision, advanced on every change of phase, discards any session read
  that settles after the phase it was sent under.
- **At M-6, the dialog names the person the core holds, or it is not shown.**
  If the core's actor differs from the idled person (because a stale read was
  adopted while an other-manager sign-in was in flight, or for any reason), the
  tab goes to BO-01 *Session ended*, and sends no re-authentication or logout
  under someone else's token.

#### 19. One cookie-changing request at a time per tab

The core does not reconcile concurrent sign-ins with the browser's cookie: a
successful sign-in that the core judges obsolete has still changed the cookie.
Every observed sequence fails closed (the next mutation is refused, `me` names
another person, the session ends, nothing is replayed), and the owner accepted
it on 2026-10-14 on that basis. So each client sends at most one sign-in,
re-authentication, release or logout at a time: while one is in flight, every
control that would send another is inert, and the flag's clearing is published
into whatever phase the screen is in when the request settles. Two tabs remain
able to race; that is an accepted risk (*Risks accepted for the MVP*), and rule
18 is what keeps it from becoming an action under the wrong name.

#### 20. Failures: switch on the code, ask health, never resend

The core returns a result and never throws for something the server said:
success, with a value checked against its schema; *refused*, with the parsed,
per-code envelope; *failed*; *unavailable*; *invalid-request* (a body that
failed its schema and was never sent); or *session-gone*. An envelope carrying
`INTERNAL` or `UNAVAILABLE`, a non-2xx with no parseable envelope, a 2xx whose
body fails its schema, a timeout and no response at all each lead to one
`GET /api/health`: 200 makes the result *failed* ("something went wrong"); 503
or nothing makes it *unavailable* ("the system is unavailable"). **The original
request is never resent automatically**: a command may have been applied, and
telling "certainly not applied" from "unknown" is Phase 2's idempotency design.
The core keeps no response text and writes to no console.

Each client maps every `ErrorCode` to a state through one `switch` with a
`never` check, so a code added in a later phase fails compilation in each client
until it has been given a state.

#### 21. The server is the only clock

The core keeps one idle deadline on the page's monotonic clock
(`performance.now()`, never `Date`). A session view sets it to the moment the
request was **sent** plus `idleRemainingSeconds`; a 2xx from a route the table
marks interactive sets it to the moment that request was sent plus
`idleSeconds`. Nothing else moves it. Reckoning from the moment of sending is the
conservative side: the server stamped the session at or after it.

**The countdown never ends a session.** At the deadline, and whenever the page
becomes visible again, the client reads `me`, which is not interactive and
extends nothing; the server's answer decides. Any request answered
`SESSION_IDLE` or `UNAUTHENTICATED` ends the session on screen at once,
whatever the countdown says. No client holds a literal idle limit or cooldown.

**`activity` is sent only from real input**: one capture-phase listener for
`pointerdown` and `keydown` (and `wheel` at the back office), limited by the
leading edge of a client-side window (five seconds at the POS, sixty at the back
office; client constants, not policy), with no trailing send, because a trailing
send is a timer. The listener reads nothing from the event, neither the key nor
the target, so it cannot become a channel for the digits a manager types at
M-1. The request has no body. Nothing is sent while the back office is idle, while
a logout is in flight or unconfirmed, or after a session has ended.

#### 22. Ending a session on screen, and the work behind it

- **POS release goes to POS-01 whatever the server answers.** A cashier who
  pressed Release must never stay signed in on screen because a request failed;
  an unreleased POS session dies within 90 seconds.
- **A back-office logout that fails stays signed in**, with a notice and "Try
  again", which sends the logout again with the token. A manager on a shared desk
  must not see BO-01 while the server's session lives on for up to thirty
  minutes, because a reload would sign straight back in. The core supports this
  for the back-office surface only; the asymmetry with the POS is deliberate.
- **The back office's working area is keyed by the signed-in `staffUserId`.**
  While M-6 is open, and on BO-01 after `UNAUTHENTICATED` or an announced change
  of person, it stays mounted and inert, so the draft, focus and selection
  survive. A sign-in as the same person shows it again as it was; a sign-in as
  anyone else changes the key and destroys it. A confirmed logout, `FORBIDDEN`,
  a reload and a discard logout destroy it. This one rule carries FR-A2b and the
  owner's rulings of 2026-10-14 and 2026-10-16, whatever screen or form was used.
- **After a reload, an idle back-office session shows BO-01, not M-6.** The
  page has no draft, no token and no name. Signing in releases the idle session.
- At the POS the routes are gated and the stores are not: the tab-local tender
  draft survives the idle lock (§6.4).

#### 23. Fixtures are chosen by the build command and proved absent

- **One compile-time constant per client, from the Vite command**: true for
  `serve`, false for `build`. The session source is chosen from it in exactly
  one module per client. `import.meta.env.DEV` is not the switch, because it
  follows `NODE_ENV`; a constant from the command cannot be flipped by an
  environment variable, a mode or a query string.
- **The proof is on the built bundle**, made twice, plainly and with
  `NODE_ENV=development`: a marker string exported only by the fixture-session
  module appears in neither output.
- The fixture source never imports the request module, so fixture mode makes no
  request. POS-01's `?state=` pictures are fixture-only.
- **Development has two modes and they never mix.** Fixture mode is the Vite
  server on `127.0.0.1` (port 5173 for the POS, 5174 for the back office) with
  no proxy and no API call. Served mode is the server on
  `https://localhost:8443` with each client's `vite build --watch` beside it; a
  reload is enough, because the HTML is `no-cache`. ADR-010's decision against a
  Vite proxy and a second origin stands.
- The fixture screens the owner accepted for Phase 0 (the floor, orders,
  payments and approval stand-ins) are reachable in a served build only after a
  real sign-in, and each leaves when its command arrives, forced by rule 16's API
  module.

#### 24. The copy belongs to the design documents

There is no `message` field (ADR-010 rule 1), so every sentence a person reads
is the client's own, chosen by code. **The designer owns the wording; the builder
places it**, row by row, from the design documents, and invents none. A state
with no designed sentence stops the builder. The server's fixed sentences
outside `/api` (rule 15) are not screen copy.

#### 25. Credentials in the client

- A PIN's digits are held in a ref, never React state, and are cleared when the
  pad unmounts. A manager-approval prompt is unmounted when the cashier's session
  ends, so nothing of an approval survives a session (B-14).
- A password field is an uncontrolled native input, read once on submit and
  emptied after every response, success included, and at every change of M-6's
  mode. It is never React state and never has a `value` attribute (React writes
  one for a controlled input); a fixed username is set as a property from a ref
  for the same reason. Fields carry the standard `autocomplete` hints; the client
  does not fight a browser's password manager (owner, 2026-10-13).
- Every form is `method="post"` with its submission prevented, so no failure of
  scripting turns it into a `GET`; `form-action 'none'` is the second lock.
- A credential is in exactly one request body, its own, and in no URL, storage,
  attribute, text node, console call or other request. Tests on each client's
  real path hold it.

#### 26. The two clients stay two

No file in either client imports from the other, in either direction; a test
holds it. Each has its own Vite configuration, `index.html`, stylesheet, route
manifest, API module and core instance (NFR-5). What they share is
`@pos/contracts`, `@pos/api-client` and `@pos/tokens`. Each client marks its
state for tests without test ids: `#root[data-session]` (`starting`,
`signed-out`, `signed-in`, and `idle` at the back office) and POS-01's
`data-lock-state`, beside accessible names.

### Part 4. The browser harness

These rules amend ARCHITECTURE §14.3 and §14.4. They bind every later phase's
browser tests.

#### 27. The harness owns its whole world

- **Its own database, port, lock and server.** Database `pos_e2e`, named in
  `db/dev.env`; port 8543; its own advisory lock; a server the harness starts
  itself from Playwright's global setup (no `webServer`, never
  `reuseExistingServer`, never `npm run dev` or `--env-file`), with an
  environment built in code and passed as an object, so nothing secret is ever
  in a process's arguments. One guard decides what "the development database"
  is, for the runner and its workers alike, and refuses `pos`, `pos_test` and
  every database the configuration names for development. A missing variable
  fails the run; nothing falls back to the development installation.
- **No installed trust.** A throwaway certificate per run; the readiness probe
  trusts exactly that certificate; the browser runs with `ignoreHTTPSErrors`.
  This is precisely the owner's own condition (the warning clicked through), so
  the harness proves that the cookies the design rests on are stored and resent
  in the state the MVP is used in. It proves nothing about the certificate
  itself: that the server speaks TLS with it and refuses plain HTTP is the
  server tests' proof. `bypassCSP` stays off, so the policy is enforced as
  served.
- **Reset by schema, never by `DELETE`.** Before every test the harness drops
  and re-migrates the throwaway database's schema. No statement touches a row;
  the next schema has an empty, trigger-protected `audit_entry` again (B-7).
  Every test starts from a fresh installation, so a cooldown cannot leak into
  the next test.
- **People through the domain functions, in test code.** A cashier and a
  manager are made by `createStaffUser` and `createBackOfficeCredential`; a
  manager always has a back-office credential. Nothing is added under
  `apps/server/src` for the harness (B-24). **Each person's display name, PIN,
  username and password are random and independent**, so no message that names
  a person can spell a credential.
- **Both clocks move together.** A test ages a session by shifting its activity
  stamp back by N seconds, relatively and for exactly one row, and advances the
  page's clock by the same N, so the client's own deadline read asks the server
  and PostgreSQL gives the verdict. No real waits. The page clock is installed
  before the first navigation and never advanced with a request in flight.
- **Every request is made by the page**, through the interface or
  `page.evaluate(() => fetch('/api/…'))` with a relative URL, so `Origin`, the
  cookies and the token are the browser's own. `page.request` and
  `context.request` are not used.
- **Assertions are on state and codes**: `data-session`, `data-lock-state`,
  accessible names and dialog titles the Handoffs list, and the envelope's
  `code` read from a response the page itself made. Never copy, never a status
  alone, never a test id. Limits come from the response or the session policy,
  never a literal.
- **No artefact can hold a credential.** `trace`, `video` and `screenshot` are
  off; the reporter is `list`; a screenshot is taken only of a signed-out shell
  before anything is typed; the server log lives in a temporary directory
  removed at teardown. **Playwright writes `error-context.md` for every failing
  test whatever the configuration says**, holding the error and a page snapshot,
  so the protection is at the source: every helper that types or passes a
  credential catches any error and throws a fixed message naming the step and the
  person's display name, with no original message, stack or cause.
- **Two engines, one pinned version.** `@playwright/test` is pinned exactly;
  Chromium is required and WebKit is a second project; an engine difference is
  reported, never branched on. Playwright's WebKit is evidence about the engine,
  not about Safari.
- **Outside `npm run verify`.** The browser run needs browser binaries, a
  database, a free port and a fresh build, and reviewers cannot run it, so it is
  `npm run test:e2e` (Chromium) and `npm run test:e2e:all` (both), each building
  the clients first. `verify` only type-checks the harness. The lead runs the
  browser suite before merging any task that touches a client, the transport
  core, the contracts, the HTTP layer, the session or credential domain, or a
  migration, and at each phase gate.

#### 28. What a browser test is for

Browser tests prove what only a browser can: the cookie premise, the policy, one
origin, the presentation of each session state, two tabs and two profiles, and
the client's half of the actor rule. Limits, throttle arithmetic, audience
refusal and log scans of the server remain the server tests' proofs, and are not
re-proved through Playwright. Every browser test also runs a credential scan:
after it, no PIN, username or password it used appears in a server log line, an
audit or security row, a console message, a URL, browser storage or a cookie,
and each appears only in the request bodies of its own credential route.

## Options considered

**The session cookie's scope.**

- *The `__Host-` prefix.* It makes a browser accept a cookie only with `Secure`,
  no `Domain` and `Path=/`. Its purpose is to stop a sibling subdomain or a
  plain-HTTP page from planting a cookie, and this origin has neither. It does
  not separate ports, so it does nothing about the one real exposure here, the
  shared `localhost` jar: another local server can set a `__Host-` cookie of the
  same name as easily as any other. And it forces `Path=/`, which cannot be
  combined with path scoping. Rejected.
- *`__Secure-`*, which permits a path. It adds only "set over a secure
  connection", which `Secure` already implies for the server's own cookie.
  Rejected.
- **Path scoping.** Chosen. It acts on every request: the POS token is never
  sent to a back-office route, to a bundle, or anywhere outside `/api/pos`, and a
  token that is not transmitted cannot be logged, mishandled or judged by the
  wrong handler. It makes AC-27 structural as well as checked, and it narrows
  what a neighbouring `localhost` server is sent. Its cost is that a neighbour
  can plant a same-name cookie on a longer path, which a browser sends first;
  the repeated-name rule answers that, and `__Host-` would not have prevented the
  equivalent overwrite of a `Path=/` cookie.
- *A `Max-Age` equal to the policy.* It would duplicate the policy, be wrong
  after a renewal, and make the browser's clock a party to the session.
  Rejected.

**Which cookie a route reads.**

- *A route that accepts either cookie*, as FR-A2c permits. It must choose a
  winner when a profile holds both, and could only choose by something in the
  request. With path-scoped cookies, a route outside both surfaces receives
  neither. Rejected (rule 3).
- *A per-route `preHandler`*, as the plan had it. A route that forgets it is
  unguarded and nothing notices. Rejected for a declaration every route must
  carry and a startup refusal.
- *Checking membership of the API context by method and path.* It was built, and
  the review showed a constrained namesake outside the context passing it.
  Rejected for object identity.

**The anti-CSRF token.**

- *A stored synchronizer token*, a column on the session row. It works, and
  costs a migration, a grant, a second secret to keep out of logs and errors,
  and an update at every renewal. The derived token has every property it has.
  Rejected.
- *A double-submit cookie.* It compares a script-readable cookie with a header,
  and in a jar any local server can write to, a cookie is the wrong thing to
  trust. Rejected.
- *A fixed custom header* (`X-Requested-With`). It forces a preflight but is not
  bound to a session, which §7.2 and ADR-010 require. Rejected.
- *An HMAC under a server secret.* It binds to nothing more than the derived
  token does, and adds a secret to manage. Rejected.
- *A token bound to the client instance before sign-in.* It is the only
  per-browser value the server knows before a session exists, and FR-A7 and
  ADR-010 forbid anything from being granted or refused by it: `ClientInstance`
  is continuity and telemetry only, and replacing it must change nothing.
  Rejected.
- *A pre-session token signed under a server secret, handed out by an
  unauthenticated route.* Anyone may ask for one, so it protects only through
  the same-origin rule the existing refusals already rest on. A second
  mechanism and a new secret for the first one's guarantee. Rejected (rule 5).

**Serving the bundles.**

- *`@fastify/static`'s own routes.* They cannot check existence per request,
  choose a cache class per path, or answer an unbuilt bundle with anything but a
  bare 404. Rejected; the plugin is used only for its file-sending function.
- *A bundle directory under the server* (`apps/server/public/<client>`), as the
  plan had it. Outside Vite's project root, so not emptied on build, needing a
  new ignore entry, and one package writing into another's tree. Rejected for
  each client's own `dist/`.
- *A root resolved from the working directory*, as the plan had it. The bundle
  then depends on where the process was started. Rejected.
- *A fallback that answers every miss, chosen by an `Accept` header, or
  registered as a root catch-all.* The first serves HTML for a missing script;
  the second trusts a header the client chooses; the third can answer `/api` or
  another bundle's path with the wrong HTML. Rejected.
- *A security-header plugin.* Its defaults include HSTS, which ADR-010 rule 6
  forbids on `localhost`. Rejected; the headers are set by hand.
- *`unsafe-inline`, a nonce, or `unsafe-eval` in the policy.* Each widens what
  an injected script may do, for a client that needs none of them. The zod
  probe was answered by switching zod, not the policy. Rejected.

**Development.**

- *A Vite proxy, or a second trusted origin in development.* ADR-010 rejected
  both: the browser would be on another origin, the guard would learn an
  exception, and `Secure` cookies and `SameSite` behave differently over
  `http`. Nothing here reopens it. Served mode uses the built bundle with a watch
  build beside it.
- *Fixtures selected at run time* (a query string, an environment variable, a
  flag in storage). Any of them can be flipped in a served build, which would
  then sign in as a fixture person on the real origin. Rejected.
- *`import.meta.env.DEV` as the switch.* It follows `NODE_ENV`, so a build made
  with `NODE_ENV=development` would ship the fixture session; the red proof
  showed exactly that. Rejected for a constant from the build command.

**The client.**

- *One hand-kept wrapper per client*, held to a shared table of test cases. It
  keeps the clients separate in source, and loses because the rules it would
  hold are security rules that must be identical, and a rule kept in two places
  is the form drift takes (§16 lists that risk). Rejected for one package with
  no user interface.
- *An unconditional retry after `CSRF_REFUSED`.* It carries a tab's command out
  as whoever signed in last in the profile. Rejected for the same-person rule.
- *Releasing the session when `me` names someone else.* It would end another
  tab's session. Rejected.
- *A client-side idle decision*: the client ends the session when its own
  countdown reaches zero, from a hard-coded 90 or 1800. The numbers would exist
  in a second place, and after a reload a client starting at 90 would show time
  the server had already taken away. The browser clock would become an
  authority, which §14.4 forbids. Rejected for durations from PostgreSQL and a
  countdown that only ever asks.
- *A trailing activity send, or activity from a timer, focus or visibility.*
  Each lets something other than a person extend a session (FR-A2b). Rejected.
- *A back-office logout that goes to BO-01 whatever the answer*, as the POS
  release does. On a shared desk the server's session would live on for up to
  thirty minutes behind a screen that says it ended. Rejected for the back
  office only.

**The browser harness.**

- *The plan's Task 12 harness.* A `webServer` that starts before the database
  it needs exists and, with `reuseExistingServer`, attaches to the development
  server on 8443 and so to the development database; `npm run dev`, whose
  `--env-file` silently fills any forgotten variable with the development value;
  a seeder in production source (B-24); resets by `DELETE` from tables that
  refuse it, `audit_entry` among them (B-7); and a database password on a
  command line. Rejected whole.
- *Trusting the leaf certificate in the browser*: the system keychain, or
  Chromium's SPKI flag. The keychain is installing trust, which the kit never
  does (owner, 2026-10-08). The flag needs a persistent profile, which is a
  single context and destroys the two-profile shape, and WebKit has no
  equivalent. Both would test a condition the owner is not in. Rejected for
  `ignoreHTTPSErrors`.
- *The developer's own certificate.* The run would depend on `npm run cert`
  having been run on that machine and on a directory outside the tree. Rejected
  for a throwaway pair per run.
- *`page.request` for API probes.* Whether it sends `Origin` is undocumented,
  and any token it carried would be one the test supplied, which is the thing
  being tested. Rejected for requests made by the page.
- *Ageing a session to "now minus N".* It would overwrite the very fault a test
  looks for (a poll that wrongly counted as activity). Rejected for a relative
  shift.
- *Masking credentials in Playwright's artefacts.* No such option exists, and
  `error-context.md` is written regardless of configuration. Rejected for
  credentials no message can spell.
- *Running the browser suite inside `npm run verify`.* It would make `verify`
  flaky or unrunnable for most agents, and an unrunnable check gets skipped.
  Rejected.

**Where the rules are recorded.**

- *In the builders' task files.* Each is read by one builder. Rejected, for the
  reason ADR-010 gave.
- **An ADR, with the architecture amended to match.** Chosen.

## Consequences

- Every later API route inherits the declaration, the startup refusals, the
  guard, the token check and the codes by being registered inside the API
  context with a declaration. A route that needs a session of both audiences is
  two registrations of one handler.
- Every later client screen inherits one request path, the retry rule, the
  generations, the clock, the exhaustive code map and the fixture switch by using
  the one core instance through its client's API module. A new error code fails
  compilation in each client until it has a state; a new route fails compilation
  in its client until it has a function.
- Phase 2's first command adds a route-table entry marked interactive, an API
  module function in the POS, and the deletion of its stand-in, in one task.
  Every command is then itself interactive, so an input that follows one inside
  the activity window sends nothing more.
- **A Phase 2 command can now be refused `CSRF_REFUSED` and retried once, as the
  same person only.** Commands carry idempotency keys (§8); the retry sends the
  same request, so the idempotency design must treat the retry as the same
  attempt. Nothing here anticipates that design.
- A literally shared read route, a cross-origin page calling the API, a browser
  form post and a cookie with a lifetime are each **not possible** under this
  record; each needs a superseding ADR.
- A client route may never begin with `assets` or end in a segment with a dot.
- The back office and the POS end sessions differently on a failed request
  (rule 22), deliberately.
- A browser test that needs a person makes one. No served check needs a real
  person's credential, and no browser test may drive the approval stand-ins as if
  they verified (B-14).
- The root's 404 gains `no-store` in a small later task (rule 12).
- Rules 2, 4, 5, 11, 12 and 27 are written for a `localhost` origin on a
  loopback listener with a click-through certificate. The pre-production gate
  (§3.2) changes all three, and must bring an ADR that supersedes this one where
  they change: a real host name ends the shared jar but not the two-tab case
  (below), may make `__Host-` worth its cost, and replaces `ignoreHTTPSErrors`
  with trust that is installed deliberately.

### Risks accepted for the MVP

Each rests on the server being loopback-only on the owner's own machine, and is
to be reconsidered at the gate before any networked or production use
(ARCHITECTURE §3.2).

- **Two tabs of one client share one session cookie** (owner, 2026-10-14). A
  sign-in in one tab ends the other tab's session, and two cookie-changing
  requests from two tabs can leave a core's token and the cookie naming
  different people. Every observed sequence fails closed, and rule 18 keeps a
  tab from acting as, or showing, the other person. Unlike the shared
  `localhost` jar, **this does not end when the origin becomes a real host
  name**: two tabs of one profile share a jar on any host. It needs its own
  review at the gate, which is why it is a separate clause in §3.2 rather than a
  part of the shared-jar clause.
- **A browser may save a manager's back-office password** (owner, 2026-10-13).
  The application stores no credential, and browsers largely ignore a page's
  request not to offer saving. On a machine other staff can reach, a saved
  password is the back office left open.
- **The sign-in routes have no anti-CSRF token** (owner, 2026-10-19; rule 5). A hostile
  page that could get a JSON request past the browser's cross-origin rules and
  past the origin refusal could sign the victim's profile in as an account the
  attacker holds. Nothing known does that; the attacker would need a valid PIN
  or manager password; and an open tab would go to its sign-in screen rather
  than act as that account. The defence rests on the same-origin refusal alone.

One reading recorded so that it is not mistaken for an oversight: a demoted
manager whose back-office session idles is answered `INVALID_CREDENTIALS` at
M-6 for their correct password, and can lock their own account for five
minutes. That is ADR-009 §1 as written.

### Not decided here

- **Whether a command's failure was "certainly not applied" or "unknown"**, and
  so whether `INTERNAL` should ever be split, and how a command is resent: Phase
  2, with the idempotency design. Rule 20 resends nothing until then.
- **A role on a POS route.** No POS route needs one; the declaration gains the
  field in the phase that first does, if any.
- **`VALIDATION_FAILED` details.** If a Phase 1 form needs a field list, its
  consult should build it by intersecting issue paths with the schema's own keys,
  so a client's unrecognised key can never appear in it, typed as a union of
  those literal keys.
- **A faster development loop.** If `vite build --watch` proves too slow once
  Phase 1 has screens against real routes, the arrangement ADR-010 left open
  (the server proxying a bundle path to Vite behind an explicit flag, the browser
  staying on the one origin) is designed then.
- **The fixture pictures of the other POS screens** (the floor, the order, the
  settlement and closed-order screens) still gate their `?state=` navigation by
  `import.meta.env.DEV`, so a served build made with `NODE_ENV=development` shows
  it. Rule 23 binds the session source, and those screens are the owner's
  accepted Phase 0 stand-ins; each switch goes with its screen's stand-in in
  Phase 2. A later task that keeps a picture switch past then must use the
  build-command constant.
- **Reconciling cookie-changing requests across tabs** (for example a channel
  between tabs). The gate.
- **Case-insensitive file systems.** On macOS `/pos/Index.html` is served from
  `index.html`; nothing outside the root is reachable and only the cache class
  could differ. Not addressed.
- **A non-JSON success response** (an export, a rendered document) remains the
  question ADR-010 left for the phase that first wants one.
