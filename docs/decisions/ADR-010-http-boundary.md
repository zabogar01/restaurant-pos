# ADR-010: The HTTP boundary

**Status:** Accepted

**Date:** 2026-10-08

**Approved by:** Product owner

Nothing is superseded by this record. ADR-001 fixes one loopback-only Fastify
server and one origin; no accepted ADR says what that server may send, log,
parse or listen on. ADR-008 remains reserved for the deferred database-roles
decision.

## Context

Phase 0 has reached the point where the server first answers a browser. The
consult for that work (ARCH-010, plan Task 8) found that the Phase 0 plan
would have compiled into a server that could be started as plain HTTP,
answered an unexpected error with the exception's own message, logged whole
error objects, and accepted `localhost` as a bind address by comparing a
string. It also found that six of the rules needed to prevent this are not
about Task 8 at all. They bind every route written in every later phase, and
a task file is read by one builder, once.

The architecture already states the intent behind each rule, in a sentence or
less: errors "do not expose SQL, stack traces, secrets, blind indexes, PINs,
or passwords" (section 12); "one origin avoids CORS" (section 3.1); the
listener "binds only to a loopback address" and the guard "must fail closed"
(sections 3.1 and 3.2); "do not substitute loopback HTTP" (section 16). None
of those sentences says how the property is kept, and the plan shows that a
careful reader can satisfy each sentence and still break the property.

The forces are these.

- **B-12** forbids a PIN or password value in any log, error message or stack
  trace, in any form. The values that reach this server in a request body are
  exactly those. A PostgreSQL error message can quote a parameter, its
  `detail` can hold the failing row, a JSON parse error can quote the body it
  failed on, and `new URL()` on a malformed `DATABASE_URL` throws an error
  whose `input` is the string, password included.
- **B-11** forbids a PIN or password transmitted in plaintext. On this
  deployment that is a statement about the listener: TLS or nothing.
- **NFR-1** and ARCHITECTURE sections 2 and 3.1 fix one HTTPS origin on
  `localhost` and a startup guard that rejects any non-loopback listener.
- **FR-A2c** says a client-supplied header alone is never sufficient for
  anything. A guard built from request headers must therefore only ever
  refuse.
- The framework's defaults point the other way. Fastify's default error
  handler sends `message: err.message` and logs the error object; its default
  request log includes the whole URL; `listen` with no host binds every
  interface; and Fastify writes some responses itself without calling the
  application's error handler at all.

That last point was learned from the build, not from the consult. PHASE0-008a
built the process from ARCH-010, and its review found that a malformed URL
received Fastify's own 400 body, quoting the URL and its query string, with
no `Cache-Control`, because the application's error handler never ran. It
also found that an error `details` type left open accepts an exception's
message. A rule phrased as "the error handler does X" is therefore too
narrow. The rule has to be about every response the process sends.

The owner ruled on three connected points on 2026-10-08, and this record
carries them rather than reopening them:

- `localhost` is one cookie jar shared with every other local server,
  whatever its port. This is **accepted for the MVP** (see *Risks accepted
  for the MVP*).
- The kit creates the local certificate and never installs trust. The browser
  warning is clicked through once per browser profile, and the owner may
  trust the non-CA leaf certificate on their own machine.
- FR-A7's "first contact" is the browser's first API request.

Library behaviour cited here came from the librarian, not from recall, except
where a sentence says otherwise. Where a fact could not be verified, the rule
is written so that a test proves the property whichever way the fact turns
out.

## Decision

Six rules. Each binds every route, hook, plugin and script in the server, in
this phase and every later one. None has a development mode, a test mode or a
flag.

### 1. The error envelope

Every API response that is not 2xx has exactly this body:

```json
{ "error": { "code": "THROTTLED", "details": { "retryAfterSeconds": 240 } } }
```

- `code` is one of the codes in the shared contracts package. A code enters
  that list in the task that first emits it and tests it; a code with no
  emitter is an untested promise.
- `details` is optional and is **typed per code** in the same package. A code
  that declares no details type carries none. There is no open or catch-all
  details type, because the place a string from an exception goes is the
  field that accepts any string.
- **There is no `message` field**, and no other free-text field under any
  name. What a person reads is the client's own copy, chosen by code; the
  wording belongs to the design documents.
- **No string from an exception is ever copied into a response**: not its
  message, not a property, not a stack. Only a code the server chose, and
  details the server built from its own values, leave the process. The only
  way a handler produces an error response is to raise the server's own
  application error carrying a code; everything else becomes the internal
  error code with status 500 and nothing more.

The rule covers **every response the server sends, not only those its error
handler writes.** Three layers produce responses, and each is held to it:

- *The application's error and not-found handlers.* Both are replaced. Under
  `/api` a miss is the envelope. Outside `/api` an error or a miss is not the
  envelope (a bundle path is not an API), but it obeys the same prohibition:
  nothing from the request, the URL included, and nothing from an exception
  appears in it.
- *Responses the framework writes before routing*, without calling the error
  handler: a malformed URL, an over-long parameter, a failed route
  constraint. These are taken over through the framework's own option for
  them and answered with the envelope, whatever the path, because a path that
  could not be parsed cannot be trusted to say which surface it belongs to.
- *Responses written below the framework*, where no request object exists: a
  request the HTTP parser rejects, a request that times out, a request that
  arrives while the server is closing. Each has either the envelope with a
  fixed code or **no body at all**. None has the framework's or the runtime's
  default body. Fastify's default for a parser error is a fixed JSON body with
  a `message` field; it leaks nothing, but it is a second error shape, and a
  client that switches on `error.code` would read it wrongly.

Clients treat a non-2xx response with no parseable envelope as a transport
failure with no code, exactly as they must treat a dropped connection.

Every API response, successful or not, carries `Cache-Control: no-store`.
Responses hold authoritative state about orders, money and people, and no
copy of one belongs in a cache.

The top-level key is `error` rather than a flat `{ "code" }` because section
13 has responses return authoritative state beside structured error and
warning codes: a version conflict carries the current order next to the
error, and a success can carry warnings. A named key keeps those from
colliding.

### 2. The logging allow-list

The control is that sensitive data is never handed to a logger. It is not
that the logger is configured to remove it.

- **No request body, no request or response header, and no cookie is passed
  to a logger**, on any route, at any level, on success or on error. No hook,
  handler, serializer or script does so.
- **The URL is logged as its path only, without the query string.** No later
  task may put a credential in a URL, but a serializer that cannot print a
  query string is stronger than a rule in a task file.
- **An error is logged through an allow-list, never by its message.** For an
  error the server did not define, a log line carries: the constructor name;
  `code` when it is a string (a SQLSTATE, a Node error code); for a database
  error the schema-level names `constraint`, `table`, `column` and `routine`;
  and the stack **frames only**, with the leading message line removed. It
  never carries `message`, `detail`, `where`, `hint`, `input`, `cause` or any
  other property. The frames give file and line, from which a fixed message
  can be read in the source.
- An application error raised while handling a request is logged by its code.
- The server defines a small, closed set of its own startup and
  configuration errors, whose sentences an operator has to be able to read
  ("refusing to listen on …", "the certificate has expired; run …"). Such a
  sentence may be logged only because it is fixed wording in the server's
  source combined with values that are neither secrets nor taken from a
  request: a variable's name, a file path, a refused bind address. A value
  read from the environment or a file is never among them.
- The same serializer is used on the fatal path and for uncaught exceptions
  and unhandled rejections. There is no direct write to the console anywhere
  in the server's source.
- **Redaction is a backstop only**, and is described as one wherever it is
  configured. A redaction path matches the paths listed and nothing else: a
  field named `newPassword`, or `pin` two levels down, passes straight
  through. Because B-12 forbids a value "in any form — including partially
  masked", the backstop removes the key outright rather than masking it.

The rule is proved by a log scan: distinct marker strings sent by every
channel a request has (body, malformed body, cookie, query string, a thrown
message, a thrown `detail`, a message PostgreSQL composes), with the logger
at its most verbose, and an assertion that no marker appears in any log line
or response and that the error's log line is nevertheless useful (frames and
SQLSTATE present). Section 14.3 places AC-18's log scan at this level.

### 3. One origin and its guard

The browser's origin is `https://localhost:<port>` and nothing else. The host
name is a constant in the code; only the port is configuration. That origin
is the one value an `Origin` header is compared with. `https://127.0.0.1:<port>`
reaches the same socket and is **not** an origin of this application: it
would be a second cookie jar and a second client instance for the same
browser.

The guard is two refusals.

- **Host, on every request the server receives**, bundles included: the
  `Host` header must be exactly `localhost:<port>`. This is the defence
  against a hostile name that resolves to a loopback address.
- **Same origin, on every API request**, before anything is read from or
  written to the database:
  - for `GET` and `HEAD`, the request is refused when a `Sec-Fetch-Site`
    header is present and is neither `same-origin` nor `none`. An absent
    header is allowed, so a readiness probe works;
  - for every other method, the `Origin` header must be present and equal
    the origin exactly, and `Sec-Fetch-Site`, when present, must be
    `same-origin`. A mutating request with no `Origin` is refused.

A refusal writes nothing and follows rule 1.

**Passing the guard grants nothing.** These headers are only ever a reason to
refuse. No route may treat a request as authenticated, authorized, trusted or
belonging to an audience because it passed (FR-A2c). The guard is not the
anti-CSRF token, which section 7.2 still requires on mutating routes and
which is bound to a session.

No proxy is trusted. `trustProxy` stays off and no forwarded header is read:
there is no proxy in this deployment (section 3.1), and with it on a client
could choose its own host and address.

Every cookie this application sets has a project-specific name built on the
stem `rpos_`, because the jar is shared (see the accepted risk).

### 4. JSON only, no CORS

- **JSON is the only request body type the server parses.** Fastify's
  built-in `text/plain` parser is removed, and no form, multipart or other
  parser is added. A body of any other type is refused as unsupported. A
  cross-site HTML form can send only form-encoded, multipart or plain-text
  bodies without the browser first asking permission, so a server that reads
  none of them cannot be handed a body by one.
- **There is no CORS.** No CORS plugin is installed, no `Access-Control-*`
  header is ever sent, and no route answers a preflight: an `OPTIONS` request
  gets the ordinary not-found response of rule 1, so the browser blocks the
  request that would have followed. One origin is the design (section 3.1);
  there is no second origin to allow.
- API error bodies are JSON, by rule 1.

### 5. One listening function

Exactly one function in the server's source calls `listen`, and a test that
searches the source for a second call fails the build. That function:

- **requires TLS.** It refuses to listen unless the instance was built on an
  HTTPS server. The server builder may be given no certificate, so that
  in-process tests need none, and an instance built that way cannot listen;
- **requires a loopback IP literal**: an address in `127.0.0.0/8` or `::1`,
  judged by parsing it as an IP address. Every name is refused, `localhost`
  included, along with the empty value, the wildcard addresses, IPv4-mapped
  IPv6 forms, short or numeric IPv4 forms, and zone identifiers;
- **checks twice.** Once on the configured value, before any socket exists
  and before the database is contacted; and once on every address actually
  bound, after `listen` returns, closing the server and exiting non-zero if
  any is not loopback. The first check reasons about a string and the second
  observes the socket;
- **cannot be switched off.** No flag, environment variable, `NODE_ENV` value
  or test hook disables any part of it.

The certificate and key are read from files at startup and validated before
any socket or database connection. A missing, unreadable, expired,
mismatched, CA-capable or wrong-name certificate, or a key readable by other
users, stops the process with a fixed sentence. **There is no HTTP fallback,
no HTTP listener that redirects, and no certificate generated at startup.**
The kit creates the certificate by an explicit command and never installs
trust in any store.

The browser still uses the name `localhost`. Only the bind address is a
literal: a server bound to `127.0.0.1` is reachable as
`https://localhost:<port>`.

### 6. No HSTS

The server never sends `Strict-Transport-Security`, on any response, for as
long as its origin is `localhost`. HSTS is remembered per host name and
ignores the port. Sent from `localhost`, it would force HTTPS on every other
`localhost` port in that browser profile, the owner's other development
servers among them, for as long as the header says, and long after this
server has stopped.

Nothing is lost by its absence: the only listener is HTTPS, and there is no
HTTP listener to downgrade to. A plugin that sets security headers may not be
added on its defaults; a test asserts the header's absence on every response
class.

## Options considered

**The error response.**

- *Fastify's default error handler.* Rejected. It sends `err.message`, which
  is B-12 broken by the first database error that quotes a parameter, and
  section 12 broken by the first one that quotes SQL.
- *A custom handler that keeps a `message` field*, filled with a safe
  sentence per code. The sentences would be the client's copy living in the
  server, which is the design documents' business, and the field would stay
  in the contract as the place where the next author writes `err.message`
  when in a hurry. A field that does not exist cannot be filled wrongly.
- *Problem Details (`application/problem+json`).* A standard shape, and its
  `title` and `detail` members are free text. It loses for the same reason.
- *A flat `{ "code" }` body*, as the plan had it. It collides with responses
  that carry state and warnings beside the error (section 13).
- *An open `details` object.* It was built, and the review showed it accepts
  an exception's message. Typed per code instead.
- *Covering only the error handler.* It was built, and the review showed
  Fastify answering a malformed URL itself. Every response instead.
- **An `error` object with a code, per-code details and no text, on every
  response the process sends.** Chosen.

**The control on logs.**

- *Redaction paths as the control*, as the plan had it for `pin` and
  `managerPin`. A path list cannot anticipate a field name, a nesting depth,
  or a secret inside an error's message, and it fails silently: the log line
  with the secret looks like any other. It is kept, as a backstop.
- *Logging bodies at a debug level only.* A level is a configuration value,
  and B-12 has no exception for a level.
- *The framework's default error serializer with `detail` removed.* A
  deny-list of properties has the same defect as a list of paths: the next
  library's error has a property nobody listed.
- **An allow-list: nothing sensitive is handed over, and an error is logged
  by named fields.** Chosen. The cost is that an unexpected error's message
  is not in the log, and whoever debugs it reads the frames and the source.

**The origin, in development and otherwise.**

- *A Vite proxy from `/api` to the server, with the Vite origin trusted in
  development.* Rejected. The browser is then on `http://127.0.0.1:5173`; its
  `Origin` header says so and Vite does not rewrite it, so the guard must
  learn a second origin, and an exception that exists in development is an
  exception waiting to be left on. `Secure` cookies over HTTP also fail in
  Safari, and `http` and `https` on `localhost` are different sites, so
  `SameSite=Strict` cookies would not behave as they do in the real shape.
  Development against the API uses the built bundle served by Fastify; a
  reverse arrangement, in which Fastify proxies a bundle path to Vite behind
  an explicit flag and the browser stays on the one origin, can be designed
  later without touching this record.
- *A CORS allow-list.* There is no second origin to put in it.
- *Treating `127.0.0.1` as the same origin.* It is a different cookie jar.
- *A dedicated host name such as `pos.localhost`.* It would end the shared
  cookie jar. NFR-1 and section 2 say `localhost`, and Safari does not
  resolve such names without a hosts entry. Not taken; the risk is accepted
  instead, by the owner.
- **One constant origin, a Host check on everything and a same-origin check
  on the API, with no development mode.** Chosen.

**The listener.**

- *Accepting `localhost` as a bind name*, as the plan did. The string is not
  what gets bound: the operating system resolves it at bind time, and Fastify
  may open a listener for each address it resolves to. A check on the name
  checks something other than what it protects, and resolving the name first
  and then passing the name on leaves a gap between check and use.
- *Checking only the configured value.* It would hold today. Section 3.2 asks
  for a guard that fails closed when someone later changes how `listen` is
  called, and only a check of the bound socket observes that.
- *A builder that takes optional TLS and listens either way.* Any script or
  test that built a server and called `listen` would have a plain-HTTP server
  that accepts PINs.
- *An HTTP fallback when the certificate is missing, or an HTTP listener that
  redirects.* Either one is the transport B-11 forbids, carrying a PIN on the
  first request that reaches it, and section 16 already says not to
  substitute loopback HTTP.
- *Generating a certificate at startup.* It hides an expired or replaced
  certificate behind a fresh browser warning with no explanation, teaches the
  owner to click through warnings that appear from nowhere, and puts a
  certificate tool in the startup path of every run.
- **One function, TLS required, a loopback literal checked before and after
  binding, no flag.** Chosen.

**Transport security headers.**

- *HSTS, as a default good practice.* On `localhost` it reaches outside this
  application and breaks the owner's other servers. Rejected for as long as
  the origin is `localhost`.

**Cookie prefixes.**

- *The `__Host-` prefix on this application's cookies.* The prefix makes a
  browser accept the cookie only when it is `Secure`, has no `Domain` and has
  `Path=/`. It does not separate ports, so it does not end the shared jar,
  and its forced `Path=/` trades against scoping each session cookie to its
  own API surface. **This record does not settle it.** No session cookie
  exists yet; the choice between `__Host-` and path scoping belongs to the
  Task 9 consult, with the rest of the session-cookie design. This record
  fixes only that names are project-specific.

**Where the rules are recorded.**

- *In the builder's task file.* It is read by one builder. The seventh route
  is written by someone who never saw it.
- **An ADR, with the architecture amended to match.** Chosen.

## Consequences

- A secret that reaches the server in a request has no path to a response or
  a log line that depends on someone remembering a list. The price is paid
  in debugging: an unexpected error shows a type, a code and frames, and
  never its message.
- Both clients switch on one list of codes and own every sentence a person
  reads. A new error is a new code, a details type if it needs one, a test
  that emits it, and copy in the client.
- Every later route inherits the guard, the envelope, `no-store` and the
  logging rules by being registered inside the one API context. A route
  registered outside it has none of them, so nothing but bundles and the
  not-found response lives outside it.
- A file upload, a form post, a webhook from another origin, or a browser
  page on another origin calling this API is each **not possible** under this
  record. Any of them needs a new ADR that supersedes the relevant rule.
- A request made by anything other than a browser page on the origin must
  send the origin itself. Test helpers and browser-test API calls that mutate
  set `Origin` explicitly; a tool that omits it is refused.
- Development against the real API has no hot reload until the reverse-proxy
  arrangement is designed. The POS's fixture-only Vite server is unaffected,
  because it makes no API call.
- The server cannot be started without a certificate, and running the test
  suite needs `openssl` for the few tests that open a real listener.
- The owner sees one browser warning per browser profile, and again when the
  certificate is replaced.
- `https://127.0.0.1:<port>` answers with a refusal. That is deliberate and
  should be said wherever the address is documented.
- Rules 3, 5 and 6 are written for a `localhost` origin on a loopback
  listener. The pre-production gate (section 3.2) changes both, and must
  bring a new ADR that supersedes this one: a real host name, the HSTS
  question reopened, the bind rule replaced deliberately rather than
  loosened. Rules 1, 2 and 4 are expected to survive it unchanged.

### Risks accepted for the MVP

The owner accepted this on 2026-10-08. It rests on the server being
loopback-only on the owner's own machine, and is to be reconsidered at the
gate before any networked or production use (ARCHITECTURE 3.2).

- **Cookies on `localhost` are shared with every other local server,
  whatever its port.** Browsers do not separate cookies by port. Any other
  program serving on `localhost` on the owner's machine, another project's
  development server for instance, is sent this application's cookies when
  the same browser profile visits it, the session cookies included, and can
  set cookies of the same names. Mitigations: project-specific cookie names,
  so a collision is not accidental; `HttpOnly`, so a script on such a page
  cannot read them; `Secure`; and `SameSite=Strict`. None removes the risk.
  It ends when the origin becomes a real host name, at the gate.

Two readings the owner confirmed on the same day are recorded here so that
they are not later mistaken for oversights. Neither is a risk.

- Clicking through the browser's certificate warning, once per profile, is
  the supported path. Nothing may depend on trust having been installed. The
  certificate is a leaf that cannot act as a certificate authority, so the
  owner trusting it on their own machine is harmless.
- FR-A7's "first contact" is the browser's first API request, not its first
  page request. The guard of rule 3 runs before that request can create a
  client-instance record.

### Not decided here

- The names of the two session cookies beyond the `rpos_` stem, their
  lifetime and path, and `__Host-` against path scoping.
- The anti-CSRF token: its shape, and what protects a sign-in, which has no
  session to bind a token to.
- The route declaration (audience, interactivity, the manager requirement,
  shared read routes) and how an undeclared route fails at startup.
- The authentication and approval codes that enter the envelope, and their
  statuses.
- What is served outside `/api`: the bundles, their fallback, cache headers
  and a content security policy.
- Whether any API response is ever not JSON (an export, a rendered document).
  None is today. Rule 4 binds request bodies and rule 1 binds error bodies; a
  non-JSON success response is a question for the phase that first wants one.
