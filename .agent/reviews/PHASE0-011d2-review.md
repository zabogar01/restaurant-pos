# PHASE0-011d2 review — round 2

## Verdict: clean

F1 is closed, with no new findings in this re-review. Reviewed fix `1eadc988c1431b3520b0b83dd27af3555da8fb3f` at branch HEAD `44fdc58f4bbd10eea1a907dc8b75d2296bb04ba1`, against the round 2 ruling and the original task's contract. The intervening commit changes no back-office implementation. The owner's served-browser acceptance check remains outstanding.

## Findings

None. The original F1 was that a stale session read could install C while an other-manager sign-in was pending, and a failed sign-in then left M-6 naming A with C's token. The new comparison at `apps/back-office/src/session/realSession.ts:467` closes that path before interpreting any non-success result; the catch at `:500` applies the same rule. `coreLostIdled()` at `:442` treats both a different actor and a missing actor as loss of the idled identity, and retains the draft through `toSignedOut('ended', false)`.

The pre-send comparisons at `:595` and `:684` also implement round 2 ruling 1: discard logout and fixed-form re-authentication send nothing if the core no longer holds the idled person. This preserves FR-A2b and ADR-009 §6's same-manager renewal and the owner's 2026-10-06 distinction between that renewal and another manager's ordinary sign-in. No new copy, API, or server change is needed.

## What I ran and what I did not

**Observed verification:** `npm run verify` passed all six typechecks and **90 test files / 3,731 tests**, with Vitest duration 64.71 seconds. This is five more tests than round 1 and 79 more than the task's development baseline of 3,652.

Before and after the green run and supplementary checks, the working tree was clean, HEAD and `development` were unchanged (`44fdc58` and `ecead3d` respectively), and `git diff --stat development` was identical: **14 files, 3,331 insertions, 88 deletions**. Those figures include the already-committed round 1 review. Only this report was subsequently edited.

I independently replayed the third-person interleaving through the unchanged rendered harness, real store and real API client. The four outcomes were `INVALID_CREDENTIALS`, `THROTTLED` with a duration, `INTERNAL`/500 with successful health, and rejected fetch with unavailable health. Each was exercised for the re-authentication and logout follow-up, giving eight scenarios per configuration:

| Configuration | Observed result |
|---|---|
| Current implementation | All eight reached BO-01 Session ended at sign-in settlement. All retained the draft hidden and inert. Subsequent public re-authentication/logout calls sent zero requests. |
| Only the failed-sign-in settlement comparisons removed in memory | All eight first retained the old mismatch. Clicking Back and Continue, or Log out and Discard, then exercised the corresponding pre-send comparison. Each sent zero requests, closed M-6 to Session ended, and retained the draft hidden and inert. |
| Settlement comparisons and both pre-send comparisons removed in memory | All eight sent the unwanted request. Four re-authentications used C's session and accepted a stubbed C success; four logouts accepted a stubbed 204. None ended on BO-01 Session ended with A's retained draft. |

The supplementary runner used `node -e`, jsdom, the existing session harness and an in-memory TypeScript load hook. It counted the mismatch branch and asserted the screen, request and draft outcomes. No file was changed to make a mutation. The final configuration was a negative control whose unsafe outcomes were asserted explicitly; I am not claiming that it was a failing Vitest run. Responses were stubbed, not sent to the real server.

I did not repeat the builder's original red-first run on `104b7a7`, its exact Vitest mutation run, or the original three-consecutive-run checks. I did not run the owner's HTTPS/browser walkthrough, inspect native top-layer rendering or inertness, measure overflow, or test assistive technology. Those limitations from round 1 remain. No commit or push was made.

## Cleared

**The reachability claim is correct for the current production UI flow, with a precise qualification.** The pre-send checks execute normally; their *mismatch branches* are not reachable by the current UI event sequence once the settlement fix is present. Outside an other-manager sign-in, the core's actor-change/end event synchronously moves the idle store to BO-01. During that sign-in, the cookie-changing flag and busy state prevent mode changes and a second request. A successful result leaves idle, and a non-success now checks the actor before leaving an interactive M-6 available. There is no asynchronous yield between clearing the busy flag and that comparison for a browser input event to intervene. This is a control-flow conclusion about the currently wired screen, not a promise about every future consumer of the store.

The builder's further statement that testing these guards requires a new seam is unnecessary. The in-memory mutation above reaches both through the existing UI controls and independently proves their protection. It is deliberately a mutation-based test, not evidence of an unmodified production path. The requested standalone Continue test was not added to the repository; this report supplies direct reviewer evidence for that guard, and for the parallel logout guard. The lead can judge whether to require a permanent regression test without needing a production injection seam.

The shared `otherSignIn` flag still defers the successful sign-in's own actor-change event, as ruling 7 requires, but a failed sign-in can no longer silently leave the screen bound to a different core identity. I checked this shared flag across success, credential refusal, cooldown, general failure, unavailable and obsolete-result handling. The ordinary same-identity failures still retain their established notices and waits.

The five added tests use the real activity/visibility/core-event path, not an injected idle snapshot. They verify retained work for A and fresh work for C. The full suite also retains coverage of successful other-manager sign-in, pending-request exclusion, normal renewal and logout, focus restoration, and the other behavior cleared in round 1.

## Handoff

Round 2 closes F1. The implementation is clean within the reviewed scope, and both pre-send safeguards have independent mutation-based evidence. No source or task-file change was made by this reviewer. The lead still owns acceptance of the missing permanent guard test and the owner's served-browser criterion 5; the report does not claim either was completed.

DONE
