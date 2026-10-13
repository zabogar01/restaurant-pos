# PHASE0-011a review

## Verdict

**clean** — no remaining findings. Reviewed `agent/phase0-011a` at `95711795e8d9b4b04b12263f174f58b68c6e4679` against local `development` at `e52d0a411d9816632a3e9aff376d0eb2562a05a4`, the full task including its round-two rulings, its binding ARCH-014 excerpts, PRD NFR-1 and NFR-5, boundaries B-11, B-12 and B-24, and ADR-010. This report supersedes the first-round verdict.

## Findings

None.

The first-round header finding is fixed at `apps/server/src/http/bundles.ts:117`: the bare-prefix redirect routes now have an encapsulated error handler that adds the bundle policy before delegating to the inherited handler. The new cases at `apps/server/test/bundles.test.ts:365` cover refused GET and HEAD requests on both bare prefixes and slash forms. The cases at line 381 establish that the four bundle policy headers do not spread to unrelated paths or API responses.

The first-round logging finding is closed by the task's explicit round-two ruling 2 and corrected constraint. ADR-010 rule 2 permits path-only logging; the requirement is to exclude the query string. No logging change or path marker was required, and none was added.

## What I ran and what I did not

I ran `npm run verify` and read its successful completion. Typechecking passed for all four configured projects. Vitest reported **68 test files passed and 3348 tests passed**, with a duration of **53.40 seconds**. Against the task's recorded baseline of 66 files and 3252 tests, that is two additional files and 96 additional tests.

Before and after that green run, `git diff --stat` was empty, the branch was `agent/phase0-011a`, and both HEAD and development hashes were unchanged. The reviewed tree was stable. Only this report was subsequently authored; no source, test or task file was edited.

I independently ran a 48-request, in-process routing probe using the production `buildServer`, `defaultBundleRoots`, and prescribed `inject` helper. It crossed GET, HEAD, POST and OPTIONS with both bare prefixes, both slash forms, an unrelated path and an API miss, using accepted and refused Hosts. The bundle responses carried the policy and appropriate cache classification; refused bundle requests were fixed plain-text 403 responses with no-store. Unrelated and API responses did not acquire the policy. Accepted POST and OPTIONS requests under the bundle prefixes returned plain-text 404 responses. This probe used the existing POS build for routing evidence, not for the real-build acceptance test.

I ran `npm run test:unit -- apps/pos/test/built-bundle.test.ts` separately: one file and all three tests passed, with 204 milliseconds spent in tests. It made its own production build in a temporary directory. A separate `npm run test:unit -- apps/server/test/bundles.test.ts` attempt failed during setup with `connect EPERM 127.0.0.1:5433`; it did not execute the file's tests. I did not retry that denied connection or start Docker. The server file passed within the full verification run. The Handoff now records the required three individual passes for each new file; those six standalone results are builder-reported evidence, not runs I independently reproduced.

Source searches found `process.cwd` only in the migration CLI, no forbidden transport-security/CORS/plugin strings in server source, and no cookie setter in `bundles.ts`. I inspected the branch diff, the round-two delta, the test assertions and the cited HTTP handoffs. I did not perform a mutation run; the five original red proofs and the new four-failure header proof remain builder-reported evidence. I did not repeat the startup/curl transcript or operate a browser. The Chrome and Safari policy/cookie check remains assigned to the lead or owner before 011c, as the task explicitly requires.

## Cleared

The shared policy function was checked across successful redirects, Host refusals, ordinary hits, misses, unsupported methods and unbuilt bundles. The former gap between the successful bare-prefix state and its refusal state is closed without changing the root or API policy.

File-anchored roots, optional bundle registration, separate fallback roots, fixed redirect destinations, asset-miss handling, per-request availability checks and late builds match the task. No client route manifest is duplicated on the server. Traversal and dotfile tests cover injected requests and raw TLS request lines.

The inherited Host guard remains intact. Bundle routes sit outside the API origin, client-instance and session hooks, declare no access policy, issue no cookie and perform no database operation. The suite covers unchanged client-instance counts and bundle serving with an unreachable database. API envelopes and the early framework error handler remain intact; outside-API errors use fixed, request-independent text and no-store.

The Vite configuration, scripts, static dependency and fresh-build assertions match the requested scope. Existing test edits stay within the authorized cases; POS client source, product documents and accepted ADRs are unchanged. The Handoff carries forward the missing back-office bundle and browser checks needed by later slices.
