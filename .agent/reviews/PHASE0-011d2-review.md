# PHASE0-011d2 review

## Verdict: findings

One high-priority finding. Reviewed `agent/phase0-011d2` at `104b7a7e436195b2dfe4e364b2b06b5e6ad573b5` against `development` at `ecead3d59394b79f8234deb4b0dfc32e9733a320`, the task's rulings, its cited contract and design, and the relevant server and API-client paths. The full verification suite passes. The owner's served-browser check remains outstanding.

## Findings

### F1 — P1: A failed other-manager sign-in can leave M-6 naming a different person from the session its requests use

**Location:** `apps/back-office/src/session/realSession.ts:422`, with the failure settlement at `:453` and `:460-477`.

`otherSignIn` suppresses every `actor-changed` event during the request, including a stale session read installing a third person's view. Clearing that flag at settlement forgets the suppressed event. The existing test at `apps/back-office/test/reauth.test.tsx:798` covers this interleaving only when login answers with a successful view: the core then returns `session-gone`. That protection does not cover a credential refusal or a fault. The core returns a non-ending refusal unchanged even when obsolete, and classifies faults through health. The store consequently leaves M-6 under the original person's name while its core holds the third person's actor and token.

**Authority:** FR-A2b and ADR-009 §6 require the fixed form to re-authenticate the manager whose session idled. The owner's 2026-10-06 refinement (`.agent/DECISIONS.md:113`) reserves another manager's authentication for their ordinary username-and-password sign-in. Task ruling 6 sends an unrelated actor change to BO-01 *Session ended*. Ruling 7 defers the sign-in's own installation event so that its result can decide; treating an unrelated event as permanently irrelevant after a failed sign-in defeats that distinction. This is also the task's explicit constraint that requests act only for the person this tab holds or the person who just signed in.

**Concrete failing scenario, reproduced without editing files:**

1. Load A (`m.iqbal`), hold a visibility `me`, and answer activity with `SESSION_IDLE` to open M-6.
2. Open the other-manager form and hold its ordinary sign-in for B (`r.ayu`).
3. Deliver the held `me` with C's view (`third`, token `tok-3`). The store suppresses the actor change and drops the stale read by revision, but the core has adopted C.
4. Deliver the login with `INVALID_CREDENTIALS`. M-6 remains `idle`, naming A. I repeated this with `INTERNAL`/500 and rejected fetch; all three have the same identity mismatch.
5. Choose “Back to m.iqbal” and submit the fixed password form. The actual request recorded by the harness carries `X-RPOS-CSRF: tok-3`, although the fixed Username names A. With a stubbed successful re-authentication view for C, the store enters `signed-in` as C and shows “Your session has resumed.”

The observed mismatch and outgoing token are client evidence. Given a browser cookie for C, the server verifies this request against C's account, not the A named on screen (`apps/server/src/http/routes/back-office-auth.ts:98-103`). A's password would therefore be tested against C; C's correct password could enter C through the form labelled A. The working-area key still prevents C from receiving A's draft; this finding is not a demonstrated draft leak.

**Proposed fix:** Remember actor changes deferred during the other-manager sign-in. If that request does not successfully establish the screen's new identity, consume the deferred change by going to BO-01 *Session ended*, retaining the old work hidden and inert. Preserve the current handling of the successful sign-in's own event. Add the non-ending refusal and fault variants to the existing third-person interleaving test, asserting that neither fixed re-authentication nor logout remains available under A's name with C's token. This can be addressed in the store without changing the core or inventing copy.

## What I ran and what I did not

**Observed:**

- `npm run verify` exited successfully. Typecheck passed for all six projects; Vitest reported **90 test files and 3,726 tests passed**, duration 63.53 seconds. Relative to the task's recorded development baseline, that is one additional file and 74 additional tests.
- `npx vitest run --project client apps/back-office/test/reauth.test.tsx apps/back-office/test/session-lifecycle.test.tsx` passed **2 files and 97 tests**.
- Before and after those green runs, `git status --short --branch` showed a clean `agent/phase0-011d2`, both revision hashes above were unchanged, and `git diff --stat development` was identical: **13 files, 3,146 insertions, 88 deletions**. The tree remained clean after the supplementary reproduction, before this report was added.
- A `node -e` reproduction loaded the unchanged TypeScript modules through an in-memory transpilation hook, used jsdom and the existing session harness, and drove the real React controls, session store and API client with held fetch responses. It reproduced F1 for a credential refusal, a server fault and a rejected fetch. No source or test file was modified, and this was not a mutation test.
- Source scans found no direct fetch, storage, cookie, beacon or console access, no POS imports, and no literal session/cooldown limits in the back-office source. The dialog methods are called in source and implemented only in the test shim. I checked the branch diff, including the changes to the five authorized existing tests.

**Not run or not established:** I did not run the owner's served HTTPS/browser walkthrough, inspect real top-layer rendering or native inertness, measure overflow, or test assistive technology. The jsdom shim cannot establish these properties. I did not rerun the builder's source mutations or the three consecutive runs of each file; those remain Handoff evidence rather than my observations. I did not independently exercise the isolated re-authentication `session-gone` branch. Static tracing supports the builder's explanation that the ordinary generation-changing events advance the store's revision first; that is not a runtime proof of that branch. No commit or push was made.

## Cleared

The normal idle and re-authentication paths retain the keyed working area, explicitly inert the frame, capture focus before rendering M-6, and restore focus and selection after same-manager renewal. Ordinary other-manager success changes the key; session loss retains the old work; forbidden access and confirmed discard remove it. Reloaded idle sessions still show BO-01. The tests reach idle through the real activity/deadline and core-event path, rather than injecting an idle snapshot.

Outside F1's pending-sign-in window, stale reads cannot resume M-6 or restart its activity/visibility reads. The revision guard also remains necessary for the existing third-person pending-sign-in test; the additional same-person checks do not make it redundant in general.

Both forms use bounded, uncontrolled password inputs, POST forms with prevented submission, and the API module. The fixed username is set as a property. Copy, per-account waits, fresh-entry retry, pending-request exclusion and the logout failure placement follow the cited rows. In particular, the shared logout confirmation correctly shows the idled account's cooldown only when entered from the fixed form, and preserves the typed other-manager username when Keep returns to that form. The shared `otherSignIn` flag is the state-dependent control that fails in F1.

The dialog guard distinguishes the two dialogs during mode changes, and the tests cover cancellation, Escape, loop endpoints and explicit inert attributes within the shim's limits. The CSS changes use the Frost dialog and destructive-button rules. No server, package, POS or design-document change is included in the implementation diff.
