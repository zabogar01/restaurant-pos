# PHASE0-009a review

Current verdict: **clean** after the focused Round 2 review below. Finding 1 is resolved.

## Round 1 verdict

**findings** — one finding in the startup check. The existing suite passes, but a distinct route registered outside the API context can borrow an in-context route's identity and escape the required startup refusal.

Reviewed `agent/phase0-009a` at `6616e238d38e202cbceb18390be76c4fe942c1cd` against `development` at `ca33123e58db8f4e888367d6309fda9e3d4646cf`, using the task, its copied ARCH-012 contract, the cited predecessor Handoffs, PRD requirements, boundaries, architecture sections and ADRs. This is an API review; there is no new screen in scope.

## Findings

### 1. Medium: a shared method-and-path key conceals a route outside the API context

**Location:** `apps/server/src/http/access.ts:109`, with the identity constructed at line 62 and recorded at lines 105 and 122.

Both route sets contain only the method and URL. Fastify permits distinct registrations with the same method and URL when they have different route constraints. Consequently, seeing the ordinary registration inside the API context also satisfies the membership check for a constrained registration outside it. The latter never receives the origin, client-instance or session hooks, despite declaring `ACTIVE`.

**Authority:** ARCH-012 section 4, startup check 3, copied at task lines 304–308; PHASE0-009a rule 2 at task lines 574–575. The resulting response also violates ADR-010 rule 3's same-origin check and rule 1's `Cache-Control: no-store` requirement. These are the direct authorities; B-13 is not needed to establish this defect.

**Observed failing scenario:** I ran an in-memory probe through the real `buildServer` and the existing `inject` helper, without editing a source or test file. After building the server, I added this root registration alongside the existing production `GET /api/pos/auth/me`:

```ts
app.get('/api/pos/auth/me', {
  constraints: { version: '1.0.0' },
  config: {
    access: { session: 'ACTIVE', audience: 'POS', interactive: false },
  },
}, async request => ({ reached: true, actor: request.actor }));
```

`await app.ready()` succeeded. A request to that path with `Accept-Version: 1.x`, `Sec-Fetch-Site: cross-site`, the helper's correct Host, and no session cookie returned status 200 and `{"reached":true,"actor":null}`. `Cache-Control` was absent. The probe printed:

```json
{"ready":true,"status":200,"body":"{\"reached\":true,\"actor\":null}","cacheControl":null}
```

The existing case 4 uses unique paths, so it cannot expose the collision. This is the shared-value failure checked in this review: one method-and-path key stands for both a protected and an unprotected registration, hiding the latter. The shipped six routes do not currently register constrained alternatives; the defect is in the startup guarantee this task introduces, not an assertion that the probe route already ships.

**Proposed fix:** Track each registration's identity or its owning Fastify context independently of its display string. Keep method and URL for the diagnostic, but do not use them alone as proof that the registration inherits API policy. Add a regression with an in-context route and a constrained root or sibling registration sharing its method and path, and require `StartupError` before the server becomes ready. Preserve generated HEAD coverage.

## What I ran and what I did not

- I ran `npm run verify` myself. Typechecking passed, and Vitest reported **61 files passed, 3,166 tests passed**, with exit status 0. Against the task's recorded development baseline of 58 files and 3,095 tests, that is three files and 71 tests added. The branch diff leaves the client tests unchanged.
- Before and after that green run, `git diff --stat` was empty, and HEAD and development retained the hashes above. The reviewed branch diff remained **19 files changed, 2,739 insertions, 19 deletions**. `git status --short` was empty before report creation. The reviewed tree was stable.
- I ran the constrained-route probe above with `node --import tsx --input-type=module -e`, using `buildServer` and `test/support/request.ts`. Its server existed only in memory and was closed afterwards. It did not need or modify database state.
- `git diff --check development...agent/phase0-009a` passed.
- I read the three new test files and the existing-test diff. I did not independently repeat the builder's three targeted suite runs or its nine mutation proofs. Those results remain Handoff evidence, not reviewer-observed executions. I made no source mutation.
- I did not perform a browser check, exercise credential routes reserved for 009b, or run the production entry point separately. The full suite's existing transport tests ran as part of verification.
- While verification was pending, Docker status inspection and process listing were denied by the sandbox. Neither prevented the verification command from subsequently completing successfully.

## Cleared

- The six production routes have the required declarations. Missing and malformed declarations, audience/path mismatches, ordinary outside-context registrations and generated HEAD requests have test coverage. The finding concerns the untested registration collision.
- The guard follows the specified order: audience-selected cookie, CSRF before resolution on mutating requests, resolution, current back-office manager role, then actor assignment. Failures do not authorize a handler. Neither client-instance identity nor a session grants an inline approval.
- Production `me` and `activity` routes are used for audience separation, timeout and polling tests. The actor-inspection probe is additional evidence, not a substitute for those production paths. CSRF refusal tests inspect unchanged session activity.
- Idle POS cookies are cleared; idle back-office cookies are retained for renewal. Dead and repeated session cookies use the surface's exact clearing attributes. Role demotion refuses back-office access while leaving the POS role current, and restoration works. Release/logout isolate the two audiences and release idle sessions.
- Cookie handling stays in the guard module, the four new error codes have no details, and the log and header scans pass. The accepted `Date.now()` exception is JavaScript logging code, not new SQL clock usage. Existing tests gained the authorized declarations and type assertions without weakened assertions.
- The jar keeps separate CSRF values and path-scoped cookies for the two surfaces. The tests cover independent profiles and one profile holding both sessions. Credential verification, client activity dispatch and browser timeout presentation remain outside this task as specified.

## Round 2

### Verdict

**clean** — finding 1 is resolved; no new findings within this round's scope. Reviewed fix commit `9c59a84e9b0a33ac6b8b11bf9c057fea2b0668f4` against finding 1 and lead rulings 9–13. Verification ran at HEAD `c6d1c2c5aac15dbff4c2c44daad095a1781164f4`; its only difference from the fix commit is the task's lead-check text. Development remained `ca33123e58db8f4e888367d6309fda9e3d4646cf`.

### Findings

None. `access.ts` records each root registration's options object and checks that exact object against the API context's `WeakSet`. Method and path are retained only for the diagnostic. A protected registration can no longer conceal a distinct registration with the same method and path. This meets ruling 9 and ARCH-012 section 4, startup check 3.

### What I ran and what I did not

- I reran `npm run verify`: typechecking passed, **61 files passed and 3,169 tests passed**, exit status 0. That is three additional tests since Round 1 and 74 above the task's original 3,095-test baseline.
- Before and after verification, `git diff --stat` and `git status --short` were empty, and HEAD and development retained the hashes above. The branch diff against development remained **20 files changed, 2,902 insertions, 19 deletions**. Report and Handoff updates were made only after this stability check.
- I reran the original production-factory probe: a constrained root `GET /api/pos/auth/me` declared `ACTIVE`. `ready()` now rejects with a `StartupError` naming `GET /api/pos/auth/me` and its registration outside the API context. No request can reach that probe handler.
- I ran a separate in-memory registration harness against the fixed `installAccessChecks`. Constrained registrations on the root and in a sibling plugin were both refused with `StartupError`; the equivalent registration inside the API context started successfully. The probe directly compared the objects received by the root and API hooks: they were identical for each GET and generated HEAD registration, including the constrained routes. This independently verifies the identity assumption in ruling 9.
- In that harness, I transpiled an in-memory copy of `access.ts` whose membership comparison again accepted a registration when an API registration shared its method and path. Both outside-context cases incorrectly started; the inside-context control still started. This independently reproduces the defect under the old comparison. It is a probe mutation, not a claim that I reran the builder's mutation of the Vitest case 4b suite. No source file was changed by the probe.
- `git diff --check 9c59a84^ HEAD` passed. I reviewed the fix's complete diff: production changes are confined to `access.ts`, test changes add the three case 4b regressions, and the Handoff records the fix and red proof. Case 8 is unedited. The user's explicit request to update the Handoff is the scope for the reviewer verification note added there.
- I did not repeat Round 1's broader review, its other mutation proofs, or a browser run. This verdict addresses finding 1 and rulings 9–13 only.

### Cleared

Rulings 9 and 10 are proved by the identity probe and passing root, sibling and inside-context cases. The generated HEAD behavior remains green. Ruling 11 has the builder's recorded case 4b red proof plus the independently observed in-memory reproduction above. Ruling 12's narrow implementation scope and Handoff evidence hold. Ruling 13's production-factory refusal is independently confirmed. No remaining information is needed for this focused review.
