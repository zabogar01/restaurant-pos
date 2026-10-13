# PHASE0-011a review

## Verdict

**findings** — two medium-severity findings. Reviewed `agent/phase0-011a` at `1401d7fd00e976fb120d5042c073d5b4bd96cdcb` against local `development` at `e52d0a411d9816632a3e9aff376d0eb2562a05a4`, the task specification, its cited requirements and boundaries, and ADR-010. The complete verification suite passes, but the response-header and logging constraints are not satisfied in the scenarios below.

## Findings

### 1. Medium: refusals on the bare bundle prefixes omit the required policy headers

**Location:** `apps/server/src/http/bundles.ts:113` and `apps/server/src/http/bundles.ts:136`.

The `/pos` and `/back-office` redirect routes are registered outside the child contexts that install the bundle error handler. Their policy headers are set only inside the successful redirect handler. If the inherited Host guard refuses the request first, the root error handler sends the response without `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, or `Cross-Origin-Resource-Policy`.

I reproduced this through `buildServer` and the repository's `inject` helper: `GET /pos` and `GET /back-office` with `Host: evil.example` each returned 403, the fixed origin sentence, and `Cache-Control: no-store`, but none of those four policy headers. The same refused request to `/pos/` carried all four. Thus the shared header function covers the successful redirect state while the refusal state bypasses it. The current tests check the redirect's success and refusals below `/pos/` separately, which hides the gap.

**Authority:** PHASE0-011a rule 5 and its binding “Headers” section (`.agent/tasks/PHASE0-011a-serve-bundles.md:137`), requiring the policy headers on every response from a bundle route. This is not a claim that the Host guard admits the request; its refusal is correct.

**Proposed fix:** give the bare-prefix routes the same error-path header handling as the child routes, without adding those headers to unrelated root/API responses. Extend the header tests to refused GET and HEAD requests on both bare prefixes as well as their slash forms.

### 2. Medium: bundle URL paths still reach the request log

**Location:** `apps/server/src/http/server.ts:117`, through the inherited request serializer at `apps/server/src/http/log.ts:61`; the added coverage is at `apps/server/test/log-scan.test.ts:130`.

Registering the bundle routes leaves Fastify's incoming-request logging active with the existing serializer, which removes the query but retains the caller-supplied path. I sent `GET /pos/REVIEW-PATH-7744?token=REVIEW-QUERY-8855` through the real server builder with a captured trace log. The response was 200 and the log contained `"req":{"method":"GET","path":"/pos/REVIEW-PATH-7744"}` in its `incoming request` entry. The query marker was absent. The new log-scan cases put their marker only in the query, so they do not establish the stronger constraint written in this task.

**Authority:** the explicit PHASE0-011a constraint at `.agent/tasks/PHASE0-011a-serve-bundles.md:350`: “nothing from a bundle request's URL or query reaches a log line.” ADR-010 rule 2 permits path-only logging in general; the finding is against this task's narrower bundle constraint, not a claim that ADR-010 itself bans all paths or that an actual credential was observed.

**Proposed fix:** suppress caller-supplied bundle paths in request logs, including misses and refusals, while preserving useful fixed route/status diagnostics and the existing API logging policy. Add separate bundle path and query markers to the log scan. If path-only logging was intended for bundles too, the lead needs to resolve the task wording explicitly rather than treating the existing query-only proof as satisfaction of the written constraint.

## What I ran and what I did not

I ran `npm run verify` myself. Typechecking passed for all four configured projects, and Vitest reported **68 test files passed and 3335 tests passed**, with a test-run duration of 58.48 seconds. Against the task's recorded baseline of 66 files and 3252 tests, that is two additional files and 83 additional tests.

Immediately before and after that green run, `git diff --stat` was empty, `git status --short --branch` showed only `agent/phase0-011a`, and both HEAD and development hashes were unchanged. The reviewed tree was stable. The review report is the only authored change.

I ran `npm run test:unit -- apps/pos/test/built-bundle.test.ts` three times individually. Each run passed all three tests in one file; their test durations were 195, 202, and 171 milliseconds. Each invocation built the real Vite configuration into its own temporary directory. The attempt to run `apps/server/test/bundles.test.ts` individually failed during setup with `connect EPERM 127.0.0.1:5433`; it did not execute that file's tests. The server file did pass within the full verification run. I did not retry the denied database connection or start Docker. The builder's Handoff records three combined runs of the two new files, rather than the individual runs requested by acceptance criterion 2, so three standalone server-file passes remain unverified here.

The two findings were reproduced with read-only, in-process probes using the production `buildServer`, default bundle roots, and the prescribed request helper. Those probes used the existing POS build only to exercise routing and logging; they are not the evidence for case 18. Additional probes confirmed that a conditional index request returns 304 with the policy and `no-cache`, a valid byte range returns 206, and malformed JSON outside `/api` returns fixed plain text with `no-store` and the bundle policy. Unsatisfiable range and failed `If-Match` requests become fixed 500 responses under the existing framework-status allow-list; I am not reporting that as a task violation.

Source searches found `process.cwd` only in the migration CLI, no forbidden transport-security/CORS/plugin strings in server source, and no `setCookie` or `Set-Cookie` in `bundles.ts`. I inspected the complete branch diff and the new tests. I did not perform source mutations; the five red proofs remain builder-reported evidence. I did not independently repeat the startup/curl transcript or operate a browser. The Chrome/Safari policy and cookie checks remain assigned to the lead or owner before 011c, as the task requires.

## Cleared

The file-anchored default roots, optional bundle registration, per-prefix fallback, fixed redirects, asset-miss handling, per-request not-built checks, and independent back-office behavior match the task. Routes declare no API access policy and do not invoke the API client-instance or session hooks. The suite covers ignored client-instance cookies, unchanged database row counts, and serving bundles with an unreachable database. The Host guard remains inherited and the API-only origin guard does not block cross-site navigations to bundles.

The ordinary hit, miss, fallback, redirect, and not-built states have the specified cache and policy headers, with no HSTS, CORS grant, or issued cookie. Traversal and dotfile cases are covered, including raw TLS requests. API error envelopes and the early framework handler remain intact; the outside-API error wording is fixed and request-independent. Existing test changes stay within the task's authorized files and cases. POS source, product documents, and accepted ADRs are unchanged. The Vite asset setting, scripts, real-build test, and declared static dependency match the requested scope.
