# PHASE1-S1b re-review — rounds 2 and 3

## Verdict

**findings** — F1–F4 are resolved for their original scenarios and the Round 2 rulings. Two new P2 findings remain in the visit-read behavior introduced by Round 3.

Reviewed fix commits `1ac6aa8788d3e1f7070b349dc89ec7d4b833909f` and `f20cb7132ec98d201145d6e696eab46fdf450298`, with the task's Round 2 and Round 3 rulings. The tested branch head was `1b8e1ce6c3dfc6aa50a3d9f8995d83af13821ab9`; `development` remained `da7c270f505c44dc38703391bbfc930be00936be`. This report replaces the previous review. Only this report was edited; nothing was committed or pushed.

## Findings

### N1 — P2: A failed visit reread hides a successful save that answered after the read began

**Location:** `apps/back-office/src/tables/model.ts:187` and `:293`; `apps/back-office/src/tables/Tables.tsx:168` and `:227`.

Round 3 keeps existing rows actionable while a visit reread is outstanding. If a command succeeds during that read, the success branch leaves `partial` false because `read` is still `ready`. A subsequent failure of that older read sets `read` to `failed` without preserving visibility of the newly authoritative record. The table disappears, New table becomes inert, and focus falls off the removed Edit button, while the page still announces success.

**Authority:** Task AC 3 and `docs/DESIGN.md:1529` require the returned record to be shown and its Edit control focused after success. The task's Round 2 F4 ruling specifies the truthful combination of known rows, the read-failure alert, withheld counts, and live New table. Round 3 ruling 1 introduces a reread that keeps the held rows available while it runs. The resulting behavior must not depend on whether read failure arrives immediately before or immediately after the authoritative success.

**Observed scenario:** Start with the loaded table list, navigate to the landing through the production router, then return through the Tables rail link while holding that visit's GET. Edit Table 1 to Window 1 and deliver a successful Save. At this point the list contains Window 1 and the page says “Window 1 saved.” Deliver a fault for the held GET, with health succeeding. The component run then returned no visible rows, New table `aria-disabled="true"`, the read-failure alert, and “Window 1 saved.”; `document.activeElement` was `BODY`. The saved record remains in model memory but is suppressed by the shared `read`/`partial` render gate.

**Proposed fix:** Reconcile failed reads with intervening authoritative command answers as well as reconciling successful reads. If an answer was applied after a read began, preserve the known-row presentation when that read fails, using the Round 2 F4 composition: alert retained, counts withheld, returned row visible, and controls available when no command is pending. Add the deferred visit-read failure after a successful command as a regression test. The original F4 test covers the opposite response order and passes.

### N2 — P2: An outstanding read suppresses the refresh required by a later visit

**Location:** `apps/back-office/src/tables/model.ts:436`.

The `reading === 0` condition uses one model-wide in-flight count to deduplicate both development effect remounts and genuine later visits. Consequently, leaving Tables and returning while an earlier visit's GET remains outstanding sends no read for the new visit. The response can be an older snapshot that predates changes made while the manager was away.

**Authority:** The task's Round 3 ruling 1, at `.agent/tasks/PHASE1-S1b-tables-screen.md:504`, requires every visit to read the list, including visits during a pending command, with no loading replacement on later visits. Its required scenario is leaving, changing the server's list, and returning to see a new read and the new row. The builder's development-remount rationale does not establish an exception for a distinct production visit.

**Observed scenario:** Load Tables once, leave, and return while holding the second GET. Leave again, arrange the next server response to include a newly created Window 5, and return through the real Tables rail link. The read count remains **2**, although there have been three visits. Deliver the earlier held response, captured without Window 5: the list still lacks Window 5 and the count remains 2. This was reproduced with the real router, rail, screen, and transport harness; no component was replaced. The existing Round 3 test waits for the previous visit's read to finish, so it does not exercise this condition.

**Proposed fix:** Distinguish repeated effects for the same visit from a new route visit. Each genuine visit should start its own read even if an earlier visit's read remains outstanding; the existing read sequence and per-record command merge can prevent older responses from overriding it. Add a two-return test with the previous visit's GET still held.

## What I ran and what I did not

- `npm run verify` exited 0: all seven typecheck projects completed, and **103 test files / 3,930 tests passed**. Vitest reported 64.53 seconds. This includes the eight new Round 2/3 tests and the unchanged earlier suites.
- Four independent, read-only `node --import tsx --input-type=module -e` runs replayed the original F1–F4 scenarios through jsdom, the existing real-session/transport harness, `OfficeApp`, and `Screens`. All four included assertions and exited 0. F2 used the production router to leave and the real rail to return. The observations are summarized under Cleared.
- Two additional in-memory component runs reproduced N1 and N2 and printed the relevant rows, request counts, control states, notice, and focus. They supplied deferred transport responses; they did not mutate source or test files. These observations are component evidence, not browser inertness or layout evidence.
- `git diff --stat development` was identical before and after the green verification: **32 files, 4,371 insertions, 27 deletions**. The head and development hashes above remained unchanged. The tree was clean before this report was rewritten. `git diff --check development...HEAD` passed.

I reviewed the two fix diffs, their new tests, and the task's rulings and handoffs against the previously read PRD FR-B2 and FR-A2b, AC-28 and AC-35, B-13/B-20/B-24, C2, ADR-011, and DESIGN-017's configuration-form rules and artifact. Those authorities and the browser spec were not changed by these fixes. I did not call Context7 or need an external library lookup.

I did not rerun the browser suite in this re-review. The previous reviewer attempt failed during setup with `connect EPERM 127.0.0.1:5433`; the task records the builder's and lead's **68 passes** on the fixed code, which remain their evidence, not mine. I did not rerun their red mutations, C5 timings, visual measurements, or screen-reader checks. The new tests' `back()` and `forward()` helpers use `pushState` plus synthetic `popstate`; their passing results do not prove native browser history behavior.

## Cleared

| Original finding | Resolution and evidence |
|---|---|
| **F1 — resolved** | `OfficeApp.tsx:106` associates the confirmation with `staffUserId`, derives visibility from the working-area key, and clears obsolete identity state. The original different-manager M-6 reproduction now ends signed in with no open dialog and no global hold. The new suite also covers BO-01 and a later return of the first manager. This meets the Round 2 F1 ruling and ADR-011 rule 22. |
| **F2 — resolved** | `Screens.tsx:23` owns the model inside the keyed working area; leaving Tables no longer calls its stop. The original rename reproduction now returns to the waiting notice with controls inert, then applies the late authoritative row silently. The new tests cover rename and create across route changes. A different manager still gets a different model. This meets the Round 2 F2 ruling and task AC 7/9. |
| **F3 — resolved** | `model.ts:170` captures the applied-answer clock when each read begins; `:185` merges later authoritative records into its response. The original delayed-DUPLICATE-reread reproduction keeps Window 1 instead of restoring Table 1. The new tests also cover insertion of a created record absent from the older snapshot. No success-triggered reread was added. |
| **F4 — resolved for the original scenario** | An authoritative success received after a failed reread now sets `partial`. The original reproduction shows and focuses Window 1, retains the alert, withholds counts, and enables New table, exactly as the Round 2 F4 ruling requires. Try again remains a list-only retry. N1 is a separate response-order regression exposed by the new visit reread; it does not negate this observed fix. |

The Round 3 ordinary return scenario passes: a later visit starts a read while old rows remain visible, then displays its response. Its formatting correction is also present. N2 limits the claim that this happens on every visit.

The shared-state checks followed both `reading` across development remounts and genuine visits, and `read`/`partial` across the two response orders. Those checks produced N2 and N1 respectively. No change introduces a production table seed (B-24), a new audit actor or audit path (B-13), or a server transaction change (B-20). The configuration-only API, designed validation copy, no automatic resend, and session identity boundaries remain unchanged.

## Handoff

F1–F4 are closed for their original reproductions and the Round 2 rulings. The lead has two new, reproduced P2 findings, N1 and N2, to disposition. Verification is green on the stable head identified above; no new browser pass is claimed. The review is complete, and this report is the only edited file.

DONE
