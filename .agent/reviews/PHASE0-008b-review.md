# PHASE0-008b review

## Verdict

**findings** — one verification finding. I found no demonstrated runtime defect in the implementation. The required raw-socket timeout proof is missing. The Chrome and Safari acceptance check remains the lead's responsibility.

Reviewed `agent/phase0-008b` at `3714e8137ce5241a78d5aec0a0af2d0c0f817a93` against `development` at `4a69826ad493d83b7bc017364a83dffcba0041ea`, using the task, its copied ARCH-010 contract, the PHASE0-008a Handoff, and the cited requirements, boundaries, architecture and accepted ADR-010.

## Findings

### 1. Medium: the timeout response has not been tested at the required parser boundary

**Location:** `apps/server/test/origin.test.ts:291–304`.

The timeout test calls `clientErrorHandler` directly with a fabricated error and socket. It proves the function's output for that input, but does not cause a real HTTPS request to time out. Lead ruling 5b in the task explicitly requires the responses below the framework to be tested “over a raw socket”; ADR-010 rule 1 includes a request that times out among those responses. The other parser and closing cases use real TLS sockets, but this case does not.

The concrete untested scenario is a client that opens a TLS connection, sends incomplete HTTP headers and then stalls until the runtime times out the request. The current test bypasses the runtime event and its connection lifecycle, so its green result cannot demonstrate the required envelope-or-empty-body response in that scenario. This is a missing acceptance proof, not an observed malformed timeout response.

**Proposed fix:** add a test using the existing raw TLS helper and a deliberately short timeout on the test server, without changing production timeout policy. Let the runtime produce the timeout and assert the resulting status, permitted body and connection closure. The Handoff's explanation that the default request timeout is 300 seconds should also be corrected: the installed Fastify initializes `requestTimeout` to zero (`node_modules/fastify/lib/config-validator.js:24–25`) and assigns it to the server (`node_modules/fastify/lib/server.js:340`). That setting does not itself prove the behavior of a stalled-header timeout.

## What I ran and what I did not

- **Observed:** `npm run verify` exited successfully. Typechecking passed; **58 test files and 3,094 tests passed**, matching the Handoff and its increase of two files and 89 tests over the task's stated baseline of 56 files and 3,005 tests.
- **Observed:** `git diff --stat` was empty immediately before and after that green run. `git rev-parse HEAD development` returned the same two commits before and after. The reviewed tree was stable.
- **Observed:** `git diff --check development...agent/phase0-008b` passed. I inspected the source and test diff, including the dependency lockfile. Existing test assertions were retained; their changes are within the task's permitted headers/helper and error-code additions.
- **Observed limitation:** attempts to run only `client-instance.test.ts` and `origin.test.ts`, through both `npm exec vitest run ...` and `npm run test:unit -- ...`, exited during setup with `connect EPERM 127.0.0.1:5433`. Neither attempt ran tests. I therefore did not independently reproduce the Handoff's three consecutive focused green runs. This does not change the observed successful full verification above.
- I read the builder's red-proof record but did not independently run its mutations. I did not run a real timeout experiment or use Chrome or Safari. The browser check is explicitly assigned to the lead by ruling 4; this report does not close that acceptance gate.
- I made no source, test, task or memory changes, and did not commit or push.

## Cleared

- Host validation runs at the root. Origin validation runs in the API context before client-instance database access. Matched routes, encoded API paths, API misses, outside misses, absolute-form targets and closing requests were checked against their distinct policies. API misses follow the explicit exception in lead ruling 6.
- The shared client-instance value was checked across absent, malformed, unknown and existing cookies, and health with and without an existing cookie. The hook assigns database-returned identifiers on both branches; malformed values bypass the UUID update query. The cookie attributes, lack of renewal, health opt-out and monotonic `last_seen_at` statement match the task.
- The identifier remains telemetry and continuity data under FR-A7 and ARCHITECTURE §5.1. No new authorization, throttle, approval or actor decision reads it. The security-event and session probes exercise real foreign keys; the existing domain validation of an optional telemetry value is not authentication. B-13 and B-14 remain intact.
- Raw TLS tests cover absolute-form rejection, parser rejection, header overflow and the closing 503. Their responses use the required envelope or empty body. The new error handler uses the existing safe serializer and copies no exception text into responses. The full suite also retains the logging, no-CORS, no-HSTS and API `no-store` checks.
