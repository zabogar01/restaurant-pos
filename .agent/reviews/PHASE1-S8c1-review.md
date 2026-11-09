# PHASE1-S8c1 review

## 1. Verdict

**findings** — three findings, below. Reviewed `development...agent/phase1-s8c1`, with HEAD at `4261f5e44e872f489edbf1a37284afa887ab6831` and development at `e90a2655ec3abcc57bed7208279c4c1ce894104b`.

## 2. Findings

### F1 — P2: Clear credentials when the command answers, independently of result presentation

**Location:** `apps/back-office/src/staff/model.ts:433`, also `:459`; the inputs clear only when `credentialEpoch` changes in `apps/back-office/src/staff/Staff.tsx:416`.

`answered()` holds a non-session answer behind an open departure decision without advancing the credential epoch. For an unknown outcome, `present()` likewise waits for the list reread before advancing it. Thus the PIN, username and password remain in their native inputs after the command has answered. Clearing is coupled to presenting the result, although those events have different requirements.

**Authority:** PHASE1-S8c1 ruling 5 and AC 5; ADR-011 rule 25; DESIGN-023's Rules for S8c at `.agent/tasks/DESIGN-023-users.md:620` and `docs/DESIGN.md:2182`. These require clearing after every response while allowing the answer itself to remain held. This is a credential-lifetime defect, not evidence of a log or network leak.

**Failing scenarios:** Submit a cashier create, press Cancel while it is pending, and deliver a PIN `DUPLICATE` while the departure decision remains open. The PIN is still populated until Stay is pressed. Alternatively, let the create answer with an unknown outcome and hold its follow-up GET: the PIN remains populated until that GET finishes. Both scenarios failed additional in-memory tests through the real Screens, OfficeApp, session store and transport harness. Separate model probes confirmed that the epoch remained unchanged after the answer and changed only after Stay or the reread completed.

**Proposed fix:** Clear the still-matching form's credential inputs as soon as its command answers, before the presentation gate or any reread. Preserve the held answer, pending-command exclusion, departure decision and delayed focus/announcement. Add tests that inspect the inputs while the decision or reread is still outstanding, including all three manager credentials.

### F2 — P2: Recalculate panel height when surrounding content moves the panel

**Location:** `apps/back-office/src/staff/fit.ts:29`, also `:39`; its caller is `apps/back-office/src/staff/Staff.tsx:410`.

The hook measures on mount, pane resize, window resize and pane scroll. Its dependencies are the stable ref and the constant `true`. It does not measure again when a render moves the panel's top without resizing the pane. For example, same-manager M-6 recovery inserts the existing resumed notice above Screens (`apps/back-office/src/OfficeApp.tsx:189`). The panel keeps its previous maximum height despite having less available room. Opening a manager form in a partial list and subsequently restoring the counts through Try again is another source of a top-position change.

**Authority:** PHASE1-S8c1 ruling 15, DESIGN-023 Delivery and implementation boundary, and `docs/DESIGN.md:2216`. Heading and commit controls must remain visible while the field body scrolls. The design artifact calls `fitPanel()` during its render as well as observing resize and scroll; the implementation omits that render-time recalculation.

**Failing scenario and evidence:** Open the manager form, enter M-6 and resume without scrolling or resizing. An in-memory test using the actual screen and hook, with explicitly mocked geometry, held the pane bottom at 900 and padding at 24, then moved the panel top from 240 to 340 during recovery. Its maximum height remained `636px` instead of becoming `536px`. This proves the missed recalculation. The resulting footer clipping on a full-height form is inferred from the layout and was not measured in a browser in this review. D1b checks only the initial manager form, so its viewport assertions do not cover this transition.

**Proposed fix:** Refit after layout changes that can move the panel, including session recovery and list/status changes, while retaining the resize and scroll handling. Add a browser assertion that Save and Cancel remain within the viewport after M-6 recovery and after a partial-list read succeeds.

### F3 — P3: Restore the first form field after M-6 regardless of the previously focused field

**Location:** `apps/back-office/src/staff/Staff.tsx:177`.

The M-6 return path calls `refocus()` only when focus is missing, on the body, or on a credential input. When Classification had focus before the interruption, the frame restores it and this branch leaves it there. That does not implement the accepted first-field rule. The Handoff's explanation of restoring the frame's previous element narrows the design contract without a task ruling authorizing that change.

**Authority:** PHASE1-S8c1 ruling 14 and AC 13; DESIGN-023 Focus and interruption contract, `.agent/tasks/DESIGN-023-users.md:855`, which specifies the first form field on same-manager restoration, with separate targets for pending work, held results and held dialogs.

**Failing scenario:** Open Add person, choose Cashier, focus Classification, enter M-6 and Continue as the same manager. An additional in-memory test through the production screen/session wiring observed `staff-classification` as the active element where the contract requires `staff-name`. The existing recovery tests do not explicitly start with Classification focused.

**Proposed fix:** On same-manager recovery of an ordinary open form, request its first-field focus regardless of which ordinary control the frame restored. Preserve the higher-priority focus for a restored modal, pending status or held result. Cover both credential and non-credential prior focus.

## 3. What I ran and what I did not

**Observed on the unchanged branch:**

- `npm run verify` exited 0. Typechecking passed; **170 test files and 6,078 tests passed**. The unit run reported 135.26 seconds.
- `npm run test:unit -- --project=client` exited 0: **127 files and 5,076 tests passed**. This separate run started while the full run was still pending; it did not use the server database.
- `npm run test:e2e:all` built both production clients successfully, then exited 1 during Playwright setup with `connect EPERM 127.0.0.1:5433`. **No browser tests ran in this attempt.** The task records the lead's 138 passing browser tests; that remains the lead's evidence, not mine.
- Two programmatic Vitest runs appended review-only tests through an in-memory Vite transform, without changing a source or test file. The first produced **3 failed, 22 skipped**: the two credential-lifetime cases in F1 and the focus case in F3. The second produced **1 failed, 22 skipped**: F2's explicitly mocked geometry case. These tests used the existing production-path harness; no production behavior was mutated.
- Additional in-memory checks of the actual model passed for a pre-create read that omits the newly answered row and for an older failed visit read arriving after a newer successful read. The existing UI test also covers an older read trying to undo an answered reactivation.

**Tree stability:** `git diff --stat` was empty before verification and after its green result. Both branch hashes above remained identical. The branch diff remained **27 files, 4,835 insertions and 18 deletions**. A further status check after the in-memory probes was clean. This report is the only authored file change; no source or test file was edited, committed or pushed.

I did not run the headed Chrome/Firefox password-save-prompt check, which ruling 21 assigns to the lead and owner. I inspected the Frost artifact's source and relevant state definitions, but did not visually inspect every artifact state or measure production layout in a browser. I did not independently replay the builder's historical mutations. The Handoff explicitly records that implementation preceded tests, contrary to the task's red-first instruction; later mutation evidence does not establish compliance with that order. The reviewed assertions address the named guards, but their settled-state coverage misses the timing and restoration cases above.

## 4. Cleared

- **Scope and integration:** Staff is between Tables and Discount presets, its route and current marker are wired, and its model belongs to the keyed working area. Shared CSS changes append BO-06 rules. Existing test edits only update rail/manifest expectations and related wording; I found no weakened existing behavior assertion.
- **Identity and fields:** Kitchen has no credential inputs or authenticating role; the own row has no action; former managers show their retained username. The four pure checks agree with the contract on their tested bounds, including code points, ASCII digits, username normalization and untrimmed passwords. The submitted bodies contain only the selected classification's fields.
- **Credential representation:** The credential inputs are uncontrolled and have no value/defaultValue props. Their text is absent from model state and application logging/storage paths. Username normalization on blur is the explicit ruling-4 exception to submit-only reading. Showing a returned username on its saved row is correct: DESIGN-023 explicitly distinguishes public UserView identity from a typed credential echo (`:608–612` and the copy table). F1 concerns when values clear, not that public-row exception.
- **List merging:** Grouping preserves server creation order; changed rows retain their underlying position and answered creates append. The applied-record clock protects command answers against reads started earlier, including retaining a newly created row omitted by that read. Older read failures cannot displace a newer successful read. Without a server version this is the task's stated ordering guarantee, not a general claim that arbitrary overlapping snapshots can be totally ordered.
- **Commands and outcomes:** Deactivation uses the named, classification-specific confirmation; reactivation's PIN conflict opens the explicit new-PIN submission without automatically resending. Rulings 8 and 10 justify no reread on that conflict; ruling 11 explicitly specifies the three unreachable row refusals as definite failure plus one reread. Those specific rulings refine C2's earlier table pattern. Unknown outcomes remain unknown after rereading, and authoritative success does not trigger a reread. The command slot, discarded pending response and result gates follow the intended model apart from F1.
- **Design and tokens:** The column-width use of `--frost-office-nav-width` is an exact port of accepted `users.css:6–7`, not a new token misuse introduced by this task. Its name alone is not a finding. The initial panel-height calculation and flex/body-scroll composition match the artifact; F2 concerns later layout changes. Deferred S8c2 controls and review-only fixture controls are absent.
- **Browser-test meaning:** D1 drives the real rail and named deactivation confirmation, checks one POST and the inactive database record, then uses real POS input to trigger the next activity request. It asserts `UNAUTHENTICATED`, signed-out state and `data-lock-state="invalidated"`; it does not manufacture the lock state through a test-only entry point. D1b and D1c cover real creation/sign-in and the two explicit reactivation submissions. The scan map adds exactly ruling 17's four credential/route pairs, and the profile fixtures invoke the scan. These are source-level conclusions; the local browser rerun was blocked as recorded above.
