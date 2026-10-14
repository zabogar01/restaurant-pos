# PHASE0-011c1 review — Round 2

## Verdict

**findings** — three P2 findings remain in session-generation handling. The original token-exposure finding is resolved, and the two exact out-of-order sequences from the first review now pass. The first review remains available in Git history.

Reviewed `agent/phase0-011c1` at `01e2f770d425a430be975bfa21ff31d5c13248b5`, including implementation commit `25abfdf`, against the task's Round 2 rulings and Handoff. `development` was `3158f0a3a771be8cc0e794f0f53bf408dae6d4cd`; the branch diff uses their merge base, `2dfc26d15efb6c42103f2cd95ffe65ec74cac315`. This review does not claim integration with the later design work on development or screen-level acceptance.

## Findings

### 1. P2 — Back-office idle responses invalidate successful password renewal

**Location:** `packages/api-client/src/client.ts:178`, called for back-office idle responses at `:287`.

`endSession` increments the generation unconditionally, including when `keepToken` is true. A back-office `SESSION_IDLE` therefore invalidates in-flight re-authentication even though it preserves the same renewable session. Re-authentication is checked against that generation and its successful response becomes `session-gone`.

**Authority:** Round 2 lead ruling **1** explicitly lists `SESSION_IDLE at the POS` as a session-ending generation transition. Copied ARCH-014 question 4, **rule 4**, preserves the back-office session token through idle expiry because password renewal needs it. PRD **FR-A2b** requires the same manager to resume with their password. The Handoff's expansion to idle responses “at either surface” is not the ruling.

**Observed failing scenario:** Sign in to the back office, receive `SESSION_IDLE`, start re-authentication, and hold its successful response. Deliver another `me` response reporting the same idle session, then deliver the successful renewal with a new token. The unchanged module returns `{ kind: 'session-gone' }` for renewal, keeps the manager but a null deadline, and sends the old token on the next mutation. This models a visibility/session read overlapping password submission; no actor replacement or logout is needed.

**Proposed fix:** Distinguish preserving a renewable back-office idle session from ending a session. Do not advance its session generation merely for another idle response. Preserve generation invalidation for actual ends and replacements, and add a controlled overlap test asserting that renewal returns a public `ok` view, installs its new deadline, and sends its new token.

### 2. P2 — The first session recovered by me does not advance the generation

**Location:** `packages/api-client/src/client.ts:191`.

`changed` requires an already non-null actor, while `install` is true only for POST session views. Consequently, the normal reload path—`me` installing a session into an empty core—changes neither `generation` nor `installs`. Older responses still count as current and can erase the newly recovered session. This leaves the original obsolete-response defect present on the recovery path even though it is fixed after explicit login.

**Authority:** Round 2 lead ruling **1** requires a generation for an installed session and prohibits older responses from changing its token, actor, deadline, or events. The task's required inputs and copied ARCH-014 question 4, **rule 4**, make `me` the session/token recovery path after reload; it must receive the same protection as a session installed by sign-in.

**Observed failing scenario:** An empty POS core starts `me` and receives a 401 response whose body is delayed. Another `me` succeeds for A, establishing actor A and deadline `91000`. Deliver the earlier `UNAUTHENTICATED` body: the result is `refused`, the core emits both a null deadline and `session-ended`, and the actor and token are cleared. The next mutation has no CSRF header. The final probe delayed only the response body, so this observation does not depend on a late clearing cookie header replacing a newer browser cookie. A shared-profile sign-in between the reads can make this sequence relevant during reload/visibility handling.

**Proposed fix:** Treat a successful session view adopted while no actor is held as installing a session, while keeping the actor-change event's separate semantics if needed. Advance both counters consistently and test older terminal refusals and views arriving after initial `me` recovery on both surfaces.

### 3. P2 — An obsolete release returns ordinary success instead of session-gone

**Location:** `packages/api-client/src/client.ts:293`, with the completion handling at `:384`.

The obsolete-success branch checks only `spec.session`, overlooking `spec.ends`. The request wrapper correctly skips ending a newer session, but returns the obsolete release's `ok` result unchanged. The caller cannot distinguish this obsolete session-ending response through the result contract.

**Authority:** Round 2 lead ruling **1** requires `session-gone` when an obsolete response would otherwise apply a session end. Release and logout explicitly have `ends: true`; the updated Handoff defines `session-gone` as the signal to make no session change on account of that response.

**Observed failing scenario:** Sign in as A, leave release pending, successfully sign in as B, then deliver release's 204. The core preserves B, but returns `{ kind: 'ok', value: undefined }` for release. The existing `13f` test covers this sequence but checks only B's retained identity, not the release result. A downstream caller following the documented result distinction can therefore process an obsolete release as an ordinary completion. No downstream screen is built here, so that UI effect is an inference; the incorrect result is directly observed.

**Proposed fix:** Classify obsolete release/logout completions as `session-gone` as well as suppressing their local state changes. Add assertions for the result, absence of events, and preservation of the newer actor, deadline, and token for both terminal routes.

## What I ran and what I did not

- `npm run verify` passed: typecheck succeeded, including the new `@ts-expect-error` assertions; **73 test files and 3,413 tests passed**. Vitest reported 69.66 seconds. The existing Vite config-loader warning appeared.
- `npm exec vitest run -- --project client packages/api-client/test` passed: **3 files and 48 tests**. This was one targeted run; I did not independently repeat each new file three times.
- Before and after the green full run, `git diff --stat` was empty and `git status --short --branch` showed only the branch name. HEAD and development retained the hashes above. The branch diff contained 13 files, 1,899 insertions, and one deletion. The reviewed source tree was stable; the review and requested Handoff note were edited afterwards.
- I ran three inline `node --import tsx --input-type=module -e ...` probes against unchanged source with injected fetch/clock and synthetic credentials. The first observed the overlapping back-office idle/renewal failure; the second observed initial recovery being erased and the obsolete-release result; the third isolated initial recovery using a delayed response body and also checked emitted events and the next mutation's token. These are runtime observations, not source-mutation tests or live-server/browser proofs.
- I reviewed the Round 2 diff, its new tests, the branch changes against the merge base with development, the new rulings and Handoff, and the cited identity/idle requirements and boundaries. The earlier review's unchanged transport and authority analysis still applies. The new runtime and type assertions cover all five session-view routes.
- I did not independently rerun the builder's historical red proofs. The Handoff records those runs; they are not claimed as reviewer observations. I did not use Context7, a browser, or a live API session to establish these findings.
- No source or test file was edited, and no commit or push was made. At the explicit request in this re-review dispatch, I appended only a reviewer completion note to the task's Handoff, in addition to updating this report.

## Cleared

The token-exposure finding is resolved: `publicView` strips the token at runtime and `ValueOf` omits it at compile time. All five route tests confirm the public boundary and the token on the next mutation. The schema still validates the complete wire view before the public projection, including the back-office username.

The original delayed `me` after release and older `UNAUTHENTICATED` after explicit login are now covered and pass. Interactive responses from earlier generations no longer change the current deadline. CSRF refreshes are separated by generation, and a delayed refresh after release does not adopt or retry. Same-actor retry, changed-actor refusal without release, one retry only, and overlapping refresh sharing remain green. The first-settling concurrent sign-in policy is documented and tested.

The one changed existing test substitutes `VALIDATION_FAILED` for its former non-terminal `FORBIDDEN` fixture, matching Round 2's explicit addition of `FORBIDDEN` as a terminal response; its assertions are unchanged. The ordinary transport validation, code-based classification, timeout/health behavior, and source-purity checks remain green. The shared-state check in this round focused on the generation counter used across POS expiry, back-office renewable idle state, initial recovery, and terminal-route completion; the findings above identify where those states still differ incorrectly.
