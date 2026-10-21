# PHASE1-S1b review

## Verdict

**findings** — four correctness findings. Reviewed `agent/phase1-s1b` at `ffd6b4243a55eb9e7c807a789a2439cc6514a8d4` against `development` at `da7c270f505c44dc38703391bbfc930be00936be` and the task's cited authorities, including its later lead rulings. No source or test was edited. Nothing was committed or pushed.

## Findings

### F1 — P2: The previous manager's top-bar logout decision survives a different manager's sign-in

**Location:** `apps/back-office/src/OfficeApp.tsx:103`, `:125`, and `:194`.

The `asking` state and its dialog belong to `OfficeApp`, outside the working area's `staffUserId` key. The reset observes only `signed-out` and `starting`. Changing managers through M-6 transitions from `idle` to `signed-in`, so the old confirmation remains open over the new manager's clean area. Its global hold also remains set.

**Authority:** PHASE1-S1b lead ruling 2 explicitly includes the top-bar logout confirmation among the dialogs destroyed by a different manager's sign-in; the task's interpretation of AC 10 says a different manager destroys all of it. ADR-011 rule 22 defines the identity-owned working area. The table draft itself is correctly destroyed here; the defect is the surviving departure decision, not exposure of its field value.

**Observed scenario:** Open Table 1, change its label to Window 1, press the top-bar Log out, let the session reach M-6, and sign in as R. Ayu through the different-manager flow. An in-memory jsdom run using the existing real-session harness returned `phase: signed-in`, `actor: R. Ayu`, and no edit panel, but still had the open dialog “Log out and discard your changes?” with Keep this draft and Discard changes and log out. Neither choice belongs to the new manager's session.

**Proposed fix:** Give the confirmation and its hold the same identity lifetime as the working area, or explicitly clear both when that identity changes. Preserve the same-manager M-6 behavior. Add the different-manager transition with this particular confirmation already open; the existing different-manager tests cover the table panel and departure dialog instead.

### F2 — P2: Leaving and returning to Tables loses an outstanding command and its authoritative answer

**Location:** `apps/back-office/src/Screens.tsx:12`, `apps/back-office/src/tables/Tables.tsx:90`, and `apps/back-office/src/tables/model.ts:224`.

The model is constructed inside `Tables`, whose component is unmounted when the route becomes the landing. Its cleanup sets `stopped`, and `answered` then ignores the command's eventual answer. Returning to Tables constructs a fresh model with no pending command. This makes command lifetime depend on screen lifetime even when the signed-in manager and working-area key have not changed.

**Authority:** The task's AC 9 interpretation requires a late authoritative answer after Discard to insert or replace its record silently and requires the waiting status while the discarded save is outstanding. Its AC 7 interpretation keeps New table and every row action inert while any command is pending. `docs/DESIGN.md:1526` and `:1579` carry the same rules.

**Observed scenario:** Hold a rename of Table 1 to Window 1, request navigation to the landing through the production router, choose Discard, then use the real Tables rail link to return before the answer arrives. The new screen displays the old rows, no waiting status, and an enabled New table control. Deliver the successful rename answer: the list still shows Table 1. This was reproduced with the real `Screens`, router, components, and transport harness; no component or source was substituted. Browser Back uses the same guarded route-departure path. The committed late-answer test cancels the panel without leaving `Tables`, so it cannot expose this unmount.

**Proposed fix:** Retain command ownership and authoritative records for the lifetime of the manager's keyed working area, independently of whether Tables is currently displayed. Discard should remove the draft while preserving the outstanding operation and silent answer handling. Test leaving the route, returning before settlement, and receiving the answer, including the pending control states.

### F3 — P2: A delayed refusal reread overwrites a later successful command

**Location:** `apps/back-office/src/tables/model.ts:163`, `:265`, and `:285`.

The sequence counter orders reads against other reads only. A DUPLICATE or NOT_FOUND reread starts without being awaited, and the command is cleared immediately. The manager can submit and complete a new command while that read is outstanding. Applying the newer command does not invalidate or reconcile the older read, which can then replace the entire list with its earlier snapshot.

**Authority:** Consult C2 section 3 requires the client to replace its record with the authoritative command answer. Task AC 3 and `docs/DESIGN.md:1529` require the returned record and named success to agree; success must not cause another list read.

**Observed scenario:** Rename Table 1 to Table 2 and return DUPLICATE, holding the resulting GET. Correct the field to Window 1 and return a successful update. The list then contains Window 1 and the page says “Window 1 saved.” Deliver the earlier GET containing Table 1: the list changes back to Table 1 while “Window 1 saved.” remains. An in-memory run reproduced both snapshots through the existing components and transport harness. The held GET models a snapshot read before the second command committed, whose response arrived later.

**Proposed fix:** Reconcile reads with intervening successful commands, for example by tracking command-applied revisions and retaining authoritative records newer than a read's start. Do not let an older snapshot overwrite those records or add a success-triggered reread. Add a deferred-GET test spanning a refusal followed by a successful correction.

### F4 — P2: A successful retry after a failed reread leaves the saved record hidden

**Location:** `apps/back-office/src/tables/model.ts:265` and `apps/back-office/src/tables/Tables.tsx:225`.

The success branch updates `rows`, closes the editor, and announces success, but leaves `read` unchanged. After an unknown outcome whose reread failed, `read` is still `failed`. That same value suppresses the whole table and disables New table, even when the next explicit Save succeeds. The requested focus target is also absent from the rendered table.

**Authority:** Task AC 3 and `docs/DESIGN.md:1529` require an authoritative success to show the returned record and focus its Edit control. Task AC 6 and `docs/DESIGN.md:1535` keep explicit Save available after an unknown outcome, including a failed reread. These rules must work together; the artifact's similar shared read-state pattern does not establish correctness for this transition.

**Observed scenario:** Rename Table 1 to Window 1; return a command fault and then a failed list reread. Press Save again and return the authoritative Window 1 record. The in-memory component run showed no table rows, no editor, New table still `aria-disabled="true"`, the read-failure notice, and “Window 1 saved.” simultaneously. The existing recovery test uses Try again to repair the read first, which avoids this state.

**Proposed fix:** Separate collection-refresh failure from whether known authoritative rows can be rendered. Show and focus the returned record after success while accurately preserving any unresolved collection-refresh warning; do not silently assert that a failed full-list refresh succeeded. Cover explicit Save succeeding before Try again repairs the collection.

## What I ran and what I did not

- `npm run verify` exited 0: all seven typecheck projects completed, and **102 test files / 3,922 tests passed**. Reported duration was 76.13 seconds.
- A separate `npm run test:unit -- --project=client` exited 0: **71 files / 3,233 tests passed**. It was started while the full run's output had not yet returned, not because the full run failed.
- `npm run test:e2e:all` built both clients successfully but exited 1 during harness setup with `connect EPERM 127.0.0.1:5433`. **No browser cases ran in my attempt.** The builder's and lead's recorded 68 passes are their evidence, not mine. I did not seek an approval override or claim a browser pass.
- Four read-only `node --import tsx --input-type=module -e` reproductions imported the existing jsdom harness, real session store, transport, `OfficeApp`, and `Screens`. They drove controls and supplied deferred responses in memory. All four observed outcomes are recorded above. These are component-level reproductions, not real-browser inertness or layout evidence. No mutation of source or tests was made, and I did not rerun the builder's mutation proofs.
- Before and after the green full verification, `git diff --stat development` was identical: **30 files, 3,813 insertions, 27 deletions**. The branch and development hashes above remained unchanged. The working tree was clean before writing this report. `git diff --check development...HEAD` passed. A final pre-report stat and hash check also matched.

I inspected the branch's source and test changes, C2, the DESIGN-017 Handoff and copy/state inventory, the Frost HTML/CSS/behavioral source, the binding configuration-form rules, S1a's handoff, the cited PRD and boundaries, and the applicable ADR-011 rules. The task's ADR-011 filename is stale; the actual file is `docs/decisions/ADR-011-browser-clients.md`. No Context7 or external library lookup was needed. No file-reading tool was exposed in this session, so reads used simple `rg` and `awk` commands; the report was written with the file patch tool.

I did not perform a visual comparison in a real window, a screen-reader pass, the 60-row geometry check, or repeat C5 timings. The reviewed browser spec reaches Tables through the production sign-in and rail path and uses both session clocks and the credential helpers. Its coverage does not prove the additional interleavings above. The client navigation tests synthesize `popstate`; I do not treat them as proof of native browser history behavior.

## Cleared

The manifest and built-only rail, configuration-only API type, shared validation helper, trimming and UTF-16/control-character rules, designed field errors, natural ordering and counts, empty first-run state, inactive-label editing, and separate reactivation recovery are sound in the reviewed code and passing client checks. No restaurant table seed or production fixture state was added (B-24).

Ordinary command success, refusal, unknown outcome, one-command guarding while the screen stays mounted, read-only retry, and no automatic command resend are covered and pass. The model does not infer success from a reread. The shared-value review specifically followed `read` through failure and later success, producing F4, and followed `asking` across identities, producing F1.

The table panel and departure decision preserve the same manager's draft through M-6 and BO-01 in component tests, and a different manager destroys those keyed components. The top-bar confirmation is the exception in F1. B-13 and B-20 do not acquire a new actor, audit, or transaction path in this client-only change; the existing server and contracts are unchanged. The Phase 2 open-order refusal and the other explicitly excluded design content remain out of scope as ruled.
