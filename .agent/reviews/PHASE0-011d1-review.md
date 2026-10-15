# PHASE0-011d1 review

## Verdict: findings

Reviewed `agent/phase0-011d1` at `32724694c77bd728936a2976fcd9f67cf302b222` against `development` at `3a4a2524c8a9a7cc99dcb2b052595461bb8da265`, the task and its lead check before review, and the cited contract, architecture and design requirements. There are three findings: one high and two medium. The full verification run is green, but it does not cover the failing transitions below.

## Findings

### F1 — High: completing logout leaves the next sign-in permanently disabled

**Location:** `apps/back-office/src/session/realSession.ts:409`, with the snapshot captured at line 176 and consumed by `apps/back-office/src/SignIn.tsx:70`.

The core emits `session-ended: SIGNED_OUT` before the logout promise settles. The event handler publishes BO-01 while `cookieChanging` is still true, so its snapshot contains `busy: true`. The promise handler then clears the private flag, but returns on the changed revision without publishing that change. Both credential fields remain disabled and the button remains “Signing in…”, although no request is pending.

**Authority:** Task lead rulings 2, 5 and 9, and DESIGN-015's BO-01 Resting and Loading rows. Confirmed logout must return to ordinary resting BO-01; the request exclusion applies while a cookie-changing request is in flight. FR-A2b requires both sign-in and explicit logout.

**Observed failing scenario:** Load a valid manager session, click the rendered Log out button, and return 204. After all promises settle, the snapshot is `phase: 'signed-out', why: 'resting', attempt: { kind: 'none' }, busy: true, held: null`. Username and Password are disabled, and the sole button is `Signing in…` with `aria-disabled="true"`. The next manager cannot sign in without reloading. An ending response during a pending logout can publish the same stale busy value. The existing test at `test/session-lifecycle.test.tsx:160` checks the phase and removal of work, but never checks that the form is usable afterwards.

**Proposed fix:** When the cookie-changing operation settles, synchronize its busy flag into the current snapshot even if an event already changed the phase. Preserve the event's reason and draft decision. Add a rendered logout-to-next-sign-in test, and cover a session-ending event while logout is pending. Keep entry disabled until the pending request actually settles.

### F2 — Medium: a forbidden response after idle does not remove retained protected work

**Location:** `apps/back-office/src/session/realSession.ts:285`.

The event handler ignores every session-ended event unless the screen is currently signed in. After interim idle has shown BO-01, however, the core still holds the session token and actor and the store still holds that manager's working area. A subsequent authoritative `FORBIDDEN` event must remove that area. The phase guard discards the event, and the read's revision guard correctly prevents its older continuation from applying anything, leaving no path that performs the required removal.

**Authority:** Task lead ruling 4 explicitly requires `FORBIDDEN` to destroy the working area; ruling 6 maps its session-ended event to Access refused. DESIGN-015's BO-01 Access refused row requires removal of protected work and the manager-access notice. This is distinct from the preservation allowed after idle or absolute expiry by FR-A2b and the owner's recovery rulings.

**Observed failing scenario:** Load manager A and type into the test-only draft. Hold a visibility `me` read. Send activity and answer it with `SESSION_IDLE`, returning to resting BO-01 with the draft hidden. Deliver `FORBIDDEN` on the held read. The final snapshot still has `why: 'resting'` and `held: 'm-1'`; the draft input still contains `private draft`, and there is no Access refused notice. The core's event is current because back-office idle does not advance its generation. The work remains hidden, so this is a failure to dispose of protected state, not an observed cross-manager disclosure.

**Proposed fix:** Handle the core's authoritative removal event when a working area is retained behind BO-01 as well as when signed in. Keep the revision guard: removing it is not the fix. Add this interleaving and assert removal of the child, Access refused copy, and a fresh area after a later successful sign-in.

### F3 — Medium: non-ending credential refusals leave logout stuck in flight

**Location:** `apps/back-office/src/session/realSession.ts:418`.

Logout reuses the sign-in meanings for `INVALID_CREDENTIALS` and `THROTTLED`. These become `credentials-error` or `cooldown`, so the handler calls `applyEnd`, which intentionally does nothing for either meaning. The private cookie-changing flag is cleared, but the signed-in snapshot retains `logout.inFlight: true`, without a failure notice or Try again action. The rendered Log out button refuses further clicks.

**Authority:** Task lead ruling 5 requires a non-ending refusal to retain the session and support logout retry; the copied DESIGN-015 Logout failed row requires the shared failure notice, “Sign-out has not been confirmed.” and Try again. The exhaustive mapping obligation in ruling 11 must produce a usable state for an unexpected answer, not merely compile.

**Observed failing scenario:** With a valid manager session, click Log out and inject a parseable `INVALID_CREDENTIALS` response, or `THROTTLED` with a valid duration. Each leaves `phase: 'signed-in', logout: { inFlight: true, failure: 'none' }` after settlement. These are defensive response cases, not claims that the present logout route normally emits credential refusals. The core correctly retains the session; the new store mishandles the result.

**Proposed fix:** Treat every non-ending refusal on logout as a settled failure with the prescribed notice and retry. Only the actual ending meanings should go through the end transition. Add coverage for the credential refusal meanings alongside the existing general-failure cases.

## What I ran and what I did not

I ran `npm run verify`: typechecking passed for all six packages/applications in the root script; **89 test files and 3,645 tests passed**, with Vitest reporting 71.12 seconds. That is 11 files and 151 tests above the task's recorded development baseline. The run includes the new core tests and both self-building back-office bundle tests. I also ran `git diff --check development`, which passed.

Immediately before verification, `git diff --stat` was empty and the branch/base hashes were the ones recorded above. After the green run, `git diff --stat` and `git status --short` were still empty, and both hashes were unchanged. The reviewed tree was stable. The only subsequent file written by this review is this report.

I ran additional inline `node --import tsx --input-type=module -e` probes with jsdom, the existing session harness, the real session store and real API core, and stubbed fetch responses. These clicked the rendered logout control and reproduced F1 and F3; the held-read/input-event sequence reproduced F2. They did not alter source or test files. Their observed output is described in each finding; none depends on a proposed fix.

I also tested the lead's proposed sequence (c) twice with a TypeScript loader operating entirely in memory. The unchanged source stayed signed out and resting, with no notice or frame. Removing only `if (revision !== sentUnder) return;` at line 241 changed the reason to `ended` and displayed “Your session has ended” after the held successful read arrived. Both runs had one activity request, the triggering request. This proves the lead's explanation and contradicts the Handoff's claim that the revision guard is redundant. An initial version of the probe could not import `esbuild`; the completed probe used the installed TypeScript compiler and wrote no files. The builder still needs to commit sequence (c) as regression coverage and correct the Handoff as directed by the lead; the reviewer did neither.

I did not repeat every builder mutation or run each new test file three times individually. Those remain Handoff evidence rather than independently repeated observations. I did not perform the owner's live HTTPS sign-in/logout check, a visual browser inspection, password-manager testing, or browser focus/selection verification. Acceptance criterion 5 remains the owner's check. No source, test, task, memory or design file was edited; no commit or push was made.

## Cleared

- The core change is limited to the back-office ending route. Failed and unavailable logout results retain the session for retry, while the existing POS release behavior remains unchanged. The new side-by-side core tests passed. I found no additional defect in `confirmsLogout` itself.
- The password input is uncontrolled, read once and cleared on submission. Its form prevents submission and uses POST, and the credential goes through the shared request schema. The passing password tests cover successful, refused, throttled and failed responses, attributes, text, storage, console calls and request destinations. I found no password logging or other B-12 disclosure path in this change.
- The working area uses the staff-user key, is hidden and inert while retained, and is replaced for a different manager. The ordinary same-manager, different-manager, logout and forbidden cases pass; F2 identifies the uncovered event ordering.
- The local revision guard, initial-only session recovery and actor-change handling prevent the reviewed stale successful reads from signing the tab in. The lead's sequence (c) is valid and should be retained for 011d2. Interim idle remains within ruling 3; absence of M-6 is not a finding in this slice.
- Activity originates from the specified input listeners, including wheel, and is suppressed while logout is pending or unconfirmed. Deadline and visibility reads are non-interactive. Policy durations and cooldowns come from server values and use the injected monotonic clock.
- The independent workspace, route map, compile-time fixture switch, bundle asset paths, absent production fixture marker, import boundaries and source scans pass. No additional landing content, navigation destination, business-day value, incident or PIN control was introduced. The stylesheet uses Frost tokens and the permitted provisional form; rendered visual quality remains unverified.
