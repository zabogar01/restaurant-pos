# PHASE0-008a review — round 2

## Verdict

**findings** — one medium-priority finding. Both findings from the previous review are resolved.

Reviewed branch `agent/phase0-008a` at `dbbdf22da4f43436008dda338b26ec2dc84a41f7` against `development` at `d0865bfdf5f802e8fa4102ad099f5876e333c9a2`. The review covers the branch diff, the task's binding ARCH-010 excerpts and round-2 rulings, the cited requirements and boundaries, and the installed framework paths relevant to the fixes.

## Findings

### 1. Medium priority: encoded API paths bypass the shared response policy

**Location:** `apps/server/src/http/errors.ts:43`, used by `apps/server/src/http/server.ts:46` and `apps/server/src/http/errors.ts:84`.

`isApiPath()` compares the raw URL against the literal prefix `/api`, but Fastify's router decodes percent-encoded unreserved characters before matching routes. These two interpretations disagree. A request to `/%61pi/health` reaches the real health handler, yet the global request hook considers it outside the API and does not set `Cache-Control: no-store`. The same classifier makes an encoded API miss return the outside-API plain-text response.

I reproduced these results using the unmodified server factory and its production health handler, with only the database pool's query method replaced in memory by a successful response:

| Request | Status | Body | Cache-Control |
|---|---|---|---|
| `/api/health` | 200 | `{"status":"ok"}` | `no-store` |
| `/%61pi/health` | 200 | `{"status":"ok"}` | absent |
| `/a%70i/health` | 200 | `{"status":"ok"}` | absent |
| `/api/nope` | 404 | `{"error":{"code":"NOT_FOUND"}}` | `no-store` |
| `/%61pi/nope` | 404 | `Not Found` | absent |

A separate successful probe registered through `apiRoutes` exhibited the same missing header without any database dependency. This is the shared-control check: the raw-prefix classifier works for literal paths and is reused for both cache control and not-found handling, hiding the states where the router recognizes a decoded API path. Error responses also hide the successful-response defect because `send()` independently adds `no-store`.

**Authority:** The task's binding ARCH-010 question 5 requires `Cache-Control: no-store` on every API response. Rules 10 and 11 require the API not-found envelope and the same unconditional cache policy. This finding does not claim an observed credential disclosure: the current health body contains no credential, but the shared API response policy is already bypassed.

**Proposed fix:** Apply the API response policy according to the route's API context or a pathname interpretation consistent with the router, including API misses. An encapsulated API hook can cover registered routes, but the not-found classification must also handle encoded unreserved characters consistently. Alternatively, reject noncanonical API spellings through the safe envelope. Add successful-health and unknown-route cases for encoded API prefixes, asserting the same headers and response policy as their literal equivalents. Preserve the malformed-URL protections and plain 404 behavior outside the API.

## What I ran and what I did not

**Observed:** I ran `npm run verify`. Typechecking passed for the server, money, contracts, and POS packages. Vitest reported **56 files passed and 2,994 tests passed**, with exit status 0: five files and 83 tests above the task's recorded development baseline. The run printed the existing Vite configuration-loader warning.

`git diff --stat` was empty before and immediately after verification; `git status --short --branch` showed a clean task branch. Both commit IDs remained unchanged. A further check after the in-memory probes again found an empty diff and the same commits. No source, test, task, or memory file was edited; this report is my only file change.

I ran the injection probes described above. The health reproduction used the actual registered health route with a temporary successful database-query double; it did not prove live database connectivity. I restored the method and closed the server and pool. The separate probe route used the supported API registration context. I also injected malformed API and non-API URLs containing a query marker: both returned the exact 400 `VALIDATION_FAILED` envelope with `no-store`, and the captured trace log contained no marker.

I independently exercised the details-type red proof using a TypeScript compiler host that changes source only in memory. The unchanged server program produced zero diagnostics. Replacing `ErrorDetailsOf` with `{}` produced **36 TS2578 unused-`@ts-expect-error` diagnostics**, all in `error-details.types.ts`. No file was mutated or emitted.

`git diff --check development...agent/phase0-008a` passed. Source searches found no `console.` calls, exactly one `.listen(` call at `http/loopback.ts:46`, and no `actor_session`, migration import, or `MIGRATION_DATABASE_URL` reference in the HTTP modules or process entry point.

**Limitations:** A separate real-HTTPS reproduction attempt failed at bind with `listen EPERM: operation not permitted 127.0.0.1`; it sent no request. The encoded-path finding is observed through injection. Its applicability to network routing is supported by the installed `find-my-way` lookup implementation, which decodes paths before matching; it is not an independently observed HTTPS result. The real-listener tests in the verification suite passed, but they do not cover this encoded-path scenario.

I did not repeat the individual test files or their three-run repetitions, the other builder mutation proofs, or the lead's certificate, watch-mode, curl, and signal acceptance runs. I reviewed startup order, shutdown ordering, fatal logging, and the idle-pool listener in source; I did not independently trigger the ten-second shutdown timeout, second signal, uncaught exception, unhandled rejection, or idle-pool error. There is no screen or design artifact to review for this transport task. I did not commit or push.

## Cleared

- The previous malformed-URL finding is resolved. `frameworkErrors` is wired in the production factory, and malformed URLs and over-long parameters receive safe envelopes and `no-store`. The failed-async-constraint test exercises the exported handler on a separate Fastify instance; it is handler evidence, not a currently reachable production route. I read the installed framework's remaining direct responses. The fixed closing-time and connection-parser bodies cannot echo request values; the task's round-2 lead ruling explicitly accepts those exceptions.
- The previous details-contract finding is resolved. The six codes declare no details, and both `AppError` and `ErrorBody` reject strings and undeclared objects. The negative checks are effective, as the in-memory mutation demonstrates. Testing a real details-bearing code remains explicitly deferred to Task 9.
- The loopback and TLS checks cover the required address classes, refusal without TLS, post-bind address validation, real HTTPS versus plain HTTP, certificate extensions, permissions, validity, matching keys, and idempotence. These support B-11, NFR-1, and architecture sections 3.1 and 3.2 within this task's scope.
- The passing logging tests cover body, header, query, exception, and PostgreSQL markers at trace level, retain SQLSTATE and stack-frame evidence, and check redaction as a backstop. Normal JSON, body-limit, health-failure, and error-envelope paths passed. The encoded-prefix gap is the exception identified above.
- Health performs only `SELECT 1`; the suite checks that it sets no cookie and changes no row counts. Pool shutdown belongs to the process, and the tests prove recreation and continued pool usability across server-instance closures. No client-instance, session, approval, migration, CORS, HSTS, or frontend behavior was added. FR-A7 is deferred to PHASE0-008b; B-13 and B-14 have no new identity or approval behavior here.

DONE
