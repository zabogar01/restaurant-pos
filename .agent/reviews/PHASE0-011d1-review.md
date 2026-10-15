# PHASE0-011d1 review — Round 2

## Verdict: clean

There are no open findings from this re-review. F1, F2 and F3 from Round 1 are closed, and the required sequence (c) regression test is now committed.

Reviewed the implementation in `b25b00f26f8bd3c619dd4eaf595bf7198f023ff2`, with the task's Round 2 rulings and Handoff, at branch head `59a651738fc8af6b9f0901732bb9d5cf2f07bb1f`. The comparison base remains `development` at `3a4a2524c8a9a7cc99dcb2b052595461bb8da265`. This verdict supersedes the Round 1 verdict; its original evidence remains in Git history. The owner's live browser acceptance check remains outstanding.

## Findings

None.

## What I ran and what I did not

I reran `npm run verify`. Typechecking passed for all six projects, and **89 test files and 3,652 tests passed**, with Vitest reporting 62.97 seconds. This is seven more tests than Round 1 and 158 more than the task's recorded development baseline of 78 files and 3,494 tests. The seven additions are in `apps/back-office/test/session-lifecycle.test.tsx`; they exercise the rendered controls and real store/core with stubbed fetch responses.

Immediately before verification, `git diff --stat` was empty and the branch/base hashes matched those recorded above. After the green run, `git diff --stat` and `git status --short` were still empty, and both hashes were unchanged. The reviewed tree was stable. `git diff --check development` also passed.

I ran two additional inline Node/jsdom probes against the unchanged source, using the existing harness and rendered controls:

- With logout held pending, a visibility read answered `UNAUTHENTICATED`. Both credential fields remained disabled and pressing the rendered pending button sent no login request. After logout settled, both fields and Sign in became usable, while the Session ended notice remained unchanged.
- With a visibility read held, activity answered `SESSION_IDLE`; a new sign-in was then held pending. Delivering `FORBIDDEN` on the old read removed the draft and kept entry disabled until the sign-in settled. A credential refusal then enabled fresh entry, left the password empty, and did not restore the destroyed work.

Both probes passed assertions and wrote no files. They check the shared busy flag across logout, session loss and sign-in, beyond merely observing that BO-01 appears.

I reviewed the builder's red-run evidence in the Round 2 Handoff. I did not repeat those mutations in this round. The in-memory revision-guard mutation I ran in Round 1 remains independent evidence for sequence (c); the new committed test now covers that sequence, including input after two minutes. I did not repeat each new test file three times individually.

I did not perform a live HTTPS sign-in/logout, visual browser inspection, password-manager testing, or browser focus/selection verification. Task acceptance criterion 5 remains the owner's check. I edited only this review report, made no commit or push, and left the task and Handoff unchanged; the Handoff already ends with exactly `DONE`.

## Cleared

**F1 is closed.** `apps/back-office/src/session/realSession.ts:209` now clears the private cookie-changing flag and publishes `busy: false` into the current signed-out snapshot. Logout calls it before the revision check, so an event-driven phase change no longer strands BO-01. The snapshot spread preserves the event's reason, waits and working-area decision. Both sign-in settlement paths use the same helper. The new rendered tests prove successful logout followed by exactly one new sign-in and recovery after session loss during pending logout. This satisfies Round 2 ruling 1, the original ruling 9's in-flight exclusion, and DESIGN-015's resting/loading distinction.

**F2 is closed.** `realSession.ts:296` handles a core `FORBIDDEN` event from BO-01 by entering Access refused and destroying retained work. Other end events remain ignored there, exactly as Round 2 ruling 2 directs. The new tests prove draft removal, the prescribed notice and a fresh working area after a later sign-in, as well as preservation for the non-forbidden counterpart. The revision guard remains intact. This meets the task's working-area removal rule and DESIGN-015's Access refused row.

**F3 is closed.** `realSession.ts:432` distinguishes the three ending logout codes from every other refusal. Non-ending refusals now settle the in-flight state and draw the shared failure copy, the unconfirmed-sign-out sentence and Try again. Tests for both `INVALID_CREDENTIALS` and `THROTTLED` confirm usable retry controls and token-bearing retries, satisfying Round 2 ruling 3 and DESIGN-015's Logout failed row. The shared sign-in meanings no longer determine those logout failures.

**Sequence (c) is covered.** The test at `apps/back-office/test/session-lifecycle.test.tsx:417` proves that a successful held read arriving after interim idle does not change resting BO-01, reveal the frame or permit further activity. The Handoff corrects its earlier claim that the local revision guard was redundant and records the requested red proof. Round 2 ruling 4 is satisfied.

**The fix remains narrow.** The only Round 2 production change is the back-office session store; the API core, credential handling, styles and application separation are unchanged. The full suite reran the password/B-12 checks, fixture/build isolation checks, route-boundary checks and core logout/release tests. I found no new boundary violation or product copy introduced by the fixes. The original scope still defers M-6 and browser draft focus/selection acceptance to the later work identified in the task.
