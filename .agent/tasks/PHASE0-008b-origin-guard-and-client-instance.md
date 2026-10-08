---
id: PHASE0-008b
title: The request boundary — Host and origin guard, and the client-instance cookie
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-008a]
owns: [apps/server/**, packages/contracts/**, package.json, package-lock.json]
status: not-started
cycles: 0
---
# PHASE0-008b — The request boundary

**Written** 2026-10-08 by the lead, from the architect consult ARCH-010
(`.agent/reviews/ARCH-010-https-server.md`, by `architect10`, 2026-10-08), which supersedes plan
Task 8 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1975-2315`). This is the second
half of the split: PHASE0-008a built the process, TLS, the loopback guard, the logger, the error
envelope and health. This task adds the first cookie and the first unauthenticated database
write, and the guard that stops another site from causing either. The consult's binding sections
are copied below **verbatim**. Touches identity and B-14: the owner looks before merge.

## Objective

Every request the server receives carries `Host: localhost:<port>` or is refused; every API
request passes a same-origin check before anything else in the API context runs, or is refused
with 403 `ORIGIN_REFUSED` having written nothing; and every API request except health leaves the
handler a `request.clientInstanceId` that PostgreSQL returned in this request, issuing the
`rpos_cid` cookie when the browser had none, or had one naming no row. Nothing grants or refuses
anything by reading that id. When this task is done, the test cases below prove every rule
through `app.inject()` against the real tables as `pos_app`, and the lead confirms in Chrome and
Safari that the cookie is stored and returned.

## Required inputs

- **PHASE0-008a as merged** (read its task file's Handoff in `.agent/tasks/`): `buildServer({
  origin, logLevel, tls?, logStream?, apiRoutes? })`, the `/api` context, `AppError`,
  `StartupError`, `@pos/contracts`'s `ErrorCode`, the health route, `Cache-Control: no-store` on
  every API response, and the log rules (no header or cookie is ever handed to the logger).
- **Built domain:** `writeSecurityEvent` (`audit.ts`) and `createSession` (`session.ts`) take
  `clientInstanceId?: string`; `writeSecurityEvent` throws on `null`.
  `db/migrations/0003_client_instance_and_actor_session.sql`: `client_instance` (`id` uuid default,
  `first_seen_at`, `last_seen_at`); `pos_app` has SELECT, INSERT, UPDATE, no DELETE.
- **Contract:** PRD §2 (ClientInstance), FR-A2c, FR-A7; `docs/ARCHITECTURE.md` §3.1, §5.1, §7.2;
  `docs/BOUNDARIES.md` B-13, B-14.
- LESSONS: PostgreSQL's `now()` is the transaction's start time and goes stale after a lock wait;
  every time read after a possible wait uses `clock_timestamp()`.

## From ARCH-010 (verbatim; binding)

The numbered questions are the consult's; rules refer to them by number.

### 4. The client instance

#### What it is for, and what that rules out

PRD §2 and FR-A7 make it "UI continuity and security telemetry only"; ARCHITECTURE 5.1 says
"never authorization". Concretely, **no branch in the server may grant or refuse anything by
reading or comparing a client-instance id.** It is stored, and that is all. That rules out:

- counting or throttling per client instance, or resetting a count when one changes (FR-A5,
  AC-19);
- binding a session to it, in either direction: a session is neither accepted because the id
  matches nor rejected because it differs (FR-A2c);
- treating a "known" browser as trusted: no remembered manager, no skipped PIN, no relaxed
  approval (B-14);
- naming it as an actor or as evidence of who acted (B-13);
- using it as the checkout-lease holder (§6.3), as an anti-CSRF token, or as a signing key;
- putting it in a response body or a client-readable cookie.

#### The cookie

| | Value | Reason |
|---|---|---|
| Name | `rpos_cid` | Cookies are not separated by port. Every program serving on `localhost` shares one jar with this application, so a generic `cid` can collide with another project's |
| Value | the row's `id`, in PostgreSQL's lower-case form | Opaque, server-issued (FR-A7) |
| `HttpOnly` | yes | FR-A7 |
| `Secure` | yes, the literal `true` | §7.2; `'auto'` would drop it under `inject()` |
| `SameSite` | `Strict` | §7.2 says cookies are `Strict`; ARCH-008 read it as covering this one, and I agree |
| `Path` | `/` | §3.1: it describes the browser profile, not either session |
| `Domain` | absent | Host-only |
| `Max-Age` | 34,560,000 seconds (400 days) | Browsers cap a cookie's life at about this. Set once, at issue, and not renewed |

It is not signed. A signature would prove the server issued the value, which the row lookup
proves already, and would still not prove the row exists.

When the cookie expires the browser gets a new identity. That is harmless precisely because
nothing depends on it.

I did not use the `__Host-` prefix. It would add nothing for a cookie that carries no
authority. Whether the two session cookies should use it is Task 9's question, and it trades
against path scoping (question 7).

#### Where the hook runs

**Inside the API context only, and not for health.** Every API route is registered in one
encapsulated Fastify context under `/api`. The hooks that context adds apply to all API routes
and to nothing else. Three reasons not to make it global, as the plan does:

- A page load fetches many assets in parallel. With no cookie yet, each would insert a row and
  set a different cookie; the last one wins and the rest are orphans.
- Every asset request would cost a database round trip.
- With `SameSite=Strict`, a navigation that starts on another site arrives without the cookie.
  A global hook would mint a new identity and overwrite the real one, which is the opposite of
  continuity.

`/api/health` declares `config: { clientInstance: false }` and the hook skips it. A readiness
probe is not a browser profile; the plan's tests in fact demonstrate the leak, minting a row
from a bare health request.

FR-A7 says "on first contact". I read that as the browser's first API request, which happens
before a PIN can be submitted and is the first moment anything could be attributed to the
profile. No behaviour a person can observe differs from issuing on the first document request.
I name the reading so that it is not mistaken for an oversight.

Two cookie-less API requests arriving together still make two rows, and the browser keeps one.
Both ids are real rows, so nothing fails. I do not ask for this to be prevented.

#### Creating and touching the row

For a request that reaches the hook:

1. Read the cookie. If it is absent, or is not exactly thirty-six characters in the canonical
   lower-case UUID shape, go to step 3 **without a query**. A malformed value sent to a `uuid`
   column is an error from PostgreSQL (`22P02`), not an empty result.
2. Touch and check in one statement:

   ```sql
   UPDATE client_instance
      SET last_seen_at = GREATEST(last_seen_at, clock_timestamp())
    WHERE id = $1
   RETURNING id
   ```

   A row came back: `request.clientInstanceId` is **that returned value**, and no cookie is set.
3. No row: `INSERT INTO client_instance DEFAULT VALUES RETURNING id`, set
   `request.clientInstanceId` to the returned value, and set the cookie.

An absent cookie, a malformed one and a well-formed one that names no row are therefore the same
case: a new identity, issued silently. None is an error, and none is logged as one, because a
reset database or a cleared browser is ordinary.

On the clock. Each statement runs on its own through `query()`, so the insert's `DEFAULT now()`
is the statement's own start, with no lock wait before it. The update is different: it can wait
for a row lock held by another request from the same browser, and `now()` would then be the time
before the wait. `clock_timestamp()` is read after the lock is taken, and `GREATEST` keeps the
column from ever moving back. This follows `session.ts` and `throttle.ts`.

**Touch on every request the hook covers, not only interactive ones.** `last_seen_at` says when
the browser profile was last in contact. A poll is contact. The `interactive` flag is about a
person's activity on a session (FR-A2b) and is declared per route in Task 9; tying this column
to it would make Task 8 depend on a declaration that does not exist yet, and would give the
column a meaning the PRD does not. The cost is one single-row update per API request, on a
column no index covers, at a few requests a second from one browser. I considered touching at
most once a minute and rejected it: it needs a second statement or a data-modifying CTE and a
test that ages rows, to save writes nobody will notice. An update of a non-key column does not
block the foreign-key checks of `actor_session` and `security_event` inserts.

#### How the id reaches the domain

`request.clientInstanceId` is typed `string | undefined`. A handler passes it as
`{ clientInstanceId: request.clientInstanceId }` to `verifyPinThrottled`,
`verifyPasswordThrottled` and `createSession`, whose parameters are already optional strings.
Because the value is always one PostgreSQL returned in this request, and `pos_app` cannot delete
the row, the foreign-key failure of PHASE0-006 case 16 and PHASE0-007b case 24 cannot be reached
through HTTP. The task proves that with a route that presents an unknown UUID and then writes a
security event.

It is `undefined` only where the hook did not run (health). No handler may read the cookie
itself.


### 7. What of section 7.2 belongs to Task 8, and what to Task 9

**Task 8 lays the parts that do not depend on a session existing. Task 9 declares and adds the
parts that do.** The test I applied: can the mechanism be proved in Task 8 with the routes Task
8 has?

| Section 7.2 | Where | Why |
|---|---|---|
| Origin validation | **Task 8b**, for every API request | It needs no session, it protects Task 8's own unauthenticated insert, and a global default cannot be forgotten by a route |
| JSON as the only body type | **Task 8a** | Removing Fastify's `text/plain` parser means a cross-site HTML form cannot produce a body the server reads. It is one line and belongs with the server's construction |
| No CORS, ever | **Task 8a**, as a rule | One origin is the design (§3.1). No `@fastify/cors`, no `Access-Control-*` header, no answer to a preflight |
| The API context | **Task 8a** | One encapsulated `/api` context is where Task 9 adds its route check |
| Session cookie names, attributes, path | Task 9 | No session cookie exists in Task 8 |
| Selecting the cookie by the route's audience | Task 9 | Needs the route declaration |
| The anti-CSRF token | Task 9 | It is bound to a session, and its shape depends on the cookie decisions |
| `interactive` per route, and a route that fails to declare it | Task 9 | The declaration's fields are Task 9's; Task 8's one route would only guess them |

I considered having Task 8 build the route-declaration check (an `onRoute` hook that refuses to
register an API route with no `audience` and `interactive`) and decided against it. The
mechanism is easy; the fields are the design, and they are what ARCH-008 §6 reserved for Task
9's consult. Health gains its declaration when the check arrives, a one-line change.

#### The same-origin guard

The server is built with its public origin, `https://localhost:<port>`. The host name is a
constant in the code; only the port is configuration. The guard is two refusals.

- **Host, on every request the server receives** (root level, so it will cover the bundles
  too): the `Host` header must be exactly `localhost:<port>`. This is the cheap defence against
  a hostile name that resolves to `127.0.0.1`; TLS already stops most of that, since the
  certificate would not match. It also means `https://127.0.0.1:<port>` is refused, which is
  deliberate: that is a second origin with a second cookie jar and a second client instance for
  the same browser.
- **Origin, on every API request** (in the API context, before the client-instance hook):
  - `GET` and `HEAD`: refused when a `Sec-Fetch-Site` header is present and is neither
    `same-origin` nor `none`. Absent is allowed, so a readiness probe works.
  - Every other method: the `Origin` header must be present and equal the server's origin
    exactly, and `Sec-Fetch-Site`, when present, must be `same-origin`. A missing `Origin` on a
    mutating request is refused. Every current browser sends it; a test sets it through a
    helper.

Refusal is 403 `ORIGIN_REFUSED`, and nothing is written. **Passing the guard grants nothing.**
FR-A2c says a client-supplied header alone is never sufficient; these headers are only ever a
reason to refuse.

The guard has no development mode and no allow-list. That decides question 8.

#### Two things for the Task 9 consult to know now

- Session cookie names should be project-specific for the same reason as `rpos_cid`.
- `__Host-` and path scoping are alternatives. `__Host-` forces `Path=/`; scoping the POS
  cookie to `/api/pos` and the back-office cookie to `/api/back-office` keeps each token off the
  other surface's requests. The consult should pick one deliberately.

**Never send `Strict-Transport-Security`.** HSTS is recorded per host and ignores the port. Sent
from `localhost`, it would force HTTPS on every other `localhost` port in that browser, the
owner's Vite server on 5173 among them.

## For the task file (ARCH-010, verbatim; binding)

### PHASE0-008b: rules

1. Dependency: `@fastify/cookie` at its current major. No signing secret.
2. The server's origin is `https://localhost:<port>`; the host name is a constant.
3. The Host check is at the root and the origin check in the API context, both as in question
   7. Neither has a development mode. A refusal writes nothing.
4. The client-instance hook runs in the API context after the origin check, for every route
   that does not declare `config: { clientInstance: false }`. Health declares it.
5. The cookie is exactly the table in question 4. `secure` is the literal `true`.
6. A malformed cookie value reaches no query. `request.clientInstanceId` is always a value
   PostgreSQL returned in this request, typed `string | undefined`, never `null`.
7. The two statements are those in question 4. `now()` does not appear in the module.
8. No branch reads `request.clientInstanceId` to decide anything. No handler reads the cookie.
9. `ErrorCode` gains `ORIGIN_REFUSED`, and nothing else.
10. No migration: `0003` already has the table and the grants.

### PHASE0-008b: test cases

Reset with `resetDatabase()`; age or inspect rows through `ownerQuery`. A probe route registered
through `apiRoutes` returns `request.clientInstanceId`.

1. A first API request with no cookie creates one row and sets `rpos_cid` to its id, with
   `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=34560000` and no `Domain`. The
   probe saw that id.
2. With that cookie, a second request sets no cookie, creates no row, leaves `first_seen_at`
   alone and moves `last_seen_at` forward (the row aged first).
3. A well-formed UUID that names no row: a new row, a new cookie, and the probe saw the new id.
4. Malformed values (empty, `abc`, an upper-case UUID, a UUID in braces, ten thousand
   characters, a quote and a semicolon) each get 200 and a new identity, with the pool's
   `query` never called with the presented value.
5. `last_seen_at` set an hour ahead by the owner is not moved back.
6. Health with no cookie creates no row and sets no cookie.
7. A probe that presents an unknown UUID and then calls `writeSecurityEvent` with
   `request.clientInstanceId` succeeds, and the event row references the new id.
8. A probe that passes `request.clientInstanceId` to `createSession` type-checks and stores it.
9. `GET` with `Sec-Fetch-Site: cross-site`, and with `same-site`, is 403 `ORIGIN_REFUSED` and
   creates no row. With `same-origin`, `none`, or no header, it passes.
10. `POST` with no `Origin`, with `http://localhost:<port>`, with another port, with
    `https://127.0.0.1:<port>` and with `null` is refused. With the exact origin it passes.
11. A `Host` of `127.0.0.1:<port>`, of `evil.example:<port>` and of `localhost` with another
    port is refused, on an API route and on a path outside `/api`.
12. `grep` finds no `now()` in `client-instance.ts`.

### PHASE0-008b: red proofs

1. Remove the shape test before the query: case 4 becomes a 500.
2. Assign the cookie's value instead of the returned id: case 4 on the upper-case UUID, or
   case 3.
3. Type the property `string | null` and default it to `null`: case 7 throws `invalid security
   event: clientInstanceId`.
4. `sameSite: 'lax'`: case 1.
5. Remove health's opt-out: case 6.
6. Drop `GREATEST`: case 5.
7. Register the client-instance hook before the origin check: case 9 finds a row.
8. Compare `Origin` by host name only: case 10 on the `http://` origin.

### Acceptance beyond `npm run verify` (ARCH-010)

- 008b: **a browser check by the lead**, because no test can make it. Open
  `https://localhost:8443/api/health` and a probe-free API path in Chrome and in Safari, click
  through the warning, and confirm in the developer tools that `rpos_cid` is stored with its
  attributes and is sent on the next request. If a browser does not store a `Secure` cookie on
  a clicked-through certificate, that is a blocker to bring back to the architect, not to work
  around.

### The Handoff must carry forward (ARCH-010)

- For Task 9: its routes register inside the API context; `request.clientInstanceId` goes to the
  domain as it is; the origin guard already covers its mutating routes, and the anti-CSRF token
  is still owed; no credential in a URL; an `AppError` is the only way a code reaches a client;
  session cookie names are project-specific; AC-19 and AC-27 are still open.
- For Task 11: nothing is served outside `/api` yet; the not-found handler is plain there; the
  Host check already covers bundles; no HSTS; Vite gets no proxy.
- For Task 12: the certificate is in the developer's directory, not the tree; no `PIN_PEPPER`
  literal in a configuration file; no `DELETE` in a seeder.

## Lead rulings

1. **Files.** `apps/server/src/http/origin.ts` (the Host and origin checks) and
   `apps/server/src/http/client-instance.ts` (the hook and the `request.clientInstanceId`
   declaration); tests in `apps/server/test/origin.test.ts` and `client-instance.test.ts`, named
   by the consult's case numbers (1 to 12).
2. **Existing tests.** PHASE0-008a's `server.test.ts` and `log-scan.test.ts` send requests through
   `inject()`, which sends `Host: localhost:80` unless told otherwise. Once the Host check exists
   they need a `Host: localhost:<port>` header (and an `Origin` on mutating requests) to keep
   passing. Adding those headers through one shared test helper is the expected change, merged
   with any headers a test already sets; no assertion in them may be edited. `loopback.test.ts`
   case 4 listens on a random port but builds the server with the origin
   `https://localhost:8443`, so its HTTPS request sends `Host: localhost:8443` (the configured
   origin's port, not the listening one); its plain-HTTP half is unchanged.
3. **Health** declares `config: { clientInstance: false }` and is still subject to the Host check.
4. **The browser check is the lead's** (acceptance, below). The builder says in the Handoff that it
   was not made.
5. **Carried from PHASE0-008a by the owner (2026-10-08).** (a) An absolute-form request target
   (`GET https://localhost:8443/api/nope HTTP/1.1`) reaches API routes, but an API miss in that form
   gets the plain 404 without `no-store` (008a's final review). Refuse an absolute-form target at
   the root Host check, through the envelope, before routing, or classify it as the router does;
   say which, and test a matched route, an API miss, an encoded API miss and an outside miss in that
   form at the parser boundary. (b) ADR-010 rule 1 (accepted): replace Fastify's default
   `clientErrorHandler` body with the envelope or no body, and the 503 sent while closing likewise;
   test each over a raw socket. The lead rechecked this against 008a as merged (`development` at
   `4a69826`): `buildServer` sets no `clientErrorHandler` and has no absolute-form handling, so
   both (a) and (b) are owed here.
6. **An API miss** (a path under `/api` that matches no route) is answered by the root not-found
   handler, outside the API context's hooks. It is not required to pass the origin guard or reach
   the client-instance hook, and it must write nothing either way; the Host check still applies.
   Say in the Handoff which it does.
7. **`ORIGIN_REFUSED` declares no details.** Add its block to `error-details.types.ts` in the
   pattern of the codes already there (additions only), so case 28 keeps covering every code.

## Tests expected to change

- `apps/server/test/server.test.ts`, `log-scan.test.ts`, and `loopback.test.ts` case 4's HTTPS
  request: request headers only, through a shared helper (lead ruling 2).
- `apps/server/test/error-details.types.ts`: the `ORIGIN_REFUSED` block only (lead ruling 7).
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline of
   **56 files, 3005 tests** (the lead, at `4a69826`), the client's tests unchanged.
2. `client-instance.test.ts` and `origin.test.ts` alone are green three times in a row; the Handoff
   maps each case number to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. `grep -n "now()" apps/server/src/http/client-instance.ts` finds nothing, and `grep -rn
   "clientInstanceId" apps/server/src` shows no comparison or branch on it; the Handoff shows both.
5. The Handoff carries forward the items listed above.

## Out of scope

- Session cookies, the anti-CSRF token, route declarations (`audience`, `interactive`) and the
  authentication routes (Task 9 and its consult).
- Serving any bundle (Task 11). Any migration. `docs/` of any kind.

## Handoff
