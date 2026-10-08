# ARCH-010 — The HTTPS server, loopback guard and client instance (plan Task 8)

Author: `architect10`, 2026-10-08. Read-only consult for PHASE0-008 (not yet written). Nothing
was edited except this report, and nothing was committed.

## Summary

**Plan Task 8 cannot be dispatched as written.** It imports a `config` object that was never
built, updates a column that does not exist (`last_seen`), and would compile into a server that
(a) can be started as plain HTTP by any caller of `buildServer()`, (b) answers every unexpected
error with the exception's own message, (c) prints raw errors to the console on a fatal path,
and (d) inserts a `client_instance` row for every cookie-less probe, health checks included.
None of its code should be copied. The task is also two reviewable slices, not one.

What PHASE0-008 must say instead, in order of weight:

1. **Nothing free-form from an exception ever reaches a response or a log.** Fastify's default
   error handler sends `err.message` to the client and logs the whole error object. A PostgreSQL
   message can quote a parameter value, and a JSON parse error can quote the body. Task 8
   replaces both: a response carries a code and nothing else, and a log line for an unexpected
   error carries its type, its SQLSTATE and its stack frames, never its message (question 5).
2. **Request bodies and headers are never given to the logger, and the URL is logged without
   its query string.** Redaction paths are a backstop, not the control: a path list cannot
   anticipate a field name. This discharges both carry-forwards (cookie headers; `pin` and
   `password`) more strongly than they were asked (question 5).
3. **There is exactly one call to `listen`, and it refuses anything that is not TLS on a
   loopback IP literal.** The guard runs twice: on the configured value before any socket
   exists, and on the addresses actually bound afterwards. `localhost` is refused as a bind
   address, because a name is resolved by the operating system at bind time (question 3).
4. **The browser's origin is `https://localhost:<port>` and nothing else.** That is the one
   cookie jar and the one value an `Origin` header is compared with. Task 8 lays the
   same-origin guard for every API request, because the client-instance hook is the first
   unauthenticated database write and must not be drivable from another site (questions 4, 7).
5. **The client instance is issued and checked only inside the API context, never for health,
   and the id handed to the domain is the one PostgreSQL returned, never the cookie string.**
   It is `string | undefined`, never `null`: `writeSecurityEvent` refuses `null`, so the plan's
   type would make every failed login throw after its strike had been counted (question 4).
6. **The TLS key lives outside the working tree**, in the user's configuration directory,
   shared by every worktree. A missing or invalid certificate stops the server; there is no
   HTTP fallback and no generation at startup (question 2).
7. **`@pos/contracts` is the right package; the plan's eight codes are not.** Task 8 introduces
   only the codes it can emit. An error body is `{ "error": { "code": … } }` with no message
   field (question 6).
8. **Split it:** PHASE0-008a (process, TLS, guard, logging, errors, health) and PHASE0-008b
   (same-origin guard, client instance). Static bundles stay with the rewritten Task 11. The
   Vite dev server stays on fixtures and gets no proxy and no exception (questions 8, 10).

No boundary is strained. One point goes to the owner for acknowledgement (a shared cookie jar
on `localhost`); it blocks nothing. No contract change is proposed.

## What I verified, and what I could not

Read: the task file; plan Task 8 whole and Tasks 9, 11 (server step) and 12 (Playwright
configuration and seeder); ARCHITECTURE.md whole; BOUNDARIES.md whole; PRD §2, FR-A1 to FR-A7,
§5, AC-19, AC-27, AC-28, AC-35; `.agent/DECISIONS.md` whole; ADR-001 whole and ADR-009's
mentions of routes and cookies; ARCH-006 §8; ARCH-008 §6 and §7 and its carry-forward list; the
Handoffs of PHASE0-005, 006, 006b, 007 and 007b; `config.ts`, `db/pool.ts`, `db/migrate.ts`,
every file in `src/domain/`, `test/support/*`, migrations `0003` and `0004`, `vitest.config.ts`,
`docker-compose.yml`, `.gitignore`, both `package.json` files, `apps/pos/vite.config.ts`.

**The lead's account under *What exists* holds, with these additions.**

- `apps/server/package.json` already has `"dev": "tsx watch src/index.ts"`. It names a file that
  does not exist and, unlike the three scripts beside it, passes no `--env-file`.
- `pool.ts` has no way to close the pool and reset its singleton; `create-manager.ts` calls
  `getPool().end()` directly. The pool has no `'error'` listener.
- There is no `scripts/` directory at the repository root. The built scripts are TypeScript in
  `apps/server/scripts/`, each guarded by `invokedDirectly` and anchored to its own file, a
  pattern that exists because this checkout's path contains a space.
- `.gitignore` already ignores `certs/`. `apps/pos` builds to its own `dist/`, not to
  `apps/server/public/pos` as the plan's Task 11 assumes.
- `packages/money` is the pattern for a package: `"main": "src/index.ts"`, its own
  `tsconfig.json`, and a line of its own in the root `typecheck` script.
- `pos_app` has no `DELETE` on `client_instance`. A row once checked cannot disappear during a
  request through any application path.

**Library facts came from the librarian (`ask.sh`), not from recall.** Fastify 5 is current,
with `@fastify/cookie` 11, `@fastify/static` 10 and `fastify-plugin` 6. Fastify's default
request serializer emits `method`, `url`, `hostname`, `remoteAddress` and `remotePort`, and the
response serializer `statusCode`; neither includes headers or a body. The default error handler
sends `statusCode`, `error`, `message: err.message` and `code`, and logs the error object.
`listen({ host: 'localhost' })` can bind both loopback families; `fastify.addresses()` returns
what was bound. `inject()` opens no socket and no TLS, so a cookie's `Secure` must be the
literal `true`, not `'auto'`. Chrome and Firefox accept `Secure` cookies from `http://localhost`;
Safari does not. "Site" for `SameSite` is schemeful and ignores the port. Vite's proxy forwards
`Set-Cookie` and does not rewrite `Origin`. `net.BlockList` matches an IPv4-mapped IPv6 address
against IPv4 rules. Node cannot create an X.509 certificate without `openssl` or a package.

**Not verified, and each is turned into a test or a browser check below rather than assumed.**

- That a browser which has clicked through the certificate warning stores and returns
  `Secure`, `HttpOnly` cookies normally. The librarian found no primary source. It is a browser
  check in PHASE0-008b's acceptance.
- That pino's standard error serializer copies an error's own properties (a PostgreSQL error's
  `detail` among them), and that V8's JSON parse message quotes its input. I recall both. The
  log-scan test proves the rule whichever way they turn out.
- That `fastify.server` is an instance of `node:https`'s `Server` when the `https` option is
  given, and that `onRequest` hooks run before the not-found handler. Recalled; each has a test.
- That the `openssl` on a given machine accepts `-addext` (macOS ships LibreSSL). The script
  verifies its own output, so an incompatible binary fails loudly.

---

## 1. Plan Task 8 against the architecture, the ADRs and what is built

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

---

## 2. Local HTTPS

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

---

## 3. The loopback guard

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

---

## 4. The client instance

### What it is for, and what that rules out

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

### The cookie

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

### Where the hook runs

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

### Creating and touching the row

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

### How the id reaches the domain

`request.clientInstanceId` is typed `string | undefined`. A handler passes it as
`{ clientInstanceId: request.clientInstanceId }` to `verifyPinThrottled`,
`verifyPasswordThrottled` and `createSession`, whose parameters are already optional strings.
Because the value is always one PostgreSQL returned in this request, and `pos_app` cannot delete
the row, the foreign-key failure of PHASE0-006 case 16 and PHASE0-007b case 24 cannot be reached
through HTTP. The task proves that with a route that presents an unknown UUID and then writes a
security event.

It is `undefined` only where the hook did not run (health). No handler may read the cookie
itself.

---

## 5. Logging and errors

Three channels can carry a secret out of a request: what the framework logs about a request,
what it logs about an error, and what it sends back about an error. The plan addresses a
fraction of the first and neither of the others.

### Request logging

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

### Error logging

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

### The error handler

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

### The proof

One test file, `log-scan.test.ts`, with the logger at `trace` writing to a captured stream. It
sends distinct marker strings by every channel: a JSON body with `pin` and `password`; a
malformed JSON body; a `Cookie` header; a query string; a probe route that sets a cookie; one
that throws an `Error` whose message and `detail` hold a marker; one that makes PostgreSQL quote
a marker (`SELECT $1::uuid`). It then asserts that no marker appears anywhere in the captured
log or in any response body, that every error body is exactly the envelope, and, so the test
cannot pass by logging nothing, that the 500's log line has stack frames and `22P02`. §14.3
places AC-18's log scan at this level. This is the first instalment of it.

---

## 6. The error contract

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

---

## 7. What of section 7.2 belongs to Task 8, and what to Task 9

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

### The same-origin guard

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

### Two things for the Task 9 consult to know now

- Session cookie names should be project-specific for the same reason as `rpos_cid`.
- `__Host-` and path scoping are alternatives. `__Host-` forces `Path=/`; scoping the POS
  cookie to `/api/pos` and the back-office cookie to `/api/back-office` keeps each token off the
  other surface's requests. The consult should pick one deliberately.

**Never send `Strict-Transport-Security`.** HSTS is recorded per host and ignores the port. Sent
from `localhost`, it would force HTTPS on every other `localhost` port in that browser, the
owner's Vite server on 5173 among them.

---

## 8. Serving the bundles, and development

**Task 8 serves `/api/health` and nothing else.** No `@fastify/static`, no bundle.

When the plan was written, Task 11 created both client shells and then served them. The POS
client now exists, built against fixtures, and the back office has no client. Serving the POS
bundle is a small slice of its own (the root anchored to a file, not to `process.cwd()`; the
fallback for client-side paths; what `/pos/` answers when the bundle has not been built; cache
and content-security headers) and it fits the rewritten Task 11, which will also create the
back-office shell and wire the lock screen to Task 9's routes. Putting it in Task 8 would add a
third review to a task that already has two. Task 8 owes Task 11 two things: the not-found
handler answers with the JSON envelope only under `/api` and plainly elsewhere, and there is no
catch-all route for Task 11 to fight.

§3.1's "one HTTPS origin serving both bundles and both APIs" is therefore not yet true after
Task 8, and no acceptance criterion closes on it. It becomes true at Task 11 and is proved at
Task 12.

**Vite stays as it is: fixtures only, on `http://127.0.0.1:5173`, with no proxy.** The POS makes
no API call today, so nothing is lost. §14.4 already says acceptance tests run against the
one-origin shape and not against a Vite origin. When the POS first calls the API, the choices
are:

- *A Vite proxy from `/api` to the server.* **Rejected.** The browser is then on
  `http://127.0.0.1:5173`. Its `Origin` header says so, Vite does not rewrite it, and the guard
  refuses. Making it work means teaching the server to trust a second origin in development,
  which is an exception waiting to be left on. `Secure` cookies over HTTP also fail in Safari,
  and `http://` and `https://` on `localhost` are different sites, so `Strict` cookies would not
  behave as they do in the real shape.
- *The built bundle served by Fastify, rebuilt on change (`vite build --watch`).*
  **Recommended first.** No hot reload, but the origin, the cookies and the guard are exactly
  the MVP's.
- *Fastify proxying `/pos/` to the Vite dev server behind an explicit flag*, so the browser
  stays on the one origin and keeps hot reload. Worth designing if the rebuild loop proves too
  slow in Phase 1. It is the only hot-reload arrangement that leaves the security boundary
  alone. Not now.

---

## 9. Process shape

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

---

## 10. Sequencing, and anything else

### Split it

- **PHASE0-008a — process and transport.** Configuration, the certificate script, `loadTls`,
  the loopback guard and `listenLoopback`, the logger and its serializers, `AppError` and the
  two handlers, the API context, health, `index.ts`, shutdown, `closePool`, and `@pos/contracts`
  with six codes. No cookie, and no write to the database.
- **PHASE0-008b — the request boundary.** The Host and origin guard, `@fastify/cookie`, the
  client-instance hook, `ORIGIN_REFUSED`. The first unauthenticated write, and the first cookie.

008b depends on 008a and on nothing else. Each is one review: 008a is about what leaves the
process, 008b about what a request may cause. Together they are roughly what PHASE0-006 and
PHASE0-007 were apart.

**Then, in parallel with 008b:** the Task 9 consult. It must settle the two session cookies
(names, `__Host-` or path scoping, lifetime, clearing on release and on `NONE`); the anti-CSRF
token, including what protects the login itself, which has no session; the route declaration
(`audience`, `interactive`, the back-office `MANAGER` requirement, FR-A2c's "shared read routes
may accept either") and how an undeclared route fails at startup; the status and code for each
of `FAILED`, `THROTTLED`, `IDLE` and `NONE` on both surfaces, with an unknown username
indistinguishable from a wrong password; whether a malformed PIN is refused before the throttle
or counted by it (PHASE0-006 Handoff); the M-6 sequence over HTTP; releasing a presented
session at login; `zod` and how a schema failure becomes `VALIDATION_FAILED` without echoing the
input; and the route-level proofs that close AC-19, AC-27, AC-28 and AC-35.

**An ADR.** Six of these rules bind every route in every later phase: the error envelope with
no message, the logging allow-list, the single origin with its guard, JSON only with no CORS,
the one listening function, and no HSTS. A task file is read by one builder. I recommend the
lead commissions **ADR-010, the HTTP boundary**, as `Proposed`, for the owner to accept. It
supersedes nothing and need not block 008a. I did not write it; this consult writes one file.

### Against the boundaries and criteria the task names

- **B-11.** A PIN or password is "never transmitted in plaintext". Task 8 owns that for
  transport: TLS or nothing (row 5).
- **B-12.** Question 5. This is the task's largest exposure and the plan's largest gap.
- **B-13.** A client instance is never an actor. Nothing in Task 8 writes an audit entry, and
  the task should say that nothing may.
- **B-14.** Not strained. One sentence for the task file: nothing is decorated onto the server
  instance or the request that could carry an approval from one request to the next.
- **B-24.** Kept by `config.ts` as built. Two things in later plan tasks would break it and
  should not be copied: Task 12's Playwright configuration carries a `PIN_PEPPER` literal, and
  its `seedTestUsers` deletes from `audit_entry` (B-7 as well) through tables that do not exist.
- **FR-A2c.** Task 8 must introduce no header that selects an audience. It does not.
- **FR-A7.** Met by 008b. "Clearing or replacing it does not bypass throttling" is already
  proved in the domain (PHASE0-006) and closes through the routes in Task 9.
- **AC-19, AC-27.** Neither closes in Task 8. Task 8's contribution to AC-19 is that the id is
  checked; to AC-27, nothing yet.

---

## For the task file

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

### Acceptance beyond `npm run verify`

- 008a: `npm run cert`, then `npm run dev -w apps/server`, then `curl --cacert <the certificate>
  https://localhost:8443/api/health`. With `POS_LISTEN_HOST=0.0.0.0` the server exits 1 with the
  refusal line. The lead makes these runs; the builder has no terminal of that kind.
- 008b: **a browser check by the lead**, because no test can make it. Open
  `https://localhost:8443/api/health` and a probe-free API path in Chrome and in Safari, click
  through the warning, and confirm in the developer tools that `rpos_cid` is stored with its
  attributes and is sent on the next request. If a browser does not store a `Secure` cookie on
  a clicked-through certificate, that is a blocker to bring back to the architect, not to work
  around.

### The Handoffs must carry forward

- For Task 9: its routes register inside the API context; `request.clientInstanceId` goes to the
  domain as it is; the origin guard already covers its mutating routes, and the anti-CSRF token
  is still owed; no credential in a URL; an `AppError` is the only way a code reaches a client;
  session cookie names are project-specific; AC-19 and AC-27 are still open.
- For Task 11: nothing is served outside `/api` yet; the not-found handler is plain there; the
  Host check already covers bundles; no HSTS; Vite gets no proxy.
- For Task 12: the certificate is in the developer's directory, not the tree; no `PIN_PEPPER`
  literal in a configuration file; no `DELETE` in a seeder.

---

## For the owner

Nothing here blocks PHASE0-008a or 008b. **No change to PRODUCT.md, PRD.md, ROADMAP.md or
BOUNDARIES.md is proposed.**

1. **A risk to acknowledge: `localhost` is one cookie jar for every program on the machine.**
   Browsers do not separate cookies by port. Any other server the owner runs on `localhost`,
   another project's development server for instance, is sent this application's cookies when
   the same browser visits it, the session cookies of Task 9 included, and could set cookies of
   the same names. Nothing in the MVP's shape removes this; a dedicated host name such as
   `pos.localhost` would, but NFR-1 and ARCHITECTURE section 2 say `localhost`, and Safari does
   not resolve such names without a hosts entry. I recommend accepting it for the loopback MVP,
   as the other authentication risks in section 3.2 were, and recording it for the gate, where
   the origin becomes a real host name and the risk goes away. If accepted, the architect adds
   a row to ARCHITECTURE section 16 and a clause to the review list in section 3.2 through the
   ADR below. Proposed row: *"Cookies on `localhost` are shared with every other local server,
   whatever its port | Another program on the owner's machine can receive or replace this
   application's cookies | Project-specific cookie names; `HttpOnly`, `Secure`, `SameSite=Strict`;
   reconsider at the gate in section 3.2 | Accepted for the MVP"*.

2. **Two readings, stated so they can be corrected.** Neither needs a ruling unless the owner
   disagrees.
   - *Trusting the certificate.* Section 3.1 excludes installing trust on terminals; section 16
     says to document "creation/trust". The kit will create the certificate and never install
     trust. Clicking through the browser warning is the supported path. The owner may trust the
     file on their own machine; it is built so that doing so cannot make it a certificate
     authority.
   - *FR-A7's "first contact"* is taken as the browser's first API request, not its first page
     request. Nothing a person can see differs.

3. **An ADR to commission.** ADR-010, the HTTP boundary (question 10), as `Proposed`, for the
   owner to accept. It would carry the six rules that bind every later route, and item 1's
   amendment if accepted.

DONE
