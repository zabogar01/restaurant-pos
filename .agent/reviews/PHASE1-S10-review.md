# PHASE1-S10 review

## Verdict

**findings** — one medium finding. Reviewed `agent/phase1-s10` at `b4f93995f7e11484d2dfae7bf31d33bc213c24bf` against `development` at `c89e11b0b404ba1bac368edc800d51aebf7b44a5`, the task, its cited requirements and boundaries, and DESIGN-016's artifact and delivery notes.

## Findings

### F1 — Medium: switching locked accounts can produce no announcement

**Location:** `apps/back-office/src/SignIn.tsx:142` (the announcement update at line 144 and its rendering at line 212); coverage gap in `apps/back-office/test/sign-in-focus.test.tsx:335`.

The effect detects a different account, but stores only the announcement string. If that string equals the previous account's announcement, React leaves the status element's content unchanged. The account reference advances anyway, so subsequent ticks cannot repair the missed update. The visible notice also correctly has `aria-live="off"`, leaving no live-region update for the newly selected locked account.

This breaks PHASE1-S10 lead ruling 5 and acceptance criterion 5: changing the locked account key must write a new announcement, including when switching between known locked accounts. The rule comes from the task's accessibility requirement, not from FR-A5b's server-side throttle policy.

**Concrete reproduction:** using the existing session harness, real session store and mounted `OfficeApp`, return a 120-second `THROTTLED` response for each of two accounts without advancing the manual clock. With the second account displayed, replace Username directly with the first account, as a select-all-and-paste edit would do. Both known waits remain 120 seconds. A `MutationObserver` on the persistent status element reports **zero writes** after the edit and settlement; its text remains the previous announcement. I executed this sequence against the unchanged implementation. The existing test obtains a fresh second lock through an unlocked state and uses different durations, so it does not exercise this transition.

**Proposed fix:** keep the status region mounted and make its content update depend on the account transition even when the text is equal. For example, update its text through a ref in the existing guarded effect, as the artifact does, or replace a keyed content child inside the persistent region. Preserve the no-write behavior for ticks, case changes and trailing spaces. Add a regression test that switches directly between two known locked accounts with identical announcement text, in both directions, and observes the DOM writes.

## What I ran and what I did not

- `npm run verify` completed with exit 0: typechecking passed, **179 test files passed and 6,269 tests passed**. The run reported 135.95 seconds. Its initially silent interval did not mean failure; the final result is green.
- `npm run test:unit -- --project=client` also completed with exit 0: **136 files and 5,267 tests passed**, in 19.98 seconds.
- `git diff --check development` passed. Before verification and after the last green result, `git diff --stat development` was identical: **17 files changed, 1,121 insertions and 111 deletions**. Both revision IDs above were unchanged, and `git status --short` was empty before writing this report. The reviewed tree was stable.
- The additional in-memory jsdom reproduction used `node --import tsx`, the existing harness and a `MutationObserver`. It produced `announcementWrites: 0` with both waits at 120 seconds. No source or test file was modified. This proves the missing DOM update; I did not test a screen reader's spoken output.
- `npm run db:migrate` failed before running migrations because the tsx CLI could not create its IPC listener (`listen EPERM`). A separate TCP connection probe to `127.0.0.1:5433` also returned `connect EPERM`. These command restrictions are separate from the subsequently completed, successful verification run.
- I did not rerun `npm run test:e2e:all`, browser geometry/contrast measurements, or the builder's before-change and mutation runs. The task's lead-verification section records 150 browser tests passing and the measurements; those are the lead's evidence, not runs I performed.

## Cleared

The stable content `div`, conditional main role, existing hidden/inert handling and unchanged staff-user key satisfy lead ruling 1 and ADR-011 rule 22 without remounting held work. The session-lifecycle and departure assertions retain their meaning; existing tests changed only their structural selectors. The browser draft-note assertion was added without weakening the restoration checks.

The draft sentence uses the exact reviewed copy and requires Session ended, a held working area and non-clean guard status. It reveals neither a manager identity nor draft contents. Ordinary failure, lock and oversize notices take precedence. The layout rules match the artifact's token-based column and scrolling composition, and the frame adds the required centring rule. Browser measurements remain attributed to the lead.

The focus and validation tests use the real session store through the mounted application for ordinary production transitions. Credential inputs remain native and uncontrolled, Password is cleared on submission, validation sends nothing locally, and the change introduces no credential logging, audit changes or actor substitution under B-12/B-13. The existing request, session and account-throttle behavior remains outside this change.

**Mixed missing/oversized input:** I agree with the builder's interpretation. Lead ruling 4 explicitly requires every missing field and every oversized field to be marked, with focus on the first invalid field. This is more specific than the general instruction to follow `login.js`. The owner's 2026-10-20 oversize ruling prohibits inline text beside an oversized field; the build instead puts the inline message beside the separate missing field. I do not consider this deviation a defect.

The shared-value check found F1: two distinct account states can share the same announcement string, which hides the missing update. Ordinary lock arrival, countdown silence, normalized-account edits, focus recovery, and local invalid-field descriptions passed the existing client checks.
