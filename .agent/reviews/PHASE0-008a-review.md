# PHASE0-008a review

## Verdict

**findings** — two findings: one high priority and one medium priority.

Reviewed `agent/phase0-008a` at `902d5aa2dd0afab95967e9889238535e3cab0abf` against `development` at `d0865bfdf5f802e8fa4102ad099f5876e333c9a2`, using the task file, its copied binding ARCH-010 consult, its lead rulings, and the cited product and architecture requirements. The two findings concern the promised error boundary; the existing verification suite passes.

## Findings

### 1. High priority: malformed URLs bypass the error envelope and echo the query string

**Location:** `apps/server/src/http/server.ts:33` and `apps/server/src/http/server.ts:43`.

The server installs `setErrorHandler` and an `onRequest` cache-control hook, but neither handles Fastify's early malformed-URL rejection. The Fastify options leave `frameworkErrors` unset. In the installed Fastify implementation, `onBadUrl` then writes its own response directly, before the application's error handler or request hook can run.

I reproduced this with the unmodified `buildServer` and `app.inject({ url: '/api/%zz?pin=REVIEW_QUERY_SECRET' })`. It returned status 400 with this body:

```json
{"error":"Bad Request","code":"FST_ERR_BAD_URL","message":"'/api/%zz?pin=REVIEW_QUERY_SECRET' is not a valid url component","statusCode":400}
```

The response had no `Cache-Control` header. The query marker appeared in the response, although it did not appear in the captured log. An ordinary `/api/nope?pin=REVIEW_QUERY_SECRET` request returned the correct `NOT_FOUND` envelope and `no-store`, so the existing unknown-route test hides the failing state. This is the shared-control check: the common error handler protects errors after routing begins but is absent from the earlier routing-failure state.

**Authority:** B-12 forbids PIN and password values in error messages; `docs/ARCHITECTURE.md` §12 forbids exposing secrets through errors. The task's binding ARCH-010 questions 5 and 6 require that only server-chosen codes reach responses, with no exception message, and require `Cache-Control: no-store` on every API response; task rules 10 and 11 repeat these requirements. The deliberate query-marker protection is part of the task even though later authentication routes must not put credentials in URLs.

**Proposed fix:** Connect Fastify's early framework-error path to the same safe response policy, for example through its `frameworkErrors` option. Map malformed URLs to the existing 400 `VALIDATION_FAILED` envelope, discard the framework message, and set `no-store` without depending on `onRequest`. Add regression coverage for a malformed `/api` URL with a distinct query marker, checking the exact body, header, and captured logs. Check the other early framework failures while wiring this path so they cannot restore the default response shape.

### 2. Medium priority: the error-details contract accepts arbitrary exception text

**Location:** `packages/contracts/src/errors.ts:20`; the value is accepted at `apps/server/src/http/errors.ts:14` and sent at `apps/server/src/http/errors.ts:52`.

`export interface ErrorDetails {}` is not an empty payload type. It accepts non-nullish values, including strings and arbitrary objects, and does not associate a details shape with an error code. Consequently, both the `AppError` constructor and `ErrorBody` accept an exception's message without any cast. The handler then sends it unchanged.

I checked an in-memory TypeScript module under the server's compiler options. Both of these expressions compiled with zero diagnostics:

```ts
new AppError(ErrorCode.INTERNAL, 500, cause.message);
const response: ErrorBody = {
  error: { code: ErrorCode.INTERNAL, details: cause.message },
};
```

I also registered an in-memory probe through the supported `apiRoutes` option. Throwing the first expression with `cause.message` equal to `REVIEW_DETAILS_SECRET` returned status 500 and this body:

```json
{"error":{"code":"INTERNAL","details":"REVIEW_DETAILS_SECRET"}}
```

The shipped health handler does not currently pass details, so this is a defect in the new shared contract and its guard against accidental disclosure, not an observed leak from the health route. The cast in the existing details test is unnecessary with the current type and therefore does not demonstrate a constrained contract.

**Authority:** The task's binding ARCH-010 question 6 explicitly requires details to be typed per code and never to contain text taken from an exception; question 5 requires optional typed details on `AppError`. B-12 and architecture §12 explain why the proposed exception-message scenario must be prevented. The Handoff acknowledges the empty interface, but the task's lead verification section does not grant an exception to the per-code requirement.

**Proposed fix:** Define a code-to-details mapping and make `ErrorBody` and `AppError` preserve that relationship. For the current six codes, which declare no details, reject a details argument rather than permitting arbitrary non-nullish values. Add a compile-time negative check for a string, an exception object, and an undeclared details object. Reconcile the existing probe with that contract; when a later task adds a details-bearing code, test its declared fields then.

## What I ran and what I did not

**Observed:** I ran `npm run verify` myself. Typechecking passed for the server, money, contracts, and POS packages. Vitest reported **56 files passed and 2,990 tests passed**, an increase of five files and 79 tests over the task's recorded development baseline. The run exited 0. It printed the existing Vite configuration-loader warning.

`git diff --stat` was empty immediately before and after that green run, and `git status --short --branch` showed a clean `agent/phase0-008a` tree. After resuming the review, I checked again: both commit IDs were unchanged, the diff stat remained empty, and the tree remained clean. The report is the only file I have added or edited.

I ran the malformed-URL injection probe with trace logs captured in memory, using the actual server factory without changing its implementation. I ran the TypeScript compiler probe with a virtual source file supplied by an in-memory compiler host, and the details-response probe through `apiRoutes`. Neither probe wrote a source or test file. These are direct reproductions, not mutation runs.

I attempted to repeat the malformed-URL request over a real HTTPS listener, loading the existing local certificate without altering it. That separate command failed at bind with `listen EPERM: operation not permitted 127.0.0.1`, so it made no HTTPS request. The malformed-URL finding is observed through injection; its applicability to the network path is supported by reading the installed Fastify `onBadUrl` implementation. The existing suite's real-listener tests passed as part of `verify`, but they do not exercise this malformed-URL scenario.

**Not rerun:** I did not independently repeat each test file alone, the three repeated loopback/log-scan runs, or the builder's eleven mutation proofs. Those remain Handoff evidence. I did not repeat the lead's certificate-generation, watch-mode, curl, or signal acceptance runs. I did not independently exercise the ten-second shutdown timeout, second-signal exit, uncaught-exception handler, unhandled-rejection handler, or idle-pool error event. Their wiring was reviewed in source; it is not additional runtime evidence. No browser or visual screen review applies to this transport task. I did not commit or push.

## Cleared

- The loopback guard rejects names, wildcard and non-loopback addresses, IPv4-mapped IPv6, and zone identifiers. It checks TLS before listening, checks the actual bound addresses afterwards, and closes on rejection. The passing suite includes the sole-listen-call check and real TLS versus plain-HTTP behavior. These support NFR-1, architecture §§3.1–3.2, and B-11 within this task's scope.
- Certificate generation uses `execFile` arguments, creates the specified leaf extensions, keeps the default key outside the checkout with restrictive permissions, and does not install trust. Validation rejects the specified missing, invalid, mismatched, expired, premature, CA, wrong-name, and loose-permission cases. Generation, idempotence, and validation tests passed.
- For requests that reach the normal framework lifecycle, the tests cover the error envelope, JSON-only body parsing, request and response marker scans, PostgreSQL SQLSTATE and stack-frame logging, and redaction as a backstop. Health success and simulated database failure use the correct responses. The health row-count test passed, and the production handler contains only `SELECT 1`.
- The pool closes under process ownership rather than server-instance ownership; the tests cover pool recreation and closing multiple server instances without ending their shared pool. Source review confirms the prescribed startup order, application-role database access, and shutdown ordering.
- The contract package exports exactly the six requested codes and participates in root typechecking. No authentication route, client-instance cookie, migration, CORS implementation, HSTS behavior, or frontend change was added. B-13 and B-14 remain outside the behavior implemented here. FR-A7's cookie behavior is explicitly deferred to PHASE0-008b.
- I treated the task's recorded lead rulings accepting `StartupError` and the migration CLI stream change as part of the review scope. They are not additional findings.

## Handoff

The lead can dispatch the two error-boundary fixes from the reproductions above. The current suite is green on the reviewed, stable commit, but neither failing scenario is covered by it. Re-run verification after fixes and include the malformed-URL response and per-code details checks in the next review. No implementation or task Handoff was changed during this review.

DONE
