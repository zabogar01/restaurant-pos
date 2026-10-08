# PHASE0-008a review — round 3

## Verdict

**findings** — one medium-priority finding. The encoded-prefix cases identified in round 2 are fixed, but the not-found classifier still disagrees with the router for absolute-form request targets.

Reviewed `agent/phase0-008a` at `7fe85e7d42230a8df3de8e580c0cdb606a2ac388` against `development` at `d0865bfdf5f802e8fa4102ad099f5876e333c9a2`. Coverage includes the branch diff, the task's binding ARCH-010 excerpts and subsequent rulings, the cited requirements and boundaries, and the relevant installed router implementation. The task says findings after this final fix cycle go to the owner; this report supplies evidence for the lead's decision.

## Findings

### 1. Medium priority: absolute-form API misses bypass the envelope and cache policy

**Location:** `apps/server/src/http/errors.ts:49`, through `notFoundHandler` at `apps/server/src/http/errors.ts:93`.

`isApiPath()` decodes unreserved characters but assumes the request target starts with a slash. The installed router also accepts absolute-form targets: `find-my-way/index.js:583` extracts the path using `getPathFromAbsoluteUrl()` before matching. Node preserves that absolute target in `request.url`. Consequently, a local client sending `GET https://localhost:8443/api/nope HTTP/1.1` receives the outside-API plain 404 without `Cache-Control`, although the same target form reaches registered API routes successfully.

I observed these responses from the unchanged server factory and handlers:

| Request target | Status | Body | Cache-Control |
|---|---|---|---|
| `/api/nope` | 404 | `{"error":{"code":"NOT_FOUND"}}` | `no-store` |
| `https://localhost:8443/api/nope?pin=RAW_QUERY_MARKER` | 404 | `Not Found` | absent |
| `https://localhost:8443/%61pi/nope` | 404 | `Not Found` | absent |
| `https://localhost:8443/api/probe-ok` | 200 | `{"ok":true}` | `no-store` |

The successful probe was registered through `apiRoutes`. These results were reproduced by feeding raw HTTP/1.1 bytes through an in-memory Duplex into the factory's Node HTTP server connection handler, exercising Node's parser and Fastify's normal request pipeline without changing application code. A separate routing-injection probe produced the same results.

This is the shared-state check: the encapsulated hook correctly protects matched routes, while the common not-found classifier gives different policy to equivalent API paths. Successful-route tests conceal that remaining disagreement.

**Authority:** The task's binding ARCH-010 rules 10 and 11 require the API not-found envelope and `Cache-Control: no-store` on every API response. Round 3 ruling 1 specifically requires misses to be classified as the router reads them. This is a response-contract defect, not an observed credential disclosure: the query marker appeared in neither the response nor the captured trace log.

**Proposed fix:** Extract the pathname from accepted absolute-form targets consistently with the router before applying the API-prefix check, preserving its treatment of escaped slashes and case. Alternatively, explicitly reject this target form through the safe error policy before routing. Add a regression using an actual absolute request target at the parser/router boundary, covering a matched API route, an API miss, an encoded API miss, and an outside-API miss. Preserve the existing encoded-prefix and malformed-URL protections.

## What I ran and what I did not

**Observed:** I ran `npm run verify`. Typechecking passed for the server, money, contracts, and POS packages. Vitest reported **56 files passed and 3,005 tests passed**, exit status 0: five files and 94 tests above the task's recorded development baseline. The existing Vite configuration-loader warning appeared.

`git diff --stat` was empty before verification and after its green result. The task and development commit IDs remained unchanged. Further checks after the probes again showed an empty diff and a clean task branch. This report is my only file change; no source, test, task, or memory file was edited.

I ran the routing-injection and raw HTTP parser probes described above. The injection probe supplied each exact request target to `app.routing`; the independent raw-byte probe used `app.server.emit('connection', duplex)` and captured the complete HTTP response. Both used `buildServer` and its unchanged error handlers. Neither needed a database double or contacted the database. A separate Node parser probe confirmed that the absolute target remains intact in `request.url`.

The attempted real-HTTPS probe failed before sending any request with `listen EPERM: operation not permitted 127.0.0.1`. The finding is independently observed at the HTTP parser and routing layers, not over a TLS socket. Its applicability after TLS termination follows from shared request handling; that part is an inference. The verification suite's existing real-listener tests passed.

`git diff --check development...HEAD` passed. Source searches found no `console.` calls and exactly one `.listen(` call, at `http/loopback.ts:46`. The HTTP modules and process entry point contain no `actor_session`, migration import, or `MIGRATION_DATABASE_URL` reference. Existing tests and client files are unchanged against development.

I did not repeat individual test files, three-run repetitions, or the builder's mutation proofs in this review. I did not repeat the lead's certificate, watch-mode, curl, or signal acceptance runs. Startup and shutdown ordering, fatal logging, and the idle-pool listener were reviewed in source; I did not independently trigger the shutdown timeout, second signal, uncaught exception, unhandled rejection, or idle-pool error. No screen or design artifact applies to this transport task. I did not commit or push.

## Cleared

- The original encoded-prefix defect is fixed for origin-form targets. Cases 30 and 31 passed, including the production health route, the supported API plugin context, encoded misses, case sensitivity, and the reserved `%2F` escape. My additional probes confirmed matching cache policy for literal and encoded success and miss paths.
- Malformed URLs and over-long parameters pass through the safe framework handler; the trace scan and response checks passed. The async-constraint test proves the exported handler on a separate Fastify instance, not a currently reachable product route. Closing-time and connection-parser response exceptions remain explicitly accepted by the round-2 lead ruling.
- The six error codes declare no details. `AppError` and `ErrorBody` enforce that restriction, and the negative type checks passed. Exercising a real details-bearing code remains explicitly deferred to Task 9.
- Loopback address classes, refusal without TLS, post-bind validation, HTTPS versus plaintext, certificate extensions, permissions, validity, matching keys, and idempotence passed their tests. These support B-11, NFR-1, and architecture sections 3.1 and 3.2 within this task's scope.
- Logging tests at trace level exclude body, header, query, exception, and PostgreSQL markers while retaining SQLSTATE and stack frames. Redaction remains a documented backstop. The finding above does not invalidate those observed B-12 protections.
- Health performs `SELECT 1`, sets no cookie, and changes no row counts. Pool recreation and continued usability across server closures passed. No identity, approval, application table write, migration, CORS, HSTS, or frontend behavior was added. FR-A7 remains deferred to PHASE0-008b; this task introduces no audited action or approval behavior under B-13 or B-14.

DONE
