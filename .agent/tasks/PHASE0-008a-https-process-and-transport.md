---
id: PHASE0-008a
title: The HTTPS process — TLS, loopback guard, safe logging, error envelope, health
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-007b]
owns: [apps/server/**, packages/contracts/**, package.json, package-lock.json]
status: active
cycles: 2
---
# PHASE0-008a — The HTTPS process and transport

**Written** 2026-10-08 by the lead, from the architect consult ARCH-010
(`.agent/reviews/ARCH-010-https-server.md`, by `architect10`, 2026-10-08), which supersedes plan
Task 8 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1975-2315`) entirely. Plan Task
8 is split: this is the first half, about what leaves the process. PHASE0-008b (the same-origin
guard and the client-instance cookie) follows it. The consult is not yet on `development`, so its
binding sections are copied below **verbatim**, and this file is complete without it. Touches B-11
and B-12: the owner looks before merge.

## Objective

Give the server a process that can listen: `apps/server/src/index.ts`, which starts one Fastify 5
server over TLS on a loopback IP literal and on nothing else, with a logger that cannot print a
request body, a header, a query string or an exception's message, an error handler through which
only a code the server chose reaches a response, `GET /api/health` that checks the database, a
clean shutdown, and the `@pos/contracts` package with the six error codes this task can emit. A
TypeScript script makes the local certificate, with its key outside the working tree. There is no
cookie, no client instance and no write to any table in this task. When it is done, the test
files listed below prove every rule against `app.inject()` and, where a socket is the point, a
real loopback listener with a throwaway certificate.

## Required inputs

- **Built code:** `apps/server/src/config.ts` (`pinPepper()`, read per call, throwing a sentence
  that names the variable and never its value: the pattern for every new configuration
  function), `src/db/pool.ts` (`query`, `withTransaction`, `getPool`), `src/domain/*` (not called
  by this task), `apps/server/scripts/provision.ts` and `create-manager.ts` (the
  `invokedDirectly` pattern, needed because this checkout's path contains a space),
  `packages/money` (the pattern for a package), `apps/server/test/support/database.ts`.
- **Contract:** `docs/BOUNDARIES.md` B-11, B-12, B-13, B-14, B-24; `docs/PRD.md` NFR-1, FR-A7;
  `docs/ARCHITECTURE.md` §3.1, §3.2, §7.2, §11, §12, §13, §14.4, §16.
- **Carry-forwards owed to this task:** the request logger never logs cookie headers (PHASE0-007
  Handoff); it never logs a body's `pin` or `password` (PHASE0-007b Handoff). The rules below
  discharge both by never handing a body or a header to the logger at all.
- **New requirement of `npm run verify`:** `openssl` on `PATH` (tier 2 of question 2). A test that
  cannot find it fails; it does not skip. The lead's machine has OpenSSL 3.6.
- LESSONS: PostgreSQL's `now()` is the transaction's start time (not used here: this task writes
  nothing).

## From ARCH-010 (verbatim; binding)

The numbered questions below are the consult's; rules refer to them by number. Sections 4, 7's
same-origin guard and the PHASE0-008b rules belong to the next task and are left out.

### 1. Plan Task 8 against the architecture, the ADRs and what is built

| # | Plan (`:line`) | Must be | Authority |
|---|---|---|---|
| 1 | `config.host`, `.port`, `.tlsKeyPath`, `.tlsCertPath` from a `config` object (`:1985`, `:2277-2292`) | No such object exists. `config.ts` exports functions read per call; Task 8 adds four on that pattern (question 9) | `config.ts`; ARCH-006 §8 |
| 2 | Environment names `HOST`, `PORT` (plan Task 4, `:1192`) | `POS_LISTEN_HOST`, `POS_LISTEN_PORT`. zsh and csh define `HOST` as the machine's name; an exported one would be read as the bind address | question 3 |
| 3 | `assertLoopbackOnly` accepts `localhost` (`:2066`, test `:2034`) | A name is refused; IP literals only | §3.1; question 3 |
| 4 | The guard checks only the configured string (`:2283`) | Also the addresses actually bound, after `listen` | §3.2 "fail closed" |
| 5 | `buildServer({ https? })`, `https: opts.https ?? null` (`:2247-2251`) | Anyone who calls `buildServer()` and then `listen` has a plain-HTTP server that accepts PINs. One listening function, which requires TLS | B-11 "never transmitted in plaintext"; §16 "do not substitute loopback HTTP" |
| 6 | `scripts/gen-local-cert.sh`, `mkdir -p certs`, paths relative to the working directory (`:2084-2101`) | A TypeScript script in `apps/server/scripts/`, anchored paths, key outside the working tree | question 2 |
| 7 | "Trust it once in your OS keychain" (`:2097`); `-days 825`; no `basicConstraints` | The kit never installs trust. `CA:FALSE`, `serverAuth`, at most 398 days, SAN with `::1` | §3.1; question 2 |
| 8 | No error handler; Fastify's default | A handler that sends a code only | §12; B-12; question 5 |
| 9 | `console.error(err)` on the fatal path (`:2296-2299`); `console.log` for the listening line | The same safe serializer as every other log line. An `Invalid URL` error carries its input, which for `DATABASE_URL` is a password | B-12; B-24 |
| 10 | Redaction of `pin` and `managerPin` at two depths (`:2255-2258`) | Bodies and headers are never logged; redaction is a backstop and adds `password`, the cookie headers and `authorization` | PHASE0-007 and 007b Handoffs; question 5 |
| 11 | The request log includes the query string (Fastify default `url`) | The path only | question 5 |
| 12 | `UPDATE client_instance SET last_seen = now()` (`:2207`) | `last_seen_at`; `GREATEST(last_seen_at, clock_timestamp())` | `0003`; ARCH-008 §7 |
| 13 | The hook is global and runs for `/api/health` (`:2263-2265`, tests `:2133-2168`) | Inside the API context only, and health opts out. As planned, Playwright's readiness polling inserts a row per poll | question 4 |
| 14 | `request.clientInstanceId: string \| null` (`:2188`) | `string \| undefined`. `writeSecurityEvent` and `createSession` take `clientInstanceId?: string`, and the writer throws on `null` | `audit.ts:87`; `session.ts:76` |
| 15 | `request.clientInstanceId = rows[0].id` only on the reuse path; cookie regex is case-insensitive (`:2192`) | Always the value from `RETURNING id`; the canonical lower-case form only | `0003`; PHASE0-006 case 16 |
| 16 | `sameSite: 'lax'`, name `cid` (`:2222-2228`) | `SameSite=Strict`; a project-specific name | §7.2; question 4 |
| 17 | No origin check anywhere in Task 8 | A same-origin guard on every API request | §7.2; question 7 |
| 18 | Fastify's default `text/plain` body parser stays | Removed. JSON is the only body type | question 7 |
| 19 | `packages/contracts` with `"main": "src/errors.ts"`, a `zod ^3.23` dependency nothing uses, no `tsconfig.json`, not in the root `typecheck` (`:1996-2005`) | `main: src/index.ts`, its own `tsconfig.json`, a `typecheck` line; `zod` arrives with Task 9, at its current major | `packages/money`; question 6 |
| 20 | Eight error codes, seven of which Task 8 cannot emit (`:2011-2020`) | The codes Task 8 emits | question 6 |
| 21 | `@fastify/static` installed and unused (`:1991`) | Not installed until a task serves a bundle | question 8 |
| 22 | `src/http/clientInstance.ts` | `client-instance.ts`, as `back-office-credential.ts` | built code |
| 23 | `/api/health` returns `{ status: 'ok' }` with no check | Checks the database | §12; question 9 |
| 24 | No shutdown path; the pool is never closed | Signal handling, `app.close()`, then the pool | question 9 |
| 25 | Tests never reset the database; rows accumulate between cases | `resetDatabase()`; fixture changes through `ownerQuery` | ARCH-006 §8; `test/support/database.ts` |
| 26 | Steps 4, 9, 13 and 14 (`npx vitest run …`, `git add scripts …`) | The task's own acceptance and the repository's commit rules | AGENTS.md |

The ADRs add nothing beyond ARCHITECTURE here. ADR-001 fixes one loopback-only Fastify server
and two bundles; ADR-009 fixes that a failed back-office sign-in is a security event with no
username, which Task 8 serves only by handing the domain a checked client-instance id.


### 2. Local HTTPS

**How the certificate is made.** By `apps/server/scripts/make-cert.ts`, run as
`npm run cert` at the root (`npm run cert -w apps/server` underneath). It follows
`provision.ts`: an exported function that does the work, an `invokedDirectly` entry point, and
no path taken from the working directory. It runs `openssl` through `execFile` with an argument
array, never through a shell, so a path with a space is safe. Node has no way to issue a
certificate itself, and a certificate package would be a dependency in the trust path of every
PIN for one command a year.

The certificate is a self-signed **leaf**, not a certificate authority:

- key: ECDSA P-256, unencrypted, written with mode `0600` into a directory of mode `0700`;
- subject `CN=localhost`; `subjectAltName = DNS:localhost, IP:127.0.0.1, IP:::1`;
- `basicConstraints = critical, CA:FALSE`; `keyUsage = critical, digitalSignature`;
  `extendedKeyUsage = serverAuth`;
- valid for 397 days.

`openssl req -x509` makes a certificate with `CA:TRUE` unless told otherwise. If the owner ever
chose to trust such a file in the keychain, its key could sign for any site. `CA:FALSE` removes
that. The 397 days sit inside every browser lifetime limit I know of, whether or not a given
limit applies to an untrusted certificate, which the librarian could not establish.

The script is idempotent: if a valid pair already exists it says so and changes nothing; if the
pair is missing, expired, mismatched or fails a check below it writes a new one. It finishes by
loading its own output through the same validation the server uses. It prints the two paths and
the origin, and nothing else. **It never installs trust**: no `sudo`, no `security
add-trusted-cert`, no `mkcert`.

**Where the key lives.** Outside the working tree: `<home>/.config/restaurant-pos/tls/`, as
`localhost-key.pem` and `localhost-cert.pem`. `POS_TLS_KEY_PATH` and `POS_TLS_CERT_PATH`
override the two paths; a path is not a secret, so a default is not a B-24 matter. Three reasons
for leaving the tree, each of which the ignored `certs/` directory fails:

- it cannot be committed, even by `git add -f` or by a tool that ignores `.gitignore`;
- it survives `git clean -fdx`;
- every agent worktree uses the same pair, so the browser's one exception stays valid, and a
  worktree never needs a certificate of its own.

The `certs/` line in `.gitignore` stays as a backstop.

**What the server does when it is missing.** It refuses to start. `loadTls()` runs before any
socket or database connection and requires, in this order: both files readable; the key file
not readable by group or others; the certificate parses; it is not a CA; it matches `localhost`;
the present time is inside its validity; the key matches the certificate. Each failure is a
fixed sentence that names the check, the path and `npm run cert`. No message contains file
contents. There is **no HTTP fallback, no HTTP listener that redirects, and no generation at
startup**: §16 says not to substitute loopback HTTP, and B-11 forbids a PIN in plaintext, which
is what a fallback would carry. Generating at startup would hide an expired certificate behind a
new browser warning with no explanation.

This is the only place the server reads the wall clock from JavaScript. It persists nothing, so
§14.4's rule about PostgreSQL time is not touched; the validator takes the time as a parameter
so that expiry is testable.

**How a browser reaches it.** At `https://localhost:<port>/`, by clicking through the
certificate warning once per browser profile. That is the supported path. §3.1 excludes "an
internal certificate authority" and "terminal trust installation", while §16 says to "script and
document local certificate creation/trust". I read those together as: the kit creates the
certificate and never installs trust; the owner may trust the leaf on their own machine if they
wish, and `CA:FALSE` keeps that harmless. Nothing in the task may depend on trust having been
installed.

**How the test suite reaches it.** In three tiers, so that `npm run verify` needs no certificate
in the developer's directory:

1. Almost every test uses `app.inject()`. No socket, no TLS, no certificate.
2. Two or three tests need a real listener (the bound-address check, and "this port speaks TLS
   and does not speak HTTP"). They call the script's exported function to make a throwaway pair
   in a temporary directory, listen on `127.0.0.1` at a free port, and connect with
   `node:https` passing that certificate as `ca`. They never set `rejectUnauthorized: false`.
3. Playwright (plan Task 12) runs against the real server with `ignoreHTTPSErrors: true`, as the
   plan has it.

Tier 2 makes `openssl` on `PATH` a requirement of `verify`. That is a real new dependency of the
check, and the task file should say so. A test that cannot find `openssl` fails; it does not
skip.


### 3. The loopback guard

**Where the value comes from.** `POS_LISTEN_HOST`, optional, default `127.0.0.1`.
`POS_LISTEN_PORT`, optional, default `8443`, an integer from 1024 to 65535. Neither is a secret.
The knob exists so that §3.2's sentence ("a later developer must not be able to expose the MVP
merely by changing `HOST=0.0.0.0`") is a tested property and not a vacuous one.

**Exactly what is accepted.** An IP **literal**, as judged by `net.isIPv4` and `net.isIPv6`,
that is in `127.0.0.0/8` or is `::1`.

| Value | Verdict | Why |
|---|---|---|
| `127.0.0.1`, `127.0.0.5`, `127.255.255.254` | accepted | The whole `127/8` block is loopback. An address the host has not configured fails at `bind`, harmlessly |
| `::1`, `0:0:0:0:0:0:0:1` | accepted | One address; compare by parsed value, not by string |
| `localhost`, `localhost.`, any other name | **refused** | See below |
| `0.0.0.0`, `::` | refused | Every interface |
| unset reaching `listen`, or the empty string | refused | Node's default with no host is every interface. The default is applied in `config.ts`; `listen` never receives `undefined` |
| `::ffff:127.0.0.1`, `::ffff:7f00:1` | refused | IPv4-mapped. Loopback in effect, but a second spelling with dual-stack behaviour nobody needs. `net.BlockList` matches mapped addresses against IPv4 rules, so the IPv6 check must use a list that holds only `::1` |
| `127.1`, `2130706433`, `0177.0.0.1`, `0x7f.0.0.1` | refused | Not literals to `net.isIP`; the resolver would treat them as names |
| `::1%lo0`, `fe80::1%en0` | refused | Zone identifiers |
| `192.168.1.10`, `10.0.0.2`, `169.254.1.1`, `example.com` | refused | Not loopback |

**Why a name is refused, `localhost` included.** The plan accepts `localhost` by comparing a
string. The string is not what gets bound: the operating system resolves it, from `/etc/hosts`
and the resolver, at the moment of `bind`, and Fastify resolves `localhost` itself and may open
a second listener for each address it gets back. A check on the name therefore checks something
other than the thing it protects, and resolving the name ourselves and then passing the name to
`listen` leaves a gap between the check and the use. Requiring a literal removes resolution
altogether, which is the whole answer to "how resolution is handled". The browser still uses the
name `localhost`; only the bind address is a literal. A server bound to `127.0.0.1` alone is
reachable as `https://localhost:<port>`, because browsers and Node try both loopback families.

**The second check.** After `listen` resolves, every entry of `app.addresses()` is passed
through the same function. If any is not loopback the server closes and the process exits
non-zero. The first check makes this unreachable today. It is there because the first check
reasons about a string and this one observes the socket, and §3.2 asks for a guard that fails
closed when someone later changes how `listen` is called.

**One place that listens.** `buildServer()` returns an instance that is not listening.
`listenLoopback(app, { host, port })` is the only code that calls `listen`. It refuses unless
`app.server` is an HTTPS server, runs the first check, listens, and runs the second. A test
greps `apps/server/src` for `.listen(` and expects one hit. That grep is what stops a later
`app.listen({ port })` in a script.

**What refusal looks like.** Before any socket, before the database is contacted:

    refusing to listen on "0.0.0.0": the MVP listens on a loopback IP address only
    (ARCHITECTURE 3.1; changing this is the pre-production gate in 3.2)

It goes to the log as one error line through the safe serializer, and the process exits with
status 1. The refused value is printed; a bind address is not a secret. There is no flag,
environment variable or `NODE_ENV` that turns the guard off, and the task must not add one for
tests.


### 5. Logging and errors

Three channels can carry a secret out of a request: what the framework logs about a request,
what it logs about an error, and what it sends back about an error. The plan addresses a
fraction of the first and neither of the others.

#### Request logging

**Request bodies are never logged: not on any route, not at any level, not on error.** Nor are
request or response headers. No hook, handler or serializer passes `request.body`,
`request.headers`, `request.cookies` or `reply.getHeaders()` to a logger.

The request serializer is replaced with one that emits `method` and the **path without its query
string**. Fastify's default logs the whole URL. Task 9 must never put a credential in a URL, but
a rule in a later task file is weaker than a serializer that cannot print one. The response
serializer stays `statusCode`. The request id is Fastify's own; no request-id header is trusted.

Pino redaction is configured as well, with `remove: true`, for `req.headers.cookie`,
`req.headers.authorization`, `res.headers["set-cookie"]`, and `pin`, `password`, `managerPin`,
`token` and `cookie` at the top level and one level down. **It is a backstop, and the task file
must say so in those words.** A redaction path matches the paths listed and nothing else: a
field called `newPassword`, or `pin` two levels down, passes straight through. The control is
that the data is never handed to the logger. B-12 forbids a value "in any form — including
partially masked", so the censor removes the key outright.

Logs go to standard output as JSON lines. No log file, no transport, no pretty-printer in the
server's dependencies.

#### Error logging

Fastify's default handler logs the error object, and the standard serializer prints its message,
its stack and, as far as I recall, its own properties. That is unsafe here for reasons that are
already visible in the built code:

- A PostgreSQL message can quote a value: `invalid input syntax for type uuid: "<the value>"`.
- A PostgreSQL `detail` holds the failing row or key. `pin.ts`, `session.ts` and
  `back-office-credential.ts` replace database errors for exactly this reason; `audit.ts`
  rethrows them unchanged by design (PHASE0-005 ruling 4), and a future handler may forget.
- A JSON parse failure can quote the body it failed on.
- `new URL()` on a malformed `DATABASE_URL` throws an error whose `input` property is the
  string, password included.

So the error serializer is an **allow-list**. For an error the server did not define, it logs:
the constructor name; `code` when it is a string; for a PostgreSQL error the schema-level names
`constraint`, `table`, `column` and `routine`; and the stack **frames only**, the `at …` lines,
with the leading message line removed. It never logs `message`, `detail`, `where`, `hint`,
`input`, `cause`, or any other property. The frames give file and line, from which the fixed
message can be read in the source. For an `AppError` (below) it logs the code.

The same serializer is used on the fatal path in `index.ts` and for `uncaughtException` and
`unhandledRejection`. There is no `console.` call anywhere in `apps/server/src`.

#### The error handler

`setErrorHandler` and `setNotFoundHandler` are both replaced. The rule is one sentence: **only a
code the server chose reaches a response.**

- An `AppError` (a class in `src/http/errors.ts` carrying an `ErrorCode`, a status and an
  optional typed `details`) is sent as its status and `{ "error": { "code", "details"? } }`.
- A framework error is mapped by its status: 400 to `VALIDATION_FAILED`, 404 to `NOT_FOUND`,
  413 to `PAYLOAD_TOO_LARGE`, 415 to `UNSUPPORTED_MEDIA_TYPE`. Its message is dropped.
- Anything else is 500 `INTERNAL`.

No SQL, stack, secret, blind index, PIN or password can appear, because no string from the
exception is copied at all (§12). There is no `message` field in the contract to copy one into
(question 6).

Every API response carries `Cache-Control: no-store`.

#### The proof

One test file, `log-scan.test.ts`, with the logger at `trace` writing to a captured stream. It
sends distinct marker strings by every channel: a JSON body with `pin` and `password`; a
malformed JSON body; a `Cookie` header; a query string; a probe route that sets a cookie; one
that throws an `Error` whose message and `detail` hold a marker; one that makes PostgreSQL quote
a marker (`SELECT $1::uuid`). It then asserts that no marker appears anywhere in the captured
log or in any response body, that every error body is exactly the envelope, and, so the test
cannot pass by logging nothing, that the 500's log line has stack frames and `22P02`. §14.3
places AC-18's log scan at this level. This is the first instalment of it.


### 6. The error contract

**`@pos/contracts` is the right shape.** §2.1 lets the repository share API schemas and
validation primitives, NFR-5 names shared API schemas, and both clients must switch on the same
codes. A union of string literals with a const object, as the plan writes it, is fine.

What must change is the packaging (row 19 above) and the contents.

**The response body.** Every API response that is not 2xx is exactly:

```json
{ "error": { "code": "THROTTLED", "details": { "retryAfterSeconds": 240 } } }
```

`code` is an `ErrorCode`. `details` is optional, is typed per code in `@pos/contracts`, and
never holds text taken from an exception. **There is no `message` field.** What a person reads
is the client's copy, chosen by code; the wording belongs to the design documents, and a
free-text field is where a leak would go. I chose an `error` object over the plan's flat
`{ code }` because §13 says responses "return authoritative state plus structured error or
warning codes": a conflict response will carry the current order beside the error, and a
success can carry `warnings`. A top-level key keeps those from colliding.

**Which codes, and when.** A code enters the union in the task that first emits it and tests
it. A code without an emitter is an untested promise.

| Code | Status | Emitted by | Task |
|---|---|---|---|
| `INTERNAL` | 500 | anything unexpected | 008a |
| `UNAVAILABLE` | 503 | health, when the database does not answer | 008a |
| `NOT_FOUND` | 404 | an unknown `/api` route | 008a |
| `VALIDATION_FAILED` | 400 | malformed JSON, and later schema failures | 008a |
| `PAYLOAD_TOO_LARGE` | 413 | Fastify's body limit | 008a |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | a body that is not JSON | 008a |
| `ORIGIN_REFUSED` | 403 | the same-origin guard | 008b |

Task 9 adds the authentication codes, and its consult names them: a failed verification, a
cooldown with `retryAfterSeconds`, no session, an idle back-office session (M-6 needs to tell
`IDLE` from `NONE`), a role refusal and a CSRF refusal. Task 10 adds the approval codes. §13's
`VERSION_CONFLICT` and the rest arrive with their commands.

Of the plan's eight, I would not carry `WRONG_AUDIENCE` forward at all. The server picks the
cookie by the route's audience (§7.2), so a session of the other audience is simply not found.
A distinct code would tell the caller that the token is valid somewhere else, and the plan's own
handler never emits it. `INVALID_PIN` cannot serve the back office, which takes no PIN. Both are
for the Task 9 consult to settle.

`zod` is not added in Task 8. Four configuration values are validated by hand on the pattern
`pinPepper()` set. It arrives with Task 9's request schemas.


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

**Never send `Strict-Transport-Security`.** HSTS is recorded per host and ignores the port. Sent
from `localhost`, it would force HTTPS on every other `localhost` port in that browser, the
owner's Vite server on 5173 among them.

---

### 9. Process shape

**Configuration.** Four functions in `config.ts`, each read per call, each throwing a sentence
that names the variable and never its value, as `pinPepper()` does:

| Function | Variable | Default |
|---|---|---|
| `listenHost()` | `POS_LISTEN_HOST` | `127.0.0.1` |
| `listenPort()` | `POS_LISTEN_PORT` | `8443` |
| `tlsPaths()` | `POS_TLS_KEY_PATH`, `POS_TLS_CERT_PATH` | under `<home>/.config/restaurant-pos/tls/` |
| `logLevel()` | `POS_LOG_LEVEL` | `info` |

`DATABASE_URL` and `PIN_PEPPER` keep having no default (B-24, ARCH-006 §8). The application
process never reads `MIGRATION_DATABASE_URL` and never imports `migrate.ts`.

The `dev` script becomes `tsx watch --env-file=../../db/dev.env src/index.ts`, with a `start`
beside it that does not watch. `db/dev.env` is unchanged: none of the four new values needs to
be in it.

**Startup order.** Each step fails the process before the next begins.

1. Configuration: `listenHost()` through the loopback check, `listenPort()`, `logLevel()`.
   Pure, no I/O.
2. `pinPepper()`, called once and discarded. It is still read per call afterwards; this only
   moves "the pepper is missing" from the first login to the first second.
3. `loadTls()`.
4. The database: one `SELECT 1` through `query()`, as `pos_app`. Unreachable means exit.
5. `buildServer()`, then `listenLoopback()`, then one log line naming the origin.

**The server does not run migrations**, and should not. §11 separates the migration role from
the application's credentials, and `migrate.ts` is the one module that holds the owner
connection. Migrating stays a deliberate command. **Nor does Task 8 check that the schema is
current.** `pos_app` has no grant on `schema_migration`, so the check would need a schema
change, and a sentinel query would be a half-measure. A stale schema shows up as `INTERNAL` on
first use. I flag it as a gap worth closing with a small migration later, not in this task.

**Health.** `GET /api/health`. It runs `SELECT 1` and answers `200 { "status": "ok" }`, or 503
`UNAVAILABLE`. It reads no cookie, creates no client instance, resolves no session, and can
never be interactive: nothing in `src/http/` names `actor_session` in Task 8, and a grep says
so. A health route that answers "ok" while the database is down contradicts §12's "a database
outage blocks writes visibly".

**Shutdown.** On `SIGINT` or `SIGTERM`: `app.close()`, which stops accepting and lets requests
in flight finish; then `closePool()`; then exit 0. A second signal, or ten seconds, exits 1. A
request killed mid-transaction is rolled back by PostgreSQL, so no partial state is left (B-20).
`tsx watch` restarts by signal, so this path runs on every save.

**The pool.** `pool.ts` gains `closePool()`, which ends the pool and clears the singleton, and
an `'error'` listener that logs through the safe serializer. Without the listener, PostgreSQL
closing an idle connection is an unhandled event that ends the process with a raw dump. The
pool is closed by `index.ts`, **not** by an `onClose` hook: a test that builds and closes
several servers in one file would otherwise end the pool under the next one.

**Fastify options that are rules.** `trustProxy` stays off: there is no proxy (§3.1), and with
it on a client could forge its own address. HTTP/2 is not enabled. The body limit stays at the
default until a route needs otherwise.


## For the task file (ARCH-010, verbatim; binding)

### PHASE0-008a: rules

1. The plan's Task 8 code and tests are superseded and must not be copied.
2. Dependencies: `fastify` at its current major (5). Record the installed versions in the
   Handoff. Do not add `@fastify/cookie`, `@fastify/static`, `@fastify/cors`, `zod`, or a
   certificate package.
3. `@pos/contracts`: `packages/contracts/package.json` (`"main": "src/index.ts"`, `"type":
   "module"`, no dependencies), `tsconfig.json` as `packages/money`'s, `src/errors.ts`,
   `src/index.ts`, and a `tsc -p packages/contracts --noEmit` in the root `typecheck`. It
   exports `ErrorCode` with exactly `INTERNAL`, `UNAVAILABLE`, `NOT_FOUND`, `VALIDATION_FAILED`,
   `PAYLOAD_TOO_LARGE` and `UNSUPPORTED_MEDIA_TYPE`, and the type of the error body.
4. `config.ts` gains `listenHost()`, `listenPort()`, `tlsPaths()` and `logLevel()` as in
   question 9. No function returns a secret default; no message contains a value, except that a
   refused bind address is printed.
5. The bind address is an IP literal in `127.0.0.0/8` or `::1`, by the table in question 3.
   Names are refused, `localhost` included.
6. `listenLoopback` is the only caller of `listen` in `apps/server/src`. It refuses a server
   that is not HTTPS, checks the configured host, listens, then checks every bound address and
   closes if one is not loopback. No flag disables it.
7. `make-cert.ts` and `loadTls` are as in question 2. The key is never written inside the
   working tree by default. The server never falls back to HTTP and never generates a
   certificate. The script never installs trust.
8. Request bodies, request headers and response headers are never passed to a logger. The
   request serializer emits the method and the path without its query string. Redaction is
   configured as a backstop and described as one in a comment.
9. The error serializer is the allow-list in question 5. An error's `message` is never logged
   unless the error is an `AppError`. There is no `console.` call in `apps/server/src`.
10. `setErrorHandler` and `setNotFoundHandler` send the envelope of question 6 and copy no
    string from an exception. Under `/api` a miss is 404 `NOT_FOUND`; elsewhere a plain 404.
11. `text/plain` is not an accepted body type. No `Access-Control-*` header and no
    `Strict-Transport-Security` header is ever sent. `trustProxy` is off. Every API response
    carries `Cache-Control: no-store`.
12. API routes are registered inside one encapsulated context under `/api`. `buildServer`
    accepts further API route plugins, so a test can register a probe inside that context.
13. `GET /api/health` is as in question 9.
14. `index.ts` follows the startup order of question 9 and the shutdown rule. The server does
    not import `migrate.ts` and does not read `MIGRATION_DATABASE_URL`.
15. `pool.ts` gains `closePool()` and the `'error'` listener, and nothing else in it changes.
16. No migration. No write to any table. Nothing names `actor_session`.

### PHASE0-008a: interface

    packages/contracts          ErrorCode, ErrorBody
    src/config.ts               listenHost(), listenPort(), tlsPaths(), logLevel()
    src/http/loopback.ts        assertLoopbackAddress(host: string): void
                                listenLoopback(app, { host, port }): Promise<void>
    src/http/tls.ts             loadTls(paths, now?: Date): { key: Buffer; cert: Buffer }
    src/http/log.ts             the logger options and both serializers
    src/http/errors.ts          AppError; the error and not-found handlers
    src/http/server.ts          buildServer({ origin, tls?, logStream?, apiRoutes? })
    src/http/routes/health.ts
    src/index.ts
    src/db/pool.ts              + closePool()
    scripts/make-cert.ts        makeCert({ dir, now? }); entry point behind invokedDirectly

`tls` is optional in `buildServer` only so that `inject()` tests need no certificate;
`listenLoopback` is what makes an instance built without it unable to listen.

### PHASE0-008a: test cases

*Loopback (`loopback.test.ts`).*
1. Accepts each accepted row of the table in question 3.
2. Refuses each refused row, with a message that names the value and "loopback".
3. `listenLoopback` on an instance built without TLS rejects, and nothing is listening.
4. With a throwaway certificate, `listenLoopback` on `127.0.0.1` succeeds; an HTTPS request that
   trusts exactly that certificate gets health; a plain HTTP request to the same port fails.
5. With `app.addresses()` made to report a non-loopback address, `listenLoopback` rejects and
   the server is closed.
6. `grep` finds `.listen(` once under `apps/server/src`.

*TLS (`tls.test.ts`).*
7. `makeCert` into a temporary directory produces a pair that `loadTls` accepts; the certificate
   is not a CA, names `localhost`, `127.0.0.1` and `::1`, and is valid for at most 398 days; the
   key file's mode is `0600`.
8. `makeCert` run again on a valid pair changes neither file.
9. `loadTls` refuses, each with its own sentence naming the path and `npm run cert`: a missing
   key; a missing certificate; a key from another pair; a time after expiry and a time before
   validity (through `now`); a certificate that is a CA; one without `localhost`; a key file
   readable by group.
10. No refusal message contains a line of either file.

*Configuration (`config.test.ts`).*
11. Unset, the host is `127.0.0.1` and the port `8443`.
12. `POS_LISTEN_PORT` of `0`, `80`, `70000`, `8443x` and the empty string each throw naming the
    variable.
13. An exported `HOST=0.0.0.0` has no effect.

*Server (`server.test.ts`).*
14. Health is `200 { "status": "ok" }` with `Cache-Control: no-store`, sets no cookie, and
    writes no row to any table.
15. With the pool's query made to reject, health is 503 `UNAVAILABLE` in the envelope.
16. An unknown `/api` path is 404 `NOT_FOUND` in the envelope; an unknown path outside `/api`
    is a 404 that is not the envelope.
17. Malformed JSON is 400 `VALIDATION_FAILED`; a `text/plain` body is 415; an oversized body is
    413. Each body is exactly the envelope.
18. A probe that throws an `AppError` with details gets that status, code and details. A probe
    that throws a plain `Error` gets 500 `INTERNAL` and nothing else.
19. No response in this file has an `Access-Control-*` or `Strict-Transport-Security` header.
20. `closePool()` followed by a query opens a new pool; building and closing two servers in one
    file leaves the pool usable.

*Log scan (`log-scan.test.ts`).* As described at the end of question 5:
21. No marker sent by body, malformed body, cookie header, query string, set cookie, thrown
    message, thrown `detail` or PostgreSQL message appears in the captured log at `trace`.
22. No marker appears in any response body.
23. The 500's log line carries stack frames and the SQLSTATE, and no message.
24. A probe that deliberately logs `{ pin, password }` produces a line without either key.
25. `grep` finds no `console.` under `apps/server/src`.

### PHASE0-008a: red proofs

Each mutated, run, read and reverted.

1. Accept `localhost` in the guard: case 2.
2. Use one `BlockList` for both families: case 2 on `::ffff:127.0.0.1`.
3. Remove the HTTPS check from `listenLoopback`: case 3.
4. Remove the post-listen check: case 5.
5. Drop `basicConstraints` from the script: case 7.
6. Remove the key-match check from `loadTls`: case 9.
7. Restore Fastify's default error handler: cases 17, 18 and 22 (the message is in the body).
8. Restore the default error serializer: case 21, on the thrown message and the PostgreSQL one.
9. Log the full URL: case 21, on the query string.
10. Leave the `text/plain` parser: case 17.
11. Close the pool in an `onClose` hook: case 20.


### Acceptance beyond `npm run verify` (ARCH-010)

- 008a: `npm run cert`, then `npm run dev -w apps/server`, then `curl --cacert <the certificate>
  https://localhost:8443/api/health`. With `POS_LISTEN_HOST=0.0.0.0` the server exits 1 with the
  refusal line. The lead makes these runs; the builder has no terminal of that kind.

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

1. **Where the tests live.** `apps/server/test/loopback.test.ts`, `tls.test.ts`, `config.test.ts`,
   `server.test.ts`, `log-scan.test.ts`. Number the test names by the consult's case numbers (1
   to 25) so the Handoff can map them.
2. **Scripts.** `npm run cert` at the root runs `npm run cert -w apps/server`, which runs
   `scripts/make-cert.ts` through `tsx`. The `dev` and `start` scripts are as in question 9.
3. **Health's database check** uses `query('SELECT 1')` through the pool as `pos_app`. Case 15
   makes the pool's query reject through a test double or a spy; it does not stop the database
   container.
4. **Fixture and reset.** Tests that touch the database reset with `resetDatabase()`, as every
   server test does. Tests use no `.concurrent`.
5. **The interactive acceptance runs** (`npm run cert`, `npm run dev`, `curl`, the refused
   `0.0.0.0`) are the lead's. The builder shows `npm run cert` against a temporary directory
   through the exported function only, and says in the Handoff which runs it did not make.
6. **Carry forward only what is true after this task.** The consult's list covers 008a and 008b
   together. The items about `request.clientInstanceId`, the origin guard and the Host check
   become true in PHASE0-008b; leave them to its Handoff, and carry forward the rest.

## Tests expected to change

- None. The lead grepped `apps/server/test/` for `getPool`, `.end()`, the config import and
  `listen(`: the `audit`, `back-office-credential`, `pin`, `pool`, `schema`, `session` and
  `throttle` tests call `getPool()` and end it with `getPool().end()` in `afterAll`. `closePool()`
  is added beside that and rule 15 changes nothing else in `pool.ts`, so they stay green unedited;
  do not migrate them to `closePool()`. If any existing test needs a change, stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s 51 files and
   2911 tests (lead's verify, 2026-10-08, at `d0865bf`), the client's tests unchanged, and the
   new `tsc -p packages/contracts --noEmit` in `typecheck`.
2. Each new test file alone is green; `loopback.test.ts` and `log-scan.test.ts` three times in a
   row. The Handoff maps each case number to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. `grep -rn "console\." apps/server/src` and `grep -rn "\.listen(" apps/server/src` show no hit
   and exactly one hit, and the Handoff shows both.
5. The Handoff records the installed versions of `fastify` and anything it pulled in directly.
6. The Handoff carries forward the items listed above.

## Out of scope

- The same-origin guard, `@fastify/cookie`, the client instance and `ORIGIN_REFUSED`
  (PHASE0-008b).
- Session cookies, the anti-CSRF token, route declarations, authentication routes and their codes
  (Task 9 and its consult); serving any bundle, `@fastify/static`, and any Vite proxy (Task 11).
- Any migration, any write to a table, and a schema-currency check (flagged by the consult for a
  later task).
- `docs/` of any kind, and ADR-010 (the lead commissions it separately).

## Lead verification and rulings (2026-10-08)

- `npm run verify` at `5f67516`: 56 files, 2990 tests, green. Changed paths are all within `owns:`;
  no existing test changed.
- **The builder's two questions, ruled.** (1) `StartupError` is accepted as the reading of rule 9:
  it carries only sentences written in this repository (a variable name, a path, a bind address),
  and `index.ts` wraps only the `config.ts` functions, whose messages never hold a value. Any other
  error stays on the allow-list. (2) The `migrate.ts` change is accepted: same text, same streams,
  on the migration command line, not the server.
- **Acceptance runs (the consult's, by the lead):** `npm run cert` made a pair in
  `~/.config/restaurant-pos/tls/` (directory `0700`, key `0600`) and a second run changed nothing.
  `npm run dev -w apps/server` listened on `127.0.0.1:8443` only (`lsof`). `curl --cacert` to
  `https://localhost:8443/api/health` gave 200 `{"status":"ok"}` with `cache-control: no-store`, no
  cookie, no HSTS, no `Access-Control-*`. `/api/nope?pin=123456` gave 404 `{"error":{"code":
  "NOT_FOUND"}}` and the server log held the path without the query (the marker never appeared);
  `/elsewhere` gave a plain 404. Plain HTTP to the port failed. `POS_LISTEN_HOST=0.0.0.0` and
  `POS_LISTEN_HOST=localhost` each exited 1 with the consult's refusal sentence as a
  `StartupError`. SIGINT to the server process exited 0 at once; a file save under `tsx watch`
  restarted cleanly. (Ctrl+C on `tsx watch` itself prints tsx's own "force killing" notice; the
  server's shutdown is not the cause.)

## Round 2 — the review's two findings (lead ruling, 2026-10-08)

The review is `.agent/reviews/PHASE0-008a-review.md` (Codex, at `902d5aa`). Read it in full. Both
findings are accepted. This is fix cycle 1 of 2.

1. **High: a malformed URL bypasses the envelope and echoes the query string** (B-12, rules 10 and
   11). `GET /api/%zz?pin=…` gets Fastify's own 400 body, which quotes the whole URL, with no
   `Cache-Control`. Fix: route Fastify's early framework failures through the same policy, through
   the `frameworkErrors` option. A malformed URL becomes 400 `VALIDATION_FAILED` in the envelope,
   with `Cache-Control: no-store` set by that path itself (it runs before `onRequest`), and nothing
   from the framework error is copied. **Then find every other path in the installed Fastify on
   which the framework writes a response itself** (for example an async constraint failure, a
   request arriving while the server is closing, a client-level parse error) and either route it
   to the envelope or say in the Handoff why it cannot carry a request value. Logging of these
   paths follows rules 8 and 9: the path without its query, no message.
2. **Medium: `ErrorDetails` accepts any value, an exception's message included** (question 6,
   rule 3). Fix: in `@pos/contracts`, map each `ErrorCode` to its details type; the six codes
   that exist now declare none. `ErrorBody` and `AppError` preserve the relation, so a details
   argument for a code that declares none does not compile. A later code that carries details
   declares its fields in that map.

**Tests** (add as cases 26 to 29; keep 1 to 25 green; case 18 is the one exception below):

- **26:** `GET /api/%zz?pin=<marker>` (and the same with `password=` and a percent-broken path
  segment) is 400, body exactly `{"error":{"code":"VALIDATION_FAILED"}}`, with
  `Cache-Control: no-store`; the marker appears in neither the response nor the captured log.
- **27:** one case per further early path the fix routes (item 1), each asserting the envelope
  and the absence of a marker, or, for a path left as it is, the Handoff's reason.
- **28 (compile-time):** in a test file covered by `npm run typecheck`, `// @ts-expect-error`
  lines prove that `new AppError(code, status, <a string>)`, `(…, new Error('x'))`, `(…, { any:
  'object' })`, and an `ErrorBody` with `details: <a string>` each fail to compile for every
  current code. The typecheck must fail if any of those lines starts compiling.
- **29:** case 18's details half, rewritten: because no current code declares details, it shows
  that the handler sends exactly what a typed `AppError` carries by registering nothing new in
  the contract. Keep the status and code half of case 18 unchanged; the cast in the old probe
  (`as never`) goes, and the Handoff says how case 29 exercises the details path without a cast,
  or, if it cannot, that the details path is first exercised by Task 9's first details-bearing
  code (add that to the carry-forward).

**Red proofs:** (a) remove the `frameworkErrors` wiring: case 26 sees the marker in the body;
(b) put `ErrorDetails` back as an empty interface: the typecheck passes the `@ts-expect-error`
lines as unused, so `npm run typecheck` fails; show both failing outputs and revert.

**Then:** re-run `npm run verify`, `log-scan.test.ts` three times, and add a **Round 2** section to
the Handoff with each change, the early paths found and how each is handled, the red proofs and the
counts. Do not rewrite round 1's sections except where the fix makes a statement in them untrue.

## Lead verification, round 2 (2026-10-08)

- `npm run verify` at `c7c0eb9`: 56 files, 2994 tests, green.
- **On a real HTTPS server** (`src/index.ts`, `pos` database): `/api/%zz?pin=…`,
  `/nowhere/%zz?password=…` and a 150-character path with `%zz?pin=…` each answered 400
  `{"error":{"code":"VALIDATION_FAILED"}}` with `cache-control: no-store`; no marker appeared in a
  response or in the server log, and the log held three `FST_ERR_BAD_URL` lines. SIGINT exited 0.
- The builder's handling of the two early paths left as they are (`return503OnClosing`'s fixed body
  while closing, and Node's connection-level client errors) is accepted: neither can carry a
  request value. Case 29's limit (no details-bearing code yet) is accepted and carried to Task 9.

## Round 3 — the re-review's one finding (lead ruling, 2026-10-08)

The re-review is `.agent/reviews/PHASE0-008a-review.md` (Codex, at `dbbdf22`; round 1's report stays
in the history at `d913e1d`). Read it in full. Its finding is accepted. **This is fix cycle 2 of 2,
the last**: anything a further review finds goes to the owner.

**Medium: an encoded API prefix bypasses `no-store` and the API 404 envelope** (rules 10 and 11).
`isApiPath()` tests the raw URL for `/api`, while Fastify's router decodes percent-encoded
characters before matching, so `/%61pi/health` reaches the health handler without `no-store`, and
`/%61pi/nope` gets the plain 404.

1. **Fix:** decide "is this an API request" the way the router does. A matched route answers under
   the API policy because it is registered in the `/api` context: set `Cache-Control: no-store`
   from a hook **inside that encapsulated context**, not from a global hook reading the URL. For a
   miss, classify the path after the same decoding the router applies (a path that cannot be
   decoded is already the malformed-URL case), so `/%61pi/nope` is a 404 `NOT_FOUND` envelope with
   `no-store`. Keep the plain 404 outside `/api`, the malformed-URL handling of round 2, and every
   other rule. Do not widen this round to anything else.
2. **Tests, cases 30 and 31** (keep 1 to 29 green and unedited): **30:** `/%61pi/health` and
   `/a%70i/health` answer exactly as `/api/health`, `no-store` included; a probe route registered
   through `apiRoutes` reached by an encoded prefix carries `no-store`. **31:** `/%61pi/nope` and
   `/a%70i/nope` answer exactly as `/api/nope` (404 envelope, `no-store`); `/API/nope` and
   `/elsewhere` stay plain 404s.
3. **Red proof:** go back to the raw-prefix test for the success path or the miss: case 30 or 31
   fails. Show the output; revert.

**Then:** re-run `npm run verify` and `log-scan.test.ts` three times, and add a **Round 3** section
to the Handoff with the change, the red proof and the counts.

## Handoff

### What I did

Built the HTTPS process and transport on branch `agent/phase0-008a`, from the task file alone. New
code: `packages/contracts` (`ErrorCode` with exactly the six codes, `ErrorBody`, `ErrorDetails`
as an empty interface because no code carries details yet (superseded in Round 2: details are now typed per code); `package.json`, `tsconfig.json`);
`apps/server/src/http/` (`errors.ts`, `log.ts`, `loopback.ts`, `tls.ts`, `server.ts`,
`routes/health.ts`); `apps/server/src/index.ts`; `apps/server/scripts/make-cert.ts`. Changed:
`config.ts` (the four functions, plus an exported `defaultTlsDirectory()` the script uses),
`db/pool.ts` (`closePool()` and the `'error'` listener, nothing else), the root `package.json`
(`cert` script; `tsc -p packages/contracts --noEmit` in `typecheck`), `apps/server/package.json`
(`cert`, `dev` as `tsx watch --env-file=../../db/dev.env src/index.ts`, `start`, and the
dependencies `fastify` and `@pos/contracts`), and `package-lock.json`. Five new test files:
`config`, `tls`, `loopback`, `server`, `log-scan`. Nothing else was touched; no migration, no
write to a table, nothing names `actor_session`.

Installed versions: `fastify` 5.12.5 (declared `^5.12.5`), which pulled in `pino` 10.4.0,
`find-my-way` 9.9.0, `avvio` 9.3.0 and `@fastify/error` 4.2.0. I import none of them directly
except `fastify`. No `@fastify/cookie`, `@fastify/static`, `@fastify/cors`, `zod` or certificate
package. `npm install` reports one high-severity advisory; `npm audit --omit=dev` reports none,
so it is in a dev dependency and I did not chase it.

### Decisions, and on what evidence

1. **`StartupError`.** Rule 9 says an error's message is never logged unless it is an `AppError`,
   but question 3 requires the refusal line to print the refused bind address, "through the safe
   serializer". Both cannot hold literally: the serializer drops messages. I added `StartupError`
   in `errors.ts`: its message is a fixed sentence written in this repository (a variable name,
   a file path, a bind address), and the serializer prints it as `msg`. It is thrown by the
   loopback guard, `loadTls`, and by `index.ts`, which wraps what the `config.ts` functions
   throw (those already name a variable and never its value). Any other error is still the
   allow-list. **Lead: please confirm this reading of rule 9**; the alternative is that the
   refusal line carries only a code.
2. **`migrate.ts` had two `console.` calls** (its command-line entry block, lines 72 and 76). The
   rule and acceptance criterion 4 say no `console.` anywhere in `apps/server/src`, and case 25
   greps for it, so I replaced them with `process.stdout.write` and `process.stderr.write` of
   the same text (the error's stack, as `console.error` printed it). The `migrate` tests that
   run `npm run db:migrate` still pass unedited. This is outside the strict list of things the
   task names but inside `apps/server/**`; say if you would rather exempt the file.
3. **Pino puts `err.message` in the line's `msg` when the call gives no message,** before any
   serializer runs. A Fastify internal that logs `{ err }` bare would leak it. `log.ts` adds a
   pino `hooks.logMethod` that supplies `'error'` as the message in that case, and turns a bare
   `Error` argument into `{ err }`. No test reaches a Fastify-internal bare call today; the hook
   is a backstop and is not red-proven.
4. **`make-cert` and `POS_TLS_*_PATH`.** The command writes only to the default directory. If
   either override is set it refuses with a sentence, because otherwise it would write where the
   server does not look. This is my addition; it is three lines in the entry point.
5. **`buildServer` takes `origin` and `logLevel` as required options.** `origin` is unused until
   PHASE0-008b (the interface lists it); `logLevel` is required so there is one owner of the
   value (`index.ts` passes `logLevel()`), rather than an option that falls back to the config.
6. **`Cache-Control: no-store`** is set by a global `onRequest` hook for any `/api` path and again
   by the error and not-found handlers, so a 404, a 415 and a 413 carry it as well as a 200.
7. **Case 20 as the consult words it passed against the mutation, so I tightened it.** With the
   pool closed in an `onClose` hook, `closePool()` clears the singleton, so a later `query()`
   quietly opens a new pool and the first version of the test stayed green. The test now holds
   the pool reference across building and closing two servers and expects the same live pool
   after. Red proof 11 below is against that version.
8. **Case 4 asserts health 200** over real TLS, which needs the test database to be reachable
   (it is, in `verify`).
9. **The tls test hand-makes a CA, a cert for `example.com` and a mismatched pair** with
   `openssl` directly. One extra test (`7. states CA:FALSE explicitly`) reads the certificate
   with `openssl x509 -text`: with OpenSSL 3.6.4 an `req -x509` certificate without the
   `basicConstraints` line is not a CA anyway, so my first red proof 5 stayed green on the
   `ca === false` check alone. The new test pins the explicit critical `CA:FALSE`, key usage,
   extended key usage and SAN, and that is what proof 5 trips.

### Test cases to test names

| Case | File | Test name starts with |
|---|---|---|
| 1 | loopback | `1. accepts …` (six accepted values) |
| 2 | loopback | `2. refuses …` (21 refused values) and `2. the refusal is the sentence ARCH-010 gives` |
| 3 | loopback | `3. rejects an instance built without TLS` |
| 4 | loopback | `4. listens on 127.0.0.1; HTTPS trusting exactly that certificate…` |
| 5 | loopback | `5. closes the server and rejects when a bound address is not loopback` |
| 6 | loopback | `6. exactly one .listen( call exists…` |
| 7 | tls | `7. makes a pair loadTls accepts…`, `7. states CA:FALSE explicitly…` |
| 8 | tls | `8. run again on a valid pair, changes neither file` |
| 9 | tls | `9. refuses …` (eight sentences plus group-readable key), `9. every refusal has its own sentence` |
| 10 | tls | `10. no refusal message contains a line of either file` |
| 11, 12, 13 | config | `11. …`, `12. POS_LISTEN_PORT … throws` (11 values) and `12. a port in range…`, `13. …` (two) |
| 14–20 | server | `14.` to `20.` |
| 21–25 | log-scan | `21.` to `25.`, plus two unnumbered: "has something to scan" and "request lines carry the method and the path without its query string" |

### Existing tests changed

None. The seven pool-using test files still end the pool with `getPool().end()` and are green
unedited.

### Red proofs (each mutated, run, read, reverted)

1. `if (host === 'localhost') return;` in `assertLoopbackAddress`: `2. refuses "localhost"` failed (1 failed, 32 passed).
2. `loopbackV6.addSubnet('127.0.0.0', 8, 'ipv4')`, which makes the IPv6 list also answer IPv4-mapped addresses: `2. refuses "::ffff:127.0.0.1"` and `"::ffff:7f00:1"` failed.
3. HTTPS check replaced by `false`: `3. rejects an instance built without TLS` failed.
4. Post-listen loop removed: `5. closes the server and rejects…` failed.
5. `basicConstraints` line dropped from `make-cert.ts`: first run stayed green (see decision 9); after adding the explicit-extension test, `7. states CA:FALSE explicitly` failed on the Basic Constraints match.
6. Key-match replaced by "the key parses": `9. refuses a key from another pair`, `9. every refusal has its own sentence` and `10. no refusal message…` failed (3 failed).
7. `setErrorHandler` removed: cases 15, 17, 18, 21, 22 and 23 failed (6 failed, 8 passed).
8. The error serializer replaced with `{ type, message, stack, ...err }`: 21 failed with `[ 'thrown', 'detail', 'postgres' ]` leaked, and 23 failed.
9. `path: req.url` instead of the stripped path: 21 failed with `[ 'query' ]` leaked, and the unnumbered request-line test failed.
10. `removeContentTypeParser('text/plain')` removed: 17 failed with `expected 200 to be 415`.
11. `closePool()` in an `onClose` hook: 20 failed on `expect(getPool()).toBe(held)` (after tightening, decision 7).

Everything is reverted; the final verify below is on the reverted tree.

### `npm run verify`

Typecheck clean for `apps/server`, `packages/money`, `packages/contracts` and `apps/pos`.
Tests: **56 files passed, 2990 tests passed** (development: 51 files, 2911 tests; the difference
is five files and 79 tests). The client's tests are unchanged. `loopback.test.ts` and
`log-scan.test.ts` together: 40 passed, three runs in a row. `server`, `tls` and `config`
passed alone. `grep -rn "console\." apps/server/src`: no hit. `grep -rn "\.listen(" apps/server/src`:
exactly one, `apps/server/src/http/loopback.ts:46`. `grep -rn actor_session apps/server/src/http
apps/server/src/index.ts`: no hit. `openssl` here is 3.6.4. No formatter was run.

### Not run, and why

`npm run cert`, `npm run dev`, `curl --cacert … https://localhost:8443/api/health`, and the
`POS_LISTEN_HOST=0.0.0.0` refused start are the lead's runs. `index.ts` is therefore not
executed by any test; its startup order, signal handling and ten-second timeout have been
typechecked and read, not run. The refusal when `POS_LISTEN_HOST=0.0.0.0` happens at step 1,
before TLS and the database, as the consult orders. I did not use a browser.

### Found and not fixed

- (Resolved in Round 2: details are now typed per code in `@pos/contracts`.)
- The idle-client `'error'` listener on the pool is not exercised by any test.
- `index.ts` calls `process.exit(0)` after shutdown without waiting for stdout to flush; a log
  line written just before exit could be lost on a pipe. Low risk; not addressed.

### Carry forward (ARCH-010, true after this task)

For Task 9: its routes register inside the `/api` context (pass them to `buildServer({ apiRoutes })`);
no credential in a URL (the request log strips the query anyway, but responses and redirects do
not); an `AppError` is the only way a code reaches a client, and `ErrorCode` grows only in the
task that emits the code; session cookie names are project-specific; AC-19 and AC-27 are
still open; `zod` arrives with its request schemas; a route's `audience` and `interactive`
declaration, and health's one-line addition to it, are Task 9's.
For Task 11: nothing is served outside `/api`; the not-found handler there is a plain-text 404;
never send HSTS; Vite gets no proxy; `@fastify/static` is installed when a bundle is served.
For Task 12: the certificate lives in `~/.config/restaurant-pos/tls/`, not the tree;
Playwright uses `ignoreHTTPSErrors: true`; no `PIN_PEPPER` literal in a configuration file; no
`DELETE` in a seeder. Verify now requires `openssl` on `PATH` (tier 2); a missing `openssl`
fails the `tls` and `loopback` files rather than skipping them.
The items about `request.clientInstanceId`, the origin guard and the Host check belong to
PHASE0-008b's Handoff, by lead ruling 6.

## Round 2 (fix cycle 1 of 2)

### Finding 1 (high): early framework responses

`buildServer` now passes `frameworkErrors: frameworkErrorHandler` (new, in `src/http/errors.ts`). It
logs `{ err }` at info with a fixed message (so the line carries the code, e.g. `FST_ERR_BAD_URL`,
and the stack frames, never the message), and sends the envelope with `Cache-Control: no-store`
set by that path itself, since it runs before `onRequest`. A malformed URL and an over-long
parameter are 400 `VALIDATION_FAILED`; a failed async constraint is 500 `INTERNAL`. It applies to
every path, not only `/api`: nothing from the framework error is copied either way, and failing
closed is simpler than a second shape.

Every path in the installed Fastify 5.12.5 on which the framework writes a response itself, found
by reading `fastify.js` and `lib/route.js` for `writeHead`, `res.end` and `clientError`:

| Path | Handling |
|---|---|
| `onBadUrl` (`fastify.js:645`), body quotes the URL | routed through `frameworkErrors` (400 envelope). Case 26 |
| `onMaxParamLength` (`:670`), 414, body quotes the path | routed (400 envelope). Case 27, a probe route `/probe-param/:id` with a 200-character id and a query marker |
| `onAsyncConstraintError` (`:695`), fixed 500 text | routed (500 envelope). Case 27, a bare Fastify instance with a custom async constraint whose derivation fails, using the exported handler; `buildServer` registers no async constraint, so this path is unreachable in the product today |
| `return503OnClosing` (`lib/route.js:492`), a request arriving while the server closes | left as is. The body is the fixed 80-byte string `{"error":"Service Unavailable","message":"Service Unavailable","statusCode":503}`; it carries no request value, and it is Fastify's deliberate load-shedding fast path. It is not the envelope and has no `Cache-Control`. Turning it off would run the full handler chain during drain, which is worse. A client sees 503 either way |
| `defaultClientErrorHandler` (`fastify.js:963`), raw 400, 408 or 431 on the socket | left as is. It fires on a connection-level parse error, before any request object exists; the bodies are three fixed strings ("Client Error", "Client Timeout", "Exceeded maximum allowed HTTP header size"); it logs `{ err }` at trace with a fixed message, through our serializer |
| `lib/error-handler.js:37`, Fastify's last-resort default if our own error handler throws | cannot be reached by input: `errorHandler` only reads a status, a code and calls `request.log` and `reply.send`. Not tested |

### Finding 2 (medium): `ErrorDetails`

`@pos/contracts` now has `ErrorDetailsByCode` (an interface that declares nothing yet),
`ErrorDetailsOf<C>` (`never` for a code that declares none), and `ErrorBody` as a union over the
codes, each with `details?: never` unless declared. `ErrorDetails` is gone. `AppError<C>` takes its
details as a rest argument that is `[]` when `ErrorDetailsOf<C>` is `never`, so a third argument
does not compile. The handler's `send` takes `unknown` and casts once to `ErrorBody` (the pair was
checked by `AppError`'s type). A later code that carries details declares its fields in
`ErrorDetailsByCode`.

### Tests

- Case 26 (`log-scan.test.ts`): `/api/%zz?pin=…`, `?password=…`, a percent-broken path segment with
  a query marker, and `/nowhere/%zz?pin=…` are each 400, body exactly
  `{"error":{"code":"VALIDATION_FAILED"}}`, `no-store`; the query markers are in neither a response
  nor the trace log, and the four log lines carry `FST_ERR_BAD_URL` and no `message`. Markers inside
  a *path* (the segment and the long parameter) are checked against responses only: the request
  line logs the path by design (rule 8), so they would be a false alarm in the log.
- Case 27 (`log-scan.test.ts` and `server.test.ts`): the over-long parameter, and the async constraint,
  as in the table.
- Case 28: `apps/server/test/error-details.types.ts` (no `.test.ts`, so vitest skips it;
  `tsc -p apps/server` covers it): for each of the six codes, `// @ts-expect-error` on a string, an
  exception's message, an `Error`, an undeclared object, and an `ErrorBody` with a string and with
  an object as details (36 directives), plus the two forms that must compile.
- Case 18 now keeps only the status and code half; its probe is `new AppError(NOT_FOUND, 409)`
  with no cast.
- Case 29 (`server.test.ts`): no current code declares details, so the details half of the handler
  **cannot be exercised without a cast**, and a cast is what the contract forbids. Case 29 shows what
  can be shown: an `AppError` for a code with no details sends exactly `{ code }` with no `details`
  key, and its `details` is `undefined`. **The details path is first exercised by Task 9's first
  details-bearing code** (carry-forward below).
- Existing tests changed: only case 18's probe and its details assertions, as the ruling says.

### Red proofs

(a) `frameworkErrors` commented out of `server.ts`: 26, 27 and 22 failed: `channels that leaked
into a response: [ 'badUrlPin', 'badUrlPassword' ]`, the body was `{"error":"Bad Request","code":"FST_ER…`
and the long parameter was `expected 414 to be 400`. Reverted.
(b) `ErrorDetailsOf` made to return `{}` for every code (the empty interface's behavior): `npm run
typecheck` failed with 36 `TS2578: Unused '@ts-expect-error' directive` errors in
`error-details.types.ts` (all 36 of the details lines). Reverted.

### Counts

`npm run verify`: typecheck clean; **56 files, 2994 tests** passed (round 1: 2990; the difference is
cases 26 (one test), 27 (two), 29 (one); case 28 is a typecheck, not a test). `log-scan.test.ts`
three runs in a row: 9 passed each time. `grep console\.` in `apps/server/src`: no hit; `grep
\.listen(`: one hit, `loopback.ts:46`. A Fastify deprecation warning about top-level
`constraints` showed in my first draft of the case-27 test; it uses `routerOptions` now and the run
prints no warning from this task.

### Carry forward (added)

For Task 9: the first code that carries details declares it in `ErrorDetailsByCode`, and that task
must add the test that exercises the handler's details path (case 29 could not). No other change to
round 1's carry-forward.

## Round 3 (fix cycle 2 of 2)

### The change

`no-store` for a matched route no longer comes from a global hook reading the URL. `server.ts`
adds an `onRequest` hook inside the encapsulated `/api` context, so every route registered there
(health and anything passed through `apiRoutes`) is answered under the API policy however its path
was spelled. The global hook and the `isApiPath` import are gone from `server.ts`.

For a miss, `isApiPath` in `errors.ts` now classifies the path the way the router reads it: it
normalizes percent-escapes of unreserved characters (`A-Z a-z 0-9 - . _ ~`, so `%61` is `a`) and
leaves reserved escapes alone (`%2F` stays `%2F`, as in the router), then tests for `/api` or
`/api/…`. Case matters, as in the router. A path that cannot be decoded never gets here: it is the
round 2 malformed-URL case. The 404 envelope still sets its own `no-store`; the plain 404 outside
`/api` is unchanged. Nothing else was touched.

### Tests

Cases 30 and 31 are in `server.test.ts`; 1 to 29 are unedited (I added one probe route,
`/probe-ok`, to the existing `apiRoutes` list in `build()`; nothing else in that list changed).
30: `/%61pi/health`, `/a%70i/health` and `/%61%70%69/health` equal `/api/health` in status, body,
`Cache-Control: no-store` and content type; `/%61pi/probe-ok`, a probe through `apiRoutes`,
carries `no-store`. 31: `/%61pi/nope`, `/a%70i/nope` and `/%61pi/nope?x=1` equal `/api/nope` (404,
`{"error":{"code":"NOT_FOUND"}}`, `no-store`); `/API/nope`, `/elsewhere`, `/%41PI/nope` and
`/api%2Fnope` are plain-text 404s with no `Cache-Control`. The last two are my additions: `%41PI`
checks that case still matters after decoding, and `%2F` checks that a reserved escape is not
decoded into a slash.

### Red proof

I restored the raw-prefix behavior on both paths at once: `isApiPath` tested the raw path, and a
global `onRequest` hook set `no-store` on `request.url.startsWith('/api')` in place of the hook in
the `/api` context. Eight tests failed (12 passed): all three `30. /…/health` cases, `30. a probe
registered through apiRoutes…`, all three `31. /…/nope` cases, and `31. /api%2Fnope stays a plain
404`. Reverted by restoring the files; `git diff` afterwards shows only the fix.

### Counts

`npm run verify`: typecheck clean; **56 files, 3005 tests** passed (round 2: 2994; the difference
is the 11 tests of cases 30 and 31 as parameterized). `log-scan.test.ts` three runs in a row: 9
passed each time. `grep console\.` in `apps/server/src`: no hit; `grep \.listen(`: one hit,
`loopback.ts:46`.

DONE
