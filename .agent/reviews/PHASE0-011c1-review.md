# PHASE0-011c1 review

## Verdict

**findings** — two medium-severity findings. Reviewed `agent/phase0-011c1` at `21241b0b9b47a42554233c95cfecdf446382fcf6` against `development` at `2dfc26d15efb6c42103f2cd95ffe65ec74cac315`, the task, its copied ARCH-014 specification, and the cited contract and prior handoffs. No screen is built in this slice.

## Findings

### 1. P2 — An older response can restore a released session or erase a newer session

**Location:** `packages/api-client/src/client.ts:282`, with the unconditional session changes at `:246` and `:251`.

Every completed request applies its response to the same mutable actor, token, and deadline, regardless of whether that request belongs to the session the core still holds. `actorAtSend` protects the CSRF identity comparison, but does not protect ordinary response settlement. This is the shared-state failure shape checked in this review: one current session is used for both current and obsolete in-flight requests.

**Authority:** PRD **FR-A2** requires the POS actor context to expire on explicit release. The task's copied ARCH-014 question 4, **rule 4**, requires the core to drop the token when the session ends; lead ruling **3** requires a usable session-end and deadline interface. A response generated before release is not a new authentication and must not undo that end in the core.

**Observed failing scenario:** Sign in as A, start `posMe`, and delay delivery of its successful body. Complete `posRelease` with 204. The core correctly reports a null actor and deadline. Deliver the earlier `me` body: its result is `ok`, the actor becomes A again, the deadline becomes `91000`, and the next mutation carries A's old token. I reproduced this against the unchanged module with an injected fetch and clock. A second probe confirmed the inverse: a delayed `UNAUTHENTICATED` response from an older request clears actor B after a newer successful sign-in has installed B.

The server still enforces session validity; these probes do not demonstrate a server authorization bypass. They demonstrate incorrect state and results in the transport interface that the next client slice will consume.

**Proposed fix:** Associate requests and CSRF refreshes with a session generation, invalidate obsolete work when the session ends or is replaced, and prevent obsolete outcomes from changing the current session or being returned as a current successful session view. Apply this consistently to session views, terminal refusals, interactive deadline updates, and release/logout completion. Add controlled out-of-order tests for both sequences above, including the token on a subsequent mutation.

### 2. P2 — Successful session results expose the supposedly private CSRF token

**Location:** `packages/api-client/src/client.ts:255`; the public return type also exposes it through `packages/api-client/src/specs.ts:68`.

After adopting a session view, `settle` returns the entire parsed view as `value`. The public `ValueOf` type is inferred directly from the wire schema, so `result.value.csrfToken` is available both at runtime and to TypeScript callers. The closure is not the token's only owner, contrary to the interface's stated guarantee.

**Authority:** The task's copied ARCH-014 question 4, **rule 4**, says the token is held in the core's closure and nowhere else, specifically excluding React state, the DOM, storage, and logs. This is a transport-interface requirement, not a claim that B-12 itself covers CSRF tokens.

**Observed failing scenario:** A successful `request(ROUTES.posLogin, { pin })` returns keys `staffUserId`, `name`, `role`, `csrfToken`, `idleSeconds`, and `idleRemainingSeconds`. My runtime probe confirmed that the returned token equals the synthetic wire token. A consumer retaining the returned session view in its session store therefore retains the token outside the core without making any separate token read. The same return path is used by `me`, back-office login, and re-authentication.

**Proposed fix:** Keep the full validated wire view private, but return a separate public session value that omits `csrfToken`. Update `ValueOf` accordingly and prove both that public results have no token property and that the next mutation still sends the privately adopted token. Cover both surfaces and all session-view routes.

## What I ran and what I did not

- `npm run verify` passed: typecheck succeeded; **72 test files and 3,399 tests passed**. Vitest reported 62.23 seconds. The existing Vite config-loader warning appeared.
- `npm exec vitest run -- --project client packages/api-client/test` passed: **2 files and 34 tests**. This was one independent targeted run, not a repetition of the builder's three-run claim.
- Before and after the green verification run, `git diff --stat` was empty, `git status --short --branch` showed only `agent/phase0-011c1`, and both recorded commit hashes were unchanged. The branch diff comprised 11 files, 1,409 insertions, and one deletion. The reviewed source tree was stable. This report was written afterwards.
- I ran two `node --import tsx --input-type=module -e ...` probes against the unchanged source, with synthetic session data, an injected monotonic clock, and deferred fetch response bodies. They directly observed the token exposure, session restoration after release, and removal of a newer session by an older refusal described above. No source or test file was edited for these probes.
- I read the changed source and tests, the task's acceptance cases and Handoff, the cited PRD requirements including FR-A2, FR-A2b, FR-A2c and AC-28, the boundaries, ADR-010, the cited architecture sections, and the preceding transport/session handoffs. I did not independently repeat the builder's three source-mutation red proofs; their outcomes are Handoff evidence, not my observations.
- I did not run a browser or claim screen-level acceptance. Client construction, POS state handling, back-office forms, and the browser harness are outside this slice. No source, tests, task file, or memory file was changed, and no commit or push was made.

## Cleared

The package remains a pure transport with injected fetch and clock, no React or application changes, and a runtime dependency only on contracts. Requests resolve through the shared route table, enforce the selected surface, use relative paths and the required fetch options, validate credential bodies before sending, and omit Content-Type for bodyless requests. Runtime response schemas reject malformed session views and envelopes without returning response text or exception details.

The tested CSRF sequences retry once with the refreshed token for the same actor, refuse an actor change without sending release, stop after a second refusal, and share one overlapping refresh. Error handling distinguishes the codes sharing 401 and retains their typed details. Fault handling asks health once and does not resend the original request; timeout cancellation is exercised. The ordinary sequential deadline cases use the send-time monotonic clock and remaining seconds, and failed/non-interactive requests do not extend the deadline. POS idle expiry drops the token, while back-office idle expiry preserves it for re-authentication. These checks pass; they do not cover the obsolete-response sequences in finding 1 or the public token boundary in finding 2.
